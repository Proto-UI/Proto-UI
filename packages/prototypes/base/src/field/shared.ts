import { createAnatomyFamily, createContextKey, type RunHandle } from '@proto.ui/core';
import type {
  FieldControlReport,
  FieldValidationResult,
  FieldValue,
  FieldValiditySnapshot,
} from './types';
export const FIELD_FAMILY = createAnatomyFamily('base-field', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    control: { cardinality: { min: 1, max: 1 } },
    label: { cardinality: { min: 0, max: 1 } },
    description: { cardinality: { min: 0, max: 1 } },
    error: { cardinality: { min: 0, max: 1 } },
    validity: { cardinality: { min: 0, max: '*' } },
  },
  relations: ['control', 'label', 'description', 'error', 'validity'].map((child) => ({
    kind: 'contains' as const,
    parent: 'root',
    child,
  })),
});
export type FieldContext = FieldValiditySnapshot & {
  disabled: boolean;
  readOnly: boolean;
  required: boolean;
  minLength: number;
  maxLength: number;
};
export const EMPTY_VALIDITY: FieldValiditySnapshot = {
  status: 'unvalidated',
  invalid: false,
  pending: false,
  dirty: false,
  touched: false,
  filled: false,
  focused: false,
  flags: [],
  errors: [],
};
export const FIELD_CONTEXT = createContextKey<FieldContext>('base-field');
/** Normalize once by own index, without skipping holes or invoking a caller iterator. */
export function normalizeFieldStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const length = value.length;
  const normalized: string[] = [];
  for (let index = 0; index < length; index++) {
    if (!Object.hasOwn(value, index)) return undefined;
    const item: unknown = value[index];
    if (typeof item !== 'string') return undefined;
    normalized.push(item);
  }
  return normalized;
}
export function normalizeFieldValue(value: unknown): FieldValue | undefined {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  )
    return value;
  return normalizeFieldStringArray(value);
}
export const copyFieldValue = (value: FieldValue): FieldValue =>
  Array.isArray(value) ? value.slice() : value;
/** Capture and validate the whole external report before touching retained facts. */
export function normalizeFieldControlReport(input: unknown): FieldControlReport | undefined {
  if (
    !input ||
    typeof input !== 'object' ||
    !Object.hasOwn(input, 'value') ||
    Object.keys(input).some(
      (key) => !['value', 'initialValue', 'focused', 'composing', 'reason'].includes(key)
    )
  )
    return undefined;
  const candidate = input as Record<string, unknown>;
  const value = normalizeFieldValue(candidate.value);
  if (value === undefined) return undefined;
  const rawInitialValue = Object.hasOwn(candidate, 'initialValue')
    ? candidate.initialValue
    : undefined;
  const initialValue =
    rawInitialValue === undefined ? undefined : normalizeFieldValue(rawInitialValue);
  if (rawInitialValue !== undefined && initialValue === undefined) return undefined;
  const focused = Object.hasOwn(candidate, 'focused') ? candidate.focused : undefined;
  const composing = Object.hasOwn(candidate, 'composing') ? candidate.composing : undefined;
  const reason = Object.hasOwn(candidate, 'reason') ? candidate.reason : undefined;
  if (
    (focused !== undefined && typeof focused !== 'boolean') ||
    (composing !== undefined && typeof composing !== 'boolean') ||
    (reason !== undefined &&
      reason !== 'sync' &&
      reason !== 'input' &&
      reason !== 'change' &&
      reason !== 'blur' &&
      reason !== 'compositionend')
  )
    return undefined;
  return { value, initialValue, focused, composing, reason };
}
/** Invalid arrays are rejected even when invalid=false would not display errors. */
export function normalizeFieldValidationResult(
  input: unknown
): Required<FieldValidationResult> | undefined {
  if (
    !input ||
    typeof input !== 'object' ||
    (Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null) ||
    !Object.hasOwn(input, 'invalid') ||
    Object.getOwnPropertySymbols(input).length > 0 ||
    Object.getOwnPropertyNames(input).some((key) => key !== 'invalid' && key !== 'errors')
  )
    return undefined;
  const candidate = input as Record<string, unknown>;
  const invalid = candidate.invalid;
  if (typeof invalid !== 'boolean') return undefined;
  const rawErrors = Object.hasOwn(candidate, 'errors') ? candidate.errors : undefined;
  const errors = rawErrors === undefined ? [] : normalizeFieldStringArray(rawErrors);
  return errors === undefined ? undefined : { invalid, errors };
}
export const isFilled = (value: FieldValue) =>
  value !== null && value !== '' && value !== false && (!Array.isArray(value) || value.length > 0);
export const copyValidity = (value: FieldValiditySnapshot): FieldValiditySnapshot => ({
  status: value.status,
  invalid: value.invalid,
  pending: value.pending,
  dirty: value.dirty,
  touched: value.touched,
  filled: value.filled,
  focused: value.focused,
  flags: [...value.flags],
  errors: [...value.errors],
});
export function fieldRootMethod(
  run: RunHandle<any>,
  key: string
): ((...args: any[]) => any) | null {
  let parts: ReturnType<typeof run.anatomy.partsOf>;
  try {
    parts = run.anatomy.partsOf(FIELD_FAMILY, 'root');
  } catch (error) {
    if ((error as { code?: string }).code === 'ANATOMY_CLAIM_INVALID') return null;
    throw error;
  }
  const method = parts.length === 1 ? parts[0].getExpose(key) : null;
  return typeof method === 'function' ? (method as (...args: any[]) => any) : null;
}
export function rejectFieldDuplicates(run: RunHandle<any>, role: string) {
  if (run.anatomy.partsOf(FIELD_FAMILY, role).length > 1)
    throw Object.assign(new Error('Field permits one ' + role + ' in each Root.'), {
      code: 'FIELD_DUPLICATE_PART',
    });
}
export type FieldControlSnapshot = {
  value: FieldValue;
  initialValue: FieldValue;
  focused: boolean;
  composing: boolean;
  disabled: boolean;
  readOnly: boolean;
  required: boolean;
  active: boolean;
};

export const FIELD_LABEL_PAIR = Object.freeze({
  family: FIELD_FAMILY,
  labelRole: 'label',
  targetRole: 'control',
});
