import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from '../../../../../apps/workspace/node_modules/vite';
import sourceConfig from '../../../../../vitest.config';
import {
  renderPrefixedThemeCss,
  renderProtoStyleTokenCss,
} from '../../../../../packages/cli/src/services/proto-style-css';
import { SHADCN_THEME_CSS } from '../../../../../packages/cli/src/legacy/type';
import { SHADCN_STYLE_TOKENS } from '../../../../../packages/cli/src/generated/shadcn-style-tokens';

const root = fileURLToPath(new URL('.', import.meta.url));
const repository = path.resolve(root, '../../../../..');
const styles: Plugin = {
  name: 'color-scheme-fixture-styles',
  resolveId(id) {
    return id === 'virtual:color-scheme.css' ? `\0${id}` : null;
  },
  load(id) {
    if (id === '\0virtual:color-scheme.css') {
      return `${renderPrefixedThemeCss(SHADCN_THEME_CSS)}\n${renderProtoStyleTokenCss(SHADCN_STYLE_TOKENS)}`;
    }
    return null;
  },
};

export default {
  root,
  plugins: [...(sourceConfig.plugins ?? []), styles],
  resolve: {
    alias: {
      react: path.join(repository, 'packages/adapters/react/node_modules/react'),
      'react-dom': path.join(repository, 'packages/adapters/react/node_modules/react-dom'),
      vue: path.join(
        repository,
        'packages/adapters/vue/node_modules/vue/dist/vue.runtime.esm-bundler.js'
      ),
    },
  },
  optimizeDeps: { include: ['react', 'react-dom/client', 'react-dom', 'vue'] },
  server: { host: '127.0.0.1', fs: { allow: [repository] } },
};
