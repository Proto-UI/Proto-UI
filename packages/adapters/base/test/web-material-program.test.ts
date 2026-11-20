import { describe, expect, it, vi } from 'vitest';
import { createWebOpticalProgram, type OpticalFrame } from '../src/material/program';
import { vertex, fragment } from '../src/material/liquidgl-kernel.generated';
import { contactFragment } from '../src/material/contact-profile';
import {
  styleTintFragment,
  styleTintContactFragment,
  styleTintEnvelope,
  styleTintLightForeground,
} from '../src/material/style-tint-profile';
import { acquireWebOpticalProgram, inspectWebOpticalResources } from '../src/material/program-pool';
import { colorContrast, type OpaqueRgba } from '../src/material/style';
import * as prefilterModule from '../src/material/prefilter';
function fixture(
  control: 'zero-refraction' | 'zero-deformation' | 'zero-aberration' | null = null,
  sourcePreparation: 'auto' | 'cpu' = 'auto'
) {
  const shaderSources: string[] = [],
    writes = new Map<string, unknown>();
  const programs: { attribute: number }[] = [];
  let currentProgram: (typeof programs)[number] | null = null;
  const gl: any = {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    COMPILE_STATUS: 3,
    LINK_STATUS: 4,
    NO_ERROR: 0,
    TEXTURE0: 100,
    ARRAY_BUFFER: 101,
    TEXTURE_2D: 102,
    createShader: vi.fn(() => ({})),
    shaderSource: (_: unknown, source: string) => shaderSources.push(source),
    getShaderParameter: () => true,
    createProgram: vi.fn(() => {
      const program = { attribute: programs.length };
      programs.push(program);
      return program;
    }),
    getProgramParameter: () => true,
    getUniformLocation: (program: unknown, name: string) => ({ program, name }),
    createBuffer: vi.fn(() => ({})),
    getAttribLocation: (program: (typeof programs)[number]) => program.attribute,
    createTexture: vi.fn(() => ({})),
    isContextLost: vi.fn(() => false),
    getError: () => 0,
    readPixels: (
      _x: number,
      _y: number,
      _w: number,
      _h: number,
      _format: number,
      _type: number,
      output: Uint8Array
    ) => output.fill(255),
    getExtension: vi.fn(() => null),
  };
  for (const name of [
    'compileShader',
    'attachShader',
    'linkProgram',
    'useProgram',
    'bindBuffer',
    'bufferData',
    'enableVertexAttribArray',
    'vertexAttribPointer',
    'activeTexture',
    'bindTexture',
    'texParameteri',
    'texImage2D',
    'deleteShader',
    'deleteTexture',
    'deleteBuffer',
    'deleteProgram',
    'viewport',
    'pixelStorei',
    'clearColor',
    'clear',
    'disable',
    'drawArrays',
    'finish',
  ])
    gl[name] = vi.fn();
  gl.useProgram.mockImplementation((program: (typeof programs)[number]) => {
    currentProgram = program;
  });
  for (const name of ['uniform1f', 'uniform1i', 'uniform2fv', 'uniform4fv'])
    gl[name] = vi.fn((location: { program: unknown; name: string }, value: unknown) => {
      expect(location.program).toBe(currentProgram);
      writes.set(location.name, value);
    });
  const canvas = document.createElement('canvas');
  vi.spyOn(canvas, 'getContext').mockReturnValue(gl);
  vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/png;base64,AA==');
  const program = createWebOpticalProgram(canvas, control, sourcePreparation);
  const frame = {
    source: {
      revision: 1,
      width: 4,
      height: 4,
      pixels: new Uint8Array(64).fill(255),
      canvas,
      scope: document.createElement('div'),
    },
    geometry: {
      width: 2,
      height: 2,
      radius: 1,
      dpr: 1,
      bounds: [0, 0, 0.5, 0.5] as [number, number, number, number],
    },
    pressed: false,
    variant: 'regular' as const,
    fill: [1, 1, 1, 1] as const,
    foreground: [0, 0, 0, 1] as const,
  };
  return { program, frame, writes, shaderSources, gl, canvas, programs };
}
describe('fixed V2 optical ABI (spy, no GPU execution claim)', () => {
  it('uses the unmodified shader modules and the established regular rest/press mapping', () => {
    const f = fixture();
    f.program.render(f.frame);
    expect(f.shaderSources).toEqual([vertex, fragment]);
    expect(f.writes.get('u_refraction')).toBe(0.008);
    expect(f.writes.get('u_bevelDepth')).toBe(0.06);
    expect(f.writes.get('u_magnify')).toBe(1.025);
    expect(f.writes.get('u_specular')).toBe(1);
    f.program.render({ ...f.frame, pressed: true });
    expect(f.writes.get('u_refraction')).toBe(0.018);
    expect(f.writes.get('u_bevelDepth')).toBe(0.12);
    expect(f.writes.get('u_magnify')).toBe(1.08);
    f.program.dispose();
  });
  it('reuses source preparation and upload for twenty same-generation surface frames', () => {
    const f = fixture();
    for (let i = 0; i < 20; i++) f.program.render({ ...f.frame, pressed: i % 2 === 0 });
    expect(f.program.inspect()).toMatchObject({
      renders: 20,
      programBuilds: 1,
      sourcePreparations: 1,
      sourceUploads: 1,
    });
    f.program.dispose();
  });
  it('reuses prepared bytes for A -> B -> A while uploading the current source each time', () => {
    const f = fixture();
    const second = {
      ...f.frame.source,
      canvas: document.createElement('canvas'),
      scope: document.createElement('div'),
      pixels: f.frame.source.pixels.map((value, index) => (index % 4 === 3 ? value : index)),
    };
    try {
      f.program.render(f.frame);
      const firstUpload = f.gl.texImage2D.mock.calls.at(-1)![8];
      f.program.render({ ...f.frame, source: second });
      expect(f.gl.texImage2D.mock.calls.at(-1)![8]).toEqual(
        referencePrefilter(second.pixels, second.width, second.height)
      );
      f.program.render(f.frame);
      expect(f.program.inspect()).toMatchObject({
        sourcePreparations: 2,
        sourceUploads: 3,
        sourcePreparationCacheHits: 1,
        sourcePreparationCacheEntries: 2,
        sourcePreparationCacheBytes: 128,
      });
      expect(f.gl.texImage2D.mock.calls.at(-1)![8]).toBe(firstUpload);
    } finally {
      f.program.dispose();
    }
  });
  it('zero-refraction is an internal same-kernel, same-coat control', () => {
    const f = fixture('zero-refraction');
    f.program.render(f.frame);
    expect(f.writes.get('u_refraction')).toBe(0);
    expect(f.writes.get('u_bevelDepth')).toBe(0);
    expect(f.writes.get('u_magnify')).toBe(1);
    expect(f.writes.get('u_specular')).toBe(1);
    f.program.dispose();
  });
  it('refuses malformed source and nonfinite geometry before creating a program', () => {
    const f = fixture();
    expect(() =>
      f.program.render({ ...f.frame, source: { ...f.frame.source, pixels: new Uint8Array(4) } })
    ).toThrow('invalid-optical-source');
    expect(f.shaderSources).toHaveLength(0);
    expect(() =>
      f.program.render({ ...f.frame, geometry: { ...f.frame.geometry, width: NaN } })
    ).toThrow('optical-geometry-budget');
    f.program.dispose();
  });
});

