interface ContrastPoint {
  x: number;
  y: number;
  rgb: number[];
}
interface ContrastTextRun {
  text: string;
  direct: boolean;
  color: string;
  alpha: number | null;
  fontSize: string;
  fontWeight: string;
  ratio: number | null;
  classification: string;
  threshold: number;
  limits: string[];
  basis: string;
}
interface ContrastGlyph {
  tag: string;
  fill: string;
  stroke: string;
  fillOpacity: string;
  strokeOpacity: string;
  strokeWidth: string;
  fillContrast: number | null;
  strokeContrast: number | null;
  limits: string[];
  fillLimits: string[];
  strokeLimits: string[];
  classification: string;
  basis: string;
}
interface ContrastShadow {
  raw: string;
  limitation: string;
  ink?: number[] | null;
  alpha?: number | null;
  limits?: string[];
  x?: number;
  y?: number;
  blur?: number;
  spread?: number;
  inset?: boolean;
  insetVsFill?: number | null;
  insetBasis?: string | null;
  renderedAdjacency?: string;
  receiving?: { side: string; point: ContrastPoint | null; ratio: number | null }[];
}
interface ContrastSurface {
  prototype: string | undefined;
  ref: string | null;
  role: string | null;
  inactive: boolean;
  visible: boolean;
  state: {
    checked: string | null;
    selected: string | null;
    active: string | null;
    focused: boolean;
    hovered: boolean;
    pressed: boolean;
    focusVisible: boolean;
  };
  text: string | undefined;
  style: {
    color: string;
    fill: string;
    border: string;
    borderWidth: string;
    outline: string;
    outlineWidth: string;
    outlineStyle: string;
    shadow: string;
    transform: string;
    opacity: string;
    fontSize: string;
    fontWeight: string;
  };
  paint: {
    text: number[] | null;
    textAlpha: number | null;
    fill: number[] | null;
    fillAlpha: number | null;
    border: number[] | null;
    outline: number[] | null;
    compositedBackground: number[] | null;
    limits: string[];
  };
  textRuns: ContrastTextRun[];
  glyphs: ContrastGlyph[];
  placeholder: {
    shown: boolean;
    color: string;
    opacity: string;
    ratio: number | null;
    classification: string;
    limits: string[];
    basis: string;
  } | null;
  borders: Record<
    string,
    { color: number[] | null; alpha: number | null; width: number; limits: string[] }
  >;
  shadows: ContrastShadow[];
  scroll: {
    left: number;
    top: number;
    width: number;
    height: number;
    clientWidth: number;
    clientHeight: number;
  };
  rect: { x: number; y: number; width: number; height: number };
  textContrast: { ratio: number; threshold: number; basis: string } | null;
  textContrastDisposition: { classification: string; limits: string[] };
  visibility: { classification: string; limits: string[] };
  exterior: {
    side: string;
    point: ContrastPoint | null;
    innerBorderVsBackground: number | null;
    opaqueBorderVsPixel: number | null;
    opaqueFillVsPixel: number | null;
  }[];
  cueDisposition: string;
}

export interface ContrastFrame {
  family: string;
  owner: string;
  generation: string;
  theme: string | undefined;
  devicePixelRatio: number;
  stateFingerprint: string;
  surfaces: ContrastSurface[];
}

const composedParent = (element: Element): Element | null =>
  element.assignedSlot ??
  element.parentElement ??
  (element.getRootNode() instanceof ShadowRoot ? (element.getRootNode() as ShadowRoot).host : null);

const composedChildren = (node: Node): Node[] => {
  if (node instanceof HTMLSlotElement) {
    const assigned = node.assignedNodes({ flatten: true });
    return assigned.length ? assigned : [...node.childNodes];
  }
  return [...(node instanceof Element && node.shadowRoot ? node.shadowRoot : node).childNodes];
};

