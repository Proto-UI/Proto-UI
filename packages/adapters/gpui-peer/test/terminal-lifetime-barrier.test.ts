import { describe, expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { createPeerSession, type PeerSession } from '../src/session';
import { ScriptedHost } from './scripted-host';

const neutral = definePrototype({ name: 'review-lifetime-neutral', setup: () => (r) => r.slot() });

function open(id: string, prototype = neutral, parent?: PeerSession) {
  const host = new ScriptedHost(id);
  const peer = createPeerSession({
    sessionId: id,
    instanceId: `${id}:instance`,
    prototype,
    props: {},
    parent,
    send: (message) => host.receive(message),
    schedule: (task) => task(),
  });
  host.bind((message) => peer.handle(message));
  return { host, peer };
}

function latch() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

describe('gpui peer: actual terminal disposal barriers', () => {
  it('shows that an async beforeDispose callback does not hold terminal completion', async () => {
    const finish = latch();
    const callbackDone = latch();
    let enteredCallback = false;
    let completedCallback = false;
    const prototype = definePrototype({
      name: 'review-unawaited-before-dispose',
      setup(def) {
        def.lifecycle.onBeforeDispose(async () => {
          enteredCallback = true;
          await finish.promise;
          completedCallback = true;
          callbackDone.release();
        });
        return (r) => r.slot();
      },
    });
    const session = open('review-unawaited', prototype);
    await session.peer.mount();
    let disposed = false;
    let disposeError: unknown;
    const ending = session.peer.dispose().then(
      () => {
        disposed = true;
      },
      (error: unknown) => {
        disposeError = error;
      }
    );
    try {
      for (let turn = 0; turn < 3; turn++) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      expect(enteredCallback).toBe(true);
      expect(disposeError).toBeUndefined();
      expect(disposed).toBe(true);
      expect(completedCallback).toBe(false);
      expect(session.host.of('session.disposed')).toHaveLength(1);
    } finally {
      finish.release();
      await ending;
      if (enteredCallback) await callbackDone.promise;
    }
  });

  for (const target of ['closing-root', 'open-older-child'] as const) {
    it(`rejects new descendants under ${target} while child disposal is genuinely pending`, async () => {
      const root = open(`review-root-${target}`);
      await root.peer.mount();
      const older = open(`review-older-${target}`, neutral, root.peer);
      await older.peer.mount();
      const newest = open(`review-newest-${target}`, neutral, root.peer);
      await newest.peer.mount();
      const entered = latch();
      const finish = latch();
      const originalDispose = newest.peer.dispose.bind(newest.peer);
      // This Promise is awaited by the parent's inside.dispose(), unlike a
      // Promise returned from a Runtime lifecycle callback.
      newest.peer.dispose = async () => {
        entered.release();
        await finish.promise;
        await originalDispose();
      };
      const ending = root.peer.dispose();
      let late: ReturnType<typeof open> | undefined;
      try {
        await entered.promise;
        for (let turn = 0; turn < 3; turn++) {
          await new Promise((resolve) => setTimeout(resolve, 0));
          expect(root.host.of('session.disposed')).toHaveLength(0);
          expect(older.host.of('session.disposed')).toHaveLength(0);
          expect(newest.host.of('session.disposed')).toHaveLength(0);
        }
        const parent = target === 'closing-root' ? root.peer : older.peer;
        expect(() => {
          late = open(`review-late-${target}`, neutral, parent);
        }).toThrow(/closing or failed/);
      } finally {
        finish.release();
        try {
          await ending;
        } finally {
          if (late) await late.peer.dispose();
        }
      }
      expect(newest.host.of('session.disposed')).toHaveLength(1);
      expect(older.host.of('session.disposed')).toHaveLength(1);
      expect(root.host.of('session.disposed')).toHaveLength(1);
    });
  }
});
