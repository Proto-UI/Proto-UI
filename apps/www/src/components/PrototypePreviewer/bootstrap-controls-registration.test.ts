import { describe, expect, it } from 'vitest';
import * as bootstrap from '@proto.ui/prototypes-bootstrap-2-3-2';
import { loadPrototype } from './prototype-modules';
import { getPrototype } from './registry';
import {
  PROJECTION_FAMILY_MANIFESTS,
  resolveProjectionPart,
  resolveProjectionRecipe,
} from './projection-families';

const cases = [
  ['checkbox', 'root', 'CHECKBOX', bootstrap.checkboxRoot],
  ['checkbox', 'indicator', 'CHECKBOX-INDICATOR', bootstrap.checkboxIndicator],
  ['switch', 'root', 'SWITCH', bootstrap.switchRoot],
  ['switch', 'thumb', 'SWITCH-THUMB', bootstrap.switchThumb],
  ['toggle', 'root', 'TOGGLE', bootstrap.toggle],
  ['input', 'root', 'INPUT', bootstrap.inputRoot],
  ['textarea', 'root', 'TEXTAREA', bootstrap.textareaRoot],
  ['separator', 'root', 'SEPARATOR', bootstrap.separatorRoot],
] as const;

describe('Bootstrap 2.3.2 partial control registration', () => {
  for (const [kind, part, base, prototype] of cases) {
    it(`loads the authored ${kind}/${part} and exact Base lineage`, async () => {
      const resolved = resolveProjectionPart('bootstrap-2-3-2', kind, part);
      expect(resolved).toEqual({ basePrototypeId: `P-BASE-${base}`, prototypeId: prototype.name });
      await loadPrototype(resolved.prototypeId);
      expect(getPrototype(resolved.prototypeId)).toBe(prototype);
      expect(resolveProjectionRecipe(`demo-bootstrap-2-3-2-${kind}`)).toEqual({
        projectionFamilyId: 'bootstrap-2-3-2',
        familyId: kind,
      });
    });
  }
  it('retains original controls and resolves newly admitted atoms without aliasing', async () => {
    expect(Object.keys(PROJECTION_FAMILY_MANIFESTS['bootstrap-2-3-2'].families)).toEqual(
      expect.arrayContaining([
        'accordion',
        'collapsible',
        'label',
        'button',
        'checkbox',
        'switch',
        'toggle',
        'input',
        'textarea',
        'separator',
        'text',
        'select',
        'field',
      ])
    );
    expect(() => resolveProjectionPart('bootstrap-2-3-2', 'switch', 'indicator')).toThrow(
      /no part indicator/
    );
    for (const kind of ['text', 'select', 'field']) {
      const resolved = resolveProjectionPart('bootstrap-2-3-2', kind, 'root');
      expect(resolved.prototypeId).toBe(`bootstrap-2-3-2-${kind}-root`);
      await loadPrototype(resolved.prototypeId);
      expect(getPrototype(resolved.prototypeId).name).toBe(resolved.prototypeId);
      expect(resolved.basePrototypeId).toBe(`P-BASE-${kind.toUpperCase()}`);
    }
    for (const kind of ['__unregistered_component__']) {
      expect(() => resolveProjectionPart('bootstrap-2-3-2', kind, 'root')).toThrow(
        /fallback is forbidden/
      );
    }
  });
});
