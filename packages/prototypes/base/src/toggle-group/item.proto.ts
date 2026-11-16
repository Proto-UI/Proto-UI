import { defineAsHook, definePrototype, type DefHandle, type RunHandle } from '@proto.ui/core';
import {
  asAccessible,
  asCollectionItem,
  asControlLabel,
  asFocusable,
  asTrigger,
} from '@proto.ui/hooks';
import {
  TOGGLE_GROUP_CONTEXT,
  TOGGLE_GROUP_FAMILY,
  createToggleGroupItemId,
  groupCommand,
  type ToggleGroupContext,
} from './shared';
import type {
  ToggleGroupItemProps,
  ToggleGroupItemExposes,
  ToggleGroupItemAsHookContract,
} from './types';
function setup(def: DefHandle<ToggleGroupItemProps, ToggleGroupItemExposes>) {
  const id = createToggleGroupItemId();
  asCollectionItem().configure({
    family: TOGGLE_GROUP_FAMILY,
    role: 'item',
    getMeta: (run) => ({
      id,
      value: run.props.get().value ?? '',
      disabled: !!run.props.get().disabled,
    }),
  });
  def.props.define({
    value: { type: 'string', empty: 'fallback' },
    disabled: { type: 'boolean', empty: 'fallback' },
    a11yLabel: { type: 'string', empty: 'fallback' },
  });
  def.props.setDefaults({ value: '', disabled: false, a11yLabel: '' });
  asTrigger();
  const focus = asFocusable<ToggleGroupItemProps>();
  focus.configure({ disabled: false });
  const active = def.state.bool('active', false),
    disabled = def.state.bool('disabled', false);
  def.expose.state('active', active);
  def.expose.state('disabled', disabled);
  def.expose.state('focused', focus.focused);
  def.expose.state('focusVisible', focus.focusVisible);
  const a11yLabel = def.state.string('a11yLabel', '');
  const a11y = asAccessible();
  a11y.role('button');
  // P-BASE-TOGGLE-GROUP-ITEM-PROP-A11Y-LABEL: explicit name wins; empty falls back to content-derived.
  a11y.name(a11yLabel);
  a11y.state('pressed', active);
  a11y.action('activate');
  a11y.state('disabled', disabled);
  let currentRun: RunHandle<ToggleGroupItemProps> | null = null;
  def.expose.method('focusSelf', (options) => {
    if (!disabled.get()) focus.focusSelf(options);
  });
  const activate = (
    run: RunHandle<ToggleGroupItemProps>,
    isCurrent: () => boolean = () => true
  ) => {
    if (!disabled.get() && currentRun && isCurrent())
      groupCommand(run, 'requestToggle', run.props.get().value);
  };
  asControlLabel().target<ToggleGroupItemProps>((run, request) => {
    const isCurrent = () => !disabled.get() && !!currentRun && request.isCurrent();
    if (!isCurrent()) return;
    focus.focusSelf({ reason: request.source === 'pointer' ? 'pointer' : 'programmatic' });
    if (isCurrent()) activate(run, isCurrent);
  });
  const sync = (run: RunHandle<ToggleGroupItemProps>, ctx: ToggleGroupContext) => {
    currentRun = run;
    const off = ctx.disabled || !!run.props.get().disabled;
    disabled.set(off, 'reason: toggle group item disabled');
    active.set(ctx.value.includes(run.props.get().value), 'reason: toggle group item selected');
    a11yLabel.set(run.props.get().a11yLabel ?? '', 'reason: toggle group item accessible name sync');
    focus.setDisabled(off);
    focus.setNavParticipation(!off && ctx.current === id ? 'auto' : 'none');
    focus.setRovingStatus({ active: ctx.current === id, selected: active.get() });
  };
  def.context.subscribe(TOGGLE_GROUP_CONTEXT, sync);
  def.lifecycle.onMounted((run) => {
    sync(run, run.context.read(TOGGLE_GROUP_CONTEXT));
    groupCommand(run, 'setCurrent', run.context.read(TOGGLE_GROUP_CONTEXT).current);
  });
  def.lifecycle.onUnmounted(() => {
    currentRun = null;
  });
  def.props.watchAll((run) => {
    sync(run, run.context.read(TOGGLE_GROUP_CONTEXT));
    groupCommand(run, 'setCurrent', run.context.read(TOGGLE_GROUP_CONTEXT).current);
  });
  focus.focused.watch((run, e) => {
    if (e.type === 'next' && e.next && !disabled.get()) groupCommand(run, 'setCurrent', id);
  });
  def.event.onGlobal('key.down', (_run, e) => {
    if (focus.focused.get() && !disabled.get() && e.key === ' ')
      e.control.requestDefaultActionPrevention({
        reason: 'toggle-group.space',
        source: 'base-toggle-group-item',
      });
  });
  def.event.on('press.commit', (run) => {
    activate(run);
  });
}
export const asToggleGroupItem = defineAsHook<
  ToggleGroupItemProps,
  ToggleGroupItemExposes,
  ToggleGroupItemAsHookContract
>({ name: 'as-toggle-group-item', setup });
export default definePrototype({ name: 'base-toggle-group-item', setup });
