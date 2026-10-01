//! Replays the shared conformance vectors against the Rust host model.
//!
//! The same files are replayed by `packages/host-protocol/test/vectors.test.ts`
//! against the TypeScript model. The two implementations are a port and its
//! original, so any divergence has to fail somewhere; this is where.

use std::fs;
use std::path::{Path, PathBuf};

use proto_ui_host_protocol::model::{
    ActivationStatus, DefaultActionStatus, DeliveryRejection, DeliveryResult, HostSessionModel,
    InstallOptions, SessionPhase,
};
use proto_ui_host_protocol::wire::{
    DefaultActionRequest, InputSample, ProjectionAckStatus, ProjectionTransaction,
};
use serde::Deserialize;
use serde_json::{Map, Value};

#[derive(Debug, Deserialize)]
struct Vector {
    name: String,
    #[serde(rename = "sessionId")]
    session_id: String,
    steps: Vec<Step>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "op", rename_all = "camelCase")]
enum Step {
    Install {
        transaction: Box<ProjectionTransaction>,
        #[serde(default, rename = "failAllocation")]
        fail_allocation: Vec<String>,
        #[serde(rename = "expect")]
        expected: InstallExpectation,
    },
    Activate {
        #[serde(rename = "viewEpoch")]
        view_epoch: u64,
        #[serde(rename = "commitId")]
        commit_id: u64,
        #[serde(rename = "expect")]
        expected: StatusExpectation,
    },
    Release {
        #[serde(rename = "leaseIds")]
        lease_ids: Vec<String>,
        #[serde(rename = "expect")]
        expected: ReleaseExpectation,
    },
    Deliver {
        sample: InputSample,
        #[serde(rename = "expect")]
        expected: DeliverExpectation,
    },
    DefaultAction {
        request: DefaultActionRequest,
        #[serde(rename = "withinWindow")]
        within_window: bool,
        #[serde(rename = "expect")]
        expected: StatusExpectation,
    },
    Dispose {
        #[serde(rename = "expect")]
        expected: DisposeExpectation,
    },
    Snapshot {
        #[serde(rename = "expect")]
        expected: Map<String, Value>,
    },
}

#[derive(Debug, Deserialize)]
struct InstallExpectation {
    status: String,
    #[serde(default, rename = "readySurfaces")]
    ready_surfaces: Option<Vec<String>>,
    #[serde(default, rename = "diagnosticCodes")]
    diagnostic_codes: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct StatusExpectation {
    status: String,
}

#[derive(Debug, Deserialize)]
struct ReleaseExpectation {
    released: Vec<String>,
    #[serde(rename = "alreadyReleased")]
    already_released: Vec<String>,
    unknown: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct DeliverExpectation {
    status: String,
    #[serde(default, rename = "leaseIds")]
    lease_ids: Option<Vec<String>>,
    #[serde(default)]
    reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DisposeExpectation {
    status: String,
    #[serde(rename = "releasedLeaseIds")]
    released_lease_ids: Vec<String>,
}

fn vector_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../../../packages/host-protocol/vectors")
        .canonicalize()
        .expect("shared vector directory must exist relative to the crate")
}

fn ack_status(status: ProjectionAckStatus) -> &'static str {
    match status {
        ProjectionAckStatus::Applied => "applied",
        ProjectionAckStatus::Superseded => "superseded",
        ProjectionAckStatus::Unsupported => "unsupported",
        ProjectionAckStatus::Failed => "failed",
    }
}

fn activation_status(status: ActivationStatus) -> &'static str {
    match status {
        ActivationStatus::Activated => "activated",
        ActivationStatus::AlreadyActive => "already-active",
        ActivationStatus::Stale => "stale",
        ActivationStatus::NotInstalled => "not-installed",
        ActivationStatus::Disposed => "disposed",
    }
}

fn rejection(reason: DeliveryRejection) -> &'static str {
    match reason {
        DeliveryRejection::StaleEpoch => "stale-epoch",
        DeliveryRejection::InactiveEpoch => "inactive-epoch",
        DeliveryRejection::NoActiveLease => "no-active-lease",
        DeliveryRejection::DuplicateSample => "duplicate-sample",
        DeliveryRejection::Disposed => "disposed",
    }
}

fn default_action_status(status: DefaultActionStatus) -> &'static str {
    match status {
        DefaultActionStatus::Applied => "applied",
        DefaultActionStatus::LatePrevention => "late-prevention",
        DefaultActionStatus::Duplicate => "duplicate",
        DefaultActionStatus::UnknownSample => "unknown-sample",
        DefaultActionStatus::Disposed => "disposed",
    }
}

fn optional_u64(map: &Map<String, Value>, key: &str) -> Option<Option<u64>> {
    map.get(key).map(|value| value.as_u64())
}