const currentProjection = () => {
  const scope = document.querySelector<HTMLElement>('[data-projection-scope]');
  const owner = scope?.dataset.projectionOwner ?? scope?.dataset.projectionScope;
  const generation = scope?.dataset.projectionGeneration;
  if (!owner || !generation) throw new Error('Current projection lease missing.');
  const roots: HTMLElement[] = [];
  const visit = (root: Document | ShadowRoot) => {
    for (const element of root.querySelectorAll<HTMLElement>('*')) {
      if (
        element.matches('[data-pui-root]') &&
        element.dataset.projectionOwner === owner &&
        element.dataset.projectionGeneration === generation
      ) {
        let current: Element | null = element;
        while (current && !current.hasAttribute('data-projection-control'))
          current = composedParent(current);
        if (!current) roots.push(element);
      }
      if (element.shadowRoot) visit(element.shadowRoot);
    }
  };
  visit(document);
  const surfaces = roots.map((host) => {
    const editor = host.dataset.projectionPrototype === 'brutalist-textarea-root';
    let element: HTMLElement | null = host;
    if (editor && host.tagName !== 'TEXTAREA') {
      element = null;
      const findEditor = (node: Node) => {
        if (node instanceof HTMLTextAreaElement) element ??= node;
        for (const child of composedChildren(node)) findEditor(child);
      };
      findEditor(host);
    }
    if (!element) throw new Error('Declared Textarea has no current native editor target.');
    return { host, element };
  });
  return { scope, owner, generation, surfaces };
};

// These IDs distinguish a replacement physical node even with identical styles.
// They live only in the instrument; the subject DOM and author state are untouched.
const stateNodes = new WeakMap<Node, number>();
let nextStateNode = 1;
const stateProperties = [
  'display',
  'visibility',
  'content-visibility',
  'position',
  'color',
  '-webkit-text-fill-color',
  'background-color',
  'background-image',
  'background-clip',
  'background-blend-mode',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-top-style',
  'border-right-style',
  'border-bottom-style',
  'border-left-style',
  'border-radius',
  'outline-color',
  'outline-width',
  'outline-style',
  'outline-offset',
  'box-shadow',
  'opacity',
  'filter',
  'backdrop-filter',
  'mix-blend-mode',
  'transform',
  'translate',
  'rotate',
  'scale',
  'perspective',
  'transform-style',
  'overflow-x',
  'overflow-y',
  'clip',
  'clip-path',
  'mask-image',
  'contain',
  'z-index',
  'font-size',
  'font-weight',
  'font-family',
  'line-height',
  'text-shadow',
  'text-indent',
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-opacity',
  'stroke-width',
  'content',
] as const;

export const readContrastState = (): string => {
  const { scope, owner, generation, surfaces } = currentProjection();
  const snapshot = (node: Node): unknown => {
    if (!stateNodes.has(node)) stateNodes.set(node, nextStateNode++);
    if (!(node instanceof Element)) {
      const range = document.createRange();
      range.selectNodeContents(node);
      return {
        id: stateNodes.get(node),
        text: node.textContent,
        rects: [...range.getClientRects()].map((box) => [box.x, box.y, box.width, box.height]),
      };
    }
    const style = (pseudo?: string) => {
      const computed = getComputedStyle(node, pseudo);
      return stateProperties.map((property) => computed.getPropertyValue(property));
    };
    const rect = node.getBoundingClientRect();
    const assigned =
      node instanceof HTMLSlotElement
        ? node.assignedNodes({ flatten: true }).map((child) => {
            if (!stateNodes.has(child)) stateNodes.set(child, nextStateNode++);
            return stateNodes.get(child);
          })
        : null;
    return {
      id: stateNodes.get(node),
      tag: node.tagName,
      attributes: [...node.attributes].map(({ name, value }) => [name, value]).sort(),
      rect: [rect.x, rect.y, rect.width, rect.height],
      rects: [...node.getClientRects()].map((box) => [box.x, box.y, box.width, box.height]),
      scroll: [
        node.scrollLeft,
        node.scrollTop,
        node.scrollWidth,
        node.scrollHeight,
        node.clientWidth,
        node.clientHeight,
      ],
      value:
        node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement ? node.value : null,
      checked: node instanceof HTMLInputElement ? node.checked : null,
      styles: [
        style(),
        style('::before'),
        style('::after'),
        node.matches('input,textarea') ? style('::placeholder') : null,
      ],
      focus: [
        node.matches(':focus'),
        node.matches(':focus-visible'),
        node.matches(':hover'),
        node.matches(':active'),
      ],
      assigned,
    };
  };
  const tree = (node: Node): unknown => [snapshot(node), composedChildren(node).map(tree)];
  const ancestry = (node: Element): unknown[] => {
    const chain: unknown[] = [];
    for (let current = composedParent(node); current; current = composedParent(current))
      chain.push(snapshot(current));
    return chain;
  };
  const focus: unknown[] = [];
  for (
    let active = document.activeElement;
    active;
    active = active.shadowRoot?.activeElement ?? null
  )
    focus.push(snapshot(active));
  // Exact serialization rather than a lossy checksum: equality is the lease and
  // measured-state boundary, not a promise about unobserved sibling overlays.
  return JSON.stringify({
    owner,
    generation,
    scope: scope ? snapshot(scope) : null,
    theme: snapshot(document.documentElement),
    viewport: [innerWidth, innerHeight, devicePixelRatio, scrollX, scrollY],
    visualViewport: visualViewport
      ? [
          visualViewport.offsetLeft,
          visualViewport.offsetTop,
          visualViewport.width,
          visualViewport.height,
          visualViewport.scale,
        ]
      : null,
    focus,
    surfaces: surfaces.map(({ host, element }) => ({
      host: snapshot(host),
      target: tree(element),
      ancestry: ancestry(element),
    })),
  });
};

