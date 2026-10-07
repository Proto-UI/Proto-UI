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
    { color: number[] | null; alpha: number | null; width: number; style: string; limits: string[] }
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
  perimeterLimits: string[];
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

const currentProjection = (scope: HTMLElement | null) => {
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
  '-webkit-text-stroke-width',
  '-webkit-text-stroke-color',
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
  'border-image-source',
  'border-image-slice',
  'border-image-width',
  'border-image-outset',
  'border-image-repeat',
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
  'zoom',
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

const readContrastStateInScope = (scope: HTMLElement | null): string => {
  const { owner, generation, surfaces } = currentProjection(scope);
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

// Legacy instrument entry: calibration pages deliberately have no Previewer.
// The production runner uses the separate required-subject entry below.
export const readContrastState = (): string =>
  readContrastStateInScope(document.querySelector<HTMLElement>('[data-projection-scope]'));

export const readSubjectContrastState = (subject: ContrastAuditSubject): string =>
  readContrastStateInScope(requireContrastAuditSubject(subject).scope);

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
  const roundedOverflowClips: {
    prototype: string | null;
    owner: string | null;
    generation: string | null;
    radii: string[];
    overflowX: string;
    overflowY: string;
    fixedPx: boolean;
    safeInteriorOverlap: boolean;
    whollyInsideSafeRect: boolean;
    boxCount: number;
    safeRect: { left: number; right: number; top: number; bottom: number } | null;
  }[] = [];
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
    // Filters can change or erase painted pixels without changing CSS opacity
    // or layout bounds. Their output is neither known visible nor known hidden.
    if (style.filter !== 'none' || style.backdropFilter !== 'none')
      limits.push('unsupported-filter-or-backdrop-filter');
    if (style.clip !== 'auto') limits.push('unsupported-legacy-clip');
    if (style.clipPath !== 'none' || style.maskImage !== 'none')
      limits.push('unsupported-clip-path-or-mask');
    if (!translationOnly(style)) limits.push('unsupported-transformed-paint');
    if (style.contain.includes('paint')) limits.push('unsupported-paint-containment');
    const rect = current.getBoundingClientRect();
    // Admit only a small proof domain: fixed-px rounded clipping cannot affect
    // a whole box inside the central inscribed rectangle. Other curved clips
    // remain unknown; intersecting client bounds are not proof of painted ink.
    const cornerRadii = [
      style.borderTopLeftRadius,
      style.borderTopRightRadius,
      style.borderBottomRightRadius,
      style.borderBottomLeftRadius,
    ];
    if (
      (clipSelf || current !== element) &&
      (style.overflowX !== 'visible' || style.overflowY !== 'visible') &&
      cornerRadii.some(
        (radius) => radius && radius.split(/\s+/).some((axis) => parseFloat(axis) !== 0)
      )
    ) {
      const fixed = cornerRadii.map((radius) => {
        if (!/^(?:\d+(?:\.\d+)?|\.\d+)px(?:\s+(?:\d+(?:\.\d+)?|\.\d+)px)?$/.test(radius))
          return null;
        const axes = radius.split(/\s+/).map(parseFloat);
        return [axes[0], axes[1] ?? axes[0]];
      });
      let safelyInside = false;
      let safeInteriorOverlap = false;
      let safeRect: { left: number; right: number; top: number; bottom: number } | null = null;
      const fixedPx = fixed.every((radius) => radius !== null) && translationOnly(style);
      if (fixedPx) {
        const radiusX = Math.max(...fixed.map((radius) => radius![0]));
        const radiusY = Math.max(...fixed.map((radius) => radius![1]));
        const safeLeft = Math.max(rect.left + current.clientLeft, rect.left + radiusX);
        const safeRight = Math.min(
          rect.left + current.clientLeft + current.clientWidth,
          rect.right - radiusX
        );
        const safeTop = Math.max(rect.top + current.clientTop, rect.top + radiusY);
        const safeBottom = Math.min(
          rect.top + current.clientTop + current.clientHeight,
          rect.bottom - radiusY
        );
        safelyInside = nonempty.every(
          (box) =>
            box.left >= safeLeft &&
            box.right <= safeRight &&
            box.top >= safeTop &&
            box.bottom <= safeBottom
        );
        safeRect = { left: safeLeft, right: safeRight, top: safeTop, bottom: safeBottom };
        safeInteriorOverlap = nonempty.every(
          (box) =>
            Math.min(box.right, safeRight) > Math.max(box.left, safeLeft) &&
            Math.min(box.bottom, safeBottom) > Math.max(box.top, safeTop)
        );
      }
      roundedOverflowClips.push({
        prototype: current.getAttribute('data-projection-prototype'),
        owner: current.getAttribute('data-projection-owner'),
        generation: current.getAttribute('data-projection-generation'),
        radii: cornerRadii,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        fixedPx,
        safeInteriorOverlap,
        whollyInsideSafeRect: safelyInside,
        boxCount: nonempty.length,
        safeRect,
      });
      if (!safelyInside) limits.push('unsupported-rounded-overflow-clip');
    }
    // A non-unit zoom anywhere in the chain invalidates the fixed-CSS-pixel
    // proof above; do not reinterpret transformed physical lengths as radii.
    if (style.zoom && style.zoom !== 'normal' && Number(style.zoom) !== 1)
      limits.push('unsupported-zoomed-paint');
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
  // unsupported filters/clips/masks/transforms; those remain explicit in `limits`.
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
    ...(roundedOverflowClips.length ? { roundedOverflowClips } : {}),
  };
};

