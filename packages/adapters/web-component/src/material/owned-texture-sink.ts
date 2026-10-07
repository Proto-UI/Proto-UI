import type {
  FinalStyleFrame,
  FinalStyleSink,
} from '@proto.ui/module-feedback/internal/final-style-sink';
import { createOwnedVisualSurface, type OwnedVisualSurface } from '../visual-surface';
import type { OwnedTokenApplier } from '../feedback-style';

export type OwnedTexture = {
  /** Monotonic provider revision; pixels and texture dimensions are immutable within a revision. Snapshot objects may be fresh on each read. */
  generation: number;
  width: number;
  height: number;
  pixels: Uint8Array;
  /** Normalized top-left sampling bounds inside this owned texture. */
  bounds(host: HTMLElement): [number, number, number, number];
};
export type OwnedTextureSource = {
  current(): OwnedTexture | null;
  subscribe(invalidate: () => void): () => void;
};
export type MaterialProgram = {
  vertex: string;
  fragment: string;
  uniforms: readonly { name: string }[];
  /** Optional compiled preparation of already-owned opaque RGBA pixels. */
  prepareSource?(pixels: Uint8Array, width: number, height: number): Uint8Array;
  writeFrame(
    gl: WebGLRenderingContext,
    locations: Record<string, WebGLUniformLocation | null>,
    frame: unknown
  ): void;
};
export type MaterialPreferences = {
  current(): {
    reducedMotion: string;
    reducedTransparency: string;
    contrast: string;
    forcedColors: string;
  };
  subscribe(invalidate: () => void): () => void;
};
const rgba = (value: unknown): value is readonly number[] =>
  Array.isArray(value) &&
  value.length === 4 &&
  value[3] === 1 &&
  [0, 1, 2, 3].every(
    (i) => Object.hasOwn(value, i) && Number.isFinite(value[i]) && value[i] >= 0 && value[i] <= 1
  );
const color = (v: readonly number[]) =>
  `rgba(${v[0] * 255}, ${v[1] * 255}, ${v[2] * 255}, ${v[3]})`;
const selectionSurface = (token: string) => /^selection:[^:]+$/u.test(token);
const paint = (token: string) =>
  !selectionSurface(token) && /^(bg-|backdrop-)/.test(token.split(':').at(-1)!);
const relevantSelector = (token: string) =>
  !selectionSurface(token) &&
  token.includes(':') &&
  /^(bg-|backdrop-|rounded|text-)/.test(token.split(':').at(-1)!);

// One finite list drives both admission and invalidation. It does not claim
// complete external CSS compositing support or introduce a generic style parser.
const COMPOSED_PAINT_FIELDS = [
  ['opacity', '1', 'compositing'],
  ['filter', 'none', 'compositing'],
  ['mixBlendMode', 'normal', 'compositing'],
  ['transform', 'none', 'geometry'],
  ['rotate', 'none', 'geometry'],
  ['scale', 'none', 'geometry'],
  ['translate', 'none', 'geometry'],
] as const;

function composedPaintInputs(host: HTMLElement) {
  const values: string[] = [];
  let opaque = true;
  let axisAligned = true;
  const seen = new Set<Element>();
  let element: Element | null = host;
  while (element && !seen.has(element)) {
    seen.add(element);
    const css = element.ownerDocument.defaultView?.getComputedStyle(element);
    for (const [property, neutral, boundary] of COMPOSED_PAINT_FIELDS) {
      const value = css?.[property] || neutral;
      values.push(value);
      const accepted = property === 'opacity' ? Number(value) === 1 : value === neutral;
      if (!accepted) {
        if (boundary === 'compositing') opaque = false;
        else axisAligned = false;
      }
    }
    const root = element.getRootNode();
    element =
      element.assignedSlot ??
      element.parentElement ??
      (root.nodeType === 11 && 'host' in root ? (root as ShadowRoot).host : null);
  }
  return { values, opaque, axisAligned };
}

