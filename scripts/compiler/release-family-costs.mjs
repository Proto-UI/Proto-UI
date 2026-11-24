/** Measure production bytes and host API work as separate observations.
 * Usage: node scripts/compiler/release-family-costs.mjs /path/to/family/summary.json
 * Reuses the exact isolated consumer installation, without recompiling authored source.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { build, version } from 'esbuild';

assert.ok(process.argv[2], 'Provide an accepted release-family summary.json');
const summaryPath = path.resolve(process.argv[2]);
const summaryBytes = readFileSync(summaryPath);
const summary = JSON.parse(summaryBytes);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const save = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const reportPath = path.join(path.dirname(summaryPath), 'production-costs.json');
assert.equal(
  existsSync(reportPath),
  false,
  'Preserve the previous cost attempt; measure a fresh copy of the accepted consumer and summary'
);
const report = {
  schema: 'proto-ui.family-production-costs.v2',
  ok: false,
  compilerBuild: summary.compilerBuild,
  summaryInput: { path: summaryPath, sha256: hash(summaryBytes) },
  tool: {
    esbuild: version,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    zlib: process.versions.zlib,
  },
  scope:
    'Three full authored family Button modules: N=1 Base and N=3 Base/Shadcn/Brutalist. Browser ESM production bundles retain exported component APIs and include target dependencies. Source bytes, retained output, gzip and observed host API calls are different measurements. Original F6 tasks/excluding-React measurements are not reproduced here.',
  acceptedBudget: null,
  rows: [],
  supportIdentityObservations: [],
  initialization: {
    scope:
      'One fresh Happy DOM process per production React bundle with 0/1/3 component modules. Zero is an independent framework-root control. Host API call counts include framework work; they are not all heap allocations, unique live resources, browser latency or an accepted performance budget.',
    rows: [],
  },
};
const checkpoint = () => save(reportPath, report);
checkpoint();
const bundleOptions = {
  bundle: true,
  minify: true,
  treeShaking: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  define: { 'process.env.NODE_ENV': '"production"' },
  metafile: true,
  legalComments: 'eof',
};
function retainedInputs(built, consumer, entryName, entry) {
  const output = Object.values(built.metafile.outputs).find((item) => item.entryPoint);
  assert.ok(output, 'The real bundle must retain its entry point');
  return Object.entries(output.inputs).map(([file, facts]) => ({
    path: file,
    bytesInOutput: facts.bytesInOutput,
    sourceBytes: built.metafile.inputs[file]?.bytes ?? 0,
    sha256:
      path.basename(file) === entryName
        ? hash(entry)
        : built.metafile.inputs[file]
          ? hash(readFileSync(path.resolve(consumer, file)))
          : null,
  }));
}
function supportIdentities(rows) {
  const support = (row) =>
    row.retainedInputs.filter((file) => file.path.startsWith('generated/.proto-ui/'));
  const one = support(rows.find((row) => row.modules === 1));
  const many = support(rows.find((row) => row.modules === 3));
  const byHash = new Map();
  for (const file of many) {
    if (!byHash.has(file.sha256)) byHash.set(file.sha256, []);
    byHash.get(file.sha256).push(file.path);
  }
  return {
    profile: rows[0].profile,
    scope:
      'Actual esbuild module identities; identical content under different paths is reported, not assumed to be a bug or silently aliased. This observation does not prove maximal project deduplication.',
    one: one.map(({ path, sha256, bytesInOutput }) => ({ path, sha256, bytesInOutput })),
    three: many.map(({ path, sha256, bytesInOutput }) => ({ path, sha256, bytesInOutput })),
    sharedPathAndHash: one
      .filter((file) =>
        many.some((other) => other.path === file.path && other.sha256 === file.sha256)
      )
      .map((file) => file.path),
    addedInThree: many
      .filter((file) => !one.some((other) => other.path === file.path))
      .map((file) => file.path),
    identicalContentDifferentPaths: [...byHash]
      .filter(([, paths]) => paths.length > 1)
      .map(([sha256, paths]) => ({ sha256, paths })),
  };
}

try {
  assert.equal(summary.ok, true, 'Measure only the already accepted ordinary family assembly');
  assert.equal(version, '0.25.12');
  assert.deepEqual(
    summary.results.map(({ profile }) => profile).sort(),
    ['react-dom-source-v1', 'vue-source-v1', 'vue2-source-v1', 'web-component-source-v1'].sort()
  );
  for (const row of summary.results) {
    assert.equal(row.ok, true);
    assert.deepEqual(
      row.families.map(({ family }) => family),
      ['base', 'shadcn', 'brutalist']
    );
    const consumer = row.consumer;
    const provenance = JSON.parse(readFileSync(path.join(consumer, 'generated/provenance.json')));
    for (const artifact of provenance.artifacts) {
      assert.equal(
        hash(readFileSync(path.join(consumer, 'generated', artifact.path))),
        artifact.sha256,
        `Generated input changed after family acceptance: ${artifact.path}`
      );
    }
    const profileRows = [];
    for (const n of [1, 3]) {
      const selected = row.families.slice(0, n);
      const name = `production-${n}`;
      const entry = selected
        .map(
          (family) => `export {${family.componentName}} from './generated/${family.sourcePath}';`
        )
        .join('\n');
      const built = await build({
        ...bundleOptions,
        absWorkingDir: consumer,
        stdin: { contents: entry, resolveDir: consumer, sourcefile: `${name}.ts`, loader: 'ts' },
        outfile: path.join(consumer, `${name}.js`),
        sourcemap: true,
      });
      save(path.join(consumer, `${name}.metafile.json`), built.metafile);
      const retained = retainedInputs(built, consumer, `${name}.ts`, entry);
      const bytes = readFileSync(path.join(consumer, `${name}.js`));
      const cost = {
        profile: row.profile,
        modules: n,
        sources: selected.map((family) => ({
          entry: family.entry,
          sourceGraphSha256: family.sourceGraphSha256,
        })),
        entrySha256: hash(entry),
        bundleSha256: hash(bytes),
        metafileSha256: hash(readFileSync(path.join(consumer, `${name}.metafile.json`))),
        generatedInputSourceBytes: retained
          .filter((file) => file.path.startsWith('generated/'))
          .reduce((sum, file) => sum + file.sourceBytes, 0),
        supportInputSourceBytes: retained
          .filter((file) => file.path.startsWith('generated/.proto-ui/'))
          .reduce((sum, file) => sum + file.sourceBytes, 0),
        retainedProductionBytes: bytes.length,
        retainedGzipBytes: gzipSync(bytes, { level: 9 }).length,
        retainedSupportingBytes: retained
          .filter((file) => file.path.startsWith('generated/.proto-ui/'))
          .reduce((sum, file) => sum + file.bytesInOutput, 0),
        retainedInputs: retained,
      };
      report.rows.push(cost);
      profileRows.push(cost);
      checkpoint();
    }
    report.supportIdentityObservations.push(supportIdentities(profileRows));
    checkpoint();
    if (row.profile !== 'react-dom-source-v1') continue;
    for (const name of ['host-cost-observer.mjs', 'release-family-cost-runtime.mjs']) {
      copyFileSync(new URL(`./${name}`, import.meta.url), path.join(consumer, name));
    }
    for (const n of [0, 1, 3]) {
      const selected = row.families.slice(0, n);
      const name = `production-owner-${n}`;
      const imports = selected
        .map(
          (family) => `import {${family.componentName}} from './generated/${family.sourcePath}';`
        )
        .join('\n');
      const program = `import * as React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';${imports}
const components=[${selected.map((family) => family.componentName).join(',')}];
export function mount(host){const refs=components.map(()=>React.createRef());const root=createRoot(host);flushSync(()=>root.render(React.createElement(React.Fragment,null,...components.map((Component,index)=>React.createElement(Component,{key:index,ref:refs[index],styleProfile:'vega'},'instance-'+index)))));return {handles:refs.map(ref=>ref.current.getExposes()),dispose(){flushSync(()=>root.unmount());}};}`;
      writeFileSync(path.join(consumer, `${name}.ts`), program);
      const built = await build({
        ...bundleOptions,
        absWorkingDir: consumer,
        stdin: { contents: program, resolveDir: consumer, sourcefile: `${name}.ts`, loader: 'ts' },
        outfile: path.join(consumer, `${name}.js`),
      });
      save(path.join(consumer, `${name}.metafile.json`), built.metafile);
      const receipt = {
        componentModules: n,
        ok: false,
        entrySha256: hash(program),
        bundleSha256: hash(readFileSync(path.join(consumer, `${name}.js`))),
        metafileSha256: hash(readFileSync(path.join(consumer, `${name}.metafile.json`))),
        runtimeSha256: hash(readFileSync(path.join(consumer, 'release-family-cost-runtime.mjs'))),
        observerSha256: hash(readFileSync(path.join(consumer, 'host-cost-observer.mjs'))),
      };
      report.initialization.rows.push(receipt);
      checkpoint();
      const started = performance.now();
      const result = spawnSync(process.execPath, ['release-family-cost-runtime.mjs', String(n)], {
        cwd: consumer,
        encoding: 'utf8',
        env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '' },
        timeout: 60000,
        maxBuffer: 16 * 1024 * 1024,
      });
      writeFileSync(path.join(consumer, `${name}.stdout.log`), result.stdout ?? '');
      writeFileSync(path.join(consumer, `${name}.stderr.log`), result.stderr ?? '');
      receipt.process = {
        executable: process.execPath,
        args: ['release-family-cost-runtime.mjs', String(n)],
        cwd: consumer,
        status: result.status,
        signal: result.signal,
        error: result.error?.message ?? null,
        wallMs: performance.now() - started,
        stderrBytes: Buffer.byteLength(result.stderr ?? ''),
      };
      save(path.join(consumer, `${name}.result.json`), receipt.process);
      checkpoint();
      assert.equal(result.error, undefined, 'Production observation process failed to execute');
      assert.equal(result.signal, null, 'Production observation process was signalled');
      assert.equal(result.status, 0, result.stderr);
      const observations = JSON.parse(
        readFileSync(path.join(consumer, `${name}-observations.json`))
      );
      assert.equal(observations.componentModules, n);
      assert.equal(observations.ok, true);
      receipt.observations = observations;
      receipt.ok = true;
      checkpoint();
    }
  }
  report.ok = true;
} catch (error) {
  report.error = error.stack ?? String(error);
  throw error;
} finally {
  checkpoint();
}
console.log('RELEASE_FAMILY_COSTS', reportPath);