// Shared with every runner target: Playwright visibility alone admits
// opacity-zero and fully clipped boxes. This observes the same paint limits as
// the captured frame and never mutates the subject.
export const readContrastPaintedVisibility = (element: Element) =>
  paintedVisibility(element, [...element.getClientRects()]);

// The runner and instrument calibration consume this exact browser function.
// Supported bounds/opacity/clipping are required in addition to native state;
// this is a source-model observation, not proof against arbitrary occlusion.
export const readContrastTargetObservation = (element: Element) => {
  const visibility = readContrastPaintedVisibility(element);
  return {
    achieved: visibility.visible && visibility.classification === 'source-model-visible',
    visibility,
    prototype: element.getAttribute('data-projection-prototype'),
    text: element.textContent,
    focused: document.activeElement === element,
    focusVisible: element.matches(':focus-visible'),
    hovered: element.matches(':hover'),
    nativeActive: element.matches(':active'),
    ariaPressed: element.getAttribute('aria-pressed'),
    ariaSelected: element.getAttribute('aria-selected'),
    ariaChecked: element.getAttribute('aria-checked'),
    ariaExpanded: element.getAttribute('aria-expanded'),
    shadow: getComputedStyle(element).boxShadow,
  };
};

export interface ContrastProjectionExpectation {
  recipeId: string;
  contentRecipeId: string;
  shellPrototypeId: string;
  serializedRuntimes: string;
  family: string;
  runtime: string;
  rootPrototypeId: string;
  prototypeIds: readonly string[];
}