describe('GPU preparation integration (mock helper, original optical ABI)', () => {
  function cachedGpuFixture() {
    const outputs: { texture: WebGLTexture; release: ReturnType<typeof vi.fn> }[] = [];
    const filter = vi.fn(() => {
      const output = {
        texture: { prepared: outputs.length } as unknown as WebGLTexture,
        release: vi.fn(),
      };
      outputs.push(output);
      return output;
    });
    const dispose = vi.fn();
    const factory = vi
      .spyOn(prefilterModule, 'createWebOpticalPrefilter')
      .mockReturnValue({ filter, dispose });
    const f = fixture();
    return {
      ...f,
      outputs,
      filter,
      dispose,
      cleanup() {
        f.program.dispose();
        factory.mockRestore();
      },
    };
  }

  it('renders after repeated clear without restoring a retired current program', () => {
    const f = fixture();
    type Program = (typeof f.programs)[number];
    let current: Program | null = null,
      error = f.gl.NO_ERROR;
    const pending = new Set<Program>(),
      deleted = new Set<Program>(),
      invalidRestores: Program[] = [];
    const useProgram = f.gl.useProgram.getMockImplementation()!;
    // Model the GL lifetime that a no-op deleteProgram spy misses: deleting
    // the current program defers destruction until another program is used.
    f.gl.deleteProgram.mockImplementation((program: Program) => {
      pending.add(program);
      if (program !== current) deleted.add(program);
    });
    f.gl.useProgram.mockImplementation((program: Program | null) => {
      if (program && deleted.has(program)) {
        invalidRestores.push(program);
        error = 0x0501; // INVALID_VALUE: the program name no longer exists.
        return;
      }
      if (current && current !== program && pending.has(current)) deleted.add(current);
      current = program;
      useProgram(program);
    });
    f.gl.getError = vi.fn(() => {
      const result = error;
      error = f.gl.NO_ERROR;
      return result;
    });
    const factory = vi
      .spyOn(prefilterModule, 'createWebOpticalPrefilter')
      .mockImplementation(() => {
        const helperProgram = f.gl.createProgram();
        let disposed = false;
        return {
          filter() {
            // Model the helper's state-preserving program switch. Actual GL
            // render -> clear -> render coverage lives in the native probe.
            const previous = current;
            f.gl.useProgram(helperProgram);
            f.gl.useProgram(previous);
            if (f.gl.getError() !== f.gl.NO_ERROR) throw new Error('gpu-prefilter-failed');
            return { texture: {} as WebGLTexture, release() {} };
          },
          dispose() {
            if (!disposed) f.gl.deleteProgram(helperProgram);
            disposed = true;
          },
        };
      });
    try {
      for (let cycle = 0; cycle < 3; cycle++) {
        expect(f.program.render(f.frame)).toBe('data:image/png;base64,AA==');
        expect(invalidRestores).toEqual([]);
        f.program.clear();
      }
      expect(f.program.inspect()).toMatchObject({
        renders: 3,
        programBuilds: 3,
        prefilterProgramBuilds: 3,
        sourcePreparationCacheEntries: 0,
      });
    } finally {
      f.program.dispose();
      factory.mockRestore();
    }
  });

  it('retires the old clear upload slot when GPU paint takes over, including without WeakRef', () => {
    vi.stubGlobal('WeakRef', undefined);
    const f = cachedGpuFixture();
    const clear = cacheSource(),
      regular = cacheSource();
    try {
      f.program.render({ ...f.frame, source: clear, variant: 'clear' });
      f.program.render({ ...f.frame, source: regular });
      f.program.render({ ...f.frame, source: clear, variant: 'clear' });
      // Reupload means the previous strong clear slot was not retained as an
      // inactive cache alongside GPU ownership. This does not time a real GC.
      expect(f.program.inspect()).toMatchObject({ sourceUploads: 3, gpuSourcePreparations: 1 });
      expect(f.gl.texImage2D).toHaveBeenCalledTimes(5);
      expect(f.gl.texImage2D.mock.calls.at(-1)![8]).toBe(clear.pixels);
    } finally {
      f.cleanup();
      vi.unstubAllGlobals();
    }
  });

  it('retains independent A -> B -> A textures and releases LRU or changed source entries', () => {
    const f = cachedGpuFixture();
    const sources = Array.from({ length: 5 }, (_, index) => cacheSource(4, 4, index));
    const render = (index: number) => f.program.render({ ...f.frame, source: sources[index] });
    try {
      render(0);
      render(1);
      render(0);
      expect(f.filter).toHaveBeenCalledTimes(2);
      expect(f.outputs[0].texture).not.toBe(f.outputs[1].texture);
      expect(f.gl.bindTexture).toHaveBeenLastCalledWith(f.gl.TEXTURE_2D, f.outputs[0].texture);
      expect(f.outputs[0].release).not.toHaveBeenCalled();
      render(2);
      render(3);
      render(4);
      expect(f.outputs[1].release).toHaveBeenCalledOnce();
      expect(f.outputs[0].release).not.toHaveBeenCalled();
      render(0);
      expect(f.filter).toHaveBeenCalledTimes(5);
      expect(f.program.inspect()).toMatchObject({
        sourcePreparations: 5,
        sourceUploads: 5,
        sourcePreparationCacheHits: 2,
        sourcePreparationCacheEntries: 4,
        sourcePreparationCacheBytes: 256,
        sourcePreparationGpuCacheBytes: 256,
        sourcePreparationCpuCacheBytes: 0,
      });
      sources[0].revision++;
      render(0);
      expect(f.outputs[0].release).toHaveBeenCalledOnce();
      expect(f.filter).toHaveBeenCalledTimes(6);
      f.program.clear();
      for (const output of f.outputs) expect(output.release).toHaveBeenCalledOnce();
      expect(f.program.inspect()).toMatchObject({
        gpuSourcePreparations: 6,
        sourcePreparationCacheEntries: 0,
        sourcePreparationCacheBytes: 0,
        sourcePreparationGpuCacheBytes: 0,
      });
    } finally {
      f.cleanup();
    }
  });

  it('applies the same 4 MiB output budget to GPU entries and releases them on context loss', () => {
    const f = cachedGpuFixture();
    const sources = [cacheSource(1024, 512), cacheSource(1024, 512, 1), cacheSource(1, 1, 2)];
    const render = (index: number) => f.program.render({ ...f.frame, source: sources[index] });
    try {
      render(0);
      render(1);
      render(0);
      expect(f.program.inspect()).toMatchObject({
        sourcePreparationCacheEntries: 2,
        sourcePreparationGpuCacheBytes: 4 * 1024 * 1024,
      });
      render(2);
      expect(f.outputs[1].release).toHaveBeenCalledOnce();
      expect(f.outputs[0].release).not.toHaveBeenCalled();
      expect(f.program.inspect()).toMatchObject({
        sourcePreparationCacheEntries: 2,
        sourcePreparationCacheBytes: 2 * 1024 * 1024 + 4,
      });
      f.gl.isContextLost.mockReturnValue(true);
      expect(() => render(0)).toThrow('webgl-unavailable');
      for (const output of f.outputs) expect(output.release).toHaveBeenCalledOnce();
      expect(f.dispose).toHaveBeenCalledOnce();
      expect(f.program.inspect()).toMatchObject({
        sourcePreparationCacheEntries: 0,
        sourcePreparationGpuCacheBytes: 0,
      });
    } finally {
      f.cleanup();
    }
  });

  it('reuses one prepared GPU source across profiles and still validates every rendered pixel', () => {
    const outputs: { texture: WebGLTexture; release: ReturnType<typeof vi.fn> }[] = [];
    const filter = vi.fn(() => {
        const output = {
          texture: { prepared: outputs.length } as unknown as WebGLTexture,
          release: vi.fn(),
        };
        outputs.push(output);
        return output;
      }),
      dispose = vi.fn();
    const factory = vi
      .spyOn(prefilterModule, 'createWebOpticalPrefilter')
      .mockReturnValue({ filter, dispose });
    const f = fixture();
    try {
      for (let index = 0; index < 8; index++)
        f.program.render({
          ...f.frame,
          pressed: index % 2 === 0,
          ...(index % 2 ? { tint: 'style-fill' as const } : {}),
        });
      expect(factory).toHaveBeenCalledOnce();
      expect(filter).toHaveBeenCalledOnce();
      expect(f.gl.bindTexture).toHaveBeenLastCalledWith(f.gl.TEXTURE_2D, outputs[0].texture);
      expect(f.program.inspect()).toMatchObject({
        renders: 8,
        sourcePreparations: 1,
        gpuSourcePreparations: 1,
        cpuSourcePreparations: 0,
        sourceUploads: 1,
        prefilterProgramBuilds: 1,
      });
      expect(f.gl.texImage2D).toHaveBeenCalledTimes(3);
      expect(f.shaderSources).toEqual([vertex, fragment, vertex, styleTintFragment]);
      f.program.render({ ...f.frame, variant: 'clear' });
      expect(f.gl.texImage2D.mock.calls.at(-1)![8]).toBe(f.frame.source.pixels);
      f.program.render(f.frame);
      expect(filter).toHaveBeenCalledOnce();
      expect(f.gl.bindTexture).toHaveBeenLastCalledWith(f.gl.TEXTURE_2D, outputs[0].texture);
      expect(f.program.inspect().sourceUploads).toBe(2);

      f.frame.source.pixels[3] = 254;
      expect(() => f.program.render(f.frame)).toThrow('nonopaque-optical-source');
      expect(filter).toHaveBeenCalledOnce();
      f.frame.source.pixels[3] = 255;
      f.program.render({ ...f.frame, source: { ...f.frame.source, revision: 2 } });
      expect(filter).toHaveBeenCalledTimes(2);
      expect(f.program.inspect()).toMatchObject({
        sourcePreparations: 2,
        gpuSourcePreparations: 2,
      });

      const encoded = vi.mocked(f.canvas.toDataURL).mock.calls.length;
      f.gl.readPixels = (...args: unknown[]) => (args[6] as Uint8Array).fill(0);
      expect(() => f.program.render({ ...f.frame, tint: 'style-fill' })).toThrow(
        'rendered-style-tint-empty'
      );
      expect(f.canvas.toDataURL).toHaveBeenCalledTimes(encoded);
    } finally {
      f.program.dispose();
      expect(dispose).toHaveBeenCalledOnce();
      for (const output of outputs) expect(output.release).toHaveBeenCalledOnce();
      factory.mockRestore();
    }
  });

  it('keeps the forced CPU comparison internal and retains the scalar-byte reference', () => {
    const factory = vi.spyOn(prefilterModule, 'createWebOpticalPrefilter');
    const f = fixture(null, 'cpu');
    try {
      f.program.render(f.frame);
      expect(factory).not.toHaveBeenCalled();
      expect(f.program.inspect()).toMatchObject({
        cpuSourcePreparations: 1,
        gpuSourcePreparations: 0,
        prefilterProgramBuilds: 0,
      });
      expect(f.gl.texImage2D.mock.calls.at(-1)![8]).toEqual(
        referencePrefilter(f.frame.source.pixels, 4, 4)
      );
    } finally {
      f.program.dispose();
      factory.mockRestore();
    }
  });

  it.each(['create', 'filter'])(
    'retires the entire failed preparation and optical resource set after %s failure',
    (phase) => {
      const dispose = vi.fn();
      const failure = new Error('gpu-prefilter-framebuffer-incomplete');
      const factory = vi
        .spyOn(prefilterModule, 'createWebOpticalPrefilter')
        .mockImplementation(() => {
          if (phase === 'create') throw failure;
          return {
            filter: () => {
              throw failure;
            },
            dispose,
          };
        });
      const f = fixture();
      try {
        expect(() => f.program.render(f.frame)).toThrow(failure);
        expect(f.gl.deleteTexture).toHaveBeenCalledTimes(3);
        expect(f.gl.deleteBuffer).toHaveBeenCalledOnce();
        expect(f.gl.deleteProgram).toHaveBeenCalledOnce();
        expect(f.canvas.toDataURL).not.toHaveBeenCalled();
        expect(f.canvas.width).toBe(0);
        expect(dispose).toHaveBeenCalledTimes(phase === 'filter' ? 1 : 0);
      } finally {
        f.program.dispose();
        factory.mockRestore();
      }
    }
  );
});

