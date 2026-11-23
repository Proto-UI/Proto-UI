import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { build } from 'esbuild';
import { createServer } from 'node:net';
import { createBrowserDeliveryIndex, verifyBrowserReceipt } from './browser-delivery-index.mjs';
import { browserEvidenceRecord } from './browser-evidence.mjs';
import {
  assertSameBrowserEvidence,
  digest,
  hashInputFiles,
  hashMetafileInputs,
  mergeInputFiles,
} from './browser-inputs.mjs';
import {
  assertLoopbackPortAvailable,
  localBrowserServiceConfiguration,
  observedAstroLocalURL,
} from './browser-service.mjs';

test('retains all prior pages, demos and prototype rejects without treating source admission as browser execution', async () => {
  const result = await createBrowserDeliveryIndex();
  const source = JSON.parse(
    await readFile(
      new URL('../../internal/compiler/website-demo-migrations.json', import.meta.url),
      'utf8'
    )
  );
  assert.equal(result.pages.length, result.inventory.pages);
  assert.equal(result.demos.length, result.inventory.demos);
  assert.equal(result.prototypes.length, result.inventory.prototypes);
  assert.equal(new Set(result.prototypes.map((row) => row.id)).size, result.inventory.prototypes);
  assert.deepEqual(
    result.prototypes
      .filter((row) => row.priorSnapshotNodeAdmission === 'rejected')
      .map((row) => row.id),
    source.prototypes
      .filter((row) => row.statuses.nodeAdmission === 'rejected')
      .map((row) => row.id)
  );
  assert.equal(
    result.pages
      .flatMap((row) => row.targets ?? [])
      .filter((row) => row.status.startsWith('browser-executed')).length,
    0
  );
});

test('refuses a success-shaped receipt with no exact source binding', async () => {
  await assert.rejects(
    verifyBrowserReceipt({
      kind: 'canonical-wasm-docs-browser-v1',
      browser: 'Chromium',
      compilerBuild: { execution: 'quickjs-wasm', compilerSha256: 'a'.repeat(64) },
      sourceFiles: {},
      cases: [],
    }),
    /Missing browser receipt source binding/
  );
  await assert.rejects(
    verifyBrowserReceipt({ kind: 'canonical-wasm-docs-browser-v1', cases: [{ status: 'passed' }] }),
    /does not identify/
  );
});

const coreInput = 'packages/core/src/spec/feedback/tokens.ts';
const cssInput = 'packages/cli/src/services/proto-style-css.ts';

