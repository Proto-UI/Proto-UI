import { createAnatomyFamily, createContextKey, type InputOriginAnchor } from '@proto.ui/core';
import type { ContextMenuOpenEntry } from './types';

export type ContextMenuFocusReason = 'programmatic' | 'keyboard' | 'pointer';

export type ContextMenuOpenRequest = Readonly<{
  open: boolean;
  reason: string;
  focusReason: ContextMenuFocusReason | null;
  entry?: 'first' | 'last' | null;
  inputAnchor?: InputOriginAnchor | null;
}>;

export type ContextMenuContextValue = {
  rootId: string;
  inputAnchorVersion: number;
  open: boolean;
  controlled: boolean;
  disabled: boolean;
  activeValue: string;
  closeOnItemCommit: boolean;
  openEntry: ContextMenuOpenEntry;
  openEntryValue: string;
  requestReason: string | null;
  requestFocusReason: ContextMenuFocusReason | null;
  requestEntry: 'first' | 'last' | null;
};

let nextContextMenuRootId = 0;

export function createContextMenuRootId(): string {
  nextContextMenuRootId += 1;
  return `pui-contextMenu-${nextContextMenuRootId}`;
}

export function createContextMenuContentId(rootId: string): string {
  return `${rootId || 'pui-contextMenu'}-content`;
}

export function requestContextMenuOpen(
  run: any,
  nextOpen: boolean,
  reason: string,
  focusReason: ContextMenuFocusReason | null,
  entry: 'first' | 'last' | null = null,
  inputAnchor: InputOriginAnchor | null = null
): boolean {
  try {
    const root = run.anatomy.partsOf(CONTEXT_MENU_FAMILY, 'root')[0] ?? null;
    const requestOpen = root?.getExpose('requestOpen') as
      | ((request: ContextMenuOpenRequest) => boolean)
      | null;
    return (
      requestOpen?.({
        open: nextOpen,
        reason,
        focusReason,
        entry: nextOpen ? entry : null,
        inputAnchor: nextOpen ? inputAnchor : null,
      }) ?? false
    );
  } catch (error) {
    if ((error as { code?: string })?.code === 'CONTEXT_DISCONNECTED') return false;
    throw error;
  }
}

export const CONTEXT_MENU_FAMILY = createAnatomyFamily('base-context-menu', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    trigger: { cardinality: { min: 0, max: 1 } },
    content: { cardinality: { min: 0, max: 1 } },
    item: { cardinality: { min: 0, max: 100 } },
  },
  relations: [
    { kind: 'contains', parent: 'root', child: 'trigger' },
    { kind: 'contains', parent: 'root', child: 'content' },
    { kind: 'contains', parent: 'content', child: 'item' },
  ],
});

export const CONTEXT_MENU_CONTEXT = createContextKey<ContextMenuContextValue>('base-context-menu');
