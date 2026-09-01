import type {
  ImageViewFit,
  ImageViewPatch,
  ImageViewSnapshot,
  ImageViewStatus,
} from '@proto.ui/core';
import type { ImageViewHost, ImageViewHostConnection, ImageViewHostLease } from './caps';

const OBJECT_FIT: Record<ImageViewFit, string> = {
  contain: 'contain',
  cover: 'cover',
  fill: 'fill',
};

export type WebImageViewLocalName = 'img';

/**
 * A plain image presentation requirement always resolves to one `HTMLImageElement`
 * on the Web profile. There is no line-mode split; the resolver exists so Adapter
 * target selection stays explicit rather than hard-coding a tag in each Adapter.
 */
export function resolveWebImageLocalName(): WebImageViewLocalName {
  return 'img';
}

export function createWebImageViewHost(
  getTarget: () => HTMLImageElement | null,
  options: Readonly<{ stopPropagation?: boolean }> = {}
): ImageViewHost {
  return {
    attach(connection) {
      const target = getTarget();
      if (!target) throw new Error('[ImageView] physical web image target is unavailable.');
      return attachImageTarget(target, connection, options);
    },
  };
}

function attachImageTarget(
  img: HTMLImageElement,
  connection: ImageViewHostConnection,
  options: Readonly<{ stopPropagation?: boolean }>
): ImageViewHostLease {
  let generation = connection.generation;
  let sourceGeneration = generation;
  let patch: ImageViewPatch = Object.freeze({});
  let status: ImageViewStatus = 'idle';
  let source = '';
  let fit: ImageViewFit = 'contain';
  let disposed = false;

  const apply = (next: ImageViewPatch) => {
    const previousSource = source;
    patch = Object.freeze({ ...patch, ...next });
    if (typeof patch.source === 'string' && patch.source !== previousSource) {
      source = patch.source;
      sourceGeneration = generation;
      status = source ? 'loading' : 'idle';
      if (source) {
        if (previousSource) img.removeAttribute('src');
        img.src = source;
      } else img.removeAttribute('src');
    }
    if (!source) img.removeAttribute('src');
    if (next.loadingStatus) status = next.loadingStatus;
    // The module empties alternativeText before a decorative patch reaches the
    // host, so an informative target keeps a name and a decorative target is
    // explicitly removed from the semantic tree via empty alt.
    img.alt = patch.a11yMode === 'decorative' ? '' : (patch.alternativeText ?? '');
    if (patch.fit) {
      fit = patch.fit;
      img.style.objectFit = OBJECT_FIT[fit];
    }
  };

  const complete = (nextStatus: 'loaded' | 'error', event?: Event) => {
    if (options.stopPropagation && event) event.stopPropagation();
    if (disposed || !source || status === 'loaded' || status === 'error') return;
    status = nextStatus;
    connection.onStatusChange({ generation: sourceGeneration, status: nextStatus });
  };
  const onLoad = (event: Event) => complete('loaded', event);
  const onError = (event: Event) => complete('error', event);

  const completeCachedImage = () => {
    if (source && status === 'loading' && img.complete && img.naturalWidth > 0) {
      complete('loaded');
    }
  };

  img.addEventListener('load', onLoad);
  img.addEventListener('error', onError);
  apply(connection.patch);
  completeCachedImage();

  return {
    update(update) {
      if (disposed) return;
      generation = update.generation;
      apply(update.patch);
      completeCachedImage();
    },
    snapshot(): ImageViewSnapshot {
      return Object.freeze({
        source,
        loadingStatus: status,
        fit,
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      img.removeEventListener('load', onLoad);
      img.removeEventListener('error', onError);
    },
  };
}
