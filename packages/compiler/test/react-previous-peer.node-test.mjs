import assert from 'node:assert/strict';
import { existsSync, realpathSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { emitReact } from '@proto.ui/compiler/targets/react';
import { controlledSelection } from './fixtures/backend-programs.ts';

const require = createRequire(import.meta.url);
const compiler = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const previousPeer = /^(?:18\.3|19\.[01])\.\d+$/;

// PUI_PREVIOUS_REACT_DIR and PUI_PREVIOUS_REACT_DOM_DIR select installed package
// roots (each containing package.json). Set both to run against a pinned pair.
// Without overrides, an installed 18.3, 19.0 or 19.1 pair runs automatically.
async function loadPeer(name, override) {
  const manifest = override ? path.resolve(override, 'package.json') : require.resolve(`${name}/package.json`);
  const { name: actual, version } = JSON.parse(await readFile(manifest, 'utf8'));
  assert.equal(actual, name, `Wrong package at ${manifest}`);
  return { root: realpathSync(path.dirname(manifest)), version };
}

function assertBundledReact(inputs, directory, react, reactDOM) {
  const files = new Map();
  for (const input of Object.keys(inputs)) {
    const file = path.resolve(directory, input);
    if (existsSync(file)) files.set(input, realpathSync(file));
  }
  const entry = realpathSync(require.resolve(react.root));
  for (const importer of [path.join(compiler, 'src', 'support', 'react'), reactDOM.root]) {
    const sharesEntry = Object.entries(inputs).some(([input, { imports }]) =>
      files.get(input)?.startsWith(importer + path.sep) && imports.some(edge => !edge.external && files.get(edge.path) === entry));
    assert.ok(sharesEntry, `No bundled React import from ${importer} to ${entry}`);
  }
}

test('previous React DOM retires a saved handle before sibling layout when deleting a hidden Suspense owner', async (t) => {
  const { PUI_PREVIOUS_REACT_DIR: reactDir, PUI_PREVIOUS_REACT_DOM_DIR: domDir } = process.env;
  assert.equal(Boolean(reactDir), Boolean(domDir), 'Set both previous-peer package directory overrides.');
  const [react, reactDOM] = await Promise.all([loadPeer('react', reactDir), loadPeer('react-dom', domDir)]);
  if (![react, reactDOM].every(peer => previousPeer.test(peer.version))) {
    const message = `React ${react.version} and ReactDOM ${reactDOM.version} selected. This probe requires 18.3.x, 19.0.x or 19.1.x.`;
    if (reactDir) assert.fail(message);
    t.skip(`${message} Set PUI_PREVIOUS_REACT_DIR and PUI_PREVIOUS_REACT_DOM_DIR to select them.`);
    return;
  }
  assert.equal(react.version, reactDOM.version, 'Select matching pinned React and ReactDOM releases.');
  const directory = await mkdtemp(path.join(tmpdir(), 'proto-react-previous-peer-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const modules = path.join(directory, 'node_modules');
  await mkdir(path.join(modules, '@proto.ui'), { recursive: true });
  const program = controlledSelection();
  await Promise.all([
    symlink(compiler, path.join(modules, '@proto.ui', 'compiler'), 'dir'),
    symlink(react.root, path.join(modules, 'pinned-peer-react'), 'dir'),
    symlink(reactDOM.root, path.join(modules, 'pinned-peer-react-dom'), 'dir'),
    copyFile(new URL('./consumers/react/previous-peer.tsx.in', import.meta.url), path.join(directory, 'app.tsx')),
    writeFile(path.join(directory, `${program.name}.tsx`), emitReact(program)),
  ]);
  // esbuild resolves these package aliases at absWorkingDir for every importer,
  // including the real compiler support path and ReactDOM's own dependencies.
  const bundle = await build({
    absWorkingDir: directory, entryPoints: ['app.tsx'], platform: 'browser', bundle: true,
    alias: { react: 'pinned-peer-react', 'react-dom': 'pinned-peer-react-dom' },
    jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' }, write: false, metafile: true,
  });
  assertBundledReact(bundle.metafile.inputs, directory, react, reactDOM);
  const browser = await chromium.launch({ executablePath: process.env.PUI_CHROMIUM_EXECUTABLE });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<main id="app"></main>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const versions = await page.evaluate(() => window.previousPeer.versions);
  assert.deepEqual(versions, { react: react.version, 'react-dom': reactDOM.version });
  const initial = await page.evaluate(() => window.previousPeer.snapshot());
  const hide = async () => {
    await page.evaluate(() => window.previousPeer.hide());
    await page.locator('#fallback').waitFor({ state: 'visible', timeout: 10_000 });
    return page.evaluate(() => window.previousPeer.whileHidden());
  };
  const firstHide = await hide();
  await page.evaluate(() => window.previousPeer.reveal());
  await page.getByRole('button').waitFor({ state: 'visible', timeout: 10_000 });
  const revealed = await page.evaluate(() => window.previousPeer.snapshot());
  const secondHide = await hide();
  const removal = await page.evaluate(() => window.previousPeer.removeHidden());
  const afterUnmount = await page.evaluate(() => window.previousPeer.unmount());
  t.diagnostic(JSON.stringify({ versions, initial, firstHide, revealed, secondHide, removal, afterUnmount, errors }));

  const visible = { buttonAttached: true, buttonVisible: true, fallbackPresent: false, sameVisibleSibling: true, sameHandle: true, refCleared: false };
  const hidden = { ...visible, buttonVisible: false, fallbackPresent: true, sameHandle: false, refCleared: true };
  const removed = { ...hidden, buttonAttached: false, fallbackPresent: false };
  const initialValue = { selection: 'A', attempts: 0 };
  const once = { selection: 'B', attempts: 1 };
  const twice = { selection: 'B', attempts: 2 };
  const disposed = { before: 'disposed', action: 'disposed', after: 'disposed', requests: [] };
  assert.deepEqual(initial, { host: visible, value: initialValue, text: 'Local: A' });
  assert.deepEqual(firstHide, { host: hidden, call: { before: initialValue, action: 'committed', after: once, requests: ['B'] } });
  assert.deepEqual(revealed, { host: visible, value: once, text: 'Local: B' });
  assert.deepEqual(secondHide, { host: hidden, call: { before: once, action: 'committed', after: twice, requests: ['B'] } });
  assert.deepEqual(errors, []);
  assert.equal(await page.locator('#app').innerHTML(), '');
  assert.deepEqual(afterUnmount, disposed, 'Saved handle after root unmount');
  assert.deepEqual(removal.afterFlush, { host: removed, call: disposed }, 'Saved handle immediately after the deletion flush');
  assert.deepEqual(removal.layout, [{ host: removed, call: disposed }], 'Saved handle in the retained sibling’s layout setup after host removal');
});
