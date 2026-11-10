import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FIXTURE_DIR = join(ROOT_DIR, 'scripts/release/consumer-smoke/core-types');
const MODES = ['NodeNext', 'Bundler'];
const args = parseArgs(process.argv.slice(2));
assert.equal(Number(process.versions.node.split('.')[0]), 24, 'Use the repository Node 24 baseline');
assert(args.releaseDir, '--release-dir must name canonical publish.mjs --pack output');
const releaseDir = resolve(args.releaseDir);
const workDir = args.workDir
  ? resolve(args.workDir)
  : mkdtempSync(join(tmpdir(), 'pui-core-consumer-'));
assert(!within(ROOT_DIR, workDir), 'The consumer must be outside the repository');
assert(!within(releaseDir, workDir), 'The consumer must be outside the preserved release');
if (args.workDir) mkdirSync(workDir);
const consumerDir = join(workDir, 'consumer');
const tscBin = args.typescript
  ? resolve(args.typescript)
  : join(ROOT_DIR, 'node_modules/typescript/bin/tsc');
const receipt = {
  schemaVersion: 1,
  subject: 'issue.1138.001 / issue.1138.002: isolated core packed consumer',
  startedAt: new Date().toISOString(),
  outcome: 'failed',
  source: { root: ROOT_DIR },
  tools: { node: { version: process.version, executable: process.execPath } },
  releaseDir,
  workDir,
  steps: [],
  controls: {
    valid: { outcome: 'not-run' },
    invalidContext: { outcome: 'not-run' },
    injectedMissingTypes: { outcome: 'not-run' },
  },
};

