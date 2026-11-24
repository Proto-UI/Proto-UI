import type { CollectionItemSnapshot, RunHandle } from '@proto.ui/core';
import { FIELD_CONTEXT } from '../field/shared';
import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { asBoundary, asCollection } from '@proto.ui/hooks';
import { useOpenState } from '../tools';
import {
  createSelectRootId,
  recordSelectFocusHandoff,
  SELECT_CONTEXT,
  SELECT_FAMILY,
  SELECT_GROUP_FAMILY,
  type SelectContextValue,
  type SelectOpenRequest,
  type SelectValueRequest,
} from './shared';
import type { SelectRootAsHookContract, SelectRootExposes, SelectRootProps } from './types';

function sameContext(a: SelectContextValue, b: SelectContextValue): boolean {
  return Object.keys(a).every(
    (key) => a[key as keyof SelectContextValue] === b[key as keyof SelectContextValue]
  );
}

/**
 * Bounded ownership for one active controlled request in the request stack.
 * The frame lives only while its request runs, so no rejected request is
 * retained and the stack depth stays bounded by the synchronous call depth.
 */
type ControlledFrame = {
  /** This request still awaits an owner acceptance of its canonical value. */
  pendingControlled: boolean;
};

function setupSelectRoot(def: DefHandle<SelectRootProps, SelectRootExposes>): void {
  def.anatomy.claim(SELECT_FAMILY, { role: 'root' });
  // A nested Select must not lend its orphan Label to an outer Group.
  def.anatomy.claim(SELECT_GROUP_FAMILY, { role: 'root' });
  const collection = asCollection();
  collection.configure({ family: SELECT_FAMILY });
  const boundary = asBoundary();
  boundary.observe('focus.move');

  def.props.define({
    open: { type: 'boolean', empty: 'fallback' },
    defaultOpen: { type: 'boolean', empty: 'fallback' },
    value: { type: 'string', empty: 'fallback' },
    defaultValue: { type: 'string', empty: 'fallback' },
    disabled: { type: 'boolean', empty: 'fallback' },
    readOnly: { type: 'boolean', empty: 'fallback' },
    closeOnSelect: { type: 'boolean', empty: 'fallback' },
  });
  def.props.setDefaults({
    defaultOpen: false,
    defaultValue: '',
    disabled: false,
    readOnly: false,
    closeOnSelect: true,
  });

  const initialContext: SelectContextValue = {
    rootId: '',
    collectionRevision: 0,
    focusHandoff: 0,
    focusHandoffBaseline: 0,
    pendingOpen: false,
    open: false,
    controlledOpen: false,
    value: '',
    textValue: '',
    controlledValue: false,
    disabled: false,
    readOnly: false,
    activeValue: '',
    closeOnSelect: true,
    requestReason: null,
    requestFocusReason: null,
    requestEntry: null,
  };
  def.context.provide(SELECT_CONTEXT, initialContext);

  let submitOpenRequest = (
    _run: RunHandle<SelectRootProps>,
    _request: SelectOpenRequest
  ): boolean => false;
  const openState = useOpenState({
    requestOpen(run, nextOpen, reason) {
      submitOpenRequest(run, {
        open: nextOpen,
        reason,
        focusReason: 'programmatic',
      });
    },
  });
  const open = openState.getState?.('open');
  const value = def.state.string('value', '');
  const textValue = def.state.string('textValue', '');
  def.expose.state('value', value);
  def.expose.state('textValue', textValue);
  def.expose.event('openChange', { payload: 'json' });
  def.expose.event('valueChange', { payload: 'json' });

  let snapshot = initialContext;
  let published = initialContext;
  let currentRun: RunHandle<SelectRootProps> | null = null;
  // A state/Context notification may retire and remount this same instance.
  // Run-handle identity alone cannot distinguish the old continuation.
  let viewEpoch = 0;
  let openRequestSequence = 0;
  let selectionSequence = 0;
  let pendingControlledChanges = 0;
  let queuedControlledNotifications = 0;
  let valueRequestDepth = 0;
  // Each active request owns its own acceptance budget. The anonymous counter
  // only carries delivered proposals whose owner accepts after they returned.
  // Retain the actual frame object for each active request. Array order is the
  // synchronous nesting order; retiring a view replaces the whole stack.
  let activeControlledFrames: ControlledFrame[] = [];
  const ownsView = (epoch: number) => currentRun !== null && epoch === viewEpoch;

  const nearestPendingFrame = (): ControlledFrame | null => {
    let pending: ControlledFrame | null = null;
    for (const frame of activeControlledFrames) {
      if (frame.pendingControlled) pending = frame;
    }
    return pending;
  };

  /** Cancels every outstanding acceptance budget; accepted notifications stay queued. */
  const cancelOutstandingAcceptances = () => {
    pendingControlledChanges = 0;
    for (const frame of activeControlledFrames) {
      frame.pendingControlled = false;
    }
  };

  const notifyFieldChange = (run: RunHandle<SelectRootProps>) => {
    const notify = run.anatomy
      .partsOf(SELECT_FAMILY, 'trigger')[0]
      ?.getExpose('__fieldSelectChange');
    if (typeof notify === 'function') notify();
  };

  const flushControlledNotifications = (run: RunHandle<SelectRootProps>, epoch: number) => {
    while (ownsView(epoch) && valueRequestDepth === 0 && queuedControlledNotifications > 0) {
      queuedControlledNotifications--;
      notifyFieldChange(run);
    }
  };

  const resolveTextValue = (run: RunHandle<SelectRootProps>, nextValue: string): string => {
    if (!nextValue) return '';
    const itemSnapshot = collection
      .getItems()
      .find((item: CollectionItemSnapshot) => item.value === nextValue);
    return itemSnapshot ? String(itemSnapshot.textValue || itemSnapshot.value || '') : '';
  };

  const syncContext = (run: RunHandle<SelectRootProps>) => {
    const previous = snapshot;
    const next = {
      ...previous,
      controlledOpen: run.props.isProvided('open'),
      controlDisabled: !!run.props.get().disabled,
      controlReadOnly: !!run.props.get().readOnly,
      disabled: !!run.props.get().disabled || !!run.context.tryRead(FIELD_CONTEXT)?.disabled,
      readOnly: !!run.props.get().readOnly || !!run.context.tryRead(FIELD_CONTEXT)?.readOnly,
      open: open?.get() ?? false,
      value: value.get(),
      textValue: textValue.get(),
    };
    if ((previous.open && !next.open) || next.value !== previous.value) {
      next.focusHandoffBaseline = next.focusHandoff ?? 0;
      next.pendingOpen = false;
    }
    if (next.open || !next.controlledOpen) next.pendingOpen = false;
    snapshot = next;
    if (sameContext(published, next)) return;
    published = next;
    run.context.update(SELECT_CONTEXT, next);
  };

  // The Root remains observable while Content's opening view is being installed.
  boundary.subscribeOutside((event) => {
    const run = currentRun;
    if (event.observation !== 'focus.move' || !run) return;
    if (!snapshot.open && !snapshot.pendingOpen) return;
    snapshot = recordSelectFocusHandoff(snapshot);
    syncContext(run);
  });

  def.context.trySubscribe(FIELD_CONTEXT, (run) => {
    if (currentRun) syncContext(run);
  });

  let collectionSnapshot = '';
  const refreshSelectedText = (run: RunHandle<SelectRootProps>) => {
    const records = collection.getItems().map((item: CollectionItemSnapshot) => ({
      value: String(item.value ?? ''),
      textValue: String(item.textValue ?? ''),
      disabled: item.disabled === true,
    }));
    const nextSnapshot = JSON.stringify(records);
    if (nextSnapshot !== collectionSnapshot) {
      // Save before notification: a synchronous subscriber may refresh again.
      collectionSnapshot = nextSnapshot;
      snapshot = { ...snapshot, collectionRevision: (snapshot.collectionRevision ?? 0) + 1 };
    }
    const selectedValue = value.get();
    const selected = records.find((item) => item.value === selectedValue);
    const nextTextValue = selected ? selected.textValue || selected.value : '';
    if (selectedValue && !nextTextValue && !snapshot.open) {
      syncContext(run);
      return;
    }
    textValue.set(nextTextValue, 'reason: select root derive selected text');
    syncContext(run);
  };

  def.anatomy.subscribeParts(SELECT_FAMILY, 'item', (run) => {
    refreshSelectedText(run);
  });

  def.context.subscribe(SELECT_CONTEXT, (run) => {
    // A prior subscriber can publish a newer owner during this notification.
    snapshot = run.context.read(SELECT_CONTEXT);
    published = snapshot;
  });

  submitOpenRequest = (run, request) => {
    if (!currentRun || snapshot.disabled) return false;
    const epoch = viewEpoch;
    const sequence = ++openRequestSequence;
    const pendingOpen = snapshot.controlledOpen && request.open && !snapshot.open;
    snapshot = {
      ...snapshot,
      pendingOpen,
      // A refused or superseded closed request cannot lend its handoff to the next one.
      focusHandoffBaseline: snapshot.open
        ? snapshot.focusHandoffBaseline
        : (snapshot.focusHandoff ?? 0),
      activeValue: request.open ? (snapshot.open ? snapshot.activeValue : snapshot.value) : '',
      requestReason: request.reason,
      requestFocusReason: request.focusReason,
      requestEntry: request.open ? (request.entry ?? 'selected-or-first') : null,
    };
    let delivered = false;
    try {
      if (!snapshot.controlledOpen) {
        open?.set(request.open, 'reason: select root accepted open request');
        if (!ownsView(epoch) || sequence !== openRequestSequence) return true;
      }
      syncContext(run);
      if (!ownsView(epoch) || sequence !== openRequestSequence) return true;
      run.expose.emit('openChange', {
        open: request.open,
        reason: request.reason,
        focusReason: request.focusReason,
      });
      delivered = true;
      return true;
    } finally {
      if (pendingOpen && !delivered && ownsView(epoch) && sequence === openRequestSequence) {
        // An internal delivery failure grants no exemption. Expose Event isolates
        // host callback throws, so those remain delivered requests. A delivery stays
        // bounded to this latest opening until acceptance or supersession.
        snapshot = {
          ...snapshot,
          pendingOpen: false,
          focusHandoffBaseline: snapshot.focusHandoff ?? 0,
        };
        syncContext(run);
      }
    }
  };

  const submitValueRequest = (
    run: RunHandle<SelectRootProps>,
    request: SelectValueRequest
  ): boolean => {
    if (!currentRun || snapshot.disabled || snapshot.readOnly) return false;
    const fieldPolicy = run.anatomy
      .partsOf(SELECT_FAMILY, 'trigger')[0]
      ?.getExpose('__selectFieldPolicy') as
      | (() => { disabled: boolean; readOnly: boolean })
      | undefined;
    const policy = typeof fieldPolicy === 'function' ? fieldPolicy() : null;
    if (policy?.disabled || policy?.readOnly) return false;
    const previousValue = value.get();
    const epoch = viewEpoch;
    const selection = ++selectionSequence;
    const isCurrent = () => ownsView(epoch) && selection === selectionSequence;
    const controlledRequest = snapshot.controlledValue;
    let frame: ControlledFrame | null = null;
    if (controlledRequest) {
      // This request owns its acceptance budget while it runs.
      frame = { pendingControlled: true };
      activeControlledFrames.push(frame);
    } else {
      cancelOutstandingAcceptances();
    }
    valueRequestDepth++;
    let delivered = false;
    let failed = false;
    try {
      snapshot = {
        ...snapshot,
        activeValue: request.value,
        requestReason: 'item.select',
        requestFocusReason: request.reason,
      };
      if (!controlledRequest) {
        value.set(request.value, 'reason: select root accepted value request');
        if (!isCurrent()) return true;
        textValue.set(
          request.textValue || resolveTextValue(run, request.value),
          'reason: select root accepted selected text'
        );
        if (!isCurrent()) return true;
      }
      syncContext(run);
      if (!isCurrent()) return true;
      run.expose.emit('valueChange', request);
      delivered = true;
      if (!controlledRequest && isCurrent() && value.get() !== previousValue) {
        notifyFieldChange(run);
      }
      return true;
    } catch (error) {
      // A thrown outward failure keeps its visibility and cancels stale flushes.
      failed = true;
      throw error;
    } finally {
      if (ownsView(epoch)) {
        valueRequestDepth--;
        if (failed) {
          // A failed request cancels every outstanding acceptance.
          cancelOutstandingAcceptances();
          queuedControlledNotifications = 0;
        } else {
          if (frame && delivered && frame.pendingControlled) {
            // A delivered proposal keeps its own budget for an owner that
            // accepts after this request returned.
            pendingControlledChanges++;
          }
          // Supersession is not a failure: an accepted nested notification still
          // flushes once the outermost request returns.
          flushControlledNotifications(run, epoch);
        }
        // Detach this request's frame. The epoch guard keeps a retired view
        // from restoring a stale parent.
        if (frame && activeControlledFrames[activeControlledFrames.length - 1] === frame)
          activeControlledFrames.pop();
      }
    }
  };

  def.expose.method('requestOpen', (request) => {
    if (!currentRun) return false;
    return submitOpenRequest(currentRun, request);
  });
  def.expose.method('requestValue', (request) => {
    if (!currentRun) return false;
    return submitValueRequest(currentRun, request);
  });
  def.expose.method('__refreshSelectedText' as any, () => {
    if (currentRun) refreshSelectedText(currentRun);
  });

  def.lifecycle.onCreated((run) => {
    currentRun = run;
    const props = run.props.get();
    const controlledValue = run.props.isProvided('value');
    value.set(
      controlledValue ? (props.value ?? '') : (props.defaultValue ?? ''),
      'reason: select root initialize value'
    );
    snapshot = {
      ...snapshot,
      rootId: createSelectRootId(),
      controlledOpen: run.props.isProvided('open'),
      controlledValue,
      disabled: !!props.disabled,
      closeOnSelect: props.closeOnSelect !== false,
    };
    syncContext(run);
  });

  def.lifecycle.onMounted((run) => {
    viewEpoch++;
    pendingControlledChanges = 0;
    queuedControlledNotifications = 0;
    valueRequestDepth = 0;
    activeControlledFrames = [];
    currentRun = run;
    refreshSelectedText(run);
  });

  const retireView = () => {
    viewEpoch++;
    openRequestSequence++;
    snapshot = {
      ...snapshot,
      pendingOpen: false,
      focusHandoffBaseline: snapshot.focusHandoff ?? 0,
    };
    pendingControlledChanges = 0;
    queuedControlledNotifications = 0;
    valueRequestDepth = 0;
    activeControlledFrames = [];
    currentRun = null;
  };
  def.lifecycle.onUnmounted(retireView);
  def.lifecycle.onBeforeDispose(retireView);

  def.props.watch(['value', 'disabled', 'readOnly', 'closeOnSelect'], (run, next) => {
    const previousValue = value.get();
    const epoch = viewEpoch;
    const controlledValue = run.props.isProvided('value');
    if (!controlledValue) {
      // Releasing control cancels the outstanding budget only; an accepted
      // notification still belongs to the current canonical value.
      cancelOutstandingAcceptances();
    }
    snapshot = {
      ...snapshot,
      controlledOpen: run.props.isProvided('open'),
      controlledValue,
      disabled: !!next.disabled,
      closeOnSelect: next.closeOnSelect !== false,
    };
    if (controlledValue) {
      value.set(next.value ?? '', 'reason: select root controlled value sync');
      textValue.set(
        resolveTextValue(run, next.value ?? ''),
        'reason: select root controlled selected text sync'
      );
    }
    if (controlledValue && ownsView(epoch) && value.get() !== previousValue) {
      // An acceptance consumes the nearest still-pending active request, or
      // the anonymous budget of an already delivered proposal.
      const frame = nearestPendingFrame();
      if (frame) {
        frame.pendingControlled = false;
        queuedControlledNotifications++;
      } else if (pendingControlledChanges > 0) {
        pendingControlledChanges--;
        queuedControlledNotifications++;
      }
    }
    syncContext(run);
    flushControlledNotifications(run, epoch);
  });

  open?.watch((run, event) => {
    if (event.type !== 'next') return;
    snapshot = {
      ...snapshot,
      controlledOpen: run.props.isProvided('open'),
      activeValue: event.next ? value.get() : '',
      requestEntry: event.next ? snapshot.requestEntry : null,
    };
    syncContext(run);
  });
}

export const asSelectRoot = defineAsHook<
  SelectRootProps,
  SelectRootExposes,
  SelectRootAsHookContract
>({
  name: 'as-select-root',
  setup: setupSelectRoot,
});

const selectRoot = definePrototype({ name: 'base-select-root', setup: setupSelectRoot });

export default selectRoot;
