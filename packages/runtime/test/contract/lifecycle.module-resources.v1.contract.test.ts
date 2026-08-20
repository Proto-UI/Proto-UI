import { describe, expect, it, vi } from 'vitest';
import {
  definePrototype,
  HOST_ELEMENT_CAP,
  tw,
  type EffectsPort,
  type OwnedStateHandle,
  type Prototype,
  type A11ySemanticObjectSnapshot,
} from '@proto.ui/core';
import { A11Y_PROJECT_CAP } from '@proto.ui/module-a11y';
import { asOverlay } from '@proto.ui/hooks';
import { EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
import { EXPOSES_RECORD_SINK_CAP } from '@proto.ui/module-expose-state';
import { EFFECTS_CAP, type FeedbackPort } from '@proto.ui/module-feedback';
import {
  HIT_PARTICIPATION_HOST_BRIDGE_CAP,
  type HitParticipationPort,
} from '@proto.ui/module-hit-participation';
import { OVERLAY_GLOBAL_MOUNT_CAP, OVERLAY_MODAL_CAP } from '@proto.ui/module-overlay';
import { createRuntimeSession, type RuntimeHost } from '../../src';

function createImmediateHost(
  onRuntimeReady?: NonNullable<RuntimeHost<any>['onRuntimeReady']>
): RuntimeHost<any> {
  return {
    prototypeName: 'lifecycle-module-resources',
    getRawProps: () => ({}),
    commit(_children, signal) {
      signal?.done();
    },
    schedule(task) {
      task();
    },
    onRuntimeReady,
  };
}

describe('runtime contract: lifecycle module resource ownership (v1)', () => {
  it('keeps Expose Event declarations across view epochs and invalidates emit at disposal', async () => {
    const emitted: string[] = [];
    let retainedRun: any;
    const proto = definePrototype({
      name: 'lifecycle-expose-event-resource-owner',
      setup(def) {
        def.expose.event('ready');
        def.lifecycle.onMounted((run) => {
          retainedRun = run;
          run.expose.emit('ready');
        });
        return (run) => run.el('div', 'ok');
      },
    });
    const session = createRuntimeSession(
      proto,
      createImmediateHost((wiring) => {
        wiring.attach('expose-event', [
          [EXPOSE_EVENT_SINK_CAP, (key: string) => emitted.push(key)],
        ]);
      })
    );

    await session.mount();
    await session.unmount();
    await session.mount();

    expect(emitted).toEqual(['ready', 'ready']);

    await session.dispose();
    expect(() => retainedRun.expose.emit('ready')).toThrow();
  });

  it('keeps Feedback logical style state while suppressing detached host flushes', async () => {
    const queued: unknown[] = [];
    const stylesSeenAtCommit: unknown[] = [];
    const effects: EffectsPort = {
      queueStyle: (style) => queued.push(style),
      requestFlush: vi.fn(),
    };
    const proto: Prototype = definePrototype({
      name: 'lifecycle-feedback-resource-owner',
      setup(def) {
        def.feedback.style.use(tw('base-token'));
        return (run) => run.el('div', 'ok');
      },
    });
    const host = createImmediateHost((wiring) =>
      wiring.attach('feedback', [[EFFECTS_CAP, effects]])
    );
    host.commit = (_children, signal) => {
      stylesSeenAtCommit.push(queued.at(-1));
      signal?.done();
    };
    const session = createRuntimeSession(proto, host);

    expect(queued).toEqual([]);
    await session.mount();
    expect(queued.length).toBeGreaterThan(0);
    expect(stylesSeenAtCommit.at(-1)).toMatchObject({
      kind: 'tw',
      tokens: expect.arrayContaining(['base-token']),
    });
    queued.length = 0;

    await session.unmount();
    await session.mount();
    expect(stylesSeenAtCommit.at(-1)).toMatchObject({
      kind: 'tw',
      tokens: expect.arrayContaining(['base-token']),
    });

    queued.length = 0;
    await session.unmount();
    const feedback = session.caps.getPort<FeedbackPort>('feedback')!;
    session.invokeInCallbackScope(() => feedback.patchStyle(tw('detached-token')));
    expect(queued).toEqual([]);

    await session.mount();
    expect(stylesSeenAtCommit.at(-1)).toMatchObject({
      kind: 'tw',
      tokens: expect.arrayContaining(['base-token', 'detached-token']),
    });
    expect(queued.at(-1)).toMatchObject({
      kind: 'tw',
      tokens: expect.arrayContaining(['base-token', 'detached-token']),
    });
  });

  it('suspends A11y and ExposeState host projection but publishes latest state on remount', async () => {
    const snapshots: any[] = [];
    const exposes: Record<string, unknown>[] = [];
    let disabled!: OwnedStateHandle<boolean>;
    const proto = definePrototype({
      name: 'lifecycle-projection-resource-owner',
      setup(def) {
        disabled = def.state.bool('disabled', false);
        def.expose.state('disabled', disabled);
        def.a11y.state('disabled', disabled);
        return (run) => run.el('button', 'ok');
      },
    });
    const session = createRuntimeSession(
      proto,
      createImmediateHost((wiring) => {
        wiring.attach('a11y', [
          [A11Y_PROJECT_CAP, (snapshot: A11ySemanticObjectSnapshot) => snapshots.push(snapshot)],
        ]);
        wiring.attach('expose-state', [
          [EXPOSES_RECORD_SINK_CAP, (record: Record<string, unknown>) => exposes.push(record)],
        ]);
      })
    );

    expect(snapshots).toEqual([]);
    expect(exposes.at(-1)).toHaveProperty('disabled');
    const initialExternalHandle = exposes.at(-1)?.disabled;
    await session.mount();
    expect(snapshots.at(-1)?.states.disabled).toBe(false);
    expect(exposes.at(-1)).toHaveProperty('disabled');

    await session.unmount();
    const detachedHandle = exposes.at(-1)?.disabled as { get(): boolean };
    snapshots.length = 0;
    exposes.length = 0;
    session.invokeInCallbackScope(() => disabled.set(true, 'detached update'));
    expect(snapshots).toEqual([]);
    expect(exposes).toEqual([]);
    expect(detachedHandle.get()).toBe(true);

    await session.mount();
    expect(snapshots.at(-1)?.states.disabled).toBe(true);
    expect((exposes.at(-1)?.disabled as { get(): boolean }).get()).toBe(true);
    expect(exposes.at(-1)?.disabled).toBe(initialExternalHandle);
  });

  it('keeps HitParticipation regions detached and re-syncs them on the next mount', async () => {
    const sync = vi.fn();
    const proto = definePrototype({
      name: 'lifecycle-hit-resource-owner',
      setup() {
        return (run) => run.el('div', 'ok');
      },
    });
    const session = createRuntimeSession(
      proto,
      createImmediateHost((wiring) =>
        wiring.attach('hit-participation', [[HIT_PARTICIPATION_HOST_BRIDGE_CAP, { sync }]])
      )
    );

    expect(sync).not.toHaveBeenCalled();
    await session.mount();
    expect(sync).toHaveBeenCalled();

    await session.unmount();
    sync.mockClear();
    const target = { id: 'detached-region' };
    session.caps.getPort<HitParticipationPort>('hit-participation')!.registerRegion(target);
    expect(sync).not.toHaveBeenCalled();

    await session.mount();
    expect(sync).toHaveBeenLastCalledWith(
      expect.objectContaining({ regions: [expect.objectContaining({ target })] })
    );
  });

  it('suspends Overlay host effects while preserving open state across epochs', async () => {
    const hostElement = document.createElement('div');
    const mount = vi.fn();
    const unmount = vi.fn();
    const lock = vi.fn();
    const unlock = vi.fn();
    const proto = definePrototype({
      name: 'lifecycle-overlay-resource-owner',
      setup() {
        const overlay = asOverlay();
        overlay.configure({ defaultOpen: true, portal: true, modal: true });
        return (run) => run.el('div', 'ok');
      },
    });
    const session = createRuntimeSession(
      proto,
      createImmediateHost((wiring) => {
        wiring.attach('overlay', [
          [HOST_ELEMENT_CAP, hostElement],
          [OVERLAY_GLOBAL_MOUNT_CAP, { mount, unmount }],
          [OVERLAY_MODAL_CAP, { lock, unlock }],
        ]);
      })
    );

    expect({ mount: mount.mock.calls.length, lock: lock.mock.calls.length }).toEqual({
      mount: 0,
      lock: 0,
    });
    await session.mount();
    expect(mount).toHaveBeenCalledOnce();
    expect(lock).toHaveBeenCalledOnce();

    await session.unmount();
    expect(unmount).toHaveBeenCalledOnce();
    expect(unlock).toHaveBeenCalledOnce();

    await session.mount();
    expect(mount).toHaveBeenCalledTimes(2);
    expect(lock).toHaveBeenCalledTimes(2);
  });
});
