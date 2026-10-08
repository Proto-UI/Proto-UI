/** Event-driven, one scheduled frame per document and one shared observer per
 * participating document/shadow tree. A static material
 * does not retain a perpetual per-surface RAF. External CSS animation outside
 * this finite geometry contract is not silently treated as captured content. */
const observers = new WeakMap<
  Document,
  {
    listeners: Set<() => void>;
    ownStyles: Map<HTMLElement, () => string | null>;
    resize: ResizeObserver | null;
    watchRoot(root: ShadowRoot): () => void;
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
    const onMutation = (records: MutationRecord[]) => {
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
    };
    const mutationOptions: MutationObserverInit = {
      attributes: true,
      attributeFilter: [
        'style',
        'class',
        'data-pui-style',
        'data-theme',
        'data-pui-material-carrier',
        'hidden',
        'slot',
        'name',
      ],
      childList: true,
      subtree: true,
    };
    const mutation = new win.MutationObserver(onMutation);
    mutation.observe(doc.documentElement, mutationOptions);
    const roots = new Map<ShadowRoot, { users: number; stop(): void }>();
    const resize = win.ResizeObserver ? new win.ResizeObserver(schedule) : null;
    win.addEventListener('resize', schedule);
    win.addEventListener('scroll', schedule, true);
    doc.addEventListener('transitionend', schedule, true);
    doc.addEventListener('animationend', schedule, true);
    shared = {
      listeners,
      ownStyles,
      resize,
      watchRoot(root) {
        let record = roots.get(root);
        if (!record) {
          const observer = new win.MutationObserver(onMutation);
          observer.observe(root, mutationOptions);
          for (const event of ['scroll', 'slotchange', 'transitionend', 'animationend'])
            root.addEventListener(event, schedule, true);
          record = {
            users: 0,
            stop() {
              observer.disconnect();
              for (const event of ['scroll', 'slotchange', 'transitionend', 'animationend'])
                root.removeEventListener(event, schedule, true);
            },
          };
          roots.set(root, record);
        }
        const lease = record;
        lease.users++;
        return () => {
          if (--lease.users === 0) {
            lease.stop();
            roots.delete(root);
          }
        };
      },
      stop() {
        if (frame !== null) win.cancelAnimationFrame(frame);
        mutation.disconnect();
        for (const root of roots.values()) root.stop();
        roots.clear();
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
  let retired = false;
  const rootLeases = new Map<ShadowRoot, () => void>();
  function refreshRoots() {
    const next = new Set<ShadowRoot>();
    for (let element: Element | null = host; element; ) {
      const root = element.getRootNode();
      if (root instanceof win.ShadowRoot) next.add(root);
      element =
        element.assignedSlot ??
        element.parentElement ??
        (root instanceof win.ShadowRoot ? root.host : null);
    }
    for (const [root, release] of rootLeases)
      if (!next.has(root)) {
        release();
        rootLeases.delete(root);
      }
    for (const root of next) if (!rootLeases.has(root)) rootLeases.set(root, entry.watchRoot(root));
  }
  const notify = () => {
    if (retired) return;
    refreshRoots();
    changed();
  };
  refreshRoots();
  entry.listeners.add(notify);
  entry.ownStyles.set(host, ownStyle);
  entry.resize?.observe(host);
  return () => {
    if (retired) return;
    retired = true;
    entry.listeners.delete(notify);
    for (const release of rootLeases.values()) release();
    rootLeases.clear();
    entry.ownStyles.delete(host);
    entry.resize?.unobserve(host);
    if (!entry.listeners.size) {
      entry.stop();
      observers.delete(doc);
    }
  };
}