async function evidenceFixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'pui-browser-input-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const write = async (file, contents) => {
    await mkdir(path.dirname(path.join(directory, file)), { recursive: true });
    await writeFile(path.join(directory, file), contents);
  };
  await write(coreInput, 'export const token = "original-core";');
  await write(cssInput, 'export const css = "original-css";');
  await write(
    'entry.ts',
    `import {token} from './${coreInput}'; import {css} from './${cssInput}'; export const result = token + css;`
  );
  await write('vendor.ts', 'export const targetVersion = "1";');
  await write('vm.wasm', 'fixture-wasm-bytes');
  const capture = async () => {
    const bundle = (entry) =>
      build({
        absWorkingDir: directory,
        entryPoints: [entry],
        bundle: true,
        write: false,
        metafile: true,
        format: 'esm',
      });
    const compiler = await bundle('entry.ts'),
      target = await bundle('vendor.ts');
    const compilerInputs = await hashMetafileInputs(compiler.metafile, directory);
    const targetInputs = await hashMetafileInputs(target.metafile, directory);
    const vmInputs = await hashInputFiles(['vm.wasm'], directory);
    const compilerBuild = {
      format: 1,
      execution: 'quickjs-wasm',
      compilerSha256: digest(compiler.outputFiles[0].text),
      typescriptVersion: 'test-fixture',
    };
    const targetText = JSON.stringify({ modules: { react: target.outputFiles[0].text } });
    return {
      format: 1,
      kind: 'canonical-browser-build-inputs-v1',
      sourcePolicy: 'workspace-superset-and-esbuild-inputs-v1',
      compilerBuild,
      targetModulesSha256: { 'react-dom-source-v1': digest(targetText) },
      inputGroups: {
        compiler: Object.keys(compilerInputs),
        targets: { 'react-dom-source-v1': Object.keys(targetInputs) },
        delivery: Object.keys(vmInputs),
      },
      assets: {
        'compiler.js': compilerBuild.compilerSha256,
        'targets/react-dom-source-v1.json': digest(targetText),
      },
      sourceFiles: mergeInputFiles(compilerInputs, targetInputs, vmInputs),
    };
  };
  const manifest = await capture();
  const manifestSha256 = digest(JSON.stringify(manifest)),
    sourceSha256 = digest(JSON.stringify(manifest.sourceFiles));
  const receipt = {
    kind: 'canonical-wasm-docs-browser-v1',
    browser: 'fixture-browser',
    cases: [],
    ...browserEvidenceRecord(manifest),
    compilerBuild: manifest.compilerBuild,
    service: {
      mode: 'local-runner-service',
      url: 'http://127.0.0.1:4325',
      owner: {
        ...localBrowserServiceConfiguration({}, '/fixture/repository', '/fixture/node'),
        status: 'passed',
        pid: 123,
        parentPid: 122,
        observedLocalURL: 'http://127.0.0.1:4325/',
        portAvailableBeforeSpawn: true,
        aliveAtReady: true,
        aliveBeforeShutdown: true,
      },
      inputManifestSha256: manifestSha256,
      assets: { ...manifest.assets },
    },
    sourceStability: {
      status: 'passed',
      beforeSha256: sourceSha256,
      afterSha256: sourceSha256,
      manifestSha256,
    },
    loadedAssets: { ...manifest.assets },
    loadedWasm: [{ sha256: manifest.sourceFiles['vm.wasm'] }],
  };
  return { write, capture, manifest, receipt };
}

test('rejects a receipt after a real compiler core or CLI CSS import changes', async (t) => {
  for (const input of [coreInput, cssInput]) {
    const fixture = await evidenceFixture(t);
    await verifyBrowserReceipt(fixture.receipt, { capture: fixture.capture });
    await fixture.write(
      input,
      input === coreInput
        ? 'export const token = "changed-core";'
        : 'export const css = "changed-css";'
    );
    await assert.rejects(
      verifyBrowserReceipt(fixture.receipt, { capture: fixture.capture }),
      (error) => error.message === `Browser receipt source drift: ${input}`
    );
    // The runner uses the same exact comparison after the browser finishes.
    const final = await fixture.capture();
    assert.throws(
      () => assertSameBrowserEvidence(fixture.manifest, final),
      (error) => error.message === `Browser receipt source drift: ${input}`
    );
  }
});

test('rejects deleted bindings, a missing build-manifest input, and a newly imported dependency', async (t) => {
  const fixture = await evidenceFixture(t);
  const missing = structuredClone(fixture.receipt);
  delete missing.sourceFiles[coreInput];
  await assert.rejects(
    verifyBrowserReceipt(missing, { capture: fixture.capture }),
    /Missing browser receipt source binding: packages\/core/
  );
  const missingManifest = structuredClone(fixture.receipt);
  missingManifest.buildManifest.inputGroups.compiler =
    missingManifest.buildManifest.inputGroups.compiler.filter((file) => file !== coreInput);
  await assert.rejects(
    verifyBrowserReceipt(missingManifest, { capture: fixture.capture }),
    /manifest drift/
  );
  await fixture.write('new-semantic.ts', 'export const extra = "new-dependency";');
  await fixture.write(
    'entry.ts',
    `import {token} from './${coreInput}'; import {css} from './${cssInput}'; import {extra} from './new-semantic'; export const result = token + css + extra;`
  );
  await assert.rejects(
    verifyBrowserReceipt(fixture.receipt, { capture: fixture.capture }),
    /Missing browser receipt source binding: new-semantic.ts/
  );
});

