import { FIELD_CONTEXT } from '../field/shared';
import {
  defineAsHook,
  definePrototype,
  type DefHandle,
  type RunHandle,
  type RendererHandle,
} from '@proto.ui/core';
import { finite, range, quantize } from '../progress/range';
import { NUMBER_FIELD_CONTEXT, NUMBER_FIELD_FAMILY } from './shared';
import { createNumberFieldFormat, type NumberFieldFormat } from './format';
import type {
  NumberFieldRootProps,
  NumberFieldRootExposes,
  NumberFieldRootAsHookContract,
} from './types';
function setup(def: DefHandle<NumberFieldRootProps, NumberFieldRootExposes>) {
  def.anatomy.claim(NUMBER_FIELD_FAMILY, { role: 'root' });
  def.props.define({
    value: { type: 'number', empty: 'accept' },
    defaultValue: { type: 'number', empty: 'accept' },
    min: { type: 'number', empty: 'fallback' },
    max: { type: 'number', empty: 'fallback' },
    step: { type: 'number', empty: 'fallback', validator: (v) => Number.isFinite(v) && v > 0 },
    disabled: { type: 'boolean', empty: 'fallback' },
    readOnly: { type: 'boolean', empty: 'fallback' },
    ariaLabel: { type: 'string', empty: 'fallback' },
    name: { type: 'string', empty: 'fallback' },
    allowEmpty: { type: 'boolean', empty: 'fallback' },
    locale: { type: 'string', empty: 'fallback' },
    formatOptions: { type: 'any', empty: 'fallback' },
    scrub: { type: 'boolean', empty: 'fallback' },
    scrubSteps: {
      type: 'number',
      empty: 'fallback',
      validator: (v) => Number.isFinite(v) && v > 0,
    },
    direction: { type: 'enum', options: ['ltr', 'rtl'], empty: 'fallback' },
  });
  def.props.setDefaults({
    defaultValue: 0,
    min: 0,
    max: 100,
    step: 1,
    disabled: false,
    readOnly: false,
    ariaLabel: '',
    name: '',
    allowEmpty: false,
    scrub: false,
    scrubSteps: 100,
    direction: 'ltr',
  });
  // Null is a product state: the portable numeric readout retains its finite
  // value, while empty/getValue and context/events carry canonical emptiness.
  const value = def.state.numberDiscrete('value', 0),
    empty = def.state.bool('empty', false),
    draft = def.state.string('draft', '0'),
    disabled = def.state.bool('disabled', false),
    readOnly = def.state.bool('readOnly', false),
    dragging = def.state.bool('dragging', false),
    composing = def.state.bool('composing', false),
    formatInvalid = def.state.bool('formatInvalid', false);
  for (const [key, state] of Object.entries({
    value,
    empty,
    draft,
    disabled,
    readOnly,
    dragging,
    formatInvalid,
  }))
    def.expose.state(key as keyof NumberFieldRootExposes, state);
  def.expose.event('valueChange', { payload: 'json' });
  def.expose.event('valueCommit', { payload: 'json' });
  def.context.provide(NUMBER_FIELD_CONTEXT, {
    value: 0,
    draft: '0',
    min: 0,
    max: 100,
    step: 1,
    disabled: false,
    readOnly: false,
    controlDisabled: false,
    controlReadOnly: false,
    label: '',
    name: '',
    formatted: '0',
    scrub: false,
    direction: 'ltr',
    composing: false,
    editRevision: 0,
  });
  let run: RunHandle<NumberFieldRootProps> | null = null;
  let viewEpoch = 0;
  let format = createNumberFieldFormat();
  let draftFormat: NumberFieldFormat = format;
  let draftEdited = false;
  let editRevision = 0;
  let initialValue: number | null = 0;
  let scrubStart: number | null = 0;
  let scrubProposal: number | undefined;
  const canonical = () => (empty.get() ? null : value.get());
  const live = (current: typeof run, epoch: number) =>
    !!run && run === current && viewEpoch === epoch;
  const normalize = (v: number) => {
    const p = run?.props.get(),
      b = range(p?.min, p?.max);
    return quantize(v, b.min, b.max, finite(p?.step, 1));
  };
  const accept = (next: number | null, reason: string) => {
    const current = run,
      epoch = viewEpoch;
    if (next !== null) value.set(normalize(next), reason);
    if (!live(current, epoch)) return;
    empty.set(next === null, reason);
  };
  const canonicalDraft = (reason: string) => {
    if (composing.get()) return;
    draftFormat = format;
    draftEdited = false;
    draft.set(format.format(canonical()), reason);
  };
  const reportField = () => {
    const report = run?.anatomy.partsOf(NUMBER_FIELD_FAMILY, 'input')[0]?.getExpose('__fieldInput');
    if (typeof report === 'function') report();
  };
  const publish = () => {
    if (!run) return;
    const current = run,
      epoch = viewEpoch,
      p = run.props.get();
    disabled.set(
      !!p.disabled || !!run.context.tryRead(FIELD_CONTEXT)?.disabled,
      'reason: number policy'
    );
    if (!live(current, epoch)) return;
    readOnly.set(
      !!p.readOnly || !!run.context.tryRead(FIELD_CONTEXT)?.readOnly,
      'reason: number policy'
    );
    if (!live(current, epoch)) return;
    if (disabled.get() || readOnly.get()) {
      cancelScrub();
      if (!live(current, epoch)) return;
      if (composing.get() || draftEdited) {
        editRevision++;
        composing.set(false, 'reason: number policy cancels composition');
        canonicalDraft('reason: number policy canonical text');
      }
    }
    if (!live(current, epoch)) return;
    run.context.update(NUMBER_FIELD_CONTEXT, {
      value: canonical(),
      draft: draft.get(),
      ...range(p.min, p.max),
      step: finite(p.step, 1),
      disabled: disabled.get(),
      readOnly: readOnly.get(),
      controlDisabled: !!p.disabled,
      controlReadOnly: !!p.readOnly,
      label: p.ariaLabel ?? '',
      name: p.name ?? '',
      formatted: format.format(canonical()),
      scrub: !!p.scrub,
      direction: p.direction ?? 'ltr',
      composing: composing.get(),
      editRevision,
    });
  };
  const request = (next: number | null, notify = true, replaceProposal = false) => {
    if (!run || disabled.get() || readOnly.get() || (next !== null && !Number.isFinite(next)))
      return false;
    const current = run,
      epoch = viewEpoch;
    next = next === null ? null : normalize(next);
    if (next === canonical() && !replaceProposal) return false;
    if (!run.props.isProvided('value')) accept(next, 'reason: number accepted value');
    if (!live(current, epoch)) return true;
    publish();
    if (!live(current, epoch)) return true;
    run.expose.emit('valueChange', { value: next });
    if (!live(current, epoch)) return true;
    if (notify) reportField();
    return true;
  };
  const cancelScrub = (restore = true, notify = true) => {
    if (!run || !dragging.get()) return false;
    const current = run,
      epoch = viewEpoch,
      start = scrubStart;
    scrubProposal = undefined;
    dragging.set(false, 'reason: number scrub cancelled');
    if (!live(current, epoch)) return true;
    const changed = restore && !run.props.isProvided('value') && canonical() !== start;
    if (changed) accept(start, 'reason: number scrub rollback');
    if (!live(current, epoch)) return true;
    canonicalDraft('reason: number scrub canonical text');
    if (!live(current, epoch)) return true;
    publish();
    if (!live(current, epoch)) return true;
    if (changed && notify) {
      run.expose.emit('valueChange', { value: canonical() });
      if (live(current, epoch)) reportField();
    }
    return true;
  };
  def.expose.method('getValue', canonical);
  def.expose.method('requestValue', (next) => {
    const current = run,
      epoch = viewEpoch;
    if (composing.get()) return false;
    cancelScrub();
    if (!live(current, epoch)) return false;
    const changed = request(next);
    if (!live(current, epoch)) return changed;
    canonicalDraft('reason: number public request text');
    if (live(current, epoch)) publish();
    return changed;
  });
  const commit = () => {
    if (!run || disabled.get() || readOnly.get() || composing.get()) return;
    const current = run,
      epoch = viewEpoch;
    if (draftEdited) {
      const parsed = draftFormat.parse(draft.get());
      if (parsed.kind === 'number') request(parsed.value);
      else if (parsed.kind === 'empty' && run.props.get().allowEmpty) request(null);
    }
    if (!live(current, epoch)) return;
    canonicalDraft('reason: number canonical commit');
    if (!live(current, epoch)) return;
    publish();
    if (live(current, epoch)) run!.expose.emit('valueCommit', { value: canonical() });
  };
  def.expose.method('requestInput', (text, isComposing = false) => {
    if (!run || disabled.get() || readOnly.get() || typeof text !== 'string') return false;
    const current = run,
      epoch = viewEpoch;
    cancelScrub();
    if (!live(current, epoch)) return false;
    if (!composing.get()) draftFormat = format;
    const parsingFormat = draftFormat;
    draftEdited ||= text !== draft.get();
    composing.set(isComposing, 'reason: number composition');
    if (!live(current, epoch)) return true;
    draft.set(text, 'reason: number draft input');
    if (!live(current, epoch)) return true;
    publish();
    if (!live(current, epoch)) return true;
    if (!isComposing) {
      const parsed = parsingFormat.parse(text);
      if (draftEdited && parsed.kind === 'number') request(parsed.value, false);
      if (!live(current, epoch)) return true;
      // A locale update cannot reinterpret an in-flight composition's digits.
      if (parsingFormat !== format) {
        canonicalDraft('reason: number composition format reconciliation');
        if (live(current, epoch)) publish();
      }
    }
    return true;
  });
  def.expose.method('commitValue', commit);
  def.expose.method('stepBy', (direction) => {
    if (!run || !Number.isFinite(direction) || direction === 0 || composing.get()) return false;
    const current = run,
      epoch = viewEpoch;
    cancelScrub();
    if (!live(current, epoch)) return false;
    const changed = request(
      empty.get() ? normalize(0) : value.get() + direction * finite(run.props.get().step, 1)
    );
    if (!live(current, epoch)) return changed;
    canonicalDraft('reason: number step');
    if (!live(current, epoch)) return changed;
    publish();
    if (changed && live(current, epoch)) run!.expose.emit('valueCommit', { value: canonical() });
    return changed;
  });
  def.expose.method('beginScrub', () => {
    if (
      !run ||
      !run.props.get().scrub ||
      disabled.get() ||
      readOnly.get() ||
      composing.get() ||
      dragging.get()
    )
      return false;
    const current = run,
      epoch = viewEpoch;
    scrubStart = canonical();
    scrubProposal = undefined;
    dragging.set(true, 'reason: number scrub start');
    if (!live(current, epoch)) return false;
    canonicalDraft('reason: number scrub starts from accepted value');
    if (live(current, epoch)) publish();
    return live(current, epoch) && dragging.get();
  });
  def.expose.method('scrubBy', (totalDelta) => {
    if (
      !run ||
      !dragging.get() ||
      composing.get() ||
      disabled.get() ||
      readOnly.get() ||
      !Number.isFinite(totalDelta)
    )
      return false;
    if (totalDelta === 0 && scrubProposal === undefined) return false;
    const current = run,
      epoch = viewEpoch,
      p = run.props.get();
    const next = normalize(
      (scrubStart ?? normalize(0)) + totalDelta * finite(p.scrubSteps, 100) * finite(p.step, 1)
    );
    if (!Number.isFinite(next) || next === scrubProposal) return false;
    // A controlled owner may defer an earlier suggestion. Returning to its
    // current value is still a newer proposal that supersedes that suggestion.
    const replaceProposal = run.props.isProvided('value') && scrubProposal !== undefined;
    scrubProposal = next;
    const changed = request(next, true, replaceProposal);
    if (!live(current, epoch) || !dragging.get()) return changed;
    canonicalDraft('reason: number scrub text');
    if (live(current, epoch)) publish();
    return changed;
  });
  def.expose.method('endScrub', () => {
    if (!run || !dragging.get()) return false;
    const current = run,
      epoch = viewEpoch;
    const changed = scrubProposal !== undefined && canonical() !== scrubStart;
    scrubProposal = undefined;
    dragging.set(false, 'reason: number scrub end');
    if (!live(current, epoch)) return false;
    canonicalDraft('reason: number scrub end text');
    if (!live(current, epoch)) return false;
    publish();
    if (changed && live(current, epoch) && !disabled.get() && !readOnly.get())
      run!.expose.emit('valueCommit', { value: canonical() });
    return true;
  });
  def.expose.method('cancelScrub', () => cancelScrub());
  def.context.trySubscribe(FIELD_CONTEXT, () => publish());
  def.expose.method('resetValue', () => {
    if (!run) return false;
    const current = run,
      epoch = viewEpoch;
    cancelScrub(false);
    if (!live(current, epoch)) return false;
    editRevision++;
    composing.set(false, 'reason: number reset composition');
    const next = initialValue === null ? null : normalize(initialValue);
    if (!run.props.isProvided('value')) accept(next, 'reason: number-field value reset');
    if (!live(current, epoch)) return true;
    canonicalDraft('reason: number reset text');
    if (!live(current, epoch)) return true;
    publish();
    if (live(current, epoch) && run!.props.isProvided('value'))
      run!.expose.emit('valueChange', { value: next });
    return true;
  });
  def.lifecycle.onCreated((current) => {
    run = current;
    const p = current.props.get();
    format = createNumberFieldFormat(p.locale, p.formatOptions);
    formatInvalid.set(format.invalid, 'reason: number format configuration');
    const candidate = current.props.isProvided('value') ? p.value : p.defaultValue;
    accept(candidate === null ? null : finite(candidate, 0), 'reason: number initialize');
    canonicalDraft('reason: number initialize text');
    initialValue = canonical();
    publish();
  });
  def.lifecycle.onMounted((current) => {
    run = current;
    publish();
  });
  def.props.watchAll((current, next, previous) => {
    run = current;
    const epoch = viewEpoch;
    const valueChanged = next.value !== previous.value;
    const policyChanged =
      next.min !== previous.min || next.max !== previous.max || next.step !== previous.step;
    const formatChanged =
      next.locale !== previous.locale || next.formatOptions !== previous.formatOptions;
    const scrubChanged =
      next.scrub !== previous.scrub ||
      next.scrubSteps !== previous.scrubSteps ||
      next.direction !== previous.direction;
    if (
      dragging.get() &&
      (policyChanged ||
        scrubChanged ||
        formatChanged ||
        (valueChanged && next.value !== scrubProposal))
    )
      cancelScrub();
    if (!live(current, epoch)) return;
    if (formatChanged) {
      format = createNumberFieldFormat(next.locale, next.formatOptions);
      formatInvalid.set(format.invalid, 'reason: number format configuration');
    }
    if (!live(current, epoch)) return;
    if (valueChanged || policyChanged) {
      if (composing.get()) {
        editRevision++;
        composing.set(false, 'reason: number owner cancels composition');
        if (!live(current, epoch)) return;
      }
      const candidate = current.props.isProvided('value') ? current.props.get().value : canonical();
      accept(
        candidate === null ? null : finite(candidate, 0),
        'reason: number controlled or bounds'
      );
      if (!live(current, epoch)) return;
      canonicalDraft('reason: number owner text');
    } else if (formatChanged) canonicalDraft('reason: number format text');
    if (live(current, epoch)) publish();
  });
  def.lifecycle.onUnmounted(() => {
    cancelScrub(true, false);
    composing.set(false, 'reason: number view retires composition');
    editRevision++;
    canonicalDraft('reason: number view canonical text');
    viewEpoch++;
    run = null;
  });
  def.lifecycle.onBeforeDispose(() => {
    run = null;
  });
  return (r: RendererHandle<any>) => r.slot();
}
export const asNumberFieldRoot = defineAsHook<
  NumberFieldRootProps,
  NumberFieldRootExposes,
  NumberFieldRootAsHookContract
>({ name: 'as-number-field-root', setup });
export default definePrototype({ name: 'base-number-field-root', setup });
