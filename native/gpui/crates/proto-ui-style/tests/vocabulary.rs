//! Checks the compiled-in vocabulary against the fixture on disk and against
//! the behaviour a host depends on.
//!
//! The fixture is the recorded output of the TypeScript compiler; the crate
//! embeds it. These tests exist to prove the embedding is faithful and that
//! the three resolutions stay distinguishable, because collapsing "unknown"
//! into "no declarations" is the failure mode that would silently render an
//! unstyled surface.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use proto_ui_style::{vocabulary, Resolution};
use serde_json::Value;

fn fixture_path() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../fixtures/style-tokens.json")
        .canonicalize()
        .expect("the fixture must exist next to the crate")
}

fn fixture() -> Value {
    serde_json::from_str(&fs::read_to_string(fixture_path()).expect("fixture is readable"))
        .expect("fixture parses")
}

#[test]
fn embeds_exactly_what_the_fixture_records() {
    let disk = fixture();
    let vocabulary = vocabulary();

    let recorded = disk["tokens"].as_object().expect("tokens object");
    let markers = disk["noDeclarations"].as_array().expect("marker array");

    assert_eq!(vocabulary.len(), recorded.len(), "token count");
    assert_eq!(vocabulary.marker_count(), markers.len(), "marker count");
    assert!(
        !vocabulary.is_empty(),
        "an empty vocabulary would make every token Unknown while every test below still passed"
    );

    for (token, declarations) in recorded {
        let expected: BTreeMap<String, String> = declarations
            .as_object()
            .expect("declaration object")
            .iter()
            .map(|(property, value)| {
                (
                    property.clone(),
                    value
                        .as_str()
                        .expect("declaration value is a string")
                        .to_string(),
                )
            })
            .collect();
        match vocabulary.resolve(token) {
            Resolution::Declarations(actual) => assert_eq!(actual, &expected, "{token}"),
            other => panic!("{token} resolved to {other:?}"),
        }
    }

    for marker in markers {
        let token = marker.as_str().expect("marker is a string");
        assert_eq!(
            vocabulary.resolve(token),
            Resolution::NoDeclarations,
            "{token}"
        );
    }
}

#[test]
fn keeps_unknown_apart_from_marker() {
    let vocabulary = vocabulary();

    // `peer` exists only so the site's real Tailwind can target it.
    assert_eq!(vocabulary.resolve("peer"), Resolution::NoDeclarations);

    // A typo, a Tailwind class this compiler does not implement, and a
    // variant-carrying token all have to be reported rather than ignored.
    for token in ["flexx", "sr-only", "data-[hovered]:bg-accent", ""] {
        assert_eq!(vocabulary.resolve(token), Resolution::Unknown, "{token}");
    }
}

#[test]
fn resolves_a_list_by_the_cascade() {
    let vocabulary = vocabulary();

    let resolved = vocabulary.resolve_all(["flex", "px-3", "px-2"]);
    assert_eq!(resolved.get("display"), Some("flex"));
    // Both tokens set padding-inline, and the cascade decides, not the order
    // they arrived in: `px-3` is emitted after `px-2`. This is not a way to
    // pick a padding — two tokens of one semantic group never reach a host
    // together, because the Feedback module's merge collapses them by author
    // order first. It is here to pin the rule that composition follows the
    // stylesheet.
    assert_eq!(resolved.get("padding-inline"), Some("0.75rem"));
    assert_eq!(
        vocabulary
            .resolve_all(["px-2", "px-3"])
            .get("padding-inline"),
        Some("0.75rem"),
        "arrival order must not change the result"
    );
    assert!(resolved.unknown.is_empty());

    // A token that sets two properties contributes both.
    let text = vocabulary.resolve_all(["text-sm"]);
    assert_eq!(text.get("font-size"), Some("0.875rem"));
    assert_eq!(text.get("line-height"), Some("1.25rem"));
}

