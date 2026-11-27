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
import { authoredContextSource } from './fixtures/authoring-source.mjs';

const require = createRequire(import.meta.url);
const compiler = fileURLToPath(new URL('../', import.meta.url));

async function linkPackage(directory, name, source) {
  const destination = path.join(directory, 'node_modules', name);
  await mkdir(path.dirname(destination), { recursive: true });
  await symlink(source, destination, 'dir');
}

async function openConsumer(t, browser, script) {
  const page = await browser.newPage();
  page.setDefaultTimeout(10_000);
  t.after(() => page.close());
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.setContent('<main id="app"></main><aside id="physical-slot"><div id="physical"></div></aside>');
  await page.addScriptTag({ content: script });
  return page;
}

async function waitForText(page, selector, text) {
  await page.waitForFunction(({ selector, text }) => document.querySelector(selector)?.textContent === text, { selector, text });
  const view = page.locator(selector);
  await view.waitFor({ state: 'visible' });
  assert.equal(await view.innerText(), text);
}

async function expectPortal(page, current, connected = true) {
  // The physical surface can be detached. Its target ref still reaches the actual native node.
  const text = `left seed / ${current}`;
  await page.waitForFunction(text => window.contextTrace.portalState().text === text, text);
  assert.deepEqual(await page.evaluate(() => window.contextTrace.portalState()), {
    values: ['left seed', current], text, sameHandle: true, sameNode: true, connected,
    inPhysicalSurface: true, inLogicalRoot: false,
  });
  assert.equal(await page.locator('#portal-target span').isVisible(), connected);
}

const publish = (page, side, value) => page.evaluate(({ side, value }) => window.contextTrace.publish(side, value), { side, value });

