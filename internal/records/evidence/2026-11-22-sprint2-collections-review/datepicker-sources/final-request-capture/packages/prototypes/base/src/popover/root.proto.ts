import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { useOpenState } from '../tools';
import {
  createPopoverRootId,
  POPOVER_CONTEXT,
  POPOVER_FAMILY,
  requestPopoverOpen,
  type PopoverContextValue,
} from './shared';
import type { PopoverRootAsHookContract, PopoverRootExposes, PopoverRootProps } from './types';

function sameContext(a: PopoverContextValue, b: PopoverContextValue): boolean {
  return (
    a.rootId === b.rootId &&
    a.open === b.open &&
    a.openSessionId === b.openSessionId &&
    a.openFocusReason === b.openFocusReason &&
    a.returnFocusReason === b.returnFocusReason &&
    a.controlled === b.controlled &&
    a.disabled === b.disabled &&
    a.alert === b.alert &&
    a.a11yLabel === b.a11yLabel &&
    a.requestedOpen === b.requestedOpen &&
    a.requestReason === b.requestReason &&
    a.requestFocusReason === b.requestFocusReason &&
    a.requestVersion === b.requestVersion
  );
}

function setupPopoverRoot(def: DefHandle<PopoverRootProps, PopoverRootExposes>): void {
  def.anatomy.claim(POPOVER_FAMILY, { role: 'root' });
  const rootId = createPopoverRootId();

  def.props.define({
    open: { type: 'boolean', empty: 'fallback' },
    defaultOpen: { type: 'boolean', empty: 'fallback' },
    disabled: { type: 'boolean', empty: 'fallback' },
    a11yLabel: { type: 'string', empty: 'fallback' },
  });
  def.props.setDefaults({
    defaultOpen: false,
    disabled: false,
    a11yLabel: '',
  });

  def.context.provide(POPOVER_CONTEXT, {
    rootId,
    open: false,
    openSessionId: 0,
    openFocusReason: null,
    returnFocusReason: null,
    controlled: false,
    disabled: false,
    alert: false,
    a11yLabel: '',
    requestedOpen: false,
    requestReason: null,
    requestFocusReason: null,
    requestVersion: 0,
  });

  const openState = useOpenState({
    exposeOpenMethodKey: 'openPopover',
    requestOpen(run, nextOpen, reason) {
      const ctx = run.context.read(POPOVER_CONTEXT);
      if (ctx.disabled) return;
      requestPopoverOpen(run, nextOpen, reason, 'programmatic');
    },
  });
  const open = openState.getState?.('open');

  def.expose.event('openChange', { payload: 'json' });

  let lastRequestVersion = 0;

  const syncContext = (run: any) => {
    const current: PopoverContextValue = run.context.read(POPOVER_CONTEXT);
    const nextOpen = open?.get() ?? false;
    const next = {
      ...current,
      open: nextOpen,
      openSessionId: current.openSessionId + (!current.open && nextOpen ? 1 : 0),
      controlled: run.props.isProvided('open'),
      disabled: !!run.props.get().disabled,
      alert: false,
      a11yLabel: run.props.get().a11yLabel ?? '',
    };
    if (sameContext(current, next)) return;
    run.context.update(POPOVER_CONTEXT, next);
  };

  def.context.subscribe(POPOVER_CONTEXT, (run, next) => {
    // next/prev describe a queued transition; the provider may already contain
    // a newer opening. Never restore canonical state from an old notification.
    const current = run.context.read(POPOVER_CONTEXT);
    if (next.requestVersion > lastRequestVersion) {
      lastRequestVersion = next.requestVersion;
      if (!current.controlled) {
        open?.set(current.open, 'reason: popover open request => uncontrolled sync');
      }
      run.expose.emit('openChange', {
        open: next.requestedOpen,
        reason: next.requestReason,
        focusReason: next.requestFocusReason,
      });
      return;
    }
    if (!current.controlled) {
      open?.set(current.open, 'reason: popover context sync => open');
    }
  });

  def.lifecycle.onCreated(syncContext);

  def.props.watch(['open', 'disabled', 'a11yLabel'], syncContext);

  open?.watch((run, event) => {
    if (event.type !== 'next') return;
    syncContext(run);
  });
}

export const asPopoverRoot = defineAsHook<
  PopoverRootProps,
  PopoverRootExposes,
  PopoverRootAsHookContract
>({
  name: 'as-popover-root',
  setup: setupPopoverRoot,
});

const popoverRoot = definePrototype({
  name: 'base-popover-root',
  setup(def) {
    setupPopoverRoot(def);
  },
});

export default popoverRoot;
