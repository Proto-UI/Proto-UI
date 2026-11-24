import {
  defineAsHook,
  definePrototype,
  delay,
  tw,
  type DefHandle,
  type RunHandle,
  type DelayTask,
} from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';
import { asTransition } from '../tools';
import {
  TOAST_CONTEXT,
  TOAST_FAMILY,
  TOAST_POSITIONS,
  TOAST_TYPES,
  TOAST_VIEWPORT_CONTEXT,
  createToastId,
} from './shared';
import type {
  ToastPosition,
  ToastType,
  ToastRootProps,
  ToastRootExposes,
  ToastRootAsHookContract,
} from './types';

const USER_DISMISS_REASONS = new Set(['close', 'escape', 'swipe']);

function resolveType(raw: unknown): ToastType {
  return typeof raw === 'string' && (TOAST_TYPES as readonly string[]).includes(raw)
    ? (raw as ToastType)
    : 'default';
}

function resolvePosition(raw: unknown, fallback: ToastPosition): ToastPosition {
  return typeof raw === 'string' && (TOAST_POSITIONS as readonly string[]).includes(raw)
    ? (raw as ToastPosition)
    : fallback;
}

function setup(def: DefHandle<ToastRootProps, ToastRootExposes>) {
  def.anatomy.claim(TOAST_FAMILY, { role: 'root' });
  // Reconcile retained facts before Transition starts the new view.
  def.lifecycle.onMounted((run) => {
    currentRun = run;
    const view = viewEpoch,
      next = open.get();
    if (run.context.read(TOAST_CONTEXT).open !== next) {
      run.context.update(TOAST_CONTEXT, {
        id,
        open: next,
        type: toastType.get(),
        dismissible: dismissible.get(),
      });
    }
    if (currentRun !== run || viewEpoch !== view) return;
    if (next) transition.controls.enter();
    else transition.controls.leave();
  });
  const transition = asTransition();
  transition.configure({ enterDuration: 0, leaveDuration: 0 });
  def.props.define({
    duration: { type: 'number', empty: 'fallback' },
    paused: { type: 'boolean', empty: 'fallback' },
    politeness: { type: 'enum', empty: 'fallback', options: ['polite', 'assertive'] },
    type: { type: 'enum', empty: 'fallback', options: [...TOAST_TYPES] },
    dismissible: { type: 'boolean', empty: 'fallback' },
    position: { type: 'enum', empty: 'fallback', options: [...TOAST_POSITIONS] },
  });
  def.props.setDefaults({
    defaultOpen: true,
    duration: 5000,
    paused: false,
    politeness: 'polite',
    type: 'default',
    dismissible: true,
  });

  const open = def.state.bool('open', true),
    paused = def.state.bool('paused', false),
    toastType = def.state.enum('type', 'default', { options: TOAST_TYPES }),
    dismissible = def.state.bool('dismissible', true),
    position = def.state.enum('position', 'bottom-right', {
      options: TOAST_POSITIONS,
    }),
    expanded = def.state.bool('expanded', false),
    role = def.state.string('role', 'status'),
    live = def.state.string('live', 'polite'),
    atomic = def.state.bool('atomic', true);

  const a11y = asAccessible();
  a11y.role(role);
  a11y.state('live', live);
  a11y.state('atomic', atomic);

  const id = createToastId();
  def.context.provide(TOAST_CONTEXT, { id, open: true, type: 'default', dismissible: true });
  def.context.subscribe(TOAST_CONTEXT);

  const labelledBy = def.state.string('labelledBy', ''),
    describedBy = def.state.string('describedBy', '');
  a11y.relation('labelledBy', { target: labelledBy });
  a11y.relation('describedBy', { target: describedBy });

  def.expose.state('open', open);
  def.expose.state('paused', paused);
  def.expose.state('type', toastType);
  def.expose.state('dismissible', dismissible);
  def.expose.state('position', position);
  def.expose.state('expanded', expanded);
  def.expose.event('openChange', { payload: 'json' });

  let currentRun: RunHandle<ToastRootProps> | null = null,
    task: DelayTask | null = null,
    started = 0,
    remaining = 5000,
    mounted = false,
    hovered = false,
    manualPause = false,
    viewportPaused = false,
    viewportDuration: number | null = null,
    seenDismissEpoch = 0,
    expired = false;
  let epoch = 0;
  let viewEpoch = 0;
  const focusedItems = new Set<string>();

  const duration = () => {
    const run = currentRun;
    if (!run) return 5000;
    if (run.props.isProvided('duration')) {
      const n = run.props.get().duration;
      return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : 5000;
    }
    if (toastType.get() === 'loading') return 0;
    if (viewportDuration !== null) return viewportDuration;
    return 5000;
  };

  const syncPoliteness = (run: RunHandle<ToastRootProps>) => {
    const p = run.props.get();
    const resolved = run.props.isProvided('politeness')
      ? (p.politeness ?? 'polite')
      : toastType.get() === 'error'
        ? 'assertive'
        : 'polite';
    live.set(resolved, 'reason: toast live priority');
    role.set(resolved === 'assertive' ? 'alert' : 'status', 'reason: toast role');
  };

  const cancel = (preserve = false) => {
    if (task && preserve) remaining = Math.max(0, remaining - Math.max(0, Date.now() - started));
    task?.cancel();
    task = null;
    epoch++;
  };

  const request = (next: boolean, reason: string) => {
    const run = currentRun;
    if (!run || open.get() === next) return;
    if (!next && !dismissible.get() && USER_DISMISS_REASONS.has(reason)) return;
    const view = viewEpoch;
    if (!run.props.isProvided('open')) apply(next);
    if (currentRun !== run || viewEpoch !== view) return;
    run.expose.emit('openChange', { open: next, reason });
  };

  const schedule = () => {
    cancel();
    if (!mounted || !open.get() || paused.get() || expired || duration() === 0) return;
    const generation = epoch;
    started = Date.now();
    task = delay(remaining, () => {
      if (generation !== epoch || !mounted || !open.get() || paused.get()) return;
      task = null;
      expired = true;
      request(false, 'timeout');
    });
  };

  const apply = (next: boolean) => {
    const run = currentRun,
      view = viewEpoch;
    const changed = open.get() !== next;
    open.set(next, 'reason: toast open owner');
    if (currentRun !== run || viewEpoch !== view) return;
    currentRun?.context.update(TOAST_CONTEXT, {
      id,
      open: next,
      type: toastType.get(),
      dismissible: dismissible.get(),
    });
    if (currentRun !== run || viewEpoch !== view) return;
    if (next) {
      transition.controls.enter();
      if (changed) {
        remaining = duration();
        expired = false;
        schedule();
      }
    } else {
      cancel();
      hovered = false;
      focusedItems.clear();
      syncPaused();
      if (currentRun !== run || viewEpoch !== view) return;
      transition.controls.leave();
    }
  };

  const syncPaused = () => {
    const next =
      manualPause ||
      hovered ||
      viewportPaused ||
      focusedItems.size > 0 ||
      !!currentRun?.props.get().paused;
    if (next === paused.get()) return;
    const run = currentRun,
      view = viewEpoch;
    paused.set(next, 'reason: toast interaction pause');
    if (currentRun !== run || viewEpoch !== view) return;
    if (next) cancel(true);
    else schedule();
  };

  const syncViewport = (run: RunHandle<ToastRootProps>) => {
    const vp = run.context.tryRead(TOAST_VIEWPORT_CONTEXT);
    const vpPos = vp?.position ?? 'bottom-right';
    const nextPos = run.props.isProvided('position')
      ? resolvePosition(run.props.get().position, vpPos)
      : vpPos;
    position.set(nextPos, 'reason: toast position');
    expanded.set(!!vp?.expanded, 'reason: toast viewport expanded');
    viewportPaused = !!vp?.paused;
    viewportDuration = vp?.duration ?? null;
    syncPaused();
    if (vp && vp.dismissEpoch > seenDismissEpoch) {
      seenDismissEpoch = vp.dismissEpoch;
      if (open.get()) request(false, vp.dismissReason || 'viewport-dismiss');
    }
  };

  def.context.trySubscribe(TOAST_VIEWPORT_CONTEXT, (run) => {
    currentRun = run;
    syncViewport(run);
  });

  def.expose.method('openToast', () => request(true, 'programmatic'));
  def.expose.method('close', (reason = 'programmatic') => request(false, reason));
  def.expose.method('pause', () => {
    manualPause = true;
    syncPaused();
  });
  def.expose.method('resume', () => {
    manualPause = false;
    syncPaused();
  });

  const relations = (run: RunHandle<ToastRootProps>) => {
    labelledBy.set(
      run.anatomy.has(TOAST_FAMILY, 'title') ? id + '-title' : '',
      'reason: toast title relationship'
    );
    describedBy.set(
      run.anatomy.has(TOAST_FAMILY, 'description') ? id + '-description' : '',
      'reason: toast description relationship'
    );
  };
  def.anatomy.subscribeParts(TOAST_FAMILY, 'title', relations);
  def.anatomy.subscribeParts(TOAST_FAMILY, 'description', relations);

  def.lifecycle.onCreated((run) => {
    currentRun = run;
    const p = run.props.get();
    const vp = run.context.tryRead(TOAST_VIEWPORT_CONTEXT);
    seenDismissEpoch = vp?.dismissEpoch ?? 0;
    toastType.set(resolveType(p.type), 'reason: toast semantic type');
    dismissible.set(p.dismissible !== false, 'reason: toast dismissible');
    syncViewport(run);
    remaining = duration();
    syncPoliteness(run);
    apply(run.props.isProvided('open') ? !!p.open : p.defaultOpen !== false);
    syncPaused();
  });

  def.lifecycle.onMounted((run) => {
    currentRun = run;
    mounted = true;
    syncViewport(run);
    relations(run);
    syncPaused();
    schedule();
  });

  def.lifecycle.onUnmounted(() => {
    viewEpoch++;
    mounted = false;
    hovered = false;
    viewportPaused = false;
    focusedItems.clear();
    cancel();
  });

  def.lifecycle.onBeforeDispose(() => {
    currentRun = null;
  });

  def.props.watch(
    ['open', 'duration', 'paused', 'politeness', 'type', 'dismissible', 'position'],
    (run, next, prev) => {
      currentRun = run;
      const nextType = resolveType(next.type);
      const nextDismissible = next.dismissible !== false;
      const typeChanged = toastType.get() !== nextType;
      toastType.set(nextType, 'reason: toast semantic type');
      dismissible.set(nextDismissible, 'reason: toast dismissible');
      run.context.update(TOAST_CONTEXT, {
        id,
        open: open.get(),
        type: nextType,
        dismissible: nextDismissible,
      });
      syncViewport(run);
      if (run.props.isProvided('open')) apply(!!next.open);
      if (next.duration !== prev.duration || typeChanged) {
        remaining = duration();
        expired = false;
        schedule();
      }
      syncPoliteness(run);
      syncPaused();
    }
  );

  def.expose.method('__setFocused', (itemId, focused) => {
    if (!mounted || !open.get()) return;
    if (focused) focusedItems.add(itemId);
    else focusedItems.delete(itemId);
    syncPaused();
  });

  def.event.on('pointer.enter', () => {
    if (!open.get()) return;
    hovered = true;
    syncPaused();
  });
  def.event.on('pointer.leave', () => {
    hovered = false;
    syncPaused();
  });
  def.event.on('pointer.cancel', () => {
    hovered = false;
    syncPaused();
  });
  def.event.onGlobal('key.down', (_run, event) => {
    if (event.key === 'Escape' && (focusedItems.size > 0 || hovered) && open.get()) {
      request(false, 'escape');
    }
  });
  def.rule({
    when: (w) => w.state(transition.isPresent).eq(false),
    intent: (i) => i.feedback.style.use(tw('hidden')),
  });
}

export const asToastRoot = defineAsHook<ToastRootProps, ToastRootExposes, ToastRootAsHookContract>({
  name: 'as-toast-root',
  setup,
});
export default definePrototype({ name: 'base-toast-root', setup });
