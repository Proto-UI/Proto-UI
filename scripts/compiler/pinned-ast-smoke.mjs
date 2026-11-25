/** Plain-Node consumption of the current AST compiler package, separate from historical profiles. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const options = new Map();
const flags = new Set();
for (let index = 2; index < process.argv.length; index++) {
  const key = process.argv[index];
  if (key === '--llvm' || key === '--gpui') flags.add(key);
  else {
    assert.ok(
      ['--compiler', '--source-root'].includes(key) && process.argv[index + 1],
      'Unknown or incomplete smoke option: ' + key
    );
    options.set(key, process.argv[++index]);
  }
}
assert.ok(
  options.has('--compiler'),
  'Usage: node pinned-ast-smoke.mjs --compiler <package/index.js> [--source-root <checkout>] [--llvm] [--gpui]'
);
const compilerEntry = path.resolve(options.get('--compiler'));
const installation = path.dirname(compilerEntry);
const sourceRoot = path.resolve(
  options.get('--source-root') ?? fileURLToPath(new URL('../../', import.meta.url))
);
const work = mkdtempSync(path.join(os.tmpdir(), 'proto-pinned-ast-consumer-'));
const authoring = path.join(work, 'authoring');
const consumer = path.join(work, 'consumer');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const json = (filename) => JSON.parse(readFileSync(filename, 'utf8'));
const save = (filename, value) => writeFileSync(filename, JSON.stringify(value, null, 2) + '\n');
const metadata = json(path.join(installation, 'compiler-build.json'));
const report = {
  revision: metadata.revision,
  package: installation,
  evidence: work,
  checks: [],
  commands: [],
  ok: false,
};
console.log('PINNED_AST_EVIDENCE', work);

function run(name, args, expected = 0) {
  const result = spawnSync(process.execPath, args, {
    cwd: work,
    encoding: 'utf8',
    timeout: 180_000,
    maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '' },
  });
  writeFileSync(path.join(work, name + '.stdout.log'), result.stdout ?? '');
  writeFileSync(path.join(work, name + '.stderr.log'), result.stderr ?? '');
  report.commands.push({
    name,
    args,
    status: result.status,
    signal: result.signal,
    error: result.error?.message,
  });
  assert.equal(result.error, undefined, name);
  assert.equal(result.status, expected, name + ': ' + result.stderr + result.stdout);
  return result.stdout;
}

// Copy actual installed runtime packages, including their declared dependency
// closure, into this independent consumer. No source-tree symlinks are created.
const copied = new Map();
function copyRuntimePackage(name, from) {
  const require = createRequire(from);
  let directory = path.dirname(realpathSync(require.resolve(name)));
  while (
    !existsSync(path.join(directory, 'package.json')) ||
    json(path.join(directory, 'package.json')).name !== name
  ) {
    const parent = path.dirname(directory);
    assert.notEqual(parent, directory, 'Cannot locate installed package: ' + name);
    directory = parent;
  }
  const manifest = json(path.join(directory, 'package.json'));
  if (copied.has(name)) {
    assert.equal(copied.get(name), manifest.version, 'Conflicting consumer package versions');
    return;
  }
  copied.set(name, manifest.version);
  cpSync(directory, path.join(consumer, 'node_modules', name), {
    recursive: true,
    dereference: true,
    filter: (filename) => path.basename(filename) !== 'node_modules',
  });
  for (const dependency of Object.keys(manifest.dependencies ?? {}))
    copyRuntimePackage(dependency, path.join(directory, 'package.json'));
}

try {
  assert.equal(metadata.schema, 'proto-ui.compiler-package.v3');
  assert.match(metadata.revision, /^[0-9a-f]{40}$/);
  const packageManifest = json(path.join(installation, 'package.json'));
  assert.equal(packageManifest.exports['./runtime'], undefined);
  assert.equal(packageManifest.exports['./kernel-host'], './kernel-host.js');
  for (const entry of metadata.files) {
    const content = readFileSync(path.join(installation, entry.path));
    assert.equal(content.length, entry.bytes, entry.path);
    assert.equal(hash(content), entry.sha256, entry.path);
  }
  assert.equal(
    hash(readFileSync(path.join(installation, 'profiles.json'))),
    metadata.profilesSha256
  );
  assert.equal(
    hash(JSON.stringify(metadata.nativeSources, null, 2) + '\n'),
    metadata.nativeSourcesSha256
  );
  for (const name of [
    'native/llvm-builder.cpp',
    'native/rust-builder/Cargo.toml',
    'native/rust-builder/Cargo.lock',
    'native/rust-builder/src/main.rs',
  ]) {
    assert.ok(
      metadata.files.some((file) => file.path === name),
      'Missing packaged native source: ' + name
    );
  }
  assert.ok(
    metadata.files.every(
      (file) => !file.path.includes('/target/') && !file.path.includes('/test-support/')
    )
  );
  report.checks.push('package file hashes and native source inventory');

  const buildInfo = JSON.parse(
    run('build-info', [path.join(installation, 'cli.js'), '--build-info'])
  );
  assert.deepEqual(buildInfo, metadata);
  const info = JSON.parse(run('cli-info', [path.join(installation, 'cli.js'), 'info']));
  assert.deepEqual(info.targets, ['react', 'gpui', 'kernel', 'ir']);
  run('invalid-command', [path.join(installation, 'cli.js'), 'unknown-command'], 2);
  report.checks.push('plain-Node CLI result handling and actual build metadata');

  mkdirSync(authoring);
  mkdirSync(consumer);
  for (const name of ['core', 'types']) {
    cpSync(
      path.join(sourceRoot, 'packages', name, 'src'),
      path.join(authoring, 'packages', name, 'src'),
      { recursive: true }
    );
  }
  save(path.join(authoring, 'tsconfig.json'), {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      strict: true,
      skipLibCheck: true,
      baseUrl: '.',
      paths: {
        '@proto.ui/core': ['packages/core/src/index.ts'],
        '@proto.ui/types': ['packages/types/src/index.ts'],
      },
    },
  });
  const entry = path.join(authoring, 'entry.proto.ts');
  cpSync(fileURLToPath(new URL('./fixtures/pinned-counter.proto.ts', import.meta.url)), entry);
  const api = await import(pathToFileURL(compilerEntry).href);
  assert.equal(
    'compilerBuildIdentity' in api,
    false,
    'Do not impersonate the removed historical API'
  );
  const compiler = api.createCompiler({ rootDir: authoring });
  const result = compiler.compileFile(entry, { target: 'react' });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.deepEqual(result.value.primary.react.dependencies, ['react']);
  assert.equal(result.value.llvm.emitted, false);
  const target = result.value.primary.react;
  const ts = createRequire(path.join(installation, 'package.json'))('typescript');
  const syntax = ts.createSourceFile(
    'artifact.tsx',
    target.code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  assert.deepEqual(
    syntax.statements.filter(ts.isImportDeclaration).map((node) => node.moduleSpecifier.text),
    ['react']
  );
  const emitted = ts.transpileModule(target.code, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    reportDiagnostics: true,
  });
  assert.deepEqual(emitted.diagnostics, []);
  const generated = path.join(consumer, 'generated');
  const cliResult = JSON.parse(
    run('cli-compile', [
      path.join(installation, 'cli.js'),
      'compile',
      entry,
      '--root',
      authoring,
      '--target',
      'react',
      '--out',
      generated,
      '--json',
    ])
  );
  assert.equal(cliResult.ok, true);
  assert.equal(
    readFileSync(path.join(generated, target.componentName + '.tsx'), 'utf8'),
    target.code
  );
  const runtimeRequireFrom = path.join(sourceRoot, 'packages/compiler/package.json');
  copyRuntimePackage('react', runtimeRequireFrom);
  copyRuntimePackage('react-dom', runtimeRequireFrom);
  save(path.join(consumer, 'package.json'), {
    private: true,
    type: 'module',
    dependencies: Object.fromEntries(copied),
  });
  const compiled = path.join(consumer, 'component.mjs');
  writeFileSync(compiled, emitted.outputText);
  const Component = (await import(pathToFileURL(compiled).href)).default;
  const require = createRequire(path.join(consumer, 'package.json'));
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  assert.equal(
    renderToStaticMarkup(React.createElement(Component)),
    '<div><div>Count:0</div></div>'
  );
  assert.equal(
    renderToStaticMarkup(React.createElement(Component, { label: 'Actual:' })),
    '<div><div>Actual:0</div></div>'
  );
  report.checks.push(
    'source → packaged compiler API/CLI → native React artifact → ordinary React consumer'
  );
  report.consumerDependencies = Object.fromEntries(copied);

  if (flags.has('--llvm')) {
    const kernelEntry = path.join(authoring, 'kernel.proto.ts');
    cpSync(
      fileURLToPath(new URL('./fixtures/pinned-kernel.proto.ts', import.meta.url)),
      kernelEntry
    );
    const kernel = compiler.compileFile(kernelEntry, {
      target: 'kernel',
      llvm: { verify: true, emitWasm: true },
    });
    assert.equal(kernel.ok, true, JSON.stringify(kernel.diagnostics));
    assert.equal(kernel.value.llvm.verified, true);
    assert.match(kernel.value.llvm.ir, /fneg double/);
    writeFileSync(path.join(work, 'module.ll'), kernel.value.llvm.ir);
    assert.ok(kernel.value.llvm.wasm instanceof Uint8Array);
    writeFileSync(path.join(work, 'module.wasm'), kernel.value.llvm.wasm);
    const { instantiateWasmKernel } = await import(
      pathToFileURL(path.join(installation, 'kernel-host.js')).href
    );
    const host = await instantiateWasmKernel(kernel.value.llvm.wasm);
    assert.equal(typeof host.exports.helper_negate, 'function');
    assert.ok(Object.is(host.exports.helper_negate(0), -0));
    assert.ok(Object.is(host.exports.helper_negate(-0), 0));
    assert.ok(Number.isNaN(host.exports.helper_negate(NaN)));
    host.exports.pinned_scalar_kernel_init_state(host.statesPtr);
    assert.equal(host.getStateF64(0), 0);
    host.setStateF64(0, 7);
    assert.equal(host.getStateF64(0), 7);
    assert.throws(() => host.setStateF64(1, 9), RangeError);
    report.checks.push(
      'packaged LLVM IRBuilder → verified module → actual WASM execution through the separately packaged bounded kernel host'
    );
  }
  if (flags.has('--gpui')) {
    const gpui = compiler.compileFile(entry, { target: 'gpui' });
    assert.equal(gpui.ok, true, JSON.stringify(gpui.diagnostics));
    const target = gpui.value.primaryGpui.gpui;
    assert.equal(target.backend, 'syn-prettyplease');
    assert.match(target.code, /impl gpui::Render for/);
    writeFileSync(path.join(work, 'component.rs'), target.code);
    writeFileSync(path.join(work, 'Cargo.toml'), target.cargoToml);
    report.checks.push('packaged locked Rust syntax builder emitted a native GPUI component');
  }
  report.ok = true;
} catch (error) {
  report.error = error instanceof Error ? error.stack : String(error);
  process.exitCode = 1;
} finally {
  save(path.join(work, 'summary.json'), report);
  console.log(JSON.stringify(report, null, 2));
}
