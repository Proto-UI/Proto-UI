import {
  defineAsHook,
  definePrototype,
  delay,
  type DefHandle,
  type DelayTask,
} from '@proto.ui/core';
import { TOOLTIP_GROUP_CONTEXT, type TooltipGroupContextValue } from './shared';
import type { TooltipGroupAsHookContract, TooltipGroupExposes, TooltipGroupProps } from './types';

export const DEFAULT_TOOLTIP_OPEN_DELAY = 700;
export const DEFAULT_TOOLTIP_CLOSE_DELAY = 100;
export const DEFAULT_TOOLTIP_SKIP_DELAY = 300;

function normalizeDelay(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function sameContext(a: TooltipGroupContextValue, b: TooltipGroupContextValue): boolean {
  return (
    a.openDelay === b.openDelay &&
    a.closeDelay === b.closeDelay &&
    a.skipDelay === b.skipDelay &&
    a.warm === b.warm &&
    a.activeTooltipId === b.activeTooltipId &&
    a.requestTooltipId === b.requestTooltipId &&
    a.requestOpen === b.requestOpen &&
    a.requestReason === b.requestReason &&
    a.requestVersion === b.requestVersion
  );
}

function setupTooltipGroup(def: DefHandle<TooltipGroupProps, TooltipGroupExposes>): void {
  def.props.define({
    openDelay: { type: 'number', empty: 'fallback' },
    closeDelay: { type: 'number', empty: 'fallback' },
    skipDelay: { type: 'number', empty: 'fallback' },
  });
  def.props.setDefaults({
    openDelay: DEFAULT_TOOLTIP_OPEN_DELAY,
    closeDelay: DEFAULT_TOOLTIP_CLOSE_DELAY,
    skipDelay: DEFAULT_TOOLTIP_SKIP_DELAY,
  });

  const initialContext: TooltipGroupContextValue = {
    openDelay: DEFAULT_TOOLTIP_OPEN_DELAY,
    closeDelay: DEFAULT_TOOLTIP_CLOSE_DELAY,
    skipDelay: DEFAULT_TOOLTIP_SKIP_DELAY,
    warm: false,
    activeTooltipId: null,
    requestTooltipId: null,
    requestOpen: false,
    requestReason: null,
    requestVersion: 0,
  };
  def.context.provide(TOOLTIP_GROUP_CONTEXT, initialContext);

  let snapshot = initialContext;
  let published = initialContext;
  let lastRequestVersion = 0;
  let cooldown: DelayTask | null = null;

  const cancelCooldown = () => {
    cooldown?.cancel();
    cooldown = null;
  };

  const publish = (run: any) => {
    if (sameContext(published, snapshot)) return;
    published = snapshot;
    run.context.update(TOOLTIP_GROUP_CONTEXT, snapshot);
  };

  const startCooldown = (run: any) => {
    cancelCooldown();
    const requestVersion = snapshot.requestVersion;
    cooldown = delay(snapshot.skipDelay, () => {
      cooldown = null;
      const latest = run.context.read(TOOLTIP_GROUP_CONTEXT);
      if (latest.activeTooltipId !== null || latest.requestVersion !== requestVersion) return;
      snapshot = { ...latest, warm: false };
      publish(run);
    });
  };

  def.context.subscribe(TOOLTIP_GROUP_CONTEXT, (run, next) => {
    snapshot = next;
    published = next;
    if (next.requestVersion === lastRequestVersion) return;
    lastRequestVersion = next.requestVersion;

    if (next.requestOpen && next.requestTooltipId) {
      cancelCooldown();
      snapshot = { ...next, warm: true, activeTooltipId: next.requestTooltipId };
      publish(run);
      return;
    }

    if (next.requestTooltipId && next.activeTooltipId === next.requestTooltipId) {
      snapshot = { ...next, activeTooltipId: null, warm: true };
      publish(run);
      startCooldown(run);
    }
  });

  const syncProps = (run: any) => {
    const props = run.props.get();
    snapshot = {
      ...snapshot,
      openDelay: normalizeDelay(props.openDelay, DEFAULT_TOOLTIP_OPEN_DELAY),
      closeDelay: normalizeDelay(props.closeDelay, DEFAULT_TOOLTIP_CLOSE_DELAY),
      skipDelay: normalizeDelay(props.skipDelay, DEFAULT_TOOLTIP_SKIP_DELAY),
    };
    publish(run);
  };

  def.lifecycle.onCreated(syncProps);
  def.props.watch(['openDelay', 'closeDelay', 'skipDelay'], (run) => syncProps(run));
  def.lifecycle.onBeforeDispose(cancelCooldown);
}

export const asTooltipGroup = defineAsHook<
  TooltipGroupProps,
  TooltipGroupExposes,
  TooltipGroupAsHookContract
>({ name: 'as-tooltip-group', setup: setupTooltipGroup });

const tooltipGroup = definePrototype<TooltipGroupProps, TooltipGroupExposes>({
  name: 'base-tooltip-group',
  setup: setupTooltipGroup,
});

export default tooltipGroup;
