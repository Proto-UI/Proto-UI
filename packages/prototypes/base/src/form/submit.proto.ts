import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { setupFormAction } from './action-setup';
import type { FormActionProps, FormActionExposes, FormActionAsHookContract } from './types';
const setup = (def: DefHandle<FormActionProps, FormActionExposes>) =>
  setupFormAction(def, 'submit');
export const asFormSubmit = defineAsHook<
  FormActionProps,
  FormActionExposes,
  FormActionAsHookContract
>({ name: 'as-form-submit', setup });
export default definePrototype<FormActionProps, FormActionExposes>({
  name: 'base-form-submit',
  setup,
});
