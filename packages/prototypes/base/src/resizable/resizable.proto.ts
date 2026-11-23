import type {
  ResizableRootExposes,
  ResizablePanelExposes,
  ResizableHandleProps,
  ResizableHandleExposes,
  ResizableRootAsHookContract,
  ResizablePanelAsHookContract,
  ResizableHandleAsHookContract,
} from './types';
export type * from './types';
import {
  createAnatomyFamily,
  createContextKey,
  defineAsHook,
  definePrototype,
  tw,
  type DefHandle,
  type RunHandle,
} from '@proto.ui/core';
import { asAccessible, asFocusable, asAxisInput } from '@proto.ui/hooks';
import { callOwner } from '../collection-controls/shared';
import {
  resizeValue,
  resizableConstraints,
  normalizeResizableSizes,
  resizeAdjacentPanels,
  resizableBoundaryBounds,
  type ResizablePanelConstraint,
  type ResizableConstraint,
} from './model';
export * from './model';
export interface ResizableRootProps {
  /** Legacy two-panel first percentage. sizes takes precedence when supplied. */
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  collapsible?: boolean;
  /** Complete ordered percentages; supplied sizes is controlled. */
  sizes?: readonly number[];
  defaultSizes?: readonly number[];
  constraints?: readonly ResizablePanelConstraint[];
  disabled?: boolean;
  readOnly?: boolean;
  orientation?: 'horizontal' | 'vertical';
  direction?: 'ltr' | 'rtl';
}
export interface ResizablePanelProps {
  index?: number;
}
export const RESIZABLE_FAMILY = createAnatomyFamily('base-resizable', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    panel: { cardinality: { min: 2, max: '*' } },
    handle: { cardinality: { min: 1, max: '*' } },
  },
});
type Context = {
  value: number;
  sizes: number[];
  constraints: ResizableConstraint[];
  min: number;
  max: number;
  step: number;
  collapsible: boolean;
  valid: boolean;
  disabled: boolean;
  readOnly: boolean;
  orientation: 'horizontal' | 'vertical';
  direction: 'ltr' | 'rtl';
};
export const RESIZABLE_CONTEXT = createContextKey<Context>('base-resizable');
const initial: Context = {
  value: 50,
  sizes: [50, 50],
  constraints: [
    ...resizableConstraints(2, [
      { min: 10, max: 90 },
      { min: 10, max: 90 },
    ])!,
  ],
  min: 10,
  max: 90,
  step: 1,
  collapsible: false,
  valid: true,
  disabled: false,
  readOnly: false,
  orientation: 'horizontal',
  direction: 'ltr',
};
const sameSizes = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((value, i) => value === b[i]);

