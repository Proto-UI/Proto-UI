import { createRequire } from 'node:module';
import { dirname, join, posix, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';
import ts from 'typescript';
import { nativeSupportArtifacts } from '../src/native-interaction';
import {
  nativeSupportPlanFromFeatures,
  type NativeSupportFeature,
  type NativeSupportPlan,
} from '../src/native-support/plan';

export interface SupportFile {
  path: string;
  contents: string;
}
const require = createRequire(resolve(process.cwd(), 'packages/modules/positioning/package.json'));
const floating = require.resolve('@floating-ui/dom');
export function supportClosure(features: Iterable<NativeSupportFeature>) {
  const plan = nativeSupportPlanFromFeatures(features);
  return { plan, files: nativeSupportArtifacts(plan) };
}
export async function measureSupport(plan: NativeSupportPlan, files: readonly SupportFile[]) {
  const sources = new Map(files.map((file) => [file.path, file.contents]));
  const entry = `export { createNativeInteraction } from './${plan.interactionPath.slice(0, -3)}';`;
  const result = await build({
    stdin: {
      contents: entry,
      sourcefile: 'consumer-entry.ts',
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true,
    minify: true,
    treeShaking: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    write: false,
    metafile: true,
    logLevel: 'silent',
    plugins: [
      {
        name: 'emitted-support-only',
        setup(builder) {
          builder.onResolve({ filter: /^@floating-ui\/dom$/ }, () => ({ path: floating }));
          builder.onResolve({ filter: /^\./ }, (args) => {
            if (args.namespace !== 'emitted' && !args.path.startsWith('./.proto-ui/')) return;
            const path = posix.normalize(
              posix.join(
                args.namespace === 'emitted' ? posix.dirname(args.importer) : '.',
                args.path
              )
            );
            const filename = path.endsWith('.ts') ? path : path + '.ts';
            if (!sources.has(filename)) throw new Error('Missing emitted dependency ' + filename);
            return { path: filename, namespace: 'emitted' };
          });
          builder.onLoad({ filter: /.*/, namespace: 'emitted' }, (args) => ({
            contents: sources.get(args.path)!,
            loader: 'ts',
          }));
        },
      },
    ],
  });
  const code = result.outputFiles[0].text;
  return {
    sourceBytes: files.reduce((sum, file) => sum + Buffer.byteLength(file.contents), 0),
    productionBytes: Buffer.byteLength(code),
    gzipBytes: gzipSync(code).length,
    packages: plan.packages,
    resources: plan.resources,
    cleanup: plan.cleanup,
    inputs: Object.keys(result.metafile!.inputs),
    code,
  };
}
export function typecheckSupport(files: readonly SupportFile[]) {
  const anchor = resolve(process.cwd(), 'native-support-type-consumer');
  const sources = new Map(files.map((file) => [resolve(anchor, file.path), file.contents]));
  const options: ts.CompilerOptions = {
    strict: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    skipLibCheck: true,
    types: [],
    baseUrl: process.cwd(),
    paths: {
      '@floating-ui/dom': [
        join(
          dirname(require.resolve('@floating-ui/dom/package.json')),
          'dist/floating-ui.dom.d.ts'
        ),
      ],
    },
  };
  const host = ts.createCompilerHost(options),
    read = host.readFile.bind(host),
    exists = host.fileExists.bind(host),
    directory = host.directoryExists!.bind(host);
  host.readFile = (file) => sources.get(file) ?? read(file);
  host.fileExists = (file) => sources.has(file) || exists(file);
  host.directoryExists = (path) => path.startsWith(anchor) || directory(path);
  const diagnostics = ts.getPreEmitDiagnostics(
    ts.createProgram([...sources.keys()], options, host)
  );
  return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (file) => file,
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => '\n',
  });
}
export function loadSupport(files: readonly SupportFile[], floatingOverride?: unknown) {
  const sources = new Map<string, string>();
  for (const file of files) {
    if (sources.has(file.path) && sources.get(file.path) !== file.contents)
      throw new Error('Conflicting support identity ' + file.path);
    sources.set(file.path, file.contents);
  }
  const cache = new Map<string, Record<string, unknown>>();
  function load(filename: string): Record<string, unknown> {
    const previous = cache.get(filename);
    if (previous) return previous;
    const contents = sources.get(filename);
    if (contents === undefined) throw new Error('Missing emitted support ' + filename);
    const exports: Record<string, unknown> = {};
    cache.set(filename, exports);
    const code = ts.transpileModule(contents, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    new Function('require', 'exports', code)(
      (specifier: string) =>
        specifier === '@floating-ui/dom'
          ? (floatingOverride ?? require(specifier))
          : load(posix.normalize(posix.join(posix.dirname(filename), specifier + '.ts'))),
      exports
    );
    return exports;
  }
  return load;
}
