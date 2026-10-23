import {
  defineAsHook,
  definePrototype,
  delay,
  type DefHandle,
  type RunHandle,
} from '@proto.ui/core';
import { asAccessible, asFocusable, asTrigger, asControlLabel, asAxisInput } from '@proto.ui/hooks';
import { SWITCH_CONTEXT, SWITCH_FAMILY } from './shared';
import { asOptionalFieldControl } from '../field/control-binding.proto';
import { FIELD_LABEL_PAIR } from '../field/shared';
import type { SwitchRootAsHookContract, SwitchRootExposes, SwitchRootProps } from './types';

export type SwitchRootSetupOptions = Readonly<{ fieldBinding?: boolean }>;
/** Definition-time semantic composition; ordinary Switch remains independent of Field. */
export function setupSwitchRoot(
  def: DefHandle<SwitchRootProps, SwitchRootExposes>,
  options: SwitchRootSetupOptions = {}
): void {
  const binding = options.fieldBinding ? asOptionalFieldControl() : null;
  const accessible = asAccessible();
  // P-BASE-SWITCH-ROLE-ON-OFF-VALUE, P-BASE-SWITCH-DISPLAY-AND-INPUT
  // P-BASE-SWITCH-ROOT-SEMANTIC-OWNER, P-BASE-SWITCH-ROOT-DOMAIN-ANCHOR
  def.anatomy.claim(SWITCH_FAMILY, { role: 'root' });

  // P-BASE-SWITCH-PROTOCOL-INDEPENDENCE, P-BASE-SWITCH-TRIGGER-SEMANTICS
  asTrigger();

  // P-BASE-SWITCH-PROP-CHECKED, P-BASE-SWITCH-PROP-DEFAULT-CHECKED
  // P-BASE-SWITCH-PROP-DISABLED, P-BASE-SWITCH-NO-MIXED-STATE
  // P-BASE-SWITCH-PROP-NO-EVENT-CALLBACK
  def.props.define({
    checked: { type: 'boolean', empty: 'fallback' },
    defaultChecked: { type: 'boolean', empty: 'fallback' },
    disabled: { type: 'boolean', empty: 'fallback' },
    draggable: { type: 'boolean', empty: 'fallback' },
    direction: { type: 'enum', options: ['ltr', 'rtl'], empty: 'fallback' },
  });
  def.props.setDefaults({
    defaultChecked: false,
    disabled: false,
    draggable: false,
    direction: 'ltr',
  });

  // P-BASE-SWITCH-CHECKED-EXPOSE, P-BASE-SWITCH-DISABLED-EXPOSE
  const checked = def.state.bool('checked', false);
  const disabled = def.state.bool('disabled', false);
  // P-BASE-SWITCH-POINTER-HOVER
  const hovered = def.state.bool('hovered', false);
  // P-BASE-SWITCH-PRESS-LIFECYCLE
  const pressed = def.state.bool('pressed', false);
  const percentage = def.state.numberRange('percentage', 0, { min: 0, max: 100 });
  const dragging = def.state.bool('dragging', false);
  const draggable = def.state.bool('draggable', false);
  const direction = def.state.string('direction', 'ltr');
  const axis = asAxisInput<SwitchRootProps>();
  axis.configure({
    anatomy: SWITCH_FAMILY,
    inputRole: 'root',
    geometryRole: 'root',
    travelRole: 'thumb',
  });
  // P-BASE-SWITCH-FOCUSABLE, P-BASE-SWITCH-DISABLED-REJECT-FOCUS
  const focusable = asFocusable<SwitchRootProps>();
  focusable.configure({ disabled: false });

  const focused = focusable.focused;
  const focusVisible = focusable.focusVisible;

  def.expose.state('checked', checked);
  def.expose.state('disabled', disabled);
  def.expose.state('hovered', hovered);
  def.expose.state('focused', focused);
  def.expose.state('focusVisible', focusVisible);
  def.expose.state('pressed', pressed);
  def.expose.state('percentage', percentage);
  def.expose.state('dragging', dragging);
  // P-BASE-SWITCH-REQUEST-FOCUS, P-BASE-SWITCH-DISABLED-REJECT-FOCUS
  def.expose.method('focusSelf', (options) => {
    if (disabled.get()) return;
    focusable.focusSelf(options);
  });
  // P-BASE-SWITCH-CHECKED-CHANGE-SIGNAL, P-BASE-SWITCH-CHECKED-CHANGE-PROTOCOL-NAME
  def.expose.event('checkedChange', { payload: 'json' });

  // P-BASE-SWITCH-ACCESSIBLE-ROLE
  accessible.role('switch');
  // P-BASE-SWITCH-ACCESSIBLE-NAME, P-BASE-SWITCH-STABLE-LABEL
  accessible.nameFromContent();
  // P-BASE-SWITCH-A11Y-CHECKED, P-BASE-SWITCH-A11Y-NO-MIXED
  accessible.state('checked', checked);
  accessible.state('disabled', disabled);
  accessible.action('activate', { event: 'checkedChange' });

  // P-BASE-SWITCH-CONTEXT-PROVIDE, P-BASE-SWITCH-CONTEXT-VALUE
  def.context.provide(SWITCH_CONTEXT, {
    checked: false,
    disabled: false,
    percentage: 0,
    dragging: false,
    draggable: false,
    direction: 'ltr',
  });

  let controlled = false;
  let accepted = false;
  let startProgress = 0;
  let live = true;
  let interactionEpoch = 0;
  let currentRun: RunHandle<SwitchRootProps> | null = null;
  let viewEpoch = 0;
  const reportTasks = new Set<{ cancel(): void }>();
  const readOnly = () => binding?.state.fieldReadOnly.get() ?? false;
  const reportField = (reason: 'sync' | 'change' | 'blur' = 'sync') => {
    if (!binding || !live || !currentRun) return;
    binding.report({ value: checked.get(), focused: focused.get(), composing: false, reason });
  };
  const retireField = () => {
    currentRun = null;
    viewEpoch++;
    for (const task of reportTasks) task.cancel();
    reportTasks.clear();
  };
  const notifyFieldChange = () => {
    if (!binding || !live || !currentRun) return;
    const epoch = viewEpoch;
    const task = delay(0, () => {
      reportTasks.delete(task);
      if (currentRun && live && epoch === viewEpoch) reportField('change');
    });
    reportTasks.add(task);
  };

  const publishContext = (run: RunHandle<SwitchRootProps>) => {
    const epoch = interactionEpoch;
    if (!dragging.get()) percentage.set(checked.get() ? 100 : 0, 'reason: switch settled progress');
    if (interactionEpoch !== epoch) return false;
    // P-BASE-SWITCH-CONTEXT-SYNC, P-BASE-SWITCH-PART-CONTEXT-CONSUME
    run.context.update(SWITCH_CONTEXT, {
      checked: !!checked.get(),
      disabled: !!disabled.get(),
      percentage: percentage.get(),
      dragging: dragging.get(),
      draggable: draggable.get(),
      direction: direction.get() === 'rtl' ? 'rtl' : 'ltr',
    });
    return interactionEpoch === epoch;
  };

  const syncAxis = (run: RunHandle<SwitchRootProps>) => {
    draggable.set(!!run.props.get().draggable, 'reason: switch drag policy');
    direction.set(run.props.get().direction ?? 'ltr', 'reason: switch direction');
    axis.sync({
      axis: 'horizontal',
      direction: run.props.get().direction ?? 'ltr',
      activation: 'directional',
      contactBasis: 'cancel-on-extent-change',
      disabled: !live || disabled.get() || !draggable.get(),
      readOnly: readOnly(),
      reverse: false,
    });
  };
  const clearPreview = (run: RunHandle<SwitchRootProps>) => {
    const epoch = interactionEpoch;
    accepted = false;
    dragging.set(false, 'reason: switch preview ended');
    if (interactionEpoch !== epoch) return false;
    pressed.set(false, 'reason: switch preview ended');
    if (interactionEpoch !== epoch) return false;
    return publishContext(run);
  };
  const invalidatePreview = (run: RunHandle<SwitchRootProps>, rearm = true) => {
    interactionEpoch++;
    accepted = false;
    axis.sync({ disabled: true });
    clearPreview(run);
    if (rearm) syncAxis(run);
  };

  const clearTransientInteraction = (reason: string) => {
    hovered.set(false, reason);
    pressed.set(false, reason);
  };

  const syncDisabled = (run: RunHandle<SwitchRootProps>, nextDisabled: boolean) => {
    disabled.set(nextDisabled, 'reason: switch root sync disabled');
    focusable.setDisabled(nextDisabled);
    if (nextDisabled) {
      invalidatePreview(run, false);
      clearTransientInteraction('reason: switch root disabled => reset transient interaction');
    }
    syncAxis(run);
    publishContext(run);
  };

  if (binding) {
    binding.state.fieldDisabled.watch(() => {
      if (currentRun) syncDisabled(currentRun, binding.state.fieldDisabled.get());
    });
    binding.state.fieldReadOnly.watch(() => {
      if (currentRun) invalidatePreview(currentRun);
    });
    focused.watch((_, event) => {
      if (event.type === 'next') reportField(event.next ? 'sync' : 'blur');
    });
  }

  // P-BASE-SWITCH-CONTROLLED-CHECKED, P-BASE-SWITCH-CONTROLLED-EMITS-NEXT
  // P-BASE-SWITCH-UNCONTROLLED-UPDATES-CHECKED
  def.lifecycle.onCreated((run) => {
    currentRun = run;
    controlled = run.props.isProvided('checked');
    checked.set(
      controlled ? !!run.props.get().checked : !!run.props.get().defaultChecked,
      'reason: switch root initialize checked'
    );
    syncDisabled(run, binding ? binding.state.fieldDisabled.get() : !!run.props.get().disabled);
    publishContext(run);
    reportField();
  });

  def.lifecycle.onMounted((run) => {
    currentRun = run;
    live = true;
    syncAxis(run);
    publishContext(run);
    reportField();
  });

  // P-BASE-SWITCH-CONTROLLED-CHECKED
  def.props.watch(['checked'], (run, next) => {
    const nextControlled = run.props.isProvided('checked');
    const changed =
      nextControlled !== controlled || (nextControlled && !!next.checked !== checked.get());
    controlled = nextControlled;
    if (controlled) checked.set(!!next.checked, 'reason: switch root controlled checked sync');
    if (changed) invalidatePreview(run);
    else publishContext(run);
    reportField();
  });

  // P-BASE-SWITCH-DISABLED-EXPOSE, P-BASE-SWITCH-DISABLED-CLEAR-TRANSIENT
  def.props.watch(['disabled'], (run, next) => {
    syncDisabled(run, binding ? binding.state.fieldDisabled.get() : !!next.disabled);
  });

  def.props.watch(['draggable', 'direction'], (run) => {
    invalidatePreview(run);
    publishContext(run);
  });
  def.lifecycle.onUnmounted((run) => {
    retireField();
    live = false;
    invalidatePreview(run, false);
  });
  def.lifecycle.onBeforeDispose(() => {
    retireField();
    live = false;
    accepted = false;
    interactionEpoch++;
  });

  // P-BASE-SWITCH-KEYBOARD-SPACE-ACTIVATION, P-BASE-SWITCH-KEYBOARD-ENTER-OPTIONAL
  // P-BASE-SWITCH-KEYBOARD-SPACE-PREVENT-DEFAULT
  def.event.onGlobal('key.down', (_run, ev) => {
    const detail = ev;
    if (disabled.get()) return;
    if (!focused.get()) return;
    if (detail?.key !== ' ') return;
    ev.control.requestDefaultActionPrevention({
      reason: 'switch.space-activation',
      source: 'base-switch',
    });
  });

  // P-BASE-SWITCH-POINTER-HOVER
  def.event.on('pointer.enter', () => {
    if (disabled.get()) return;
    hovered.set(true, 'reason: switch root pointer.enter => hovered');
  });
  def.event.on('pointer.leave', () => {
    hovered.set(false, 'reason: switch root pointer.leave => hovered');
    if (!dragging.get()) pressed.set(false, 'reason: switch root pointer.leave => pressed');
  });
  def.event.on('pointer.cancel', () => {
    // Once accepted, only the Axis owner may terminate its matched contact.
    // Generic events may belong to a different simultaneous native pointer.
    if (accepted) return;
    hovered.set(false, 'reason: switch root pointer.cancel => hovered');
    pressed.set(false, 'reason: switch root pointer.cancel => pressed');
  });

  // P-BASE-SWITCH-PRESS-LIFECYCLE
  def.event.on('pointer.down', () => {
    if (disabled.get()) return;
    pressed.set(true, 'reason: switch root pointer.down => pressed');
  });
  def.event.on('pointer.up', () => {
    if (accepted) return;
    pressed.set(false, 'reason: switch root pointer.up => pressed');
  });

  // P-BASE-SWITCH-ACTIVATION-FLIPS-CHECKED, P-BASE-SWITCH-DISABLED-SUPPRESS-ACTIVATION
  // P-BASE-SWITCH-UNCONTROLLED-UPDATES-CHECKED, P-BASE-SWITCH-CONTROLLED-EMITS-NEXT
  const requestChecked = (
    run: RunHandle<SwitchRootProps>,
    nextChecked: boolean,
    isCurrent: () => boolean = () => true
  ) => {
    if (!live || disabled.get() || readOnly() || !isCurrent() || nextChecked === checked.get())
      return;
    const previousChecked = checked.get();
    const epoch = ++interactionEpoch;
    const current = () =>
      live && !disabled.get() && !readOnly() && interactionEpoch === epoch && isCurrent();
    if (!controlled) checked.set(nextChecked, 'reason: switch accepted checked request');
    if (!current()) return;
    publishContext(run);
    if (!current()) return;
    const reportRun = currentRun;
    const reportEpoch = viewEpoch;
    run.expose.emit('checkedChange', { checked: nextChecked });
    if (current()) publishContext(run);
    if (
      live &&
      currentRun === reportRun &&
      viewEpoch === reportEpoch &&
      checked.get() !== previousChecked
    ) {
      reportField();
      if (live && currentRun === reportRun && viewEpoch === reportEpoch) notifyFieldChange();
    }
  };
  const activate = (run: RunHandle<SwitchRootProps>, isCurrent: () => boolean = () => true) => {
    pressed.set(false, 'reason: switch root press.commit => pressed');
    if (!live || disabled.get() || readOnly() || !isCurrent()) return;
    if (accepted) invalidatePreview(run);
    requestChecked(run, !checked.get(), isCurrent);
  };
  // P-BASE-SWITCH-DIRECTIONAL-PREVIEW: input and truth remain Root-owned.
  axis.on((run, sample) => {
    if (!live) return;
    if (sample.phase === 'cancel') {
      interactionEpoch++;
      clearPreview(run);
      return;
    }
    if (sample.phase === 'start') {
      if (disabled.get() || readOnly() || !draggable.get()) return;
      const epoch = ++interactionEpoch;
      accepted = true;
      startProgress = checked.get() ? 1 : 0;
      dragging.set(true, 'reason: switch accepted directional input');
      if (!live || !accepted || disabled.get() || interactionEpoch !== epoch) return;
      pressed.set(true, 'reason: switch active drag');
      if (!live || !accepted || disabled.get() || interactionEpoch !== epoch) return;
    }
    if (!accepted) return;
    if (!Number.isFinite(sample.totalDelta)) {
      invalidatePreview(run);
      return;
    }
    const progress = Math.min(1, Math.max(0, startProgress + sample.totalDelta));
    if (sample.phase === 'end') {
      // Clear provisional paint before outward controlled requests can reenter.
      const epoch = interactionEpoch;
      clearPreview(run);
      if (epoch === interactionEpoch) requestChecked(run, progress >= 0.5);
      return;
    }
    percentage.set(progress * 100, 'reason: switch drag preview');
    publishContext(run);
  });
  def.event.on('press.commit', (run) => {
    activate(run);
  });
  asControlLabel().target<SwitchRootProps>(
    (run, request) => {
      if (disabled.get() || !request.isCurrent()) return;
      const isCurrent = () => !disabled.get() && request.isCurrent();
      focusable.focusSelf({ reason: request.source === 'pointer' ? 'pointer' : 'programmatic' });
      if (!isCurrent()) return;
      activate(run, isCurrent);
    },
    options.fieldBinding ? FIELD_LABEL_PAIR : undefined
  );
}

