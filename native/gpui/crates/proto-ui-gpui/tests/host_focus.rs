//! Focus facts and focus requests through a real GPUI window.
//!
//! The Focus module learns about focus from `host:focus` and `host:blur` on
//! its root lease (`packages/modules/focus/src/create.ts`), and asks for focus
//! through `focus.request` with the one target the peer declares,
//! `focus-root`. These cases move real GPUI focus and read back both what the
//! router delivered and what status a request would report.
//!
//! Sessions: `a` and `b` render focusable roots; `a` also renders a focusable
//! part that is not a session root; `c` renders a root that cannot take focus.

use std::cell::RefCell;
use std::rc::Rc;

use gpui::prelude::*;
use gpui::{
    div, px, size, AnyWindowHandle, FocusHandle, StyleRefinement, TestAppContext,
    VisualTestContext, WindowHandle,
};
use proto_ui_gpui::host::{
    FocusAction, FocusRequestStatus, InputBridge, ProtoHostView, SurfaceChild, SurfaceNode,
    FOCUS_ROOT_REF,
};
use proto_ui_gpui::input::{Routed, RoutedLease, SessionRoute};
use proto_ui_host_protocol::event_type::EventType;
use proto_ui_host_protocol::wire::EventScope;

fn lease(session: &str, scope: EventScope, kind: &str) -> RoutedLease {
    let scope_name = match scope {
        EventScope::Root => "root",
        EventScope::Global => "global",
    };
    RoutedLease {
        lease_id: format!("{session}:{scope_name}:{kind}"),
        scope,
        event: EventType::parse(kind).expect("a valid type"),
    }
}

fn boxed(left: f32) -> StyleRefinement {
    let mut element = div()
        .absolute()
        .left(px(left))
        .top(px(0.))
        .w(px(40.))
        .h(px(40.));
    element.style().clone()
}

fn surface(
    id: &str,
    session: &str,
    left: f32,
    focus: Option<FocusHandle>,
    children: Vec<SurfaceNode>,
) -> SurfaceNode {
    SurfaceNode {
        id: id.into(),
        session: session.into(),
        style: boxed(left),
        focus,
        children: children.into_iter().map(SurfaceChild::from).collect(),
    }
}

struct Host {
    bridge: Rc<RefCell<InputBridge>>,
    window: WindowHandle<ProtoHostView>,
    part: FocusHandle,
}

impl Host {
    fn open(cx: &mut TestAppContext) -> Self {
        let bridge = Rc::new(RefCell::new(InputBridge::new()));
        for session in ["a", "b", "c"] {
            bridge.borrow_mut().upsert_session(SessionRoute {
                session_id: session.into(),
                root: session.into(),
                view_epoch: 1,
                leases: vec![
                    lease(session, EventScope::Root, "host:focus"),
                    lease(session, EventScope::Root, "host:blur"),
                    // Registered, and never fired: host events are root-only.
                    lease(session, EventScope::Global, "host:focus"),
                ],
            });
        }
        let (a, b, part) =
            cx.update(|cx| (cx.focus_handle(), cx.focus_handle(), cx.focus_handle()));
        let surfaces = vec![
            surface(
                "a",
                "a",
                0.,
                Some(a),
                vec![surface("a-part", "a", 5., Some(part.clone()), vec![])],
            ),
            surface("b", "b", 100., Some(b), vec![]),
            surface("c", "c", 200., None, vec![]),
        ];
        let view_bridge = bridge.clone();
        let window = cx.open_window(size(px(400.), px(100.)), move |window, cx| {
            let view = ProtoHostView::new(view_bridge, surfaces, window, cx);
            window.focus(view.focus_handle(), cx);
            view
        });
        let host = Self {
            bridge,
            window,
            part,
        };
        // Test windows start inactive, and GPUI reports no focus movement in
        // an inactive window, as a browser reports none in a background one.
        host.set_active(cx, true);
        host.drain();
        host
    }

    fn set_active(&self, cx: &mut TestAppContext, active: bool) {
        if active {
            self.window
                .update(cx, |_, window, _| window.activate_window())
                .expect("the view updates");
        } else {
            VisualTestContext::from_window(AnyWindowHandle::from(self.window), cx)
                .deactivate_window();
        }
        cx.run_until_parked();
        self.draw(cx);
    }

    /// Focus listeners run in the focus phase of a draw.
    fn draw(&self, cx: &mut TestAppContext) {
        cx.update_window(AnyWindowHandle::from(self.window), |_, window, cx| {
            window.draw(cx).clear(cx)
        })
        .expect("the window draws");
    }

    fn request(
        &self,
        cx: &mut TestAppContext,
        session: &str,
        target: &str,
        action: FocusAction,
    ) -> FocusRequestStatus {
        let status = self
            .window
            .update(cx, |view, window, cx| {
                view.request_focus(session, target, action, window, cx)
            })
            .expect("the view updates");
        self.draw(cx);
        status
    }

    fn drain(&self) -> Vec<Routed> {
        self.bridge.borrow_mut().drain()
    }
}

fn summary(routed: &[Routed]) -> Vec<(String, String, Vec<String>)> {
    routed
        .iter()
        .map(|routed| {
            (
                routed.session_id.clone(),
                routed.sample.kind.clone(),
                routed.sample.lease_ids.clone(),
            )
        })
        .collect()
}

fn fact(session: &str, kind: &str) -> (String, String, Vec<String>) {
    (
        session.into(),
        kind.into(),
        vec![format!("{session}:root:{kind}")],
    )
}

