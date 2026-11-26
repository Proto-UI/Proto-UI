import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sourceConfig from '../../../../vitest.config';
import {
  renderPrefixedThemeCss,
  renderProtoStyleTokenCss,
} from '../../../../packages/cli/src/services/proto-style-css';
import { SHADCN_THEME_CSS, BRUTALIST_THEME_CSS } from '../../../../packages/cli/src/legacy/type';
import { SHADCN_STYLE_TOKENS } from '../../../../packages/cli/src/generated/shadcn-style-tokens';
import { BRUTALIST_STYLE_TOKENS } from '../../../../packages/cli/src/generated/brutalist-style-tokens';
import { DRAFT_FAMILY_STYLE_TOKENS } from '../../../../packages/cli/src/generated/draft-family-style-tokens';

const root = fileURLToPath(new URL('.', import.meta.url));
const repository = path.resolve(root, '../../../..');
const tokens = [
  ...new Set([
    ...SHADCN_STYLE_TOKENS,
    ...BRUTALIST_STYLE_TOKENS,
    ...Object.values(DRAFT_FAMILY_STYLE_TOKENS).flat(),
  ]),
];
export default {
  root,
  plugins: [
    ...(sourceConfig.plugins ?? []),
    {
      name: 'field-contract-companion-styles',
      resolveId(id: string) {
        return id === 'virtual:field-companion.css' ? `\0${id}` : null;
      },
      load(id: string) {
        if (id !== '\0virtual:field-companion.css') return null;
        const brutalist = renderPrefixedThemeCss(BRUTALIST_THEME_CSS).replaceAll(
          ':root',
          ':root[data-family="brutalist"]'
        );
        return `${renderPrefixedThemeCss(SHADCN_THEME_CSS)}\n${brutalist}\n${renderProtoStyleTokenCss(tokens)}`;
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
  optimizeDeps: { include: ['react', 'react-dom/client', 'react-dom', 'vue', 'vue2-runtime'] },
  server: { host: '127.0.0.1', fs: { allow: [repository] } },
};
