//! Drives real GPUI input through the host and reads back what the router
//! delivered.
//!
//! The router's own suite pins the Web rules against hand-written paths. This
//! one checks that GPUI produces those paths: that hit testing, bubbling and
//! focus give the router the surfaces a browser would have given the Web
//! router, for the same pointer and key input.
//!
//! Layout, in window coordinates:
//!
//! ```text
//! outer   (0,0)   200×200   session `outer`
//!   inner (50,50)  50×50    session `inner`, focusable
//!     part (60,60) 20×20    belongs to `inner`; not a session root
//! sibling (300,0)  50×50    session `sibling`
//! ```

use std::cell::RefCell;
use std::rc::Rc;

use gpui::prelude::*;
use gpui::{
    div, point, px, size, FocusHandle, Keystroke, Modifiers, MouseButton, MouseExitEvent, Pixels,
    PlatformInput, Point, StyleRefinement, TestAppContext, VisualTestContext,
};
use proto_ui_gpui::host::{InputBridge, ProtoHostView, SurfaceNode};
use proto_ui_gpui::input::{Routed, RoutedLease, SessionRoute};
use proto_ui_host_protocol::event_type::EventType;
use proto_ui_host_protocol::wire::EventScope;

const ROOT_TYPES: &[&str] = &[
    "pointer.down",
    "pointer.up",
    "pointer.move",
    "pointer.enter",
    "pointer.leave",
    "press.commit",
    "context.menu",
    "key.down",
];

fn leases(session: &str) -> Vec<RoutedLease> {
    let mut leases: Vec<RoutedLease> = ROOT_TYPES
        .iter()
        .map(|kind| RoutedLease {
            lease_id: format!("{session}:root:{kind}"),
            scope: EventScope::Root,
            event: EventType::parse(kind).expect("a valid type"),
        })
        .collect();
    leases.push(RoutedLease {
        lease_id: format!("{session}:global:key.down"),
        scope: EventScope::Global,
        event: EventType::parse("key.down").expect("a valid type"),
    });
    leases
}

fn boxed(left: f32, top: f32, width: f32, height: f32) -> StyleRefinement {
    let mut element = div()
        .absolute()
        .left(px(left))
        .top(px(top))
        .w(px(width))
        .h(px(height));
    element.style().clone()
}

fn surface(
    id: &str,
    session: &str,
    style: StyleRefinement,
    focus: Option<FocusHandle>,
    children: Vec<SurfaceNode>,
) -> SurfaceNode {
    SurfaceNode {
        id: id.into(),
        session: session.into(),
        style,
        focus,
        children,
    }
}

struct Host {
    bridge: Rc<RefCell<InputBridge>>,
    cx: VisualTestContext,
    inner_focus: FocusHandle,
}

impl Host {
    fn open(cx: &mut TestAppContext) -> Self {
        let bridge = Rc::new(RefCell::new(InputBridge::new()));
        // Registration order is the window-listener order the router follows.
        for session in ["outer", "inner", "sibling"] {
            bridge.borrow_mut().upsert_session(SessionRoute {
                session_id: session.into(),
                root: session.into(),
                view_epoch: 1,
                leases: leases(session),
            });
        }

        let inner_focus = cx.update(|cx| cx.focus_handle());
        let surfaces = vec![
            surface(
                "outer",
                "outer",
                boxed(0., 0., 200., 200.),
                None,
                vec![surface(
                    "inner",
                    "inner",
                    boxed(50., 50., 50., 50.),
                    Some(inner_focus.clone()),
                    vec![surface(
                        "part",
                        "inner",
                        boxed(10., 10., 20., 20.),
                        None,
                        vec![],
                    )],
                )],
            ),
            surface(
                "sibling",
                "sibling",
                boxed(300., 0., 50., 50.),
                None,
                vec![],
            ),
        ];

        let view_bridge = bridge.clone();
        let window = cx.open_window(size(px(400.), px(300.)), move |window, cx| {
            let view = ProtoHostView::new(view_bridge, surfaces, window, cx);
            window.focus(view.focus_handle(), cx);
            view
        });
        let mut cx = VisualTestContext::from_window(window.into(), cx);
        cx.update(|window, cx| window.draw(cx).clear(cx));
        Self {
            bridge,
            cx,
            inner_focus,
        }
    }

