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
import { authoredKeyedTaskSource } from './fixtures/authoring-source.mjs';
import { openTabsServer } from './consumers/react/tabs-server.mjs';

const require = createRequire(import.meta.url);
const compiler = fileURLToPath(new URL('../', import.meta.url));

async function bundleConsumer(t) {
  const retained = process.env.PROTO_UI_REACT_CONSUMER_DIR;
  if (retained) await mkdir(retained, { recursive: true });
  const directory = await mkdtemp(path.join(retained || tmpdir(), 'proto-keyed-task-react-'));
  if (!retained) t.after(() => rm(directory, { recursive: true, force: true }));
  const modules = path.join(directory, 'node_modules');
  await mkdir(path.join(modules, '@proto.ui'), { recursive: true });
  await mkdir(path.join(modules, '@types'), { recursive: true });
  await symlink(compiler, path.join(modules, '@proto.ui/compiler'), 'dir');
  for (const name of ['react', 'react-dom', '@types/react', '@types/react-dom']) {
    await symlink(path.dirname(require.resolve(`${name}/package.json`)), path.join(modules, name), 'dir');
  }
  const source = authoredKeyedTaskSource();
  assert.equal(source.status, 'produced', JSON.stringify(source.diagnostics));
  assert.equal(source.component.name, 'KeyedTaskOwner');
  if (retained) await writeFile(path.join(directory, 'keyed-task-owner-source.json'), JSON.stringify(source));
  const bindings = { 'fixture.load-keyed-item': { module: './keyed-loader', export: 'loadKeyedItem' } };
  await writeFile(path.join(directory, 'KeyedTaskOwner.ts'), emitReact(source.component, { bindings }));
  for (const name of ['keyed-loader.ts', 'keyed-task-client.tsx']) {
    await copyFile(new URL(`./consumers/react/${name}.in`, import.meta.url), path.join(directory, name));
  }
  const app = path.join(directory, 'keyed-task-client.tsx');
  const options = {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX, types: [], allowImportingTsExtensions: true, strict: true, noEmit: true,
  };
  const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([app], options));
  assert.equal(diagnostics.length, 0, ts.formatDiagnostics(diagnostics, {
    getCanonicalFileName: file => file, getCurrentDirectory: () => directory, getNewLine: () => '\n',
  }));
  const bundle = await build({
    entryPoints: [app], bundle: true, write: false, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' },
  });
  if (retained) t.diagnostic(`Generated keyed React consumer: ${directory}`);
  return { script: bundle.outputFiles[0].text, evidence: retained ? directory : null };
}

async function enqueue(page, key, resource, cancellable = true) {
  await page.evaluate(({ key, path, cancellable }) => window.keyedLifetime.enqueue(key, path, cancellable), {
    key, path: resource.path, cancellable,
  });
}

async function expectRows(page, texts, { connected = true, visible = true } = {}) {
  const observed = await page.waitForFunction(({ texts, connected, visible }) => {
    const view = window.keyedLifetime.snapshot();
    return view.rows.length === texts.length && view.rows.every((row, i) =>
      row.text === texts[i] && row.connected === connected && row.visible === visible) && view;
  }, { texts, connected, visible });
  try {
    const view = await observed.jsonValue();
    assert.deepEqual(view.rows.map(row => row.tag), texts.map(() => 'span'));
    return view;
  } finally { await observed.dispose(); }
}

async function history(page) {
  const { unexpected, requests } = await page.evaluate(() => window.keyedLifetime.history());
  assert.deepEqual(unexpected, []);
  const byPath = new Map(requests.map(request => [request.path, request]));
  assert.equal(byPath.size, requests.length, 'each scheduled resource has one load');
  return byPath;
}

