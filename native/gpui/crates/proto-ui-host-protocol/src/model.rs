//! Deterministic model of the host side of the protocol.
//!
//! This is a port of `packages/host-protocol/src/model.ts`, not an independent
//! design. Both are replayed against `packages/host-protocol/vectors/`, so a
//! divergence fails on the side that drifted.

use serde_json::json;

use crate::wire::{
    CommitId, DefaultActionRequest, EventRegistration, EventScope, FocusTargetRef, HostDiagnostic,
    InputSample, InstanceId, LeaseId, ProjectionAck, ProjectionAckStatus, ProjectionTransaction,
    SampleId, SemanticObjectId, SessionId, SlotRef, ViewEpoch, HOST_PROTOCOL_VERSION,
};

const PROTO_SURFACE: &str = "proto-surface";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionPhase {
    Open,
    Disposed,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LeaseRecord {
    pub lease_id: LeaseId,
    pub scope: EventScope,
    pub kind: String,
    pub view_epoch: ViewEpoch,
    pub commit_id: CommitId,
    pub active: bool,
    pub released: bool,
}

#[derive(Debug, Clone, Default)]
pub struct RetainedLogicalState {
    pub instance_id: Option<InstanceId>,
    pub focus_targets: Vec<FocusTargetRef>,
    pub semantic_object_id: Option<SemanticObjectId>,
    pub slots: Vec<SlotRef>,
}

#[derive(Debug, Clone)]
pub struct HostSessionSnapshot {
    pub session_id: SessionId,
    pub phase: SessionPhase,
    pub current_epoch: Option<ViewEpoch>,
    pub current_commit: Option<CommitId>,
    pub active_epoch: Option<ViewEpoch>,
    pub leases: Vec<LeaseRecord>,
    pub retained: RetainedLogicalState,
    pub diagnostics: Vec<HostDiagnostic>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ActivationStatus {
    Activated,
    AlreadyActive,
    Stale,
    NotInstalled,
    Disposed,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ReleaseResult {
    pub released: Vec<LeaseId>,
    pub already_released: Vec<LeaseId>,
    pub unknown: Vec<LeaseId>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DeliveryRejection {
    StaleEpoch,
    InactiveEpoch,
    NoActiveLease,
    DuplicateSample,
    Disposed,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DeliveryResult {
    Delivered { lease_ids: Vec<LeaseId> },
    Rejected { reason: DeliveryRejection },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DefaultActionStatus {
    Applied,
    LatePrevention,
    Duplicate,
    UnknownSample,
    Disposed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DetachStatus {
    Detached,
    Stale,
    NotInstalled,
    Disposed,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DetachResult {
    pub status: DetachStatus,
    pub released_lease_ids: Vec<LeaseId>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DisposeResult {
    pub already_disposed: bool,
    pub released_lease_ids: Vec<LeaseId>,
}

/// Deterministic allocation-failure injection for transactional evidence.
#[derive(Default)]
pub struct InstallOptions<'a> {
    pub fail_allocation: Option<&'a dyn Fn(&EventRegistration) -> bool>,
}

#[derive(Debug)]
struct DeliveredSample {
    decided: bool,
}

pub struct HostSessionModel {
    session_id: SessionId,
    phase: SessionPhase,
    current_epoch: Option<ViewEpoch>,
    current_commit: Option<CommitId>,
    active_epoch: Option<ViewEpoch>,
    /// The last view the instance detached. No projection, commit or
    /// activation for it, or for anything older, can bring it back.
    retired_epoch: Option<ViewEpoch>,
    instance_id: Option<InstanceId>,
    focus_targets: Vec<FocusTargetRef>,
    semantic_object_id: Option<SemanticObjectId>,
    slots: Vec<SlotRef>,
    /// A vector, not a map: the snapshot preserves installation order, and the
    /// shared vectors assert that order.
    leases: Vec<LeaseRecord>,
    seen_lease_ids: Vec<LeaseId>,
    samples: Vec<(SampleId, DeliveredSample)>,
    diagnostics: Vec<HostDiagnostic>,
}

impl HostSessionModel {
    pub fn new(session_id: impl Into<SessionId>) -> Self {
        Self {
            session_id: session_id.into(),
            phase: SessionPhase::Open,
            current_epoch: None,
            current_commit: None,
            active_epoch: None,
            retired_epoch: None,
            instance_id: None,
            focus_targets: Vec::new(),
            semantic_object_id: None,
            slots: Vec::new(),
            leases: Vec::new(),
            seen_lease_ids: Vec::new(),
            samples: Vec::new(),
            diagnostics: Vec::new(),
        }
    }

    pub fn session_id(&self) -> &str {
        &self.session_id
    }

    fn diagnose(
        &mut self,
        code: &str,
        message: &str,
        data: Option<serde_json::Value>,
    ) -> HostDiagnostic {
        let diagnostic = HostDiagnostic {
            code: code.to_string(),
            message: message.to_string(),
            data,
        };
        self.diagnostics.push(diagnostic.clone());
        diagnostic
    }

    fn ack(
        &self,
        transaction: &ProjectionTransaction,
        status: ProjectionAckStatus,
        diagnostics: Vec<HostDiagnostic>,
        ready_surfaces: Vec<String>,
    ) -> ProjectionAck {
        ProjectionAck {
            session_id: self.session_id.clone(),
            view_epoch: transaction.view_epoch,
            commit_id: transaction.commit_id,
            status,
            ready_surfaces,
            diagnostics,
        }
    }

    fn lease(&self, lease_id: &str) -> Option<&LeaseRecord> {
        self.leases.iter().find(|lease| lease.lease_id == lease_id)
    }

    fn lease_mut(&mut self, lease_id: &str) -> Option<&mut LeaseRecord> {
        self.leases
            .iter_mut()
            .find(|lease| lease.lease_id == lease_id)
    }

    fn is_retired(&self, view_epoch: ViewEpoch) -> bool {
        self.retired_epoch
            .is_some_and(|retired| view_epoch <= retired)
    }

    fn is_stale(&self, view_epoch: ViewEpoch, commit_id: CommitId) -> bool {
        if self.is_retired(view_epoch) {
            return true;
        }
        match (self.current_epoch, self.current_commit) {
            (Some(epoch), Some(commit)) => {
                view_epoch < epoch || (view_epoch == epoch && commit_id <= commit)
            }
            _ => false,
        }
    }

    fn prune_before(&mut self, view_epoch: ViewEpoch, commit_id: CommitId, keep: &[LeaseId]) {
        for lease in self.leases.iter_mut() {
            if lease.released || keep.contains(&lease.lease_id) {
                continue;
            }
            let older = lease.view_epoch < view_epoch
                || (lease.view_epoch == view_epoch && lease.commit_id < commit_id);
            if !older {
                continue;
            }
            lease.active = false;
            lease.released = true;
        }
    }

    pub fn install_projection(
        &mut self,
        transaction: &ProjectionTransaction,
        options: &InstallOptions<'_>,
    ) -> ProjectionAck {
        if self.phase == SessionPhase::Disposed {
            let diagnostic = self.diagnose(
                "session-disposed",
                "projection arrived after terminal disposal",
                None,
            );
            return self.ack(
                transaction,
                ProjectionAckStatus::Failed,
                vec![diagnostic],
                Vec::new(),
            );
        }
        if transaction.protocol_version != HOST_PROTOCOL_VERSION {
            let diagnostic = self.diagnose(
                "protocol-version",
                "unsupported protocol version",
                Some(json!({
                    "requested": transaction.protocol_version,
                    "supported": HOST_PROTOCOL_VERSION,
                })),
            );
            return self.ack(
                transaction,
                ProjectionAckStatus::Unsupported,
                vec![diagnostic],
                Vec::new(),
            );
        }
        if transaction.session_id != self.session_id {
            let diagnostic = self.diagnose(
                "session-mismatch",
                "projection belongs to another session",
                Some(json!({ "requested": transaction.session_id })),
            );
            return self.ack(
                transaction,
                ProjectionAckStatus::Failed,
                vec![diagnostic],
                Vec::new(),
            );
        }
        if let Some(owned) = self.instance_id.clone() {
            if transaction.instance_id != owned {
                let diagnostic = self.diagnose(
                    "instance-mismatch",
                    "one session owns exactly one logical instance",
                    Some(json!({ "requested": transaction.instance_id, "owned": owned })),
                );
                return self.ack(
                    transaction,
                    ProjectionAckStatus::Failed,
                    vec![diagnostic],
                    Vec::new(),
                );
            }
        }
        if self.is_stale(transaction.view_epoch, transaction.commit_id) {
            let diagnostic = self.diagnose(
                "stale-projection",
                "projection is older than the current epoch or commit",
                Some(json!({
                    "currentEpoch": self.current_epoch,
                    "currentCommit": self.current_commit,
                })),
            );
            return self.ack(
                transaction,
                ProjectionAckStatus::Superseded,
                vec![diagnostic],
                Vec::new(),
            );
        }

        // Validate the complete plan before touching any host resource.
        let mut plan: Vec<EventRegistration> = Vec::new();
        let mut carried: Vec<LeaseId> = Vec::new();
        for (index, raw) in transaction.events.registrations.iter().enumerate() {
            let Some(registration) = raw.validate() else {
                let diagnostic = self.diagnose(
                    "malformed-registration",
                    "an Event registration is not a complete record",
                    Some(json!({ "index": index })),
                );
                return self.ack(
                    transaction,
                    ProjectionAckStatus::Failed,
                    vec![diagnostic],
                    Vec::new(),
                );
            };
            if plan
                .iter()
                .any(|entry| entry.lease_id == registration.lease_id)
            {
                let diagnostic = self.diagnose(
                    "duplicate-lease",
                    "a plan cannot register one lease id twice",
                    Some(json!({ "leaseId": registration.lease_id })),
                );
                return self.ack(
                    transaction,
                    ProjectionAckStatus::Failed,
                    vec![diagnostic],
                    Vec::new(),
                );
            }
            let existing = self.lease(&registration.lease_id).cloned();
            let continues = existing.as_ref().is_some_and(|lease| {
                !lease.released
                    && lease.view_epoch == transaction.view_epoch
                    && lease.scope == registration.scope
                    && lease.kind == registration.kind
            });
            if continues {
                carried.push(registration.lease_id.clone());
            } else if existing.is_some() || self.seen_lease_ids.contains(&registration.lease_id) {
                let diagnostic = self.diagnose(
                    "lease-reuse",
                    "a retired lease id is never reused within a session",
                    Some(json!({ "leaseId": registration.lease_id })),
                );
                return self.ack(
                    transaction,
                    ProjectionAckStatus::Failed,
                    vec![diagnostic],
                    Vec::new(),
                );
            }
            plan.push(registration);
        }
        if let Some(fail) = options.fail_allocation {
            for registration in plan.iter() {
                if carried.contains(&registration.lease_id) {
                    continue;
                }
                if fail(registration) {
                    let diagnostic = self.diagnose(
                        "allocation-failed",
                        "host could not allocate a lease; nothing was installed",
                        Some(json!({ "leaseId": registration.lease_id })),
                    );
                    return self.ack(
                        transaction,
                        ProjectionAckStatus::Failed,
                        vec![diagnostic],
                        Vec::new(),
                    );
                }
            }
        }

        // Apply: prune superseded records, carry continuing leases into the new
        // commit, and install every new lease inactive.
        let same_epoch = self.current_epoch == Some(transaction.view_epoch);
        self.prune_before(transaction.view_epoch, transaction.commit_id, &carried);
        self.current_epoch = Some(transaction.view_epoch);
        self.current_commit = Some(transaction.commit_id);
        if !same_epoch {
            self.active_epoch = None;
        }
        self.instance_id = Some(transaction.instance_id.clone());
        self.focus_targets = transaction
            .focus
            .targets
            .iter()
            .map(|target| target.r#ref.clone())
            .collect();
        self.slots = transaction.slots.slots.clone();
        if let Some(a11y) = transaction.a11y.as_ref() {
            self.semantic_object_id = Some(a11y.semantic_object_id.clone());
        }
        for registration in plan {
            if carried.contains(&registration.lease_id) {
                if let Some(lease) = self.lease_mut(&registration.lease_id) {
                    lease.commit_id = transaction.commit_id;
                }
                continue;
            }
            self.seen_lease_ids.push(registration.lease_id.clone());
            self.leases.push(LeaseRecord {
                lease_id: registration.lease_id,
                scope: registration.scope,
                kind: registration.kind,
                view_epoch: transaction.view_epoch,
                commit_id: transaction.commit_id,
                active: false,
                released: false,
            });
        }

        let mut ready = vec![PROTO_SURFACE.to_string()];
        ready.extend(self.slots.iter().cloned());
        self.ack(transaction, ProjectionAckStatus::Applied, Vec::new(), ready)
    }

    /// Activation is commit-qualified. A projection is installed inactive and
    /// only the exact commit that was acknowledged may be activated, so a
    /// delayed activation cannot make a newer projection live.
    pub fn activate(&mut self, view_epoch: ViewEpoch, commit_id: CommitId) -> ActivationStatus {
        if self.phase == SessionPhase::Disposed {
            return ActivationStatus::Disposed;
        }
        let Some(current) = self.current_epoch else {
            return if self.is_retired(view_epoch) {
                ActivationStatus::Stale
            } else {
                ActivationStatus::NotInstalled
            };
        };
        if view_epoch > current {
            return ActivationStatus::NotInstalled;
        }
        if view_epoch < current {
            return ActivationStatus::Stale;
        }
        let current_commit = self.current_commit;
        // Same epoch: only the installed commit may be activated. Without this
        // a late activation for an earlier commit would activate the current
        // commit's leases, including ones the earlier commit never saw.
        match current_commit {
            None => return ActivationStatus::NotInstalled,
            Some(installed) if commit_id > installed => return ActivationStatus::NotInstalled,
            Some(installed) if commit_id < installed => return ActivationStatus::Stale,
            Some(_) => {}
        }
        let already = self.active_epoch == Some(view_epoch)
            && self
                .leases
                .iter()
                .filter(|lease| !lease.released && Some(lease.commit_id) == current_commit)
                .all(|lease| lease.active);
        if already {
            return ActivationStatus::AlreadyActive;
        }
        for lease in self.leases.iter_mut() {
            if !lease.released && Some(lease.commit_id) == current_commit {
                lease.active = true;
            }
        }
        self.active_epoch = Some(view_epoch);
        ActivationStatus::Activated
    }

    pub fn release_leases(&mut self, lease_ids: &[LeaseId]) -> ReleaseResult {
        let mut result = ReleaseResult::default();
        for lease_id in lease_ids {
            match self.lease_mut(lease_id) {
                None => result.unknown.push(lease_id.clone()),
                Some(lease) if lease.released => result.already_released.push(lease_id.clone()),
                Some(lease) => {
                    lease.active = false;
                    lease.released = true;
                    result.released.push(lease_id.clone());
                }
            }
        }
        result
    }

    pub fn deliver(&mut self, sample: &InputSample) -> DeliveryResult {
        if self.phase == SessionPhase::Disposed {
            return DeliveryResult::Rejected {
                reason: DeliveryRejection::Disposed,
            };
        }
        let stale = match self.current_epoch {
            None => true,
            Some(current) => sample.view_epoch < current,
        };
        if stale {
            self.diagnose(
                "stale-sample",
                "input sample carries a retired view epoch",
                Some(json!({ "sampleId": sample.sample_id, "viewEpoch": sample.view_epoch })),
            );
            return DeliveryResult::Rejected {
                reason: DeliveryRejection::StaleEpoch,
            };
        }
        if Some(sample.view_epoch) != self.current_epoch || self.active_epoch != self.current_epoch
        {
            return DeliveryResult::Rejected {
                reason: DeliveryRejection::InactiveEpoch,
            };
        }
        if self
            .samples
            .iter()
            .any(|(id, _)| id.as_str() == sample.sample_id)
        {
            return DeliveryResult::Rejected {
                reason: DeliveryRejection::DuplicateSample,
            };
        }
        let targets: Vec<LeaseId> = sample
            .lease_ids
            .iter()
            .filter(|lease_id| {
                self.lease(lease_id).is_some_and(|lease| {
                    lease.active
                        && !lease.released
                        && lease.view_epoch == sample.view_epoch
                        && lease.kind == sample.kind
                })
            })
            .cloned()
            .collect();
        if targets.is_empty() {
            return DeliveryResult::Rejected {
                reason: DeliveryRejection::NoActiveLease,
            };
        }
        self.samples
            .push((sample.sample_id.clone(), DeliveredSample { decided: false }));
        DeliveryResult::Delivered { lease_ids: targets }
    }

    pub fn request_default_action_prevention(
        &mut self,
        request: &DefaultActionRequest,
        within_window: bool,
    ) -> DefaultActionStatus {
        if self.phase == SessionPhase::Disposed {
            return DefaultActionStatus::Disposed;
        }
        if request.session_id != self.session_id {
            return DefaultActionStatus::UnknownSample;
        }
        let Some((_, sample)) = self
            .samples
            .iter_mut()
            .find(|(id, _)| id.as_str() == request.sample_id)
        else {
            return DefaultActionStatus::UnknownSample;
        };
        if sample.decided {
            return DefaultActionStatus::Duplicate;
        }
        sample.decided = true;
        if within_window {
            return DefaultActionStatus::Applied;
        }
        self.diagnose(
            "late-prevention",
            "default action already ran before the guest decision arrived",
            Some(json!({ "sampleId": request.sample_id })),
        );
        DefaultActionStatus::LatePrevention
    }

    /// Retires the installed view when the instance detaches it: its leases
    /// are released and nothing more is delivered to it. The session stays
    /// open, so the instance keeps its logical state (C-LIFECYCLE-0008-E), and
    /// only a greater epoch can install a view again.
    pub fn detach_view(&mut self, view_epoch: ViewEpoch) -> DetachResult {
        let refused = |status| DetachResult {
            status,
            released_lease_ids: Vec::new(),
        };
        if self.phase == SessionPhase::Disposed {
            return refused(DetachStatus::Disposed);
        }
        if self.current_epoch != Some(view_epoch) {
            let older = self.is_retired(view_epoch)
                || self
                    .current_epoch
                    .is_some_and(|current| view_epoch < current);
            return refused(if older {
                DetachStatus::Stale
            } else {
                DetachStatus::NotInstalled
            });
        }
        let released_lease_ids: Vec<LeaseId> = self
            .leases
            .iter()
            .filter(|lease| !lease.released)
            .map(|lease| lease.lease_id.clone())
            .collect();
        for lease in self.leases.iter_mut() {
            if !lease.released {
                lease.active = false;
                lease.released = true;
            }
        }
        self.retired_epoch = self.current_epoch.take();
        self.current_commit = None;
        self.active_epoch = None;
        DetachResult {
            status: DetachStatus::Detached,
            released_lease_ids,
        }
    }

    pub fn dispose(&mut self) -> DisposeResult {
        if self.phase == SessionPhase::Disposed {
            return DisposeResult {
                already_disposed: true,
                released_lease_ids: Vec::new(),
            };
        }
        let released_lease_ids: Vec<LeaseId> = self
            .leases
            .iter()
            .filter(|lease| !lease.released)
            .map(|lease| lease.lease_id.clone())
            .collect();
        for lease in self.leases.iter_mut() {
            if !lease.released {
                lease.active = false;
                lease.released = true;
            }
        }
        self.samples.clear();
        self.active_epoch = None;
        self.phase = SessionPhase::Disposed;
        DisposeResult {
            already_disposed: false,
            released_lease_ids,
        }
    }

    pub fn snapshot(&self) -> HostSessionSnapshot {
        HostSessionSnapshot {
            session_id: self.session_id.clone(),
            phase: self.phase,
            current_epoch: self.current_epoch,
            current_commit: self.current_commit,
            active_epoch: self.active_epoch,
            leases: self.leases.clone(),
            retained: RetainedLogicalState {
                instance_id: self.instance_id.clone(),
                focus_targets: self.focus_targets.clone(),
                semantic_object_id: self.semantic_object_id.clone(),
                slots: self.slots.clone(),
            },
            diagnostics: self.diagnostics.clone(),
        }
    }
}
