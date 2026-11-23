import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBrowserCompiler } from './build-browser.mjs';
import { FileSourceGraph } from '../../packages/compiler/src/source-loader';
import {
  assertSameInputFiles,
  digest,
  hashInputFiles,
  hashMetafileInputs,
  mergeInputFiles,
  snapshotBrowserRepositoryInputs,
} from './browser-inputs.mjs';

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

async function bundleTarget(entry: string, alias: Record<string, string> = {}) {
  const result = await build({
    absWorkingDir: root,
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    metafile: true,
    alias,
    define: {
      'process.env.NODE_ENV': '"production"',
      '__VUE_OPTIONS_API__': 'true',
      '__VUE_PROD_DEVTOOLS__': 'false',
      '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': 'false',
    },
  });
  return {
    code: result.outputFiles[0].text,
    inputFiles: await hashMetafileInputs(result.metafile),
  };
}

async function browserDeliveryInputs() {
  // Probe the actual entry imports, including the separate module Worker and
  // its binary WASM dependency. These probe bundles are not served as UI code.
  const result = await build({
    absWorkingDir: root,
    entryPoints: [
      'apps/www/src/components/PrototypePreviewer/browser-compiler-panel.ts',
      'packages/compiler/src/browser/worker.ts',
    ],
    outdir: path.join(root, '.cache/compiler-browser-input-probe'),
    bundle: true,
    write: false,
    metafile: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    loader: { '.wasm': 'file' },
    plugins: [
      {
        name: 'wasm-url-input',
        setup(builder) {
          builder.onResolve({ filter: /\/wasm\?url$/ }, ({ path: id }) => ({
            path: compilerRequire.resolve(id.slice(0, -4)),
          }));
        },
      },
    ],
  });
  return hashMetafileInputs(result.metafile);
}

/** Real framework packages, including an explicit ESM boundary for React's CJS entries. */
export async function buildBrowserTargets() {
  const assets = new Map<string, string>();
  const targetRoot = path.join(root, 'scripts/compiler/browser-targets');
  const reactRuntime = await bundleTarget(path.join(targetRoot, 'react-runtime.mjs'), {
    react: compilerRequire.resolve('react'),
    'react-dom': compilerRequire.resolve('react-dom'),
    'react-dom/client': compilerRequire.resolve('react-dom/client'),
  });
  const facade = async (file: string) => ({
    code: await readFile(path.join(targetRoot, file), 'utf8'),
    inputFiles: await hashInputFiles([path.join(targetRoot, file)]),
  });
  const react = await facade('react.mjs');
  const reactDom = await facade('react-dom.mjs');
  const reactClient = await facade('react-client.mjs');
  const vue = await bundleTarget(compilerRequire.resolve('vue/dist/vue.runtime.esm-bundler.js'));
  const vue2 = await bundleTarget(wwwRequire.resolve('vue2-runtime/dist/vue.runtime.esm.js'));
  const floatingRequire = createRequire(
    path.join(root, 'packages/modules/positioning/package.json')
  );
  const floating = await bundleTarget(floatingRequire.resolve('@floating-ui/dom'));
  const targets = {
    'web-component-source-v1': { '@floating-ui/dom': floating },
    'react-dom-source-v1': {
      'pui:target/react-runtime': reactRuntime,
      react,
      'react-dom': reactDom,
      'react-dom/client': reactClient,
      '@floating-ui/dom': floating,
    },
    'vue-source-v1': { vue, '@floating-ui/dom': floating },
    'vue2-source-v1': { vue: vue2, '@floating-ui/dom': floating },
  };
  const version = async (resolver: NodeRequire, name: string) =>
    JSON.parse(await readFile(resolver.resolve(`${name}/package.json`), 'utf8')).version as string;
  const versions = {
    react: await version(compilerRequire, 'react'),
    'react-dom': await version(compilerRequire, 'react-dom'),
    vue: await version(compilerRequire, 'vue'),
    '@floating-ui/dom': await version(floatingRequire, '@floating-ui/dom'),
  };
  const targetInputs: Record<string, Record<string, string>> = {};
  const targetModulesSha256: Record<string, string> = {};
  for (const [profile, bundles] of Object.entries(targets)) {
    const modules = Object.fromEntries(
      Object.entries(bundles).map(([name, bundle]) => [name, bundle.code])
    );
    targetModulesSha256[profile] = digest(JSON.stringify(modules));
    targetInputs[profile] = mergeInputFiles(
      ...Object.values(bundles).map((bundle) => bundle.inputFiles)
    );
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
        modulesSha256: targetModulesSha256[profile],
      })
    );
  }
  return { assets, targetInputs, targetModulesSha256 };
}

/** An uncached build is also the independent current-source receipt oracle. */
export async function buildBrowserAssets(
  directory = path.join(root, '.cache/compiler-browser')
): Promise<Map<string, string>> {
  const before = await snapshotBrowserRepositoryInputs();
  const compiler = await buildBrowserCompiler(directory);
  const assets = new Map<string, string>();
  assets.set('compiler.js', await readFile(path.join(directory, 'compiler.js'), 'utf8'));
  assets.set('build.json', await readFile(path.join(directory, 'build.json'), 'utf8'));
  const { assets: targets, targetInputs, targetModulesSha256 } = await buildBrowserTargets();
  for (const [name, contents] of targets) assets.set(name, contents);
  const deliveryInputs = await browserDeliveryInputs();
  const after = await snapshotBrowserRepositoryInputs();
  assertSameInputFiles(before, after);
  const sourceFiles = mergeInputFiles(
    after,
    compiler.inputFiles,
    ...Object.values(targetInputs),
    deliveryInputs
  );
  const manifest = {
    format: 1,
    kind: 'canonical-browser-build-inputs-v1',
    sourcePolicy: 'workspace-superset-and-esbuild-inputs-v1',
    compilerBuild: JSON.parse(assets.get('build.json')!),
    targetModulesSha256,
    inputGroups: {
      compiler: Object.keys(compiler.inputFiles),
      targets: Object.fromEntries(
        Object.entries(targetInputs).map(([profile, inputs]) => [profile, Object.keys(inputs)])
      ),
      delivery: Object.keys(deliveryInputs),
    },
    assets: Object.fromEntries([...assets].map(([name, contents]) => [name, digest(contents)])),
    sourceFiles,
  };
  assets.set('input-manifest.json', JSON.stringify(manifest));
  return assets;
}

/** Only trusted compiler/target code is bundled here. Authored proto is served as inert text. */
export function prepareBrowserAssets(): Promise<Map<string, string>> {
  if (preparation) return preparation;
  preparation = buildBrowserAssets().catch((error) => {
    preparation = undefined;
    throw error;
  });
  return preparation;
}

interface BrowserSourceRegistration {
  id: string;
  entry?: string;
  exportName?: string;
}
let registrations: Promise<BrowserSourceRegistration[]> | undefined;
export function browserSourceRegistrations(): Promise<BrowserSourceRegistration[]> {
  return (registrations ??= readFile(
    path.join(root, 'internal/compiler/website-demo-migrations.json'),
    'utf8'
  ).then((text): BrowserSourceRegistration[] => JSON.parse(text).prototypes));
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