describe('finite first-party contact optical ABI (spy, not GPU evidence)', () => {
  it('retains upstream literals and selects a separately identified local-light derivative', async () => {
    const { contactFragment } = await import('../src/material/contact-profile');
    const f = fixture();
    f.program.render({
      ...f.frame,
      contact: { x: 0.2, y: 0.7, deltaX: 0.6, deltaY: -0.4, strength: 1 },
    });
    expect(f.shaderSources).toEqual([vertex, contactFragment]);
    expect(contactFragment).not.toBe(fragment);
    expect(contactFragment).toContain('float localLight');
    expect(fragment).not.toContain('float localLight');
    expect(contactFragment).not.toContain('smoothstep(0.4,0.0');
    expect(f.writes.get('u_interaction')).toEqual([0.2, 0.7, 0.033, -0.022000000000000002]);
    expect(f.writes.get('u_interactionRadius')).toBe(0.8);
    expect(f.writes.get('u_aberration')).toBeCloseTo(0.3);
    expect(f.gl.finish).not.toHaveBeenCalled();
    f.program.dispose();
  });
  it('bounds contact input and rejects nonfinite input before GPU allocation', () => {
    const f = fixture();
    expect(() =>
      f.program.render({ ...f.frame, contact: { x: NaN, y: 0, deltaX: 0, deltaY: 0, strength: 1 } })
    ).toThrow('invalid-optical-contact');
    expect(f.shaderSources).toHaveLength(0);
    f.program.render({
      ...f.frame,
      contact: { x: -5, y: 5, deltaX: 99, deltaY: -99, strength: 10 },
    });
    expect(f.writes.get('u_interaction')).toEqual([0, 1, 0.055, -0.055]);
    f.program.dispose();
  });
});

describe('expanded contact bounds and matched diagnostic controls (spy)', () => {
  it('preserves source mapping and original box while adding symmetric output margins', () => {
    const f = fixture();
    f.program.render({
      ...f.frame,
      geometry: { ...f.frame.geometry, paintOutset: 2 },
      contact: { x: 0.5, y: 0.5, deltaX: 1, deltaY: 0, strength: 1 },
    });
    expect(f.writes.get('u_resolution')).toEqual([6, 6]);
    expect(f.writes.get('u_boxSize')).toEqual([2, 2]);
    expect(f.writes.get('u_subpixel')).toEqual([2, 2]);
    expect(f.writes.get('u_bounds')).toEqual(f.frame.geometry.bounds);
    expect(f.writes.get('u_contactShape')).toBe(1);
    f.program.dispose();
  });
  it('isolates zero-deformation and zero-aberration without replacing the shader profile', () => {
    for (const control of ['zero-deformation', 'zero-aberration'] as const) {
      const f = fixture(control);
      f.program.render({
        ...f.frame,
        contact: { x: 0.5, y: 0.5, deltaX: 1, deltaY: 1, strength: 1 },
      });
      expect(f.writes.get('u_contactShape')).toBe(control === 'zero-deformation' ? 0 : 1);
      expect(f.writes.get('u_aberration')).toBeCloseTo(control === 'zero-aberration' ? 0 : 0.3);
      expect(f.writes.get('u_interactionRadius')).toBe(0.8);
      f.program.dispose();
    }
  });
});

