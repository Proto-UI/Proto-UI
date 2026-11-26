import path from 'node:path';
import { expect, it } from 'vitest';
import { SHADCN_STYLE_TOKENS } from '../src/generated/shadcn-style-tokens';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';
import {
  renderProtoStyleTokenCss,
  renderProtoShadowStyleTokenCss,
} from '../src/services/proto-style-css';

it('delivers the public Shadcn Collapsible profile padding in entry and preset CSS', async () => {
  const tokens = await collectProtoStyleTokensFromFiles([
    path.resolve('packages/prototypes/shadcn/src/collapsible/content.proto.ts'),
  ]);
  // Rhea/Luma/Maia replace the default p-3 with p-3.5 at runtime. A preset
  // containing only p-3 leaves those actual Content hosts without any padding.
  expect(tokens).toContain('p-3.5');
  expect(SHADCN_STYLE_TOKENS).toContain('p-3.5');
  for (const inventory of [tokens, SHADCN_STYLE_TOKENS]) {
    for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
      const css = render(inventory);
      expect(css).toContain('[data-pui-style~="p-3.5"]');
      expect(css).toContain('padding: 0.875rem;');
    }
  }
}, 30_000);
