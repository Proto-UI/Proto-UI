import { defineAsHook, definePrototype, type DefHandle, type RunHandle } from '@proto.ui/core';
import { useOpenState } from '../tools';
import {
  COLLAPSIBLE_CONTEXT,
  COLLAPSIBLE_FAMILY,
  rejectDuplicateCollapsiblePart,
  requestCollapsibleOpen,
  type CollapsibleOpenReason,
} from './shared';
import type {
  CollapsibleRootAsHookContract,
  CollapsibleRootExposes,
  CollapsibleRootProps,
} from './types';

function setupCollapsibleRoot(def: DefHandle<CollapsibleRootProps, CollapsibleRootExposes>): void {
  // P-BASE-COLLAPSIBLE-ROOT-OWNER, P-BASE-COLLAPSIBLE-ANATOMY
  def.anatomy.claim(COLLAPSIBLE_FAMILY, { role: 'root' });
  def.props.define({
    open: { type: 'boolean', empty: 'fallback' },
    defaultOpen: { type: 'boolean', empty: 'fallback' },
    disabled: { type: 'boolean', empty: 'fallback' },
  });
  def.props.setDefaults({ defaultOpen: false, disabled: false });

  def.context.provide(COLLAPSIBLE_CONTEXT, {
    open: false,
    controlled: false,
    disabled: false,
    requestedOpen: false,
    requestReason: null,
    requestVersion: 0,
  });

  // P-BASE-COLLAPSIBLE-DEFAULT-OPEN, P-BASE-COLLAPSIBLE-CONTROLLED
  // Existing protocol-neutral helper owns initialization and controlled prop sync.
  const openState = useOpenState({
    exposeOpenMethodKey: 'openCollapsible',
    requestOpen(run, nextOpen, reason) {
      const normalized: CollapsibleOpenReason =
        reason === 'pointer' || reason === 'keyboard' ? reason : 'programmatic';
      requestCollapsibleOpen(run, nextOpen, normalized);
    },
  });
  const open = openState.getState!('open')!;
  def.expose.event('openChange', { payload: 'json' });
  let reportedThrough = 0;
  let reportedAhead: Set<number> | undefined;

  const syncContext = (run: RunHandle<CollapsibleRootProps>, publishInitial = false) => {
    const snapshot = run.context.read(COLLAPSIBLE_CONTEXT);
    const controlled = run.props.isProvided('open');
    // A pending uncontrolled request may reach parts before this Root callback.
    const nextOpen =
      !controlled && snapshot.requestVersion > reportedThrough ? snapshot.open : open.get();
    const disabled = !!run.props.get().disabled;
    if (
      snapshot.open !== nextOpen ||
      snapshot.controlled !== controlled ||
      snapshot.disabled !== disabled
    ) {
      run.context.update(COLLAPSIBLE_CONTEXT, {
        ...snapshot,
        open: nextOpen,
        controlled,
        disabled,
      });
    } else if (publishInitial) run.context.update(COLLAPSIBLE_CONTEXT, snapshot);
  };

  def.context.subscribe(COLLAPSIBLE_CONTEXT, (run, next) => {
    // A nested subscriber can supersede the publication currently being dispatched.
    const snapshot = run.context.read(COLLAPSIBLE_CONTEXT);
    const version = next.requestVersion;
    const newRequest = version > reportedThrough && !reportedAhead?.has(version);
    if (newRequest) {
      // Keep every accepted envelope, even when nested delivery reaches Root first.
      // The ordinary ordered path needs no allocation or retained request history.
      if (version === reportedThrough + 1) {
        reportedThrough = version;
        while (reportedAhead?.delete(reportedThrough + 1)) reportedThrough++;
      } else {
        (reportedAhead ??= new Set()).add(version);
      }
    }
    // Only the current provider determines canonical truth, never a stale envelope.
    if (!snapshot.controlled && open.get() !== snapshot.open) {
      open.set(snapshot.open, 'reason: collapsible uncontrolled request');
    }
    if (!newRequest) return;
    // P-BASE-COLLAPSIBLE-REQUEST-ONLY: each accepted request signals exactly once.
    run.expose.emit('openChange', {
      open: next.requestedOpen,
      reason: next.requestReason!,
    });
  });

  for (const role of ['trigger', 'content'] as const) {
    def.anatomy.subscribeParts(COLLAPSIBLE_FAMILY, role, (run, parts) => {
      if (parts.length > 1) rejectDuplicateCollapsiblePart(run, role);
      // Rebind reused, including detached, parts to this owner's current fact.
      // This is structural synchronization, not a disclosure request.
      syncContext(run, true);
    });
  }

  def.lifecycle.onCreated((run) => {
    rejectDuplicateCollapsiblePart(run, 'trigger');
    rejectDuplicateCollapsiblePart(run, 'content');
    // Adopted alive parts need the initial owner fact even when it is the default.
    syncContext(run, true);
  });
  def.props.watch(['open', 'disabled'], (run) => syncContext(run));
  open.watch((run, event) => {
    if (event.type === 'next') syncContext(run);
  });
}

// P-BASE-COLLAPSIBLE-AUTHORING-ENTRIES
export const asCollapsibleRoot = defineAsHook<
  CollapsibleRootProps,
  CollapsibleRootExposes,
  CollapsibleRootAsHookContract
>({ name: 'as-collapsible-root', setup: setupCollapsibleRoot });

const collapsibleRoot = definePrototype({
  name: 'base-collapsible-root',
  setup: setupCollapsibleRoot,
});

export default collapsibleRoot;
