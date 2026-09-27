import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sourceConfig from '../../../../../vitest.config';
import type { Plugin } from '../../workspace/node_modules/vite';

const root = fileURLToPath(new URL('.', import.meta.url));
const repository = path.resolve(root, '../../../../..');

/**
 * The emitted differential module is generated at test time and written here
 * as a real on-disk source file, mirroring the compileFile writeCompilation
 * destination contract. This virtual plugin keeps that file out of the
 * committed tree while letting Vite serve it like any other module.
 */
const emitted: Plugin = {
  name: 'compiler-differential-emitted',
  resolveId(id) {
    return id === 'virtual:emitted-button' ? '/virtual:emitted-button.tsx' : null;
  },
  async load(id) {
    if (id !== '/virtual:emitted-button.tsx') return null;
    const { compileFile } = await import('../../../../../packages/compiler/src/index');
    const result = await compileFile(
      path.join(repository, 'packages/prototypes/base/src/button/button.proto.ts'),
      { root: repository, componentName: 'GeneratedButton' }
    );
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    return result.value.output.code;
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
