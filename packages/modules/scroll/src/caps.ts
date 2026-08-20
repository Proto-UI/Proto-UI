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

export interface ScrollSurfaceHost {
  readonly support: ScrollSurfaceHostSupport;
  readonly preference?: import('@proto.ui/core').ScrollProjectionPreference;
  attach(connection: ScrollSurfaceHostAttachment): ScrollSurfaceHostLease;
}

export const SCROLL_SURFACE_HOST_CAP = cap<ScrollSurfaceHost>('@proto.ui/scroll/surfaceHost');
