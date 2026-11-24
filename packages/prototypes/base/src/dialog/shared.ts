import { createAnatomyFamily, createContextKey } from '@proto.ui/core';

export type DialogOpenFocusReason = 'programmatic' | 'keyboard' | 'pointer';

export type DialogContextValue = {
  // P-BASE-DIALOG-CONTEXT
  rootId: string;
  open: boolean;
  openFocusReason: DialogOpenFocusReason | null;
  returnFocusReason: DialogOpenFocusReason | null;
  controlled: boolean;
  disabled: boolean;
  alert: boolean;
  a11yLabel: string;
  requestedOpen: boolean;
  requestReason: string | null;
  requestFocusReason: DialogOpenFocusReason | null;
  requestVersion: number;
};

let nextDialogRootId = 0;

export function createDialogRootId(): string {
  nextDialogRootId += 1;
  return `pui-dialog-${nextDialogRootId}`;
}

export function createDialogPartId(
  rootId: string,
  role: 'content' | 'title' | 'description'
): string {
  return `${rootId || 'pui-dialog'}-${role}`;
}

export function requestDialogOpen(
  run: any,
  nextOpen: boolean,
  reason: string,
  focusReason: DialogOpenFocusReason | null,
  expectedRootId?: string
): boolean {
  // P-BASE-DIALOG-OPEN-CHANGE, P-BASE-DIALOG-CONTROLLED-OWNER
  try {
    let requested = false;
    run.context.update(DIALOG_CONTEXT, (prev: DialogContextValue) => {
      if (expectedRootId !== undefined && prev.rootId !== expectedRootId) return prev;
      requested = true;
      return {
        ...prev,
        open: prev.controlled ? prev.open : nextOpen,
        openFocusReason: nextOpen ? focusReason : null,
        returnFocusReason: nextOpen ? null : focusReason,
        requestedOpen: nextOpen,
        requestReason: reason,
        requestFocusReason: focusReason,
        requestVersion: prev.requestVersion + 1,
      };
    });
    return requested;
  } catch (error) {
    if ((error as { code?: string })?.code === 'CONTEXT_DISCONNECTED') return false;
    throw error;
  }
}

// P-BASE-DIALOG-ANATOMY
export const DIALOG_FAMILY = createAnatomyFamily('base-dialog', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    trigger: { cardinality: { min: 0, max: 100 } },
    mask: { cardinality: { min: 0, max: 1 } },
    content: { cardinality: { min: 0, max: 1 } },
    title: { cardinality: { min: 0, max: 1 } },
    description: { cardinality: { min: 0, max: 1 } },
    header: { cardinality: { min: 0, max: 1 } },
    footer: { cardinality: { min: 0, max: 1 } },
    close: { cardinality: { min: 0, max: 100 } },
  },
  relations: [
    { kind: 'contains', parent: 'root', child: 'trigger' },
    { kind: 'contains', parent: 'root', child: 'mask' },
    { kind: 'contains', parent: 'root', child: 'content' },
    { kind: 'contains', parent: 'content', child: 'title' },
    { kind: 'contains', parent: 'content', child: 'description' },
    { kind: 'contains', parent: 'content', child: 'header' },
    { kind: 'contains', parent: 'content', child: 'footer' },
    { kind: 'contains', parent: 'content', child: 'close' },
  ],
});

// P-BASE-DIALOG-CONTEXT
export const DIALOG_CONTEXT = createContextKey<DialogContextValue>('base-dialog');
