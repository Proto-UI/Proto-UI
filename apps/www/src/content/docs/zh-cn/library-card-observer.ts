// Preserved from the overview suite retired by 19da903839. The live Liquid
// Card candidate uses this self-contained browser observer for geometry and
// readability evidence; this helper does not restore the retired page or gate.
export function readCards(observe = false) {
  const read = () => {
    const gallery = document
      .querySelector<HTMLElement>('.library-gallery')!
      .getBoundingClientRect();
    const measure = (owner: HTMLElement, leaf: HTMLElement = owner) => {
      const rect = owner.getBoundingClientRect();
      const css = getComputedStyle(leaf);
      let effectiveOpacity = 1;
      for (let node: HTMLElement | null = leaf; node; node = node.parentElement)
        effectiveOpacity *= Number(getComputedStyle(node).opacity);
      return {
        x: rect.x - gallery.x,
        y: rect.y - gallery.y,
        width: rect.width,
        height: rect.height,
        fontFamily: css.fontFamily,
        fontSize: css.fontSize,
        fontWeight: css.fontWeight,
        lineHeight: css.lineHeight,
        letterSpacing: css.letterSpacing,
        color: css.color,
        opacity: css.opacity,
        effectiveOpacity,
        visibility: css.visibility,
        display: css.display,
        border: css.border,
        radius: css.borderRadius,
        shadow: css.boxShadow,
        fill: css.backgroundColor,
        overflow: owner.scrollWidth - owner.clientWidth,
      };
    };
    return [...document.querySelectorAll<HTMLElement>('[data-library]')].map((card) => {
      const surface = card.querySelector<HTMLElement>('.library-card__surface')!;
      const title = card.querySelector<HTMLElement>('h2')!;
      const titleText = title.querySelector<HTMLElement>('[data-library-part]')!;
      const body = card.querySelector<HTMLElement>('.library-card__content p')!;
      const action = card.querySelector<HTMLElement>('[data-library-action]')!;
      return {
        family: card.dataset.library,
        root: measure(surface),
        title: measure(title, titleText),
        titleLeaf: measure(titleText),
        body: measure(body, body.querySelector<HTMLElement>('[data-library-part]')!),
        action: measure(action, action.querySelector<HTMLElement>('[data-library-part$="text"]')!),
        actionSurface: measure(action.querySelector<HTMLElement>('.library-card__action')!),
        textLeaves: [...card.querySelectorAll<HTMLElement>('[data-library-part$="-text"]')].map(
          (leaf) => measure(leaf)
        ),
        tokens: surface.getAttribute('data-pui-style'),
        anchors: [...card.querySelectorAll('a')].map((a) => ({
          href: a.getAttribute('href'),
          label: a.textContent?.trim(),
        })),
      };
    });
  };
  if (observe) {
    const state = { running: true, frames: [] as ReturnType<typeof read>[] };
    (window as typeof window & { __libraryFrames?: typeof state }).__libraryFrames = state;
    let previous = '';
    const frame = () => {
      if (!state.running) return;
      const value = read();
      const serialized = JSON.stringify(value);
      if (serialized !== previous) {
        state.frames.push(value);
        (
          window as typeof window & {
            __libraryFontTrace?: { record: (label: string) => void };
          }
        ).__libraryFontTrace?.record('frame.changed');
        previous = serialized;
      }
      requestAnimationFrame(frame);
    };
    frame();
  }
  return read();
}
