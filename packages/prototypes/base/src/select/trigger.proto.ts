import { asOptionalFieldControl } from '../field/control-binding.proto';
import { FIELD_LABEL_PAIR } from '../field/shared';
import { asAccessible, asControlLabel } from '@proto.ui/hooks';
import { defineAsHook, definePrototype, delay, type DefHandle } from '@proto.ui/core';
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

export function setupSelectTrigger(
  def: DefHandle<SelectTriggerProps, SelectTriggerExposes>,
  options: Readonly<{ fieldBinding?: boolean }> = {}
): void {
  const binding = options.fieldBinding ? asOptionalFieldControl() : null;
  const accessible = asAccessible();
  def.props.define({ accessibleLabel: { type: 'string', empty: 'fallback' } });
  def.props.setDefaults({ accessibleLabel: '' });
  const accessibleLabel = def.state.string('selectAccessibleLabel', '');
  def.anatomy.claim(SELECT_FAMILY, { role: 'trigger' });
  const command = setupSelectCommand(def, 'select trigger');
  const expanded = def.state.bool('selectExpanded', false);
  const hasPopup = def.state.string('selectHasPopup', 'listbox');
  const controls = def.state.string('selectContentId', '');
  const placeholder = def.state.bool('placeholder', true);
  def.expose.state('placeholder', placeholder);

  accessible.role('combobox');
  // Combobox names come from the author, not from its current selected content.
  // A resolved Field labelledBy relation remains authoritative over this label.
  accessible.name(accessibleLabel);
  accessible.state('disabled', command.disabled);
  accessible.state('expanded', expanded);
  accessible.state('hasPopup', hasPopup);
  accessible.relation('controls', { target: controls });
  accessible.action('activate', { event: 'click' });

  let currentRun: any = null;
  let viewEpoch = 0;
  const reportTasks = new Set<{ cancel(): void }>();
  const report = (reason: 'sync' | 'change' | 'blur' = 'sync') => {
    if (!binding || !currentRun) return;
    binding.report({
      value: currentRun.context.read(SELECT_CONTEXT).value,
      focused: command.focused.get(),
      composing: false,
      reason,
    });
  };
  if (binding) {
    asControlLabel().target((_, request) => {
      if (!command.disabled.get() && request.isCurrent())
        command.focusSelf({ reason: request.source === 'pointer' ? 'pointer' : 'programmatic' });
    }, FIELD_LABEL_PAIR);
    def.expose.method('__selectFieldPolicy' as any, () => ({
      disabled: binding.state.fieldDisabled.get(),
      readOnly: binding.state.fieldReadOnly.get(),
    }));
    def.expose.method('__fieldSelectChange' as any, () => {
      const epoch = viewEpoch;
      const task = delay(0, () => {
        reportTasks.delete(task);
        if (currentRun && epoch === viewEpoch) report('change');
      });
      reportTasks.add(task);
    });
    binding.state.fieldDisabled.watch(() => {
      if (currentRun) command.syncDisabled(binding.state.fieldDisabled.get());
    });
    command.focused.watch((_, event) => {
      if (event.type === 'next') report(event.next ? 'sync' : 'blur');
    });
  }
  const sync = (run: any, ctx: SelectContextValue) => {
    currentRun = run;
    accessibleLabel.set(run.props.get().accessibleLabel ?? '', 'reason: select author label');
    const epoch = viewEpoch;
    const current = () => currentRun === run && viewEpoch === epoch;
    binding?.setPolicy({ disabled: !!ctx.controlDisabled, readOnly: !!ctx.controlReadOnly });
    if (!current()) return;
    command.syncDisabled(
      binding ? binding.state.fieldDisabled.get() : !!run.props.get().disabled || ctx.disabled
    );
    if (!current()) return;
    expanded.set(ctx.open, 'reason: select trigger expanded sync');
    if (!current()) return;
    placeholder.set(!ctx.value, 'reason: select trigger placeholder sync');
    if (!current()) return;
    controls.set(createSelectContentId(ctx.rootId), 'reason: select trigger controls sync');
    if (current()) report();
  };
  def.context.subscribe(SELECT_CONTEXT, (run, next) => sync(run, next));
  def.lifecycle.onCreated((run) => sync(run, run.context.read(SELECT_CONTEXT)));
  def.lifecycle.onUnmounted(() => {
    viewEpoch++;
    for (const task of reportTasks) task.cancel();
    reportTasks.clear();
    currentRun = null;
  });
  def.lifecycle.onBeforeDispose(() => {
    viewEpoch++;
    for (const task of reportTasks) task.cancel();
    reportTasks.clear();
    currentRun = null;
  });
  def.lifecycle.onMounted((run) => sync(run, run.context.read(SELECT_CONTEXT)));
  def.props.watch(['disabled', 'accessibleLabel'], (run) =>
    sync(run, run.context.read(SELECT_CONTEXT))
  );

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
    if (key === 'Tab') {
      if (run.context.read(SELECT_CONTEXT).open && command.focused.get()) {
        requestSelectOpen(run, { open: false, reason: 'tab', focusReason: 'keyboard' });
      }
      return;
    }
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
