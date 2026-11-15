import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { fileExists, readJsonFile } from '../utils/fs.js';

export type PackageManager = 'npm' | 'pnpm' | 'yarn';

const cliManifest = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
) as { version?: unknown };

const cliReleaseVersion = cliManifest.version;

if (typeof cliReleaseVersion !== 'string' || cliReleaseVersion.length === 0) {
  throw new Error('@proto.ui/cli package.json must declare a release version');
}

export const CLI_RELEASE_VERSION = cliReleaseVersion;

export async function detectPackageManager(cwd: string): Promise<PackageManager> {
  if (await fileExists(path.join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
  if (await fileExists(path.join(cwd, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

export function formatInstallCommand(
  pm: PackageManager,
  packages: string[],
  { dev = false, exact = false }: { dev?: boolean; exact?: boolean } = {}
): string {
  const list = packages.join(' ');
  const exactFlag = exact ? (pm === 'yarn' ? ' --exact' : ' --save-exact') : '';
  if (pm === 'pnpm')
    return dev ? `pnpm add -D${exactFlag} ${list}` : `pnpm add${exactFlag} ${list}`;
  if (pm === 'yarn')
    return dev ? `yarn add -D${exactFlag} ${list}` : `yarn add${exactFlag} ${list}`;
  return dev
    ? `npm install --save-dev${exactFlag} ${list}`
    : `npm install --save${exactFlag} ${list}`;
}

export function toExactProtoUiInstallSpec(
  packageName: string,
  version = CLI_RELEASE_VERSION
): string {
  return packageName.startsWith('@proto.ui/') ? `${packageName}@${version}` : packageName;
}

export function installPackages(
  pm: PackageManager,
  cwd: string,
  packages: string[],
  { dev = false, exact = false }: { dev?: boolean; exact?: boolean } = {}
): void {
  if (packages.length === 0) return;

  let cmd = 'npm';
  let args: string[];
  if (pm === 'pnpm') {
    cmd = 'pnpm';
    args = ['add', ...(dev ? ['-D'] : []), ...(exact ? ['--save-exact'] : []), ...packages];
  } else if (pm === 'yarn') {
    cmd = 'yarn';
    args = ['add', ...(dev ? ['-D'] : []), ...(exact ? ['--exact'] : []), ...packages];
  } else {
    args = [
      'install',
      dev ? '--save-dev' : '--save',
      ...(exact ? ['--save-exact'] : []),
      ...packages,
    ];
  }

  // Windows: spawnSync needs shell:true to resolve npm/yarn/pnpm via .cmd shims.
  // Node 18.20+ blocks .cmd/.bat under shell:false (CVE-2024-27980 mitigation).
  const isWindows = process.platform === 'win32';
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: isWindows,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} exited with code ${result.status ?? 'unknown'}`);
  }
}

export async function readProjectPackageJson(cwd: string): Promise<Record<string, unknown> | null> {
  const packageJsonPath = path.join(cwd, 'package.json');
  if (!(await fileExists(packageJsonPath))) return null;
  return readJsonFile(packageJsonPath) as Promise<Record<string, unknown>>;
}

export function hasPackage(
  projectPkg: Record<string, unknown> | null,
  packageName: string
): boolean {
  if (!projectPkg) return false;
  const deps = projectPkg.dependencies as Record<string, unknown> | undefined;
  const devDeps = projectPkg.devDependencies as Record<string, unknown> | undefined;
  const peerDeps = projectPkg.peerDependencies as Record<string, unknown> | undefined;
  const optDeps = projectPkg.optionalDependencies as Record<string, unknown> | undefined;
  return Boolean(
    deps?.[packageName] ||
    devDeps?.[packageName] ||
    peerDeps?.[packageName] ||
    optDeps?.[packageName]
  );
}

const dependencyFields = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

/** Read-only admission before add installs packages or changes project files.
 * Exact declarations may precede the project's first install. Local sources and
 * npm aliases additionally need installed identity; their spec alone cannot
 * prove that the package under the official name belongs to this release.
 */
export function assertRequiredProtoUiRelease({
  cwd,
  projectPkg,
  requiredPackages,
  packageManager,
}: {
  cwd: string;
  projectPkg: Record<string, unknown>;
  requiredPackages: readonly string[];
  packageManager: PackageManager;
}): void {
  const issues: string[] = [];
  const affected = new Set<string>();

  for (const packageName of new Set(requiredPackages)) {
    if (!packageName.startsWith('@proto.ui/')) continue;
    const declarations = dependencyFields.flatMap((field) => {
      const values = projectPkg[field] as Record<string, unknown> | undefined;
      return values && Object.hasOwn(values, packageName)
        ? [{ field, value: values[packageName] }]
        : [];
    });
    // A missing declaration remains add's ordinary exact-install/no-install path.
    if (!declarations.length) continue;

    const report = (detail: string) => {
      affected.add(packageName);
      issues.push(`${packageName}: ${detail}`);
    };
    let requiresInstalledIdentity = false;
    for (const { field, value } of declarations) {
      if (value === CLI_RELEASE_VERSION) continue;
      if (
        typeof value === 'string' &&
        (/^(?:file|link|workspace):.+/.test(value) ||
          value === `npm:${packageName}@${CLI_RELEASE_VERSION}`)
      ) {
        requiresInstalledIdentity = true;
        continue;
      }
      report(`${field} declares ${JSON.stringify(value)}; expected ${CLI_RELEASE_VERSION}`);
    }

    let installed: { name?: unknown; version?: unknown } | null = null;
    try {
      // Follow consumer node_modules ancestors, including hoisted/symlinked
      // packages, without executing exports. NODE_PATH/global CommonJS lookup
      // paths do not prove installation for the generated ESM consumer.
      for (let directory = path.resolve(cwd); ; directory = path.dirname(directory)) {
        try {
          const manifest: unknown = JSON.parse(
            readFileSync(path.join(directory, 'node_modules', packageName, 'package.json'), 'utf8')
          );
          if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
            throw new Error('Invalid package metadata');
          }
          installed = manifest;
          break;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
        if (path.dirname(directory) === directory) break;
      }
      if (installed) {
        if (installed.name !== packageName || installed.version !== CLI_RELEASE_VERSION) {
          report(
            `installed identity is ${JSON.stringify(installed.name)}@${JSON.stringify(installed.version)}; expected ${packageName}@${CLI_RELEASE_VERSION}`
          );
        }
      } else if (requiresInstalledIdentity) {
        report('local source or npm alias has no installed package identity to verify');
      }
    } catch {
      report('installed package metadata is unreadable or invalid');
    }
  }

  if (issues.length) {
    const command = formatInstallCommand(
      packageManager,
      [...affected].map((name) => toExactProtoUiInstallSpec(name)),
      { exact: true }
    );
    throw new Error(
      `Proto UI release mismatch: this CLI requires ${CLI_RELEASE_VERSION}.\n` +
        issues.map((issue) => `  - ${issue}`).join('\n') +
        `\nAlign required packages with "${command}" and remove conflicting declarations from other dependency sections before retrying.` +
        '\nLocal sources and npm aliases must already resolve to the expected official package name and exact version. No project files were changed.'
    );
  }
}
