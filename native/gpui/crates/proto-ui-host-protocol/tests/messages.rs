//! Round-trips every recorded protocol message through the Rust envelopes.
//!
//! `native/gpui/fixtures/protocol-messages.json` holds examples the TypeScript
//! compiler checked against `messages.ts`, one or more per kind. Each must
//! deserialize into the matching envelope and serialize back to exactly the
//! same JSON: a field the Rust side drops, renames or invents fails here.

use std::collections::BTreeSet;
use std::fs;
use std::path::Path;

use proto_ui_host_protocol::messages::{HostToPeerMessage, PeerToHostMessage};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Kinds {
    host_to_peer: Vec<String>,
    peer_to_host: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Fixture {
    kinds: Kinds,
    host_to_peer: Vec<Value>,
    peer_to_host: Vec<Value>,
}

fn fixture() -> Fixture {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/protocol-messages.json");
    let text = fs::read_to_string(path).expect("the message fixture reads");
    serde_json::from_str(&text).expect("the message fixture parses")
}

fn set(kinds: &[impl AsRef<str>]) -> BTreeSet<String> {
    kinds.iter().map(|kind| kind.as_ref().to_string()).collect()
}

#[test]
fn the_rust_envelopes_know_exactly_the_recorded_kinds() {
    let fixture = fixture();
    assert_eq!(
        set(HostToPeerMessage::KINDS),
        set(&fixture.kinds.host_to_peer)
    );
    assert_eq!(
        set(PeerToHostMessage::KINDS),
        set(&fixture.kinds.peer_to_host)
    );
}

/// Deserializes, checks the kind, serializes back and compares.
fn round_trip<M>(example: &Value, kind_of: impl Fn(&M) -> &'static str) -> Result<(), String>
where
    M: DeserializeOwned + Serialize,
{
    let message: M = serde_json::from_value(example.clone())
        .map_err(|error| format!("does not deserialize: {error}"))?;
    let expected_kind = example.get("kind").and_then(Value::as_str);
    if expected_kind != Some(kind_of(&message)) {
        return Err(format!("read back as `{}`", kind_of(&message)));
    }
    let back = serde_json::to_value(&message).map_err(|error| error.to_string())?;
    if &back != example {
        return Err(format!(
            "does not round-trip:\n  sent: {example}\n  back: {back}"
        ));
    }
    Ok(())
}

#[test]
fn every_host_to_peer_example_round_trips_exactly() {
    let failures: Vec<String> = fixture()
        .host_to_peer
        .iter()
        .filter_map(|example| {
            round_trip::<HostToPeerMessage>(example, HostToPeerMessage::kind)
                .err()
                .map(|error| format!("{}: {error}", example["kind"]))
        })
        .collect();
    assert!(failures.is_empty(), "{}", failures.join("\n"));
}

#[test]
fn every_peer_to_host_example_round_trips_exactly() {
    let failures: Vec<String> = fixture()
        .peer_to_host
        .iter()
        .filter_map(|example| {
            round_trip::<PeerToHostMessage>(example, PeerToHostMessage::kind)
                .err()
                .map(|error| format!("{}: {error}", example["kind"]))
        })
        .collect();
    assert!(failures.is_empty(), "{}", failures.join("\n"));
}

#[test]
fn a_message_in_the_wrong_direction_is_refused() {
    // A peer message arriving where host messages are expected is a protocol
    // error, not something to coerce.
    let peer_hello = fixture()
        .peer_to_host
        .into_iter()
        .find(|example| example["kind"] == "peer.hello")
        .expect("a peer.hello example");
    assert!(serde_json::from_value::<HostToPeerMessage>(peer_hello).is_err());
}
