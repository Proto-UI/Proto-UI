// Native drag coordinates come from rendered text, not a multiline block's
// centerline. Range is read only: the browser mouse remains the selection owner.
export function measureLabelTextDrag(element: HTMLElement) {
  const doc = element.ownerDocument;
  const win = doc.defaultView!;
  const bounds = element.getBoundingClientRect();
  const walker = doc.createTreeWalker(element, win.NodeFilter.SHOW_ALL);
  const rects: Array<{ x: number; y: number; width: number; height: number }> = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType !== win.Node.TEXT_NODE || !node.textContent?.trim()) continue;
    const range = doc.createRange();
    range.selectNodeContents(node);
    for (const rect of Array.from(range.getClientRects())) {
      if (rect.width > 4 && rect.height > 0)
        rects.push({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
    }
  }
  const line = rects.find(
    (rect) =>
      rect.x >= 0 &&
      rect.y >= 0 &&
      rect.x + rect.width <= win.innerWidth &&
      rect.y + rect.height <= win.innerHeight
  );
  if (!line) throw new Error('Copyable text must have a visible rendered text line.');
  return {
    bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
    rects,
    start: { x: line.x + 2, y: line.y + line.height / 2 },
    end: { x: line.x + Math.min(line.width - 2, 350), y: line.y + line.height / 2 },
  };
}

// Serialized read-only native-browser diagnostic. Never creates a Selection,
// changes styles, cancels input, or chooses replacement drag coordinates.
export function observeLabelDescriptionSelection(
  element: HTMLElement,
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
    start?: { x: number; y: number };
    end?: { x: number; y: number };
  }
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
    start: inspect.point(
      bounds.start?.x ?? bounds.x + 2,
      bounds.start?.y ?? bounds.y + bounds.height / 2
    ),
    end: inspect.point(
      bounds.end?.x ?? bounds.x + Math.min(bounds.width - 2, 350),
      bounds.end?.y ?? bounds.y + bounds.height / 2
    ),
    rects,
    ancestors,
    selectedLength: selection?.toString().length ?? 0,
    selected: selection?.toString() ?? '',
    anchorWithin: !!selection?.anchorNode && element.contains(selection.anchorNode),
    focusWithin: !!selection?.focusNode && element.contains(selection.focusNode),
    anchor: inspect.identify(selection?.anchorNode?.parentElement ?? null),
    focus: inspect.identify(selection?.focusNode?.parentElement ?? null),
    active: inspect.identify(doc.activeElement),
  };
}

// A disposable, read-only observer for the real pointer journey. It neither
// cancels defaults nor writes Selection, focus, styles or component state.
export function recordLabelPointerTrace(element: HTMLElement) {
  const doc = element.ownerDocument;
  const events: unknown[] = [];
  const types = [
    'pointerdown',
    'mousedown',
    'pointermove',
    'pointerup',
    'mouseup',
    'click',
    'selectstart',
    'selectionchange',
  ];
  const listener = {
    record(event: Event) {
      if (events.length >= 96) events.shift();
      const pointer = event as MouseEvent;
      events.push({
        type: event.type,
        trusted: event.isTrusted,
        defaultPrevented: event.defaultPrevented,
        x: pointer.clientX ?? null,
        y: pointer.clientY ?? null,
        target: (event.target as Element)?.getAttribute?.('data-demo-ref') ?? null,
        selected: doc.defaultView!.getSelection()?.toString() ?? '',
      });
    },
  };
  for (const type of types) doc.addEventListener(type, listener.record, { passive: true });
  return {
    finish() {
      for (const type of types) doc.removeEventListener(type, listener.record);
      return events;
    },
  };
}
