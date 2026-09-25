//! Base Button over topology T0: the real peer in Node, the host in GPUI.
//!
//! Nothing here is scripted on either side. The peer runs the Base Button
//! Prototype from its bundle; the host renders what the peer projects, turns
//! real GPUI input into samples, and answers the peer's focus requests. The
//! evidence is what the Prototype itself reports back: its Expose states and
//! the events it emits.
//!
//! Ignored by default because it starts Node and needs the repository's
//! `node_modules` (`pnpm install`), which the Rust CI jobs do not install:
//!
//!   cargo test -p proto-ui-gpui --test button_t0 -- --ignored

use std::cell::{Cell, RefCell};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Command;
use std::rc::Rc;
use std::time::{Duration, Instant};

use gpui::{
    point, px, size, AnyWindowHandle, Modifiers, MouseButton, StyleRefinement, TestAppContext,
    VisualTestContext, WindowHandle,
};
use proto_ui_gpui::host::{InputBridge, ProtoHostView, SurfaceChild};
use proto_ui_gpui::hub::{ExposedSignal, SessionConfig};
use proto_ui_host_protocol::messages::{HostToPeerMessage, PeerToHostMessage, WireRecord};
use proto_ui_host_protocol::t0::{PeerError, PeerProcess};
use serde_json::{json, Value};

const SESSION: &str = "t0-button";
const WAIT: Duration = Duration::from_secs(30);
const ON_BUTTON: (f32, f32) = (5., 5.);
const OFF_BUTTON: (f32, f32) = (250., 80.);

fn repository_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../../..")
        .canonicalize()
        .expect("the repository root")
}

struct Fixture {
    peer: PeerProcess,
    window: WindowHandle<ProtoHostView>,
    cx: VisualTestContext,
    /// Everything the host has sent the peer, in order.
    sent: Vec<HostToPeerMessage>,
    /// Every signal the view emitted, as a subscribed application heard it.
    heard: Rc<RefCell<Vec<ExposedSignal>>>,
}

impl Fixture {
    /// Starts the peer, opens a Base Button session in a GPUI window, and
    /// pumps messages until the peer has activated its first projection.
    fn start(cx: &mut TestAppContext) -> Self {
        let root = repository_root();
        let mut command = Command::new(root.join("node_modules/.bin/tsx"));
        command
            .arg(root.join("packages/adapters/gpui-peer/src/stdio.ts"))
            .current_dir(&root);
        let peer = PeerProcess::spawn(command).expect("the peer starts; run `pnpm install` first");

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
                    root_style: StyleRefinement::default(),
                    theme: None,
                },
                cx,
            );
            view
        });
        window
            .update(cx, |_, window, _| window.activate_window())
            .expect("the window activates");
        cx.run_until_parked();

        let mut fixture = Self {
            peer,
            window,
            cx: VisualTestContext::from_window(AnyWindowHandle::from(window), cx),
            sent: Vec::new(),
            heard: Rc::default(),
        };
        fixture.listen();
        fixture.draw();
        fixture.pump_until(|message| matches!(message, PeerToHostMessage::ProjectionActivate(_)));
        fixture
    }

    fn draw(&mut self) {
        self.cx.update(|window, cx| window.draw(cx).clear(cx));
    }

    /// Subscribes to the view the way a host application would.
    fn listen(&mut self) {
        let view = self.window.entity(&self.cx).expect("the view");
        let heard = self.heard.clone();
        self.cx.update(|_, cx| {
            cx.subscribe(&view, move |_, signal: &ExposedSignal, _| {
                heard.borrow_mut().push(signal.clone())
            })
            .detach();
        });
    }

    fn with_view<R>(&mut self, f: impl FnOnce(&mut ProtoHostView) -> R) -> R {
        self.window
            .update(&mut self.cx, |view, _, _| f(view))
            .expect("the view updates")
    }

    /// Sends whatever the host has queued, then hands the peer's messages to
    /// the host one at a time until one satisfies `done`.
    fn pump_until(&mut self, done: impl Fn(&PeerToHostMessage) -> bool) -> Vec<PeerToHostMessage> {
        let deadline = Instant::now() + WAIT;
        let mut seen: Vec<PeerToHostMessage> = Vec::new();
        loop {
            for message in self.with_view(|view| view.take_outbox()) {
                self.peer
                    .send(&message)
                    .expect("the peer takes the message");
                self.sent.push(message);
            }
            match self.peer.recv(Duration::from_millis(50)) {
                Ok(message) => {
                    let finished = done(&message);
                    let delivered = message.clone();
                    self.window
                        .update(&mut self.cx, |view, window, cx| {
                            view.receive(delivered, window, cx)
                        })
                        .expect("the view receives");
                    self.draw();
                    seen.push(message);
                    if finished {
                        return seen;
                    }
                }
                Err(PeerError::Timeout(_)) if Instant::now() < deadline => {}
                Err(error) => panic!(
                    "{error}; the peer sent {:?}",
                    seen.iter()
                        .map(|message| message.kind())
                        .collect::<Vec<_>>()
                ),
            }
        }
    }

    /// Pumps until the peer reports an Expose state with this value.
    fn state_becomes(&mut self, name: &str, value: Value) {
        self.pump_until(|message| {
            matches!(message, PeerToHostMessage::ExposeState(state)
                if state.name == name && state.value == value)
        });
    }

    /// Pumps until the peer reports the Prototype emitting `name`.
    fn signal_arrives(&mut self, name: &str) {
        self.pump_until(|message| {
            matches!(message, PeerToHostMessage::ExposeSignal(signal) if signal.name == name)
        });
    }

    fn at((x, y): (f32, f32)) -> gpui::Point<gpui::Pixels> {
        point(px(x), px(y))
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
    let mut fixture = Fixture::start(cx);

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
    let mut fixture = Fixture::start(cx);

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
    let mut fixture = Fixture::start(cx);
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
    let mut fixture = Fixture::start(cx);
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
    let mut fixture = Fixture::start(cx);
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
    let mut fixture = Fixture::start(cx);
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
    let mut fixture = Fixture::start(cx);
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