// Private audit-only resolver. Every production reader revalidates the exact
// requested identity and both ownership boundaries at its own observation time.
// DOM references stay in this browser probe; only observation is serialized.
export const readContrastProjectionBoundary = (
  previewer: HTMLElement,
  expected: ContrastProjectionExpectation
) => {
  const scopes = previewer.querySelectorAll<HTMLElement>('[data-projection-scope]');
  const scope = scopes.length === 1 ? scopes[0] : null;
  const contents = scope?.querySelectorAll<HTMLElement>('[data-projection-content]');
  const content = contents?.length === 1 ? contents[0] : null;
  const owner = scope?.dataset.projectionOwner ?? scope?.dataset.projectionScope;
  const generation = scope?.dataset.projectionGeneration;
  // The RuntimeBox shell is a separate one-Prototype owner. Its reserved
  // DOM boundary is already used by the website browser readiness helper;
  // it must never become an extra allowed Prototype in the authored recipe.
  const shells = content?.querySelectorAll<HTMLElement>(
    '[data-demo-ref="__website_runtime_preview_surface__"]'
  );
  const shell = shells?.length === 1 ? shells[0] : null;
  const mounts = content?.querySelectorAll<HTMLElement>(
    '[data-demo-ref="__website_runtime_preview_surface__-mount"]'
  );
  const mount = mounts?.length === 1 ? mounts[0] : null;
  const retainedContents = content?.querySelectorAll<HTMLElement>(
    '[data-demo-ref="__website_runtime_preview_surface__-content"]'
  );
  const retained = retainedContents?.length === 1 ? retainedContents[0] : null;
  const slots = shell?.querySelectorAll<HTMLElement>('[data-passive-shell-slot]');
  const slot = slots?.length === 1 ? slots[0] : null;
  const host = mount?.childElementCount === 1 ? mount.firstElementChild : null;
  const coordinatesMatch = [mount, retained].every(
    (element) =>
      !!element &&
      element.dataset.projectionOwner === owner &&
      element.dataset.projectionGeneration === generation &&
      element.dataset.projectionFamily === 'brutalist' &&
      element.dataset.projectionRuntime === expected.runtime
  );
  const shellGeneration = shell?.dataset.projectionGeneration ?? null;
  const shellBoundary = !!(
    shell &&
    shell.isConnected &&
    shell.classList.contains('pui-runtime-preview-surface') &&
    shell.hasAttribute('data-pui-root') &&
    !shell.hasAttribute('data-projection-owner') &&
    shell.dataset.projectionPrototype === expected.shellPrototypeId &&
    shell.dataset.projectionFamily === 'brutalist' &&
    shell.dataset.projectionRuntime === expected.runtime &&
    shellGeneration &&
    /^[1-9]\d*$/.test(shellGeneration) &&
    mount?.hasAttribute('data-passive-shell-mount') &&
    coordinatesMatch &&
    host &&
    !host.hasAttribute('hidden') &&
    host.contains(shell) &&
    slot &&
    slot.closest('[data-pui-root]') === shell &&
    retained?.parentElement === slot
  );
  const allRoots = [...(content?.querySelectorAll<HTMLElement>('[data-pui-root]') ?? [])];
  const roots = [...(retained?.querySelectorAll<HTMLElement>('[data-pui-root]') ?? [])];
  const misplacedRoots = allRoots.filter((root) => root !== shell && !roots.includes(root));
  const invalidRoots = roots.filter(
    (root) =>
      root.dataset.projectionOwner !== owner ||
      root.dataset.projectionGeneration !== generation ||
      !expected.prototypeIds.includes(root.dataset.projectionPrototype ?? '')
  );
  const rootPresent = roots.some(
    (root) => root.dataset.projectionPrototype === expected.rootPrototypeId
  );
  const observation = {
    achieved: !!(
      owner &&
      generation &&
      previewer.getAttribute('data-demo-id') === expected.recipeId &&
      previewer.getAttribute('data-runtimes') === expected.serializedRuntimes &&
      previewer.dataset.projectionComponent === expected.family &&
      previewer.dataset.projectionFamily === 'brutalist' &&
      previewer.dataset.projectionState === 'ready' &&
      previewer.dataset.projectionRuntime === expected.runtime &&
      scope?.dataset.projectionState === 'ready' &&
      scope.dataset.projectionFamily === 'brutalist' &&
      scope.dataset.projectionRuntime === expected.runtime &&
      content?.dataset.projectionOwner === owner &&
      content.dataset.projectionGeneration === generation &&
      content.dataset.projectionFamily === 'brutalist' &&
      content.dataset.projectionRuntime === expected.runtime &&
      content.dataset.projectionId === expected.contentRecipeId &&
      content.dataset.projectionPrototype === expected.rootPrototypeId &&
      !content.hasAttribute('data-pui-root') &&
      shellBoundary &&
      !misplacedRoots.length &&
      rootPresent &&
      !invalidRoots.length
    ),
    owner: owner ?? null,
    generation: generation ?? null,
    shellGeneration,
    expected,
    observed: {
      recipeId: previewer.getAttribute('data-demo-id'),
      serializedRuntimes: previewer.getAttribute('data-runtimes'),
      scopeCount: scopes.length,
      contentCount: contents?.length ?? 0,
      state: scope?.dataset.projectionState ?? null,
      family: scope?.dataset.projectionFamily ?? null,
      runtime: scope?.dataset.projectionRuntime ?? null,
      contentFamily: content?.dataset.projectionFamily ?? null,
      contentRuntime: content?.dataset.projectionRuntime ?? null,
      componentId: previewer.dataset.projectionComponent ?? null,
      contentRecipeId: content?.dataset.projectionId ?? null,
      contentOwner: content?.dataset.projectionOwner ?? null,
      contentGeneration: content?.dataset.projectionGeneration ?? null,
      previewerState: previewer.dataset.projectionState ?? null,
      previewerFamily: previewer.dataset.projectionFamily ?? null,
      previewerRuntime: previewer.dataset.projectionRuntime ?? null,
      shell: {
        boundaryValid: shellBoundary,
        count: shells?.length ?? 0,
        mountCount: mounts?.length ?? 0,
        retainedContentCount: retainedContents?.length ?? 0,
        slotCount: slots?.length ?? 0,
        prototypeId: shell?.dataset.projectionPrototype ?? null,
        family: shell?.dataset.projectionFamily ?? null,
        runtime: shell?.dataset.projectionRuntime ?? null,
        generation: shellGeneration,
        owner: shell?.dataset.projectionOwner ?? null,
        ownershipBasis:
          'Reserved published DOM boundary under the current lease-bearing mount; the independent controller owner is not published or certified.',
        mountOwner: mount?.dataset.projectionOwner ?? null,
        mountGeneration: mount?.dataset.projectionGeneration ?? null,
        retainedOwner: retained?.dataset.projectionOwner ?? null,
        retainedGeneration: retained?.dataset.projectionGeneration ?? null,
        rendererHostHidden: host?.hasAttribute('hidden') ?? null,
        slotOwnsRetainedContent: !!slot && retained?.parentElement === slot,
      },
      rootPrototypeId: content?.dataset.projectionPrototype ?? null,
      rootPresent,
      invalidRoots: invalidRoots.map((root) => ({
        prototypeId: root.dataset.projectionPrototype ?? null,
        owner: root.dataset.projectionOwner ?? null,
        generation: root.dataset.projectionGeneration ?? null,
      })),
      misplacedRoots: misplacedRoots.map((root) => ({
        prototypeId: root.dataset.projectionPrototype ?? null,
        owner: root.dataset.projectionOwner ?? null,
        generation: root.dataset.projectionGeneration ?? null,
      })),
    },
    boundary:
      'Requested authored Brutalist recipe/component/runtime and current lease, checked before and after every PNG/fact frame; not semantic conformance.',
  };
  return { observation, scope, content, retained, shell, owner, generation };
};

