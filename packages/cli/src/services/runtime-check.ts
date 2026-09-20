import { formatInstallCommand, type PackageManager } from './package-manager.js';
import type { Adapter } from '../registry/adapters.js';

export function ensureRuntimePackages({
  adapter,
  projectPkg,
  packageManager,
}: {
  adapter: Adapter;
  projectPkg: Record<string, unknown> | null;
  packageManager: PackageManager;
}): void {
  const missing = adapter.runtimePackages.filter(
    (runtime) => !hasProjectPackage(projectPkg, runtime.name)
  );

  if (missing.length > 0) {
    const installLine = formatInstallCommand(
      packageManager,
      runtimeInstallHint(
        adapter.id,
        missing.map((runtime) => runtime.name)
      )
    );
    throw new Error(
      [
        `[proto-ui] ${adapter.label} runtime is required for adapter "${adapter.id}".`,
        '',
        'Missing dependency:',
        ...missing.map((runtime) => `  ${runtime.name}`),
        '',
        'Install it first:',
        `  ${installLine}`,
      ].join('\n')
    );
  }

  for (const runtime of adapter.runtimePackages) {
    if (!runtime.versionRange) continue;
    const declaredRange = getProjectPackageRange(projectPkg, runtime.name);
    if (!declaredRange || !isCompatibleRuntimeRange(declaredRange, runtime.versionRange)) {
      throw new Error(
        `[proto-ui] ${adapter.label} runtime must satisfy ${runtime.versionRange}; ` +
          `the project declares ${runtime.name}@${declaredRange ?? 'an unrecognized version range'}.`
      );
    }
  }
}

function hasProjectPackage(
  projectPkg: Record<string, unknown> | null,
  packageName: string
): boolean {
  if (!projectPkg) return false;
  return getProjectPackageRange(projectPkg, packageName) !== null;
}

function getProjectPackageRange(
  projectPkg: Record<string, unknown> | null,
  packageName: string
): string | null {
  if (!projectPkg) return null;
  for (const field of [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ]) {
    const dependencies = projectPkg[field] as Record<string, unknown> | undefined;
    const value = dependencies?.[packageName];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

/**
 * The CLI intentionally accepts only bounded Vue 2.6 forms it can verify from
 * package.json. A caret range rooted at 2.6 can resolve through <3.0.0, so it
 * is not a subset of the governed <2.7 upper bound. Fail closed rather than
 * generating a Vue 2 facade against an arbitrary range (notably Vue 2.7/3).
 */
function isCompatibleRuntimeRange(declaredRange: string, requiredRange: string): boolean {
  if (requiredRange !== '>=2.6.0 <2.7') return false;
  const normalized = declaredRange.replace(/^npm:vue@/, '').trim();
  return (
    /^(?:v)?2\.6(?:\.\d+)?$/.test(normalized) ||
    /^~2\.6(?:\.\d+)?$/.test(normalized) ||
    /^2\.6(?:\.x|\.\*)?$/.test(normalized) ||
    /^>=\s*2\.6(?:\.0)?\s+<\s*2\.7(?:\.0)?$/.test(normalized)
  );
}

function runtimeInstallHint(adapterId: string, missing: string[]): string[] {
  if (adapterId === 'react' && missing.includes('react')) {
    return ['react', 'react-dom'];
  }
  return missing;
}
