import { createAnatomyFamily, createContextKey } from '@proto.ui/core';

export type DrawerOpenFocusReason = 'programmatic' | 'keyboard' | 'pointer';

export type DrawerContextValue = {
  rootId: string;
  open: boolean;
  openFocusReason: DrawerOpenFocusReason | null;
  returnFocusReason: DrawerOpenFocusReason | null;
  controlled: boolean;
  disabled: boolean;
  alert: boolean;
  a11yLabel: string;
  requestedOpen: boolean;
  requestReason: string | null;
  requestFocusReason: DrawerOpenFocusReason | null;
  requestVersion: number;
};

let nextDrawerRootId = 0;

export function createDrawerRootId(): string {
  nextDrawerRootId += 1;
  return `pui-drawer-${nextDrawerRootId}`;
}

export function createDrawerPartId(
  rootId: string,
  role: 'content' | 'title' | 'description'
): string {
  return `${rootId || 'pui-drawer'}-${role}`;
}

export function requestDrawerOpen(
  run: any,
  nextOpen: boolean,
  reason: string,
  focusReason: DrawerOpenFocusReason | null
): boolean {
  try {
    run.context.update(DRAWER_CONTEXT, (prev: DrawerContextValue) => ({
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

export const DRAWER_FAMILY = createAnatomyFamily('base-drawer', {
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
    handle: { cardinality: { min: 0, max: 1 } },
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
    { kind: 'contains', parent: 'content', child: 'handle' },
  ],
});

export const DRAWER_CONTEXT = createContextKey<DrawerContextValue>('base-drawer');

export type DrawerContentContextValue = {
  side: 'top' | 'right' | 'bottom' | 'left';
  open: boolean;
  disabled: boolean;
  snapPoint: number;
  snapPoints: number[];
  dismissible: boolean;
};
export const DRAWER_CONTENT_CONTEXT =
  createContextKey<DrawerContentContextValue>('base-drawer-content');
