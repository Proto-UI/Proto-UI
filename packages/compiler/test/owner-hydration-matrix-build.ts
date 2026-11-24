import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import { build } from 'esbuild';
import { compileOwnerMatrix } from './owner-hydration-matrix-fixture';

export async function buildOwnerMatrix() {
  const fixture = await compileOwnerMatrix();
  const compilerDirectory = fileURLToPath(new NodeURL('../', import.meta.url));
  const sources = new Map(fixture.artifacts);
  sources.set(
    'entry.ts',
    `import * as React from 'react';import * as Vue from 'vue';import Vue2 from 'owner-vue2';
import {createOwnerBrowserMatrix} from 'owner-matrix-consumer';
import * as rp from './react/Provider.tsx';import * as rc from './react/Consumer.tsx';
import * as vp from './vue/Provider.ts';import * as vc from './vue/Consumer.ts';
import * as lp from './vue2/Provider.js';import * as lc from './vue2/Consumer.js';
const matrix=createOwnerBrowserMatrix({React,Vue,Vue2},{react:{provider:rp,consumer:rc},vue:{provider:vp,consumer:vc},vue2:{provider:lp,consumer:lc}});
export const run=matrix.run;export const dispose=matrix.dispose;`
  );
  const vue2Require = createRequire(
    new NodeURL('../../adapters/vue2/package.json', import.meta.url)
  );
  const positioningRequire = createRequire(
    new NodeURL('../../modules/positioning/package.json', import.meta.url)
  );
  const bundled = await build({
    absWorkingDir: process.cwd(),
    entryPoints: ['entry.ts'],
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'OwnerBrowserMatrix',
    platform: 'browser',
    target: 'es2022',
    define: {
      'process.env.NODE_ENV': '"development"',
      __VUE_OPTIONS_API__: 'true',
      __VUE_PROD_DEVTOOLS__: 'false',
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'true',
    },
    metafile: true,
    plugins: [
      {
        name: 'actual-owner-matrix-artifacts',
        setup(builder) {
          builder.onResolve({ filter: /.*/ }, (args) => {
            if (args.path === 'owner-vue2')
              return { path: vue2Require.resolve('vue/dist/vue.runtime.esm.js') };
            if (args.path === 'owner-matrix-consumer')
              return {
                path: fileURLToPath(
                  new NodeURL('./owner-hydration-matrix-consumer.ts', import.meta.url)
                ),
              };
            if (args.path === '@floating-ui/dom')
              return { path: positioningRequire.resolve(args.path) };
            if (args.namespace && args.namespace !== 'owner-matrix') return undefined;
            const relative = path.posix.normalize(
              path.posix.join(path.posix.dirname(args.importer || 'entry.ts'), args.path)
            );
            for (const candidate of [relative, `${relative}.ts`, `${relative}.js`])
              if (sources.has(candidate)) return { path: candidate, namespace: 'owner-matrix' };
            if (!args.path.startsWith('.')) return undefined;
            throw new Error(`Generated browser dependency escaped artifact closure: ${relative}`);
          });
          builder.onLoad({ filter: /.*/, namespace: 'owner-matrix' }, (args) => ({
            contents: sources.get(args.path)!,
            loader: args.path.endsWith('.tsx') ? 'tsx' : 'ts',
            resolveDir: compilerDirectory,
          }));
        },
      },
    ],
  });
  return {
    ...fixture,
    bundle: bundled.outputFiles[0].text,
    browserInputs: Object.keys(bundled.metafile.inputs),
  };
}
