import { createAnatomyFamily, createContextKey } from '@proto.ui/core';

export type PopoverOpenFocusReason = 'programmatic' | 'keyboard' | 'pointer';

export type PopoverContextValue = {
  rootId: string;
  open: boolean;
  openFocusReason: PopoverOpenFocusReason | null;
  returnFocusReason: PopoverOpenFocusReason | null;
  controlled: boolean;
  disabled: boolean;
  alert: boolean;
  a11yLabel: string;
  requestedOpen: boolean;
  requestReason: string | null;
  requestFocusReason: PopoverOpenFocusReason | null;
  requestVersion: number;
};

let nextPopoverRootId = 0;

export function createPopoverRootId(): string {
  nextPopoverRootId += 1;
  return `pui-popover-${nextPopoverRootId}`;
}

export function createPopoverPartId(
  rootId: string,
  role: 'content' | 'title' | 'description'
): string {
  return `${rootId || 'pui-popover'}-${role}`;
}

export function requestPopoverOpen(
  run: any,
  nextOpen: boolean,
  reason: string,
  focusReason: PopoverOpenFocusReason | null
): boolean {
  try {
    run.context.update(POPOVER_CONTEXT, (prev: PopoverContextValue) => ({
      ...prev,
      open: prev.controlled ? prev.open : nextOpen,
      openFocusReason: nextOpen ? focusReason : null,
      returnFocusReason: nextOpen ? null : focusReason,
      requestedOpen: nextOpen,
      requestReason: reason,
      requestFocusReason: focusReason,
      requestVersion: prev.requestVersion + 1,
    }));
    return true;
  } catch (error) {
    if ((error as { code?: string })?.code === 'CONTEXT_DISCONNECTED') return false;
    throw error;
  }
}

export const POPOVER_FAMILY = createAnatomyFamily('base-popover', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    trigger: { cardinality: { min: 0, max: 100 } },
    content: { cardinality: { min: 0, max: 1 } },
    title: { cardinality: { min: 0, max: 1 } },
    description: { cardinality: { min: 0, max: 1 } },
    header: { cardinality: { min: 0, max: 1 } },
    footer: { cardinality: { min: 0, max: 1 } },
    close: { cardinality: { min: 0, max: 100 } },
  },
  relations: [
    { kind: 'contains', parent: 'root', child: 'trigger' },
    { kind: 'contains', parent: 'root', child: 'content' },
    { kind: 'contains', parent: 'content', child: 'title' },
    { kind: 'contains', parent: 'content', child: 'description' },
    { kind: 'contains', parent: 'content', child: 'header' },
    { kind: 'contains', parent: 'content', child: 'footer' },
    { kind: 'contains', parent: 'content', child: 'close' },
  ],
});

export const POPOVER_CONTEXT = createContextKey<PopoverContextValue>('base-popover');
