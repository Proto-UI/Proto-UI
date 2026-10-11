import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { useOpenState } from '../tools';
import {
  createAlertDialogRootId,
  ALERT_DIALOG_CONTEXT,
  ALERT_DIALOG_FAMILY,
  requestAlertDialogOpen,
  type AlertDialogContextValue,
} from './shared';
import type {
  AlertDialogRootAsHookContract,
  AlertDialogRootExposes,
  AlertDialogRootProps,
} from './types';

function sameContext(a: AlertDialogContextValue, b: AlertDialogContextValue): boolean {
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

function setupAlertDialogRoot(def: DefHandle<AlertDialogRootProps, AlertDialogRootExposes>): void {
  def.anatomy.claim(ALERT_DIALOG_FAMILY, { role: 'root' });
  const rootId = createAlertDialogRootId();

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

  def.context.provide(ALERT_DIALOG_CONTEXT, {
    rootId,
    open: false,
    openFocusReason: null,
    returnFocusReason: null,
    controlled: false,
    disabled: false,
    alert: true,
    a11yLabel: '',
    requestedOpen: false,
    requestReason: null,
    requestFocusReason: null,
    requestVersion: 0,
  });

  const openState = useOpenState({
    exposeOpenMethodKey: 'openAlertDialog',
    requestOpen(run, nextOpen, reason) {
      const ctx = run.context.read(ALERT_DIALOG_CONTEXT);
      if (ctx.disabled) return;
      requestAlertDialogOpen(run, nextOpen, reason, 'programmatic');
    },
  });
  const open = openState.getState?.('open');

  def.expose.event('openChange', { payload: 'json' });

  const initialContext: AlertDialogContextValue = {
    rootId,
    open: false,
    openFocusReason: null,
    returnFocusReason: null,
    controlled: false,
    disabled: false,
    alert: true,
    a11yLabel: '',
    requestedOpen: false,
    requestReason: null,
    requestFocusReason: null,
    requestVersion: 0,
  };
  let snapshot: AlertDialogContextValue = initialContext;
  let published: AlertDialogContextValue = initialContext;
  let lastRequestVersion = 0;

  const syncContext = (run: any) => {
    const next = {
      ...snapshot,
      open: open?.get() ?? false,
    };
    snapshot = next;
    if (sameContext(published, next)) return;
    published = next;
    run.context.update(ALERT_DIALOG_CONTEXT, next);
  };

  def.context.subscribe(ALERT_DIALOG_CONTEXT, (run, next) => {
    snapshot = next;
    published = next;
    if (next.requestVersion !== lastRequestVersion) {
      lastRequestVersion = next.requestVersion;
      if (!next.controlled) {
        open?.set(next.requestedOpen, 'reason: alertDialog open request => uncontrolled sync');
      }
      run.expose.emit('openChange', {
        open: next.requestedOpen,
        reason: next.requestReason,
        focusReason: next.requestFocusReason,
      });
      return;
    }
    if (!snapshot.controlled) {
      open?.set(next.open, 'reason: alertDialog context sync => open');
    }
  });

  def.lifecycle.onCreated((run) => {
    snapshot = {
      ...snapshot,
      controlled: run.props.isProvided('open'),
      disabled: !!run.props.get().disabled,
      alert: true,
      a11yLabel: run.props.get().a11yLabel ?? '',
    };
    syncContext(run);
  });

  def.props.watch(['open', 'disabled', 'a11yLabel'], (run, next) => {
    snapshot = {
      ...snapshot,
      controlled: run.props.isProvided('open'),
      disabled: !!next.disabled,
      alert: true,
      a11yLabel: next.a11yLabel ?? '',
    };
    syncContext(run);
  });

  open?.watch((run, event) => {
    if (event.type !== 'next') return;
    syncContext(run);
  });
}

export const asAlertDialogRoot = defineAsHook<
  AlertDialogRootProps,
  AlertDialogRootExposes,
  AlertDialogRootAsHookContract
>({
  name: 'as-alert-dialog-root',
  setup: setupAlertDialogRoot,
});

const alertDialogRoot = definePrototype({
  name: 'base-alert-dialog-root',
  setup(def) {
    setupAlertDialogRoot(def);
  },
});

export default alertDialogRoot;
