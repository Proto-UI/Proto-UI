import { describe, expect, it } from 'vitest';
import { BRUTALIST_THEME, renderBrutalistThemeCss } from '../src/theme';
import {
  BRUTALIST_THEME as GENERATED_BRUTALIST_THEME,
  BRUTALIST_THEME_CSS,
} from '../../../cli/src/generated/brutalist-theme';

const REQUIRED_PAIRS = [
  ['main', 'main-foreground'],
  ['mint', 'mint-foreground'],
  ['lavender', 'lavender-foreground'],
  ['coral', 'coral-foreground'],
  ['sky', 'sky-foreground'],
  ['destructive', 'destructive-foreground'],
  ['secondary-background', 'foreground'],
] as const;

function relativeLuminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255);
  if (!channels || channels.length !== 3 || channels.some(Number.isNaN)) {
    throw new Error(`Expected a six-digit hex color, received ${hex}`);
  }
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('prototypes/brutalist: canonical theme manifest', () => {
  it('keeps identical Light and Dark keys with complete fill pairs', () => {
    expect(Object.keys(BRUTALIST_THEME.light).sort()).toEqual(
      Object.keys(BRUTALIST_THEME.dark).sort()
    );

    for (const mode of [BRUTALIST_THEME.light, BRUTALIST_THEME.dark]) {
      for (const [background, foreground] of REQUIRED_PAIRS) {
        expect(mode[background]).toBeTruthy();
        expect(mode[background]).not.toBe('transparent');
        expect(mode[foreground]).toBeTruthy();
      }
    }
  });

  it('keeps accent and destructive ink paired in both modes', () => {
    for (const mode of [BRUTALIST_THEME.light, BRUTALIST_THEME.dark]) {
      for (const foreground of [
        'main-foreground',
        'mint-foreground',
        'lavender-foreground',
        'coral-foreground',
        'sky-foreground',
        'destructive-foreground',
      ] as const) {
        expect(mode[foreground]).toBe('#000000');
      }
    }
  });

  it('uses a theme-relative focus ring with at least 3:1 adjacent-color contrast', () => {
    for (const mode of [BRUTALIST_THEME.light, BRUTALIST_THEME.dark]) {
      expect(mode.ring).toBe(mode.foreground);
      expect(contrastRatio(mode.ring, mode.background)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(mode.ring, mode['secondary-background'])).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps the destructive resting ink readable on the row it paints on', () => {
    // The resting destructive row keeps the paper fill, so the pair that has to
    // hold is ink against `secondary-background`. Asserting the token name would
    // pass again if the value went back to the fill colour, which measured
    // 1.41:1 on Light paper.
    for (const mode of [BRUTALIST_THEME.light, BRUTALIST_THEME.dark]) {
      expect(
        contrastRatio(mode['destructive-ink'], mode['secondary-background'])
      ).toBeGreaterThanOrEqual(4.5);
    }

    // The fill is not an ink: this is the substitution the defect made, kept
    // here so the two roles cannot quietly collapse back into one token.
    expect(
      contrastRatio(
        BRUTALIST_THEME.light.destructive,
        BRUTALIST_THEME.light['secondary-background']
      )
    ).toBeLessThan(4.5);
  });

  it('renders deterministic selectors and variable prefixes', () => {
    const css = renderBrutalistThemeCss({
      variablePrefix: 'pui-',
      lightSelector: '.light-scope',
      darkSelector: '.dark-scope',
    });

    expect(css).toContain('.light-scope {');
    expect(css).toContain('.dark-scope {');
    expect(css).toContain('--pui-background: #f5f5f5;');
    expect(css).toContain('--pui-secondary-background: #262626;');
    expect(css).toContain('--pui-mint-foreground: #000000;');
    expect(css).not.toContain(':root');
  });
  it('keeps the offline CLI theme projection byte-equivalent to the package renderer', () => {
    expect(GENERATED_BRUTALIST_THEME).toEqual(BRUTALIST_THEME);
    expect(BRUTALIST_THEME_CSS).toBe(renderBrutalistThemeCss());
  });
});
