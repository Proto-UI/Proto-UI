import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

import { getAllPackages, ROOT_DIR, selectPackages } from './lib.mjs';
import { readVersion } from './version-utils.mjs';
import { runNoStylesConsumer } from './consumer-smoke-no-styles.mjs';
import { decideCheckboxHostAdmission } from './checkbox-host-admission.mjs';

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
const VUE2_RELEASE_ROOTS = [
  '@proto.ui/cli',
  '@proto.ui/adapter-vue2',
  '@proto.ui/prototypes-base',
  '@proto.ui/prototypes-shadcn',
];

// This is the actual existing CI smoke entrypoint; policy controls cannot go uncollected.
run(process.execPath, ['--test', join(ROOT_DIR, 'scripts/release/test/checkbox-host-admission.test.mjs')]);

const workDir = mkdtempSync(join(tmpdir(), 'proto-ui-cli-consumer-'));
const releaseDir = join(workDir, 'release');
const consumerDir = join(workDir, 'consumer');
const vue2ConsumerDir = join(workDir, 'vue2-consumer');
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
    ['wc', 'shadcn-checkbox'],
    ['wc', 'shadcn-label'],
  ]) {
    run(process.execPath, [cli, 'add', host, component, '--no-install', '--no-interactive'], {
      cwd: consumerDir,
    });
  }

  verifyGeneratedConsumer(consumerDir);
  verifyCheckboxCompositionClosure(consumerDir, cli);
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
  cpSync(
    join(ROOT_DIR, 'scripts', 'release', 'consumer-smoke-css.mjs'),
    join(consumerDir, 'consumer-smoke-css.mjs')
  );
  logCheckboxDeliveryEvidence(packManifest, consumerPackageNames, 'prepared-not-yet-executed');
  // Independent outcomes: a native setup/product failure must not hide the
  // existing synthetic explicit-Indicator failure (nor may native success erase it).
  const hostFailures = [];
  let nativeProcess = null;
  let otherHostsPassed = false;
  try {
    for (const name of ['preassembled-ce-order.mjs', 'standalone-ce-order.mjs']) {
      cpSync(join(RENDER_FIXTURE_DIR, name), join(consumerDir, name));
    }
    console.log(JSON.stringify({
      kind: 'standalone-order-diagnostic-source',
      sharedSourceSha256: createHash('sha256').update(readFileSync(join(consumerDir, 'preassembled-ce-order.mjs'))).digest('hex'),
      runnerSha256: createHash('sha256').update(readFileSync(join(consumerDir, 'standalone-ce-order.mjs'))).digest('hex'),
    }));
    run(process.execPath, ['./standalone-ce-order.mjs'], { cwd: consumerDir, timeout: 10000 });
  } catch (error) {
    console.error('standalone order diagnostic collection failed', error);
    hostFailures.push(error);
  }
  try {
    run(process.execPath, [
      join(RENDER_FIXTURE_DIR, 'wc-checkbox-label-native.mjs'),
      consumerDir,
      ROOT_DIR,
    ], { cwd: consumerDir, timeout: 120000 });
    nativeProcess = { status: 0, signal: null, error: null };
    console.log('packed WC native bounded cases: passed');
  } catch (error) {
    console.error('packed WC native bounded cases: failed', error);
    hostFailures.push(error);
  }
  try {
    for (const renderer of ['react.mjs', 'vue.mjs', 'wc.mjs']) {
      cpSync(join(RENDER_FIXTURE_DIR, renderer), join(consumerDir, renderer));
      run(process.execPath, ['--import', 'tsx', `./${renderer}`], { cwd: consumerDir });
    }
    otherHostsPassed = true;
    console.log('packed React/Vue/WC baseline synthetic cases: passed');
  } catch (error) {
    console.error('packed WC synthetic cases: failed', error);
    hostFailures.push(error);
  }
  // Only this invocation has a typed outcome. All other hosts still use run's
  // strict throw, and collection/preparation failures remain blocking.
  let disposition;
  try {
    cpSync(join(RENDER_FIXTURE_DIR, 'wc-checkbox-label.mjs'), join(consumerDir, 'wc-checkbox-label.mjs'));
    const result = spawnSync(process.execPath, ['--import', 'tsx', './wc-checkbox-label.mjs'], {
      cwd: consumerDir, encoding: 'utf8', stdio: 'inherit', env: process.env,
      shell: process.platform === 'win32', timeout: 120000,
    });
    const syntheticProcess = {
      status: result.status, signal: result.signal,
      error: result.error ? { name: result.error.name, code: result.error.code ?? null, message: result.error.message } : null,
    };
    const readReceipt = (name) => {
      const path = join(consumerDir, name);
      return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
    };
    const binding = readReceipt('checkbox-delivery-evidence.json');
    const digest = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
    const expected = {
      testedCommit: binding.testedCommit, releaseVersion: binding.releaseVersion, packages: binding.packages,
      lockSha256: digest(join(consumerDir, 'package-lock.json')),
      generatedFacadeSha256: digest(join(consumerDir, 'proto-ui/components/wc/index.ts')),
      fixtureSha256: digest(join(RENDER_FIXTURE_DIR, 'wc-checkbox-label-native.mjs')),
      originalSyntheticFixtureSha256: digest(join(RENDER_FIXTURE_DIR, 'wc-checkbox-label.mjs')),
      replaySourceSha256: digest(join(RENDER_FIXTURE_DIR, 'wc-checkbox-label-browser-replay.mjs')),
      repoLockSha256: digest(join(ROOT_DIR, 'pnpm-lock.yaml')),
    };
    const input = {
      prepared: hostFailures.length === 0, otherHostsPassed, expected, nativeProcess,
      nativeReceipt: readReceipt('checkbox-label-native-receipt.json'),
      syntheticProcess, syntheticReceipt: readReceipt('checkbox-label-synthetic-receipt.json'),
      syntheticHost: readInstalledSyntheticHostEvidence(),
    };
    disposition = decideCheckboxHostAdmission(input);
    // Full receipts + actual process outcomes survive successful workDir cleanup
    // in the durable CI log, in addition to inherited raw primary/cleanup errors.
    const evidence = { kind: 'checkbox-label-host-admission', ...input, disposition };
    console.log(JSON.stringify(evidence));
    writeFileSync(join(consumerDir, 'checkbox-label-host-admission.json'), JSON.stringify(evidence));
    assert(disposition.admitted, `packed WC host admission failed: ${disposition.reason}`);
  } catch (error) {
    console.error('packed WC synthetic evidence/admission failed', error);
    hostFailures.push(error);
  }
  if (hostFailures.length) throw new AggregateError(hostFailures, 'packed WC host checks failed');

  logCheckboxDeliveryEvidence(
    packManifest,
    consumerPackageNames,
    `packed-types-and-both-native-paths-passed;synthetic=${disposition.synthetic}`
  );
  runNoStylesConsumer({ consumerDir, cli, fixtureDir: join(ROOT_DIR, 'scripts', 'release'), run });

  runVue2Consumer({
    consumerDir: vue2ConsumerDir,
    expectedPackages,
    packageByName,
    releaseVersion,
  });

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

