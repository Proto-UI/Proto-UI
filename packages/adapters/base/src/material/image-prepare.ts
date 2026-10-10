/** Decode the GPU-produced image before relinquishing opaque fallback. Holding
 * the decoded image until retirement keeps its backing resource owned while
 * the CSS background consumer adopts the identical local data URL. */
const counters = new WeakMap<
  Document,
  {
    pendingImages: number;
    decodedImages: number;
    imagePreparations: number;
    peakPendingImages: number;
  }
>();
export function inspectOpticalImageResources(document: Document) {
  return {
    ...(counters.get(document) ?? {
      pendingImages: 0,
      decodedImages: 0,
      imagePreparations: 0,
      peakPendingImages: 0,
    }),
  };
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
  const stats = counters.get(document) ?? {
    pendingImages: 0,
    decodedImages: 0,
    imagePreparations: 0,
    peakPendingImages: 0,
  };
  counters.set(document, stats);
  let live = true,
    pending = true;
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
    if (pending) stats.pendingImages--;
    else stats.decodedImages--;
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
        pending = false;
        stats.pendingImages--;
        stats.decodedImages++;
        const callback = ready;
        ready = () => {};
        try {
          callback();
        } catch {
          fail();
        }
        clearCallbacks();
      }, fail)
      .catch(fail);
  } catch (error) {
    retire();
    throw error;
  }
  return retire;
}
