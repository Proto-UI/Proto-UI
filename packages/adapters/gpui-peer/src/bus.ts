/**
 * Adapter-private event bus. It plays the role the shared Web router's
 * private `EventTarget` buses play today, but depends on no DOM or Node
 * global so the same peer can later run inside an embedded engine.
 *
 * Listeners are plain functions receiving plain `{ type, detail }` objects.
 */

export type PeerBusEvent = {
  readonly type: string;
  readonly detail?: unknown;
  /** Host sample identity; lets default-action requests name the sample. */
  readonly sampleId?: string;
};

export type PeerBusListener = (event: PeerBusEvent) => void;

export type PeerBusRegistration = {
  readonly type: string;
  readonly listener: PeerBusListener;
  readonly options: unknown;
};

export type PeerBusObserver = {
  onAdd?(registration: PeerBusRegistration): void;
  onRemove?(registration: PeerBusRegistration): void;
};

export type PeerEventBus = {
  addEventListener(type: string, listener: PeerBusListener | null, options?: unknown): void;
  removeEventListener(type: string, listener: PeerBusListener | null, options?: unknown): void;
  dispatchEvent(event: PeerBusEvent): boolean;
  registrations(): readonly PeerBusRegistration[];
};

function sameCapture(a: unknown, b: unknown): boolean {
  const captureOf = (value: unknown) =>
    typeof value === 'boolean'
      ? value
      : Boolean((value as { capture?: boolean } | null | undefined)?.capture);
  return captureOf(a) === captureOf(b);
}

export function createPeerEventBus(observer: PeerBusObserver = {}): PeerEventBus {
  const entries: PeerBusRegistration[] = [];

  return {
    addEventListener(type, listener, options) {
      if (!listener) return;
      if (
        entries.some(
          (entry) =>
            entry.type === type &&
            entry.listener === listener &&
            sameCapture(entry.options, options)
        )
      ) {
        return;
      }
      const registration: PeerBusRegistration = { type, listener, options };
      entries.push(registration);
      observer.onAdd?.(registration);
    },
    removeEventListener(type, listener, options) {
      if (!listener) return;
      const index = entries.findIndex(
        (entry) =>
          entry.type === type && entry.listener === listener && sameCapture(entry.options, options)
      );
      if (index < 0) return;
      const [registration] = entries.splice(index, 1);
      if (registration) observer.onRemove?.(registration);
    },
    dispatchEvent(event) {
      for (const entry of entries.filter((entry) => entry.type === event.type)) {
        entry.listener(event);
      }
      return true;
    },
    registrations() {
      return [...entries];
    },
  };
}