// The absolute visual canvas fills the host padding box, while providers retain
// host-border-box bounds. Include these style-owned insets in frame observation.
const borderWidths = (css: CSSStyleDeclaration | undefined) => [
  css?.borderTopWidth || '0px',
  css?.borderRightWidth || '0px',
  css?.borderBottomWidth || '0px',
  css?.borderLeftWidth || '0px',
];

/** Private, bounded, reusable owned-RGBA consumer. Never captures DOM or loads a URL. */
export function createOwnedTextureVisualSink(
  host: HTMLElement,
  style: OwnedTokenApplier,
  program: MaterialProgram | null,
  source: OwnedTextureSource,
  preferences: MaterialPreferences,
  surface: OwnedVisualSurface = createOwnedVisualSurface(host, host.shadowRoot ?? host)
): FinalStyleSink {
  const canvas = host.ownerDocument.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.dataset.puiMaterial = 'owned-texture';
  Object.assign(canvas.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '-1',
    display: 'none',
  });
  const ownedInline = new Map<string, { before: [string, string]; applied: [string, string] }>();
  const inline = (name: string): [string, string] => [
    host.style.getPropertyValue(name),
    host.style.getPropertyPriority(name),
  ];
  function restoreOwnedInline() {
    for (const [name, entry] of ownedInline) {
      const current = inline(name);
      if (current[0] === entry.applied[0] && current[1] === entry.applied[1]) {
        if (entry.before[0]) host.style.setProperty(name, ...entry.before);
        else host.style.removeProperty(name);
      }
    }
    ownedInline.clear();
  }
  function ownInline(name: string, value: string) {
    const existing = ownedInline.get(name);
    const current = inline(name);
    const before =
      existing && current[0] === existing.applied[0] && current[1] === existing.applied[1]
        ? existing.before
        : current;
    host.style.setProperty(name, value);
    ownedInline.set(name, { before, applied: inline(name) });
  }
  let gl: WebGLRenderingContext | null = null;
  let pipeline: WebGLProgram | null = null;
  let buffer: WebGLBuffer | null = null;
  let textures: WebGLTexture[] = [];
  let locations: Record<string, WebGLUniformLocation | null> = {};
  let last: FinalStyleFrame | null = null;
  let retired = false;
  let lost = false;
  let painting = false;
  let again = false;
  let highestSource = -1;
  let paints = 0;
  let preparedSource: OwnedTexture | null = null;
  let preparedGeneration = -1;
  let preparedPixels: Uint8Array | null = null;
  let resolvedForeground: number[] | null = null;
  let observer: ResizeObserver | null = null;
  let ownerWindow = host.ownerDocument.defaultView;
  let geometryFrame: number | null = null;
  let renderedGeneration = -1;
  let renderedGeometry: (number | string)[] | null = null;
  let recoverInputs = false;
  const sameSnapshot = (a: OwnedTexture | null, b: OwnedTexture) =>
    a !== null && a.generation === b.generation && a.width === b.width && a.height === b.height;
  function stopGeometryWatch() {
    if (geometryFrame !== null) ownerWindow?.cancelAnimationFrame(geometryFrame);
    geometryFrame = null;
  }
  function watchGeometry() {
    if (
      retired ||
      (!recoverInputs && canvas.style.display !== 'block') ||
      geometryFrame !== null ||
      !ownerWindow
    )
      return;
    geometryFrame = ownerWindow.requestAnimationFrame(() => {
      geometryFrame = null;
      if (retired || (!recoverInputs && canvas.style.display !== 'block')) return;
      try {
        const current = source.current();
        if (retired) return;
        const bounds = current ? current.bounds(host) : [];
        if (retired) return;
        const rect = host.getBoundingClientRect();
        const css = host.ownerDocument.defaultView?.getComputedStyle(host);
        const next = [
          rect.x,
          rect.y,
          rect.width,
          rect.height,
          host.ownerDocument.defaultView?.devicePixelRatio ?? NaN,
          ...bounds,
          css?.transform ?? 'none',
          css?.borderTopLeftRadius ?? '',
          css?.borderTopRightRadius ?? '',
          css?.borderBottomLeftRadius ?? '',
          css?.borderBottomRightRadius ?? '',
          ...borderWidths(css),
          css?.color ?? '',
          css?.opacity ?? '',
          ...composedPaintInputs(host).values,
        ];
        if (
          host.ownerDocument.defaultView !== ownerWindow ||
          (current?.generation ?? -1) !== renderedGeneration ||
          !renderedGeometry ||
          next.length !== renderedGeometry.length ||
          next.some((value, i) => value !== renderedGeometry![i])
        ) {
          renderedGeometry = next;
          renderedGeneration = current?.generation ?? -1;
          repaint();
        }
      } catch {
        if (retired) return;
        freeGPU();
        fallback('geometry-observation-failed');
      }
      watchGeometry();
    });
  }

  const diagnostics = new Map<
    string,
    { before: string | undefined; applied: string | undefined }
  >();
  function diagnostic(key: string, value: string | undefined) {
    if (retired) return;
    const current = host.dataset[key];
    const entry = diagnostics.get(key);
    const before = entry && current === entry.applied ? entry.before : current;
    if (value === undefined) delete host.dataset[key];
    else host.dataset[key] = value;
    diagnostics.set(key, { before, applied: value });
  }
  function clearDiagnostics() {
    for (const [key, entry] of diagnostics) {
      if (host.dataset[key] !== entry.applied) continue;
      if (entry.before === undefined) delete host.dataset[key];
      else host.dataset[key] = entry.before;
    }
    diagnostics.clear();
  }
  function unavailable(reason: string) {
    if (retired) return;
    recoverInputs = false;
    stopGeometryWatch();
    canvas.style.display = 'none';
    freeGPU();
    restoreOwnedInline();
    if (last) style.apply([...last.style.tokens]);
    if (retired) return;
    clearDiagnostics();
    diagnostic('materialQuality', 'unavailable');
    diagnostic('materialReason', reason);
    recoverInputs =
      !!last?.material && !!program && reason === 'complete-readable-fallback-unavailable';
    if (recoverInputs) watchGeometry();
  }
  const luminance = (rgb: readonly number[]) =>
    rgb
      .slice(0, 3)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const contrast = (a: readonly number[], b: readonly number[]) => {
    const x = luminance(a),
      y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  function fallback(reason: string) {
    if (retired) return;
    stopGeometryWatch();
    recoverInputs =
      reason === 'geometry-unavailable' ||
      reason === 'geometry-budget' ||
      reason === 'rendered-contrast-unsafe';
    canvas.style.display = 'none';
    restoreOwnedInline();
    const fill = last?.material?.config?.fallback?.fill;
    if (!rgba(fill) || !resolvedForeground || contrast(fill, resolvedForeground) < 4.5) {
      unavailable('complete-readable-fallback-unavailable');
      return;
    }
    ownInline('background', color(fill));
    diagnostic('materialQuality', 'opaque-fallback');
    diagnostic('materialReason', reason);
    diagnostic(
      'materialPhase',
      last?.material?.pressed && !last?.material?.disabled ? 'pressed' : 'rest'
    );
    diagnostic('materialRadius', undefined);
    if (recoverInputs) watchGeometry();
  }
  function freeGPU() {
    recoverInputs = false;
    // Revoked leases must not leave readable pixels in preserveDrawingBuffer.
    stopGeometryWatch();
    canvas.width = 0;
    canvas.height = 0;
    preparedSource = null;
    preparedPixels = null;
    preparedGeneration = -1;
    if (!gl) return;
    for (const texture of textures) gl.deleteTexture(texture);
    if (buffer) gl.deleteBuffer(buffer);
    if (pipeline) gl.deleteProgram(pipeline);
    textures = [];
    buffer = null;
    pipeline = null;
    locations = {};
  }
  function prepareGPU() {
    if (!program) throw new Error('material-support-unavailable');
    if (lost) throw new Error('context-lost');
    if (pipeline) return;
    gl ??= canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
      antialias: false,
    });
    if (!gl) throw new Error('webgl-unavailable');
    const g = gl;
    const shaders: WebGLShader[] = [];
    try {
      for (const [type, text] of [
        [g.VERTEX_SHADER, program.vertex],
        [g.FRAGMENT_SHADER, program.fragment],
      ] as const) {
        const shader = g.createShader(type);
        if (!shader) throw new Error('shader-allocation');
        shaders.push(shader);
        g.shaderSource(shader, text);
        g.compileShader(shader);
        if (!g.getShaderParameter(shader, g.COMPILE_STATUS)) throw new Error('shader-compilation');
      }
      pipeline = g.createProgram();
      if (!pipeline) throw new Error('program-allocation');
      for (const shader of shaders) g.attachShader(pipeline, shader);
      g.linkProgram(pipeline);
      if (!g.getProgramParameter(pipeline, g.LINK_STATUS)) throw new Error('program-link');
      g.useProgram(pipeline);
      locations = Object.fromEntries(
        program.uniforms.map(({ name }) => [name, g.getUniformLocation(pipeline!, name)])
      );
      buffer = g.createBuffer();
      if (!buffer) throw new Error('buffer-allocation');
      g.bindBuffer(g.ARRAY_BUFFER, buffer);
      g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW);
      const attribute = g.getAttribLocation(pipeline, 'a_position');
      if (attribute < 0) throw new Error('position-attribute');
      g.enableVertexAttribArray(attribute);
      g.vertexAttribPointer(attribute, 2, g.FLOAT, false, 0, 0);
      for (let slot = 0; slot < 3; slot++) {
        const texture = g.createTexture();
        if (!texture) throw new Error('texture-allocation');
        textures.push(texture);
        g.activeTexture(g.TEXTURE0 + slot);
        g.bindTexture(g.TEXTURE_2D, texture);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
        g.texImage2D(
          g.TEXTURE_2D,
          0,
          g.RGBA,
          1,
          1,
          0,
          g.RGBA,
          g.UNSIGNED_BYTE,
          new Uint8Array([0, 0, 0, 0])
        );
      }
    } catch (error) {
      freeGPU();
      throw error;
    } finally {
      for (const shader of shaders) g.deleteShader(shader);
    }
  }
  function repaint() {
    if (retired || !last) return;
    if (painting) {
      again = true;
      return;
    }
    painting = true;
    try {
      const currentWindow = host.ownerDocument.defaultView;
      if (currentWindow !== ownerWindow) {
        stopGeometryWatch();
        ownerWindow = currentWindow;
        observer?.disconnect();
        observer = ownerWindow?.ResizeObserver ? new ownerWindow.ResizeObserver(repaint) : null;
        observer?.observe(host);
      }
      const material = last.material;
      if (!material) {
        canvas.style.display = 'none';
        style.apply([...last.style.tokens]);
        freeGPU();
        restoreOwnedInline();
        clearDiagnostics();
        resolvedForeground = null;
        return;
      }
      const c = material.config;
      if (
        !c ||
        c.version !== 1 ||
        c.material?.kind !== 'refractive' ||
        c.material.variant !== 'regular' ||
        c.sampling?.kind !== 'owned-scene' ||
        c.sampling.slot !== 'scene' ||
        c.shape?.geometry !== 'style' ||
        c.shape.kind !== 'rounded-rect' ||
        !rgba(c.fallback?.fill) ||
        c.fallback?.foreground !== 'style'
      )
        throw new Error('invalid-material-declaration');
      // Remove competing Proto-owned fill before publishing fallback or enhancement.
      restoreOwnedInline();
      style.apply(last.style.tokens.filter((token) => !paint(token)));
      if (retired) return;
      const css = ownerWindow?.getComputedStyle(host);
      if (!css) throw new Error('owner-document-unavailable');
      const paintInputs = composedPaintInputs(host);
      const parsed = css.color.match(
        /^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/
      );
      resolvedForeground =
        parsed && (!parsed[4] || Number(parsed[4]) === 1)
          ? [Number(parsed[1]) / 255, Number(parsed[2]) / 255, Number(parsed[3]) / 255, 1]
          : null;
      if (
        !rgba(resolvedForeground) ||
        !paintInputs.opaque ||
        contrast(c.fallback.fill, resolvedForeground) < 4.5
      ) {
        unavailable('complete-readable-fallback-unavailable');
        return;
      }
      fallback('preparing');
      if (last.style.tokens.some(paint)) {
        fallback('conflicting-authored-paint');
        return;
      }
      if (last.style.tokens.some(relevantSelector)) {
        fallback('unresolved-style-provenance');
        return;
      }
      if (!material.bindingsReady) {
        fallback('material-state-unavailable');
        return;
      }
      if (!program) {
        fallback('material-support-unavailable');
        return;
      }
      const prefs = preferences.current();
      if (retired) return;
      if (
        prefs.reducedMotion !== 'no-preference' ||
        prefs.reducedTransparency !== 'no-preference' ||
        prefs.contrast !== 'no-preference' ||
        prefs.forcedColors !== 'none'
      ) {
        freeGPU();
        fallback('unsafe-or-unknown-preference');
        return;
      }
      const texture = source.current();
      if (retired) return;
      if (
        !texture ||
        !Number.isSafeInteger(texture.generation) ||
        texture.generation < highestSource
      ) {
        freeGPU();
        fallback('material-source-unavailable');
        return;
      }
      highestSource = texture.generation;
      if (
        !Number.isInteger(texture.width) ||
        !Number.isInteger(texture.height) ||
        texture.width < 1 ||
        texture.height < 1 ||
        texture.width > 2048 ||
        texture.height > 2048 ||
        texture.width * texture.height > 1048576 ||
        !(texture.pixels instanceof Uint8Array) ||
        texture.pixels.length !== texture.width * texture.height * 4
      ) {
        freeGPU();
        fallback('invalid-owned-source');
        return;
      }
      for (let i = 3; i < texture.pixels.length; i += 4)
        if (texture.pixels[i] !== 255) {
          freeGPU();
          fallback('source-not-opaque');
          return;
        }
      if (!sameSnapshot(preparedSource, texture) || preparedGeneration !== texture.generation) {
        const nextPixels =
          program.prepareSource?.(texture.pixels, texture.width, texture.height) ?? texture.pixels;
        if (retired) return;
        if (!(nextPixels instanceof Uint8Array) || nextPixels.length !== texture.pixels.length)
          throw new Error('invalid-prepared-source');
        for (let i = 3; i < nextPixels.length; i += 4)
          if (nextPixels[i] !== 255) throw new Error('prepared-source-not-opaque');
        preparedSource = texture;
        preparedGeneration = texture.generation;
        preparedPixels = nextPixels;
      }
      const rect = host.getBoundingClientRect();
      const borders = borderWidths(css);
      const radii = [
        css.borderTopLeftRadius,
        css.borderTopRightRadius,
        css.borderBottomLeftRadius,
        css.borderBottomRightRadius,
      ];
      if (
        !paintInputs.axisAligned ||
        !radii.every((value) => /^\d+(\.\d+)?px$/.test(value)) ||
        !radii.every((value) => value === radii[0]) ||
        !borders.every((value) => /^\d+(\.\d+)?px$/.test(value))
      ) {
        fallback('geometry-unavailable');
        return;
      }
      const [top, right, bottom, left] = borders.map(parseFloat);
      const boxWidth = rect.width - left - right;
      const boxHeight = rect.height - top - bottom;
      const outerRadius = Math.min(parseFloat(radii[0]), rect.width / 2, rect.height / 2);
      // CSS derives padding-edge corners from the same style-owned outer radius.
      // This finite shader accepts one circular inner radius, not four ellipses.
      const innerRadii = [
        [left, top],
        [right, top],
        [left, bottom],
        [right, bottom],
      ].flatMap(([x, y]) => {
        const rx = Math.max(0, outerRadius - x),
          ry = Math.max(0, outerRadius - y);
        return rx === 0 || ry === 0 ? [0, 0] : [rx, ry];
      });
      if (!innerRadii.every((value) => value === innerRadii[0])) {
        fallback('geometry-unavailable');
        return;
      }
      const dpr = ownerWindow?.devicePixelRatio ?? NaN;
      const width = Math.ceil(boxWidth * dpr),
        height = Math.ceil(boxHeight * dpr);
      const radius = innerRadii[0];
      if (
        ![width, height, radius, dpr].every(Number.isFinite) ||
        width < 1 ||
        height < 1 ||
        width > 2048 ||
        height > 2048 ||
        width * height > 1048576 ||
        dpr < 0.5 ||
        dpr > 3
      ) {
        fallback('geometry-budget');
        return;
      }
      const sourceBounds = texture.bounds(host);
      if (retired) return;
      // Cropping must not disguise an invalid original provider extent.
      if (
        !Array.isArray(sourceBounds) ||
        sourceBounds.length !== 4 ||
        ![0, 1, 2, 3].every(
          (i) => Object.hasOwn(sourceBounds, i) && Number.isFinite(sourceBounds[i])
        ) ||
        sourceBounds[0] < 0 ||
        sourceBounds[1] < 0 ||
        sourceBounds[2] <= 0 ||
        sourceBounds[3] <= 0 ||
        sourceBounds[0] + sourceBounds[2] > 1 ||
        sourceBounds[1] + sourceBounds[3] > 1
      )
        throw new Error('invalid-owned-source-bounds');
      // Derive extents from inset endpoints so independently rounded origin and
      // width cannot push a valid edge beyond its validated source interval.
      const sourceLeft = sourceBounds[0] + sourceBounds[2] * (left / rect.width);
      const sourceTop = sourceBounds[1] + sourceBounds[3] * (top / rect.height);
      const sourceRight = sourceBounds[0] + sourceBounds[2] * (1 - right / rect.width);
      const sourceBottom = sourceBounds[1] + sourceBounds[3] * (1 - bottom / rect.height);
      const frame = {
        viewport: [width, height],
        textureSize: [texture.width, texture.height],
        bounds: [
          sourceLeft,
          sourceTop,
          left === 0 && right === 0 ? sourceBounds[2] : sourceRight - sourceLeft,
          top === 0 && bottom === 0 ? sourceBounds[3] : sourceBottom - sourceTop,
        ],
        subpixel: [0, 0],
        boxSize: [boxWidth * dpr, boxHeight * dpr],
        dpr,
        radius,
        pressed: material.pressed,
        disabled: material.disabled,
      };
      if (retired) return;
      prepareGPU();
      const g = gl!;
      canvas.width = width;
      canvas.height = height;
      canvas.style.borderRadius = `${radius}px`;
      g.viewport(0, 0, width, height);
      g.useProgram(pipeline);
      g.activeTexture(g.TEXTURE0);
      g.bindTexture(g.TEXTURE_2D, textures[0]);
      g.pixelStorei(g.UNPACK_ALIGNMENT, 1);
      g.texImage2D(
        g.TEXTURE_2D,
        0,
        g.RGBA,
        texture.width,
        texture.height,
        0,
        g.RGBA,
        g.UNSIGNED_BYTE,
        preparedPixels
      );
      program.writeFrame(g, locations, frame);
      if (retired) return;
      g.clearColor(0, 0, 0, 0);
      g.clear(g.COLOR_BUFFER_BIT);
      g.disable(g.BLEND);
      g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
      g.finish();
      if (g.getError() !== g.NO_ERROR || g.isContextLost()) throw new Error('gpu-frame-failed');
      const rendered = new Uint8Array(width * height * 4);
      g.readPixels(0, 0, width, height, g.RGBA, g.UNSIGNED_BYTE, rendered);
      if (g.getError() !== g.NO_ERROR) throw new Error('gpu-readback-failed');
      for (let i = 0; i < rendered.length; i += 4)
        if (
          rendered[i + 3] >= 250 &&
          contrast(
            [rendered[i] / 255, rendered[i + 1] / 255, rendered[i + 2] / 255, 1],
            resolvedForeground!
          ) < 4.5
        ) {
          fallback('rendered-contrast-unsafe');
          return;
        }
      const finalSource = source.current();
      if (retired) return;
      if (!sameSnapshot(finalSource, texture)) {
        freeGPU();
        fallback('source-replaced-during-frame');
        return;
      }
      if (!ownerWindow?.requestAnimationFrame) throw new Error('geometry-observer-unavailable');
      if (css.position === 'static') ownInline('position', 'relative');
      ownInline('isolation', 'isolate');
      if (retired) return;
      surface.mount(canvas);
      if (retired) return;
      ownInline('background', 'transparent');
      if (retired) return;
      recoverInputs = false;
      canvas.style.display = 'block';
      diagnostic('materialQuality', 'experimental-owned-texture');
      diagnostic('materialReason', 'rendered');
      diagnostic('materialFrame', String(++paints));
      diagnostic('materialPhase', material.pressed && !material.disabled ? 'pressed' : 'rest');
      diagnostic('materialRadius', String(radius));
      renderedGeneration = texture.generation;
      renderedGeometry = [
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        dpr,
        ...sourceBounds,
        css.transform,
        ...radii,
        ...borders,
        css.color,
        css.opacity,
        ...paintInputs.values,
      ];
      watchGeometry();
    } catch (error) {
      if (retired) return;
      freeGPU();
      fallback(error instanceof Error ? error.message : 'material-frame-failed');
    } finally {
      painting = false;
      if (again) {
        again = false;
        repaint();
      }
    }
  }
  const onLost = (event: Event) => {
    event.preventDefault();
    lost = true;
    freeGPU();
    fallback('context-lost');
  };
  const onRestored = () => {
    lost = false;
    repaint();
  };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);
  let offSource = () => {};
  let offPreferences = () => {};
  try {
    offSource = source.subscribe(repaint);
    offPreferences = preferences.subscribe(repaint);
    if (ownerWindow?.ResizeObserver) {
      observer = new ownerWindow.ResizeObserver(repaint);
      observer.observe(host);
    }
  } catch (error) {
    retired = true;
    for (const cleanup of [
      offSource,
      offPreferences,
      () => observer?.disconnect(),
      () => canvas.removeEventListener('webglcontextlost', onLost),
      () => canvas.removeEventListener('webglcontextrestored', onRestored),
      freeGPU,
      () => surface.release(canvas),
    ]) {
      try {
        cleanup();
      } catch {
        /* Preserve the construction failure after every unwind. */
      }
    }
    throw error;
  }
  return {
    commit(frame) {
      if (retired) throw new Error('Retired material visual sink');
      if (last && (frame.view < last.view || frame.revision <= last.revision))
        throw new Error('Stale final style frame');
      last = frame;
      repaint();
    },
    release() {
      if (retired) return;
      retired = true;
      let failed = false;
      let firstError: unknown;
      for (const cleanup of [
        stopGeometryWatch,
        offSource,
        offPreferences,
        () => observer?.disconnect(),
        () => canvas.removeEventListener('webglcontextlost', onLost),
        () => canvas.removeEventListener('webglcontextrestored', onRestored),
        freeGPU,
        () => surface.release(canvas),
        () => style.clear(),
        restoreOwnedInline,
        clearDiagnostics,
        () => {
          last = null;
        },
      ]) {
        try {
          cleanup();
        } catch (error) {
          if (!failed) {
            failed = true;
            firstError = error;
          }
        }
      }
      if (failed) throw firstError;
    },
  };
}

/** Generic WC consumes a declared slot conservatively when no GPU provider is installed. */
export function createOpaqueMaterialVisualSink(
  host: HTMLElement,
  style: OwnedTokenApplier
): FinalStyleSink {
  return createOwnedTextureVisualSink(
    host,
    style,
    null,
    { current: () => null, subscribe: () => () => {} },
    {
      current: () => ({
        reducedMotion: 'unknown',
        reducedTransparency: 'unknown',
        contrast: 'unknown',
        forcedColors: 'unknown',
      }),
      subscribe: () => () => {},
    }
  );
}
