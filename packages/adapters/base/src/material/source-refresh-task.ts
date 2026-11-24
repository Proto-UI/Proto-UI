type Counters = {
  sourceRefreshTasksScheduled: number;
  sourceRefreshTasksCancelled: number;
  sourceRefreshTasksRun: number;
  pendingSourceRefreshTasks: number;
};
const counters = new WeakMap<Document, Counters>();
const emptyCounters = (): Counters => ({
  sourceRefreshTasksScheduled: 0,
  sourceRefreshTasksCancelled: 0,
  sourceRefreshTasksRun: 0,
  pendingSourceRefreshTasks: 0,
});
type Task = {
  invoke: (() => void) | null;
  fallback: (() => boolean) | null;
  abort: (() => void) | null;
  clearTimer: (() => void) | null;
  counters: Counters;
};
type TaskWindow = Window & {
  AbortController?: typeof AbortController;
  scheduler?: {
    postTask(
      callback: () => void,
      options: { priority: 'background'; signal: AbortSignal }
    ): Promise<unknown>;
  };
};

function finish(task: Task, run: boolean, abortScheduler = !run) {
  const invoke = task.invoke;
  if (!invoke) return;
  // Native callbacks retain only this detached ticket. Retire every closure
  // that can reference a window/binding before cancellation or invocation.
  task.invoke = null;
  task.fallback = null;
  const abort = task.abort,
    clearTimer = task.clearTimer;
  task.abort = null;
  task.clearTimer = null;
  task.counters.pendingSourceRefreshTasks--;
  if (run) task.counters.sourceRefreshTasksRun++;
  else task.counters.sourceRefreshTasksCancelled++;
  try {
    clearTimer?.();
  } catch {}
  if (abortScheduler) {
    try {
      abort?.();
    } catch {}
  }
  if (run) invoke();
}
function fallback(task: Task) {
  const queue = task.fallback;
  task.fallback = null;
  return !!task.invoke && !!queue?.();
}
// Construct native callbacks outside the binding's lexical environment. A late
// cancelled callback cannot retain its document, host, source or repaint closure.
const callbackFor = (task: Task, origin: 'scheduler' | 'timer') => () =>
  finish(task, true, origin === 'timer');
const rejectionFor = (task: Task) => () => {
  if (task.invoke && !fallback(task)) finish(task, true, true);
};

/** One latest-state continuation. Coalescing keeps the original queue position;
 * postTask and its timer fallback share a single consumable execution right. */
export function createSourceRefreshTask(document: Document, refresh: () => void) {
  const win = document.defaultView as TaskWindow | null;
  let stats = counters.get(document);
  if (!stats) counters.set(document, (stats = emptyCounters()));
  const observed = stats;
  let pending: Task | null = null;
  let retired = false;
  const owns = (task: Task) => !retired && pending === task && !!task.invoke;
  function cancel() {
    const task = pending;
    pending = null;
    if (task) finish(task, false);
  }
  return {
    schedule() {
      if (retired || !win) return false;
      if (pending) return true;
      const task: Task = {
        invoke() {
          // Retiring a losing transport may synchronously admit a successor.
          // Consuming this older right must not erase that newer owner.
          if (pending === task) pending = null;
          refresh();
        },
        fallback() {
          // A timer provides portability, not postTask priority or a deadline.
          try {
            const setTimer = win.setTimeout;
            if (!owns(task)) return true;
            const clearTimer = win.clearTimeout;
            if (!owns(task)) return true;
            if (typeof setTimer !== 'function' || typeof clearTimer !== 'function') return false;
            const timer = setTimer.call(win, callbackFor(task, 'timer'), 0);
            if (owns(task)) task.clearTimer = () => clearTimer.call(win, timer);
            else clearTimer.call(win, timer);
            return true;
          } catch {
            return false;
          }
        },
        abort: null,
        clearTimer: null,
        counters: observed,
      };
      pending = task;
      // Count logical admissions, including an attempt whose unavailable
      // backends immediately return control to the synchronous render path.
      observed.sourceRefreshTasksScheduled++;
      observed.pendingSourceRefreshTasks++;
      try {
        const scheduler = win.scheduler;
        if (!owns(task)) return true;
        const postTask = scheduler?.postTask;
        if (!owns(task)) return true;
        const Controller = win.AbortController;
        if (!owns(task)) return true;
        if (typeof postTask === 'function' && typeof Controller === 'function') {
          const controller = new Controller();
          // Capability access and construction may synchronously retire this
          // owner. Never submit a transport or replace a successor afterward.
          if (!owns(task)) {
            try {
              controller.abort();
            } catch {}
            return true;
          }
          task.abort = () => controller.abort();
          const signal = controller.signal;
          if (!owns(task)) return true;
          // Admission permits only an already painted, compatible neutral
          // surface to continue here. Let fresh input and image publication
          // compete ahead of this work where the host supports that ordering.
          // Keep the original queue position; this hint promises no deadline
          // or starvation bound, and the timer fallback remains unchanged.
          postTask
            .call(scheduler, callbackFor(task, 'scheduler'), {
              priority: 'background',
              signal,
            })
            .then(undefined, rejectionFor(task));
          return true;
        }
      } catch {
        // A backend may throw after enqueuing. Its late callback and the timer
        // still cannot both consume this task.
      }
      if (!task.invoke) return true;
      if (fallback(task) || !task.invoke) return true;
      if (pending === task) cancel();
      return false;
    },
    cancel,
    dispose() {
      retired = true;
      cancel();
    },
  };
}

/** Private numeric observations; neither a support fact nor a priority claim. */
export function inspectSourceRefreshTasks(document: Document) {
  return { ...(counters.get(document) ?? emptyCounters()) };
}
