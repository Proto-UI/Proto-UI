//! Replays the recorded event-type vocabulary against the Rust mirror.
//!
//! `native/gpui/fixtures/event-types.json` is generated from
//! `packages/types/src/event.ts` and the spec's own accepted/rejected
//! examples. Replaying it here means a type added on the TypeScript side
//! fails this test rather than producing a host that quietly ignores it.

use std::fs;
use std::path::{Path, PathBuf};

use proto_ui_host_protocol::event_type::{CoreEvent, EventType, OptionalEvent, EXTENSION_PREFIX};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Fixture {
    extension_prefix: String,
    core: Vec<String>,
    optional: Vec<String>,
    portable_fields: Vec<String>,
    accepted: Vec<String>,
    rejected: Vec<String>,
}

fn fixture_path() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../fixtures/event-types.json")
        .canonicalize()
        .expect("the recorded event-type fixture must exist relative to the crate")
}

fn fixture() -> Fixture {
    let text = fs::read_to_string(fixture_path()).expect("the fixture reads");
    serde_json::from_str(&text).expect("the fixture parses")
}

#[test]
fn the_core_vocabulary_matches_the_recorded_one() {
    let recorded = fixture().core;
    let mirrored: Vec<String> = CoreEvent::ALL
        .iter()
        .map(|event| event.as_str().to_string())
        .collect();
    // Order matters as well as membership: the vocabulary is declared as an
    // ordered list, and keeping the mirror in that order makes a diff between
    // the two readable.
    assert_eq!(mirrored, recorded);
}

#[test]
fn the_optional_vocabulary_matches_the_recorded_one() {
    let recorded = fixture().optional;
    let mirrored: Vec<String> = OptionalEvent::ALL
        .iter()
        .map(|event| event.as_str().to_string())
        .collect();
    assert_eq!(mirrored, recorded);
}

#[test]
fn every_recorded_type_round_trips_through_the_parser() {
    let fixture = fixture();
    for text in fixture.core.iter().chain(fixture.optional.iter()) {
        let parsed = EventType::parse(text).unwrap_or_else(|_| panic!("`{text}` must parse"));
        assert_eq!(parsed.as_str(), text);
        assert!(
            !parsed.is_extension(),
            "`{text}` is a semantic type, not a host-local one"
        );
    }
}

#[test]
fn the_spec_accepted_examples_all_parse() {
    for text in fixture().accepted {
        let parsed = EventType::parse(&text).unwrap_or_else(|_| panic!("`{text}` must parse"));
        assert_eq!(parsed.as_str(), text);
    }
}

#[test]
fn the_spec_rejected_examples_all_fail() {
    for text in fixture().rejected {
        let outcome = EventType::parse(&text);
        assert!(
            outcome.is_err(),
            "`{text}` must be rejected, got {outcome:?}"
        );
    }
}

#[test]
fn the_extension_prefix_must_be_exceeded_not_merely_matched() {
    let fixture = fixture();
    assert_eq!(fixture.extension_prefix, EXTENSION_PREFIX);

    // `host:` alone is in the spec's rejected list; this pins why, so the
    // reason survives even if that list is reorganised.
    assert!(EventType::parse(EXTENSION_PREFIX).is_err());

    let one_more = format!("{EXTENSION_PREFIX}c");
    let parsed = EventType::parse(&one_more).expect("one character past the prefix is enough");
    assert!(parsed.is_extension());
    match parsed {
        EventType::Extension(extension) => assert_eq!(extension.suffix(), "c"),
        other => panic!("expected an extension type, got {other:?}"),
    }
}

#[test]
fn a_semantic_type_is_never_treated_as_host_local() {
    // `input` has no dot and no prefix, which makes it the one semantic type
    // whose spelling could plausibly be mistaken for something else.
    let parsed = EventType::parse("input").expect("`input` is an optional type");
    assert_eq!(parsed, EventType::Optional(OptionalEvent::Input));
    assert!(!parsed.is_extension());
}

#[test]
fn the_portable_payload_fields_are_the_ones_input_sample_carries() {
    // `InputSample` is the wire record a host fills in. Its optional fields
    // must be exactly the portable payload fields, or the host would either
    // drop something the Runtime expects or carry something that is not
    // supposed to cross the boundary.
    let recorded = fixture().portable_fields;
    let carried = vec![
        "key".to_string(),
        "ctrlKey".to_string(),
        "metaKey".to_string(),
        "altKey".to_string(),
        "shiftKey".to_string(),
        "repeat".to_string(),
    ];
    assert_eq!(carried, recorded);

    // Serialising a sample with none of them set must produce none of them,
    // so an absent field stays absent rather than arriving as null.
    let sample = proto_ui_host_protocol::wire::InputSample {
        sample_id: "s-1".into(),
        view_epoch: 1,
        kind: EventType::Core(CoreEvent::PressCommit).as_str().to_string(),
        lease_ids: vec!["l-1".into()],
        key: None,
        ctrl_key: None,
        meta_key: None,
        alt_key: None,
        shift_key: None,
        repeat: None,
    };
    let json = serde_json::to_value(&sample).expect("a sample serialises");
    let object = json.as_object().expect("an object");
    for field in recorded {
        assert!(
            !object.contains_key(&field),
            "`{field}` should be absent, not null"
        );
    }
    assert_eq!(
        object.get("type").and_then(|v| v.as_str()),
        Some("press.commit")
    );
}
