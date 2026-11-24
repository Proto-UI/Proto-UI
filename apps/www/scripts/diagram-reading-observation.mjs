import { isDeepStrictEqual } from 'node:util';

// Passed directly to Locator.evaluate. Keep this callback self-contained: it
// must also execute after Function#toString serialization in a fresh realm.
export function observeDiagramReadingViewport(viewport, options = {}) {
  const doc = viewport.ownerDocument;
  const win = doc.defaultView;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const startedAt = win.performance.now();
  const content = viewport.closest('[data-docs-image-content]');
  const image = viewport.querySelector('.docs-image-full');
  const canvas = viewport.closest('[data-docs-image-canvas]');
  const root = viewport.closest('[data-docs-image-reading-root]');
  const toolbar = content?.querySelector('.docs-image-toolbar');
  const initialFontStatus = doc.fonts.status;
  const firstSamples = [];
  const lastSamples = [];
  let sampleCount = 0;

  const rect = (node) => {
    const box = node.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  };
  const paint = (node) => {
    const style = win.getComputedStyle(node);
    return {
      rect: rect(node),
      transform: style.transform,
      translate: style.translate,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
    };
  };
  const trace = () => ({
    initialFontStatus,
    sampleCount,
    omittedSamples: Math.max(0, sampleCount - firstSamples.length - lastSamples.length),
    samples: [...firstSamples, ...lastSamples],
  });
  const read = () => {
    if (
      !viewport.isConnected ||
      !content?.isConnected ||
      !image?.isConnected ||
      !canvas?.isConnected ||
      !root?.isConnected ||
      !toolbar?.isConnected ||
      viewport.closest('[data-docs-image-content]') !== content ||
      viewport.querySelector('.docs-image-full') !== image
    )
      throw new Error('The reading viewport or its image owner changed during observation.');
    const viewportStyle = win.getComputedStyle(viewport);
    const imageStyle = win.getComputedStyle(image);
    const animations = content.getAnimations({ subtree: true }).map((animation) => ({
      target: animation.effect?.target?.localName ?? null,
      animationName: animation.animationName ?? null,
      transitionProperty: animation.transitionProperty ?? null,
      pending: animation.pending,
      playState: animation.playState,
      currentTime: typeof animation.currentTime === 'number' ? animation.currentTime : null,
    }));
    return {
      fontStatus: doc.fonts.status,
      transitionState: content.getAttribute('data-transition-state'),
      activeAnimations: animations.filter(
        (animation) => animation.pending || animation.playState === 'running'
      ),
      viewport: {
        ...rect(viewport),
        clientWidth: viewport.clientWidth,
        clientHeight: viewport.clientHeight,
        scrollWidth: viewport.scrollWidth,
        scrollHeight: viewport.scrollHeight,
        scrollLeft: viewport.scrollLeft,
        scrollTop: viewport.scrollTop,
        mode: viewport.dataset.docsImageScale,
        role: viewport.getAttribute('role'),
        label: viewport.getAttribute('aria-label'),
        tabIndex: viewport.tabIndex,
        overflowX: viewportStyle.overflowX,
        overflowY: viewportStyle.overflowY,
      },
      image: {
        src: image.currentSrc,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        alt: image.alt,
        describedBy: (image.getAttribute('aria-describedby') || '')
          .split(/\s+/)
          .filter(Boolean)
          .map((id) => {
            const description = doc.getElementById(id);
            return {
              id,
              present: Boolean(description),
              text: description?.textContent?.trim() || '',
            };
          }),
        complete: image.complete,
        ...rect(image),
        scheme: imageStyle.colorScheme,
      },
      layout: {
        content: paint(content),
        canvas: paint(canvas),
        root: paint(root),
        toolbar: paint(toolbar),
        buttons: Array.from(toolbar.children, (button) => paint(button)),
      },
    };
  };

  return new Promise((resolve) => {
    let finished = false;
    let raf = null;
    let timer = null;
    let previous = null;
    let stableFrames = 0;
    let latest = null;
    const finish = (outcome, error = null) => {
      if (finished) return;
      finished = true;
      if (raf !== null) win.cancelAnimationFrame(raf);
      if (timer !== null) win.clearTimeout(timer);
      resolve({
        outcome,
        error,
        elapsedMs: win.performance.now() - startedAt,
        observation: latest,
        trace: trace(),
      });
    };
    const queue = () => {
      if (!finished) raf = win.requestAnimationFrame(sample);
    };
    const afterFonts = () => {
      Promise.resolve(doc.fonts.ready).then(queue, (error) => finish('failed', String(error)));
    };
    const sample = () => {
      raf = null;
      if (finished) return;
      try {
        latest = read();
        sampleCount++;
        const evidence = { frame: sampleCount, atMs: win.performance.now() - startedAt, ...latest };
        if (firstSamples.length < 8) firstSamples.push(evidence);
        else {
          lastSamples.push(evidence);
          if (lastSamples.length > 8) lastSamples.shift();
        }
        const ready =
          latest.fontStatus === 'loaded' &&
          latest.transitionState === 'entered' &&
          latest.activeAnimations.length === 0 &&
          latest.viewport.width > 0 &&
          latest.viewport.height > 0 &&
          latest.image.complete &&
          latest.image.width > 0 &&
          latest.image.height > 0;
        const current = JSON.stringify(latest);
        stableFrames = ready ? (current === previous ? stableFrames + 1 : 1) : 0;
        previous = current;
        if (stableFrames >= 2) finish('passed');
        else if (latest.fontStatus !== 'loaded') afterFonts();
        else queue();
      } catch (error) {
        finish('failed', String(error));
      }
    };
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      finish('failed', 'A positive finite observation timeout is required.');
      return;
    }
    timer = win.setTimeout(
      () =>
        finish('failed', 'Reading fonts, animations or geometry did not settle before timeout.'),
      timeoutMs
    );
    afterFonts();
  });
}

// This runs in Node after the PNG has been written. Failed packets and changes
// remain failures; callers retain both packets and the original PNG in metrics.
export function verifyDiagramReadingCapture(before, after) {
  const problems = [];
  for (const [name, packet] of [
    ['before', before],
    ['after', after],
  ]) {
    const observed = packet?.observation;
    if (
      packet?.outcome !== 'passed' ||
      !observed?.viewport ||
      !observed?.image ||
      !observed?.layout ||
      observed.fontStatus !== 'loaded' ||
      observed.transitionState !== 'entered' ||
      !Array.isArray(observed.activeAnimations) ||
      observed.activeAnimations.length !== 0
    )
      problems.push(name + ' lacks a successful stable reading observation.');
  }
  if (!problems.length)
    for (const field of ['viewport', 'image', 'layout'])
      if (!isDeepStrictEqual(before.observation[field], after.observation[field]))
        problems.push('Reading ' + field + ' changed while capturing the PNG.');
  return { outcome: problems.length ? 'failed' : 'passed', problems };
}
