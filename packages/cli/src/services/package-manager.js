import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { fileExists, readJsonFile } from '../utils/fs.js';

export async function detectPackageManager(cwd) {
  if (await fileExists(path.join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
  if (await fileExists(path.join(cwd, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

export function formatInstallCommand(pm, packages, { dev = false } = {}) {
  const list = packages.join(' ');
  if (pm === 'pnpm') return dev ? `pnpm add -D ${list}` : `pnpm add ${list}`;
  if (pm === 'yarn') return dev ? `yarn add -D ${list}` : `yarn add ${list}`;
  return dev ? `npm install --save-dev ${list}` : `npm install --save ${list}`;
}

export function installPackages(pm, cwd, packages, { dev = false } = {}) {
  if (packages.length === 0) return;

  let cmd = 'npm';
  let args = ['install', '--save', ...packages];
  if (pm === 'pnpm') {
    cmd = 'pnpm';
    args = dev ? ['add', '-D', ...packages] : ['add', ...packages];
  } else if (pm === 'yarn') {
    cmd = 'yarn';
    args = dev ? ['add', '-D', ...packages] : ['add', ...packages];
  } else if (dev) {
    args = ['install', '--save-dev', ...packages];
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

export async function readProjectPackageJson(cwd) {
  const packageJsonPath = path.join(cwd, 'package.json');
  if (!(await fileExists(packageJsonPath))) return null;
  return readJsonFile(packageJsonPath);
}

export function hasPackage(projectPkg, packageName) {
  if (!projectPkg) return false;
  return Boolean(
    projectPkg.dependencies?.[packageName] ||
    projectPkg.devDependencies?.[packageName] ||
    projectPkg.peerDependencies?.[packageName] ||
    projectPkg.optionalDependencies?.[packageName]
  );
}
