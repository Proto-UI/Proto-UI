import type {
  DefHandle,
  FocusRovingMemberStatus,
  ObservedStateHandle,
  OwnedStateHandle,
} from '@proto.ui/core';
import { asFocusable, asTrigger } from '@proto.ui/hooks';

type SelectCommandProps = { disabled?: boolean };

export type SelectCommand = {
  disabled: OwnedStateHandle<boolean>;
  hovered: OwnedStateHandle<boolean>;
  focused: ObservedStateHandle<boolean, SelectCommandProps>;
  focusVisible: ObservedStateHandle<boolean, SelectCommandProps>;
  pressed: OwnedStateHandle<boolean>;
  focusSelf(options?: {
    reason?: 'programmatic' | 'keyboard' | 'pointer';
    preventScroll?: boolean;
  }): void;
  setRovingStatus(status: FocusRovingMemberStatus): void;
  resetInteraction(reason: string, options?: { blur?: boolean }): void;
  syncDisabled(disabled: boolean): void;
};

export function setupSelectCommand(
  def: DefHandle<SelectCommandProps, any>,
  reasonPrefix: string
): SelectCommand {
  asTrigger();
  def.props.define({ disabled: { type: 'boolean', empty: 'fallback' } });
  def.props.setDefaults({ disabled: false });

  const disabled = def.state.bool('disabled', false);
  const hovered = def.state.bool('hovered', false);
  const pressed = def.state.bool('pressed', false);
  const focusable = asFocusable<SelectCommandProps>();
  focusable.configure({ disabled: false });
  const focused = focusable.focused;
  const focusVisible = focusable.focusVisible;

  def.expose.state('disabled', disabled);
  def.expose.state('hovered', hovered);
  def.expose.state('focused', focused);
  def.expose.state('focusVisible', focusVisible);
  def.expose.state('pressed', pressed);

  const focusSelf = (options?: {
    reason?: 'programmatic' | 'keyboard' | 'pointer';
    preventScroll?: boolean;
  }) => {
    if (!disabled.get()) focusable.focusSelf(options);
  };
  def.expose.method('focusSelf', focusSelf);

  const clearTransient = (reason: string) => {
    hovered.set(false, reason);
    pressed.set(false, reason);
  };
  const syncDisabled = (nextDisabled: boolean) => {
    disabled.set(nextDisabled, `reason: ${reasonPrefix} disabled sync`);
    focusable.setDisabled(nextDisabled);
    if (nextDisabled) clearTransient(`reason: ${reasonPrefix} disabled => reset interaction`);
  };
  const resetInteraction = (reason: string, options?: { blur?: boolean }) => {
    clearTransient(reason);
    if (options?.blur) focusable.blur();
  };

  def.event.on('key.down', (_run, ev) => {
    if (disabled.get() || !focused.get() || ev?.key !== ' ') return;
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
  def.event.on('press.commit', () => pressed.set(false, `reason: ${reasonPrefix} press.commit`));

  return {
    disabled,
    hovered,
    focused,
    focusVisible,
    pressed,
    focusSelf,
    setRovingStatus: (status) => focusable.setRovingStatus(status),
    resetInteraction,
    syncDisabled,
  };
}
