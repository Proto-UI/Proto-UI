import {
  tw,
  type AxisInputSample,
  type DefHandle,
  type RunHandle,
  type State,
} from '@proto.ui/core';
import { DRAWER_CONTEXT, DRAWER_CONTENT_CONTEXT, requestDrawerOpen } from './shared';
import type { DrawerContentProps, DrawerContentExposes } from './types';

export function drawerSnapPoints(input: readonly number[] | undefined): number[] {
  const points = Array.isArray(input)
    ? [...new Set(input.filter((point) => Number.isFinite(point) && point > 0 && point <= 1))]
    : [];
  return points.length ? points.sort((a, b) => a - b) : [1];
}
function nearest(points: number[], value: number): number {
  const finite = Number.isFinite(value) ? value : points[points.length - 1];
  // Equal distances prefer the more open point, avoiding accidental dismissal.
  return points.reduce((best, point) =>
    Math.abs(point - finite) <= Math.abs(best - finite) ? point : best
  );
}

/** Owns logical panel extent; the Handle only delivers dimensionless input. */
export function setupDrawerSnap(
  def: DefHandle<DrawerContentProps, DrawerContentExposes>,
  side: State<string>
) {
  def.props.define({
    snapPoints: { type: 'object', empty: 'fallback' },
    snapPoint: { type: 'number', empty: 'fallback' },
    defaultSnapPoint: { type: 'number', empty: 'fallback' },
    dragDismissible: { type: 'boolean', empty: 'fallback' },
    dragDismissThreshold: { type: 'number', empty: 'fallback' },
  });
  def.props.setDefaults({ dragDismissible: true, dragDismissThreshold: 0.25 });
  const snapPoint = def.state.numberRange('snapPoint', 1, { min: 0, max: 1, clamp: true });
  const dragProgress = def.state.numberRange('dragProgress', 1, { min: 0, max: 1, clamp: true });
  const dragging = def.state.bool('dragging', false);
  const offsetPercentage = def.state.numberRange('offsetPercentage', 0, {
    min: 0,
    max: 100,
    clamp: true,
  });
  def.expose.state('offsetPercentage', offsetPercentage);
  def.expose.state('snapPoint', snapPoint);
  def.expose.state('dragProgress', dragProgress);
  def.expose.state('dragging', dragging);
  def.expose.event('snapPointChange', { payload: 'json' });
  def.context.provide(DRAWER_CONTENT_CONTEXT, {
    side: 'bottom',
    open: false,
    disabled: false,
    snapPoint: 1,
    snapPoints: [1],
    dismissible: true,
  });
  def.feedback.style.use(tw('translate-x-0 translate-y-0'));
  def.rule({
    when: (w) => w.state(side).eq('bottom'),
    intent: (i) => i.feedback.style.use(tw('translate-y-[calc(var(--pui-offset-percentage)*1%)]')),
  });
  def.rule({
    when: (w) => w.state(side).eq('top'),
    intent: (i) => i.feedback.style.use(tw('translate-y-[calc(var(--pui-offset-percentage)*-1%)]')),
  });
  def.rule({
    when: (w) => w.state(side).eq('left'),
    intent: (i) => i.feedback.style.use(tw('translate-x-[calc(var(--pui-offset-percentage)*-1%)]')),
  });
  def.rule({
    when: (w) => w.state(side).eq('right'),
    intent: (i) => i.feedback.style.use(tw('translate-x-[calc(var(--pui-offset-percentage)*1%)]')),
  });
  let currentRun: RunHandle<DrawerContentProps> | null = null;
  let points = [1];
  let start = 1;
  let rootOpen = false;
  let rootDisabled = false;
  const render = (run: RunHandle<DrawerContentProps>) => {
    const edge = side.get();
    const offset = Math.round((1 - dragProgress.get()) * 100000) / 1000;
    offsetPercentage.set(offset, 'reason: drawer continuous percentage projection');
    run.context.update(DRAWER_CONTENT_CONTEXT, {
      side: edge as 'top' | 'right' | 'bottom' | 'left',
      open: rootOpen,
      disabled: rootDisabled,
      snapPoint: snapPoint.get(),
      snapPoints: points,
      dismissible: run.props.get().dragDismissible !== false,
    });
  };
  const cancel = () => {
    dragging.set(false, 'reason: drawer drag cancelled');
    dragProgress.set(snapPoint.get(), 'reason: drawer return to owner extent');
    if (currentRun) render(currentRun);
  };
  const request = (next: number, reason: string) => {
    const run = currentRun;
    if (!run || !rootOpen || rootDisabled) return;
    const value = nearest(points, next);
    if (value === snapPoint.get()) return;
    if (!run.props.isProvided('snapPoint')) snapPoint.set(value, 'reason: drawer snap request');
    dragProgress.set(snapPoint.get(), 'reason: drawer snap owner projection');
    render(run);
    run.expose.emit('snapPointChange', { snapPoint: value, reason });
  };
  def.expose.method('requestSnapPoint', (next, reason = 'programmatic') => request(next, reason));
  def.expose.method('__onAxisInput', (sample: AxisInputSample) => {
    const run = currentRun;
    if (!run) return;
    if (sample.phase === 'cancel') {
      cancel();
      return;
    }
    if (!rootOpen || rootDisabled) {
      cancel();
      return;
    }
    if (sample.phase === 'start') {
      start = snapPoint.get();
      dragging.set(true, 'reason: drawer drag start');
    }
    if (!dragging.get()) return;
    const lowerBound = run.props.get().dragDismissible === false ? points[0] : 0;
    const next = Math.max(
      lowerBound,
      Math.min(points[points.length - 1], start + sample.totalDelta)
    );
    dragProgress.set(next, 'reason: drawer normalized drag preview');
    render(run);
    if (sample.phase !== 'end') return;
    dragging.set(false, 'reason: drawer drag end');
    const configured = run.props.get().dragDismissThreshold;
    const threshold =
      typeof configured === 'number' && Number.isFinite(configured)
        ? Math.max(0, Math.min(points[0], configured))
        : Math.min(points[0], 0.25);
    if (run.props.get().dragDismissible !== false && next < threshold) {
      // Root owns open. A refused controlled request restores the actual owner extent.
      requestDrawerOpen(run, false, 'drag.dismiss', 'pointer');
    } else request(next, 'drag.snap');
    cancel();
  });
  const sync = (run: RunHandle<DrawerContentProps>, created = false) => {
    currentRun = run;
    const props = run.props.get();
    points = drawerSnapPoints(props.snapPoints);
    const value = run.props.isProvided('snapPoint')
      ? props.snapPoint
      : created
        ? props.defaultSnapPoint
        : snapPoint.get();
    snapPoint.set(nearest(points, value ?? points[points.length - 1]), 'reason: drawer snap owner');
    cancel();
  };
  def.context.subscribe(DRAWER_CONTEXT, (run, next) => {
    currentRun = run;
    rootOpen = next.open;
    rootDisabled = next.disabled;
    if (!rootOpen || rootDisabled) cancel();
    else render(run);
  });
  def.lifecycle.onCreated((run) => {
    const root = run.context.read(DRAWER_CONTEXT);
    rootOpen = root.open;
    rootDisabled = root.disabled;
    sync(run, true);
  });
  def.lifecycle.onMounted((run) => {
    currentRun = run;
    render(run);
  });
  def.props.watch(
    ['snapPoints', 'snapPoint', 'side', 'dragDismissible', 'dragDismissThreshold'],
    (run) => sync(run)
  );
  def.lifecycle.onUnmounted(() => {
    dragging.set(false, 'reason: drawer view detached');
    dragProgress.set(snapPoint.get(), 'reason: drawer detach preview reset');
    currentRun = null;
  });
  return { snapPoint, dragging, dragProgress, offsetPercentage };
}
