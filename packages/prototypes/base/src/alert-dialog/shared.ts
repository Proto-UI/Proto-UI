import { createAnatomyFamily, createContextKey } from '@proto.ui/core';

export type AlertDialogOpenFocusReason = 'programmatic' | 'keyboard' | 'pointer';

export type AlertDialogContextValue = {
  rootId: string;
  open: boolean;
  openFocusReason: AlertDialogOpenFocusReason | null;
  returnFocusReason: AlertDialogOpenFocusReason | null;
  controlled: boolean;
  disabled: boolean;
  alert: boolean;
  a11yLabel: string;
  requestedOpen: boolean;
  requestReason: string | null;
  requestFocusReason: AlertDialogOpenFocusReason | null;
  requestVersion: number;
};

let nextAlertDialogRootId = 0;

export function createAlertDialogRootId(): string {
  nextAlertDialogRootId += 1;
  return `pui-alertDialog-${nextAlertDialogRootId}`;
}

export function createAlertDialogPartId(
  rootId: string,
  role: 'content' | 'title' | 'description'
): string {
  return `${rootId || 'pui-alertDialog'}-${role}`;
}

export function requestAlertDialogOpen(
  run: any,
  nextOpen: boolean,
  reason: string,
  focusReason: AlertDialogOpenFocusReason | null
): boolean {
  try {
    run.context.update(ALERT_DIALOG_CONTEXT, (prev: AlertDialogContextValue) => ({
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

export const ALERT_DIALOG_FAMILY = createAnatomyFamily('base-alert-dialog', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    trigger: { cardinality: { min: 0, max: 100 } },
    mask: { cardinality: { min: 0, max: 1 } },
    content: { cardinality: { min: 0, max: 1 } },
    title: { cardinality: { min: 0, max: 1 } },
    description: { cardinality: { min: 0, max: 1 } },
    header: { cardinality: { min: 0, max: 1 } },
    footer: { cardinality: { min: 0, max: 1 } },
    action: { cardinality: { min: 0, max: 100 } },
    cancel: { cardinality: { min: 0, max: 100 } },
  },
  relations: [
    { kind: 'contains', parent: 'root', child: 'trigger' },
    { kind: 'contains', parent: 'root', child: 'mask' },
    { kind: 'contains', parent: 'root', child: 'content' },
    { kind: 'contains', parent: 'content', child: 'title' },
    { kind: 'contains', parent: 'content', child: 'description' },
    { kind: 'contains', parent: 'content', child: 'header' },
    { kind: 'contains', parent: 'content', child: 'footer' },
    { kind: 'contains', parent: 'content', child: 'cancel' },
    { kind: 'contains', parent: 'content', child: 'action' },
  ],
});

export const ALERT_DIALOG_CONTEXT = createContextKey<AlertDialogContextValue>('base-alert-dialog');
