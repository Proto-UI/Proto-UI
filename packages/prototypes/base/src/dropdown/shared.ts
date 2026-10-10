import { createAnatomyFamily, createContextKey } from '@proto.ui/core';
import type { DropdownOpenEntry } from './types';

export type DropdownFocusReason = 'programmatic' | 'keyboard' | 'pointer';

export type DropdownOpenRequest = Readonly<{
  open: boolean;
  reason: string;
  focusReason: DropdownFocusReason | null;
  entry?: 'first' | 'last' | null;
}>;

export type DropdownContextValue = {
  // P-BASE-DROPDOWN-MENU-CONTEXT
  rootId: string;
  open: boolean;
  controlled: boolean;
  disabled: boolean;
  activeValue: string;
  closeOnItemCommit: boolean;
  openEntry: DropdownOpenEntry;
  openEntryValue: string;
  requestReason: string | null;
  requestFocusReason: DropdownFocusReason | null;
  requestEntry: 'first' | 'last' | null;
};

let nextDropdownRootId = 0;

export function createDropdownRootId(): string {
  nextDropdownRootId += 1;
  return `pui-dropdown-${nextDropdownRootId}`;
}

export function createDropdownContentId(rootId: string): string {
  return `${rootId || 'pui-dropdown'}-content`;
}

export function requestDropdownOpen(
  run: any,
  nextOpen: boolean,
  reason: string,
  focusReason: DropdownFocusReason | null,
  entry: 'first' | 'last' | null = null
): boolean {
  // P-BASE-DROPDOWN-MENU-REQUESTS, P-BASE-DROPDOWN-MENU-CONTROLLED-OWNER
  try {
    const root = run.anatomy.partsOf(DROPDOWN_FAMILY, 'root')[0] ?? null;
    const requestOpen = root?.getExpose('requestOpen') as
      | ((request: DropdownOpenRequest) => boolean)
      | null;
    return (
      requestOpen?.({
        open: nextOpen,
        reason,
        focusReason,
        entry: nextOpen ? entry : null,
      }) ?? false
    );
  } catch (error) {
    if ((error as { code?: string })?.code === 'CONTEXT_DISCONNECTED') return false;
    throw error;
  }
}

// P-BASE-DROPDOWN-MENU-ANATOMY
export const DROPDOWN_FAMILY = createAnatomyFamily('base-dropdown', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    trigger: { cardinality: { min: 0, max: 1 } },
    content: { cardinality: { min: 0, max: 1 } },
    item: { cardinality: { min: 0, max: 100 } },
    group: { cardinality: { min: 0, max: 100 } },
    label: { cardinality: { min: 0, max: 100 } },
    separator: { cardinality: { min: 0, max: 100 } },
    shortcut: { cardinality: { min: 0, max: 100 } },
  },
  relations: [
    { kind: 'contains', parent: 'root', child: 'trigger' },
    { kind: 'contains', parent: 'root', child: 'content' },
    { kind: 'contains', parent: 'content', child: 'item' },
    { kind: 'contains', parent: 'content', child: 'group' },
    { kind: 'contains', parent: 'group', child: 'label' },
    { kind: 'contains', parent: 'content', child: 'separator' },
    { kind: 'contains', parent: 'item', child: 'shortcut' },
  ],
});

export const DROPDOWN_CONTEXT = createContextKey<DropdownContextValue>('base-dropdown');

// Label ownership is group-local even when several groups share one menu level.
export const DROPDOWN_GROUP_FAMILY = createAnatomyFamily('base-dropdown-group', {
  roles: { root: { cardinality: { min: 1, max: 1 } }, label: { cardinality: { min: 0, max: 1 } } },
  relations: [{ kind: 'contains', parent: 'root', child: 'label' }],
});
export const DROPDOWN_GROUP_CONTEXT = createContextKey<{ labelId: string }>('base-dropdown-group');

export const DROPDOWN_ITEM_CONTEXT = createContextKey<{ active: boolean; disabled: boolean }>(
  'base-dropdown-item'
);
