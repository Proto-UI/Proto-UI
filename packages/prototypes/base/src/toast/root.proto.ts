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
import { TOAST_CONTEXT, TOAST_FAMILY, createToastId } from './shared';
import type { ToastRootProps, ToastRootExposes, ToastRootAsHookContract } from './types';
function setup(def: DefHandle<ToastRootProps, ToastRootExposes>) {
  def.anatomy.claim(TOAST_FAMILY, { role: 'root' });
  const transition = asTransition();
  transition.configure({ enterDuration: 0, leaveDuration: 0 });
  def.props.define({
    duration: { type: 'number', empty: 'fallback' },
    paused: { type: 'boolean', empty: 'fallback' },
    politeness: { type: 'enum', empty: 'fallback', options: ['polite', 'assertive'] },
  });
  def.props.setDefaults({ defaultOpen: true, duration: 5000, paused: false, politeness: 'polite' });
  const open = def.state.bool('open', true),
    paused = def.state.bool('paused', false),
    role = def.state.string('role', 'status'),
    live = def.state.string('live', 'polite'),
    atomic = def.state.bool('atomic', true);
  const a11y = asAccessible();
  a11y.role(role);
  a11y.state('live', live);
  a11y.state('atomic', atomic);
  const id = createToastId();
  def.context.provide(TOAST_CONTEXT, { id, open: true });
  const labelledBy = def.state.string('labelledBy', ''),
    describedBy = def.state.string('describedBy', '');
  a11y.relation('labelledBy', { target: labelledBy });
  a11y.relation('describedBy', { target: describedBy });
  def.expose.state('open', open);
  def.expose.state('paused', paused);
  def.expose.event('openChange', { payload: 'json' });
  let currentRun: RunHandle<ToastRootProps> | null = null,
    task: DelayTask | null = null,
    started = 0,
    remaining = 5000,
    mounted = false,
    hovered = false,
    manualPause = false,
    expired = false;
  let epoch = 0;
  const focusedItems = new Set<string>();
  const duration = () => {
    const n = currentRun?.props.get().duration;
    return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : 5000;
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
    if (!run.props.isProvided('open')) apply(next);
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
    const changed = open.get() !== next;
    open.set(next, 'reason: toast open owner');
    currentRun?.context.update(TOAST_CONTEXT, { id, open: next });
    if (next) {
      transition.controls.enter();
      if (changed) {
        remaining = duration();
        expired = false;
        schedule();
      }
    } else {
      cancel();
      transition.controls.leave();
    }
  };
  const syncPaused = () => {
    const next =
      manualPause || hovered || focusedItems.size > 0 || !!currentRun?.props.get().paused;
    if (next === paused.get()) return;
    paused.set(next, 'reason: toast interaction pause');
    if (next) cancel(true);
    else schedule();
  };
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
    remaining = duration();
    live.set(p.politeness ?? 'polite', 'reason: toast live priority');
    role.set(p.politeness === 'assertive' ? 'alert' : 'status', 'reason: toast role');
    apply(run.props.isProvided('open') ? !!p.open : p.defaultOpen !== false);
    syncPaused();
  });
  def.lifecycle.onMounted((run) => {
    currentRun = run;
    mounted = true;
    relations(run);
    schedule();
  });
  def.lifecycle.onUnmounted(() => {
    mounted = false;
    hovered = false;
    focusedItems.clear();
    cancel();
  });
  def.props.watch(['open', 'duration', 'paused', 'politeness'], (run, next, prev) => {
    currentRun = run;
    if (run.props.isProvided('open')) apply(!!next.open);
    if (next.duration !== prev.duration) {
      remaining = duration();
      expired = false;
      schedule();
    }
    live.set(next.politeness ?? 'polite', 'reason: toast priority');
    role.set(next.politeness === 'assertive' ? 'alert' : 'status', 'reason: toast role');
    syncPaused();
  });
  def.expose.method('__setFocused', (id, focused) => {
    if (!mounted) return;
    if (focused) focusedItems.add(id);
    else focusedItems.delete(id);
    syncPaused();
  });
  def.event.on('pointer.enter', () => {
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
    if (event.key === 'Escape' && focusedItems.size > 0 && open.get()) request(false, 'escape');
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