// Frozen pre-optimization reference: compare the actual regular texture upload.
function referencePrefilter(pixels: Uint8Array, width: number, height: number): Uint8Array {
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

function cacheSource(width = 4, height = 4, seed = 0) {
  const pixels = new Uint8Array(width * height * 4);
  for (let index = 0; index < pixels.length; index++)
    pixels[index] = index % 4 === 3 ? 255 : (index * 37 + seed * 53) % 256;
  return {
    revision: 1,
    width,
    height,
    pixels,
    canvas: document.createElement('canvas'),
    scope: document.createElement('div'),
  };
}

describe('bounded prepared-source cache (CPU and GL spy only)', () => {
  it('requires frame identity even when revision, geometry, pixel view and owner are shared', () => {
    const f = fixture();
    const first = cacheSource(),
      second = { ...first };
    try {
      f.program.render({ ...f.frame, source: first });
      const firstUpload = f.gl.texImage2D.mock.calls.at(-1)![8];
      f.program.render({ ...f.frame, source: second });
      expect(f.gl.texImage2D.mock.calls.at(-1)![8]).not.toBe(firstUpload);
      f.program.render({ ...f.frame, source: first });
      expect(f.gl.texImage2D.mock.calls.at(-1)![8]).toBe(firstUpload);
      expect(f.program.inspect()).toMatchObject({
        sourcePreparations: 2,
        sourceUploads: 3,
        sourcePreparationCacheHits: 1,
        sourcePreparationCacheEntries: 2,
      });
    } finally {
      f.program.dispose();
    }
  });

  it.each<[string, (source: ReturnType<typeof cacheSource>) => void]>([
    [
      'revision',
      (source) => {
        source.revision++;
        source.pixels[0] ^= 255;
      },
    ],
    [
      'dimensions',
      (source) => {
        source.width = 2;
        source.height = 8;
      },
    ],
    [
      'pixel view',
      (source) => {
        source.pixels = new Uint8Array(
          source.pixels.buffer,
          source.pixels.byteOffset,
          source.pixels.length
        );
      },
    ],
    [
      'canvas',
      (source) => {
        source.canvas = document.createElement('canvas');
      },
    ],
    [
      'scope',
      (source) => {
        source.scope = document.createElement('div');
      },
    ],
  ])(
    'refreshes preparation and the current texture after same-frame %s changes',
    (_label, mutate) => {
      const f = fixture();
      const source = cacheSource();
      try {
        f.program.render({ ...f.frame, source });
        const previousUpload = f.gl.texImage2D.mock.calls.at(-1)![8];
        mutate(source);
        f.program.render({ ...f.frame, source });
        expect(f.gl.texImage2D.mock.calls.at(-1)![8]).not.toBe(previousUpload);
        expect(f.gl.texImage2D.mock.calls.at(-1)![8]).toEqual(
          referencePrefilter(source.pixels, source.width, source.height)
        );
        expect(f.program.inspect()).toMatchObject({
          sourcePreparations: 2,
          sourceUploads: 2,
          sourcePreparationCacheHits: 0,
          sourcePreparationCacheEntries: 1,
          sourcePreparationCacheBytes: 64,
        });
      } finally {
        f.program.dispose();
      }
    }
  );

  it('reuses source filtering across output geometry changes while updating uniforms', () => {
    const f = fixture();
    try {
      f.program.render(f.frame);
      f.program.render({ ...f.frame, geometry: { ...f.frame.geometry, width: 3, radius: 0.5 } });
      expect(f.writes.get('u_resolution')).toEqual([3, 2]);
      expect(f.writes.get('u_radius')).toBe(0.5);
      expect(f.program.inspect()).toMatchObject({ sourcePreparations: 1, sourceUploads: 1 });
    } finally {
      f.program.dispose();
    }
  });

  it.each(['current', 'interleaved'])(
    'checks every alpha byte before a %s source cache hit',
    (mode) => {
      const f = fixture();
      try {
        f.program.render(f.frame);
        if (mode === 'interleaved') f.program.render({ ...f.frame, source: cacheSource() });
        const before = f.program.inspect(),
          uploads = f.gl.texImage2D.mock.calls.length;
        f.frame.source.pixels[f.frame.source.pixels.length - 1] = 254;
        expect(() => f.program.render(f.frame)).toThrow('nonopaque-optical-source');
        expect(f.program.inspect()).toEqual(before);
        expect(f.gl.texImage2D).toHaveBeenCalledTimes(uploads);
      } finally {
        f.program.dispose();
      }
    }
  );

  it.each<[string, (f: ReturnType<typeof fixture>) => OpticalFrame, string]>([
    [
      'source dimensions',
      (f) => {
        f.frame.source.width = 3;
        return f.frame;
      },
      'invalid-optical-source',
    ],
    [
      'source pixel view',
      (f) => {
        f.frame.source.pixels = new Uint8Array(4);
        return f.frame;
      },
      'invalid-optical-source',
    ],
    [
      'output geometry',
      (f) => ({ ...f.frame, geometry: { ...f.frame.geometry, width: NaN } }),
      'optical-geometry-budget',
    ],
    [
      'source bounds',
      (f) => ({ ...f.frame, geometry: { ...f.frame.geometry, bounds: [0, 0, 2, 1] } }),
      'optical-source-bounds',
    ],
    [
      'contact',
      (f) => ({ ...f.frame, contact: { x: NaN, y: 0, deltaX: 0, deltaY: 0, strength: 1 } }),
      'invalid-optical-contact',
    ],
    [
      'clear tint',
      (f) => ({ ...f.frame, variant: 'clear', tint: 'style-fill' }),
      'style-tint-profile-unavailable',
    ],
  ])('retains the %s guard before cache lookup', (_label, invalidFrame, error) => {
    const f = fixture();
    try {
      f.program.render(f.frame);
      f.program.render({ ...f.frame, source: cacheSource() });
      const before = f.program.inspect(),
        uploads = f.gl.texImage2D.mock.calls.length;
      expect(() => f.program.render(invalidFrame(f))).toThrow(error);
      expect(f.program.inspect()).toEqual(before);
      expect(f.gl.texImage2D).toHaveBeenCalledTimes(uploads);
    } finally {
      f.program.dispose();
    }
  });

  it.each(['regular', 'clear'] as const)(
    'retires the old canvas/scope revision on a new %s frame',
    (variant) => {
      const f = fixture();
      const first = cacheSource(),
        second = cacheSource(),
        next = {
          ...first,
          revision: 2,
          pixels: first.pixels.map((value, index) => (index % 4 === 3 ? value : 255 - value)),
        };
      try {
        f.program.render({ ...f.frame, source: first });
        f.program.render({ ...f.frame, source: second });
        f.program.render({ ...f.frame, source: next, variant });
        const preparations = variant === 'regular' ? 3 : 2;
        expect(f.program.inspect()).toMatchObject({
          sourcePreparations: preparations,
          sourcePreparationCacheEntries: variant === 'regular' ? 2 : 1,
          sourcePreparationCacheBytes: variant === 'regular' ? 128 : 64,
        });
        f.program.render({ ...f.frame, source: first });
        expect(f.program.inspect()).toMatchObject({
          sourcePreparations: preparations + 1,
          sourceUploads: 4,
          sourcePreparationCacheHits: 0,
        });
        expect(f.gl.texImage2D.mock.calls.at(-1)![8]).toEqual(
          referencePrefilter(first.pixels, first.width, first.height)
        );
      } finally {
        f.program.dispose();
      }
    }
  );

  it('refreshes a changed clear frame and retires its old regular preparation', () => {
    const f = fixture();
    const source = cacheSource();
    try {
      f.program.render({ ...f.frame, source });
      f.program.render({ ...f.frame, source, variant: 'clear' });
      source.revision++;
      source.pixels = source.pixels.map((value, index) => (index % 4 === 3 ? value : 255 - value));
      f.program.render({ ...f.frame, source, variant: 'clear' });
      expect(f.gl.texImage2D.mock.calls.at(-1)![8]).toBe(source.pixels);
      expect(f.program.inspect()).toMatchObject({
        sourcePreparations: 1,
        sourceUploads: 3,
        sourcePreparationCacheEntries: 0,
        sourcePreparationCacheBytes: 0,
      });
      f.program.render({ ...f.frame, source });
      expect(f.program.inspect()).toMatchObject({ sourcePreparations: 2, sourceUploads: 4 });
      expect(f.gl.texImage2D.mock.calls.at(-1)![8]).toEqual(
        referencePrefilter(source.pixels, source.width, source.height)
      );
    } finally {
      f.program.dispose();
    }
  });

  it.each(['canvas', 'scope'] as const)(
    'does not retire another owner when only the %s differs',
    (key) => {
      const f = fixture();
      const first = cacheSource(),
        next = {
          ...first,
          revision: 2,
          [key]: document.createElement(key === 'canvas' ? 'canvas' : 'div'),
        };
      try {
        f.program.render({ ...f.frame, source: first });
        f.program.render({ ...f.frame, source: next, variant: 'clear' });
        expect(f.program.inspect()).toMatchObject({ sourcePreparationCacheEntries: 1 });
        f.program.render({ ...f.frame, source: first });
        expect(f.program.inspect()).toMatchObject({
          sourcePreparations: 1,
          sourceUploads: 3,
          sourcePreparationCacheHits: 1,
        });
      } finally {
        f.program.dispose();
      }
    }
  );

  it('limits tiny sources to four entries and evicts the least recently used source', () => {
    const f = fixture();
    const sources = Array.from({ length: 5 }, (_, index) => cacheSource(1, 1, index));
    const render = (index: number) => f.program.render({ ...f.frame, source: sources[index] });
    try {
      for (let index = 0; index < 4; index++) render(index);
      render(0);
      render(4);
      expect(f.program.inspect()).toMatchObject({
        sourcePreparations: 5,
        sourcePreparationCacheEntries: 4,
        sourcePreparationCacheBytes: 16,
      });
      render(0);
      expect(f.program.inspect()).toMatchObject({
        sourcePreparations: 5,
        sourcePreparationCacheHits: 2,
      });
      render(1);
      expect(f.program.inspect()).toMatchObject({
        sourcePreparations: 6,
        sourcePreparationCacheEntries: 4,
        sourcePreparationCacheBytes: 16,
      });
    } finally {
      f.program.dispose();
    }
  });

  it('allows exactly 4 MiB of filtered bytes and evicts by bytes before the entry limit', () => {
    const f = fixture();
    const sources = [cacheSource(1024, 512), cacheSource(1024, 512, 1), cacheSource(1, 1, 2)];
    const render = (index: number) => f.program.render({ ...f.frame, source: sources[index] });
    try {
      render(0);
      render(1);
      render(0);
      expect(f.program.inspect()).toMatchObject({
        sourcePreparations: 2,
        sourcePreparationCacheEntries: 2,
        sourcePreparationCacheBytes: 4 * 1024 * 1024,
      });
      render(2);
      expect(f.program.inspect()).toMatchObject({
        sourcePreparations: 3,
        sourcePreparationCacheEntries: 2,
        sourcePreparationCacheBytes: 2 * 1024 * 1024 + 4,
      });
      render(0);
      expect(f.program.inspect()).toMatchObject({
        sourcePreparations: 3,
        sourcePreparationCacheHits: 2,
      });
      render(1);
      expect(f.program.inspect()).toMatchObject({
        sourcePreparations: 4,
        sourcePreparationCacheEntries: 2,
        sourcePreparationCacheBytes: 4 * 1024 * 1024,
      });
    } finally {
      f.program.dispose();
    }
  });

  it('admits one maximum-size source and rejects an oversized source before cache eviction', () => {
    const f = fixture();
    const source = cacheSource(2048, 512);
    try {
      f.program.render(f.frame);
      f.program.render({ ...f.frame, source });
      f.program.render({ ...f.frame, source });
      expect(f.program.inspect()).toMatchObject({
        sourcePreparations: 2,
        sourceUploads: 2,
        sourcePreparationCacheHits: 1,
        sourcePreparationCacheEntries: 1,
        sourcePreparationCacheBytes: 4 * 1024 * 1024,
      });
      const before = f.program.inspect();
      expect(() => f.program.render({ ...f.frame, source: cacheSource(2048, 513) })).toThrow(
        'invalid-optical-source'
      );
      expect(f.program.inspect()).toEqual(before);
    } finally {
      f.program.dispose();
    }
  });

  it.each(['clear', 'dispose', 'context loss'] as const)(
    'releases every prepared entry on %s and prepares anew',
    (operation) => {
      const f = fixture();
      const sources = Array.from({ length: 4 }, (_, index) => cacheSource(4, 4, index));
      try {
        for (const source of sources) f.program.render({ ...f.frame, source });
        expect(f.program.inspect()).toMatchObject({
          sourcePreparationCacheEntries: 4,
          sourcePreparationCacheBytes: 256,
        });
        if (operation === 'context loss') {
          f.gl.isContextLost.mockReturnValue(true);
          expect(() => f.program.render({ ...f.frame, source: sources[0] })).toThrow(
            'webgl-unavailable'
          );
          f.gl.isContextLost.mockReturnValue(false);
        } else f.program[operation]();
        expect(f.program.inspect()).toMatchObject({
          sourcePreparationCacheEntries: 0,
          sourcePreparationCacheBytes: 0,
        });
        f.program.render({ ...f.frame, source: sources[0] });
        expect(f.program.inspect()).toMatchObject({
          sourcePreparations: 5,
          sourceUploads: 5,
          sourcePreparationCacheEntries: 1,
          sourcePreparationCacheBytes: 64,
        });
      } finally {
        f.program.dispose();
      }
    }
  );

  it('prunes a collected frame on the next lookup and treats collection only as a cache miss', () => {
    // Deterministic weak-reference retirement; this does not time a real GC.
    const references: { value: object | undefined }[] = [];
    class ControlledWeakRef<T extends object> {
      value: T | undefined;
      constructor(value: T) {
        this.value = value;
        references.push(this);
      }
      deref() {
        return this.value;
      }
    }
    vi.stubGlobal('WeakRef', ControlledWeakRef);
    const f = fixture();
    const first = cacheSource(),
      second = cacheSource();
    try {
      f.program.render({ ...f.frame, source: first });
      f.program.render({ ...f.frame, source: second });
      references.find((reference) => reference.value === first)!.value = undefined;
      f.program.render({ ...f.frame, source: second });
      expect(f.program.inspect()).toMatchObject({
        sourcePreparations: 2,
        sourcePreparationCacheEntries: 1,
        sourcePreparationCacheBytes: 64,
      });
      f.program.render({ ...f.frame, source: first });
      expect(f.program.inspect()).toMatchObject({ sourcePreparations: 3, sourceUploads: 3 });
      expect(f.gl.texImage2D.mock.calls.at(-1)![8]).toEqual(
        referencePrefilter(first.pixels, first.width, first.height)
      );
    } finally {
      f.program.dispose();
      vi.unstubAllGlobals();
    }
  });

  it('retains single-slot reuse without requiring WeakRef', () => {
    vi.stubGlobal('WeakRef', undefined);
    const f = fixture();
    const first = cacheSource(),
      second = cacheSource();
    try {
      f.program.render({ ...f.frame, source: first });
      f.program.render({ ...f.frame, source: first });
      expect(f.program.inspect()).toMatchObject({
        sourcePreparations: 1,
        sourceUploads: 1,
        sourcePreparationCacheHits: 1,
      });
      f.program.render({ ...f.frame, source: second });
      f.program.render({ ...f.frame, source: first });
      expect(f.program.inspect()).toMatchObject({
        sourcePreparations: 3,
        sourceUploads: 3,
        sourcePreparationCacheEntries: 1,
        sourcePreparationCacheBytes: 64,
      });
      first.pixels = first.pixels.slice();
      first.pixels[0] ^= 255;
      f.program.render({ ...f.frame, source: first });
      expect(f.program.inspect()).toMatchObject({ sourcePreparations: 4, sourceUploads: 4 });
      expect(f.gl.texImage2D.mock.calls.at(-1)![8]).toEqual(
        referencePrefilter(first.pixels, first.width, first.height)
      );
      f.program.clear();
      expect(f.program.inspect()).toMatchObject({
        sourcePreparationCacheEntries: 0,
        sourcePreparationCacheBytes: 0,
      });
      f.program.render({ ...f.frame, source: first });
      expect(f.program.inspect()).toMatchObject({ sourcePreparations: 5, sourceUploads: 5 });
    } finally {
      f.program.dispose();
      vi.unstubAllGlobals();
    }
  });
});

describe('regular prefilter byte equivalence (CPU and GL spy only)', () => {
  it.each([
    [1, 1],
    [1, 17],
    [19, 1],
    [2, 3],
    [3, 2],
    [6, 7],
    [7, 6],
    [13, 11],
    [64, 37],
    [257, 129],
  ])(
    'preserves both rounded passes, edge clamping, and all channels for %ix%i',
    (width, height) => {
      const f = fixture();
      let seed = 0x88799a;
      try {
        for (const pattern of ['zero', 'white', 'edges', 'random']) {
          const pixels = new Uint8Array(width * height * 4);
          for (let i = 0; i < pixels.length; i++) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            pixels[i] =
              i % 4 === 3
                ? 255
                : pattern === 'zero'
                  ? 0
                  : pattern === 'white'
                    ? 255
                    : pattern === 'edges'
                      ? ((i * 29 + Math.floor(i / (width * 4))) % 2) * 255
                      : seed >>> 24;
          }
          const before = pixels.slice();
          const source = { ...f.frame.source, width, height, pixels };
          f.program.render({ ...f.frame, source });
          const upload = f.gl.texImage2D.mock.calls.at(-1)![8] as Uint8Array;
          expect(upload).toEqual(referencePrefilter(pixels, width, height));
          expect(upload).not.toBe(pixels);
          expect(pixels).toEqual(before);
          expect(upload.every((value, index) => index % 4 !== 3 || value === 255)).toBe(true);
        }
        expect(f.program.inspect()).toMatchObject({ sourcePreparations: 4, sourceUploads: 4 });
      } finally {
        f.program.dispose();
      }
    }
  );
  it('still rejects nonopaque source before texture upload', () => {
    const f = fixture();
    f.frame.source.pixels[3] = 254;
    try {
      expect(() => f.program.render(f.frame)).toThrow('nonopaque-optical-source');
      expect(f.gl.texImage2D).not.toHaveBeenCalled();
    } finally {
      f.program.dispose();
    }
  });

  it.each([
    [1, 1],
    [1, 13],
    [2, 3],
    [3, 2],
    [3, 11],
    [7, 5],
    [16, 13],
  ])('preserves the declared %ix%i byte view and independent channel lanes', (width, height) => {
    const f = fixture();
    let seed = 0x32fc17;
    try {
      for (const byteOffset of [0, 1, 2, 3, 4, 11]) {
        // Prefix/suffix sentinels catch using the whole backing ArrayBuffer or
        // accidentally aligning the start by rounding down to another pixel.
        const backing = new Uint8Array(width * height * 4 + byteOffset + 17).fill(193);
        const pixels = backing.subarray(byteOffset, byteOffset + width * height * 4);
        for (let at = 0; at < pixels.length; at += 4) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          // Unequal, changing lanes include all-ones in the most significant
          // byte and contrasting extreme neighbors; no grayscale shortcut.
          pixels[at] = at % 8 ? 255 : 0;
          pixels[at + 1] = seed >>> 24;
          pixels[at + 2] = at % 12 ? 0 : 255;
          pixels[at + 3] = 255;
        }
        const before = backing.slice();
        const expected = referencePrefilter(pixels, width, height);
        f.program.render({ ...f.frame, source: { ...f.frame.source, width, height, pixels } });
        expect(f.gl.texImage2D.mock.calls.at(-1)![8]).toEqual(expected);
        expect(backing).toEqual(before);
      }
    } finally {
      f.program.dispose();
    }
  });

  it('rounds half steps in each pass rather than rounding a fused convolution', () => {
    const f = fixture();
    const run = (width: number, height: number, pixels: Uint8Array) => {
      f.program.render({ ...f.frame, source: { ...f.frame.source, width, height, pixels } });
      const uploaded = f.gl.texImage2D.mock.calls.at(-1)![8] as Uint8Array;
      expect(uploaded).toEqual(referencePrefilter(pixels, width, height));
      return uploaded;
    };
    try {
      const line = new Uint8Array(7 * 4);
      for (let at = 3; at < line.length; at += 4) line[at] = 255;
      line.set([32, 96, 160], 3 * 4);
      // The radius-three tap contributes exactly 0.5, 1.5 and 2.5.
      expect([...run(7, 1, line).slice(0, 4)]).toEqual([1, 2, 3, 255]);

      const impulse = new Uint8Array(9 * 9 * 4);
      for (let at = 3; at < impulse.length; at += 4) impulse[at] = 255;
      impulse.set([1, 32, 255], (4 * 9 + 4) * 4);
      const uploaded = run(9, 9, impulse);
      // Horizontal: round(255 * 20 / 64) = 80; vertical: round(80 * 6 / 64) = 8.
      // A single final rounding of 255 * 20 * 6 / 4096 would incorrectly be 7.
      expect(uploaded[(2 * 9 + 4) * 4 + 2]).toBe(8);
    } finally {
      f.program.dispose();
    }
  });

  it('keeps retained CPU outputs independent across changing source strides', () => {
    const f = fixture();
    const run = (width: number, height: number, value: number) => {
      const pixels = new Uint8Array(width * height * 4).fill(value);
      for (let at = 3; at < pixels.length; at += 4) pixels[at] = 255;
      f.program.render({ ...f.frame, source: { ...f.frame.source, width, height, pixels } });
      const uploaded = f.gl.texImage2D.mock.calls.at(-1)![8] as Uint8Array;
      expect(uploaded).toEqual(referencePrefilter(pixels, width, height));
      return uploaded;
    };
    try {
      const first = run(7, 5, 253);
      const retained = first.slice();
      const second = run(7, 5, 2);
      expect(second).not.toBe(first);
      // Equal byte length with different strides must rewrite every pixel.
      expect(run(5, 7, 173)).not.toBe(second);
      expect(first).toEqual(retained);
      const resized = run(3, 2, 0);
      expect(resized).not.toBe(second);
      expect(run(3, 2, 255)).not.toBe(resized);
      const restored = run(7, 5, 91);
      expect(restored).not.toBe(first);
      f.program.clear();
      expect(run(7, 5, 32)).not.toBe(restored);
      expect(f.program.inspect()).toMatchObject({ sourcePreparations: 7, sourceUploads: 7 });
    } finally {
      f.program.dispose();
    }
  });
});

