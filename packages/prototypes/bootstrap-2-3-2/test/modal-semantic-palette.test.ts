import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (family: string, part: string) =>
  readFileSync(`packages/prototypes/bootstrap-2-3-2/src/${family}/${part}.proto.ts`, 'utf8');

describe('Bootstrap composable modal palettes', () => {
  for (const family of ['dialog', 'alert-dialog', 'drawer']) {
    it(`${family} pairs the same semantic surface and copy used by nested controls`, () => {
      expect(source(family, 'content')).toContain('bg-background');
      expect(source(family, 'content')).toContain('text-foreground');
      for (const part of ['title', 'description']) {
        expect(source(family, part)).toContain('text-foreground');
        expect(source(family, part)).not.toContain('text-[#333]');
      }
      const footer = source(family, 'footer');
      expect(footer).toContain('bg-secondary text-secondary-foreground');
      expect(footer).toContain('border-border');
      expect(footer).not.toContain('shadow-[inset_0_1px_0_#fff]');
      expect(source(family, 'content')).not.toContain('bg-white');
      expect(source(family, 'content')).not.toContain('bg-[#fff]');
    });
  }
});
