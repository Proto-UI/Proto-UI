import { contactFragment } from './contact-profile';
import {
  styleTintFragment,
  styleTintContactFragment,
  styleTintEnvelope,
} from './style-tint-profile';
import { vertex, fragment, uniformNames } from './liquidgl-kernel.generated';
import type { OpaqueRgba } from './style';
import type { CanvasBackdropFrame } from './source';

const decodeSrgb = (channel: number) =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
// Readback is RGBA8. Keep the original floating-point expressions, including
// premultiplied near-opaque composition, while decoding each possible byte once.
// These tables contain only color arithmetic, never source or rendered pixels.
const linearBytes = Float64Array.from({ length: 256 }, (_, code) => decodeSrgb(code / 255));
const linearOverWhite = Array.from({ length: 5 }, (_, index) => {
  const alpha = index + 250;
  return Float64Array.from({ length: 256 }, (_, code) => {
    const composite = code / 255 + (1 - alpha / 255);
    return composite > 1 ? NaN : decodeSrgb(composite);
  });
});
const luminance = (color: OpaqueRgba) =>
  decodeSrgb(color[0]) * 0.2126 + decodeSrgb(color[1]) * 0.7152 + decodeSrgb(color[2]) * 0.0722;
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

export type OpticalGeometry = {
  width: number;
  height: number;
  radius: number;
  paintOutset?: number;
  dpr: number;
  bounds: [number, number, number, number];
};
export type OpticalFrame = {
  source: CanvasBackdropFrame;
  geometry: OpticalGeometry;
  pressed: boolean;
  /** Adapter-private, finite contact profile. No author shader uniforms. */
  contact?: { x: number; y: number; deltaX: number; deltaY: number; strength: number };
  variant: 'regular' | 'clear';
  /** Host-resolved opt-in, never an arbitrary author color or shader parameter. */
  tint?: 'style-fill';
  fill: OpaqueRgba;
  foreground: OpaqueRgba;
};
/** First-party finite V2 host profile. No author uniforms, Button state binding,
 * source acquisition, or reinterpretation of the historical v1 compiler. */
