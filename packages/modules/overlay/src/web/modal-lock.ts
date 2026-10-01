import type { OverlayModal } from '../caps';

type InlineStyleSnapshot = { value: string; priority: string };
type Lock = {
  owners: Set<object>;
  overflow: InlineStyleSnapshot;
  paddingRight: InlineStyleSnapshot | null;
};
const locks = new WeakMap<HTMLElement, Lock>();

function snapshotInlineStyle(el: HTMLElement, property: string): InlineStyleSnapshot {
  return {
    value: el.style.getPropertyValue(property),
    priority: el.style.getPropertyPriority(property),
  };
}

function restoreInlineStyle(
  el: HTMLElement,
  property: string,
  snapshot: InlineStyleSnapshot
): void {
  if (snapshot.value) el.style.setProperty(property, snapshot.value, snapshot.priority);
  else el.style.removeProperty(property);
}

/**
 * Width of the viewport scrollbar that disappears when body overflow is hidden.
 * Returns 0 when no scrollbar is present (overlay scrollbars, non-scrollable page).
 */
function measureScrollbarWidth(doc: Document): number {
  const view = doc.defaultView;
  const root = doc.documentElement;
  if (!view || !root) return 0;
  const width = view.innerWidth - root.clientWidth;
  return width > 0 ? width : 0;
}

/**
 * Web scroll-lock realization; one owner cannot release another owner's lock.
 * Compensates the removed scrollbar with body padding-right so the page does
 * not shift horizontally when the lock engages.
 */
export function createWebOverlayModal(doc: Document): OverlayModal {
  const owner = {};
  let body: HTMLElement | null = null;
  return {
    lock() {
      if (body || !doc.body) return;
      body = doc.body;
      let lock = locks.get(body);
      if (!lock) {
        const scrollbarWidth = measureScrollbarWidth(doc);
        lock = {
          owners: new Set(),
          overflow: snapshotInlineStyle(body, 'overflow'),
          paddingRight: scrollbarWidth > 0 ? snapshotInlineStyle(body, 'padding-right') : null,
        };
        locks.set(body, lock);
        if (scrollbarWidth > 0) {
          const computed = doc.defaultView?.getComputedStyle(body).paddingRight ?? '';
          const base = Number.parseFloat(computed);
          const total = (Number.isFinite(base) ? base : 0) + scrollbarWidth;
          body.style.setProperty('padding-right', `${total}px`);
        }
        body.style.setProperty('overflow', 'hidden', lock.overflow.priority);
      }
      lock.owners.add(owner);
    },
    unlock() {
      if (!body) return;
      const target = body;
      body = null;
      const lock = locks.get(target);
      if (!lock) return;
      lock.owners.delete(owner);
      if (lock.owners.size) return;
      restoreInlineStyle(target, 'overflow', lock.overflow);
      if (lock.paddingRight) restoreInlineStyle(target, 'padding-right', lock.paddingRight);
      locks.delete(target);
    },
  };
}
