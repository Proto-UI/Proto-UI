import type { DefHandle, State } from '@proto.ui/core';
import { asAccessible, asFocusable, asTrigger } from '@proto.ui/hooks';

type AlertDialogCommandProps = { disabled?: boolean };

export type AlertDialogCommand = {
  disabled: State<boolean>;
  syncDisabled(disabled: boolean): void;
};

/**
 * AlertDialog-owned command substrate shared by Trigger and Close. It deliberately
 * consumes core/privileged capabilities rather than the Button prototype
 * protocol, preserving independent Base prototype ownership.
 */
export function setupAlertDialogCommand(
  def: DefHandle<AlertDialogCommandProps, any>,
  reasonPrefix: string
): AlertDialogCommand {
  const accessible = asAccessible();

  asTrigger();

  def.props.define({
    disabled: { type: 'boolean', empty: 'fallback' },
  });
  def.props.setDefaults({ disabled: false });

  const disabled = def.state.bool('disabled', false);
  const hovered = def.state.bool('hovered', false);
  const pressed = def.state.bool('pressed', false);
  const focusable = asFocusable<AlertDialogCommandProps>();
  focusable.configure({ disabled: false });
  const focused = focusable.focused;
  const focusVisible = focusable.focusVisible;

  def.expose.state('disabled', disabled);
  def.expose.state('hovered', hovered);
  def.expose.state('focused', focused);
  def.expose.state('focusVisible', focusVisible);
  def.expose.state('pressed', pressed);
  def.expose.method('focusSelf', (options: any) => {
    if (disabled.get()) return;
    focusable.focusSelf(options);
  });
  accessible.role('button');
  accessible.nameFromContent();
  accessible.state('disabled', disabled);
  accessible.action('activate', { event: 'click' });

  const clearTransient = (reason: string) => {
    hovered.set(false, reason);
    pressed.set(false, reason);
  };
  const syncDisabled = (nextDisabled: boolean) => {
    disabled.set(nextDisabled, `reason: ${reasonPrefix} disabled sync`);
    focusable.setDisabled(nextDisabled);
    if (nextDisabled) clearTransient(`reason: ${reasonPrefix} disabled => reset interaction`);
  };

  def.event.onGlobal('key.down', (_run, ev) => {
    const detail = ev;
    if (disabled.get() || !focused.get() || detail?.key !== ' ') return;
    ev.control.requestDefaultActionPrevention({
      reason: `${reasonPrefix}.space-activation`,
      source: reasonPrefix,
    });
  });
  def.event.on('pointer.enter', () => {
    if (!disabled.get()) hovered.set(true, `reason: ${reasonPrefix} pointer.enter`);
  });
  def.event.on('pointer.leave', () => clearTransient(`reason: ${reasonPrefix} pointer.leave`));
  def.event.on('pointer.cancel', () => clearTransient(`reason: ${reasonPrefix} pointer.cancel`));
  def.event.on('pointer.down', () => {
    if (!disabled.get()) pressed.set(true, `reason: ${reasonPrefix} pointer.down`);
  });
  def.event.on('pointer.up', () => pressed.set(false, `reason: ${reasonPrefix} pointer.up`));
  def.event.on('press.commit', () => {
    pressed.set(false, `reason: ${reasonPrefix} press.commit`);
  });

  return { disabled, syncDisabled };
}
