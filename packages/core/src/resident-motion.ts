/** Setup-only persistent style interpolation. This is not presence or State. */
export type ResidentMotionProperty = 'translate' | 'background-color';
export type ResidentMotionDeclaration = Readonly<{
  properties: readonly ResidentMotionProperty[];
  durationMs: number;
  easing: readonly [number, number, number, number];
}>;
export function snapshotResidentMotion(
  value: ResidentMotionDeclaration
): ResidentMotionDeclaration {
  if (
    !value ||
    !Array.isArray(value.properties) ||
    !value.properties.length ||
    new Set(value.properties).size !== value.properties.length ||
    value.properties.some((p) => p !== 'translate' && p !== 'background-color') ||
    !Number.isFinite(value.durationMs) ||
    value.durationMs < 0 ||
    !Array.isArray(value.easing) ||
    value.easing.length !== 4 ||
    value.easing.some((n) => !Number.isFinite(n)) ||
    value.easing[0] < 0 ||
    value.easing[0] > 1 ||
    value.easing[2] < 0 ||
    value.easing[2] > 1
  )
    throw new Error('[feedback.motion] Invalid declaration');
  return Object.freeze({
    properties: Object.freeze([...value.properties]),
    durationMs: value.durationMs,
    easing: Object.freeze([...value.easing]) as unknown as ResidentMotionDeclaration['easing'],
  });
}
