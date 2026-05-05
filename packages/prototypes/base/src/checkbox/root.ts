import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { asToggle } from '../toggle';
import { CHECKBOX_FAMILY } from './shared';
import type { CheckboxRootAsHookContract, CheckboxRootExposes, CheckboxRootProps } from './types';

function setupCheckboxRoot(def: DefHandle<CheckboxRootProps, CheckboxRootExposes>): void {
  def.anatomy.claim(CHECKBOX_FAMILY, { role: 'root' });

  def.props.define({
    checked: { type: 'boolean', empty: 'fallback' },
    defaultChecked: { type: 'boolean', empty: 'fallback' },
    disabled: { type: 'boolean', empty: 'fallback' },
    indeterminate: { type: 'boolean', empty: 'fallback' },
    defaultIndeterminate: { type: 'boolean', empty: 'fallback' },
  });
  def.props.setDefaults({
    defaultChecked: false,
    disabled: false,
    defaultIndeterminate: false,
  });

  asToggle();

  const indeterminate = def.state.bool('indeterminate', false);
  def.expose.state('indeterminate', indeterminate);

  let controlledIndeterminate = false;

  def.lifecycle.onCreated((run) => {
    controlledIndeterminate = run.props.isProvided('indeterminate');
    indeterminate.set(
      controlledIndeterminate
        ? !!run.props.get().indeterminate
        : !!run.props.get().defaultIndeterminate,
      'reason: lifecycle.onCreated => initialize indeterminate'
    );
  });

  def.props.watch(['indeterminate'], (run, next) => {
    controlledIndeterminate = run.props.isProvided('indeterminate');
    if (!controlledIndeterminate) return;
    indeterminate.set(
      !!next.indeterminate,
      'reason: props.watch(indeterminate) => controlled sync'
    );
  });

  def.event.on('press.commit', (run) => {
    if (indeterminate.get()) {
      indeterminate.set(false, 'reason: press.commit => clear indeterminate');
      run.event.emit('checkedChange', { checked: true });
      return;
    }
  });
}

export const asCheckboxRoot = defineAsHook<
  CheckboxRootProps,
  CheckboxRootExposes,
  CheckboxRootAsHookContract
>({
  name: 'as-checkbox-root',
  mode: 'once',
  setup: setupCheckboxRoot,
});

const checkboxRoot = definePrototype({
  name: 'base-checkbox-root',
  setup: setupCheckboxRoot,
});

export default checkboxRoot;
