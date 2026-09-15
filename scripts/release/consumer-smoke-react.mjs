import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { getAllPackages, ROOT_DIR, selectPackages } from './lib.mjs';
import { readVersion } from './version-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(__dirname, 'consumer-smoke', 'react-vite');
const RELEASE_ROOTS = ['@proto.ui/cli', '@proto.ui/adapter-react', '@proto.ui/prototypes-shadcn'];

const args = parseArgs(process.argv.slice(2));
const workDir = args.workDir ?? mkdtempSync(join(tmpdir(), 'proto-ui-react-consumer-'));
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

  const packManifestPath = join(releaseDir, 'pack-manifest.json');
  const packManifest = JSON.parse(readFileSync(packManifestPath, 'utf8'));
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

  cpSync(FIXTURE_DIR, consumerDir, { recursive: true });
  const packageByName = new Map(packManifest.packages.map((pkg) => [pkg.name, pkg]));
  const consumerPackageNames = collectDeclaredClosure(RELEASE_ROOTS, packageByName, releaseDir);
  const protoDependencies = Object.fromEntries(
    consumerPackageNames.map((name) => {
      const entry = packageByName.get(name);
      const tarballPath = join(releaseDir, entry.tarball);
      assert(existsSync(tarballPath), `missing packed tarball for ${name}`);
      return [name, toFileSpec(relative(consumerDir, tarballPath))];
    })
  );

  const packageJson = {
    name: 'proto-ui-react-consumer-smoke',
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: {
      build: 'tsc --noEmit && vite build',
      'build:button-boundary': 'vite build --config vite.button-boundary.mjs',
      smoke: 'node --import tsx ./smoke.tsx',
    },
    dependencies: {
      ...protoDependencies,
      react: '19.2.6',
      'react-dom': '19.2.6',
    },
    devDependencies: {
      '@happy-dom/global-registrator': '20.11.0',
      '@types/node': '25.6.2',
      '@types/react': '19.2.14',
      '@types/react-dom': '19.2.3',
      tsx: '4.21.0',
      typescript: '5.9.3',
      vite: '6.4.1',
    },
  };
  writeFileSync(join(consumerDir, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);

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
  run(
    process.execPath,
    [cli, 'add', 'react', 'shadcn-button', '--no-install', '--no-interactive'],
    {
      cwd: consumerDir,
    }
  );
  run('npm', ['run', 'build:button-boundary'], { cwd: consumerDir });

  for (const component of ['shadcn-switch', 'shadcn-select', 'shadcn-dialog']) {
    run(process.execPath, [cli, 'add', 'react', component, '--no-install', '--no-interactive'], {
      cwd: consumerDir,
    });
  }

  run('npm', ['run', 'build'], { cwd: consumerDir });
  run('npm', ['run', 'smoke'], { cwd: consumerDir });

  succeeded = true;
  console.log(
    `release consumer smoke: react ok (${consumerPackageNames.length}/${expectedPackages.length} packed packages consumed)`
  );
  if (args.keep) console.log(`artifacts kept at ${workDir}`);
} catch (error) {
  console.error(`release consumer smoke failed; artifacts kept at ${workDir}`);
  throw error;
} finally {
  if (succeeded && !args.keep) rmSync(workDir, { recursive: true, force: true });
}

function collectDeclaredClosure(rootNames, packageByName, releaseDir) {
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

  for (const name of expectedNames) {
    const manifest = JSON.parse(
      readFileSync(join(protoScopeDir, name.slice('@proto.ui/'.length), 'package.json'), 'utf8')
    );
    assert(manifest.version === releaseVersion, `${name} manifest version drifted`);
    for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const [dependencyName, dependencyVersion] of Object.entries(manifest[field] ?? {})) {
        if (!dependencyName.startsWith('@proto.ui/')) continue;
        assert(
          dependencyVersion === releaseVersion,
          `${name} has non-exact ${field} edge ${dependencyName}@${dependencyVersion}`
        );
      }
    }
  }
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd ?? ROOT_DIR,
    encoding: 'utf8',
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${commandArgs.join(' ')} exited with ${result.status}`);
  }
}

function parseArgs(argv) {
  const parsed = { keep: false, workDir: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') continue;
    else if (arg === '--keep') parsed.keep = true;
    else if (arg === '--work-dir') {
      const value = argv[++index];
      if (!value) throw new Error('--work-dir expects a path');
      parsed.workDir = isAbsolute(value) ? value : resolve(ROOT_DIR, value);
    } else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: node scripts/release/consumer-smoke-react.mjs [--keep] [--work-dir <path>]'
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (parsed.workDir) {
    rmSync(parsed.workDir, { recursive: true, force: true });
  }
  return parsed;
}

function toFileSpec(path) {
  const normalized = path.replaceAll('\\', '/');
  return `file:${normalized.startsWith('.') ? normalized : `./${normalized}`}`;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
