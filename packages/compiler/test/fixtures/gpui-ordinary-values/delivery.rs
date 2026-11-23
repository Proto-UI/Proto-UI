//! Published source methods and Props watchers run through the actual generated component.
//! The observer is a real GPUI Entity observer; no manual polling substitutes for delivery.
use gpui::{prelude::*, px, size, Context, Entity, Render, TestAppContext, Window, WindowHandle};
use proto_ui_gpui_native::gpui_native_owner::Value;
use serde_json::{json, Value as Json};

struct Host {
    target: Entity<validation::CompiledComponent>,
    notifications: usize,
    events: Vec<(String, Json)>,
    drain: bool,
    _observation: gpui::Subscription,
}
impl Render for Host {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        gpui::div().size_full().child(self.target.clone())
    }
}
fn frames(window: WindowHandle<Host>, cx: &mut TestAppContext) {
    for _ in 0..3 {
        cx.update_window(window.into(), |_, window, cx| {
            window.refresh();
            window.draw(cx).clear(cx);
        }).unwrap();
        cx.run_until_parked();
    }
}
fn open(cx: &mut TestAppContext, drain: bool) -> WindowHandle<Host> {
    let window = cx.open_window(size(px(160.), px(80.)), move |window, cx| {
        let target = validation::CompiledComponent::create(json!({}), None, window, cx).unwrap();
        let observation = cx.observe(&target, |host: &mut Host, target, cx| {
            host.notifications += 1;
            if host.drain { host.events.extend(target.read(cx).handle().take_events()); }
        });
        Host { target, notifications: 0, events: Vec::new(), drain, _observation: observation }
    });
    frames(window, cx);
    window.update(cx, |host, _, _| { host.notifications = 0; host.events.clear(); }).unwrap();
    window
}
fn expect_once(window: WindowHandle<Host>, cx: &mut TestAppContext, value: f64) {
    // There is no unrelated draw, request_update, direct drive or take_events:
    // the failed public operation itself must wake the retained consumer.
    cx.run_until_parked();
    window.update(cx, |host, _, _| {
        assert_eq!(host.notifications, 1, "the published output wakes a retained observer once");
        assert_eq!(host.events, vec![("renderRequest".into(), json!({"value": value}))]);
    }).unwrap();
    frames(window, cx);
    window.update(cx, |host, _, _| {
        assert_eq!(host.notifications, 1, "later physical draws cannot replay a delivered event");
        assert_eq!(host.events.len(), 1);
    }).unwrap();
}
#[gpui::test]
fn props_emit_then_throw_keeps_false_and_notifies_without_another_input(cx: &mut TestAppContext) {
    let window = open(cx, true);
    window.update(cx, |host, window, cx| {
        let error = host.target.update(cx, |target, cx| {
            target.set_props(json!({"value": 13}), window, cx)
        }).unwrap_err();
        assert!(matches!(error, Value::Json(Json::Bool(false))),
            "the original falsy Props watcher error survives notification scheduling");
        assert_eq!(host.notifications, 0, "observer effects run after the native lease returns");
    }).unwrap();
    expect_once(window, cx, 13.);
}
#[gpui::test]
fn method_emit_then_throw_keeps_zero_and_notifies_without_another_input(cx: &mut TestAppContext) {
    let window = open(cx, true);
    window.update(cx, |host, window, cx| {
        let error = host.target.read(cx).handle().call("emitThenThrow", vec![], window, cx).unwrap_err();
        assert_eq!(error.num(), 0., "the authored exception is not replaced by a host error");
        assert_eq!(host.notifications, 0);
    }).unwrap();
    expect_once(window, cx, 21.);
}
#[gpui::test]
fn typed_method_emit_then_throw_keeps_zero_and_notifies_without_another_input(cx: &mut TestAppContext) {
    let window = open(cx, true);
    window.update(cx, |host, window, cx| {
        // The retained source exposes renderRequest, emitOnly, then emitThenThrow.
        // Exercise its generated typed Rust entry as well as Handle::call.
        let error = host.target.read(cx).handle().method_2(window, cx).unwrap_err();
        assert_eq!(error.num(), 0.);
        assert_eq!(host.notifications, 0);
    }).unwrap();
    expect_once(window, cx, 21.);
}
#[gpui::test]
fn undrained_event_backlog_does_not_repeat_observer_notifications(cx: &mut TestAppContext) {
    let window = open(cx, false);
    for value in [1., 2.] {
        window.update(cx, |host, window, cx| {
            host.target.read(cx).handle().call("emitOnly", vec![json!(value)], window, cx).unwrap();
        }).unwrap();
        cx.run_until_parked();
        window.update(cx, |host, _, _| assert_eq!(host.notifications, value as usize)).unwrap();
        frames(window, cx);
        window.update(cx, |host, _, _| assert_eq!(host.notifications, value as usize,
            "an unread queue is not a request for another notification")).unwrap();
    }
    window.update(cx, |host, _, cx| {
        assert_eq!(host.target.read(cx).handle().take_events(), vec![
            ("renderRequest".into(), json!({"value": 1.})),
            ("renderRequest".into(), json!({"value": 2.})),
        ]);
    }).unwrap();
}
#[gpui::test]
fn terminal_owner_delivers_already_published_output_once(cx: &mut TestAppContext) {
    let window = open(cx, true);
    window.update(cx, |host, window, cx| {
        let handle = host.target.read(cx).handle();
        handle.call("emitOnly", vec![json!(9)], window, cx).unwrap();
        handle.dispose(window, cx).unwrap();
    }).unwrap();
    expect_once(window, cx, 9.);
}
