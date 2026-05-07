import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(__dirname, '..', '..');

export function getRoot(rootDir) {
  if (rootDir) return resolve(rootDir);
  if (process.env.PROTO_RELEASE_ROOT) return resolve(process.env.PROTO_RELEASE_ROOT);
  return DEFAULT_ROOT;
}

export function readVersion(rootDir) {
  const root = getRoot(rootDir);
  const raw = readFileSync(join(root, 'VERSION'), 'utf8').trim();
  const match = raw.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Invalid VERSION at ${join(root, 'VERSION')}: ${raw}`);
  }
  const [, major, minor, patch] = match;
  return {
    raw,
    major,
    minor,
    patch,
    minorPrefix: `${major}.${minor}.`,
  };
}

export function findProtoPackages(rootDir) {
  const root = getRoot(rootDir);
  const packagesDir = join(root, 'packages');
  if (!existsSync(packagesDir)) return [];

  const manifestPaths = [];
  for (const scope of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!scope.isDirectory()) continue;
    const scopeDir = join(packagesDir, scope.name);
    const direct = join(scopeDir, 'package.json');
    if (existsSync(direct)) {
      manifestPaths.push(direct);
      continue;
    }
    for (const child of readdirSync(scopeDir, { withFileTypes: true })) {
      if (!child.isDirectory()) continue;
      const childManifest = join(scopeDir, child.name, 'package.json');
      if (existsSync(childManifest)) manifestPaths.push(childManifest);
    }
  }

  return manifestPaths
    .map((manifestPath) => {
      let manifest;
      try {
        manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      } catch (err) {
        throw new Error(`Failed to parse ${manifestPath}: ${err.message}`);
      }
      return { manifestPath, manifest };
    })
    .filter(
      (entry) =>
        typeof entry.manifest.name === 'string' && entry.manifest.name.startsWith('@proto.ui/')
    )
    .sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
}
