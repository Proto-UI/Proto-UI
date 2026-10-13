export { ScrollModuleDef, createScrollModule } from './create';
export { SCROLL_SURFACE_HOST_CAP } from './caps';
export type {
  ScrollComposedChromeHostBinding,
  ScrollComposedChromeHostControl,
  ScrollSurfaceAvailability,
  ScrollSurfaceAvailabilityPort,
  ScrollSurfaceHost,
  ScrollSurfaceHostAttachment,
  ScrollSurfaceHostLease,
} from './caps';
export type { ScrollFacade, ScrollModule, ScrollPort } from './types';
export { resolveScrollProjection, ScrollProjectionResolutionError } from './projection';
export { createWebScrollSurfaceHost } from './web/create-web-scroll-host';
export type { WebScrollSurfaceHostOptions } from './web/create-web-scroll-host';
export {
  createBoundWebScrollSurfaceHost,
  ScrollSurfaceBindingError,
} from './web/create-bound-web-scroll-host';
export type { BoundWebScrollSurfaceHostOptions } from './web/create-bound-web-scroll-host';
