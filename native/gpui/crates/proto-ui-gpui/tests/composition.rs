//! Instances composed into one another, driven by what the real peer recorded
//! for Base Switch: a root, and the thumb that opens inside it.
//!
//! The host decides where an instance renders: the root places the thumb in
//! its slot. The peer decides who it belongs to: the thumb opens inside the
//! root, and the root reports itself a trigger. These cases check the host's
//! half of that: the thumb renders inside the root, a click on it belongs to
//! the root, and the thumb ends no later than the root it belongs to.
//!
//! Layout, in window coordinates:
//!
//! ```text
//! root    (0,0)  60×30   session `switch-root`, a trigger
//!   thumb (0,0)  20×20   session `switch-thumb`, placed in the root's slot
//! ```

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
use proto_ui_gpui::host::{InputBridge, ProtoHostView, SurfaceChild};
use proto_ui_gpui::hub::SessionConfig;
use proto_ui_host_protocol::messages::{
    HostToPeerMessage, PeerToHostMessage, SessionDisposed, WireRecord,
};
use serde_json::{json, Value};

const ROOT: &str = "switch-root";
const THUMB: &str = "switch-thumb";
const ON_THUMB: (f32, f32) = (5., 5.);
const ON_ROOT_ONLY: (f32, f32) = (45., 20.);

fn recorded(session: &str) -> Vec<Value> {
    let path =
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/base-switch-session.json");
    let fixture: Value =
        serde_json::from_str(&fs::read_to_string(path).expect("the fixture reads"))
            .expect("the fixture parses");
    fixture["sessions"][session]
        .as_array()
        .expect("a recorded session")
        .clone()
}

fn peer(messages: Vec<Value>) -> Vec<PeerToHostMessage> {
    messages
        .into_iter()
        .map(|message| serde_json::from_value(message).expect("a peer message"))
        .collect()
}

/// The lease ids the recorded root registered for `press.commit`.
fn root_commit_leases() -> Vec<String> {
    peer(recorded("root"))
        .into_iter()
        .find_map(|message| match message {
            PeerToHostMessage::ProjectionInstall(install) => Some(install.transaction),
            _ => None,
        })
        .expect("the root installed a projection")
        .events
        .registrations
        .into_iter()
        .filter(|registration| {
            registration.kind.as_deref() == Some("press.commit")
                && registration.scope.as_deref() == Some("root")
        })
        .filter_map(|registration| registration.lease_id)
        .collect()
}

fn sized(width: f32, height: f32) -> StyleRefinement {
    let mut element = div().w(px(width)).h(px(height));
    element.style().clone()
}

fn ended(session: &str) -> PeerToHostMessage {
    PeerToHostMessage::SessionDisposed(SessionDisposed {
        session_id: session.into(),
    })
}

struct Composed {
    window: WindowHandle<ProtoHostView>,
    cx: VisualTestContext,
    bridge: Rc<RefCell<InputBridge>>,
}

impl Composed {
    fn open(cx: &mut TestAppContext) -> Self {
        let bridge = Rc::new(RefCell::new(InputBridge::new()));
        let shared = bridge.clone();
        let window = cx.open_window(size(px(300.), px(100.)), move |window, cx| {
            let mut view = ProtoHostView::new(shared, Vec::new(), window, cx);
            window.focus(view.focus_handle(), cx);
            view.open_session(
                ROOT,
                SessionConfig {
                    instance_id: format!("{ROOT}:instance"),
                    prototype_key: "base-switch-root".into(),
                    props: WireRecord::new(),
                    slots: HashMap::from([(
                        "slot-default".to_string(),
                        vec![SurfaceChild::Session(THUMB.into())],
                    )]),
                    root_style: sized(60., 30.),
                    theme: None,
                    parent: None,
                },
                cx,
            );
            view.open_session(
                THUMB,
                SessionConfig {
                    instance_id: format!("{THUMB}:instance"),
                    prototype_key: "base-switch-thumb".into(),
                    props: WireRecord::new(),
                    slots: HashMap::new(),
                    root_style: sized(20., 20.),
                    theme: None,
                    parent: Some(ROOT.into()),
                },
                cx,
            );
            view
        });
        window
            .update(cx, |_, window, _| window.activate_window())
            .expect("the window activates");
        cx.run_until_parked();
        let mut composed = Self {
            window,
            cx: VisualTestContext::from_window(AnyWindowHandle::from(window), cx),
            bridge,
        };
        composed.draw();
        composed
    }

    fn draw(&mut self) {
        self.cx.update(|window, cx| window.draw(cx).clear(cx));
    }

