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

  const initialContext: PopoverContextValue = {
    rootId,
    open: false,
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
  };
  let snapshot: PopoverContextValue = initialContext;
  let published: PopoverContextValue = initialContext;
  let lastRequestVersion = 0;

  const syncContext = (run: any) => {
    const next = {
      ...snapshot,
      open: open?.get() ?? false,
    };
    snapshot = next;
    if (sameContext(published, next)) return;
    published = next;
    run.context.update(POPOVER_CONTEXT, next);
  };

  def.context.subscribe(POPOVER_CONTEXT, (run, next) => {
    snapshot = next;
    published = next;
    if (next.requestVersion !== lastRequestVersion) {
      lastRequestVersion = next.requestVersion;
      if (!next.controlled) {
        open?.set(next.requestedOpen, 'reason: popover open request => uncontrolled sync');
      }
      run.expose.emit('openChange', {
        open: next.requestedOpen,
        reason: next.requestReason,
        focusReason: next.requestFocusReason,
      });
      return;
    }
    if (!snapshot.controlled) {
      open?.set(next.open, 'reason: popover context sync => open');
    }
  });

  def.lifecycle.onCreated((run) => {
    snapshot = {
      ...snapshot,
      controlled: run.props.isProvided('open'),
      disabled: !!run.props.get().disabled,
      alert: false,
      a11yLabel: run.props.get().a11yLabel ?? '',
    };
    syncContext(run);
  });

  def.props.watch(['open', 'disabled', 'a11yLabel'], (run, next) => {
    snapshot = {
      ...snapshot,
      controlled: run.props.isProvided('open'),
      disabled: !!next.disabled,
      alert: false,
      a11yLabel: next.a11yLabel ?? '',
    };
    syncContext(run);
  });

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
