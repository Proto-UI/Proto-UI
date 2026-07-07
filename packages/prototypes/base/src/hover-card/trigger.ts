import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { asFocusable } from '@proto.ui/hooks';
import { asButton } from '../button';
import { HOVER_CARD_CONTEXT, HOVER_CARD_FAMILY } from './shared';
import type {
  HoverCardTriggerAsHookContract,
  HoverCardTriggerExposes,
  HoverCardTriggerProps,
} from './types';

function setupHoverCardTrigger(
  def: DefHandle<HoverCardTriggerProps, HoverCardTriggerExposes>
): void {
  def.anatomy.claim(HOVER_CARD_FAMILY, { role: 'trigger' });
  const button = asButton();
  const buttonState = button.stateHandles;
  if (!buttonState) {
    throw new Error('[base-hover-card-trigger] asButton must project Button state handles.');
  }

  def.props.define({
    disabled: { type: 'boolean', empty: 'fallback' },
  });
  def.props.setDefaults({
    disabled: false,
  });

  def.context.subscribe(HOVER_CARD_CONTEXT);
  const hovered = buttonState.hovered;
  const focusable = asFocusable<HoverCardTriggerProps>();
  const focused = focusable.focused;

  const updateFlags = (
    run: any,
    patch: Partial<{
      triggerHovered: boolean;
      triggerFocused: boolean;
    }>
  ) => {
    const ownDisabled = !!run.props.get().disabled;
    const ctx = run.context.read(HOVER_CARD_CONTEXT);
    if (ownDisabled || ctx.disabled) {
      run.context.update(HOVER_CARD_CONTEXT, (prev: any) => ({
        ...prev,
        triggerHovered: false,
        triggerFocused: false,
      }));
      return;
    }
    run.context.update(HOVER_CARD_CONTEXT, (prev: any) => ({ ...prev, ...patch }));
  };

  hovered.watch((run, event) => {
    if (event.type !== 'next') return;
    updateFlags(run, { triggerHovered: event.next });
  });
  focused.watch((run, event) => {
    if (event.type !== 'next') return;
    updateFlags(run, { triggerFocused: event.next });
  });
}

export const asHoverCardTrigger = defineAsHook<
  HoverCardTriggerProps,
  HoverCardTriggerExposes,
  HoverCardTriggerAsHookContract
>({
  name: 'as-hover-card-trigger',
  setup: setupHoverCardTrigger,
});

const hoverCardTrigger = definePrototype({
  name: 'base-hover-card-trigger',
  setup: setupHoverCardTrigger,
});

export default hoverCardTrigger;
