import { defineAsHook, definePrototype, type DefHandle, type RunHandle } from '@proto.ui/core';
import { asAccessible, asFocusRoving, asOverlay } from '@proto.ui/hooks';
import {
  TOAST_POSITIONS,
  TOAST_SWIPE_DIRECTIONS,
  TOAST_VIEWPORT_CONTEXT,
  type ToastViewportContextValue,
} from './shared';
import type {
  ToastPosition,
  ToastSwipeDirection,
  ToastViewportProps,
  ToastViewportExposes,
  ToastViewportAsHookContract,
} from './types';

function resolvePosition(raw: unknown): ToastPosition {
  return typeof raw === 'string' && (TOAST_POSITIONS as readonly string[]).includes(raw)
    ? (raw as ToastPosition)
    : 'bottom-right';
}

function resolveSwipeDirection(raw: unknown): ToastSwipeDirection {
  return typeof raw === 'string' && (TOAST_SWIPE_DIRECTIONS as readonly string[]).includes(raw)
    ? (raw as ToastSwipeDirection)
    : 'right';
}

function resolveVisibleToasts(raw: unknown): number {
  return typeof raw === 'number' && Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 3;
}

function resolveViewportDuration(raw: unknown, provided: boolean): number | null {
  if (!provided) return null;
  return typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? raw : null;
}

function setup(def: DefHandle<ToastViewportProps, ToastViewportExposes>) {
  def.props.define({
    a11yLabel: { type: 'string', empty: 'fallback' },
    hotkey: { type: 'string', empty: 'fallback' },
    position: { type: 'enum', empty: 'fallback', options: [...TOAST_POSITIONS] },
    expand: { type: 'boolean', empty: 'fallback' },
    visibleToasts: { type: 'number', empty: 'fallback' },
    duration: { type: 'number', empty: 'fallback' },
    swipeDirection: { type: 'enum', empty: 'fallback', options: [...TOAST_SWIPE_DIRECTIONS] },
  });
  def.props.setDefaults({
    a11yLabel: 'Notifications',
    hotkey: 'F8',
    position: 'bottom-right',
    expand: false,
    visibleToasts: 3,
    swipeDirection: 'right',
  });

  const label = def.state.string('label', 'Notifications');
  const position = def.state.enum('position', 'bottom-right', {
    options: TOAST_POSITIONS,
  });
  const expanded = def.state.bool('expanded', false);
  const paused = def.state.bool('paused', false);

  const overlay = asOverlay<ToastViewportProps>();
  overlay.configure({
    defaultOpen: true,
    portal: true,
    boundaryStack: false,
    modal: false,
    entry: 'manual',
    restore: 'none',
    closeOnEscape: false,
    closeOnOutsidePress: false,
    closeOnFocusOutside: false,
    closeOnAnchorPress: false,
    closeOnTriggerPress: false,
  });

  const a11y = asAccessible();
  a11y.role('region');
  a11y.name(label);

  const focus = asFocusRoving<ToastViewportProps>();
  focus.configure({ navigation: 'none', loop: false, entry: 'first' });

  const initialContext: ToastViewportContextValue = {
    position: 'bottom-right',
    expanded: false,
    paused: false,
    visibleToasts: 3,
    duration: null,
    swipeDirection: 'right',
    dismissEpoch: 0,
    dismissReason: 'viewport-dismiss',
    openIds: [],
  };
  def.context.provide(TOAST_VIEWPORT_CONTEXT, initialContext);

  let currentRun: RunHandle<ToastViewportProps> | null = null;
  let hovered = false;
  let manualPause = false;
  let dismissEpoch = 0;
  let dismissReason = 'viewport-dismiss';

  const publish = (run: RunHandle<ToastViewportProps> | null) => {
    if (!run) return;
    const p = run.props.get();
    const nextPosition = resolvePosition(p.position);
    const nextExpanded = !!p.expand || hovered;
    const nextPaused = manualPause || hovered;
    label.set(p.a11yLabel ?? 'Notifications', 'reason: toast viewport name');
    position.set(nextPosition, 'reason: toast viewport position');
    expanded.set(nextExpanded, 'reason: toast viewport expand');
    paused.set(nextPaused, 'reason: toast viewport pause');
    run.context.update(TOAST_VIEWPORT_CONTEXT, (prev) => ({
      position: nextPosition,
      expanded: nextExpanded,
      paused: nextPaused,
      visibleToasts: resolveVisibleToasts(p.visibleToasts),
      duration: resolveViewportDuration(p.duration, run.props.isProvided('duration')),
      swipeDirection: resolveSwipeDirection(p.swipeDirection),
      dismissEpoch,
      dismissReason,
      openIds: prev.openIds,
    }));
  };

  def.expose.state('position', position);
  def.expose.state('expanded', expanded);
  def.expose.state('paused', paused);
  def.expose.method('focusFirst', () => focus.focusFirst());
  def.expose.method('pauseAll', () => {
    manualPause = true;
    publish(currentRun);
  });
  def.expose.method('resumeAll', () => {
    manualPause = false;
    publish(currentRun);
  });
  def.expose.method('dismissAll', (reason = 'viewport-dismiss') => {
    dismissEpoch++;
    dismissReason = reason;
    publish(currentRun);
  });

  const sync = (run: RunHandle<ToastViewportProps>) => {
    currentRun = run;
    publish(run);
  };
  def.lifecycle.onCreated(sync);
  def.lifecycle.onMounted(sync);
  def.lifecycle.onUnmounted(() => {
    hovered = false;
    publish(currentRun);
  });
  def.lifecycle.onBeforeDispose(() => {
    currentRun = null;
  });
  def.props.watch(
    ['a11yLabel', 'position', 'expand', 'visibleToasts', 'duration', 'swipeDirection'],
    sync
  );

  def.event.on('pointer.enter', (run) => {
    currentRun = run;
    hovered = true;
    publish(run);
  });
  def.event.on('pointer.leave', (run) => {
    currentRun = run;
    hovered = false;
    publish(run);
  });
  def.event.on('pointer.cancel', (run) => {
    currentRun = run;
    hovered = false;
    publish(run);
  });
  def.event.onGlobal('key.down', (run, event) => {
    if (event.key !== run.props.get().hotkey) return;
    event.control.requestDefaultActionPrevention({
      reason: 'toast.focus-hotkey',
      source: 'base-toast-viewport',
    });
    focus.focusFirst();
  });
}

export const asToastViewport = defineAsHook<
  ToastViewportProps,
  ToastViewportExposes,
  ToastViewportAsHookContract
>({ name: 'as-toast-viewport', setup });
export default definePrototype({ name: 'base-toast-viewport', setup });
