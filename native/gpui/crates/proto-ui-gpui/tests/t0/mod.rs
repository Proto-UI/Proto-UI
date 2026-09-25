//! The topology T0 fixture shared by the Prototype suites: the real peer in
//! Node, the host in a GPUI window, and the messages between them pumped one
//! at a time.
//!
//! Nothing here is scripted on either side. The peer runs a Prototype from its
//! bundle; the host renders what the peer projects, turns real GPUI input into
//! samples, and answers the peer's focus requests.
#![allow(dead_code)]

use std::cell::RefCell;
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
use serde_json::Value;

const WAIT: Duration = Duration::from_secs(30);
/// Inside the instance's root, which renders at the window's top left.
pub const ON_ROOT: (f32, f32) = (5., 5.);
/// Outside it.
pub const OFF_ROOT: (f32, f32) = (250., 80.);

/// The one instance a fixture opens.
pub struct Session {
    pub id: &'static str,
    /// The bundle entry the peer runs, such as `base-button`.
    pub prototype_key: &'static str,
    /// The text the host puts in the default slot.
    pub label: &'static str,
    pub props: WireRecord,
}

fn repository_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../../..")
        .canonicalize()
        .expect("the repository root")
}

pub struct Fixture {
    pub session: &'static str,
    pub peer: PeerProcess,
    pub window: WindowHandle<ProtoHostView>,
    pub cx: VisualTestContext,
    /// Everything the host has sent the peer, in order.
    pub sent: Vec<HostToPeerMessage>,
    /// Every signal the view emitted, as a subscribed application heard it.
    pub heard: Rc<RefCell<Vec<ExposedSignal>>>,
}

impl Fixture {
    /// Starts the peer, opens the session in a GPUI window, and pumps
    /// messages until the peer has activated its first projection.
    pub fn start(cx: &mut TestAppContext, session: Session) -> Self {
        let root = repository_root();
        let mut command = Command::new(root.join("node_modules/.bin/tsx"));
        command
            .arg(root.join("packages/adapters/gpui-peer/src/stdio.ts"))
            .current_dir(&root);
        let peer = PeerProcess::spawn(command).expect("the peer starts; run `pnpm install` first");

        let bridge = Rc::new(RefCell::new(InputBridge::new()));
        let Session {
            id,
            prototype_key,
            label,
            props,
        } = session;
        let window = cx.open_window(size(px(300.), px(100.)), move |window, cx| {
            let mut view = ProtoHostView::new(bridge, Vec::new(), window, cx);
            window.focus(view.focus_handle(), cx);
            view.open_session(
                id,
                SessionConfig {
                    instance_id: format!("{id}:instance"),
                    prototype_key: prototype_key.into(),
                    props,
                    slots: HashMap::from([(
                        "slot-default".to_string(),
                        vec![SurfaceChild::Text(label.into())],
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
            session: id,
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

    pub fn draw(&mut self) {
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

    pub fn with_view<R>(&mut self, f: impl FnOnce(&mut ProtoHostView) -> R) -> R {
        self.window
            .update(&mut self.cx, |view, _, _| f(view))
            .expect("the view updates")
    }

    /// Sends whatever the host has queued, then hands the peer's messages to
    /// the host one at a time until one satisfies `done`.
    pub fn pump_until(
        &mut self,
        done: impl Fn(&PeerToHostMessage) -> bool,
    ) -> Vec<PeerToHostMessage> {
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
    pub fn state_becomes(&mut self, name: &str, value: Value) {
        self.pump_until(|message| {
            matches!(message, PeerToHostMessage::ExposeState(state)
                if state.name == name && state.value == value)
        });
    }

    /// Pumps until the peer reports the Prototype emitting `name`.
    pub fn signal_arrives(&mut self, name: &str) {
        self.pump_until(|message| {
            matches!(message, PeerToHostMessage::ExposeSignal(signal) if signal.name == name)
        });
    }

    /// Pumps until the peer has handled everything sent before this call.
    ///
    /// The peer handles messages in order and answers every exposed call, so
    /// the answer to a call sent last proves the input before it arrived. The
    /// call names no method, so the answer is `unsupported` and the instance
    /// is left as it was.
    pub fn settle(&mut self) {
        let session = self.session;
        let call = self.with_view(|view| view.call_exposed(session, "t0:settle", Vec::new()));
        self.pump_until(|message| {
            matches!(message, PeerToHostMessage::ExposeResult(result) if result.call_id == call)
        });
    }

    /// A primary click at a point in the window.
    pub fn click(&mut self, at: (f32, f32)) {
        let position = Self::at(at);
        self.cx
            .simulate_mouse_down(position, MouseButton::Left, Modifiers::default());
        self.cx
            .simulate_mouse_up(position, MouseButton::Left, Modifiers::default());
    }

    pub fn at((x, y): (f32, f32)) -> gpui::Point<gpui::Pixels> {
        point(px(x), px(y))
    }
}
