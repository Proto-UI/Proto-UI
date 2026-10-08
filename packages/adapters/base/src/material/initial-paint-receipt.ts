import type { VisualFeedbackFrame } from '@proto.ui/module-feedback';
import type { OpticalFrame, OpticalGeometry } from './program';
import type { OpaqueRgba } from './style';

/** Internal experiment only. No public material/compiler capability is enabled. */
export const INITIAL_PAINT_PROFILE = 'pui-internal-static-rest-seed-1' as const;
export type InitialPaintLayout = Readonly<{
  id: string;
  viewportWidth: number;
  viewportHeight: number;
  dpr: number;
  theme: 'light' | 'dark';
}>;
export type InitialPaintReceipt = Readonly<{
  version: typeof INITIAL_PAINT_PROFILE;
  renderer: 'liquidgl-v2-app-canvas-1';
  layout: InitialPaintLayout;
  source: Readonly<{
    width: number;
    height: number;
    rgbaSha256: string;
    pngDataUrl: string;
    pngSha256: string;
  }>;
  geometry: OpticalGeometry;
  variant: 'regular' | 'clear';
  fill: OpaqueRgba;
  foreground: OpaqueRgba;
  tokens: readonly string[];
  materialKey: string;
  image: Readonly<{ dataUrl: string; pngSha256: string }>;
}>;
export type InitialPaintManifestBinding = Readonly<{
  artifactSha256: string;
  layoutId: string;
  profile: typeof INITIAL_PAINT_PROFILE;
}>;

export const materialKey = (frame: VisualFeedbackFrame) =>
  JSON.stringify({
    slot: frame.material.slot,
    candidates: frame.material.candidates,
  });
export async function digestBytes(bytes: Uint8Array): Promise<string> {
  const copy = Uint8Array.from(bytes);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', copy);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
export const digestText = (text: string) => digestBytes(new TextEncoder().encode(text));

export function pngBytes(dataUrl: string): Uint8Array {
  if (dataUrl.length > 8_000_000 || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(dataUrl))
    throw new Error('seed-image-must-be-bounded-local-png');
  const raw = atob(dataUrl.slice('data:image/png;base64,'.length));
  const bytes = Uint8Array.from(raw, (character) => character.charCodeAt(0));
  if (
    bytes.length < 33 ||
    [137, 80, 78, 71, 13, 10, 26, 10].some((byte, index) => bytes[index] !== byte) ||
    new TextDecoder().decode(bytes.slice(12, 16)) !== 'IHDR'
  )
    throw new Error('seed-png-header-invalid');
  return bytes;
}
const hash = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const finitePositive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;
const color = (value: unknown): value is OpaqueRgba =>
  Array.isArray(value) &&
  value.length === 4 &&
  value[3] === 1 &&
  value.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1);
const keys = (value: unknown, expected: string[]) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).sort().join('|') === [...expected].sort().join('|');

export function parseInitialPaintReceipt(serialized: string): InitialPaintReceipt {
  if (serialized.length > 16_200_000) throw new Error('seed-artifact-budget');
  const value = JSON.parse(serialized);
  if (
    !keys(value, [
      'version',
      'renderer',
      'layout',
      'source',
      'geometry',
      'variant',
      'fill',
      'foreground',
      'tokens',
      'materialKey',
      'image',
    ]) ||
    value.version !== INITIAL_PAINT_PROFILE ||
    value.renderer !== 'liquidgl-v2-app-canvas-1' ||
    !['regular', 'clear'].includes(value.variant) ||
    !color(value.fill) ||
    !color(value.foreground) ||
    !Array.isArray(value.tokens) ||
    value.tokens.length > 128 ||
    value.tokens.some((token: unknown) => typeof token !== 'string' || token.length > 512) ||
    new Set(value.tokens).size !== value.tokens.length ||
    typeof value.materialKey !== 'string' ||
    value.materialKey.length > 4096
  )
    throw new Error('seed-receipt-shape-invalid');
  const layout = value.layout,
    source = value.source,
    geometry = value.geometry;
  if (
    !keys(layout, ['id', 'viewportWidth', 'viewportHeight', 'dpr', 'theme']) ||
    typeof layout.id !== 'string' ||
    !/^[a-z][a-z0-9-]{0,63}$/.test(layout.id) ||
    !Number.isSafeInteger(layout.viewportWidth) ||
    !Number.isSafeInteger(layout.viewportHeight) ||
    layout.viewportWidth < 1 ||
    layout.viewportWidth > 8192 ||
    layout.viewportHeight < 1 ||
    layout.viewportHeight > 8192 ||
    !finitePositive(layout.dpr) ||
    layout.dpr < 0.5 ||
    layout.dpr > 3 ||
    !['light', 'dark'].includes(layout.theme)
  )
    throw new Error('seed-layout-invalid');
  if (
    !keys(source, ['width', 'height', 'rgbaSha256', 'pngDataUrl', 'pngSha256']) ||
    !Number.isSafeInteger(source.width) ||
    !Number.isSafeInteger(source.height) ||
    source.width < 1 ||
    source.height < 1 ||
    source.width > 2048 ||
    source.height > 2048 ||
    source.width * source.height > 1048576 ||
    !hash(source.rgbaSha256) ||
    !hash(source.pngSha256) ||
    typeof source.pngDataUrl !== 'string'
  )
    throw new Error('seed-source-invalid');
  const sourcePng = pngBytes(source.pngDataUrl),
    sourceView = new DataView(sourcePng.buffer, sourcePng.byteOffset, sourcePng.byteLength);
  if (sourceView.getUint32(16) !== source.width || sourceView.getUint32(20) !== source.height)
    throw new Error('seed-source-png-dimensions-mismatch');
  if (
    !keys(geometry, ['width', 'height', 'radius', 'paintOutset', 'dpr', 'bounds']) ||
    !finitePositive(geometry.width) ||
    !finitePositive(geometry.height) ||
    geometry.width > 2048 ||
    geometry.height > 2048 ||
    !Number.isFinite(geometry.radius) ||
    geometry.radius < 0 ||
    geometry.radius > Math.min(geometry.width, geometry.height) / 2 ||
    geometry.paintOutset !== 0 ||
    geometry.dpr !== layout.dpr ||
    !Array.isArray(geometry.bounds) ||
    geometry.bounds.length !== 4 ||
    geometry.bounds.some((n: unknown) => typeof n !== 'number' || !Number.isFinite(n)) ||
    geometry.bounds[0] < 0 ||
    geometry.bounds[1] < 0 ||
    geometry.bounds[2] <= 0 ||
    geometry.bounds[3] <= 0 ||
    geometry.bounds[0] + geometry.bounds[2] > 1 ||
    geometry.bounds[1] + geometry.bounds[3] > 1 ||
    Math.ceil(geometry.width * geometry.dpr) > 2048 ||
    Math.ceil(geometry.height * geometry.dpr) > 2048 ||
    Math.ceil(geometry.width * geometry.dpr) * Math.ceil(geometry.height * geometry.dpr) > 1048576
  )
    throw new Error('seed-geometry-invalid');
  if (
    !keys(value.image, ['dataUrl', 'pngSha256']) ||
    typeof value.image.dataUrl !== 'string' ||
    !hash(value.image.pngSha256)
  )
    throw new Error('seed-image-invalid');
  const bytes = pngBytes(value.image.dataUrl),
    view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    view.getUint32(16) !== Math.ceil(geometry.width * geometry.dpr) ||
    view.getUint32(20) !== Math.ceil(geometry.height * geometry.dpr)
  )
    throw new Error('seed-output-dimensions-mismatch');
  for (const part of [
    layout,
    source,
    geometry.bounds,
    geometry,
    value.tokens,
    value.fill,
    value.foreground,
    value.image,
  ])
    Object.freeze(part);
  return Object.freeze(value);
}

