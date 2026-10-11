import { defineAsHook, definePrototype, type DefHandle, type RunHandle } from '@proto.ui/core';
import { asAccessible, asCollection, asFocusRoving } from '@proto.ui/hooks';
import {
  getItems,
  normalizeValues,
  TOGGLE_GROUP_CONTEXT,
  TOGGLE_GROUP_FAMILY,
  type ToggleGroupContext,
} from './shared';
import type {
  ToggleGroupRootProps,
  ToggleGroupRootExposes,
  ToggleGroupRootAsHookContract,
} from './types';
function setup(def: DefHandle<ToggleGroupRootProps, ToggleGroupRootExposes>) {
  def.anatomy.claim(TOGGLE_GROUP_FAMILY, { role: 'root' });
  asCollection().configure({ family: TOGGLE_GROUP_FAMILY, itemRole: 'item' });
  const roving = asFocusRoving<ToggleGroupRootProps>();
  roving.configure({ orientation: 'horizontal', navigation: 'arrow', loop: true, entry: 'first' });
  def.props.define({
    value: { type: 'object', empty: 'fallback' },
    defaultValue: { type: 'object', empty: 'fallback' },
    multiple: { type: 'boolean', empty: 'fallback' },
    disabled: { type: 'boolean', empty: 'fallback' },
    readOnly: { type: 'boolean', empty: 'fallback' },
    orientation: { type: 'enum', empty: 'fallback', options: ['horizontal', 'vertical'] },
    loop: { type: 'boolean', empty: 'fallback' },
    a11yLabel: { type: 'string', empty: 'fallback' },
  });
  def.props.setDefaults({
    defaultValue: [],
    multiple: false,
    disabled: false,
    readOnly: false,
    orientation: 'horizontal',
    loop: true,
    a11yLabel: '',
  });
  const disabled = def.state.bool('disabled', false);
  const label = def.state.string('label', '');
  const orientation = def.state.string('orientation', 'horizontal');
  def.expose.state('disabled', disabled);
  def.expose.event('valueChange', { payload: 'json' });
  def.expose.method('focusFirst', () => roving.focusFirst());
  def.expose.method('focusLast', () => roving.focusLast());
  const a11y = asAccessible();
  a11y.role('group');
  a11y.name(label);
  a11y.state('disabled', disabled);
  a11y.state('orientation', orientation);
  let value: string[] = [];
  let current = '';
  let runNow: RunHandle<ToggleGroupRootProps> | null = null;
  let snapshot: ToggleGroupContext = { value, current, disabled: false, readOnly: false };
  def.context.provide(TOGGLE_GROUP_CONTEXT, snapshot);
  const publish = (run: RunHandle<ToggleGroupRootProps>) => {
    const items = getItems(run).filter((i) => !i.disabled);
    if (!items.some((i) => i.id === current))
      current = items.find((i) => value.includes(i.value))?.id ?? items[0]?.id ?? '';
    const next = { value, current, disabled: disabled.get(), readOnly: !!run.props.get().readOnly };
    if (JSON.stringify(next) === JSON.stringify(snapshot)) return;
    snapshot = next;
    run.context.update(TOGGLE_GROUP_CONTEXT, next);
  };
  def.expose.method('getValue', () => [...value]);
  def.expose.method('setCurrent', (id) => {
    if (runNow) {
      current = id;
      publish(runNow);
    }
  });
  def.expose.method('requestToggle', (itemValue) => {
    const run = runNow;
    if (!run || disabled.get() || run.props.get().readOnly) return false;
    const matches = getItems(run).filter((i) => i.value === itemValue);
    if (!itemValue || matches.length !== 1 || matches[0].disabled) return false;
    const next = value.includes(itemValue)
      ? value.filter((v) => v !== itemValue)
      : run.props.get().multiple
        ? [...value, itemValue]
        : [itemValue];
    if (!run.props.isProvided('value')) value = next;
    current = matches[0].id;
    publish(run);
    run.expose.emit('valueChange', { value: next });
    return true;
  });
  const sync = (run: RunHandle<ToggleGroupRootProps>, initial = false) => {
    runNow = run;
    const p = run.props.get();
    if (run.props.isProvided('value') || initial)
      value = normalizeValues(
        run.props.isProvided('value') ? p.value : p.defaultValue,
        !!p.multiple
      );
    else value = normalizeValues(value, !!p.multiple);
    disabled.set(!!p.disabled, 'reason: toggle group disabled');
    label.set(p.a11yLabel ?? '', 'reason: toggle group name');
    orientation.set(p.orientation ?? 'horizontal', 'reason: toggle group orientation');
    roving.setOrientation(p.orientation ?? 'horizontal');
    roving.setLoop(p.loop ?? true);
    publish(run);
  };
  def.lifecycle.onCreated((run) => sync(run, true));
  def.lifecycle.onMounted((run) => sync(run));
  def.lifecycle.onUnmounted(() => {
    runNow = null;
  });
  def.props.watchAll((run) => sync(run));
  def.anatomy.subscribeParts(TOGGLE_GROUP_FAMILY, 'item', (run) => publish(run));
}
export const asToggleGroupRoot = defineAsHook<
  ToggleGroupRootProps,
  ToggleGroupRootExposes,
  ToggleGroupRootAsHookContract
>({ name: 'as-toggle-group-root', setup });
export default definePrototype({ name: 'base-toggle-group-root', setup });
