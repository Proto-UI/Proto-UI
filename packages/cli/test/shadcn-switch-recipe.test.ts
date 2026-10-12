import { describe, expect, it } from 'vitest';
import { collectProtoStyleTokens } from '../src/services/prototype-style-tokens';
import {
  renderProtoStyleTokenCss,
  renderProtoShadowSplitStyleArtifact,
} from '../src/services/proto-style-css';
import { SHADCN_STYLE_TOKENS } from '../src/generated/shadcn-style-tokens';

// Source units, not a layout-engine assertion. Actual used geometry is a separate browser gate.
describe('fixed Base Nova Switch recipe delivery', () => {
  it('preserves px track, rem Thumb and percentage travel in document and split delivery', async () => {
    const tokens = await collectProtoStyleTokens('packages/prototypes/shadcn/src/switch');
    for (const token of ['h-[18.4px]', 'w-[32px]', 'size-4', 'p-0', 'rounded-full']) {
      expect(tokens).toContain(token);
      expect(SHADCN_STYLE_TOKENS).toContain(token);
    }
    for (const token of [
      'h-[1.15rem]',
      'w-8',
      'h-6',
      'w-11',
      'size-5',
      'px-0.5',
      'shadow-xs',
      'shadow-lg',
      'duration-200',
      'scale-[0.98]',
    ]) {
      expect(tokens).not.toContain(token);
    }
    const documentCss = renderProtoStyleTokenCss(tokens);
    const splitCss = renderProtoShadowSplitStyleArtifact(tokens).cssText;
    for (const css of [documentCss, splitCss]) {
      for (const declaration of [
        'height: 18.4px;',
        'width: 32px;',
        'width: 1rem;',
        'height: 1rem;',
        '--pui-translate-x: calc(100% - 2px);',
        'border-radius: 9999px;',
        'box-sizing: border-box;',
      ]) {
        expect(css).toContain(declaration);
      }
      // Reduced motion is now consumed by the shared runtime projector; this
      // source recipe must not install a second CSS timing writer.
      expect(css).not.toContain('transition-property:');
    }
    expect(splitCss).toContain(':host([data-pui-split-root-style~="h-[18.4px]"])');
    expect(splitCss).toContain(':host([data-pui-split-root-style~="w-[32px]"])');
  });

  it.each([16, 32])(
    'does not convert source px dimensions to rem at root font %ipx',
    (rootFont) => {
      // Declaration-level normalization: a 32px root font doubles size-4 but not the track.
      // Flex shrink, physical overflow and actual rendered travel require real layout evidence.
      const css = renderProtoStyleTokenCss([
        'h-[18.4px]',
        'w-[32px]',
        'size-4',
        'translate-x-[calc(100%_-_2px)]',
      ]);
      const trackHeight = Number(css.match(/height: (18\.4)px;/)?.[1]);
      const trackWidth = Number(css.match(/width: (32)px;/)?.[1]);
      const declaredThumb = Number(css.match(/width: (1)rem;/)?.[1]) * rootFont;
      expect([trackWidth, trackHeight, declaredThumb]).toEqual([32, 18.4, rootFont]);
      if (rootFont === 16) {
        expect(declaredThumb - 2).toBe(14);
        expect((trackHeight - 2 - declaredThumb) / 2).toBeCloseTo(0.2);
      } else {
        expect(declaredThumb).toBeGreaterThan(trackWidth - 2);
      }
    }
  );
});
