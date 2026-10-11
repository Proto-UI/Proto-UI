import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { collectProtoStyleTokens } from '../../../../../packages/cli/src/services/prototype-style-tokens';
import {
  renderProtoStyleTokenCss,
  renderProtoShadowStyleTokenCss,
} from '../../../../../packages/cli/src/services/proto-style-css';

describe('Runtime Tabs complete source CSS closure', () => {
  for (const family of ['shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'])
    it(`${family} retains both default and underline paint in document and Shadow CSS`, async () => {
      const raw = await collectProtoStyleTokens(
        path.resolve('packages/prototypes', family, 'src/tabs')
      );
      if (!raw.every((token): token is string => typeof token === 'string'))
        throw new Error('Non-string style token');
      const tokens = raw;
      for (const token of [
        'border-b-2',
        'border-foreground',
        'bg-transparent',
        'text-muted-foreground',
        'overflow-x-auto',
        'flex-none',
        'gap-6',
        'outline-ring',
      ])
        expect(tokens).toContain(token);
      for (const css of [
        renderProtoStyleTokenCss(tokens),
        renderProtoShadowStyleTokenCss(tokens),
      ]) {
        expect(css.match(/Unsupported Proto UI style tokens:[\s\S]*?\*\//)?.[0]).toBeUndefined();
        expect(css).toContain('border-bottom-width: 2px;');
        expect(css).toContain('overflow-x: auto;');
        expect(css).toContain('gap: 1.5rem;');
      }
    });
});
