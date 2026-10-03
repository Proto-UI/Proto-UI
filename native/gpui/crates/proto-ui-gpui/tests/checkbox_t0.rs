//! Base Checkbox over topology T0: a root and the indicator that opens inside
//! it, both run by the real peer, rendered by one GPUI host.
//!
//! The indicator only learns the root's state through context. The evidence
//! is what both instances report back: the root's `checked` and
//! `indeterminate` states and the events it announces, the indicator's
//! derived states, and the checkbox the host reports to accessibility.
//!
//! Ignored by default because it starts Node and needs the repository's
//! `node_modules` (`pnpm install`). The `rust-interop` CI job installs both
//! and runs them explicitly:
//!
//!   cargo test -p proto-ui-gpui --test checkbox_t0 -- --ignored

mod t0;

use gpui::prelude::*;
use gpui::{div, px, Modifiers, MouseButton, StyleRefinement, TestAppContext, Toggled};
use proto_ui_gpui::host::SurfaceChild;
use proto_ui_gpui::hub::ExposedSignal;
use proto_ui_host_protocol::messages::{HostToPeerMessage, PeerToHostMessage, WireRecord};
use serde_json::{json, Value};
use t0::{Fixture, Session};

const ROOT: &str = "t0-checkbox";
const INDICATOR: &str = "t0-checkbox-indicator";
/// Inside the indicator, which sits at the root's top left.
const ON_INDICATOR: (f32, f32) = (5., 5.);

fn props(value: Value) -> WireRecord {
    value.as_object().cloned().expect("props are an object")
}

fn sized(width: f32, height: f32) -> StyleRefinement {
    let mut element = div().w(px(width)).h(px(height));
    element.style().clone()
}

