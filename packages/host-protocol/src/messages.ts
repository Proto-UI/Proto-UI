import type {
  A11ySnapshotWire,
  DefaultActionRequest,
  FocusPlan,
  FocusTargetRef,
  HostDiagnostic,
  InputSample,
  InstanceId,
  LeaseId,
  ProjectionAck,
  ProjectionTransaction,
  SessionId,
  ViewEpoch,
  WireValue,
} from './wire';

/**
 * Message envelopes exchanged between the host (Rust/GPUI) and the semantic
 * runtime peer (TypeScript). Every envelope is bounded data; transport framing
 * is a separate, replaceable implementation choice.
 */

export type WireRecord = { readonly [key: string]: WireValue };

export type HostTopology = 'T0' | 'T1' | 'T2';

export type PeerHelloMessage = {
  readonly kind: 'peer.hello';
  readonly protocolVersion: number;
  readonly peer: { readonly name: string; readonly runtimeVersion: string };
  readonly bundle: {
    readonly bundleId: string;
    readonly digest: string;
    readonly entries: readonly string[];
  };
  readonly features: readonly string[];
};

export type HostHelloMessage = {
  readonly kind: 'host.hello';
  readonly protocolVersion: number;
  readonly host: {
    readonly name: string;
    readonly topology: HostTopology;
    readonly gpuiRevision: string;
    readonly platform: string;
    readonly backend: string;
  };
  readonly features: readonly string[];
};

export type SessionOpenMessage = {
  readonly kind: 'session.open';
  readonly sessionId: SessionId;
  readonly instanceId: InstanceId;
  readonly prototypeKey: string;
  readonly props: WireRecord;
  /**
   * The open session whose instance this one belongs to, such as a Switch for
   * its thumb. The host composes the instance tree; the peer resolves context,
   * anatomy and trigger lookups through it. Absent for a top-level instance.
   */
  readonly parentSessionId?: SessionId;
};

export type SessionOpenedMessage = {
  readonly kind: 'session.opened';
  readonly sessionId: SessionId;
  readonly status: 'ok' | 'failed';
  readonly diagnostics: readonly HostDiagnostic[];
};

export type PropsSetMessage = {
  readonly kind: 'props.set';
  readonly sessionId: SessionId;
  readonly props: WireRecord;
};

export type ProjectionInstallMessage = {
  readonly kind: 'projection.install';
  readonly transaction: ProjectionTransaction;
};

export type ProjectionAckMessage = {
  readonly kind: 'projection.ack';
  readonly ack: ProjectionAck;
};

export type ProjectionActivateMessage = {
  readonly kind: 'projection.activate';
  readonly sessionId: SessionId;
  readonly viewEpoch: ViewEpoch;
  readonly commitId: number;
};

/**
 * The instance unmounted the view of `viewEpoch` because its view intent no
 * longer wants one (C-LIFECYCLE-0008). The instance stays alive; a later
 * `projection.install` with a greater epoch attaches a new view.
 */
export type ProjectionDetachMessage = {
  readonly kind: 'projection.detach';
  readonly sessionId: SessionId;
  readonly viewEpoch: ViewEpoch;
};

export type LeaseReleaseMessage = {
  readonly kind: 'lease.release';
  readonly sessionId: SessionId;
  readonly leaseIds: readonly LeaseId[];
};

export type InputSampleMessage = {
  readonly kind: 'input.sample';
  readonly sessionId: SessionId;
  readonly sample: InputSample;
};

export type DefaultActionPreventMessage = {
  readonly kind: 'default-action.prevent';
  readonly request: DefaultActionRequest;
};

export type FocusRequestMessage = {
  readonly kind: 'focus.request';
  readonly sessionId: SessionId;
  readonly requestId: string;
  readonly target: FocusTargetRef;
  readonly action: 'focus' | 'blur';
  readonly options: { readonly preventScroll?: boolean };
};

