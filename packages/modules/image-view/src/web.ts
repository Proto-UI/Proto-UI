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
  let patch: ImageViewPatch = Object.freeze({});
  let status: ImageViewStatus = 'idle';
  let source = '';
  let fit: ImageViewFit = 'contain';
  let disposed = false;
  let activeRequest: {
    readonly generation: number;
    retired: boolean;
    terminal: boolean;
    started: boolean;
  } | null = null;

  const containNativeEvent = (event: Event) => {
    if (options.stopPropagation) event.stopPropagation();
  };

  const retireRequest = () => {
    if (!activeRequest) return;
    activeRequest.retired = true;
    activeRequest = null;
  };

  const complete = (request: NonNullable<typeof activeRequest>, nextStatus: 'loaded' | 'error') => {
    if (
      disposed ||
      activeRequest !== request ||
      request.retired ||
      request.terminal ||
      !source ||
      status === 'loaded' ||
      status === 'error'
    ) {
      return;
    }
    request.terminal = true;
    status = nextStatus;
    connection.onStatusChange({ generation: request.generation, status: nextStatus });
  };

  const beginCompletion = (request: NonNullable<typeof activeRequest>) => {
    if (request.started || status !== 'loading') return;
    request.started = true;
    if (img.complete && img.naturalWidth > 0) {
      complete(request, 'loaded');
      return;
    }
    // A raw load/error Event on a reused img has no originating-request
    // identity. The decode promise is bound to this img request, so its closed-
    // over token keeps an old completion from being relabeled as the next
    // generation without issuing a second source assignment or fetch.
    void img.decode().then(
      () => complete(request, 'loaded'),
      () => complete(request, 'error')
    );
  };

  const apply = (next: ImageViewPatch) => {
    const previousSource = source;
    patch = Object.freeze({ ...patch, ...next });
    let requestToBegin: NonNullable<typeof activeRequest> | null = null;
    if (typeof patch.source === 'string' && patch.source !== previousSource) {
      retireRequest();
      source = patch.source;
      status = source ? 'loading' : 'idle';
      if (source) {
        requestToBegin = { generation, retired: false, terminal: false, started: false };
        activeRequest = requestToBegin;
        if (previousSource) img.removeAttribute('src');
        img.src = source;
      } else {
        img.removeAttribute('src');
      }
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
    if (requestToBegin) beginCompletion(requestToBegin);
  };

  img.addEventListener('load', containNativeEvent);
  img.addEventListener('error', containNativeEvent);
  apply(connection.patch);

  return {
    update(update) {
      if (disposed) return;
      generation = update.generation;
      apply(update.patch);
      if (activeRequest) beginCompletion(activeRequest);
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
      retireRequest();
      img.removeEventListener('load', containNativeEvent);
      img.removeEventListener('error', containNativeEvent);
    },
  };
}
