import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
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
const compiler = fileURLToPath(new URL('../', import.meta.url));
const historical = /^(?:18\.3|19\.[01])\.\d+$/;

// Use the same installed package roots as react-previous-peer.node-test.mjs.
// PUI_PREVIOUS_REACT_DIR and PUI_PREVIOUS_REACT_DOM_DIR override both peers.
async function loadPeer(name, override) {
  const manifest = override ? path.resolve(override, 'package.json') : require.resolve(`${name}/package.json`);
  const { name: actual, version } = JSON.parse(await readFile(manifest, 'utf8'));
  assert.equal(actual, name, `Wrong package at ${manifest}`);
  return { directory: await realpath(path.dirname(manifest)), version };
}

test('previous React DOM server-renders and hydrates a generated retained component across physical detach', async (t) => {
  const { PUI_PREVIOUS_REACT_DIR: reactDir, PUI_PREVIOUS_REACT_DOM_DIR: domDir } = process.env;
  assert.equal(Boolean(reactDir), Boolean(domDir), 'Set both previous-peer package roots.');
  const [react, reactDOM] = await Promise.all([loadPeer('react', reactDir), loadPeer('react-dom', domDir)]);
  if (![react, reactDOM].every(peer => historical.test(peer.version))) {
    const message = `React ${react.version} and ReactDOM ${reactDOM.version} selected. This probe requires 18.3.x, 19.0.x or 19.1.x.`;
    if (reactDir) assert.fail(message);
    t.skip(`${message} Set PUI_PREVIOUS_REACT_DIR and PUI_PREVIOUS_REACT_DOM_DIR to select them.`);
    return;
  }
  assert.equal(react.version, reactDOM.version, 'Select matching historical React and ReactDOM releases.');
  const directory = await mkdtemp(path.join(tmpdir(), 'proto-previous-hydration-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const modules = path.join(directory, 'node_modules');
  await mkdir(path.join(modules, '@proto.ui'), { recursive: true });
  const program = controlledSelection();
  await Promise.all([
    symlink(compiler, path.join(modules, '@proto.ui', 'compiler'), 'dir'),
    symlink(react.directory, path.join(modules, 'pinned-peer-react'), 'dir'),
    symlink(reactDOM.directory, path.join(modules, 'pinned-peer-react-dom'), 'dir'),
    copyFile(new URL('./consumers/react/previous-peer-hydration.tsx.in', import.meta.url), path.join(directory, 'app.tsx')),
    writeFile(path.join(directory, `${program.name}.tsx`), emitReact(program)),
  ]);
  const options = {
    absWorkingDir: directory, entryPoints: ['app.tsx'], bundle: true, jsx: 'automatic',
    alias: { react: 'pinned-peer-react', 'react-dom': 'pinned-peer-react-dom' },
    define: { 'process.env.NODE_ENV': '"production"' },
  };
  const serverBundle = path.join(directory, 'server.cjs');
  await build({ ...options, platform: 'node', format: 'cjs', outfile: serverBundle });
  const browserBundle = await build({ ...options, platform: 'browser', format: 'iife', globalName: 'PeerHydration', write: false });
  assert.equal(typeof globalThis.document, 'undefined', 'The Node SSR observation requires a DOM-free process.');
  const server = require(serverBundle).serverSnapshot();
  const installed = { react: react.version, 'react-dom': reactDOM.version };
  assert.equal(server.refPublished, false);
  const browser = await chromium.launch({ executablePath: process.env.PUI_CHROMIUM_EXECUTABLE });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<main id="app"></main>');
  await page.addScriptTag({ content: browserBundle.outputFiles[0].text });
  // A host can call ReactDOMServer with a real document in scope. Hydrate the
  // separate, actual Node server's bytes after independently exercising it here.
  const browserServer = await page.evaluate(() => window.PeerHydration.serverSnapshot());
  assert.deepEqual(browserServer, server);
  await page.evaluate(markup => { window.hydratedPeer = window.PeerHydration.hydrate(markup); }, server.html);
  await page.waitForFunction(() => window.hydratedPeer.ready(), undefined, { timeout: 10_000 });
  const hydrated = await page.evaluate(() => window.hydratedPeer.takeHandle());
  const detached = await page.evaluate(() => window.hydratedPeer.detach());
  const reattached = await page.evaluate(() => window.hydratedPeer.reattach());
  const terminal = await page.evaluate(() => window.hydratedPeer.unmount());
  t.diagnostic(JSON.stringify({ installed, runtime: server.versions, server: server.html, hydrated, detached, reattached, terminal, errors }));

  const original = { sameButton: true, attached: true, text: 'Local: A' };
  assert.deepEqual(hydrated, { dom: original, selection: 'A', attempts: 0, recoveries: [] });
  assert.deepEqual(detached, { dom: { ...original, attached: false }, refCleared: true,
    call: { action: 'committed', selection: 'B', attempts: 1, requests: ['B'] } });
  assert.deepEqual(reattached, { dom: { ...original, text: 'Local: B' }, sameHandle: true, selection: 'B', attempts: 1 });
  assert.deepEqual(terminal, { action: 'disposed', requests: [], empty: true, refCleared: true, recoveries: [] });
  assert.deepEqual(errors, []);
});
