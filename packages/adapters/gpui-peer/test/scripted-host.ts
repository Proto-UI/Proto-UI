import {
  createHostSessionModel,
  type HostSessionModel,
  type HostToPeerMessage,
  type InputSample,
  type PeerToHostMessage,
  type ProjectionTransaction,
  type WireValue,
} from '@proto.ui/host-protocol';

/**
 * A scripted host: the deterministic protocol model plus the acknowledgement,
 * activation and focus behaviour a real GPUI host would perform. It lets peer
 * behaviour be observed without Rust, a transport, or GPUI.
 */
export class ScriptedHost {
  readonly sent: PeerToHostMessage[] = [];
  readonly model: HostSessionModel;

  private toPeer: ((message: HostToPeerMessage) => void) | null = null;
  private transaction: ProjectionTransaction | null = null;
  private focusCounter = 0;

  constructor(
    readonly sessionId: string,
    private readonly options: {
      readonly autoAck?: boolean;
      /** A list, or a per-commit function, so readiness can be withdrawn. */
      readonly readySurfaces?: readonly string[] | ((commitId: number) => readonly string[]);
      readonly applyFocus?: boolean;
    } = {}
  ) {
    this.model = createHostSessionModel(sessionId);
  }

  bind(listener: (message: HostToPeerMessage) => void): void {
    this.toPeer = listener;
  }

  /** Sends one host message to the peer. */
  send(message: HostToPeerMessage): void {
    this.toPeer?.(message);
  }

  /** Receives one peer message and performs the host's half of the protocol. */
  receive(message: PeerToHostMessage): void {
    this.sent.push(message);
    switch (message.kind) {
      case 'projection.install': {
        this.transaction = message.transaction;
        if (this.options.autoAck === false) return;
        this.acknowledge();
        return;
      }
      case 'projection.activate':
        // The peer names the exact commit it is activating; the model rejects
        // an activation that does not match the installed commit.
        this.model.activate(message.viewEpoch, message.commitId);
        return;
      case 'lease.release':
        this.model.releaseLeases(message.leaseIds);
        return;
      case 'session.disposed':
        // Terminal disposal is the host's, and it releases what is left.
        this.model.dispose();
        return;
      case 'default-action.prevent':
        this.model.requestDefaultActionPrevention(message.request, { withinWindow: true });
        return;
      case 'focus.request': {
        if (this.options.applyFocus === false) {
          this.toPeer?.({
            kind: 'focus.result',
            sessionId: this.sessionId,
            requestId: message.requestId,
            status: 'rejected',
          });
          return;
        }
        this.toPeer?.({
          kind: 'focus.result',
          sessionId: this.sessionId,
          requestId: message.requestId,
          status: 'applied',
        });
        this.input(message.action === 'focus' ? 'host:focus' : 'host:blur');
        return;
      }
      default:
        return;
    }
  }

  /** Acknowledges the pending transaction, optionally overriding the status. */
  acknowledge(
    override?: Partial<{
      status: 'applied' | 'failed' | 'superseded' | 'unsupported';
      readySurfaces: readonly string[];
    }>
  ): void {
    const pending = this.transaction;
    if (!pending) throw new Error('[scripted-host] no pending transaction');
    const ack = this.model.installProjection(pending);
    this.toPeer?.({
      kind: 'projection.ack',
      ack: {
        ...ack,
        ...(override?.status ? { status: override.status } : {}),
        readySurfaces:
          override?.readySurfaces ?? this.readySurfacesFor(pending.commitId, ack.readySurfaces),
      },
    });
  }

  private readySurfacesFor(commitId: number, fallback: readonly string[]): readonly string[] {
    const configured = this.options.readySurfaces;
    if (configured === undefined) return fallback;
    return typeof configured === 'function' ? configured(commitId) : configured;
  }

  /** Delivers one native input sample through the model to every live lease. */
  input(type: string, detail: Partial<InputSample> = {}): void {
    const leaseIds = this.leaseIdsFor(type);
    const sample: InputSample = {
      sampleId: `${this.sessionId}:sample:${++this.focusCounter}`,
      viewEpoch: this.model.snapshot().currentEpoch ?? 0,
      type,
      leaseIds,
      ...detail,
    };
    const result = this.model.deliver(sample);
    if (result.status !== 'delivered') return;
    this.toPeer?.({
      kind: 'input.sample',
      sessionId: this.sessionId,
      sample: { ...sample, leaseIds: result.leaseIds },
    });
  }

  leaseIdsFor(type: string): string[] {
    return (this.transaction?.events.registrations ?? [])
      .filter((registration) => registration.type === type)
      .map((registration) => registration.leaseId);
  }

  of<K extends PeerToHostMessage['kind']>(kind: K): Extract<PeerToHostMessage, { kind: K }>[] {
    return this.sent.filter((message) => message.kind === kind) as Extract<
      PeerToHostMessage,
      { kind: K }
    >[];
  }

  last<K extends PeerToHostMessage['kind']>(
    kind: K
  ): Extract<PeerToHostMessage, { kind: K }> | undefined {
    return this.of(kind).at(-1);
  }

  /** Latest published value of one exposed state, descriptor included. */
  exposeState(name: string): WireValue | undefined {
    for (const message of [...this.sent].reverse()) {
      if (message.kind === 'expose.state' && message.name === name) return message.value;
      if (message.kind === 'expose.descriptor' && name in message.states) {
        return message.states[name];
      }
    }
    return undefined;
  }

  clear(): void {
    this.sent.length = 0;
  }
}