export function createWebOpticalProgram(
  canvas: HTMLCanvasElement,
  diagnostic: 'zero-refraction' | 'zero-deformation' | 'zero-aberration' | null = null
) {
  type PipelineKey = `${'static' | 'contact'}:${'neutral' | 'style-tint'}`;
  type Pipeline = {
    program: WebGLProgram;
    locations: Record<string, WebGLUniformLocation | null>;
    attribute: number;
  };
  let gl: WebGLRenderingContext | null = null,
    buffer: WebGLBuffer | null = null;
  // At most four finite first-party profiles share the document's one context.
  // Switching consumers must not recompile shaders or discard the same source.
  const pipelines = new Map<PipelineKey, Pipeline>();
  let textures: WebGLTexture[] = [];
  const metrics = {
    renders: 0,
    programBuilds: 0,
    sourceUploads: 0,
    sourcePreparations: 0,
    sourcePreparationMilliseconds: 0,
    sourcePreparationCacheHits: 0,
    readbackAllocations: 0,
    readbackMilliseconds: 0,
    contrastMilliseconds: 0,
    renderMilliseconds: 0,
    encodeMilliseconds: 0,
  };
  type SourceIdentity = {
    frame: { deref(): CanvasBackdropFrame | undefined };
    input: WeakSet<Uint8Array>;
    canvas: WeakSet<HTMLCanvasElement>;
    scope: WeakSet<HTMLElement>;
    revision: number;
    width: number;
    height: number;
    byteOffset: number;
  };
  type PreparedSource = { identity: SourceIdentity; pixels: Uint8Array };
  const FrameReference = typeof WeakRef === 'function' ? WeakRef : null;
  // Only retained filtered RGBA bytes are budgeted here, not input, scratch,
  // readback or GPU memory. Tiny sources also need a finite metadata limit.
  // Older hosts retain the existing single strong source slot.
  const preparedEntryLimit = FrameReference ? 4 : 1,
    preparedByteLimit = 4 * 1024 * 1024;
  const prepared: PreparedSource[] = [];
  let preparedBytes = 0;
  let uploaded: {
    source: CanvasBackdropFrame;
    variant: string;
    identity: SourceIdentity;
  } | null = null;
  let readback: Uint8Array | null = null;
  function sourceIdentity(source: CanvasBackdropFrame): SourceIdentity {
    return {
      frame: FrameReference ? new FrameReference(source) : { deref: () => source },
      // Weak membership preserves identity without keeping old DOM nodes or
      // input buffers alive if a caller replaces fields on the same frame.
      input: new WeakSet([source.pixels]),
      canvas: new WeakSet([source.canvas]),
      scope: new WeakSet([source.scope]),
      revision: source.revision,
      width: source.width,
      height: source.height,
      byteOffset: source.pixels.byteOffset,
    };
  }
  function sameSource(identity: SourceIdentity, source: CanvasBackdropFrame) {
    return (
      identity.frame.deref() === source &&
      identity.revision === source.revision &&
      identity.width === source.width &&
      identity.height === source.height &&
      identity.byteOffset === source.pixels.byteOffset &&
      identity.input.has(source.pixels) &&
      identity.canvas.has(source.canvas) &&
      identity.scope.has(source.scope)
    );
  }
  function retirePrepared(index: number) {
    preparedBytes -= prepared[index].pixels.byteLength;
    prepared.splice(index, 1);
  }
  function prunePrepared(source: CanvasBackdropFrame) {
    for (let index = prepared.length - 1; index >= 0; index--) {
      const { identity } = prepared[index],
        previous = identity.frame.deref();
      if (
        !previous ||
        !sameSource(identity, previous) ||
        (identity.canvas.has(source.canvas) &&
          identity.scope.has(source.scope) &&
          identity.revision !== source.revision)
      )
        retirePrepared(index);
    }
  }
  function prepareSource(source: CanvasBackdropFrame): PreparedSource {
    const index = prepared.findIndex((entry) => sameSource(entry.identity, source));
    if (index >= 0) {
      const [entry] = prepared.splice(index, 1);
      prepared.push(entry);
      metrics.sourcePreparationCacheHits++;
      return entry;
    }
    while (
      prepared.length >= preparedEntryLimit ||
      preparedBytes + source.pixels.byteLength > preparedByteLimit
    )
      retirePrepared(0);
    const preparationStarted = performance.now();
    const pixels = prefilter(source.pixels, source.width, source.height);
    metrics.sourcePreparations++;
    metrics.sourcePreparationMilliseconds += performance.now() - preparationStarted;
    const entry = { identity: sourceIdentity(source), pixels };
    prepared.push(entry);
    preparedBytes += pixels.byteLength;
    return entry;
  }
  function clear() {
    canvas.width = 0;
    canvas.height = 0;
    prepared.length = 0;
    preparedBytes = 0;
    uploaded = null;
    readback = null;
    if (!gl) return;
    for (const texture of textures) gl.deleteTexture(texture);
    if (buffer) gl.deleteBuffer(buffer);
    for (const pipeline of pipelines.values()) gl.deleteProgram(pipeline.program);
    pipelines.clear();
    textures = [];
    buffer = null;
  }
  function initialize(contact: boolean, tinted: boolean): Pipeline {
    const key: PipelineKey = `${contact ? 'contact' : 'static'}:${tinted ? 'style-tint' : 'neutral'}`;
    if (gl?.isContextLost()) {
      clear();
      throw new Error('webgl-unavailable');
    }
    const existing = pipelines.get(key);
    if (existing) return existing;
    metrics.programBuilds++;
    gl ??= canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
      antialias: false,
    });
    if (!gl || gl.isContextLost()) throw new Error('webgl-unavailable');
    const g = gl,
      shaders: WebGLShader[] = [];
    let program: WebGLProgram | null = null;
    try {
      for (const [kind, code] of [
        [g.VERTEX_SHADER, vertex],
        [
          g.FRAGMENT_SHADER,
          tinted
            ? contact
              ? styleTintContactFragment
              : styleTintFragment
            : contact
              ? contactFragment
              : fragment,
        ],
      ] as const) {
        const shader = g.createShader(kind);
        if (!shader) throw new Error('shader-allocation');
        shaders.push(shader);
        g.shaderSource(shader, code);
        g.compileShader(shader);
        if (!g.getShaderParameter(shader, g.COMPILE_STATUS)) throw new Error('shader-compilation');
      }
      program = g.createProgram();
      if (!program) throw new Error('program-allocation');
      for (const shader of shaders) g.attachShader(program, shader);
      g.linkProgram(program);
      if (!g.getProgramParameter(program, g.LINK_STATUS)) throw new Error('program-link');
      const locations = Object.fromEntries(
        [
          ...uniformNames,
          'u_contactShape',
          ...(tinted ? ['u_styleTintLightForeground', 'u_styleTintLuminanceBound'] : []),
        ].map((name) => [name, g.getUniformLocation(program!, name)])
      );
      if (!buffer) {
        buffer = g.createBuffer();
        if (!buffer) throw new Error('buffer-allocation');
        g.bindBuffer(g.ARRAY_BUFFER, buffer);
        g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW);
      }
      const attribute = g.getAttribLocation(program, 'a_position');
      if (attribute < 0) throw new Error('position-attribute');
      // These texture bindings/source bytes are shared across programs, while
      // every program keeps its own uniform locations and sampler assignments.
      if (textures.length === 0)
        for (let i = 0; i < 3; i++) {
          const texture = g.createTexture();
          if (!texture) throw new Error('texture-allocation');
          textures.push(texture);
          g.activeTexture(g.TEXTURE0 + i);
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
            new Uint8Array(4)
          );
        }
      const pipeline = { program, locations, attribute };
      pipelines.set(key, pipeline);
      return pipeline;
    } catch (error) {
      if (program) g.deleteProgram(program);
      clear();
      throw error;
    } finally {
      for (const shader of shaders) g.deleteShader(shader);
    }
  }
  return {
    clear,
    inspect: () => ({
      ...metrics,
      sourcePreparationCacheEntries: prepared.length,
      sourcePreparationCacheBytes: preparedBytes,
    }),
    dispose() {
      clear();
      const previous = gl;
      gl = null;
      previous?.getExtension('WEBGL_lose_context')?.loseContext();
    },
    render(frame: OpticalFrame): string {
      const started = performance.now();
      const { source, geometry, pressed, variant } = frame;
      if (frame.tint !== undefined && (frame.tint !== 'style-fill' || variant !== 'regular'))
        throw new Error('style-tint-profile-unavailable');
      const tintEnvelope = frame.tint ? styleTintEnvelope(frame.fill, frame.foreground) : null;
      const outset = geometry.paintOutset ?? 0;
      const width = Math.ceil((geometry.width + 2 * outset) * geometry.dpr),
        height = Math.ceil((geometry.height + 2 * outset) * geometry.dpr);
      if (
        ![width, height, outset, geometry.radius, geometry.dpr, ...geometry.bounds].every(
          Number.isFinite
        ) ||
        outset < 0 ||
        outset > 165 ||
        width < 1 ||
        height < 1 ||
        width > 2048 ||
        height > 2048 ||
        width * height > 1048576 ||
        geometry.dpr < 0.5 ||
        geometry.dpr > 3
      )
        throw new Error('optical-geometry-budget');
      if (
        geometry.bounds[0] < 0 ||
        geometry.bounds[1] < 0 ||
        geometry.bounds[2] <= 0 ||
        geometry.bounds[3] <= 0 ||
        geometry.bounds[0] + geometry.bounds[2] > 1 ||
        geometry.bounds[1] + geometry.bounds[3] > 1
      )
        throw new Error('optical-source-bounds');
      if (
        !Number.isInteger(source.width) ||
        !Number.isInteger(source.height) ||
        source.width < 1 ||
        source.height < 1 ||
        source.width > 2048 ||
        source.height > 2048 ||
        source.width * source.height > 1048576 ||
        !(source.pixels instanceof Uint8Array) ||
        source.pixels.length !== source.width * source.height * 4
      )
        throw new Error('invalid-optical-source');
      for (let i = 3; i < source.pixels.length; i += 4)
        if (source.pixels[i] !== 255) throw new Error('nonopaque-optical-source');
      const contact = frame.contact;
      if (
        contact &&
        ![contact.x, contact.y, contact.deltaX, contact.deltaY, contact.strength].every(
          Number.isFinite
        )
      )
        throw new Error('invalid-optical-contact');
      const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
      const strength = contact ? clamp(contact.strength, 0, 1) : pressed ? 1 : 0;
      const blend = (rest: number, held: number) =>
        strength === 1 ? held : rest + (held - rest) * strength;
      const pipeline = initialize(!!contact, !!frame.tint),
        { locations } = pipeline,
        g = gl!;
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      g.viewport(0, 0, width, height);
      g.useProgram(pipeline.program);
      g.bindBuffer(g.ARRAY_BUFFER, buffer);
      g.enableVertexAttribArray(pipeline.attribute);
      g.vertexAttribPointer(pipeline.attribute, 2, g.FLOAT, false, 0, 0);
      g.activeTexture(g.TEXTURE0);
      g.bindTexture(g.TEXTURE_2D, textures[0]);
      g.pixelStorei(g.UNPACK_ALIGNMENT, 1);
      // Run after every admission guard, including the full source alpha scan.
      // Clear frames must also retire older revisions of their canvas/scope.
      prunePrepared(source);
      const currentPrepared = variant === 'regular' ? prepareSource(source) : null;
      if (
        uploaded?.source !== source ||
        uploaded.variant !== variant ||
        !sameSource(uploaded.identity, source)
      ) {
        g.texImage2D(
          g.TEXTURE_2D,
          0,
          g.RGBA,
          source.width,
          source.height,
          0,
          g.RGBA,
          g.UNSIGNED_BYTE,
          currentPrepared ? currentPrepared.pixels : source.pixels
        );
        // This still tracks only the texture currently bound to the one context.
        uploaded = {
          source,
          variant,
          identity: currentPrepared?.identity ?? sourceIdentity(source),
        };
        metrics.sourceUploads++;
      }
      const f = (name: string, value: number) => g.uniform1f(locations[name], value),
        i = (name: string, value: number) => g.uniform1i(locations[name], value);
      const v2 = (name: string, value: number[]) => g.uniform2fv(locations[name], value),
        v4 = (name: string, value: number[]) => g.uniform4fv(locations[name], value);
      i('u_tex', 0);
      v2('u_resolution', [width, height]);
      v2('u_textureResolution', [source.width, source.height]);
      v4('u_bounds', geometry.bounds);
      f('u_refraction', diagnostic === 'zero-refraction' ? 0 : blend(0.008, 0.018));
      f(
        'u_aberration',
        contact && diagnostic !== 'zero-refraction' && diagnostic !== 'zero-aberration'
          ? 0.12 + 0.18 * strength
          : 0
      );
      f('u_bevelDepth', diagnostic === 'zero-refraction' ? 0 : blend(0.06, 0.12));
      f('u_bevelWidth', 0.22);
      f('u_frost', 0);
      f('u_radius', Math.min(geometry.radius * geometry.dpr, width / 2, height / 2));
      f('u_time', 0);
      // Preserve the #809 fixed regular profile. Its inherited reversed-edge
      // smoothstep requires exact-engine visual evidence; no cross-engine or
      // language equivalence follows from retaining these original bytes.
      i('u_specular', 1);
      f('u_revealProgress', 1);
      i('u_revealType', 0);
      f('u_tiltX', 0);
      f('u_tiltY', 0);
      f('u_magnify', diagnostic === 'zero-refraction' ? 1 : blend(1.025, 1.08));
      v2('u_subpixel', [outset * geometry.dpr, outset * geometry.dpr]);
      v2('u_boxSize', [geometry.width * geometry.dpr, geometry.height * geometry.dpr]);
      const dark = frame.foreground[0] + frame.foreground[1] + frame.foreground[2] > 1.5;
      v4(
        'u_tint',
        frame.tint
          ? [...frame.fill]
          : dark
            ? [0.45, 0.45, 0.48, variant === 'clear' ? 0.35 : 0.65]
            : [1.05, 1.05, 1.06, variant === 'clear' ? 0.15 : 0.45]
      );
      if (tintEnvelope) {
        f('u_styleTintLightForeground', tintEnvelope.lightForeground ? 1 : 0);
        f('u_styleTintLuminanceBound', tintEnvelope.luminanceBound);
      }
      i('u_stack', 1);
      v4('u_stackMapping', [0, 0, 0, 0]);
      v4('u_stackRegion', [0, 0, 0, 0]);
      f('u_contactShape', contact && diagnostic !== 'zero-deformation' ? strength : 0);
      v4(
        'u_interaction',
        contact
          ? [
              clamp(contact.x, 0, 1),
              clamp(contact.y, 0, 1),
              clamp(contact.deltaX, -1, 1) *
                0.055 *
                (diagnostic === 'zero-deformation' ? 0 : strength),
              clamp(contact.deltaY, -1, 1) *
                0.055 *
                (diagnostic === 'zero-deformation' ? 0 : strength),
            ]
          : [0.5, 0.5, 0, 0]
      );
      f('u_interactionRadius', contact ? 0.8 * strength : 0);
      i('u_shadow', 2);
      v4('u_shadowMapping', [0, 0, 0, 0]);
      g.clearColor(0, 0, 0, 0);
      g.clear(g.COLOR_BUFFER_BIT);
      g.disable(g.BLEND);
      g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
      // readPixels is the required synchronization point; a preceding finish
      // needlessly blocks the main thread a second time.
      if (g.getError() !== g.NO_ERROR || g.isContextLost()) {
        clear();
        throw new Error('gpu-frame-failed');
      }
      const readbackStarted = performance.now();
      if (readback?.length !== width * height * 4) {
        readback = new Uint8Array(width * height * 4);
        metrics.readbackAllocations++;
      }
      const pixels = readback;
      g.readPixels(0, 0, width, height, g.RGBA, g.UNSIGNED_BYTE, pixels);
      metrics.readbackMilliseconds += performance.now() - readbackStarted;
      if (g.getError() !== g.NO_ERROR || g.isContextLost()) {
        clear();
        throw new Error('gpu-readback-failed');
      }
      const contrastStarted = performance.now();
      const foregroundLuminance = luminance(tintEnvelope?.worstForeground ?? frame.foreground);
      let opaqueSamples = 0;
      for (let at = 0; at < pixels.length; at += 4) {
        const alpha = pixels[at + 3];
        if (alpha === 255) opaqueSamples++;
        if (alpha < 250) continue;
        const red = pixels[at],
          green = pixels[at + 1],
          blue = pixels[at + 2];
        const blackLuminance =
          linearBytes[red] * 0.2126 + linearBytes[green] * 0.7152 + linearBytes[blue] * 0.0722;
        if (contrast(blackLuminance, foregroundLuminance) < 4.5)
          throw new Error('rendered-contrast-unsafe');
        if (tintEnvelope) {
          // The shader writes premultiplied RGB. Near-opaque AA must be safe
          // after composition, not merely when its raw channels look darker.
          // Black/white bound every backdrop, including alpha 255. Use the
          // same worst semantic foreground as the current frame's bound uniform.
          if (foregroundLuminance > blackLuminance !== tintEnvelope.lightForeground)
            throw new Error('rendered-contrast-unsafe');
          if (alpha < 255) {
            const table = linearOverWhite[alpha - 250];
            const whiteLuminance =
              table[red] * 0.2126 + table[green] * 0.7152 + table[blue] * 0.0722;
            if (
              !Number.isFinite(whiteLuminance) ||
              contrast(whiteLuminance, foregroundLuminance) < 4.5 ||
              foregroundLuminance > whiteLuminance !== tintEnvelope.lightForeground
            )
              throw new Error('rendered-contrast-unsafe');
          }
        }
      }
      metrics.contrastMilliseconds += performance.now() - contrastStarted;
      if (frame.tint && opaqueSamples === 0) throw new Error('rendered-style-tint-empty');
      const encoding = performance.now();
      const result = canvas.toDataURL('image/png');
      metrics.renders++;
      metrics.encodeMilliseconds += performance.now() - encoding;
      metrics.renderMilliseconds += performance.now() - started;
      if (!result.startsWith('data:image/png;base64,'))
        throw new Error('optical-image-unavailable');
      return result;
    },
  };
}
function prefilter(pixels: Uint8Array, width: number, height: number): Uint8Array {
  const scratch = new Uint8Array(pixels.length),
    output = new Uint8Array(pixels.length),
    row = width * 4;
  // Clamp horizontal neighbors once per column, rather than for every tap and
  // row. Integer sums are at most 255 * 64, so regrouping symmetric taps and
  // rounding with +32 >> 6 preserves both original rounded passes exactly.
  const offsets = new Int32Array(width * 6);
  for (let x = 0; x < width; x++) {
    let at = x * 6;
    for (let k = -3; k < 0; k++) offsets[at++] = Math.max(0, x + k) * 4;
    for (let k = 1; k <= 3; k++) offsets[at++] = Math.min(width - 1, x + k) * 4;
  }
  for (let y = 0; y < height; y++) {
    const base = y * row;
    for (let x = 0; x < width; x++) {
      const at = base + x * 4,
        offset = x * 6,
        a = base + offsets[offset],
        b = base + offsets[offset + 1],
        c = base + offsets[offset + 2],
        d = base + offsets[offset + 3],
        e = base + offsets[offset + 4],
        f = base + offsets[offset + 5];
      for (let channel = 0; channel < 3; channel++) {
        scratch[at + channel] =
          (pixels[a + channel] +
            pixels[f + channel] +
            6 * (pixels[b + channel] + pixels[e + channel]) +
            15 * (pixels[c + channel] + pixels[d + channel]) +
            20 * pixels[at + channel] +
            32) >>>
          6;
      }
      scratch[at + 3] = 255;
    }
  }
  for (let y = 0; y < height; y++) {
    const base = y * row,
      a = Math.max(0, y - 3) * row,
      b = Math.max(0, y - 2) * row,
      c = Math.max(0, y - 1) * row,
      d = Math.min(height - 1, y + 1) * row,
      e = Math.min(height - 1, y + 2) * row,
      f = Math.min(height - 1, y + 3) * row;
    for (let x = 0; x < row; x += 4) {
      const at = base + x;
      for (let channel = 0; channel < 3; channel++) {
        const offset = x + channel;
        output[at + channel] =
          (scratch[a + offset] +
            scratch[f + offset] +
            6 * (scratch[b + offset] + scratch[e + offset]) +
            15 * (scratch[c + offset] + scratch[d + offset]) +
            20 * scratch[at + channel] +
            32) >>>
          6;
      }
      output[at + 3] = 255;
    }
  }
  return output;
}