type SolidPaint = { rgba: number[] | null; alpha: number | null; limits: string[] };
const paint = (color: string): SolidPaint => {
  if (/url\(|context-(?:fill|stroke)/i.test(color))
    return { rgba: null, alpha: null, limits: ['unsupported-paint-server'] };
  // Only resolved sRGB syntax is admitted. No canvas alpha byte is an opacity
  // oracle, and invalid/unsupported colors never inherit a black fallback.
  const rgb = color.match(/^rgba?\(([^()]*)\)$/i);
  const srgb = color.match(/^color\(srgb\s+([^()]*)\)$/i);
  if (!rgb && !srgb)
    return { rgba: null, alpha: null, limits: ['unsupported-resolved-color-syntax'] };
  const parts = (rgb?.[1] ?? srgb![1]).trim().split(/\s*[,/]\s*|\s+/);
  if (parts.length !== 3 && parts.length !== 4)
    return { rgba: null, alpha: null, limits: ['unsupported-resolved-color-syntax'] };
  const number = (part: string, scale: number): number => {
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?%?$/i.test(part)) return NaN;
    return Number(part.replace('%', '')) * (part.endsWith('%') ? scale / 100 : 1);
  };
  const channels = parts.slice(0, 3).map((part) => number(part, rgb ? 255 : 1) * (rgb ? 1 : 255));
  const alpha = parts.length === 4 ? number(parts[3], 1) : 1;
  if (![...channels, alpha].every(Number.isFinite))
    return { rgba: null, alpha: null, limits: ['unsupported-resolved-color-syntax'] };
  const boundedAlpha = Math.max(0, Math.min(1, alpha));
  return {
    rgba: [...channels.map((value) => Math.max(0, Math.min(255, value))), boundedAlpha * 255],
    alpha: boundedAlpha,
    limits: [],
  };
};

// CSSOM keeps individual transforms separate from `transform`. Translations do
// not change the axis-aligned shape: DOMRects already include their displacement.
// Reject every other matrix rather than treating its bounding box as its edges.
const translationOnly = (style: CSSStyleDeclaration): boolean => {
  if (style.perspective !== 'none' || style.transformStyle === 'preserve-3d') return false;
  if (style.transform !== 'none') {
    if (style.transform.startsWith('matrix3d(')) return false;
    try {
      const matrix = new DOMMatrixReadOnly(style.transform);
      if (
        !matrix.is2D ||
        matrix.a !== 1 ||
        matrix.b !== 0 ||
        matrix.c !== 0 ||
        matrix.d !== 1 ||
        !Number.isFinite(matrix.e) ||
        !Number.isFinite(matrix.f)
      )
        return false;
    } catch {
      return false;
    }
  }
  if (style.translate !== 'none') {
    // Count computed components, not whitespace inside calc()/min()/max().
    // One or two lengths/percentages are necessarily a 2D translation.
    let depth = 0,
      components = 0,
      inComponent = false;
    for (const char of style.translate) {
      if (/\s/.test(char) && depth === 0) inComponent = false;
      else if (!inComponent) {
        components++;
        inComponent = true;
      }
      if (char === '(') depth++;
      if (char === ')') depth--;
    }
    if (components < 1 || components > 2) return false;
  }
  if (style.rotate !== 'none' && !/^0(?:deg|grad|rad|turn)$/.test(style.rotate)) return false;
  if (style.scale !== 'none') {
    const components = style.scale.split(/\s+/);
    if (
      components.length > 2 ||
      components.some((value) => Number(value.replace('%', '')) !== (value.endsWith('%') ? 100 : 1))
    )
      return false;
  }
  return true;
};

