import { defineAsHook, definePrototype, type DefHandle, type RunHandle } from '@proto.ui/core';
import { asAccessible, asCollectionItem, asFocusable, asTrigger } from '@proto.ui/hooks';
import {
  TOOLBAR_CONTEXT,
  TOOLBAR_FAMILY,
  createToolbarButtonId,
  type ToolbarContext,
} from './shared';
import type {
  ToolbarButtonProps,
  ToolbarButtonExposes,
  ToolbarButtonAsHookContract,
} from './types';
function setup(def: DefHandle<ToolbarButtonProps, ToolbarButtonExposes>) {
  const id = createToolbarButtonId();
  asTrigger();
  asCollectionItem().configure({
    family: TOOLBAR_FAMILY,
    role: 'button',
    getMeta: (run) => ({ id, disabled: !!run.props.get().disabled }),
  });
  def.props.define({
    disabled: { type: 'boolean', empty: 'fallback' },
    value: { type: 'string', empty: 'fallback' },
  });
  def.props.setDefaults({ disabled: false, value: '' });
  const disabled = def.state.bool('disabled', false);
  const focus = asFocusable<ToolbarButtonProps>();
  focus.configure({ disabled: false });
  const a11y = asAccessible();
  a11y.role('button');
  a11y.nameFromContent();
  a11y.state('disabled', disabled);
  a11y.action('activate', { event: 'action' });
  def.expose.state('disabled', disabled);
  def.expose.state('focused', focus.focused);
  def.expose.state('focusVisible', focus.focusVisible);
  def.expose.method('focusSelf', (options) => {
    if (!disabled.get()) focus.focusSelf(options);
  });
  def.expose.event('action', { payload: 'json' });
  const setCurrent = (run: RunHandle<ToolbarButtonProps>, next = id) => {
    const fn = run.anatomy.partsOf(TOOLBAR_FAMILY, 'root')[0]?.getExpose('setCurrent');
    if (typeof fn === 'function') fn(next);
  };
  const sync = (run: RunHandle<ToolbarButtonProps>, ctx: ToolbarContext) => {
    const off = ctx.disabled || !!run.props.get().disabled;
    disabled.set(off, 'reason: toolbar button disabled');
    focus.setDisabled(off);
    focus.setNavParticipation(!off && ctx.current === id ? 'auto' : 'none');
    focus.setRovingStatus({ active: ctx.current === id });
  };
  def.context.subscribe(TOOLBAR_CONTEXT, sync);
  def.lifecycle.onMounted((run) => {
    sync(run, run.context.read(TOOLBAR_CONTEXT));
    const fn = run.anatomy.partsOf(TOOLBAR_FAMILY, 'root')[0]?.getExpose('setCurrent');
    if (typeof fn === 'function') fn(run.context.read(TOOLBAR_CONTEXT).current);
  });
  def.props.watchAll((run) => {
    sync(run, run.context.read(TOOLBAR_CONTEXT));
    setCurrent(run, run.context.read(TOOLBAR_CONTEXT).current);
  });
  focus.focused.watch((run, e) => {
    if (e.type === 'next' && e.next && !disabled.get()) setCurrent(run);
  });
  def.event.onGlobal('key.down', (_run, e) => {
    if (focus.focused.get() && !disabled.get() && e.key === ' ')
      e.control.requestDefaultActionPrevention({
        reason: 'toolbar.space',
        source: 'base-toolbar-button',
      });
  });
  def.event.on('press.commit', (run) => {
    if (disabled.get()) return;
    setCurrent(run);
    run.expose.emit('action', { value: run.props.get().value ?? '' });
  });
}
export const asToolbarButton = defineAsHook<
  ToolbarButtonProps,
  ToolbarButtonExposes,
  ToolbarButtonAsHookContract
>({ name: 'as-toolbar-button', setup });
export default definePrototype({ name: 'base-toolbar-button', setup });
