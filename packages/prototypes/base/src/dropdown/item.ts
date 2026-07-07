import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { asCollectionItem, asFocusable } from '@proto.ui/hooks';
import { asButton } from '../button';
import { DROPDOWN_CONTEXT, DROPDOWN_FAMILY } from './shared';
import type { DropdownItemAsHookContract, DropdownItemExposes, DropdownItemProps } from './types';

const DROPDOWN_ROVING_HANDLED = '__dropdownRovingHandled';

function setupDropdownItem(def: DefHandle<DropdownItemProps, DropdownItemExposes>): void {
  const button = asButton();
  const buttonState = button.stateHandles;
  if (!buttonState) {
    throw new Error('[base-dropdown-item] asButton must project Button state handles.');
  }
  const focusable = asFocusable<DropdownItemProps>();
  const hovered = buttonState.hovered;
  const focused = focusable.focused;
  const active = def.state.bool('active', false);
  const collectionItem = asCollectionItem();
  collectionItem.configure({
    family: DROPDOWN_FAMILY,
    getMeta: (run) => {
      const props = run.props.get();
      return {
        value: props.value ?? '',
        textValue: props.textValue ?? '',
        disabled: !!props.disabled,
      };
    },
  });

  def.props.define({
    disabled: { type: 'boolean', empty: 'fallback' },
    value: { type: 'string', empty: 'fallback' },
    textValue: { type: 'string', empty: 'fallback' },
    closeOnCommit: { type: 'boolean', empty: 'fallback' },
  });
  def.props.setDefaults({
    disabled: false,
    value: '',
    textValue: '',
  });

  const syncActive = (ctx: { activeValue?: string }, ownValue: string) => {
    active.set(!!ownValue && ownValue === (ctx.activeValue ?? ''), 'reason: dropdown active sync');
  };

  def.expose.state('active', active);
  def.context.subscribe(DROPDOWN_CONTEXT, (run, next) => {
    syncActive(next, run.props.get().value ?? '');
  });

  def.lifecycle.onMounted((run) => {
    syncActive(run.context.read(DROPDOWN_CONTEXT), run.props.get().value ?? '');
  });
  def.props.watch(['value'], (run, next) => {
    syncActive(run.context.read(DROPDOWN_CONTEXT), next.value ?? '');
  });

  const updateActiveValue = (run: any) => {
    const ownValue = run.props.get().value ?? '';
    if (!ownValue) return;
    run.context.update(DROPDOWN_CONTEXT, (prev: any) => {
      if (prev.activeValue === ownValue) return prev;
      return { ...prev, activeValue: ownValue };
    });
  };

  def.event.on('press.commit', (run) => {
    const ownDisabled = !!run.props.get().disabled;
    const ctx = run.context.read(DROPDOWN_CONTEXT);
    if (ownDisabled || ctx.disabled) return;
    updateActiveValue(run);
    if (ctx.controlled) return;
    const closeOnCommit = run.props.isProvided('closeOnCommit')
      ? !!run.props.get().closeOnCommit
      : !!ctx.closeOnItemCommit;
    if (!closeOnCommit) return;
    run.context.update(DROPDOWN_CONTEXT, (prev: any) => ({
      ...prev,
      open: false,
      activeValue: '',
    }));
  });

  focused.watch((run, event) => {
    if (event.type !== 'next' || !event.next) return;
    const ownDisabled = !!run.props.get().disabled;
    const ctx = run.context.read(DROPDOWN_CONTEXT);
    if (ownDisabled || ctx.disabled) return;
    updateActiveValue(run);
  });
  hovered.watch((run, event) => {
    if (event.type !== 'next' || !event.next) return;
    const ownDisabled = !!run.props.get().disabled;
    const ctx = run.context.read(DROPDOWN_CONTEXT);
    if (ownDisabled || ctx.disabled || !ctx.open) return;
    updateActiveValue(run);
  });

  def.event.onGlobal('key.down', (run, ev) => {
    const ownDisabled = !!run.props.get().disabled;
    const ctx = run.context.read(DROPDOWN_CONTEXT);
    if (ownDisabled || ctx.disabled) return;
    if (!focusable.isFocused()) return;
    // Keep one roving move per keyboard event without depending on propagation phase semantics.
    if ((ev?.detail as any)?.[DROPDOWN_ROVING_HANDLED]) return;

    const key = ev?.detail?.key;
    const content = run.anatomy.partsOf(DROPDOWN_FAMILY, 'content')[0] ?? null;
    const focusFirst = content?.getExpose('focusFirst') as (() => void) | null;
    const focusLast = content?.getExpose('focusLast') as (() => void) | null;
    const focusNext = content?.getExpose('focusNext') as (() => void) | null;
    const focusPrev = content?.getExpose('focusPrev') as (() => void) | null;

    if (key === 'Home') {
      if (ev?.detail) (ev.detail as any)[DROPDOWN_ROVING_HANDLED] = true;
      ev?.detail?.preventDefault?.();
      focusFirst?.();
      return;
    }
    if (key === 'End') {
      if (ev?.detail) (ev.detail as any)[DROPDOWN_ROVING_HANDLED] = true;
      ev?.detail?.preventDefault?.();
      focusLast?.();
      return;
    }
    if (key === 'ArrowDown') {
      if (ev?.detail) (ev.detail as any)[DROPDOWN_ROVING_HANDLED] = true;
      ev?.detail?.preventDefault?.();
      focusNext?.();
      return;
    }
    if (key === 'ArrowUp') {
      if (ev?.detail) (ev.detail as any)[DROPDOWN_ROVING_HANDLED] = true;
      ev?.detail?.preventDefault?.();
      focusPrev?.();
    }
  });
}

export const asDropdownItem = defineAsHook<
  DropdownItemProps,
  DropdownItemExposes,
  DropdownItemAsHookContract
>({
  name: 'as-dropdown-item',
  setup: setupDropdownItem,
});

const dropdownItem = definePrototype({
  name: 'base-dropdown-item',
  setup: setupDropdownItem,
});

export default dropdownItem;
