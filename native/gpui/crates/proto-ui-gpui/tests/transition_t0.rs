//! Base Transition over topology T0: the view a transition asks for, keeps
//! and lets go, as the host sees it.
//!
//! Entering commits a view before the phase starts; leaving keeps the view
//! until the phase has ended and only then lets it go; the instance outlives
//! its view, so its controls bring one back in a new epoch
//! (P-BASE-TRANSITION-ENTER-SEQUENCING, P-BASE-TRANSITION-LEAVE-SEQUENCING).
//!
//! Ignored by default because it starts Node and needs the repository's
//! `node_modules` (`pnpm install`). The `rust-interop` CI job installs both
//! and runs them explicitly:
//!
//!   cargo test -p proto-ui-gpui --test transition_t0 -- --ignored

mod t0;

use gpui::{StyleRefinement, TestAppContext};
use proto_ui_gpui::host::SurfaceChild;
use proto_ui_host_protocol::messages::{PeerToHostMessage, WireRecord};
use serde_json::{json, Value};
use t0::{Fixture, Session};

const TRANSITION: &str = "t0-transition";

fn props(value: Value) -> WireRecord {
    value.as_object().cloned().expect("props are an object")
}

fn transition(props_: Value) -> Session {
    Session {
        id: TRANSITION,
        prototype_key: "base-transition",
        props: props(props_),
        content: vec![SurfaceChild::Text("Panel".into())],
        parent: None,
        root_style: StyleRefinement::default(),
    }
}

fn signal(message: &PeerToHostMessage, name: &str) -> bool {
    matches!(message, PeerToHostMessage::ExposeSignal(signal) if signal.name == name)
}

fn state(message: &PeerToHostMessage, value: &str) -> bool {
    matches!(message, PeerToHostMessage::ExposeState(state)
        if state.name == "transitionState" && state.value == json!(value))
}

/// What the host saw of the transition, in order: a view epoch's first
/// commit, a detached view, each signal and each phase.
fn phases(seen: &[PeerToHostMessage]) -> Vec<String> {
    seen.iter()
        .filter_map(|message| match message {
            PeerToHostMessage::ProjectionInstall(install) if install.transaction.commit_id == 1 => {
                Some(format!("view {}", install.transaction.view_epoch))
            }
            PeerToHostMessage::ProjectionDetach(detach) => {
                Some(format!("detach {}", detach.view_epoch))
            }
            PeerToHostMessage::ExposeSignal(signal) => Some(signal.name.clone()),
            PeerToHostMessage::ExposeState(state) if state.name == "transitionState" => {
                state.value.as_str().map(str::to_string)
            }
            _ => None,
        })
        .collect()
}

fn rendered(fixture: &mut Fixture) -> Vec<String> {
    fixture.with_view(|view| view.rendered_sessions())
}

#[gpui::test]
#[ignore = "starts the Node peer; needs `pnpm install`, run with --ignored"]
fn entering_commits_a_view_first_and_leaving_keeps_it_until_the_phase_ends(
    cx: &mut TestAppContext,
) {
    let mut fixture = Fixture::start_viewed(cx, vec![transition(json!({ "open": false }))], &[]);
    fixture.settle();
    // Closed from creation: nothing was ever rendered.
    assert!(rendered(&mut fixture).is_empty());

    fixture.with_view(|view| view.set_props(TRANSITION, props(json!({ "open": true }))));
    let seen = fixture.pump_until(|message| signal(message, "afterEnter"));
    assert_eq!(
        phases(&seen),
        ["view 1", "beforeEnter", "entering", "entered", "afterEnter"]
    );
    fixture.settle();
    assert_eq!(rendered(&mut fixture), [TRANSITION]);

    fixture.with_view(|view| view.set_props(TRANSITION, props(json!({ "open": false }))));
    let mut seen = fixture.pump_until(|message| state(message, "leaving"));
    assert_eq!(rendered(&mut fixture), [TRANSITION], "kept while leaving");
    seen.extend(
        fixture.pump_until(|message| matches!(message, PeerToHostMessage::ProjectionDetach(_))),
    );
    assert_eq!(
        phases(&seen),
        ["beforeLeave", "leaving", "closed", "afterLeave", "detach 1"]
    );
    fixture.settle();
    assert!(rendered(&mut fixture).is_empty());
}

#[gpui::test]
#[ignore = "starts the Node peer; needs `pnpm install`, run with --ignored"]
fn appearing_enters_once_its_first_view_is_committed(cx: &mut TestAppContext) {
    // Waits for no activation, so every message from creation on is seen.
    let mut fixture = Fixture::start_viewed(
        cx,
        vec![transition(json!({ "open": true, "appear": true }))],
        &[],
    );
    let seen = fixture.pump_until(|message| signal(message, "afterEnter"));
    assert_eq!(
        phases(&seen),
        ["view 1", "beforeEnter", "entering", "entered", "afterEnter"]
    );
}

#[gpui::test]
#[ignore = "starts the Node peer; needs `pnpm install`, run with --ignored"]
fn a_leave_reversed_before_it_ends_keeps_the_view(cx: &mut TestAppContext) {
    // Open from creation without `appear`: entered at once. A long leave, so
    // the reversal lands inside it.
    let open = |open: bool| props(json!({ "open": open, "leaveDuration": 10000 }));
    let mut fixture = Fixture::start(
        cx,
        transition(json!({ "open": true, "leaveDuration": 10000 })),
    );

    fixture.with_view(|view| view.set_props(TRANSITION, open(false)));
    let mut seen = fixture.pump_until(|message| state(message, "leaving"));
    fixture.with_view(|view| view.set_props(TRANSITION, open(true)));
    seen.extend(fixture.pump_until(|message| signal(message, "afterEnter")));
    assert_eq!(
        phases(&seen),
        [
            "beforeLeave",
            "leaving",
            "beforeEnter",
            "entering",
            "entered",
            "afterEnter"
        ]
    );
    fixture.settle();
    assert_eq!(rendered(&mut fixture), [TRANSITION]);
}

#[gpui::test]
#[ignore = "starts the Node peer; needs `pnpm install`, run with --ignored"]
fn its_controls_outlive_its_view_and_the_host_may_end_a_phase(cx: &mut TestAppContext) {
    // Uncontrolled, and an enter the fallback would take ten seconds to end.
    let mut fixture = Fixture::start(
        cx,
        transition(json!({ "defaultOpen": true, "enterDuration": 10000 })),
    );

    fixture.with_view(|view| view.call_exposed(TRANSITION, "leave", Vec::new()));
    let seen =
        fixture.pump_until(|message| matches!(message, PeerToHostMessage::ProjectionDetach(_)));
    assert_eq!(
        phases(&seen),
        ["beforeLeave", "leaving", "closed", "afterLeave", "detach 1"]
    );
    fixture.settle();
    assert!(rendered(&mut fixture).is_empty());

    // The view came back in a new epoch; the host ends the enter itself.
    fixture.with_view(|view| view.call_exposed(TRANSITION, "enter", Vec::new()));
    let mut seen = fixture.pump_until(|message| state(message, "entering"));
    fixture.with_view(|view| view.call_exposed(TRANSITION, "complete", Vec::new()));
    seen.extend(fixture.pump_until(|message| signal(message, "afterEnter")));
    assert_eq!(
        phases(&seen),
        ["view 2", "beforeEnter", "entering", "entered", "afterEnter"]
    );
    fixture.settle();
    assert_eq!(rendered(&mut fixture), [TRANSITION]);
}
