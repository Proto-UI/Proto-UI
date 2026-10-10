import { createAnatomyFamily, createContextKey, type RunHandle } from '@proto.ui/core';
export const TOGGLE_GROUP_FAMILY = createAnatomyFamily('base-toggle-group', {
  roles: { root: { cardinality: { min: 1, max: 1 } }, item: { cardinality: { min: 0, max: '*' } } },
  relations: [{ kind: 'contains', parent: 'root', child: 'item' }],
});
export type ToggleGroupContext = {
  value: string[];
  disabled: boolean;
  readOnly: boolean;
  current: string;
};
export const TOGGLE_GROUP_CONTEXT = createContextKey<ToggleGroupContext>('base-toggle-group');
let sequence = 0;
export const createToggleGroupItemId = () => `pui-toggle-group-${++sequence}`;
export function groupCommand(run: RunHandle<any>, name: string, value: string): unknown {
  const fn = run.anatomy.partsOf(TOGGLE_GROUP_FAMILY, 'root')[0]?.getExpose(name);
  return typeof fn === 'function' ? fn(value) : false;
}
export function getItems(run: RunHandle<any>): { id: string; value: string; disabled: boolean }[] {
  return run.anatomy.order.partsOf(TOGGLE_GROUP_FAMILY, 'item').flatMap((part) => {
    const fn = part.getExpose('__collectionItem');
    const raw = typeof fn === 'function' ? fn() : fn;
    return raw && typeof raw === 'object'
      ? [raw as { id: string; value: string; disabled: boolean }]
      : [];
  });
}
export function normalizeValues(value: unknown, multiple: boolean): string[] {
  if (!Array.isArray(value)) return [];
  const values = [
    ...new Set(value.filter((v): v is string => typeof v === 'string' && v.length > 0)),
  ];
  return multiple ? values : values.slice(0, 1);
}
