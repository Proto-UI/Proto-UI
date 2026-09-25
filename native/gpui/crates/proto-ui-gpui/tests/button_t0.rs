//! Base Button over topology T0: the real peer in Node, the host in GPUI.
//!
//! Nothing here is scripted on either side. The peer runs the Base Button
//! Prototype from its bundle; the host renders what the peer projects, turns
//! real GPUI input into samples, and answers the peer's focus requests. The
//! evidence is what the Prototype itself reports back: its Expose states and
//! the events it emits.
//!
//! Ignored by default because it starts Node and needs the repository's
//! `node_modules` (`pnpm install`). The `rust-interop` CI job installs both
//! and runs them explicitly:
//!
//!   cargo test -p proto-ui-gpui --test button_t0 -- --ignored

mod t0;

use std::cell::{Cell, RefCell};

use gpui::{Modifiers, MouseButton, TestAppContext};
use proto_ui_gpui::hub::ExposedSignal;
use proto_ui_host_protocol::messages::{HostToPeerMessage, PeerToHostMessage, WireRecord};
use serde_json::{json, Value};
use t0::{Fixture, Session, OFF_ROOT as OFF_BUTTON, ON_ROOT as ON_BUTTON};

const SESSION: &str = "t0-button";

fn button() -> Session {
    Session {
        id: SESSION,
        prototype_key: "base-button",
        label: "Save",
        props: WireRecord::new(),
    }
}

/// The Button's `click` event, which carries no payload.
fn click() -> ExposedSignal {
    ExposedSignal {
        session_id: SESSION.into(),
        name: "click".into(),
        payload: Value::Null,
    }
}

#[gpui::test]
#[ignore = "starts the Node peer; needs `pnpm install`, run with --ignored"]
fn hovering_the_rendered_button_is_what_the_peer_sees(cx: &mut TestAppContext) {
    let mut fixture = Fixture::start(cx, button());

    fixture
        .cx
        .simulate_mouse_move(Fixture::at(ON_BUTTON), None, Modifiers::default());
    fixture.state_becomes("hovered", json!(true));

    fixture
        .cx
        .simulate_mouse_move(Fixture::at(OFF_BUTTON), None, Modifiers::default());
    fixture.state_becomes("hovered", json!(false));
}

#[gpui::test]
#[ignore = "starts the Node peer; needs `pnpm install`, run with --ignored"]
fn pressing_holds_the_button_pressed_until_release_and_commits_it(cx: &mut TestAppContext) {
    let mut fixture = Fixture::start(cx, button());

    fixture.cx.simulate_mouse_down(
        Fixture::at(ON_BUTTON),
        MouseButton::Left,
        Modifiers::default(),
    );
    fixture.state_becomes("pressed", json!(true));

    fixture.cx.simulate_mouse_up(
        Fixture::at(ON_BUTTON),
        MouseButton::Left,
        Modifiers::default(),
    );
    fixture.state_becomes("pressed", json!(false));

    // The release was a click on the Button, so the host sent the peer a
    // commit on the lease the Button registered for it.
    assert!(fixture.sent.iter().any(|message| matches!(
        message,
        HostToPeerMessage::InputSample(input) if input.sample.kind == "press.commit"
    )));
}

#[gpui::test]
#[ignore = "starts the Node peer; needs `pnpm install`, run with --ignored"]
fn a_click_on_the_rendered_button_comes_back_as_its_click_signal(cx: &mut TestAppContext) {
    // The host only reports the press. That it was a click is the
    // Prototype's own conclusion, which it announces as its `click` event.
    let mut fixture = Fixture::start(cx, button());
    fixture.cx.simulate_mouse_down(
        Fixture::at(ON_BUTTON),
        MouseButton::Left,
        Modifiers::default(),
    );
    fixture.cx.simulate_mouse_up(
        Fixture::at(ON_BUTTON),
        MouseButton::Left,
        Modifiers::default(),
    );
    fixture.signal_arrives("click");

    assert_eq!(*fixture.heard.borrow(), [click()]);
}

