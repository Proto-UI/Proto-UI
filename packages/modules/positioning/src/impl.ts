import type { StatePort } from '@proto.ui/module-state';
import { availableLayoutStates, readAvailableLayout } from './available-layout';
import type {
  AvailableLayoutBinding,
  AvailableSpaceConnection,
  AvailableSpaceHandle,
  AnchoredPositionConfig,
  AnchoredPositionConnection,
  AnchoredPositionHandle,
  AnchoredPositionSnapshot,
  CapsVaultView,
  ProtoPhase,
} from '@proto.ui/core';
import { ModuleBase } from '@proto.ui/module-base';
import {
  AVAILABLE_SPACE_HOST_CAP,
  type AvailableSpaceHostLease,
  ANCHORED_POSITION_HOST_CAP,
  type AnchoredPositionHost,
  type AnchoredPositionHostLease,
} from './caps';

export class PositioningModuleImpl extends ModuleBase {
  private connection: AnchoredPositionConnection | null = null;
  private lease: AnchoredPositionHostLease | null = null;
  private snapshot: AnchoredPositionSnapshot | null = null;

  private availableConnection: AvailableSpaceConnection | null = null;
  private availableLease: AvailableSpaceHostLease | null = null;
  private availableEpoch = 0;
  private availableVersion = 0;
  private terminal = false;
  private connectionVersion = 0;
  private dispatchCallback: (callback: () => void) => void = (callback) => callback();

  setCallbackDispatcher(dispatch: (callback: () => void) => void): void {
    if (!this.terminal) this.dispatchCallback = dispatch;
  }
  private layoutBinding: AvailableLayoutBinding | null = null;
  private layoutWatchOffs: (() => void)[] = [];
  private layoutWatchEpoch = 0;

  constructor(
    caps: CapsVaultView,
    private readonly statePort?: StatePort
  ) {
    super(caps);
  }

  private clearLayoutWatches(): void {
    this.layoutWatchEpoch++;
    this.layoutWatchOffs.splice(0).forEach((off) => off());
  }

  private watchLayout(): void {
    this.clearLayoutWatches();
    const binding = this.layoutBinding;
    if (!binding || !this.availableConnection) return;
    const handles = availableLayoutStates(binding);
    if (handles.length && !this.statePort)
      throw new Error('[Positioning] layout State observation unavailable.');
    const epoch = this.layoutWatchEpoch;
    const lease = this.availableLease;
    const current = () =>
      !this.terminal &&
      epoch === this.layoutWatchEpoch &&
      this.availableLease === lease &&
      this.layoutBinding === binding;
    try {
      for (const handle of handles) {
        const off = this.statePort!.watch(handle as any, () => {
          if (!current()) return;
          const frame = readAvailableLayout(binding);
          if (current()) lease?.updateLayout?.(frame);
        });
        if (!current()) {
          off();
          return;
        }
        this.layoutWatchOffs.push(off);
      }
    } catch (error) {
      if (epoch === this.layoutWatchEpoch) this.clearLayoutWatches();
      throw error;
    }
  }

  protected override onCapsEpoch(): void {
    if (this.terminal) return;
    if (this.connection) this.attach(this.connection);
    if (this.availableConnection) this.attachAvailable(this.availableConnection);
  }

  private attachAvailable(connection: AvailableSpaceConnection): void {
    const version = ++this.availableVersion;
    this.clearLayoutWatches();
    const previous = this.availableLease;
    this.availableLease = null;
    previous?.dispose();
    if (
      this.terminal ||
      version !== this.availableVersion ||
      this.availableConnection !== connection
    )
      return;
    const viewEpoch = ++this.availableEpoch;
    if (!this.caps.has(AVAILABLE_SPACE_HOST_CAP)) return;
    const host = this.caps.get(AVAILABLE_SPACE_HOST_CAP);
    if (!host) return;
    if (this.layoutBinding && !host.supportsLayout) {
      throw new Error('[Positioning] Host does not support constrained available layout.');
    }
    const layout = this.layoutBinding ? readAvailableLayout(this.layoutBinding) : undefined;
    if (
      this.terminal ||
      version !== this.availableVersion ||
      this.availableConnection !== connection
    )
      return;
    const lease = host.attach({ ...connection, viewEpoch, layout });
    if (this.layoutBinding && !lease.updateLayout) {
      lease.dispose();
      throw new Error('[Positioning] Host lease does not support constrained available layout.');
    }
    if (
      this.terminal ||
      version !== this.availableVersion ||
      this.availableConnection !== connection
    )
      lease.dispose();
    else {
      this.availableLease = lease;
      try {
        this.watchLayout();
      } catch (error) {
        if (this.availableLease === lease) {
          this.availableLease = null;
          lease.dispose();
        }
        throw error;
      }
    }
  }

