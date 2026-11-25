import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
import { buildBrowserCompiler } from './build-browser.mjs';
import {
  assertSameInputFiles,
  browserRepositoryRoot as root,
  digest,
  hashInputFiles,
  hashMetafileInputs,
  mergeInputFiles,
  snapshotBrowserRepositoryInputs,
} from './browser-inputs.mjs';

const compilerRequire = createRequire(path.join(root, 'packages/compiler/package.json'));
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

async function bundleTarget(
  entry: string,
  alias: Record<string, string> = {},
  external: string[] = []
) {
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
    external,
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  });
  return {
    code: result.outputFiles[0].text,
    inputFiles: await hashMetafileInputs(result.metafile),
  };
}

async function browserDeliveryInputs() {
  // The compiler Worker is already bound by its own build input graph. Probe
  // the actual page/client boundary separately without pulling Node tooling in.
  const result = await build({
    absWorkingDir: root,
    entryPoints: ['apps/www/src/components/PrototypePreviewer/browser-compiler-panel.ts'],
    outdir: path.join(root, '.cache/compiler-browser-input-probe'),
    bundle: true,
    write: false,
    metafile: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
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
  const runtime = await bundleTarget(
    path.join(root, 'apps/www/src/components/PrototypePreviewer/compiled-preview-runtime.ts'),
    {},
    ['react', 'react-dom', 'react-dom/client', 'pui:compiled/component']
  );
  const targets = {
    react: {
      'pui:target/react-runtime': reactRuntime,
      react,
      'react-dom': reactDom,
      'react-dom/client': reactClient,
    },
  };
  const version = async (resolver: NodeRequire, name: string) =>
    JSON.parse(await readFile(resolver.resolve(`${name}/package.json`), 'utf8')).version as string;
  const versions = {
    react: await version(compilerRequire, 'react'),
    'react-dom': await version(compilerRequire, 'react-dom'),
  };
  const targetInputs: Record<string, Record<string, string>> = {};
  const targetModulesSha256: Record<string, string> = {};
  for (const [target, bundles] of Object.entries(targets)) {
    const modules = Object.fromEntries(
      Object.entries(bundles).map(([name, bundle]) => [name, bundle.code])
    );
    targetModulesSha256[target] = digest(JSON.stringify({ modules, previewRuntime: runtime.code }));
    targetInputs[target] = mergeInputFiles(
      runtime.inputFiles,
      ...Object.values(bundles).map((bundle) => bundle.inputFiles)
    );
    assets.set(
      `targets/${target}.json`,
      JSON.stringify({
        format: 2,
        target,
        modules,
        previewRuntime: runtime.code,
        versions,
        artifactSha256: targetModulesSha256[target],
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
    format: 2,
    kind: 'canonical-browser-build-inputs-v2',
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

function browserSourceOptions(): ts.CompilerOptions {
  const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
  if (config.error)
    throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  return ts.parseJsonConfigFileContent(config.config, ts.sys, root).options;
}

export async function readBrowserSource(id: string): Promise<BrowserSourceAsset> {
  const registration = (await browserSourceRegistrations()).find((row) => row.id === id);
  if (!registration?.entry) throw new Error(`No canonical source binding for ${id}.`);

  const entryAbs = path.resolve(root, registration.entry);
  const entryRel = path.relative(root, entryAbs).split(path.sep).join('/');
  const visited = new Map<string, string>();
  const sourceImports: Record<string, string> = {};
  const queue = [entryAbs];
  const options = browserSourceOptions();
  const trustedModules = new Set(['@proto.ui/core', '@proto.ui/core/internal', '@proto.ui/types']);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const rel = path.relative(root, current).split(path.sep).join('/');
    if (rel.startsWith('../') || path.isAbsolute(rel))
      throw new Error('A browser source binding must remain inside the repository.');
    if (visited.has(rel)) continue;
    const text = await readFile(current, 'utf8');
    visited.set(rel, text);
    const info = ts.preProcessFile(text, true, true);
    for (const imp of info.importedFiles) {
      if (trustedModules.has(imp.fileName)) {
        sourceImports[imp.fileName] = imp.fileName;
        continue;
      }
      const resolved = ts.resolveModuleName(imp.fileName, current, options, ts.sys).resolvedModule
        ?.resolvedFileName;
      if (!resolved) continue; // The real memory Program reports the missing module.
      const dependency = path.relative(root, resolved).split(path.sep).join('/');
      if (
        dependency.startsWith('../') ||
        dependency.includes('/node_modules/') ||
        dependency.startsWith('node_modules/')
      )
        continue;
      if (dependency.startsWith('packages/core/') || dependency.startsWith('packages/types/'))
        throw new Error(
          'Authoring internals require their canonical package import: ' + imp.fileName
        );
      queue.push(resolved);
      if (!imp.fileName.startsWith('.')) sourceImports[imp.fileName] = dependency;
    }
  }

  const source = visited.get(entryRel) ?? '';
  const files: Record<string, string> = Object.fromEntries(
    [...visited.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  );
  return {
    format: 1,
    id,
    entry: entryRel,
    exportName: registration.exportName ?? 'default',
    source,
    files,
    sourceImports,
    sourceGraphSha256: createHash('sha256')
      .update(JSON.stringify({ entry: entryRel, files, sourceImports }))
      .digest('hex'),
  };
}
