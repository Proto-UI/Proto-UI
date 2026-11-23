export type PortalBoundaryMeasurement = {
  viewportWidth: number;
  contentWidth: number;
  threshold: number;
};

/** Locate the actual CSS content boundary before the containment experiment.
 * Responsive padding makes a prediction measured at another viewport stale.
 * Keep each observation and fail boundedly; this never changes the oracle. */
export async function calibratePortalBoundary(
  initialViewportWidth: number,
  edge: number,
  measure: (viewportWidth: number) => Promise<PortalBoundaryMeasurement>
) {
  if (!Number.isInteger(initialViewportWidth) || initialViewportWidth <= 0)
    throw new Error('Invalid initial boundary viewport');
  if (![-1, 0, 1].includes(edge)) throw new Error('Invalid boundary control');
  const samples: Array<PortalBoundaryMeasurement & { requestedWidth: number; error: number }> = [];
  let requestedWidth = initialViewportWidth;
  for (let attempt = 0; attempt < 8; attempt++) {
    const current = await measure(requestedWidth);
    if (
      !Number.isInteger(current.viewportWidth) ||
      current.viewportWidth !== requestedWidth ||
      !Number.isFinite(current.contentWidth) ||
      current.contentWidth <= 0 ||
      !Number.isFinite(current.threshold) ||
      current.threshold <= 0
    )
      throw new Error('Invalid actual boundary measurement');
    const error = current.contentWidth - current.threshold - edge;
    samples.push({ requestedWidth, ...current, error });
    // The existing toBeCloseTo(edge, 0) requires a difference strictly below
    // 0.5 CSS px. Preserve it, including its strict boundary.
    if (Math.abs(error) < 0.5) return { calibrated: true, samples };
    const nextWidth = Math.round(requestedWidth - error);
    if (nextWidth <= 0 || nextWidth === requestedWidth) break;
    requestedWidth = nextWidth;
  }
  return { calibrated: false, samples };
}
