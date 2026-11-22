import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBrowserCompiler } from './build-browser.mjs';
import { FileSourceGraph } from '../../packages/compiler/src/source-loader';

const root = fileURLToPath(new URL('../../', import.meta.url));
const compilerRequire = createRequire(path.join(root, 'packages/compiler/package.json'));
const wwwRequire = createRequire(path.join(root, 'apps/www/package.json'));
let preparation: Promise<Map<string, string>> | undefined;

export interface BrowserSourceAsset {
  format: 1;
  id: string;
  entry: string;
  exportName: string;
  source: string;
  files: Record<string, string>;
  sourceImports: Record<string, string>;
  sourceGraphSha256: string;
}

async function bundleTarget(entry: string, external: string[] = []) {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    external,
    define: {
      'process.env.NODE_ENV': '"production"',
      '__VUE_OPTIONS_API__': 'true',
      '__VUE_PROD_DEVTOOLS__': 'false',
      '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': 'false',
    },
  });
  return result.outputFiles[0].text;
}

/** Only trusted compiler/target code is bundled here. Authored proto is served as inert text. */
export function prepareBrowserAssets(): Promise<Map<string, string>> {
  if (preparation) return preparation;
  preparation = (async () => {
    const directory = path.join(root, '.cache/compiler-browser');
    await buildBrowserCompiler(directory);
    const assets = new Map<string, string>();
    assets.set('compiler.js', await readFile(path.join(directory, 'compiler.js'), 'utf8'));
    assets.set('build.json', await readFile(path.join(directory, 'build.json'), 'utf8'));
    const react = await bundleTarget(compilerRequire.resolve('react'));
    const reactDom = await bundleTarget(compilerRequire.resolve('react-dom'), ['react']);
    const reactClient = await bundleTarget(compilerRequire.resolve('react-dom/client'), [
      'react',
      'react-dom',
    ]);
    const vue = await bundleTarget(compilerRequire.resolve('vue/dist/vue.runtime.esm-bundler.js'));
    const vue2 = await bundleTarget(wwwRequire.resolve('vue2-runtime/dist/vue.runtime.esm.js'));
    const floatingRequire = createRequire(
      path.join(root, 'packages/modules/positioning/package.json')
    );
    const floating = await bundleTarget(floatingRequire.resolve('@floating-ui/dom'));
    const targets = {
      'web-component-source-v1': { '@floating-ui/dom': floating },
      'react-dom-source-v1': {
        react,
        'react-dom': reactDom,
        'react-dom/client': reactClient,
        '@floating-ui/dom': floating,
      },
      'vue-source-v1': { vue, '@floating-ui/dom': floating },
      'vue2-source-v1': { vue: vue2, '@floating-ui/dom': floating },
    };
    const version = async (resolver: NodeRequire, name: string) =>
      JSON.parse(await readFile(resolver.resolve(`${name}/package.json`), 'utf8'))
        .version as string;
    const versions = {
      react: await version(compilerRequire, 'react'),
      'react-dom': await version(compilerRequire, 'react-dom'),
      vue: await version(compilerRequire, 'vue'),
      '@floating-ui/dom': await version(floatingRequire, '@floating-ui/dom'),
    };
    for (const [profile, modules] of Object.entries(targets)) {
      const selected =
        profile === 'vue2-source-v1'
          ? { ...versions, vue: await version(wwwRequire, 'vue2-runtime') }
          : versions;
      assets.set(
        `targets/${profile}.json`,
        JSON.stringify({
          format: 1,
          profile,
          modules,
          versions: selected,
          modulesSha256: createHash('sha256').update(JSON.stringify(modules)).digest('hex'),
        })
      );
    }
    return assets;
  })().catch((error) => {
    preparation = undefined;
    throw error;
  });
  return preparation;
}

let registrations: Promise<{ id: string; entry?: string; exportName?: string }[]> | undefined;
export function browserSourceRegistrations() {
  return (registrations ??= readFile(
    path.join(root, 'internal/compiler/website-demo-migrations.json'),
    'utf8'
  ).then((text) => JSON.parse(text).prototypes));
}

export async function readBrowserSource(id: string): Promise<BrowserSourceAsset> {
  const registration = (await browserSourceRegistrations()).find((row) => row.id === id);
  if (!registration?.entry) throw new Error(`No canonical source binding for ${id}.`);
  const graph = new FileSourceGraph(root);
  const snapshot = await graph.load(await graph.entry(registration.entry));
  if (snapshot.failures.length) throw snapshot.failures[0];
  const source = snapshot.files[snapshot.entry];
  const files = Object.fromEntries(
    Object.entries(snapshot.files).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  );
  const sourceImports = { ...snapshot.sourceImports };
  return {
    format: 1,
    id,
    entry: snapshot.entry,
    exportName: registration.exportName ?? 'default',
    source,
    files,
    sourceImports,
    sourceGraphSha256: createHash('sha256')
      .update(JSON.stringify({ entry: snapshot.entry, files, sourceImports }))
      .digest('hex'),
  };
}
