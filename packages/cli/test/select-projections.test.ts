// @vitest-environment node
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderHostIndex } from '../src/services/codegen';
import { collectProtoStyleTokens } from '../src/services/prototype-style-tokens';
import { renderProtoStyleTokenCss } from '../src/services/proto-style-css';
import { listComponentChoices } from '../src/registry/components';

for (const family of ['bootstrap-2-3-2', 'liquid-glass']) {
  describe(`${family} Select source-only compiler consumption`, () => {
    it('exports all five parts and retains the private-source publication boundary', () => {
      const manifest = JSON.parse(
        readFileSync(`packages/prototypes/${family}/package.json`, 'utf8')
      );
      expect(manifest.private).toBe(true);
      expect(manifest.exports['./select']).toEqual({
        types: './src/select/index.ts',
        default: './src/select/index.ts',
      });
      for (const host of ['wc', 'react', 'vue', 'vue2']) {
        expect(() => renderHostIndex(host, [`${family}-select`])).toThrow(/workspace-source-only/);
        const output = renderHostIndex(host, [`${family}-select`], { sourceMode: 'workspace' });
        expect(output).toContain(`from '@proto.ui/prototypes-${family}/select'`);
        for (const part of ['Root', 'Trigger', 'Value', 'Content', 'Item'])
          expect(output).toContain(`select${part}`);
      }
      expect(listComponentChoices().some((item) => item.value === `${family}-select`)).toBe(false);
      expect(() =>
        renderHostIndex('gpui', [`${family}-select`], { sourceMode: 'workspace' })
      ).toThrow('unsupported host');
    });
    it('lowers every actual Select source token, including bounded portal width and RTL text', async () => {
      const tokens = await collectProtoStyleTokens(
        path.resolve(`packages/prototypes/${family}/src/select`)
      );
      const strings = tokens.filter((token): token is string => typeof token === 'string');
      expect(strings).toHaveLength(tokens.length);
      const css = renderProtoStyleTokenCss(strings);
      expect(css).not.toContain('Unsupported Proto UI style tokens');
      expect(css).toContain('max-width: var(--proto-ui-available-width)');
      expect(css).toContain('text-align: start');
      expect(css).toContain('overflow-wrap: anywhere');
      expect(css).toContain('outline: 2px solid transparent');
      if (family === 'bootstrap-2-3-2') {
        expect(css).toContain('linear-gradient(to bottom, #0077b3, #005580)');
        expect(css).toContain('--pui-shadow: 0 5px 10px rgb(0 0 0 / 0.2)');
      }
    });
  });
}
