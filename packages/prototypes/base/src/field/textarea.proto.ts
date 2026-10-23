import { defineAsHook, definePrototype } from '@proto.ui/core';
import { asTextareaRoot, setupTextareaRoot } from '../textarea/root.proto';
import type {
  TextareaRootProps,
  TextareaRootExposes,
  TextareaRootAsHookContract,
} from '../textarea/types';
import type { ExposeState } from '@proto.ui/core';
import type { FieldControlBindingHandles } from './types';

/** Semantic Field composition, not a design-family variant or a second editor. */
// Shared schema; Field composition rejects nonempty external relationship IDs.
export type FieldTextareaProps = TextareaRootProps;
export type FieldTextareaExposes = TextareaRootExposes & {
  invalid: ExposeState<boolean>;
  pending: ExposeState<boolean>;
};
export type FieldTextareaAsHookContract = TextareaRootAsHookContract & {
  asHooks: { 'as-optional-field-control': FieldControlBindingHandles };
};
export const asFieldTextarea = defineAsHook<
  FieldTextareaProps,
  FieldTextareaExposes,
  FieldTextareaAsHookContract
>({
  name: 'as-field-textarea',
  modules: asTextareaRoot.modules,
  setup: (def) => setupTextareaRoot(def, { fieldBinding: true }),
});
export default definePrototype<FieldTextareaProps, FieldTextareaExposes>({
  name: 'base-field-textarea',
  modules: asFieldTextarea.modules,
  setup: (def) => setupTextareaRoot(def, { fieldBinding: true }),
});
