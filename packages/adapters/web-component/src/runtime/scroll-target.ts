/** Acquire both existing physical-target notifications as one all-cleanup lease. */
export function subscribeScrollTarget(
  subscribeSurface: (listener: () => void) => () => void,
  subscribeReady: (listener: () => void) => () => void,
  listener: () => void
): () => void {
  const offSurface = subscribeSurface(listener);
  let offReady: () => void;
  try {
    offReady = subscribeReady(listener);
  } catch (error) {
    try {
      offSurface();
    } catch {
      /* Preserve the initiating registration failure, including falsy values. */
    }
    throw error;
  }
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    let failed = false;
    let failure: unknown;
    try {
      offSurface();
    } catch (error) {
      failed = true;
      failure = error;
    }
    try {
      offReady();
    } catch (error) {
      if (!failed) {
        failed = true;
        failure = error;
      }
    }
    if (failed) throw failure;
  };
}
