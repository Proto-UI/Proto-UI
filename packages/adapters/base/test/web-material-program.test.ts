import { describe, expect, it, vi } from 'vitest';
import { createWebOpticalProgram } from '../src/material/program';
import { vertex, fragment } from '../src/material/liquidgl-kernel.generated';
function fixture(
  control: 'zero-refraction' | 'zero-deformation' | 'zero-aberration' | null = null
) {
  const shaderSources: string[] = [],
    writes = new Map<string, unknown>();
  const gl: any = {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    COMPILE_STATUS: 3,
    LINK_STATUS: 4,
    NO_ERROR: 0,
    createShader: () => ({}),
    shaderSource: (_: unknown, source: string) => shaderSources.push(source),
    getShaderParameter: () => true,
    createProgram: () => ({}),
    getProgramParameter: () => true,
    getUniformLocation: (_: unknown, name: string) => name,
    createBuffer: () => ({}),
    getAttribLocation: () => 0,
    createTexture: () => ({}),
    isContextLost: () => false,
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
    getExtension: () => null,
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
  for (const name of ['uniform1f', 'uniform1i', 'uniform2fv', 'uniform4fv'])
    gl[name] = (location: string, value: unknown) => writes.set(location, value);
  const canvas = document.createElement('canvas');
  vi.spyOn(canvas, 'getContext').mockReturnValue(gl);
  vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/png;base64,AA==');
  const program = createWebOpticalProgram(canvas, control);
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
  return { program, frame, writes, shaderSources, gl };
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
