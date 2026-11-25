import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  browserRepositoryRoot as root,
  hashMetafileInputs,
  mergeInputFiles,
} from './browser-inputs.mjs';
import { createBrowserAuthoringEnvironment } from './browser-authoring.mjs';

const compilerRoot = path.join(root, 'packages/compiler');
const require = createRequire(path.join(compilerRoot, 'package.json'));
export async function buildBrowserCompiler(
  destination = path.join(root, '.cache/compiler-browser')
) {
  const authoring = await createBrowserAuthoringEnvironment();
  const serializedAuthoring = JSON.stringify(authoring.environment);
  const result = await build({
    absWorkingDir: root,
    entryPoints: ['packages/compiler/src/browser/worker.ts'],
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    target: 'es2022',
    minify: true,
    metafile: true,
    define: { process: 'undefined' },
    plugins: [
      {
        name: 'browser-authoring-data',
        setup(builder) {
          builder.onResolve({ filter: /^pui:compiler-authoring$/ }, () => ({
            path: 'environment',
            namespace: 'browser-authoring-data',
          }));
          builder.onLoad({ filter: /.*/, namespace: 'browser-authoring-data' }, () => ({
            contents: serializedAuthoring,
            loader: 'json',
          }));
          // TypeScript's official distribution contains an optional Node sys.
          // `process` is unavailable in this build, and the compiler supplies its
          // real memory host. No filesystem or process polyfill is installed.
          builder.onResolve(
            { filter: /^(node:)?(fs|path|os|crypto|buffer|perf_hooks|inspector)$/ },
            ({ path: id, importer }) => {
              if (!importer.endsWith('/typescript/lib/typescript.js'))
                throw new Error(
                  'Node dependency reached the browser compiler: ' + id + ' from ' + importer
                );
              return { path: id, external: true };
            }
          );
        },
      },
    ],
  });
  const bundle = result.outputFiles[0].text;
  const typescript = JSON.parse(await readFile(require.resolve('typescript/package.json'), 'utf8'));
  const manifest = {
    format: 2,
    compilerSha256: createHash('sha256').update(bundle).digest('hex'),
    typescriptVersion: typescript.version,
    execution: 'worker-js',
    targets: ['react'],
    authoringSha256: createHash('sha256').update(serializedAuthoring).digest('hex'),
  };
  await mkdir(destination, { recursive: true });
  await writeFile(path.join(destination, 'compiler.js'), bundle);
  await writeFile(path.join(destination, 'build.json'), JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(
    path.join(destination, 'inputs.json'),
    JSON.stringify(result.metafile.inputs, null, 2) + '\n'
  );
  const inputFiles = mergeInputFiles(
    authoring.inputFiles,
    await hashMetafileInputs({
      ...result.metafile,
      inputs: Object.fromEntries(
        Object.entries(result.metafile.inputs).filter(
          ([name]) => !name.startsWith('browser-authoring-data:')
        )
      ),
    })
  );
  return { destination, bytes: Buffer.byteLength(bundle), ...manifest, inputFiles };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { inputFiles, ...summary } = await buildBrowserCompiler(
    path.resolve(root, process.argv[2] ?? '.cache/compiler-browser')
  );
  console.log(JSON.stringify({ ...summary, inputFiles: Object.keys(inputFiles).length }));
}
