import type {
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

  protected override onCapsEpoch(): void {
    if (this.terminal) return;
    if (this.connection) this.attach(this.connection);
    if (this.availableConnection) this.attachAvailable(this.availableConnection);
  }

  private attachAvailable(connection: AvailableSpaceConnection): void {
    const version = ++this.availableVersion;
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
    const lease = host.attach({ ...connection, viewEpoch });
    if (
      this.terminal ||
      version !== this.availableVersion ||
      this.availableConnection !== connection
    )
      lease.dispose();
    else this.availableLease = lease;
  }

  readonly availableHandle: AvailableSpaceHandle = {
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

  private bridge(connection: AnchoredPositionConnection): AnchoredPositionConnection {
    const authoredResolved = connection.onResolved;
    return {
      ...connection,
      onResolved: (snapshot) => {
        this.snapshot = Object.freeze({ ...snapshot });
        authoredResolved?.(this.snapshot);
      },
    };
  }

  private attach(connection: AnchoredPositionConnection): void {
    this.lease?.dispose();
    this.lease = null;
    const host = this.getHost();
    if (!host) return;
    this.lease = host.attach(this.bridge(connection));
  }

  readonly handle: AnchoredPositionHandle = {
    connect: (connection) => {
      const sameTargets =
        this.connection &&
        Object.is(this.connection.anchor, connection.anchor) &&
        Object.is(this.connection.floating, connection.floating);
      this.connection = connection;
      if (sameTargets && this.lease) {
        this.lease.update(this.bridge(connection));
        return;
      }
      this.snapshot = null;
      this.attach(connection);
    },
    update: (config: AnchoredPositionConfig) => {
      if (!this.connection) return;
      this.connection = { ...this.connection, config };
      if (this.lease) {
        this.lease.update(this.bridge(this.connection));
        return;
      }
      this.attach(this.connection);
    },
    requestUpdate: () => this.lease?.requestUpdate(),
    disconnect: () => this.disconnect(),
    getSnapshot: () => this.snapshot,
  };

  disconnect(): void {
    this.lease?.dispose();
    this.lease = null;
    this.connection = null;
    this.snapshot = null;
  }
}
