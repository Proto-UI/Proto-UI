import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { setupSelectCommand } from './command';
import {
  createSelectContentId,
  requestSelectOpen,
  SELECT_CONTEXT,
  SELECT_FAMILY,
  type SelectContextValue,
} from './shared';
import type {
  SelectTriggerAsHookContract,
  SelectTriggerExposes,
  SelectTriggerProps,
} from './types';

function setupSelectTrigger(def: DefHandle<SelectTriggerProps, SelectTriggerExposes>): void {
  def.anatomy.claim(SELECT_FAMILY, { role: 'trigger' });
  const command = setupSelectCommand(def, 'select trigger');
  const expanded = def.state.bool('selectExpanded', false);
  const hasPopup = def.state.string('selectHasPopup', 'listbox');
  const controls = def.state.string('selectContentId', '');
  const placeholder = def.state.bool('placeholder', true);
  def.expose.state('placeholder', placeholder);

  def.a11y.role('combobox');
  def.a11y.nameFromContent();
  def.a11y.state('disabled', command.disabled);
  def.a11y.state('expanded', expanded);
  def.a11y.state('hasPopup', hasPopup);
  def.a11y.relation('controls', { target: controls });
  def.a11y.action('activate', { event: 'click' });

  const sync = (run: any, ctx: SelectContextValue) => {
    command.syncDisabled(!!run.props.get().disabled || ctx.disabled);
    expanded.set(ctx.open, 'reason: select trigger expanded sync');
    placeholder.set(!ctx.value, 'reason: select trigger placeholder sync');
    controls.set(createSelectContentId(ctx.rootId), 'reason: select trigger controls sync');
  };
  def.context.subscribe(SELECT_CONTEXT, (run, next) => sync(run, next));
  def.lifecycle.onCreated((run) => sync(run, run.context.read(SELECT_CONTEXT)));
  def.props.watch(['disabled'], (run) => sync(run, run.context.read(SELECT_CONTEXT)));

  def.event.on('press.commit', (run, ev) => {
    if (command.disabled.get()) return;
    const ctx = run.context.read(SELECT_CONTEXT);
    const key = ev?.key;
    if (key === 'Enter' || key === ' ') {
      requestSelectOpen(run, {
        open: true,
        reason: 'trigger.press',
        focusReason: 'keyboard',
        entry: 'selected-or-first',
      });
      return;
    }
    requestSelectOpen(run, {
      open: !ctx.open,
      reason: 'trigger.press',
      focusReason: 'pointer',
      entry: 'selected-or-first',
    });
  });

  def.event.on('key.down', (run, ev) => {
    if (command.disabled.get()) return;
    const key = ev?.key;
    if (key !== 'ArrowDown' && key !== 'ArrowUp') return;
    ev.control.requestDefaultActionPrevention({
      reason: 'select.arrow-open',
      source: 'base-select-trigger',
    });
    const ctx = run.context.read(SELECT_CONTEXT);
    if (ctx.open) return;
    requestSelectOpen(run, {
      open: true,
      reason: `trigger.${key}`,
      focusReason: 'keyboard',
      entry: key === 'ArrowUp' ? 'selected-or-last' : 'selected-or-first',
    });
  });
}

export const asSelectTrigger = defineAsHook<
  SelectTriggerProps,
  SelectTriggerExposes,
  SelectTriggerAsHookContract
>({
  name: 'as-select-trigger',
  setup: setupSelectTrigger,
});

const selectTrigger = definePrototype({ name: 'base-select-trigger', setup: setupSelectTrigger });

export default selectTrigger;
