/** Decode the GPU-produced image before relinquishing opaque fallback. Holding
 * the decoded image until retirement keeps its backing resource owned while
 * the CSS background consumer adopts the identical local data URL. */
const emptyCounters = () => ({
  pendingImages: 0,
  decodedImages: 0,
  imagePreparations: 0,
  peakPendingImages: 0,
  imageDecodes: 0,
  imageDecodeMilliseconds: 0,
  imageDecodeFailures: 0,
  imageDecodeFailureMilliseconds: 0,
  imageDecodeCancellations: 0,
  imageDecodeCancellationMilliseconds: 0,
  imageReadyCallbacks: 0,
  imageReadyCallbackMilliseconds: 0,
  imageReadyCallbackFailures: 0,
});
const counters = new WeakMap<Document, ReturnType<typeof emptyCounters>>();
export function inspectOpticalImageResources(document: Document) {
  return { ...(counters.get(document) ?? emptyCounters()) };
}
export function prepareOpticalImage(
  document: Document,
  source: string,
  ready: () => void,
  failed: () => void
): () => void {
  const win = document.defaultView;
  if (!win) throw new Error('image-owner-document-unavailable');
  const image = new win.Image();
  const stats = counters.get(document) ?? emptyCounters();
  counters.set(document, stats);
  let live = true,
    pending = true;
  const started = win.performance.now();
  let observed = false;
  // Wall time from assigning a produced image through its decode settlement,
  // including browser scheduling. This is not decoder CPU time or presentation
  // latency. Every preparation contributes exactly one ready/failure/cancel
  // outcome; late settlement of a cancelled image never changes that outcome.
  const observe = (outcome: 'ready' | 'failed' | 'cancelled') => {
    if (observed) return;
    observed = true;
    const elapsed = win.performance.now() - started;
    if (outcome === 'ready') {
      stats.imageDecodes++;
      stats.imageDecodeMilliseconds += elapsed;
    } else if (outcome === 'failed') {
      stats.imageDecodeFailures++;
      stats.imageDecodeFailureMilliseconds += elapsed;
    } else {
      stats.imageDecodeCancellations++;
      stats.imageDecodeCancellationMilliseconds += elapsed;
    }
  };
  stats.pendingImages++;
  stats.imagePreparations++;
  stats.peakPendingImages = Math.max(stats.peakPendingImages, stats.pendingImages);
  const clearCallbacks = () => {
    ready = () => {};
    failed = () => {};
  };
  const retire = () => {
    if (!live) return;
    live = false;
    if (pending) {
      observe('cancelled');
      stats.pendingImages--;
    } else stats.decodedImages--;
    // The browser may settle an aborted decode later. Its Promise retains no
    // view/frame/source/base64-bearing callbacks after retirement.
    clearCallbacks();
    source = '';
    image.src = '';
  };
  try {
    image.src = source;
    source = '';
    if (typeof image.decode !== 'function') throw new Error('image-decode-unavailable');
    const fail = () => {
      if (!live) return;
      if (pending) observe('failed');
      const callback = failed;
      retire();
      try {
        callback();
      } catch {
        /* Resource retirement must still consume a late failure. */
      }
    };
    void image
      .decode()
      .then(() => {
        if (!live) return;
        if (!image.complete || image.naturalWidth <= 0) {
          fail();
          return;
        }
        observe('ready');
        pending = false;
        stats.pendingImages--;
        stats.decodedImages++;
        const callback = ready;
        ready = () => {};
        const callbackStarted = win.performance.now();
        stats.imageReadyCallbacks++;
        let callbackFailed = false;
        try {
          callback();
        } catch {
          stats.imageReadyCallbackFailures++;
          callbackFailed = true;
        } finally {
          // Publication work ends before error recovery starts. The failed
          // callback may synchronously replace the owner or schedule fallback.
          stats.imageReadyCallbackMilliseconds += win.performance.now() - callbackStarted;
        }
        if (callbackFailed) fail();
        clearCallbacks();
      }, fail)
      .catch(fail);
  } catch (error) {
    observe('failed');
    retire();
    throw error;
  }
  return retire;
}
