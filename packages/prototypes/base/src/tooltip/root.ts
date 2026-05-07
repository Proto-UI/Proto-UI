import { defineAsHook, definePrototype, tw, type DefHandle } from '@proto.ui/core';
import { asDelay } from '@proto.ui/hooks';
import { asOpenState } from '../tools';
import { TOOLTIP_CONTEXT, TOOLTIP_FAMILY, type TooltipContextValue } from './shared';
import type { TooltipRootAsHookContract, TooltipRootExposes, TooltipRootProps } from './types';

function deriveOpen(ctx: TooltipContextValue): boolean {
  if (ctx.disabled) return false;
  return ctx.triggerHovered || ctx.triggerFocused;
}

function sameContext(a: TooltipContextValue, b: TooltipContextValue): boolean {
  return (
    a.open === b.open &&
    a.openRevision === b.openRevision &&
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
    openRevision: 0,
    controlled: false,
    disabled: false,
    delay: 0,
    triggerHovered: false,
    triggerFocused: false,
  });

  const openState = asOpenState({ exposeOpenMethodKey: 'openTooltip' });
  const open = openState.getState?.('open');
  const delay = asDelay();

  const initialContext: TooltipContextValue = {
    open: false,
    openRevision: 0,
    controlled: false,
    disabled: false,
    delay: 0,
    triggerHovered: false,
    triggerFocused: false,
  };
  let snapshot: TooltipContextValue = initialContext;
  let published: TooltipContextValue = initialContext;
  let lastPublishedOpen = false;
  let openRevision = 0;
  let cancelDelayedOpen: (() => void) | null = null;
  let delayToken = 0;
  let pendingOpenToken = 0;
  let requestUpdate: (() => void) | null = null;

  const normalizeDelay = (value: unknown): number => {
    const delay = typeof value === 'number' && Number.isFinite(value) ? value : 0;
    return Math.max(0, delay);
  };

  const clearDelayedOpen = () => {
    delayToken++;
    pendingOpenToken = 0;
    cancelDelayedOpen?.();
    cancelDelayedOpen = null;
  };

  const syncContext = () => {
    const currentOpen = open?.get() ?? false;
    if (currentOpen !== lastPublishedOpen) {
      openRevision += 1;
      lastPublishedOpen = currentOpen;
    }
    const next = { ...snapshot, open: currentOpen, openRevision };
    snapshot = next;
    if (sameContext(published, next)) return;
    published = next;
    updateContext(next);
  };

  const requestOpenFromInteraction = (_run: any, next: TooltipContextValue) => {
    clearDelayedOpen();
    if (open?.get()) return;

    const ms = normalizeDelay(next.delay);
    if (ms <= 0) {
      open?.set(true, 'reason: tooltip trigger interaction => open');
      return;
    }

    const token = ++delayToken;
    cancelDelayedOpen = delay.after(ms, () => {
      if (token !== delayToken) return;
      if (open?.get()) return;
      // Must re-enter callback phase before mutating state.
      pendingOpenToken = token;
      requestUpdate?.();
    });
  };

  def.context.subscribe(TOOLTIP_CONTEXT, (run, next, prev) => {
    snapshot = next;
    published = next;
    lastPublishedOpen = next.open;
    openRevision = next.openRevision;
    const interactionChanged =
      next.controlled !== prev.controlled ||
      next.disabled !== prev.disabled ||
      next.delay !== prev.delay ||
      next.triggerHovered !== prev.triggerHovered ||
      next.triggerFocused !== prev.triggerFocused;

    if (!interactionChanged) return;
    clearDelayedOpen();

    if (snapshot.controlled) return;

    if (deriveOpen(snapshot)) {
      requestOpenFromInteraction(run, snapshot);
      return;
    }
    open?.set(false, 'reason: tooltip trigger interaction => close');
  });

  def.lifecycle.onCreated((run) => {
    requestUpdate = () => run.update();
    snapshot = {
      ...snapshot,
      controlled: run.props.isProvided('open'),
      disabled: !!run.props.get().disabled,
      delay: run.props.get().delay ?? 0,
    };
    syncContext();
  });

  def.lifecycle.onUpdated(() => {
    if (!pendingOpenToken) return;
    if (pendingOpenToken !== delayToken) return;
    if (snapshot.controlled) return;
    if (!deriveOpen(snapshot)) return;
    pendingOpenToken = 0;
    open?.set(true, 'reason: tooltip delayed open (update) => open');
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

  def.lifecycle.onUnmounted(() => {
    clearDelayedOpen();
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
