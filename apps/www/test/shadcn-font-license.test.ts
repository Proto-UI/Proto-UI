import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url));
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

describe('self-hosted unchanged Geist 1.800 distribution', () => {
  it('pins the original font and exact accompanying OFL bytes', () => {
    const font = read('../src/styles/assets/font/geist/Geist-Variable.ttf');
    const license = read('../src/styles/assets/font/geist/OFL.txt');
    expect(font.length).toBe(169056);
    expect(sha256(font)).toBe('73894e0448cae90a92b6c2f8732b7bb9acb7b94c418bff559dad4a18e1de9659');
    expect(sha256(license)).toBe(
      '1781d2806a07d91c4edf4740b88449fab7d0eadad53f7c351b94cd4d4eb8c00f'
    );
    expect(read('../public/fonts/geist-OFL.txt')).toEqual(license);
    expect(license.toString()).toContain('SIL OPEN FONT LICENSE Version 1.1');
  });

  it('declares a same-origin optional face without replacing the global system default', () => {
    const css = read('../src/styles/tailwindcss.css').toString();
    const face = css.match(/@font-face\s*\{[^}]*font-family:\s*'Geist';[^}]*\}/)?.[0];
    expect(face).toBeDefined();
    expect(face).toContain("url('./assets/font/geist/Geist-Variable.ttf')");
    expect(face).toContain('font-weight: 100 900');
    expect(face).toContain('font-display: swap');
    expect(face).not.toMatch(/https?:|local\(/);
    expect(css.match(/@theme\s*\{[\s\S]*?--font-sans:\s*([^;]+);/)?.[1]).not.toContain('Geist');
    const attribution = read('../src/styles/assets/font/geist/README.md').toString();
    expect(attribution).toContain('718e1db4deb9e4d9d85a0ead1b9f5fde2761ccfd');
    expect(attribution).toContain('1.800');
  });
});