  readonly availableHandle: AvailableSpaceHandle = {
    bindLayout: (binding) => {
      this.sys.ensureSetup('availableSpace.bindLayout');
      if (readAvailableLayout(binding, true).status === 'invalid')
        throw new TypeError('[Positioning] Invalid available layout binding.');
      if (this.terminal) return;
      if (this.availableLease && !this.availableLease.updateLayout)
        throw new Error('[Positioning] Host lease does not support constrained available layout.');
      this.layoutBinding = binding;
      const priorLease = this.availableLease;
      try {
        this.watchLayout();
      } catch (error) {
        if (priorLease && this.availableLease === priorLease) {
          this.availableLease = null;
          priorLease.dispose();
        }
        throw error;
      }
      const lease = this.availableLease;
      const epoch = this.layoutWatchEpoch;
      const frame = readAvailableLayout(binding);
      if (
        !this.terminal &&
        epoch === this.layoutWatchEpoch &&
        this.layoutBinding === binding &&
        this.availableLease === lease
      )
        lease?.updateLayout?.(frame);
    },
    connect: (connection) => {
      if (this.terminal) return;
      const same =
        this.availableConnection !== null &&
        this.availableConnection.target === connection.target &&
        this.availableConnection.boundary === connection.boundary;
      this.availableConnection = connection;
      if (same && this.availableLease) {
        this.availableLease.requestUpdate();
        return;
      }
      this.attachAvailable(connection);
    },
    requestUpdate: () => {
      if (!this.terminal) this.availableLease?.requestUpdate();
    },
    disconnect: () => {
      this.availableVersion++;
      this.availableEpoch++;
      this.clearLayoutWatches();
      const previous = this.availableLease;
      this.availableLease = null;
      this.availableConnection = null;
      previous?.dispose();
    },
  };

  override onProtoPhase(phase: ProtoPhase): void {
    super.onProtoPhase(phase);
    if (phase === 'updated') this.availableHandle.requestUpdate();
    if (phase === 'unmounted') {
      this.terminal = true;
      this.disconnect();
      this.availableHandle.disconnect();
    }
  }

  private getHost(): AnchoredPositionHost | null {
    return this.caps.has(ANCHORED_POSITION_HOST_CAP)
      ? this.caps.get(ANCHORED_POSITION_HOST_CAP)
      : null;
  }

  private bridge(
    connection: AnchoredPositionConnection,
    version: number
  ): AnchoredPositionConnection {
    const current = () =>
      !this.terminal && version === this.connectionVersion && this.connection === connection;
    return {
      ...connection,
      onResolved: (snapshot) => {
        if (!current()) return;
        const resolved = Object.freeze({ ...snapshot });
        this.dispatchCallback(() => {
          if (!current()) return;
          this.snapshot = resolved;
          connection.onResolved?.(resolved);
        });
      },
    };
  }

  private attach(connection: AnchoredPositionConnection): void {
    const version = ++this.connectionVersion;
    const previous = this.lease;
    this.lease = null;
    this.snapshot = null;
    previous?.dispose();
    if (this.terminal || version !== this.connectionVersion || this.connection !== connection)
      return;
    const host = this.getHost();
    if (!host) return;
    const lease = host.attach(this.bridge(connection, version));
    if (this.terminal || version !== this.connectionVersion || this.connection !== connection)
      lease.dispose();
    else this.lease = lease;
  }

  readonly handle: AnchoredPositionHandle = {
    connect: (connection) => {
      if (this.terminal) return;
      const sameTargets =
        this.connection &&
        Object.is(this.connection.anchor, connection.anchor) &&
        Object.is(this.connection.floating, connection.floating);
      this.connection = connection;
      if (sameTargets && this.lease) {
        this.lease.update(this.bridge(connection, ++this.connectionVersion));
        return;
      }
      this.snapshot = null;
      this.attach(connection);
    },
    update: (config: AnchoredPositionConfig) => {
      if (this.terminal || !this.connection) return;
      this.connection = { ...this.connection, config };
      if (this.lease) {
        this.lease.update(this.bridge(this.connection, ++this.connectionVersion));
        return;
      }
      this.attach(this.connection);
    },
    requestUpdate: () => {
      if (!this.terminal) this.lease?.requestUpdate();
    },
    disconnect: () => this.disconnect(),
    getSnapshot: () => this.snapshot,
  };

  disconnect(): void {
    this.connectionVersion++;
    const previous = this.lease;
    this.lease = null;
    this.connection = null;
    this.snapshot = null;
    previous?.dispose();
  }

  dispose(): void {
    this.terminal = true;
    this.disconnect();
    this.availableHandle.disconnect();
    this.dispatchCallback = () => {};
  }
}

export { resolveAvailableExtent } from './available-layout';