#[gpui::test]
fn focusing_a_session_reports_host_focus_on_its_root_lease_only(cx: &mut TestAppContext) {
    let host = Host::open(cx);
    assert!(
        host.drain().is_empty(),
        "the host root holding focus is no fact"
    );

    let status = host.request(cx, "a", FOCUS_ROOT_REF, FocusAction::Focus);
    assert_eq!(status, FocusRequestStatus::Applied);
    let routed = host.drain();
    assert_eq!(summary(&routed), vec![fact("a", "host:focus")]);

    // A focus change has no key and no modifiers; the sample claims none.
    let sample = &routed[0].sample;
    assert_eq!(sample.key, None);
    assert_eq!(sample.ctrl_key, None);
    assert_eq!(sample.shift_key, None);
    assert_eq!(sample.repeat, None);
}

#[gpui::test]
fn moving_focus_between_sessions_blurs_before_it_focuses(cx: &mut TestAppContext) {
    let host = Host::open(cx);
    host.request(cx, "a", FOCUS_ROOT_REF, FocusAction::Focus);
    host.drain();

    host.request(cx, "b", FOCUS_ROOT_REF, FocusAction::Focus);
    assert_eq!(
        summary(&host.drain()),
        vec![fact("a", "host:blur"), fact("b", "host:focus")]
    );
}

#[gpui::test]
fn blurring_hands_focus_back_to_the_host(cx: &mut TestAppContext) {
    let host = Host::open(cx);
    host.request(cx, "a", FOCUS_ROOT_REF, FocusAction::Focus);
    host.drain();

    let status = host.request(cx, "a", FOCUS_ROOT_REF, FocusAction::Blur);
    assert_eq!(status, FocusRequestStatus::Applied);
    assert_eq!(summary(&host.drain()), vec![fact("a", "host:blur")]);

    // The host root holds focus again, so keys keep arriving.
    let host_focused = host
        .window
        .update(cx, |view, window, _| view.focus_handle().is_focused(window))
        .expect("the view reads");
    assert!(host_focused);
}

#[gpui::test]
fn focus_moving_to_a_part_blurs_its_instance_and_focuses_nobody(cx: &mut TestAppContext) {
    // A browser fires `blur` on an element when focus moves to one of its
    // descendants, and `focus` does not bubble up to the root from the part.
    let host = Host::open(cx);
    host.request(cx, "a", FOCUS_ROOT_REF, FocusAction::Focus);
    host.drain();

    let part = host.part.clone();
    host.window
        .update(cx, |_, window, cx| window.focus(&part, cx))
        .expect("the view updates");
    host.draw(cx);
    assert_eq!(summary(&host.drain()), vec![fact("a", "host:blur")]);
}

#[gpui::test]
fn a_request_for_another_target_is_rejected_and_moves_nothing(cx: &mut TestAppContext) {
    let host = Host::open(cx);
    let status = host.request(cx, "a", "somewhere-else", FocusAction::Focus);
    assert_eq!(status, FocusRequestStatus::Rejected);
    assert!(host.drain().is_empty());
}

#[gpui::test]
fn a_request_before_the_session_renders_is_not_ready(cx: &mut TestAppContext) {
    // The peer keeps a not-ready request and retries on readiness.
    let host = Host::open(cx);
    let status = host.request(cx, "unrendered", FOCUS_ROOT_REF, FocusAction::Focus);
    assert_eq!(status, FocusRequestStatus::NotReady);
}

#[gpui::test]
fn a_root_that_cannot_take_focus_rejects_the_request(cx: &mut TestAppContext) {
    let host = Host::open(cx);
    let status = host.request(cx, "c", FOCUS_ROOT_REF, FocusAction::Focus);
    assert_eq!(status, FocusRequestStatus::Rejected);
    assert!(host.drain().is_empty());
}

#[gpui::test]
fn a_focus_that_does_not_land_is_rejected_not_reported_applied(cx: &mut TestAppContext) {
    // `HC-FOCUS-TARGET-0001-B`: a request that did not move focus must say so.
    // With focus disabled on the window, GPUI ignores the request.
    let host = Host::open(cx);
    host.window
        .update(cx, |_, window, cx| window.disable_focus(cx))
        .expect("the view updates");
    let status = host.request(cx, "a", FOCUS_ROOT_REF, FocusAction::Focus);
    assert_eq!(status, FocusRequestStatus::Rejected);
}

#[gpui::test]
fn blurring_a_target_that_is_not_focused_changes_nothing(cx: &mut TestAppContext) {
    let host = Host::open(cx);
    let status = host.request(cx, "b", FOCUS_ROOT_REF, FocusAction::Blur);
    assert_eq!(status, FocusRequestStatus::Applied);
    assert!(host.drain().is_empty());
}

#[gpui::test]
fn the_window_losing_activation_blurs_the_focused_session_and_regaining_it_refocuses(
    cx: &mut TestAppContext,
) {
    // A browser fires `blur` on the focused element when its window loses
    // activation, and `focus` again when the window comes back.
    let host = Host::open(cx);
    host.request(cx, "a", FOCUS_ROOT_REF, FocusAction::Focus);
    host.drain();

    host.set_active(cx, false);
    assert_eq!(summary(&host.drain()), vec![fact("a", "host:blur")]);

    host.set_active(cx, true);
    assert_eq!(summary(&host.drain()), vec![fact("a", "host:focus")]);
}
