import { describe, expect, it, vi } from 'vitest';
import { createWebOpticalPrefilter } from '../src/material/prefilter';

// This GL state machine checks ownership and call order, never GPU pixels. The
// native browser probe independently compares real readback against the scalar
// seven-tap reference, without a tolerance or a replacement production shader.
function fixture() {
  const names = [
    'VERTEX_SHADER',
    'FRAGMENT_SHADER',
    'HIGH_FLOAT',
    'COMPILE_STATUS',
    'LINK_STATUS',
    'ARRAY_BUFFER',
    'ARRAY_BUFFER_BINDING',
    'STATIC_DRAW',
    'FLOAT',
    'FRAMEBUFFER',
    'FRAMEBUFFER_BINDING',
    'FRAMEBUFFER_COMPLETE',
    'COLOR_ATTACHMENT0',
    'CURRENT_PROGRAM',
    'TEXTURE0',
    'ACTIVE_TEXTURE',
    'TEXTURE_2D',
    'TEXTURE_BINDING_2D',
    'TEXTURE_MIN_FILTER',
    'TEXTURE_MAG_FILTER',
    'TEXTURE_WRAP_S',
    'TEXTURE_WRAP_T',
    'NEAREST',
    'LINEAR',
    'CLAMP_TO_EDGE',
    'VIEWPORT',
    'COLOR_WRITEMASK',
    'UNPACK_ALIGNMENT',
    'UNPACK_FLIP_Y_WEBGL',
    'UNPACK_PREMULTIPLY_ALPHA_WEBGL',
    'BLEND',
    'DITHER',
    'SCISSOR_TEST',
    'DEPTH_TEST',
    'STENCIL_TEST',
    'CULL_FACE',
    'SAMPLE_COVERAGE',
    'SAMPLE_ALPHA_TO_COVERAGE',
    'RGBA',
    'UNSIGNED_BYTE',
    'TRIANGLE_STRIP',
  ];
  const gl: any = Object.fromEntries(names.map((name, index) => [name, index + 100]));
  gl.NO_ERROR = 0;
  const arrayBinding = 999;
  const state = new Map<number, any>([
    [gl.ACTIVE_TEXTURE, gl.TEXTURE0 + 3],
    [gl.CURRENT_PROGRAM, { host: 'program' }],
    [gl.ARRAY_BUFFER_BINDING, { host: 'buffer' }],
    [gl.FRAMEBUFFER_BINDING, { host: 'framebuffer' }],
    [arrayBinding, { host: 'array' }],
    [gl.VIEWPORT, new Int32Array([5, 8, 12, 9])],
    [gl.COLOR_WRITEMASK, [false, true, false, true]],
    [gl.UNPACK_ALIGNMENT, 8],
    [gl.UNPACK_FLIP_Y_WEBGL, true],
    [gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true],
  ]);
  const textureBindings = new Map<number, unknown>([
    [gl.TEXTURE0, { host: 'texture0' }],
    [gl.TEXTURE0 + 3, { host: 'texture3' }],
  ]);
  const enabled = new Set<number>([gl.BLEND, gl.DITHER, gl.SCISSOR_TEST, gl.SAMPLE_COVERAGE]);
  const attachments = new Map<unknown, unknown>();
  const uniforms = new Map<string, unknown>();
  const draws: any[] = [];
  let nextResource = 0;
  for (const kind of ['Shader', 'Program', 'Buffer', 'Framebuffer', 'Texture']) {
    gl[`create${kind}`] = vi.fn(() => ({ kind, id: ++nextResource }));
    gl[`delete${kind}`] = vi.fn();
  }
  const arrays = {
    VERTEX_ARRAY_BINDING_OES: arrayBinding,
    createVertexArrayOES: vi.fn(() => ({ kind: 'Array', id: ++nextResource })),
    deleteVertexArrayOES: vi.fn(),
    bindVertexArrayOES: vi.fn((array) => state.set(arrayBinding, array)),
  };
  gl.isContextLost = vi.fn(() => false);
  gl.getShaderPrecisionFormat = vi.fn(() => ({ precision: 23, rangeMin: 127, rangeMax: 127 }));
  gl.getExtension = vi.fn((name) => (name === 'OES_vertex_array_object' ? arrays : null));
  gl.getShaderParameter = vi.fn(() => true);
  gl.getProgramParameter = vi.fn(() => true);
  gl.getUniformLocation = vi.fn((_program, name) => ({ name }));
  gl.getError = vi.fn(() => 0);
  gl.getParameter = vi.fn((name) =>
    name === gl.TEXTURE_BINDING_2D
      ? (textureBindings.get(state.get(gl.ACTIVE_TEXTURE)) ?? null)
      : state.get(name)
  );
  gl.isEnabled = vi.fn((name) => enabled.has(name));
  gl.enable = vi.fn((name) => enabled.add(name));
  gl.disable = vi.fn((name) => enabled.delete(name));
  gl.activeTexture = vi.fn((unit) => state.set(gl.ACTIVE_TEXTURE, unit));
  gl.bindTexture = vi.fn((_target, texture) =>
    textureBindings.set(state.get(gl.ACTIVE_TEXTURE), texture)
  );
  gl.bindFramebuffer = vi.fn((_target, framebuffer) =>
    state.set(gl.FRAMEBUFFER_BINDING, framebuffer)
  );
  gl.bindBuffer = vi.fn((_target, buffer) => state.set(gl.ARRAY_BUFFER_BINDING, buffer));
  gl.useProgram = vi.fn((program) => state.set(gl.CURRENT_PROGRAM, program));
  gl.viewport = vi.fn((...values) => state.set(gl.VIEWPORT, new Int32Array(values)));
  gl.colorMask = vi.fn((...values) => state.set(gl.COLOR_WRITEMASK, values));
  gl.pixelStorei = vi.fn((name, value) => state.set(name, value));
  gl.uniform1i = vi.fn((location, value) => uniforms.set(location.name, value));
  gl.uniform2f = vi.fn((location, x, y) => uniforms.set(location.name, [x, y]));
  gl.framebufferTexture2D = vi.fn((_target, _attachment, _textureTarget, texture) =>
    attachments.set(state.get(gl.FRAMEBUFFER_BINDING), texture)
  );
  gl.checkFramebufferStatus = vi.fn(() => gl.FRAMEBUFFER_COMPLETE);
  gl.drawArrays = vi.fn(() =>
    draws.push({
      texture: textureBindings.get(gl.TEXTURE0),
      target: attachments.get(state.get(gl.FRAMEBUFFER_BINDING)),
      program: state.get(gl.CURRENT_PROGRAM),
      array: state.get(arrayBinding),
      viewport: state.get(gl.VIEWPORT),
      colorMask: state.get(gl.COLOR_WRITEMASK),
      enabled: [...enabled],
      uniforms: new Map(uniforms),
    })
  );
  for (const name of [
    'shaderSource',
    'compileShader',
    'attachShader',
    'bindAttribLocation',
    'linkProgram',
    'bufferData',
    'enableVertexAttribArray',
    'vertexAttribPointer',
    'texParameteri',
    'texImage2D',
    'texSubImage2D',
    'readPixels',
    'finish',
  ])
    gl[name] = vi.fn();
  const snapshot = () => ({
    state: new Map(state),
    textures: new Map(textureBindings),
    enabled: new Set(enabled),
  });
  const pixels = (width = 7, height = 5) => {
    const output = new Uint8Array(width * height * 4);
    for (let at = 0; at < output.length; at++) output[at] = at % 4 === 3 ? 255 : at % 256;
    return output;
  };
  const assertDisposed = () => {
    const createdTextures = gl.createTexture.mock.results
      .map((result: { value: unknown }) => result.value)
      .filter(Boolean);
    expect(gl.deleteTexture).toHaveBeenCalledTimes(createdTextures.length);
    expect(new Set(gl.deleteTexture.mock.calls.map((call: unknown[]) => call[0]))).toEqual(
      new Set(createdTextures)
    );
    expect(gl.deleteFramebuffer).toHaveBeenCalledTimes(
      gl.createFramebuffer.mock.results.filter((result: { value: unknown }) => result.value).length
    );
    expect(gl.deleteProgram).toHaveBeenCalledTimes(
      gl.createProgram.mock.results.filter((result: { value: unknown }) => result.value).length
    );
    expect(gl.deleteBuffer).toHaveBeenCalledTimes(
      gl.createBuffer.mock.results.filter((result: { value: unknown }) => result.value).length
    );
    expect(arrays.deleteVertexArrayOES).toHaveBeenCalledTimes(
      arrays.createVertexArrayOES.mock.results.filter((result) => result.value).length
    );
    expect(gl.deleteShader.mock.calls.map((call: unknown[]) => call[0])).toEqual(
      gl.createShader.mock.results.map((result: { value: unknown }) => result.value).filter(Boolean)
    );
  };
  return { gl, arrays, state, draws, pixels, snapshot, assertDisposed };
}

