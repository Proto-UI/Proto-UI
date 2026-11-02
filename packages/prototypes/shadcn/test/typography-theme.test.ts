import { describe, expect, it } from 'vitest';
import { SHADCN_TYPOGRAPHY } from '../src/text/typography';
import { SHADCN_TYPOGRAPHY as publicPreset } from '../src/text';

describe('opt-in Shadcn typography preset', () => {
  it('exports one immutable pair through the existing public Text entry', () => {
    expect(publicPreset).toBe(SHADCN_TYPOGRAPHY);
    expect(Object.isFrozen(publicPreset)).toBe(true);
    expect(Object.keys(publicPreset)).toEqual(['font-sans', 'font-heading']);
    expect(publicPreset['font-heading']).toBe(publicPreset['font-sans']);
  });
  it('selects Geist only when consumed and retains explicit platform fallbacks', () => {
    expect(publicPreset['font-sans'].startsWith('"Geist",')).toBe(true);
    expect(publicPreset['font-sans']).toContain('system-ui');
    expect(publicPreset['font-sans']).toContain('"PingFang SC"');
    expect(publicPreset['font-sans']).toContain('"Microsoft YaHei"');
    expect(publicPreset['font-sans']).toContain('"Noto Sans CJK SC"');
    expect(publicPreset['font-sans']).not.toMatch(/url\(|https?:/);
  });
});
