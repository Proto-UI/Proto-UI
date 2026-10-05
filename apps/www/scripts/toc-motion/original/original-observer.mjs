/** Runs only in the actual page. Reads DOM/CSS, adds passive listeners and an observer global.
 * Does not replace product methods, override layout, add attributes or mutate styles. */
export function installOriginalObserver() {
  const host = document.querySelector('.right-sidebar sl-toc');
  if (!host) throw Error('Original desktop sl-toc is missing');
  const ids = new WeakMap();
  let nextId = 0;
  const id = (node) => {
    if (!ids.has(node)) ids.set(node, ++nextId);
    return ids.get(node);
  };
  const state = {
    stage: 'initial',
    frames: [],
    events: [],
    sampling: false,
    frameId: 0,
  };
  const rectangle = (r) => ({
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
  });
  const read = () => {
    const highlights = [...host.children].filter(
      (el) =>
        el.localName === 'div' &&
        el.getAttribute('aria-hidden') === 'true' &&
        el.classList.contains('bg-primary/5')
    );
    const h = highlights.length === 1 ? highlights[0] : null;
    const style = h ? getComputedStyle(h) : null;
    const links = [...host.querySelectorAll('a')],
      visible = links.filter((a) => a.hasAttribute('in-view'));
    const first = visible[0]?.getBoundingClientRect(),
      last = visible.at(-1)?.getBoundingClientRect();
    const bounds = host.getBoundingClientRect();
    const target =
      first && last
        ? {
            x: first.left - bounds.left + host.scrollLeft - 16,
            y: first.top - bounds.top + host.scrollTop - 4,
            width: Math.max(0, last.right - first.left + 32),
            height: Math.max(0, last.bottom - first.top + 8),
          }
        : null;
    const boundary =
      (document.querySelector('header')?.getBoundingClientRect().height ?? 0) +
      (host.querySelector('summary')?.getBoundingClientRect().height ?? 0) +
      32;
    const headings = links
      .map((a) => ({
        hash: a.hash,
        node: document.getElementById(decodeURIComponent(a.hash.slice(1))),
      }))
      .filter((x) => x.node?.matches('h1,h2,h3,h4,h5,h6'));
    const expectedCurrent =
      headings.filter((x) => x.node.getBoundingClientRect().top <= boundary).at(-1)?.hash ??
      headings[0]?.hash ??
      null;
    return {
      t: performance.now(),
      timeOrigin: performance.timeOrigin,
      stage: state.stage,
      frameId: state.frameId,
      samplePhase: 'task after animation-frame callbacks',
      scrollY,
      current: links.filter((a) => a.getAttribute('aria-current') === 'true').map((a) => a.hash),
      expectedCurrent,
      readingBoundary: boundary,
      inView: visible.map((a) => a.hash),
      highlightCount: highlights.length,
      highlightId: h ? id(h) : null,
      actual: style
        ? {
            x: parseFloat(style.left),
            y: parseFloat(style.top),
            width: parseFloat(style.width),
            height: parseFloat(style.height),
          }
        : null,
      inlineTarget: h
        ? {
            x: parseFloat(h.style.left),
            y: parseFloat(h.style.top),
            width: parseFloat(h.style.width),
            height: parseFloat(h.style.height),
          }
        : null,
      target,
      screenActual: h ? rectangle(h.getBoundingClientRect()) : null,
      hostBounds: rectangle(bounds),
      viewport: {
        width: innerWidth,
        height: innerHeight,
        dpr: devicePixelRatio,
        scale: visualViewport?.scale,
      },
      theme: document.documentElement.dataset.theme,
      family: document.documentElement.dataset.siteLibraryFamily ?? null,
      highlight: h
        ? {
            tag: h.localName,
            className: h.className,
            ariaHidden: h.getAttribute('aria-hidden'),
            pointerEvents: style.pointerEvents,
            visibility: style.visibility,
            opacity: style.opacity,
            backgroundColor: style.backgroundColor,
            borderRadius: style.borderRadius,
            transitionDuration: style.transitionDuration,
            transitionProperty: style.transitionProperty,
            transitionTimingFunction: style.transitionTimingFunction,
            inline: {
              left: h.style.left,
              top: h.style.top,
              width: h.style.width,
              height: h.style.height,
            },
          }
        : null,
    };
  };
  state.read = read;
  for (const type of ['wheel', 'scroll'])
    window.addEventListener(
      type,
      (event) =>
        state.events.push({
          t: performance.now(),
          stage: state.stage,
          type,
          trusted: event.isTrusted,
          scrollY,
          deltaY: event.deltaY ?? null,
        }),
      { passive: true }
    );
  host.addEventListener(
    'click',
    (event) =>
      state.events.push({
        t: performance.now(),
        stage: state.stage,
        type: 'click',
        trusted: event.isTrusted,
        hash: event.target.closest('a')?.hash ?? null,
        scrollY,
      }),
    { passive: true }
  );
  const tick = () => {
    state.frameId++;
    if (state.sampling) {
      const stage = state.stage;
      setTimeout(() => {
        if (state.sampling && state.stage === stage) state.frames.push(read());
      }, 0);
    }
    state.raf = requestAnimationFrame(tick);
  };
  state.raf = requestAnimationFrame(tick);
  window.__originalTocEvidence = state;
}