export interface ContrastAuditSubject {
  previewer: HTMLElement;
  previewerId: string;
  expected: ContrastProjectionExpectation;
}

// Required production input, bound once by the caller to its selected physical
// Previewer. Never rediscover it by document order or fall back to calibration.
export const readContrastAuditSubject = (subject: ContrastAuditSubject) => {
  if (
    !subject ||
    !(subject.previewer instanceof HTMLElement) ||
    !subject.expected ||
    typeof subject.previewerId !== 'string' ||
    !subject.previewerId
  )
    throw new Error('Explicit audit Previewer subject and expectation are required.');
  const boundary = readContrastProjectionBoundary(subject.previewer, subject.expected);
  const matchingSubjects = [
    ...document.querySelectorAll<HTMLElement>('[data-previewer-id]'),
  ].filter((element) => element.dataset.previewerId === subject.previewerId);
  const valid =
    subject.previewer.isConnected &&
    subject.previewer.dataset.previewerId === subject.previewerId &&
    matchingSubjects.length === 1 &&
    matchingSubjects[0] === subject.previewer;
  return {
    ...boundary,
    observation: {
      ...boundary.observation,
      achieved: valid && boundary.observation.achieved,
      observed: {
        ...boundary.observation.observed,
        subject: {
          expectedPreviewerId: subject.previewerId,
          previewerId: subject.previewer.dataset.previewerId ?? null,
          connected: subject.previewer.isConnected,
          matchingSubjectCount: matchingSubjects.length,
        },
      },
    },
  };
};
const requireContrastAuditSubject = (subject: ContrastAuditSubject) => {
  const boundary = readContrastAuditSubject(subject);
  if (!boundary.observation.achieved)
    throw new Error('The selected audit Previewer identity or current subject lease is invalid.');
  return boundary;
};