#[test]
fn collects_unknown_tokens_instead_of_dropping_them() {
    let vocabulary = vocabulary();

    let resolved = vocabulary.resolve_all(["flex", "definitely-not-a-token", "peer", "also-not"]);
    // The known token still resolves, so a caller can render while reporting.
    assert_eq!(resolved.get("display"), Some("flex"));
    // Markers are silent; unknowns are not, and order is preserved.
    assert_eq!(resolved.unknown, vec!["definitely-not-a-token", "also-not"]);
}

#[test]
fn carries_the_composed_custom_properties_a_hand_port_would_lose() {
    let vocabulary = vocabulary();

    // Ring and shadow are not plain properties: they compose through custom
    // properties into one box-shadow, and the transform tokens do the same.
    let ring = vocabulary.resolve_all(["ring-3"]);
    assert_eq!(ring.get("--pui-ring-width"), Some("3px"));
    assert!(ring
        .get("box-shadow")
        .expect("box-shadow")
        .contains("--pui-ring-shadow"));

    let shadow = vocabulary.resolve_all(["shadow-sm"]);
    assert!(shadow.get("--pui-shadow").is_some());
    assert!(shadow
        .get("box-shadow")
        .expect("box-shadow")
        .contains("--pui-shadow"));

    let transform = vocabulary.resolve_all(["-translate-x-1/2"]);
    assert_eq!(transform.get("--pui-translate-x"), Some("-50%"));
    assert!(transform
        .get("transform")
        .expect("transform")
        .contains("--pui-translate-x"));

    // Alpha is expressed as a colour mix rather than a separate opacity.
    let tinted = vocabulary.resolve_all(["bg-accent/80"]);
    assert_eq!(
        tinted.get("background-color"),
        Some("color-mix(in oklab, var(--pui-accent) 80%, transparent)")
    );
}

#[test]
fn composes_in_cascade_order_not_arrival_order() {
    let vocabulary = vocabulary();

    // The compiler emits `leading-*` after the composite `text-*` utilities,
    // so an explicit line height beats the one inside `text-sm` whichever way
    // an author wrote them. Arrival order would let the second case lose it.
    for tokens in [["leading-none", "text-sm"], ["text-sm", "leading-none"]] {
        let resolved = vocabulary.resolve_all(tokens);
        assert_eq!(resolved.get("line-height"), Some("1"), "{tokens:?}");
        assert_eq!(resolved.get("font-size"), Some("0.875rem"), "{tokens:?}");
    }

    // The same holds for a non-unit leading value.
    for tokens in [["leading-6", "text-sm"], ["text-sm", "leading-6"]] {
        let resolved = vocabulary.resolve_all(tokens);
        assert_eq!(resolved.get("line-height"), Some("1.5rem"), "{tokens:?}");
    }

    // And for the timing utilities the compiler sorts after `transition-*`.
    // `transition-colors` carries its own 150ms duration, so an explicit
    // `duration-200` has to beat it from either side.
    for tokens in [
        ["duration-200", "transition-colors"],
        ["transition-colors", "duration-200"],
    ] {
        let resolved = vocabulary.resolve_all(tokens);
        assert_eq!(
            resolved.get("transition-duration"),
            Some("200ms"),
            "{tokens:?}"
        );
    }
}

#[test]
fn exposes_the_cascade_position_it_composes_by() {
    let vocabulary = vocabulary();

    let text = vocabulary.cascade_position("text-sm").expect("text-sm");
    let leading = vocabulary
        .cascade_position("leading-none")
        .expect("leading-none");
    assert!(
        leading > text,
        "leading-none must follow text-sm in the cascade"
    );

    let transition = vocabulary
        .cascade_position("transition-colors")
        .expect("transition-colors");
    let duration = vocabulary
        .cascade_position("duration-200")
        .expect("duration-200");
    assert!(duration > transition, "duration-* must follow transition-*");

    // A token the compiler never emitted has no position and is reported
    // rather than being given one.
    assert_eq!(vocabulary.cascade_position("not-a-token"), None);
    assert_eq!(vocabulary.cascade_position("peer"), None);
}
