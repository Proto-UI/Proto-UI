import { vertex, fragment, uniformNames } from './liquidgl-kernel.generated';
import { colorContrast, type OpaqueRgba } from './style';
import type { CanvasBackdropFrame } from './source';

export type OpticalGeometry = {
  width: number;
  height: number;
  radius: number;
  dpr: number;
  bounds: [number, number, number, number];
};
export type OpticalFrame = {
  source: CanvasBackdropFrame;
  geometry: OpticalGeometry;
  pressed: boolean;
  variant: 'regular' | 'clear';
  fill: OpaqueRgba;
  foreground: OpaqueRgba;
};
/** First-party finite V2 host profile. No author uniforms, Button state binding,
 * source acquisition, or reinterpretation of the historical v1 compiler. */
export function createWebOpticalProgram(
  canvas: HTMLCanvasElement,
  diagnostic: 'zero-refraction' | null = null
) {
  let gl: WebGLRenderingContext | null = null,
    pipeline: WebGLProgram | null = null,
    buffer: WebGLBuffer | null = null;
  let textures: WebGLTexture[] = [],
    locations: Record<string, WebGLUniformLocation | null> = {};
  const metrics = {
    renders: 0,
    programBuilds: 0,
    sourceUploads: 0,
    sourcePreparations: 0,
    renderMilliseconds: 0,
    encodeMilliseconds: 0,
  };
  let uploaded: { source: CanvasBackdropFrame; variant: string } | null = null;
  let prepared: { source: CanvasBackdropFrame; pixels: Uint8Array } | null = null;
  function clear() {
    canvas.width = 0;
    canvas.height = 0;
    prepared = null;
    uploaded = null;
    if (!gl) return;
    for (const texture of textures) gl.deleteTexture(texture);
    if (buffer) gl.deleteBuffer(buffer);
    if (pipeline) gl.deleteProgram(pipeline);
    textures = [];
    buffer = null;
    pipeline = null;
    locations = {};
  }
  function initialize() {
    if (pipeline) return;
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
    try {
      for (const [kind, code] of [
        [g.VERTEX_SHADER, vertex],
        [g.FRAGMENT_SHADER, fragment],
      ] as const) {
        const shader = g.createShader(kind);
        if (!shader) throw new Error('shader-allocation');
        shaders.push(shader);
        g.shaderSource(shader, code);
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
        uniformNames.map((name) => [name, g.getUniformLocation(pipeline!, name)])
      );
      buffer = g.createBuffer();
      if (!buffer) throw new Error('buffer-allocation');
      g.bindBuffer(g.ARRAY_BUFFER, buffer);
      g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW);
      const attribute = g.getAttribLocation(pipeline, 'a_position');
      if (attribute < 0) throw new Error('position-attribute');
      g.enableVertexAttribArray(attribute);
      g.vertexAttribPointer(attribute, 2, g.FLOAT, false, 0, 0);
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
        g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, 1, 1, 0, g.RGBA, g.UNSIGNED_BYTE, new Uint8Array(4));
      }
    } catch (error) {
      clear();
      throw error;
    } finally {
      for (const shader of shaders) g.deleteShader(shader);
    }
  }
  return {
    clear,
    inspect: () => ({ ...metrics }),
    dispose() {
      clear();
      const previous = gl;
      gl = null;
      previous?.getExtension('WEBGL_lose_context')?.loseContext();
    },
    render(frame: OpticalFrame): string {
      const started = performance.now();
      const { source, geometry, pressed, variant } = frame;
      const width = Math.ceil(geometry.width * geometry.dpr),
        height = Math.ceil(geometry.height * geometry.dpr);
      if (
        ![width, height, geometry.radius, geometry.dpr, ...geometry.bounds].every(
          Number.isFinite
        ) ||
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
      initialize();
      const g = gl!;
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      g.viewport(0, 0, width, height);
      g.useProgram(pipeline);
      g.activeTexture(g.TEXTURE0);
      g.bindTexture(g.TEXTURE_2D, textures[0]);
      g.pixelStorei(g.UNPACK_ALIGNMENT, 1);
      if (variant === 'regular' && prepared?.source !== source) {
        prepared = { source, pixels: prefilter(source.pixels, source.width, source.height) };
        metrics.sourcePreparations++;
      }
      if (uploaded?.source !== source || uploaded.variant !== variant) {
        g.texImage2D(
          g.TEXTURE_2D,
          0,
          g.RGBA,
          source.width,
          source.height,
          0,
          g.RGBA,
          g.UNSIGNED_BYTE,
          variant === 'regular' ? prepared!.pixels : source.pixels
        );
        uploaded = { source, variant };
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
      f('u_refraction', diagnostic === 'zero-refraction' ? 0 : pressed ? 0.018 : 0.008);
      f('u_aberration', 0);
      f('u_bevelDepth', diagnostic === 'zero-refraction' ? 0 : pressed ? 0.12 : 0.06);
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
      f('u_magnify', diagnostic === 'zero-refraction' ? 1 : pressed ? 1.08 : 1.025);
      v2('u_subpixel', [0, 0]);
      v2('u_boxSize', [geometry.width * geometry.dpr, geometry.height * geometry.dpr]);
      const dark = frame.foreground[0] + frame.foreground[1] + frame.foreground[2] > 1.5;
      v4(
        'u_tint',
        dark
          ? [0.45, 0.45, 0.48, variant === 'clear' ? 0.35 : 0.65]
          : [1.05, 1.05, 1.06, variant === 'clear' ? 0.15 : 0.45]
      );
      i('u_stack', 1);
      v4('u_stackMapping', [0, 0, 0, 0]);
      v4('u_stackRegion', [0, 0, 0, 0]);
      v4('u_interaction', [0.5, 0.5, 0, 0]);
      f('u_interactionRadius', 0);
      i('u_shadow', 2);
      v4('u_shadowMapping', [0, 0, 0, 0]);
      g.clearColor(0, 0, 0, 0);
      g.clear(g.COLOR_BUFFER_BIT);
      g.disable(g.BLEND);
      g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
      g.finish();
      if (g.getError() !== g.NO_ERROR || g.isContextLost()) throw new Error('gpu-frame-failed');
      const pixels = new Uint8Array(width * height * 4);
      g.readPixels(0, 0, width, height, g.RGBA, g.UNSIGNED_BYTE, pixels);
      if (g.getError() !== g.NO_ERROR) throw new Error('gpu-readback-failed');
      for (let at = 0; at < pixels.length; at += 4)
        if (
          pixels[at + 3] >= 250 &&
          colorContrast(
            [pixels[at] / 255, pixels[at + 1] / 255, pixels[at + 2] / 255, 1],
            frame.foreground
          ) < 4.5
        )
          throw new Error('rendered-contrast-unsafe');
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
  const weights = [1, 6, 15, 20, 15, 6, 1],
    scratch = new Uint8Array(pixels.length),
    output = new Uint8Array(pixels.length);
  for (let pass = 0; pass < 2; pass++) {
    const input = pass ? scratch : pixels,
      target = pass ? output : scratch;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const at = (y * width + x) * 4;
        for (let channel = 0; channel < 3; channel++) {
          let sum = 0;
          for (let k = -3; k <= 3; k++)
            sum +=
              input[
                (Math.max(0, Math.min(height - 1, y + (pass ? k : 0))) * width +
                  Math.max(0, Math.min(width - 1, x + (pass ? 0 : k)))) *
                  4 +
                  channel
              ] * weights[k + 3];
          target[at + channel] = Math.round(sum / 64);
        }
        target[at + 3] = 255;
      }
  }
  return output;
}
