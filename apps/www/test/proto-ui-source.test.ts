// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const configUrl = new URL('../astro.config.mjs', import.meta.url);
const config = fs.readFileSync(configUrl, 'utf8');
// Run the configured resolver without loading unrelated Astro integrations.
const sourcePluginCode = config
  .slice(config.indexOf('const PROTO_UI_PREFIX'), config.indexOf('const inProgressBadge'))
  .replaceAll('import.meta.url', JSON.stringify(configUrl.href));

describe('website workspace source IDs', () => {
  for (const [platform, paths, root] of [
    ['POSIX', path.posix, '/proto-ui'],
    ['Windows', path.win32, 'C:\\proto-ui'],
  ] as const) {
    it(`uses the canonical Core context ID on ${platform}`, () => {
      const nativePath = paths.resolve(root, 'packages/core/src/internal.ts');
      // Model the native filesystem boundary while keeping the real package exports.
      const sourcePlugin = runInNewContext(`${sourcePluginCode}\nprotoUiSourcePlugin;`, {
        fs: {
          readFileSync: fs.readFileSync,
          existsSync: (file: string) => file === nativePath || fs.existsSync(file),
        },
        path: { ...path, sep: paths.sep, resolve: () => nativePath },
        fileURLToPath,
        URL,
      }) as { resolveId: (id: string) => string | null };
      const id = sourcePlugin.resolveId('@proto.ui/core/internal');
      expect(id).toBe(`${root.replaceAll('\\', '/')}/packages/core/src/internal.ts`);
    });
  }
});
