//! The hub, driven by the Base Button session the real peer recorded.
//!
//! Each case opens the session the way the host application would, replays
//! the peer's recorded messages, and reads back what the hub would send the
//! peer: acknowledgements, focus results and input samples. The replies are
//! checked against the leases and surfaces the peer actually declared.

use std::cell::RefCell;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::rc::Rc;

use gpui::prelude::*;
use gpui::{
    div, point, px, size, AnyWindowHandle, Modifiers, MouseButton, StyleRefinement, TestAppContext,
    VisualTestContext, WindowHandle,
};
use proto_ui_gpui::a11y::A11yIssue;
use proto_ui_gpui::host::{FocusResultStatus, InputBridge, ProtoHostView, SurfaceChild};
use proto_ui_gpui::hub::{ExposedSignal, HubNote, SessionConfig};
use proto_ui_host_protocol::messages::{HostToPeerMessage, PeerToHostMessage, WireRecord};
use proto_ui_host_protocol::wire::{ProjectionAckStatus, ProjectionTransaction};
use serde_json::{json, Value};

const SESSION: &str = "button-enabled";

fn recorded() -> Vec<PeerToHostMessage> {
    let path =
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/base-button-session.json");
    let fixture: Value =
        serde_json::from_str(&fs::read_to_string(path).expect("the fixture reads"))
            .expect("the fixture parses");
    fixture["sessions"]["enabled"]
        .as_array()
        .expect("a recorded session")
        .iter()
        .map(|message| serde_json::from_value(message.clone()).expect("a peer message"))
        .collect()
}

fn recorded_transaction() -> ProjectionTransaction {
    recorded()
        .into_iter()
        .find_map(|message| match message {
            PeerToHostMessage::ProjectionInstall(install) => Some(install.transaction),
            _ => None,
        })
        .expect("the peer installed a projection")
}

/// The lease ids the peer registered for one event type and scope.
fn leases(kind: &str, scope: &str) -> Vec<String> {
    recorded_transaction()
        .events
        .registrations
        .into_iter()
        .filter(|registration| {
            registration.kind.as_deref() == Some(kind)
                && registration.scope.as_deref() == Some(scope)
        })
        .filter_map(|registration| registration.lease_id)
        .collect()
}

fn peer(message: Value) -> PeerToHostMessage {
    serde_json::from_value(message).expect("a valid peer message")
}

struct Hub {
    window: WindowHandle<ProtoHostView>,
    cx: VisualTestContext,
}

impl Hub {
    fn open(cx: &mut TestAppContext) -> Self {
        Self::open_with_root_style(cx, StyleRefinement::default())
    }

    /// Opens the session with the application's own style for its root.
    fn open_with_root_style(cx: &mut TestAppContext, root_style: StyleRefinement) -> Self {
        let bridge = Rc::new(RefCell::new(InputBridge::new()));
        let window = cx.open_window(size(px(300.), px(100.)), move |window, cx| {
            let mut view = ProtoHostView::new(bridge, Vec::new(), window, cx);
            window.focus(view.focus_handle(), cx);
            view.open_session(
                SESSION,
                SessionConfig {
                    instance_id: format!("{SESSION}:instance"),
                    prototype_key: "base-button".into(),
                    props: WireRecord::new(),
                    slots: HashMap::from([(
                        "slot-default".to_string(),
                        vec![SurfaceChild::Text("Save".into())],
                    )]),
                    root_style,
                    theme: None,
                    parent: None,
                },
                cx,
            );
            view
        });
        // Focus facts only flow in an active window, as in a browser.
        window
            .update(cx, |_, window, _| window.activate_window())
            .expect("the window activates");
        cx.run_until_parked();
        let mut hub = Self {
            window,
            cx: VisualTestContext::from_window(AnyWindowHandle::from(window), cx),
        };
        hub.draw();
        hub
    }

    fn draw(&mut self) {
        self.cx.update(|window, cx| window.draw(cx).clear(cx));
    }

    fn receive(&mut self, messages: impl IntoIterator<Item = PeerToHostMessage>) {
        for message in messages {
            self.window
                .update(&mut self.cx, |view, window, cx| {
                    view.receive(message, window, cx)
                })
                .expect("the view receives");
        }
        self.draw();
    }

