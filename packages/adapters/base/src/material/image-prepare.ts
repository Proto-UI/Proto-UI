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
  imageReuseHits: 0,
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
  return decodeOpticalImage(document, source, () => ready(), failed);
}
function publishReady(
  win: Window,
  stats: ReturnType<typeof emptyCounters>,
  ready: () => void,
  failed: () => void
) {
  const started = win.performance.now();
  stats.imageReadyCallbacks++;
  let callbackFailed = false;
  try {
    ready();
  } catch {
    stats.imageReadyCallbackFailures++;
    callbackFailed = true;
  } finally {
    stats.imageReadyCallbackMilliseconds += win.performance.now() - started;
  }
  if (callbackFailed) failed();
}
function retireAfterFailure(retire: () => void, failed: () => void) {
  try {
    retire();
  } catch {
    // Async failure is delivered below even if the host cleanup also fails.
  }
  try {
    failed();
  } catch {
    /* Failure notification cannot revive the retired image or escape its task. */
  }
}
function decodeOpticalImage(
  document: Document,
  source: string,
  ready: (image: HTMLImageElement) => void,
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
      retireAfterFailure(retire, callback);
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
        // Publication work ends before error recovery starts. The failed
        // callback may synchronously replace the owner or schedule fallback.
        publishReady(win, stats, () => callback(image), fail);
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

/** One material binding may cache at most two idle decoded held-contact outputs,
 * with a combined 1 MiB decoded-pixel/string budget beyond its active leases.
 * Every request still renders and validates current pixels before looking up
 * the exact PNG. Release animation frames do not displace held images. This is
 * never a source, policy, geometry, contrast, or input-session cache. */
export function createOpticalImageCache(document: Document) {
  const win = document.defaultView;
  if (!win) throw new Error('image-owner-document-unavailable');
  const stats = counters.get(document) ?? emptyCounters();
  counters.set(document, stats);
  const maximumBytes = 1024 * 1024;
  type Entry = {
    source: string;
    bytes: number;
    decoded: boolean;
    retired: boolean;
    retire(): void;
    cancel(): void;
  };
  const idle = new Map<string, Entry>();
  const owned = new Set<Entry>();
  let idleBytes = 0;
  let disposed = false;
  const removeIdle = (entry: Entry) => {
    if (idle.get(entry.source) !== entry) return;
    idle.delete(entry.source);
    idleBytes -= entry.bytes;
  };
  const detach = (entry: Entry) => {
    if (entry.retired) return false;
    entry.retired = true;
    removeIdle(entry);
    owned.delete(entry);
    entry.cancel();
    return true;
  };
  const finishRetirement = (entry: Entry) => {
    try {
      entry.retire();
    } finally {
      entry.source = '';
    }
  };
  const finishRetirements = (entries: Entry[]) => {
    let failed = false;
    let firstError: unknown;
    for (const entry of entries) {
      try {
        finishRetirement(entry);
      } catch (error) {
        // One failing host cleanup cannot keep another owned image alive.
        if (!failed) {
          failed = true;
          firstError = error;
        }
      }
    }
    if (failed) throw firstError;
  };
  const retire = (entry: Entry) => {
    if (detach(entry)) finishRetirement(entry);
  };
  const clear = () => {
    // End the entire starting cohort before calling host code. A cleanup can
    // reacquire the same bytes, but that successor belongs to a new lease.
    const entries = [...owned].filter(detach);
    finishRetirements(entries);
  };
  return {
    prepare(source: string, ready: () => void, failed: () => void, retain = false) {
      if (disposed) throw new Error('image-owner-retired');
      const cached = idle.get(source);
      const entry: Entry = cached ?? {
        source,
        bytes: 0,
        decoded: false,
        retired: false,
        retire() {},
        cancel() {},
      };
      source = '';
      removeIdle(entry);
      owned.add(entry);
      let live = true;
      const clearCallbacks = () => {
        ready = () => {};
        failed = () => {};
      };
      entry.cancel = () => {
        live = false;
        clearCallbacks();
      };
      const release = () => {
        if (!live) return;
        live = false;
        clearCallbacks();
        if (!retain || !entry.decoded || entry.bytes <= 0 || entry.bytes > maximumBytes) {
          retire(entry);
          return;
        }
        const retired: Entry[] = [];
        const previous = idle.get(entry.source);
        if (previous && detach(previous)) retired.push(previous);
        idle.set(entry.source, entry);
        idleBytes += entry.bytes;
        while (idle.size > 2 || idleBytes > maximumBytes) {
          const oldest = idle.values().next().value!;
          if (detach(oldest)) retired.push(oldest);
        }
        // Publish the idle transfer and enforce its budget before any cleanup
        // can throw, clear/dispose the owner, or acquire a successor lease.
        finishRetirements(retired);
      };
      const fail = () => {
        if (!live) return;
        const callback = failed;
        retireAfterFailure(() => retire(entry), callback);
      };
      const publish = () => {
        if (!live) return;
        const callback = ready;
        ready = () => {};
        callback();
        failed = () => {};
      };
      if (cached) {
        stats.imageReuseHits++;
        // Preserve asynchronous readiness and cancellation. The sink rechecks
        // all fresh ownership/admission facts in its normal ready callback.
        queueMicrotask(() => {
          if (live) publishReady(win, stats, publish, fail);
        });
      } else {
        try {
          entry.retire = decodeOpticalImage(
            document,
            entry.source,
            (image) => {
              entry.decoded = true;
              const pixels = image.naturalWidth * image.naturalHeight;
              entry.bytes =
                Number.isSafeInteger(pixels) && pixels > 0
                  ? pixels * 4 + entry.source.length * 2
                  : 0;
              publish();
            },
            fail
          );
          if (entry.retired) entry.retire();
        } catch (error) {
          retire(entry);
          throw error;
        }
      }
      return release;
    },
    clear,
    dispose() {
      disposed = true;
      clear();
    },
  };
}
