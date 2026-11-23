/** Read-only classification of browser inputs and declared WC Button signals.
 * C-EXPOSE-EVENT-0001-D/E keeps outward CustomEvent transport distinct from
 * User -> Component input. An untrusted MouseEvent is still synthetic input.
 * Callers supply only current recipe refs whose prototypes declare click:void. */
export function observeRecipeInput(event: Event, outwardClickRoots: ReadonlySet<HTMLElement>) {
  const target = event.target as HTMLElement | null;
  const realm = target?.ownerDocument?.defaultView;
  const registered = target && realm?.customElements.get(target.localName);
  const outward = Boolean(
    realm &&
    event instanceof realm.CustomEvent &&
    event.type === 'click' &&
    event.detail == null &&
    event.bubbles &&
    event.cancelable &&
    target &&
    outwardClickRoots.has(target) &&
    target.hasAttribute('data-pui-root') &&
    registered &&
    target instanceof registered &&
    typeof (target as HTMLElement & { getExposes?: unknown }).getExposes === 'function'
  );
  const physical = Boolean(
    realm &&
    ((event.type === 'keydown' && event instanceof realm.KeyboardEvent) ||
      (event.type === 'click' && event instanceof realm.MouseEvent) ||
      (event.type === 'input' && event instanceof realm.InputEvent) ||
      (event.type === 'wheel' && event instanceof realm.WheelEvent) ||
      ([
        'pointerdown',
        'pointermove',
        'pointerup',
        'pointercancel',
        'gotpointercapture',
        'lostpointercapture',
      ].includes(event.type) &&
        typeof realm.PointerEvent === 'function' &&
        event instanceof realm.PointerEvent) ||
      (['touchstart', 'touchmove', 'touchend', 'touchcancel'].includes(event.type) &&
        typeof realm.TouchEvent === 'function' &&
        event instanceof realm.TouchEvent))
  );
  return {
    type: event.type,
    trusted: event.isTrusted,
    eventClass: event.constructor.name,
    channel: outward ? 'outward-signal' : physical ? 'physical-input' : 'unclassified',
    target: target?.closest?.('[data-demo-ref]')?.getAttribute('data-demo-ref'),
    ...(outward ? { carrier: 'wc-expose-click-void' } : {}),
  };
}