describe('opt-in style tint optical ABI (spy only; actual pixels require CI)', () => {
  it('uses the isolated profile and full pipeline identity, then restores identical neutral inputs', () => {
    const f = fixture();
    f.program.render(f.frame);
    const neutralTint = f.writes.get('u_tint');
    f.program.render({ ...f.frame, tint: 'style-fill' });
    expect(f.shaderSources.at(-1)).toBe(styleTintFragment);
    expect(f.writes.get('u_tint')).toEqual(f.frame.fill);
    expect(f.writes.get('u_styleTintLightForeground')).toBe(0);
    expect(f.writes.get('u_styleTintLuminanceBound')).toBe(
      styleTintEnvelope(f.frame.fill, f.frame.foreground).luminanceBound
    );
    f.program.render({ ...f.frame, tint: 'style-fill' });
    expect(f.program.inspect().programBuilds).toBe(2);
    f.program.render({
      ...f.frame,
      tint: 'style-fill',
      contact: { x: 0.5, y: 0.5, deltaX: 0, deltaY: 0, strength: 1 },
    });
    expect(f.shaderSources.at(-1)).toBe(styleTintContactFragment);
    f.program.render(f.frame);
    expect(f.gl.useProgram).toHaveBeenLastCalledWith(f.programs[0]);
    expect(f.shaderSources).toEqual([
      vertex,
      fragment,
      vertex,
      styleTintFragment,
      vertex,
      styleTintContactFragment,
    ]);
    expect(f.writes.get('u_tint')).toEqual(neutralTint);
    expect(f.program.inspect().programBuilds).toBe(3);
    f.program.dispose();
  });
  it('sets the governed fill and bright-foreground polarity without exposing arbitrary uniforms', () => {
    const f = fixture();
    f.gl.readPixels = (
      _x: number,
      _y: number,
      _w: number,
      _h: number,
      _format: number,
      _type: number,
      pixels: Uint8Array
    ) => {
      pixels.fill(0);
      for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255;
    };
    const fill = [0, 97 / 255, 204 / 255, 1] as const;
    f.program.render({ ...f.frame, tint: 'style-fill', fill, foreground: [1, 1, 1, 1] });
    expect(f.writes.get('u_tint')).toEqual(fill);
    expect(f.writes.get('u_styleTintLightForeground')).toBe(1);
    f.program.dispose();
  });
  it('refuses unsupported tint, clear tint and unreadable pairs before GPU allocation', () => {
    const f = fixture();
    expect(() => f.program.render({ ...f.frame, tint: 'css-red' as any })).toThrow(
      'style-tint-profile-unavailable'
    );
    expect(() => f.program.render({ ...f.frame, tint: 'style-fill', variant: 'clear' })).toThrow(
      'style-tint-profile-unavailable'
    );
    expect(() =>
      f.program.render({ ...f.frame, tint: 'style-fill', foreground: [1, 1, 1, 1] })
    ).toThrow('invalid-style-tint-palette');
    expect(f.shaderSources).toHaveLength(0);
    f.program.dispose();
  });
  it('cannot certify an empty tinted interior or bypass the existing rendered contrast guard', () => {
    const f = fixture();
    f.gl.readPixels = (
      _x: number,
      _y: number,
      _w: number,
      _h: number,
      _format: number,
      _type: number,
      pixels: Uint8Array
    ) => pixels.fill(0);
    expect(() => f.program.render({ ...f.frame, tint: 'style-fill' })).toThrow(
      'rendered-style-tint-empty'
    );
    f.gl.readPixels = (
      _x: number,
      _y: number,
      _w: number,
      _h: number,
      _format: number,
      _type: number,
      pixels: Uint8Array
    ) => {
      pixels.fill(0);
      for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255;
    };
    expect(() => f.program.render({ ...f.frame, tint: 'style-fill' })).toThrow(
      'rendered-contrast-unsafe'
    );
    f.program.dispose();
  });
  it('rejects near-opaque pixels whose composited contrast fails, without changing neutral behavior', () => {
    const f = fixture();
    const fill = [118 / 255, 118 / 255, 118 / 255, 1] as const;
    const foreground = [1, 1, 1, 1] as const;
    f.gl.readPixels = (
      _x: number,
      _y: number,
      _w: number,
      _h: number,
      _format: number,
      _type: number,
      pixels: Uint8Array
    ) => {
      for (let at = 0; at < pixels.length; at += 4) pixels.set([114, 114, 114, 255], at);
      pixels.set([116, 116, 116, 250], 0);
    };
    // Raw 116 looks safe (~4.67); white-backdrop composition is ~121 (~4.35).
    expect(() => f.program.render({ ...f.frame, fill, foreground })).not.toThrow();
    expect(() => f.program.render({ ...f.frame, fill, foreground, tint: 'style-fill' })).toThrow(
      'rendered-contrast-unsafe'
    );
    f.program.dispose();
  });
  it('requires full opaque coverage evidence rather than counting only near-opaque AA', () => {
    const f = fixture();
    f.gl.readPixels = (
      _x: number,
      _y: number,
      _w: number,
      _h: number,
      _format: number,
      _type: number,
      pixels: Uint8Array
    ) => {
      for (let at = 0; at < pixels.length; at += 4) pixels.set([250, 250, 250, 250], at);
    };
    expect(() => f.program.render({ ...f.frame, tint: 'style-fill' })).toThrow(
      'rendered-style-tint-empty'
    );
    f.program.dispose();
  });
});

