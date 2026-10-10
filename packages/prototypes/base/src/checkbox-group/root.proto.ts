import {
  defineAsHook,
  definePrototype,
  type DefHandle,
  type RunHandle,
  type RendererHandle,
} from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';
import { CHECKBOX_GROUP_CONTEXT, CHECKBOX_GROUP_FAMILY, normalizeSelection } from './shared';
import type {
  CheckboxGroupRootProps,
  CheckboxGroupRootExposes,
  CheckboxGroupRootAsHookContract,
} from './types';
function setup(def: DefHandle<CheckboxGroupRootProps, CheckboxGroupRootExposes>) {
  def.anatomy.claim(CHECKBOX_GROUP_FAMILY, { role: 'root' });
  const array = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === 'string');
  def.props.define({
    value: { type: 'object', empty: 'fallback', validator: array },
    defaultValue: { type: 'object', empty: 'fallback', validator: array },
    disabled: { type: 'boolean', empty: 'fallback' },
    readOnly: { type: 'boolean', empty: 'fallback' },
    ariaLabel: { type: 'string', empty: 'fallback' },
  });
  def.props.setDefaults({ defaultValue: [], disabled: false, readOnly: false, ariaLabel: '' });
  const checked = def.state.bool('checked', false),
    indeterminate = def.state.bool('indeterminate', false),
    disabled = def.state.bool('disabled', false),
    readOnly = def.state.bool('readOnly', false),
    label = def.state.string('label', '');
  for (const [key, state] of Object.entries({ checked, indeterminate, disabled, readOnly }))
    def.expose.state(key as 'checked', state);
  const a11y = asAccessible();
  a11y.role('group');
  a11y.name(label);
  a11y.state('disabled', disabled);
  def.context.provide(CHECKBOX_GROUP_CONTEXT, {
    value: [],
    disabled: false,
    readOnly: false,
    checked: false,
    indeterminate: false,
  });
  let run: RunHandle<CheckboxGroupRootProps> | null = null,
    value: string[] = [];
  const items = () =>
    run?.anatomy.order.partsOf(CHECKBOX_GROUP_FAMILY, 'item').flatMap((part) => {
      const fn = part.getExpose('__groupItem');
      return typeof fn === 'function' ? [fn() as { value: string; disabled: boolean }] : [];
    }) ?? [];
  const publish = () => {
    if (!run) return;
    const p = run.props.get();
    disabled.set(!!p.disabled, 'reason: group policy');
    readOnly.set(!!p.readOnly, 'reason: group policy');
    label.set(p.ariaLabel ?? '', 'reason: group name');
    const enabled = items().filter((i) => !i.disabled);
    const count = enabled.filter((i) => value.includes(i.value)).length;
    checked.set(enabled.length > 0 && count === enabled.length, 'reason: group aggregate');
    indeterminate.set(count > 0 && count < enabled.length, 'reason: group aggregate');
    run.context.update(CHECKBOX_GROUP_CONTEXT, {
      value: [...value],
      disabled: disabled.get(),
      readOnly: readOnly.get(),
      checked: checked.get(),
      indeterminate: indeterminate.get(),
    });
  };
  const request = (next: string[]) => {
    if (!run || disabled.get() || readOnly.get()) return false;
    if (JSON.stringify(value) === JSON.stringify(next)) return false;
    if (!run.props.isProvided('value')) value = next;
    publish();
    run.expose.emit('valueChange', { value: [...next] });
    return true;
  };
  def.expose.method('getValue', () => [...value]);
  def.expose.method('__itemsChanged', publish);
  def.expose.method('requestToggle', (key) => {
    const matches = items().filter((i) => i.value === key);
    if (matches.length !== 1 || matches[0].disabled) return false;
    return request(value.includes(key) ? value.filter((v) => v !== key) : [...value, key]);
  });
  def.expose.method('requestAll', () => {
    const enabled = [
      ...new Set(
        items()
          .filter((i) => !i.disabled)
          .map((i) => i.value)
      ),
    ];
    return request(
      checked.get()
        ? value.filter((v) => !enabled.includes(v))
        : normalizeSelection([...value, ...enabled])
    );
  });
  def.expose.event('valueChange', { payload: 'json' });
  def.lifecycle.onCreated((current) => {
    run = current;
    value = normalizeSelection(
      current.props.isProvided('value')
        ? current.props.get().value
        : current.props.get().defaultValue
    );
    publish();
  });
  def.lifecycle.onMounted((current) => {
    run = current;
    publish();
  });
  def.lifecycle.onUpdated(publish);
  def.lifecycle.onUnmounted(() => {
    run = null;
  });
  def.props.watchAll((current) => {
    run = current;
    if (current.props.isProvided('value')) value = normalizeSelection(current.props.get().value);
    publish();
  });
  def.anatomy.subscribeParts(CHECKBOX_GROUP_FAMILY, 'item', (current) => {
    run = current;
    publish();
  });
  return (r: RendererHandle<any>) => r.slot();
}
export const asCheckboxGroupRoot = defineAsHook<
  CheckboxGroupRootProps,
  CheckboxGroupRootExposes,
  CheckboxGroupRootAsHookContract
>({ name: 'as-checkbox-group-root', setup });
export default definePrototype({ name: 'base-checkbox-group-root', setup });
