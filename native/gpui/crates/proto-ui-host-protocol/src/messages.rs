//! Message envelopes exchanged with the semantic runtime peer, version 0.
//!
//! Mirrors `packages/host-protocol/src/messages.ts`. The TypeScript side is
//! types only, so the mirror is checked against examples the compiler has
//! checked against those types: `native/gpui/fixtures/protocol-messages.json`,
//! generated from `packages/host-protocol/test/message-examples.ts`.
//! `tests/messages.rs` round-trips every example through these envelopes and
//! requires the result to be identical, so a field dropped or invented here
//! fails a test rather than a session.
//!
//! Transport framing is not part of this module. An envelope is bounded data;
//! how it travels (stdio lines for T0, a QuickJS call for T1) is replaceable.

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use crate::wire::{
    A11ySnapshotWire, CommitId, DefaultActionRequest, FocusTargetRef, HostDiagnostic, InputSample,
    InstanceId, LeaseId, ProjectionAck, ProjectionTransaction, SessionId, ViewEpoch,
};

/// A record of wire values, as `WireRecord` is on the TypeScript side.
pub type WireRecord = Map<String, Value>;

/// Which protocol topology the host runs in.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum HostTopology {
    T0,
    T1,
    T2,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostInfo {
    pub name: String,
    pub topology: HostTopology,
    pub gpui_revision: String,
    pub platform: String,
    pub backend: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostHello {
    pub protocol_version: u32,
    pub host: HostInfo,
    pub features: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PeerInfo {
    pub name: String,
    pub runtime_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BundleInfo {
    pub bundle_id: String,
    pub digest: String,
    pub entries: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PeerHello {
    pub protocol_version: u32,
    pub peer: PeerInfo,
    pub bundle: BundleInfo,
    pub features: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionOpen {
    pub session_id: SessionId,
    pub instance_id: InstanceId,
    pub prototype_key: String,
    pub props: WireRecord,
}

/// `ok` or `failed`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OpenStatus {
    Ok,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionOpened {
    pub session_id: SessionId,
    pub status: OpenStatus,
    pub diagnostics: Vec<HostDiagnostic>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PropsSet {
    pub session_id: SessionId,
    pub props: WireRecord,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectionInstall {
    pub transaction: ProjectionTransaction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectionAckMessage {
    pub ack: ProjectionAck,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectionActivate {
    pub session_id: SessionId,
    pub view_epoch: ViewEpoch,
    pub commit_id: CommitId,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LeaseRelease {
    pub session_id: SessionId,
    pub lease_ids: Vec<LeaseId>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InputSampleMessage {
    pub session_id: SessionId,
    pub sample: InputSample,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DefaultActionPrevent {
    pub request: DefaultActionRequest,
}

/// What a `focus.request` asks for.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FocusAction {
    Focus,
    Blur,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FocusRequestOptions {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub prevent_scroll: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FocusRequest {
    pub session_id: SessionId,
    pub request_id: String,
    pub target: FocusTargetRef,
    pub action: FocusAction,
    pub options: FocusRequestOptions,
}

/// The outcome of a focus request: `applied`, `not-ready` or `rejected`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum FocusResultStatus {
    Applied,
    NotReady,
    Rejected,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FocusResult {
    pub session_id: SessionId,
    pub request_id: String,
    pub status: FocusResultStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExposeDescriptor {
    pub session_id: SessionId,
    pub revision: u64,
    pub states: WireRecord,
    pub methods: Vec<String>,
    pub signals: Vec<String>,
    pub unsupported: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExposeState {
    pub session_id: SessionId,
    pub revision: u64,
    pub name: String,
    pub value: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExposeSignal {
    pub session_id: SessionId,
    pub name: String,
    pub payload: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExposeCall {
    pub session_id: SessionId,
    pub call_id: String,
    pub name: String,
    pub args: Vec<Value>,
}

/// `ok`, `failed` or `unsupported`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExposeResultStatus {
    Ok,
    Failed,
    Unsupported,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExposeResult {
    pub session_id: SessionId,
    pub call_id: String,
    pub status: ExposeResultStatus,
    pub value: Value,
    pub diagnostics: Vec<HostDiagnostic>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct A11ySnapshotMessage {
    pub session_id: SessionId,
    pub view_epoch: ViewEpoch,
    /// Required and nullable: `null` retracts the snapshot, and a message
    /// without the field is malformed rather than a retraction.
    #[serde(deserialize_with = "crate::wire::required_nullable")]
    pub snapshot: Option<A11ySnapshotWire>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionDispose {
    pub session_id: SessionId,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionDisposed {
    pub session_id: SessionId,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Lifecycle {
    pub session_id: SessionId,
    pub event: WireRecord,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostic {
    /// `null` for a diagnostic that belongs to no session. Required, like
    /// `snapshot` above: an omitted field is malformed, not a sessionless
    /// diagnostic.
    #[serde(deserialize_with = "crate::wire::required_nullable")]
    pub session_id: Option<SessionId>,
    pub diagnostic: HostDiagnostic,
}

/// Declares a direction's envelope enum and its list of kinds from one list,
/// so the two cannot disagree.
macro_rules! envelopes {
    ($(#[$meta:meta])* $name:ident { $($variant:ident($payload:ty) => $kind:literal),+ $(,)? }) => {
        $(#[$meta])*
        #[derive(Debug, Clone, Serialize, Deserialize)]
        #[serde(tag = "kind")]
        pub enum $name {
            $(
                #[serde(rename = $kind)]
                $variant($payload),
            )+
        }

        impl $name {
            /// Every kind in this direction, in declaration order.
            pub const KINDS: &'static [&'static str] = &[$($kind),+];

            /// The wire spelling of this message's kind.
            pub fn kind(&self) -> &'static str {
                match self {
                    $(Self::$variant(_) => $kind),+
                }
            }
        }
    };
}

envelopes!(
    /// A message the host sends to the peer.
    HostToPeerMessage {
        HostHello(HostHello) => "host.hello",
        SessionOpen(SessionOpen) => "session.open",
        PropsSet(PropsSet) => "props.set",
        ProjectionAck(ProjectionAckMessage) => "projection.ack",
        InputSample(InputSampleMessage) => "input.sample",
        FocusResult(FocusResult) => "focus.result",
        ExposeCall(ExposeCall) => "expose.call",
        SessionDispose(SessionDispose) => "session.dispose",
    }
);

envelopes!(
    /// A message the peer sends to the host.
    PeerToHostMessage {
        PeerHello(PeerHello) => "peer.hello",
        SessionOpened(SessionOpened) => "session.opened",
        ProjectionInstall(ProjectionInstall) => "projection.install",
        ProjectionActivate(ProjectionActivate) => "projection.activate",
        LeaseRelease(LeaseRelease) => "lease.release",
        DefaultActionPrevent(DefaultActionPrevent) => "default-action.prevent",
        FocusRequest(FocusRequest) => "focus.request",
        ExposeDescriptor(ExposeDescriptor) => "expose.descriptor",
        ExposeState(ExposeState) => "expose.state",
        ExposeSignal(ExposeSignal) => "expose.signal",
        ExposeResult(ExposeResult) => "expose.result",
        A11ySnapshot(A11ySnapshotMessage) => "a11y.snapshot",
        SessionDisposed(SessionDisposed) => "session.disposed",
        Lifecycle(Lifecycle) => "lifecycle",
        Diagnostic(Diagnostic) => "diagnostic",
    }
);
