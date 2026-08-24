import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { asCollectionItem, asFocusable, asTrigger } from '@proto.ui/hooks';
import { createTabsPartId, TABS_CONTEXT, TABS_FAMILY, type TabsContextValue } from './shared';
import type { TabsTriggerAsHookContract, TabsTriggerExposes, TabsTriggerProps } from './types';

function syncSelectedFromContext(
  nextValue: string,
  ownValue: string,
  selected: { set(value: boolean, reason?: string): void }
): void {
  selected.set(ownValue === nextValue, 'reason: tabs context sync => selected');
}

function syncNavParticipationFromContext(
  ctx: TabsContextValue,
  ownValue: string,
  disabled: { get(): boolean },
  focusable: {
    setNavParticipation(value: 'auto' | 'none'): void;
    setRovingStatus(status: { selected?: boolean; active?: boolean }): void;
  }
): void {
  // P-BASE-TABS-ACTIVE-VALUE, P-BASE-TABS-LIST-FOCUS-ROVING
  // P-BASE-TABS-TRIGGER-SELECTED-DERIVED
  const activeValue = ctx.activeValue || ctx.value;
  const participates = !!ownValue && ownValue === activeValue && !disabled.get();
  focusable.setNavParticipation(participates ? 'auto' : 'none');
  focusable.setRovingStatus({
    selected: !!ownValue && ownValue === ctx.value,
    active: participates,
  });
}

function readTriggerSnapshot(part: { getExpose(key: string): unknown | null }) {
  const exposed = part.getExpose('__collectionItem');
  const snapshot =
    typeof exposed === 'function'
      ? exposed()
      : exposed && typeof exposed === 'object'
        ? exposed
        : {};
  const disabledExpose = part.getExpose('disabled');
  const disabled =
    disabledExpose &&
    typeof disabledExpose === 'object' &&
    typeof (disabledExpose as { get?: unknown }).get === 'function'
      ? (disabledExpose as { get(): unknown }).get()
      : undefined;
  return {
    ...((snapshot && typeof snapshot === 'object' ? snapshot : {}) as Record<string, unknown>),
    ...(typeof disabled === 'undefined' ? {} : { disabled }),
  };
}

function resolveEnabledTriggerValue(run: any, candidate: string): string {
  const values = run.anatomy.order
    .partsOf(TABS_FAMILY, 'trigger')
    .map(readTriggerSnapshot)
    .filter(
      (snapshot: Record<string, unknown>) => typeof snapshot.value === 'string' && snapshot.value
    )
    .filter((snapshot: Record<string, unknown>) => snapshot.disabled !== true)
    .map((snapshot: Record<string, unknown>) => snapshot.value as string);
  if (candidate && values.includes(candidate)) return candidate;
  return values[0] ?? candidate ?? '';
}

