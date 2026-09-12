import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from '../../../../../apps/workspace/node_modules/vite';
import sourceConfig from '../../../../../vitest.config';
import {
  renderPrefixedThemeCss,
  renderProtoStyleTokenCss,
} from '../../../../../packages/cli/src/services/proto-style-css';
import { BRUTALIST_STYLE_TOKENS } from '../../../../../packages/cli/src/generated/brutalist-style-tokens';
import { BRUTALIST_THEME_CSS } from '../../../../../packages/cli/src/generated/brutalist-theme';
import * as messageStyles from '../../../../../packages/compositions/chatui/src/message/styles';
import * as codeStyles from '../../../../../packages/compositions/chatui/src/code-block/styles';

const root = fileURLToPath(new URL('.', import.meta.url));
const repository = path.resolve(root, '../../../../..');
const styles = [...Object.values(messageStyles), ...Object.values(codeStyles)].flatMap((value) =>
  typeof value === 'string' ? [value] : Object.values(value)
);
const tokens = [
  ...new Set([...styles.flatMap((value) => value.split(/\s+/)), ...BRUTALIST_STYLE_TOKENS]),
];
const fixtureAssets: Plugin = {
  name: 'private-message-fixture',
  resolveId(id) {
    if (id === 'virtual:message-styles.css') return `\0${id}`;
    return null;
  },
  load(id) {
    if (id === '\0virtual:message-styles.css') {
      return `${renderPrefixedThemeCss(BRUTALIST_THEME_CSS)}\n${renderProtoStyleTokenCss(tokens)}`;
    }
    return null;
  },
};

export default {
  root,
  plugins: [...(sourceConfig.plugins ?? []), fixtureAssets],
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
  optimizeDeps: { include: ['react', 'react-dom/client', 'vue'] },
  server: { host: '127.0.0.1', port: 5173, fs: { allow: [repository] } },
};
