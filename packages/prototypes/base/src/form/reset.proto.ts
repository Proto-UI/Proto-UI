import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { setupFormAction } from './action-setup';
import type { FormActionProps, FormActionExposes, FormActionAsHookContract } from './types';
const setup = (def: DefHandle<FormActionProps, FormActionExposes>) => setupFormAction(def, 'reset');
export const asFormReset = defineAsHook<
  FormActionProps,
  FormActionExposes,
  FormActionAsHookContract
>({ name: 'as-form-reset', setup });
export default definePrototype<FormActionProps, FormActionExposes>({
  name: 'base-form-reset',
  setup,
});