function setupRoot(def: DefHandle<ResizableRootProps, ResizableRootExposes>) {
  def.anatomy.claim(RESIZABLE_FAMILY, { role: 'root' });
  def.context.provide(RESIZABLE_CONTEXT, initial);
  def.context.subscribe(RESIZABLE_CONTEXT);
  def.props.define({
    value: { type: 'number' },
    defaultValue: { type: 'number' },
    sizes: { type: 'any' },
    defaultSizes: { type: 'any' },
    constraints: { type: 'any' },
    min: { type: 'number' },
    max: { type: 'number' },
    step: { type: 'number' },
    collapsible: { type: 'boolean' },
    disabled: { type: 'boolean' },
    readOnly: { type: 'boolean' },
    orientation: { type: 'enum', options: ['horizontal', 'vertical'] },
    direction: { type: 'enum', options: ['ltr', 'rtl'] },
  });
  def.props.setDefaults({
    constraints: [],
    defaultValue: 50,
    min: 10,
    max: 90,
    step: 1,
    collapsible: false,
    disabled: false,
    readOnly: false,
    orientation: 'horizontal',
    direction: 'ltr',
  });
  const value = def.state.numberRange('value', 50, { min: 0, max: 100 });
  const sizes = def.state.numberList('sizes', [50, 50]);
  const orientation = def.state.string('orientation', 'horizontal');
  const direction = def.state.string('direction', 'ltr');
  def.expose.state('value', value);
  def.expose.state('sizes', sizes);
  for (const name of ['valueChange', 'valueCommit', 'sizesChange', 'sizesCommit'] as const)
    def.expose.event(name, { payload: 'json' });
  def.feedback.style.use(tw('flex min-w-0 min-h-0'));
  def.rule({
    when: (w) => w.state(orientation).eq('vertical'),
    intent: (i) => i.feedback.style.use(tw('flex-col')),
  });
  def.rule({
    when: (w) => w.state(direction).eq('rtl'),
    intent: (i) => i.feedback.style.use(tw('direction-rtl')),
  });
  def.rule({
    when: (w) => w.state(direction).eq('ltr'),
    intent: (i) => i.feedback.style.use(tw('direction-ltr')),
  });
  let owner: RunHandle<ResizableRootProps> | null = null;
  // Detached props still synchronize logical state; they cannot reacquire a
  // retired view command lease. Only the next mounted lifecycle does that.
  let viewRetired = false;
  let ownerEpoch = 0,
    requestRevision = 0,
    projectionRevision = 0,
    syncRevision = 0,
    completionRevision = 0;
  // One canonical vector backs both public projections. Set it before notifying
  // either State: a synchronous subscriber may update props or issue a request.
  let canonical: readonly number[] = Object.freeze([50, 50]);
  let proposal: readonly number[] | undefined;
  let ownerInputs: string | null = null;
  let ownerConfiguration: string | null = null;
  let constraints: readonly ResizableConstraint[] = initial.constraints;
  let valid = true;
  const isCurrent = (run: RunHandle<ResizableRootProps>, epoch: number) =>
    owner === run && ownerEpoch === epoch;
  const vectorMode = (run: RunHandle<ResizableRootProps>) =>
    run.props.isProvided('sizes') || run.props.isProvided('defaultSizes');
  const controlled = (run: RunHandle<ResizableRootProps>) =>
    run.props.isProvided('sizes') || (!vectorMode(run) && run.props.isProvided('value'));
  const clearProposal = () => {
    proposal = undefined;
    requestRevision++;
    completionRevision++;
  };
  const project = (
    run: RunHandle<ResizableRootProps>,
    epoch: number,
    next: readonly number[],
    reason: string
  ) => {
    const revision = ++projectionRevision;
    canonical = next;
    value.set(next[0], reason);
    if (!isCurrent(run, epoch) || revision !== projectionRevision) return false;
    sizes.set(next, reason);
    return isCurrent(run, epoch) && revision === projectionRevision;
  };
  const publish = (run: RunHandle<ResizableRootProps>, epoch: number) => {
    if (!isCurrent(run, epoch)) return;
    const revision = projectionRevision;
    const p = run.props.get();
    orientation.set(p.orientation ?? 'horizontal', 'resize orientation');
    if (!isCurrent(run, epoch) || revision !== projectionRevision) return;
    direction.set(p.direction ?? 'ltr', 'resize direction');
    if (!isCurrent(run, epoch) || revision !== projectionRevision) return;
    run.context.update(RESIZABLE_CONTEXT, {
      value: canonical[0],
      sizes: [...canonical],
      constraints: [...constraints],
      min: constraints[0].min,
      max: constraints[0].max,
      step: Math.max(0.01, Number.isFinite(p.step) ? p.step! : 1),
      collapsible: constraints[0].collapsible,
      valid,
      disabled: !!p.disabled,
      readOnly: !!p.readOnly,
      orientation: p.orientation ?? 'horizontal',
      direction: p.direction ?? 'ltr',
    });
  };
  const request = (next: readonly number[], commit: boolean, scalar: boolean) => {
    if (!owner || viewRetired || !valid) return false;
    const run = owner,
      epoch = ownerEpoch,
      p = run.props.get();
    if (p.disabled || p.readOnly) return false;
    const changed = !sameSizes(next, proposal ?? canonical);
    const revision = ++requestRevision;
    const completion = completionRevision;
    proposal = next;
    if (changed) {
      if (!controlled(run)) {
        project(run, epoch, next, 'resize group request');
      }
      if (isCurrent(run, epoch) && revision === requestRevision) publish(run, epoch);
      if (isCurrent(run, epoch) && revision === requestRevision)
        run.expose.emit('sizesChange', { sizes: [...next] });
      if (scalar && isCurrent(run, epoch) && revision === requestRevision)
        run.expose.emit('valueChange', { value: next[0] });
    }
    // Preserve the legacy outer commit when a listener only proposes a later
    // value. A completed or cancelled nested interaction retires that terminal
    // delivery, including its scalar event after sizesCommit reentry.
    if (commit && isCurrent(run, epoch) && completion === completionRevision) {
      if (revision === requestRevision) proposal = undefined;
      const terminal = ++completionRevision;
      run.expose.emit('sizesCommit', { sizes: [...next] });
      if (scalar && isCurrent(run, epoch) && terminal === completionRevision)
        run.expose.emit('valueCommit', { value: next[0] });
    }
    return true;
  };
  const requestResize = (index: number, next: number, commit = false) => {
    if (!owner || viewRetired || !valid) return false;
    // Legacy normalization retains its two-decimal public ratio behavior.
    if (!vectorMode(owner) && index === 0) {
      const p = owner.props.get();
      if (!Number.isFinite(next)) return false;
      next = resizeValue(next, p.min, p.max, p.collapsible);
    }
    const candidate = resizeAdjacentPanels(canonical, constraints, index, next);
    return candidate ? request(candidate, commit, index === 0) : false;
  };
  def.expose.method('requestValue', (next: number, commit = false) =>
    requestResize(0, next, commit)
  );
  def.expose.method('requestResize', requestResize);
  def.expose.method('requestSizes', (next: readonly number[], commit = false) => {
    const candidate = normalizeResizableSizes(next, constraints);
    return candidate ? request(candidate, commit, true) : false;
  });
  def.expose.method('cancelResize', () => {
    if (!owner || viewRetired) return false;
    clearProposal();
    return true;
  });
  const sync = (run: RunHandle<ResizableRootProps>, created = false) => {
    owner = run;
    const serial = ++syncRevision;
    const epoch = ownerEpoch,
      p = run.props.get();
    const inputs = JSON.stringify([
      run.props.isProvided('value'),
      run.props.isProvided('sizes'),
      vectorMode(run),
      p.value,
      p.sizes,
      p.constraints,
      p.min,
      p.max,
      p.collapsible,
      p.disabled,
      p.readOnly,
    ]);
    let candidate: readonly number[] | null = null;
    let nextConstraints: readonly ResizableConstraint[] | null;
    if (vectorMode(run)) {
      const desired = run.props.isProvided('sizes')
        ? p.sizes
        : created
          ? p.defaultSizes
          : canonical;
      nextConstraints = Array.isArray(desired)
        ? resizableConstraints(desired.length, p.constraints)
        : null;
      candidate =
        desired && nextConstraints ? normalizeResizableSizes(desired, nextConstraints) : null;
    } else {
      const first = resizeValue(
        (created || run.props.isProvided('value')
          ? run.props.isProvided('value')
            ? p.value
            : p.defaultValue
          : canonical[0]) ?? 50,
        p.min,
        p.max,
        p.collapsible
      );
      const low = resizeValue(0, p.min, p.max),
        high = resizeValue(100, p.min, p.max);
      nextConstraints = resizableConstraints(2, [
        { min: low, max: high, collapsible: !!p.collapsible },
        { min: 100 - high, max: p.collapsible ? 100 : 100 - low },
      ]);
      candidate = Object.freeze([first, 100 - first]);
    }
    valid = !!candidate && !!nextConstraints;
    const configuration = JSON.stringify([
      run.props.isProvided('value'),
      run.props.isProvided('sizes'),
      vectorMode(run),
      candidate?.length,
      nextConstraints,
      p.disabled,
      p.readOnly,
    ]);
    // Synchronous owner acceptance of this exact proposal does not retire the
    // interaction before its commit. A new request or changed policy still does.
    if (
      configuration !== ownerConfiguration ||
      (inputs !== ownerInputs && (!proposal || !candidate || !sameSizes(proposal, candidate)))
    )
      clearProposal();
    ownerInputs = inputs;
    ownerConfiguration = configuration;
    if (candidate && nextConstraints) {
      constraints = nextConstraints;
      if (!project(run, epoch, candidate, 'resize group owner')) return;
    }
    if (!isCurrent(run, epoch) || serial !== syncRevision) return;
    publish(run, epoch);
  };
  def.lifecycle.onCreated((run) => sync(run, true));
  def.lifecycle.onMounted((run) => {
    viewRetired = false;
    sync(run);
  });
  def.props.watchAll((run) => sync(run));
  def.lifecycle.onUnmounted(() => {
    viewRetired = true;
    owner = null;
    ownerEpoch++;
    clearProposal();
  });
}
export const asResizableRoot = defineAsHook<
  ResizableRootProps,
  ResizableRootExposes,
  ResizableRootAsHookContract
