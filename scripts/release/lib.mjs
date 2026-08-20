import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  copyFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { getLaunchProfilePackageNames, loadLaunchPackageGovernance } from './governance.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = resolve(__dirname, '..', '..');
const PACKAGES_DIR = join(ROOT_DIR, 'packages');
const ROOT_LICENSE = join(ROOT_DIR, 'LICENSE');
const ROOT_README = join(ROOT_DIR, 'README.md');
const PACKAGE_MANAGER = JSON.parse(
  readFileSync(join(ROOT_DIR, 'package.json'), 'utf8')
).packageManager;

// Windows resolves `pnpm` / `npm` as `.cmd` shims; Node 18.20+ refuses to spawn
// `.cmd` without a shell (CVE-2024-27980 mitigation), so we opt into shell:true
// only on win32 to keep POSIX hosts unaffected.
const IS_WINDOWS = process.platform === 'win32';

const DEFAULT_EXCLUDES = {
  legacy: true,
  test: false,
};

export function parseArgs(argv) {
  const args = {
    dryRun: false,
    json: false,
    includeLegacy: false,
    includeTest: false,
    checkBuild: false,
    checkGovernance: false,
    pack: false,
    publish: false,
    resumePublished: false,
    tag: undefined,
    access: 'public',
    otp: undefined,
    outDir: join(tmpdir(), 'proto-ui-npm-release'),
    only: [],
    profile: 'workspace',
    includeApprovedCandidates: false,
    publishDelayMs: 3000,
    maxPublishRetries: 2,
    retryDelayMs: 15000,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') continue;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--include-legacy') args.includeLegacy = true;
    else if (arg === '--include-test') args.includeTest = true;
    else if (arg === '--include-approved-candidates') args.includeApprovedCandidates = true;
    else if (arg === '--check-build') args.checkBuild = true;
    else if (arg === '--check-governance') args.checkGovernance = true;
    else if (arg === '--pack') args.pack = true;
    else if (arg === '--publish') args.publish = true;
    else if (arg === '--resume-published') args.resumePublished = true;
    else if (arg === '--tag') args.tag = argv[++i];
    else if (arg === '--access') args.access = argv[++i];
    else if (arg === '--otp') args.otp = argv[++i];
    else if (arg === '--profile') args.profile = argv[++i];
    else if (arg === '--publish-delay-ms') args.publishDelayMs = parseIntegerArg(argv[++i], arg);
    else if (arg === '--max-publish-retries')
      args.maxPublishRetries = parseIntegerArg(argv[++i], arg);
    else if (arg === '--retry-delay-ms') args.retryDelayMs = parseIntegerArg(argv[++i], arg);
    else if (arg === '--registry') args.registry = argv[++i];
    else if (arg === '--out-dir') args.outDir = resolve(ROOT_DIR, argv[++i]);
    else if (arg === '--only')
      args.only = argv[++i]
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!['workspace', 'launch'].includes(args.profile)) {
    throw new Error(`Unknown --profile value: ${args.profile}`);
  }
  if (args.publishDelayMs < 0) {
    throw new Error('--publish-delay-ms must be >= 0');
  }
  if (args.maxPublishRetries < 0) {
    throw new Error('--max-publish-retries must be >= 0');
  }
  if (args.retryDelayMs < 0) {
    throw new Error('--retry-delay-ms must be >= 0');
  }

  return args;
}

