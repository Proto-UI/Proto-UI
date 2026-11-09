import { describe, expect, it } from 'vitest';
import { THEME, renderThemeCss } from '../src/theme';
import { readFileSync } from 'node:fs';

function luminance(hex: string) {
  const rgb = hex
    .slice(1)
    .match(/../g)!
    .map((channel) => {
      const value = parseInt(channel, 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
  return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}

describe('Bootstrap readable page adaptation', () => {
  for (const [mode, palette] of Object.entries(THEME)) {
    it(`${mode} page and navbar retain WCAG AA normal-text contrast`, () => {
      // WCAG 2.2 SC 1.4.3, not an assertion that all historic Button colors pass.
      for (const background of [
        palette.background,
        palette.secondary,
        palette['navbar-top'],
        palette['navbar-bottom'],
        palette.muted,
      ]) {
        expect(contrast(palette.foreground, background)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(palette['muted-foreground'], background)).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
  it('preserves the light historical palette and publishes distinct dark values', () => {
    expect(THEME.light.foreground).toBe('#333333');
    expect(THEME.light.background).toBe('#ffffff');
    expect(THEME.dark.foreground).not.toBe(THEME.light.foreground);
    expect(contrast(THEME.dark['accent-foreground'], THEME.dark.accent)).toBeGreaterThanOrEqual(
      4.5
    );
    expect(contrast(THEME.light['accent-foreground'], THEME.light.accent)).toBeGreaterThanOrEqual(
      4.5
    );
    expect(renderThemeCss()).toContain('--pui-navbar-border: #080808');
  });
  it('keeps composed light and dark surface pairs semantic', () => {
    const popover = readFileSync(
      'packages/prototypes/bootstrap-2-3-2/src/popover/title.proto.ts',
      'utf8'
    );
    expect(popover).toContain('bg-secondary text-secondary-foreground');
    const days = readFileSync(
      'packages/prototypes/bootstrap-2-3-2/src/calendar/day-paint.ts',
      'utf8'
    );
    expect(days).toContain("tw('bg-muted border-border')");
    expect(days).toContain("tw('bg-secondary')");
    expect(days).not.toContain('bg-[#eee]');
    const row = readFileSync(
      'packages/prototypes/bootstrap-2-3-2/src/data-table/data-table.proto.ts',
      'utf8'
    );
    expect(row).toContain('bg-accent text-accent-foreground');
  });
  it('keeps supporting copy and link interaction ink readable in dark mode', () => {
    const description = readFileSync(
      'packages/prototypes/bootstrap-2-3-2/src/fieldset/description.proto.ts',
      'utf8'
    );
    expect(description).toContain('text-muted-foreground');
    expect(description).not.toContain('text-[#555]');
    for (const path of [
      'accordion/trigger.proto.ts',
      'collapsible/trigger.proto.ts',
      'hover-card/trigger.proto.ts',
    ]) {
      const source = readFileSync(`packages/prototypes/bootstrap-2-3-2/src/${path}`, 'utf8');
      expect(source).toContain("tw('text-foreground underline')");
      expect(source).not.toContain("tw('text-[#005580] underline')");
    }
    expect(contrast(THEME.dark['muted-foreground'], THEME.dark.background)).toBeGreaterThanOrEqual(
      4.5
    );
    expect(contrast(THEME.dark.foreground, THEME.dark.background)).toBeGreaterThanOrEqual(4.5);
  });
  it('keeps white control ink paired instead of inheriting dark page text', () => {
    for (const path of [
      'checkbox/root.proto.ts',
      'checkbox-group/indicator-paint.ts',
      'slider/values-thumb.proto.ts',
    ]) {
      const source = readFileSync(`packages/prototypes/bootstrap-2-3-2/src/${path}`, 'utf8');
      expect(source).toContain('text-[#333]');
      expect(source).not.toContain('text-foreground');
    }
  });
});
