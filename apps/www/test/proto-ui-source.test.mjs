// @vitest-environment node
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createProtoUiSourcePlugin, resolveProtoUiSource } from '../src/utils/proto-ui-source.mjs';

const require = createRequire(import.meta.url);
const astroRequire = createRequire(require.resolve('astro/package.json'));
const { createServer } = await import(pathToFileURL(astroRequire.resolve('vite')).href);
const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));
const fixtureDirectory = path.join(repositoryRoot, '.cache');

async function withViteConsumer(repository, consumerSource, run) {
  await mkdir(fixtureDirectory, { recursive: true });
  const root = await mkdtemp(path.join(fixtureDirectory, 'pui-source-consumer-'));
  const consumerPath = path.join(root, 'consumer.mjs');
  await writeFile(consumerPath, consumerSource);
  let server;
  try {
    server = await createServer({
      root,
      configFile: false,
      plugins: [createProtoUiSourcePlugin({ repositoryRoot: repository })],
      server: { middlewareMode: true },
      appType: 'custom',
      logLevel: 'silent',
    });
    return await run(server);
  } finally {
    await server?.close();
    await rm(root, { recursive: true, force: true });
  }
}

describe('website Proto UI source resolver', () => {
  it('loads a real Vite consumer from the current manifest-selected source export', async () => {
    const result = await withViteConsumer(
      repositoryRoot,
      "import { getActiveAsHookContext } from '@proto.ui/core/internal';\nexport const selected = typeof getActiveAsHookContext;\n",
      (server) => server.ssrLoadModule('/consumer.mjs')
    );

    expect(result.selected).toBe('function');
    expect(resolveProtoUiSource('@proto.ui/core/internal')).toBe(
      path.join(repositoryRoot, 'packages/core/src/internal.ts').split(path.sep).join('/')
    );
  });

  it('rejects a wrong-but-existing import target in an isolated manifest consumer', async () => {
    await mkdir(fixtureDirectory, { recursive: true });
    const fixtureRoot = await mkdtemp(path.join(fixtureDirectory, 'pui-source-manifest-'));
    const sourcePackage = path.join(repositoryRoot, 'packages/core');
    const fixturePackage = path.join(fixtureRoot, 'packages/core');
    await mkdir(fixturePackage, { recursive: true });
    await cp(path.join(sourcePackage, 'src'), path.join(fixturePackage, 'src'), {
      recursive: true,
    });
    const manifest = JSON.parse(await readFile(path.join(sourcePackage, 'package.json'), 'utf8'));
    manifest.exports['./internal'].import = './dist/index.js';
    await writeFile(path.join(fixturePackage, 'package.json'), JSON.stringify(manifest, null, 2));
    try {
      const wrongTarget = resolveProtoUiSource('@proto.ui/core/internal', {
        repositoryRoot: fixtureRoot,
      });
      expect(wrongTarget).toBe(path.join(fixturePackage, 'src/index.ts').split(path.sep).join('/'));
      expect(wrongTarget).not.toBe(
        path.join(fixturePackage, 'src/internal.ts').split(path.sep).join('/')
      );

      const observed = await withViteConsumer(
        fixtureRoot,
        "import { getActiveAsHookContext } from '@proto.ui/core/internal';\nexport const selected = typeof getActiveAsHookContext;\n",
        async (server) => {
          try {
            return { module: await server.ssrLoadModule('/consumer.mjs') };
          } catch (error) {
            return { error };
          }
        }
      );

      if (observed.error) {
        expect(String(observed.error)).toMatch(
          /getActiveAsHookContext|not exported|does not provide/i
        );
      } else {
        expect(observed.module.selected).not.toBe('function');
      }
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });
});
