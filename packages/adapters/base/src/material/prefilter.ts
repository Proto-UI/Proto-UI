/** Private, byte-preserving source preparation. This is not a material shader or
 * a new source provider: the ordinary optical program still owns source admission,
 * final rendered-pixel safety, PNG delivery and its original optical profiles. */
const vertex = `
precision highp float;
attribute highp vec2 a_position;
varying highp vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;
const fragment = `
precision highp float;
uniform highp sampler2D u_source;
uniform highp vec2 u_size;
uniform highp vec2 u_step;
varying highp vec2 v_uv;
vec3 bytesAt(float offset) {
  vec2 center = floor(v_uv * u_size) + 0.5;
  vec2 uv = (center + offset * u_step) / u_size;
  return floor(texture2D(u_source, uv).rgb * 255.0 + 0.5);
}
void main() {
  vec3 sum = bytesAt(-3.0) + bytesAt(3.0)
    + 6.0 * (bytesAt(-2.0) + bytesAt(2.0))
    + 15.0 * (bytesAt(-1.0) + bytesAt(1.0))
    + 20.0 * bytesAt(0.0);
  gl_FragColor = vec4(floor((sum + 32.0) / 64.0) / 255.0, 1.0);
}
`;

export type WebOpticalPrefilter = {
  /** Input and readback rows retain the TypedArray/GL order; no Y flip.
   * Each result owns a distinct LINEAR texture until release or dispose. The
   * program's prepared-source cache bounds retained results to four / 4 MiB.
   * Each pass separately rounds into RGBA8. This submits work, not a GPU timer. */
  filter(
    pixels: Uint8Array,
    width: number,
    height: number
  ): {
    texture: WebGLTexture;
    release(): void;
  };
  dispose(): void;
};

/** Use the CPU reference when a context cannot establish exact integer
 * arithmetic and isolated vertex state. No resource is allocated on that path. */
export function createWebOpticalPrefilter(g: WebGLRenderingContext): WebOpticalPrefilter | null {
  if (g.isContextLost()) throw new Error('webgl-unavailable');
  const precision = g.getShaderPrecisionFormat?.(g.FRAGMENT_SHADER, g.HIGH_FLOAT);
  if (
    !precision ||
    !Number.isInteger(precision.precision) ||
    precision.precision < 23 ||
    !Number.isInteger(precision.rangeMin) ||
    !Number.isInteger(precision.rangeMax) ||
    precision.rangeMin < 14 ||
    precision.rangeMax < 14
  )
    return null;
  // WebGL 1 cannot reset an attribute's buffer pointer to its initial null value.
  // A private VAO makes state restoration exact even on a previously unused GL.
  const arrays = g.getExtension('OES_vertex_array_object');
  if (!arrays) return null;

  let program: WebGLProgram | null = null;
  let buffer: WebGLBuffer | null = null;
  let framebuffer: WebGLFramebuffer | null = null;
  let array: WebGLVertexArrayObjectOES | null = null;
  const shaders: WebGLShader[] = [];
  const textures: WebGLTexture[] = [];
  const outputs = new Set<WebGLTexture>();
  let disposed = false;
  let storedWidth = 0;
  let storedHeight = 0;
  const switches = [
    g.BLEND,
    g.DITHER,
    g.SCISSOR_TEST,
    g.DEPTH_TEST,
    g.STENCIL_TEST,
    g.CULL_FACE,
    g.SAMPLE_COVERAGE,
    g.SAMPLE_ALPHA_TO_COVERAGE,
  ];
  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const texture of outputs) g.deleteTexture(texture);
    outputs.clear();
    for (const texture of textures) g.deleteTexture(texture);
    if (framebuffer) g.deleteFramebuffer(framebuffer);
    if (buffer) g.deleteBuffer(buffer);
    if (array) arrays!.deleteVertexArrayOES(array);
    if (program) g.deleteProgram(program);
    textures.length = 0;
    framebuffer = null;
    buffer = null;
    array = null;
    program = null;
  }
  // Keep the result closure separate from filter's pixel/source arguments, so
  // retaining a texture never also retains the caller's source byte view.
  function ownOutput(texture: WebGLTexture) {
    outputs.add(texture);
    return {
      texture,
      release() {
        if (outputs.delete(texture)) g.deleteTexture(texture);
      },
    };
  }
  function checked() {
    if (g.isContextLost()) throw new Error('webgl-unavailable');
    if (g.getError() !== g.NO_ERROR) throw new Error('gpu-prefilter-failed');
  }
  function withState<T>(operation: () => T): T {
    const state = {
      activeTexture: g.getParameter(g.ACTIVE_TEXTURE) as number,
      program: g.getParameter(g.CURRENT_PROGRAM) as WebGLProgram | null,
      buffer: g.getParameter(g.ARRAY_BUFFER_BINDING) as WebGLBuffer | null,
      framebuffer: g.getParameter(g.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null,
      array: g.getParameter(arrays!.VERTEX_ARRAY_BINDING_OES) as WebGLVertexArrayObjectOES | null,
      viewport: g.getParameter(g.VIEWPORT) as Int32Array,
      colorMask: g.getParameter(g.COLOR_WRITEMASK) as boolean[],
      alignment: g.getParameter(g.UNPACK_ALIGNMENT) as number,
      flipY: g.getParameter(g.UNPACK_FLIP_Y_WEBGL) as boolean,
      premultiply: g.getParameter(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL) as boolean,
      enabled: switches.map((capability) => g.isEnabled(capability)),
    };
    g.activeTexture(g.TEXTURE0);
    const texture = g.getParameter(g.TEXTURE_BINDING_2D) as WebGLTexture | null;
    try {
      return operation();
    } finally {
      // Lost contexts discard their state; restoration cannot resurrect them.
      if (!g.isContextLost()) {
        g.bindFramebuffer(g.FRAMEBUFFER, state.framebuffer);
        g.viewport(state.viewport[0], state.viewport[1], state.viewport[2], state.viewport[3]);
        g.colorMask(state.colorMask[0], state.colorMask[1], state.colorMask[2], state.colorMask[3]);
        switches.forEach((capability, index) =>
          state.enabled[index] ? g.enable(capability) : g.disable(capability)
        );
        arrays!.bindVertexArrayOES(state.array);
        g.bindBuffer(g.ARRAY_BUFFER, state.buffer);
        g.useProgram(state.program);
        g.pixelStorei(g.UNPACK_ALIGNMENT, state.alignment);
        g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, state.flipY);
        g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL, state.premultiply);
        g.activeTexture(g.TEXTURE0);
        g.bindTexture(g.TEXTURE_2D, texture);
        g.activeTexture(state.activeTexture);
      }
    }
  }

  try {
    for (const [kind, code] of [
      [g.VERTEX_SHADER, vertex],
      [g.FRAGMENT_SHADER, fragment],
    ] as const) {
      const shader = g.createShader(kind);
      if (!shader) throw new Error('gpu-prefilter-shader-allocation');
      shaders.push(shader);
      g.shaderSource(shader, code);
      g.compileShader(shader);
      if (!g.getShaderParameter(shader, g.COMPILE_STATUS))
        throw new Error('gpu-prefilter-shader-compilation');
    }
    program = g.createProgram();
    if (!program) throw new Error('gpu-prefilter-program-allocation');
    for (const shader of shaders) g.attachShader(program, shader);
    g.bindAttribLocation(program, 0, 'a_position');
    g.linkProgram(program);
    if (!g.getProgramParameter(program, g.LINK_STATUS))
      throw new Error('gpu-prefilter-program-link');
    const sampler = g.getUniformLocation(program, 'u_source');
    const size = g.getUniformLocation(program, 'u_size');
    const step = g.getUniformLocation(program, 'u_step');
    if (sampler === null || size === null || step === null)
      throw new Error('gpu-prefilter-uniform-unavailable');
    buffer = g.createBuffer();
    if (!buffer) throw new Error('gpu-prefilter-buffer-allocation');
    framebuffer = g.createFramebuffer();
    if (!framebuffer) throw new Error('gpu-prefilter-framebuffer-allocation');
    array = arrays.createVertexArrayOES();
    if (!array) throw new Error('gpu-prefilter-array-allocation');
    withState(() => {
      arrays.bindVertexArrayOES(array);
      g.bindBuffer(g.ARRAY_BUFFER, buffer);
      g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW);
      g.enableVertexAttribArray(0);
      g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0);
      for (let index = 0; index < 2; index++) {
        const texture = g.createTexture();
        if (!texture) throw new Error('gpu-prefilter-texture-allocation');
        textures.push(texture);
        g.bindTexture(g.TEXTURE_2D, texture);
        // Only raw and first-pass input are sampled by the byte prefilter.
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.NEAREST);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.NEAREST);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
      }
      checked();
    });

    return {
      dispose,
      filter(pixels, width, height) {
        if (disposed) throw new Error('gpu-prefilter-disposed');
        if (g.isContextLost()) {
          dispose();
          throw new Error('webgl-unavailable');
        }
        if (
          !Number.isInteger(width) ||
          !Number.isInteger(height) ||
          width < 1 ||
          height < 1 ||
          width > 2048 ||
          height > 2048 ||
          width * height > 1048576 ||
          !(pixels instanceof Uint8Array) ||
          pixels.length !== width * height * 4
        )
          throw new Error('invalid-optical-source');
        for (let at = 3; at < pixels.length; at += 4)
          if (pixels[at] !== 255) throw new Error('nonopaque-optical-source');
        try {
          return withState(() => {
            for (const capability of switches) g.disable(capability);
            g.colorMask(true, true, true, true);
            g.pixelStorei(g.UNPACK_ALIGNMENT, 1);
            g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false);
            g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
            if (storedWidth !== width || storedHeight !== height) {
              for (const texture of textures) {
                g.bindTexture(g.TEXTURE_2D, texture);
                g.texImage2D(
                  g.TEXTURE_2D,
                  0,
                  g.RGBA,
                  width,
                  height,
                  0,
                  g.RGBA,
                  g.UNSIGNED_BYTE,
                  null
                );
              }
              storedWidth = width;
              storedHeight = height;
            }
            g.bindTexture(g.TEXTURE_2D, textures[0]);
            g.texSubImage2D(g.TEXTURE_2D, 0, 0, 0, width, height, g.RGBA, g.UNSIGNED_BYTE, pixels);
            const texture = g.createTexture();
            if (!texture) throw new Error('gpu-prefilter-output-allocation');
            const output = ownOutput(texture);
            g.bindTexture(g.TEXTURE_2D, texture);
            // Every retained source owns its own output; later source updates
            // only reuse the two working textures, never a cached result.
            g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
            g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
            g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
            g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
            g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, width, height, 0, g.RGBA, g.UNSIGNED_BYTE, null);
            g.bindFramebuffer(g.FRAMEBUFFER, framebuffer);
            g.viewport(0, 0, width, height);
            g.useProgram(program);
            arrays.bindVertexArrayOES(array);
            g.uniform1i(sampler, 0);
            g.uniform2f(size, width, height);
            try {
              for (let pass = 0; pass < 2; pass++) {
                g.bindTexture(g.TEXTURE_2D, textures[pass]);
                g.framebufferTexture2D(
                  g.FRAMEBUFFER,
                  g.COLOR_ATTACHMENT0,
                  g.TEXTURE_2D,
                  pass === 0 ? textures[1] : texture,
                  0
                );
                if (g.checkFramebufferStatus(g.FRAMEBUFFER) !== g.FRAMEBUFFER_COMPLETE)
                  throw new Error('gpu-prefilter-framebuffer-incomplete');
                g.uniform2f(step, pass === 0 ? 1 : 0, pass === 0 ? 0 : 1);
                g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
                checked();
              }
              return output;
            } finally {
              // A detached private FBO cannot keep an evicted output alive.
              // Detach before withState restores the caller's framebuffer.
              if (!g.isContextLost())
                g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, null, 0);
            }
          });
        } catch (error) {
          dispose();
          throw error;
        }
      },
    };
  } catch (error) {
    dispose();
    throw error;
  } finally {
    for (const shader of shaders) g.deleteShader(shader);
  }
}