async function afterDelivery(page, resource, state) {
  await page.waitForFunction(({ path, state }) =>
    window.keyedLifetime.history().requests.some(request => request.path === path && request.state === state),
  { path: resource.path, state });
  // Let the fetch promise's reactions and the following native frame run before sampling the view.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

function nodes(view) { return view.rows.map(row => row.node); }

function expectPending(byPath, resource) {
  const request = byPath.get(resource.path);
  assert.ok(request, resource.path);
  assert.deepEqual([request.state, request.aborted, request.reason], ['pending', false, null]);
}

test('authored keyed children retain tasks through reorder and host moves and reject a retired incarnation’s response', async t => {
  const { script, evidence } = await bundleConsumer(t);
  const server = await openTabsServer(t);
  const browser = await chromium.launch({ executablePath: process.env.PUI_CHROMIUM_EXECUTABLE });
  t.after(() => browser.close());
  const page = await browser.newPage();
  page.setDefaultTimeout(15_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(server.origin);
  await page.addScriptTag({ content: script });

  const oldA = server.resource('A', 'obsolete A');
  const b = server.resource('B', 'B file');
  const c = server.resource('C', 'withdrawn C');
  const newA = server.resource('A', 'fresh A');
  const aLeft = 'A:left/left/pending';
  const bLeft = 'B:left/left/pending';
  const cLeft = 'C:left/left/pending';
  const bReady = 'B:left/right/B file@left>right';
  const aReady = 'A:right/right/fresh A@right>right';
  const detached = { connected: false, visible: false };
  const ended = { status: 'owner-ended' };

  // The first A ignores abort and will deliver its real body after its successor has committed.
  await enqueue(page, 'A', oldA, false);
  await enqueue(page, 'B', b);
  await page.evaluate(() => window.keyedLifetime.mount());
  assert.deepEqual(await Promise.all([oldA.requested(), b.requested()]), ['A', 'B']);
  const initial = await expectRows(page, [aLeft, bLeft]);
  const [oldANode, bNode] = nodes(initial);
  assert.notEqual(oldANode, bNode);
  assert.equal(initial.physicalSlot, 'physical-left');
  assert.equal(initial.activeZone, 'original');
  await page.evaluate(() => window.keyedLifetime.order('B', 'A'));
  const reordered = await expectRows(page, [bLeft, aLeft]);
  assert.deepEqual(nodes(reordered), [bNode, oldANode]);
  const bothPending = await history(page);
  assert.equal(bothPending.size, 2);
  expectPending(bothPending, b);
  expectPending(bothPending, oldA);

  await enqueue(page, 'C', c);
  await page.evaluate(() => window.keyedLifetime.order('B', 'C'));
  assert.equal(await c.requested(), 'C');
  const retired = await expectRows(page, [bLeft, cLeft]);
  const cNode = retired.rows[1].node;
  assert.equal(retired.rows[0].node, bNode);
  assert.ok(![oldANode, bNode].includes(cNode));
  assert.deepEqual(await page.evaluate(id => window.keyedLifetime.location(id), oldANode), { connected: false, inTarget: false });
  const removedA = await history(page);
  assert.deepEqual(removedA.get(oldA.path).reason, ended);
  assert.equal(removedA.get(oldA.path).state, 'pending');
  expectPending(removedA, b);
  expectPending(removedA, c);

  await page.evaluate(() => window.keyedLifetime.hide(true));
  const hidden = await expectRows(page, [bLeft, cLeft], { visible: false });
  await page.evaluate(() => window.keyedLifetime.hide(false));
  const shown = await expectRows(page, [bLeft, cLeft]);
  await page.evaluate(() => window.keyedLifetime.detach());
  const offscreen = await expectRows(page, [bLeft, cLeft], detached);
  assert.equal(offscreen.physicalSlot, null);
  for (const view of [hidden, shown, offscreen]) assert.deepEqual(nodes(view), [bNode, cNode]);
  const held = await history(page);
  assert.equal(held.size, 3);
  expectPending(held, b);
  expectPending(held, c);

  // Rebind equal-valued cells, then positively observe each independent publication in the host.
  await page.evaluate(() => window.keyedLifetime.replaceZone());
  await page.evaluate(() => window.keyedLifetime.publish('original', 'old-cell-only'));
  await page.waitForFunction(() => window.keyedLifetime.snapshot().originalZone === 'old-cell-only');
  const switched = await expectRows(page, [bLeft, cLeft], detached);
  assert.equal(switched.activeZone, 'replacement');
  assert.equal(switched.replacementZone, 'left');
  await page.evaluate(() => window.keyedLifetime.publish('replacement', 'right'));
  const rebound = await expectRows(page, ['B:left/right/pending', 'C:left/right/pending'], detached);
  assert.deepEqual(nodes(rebound), [bNode, cNode]);
  assert.equal(rebound.originalZone, 'old-cell-only');
  assert.equal(rebound.replacementZone, 'right');
  b.release();
  const detachedCommit = await expectRows(page, [bReady, 'C:left/right/pending'], detached);
  assert.deepEqual(nodes(detachedCommit), [bNode, cNode]);
  await page.evaluate(() => window.keyedLifetime.attachOnRight());
  const moved = await expectRows(page, [bReady, 'C:left/right/pending']);
  assert.deepEqual(nodes(moved), [bNode, cNode]);
  assert.equal(moved.physicalSlot, 'physical-right');
  assert.ok(moved.rows[0].top > initial.rows[1].top, 'the retained B span moved to the second physical slot');

  await enqueue(page, 'A', newA);
  await page.evaluate(() => window.keyedLifetime.order('A', 'B'));
  assert.equal(await newA.requested(), 'A');
  const replacement = await expectRows(page, ['A:right/right/pending', bReady]);
  const newANode = replacement.rows[0].node;
  assert.ok(![oldANode, bNode, cNode].includes(newANode));
  assert.equal(replacement.rows[1].node, bNode);
  assert.deepEqual(await page.evaluate(id => window.keyedLifetime.location(id), cNode), { connected: false, inTarget: false });
  assert.deepEqual(await c.closed(), { finished: false });
  await afterDelivery(page, c, 'rejected');
  newA.release();
  const freshCommit = await expectRows(page, [aReady, bReady]);
  oldA.release();
  await afterDelivery(page, oldA, 'returned');
  const lateCommit = await expectRows(page, [aReady, bReady]);
  assert.deepEqual(nodes(freshCommit), [newANode, bNode]);
  assert.deepEqual(nodes(lateCommit), [newANode, bNode]);

  // A subsequent publication rereads both fields from the two surviving native instances.
  await page.evaluate(() => window.keyedLifetime.publish('replacement', 'after'));
  const final = await expectRows(page, ['A:right/after/fresh A@right>right', 'B:left/after/B file@left>right']);
  assert.deepEqual(nodes(final), [newANode, bNode]);
  const views = { initial, reordered, retired, hidden, shown, offscreen, switched, rebound, detachedCommit, moved, replacement, freshCommit, lateCommit, final };
  for (const view of Object.values(views)) assert.equal(view.owner, initial.owner);
  const network = await history(page);
  assert.equal(network.size, 4);
  for (const [resource, key, state, value, reason] of [
    [oldA, 'A', 'returned', 'obsolete A', ended], [b, 'B', 'returned', 'B file', null],
    [c, 'C', 'rejected', null, ended], [newA, 'A', 'returned', 'fresh A', null],
  ]) {
    assert.equal(resource.requests, 1);
    assert.deepEqual(network.get(resource.path), { key, path: resource.path, state, value, aborted: reason !== null, reason });
  }
  assert.deepEqual(errors, []);
  if (evidence) await writeFile(path.join(evidence, 'keyed-react-native.json'), JSON.stringify({ views, requests: [...network.values()], errors }));
});
