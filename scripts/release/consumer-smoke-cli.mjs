import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

import { getAllPackages, ROOT_DIR, selectPackages } from './lib.mjs';
import { readVersion } from './version-utils.mjs';

const RENDER_FIXTURE_DIR = join(ROOT_DIR, 'packages', 'cli', 'test', 'smoke-render');
const CONSUMER_FIXTURE_DIR = join(ROOT_DIR, 'scripts', 'release', 'consumer-smoke');
const RELEASE_ROOTS = [
  '@proto.ui/cli',
  '@proto.ui/adapter-react',
  '@proto.ui/adapter-vue',
  '@proto.ui/adapter-web-component',
  '@proto.ui/prototypes-base',
  '@proto.ui/prototypes-shadcn',
];

const workDir = mkdtempSync(join(tmpdir(), 'proto-ui-cli-consumer-'));
const releaseDir = join(workDir, 'release');
const consumerDir = join(workDir, 'consumer');
let succeeded = false;

try {
  run(process.execPath, [
    join(ROOT_DIR, 'scripts', 'release', 'publish.mjs'),
    '--pack',
    '--out-dir',
    releaseDir,
  ]);

  const packManifest = JSON.parse(readFileSync(join(releaseDir, 'pack-manifest.json'), 'utf8'));
  const releaseVersion = readVersion().raw;
  const expectedPackages = selectPackages(getAllPackages())
    .map((pkg) => pkg.name)
    .sort();
  const packedPackages = packManifest.packages.map((pkg) => pkg.name).sort();

  assert(packManifest.releaseVersion === releaseVersion, 'pack manifest release version drifted');
  assert(
    JSON.stringify(packedPackages) === JSON.stringify(expectedPackages),
    `packed package set drifted: expected ${expectedPackages.length}, got ${packedPackages.length}`
  );

  mkdirSync(consumerDir, { recursive: true });
  const packageByName = new Map(packManifest.packages.map((pkg) => [pkg.name, pkg]));
  const consumerPackageNames = collectDeclaredClosure(RELEASE_ROOTS, packageByName);
  const protoDependencies = Object.fromEntries(
    consumerPackageNames.map((name) => {
      const entry = packageByName.get(name);
      const tarballPath = join(releaseDir, entry.tarball);
      assert(existsSync(tarballPath), `missing packed tarball for ${name}`);
      return [name, toFileSpec(relative(consumerDir, tarballPath))];
    })
  );

  writeFileSync(
    join(consumerDir, 'package.json'),
    `${JSON.stringify(
      {
        name: 'proto-ui-cli-consumer-smoke',
        private: true,
        version: '0.0.0',
        type: 'module',
        dependencies: {
          ...protoDependencies,
          '@happy-dom/global-registrator': '20.11.0',
          '@types/react': '19.2.14',
          react: '19.2.6',
          'react-dom': '19.2.6',
          tsx: '4.21.0',
          typescript: '5.9.3',
          vue: '3.5.29',
        },
      },
      null,
      2
    )}\n`
  );

  run('npm', ['install', '--no-audit', '--no-fund'], { cwd: consumerDir });
  verifyInstalledRelease({
    consumerDir,
    expectedNames: consumerPackageNames,
    releaseVersion,
  });

  const cli = join(consumerDir, 'node_modules', '@proto.ui', 'cli', 'bin', 'proto-ui.js');
  run(process.execPath, [cli, '--help'], { cwd: consumerDir, quiet: true });
  run(process.execPath, [cli, 'init', '--yes', '--no-interactive'], { cwd: consumerDir });
  for (const [host, component] of [
    ['react', 'shadcn-button'],
    ['react', 'base-button'],
    ['react', 'base-image'],
    ['react', 'shadcn-switch'],
    ['react', 'shadcn-dialog'],
    ['vue', 'shadcn-button'],
    ['vue', 'base-image'],
    ['vue', 'shadcn-switch'],
    ['vue', 'shadcn-dialog'],
    ['wc', 'shadcn-button'],
    ['wc', 'base-image'],
    ['wc', 'shadcn-switch'],
    ['wc', 'shadcn-dialog'],
  ]) {
    run(process.execPath, [cli, 'add', host, component, '--no-install', '--no-interactive'], {
      cwd: consumerDir,
    });
  }

  verifyGeneratedConsumer(consumerDir);
  cpSync(join(CONSUMER_FIXTURE_DIR, 'adapter-types.tsx'), join(consumerDir, 'adapter-types.tsx'));
  cpSync(
    join(CONSUMER_FIXTURE_DIR, 'adapter-types.tsconfig.json'),
    join(consumerDir, 'adapter-types.tsconfig.json')
  );
  run(
    process.execPath,
    [
      join(consumerDir, 'node_modules', 'typescript', 'bin', 'tsc'),
      '-p',
      'adapter-types.tsconfig.json',
    ],
    { cwd: consumerDir }
  );
  for (const renderer of ['react.mjs', 'vue.mjs', 'wc.mjs']) {
    cpSync(join(RENDER_FIXTURE_DIR, renderer), join(consumerDir, renderer));
    run(process.execPath, ['--import', 'tsx', `./${renderer}`], { cwd: consumerDir });
  }

  succeeded = true;
  console.log(
    `release consumer smoke: cli ok (${consumerPackageNames.length}/${expectedPackages.length} packed packages consumed)`
  );
} catch (error) {
  console.error(`release consumer smoke failed; artifacts kept at ${workDir}`);
  throw error;
} finally {
  if (succeeded) rmSync(workDir, { recursive: true, force: true });
}

