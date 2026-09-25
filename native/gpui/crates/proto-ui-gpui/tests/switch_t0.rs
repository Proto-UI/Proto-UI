//! Base Switch over topology T0: a root and the thumb that opens inside it,
//! both run by the real peer, rendered by one GPUI host.
//!
//! The host places the thumb in the root's slot and opens it inside the root.
//! The peer links them: the thumb subscribes to the root's context, and the
//! root reports itself a trigger. The evidence is what both instances report
//! back: the root's `checked` state and `checkedChange` event, and the
//! thumb's `checked` state, which it only learns through context. When the
//! root ends, the thumb ends first.
//!
//! Ignored by default because it starts Node and needs the repository's
//! `node_modules` (`pnpm install`). The `rust-interop` CI job installs both
//! and runs them explicitly:
//!
//!   cargo test -p proto-ui-gpui --test switch_t0 -- --ignored

mod t0;

use gpui::prelude::*;
use gpui::{div, px, Modifiers, MouseButton, StyleRefinement, TestAppContext};
use proto_ui_gpui::host::SurfaceChild;
use proto_ui_gpui::hub::ExposedSignal;
use proto_ui_host_protocol::messages::{HostToPeerMessage, PeerToHostMessage, WireRecord};
use serde_json::{json, Value};
use t0::{Fixture, Session};

const ROOT: &str = "t0-switch";
const THUMB: &str = "t0-switch-thumb";
/// Inside the thumb, which sits at the root's top left.
const ON_THUMB: (f32, f32) = (5., 5.);

fn props(value: Value) -> WireRecord {
    value.as_object().cloned().expect("props are an object")
}

fn sized(width: f32, height: f32) -> StyleRefinement {
    let mut element = div().w(px(width)).h(px(height));
    element.style().clone()
}

/// A root with its thumb in the default slot, and the thumb opened inside it.
fn switch(root_props: Value) -> Vec<Session> {
    vec![
        Session {
            id: ROOT,
            prototype_key: "base-switch-root",
            props: props(root_props),
            content: vec![SurfaceChild::Session(THUMB.into())],
            parent: None,
            root_style: sized(60., 30.),
        },
        Session {
            id: THUMB,
            prototype_key: "base-switch-thumb",
            props: WireRecord::new(),
            content: Vec::new(),
            parent: Some(ROOT),
            root_style: sized(20., 20.),
        },
    ]
}

fn exposed(fixture: &mut Fixture, session: &str, name: &str) -> Option<Value> {
    fixture.with_view(|view| view.exposed_states(session)?.get(name).cloned())
}

fn checked_change(checked: bool) -> ExposedSignal {
    ExposedSignal {
        session_id: ROOT.into(),
        name: "checkedChange".into(),
        payload: json!({ "checked": checked }),
    }
}

#[gpui::test]
#[ignore = "starts the Node peer; needs `pnpm install`, run with --ignored"]
fn a_click_on_the_thumb_flips_the_switch_and_the_thumb_follows(cx: &mut TestAppContext) {
    let mut fixture = Fixture::start_all(cx, switch(json!({})));

    fixture.click(ON_THUMB);
    fixture.session_state_becomes(ROOT, "checked", json!(true));
    fixture.session_state_becomes(THUMB, "checked", json!(true));

    fixture.click(ON_THUMB);
    fixture.session_state_becomes(ROOT, "checked", json!(false));
    fixture.session_state_becomes(THUMB, "checked", json!(false));

    fixture.settle();
    assert_eq!(
        *fixture.heard.borrow(),
        [checked_change(true), checked_change(false)]
    );
}

#[gpui::test]
#[ignore = "starts the Node peer; needs `pnpm install`, run with --ignored"]
fn the_thumb_follows_a_checked_state_its_owner_sets(cx: &mut TestAppContext) {
    let mut fixture = Fixture::start_all(cx, switch(json!({ "checked": false })));

    fixture.with_view(|view| view.set_props(ROOT, props(json!({ "checked": true }))));
    fixture.session_state_becomes(ROOT, "checked", json!(true));
    fixture.session_state_becomes(THUMB, "checked", json!(true));
    // Set from outside, not activated: nothing is announced.
    fixture.settle();
    assert!(fixture.heard.borrow().is_empty());
}

#[gpui::test]
#[ignore = "starts the Node peer; needs `pnpm install`, run with --ignored"]
fn ending_the_root_ends_its_thumb_first(cx: &mut TestAppContext) {
    let mut fixture = Fixture::start_all(cx, switch(json!({})));

    fixture.with_view(|view| view.dispose_session(ROOT));
    let seen = fixture.pump_until(|message| {
        matches!(message, PeerToHostMessage::SessionDisposed(ended) if ended.session_id == ROOT)
    });
    let ended: Vec<&str> = seen
        .iter()
        .filter_map(|message| match message {
            PeerToHostMessage::SessionDisposed(ended) => Some(ended.session_id.as_str()),
            _ => None,
        })
        .collect();
    assert_eq!(ended, [THUMB, ROOT]);
    assert!(fixture
        .with_view(|view| view.rendered_sessions())
        .is_empty());
    // Nothing was left for the host to end on the peer's behalf.
    assert!(!fixture
        .with_view(|view| view.take_outbox())
        .iter()
        .any(|message| matches!(message, HostToPeerMessage::SessionDispose(_))));
}

