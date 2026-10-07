import { FINAL_STYLE_SINK_CAP } from '../../../modules/feedback/src/material/final-style-sink';
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
  for (const stage of ['begin', 'unmounted'] as const)
    for (const throws of [false, true])
      it(`does not repeat unmount callbacks when disposal reenters from ${stage} (throws=${throws})`, async () => {
        const { host, signals, scheduled, events } = createControlledHost();
        const failure = new Error('unmount callback after disposal reentry');
        let terminal: Promise<void> | undefined;
        let session: ReturnType<typeof createRuntimeSession>;
        let alive!: { get(): boolean };
        const reenter = () => {
          terminal = session.dispose();
          void terminal.catch(() => {});
          expect(alive.get()).toBe(true);
          if (throws) throw failure;
        };
        const begin = vi.fn(() => {
          if (stage === 'begin') reenter();
        });
        host.onUnmountBegin = begin;
        const before = vi.fn();
        const unmounted = vi.fn(() => {
          if (stage === 'unmounted') reenter();
          expect(alive.get()).toBe(true);
        });
        const proto = definePrototype({
          name: 'dispose-from-unmounted',
          setup(def) {
            alive = def.state.bool('alive', true);
            def.lifecycle.onUnmounted(unmounted);
            def.lifecycle.onBeforeDispose(before);
            return (run) => run.el('div', 'ok');
          },
        });
        session = createRuntimeSession(proto, host);
        const mounting = session.mount();
        signals.shift()!.done();
        scheduled.shift()!();
        await mounting;
        const unmounting = session.unmount();
        if (throws) {
          await expect(unmounting).rejects.toBe(failure);
          await expect(terminal).rejects.toBe(failure);
        } else {
          await unmounting;
          await terminal;
        }
        expect(unmounted).toHaveBeenCalledOnce();
        expect(begin).toHaveBeenCalledOnce();
        expect(before).toHaveBeenCalledOnce();
        expect(events.filter((event) => event.type === 'unmount.begin')).toHaveLength(1);
        expect(events.filter((event) => event.type === 'unmount.done')).toHaveLength(1);
        expect(session.instancePhase).toBe('disposed');
        expect(session.mountPhase).toBe('detached');
      });

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

  for (const throws of [false, true])
    it(`shares exact-once disposal with a reentrant material release (throws=${throws})`, async () => {
      const { host, signals, scheduled, events } = createControlledHost();
      const before = vi.fn();
      const failure = new Error('release after reentry');
      let nested: Promise<void> | undefined;
      let session: ReturnType<typeof createRuntimeSession>;
      const release = vi.fn(() => {
        nested = session.dispose();
        if (throws) throw failure;
      });
      host.onRuntimeReady = (wiring) => {
        wiring.attach('feedback', [[FINAL_STYLE_SINK_CAP, { commit() {}, release }]]);
      };
      const proto = definePrototype({
        name: 'reentrant-material-retirement',
        setup(def) {
          def.lifecycle.onBeforeDispose(before);
          return (run) => run.el('div', 'ok');
        },
      });
      session = createRuntimeSession(proto, host);
      const mounting = session.mount();
      signals.shift()!.done();
      scheduled.shift()!();
      await mounting;
      const outer = session.dispose();
      expect(nested).toBe(outer);
      expect(session.instancePhase).toBe('disposed');
      expect(session.mountPhase).toBe('detached');
      if (throws) await expect(outer).rejects.toBe(failure);
      else await expect(outer).resolves.toBeUndefined();
      expect(before).toHaveBeenCalledOnce();
      expect(release).toHaveBeenCalledOnce();
      expect(events.filter((event) => event.type === 'instance.dispose.done')).toHaveLength(1);
      await expect(session.dispose()).resolves.toBeUndefined();
    });

  it('preserves a release error while a later host unmount callback also fails', async () => {
    const { host, signals, scheduled } = createControlledHost();
    const first = new Error('first release');
    host.onRuntimeReady = (wiring) => {
      wiring.attach('feedback', [
        [
          FINAL_STYLE_SINK_CAP,
          {
            commit() {},
            release() {
              throw first;
            },
          },
        ],
      ]);
    };
    host.onUnmountBegin = () => {
      throw new Error('second host');
    };
    const session = createRuntimeSession(simpleProto(), host);
    const mounting = session.mount();
    signals.shift()!.done();
    scheduled.shift()!();
    await mounting;
    await expect(session.dispose()).rejects.toBe(first);
    expect(session.mountPhase).toBe('detached');
    expect(session.instancePhase).toBe('disposed');
  });

  it('retires later modules and the session after a material sink release throws', async () => {
    const { host, signals, scheduled, events } = createControlledHost();
    let state: ReturnType<Parameters<Prototype['setup']>[0]['state']['bool']>;
    const release = vi.fn(() => {
      throw new Error('sink release failed');
    });
    host.onRuntimeReady = (wiring) => {
      wiring.attach('feedback', [[FINAL_STYLE_SINK_CAP, { commit() {}, release }]]);
    };
    const proto = definePrototype({
      name: 'material-release-convergence',
      setup(def) {
        state = def.state.bool('retired', false);
        return (run) => run.el('div', 'ok');
      },
    });
    const session = createRuntimeSession(proto, host);
    const mounting = session.mount();
    signals.shift()!.done();
    scheduled.shift()!();
    await mounting;
    await expect(session.dispose()).rejects.toThrow('sink release failed');
    expect(session.instancePhase).toBe('disposed');
    expect(() => state.get()).toThrow(/disposed/);
    expect(events.some((event) => event.type === 'instance.dispose.done')).toBe(true);
    await expect(session.dispose()).resolves.toBeUndefined();
    expect(release).toHaveBeenCalledOnce();
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