function collectDeclaredClosure(rootNames, packageByName) {
  const closure = new Set();
  const queue = [...rootNames];
  while (queue.length > 0) {
    const name = queue.shift();
    if (closure.has(name)) continue;
    const entry = packageByName.get(name);
    assert(entry, `release root ${name} is missing from the pack manifest`);
    closure.add(name);

    assert(entry.stage, `pack manifest has no stage path for ${name}`);
    const manifest = JSON.parse(
      readFileSync(join(releaseDir, entry.stage, 'package.json'), 'utf8')
    );
    for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const dependencyName of Object.keys(manifest[field] ?? {})) {
        if (packageByName.has(dependencyName) && !closure.has(dependencyName)) {
          queue.push(dependencyName);
        }
      }
    }
  }
  return [...closure].sort();
}

function verifyInstalledRelease({ consumerDir, expectedNames, releaseVersion }) {
  const packageLock = JSON.parse(readFileSync(join(consumerDir, 'package-lock.json'), 'utf8'));
  const installedProtoEntries = Object.entries(packageLock.packages ?? {}).filter(([key]) =>
    key.startsWith('node_modules/@proto.ui/')
  );
  const installedNames = installedProtoEntries
    .map(([key]) => key.slice('node_modules/'.length))
    .sort();

  assert(
    JSON.stringify(installedNames) === JSON.stringify(expectedNames),
    `installed Proto UI set drifted: expected ${expectedNames.length}, got ${installedNames.length}`
  );
  for (const [key, entry] of installedProtoEntries) {
    const name = key.slice('node_modules/'.length);
    assert(entry.version === releaseVersion, `${name} installed as ${entry.version}`);
    assert(
      typeof entry.resolved === 'string' && !/^https?:/.test(entry.resolved),
      `${name} leaked to a registry resolution: ${entry.resolved ?? '<missing>'}`
    );
  }

  const protoScopeDir = join(consumerDir, 'node_modules', '@proto.ui');
  const installedDirs = readdirSync(protoScopeDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `@proto.ui/${entry.name}`)
    .sort();
  assert(
    JSON.stringify(installedDirs) === JSON.stringify(expectedNames),
    'node_modules Proto UI packages do not match the declared tarball closure'
  );
}