const paintedVisibility = (element: Element, boxes: readonly DOMRect[], clipSelf = false) => {
  const limits: string[] = [];
  const own = getComputedStyle(element);
  if (own.visibility !== 'visible')
    return {
      visible: false,
      classification: 'exempt-not-visible',
      limits: ['visibility-hidden-or-collapse'],
    };
  const nonempty = boxes.filter((box) => box.width > 0 && box.height > 0);
  if (!nonempty.length)
    return {
      visible: false,
      classification: 'exempt-not-visible',
      limits: ['no-painted-layout-box'],
    };
  let left = 0,
    top = 0,
    right = innerWidth,
    bottom = innerHeight;
  for (let current: Element | null = element; current; current = composedParent(current)) {
    const style = getComputedStyle(current);
    if (
      style.display === 'none' ||
      style.contentVisibility === 'hidden' ||
      Number(style.opacity) === 0
    ) {
      return {
        visible: false,
        classification: 'exempt-not-visible',
        limits: ['ancestor-or-target-hidden'],
      };
    }
    if (style.clip !== 'auto') limits.push('unsupported-legacy-clip');
    if (style.clipPath !== 'none' || style.maskImage !== 'none')
      limits.push('unsupported-clip-path-or-mask');
    if (!translationOnly(style)) limits.push('unsupported-transformed-paint');
    if (style.contain.includes('paint')) limits.push('unsupported-paint-containment');
    const rect = current.getBoundingClientRect();
    if ((clipSelf || current !== element) && style.overflowX !== 'visible') {
      left = Math.max(left, rect.left + current.clientLeft);
      right = Math.min(right, rect.left + current.clientLeft + current.clientWidth);
    }
    if ((clipSelf || current !== element) && style.overflowY !== 'visible') {
      top = Math.max(top, rect.top + current.clientTop);
      bottom = Math.min(bottom, rect.top + current.clientTop + current.clientHeight);
    }
  }
  // This reports intersecting bounds, not proof of painted coverage through
  // unsupported clips/masks/transforms; those remain explicit in `limits`.
  const visible = nonempty.some(
    (box) => box.right > left && box.left < right && box.bottom > top && box.top < bottom
  );
  if (!visible) limits.push('offscreen-or-fully-clipped');
  else if (
    nonempty.some(
      (box) => box.left < left || box.right > right || box.top < top || box.bottom > bottom
    )
  )
    limits.push('partially-clipped-paint');
  return {
    visible,
    classification: limits.length ? 'unsupported' : 'source-model-visible',
    limits: [...new Set(limits)],
  };
};

