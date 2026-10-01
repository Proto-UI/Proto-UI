//! The accessibility snapshot, projected onto AccessKit.
//!
//! Where it can, each case starts from a snapshot the real peer sent for Base
//! Button, so the mapping is checked against what a Prototype says rather than
//! against snapshots written next to the mapping.

use std::fs;
use std::path::Path;

use gpui::{Orientation, Role, Toggled};
use proto_ui_gpui::a11y::{
    names_from_descendants, project, A11yIssue, A11yProjection, A11yReference,
};
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
            name_from_content: true,
            disabled: false,
            toggled: None,
            selected: None,
            orientation: None,
            labelled_by: None,
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
fn the_recorded_switch_is_a_switch_on_or_off_named_by_its_content() {
    let switch = |session: &str| {
        let (projection, issues) = project(&recorded("base-switch-session.json", session));
        assert!(issues.is_empty(), "{session}: {issues:?}");
        projection.expect("a projection")
    };
    let off = switch("root");
    assert_eq!(off.role, Role::Switch);
    assert_eq!(off.toggled, Some(Toggled::False));
    // AccessKit does not name a switch from its content, so the host will.
    assert!(off.name_from_content);
    assert!(!names_from_descendants(Role::Switch));
    assert_eq!(switch("checked").toggled, Some(Toggled::True));
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
    assert!(!projection.name_from_content);
    assert!(!projection.activatable);
}

#[test]
fn a_role_without_a_mapping_is_not_reported_as_anything_else() {
    let (projection, issues) = project(&snapshot(json!({
        "semanticObjectId": "object",
        "role": "slider",
        "states": { "disabled": false },
        "actions": { "activate": { "event": "click" } },
        "relations": {},
    })));
    assert_eq!(projection, None);
    assert_eq!(issues, [A11yIssue::Role("slider".into())]);
}

#[test]
fn a_tab_is_reported_selected_and_named_by_its_content() {
    // What Base Tabs' trigger says about itself.
    let (projection, issues) = project(&snapshot(json!({
        "semanticObjectId": "trigger",
        "id": "pui-tabs-1-trigger-overview",
        "role": "tab",
        "name": { "kind": "content" },
        "states": { "selected": true, "disabled": false },
        "actions": { "activate": { "event": "click" } },
        "relations": { "controls": "pui-tabs-1-content-overview" },
    })));
    let projection = projection.expect("a tab is reported");
    assert_eq!(projection.role, Role::Tab);
    assert_eq!(projection.selected, Some(true));
    assert!(projection.name_from_content);
    assert!(projection.activatable);
    // GPUI sets no AccessKit relation at the pin, so `controls` is not carried.
    assert_eq!(issues, [A11yIssue::Relation("controls".into())]);
}

#[test]
fn a_tab_list_says_which_way_it_runs() {
    let list = |orientation: &str| {
        snapshot(json!({
            "semanticObjectId": "list",
            "role": "tablist",
            "name": { "kind": "text", "value": "Sections" },
            "states": { "orientation": orientation },
            "actions": {},
            "relations": {},
        }))
    };
    for (value, orientation) in [
        ("horizontal", Orientation::Horizontal),
        ("vertical", Orientation::Vertical),
    ] {
        let (projection, issues) = project(&list(value));
        let projection = projection.expect("a tab list is reported");
        assert_eq!(projection.role, Role::TabList);
        assert_eq!(projection.orientation, Some(orientation));
        assert!(issues.is_empty(), "{issues:?}");
    }
    let (projection, issues) = project(&list("diagonal"));
    assert_eq!(projection.expect("still a tab list").orientation, None);
    assert_eq!(
        issues,
        [A11yIssue::State {
            name: "orientation".into(),
            value: json!("diagonal"),
        }]
    );
}

#[test]
fn a_tab_panel_is_labelled_by_its_tab_and_not_reported_while_hidden() {
    // What Base Tabs' content says about itself.
    let panel = |hidden: bool| {
        snapshot(json!({
            "semanticObjectId": "panel",
            "id": "pui-tabs-1-content-overview",
            "role": "tabpanel",
            "states": { "hidden": hidden },
            "actions": {},
            "relations": { "labelledBy": "pui-tabs-1-trigger-overview" },
        }))
    };
    let (projection, issues) = project(&panel(false));
    let projection = projection.expect("a shown panel is reported");
    assert_eq!(projection.role, Role::TabPanel);
    assert_eq!(
        projection.labelled_by,
        Some(A11yReference::Id("pui-tabs-1-trigger-overview".into()))
    );
    assert!(issues.is_empty(), "{issues:?}");

    assert_eq!(project(&panel(true)), (None, Vec::new()));
}

#[test]
fn a_part_with_no_semantics_is_not_reported_and_is_not_an_issue() {
    // Base Switch's thumb is presentational: its snapshot carries nothing.
    let (projection, issues) = project(&recorded("base-switch-session.json", "thumb"));
    assert_eq!(projection, None);
    assert!(issues.is_empty(), "{issues:?}");
}

#[test]
fn facts_without_a_role_are_not_reported_and_say_why() {
    let (projection, issues) = project(&snapshot(json!({
        "semanticObjectId": "object",
        "states": { "disabled": true },
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