function profiles(frame: OpticalFrame): OpticalFrame[] {
  const contact = { x: 0.2, y: 0.7, deltaX: 0.6, deltaY: -0.4, strength: 1 };
  return [
    frame,
    { ...frame, tint: 'style-fill' },
    { ...frame, contact },
    { ...frame, contact, tint: 'style-fill' },
  ];
}

describe('bounded shared optical pipelines (GL state spy, not GPU evidence)', () => {
  it('interleaves all four profiles without recompiling, reuploading or mixing program state', () => {
    const f = fixture();
    const frames = profiles(f.frame);
    try {
      for (let cycle = 0; cycle < 8; cycle++) {
        for (const index of [0, 1, 2, 3, 1, 3, 0, 2]) {
          const frame = {
            ...frames[index],
            geometry: { ...f.frame.geometry, width: 2 + cycle + index },
            pressed: cycle % 2 === 1,
          };
          f.program.render(frame);
          // The fixture also rejects every uniform location owned by another program.
          expect(f.gl.useProgram).toHaveBeenLastCalledWith(f.programs[index]);
          expect(f.gl.enableVertexAttribArray).toHaveBeenLastCalledWith(index);
          expect(f.gl.vertexAttribPointer).toHaveBeenLastCalledWith(
            index,
            2,
            f.gl.FLOAT,
            false,
            0,
            0
          );
          expect(f.gl.bindBuffer).toHaveBeenLastCalledWith(
            f.gl.ARRAY_BUFFER,
            f.gl.createBuffer.mock.results[0].value
          );
          expect(f.writes.get('u_resolution')).toEqual([frame.geometry.width, 2]);
          expect(f.writes.get('u_contactShape')).toBe(frame.contact ? 1 : 0);
          expect(f.writes.get('u_refraction')).toBe(frame.contact || frame.pressed ? 0.018 : 0.008);
          expect(f.writes.get('u_tint')).toEqual(
            frame.tint ? frame.fill : [1.05, 1.05, 1.06, 0.45]
          );
          if (frame.tint)
            expect(f.writes.get('u_styleTintLuminanceBound')).toBe(
              styleTintEnvelope(frame.fill, frame.foreground).luminanceBound
            );
          for (const [name, unit] of [
            ['u_tex', 0],
            ['u_stack', 1],
            ['u_shadow', 2],
          ])
            expect(f.writes.get(name as string)).toBe(unit);
        }
      }
      expect(f.shaderSources).toEqual([
        vertex,
        fragment,
        vertex,
        styleTintFragment,
        vertex,
        contactFragment,
        vertex,
        styleTintContactFragment,
      ]);
      expect(f.program.inspect()).toMatchObject({
        renders: 64,
        programBuilds: 4,
        sourcePreparations: 1,
        sourceUploads: 1,
      });
      expect(f.canvas.getContext).toHaveBeenCalledTimes(1);
      expect(f.gl.createBuffer).toHaveBeenCalledTimes(1);
      expect(f.gl.createTexture).toHaveBeenCalledTimes(3);
      expect(f.gl.texImage2D).toHaveBeenCalledTimes(4);
      expect(f.gl.deleteProgram).not.toHaveBeenCalled();
      expect(f.gl.deleteTexture).not.toHaveBeenCalled();
    } finally {
      f.program.dispose();
    }
  });

  it('refreshes shared texture bytes for source identity and variant changes across cached profiles', () => {
    const f = fixture();
    const next = {
      ...f.frame.source,
      pixels: f.frame.source.pixels.map((n, i) => (i % 4 === 3 ? n : i)),
    };
    const steps: [OpticalFrame, number, number][] = [
      [f.frame, 1, 1],
      [{ ...f.frame, tint: 'style-fill' }, 1, 1],
      [{ ...f.frame, tint: 'style-fill', source: next }, 2, 2],
      [{ ...f.frame, source: next }, 2, 2],
      [{ ...f.frame, source: next, variant: 'clear' }, 2, 3],
      [{ ...f.frame, source: next, contact: profiles(f.frame)[2].contact, variant: 'clear' }, 2, 3],
      [{ ...f.frame, source: next, tint: 'style-fill' }, 2, 4],
      [f.frame, 2, 5],
    ];
    try {
      for (const [frame, sourcePreparations, sourceUploads] of steps) {
        f.program.render(frame);
        expect(f.program.inspect()).toMatchObject({ sourcePreparations, sourceUploads });
        expect(f.gl.texImage2D.mock.calls.at(-1)[8]).toEqual(
          frame.variant === 'clear'
            ? frame.source.pixels
            : referencePrefilter(frame.source.pixels, frame.source.width, frame.source.height)
        );
      }
      expect(f.gl.createTexture).toHaveBeenCalledTimes(3);
      expect(f.gl.bindTexture).toHaveBeenLastCalledWith(
        f.gl.TEXTURE_2D,
        f.gl.createTexture.mock.results[0].value
      );
    } finally {
      f.program.dispose();
    }
  });

  it.each(['clear', 'dispose'] as const)(
    '%s releases every cached resource exactly once',
    (method) => {
      const f = fixture();
      for (const frame of profiles(f.frame)) f.program.render(frame);
      f.program[method]();
      expect(f.gl.deleteProgram.mock.calls.map((call: unknown[]) => call[0])).toEqual(f.programs);
      expect(f.gl.deleteTexture).toHaveBeenCalledTimes(3);
      expect(f.gl.deleteBuffer).toHaveBeenCalledTimes(1);
      expect(f.canvas.width).toBe(0);
      expect(f.canvas.height).toBe(0);
      f.program[method]();
      expect(f.gl.deleteProgram).toHaveBeenCalledTimes(4);
      expect(f.gl.deleteTexture).toHaveBeenCalledTimes(3);
      expect(f.gl.deleteBuffer).toHaveBeenCalledTimes(1);
      if (method === 'clear') {
        for (const frame of profiles(f.frame)) f.program.render(frame);
        expect(f.program.inspect()).toMatchObject({
          programBuilds: 8,
          sourcePreparations: 2,
          sourceUploads: 2,
        });
        expect(f.gl.createTexture).toHaveBeenCalledTimes(6);
        expect(f.canvas.getContext).toHaveBeenCalledTimes(1);
        f.program.dispose();
      }
      expect(f.gl.getExtension).toHaveBeenCalledTimes(1);
      expect(f.gl.getExtension).toHaveBeenCalledWith('WEBGL_lose_context');
    }
  );

  it('releases all profiles when the document pool receives context loss and rebuilds after restore', () => {
    const f = fixture();
    const createElement = document.createElement.bind(document);
    const create = vi
      .spyOn(document, 'createElement')
      .mockImplementation((name, options) =>
        name === 'canvas' ? f.canvas : createElement(name, options)
      );
    const notify = vi.fn();
    const first = acquireWebOpticalProgram(document, notify);
    const second = acquireWebOpticalProgram(document, vi.fn());
    create.mockRestore();
    try {
      profiles(f.frame).forEach((frame, i) => (i % 2 ? second : first).render(frame));
      expect(inspectWebOpticalResources(document)).toMatchObject({
        contexts: 1,
        consumers: 2,
        programBuilds: 4,
      });
      f.gl.isContextLost.mockReturnValue(true);
      const loss = new Event('webglcontextlost', { cancelable: true });
      f.canvas.dispatchEvent(loss);
      expect(loss.defaultPrevented).toBe(true);
      expect(first.lost).toBe(true);
      expect(notify).toHaveBeenCalledOnce();
      expect(() => second.render(f.frame)).toThrow('webgl-context-unavailable');
      expect(f.gl.deleteProgram).toHaveBeenCalledTimes(4);
      expect(f.gl.deleteTexture).toHaveBeenCalledTimes(3);
      expect(f.gl.deleteBuffer).toHaveBeenCalledOnce();
      f.gl.isContextLost.mockReturnValue(false);
      f.canvas.dispatchEvent(new Event('webglcontextrestored'));
      profiles(f.frame).forEach((frame) => first.render(frame));
      expect(inspectWebOpticalResources(document)).toMatchObject({
        contexts: 1,
        lost: false,
        programBuilds: 8,
        sourcePreparations: 2,
        sourceUploads: 2,
      });
      expect(f.canvas.getContext).toHaveBeenCalledOnce();
    } finally {
      first.release();
      second.release();
    }
    expect(f.gl.deleteProgram).toHaveBeenCalledTimes(8);
    expect(inspectWebOpticalResources(document).contexts).toBe(0);
  });

  it('releases cached resources if context loss is observed before the pool event', () => {
    const f = fixture();
    for (const frame of profiles(f.frame)) f.program.render(frame);
    f.gl.isContextLost.mockReturnValue(true);
    expect(() => f.program.render(f.frame)).toThrow('webgl-unavailable');
    expect(f.gl.deleteProgram).toHaveBeenCalledTimes(4);
    expect(f.gl.deleteTexture).toHaveBeenCalledTimes(3);
    f.gl.isContextLost.mockReturnValue(false);
    f.program.render(f.frame);
    expect(f.program.inspect()).toMatchObject({
      programBuilds: 5,
      sourcePreparations: 2,
      sourceUploads: 2,
    });
    f.program.dispose();
  });

  it.each(['draw', 'readback'])(
    'releases every cached profile when context is lost during %s',
    (phase) => {
      const f = fixture();
      for (const frame of profiles(f.frame)) f.program.render(frame);
      if (phase === 'draw') {
        f.gl.drawArrays.mockImplementation(() => f.gl.isContextLost.mockReturnValue(true));
      } else {
        const readPixels = f.gl.readPixels;
        f.gl.readPixels = (...args: unknown[]) => {
          readPixels(...args);
          f.gl.isContextLost.mockReturnValue(true);
        };
      }
      expect(() => f.program.render(f.frame)).toThrow(
        phase === 'draw' ? 'gpu-frame-failed' : 'gpu-readback-failed'
      );
      expect(f.gl.deleteProgram).toHaveBeenCalledTimes(4);
      expect(f.gl.deleteTexture).toHaveBeenCalledTimes(3);
      expect(f.gl.deleteBuffer).toHaveBeenCalledOnce();
      expect(f.canvas.toDataURL).toHaveBeenCalledTimes(4);
      expect(f.program.inspect()).toMatchObject({
        sourcePreparationCacheEntries: 0,
        sourcePreparationCacheBytes: 0,
      });
      f.program.dispose();
      expect(f.gl.deleteProgram).toHaveBeenCalledTimes(4);
    }
  );

  it('cleans both existing and failed program allocations before retrying', () => {
    const f = fixture();
    f.program.render(f.frame);
    f.gl.getProgramParameter = () => false;
    expect(() => f.program.render({ ...f.frame, tint: 'style-fill' })).toThrow('program-link');
    expect(new Set(f.gl.deleteProgram.mock.calls.map((call: unknown[]) => call[0]))).toEqual(
      new Set(f.programs)
    );
    expect(f.gl.deleteProgram).toHaveBeenCalledTimes(2);
    expect(f.gl.deleteShader).toHaveBeenCalledTimes(4);
    expect(f.gl.deleteTexture).toHaveBeenCalledTimes(3);
    f.gl.getProgramParameter = () => true;
    f.program.render(f.frame);
    expect(f.program.inspect()).toMatchObject({
      programBuilds: 3,
      sourcePreparations: 2,
      sourceUploads: 2,
    });
    f.program.dispose();
  });
});

