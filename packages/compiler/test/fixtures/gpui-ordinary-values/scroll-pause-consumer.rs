//! Separate regression consumer for the emitted GPUI Scroll host.
//! Uses the existing authored validation crate and its real retained ScrollHandle.
//! This no-overflow fixture establishes clamped programmatic request semantics,
//! not content-growth, physical reader movement, OS input or assistive technology.
use gpui::{prelude::*, px, size, Context, Entity, Render, TestAppContext, Window, WindowHandle};
use proto_ui_gpui_native::gpui_native_owner::{
    attach_scroll_surface, record, scroll_pause_following, scroll_request, scroll_snapshot,
    use_builtin_scroll_surface, NativeScrollTarget, OwnerRef, Value,
};
use serde_json::json;
use std::rc::Rc;

struct ScrollHarness {
    component: Entity<validation::CompiledComponent>,
}

impl Render for ScrollHarness {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        gpui::div().size_full().child(self.component.clone())
    }
}

fn frames<T: Render>(window: WindowHandle<T>, cx: &mut TestAppContext) {
    for _ in 0..3 {
        cx.update_window(window.into(), |_, window, cx| {
            window.refresh();
            window.draw(cx).clear(cx);
        })
        .unwrap();
        cx.run_until_parked();
    }
}

fn open(cx: &mut TestAppContext) -> WindowHandle<ScrollHarness> {
    let window = cx.open_window(size(px(600.), px(400.)), |window, cx| ScrollHarness {
        component: validation::CompiledComponent::create(json!({}), None, window, cx)
            .expect("construct unchanged authored validation fixture"),
    });
    window.update(cx, |_, window, _| window.activate_window()).unwrap();
    frames(window, cx);
    window.update(cx, |host, _, cx| {
        let owner = host.component.read(cx).owner.clone();
        let o = owner.borrow();
        assert!(o.mounted && o.present && o.bounds.is_some(), "real view must be attached");
        let handle = o.modules.scroll.handle.as_ref().expect("real ScrollHandle");
        assert_eq!(handle.max_offset().y, px(0.), "fixture is deliberately non-overflowing");
        drop(o);
        assert!(scroll_snapshot(&Rc::downgrade(&owner))
            .member("vertical", false).member("atEnd", false).truthy());
    }).unwrap();
    window
}

fn state(owner: &OwnerRef) -> String {
    scroll_snapshot(&Rc::downgrade(owner))
        .member("endFollow", false).member("state", false).text()
}

fn status(owner: &OwnerRef) -> String {
    scroll_snapshot(&Rc::downgrade(owner))
        .member("endFollow", false).member("requestStatus", false).text()
}

fn assert_unavailable_pause(owner: &OwnerRef) {
    let weak = Rc::downgrade(owner);
    assert_eq!(scroll_snapshot(&weak).member("projection", false).text(), "unresolved");
    let before = state(owner);
    assert_eq!(scroll_request(&weak, record(vec![
        ("kind", Value::string("by")),
        ("axis", Value::string("vertical")),
        ("delta", Value::number(0.)),
    ])).data(), json!({"kind":"rejected","reason":"unavailable"}));
    assert_eq!(scroll_pause_following(&weak).data(),
        json!({"kind":"rejected","reason":"unavailable"}));
    assert_eq!(state(owner), before, "a refused target cannot acquire pause ownership");
}

#[gpui::test]
fn pause_rejects_an_unlaid_retained_target_until_an_explicit_current_surface_returns(cx: &mut TestAppContext) {
    let window = open(cx);
    window.update(cx, |host, window, cx| {
        let owner = host.component.read(cx).owner.clone();
        let target = NativeScrollTarget::new(gpui::ScrollHandle::new());
        let lease = attach_scroll_surface(&Rc::downgrade(&owner), target, window).unwrap();
        assert!(lease.is_current());
        assert_unavailable_pause(&owner);
        drop(lease);
        assert_unavailable_pause(&owner);
        use_builtin_scroll_surface(&Rc::downgrade(&owner)).unwrap();
        pause(&owner);
    }).unwrap();
}

