import type { AvailableSpaceFrame } from '@proto.ui/core';
import type { AvailableSpaceHost } from '@proto.ui/module-positioning';
import type {
  AvailableSpaceLeaseMessage,
  AvailableSpaceFrameMessage,
} from '@proto.ui/host-protocol';

let nextLease = 0;

/** One host-private root identity; neither Props nor an arbitrary object is a target. */
export function createPeerAvailableSpaceHost(options: {
  sessionId: string;
  root: object;
  epoch(): number;
  live(): boolean;
  publish(message: AvailableSpaceLeaseMessage): void;
}) {
  type Lease = {
    moduleEpoch: number;
    viewEpoch: number;
    leaseId: string;
    active: boolean;
    revision: number;
    frame: AvailableSpaceFrame | null;
  };
  let current: Lease | null = null;
  let terminal = false;
  let ownerVersion = 0;
  let highestModuleEpoch = 0;

  const message = (lease: Lease, active = lease.active): AvailableSpaceLeaseMessage => ({
    kind: 'available-space.lease',
    sessionId: options.sessionId,
    viewEpoch: lease.viewEpoch,
    moduleEpoch: lease.moduleEpoch,
    leaseId: lease.leaseId,
    root: 'proto-surface',
    boundary: 'root-content',
    active,
  });
  const revoke = () => {
    const lease = current;
    if (!lease) return;
    const wasActive = lease.active;
    lease.active = false;
    lease.frame = null;
    if (wasActive) options.publish(message(lease, false));
  };
  const resume = () => {
    const lease = current;
    const epoch = options.epoch();
    if (terminal || !lease || !options.live() || !Number.isSafeInteger(epoch) || epoch < 1) return;
    if (!lease.active || lease.viewEpoch !== epoch) {
      lease.viewEpoch = epoch;
      lease.leaseId = `${options.sessionId}:available-space:${++nextLease}`;
      lease.revision = 0;
      lease.frame = null;
      lease.active = true;
    }
    options.publish(message(lease));
  };
  const host: AvailableSpaceHost = {
    attach(connection) {
      if (
        terminal ||
        connection.target !== options.root ||
        connection.boundary !== 'root-content' ||
        !Number.isSafeInteger(connection.viewEpoch) ||
        connection.viewEpoch <= highestModuleEpoch
      )
        return { requestUpdate() {}, dispose() {}, getFrame: () => null };
      const version = ++ownerVersion;
      highestModuleEpoch = connection.viewEpoch;
      revoke();
      if (terminal || version !== ownerVersion)
        return { requestUpdate() {}, dispose() {}, getFrame: () => null };
      const lease: Lease = {
        moduleEpoch: connection.viewEpoch,
        viewEpoch: options.epoch(),
        leaseId: '',
        active: false,
        revision: 0,
        frame: null,
      };
      current = lease;
      resume();
      return {
        getFrame: () => (current === lease && lease.active && options.live() ? lease.frame : null),
        requestUpdate() {
          if (current === lease) resume();
        },
        dispose() {
          if (current !== lease) return;
          ownerVersion++;
          revoke();
          if (current === lease) current = null;
        },
      };
    },
  };
  return {
    host,
    resume,
    revoke,
    plan: () => (current?.active && options.live() ? message(current) : null),
    dispose() {
      terminal = true;
      ownerVersion++;
      revoke();
      current = null;
    },
    frame(frame: AvailableSpaceFrameMessage) {
      const lease = current;
      if (
        terminal ||
        !lease ||
        !lease.active ||
        !options.live() ||
        frame.sessionId !== options.sessionId ||
        frame.viewEpoch !== options.epoch() ||
        frame.viewEpoch !== lease.viewEpoch ||
        frame.moduleEpoch !== lease.moduleEpoch ||
        frame.leaseId !== lease.leaseId ||
        !Number.isSafeInteger(frame.revision) ||
        frame.revision <= lease.revision ||
        (frame.rect !== null &&
          (!frame.rect ||
            ![frame.rect.x, frame.rect.y, frame.rect.width, frame.rect.height].every(
              Number.isFinite
            ) ||
            frame.rect.width < 0 ||
            frame.rect.height < 0))
      )
        return false;
      lease.revision = frame.revision;
      lease.frame = Object.freeze({
        viewEpoch: lease.moduleEpoch,
        revision: frame.revision,
        rect: frame.rect === null ? null : Object.freeze({ ...frame.rect }),
      });
      return true;
    },
  };
}
