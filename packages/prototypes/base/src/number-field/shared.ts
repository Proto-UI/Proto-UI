import { createAnatomyFamily, createContextKey, type RunHandle } from '@proto.ui/core';
export const NUMBER_FIELD_FAMILY = createAnatomyFamily('base-number-field', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    input: { cardinality: { min: 1, max: 1 } },
    increment: { cardinality: { min: 0, max: 1 } },
    decrement: { cardinality: { min: 0, max: 1 } },
    label: { cardinality: { min: 0, max: 1 } },
  },
  relations: ['input', 'increment', 'decrement', 'label'].map((child) => ({
    kind: 'contains' as const,
    parent: 'root',
    child,
  })),
});
export type NumberFieldContext = {
  value: number;
  draft: string;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  readOnly: boolean;
  label: string;
  name: string;
};
export const NUMBER_FIELD_CONTEXT = createContextKey<NumberFieldContext>('base-number-field');
export function numberFieldMethod(run: RunHandle<any>, key: string, ...args: unknown[]) {
  const fn = run.anatomy.partsOf(NUMBER_FIELD_FAMILY, 'root')[0]?.getExpose(key);
  return typeof fn === 'function' ? fn(...args) : false;
}