/** Called only from an armed successful real-sink paint, after its full policy
 * and image-decode checks. Recording a hash alone never certifies live optics. */
export async function receiptFromAdmittedPaint(
  layout: InitialPaintLayout,
  visual: VisualFeedbackFrame,
  optical: OpticalFrame,
  image: string
): Promise<InitialPaintReceipt> {
  if (
    optical.pressed ||
    optical.contact ||
    (optical.geometry.paintOutset ?? 0) !== 0 ||
    visual.material.candidates.length !== 1 ||
    visual.material.candidates[0].intent !== 'liquid-glass' ||
    visual.material.candidates[0].deformation
  )
    throw new Error('seed-only-supports-static-rest-surface');
  // Snapshot every scalar before hashing can yield; do not read mutable source
  // or frame metadata again after the asynchronous boundary.
  const pixels = Uint8Array.from(optical.source.pixels);
  const canvas = optical.source.canvas;
  const visible = canvas
    .getContext('2d', { willReadFrequently: true })
    ?.getImageData(0, 0, canvas.width, canvas.height).data;
  if (
    canvas.width !== optical.source.width ||
    canvas.height !== optical.source.height ||
    !visible ||
    visible.length !== pixels.length ||
    visible.some((byte, index) => byte !== pixels[index])
  )
    throw new Error('seed-source-canvas-pixels-mismatch');
  const sourcePng = optical.source.canvas.toDataURL('image/png');
  const source = { width: optical.source.width, height: optical.source.height };
  const geometry = {
    width: optical.geometry.width,
    height: optical.geometry.height,
    radius: optical.geometry.radius,
    dpr: optical.geometry.dpr,
    paintOutset: 0,
    bounds: [...optical.geometry.bounds],
  };
  const inputs = {
    layout: { ...layout },
    geometry,
    variant: optical.variant,
    fill: [...optical.fill],
    foreground: [...optical.foreground],
    tokens: [...visual.style.tokens],
    materialKey: materialKey(visual),
  };
  const [rgbaSha256, pngSha256, outputSha256] = await Promise.all([
    digestBytes(pixels),
    digestBytes(pngBytes(sourcePng)),
    digestBytes(pngBytes(image)),
  ]);
  return parseInitialPaintReceipt(
    JSON.stringify({
      version: INITIAL_PAINT_PROFILE,
      renderer: 'liquidgl-v2-app-canvas-1',
      ...inputs,
      source: { ...source, rgbaSha256, pngDataUrl: sourcePng, pngSha256 },
      image: { dataUrl: image, pngSha256: outputSha256 },
    })
  );
}

export async function verifyInitialPaintArtifact(
  serialized: string,
  binding: InitialPaintManifestBinding
) {
  if (
    binding.profile !== INITIAL_PAINT_PROFILE ||
    !hash(binding.artifactSha256) ||
    (await digestText(serialized)) !== binding.artifactSha256
  )
    throw new Error('seed-build-manifest-mismatch');
  const receipt = parseInitialPaintReceipt(serialized);
  if (receipt.layout.id !== binding.layoutId) throw new Error('seed-layout-binding-mismatch');
  const [sourceHash, imageHash] = await Promise.all([
    digestBytes(pngBytes(receipt.source.pngDataUrl)),
    digestBytes(pngBytes(receipt.image.dataUrl)),
  ]);
  if (sourceHash !== receipt.source.pngSha256 || imageHash !== receipt.image.pngSha256)
    throw new Error('seed-png-integrity-mismatch');
  return receipt;
}
