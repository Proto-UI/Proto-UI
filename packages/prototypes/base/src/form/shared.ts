import { createAnatomyFamily, createContextKey, type RunHandle } from '@proto.ui/core';
import type { FieldValue, FieldValiditySnapshot } from '../field/types';
export const FORM_FAMILY = createAnatomyFamily('base-form', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    field: { cardinality: { min: 0, max: '*' } },
    submit: { cardinality: { min: 0, max: '*' } },
    reset: { cardinality: { min: 0, max: '*' } },
  },
  relations: ['field', 'submit', 'reset'].map((child) => ({
    kind: 'contains' as const,
    parent: 'root',
    child,
  })),
});
export const FORM_CONTEXT = createContextKey<{
  disabled: boolean;
  pending: boolean;
  submitted: boolean;
}>('base-form');
export type FormFieldSnapshot = {
  name: string;
  value: FieldValue;
  disabled: boolean;
  available: boolean;
  implicitSubmit: boolean;
  validity: FieldValiditySnapshot;
};
export function formMethod(run: RunHandle<any>, name: string, ...args: unknown[]) {
  let parts: ReturnType<typeof run.anatomy.partsOf>;
  try {
    parts = run.anatomy.partsOf(FORM_FAMILY, 'root');
  } catch (error) {
    if ((error as { code?: string }).code === 'ANATOMY_CLAIM_INVALID') return false;
    throw error;
  }
  const method = parts[0]?.getExpose(name);
  return typeof method === 'function' ? method(...args) : false;
}