function runVue2Consumer({ consumerDir, expectedPackages, packageByName, releaseVersion }) {
  mkdirSync(consumerDir, { recursive: true });
  const consumerPackageNames = collectDeclaredClosure(VUE2_RELEASE_ROOTS, packageByName);
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
        name: 'proto-ui-cli-vue2-consumer-smoke',
        private: true,
        version: '0.0.0',
        type: 'module',
        dependencies: {
          ...protoDependencies,
          '@happy-dom/global-registrator': '20.11.0',
          tsx: '4.21.0',
          vue: '2.6.14',
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
  run(process.execPath, [cli, 'init', '--yes', '--no-interactive', '--no-styles'], {
    cwd: consumerDir,
  });
  for (const component of ['shadcn-button', 'base-image', 'shadcn-switch', 'shadcn-dialog']) {
    run(process.execPath, [cli, 'add', 'vue2', component, '--no-install', '--no-interactive'], {
      cwd: consumerDir,
    });
  }

  const config = readFileSync(join(consumerDir, 'proto-ui', 'config.json'), 'utf8');
  const facade = readFileSync(
    join(consumerDir, 'proto-ui', 'components', 'vue2', 'index.js'),
    'utf8'
  );
  assert(
    !existsSync(join(consumerDir, 'proto-ui', 'components', 'vue2', 'index.ts')),
    'JavaScript Vue 2 consumer must not retain a TypeScript facade'
  );
  const rootFacade = readFileSync(join(consumerDir, 'proto-ui', 'components', 'index.js'), 'utf8');
  assert(
    rootFacade.includes("from './vue2/index.js'"),
    'JavaScript root facade must reference the generated JavaScript entry'
  );
  assert(config.includes('@proto.ui/adapter-vue2'), 'Vue 2 config is missing its adapter');
  for (const expected of [
    'createVue2Adapter',
    'extend: Vue.extend.bind(Vue)',
    'export const ShadcnButton = adapt(shadcnButton)',
    'export const BaseImageRoot = adapt(imageRoot)',
    'export const ShadcnSwitch = {',
    'export const ShadcnDialogContent = {',
  ]) {
    assert(facade.includes(expected), `generated Vue 2 facade is missing ${expected}`);
  }

  cpSync(
    join(ROOT_DIR, 'scripts', 'release', 'consumer-smoke-css.mjs'),
    join(consumerDir, 'consumer-smoke-css.mjs')
  );
  cpSync(join(RENDER_FIXTURE_DIR, 'vue2.mjs'), join(consumerDir, 'vue2.mjs'));
  run(process.execPath, ['--import', 'tsx', './vue2.mjs'], { cwd: consumerDir });
  console.log(
    `release consumer smoke: vue2 ok (${consumerPackageNames.length}/${expectedPackages.length} packed packages consumed)`
  );
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
    timeout: options.timeout,
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

// Exercise actual installed package resolution in fresh processes. No source
// aliases or custom loader can satisfy these checks, and failed imports cannot
// be hidden by the module cache of the positive host fixture.
function verifyCheckboxCompositionClosure(root, cli) {
  const probe = (source, expectedError = null) => {
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', source], {
      cwd: root,
      encoding: 'utf8',
      env: process.env,
    });
    if (result.error) throw result.error;
    if (expectedError) {
      assert(result.status !== 0, `negative import unexpectedly succeeded: ${source}`);
      assert(
        result.stderr.includes(expectedError),
        `unexpected negative-import failure: ${result.stderr}`
      );
    } else {
      assert(result.status === 0, `installed composition import failed: ${result.stderr}`);
    }
  };
  const positive = `
    import { strict as assert } from 'node:assert';
    import { createShadcnCheckboxLabelComposition, checkboxRoot, checkboxIndicator } from '@proto.ui/prototypes-shadcn/checkbox';
    import { labelRoot } from '@proto.ui/prototypes-shadcn/label';
    const pair = createShadcnCheckboxLabelComposition();
    assert.equal(pair.recipe.parts.control, checkboxRoot);
    assert.equal(pair.recipe.parts.indicator, checkboxIndicator);
    assert.equal(pair.recipe.parts.label, labelRoot);
    assert.equal(pair.control.instanceAssociations, pair.label.instanceAssociations);
  `;
  probe(positive);
  probe(
    "await import('@proto.ui/prototypes-shadcn/not-a-public-export')",
    'ERR_PACKAGE_PATH_NOT_EXPORTED'
  );
  const labelDir = join(root, 'node_modules', '@proto.ui', 'prototypes-shadcn', 'dist', 'label');
  const absentDir = `${labelDir}.negative-control`;
  assert(!existsSync(absentDir), 'negative-control backup already exists');
  renameSync(labelDir, absentDir);
  try {
    probe(positive, 'ERR_MODULE_NOT_FOUND');
  } finally {
    renameSync(absentDir, labelDir);
  }
  probe(positive);

  // These commands must reject before installing or changing the consumer.
  for (const [component, diagnostic] of [
    ['shadcn-field', 'workspace-source-only'],
    ['not-a-component', 'unsupported component'],
  ]) {
    const before = readFileSync(join(root, 'proto-ui', 'config.json'), 'utf8');
    const result = spawnSync(
      process.execPath,
      [cli, 'add', 'wc', component, '--no-install', '--no-interactive'],
      {
        cwd: root,
        encoding: 'utf8',
        env: process.env,
      }
    );
    if (result.error) throw result.error;
    assert(
      result.status !== 0 && `${result.stdout}${result.stderr}`.includes(diagnostic),
      `installed admission did not reject ${component}: ${result.stdout}${result.stderr}`
    );
    assert(
      readFileSync(join(root, 'proto-ui', 'config.json'), 'utf8') === before,
      `rejected ${component} changed the consumer config`
    );
  }
  console.log(
    'packed Checkbox composition: exports, required Label payload and negative admission verified'
  );
}

