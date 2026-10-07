import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sourceConfig from '../../../../../vitest.config';
import {
  transformWithEsbuild,
  type Plugin,
} from '../../../../../apps/workspace/node_modules/vite/dist/node/index.js';
import { compileFile } from '../../../src/compile';

const root = fileURLToPath(new URL('.', import.meta.url));
const repository = path.resolve(root, '../../../../..');
const profiles = {
  runtime: 'react-runtime-v1',
  source: 'react-dom-source-v1',
  'source-duplicate-activation': 'react-dom-source-v1',
} as const;
const prefix = 'virtual:presentation/';
const modules = new Map<string, string>();
const compiling = new Map<string, Promise<void>>();

async function compile(side: keyof typeof profiles) {
  let pending = compiling.get(side);
  if (!pending) {
    pending = (async () => {
      const result = await compileFile(path.join(root, 'presentation.proto.ts'), {
        root: repository,
        componentName: 'Presentation',
        profile: profiles[side],
      });
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
      let code = result.value.output.code;
      if (side === 'source-duplicate-activation') {
        // Mutate generated behavior, not the fixture, CSS, or observation stream.
        const needle = 'run.expose.emit("click");';
        if (code.split(needle).length !== 2)
          throw new Error('Expected exactly one generated Button activation signal');
        code = code.replace(needle, `${needle} ${needle}`);
      }
      modules.set(`${prefix}${side}/Component.tsx`, code);
      for (const artifact of result.value.output.supportingFiles ?? [])
        modules.set(`${prefix}${side}/${artifact.path}`, artifact.contents);
    })();
    compiling.set(side, pending);
  }
  await pending;
}

const generated: Plugin = {
  name: 'compiler-source-presentation',
  async resolveId(id, importer) {
    if (id.startsWith(prefix)) return `\0${id}`;
    if (importer?.startsWith(`\0${prefix}`) && id.startsWith('.')) {
      const parent = importer.slice(1);
      const side = parent.slice(prefix.length).split('/')[0] as keyof typeof profiles;
      await compile(side);
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(parent), id));
      const candidate = [resolved, `${resolved}.ts`, `${resolved}.tsx`].find((name) =>
        modules.has(name)
      );
      if (!candidate) throw new Error(`Missing generated supporting artifact ${id} from ${parent}`);
      return `\0${candidate}`;
    }
    return null;
  },
  async load(id) {
    if (!id.startsWith(`\0${prefix}`)) return null;
    const name = id.slice(1);
    const side = name.slice(prefix.length).split('/')[0] as keyof typeof profiles;
    if (!Object.hasOwn(profiles, side)) throw new Error(`Unknown presentation profile ${side}`);
    await compile(side);
    const code = modules.get(name);
    if (code === undefined) throw new Error(`Missing generated module ${name}`);
    return transformWithEsbuild(code, name, {
      loader: name.endsWith('.tsx') ? 'tsx' : 'ts',
      sourcemap: true,
    });
  },
};

export default {
  root,
  plugins: [...(sourceConfig.plugins ?? []), generated],
  resolve: {
    alias: {
      react: path.join(repository, 'packages/adapters/react/node_modules/react'),
      'react-dom': path.join(repository, 'packages/adapters/react/node_modules/react-dom'),
    },
  },
  optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react-dom'] },
  server: { host: '127.0.0.1', fs: { allow: [repository] } },
};
