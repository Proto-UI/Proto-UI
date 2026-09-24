//! Version 0 wire vocabulary.
//!
//! This mirrors `packages/host-protocol/src/wire.ts`. The TypeScript side also
//! carries a runtime guard (`assertWireValue`) because a JavaScript value can
//! hold a function, a sparse hole or a cycle. A `serde_json::Value` can hold
//! none of those, so the equivalent guard here is the type system plus serde:
//! anything that deserializes is already bounded data. What still has to be
//! checked by hand is *shape*, which `model` does before allocating anything.

use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const HOST_PROTOCOL_VERSION: u32 = 0;

pub type SessionId = String;
pub type InstanceId = String;
pub type ViewEpoch = u64;
pub type CommitId = u64;
pub type LeaseId = String;
pub type SampleId = String;
pub type SlotRef = String;
pub type SemanticObjectId = String;
pub type FocusTargetRef = String;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EventScope {
    Root,
    Global,
}

/// Reads a field that must be present but may be `null`.
///
/// serde reads a missing `Option` field as `None`, which makes an omitted
/// field indistinguishable from an explicit `null`. The protocol gives the two
/// different meanings: `a11y: null` retracts a snapshot, and a transaction
/// without `a11y` is malformed. With `deserialize_with` and no `default`, a
/// missing field is an error again, while `null` still reads as `None`.
pub(crate) fn required_nullable<'de, D, T>(deserializer: D) -> Result<Option<T>, D::Error>
where
    D: serde::Deserializer<'de>,
    T: serde::Deserialize<'de>,
{
    <Option<T> as serde::Deserialize>::deserialize(deserializer)
}

/// A registration exactly as it arrived. Every field is optional so that a
/// malformed plan reaches `model` as data and is answered with a bounded
/// acknowledgement, rather than failing deserialization.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RawEventRegistration {
    #[serde(default)]
    pub lease_id: Option<String>,
    #[serde(default)]
    pub scope: Option<String>,
    #[serde(default, rename = "type")]
    pub kind: Option<String>,
}

/// A registration that passed shape validation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EventRegistration {
    pub lease_id: LeaseId,
    pub scope: EventScope,
    pub kind: String,
}

impl RawEventRegistration {
    /// Validates the complete record. `None` means the plan must be rejected.
    pub fn validate(&self) -> Option<EventRegistration> {
        let lease_id = self.lease_id.as_ref().filter(|id| !id.is_empty())?.clone();
        let kind = self.kind.as_ref().filter(|kind| !kind.is_empty())?.clone();
        let scope = match self.scope.as_deref() {
            Some("root") => EventScope::Root,
            Some("global") => EventScope::Global,
            _ => return None,
        };
        Some(EventRegistration {
            lease_id,
            scope,
            kind,
        })
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct EventBindingPlan {
    pub registrations: Vec<RawEventRegistration>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FocusTargetPlan {
    pub r#ref: FocusTargetRef,
    pub sequential: bool,
    pub programmatic: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct FocusPlan {
    pub targets: Vec<FocusTargetPlan>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SlotPlan {
    pub slots: Vec<SlotRef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum A11yNameWire {
    Content,
    Text { value: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct A11ySnapshotWire {
    pub semantic_object_id: SemanticObjectId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<A11yNameWire>,
    pub states: serde_json::Map<String, Value>,
    /// Actions the object exposes, such as `activate`, each naming the event
    /// its invocation dispatches. The host needs these to project platform
    /// accessibility actions; without the field they were dropped on read.
    pub actions: std::collections::BTreeMap<String, A11yActionWire>,
    pub relations: serde_json::Map<String, Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub level: Option<u8>,
}

/// One accessibility action on a snapshot.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct A11yActionWire {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub event: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectionTransaction {
    pub protocol_version: u32,
    pub session_id: SessionId,
    pub instance_id: InstanceId,
    pub view_epoch: ViewEpoch,
    pub commit_id: CommitId,
    pub template: Value,
    pub slots: SlotPlan,
    pub events: EventBindingPlan,
    pub focus: FocusPlan,
    #[serde(deserialize_with = "required_nullable")]
    pub a11y: Option<A11ySnapshotWire>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProjectionAckStatus {
    Applied,
    Superseded,
    Unsupported,
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HostDiagnostic {
    pub code: String,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectionAck {
    pub session_id: SessionId,
    pub view_epoch: ViewEpoch,
    pub commit_id: CommitId,
    pub status: ProjectionAckStatus,
    pub ready_surfaces: Vec<String>,
    pub diagnostics: Vec<HostDiagnostic>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InputSample {
    pub sample_id: SampleId,
    pub view_epoch: ViewEpoch,
    #[serde(rename = "type")]
    pub kind: String,
    pub lease_ids: Vec<LeaseId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub key: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ctrl_key: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub meta_key: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub alt_key: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shift_key: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub repeat: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DefaultActionRequest {
    pub session_id: SessionId,
    pub sample_id: SampleId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
}
