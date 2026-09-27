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
 * Compile the unchanged source into a virtual TSX module. The null-prefixed
 * module identity keeps dependency scanning from treating it as an on-disk file.
 */
const emitted: Plugin = {
  name: 'compiler-differential-emitted',
  resolveId(id) {
    return id === 'virtual:emitted-button' ? '\0virtual:emitted-button.tsx' : null;
  },
  async load(id) {
    if (id !== '\0virtual:emitted-button.tsx') return null;
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
  optimizeDeps: { include: ['react', 'react-dom/client', 'react-dom'] },
  server: { host: '127.0.0.1', fs: { allow: [repository] } },
};
