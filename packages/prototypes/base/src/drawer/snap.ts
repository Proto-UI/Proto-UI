import {
  type AvailableLayoutBinding,
  type AxisInputSample,
  type DefHandle,
  type RunHandle,
  type OwnedStateHandle,
} from '@proto.ui/core';
import { DRAWER_CONTEXT, DRAWER_CONTENT_CONTEXT, requestDrawerOpen } from './shared';
import type { DrawerContentProps, DrawerContentExposes } from './types';
import { drawerExtentModel } from './extent-model';
export { drawerExtentModel } from './extent-model';

/** Legacy horizontal point normalization; vertical input uses the strict extent model. */
export function drawerSnapPoints(input: readonly number[] | undefined): number[] {
  const points = Array.isArray(input)
    ? [...new Set(input.filter((point) => Number.isFinite(point) && point > 0 && point <= 1))]
    : [];
  return points.length ? points.sort((a, b) => a - b) : [1];
}
function nearest(points: number[], value: number): number {
  const finite = Number.isFinite(value) ? value : points[points.length - 1];
  return points.reduce((best, point) =>
    Math.abs(point - finite) <= Math.abs(best - finite) ? point : best
  );
}
export function setupDrawerSnap(
  def: DefHandle<DrawerContentProps, DrawerContentExposes>,
  side: OwnedStateHandle<string>
) {
  def.props.define({
    snapPoints: { type: 'object', empty: 'fallback' },
    snapPoint: { type: 'number', empty: 'fallback' },
    defaultSnapPoint: { type: 'number', empty: 'fallback' },
    minExtent: { type: 'object', empty: 'fallback' },
    maxExtent: { type: 'object', empty: 'fallback' },
    dragDismissible: { type: 'boolean', empty: 'fallback' },
    dragDismissThreshold: { type: 'number', empty: 'fallback' },
  });
  def.props.setDefaults({
    dragDismissible: true,
    dragDismissThreshold: 0.25,
    maxExtent: { unit: 'available', value: 1 },
  });
  const snapPoint = def.state.numberRange('snapPoint', 1, { min: 0, max: 1, clamp: true });
  const dragProgress = def.state.numberRange('dragProgress', 1, { min: 0, max: 1, clamp: true });
  const dragging = def.state.bool('dragging', false);
  const offsetPercentage = def.state.numberRange('offsetPercentage', 0, {
    min: 0,
    max: 100,
    clamp: true,
  });
  const extentValid = def.state.bool('extentValid', false);
  const vertical = def.state.bool('verticalExtent', true);
  const extent = def.state.enum('extentMode', 'intrinsic', {
    options: ['intrinsic', 'fraction'] as const,
  });
  const edge = def.state.enum('extentEdge', 'bottom', {
    options: ['top', 'right', 'bottom', 'left'] as const,
  });
  const units = ['logical', 'root-text', 'available', 'available-minus-root-text'] as const;
  const minimumUnit = def.state.enum('minimumExtentUnit', 'logical', { options: units });
  const maximumUnit = def.state.enum('maximumExtentUnit', 'available', { options: units });
  const minimumValue = def.state.numberRange('minimumExtentValue', 0, {
    min: 0,
    max: Number.MAX_VALUE,
  });
  const maximumValue = def.state.numberRange('maximumExtentValue', 1, {
    min: 0,
    max: Number.MAX_VALUE,
  });
  const displacement = def.state.numberRange('extentDisplacement', 0, {
    min: 0,
    max: 1,
    clamp: true,
  });
  const layout: AvailableLayoutBinding = {
    enabled: vertical,
    edge,
    extent,
    fraction: dragProgress,
    minimum: { unit: minimumUnit, value: minimumValue },
    maximum: { unit: maximumUnit, value: maximumValue },
    displacement,
  };
  def.expose.state('offsetPercentage', offsetPercentage);
  def.expose.state('snapPoint', snapPoint);
  def.expose.state('dragProgress', dragProgress);
  def.expose.state('dragging', dragging);
  def.expose.state('extentValid', extentValid);
  def.expose.event('snapPointChange', { payload: 'json' });
  def.context.provide(DRAWER_CONTENT_CONTEXT, {
    side: 'bottom',
    open: false,
    disabled: false,
    snapPoint: 1,
    snapPoints: [1],
    dismissible: true,
    extentMode: 'intrinsic',
    extentValid: false,
    contactRevision: 0,
  });
  let currentRun: RunHandle<DrawerContentProps> | null = null;
  let points = [1],
    start = 1,
    rootOpen = false,
    rootDisabled = false,
    accepted = false,
    controlled = false,
    contactRevision = 0;
  const render = (run: RunHandle<DrawerContentProps>) => {
    offsetPercentage.set(
      Math.round((1 - dragProgress.get()) * 100000) / 1000,
      'reason: drawer continuous percentage projection'
    );
    run.context.update(DRAWER_CONTENT_CONTEXT, {
      side: side.get() as 'top' | 'right' | 'bottom' | 'left',
      open: rootOpen && accepted,
      disabled: rootDisabled,
      snapPoint: snapPoint.get(),
      snapPoints: points,
      dismissible: run.props.get().dragDismissible !== false,
      extentMode: extent.get(),
      extentValid: extentValid.get(),
      contactRevision,
    });
  };
  const cancel = () => {
    dragging.set(false, 'reason: drawer drag cancelled');
    dragProgress.set(
      extent.get() === 'intrinsic' ? 1 : snapPoint.get(),
      'reason: drawer return to owner extent'
    );
    displacement.set(0, 'reason: drawer return to resting position');
    if (currentRun) render(currentRun);
  };
  const request = (next: number, reason: string) => {
    const run = currentRun;
    if (!run || !rootOpen || rootDisabled || !extentValid.get() || extent.get() !== 'fraction')
      return;
    const value = nearest(points, next);
    if (value === snapPoint.get()) return;
    if (!controlled) snapPoint.set(value, 'reason: drawer snap request');
    dragProgress.set(snapPoint.get(), 'reason: drawer snap owner projection');
    render(run);
    run.expose.emit('snapPointChange', { snapPoint: value, reason });
  };
  def.expose.method('requestSnapPoint', (next, reason = 'programmatic') => request(next, reason));
  def.expose.method('__onAxisInput', (sample: AxisInputSample) => {
    const run = currentRun;
    if (!run) return;
    if (sample.phase === 'cancel' || !rootOpen || rootDisabled || !extentValid.get()) {
      cancel();
      return;
    }
    const intrinsic = extent.get() === 'intrinsic';
    if (intrinsic && run.props.get().dragDismissible === false) {
      cancel();
      return;
    }
    if (sample.phase === 'start') {
      start = intrinsic ? 1 : snapPoint.get();
      dragging.set(true, 'reason: drawer drag start');
    }
    if (!dragging.get()) return;
    const lowerBound = intrinsic ? 0 : run.props.get().dragDismissible === false ? points[0] : 0;
    const next = Math.max(
      lowerBound,
      Math.min(intrinsic ? 1 : points[points.length - 1], start + sample.totalDelta * start)
    );
    dragProgress.set(next, 'reason: drawer normalized drag preview');
    if (intrinsic) displacement.set(1 - next, 'reason: drawer intrinsic drag displacement');
    render(run);
    if (sample.phase !== 'end') return;
    dragging.set(false, 'reason: drawer drag end');
    const configured = run.props.get().dragDismissThreshold;
    const ceiling = intrinsic ? 1 : points[0];
    const threshold =
      typeof configured === 'number' && Number.isFinite(configured)
        ? Math.max(0, Math.min(ceiling, configured))
        : Math.min(ceiling, 0.25);
    if (run.props.get().dragDismissible !== false && next < threshold)
      requestDrawerOpen(run, false, 'drag.dismiss', 'pointer');
    else if (!intrinsic) request(next, 'drag.snap');
    cancel();
  });
  const sync = (run: RunHandle<DrawerContentProps>, created = false) => {
    currentRun = run;
    const props = run.props.get(),
      raw = run.props.getRaw();
    const nextSide = props.side ?? 'bottom';
    const validSide = ['top', 'right', 'bottom', 'left'].includes(nextSide);
    const horizontal = nextSide === 'left' || nextSide === 'right';
    const model = drawerExtentModel({
      ...raw,
      side: nextSide,
      minExtent: raw.minExtent == null ? props.minExtent : raw.minExtent,
      maxExtent: raw.maxExtent == null ? props.maxExtent : raw.maxExtent,
    });
    contactRevision++;
    if (!validSide || (!horizontal && model.status === 'invalid')) {
      extentValid.set(false, 'reason: rejected drawer extent input');
      cancel();
      if (!accepted)
        throw new TypeError(
          `[Drawer] Invalid initial extent configuration: ${!validSide ? 'side' : model.status === 'invalid' ? model.reason : 'unknown'}.`
        );
      return;
    }
    const previousMode = extent.get();
    side.set(nextSide, 'reason: drawer accepted edge');
    edge.set(nextSide, 'reason: drawer accepted layout edge');
    vertical.set(!horizontal, 'reason: drawer vertical layout boundary');
    if (horizontal) {
      points = drawerSnapPoints(props.snapPoints);
      controlled = run.props.isProvided('snapPoint');
      extent.set('fraction', 'reason: drawer legacy horizontal snap');
      snapPoint.set(
        nearest(
          points,
          (controlled ? props.snapPoint : created ? props.defaultSnapPoint : snapPoint.get()) ??
            points[points.length - 1]
        ),
        'reason: drawer snap owner'
      );
    } else if (model.status === 'ready') {
      extent.set(model.mode, 'reason: drawer accepted extent mode');
      points = model.mode === 'intrinsic' ? [1] : model.points;
      controlled = model.controlled;
      minimumUnit.set(model.minimum.unit, 'reason: drawer accepted minimum unit');
      minimumValue.set(model.minimum.value, 'reason: drawer accepted minimum');
      maximumUnit.set(model.maximum.unit, 'reason: drawer accepted maximum unit');
      maximumValue.set(model.maximum.value, 'reason: drawer accepted maximum');
      const selection =
        model.mode === 'intrinsic'
          ? 1
          : model.controlled || created || previousMode !== model.mode
            ? model.selection!
            : nearest(points, snapPoint.get());
      snapPoint.set(selection, 'reason: drawer accepted snap owner');
    }
    accepted = true;
    extentValid.set(true, 'reason: drawer valid extent configuration');
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
    [
      'snapPoints',
      'snapPoint',
      'side',
      'minExtent',
      'maxExtent',
      'dragDismissible',
      'dragDismissThreshold',
    ],
    (run) => sync(run)
  );
  def.lifecycle.onUnmounted(() => {
    dragging.set(false, 'reason: drawer view detached');
    dragProgress.set(
      extent.get() === 'intrinsic' ? 1 : snapPoint.get(),
      'reason: drawer detach preview reset'
    );
    displacement.set(0, 'reason: drawer detach displacement reset');
    currentRun = null;
  });
  return {
    snapPoint,
    dragging,
    dragProgress,
    offsetPercentage,
    extentValid,
    layout,
    hasAccepted: () => accepted,
  };
}
