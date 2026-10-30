import { describe, expect, it } from 'vitest';
import { collectProtoStyleTokens } from '../src/services/prototype-style-tokens';
import {
  renderProtoStyleTokenCss,
  renderProtoShadowSplitStyleArtifact,
} from '../src/services/proto-style-css';
import { SHADCN_STYLE_TOKENS } from '../src/generated/shadcn-style-tokens';

// Fixed source: shadcn-ui/ui 02cad61166c4c20edbc8a3f71bd720eed4c1f49b,
// apps/v4/registry/new-york-v4/ui/switch.tsx, blob c45932afe4e484c900aa916e81d0e0d67137bedc.
// Source units only; actual used geometry is a separate browser gate.
const collected = async () =>
  (await collectProtoStyleTokens('packages/prototypes/shadcn/src/switch')).map((token) => {
    if (typeof token !== 'string') throw new TypeError('Expected a collected style token string');
    return token;
  });
describe('fixed New York Switch recipe delivery', () => {
  it('delivers both source size recipes and percentage-minus-px travel from real collected tokens', async () => {
    const tokens = await collected();
    for (const token of [
      'h-[1.15rem]',
      'w-8',
      'size-4',
      'h-3.5',
      'w-6',
      'size-3',
      'p-0',
      'rounded-full',
      'shadow-xs',
      // Vega/Nova/Maia/Lyra and Luma pinned profile geometries project
      // through the same collected source; they are recipe units, not
      // fabricated ones.
      'h-[18.4px]',
      'w-[32px]',
      'w-11',
    ]) {
      expect(tokens).toContain(token);
      expect(SHADCN_STYLE_TOKENS).toContain(token);
    }
    for (const token of [
      'h-6',
      'size-5',
      'px-0.5',
      'shadow-lg',
      'duration-200',
      'scale-[0.98]',
    ])
      expect(tokens).not.toContain(token);
    for (const css of [
      renderProtoStyleTokenCss(tokens),
      renderProtoShadowSplitStyleArtifact(tokens).cssText,
    ]) {
      for (const declaration of [
        'height: 1.15rem;',
        'width: 2rem;',
        'width: 1rem;',
        'height: 1rem;',
        'height: 0.875rem;',
        'width: 1.5rem;',
        'width: 0.75rem;',
        'height: 0.75rem;',
        'height: 18.4px;',
        'width: 32px;',
        'width: 2.75rem;',
        '--pui-translate-x: calc(100% - 2px);',
        'border-radius: 9999px;',
        'box-sizing: border-box;',
      ])
        expect(css).toContain(declaration);
      // Fixed upstream uses CSS transition-all / independent transform properties.
      expect(css).toContain('transition-property: all;');
      expect(css).toContain('transition-property: transform, translate, scale, rotate;');
    }
    const splitCss = renderProtoShadowSplitStyleArtifact(tokens).cssText;
    for (const token of [
      'h-[1.15rem]',
      'w-8',
      'h-3.5',
      'w-6',
      'h-[18.4px]',
      'w-[32px]',
      'w-11',
    ])
      expect(splitCss).toContain(`:host([data-pui-split-root-style~="${token}"])`);
  });

  it.each([16, 32])(
    'preserves rem dimensions and the fixed 2px travel deduction at root font %ipx',
    async (rootFont) => {
      const tokens = await collected();
      for (const [size, height, width, thumb, expected] of [
        [
          'default',
          'h-[1.15rem]',
          'w-8',
          'size-4',
          [rootFont * 2, rootFont * 1.15, rootFont, rootFont - 2],
        ],
        [
          'sm',
          'h-3.5',
          'w-6',
          'size-3',
          [rootFont * 1.5, rootFont * 0.875, rootFont * 0.75, rootFont * 0.75 - 2],
        ],
      ] as const) {
        for (const token of [height, width, thumb]) expect(tokens, size).toContain(token);
        const dimension = (token: string, property: string) => {
          const css = renderProtoStyleTokenCss(tokens.filter((entry) => entry === token));
          const rem = css.match(new RegExp(`${property}: ([0-9.]+)rem;`));
          expect(rem, `${size} ${token} must preserve source rem`).not.toBeNull();
          return Number(rem![1]) * rootFont;
        };
        const thumbWidth = dimension(thumb, 'width');
        expect([
          dimension(width, 'width'),
          dimension(height, 'height'),
          thumbWidth,
          thumbWidth - 2,
        ]).toEqual(expected);
        expect(
          renderProtoStyleTokenCss(
            tokens.filter((token) => token === 'translate-x-[calc(100%_-_2px)]')
          )
        ).toContain('--pui-translate-x: calc(100% - 2px);');
      }
    }
  );
});
