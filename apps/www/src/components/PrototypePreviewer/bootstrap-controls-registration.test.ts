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
  it('does not alias missing parts, kinds or claim a complete family', () => {
    expect(Object.keys(PROJECTION_FAMILY_MANIFESTS['bootstrap-2-3-2'].families)).toEqual([
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
    ]);
    expect(() => resolveProjectionPart('bootstrap-2-3-2', 'switch', 'indicator')).toThrow(
      /no part indicator/
    );
    for (const kind of ['select', 'tabs', 'radio-group', 'dialog', 'tooltip', 'scroll-area']) {
      expect(() => resolveProjectionPart('bootstrap-2-3-2', kind, 'root')).toThrow(
        /fallback is forbidden/
      );
    }
  });
});
