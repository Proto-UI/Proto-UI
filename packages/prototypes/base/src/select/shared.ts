import { createAnatomyFamily, createContextKey } from '@proto.ui/core';

export type SelectFocusReason = 'programmatic' | 'keyboard' | 'pointer';
export type SelectOpenEntry = 'selected-or-first' | 'selected-or-last';

export type SelectOpenRequest = Readonly<{
  open: boolean;
  reason: string;
  focusReason: SelectFocusReason | null;
  entry?: SelectOpenEntry | null;
}>;

export type SelectValueRequest = Readonly<{
  value: string;
  textValue: string;
  reason: SelectFocusReason;
}>;

export type SelectContextValue = {
  rootId: string;
  open: boolean;
  controlledOpen: boolean;
  value: string;
  textValue: string;
  controlledValue: boolean;
  disabled: boolean;
  activeValue: string;
  closeOnSelect: boolean;
  requestReason: string | null;
  requestFocusReason: SelectFocusReason | null;
  requestEntry: SelectOpenEntry | null;
};

let nextSelectRootId = 0;

export function createSelectRootId(): string {
  nextSelectRootId += 1;
  return `pui-select-${nextSelectRootId}`;
}

export function createSelectContentId(rootId: string): string {
  return `${rootId || 'pui-select'}-content`;
}

export function requestSelectOpen(run: any, request: SelectOpenRequest): boolean {
  try {
    const root = run.anatomy.partsOf(SELECT_FAMILY, 'root')[0] ?? null;
    const requestOpen = root?.getExpose('requestOpen') as
      | ((nextRequest: SelectOpenRequest) => boolean)
      | null;
    return requestOpen?.(request) ?? false;
  } catch (error) {
    if ((error as { code?: string })?.code === 'CONTEXT_DISCONNECTED') return false;
    throw error;
  }
}

export function requestSelectValue(run: any, request: SelectValueRequest): boolean {
  try {
    const root = run.anatomy.partsOf(SELECT_FAMILY, 'root')[0] ?? null;
    const requestValue = root?.getExpose('requestValue') as
      | ((nextRequest: SelectValueRequest) => boolean)
      | null;
    return requestValue?.(request) ?? false;
  } catch (error) {
    if ((error as { code?: string })?.code === 'CONTEXT_DISCONNECTED') return false;
    throw error;
  }
}

export function notifySelectItemSnapshotChanged(run: any): void {
  const root = run.anatomy.partsOf(SELECT_FAMILY, 'root')[0] ?? null;
  const refresh = root?.getExpose('__refreshSelectedText') as (() => void) | null;
  refresh?.();
}

export const SELECT_FAMILY = createAnatomyFamily('base-select', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    trigger: { cardinality: { min: 0, max: 1 } },
    value: { cardinality: { min: 0, max: 1 } },
    content: { cardinality: { min: 0, max: 1 } },
    surface: { cardinality: { min: 0, max: 1 } },
    viewport: { cardinality: { min: 0, max: 1 } },
    'item-text': { cardinality: { min: 0, max: 100 } },
    item: { cardinality: { min: 0, max: 100 } },
  },
  relations: [
    { kind: 'contains', parent: 'root', child: 'trigger' },
    { kind: 'contains', parent: 'root', child: 'value' },
    { kind: 'contains', parent: 'root', child: 'content' },
    { kind: 'contains', parent: 'content', child: 'item' },
    { kind: 'contains', parent: 'content', child: 'surface' },
    { kind: 'contains', parent: 'surface', child: 'viewport' },
    { kind: 'contains', parent: 'item', child: 'item-text' },
  ],
  profiles: {
    'item-aligned': {
      roles: {
        trigger: { cardinality: { min: 1 } },
        value: { cardinality: { min: 1 } },
        content: { cardinality: { min: 1 } },
        surface: { cardinality: { min: 1 } },
        viewport: { cardinality: { min: 1 } },
      },
      relations: [
        { kind: 'contains', parent: 'trigger', child: 'value' },
        { kind: 'contains', parent: 'viewport', child: 'item' },
      ],
    },
  },
});

export const SELECT_CONTEXT = createContextKey<SelectContextValue>('base-select');
