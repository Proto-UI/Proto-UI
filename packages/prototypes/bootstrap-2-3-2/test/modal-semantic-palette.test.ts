import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { THEME } from '../src/theme';

const source = (family: string, part: string) =>
  readFileSync(`packages/prototypes/bootstrap-2-3-2/src/${family}/${part}.proto.ts`, 'utf8');

function contrast(a: string, b: string) {
  const luminance = (hex: string) => {
    const [r, g, b] = hex
      .slice(1)
      .match(/../g)!
      .map((channel) => {
        const value = parseInt(channel, 16) / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
    return r! * 0.2126 + g! * 0.7152 + b! * 0.0722;
  };
  const [high, low] = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (high! + 0.05) / (low! + 0.05);
}

describe('Bootstrap composable modal palettes', () => {
  for (const family of ['dialog', 'alert-dialog', 'drawer']) {
    it(`${family} pairs the same semantic surface and copy used by nested controls`, () => {
      expect(source(family, 'content')).toContain('bg-background');
      expect(source(family, 'content')).toContain('text-foreground');
      for (const part of ['title', 'description']) {
        const ink =
          family === 'drawer' && part === 'description' ? 'muted-foreground' : 'foreground';
        expect(source(family, part)).toContain(`text-${ink}`);
        expect(source(family, part)).not.toContain('text-[#333]');
        for (const palette of Object.values(THEME))
          expect(contrast(palette[ink], palette.background)).toBeGreaterThanOrEqual(4.5);
      }
      const footer = source(family, 'footer');
      expect(footer).toContain('bg-secondary text-secondary-foreground');
      expect(footer).toContain('border-border');
      expect(footer).not.toContain('shadow-[inset_0_1px_0_#fff]');
      expect(footer).toContain('shadow-none');
      expect(source(family, 'content')).not.toContain('bg-white');
      expect(source(family, 'content')).not.toContain('bg-[#fff]');
    });
  }
});
