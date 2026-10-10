import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { asCollection } from '@proto.ui/hooks';
import { useOpenState } from '../tools';
import {
  createContextMenuRootId,
  CONTEXT_MENU_CONTEXT,
  CONTEXT_MENU_FAMILY,
  type ContextMenuContextValue,
  type ContextMenuOpenRequest,
} from './shared';
import type {
  ContextMenuRootAsHookContract,
  ContextMenuRootExposes,
  ContextMenuRootProps,
} from './types';

function sameContext(a: ContextMenuContextValue, b: ContextMenuContextValue): boolean {
  return Object.keys(a).every(
    (key) => a[key as keyof ContextMenuContextValue] === b[key as keyof ContextMenuContextValue]
  );
}

function setupContextMenuRoot(def: DefHandle<ContextMenuRootProps, ContextMenuRootExposes>): void {
  def.anatomy.claim(CONTEXT_MENU_FAMILY, { role: 'root' });
  const collection = asCollection();
  collection.configure({ family: CONTEXT_MENU_FAMILY });

  def.props.define({
    open: { type: 'boolean', empty: 'fallback' },
    defaultOpen: { type: 'boolean', empty: 'fallback' },
    disabled: { type: 'boolean', empty: 'fallback' },
    closeOnItemCommit: { type: 'boolean', empty: 'fallback' },
    openEntry: { type: 'string', empty: 'fallback' },
    openEntryValue: { type: 'string', empty: 'fallback' },
  });
  def.props.setDefaults({
    defaultOpen: false,
    disabled: false,
    closeOnItemCommit: true,
    openEntry: 'active-or-first',
    openEntryValue: '',
  });

  const initialContext: ContextMenuContextValue = {
    rootId: '',
    open: false,
    controlled: false,
    disabled: false,
    activeValue: '',
    closeOnItemCommit: true,
    openEntry: 'active-or-first',
    openEntryValue: '',
    requestReason: null,
    requestFocusReason: null,
    requestEntry: null,
  };

  def.context.provide(CONTEXT_MENU_CONTEXT, initialContext);

  let submitRequest = (_run: any, _request: ContextMenuOpenRequest): boolean => false;
  const openState = useOpenState({
    requestOpen(run, nextOpen, reason) {
      submitRequest(run, {
        open: nextOpen,
        reason,
        focusReason: 'programmatic',
      });
    },
  });
  const open = openState.getState?.('open');
  def.expose.event('openChange', { payload: 'json' });

  let snapshot = initialContext;
  let published = initialContext;
  let currentRun: any = null;

  const syncContext = (run: any) => {
    const next = { ...snapshot, open: open?.get() ?? false };
    snapshot = next;
    if (sameContext(published, next)) return;
    published = next;
    run.context.update(CONTEXT_MENU_CONTEXT, next);
  };

  def.context.subscribe(CONTEXT_MENU_CONTEXT, (run, next) => {
    snapshot = next;
    published = next;
  });

  submitRequest = (run, request) => {
    if (snapshot.disabled) return false;
    snapshot = {
      ...snapshot,
      activeValue: request.open || snapshot.controlled ? snapshot.activeValue : '',
      requestReason: request.reason,
      requestFocusReason: request.focusReason,
      requestEntry: request.open ? (request.entry ?? null) : null,
    };
    if (!snapshot.controlled) {
      open?.set(request.open, 'reason: contextMenu root accepted request');
    }
    syncContext(run);
    run.expose.emit('openChange', {
      open: request.open,
      reason: request.reason,
      focusReason: request.focusReason,
    });
    return true;
  };

  def.expose.method('requestOpen', (request) => {
    if (!currentRun) return false;
    return submitRequest(currentRun, request);
  });

  def.lifecycle.onCreated((run) => {
    currentRun = run;
    const props = run.props.get();
    snapshot = {
      ...snapshot,
      rootId: createContextMenuRootId(),
      controlled: run.props.isProvided('open'),
      disabled: !!props.disabled,
      closeOnItemCommit: props.closeOnItemCommit !== false,
      openEntry: (props.openEntry as ContextMenuRootProps['openEntry']) ?? 'active-or-first',
      openEntryValue: props.openEntryValue ?? '',
    };
    syncContext(run);
  });

  def.lifecycle.onMounted((run) => {
    currentRun = run;
  });

  def.lifecycle.onUnmounted(() => {
    currentRun = null;
  });

  def.props.watch(
    ['open', 'disabled', 'closeOnItemCommit', 'openEntry', 'openEntryValue'],
    (run, next) => {
      snapshot = {
        ...snapshot,
        controlled: run.props.isProvided('open'),
        disabled: !!next.disabled,
        closeOnItemCommit: next.closeOnItemCommit !== false,
        openEntry: (next.openEntry as ContextMenuRootProps['openEntry']) ?? 'active-or-first',
        openEntryValue: next.openEntryValue ?? '',
      };
      syncContext(run);
    }
  );

  open?.watch((run, event) => {
    if (event.type !== 'next') return;
    if (!event.next) snapshot = { ...snapshot, activeValue: '', requestEntry: null };
    syncContext(run);
  });
}

export const asContextMenuRoot = defineAsHook<
  ContextMenuRootProps,
  ContextMenuRootExposes,
  ContextMenuRootAsHookContract
>({
  name: 'as-context-menu-root',
  setup: setupContextMenuRoot,
});

const contextMenuRoot = definePrototype({
  name: 'base-context-menu-root',
  setup: setupContextMenuRoot,
});

export default contextMenuRoot;
