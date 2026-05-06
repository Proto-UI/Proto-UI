import { createAnatomyFamily } from '@proto.ui/core';
import type { ContextKey } from '@proto.ui/types';

export type TooltipContextValue = {
  open: boolean;
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
    content: { cardinality: { min: 0, max: 1 } },
  },
  relations: [
    { kind: 'contains', parent: 'root', child: 'trigger' },
    { kind: 'contains', parent: 'root', child: 'content' },
  ],
});

export const TOOLTIP_CONTEXT = {
  __brand: 'ContextKey',
  debugName: 'base-tooltip',
} as ContextKey<TooltipContextValue>;
