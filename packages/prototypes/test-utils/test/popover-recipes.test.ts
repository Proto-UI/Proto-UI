import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectProtoStyleTokensFromFiles } from '../../../cli/src/services/prototype-style-tokens';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';

describe('Popover bounded surface recipes', () => {
  for (const [family, required, forbidden] of [
    [
      'shadcn',
      ['w-72', 'p-2.5', 'gap-2.5', 'ring-1', 'ring-foreground/10'],
      // Multi-profile recipes now live in recipes.ts: p-4/border remain lawful
      // on vega/maia/luma/rhea/new-york-v4, so only genuinely absent panel
      // values stay forbidden.
      ['w-80', 'border-2'],
    ],
    [
      'brutalist',
      ['w-72', 'rounded-base', 'gap-4', 'border-2'],
      ['w-80', 'rounded-none', 'shadow-[4px_4px_0_0_var(--pui-foreground)]'],
    ],
  ] as const) {
    it(`${family} has the component recipe rather than a generic elevated panel`, async () => {
      const files = [`packages/prototypes/${family}/src/popover/content.proto.ts`];
      // Shadcn recipes were moved to the shared profile table; collect both so
      // the closure still sees every authored recipe token.
      if (family === 'shadcn') files.push(`packages/prototypes/${family}/src/popover/recipes.ts`);
      const tokens = await collectProtoStyleTokensFromFiles(
        files.map((file) => path.resolve(file))
      );
      for (const token of required) expect(tokens).toContain(token);
      for (const token of forbidden) expect(tokens).not.toContain(token);
      if (family === 'brutalist')
        expect(tokens.some((token) => String(token).startsWith('shadow-'))).toBe(false);
      expect(tokens).toEqual(
        expect.arrayContaining([
          'max-w-[var(--proto-ui-available-width)]',
          'max-h-[var(--proto-ui-available-height)]',
          'overflow-y-auto',
        ])
      );
      expect(renderProtoStyleTokenCss(tokens as string[])).not.toContain(
        'Unsupported Proto UI style tokens'
      );
    });
  }
});
