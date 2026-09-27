/**
 * Paired Adapter/generated Button smoke in an isolated packed consumer (React 19 / happy-dom).
 * Both paths run independent contract checks and a trace comparison. This is synthetic input,
 * not native-browser, retained-owner, layout, or full compiler/Adapter parity evidence.
 * Run with node --import tsx; PACKED_DIR points to the release pack's tarballs/ directory.
 * Command output and closure.json are retained on every run. Failed consumers are retained;
 * KEEP_PACKED_CONSUMER=1 also retains successful installs for independent inspection.
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compilePrototype } from '../../packages/compiler/src/index.ts';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const packedDir = path.resolve(
  process.env.PACKED_DIR ?? path.join(tmpdir(), 'proto-compiler-packed', 'tarballs')
);
const releaseDir = path.dirname(packedDir);
const workDir = mkdtempSync(path.join(tmpdir(), 'proto-compiler-packed-generated-'));
const consumerDir = path.join(workDir, 'consumer');
let succeeded = false;
console.log(`PACKED_CONSUMER_EVIDENCE: ${workDir}`);

function run(name, command, args) {
  const result = spawnSync(command, args, {
    cwd: consumerDir,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  writeFileSync(path.join(workDir, `${name}.stdout.log`), result.stdout ?? '');
  writeFileSync(path.join(workDir, `${name}.stderr.log`), result.stderr ?? '');
  writeFileSync(
    path.join(workDir, `${name}.result.json`),
    JSON.stringify(
      { command, args, status: result.status, signal: result.signal, error: result.error?.message },
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

function runNpm(name, args) {
  if (process.platform !== 'win32') return run(name, 'npm', args);
  // Windows npm is a .cmd shim, which spawnSync cannot execute without a shell.
  // Invoke its CLI through the current Node instead of shell-interpreting arguments.
  const npmCli = path.join(
    path.dirname(process.execPath),
    'node_modules',
    'npm',
    'bin',
    'npm-cli.js'
  );
  if (!existsSync(npmCli)) throw new Error(`npm CLI missing beside Node: ${npmCli}`);
  return run(name, process.execPath, [npmCli, ...args]);
}

try {
  const source = readFileSync(
    path.join(repoRoot, 'packages/prototypes/base/src/button/button.proto.ts'),
    'utf8'
  );
  const compilation = compilePrototype(source, {
    fileName: 'button.proto.ts',
    componentName: 'GeneratedButton',
  });
  if (!compilation.ok) throw new Error(JSON.stringify(compilation.diagnostics));
  mkdirSync(path.join(consumerDir, 'src'), { recursive: true });
  writeFileSync(
    path.join(consumerDir, 'src', 'GeneratedButton.tsx'),
    compilation.value.output.code
  );

  // Follow the release consumer convention: collect internal dependency, peer and optional
  // edges from staged manifests; external packages remain registry-resolved dependencies.
  const manifest = JSON.parse(readFileSync(path.join(releaseDir, 'pack-manifest.json'), 'utf8'));
  const packageByName = new Map(manifest.packages.map((pkg) => [pkg.name, pkg]));
  const closure = new Set();
  const queue = [
    '@proto.ui/core',
    '@proto.ui/hooks',
    '@proto.ui/adapter-react',
    '@proto.ui/prototypes-base',
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
    for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const dependency of Object.keys(staged[field] ?? {})) {
        if (dependency.startsWith('@proto.ui/')) queue.push(dependency);
      }
    }
  }
  const internalDependencies = Object.fromEntries(
    [...closure].sort().map((name) => {
      const tarball = path.join(packedDir, path.basename(packageByName.get(name).tarball));
      if (!existsSync(tarball)) throw new Error(`missing packed tarball: ${tarball}`);
      return [name, `file:${tarball}`];
    })
  );
  const packageJson = {
    name: 'proto-compiler-packed-generated-smoke',
    private: true,
    type: 'module',
    dependencies: { ...internalDependencies, react: '19.2.6', 'react-dom': '19.2.6' },
    devDependencies: { '@happy-dom/global-registrator': '20.11.0', tsx: '4.21.0' },
  };
  writeFileSync(
    path.join(consumerDir, 'package.json'),
    JSON.stringify(packageJson, null, 2) + '\n'
  );
  runNpm('install', ['install', '--no-audit', '--no-fund']);
  runNpm('installed-tree', ['ls', '--all', '--json']);

  // Lockfile entries alone may include uninstalled platform-specific optionals. Report only
  // actual on-disk packages; verify real paths and tarball resolution, not merely URL text.
  const lock = JSON.parse(readFileSync(path.join(consumerDir, 'package-lock.json'), 'utf8'));
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
    if (
      internal &&
      (!closure.has(pkg.name) ||
        pkg.version !== manifest.releaseVersion ||
        !entry.resolved?.startsWith('file:') ||
        !entry.resolved.endsWith('.tgz'))
    ) {
      throw new Error(`unexpected internal resolution at ${location}: ${entry.resolved}`);
    }
    installed[internal ? 'internal' : 'external'].push({
      name: pkg.name,
      version: pkg.version,
      location,
      resolved: entry.resolved ?? null,
      integrity: entry.integrity ?? null,
    });
  }
  const installedNames = [...new Set(installed.internal.map((entry) => entry.name))].sort();
  if (JSON.stringify(installedNames) !== JSON.stringify([...closure].sort()))
    throw new Error('installed internal package set differs from declared closure');
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
  succeeded = true;
  console.log('PACKED_PAIRED_SMOKE_PASS (bounded React Button; not native-browser/full parity)');
} catch (error) {
  writeFileSync(path.join(workDir, 'failure.txt'), error.stack ?? String(error));
  console.error(`PACKED_CONSUMER_FAILED: consumer and exact output retained at ${workDir}`);
  throw error;
} finally {
  if (succeeded && process.env.KEEP_PACKED_CONSUMER !== '1')
    rmSync(consumerDir, { recursive: true, force: true });
}
