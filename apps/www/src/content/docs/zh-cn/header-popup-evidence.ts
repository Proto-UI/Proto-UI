/** Read-only capture predicates, serialized into the actual browser page. */
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
