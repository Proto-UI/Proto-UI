import { describe, expect, it, vi } from 'vitest';
import { createAnatomyFamily, definePrototype, tw, type Prototype } from '@proto.ui/core';
import { updateWebMaterialPaintReservation } from '../../src/material/paint-reservation';

export type ReservationMount = {
  host: HTMLElement;
  update(): Promise<void>;
  unmount(): Promise<void>;
};
/** Real Runtime/Adapter lifecycle and logical composition; injected rectangles
 * are deliberate and do not constitute browser layout/optical acceptance. */
export function materialReservationConformance(
  adapter: string,
  mount: (owner: Prototype, target: Prototype, duplicate: boolean) => Promise<ReservationMount>
) {
  const family = createAnatomyFamily(`reservation-${adapter}`, {
    roles: {
      root: { cardinality: { min: 1, max: 1 } },
      target: { cardinality: { min: 1, max: 1 } },
    },
    relations: [{ kind: 'contains', parent: 'root', child: 'target' }],
  });
  const owner = definePrototype({
    name: `reservation-owner-${adapter}`,
    setup(def) {
      def.anatomy.claim(family, { role: 'root' });
      def.feedback.style.use(tw('block'));
      const target = def.feedback.material.reserve({ family, targetRole: 'target' });
      return (r) => r.paintReservation(target, r.slot());
    },
  });
  const target = definePrototype({
    name: `reservation-target-${adapter}`,
    setup(def) {
      def.anatomy.claim(family, { role: 'target' });
      def.feedback.style.use(tw('block w-full'));
      return (r) => r.slot();
    },
  });
  const footprint = {
    view: 1,
    revision: 1,
    profile: 'transport-test',
    edges: { top: 9, right: 9, bottom: 9, left: 9 },
  };

  describe(`${adapter}: draft material reservation transport`, () => {
    it('binds the exact logical target, keeps a neutral part and retires its physical generation', async () => {
      const f = await mount(owner, target, false);
      try {
        let part = f.host.querySelector<HTMLElement>('[data-pui-material-reservation]')!;
        const physical = part.querySelector<HTMLElement>('[data-pui-root]')!;
        expect(part).toBeTruthy();
        expect(physical).toBeTruthy();
        expect(part.hasAttribute('aria-hidden')).toBe(false);
        expect(part.hasAttribute('inert')).toBe(false);
        expect(part.hasAttribute('role')).toBe(false);
        expect(part.hasAttribute('tabindex')).toBe(false);
        const borrowed = physical.firstChild;
        const geometry = () => {
          const p = () => parseFloat(part.style.paddingTop || '0');
          vi.spyOn(part, 'getBoundingClientRect').mockImplementation(
            () => new DOMRect(40, 40, 100 + 2 * p(), 36 + 2 * p())
          );
          vi.spyOn(physical, 'getBoundingClientRect').mockImplementation(
            () => new DOMRect(40 + p(), 40 + p(), 100, 36)
          );
        };
        geometry();
        expect(updateWebMaterialPaintReservation(physical, footprint)).toMatchObject({
          status: 'unavailable',
          reason: 'paint-reservation-layout-pending',
        });
        const initial = updateWebMaterialPaintReservation(physical, footprint);
        expect(initial.status).toBe('ready');
        physical.tabIndex = 0;
        physical.focus();
        await f.update();
        part = f.host.querySelector<HTMLElement>('[data-pui-material-reservation]')!;
        expect(part.querySelector('[data-pui-root]')).toBe(physical);
        expect(physical.firstChild).toBe(borrowed);
        expect(document.activeElement).toBe(physical);
        geometry();
        updateWebMaterialPaintReservation(physical, { ...footprint, revision: 2 });
        expect(
          updateWebMaterialPaintReservation(physical, { ...footprint, revision: 2 }).status
        ).toBe('ready');
        await f.unmount();
        expect(initial.status === 'ready' && initial.current()).toBe(false);
        expect(updateWebMaterialPaintReservation(physical, footprint).status).toBe('unavailable');
      } finally {
        await f.unmount();
        vi.restoreAllMocks();
      }
    });

    it('keeps an ambiguous logical target unavailable instead of selecting the first physical child', async () => {
      const f = await mount(owner, target, true);
      try {
        const part = f.host.querySelector<HTMLElement>('[data-pui-material-reservation]')!;
        const targets = part.querySelectorAll<HTMLElement>('[data-pui-root]');
        expect(targets.length).toBe(2);
        for (const physical of targets)
          expect(updateWebMaterialPaintReservation(physical, footprint).status).toBe('unavailable');
      } finally {
        await f.unmount();
      }
    });
  });
}
