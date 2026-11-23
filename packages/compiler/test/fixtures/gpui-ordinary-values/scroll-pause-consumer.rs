//! Separate regression consumer for the emitted GPUI Scroll host.
//! Uses the existing authored validation crate and its real retained ScrollHandle.
//! This no-overflow fixture establishes clamped programmatic request semantics,
//! not content-growth, physical reader movement, OS input or assistive technology.
use gpui::{prelude::*, px, size, Context, Entity, Render, TestAppContext, Window, WindowHandle};
use proto_ui_gpui_native::gpui_native_owner::{
    record, scroll_pause_following, scroll_request, scroll_snapshot, OwnerRef, Value,
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

fn frames(window: WindowHandle<ScrollHarness>, cx: &mut TestAppContext) {
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
