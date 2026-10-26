import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROTO_UI_PREFIX = '@proto.ui/';
export const PROTO_UI_REPOSITORY_ROOT = fileURLToPath(new URL('../../../..', import.meta.url));

/** @param {string} id @param {{ repositoryRoot?: string }} [options] */
export function resolveProtoUiSource(id, { repositoryRoot = PROTO_UI_REPOSITORY_ROOT } = {}) {
  if (!id.startsWith(PROTO_UI_PREFIX)) return null;
  const [packageSegment, ...rest] = id.slice(PROTO_UI_PREFIX.length).split('/');
  const packageDirectory = packageSegment.startsWith('module-')
    ? path.join('modules', packageSegment.slice('module-'.length))
    : packageSegment.startsWith('adapter-')
      ? path.join('adapters', packageSegment.slice('adapter-'.length))
      : packageSegment.startsWith('prototypes-')
        ? path.join('prototypes', packageSegment.slice('prototypes-'.length))
        : packageSegment;
  const packageRoot = path.join(repositoryRoot, 'packages', packageDirectory);
  const manifestPath = path.join(packageRoot, 'package.json');
  if (!fs.existsSync(manifestPath)) return null;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const subpath = rest.length ? `./${rest.join('/')}` : '.';

  for (const [key, value] of Object.entries(manifest.exports ?? {})) {
    const match = key.includes('*')
      ? subpath.match(
          new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('\\*', '(.+)')}$`)
        )
      : key === subpath
        ? []
        : null;
    if (!match) continue;
    const exportTarget =
      typeof value === 'string' ? value : (value.import ?? value.default ?? value.types);
    if (!exportTarget) continue;
    const sourceTarget = exportTarget
      .replace('*', match[1] ?? '')
      .replace('./dist/', './src/')
      .replace(/\.d\.ts$/, '.ts')
      .replace(/\.js$/, '.ts');
    const sourcePath = path.resolve(packageRoot, sourceTarget);
    if (fs.existsSync(sourcePath)) return sourcePath.split(path.sep).join('/');
  }
  return null;
}

/** @param {{ repositoryRoot?: string }} [options] @returns {import('vite').Plugin} */
export function createProtoUiSourcePlugin(options = {}) {
  return {
    name: 'proto-ui-source',
    enforce: 'pre',
    /** @param {string} id */
    resolveId(id) {
      return resolveProtoUiSource(id, options);
    },
  };
}
