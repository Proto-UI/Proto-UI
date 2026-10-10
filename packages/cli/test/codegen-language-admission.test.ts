// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderHostIndex, renderRootIndex } from '../src/services/codegen';

describe('generated language and workspace admission remain independent', () => {
  for (const language of ['js', 'ts'] as const) {
    for (const host of ['react', 'vue', 'vue2', 'wc']) {
      for (const sourceMode of ['installed', 'workspace'] as const) {
        it(`${host} ${language} ${sourceMode} preserves public presets and draft admission`, () => {
          const options = { language, sourceMode };
          const preset = renderHostIndex(host, ['shadcn-switch'], options);
          expect(preset).toBe(renderHostIndex(host, ['shadcn-switch'], language));
          expect(preset).toContain('ShadcnSwitch');
          if (sourceMode === 'installed') {
            expect(() => renderHostIndex(host, ['liquid-glass-field'], options)).toThrow(
              /workspace-source-only/
            );
          } else {
            expect(renderHostIndex(host, ['liquid-glass-field'], options)).toContain(
              '@proto.ui/prototypes-liquid-glass/field'
            );
          }
          if (language === 'js') {
            expect(preset).not.toMatch(
              /this: any|fn: \(\) => void|Vue\.ref<any>|export type | as unknown/
            );
            expect(renderRootIndex({ [host]: ['shadcn-switch'] }, language)).toContain(
              `./${host}/index.js`
            );
          }
        });
      }
      it(`${host} ${language} shorthand never admits workspace-only components`, () => {
        expect(() => renderHostIndex(host, ['liquid-glass-field'], language)).toThrow(
          /workspace-source-only/
        );
      });
    }
  }
  it('preserves the TypeScript default and legacy workspace options', () => {
    expect(renderHostIndex('react', ['shadcn-switch'])).toBe(
      renderHostIndex('react', ['shadcn-switch'], 'ts')
    );
    expect(renderHostIndex('react', ['shadcn-switch'], undefined)).toBe(
      renderHostIndex('react', ['shadcn-switch'], {})
    );
    expect(() => renderHostIndex('react', ['liquid-glass-field'])).toThrow(/workspace-source-only/);
    expect(() => renderHostIndex('react', ['liquid-glass-field'], {})).toThrow(
      /workspace-source-only/
    );
    expect(renderHostIndex('react', ['liquid-glass-field'], { sourceMode: 'workspace' })).toBe(
      renderHostIndex('react', ['liquid-glass-field'], { sourceMode: 'workspace', language: 'ts' })
    );
  });
  for (const input of [
    null,
    false,
    0,
    [],
    'jsx',
    { language: 'jsx' },
    { language: null },
    { sourceMode: 'other' },
    { sourceMode: null },
    { language: 'js', sourceMode: 'other' },
  ]) {
    it(`rejects malformed options ${JSON.stringify(input)} before generating even an empty facade`, () => {
      expect(() => renderHostIndex('react', [], input as never)).toThrow(
        /invalid generated source/
      );
    });
  }
});
