import {
  cap,
  type ScrollAxis,
  type ScrollSurfaceHostConnection,
  type ScrollSurfaceHostSupport,
} from '@proto.ui/core';

export type ScrollComposedChromeHostControl = Readonly<{
  getAxis(): ScrollAxis;
  trackTarget: unknown;
  thumbTarget: unknown;
}>;

export type ScrollComposedChromeHostBinding = Readonly<{
  /** Opaque Context provider identity; host adapters must not inspect its shape. */
  scope: unknown;
  controls: readonly ScrollComposedChromeHostControl[];
}>;

export type ScrollSurfaceHostAttachment = ScrollSurfaceHostConnection &
  Readonly<{
    composedChrome?: ScrollComposedChromeHostBinding;
  }>;

export interface ScrollSurfaceHostLease {
  update(connection: ScrollSurfaceHostAttachment): void;
  request(request: import('@proto.ui/core').ScrollSurfaceRequest): void;
  dispose(): void;
}

export type ScrollSurfaceAvailability =
  | Readonly<{
      kind: 'unavailable';
      reason: 'target-pending' | 'target-retired' | 'unsupported-profile' | 'ownership-conflict';
    }>
  | Readonly<{ kind: 'available'; binding: object }>;

export interface ScrollSurfaceAvailabilityPort {
  get(): ScrollSurfaceAvailability;
  subscribe(onChange: () => void): () => void;
}

export interface ScrollSurfaceHost {
  readonly support: ScrollSurfaceHostSupport;
  readonly preference?: import('@proto.ui/core').ScrollProjectionPreference;
  readonly availability?: ScrollSurfaceAvailabilityPort;
  attach(connection: ScrollSurfaceHostAttachment, expectedBinding?: object): ScrollSurfaceHostLease;
}

export const SCROLL_SURFACE_HOST_CAP = cap<ScrollSurfaceHost>('@proto.ui/scroll/surfaceHost');
