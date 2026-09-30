/**
 * One-sided generated Button smoke in an isolated packed consumer (React 19 / happy-dom).
 * No Adapter baseline runs here: this is NOT differential, native-browser or layout evidence.
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
console.log(`GENERATED_SMOKE_EVIDENCE: ${workDir}`);

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
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${name} exited with ${result.status}; output retained in ${workDir}`);
  return result;
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
  const queue = ['@proto.ui/core', '@proto.ui/hooks', '@proto.ui/adapter-react'];
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
  run('install', 'npm', ['install', '--no-audit', '--no-fund']);
  run('installed-tree', 'npm', ['ls', '--all', '--json']);

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
  console.log('INSTALLED_INTERNAL:', JSON.stringify(installed.internal));
  console.log('INSTALLED_EXTERNAL (including smoke tooling):', JSON.stringify(installed.external));
  console.log('CLOSURE_OK: actual internal packages use packed tarballs, no escaping links');

  const smoke = `
import { GlobalRegistrator } from '@happy-dom/global-registrator';
GlobalRegistrator.register();
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = await import('react');
const ReactDOMClient = await import('react-dom/client');
const { createComponent } = await import('./src/GeneratedButton.tsx');
const component = createComponent({ schedule: (task) => task() });
let clicks = 0;
const onClick = () => { clicks += 1; };
const ref = React.createRef();
const container = document.createElement('div');
document.body.appendChild(container);
const root = ReactDOMClient.createRoot(container);
const render = async (props) => React.act(async () => { root.render(React.createElement(component, { children: 'Activate', onClick, ref, ...props })); });
const target = () => {
  const element = container.querySelector('[data-pui-root]');
  if (!element) throw new Error('no root element');
  return element;
};
const click = async () => React.act(async () => { target().dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })); });
try {
  await render({ disabled: false });
  if (target().getAttribute('role') !== 'button') throw new Error('missing button role');
  await click();
  if (clicks !== 1) throw new Error('expected exactly one click, got ' + clicks);
  await render({ disabled: true });
  await click();
  if (clicks !== 1) throw new Error('disabled click leaked through: ' + clicks);
  if (ref.current?.getExposes?.().disabled?.get() !== true) throw new Error('disabled state not exposed');
  await render({});
  if (ref.current?.getExposes?.().disabled?.get() !== false) throw new Error('omission did not restore enabled default');
  await click();
  if (clicks !== 2) throw new Error('activation after omission failed: ' + clicks);
} finally {
  await React.act(async () => { root.unmount(); });
  container.remove();
}
console.log('GENERATED_BEHAVIOR_OK role/click/disabled/exposes/omission; happy-dom synthetic input');
`;
  writeFileSync(path.join(consumerDir, 'smoke.mjs'), smoke);
  const result = run('generated-runtime', process.execPath, ['--import', 'tsx', 'smoke.mjs']);
  // React warnings are emitted to stderr; do not treat a zero exit with warnings as success.
  if (result.stderr.trim())
    throw new Error('generated runtime emitted warnings/errors; see generated-runtime.stderr.log');
  succeeded = true;
  console.log('PACKED_GENERATED_SMOKE_PASS (one-sided; not Adapter/generated differential parity)');
} catch (error) {
  writeFileSync(path.join(workDir, 'failure.txt'), error.stack ?? String(error));
  console.error(`GENERATED_SMOKE_FAILED: consumer and exact output retained at ${workDir}`);
  throw error;
} finally {
  if (succeeded && process.env.KEEP_PACKED_CONSUMER !== '1')
    rmSync(consumerDir, { recursive: true, force: true });
}
