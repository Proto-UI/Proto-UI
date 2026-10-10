import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';
import { TOAST_CONTEXT, TOAST_FAMILY } from './shared';
import type { ToastTitleProps, ToastTitleExposes, ToastTitleAsHookContract } from './types';
function setup(def: DefHandle<ToastTitleProps, ToastTitleExposes>) {
  def.anatomy.claim(TOAST_FAMILY, { role: 'title' });
  const id = def.state.string('id', '');
  asAccessible().id(id);
  def.context.subscribe(TOAST_CONTEXT, (_run, ctx) =>
    id.set(ctx.id + '-title', 'reason: toast part id')
  );
  def.lifecycle.onCreated((run) =>
    id.set(run.context.read(TOAST_CONTEXT).id + '-title', 'reason: toast part initial id')
  );
}
export const asToastTitle = defineAsHook<
  ToastTitleProps,
  ToastTitleExposes,
  ToastTitleAsHookContract
>({ name: 'as-toast-title', setup });
export default definePrototype({ name: 'base-toast-title', setup });
