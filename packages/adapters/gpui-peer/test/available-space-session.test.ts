import { expect, it } from 'vitest';
import { dialogRoot, dialogContent } from '@proto.ui/prototypes-base/dialog';
import type { PeerToHostMessage, WireRecord } from '@proto.ui/host-protocol';
import { createPeerSession, type PeerSession } from '../src/session';
import { ScriptedHost } from './scripted-host';

const settle = async () => {
  for (let turn = 0; turn < 12; turn++) await new Promise((resolve) => setTimeout(resolve, 0));
};

function open(
  id: string,
  prototype: Parameters<typeof createPeerSession>[0]['prototype'],
  props: WireRecord,
  parent?: PeerSession,
  reject = false
) {
  const host = new ScriptedHost(id, { autoAck: !reject });
  let peer: PeerSession;
  peer = createPeerSession({
    sessionId: id,
    instanceId: `${id}:instance`,
    prototype,
    props,
    parent,
    getMeta: (key) => (key === 'reducedMotion' ? 'reduce' : undefined),
    send(message: PeerToHostMessage) {
      host.receive(message);
      if (reject && message.kind === 'projection.install') {
        peer.handle({
          kind: 'projection.ack',
          ack: {
            sessionId: id,
            viewEpoch: message.transaction.viewEpoch,
            commitId: message.transaction.commitId,
            status: 'failed',
            readySurfaces: [],
            diagnostics: [
              {
                code: 'available-space-required',
                message: 'test host requires a native root lease',
              },
            ],
          },
        });
      }
    },
  });
  host.bind((message) => peer.handle(message));
  return { host, peer };
}

it('real Dialog acquires a current root lease and renews it after retained-view close/reopen', async () => {
  const root = open('root', dialogRoot, { open: true });
  await root.peer.mount();
  const content = open('content', dialogContent, {}, root.peer);
  await content.peer.mount();
  await settle();
  try {
    const active = content.host.of('available-space.lease').filter((message) => message.active);
    expect(active.length).toBeGreaterThan(0);
    const first = active.at(-1)!;
    expect(first).toMatchObject({ viewEpoch: 1, root: 'proto-surface', boundary: 'root-content' });
    root.peer.setProps({ open: false });
    await settle();
    expect(
      content.host
        .of('available-space.lease')
        .some((message) => !message.active && message.leaseId === first.leaseId)
    ).toBe(true);
    root.peer.setProps({ open: true });
    await settle();
    const latest = content.host
      .of('available-space.lease')
      .filter((message) => message.active)
      .at(-1)!;
    expect(latest.viewEpoch).toBeGreaterThan(first.viewEpoch);
    expect(latest.leaseId).not.toBe(first.leaseId);
    expect(latest.moduleEpoch).toBeGreaterThanOrEqual(first.moduleEpoch);
  } finally {
    await content.peer.dispose();
    await root.peer.dispose();
  }
});

it('a rejected delayed Dialog lease retries at most once for each lease identity', async () => {
  const root = open('root-reject', dialogRoot, { open: true });
  await root.peer.mount();
  const content = open('content-reject', dialogContent, {}, root.peer, true);
  await content.peer.mount();
  await settle();
  try {
    const leases = new Set(
      content.host
        .of('available-space.lease')
        .filter((message) => message.active)
        .map((message) => message.leaseId)
    );
    expect(leases.size).toBeGreaterThan(0);
    const installs = content.host.of('projection.install').length;
    expect(installs).toBeGreaterThanOrEqual(2);
    expect(installs).toBeLessThanOrEqual(1 + leases.size);
    await settle();
    expect(content.host.of('projection.install')).toHaveLength(installs);
    expect(content.host.of('projection.activate')).toHaveLength(0);
  } finally {
    await content.peer.dispose();
    await root.peer.dispose();
  }
});