    fn receive(&mut self, messages: Vec<PeerToHostMessage>) {
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

    /// The sessions the host asks the peer to end, from the outbox.
    fn ends_requested(&mut self) -> Vec<String> {
        self.outbox()
            .into_iter()
            .filter_map(|message| match message {
                HostToPeerMessage::SessionDispose(dispose) => Some(dispose.session_id),
                _ => None,
            })
            .collect()
    }

    fn rendered(&mut self) -> Vec<String> {
        self.window
            .update(&mut self.cx, |view, _, _| view.rendered_sessions())
            .expect("the view reads")
    }

    fn is_open(&mut self, session: &str) -> bool {
        self.window
            .update(&mut self.cx, |view, _, _| {
                view.exposed_states(session).is_some()
            })
            .expect("the view reads")
    }

    /// `(session, leases)` for each commit a click at `at` sends the peer.
    fn commits_on_click(&mut self, (x, y): (f32, f32)) -> Vec<(String, Vec<String>)> {
        self.outbox();
        let at = point(px(x), px(y));
        self.cx
            .simulate_mouse_down(at, MouseButton::Left, Modifiers::default());
        self.cx
            .simulate_mouse_up(at, MouseButton::Left, Modifiers::default());
        self.outbox()
            .into_iter()
            .filter_map(|message| match message {
                HostToPeerMessage::InputSample(input) if input.sample.kind == "press.commit" => {
                    Some((input.session_id, input.sample.lease_ids))
                }
                _ => None,
            })
            .collect()
    }
}

#[gpui::test]
fn the_thumb_opens_inside_the_root(cx: &mut TestAppContext) {
    let mut composed = Composed::open(cx);
    let opens: Vec<(String, Option<String>)> = composed
        .outbox()
        .into_iter()
        .filter_map(|message| match message {
            HostToPeerMessage::SessionOpen(open) => Some((open.session_id, open.parent_session_id)),
            _ => None,
        })
        .collect();
    assert_eq!(
        opens,
        [(ROOT.into(), None), (THUMB.into(), Some(ROOT.into()))]
    );
}

#[gpui::test]
fn a_click_on_the_thumb_commits_the_switch_it_belongs_to(cx: &mut TestAppContext) {
    let mut composed = Composed::open(cx);
    composed.receive(peer(recorded("root")));
    composed.receive(peer(recorded("thumb")));

    // The root is a trigger, so input anywhere inside it is the root's.
    assert_eq!(
        composed.commits_on_click(ON_THUMB),
        [(ROOT.to_string(), root_commit_leases())]
    );
    assert_eq!(
        composed.commits_on_click(ON_ROOT_ONLY),
        [(ROOT.to_string(), root_commit_leases())]
    );
}

#[gpui::test]
fn without_its_trigger_plan_the_root_would_lose_the_thumbs_clicks(cx: &mut TestAppContext) {
    // The same recording with the trigger plan taken out. The thumb, the
    // innermost instance under the pointer, owns the click, and it listens
    // for nothing; outside the thumb the root still owns it.
    let mut root = recorded("root");
    for message in &mut root {
        if message["kind"] == "projection.install" {
            message["transaction"]["events"]
                .as_object_mut()
                .expect("an events plan")
                .remove("trigger")
                .expect("the recording carries a trigger plan");
        }
    }
    let mut composed = Composed::open(cx);
    composed.receive(peer(root));
    composed.receive(peer(recorded("thumb")));

    assert!(composed.commits_on_click(ON_THUMB).is_empty());
    assert_eq!(
        composed.commits_on_click(ON_ROOT_ONLY),
        [(ROOT.to_string(), root_commit_leases())]
    );
}

#[gpui::test]
fn ending_the_root_ends_its_thumb_first(cx: &mut TestAppContext) {
    let mut composed = Composed::open(cx);
    composed.receive(peer(recorded("root")));
    composed.receive(peer(recorded("thumb")));
    assert_eq!(composed.rendered(), [ROOT, THUMB]);
    composed.outbox();

    composed
        .window
        .update(&mut composed.cx, |view, _, _| view.dispose_session(ROOT))
        .expect("the view disposes");
    // One request: the peer ends the thumb first, and reports it first.
    assert_eq!(composed.ends_requested(), [ROOT]);
    composed.receive(vec![ended(THUMB)]);
    assert_eq!(composed.rendered(), [ROOT]);
    composed.receive(vec![ended(ROOT)]);
    assert!(composed.rendered().is_empty());
    assert!(composed.ends_requested().is_empty());
}

#[gpui::test]
fn a_root_reported_ended_first_takes_its_thumb_with_it(cx: &mut TestAppContext) {
    // The thumb joins the root's trigger group here, so a thumb left behind
    // would route its input to a root that is gone.
    let mut thumb = recorded("thumb");
    for message in &mut thumb {
        if message["kind"] == "projection.install" {
            message["transaction"]["events"]["trigger"] = json!({ "anchor": ROOT });
        }
    }
    let mut composed = Composed::open(cx);
    composed.receive(peer(recorded("root")));
    composed.receive(peer(thumb));
    assert_eq!(
        composed
            .bridge
            .borrow()
            .trigger_anchor(THUMB)
            .map(String::as_str),
        Some(ROOT)
    );
    composed.outbox();

    // A peer that reports the root ended while the thumb it holds is open.
    composed.receive(vec![ended(ROOT)]);

    // The thumb ends with it, and the host asks the peer to end it as well.
    assert_eq!(composed.ends_requested(), [THUMB]);
    // Not promoted to the top level, not open, and not routed to the root's
    // group.
    assert!(composed.rendered().is_empty());
    assert!(!composed.is_open(THUMB));
    assert_eq!(composed.bridge.borrow().trigger_anchor(THUMB), None);
    assert!(composed.commits_on_click(ON_THUMB).is_empty());
    // The peer's own report of the thumb, arriving later, changes nothing.
    composed.receive(vec![ended(THUMB)]);
    assert!(composed.rendered().is_empty());
    assert!(composed.ends_requested().is_empty());
}