/*
 * P-BASE-SWITCH criteria outside Switch-root-internal prototype syntax:
 * - P-BASE-SWITCH-CLICK-DEFERRED: absence of a `click` expose event is the implementation.
 * - P-BASE-SWITCH-INDICATOR-PRESENTATIONAL-A11Y: owned by root semantics and thumb's absence of a11y control syntax.
 * - P-BASE-SWITCH-PROP-LABEL-DEFERRED: accessible naming uses content/a11y projection; no `label` prop is accepted.
 * - P-BASE-SWITCH-FORM-INTEGRATION-DEFERRED: optional Field composition is explicit; form submission remains outside this root.
 * - P-BASE-SWITCH-NO-VISUAL-VARIANT-CORE: visual parameters are owned by downstream styled prototypes.
 * - P-BASE-SWITCH-TRACK-DEFERRED: track is not an official Switch core part in this implementation.
 */

// P-BASE-SWITCH-AUTHORING-ENTRIES
export const asSwitchRoot = defineAsHook<
  SwitchRootProps,
  SwitchRootExposes,
  SwitchRootAsHookContract
>({
  name: 'as-switch-root',
  setup: setupSwitchRoot,
});

const switchRoot = definePrototype({
  name: 'base-switch-root',
  setup: setupSwitchRoot,
});

export default switchRoot;
