import type { OverlayModal } from '../caps';

type InlineStyleSnapshot = { value: string; priority: string };
type Lock = {
  owners: Set<object>;
  overflow: InlineStyleSnapshot;
  padding: Map<string, InlineStyleSnapshot>;
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
 * Web scroll-lock realization; one owner cannot release another owner's lock.
 * Compensates only the measured removed gutter on its actual side so the page does
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
        const root = doc.documentElement;
        const before = { width: root.clientWidth, left: root.clientLeft };
        const computed = doc.defaultView?.getComputedStyle(body);
        const originalPadding = {
          left: Number.parseFloat(computed?.paddingLeft ?? ''),
          right: Number.parseFloat(computed?.paddingRight ?? ''),
        };
        lock = {
          owners: new Set(),
          overflow: snapshotInlineStyle(body, 'overflow'),
          padding: new Map(),
        };
        locks.set(body, lock);
        body.style.setProperty('overflow', 'hidden', lock.overflow.priority);
        // Reading after the lock flushes real layout. A root scrollbar or a
        // stable gutter may survive body overflow:hidden and need no padding.
        const gained = Math.max(0, root.clientWidth - before.width);
        const left = Math.min(gained, Math.max(0, before.left - root.clientLeft));
        for (const [side, amount] of [
          ['left', left],
          ['right', gained - left],
        ] as const) {
          if (!Number.isFinite(amount) || amount <= 0) continue;
          const property = `padding-${side}`;
          const snapshot = snapshotInlineStyle(body, property);
          lock.padding.set(property, snapshot);
          const base = originalPadding[side];
          body.style.setProperty(
            property,
            `${(Number.isFinite(base) ? base : 0) + amount}px`,
            snapshot.priority
          );
        }
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
      for (const [property, snapshot] of lock.padding)
        restoreInlineStyle(target, property, snapshot);
      locks.delete(target);
    },
  };
}
