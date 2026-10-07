import { describe, expect, it, vi } from 'vitest';
import { cap as createCap } from '@proto.ui/core';
import { createDeferredOwnerDisposal, createViewEpochOwner } from '../src';

describe('adapter-base: view epoch owner', () => {
  it('rebinds view epochs without recreating or disposing the Proto session', async () => {
    const owner = createViewEpochOwner<any>({ prototypeName: 'x-view-owner' });
    const calls: string[] = [];
    const session = {
      viewIntent: {
        getSnapshot: () => ({ present: true, version: 0 }),
        subscribe: () => () => {},
      },
      mount: vi.fn(async () => calls.push('mount')),
      unmount: vi.fn(async () => calls.push('unmount')),
      dispose: vi.fn(async () => calls.push('dispose')),
    } as any;
    const createSession = vi.fn(() => session);

    owner.attachView({
      modules: { event: () => [] },
      disposeView: () => calls.push('view:1.dispose'),
      createSession,
    });
    await owner.detachView();

    owner.attachView({
      modules: { event: () => [] },
      disposeView: () => calls.push('view:2.dispose'),
      createSession,
    });

    expect(createSession).toHaveBeenCalledOnce();
    expect(session.mount).toHaveBeenCalledOnce();
    expect(calls).toEqual(['unmount', 'view:1.dispose', 'mount']);

    await owner.dispose();
    expect(calls).toEqual(['unmount', 'view:1.dispose', 'mount', 'dispose', 'view:2.dispose']);
  });

  for (const cleanupThrows of [false, true])
    it(`rolls back a synchronous remount failure and accepts a retry (cleanupThrows=${cleanupThrows})`, async () => {
      const owner = createViewEpochOwner<any>({ prototypeName: 'failed-remount' });
      const active = new Map<string, unknown>();
      const ownerCap = createCap<string>('test/owner');
      const viewCap = createCap<string>('test/view');
      const failure = new Error('first material frame failed');
      const session = {
        viewIntent: {
          getSnapshot: () => ({ present: true, version: 0 }),
          subscribe: () => () => {},
        },
        mount: vi.fn(),
        unmount: vi.fn(async () => {}),
        dispose: vi.fn(async () => {}),
      } as any;
      const createSession = (wiring: any) => {
        wiring.onRuntimeReady({
          attach: (name: string, entries: unknown) => {
            active.set(name, entries);
            return true;
          },
          reset: (name: string) => {
            active.delete(name);
          },
        });
        return session;
      };
      owner.initialize({ modules: { feedback: () => [[ownerCap, 'owner']] }, createSession });
      owner.attachView({
        modules: { feedback: () => [[viewCap, 'first']] },
        disposeView: vi.fn(),
        createSession,
      });
      await owner.detachView();
      session.mount.mockImplementationOnce(() => {
        throw failure;
      });
      const release = vi.fn(() => {
        if (cleanupThrows) throw new Error('cleanup failed');
      });
      expect(() =>
        owner.attachView({
          modules: { feedback: () => [[viewCap, 'failed']] },
          disposeView: release,
          createSession,
        })
      ).toThrow(failure);
      expect(owner.hasView).toBe(false);
      expect(release).toHaveBeenCalledOnce();
      expect(active.get('feedback')).toEqual([[ownerCap, 'owner']]);
      const retry = vi.fn();
      owner.attachView({
        modules: { feedback: () => [[viewCap, 'retry']] },
        disposeView: retry,
        createSession,
      });
      expect(owner.hasView).toBe(true);
      expect(active.get('feedback')).toEqual([[viewCap, 'retry']]);
      expect(session.mount).toHaveBeenCalledTimes(3);
      await owner.dispose();
      expect(retry).toHaveBeenCalledOnce();
    });

  for (const reentry of ['unmount', 'disposer'] as const)
    it(`preserves a replacement attached during failed-view ${reentry}`, async () => {
      const owner = createViewEpochOwner<any>({ prototypeName: 'reentrant-rollback' });
      const active = new Map<string, unknown>();
      const cap = createCap<string>('test/cap');
      const failure = new Error('failed first frame');
      const session = {
        viewIntent: {
          getSnapshot: () => ({ present: true, version: 0 }),
          subscribe: () => () => {},
        },
        mount: vi.fn().mockImplementationOnce(() => {
          throw failure;
        }),
        unmount: vi.fn(async () => {}),
        dispose: vi.fn(async () => {}),
      } as any;
      const createSession = (wiring: any) => {
        wiring.onRuntimeReady({
          attach: (name: string, entries: unknown) => {
            active.set(name, entries);
            return true;
          },
          reset: (name: string) => {
            active.delete(name);
          },
        });
        return session;
      };
      owner.initialize({ modules: { feedback: () => [[cap, 'owner']] }, createSession });
      const replacementRelease = vi.fn();
      const replace = () =>
        owner.attachView({
          modules: { feedback: () => [[cap, 'replacement']] },
          disposeView: replacementRelease,
          createSession,
        });
      if (reentry === 'unmount')
        session.unmount.mockImplementationOnce(async () => {
          replace();
        });
      const failedRelease = vi.fn(() => {
        if (reentry === 'disposer') replace();
      });
      expect(() =>
        owner.attachView({
          modules: { feedback: () => [[cap, 'failed']] },
          disposeView: failedRelease,
          createSession,
        })
      ).toThrow(failure);
      expect(owner.hasView).toBe(true);
      expect(failedRelease).toHaveBeenCalledOnce();
      expect(replacementRelease).not.toHaveBeenCalled();
      expect(active.get('feedback')).toEqual([[cap, 'replacement']]);
      await owner.dispose();
      expect(replacementRelease).toHaveBeenCalledOnce();
    });

  it('preserves a newer lease when synchronous mount reuses the same disposer', async () => {
    const owner = createViewEpochOwner<any>({ prototypeName: 'same-disposer-lease' });
    const cap = createCap<string>('test/reused-disposer');
    const active = new Map<string, unknown>();
    const failure = new Error('old mount failure');
    const session = {
      viewIntent: { getSnapshot: () => ({ present: true, version: 0 }), subscribe: () => () => {} },
      mount: vi.fn(),
      unmount: vi.fn(async () => {}),
      dispose: vi.fn(async () => {}),
    } as any;
    const createSession = (wiring: any) => {
      wiring.onRuntimeReady({
        attach: (name: string, entries: unknown) => {
          active.set(name, entries);
          return true;
        },
        reset: (name: string) => {
          active.delete(name);
        },
      });
      return session;
    };
    owner.initialize({ modules: { feedback: () => [[cap, 'owner']] }, createSession });
    const release = vi.fn();
    session.mount.mockImplementationOnce(() => {
      owner.attachView({
        modules: { feedback: () => [[cap, 'new']] },
        disposeView: release,
        createSession,
      });
      throw failure;
    });
    expect(() =>
      owner.attachView({
        modules: { feedback: () => [[cap, 'old']] },
        disposeView: release,
        createSession,
      })
    ).toThrow(failure);
    expect(owner.hasView).toBe(true);
    expect(active.get('feedback')).toEqual([[cap, 'new']]);
    expect(release).toHaveBeenCalledOnce();
    await owner.dispose();
    expect(release).toHaveBeenCalledTimes(2);
  });

  it('initializes one detached session and forwards versioned view intent before any view exists', async () => {
    const owner = createViewEpochOwner<any>({ prototypeName: 'x-detached-owner' });
    const intentListeners = new Set<(snapshot: { present: boolean; version: number }) => void>();
    let snapshot = { present: false, version: 1 };
    const calls: string[] = [];
    const session = {
      viewIntent: {
        getSnapshot: () => snapshot,
        subscribe(listener: (next: typeof snapshot) => void) {
          intentListeners.add(listener);
          return () => intentListeners.delete(listener);
        },
      },
      mount: vi.fn(async () => calls.push('mount')),
      unmount: vi.fn(async () => calls.push('unmount')),
      dispose: vi.fn(async () => calls.push('dispose')),
    } as any;
    const onViewIntent = vi.fn();

    owner.initialize({
      modules: {},
      createSession: () => session,
      onViewIntent,
    });

    expect(owner.session).toBe(session);
    expect(owner.hasView).toBe(false);
    expect(owner.viewIntent).toEqual({ present: false, version: 1 });
    expect(onViewIntent).toHaveBeenLastCalledWith({ present: false, version: 1 });
    expect(session.mount).not.toHaveBeenCalled();

    snapshot = { present: true, version: 2 };
    for (const listener of intentListeners) listener(snapshot);
    expect(owner.viewIntent).toEqual({ present: true, version: 2 });

    owner.attachView({
      modules: { event: () => [] },
      disposeView: () => calls.push('view.dispose'),
      createSession: () => {
        throw new Error('must reuse detached session');
      },
    });
    expect(session.mount).toHaveBeenCalledOnce();

    await owner.dispose();
    expect(intentListeners.size).toBe(0);
    expect(calls).toEqual(['mount', 'dispose', 'view.dispose']);
  });

  it('defers terminal owner disposal and cancels it when ownership is retained', async () => {
    const dispose = vi.fn();
    const scheduler = createDeferredOwnerDisposal(dispose);

    scheduler.release();
    scheduler.retain();
    await Promise.resolve();
    expect(dispose).not.toHaveBeenCalled();

    scheduler.release();
    await Promise.resolve();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('rolls back failed detached initialization so the owner remains retryable', () => {
    const owner = createViewEpochOwner<any>({ prototypeName: 'x-retry-owner' });
    const createSession = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('setup failed');
      })
      .mockImplementationOnce(() => ({
        viewIntent: {
          getSnapshot: () => ({ present: true, version: 1 }),
          subscribe: () => () => {},
        },
        mount: vi.fn(),
        unmount: vi.fn(),
        dispose: vi.fn(),
      }));

    expect(() =>
      owner.initialize({
        modules: {},
        createSession,
      })
    ).toThrow('setup failed');
    expect(owner.session).toBeNull();
    expect(owner.viewIntent).toBeNull();

    expect(() =>
      owner.initialize({
        modules: {},
        createSession,
      })
    ).not.toThrow();
    expect(owner.session).not.toBeNull();
    expect(createSession).toHaveBeenCalledTimes(2);
  });
});