    fn outbox(&mut self) -> Vec<HostToPeerMessage> {
        self.window
            .update(&mut self.cx, |view, _, _| view.take_outbox())
            .expect("the view drains")
    }

    fn notes(&mut self) -> Vec<HubNote> {
        self.window
            .update(&mut self.cx, |view, _, _| view.take_notes())
            .expect("the view drains")
    }

    /// Subscribes the way a host application would, collecting every signal
    /// the view emits from now on.
    fn listen(&mut self) -> Rc<RefCell<Vec<ExposedSignal>>> {
        let heard = Rc::new(RefCell::new(Vec::new()));
        let view = self.window.entity(&self.cx).expect("the view");
        let sink = heard.clone();
        self.cx.update(|_, cx| {
            cx.subscribe(&view, move |_, signal: &ExposedSignal, _| {
                sink.borrow_mut().push(signal.clone())
            })
            .detach();
        });
        heard
    }

    fn click(&mut self) {
        let inside = point(px(5.), px(5.));
        self.cx
            .simulate_mouse_down(inside, MouseButton::Left, Modifiers::default());
        self.cx
            .simulate_mouse_up(inside, MouseButton::Left, Modifiers::default());
    }
}

/// `(type, leases)` for every input sample in an outbox.
fn samples(outbox: &[HostToPeerMessage]) -> Vec<(String, Vec<String>)> {
    outbox
        .iter()
        .filter_map(|message| match message {
            HostToPeerMessage::InputSample(input) => {
                assert_eq!(input.session_id, SESSION);
                Some((input.sample.kind.clone(), input.sample.lease_ids.clone()))
            }
            _ => None,
        })
        .collect()
}

#[gpui::test]
fn opening_a_session_asks_the_peer_to_run_the_prototype(cx: &mut TestAppContext) {
    let mut hub = Hub::open(cx);
    let outbox = hub.outbox();
    assert_eq!(outbox.len(), 1);
    match &outbox[0] {
        HostToPeerMessage::SessionOpen(open) => {
            assert_eq!(open.session_id, SESSION);
            assert_eq!(open.instance_id, format!("{SESSION}:instance"));
            assert_eq!(open.prototype_key, "base-button");
        }
        other => panic!("expected session.open, got {}", other.kind()),
    }
}

#[gpui::test]
fn the_recorded_install_is_acknowledged_with_the_surfaces_it_needs(cx: &mut TestAppContext) {
    let mut hub = Hub::open(cx);
    hub.outbox();
    hub.receive(recorded());

    let acks: Vec<_> = hub
        .outbox()
        .into_iter()
        .filter_map(|message| match message {
            HostToPeerMessage::ProjectionAck(ack) => Some(ack.ack),
            _ => None,
        })
        .collect();
    assert_eq!(acks.len(), 1);
    assert_eq!(acks[0].status, ProjectionAckStatus::Applied);
    // `proto-surface` is what the peer waits for before it treats its focus
    // target as ready; the slot follows it.
    assert_eq!(acks[0].ready_surfaces, ["proto-surface", "slot-default"]);
    assert!(hub.notes().is_empty());
}

#[gpui::test]
fn after_activation_a_click_reaches_the_peer_as_samples_the_model_accepted(
    cx: &mut TestAppContext,
) {
    let mut hub = Hub::open(cx);
    hub.receive(recorded());
    hub.outbox();

    hub.click();
    let samples = samples(&hub.outbox());
    assert!(samples.contains(&("press.commit".into(), leases("press.commit", "root"))));
    assert!(samples.contains(&("pointer.down".into(), leases("pointer.down", "root"))));
    assert_eq!(
        leases("pointer.down", "root").len(),
        2,
        "two modules, two leases"
    );
}

