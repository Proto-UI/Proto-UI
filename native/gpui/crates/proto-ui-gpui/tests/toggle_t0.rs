//! Base Toggle over topology T0: the real peer in Node, the host in GPUI.
//!
//! The evidence is what the Prototype reports back: its `active` state, the
//! `activeChange` event it emits, and the accessibility snapshot the host
//! projects as a toggle button.
//!
//! Ignored by default because it starts Node and needs the repository's
//! `node_modules` (`pnpm install`). The `rust-interop` CI job installs both
//! and runs them explicitly:
//!
//!   cargo test -p proto-ui-gpui --test toggle_t0 -- --ignored

mod t0;

use gpui::{Modifiers, MouseButton, TestAppContext, Toggled};
use proto_ui_gpui::hub::ExposedSignal;
use proto_ui_host_protocol::messages::{HostToPeerMessage, PeerToHostMessage, WireRecord};
use serde_json::{json, Value};
use t0::{Fixture, Session, ON_ROOT};

const SESSION: &str = "t0-toggle";

fn props(value: Value) -> WireRecord {
    value.as_object().cloned().expect("props are an object")
}

fn toggle(initial: Value) -> Session {
    Session {
        id: SESSION,
        prototype_key: "base-toggle",
        label: "Bold",
        props: props(initial),
    }
}

/// `activeChange`, carrying the value the Toggle says it becomes.
fn active_change(active: bool) -> ExposedSignal {
    ExposedSignal {
        session_id: SESSION.into(),
        name: "activeChange".into(),
        payload: json!({ "active": active }),
    }
}

fn exposed(fixture: &mut Fixture, name: &str) -> Option<Value> {
    fixture.with_view(|view| view.exposed_states(SESSION)?.get(name).cloned())
}

/// What the host reports to accessibility for the Toggle.
fn toggled(fixture: &mut Fixture) -> Option<Toggled> {
    fixture.with_view(|view| view.a11y_projection(SESSION)?.toggled)
}

/// Pumps until a snapshot says the Toggle is `pressed`, whichever message
/// brings it: a snapshot update, or a projection that carries one.
fn pressed_becomes(fixture: &mut Fixture, pressed: bool) {
    let says =
        |states: &serde_json::Map<String, Value>| states.get("pressed") == Some(&json!(pressed));
    fixture.pump_until(|message| match message {
        PeerToHostMessage::A11ySnapshot(update) => update
            .snapshot
            .as_ref()
            .is_some_and(|snapshot| says(&snapshot.states)),
        PeerToHostMessage::ProjectionInstall(install) => install
            .transaction
            .a11y
            .as_ref()
            .is_some_and(|snapshot| says(&snapshot.states)),
        _ => false,
    });
}

#[gpui::test]
#[ignore = "starts the Node peer; needs `pnpm install`, run with --ignored"]
fn each_click_flips_the_toggle_and_announces_its_new_value(cx: &mut TestAppContext) {
    let mut fixture = Fixture::start(cx, toggle(json!({})));
    assert_eq!(toggled(&mut fixture), Some(Toggled::False));

    fixture.click(ON_ROOT);
    fixture.state_becomes("active", json!(true));
    pressed_becomes(&mut fixture, true);
    assert_eq!(toggled(&mut fixture), Some(Toggled::True));

    fixture.click(ON_ROOT);
    fixture.state_becomes("active", json!(false));
    pressed_becomes(&mut fixture, false);
    assert_eq!(toggled(&mut fixture), Some(Toggled::False));

    fixture.settle();
    assert_eq!(
        *fixture.heard.borrow(),
        [active_change(true), active_change(false)]
    );
}

#[gpui::test]
#[ignore = "starts the Node peer; needs `pnpm install`, run with --ignored"]
fn a_controlled_toggle_announces_the_change_and_waits_for_its_owner(cx: &mut TestAppContext) {
    let mut fixture = Fixture::start(cx, toggle(json!({ "active": true })));
    assert_eq!(toggled(&mut fixture), Some(Toggled::True));

    fixture.click(ON_ROOT);
    fixture.signal_arrives("activeChange");
    fixture.settle();
    // It says what it would become, and stays as its owner has it.
    assert_eq!(*fixture.heard.borrow(), [active_change(false)]);
    assert_eq!(exposed(&mut fixture, "active"), Some(json!(true)));
    assert_eq!(toggled(&mut fixture), Some(Toggled::True));

    // The owner agrees.
    fixture.with_view(|view| view.set_props(SESSION, props(json!({ "active": false }))));
    fixture.state_becomes("active", json!(false));
    pressed_becomes(&mut fixture, false);
    assert_eq!(toggled(&mut fixture), Some(Toggled::False));
}