export type FocusResultMessage = {
  readonly kind: 'focus.result';
  readonly sessionId: SessionId;
  readonly requestId: string;
  readonly status: 'applied' | 'not-ready' | 'rejected';
};

export type ExposeDescriptorMessage = {
  readonly kind: 'expose.descriptor';
  readonly sessionId: SessionId;
  readonly revision: number;
  readonly states: WireRecord;
  readonly methods: readonly string[];
  readonly signals: readonly string[];
  readonly unsupported: readonly string[];
};

export type ExposeStateMessage = {
  readonly kind: 'expose.state';
  readonly sessionId: SessionId;
  readonly revision: number;
  readonly name: string;
  readonly value: WireValue;
};

export type ExposeSignalMessage = {
  readonly kind: 'expose.signal';
  readonly sessionId: SessionId;
  readonly name: string;
  readonly payload: WireValue;
};

export type ExposeCallMessage = {
  readonly kind: 'expose.call';
  readonly sessionId: SessionId;
  readonly callId: string;
  readonly name: string;
  readonly args: readonly WireValue[];
};

export type ExposeResultMessage = {
  readonly kind: 'expose.result';
  readonly sessionId: SessionId;
  readonly callId: string;
  readonly status: 'ok' | 'failed' | 'unsupported';
  readonly value: WireValue;
  readonly diagnostics: readonly HostDiagnostic[];
};

export type A11ySnapshotMessage = {
  readonly kind: 'a11y.snapshot';
  readonly sessionId: SessionId;
  readonly viewEpoch: ViewEpoch;
  readonly snapshot: A11ySnapshotWire | null;
};

/**
 * The instance's focus plan changed outside a commit, as a roving group's
 * selection moves its tab stop. It replaces the plan the view carried, whole.
 */
export type FocusPlanMessage = {
  readonly kind: 'focus.plan';
  readonly sessionId: SessionId;
  readonly viewEpoch: ViewEpoch;
  readonly focus: FocusPlan;
};

/**
 * The instance root's feedback style changed outside a commit, as a rule on
 * hover or press changes it. It replaces the style the view carried, whole.
 */
export type StyleApplyMessage = {
  readonly kind: 'style.apply';
  readonly sessionId: SessionId;
  readonly viewEpoch: ViewEpoch;
  readonly tokens: readonly string[];
};

/**
 * Ends a session, and before it every session opened inside it, so that no
 * instance outlives the one it belongs to. The peer reports `session.disposed`
 * for each, a part before the instance it belongs to.
 */
export type SessionDisposeMessage = {
  readonly kind: 'session.dispose';
  readonly sessionId: SessionId;
};

export type SessionDisposedMessage = {
  readonly kind: 'session.disposed';
  readonly sessionId: SessionId;
};

export type LifecycleMessage = {
  readonly kind: 'lifecycle';
  readonly sessionId: SessionId;
  readonly event: WireRecord;
};

export type DiagnosticMessage = {
  readonly kind: 'diagnostic';
  readonly sessionId: SessionId | null;
  readonly diagnostic: HostDiagnostic;
};

export type HostToPeerMessage =
  | HostHelloMessage
  | SessionOpenMessage
  | PropsSetMessage
  | ProjectionAckMessage
  | InputSampleMessage
  | FocusResultMessage
  | ExposeCallMessage
  | SessionDisposeMessage;

export type PeerToHostMessage =
  | PeerHelloMessage
  | SessionOpenedMessage
  | ProjectionInstallMessage
  | ProjectionActivateMessage
  | ProjectionDetachMessage
  | LeaseReleaseMessage
  | DefaultActionPreventMessage
  | FocusRequestMessage
  | ExposeDescriptorMessage
  | ExposeStateMessage
  | ExposeSignalMessage
  | ExposeResultMessage
  | A11ySnapshotMessage
  | FocusPlanMessage
  | StyleApplyMessage
  | SessionDisposedMessage
  | LifecycleMessage
  | DiagnosticMessage;

export type ProtocolMessage = HostToPeerMessage | PeerToHostMessage;
