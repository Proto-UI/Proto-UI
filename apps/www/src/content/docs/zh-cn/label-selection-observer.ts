// Serialized read-only native-browser diagnostic. Never creates a Selection,
// changes styles, cancels input, or chooses replacement drag coordinates.
export function observeLabelDescriptionSelection(
  element: HTMLElement,
  bounds: { x: number; y: number; width: number; height: number }
) {
  const doc = element.ownerDocument;
  const win = doc.defaultView!;
  const inspect = {
    identify(node: Element | null) {
      return node
        ? {
            tag: node.tagName,
            ref: node.getAttribute('data-demo-ref'),
            prototype: node.getAttribute('data-projection-prototype'),
          }
        : null;
    },
    point(x: number, y: number) {
      return { x, y, hit: inspect.identify(doc.elementFromPoint(x, y)) };
    },
  };
  const range = doc.createRange();
  range.selectNodeContents(element);
  const rects = Array.from(range.getClientRects())
    .slice(0, 12)
    .map((rect) => ({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    }));
  const ancestors = [];
  for (
    let node: Element | null = element;
    node && ancestors.length < 12;
    node = node.parentElement
  ) {
    const style = win.getComputedStyle(node);
    ancestors.push({
      ...inspect.identify(node),
      userSelect: style.userSelect,
      pointerEvents: style.pointerEvents,
      lineHeight: style.lineHeight,
      fontSize: style.fontSize,
      display: style.display,
    });
  }
  const selection = win.getSelection();
  return {
    bounds,
    start: inspect.point(bounds.x + 2, bounds.y + bounds.height / 2),
    end: inspect.point(bounds.x + Math.min(bounds.width - 2, 350), bounds.y + bounds.height / 2),
    rects,
    ancestors,
    selectedLength: selection?.toString().length ?? 0,
    anchor: inspect.identify(selection?.anchorNode?.parentElement ?? null),
    focus: inspect.identify(selection?.focusNode?.parentElement ?? null),
    active: inspect.identify(doc.activeElement),
  };
}
