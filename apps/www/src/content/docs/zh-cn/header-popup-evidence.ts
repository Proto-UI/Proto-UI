/** Read-only capture predicates, serialized into the actual browser page. */
export function headerPreferencePaintSettled(element: Element): boolean {
  if (!element.isConnected || element.closest('[hidden], [inert]')) return false;
  const panel = element.closest('[data-site-header-panel]');
  const phase = panel?.closest('[data-site-header]')?.getAttribute('data-site-menu-transition');
  if (phase && phase !== 'entered') return false;
  const animations = element.getAnimations({ subtree: true });
  // The compact panel moves the Select even when that Select has no own
  // animation. Inspect only actual ancestors, not unrelated animated siblings.
  for (let parent = element.parentElement; parent; parent = parent.parentElement)
    animations.push(...parent.getAnimations());
  return animations.every(
    (animation) => animation.playState === 'finished' || animation.playState === 'idle'
  );
}

export function headerPopupSettled(element: Element): boolean {
  if (element.getAttribute('data-transition-state') !== 'entered') return false;
  for (let parent: Element | null = element; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      Number(style.opacity || '1') < 1
    )
      return false;
  }
  return element
    .getAnimations({ subtree: true })
    .every((animation) => animation.playState === 'finished' || animation.playState === 'idle');
}

export function readHeaderPopupPaint(element: Element) {
  let paintElement = element;
  if (element.getAttribute('data-projection-prototype') === 'shadcn-select-content') {
    const surfaces = [
      ...element.querySelectorAll('[data-projection-prototype="shadcn-select-surface"]'),
    ].filter((surface) => surface.closest('[role="listbox"]') === element);
    const surface = surfaces[0];
    const owner = element.getAttribute('data-projection-owner');
    const generation = element.getAttribute('data-projection-generation');
    if (
      !owner ||
      !generation ||
      surfaces.length !== 1 ||
      !surface ||
      surface.getAttribute('data-projection-owner') !== owner ||
      surface.getAttribute('data-projection-generation') !== generation
    )
      throw new Error('Expected one current Shadcn Select Surface for Header popup paint');
    paintElement = surface;
  }
  const style = getComputedStyle(paintElement);
  const options = [...element.querySelectorAll<HTMLElement>('[role="option"]')].filter(
    (option) => option.getAttribute('aria-disabled') !== 'true'
  );
  const colorValues = [
    style.backgroundColor,
    ...options.flatMap((option) => {
      const paint = getComputedStyle(option);
      return [paint.color, paint.backgroundColor];
    }),
  ];
  const colors = colorValues.map((color) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d')!;
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    return [...context.getImageData(0, 0, 1, 1).data];
  });
  return {
    state: element.getAttribute('data-transition-state'),
    opacity: Number(style.opacity),
    background: style.backgroundColor,
    backgroundRgba: colors[0],
    shadow: style.boxShadow,
    tokens: paintElement.getAttribute('data-pui-style'),
    paintOwner: {
      prototype: paintElement.getAttribute('data-projection-prototype'),
      owner: paintElement.getAttribute('data-projection-owner'),
      generation: paintElement.getAttribute('data-projection-generation'),
    },
    animations: element.getAnimations({ subtree: true }).map((animation) => ({
      state: animation.playState,
      time: animation.currentTime,
    })),
    options: options.map((option, index) => ({
      text: option.textContent?.trim(),
      color: colorValues[1 + index * 2],
      background: colorValues[2 + index * 2],
      colorRgba: colors[1 + index * 2],
      backgroundRgba: colors[2 + index * 2],
      opacity: Number(getComputedStyle(option).opacity),
    })),
  };
}

