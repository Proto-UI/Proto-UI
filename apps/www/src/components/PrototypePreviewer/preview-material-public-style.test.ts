import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
describe('public Liquid Glass Previewer source plane', () => {
  it('does not leave the historical CSS gradient between the visible canvas and the actual Button', () => {
    const style = readFileSync('apps/www/src/components/DraftProjectionStyle.astro', 'utf8');
    const carrier = style.match(/\.liquid-functional-demo\s*\{([^}]+)\}/)?.[1];
    expect(carrier).toBeDefined();
    expect(carrier).toContain('padding: 24px');
    expect(carrier).toContain('border-radius: 20px');
    expect(carrier).not.toMatch(/background\s*:/);
    expect(carrier).not.toContain('gradient');
  });
});
