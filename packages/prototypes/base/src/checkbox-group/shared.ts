import { createAnatomyFamily, createContextKey, type RunHandle } from '@proto.ui/core';
export const CHECKBOX_GROUP_FAMILY = createAnatomyFamily('base-checkbox-group', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    item: { cardinality: { min: 0, max: '*' } },
    all: { cardinality: { min: 0, max: 1 } },
  },
  relations: ['item', 'all'].map((child) => ({ kind: 'contains' as const, parent: 'root', child })),
});
export const CHECKBOX_GROUP_CONTEXT = createContextKey<{
  value: string[];
  disabled: boolean;
  readOnly: boolean;
  checked: boolean;
  indeterminate: boolean;
}>('base-checkbox-group');
export function normalizeSelection(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string'))]
    : [];
}
export function groupRequest(run: RunHandle<any>, method: string, ...args: unknown[]) {
  const root = run.anatomy.partsOf(CHECKBOX_GROUP_FAMILY, 'root')[0];
  const fn = root?.getExpose(method);
  return typeof fn === 'function' ? fn(...args) : false;
}
