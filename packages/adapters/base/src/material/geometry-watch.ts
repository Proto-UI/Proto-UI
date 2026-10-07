/** Event-driven, one observer/scheduled frame per document. A static material
 * does not retain a perpetual per-surface RAF. External CSS animation outside
 * this finite geometry contract is not silently treated as captured content. */
const observers = new WeakMap<
  Document,
  {
    listeners: Set<() => void>;
    ownStyles: Map<HTMLElement, () => string | null>;
    resize: ResizeObserver | null;
    stop(): void;
  }
>();
export function observeMaterialGeometry(
  host: HTMLElement,
  changed: () => void,
  ownStyle: () => string | null
) {
  const doc = host.ownerDocument,
    win = doc.defaultView!;
  let shared = observers.get(doc);
  if (!shared) {
    const listeners = new Set<() => void>(),
      ownStyles = new Map<HTMLElement, () => string | null>();
    let frame: number | null = null;
    const schedule = () => {
      if (frame !== null) return;
      frame = win.requestAnimationFrame(() => {
        frame = null;
        for (const fn of [...listeners]) fn();
      });
    };
    const mutation = new win.MutationObserver((records) => {
      if (
        records.some(
          (record) =>
            record.type !== 'attributes' ||
            record.attributeName !== 'style' ||
            !ownStyles.has(record.target as HTMLElement) ||
            (record.target as HTMLElement).getAttribute('style') !==
              ownStyles.get(record.target as HTMLElement)!()
        )
      )
        schedule();
    });
    mutation.observe(doc.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'class', 'data-pui-style', 'data-theme', 'hidden'],
      childList: true,
      subtree: true,
    });
    const resize = win.ResizeObserver ? new win.ResizeObserver(schedule) : null;
    win.addEventListener('resize', schedule);
    win.addEventListener('scroll', schedule, true);
    doc.addEventListener('transitionend', schedule, true);
    doc.addEventListener('animationend', schedule, true);
    shared = {
      listeners,
      ownStyles,
      resize,
      stop() {
        if (frame !== null) win.cancelAnimationFrame(frame);
        mutation.disconnect();
        resize?.disconnect();
        win.removeEventListener('resize', schedule);
        win.removeEventListener('scroll', schedule, true);
        doc.removeEventListener('transitionend', schedule, true);
        doc.removeEventListener('animationend', schedule, true);
      },
    };
    observers.set(doc, shared);
  }
  const entry = shared;
  entry.listeners.add(changed);
  entry.ownStyles.set(host, ownStyle);
  entry.resize?.observe(host);
  return () => {
    entry.listeners.delete(changed);
    entry.ownStyles.delete(host);
    entry.resize?.unobserve(host);
    if (!entry.listeners.size) {
      entry.stop();
      observers.delete(doc);
    }
  };
}