describe('GPU prefilter capability and state ownership (GL spy, not pixel evidence)', () => {
  it.each(['missing-query', 'missing-result', 'low-precision', 'low-range', 'missing-vao'])(
    'returns CPU eligibility without allocation for %s',
    (reason) => {
      const f = fixture();
      if (reason === 'missing-query') f.gl.getShaderPrecisionFormat = undefined;
      else if (reason === 'missing-result') f.gl.getShaderPrecisionFormat.mockReturnValue(null);
      else if (reason === 'low-precision')
        f.gl.getShaderPrecisionFormat.mockReturnValue({
          precision: 22,
          rangeMin: 127,
          rangeMax: 127,
        });
      else if (reason === 'low-range')
        f.gl.getShaderPrecisionFormat.mockReturnValue({ precision: 23, rangeMin: 8, rangeMax: 8 });
      else f.gl.getExtension.mockReturnValue(null);
      const before = f.snapshot();
      expect(createWebOpticalPrefilter(f.gl)).toBeNull();
      expect(f.gl.createShader).not.toHaveBeenCalled();
      expect(f.gl.createTexture).not.toHaveBeenCalled();
      expect(f.snapshot()).toEqual(before);
    }
  );

  it('keeps highp byte decoding, separate rounded passes and the original final LINEAR sampling', () => {
    const f = fixture();
    const before = f.snapshot();
    const filter = createWebOpticalPrefilter(f.gl)!;
    expect(f.snapshot()).toEqual(before);
    const source = f.pixels();
    const sourceCopy = source.slice();
    const output = filter.filter(source, 7, 5);
    expect(f.snapshot()).toEqual(before);
    expect(source).toEqual(sourceCopy);
    const resources = f.gl.createTexture.mock.results.map(
      (result: { value: unknown }) => result.value
    );
    expect(output.texture).toBe(resources[2]);
    expect(f.draws.map((draw) => [draw.texture, draw.target])).toEqual([
      [resources[0], resources[1]],
      [resources[1], resources[2]],
    ]);
    for (const draw of f.draws) {
      expect(draw.texture).not.toBe(draw.target);
      expect(draw.enabled).toEqual([]);
      expect(draw.colorMask).toEqual([true, true, true, true]);
      expect([...draw.viewport]).toEqual([0, 0, 7, 5]);
    }
    expect(f.draws.map((draw) => draw.uniforms.get('u_step'))).toEqual([
      [1, 0],
      [0, 1],
    ]);
    expect(
      f.gl.texParameteri.mock.calls
        .filter((call: unknown[]) => call[1] === f.gl.TEXTURE_MIN_FILTER)
        .map((call: unknown[]) => call[2])
    ).toEqual([f.gl.NEAREST, f.gl.NEAREST, f.gl.LINEAR]);
    expect(f.gl.shaderSource.mock.calls[1][1]).toContain('uniform highp sampler2D u_source;');
    for (const call of f.gl.shaderSource.mock.calls)
      expect(call[1]).toContain('varying highp vec2 v_uv;');
    expect(f.gl.shaderSource.mock.calls[1][1]).toContain('floor(v_uv * u_size) + 0.5');
    expect(f.gl.shaderSource.mock.calls[1][1]).not.toContain('gl_FragCoord');
    expect(f.gl.shaderSource.mock.calls[1][1]).toContain('floor((sum + 32.0) / 64.0) / 255.0');
    expect(f.gl.readPixels).not.toHaveBeenCalled();
    expect(f.gl.finish).not.toHaveBeenCalled();
    expect(f.gl.framebufferTexture2D).toHaveBeenLastCalledWith(
      f.gl.FRAMEBUFFER,
      f.gl.COLOR_ATTACHMENT0,
      f.gl.TEXTURE_2D,
      null,
      0
    );
    output.release();
    output.release();
    expect(f.gl.deleteTexture).toHaveBeenCalledOnce();
    expect(f.gl.deleteTexture).toHaveBeenLastCalledWith(output.texture);
    filter.dispose();
    filter.dispose();
    f.assertDisposed();
    expect(() => filter.filter(source, 7, 5)).toThrow('gpu-prefilter-disposed');
  });

  it('reuses working storage while keeping each retained result independent', () => {
    const f = fixture();
    const filter = createWebOpticalPrefilter(f.gl)!;
    const first = filter.filter(f.pixels(), 7, 5);
    const second = filter.filter(f.pixels(), 7, 5);
    expect(second.texture).not.toBe(first.texture);
    expect(f.gl.texImage2D).toHaveBeenCalledTimes(4);
    const resized = filter.filter(f.pixels(5, 7), 5, 7);
    expect(resized.texture).not.toBe(first.texture);
    expect(f.gl.texImage2D).toHaveBeenCalledTimes(7);
    filter.filter(f.pixels(1, 1), 1, 1);
    expect(f.gl.texImage2D).toHaveBeenCalledTimes(10);
    expect(f.gl.createTexture).toHaveBeenCalledTimes(6);
    expect(f.gl.createProgram).toHaveBeenCalledTimes(1);
    expect(f.gl.texSubImage2D).toHaveBeenCalledTimes(4);
    expect(f.draws).toHaveLength(8);
    expect(f.gl.deleteTexture).not.toHaveBeenCalled();
    first.release();
    first.release();
    expect(f.gl.deleteTexture).toHaveBeenCalledOnce();
    expect(f.gl.deleteTexture).not.toHaveBeenCalledWith(second.texture);
    filter.dispose();
    second.release();
    resized.release();
    f.assertDisposed();
  });

  it('rejects invalid or nonopaque input before source upload without losing a usable filter', () => {
    const f = fixture();
    const filter = createWebOpticalPrefilter(f.gl)!;
    const before = f.snapshot();
    for (const [width, height] of [
      [NaN, 1],
      [0, 1],
      [2049, 1],
      [2048, 2048],
      [1.5, 1],
    ])
      expect(() => filter.filter(f.pixels(), width, height)).toThrow('invalid-optical-source');
    expect(() => filter.filter(new Uint8Array(3), 1, 1)).toThrow('invalid-optical-source');
    const pixels = f.pixels();
    pixels[3] = 254;
    expect(() => filter.filter(pixels, 7, 5)).toThrow('nonopaque-optical-source');
    expect(f.gl.texSubImage2D).not.toHaveBeenCalled();
    expect(f.snapshot()).toEqual(before);
    pixels[3] = 255;
    filter.filter(pixels, 7, 5);
    filter.dispose();
    f.assertDisposed();
  });

  it.each([0, 1])(
    'restores state and retires all resources if pass %i has an incomplete framebuffer',
    (pass) => {
      const f = fixture();
      const filter = createWebOpticalPrefilter(f.gl)!;
      const before = f.snapshot();
      if (pass === 1) f.gl.checkFramebufferStatus.mockReturnValueOnce(f.gl.FRAMEBUFFER_COMPLETE);
      f.gl.checkFramebufferStatus.mockReturnValueOnce(0);
      expect(() => filter.filter(f.pixels(), 7, 5)).toThrow('gpu-prefilter-framebuffer-incomplete');
      expect(f.snapshot()).toEqual(before);
      expect(f.draws).toHaveLength(pass);
      filter.dispose();
      f.assertDisposed();
    }
  );

  it.each(['before', 'during'])(
    'rejects context loss %s a filter and disposes idempotently',
    (phase) => {
      const f = fixture();
      const filter = createWebOpticalPrefilter(f.gl)!;
      if (phase === 'before') f.gl.isContextLost.mockReturnValue(true);
      else f.gl.drawArrays.mockImplementation(() => f.gl.isContextLost.mockReturnValue(true));
      expect(() => filter.filter(f.pixels(), 7, 5)).toThrow('webgl-unavailable');
      expect(f.gl.drawArrays).toHaveBeenCalledTimes(phase === 'before' ? 0 : 1);
      filter.dispose();
      f.assertDisposed();
    }
  );

  it('restores state and disposes if GL reports an error after submission', () => {
    const f = fixture();
    const filter = createWebOpticalPrefilter(f.gl)!;
    const before = f.snapshot();
    f.gl.getError.mockReturnValueOnce(0x0502);
    expect(() => filter.filter(f.pixels(), 7, 5)).toThrow('gpu-prefilter-failed');
    expect(f.snapshot()).toEqual(before);
    filter.dispose();
    f.assertDisposed();
  });

  it.each(['shader', 'link', 'uniform', 'buffer', 'framebuffer', 'array', 'texture'])(
    'cleans every completed allocation after a %s initialization failure',
    (failure) => {
      const f = fixture();
      const before = f.snapshot();
      if (failure === 'shader') f.gl.getShaderParameter.mockReturnValueOnce(false);
      else if (failure === 'link') f.gl.getProgramParameter.mockReturnValueOnce(false);
      else if (failure === 'uniform') f.gl.getUniformLocation.mockReturnValueOnce(null);
      else if (failure === 'array')
        f.arrays.createVertexArrayOES.mockReturnValueOnce(null as never);
      else if (failure === 'texture')
        f.gl.createTexture
          .mockReturnValueOnce({ kind: 'Texture', id: 500 })
          .mockReturnValueOnce(null);
      else
        f.gl[`create${failure === 'buffer' ? 'Buffer' : 'Framebuffer'}`].mockReturnValueOnce(null);
      expect(() => createWebOpticalPrefilter(f.gl)).toThrow('gpu-prefilter-');
      expect(f.snapshot()).toEqual(before);
      f.assertDisposed();
    }
  );
});
