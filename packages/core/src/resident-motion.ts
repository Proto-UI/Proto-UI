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
  const fail = (): never => {
    throw new Error('[feedback.motion] Invalid declaration');
  };
  const field = (object: object, key: PropertyKey): unknown => {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    if (!descriptor || !('value' in descriptor)) return fail();
    return descriptor.value;
  };
  if (!value || typeof value !== 'object') return fail();
  const dense = (input: unknown): unknown[] => {
    if (!Array.isArray(input)) return fail();
    return Array.from({ length: input.length }, (_, i) => field(input, String(i)));
  };
  const properties = dense(field(value, 'properties'));
  const easing = dense(field(value, 'easing'));
  const durationMs = field(value, 'durationMs');
  if (
    !properties.length ||
    new Set(properties).size !== properties.length ||
    properties.some((p) => p !== 'translate' && p !== 'background-color') ||
    typeof durationMs !== 'number' ||
    !Number.isFinite(durationMs) ||
    durationMs < 0 ||
    easing.length !== 4 ||
    easing.some((n) => typeof n !== 'number' || !Number.isFinite(n)) ||
    (easing[0] as number) < 0 ||
    (easing[0] as number) > 1 ||
    (easing[2] as number) < 0 ||
    (easing[2] as number) > 1
  )
    return fail();
  return Object.freeze({
    properties: Object.freeze(properties) as readonly ResidentMotionProperty[],
    durationMs,
    easing: Object.freeze(easing) as unknown as ResidentMotionDeclaration['easing'],
  });
}