// Logs survive successful temporary-consumer cleanup. The tested commit may be
// GitHub's PR merge commit, so record that actual checkout rather than calling it
// the development head. Each run retains the real tarball integrities and lock.
function logCheckboxDeliveryEvidence(packManifest, names, phase) {
  const revision = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    env: process.env,
  });
  if (revision.error) throw revision.error;
  assert(revision.status === 0, 'cannot bind packed evidence to actual checkout');
  const digest = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
  const evidence = {
    kind: 'checkbox-label-packed-wc-delivery',
    phase,
    testedCommit: revision.stdout.trim(),
    releaseVersion: packManifest.releaseVersion,
    packages: packManifest.packages
      .filter((entry) => names.includes(entry.name))
      .map(({ name, version, integrity, shasum }) => ({ name, version, integrity, shasum })),
    syntheticHost: readInstalledSyntheticHostEvidence(),
    lockSha256: digest(join(consumerDir, 'package-lock.json')),
    generatedFacadeSha256: digest(join(consumerDir, 'proto-ui', 'components', 'wc', 'index.ts')),
    fixtureSha256: digest(join(RENDER_FIXTURE_DIR, 'wc-checkbox-label.mjs')),
    nativeAcceptance: phase.startsWith('packed-types-and-both-native-paths-passed;')
      ? 'bounded-trusted-and-programmatic-native-paths-passed' : 'not-run',
    registryPublication: 'not-performed',
  };
  console.log(JSON.stringify(evidence));
  writeFileSync(join(consumerDir, 'checkbox-delivery-evidence.json'), JSON.stringify(evidence));
}