#[gpui::test]
fn a_focus_request_is_applied_and_its_fact_follows_as_a_sample(cx: &mut TestAppContext) {
    let mut hub = Hub::open(cx);
    hub.receive(recorded());
    hub.outbox();

    hub.receive([peer(json!({
        "kind": "focus.request",
        "sessionId": SESSION,
        "requestId": format!("{SESSION}:focus:1"),
        "target": "focus-root",
        "action": "focus",
        "options": {}
    }))]);
    let outbox = hub.outbox();
    let result = outbox
        .iter()
        .find_map(|message| match message {
            HostToPeerMessage::FocusResult(result) => Some(result),
            _ => None,
        })
        .expect("a focus.result");
    assert_eq!(result.request_id, format!("{SESSION}:focus:1"));
    assert_eq!(result.status, FocusResultStatus::Applied);
    // The fact arrives on the lease the peer's Focus module registered.
    assert!(samples(&outbox).contains(&("host:focus".into(), leases("host:focus", "root"))));
}

#[gpui::test]
fn an_install_for_a_session_the_host_never_opened_is_refused(cx: &mut TestAppContext) {
    let mut hub = Hub::open(cx);
    hub.outbox();
    let mut transaction = recorded_transaction();
    transaction.session_id = "ghost".into();
    hub.receive([peer(
        json!({ "kind": "projection.install", "transaction": transaction }),
    )]);

    let ack = hub
        .outbox()
        .into_iter()
        .find_map(|message| match message {
            HostToPeerMessage::ProjectionAck(ack) => Some(ack.ack),
            _ => None,
        })
        .expect("an acknowledgement");
    assert_eq!(ack.status, ProjectionAckStatus::Failed);
    assert_eq!(ack.diagnostics[0].code, "unknown-session");
    assert!(hub.notes().contains(&HubNote::UnknownSession {
        session_id: "ghost".into(),
        kind: "projection.install".into(),
    }));
}

#[gpui::test]
fn an_invalid_template_is_refused_before_the_model_allocates_anything(cx: &mut TestAppContext) {
    let mut hub = Hub::open(cx);
    hub.outbox();
    let mut transaction = recorded_transaction();
    transaction.template = json!({ "kind": "root", "children": [{ "kind": "mystery" }] });
    let (view_epoch, commit_id) = (transaction.view_epoch, transaction.commit_id);
    hub.receive([
        peer(json!({ "kind": "projection.install", "transaction": transaction })),
        // The peer would not activate a refused commit; if it did, nothing
        // may have been installed for it to activate.
        peer(json!({
            "kind": "projection.activate",
            "sessionId": SESSION,
            "viewEpoch": view_epoch,
            "commitId": commit_id
        })),
    ]);

    let ack = hub
        .outbox()
        .into_iter()
        .find_map(|message| match message {
            HostToPeerMessage::ProjectionAck(ack) => Some(ack.ack),
            _ => None,
        })
        .expect("an acknowledgement");
    assert_eq!(ack.status, ProjectionAckStatus::Failed);
    assert_eq!(ack.diagnostics[0].code, "template-invalid");
    assert_eq!(
        ack.diagnostics[0].data,
        Some(json!({ "path": "template.children[0]" }))
    );
    assert!(hub
        .notes()
        .iter()
        .any(|note| matches!(note, HubNote::ActivationRefused { .. })));

    hub.click();
    assert!(samples(&hub.outbox()).is_empty(), "nothing is live");
}

#[gpui::test]
fn a_released_lease_stops_reaching_the_peer(cx: &mut TestAppContext) {
    let mut hub = Hub::open(cx);
    hub.receive(recorded());
    hub.outbox();

    let commit = leases("press.commit", "root");
    hub.receive([peer(json!({
        "kind": "lease.release",
        "sessionId": SESSION,
        "leaseIds": commit
    }))]);
    hub.click();
    let samples = samples(&hub.outbox());
    assert!(!samples.iter().any(|(kind, _)| kind == "press.commit"));
    assert!(samples.iter().any(|(kind, _)| kind == "pointer.down"));
}

#[gpui::test]
fn disposal_takes_the_instance_out_of_the_window_and_out_of_input(cx: &mut TestAppContext) {
    let mut hub = Hub::open(cx);
    hub.receive(recorded());
    hub.outbox();

    hub.receive([peer(
        json!({ "kind": "session.disposed", "sessionId": SESSION }),
    )]);
    hub.click();
    assert!(samples(&hub.outbox()).is_empty());
}

