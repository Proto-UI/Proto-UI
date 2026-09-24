import { asAccessible } from '@proto.ui/hooks';
import { definePrototype } from '@proto.ui/core';
import { A11Y_PROJECT_CAP } from '@proto.ui/module-a11y';
import { describe, expect, it, vi } from 'vitest';
import {
  createRuntimeSession,
  type CommitSignal,
  type RuntimeHost,
  type RuntimeLifecycleEvent,
} from '../../src';

function createFixture(options?: { unmounted?: () => void; updated?: () => void }) {
  const signals: CommitSignal[] = [];
  const scheduled: Array<() => void> = [];
  const events: RuntimeLifecycleEvent[] = [];
  const callbacks: string[] = [];
  const project = vi.fn();
  let renders = 0;
  const host: RuntimeHost<any> = {
    prototypeName: 'lifecycle-update-epoch',
    getRawProps: () => ({}),
    commit(_children, signal) {
      if (signal) signals.push(signal);
    },
    schedule(task) {
      scheduled.push(task);
    },
    onLifecycleEvent(event) {
      events.push(event);
    },
    onRuntimeReady(wiring) {
      wiring.attach('a11y', [[A11Y_PROJECT_CAP, project]]);
    },
  };
  const proto = definePrototype({
    name: 'lifecycle-update-epoch',
    setup(def) {
      asAccessible().role('button');
      def.lifecycle.onMounted(() => callbacks.push('mounted'));
      def.lifecycle.onUpdated(() => {
        callbacks.push('updated');
        options?.updated?.();
      });
      def.lifecycle.onUnmounted(() => {
        callbacks.push('unmounted');
        options?.unmounted?.();
      });
      def.lifecycle.onBeforeDispose(() => callbacks.push('disposed'));
      return (run) => {
        renders += 1;
        return run.el('button', String(renders));
      };
    },
  });
  const session = createRuntimeSession(proto, host);
  const mount = () => {
    const mounting = session.mount();
    signals.shift()!.done();
    scheduled.shift()!();
    return mounting;
  };
  return { session, host, signals, events, callbacks, project, mount, renders: () => renders };
}

