import type { OverlayModal } from '../caps';

type Lock = { owners: Set<object>; value: string; priority: string };
const locks = new WeakMap<HTMLElement, Lock>();

/** Web scroll-lock realization; one owner cannot release another owner's lock. */
export function createWebOverlayModal(doc: Document): OverlayModal {
  const owner = {};
  let body: HTMLElement | null = null;
  return {
    lock() {
      if (body || !doc.body) return;
      body = doc.body;
      let lock = locks.get(body);
      if (!lock) {
        lock = {
          owners: new Set(),
          value: body.style.getPropertyValue('overflow'),
          priority: body.style.getPropertyPriority('overflow'),
        };
        locks.set(body, lock);
        body.style.setProperty('overflow', 'hidden', lock.priority);
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
      if (lock.value) target.style.setProperty('overflow', lock.value, lock.priority);
      else target.style.removeProperty('overflow');
      locks.delete(target);
    },
  };
}
