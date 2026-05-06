import { defineAsHook, definePrototype, tw, type DefHandle } from '@proto.ui/core';
import { asOpenState } from '../tools';
import { TOOLTIP_CONTEXT, TOOLTIP_FAMILY, type TooltipContextValue } from './shared';
import type { TooltipRootAsHookContract, TooltipRootExposes, TooltipRootProps } from './types';

function deriveOpen(ctx: TooltipContextValue): boolean {
  return ctx.triggerHovered || ctx.triggerFocused;
}

function sameContext(a: TooltipContextValue, b: TooltipContextValue): boolean {
  return (
    a.open === b.open &&
    a.controlled === b.controlled &&
    a.disabled === b.disabled &&
    a.delay === b.delay &&
    a.triggerHovered === b.triggerHovered &&
    a.triggerFocused === b.triggerFocused
  );
}

function setupTooltipRoot(def: DefHandle<TooltipRootProps, TooltipRootExposes>): void {
  def.anatomy.claim(TOOLTIP_FAMILY, { role: 'root' });

  def.props.define({
    open: { type: 'boolean', empty: 'fallback' },
    defaultOpen: { type: 'boolean', empty: 'fallback' },
    disabled: { type: 'boolean', empty: 'fallback' },
    delay: { type: 'number', empty: 'fallback' },
  });
  def.props.setDefaults({
    defaultOpen: false,
    disabled: false,
    delay: 0,
  });

  const updateContext = def.context.provide(TOOLTIP_CONTEXT, {
    open: false,
    controlled: false,
    disabled: false,
    delay: 0,
    triggerHovered: false,
    triggerFocused: false,
  });

  const openState = asOpenState({ exposeOpenMethodKey: 'openTooltip' });
  const open = openState.getState?.('open');

  const initialContext: TooltipContextValue = {
    open: false,
    controlled: false,
    disabled: false,
    delay: 0,
    triggerHovered: false,
    triggerFocused: false,
  };
  let snapshot: TooltipContextValue = initialContext;
  let published: TooltipContextValue = initialContext;

  const syncContext = () => {
    const next = { ...snapshot, open: open?.get() ?? false };
    snapshot = next;
    if (sameContext(published, next)) return;
    published = next;
    updateContext(next);
  };

  def.context.subscribe(TOOLTIP_CONTEXT, (_run, next) => {
    snapshot = next;
    published = next;
    if (!snapshot.controlled) {
      open?.set(deriveOpen(snapshot), 'reason: tooltip context sync => open');
    }
  });

  def.lifecycle.onCreated((run) => {
    snapshot = {
      ...snapshot,
      controlled: run.props.isProvided('open'),
      disabled: !!run.props.get().disabled,
      delay: run.props.get().delay ?? 0,
    };
    syncContext();
  });

  def.props.watch(['open', 'disabled', 'delay'], (run, next) => {
    snapshot = {
      ...snapshot,
      controlled: run.props.isProvided('open'),
      disabled: !!next.disabled,
      delay: next.delay ?? 0,
    };
    syncContext();
  });

  open?.watch((_run, event) => {
    if (event.type !== 'next') return;
    syncContext();
  });
}

export const asTooltipRoot = defineAsHook<
  TooltipRootProps,
  TooltipRootExposes,
  TooltipRootAsHookContract
>({
  name: 'as-tooltip-root',
  mode: 'once',
  setup: setupTooltipRoot,
});

const tooltipRoot = definePrototype({
  name: 'base-tooltip-root',
  setup(def) {
    setupTooltipRoot(def);
    def.feedback.style.use(tw('relative inline-flex items-start'));
  },
});

export default tooltipRoot;