try {
  const head = execute('source-head', 'git', ['rev-parse', 'HEAD'], ROOT_DIR);
  requireSuccess(head);
  receipt.source.headSha = head.stdout.trim();
  assert.match(receipt.source.headSha, /^[a-f0-9]{40}$/);
  receipt.source.files = Object.fromEntries(
    [
      'packages/core/package.json',
      'packages/types/package.json',
      'packages/core/src/context.ts',
      'packages/core/src/prototype.ts',
      'scripts/build/public-packages.mjs',
      'scripts/release/lib.mjs',
      'scripts/release/consumer-smoke-core.mjs',
      'pnpm-lock.yaml',
      ...['consumer.ts', 'invalid.ts', 'runtime.mjs'].map(
        (name) => `scripts/release/consumer-smoke/core-types/${name}`
      ),
    ].map((name) => [name, sha256(join(ROOT_DIR, name))])
  );
  receipt.tools.typescript = {
    executable: tscBin,
    sha256: sha256(tscBin),
    version: JSON.parse(readFileSync(join(dirname(dirname(tscBin)), 'package.json'), 'utf8'))
      .version,
  };

  const packPath = join(releaseDir, 'pack-manifest.json');
  const pack = JSON.parse(readFileSync(packPath, 'utf8'));
  assert.equal(pack.schemaVersion, 1, 'Unsupported canonical pack manifest');
  const byName = new Map(pack.packages.map((entry) => [entry.name, entry]));
  assert.equal(byName.size, pack.packages.length, 'Duplicate packed package identity');
  receipt.packManifest = { path: packPath, sha256: sha256(packPath), version: pack.releaseVersion };
  const selected = new Map();
  const queue = ['@proto.ui/core'];
  for (let index = 0; index < queue.length; index += 1) {
    const name = queue[index];
    if (selected.has(name)) continue;
    const entry = byName.get(name);
    assert(entry, `Missing declared local tarball: ${name}`);
    assert.equal(entry.version, pack.releaseVersion, `${name}: packed release version drift`);
    const stage = releasePath(entry.stage);
    const tarball = releasePath(entry.tarball);
    const manifestPath = join(stage, 'package.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    assert.equal(manifest.name, name);
    assert.equal(manifest.version, entry.version);
    selected.set(name, { stage, tarball, manifest });
    for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const [dependency, version] of Object.entries(manifest[field] ?? {})) {
        assert(dependency.startsWith('@proto.ui/'), `Unexpected external core dependency: ${dependency}`);
        assert(byName.has(dependency), `No local packed artifact for ${name} -> ${dependency}`);
        assert.equal(version, byName.get(dependency).version, `${name}: non-exact ${dependency} edge`);
        queue.push(dependency);
      }
    }
  }
  receipt.declaredClosure = [...selected.keys()].sort();
  receipt.packages = Object.fromEntries(
    [...selected].map(([name, entry]) => [
      name,
      {
        tarball: { path: entry.tarball, sha256: sha256(entry.tarball) },
        stagedManifest: { path: join(entry.stage, 'package.json'), sha256: sha256(join(entry.stage, 'package.json')) },
        dependencies: entry.manifest.dependencies ?? {},
        dist: inventory(join(entry.stage, 'dist')),
      },
    ])
  );
  const contextDeclaration = join(selected.get('@proto.ui/core').stage, 'dist/context.d.ts');
  receipt.coreContextDeclaration = {
    path: contextDeclaration,
    sha256: sha256(contextDeclaration),
    text: readFileSync(contextDeclaration, 'utf8'),
  };

  cpSync(FIXTURE_DIR, consumerDir, { recursive: true });
  writeJson(join(consumerDir, 'package.json'), {
    name: 'proto-ui-core-declared-closure-consumer',
    version: '0.0.0',
    private: true,
    type: 'module',
    dependencies: Object.fromEntries(
      [...selected].map(([name, entry]) => [
        name,
        `file:${relative(consumerDir, entry.tarball).replaceAll('\\', '/')}`,
      ])
    ),
  });
  writeConfigs(consumerDir);
  const install = execute('install-offline', 'npm', [
    'install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund',
    '--registry=http://127.0.0.1:9', '--cache', join(workDir, 'npm-cache'),
  ], consumerDir);
  requireSuccess(install);
  const lockPath = join(consumerDir, 'package-lock.json');
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  const installed = Object.entries(lock.packages ?? {}).filter(([name]) =>
    name.startsWith('node_modules/@proto.ui/')
  );
  assert.deepEqual(
    installed.map(([name]) => name.slice('node_modules/'.length)).sort(),
    receipt.declaredClosure,
    'Installation must contain only the declared local tarball closure'
  );
  receipt.installedLock = { path: lockPath, sha256: sha256(lockPath) };
  for (const [key, entry] of installed) {
    const name = key.slice('node_modules/'.length);
    assert.equal(entry.version, pack.releaseVersion, `${name}: installed version drift`);
    assert(entry.resolved?.startsWith('file:'), `${name}: registry or workspace fallback`);
    assert(!entry.link, `${name}: workspace link is not an installed tarball`);
    const packageDir = join(consumerDir, key);
    assert(lstatSync(packageDir).isDirectory(), `${name}: package is not a physical directory`);
    assert.deepEqual(inventory(join(packageDir, 'dist')), receipt.packages[name].dist);
    receipt.packages[name].installedManifest = {
      path: join(packageDir, 'package.json'),
      sha256: sha256(join(packageDir, 'package.json')),
    };
  }

  requireSuccess(execute('runtime', process.execPath, ['runtime.mjs'], consumerDir));
  const normal = MODES.map((mode) => checkTypes(`valid-${mode}`, consumerDir, mode, 'consumer'));
  receipt.controls.valid = normal.map(({ status }) => status);
  assert(normal.every(passed), 'Valid strict consumer failed; retain the real before diagnostics');

  const invalid = MODES.map((mode) => checkTypes(`invalid-${mode}`, consumerDir, mode, 'invalid'));
  for (const result of invalid) {
    assert(failedNormally(result), 'Invalid context type must be rejected by TypeScript');
    assert.match(result.stdout + result.stderr, /error TS2344:/);
    assert.doesNotMatch(result.stdout + result.stderr, /error TS2307:/);
  }
  receipt.controls.invalidContext = { outcome: 'rejected', statuses: invalid.map(({ status }) => status) };

  if (selected.has('@proto.ui/types')) {
    const missingDir = join(workDir, 'injected-missing-types');
    cpSync(FIXTURE_DIR, missingDir, { recursive: true });
    writeJson(join(missingDir, 'package.json'), { private: true, type: 'module' });
    writeConfigs(missingDir);
    mkdirSync(join(missingDir, 'node_modules/@proto.ui'), { recursive: true });
    cpSync(
      join(consumerDir, 'node_modules/@proto.ui/core'),
      join(missingDir, 'node_modules/@proto.ui/core'),
      { recursive: true }
    );
    const missing = MODES.map((mode) => checkTypes(`missing-types-${mode}`, missingDir, mode, 'consumer'));
    for (const result of missing) {
      assert(failedNormally(result), 'The injected missing dependency must fail strict declaration resolution');
      assert.match(result.stdout + result.stderr, /error TS2307:.*@proto\.ui\/types/);
    }
    receipt.controls.injectedMissingTypes = {
      injected: true,
      description: 'Separate copy contains the real installed core bytes and deliberately omits types; the positive installation is preserved.',
      outcome: 'rejected',
      statuses: missing.map(({ status }) => status),
    };
  } else {
    receipt.controls.injectedMissingTypes = {
      outcome: 'not-applicable',
      reason: 'Valid strict declarations resolved without a declared types package; no dependency edge is inferred from this producer.',
    };
  }
  receipt.outcome = 'passed';
} catch (error) {
  receipt.error = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
} finally {
  receipt.finishedAt = new Date().toISOString();
  writeJson(join(workDir, 'receipt.json'), receipt);
  console.log(`core packed consumer ${receipt.outcome}; evidence: ${join(workDir, 'receipt.json')}`);
}

