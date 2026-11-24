import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createSourceRefreshTask,
  inspectSourceRefreshTasks,
} from '../src/material/source-refresh-task';

function environment() {
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const doc = iframe.contentDocument!,
    win = iframe.contentWindow!;
  const timers: Array<() => void> = [];
  const setTimeout = vi.spyOn(win, 'setTimeout').mockImplementation((callback: TimerHandler) => {
    timers.push(callback as () => void);
    return timers.length;
  });
  const clearTimeout = vi.spyOn(win, 'clearTimeout').mockImplementation(() => {});
  const callbacks: Array<() => void> = [],
    signals: AbortSignal[] = [];
  const settlements: Array<{ resolve(): void; reject(error: unknown): void }> = [];
  const postTask = vi.fn(
    (callback: () => void, options: { priority: string; signal: AbortSignal }) => {
      callbacks.push(callback);
      signals.push(options.signal);
      return new Promise<void>((resolve, reject) => settlements.push({ resolve, reject }));
    }
  );
  Object.defineProperty(win, 'scheduler', { configurable: true, value: { postTask } });
  const run = vi.fn();
  const queue = createSourceRefreshTask(doc, run);
  return {
    doc,
    win,
    timers,
    setTimeout,
    clearTimeout,
    callbacks,
    signals,
    settlements,
    postTask,
    run,
    queue,
  };
}
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('private source refresh task ownership (controlled task queue, not browser priority evidence)', () => {
  it('coalesces without replacing queue position and consumes one right once', () => {
    const e = environment();
    try {
      for (let i = 0; i < 100; i++) expect(e.queue.schedule()).toBe(true);
      expect(e.postTask).toHaveBeenCalledOnce();
      expect(e.postTask.mock.calls[0][1]).toMatchObject({ priority: 'background' });
      expect(e.signals[0]).toBeInstanceOf(
        (e.win as Window & { AbortSignal: typeof AbortSignal }).AbortSignal
      );
      expect(inspectSourceRefreshTasks(e.doc)).toEqual({
        sourceRefreshTasksScheduled: 1,
        sourceRefreshTasksCancelled: 0,
        sourceRefreshTasksRun: 0,
        pendingSourceRefreshTasks: 1,
      });
      e.callbacks[0]();
      e.callbacks[0]();
      expect(e.run).toHaveBeenCalledOnce();
      expect(inspectSourceRefreshTasks(e.doc)).toMatchObject({
        sourceRefreshTasksRun: 1,
        pendingSourceRefreshTasks: 0,
      });
    } finally {
      e.queue.dispose();
    }
  });

  it.each(['scheduler', 'AbortController'] as const)(
    'uses one cancellable zero-delay timer when %s is absent',
    (missing) => {
      const e = environment();
      Object.defineProperty(e.win, missing, { configurable: true, value: undefined });
      try {
        expect(e.queue.schedule()).toBe(true);
        expect(e.queue.schedule()).toBe(true);
        expect(e.postTask).not.toHaveBeenCalled();
        expect(e.setTimeout).toHaveBeenCalledOnce();
        expect(e.setTimeout.mock.calls[0][1]).toBe(0);
        e.queue.cancel();
        expect(e.clearTimeout).toHaveBeenCalledWith(1);
        e.timers[0]();
        expect(e.run).not.toHaveBeenCalled();
        expect(inspectSourceRefreshTasks(e.doc)).toMatchObject({
          sourceRefreshTasksScheduled: 1,
          sourceRefreshTasksCancelled: 1,
          pendingSourceRefreshTasks: 0,
        });
      } finally {
        e.queue.dispose();
      }
    }
  );

  it.each(['throw', 'reject'] as const)(
    'shares one execution right between postTask %s and its fallback',
    async (failure) => {
      const e = environment();
      if (failure === 'throw')
        e.postTask.mockImplementationOnce((callback, options) => {
          e.callbacks.push(callback);
          e.signals.push(options.signal);
          throw new Error('postTask unavailable');
        });
      try {
        expect(e.queue.schedule()).toBe(true);
        if (failure === 'reject') {
          e.settlements[0].reject(new Error('postTask unavailable'));
          await Promise.resolve();
        }
        expect(e.setTimeout).toHaveBeenCalledOnce();
        expect(e.queue.schedule()).toBe(true);
        expect(e.postTask).toHaveBeenCalledOnce();
        e.callbacks[0]();
        e.timers[0]();
        expect(e.run).toHaveBeenCalledOnce();
        expect(e.clearTimeout).toHaveBeenCalledWith(1);
        expect(inspectSourceRefreshTasks(e.doc)).toMatchObject({
          sourceRefreshTasksScheduled: 1,
          sourceRefreshTasksRun: 1,
          pendingSourceRefreshTasks: 0,
        });
      } finally {
        e.queue.dispose();
      }
    }
  );

  it('ignores backend rejection and late delivery after synchronous cancellation', async () => {
    const e = environment();
    try {
      e.queue.schedule();
      e.queue.cancel();
      expect(e.signals[0].aborted).toBe(true);
      e.settlements[0].reject(new Error('cancelled'));
      await Promise.resolve();
      e.callbacks[0]();
      expect(e.run).not.toHaveBeenCalled();
      expect(e.setTimeout).not.toHaveBeenCalled();
      expect(inspectSourceRefreshTasks(e.doc)).toMatchObject({
        pendingSourceRefreshTasks: 0,
        sourceRefreshTasksCancelled: 1,
      });
    } finally {
      e.queue.dispose();
    }
  });

  it('aborts the losing scheduler route when its timer fallback wins', () => {
    const e = environment();
    e.postTask.mockImplementationOnce((callback, options) => {
      e.callbacks.push(callback);
      e.signals.push(options.signal);
      throw new Error('threw after enqueue');
    });
    try {
      e.queue.schedule();
      expect(e.signals[0].aborted).toBe(false);
      e.timers[0]();
      expect(e.signals[0].aborted).toBe(true);
      e.callbacks[0]();
      expect(e.run).toHaveBeenCalledOnce();
      expect(inspectSourceRefreshTasks(e.doc)).toMatchObject({
        sourceRefreshTasksRun: 1,
        pendingSourceRefreshTasks: 0,
      });
    } finally {
      e.queue.dispose();
    }
  });

  it('falls back once when the scheduler getter, constructor or promise observer throws', () => {
    for (const failure of ['getter', 'constructor', 'then'] as const) {
      const e = environment();
      try {
        if (failure === 'getter')
          Object.defineProperty(e.win, 'scheduler', {
            get() {
              throw new Error('getter');
            },
          });
        if (failure === 'constructor')
          Object.defineProperty(e.win, 'AbortController', {
            value: class {
              constructor() {
                throw new Error('constructor');
              }
            },
          });
        if (failure === 'then')
          e.postTask.mockImplementationOnce(
            () =>
              ({
                then() {
                  throw new Error('then');
                },
              }) as unknown as Promise<void>
          );
        expect(e.queue.schedule()).toBe(true);
        expect(e.setTimeout).toHaveBeenCalledOnce();
        e.timers[0]();
        expect(e.run).toHaveBeenCalledOnce();
        expect(inspectSourceRefreshTasks(e.doc).pendingSourceRefreshTasks).toBe(0);
      } finally {
        e.queue.dispose();
      }
    }
  });

  it.each(['missing', 'throw'] as const)(
    'returns the immediate path when no backend can schedule (%s timer)',
    (failure) => {
      const e = environment();
      e.postTask.mockImplementationOnce((callback) => {
        e.callbacks.push(callback);
        throw new Error('postTask');
      });
      if (failure === 'missing') Object.defineProperty(e.win, 'setTimeout', { value: undefined });
      else
        e.setTimeout.mockImplementationOnce((callback) => {
          e.timers.push(callback as () => void);
          throw new Error('timer');
        });
      try {
        expect(e.queue.schedule()).toBe(false);
        expect(inspectSourceRefreshTasks(e.doc).pendingSourceRefreshTasks).toBe(0);
        expect(e.signals.every((signal) => signal.aborted)).toBe(true);
        e.callbacks[0]();
        e.timers[0]?.();
        expect(e.run).not.toHaveBeenCalled();
      } finally {
        e.queue.dispose();
      }
    }
  );

  it('re-admits once at rejection when a postTask backend fails and timers are absent', async () => {
    const e = environment();
    Object.defineProperty(e.win, 'setTimeout', { value: undefined });
    try {
      expect(e.queue.schedule()).toBe(true);
      e.settlements[0].reject(new Error('scheduler rejected'));
      await Promise.resolve();
      expect(e.run).toHaveBeenCalledOnce();
      e.callbacks[0]();
      expect(e.run).toHaveBeenCalledOnce();
      expect(inspectSourceRefreshTasks(e.doc)).toMatchObject({
        sourceRefreshTasksRun: 1,
        pendingSourceRefreshTasks: 0,
      });
    } finally {
      e.queue.dispose();
    }
  });

  it.each(['setTimeout', 'clearTimeout'] as const)(
    'retires the right once if %s access throws while falling back after rejection',
    async (property) => {
      const e = environment();
      Object.defineProperty(e.win, property, {
        configurable: true,
        get() {
          throw new Error('timer accessor');
        },
      });
      try {
        e.queue.schedule();
        e.settlements[0].reject(new Error('scheduler rejected'));
        await Promise.resolve();
        expect(e.run).toHaveBeenCalledOnce();
        expect(e.signals[0].aborted).toBe(true);
        e.callbacks[0]();
        expect(e.run).toHaveBeenCalledOnce();
        expect(inspectSourceRefreshTasks(e.doc).pendingSourceRefreshTasks).toBe(0);
      } finally {
        e.queue.dispose();
      }
    }
  );

  it('allows the executing latest state to queue one successor without losing its ownership', () => {
    const e = environment();
    try {
      e.run.mockImplementationOnce(() => {
        expect(e.queue.schedule()).toBe(true);
      });
      e.queue.schedule();
      e.callbacks[0]();
      expect(e.postTask).toHaveBeenCalledTimes(2);
      expect(inspectSourceRefreshTasks(e.doc).pendingSourceRefreshTasks).toBe(1);
      e.callbacks[0]();
      expect(e.run).toHaveBeenCalledOnce();
      e.callbacks[1]();
      expect(e.run).toHaveBeenCalledTimes(2);
      expect(inspectSourceRefreshTasks(e.doc).pendingSourceRefreshTasks).toBe(0);
    } finally {
      e.queue.dispose();
    }
  });

  it('does not cancel a reentrant successor if a nonstandard backend invokes synchronously then throws', () => {
    const e = environment();
    e.run.mockImplementationOnce(() => {
      expect(e.queue.schedule()).toBe(true);
    });
    e.postTask.mockImplementationOnce((callback) => {
      callback();
      throw new Error('after callback');
    });
    try {
      expect(e.queue.schedule()).toBe(true);
      expect(e.postTask).toHaveBeenCalledTimes(2);
      expect(e.run).toHaveBeenCalledOnce();
      expect(e.signals[0].aborted).toBe(false);
      expect(e.setTimeout).not.toHaveBeenCalled();
      expect(inspectSourceRefreshTasks(e.doc).pendingSourceRefreshTasks).toBe(1);
      e.callbacks[0]();
      expect(e.run).toHaveBeenCalledTimes(2);
      expect(inspectSourceRefreshTasks(e.doc).pendingSourceRefreshTasks).toBe(0);
    } finally {
      e.queue.dispose();
    }
  });

  it('retains ownership of a successor queued synchronously by the losing scheduler abort listener', () => {
    const e = environment();
    e.postTask.mockImplementationOnce((callback, options) => {
      e.callbacks.push(callback);
      e.signals.push(options.signal);
      options.signal.addEventListener('abort', () => {
        e.queue.cancel();
        expect(e.queue.schedule()).toBe(true);
      });
      throw new Error('after enqueue');
    });
    try {
      expect(e.queue.schedule()).toBe(true);
      e.timers[0]();
      expect(e.run).toHaveBeenCalledOnce();
      expect(e.postTask).toHaveBeenCalledTimes(2);
      expect(e.signals[1].aborted).toBe(false);
      expect(inspectSourceRefreshTasks(e.doc)).toMatchObject({
        sourceRefreshTasksScheduled: 2,
        sourceRefreshTasksRun: 1,
        pendingSourceRefreshTasks: 1,
      });
      e.queue.dispose();
      expect(e.signals[1].aborted).toBe(true);
      expect(inspectSourceRefreshTasks(e.doc)).toMatchObject({
        sourceRefreshTasksCancelled: 1,
        pendingSourceRefreshTasks: 0,
      });
      e.callbacks.forEach((callback) => callback());
      expect(e.run).toHaveBeenCalledOnce();
    } finally {
      e.queue.dispose();
    }
  });

  it('reports a consumed timer as handled even if a nonstandard timer then throws', () => {
    const e = environment();
    Object.defineProperty(e.win, 'scheduler', { configurable: true, value: undefined });
    e.run.mockImplementationOnce(() => {
      expect(e.queue.schedule()).toBe(true);
    });
    e.setTimeout.mockImplementationOnce((callback) => {
      (callback as () => void)();
      throw new Error('after timer callback');
    });
    try {
      expect(e.queue.schedule()).toBe(true);
      expect(e.run).toHaveBeenCalledOnce();
      expect(inspectSourceRefreshTasks(e.doc).pendingSourceRefreshTasks).toBe(1);
      e.queue.dispose();
      expect(inspectSourceRefreshTasks(e.doc).pendingSourceRefreshTasks).toBe(0);
      e.timers.forEach((callback) => callback());
      expect(e.run).toHaveBeenCalledOnce();
    } finally {
      e.queue.dispose();
    }
  });

  it('disposes synchronously even if abort throws and never accepts a new task afterward', () => {
    const e = environment();
    const abort = vi.fn(() => {
      throw new Error('abort');
    });
    Object.defineProperty(e.win, 'AbortController', {
      value: class {
        signal = new AbortController().signal;
        abort = abort;
      },
    });
    e.queue.schedule();
    expect(() => e.queue.dispose()).not.toThrow();
    expect(abort).toHaveBeenCalledOnce();
    expect(e.queue.schedule()).toBe(false);
    e.callbacks[0]();
    expect(e.run).not.toHaveBeenCalled();
    expect(inspectSourceRefreshTasks(e.doc)).toMatchObject({
      sourceRefreshTasksCancelled: 1,
      pendingSourceRefreshTasks: 0,
    });
  });

  it.each(['scheduler', 'postTask', 'AbortController', 'constructor', 'signal'] as const)(
    'does not submit a retired ticket after %s synchronously disposes the owner',
    (boundary) => {
      const e = environment();
      const NativeController = (e.win as Window & { AbortController: typeof AbortController })
        .AbortController;
      let controller: AbortController | undefined;
      const access = vi.fn(() => {
        e.queue.dispose();
      });
      if (boundary === 'scheduler')
        Object.defineProperty(e.win, 'scheduler', {
          get() {
            access();
            return { postTask: e.postTask };
          },
        });
      if (boundary === 'postTask')
        Object.defineProperty(e.win, 'scheduler', {
          value: {
            get postTask() {
              access();
              return e.postTask;
            },
          },
        });
      if (boundary === 'AbortController')
        Object.defineProperty(e.win, 'AbortController', {
          get() {
            access();
            return NativeController;
          },
        });
      if (boundary === 'constructor')
        Object.defineProperty(e.win, 'AbortController', {
          value: class {
            constructor() {
              controller = new NativeController();
              access();
              return controller;
            }
          },
        });
      if (boundary === 'signal')
        Object.defineProperty(e.win, 'AbortController', {
          value: class {
            constructor() {
              controller = new NativeController();
            }
            get signal() {
              access();
              return controller!.signal;
            }
            abort() {
              controller!.abort();
            }
          },
        });
      try {
        expect(e.queue.schedule()).toBe(true);
        expect(access).toHaveBeenCalledOnce();
        expect(e.postTask).not.toHaveBeenCalled();
        expect(e.setTimeout).not.toHaveBeenCalled();
        if (controller) expect(controller.signal.aborted).toBe(true);
        expect(inspectSourceRefreshTasks(e.doc)).toMatchObject({
          sourceRefreshTasksScheduled: 1,
          sourceRefreshTasksCancelled: 1,
          sourceRefreshTasksRun: 0,
          pendingSourceRefreshTasks: 0,
        });
        expect(e.queue.schedule()).toBe(false);
      } finally {
        e.queue.dispose();
      }
    }
  );

  it.each(['setTimeout', 'clearTimeout', 'timer'] as const)(
    'does not retain a timer when %s synchronously disposes the owner',
    (boundary) => {
      const e = environment();
      Object.defineProperty(e.win, 'scheduler', { value: undefined });
      const access = vi.fn(() => e.queue.dispose());
      if (boundary === 'timer')
        e.setTimeout.mockImplementationOnce(() => {
          access();
          return 37;
        });
      else
        Object.defineProperty(e.win, boundary, {
          get() {
            access();
            return boundary === 'setTimeout' ? e.setTimeout : e.clearTimeout;
          },
        });
      try {
        expect(e.queue.schedule()).toBe(true);
        expect(access).toHaveBeenCalledOnce();
        if (boundary === 'timer') expect(e.clearTimeout).toHaveBeenCalledWith(37);
        else expect(e.setTimeout).not.toHaveBeenCalled();
        expect(e.run).not.toHaveBeenCalled();
        expect(inspectSourceRefreshTasks(e.doc)).toMatchObject({
          sourceRefreshTasksCancelled: 1,
          pendingSourceRefreshTasks: 0,
        });
      } finally {
        e.queue.dispose();
      }
    }
  );

  it('leaves a successor admitted by a capability getter as the sole transport owner', () => {
    const e = environment();
    let entered = false;
    const getScheduler = vi.fn(() => {
      if (!entered) {
        entered = true;
        e.queue.cancel();
        expect(e.queue.schedule()).toBe(true);
      }
      return { postTask: e.postTask };
    });
    Object.defineProperty(e.win, 'scheduler', { get: getScheduler });
    try {
      expect(e.queue.schedule()).toBe(true);
      expect(getScheduler).toHaveBeenCalledTimes(2);
      expect(e.postTask).toHaveBeenCalledOnce();
      expect(e.signals[0].aborted).toBe(false);
      expect(inspectSourceRefreshTasks(e.doc)).toMatchObject({
        sourceRefreshTasksScheduled: 2,
        sourceRefreshTasksCancelled: 1,
        pendingSourceRefreshTasks: 1,
      });
      e.queue.dispose();
      expect(e.signals[0].aborted).toBe(true);
      e.callbacks.forEach((callback) => callback());
      expect(e.run).not.toHaveBeenCalled();
      expect(inspectSourceRefreshTasks(e.doc).pendingSourceRefreshTasks).toBe(0);
    } finally {
      e.queue.dispose();
    }
  });
});
