/**
 * Draft, finite pass/resource presentation contract.
 * This is a data-only material declaration, not author-provided shader text or a
 * grant to sample a host surface. Backend modules own actual GPU resources.
 */
export type ShaderRgba = readonly [number, number, number, number];
export type ShaderOpaqueColor = readonly [number, number, number, 1];
export type ShaderKernel = 'copy-rgba8-v1' | 'tint-rgba8-v1';
export type ShaderPresentationSource =
  | Readonly<{
      kind: 'owned-pixels';
      width: number;
      height: number;
      /** Dense detached premultiplied RGBA8 bytes, row-major from the top left. */
      pixels: readonly number[];
      colorSpace: 'linear-srgb';
      alpha: 'premultiplied';
      origin: 'top-left';
    }>
  | Readonly<{
      /** Explicit application scene slot; the whole texture maps to surface UV. */
      kind: 'owned-scene';
      slot: string;
    }>;
export type ShaderPass = Readonly<{
  id: string;
  kernel: ShaderKernel;
  /** "$source" or an earlier pass ID. A current attachment is never readable. */
  input: string;
  /** Required only for tint; straight linear RGBA multipliers in [0,1]. */
  tint?: ShaderRgba;
}>;
export type ShaderPresentationDeclaration = Readonly<{
  version: 1;
  source: ShaderPresentationSource;
  passes: readonly ShaderPass[];
  /** The final ordered pass. Earlier outputs remain explicit temporary resources. */
  output: string;
  /** Complete opaque fallback fill in ordinary sRGB; authored foreground is retained. */
  fallback: ShaderOpaqueColor;
}>;

export const SHADER_PRESENTATION_LIMITS = Object.freeze({
  maxExtent: 1024,
  maxTexels: 262_144,
  maxPasses: 16,
  maxResourceBytes: 16 * 1024 * 1024,
});

function fail(message: string): never {
  throw new TypeError(`[feedback.material.shader] ${message}`);
}
function fields(value: unknown, required: readonly string[], optional: readonly string[] = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return fail('own data record required');
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return fail('plain record required');
  const keys = Reflect.ownKeys(value);
  const result: Record<string, unknown> = Object.create(null);
  for (const key of keys) {
    if (typeof key !== 'string' || (!required.includes(key) && !optional.includes(key)))
      return fail('unknown field');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor))
      return fail('own enumerable data required');
    result[key] = descriptor.value;
  }
  if (required.some((key) => !Object.hasOwn(result, key))) return fail('missing field');
  return result;
}
function dense(value: unknown, expected: number): unknown[] {
  if (!Array.isArray(value) || value.length !== expected)
    return fail('dense array length mismatch');
  if (Object.getPrototypeOf(value) !== Array.prototype) return fail('plain array required');
  const keys = Reflect.ownKeys(value);
  if (keys.length !== expected + 1) return fail('dense own data array required');
  const result: unknown[] = [];
  for (let i = 0; i < expected; i++) {
    const entry = Object.getOwnPropertyDescriptor(value, String(i));
    if (!entry || !entry.enumerable || !('value' in entry))
      return fail('array accessors or holes are unsupported');
    result.push(entry.value);
  }
  return result;
}
function integer(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max)
    return fail('integer outside resource budget');
  return value;
}
function color(value: unknown, opaque = false): ShaderRgba {
  const values = dense(value, 4).map((value) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1)
      return fail('finite RGBA channels in [0,1] required');
    return value;
  });
  if (opaque && values[3] !== 1) return fail('opaque fallback required');
  return Object.freeze(values) as unknown as ShaderRgba;
}

/** Validate without invoking authored accessors; copy every mutable input before publication. */
export function snapshotShaderPresentation(
  value: ShaderPresentationDeclaration
): ShaderPresentationDeclaration {
  const declaration = fields(value, ['version', 'source', 'passes', 'output', 'fallback']);
  if (declaration.version !== 1) return fail('unsupported graph version');
  if (!Array.isArray(declaration.passes)) return fail('ordered passes required');
  const count = integer(declaration.passes.length, 1, SHADER_PRESENTATION_LIMITS.maxPasses);
  const source = fields(
    declaration.source,
    ['kind'],
    ['slot', 'width', 'height', 'pixels', 'colorSpace', 'alpha', 'origin']
  );
  let ownedSource: ShaderPresentationSource;
  if (source.kind === 'owned-scene') {
    if (Object.keys(source).length !== 2) return fail('unknown source field');
    if (typeof source.slot !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(source.slot))
      return fail('finite owned-scene slot required');
    ownedSource = Object.freeze({ kind: 'owned-scene', slot: source.slot });
  } else {
    if (Object.hasOwn(source, 'slot')) return fail('unknown source field');
    if (
      source.kind !== 'owned-pixels' ||
      source.colorSpace !== 'linear-srgb' ||
      source.alpha !== 'premultiplied' ||
      source.origin !== 'top-left'
    )
      return fail('unsupported source contract');
    const width = integer(source.width, 1, SHADER_PRESENTATION_LIMITS.maxExtent);
    const height = integer(source.height, 1, SHADER_PRESENTATION_LIMITS.maxExtent);
    const texels = width * height;
    if (texels > SHADER_PRESENTATION_LIMITS.maxTexels) return fail('source texel budget exceeded');
    if ((count + 1) * texels * 4 > SHADER_PRESENTATION_LIMITS.maxResourceBytes)
      return fail('resource byte budget exceeded');
    const pixels = dense(source.pixels, texels * 4).map((value) => integer(value, 0, 255));
    for (let offset = 0; offset < pixels.length; offset += 4)
      if (pixels.slice(offset, offset + 3).some((channel) => channel > pixels[offset + 3]))
        return fail('source RGB must be premultiplied by alpha');
    ownedSource = Object.freeze({
      kind: 'owned-pixels',
      width,
      height,
      pixels: Object.freeze(pixels),
      colorSpace: 'linear-srgb',
      alpha: 'premultiplied',
      origin: 'top-left',
    });
  }
  const written = new Set(['$source']);
  const passes = dense(declaration.passes, count).map((value) => {
    const pass = fields(value, ['id', 'kernel', 'input'], ['tint']);
    if (
      typeof pass.id !== 'string' ||
      !/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(pass.id) ||
      written.has(pass.id)
    )
      return fail('distinct finite pass ID required');
    if (typeof pass.input !== 'string' || !written.has(pass.input))
      return fail('pass input must be a previously produced resource');
    if (pass.kernel !== 'copy-rgba8-v1' && pass.kernel !== 'tint-rgba8-v1')
      return fail('unsupported audited kernel');
    if (pass.kernel === 'copy-rgba8-v1' && Object.hasOwn(pass, 'tint'))
      return fail('copy does not accept tint');
    if (pass.kernel === 'tint-rgba8-v1' && !Object.hasOwn(pass, 'tint'))
      return fail('tint requires its complete uniform');
    const copy: ShaderPass = Object.freeze({
      id: pass.id,
      kernel: pass.kernel,
      input: pass.input,
      ...(pass.kernel === 'tint-rgba8-v1' ? { tint: color(pass.tint) } : {}),
    });
    written.add(pass.id);
    return copy;
  });
  if (declaration.output !== passes.at(-1)!.id)
    return fail('output must name the final ordered pass');
  return Object.freeze({
    version: 1,
    source: ownedSource,
    passes: Object.freeze(passes),
    output: declaration.output as string,
    fallback: color(declaration.fallback, true) as ShaderOpaqueColor,
  });
}
