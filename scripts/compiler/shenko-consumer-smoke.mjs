/** Replays the real frozen Shenko web application in an isolated caller-owned checkout.
 * Prerequisites: the declared upstream public-package closure has been built; the
 * isolated Shenko web/pnpm-lock.yaml has been installed with --frozen-lockfile.
 * This changes only that disposable checkout. It never writes to the source snapshot.
 * Usage: node scripts/compiler/shenko-consumer-smoke.mjs <checkout> <pinned-build> <public-build-receipt>
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const upstream = fileURLToPath(new URL('../../', import.meta.url));
const checkout = path.resolve(process.argv[2]),
  artifact = path.resolve(process.argv[3]),
  receipt = path.resolve(process.argv[4]);
const work = mkdtempSync(path.join(tmpdir(), 'proto-shenko-replay-'));
const web = path.join(checkout, 'crates/shenko-ui/web'),
  assets = path.join(web, '../src/static');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const save = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const git = (cwd, ...args) => {
  const value = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(value.status, 0, value.stderr);
  return value.stdout.trim();
};
assert.notEqual(
  checkout,
  process.env.SHENKO_SOURCE_SNAPSHOT,
  'Do not mutate a shared source snapshot'
);
const temporaryRelative = path.relative(tmpdir(), checkout);
assert.ok(
  temporaryRelative && !path.isAbsolute(temporaryRelative) && !temporaryRelative.startsWith('..'),
  'Use a disposable checkout below the OS temporary directory'
);
assert.equal(git(checkout, 'rev-parse', 'HEAD'), 'f3fa6f4d8bf22cfd2baf490d9c3a08bd39af4d42');
const identity = json(path.join(artifact, 'compiler-build.json'));
const publicBuild = json(receipt);
const summary = {
  schema: 'proto-ui.sprint2.shenko-consumer.v1',
  consumer: {
    repository: 'https://github.com/cyjin-yl/shenko',
    revision: git(checkout, 'rev-parse', 'HEAD'),
    checkout,
  },
  upstream: {
    revision: git(upstream, 'rev-parse', 'HEAD'),
    compilerBuild: identity,
    publicBuild: {
      selectedCount: publicBuild.selectedCount,
      receiptSha256: hash(readFileSync(receipt)),
    },
  },
  evidence: work,
  scope:
    'Actual unchanged Shenko application sources, ordinary generate/check/production build/Node test chain. This is not a running Rust Harness, live model/transport journey, physical browser/assistive-technology result or a downstream PR.',
  commands: [],
  lanes: [],
  ok: false,
};
assert.equal(summary.upstream.revision, identity.revision, 'Run against the matching source pin');
for (const input of identity.inputs)
  assert.equal(
    hash(readFileSync(path.join(upstream, input.path))),
    input.sha256,
    'Pinned build input changed: ' + input.path
  );
const frozen = () =>
  Object.fromEntries(
    git(checkout, 'ls-files', 'crates/shenko-ui/web/src', 'crates/shenko-ui/web/prototypes')
      .split('\n')
      .filter(Boolean)
      .map((file) => [file, hash(readFileSync(path.join(checkout, file)))])
  );
summary.authoredSources = frozen();
const originalPin = json(path.join(web, 'upstream-pin.json'));
const pin = { ...originalPin, commit: identity.revision, lock_sha256: identity.lockSha256 };
save(path.join(web, 'upstream-pin.json'), pin);
let buildSource = readFileSync(path.join(web, 'build.mjs'), 'utf8');
const originalBuild = buildSource;
assert.ok(buildSource.includes('const modules = Object.keys(bundle.metafile.outputs)'));
buildSource = buildSource.replace(
  'const modules = Object.keys(bundle.metafile.outputs)',
  "writeFileSync(join(webRoot, 'generated/application-metafile.json'), JSON.stringify(bundle.metafile, null, 2));\nconst modules = Object.keys(bundle.metafile.outputs)"
);
writeFileSync(path.join(web, 'build.mjs'), buildSource);
const environment = {
  ...process.env,
  NODE_OPTIONS: '',
  NODE_PATH: '',
  PROTO_UI_SOURCE: upstream,
  NATIVE_CONSUMER_COMPILER: path.join(artifact, 'index.js'),
};
delete environment.PROTO_UI_BUILD_RECEIPT;
// The unchanged downstream currently fixes this optional receipt schema at 42.
// A changed closure remains explicitly recorded above, never rewritten as 42.
if (publicBuild.selectedCount === 42 && publicBuild.results.length === 42)
  environment.PROTO_UI_BUILD_RECEIPT = receipt;
const run = (lane, name, command, args, expected = 0) => {
  const start = performance.now();
  const result = spawnSync(command, args, {
    cwd: web,
    env: environment,
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 32 * 1024 * 1024,
  });
  writeFileSync(path.join(work, lane + '-' + name + '.stdout.log'), result.stdout ?? '');
  writeFileSync(path.join(work, lane + '-' + name + '.stderr.log'), result.stderr ?? '');
  summary.commands.push({
    lane,
    name,
    command,
    args,
    status: result.status,
    signal: result.signal,
    error: result.error?.message ?? null,
    wallMs: performance.now() - start,
  });
  save(path.join(work, 'summary.json'), summary);
  assert.equal(result.error, undefined, lane + '/' + name);
  assert.equal(
    result.status,
    expected,
    lane + '/' + name + '\n' + result.stderr + '\n' + result.stdout
  );
  return result;
};
const tests = readdirSync(path.join(web, 'tests'))
  .filter((file) => file.endsWith('.test.mjs'))
  .sort()
  .map((file) => 'tests/' + file);
function recordLane(name) {
  const manifest = json(path.join(assets, 'build-manifest.json')),
    metafile = json(path.join(web, 'generated/application-metafile.json'));
  const directory = path.join(work, name);
  mkdirSync(directory);
  copyFileSync(
    path.join(assets, 'build-manifest.json'),
    path.join(directory, 'build-manifest.json')
  );
  copyFileSync(
    path.join(web, 'generated/prototypes/manifest.json'),
    path.join(directory, 'generated-manifest.json')
  );
  copyFileSync(
    path.join(web, 'generated/application-metafile.json'),
    path.join(directory, 'production-metafile.json')
  );
  const inputs = new Map();
  for (const output of Object.values(metafile.outputs))
    for (const [file, facts] of Object.entries(output.inputs)) {
      const row = inputs.get(file) ?? {
        file,
        sourceBytes: metafile.inputs[file].bytes,
        retainedBytes: 0,
      };
      row.retainedBytes += facts.bytesInOutput;
      inputs.set(file, row);
    }
  const modules = Object.keys(manifest.artifacts)
    .filter((file) => file.endsWith('.js') && file !== 'theme-bootstrap.js')
    .map((file) => {
      const bytes = readFileSync(path.join(assets, file));
      return {
        file,
        bytes: bytes.length,
        gzipBytes: gzipSync(bytes, { level: 9 }).length,
        sha256: hash(bytes),
      };
    });
  const generated = [...inputs.values()].filter((input) =>
    input.file.startsWith('generated/prototypes/')
  );
  const lane = {
    name,
    status: 'PASS',
    tools: manifest.toolchain,
    realisation: manifest.realisation,
    prototypes: manifest.compiler.prototypes,
    sourceInputs: [...inputs.values()],
    retainedProductionModules: modules,
    productionBytes: modules.reduce((sum, module) => sum + module.bytes, 0),
    productionGzipBytes: modules.reduce((sum, module) => sum + module.gzipBytes, 0),
    generatedInputSourceBytes: generated.reduce((sum, input) => sum + input.sourceBytes, 0),
    retainedGeneratedBytes: generated.reduce((sum, input) => sum + input.retainedBytes, 0),
    initialization: {
      status: 'UNTESTED',
      reason:
        'The ordinary application build and Node tests do not start the Rust UI/backend/live model or measure browser initialization; production ownership observations are separately measured by release-family-costs.',
    },
  };
  summary.lanes.push(lane);
  save(path.join(work, 'summary.json'), summary);
}
try {
  console.log('SHENKO_CONSUMER_EVIDENCE', work);
  run('source-seam', 'generate', process.execPath, ['build.mjs', '--prototypes-only']);
  run('source-seam', 'typecheck', process.execPath, [
    'node_modules/typescript/bin/tsc',
    '--noEmit',
  ]);
  run('source-seam', 'build', process.execPath, ['build.mjs']);
  run('source-seam', 'tests', process.execPath, ['--test', ...tests]);
  recordLane('source-seam');
  const originalCompiler = readFileSync(path.join(web, 'compiler.mjs'), 'utf8');
  const start = originalCompiler.indexOf('export async function loadCompiler('),
    end = originalCompiler.indexOf('\nfunction bareSpecifiersIn(', start);
  assert.ok(start >= 0 && end > start);
  const supportedLoader = `export async function loadCompiler({ sourceRoot, webRoot }) {
  const entry = process.env.NATIVE_CONSUMER_COMPILER;
  if (!entry) throw new Error('NATIVE_CONSUMER_COMPILER must select the supported pinned artifact');
  const directory = dirname(entry);
  const identity = readJson(join(directory, 'compiler-build.json'));
  const pin = readJson(join(webRoot, 'upstream-pin.json'));
  if (identity.revision !== pin.commit || identity.lockSha256 !== pin.lock_sha256) throw new Error('Pinned compiler identity mismatch');
  const manifest = readJson(join(directory, 'package.json'));
  if (JSON.stringify(manifest.dependencies) !== JSON.stringify({typescript:identity.typescript})) throw new Error('Unexpected compiler install closure');
  const loaded = await import(pathToFileURL(entry).href);
  if (JSON.stringify(loaded.compilerBuildIdentity) !== JSON.stringify(Object.fromEntries(['schema','revision','lockSha256','profilesSha256','node','typescript','esbuild'].map(key=>[key,identity[key]])))) throw new Error('Executable compiler identity mismatch');
  return {compiler:loaded,facts:{package:manifest.name,package_sha256:sha256File(join(directory,'package.json')),entry:'index.js',entry_sha256:sha256File(entry),source_tree_sha256:sha256Tree(join(sourceRoot,'packages/compiler/src')),resolutions:[],typescript:readJson(join(directory,'node_modules/typescript/package.json')).version,compilerBuild:loaded.compilerBuildIdentity,bundle:{path:entry,sha256:sha256File(entry),bytes:statSync(entry).size,format:'esm',entry:'index.js',external:['typescript']}}};
}
`;
  writeFileSync(
    path.join(web, 'compiler.mjs'),
    originalCompiler.slice(0, start) + supportedLoader + originalCompiler.slice(end)
  );
  save(path.join(web, 'upstream-pin.json'), {
    ...pin,
    compiler: {
      ...pin.compiler,
      package: '@proto.ui/compiler-pinned',
      entry: 'index.js',
      exports_source_only: false,
      delivery: 'source-pinned-build',
      upstream_visibility:
        'private source-pinned build with exact revision, lock and profile identity; no registry publication',
    },
  });
  buildSource = buildSource
    .replace(
      '    package: compilerRecord.package,',
      '    compilerBuild: compilerRecord.compilerBuild,\n    package: compilerRecord.package,'
    )
    .replace(
      'The compiler exports TypeScript source only and is private, so it is never one of the built public packages; Shenko compiles it at build time instead.',
      'The compiler is a separately built private source-pinned artifact; public packages are only the actual Adapter-family dependencies.'
    );
  writeFileSync(path.join(web, 'build.mjs'), buildSource);
  run('pinned-artifact', 'generate', process.execPath, ['build.mjs', '--prototypes-only']);
  run('pinned-artifact', 'typecheck', process.execPath, [
    'node_modules/typescript/bin/tsc',
    '--noEmit',
  ]);
  run('pinned-artifact', 'build', process.execPath, ['build.mjs']);
  // Preserve the original source-seam identity test's genuine negative result.
  const legacy = run(
    'pinned-artifact',
    'legacy-identity-test',
    process.execPath,
    ['--test', 'tests/prototypes.test.mjs'],
    1
  );
  assert.match(legacy.stdout, /tests 4/);
  assert.match(legacy.stdout, /pass 3/);
  assert.match(legacy.stdout, /fail 1/);
  const testFile = path.join(web, 'tests/prototypes.test.mjs');
  let updatedTest = readFileSync(testFile, 'utf8');
  updatedTest = updatedTest
    .replace(
      'the recorded compiler identity is the audited source package, bundled for the build only',
      'the recorded compiler identity is the supported private source-pinned build'
    )
    .replace(
      "assert.equal(manifest.package, 'packages/compiler');",
      "assert.equal(manifest.package, '@proto.ui/compiler-pinned');"
    )
    .replace(
      "assert.equal(manifest.entry, 'packages/compiler/src/index.ts');",
      "assert.equal(manifest.entry, 'index.js');"
    )
    .replace(
      "assert.ok(manifest.resolutions.some((resolution) => resolution.specifier === '@floating-ui/dom'));",
      "assert.deepEqual(manifest.resolutions, []);\n  assert.match(manifest.compilerBuild.revision, /^[0-9a-f]{40}$/);\n  for (const prototype of manifest.prototypes) {\n    const provenance = JSON.parse(readFileSync(join(webRoot, prototype.provenance), 'utf8'));\n    assert.deepEqual(provenance.compilerBuild, manifest.compilerBuild);\n  }"
    );
  writeFileSync(testFile, updatedTest);
  run('pinned-artifact', 'tests', process.execPath, ['--test', ...tests]);
  recordLane('pinned-artifact');
  assert.deepEqual(
    frozen(),
    summary.authoredSources,
    'Real application or authored Prototype sources were modified'
  );
  summary.authoredSourcesUnchanged = true;
  summary.ok = true;
} catch (error) {
  summary.failure = { message: error.message, stack: error.stack };
  console.error(error);
  process.exitCode = 1;
} finally {
  writeFileSync(
    path.join(work, 'temporary-consumer.patch'),
    git(
      checkout,
      'diff',
      '--',
      'crates/shenko-ui/web/upstream-pin.json',
      'crates/shenko-ui/web/compiler.mjs',
      'crates/shenko-ui/web/build.mjs',
      'crates/shenko-ui/web/tests/prototypes.test.mjs'
    ) + '\n'
  );
  save(path.join(work, 'summary.json'), summary);
}
