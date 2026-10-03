// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

describe('DM Sans distribution provenance', () => {
  it('ships the unmodified source font and complete publicly served license', () => {
    const font = readFileSync(
      new URL('../src/styles/assets/font/dm-sans/DMSans-Variable.ttf', import.meta.url)
    );
    expect(createHash('sha256').update(font).digest('hex')).toBe(
      '8cd08d97e89c24d0aa92edd2f0f4c8ee6195eee9b7c9f154865a58b02f0c1c0d'
    );
    const license = readFileSync(
      new URL('../src/styles/assets/font/dm-sans/OFL.txt', import.meta.url),
      'utf8'
    );
    const publicLicense = readFileSync(
      new URL('../public/fonts/dm-sans-OFL.txt', import.meta.url),
      'utf8'
    );
    expect(publicLicense).toBe(license);
    expect(publicLicense).toContain('Copyright 2014 The DM Sans Project Authors');
    expect(publicLicense).toContain('SIL OPEN FONT LICENSE Version 1.1');
    expect(publicLicense).toContain('TERMINATION');
    expect(publicLicense).toContain('DISCLAIMER');
  });
});
