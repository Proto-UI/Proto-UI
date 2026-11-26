import { describe, expect, it, vi } from 'vitest';
import type { Prototype } from '@proto.ui/core';
import { createRuntimeSession, type CommitSignal, type RuntimeHost } from '../src';

function createBasicProto(name: string, onMounted?: () => void): Prototype {
  return {
    name,
    setup(def) {
      if (onMounted) def.lifecycle.onMounted(onMounted);
      return (r) => [r.el('div', 'ok')];
    },
  };
}

describe('runtime mount ticket terminal consistency', () => {
  it('rejects a reentrantly observed mounting promise when the mounting observer throws synchronously', async () => {
    let commits = 0;
    let observedPromise: Promise<void> | undefined;
    let session!: ReturnType<typeof createRuntimeSession>;
    const boom = new Error('mounting observer failed');

    const host: RuntimeHost<any> = {
      prototypeName: 'mount-reentry-throw',
      getRawProps: () => ({}),
      commit(_children, signal) {
        commits += 1;
        signal?.done();
      },
      schedule: (task) => queueMicrotask(task),
      onLifecycleEvent(event) {
        if (event.type === 'mount.phase' && event.phase === 'mounting' && event.epoch === 1) {
          observedPromise = session.mount();
          throw boom;
        }
      },
    };

    session = createRuntimeSession(createBasicProto('mount-reentry-throw'), host);

    expect(() => session.mount()).toThrow(boom);
    expect(commits).toBe(0);
    expect(session.mountPhase).toBe('detached');
    expect(observedPromise).toBeDefined();
    await expect(observedPromise).rejects.toBe(boom);

    // Subsequent mount recovers cleanly on epoch 2.
    await session.mount();
    expect(commits).toBe(1);
    expect(session.mountPhase).toBe('mounted');
    await session.dispose();
  });

  it('rejects a reentrantly observed mounting promise even when the observer unmounts before throwing a falsy value', async () => {
    let observedPromise: Promise<void> | undefined;
    let session!: ReturnType<typeof createRuntimeSession>;

    const host: RuntimeHost<any> = {
      prototypeName: 'mount-reentry-unmount-throw',
      getRawProps: () => ({}),
      commit(_children, signal) {
        signal?.done();
      },
      schedule: (task) => queueMicrotask(task),
      onLifecycleEvent(event) {
        if (event.type === 'mount.phase' && event.phase === 'mounting' && event.epoch === 1) {
          observedPromise = session.mount();
          void session.unmount();
          throw null;
        }
      },
    };

    session = createRuntimeSession(createBasicProto('mount-reentry-unmount-throw'), host);

    expect(() => session.mount()).toThrow();
    expect(observedPromise).toBeDefined();
    await expect(observedPromise).rejects.toBeNull();
    expect(session.mountPhase).toBe('detached');
    await session.dispose();
  });

  it('keeps legacy synchronous mount throws free of unhandled rejections when no caller observed the promise', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      const boom = new Error('sync mounting failure');
      const host: RuntimeHost<any> = {
        prototypeName: 'mount-sync-throw-unobserved',
        getRawProps: () => ({}),
        commit(_children, signal) {
          signal?.done();
        },
        schedule: (task) => queueMicrotask(task),
        onLifecycleEvent(event) {
          if (event.type === 'mount.phase' && event.phase === 'mounting') {
            throw boom;
          }
        },
      };
      const session = createRuntimeSession(createBasicProto('mount-sync-throw-unobserved'), host);
      expect(() => session.mount()).toThrow(boom);
      expect(session.mountPhase).toBe('detached');
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(unhandled).toEqual([]);
      await session.dispose();
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('rolls back to detached and rejects the mount ticket when an async CommitSignal.done observer throws', async () => {
    const pendingSignals: CommitSignal[] = [];
    const mounted = vi.fn();
    const boom = new Error('late commit.done observer failed');
    let failEpoch1 = true;

    const host: RuntimeHost<any> = {
      prototypeName: 'mount-async-commit-done-throw',
      getRawProps: () => ({}),
      commit(_children, signal) {
        if (signal) pendingSignals.push(signal);
      },
      schedule: (task) => queueMicrotask(task),
      onLifecycleEvent(event) {
        if (event.type === 'mount.commit.done' && event.epoch === 1 && failEpoch1) {
          failEpoch1 = false;
          throw boom;
        }
      },
    };

    const session = createRuntimeSession(
      createBasicProto('mount-async-commit-done-throw', mounted),
      host
    );

    const firstMount = session.mount();
    expect(session.mountPhase).toBe('mounting');
    expect(pendingSignals).toHaveLength(1);

    // Late async done() fails inside mount.commit.done observer; it must settle
    // the mount ticket instead of wedging the session in mounting forever.
    expect(() => pendingSignals[0]!.done()).not.toThrow();
    await expect(firstMount).rejects.toBe(boom);
    expect(session.mountPhase).toBe('detached');
    expect(mounted).not.toHaveBeenCalled();

    // Re-invoking the already-consumed signal is a no-op.
    expect(() => pendingSignals[0]!.done()).not.toThrow();

    // A fresh mount starts epoch 2 and completes cleanly.
    const secondMount = session.mount();
    expect(session.mountPhase).toBe('mounting');
    expect(pendingSignals).toHaveLength(2);
    pendingSignals[1]!.done();
    await secondMount;
    expect(session.mountPhase).toBe('mounted');
    expect(mounted).toHaveBeenCalledOnce();
    await session.dispose();
  });

  it('keeps a nested replacement alive and rejects only epoch 1 when an async CommitSignal.done observer replaces and throws', async () => {
    const pendingSignals: CommitSignal[] = [];
    const mounted = vi.fn();
    let session!: ReturnType<typeof createRuntimeSession>;
    let replacement: Promise<void> | undefined;

    const host: RuntimeHost<any> = {
      prototypeName: 'mount-async-commit-done-replace-throw',
      getRawProps: () => ({}),
      commit(_children, signal) {
        if (signal) pendingSignals.push(signal);
      },
      schedule: (task) => queueMicrotask(task),
      onLifecycleEvent(event) {
        if (event.type === 'mount.commit.done' && event.epoch === 1) {
          void session.unmount();
          replacement = session.mount();
          throw null;
        }
      },
    };

    session = createRuntimeSession(
      createBasicProto('mount-async-commit-done-replace-throw', mounted),
      host
    );

    const firstMount = session.mount();
    expect(pendingSignals).toHaveLength(1);

    expect(() => pendingSignals[0]!.done()).not.toThrow();
    await expect(firstMount).rejects.toBeNull();
    expect(replacement).toBeDefined();
    expect(session.mountPhase).toBe('mounting');
    expect(pendingSignals).toHaveLength(2);

    pendingSignals[1]!.done();
    await replacement;
    expect(session.mountPhase).toBe('mounted');
    expect(mounted).toHaveBeenCalledOnce();
    await session.dispose();
  });

  it('settles a cancelled replacement mount before its obsolete commit signal fires', async () => {
    const signals: CommitSignal[] = [];
    const mounted = vi.fn();
    let session!: ReturnType<typeof createRuntimeSession>;
    let replacementSettled = false;
    const host: RuntimeHost<any> = {
      prototypeName: 'mount-cancel-nested-replacement',
      getRawProps: () => ({}),
      commit(_children, signal) {
        if (signal) signals.push(signal);
      },
      schedule: (task) => queueMicrotask(task),
      onLifecycleEvent(event) {
        if (event.type === 'mount.commit.done' && event.epoch === 1) {
          void session.unmount();
          void session.mount().then(() => {
            replacementSettled = true;
          });
          void session.unmount();
        }
      },
    };

    session = createRuntimeSession(createBasicProto(host.prototypeName, mounted), host);
    const firstMount = session.mount();
    signals[0]!.done();
    await firstMount;
    expect(replacementSettled).toBe(true);
    expect(session.mountPhase).toBe('detached');
    expect(mounted).not.toHaveBeenCalled();
    signals[1]!.done();
    expect(session.mountPhase).toBe('detached');
    expect(mounted).not.toHaveBeenCalled();
    await session.dispose();
  });

  it('does not deadlock future updates if an async update CommitSignal.done observer throws', async () => {
    const pendingSignals: CommitSignal[] = [];
    const boom = new Error('update commit.done failed');
    let failFirstUpdate = true;
    const updatedRevisions: number[] = [];

    const host: RuntimeHost<any> = {
      prototypeName: 'update-async-commit-done-throw',
      getRawProps: () => ({}),
      commit(_children, signal) {
        if (signal) pendingSignals.push(signal);
      },
      schedule: (task) => queueMicrotask(task),
      onLifecycleEvent(event) {
        if (event.type === 'update.commit.done' && failFirstUpdate) {
          failFirstUpdate = false;
          throw boom;
        }
        if (event.type === 'update.updated') {
          updatedRevisions.push(event.revision);
        }
      },
    };

    const session = createRuntimeSession(createBasicProto('update-async-commit-done-throw'), host);
    const mountPromise = session.mount();
    pendingSignals.shift()!.done();
    await mountPromise;

    session.controller.update();
    expect(pendingSignals).toHaveLength(1);
    expect(() => pendingSignals.shift()!.done()).toThrow(boom);

    // Subsequent update must not be stuck behind stale update.inFlight = true.
    session.controller.update();
    expect(pendingSignals).toHaveLength(1);
    pendingSignals.shift()!.done();
    expect(updatedRevisions).toEqual([2]);
    await session.dispose();
  });
});
