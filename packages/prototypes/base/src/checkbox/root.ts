import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { asToggle } from '../toggle';
import { CHECKBOX_CONTEXT, CHECKBOX_FAMILY } from './shared';
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
  const checked = def.state.fromAccessibility('checked');
  const updateContext = def.context.provide(CHECKBOX_CONTEXT, {
    checked: false,
    indeterminate: false,
    disabled: false,
  });

  def.expose.event('indeterminateChange', { payload: 'json' });

  const indeterminate = def.state.bool('indeterminate', false);
  def.expose.state('indeterminate', indeterminate);

  let controlledIndeterminate = false;

  const publishContext = (run: any) => {
    updateContext({
      checked: !!checked.get(),
      indeterminate: !!indeterminate.get(),
      disabled: !!run.props.get().disabled,
    });
  };

  def.lifecycle.onCreated((run) => {
    controlledIndeterminate = run.props.isProvided('indeterminate');
    indeterminate.set(
      controlledIndeterminate
        ? !!run.props.get().indeterminate
        : !!run.props.get().defaultIndeterminate,
      'reason: lifecycle.onCreated => initialize indeterminate'
    );
    publishContext(run);
  });

  def.props.watch(['indeterminate', 'disabled'], (run, next) => {
    controlledIndeterminate = run.props.isProvided('indeterminate');
    if (controlledIndeterminate) {
      indeterminate.set(
        !!next.indeterminate,
        'reason: props.watch(indeterminate) => controlled sync'
      );
    }
    publishContext(run);
  });

  checked.watch((run, event) => {
    if (event.type === 'disconnect') return;
    publishContext(run);
  });

  def.event.on('press.commit', (run) => {
    if (run.props.get().disabled) return;
    if (indeterminate.get()) {
      if (!controlledIndeterminate) {
        indeterminate.set(false, 'reason: press.commit => clear indeterminate');
      }
      run.event.emit('indeterminateChange', { indeterminate: false });
      publishContext(run);
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
