import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sourceConfig from '../../../../../vitest.config';
import {
  transformWithEsbuild,
  type Plugin,
} from '../../../../../apps/workspace/node_modules/vite/dist/node/index.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const repository = path.resolve(root, '../../../../..');

/**
 * Compile unchanged source into a virtual TSX module without writing it to the
 * tree. The null-prefixed identity avoids treating it as an on-disk dependency;
 * a separate packed consumer checks the actual written output contract.
 */
const sources: Record<string, string> = {
  'virtual:emitted-button': path.join(
    repository,
    'packages/prototypes/base/src/button/button.proto.ts'
  ),
  'virtual:pointer-props-duplicate-click': path.join(
    repository,
    'packages/prototypes/base/src/button/button.proto.ts'
  ),
  'virtual:retained-owner': path.join(root, 'retained-owner.proto.ts'),
  'virtual:retained-owner-reset-state': path.join(root, 'retained-owner.proto.ts'),
  'virtual:retained-owner-recreate-owner': path.join(root, 'retained-owner.proto.ts'),
  'virtual:retained-owner-reattach-state-loss': path.join(root, 'retained-owner.proto.ts'),
};
const emitted: Plugin = {
  name: 'compiler-differential-emitted',
  resolveId(id) {
    return Object.hasOwn(sources, id) ? `\0${id}.tsx` : null;
  },
  async load(id) {
    if (!id.startsWith('\0') || !id.endsWith('.tsx')) return null;
    const specifier = id.slice(1, -4);
    if (!Object.hasOwn(sources, specifier)) return null;
    const { compileFile } = await import('../../../../../packages/compiler/src/index');
    const result = await compileFile(sources[specifier], {
      root: repository,
      componentName: 'GeneratedButton',
    });
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    let code = result.value.output.code;
    if (specifier === 'virtual:pointer-props-duplicate-click') {
      code = code.replace(
        'run.expose.emit("click");',
        'run.expose.emit("click"); run.expose.emit("click");'
      );
    }
    if (specifier === 'virtual:retained-owner-reset-state') {
      code = code.replace(
        'run.expose.emit("viewEnded");',
        'count.set(0); run.expose.emit("viewEnded");'
      );
    } else if (specifier === 'virtual:retained-owner-recreate-owner') {
      code = code.replace(
        'return __puiAdapt(prototype, options);',
        'const Inner = __puiAdapt(prototype, options); return (props: any) => __puiReact.createElement(Inner, { ...props, key: String(props.present) });'
      );
    } else if (specifier === 'virtual:retained-owner-reattach-state-loss') {
      code = code.replace(
        'def.expose.state("count", count);',
        'def.expose.state("count", count); let __epochMounts = 0; def.lifecycle.onMounted(() => { __epochMounts += 1; if (__epochMounts === 2) count.set(0); });'
      );
    }
    if (
      specifier !== 'virtual:emitted-button' &&
      specifier !== 'virtual:retained-owner' &&
      code === result.value.output.code
    )
      throw new Error(`Mutation was not injected: ${specifier}`);
    return transformWithEsbuild(code, 'GeneratedButton.tsx', { loader: 'tsx', sourcemap: true });
  },
};

export default {
  root,
  plugins: [...(sourceConfig.plugins ?? []), emitted],
  resolve: {
    alias: {
      react: path.join(repository, 'packages/adapters/react/node_modules/react'),
      'react-dom': path.join(repository, 'packages/adapters/react/node_modules/react-dom'),
    },
  },
  optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react-dom'] },
  server: { host: '127.0.0.1', fs: { allow: [repository] } },
};