#[gpui::test]
fn pause_cannot_claim_a_target_measured_in_another_native_window(cx: &mut TestAppContext) {
    struct NativeViewport { handle: gpui::ScrollHandle }
    impl Render for NativeViewport {
        fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
            gpui::div().size_full().child(
                gpui::div().id("native-viewport").w(px(120.)).h(px(80.))
                    .overflow_y_scroll().track_scroll(&self.handle)
                    .child(gpui::div().w(px(120.)).h(px(400.)))
            )
        }
    }
    let first = open(cx);
    let other = cx.open_window(size(px(240.), px(180.)), |_, _| NativeViewport { handle: gpui::ScrollHandle::new() });
    frames(other, cx);
    let owner = first.update(cx, |host, _, cx| host.component.read(cx).owner.clone()).unwrap();
    let (lease, handle, before) = other.update(cx, |host, window, cx| {
        let handle = host.handle.clone();
        assert!(handle.bounds().size.width > px(0.) && handle.bounds().size.height > px(0.));
        let before = handle.offset();
        let lease = attach_scroll_surface(&Rc::downgrade(&owner), NativeScrollTarget::new(handle.clone()), window).unwrap();
        (lease, handle, before)
    }).unwrap();
    first.update(cx, |_, _, _| {
        assert_unavailable_pause(&owner);
        assert_eq!(handle.offset(), before, "neither rejected request moves the foreign surface");
        drop(lease);
        use_builtin_scroll_surface(&Rc::downgrade(&owner)).unwrap();
        pause(&owner);
    }).unwrap();
}

fn pause(owner: &OwnerRef) {
    let result = scroll_pause_following(&Rc::downgrade(owner));
    assert_eq!(result.member("kind", false).text(), "dispatched");
    assert_eq!(state(owner), "paused");
}

fn resume(owner: &OwnerRef) {
    // The existing authored method reaches the same generated scroll.request path.
    let method = owner.borrow().exposes.get("scrollEnd").unwrap().clone();
    assert_eq!(method.call(vec![]).expect("authored explicit to-end").text(), "dispatched");
    assert_eq!(status(owner), "pending");
}

fn assert_ordinary_position_preserves_pause(cx: &mut TestAppContext, request: Value) {
    let window = open(cx);
    let before = window.update(cx, |host, _, cx| {
        let owner = host.component.read(cx).owner.clone();
        let before = owner.borrow().modules.scroll.handle.as_ref().unwrap().offset();
        pause(&owner);
        assert_eq!(owner.borrow().modules.scroll.handle.as_ref().unwrap().offset(), before,
            "pause itself must not move the view");
        let result = scroll_request(&Rc::downgrade(&owner), request);
        assert_eq!(result.member("kind", false).text(), "dispatched");
        assert_eq!(owner.borrow().modules.scroll.handle.as_ref().unwrap().offset(), before,
            "the actual handle establishes a boundary-clamped request, not reader arrival");
        assert_eq!(state(&owner), "paused",
            "ordinary programmatic end position cannot revoke an explicit pause");
        before
    }).unwrap();
    frames(window, cx);
    window.update(cx, |host, _, cx| {
        let owner = host.component.read(cx).owner.clone();
        assert_eq!(owner.borrow().modules.scroll.handle.as_ref().unwrap().offset(), before);
        assert_eq!(state(&owner), "paused", "layout at end alone must retain the pause");
    }).unwrap();
}

#[gpui::test]
fn explicit_pause_survives_clamped_programmatic_by_zero(cx: &mut TestAppContext) {
    assert_ordinary_position_preserves_pause(cx, record(vec![
        ("kind", Value::string("by")),
        ("axis", Value::string("vertical")),
        ("delta", Value::number(0.)),
    ]));
}

#[gpui::test]
fn explicit_pause_survives_programmatic_position_at_end(cx: &mut TestAppContext) {
    assert_ordinary_position_preserves_pause(cx, record(vec![
        ("kind", Value::string("to")),
        ("axis", Value::string("vertical")),
        ("position", Value::number(1.)),
    ]));
}

#[gpui::test]
fn pause_cancels_pending_end_until_an_explicit_resume(cx: &mut TestAppContext) {
    let window = open(cx);
    let before = window.update(cx, |host, _, cx| {
        let owner = host.component.read(cx).owner.clone();
        let before = owner.borrow().modules.scroll.handle.as_ref().unwrap().offset();
        resume(&owner);
        assert!(owner.borrow().modules.scroll.pending_end.is_some());
        pause(&owner);
        assert!(owner.borrow().modules.scroll.pending_end.is_none());
        assert_eq!(status(&owner), "rejected");
        assert_eq!(owner.borrow().modules.scroll.handle.as_ref().unwrap().offset(), before);
        before
    }).unwrap();
    frames(window, cx);
    window.update(cx, |host, _, cx| {
        let owner = host.component.read(cx).owner.clone();
        assert_eq!(state(&owner), "paused");
        assert_eq!(status(&owner), "rejected");
        assert_eq!(owner.borrow().modules.scroll.handle.as_ref().unwrap().offset(), before);
        resume(&owner);
        assert_eq!(state(&owner), "paused", "explicit movement is still pending before layout");
    }).unwrap();
    frames(window, cx);
    window.update(cx, |host, _, cx| {
        let owner = host.component.read(cx).owner.clone();
        assert_eq!(state(&owner), "following");
        assert_eq!(status(&owner), "applied");
        assert!(owner.borrow().modules.scroll.pending_end.is_none());
    }).unwrap();
}
