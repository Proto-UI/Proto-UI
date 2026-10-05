export type NativeLinkFacts = Readonly<{
  hovered: boolean;
  focusVisible: boolean;
  pressed: boolean;
  current: boolean;
  /** Visibility is a weaker TOC cue, never a second navigation-current owner. */
  inView?: boolean;
}>;

function isCurrent(link: HTMLElement): boolean {
  return link.hasAttribute('aria-current') && link.getAttribute('aria-current') !== 'false';
}

/** Observe browser-owned facts without intercepting or synthesizing navigation.
 * No click listener, default prevention, focus request or added focus target. */
export function bindNativeLinkFacts(
  link: HTMLElement,
  project: (facts: NativeLinkFacts) => void,
  options: { isActive?: () => boolean } = {}
): () => void {
  const view = link.ownerDocument.defaultView;
  let alive = true;
  let hovered = false;
  let pressed = false;
  const focusVisible = () =>
    link.ownerDocument.activeElement === link && link.matches(':focus-visible');
  const snapshot = (): NativeLinkFacts => ({
    hovered,
    pressed,
    focusVisible: focusVisible(),
    current: isCurrent(link),
    inView: link.dataset.siteLinkAppearance === 'toc' && link.hasAttribute('in-view'),
  });
  const publish = () => {
    if (alive && link.isConnected && (options.isActive?.() ?? true)) project(snapshot());
  };
  const enter = () => {
    hovered = true;
    publish();
  };
  const leave = () => {
    hovered = false;
    pressed = false;
    publish();
  };
  const down = (event: Event) => {
    if ((event as PointerEvent).button === 0) {
      pressed = true;
      publish();
    }
  };
  const up = () => {
    if (pressed) {
      pressed = false;
      publish();
    }
  };
  const focus = () => publish();
  const blur = () => {
    pressed = false;
    publish();
  };
  const keydown = (event: Event) => {
    if (
      (event as KeyboardEvent).key === 'Enter' ||
      (link.localName === 'summary' && (event as KeyboardEvent).key === ' ')
    )
      pressed = true;
    publish();
  };
  const keyup = (event: Event) => {
    if (
      (event as KeyboardEvent).key === 'Enter' ||
      (link.localName === 'summary' && (event as KeyboardEvent).key === ' ')
    )
      pressed = false;
    publish();
  };
  const windowBlur = () => {
    hovered = false;
    pressed = false;
    publish();
  };
  const handlers = {
    pointerenter: enter,
    pointerleave: leave,
    pointerdown: down,
    pointercancel: leave,
    focus,
    blur,
    keydown,
    keyup,
  };
  for (const [name, handler] of Object.entries(handlers)) link.addEventListener(name, handler);
  view?.addEventListener('pointerup', up);
  view?.addEventListener('blur', windowBlur);
  const observer = view ? new view.MutationObserver(publish) : null;
  observer?.observe(link, { attributes: true, attributeFilter: ['aria-current', 'in-view'] });
  publish();
  return () => {
    if (!alive) return;
    alive = false;
    observer?.disconnect();
    for (const [name, handler] of Object.entries(handlers)) link.removeEventListener(name, handler);
    view?.removeEventListener('pointerup', up);
    view?.removeEventListener('blur', windowBlur);
    project({
      hovered: false,
      focusVisible: false,
      pressed: false,
      current: isCurrent(link),
      inView: link.dataset.siteLinkAppearance === 'toc' && link.hasAttribute('in-view'),
    });
  };
}
