import type {
  DefHandle,
  FocusRovingMemberStatus,
  ObservedStateHandle,
  OwnedStateHandle,
} from '@proto.ui/core';
import { asFocusable, asTrigger } from '@proto.ui/hooks';

type DropdownCommandProps = { disabled?: boolean };

export type DropdownCommand = {
  disabled: OwnedStateHandle<boolean>;
  hovered: OwnedStateHandle<boolean>;
  focused: ObservedStateHandle<boolean, DropdownCommandProps>;
  focusVisible: ObservedStateHandle<boolean, DropdownCommandProps>;
  pressed: OwnedStateHandle<boolean>;
  focusSelf(options?: { reason?: 'programmatic' | 'keyboard' | 'pointer' }): void;
  setRovingStatus(status: FocusRovingMemberStatus): void;
  syncDisabled(disabled: boolean): void;
};

/** Dropdown-owned command substrate shared by Trigger and Item. */
export function setupDropdownCommand(
  def: DefHandle<DropdownCommandProps, any>,
  reasonPrefix: string,
  options?: { focusableWhenDisabled?: boolean }
): DropdownCommand {
  // P-BASE-DROPDOWN-MENU-PROTOCOL-INDEPENDENCE
  // P-BASE-DROPDOWN-MENU-TRIGGER-COMMAND, P-BASE-DROPDOWN-MENU-ITEM-DISABLED
  asTrigger();
  def.props.define({ disabled: { type: 'boolean', empty: 'fallback' } });
  def.props.setDefaults({ disabled: false });

  const disabled = def.state.bool('disabled', false);
  const hovered = def.state.bool('hovered', false);
  const pressed = def.state.bool('pressed', false);
  const focusable = asFocusable<DropdownCommandProps>();
  focusable.configure({ disabled: false });
  const focused = focusable.focused;
  const focusVisible = focusable.focusVisible;

  def.expose.state('disabled', disabled);
  def.expose.state('hovered', hovered);
  def.expose.state('focused', focused);
  def.expose.state('focusVisible', focusVisible);
  def.expose.state('pressed', pressed);

  const focusSelf = (focusOptions?: { reason?: 'programmatic' | 'keyboard' | 'pointer' }) => {
    if (disabled.get() && !options?.focusableWhenDisabled) return;
    focusable.focusSelf(focusOptions);
  };
  def.expose.method('focusSelf', focusSelf);

  const clearTransient = (reason: string) => {
    hovered.set(false, reason);
    pressed.set(false, reason);
  };
  const syncDisabled = (nextDisabled: boolean) => {
    disabled.set(nextDisabled, `reason: ${reasonPrefix} disabled sync`);
    focusable.setDisabled(nextDisabled && !options?.focusableWhenDisabled);
    if (nextDisabled) clearTransient(`reason: ${reasonPrefix} disabled => reset interaction`);
  };

  def.event.on('key.down', (_run, ev) => {
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

  return {
    disabled,
    hovered,
    focused,
    focusVisible,
    pressed,
    focusSelf,
    setRovingStatus: (status) => focusable.setRovingStatus(status),
    syncDisabled,
  };
}
