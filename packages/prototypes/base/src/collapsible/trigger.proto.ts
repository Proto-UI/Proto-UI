import { defineAsHook, definePrototype, type DefHandle, type RunHandle } from '@proto.ui/core';
import { asAccessible, asFocusable, asTrigger } from '@proto.ui/hooks';
import {
  COLLAPSIBLE_CONTEXT,
  COLLAPSIBLE_FAMILY,
  rejectDuplicateCollapsiblePart,
  requestCollapsibleOpen,
} from './shared';
import type {
  CollapsibleTriggerAsHookContract,
  CollapsibleTriggerExposes,
  CollapsibleTriggerProps,
} from './types';

function setupCollapsibleTrigger(
  def: DefHandle<CollapsibleTriggerProps, CollapsibleTriggerExposes>
): void {
  // P-BASE-COLLAPSIBLE-TRIGGER-INDEPENDENCE
  def.anatomy.claim(COLLAPSIBLE_FAMILY, { role: 'trigger' });
  asTrigger();
  const accessible = asAccessible();
  const focusable = asFocusable<CollapsibleTriggerProps>();
  focusable.configure({ disabled: false });
  def.props.define({ disabled: { type: 'boolean', empty: 'fallback' } });
  def.props.setDefaults({ disabled: false });

  const expanded = def.state.bool('expanded', false);
  const disabled = def.state.bool('disabled', false);
  const hovered = def.state.bool('hovered', false);
  const pressed = def.state.bool('pressed', false);
  const focused = focusable.focused;
  const focusVisible = focusable.focusVisible;
  def.expose.state('expanded', expanded);
  def.expose.state('disabled', disabled);
  def.expose.state('hovered', hovered);
  def.expose.state('pressed', pressed);
  def.expose.state('focused', focused);
  def.expose.state('focusVisible', focusVisible);
  def.expose.method('focusSelf', (options) => {
    if (!disabled.get()) focusable.focusSelf(options);
  });

  // P-BASE-COLLAPSIBLE-TRIGGER-A11Y, P-BASE-COLLAPSIBLE-TRIGGER-RELATIONSHIP
  accessible.part(COLLAPSIBLE_FAMILY, { key: 'content' });
  accessible.role('button');
  accessible.nameFromContent();
  accessible.state('expanded', expanded);
  accessible.state('disabled', disabled);
  accessible.action('activate', { event: 'click' });
  accessible.relation('controls', {
    target: { kind: 'part', family: COLLAPSIBLE_FAMILY, role: 'content', key: 'content' },
  });

  const clearTransient = () => {
    hovered.set(false, 'reason: collapsible transient reset');
    pressed.set(false, 'reason: collapsible transient reset');
  };
  const syncContext = (run: RunHandle<CollapsibleTriggerProps>) => {
    rejectDuplicateCollapsiblePart(run, 'trigger');
    // A synchronous owner response may supersede this notification's snapshot.
    // P-BASE-COLLAPSIBLE-TRIGGER-EXPANDED, P-BASE-COLLAPSIBLE-TRIGGER-DISABLED
    expanded.set(
      run.context.read(COLLAPSIBLE_CONTEXT).open,
      'reason: collapsible canonical expansion'
    );
    // An expansion observer can publish new owner props before disabled is derived.
    const effectiveDisabled =
      run.context.read(COLLAPSIBLE_CONTEXT).disabled || !!run.props.get().disabled;
    disabled.set(effectiveDisabled, 'reason: collapsible effective disabled');
    // Disabled observers may synchronously supersede this owner input.
    focusable.setDisabled(disabled.get());
    if (disabled.get()) clearTransient();
  };
  def.context.subscribe(COLLAPSIBLE_CONTEXT, syncContext);
  def.lifecycle.onCreated(syncContext);
  def.lifecycle.onUpdated(syncContext);
  def.lifecycle.onUnmounted(clearTransient);
  def.props.watch(['disabled'], syncContext);

  // P-BASE-COLLAPSIBLE-TRIGGER-ACTIVATION: one semantic route, no raw key toggles.
  def.event.on('press.commit', (run, event) => {
    pressed.set(false, 'reason: collapsible press committed');
    if (disabled.get()) return;
    const context = run.context.read(COLLAPSIBLE_CONTEXT);
    requestCollapsibleOpen(run, !context.open, event?.key ? 'keyboard' : 'pointer');
  });
  def.event.onGlobal('key.down', (_run, event) => {
    if (disabled.get() || !focused.get() || event.key !== ' ') return;
    event.control.requestDefaultActionPrevention({
      reason: 'collapsible.space-activation',
      source: 'base-collapsible-trigger',
    });
  });
  def.event.on('pointer.enter', () => {
    if (!disabled.get()) hovered.set(true, 'reason: collapsible pointer enter');
  });
  def.event.on('pointer.down', () => {
    if (!disabled.get()) pressed.set(true, 'reason: collapsible pointer down');
  });
  def.event.on('pointer.up', () => {
    pressed.set(false, 'reason: collapsible pointer up');
  });
  def.event.on('pointer.leave', clearTransient);
  def.event.on('pointer.cancel', clearTransient);
}

export const asCollapsibleTrigger = defineAsHook<
  CollapsibleTriggerProps,
  CollapsibleTriggerExposes,
  CollapsibleTriggerAsHookContract
>({ name: 'as-collapsible-trigger', setup: setupCollapsibleTrigger });

const collapsibleTrigger = definePrototype({
  name: 'base-collapsible-trigger',
  setup: setupCollapsibleTrigger,
});

export default collapsibleTrigger;
