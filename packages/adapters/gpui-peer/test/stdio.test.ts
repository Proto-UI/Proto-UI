import { describe, expect, it } from 'vitest';
import type { HostToPeerMessage, PeerToHostMessage } from '@proto.ui/host-protocol';

import { createBaseBundle } from '../src/bundle';
import { createPeerProcess, PEER_NAME } from '../src/stdio';
import { createFrameDecoder, encodeFrame } from '../src/transport';

/** The process entry, driven in-process through its byte interface. */
function harness() {
  const decoder = createFrameDecoder<PeerToHostMessage>();
  const received: PeerToHostMessage[] = [];
  const peer = createPeerProcess({
    bundle: createBaseBundle(),
    write: (bytes) => received.push(...decoder.push(bytes)),
  });
  const send = (message: HostToPeerMessage) => peer.push(encodeFrame(message));
  const kinds = () => received.map((message) => message.kind);
  return { peer, received, send, kinds };
}

const OPEN: HostToPeerMessage = {
  kind: 'session.open',
  sessionId: 's-1',
  instanceId: 'button-1',
  prototypeKey: 'base-button',
  props: {},
};

describe('gpui peer: stdio process', () => {
  it('says hello first, naming the entries its bundle can run', () => {
    const { received } = harness();
    expect(received).toHaveLength(1);
    const hello = received[0]!;
    expect(hello.kind).toBe('peer.hello');
    if (hello.kind !== 'peer.hello') return;
    expect(hello.peer.name).toBe(PEER_NAME);
    expect(hello.bundle.entries).toEqual(['base-button']);
  });

  it('opens a session by bundle key and mounts it', async () => {
    const { peer, send, kinds, received } = harness();
    send(OPEN);
    await peer.idle();
    // Opened is reported before anything the mount sends.
    expect(kinds().indexOf('session.opened')).toBeLessThan(kinds().indexOf('projection.install'));
    const opened = received.find((message) => message.kind === 'session.opened');
    expect(opened).toMatchObject({ sessionId: 's-1', status: 'ok' });
  });

  it('refuses a prototype the bundle does not carry', async () => {
    const { peer, send, received } = harness();
    send({ ...OPEN, prototypeKey: 'arbitrary/import/path' } as HostToPeerMessage);
    await peer.idle();
    const opened = received.find((message) => message.kind === 'session.opened');
    expect(opened).toMatchObject({
      status: 'failed',
      diagnostics: [{ code: 'unknown-prototype' }],
    });
    expect(received.some((message) => message.kind === 'projection.install')).toBe(false);
  });

  it('activates only after the host acknowledges, however the bytes are chunked', async () => {
    const { peer, send, received } = harness();
    send(OPEN);
    await peer.idle();
    const install = received.find((message) => message.kind === 'projection.install');
    if (install?.kind !== 'projection.install') throw new Error('no projection.install');
    expect(received.some((message) => message.kind === 'projection.activate')).toBe(false);

    // The acknowledgement arrives one byte at a time: framing must not care.
    const { transaction } = install;
    const frame = encodeFrame({
      kind: 'projection.ack',
      ack: {
        sessionId: transaction.sessionId,
        viewEpoch: transaction.viewEpoch,
        commitId: transaction.commitId,
        status: 'applied',
        readySurfaces: ['proto-surface'],
        diagnostics: [],
      },
    } satisfies HostToPeerMessage);
    for (const byte of frame) peer.push(Uint8Array.of(byte));
    await peer.idle();

    const activate = received.find((message) => message.kind === 'projection.activate');
    expect(activate).toMatchObject({
      sessionId: 's-1',
      viewEpoch: transaction.viewEpoch,
      commitId: transaction.commitId,
    });
  });

  it('reports a message for a session that is not open', async () => {
    const { peer, send, received } = harness();
    send({ kind: 'props.set', sessionId: 'nobody', props: {} });
    await peer.idle();
    expect(received.at(-1)).toMatchObject({
      kind: 'diagnostic',
      sessionId: 'nobody',
      diagnostic: { code: 'unknown-session' },
    });
  });

  it('disposes a session on request and forgets it', async () => {
    const { peer, send, received } = harness();
    send(OPEN);
    await peer.idle();
    send({ kind: 'session.dispose', sessionId: 's-1' });
    await peer.idle();
    expect(received.some((message) => message.kind === 'session.disposed')).toBe(true);

    send({ kind: 'props.set', sessionId: 's-1', props: {} });
    await peer.idle();
    expect(received.at(-1)).toMatchObject({
      kind: 'diagnostic',
      diagnostic: { code: 'unknown-session' },
    });
  });
});
