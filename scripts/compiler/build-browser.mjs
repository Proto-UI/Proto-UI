import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const compilerRoot = path.join(root, 'packages/compiler');
const require = createRequire(path.join(compilerRoot, 'package.json'));
const destination = path.resolve(root, process.argv[2] ?? '.cache/compiler-browser');
const result = await build({
  absWorkingDir: root,
  entryPoints: ['packages/compiler/src/browser/entry.ts'],
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'iife',
  globalName: '__puiCompiler',
  target: 'es2022',
  minify: true,
  metafile: true,
  define: { process: 'undefined' },
  plugins: [
    {
      name: 'closed-compiler-host',
      setup(builder) {
        builder.onResolve({ filter: /^(node:)?crypto$/ }, () => ({
          path: path.join(compilerRoot, 'src/browser/crypto-binding.ts'),
        }));
        builder.onResolve({ filter: /^(node:)?path$/ }, () => ({
          path: require.resolve('path-browserify'),
        }));
        // Node-only source-loading exports and TypeScript's unavailable Node sys
        // remain unreachable. Do not supply fake filesystem implementations.
        builder.onResolve(
          { filter: /^(node:)?(fs(?:\/promises)?|os|buffer|perf_hooks)$/ },
          ({ path: id }) => ({
            path: id,
            external: true,
            sideEffects: false,
          })
        );
      },
    },
  ],
});
const bundle = result.outputFiles[0].text;
const typescript = JSON.parse(await readFile(require.resolve('typescript/package.json'), 'utf8'));
const manifest = {
  format: 1,
  compilerSha256: createHash('sha256').update(bundle).digest('hex'),
  typescriptVersion: typescript.version,
  execution: 'quickjs-wasm',
};
await mkdir(destination, { recursive: true });
await writeFile(path.join(destination, 'compiler.js'), bundle);
await writeFile(path.join(destination, 'build.json'), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(
  path.join(destination, 'inputs.json'),
  JSON.stringify(result.metafile.inputs, null, 2) + '\n'
);
console.log(JSON.stringify({ destination, bytes: Buffer.byteLength(bundle), ...manifest }));
