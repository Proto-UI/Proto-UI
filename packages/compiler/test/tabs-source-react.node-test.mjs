import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import ts from 'typescript';
import { emitReact } from '@proto.ui/compiler/targets/react';
import { authoredSource } from './fixtures/authoring-source.mjs';
import { openTabsServer } from './consumers/react/tabs-server.mjs';

const require = createRequire(import.meta.url);
const compiler = fileURLToPath(new URL('../', import.meta.url));
const input = 'context-owned-async-tabs.proto.ts.txt';
const loaderName = 'authoring.load-tab';
const staleLabel = 'Selection changed; reload requested content';
const ok = value => ({ kind: 'ok', value });
const loading = requested => ({ kind: 'loading', requested });
const ready = (selected, text) => ({ kind: 'ready', selected, text });

async function linkPackage(directory, name, source) {
  const destination = path.join(directory, 'node_modules', name);
  await mkdir(path.dirname(destination), { recursive: true });
  await symlink(source, destination, 'dir');
}

function assertUnbound(unit) {
  const declaration = unit.externs.find(extern => extern.name === loaderName);
  assert.ok(declaration, 'the actual loader declaration is reached');
  const panel = [unit, ...unit.components].find(body => body.name === 'AsyncTabPanel');
  assert.ok(panel, 'the selected compilation includes the authored panel');
  const task = panel.behaviors.find(behavior => behavior.phase === 'task' && panel.tasks.some(entry => entry.fn === behavior.binding.id));
  assert.ok(task, 'the authored panel registers its task behavior');
  const boundary = task.blocks.map(block => block.end).find(end => end.kind === 'await' && end.extern === declaration.binding.id);
  assert.ok(boundary, 'the task awaits the resolved loader');
  assert.throws(() => emitReact(unit), error => {
    assert.equal(error.code, 'extern-unbound');
    assert.deepEqual(error.source, boundary.source);
    assert.ok(error.bindings.includes(panel.id), JSON.stringify(error.bindings));
    assert.ok(error.bindings.includes(task.binding.id), JSON.stringify(error.bindings));
    assert.equal(error.bindings.at(-1), declaration.binding.id);
    assert.match(error.message, /authoring\.load-tab/);
    return true;
  });
}

async function openConsumer(t, browser, origin, script) {
  const page = await browser.newPage();
  page.setDefaultTimeout(15_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  t.after(async () => {
    try { assert.deepEqual(errors, []); } finally { await page.close(); }
  });
  await page.goto(origin);
  await page.addScriptTag({ content: script });
  return page;
}

async function enqueue(page, resource, cancellable = true) {
  await page.evaluate(({ path, cancellable }) => window.tabsTrace.enqueue(path, cancellable), { path: resource.path, cancellable });
}

async function calls(page, count) {
  await page.waitForFunction(count => window.tabsTrace.calls().length >= count, count);
  const trace = await page.evaluate(() => ({ calls: window.tabsTrace.calls(), unexpected: window.tabsTrace.unexpectedCalls() }));
  assert.deepEqual(trace.unexpected, []);
  assert.equal(trace.calls.length, count);
  return trace.calls;
}

async function afterDelivery(page, index, delivery) {
  await page.waitForFunction(({ index, delivery }) => window.tabsTrace.calls()[index]?.delivery === delivery, { index, delivery });
  // The real fetch has settled. Observe the consumer again after its installed promise reactions ran.
  await page.evaluate(() => new Promise(resolve => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => { channel.port1.close(); channel.port2.close(); resolve(); };
    channel.port2.postMessage(null);
  }));
}

async function expectOwner(page, value, label, withRef = true) {
  await page.waitForFunction(({ value, label }) => document.querySelector('#app')?.textContent === value + label, { value, label });
  const view = page.locator('#app section');
  await view.waitFor({ state: 'visible' });
  assert.equal(await view.innerText(), label);
  if (withRef) assert.equal(await page.evaluate(() => window.tabsTrace.value()), value);
}

async function expectPanel(page, panel, label, visible = true) {
  await page.waitForFunction(({ kind, label }) => {
    const current = window.tabsTrace.snapshot();
    return current?.panel.kind === kind && current.label === label;
  }, { kind: panel.kind, label });
  assert.deepEqual(await page.evaluate(() => window.tabsTrace.snapshot()), { panel, label });
  const view = page.locator('#panel-surface section');
  if (visible) {
    await page.waitForFunction(label => document.querySelector('#panel-surface section')?.textContent === label, label);
    await view.waitFor({ state: 'visible' });
    assert.equal(await view.innerText(), label);
  } else {
    await view.waitFor({ state: 'hidden' });
  }
}