function readInstalledSyntheticHostEvidence() {
  const consumerRequire = createRequire(join(consumerDir, 'package.json'));
  const registratorEntry = consumerRequire.resolve('@happy-dom/global-registrator');
  const registratorRequire = createRequire(registratorEntry);
  const happyDomEntry = registratorRequire.resolve('happy-dom');
  const lock = JSON.parse(readFileSync(join(consumerDir, 'package-lock.json'), 'utf8'));
  const describe = (name, entry) => {
    let directory = dirname(entry);
    while (directory !== consumerDir && relative(consumerDir, directory).startsWith('node_modules')) {
      const manifestPath = join(directory, 'package.json');
      if (existsSync(manifestPath)) {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
        if (manifest.name === name) {
          const packagePath = relative(consumerDir, directory).replaceAll('\\', '/');
          const lockEntry = lock.packages?.[packagePath];
          assert(lockEntry?.version === manifest.version, `${name} runtime/lock version mismatch`);
          return {
            name,
            version: manifest.version,
            packagePath,
            entryPath: relative(consumerDir, entry).replaceAll('\\', '/'),
            manifestSha256: createHash('sha256').update(readFileSync(manifestPath)).digest('hex'),
            entrySha256: createHash('sha256').update(readFileSync(entry)).digest('hex'),
            lockIntegrity: lockEntry.integrity ?? null,
          };
        }
      }
      directory = dirname(directory);
    }
    throw new Error(`cannot locate installed ${name} metadata inside consumer node_modules`);
  };
  return {
    registrator: describe('@happy-dom/global-registrator', registratorEntry),
    implementation: describe('happy-dom', happyDomEntry),
    resolution: 'happy-dom resolved from the installed registrator entry, not repository root',
    nativeAcceptance: 'not-run',
  };
}