// Structural observation only; the Node audit compares this current lease to
// the exact authored recipe. Reader toolbar portals are excluded by their own
// controls relations, not by assuming all portals belong to the product.
const readContrastAnatomyInScope = (
  primary: Element | null,
  scope: HTMLElement | null,
  boundary: ReturnType<typeof readContrastAuditSubject> | null
) => {
  const content = scope?.querySelector<HTMLElement>('[data-projection-content]');
  const owner = scope?.dataset.projectionOwner ?? scope?.dataset.projectionScope;
  const generation = scope?.dataset.projectionGeneration;
  const authoredContent = boundary ? boundary.retained : content;
  const all = [...document.querySelectorAll<HTMLElement>('[data-pui-root]')];
  const readerIds = new Set(
    [...(scope?.querySelectorAll('[data-projection-control] [aria-controls]') ?? [])].flatMap(
      (element) => (element.getAttribute('aria-controls') ?? '').split(/\s+/).filter(Boolean)
    )
  );
  const readerPortals = all.filter((element) => readerIds.has(element.id));
  const roots = all.filter(
    (element) =>
      !(boundary?.observation.achieved && element === boundary.shell) &&
      (content?.contains(element) ||
        (element.dataset.projectionOwner === owner &&
          element.dataset.projectionGeneration === generation)) &&
      !element.closest('[data-projection-control]') &&
      !readerPortals.some((portal) => portal.contains(element))
  );
  const indices = new Map(roots.map((element, index) => [element, index]));
  const surfaces = roots.map((element, uid) => {
    let parent = composedParent(element);
    while (parent && !indices.has(parent as HTMLElement)) parent = composedParent(parent);
    const visibility = readContrastPaintedVisibility(element);
    return {
      uid,
      parent: parent ? indices.get(parent as HTMLElement)! : null,
      prototypeId: element.dataset.projectionPrototype ?? null,
      ref: element.getAttribute('data-demo-ref'),
      id: element.id,
      role: element.getAttribute('role'),
      controls: (element.getAttribute('aria-controls') ?? '').split(/\s+/).filter(Boolean),
      descriptions: (element.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean),
      ariaChecked: element.getAttribute('aria-checked'),
      ariaSelected: element.getAttribute('aria-selected'),
      ariaExpanded: element.getAttribute('aria-expanded'),
      hovered: element.matches(':hover'),
      focused: document.activeElement === element,
      withinContent: !!authoredContent?.contains(element),
      currentLease:
        element.dataset.projectionOwner === owner &&
        element.dataset.projectionGeneration === generation,
      painted: visibility.visible && visibility.classification === 'source-model-visible',
      visibility,
    };
  });
  return {
    owner: owner ?? null,
    generation: generation ?? null,
    primary: primary ? (indices.get(primary as HTMLElement) ?? null) : null,
    currentLease:
      (boundary
        ? boundary.observation.achieved
        : !!(owner && generation && content && scope?.dataset.projectionState === 'ready')) &&
      surfaces.every((surface) => surface.currentLease),
    surfaces,
    projection: boundary?.observation ?? null,
  };
};

// Explicitly separate instrument compatibility from production subject reads.
export const readContrastAnatomy = (primary: Element | null = null) =>
  readContrastAnatomyInScope(
    primary,
    document.querySelector<HTMLElement>('[data-projection-scope]'),
    null
  );
