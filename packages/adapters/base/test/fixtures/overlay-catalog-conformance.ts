import { describe, expect, it } from 'vitest';
import { definePrototype, type Prototype, type OverlayHandle } from '@proto.ui/core';
import { asOverlay } from '@proto.ui/hooks';
export type OverlayTree = { proto: Prototype; children?: OverlayTree[] };
export type OverlayMount = {
  host: HTMLElement;
  flush(): Promise<void>;
  unmount(): Promise<void>;
  dispatch(target: EventTarget, event: Event): Promise<void>;
};
export function overlayCatalogConformance(
  name: string,
  mount: (tree: OverlayTree[]) => Promise<OverlayMount>
) {
  describe(`${name}: Overlay catalog`, () => {
    it.each([false, true])(
      'T-OVERLAY-CATALOG-0001-CASE-ESCAPE: nested Escape has one owner (controlled=%s)',
      async (controlled) => {
        const handles: OverlayHandle[] = [];
        const requests = [0, 0, 0];
        const protos = [0, 1, 2].map((index) =>
          definePrototype({
            name: `overlay-${name}-${controlled ? 'controlled' : 'ordinary'}-${index}`,
            setup() {
              const overlay = (handles[index] = asOverlay());
              overlay.configure({ defaultOpen: true, closeOnEscape: index !== 2 });
              overlay.open.watch((_run, event) => {
                if (event.type !== 'next' || event.next || event.reason !== 'escape') return;
                requests[index]++;
                if (controlled && index === 1) overlay.openOverlay('controlled.sync');
              });
              return (r) => r.slot();
            },
          })
        );
        const mounted = await mount([
          { proto: protos[0], children: [{ proto: protos[1] }] },
          { proto: protos[2] },
        ]);
        try {
          await mounted.flush();
          await mounted.dispatch(
            document,
            new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
          );
          expect(requests).toEqual([0, 0, 0]);
          await mounted.dispatch(
            document,
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
          );
          await mounted.flush();
          expect(requests).toEqual([0, 1, 0]);
          expect(handles[0].isOpen()).toBe(true);
          await mounted.dispatch(
            document,
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
          );
          await mounted.flush();
          expect(requests).toEqual(controlled ? [0, 2, 0] : [1, 1, 0]);
        } finally {
          await mounted.unmount();
        }
        const previous = [...requests];
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(requests).toEqual(previous);
      }
    );
    it.each([0, 1])(
      'T-OVERLAY-CATALOG-0001-CASE-MODAL: shared scroll lock restores only after the last owner (first=%s)',
      async (first) => {
        const before = document.body.style.cssText;
        document.body.style.setProperty('overflow', 'scroll', 'important');
        const protos = [0, 1].map((index) =>
          definePrototype({
            name: `overlay-modal-${name}-${first}-${index}`,
            setup(def) {
              const overlay = asOverlay();
              overlay.configure({ defaultOpen: true, modal: true });
              def.event.on('host:close-modal', () => overlay.close('programmatic'));
              return (r) => r.el('span', 'modal');
            },
          })
        );
        const mounted = await mount(protos.map((proto) => ({ proto })));
        try {
          await mounted.flush();
          const roots = [...mounted.host.querySelectorAll<HTMLElement>('[data-pui-root]')];
          expect(roots).toHaveLength(2);
          expect(document.body.style.overflow).toBe('hidden');
          await mounted.dispatch(roots[first], new Event('close-modal'));
          await mounted.flush();
          expect(document.body.style.overflow).toBe('hidden');
          await mounted.dispatch(roots[1 - first], new Event('close-modal'));
          await mounted.flush();
          expect(document.body.style.overflow).toBe('scroll');
          expect(document.body.style.getPropertyPriority('overflow')).toBe('important');
        } finally {
          await mounted.unmount();
          document.body.style.cssText = before;
        }
      }
    );
  });
}
