import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderHostIndex } from '../src/services/codegen';
import { listComponentChoices } from '../src/registry/components';
import { collectProtoStyleTokens } from '../src/services/prototype-style-tokens';
import { renderProtoStyleTokenCss } from '../src/services/proto-style-css';
describe('Field package/CLI closure', () => {
  it.each(['react', 'vue', 'vue2', 'wc'])(
    '%s exposes the existing Base FieldTextarea only through explicit workspace generation',
    (host) => {
      expect(() => renderHostIndex(host, ['base-field'])).toThrow(/workspace-source-only/);
      expect(() =>
        renderHostIndex(host, ['base-field'], { sourceMode: 'installed' })
      ).toThrow(/workspace-source-only/);
      expect(listComponentChoices().some((entry) => entry.value === 'base-field')).toBe(false);

      for (const language of ['ts', 'js'] as const) {
        const code = renderHostIndex(host, ['base-field'], { sourceMode: 'workspace', language });
        expect(code).toContain('fieldTextarea');
        expect(code).toContain("from '@proto.ui/prototypes-base/field'");
        if (host === 'wc') {
          expect(code).toContain(
            "export const BaseFieldTextareaElement = AdaptToWebComponent(fieldTextarea, { registerAs: 'proto-ui-base-field-textarea' });"
          );
        } else {
          expect(code).toContain('export const BaseFieldTextarea = adapt(fieldTextarea);');
        }
        expect(code.match(/export const BaseFieldTextarea(?:Element)? =/g)).toHaveLength(1);
      }
    }
  );

  for (const family of ['base', 'shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'])
    it(`${family} resolves all atoms and complete authored style tokens without pretending release admission`, async () => {
      for (const host of ['react', 'vue', 'vue2', 'wc']) {
        expect(() => renderHostIndex(host, [`${family}-field`])).toThrow(/workspace-source-only/);
        const code = renderHostIndex(host, [`${family}-field`], { sourceMode: 'workspace' });
        expect(code).toContain(`from '@proto.ui/prototypes-${family}/field'`);
        for (const role of ['Root', 'Label', 'Control', 'Description', 'Error', 'Validity'])
          expect(code).toContain(`field${role}`);
      }
      expect(listComponentChoices().some((i) => i.value === `${family}-field`)).toBe(false);
      const tokens = await collectProtoStyleTokens(
        path.resolve(`packages/prototypes/${family}/src/field`)
      );
      expect(renderProtoStyleTokenCss(tokens as string[])).not.toContain(
        'Unsupported Proto UI style tokens'
      );
    });
});
