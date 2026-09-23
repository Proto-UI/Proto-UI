import type { HostToPeerMessage, PeerToHostMessage } from '@proto.ui/host-protocol';

/**
 * Length-framed JSON transport for topology T0. Framing is an implementation
 * choice of this peer, not protocol semantics: each frame is a big-endian
 * 32-bit byte length followed by UTF-8 JSON.
 */

const HEADER_BYTES = 4;
const MAX_FRAME_BYTES = 16 * 1024 * 1024;

export type FrameDecoder<T> = {
  push(chunk: Uint8Array): T[];
  pendingBytes(): number;
};

export function encodeFrame(message: unknown): Uint8Array {
  const body = new TextEncoder().encode(JSON.stringify(message));
  if (body.byteLength > MAX_FRAME_BYTES) {
    throw new Error(`[gpui-peer] frame exceeds ${MAX_FRAME_BYTES} bytes`);
  }
  const frame = new Uint8Array(HEADER_BYTES + body.byteLength);
  new DataView(frame.buffer).setUint32(0, body.byteLength, false);
  frame.set(body, HEADER_BYTES);
  return frame;
}

export function createFrameDecoder<T>(): FrameDecoder<T> {
  let buffer = new Uint8Array(0);
  const decoder = new TextDecoder();

  return {
    push(chunk) {
      const merged = new Uint8Array(buffer.byteLength + chunk.byteLength);
      merged.set(buffer, 0);
      merged.set(chunk, buffer.byteLength);
      buffer = merged;

      const messages: T[] = [];
      while (buffer.byteLength >= HEADER_BYTES) {
        const length = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength).getUint32(
          0,
          false
        );
        if (length > MAX_FRAME_BYTES) {
          throw new Error(`[gpui-peer] incoming frame exceeds ${MAX_FRAME_BYTES} bytes`);
        }
        if (buffer.byteLength < HEADER_BYTES + length) break;
        const body = buffer.subarray(HEADER_BYTES, HEADER_BYTES + length);
        messages.push(JSON.parse(decoder.decode(body)) as T);
        buffer = buffer.slice(HEADER_BYTES + length);
      }
      return messages;
    },
    pendingBytes() {
      return buffer.byteLength;
    },
  };
}

export type PeerTransport = {
  send(message: PeerToHostMessage): void;
  onMessage(listener: (message: HostToPeerMessage) => void): () => void;
  close(): void;
};

type StreamLike = {
  on(event: 'data', listener: (chunk: Uint8Array) => void): unknown;
  on(event: 'end' | 'close', listener: () => void): unknown;
};

type WritableLike = {
  write(chunk: Uint8Array): unknown;
};

/** Binds the framed transport to Node-style readable and writable streams. */
export function createStreamTransport(input: StreamLike, output: WritableLike): PeerTransport {
  const listeners = new Set<(message: HostToPeerMessage) => void>();
  const decoder = createFrameDecoder<HostToPeerMessage>();
  let closed = false;

  input.on('data', (chunk) => {
    if (closed) return;
    for (const message of decoder.push(chunk)) {
      for (const listener of [...listeners]) listener(message);
    }
  });

  return {
    send(message) {
      if (closed) return;
      output.write(encodeFrame(message));
    },
    onMessage(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close() {
      closed = true;
      listeners.clear();
    },
  };
}

/** In-memory pair used by tests and by a same-process scripted host. */
export function createLoopbackTransport(): {
  peer: PeerTransport;
  host: {
    send(message: HostToPeerMessage): void;
    onMessage(listener: (message: PeerToHostMessage) => void): () => void;
    sent: PeerToHostMessage[];
  };
} {
  const toPeer = new Set<(message: HostToPeerMessage) => void>();
  const toHost = new Set<(message: PeerToHostMessage) => void>();
  const sent: PeerToHostMessage[] = [];
  let closed = false;

  return {
    peer: {
      send(message) {
        if (closed) return;
        // Cross the boundary through the codec so forbidden values fail here.
        const copy = JSON.parse(JSON.stringify(message)) as PeerToHostMessage;
        sent.push(copy);
        for (const listener of [...toHost]) listener(copy);
      },
      onMessage(listener) {
        toPeer.add(listener);
        return () => toPeer.delete(listener);
      },
      close() {
        closed = true;
        toPeer.clear();
      },
    },
    host: {
      send(message) {
        if (closed) return;
        const copy = JSON.parse(JSON.stringify(message)) as HostToPeerMessage;
        for (const listener of [...toPeer]) listener(copy);
      },
      onMessage(listener) {
        toHost.add(listener);
        return () => toHost.delete(listener);
      },
      sent,
    },
  };
}