test('both original Tabs exports compile to native React clients using a loopback loader', async t => {
  const retained = process.env.PROTO_UI_REACT_CONSUMER_DIR;
  if (retained) await mkdir(retained, { recursive: true });
  const directory = await mkdtemp(path.join(retained || tmpdir(), 'proto-tabs-source-react-'));
  if (!retained) t.after(() => rm(directory, { force: true, recursive: true }));
  await linkPackage(directory, '@proto.ui/compiler', compiler);
  for (const name of ['react', 'react-dom', '@types/react', '@types/react-dom']) {
    await linkPackage(directory, name, path.dirname(require.resolve(`${name}/package.json`)));
  }
  const selections = [
    ['AsyncTabsOwner', 'default', 'tabs-owner-source.json'],
    ['AsyncTabPanel', 'AsyncTabPanel', 'tabs-panel-source.json'],
  ];
  const bindings = { [loaderName]: { module: './tabs-loader', export: 'loadTab' } };
  for (const [publicName, exportName, receipt] of selections) {
    const result = authoredSource(input, publicName, exportName);
    if (retained) await writeFile(path.join(directory, receipt), JSON.stringify(result));
    assert.equal(result.status, 'produced', JSON.stringify(result.diagnostics));
    assert.equal(result.component.name, publicName);
    await t.test(`${publicName} requires a located binding for its reached loader`, () => assertUnbound(result.component));
    await writeFile(path.join(directory, `${publicName}.tsx`), emitReact(result.component, { bindings }));
  }
  for (const name of ['tabs-loader.ts', 'tabs-source.tsx']) {
    await copyFile(new URL(`./consumers/react/${name}.in`, import.meta.url), path.join(directory, name));
  }
  const app = path.join(directory, 'tabs-source.tsx');
  const options = {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX, types: [], allowImportingTsExtensions: true, strict: true, noEmit: true,
  };
  const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([app], options));
  assert.equal(diagnostics.length, 0, ts.formatDiagnostics(diagnostics, {
    getCanonicalFileName: file => file, getCurrentDirectory: () => directory, getNewLine: () => '\n',
  }));
  const bundle = await build({
    entryPoints: [app], bundle: true, write: false, jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"development"' },
  });
  const server = await openTabsServer(t);
  const browser = await chromium.launch({ executablePath: process.env.PUI_CHROMIUM_EXECUTABLE });
  t.after(() => browser.close());
  const open = t => openConsumer(t, browser, server.origin, bundle.outputFiles[0].text);
  if (retained) t.diagnostic(`Generated React Tabs consumers: ${directory}`);

  await t.test('creation starts one nested load and selection changes while it is pending', async t => {
    const page = await open(t);
    const resource = server.resource('alpha', 'alpha content');
    await enqueue(page, resource);
    await page.evaluate(() => window.tabsTrace.mountOwner());
    assert.equal(await resource.requested(), 'alpha');
    await expectOwner(page, 'alpha', 'Loading');
    assert.equal(await page.evaluate(() => window.tabsTrace.select('beta')), 'committed');
    await expectOwner(page, 'beta', 'Loading');
    const [pending] = await calls(page, 1);
    assert.deepEqual([pending.selected, pending.delivery, pending.aborted], ['alpha', 'pending', false]);
    resource.release();
    await expectOwner(page, 'beta', staleLabel);
    const [settled] = await calls(page, 1);
    assert.deepEqual(settled.result, ok('alpha content'));
    assert.equal(settled.aborted, false);
  });

  await t.test('the real loader sees committed loading for pending and already-ready results and returns a typed business error', async t => {
    const page = await open(t);
    const initial = server.resource('alpha', 'content from the held response');
    await enqueue(page, initial);
    await page.evaluate(() => window.tabsTrace.mountPanel('alpha'));
    assert.equal(await initial.requested(), 'alpha');
    await expectPanel(page, loading('alpha'), 'Loading');
    assert.deepEqual((await calls(page, 1))[0].atIssue, { panel: loading('alpha'), label: 'Loading' });
    await page.evaluate(() => { window.tabsTrace.remember(); window.tabsTrace.hide(true); });
    await page.locator('#panel-surface section').waitFor({ state: 'hidden' });
    initial.release();
    await expectPanel(page, ready('alpha', 'content from the held response'), 'content from the held response', false);
    await page.evaluate(() => window.tabsTrace.hide(false));
    await expectPanel(page, ready('alpha', 'content from the held response'), 'content from the held response');
    assert.equal(await page.evaluate(() => window.tabsTrace.retained()), true);
    assert.equal((await calls(page, 1))[0].aborted, false);

    const cached = server.resource('alpha', 'preloaded from loopback', { held: false });
    await page.evaluate(path => window.tabsTrace.prime(path, 'alpha'), cached.path);
    assert.equal(await cached.requested(), 'alpha');
    assert.equal(await page.evaluate(() => window.tabsTrace.reload()), 'committed');
    await expectPanel(page, ready('alpha', 'preloaded from loopback'), 'preloaded from loopback');
    const immediate = (await calls(page, 2))[1];
    assert.deepEqual(immediate.atIssue, { panel: loading('alpha'), label: 'Loading' });
    assert.deepEqual(immediate.readyCheckpoint, immediate.atIssue);
    assert.deepEqual(immediate.result, ok('preloaded from loopback'));
    assert.equal(cached.requests, 1);

    const missing = server.resource('alpha', 'the alpha document is unavailable', { status: 404 });
    await enqueue(page, missing);
    assert.equal(await page.evaluate(() => window.tabsTrace.reload()), 'committed');
    assert.equal(await missing.requested(), 'alpha');
    await expectPanel(page, loading('alpha'), 'Loading');
    missing.release();
    const failure = { kind: 'unavailable', message: 'the alpha document is unavailable' };
    await expectPanel(page, { kind: 'failed', selected: 'alpha', failure }, failure.message);
    const failed = (await calls(page, 3))[2];
    assert.deepEqual(failed.result, { kind: 'err', error: failure });
    assert.equal(failed.aborted, false);
  });

  await t.test('resumption keeps the request capture and reads the replacement logical provider', async t => {
    const page = await open(t);
    const resource = server.resource('alpha', 'text for the earlier selection');
    await enqueue(page, resource);
    await page.evaluate(() => window.tabsTrace.mountPanel('alpha'));
    assert.equal(await resource.requested(), 'alpha');
    await expectPanel(page, loading('alpha'), 'Loading');
    await page.evaluate(() => {
      window.tabsTrace.remember();
      window.tabsTrace.replaceProvider('alpha');
      window.tabsTrace.publishSelection('beta');
    });
    assert.equal(await page.evaluate(() => window.tabsTrace.retained()), true);
    assert.equal((await calls(page, 1))[0].aborted, false);
    resource.release();
    await expectPanel(page, { kind: 'stale', requested: 'alpha', current: 'beta' }, staleLabel);
    const [settled] = await calls(page, 1);
    assert.deepEqual(settled.result, ok('text for the earlier selection'));
    assert.equal(settled.aborted, false);
  });

  await t.test('latest withdraws a late response and explicit cancellation closes a cancellable fetch', async t => {
    const page = await open(t);
    const old = server.resource('alpha', 'late superseded document');
    const current = server.resource('alpha', 'newest document');
    await enqueue(page, old, false);
    await page.evaluate(() => window.tabsTrace.mountPanel('alpha'));
    assert.equal(await old.requested(), 'alpha');
    await expectPanel(page, loading('alpha'), 'Loading');
    await enqueue(page, current);
    assert.equal(await page.evaluate(() => window.tabsTrace.reload()), 'committed');
    assert.equal(await current.requested(), 'alpha');
    const [withdrawn, pending] = await calls(page, 2);
    assert.equal(withdrawn.delivery, 'pending');
    assert.deepEqual(withdrawn.reason, { status: 'superseded' });
    assert.equal(pending.aborted, false);
    current.release();
    await expectPanel(page, ready('alpha', 'newest document'), 'newest document');
    old.release();
    await afterDelivery(page, 0, 'returned');
    await expectPanel(page, ready('alpha', 'newest document'), 'newest document');
    assert.deepEqual((await calls(page, 2))[0].result, ok('late superseded document'));

    const cancellable = server.resource('alpha', 'must never be returned');
    await enqueue(page, cancellable);
    assert.equal(await page.evaluate(() => window.tabsTrace.reload()), 'committed');
    assert.equal(await cancellable.requested(), 'alpha');
    await expectPanel(page, loading('alpha'), 'Loading');
    assert.equal(await page.evaluate(() => window.tabsTrace.cancel()), 'committed');
    await expectPanel(page, { kind: 'cancelled' }, 'Cancelled');
    assert.deepEqual(await cancellable.closed(), { finished: false });
    await afterDelivery(page, 2, 'rejected');
    const cancelled = (await calls(page, 3))[2];
    assert.deepEqual(cancelled.reason, { status: 'cancelled' });
    assert.equal(cancelled.result, null);
    await page.evaluate(() => { window.tabsTrace.remember(); window.tabsTrace.remove(); });
    assert.deepEqual(await page.evaluate(() => window.tabsTrace.savedAfterRemoval()), { read: 'disposed', reload: 'disposed' });
  });

  await t.test('retiring an unreferenced nested owner rejects its late result after a replacement is ready', async t => {
    const page = await open(t);
    const old = server.resource('retired', 'old owner response');
    await enqueue(page, old, false);
    await page.evaluate(() => window.tabsTrace.mountOwner('retired', false));
    assert.equal(await old.requested(), 'retired');
    await expectOwner(page, 'retired', 'Loading', false);
    const current = server.resource('replacement', 'replacement document');
    await enqueue(page, current);
    await page.evaluate(() => window.tabsTrace.mountOwner('replacement', false));
    assert.equal(await current.requested(), 'replacement');
    await expectOwner(page, 'replacement', 'Loading', false);
    const [retired, live] = await calls(page, 2);
    assert.deepEqual(retired.reason, { status: 'owner-ended' });
    assert.equal(live.aborted, false);
    current.release();
    await expectOwner(page, 'replacement', 'replacement document', false);
    old.release();
    await afterDelivery(page, 0, 'returned');
    await expectOwner(page, 'replacement', 'replacement document', false);
    assert.deepEqual((await calls(page, 2)).map(call => call.result), [ok('old owner response'), ok('replacement document')]);
  });
});