    fn drain(&self) -> Vec<Routed> {
        self.bridge.borrow_mut().drain()
    }

    fn move_to(&mut self, at: Point<Pixels>) {
        self.cx.simulate_mouse_move(at, None, Modifiers::default());
    }

    fn press(&mut self, at: Point<Pixels>, button: MouseButton) {
        self.cx
            .simulate_mouse_down(at, button, Modifiers::default());
    }

    fn release(&mut self, at: Point<Pixels>, button: MouseButton) {
        self.cx.simulate_mouse_up(at, button, Modifiers::default());
    }
}

/// `(session, type, leases)` for the samples of the given types, in order.
fn only(routed: &[Routed], kinds: &[&str]) -> Vec<(String, String, Vec<String>)> {
    routed
        .iter()
        .filter(|routed| kinds.contains(&routed.sample.kind.as_str()))
        .map(|routed| {
            (
                routed.session_id.clone(),
                routed.sample.kind.clone(),
                routed.sample.lease_ids.clone(),
            )
        })
        .collect()
}

fn root(session: &str, kind: &str) -> (String, String, Vec<String>) {
    (
        session.into(),
        kind.into(),
        vec![format!("{session}:root:{kind}")],
    )
}

fn global_key(session: &str, with_root: bool) -> (String, String, Vec<String>) {
    let mut leases = vec![format!("{session}:global:key.down")];
    if with_root {
        leases.push(format!("{session}:root:key.down"));
    }
    (session.into(), "key.down".into(), leases)
}

const IN_PART: (f32, f32) = (65., 65.);
const IN_OUTER_ONLY: (f32, f32) = (20., 20.);
const IN_SIBLING: (f32, f32) = (310., 10.);

fn at((x, y): (f32, f32)) -> Point<Pixels> {
    point(px(x), px(y))
}

#[gpui::test]
fn hovering_a_part_enters_outermost_first_and_moves_bubble_innermost_first(
    cx: &mut TestAppContext,
) {
    let mut host = Host::open(cx);
    host.move_to(at(IN_PART));
    // GPUI reports `part`, `inner` and `outer` under the pointer. `part` is
    // not a session root, so it contributes ownership but no events.
    assert_eq!(
        only(&host.drain(), &["pointer.enter", "pointer.move"]),
        vec![
            root("outer", "pointer.enter"),
            root("inner", "pointer.enter"),
            root("inner", "pointer.move"),
            root("outer", "pointer.move"),
        ]
    );
}

#[gpui::test]
fn clicking_a_part_commits_its_instance_and_nothing_around_it(cx: &mut TestAppContext) {
    let mut host = Host::open(cx);
    host.move_to(at(IN_PART));
    host.drain();

    host.press(at(IN_PART), MouseButton::Left);
    host.release(at(IN_PART), MouseButton::Left);
    assert_eq!(
        only(
            &host.drain(),
            &["pointer.down", "pointer.up", "press.commit"]
        ),
        vec![
            root("inner", "pointer.down"),
            root("outer", "pointer.down"),
            root("inner", "pointer.up"),
            root("outer", "pointer.up"),
            root("inner", "press.commit"),
        ]
    );
}

#[gpui::test]
fn releasing_over_the_parent_commits_the_common_ancestor(cx: &mut TestAppContext) {
    // A browser fires `click` on the nearest common ancestor of the press and
    // release targets.
    let mut host = Host::open(cx);
    host.press(at(IN_PART), MouseButton::Left);
    host.release(at(IN_OUTER_ONLY), MouseButton::Left);
    assert_eq!(
        only(&host.drain(), &["press.commit"]),
        vec![root("outer", "press.commit")]
    );
}