test('rejects stale target bundles, mismatched remote-service bytes and missing final stability', async (t) => {
  const fixture = await evidenceFixture(t);
  const staleTarget = structuredClone(fixture.receipt);
  staleTarget.buildManifest.assets['targets/react-dom-source-v1.json'] = 'f'.repeat(64);
  await assert.rejects(
    verifyBrowserReceipt(staleTarget, { capture: fixture.capture }),
    /manifest drift/
  );
  const wrongService = structuredClone(fixture.receipt);
  wrongService.service.assets['compiler.js'] = 'f'.repeat(64);
  await assert.rejects(
    verifyBrowserReceipt(wrongService, { capture: fixture.capture }),
    /service assets/
  );
  const missingFinal = structuredClone(fixture.receipt);
  delete missingFinal.sourceStability;
  await assert.rejects(
    verifyBrowserReceipt(missingFinal, { capture: fixture.capture }),
    /final input\/asset stability/
  );
  await fixture.write('vendor.ts', 'export const targetVersion = "2";');
  const final = await fixture.capture();
  assert.throws(
    () => assertSameBrowserEvidence(fixture.manifest, final),
    /source drift: vendor.ts/
  );
});

test('requires a fresh owned service and binds its recorded root, command and listening port', async (t) => {
  const fixture = await evidenceFixture(t);
  await verifyBrowserReceipt(fixture.receipt, { capture: fixture.capture });
  for (const mutate of [
    (service) => {
      service.mode = 'external-source-bound-service';
    },
    (service) => {
      service.owner.cwd = '/another/repository/apps/www';
    },
    (service) => {
      service.owner.command[6] = '4326';
    },
    (service) => {
      service.owner.observedLocalURL = 'http://127.0.0.1:4326/';
    },
    (service) => {
      service.owner.aliveBeforeShutdown = false;
    },
    (service) => {
      service.owner.pid = service.owner.parentPid;
    },
    (service) => {
      service.owner.status = 'running';
    },
  ]) {
    const rejected = structuredClone(fixture.receipt);
    mutate(rejected.service);
    await assert.rejects(
      verifyBrowserReceipt(rejected, { capture: fixture.capture }),
      /local Astro service|process.*binding/
    );
  }
  assert.throws(
    () =>
      localBrowserServiceConfiguration(
        { PUI_BROWSER_URL: 'http://127.0.0.1:4325' },
        '/fixture/repository',
        '/fixture/node'
      ),
    /must own a fresh local Astro process/
  );
  const base = 'http://127.0.0.1:4325';
  assert.equal(observedAstroLocalURL('astro ready in 100 ms\n', base), undefined);
  assert.equal(observedAstroLocalURL('┃ Local http://127.0.0.1:', base), undefined);
  assert.equal(
    observedAstroLocalURL(
      '\u001b[2m┃\u001b[22m Local    \u001b[36mhttp://127.0.0.1:4325/\u001b[39m\n',
      base
    ),
    `${base}/`
  );
  assert.throws(
    () => observedAstroLocalURL('┃ Local http://127.0.0.1:4326/\n', base),
    /refusing an existing or alternate service/
  );
});

test('refuses an occupied loopback port without terminating the existing listener', async () => {
  const occupied = createServer();
  await new Promise((resolve, reject) => {
    occupied.once('error', reject);
    occupied.listen({ host: '127.0.0.1', port: 0, exclusive: true }, resolve);
  });
  const port = occupied.address().port;
  try {
    await assert.rejects(assertLoopbackPortAvailable(port), (error) => error.code === 'EADDRINUSE');
    assert.equal(occupied.listening, true);
  } finally {
    await new Promise((resolve, reject) =>
      occupied.close((error) => (error ? reject(error) : resolve()))
    );
  }
  await assertLoopbackPortAvailable(port);
});
