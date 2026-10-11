import { describe, expect, it } from 'vitest';
import type {
  AvailableSpaceFrameMessage,
  AvailableSpaceLeaseMessage,
} from '@proto.ui/host-protocol';
import { createPeerAvailableSpaceHost } from '../src/available-space';

function fixture() {
  const root = {};
  let epoch = 1,
    live = true;
  const sent: AvailableSpaceLeaseMessage[] = [];
  const peer = createPeerAvailableSpaceHost({
    sessionId: 'dialog',
    root,
    epoch: () => epoch,
    live: () => live,
    publish: (message) => sent.push(message),
  });
  const connect = (moduleEpoch = 4) =>
    peer.host.attach({ target: root, boundary: 'root-content', viewEpoch: moduleEpoch });
  const frame = (
    overrides: Partial<AvailableSpaceFrameMessage> = {}
  ): AvailableSpaceFrameMessage => ({
    kind: 'available-space.frame',
    sessionId: 'dialog',
    viewEpoch: epoch,
    moduleEpoch: peer.plan()!.moduleEpoch,
    leaseId: peer.plan()!.leaseId,
    revision: 1,
    rect: { x: 10, y: 20, width: 390, height: 900 },
    ...overrides,
  });
  return {
    root,
    peer,
    sent,
    connect,
    frame,
    setEpoch: (next: number) => {
      epoch = next;
    },
    setLive: (next: boolean) => {
      live = next;
    },
  };
}

describe('GPUI available-space peer ownership', () => {
  it('binds host facts to independent view and Module epochs', () => {
    const f = fixture(),
      lease = f.connect();
    expect(f.sent).toHaveLength(1);
    expect(f.peer.plan()).toMatchObject({
      viewEpoch: 1,
      moduleEpoch: 4,
      root: 'proto-surface',
      active: true,
    });
    expect(f.peer.frame(f.frame())).toBe(true);
    expect(lease.getFrame?.()).toEqual({
      viewEpoch: 4,
      revision: 1,
      rect: { x: 10, y: 20, width: 390, height: 900 },
    });
    expect(f.peer.frame(f.frame({ revision: 2, rect: null }))).toBe(true);
    expect(lease.getFrame?.()?.rect).toBeNull();
  });

  it.each([
    { sessionId: 'other' },
    { viewEpoch: 2 },
    { moduleEpoch: 5 },
    { leaseId: 'old' },
    { revision: 0 },
    { revision: 0.5 },
    { revision: Number.NaN },
    { rect: { x: NaN, y: 0, width: 20, height: 30 } },
    { rect: { x: 0, y: 0, width: -1, height: 30 } },
    { rect: { x: 0, y: 0, width: 1, height: Infinity } },
  ] satisfies Partial<AvailableSpaceFrameMessage>[])('rejects stale/invalid frame %j', (bad) => {
    const f = fixture(),
      lease = f.connect();
    expect(f.peer.frame(f.frame(bad))).toBe(false);
    expect(lease.getFrame?.()).toBeNull();
  });

  it('rejects a foreign root without displacing its actual owner', () => {
    const f = fixture(),
      lease = f.connect(),
      original = f.peer.plan();
    const invalid = f.peer.host.attach({ target: {}, boundary: 'root-content', viewEpoch: 9 });
    expect(f.peer.plan()).toEqual(original);
    invalid.dispose();
    expect(f.peer.frame(f.frame())).toBe(true);
    expect(lease.getFrame?.()).not.toBeNull();
  });

  it('replaces and retires leases, ignoring old cleanup and late frames', () => {
    const f = fixture(),
      first = f.connect(),
      old = f.frame();
    const next = f.connect(5);
    first.dispose();
    expect(f.peer.frame(old)).toBe(false);
    expect(f.peer.frame(f.frame())).toBe(true);
    expect(next.getFrame?.()).not.toBeNull();
    next.dispose();
    expect(f.peer.plan()).toBeNull();
    expect(f.peer.frame(old)).toBe(false);
  });

  it('uses a new opaque lease on retained-view reattachment', () => {
    const f = fixture(),
      lease = f.connect(),
      old = f.frame();
    f.peer.frame(old);
    f.peer.revoke();
    f.setLive(false);
    expect(lease.getFrame?.()).toBeNull();
    f.setEpoch(2);
    f.setLive(true);
    f.peer.resume();
    expect(f.peer.plan()).toMatchObject({ viewEpoch: 2, moduleEpoch: 4 });
    expect(f.peer.plan()?.leaseId).not.toBe(old.leaseId);
    expect(f.peer.frame(old)).toBe(false);
    expect(f.peer.frame(f.frame())).toBe(true);
    f.peer.dispose();
    lease.requestUpdate();
    f.peer.resume();
    f.connect(8);
    expect(f.peer.plan()).toBeNull();
  });

  it('does not overwrite a newer reentrant owner during replacement', () => {
    const root = {};
    let reenter = false;
    const peer = createPeerAvailableSpaceHost({
      sessionId: 'dialog',
      root,
      epoch: () => 1,
      live: () => true,
      publish(message) {
        if (!message.active && reenter) {
          reenter = false;
          peer.host.attach({ target: root, boundary: 'root-content', viewEpoch: 99 });
        }
      },
    });
    peer.host.attach({ target: root, boundary: 'root-content', viewEpoch: 1 });
    reenter = true;
    peer.host.attach({ target: root, boundary: 'root-content', viewEpoch: 2 });
    expect(peer.plan()?.moduleEpoch).toBe(99);
  });
});
