//! The accessibility snapshot, projected onto AccessKit.
//!
//! Where it can, each case starts from a snapshot the real peer sent for Base
//! Button, so the mapping is checked against what a Prototype says rather than
//! against snapshots written next to the mapping.

use std::fs;
use std::path::Path;

use gpui::{Role, Toggled};
use proto_ui_gpui::a11y::{project, A11yIssue, A11yProjection};
use proto_ui_host_protocol::messages::PeerToHostMessage;
use proto_ui_host_protocol::wire::A11ySnapshotWire;
use serde_json::{json, Value};

/// The snapshot the peer installed with a recorded session's projection.
fn recorded(fixture: &str, session: &str) -> A11ySnapshotWire {
    let path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../fixtures")
        .join(fixture);
    let fixture: Value =
        serde_json::from_str(&fs::read_to_string(path).expect("the fixture reads"))
            .expect("the fixture parses");
    fixture["sessions"][session]
        .as_array()
        .expect("a recorded session")
        .iter()
        .map(|message| serde_json::from_value(message.clone()).expect("a peer message"))
        .find_map(|message| match message {
            PeerToHostMessage::ProjectionInstall(install) => install.transaction.a11y,
            _ => None,
        })
        .expect("the recorded projection carries a snapshot")
}

fn snapshot(value: Value) -> A11ySnapshotWire {
    serde_json::from_value(value).expect("a valid snapshot")
}

#[test]
fn the_recorded_button_is_a_button_named_by_its_content() {
    let (projection, issues) = project(&recorded("base-button-session.json", "enabled"));
    assert_eq!(
        projection,
        Some(A11yProjection {
            role: Role::Button,
            // `name: { kind: "content" }`: no label, so AccessKit names the
            // button from the text beneath it.
            label: None,
            disabled: false,
            toggled: None,
            activatable: true,
        })
    );
    assert!(issues.is_empty(), "{issues:?}");
}

#[test]
fn the_recorded_disabled_button_is_reported_disabled() {
    let (projection, issues) = project(&recorded("base-button-session.json", "disabled"));
    let projection = projection.expect("a projection");
    assert!(projection.disabled);
    // Disabled is a state, not the absence of the action: the Prototype
    // decides what an activation of a disabled Button does.
    assert!(projection.activatable);
    assert!(issues.is_empty(), "{issues:?}");
}

#[test]
fn the_recorded_toggle_is_a_toggle_button_on_or_off() {
    let toggled = |session: &str| {
        let (projection, issues) = project(&recorded("base-toggle-session.json", session));
        assert!(issues.is_empty(), "{session}: {issues:?}");
        let projection = projection.expect("a projection");
        assert_eq!(projection.role, Role::Button);
        (projection.toggled, projection.disabled)
    };
    assert_eq!(toggled("inactive"), (Some(Toggled::False), false));
    assert_eq!(toggled("active"), (Some(Toggled::True), false));
    assert_eq!(toggled("disabled"), (Some(Toggled::False), true));
}

#[test]
fn a_pressed_state_that_is_not_a_boolean_is_reported_not_guessed() {
    let (projection, issues) = project(&snapshot(json!({
        "semanticObjectId": "object",
        "role": "button",
        "states": { "pressed": "mixed" },
        "actions": {},
        "relations": {},
    })));
    assert_eq!(projection.expect("a projection").toggled, None);
    assert_eq!(
        issues,
        [A11yIssue::State {
            name: "pressed".into(),
            value: json!("mixed"),
        }]
    );
}

#[test]
fn a_text_name_becomes_the_label() {
    let (projection, _) = project(&snapshot(json!({
        "semanticObjectId": "object",
        "role": "button",
        "name": { "kind": "text", "value": "Close dialog" },
        "states": {},
        "actions": {},
        "relations": {},
    })));
    let projection = projection.expect("a projection");
    assert_eq!(projection.label.as_deref(), Some("Close dialog"));
    assert!(!projection.activatable);
}

#[test]
fn a_role_without_a_mapping_is_not_reported_as_anything_else() {
    let (projection, issues) = project(&snapshot(json!({
        "semanticObjectId": "object",
        "role": "tab",
        "states": { "selected": true },
        "actions": { "activate": { "event": "click" } },
        "relations": {},
    })));
    assert_eq!(projection, None);
    assert_eq!(issues, [A11yIssue::Role("tab".into())]);
}

#[test]
fn a_snapshot_without_a_role_is_not_reported() {
    let (projection, issues) = project(&snapshot(json!({
        "semanticObjectId": "object",
        "states": {},
        "actions": {},
        "relations": {},
    })));
    assert_eq!(projection, None);
    assert_eq!(issues, [A11yIssue::NoRole]);
}

#[test]
fn facts_outside_the_mapping_are_named_and_the_rest_still_projects() {
    let (projection, issues) = project(&snapshot(json!({
        "semanticObjectId": "object",
        "role": "button",
        "states": { "disabled": "yes", "expanded": true },
        "actions": { "activate": { "event": "click" }, "expand": {} },
        "relations": { "controls": ["other"], "describedBy": null },
        "level": 2,
    })));
    let projection = projection.expect("the button still projects");
    assert!(projection.activatable);
    // A disabled state that is not a boolean is reported, not guessed at.
    assert!(!projection.disabled);
    assert_eq!(
        issues,
        [
            A11yIssue::State {
                name: "disabled".into(),
                value: json!("yes"),
            },
            A11yIssue::State {
                name: "expanded".into(),
                value: json!(true),
            },
            A11yIssue::Action("expand".into()),
            // `describedBy: null` is the absence of a relation.
            A11yIssue::Relation("controls".into()),
            A11yIssue::Level(2),
        ]
    );
}
