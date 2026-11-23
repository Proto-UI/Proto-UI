/**
 * Paired Adapter/generated Button smoke in an isolated packed consumer (React 19 / happy-dom).
 * Both paths run independent contract checks and a trace comparison. This is synthetic input,
 * not native-browser, retained-owner, layout, or full compiler/Adapter parity evidence.
 * Run with node --import tsx; PACKED_DIR points to the release pack's tarballs/ directory.
 * NATIVE_CONSUMER_COMPILER selects the installed, source-pinned compiler index.js.
 * Packages are installed only from this consumer's manifest through npm lock -> npm ci.
 * Command output and closure.json are retained on every run. Failed consumers are retained;
 * KEEP_PACKED_CONSUMER=1 also retains successful installs for independent inspection.
 */
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const packedDir = path.resolve(
  process.env.PACKED_DIR ?? path.join(tmpdir(), 'proto-compiler-packed', 'tarballs')
);
const releaseDir = path.dirname(packedDir);
const workDir = mkdtempSync(path.join(tmpdir(), 'proto-compiler-packed-generated-'));
const consumerDir = path.join(workDir, 'consumer');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const save = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const profile = 'react-runtime-v1';
const summary = {
  schema: 'proto-ui.packed-generated-consumer.v1',
  profile,
  compiler: process.env.NATIVE_CONSUMER_COMPILER ?? 'checkout-source',
  compilerBuild: null,
  sourceRoot: repoRoot,
  dependencyMode: 'declared-tarballs-and-registry-lock-ci',
  surface: 'Paired real React mounts in Happy DOM; not native-browser/full parity',
  ok: false,
};
let succeeded = false;
console.log(`PACKED_CONSUMER_EVIDENCE: ${workDir}`);

