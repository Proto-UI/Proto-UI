import { describe, expect, it } from 'vitest';
import { createRendererPrimitives } from '../src/spec/template';
import {
  equalOwnedTemplateBlueprint,
  snapshotOwnedTemplateBlueprint,
} from '../src/spec/owned-template-blueprint';
import { snapshotMaterialSlot } from '../src/material';
import type { MaterialPaintReservation } from '../src/material-paint-reservation';

describe('draft portable material reservation grammar', () => {
  it('preserves the opaque target and authored slot without exposing host geometry', () => {
    const r = createRendererPrimitives();
    const target = Object.freeze({}) as MaterialPaintReservation;
    const original = r.paintReservation(target, [r.el('span', 'caption'), r.slot()]);
    const copied = snapshotOwnedTemplateBlueprint(original);
    expect(copied).toEqual(original);
    expect((copied as any).type.target).toBe(target);
    expect(equalOwnedTemplateBlueprint(copied, snapshotOwnedTemplateBlueprint(original))).toBe(
      true
    );
    expect(
      equalOwnedTemplateBlueprint(
        copied,
        snapshotOwnedTemplateBlueprint(
          r.paintReservation(Object.freeze({}) as MaterialPaintReservation, [
            r.el('span', 'caption'),
            r.slot(),
          ])
        )
      )
    ).toBe(false);
    expect(() =>
      snapshotOwnedTemplateBlueprint({ ...original, style: { kind: 'tw', tokens: ['p-3'] } })
    ).toThrow('unstyled');
    expect(() =>
      snapshotOwnedTemplateBlueprint(r.paintReservation(target, [r.slot(), r.slot()]))
    ).toThrow('multiple slots');
  });

  it('admits only an explicit required marker and leaves existing material slots unchanged', () => {
    const slot = {
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    };
    expect(snapshotMaterialSlot(slot)).toEqual(slot);
    expect(snapshotMaterialSlot({ ...slot, paintReservation: 'required' })).toEqual({
      ...slot,
      paintReservation: 'required',
    });
    for (const value of [undefined, null, false, true, 'ready', {}, 0])
      expect(() => snapshotMaterialSlot({ ...slot, paintReservation: value })).toThrow();
    let read = false;
    expect(() =>
      snapshotMaterialSlot({
        ...slot,
        get paintReservation() {
          read = true;
          return 'required';
        },
      })
    ).toThrow();
    expect(read).toBe(false);
  });
});
