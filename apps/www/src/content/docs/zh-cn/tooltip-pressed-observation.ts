/** Test-only public DOM observer. Self-contained so Playwright can serialize it. */
export function observeTooltipPress(original: Element) {
  const document = original.ownerDocument;
  const view = document.defaultView!;
  const previewer = original.closest('[data-previewer-id]');
  const previewerId = previewer?.getAttribute('data-previewer-id') ?? null;
  const ref = original.getAttribute('data-demo-ref');
  const identities = new WeakMap<object, number>();
  let nextIdentity = 0;
  let point: { x: number; y: number } | null = null;
  let stopped = false;
  let dropped = 0;
  const records: unknown[] = [];
  const describe = (target: EventTarget | null) => {
    if (!target) return null;
    if (!identities.has(target)) identities.set(target, ++nextIdentity);
    return {
      identity: identities.get(target),
      node: target instanceof view.Element ? target.localName : target.constructor.name,
      id: target instanceof view.Element ? target.id : null,
      ref: target instanceof view.Element ? target.getAttribute('data-demo-ref') : null,
    };
  };
  const current = () =>
    Array.from(document.querySelectorAll('[data-previewer-id]'))
      .filter((root) => root.getAttribute('data-previewer-id') === previewerId)
      .flatMap((root) => Array.from(root.querySelectorAll('[data-demo-ref]')))
      .filter((element) => element.getAttribute('data-demo-ref') === ref);
  const paint = (element: Element | null) => {
    if (!element) return null;
    const style = view.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      ...describe(element),
      connected: element.isConnected,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      tokens: element.getAttribute('data-pui-style'),
      inlineStyle: element.getAttribute('style'),
      hovered: element.hasAttribute('data-hovered'),
      focused: element.hasAttribute('data-focused'),
      focusVisible: element.hasAttribute('data-focus-visible'),
      disabled: element.getAttribute('aria-disabled'),
      transform: style.transform,
      scale: style.getPropertyValue('scale'),
      scaleX: style.getPropertyValue('--pui-scale-x'),
      scaleY: style.getPropertyValue('--pui-scale-y'),
      display: style.display,
    };
  };
  const sample = (phase: string, nextPoint?: { x: number; y: number }, event?: Event) => {
    if (stopped) return;
    if (nextPoint) point = nextPoint;
    if (records.length >= 128) {
      // Retain installation identity and the latest evidence, including failure.
      records.splice(1, 1);
      dropped++;
    }
    const candidates = current();
    const target = candidates[0] ?? null;
    const hit = point ? document.elementFromPoint(point.x, point.y) : null;
    const mouse = event instanceof view.MouseEvent ? event : null;
    const path = event?.composedPath() ?? [];
    records.push({
      phase,
      time: view.performance.now(),
      original: paint(original),
      current: paint(target),
      sameIdentity: target === original,
      currentCount: candidates.length,
      activeElement: describe(document.activeElement),
      scroll: { x: view.scrollX, y: view.scrollY },
      viewport: { width: view.innerWidth, height: view.innerHeight },
      point,
      hit: describe(hit),
      hitWithinCurrent: Boolean(target && hit && target.contains(hit)),
      event: event
        ? {
            type: event.type,
            trusted: event.isTrusted ?? null,
            target: describe(event.target),
            path: path.slice(0, 10).map(describe),
            pathTruncated: path.length > 10,
            clientX: mouse?.clientX,
            clientY: mouse?.clientY,
            buttons: mouse?.buttons,
          }
        : null,
    });
  };
  const events = [
    'pointermove',
    'pointerdown',
    'pointerup',
    'pointerleave',
    'pointercancel',
    'lostpointercapture',
    'mousedown',
    'focus',
    'blur',
  ];
  const onEvent = (event: Event) => {
    const nextPoint =
      event instanceof view.MouseEvent ? { x: event.clientX, y: event.clientY } : undefined;
    sample('native-event-capture', nextPoint, event);
    // A capture-listener microtask is not proof that native dispatch completed.
    view.queueMicrotask(() => sample(`capture-microtask:${event.type}`));
  };
  for (const type of events) document.addEventListener(type, onEvent, true);
  const mutations = new view.MutationObserver(() => sample('attribute-change'));
  mutations.observe(original, {
    attributes: true,
    attributeFilter: [
      'data-pui-style',
      'style',
      'class',
      'data-hovered',
      'data-focused',
      'data-focus-visible',
      'aria-disabled',
    ],
  });
  sample('installed');
  const read = () => ({ previewerId, records: [...records], dropped });
  const stop = () => {
    stopped = true;
    mutations.disconnect();
    for (const type of events) document.removeEventListener(type, onEvent, true);
  };
  return {
    sample,
    read,
    stop,
    freeze() {
      try {
        sample('failure-before-mouseup');
      } finally {
        stop();
      }
      return read();
    },
  };
}
