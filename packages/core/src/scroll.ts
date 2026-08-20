import type { ContextKey, JsonObject, PropsBaseType } from '@proto.ui/types';
import type { AnatomyFamily } from './anatomy';
import type { ObservedStateHandle } from './state';

export type ScrollAxis = 'horizontal' | 'vertical';
export type ScrollAxes = ScrollAxis | 'both';
export type ScrollProjectionPreference = 'auto' | 'system' | 'composed';
export type ScrollResolvedProjection = 'unresolved' | 'system' | 'composed';

export type ScrollSurfaceConfigPatch = Readonly<{
  axes?: ScrollAxes;
  projection?: ScrollProjectionPreference;
  requireProjection?: Exclude<ScrollProjectionPreference, 'auto'>;
}>;

export type ScrollSurfaceConfig = Readonly<{
  axes: ScrollAxes;
  projection: ScrollProjectionPreference;
  requireProjection?: Exclude<ScrollProjectionPreference, 'auto'>;
}>;

/**
 * Portable declaration for locating authored scrollbar chrome around one
 * logical surface. Concrete targets and geometry stay behind the host cap.
 */
export type ScrollComposedChromeBinding = Readonly<{
  scope: ContextKey<JsonObject>;
  anatomy: AnatomyFamily;
  scrollbarRole: string;
  thumbRole: string;
  orientationExpose: string;
}>;

export type ScrollAxisSnapshot = Readonly<{
  position: number;
  visibleRatio: number;
  canScrollBefore: boolean;
  canScrollAfter: boolean;
}>;

export type ScrollSurfaceSnapshot = Readonly<{
  axes: ScrollAxes;
  horizontal: ScrollAxisSnapshot;
  vertical: ScrollAxisSnapshot;
  scrolling: boolean;
  projection: ScrollResolvedProjection;
}>;

export type ScrollSurfaceRequest =
  | Readonly<{ kind: 'by'; axis: ScrollAxis; delta: number }>
  | Readonly<{ kind: 'to'; axis: ScrollAxis; position: number }>
  | Readonly<{ kind: 'page'; axis: ScrollAxis; direction: 'before' | 'after' }>
  | Readonly<{ kind: 'control-drag'; axis: ScrollAxis; position: number }>;

export type ScrollAxisFactsHandle<P extends PropsBaseType = PropsBaseType> = Readonly<{
  position: ObservedStateHandle<number, P>;
  visibleRatio: ObservedStateHandle<number, P>;
  canScrollBefore: ObservedStateHandle<boolean, P>;
  canScrollAfter: ObservedStateHandle<boolean, P>;
}>;

export interface ScrollSurfaceHandle<P extends PropsBaseType = PropsBaseType> {
  axes: ObservedStateHandle<ScrollAxes, P>;
  horizontal: ScrollAxisFactsHandle<P>;
  vertical: ScrollAxisFactsHandle<P>;
  scrolling: ObservedStateHandle<boolean, P>;
  projection: ObservedStateHandle<ScrollResolvedProjection, P>;

  configure(patch: ScrollSurfaceConfigPatch): void;
  bindComposedChrome(binding: ScrollComposedChromeBinding): void;
  request(request: ScrollSurfaceRequest): void;
  getSnapshot(): ScrollSurfaceSnapshot;
}

export type ScrollSurfaceHostSupport = Readonly<{
  system: boolean;
  composed: boolean;
}>;

export type ScrollSurfaceHostConnection = Readonly<{
  config: ScrollSurfaceConfig;
  projection: Exclude<ScrollResolvedProjection, 'unresolved'>;
  onFacts(snapshot: ScrollSurfaceSnapshot): void;
}>;
