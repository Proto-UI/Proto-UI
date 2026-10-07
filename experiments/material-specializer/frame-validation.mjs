// Emitted verbatim into the target writer; own code, not a shader interpreter.
export function validateFrame(frame) {
  const vector = (value, length, min, max) =>
    Array.isArray(value) &&
    value.length === length &&
    Array.from(
      { length },
      (_, i) =>
        Object.hasOwn(value, i) &&
        typeof value[i] === 'number' &&
        Number.isFinite(value[i]) &&
        value[i] >= min &&
        value[i] <= max
    ).every(Boolean);
  if (
    !frame ||
    typeof frame !== 'object' ||
    Object.keys(frame).sort().join('|') !==
      [
        'viewport',
        'textureSize',
        'bounds',
        'subpixel',
        'boxSize',
        'dpr',
        'radius',
        'pressed',
        'disabled',
      ]
        .sort()
        .join('|')
  )
    throw new Error('Invalid complete material frame');
  if (
    !vector(frame.viewport, 2, 1, 2048) ||
    !vector(frame.textureSize, 2, 1, 2048) ||
    !vector(frame.boxSize, 2, 1, 2048) ||
    !vector(frame.subpixel, 2, 0, 2048) ||
    !vector(frame.bounds, 4, 0, 1)
  )
    throw new Error('Invalid finite frame geometry');
  if (!frame.viewport.every(Number.isInteger) || !frame.textureSize.every(Number.isInteger))
    throw new Error('Physical texture and viewport sizes must be integral');
  if (
    frame.viewport[0] * frame.viewport[1] > 1048576 ||
    frame.textureSize[0] * frame.textureSize[1] > 1048576 ||
    frame.boxSize[0] * frame.boxSize[1] > 1048576
  )
    throw new Error('Frame exceeds texel budget');
  if (
    frame.bounds[2] <= 0 ||
    frame.bounds[3] <= 0 ||
    frame.bounds[0] + frame.bounds[2] > 1 ||
    frame.bounds[1] + frame.bounds[3] > 1
  )
    throw new Error('Source bounds exceed the owned texture');
  if (
    typeof frame.radius !== 'number' ||
    !Number.isFinite(frame.radius) ||
    frame.radius < 0 ||
    frame.radius > 2048 ||
    typeof frame.dpr !== 'number' ||
    !Number.isFinite(frame.dpr) ||
    frame.dpr < 0.5 ||
    frame.dpr > 3 ||
    typeof frame.pressed !== 'boolean' ||
    typeof frame.disabled !== 'boolean'
  )
    throw new Error('Invalid state or DPR');
}