#[gpui::test]
#[ignore = "starts the Node peer; needs `pnpm install`, run with --ignored"]
fn a_disabled_toggle_neither_flips_nor_announces(cx: &mut TestAppContext) {
    let mut fixture = Fixture::start(cx, toggle(json!({ "disabled": true })));
    fixture.click(ON_ROOT);
    fixture.settle();

    // The host delivered the commit; the Prototype declined it.
    assert!(fixture.sent.iter().any(|message| matches!(
        message,
        HostToPeerMessage::InputSample(input) if input.sample.kind == "press.commit"
    )));
    assert!(fixture.heard.borrow().is_empty());
    assert_eq!(exposed(&mut fixture, "active"), Some(json!(false)));
    assert_eq!(toggled(&mut fixture), Some(Toggled::False));
}

#[gpui::test]
#[ignore = "starts the Node peer; needs `pnpm install`, run with --ignored"]
fn space_and_enter_flip_the_focused_toggle(cx: &mut TestAppContext) {
    let mut fixture = Fixture::start(cx, toggle(json!({})));
    fixture.with_view(|view| view.call_exposed(SESSION, "focusSelf", Vec::new()));
    fixture.state_becomes("focused", json!(true));

    // The commit is handled before the key press, so by the time the Toggle
    // asks the host not to run Space's default action it has already flipped.
    fixture.cx.simulate_keystrokes("space");
    let seen = fixture.pump_until(|message| {
        matches!(message, PeerToHostMessage::DefaultActionPrevent(prevent)
            if prevent.request.reason.as_deref() == Some("toggle.space-activation"))
    });
    assert_eq!(exposed(&mut fixture, "active"), Some(json!(true)));
    let Some(PeerToHostMessage::DefaultActionPrevent(prevent)) = seen.last() else {
        unreachable!("pumped until a prevention")
    };
    // The prevention names the Space the host sent.
    assert!(fixture.sent.iter().any(|message| matches!(
        message,
        HostToPeerMessage::InputSample(input)
            if input.sample.sample_id == prevent.request.sample_id
                && input.sample.kind == "key.down"
                && input.sample.key.as_deref() == Some(" ")
    )));

    fixture.cx.simulate_keystrokes("enter");
    fixture.state_becomes("active", json!(false));
    fixture.settle();
    assert_eq!(
        *fixture.heard.borrow(),
        [active_change(true), active_change(false)]
    );
}

#[gpui::test]
#[ignore = "starts the Node peer; needs `pnpm install`, run with --ignored"]
fn hover_and_press_are_transient_and_disabling_clears_them(cx: &mut TestAppContext) {
    let mut fixture = Fixture::start(cx, toggle(json!({ "defaultActive": true })));
    let on = Fixture::at(ON_ROOT);
    fixture
        .cx
        .simulate_mouse_move(on, None, Modifiers::default());
    fixture.state_becomes("hovered", json!(true));
    fixture
        .cx
        .simulate_mouse_down(on, MouseButton::Left, Modifiers::default());
    fixture.state_becomes("pressed", json!(true));

    // Disabled mid-press: the transient states clear, and `active` does not
    // move, because disabling is not an activation.
    fixture.with_view(|view| view.set_props(SESSION, props(json!({ "disabled": true }))));
    fixture.state_becomes("disabled", json!(true));
    fixture.settle();
    assert_eq!(exposed(&mut fixture, "hovered"), Some(json!(false)));
    assert_eq!(exposed(&mut fixture, "pressed"), Some(json!(false)));
    assert_eq!(exposed(&mut fixture, "active"), Some(json!(true)));

    // The release completes the click the press began, and the disabled
    // Toggle declines it.
    fixture
        .cx
        .simulate_mouse_up(on, MouseButton::Left, Modifiers::default());
    fixture.settle();
    assert!(fixture.heard.borrow().is_empty());
    assert_eq!(exposed(&mut fixture, "active"), Some(json!(true)));
    assert_eq!(toggled(&mut fixture), Some(Toggled::True));
}