#[gpui::test]
fn exposed_states_and_the_snapshot_follow_the_peer(cx: &mut TestAppContext) {
    let mut hub = Hub::open(cx);
    hub.receive(recorded());
    let (states, role) = hub
        .window
        .update(&mut hub.cx, |view, _, _| {
            (
                view.exposed_states(SESSION).cloned(),
                view.a11y_snapshot(SESSION)
                    .and_then(|snapshot| snapshot.role.clone()),
            )
        })
        .expect("the view reads");
    let states = states.expect("the session exposes states");
    assert_eq!(states.get("pressed"), Some(&json!(false)));
    assert_eq!(states.get("disabled"), Some(&json!(false)));
    assert_eq!(role.as_deref(), Some("button"));
}

#[gpui::test]
fn the_snapshot_projects_onto_the_root_and_a_later_one_replaces_it(cx: &mut TestAppContext) {
    let mut hub = Hub::open(cx);
    hub.receive(recorded());
    let projection = |hub: &mut Hub| {
        hub.window
            .update(&mut hub.cx, |view, _, _| {
                view.a11y_projection(SESSION).cloned()
            })
            .expect("the view reads")
    };
    let installed = projection(&mut hub).expect("the recorded snapshot projects");
    assert_eq!(installed.role, gpui::Role::Button);
    assert!(!installed.disabled);
    assert!(!hub
        .notes()
        .iter()
        .any(|note| matches!(note, HubNote::A11y { .. })));

    // A snapshot for the installed view replaces the projection, and a state
    // the host does not project is noted rather than dropped.
    hub.receive([peer(json!({
        "kind": "a11y.snapshot",
        "sessionId": SESSION,
        "viewEpoch": recorded_transaction().view_epoch,
        "snapshot": {
            "semanticObjectId": "button-enabled:a11y:1",
            "role": "button",
            "name": { "kind": "content" },
            "states": { "disabled": true, "busy": true },
            "actions": { "activate": { "event": "click" } },
            "relations": {},
        },
    }))]);
    assert!(projection(&mut hub).expect("still projected").disabled);
    assert!(hub.notes().contains(&HubNote::A11y {
        session_id: SESSION.into(),
        issue: A11yIssue::State {
            name: "busy".into(),
            value: json!(true),
        },
    }));
}

#[gpui::test]
fn a_signal_is_emitted_as_it_arrives_and_never_kept(cx: &mut TestAppContext) {
    let mut hub = Hub::open(cx);
    hub.receive(recorded());
    let signal = |session: &str, payload: Value| {
        peer(json!({
            "kind": "expose.signal",
            "sessionId": session,
            "name": "click",
            "payload": payload,
        }))
    };

    // Nobody is listening yet: the signal goes nowhere, and is not held back
    // for a listener that subscribes later.
    hub.receive([signal(SESSION, json!({ "detail": 1 }))]);
    let heard = hub.listen();
    assert!(heard.borrow().is_empty());

    hub.receive([
        signal(SESSION, Value::Null),
        signal(SESSION, json!({ "detail": 2 })),
        signal("ghost", Value::Null),
    ]);
    let click = |payload: Value| ExposedSignal {
        session_id: SESSION.into(),
        name: "click".into(),
        payload,
    };
    assert_eq!(
        *heard.borrow(),
        [click(Value::Null), click(json!({ "detail": 2 }))]
    );
    // A signal for a session the host never opened is noted, not emitted.
    assert!(hub.notes().contains(&HubNote::UnknownSession {
        session_id: "ghost".into(),
        kind: "expose.signal".into(),
    }));
}

