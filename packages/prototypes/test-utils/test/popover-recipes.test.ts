import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectProtoStyleTokensFromFiles } from '../../../cli/src/services/prototype-style-tokens';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';

describe('Popover bounded surface recipes', () => {
  for (const [family, required, forbidden] of [
    [
      'shadcn',
      ['w-72', 'p-2.5', 'gap-2.5', 'ring-1', 'ring-foreground/10'],
      ['w-80', 'p-4', 'border'],
    ],
    [
      'brutalist',
      ['w-72', 'rounded-base', 'gap-4', 'border-2'],
      ['w-80', 'rounded-none', 'shadow-[4px_4px_0_0_var(--pui-foreground)]'],
    ],
  ] as const) {
    it(`${family} has the component recipe rather than a generic elevated panel`, async () => {
      const tokens = await collectProtoStyleTokensFromFiles([
        path.resolve(`packages/prototypes/${family}/src/popover/content.proto.ts`),
      ]);
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
