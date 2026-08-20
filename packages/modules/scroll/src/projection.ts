import type {
  ScrollProjectionPreference,
  ScrollResolvedProjection,
  ScrollSurfaceConfig,
  ScrollSurfaceHostSupport,
} from '@proto.ui/core';

type ResolvedProjection = Exclude<ScrollResolvedProjection, 'unresolved'>;

export class ScrollProjectionResolutionError extends Error {
  readonly code = 'PUI_SCROLL_PROJECTION_UNSUPPORTED';

  constructor(
    readonly requested: ScrollProjectionPreference,
    readonly support: ScrollSurfaceHostSupport
  ) {
    super(`[Scroll] requested ${requested} projection is unsupported by the host.`);
    this.name = 'ScrollProjectionResolutionError';
  }
}

export function resolveScrollProjection(
  config: ScrollSurfaceConfig,
  support: ScrollSurfaceHostSupport,
  hostPreference: ScrollProjectionPreference = 'auto'
): ResolvedProjection {
  const required = config.requireProjection;
  if (required) {
    if (!support[required]) throw new ScrollProjectionResolutionError(required, support);
    return required;
  }

  const preference = config.projection === 'auto' ? hostPreference : config.projection;
  if (preference !== 'auto' && support[preference]) return preference;
  if (support.system) return 'system';
  if (support.composed) return 'composed';
  throw new ScrollProjectionResolutionError(preference, support);
}