#[gpui::test]
fn input_on_a_view_being_replaced_is_refused_until_the_new_one_activates(cx: &mut TestAppContext) {
    // The peer remounts: a new view epoch installs, and until the host
    // activates it the router still holds the old epoch's leases. Only the
    // model knows those samples are stale, which is why every sample passes
    // through it before it is sent.
    let mut hub = Hub::open(cx);
    hub.receive(recorded());
    hub.outbox();

    let mut remount = recorded_transaction();
    remount.view_epoch += 1;
    remount.commit_id = 1;
    // A real peer allocates fresh lease ids for a new view; the model refuses
    // a lease id it has already seen.
    for registration in &mut remount.events.registrations {
        registration.lease_id = registration
            .lease_id
            .take()
            .map(|id| format!("{id}:remount"));
    }
    let (view_epoch, commit_id) = (remount.view_epoch, remount.commit_id);
    hub.receive([peer(
        json!({ "kind": "projection.install", "transaction": remount }),
    )]);
    let ack = hub
        .outbox()
        .into_iter()
        .find_map(|message| match message {
            HostToPeerMessage::ProjectionAck(ack) => Some(ack.ack),
            _ => None,
        })
        .expect("an acknowledgement");
    assert_eq!(
        ack.status,
        ProjectionAckStatus::Applied,
        "{:?}",
        ack.diagnostics
    );

    hub.click();
    assert!(
        samples(&hub.outbox()).is_empty(),
        "the old view's input is stale"
    );
    assert!(hub.notes().iter().any(|note| matches!(
        note,
        HubNote::SampleRefused { reason, .. } if reason == "StaleEpoch"
    )));

    hub.receive([peer(json!({
        "kind": "projection.activate",
        "sessionId": SESSION,
        "viewEpoch": view_epoch,
        "commitId": commit_id
    }))]);
    hub.click();
    assert!(samples(&hub.outbox())
        .iter()
        .any(|(kind, _)| kind == "press.commit"));
}

#[gpui::test]
fn a_focus_request_for_another_target_is_rejected(cx: &mut TestAppContext) {
    let mut hub = Hub::open(cx);
    hub.receive(recorded());
    hub.outbox();
    hub.receive([peer(json!({
        "kind": "focus.request",
        "sessionId": SESSION,
        "requestId": format!("{SESSION}:focus:9"),
        "target": "somewhere-else",
        "action": "focus",
        "options": {}
    }))]);
    let status = hub
        .outbox()
        .into_iter()
        .find_map(|message| match message {
            HostToPeerMessage::FocusResult(result) => Some(result.status),
            _ => None,
        })
        .expect("a focus.result");
    assert_eq!(status, FocusResultStatus::Rejected);
}

/// A remount of the recorded projection at the next view epoch, with fresh
/// lease ids (a real peer allocates new ones) and a snapshot named `name`.
fn remount_named(name: &str) -> ProjectionTransaction {
    let mut remount = recorded_transaction();
    remount.view_epoch += 1;
    remount.commit_id = 1;
    for registration in &mut remount.events.registrations {
        registration.lease_id = registration
            .lease_id
            .take()
            .map(|id| format!("{id}:remount"));
    }
    let mut a11y = remount
        .a11y
        .take()
        .expect("the recording carries a snapshot");
    a11y.name = Some(proto_ui_host_protocol::wire::A11yNameWire::Text { value: name.into() });
    remount.a11y = Some(a11y);
    remount
}

fn snapshot_name(hub: &mut Hub) -> Option<String> {
    hub.window
        .update(&mut hub.cx, |view, _, _| {
            view.a11y_snapshot(SESSION)
                .and_then(|snapshot| match &snapshot.name {
                    Some(proto_ui_host_protocol::wire::A11yNameWire::Text { value }) => {
                        Some(value.clone())
                    }
                    _ => None,
                })
        })
        .expect("the view reads")
}

