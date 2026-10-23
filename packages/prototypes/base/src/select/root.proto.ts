import { FIELD_CONTEXT } from '../field/shared';
import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { asCollection } from '@proto.ui/hooks';
import { useOpenState } from '../tools';
import {
  createSelectRootId,
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

function setupSelectRoot(def: DefHandle<SelectRootProps, SelectRootExposes>): void {
  def.anatomy.claim(SELECT_FAMILY, { role: 'root' });
  // A nested Select must not lend its orphan Label to an outer Group.
  def.anatomy.claim(SELECT_GROUP_FAMILY, { role: 'root' });
  const collection = asCollection();
  collection.configure({ family: SELECT_FAMILY });

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

  let submitOpenRequest = (_run: any, _request: SelectOpenRequest): boolean => false;
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
  let currentRun: any = null;
  // A state/Context notification may retire and remount this same instance.
  // Run-handle identity alone cannot distinguish the old continuation.
  let viewEpoch = 0;
  let selectionSequence = 0;
  const ownsView = (epoch: number) => currentRun !== null && epoch === viewEpoch;

  const resolveTextValue = (run: any, nextValue: string): string => {
    if (!nextValue) return '';
    const itemSnapshot = collection
      .getItems()
      .find((item: Record<string, unknown>) => item.value === nextValue);
    return itemSnapshot ? String(itemSnapshot.textValue || itemSnapshot.value || '') : '';
  };

  const syncContext = (run: any) => {
    const next = {
      ...snapshot,
      controlDisabled: !!run.props.get().disabled,
      controlReadOnly: !!run.props.get().readOnly,
      disabled: !!run.props.get().disabled || !!run.context.tryRead(FIELD_CONTEXT)?.disabled,
      readOnly: !!run.props.get().readOnly || !!run.context.tryRead(FIELD_CONTEXT)?.readOnly,
      open: open?.get() ?? false,
      value: value.get(),
      textValue: textValue.get(),
    };
    snapshot = next;
    if (sameContext(published, next)) return;
    published = next;
    run.context.update(SELECT_CONTEXT, next);
  };

  def.context.trySubscribe(FIELD_CONTEXT, (run) => {
    if (currentRun) syncContext(run);
  });

  let collectionSnapshot = '';
  const refreshSelectedText = (run: any) => {
    const records = collection.getItems().map((item: Record<string, unknown>) => ({
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

  def.context.subscribe(SELECT_CONTEXT, (_run, next) => {
    snapshot = next;
    published = next;
  });

  submitOpenRequest = (run, request) => {
    if (!currentRun || snapshot.disabled) return false;
    const epoch = viewEpoch;
    snapshot = {
      ...snapshot,
      activeValue: request.open ? snapshot.value : '',
      requestReason: request.reason,
      requestFocusReason: request.focusReason,
      requestEntry: request.open ? (request.entry ?? 'selected-or-first') : null,
    };
    if (!snapshot.controlledOpen) {
      open?.set(request.open, 'reason: select root accepted open request');
      if (!ownsView(epoch)) return true;
    }
    syncContext(run);
    if (!ownsView(epoch)) return true;
    run.expose.emit('openChange', {
      open: request.open,
      reason: request.reason,
      focusReason: request.focusReason,
    });
    return true;
  };

  const submitValueRequest = (run: any, request: SelectValueRequest): boolean => {
    if (!currentRun || snapshot.disabled || snapshot.readOnly) return false;
    const fieldPolicy = run.anatomy
      .partsOf(SELECT_FAMILY, 'trigger')[0]
      ?.getExpose('__selectFieldPolicy');
    const policy = typeof fieldPolicy === 'function' ? fieldPolicy() : null;
    if (policy?.disabled || policy?.readOnly) return false;
    const previousValue = value.get();
    const epoch = viewEpoch;
    const selection = ++selectionSequence;
    const isCurrent = () => ownsView(epoch) && selection === selectionSequence;
    snapshot = {
      ...snapshot,
      activeValue: request.value,
      requestReason: 'item.select',
      requestFocusReason: request.reason,
    };
    if (!snapshot.controlledValue) {
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
    if (isCurrent() && value.get() !== previousValue) {
      const notify = run.anatomy
        .partsOf(SELECT_FAMILY, 'trigger')[0]
        ?.getExpose('__fieldSelectChange');
      if (typeof notify === 'function') notify();
    }
    return true;
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
    currentRun = run;
    refreshSelectedText(run);
  });

  const retireView = () => {
    viewEpoch++;
    currentRun = null;
  };
  def.lifecycle.onUnmounted(retireView);
  def.lifecycle.onBeforeDispose(retireView);

  def.props.watch(['value', 'disabled', 'readOnly', 'closeOnSelect'], (run, next) => {
    const controlledValue = run.props.isProvided('value');
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
    syncContext(run);
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
