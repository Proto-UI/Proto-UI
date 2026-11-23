import { expect, it } from 'vitest';
import { FINF_WORKSPACE_COMPONENT_ENTRIES } from '../src/registry/finf-components';
import { renderHostIndex } from '../src/services/codegen';
import { listComponentChoices } from '../src/registry/components';
for (const family of ['base', 'shadcn', 'brutalist'] as const)
  for (const host of ['react', 'vue', 'vue2', 'wc'] as const)
    it(`${family}/${host}: Values uses ordinary six-entry workspace generation and leaves scalar exports intact`, () => {
      const values = renderHostIndex(host, [`${family}-slider-values`], {
          sourceMode: 'workspace',
        }),
        scalar = renderHostIndex(host, [`${family}-slider`], { sourceMode: 'workspace' });
      for (const role of ['Root', 'Track', 'Thumb', 'Indicator', 'Label', 'Value'])
        expect(values).toContain(`sliderValues${role}`);
      expect(values).not.toContain('sliderFieldThumb');
      expect(scalar).toContain('sliderRoot');
      expect(scalar).not.toContain('sliderValuesRoot');
      expect(() => renderHostIndex(host, [`${family}-slider-values`])).toThrow(
        /workspace-source-only/
      );
    });
it('Values metadata is additive and not an installed-release choice', () => {
  for (const family of ['base', 'shadcn', 'brutalist']) {
    expect(FINF_WORKSPACE_COMPONENT_ENTRIES[`${family}-slider-values`].items).toHaveLength(6);
    expect(FINF_WORKSPACE_COMPONENT_ENTRIES[`${family}-slider`].items).toHaveLength(7);
    expect(listComponentChoices().some((x) => x.value === `${family}-slider-values`)).toBe(false);
  }
});