export const readSubjectContrastAnatomy = (
  primary: Element | null,
  subject: ContrastAuditSubject
) => {
  const boundary = readContrastAuditSubject(subject);
  return readContrastAnatomyInScope(primary, boundary.scope, boundary);
};

// Generated layers can cover a target without changing its own color tokens.
// This finite source model does not reconstruct their geometry/stacking. Keep
// raw observations, but withhold paint metrics unless the layer is not generated
// or is explicitly display:none. Ordinary sibling overlay coverage stays unverified.
const generatedPseudoPaintLimits = (element: Element): string[] => {
  for (const pseudo of ['::before', '::after']) {
    const style = getComputedStyle(element, pseudo);
    if (style.content && !['none', 'normal'].includes(style.content) && style.display !== 'none')
      return ['unsupported-generated-pseudo-element'];
  }
  return [];
};

export const readContrastPointerPair = (
  element: Element,
  expected: { fill: string; foreground: string },
  held: boolean
) => {
  const style = getComputedStyle(element);
  const visibility = readContrastPaintedVisibility(element);
  // Geometry visibility does not establish an unmodified source color pair:
  // fractional opacity and blending may preserve bounds and native input while
  // changing both rendered colors. Keep this stricter guard pair-specific so
  // ordinary visibility still describes authored partially opaque surfaces.
  const paintLimits: string[] = [];
  for (let current: Element | null = element; current; current = composedParent(current)) {
    const paintStyle = getComputedStyle(current);
    paintLimits.push(...generatedPseudoPaintLimits(current));
    if (paintStyle.opacity !== '1') paintLimits.push('ancestor-or-target-opacity');
    if (paintStyle.mixBlendMode !== 'normal') paintLimits.push('blend-mode');
  }
  const canvas = document.createElement('canvas').getContext('2d');
  const normalize = (color: string): string | null => {
    if (!canvas || !CSS.supports('color', color)) return null;
    canvas.fillStyle = color;
    return canvas.fillStyle;
  };
  const fill = normalize(style.backgroundColor);
  const foreground = normalize(style.color);
  const expectedFill = normalize(expected.fill);
  const expectedForeground = normalize(expected.foreground);
  // This predicate certifies the target's simple CSS color pair, not every
  // possible renderer layer. Effective target values include inherited text
  // replacement. An opaque target does not borrow an ancestor background or
  // inset shadow, so do not blanket-reject those unrelated ancestor paints.
  if (style.backgroundImage !== 'none') paintLimits.push('unsupported-background-image');
  if (style.backgroundClip.split(',').some((clip) => /^(text|content-box)$/.test(clip.trim())))
    paintLimits.push('unsupported-background-clip');
  if (normalize(style.webkitTextFillColor) !== foreground)
    paintLimits.push('unsupported-text-fill-color');
  if (style.textShadow !== 'none') paintLimits.push('unsupported-text-shadow');
  if (parseFloat(style.webkitTextStrokeWidth) !== 0) paintLimits.push('unsupported-text-stroke');
  if (/\binset\b/.test(style.boxShadow)) paintLimits.push('unsupported-inset-shadow');
  const hovered = element.matches(':hover');
  const nativeActive = element.matches(':active');
  return {
    achieved:
      element.isConnected &&
      visibility.visible &&
      visibility.classification === 'source-model-visible' &&
      paintLimits.length === 0 &&
      hovered &&
      (!held || nativeActive) &&
      fill !== null &&
      foreground !== null &&
      fill === expectedFill &&
      foreground === expectedForeground,
    visibility,
    paintLimits: [...new Set(paintLimits)],
    hovered,
    nativeActive,
    fill,
    foreground,
    expectedFill,
    expectedForeground,
  };
};

