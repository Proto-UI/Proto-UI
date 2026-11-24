import { isWebComponentPortaled } from './portal-mount';

/** Let a hidden portal leave the compositor before revoking its projection.
 * Removing animation styles and reparenting in the conceal microtask can paint
 * one opaque stale layer in Chromium. A rendering opportunity, not an animation
 * duration or a forced layout read, separates those host operations.
 */
export function createPortalConcealBarrier(host: HTMLElement) {
  let pending: (() => void) | null = null;
  let generation = 0;
  const properties = [
    ['visibility', 'hidden'],
    ['opacity', '0'],
  ] as const;
  type StyleValue = { value: string; priority: string };
  type ConcealLease = {
    styles: Map<string, { before: StyleValue; written: StyleValue }>;
    inert: { before: string | null; written: string } | null;
  };
  let lease: ConcealLease | null = null;
  // A failed host operation retains its claim for retry. A replacement can
  // inherit the original baseline while an older release is still on stack.
  const cleanup = new Set<ConcealLease>();
  const read = (property: string): StyleValue => ({
    value: host.style.getPropertyValue(property),
    priority: host.style.getPropertyPriority(property),
  });
  const same = (left: StyleValue, right: StyleValue) =>
    left.value === right.value && left.priority === right.priority;
  const discardEmpty = (record: ConcealLease) => {
    if (!record.styles.size && record.inert === null) cleanup.delete(record);
  };
  const takeStyleBaseline = (property: string, value: StyleValue) => {
    let before = value;
    for (const record of cleanup) {
      const claim = record.styles.get(property);
      if (!claim) continue;
      if (same(value, claim.written)) before = claim.before;
      // Matching claims transfer; a changed value belongs to the later writer.
      // Neither may be restored by the older release after this handoff.
      record.styles.delete(property);
      discardEmpty(record);
    }
    return before;
  };
  const takeInertBaseline = (value: string | null) => {
    let before = value;
    for (const record of cleanup) {
      if (!record.inert) continue;
      if (value === record.inert.written) before = record.inert.before;
      record.inert = null;
      discardEmpty(record);
    }
    return before;
  };
  const release = () => {
    if (lease) cleanup.add(lease);
    lease = null;
    const token = ++generation;
    let failed = false;
    let firstError: unknown;
    const attempt = (restore: () => void) => {
      try {
        restore();
      } catch (error) {
        if (!failed) firstError = error;
        failed = true;
      }
    };
    for (const record of [...cleanup]) {
      for (const [property, { before, written }] of [...record.styles]) {
        if (generation !== token) break;
        attempt(() => {
          const value = read(property);
          if (generation !== token) return;
          if (same(value, written) && !same(before, written)) {
            if (before.value) host.style.setProperty(property, before.value, before.priority);
            else host.style.removeProperty(property);
            if (generation !== token) return;
            const restored = read(property);
            if (generation !== token) return;
            if (same(restored, written))
              throw new Error(`[portal-conceal] Failed to restore ${property}`);
          }
          record.styles.delete(property);
        });
      }
      if (generation !== token) break;
      attempt(() => {
        const inert = record.inert;
        if (!inert) return;
        if (inert.before === null) {
          const value = host.getAttribute('inert');
          if (generation !== token) return;
          if (value === inert.written) {
            host.removeAttribute('inert');
            if (generation !== token) return;
            const restored = host.getAttribute('inert');
            if (generation !== token) return;
            if (restored === inert.written)
              throw new Error('[portal-conceal] Failed to restore inert');
          }
        }
        record.inert = null;
      });
      discardEmpty(record);
    }
    if (failed) throw firstError;
  };
  const conceal = (): boolean => {
    if (!isWebComponentPortaled(host) || !host.isConnected) return false;
    if (lease) {
      // A later writer owns any changed value or priority. Never reclaim it
      // when the queued reconciliation joins this already hidden interval.
      const previous = lease,
        token = generation;
      try {
        const accepted =
          previous.styles.size === properties.length &&
          previous.inert !== null &&
          [...previous.styles].every(([property, value]) => same(read(property), value.written)) &&
          host.getAttribute('inert') === previous.inert.written;
        return generation === token && lease === previous && accepted;
      } catch {
        return false;
      }
    }
    const token = ++generation;
    const next: ConcealLease = { styles: new Map(), inert: null };
    lease = next;
    let accepted = false;
    try {
      for (const [property, value] of properties) {
        const current = read(property);
        if (generation !== token || lease !== next) return false;
        next.styles.set(property, {
          before: takeStyleBaseline(property, current),
          written: { value, priority: 'important' },
        });
      }
      const inertValue = host.getAttribute('inert');
      if (generation !== token || lease !== next) return false;
      next.inert = { before: takeInertBaseline(inertValue), written: inertValue ?? '' };
      for (const [property, { written }] of next.styles) {
        if (generation !== token || lease !== next) return false;
        const value = read(property);
        if (generation !== token || lease !== next) return false;
        if (!same(value, written))
          host.style.setProperty(property, written.value, written.priority);
      }
      if (generation !== token || lease !== next) return false;
      if (inertValue === null) host.setAttribute('inert', next.inert.written);
      if (generation !== token || lease !== next) return false;
      const css = host.ownerDocument.defaultView?.getComputedStyle(host);
      accepted =
        [...next.styles].every(([property, value]) => same(read(property), value.written)) &&
        host.getAttribute('inert') === next.inert.written &&
        css?.visibility === 'hidden' &&
        css.opacity !== '' &&
        Number(css.opacity) === 0;
    } catch {
      // The adapter can conceal with its existing detached marker immediately
      // when this host cannot apply the temporary, layout-preserving lease.
    }
    if (generation !== token || lease !== next) return false;
    if (!accepted) release();
    return accepted;
  };
  return {
    // Acquire at detached intent, before queued view reconciliation. Opacity
    // also conceals descendants that explicitly override inherited visibility;
    // inert and the adapter's event gate prevent a transparent interaction layer.
    conceal,
    cancel() {
      const waiting = pending !== null || lease !== null || cleanup.size > 0;
      const previous = lease;
      try {
        pending?.();
      } finally {
        if (pending === null && lease === previous) release();
      }
      return waiting;
    },
    wait(): Promise<void> | null {
      pending?.();
      const doc = host.ownerDocument;
      const view = doc.defaultView;
      if (
        !isWebComponentPortaled(host) ||
        !host.isConnected ||
        doc.visibilityState !== 'visible' ||
        typeof view?.requestAnimationFrame !== 'function'
      ) {
        release();
        return null;
      }
      if (!conceal()) {
        release();
        return null;
      }
      return new Promise((resolve) => {
        let frame: number | null = null;
        const finish = () => {
          if (pending !== finish) return;
          pending = null;
          const previous = lease;
          try {
            if (frame !== null) view.cancelAnimationFrame(frame);
          } finally {
            try {
              doc.removeEventListener('visibilitychange', onVisibility);
            } finally {
              try {
                if (pending === null && lease === previous) release();
              } finally {
                resolve();
              }
            }
          }
        };
        const onVisibility = () => {
          if (doc.visibilityState !== 'visible') finish();
        };
        pending = finish;
        doc.addEventListener('visibilitychange', onVisibility);
        try {
          frame = view.requestAnimationFrame(() => {
            if (pending !== finish) return;
            try {
              frame = view.requestAnimationFrame(finish);
            } catch {
              finish();
            }
          });
        } catch {
          finish();
        }
      });
    },
  };
}