function setupTabsTrigger(def: DefHandle<TabsTriggerProps, TabsTriggerExposes>): void {
  // P-BASE-TABS-TRIGGER-ROLE-TAB, P-BASE-TABS-TRIGGER-PROTOCOL-DEPENDENCY
  // P-BASE-TABS-TRIGGER-NO-BUTTON-DEPENDENCY
  // P-BASE-TABS-TRIGGER-ACTIVATION-REQUESTS-SELECTION
  // P-BASE-TABS-TRIGGER-KEYBOARD-ACTIVATION
  asTrigger();
  // P-BASE-TABS-TRIGGER-FOCUSABLE
  const focusable = asFocusable<TabsTriggerProps>();
  focusable.configure({ disabled: false });
  const focused = focusable.focused;
  const focusVisible = focusable.focusVisible;
  // P-BASE-TABS-TRIGGER-SELECTED-DERIVED, P-BASE-TABS-TRIGGER-SELECTED-EXPOSE
  const selected = def.state.bool('selected', false);
  // P-BASE-TABS-TRIGGER-DISABLED-EXPOSE, P-BASE-TABS-TRIGGER-INTERACTION-STATES
  const disabled = def.state.bool('disabled', false);
  const hovered = def.state.bool('hovered', false);
  const pressed = def.state.bool('pressed', false);
  const triggerId = def.state.string('triggerId', '');
  const contentId = def.state.string('contentId', '');

  // P-BASE-TABS-TRIGGER-CLAIM-ROLE, P-BASE-TABS-TRIGGER-SAME-DOMAIN
  // P-BASE-TABS-TRIGGER-COLLECTION-ITEM
  const collectionItem = asCollectionItem();
  collectionItem.configure({
    family: TABS_FAMILY,
    role: 'trigger',
    getMeta: (run) => {
      const props = run.props.get();
      return {
        value: props.value ?? '',
        disabled: !!props.disabled,
      };
    },
  });

  // P-BASE-TABS-TRIGGER-PROP-VALUE, P-BASE-TABS-TRIGGER-PROP-DISABLED
  def.props.define({
    value: { type: 'string', empty: 'fallback' },
    disabled: { type: 'boolean', empty: 'fallback' },
  });
  def.props.setDefaults({
    value: '',
    disabled: false,
  });

  let ownValue = '';
  let rootId = '';

  // P-BASE-TABS-TRIGGER-INTERACTION-STATES, P-BASE-TABS-TRIGGER-CLICK-SIGNAL
  def.expose.state('disabled', disabled);
  def.expose.state('hovered', hovered);
  def.expose.state('focused', focused);
  def.expose.state('focusVisible', focusVisible);
  def.expose.state('pressed', pressed);
  def.expose.state('selected', selected);
  def.expose.method('focusSelf', (options) => {
    if (disabled.get()) return;
    focusable.focusSelf(options);
  });
  def.expose.event('click', { payload: 'void' });

  // P-BASE-TABS-TRIGGER-A11Y-ROLE, P-BASE-TABS-TRIGGER-A11Y-SELECTED
  // P-BASE-TABS-TRIGGER-A11Y-DISABLED, P-BASE-TABS-TRIGGER-A11Y-CONTROLS-TARGET
  // P-BASE-TABS-TRIGGER-ACCESSIBLE-NAME
  def.a11y.id(triggerId);
  def.a11y.role('tab');
  def.a11y.nameFromContent();
  def.a11y.state('selected', selected);
  def.a11y.state('disabled', disabled);
  def.a11y.relation('controls', { target: contentId });
  def.a11y.action('activate', { event: 'click' });

  const syncIds = () => {
    // P-BASE-TABS-A11Y-RELATIONSHIP-TARGET
    triggerId.set(createTabsPartId(rootId, 'trigger', ownValue), 'reason: tabs trigger id sync');
    contentId.set(
      createTabsPartId(rootId, 'content', ownValue),
      'reason: tabs trigger relation sync'
    );
  };

  const syncDisabled = (nextDisabled: boolean) => {
    // P-BASE-TABS-TRIGGER-DISABLED-SUPPRESS-ACTIVATION
    disabled.set(nextDisabled, 'reason: tabs trigger sync disabled');
    focusable.setDisabled(nextDisabled);
    if (nextDisabled) {
      hovered.set(false, 'reason: tabs trigger disabled => hovered');
      pressed.set(false, 'reason: tabs trigger disabled => pressed');
    }
  };

  const requestSelection = (run: any, ctx: TabsContextValue) => {
    // P-BASE-TABS-TRIGGER-ACTIVATION-REQUESTS-SELECTION
    const nextValue = run.props.get().value ?? '';
    run.context.update(TABS_CONTEXT, {
      ...ctx,
      activeValue: nextValue,
    });
    if (ctx.value === nextValue) return false;
    run.context.update(TABS_CONTEXT, {
      ...ctx,
      value: ctx.controlled ? ctx.value : nextValue,
      activeValue: nextValue,
      requestedValue: nextValue,
      requestVersion: ctx.requestVersion + 1,
    });
    return true;
  };

  def.context.subscribe(TABS_CONTEXT, (_run, next) => {
    // P-BASE-TABS-TRIGGER-CONTEXT-CONSUME, P-BASE-TABS-TRIGGER-SELECTED-DERIVED
    rootId = next.rootId;
    syncIds();
    syncSelectedFromContext(next.value, ownValue, selected);
    syncNavParticipationFromContext(next, ownValue, disabled, focusable);
  });

  def.lifecycle.onCreated((run) => {
    syncDisabled(!!run.props.get().disabled);
  });

  def.lifecycle.onMounted((run) => {
    ownValue = run.props.get().value ?? '';
    const ctx = run.context.read(TABS_CONTEXT);
    rootId = ctx.rootId;
    syncIds();
    syncSelectedFromContext(ctx.value, ownValue, selected);
    syncNavParticipationFromContext(ctx, ownValue, disabled, focusable);
    notifyRootToValidateSelection(run);
  });

  def.props.watch(['value'], (run, next) => {
    ownValue = next.value ?? '';
    const ctx = run.context.read(TABS_CONTEXT);
    rootId = ctx.rootId;
    syncIds();
    syncSelectedFromContext(ctx.value, ownValue, selected);
    syncNavParticipationFromContext(ctx, ownValue, disabled, focusable);
    notifyRootToValidateSelection(run);
  });

  def.props.watch(['disabled'], (run, next) => {
    syncDisabled(!!next.disabled);
    syncNavParticipationFromContext(run.context.read(TABS_CONTEXT), ownValue, disabled, focusable);
    notifyRootToValidateSelection(run);
  });

  const updateActiveValue = (run: any) => {
    // P-BASE-TABS-ACTIVE-VALUE
    const nextValue = run.props.get().value ?? '';
    run.context.update(TABS_CONTEXT, (prev: any) => {
      if (prev.activeValue === nextValue) return prev;
      return { ...prev, activeValue: nextValue };
    });
  };

  const notifyRootToValidateSelection = (run: any) => {
    // P-BASE-TABS-SELECTION-FALLBACK
    run.context.update(TABS_CONTEXT, (prev: TabsContextValue) => ({
      ...prev,
      value: prev.controlled ? prev.value : resolveEnabledTriggerValue(run, prev.value ?? ''),
      activeValue: resolveEnabledTriggerValue(run, prev.activeValue || prev.value || ''),
      validationVersion: (prev.validationVersion ?? 0) + 1,
    }));
  };

  def.event.on('press.commit', (run) => {
    // P-BASE-TABS-TRIGGER-DISABLED-SUPPRESS-ACTIVATION
    // P-BASE-TABS-TRIGGER-ACTIVATION-REQUESTS-SELECTION, P-BASE-TABS-TRIGGER-CLICK-SIGNAL
    pressed.set(false, 'reason: tabs trigger press.commit => pressed');
    if (disabled.get()) return;
    const ctx = run.context.read(TABS_CONTEXT);
    run.expose.emit('click');
    requestSelection(run, ctx);
  });

  focused.watch((run, event) => {
    // P-BASE-TABS-TRIGGER-AUTOMATIC-FOCUS-SELECTION
    // P-BASE-TABS-TRIGGER-MANUAL-FOCUS-STABLE
    if (event.type !== 'next' || !event.next) return;
    if (disabled.get()) return;
    const nextValue = run.props.get().value ?? '';
    const ctx = run.context.read(TABS_CONTEXT);
    updateActiveValue(run);
    if (ctx.activationMode !== 'automatic') return;
    if (ctx.value === nextValue) return;
    requestSelection(run, ctx);
  });

  def.event.onGlobal('key.down', (_run, ev) => {
    // P-BASE-TABS-TRIGGER-KEYBOARD-ACTIVATION
    const detail = ev;
    if (disabled.get()) return;
    if (!focused.get()) return;
    if (detail?.key !== ' ') return;
    ev.control.requestDefaultActionPrevention({
      reason: 'tabs.space-activation',
      source: 'base-tabs-trigger',
    });
  });

  def.event.on('pointer.enter', () => {
    // P-BASE-TABS-TRIGGER-INTERACTION-STATES
    if (disabled.get()) return;
    hovered.set(true, 'reason: tabs trigger pointer.enter => hovered');
  });
  def.event.on('pointer.leave', () => {
    hovered.set(false, 'reason: tabs trigger pointer.leave => hovered');
    pressed.set(false, 'reason: tabs trigger pointer.leave => pressed');
  });
  def.event.on('pointer.cancel', () => {
    hovered.set(false, 'reason: tabs trigger pointer.cancel => hovered');
    pressed.set(false, 'reason: tabs trigger pointer.cancel => pressed');
  });
  def.event.on('pointer.down', () => {
    if (disabled.get()) return;
    pressed.set(true, 'reason: tabs trigger pointer.down => pressed');
  });
  def.event.on('pointer.up', () => {
    pressed.set(false, 'reason: tabs trigger pointer.up => pressed');
  });
}

/*
 * P-BASE-TABS-TRIGGER criteria represented by absence or delegated ownership:
 * - P-BASE-TABS-TRIGGER-NO-ACTIVE-EXPOSE-FIRST-PASS: no active expose is declared.
 * - P-BASE-TABS-TRIGGER-NO-BUTTON-DEPENDENCY: command semantics use core asTrigger/asFocusable.
 */

// P-BASE-TABS-TRIGGER-AUTHORING-ENTRIES
export const asTabsTrigger = defineAsHook<
  TabsTriggerProps,
  TabsTriggerExposes,
  TabsTriggerAsHookContract
>({
  name: 'as-tabs-trigger',
  setup: setupTabsTrigger,
});

const tabsTrigger = definePrototype({
  name: 'base-tabs-trigger',
  setup: setupTabsTrigger,
});

export default tabsTrigger;
