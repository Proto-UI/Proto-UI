import {
  defineAsHook,
  defineHook,
  definePrototype,
  type DefHandle,
  type RunHandle,
} from '@proto.ui/core';
import { asAccessible, asFocusable } from '@proto.ui/hooks';
import {
  createTooltipContentId,
  TOOLTIP_CONTEXT,
  TOOLTIP_FAMILY,
  updateTooltipInteraction,
  type TooltipContextValue,
} from './shared';
import type {
  TooltipTriggerAsHookContract,
  TooltipTriggerExposes,
  TooltipTriggerProps,
} from './types';

const FOCUSABLE_DESCENDANT_SELECTOR =
  'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])';

function setupTooltipIntent(
  def: Omit<DefHandle<TooltipTriggerProps>, 'expose'>,
  ownsFocus = false
) {
  const accessible = asAccessible();
  def.anatomy.claim(TOOLTIP_FAMILY, { role: 'trigger' });
  def.props.define({ disabled: { type: 'boolean', empty: 'fallback' } });
  if (ownsFocus) def.props.setDefaults({ disabled: false });

  const disabled = def.state.bool('disabled', false);
  const hovered = def.state.bool('hovered', false);
  const describedBy = def.state.string('tooltipContentId', '');
  const focusable = asFocusable<TooltipTriggerProps>();
  if (ownsFocus) focusable.configure({ disabled: false });
  const focused = focusable.focused;
  const focusVisible = focusable.focusVisible;

  accessible.relation('describedBy', { target: describedBy, mode: 'append' });

  const syncContext = (run: RunHandle<TooltipTriggerProps>, ctx: TooltipContextValue) => {
    const nextDisabled = !!run.props.get().disabled || ctx.disabled;
    disabled.set(nextDisabled, 'reason: tooltip trigger disabled sync');
    if (ownsFocus) focusable.setDisabled(nextDisabled);
    const contentPresent = run.anatomy.partsOf(TOOLTIP_FAMILY, 'content').length > 0;
    describedBy.set(
      ctx.open && contentPresent ? createTooltipContentId(ctx.rootId) : '',
      'reason: tooltip trigger describedBy sync'
    );
    if (!nextDisabled) return;
    hovered.set(false, 'reason: tooltip trigger disabled');
    if (!ctx.triggerHovered && !ctx.triggerFocused) return;
    updateTooltipInteraction(
      run,
      { triggerHovered: false, triggerFocused: false },
      'trigger.pointerleave'
    );
  };

  def.context.subscribe(TOOLTIP_CONTEXT, (run, next) => syncContext(run, next));
  def.anatomy.subscribeParts(TOOLTIP_FAMILY, 'content', (run) => {
    try {
      syncContext(run, run.context.read(TOOLTIP_CONTEXT));
    } catch (error) {
      if ((error as { code?: string })?.code !== 'CONTEXT_DISCONNECTED') throw error;
    }
  });
  def.props.watch(['disabled'], (run) => syncContext(run, run.context.read(TOOLTIP_CONTEXT)));
  def.lifecycle.onCreated((run) => syncContext(run, run.context.read(TOOLTIP_CONTEXT)));

  def.event.on('pointer.enter', (run) => {
    if (disabled.get()) return;
    hovered.set(true, 'reason: tooltip trigger pointer.enter');
    updateTooltipInteraction(run, { triggerHovered: true }, 'trigger.pointerenter');
  });
  def.event.on('pointer.leave', (run) => {
    hovered.set(false, 'reason: tooltip trigger pointer.leave');
    updateTooltipInteraction(run, { triggerHovered: false }, 'trigger.pointerleave');
  });

  focused.watch((run, event) => {
    if (event.type !== 'next') return;
    updateTooltipInteraction(
      run,
      { triggerFocused: event.next && !disabled.get() },
      event.next ? 'trigger.focus' : 'trigger.blur'
    );
  });

  // A standalone trigger wrapping an already-focusable control must not add a
  // second tab stop, and the wrapped control's focus must still open the
  // tooltip. focus/focusout do not bubble, so the bubbled focusin/focusout
  // host events observe the descendant focus, while navigation participation
  // is deferred to the control that already owns focus.
  if (ownsFocus) {
    def.event.on('host:focusin', (run) => {
      updateTooltipInteraction(
        run,
        { triggerFocused: !disabled.get() },
        'trigger.focus'
      );
    });
    def.event.on('host:focusout', (run) => {
      updateTooltipInteraction(run, { triggerFocused: false }, 'trigger.blur');
    });
    def.lifecycle.onMounted((run) => {
      const el = run.host?.get();
      if (!(el instanceof HTMLElement)) return;
      if (el.querySelector(FOCUSABLE_DESCENDANT_SELECTOR)) {
        focusable.setNavParticipation('none');
      }
    });
  }
  return { disabled, hovered, focused, focusVisible, focusable };
}

function setupTooltipTrigger(def: DefHandle<TooltipTriggerProps, TooltipTriggerExposes>): void {
  const { disabled, hovered, focused, focusVisible, focusable } = setupTooltipIntent(def, true);
  def.expose.state('disabled', disabled);
  def.expose.state('hovered', hovered);
  def.expose.state('focused', focused);
  def.expose.state('focusVisible', focusVisible);
  def.expose.method('focusSelf', (options) => {
    if (!disabled.get()) focusable.focusSelf(options);
  });
}

/**
 * Same-node Tooltip participation for an existing focusable command, such as asButton.
 * The command owns focus configuration, activation, role, name and outward exposes.
 * Tooltip only observes its focus and pointer intent and appends its description.
 */
export const useTooltipTrigger = defineHook<TooltipTriggerProps, {}>({
  name: 'useTooltipTrigger',
  setup(def) {
    setupTooltipIntent(def);
  },
});

export const asTooltipTrigger = defineAsHook<
  TooltipTriggerProps,
  TooltipTriggerExposes,
  TooltipTriggerAsHookContract
>({ name: 'as-tooltip-trigger', setup: setupTooltipTrigger });

const tooltipTrigger = definePrototype<TooltipTriggerProps, TooltipTriggerExposes>({
  name: 'base-tooltip-trigger',
  setup: setupTooltipTrigger,
});

export default tooltipTrigger;
