import { asAccessible } from '@proto.ui/hooks';
import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { setupDropdownCommand } from './command';
import {
  createDropdownContentId,
  DROPDOWN_CONTEXT,
  DROPDOWN_FAMILY,
  requestDropdownOpen,
  type DropdownContextValue,
} from './shared';
import type {
  DropdownTriggerAsHookContract,
  DropdownTriggerExposes,
  DropdownTriggerProps,
} from './types';

function setupDropdownTrigger(def: DefHandle<DropdownTriggerProps, DropdownTriggerExposes>): void {
  const accessible = asAccessible();
  // P-BASE-DROPDOWN-MENU-TRIGGER-COMMAND
  def.anatomy.claim(DROPDOWN_FAMILY, { role: 'trigger' });
  const command = setupDropdownCommand(def, 'dropdown trigger');

  const expanded = def.state.bool('dropdownExpanded', false);
  const hasPopup = def.state.string('dropdownHasPopup', 'menu');
  const controls = def.state.string('dropdownContentId', '');
  // P-BASE-DROPDOWN-MENU-TRIGGER-A11Y
  accessible.role('button');
  accessible.nameFromContent();
  accessible.state('disabled', command.disabled);
  accessible.state('expanded', expanded);
  accessible.state('hasPopup', hasPopup);
  accessible.relation('controls', { target: controls });
  accessible.action('activate', { event: 'click' });

  const sync = (run: any, ctx: DropdownContextValue) => {
    command.syncDisabled(!!run.props.get().disabled || ctx.disabled);
    expanded.set(ctx.open, 'reason: dropdown trigger expanded sync');
    controls.set(createDropdownContentId(ctx.rootId), 'reason: dropdown trigger controls sync');
  };
  def.context.subscribe(DROPDOWN_CONTEXT, (run, next) => sync(run, next));
  def.lifecycle.onCreated((run) => sync(run, run.context.read(DROPDOWN_CONTEXT)));
  def.props.watch(['disabled'], (run) => sync(run, run.context.read(DROPDOWN_CONTEXT)));

  command.focused.watch((run, event) => {
    if (event.type !== 'next' || !event.next) return;
    const ctx = run.context.read(DROPDOWN_CONTEXT);
    if (!ctx.open || !ctx.activeValue) return;
    run.context.update(DROPDOWN_CONTEXT, (prev) => ({ ...prev, activeValue: '' }));
  });

  def.event.on('press.commit', (run, ev) => {
    // P-BASE-DROPDOWN-MENU-TRIGGER-REQUEST, P-BASE-DROPDOWN-MENU-TRIGGER-DISABLED
    if (command.disabled.get()) return;
    const ctx = run.context.read(DROPDOWN_CONTEXT);
    const key = ev?.key;
    const focusReason = key ? 'keyboard' : 'pointer';
    if (key === 'Enter' || key === ' ') {
      requestDropdownOpen(run, true, 'trigger.press', 'keyboard', 'first');
      return;
    }
    requestDropdownOpen(run, !ctx.open, 'trigger.press', focusReason);
  });

  def.event.on('key.down', (run, ev) => {
    if (command.disabled.get()) return;
    const key = ev?.key;
    if (key !== 'ArrowDown' && key !== 'ArrowUp') return;
    ev.control.requestDefaultActionPrevention({
      reason: 'dropdown.arrow-open',
      source: 'base-dropdown-trigger',
    });

    const ctx = run.context.read(DROPDOWN_CONTEXT);
    const entry = key === 'ArrowUp' ? 'last' : 'first';
    if (!ctx.open) {
      requestDropdownOpen(run, true, `trigger.${key}`, 'keyboard', entry);
      return;
    }
    if (ctx.activeValue) return;
    const content = run.anatomy.partsOf(DROPDOWN_FAMILY, 'content')[0] ?? null;
    const focusBoundary = content?.getExpose(entry === 'first' ? 'focusFirst' : 'focusLast') as
      | (() => void)
      | null;
    focusBoundary?.();
  });
}

// P-BASE-DROPDOWN-MENU-TRIGGER-AUTHORING-ENTRIES
export const asDropdownTrigger = defineAsHook<
  DropdownTriggerProps,
  DropdownTriggerExposes,
  DropdownTriggerAsHookContract
>({
  name: 'as-dropdown-trigger',
  setup: setupDropdownTrigger,
});

const dropdownTrigger = definePrototype({
  name: 'base-dropdown-trigger',
  setup: setupDropdownTrigger,
});

export default dropdownTrigger;