// Diagnostic only. The runner imports the exact supervised server source;
// keeping this reader in the probe avoids Node transpiler name helpers leaking
// into Playwright's serialized page callback.
export const readContrastFocusDiagnostics = (center: any, url: string) => {
  const entries = [...center.entries.values()] as any[];
  const describe = (element: HTMLElement | null) =>
    element
      ? {
          text: element.textContent,
          role: element.getAttribute('role'),
          prototype: element.getAttribute('data-projection-prototype'),
          owner: element.getAttribute('data-projection-owner'),
          generation: element.getAttribute('data-projection-generation'),
          pending: element.hasAttribute('data-pui-view-pending'),
          detached: !!element.closest('[data-pui-view-detached]'),
          tabIndex: element.tabIndex,
          connected: element.isConnected,
        }
      : null;
  return {
    source: url,
    entryCount: entries.length,
    nativeFocused: describe(document.activeElement as HTMLElement | null),
    entries: entries.map((entry) => ({
      target: describe(entry.getRootTarget()),
      facts: entry.getFacts(),
      focusable: entry.isFocusable(),
      rovingProvider: entry.isRovingProvider(),
      scopeProvider: entry.isScopeProvider(),
      pendingFocus: entry.hasPendingFocus(),
      rovingMembers: entry.isRovingProvider()
        ? center.getRovingMembers(entry).map((member: any) => describe(member.getRootTarget()))
        : undefined,
    })),
    activeScopes: center.activeScopes.map((scope: any) =>
      describe(center.entries.get(scope.scope)?.getRootTarget() ?? null)
    ),
    boundary:
      'Private Focus diagnostics only; zero entries can mean a separate module identity and must not be treated as proof of no runtime state.',
  };
};

