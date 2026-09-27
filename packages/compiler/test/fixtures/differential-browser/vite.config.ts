import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sourceConfig from '../../../../../vitest.config';
import type { Plugin } from '../../workspace/node_modules/vite';

const root = fileURLToPath(new URL('.', import.meta.url));
const repository = path.resolve(root, '../../../../..');

/**
 * The emitted differential module is generated at test time and served by
 * Vite without writing generated code into the committed tree. A separate
 * packed-consumer check is required for the on-disk output contract.
 */
const emittedId = '/virtual:emitted-button.tsx';
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
  optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react-dom'] },
  server: { host: '127.0.0.1', fs: { allow: [repository] } },
};
