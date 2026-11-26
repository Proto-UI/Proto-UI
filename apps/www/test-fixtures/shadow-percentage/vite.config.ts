import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sourceConfig from '../../../../vitest.config';
import { collectProtoStyleTokens } from '../../../../packages/cli/src/services/prototype-style-tokens';
import {
  renderPrefixedThemeCss,
  renderProtoShadowSplitStyleArtifact,
  renderProtoStyleTokenCss,
} from '../../../../packages/cli/src/services/proto-style-css';
import { SHADCN_THEME_CSS } from '../../../../packages/cli/src/legacy/type';
import { SHADCN_STYLE_TOKENS } from '../../../../packages/cli/src/generated/shadcn-style-tokens';

const root = fileURLToPath(new URL('.', import.meta.url));
const tokens = collectProtoStyleTokens(root).then((authored) => [
  ...new Set([...authored, ...SHADCN_STYLE_TOKENS]),
]);

export default {
  root,
  plugins: [
    ...(sourceConfig.plugins ?? []),
    {
      name: 'finite-shadow-percentage-companion',
      resolveId(id: string) {
        return id.startsWith('virtual:percentage-') ? `\0${id}` : null;
      },
      async load(id: string) {
        if (id === '\0virtual:percentage-artifact')
          return `export default ${JSON.stringify(renderProtoShadowSplitStyleArtifact(await tokens))};`;
        if (id === '\0virtual:percentage-style.css')
          return `${renderPrefixedThemeCss(SHADCN_THEME_CSS)}\n${renderProtoStyleTokenCss(await tokens)}`;
        return null;
      },
    },
  ],
  server: { host: '127.0.0.1', fs: { allow: [path.resolve(root, '../../../..')] } },
};
