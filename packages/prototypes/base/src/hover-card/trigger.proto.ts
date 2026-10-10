import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { asFocusable } from '@proto.ui/hooks';
import { HOVER_CARD_CONTEXT, HOVER_CARD_FAMILY, createHoverCardInteraction } from './shared';
import type {
  HoverCardTriggerAsHookContract,
  HoverCardTriggerExposes,
  HoverCardTriggerProps,
} from './types';

function setupHoverCardTrigger(
  def: DefHandle<HoverCardTriggerProps, HoverCardTriggerExposes>
): void {
  // P-BASE-HOVER-CARD-TRIGGER-ROLE, P-BASE-HOVER-CARD-TRIGGER-NO-BUTTON-DEPENDENCY
  def.anatomy.claim(HOVER_CARD_FAMILY, { role: 'trigger' });

  def.props.define({ disabled: { type: 'boolean', empty: 'fallback' } });
  def.props.setDefaults({ disabled: false });

  // P-BASE-HOVER-CARD-TRIGGER-INTERACTION
  const disabled = def.state.bool('disabled', false);
  const hovered = def.state.bool('hovered', false);
  const interaction = createHoverCardInteraction('trigger');
  let interactionMounted = false;
  let pendingFocused: boolean | null = null;
  let disposed = false;
  const focusable = asFocusable<HoverCardTriggerProps>();
  focusable.configure({ disabled: false });
  const focused = focusable.focused;
  const focusVisible = focusable.focusVisible;

  def.expose.state('disabled', disabled);
  def.expose.state('hovered', hovered);
  def.expose.state('focused', focused);
  def.expose.state('focusVisible', focusVisible);
  def.expose.method('focusSelf', (options) => {
    if (!disabled.get()) focusable.focusSelf(options);
  });

  const syncDisabled = (run: any) => {
    // P-BASE-HOVER-CARD-TRIGGER-DISABLED
    const ctx = run.context.read(HOVER_CARD_CONTEXT);
    const nextDisabled = !!run.props.get().disabled || ctx.disabled;
    disabled.set(nextDisabled, 'reason: hover-card trigger disabled sync');
    if (nextDisabled) pendingFocused = null;
    focusable.setDisabled(nextDisabled);
    if (!nextDisabled) return;
    hovered.set(false, 'reason: hover-card trigger disabled => hovered false');
    if (!ctx.triggerHovered && !ctx.triggerFocused) return;
    interaction.update(
      run,
      { triggerHovered: false, triggerFocused: false },
      'trigger.pointerleave'
    );
  };

  def.context.subscribe(HOVER_CARD_CONTEXT, (run) => syncDisabled(run));
  def.props.watch(['disabled'], (run) => syncDisabled(run));
  def.lifecycle.onCreated((run) => syncDisabled(run));
  def.lifecycle.onMounted((run) => {
    if (disposed) return;
    interaction.mount(run);
    interactionMounted = true;
    // C-AS-FOCUSABLE-0001-G can fulfill pending focus before this author callback.
    // Consume only observed next events, never an old retained focused.get().
    const observed = pendingFocused;
    pendingFocused = null;
    if (observed !== null && !disabled.get())
      interaction.update(run, { triggerFocused: observed }, 'trigger.focus');
  });
  const releaseInteraction = () => {
    interactionMounted = false;
    pendingFocused = null;
    hovered.set(false, 'reason: hover-card trigger unmounted => hovered false');
    interaction.release();
  };
  def.lifecycle.onUnmounted(releaseInteraction);
  def.lifecycle.onBeforeDispose(() => {
    disposed = true;
    releaseInteraction();
  });

  def.event.on('pointer.enter', (run) => {
    if (disabled.get()) return;
    hovered.set(true, 'reason: hover-card trigger pointer.enter');
    interaction.update(run, { triggerHovered: true }, 'trigger.pointerenter');
  });
  def.event.on('pointer.leave', (run) => {
    hovered.set(false, 'reason: hover-card trigger pointer.leave');
    interaction.update(run, { triggerHovered: false }, 'trigger.pointerleave');
  });

  focused.watch((run, event) => {
    if (event.type !== 'next' || disposed) return;
    if (disabled.get()) {
      pendingFocused = null;
      return;
    }
    if (!interactionMounted) {
      pendingFocused = event.next;
      return;
    }
    interaction.update(run, { triggerFocused: event.next }, 'trigger.focus');
  });
}

/*
 * P-BASE-HOVER-CARD-TRIGGER-NO-ACTIVATION: no click/press action is authored;
 * an application-provided link keeps ownership of navigation activation.
 */

// P-BASE-HOVER-CARD-TRIGGER-AUTHORING-ENTRIES
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
