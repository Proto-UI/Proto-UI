import { createAnatomyFamily, createContextKey, type RunHandle } from '@proto.ui/core';
export const TOAST_FAMILY = createAnatomyFamily('base-toast', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    title: { cardinality: { min: 0, max: 1 } },
    description: { cardinality: { min: 0, max: 1 } },
    close: { cardinality: { min: 0, max: 1 } },
    action: { cardinality: { min: 0, max: '*' } },
  },
  relations: ['title', 'description', 'close', 'action'].map((child) => ({
    kind: 'contains' as const,
    parent: 'root',
    child,
  })),
});
export const TOAST_CONTEXT = createContextKey<{ id: string; open: boolean }>('base-toast');
let nextId = 0;
export const createToastId = () => `pui-toast-${++nextId}`;
export function dismissToast(run: RunHandle<any>, reason: string) {
  const fn = run.anatomy.partsOf(TOAST_FAMILY, 'root')[0]?.getExpose('close');
  if (typeof fn === 'function') fn(reason);
}
