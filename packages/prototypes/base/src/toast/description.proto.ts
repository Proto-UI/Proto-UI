import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';
import { TOAST_CONTEXT, TOAST_FAMILY } from './shared';
import type {
  ToastDescriptionProps,
  ToastDescriptionExposes,
  ToastDescriptionAsHookContract,
} from './types';
function setup(def: DefHandle<ToastDescriptionProps, ToastDescriptionExposes>) {
  def.anatomy.claim(TOAST_FAMILY, { role: 'description' });
  const id = def.state.string('id', '');
  asAccessible().id(id);
  def.context.subscribe(TOAST_CONTEXT, (_run, ctx) =>
    id.set(ctx.id + '-description', 'reason: toast part id')
  );
  def.lifecycle.onCreated((run) =>
    id.set(run.context.read(TOAST_CONTEXT).id + '-description', 'reason: toast part initial id')
  );
}
export const asToastDescription = defineAsHook<
  ToastDescriptionProps,
  ToastDescriptionExposes,
  ToastDescriptionAsHookContract
>({ name: 'as-toast-description', setup });
export default definePrototype({ name: 'base-toast-description', setup });