#[gpui::test]
fn a_snapshot_from_a_retired_view_does_not_overwrite_the_installed_one(cx: &mut TestAppContext) {
    let mut hub = Hub::open(cx);
    hub.receive(recorded());
    let remount = remount_named("E2");
    let (view_epoch, commit_id) = (remount.view_epoch, remount.commit_id);
    hub.receive([
        peer(json!({ "kind": "projection.install", "transaction": remount })),
        peer(json!({
            "kind": "projection.activate",
            "sessionId": SESSION,
            "viewEpoch": view_epoch,
            "commitId": commit_id
        })),
    ]);
    hub.notes();
    assert_eq!(snapshot_name(&mut hub).as_deref(), Some("E2"));

    // A late snapshot, then a late retraction, both from the retired view.
    let retired = view_epoch - 1;
    let mut stale = recorded_transaction().a11y.expect("a snapshot");
    stale.name = Some(proto_ui_host_protocol::wire::A11yNameWire::Text { value: "E1".into() });
    hub.receive([
        peer(json!({
            "kind": "a11y.snapshot",
            "sessionId": SESSION,
            "viewEpoch": retired,
            "snapshot": stale
        })),
        peer(json!({ "kind": "a11y.snapshot", "sessionId": SESSION, "viewEpoch": retired, "snapshot": null })),
    ]);
    assert_eq!(
        snapshot_name(&mut hub).as_deref(),
        Some("E2"),
        "the installed view stays authoritative"
    );
    let refused = hub
        .notes()
        .into_iter()
        .filter(|note| {
            matches!(
                note,
                HubNote::SnapshotRefused { view_epoch, installed, .. }
                    if *view_epoch == retired && *installed == Some(view_epoch_after(retired))
            )
        })
        .count();
    assert_eq!(refused, 2);

    // A snapshot for the installed view still applies.
    let mut current = recorded_transaction().a11y.expect("a snapshot");
    current.name = Some(proto_ui_host_protocol::wire::A11yNameWire::Text {
        value: "E2 again".into(),
    });
    hub.receive([peer(json!({
        "kind": "a11y.snapshot",
        "sessionId": SESSION,
        "viewEpoch": view_epoch,
        "snapshot": current
    }))]);
    assert_eq!(snapshot_name(&mut hub).as_deref(), Some("E2 again"));
}

fn view_epoch_after(epoch: u64) -> u64 {
    epoch + 1
}

/// Installs the recorded projection with `template` in place of its own and
/// returns the acknowledgement.
fn install_with_template(
    hub: &mut Hub,
    template: Value,
) -> proto_ui_host_protocol::wire::ProjectionAck {
    let mut transaction = recorded_transaction();
    transaction.template = template;
    let (view_epoch, commit_id) = (transaction.view_epoch, transaction.commit_id);
    hub.receive([
        peer(json!({ "kind": "projection.install", "transaction": transaction })),
        peer(json!({
            "kind": "projection.activate",
            "sessionId": SESSION,
            "viewEpoch": view_epoch,
            "commitId": commit_id
        })),
    ]);
    hub.outbox()
        .into_iter()
        .find_map(|message| match message {
            HostToPeerMessage::ProjectionAck(ack) => Some(ack.ack),
            _ => None,
        })
        .expect("an acknowledgement")
}

#[gpui::test]
fn a_projection_with_an_svg_the_host_cannot_draw_is_refused_not_applied(cx: &mut TestAppContext) {
    let mut hub = Hub::open(cx);
    hub.outbox();
    let ack = install_with_template(
        &mut hub,
        json!({
            "kind": "root",
            "children": [
                { "kind": "slot", "ref": "slot-default" },
                { "kind": "svg", "tag": "svg", "props": {}, "children": [] }
            ]
        }),
    );
    assert_eq!(ack.status, ProjectionAckStatus::Unsupported);
    assert!(ack.ready_surfaces.is_empty());
    assert_eq!(ack.diagnostics[0].code, "svg-not-rendered");

    // Nothing was installed for the peer to activate, and nothing is shown.
    assert!(hub
        .notes()
        .iter()
        .any(|note| matches!(note, HubNote::ActivationRefused { .. })));
    hub.click();
    assert!(samples(&hub.outbox()).is_empty());
}

#[gpui::test]
fn a_projection_with_a_style_the_host_cannot_resolve_is_refused_not_applied(
    cx: &mut TestAppContext,
) {
    // The session has no design language, so `bg-background` cannot resolve
    // its theme variable. Painting the element without it would be a guess.
    let mut hub = Hub::open(cx);
    hub.outbox();
    let ack = install_with_template(
        &mut hub,
        json!({
            "kind": "root",
            "children": [{
                "kind": "element",
                "type": "span",
                "style": { "kind": "tw", "tokens": ["bg-background"] },
                "children": [{ "kind": "slot", "ref": "slot-default" }]
            }]
        }),
    );
    assert_eq!(ack.status, ProjectionAckStatus::Unsupported);
    assert_eq!(ack.diagnostics[0].code, "style-not-rendered");
    assert_eq!(
        ack.diagnostics[0]
            .data
            .as_ref()
            .and_then(|data| data["detail"]["property"].as_str()),
        Some("background-color")
    );
    hub.click();
    assert!(samples(&hub.outbox()).is_empty());
}