test('authored Context owner and named reader compile into an external React DOM consumer', async t => {
  const result = authoredContextSource();
  assert.equal(result.status, 'produced', JSON.stringify(result.diagnostics));
  assert.equal(result.component.name, 'LevelOwner');
  const key = result.component.keys.find(key => key.exportName === 'LEVEL');
  const reader = result.component.components.find(body => body.name === 'LevelReader');
  assert.ok(key && reader, 'the linked authoring unit exports its nominal key and reached reader');
  const consume = reader.consumes.find(read => read.key === key.binding.id);
  assert.ok(consume, 'the reached reader consumes the exported LEVEL declaration');
  const source = consume.binding.source;
  assert.match(source.file, /(?:^|[/\\])authoring-context[/\\]owner\.proto\.ts\.txt$/);

  const retained = process.env.PROTO_UI_REACT_CONSUMER_DIR;
  if (retained) await mkdir(retained, { recursive: true });
  const directory = await mkdtemp(path.join(retained || tmpdir(), 'proto-context-source-react-'));
  if (!retained) t.after(() => rm(directory, { force: true, recursive: true }));
  await linkPackage(directory, '@proto.ui/compiler', compiler);
  for (const name of ['react', 'react-dom', '@types/react', '@types/react-dom']) {
    await linkPackage(directory, name, path.dirname(require.resolve(`${name}/package.json`)));
  }
  if (retained) await writeFile(path.join(directory, 'authored-source.json'), JSON.stringify(result));
  await writeFile(path.join(directory, 'LevelOwner.tsx'), emitReact(result.component));
  const app = path.join(directory, 'context-source.tsx');
  await copyFile(new URL('./consumers/react/context-source.tsx.in', import.meta.url), app);
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
  const browser = await chromium.launch({ executablePath: process.env.PUI_CHROMIUM_EXECUTABLE });
  t.after(() => browser.close());
  const script = bundle.outputFiles[0].text;
  if (retained) t.diagnostic(`Generated React Context consumer: ${directory}`);

  await t.test('the authored owner publishes its current value to its retained keyed child', async t => {
    const page = await openConsumer(t, browser, script);
    await page.evaluate(() => window.contextTrace.renderOwner());
    await waitForText(page, '#app span', 'first / first');
    await page.evaluate(() => window.contextTrace.rememberOwner());
    assert.equal((await page.evaluate(() => window.contextTrace.ownerState())).value, 'first');
    assert.equal(await page.evaluate(() => window.contextTrace.select('second')), 'committed');
    await waitForText(page, '#app span', 'first / second');
    assert.deepEqual(await page.evaluate(() => window.contextTrace.ownerState()), {
      value: 'second', sameHandle: true, sameChild: true,
    });
    await page.evaluate(() => window.contextTrace.renderOwner('later seed'));
    await waitForText(page, '#app span', 'first / second');
    assert.equal((await page.evaluate(() => window.contextTrace.ownerState())).value, 'second');
    assert.equal(await page.evaluate(() => window.contextTrace.select('third')), 'committed');
    await waitForText(page, '#app span', 'first / third');
    assert.deepEqual(await page.evaluate(() => window.contextTrace.ownerState()), {
      value: 'third', sameHandle: true, sameChild: true,
    });
  });

  await t.test('a real portal retains its reader across equal-valued provider replacement and physical detach', async t => {
    const page = await openConsumer(t, browser, script);
    await page.evaluate(() => window.contextTrace.mountPortal());
    await waitForText(page, '#outer-reader span', 'outer / outer');
    await waitForText(page, '#physical-reader span', 'physical / physical');
    await waitForText(page, '#portal-target span', 'left seed / left seed');
    await page.evaluate(() => window.contextTrace.rememberPortal());
    await expectPortal(page, 'left seed');

    await publish(page, 'left', 'equal');
    await publish(page, 'right', 'equal');
    await waitForText(page, '#left-reader span', 'left seed / equal');
    await waitForText(page, '#right-reader span', 'right seed / equal');
    await expectPortal(page, 'equal');
    await page.evaluate(() => window.contextTrace.replaceProvider('right'));
    assert.equal(await page.locator('#providers').getAttribute('data-active'), 'right');
    await expectPortal(page, 'equal');

    // Each independent source has another mounted reader to witness its own publication.
    await publish(page, 'left', 'old publication');
    await waitForText(page, '#left-reader span', 'left seed / old publication');
    await expectPortal(page, 'equal');
    await publish(page, 'right', 'new publication');
    await waitForText(page, '#right-reader span', 'right seed / new publication');
    await expectPortal(page, 'new publication');

    await page.evaluate(() => window.contextTrace.detachSurface());
    await expectPortal(page, 'new publication', false);
    await publish(page, 'right', 'while detached');
    await waitForText(page, '#right-reader span', 'right seed / while detached');
    await expectPortal(page, 'while detached', false);
    await page.evaluate(() => window.contextTrace.reattachSurface());
    await waitForText(page, '#portal-target span', 'left seed / while detached');
    await expectPortal(page, 'while detached');
  });

  await t.test('a missing provider and a different same-label key both fail typed acquisition', async t => {
    const page = await openConsumer(t, browser, script);
    for (const mode of ['absent', 'other']) {
      await page.evaluate(mode => window.contextTrace.mountProbe(mode), mode);
      await page.waitForFunction(() => window.contextTrace.acquisition().missing !== null);
      const { missing, acquisitions, values, distinctKeys } = await page.evaluate(() => window.contextTrace.acquisition());
      assert.equal(distinctKeys, true);
      assert.equal(missing.code, 'missing-provider');
      assert.equal(missing.keyMatches, true);
      assert.equal(missing.debugName, 'level');
      assert.ok(missing.origin.includes(`${source.file}:${source.start}-${source.end}`), missing.origin);
      assert.equal(acquisitions, 0);
      assert.equal(values, null);
      assert.equal(await page.locator('#app span').count(), 0);
    }
    await page.evaluate(() => window.contextTrace.mountProbe('matching'));
    await waitForText(page, '#app span', 'left seed / left seed');
    const recovered = await page.evaluate(() => window.contextTrace.acquisition());
    assert.equal(recovered.missing, null);
    assert.ok(recovered.acquisitions > 0);
    assert.deepEqual(recovered.values, ['left seed', 'left seed']);
  });
});