/** Actual text fragments and horizontal clipping ancestors, without scrolling or restyling. */
export function readHeaderPopupTextGeometry(element: Element) {
  return [...element.querySelectorAll<HTMLElement>('[role="option"]')]
    .filter((option) => option.closest('[role="listbox"]') === element)
    .map((option) => {
      const runs = [];
      const walker = document.createTreeWalker(option, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.nodeValue ?? '';
        if (!text.trim()) continue;
        const words = [];
        for (const match of text.matchAll(/\S+/gu)) {
          const range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          words.push({
            text: match[0],
            rects: [...range.getClientRects()].map((rect) => rect.toJSON()),
          });
        }
        const ancestors = [];
        for (let parent = node.parentElement; parent; parent = parent.parentElement) {
          if (!(parent instanceof HTMLElement)) continue;
          const css = getComputedStyle(parent);
          const rect = parent.getBoundingClientRect();
          const scale = parent.offsetWidth ? rect.width / parent.offsetWidth : 1;
          const left = rect.left + parent.clientLeft * scale;
          ancestors.push({
            tag: parent.localName,
            role: parent.getAttribute('role'),
            prototype: parent.getAttribute('data-projection-prototype'),
            whiteSpace: css.whiteSpace,
            overflowWrap: css.overflowWrap,
            overflowX: css.overflowX,
            clipsX:
              ['hidden', 'clip', 'auto', 'scroll'].includes(css.overflowX) ||
              /\b(paint|strict|content)\b/.test(css.contain),
            rect: rect.toJSON(),
            clientWidth: parent.clientWidth,
            scrollWidth: parent.scrollWidth,
            offsetWidth: parent.offsetWidth,
            clipLeft: left,
            clipRight: left + parent.clientWidth * scale,
          });
        }
        runs.push({ text, words, ancestors });
      }
      return {
        text: option.textContent?.trim() ?? '',
        rect: option.getBoundingClientRect().toJSON(),
        clientWidth: option.clientWidth,
        scrollWidth: option.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        runs,
      };
    });
}

/** Horizontal visibility only: a popup may legitimately scroll its rows vertically. */
export function headerOptionTextClipping(
  option: ReturnType<typeof readHeaderPopupTextGeometry>[number]
): string[] {
  const failures: string[] = [];
  // The existing Header geometry tolerance is one CSS pixel, including rounded clientWidth.
  const tolerance = 1;
  if (!option.runs.length) failures.push('option has no measured text');
  for (const run of option.runs) {
    const clips = [
      { tag: 'viewport', clipLeft: 0, clipRight: option.viewportWidth },
      ...run.ancestors.filter((ancestor) => ancestor.clipsX),
    ];
    for (const clip of clips) {
      if (
        !Number.isFinite(clip.clipLeft) ||
        !Number.isFinite(clip.clipRight) ||
        clip.clipRight <= clip.clipLeft
      )
        failures.push(`${clip.tag}: invalid horizontal clip bounds`);
    }
    if (!run.words.length) failures.push('text run has no measured words');
    for (const word of run.words) {
      if (!word.rects.length) failures.push(`${word.text}: no text fragments`);
      for (const rect of word.rects) {
        if (
          ![rect.left, rect.right, rect.width, rect.height].every(Number.isFinite) ||
          rect.width <= 0 ||
          rect.height <= 0
        ) {
          failures.push(`${word.text}: invalid text fragment`);
          continue;
        }
        for (const clip of clips) {
          if (rect.left < clip.clipLeft - tolerance || rect.right > clip.clipRight + tolerance)
            failures.push(`${word.text}: text exceeds ${clip.tag} horizontal clip`);
        }
      }
    }
  }
  return failures;
}

/** Opaque foreground over a measured popup/option background; WCAG relative luminance. */
export function popupOptionContrast(
  foreground: readonly number[],
  background: readonly number[],
  popup: readonly number[]
): number {
  const alpha = background[3] / 255;
  const rgb = background.slice(0, 3).map((channel, i) => channel * alpha + popup[i] * (1 - alpha));
  const luminance = (color: readonly number[]) =>
    color
      .slice(0, 3)
      .map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      })
      .reduce((sum, channel, i) => sum + channel * [0.2126, 0.7152, 0.0722][i], 0);
  const a = luminance(foreground),
    b = luminance(rgb);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
