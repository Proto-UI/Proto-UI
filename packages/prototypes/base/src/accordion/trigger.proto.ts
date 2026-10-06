import { defineAsHook, definePrototype, type DefHandle, type RunHandle } from '@proto.ui/core';
import { asAccessible, asFocusable, asTrigger } from '@proto.ui/hooks';
import {
  ACCORDION_CONTEXT,
  ACCORDION_FAMILY,
  ACCORDION_ITEM_CONTEXT,
  ACCORDION_ITEM_FAMILY,
  requestAccordionOpen,
  readAccordionState,
  rejectAccordionDuplicatePart,
} from './shared';
import type {
  AccordionTriggerProps,
  AccordionTriggerExposes,
  AccordionTriggerAsHookContract,
} from './types';
function setupAccordionTrigger(def: DefHandle<AccordionTriggerProps, AccordionTriggerExposes>) {
  def.anatomy.claim(ACCORDION_FAMILY, { role: 'trigger' });
  def.anatomy.claim(ACCORDION_ITEM_FAMILY, { role: 'trigger' });
  asTrigger();
  const focusable = asFocusable<AccordionTriggerProps>();
  focusable.configure({ disabled: false });
  const expanded = def.state.bool('expanded', false),
    disabled = def.state.bool('disabled', false),
    collapseBlocked = def.state.bool('collapseBlocked', false),
    unavailable = def.state.bool('unavailable', false),
    hovered = def.state.bool('hovered', false),
    pressed = def.state.bool('pressed', false);
  const { focused, focusVisible } = focusable;
  def.expose.state('expanded', expanded);
  def.expose.state('disabled', disabled);
  def.expose.state('collapseBlocked', collapseBlocked);
  def.expose.state('hovered', hovered);
  def.expose.state('pressed', pressed);
  def.expose.state('focused', focused);
  def.expose.state('focusVisible', focusVisible);
  def.expose.method('focusSelf', (options) => {
    if (!disabled.get()) focusable.focusSelf(options);
  });
  const accessible = asAccessible();
  accessible.part(ACCORDION_ITEM_FAMILY, { key: 'panel' });
  accessible.role('button');
  accessible.nameFromContent();
  accessible.state('expanded', expanded);
  accessible.state('disabled', unavailable);
  accessible.action('activate', { event: 'click' });
  accessible.relation('controls', {
    target: { kind: 'part', family: ACCORDION_ITEM_FAMILY, role: 'content', key: 'panel' },
  });
  const clear = () => {
    hovered.set(false, 'reason: accordion transient reset');
    pressed.set(false, 'reason: accordion transient reset');
  };
  const sync = (run: RunHandle<AccordionTriggerProps>) => {
    rejectAccordionDuplicatePart(run, 'trigger');
    expanded.set(run.context.read(ACCORDION_ITEM_CONTEXT).open, 'reason: accordion expanded');
    disabled.set(run.context.read(ACCORDION_ITEM_CONTEXT).disabled, 'reason: accordion disabled');
    collapseBlocked.set(
      run.context.read(ACCORDION_ITEM_CONTEXT).collapseBlocked,
      'reason: accordion minimum open'
    );
    unavailable.set(disabled.get() || collapseBlocked.get(), 'reason: accordion aria disabled');
    focusable.setDisabled(disabled.get());
    if (disabled.get()) clear();
  };
  def.context.subscribe(ACCORDION_CONTEXT, () => {});
  def.context.subscribe(ACCORDION_ITEM_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  def.lifecycle.onUpdated(sync);
  def.lifecycle.onUnmounted(clear);
  def.event.on('press.commit', (run, event) => {
    pressed.set(false, 'reason: accordion press commit');
    const item = run.context.read(ACCORDION_ITEM_CONTEXT);
    if (!item.disabled)
      requestAccordionOpen(run, item.value, !item.open, event?.key ? 'keyboard' : 'pointer');
  });
  def.event.on('key.down', (run, event) => {
    if (
      disabled.get() ||
      !focused.get() ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    )
      return;
    if (event.key === ' ') {
      event.control.requestDefaultActionPrevention({
        reason: 'accordion.space-activation',
        source: 'base-accordion-trigger',
      });
      return;
    }
    const group = run.context.read(ACCORDION_CONTEXT);
    let command: 'first' | 'last' | number | undefined;
    if (event.key === 'Home') command = 'first';
    else if (event.key === 'End') command = 'last';
    else if (group.orientation === 'vertical') {
      if (event.key === 'ArrowDown') command = 1;
      else if (event.key === 'ArrowUp') command = -1;
    } else if (event.key === 'ArrowRight') command = group.direction === 'rtl' ? -1 : 1;
    else if (event.key === 'ArrowLeft') command = group.direction === 'rtl' ? 1 : -1;
    if (command === undefined) return;
    const parts = run.anatomy.order
      .partsOf(ACCORDION_FAMILY, 'trigger')
      .filter((part) => !readAccordionState<boolean>(part, 'disabled'));
    const index = parts.findIndex((part) => readAccordionState<boolean>(part, 'focused'));
    if (index < 0) return;
    let next = command === 'first' ? 0 : command === 'last' ? parts.length - 1 : index + command;
    if (group.loop) next = (next + parts.length) % parts.length;
    if (next < 0 || next >= parts.length) return;
    const focus = parts[next]?.getExpose('focusSelf');
    if (typeof focus !== 'function') return;
    event.control.requestDefaultActionPrevention({
      reason: 'accordion.header-navigation',
      source: 'base-accordion-trigger',
    });
    focus({ reason: 'keyboard' });
  });
  def.event.on('pointer.enter', () => {
    if (!disabled.get()) hovered.set(true, 'reason: accordion hover');
  });
  def.event.on('pointer.down', () => {
    if (!disabled.get()) pressed.set(true, 'reason: accordion press');
  });
  def.event.on('pointer.up', () => pressed.set(false, 'reason: accordion release'));
  def.event.on('pointer.leave', clear);
  def.event.on('pointer.cancel', clear);
}
export const asAccordionTrigger = defineAsHook<
  AccordionTriggerProps,
  AccordionTriggerExposes,
  AccordionTriggerAsHookContract
>({ name: 'as-accordion-trigger', setup: setupAccordionTrigger });
export default definePrototype({ name: 'base-accordion-trigger', setup: setupAccordionTrigger });