function parseArgs(argv) {
  const parsed = {};
  const options = new Map([
    ['--release-dir', 'releaseDir'], ['--work-dir', 'workDir'], ['--typescript', 'typescript'],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--') continue;
    const key = options.get(argv[index]);
    assert(key, `Unknown option: ${argv[index]}`);
    const value = argv[++index];
    assert(value && !value.startsWith('--'), `Missing value for ${argv[index - 1]}`);
    assert(!parsed[key], `Duplicate option: ${argv[index - 1]}`);
    parsed[key] = value;
  }
  return parsed;
}

function within(parent, child) {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}

function releasePath(value) {
  assert.equal(typeof value, 'string', 'Pack manifest must contain relative stage/tarball paths');
  assert(value && !isAbsolute(value), 'Pack paths must be relative');
  const target = resolve(releaseDir, value);
  assert(within(releaseDir, target), 'Pack path escapes the release directory');
  return target;
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function inventory(dir, prefix = '') {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(dir, entry.name);
    const name = prefix + entry.name;
    if (entry.isDirectory()) files.push(...inventory(path, `${name}/`));
    else {
      assert(entry.isFile(), `Packed dist must contain ordinary files: ${path}`);
      files.push({ path: name, sha256: sha256(path) });
    }
  }
  return files;
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeConfigs(dir) {
  for (const mode of MODES) {
    for (const input of ['consumer', 'invalid']) {
      writeJson(join(dir, `${input}-${mode}.json`), {
        compilerOptions: {
          target: 'ES2022',
          module: mode === 'NodeNext' ? mode : 'ESNext',
          moduleResolution: mode,
          strict: true,
          skipLibCheck: false,
          noEmit: true,
          types: [],
        },
        files: [`${input}.ts`],
      });
    }
  }
}

function execute(label, command, commandArgs, cwd) {
  const startedAt = new Date().toISOString();
  const started = performance.now();
  const result = spawnSync(command, commandArgs, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '' },
    shell: process.platform === 'win32',
    timeout: 180000,
    maxBuffer: 32 * 1024 * 1024,
  });
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const logs = { stdout: join(workDir, `${label}.stdout.log`), stderr: join(workDir, `${label}.stderr.log`) };
  writeFileSync(logs.stdout, stdout);
  writeFileSync(logs.stderr, stderr);
  receipt.steps.push({
    label, command, args: commandArgs, cwd, startedAt,
    durationMs: Math.round(performance.now() - started),
    status: result.status, signal: result.signal, error: result.error?.message ?? null,
    logs: Object.fromEntries(Object.entries(logs).map(([stream, path]) => [stream, { path, sha256: sha256(path) }])),
  });
  return { ...result, stdout, stderr, label };
}

function passed(result) {
  return !result.error && result.signal === null && result.status === 0;
}

function failedNormally(result) {
  return !result.error && result.signal === null && result.status !== null && result.status !== 0;
}

function requireSuccess(result) {
  assert(passed(result), `${result.label} failed (status ${result.status}, signal ${result.signal}); inspect retained logs`);
}

function checkTypes(label, dir, mode, input) {
  const result = execute(label, process.execPath, [tscBin, '-p', `${input}-${mode}.json`, '--pretty', 'false', '--listFiles'], dir);
  const resolvedFiles = result.stdout.split(/\r?\n/).filter((line) => isAbsolute(line) && line.endsWith('.d.ts'));
  const compilerLib = realpathSync(join(dirname(dirname(tscBin)), 'lib'));
  const outsideInputs = resolvedFiles.filter(
    (file) => !within(join(dir, 'node_modules'), file) && !within(compilerLib, realpathSync(file))
  );
  assert.deepEqual(outsideInputs, [], `${label}: declarations outside installed packages/compiler library leaked into the consumer`);
  receipt.steps[receipt.steps.length - 1].resolvedDeclarations = resolvedFiles.filter((file) => within(join(dir, 'node_modules/@proto.ui'), file));
  return result;
}