#[gpui::test]
#[ignore = "starts the Node peer; needs `pnpm install`, run with --ignored"]
fn enter_and_space_on_the_focused_button_each_click_it_once(cx: &mut TestAppContext) {
    let mut fixture = Fixture::start(cx, button());
    fixture.with_view(|view| view.call_exposed(SESSION, "focusSelf", Vec::new()));
    fixture.state_becomes("focused", json!(true));

    fixture.cx.simulate_keystrokes("enter");
    fixture.signal_arrives("click");

    // Space also asks the host not to run the key's default action. Wait for
    // both, in whichever order they come.
    fixture.cx.simulate_keystrokes("space");
    let clicked = Cell::new(false);
    let prevented = RefCell::new(None);
    fixture.pump_until(|message| {
        match message {
            PeerToHostMessage::ExposeSignal(signal) if signal.name == "click" => clicked.set(true),
            PeerToHostMessage::DefaultActionPrevent(prevent)
                if prevent.request.reason.as_deref() == Some("button.space-activation") =>
            {
                *prevented.borrow_mut() = Some(prevent.request.sample_id.clone());
            }
            _ => {}
        }
        clicked.get() && prevented.borrow().is_some()
    });

    assert_eq!(*fixture.heard.borrow(), [click(), click()]);
    // The prevention names the sample it is about: the Space the host sent.
    let prevented = prevented.into_inner().expect("a prevention request");
    assert!(fixture.sent.iter().any(|message| matches!(
        message,
        HostToPeerMessage::InputSample(input)
            if input.sample.sample_id == prevented
                && input.sample.kind == "key.down"
                && input.sample.key.as_deref() == Some(" ")
    )));
}

#[gpui::test]
#[ignore = "starts the Node peer; needs `pnpm install`, run with --ignored"]
fn an_exposed_focus_call_goes_round_the_whole_loop(cx: &mut TestAppContext) {
    // The host calls the Button's exposed `focusSelf`; the Prototype's Focus
    // module asks the host for focus; the host moves GPUI focus and reports
    // the fact back; the Prototype's state follows.
    let mut fixture = Fixture::start(cx, button());
    fixture.with_view(|view| view.call_exposed(SESSION, "focusSelf", Vec::new()));
    fixture.state_becomes("focused", json!(true));

    assert!(fixture.sent.iter().any(|message| matches!(
        message,
        HostToPeerMessage::FocusResult(result)
            if result.status == proto_ui_gpui::host::FocusResultStatus::Applied
    )));
    assert!(fixture.sent.iter().any(|message| matches!(
        message,
        HostToPeerMessage::InputSample(input) if input.sample.kind == "host:focus"
    )));
}

#[gpui::test]
#[ignore = "starts the Node peer; needs `pnpm install`, run with --ignored"]
fn disabling_through_props_reaches_the_prototype(cx: &mut TestAppContext) {
    let mut fixture = Fixture::start(cx, button());
    let mut props = WireRecord::new();
    props.insert("disabled".into(), json!(true));
    fixture.with_view(|view| view.set_props(SESSION, props));
    fixture.state_becomes("disabled", json!(true));

    // The Expose state can arrive before the re-render does. Wait for the
    // snapshot that carries the change, whichever message brings it.
    let says_disabled =
        |states: &serde_json::Map<String, Value>| states.get("disabled") == Some(&json!(true));
    fixture.pump_until(|message| match message {
        PeerToHostMessage::ProjectionInstall(install) => install
            .transaction
            .a11y
            .as_ref()
            .is_some_and(|snapshot| says_disabled(&snapshot.states)),
        PeerToHostMessage::A11ySnapshot(update) => update
            .snapshot
            .as_ref()
            .is_some_and(|snapshot| says_disabled(&snapshot.states)),
        _ => false,
    });
    let disabled = fixture.with_view(|view| {
        view.a11y_snapshot(SESSION)
            .and_then(|snapshot| snapshot.states.get("disabled").cloned())
    });
    assert_eq!(disabled, Some(json!(true)));
}

#[gpui::test]
#[ignore = "starts the Node peer; needs `pnpm install`, run with --ignored"]
fn disposal_ends_the_session_on_both_sides(cx: &mut TestAppContext) {
    let mut fixture = Fixture::start(cx, button());
    fixture.with_view(|view| view.dispose_session(SESSION));
    fixture.pump_until(|message| matches!(message, PeerToHostMessage::SessionDisposed(_)));

    // The Button is gone from the window: a click reaches nobody.
    fixture.cx.simulate_mouse_down(
        Fixture::at(ON_BUTTON),
        MouseButton::Left,
        Modifiers::default(),
    );
    fixture.cx.simulate_mouse_up(
        Fixture::at(ON_BUTTON),
        MouseButton::Left,
        Modifiers::default(),
    );
    assert!(fixture
        .with_view(|view| view.take_outbox())
        .iter()
        .all(|message| !matches!(message, HostToPeerMessage::InputSample(_))));
}
