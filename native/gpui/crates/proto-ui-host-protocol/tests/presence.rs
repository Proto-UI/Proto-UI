//! Field presence on the wire: an omitted required field must not be read as
//! a valid value.
//!
//! The round-trip suite only feeds valid examples, so it cannot tell a field
//! the Rust side requires from one it quietly defaults. These cases start from
//! the same compiler-checked examples and remove one field at a time.
//!
//! Three kinds of field are pinned:
//!
//! - required: omission is an error;
//! - required but nullable: omission is an error, and an explicit `null` still
//!   reads and writes back as `null`;
//! - optional: omission is fine.

use std::fs;
use std::path::Path;

use proto_ui_host_protocol::messages::{HostToPeerMessage, PeerToHostMessage};
use serde_json::Value;

fn fixture() -> Value {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/protocol-messages.json");
    serde_json::from_str(&fs::read_to_string(path).expect("the message fixture reads"))
        .expect("the message fixture parses")
}

/// The first recorded example of `kind` for which `wanted` holds.
fn example(direction: &str, kind: &str, wanted: impl Fn(&Value) -> bool) -> Value {
    fixture()[direction]
        .as_array()
        .expect("examples")
        .iter()
        .find(|example| example["kind"] == kind && wanted(example))
        .cloned()
        .unwrap_or_else(|| panic!("no {direction} example of {kind}"))
}

/// Removes the last key of `path` from the object the rest of it names.
fn without(mut value: Value, path: &[&str]) -> Value {
    let (last, parents) = path.split_last().expect("a non-empty path");
    let mut object = &mut value;
    for key in parents {
        object = object.get_mut(*key).unwrap_or_else(|| panic!("no `{key}`"));
    }
    let removed = object.as_object_mut().expect("an object").remove(*last);
    assert!(
        removed.is_some(),
        "`{}` was not present to remove",
        path.join(".")
    );
    value
}

fn reads_as_peer_message(value: Value) -> Result<PeerToHostMessage, serde_json::Error> {
    serde_json::from_value(value)
}

fn reads_as_host_message(value: Value) -> Result<HostToPeerMessage, serde_json::Error> {
    serde_json::from_value(value)
}

fn any(_: &Value) -> bool {
    true
}

fn full_snapshot(example: &Value) -> bool {
    example["snapshot"]["role"].is_string()
}

#[test]
fn an_omitted_part_of_a_projection_is_refused() {
    let install = example("peerToHost", "projection.install", |example| {
        example["transaction"]["a11y"].is_object()
    });
    for path in [
        ["transaction", "template"].as_slice(),
        &["transaction", "slots"],
        &["transaction", "events"],
        &["transaction", "focus"],
        &["transaction", "style"],
        &["transaction", "a11y"],
        &["transaction", "slots", "slots"],
        &["transaction", "events", "registrations"],
        &["transaction", "focus", "targets"],
        &["transaction", "a11y", "states"],
        &["transaction", "a11y", "actions"],
        &["transaction", "a11y", "relations"],
    ] {
        let error = reads_as_peer_message(without(install.clone(), path));
        assert!(
            error.is_err(),
            "a projection without `{}` must not read as a valid one",
            path.join(".")
        );
    }
}

#[test]
fn an_omitted_snapshot_is_not_a_retraction() {
    // `snapshot: null` retracts; a message without `snapshot` is malformed.
    let snapshot = example("peerToHost", "a11y.snapshot", full_snapshot);
    assert!(reads_as_peer_message(without(snapshot.clone(), &["snapshot"])).is_err());
    for field in ["states", "actions", "relations"] {
        assert!(
            reads_as_peer_message(without(snapshot.clone(), &["snapshot", field])).is_err(),
            "a snapshot without `{field}` must not read as an empty one"
        );
    }

    let mut retraction = snapshot;
    retraction["snapshot"] = Value::Null;
    let read = reads_as_peer_message(retraction.clone()).expect("an explicit null is a retraction");
    assert_eq!(serde_json::to_value(read).expect("writes back"), retraction);
}

#[test]
fn an_omitted_diagnostic_session_is_not_a_sessionless_diagnostic() {
    let diagnostic = example("peerToHost", "diagnostic", |example| {
        example["sessionId"].is_string()
    });
    assert!(reads_as_peer_message(without(diagnostic.clone(), &["sessionId"])).is_err());

    let mut sessionless = diagnostic;
    sessionless["sessionId"] = Value::Null;
    let read = reads_as_peer_message(sessionless.clone()).expect("an explicit null is sessionless");
    assert_eq!(
        serde_json::to_value(read).expect("writes back"),
        sessionless
    );
}

#[test]
fn an_explicitly_absent_projection_snapshot_still_round_trips() {
    let install = example("peerToHost", "projection.install", |example| {
        example["transaction"]["a11y"].is_null()
    });
    let read = reads_as_peer_message(install.clone()).expect("`a11y: null` is allowed");
    assert_eq!(serde_json::to_value(read).expect("writes back"), install);
}

#[test]
fn a_sample_without_its_leases_is_refused() {
    let sample = example("hostToPeer", "input.sample", any);
    assert!(reads_as_host_message(without(sample, &["sample", "leaseIds"])).is_err());
}

#[test]
fn optional_fields_may_be_omitted() {
    // The fields the TypeScript types mark with `?`. Tightening the required
    // ones must not have made these required too.
    let snapshot = example("peerToHost", "a11y.snapshot", full_snapshot);
    for field in ["role", "name", "level"] {
        reads_as_peer_message(without(snapshot.clone(), &["snapshot", field]))
            .unwrap_or_else(|error| panic!("`snapshot.{field}` is optional: {error}"));
    }
    let sample = example("hostToPeer", "input.sample", |example| {
        example["sample"]["key"].is_string()
    });
    for field in ["key", "ctrlKey", "repeat"] {
        reads_as_host_message(without(sample.clone(), &["sample", field]))
            .unwrap_or_else(|error| panic!("`sample.{field}` is optional: {error}"));
    }
    let diagnostic = example("peerToHost", "diagnostic", |example| {
        example["diagnostic"]["data"].is_object()
    });
    reads_as_peer_message(without(diagnostic, &["diagnostic", "data"]))
        .expect("`diagnostic.data` is optional");
    let focus = example("peerToHost", "focus.request", |example| {
        example["options"]["preventScroll"].is_boolean()
    });
    reads_as_peer_message(without(focus, &["options", "preventScroll"]))
        .expect("`options.preventScroll` is optional");
    let part = example("hostToPeer", "session.open", |example| {
        example["parentSessionId"].is_string()
    });
    reads_as_host_message(without(part, &["parentSessionId"]))
        .expect("`parentSessionId` is optional: a top-level instance has no parent");
    let trigger = example("peerToHost", "projection.install", |example| {
        example["transaction"]["events"]["trigger"].is_object()
    });
    reads_as_peer_message(without(trigger, &["transaction", "events", "trigger"]))
        .expect("`events.trigger` is optional: most instances are not triggers");
}