describe('same-frame profile 4 proof inputs (GL spy, no precision certification)', () => {
  it('rewrites the bound and polarity on every static/contact frame without touching neutral ABI', () => {
    const f = fixture();
    const sourcePairs = [
      [
        [0, 97 / 255, 204 / 255, 1],
        [1, 1, 1, 1],
      ],
      [
        [0, 97 / 255, 204 / 255, 1],
        [0.95, 0.95, 0.95, 1],
      ],
      [
        [0.08, 0.12, 0.18, 1],
        [0.75, 0.8, 0.85, 1],
      ],
      [
        [0.85, 0.7, 0.95, 1],
        [0.05, 0.05, 0.05, 1],
      ],
      [
        [0, 97 / 255, 204 / 255, 1],
        [1, 1, 1, 1],
      ],
    ] as const;
    expect(sourcePairs[1][0]).toEqual(sourcePairs[0][0]);
    expect(styleTintEnvelope(...sourcePairs[1]).luminanceBound).not.toBe(
      styleTintEnvelope(...sourcePairs[0]).luminanceBound
    );
    let expectedWrites = 0;
    try {
      for (const [fill, foreground] of sourcePairs)
        for (const contact of [
          undefined,
          { x: 0.2, y: 0.8, deltaX: 0.3, deltaY: -0.4, strength: 0 },
          { x: 0.2, y: 0.8, deltaX: 0.3, deltaY: -0.4, strength: 1 },
        ]) {
          const envelope = styleTintEnvelope(fill, foreground);
          f.gl.readPixels = (...args: unknown[]) => {
            const pixels = args[6] as Uint8Array;
            for (let at = 0; at < pixels.length; at += 4)
              pixels.set(envelope.lightForeground ? [0, 0, 0, 255] : [255, 255, 255, 255], at);
          };
          f.program.render({ ...f.frame, fill, foreground, contact, tint: 'style-fill' });
          expectedWrites++;
          expect(f.writes.get('u_styleTintLuminanceBound')).toBe(envelope.luminanceBound);
          expect(f.writes.get('u_styleTintLightForeground')).toBe(Number(envelope.lightForeground));
          expect(f.writes.get('u_tint')).toEqual(fill);
          const boundWrites = () =>
            f.gl.uniform1f.mock.calls.filter(
              ([location]: [{ name: string }]) => location.name === 'u_styleTintLuminanceBound'
            );
          expect(boundWrites()).toHaveLength(expectedWrites);
          // Identical neutral source and uniform writes survive every interleave.
          const firstWrite = f.gl.uniform1f.mock.calls.length;
          f.program.render({ ...f.frame, fill, foreground, contact });
          expect(boundWrites()).toHaveLength(expectedWrites);
          expect(
            f.gl.uniform1f.mock.calls
              .slice(firstWrite)
              .every(([location]: [{ name: string }]) => !location.name.startsWith('u_styleTint'))
          ).toBe(true);
        }
      expect(f.program.inspect()).toMatchObject({ programBuilds: 4, sourceUploads: 1 });
      expect(f.shaderSources.filter((s) => !s.includes('styleTint'))).toContain(fragment);
      expect(f.shaderSources.filter((s) => !s.includes('styleTint'))).toContain(contactFragment);
    } finally {
      f.program.dispose();
    }
  });
  it('rejects opaque bytes safe only for nominal foreground, retaining neutral behavior', () => {
    const f = fixture();
    f.gl.readPixels = (...args: unknown[]) => {
      const pixels = args[6] as Uint8Array;
      for (let at = 0; at < pixels.length; at += 4) pixels.set([118, 118, 118, 255], at);
    };
    const frame = {
      ...f.frame,
      fill: [0, 97 / 255, 204 / 255, 1] as const,
      foreground: [1, 1, 1, 1] as const,
    };
    try {
      expect(() => f.program.render(frame)).not.toThrow();
      expect(() => f.program.render({ ...frame, tint: 'style-fill' })).toThrow(
        'rendered-contrast-unsafe'
      );
      expect(f.canvas.toDataURL).toHaveBeenCalledTimes(1);
    } finally {
      f.program.dispose();
    }
  });
  it.each([250, 251, 252, 253, 254, 255])(
    'checks same-worst-foreground black/white composition at alpha %i',
    (alpha) => {
      for (const light of [true, false]) {
        const f = fixture();
        const foreground = (light ? [1, 1, 1, 1] : [0, 0, 0, 1]) as OpticalFrame['foreground'];
        const fill = (light ? [0, 0, 0, 1] : [1, 1, 1, 1]) as OpticalFrame['fill'];
        const frame: OpticalFrame = { ...f.frame, fill, foreground, tint: 'style-fill' };
        let safe = true;
        f.gl.readPixels = (...args: unknown[]) => {
          const pixels = args[6] as Uint8Array;
          for (let at = 0; at < pixels.length; at += 4)
            pixels.set(light ? [0, 0, 0, 255] : [255, 255, 255, 255], at);
          const code = safe ? (light ? 0 : alpha) : light ? 122 - (255 - alpha) : 114;
          pixels.set([code, code, code, alpha], 0);
        };
        try {
          expect(() => f.program.render(frame)).not.toThrow();
          safe = false;
          expect(() => f.program.render(frame)).toThrow('rendered-contrast-unsafe');
          expect(f.canvas.toDataURL).toHaveBeenCalledTimes(1);
        } finally {
          f.program.dispose();
        }
      }
    }
  );
  it('rejects an empty proof budget before allocating GPU resources', () => {
    const f = fixture();
    try {
      expect(() =>
        f.program.render({ ...f.frame, tint: 'style-fill', foreground: [0.46, 0.46, 0.46, 1] })
      ).toThrow('style-tint-empty-budget');
      expect(f.shaderSources).toEqual([]);
      expect(f.canvas.toDataURL).not.toHaveBeenCalled();
    } finally {
      f.program.dispose();
    }
  });
});