describe('adapter-base: exceptional view cleanup', () => {
  it('rebinds owner capabilities after a real runtime view disposer throws', async () => {
    const { definePrototype } = await import('@proto.ui/core');
    const { asFocusable } = await import('@proto.ui/hooks');
    const { createAdapterHost } = await import('../src');
    const {
      FOCUS_INSTANCE_TOKEN_CAP,
      FOCUS_PARENT_CAP,
      FOCUS_ROOT_TARGET_CAP,
      FOCUS_REQUEST_FOCUS_CAP,
    } = await import('@proto.ui/module-focus');
    let target: any;
    const proto = definePrototype({
      name: 'exceptional-view-caps',
      setup() {
        target = asFocusable();
      },
    });
    const token = {};
    const ownerModules = {
      focus: () =>
        [
          [FOCUS_INSTANCE_TOKEN_CAP, token],
          [FOCUS_PARENT_CAP, () => null],
        ] as const,
    };
    const requested: HTMLElement[] = [];
    const physical = document.createElement('button');
    const { EVENT_ROOT_TARGET_CAP, EVENT_GLOBAL_TARGET_CAP } =
      await import('@proto.ui/module-event');
    const viewModules = {
      event: () =>
        [
          [EVENT_ROOT_TARGET_CAP, () => physical],
          [EVENT_GLOBAL_TARGET_CAP, () => document],
        ] as any,
      focus: () =>
        [
          ...ownerModules.focus(),
          [FOCUS_ROOT_TARGET_CAP, () => physical],
          [
            FOCUS_REQUEST_FOCUS_CAP,
            (node: HTMLElement) => {
              requested.push(node);
              return false;
            },
          ],
        ] as any,
    };
    const owner = createViewEpochOwner({ prototypeName: proto.name });
    const session = owner.initialize({
      modules: ownerModules,
      createSession: (wiring) =>
        createAdapterHost(
          proto,
          {
            getRawProps: () => ({}),
            schedule: (task) => task(),
            commit: (_children, signal) => signal?.done(),
          },
          { onRuntimeReady: wiring.onRuntimeReady, afterUnmount: wiring.afterUnmount },
          { initialMount: 'manual' }
        ),
    });
    const failure = new Error('view release failure');
    owner.attachView({
      modules: viewModules,
      disposeView: () => {
        throw failure;
      },
      createSession: () => session,
    });
    await session.mount();
    let caught: unknown;
    try {
      owner.detachView();
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(failure);
    expect(owner.hasView).toBe(false);
    requested.length = 0;
    session.invokeInCallbackScope(() => target.focus());
    try {
      expect(requested).toEqual([]);
    } finally {
      await owner.dispose();
    }
  });

  it('preserves a newer epoch attached reentrantly by the old disposer', async () => {
    const owner = createViewEpochOwner<any>({ prototypeName: 'exceptional-reentrant-view' });
    let currentCaps: unknown;
    const api = {
      attach: (_name: string, entries: unknown) => {
        currentCaps = entries;
        return true;
      },
      reset: () => {
        currentCaps = undefined;
      },
    };
    const session = {
      viewIntent: { getSnapshot: () => ({ present: true, version: 0 }), subscribe: () => () => {} },
      mount: vi.fn(async () => {}),
      unmount: vi.fn(async () => {}),
      dispose: vi.fn(async () => {}),
    } as any;
    owner.initialize({
      modules: { focus: () => [['epoch', 'owner']] as any },
      createSession: (wiring) => {
        wiring.onRuntimeReady(api as any);
        return session;
      },
    });
    const newDispose = vi.fn();
    const failure = new Error('old disposer failed after replacement');
    owner.attachView({
      modules: { focus: () => [['epoch', 'old']] as any },
      createSession: () => session,
      disposeView: () => {
        owner.attachView({
          modules: { focus: () => [['epoch', 'new']] as any },
          disposeView: newDispose,
          createSession: () => session,
        });
        throw failure;
      },
    });
    let caught: unknown;
    try {
      owner.detachView();
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(failure);
    expect(owner.hasView).toBe(true);
    expect(currentCaps).toEqual([['epoch', 'new']]);
    expect(newDispose).not.toHaveBeenCalled();
    await owner.dispose();
    expect(newDispose).toHaveBeenCalledTimes(1);
  });

  it('releases the view even when terminal session disposal throws synchronously', () => {
    const owner = createViewEpochOwner<any>({ prototypeName: 'exceptional-terminal-view' });
    const failure = new Error('session disposal failed');
    const unsubscribe = vi.fn();
    const session = {
      viewIntent: {
        getSnapshot: () => ({ present: true, version: 0 }),
        subscribe: () => unsubscribe,
      },
      mount: vi.fn(async () => {}),
      unmount: vi.fn(async () => {}),
      dispose: () => {
        throw failure;
      },
    } as any;
    owner.initialize({ modules: {}, createSession: () => session });
    const release = vi.fn();
    owner.attachView({ modules: {}, disposeView: release, createSession: () => session });
    expect(() => owner.dispose()).toThrow(failure);
    expect(release).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(owner.hasView).toBe(false);
  });
});

function fixture() {
  const owner = createViewEpochOwner<any>({ prototypeName: 'review-epoch-owner' });
  const caps = new Map<string, unknown>();
  const session = {
    viewIntent: { getSnapshot: () => ({ present: true, version: 0 }), subscribe: () => () => {} },
    mount: vi.fn(async () => {}),
    unmount: vi.fn(() => Promise.resolve()),
    dispose: vi.fn(() => Promise.resolve()),
  };
  owner.initialize({
    modules: { focus: () => [['id', 'owner']] as any },
    createSession(wiring) {
      wiring.onRuntimeReady({
        attach(name: string, entries: unknown) {
          caps.set(name, entries);
          return true;
        },
        reset(name: string) {
          caps.delete(name);
        },
      } as any);
      return session as any;
    },
  });
  function attach(id: string, dispose = () => {}) {
    owner.attachView({
      modules: { focus: () => [['id', id]] as any },
      disposeView: dispose,
      createSession: () => session as any,
    });
  }
  return { owner, caps, session, attach };
}
it('cleanup still runs on synchronous session unmount error and original error wins', () => {
  const f = fixture(),
    error = new Error('unmount-original'),
    cleanup = vi.fn(() => {
      throw new Error('cleanup-secondary');
    });
  f.attach('old', cleanup);
  f.session.unmount.mockImplementation(() => {
    throw error;
  });
  expect(() => f.owner.detachView()).toThrow(error);
  expect(cleanup).toHaveBeenCalledOnce();
  expect(f.owner.hasView).toBe(false);
  expect(f.caps.get('focus')).toEqual([['id', 'owner']]);
  f.owner.dispose();
});
it('a reentrant replacement from session unmount survives the previous detach', async () => {
  const f = fixture(),
    oldDispose = vi.fn(),
    nextDispose = vi.fn();
  f.attach('old', oldDispose);
  f.session.unmount.mockImplementation(() => {
    f.attach('new', nextDispose);
    return Promise.resolve();
  });
  await f.owner.detachView();
  expect(oldDispose).toHaveBeenCalledOnce();
  expect(nextDispose).not.toHaveBeenCalled();
  expect(f.owner.hasView).toBe(true);
  expect(f.caps.get('focus')).toEqual([['id', 'new']]);
  await f.owner.dispose();
  expect(nextDispose).toHaveBeenCalledOnce();
});
it('a rejected session unmount promise retains its error after synchronous cleanup', async () => {
  const f = fixture(),
    error = new Error('async-unmount'),
    cleanup = vi.fn();
  f.attach('old', cleanup);
  f.session.unmount.mockImplementation(() => Promise.reject(error));
  await expect(f.owner.detachView()).rejects.toBe(error);
  expect(cleanup).toHaveBeenCalledOnce();
  expect(f.owner.hasView).toBe(false);
  expect(f.caps.get('focus')).toEqual([['id', 'owner']]);
  await f.owner.dispose();
});

for (const action of ['detachView', 'dispose'] as const) {
  it(`${action} observes an abandoned async rejection when cleanup throws synchronously`, async () => {
    const f = fixture();
    const syncError = new Error('synchronous cleanup');
    const asyncError = new Error('asynchronous session release');
    const result = Promise.reject(asyncError);
    const observe = vi.spyOn(result, 'catch');
    f.attach('old', () => {
      throw syncError;
    });
    f.session[action === 'detachView' ? 'unmount' : 'dispose'].mockReturnValue(result);
    expect(() => f.owner[action]()).toThrow(syncError);
    expect(observe).toHaveBeenCalledOnce();
    expect(f.owner.hasView).toBe(false);
    await Promise.resolve();
    if (action === 'detachView') await f.owner.dispose();
  });
}
