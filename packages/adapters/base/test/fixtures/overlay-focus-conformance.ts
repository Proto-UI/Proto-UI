import { describe, expect, it } from 'vitest';
import {
  definePrototype,
  type BoundaryHandle,
  type OverlayHandle,
  type Prototype,
} from '@proto.ui/core';
import { asBoundary, asOverlay } from '@proto.ui/hooks';

export type OverlayTree = { proto: Prototype; children?: OverlayTree[] };
type FocusMount = {
  host: HTMLElement;
  flush(): Promise<void>;
  focus(target: HTMLElement): Promise<void>;
  dispatch(target: EventTarget, event: Event): Promise<void>;
  unmount(): Promise<void>;
};
const ownership = Symbol.for('@proto.ui/adapter-base/__proto_parent_instance');
const buttons = () => {
  const targets = Array.from({ length: 3 }, () => document.createElement('button'));
  document.body.append(...targets);
  return targets;
};

export function overlayFocusConformance(
  name: string,
  mount: (tree: OverlayTree[]) => Promise<FocusMount>
) {
  describe(`${name}: current focus outside`, () => {
    it('T-BOUNDARY-0002-CASE-FOCUS: retains disjoint trigger, content and owned children; closes without stealing focus', async () => {
      const [trigger, owned, outside] = buttons();
      let overlay!: OverlayHandle;
      let boundary!: BoundaryHandle;
      const reasons: unknown[] = [];
      const proto = definePrototype({
        name: `overlay-focus-regions-${name}`,
        setup() {
          overlay = asOverlay();
          overlay.keepMounted();
          overlay.configure({ defaultOpen: true, closeOnFocusOutside: true });
          overlay.registerTrigger(trigger);
          boundary = asBoundary();
          boundary.observe('focus.move'); // repeated observation must be idempotent
          boundary.subscribeOutside((event) => reasons.push(event.observation));
          return (r) => r.el('button', 'content');
        },
      });
      const mounted = await mount([{ proto }]);
      try {
        const root = mounted.host.querySelector<HTMLElement>('[data-pui-root]')!;
        const inside = root.querySelector('button')!;
        (owned as unknown as Record<symbol, unknown>)[ownership] = root;
        await mounted.focus(trigger);
        await mounted.focus(inside);
        await mounted.focus(owned);
        expect(overlay.isOpen()).toBe(true);
        expect(reasons).toEqual([]);
        const removeOpaque = boundary.registerRegion({ unknown: true });
        await mounted.focus(outside);
        expect(overlay.isOpen()).toBe(true);
        removeOpaque();
        await mounted.focus(inside);
        // A stale/raw synthetic focusin is not proof that the active focus left.
        await mounted.dispatch(outside, new FocusEvent('focusin', { bubbles: true }));
        expect(overlay.isOpen()).toBe(true);
        await mounted.focus(outside);
        expect(overlay.isOpen()).toBe(false);
        expect(reasons).toEqual(['focus.move']);
        expect(document.activeElement).toBe(outside);
      } finally {
        await mounted.unmount();
        trigger.remove();
        owned.remove();
        outside.remove();
      }
      expect(reasons).toEqual(['focus.move']);
    });

    it('T-BOUNDARY-0002-CASE-FOCUS-POLICY: focus observation cannot activate a pointer-only or disabled focus policy', async () => {
      const [trigger, outside, spare] = buttons();
      let overlay!: OverlayHandle;
      const proto = definePrototype({
        name: `overlay-focus-optout-${name}`,
        setup() {
          overlay = asOverlay();
          overlay.keepMounted();
          overlay.configure({
            defaultOpen: true,
            closeOnOutsidePress: true,
            closeOnFocusOutside: false,
          });
          asBoundary().observe('focus.move');
          overlay.registerTrigger(trigger);
          return (r) => r.el('button', 'content');
        },
      });
      const mounted = await mount([{ proto }]);
      try {
        await mounted.focus(trigger);
        await mounted.focus(outside);
        expect(overlay.isOpen()).toBe(true);
        await mounted.dispatch(outside, new MouseEvent('pointerdown', { bubbles: true }));
        expect(overlay.isOpen()).toBe(false);
      } finally {
        await mounted.unmount();
        trigger.remove();
        outside.remove();
        spare.remove();
      }
    });

    it.each([
      { reverse: false, reentrant: false },
      { reverse: true, reentrant: false },
      { reverse: false, reentrant: true },
      { reverse: true, reentrant: true },
    ])(
      'T-BOUNDARY-0002-CASE-FOCUS-STACK: one pointer/focus interaction keeps its top owner ($reverse, $reentrant)',
      async ({ reverse, reentrant }) => {
        const [inside, outside, later] = buttons();
        const handles: OverlayHandle[] = [];
        const reasons: string[][] = [[], []];
        const protos = [0, 1].map((i) =>
          definePrototype({
            name: `overlay-focus-stack-${name}-${reverse}-${reentrant}-${i}`,
            setup() {
              const overlay = (handles[i] = asOverlay());
              overlay.keepMounted();
              overlay.configure({
                defaultOpen: true,
                closeOnOutsidePress: true,
                closeOnFocusOutside: true,
              });
              overlay.registerTrigger(inside);
              overlay.open.watch((_run, event) => {
                if (event.type === 'next' && !event.next) {
                  reasons[i].push(String(event.reason));
                  if (reentrant && event.reason === 'outside.press') outside.focus();
                }
              });
              return (r) => r.el('button', 'content');
            },
          })
        );
        const mounted = await mount(
          (reverse ? [...protos].reverse() : protos).map((proto) => ({ proto }))
        );
        try {
          // Explicit activation order, independent of host listener order.
          handles[0].close();
          handles[0].openOverlay();
          handles[1].close();
          handles[1].openOverlay();
          reasons[0] = [];
          reasons[1] = [];
          await mounted.focus(inside);
          await mounted.dispatch(outside, new MouseEvent('pointerdown', { bubbles: true }));
          await mounted.focus(outside);
          expect(reasons).toEqual([[], ['outside.press']]);
          expect(handles[0].isOpen()).toBe(true);
          await mounted.dispatch(outside, new MouseEvent('pointerup', { bubbles: true }));
          await mounted.focus(later);
          expect(reasons).toEqual([['focus.outside'], ['outside.press']]);
          expect(document.activeElement).toBe(later);
        } finally {
          await mounted.unmount();
          inside.remove();
          outside.remove();
          later.remove();
        }
      }
    );

    it('T-BOUNDARY-0002-CASE-FOCUS-CONTROLLED: owner rejection does not duplicate a press or disable a later close request', async () => {
      const [inside, outside, later] = buttons();
      const reasons: unknown[] = [];
      let overlay!: OverlayHandle;
      let lowerCloses = 0;
      const proto = definePrototype({
        name: `overlay-focus-controlled-${name}`,
        setup() {
          overlay = asOverlay();
          overlay.keepMounted();
          overlay.configure({
            defaultOpen: true,
            closeOnOutsidePress: true,
            closeOnFocusOutside: true,
          });
          overlay.registerTrigger(inside);
          overlay.open.watch((_run, event) => {
            if (event.type !== 'next' || event.next) return;
            reasons.push(event.reason);
            overlay.openOverlay('controlled.sync');
          });
          return (r) => r.el('button', 'content');
        },
      });
      const lower = definePrototype({
        name: `overlay-focus-controlled-lower-${name}`,
        setup() {
          const lowerOverlay = asOverlay();
          lowerOverlay.keepMounted();
          lowerOverlay.configure({
            defaultOpen: true,
            closeOnOutsidePress: true,
            closeOnFocusOutside: true,
          });
          lowerOverlay.registerTrigger(inside);
          lowerOverlay.open.watch((_run, event) => {
            if (event.type === 'next' && !event.next) lowerCloses++;
          });
          return (r) => r.el('button', 'lower');
        },
      });
      const mounted = await mount([{ proto: lower }, { proto }]);
      try {
        await mounted.focus(inside);
        await mounted.dispatch(outside, new MouseEvent('pointerdown', { bubbles: true }));
        await mounted.focus(outside);
        expect(reasons).toEqual(['outside.press']);
        expect(overlay.isOpen()).toBe(true);
        await mounted.dispatch(outside, new MouseEvent('pointerup', { bubbles: true }));
        await mounted.dispatch(
          outside,
          new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
        );
        await mounted.focus(later);
        expect(reasons).toEqual(['outside.press', 'focus.outside']);
        await mounted.dispatch(outside, new MouseEvent('pointerdown', { bubbles: true }));
        await mounted.focus(outside);
        expect(reasons).toEqual(['outside.press', 'focus.outside', 'outside.press']);
        expect(lowerCloses).toBe(0);
      } finally {
        await mounted.unmount();
        inside.remove();
        outside.remove();
        later.remove();
      }
      const count = reasons.length;
      const target = document.createElement('button');
      document.body.append(target);
      target.focus();
      target.remove();
      expect(reasons).toHaveLength(count);
    });
  });
}
