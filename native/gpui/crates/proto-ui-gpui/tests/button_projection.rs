//! Renders the Base Button projection the real GPUI peer produced.
//!
//! `native/gpui/fixtures/base-button-session.json` is every message
//! `createPeerSession` sent for `@proto.ui/prototypes-base/button`, recorded by
//! `scripts/gpui/generate-button-session-fixture.mts`. These cases install that
//! recorded transaction in the host model, build its surfaces, render them in a
//! GPUI window and click them, so every step runs on what the peer actually
//! sends rather than on what a hand-written example says it sends.

use std::cell::RefCell;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::rc::Rc;

use gpui::{
    point, px, size, AnyWindowHandle, Modifiers, StyleRefinement, TestAppContext, VisualTestContext,
};
use proto_ui_gpui::host::{InputBridge, ProtoHostView, SurfaceChild};
use proto_ui_gpui::input::SessionRoute;
use proto_ui_gpui::style::StyleIssue;
use proto_ui_gpui::template::{build, parse, BuildContext, BuildIssue, TemplateNode};
use proto_ui_host_protocol::messages::PeerToHostMessage;
use proto_ui_host_protocol::model::{DeliveryResult, HostSessionModel, InstallOptions};
use proto_ui_host_protocol::wire::{ProjectionAckStatus, ProjectionTransaction};
use serde_json::{json, Value};

fn session_messages(name: &str) -> Vec<PeerToHostMessage> {
    let path =
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/base-button-session.json");
    let fixture: Value =
        serde_json::from_str(&fs::read_to_string(path).expect("the fixture reads"))
            .expect("the fixture parses");
    fixture["sessions"][name]
        .as_array()
        .expect("a recorded session")
        .iter()
        .map(|message| {
            serde_json::from_value(message.clone())
                .unwrap_or_else(|error| panic!("{} does not parse: {error}", message["kind"]))
        })
        .collect()
}

fn transaction(messages: &[PeerToHostMessage]) -> ProjectionTransaction {
    messages
        .iter()
        .find_map(|message| match message {
            PeerToHostMessage::ProjectionInstall(install) => Some(install.transaction.clone()),
            _ => None,
        })
        .expect("the peer installed a projection")
}

fn activation(messages: &[PeerToHostMessage]) -> (u64, u64) {
    messages
        .iter()
        .find_map(|message| match message {
            PeerToHostMessage::ProjectionActivate(activate) => {
                Some((activate.view_epoch, activate.commit_id))
            }
            _ => None,
        })
        .expect("the peer activated its projection")
}

#[test]
fn the_recorded_button_template_is_one_default_slot() {
    // Base Button is the unstyled primitive: its whole template is the place
    // the host's label goes.
    for name in ["enabled", "disabled"] {
        let template = parse(&transaction(&session_messages(name)).template)
            .expect("the recorded template parses");
        assert_eq!(
            template.children,
            vec![TemplateNode::Slot("slot-default".into())],
            "{name}"
        );
    }
}

#[test]
fn the_recorded_snapshot_carries_its_accessibility_actions() {
    // The field the Rust wire type used to drop. A real Base Button projection
    // depends on it: its activation is only reachable through `activate`.
    let snapshot = transaction(&session_messages("enabled"))
        .a11y
        .expect("the projection carries a snapshot");
    assert_eq!(snapshot.role.as_deref(), Some("button"));
    let activate = snapshot
        .actions
        .get("activate")
        .expect("an activate action");
    assert_eq!(activate.event.as_deref(), Some("click"));

    let disabled = transaction(&session_messages("disabled"))
        .a11y
        .expect("the projection carries a snapshot");
    assert_eq!(disabled.states.get("disabled"), Some(&json!(true)));
}