#[gpui::test]
fn pressing_over_the_parent_and_releasing_over_a_part_commits_the_parent(cx: &mut TestAppContext) {
    // The mirror image of the case above, and the one that tells the common
    // ancestor apart from the release target: the release lands inside
    // `inner`, but the press did not, so `inner` does not commit.
    let mut host = Host::open(cx);
    host.press(at(IN_OUTER_ONLY), MouseButton::Left);
    host.release(at(IN_PART), MouseButton::Left);
    assert_eq!(
        only(&host.drain(), &["press.commit"]),
        vec![root("outer", "press.commit")]
    );
}

#[gpui::test]
fn releasing_over_an_unrelated_surface_commits_nothing(cx: &mut TestAppContext) {
    let mut host = Host::open(cx);
    host.press(at(IN_PART), MouseButton::Left);
    host.release(at(IN_SIBLING), MouseButton::Left);
    assert!(only(&host.drain(), &["press.commit"]).is_empty());
}

#[gpui::test]
fn a_secondary_press_asks_for_a_context_menu_and_never_commits(cx: &mut TestAppContext) {
    let mut host = Host::open(cx);
    host.press(at(IN_PART), MouseButton::Right);
    host.release(at(IN_PART), MouseButton::Right);
    let routed = host.drain();
    assert_eq!(
        only(&routed, &["context.menu"]),
        vec![root("inner", "context.menu"), root("outer", "context.menu")]
    );
    assert!(only(&routed, &["press.commit"]).is_empty());
}

#[gpui::test]
fn leaving_the_window_leaves_every_hovered_root_innermost_first(cx: &mut TestAppContext) {
    let mut host = Host::open(cx);
    host.move_to(at(IN_PART));
    host.drain();
    host.cx.simulate_event(MouseExitEvent {
        position: at((500., 500.)),
        pressed_button: None,
        modifiers: Modifiers::default(),
    });
    assert_eq!(
        only(&host.drain(), &["pointer.leave"]),
        vec![
            root("inner", "pointer.leave"),
            root("outer", "pointer.leave")
        ]
    );
}

#[gpui::test]
fn a_key_press_reaches_the_focused_instance_and_everyone_globally(cx: &mut TestAppContext) {
    let mut host = Host::open(cx);
    let focus = host.inner_focus.clone();
    host.cx.update(|window, cx| window.focus(&focus, cx));

    host.cx.simulate_keystrokes("enter");
    assert_eq!(
        only(&host.drain(), &["press.commit", "key.down"]),
        vec![
            // Root listeners first, innermost first: Enter commits `inner`,
            // and `outer` too, because focus is inside its root.
            root("inner", "press.commit"),
            root("outer", "press.commit"),
            // Window listeners in registration order; only the owner hears
            // the key on its root lease.
            global_key("outer", false),
            global_key("inner", true),
            global_key("sibling", false),
        ]
    );
}

#[gpui::test]
fn with_only_the_host_focused_a_key_reaches_global_leases_alone(cx: &mut TestAppContext) {
    // The host root holds focus, as `document.body` does when nothing is
    // focused: the key arrives, and no instance owns it.
    let mut host = Host::open(cx);
    host.cx.simulate_keystrokes("x");
    assert_eq!(
        only(&host.drain(), &["press.commit", "key.down"]),
        vec![
            global_key("outer", false),
            global_key("inner", false),
            global_key("sibling", false),
        ]
    );
}

#[gpui::test]
fn a_key_without_a_web_spelling_is_reported_rather_than_delivered(cx: &mut TestAppContext) {
    let mut host = Host::open(cx);
    // Constructed directly: the simulated keystroke path would fill
    // `key_char` with the key's own name, which real input does not.
    let keystroke = Keystroke {
        modifiers: Modifiers::default(),
        key: "capslock".into(),
        key_char: None,
    };
    host.cx.update(|window, cx| {
        window.dispatch_event(
            PlatformInput::KeyDown(gpui::KeyDownEvent {
                keystroke,
                is_held: false,
                prefer_character_input: false,
            }),
            cx,
        );
    });
    assert!(host.drain().is_empty());
    assert_eq!(
        host.bridge.borrow().unmapped_keys(),
        ["capslock".to_string()]
    );
}
