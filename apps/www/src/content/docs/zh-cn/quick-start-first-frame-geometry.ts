/** Native viewport/document geometry, independent of relative prose rhythm. */
export interface FirstFrameGeometry {
  header: { x: number; y: number; width: number; height: number };
  title: { viewportX: number; viewportY: number; documentX: number; documentY: number };
  scroll: { x: number; y: number };
}
export function changedFirstFrameGeometry(before: FirstFrameGeometry, after: FirstFrameGeometry) {
  const changes: string[] = [];
  const keys = {
    header: ['x', 'y', 'width', 'height'],
    title: ['viewportX', 'viewportY', 'documentX', 'documentY'],
    scroll: ['x', 'y'],
  } as const;
  for (const group of ['header', 'title', 'scroll'] as const) {
    const initial = before?.[group] as Record<string, number> | undefined;
    const current = after?.[group] as Record<string, number> | undefined;
    for (const key of keys[group]) {
      const previous = initial?.[key];
      const next = current?.[key];
      if (
        !initial ||
        !current ||
        !Object.hasOwn(initial, key) ||
        !Object.hasOwn(current, key) ||
        !Number.isFinite(previous) ||
        !Number.isFinite(next) ||
        Math.abs(next! - previous!) > 1
      )
        changes.push(`${group}.${key}: ${previous} → ${next}`);
    }
  }
  return changes;
}
