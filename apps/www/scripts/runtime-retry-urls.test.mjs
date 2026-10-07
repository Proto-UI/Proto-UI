import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { it } from 'node:test';
import { runtimeRetryModules, runtimeRetryUrlsPlugin } from './runtime-retry-urls.mjs';

const require = createRequire(import.meta.url);
const astroRequire = createRequire(require.resolve('astro/package.json'));
const { build, createServer } = await import(pathToFileURL(astroRequire.resolve('vite')).href);

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'runtime-retry-urls-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const importer = path.join(root, 'src/components/PrototypePreviewer/demo-renderer.ts');
  await mkdir(path.dirname(importer), { recursive: true });
  const targets = {};
  for (const [key, source] of Object.entries(runtimeRetryModules)) {
    const file = source.startsWith('.')
      ? path.resolve(path.dirname(importer), source)
      : path.join(root, 'deps', `${key}.js`);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `export const marker = ${JSON.stringify(key)};\n`);
    targets[source] = file;
  }
  await writeFile(
    importer,
    `import urls from 'virtual:proto-ui/runtime-retry-urls';\nexport { urls };\nexport const loads = [${Object.keys(
      targets
    )
      .map((source) => `() => import(${JSON.stringify(source)})`)
      .join(',')}];`
  );
  return {
    root,
    importer,
    targets,
    plugins: [
      {
        name: 'owned-fixture-modules',
        enforce: 'pre',
        resolveId: (source) => targets[source] ?? null,
      },
      runtimeRetryUrlsPlugin(),
    ],
  };
}

it('binds all recovery URLs to emitted executable chunks with original namespace exports and lazy edges', async (t) => {
  const f = await fixture(t);
  const result = await build({
    configFile: false,
    root: f.root,
    logLevel: 'error',
    plugins: f.plugins,
    build: {
      write: false,
      minify: false,
      rollupOptions: { input: f.importer, preserveEntrySignatures: 'strict' },
    },
  });
  const chunks = result.output.filter((entry) => entry.type === 'chunk');
  const entry = chunks.find((chunk) => chunk.facadeModuleId === f.importer);
  assert.ok(entry);
  for (const target of Object.values(f.targets)) {
    const chunk = chunks.find((chunk) => chunk.facadeModuleId === target);
    assert.ok(chunk, `missing emitted recovery target ${target}`);
    assert.equal(chunk.isEntry, false, `${target} must remain lazy`);
    assert.equal(chunk.isDynamicEntry, true);
    assert.ok(chunk.exports.includes('marker'), `${target} lost namespace exports`);
    assert.ok(
      entry.code.includes(path.basename(chunk.fileName)),
      `${target} lacks its emitted URL binding`
    );
  }
  assert.equal(
    entry.imports.length,
    0,
    'recovery URL bindings must not eagerly import runtime code'
  );
  assert.equal(entry.dynamicImports.length, Object.keys(f.targets).length);
});

it('binds development URLs to the Vite-resolved module identities without using browser error text', async (t) => {
  const f = await fixture(t);
  const server = await createServer({
    configFile: false,
    root: f.root,
    logLevel: 'error',
    plugins: f.plugins,
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true },
  });
  t.after(() => server.close());
  const manifest = await server.transformRequest('virtual:proto-ui/runtime-retry-urls');
  assert.ok(manifest);
  for (const target of Object.values(f.targets)) {
    assert.ok(manifest.code.includes(`/${path.relative(f.root, target).replaceAll('\\', '/')}`));
  }
  assert.ok(!manifest.code.includes('ROLLUP_FILE_URL'));
});

it('uses Vite optimized ESM URLs for the installed CommonJS React dependencies in development', async (t) => {
  const f = await fixture(t);
  const commonJs = new Set(['react', 'react-dom', 'react-dom/client']);
  f.plugins[0].resolveId = (source) => (commonJs.has(source) ? null : (f.targets[source] ?? null));
  await symlink(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../node_modules'),
    path.join(f.root, 'node_modules'),
    'dir'
  );
  const server = await createServer({
    configFile: false,
    root: f.root,
    logLevel: 'error',
    plugins: f.plugins,
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [...commonJs] },
  });
  t.after(() => server.close());
  const manifest = await server.transformRequest('virtual:proto-ui/runtime-retry-urls');
  const urls = JSON.parse(
    manifest.code.slice(
      manifest.code.indexOf('Object.freeze(') + 14,
      manifest.code.lastIndexOf(')')
    )
  );
  for (const key of ['react', 'reactDom', 'reactDomClient']) {
    assert.match(
      urls[key],
      /\/(?:node_modules\/)?\.vite\/deps\/react(?:-dom(?:_client)?)?\.js\?v=/
    );
    const esm = await server.transformRequest(urls[key]);
    assert.ok(esm.code.includes('export'), `${key} must resolve to executable ESM`);
    assert.ok(
      !esm.code.includes("module.exports = require('./cjs/"),
      `${key} must not use the raw CommonJS entry`
    );
  }
});
