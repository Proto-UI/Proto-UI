import { runAllSteps } from '@proto.ui/core/internal';

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
    runAllSteps([offSurface, offReady]);
  };
}
