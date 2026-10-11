import {
  defineAsHook,
  definePrototype,
  type DefHandle,
  type RunHandle,
  type RendererHandle,
} from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';
import { FIELD_CONTEXT } from '../field/shared';
import { SLIDER_VALUES_CONTEXT, SLIDER_VALUES_FAMILY } from './values-shared';
import {
  acceptValuesOwner,
  projectValuesOwner,
  compareValuesOwnerInput,
  validateValuesPolicy,
  constrainValuesRequest,
  sliderValuesKeyboard,
} from './values-numeric';
import { resolveValuesCollision, type SliderValuesCollisionBehavior } from './values-collision';
import type {
  SliderValuesRootProps,
  SliderValuesRootExposes,
  SliderValuesRootAsHookContract,
  SliderValuesShape,
  SliderValuesValue,
} from './values-types';

function setup(def: DefHandle<SliderValuesRootProps, SliderValuesRootExposes>) {
  def.anatomy.claim(SLIDER_VALUES_FAMILY, { role: 'root' });
  def.props.define({
    value: { type: 'any', empty: 'fallback' },
    defaultValue: { type: 'any', empty: 'fallback' },
    min: { type: 'number', empty: 'fallback' },
    max: { type: 'number', empty: 'fallback' },
    step: { type: 'number', empty: 'fallback' },
    largeStep: { type: 'number', empty: 'fallback' },
    minStepsBetweenValues: { type: 'number', empty: 'fallback' },
    thumbCollisionBehavior: { type: 'enum', options: ['push', 'swap', 'none'], empty: 'fallback' },
    disabled: { type: 'boolean', empty: 'fallback' },
    readOnly: { type: 'boolean', empty: 'fallback' },
    orientation: { type: 'enum', options: ['horizontal', 'vertical'], empty: 'fallback' },
    direction: { type: 'enum', options: ['ltr', 'rtl'], empty: 'fallback' },
    ariaLabel: { type: 'string', empty: 'fallback' },
  });
  // Missing defaultValue derives from resolved min at creation. It is not an
  // eagerly installed zero that would replace upstream nonzero-min intent.
  def.props.setDefaults({
    min: 0,
    max: 100,
    step: 1,
    largeStep: 10,
    minStepsBetweenValues: 0,
    thumbCollisionBehavior: 'push',
    disabled: false,
    readOnly: false,
    orientation: 'horizontal',
    direction: 'ltr',
    ariaLabel: '',
  });
  const values = def.state.numberList('values', []);
  const creationValues = def.state.numberList('creationValues', []);
  const sessionStart = def.state.numberList('sessionStart', []);
  const proposalValues = def.state.numberList('proposalValues', []);
  const valueShape = def.state.string('valueShape', 'scalar');
  const creationShape = def.state.string('creationShape', 'scalar');
  const proposalShape = def.state.string('proposalShape', 'scalar');
  const ready = def.state.bool('ready', false),
    ownerInitialized = def.state.bool('ownerInitialized', false);
  const created = def.state.bool('created', false);
  const controlled = def.state.bool('controlled', false),
    retired = def.state.bool('retired', false);
  const disabled = def.state.bool('disabled', false),
    readOnly = def.state.bool('readOnly', false);
  const phase = def.state.string('phase', 'idle'),
    diagnostic = def.state.string('diagnostic', '');
  const working = def.state.bool('working', false),
    propsDirty = def.state.bool('propsDirty', false),
    partsDirty = def.state.bool('partsDirty', false);
  const veto = def.state.bool('veto', false),
    interacting = def.state.bool('interacting', false),
    pendingCommit = def.state.bool('pendingCommit', false);
  const activeIndex = def.state.numberDiscrete('activeIndex', -1),
    proposalIndex = def.state.numberDiscrete('proposalIndex', -1),
    revision = def.state.numberDiscrete('revision', 0);
  const proposalReason = def.state.string('proposalReason', 'none');
  const min = def.state.numberDiscrete('min', 0),
    max = def.state.numberDiscrete('max', 100),
    step = def.state.numberDiscrete('step', 1);
  const largeStep = def.state.numberDiscrete('largeStep', 10),
    minSteps = def.state.numberDiscrete('minStepsBetweenValues', 0);
  const collisionBehavior = def.state.string('thumbCollisionBehavior', 'push');
  const orientation = def.state.string('orientation', 'horizontal'),
    direction = def.state.string('direction', 'ltr'),
    label = def.state.string('label', '');
  for (const [name, handle] of Object.entries({
    values,
    valueShape,
    ready,
    disabled,
    readOnly,
    phase,
    diagnostic,
    activeIndex,
    interacting,
  }))
    def.expose.state(
      name as
        | 'values'
        | 'valueShape'
        | 'ready'
        | 'disabled'
        | 'readOnly'
        | 'phase'
        | 'diagnostic'
        | 'activeIndex'
        | 'interacting',
      handle
    );
  const a11y = asAccessible();
  a11y.role('group');
  a11y.name(label);
  def.context.provide(SLIDER_VALUES_CONTEXT, {
    values: [],
    ready: false,
    mappingReady: false,
    min: 0,
    max: 100,
    step: 1,
    largeStep: 10,
    minStepsBetweenValues: 0,
    disabled: false,
    readOnly: false,
    orientation: 'horizontal',
    direction: 'ltr',
    label: '',
    phase: 'idle',
  });
  let run: RunHandle<SliderValuesRootProps> | null = null;
  const bump = () => revision.set((revision.get() + 1) % Number.MAX_SAFE_INTEGER);
  // Exposed State notifications are synchronous external callback boundaries.
  // Once onUnmounted retires the receiver, stop the old frame before any next
  // State access or notification; do not catch or reinterpret live errors.
  const clearSession = (retiring = false) => {
    pendingCommit.set(false);
    interacting.set(false);
    if (retiring ? !run : !live()) return false;
    activeIndex.set(-1);
    return retiring ? !!run : live();
  };
  const invalidate = (retiring = false) => {
    bump();
    clearSession(retiring);
  };
  const unwrap = (list: readonly number[], shape: string): SliderValuesValue =>
    shape === 'scalar' ? list[0] : [...list];
  const policy = () => ({
    min: min.get(),
    max: max.get(),
    step: step.get(),
    largeStep: largeStep.get(),
    minStepsBetweenValues: minSteps.get(),
  });
  const display = () =>
    projectValuesOwner(
      { rawValues: values.get(), shape: valueShape.get() as SliderValuesShape },
      min.get(),
      max.get()
    );
  const live = () => !!run && created.get() && !retired.get();
  const eligible = () => live() && ready.get() && !disabled.get() && !readOnly.get();
  const mapping = (wanted = -1) => {
    if (!run) return false;
    const parts = run.anatomy.partsOf(SLIDER_VALUES_FAMILY, 'thumb');
    const count = values.get().length;
    if (parts.length !== count) return false;
    const indices: number[] = [];
    for (const part of parts) {
      const getInfo = part.getExpose('getSlotInfo');
      if (typeof getInfo !== 'function') return false;
      const info = getInfo();
      if (
        !info ||
        !Number.isInteger(info.index) ||
        info.index < 0 ||
        info.index >= count ||
        indices.includes(info.index)
      )
        return false;
      if (info.index === wanted && (info.disabled || info.readOnly)) return false;
      indices.push(info.index);
    }
    return wanted < 0 || indices.includes(wanted);
  };
  const reconcile = (initial = false) => {
    if (!run) return;
    const p = run.props.get();
    const field = run.context.tryRead(FIELD_CONTEXT);
    const nextDisabled = !!p.disabled || !!field?.disabled,
      nextReadOnly = !!p.readOnly || !!field?.readOnly;
    const changedFlags = disabled.get() !== nextDisabled || readOnly.get() !== nextReadOnly;
    // These effective policy facts do not depend on numerical validity.
    disabled.set(nextDisabled);
    if (!live()) return;
    readOnly.set(nextReadOnly);
    if (!live()) return;
    const nextControlled = p.value != null;
    if (initial) controlled.set(nextControlled);
    if (controlled.get() !== nextControlled) {
      ready.set(false);
      if (!live()) return;
      diagnostic.set('controlled-mode-change');
      if (!live()) return;
      invalidate();
      return;
    }
    const input = nextControlled
      ? p.value
      : ownerInitialized.get()
        ? unwrap(values.get(), valueShape.get())
        : (p.defaultValue ?? p.min);
    const owner = acceptValuesOwner(input);
    // Mode and creation intent are independent of policy validity.
    if (owner.ok && !ownerInitialized.get()) {
      values.set(owner.rawValues);
      if (!live()) return;
      valueShape.set(owner.shape);
      if (!live()) return;
      creationValues.set(owner.rawValues);
      creationShape.set(owner.shape);
      ownerInitialized.set(true);
    }
    const nextPolicy = {
      min: p.min!,
      max: p.max!,
      step: p.step!,
      largeStep: p.largeStep!,
      minStepsBetweenValues: p.minStepsBetweenValues!,
    };
    const bad = validateValuesPolicy(nextPolicy);
    if (bad || !owner.ok) {
      ready.set(false);
      if (!live()) return;
      diagnostic.set(bad?.reason ?? (!owner.ok ? owner.reason : 'invalid-values'));
      if (!live()) return;
      invalidate();
      return;
    }
    const changedPolicy =
      min.get() !== nextPolicy.min ||
      max.get() !== nextPolicy.max ||
      step.get() !== nextPolicy.step ||
      largeStep.get() !== nextPolicy.largeStep ||
      minSteps.get() !== nextPolicy.minStepsBetweenValues ||
      collisionBehavior.get() !== p.thumbCollisionBehavior ||
      orientation.get() !== p.orientation ||
      direction.get() !== p.direction ||
      changedFlags;
    const changedShape =
      valueShape.get() !== owner.shape || values.get().length !== owner.rawValues.length;
    if (changedPolicy || changedShape) invalidate();
    if (!live()) return;
    min.set(nextPolicy.min);
    max.set(nextPolicy.max);
    step.set(nextPolicy.step);
    largeStep.set(nextPolicy.largeStep);
    minSteps.set(nextPolicy.minStepsBetweenValues);
    collisionBehavior.set(p.thumbCollisionBehavior!);
    disabled.set(nextDisabled);
    if (!live()) return;
    readOnly.set(nextReadOnly);
    if (!live()) return;
    orientation.set(p.orientation!);
    direction.set(p.direction!);
    label.set(p.ariaLabel ?? '');
    if (nextControlled) {
      values.set(owner.rawValues);
      if (!live()) return;
      valueShape.set(owner.shape);
      if (!live()) return;
    }
    ready.set(true);
    if (!live()) return;
    diagnostic.set('');
  };
  const reconcilePending = () => {
    for (let pass = 0; pass < 32; pass++) {
      if (!live()) return false;
      if (partsDirty.get()) {
        partsDirty.set(false);
        invalidate();
        if (!live()) return false;
      }
      if (propsDirty.get()) {
        propsDirty.set(false);
        reconcile();
        if (!live()) return false;
      }
      if (!propsDirty.get() && !partsDirty.get()) return true;
    }
    diagnostic.set('reentrant-props-limit');
    if (!live()) return false;
    ready.set(false);
    if (!live()) return false;
    invalidate();
    return false;
  };
  const publish = () => {
    if (!live() || !run) return;
    const d = display();
    run.context.update(SLIDER_VALUES_CONTEXT, {
      values: d.ok ? d.values : [],
      ready: ready.get(),
      mappingReady: ready.get() && mapping(),
      ...policy(),
      disabled: disabled.get(),
      readOnly: readOnly.get(),
      orientation: orientation.get() as 'horizontal' | 'vertical',
      direction: direction.get() as 'ltr' | 'rtl',
      label: label.get(),
      phase: phase.get(),
    });
  };
  // A single declared busy fact protects the idle notification itself against
  // nested edits. Props are still received and drained, never discarded.
  const settle = () => {
    for (let pass = 0; pass < 32; pass++) {
      if (!live()) return false;
      phase.set('publishing');
      if (!live()) return false;
      if (!reconcilePending()) break;
      publish();
      if (!live()) return false;
      if (propsDirty.get() || partsDirty.get()) continue;
      phase.set('idle');
      if (!live()) return false;
      if (!propsDirty.get() && !partsDirty.get()) return true;
    }
    if (live()) {
      diagnostic.set('reentrant-props-limit');
      if (!live()) return false;
      ready.set(false);
      if (!live() || !clearSession()) return false;
      propsDirty.set(false);
      partsDirty.set(false);
      phase.set('idle');
      // A terminal failure must reach retained parts as a disabled projection.
      // Do not restart the exhausted feedback drain from this notification.
      publish();
    }
    return false;
  };
  const flush = () => {
    if (!live() || working.get()) return;
    working.set(true);
    try {
      settle();
    } finally {
      if (live()) working.set(false);
    }
  };
  const commit = () => {
    if (!eligible() || !pendingCommit.get() || !run) return false;
    const event = {
      value: unwrap(proposalValues.get(), proposalShape.get()),
      activeThumbIndex: proposalIndex.get(),
      reason: proposalReason.get(),
    };
    const before = revision.get();
    if (!clearSession()) return false;
    // Clearing exposed interaction facts and publishing Context are callback
    // boundaries: either can synchronously invalidate completion eligibility.
    if (!settle() || !eligible() || revision.get() !== before || !run) return false;
    run.expose.emit('valueCommit', event);
    return true;
  };
  const request = (input: unknown, index: number, reason: string, immediate = false) => {
    if (!eligible() || working.get() || !run) return false;
    const owner = acceptValuesOwner(input);
    if (!owner.ok) {
      diagnostic.set(owner.reason);
      return false;
    }
    if (compareValuesOwnerInput(input, unwrap(values.get(), valueShape.get()))) return false;
    const before = revision.get();
    working.set(true);
    veto.set(false);
    phase.set('notifying');
    if (!live()) return false;
    try {
      run.expose.emit('valueChange', {
        value: unwrap(owner.rawValues, owner.shape),
        activeThumbIndex: index,
        reason,
      });
      if (!live()) return false;
      phase.set('publishing');
      if (!live()) return false;
      const canceled = veto.get();
      if (!reconcilePending() || !eligible() || revision.get() !== before) {
        settle();
        return false;
      }
      if (canceled) {
        settle();
        return false;
      }
      if (!controlled.get()) {
        values.set(owner.rawValues);
        if (!live()) return false;
        if (!reconcilePending() || !eligible() || revision.get() !== before) {
          settle();
          return false;
        }
        valueShape.set(owner.shape);
        if (!live()) return false;
        if (!reconcilePending() || !eligible() || revision.get() !== before) {
          settle();
          return false;
        }
      }
      proposalValues.set(owner.rawValues);
      proposalShape.set(owner.shape);
      proposalIndex.set(index);
      proposalReason.set(reason);
      pendingCommit.set(true);
      activeIndex.set(index);
      if (!live()) return false;
      diagnostic.set('');
      if (!live()) return false;
      const settled = settle();
      if (!settled || !eligible() || revision.get() !== before) return false;
      if (immediate) {
        commit();
        settle();
      }
      return true;
    } finally {
      if (live()) working.set(false);
    }
  };
  const requestIndex = (index: number, input: number, reason: string, immediate = false) => {
    if (!eligible() || working.get() || !mapping(index)) {
      if (live()) diagnostic.set('invalid-thumb-mapping');
      return false;
    }
    const d = display();
    if (!d.ok) return false;
    const result = constrainValuesRequest(d.values, index, input, policy());
    if (!result.ok) {
      diagnostic.set(result.reason);
      return false;
    }
    return request(unwrap(result.values, valueShape.get()), index, reason, immediate);
  };
  def.expose.method('getValue', () =>
    live() && ready.get() ? unwrap(values.get(), valueShape.get()) : null
  );
  def.expose.method('getDisplayValue', () => {
    if (!live()) return null;
    const d = display();
    return ready.get() && live() && d.ok ? unwrap(d.values, valueShape.get()) : null;
  });
  def.expose.method('requestValue', (next) =>
    live() && valueShape.get() === 'scalar' && typeof next === 'number'
      ? request(next, 0, 'imperative')
      : false
  );
  def.expose.method('requestValues', (next) =>
    live() && valueShape.get() === 'array' && typeof next !== 'number'
      ? request(next, -1, 'imperative')
      : false
  );
  // Logical numerical input only. A future input owner must establish origin,
  // capture and conversion outside this entry; no host event is synthesized.
  def.expose.method('requestInteractionValue', (next) => {
    if (!eligible() || working.get() || !interacting.get()) return false;
    const before = revision.get();
    const index = activeIndex.get();
    if (index < 0 || !mapping(index)) {
      if (live()) diagnostic.set('invalid-thumb-mapping');
      return false;
    }
    if (!eligible() || !interacting.get() || revision.get() !== before) return false;
    const latest = pendingCommit.get()
      ? projectValuesOwner(
          { rawValues: proposalValues.get(), shape: proposalShape.get() as SliderValuesShape },
          min.get(),
          max.get()
        )
      : display();
    if (!latest.ok) {
      diagnostic.set(latest.reason);
      return false;
    }
    const result = resolveValuesCollision({
      behavior: collisionBehavior.get() as SliderValuesCollisionBehavior,
      values: latest.values,
      sessionStart: sessionStart.get(),
      index,
      nextValue: next,
      policy: policy(),
    });
    if (!result.ok) {
      diagnostic.set(result.reason);
      return false;
    }
    // A swap also needs an editable target. The public mapping is checked
    // again after notifications by the existing dirty/revision drain.
    if (!mapping(result.index)) {
      if (live()) diagnostic.set('invalid-thumb-mapping');
      return false;
    }
    if (!eligible() || !interacting.get() || revision.get() !== before) return false;
    return request(unwrap(result.values, valueShape.get()), result.index, 'interaction');
  });
  def.expose.method('requestThumbValue', (index, next) => requestIndex(index, next, 'input'));
  def.expose.method('requestKeyboardValue', (index, key, shift = false) => {
    if (!eligible() || working.get() || !mapping(index)) return false;
    const d = display();
    if (!d.ok) return false;
    const next = sliderValuesKeyboard(
      d.values,
      index,
      key,
      policy(),
      direction.get() as 'ltr' | 'rtl',
      shift,
      (reason) => diagnostic.set(reason)
    );
    return next === null ? false : requestIndex(index, next, 'keyboard', true);
  });
  def.expose.method('beginInteraction', (index = -1) => {
    if (
      !Number.isInteger(index) ||
      index < -1 ||
      !eligible() ||
      working.get() ||
      interacting.get() ||
      (index >= 0 && !mapping(index))
    )
      return false;
    if (!eligible() || interacting.get()) return false;
    const d = display();
    if (!d.ok) return false;
    const before = revision.get();
    working.set(true);
    try {
      sessionStart.set(d.values);
      pendingCommit.set(false);
      interacting.set(true);
      if (!live()) return false;
      if (!reconcilePending() || !eligible() || revision.get() !== before) {
        settle();
        return false;
      }
      activeIndex.set(index);
      if (!live()) return false;
      const settled = settle();
      return settled && eligible() && interacting.get() && revision.get() === before;
    } finally {
      if (live()) working.set(false);
    }
  });
  def.expose.method('commitValue', () => {
    if (!eligible() || working.get()) return false;
    working.set(true);
    try {
      const done = commit();
      settle();
      return done;
    } finally {
      if (live()) working.set(false);
    }
  });
  def.expose.method('cancelValueChange', () => {
    if (!live() || phase.get() !== 'notifying') return false;
    veto.set(true);
    return true;
  });
  def.expose.method('cancelInteraction', () => {
    if (!live() || working.get()) return false;
    working.set(true);
    try {
      bump();
      if (!clearSession()) return false;
      return settle();
    } finally {
      if (live()) working.set(false);
    }
  });
  def.expose.method('resetValue', () =>
    live() ? request(unwrap(creationValues.get(), creationShape.get()), -1, 'reset') : false
  );
  def.expose.method('invalidateParts', () => {
    if (!live()) return;
    partsDirty.set(true);
    flush();
  });
  def.expose.event('valueChange', { payload: 'json' });
  def.expose.event('valueCommit', { payload: 'json' });
  def.props.watchAll((current) => {
    run = current;
    propsDirty.set(true);
    flush();
  });
  def.context.trySubscribe(FIELD_CONTEXT, (current) => {
    run = current;
    propsDirty.set(true);
    flush();
  });
  def.anatomy.subscribeParts(SLIDER_VALUES_FAMILY, 'thumb', (current) => {
    run = current;
    partsDirty.set(true);
    flush();
  });
  def.lifecycle.onCreated((current) => {
    run = current;
    created.set(true);
    working.set(true);
    reconcile(true);
    if (!live()) return;
    settle();
    if (live()) working.set(false);
  });
  def.lifecycle.onMounted((current) => {
    run = current;
    retired.set(false);
    working.set(false);
    propsDirty.set(true);
    flush();
  });
  def.lifecycle.onUnmounted(() => {
    retired.set(true);
    ready.set(false);
    veto.set(true);
    // This lifecycle callback still owns a valid cleanup scope. End the mount
    // epoch completely; old edit frames use the stricter live() guard instead.
    invalidate(true);
    run = null;
  });
  def.lifecycle.onBeforeDispose(() => {
    // Terminal disposal can also happen without any mounted epoch.
    run = null;
    retired.set(true);
  });
  return (r: RendererHandle<any>) => r.slot();
}
export const asSliderValuesRoot = defineAsHook<
  SliderValuesRootProps,
  SliderValuesRootExposes,
  SliderValuesRootAsHookContract
>({ name: 'as-slider-values-root', setup });
export default definePrototype<SliderValuesRootProps, SliderValuesRootExposes>({
  name: 'base-slider-values-root',
  setup,
});
