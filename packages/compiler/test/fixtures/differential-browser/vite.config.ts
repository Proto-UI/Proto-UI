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
const emittedId = '\0virtual:emitted-button.tsx';
const emitted: Plugin = {
  name: 'compiler-differential-emitted',
  resolveId(id) {
    return id === 'virtual:emitted-button' ? emittedId : null;
  },
  async load(id) {
    if (id !== emittedId) return null;
    const { compileFile } = await import('../../../../../packages/compiler/src/index');
    const result = await compileFile(
      path.join(repository, 'packages/prototypes/base/src/button/button.proto.ts'),
      { root: repository, componentName: 'GeneratedButton' }
    );
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    return transformWithEsbuild(result.value.output.code, 'GeneratedButton.tsx', {
      loader: 'tsx',
      sourcemap: true,
    });
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
