import { asAccessible } from '@proto.ui/hooks';
import { describe, expect, it, vi } from 'vitest';
import { definePrototype, type Prototype } from '@proto.ui/core';
import { A11Y_PROJECT_CAP } from '@proto.ui/module-a11y';
import {
  createRuntimeSession,
  type CommitSignal,
  type RuntimeHost,
  type RuntimeLifecycleEvent,
} from '../../src';

function createControlledHost(options?: { project?: () => void }) {
  const signals: CommitSignal[] = [];
  const scheduled: Array<() => void> = [];
  const events: RuntimeLifecycleEvent[] = [];
  const host: RuntimeHost<any> = {
    prototypeName: 'lifecycle-transition-matrix',
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
      if (options?.project) {
        wiring.attach('a11y', [[A11Y_PROJECT_CAP, options.project]]);
      }
    },
  };
  return { host, signals, scheduled, events };
}

const simpleProto = (callbacks: string[] = []): Prototype =>
  definePrototype({
    name: 'lifecycle-transition-matrix',
    setup(def) {
      asAccessible().role('button');
      def.lifecycle.onMounted(() => callbacks.push('mounted'));
      def.lifecycle.onUpdated(() => callbacks.push('updated'));
      def.lifecycle.onUnmounted(() => callbacks.push('unmounted'));
      def.lifecycle.onBeforeDispose(() => callbacks.push('disposed'));
      return (run) => run.el('button', 'ok');
    },
  });

describe('runtime contract: lifecycle transition matrix (v1)', () => {
  it('invalidates a mount whose host commit completes after unmount', async () => {
    const project = vi.fn();
    const callbacks: string[] = [];
    const { host, signals, scheduled } = createControlledHost({ project });
    const session = createRuntimeSession(simpleProto(callbacks), host);

    const mounting = session.mount();
    expect(session.mountPhase).toBe('mounting');
    expect(signals).toHaveLength(1);

    await session.unmount();
    project.mockClear();
    signals.shift()!.done();
    await mounting;

    expect(scheduled).toHaveLength(0);
    expect(project).not.toHaveBeenCalled();
    expect(callbacks).toEqual(['unmounted']);
    expect(session.mountPhase).toBe('detached');
  });

  it('ignores stale update commit effects after a later mount epoch starts', async () => {
    const project = vi.fn();
    const callbacks: string[] = [];
    const { host, signals, scheduled } = createControlledHost({ project });
    const session = createRuntimeSession(simpleProto(callbacks), host);

    const firstMount = session.mount();
    signals.shift()!.done();
    scheduled.shift()!();
    await firstMount;
    project.mockClear();

    session.controller.update();
    const staleUpdate = signals.shift()!;
    await session.unmount();
    const secondMount = session.mount();
    const currentMount = signals.shift()!;
    project.mockClear();

    staleUpdate.done();
    expect(project).not.toHaveBeenCalled();
    expect(callbacks).toEqual(['mounted', 'unmounted']);

    currentMount.done();
    scheduled.shift()!();
    await secondMount;
    expect(project).toHaveBeenCalled();
    expect(callbacks).toEqual(['mounted', 'unmounted', 'mounted']);
  });

  it('terminal disposal wins over a pending mount commit and invalidates late acknowledgements', async () => {
    const project = vi.fn();
    const callbacks: string[] = [];
    const { host, signals, scheduled } = createControlledHost({ project });
    const session = createRuntimeSession(simpleProto(callbacks), host);

    const mounting = session.mount();
    const staleCommit = signals.shift()!;
    await session.dispose();
    project.mockClear();

    staleCommit.done();
    await mounting;
    expect(scheduled).toHaveLength(0);
    expect(project).not.toHaveBeenCalled();
    expect(callbacks).toEqual(['unmounted', 'disposed']);
    expect(session.instancePhase).toBe('disposed');
  });

  it('coalesces update intents while one update commit is in flight', async () => {
    const callbacks: string[] = [];
    let renders = 0;
    const { host, signals, scheduled, events } = createControlledHost();
    const proto = definePrototype({
      name: 'lifecycle-update-coalescing',
      setup(def) {
        def.lifecycle.onUpdated(() => callbacks.push('updated'));
        return (run) => {
          renders += 1;
          return run.el('div', String(renders));
        };
      },
    });
    const session = createRuntimeSession(proto, host);
    const mounting = session.mount();
    signals.shift()!.done();
    scheduled.shift()!();
    await mounting;

    session.controller.update();
    session.controller.update();
    session.controller.update();
    expect(renders).toBe(2);
    expect(signals).toHaveLength(1);

    signals.shift()!.done();
    expect(renders).toBe(3);
    expect(signals).toHaveLength(1);
    signals.shift()!.done();

    expect(callbacks).toEqual(['updated', 'updated']);
    expect(events.filter((event) => event.type === 'update.updated')).toEqual([
      { type: 'update.updated', epoch: 1, revision: 1 },
      { type: 'update.updated', epoch: 1, revision: 2 },
    ]);
  });

  it('reaches detached/disposed terminal phases even when callbacks throw', async () => {
    const { host, signals, scheduled } = createControlledHost();
    const proto = definePrototype({
      name: 'lifecycle-callback-error-convergence',
      setup(def) {
        def.lifecycle.onUnmounted(() => {
          throw new Error('unmounted failure');
        });
        def.lifecycle.onBeforeDispose(() => {
          throw new Error('dispose failure');
        });
        return (run) => run.el('div', 'ok');
      },
    });
    const session = createRuntimeSession(proto, host);
    const mounting = session.mount();
    signals.shift()!.done();
    scheduled.shift()!();
    await mounting;

    await expect(session.unmount()).rejects.toThrow('unmounted failure');
    expect(session.mountPhase).toBe('detached');

    await expect(session.dispose()).rejects.toThrow('dispose failure');
    expect(session.instancePhase).toBe('disposed');
  });
});