describe('runtime contract: update ownership across view epochs (v1)', () => {
  it.each(['before', 'pending', 'queued', 'after', 'never'] as const)(
    'keeps the new epoch live when the old acknowledgement arrives %s',
    async (timing) => {
      const { session, signals, events, callbacks, project, mount, renders } = createFixture();
      await mount();
      session.controller.update();
      const stale = signals.shift()!;
      session.controller.update();
      await session.unmount();
      await mount();
      expect(session.mountEpoch).toBe(2);
      expect(renders()).toBe(3);

      const acknowledgeStale = () => {
        const trace = [...events];
        const calls = [...callbacks];
        const renderCount = renders();
        const pending = [...signals];
        project.mockClear();
        stale.done();
        stale.done();
        expect(events).toEqual(trace);
        expect(callbacks).toEqual(calls);
        expect(renders()).toBe(renderCount);
        expect(signals).toEqual(pending);
        expect(project).not.toHaveBeenCalled();
      };
      if (timing === 'before') acknowledgeStale();
      session.controller.update();
      expect(renders()).toBe(4);
      expect(signals).toHaveLength(1);
      if (timing === 'pending') acknowledgeStale();
      session.controller.update();
      session.controller.update();
      expect(renders()).toBe(4);
      expect(signals).toHaveLength(1);
      if (timing === 'queued') acknowledgeStale();

      signals.shift()!.done();
      expect(renders()).toBe(5);
      expect(signals).toHaveLength(1);
      signals.shift()!.done();
      if (timing === 'after') acknowledgeStale();
      expect(signals).toHaveLength(0);
      expect(callbacks).toEqual(['mounted', 'unmounted', 'mounted', 'updated', 'updated']);
      expect(events.filter((event) => event.type === 'update.updated')).toEqual([
        { type: 'update.updated', epoch: 2, revision: 2 },
        { type: 'update.updated', epoch: 2, revision: 3 },
      ]);
      await session.dispose();
    }
  );

  it('invalidates pending and queued updates on terminal disposal', async () => {
    const { session, signals, events, callbacks, project, mount, renders } = createFixture();
    await mount();
    session.controller.update();
    const stale = signals.shift()!;
    session.controller.update();
    await session.dispose();
    const trace = [...events];
    project.mockClear();
    stale.done();
    session.controller.update();
    expect(events).toEqual(trace);
    expect(project).not.toHaveBeenCalled();
    expect(callbacks).toEqual(['mounted', 'unmounted', 'disposed']);
    expect(renders()).toBe(2);
    expect(signals).toHaveLength(0);
    await expect(session.mount()).rejects.toThrow(/disposed/);
  });

  it('releases an obsolete update even when the unmounted callback throws', async () => {
    const { session, signals, mount, renders } = createFixture({
      unmounted: vi.fn().mockImplementationOnce(() => {
        throw new Error('unmounted failure');
      }),
    });
    await mount();
    session.controller.update();
    const stale = signals.shift()!;
    await expect(session.unmount()).rejects.toThrow('unmounted failure');
    expect(session.mountPhase).toBe('detached');
    await mount();
    session.controller.update();
    expect(renders()).toBe(4);
    expect(signals).toHaveLength(1);
    stale.done();
    signals.shift()!.done();
    await session.dispose();
  });

  it('does not consume a replacement epoch queue from an updated callback', async () => {
    const { session, signals, mount, renders } = createFixture({
      updated: vi.fn().mockImplementationOnce(() => {
        void session.unmount();
        void mount();
        session.controller.update();
        session.controller.update();
      }),
    });
    await mount();
    session.controller.update();
    const first = signals.shift()!;
    session.controller.update();
    first.done();
    expect(session.mountEpoch).toBe(2);
    expect(renders()).toBe(4);
    expect(signals).toHaveLength(1);
    signals.shift()!.done();
    expect(renders()).toBe(5);
    expect(signals).toHaveLength(1);
    signals.shift()!.done();
    expect(signals).toHaveLength(0);
    await session.dispose();
  });

  it('does not replay an obsolete queue when an updated callback remounts the view', async () => {
    const { session, signals, mount, renders } = createFixture({
      updated: vi.fn().mockImplementationOnce(() => {
        void session.unmount();
        void mount();
      }),
    });
    await mount();
    session.controller.update();
    session.controller.update();
    signals.shift()!.done();
    expect(session.mountEpoch).toBe(2);
    expect(renders()).toBe(3);
    expect(signals).toHaveLength(0);
    await session.dispose();
  });

  it('does not clear a replacement update when an obsolete host commit throws', async () => {
    const { session, host, signals, mount, renders } = createFixture();
    await mount();
    const commit = host.commit;
    host.commit = () => {
      host.commit = commit;
      void session.unmount();
      void mount();
      session.controller.update();
      session.controller.update();
      throw new Error('old commit failure');
    };
    expect(() => session.controller.update()).toThrow('old commit failure');
    expect(session.mountEpoch).toBe(2);
    expect(renders()).toBe(4);
    expect(signals).toHaveLength(1);
    session.controller.update();
    expect(renders()).toBe(4);
    expect(signals).toHaveLength(1);
    signals.shift()!.done();
    expect(renders()).toBe(5);
    signals.shift()!.done();
    expect(signals).toHaveLength(0);
    await session.dispose();
  });

  it('retains same-epoch queued intent when a deferred updated callback throws', async () => {
    const { session, signals, mount, renders } = createFixture({
      updated: vi.fn().mockImplementationOnce(() => {
        throw new Error('updated failure');
      }),
    });
    await mount();
    session.controller.update();
    session.controller.update();
    expect(() => signals.shift()!.done()).toThrow('updated failure');
    expect(renders()).toBe(2);
    expect(signals).toHaveLength(0);

    session.controller.update();
    expect(renders()).toBe(3);
    signals.shift()!.done();
    expect(renders()).toBe(4);
    expect(signals).toHaveLength(1);
    signals.shift()!.done();
    expect(signals).toHaveLength(0);
    await session.dispose();
  });

  it.each([false, true])('preserves fail-fast updated callbacks (synchronous=%s)', async (sync) => {
    const { session, host, signals, mount, renders } = createFixture({
      updated: vi.fn().mockImplementationOnce(() => {
        throw new Error('updated failure');
      }),
    });
    await mount();
    if (sync) host.commit = (_children, signal) => signal?.done();
    if (sync) expect(() => session.controller.update()).toThrow('updated failure');
    else {
      session.controller.update();
      expect(() => signals.shift()!.done()).toThrow('updated failure');
    }
    session.controller.update();
    expect(renders()).toBe(3);
    if (!sync) signals.shift()!.done();
    await session.dispose();
  });
});
