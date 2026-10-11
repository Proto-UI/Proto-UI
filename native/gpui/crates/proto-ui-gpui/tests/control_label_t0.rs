//! Real Label + Checkbox/Switch Runtime owners over T0, in a GPUI window.
//! These are not a substitute for the separate macOS accessibility/pixel tests.
mod t0;

use gpui::prelude::*;
use gpui::{div, px, Modifiers, MouseButton, StyleRefinement, TestAppContext};
use proto_ui_gpui::control_label::ControlLabelRef;
use proto_ui_host_protocol::messages::{HostToPeerMessage, PeerToHostMessage, WireRecord};
use serde_json::{json, Value};
use t0::{Fixture, Session};

const LABEL: &str = "native-label";
const TARGET: &str = "native-control";
const CAPTION: (f32, f32) = (8., 8.);

fn props(value: Value) -> WireRecord {
    value.as_object().cloned().expect("props record")
}

fn positioned(left: f32) -> StyleRefinement {
    let mut element = div()
        .absolute()
        .left(px(left))
        .top(px(0.))
        .w(px(120.))
        .h(px(30.));
    element.style().clone()
}

fn fixture(cx: &mut TestAppContext, key: &'static str, target_props: Value) -> Fixture {
    let mut label = Session::labelled(
        LABEL,
        "base-label-root",
        "Receive updates",
        props(json!({ "activation": true })),
    );
    label.root_style = positioned(0.);
    let mut target = Session::labelled(TARGET, key, "", props(target_props));
    target.root_style = positioned(150.);
    let mut fixture = Fixture::start_all(cx, vec![label, target]);
    let reference = ControlLabelRef::new();
    fixture.with_view(|view| {
        view.set_control_label_association(LABEL, Some(&reference));
        view.set_control_label_association(TARGET, Some(&reference));
    });
    fixture.pump_until(|message| matches!(message, PeerToHostMessage::A11ySnapshot(snapshot)
        if snapshot.session_id == TARGET && snapshot.snapshot.as_ref().is_some_and(|snapshot| snapshot.relations.contains_key("labelledBy"))));
    fixture.settle();
    assert_eq!(
        fixture
            .with_view(|view| view.reported_a11y(TARGET))
            .and_then(|p| p.label)
            .as_deref(),
        Some("Receive updates")
    );
    fixture
}

fn changes(fixture: &Fixture) -> usize {
    fixture
        .heard
        .borrow()
        .iter()
        .filter(|signal| signal.session_id == TARGET && signal.name == "checkedChange")
        .count()
}

#[gpui::test]
#[ignore = "starts real Node peer; run with --ignored"]
fn label_names_and_activates_checkbox_once_and_focus_stays_on_control(cx: &mut TestAppContext) {
    let mut fixture = fixture(cx, "base-checkbox-root", json!({}));
    fixture.click(CAPTION);
    fixture.session_state_becomes(TARGET, "checked", json!(true));
    fixture.settle();
    assert_eq!(changes(&fixture), 1);
    assert_eq!(
        fixture.with_view(|view| view
            .exposed_states(TARGET)
            .and_then(|s| s.get("focused"))
            .cloned()),
        Some(json!(true))
    );
    assert!(fixture.sent.iter().any(|message| matches!(message, HostToPeerMessage::ControlLabelActivate(action) if action.session_id == LABEL)));
}

#[gpui::test]
#[ignore = "starts real Node peer; run with --ignored"]
fn label_uses_switch_owner_and_preserves_controlled_state(cx: &mut TestAppContext) {
    let mut fixture = fixture(cx, "base-switch-root", json!({ "checked": false }));
    fixture.click(CAPTION);
    fixture.settle();
    assert_eq!(changes(&fixture), 1);
    assert_eq!(
        fixture.with_view(|view| view
            .exposed_states(TARGET)
            .and_then(|s| s.get("checked"))
            .cloned()),
        Some(json!(false))
    );
}

#[gpui::test]
#[ignore = "starts real Node peer; run with --ignored"]
fn disabled_control_keeps_its_label_and_neither_activates_nor_focuses(cx: &mut TestAppContext) {
    let mut fixture = fixture(cx, "base-checkbox-root", json!({ "disabled": true }));
    fixture.click(CAPTION);
    fixture.settle();
    assert_eq!(changes(&fixture), 0);
    assert_eq!(
        fixture.with_view(|view| view
            .exposed_states(TARGET)
            .and_then(|s| s.get("focused"))
            .cloned()),
        Some(json!(false))
    );
    assert_eq!(
        fixture
            .with_view(|view| view.reported_a11y(TARGET))
            .and_then(|p| p.label)
            .as_deref(),
        Some("Receive updates")
    );
}

#[gpui::test]
#[ignore = "starts real Node peer; run with --ignored"]
fn drag_secondary_and_modified_label_input_do_not_activate(cx: &mut TestAppContext) {
    let mut fixture = fixture(cx, "base-checkbox-root", json!({}));
    let start = Fixture::at(CAPTION);
    fixture
        .cx
        .simulate_mouse_down(start, MouseButton::Left, Modifiers::default());
    fixture.cx.simulate_mouse_move(
        Fixture::at((30., 8.)),
        Some(MouseButton::Left),
        Modifiers::default(),
    );
    fixture
        .cx
        .simulate_mouse_up(start, MouseButton::Left, Modifiers::default());
    fixture
        .cx
        .simulate_mouse_down(start, MouseButton::Right, Modifiers::default());
    fixture
        .cx
        .simulate_mouse_up(start, MouseButton::Right, Modifiers::default());
    let modified = Modifiers {
        shift: true,
        ..Modifiers::default()
    };
    fixture
        .cx
        .simulate_mouse_down(start, MouseButton::Left, modified);
    fixture
        .cx
        .simulate_mouse_up(start, MouseButton::Left, modified);
    fixture.settle();
    assert_eq!(changes(&fixture), 0);
}

#[gpui::test]
#[ignore = "starts real Node peer; run with --ignored"]
fn replacement_revokes_the_old_name_and_activation(cx: &mut TestAppContext) {
    let mut fixture = fixture(cx, "base-checkbox-root", json!({}));
    fixture.with_view(|view| view.set_control_label_association(TARGET, None));
    fixture.settle();
    fixture.click(CAPTION);
    fixture.settle();
    assert_eq!(changes(&fixture), 0);
    assert!(fixture
        .with_view(|view| view.reported_a11y(TARGET))
        .and_then(|p| p.label)
        .is_none());
}