// Frozen pre-optimization readback predicate. Keep scalar colorContrast and
// styleTintLightForeground as the independent reference for the RGBA8 lookup
// path; a passing spy says nothing about actual GPU precision or screen paint.
function referenceReadback(pixels: Uint8Array, frame: OpticalFrame): string | null {
  const envelope = frame.tint ? styleTintEnvelope(frame.fill, frame.foreground) : null;
  let opaque = 0;
  for (let at = 0; at < pixels.length; at += 4) {
    const alpha = pixels[at + 3];
    if (alpha === 255) opaque++;
    if (envelope && alpha >= 250) {
      for (const backdrop of alpha === 255 ? [0] : [0, 1]) {
        const composite: OpaqueRgba = [
          pixels[at] / 255 + (1 - alpha / 255) * backdrop,
          pixels[at + 1] / 255 + (1 - alpha / 255) * backdrop,
          pixels[at + 2] / 255 + (1 - alpha / 255) * backdrop,
          1,
        ];
        if (
          composite.slice(0, 3).some((channel) => channel > 1) ||
          colorContrast(composite, envelope.worstForeground) < 4.5 ||
          styleTintLightForeground(composite, envelope.worstForeground) !== envelope.lightForeground
        )
          return 'rendered-contrast-unsafe';
      }
    } else if (
      alpha >= 250 &&
      colorContrast(
        [pixels[at] / 255, pixels[at + 1] / 255, pixels[at + 2] / 255, 1],
        frame.foreground
      ) < 4.5
    )
      return 'rendered-contrast-unsafe';
  }
  return frame.tint && opaque === 0 ? 'rendered-style-tint-empty' : null;
}

describe('readback CPU optimization equivalence and lifetime (no GPU evidence)', () => {
  it('retains the scalar predicate across RGBA8 boundaries, palettes and consecutive frames', () => {
    const f = fixture();
    const palettes: [OpaqueRgba, OpaqueRgba][] = [
      [
        [0, 97 / 255, 204 / 255, 1],
        [1, 1, 1, 1],
      ],
      [
        [0.08, 0.12, 0.18, 1],
        [0.75, 0.8, 0.85, 1],
      ],
      [
        [1, 1, 1, 1],
        [0, 0, 0, 1],
      ],
      [
        [0.85, 0.7, 0.95, 1],
        [0.05, 0.05, 0.05, 1],
      ],
    ];
    // Uniform ownership is tested above; avoid storing thousands of unrelated
    // uniform-spy records in this numerical differential test.
    for (const name of ['uniform1f', 'uniform1i', 'uniform2fv', 'uniform4fv'])
      f.gl[name] = () => {};
    let sample = new Uint8Array(8);
    f.gl.readPixels = (...args: unknown[]) => (args[6] as Uint8Array).set(sample);
    const mismatches: unknown[] = [];
    let seed = 0x6149af;
    try {
      for (const [fill, foreground] of palettes) {
        const light = styleTintLightForeground(fill, foreground);
        for (const tint of [undefined, 'style-fill'] as const) {
          const frame: OpticalFrame = {
            ...f.frame,
            geometry: { ...f.frame.geometry, width: 2, height: 1 },
            fill,
            foreground,
            ...(tint ? { tint } : {}),
          };
          for (const alpha of [0, 249, 250, 251, 252, 253, 254, 255]) {
            const colors: number[][] = [];
            // Include every grayscale transition of the old admission predicate,
            // both adjacent bytes, premultiplication boundaries and sRGB's join.
            let previous: string | null | undefined;
            for (let code = 0; code < 256; code++) {
              const candidate = new Uint8Array([
                code,
                code,
                code,
                alpha,
                ...(light ? [0, 0, 0, 255] : [255, 255, 255, 255]),
              ]);
              const result = referenceReadback(candidate, frame);
              if (result !== previous || [0, 10, 11, alpha, 255].includes(code))
                for (const neighbor of [code - 1, code, code + 1])
                  if (neighbor >= 0 && neighbor <= 255) colors.push([neighbor, neighbor, neighbor]);
              previous = result;
            }
            for (let i = 0; i < 24; i++)
              colors.push(
                Array.from({ length: 3 }, () => {
                  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
                  return seed >>> 24;
                })
              );
            for (const rgb of colors) {
              sample = new Uint8Array([
                ...rgb,
                alpha,
                ...(light ? [0, 0, 0, 255] : [255, 255, 255, 255]),
              ]);
              const expected = referenceReadback(sample, frame);
              let actual: string | null = null;
              try {
                f.program.render(frame);
              } catch (error) {
                actual = (error as Error).message;
              }
              if (actual !== expected)
                mismatches.push({ fill, foreground, tint, sample: [...sample], expected, actual });
            }
          }
        }
      }
      expect(mismatches).toEqual([]);
      expect(f.program.inspect().readbackAllocations).toBe(1);
    } finally {
      f.program.dispose();
    }
  });

  it('reuses only one current-size readback buffer and releases it on clear', () => {
    const f = fixture();
    const buffers: Uint8Array[] = [];
    f.gl.readPixels = (...args: unknown[]) => {
      const pixels = args[6] as Uint8Array;
      buffers.push(pixels);
      pixels.fill(255);
    };
    try {
      f.program.render(f.frame);
      f.program.render({ ...f.frame, pressed: true });
      expect(buffers[0]).toBe(buffers[1]);
      const larger = { ...f.frame, geometry: { ...f.frame.geometry, width: 3 } };
      f.program.render(larger);
      expect(buffers[2]).not.toBe(buffers[1]);
      f.program.render(larger);
      expect(buffers[3]).toBe(buffers[2]);
      f.program.clear();
      f.program.render(larger);
      expect(buffers[4]).not.toBe(buffers[3]);
      expect(f.program.inspect().readbackAllocations).toBe(3);
    } finally {
      f.program.dispose();
    }
  });

  it('still scans current source opacity even when the same frame was uploaded before', () => {
    const f = fixture();
    try {
      f.program.render(f.frame);
      f.frame.source.pixels[3] = 254;
      expect(() => f.program.render(f.frame)).toThrow('nonopaque-optical-source');
      expect(f.canvas.toDataURL).toHaveBeenCalledTimes(1);
    } finally {
      f.program.dispose();
    }
  });
});