function run(name, command, args) {
  const started = performance.now();
  const env = { ...process.env, NODE_PATH: '', NODE_OPTIONS: '' };
  delete env.TSX_TSCONFIG_PATH;
  const result = spawnSync(command, args, {
    cwd: consumerDir,
    env,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    timeout: 180000,
  });
  writeFileSync(path.join(workDir, `${name}.stdout.log`), result.stdout ?? '');
  writeFileSync(path.join(workDir, `${name}.stderr.log`), result.stderr ?? '');
  writeFileSync(
    path.join(workDir, `${name}.result.json`),
    JSON.stringify(
      {
        command,
        args,
        cwd: consumerDir,
        wallMs: performance.now() - started,
        status: result.status,
        signal: result.signal,
        error: result.error?.message ?? null,
        environment: { NODE_PATH: '', NODE_OPTIONS: '', TSX_TSCONFIG_PATH: null },
      },
      null,
      2
    )
  );
  // The complete npm tree is kept in the evidence directory, not dumped into CI logs.
  if (name !== 'installed-tree') {
    process.stdout.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
  }
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${name} exited with ${result.status}; output retained in ${workDir}`);
  return result;
}

function payload(directory) {
  const digest = createHash('sha256');
  let files = 0;
  let bytes = 0;
  function visit(current) {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    )) {
      if (entry.name === 'node_modules') continue;
      const file = path.join(current, entry.name);
      const relative = path.relative(realpathSync(consumerDir), realpathSync(file));
      assert.ok(
        !relative.startsWith('..') && !path.isAbsolute(relative),
        `Escaping installed payload: ${file}`
      );
      if (entry.isDirectory()) visit(file);
      else {
        assert.ok(entry.isFile(), `Non-regular installed payload: ${file}`);
        const content = readFileSync(file);
        files += 1;
        bytes += content.length;
        digest.update(
          JSON.stringify([
            path.relative(directory, file).split(path.sep).join('/'),
            content.length,
            hash(content),
          ])
        );
      }
    }
  }
  visit(directory);
  return { files, bytes, treeSha256: digest.digest('hex') };
}

function runNpm(name, args) {
  if (process.platform !== 'win32') return run(name, 'npm', args);
  // Windows npm is a .cmd shim, which spawnSync cannot execute without a shell.
  // Find its CLI beside Node or in a PATH installation without shell expansion.
  const npmCli = [path.dirname(process.execPath), ...(process.env.PATH ?? '').split(path.delimiter)]
    .filter(Boolean)
    .map((directory) => path.join(directory, 'node_modules', 'npm', 'bin', 'npm-cli.js'))
    .find((candidate) => existsSync(candidate));
  if (!npmCli) throw new Error('npm CLI not found beside Node or on PATH');
  return run(name, process.execPath, [npmCli, ...args]);
}

try {
  const compiler = await import(
    process.env.NATIVE_CONSUMER_COMPILER
      ? pathToFileURL(path.resolve(process.env.NATIVE_CONSUMER_COMPILER)).href
      : new URL('../../packages/compiler/src/index.ts', import.meta.url).href
  );
  summary.compilerBuild = compiler.compilerBuildIdentity;
  summary.sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();
  if (process.env.NATIVE_CONSUMER_COMPILER) {
    assert.equal(
      compiler.compilerBuildIdentity?.revision,
      summary.sourceRevision,
      'Pinned compiler and authored source must use the same final revision'
    );
    assert.equal(
      execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], {
        cwd: repoRoot,
        encoding: 'utf8',
      }).trim(),
      '',
      'Pinned consumer proof requires clean source'
    );
  }
  const entry = 'packages/prototypes/base/src/button/button.proto.ts';
  const compilation = await compiler.compileFile(entry, {
    root: repoRoot,
    profile,
    componentName: 'GeneratedButton',
  });
  save(path.join(workDir, 'compilation-result.json'), {
    ok: compilation.ok,
    diagnostics: compilation.diagnostics ?? [],
  });
  if (!compilation.ok) throw new Error(JSON.stringify(compilation.diagnostics));
  assert.equal(compilation.value.output.profile, profile);
  const artifacts = compiler.compilationArtifacts(compilation.value, {
    sourcePath: 'GeneratedButton.tsx',
  });
  mkdirSync(consumerDir);
  const written = await compiler.writeArtifactSet(artifacts, path.join(consumerDir, 'src'));
  if (!written.ok) throw new Error(JSON.stringify(written.diagnostics));
  summary.compilation = {
    entry,
    sourceGraphSha256: compilation.value.ir.source.sha256,
    sourceFiles: compilation.value.ir.sourceFiles.map(({ file, sha256 }) => ({ file, sha256 })),
    profile: compilation.value.output.profile,
    dependencies: compilation.value.output.dependencies,
    artifacts: artifacts.map(({ path, kind, contents }) => ({
      path,
      kind,
      sha256: hash(contents),
    })),
  };

  // Follow the release consumer convention: collect internal dependency, peer and optional
  // edges from staged manifests; external packages remain registry-resolved dependencies.
  const manifest = JSON.parse(readFileSync(path.join(releaseDir, 'pack-manifest.json'), 'utf8'));
  summary.pack = {
    releaseDir,
    releaseVersion: manifest.releaseVersion,
    manifestSha256: hash(readFileSync(path.join(releaseDir, 'pack-manifest.json'))),
  };
  const packageByName = new Map(manifest.packages.map((pkg) => [pkg.name, pkg]));
  const targetDependencies = Object.fromEntries(
    compilation.value.output.dependencies.map(({ name, version }) => [name, version])
  );
  for (const [name, version] of Object.entries(targetDependencies)) {
    if (name.startsWith('@proto.ui/')) {
      assert.equal(
        packageByName.get(name)?.version,
        version,
        `Generated dependency ${name}@${version} does not match the packed version; never silently substitute versions`
      );
    }
  }
  const closure = new Set();
  const queue = [
    '@proto.ui/core',
    '@proto.ui/hooks',
    '@proto.ui/adapter-react',
    '@proto.ui/prototypes-base',
    ...Object.keys(targetDependencies).filter((name) => name.startsWith('@proto.ui/')),
  ];
  while (queue.length) {
    const name = queue.shift();
    if (closure.has(name)) continue;
    const entry = packageByName.get(name);
    if (!entry) throw new Error(`internal closure package ${name} missing from pack manifest`);
    closure.add(name);
    const staged = JSON.parse(
      readFileSync(path.join(releaseDir, entry.stage, 'package.json'), 'utf8')
    );
    assert.equal(staged.name, name);
    assert.equal(staged.version, manifest.releaseVersion);
    for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const dependency of Object.keys(staged[field] ?? {})) {
        if (dependency.startsWith('@proto.ui/')) queue.push(dependency);
      }
    }
  }
  const expectedTarballs = new Map();
  const internalDependencies = Object.fromEntries(
    [...closure].sort().map((name) => {
      const record = packageByName.get(name);
      const tarball = path.resolve(releaseDir, record.tarball);
      if (!existsSync(tarball)) throw new Error(`missing packed tarball: ${tarball}`);
      if (path.dirname(realpathSync(tarball)) !== realpathSync(packedDir))
        throw new Error(`packed tarball outside selected directory: ${name}`);
      const integrity = `sha512-${createHash('sha512').update(readFileSync(tarball)).digest('base64')}`;
      if (integrity !== record.integrity)
        throw new Error(`staged tarball integrity mismatch: ${name}`);
      expectedTarballs.set(name, { path: realpathSync(tarball), integrity });
      return [name, `file:${tarball}`];
    })
  );
  const packageJson = {
    name: 'proto-compiler-packed-generated-smoke',
    private: true,
    type: 'module',
    dependencies: {
      ...Object.fromEntries(
        Object.entries(targetDependencies).filter(([name]) => !name.startsWith('@proto.ui/'))
      ),
      ...internalDependencies,
    },
    devDependencies: { '@happy-dom/global-registrator': '20.11.0', tsx: '4.21.0' },
  };
  writeFileSync(
    path.join(consumerDir, 'package.json'),
    JSON.stringify(packageJson, null, 2) + '\n'
  );
  assert.equal(packageJson.dependencies.react, '19.2.6');
  assert.equal(packageJson.dependencies['react-dom'], '19.2.6');
  assert.equal(existsSync(path.join(consumerDir, 'node_modules')), false);
  const config = path.join(consumerDir, '.npmrc');
  const registry = 'https://registry.npmjs.org/';
  writeFileSync(config, `registry=${registry}\naudit=false\nfund=false\n`);
  const options = [
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--global=false',
    '--workspaces=false',
    '--registry',
    registry,
    '--cache',
    path.join(consumerDir, '.npm-cache'),
    '--userconfig',
    config,
  ];
  runNpm('registry-lock', ['install', '--package-lock-only', ...options]);
  assert.equal(
    existsSync(path.join(consumerDir, 'node_modules')),
    false,
    'Lock generation must not install packages'
  );
  runNpm('registry-ci', ['ci', ...options]);
  runNpm('installed-tree', ['ls', '--all', '--json', '--global=false', '--workspaces=false']);
  summary.install = {
    registry,
    manifestSha256: hash(readFileSync(path.join(consumerDir, 'package.json'))),
    lockSha256: hash(readFileSync(path.join(consumerDir, 'package-lock.json'))),
    installScripts: false,
  };

  // Lockfile entries alone may include uninstalled platform-specific optionals. Report only
  // actual on-disk packages; verify real paths and tarball resolution, not merely URL text.
  const lock = JSON.parse(readFileSync(path.join(consumerDir, 'package-lock.json'), 'utf8'));
  const verifyInternal = (entry, pkg, location) => {
    if (!pkg.name.startsWith('@proto.ui/')) return;
    const expected = expectedTarballs.get(pkg.name);
    if (
      !closure.has(pkg.name) ||
      pkg.version !== manifest.releaseVersion ||
      !entry.resolved?.startsWith('file:') ||
      realpathSync(path.resolve(consumerDir, entry.resolved.slice('file:'.length))) !==
        expected?.path ||
      entry.integrity !== expected?.integrity
    ) {
      throw new Error(`unexpected internal resolution or integrity at ${location}`);
    }
  };
  const installed = { internal: [], external: [] };
  for (const [location, entry] of Object.entries(lock.packages)) {
    if (!location) continue;
    const directory = path.join(consumerDir, location);
    if (!existsSync(directory)) continue;
    const relative = path.relative(realpathSync(consumerDir), realpathSync(directory));
    if (entry.link || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`linked package escapes isolated consumer: ${location}`);
    }
    const pkg = JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8'));
    if (entry.version !== pkg.version) throw new Error(`installed version mismatch at ${location}`);
    const internal = pkg.name.startsWith('@proto.ui/');
    verifyInternal(entry, pkg, location);
    installed[internal ? 'internal' : 'external'].push({
      name: pkg.name,
      version: pkg.version,
      location,
      resolved: entry.resolved ?? null,
      integrity: entry.integrity ?? null,
      ...payload(directory),
    });
  }
  const installedNames = [...new Set(installed.internal.map((entry) => entry.name))].sort();
  for (const [name, version] of Object.entries({
    ...targetDependencies,
    ...packageJson.devDependencies,
  })) {
    const actual = [...installed.internal, ...installed.external].find(
      (pkg) => pkg.location === `node_modules/${name}`
    );
    assert.equal(
      actual?.version,
      version,
      `Installed direct dependency ${name} does not match its declared version`
    );
  }
  if (JSON.stringify(installedNames) !== JSON.stringify([...closure].sort()))
    throw new Error('installed internal package set differs from declared closure');
  const control = installed.internal[0];
  const other = installed.internal.find((entry) => entry.name !== control?.name);
  if (!control || !other) throw new Error('too few internal packages for resolution control');
  const controlEntry = lock.packages[control.location];
  const controlPackage = JSON.parse(
    readFileSync(path.join(consumerDir, control.location, 'package.json'), 'utf8')
  );
  for (const mutation of [{ resolved: other.resolved }, { integrity: other.integrity }]) {
    let rejected = false;
    try {
      verifyInternal({ ...controlEntry, ...mutation }, controlPackage, control.location);
    } catch {
      rejected = true;
    }
    if (!rejected) throw new Error('internal tarball provenance negative control was accepted');
  }
  console.log('PACKED_CLOSURE_MUTANTS_REJECTED: wrong tarball and wrong integrity');
  writeFileSync(path.join(workDir, 'closure.json'), JSON.stringify(installed, null, 2) + '\n');
  console.log('INSTALLED_INTERNAL:', installed.internal.length, installedNames.join(', '));
  console.log('INSTALLED_EXTERNAL (including smoke tooling):', installed.external.length);
  console.log('CLOSURE_OK: actual internal packages use packed tarballs, no escaping links');

  const smoke = `
import { GlobalRegistrator } from '@happy-dom/global-registrator';
GlobalRegistrator.register();
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = await import('react');
const ReactDOMClient = await import('react-dom/client');
const { writeFileSync } = await import('node:fs');
const { button } = await import('@proto.ui/prototypes-base');
const { createReactAdapter } = await import('@proto.ui/adapter-react');
const { createComponent } = await import('./src/GeneratedButton.tsx');
const schedule = { schedule: (task) => task() };
const paths = {
  reference: createReactAdapter(React)(button, schedule),
  candidate: createComponent(schedule),
};
const expected = [
  { step: 'mount', disabled: false, clicks: 0 },
  { step: 'enabled-click', disabled: false, clicks: 1 },
  { step: 'disable', disabled: true, clicks: 1 },
  { step: 'disabled-click', disabled: true, clicks: 1 },
  { step: 'omit-disabled', disabled: false, clicks: 1 },
  { step: 'restored-click', disabled: false, clicks: 2 },
];
const traces = {};
for (const [name, component] of Object.entries(paths)) {
  let clicks = 0;
  const onClick = () => { clicks += 1; };
  const ref = React.createRef();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = ReactDOMClient.createRoot(container);
  const trace = [];
  const render = async (props) => React.act(async () => {
    root.render(React.createElement(component, { children: 'Activate', onClick, ref, ...props }));
  });
  const target = () => {
    const element = container.querySelector('[data-pui-root]');
    if (!element) throw new Error(name + ': no root element');
    return element;
  };
  const click = async () => React.act(async () => {
    target().dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
  });
  const observe = (step) => {
    const element = target();
    const exposes = ref.current?.getExposes?.();
    const entry = {
      step,
      disabled: exposes?.disabled?.get() ?? null,
      clicks,
      role: element.getAttribute('role'),
      ariaDisabled: element.getAttribute('aria-disabled'),
      label: element.textContent,
    };
    trace.push(entry);
    const oracle = expected[trace.length - 1];
    if (entry.step !== oracle?.step || entry.disabled !== oracle.disabled || entry.clicks !== oracle.clicks ||
        entry.role !== 'button' || entry.label !== 'Activate' ||
        entry.ariaDisabled !== (oracle.disabled ? 'true' : 'false')) {
      throw new Error(name + ': independent Button contract failed at ' + step + ': ' + JSON.stringify(entry));
    }
  };
  try {
    await render({ disabled: false }); observe('mount');
    await click(); observe('enabled-click');
    await render({ disabled: true }); observe('disable');
    await click(); observe('disabled-click');
    await render({}); observe('omit-disabled');
    await click(); observe('restored-click');
    traces[name] = trace;
  } finally {
    await React.act(async () => { root.unmount(); });
    container.remove();
  }
}
for (let index = 0; index < expected.length; index++) {
  for (const key of ['step', 'disabled', 'clicks', 'role', 'ariaDisabled', 'label']) {
    if (traces.reference[index][key] !== traces.candidate[index][key])
      throw new Error('paired first difference at ' + expected[index].step + '.' + key +
        ': ' + JSON.stringify([traces.reference[index][key], traces.candidate[index][key]]));
  }
}
writeFileSync('paired-traces.json', JSON.stringify({ expected, traces }, null, 2) + '\\n');
console.log('PACKED_PAIRED_TRACES:', JSON.stringify(traces));
console.log('PACKED_PAIRED_OK six Button checkpoints; happy-dom synthetic input');
`;
  writeFileSync(path.join(consumerDir, 'smoke.mjs'), smoke);
  const result = run('paired-runtime', process.execPath, ['--import', 'tsx', 'smoke.mjs']);
  writeFileSync(
    path.join(workDir, 'paired-traces.json'),
    readFileSync(path.join(consumerDir, 'paired-traces.json'))
  );
  // React warnings are emitted to stderr; do not treat a zero exit with warnings as success.
  if (result.stderr.trim())
    throw new Error('paired runtime emitted warnings/errors; see paired-runtime.stderr.log');
  summary.trace = JSON.parse(readFileSync(path.join(workDir, 'paired-traces.json'), 'utf8'));
  summary.ok = true;
  succeeded = true;
  console.log('PACKED_PAIRED_SMOKE_PASS (bounded React Button; not native-browser/full parity)');
} catch (error) {
  summary.error = error.stack ?? String(error);
  writeFileSync(path.join(workDir, 'failure.txt'), error.stack ?? String(error));
  console.error(`PACKED_CONSUMER_FAILED: consumer and exact output retained at ${workDir}`);
  throw error;
} finally {
  save(path.join(workDir, 'summary.json'), summary);
  if (succeeded && process.env.KEEP_PACKED_CONSUMER !== '1')
    rmSync(consumerDir, { recursive: true, force: true });
}
