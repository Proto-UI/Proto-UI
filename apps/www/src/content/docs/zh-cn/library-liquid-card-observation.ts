/** Read-only failure facts. This observer does not scroll, focus, hide, resize,
 * settle fonts, finish animations, or change the native assertion. */
export function collectLiquidCardObservation() {
  const card = document.querySelector<HTMLElement>('[data-library-liquid-candidate]');
  const describe = (element: Element | null) => {
    if (!element) return null;
    const style = getComputedStyle(element);
    return {
      tag: element.localName,
      id: element.id,
      className: element.getAttribute('class'),
      rect: element.getBoundingClientRect().toJSON(),
      position: style.position,
      transform: style.transform,
      animation: style.animation,
      transition: style.transition,
      visibility: style.visibility,
      display: style.display,
      overflow: style.overflow,
    };
  };
  const rect = card?.getBoundingClientRect();
  const ancestors = [];
  for (let element: Element | null = card ?? null; element; element = element.parentElement)
    ancestors.push(describe(element));
  const samples = rect
    ? [0.1, 0.5, 0.9].map((fraction) => {
        const x = Math.max(0, Math.min(innerWidth - 1, rect.x + rect.width / 2));
        const y = Math.max(0, Math.min(innerHeight - 1, rect.y + rect.height * fraction));
        const hit = document.elementFromPoint(x, y);
        return { x, y, cardContainsHit: !!hit && card!.contains(hit), hit: describe(hit) };
      })
    : [];
  return {
    at: performance.now(),
    timeline: document.timeline.currentTime,
    url: location.href,
    readyState: document.readyState,
    visibilityState: document.visibilityState,
    fonts: document.fonts.status,
    viewport: { width: innerWidth, height: innerHeight, scrollX, scrollY },
    document: {
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    },
    card: describe(card),
    ancestors,
    header: describe(document.querySelector('[data-docs-site-header]')),
    samples,
    animations: document.getAnimations().map((animation) => ({
      playState: animation.playState,
      currentTime: animation.currentTime,
      playbackRate: animation.playbackRate,
      target: describe(animation.effect instanceof KeyframeEffect ? animation.effect.target : null),
    })),
  };
}

/** A diagnostic is secondary: timeout, read/write/report failures and even
 * falsy thrown native values must never replace the original rejection. */
export async function boundedLiquidCardObservation<T>(
  observe: () => Promise<T>,
  deadlineMs = 1000
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(observe),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Liquid Card read-only observation exceeded its deadline')),
          deadlineMs
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function withLiquidCardFailureObservation<T>(
  work: () => Promise<T>,
  observe: () => Promise<unknown>,
  retain: (facts: unknown) => Promise<void>,
  report: (error: unknown) => void,
  deadlineMs = 1000
): Promise<T> {
  try {
    return await work();
  } catch (primary) {
    try {
      const facts = await boundedLiquidCardObservation(observe, deadlineMs);
      await retain(facts);
    } catch (secondary) {
      try {
        report(secondary);
      } catch {
        /* Preserve the original native failure. */
      }
    }
    throw primary;
  }
}