/// The recording, its projection wearing `tokens` as the root's feedback style.
fn recorded_with_style(tokens: &[&str]) -> Vec<PeerToHostMessage> {
    recorded()
        .into_iter()
        .map(|message| match message {
            PeerToHostMessage::ProjectionInstall(mut install) => {
                install.transaction.style = tokens.iter().map(ToString::to_string).collect();
                PeerToHostMessage::ProjectionInstall(install)
            }
            other => other,
        })
        .collect()
}

fn style_apply(view_epoch: u64, tokens: &[&str]) -> PeerToHostMessage {
    peer(json!({
        "kind": "style.apply",
        "sessionId": SESSION,
        "viewEpoch": view_epoch,
        "tokens": tokens,
    }))
}

/// Whether a click on the Button reaches it as a commit.
fn commits_on_click(hub: &mut Hub) -> bool {
    hub.outbox();
    hub.click();
    samples(&hub.outbox())
        .iter()
        .any(|(kind, _)| kind == "press.commit")
}

#[gpui::test]
fn a_hidden_feedback_style_takes_the_instance_out_until_it_is_cleared(cx: &mut TestAppContext) {
    // The style arrives with the projection: the first frame is hidden.
    let mut hub = Hub::open(cx);
    hub.receive(recorded_with_style(&["hidden"]));
    assert!(!commits_on_click(&mut hub));

    // The Prototype clears it outside a commit; the view shows again.
    hub.receive([style_apply(recorded_transaction().view_epoch, &[])]);
    assert!(commits_on_click(&mut hub));
}

#[gpui::test]
fn the_applications_root_style_wins_over_the_feedback_style(cx: &mut TestAppContext) {
    // The consumer's style is layered over the Prototype's, as the Web's
    // `@layer proto-ui` puts the Prototype under every consumer rule.
    let mut shown = div().block();
    let mut hub = Hub::open_with_root_style(cx, shown.style().clone());
    hub.receive(recorded_with_style(&["hidden"]));
    assert!(commits_on_click(&mut hub));
}

#[gpui::test]
fn a_feedback_style_for_another_view_is_refused(cx: &mut TestAppContext) {
    let mut hub = Hub::open(cx);
    hub.receive(recorded_with_style(&["hidden"]));
    hub.notes();
    let installed = recorded_transaction().view_epoch;
    hub.receive([style_apply(installed + 1, &[])]);

    assert!(hub.notes().contains(&HubNote::StyleRefused {
        session_id: SESSION.into(),
        view_epoch: installed + 1,
        installed: Some(installed),
    }));
    assert!(
        !commits_on_click(&mut hub),
        "the installed view keeps its style"
    );
}

#[gpui::test]
fn a_feedback_style_the_host_cannot_render_leaves_the_last_one_in_place(cx: &mut TestAppContext) {
    let mut hub = Hub::open(cx);
    hub.receive(recorded_with_style(&["hidden"]));
    hub.notes();
    hub.receive([style_apply(
        recorded_transaction().view_epoch,
        &["not-a-proto-token"],
    )]);

    // There is no acknowledgement to refuse it with: the host notes why, and
    // the view keeps the last style it could show whole.
    assert!(hub
        .notes()
        .iter()
        .any(|note| matches!(note, HubNote::Build { session_id, .. } if session_id == SESSION)));
    assert!(!commits_on_click(&mut hub));
}

#[gpui::test]
fn a_projection_whose_feedback_style_the_host_cannot_render_is_refused(cx: &mut TestAppContext) {
    let mut hub = Hub::open(cx);
    hub.outbox();
    hub.receive(recorded_with_style(&["not-a-proto-token"]));
    let ack = hub
        .outbox()
        .into_iter()
        .find_map(|message| match message {
            HostToPeerMessage::ProjectionAck(ack) => Some(ack.ack),
            _ => None,
        })
        .expect("an acknowledgement");
    assert_eq!(ack.status, ProjectionAckStatus::Unsupported);
    assert_eq!(ack.diagnostics[0].code, "style-not-rendered");
    assert_eq!(
        ack.diagnostics[0]
            .data
            .as_ref()
            .and_then(|data| data["surface"].as_str()),
        Some(format!("{SESSION}/proto-surface").as_str())
    );
}