export const collectContrastFrame = async ({
  image,
  family,
}: {
  image: string;
  family: string;
}): Promise<ContrastFrame> => {
  const luminance = (color: readonly number[]) => {
    const linear = color.slice(0, 3).map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const contrast = (a: readonly number[], b: readonly number[]) => {
    const first = luminance(a),
      second = luminance(b);
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  };
  const screenshot = new Image();
  screenshot.src = `data:image/png;base64,${image}`;
  await screenshot.decode();
  const raster = document.createElement('canvas');
  raster.width = screenshot.naturalWidth;
  raster.height = screenshot.naturalHeight;
  const rasterContext = raster.getContext('2d', { willReadFrequently: true });
  if (!rasterContext) throw new Error('Screenshot canvas unavailable.');
  rasterContext.drawImage(screenshot, 0, 0);
  const sample = (x: number, y: number) => {
    const px = Math.floor((x * raster.width) / innerWidth),
      py = Math.floor((y * raster.height) / innerHeight);
    if (px < 0 || py < 0 || px >= raster.width || py >= raster.height) return null;
    return { x, y, rgb: [...rasterContext.getImageData(px, py, 1, 1).data].slice(0, 3) };
  };
  // No further await: this fingerprint and the facts below belong to one
  // synchronous read after image decoding. The runner compares it to pre-PNG.
  const stateFingerprint = readContrastState();
  const { owner, generation, surfaces } = currentProjection();
  const background = (element: Element): { rgba: number[] | null; limits: string[] } => {
    const chain: SolidPaint[] = [],
      limits: string[] = [];
    let opaque = false;
    let current: Element | null = element;
    while (current) {
      const style = getComputedStyle(current);
      if (style.opacity !== '1') limits.push('ancestor-or-target-opacity');
      if (style.filter !== 'none' || style.backdropFilter !== 'none')
        limits.push('filter-or-backdrop-filter');
      if (style.mixBlendMode !== 'normal') limits.push('blend-mode');
      if (current instanceof HTMLSlotElement) limits.push('unsupported-slot-background-model');
      if (!opaque) {
        if (style.backgroundImage !== 'none') limits.push('background-image');
        if (style.backgroundClip === 'text') limits.push('unsupported-background-clip-text');
        const color = paint(style.backgroundColor);
        limits.push(...color.limits);
        chain.push(color);
        opaque = color.alpha === 1;
      }
      current = composedParent(current);
    }
    if (chain.at(-1)?.alpha !== 1)
      return { rgba: null, limits: [...limits, 'no-observed-opaque-underlay'] };
    if (limits.length || chain.some((color) => !color.rgba))
      return { rgba: null, limits: [...new Set(limits)] };
    let result = chain.pop()!.rgba!;
    while (chain.length) {
      const color = chain.pop()!,
        top = color.rgba!,
        alpha = color.alpha!;
      result = [
        top[0] * alpha + result[0] * (1 - alpha),
        top[1] * alpha + result[1] * (1 - alpha),
        top[2] * alpha + result[2] * (1 - alpha),
        255,
      ];
    }
    return { rgba: result, limits };
  };
  return {
    family,
    owner,
    generation,
    theme: document.documentElement.dataset.theme,
    devicePixelRatio,
    stateFingerprint,
    surfaces: surfaces.map(({ host, element }) => {
      const style = getComputedStyle(element),
        rect = element.getBoundingClientRect();
      const text = paint(style.color),
        fill = paint(style.backgroundColor),
        border = paint(style.borderTopColor),
        outline = paint(style.outlineColor);
      // The color beneath an image is not the observed fill, and only a
      // border-box background supplies the modeled exterior fill boundary.
      // Keep these limits local to fill evidence, not independent border ink.
      if (style.backgroundImage !== 'none') fill.limits.push('background-image');
      if (style.backgroundClip !== 'border-box')
        fill.limits.push('unsupported-background-clip-perimeter');
      const backdrop = background(element);
      let inactive =
        element.hasAttribute('disabled') || host.getAttribute('aria-disabled') === 'true';
      // Only current Proto roots can supply inherited inactivity. Composed
      // traversal admits slots/shadow hosts without crossing a foreign lease.
      for (
        let ancestor = composedParent(host);
        !inactive && ancestor;
        ancestor = composedParent(ancestor)
      ) {
        const ancestorOwner =
          ancestor.getAttribute('data-projection-owner') ??
          ancestor.getAttribute('data-projection-scope');
        const ancestorGeneration = ancestor.getAttribute('data-projection-generation');
        if (
          ancestor.hasAttribute('data-projection-control') ||
          (ancestorOwner !== null && ancestorOwner !== owner) ||
          (ancestorGeneration !== null && ancestorGeneration !== generation)
        )
          break;
        if (!ancestor.hasAttribute('data-pui-root')) continue;
        if (ancestorOwner !== owner || ancestorGeneration !== generation) break;
        inactive =
          ancestor.hasAttribute('disabled') || ancestor.getAttribute('aria-disabled') === 'true';
      }
      const { visible, ...visibility } = paintedVisibility(element, [...element.getClientRects()]);
      // Visible bounds are evidence even when their paint geometry is unsupported.
      // Only fully supported, unclipped rectangles may supply perimeter metrics.
      const measurablePerimeter = visibility.classification === 'source-model-visible';
      const largeText =
        parseFloat(style.fontSize) >= 24 ||
        (parseFloat(style.fontSize) >= 18.6666666667 && parseInt(style.fontWeight) >= 700);
      const inkUnmodified = !backdrop.limits.some((limit) =>
        ['ancestor-or-target-opacity', 'filter-or-backdrop-filter', 'blend-mode'].includes(limit)
      );
      const borders: Record<
        string,
        { color: number[] | null; alpha: number | null; width: number; limits: string[] }
      > = {};
      for (const side of ['top', 'right', 'bottom', 'left']) {
        const ink = side === 'top' ? border : paint(style.getPropertyValue(`border-${side}-color`));
        borders[side] = {
          color: ink.rgba,
          alpha: ink.alpha,
          width: parseFloat(style.getPropertyValue(`border-${side}-width`)),
          limits: ink.limits,
        };
      }
      const nodes: Node[] = [];
      const visit = (node: Node) => {
        nodes.push(node);
        for (const child of composedChildren(node)) visit(child);
      };
      visit(element);
      const textRuns = nodes
        .filter((node): node is Text => node instanceof Text && Boolean(node.textContent?.trim()))
        .map((node) => {
          const parent = node.assignedSlot ?? node.parentElement!;
          const range = document.createRange();
          range.selectNodeContents(node);
          const textVisibility = paintedVisibility(parent, [...range.getClientRects()], true);
          const textStyle = getComputedStyle(parent),
            textInk = paint(textStyle.color),
            textBackdrop = background(parent);
          const limits = [...textBackdrop.limits, ...textInk.limits, ...textVisibility.limits];
          if (textInk.alpha !== 1) limits.push('unsupported-translucent-text-ink');
          if (textStyle.webkitTextFillColor !== textStyle.color)
            limits.push('unsupported-text-fill-color');
          if (textStyle.textShadow !== 'none') limits.push('unsupported-text-shadow');
          if (parent.namespaceURI === 'http://www.w3.org/2000/svg')
            limits.push('unsupported-svg-text-ink');
          if (inactive) limits.push('inactive-component');
          const large =
            parseFloat(textStyle.fontSize) >= 24 ||
            (parseFloat(textStyle.fontSize) >= 18.6666666667 &&
              parseInt(textStyle.fontWeight) >= 700);
          return {
            text: node.textContent!.trim().slice(0, 100),
            direct: parent === element,
            color: textStyle.color,
            alpha: textInk.alpha,
            fontSize: textStyle.fontSize,
            fontWeight: textStyle.fontWeight,
            ratio:
              !limits.length && textInk.rgba && textBackdrop.rgba
                ? contrast(textInk.rgba, textBackdrop.rgba)
                : null,
            classification:
              textVisibility.classification === 'exempt-not-visible' || inactive
                ? 'exempt'
                : limits.length
                  ? 'unsupported'
                  : 'source-model-only',
            threshold: large ? 3 : 4.5,
            limits,
            basis:
              'resolved sRGB ink versus composed ancestor background; sibling overlays and glyph coverage unverified',
          };
        });
      const glyphs = nodes
        .filter(
          (node): node is Element =>
            node instanceof Element &&
            node.matches('svg,path,polyline,polygon,line,circle,ellipse,rect,use')
        )
        .map((glyph) => {
          const glyphStyle = getComputedStyle(glyph);
          const glyphBackdrop = background(glyph),
            glyphRect = glyph.getBoundingClientRect();
          const fillInk =
            glyphStyle.fill === 'none'
              ? null
              : paint(
                  glyphStyle.fill.toLowerCase() === 'currentcolor'
                    ? glyphStyle.color
                    : glyphStyle.fill
                );
          const strokeInk =
            glyphStyle.stroke === 'none'
              ? null
              : paint(
                  glyphStyle.stroke.toLowerCase() === 'currentcolor'
                    ? glyphStyle.color
                    : glyphStyle.stroke
                );
          const glyphVisibility = paintedVisibility(glyph, [glyphRect]);
          const limits = [...glyphBackdrop.limits, ...glyphVisibility.limits];
          if (glyph.matches('svg,use') || glyph.closest('defs,clipPath,mask,marker,pattern'))
            limits.push('unsupported-svg-container-or-resource');
          const fillLimits = [...limits, ...(fillInk?.limits ?? [])],
            strokeLimits = [...limits, ...(strokeInk?.limits ?? [])];
          if (fillInk && (fillInk.alpha !== 1 || glyphStyle.fillOpacity !== '1'))
            fillLimits.push('unsupported-svg-fill-alpha');
          if (strokeInk && (strokeInk.alpha !== 1 || glyphStyle.strokeOpacity !== '1'))
            strokeLimits.push('unsupported-svg-stroke-alpha');
          if (inactive) {
            fillLimits.push('inactive-component');
            strokeLimits.push('inactive-component');
          }
          return {
            tag: glyph.tagName,
            fill: glyphStyle.fill,
            stroke: glyphStyle.stroke,
            fillOpacity: glyphStyle.fillOpacity,
            strokeOpacity: glyphStyle.strokeOpacity,
            strokeWidth: glyphStyle.strokeWidth,
            fillContrast:
              !fillLimits.length && fillInk?.rgba && glyphBackdrop.rgba
                ? contrast(fillInk.rgba, glyphBackdrop.rgba)
                : null,
            strokeContrast:
              !strokeLimits.length &&
              parseFloat(glyphStyle.strokeWidth) > 0 &&
              strokeInk?.rgba &&
              glyphBackdrop.rgba
                ? contrast(strokeInk.rgba, glyphBackdrop.rgba)
                : null,
            limits,
            fillLimits,
            strokeLimits,
            classification: 'non-text glyph; not a text contrast assertion',
            basis: 'source-model-only; rendered adjacency and cue necessity unverified',
          };
        });
      const nativeText =
        element instanceof HTMLTextAreaElement ||
        (element instanceof HTMLInputElement &&
          ['text', 'search', 'email', 'url', 'tel', 'password', 'number'].includes(element.type));
      const placeholderStyle = nativeText ? getComputedStyle(element, '::placeholder') : null;
      const placeholderInk = placeholderStyle ? paint(placeholderStyle.color) : null;
      const placeholderShown = Boolean(
        nativeText &&
        element.getAttribute('placeholder')?.trim() &&
        element.matches(':placeholder-shown')
      );
      const placeholderLimits = [
        ...backdrop.limits,
        ...visibility.limits,
        ...(placeholderInk?.limits ?? []),
      ];
      if (placeholderInk?.alpha !== 1 || placeholderStyle?.opacity !== '1')
        placeholderLimits.push('unsupported-placeholder-alpha');
      if (inactive) placeholderLimits.push('inactive-component');
      const placeholder = placeholderStyle
        ? {
            shown: placeholderShown,
            color: placeholderStyle.color,
            opacity: placeholderStyle.opacity,
            ratio:
              placeholderShown && !placeholderLimits.length && placeholderInk?.rgba && backdrop.rgba
                ? contrast(placeholderInk.rgba, backdrop.rgba)
                : null,
            classification: !placeholderShown
              ? 'not-painted'
              : placeholderLimits.length
                ? 'unsupported'
                : 'source-model-only',
            limits: placeholderLimits,
            basis:
              'placeholder source-model-only; native editor clipping/scroll and receiving pixels unverified',
          }
        : null;
      const nativeValue = nativeText
        ? (element as HTMLInputElement | HTMLTextAreaElement).value
        : '';
      const textLimits = [...backdrop.limits, ...visibility.limits, ...text.limits];
      if (text.alpha !== 1) textLimits.push('unsupported-translucent-text-ink');
      if (inactive) textLimits.push('inactive-component');
      if (style.webkitTextFillColor !== style.color) textLimits.push('unsupported-text-fill-color');
      if (style.textShadow !== 'none') textLimits.push('unsupported-text-shadow');
      if (
        nativeText &&
        (element.scrollLeft || element.scrollTop || parseFloat(style.textIndent) !== 0)
      )
        textLimits.push('unsupported-native-text-scroll-or-indent');
      const directRun = textRuns.find((run) => run.direct && run.ratio !== null);
      const actualText = nativeText ? Boolean(nativeValue.trim()) : Boolean(directRun);
      if (!actualText)
        textLimits.push(nativeText ? 'no-painted-native-value' : 'no-verified-direct-painted-text');
      const textContrast =
        actualText && !textLimits.length && text.rgba && backdrop.rgba
          ? {
              ratio: nativeText ? contrast(text.rgba, backdrop.rgba) : directRun!.ratio!,
              threshold: largeText ? 3 : 4.5,
              basis: nativeText
                ? 'native-value source-model-only; receiving pixels unverified'
                : 'verified direct-text source-model-only; receiving pixels unverified',
            }
          : null;
      const exterior = measurablePerimeter
        ? [0.25, 0.5, 0.75].flatMap((fraction) => [
            { side: 'top', point: sample(rect.x + rect.width * fraction, rect.y - 1) },
            { side: 'left', point: sample(rect.x - 1, rect.y + rect.height * fraction) },
            { side: 'bottom', point: sample(rect.x + rect.width * fraction, rect.bottom + 1) },
            { side: 'right', point: sample(rect.right + 1, rect.y + rect.height * fraction) },
          ])
        : [];
      const shadowParts: string[] = [];
      let depth = 0,
        start = 0;
      for (let index = 0; index < style.boxShadow.length; index++) {
        const char = style.boxShadow[index];
        if (char === '(') depth++;
        if (char === ')') depth--;
        if (char === ',' && depth === 0) {
          shadowParts.push(style.boxShadow.slice(start, index).trim());
          start = index + 1;
        }
      }
      if (style.boxShadow !== 'none') shadowParts.push(style.boxShadow.slice(start).trim());
      const shadows = shadowParts.map((raw) => {
        const matched = raw.match(
          /^(.+?)\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px(?:\s+(inset))?$/
        );
        if (!matched)
          return {
            raw,
            limitation: 'Unsupported computed shadow serialization; no ratio invented.',
          };
        const ink = paint(matched[1]);
        const x = Number(matched[2]),
          y = Number(matched[3]),
          blur = Number(matched[4]),
          spread = Number(matched[5]),
          inset = Boolean(matched[6]);
        const hardOpaque = measurablePerimeter && inkUnmodified && ink.alpha === 1 && blur === 0;
        const receiving =
          !inset && hardOpaque
            ? [
                {
                  side: 'right',
                  point: sample(
                    rect.right + Math.max(0, x + spread) + 1,
                    rect.y + rect.height / 2 + y
                  ),
                },
                {
                  side: 'bottom',
                  point: sample(
                    rect.x + rect.width / 2 + x,
                    rect.bottom + Math.max(0, y + spread) + 1
                  ),
                },
              ]
            : [];
        return {
          raw,
          ink: ink.rgba,
          alpha: ink.alpha,
          limits: [...ink.limits, ...visibility.limits],
          x,
          y,
          blur,
          spread,
          inset,
          insetVsFill:
            inset && hardOpaque && ink.rgba && backdrop.rgba
              ? contrast(ink.rgba, backdrop.rgba)
              : null,
          insetBasis: inset ? 'source-model-only' : null,
          renderedAdjacency: 'unresolved',
          receiving: receiving.map(({ side, point }) => ({
            side,
            point,
            ratio: point && ink.rgba ? contrast(ink.rgba, point.rgb) : null,
          })),
          limitation: inset
            ? 'Inset CSS ink versus ancestor-background source model only; no receiving pixels measured. Child paint may adjoin the ring; rendered adjacency, visibility and cue necessity remain unresolved.'
            : hardOpaque
              ? 'CSS ink versus recorded receiving pixel; signed/layered geometry, shadow visibility and cue necessity remain unresolved.'
              : 'Alpha, unsupported color/geometry, clipping, blur, opacity/filter/blend or hidden shadow; no opaque-shadow metric.',
        };
      });
      return {
        prototype: host.dataset.projectionPrototype,
        ref: host.dataset.demoRef ?? null,
        role: host.getAttribute('role'),
        inactive,
        visible,
        state: {
          checked: host.getAttribute('aria-checked'),
          selected: host.getAttribute('aria-selected'),
          active: host.getAttribute('aria-pressed'),
          focused: element.matches(':focus') || host.matches(':focus'),
          hovered: element.matches(':hover') || host.matches(':hover'),
          pressed: element.matches(':active') || host.matches(':active'),
          focusVisible:
            host.hasAttribute('data-focus-visible') || element.matches(':focus-visible'),
        },
        text:
          element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement
            ? element.value
            : element.textContent?.trim().slice(0, 180),
        style: {
          color: style.color,
          fill: style.backgroundColor,
          border: style.borderTopColor,
          borderWidth: style.borderTopWidth,
          outline: style.outlineColor,
          outlineWidth: style.outlineWidth,
          outlineStyle: style.outlineStyle,
          shadow: style.boxShadow,
          transform: style.transform,
          opacity: style.opacity,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
        },
        paint: {
          text: text.rgba,
          textAlpha: text.alpha,
          fill: fill.rgba,
          fillAlpha: fill.alpha,
          border: border.rgba,
          outline: outline.rgba,
          compositedBackground: backdrop.rgba,
          limits: [
            ...backdrop.limits,
            ...text.limits,
            ...fill.limits,
            ...border.limits,
            ...outline.limits,
          ],
        },
        textRuns,
        glyphs,
        placeholder,
        borders,
        shadows,
        scroll: {
          left: element.scrollLeft,
          top: element.scrollTop,
          width: element.scrollWidth,
          height: element.scrollHeight,
          clientWidth: element.clientWidth,
          clientHeight: element.clientHeight,
        },
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        textContrast,
        textContrastDisposition: {
          classification: textContrast
            ? 'source-model-only'
            : visibility.classification === 'exempt-not-visible' || inactive
              ? 'exempt'
              : 'unsupported',
          limits: textLimits,
        },
        visibility,
        exterior: exterior.map(({ side, point }) => ({
          side,
          point,
          innerBorderVsBackground:
            !inactive &&
            inkUnmodified &&
            borders[side].alpha === 1 &&
            borders[side].color &&
            borders[side].width > 0 &&
            backdrop.rgba
              ? contrast(borders[side].color, backdrop.rgba)
              : null,
          opaqueBorderVsPixel:
            !inactive &&
            inkUnmodified &&
            borders[side].alpha === 1 &&
            borders[side].color &&
            borders[side].width > 0 &&
            point
              ? contrast(borders[side].color, point.rgb)
              : null,
          opaqueFillVsPixel:
            !inactive &&
            inkUnmodified &&
            !fill.limits.length &&
            fill.alpha === 1 &&
            fill.rgba &&
            point
              ? contrast(fill.rgba, point.rgb)
              : null,
        })),
        cueDisposition:
          'unclassified observation; numerical edge alone is not a component/state conformance verdict',
      };
    }),
  };
};
