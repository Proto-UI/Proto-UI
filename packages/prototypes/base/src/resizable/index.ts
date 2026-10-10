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
import { resizeValue } from './model';
export * from './model';
export interface ResizableRootProps {
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  collapsible?: boolean;
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
    panel: { cardinality: { min: 2, max: 2 } },
    handle: { cardinality: { min: 1, max: 1 } },
  },
});
type Context = {
  value: number;
  min: number;
  max: number;
  step: number;
  collapsible: boolean;
  disabled: boolean;
  readOnly: boolean;
  orientation: 'horizontal' | 'vertical';
  direction: 'ltr' | 'rtl';
};
export const RESIZABLE_CONTEXT = createContextKey<Context>('base-resizable');
const initial: Context = {
  value: 50,
  min: 10,
  max: 90,
  step: 1,
  collapsible: false,
  disabled: false,
  readOnly: false,
  orientation: 'horizontal',
  direction: 'ltr',
};
function setupRoot(def: DefHandle<ResizableRootProps, any>) {
  def.anatomy.claim(RESIZABLE_FAMILY, { role: 'root' });
  def.context.provide(RESIZABLE_CONTEXT, initial);
  def.context.subscribe(RESIZABLE_CONTEXT);
  def.props.define({
    value: { type: 'number' },
    defaultValue: { type: 'number' },
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
  const value = def.state.numberRange('value', 50, { min: 0, max: 100 }),
    orientation = def.state.string('orientation', 'horizontal');
  def.expose.state('value', value);
  def.expose.event('valueChange', { payload: 'json' });
  def.expose.event('valueCommit', { payload: 'json' });
  def.feedback.style.use(tw('flex min-w-0 min-h-0'));
  def.rule({
    when: (w) => w.state(orientation).eq('vertical'),
    intent: (i) => i.feedback.style.use(tw('flex-col')),
  });
  let owner: RunHandle<ResizableRootProps> | null = null;
  const publish = (run: RunHandle<ResizableRootProps>) => {
    const p = run.props.get();
    orientation.set(p.orientation ?? 'horizontal', 'resize orientation');
    run.context.update(RESIZABLE_CONTEXT, {
      value: value.get(),
      min: resizeValue(0, p.min, p.max),
      max: resizeValue(100, p.min, p.max),
      step: Math.max(0.01, Number.isFinite(p.step) ? p.step! : 1),
      collapsible: !!p.collapsible,
      disabled: !!p.disabled,
      readOnly: !!p.readOnly,
      orientation: p.orientation ?? 'horizontal',
      direction: p.direction ?? 'ltr',
    });
  };
  def.expose.method('requestValue', (next: number, commit = false) => {
    if (!owner) return false;
    const p = owner.props.get();
    if (p.disabled || p.readOnly || !Number.isFinite(next)) return false;
    next = resizeValue(next, p.min, p.max, p.collapsible);
    if (next !== value.get()) {
      if (!owner.props.isProvided('value')) value.set(next, 'resize request');
      publish(owner);
      owner.expose.emit('valueChange', { value: next });
    }
    if (commit) owner.expose.emit('valueCommit', { value: next });
    return true;
  });
  const sync = (run: RunHandle<ResizableRootProps>, created = false) => {
    owner = run;
    const p = run.props.get();
    if (created || run.props.isProvided('value'))
      value.set(
        resizeValue(
          (run.props.isProvided('value') ? p.value : p.defaultValue) ?? 50,
          p.min,
          p.max,
          p.collapsible
        ),
        'resize owner'
      );
    else value.set(resizeValue(value.get(), p.min, p.max, p.collapsible), 'resize constraints');
    publish(run);
  };
  def.lifecycle.onCreated((run) => sync(run, true));
  def.lifecycle.onMounted((run) => sync(run));
  def.props.watchAll((run) => sync(run));
  def.lifecycle.onUnmounted(() => {
    owner = null;
  });
}
export const asResizableRoot = defineAsHook({ name: 'as-resizable-root', setup: setupRoot });
export const resizableRoot = definePrototype({ name: 'base-resizable-root', setup: setupRoot });
function setupPanel(def: DefHandle<ResizablePanelProps, any>) {
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
    const next = run.props.get().index === 1 ? 100 - c.value : c.value;
    size.set(next, 'resize panel ratio');
  };
  def.context.subscribe(RESIZABLE_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  def.props.watchAll(sync);
}
export const asResizablePanel = defineAsHook({ name: 'as-resizable-panel', setup: setupPanel });
export const resizablePanel = definePrototype({ name: 'base-resizable-panel', setup: setupPanel });
function setupHandle(def: DefHandle<Record<string, never>, any>) {
  def.anatomy.claim(RESIZABLE_FAMILY, { role: 'handle' });
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
  input.configure({ anatomy: RESIZABLE_FAMILY, inputRole: 'handle', geometryRole: 'root' });
  let start = 50;
  input.on((run, sample) => {
    if (sample.phase === 'cancel') return;
    const c = run.context.read(RESIZABLE_CONTEXT);
    if (sample.phase === 'start') start = c.value;
    callOwner(
      run,
      RESIZABLE_FAMILY,
      'requestValue',
      start + sample.totalDelta * 100,
      sample.phase === 'end'
    );
  });
  const sync = (run: RunHandle<any>) => {
    const c = run.context.read(RESIZABLE_CONTEXT);
    value.set(c.value, 'resize handle value');
    min.set(c.collapsible ? 0 : c.min, 'resize minimum');
    max.set(c.max, 'resize maximum');
    orientation.set(
      c.orientation === 'horizontal' ? 'vertical' : 'horizontal',
      'separator perpendicular axis'
    );
    disabled.set(c.disabled, 'resize disabled');
    focus.setDisabled(c.disabled);
    input.sync({
      axis: c.orientation,
      direction: c.direction,
      disabled: c.disabled,
      readOnly: c.readOnly,
    });
  };
  def.context.subscribe(RESIZABLE_CONTEXT, sync);
  def.lifecycle.onMounted(sync);
  def.event.on('key.down', (run, e) => {
    const c = run.context.read(RESIZABLE_CONTEXT);
    if (!focus.focused.get() || c.disabled || c.readOnly || e.altKey || e.ctrlKey || e.metaKey)
      return;
    let next: number | undefined;
    const step = c.step * (e.shiftKey ? 10 : 1);
    if (e.key === 'Home') next = c.collapsible ? 0 : c.min;
    if (e.key === 'End') next = c.max;
    if (e.key === 'Enter' && c.collapsible) next = c.value === 0 ? c.min : 0;
    if (c.orientation === 'horizontal') {
      if (e.key === 'ArrowRight') next = c.value + step * (c.direction === 'rtl' ? -1 : 1);
      if (e.key === 'ArrowLeft') next = c.value - step * (c.direction === 'rtl' ? -1 : 1);
    } else {
      if (e.key === 'ArrowDown') next = c.value + step;
      if (e.key === 'ArrowUp') next = c.value - step;
    }
    if (next === undefined) return;
    e.control.requestDefaultActionPrevention({
      reason: 'resizable.keyboard',
      source: 'base-resizable-handle',
    });
    callOwner(run, RESIZABLE_FAMILY, 'requestValue', next, true);
  });
}
export const asResizableHandle = defineAsHook({ name: 'as-resizable-handle', setup: setupHandle });
export const resizableHandle = definePrototype({
  name: 'base-resizable-handle',
  setup: setupHandle,
});