#[gpui::test]
fn a_real_click_reaches_the_lease_the_peer_registered_and_the_model_accepts_it(
    cx: &mut TestAppContext,
) {
    let messages = session_messages("enabled");
    let transaction = transaction(&messages);
    let session_id = transaction.session_id.clone();
    let root_id = format!("{session_id}/proto-surface");

    // The host half of the recorded exchange: install, then activate exactly
    // the commit the peer asked for.
    let mut model = HostSessionModel::new(session_id.clone());
    let ack = model.install_projection(&transaction, &InstallOptions::default());
    assert_eq!(ack.status, ProjectionAckStatus::Applied);
    let (view_epoch, commit_id) = activation(&messages);
    model.activate(view_epoch, commit_id);
    let route = SessionRoute::from_snapshot(&model.snapshot(), root_id.clone())
        .expect("an active session routes");

    // The peer's own press.commit lease, read from what it registered.
    let commit_lease: Vec<String> = transaction
        .events
        .registrations
        .iter()
        .filter(|registration| registration.kind.as_deref() == Some("press.commit"))
        .filter_map(|registration| registration.lease_id.clone())
        .collect();
    assert_eq!(
        commit_lease.len(),
        1,
        "Base Button registers one commit lease"
    );

    let bridge = Rc::new(RefCell::new(InputBridge::new()));
    bridge.borrow_mut().upsert_session(route);

    let template = parse(&transaction.template).expect("the template parses");
    let slots = HashMap::from([(
        "slot-default".to_string(),
        vec![SurfaceChild::Text("Save".into())],
    )]);
    let focus = cx.update(|cx| cx.focus_handle());
    let (root, issues) = build(
        &template,
        BuildContext {
            session_id: &session_id,
            root_id: &root_id,
            root_style: StyleRefinement::default(),
            focus: Some(focus),
            theme: None,
            slots: &slots,
        },
    );
    assert!(issues.is_empty(), "{issues:?}");

    let view_bridge = bridge.clone();
    let window = cx.open_window(size(px(300.), px(100.)), move |window, cx| {
        let view = ProtoHostView::new(view_bridge, vec![root], window, cx);
        window.focus(view.focus_handle(), cx);
        view
    });
    let mut cx = VisualTestContext::from_window(AnyWindowHandle::from(window), cx);
    cx.update(|window, cx| window.draw(cx).clear(cx));

    // The root holds only the label, so it is exactly as large as the text
    // lays out; a click inside it lands on the Button.
    let inside = point(px(5.), px(5.));
    cx.simulate_mouse_down(inside, gpui::MouseButton::Left, Modifiers::default());
    cx.simulate_mouse_up(inside, gpui::MouseButton::Left, Modifiers::default());

    let routed = bridge.borrow_mut().drain();
    let commit = routed
        .iter()
        .find(|routed| routed.sample.kind == "press.commit")
        .expect("the click commits the Button");
    assert_eq!(commit.session_id, session_id);
    assert_eq!(commit.sample.lease_ids, commit_lease);

    // Base Button registers `pointer.down` on its root twice, from two
    // modules. Both leases ride the one sample, in registration order,
    // neither deduplicated (`HC-EVENT-BINDING-0001-A`).
    let pointer_down = routed
        .iter()
        .find(|routed| routed.sample.kind == "pointer.down")
        .expect("the press reports pointer.down");
    let registered_down: Vec<String> = transaction
        .events
        .registrations
        .iter()
        .filter(|registration| {
            registration.kind.as_deref() == Some("pointer.down")
                && registration.scope.as_deref() == Some("root")
        })
        .filter_map(|registration| registration.lease_id.clone())
        .collect();
    assert_eq!(registered_down.len(), 2);
    assert_eq!(pointer_down.sample.lease_ids, registered_down);

    // And the model that will receive them agrees.
    for routed in &routed {
        match model.deliver(&routed.sample) {
            DeliveryResult::Delivered { lease_ids } => {
                assert_eq!(lease_ids, routed.sample.lease_ids)
            }
            other => panic!("the model rejected {}: {other:?}", routed.sample.kind),
        }
    }
}

