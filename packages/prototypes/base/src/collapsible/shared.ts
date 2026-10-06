import { createAnatomyFamily, createContextKey, type RunHandle } from '@proto.ui/core';

export type CollapsibleOpenReason = 'pointer' | 'keyboard' | 'programmatic';

export type CollapsibleContextValue = {
  open: boolean;
  controlled: boolean;
  disabled: boolean;
  // Internal request envelope, not another expansion owner.
  requestedOpen: boolean;
  requestReason: CollapsibleOpenReason | null;
  requestVersion: number;
};

// P-BASE-COLLAPSIBLE-ANATOMY
export const COLLAPSIBLE_FAMILY = createAnatomyFamily('base-collapsible', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    trigger: { cardinality: { min: 1, max: 1 } },
    content: { cardinality: { min: 1, max: 1 } },
  },
  relations: [
    { kind: 'contains', parent: 'root', child: 'trigger' },
    { kind: 'contains', parent: 'root', child: 'content' },
  ],
});

export const COLLAPSIBLE_CONTEXT = createContextKey<CollapsibleContextValue>('base-collapsible');

export function rejectDuplicateCollapsiblePart(
  run: RunHandle<any>,
  role: 'trigger' | 'content'
): void {
  // Maximum is immediate; minimum is a settled-composition conformance check.
  if ((run.anatomy.partsOf(COLLAPSIBLE_FAMILY, role)?.length ?? 0) <= 1) return;
  throw Object.assign(new Error(`Collapsible permits only one ${role} per domain.`), {
    code: 'COLLAPSIBLE_DUPLICATE_PART',
  });
}

export function requestCollapsibleOpen(
  run: RunHandle<any>,
  nextOpen: boolean,
  reason: CollapsibleOpenReason
): void {
  // P-BASE-COLLAPSIBLE-REQUEST-ONLY, P-BASE-COLLAPSIBLE-DISABLED
  run.context.update(COLLAPSIBLE_CONTEXT, (previous) => {
    if (previous.disabled || previous.open === nextOpen) return previous;
    return {
      ...previous,
      open: previous.controlled ? previous.open : nextOpen,
      requestedOpen: nextOpen,
      requestReason: reason,
      requestVersion: previous.requestVersion + 1,
    };
  });
}
