import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sourceConfig from '../../../../../vitest.config';
import { renderProtoStyleTokenCss } from '../../../../../packages/cli/src/services/proto-style-css';
import { STYLE_TOKENS } from './tokens';

const root = fileURLToPath(new URL('.', import.meta.url));
const repository = path.resolve(root, '../../../../..');
export default {
  root,
  plugins: [
    ...(sourceConfig.plugins ?? []),
    {
      name: 'template-style-fixture-css',
      resolveId(id: string) {
        return id === 'virtual:template-style.css' ? `\0${id}` : null;
      },
      load(id: string) {
        return id === '\0virtual:template-style.css'
          ? renderProtoStyleTokenCss(STYLE_TOKENS)
          : null;
      },
    },
  ],
  resolve: {
    alias: {
      react: path.join(repository, 'packages/adapters/react/node_modules/react'),
      'react-dom': path.join(repository, 'packages/adapters/react/node_modules/react-dom'),
      vue: path.join(
        repository,
        'packages/adapters/vue/node_modules/vue/dist/vue.runtime.esm-bundler.js'
      ),
      'vue2-runtime': path.join(
        repository,
        'packages/adapters/vue2/node_modules/vue/dist/vue.runtime.esm.js'
      ),
    },
  },
  optimizeDeps: { include: ['react', 'react-dom/client', 'vue', 'vue2-runtime'] },
  server: { fs: { allow: [repository] } },
};