export function getAllPackages() {
  const packageDirs = [];
  for (const scope of readdirSync(PACKAGES_DIR, { withFileTypes: true })) {
    if (!scope.isDirectory()) continue;
    const scopeDir = join(PACKAGES_DIR, scope.name);
    const directPackageJson = join(scopeDir, 'package.json');
    if (existsSync(directPackageJson)) {
      packageDirs.push(scopeDir);
      continue;
    }

    for (const child of readdirSync(scopeDir, { withFileTypes: true })) {
      if (!child.isDirectory()) continue;
      const childDir = join(scopeDir, child.name);
      if (existsSync(join(childDir, 'package.json'))) {
        packageDirs.push(childDir);
      }
    }
  }

  packageDirs.sort();

  const packages = packageDirs.map((dir) => {
    const manifestPath = join(dir, 'package.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const relDir = relative(ROOT_DIR, dir).replaceAll('\\', '/');
    const exportsField = manifest.exports;
    const exportTargets = flattenExportTargets(exportsField);
    const hasSrcIndex = existsSync(join(dir, 'src', 'index.ts'));
    const hasDistIndex = existsSync(join(dir, 'dist', 'index.js'));
    const localReadme = ['README.md', 'README.mdx'].find((name) => existsSync(join(dir, name)));
    const dependencyMap = {
      ...manifest.dependencies,
      ...manifest.peerDependencies,
      ...manifest.optionalDependencies,
    };
    const workspaceDeps = Object.entries(dependencyMap)
      .filter(([, version]) => String(version).startsWith('workspace:'))
      .map(([name]) => name)
      .sort();
    const sourceExport = exportTargets.some(
      (target) => target.includes('/src/') || (target.endsWith('.ts') && !target.endsWith('.d.ts'))
    );
    const distExport = exportTargets.some(
      (target) => target.includes('/dist/') || target.endsWith('.js')
    );
    const isLegacy = relDir.startsWith('packages/legacy/');
    const isTestOnly = relDir.includes('/test-sys');
    const isReleaseExcluded = manifest.protoUi?.release?.scan === false;
    const issues = [];

    if (!isReleaseExcluded) {
      if (manifest.private) issues.push('private=true');
      if (!manifest.version || manifest.version === '0.0.0')
        issues.push(`version=${manifest.version ?? 'missing'}`);
      if (!hasSrcIndex && !hasDistIndex) issues.push('missing index entry');
      if (!manifest.license) issues.push('missing license field');
      if (!localReadme) issues.push('missing package README');
      if (workspaceDeps.length > 0) issues.push(`workspace deps: ${workspaceDeps.length}`);
      if (sourceExport && !hasSrcIndex) issues.push('exports point to src/*.ts');
    }

    return {
      dir,
      relDir,
      manifestPath,
      manifest,
      name: manifest.name,
      version: manifest.version,
      localReadme: localReadme ? join(dir, localReadme) : null,
      hasSrcIndex,
      hasDistIndex,
      sourceExport,
      distExport,
      isLegacy,
      isTestOnly,
      isReleaseExcluded,
      workspaceDeps,
      issues,
    };
  });

  const byName = new Map(packages.map((pkg) => [pkg.name, pkg]));
  for (const pkg of packages) {
    pkg.internalDeps = pkg.workspaceDeps.filter((dep) => byName.has(dep));
  }

  return packages;
}

export function selectPackages(packages, options = {}) {
  const {
    includeLegacy = false,
    includeTest = false,
    only = [],
    profile = 'workspace',
    includeApprovedCandidates = false,
    launchGovernance = null,
  } = options;
  const onlySet = new Set(only);

  if (profile === 'launch') {
    const governance = launchGovernance ?? loadLaunchPackageGovernance();
    const launchPackageSet = getLaunchProfilePackageNames(governance, {
      includeApprovedCandidates,
    });
    const selected = packages.filter((pkg) => {
      if (!launchPackageSet.has(pkg.name)) return false;
      if (onlySet.size > 0 && !onlySet.has(pkg.name) && !onlySet.has(pkg.relDir)) return false;
      return true;
    });

    if (onlySet.size > 0) {
      const workspaceBySelector = new Set();
      const launchBySelector = new Set();
      for (const pkg of packages) {
        if (onlySet.has(pkg.name) || onlySet.has(pkg.relDir)) {
          workspaceBySelector.add(pkg.name);
          if (launchPackageSet.has(pkg.name)) launchBySelector.add(pkg.name);
        }
      }
      const disallowed = [...workspaceBySelector]
        .filter((name) => !launchBySelector.has(name))
        .sort();
      if (disallowed.length > 0) {
        throw new Error(
          `--only contains packages outside launch profile: ${disallowed.join(', ')}`
        );
      }
    }

    return selected;
  }

  return packages.filter((pkg) => {
    if (onlySet.size > 0 && !onlySet.has(pkg.name) && !onlySet.has(pkg.relDir)) return false;
    if (pkg.isReleaseExcluded) return false;
    if (!includeLegacy && DEFAULT_EXCLUDES.legacy && pkg.isLegacy) return false;
    if (!includeTest && DEFAULT_EXCLUDES.test && pkg.isTestOnly) return false;
    return true;
  });
}

export function topoSortPackages(packages) {
  const selectedNames = new Set(packages.map((pkg) => pkg.name));
  const indegree = new Map(packages.map((pkg) => [pkg.name, 0]));
  const outgoing = new Map(packages.map((pkg) => [pkg.name, []]));

  for (const pkg of packages) {
    for (const dep of pkg.internalDeps) {
      if (!selectedNames.has(dep)) continue;
      outgoing.get(dep).push(pkg.name);
      indegree.set(pkg.name, indegree.get(pkg.name) + 1);
    }
  }

  const queue = packages
    .filter((pkg) => indegree.get(pkg.name) === 0)
    .map((pkg) => pkg.name)
    .sort();
  const orderedNames = [];

  while (queue.length > 0) {
    const name = queue.shift();
    orderedNames.push(name);
    for (const next of outgoing.get(name)) {
      const nextDegree = indegree.get(next) - 1;
      indegree.set(next, nextDegree);
      if (nextDegree === 0) {
        queue.push(next);
        queue.sort();
      }
    }
  }

  if (orderedNames.length !== packages.length) {
    throw new Error('Package graph contains a cycle.');
  }

  const packageMap = new Map(packages.map((pkg) => [pkg.name, pkg]));
  return orderedNames.map((name) => packageMap.get(name));
}

export function recommendedPackages(packages) {
  return packages.filter((pkg) => !pkg.isLegacy && !pkg.isReleaseExcluded);
}

/** Build the selected publish graph once through the same package-level
 * contract used by local development and CI. stagePackage copies these
 * verified artifacts so release staging cannot drift from local dist output.
 */
export function buildPrerequisitePackages(packages) {
  const buildable = packages.filter(
    (pkg) => pkg.distExport && typeof pkg.manifest?.scripts?.build === 'string'
  );
  if (buildable.length === 0) return [];
  const args = ['build:packages'];
  for (const pkg of buildable) args.push('--package', pkg.name);
  const result = spawnSync('corepack', [PACKAGE_MANAGER, ...args], {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    shell: IS_WINDOWS,
  });
  return [
    {
      name: 'public-package-build',
      code: result.status ?? 0,
      diagnostics: collectNonEmptyLines(`${result.stdout}\n${result.stderr}`),
    },
  ];
}

export function ensureCleanDir(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

export function stagePackage(pkg, options) {
  const {
    outDir,
    version,
    access = 'public',
    pack = false,
    publish = false,
    dryRun = false,
    tag = 'latest',
    registry,
    otp,
    publishDelayMs = 0,
    maxPublishRetries = 2,
    retryDelayMs = 15000,
    publishSequenceIndex = 0,
    packageVersions = new Map(),
    resumePublished = false,
  } = options;
  const stageDir = join(outDir, sanitizePackageName(pkg.name));
  const npmCacheDir = join(tmpdir(), 'proto-ui-npm-cache');
  ensureCleanDir(stageDir);
  mkdirSync(npmCacheDir, { recursive: true });

  const distDir = join(stageDir, 'dist');
  const localDistDir = join(pkg.dir, 'dist');
  if (!existsSync(join(localDistDir, 'index.js'))) {
    throw new Error(`Cannot stage ${pkg.name}: run its public package build first`);
  }
  cpSync(localDistDir, distDir, { recursive: true });
  const buildResult = { status: 0 };
  const buildErrors = [];
  const manifest = createPublishManifest(pkg, { version, access, packageVersions });
  writeFileSync(join(stageDir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeSupportingFiles(pkg, stageDir);

  if (buildResult.status === 0) {
    const missingExportTargets = flattenExportTargets(manifest.exports).filter((target) => {
      if (typeof target !== 'string' || target.includes('*') || !target.startsWith('./')) {
        return false;
      }
      return !existsSync(join(stageDir, target));
    });
    if (missingExportTargets.length > 0) {
      throw new Error(
        `Stage export validation failed for ${pkg.name}: missing ${missingExportTargets.join(', ')}`
      );
    }
  }

  const binDir = join(pkg.dir, 'bin');
  if (existsSync(binDir)) {
    cpSync(binDir, join(stageDir, 'bin'), { recursive: true });
  }

  // verify staged dist/index.js is not a self-referencing stub and can be parsed
  const smokeEntry = join(distDir, 'index.js');
  if (existsSync(smokeEntry)) {
    const content = readFileSync(smokeEntry, 'utf8');
    const nonCommentLines = content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('//'));
    if (nonCommentLines.length === 1 && nonCommentLines[0].includes("from './index.js'")) {
      throw new Error(
        `Stage smoke test failed for ${pkg.name}: dist/index.js is a self-referencing stub`
      );
    }

    const smokeScript = join(stageDir, '.smoke-test.mjs');
    writeFileSync(
      smokeScript,
      `import('${pathToFileURL(smokeEntry).href}').then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); })\n`,
      'utf8'
    );
    const importTest = spawnSync('node', [smokeScript], {
      cwd: stageDir,
      encoding: 'utf8',
      shell: IS_WINDOWS,
      timeout: 10000,
    });
    rmSync(smokeScript, { force: true });
    if (importTest.status !== 0) {
      const stderr = importTest.stderr || '';
      // smoke imports run inside a bare stage dir with no node_modules, so any
      // Node ESM resolution failure (missing dep, unsupported subpath, bundler
      // resolution requirements that don't trip the file resolver) is an
      // environmental artifact of the stage, not a packaging defect. only
      // SyntaxError / ReferenceError / TypeError-style runtime failures count
      // as real signal here — the kind of failure that shipped as the @proto.ui/cli@0.1.0
      // self-referencing stub, which is what this smoke test was added to catch.
      const isExpectedResolutionFailure =
        stderr.includes('ERR_MODULE_NOT_FOUND') ||
        stderr.includes('ERR_PACKAGE_PATH_NOT_EXPORTED') ||
        stderr.includes('ERR_UNSUPPORTED_DIR_IMPORT') ||
        stderr.includes('ERR_INVALID_MODULE_SPECIFIER');
      if (!isExpectedResolutionFailure) {
        const errors = collectNonEmptyLines(`${importTest.stdout}\n${stderr}`);
        throw new Error(
          `Stage smoke test failed for ${pkg.name}: cannot import dist/index.js\n${errors.join('\n')}`
        );
      }
    }
  }

  let packResult = null;
  if (pack) {
    const tarballDir = join(outDir, 'tarballs');
    mkdirSync(tarballDir, { recursive: true });
    const result = spawnSync('npm', ['pack', '--json', '--pack-destination', tarballDir], {
      cwd: stageDir,
      encoding: 'utf8',
      shell: IS_WINDOWS,
      env: {
        ...process.env,
        npm_config_cache: npmCacheDir,
      },
    });
    if (result.status !== 0) {
      throw new Error(`npm pack failed for ${pkg.name}\n${result.stderr || result.stdout}`);
    }
    const packed = JSON.parse(result.stdout || '[]');
    if (packed.length !== 1 || !packed[0]?.filename) {
      throw new Error(`npm pack returned no tarball metadata for ${pkg.name}`);
    }
    packResult = {
      ...packed[0],
      path: join(tarballDir, packed[0].filename),
    };
  }

  let publishResult = null;
  if (publish || dryRun) {
    if (publish && publishSequenceIndex > 0 && publishDelayMs > 0) {
      sleepMs(publishDelayMs);
    }

    const publishArgs = ['publish', '--access', access, '--tag', tag];
    if (dryRun) publishArgs.push('--dry-run');
    if (otp) publishArgs.push('--otp', otp);
    if (registry) publishArgs.push('--registry', registry);

    if (publish && resumePublished) {
      const recovery = inspectPublishedTarball(pkg, stageDir, npmCacheDir, registry);
      if (recovery.published) {
        console.log(`[${pkg.name}] recovery: registry tarball integrity matches staged package`);
        publishResult = {
          code: 0,
          stdout: '',
          stderr: '',
          errors: [],
          attempt: 0,
          maxAttempts: 0,
          rateLimited: false,
          alreadyPublished: true,
          resumed: true,
          integrity: recovery.integrity,
        };
      }
    }

    const maxAttempts = Math.max(1, Number(maxPublishRetries) + 1);
    for (let attempt = 1; publishResult === null && attempt <= maxAttempts; attempt += 1) {
      const result = spawnSync('npm', publishArgs, {
        cwd: stageDir,
        encoding: 'utf8',
        shell: IS_WINDOWS,
        env: {
          ...process.env,
          npm_config_cache: npmCacheDir,
        },
      });
      const errors = collectNonEmptyLines(`${result.stdout}\n${result.stderr}`);
      const rawCode = result.status ?? 0;
      const rateLimited = isRateLimitedPublishError(errors);
      // dry-run is meant to validate that the staged tarball is publishable,
      // not that the version slot is empty on the registry. once a version
      // is published on npm, every subsequent dry-run for that same VERSION
      // reports "cannot publish over the previously published versions" — so
      // any PR that runs after a release would otherwise fail this check
      // forever. treat that case as a green dry-run signal. real publishes
      // (which omit --dry-run) still fail loudly because we only collapse
      // the exit code when dryRun is true.
      const alreadyPublished = dryRun && rawCode !== 0 && isAlreadyPublishedError(errors);
      if (alreadyPublished) {
        console.log(`[${pkg.name}] dry-run: ${pkg.version} already published, treating as ok`);
      }
      const code = alreadyPublished ? 0 : rawCode;
      publishResult = {
        code,
        stdout: result.stdout,
        stderr: result.stderr,
        errors,
        attempt,
        maxAttempts,
        rateLimited,
        alreadyPublished,
      };
      if (code === 0) break;
      if (!rateLimited || attempt >= maxAttempts) {
        throw new Error(`npm publish failed for ${pkg.name}\n${result.stderr || result.stdout}`);
      }

      if (retryDelayMs > 0) {
        sleepMs(retryDelayMs * attempt);
      }
    }
  }

  return {
    name: pkg.name,
    stageDir,
    buildCode: buildResult.status ?? 0,
    buildErrors,
    packResult,
    publishResult,
  };
}

function inspectPublishedTarball(pkg, stageDir, npmCacheDir, registry) {
  const packageSpec = `${pkg.name}@${pkg.version}`;
  const viewArgs = ['view', packageSpec, 'dist.integrity', '--json'];
  if (registry) viewArgs.push('--registry', registry);
  const viewResult = spawnSync('npm', viewArgs, {
    cwd: stageDir,
    encoding: 'utf8',
    shell: IS_WINDOWS,
    env: { ...process.env, npm_config_cache: npmCacheDir },
  });
  const viewOutput = `${viewResult.stdout}\n${viewResult.stderr}`;
  if (viewResult.status !== 0) {
    if (/\bE404\b|404 Not Found|is not in this registry/i.test(viewOutput)) {
      return { published: false };
    }
    throw new Error(`Cannot inspect ${packageSpec} for recovery\n${viewOutput.trim()}`);
  }

  const registryIntegrity = JSON.parse(viewResult.stdout || 'null');
  if (typeof registryIntegrity !== 'string' || !registryIntegrity.startsWith('sha512-')) {
    throw new Error(`Registry returned no sha512 integrity for ${packageSpec}`);
  }

  const packDir = join(npmCacheDir, 'recovery-pack');
  ensureCleanDir(packDir);
  const packArgs = ['pack', '--json', '--pack-destination', packDir];
  const packResult = spawnSync('npm', packArgs, {
    cwd: stageDir,
    encoding: 'utf8',
    shell: IS_WINDOWS,
    env: { ...process.env, npm_config_cache: npmCacheDir },
  });
  if (packResult.status !== 0) {
    throw new Error(
      `Cannot pack ${packageSpec} for recovery\n${packResult.stderr || packResult.stdout}`
    );
  }

  const packed = JSON.parse(packResult.stdout || '[]');
  const stagedIntegrity = packed[0]?.integrity;
  if (stagedIntegrity !== registryIntegrity) {
    throw new Error(
      `Recovery integrity mismatch for ${packageSpec}: registry=${registryIntegrity}, staged=${stagedIntegrity ?? '<missing>'}`
    );
  }
  return { published: true, integrity: registryIntegrity };
}

export function createPublishManifest(pkg, options) {
  const { version, access, packageVersions = new Map() } = options;
  const manifest = JSON.parse(JSON.stringify(pkg.manifest));

  delete manifest.private;
  delete manifest.devDependencies;
  delete manifest.scripts;

  manifest.version = version ?? manifest.version;
  manifest.license ??= readRootLicenseId();
  const files = ['dist', 'README.md', 'LICENSE', ...getThirdPartyNoticeFiles(pkg)];
  if (manifest.bin && !files.includes('bin')) files.push('bin');
  manifest.files = files;
  manifest.publishConfig = {
    access,
    ...manifest.publishConfig,
  };

  rewriteManifestField(manifest, 'main');
  rewriteManifestField(manifest, 'module');
  rewriteManifestField(manifest, 'types');
  if (manifest.exports) {
    manifest.exports = rewriteExports(manifest.exports);
  } else {
    manifest.exports = {
      '.': {
        types: './dist/index.d.ts',
        default: './dist/index.js',
      },
    };
  }

  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    if (!manifest[field]) continue;
    for (const [name, depVersion] of Object.entries(manifest[field])) {
      if (String(depVersion).startsWith('workspace:')) {
        manifest[field][name] = toPublishedWorkspaceRange(
          packageVersions.get(name) ?? version ?? pkg.version
        );
      }
    }
  }

  return manifest;
}

function toPublishedWorkspaceRange(version) {
  return version;
}

function rewriteManifestField(manifest, field) {
  if (!manifest[field]) return;
  manifest[field] = rewritePath(manifest[field], field === 'types');
}

function rewriteExports(value, isTypes = false) {
  if (typeof value === 'string') return rewritePath(value, isTypes || value.endsWith('.d.ts'));
  if (Array.isArray(value)) return value.map((item) => rewriteExports(item, isTypes));
  if (value && typeof value === 'object') {
    const next = {};
    for (const [key, entry] of Object.entries(value)) {
      next[key] = rewriteExports(entry, isTypes || key === 'types');
    }
    return next;
  }
  return value;
}

function rewritePath(value, isTypes = false) {
  if (typeof value !== 'string') return value;
  let next = value;
  next = next.replace('./src/', './dist/');
  next = next.replace('./dist/src/', './dist/');
  if (next.endsWith('.d.ts')) {
    return next;
  }
  if (next.endsWith('.ts')) {
    next = `${next.slice(0, -3)}${isTypes ? '.d.ts' : '.js'}`;
  }
  if (next.endsWith('/index.d.ts') || next.endsWith('/index.js')) return next;
  if (next.endsWith('/index')) return `${next}${isTypes ? '.d.ts' : '.js'}`;
  return next;
}

function flattenExportTargets(exportsField) {
  const targets = [];
  walk(exportsField);
  return targets;

  function walk(value) {
    if (!value) return;
    if (typeof value === 'string') {
      targets.push(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (typeof value === 'object') {
      for (const item of Object.values(value)) walk(item);
    }
  }
}

function sanitizePackageName(name) {
  return name.replace('@', '').replaceAll('/', '__');
}

export function writeSupportingFiles(pkg, stageDir) {
  if (pkg.localReadme) {
    copyFileSync(pkg.localReadme, join(stageDir, 'README.md'));
  } else if (existsSync(ROOT_README)) {
    writeFileSync(
      join(stageDir, 'README.md'),
      `# ${pkg.name}\n\nPublished from \`${pkg.relDir}\` in the Proto-UI monorepo.\n`
    );
  }

  if (existsSync(ROOT_LICENSE)) {
    copyFileSync(ROOT_LICENSE, join(stageDir, 'LICENSE'));
  }

  for (const noticeFile of getThirdPartyNoticeFiles(pkg)) {
    copyFileSync(join(pkg.dir, noticeFile), join(stageDir, noticeFile));
  }
}

function getThirdPartyNoticeFiles(pkg) {
  const files = pkg.manifest?.protoUi?.release?.thirdPartyNotices ?? [];
  if (!Array.isArray(files)) {
    throw new Error(`${pkg.name}: protoUi.release.thirdPartyNotices must be an array`);
  }

  return [...new Set(files)].map((file) => {
    if (
      typeof file !== 'string' ||
      file.length === 0 ||
      file.includes('/') ||
      file.includes('\\') ||
      file === '.' ||
      file === '..'
    ) {
      throw new Error(`${pkg.name}: third-party notice must be a package-root filename: ${file}`);
    }
    if (!pkg.dir || !existsSync(join(pkg.dir, file))) {
      throw new Error(`${pkg.name}: missing declared third-party notice: ${file}`);
    }
    return file;
  });
}

function readRootLicenseId() {
  return 'MIT';
}

function collectNonEmptyLines(value) {
  return value
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
}

function parseIntegerArg(value, argName) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${argName} expects an integer value`);
  }
  return parsed;
}

function isRateLimitedPublishError(lines) {
  const text = lines.join('\n');
  return /\b429\b/i.test(text) || /too many requests/i.test(text) || /rate limit/i.test(text);
}

function isAlreadyPublishedError(lines) {
  const text = lines.join('\n');
  return /cannot publish over the previously published versions/i.test(text);
}

function sleepMs(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return;
  const waitMs = Math.floor(ms);
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, waitMs);
}
