import { createAnatomyFamily } from '@proto.ui/core';
import type { ContextKey } from '@proto.ui/types';

export type TooltipGroupContextValue = {
  /** Number of currently-open tooltips inside this group. */
  openCount: number;
  /** Delay (ms) used when the group already has an open tooltip. Typically 0. */
  skipDelayDuration: number;
};

export type TooltipContextValue = {
  open: boolean;
  openRevision: number;
  controlled: boolean;
  disabled: boolean;
  delay: number;
  triggerHovered: boolean;
  triggerFocused: boolean;
};

export const TOOLTIP_FAMILY = createAnatomyFamily('base-tooltip', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    trigger: { cardinality: { min: 0, max: 1 } },
    overlay: { cardinality: { min: 0, max: 1 } },
    content: { cardinality: { min: 0, max: 1 } },
    arrow: { cardinality: { min: 0, max: 1 } },
  },
  relations: [
    { kind: 'contains', parent: 'root', child: 'trigger' },
    { kind: 'contains', parent: 'root', child: 'overlay' },
    { kind: 'contains', parent: 'overlay', child: 'content' },
    { kind: 'contains', parent: 'overlay', child: 'arrow' },
  ],
});

export const TOOLTIP_GROUP_CONTEXT = {
  __brand: 'ContextKey',
  debugName: 'base-tooltip-group',
} as ContextKey<TooltipGroupContextValue>;

export const TOOLTIP_CONTEXT = {
  __brand: 'ContextKey',
  debugName: 'base-tooltip',
} as ContextKey<TooltipContextValue>;
