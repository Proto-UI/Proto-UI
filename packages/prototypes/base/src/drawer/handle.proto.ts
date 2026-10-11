import { defineAsHook, definePrototype, tw, type DefHandle, type RunHandle } from '@proto.ui/core';
import { asAccessible, asAxisInput, asFocusable } from '@proto.ui/hooks';
import {
  DRAWER_CONTENT_CONTEXT,
  DRAWER_CONTEXT,
  DRAWER_FAMILY,
  createDrawerPartId,
  requestDrawerOpen,
} from './shared';
import type { DrawerHandleProps, DrawerHandleExposes, DrawerHandleAsHookContract } from './types';

function contentMethod(run: RunHandle<DrawerHandleProps>, name: string, ...args: unknown[]) {
  try {
    const method = run.anatomy.partsOf(DRAWER_FAMILY, 'content')[0]?.getExpose(name);
    if (typeof method === 'function') method(...args);
  } catch (error) {
    if (
      ['ANATOMY_CLAIM_INVALID', 'CONTEXT_DISCONNECTED'].includes(
        (error as { code?: string }).code ?? ''
      )
    )
      return;
    throw error;
  }
}
function setup(def: DefHandle<DrawerHandleProps, DrawerHandleExposes>) {
  def.anatomy.claim(DRAWER_FAMILY, { role: 'handle' });
  def.context.subscribe(DRAWER_CONTEXT);
  def.props.define({
    disabled: { type: 'boolean', empty: 'fallback' },
    a11yLabel: { type: 'string', empty: 'fallback' },
  });
  def.props.setDefaults({ disabled: false, a11yLabel: 'Resize drawer' });
  const focus = asFocusable<DrawerHandleProps>();
  focus.configure({ disabled: false });
  const disabled = def.state.bool('disabled', false);
  const label = def.state.string('label', 'Resize drawer');
  const value = def.state.numberRange('valueNow', 100, { min: 0, max: 100 });
  const min = def.state.numberRange('valueMin', 0, { min: 0, max: 100 });
  const max = def.state.numberRange('valueMax', 100, { min: 0, max: 100 });
  const orientation = def.state.string('orientation', 'horizontal');
  const controlled = def.state.string('controls', '');
  const side = def.state.string('side', 'bottom');
  const a11y = asAccessible();
  a11y.role('separator');
  a11y.name(label);
  a11y.state('valueNow', value);
  a11y.state('valueMin', min);
  a11y.state('valueMax', max);
  a11y.state('orientation', orientation);
  a11y.state('disabled', disabled);
  a11y.relation('controls', { target: controlled });
  def.expose.state('disabled', disabled);
  def.expose.state('focused', focus.focused);
  def.expose.state('focusVisible', focus.focusVisible);
  def.expose.method('focusSelf', (options) => {
    if (!disabled.get()) focus.focusSelf(options);
  });
  const input = asAxisInput<DrawerHandleProps>();
  input.configure({ anatomy: DRAWER_FAMILY, inputRole: 'handle', geometryRole: 'content' });
  const sync = (run: RunHandle<DrawerHandleProps>) => {
    const c = run.context.read(DRAWER_CONTENT_CONTEXT);
    const off = !c.open || c.disabled || !!run.props.get().disabled;
    disabled.set(off, 'reason: drawer handle policy');
    focus.setDisabled(off);
    label.set(run.props.get().a11yLabel ?? 'Resize drawer', 'reason: drawer handle label');
    value.set(c.snapPoint * 100, 'reason: drawer handle size');
    min.set(c.dismissible ? 0 : c.snapPoints[0] * 100, 'reason: drawer handle minimum');
    max.set(c.snapPoints[c.snapPoints.length - 1] * 100, 'reason: drawer handle maximum');
    const horizontal = c.side === 'left' || c.side === 'right';
    orientation.set(horizontal ? 'vertical' : 'horizontal', 'reason: drawer handle cross axis');
    side.set(c.side, 'reason: drawer handle edge');
    controlled.set(
      createDrawerPartId(run.context.read(DRAWER_CONTEXT).rootId, 'content'),
      'reason: drawer handle control'
    );
    input.sync({
      axis: horizontal ? 'horizontal' : 'vertical',
      direction: 'ltr',
      disabled: off,
      readOnly: false,
      reverse: c.side === 'bottom' || c.side === 'right',
    });
  };
  def.context.subscribe(DRAWER_CONTENT_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  def.lifecycle.onMounted(sync);
  def.props.watch(['disabled', 'a11yLabel'], sync);
  input.on((run, sample) => {
    if (sample.phase === 'start') focus.focusSelf({ reason: 'pointer' });
    contentMethod(run, '__onAxisInput', sample);
  });
  def.event.onGlobal('key.down', (run, event) => {
    if (!focus.focused.get() || disabled.get() || event.altKey || event.ctrlKey || event.metaKey)
      return;
    const c = run.context.read(DRAWER_CONTENT_CONTEXT);
    const index = c.snapPoints.indexOf(c.snapPoint);
    const expandKey = {
      bottom: 'ArrowUp',
      top: 'ArrowDown',
      left: 'ArrowRight',
      right: 'ArrowLeft',
    }[c.side];
    const collapseKey = {
      bottom: 'ArrowDown',
      top: 'ArrowUp',
      left: 'ArrowLeft',
      right: 'ArrowRight',
    }[c.side];
    let next: number | undefined;
    if (event.key === 'Home') next = c.snapPoints[0];
    else if (event.key === 'End') next = c.snapPoints[c.snapPoints.length - 1];
    else if (event.key === expandKey)
      next = c.snapPoints[Math.min(c.snapPoints.length - 1, index + 1)];
    else if (event.key === collapseKey)
      next = index > 0 ? c.snapPoints[index - 1] : c.dismissible ? 0 : c.snapPoints[0];
    else return;
    event.control.requestDefaultActionPrevention({
      reason: 'drawer.handle.keyboard',
      source: 'base-drawer-handle',
    });
    if (next === 0) requestDrawerOpen(run, false, 'handle.dismiss', 'keyboard');
    else contentMethod(run, 'requestSnapPoint', next, 'keyboard');
  });
  // Keep the grab target at the visible inward edge at every snap extent.
  def.feedback.style.use(tw('absolute z-10 select-none rounded-full'));
  def.rule({
    when: (w) => w.state(focus.focusVisible).eq(true),
    intent: (i) => i.feedback.style.use(tw('ring-2')),
  });
  def.rule({
    when: (w) => w.state(side).eq('bottom'),
    intent: (i) =>
      i.feedback.style.use(tw('top-1 left-1/2 -translate-x-1/2 h-2 w-12 cursor-ns-resize')),
  });
  def.rule({
    when: (w) => w.state(side).eq('top'),
    intent: (i) =>
      i.feedback.style.use(tw('bottom-1 left-1/2 -translate-x-1/2 h-2 w-12 cursor-ns-resize')),
  });
  def.rule({
    when: (w) => w.state(side).eq('left'),
    intent: (i) =>
      i.feedback.style.use(tw('right-1 top-1/2 -translate-y-1/2 h-12 w-2 cursor-ew-resize')),
  });
  def.rule({
    when: (w) => w.state(side).eq('right'),
    intent: (i) =>
      i.feedback.style.use(tw('left-1 top-1/2 -translate-y-1/2 h-12 w-2 cursor-ew-resize')),
  });
}
export const asDrawerHandle = defineAsHook<
  DrawerHandleProps,
  DrawerHandleExposes,
  DrawerHandleAsHookContract
>({ name: 'as-drawer-handle', setup });
export default definePrototype<DrawerHandleProps, DrawerHandleExposes>({
  name: 'base-drawer-handle',
  setup,
});
