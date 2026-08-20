import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

const PROTO_UI_PREFIX = '@proto.ui/';

function resolveProtoUiImport(id: string): string | null {
  if (!id.startsWith(PROTO_UI_PREFIX)) return null;

  const name = id.slice(PROTO_UI_PREFIX.length);
  const parts = name.split('/');
  const pkg = parts[0];
  const rest = parts.slice(1);

  let subdir: string;
  if (pkg.startsWith('module-')) {
    subdir = path.join('modules', pkg.slice('module-'.length));
  } else if (pkg.startsWith('adapter-')) {
    subdir = path.join('adapters', pkg.slice('adapter-'.length));
  } else if (pkg.startsWith('prototypes-')) {
    subdir = path.join('prototypes', pkg.slice('prototypes-'.length));
  } else if (pkg.startsWith('spec-')) {
    subdir = path.join('spec', pkg.slice('spec-'.length));
  } else if (pkg === 'rule') {
    subdir = path.join('legacy', 'rule');
  } else {
    subdir = pkg;
  }

  const base = path.resolve(__dirname, 'packages', subdir, 'src');
  const target = rest.length ? path.join(base, ...rest) : base;
  const index = path.join(target, 'index.ts');

  if (fs.existsSync(index)) return index;
  if (fs.existsSync(`${target}.ts`)) return `${target}.ts`;
  if (fs.existsSync(`${target}.tsx`)) return `${target}.tsx`;
  if (fs.existsSync(target)) return target;

  const manifest = JSON.parse(fs.readFileSync(path.join(base, '..', 'package.json'), 'utf8'));
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
    const entry = value as string | Record<string, string>;
    const exportTarget =
      typeof entry === 'string' ? entry : (entry.import ?? entry.default ?? entry.types);
    if (!exportTarget) continue;
    const wildcard = match[1] ?? '';
    const sourceTarget = exportTarget
      .replace('*', wildcard)
      .replace('./dist/', './src/')
      .replace(/\.d\.ts$/, '.ts')
      .replace(/\.js$/, '.ts');
    const sourcePath = path.resolve(base, '..', sourceTarget);
    if (fs.existsSync(sourcePath)) return sourcePath;
  }
  return null;
}

export default defineConfig({
  plugins: [
    {
      name: 'proto-ui-alias',
      enforce: 'pre',
      resolveId(id) {
        return resolveProtoUiImport(id);
      },
    },
  ],
  test: {
    environment: 'happy-dom',
    include: [
      'packages/**/*.test.ts',
      'packages/**/test/**/*.test.ts',
      'internal/contracts/__tests__/**/*.test.ts',
      'apps/**/test/**/*.test.ts',
      'apps/www/src/**/*.test.ts',
    ],
  },
});