fn apply(model: &mut HostSessionModel, step: &Step, label: &str) {
    match step {
        Step::Install {
            transaction,
            fail_allocation,
            expected,
        } => {
            let failing = fail_allocation.clone();
            let predicate =
                move |registration: &proto_ui_host_protocol::wire::EventRegistration| {
                    failing.contains(&registration.lease_id)
                };
            let options = if fail_allocation.is_empty() {
                InstallOptions::default()
            } else {
                InstallOptions {
                    fail_allocation: Some(&predicate),
                }
            };
            let ack = model.install_projection(transaction.as_ref(), &options);
            assert_eq!(ack_status(ack.status), expected.status, "{label} status");
            assert_eq!(ack.view_epoch, transaction.view_epoch, "{label} viewEpoch");
            assert_eq!(ack.commit_id, transaction.commit_id, "{label} commitId");
            if let Some(ready) = expected.ready_surfaces.as_ref() {
                assert_eq!(&ack.ready_surfaces, ready, "{label} readySurfaces");
            }
            if let Some(codes) = expected.diagnostic_codes.as_ref() {
                let actual: Vec<String> = ack
                    .diagnostics
                    .iter()
                    .map(|entry| entry.code.clone())
                    .collect();
                assert_eq!(&actual, codes, "{label} diagnostics");
            }
        }
        Step::Activate {
            view_epoch,
            commit_id,
            expected,
        } => {
            let status = model.activate(*view_epoch, *commit_id);
            assert_eq!(activation_status(status), expected.status, "{label}");
        }
        Step::Release {
            lease_ids,
            expected,
        } => {
            let result = model.release_leases(lease_ids);
            assert_eq!(&result.released, &expected.released, "{label} released");
            assert_eq!(
                &result.already_released, &expected.already_released,
                "{label} alreadyReleased"
            );
            assert_eq!(&result.unknown, &expected.unknown, "{label} unknown");
        }
        Step::Deliver { sample, expected } => match model.deliver(sample) {
            DeliveryResult::Delivered { lease_ids } => {
                assert_eq!(expected.status, "delivered", "{label} status");
                assert_eq!(
                    &lease_ids,
                    expected.lease_ids.as_ref().unwrap_or(&Vec::new()),
                    "{label} leaseIds"
                );
            }
            DeliveryResult::Rejected { reason } => {
                assert_eq!(expected.status, "rejected", "{label} status");
                assert_eq!(
                    Some(rejection(reason).to_string()),
                    expected.reason,
                    "{label} reason"
                );
            }
        },
        Step::DefaultAction {
            request,
            within_window,
            expected,
        } => {
            let status = model.request_default_action_prevention(request, *within_window);
            assert_eq!(default_action_status(status), expected.status, "{label}");
        }
        Step::Dispose { expected } => {
            let result = model.dispose();
            let status = if result.already_disposed {
                "already-disposed"
            } else {
                "disposed"
            };
            assert_eq!(status, expected.status, "{label} status");
            assert_eq!(
                &result.released_lease_ids, &expected.released_lease_ids,
                "{label} releasedLeaseIds"
            );
        }
        Step::Snapshot { expected } => {
            let snapshot = model.snapshot();
            if let Some(phase) = expected.get("phase").and_then(Value::as_str) {
                let actual = match snapshot.phase {
                    SessionPhase::Open => "open",
                    SessionPhase::Disposed => "disposed",
                };
                assert_eq!(actual, phase, "{label} phase");
            }
            if let Some(expected_epoch) = optional_u64(expected, "currentEpoch") {
                assert_eq!(
                    snapshot.current_epoch, expected_epoch,
                    "{label} currentEpoch"
                );
            }
            if let Some(expected_commit) = optional_u64(expected, "currentCommit") {
                assert_eq!(
                    snapshot.current_commit, expected_commit,
                    "{label} currentCommit"
                );
            }
            if let Some(expected_active) = optional_u64(expected, "activeEpoch") {
                assert_eq!(
                    snapshot.active_epoch, expected_active,
                    "{label} activeEpoch"
                );
            }
            if let Some(leases) = expected.get("leases").and_then(Value::as_array) {
                assert_eq!(snapshot.leases.len(), leases.len(), "{label} lease count");
                for (index, expected_lease) in leases.iter().enumerate() {
                    let actual = &snapshot.leases[index];
                    let expected_lease = expected_lease.as_object().expect("lease object");
                    assert_eq!(
                        Value::String(actual.lease_id.clone()),
                        expected_lease["leaseId"],
                        "{label} lease {index} id"
                    );
                    assert_eq!(
                        Value::Bool(actual.active),
                        expected_lease["active"],
                        "{label} lease {index} active"
                    );
                    assert_eq!(
                        Value::Bool(actual.released),
                        expected_lease["released"],
                        "{label} lease {index} released"
                    );
                    if let Some(commit) = expected_lease.get("commitId").and_then(Value::as_u64) {
                        assert_eq!(actual.commit_id, commit, "{label} lease {index} commitId");
                    }
                }
            }
            if let Some(codes) = expected.get("diagnosticCodes").and_then(Value::as_array) {
                let actual: Vec<Value> = snapshot
                    .diagnostics
                    .iter()
                    .map(|entry| Value::String(entry.code.clone()))
                    .collect();
                assert_eq!(&actual, codes, "{label} diagnostics");
            }
        }
    }
}

#[test]
fn replays_every_shared_vector() {
    let dir = vector_dir();
    let mut files: Vec<PathBuf> = fs::read_dir(&dir)
        .expect("vector directory is readable")
        .filter_map(|entry| entry.ok().map(|entry| entry.path()))
        .filter(|path| path.extension().is_some_and(|ext| ext == "json"))
        .collect();
    files.sort();

    assert!(
        !files.is_empty(),
        "no shared vectors found in {}; the TypeScript side would still pass, so this guard matters",
        dir.display()
    );
    assert!(
        files.iter().any(|path| path
            .file_name()
            .is_some_and(|name| name == "install-activate-deliver.json")),
        "the vector set lost its baseline case"
    );

    for path in files {
        let raw = fs::read_to_string(&path).expect("vector is readable");
        let vector: Vector =
            serde_json::from_str(&raw).unwrap_or_else(|error| panic!("{path:?}: {error}"));
        let mut model = HostSessionModel::new(vector.session_id.clone());
        let file = path.file_name().unwrap().to_string_lossy().to_string();
        for (index, step) in vector.steps.iter().enumerate() {
            let label = format!("{file} [{}] step {index}", vector.name);
            apply(&mut model, step, &label);
        }
    }
}