#[gpui::test]
#[ignore = "starts the Node peer; needs `pnpm install`, run with --ignored"]
fn space_and_enter_flip_the_focused_switch(cx: &mut TestAppContext) {
    let mut fixture = Fixture::start_all(cx, switch(json!({})));
    fixture.with_view(|view| view.call_exposed(ROOT, "focusSelf", Vec::new()));
    fixture.session_state_becomes(ROOT, "focused", json!(true));

    // Space commits before the key press reaches the Switch, which then asks
    // the host not to run Space's default action for that very press.
    fixture.cx.simulate_keystrokes("space");
    let seen = fixture.pump_until(|message| {
        matches!(message, PeerToHostMessage::DefaultActionPrevent(prevent)
            if prevent.request.reason.as_deref() == Some("switch.space-activation"))
    });
    let Some(PeerToHostMessage::DefaultActionPrevent(prevent)) = seen.last() else {
        unreachable!("pumped until a prevention")
    };
    assert!(fixture.sent.iter().any(|message| matches!(
        message,
        HostToPeerMessage::InputSample(input)
            if input.sample.sample_id == prevent.request.sample_id
                && input.sample.kind == "key.down"
                && input.sample.key.as_deref() == Some(" ")
    )));
    // The thumb heard about it during the commit, before the key press.
    assert_eq!(exposed(&mut fixture, ROOT, "checked"), Some(json!(true)));
    assert_eq!(exposed(&mut fixture, THUMB, "checked"), Some(json!(true)));

    // Enter is optional for a Switch; the router commits on it, and the
    // Switch then follows the same rules as any activation.
    fixture.cx.simulate_keystrokes("enter");
    fixture.session_state_becomes(ROOT, "checked", json!(false));
    fixture.session_state_becomes(THUMB, "checked", json!(false));
    fixture.settle();
    assert_eq!(
        *fixture.heard.borrow(),
        [checked_change(true), checked_change(false)]
    );
}

#[gpui::test]
#[ignore = "starts the Node peer; needs `pnpm install`, run with --ignored"]
fn a_disabled_switch_neither_flips_nor_announces(cx: &mut TestAppContext) {
    let mut fixture = Fixture::start_all(cx, switch(json!({ "disabled": true })));
    fixture.click(ON_THUMB);
    fixture.settle();

    // The host delivered the commit to the Switch; the Switch declined it.
    assert!(fixture.sent.iter().any(|message| matches!(
        message,
        HostToPeerMessage::InputSample(input)
            if input.session_id == ROOT && input.sample.kind == "press.commit"
    )));
    assert!(fixture.heard.borrow().is_empty());
    assert_eq!(exposed(&mut fixture, ROOT, "checked"), Some(json!(false)));
    assert_eq!(exposed(&mut fixture, THUMB, "checked"), Some(json!(false)));
}

#[gpui::test]
#[ignore = "starts the Node peer; needs `pnpm install`, run with --ignored"]
fn hover_and_press_are_transient_and_disabling_clears_them(cx: &mut TestAppContext) {
    let mut fixture = Fixture::start_all(cx, switch(json!({ "defaultChecked": true })));
    let on = Fixture::at(ON_THUMB);
    fixture
        .cx
        .simulate_mouse_move(on, None, Modifiers::default());
    fixture.session_state_becomes(ROOT, "hovered", json!(true));
    fixture
        .cx
        .simulate_mouse_down(on, MouseButton::Left, Modifiers::default());
    fixture.session_state_becomes(ROOT, "pressed", json!(true));

    // Disabled mid-press: the transient states clear and `checked` stays.
    fixture.with_view(|view| view.set_props(ROOT, props(json!({ "disabled": true }))));
    fixture.session_state_becomes(ROOT, "disabled", json!(true));
    fixture.settle();
    assert_eq!(exposed(&mut fixture, ROOT, "hovered"), Some(json!(false)));
    assert_eq!(exposed(&mut fixture, ROOT, "pressed"), Some(json!(false)));
    assert_eq!(exposed(&mut fixture, ROOT, "checked"), Some(json!(true)));

    // The release completes the click, and the disabled Switch declines it.
    fixture
        .cx
        .simulate_mouse_up(on, MouseButton::Left, Modifiers::default());
    fixture.settle();
    assert!(fixture.heard.borrow().is_empty());
    assert_eq!(exposed(&mut fixture, ROOT, "checked"), Some(json!(true)));
    assert_eq!(exposed(&mut fixture, THUMB, "checked"), Some(json!(true)));
}
