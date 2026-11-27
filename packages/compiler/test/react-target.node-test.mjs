import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import ts from 'typescript';
import { emitReact } from '@proto.ui/compiler/targets/react';
import { controlledSelection, readonlyBadge } from './fixtures/backend-programs.ts';
import { authoredBadgeSource } from './fixtures/authoring-source.mjs';

const require = createRequire(import.meta.url);
const compiler = fileURLToPath(new URL('../', import.meta.url));

async function linkDependency(directory, name, source) {
  const destination = path.join(directory, 'node_modules', name);
  await mkdir(path.dirname(destination), { recursive: true });
  await symlink(source, destination, 'dir');
}

test('ordinary React consumer observes committed selection, real click, props and disposal', async (t) => {
  const retained = process.env.PROTO_UI_REACT_CONSUMER_DIR;
  if (retained) await mkdir(retained, { recursive: true });
  const directory = await mkdtemp(path.join(retained || tmpdir(), 'proto-react-consumer-'));
  if (!retained) t.after(() => rm(directory, { force: true, recursive: true }));
  await linkDependency(directory, '@proto.ui/compiler', compiler);
  for (const name of ['react', 'react-dom', '@types/react', '@types/react-dom']) {
    await linkDependency(directory, name, path.dirname(require.resolve(`${name}/package.json`)));
  }
  const authoredInput = authoredBadgeSource();
  if (retained)
    await writeFile(path.join(directory, 'authored-source.json'), JSON.stringify(authoredInput));
  for (const program of [readonlyBadge(), controlledSelection(), authoredInput.component]) {
    await writeFile(path.join(directory, `${program.name}.tsx`), emitReact(program));
  }
  const app = path.join(directory, 'app.tsx');
  await copyFile(new URL('./consumers/react/app.tsx.in', import.meta.url), app);
  const config = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    types: [],
    allowImportingTsExtensions: true,
    strict: true,
    noEmit: true,
  };
  const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([app], config));
  assert.equal(
    diagnostics.length,
    0,
    ts.formatDiagnostics(diagnostics, {
      getCanonicalFileName: (file) => file,
      getCurrentDirectory: () => directory,
      getNewLine: () => '\n',
    })
  );
  const bundle = await build({
    entryPoints: [app],
    bundle: true,
    write: false,
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"development"' },
  });
  const browser = await chromium.launch({ executablePath: process.env.PUI_CHROMIUM_EXECUTABLE });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.setContent('<main id="app"></main>');
  await page.addStyleTag({
    content:
      '.shenko-status-chip { color: rgb(60, 60, 60) } .shenko-status-online { color: rgb(0, 120, 55) } .shenko-status-dot { display: inline-block; width: 6px; height: 6px; }',
  });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const authored = page.locator('#authored > span');
  const projection = () => page.evaluate(() => window.selectionTrace.authoredProjection());
  assert.deepEqual(await projection(), ['', 'offline']);
  for (const [label, tone, color] of [
    ['Offline', 'offline', 'rgb(60, 60, 60)'],
    ['Connected', 'online', 'rgb(0, 120, 55)'],
    ['Custom', 'unknown-tone', 'rgb(60, 60, 60)'],
  ]) {
    await page.evaluate(
      ([label, tone]) => window.selectionTrace.authored(label, tone),
      [label, tone]
    );
    assert.deepEqual(await projection(), [label, tone]);
    assert.equal(await authored.innerText(), label);
    assert.equal(await authored.evaluate((node) => getComputedStyle(node).color), color);
    assert.equal(
      await authored.locator(':scope > i').evaluate((node) => node.getBoundingClientRect().width),
      6
    );
  }
  const badge = page.locator('#badge > :first-child');
  assert.equal(await badge.innerText(), 'Connected ✓');
  await page.evaluate(() => window.selectionTrace.badge(false, 'Reconnecting'));
  assert.equal(await badge.innerText(), 'Offline');
  assert.equal(await badge.evaluate((node) => getComputedStyle(node).color), 'rgb(128, 128, 128)');
  await page.evaluate(() => window.selectionTrace.badge(true, '新🙂'));
  assert.equal(await badge.innerText(), '新🙂 ✓');

  const primary = page.locator('#primary').getByRole('button');
  const secondary = page.locator('#secondary').getByRole('button');
  const snapshot = () => page.evaluate(() => window.selectionTrace.snapshot());
  assert.equal(await primary.innerText(), 'Old: A');
  assert.equal(await secondary.innerText(), 'Local: U1');
  await primary.click();
  assert.deepEqual(await snapshot(), {
    primary: ['A', 1],
    secondary: ['U1', 0],
    requests: [['B', 'A', 1]],
    nested: [],
  });
  assert.equal(await primary.innerText(), 'Old: A');
  await page.evaluate(() => window.selectionTrace.publish('C', true));
  assert.equal(await primary.innerText(), 'Old: C');
  assert.equal(await primary.isDisabled(), true);
  assert.equal(await primary.evaluate((node) => getComputedStyle(node).borderTopWidth), '7px');
  await secondary.click();
  assert.equal(await secondary.innerText(), 'Local: U2');
  const before = await snapshot();
  assert.deepEqual(before.secondary, ['U2', 1]);
  assert.deepEqual(await page.evaluate(() => window.selectionTrace.discard()), [
    'failed',
    'selection-refused',
  ]);
  assert.deepEqual(await snapshot(), before);

  await page.evaluate(() => {
    window.selectionTrace.publish('C');
    window.selectionTrace.enableReentry();
  });
  await primary.click();
  const reentered = await snapshot();
  assert.deepEqual(reentered.requests, [
    ['B', 'A', 1],
    ['B', 'C', 2],
    ['B', 'C', 3],
  ]);
  assert.deepEqual(reentered.nested, [['queued', 2]]);
  assert.deepEqual(reentered.primary, ['C', 3]);
  await page.evaluate(() => window.selectionTrace.hideSecondary());
  assert.equal(await secondary.isVisible(), false);
  assert.equal(
    await page.evaluate(() => window.selectionTrace.savedSecondaryAction()),
    'committed'
  );
  assert.deepEqual(await page.evaluate(() => window.selectionTrace.savedSecondaryState()), [
    'U2',
    2,
  ]);
  await page.evaluate(() => window.selectionTrace.revealSecondary());
  assert.deepEqual((await snapshot()).secondary, ['U2', 2]);
  assert.deepEqual(await page.evaluate(() => window.selectionTrace.savedSecondaryState()), [
    'U2',
    2,
  ]);
  await page.evaluate(() => window.selectionTrace.hideSecondary());
  assert.deepEqual(await page.evaluate(() => window.selectionTrace.dispose()), [
    'disposed',
    'disposed',
  ]);
  assert.equal(await page.locator('#app').innerHTML(), '');
  assert.deepEqual(pageErrors, []);
});
