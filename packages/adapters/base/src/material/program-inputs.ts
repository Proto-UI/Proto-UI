import type { OpticalFrame } from './program';
import { styleTintEnvelope } from './style-tint-profile';

/** Pure pre-GL admission shared with the source-notification continuation.
 * The program still executes every guard on every actual render. */
export function validateOpticalFrameInputs(frame: OpticalFrame) {
  const { source, geometry, variant, contact } = frame;
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
  if (
    contact &&
    ![contact.x, contact.y, contact.deltaX, contact.deltaY, contact.strength].every(Number.isFinite)
  )
    throw new Error('invalid-optical-contact');
  return { width, height, outset, tintEnvelope };
}
