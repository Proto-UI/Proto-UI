import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { useOpenState } from '../tools';
import {
  createDrawerRootId,
  DRAWER_CONTEXT,
  DRAWER_FAMILY,
  requestDrawerOpen,
  type DrawerContextValue,
} from './shared';
import type { DrawerRootAsHookContract, DrawerRootExposes, DrawerRootProps } from './types';

function sameContext(a: DrawerContextValue, b: DrawerContextValue): boolean {
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

function setupDrawerRoot(def: DefHandle<DrawerRootProps, DrawerRootExposes>): void {
  def.anatomy.claim(DRAWER_FAMILY, { role: 'root' });
  const rootId = createDrawerRootId();

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

  def.context.provide(DRAWER_CONTEXT, {
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
    exposeOpenMethodKey: 'openDrawer',
    requestOpen(run, nextOpen, reason) {
      const ctx = run.context.read(DRAWER_CONTEXT);
      if (ctx.disabled) return;
      requestDrawerOpen(run, nextOpen, reason, 'programmatic');
    },
  });
  const open = openState.getState?.('open');

  def.expose.event('openChange', { payload: 'json' });

  const initialContext: DrawerContextValue = {
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
  let snapshot: DrawerContextValue = initialContext;
  let published: DrawerContextValue = initialContext;
  let lastRequestVersion = 0;

  const syncContext = (run: any) => {
    const next = {
      ...snapshot,
      open: open?.get() ?? false,
    };
    snapshot = next;
    if (sameContext(published, next)) return;
    published = next;
    run.context.update(DRAWER_CONTEXT, next);
  };

  def.context.subscribe(DRAWER_CONTEXT, (run, next) => {
    snapshot = next;
    published = next;
    if (next.requestVersion !== lastRequestVersion) {
      lastRequestVersion = next.requestVersion;
      if (!next.controlled) {
        open?.set(next.requestedOpen, 'reason: drawer open request => uncontrolled sync');
      }
      run.expose.emit('openChange', {
        open: next.requestedOpen,
        reason: next.requestReason,
        focusReason: next.requestFocusReason,
      });
      return;
    }
    if (!snapshot.controlled) {
      open?.set(next.open, 'reason: drawer context sync => open');
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

export const asDrawerRoot = defineAsHook<
  DrawerRootProps,
  DrawerRootExposes,
  DrawerRootAsHookContract
>({
  name: 'as-drawer-root',
  setup: setupDrawerRoot,
});

const drawerRoot = definePrototype({
  name: 'base-drawer-root',
  setup(def) {
    setupDrawerRoot(def);
  },
});

export default drawerRoot;
