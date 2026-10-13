// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { collectProtoStyleTokensFromFiles } from '../../../cli/src/services/prototype-style-tokens';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';
import {
  extractResidentMotionTarget,
  resolveMotionTranslate,
  type MotionTranslate,
} from '../../../modules/feedback/src/motion/targets';

const source = readFileSync('packages/prototypes/brutalist/src/switch/thumb.proto.ts', 'utf8');
describe('Brutalist Thumb resident declaration and static CSS fallback', () => {
  it('declares only the existing draft 150ms translate curve without competing CSS timing', () => {
    expect(source.match(/def\.feedback\.style\.transition\(/g)).toHaveLength(1);
    expect(source).toMatch(
      /properties: \['translate'\],\s*durationMs: 150,\s*easing: \[0\.4, 0, 0\.2, 1\]/
    );
    expect(source).not.toMatch(/['"](?:transition-|duration-|animate-)/);
  });
  it('retains equivalent -50% centering in both typed targets and generated static CSS', async () => {
    const tokens = (
      await collectProtoStyleTokensFromFiles([
        'packages/prototypes/brutalist/src/switch/thumb.proto.ts',
      ])
    ).map((token) => {
      if (typeof token !== 'string') throw new TypeError('Expected collected token');
      return token;
    });
    expect(tokens).toContain('-translate-y-1/2');
    const css = renderProtoStyleTokenCss(tokens);
    expect(css).toContain('--pui-translate-y: -50%;');
    expect(css).toContain('--pui-translate-x: 1.25rem;');
    expect(css).not.toContain('transition-property:');
    for (const font of [16, 32]) {
      const target = extractResidentMotionTarget(
        ['translate-x-5', '-translate-y-1/2'],
        'translate'
      );
      expect(target.supported).toBe(true);
      if (target.supported)
        expect(
          resolveMotionTranslate(target.value as MotionTranslate, {
            rootFontPx: font,
            width: font,
            height: font,
          })
        ).toEqual([font * 1.25, -font / 2]);
    }
  });
});
