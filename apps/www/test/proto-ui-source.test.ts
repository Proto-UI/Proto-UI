// @vitest-environment node
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createServer as createViteServer } from '../../workspace/node_modules/vite/dist/node/index.js';
import { resolveProtoUiSource } from '../src/utils/proto-ui-source.mjs';
import type { ActiveRuntimeDelayContext } from '../../../packages/core/src/internal';

describe('website workspace source identity', () => {
  it('shares active Core context across package and native file consumers', async () => {
    const cacheDir = await mkdtemp(path.join(tmpdir(), 'proto-ui-source-'));
    const vite = await createViteServer({
      configFile: false,
      root: fileURLToPath(new URL('../', import.meta.url)),
      cacheDir,
      plugins: [{ name: 'proto-ui-source', enforce: 'pre', resolveId: resolveProtoUiSource }],
      optimizeDeps: { noDiscovery: true, include: [] },
      server: { middlewareMode: true, hmr: false, watch: null },
    });
    try {
      const packageConsumer = await vite.ssrLoadModule('@proto.ui/core/internal');
      const nativeConsumer = await vite.ssrLoadModule(
        fileURLToPath(new URL('../../../packages/core/src/internal.ts', import.meta.url))
      );
      const context: ActiveRuntimeDelayContext = {
        prototypeName: 'shared-source-owner',
        scheduleDelay() {
          throw new Error('The source-identity probe must not schedule work.');
        },
      };
      packageConsumer.enterActiveRuntimeDelayContext(context);
      try {
        expect(nativeConsumer.getActiveRuntimeDelayContext()).toBe(context);
      } finally {
        packageConsumer.exitActiveRuntimeDelayContext();
      }
      expect(nativeConsumer.getActiveRuntimeDelayContext()).toBeUndefined();
    } finally {
      await vite.close();
      await rm(cacheDir, { recursive: true, force: true });
    }
  });
});
