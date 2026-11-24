import { defineAsHook, definePrototype, type DefHandle, type RenderFn } from '@proto.ui/core';
import { asAccessible, asControlLabel, asFocusable } from '@proto.ui/hooks';
import type {
  NativeFileInputAsHookContract,
  NativeFileInputExposes,
  NativeFileInputProps,
} from './types';

/** Control policy for one physical native file input. The host owns its picker,
 * FileList, accept/multiple options, change transport and clearing the selection. */
function setupNativeFileInput(
  def: DefHandle<NativeFileInputProps, NativeFileInputExposes>
): RenderFn {
  def.props.define({
    disabled: { type: 'boolean', empty: 'fallback' },
    required: { type: 'boolean', empty: 'fallback' },
    ariaLabel: { type: 'string', empty: 'fallback' },
  });
  def.props.setDefaults({ disabled: false, required: false, ariaLabel: '' });
  const disabled = def.state.bool('disabled', false);
  const required = def.state.bool('required', false);
  const label = def.state.string('fileInputLabel', '');
  const focus = asFocusable<NativeFileInputProps>();
  focus.configure({ disabled: false });
  const accessible = asAccessible();
  // Preserve the native file input's platform role and activation semantics.
  accessible.name(label);
  accessible.state('disabled', disabled);
  accessible.state('required', required);
  def.expose.state('disabled', disabled);
  def.expose.state('required', required);
  def.expose.state('focused', focus.focused);
  def.expose.state('focusVisible', focus.focusVisible);
  def.expose.method('focusSelf', (options) => {
    if (!disabled.get()) focus.focusSelf(options);
  });
  def.expose.method('blurSelf', () => focus.blur());
  asControlLabel().target<NativeFileInputProps>((_run, request) => {
    if (!disabled.get() && request.isCurrent())
      focus.focusSelf({ reason: request.source === 'pointer' ? 'pointer' : 'programmatic' });
  });

  let revision = 0;
  const sync = (props: NativeFileInputProps) => {
    const current = ++revision;
    focus.setDisabled(!!props.disabled);
    if (current !== revision) return;
    disabled.set(!!props.disabled, 'reason: native file input availability');
    if (current !== revision) return;
    required.set(!!props.required, 'reason: native file input requirement');
    if (current !== revision) return;
    label.set(props.ariaLabel ?? '', 'reason: native file input name');
  };
  def.lifecycle.onCreated((run) => sync(run.props.get()));
  def.props.watch(['disabled', 'required', 'ariaLabel'], (_run, props) => sync(props));
  def.lifecycle.onBeforeDispose(() => {
    revision++;
  });
  return (render) => render.slot();
}

export const asNativeFileInput = defineAsHook<
  NativeFileInputProps,
  NativeFileInputExposes,
  NativeFileInputAsHookContract
>({
  name: 'as-native-file-input',
  setup: setupNativeFileInput,
});

export default definePrototype<NativeFileInputProps, NativeFileInputExposes>({
  name: 'base-native-file-input',
  setup: setupNativeFileInput,
});
