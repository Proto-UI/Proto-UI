import {
  defineAsHook,
  definePrototype,
  delay,
  type DefHandle,
  type DelayTask,
  type RunHandle,
} from '@proto.ui/core';
import { useOpenState } from '../tools';
import { DEFAULT_TOOLTIP_CLOSE_DELAY, DEFAULT_TOOLTIP_OPEN_DELAY } from './group.proto';
import {
  announceTooltipToGroup,
  createTooltipRootId,
  deriveTooltipInteractionOpen,
  requestTooltipOpen,
  TOOLTIP_CONTEXT,
  TOOLTIP_FAMILY,
  TOOLTIP_GROUP_CONTEXT,
  type TooltipContextValue,
  type TooltipGroupContextValue,
} from './shared';
import type { TooltipRootAsHookContract, TooltipRootExposes, TooltipRootProps } from './types';

function normalizeDelay(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function sameContext(a: TooltipContextValue, b: TooltipContextValue): boolean {
  return (
    a.rootId === b.rootId &&
    a.open === b.open &&
    a.controlled === b.controlled &&
    a.disabled === b.disabled &&
    a.openDelay === b.openDelay &&
    a.closeDelay === b.closeDelay &&
    a.triggerHovered === b.triggerHovered &&
    a.triggerFocused === b.triggerFocused &&
    a.contentHovered === b.contentHovered &&
    a.interactionReason === b.interactionReason &&
    a.interactionVersion === b.interactionVersion &&
    a.requestedOpen === b.requestedOpen &&
    a.requestReason === b.requestReason &&
    a.requestVersion === b.requestVersion
  );
}

function setupTooltipRoot(def: DefHandle<TooltipRootProps, TooltipRootExposes>): void {
  const rootId = createTooltipRootId();
  def.anatomy.claim(TOOLTIP_FAMILY, { role: 'root' });
  def.props.define({
    open: { type: 'boolean', empty: 'fallback' },
    defaultOpen: { type: 'boolean', empty: 'fallback' },
    disabled: { type: 'boolean', empty: 'fallback' },
    openDelay: { type: 'number', empty: 'fallback' },
    closeDelay: { type: 'number', empty: 'fallback' },
  });
  def.props.setDefaults({ defaultOpen: false, disabled: false });

  const initialContext: TooltipContextValue = {
    rootId,
    open: false,
    controlled: false,
    disabled: false,
    openDelay: DEFAULT_TOOLTIP_OPEN_DELAY,
    closeDelay: DEFAULT_TOOLTIP_CLOSE_DELAY,
    triggerHovered: false,
    triggerFocused: false,
    contentHovered: false,
    interactionReason: null,
    interactionVersion: 0,
    requestedOpen: false,
    requestReason: null,
    requestVersion: 0,
  };
  def.context.provide(TOOLTIP_CONTEXT, initialContext);

  const openState = useOpenState({
    exposeOpenMethodKey: 'openTooltip',
    requestOpen(run, nextOpen, reason) {
      const ctx = run.context.read(TOOLTIP_CONTEXT);
      if (ctx.disabled) return;
      requestTooltipOpen(run, nextOpen, reason);
    },
  });
  const open = openState.getState?.('open');
  def.expose.event('openChange', { payload: 'json' });

  let snapshot = initialContext;
  let published = initialContext;
  let lastRequestVersion = 0;
  let lastInteractionVersion = 0;
  let pendingIntent: boolean | null = null;
  let pendingDelay: DelayTask | null = null;

  const cancelPending = () => {
    pendingDelay?.cancel();
    pendingDelay = null;
    pendingIntent = null;
  };

  const resolveDelays = (run: RunHandle<TooltipRootProps>) => {
    const props = run.props.get();
    const group = run.context.tryRead(TOOLTIP_GROUP_CONTEXT);
    return {
      openDelay: run.props.isProvided('openDelay')
        ? normalizeDelay(props.openDelay, DEFAULT_TOOLTIP_OPEN_DELAY)
        : (group?.openDelay ?? DEFAULT_TOOLTIP_OPEN_DELAY),
      closeDelay: run.props.isProvided('closeDelay')
        ? normalizeDelay(props.closeDelay, DEFAULT_TOOLTIP_CLOSE_DELAY)
        : (group?.closeDelay ?? DEFAULT_TOOLTIP_CLOSE_DELAY),
    };
  };

  const syncContext = (run: RunHandle<TooltipRootProps>) => {
    const next = { ...snapshot, ...resolveDelays(run), open: open?.get() ?? false };
    snapshot = next;
    if (sameContext(published, next)) return;
    published = next;
    run.context.update(TOOLTIP_CONTEXT, next);
  };

  def.context.trySubscribe(TOOLTIP_GROUP_CONTEXT, (run, group) => {
    if (!group) return;
    syncContext(run);
    const ctx = run.context.read(TOOLTIP_CONTEXT);
    // The request frame reaches consumers before Group promotes it to active.
    // Treat that frame as the effective owner so the incoming Tooltip does not
    // close itself against the previous active id.
    const activeTooltipId =
      group.requestOpen && group.requestTooltipId ? group.requestTooltipId : group.activeTooltipId;
    if (activeTooltipId && activeTooltipId !== rootId && ctx.open) {
      requestTooltipOpen(run, false, 'group.other-open');
    }
  });

  const interactionDelay = (
    run: RunHandle<TooltipRootProps>,
    nextOpen: boolean,
    reason: string
  ) => {
    if (!nextOpen) return snapshot.closeDelay;
    if (reason === 'trigger.focus') return 0;
    const group = run.context.tryRead(TOOLTIP_GROUP_CONTEXT);
    return group?.warm ? 0 : snapshot.openDelay;
  };

  const scheduleInteractionRequest = (
    run: RunHandle<TooltipRootProps>,
    nextOpen: boolean,
    reason: string
  ) => {
    cancelPending();
    if (snapshot.disabled || nextOpen === (open?.get() ?? false)) return;
    pendingIntent = nextOpen;
    pendingDelay = delay(interactionDelay(run, nextOpen, reason), () => {
      if (pendingIntent !== nextOpen) return;
      pendingDelay = null;
      pendingIntent = null;
      const latest = run.context.read(TOOLTIP_CONTEXT);
      if (latest.disabled || deriveTooltipInteractionOpen(latest) !== nextOpen) return;
      requestTooltipOpen(run, nextOpen, reason);
    });
  };

  def.context.subscribe(TOOLTIP_CONTEXT, (run, next) => {
    snapshot = next;
    published = next;
    if (next.requestVersion !== lastRequestVersion) {
      lastRequestVersion = next.requestVersion;
      if (!next.controlled) open?.set(next.requestedOpen, 'reason: tooltip request');
      run.expose.emit('openChange', { open: next.requestedOpen, reason: next.requestReason });
      return;
    }
    if (next.interactionVersion !== lastInteractionVersion) {
      lastInteractionVersion = next.interactionVersion;
      scheduleInteractionRequest(
        run,
        deriveTooltipInteractionOpen(next),
        next.interactionReason ?? 'interaction'
      );
    }
  });

  const syncProps = (run: RunHandle<TooltipRootProps>) => {
    const props = run.props.get();
    snapshot = {
      ...snapshot,
      controlled: run.props.isProvided('open'),
      disabled: !!props.disabled,
      ...resolveDelays(run),
    };
    syncContext(run);
    if (snapshot.disabled) {
      cancelPending();
      if (open?.get()) requestTooltipOpen(run, false, 'disabled');
    }
  };

  def.lifecycle.onCreated(syncProps);
  def.props.watch(['open', 'disabled', 'openDelay', 'closeDelay'], (run) => syncProps(run));

  open?.watch((run, event) => {
    if (event.type !== 'next') return;
    if (pendingIntent === event.next) cancelPending();
    syncContext(run);
    announceTooltipToGroup(
      run,
      rootId,
      event.next,
      typeof event.reason === 'string' ? event.reason : 'open-state'
    );
  });

  def.lifecycle.onBeforeDispose(() => {
    cancelPending();
  });
}

export const asTooltipRoot = defineAsHook<
  TooltipRootProps,
  TooltipRootExposes,
  TooltipRootAsHookContract
>({ name: 'as-tooltip-root', setup: setupTooltipRoot });

const tooltipRoot = definePrototype<TooltipRootProps, TooltipRootExposes>({
  name: 'base-tooltip-root',
  setup: setupTooltipRoot,
});

export default tooltipRoot;
