import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { emitReact } from '@proto.ui/compiler/targets/react';
import { authoredSource } from './fixtures/authoring-source.mjs';

const require = createRequire(import.meta.url);
const compiler = fileURLToPath(new URL('../', import.meta.url));
const fixture = new URL('./fixtures/authoring-task-helper/task-helper.proto.ts.txt', import.meta.url);

const client = `
  import { createElement, createRef, Profiler } from 'react';
  import { createRoot } from 'react-dom/client';
  import { TaskHelperTransaction } from './TaskHelperTransaction';

  const host = document.getElementById('app');
  const ref = createRef();
  const commits = [];
  createRoot(host).render(createElement(Profiler, {
    id: 'task-helper', onRender() { commits.push(host.textContent); },
  }, createElement(TaskHelperTransaction, { ref })));
  window.helperTrace = {
    submit(first, last, early) { return ref.current.submit(first, last, early).status; },
    values() { return [ref.current.message, ref.current.observed]; },
    commits,
  };
`;

test('a synchronous task helper shares the task draft and its early return resumes the caller', async t => {
  const result = authoredSource(fixture, 'TaskHelperTransaction');
  assert.equal(result.status, 'produced', JSON.stringify(result.diagnostics));
  const directory = await mkdtemp(path.join(tmpdir(), 'proto-task-helper-react-'));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const modules = path.join(directory, 'node_modules');
  await mkdir(path.join(modules, '@proto.ui'), { recursive: true });
  await symlink(compiler, path.join(modules, '@proto.ui/compiler'), 'dir');
  for (const name of ['react', 'react-dom']) {
    await symlink(path.dirname(require.resolve(`${name}/package.json`)), path.join(modules, name), 'dir');
  }
  await writeFile(path.join(directory, 'TaskHelperTransaction.ts'), emitReact(result.component));
  const bundle = await build({
    stdin: { contents: client, resolveDir: directory, sourcefile: 'task-helper-client.js' },
    bundle: true, write: false, define: { 'process.env.NODE_ENV': '"development"' },
  });
  const browser = await chromium.launch({ executablePath: process.env.PUI_CHROMIUM_EXECUTABLE });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<main id="app"></main>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });

  async function expectPublished(copied) {
    const text = `published / ${copied}`;
    await page.getByText(text, { exact: true }).waitFor();
    assert.equal(await page.locator('#app > span').innerText(), text);
    assert.deepEqual(await page.evaluate(() => window.helperTrace.values()), ['published', copied]);
  }

  await expectPublished('created');
  assert.equal(await page.evaluate(() => window.helperTrace.submit('overwritten', 'fallthrough', false)), 'committed');
  await expectPublished('fallthrough');
  assert.equal(await page.evaluate(() => window.helperTrace.submit('early', 'skipped', true)), 'committed');
  await expectPublished('early');

  // The briefly staged value survives in observed. No native commit exposes it as message.
  const commits = await page.evaluate(() => window.helperTrace.commits);
  const changes = commits.filter((text, index) => index === 0 || text !== commits[index - 1]);
  assert.deepEqual(changes, ['waiting / unread', 'published / created', 'published / fallthrough', 'published / early']);
  assert.deepEqual(errors, []);
});
