import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { tsImport } from 'tsx/esm/api';
import { buildBrowserCompiler } from './build-browser.mjs';
import {
  browserRepositoryRoot as root,
  mergeInputFiles,
  hashMetafileInputs,
  hashInputFiles,
} from './browser-inputs.mjs';

const wwwRequire = createRequire(path.join(root, 'apps/www/package.json'));
const { chromium } = wwwRequire('playwright-core');
const outIndex = process.argv.indexOf('--out');
const output =
  outIndex < 0
    ? await mkdtemp(path.join(tmpdir(), 'pui-browser-ast-'))
    : path.resolve(process.argv[outIndex + 1]);
if (outIndex >= 0) await mkdir(output);
const compiler = await buildBrowserCompiler(path.join(output, 'compiler'));
const { buildBrowserTargets } = await tsImport('./browser-assets.ts', import.meta.url);
const targetBuild = await buildBrowserTargets();
const harness = await build({
  absWorkingDir: root,
  entryPoints: ['scripts/compiler/browser-ast-entry.ts'],
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'iife',
  target: 'es2022',
  metafile: true,
});
const assets = new Map([
  ['/compiler.js', await readFile(path.join(compiler.destination, 'compiler.js'), 'utf8')],
  ['/build.json', await readFile(path.join(compiler.destination, 'build.json'), 'utf8')],
  ['/targets/react.json', targetBuild.assets.get('targets/react.json')],
  ['/harness.js', harness.outputFiles[0].text],
  ['/', await readFile(path.join(root, 'scripts/compiler/fixtures/browser-ast.html'), 'utf8')],
]);
const digest = (value) => createHash('sha256').update(value).digest('hex');
const sourceFiles = {};
const source = async (file) => {
  const text = await readFile(path.join(root, file), 'utf8');
  sourceFiles[file] = digest(text);
  return text;
};
const request = (text, fileName, files = {}, target = 'react') => ({
  format: 2,
  revision: fileName,
  source: text,
  preview: true,
  options: { target, fileName, files },
});
const baseRequests = [];
for (const family of ['text', 'surface']) {
  const entry = 'packages/prototypes/base/src/' + family + '/root.proto.ts';
  const types = 'packages/prototypes/base/src/' + family + '/types.ts';
  baseRequests.push(request(await source(entry), entry, { [types]: await source(types) }));
}
const counterFile = 'scripts/compiler/fixtures/browser-counter.proto.ts';
const counter = request(await source(counterFile), counterFile);
const loadedAssets = [];
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const body = assets.get(url.pathname);
  if (body === undefined) {
    res.writeHead(404);
    res.end('Unknown verification asset');
    return;
  }
  loadedAssets.push({ path: url.pathname, sha256: digest(body) });
  res.setHeader(
    'Content-Type',
    url.pathname.endsWith('.js')
      ? 'text/javascript'
      : url.pathname.endsWith('.json')
        ? 'application/json'
        : 'text/html'
  );
  res.end(body);
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const url = 'http://127.0.0.1:' + server.address().port;
let executable;
for (const candidate of [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean)) {
  try {
    await access(candidate);
    executable = candidate;
    break;
  } catch {
    /* Try the next actual executable. */
  }
}
if (!executable) {
  await new Promise((resolve) => server.close(resolve));
  throw new Error('An actual Chrome/Chromium executable is required; set CHROME_PATH.');
}
let browser;
try {
  browser = await chromium.launch({
    executablePath: executable,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
} catch (error) {
  await new Promise((resolve) => server.close(resolve));
  throw error;
}
const page = await browser.newPage();
const errors = [];
const consoleMessages = [];
const workers = [];
const observedWorkers = [];
const cases = [];
const observations = [];
async function recordObservation(name, request, result) {
  const dom = result.ok ? await page.frameLocator('iframe').locator('#stage').innerHTML() : null;
  const file = 'observations/' + name + '.json';
  const contents = JSON.stringify({ request, result, dom }, null, 2) + '\n';
  await mkdir(path.join(output, 'observations'), { recursive: true });
  await writeFile(path.join(output, file), contents);
  const artifact = { path: file, bytes: Buffer.byteLength(contents), sha256: digest(contents) };
  observations.push(artifact);
  return artifact;
}
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) =>
  consoleMessages.push({ type: message.type(), text: message.text() })
);
page.on('worker', (worker) => {
  observedWorkers.push(worker);
  const row = { url: worker.url(), compilerSha256: compiler.compilerSha256, closed: false };
  workers.push(row);
  worker.on('close', () => {
    row.closed = true;
  });
});
try {
  await page.goto(url);
  await page.waitForFunction(() => !!globalThis.compilerHarness);
  const identity = await page.evaluate(() => globalThis.compilerHarness.open());
  assert.equal(identity.compilerSha256, compiler.compilerSha256);
  assert.equal(identity.execution, 'worker-js');
  for (const input of baseRequests) {
    const state = await page.evaluate((input) => globalThis.compilerHarness.compile(input), input);
    assert.equal(state.phase, 'ready', JSON.stringify(state));
    assert.deepEqual(Object.keys(state.result.preview.modules), ['pui:compiled/component']);
    assert.deepEqual(
      state.result.output.dependencies.map((dependency) => dependency.name),
      ['react']
    );
    const content = page.frameLocator('iframe').locator('#stage > [data-preview-item] > div');
    assert.equal(await content.textContent(), 'Actual Base content');
    assert.equal(await content.getAttribute('role'), null);
    assert.equal(await content.getAttribute('tabindex'), null);
    cases.push({
      name: input.options.fileName,
      status: 'passed',
      requestSha256: state.result.requestSha256,
      sourceSha256: state.result.source.sha256,
      observation: await recordObservation(
        'base-' + input.options.fileName.split('/').at(-2),
        input,
        state.result
      ),
    });
  }
  const edited = {
    ...baseRequests[0],
    revision: 'edited-text',
    source: baseRequests[0].source
      .replace('defineAsHook, definePrototype', 'defineAsHook, definePrototype, tw')
      .replace(
        '  // P-BASE-TEXT-INPUTS',
        "  def.feedback.style.use(tw('edited-source'));\n  // P-BASE-TEXT-INPUTS"
      ),
  };
  const editedState = await page.evaluate(
    (input) => globalThis.compilerHarness.compile(input),
    edited
  );
  assert.equal(editedState.phase, 'ready', JSON.stringify(editedState));
  assert.equal(
    await page
      .frameLocator('iframe')
      .locator('#stage > [data-preview-item] > div')
      .getAttribute('class'),
    'edited-source'
  );
  cases.push({
    name: 'edited-real-base-source',
    status: 'passed',
    requestSha256: editedState.result.requestSha256,
    observation: await recordObservation('edited-base-text', edited, editedState.result),
  });

  const counterState = await page.evaluate(
    (input) => globalThis.compilerHarness.compile(input),
    counter
  );
  assert.equal(counterState.phase, 'ready', JSON.stringify(counterState));
  const button = page.frameLocator('iframe').locator('button');
  assert.equal(await button.textContent(), '0');
  await button.click();
  assert.equal(await button.textContent(), '0');
  const stateOnlyObservation = await recordObservation('state-only', counter, counterState.result);
  await button.press('a');
  await page.frameLocator('iframe').getByRole('button', { name: '1', exact: true }).waitFor();
  cases.push({
    name: 'native-event-state-and-explicit-update',
    status: 'passed',
    requestSha256: counterState.result.requestSha256,
    observations: [
      stateOnlyObservation,
      await recordObservation('explicit-update', counter, counterState.result),
    ],
  });
  const sideEffect = {
    ...counter,
    revision: 'side-effect',
    source: '(globalThis as any).browserSourceSideEffect=true;\n' + counter.source,
  };
  const sideEffectState = await page.evaluate(
    (input) => globalThis.compilerHarness.compile(input),
    sideEffect
  );
  assert.equal(sideEffectState.phase, 'failed');
  assert.ok(
    sideEffectState.result.diagnostics.some((issue) => issue.code === 'PUI_REACT_UNSUPPORTED')
  );
  assert.equal(await page.evaluate(() => globalThis.browserSourceSideEffect), undefined);
  assert.equal(
    await observedWorkers.at(-1).evaluate(() => globalThis.browserSourceSideEffect),
    undefined
  );
  cases.push({
    name: 'authored-module-effects-remain-inert',
    status: 'passed',
    observation: await recordObservation(
      'rejected-side-effect',
      sideEffect,
      sideEffectState.result
    ),
  });
  const rejected = {
    ...counter,
    revision: 'rejected',
    options: { ...counter.options, target: 'gpui' },
  };
  const failed = await page.evaluate(
    (input) => globalThis.compilerHarness.compile(input),
    rejected
  );
  assert.equal(failed.phase, 'failed');
  assert.equal(failed.result.phase, 'compile');
  assert.equal(failed.result.diagnostics[0].code, 'PUI_BROWSER_TARGET_UNSUPPORTED');
  await page.locator('iframe').waitFor({ state: 'detached' });
  cases.push({
    name: 'unsupported-native-target-retires-preview',
    status: 'passed',
    observation: await recordObservation('rejected-native-target', rejected, failed.result),
  });
  assert.match(
    await page.evaluate(() => globalThis.compilerHarness.rejectTamperedBuild()),
    /does not match/
  );
  await page.evaluate((input) => globalThis.compilerHarness.cancel(input), counter);
  await page.evaluate(() => globalThis.compilerHarness.open());
  const recovered = await page.evaluate(
    (input) => globalThis.compilerHarness.compile(input),
    counter
  );
  assert.equal(recovered.phase, 'ready', JSON.stringify(recovered));
  assert.equal(await page.frameLocator('iframe').locator('button').textContent(), '0');
  const recoveredObservation = await recordObservation('reopened', counter, recovered.result);
  await page.evaluate(() => globalThis.compilerHarness.close());
  await page.locator('iframe').waitFor({ state: 'detached' });
  cases.push({
    name: 'digest-check-cancel-reopen-fresh-owner',
    status: 'passed',
    observation: recoveredObservation,
  });
  assert.deepEqual(errors, []);
} catch (error) {
  await writeFile(
    path.join(output, 'failure.json'),
    JSON.stringify(
      {
        error: String(error),
        pageErrors: errors,
        consoleMessages,
        frames: page.frames().map((frame) => frame.url()),
        loadedAssets,
        workers,
      },
      null,
      2
    ) + '\n'
  );
  await writeFile(path.join(output, 'failure.html'), await page.content());
  throw error;
} finally {
  await browser.close();
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
}
assert.ok(workers.length >= 2);
assert.ok(workers.every((worker) => worker.closed));
const inputs = mergeInputFiles(
  compiler.inputFiles,
  ...Object.values(targetBuild.targetInputs),
  await hashMetafileInputs(harness.metafile),
  sourceFiles,
  await hashInputFiles([
    'scripts/compiler/browser-ast-smoke.mjs',
    'scripts/compiler/fixtures/browser-ast.html',
  ])
);
const summary = {
  kind: 'native-ast-browser-execution-v2',
  browser: await browser.version(),
  compilerBuild: JSON.parse(assets.get('/build.json')),
  service: { mode: 'runner-owned-loopback', url, closed: true },
  cases,
  observations,
  loadedAssets,
  loadedWorkers: workers,
  sourceFiles: inputs,
  pageErrors: errors,
  documentationRouteAcceptance: 'not-run',
  historicalTargets: [
    'web-component-source-v1',
    'react-dom-source-v1',
    'vue-source-v1',
    'vue2-source-v1',
  ].map((target) => ({ target, status: 'not-migrated' })),
};
await writeFile(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(
  JSON.stringify({
    output,
    cases: cases.length,
    compilerSha256: compiler.compilerSha256,
    workers: workers.length,
  })
);