#[test]
fn an_element_takes_its_style_from_its_tokens() {
    let template = parse(&json!({
        "kind": "root",
        "children": [{
            "kind": "element",
            "type": "span",
            // Positioned: this host cannot express CSS's static default.
            "style": { "kind": "tw", "tokens": ["relative", "h-9", "px-4"] },
            "children": [{ "kind": "text", "value": "x" }]
        }]
    }))
    .expect("the template parses");
    let (root, issues) = build(&template, context(&HashMap::new()));
    assert!(issues.is_empty(), "{issues:?}");

    let element = root.child_surfaces().next().expect("one element surface");
    assert_eq!(element.id, "s/proto-surface/0");
    assert_eq!(
        element.session, "s",
        "a template's elements belong to its instance"
    );
    assert_eq!(
        element.style.size.height,
        Some(gpui::Length::Definite(gpui::DefiniteLength::Absolute(
            gpui::AbsoluteLength::Pixels(px(36.))
        )))
    );
}

#[test]
fn an_unknown_token_and_an_svg_are_reported_rather_than_dropped() {
    let template = parse(&json!({
        "kind": "root",
        "children": [
            {
                "kind": "element",
                "type": "span",
                "style": { "kind": "tw", "tokens": ["h-9", "no-such-token"] },
                "children": []
            },
            { "kind": "svg", "tag": "svg", "props": {}, "children": [] }
        ]
    }))
    .expect("the template parses");
    let (_, issues) = build(&template, context(&HashMap::new()));
    assert!(issues.contains(&BuildIssue::Style {
        surface: "s/proto-surface/0".into(),
        issue: StyleIssue::UnknownToken("no-such-token".into()),
    }));
    assert!(issues.contains(&BuildIssue::SvgNotRendered {
        surface: "s/proto-surface/1".into(),
        tag: "svg".into(),
    }));
}

#[test]
fn a_token_that_needs_a_theme_is_reported_without_one() {
    // `bg-background` references a design-language variable. The Base family
    // has no design language, so the host reports it instead of guessing.
    let template = parse(&json!({
        "kind": "root",
        "children": [{
            "kind": "element",
            "type": "span",
            "style": { "kind": "tw", "tokens": ["bg-background"] },
            "children": []
        }]
    }))
    .expect("the template parses");
    let (_, issues) = build(&template, context(&HashMap::new()));
    assert!(
        issues.iter().any(|issue| matches!(
            issue,
            BuildIssue::Style {
                issue: StyleIssue::UnresolvedVariable { property, .. },
                ..
            } if property == "background-color"
        )),
        "{issues:?}"
    );
}

#[test]
fn a_malformed_template_names_where_it_broke() {
    let unknown = parse(&json!({
        "kind": "root",
        "children": [{ "kind": "element", "type": "div", "children": [{ "kind": "mystery" }] }]
    }))
    .expect_err("an unknown kind does not parse");
    assert_eq!(unknown.path, "template.children[0].children[0]");
    assert_eq!(unknown.problem, "unknown node kind `mystery`");

    let missing = parse(&json!({ "kind": "root", "children": [{ "kind": "slot" }] }))
        .expect_err("a slot without a reference does not parse");
    assert_eq!(missing.path, "template.children[0]");
    assert_eq!(missing.problem, "missing `ref`");

    let not_root = parse(&json!({ "kind": "element", "type": "div", "children": [] }))
        .expect_err("a template must start at its root");
    assert_eq!(not_root.problem, "expected `root`, found `element`");
}

#[test]
fn an_unfilled_slot_is_empty_and_not_an_issue() {
    let template =
        parse(&json!({ "kind": "root", "children": [{ "kind": "slot", "ref": "slot-default" }] }))
            .expect("the template parses");
    let (root, issues) = build(&template, context(&HashMap::new()));
    assert!(root.children.is_empty());
    assert!(issues.is_empty());
}

fn context(slots: &HashMap<String, Vec<SurfaceChild>>) -> BuildContext<'_> {
    BuildContext {
        session_id: "s",
        root_id: "s/proto-surface",
        root_style: StyleRefinement::default(),
        focus: None,
        theme: None,
        slots,
    }
}
