//! Tab's default action: sequential focus navigation over the instances whose
//! focus plan makes them a tab stop, driven by what the real peer recorded.
//!
//! The window holds, in document order, an enabled Base Button, a disabled
//! one, and a Base Toggle. The disabled Button's plan takes it out of the
//! sequence and out of programmatic focus; the other two are in both.

use std::cell::RefCell;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::rc::Rc;

use gpui::{
    px, size, AnyWindowHandle, StyleRefinement, TestAppContext, VisualTestContext, WindowHandle,
};
use proto_ui_gpui::host::{FocusResultStatus, InputBridge, ProtoHostView, SurfaceChild};
use proto_ui_gpui::hub::{HubNote, SessionConfig};
use proto_ui_host_protocol::messages::{HostToPeerMessage, PeerToHostMessage, WireRecord};
use serde_json::{json, Value};

const ENABLED: &str = "button-enabled";
const DISABLED: &str = "button-disabled";
const TOGGLE: &str = "toggle-inactive";

fn recorded(fixture: &str, session: &str) -> Vec<PeerToHostMessage> {
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
        .collect()
}

fn config(session: &str, prototype_key: &str, label: &str) -> SessionConfig {
    SessionConfig {
        instance_id: format!("{session}:instance"),
        prototype_key: prototype_key.into(),
        props: WireRecord::new(),
        slots: HashMap::from([(
            "slot-default".to_string(),
            vec![SurfaceChild::Text(label.to_string().into())],
        )]),
        root_style: StyleRefinement::default(),
        theme: None,
        parent: None,
    }
}

struct Window {
    window: WindowHandle<ProtoHostView>,
    cx: VisualTestContext,
}

impl Window {
    fn open(cx: &mut TestAppContext) -> Self {
        let bridge = Rc::new(RefCell::new(InputBridge::new()));
        let window = cx.open_window(size(px(300.), px(120.)), move |window, cx| {
            let mut view = ProtoHostView::new(bridge, Vec::new(), window, cx);
            window.focus(view.focus_handle(), cx);
            view.open_session(ENABLED, config(ENABLED, "base-button", "Save"), cx);
            view.open_session(DISABLED, config(DISABLED, "base-button", "Delete"), cx);
            view.open_session(TOGGLE, config(TOGGLE, "base-toggle", "Bold"), cx);
            view
        });
        // Focus facts only flow in an active window, as in a browser.
        window
            .update(cx, |_, window, _| window.activate_window())
            .expect("the window activates");
        cx.run_until_parked();
        let mut opened = Self {
            window,
            cx: VisualTestContext::from_window(AnyWindowHandle::from(window), cx),
        };
        let recordings = recorded("base-button-session.json", "enabled")
            .into_iter()
            .chain(recorded("base-button-session.json", "disabled"))
            .chain(recorded("base-toggle-session.json", "inactive"));
        for message in recordings {
            opened
                .window
                .update(&mut opened.cx, |view, window, cx| {
                    view.receive(message, window, cx)
                })
                .expect("the view receives");
        }
        opened.draw();
        opened.outbox();
        opened
    }

    fn draw(&mut self) {
        self.cx.update(|window, cx| window.draw(cx).clear(cx));
    }

    fn outbox(&mut self) -> Vec<HostToPeerMessage> {
        self.window
            .update(&mut self.cx, |view, _, _| view.take_outbox())
            .expect("the view drains")
    }

    /// The sample a session was sent for a key press, from the outbox.
    fn key_sample(&mut self, session: &str, key: &str) -> String {
        self.outbox()
            .into_iter()
            .find_map(|message| match message {
                HostToPeerMessage::InputSample(input)
                    if input.session_id == session
                        && input.sample.kind == "key.down"
                        && input.sample.key.as_deref() == Some(key) =>
                {
                    Some(input.sample.sample_id)
                }
                _ => None,
            })
            .expect("the key was sent to the session")
    }

    /// The peer asks the host not to run a sample's default action. Returns
    /// what the hub noted.
    fn prevent(&mut self, session: &str, sample_id: &str) -> Vec<HubNote> {
        let prevent: PeerToHostMessage = serde_json::from_value(json!({
            "kind": "default-action.prevent",
            "request": { "sessionId": session, "sampleId": sample_id, "reason": "test" },
        }))
        .expect("a prevention");
        self.window
            .update(&mut self.cx, |view, window, cx| {
                view.receive(prevent, window, cx);
                view.take_notes()
            })
            .expect("the view receives")
    }

    /// Presses a key and returns the sessions told they gained focus.
    fn press(&mut self, keystroke: &str) -> Vec<String> {
        self.cx.simulate_keystrokes(keystroke);
        self.draw();
        self.outbox()
            .into_iter()
            .filter_map(|message| match message {
                HostToPeerMessage::InputSample(input) if input.sample.kind == "host:focus" => {
                    Some(input.session_id)
                }
                _ => None,
            })
            .collect()
    }
}

#[gpui::test]
fn tab_moves_focus_through_the_tab_stops_in_document_order(cx: &mut TestAppContext) {
    let mut window = Window::open(cx);
    assert_eq!(window.press("tab"), [ENABLED]);
    // The disabled Button's plan takes it out of the sequence.
    assert_eq!(window.press("tab"), [TOGGLE]);
    assert_eq!(window.press("shift-tab"), [ENABLED]);
}

#[gpui::test]
fn a_prevention_that_arrives_after_tab_moved_focus_is_late(cx: &mut TestAppContext) {
    let mut window = Window::open(cx);
    window.cx.simulate_keystrokes("tab");
    window.draw();
    // The Tab reached the Button's global key lease before focus moved.
    let tab = window.key_sample(ENABLED, "Tab");

    let notes = window.prevent(ENABLED, &tab);
    assert!(notes.contains(&HubNote::LatePrevention {
        session_id: ENABLED.into(),
        sample_id: tab,
    }));
}

#[gpui::test]
fn a_prevention_stays_late_however_much_input_follows_it(cx: &mut TestAppContext) {
    let mut window = Window::open(cx);
    window.cx.simulate_keystrokes("a");
    let letter = window.key_sample(ENABLED, "a");
    window.cx.simulate_keystrokes("tab");
    window.draw();
    let tab = window.key_sample(ENABLED, "Tab");
    // Far more Tab presses than any peer lags behind, each running its
    // default action, before the peer answers the first two presses.
    for _ in 0..100 {
        window.press("tab");
    }

    let notes = window.prevent(ENABLED, &tab);
    assert!(notes.contains(&HubNote::LatePrevention {
        session_id: ENABLED.into(),
        sample_id: tab,
    }));
    // A key with no default action is still in time.
    let notes = window.prevent(ENABLED, &letter);
    assert!(!notes
        .iter()
        .any(|note| matches!(note, HubNote::LatePrevention { .. })));
}

#[gpui::test]
fn the_host_does_not_focus_a_root_its_plan_keeps_out_of_focus(cx: &mut TestAppContext) {
    let mut window = Window::open(cx);
    let statuses = window
        .window
        .update(&mut window.cx, |view, window, cx| {
            [ENABLED, DISABLED].map(|session| {
                view.request_focus(
                    session,
                    "focus-root",
                    proto_ui_gpui::host::FocusAction::Focus,
                    window,
                    cx,
                )
            })
        })
        .expect("the view focuses");
    assert_eq!(
        statuses,
        [FocusResultStatus::Applied, FocusResultStatus::Rejected]
    );
}