const collectContrastFrameInScope = async (
  {
    image,
    family,
  }: {
    image: string;
    family: string;
  },
  resolveScope: () => HTMLElement | null
): Promise<ContrastFrame> => {
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
  const scope = resolveScope();
  const stateFingerprint = readContrastStateInScope(scope);
  const { owner, generation, surfaces } = currentProjection(scope);
  const background = (element: Element): { rgba: number[] | null; limits: string[] } => {
    const chain: SolidPaint[] = [],
      limits: string[] = [];
    let opaque = false;
    let current: Element | null = element;
    while (current) {
      const style = getComputedStyle(current);
      limits.push(...generatedPseudoPaintLimits(current));
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
      // Bounding-box fractions need not touch a rounded outline. Preserve the
      // sampled pixels, but do not infer border/fill adjacency from them.
      const perimeterLimits = [
        style.borderTopLeftRadius,
        style.borderTopRightRadius,
        style.borderBottomRightRadius,
        style.borderBottomLeftRadius,
      ].some((radius) => radius.split(/\s+/).some((axis) => parseFloat(axis) !== 0))
        ? ['unsupported-rounded-perimeter']
        : [];
      const rectangularPerimeter = measurablePerimeter && !perimeterLimits.length;
      const largeText =
        parseFloat(style.fontSize) >= 24 ||
        (parseFloat(style.fontSize) >= 18.6666666667 && parseInt(style.fontWeight) >= 700);
      const inkUnmodified = !backdrop.limits.some((limit) =>
        [
          'ancestor-or-target-opacity',
          'filter-or-backdrop-filter',
          'blend-mode',
          'unsupported-generated-pseudo-element',
        ].includes(limit)
      );
      const borders: ContrastSurface['borders'] = {};
      for (const side of ['top', 'right', 'bottom', 'left']) {
        const ink = side === 'top' ? border : paint(style.getPropertyValue(`border-${side}-color`));
        const borderStyle = style.getPropertyValue(`border-${side}-style`);
        borders[side] = {
          color: ink.rgba,
          alpha: ink.alpha,
          width: parseFloat(style.getPropertyValue(`border-${side}-width`)),
          style: borderStyle,
          // Source ink is not continuous adjacency for dash gaps, double
          // stripes or other unsupported styles. Keep this limit side-local.
          limits: [
            ...ink.limits,
            ...(borderStyle === 'solid' ? [] : ['unsupported-border-style']),
            ...(style.borderImageSource !== 'none' ? ['unsupported-border-image'] : []),
          ],
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
          if (!(parseFloat(textStyle.fontSize) > 0)) limits.push('unsupported-font-size');
          if (textStyle.webkitTextFillColor !== textStyle.color)
            limits.push('unsupported-text-fill-color');
          if (textStyle.textShadow !== 'none') limits.push('unsupported-text-shadow');
          if (parseFloat(textStyle.webkitTextStrokeWidth) !== 0)
            limits.push('unsupported-text-stroke');
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
      if (placeholderStyle && placeholderStyle.webkitTextFillColor !== placeholderStyle.color)
        placeholderLimits.push('unsupported-placeholder-text-fill-color');
      if (placeholderStyle && placeholderStyle.textShadow !== 'none')
        placeholderLimits.push('unsupported-placeholder-text-shadow');
      if (placeholderStyle && parseFloat(placeholderStyle.webkitTextStrokeWidth) !== 0)
        placeholderLimits.push('unsupported-placeholder-text-stroke');
      if (placeholderStyle && !(parseFloat(placeholderStyle.fontSize) > 0))
        placeholderLimits.push('unsupported-placeholder-font-size');
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
      if (!(parseFloat(style.fontSize) > 0)) textLimits.push('unsupported-font-size');
      if (inactive) textLimits.push('inactive-component');
      if (style.webkitTextFillColor !== style.color) textLimits.push('unsupported-text-fill-color');
      if (style.textShadow !== 'none') textLimits.push('unsupported-text-shadow');
      if (parseFloat(style.webkitTextStrokeWidth) !== 0) textLimits.push('unsupported-text-stroke');
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
        const hardOpaque = rectangularPerimeter && inkUnmodified && ink.alpha === 1 && blur === 0;
        const receiving =
          !inset && hardOpaque
            ? [
                {
                  side: 'right',
                  point:
                    x + spread > 0 && rect.width + 2 * spread > 0 && rect.height + 2 * spread > 0
                      ? sample(rect.right + x + spread + 1, rect.y + rect.height / 2 + y)
                      : null,
                },
                {
                  side: 'bottom',
                  point:
                    y + spread > 0 && rect.width + 2 * spread > 0 && rect.height + 2 * spread > 0
                      ? sample(rect.x + rect.width / 2 + x, rect.bottom + y + spread + 1)
                      : null,
                },
              ]
            : [];
        return {
          raw,
          ink: ink.rgba,
          alpha: ink.alpha,
          limits: [...ink.limits, ...visibility.limits, ...perimeterLimits],
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
              ? 'CSS ink versus recorded receiving pixel only for positive right/bottom shadow extension and nonempty spread geometry; unsupported sides have null points/ratios. Layered geometry, shadow visibility and cue necessity remain unresolved.'
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
        perimeterLimits,
        exterior: exterior.map(({ side, point }) => ({
          side,
          point,
          innerBorderVsBackground:
            !inactive &&
            rectangularPerimeter &&
            inkUnmodified &&
            borders[side].style === 'solid' &&
            !borders[side].limits.length &&
            borders[side].alpha === 1 &&
            borders[side].color &&
            borders[side].width > 0 &&
            backdrop.rgba
              ? contrast(borders[side].color, backdrop.rgba)
              : null,
          opaqueBorderVsPixel:
            !inactive &&
            rectangularPerimeter &&
            inkUnmodified &&
            borders[side].style === 'solid' &&
            !borders[side].limits.length &&
            borders[side].alpha === 1 &&
            borders[side].color &&
            borders[side].width > 0 &&
            point
              ? contrast(borders[side].color, point.rgb)
              : null,
          opaqueFillVsPixel:
            !inactive &&
            rectangularPerimeter &&
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

// Calibration remains a distinct entry. Missing production subjects never use it.
export const collectContrastFrame = (input: { image: string; family: string }) =>
  collectContrastFrameInScope(input, () =>
    document.querySelector<HTMLElement>('[data-projection-scope]')
  );
export const collectSubjectContrastFrame = (input: {
  image: string;
  family: string;
  subject: ContrastAuditSubject;
}) => {
  requireContrastAuditSubject(input.subject);
  return collectContrastFrameInScope(input, () => requireContrastAuditSubject(input.subject).scope);
};
