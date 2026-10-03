/**
 * Topology T0: the peer as a process speaking framed JSON over stdio.
 *
 * The host starts this process, writes frames to its stdin and reads frames
 * from its stdout. stdout carries frames and nothing else, so anything meant
 * for a person goes to stderr; `main` also points `console` at stderr, because
 * one stray log line from any module would corrupt the stream for good.
 *
 *   tsx packages/adapters/gpui-peer/src/stdio.ts
 */
import { format } from 'node:util';
import { pathToFileURL } from 'node:url';

import type { HostToPeerMessage, PeerToHostMessage, WireRecord } from '@proto.ui/host-protocol';

import { createBaseBundle, type PrototypeBundle } from './bundle';
import { createPeerSession, type PeerSession } from './session';
import { createFrameDecoder, encodeFrame } from './transport';

export const PEER_NAME = '@proto.ui/adapter-gpui-peer';

export type PeerProcess = {
  /** Feeds bytes read from the host, in any chunking. */
  push(chunk: Uint8Array): void;
  /** Resolves once every message received so far has been handled. */
  idle(): Promise<void>;
};

export type PeerProcessOptions = {
  readonly bundle: PrototypeBundle;
  readonly write: (bytes: Uint8Array) => void;
  readonly runtimeVersion?: string;
  readonly log?: (line: string) => void;
};

export function createPeerProcess(options: PeerProcessOptions): PeerProcess {
  const decoder = createFrameDecoder<HostToPeerMessage>();
  const sessions = new Map<string, PeerSession>();
  // The environment the host last reported, which every session's rules read.
  let meta: WireRecord = {};
  const log = options.log ?? (() => {});
  // Messages are handled strictly in arrival order. Opening a session awaits a
  // lazy import and a mount, and a message for that session must not overtake
  // it.
  let queue: Promise<void> = Promise.resolve();

  const send = (message: PeerToHostMessage) => {
    // A session also ends with the one it was opened inside.
    if (message.kind === 'session.disposed') sessions.delete(message.sessionId);
    options.write(encodeFrame(message));
  };
  const diagnose = (sessionId: string | null, code: string, message: string) =>
    send({ kind: 'diagnostic', sessionId, diagnostic: { code, message } });

  send({
    kind: 'peer.hello',
    protocolVersion: 0,
    peer: { name: PEER_NAME, runtimeVersion: options.runtimeVersion ?? 'workspace' },
    bundle: {
      bundleId: options.bundle.bundleId,
      digest: options.bundle.digest,
      entries: Object.keys(options.bundle.entries),
    },
    features: [],
  });

  const session = (sessionId: string, kind: string): PeerSession | null => {
    const found = sessions.get(sessionId);
    if (!found) diagnose(sessionId, 'unknown-session', `${kind} for a session that is not open`);
    return found ?? null;
  };

  const handle = async (message: HostToPeerMessage): Promise<void> => {
    switch (message.kind) {
      case 'host.hello':
        return;
      case 'meta.set':
        meta = message.meta;
        return;
      case 'session.open': {
        if (sessions.has(message.sessionId)) {
          diagnose(message.sessionId, 'session-exists', 'session.open for an open session');
          return;
        }
        const load = options.bundle.entries[message.prototypeKey];
        if (!load) {
          send({
            kind: 'session.opened',
            sessionId: message.sessionId,
            status: 'failed',
            diagnostics: [
              {
                code: 'unknown-prototype',
                message: `the bundle has no entry ${message.prototypeKey}`,
              },
            ],
          });
          return;
        }
        // A part opens inside the instance it belongs to, which must be open.
        const parent =
          message.parentSessionId === undefined ? undefined : sessions.get(message.parentSessionId);
        if (message.parentSessionId !== undefined && !parent) {
          send({
            kind: 'session.opened',
            sessionId: message.sessionId,
            status: 'failed',
            diagnostics: [
              {
                code: 'unknown-parent',
                message: `no open session ${message.parentSessionId} to open inside`,
              },
            ],
          });
          return;
        }
        const prototype = await load();
        let opened: PeerSession;
        try {
          opened = createPeerSession({
            sessionId: message.sessionId,
            instanceId: message.instanceId,
            prototype,
            props: message.props,
            send,
            parent,
            getMeta: (key) => meta[key],
          });
        } catch (error) {
          // Setup runs as the instance is created. A part opened inside an
          // instance that provides nothing it needs fails here, and the host
          // hears so instead of waiting for a session that will never open.
          send({
            kind: 'session.opened',
            sessionId: message.sessionId,
            status: 'failed',
            diagnostics: [{ code: 'setup-failed', message: String(error) }],
          });
          return;
        }
        sessions.set(message.sessionId, opened);
        send({
          kind: 'session.opened',
          sessionId: message.sessionId,
          status: 'ok',
          diagnostics: [],
        });
        await opened.mount();
        return;
      }
      case 'props.set':
        session(message.sessionId, message.kind)?.setProps(message.props);
        return;
      case 'session.dispose': {
        const closing = session(message.sessionId, message.kind);
        if (!closing) return;
        sessions.delete(message.sessionId);
        await closing.dispose();
        return;
      }
      case 'projection.ack':
        session(message.ack.sessionId, message.kind)?.handle(message);
        return;
      default:
        session(message.sessionId, message.kind)?.handle(message);
    }
  };

  return {
    push(chunk) {
      let messages: HostToPeerMessage[];
      try {
        messages = decoder.push(chunk);
      } catch (error) {
        log(`[gpui-peer] ${String(error)}`);
        diagnose(null, 'frame-invalid', String(error));
        return;
      }
      for (const message of messages) {
        queue = queue
          .then(() => handle(message))
          .catch((error: unknown) => {
            log(`[gpui-peer] ${message.kind}: ${String(error)}`);
            diagnose(null, 'handler-failed', `${message.kind}: ${String(error)}`);
          });
      }
    },
    idle() {
      return queue;
    },
  };
}

function main(): void {
  const toStderr = (...args: unknown[]) => process.stderr.write(`${format(...args)}\n`);
  console.log = toStderr;
  console.info = toStderr;
  console.debug = toStderr;
  console.warn = toStderr;

  const peer = createPeerProcess({
    bundle: createBaseBundle(),
    write: (bytes) => process.stdout.write(bytes),
    log: (line) => process.stderr.write(`${line}\n`),
  });
  process.stdin.on('data', (chunk: Buffer) => peer.push(new Uint8Array(chunk)));
  process.stdin.on('end', () => {
    void peer.idle().then(() => process.exit(0));
  });
}

// Only run when executed directly; tests import `createPeerProcess` instead.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