function verifyGeneratedConsumer(root) {
  const config = readFileSync(join(root, 'proto-ui', 'config.json'), 'utf8');
  const tokensCss = readFileSync(
    join(root, 'src', 'styles', 'proto-ui-tokens.generated.css'),
    'utf8'
  );
  const react = readFileSync(join(root, 'proto-ui', 'components', 'react', 'index.ts'), 'utf8');
  const vue = readFileSync(join(root, 'proto-ui', 'components', 'vue', 'index.ts'), 'utf8');
  const wc = readFileSync(join(root, 'proto-ui', 'components', 'wc', 'index.ts'), 'utf8');
  const index = readFileSync(join(root, 'proto-ui', 'components', 'index.ts'), 'utf8');

  for (const expected of [
    '@proto.ui/adapter-react',
    '@proto.ui/adapter-vue',
    '@proto.ui/adapter-web-component',
    'shadcn-button',
    'base-button',
    'base-image',
    'shadcn-switch',
    'shadcn-dialog',
  ]) {
    assert(config.includes(expected), `generated config is missing ${expected}`);
  }
  for (const expected of [
    '@keyframes pui-enter',
    '@keyframes pui-exit',
    '[data-pui-style~="animate-in"]',
    '[data-pui-style~="animate-out"]',
    '[data-pui-style~="fade-in-0"]',
    '[data-pui-style~="fade-out-0"]',
    '[data-pui-style~="zoom-in-95"]',
    '[data-pui-style~="zoom-out-95"]',
  ]) {
    assert(tokensCss.includes(expected), `generated token CSS is missing ${expected}`);
  }
  for (const expected of [
    'createReactAdapter(React)',
    'export const ShadcnButton = adapt(shadcnButton)',
    'export const BaseButton = adapt(button)',
    'export const ShadcnSwitch = React.forwardRef',
    'export const ShadcnDialogContent = React.forwardRef',
    "from '@proto.ui/prototypes-shadcn/button'",
    "from '@proto.ui/prototypes-base/button'",
  ]) {
    assert(react.includes(expected), `generated React facade is missing ${expected}`);
  }
  assert(vue.includes('createVueAdapter(Vue)'), 'generated Vue facade is missing its adapter');
  assert(
    vue.includes('export const ShadcnButton = adapt(shadcnButton)'),
    'generated Vue facade is missing ShadcnButton'
  );
  assert(
    vue.includes('export const ShadcnSwitch = Vue.defineComponent'),
    'generated Vue facade is missing the Switch preset'
  );
  assert(
    vue.includes('export const ShadcnDialogContent = Vue.defineComponent'),
    'generated Vue facade is missing the Dialog Content preset'
  );
  assert(
    wc.includes('AdaptToWebComponent(shadcnButton'),
    'generated Web Component facade is missing ShadcnButton'
  );
  assert(
    wc.includes('export class ShadcnSwitchElement extends ShadcnSwitchRootElement'),
    'generated Web Component facade is missing the Switch preset'
  );
  assert(
    wc.includes('export class ShadcnDialogContentElement extends ShadcnDialogContentRawElement'),
    'generated Web Component facade is missing the Dialog Content preset'
  );
  for (const expected of [
    'ShadcnButton as ReactShadcnButton',
    'BaseButton as ReactBaseButton',
    'ShadcnButton as VueShadcnButton',
    "ShadcnButtonElement } from './wc'",
  ]) {
    assert(index.includes(expected), `generated root facade is missing ${expected}`);
  }
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd ?? ROOT_DIR,
    encoding: 'utf8',
    stdio: options.quiet ? 'ignore' : 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${commandArgs.join(' ')} exited with ${result.status}`);
  }
}

function toFileSpec(path) {
  const normalized = path.replaceAll('\\', '/');
  return `file:${normalized.startsWith('.') ? normalized : `./${normalized}`}`;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