/// A root with its indicator in the default slot, and the indicator opened
/// inside it.
fn checkbox(root_props: Value) -> Vec<Session> {
    vec![
        Session {
            id: ROOT,
            prototype_key: "base-checkbox-root",
            props: props(root_props),
            content: vec![SurfaceChild::Session(INDICATOR.into())],
            parent: None,
            root_style: sized(60., 30.),
        },
        Session {
            id: INDICATOR,
            prototype_key: "base-checkbox-indicator",
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

/// How the host reports the root to accessibility: checked, unchecked or
/// mixed.
fn reported(fixture: &mut Fixture) -> Option<Toggled> {
    fixture
        .with_view(|view| view.reported_a11y(ROOT))
        .and_then(|checkbox| checkbox.toggled)
}

fn checked_change(checked: bool) -> ExposedSignal {
    ExposedSignal {
        session_id: ROOT.into(),
        name: "checkedChange".into(),
        payload: json!({ "checked": checked, "indeterminate": false }),
    }
}

#[gpui::test]
#[ignore = "starts the Node peer; needs `pnpm install`, run with --ignored"]
fn a_click_checks_the_box_and_the_indicator_follows(cx: &mut TestAppContext) {
    let mut fixture = Fixture::start_all(cx, checkbox(json!({})));

    fixture.click(ON_INDICATOR);
    fixture.session_state_becomes(ROOT, "checked", json!(true));
    fixture.session_state_becomes(INDICATOR, "checked", json!(true));

    fixture.click(ON_INDICATOR);
    fixture.session_state_becomes(ROOT, "checked", json!(false));
    fixture.session_state_becomes(INDICATOR, "checked", json!(false));

    fixture.settle();
    assert_eq!(
        *fixture.heard.borrow(),
        [checked_change(true), checked_change(false)]
    );
}

#[gpui::test]
#[ignore = "starts the Node peer; needs `pnpm install`, run with --ignored"]
fn a_controlled_box_announces_the_next_value_and_shows_what_its_owner_sets(
    cx: &mut TestAppContext,
) {
    let mut fixture = Fixture::start_all(cx, checkbox(json!({ "checked": false })));

    // Activated, it asks its owner for the next value and keeps its own.
    fixture.click(ON_INDICATOR);
    fixture.settle();
    assert_eq!(*fixture.heard.borrow(), [checked_change(true)]);
    assert_eq!(exposed(&mut fixture, ROOT, "checked"), Some(json!(false)));
    assert_eq!(
        exposed(&mut fixture, INDICATOR, "checked"),
        Some(json!(false))
    );

    // Set from outside, not activated: nothing more is announced.
    fixture.with_view(|view| view.set_props(ROOT, props(json!({ "checked": true }))));
    fixture.session_state_becomes(ROOT, "checked", json!(true));
    fixture.session_state_becomes(INDICATOR, "checked", json!(true));
    fixture.settle();
    assert_eq!(*fixture.heard.borrow(), [checked_change(true)]);
}

#[gpui::test]
#[ignore = "starts the Node peer; needs `pnpm install`, run with --ignored"]
fn an_indeterminate_box_becomes_checked_and_says_so(cx: &mut TestAppContext) {
    let mut fixture = Fixture::start_all(cx, checkbox(json!({ "defaultIndeterminate": true })));
    // The indicator learned it while the two opened.
    assert_eq!(
        exposed(&mut fixture, INDICATOR, "indeterminate"),
        Some(json!(true))
    );
    assert_eq!(reported(&mut fixture), Some(Toggled::Mixed));

    fixture.click(ON_INDICATOR);
    fixture.session_state_becomes(ROOT, "checked", json!(true));
    fixture.session_state_becomes(INDICATOR, "checked", json!(true));
    fixture.settle();
    assert_eq!(
        exposed(&mut fixture, ROOT, "indeterminate"),
        Some(json!(false))
    );
    assert_eq!(
        exposed(&mut fixture, INDICATOR, "indeterminate"),
        Some(json!(false))
    );
    assert_eq!(reported(&mut fixture), Some(Toggled::True));
    assert_eq!(
        *fixture.heard.borrow(),
        [
            ExposedSignal {
                session_id: ROOT.into(),
                name: "indeterminateChange".into(),
                payload: json!({ "indeterminate": false }),
            },
            checked_change(true),
        ]
    );
}

#[gpui::test]
#[ignore = "starts the Node peer; needs `pnpm install`, run with --ignored"]
fn space_checks_the_focused_box_and_enter_does_not(cx: &mut TestAppContext) {
    let mut fixture = Fixture::start_all(cx, checkbox(json!({})));
    fixture.with_view(|view| view.call_exposed(ROOT, "focusSelf", Vec::new()));
    fixture.session_state_becomes(ROOT, "focused", json!(true));

    // Space commits before the key press reaches the Checkbox, which then
    // asks the host not to run Space's default action for that very press.
    fixture.cx.simulate_keystrokes("space");
    let seen = fixture.pump_until(|message| {
        matches!(message, PeerToHostMessage::DefaultActionPrevent(prevent)
            if prevent.request.reason.as_deref() == Some("checkbox.space-activation"))
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
    assert_eq!(exposed(&mut fixture, ROOT, "checked"), Some(json!(true)));
    assert_eq!(
        exposed(&mut fixture, INDICATOR, "checked"),
        Some(json!(true))
    );

    // The router commits on Enter as it does for any root, and the Checkbox
    // declines it.
    fixture.cx.simulate_keystrokes("enter");
    fixture.settle();
    assert!(fixture.sent.iter().any(|message| matches!(
        message,
        HostToPeerMessage::InputSample(input)
            if input.session_id == ROOT
                && input.sample.kind == "press.commit"
                && input.sample.key.as_deref() == Some("Enter")
    )));
    assert!(fixture.sent_before_settling("press.commit"));
    assert_eq!(exposed(&mut fixture, ROOT, "checked"), Some(json!(true)));
    assert_eq!(*fixture.heard.borrow(), [checked_change(true)]);
}

#[gpui::test]
#[ignore = "starts the Node peer; needs `pnpm install`, run with --ignored"]
fn a_disabled_box_neither_checks_nor_announces(cx: &mut TestAppContext) {
    let mut fixture = Fixture::start_all(cx, checkbox(json!({ "disabled": true })));
    fixture.click(ON_INDICATOR);
    fixture.settle();

    // The host delivered the commit to the Checkbox; the Checkbox declined it.
    assert!(fixture.sent.iter().any(|message| matches!(
        message,
        HostToPeerMessage::InputSample(input)
            if input.session_id == ROOT && input.sample.kind == "press.commit"
    )));
    assert!(fixture.sent_before_settling("press.commit"));
    assert!(fixture.heard.borrow().is_empty());
    assert_eq!(exposed(&mut fixture, ROOT, "checked"), Some(json!(false)));
    assert_eq!(
        exposed(&mut fixture, INDICATOR, "checked"),
        Some(json!(false))
    );
}

#[gpui::test]
#[ignore = "starts the Node peer; needs `pnpm install`, run with --ignored"]
fn hover_and_press_are_transient_and_disabling_clears_them(cx: &mut TestAppContext) {
    let mut fixture = Fixture::start_all(cx, checkbox(json!({ "defaultChecked": true })));
    let on = Fixture::at(ON_INDICATOR);
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

    // The release completes the click, and the disabled Checkbox declines it.
    fixture
        .cx
        .simulate_mouse_up(on, MouseButton::Left, Modifiers::default());
    fixture.settle();
    assert!(fixture.sent_before_settling("press.commit"));
    assert!(fixture.heard.borrow().is_empty());
    assert_eq!(exposed(&mut fixture, ROOT, "checked"), Some(json!(true)));
    assert_eq!(
        exposed(&mut fixture, INDICATOR, "checked"),
        Some(json!(true))
    );
}