>({ name: 'as-resizable-root', setup: setupRoot });
export const resizableRoot = definePrototype({ name: 'base-resizable-root', setup: setupRoot });
function setupPanel(def: DefHandle<ResizablePanelProps, ResizablePanelExposes>) {
  def.anatomy.claim(RESIZABLE_FAMILY, { role: 'panel' });
  def.props.define({ index: { type: 'number' } });
  def.props.setDefaults({ index: 0 });
  const size = def.state.numberRange('size', 50, { min: 0, max: 100 });
  def.expose.state('size', size);
  def.feedback.style.use(
    tw('min-w-0 min-h-0 overflow-auto shrink grow-0 basis-[calc(var(--pui-size)*1%)]')
  );
  const sync = (run: RunHandle<ResizablePanelProps>) => {
    const c = run.context.read(RESIZABLE_CONTEXT);
    size.set(c.sizes[run.props.get().index ?? 0] ?? 0, 'resize panel ratio');
  };
  def.context.subscribe(RESIZABLE_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  def.props.watchAll(sync);
}
export const asResizablePanel = defineAsHook<
  ResizablePanelProps,
  ResizablePanelExposes,
  ResizablePanelAsHookContract
>({ name: 'as-resizable-panel', setup: setupPanel });
export const resizablePanel = definePrototype({ name: 'base-resizable-panel', setup: setupPanel });
function setupHandle(def: DefHandle<ResizableHandleProps, ResizableHandleExposes>) {
  def.anatomy.claim(RESIZABLE_FAMILY, { role: 'handle' });
  def.props.define({ index: { type: 'number' } });
  def.props.setDefaults({ index: 0 });
  const focus = asFocusable();
  focus.configure({ disabled: false });
  const value = def.state.numberRange('value', 50, { min: 0, max: 100 }),
    min = def.state.numberRange('min', 10, { min: 0, max: 100 }),
    max = def.state.numberRange('max', 90, { min: 0, max: 100 }),
    orientation = def.state.string('orientation', 'vertical'),
    disabled = def.state.bool('disabled', false);
  const a = asAccessible();
  a.role('separator');
  a.name('Resize panels');
  a.state('valueNow', value);
  a.state('valueMin', min);
  a.state('valueMax', max);
  a.state('orientation', orientation);
  a.state('disabled', disabled);
  def.expose.state('value', value);
  def.expose.state('focusVisible', focus.focusVisible);
  def.expose.state('disabled', disabled);
  const input = asAxisInput();
  input.configure({
    anatomy: RESIZABLE_FAMILY,
    inputRole: 'handle',
    geometryRole: 'root',
    deltaBasisRole: 'panel',
  });
  let contact: {
    index: number;
    start: number;
    key: string;
    cancel: (() => unknown) | null;
  } | null = null;
  const contactKey = (c: Context, index: number) =>
    JSON.stringify([
      index,
      c.sizes.length,
      c.constraints,
      c.orientation,
      c.direction,
      c.disabled,
      c.readOnly,
      c.valid,
    ]);
  input.on((run, sample) => {
    if (sample.phase === 'cancel') {
      const active = contact;
      contact = null;
      active?.cancel?.();
      return;
    }
    const c = run.context.read(RESIZABLE_CONTEXT),
      index = run.props.get().index ?? 0;
    const key = contactKey(c, index);
    if (sample.phase === 'start') {
      const cancel = run.anatomy.partsOf(RESIZABLE_FAMILY, 'root')[0]?.getExpose('cancelResize');
      contact = resizableBoundaryBounds(c.sizes, c.constraints, index)
        ? {
            index,
            start: c.sizes[index],
            key,
            cancel: typeof cancel === 'function' ? () => cancel() : null,
          }
        : null;
      return;
    }
    const active = contact;
    if (!active || active.key !== key) return;
    if (sample.phase === 'end') contact = null;
    callOwner(
      run,
      RESIZABLE_FAMILY,
      'requestResize',
      active.index,
      active.start + sample.totalDelta * 100,
      sample.phase === 'end'
    );
  });
  const sync = (run: RunHandle<ResizableHandleProps>) => {
    const c = run.context.read(RESIZABLE_CONTEXT),
      index = run.props.get().index ?? 0;
    const bounds = resizableBoundaryBounds(c.sizes, c.constraints, index);
    const blocked = c.disabled || !c.valid || !bounds;
    if (contact && contact.key !== contactKey(c, index)) {
      const active = contact;
      contact = null;
      active.cancel?.();
    }
    value.set(c.sizes[index] ?? 0, 'resize handle value');
    min.set(bounds?.[0] ?? 0, 'resize minimum');
    max.set(bounds?.[1] ?? 100, 'resize maximum');
    orientation.set(
      c.orientation === 'horizontal' ? 'vertical' : 'horizontal',
      'separator perpendicular axis'
    );
    disabled.set(!!blocked, 'resize disabled');
    focus.setDisabled(!!blocked);
    input.sync({
      axis: c.orientation,
      direction: c.direction,
      disabled: !!blocked,
      readOnly: c.readOnly,
      contactBasis: 'cancel-on-extent-change',
    });
  };
  def.context.subscribe(RESIZABLE_CONTEXT, sync);
  def.lifecycle.onMounted(sync);
  def.props.watchAll(sync);
  def.lifecycle.onUnmounted(() => {
    const active = contact;
    contact = null;
    active?.cancel?.();
  });
  def.event.on('key.down', (run, e) => {
    const c = run.context.read(RESIZABLE_CONTEXT),
      index = run.props.get().index ?? 0;
    const bounds = resizableBoundaryBounds(c.sizes, c.constraints, index);
    if (
      !focus.focused.get() ||
      c.disabled ||
      c.readOnly ||
      !c.valid ||
      !bounds ||
      e.altKey ||
      e.ctrlKey ||
      e.metaKey
    )
      return;
    let next: number | undefined;
    const current = c.sizes[index],
      constraint = c.constraints[index],
      step = c.step * (e.shiftKey ? 10 : 1);
    if (e.key === 'Home') next = bounds[0];
    if (e.key === 'End') next = bounds[1];
    if (e.key === 'Enter' && constraint.collapsible)
      next = current === constraint.collapsedSize ? constraint.min : constraint.collapsedSize;
    if (c.orientation === 'horizontal') {
      if (e.key === 'ArrowRight') next = current + step * (c.direction === 'rtl' ? -1 : 1);
      if (e.key === 'ArrowLeft') next = current - step * (c.direction === 'rtl' ? -1 : 1);
    } else {
      if (e.key === 'ArrowDown') next = current + step;
      if (e.key === 'ArrowUp') next = current - step;
    }
    if (next === undefined) return;
    e.control.requestDefaultActionPrevention({
      reason: 'resizable.keyboard',
      source: 'base-resizable-handle',
    });
    callOwner(run, RESIZABLE_FAMILY, 'requestResize', index, next, true);
  });
}
export const asResizableHandle = defineAsHook<
  ResizableHandleProps,
  ResizableHandleExposes,
  ResizableHandleAsHookContract
>({ name: 'as-resizable-handle', setup: setupHandle });
export const resizableHandle = definePrototype({
  name: 'base-resizable-handle',
  setup: setupHandle,
});
