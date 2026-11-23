//! Real GPUI dispatch, with no application Tab traversal handler.
use gpui::{prelude::*, px, size, Context, Entity, FocusHandle, Focusable, IntoElement,
    KeyBinding, Render, TestAppContext, VisualTestContext, Window, WindowHandle};
use proto_ui_gpui_native::gpui_native_owner::{NativeSnapshot, Value};
use serde_json::json;
use std::rc::Rc;

gpui::actions!(sequential_focus, [Prefix, Longer]);

#[derive(Clone, Copy, PartialEq, Eq)]
enum Guard { Pass, Prevent, Stop, DisableNext, SkipNext, RemoveNext }
#[derive(Clone, Copy, Debug)]
enum At { First, Second, Raw, Text, Last }

struct ScopeBody { first: Entity<tab_focus::CompiledComponent>, second: Entity<tab_focus::CompiledComponent> }
impl Render for ScopeBody {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        gpui::div().size_full().flex().flex_col()
            .child(gpui::div().w(px(160.)).h(px(32.)).child(self.first.clone()))
            .child(gpui::div().w(px(160.)).h(px(32.)).child(self.second.clone()))
    }
}
struct Harness {
    first: Entity<tab_focus::CompiledComponent>, second: Entity<tab_focus::CompiledComponent>,
    disabled: Entity<tab_focus::CompiledComponent>, skipped: Entity<tab_focus::CompiledComponent>,
    last: Entity<tab_focus::CompiledComponent>, text: Entity<text::CompiledComponent>,
    scope: Entity<tab_scope::CompiledComponent>, raw: FocusHandle,
    guard: Guard, show_second: bool, trapped: bool, bubbled: usize, prefix_hits: usize,
}
impl Harness {
    fn focus_handle(&self, at: At, cx: &gpui::App) -> FocusHandle {
        match at {
            At::First => self.first.read(cx).focus_handle(cx),
            At::Second => self.second.read(cx).focus_handle(cx),
            At::Raw => self.raw.clone(),
            At::Text => self.text.read(cx).focus_handle(cx),
            At::Last => self.last.read(cx).focus_handle(cx),
        }
    }
}
impl Render for Harness {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let mut root = gpui::div().id("sequential-root").key_context("SequentialFocus")
            .size_full().flex().flex_col()
            .on_key_down(cx.listener(|this, event: &gpui::KeyDownEvent, window, cx| {
                if event.keystroke.key != "tab" { return; }
                this.bubbled += 1;
                match this.guard {
                    Guard::Pass => {},
                    Guard::Prevent => window.prevent_default(),
                    Guard::Stop => cx.stop_propagation(),
                    Guard::DisableNext | Guard::SkipNext => {
                        let disabled = this.guard == Guard::DisableNext;
                        this.second.update(cx, |target, cx| target.set_props(
                            json!({"disabled": disabled, "participates": disabled}), window, cx)
                            .unwrap_or_else(|_| panic!("native key updates the next source projection")));
                    },
                    Guard::RemoveNext => {
                        this.second.read(cx).handle().dispose(window, cx)
                            .unwrap_or_else(|_| panic!("native key disposes the next target"));
                        this.show_second = false; cx.notify();
                    },
                }
            }))
            .on_action(cx.listener(|this, _: &Prefix, _, _| this.prefix_hits += 1))
            .on_action(cx.listener(|this, _: &Longer, _, _| this.prefix_hits += 10));
        if self.trapped {
            root = root.child(gpui::div().w(px(160.)).h(px(64.)).child(self.scope.clone()));
        } else {
            root = root.child(gpui::div().w(px(160.)).h(px(32.)).child(self.first.clone()));
            if self.show_second {
                root = root.child(gpui::div().w(px(160.)).h(px(32.)).child(self.second.clone()));
            }
        }
        root.child(gpui::div().w(px(160.)).h(px(32.)).child(self.disabled.clone()))
            .child(gpui::div().w(px(160.)).h(px(32.)).child(self.skipped.clone()))
            .child(gpui::div().id("foreign-native").track_focus(&self.raw).w(px(160.)).h(px(32.)).child("Native sibling"))
            .child(gpui::div().w(px(160.)).h(px(32.)).child(self.text.clone()))
            .child(gpui::div().w(px(160.)).h(px(32.)).child(self.last.clone()))
    }
}
fn open(cx: &mut TestAppContext, trapped: bool) -> WindowHandle<Harness> {
    let handle = cx.open_window(size(px(240.), px(280.)), |window, cx| {
        let scope = tab_scope::CompiledComponent::create(json!({}), None, window, cx)
            .unwrap_or_else(|_| panic!("native scope"));
        let parent = Rc::downgrade(&scope.read(cx).owner);
        let first = tab_focus::CompiledComponent::create(json!({}), Some(parent.clone()), window, cx)
            .unwrap_or_else(|_| panic!("first target"));
        let second = tab_focus::CompiledComponent::create(json!({}), Some(parent), window, cx)
            .unwrap_or_else(|_| panic!("second target"));
        let body = cx.new(|_| ScopeBody { first: first.clone(), second: second.clone() });
        scope.update(cx, |scope, cx| scope.set_slot(vec![NativeSnapshot::native_view(body.into())], cx)
            .unwrap_or_else(|_| panic!("native scope contents")));
        let disabled = tab_focus::CompiledComponent::create(json!({"disabled":true}), None, window, cx)
            .unwrap_or_else(|_| panic!("disabled target"));
        let skipped = tab_focus::CompiledComponent::create(json!({"participates":false}), None, window, cx)
            .unwrap_or_else(|_| panic!("roving nonentry target"));
        let last = tab_focus::CompiledComponent::create(json!({}), None, window, cx)
            .unwrap_or_else(|_| panic!("last target"));
        let text = text::CompiledComponent::create(json!({}), None, window, cx)
            .unwrap_or_else(|_| panic!("text target"));
        text.update(cx, |text, cx| text.set_slot(vec![NativeSnapshot::text_value(Value::string("Editable"))], cx)
            .unwrap_or_else(|_| panic!("native input contents")));
        Harness { first, second, disabled, skipped, last, text, scope, raw: cx.focus_handle().tab_stop(true),
            guard: Guard::Pass, show_second: true, trapped, bubbled: 0, prefix_hits: 0 }
    });
    handle.update(cx, |_, window, _| window.activate_window()).unwrap();
    handle
}
fn frames(cx: &mut VisualTestContext) {
    for _ in 0..3 { cx.update(|window, cx| { window.refresh(); window.draw(cx).clear(cx); }); cx.run_until_parked(); }
}
fn focus(window: WindowHandle<Harness>, cx: &mut VisualTestContext, at: At) {
    window.update(cx, |host, window, cx| { assert!(window.is_window_active(), "real active-window prerequisite"); let focus = host.focus_handle(at, cx); window.focus(&focus, cx); }).unwrap();
    frames(cx);
}
fn assert_at(window: WindowHandle<Harness>, cx: &mut VisualTestContext, at: At) {
    window.update(cx, |host, window, cx| assert_eq!(window.focused(cx), Some(host.focus_handle(at, cx)), "focus at {at:?}")).unwrap();
}
fn key(window: WindowHandle<Harness>, cx: &mut VisualTestContext, key: &str, at: At) {
    cx.simulate_keystrokes(key); assert_at(window, cx, at); frames(cx);
}

#[gpui::test]
fn native_tab_traverses_both_directions_and_foreign_siblings(cx: &mut TestAppContext) {
    let window = open(cx, false); let mut visual = VisualTestContext::from_window(window.into(), cx); frames(&mut visual);
    focus(window, &mut visual, At::First);
    for at in [At::Second, At::Raw, At::Text, At::Last, At::First] { key(window, &mut visual, "tab", at); }
    for at in [At::Last, At::Text, At::Raw, At::Second, At::First] { key(window, &mut visual, "shift-tab", at); }
    window.update(&mut visual, |host, window, cx| {
        assert_eq!(host.bubbled, 10, "one physical dispatch per key, with no fixture traversal");
        assert_eq!(host.first.read(cx).handle().state("focusVisible").unwrap_or_else(|_| panic!("focus fact")), json!(true));
        window.blur(cx);
    }).unwrap();
    key(window, &mut visual, "tab", At::First);
    focus(window, &mut visual, At::Raw); key(window, &mut visual, "shift-tab", At::Second);
}

#[gpui::test]
fn native_tab_waits_for_source_and_late_host_policies(cx: &mut TestAppContext) {
    let window = open(cx, false); let mut visual = VisualTestContext::from_window(window.into(), cx); frames(&mut visual);
    for guard in [Guard::Prevent, Guard::Stop] {
        focus(window, &mut visual, At::First);
        window.update(&mut visual, |host, _, _| host.guard = guard).unwrap();
        key(window, &mut visual, "tab", At::First);
        window.update(&mut visual, |host, _, _| host.guard = Guard::Pass).unwrap();
        key(window, &mut visual, "tab", At::Second);
    }
    focus(window, &mut visual, At::First);
    window.update(&mut visual, |host, window, cx| host.first.update(cx, |target, cx|
        target.set_props(json!({"blockTab":true}), window, cx).unwrap_or_else(|_| panic!("source Tab policy")))).unwrap();
    frames(&mut visual); key(window, &mut visual, "tab", At::First);
    window.update(&mut visual, |host, window, cx| host.first.update(cx, |target, cx|
        target.set_props(json!({}), window, cx).unwrap_or_else(|_| panic!("release source policy")))).unwrap();
    frames(&mut visual); key(window, &mut visual, "tab", At::Second);
}

#[gpui::test]
fn native_tab_revalidates_current_projection_without_reordering(cx: &mut TestAppContext) {
    for guard in [Guard::DisableNext, Guard::SkipNext, Guard::RemoveNext] {
        let window = open(cx, false); let mut visual = VisualTestContext::from_window(window.into(), cx); frames(&mut visual);
        focus(window, &mut visual, At::First);
        window.update(&mut visual, |host, _, _| host.guard = guard).unwrap();
        // The raw handler changes the next target after the last drawn tab map.
        // There is intentionally no frame between mutation and default action.
        key(window, &mut visual, "tab", At::Raw);
        window.update(&mut visual, |host, _, _| host.guard = Guard::Pass).unwrap();
        key(window, &mut visual, "shift-tab", At::First);
    }
}

#[gpui::test]
fn native_tab_keeps_trap_and_text_ime_boundaries(cx: &mut TestAppContext) {
    use gpui::InputHandler;
    use proto_ui_gpui_native::gpui_native_owner::native_text_input_for_test;
    let window = open(cx, true); let mut visual = VisualTestContext::from_window(window.into(), cx); frames(&mut visual);
    window.update(&mut visual, |host, window, cx| host.scope.read(cx).handle().call("activate", vec![], window, cx)
        .unwrap_or_else(|_| panic!("activate trap"))).unwrap();
    focus(window, &mut visual, At::First);
    key(window, &mut visual, "shift-tab", At::Second); key(window, &mut visual, "tab", At::First);
    window.update(&mut visual, |host, _, _| host.guard = Guard::Prevent).unwrap();
    key(window, &mut visual, "tab", At::First);
    window.update(&mut visual, |host, window, cx| {
        host.guard = Guard::Pass;
        host.scope.read(cx).handle().call("deactivate", vec![], window, cx).unwrap_or_else(|_| panic!("release trap"));
    }).unwrap();
    focus(window, &mut visual, At::Text);
    key(window, &mut visual, "tab", At::Last);
    window.update(&mut visual, |host, window, cx| {
        assert_eq!(host.text.read(cx).handle().call("value", vec![], window, cx).unwrap_or_else(|_| panic!("input value")), json!("seed"),
            "handled physical Tab must not reach the old platform input handler");
    }).unwrap();
    focus(window, &mut visual, At::Text);
    window.update(&mut visual, |host, window, cx| {
        let owner = host.text.read(cx).owner.clone();
        let mut input = native_text_input_for_test(&owner, window).expect("live production IME lease");
        input.replace_and_mark_text_in_range(None, "候", Some(1..1), window, cx);
    }).unwrap();
    key(window, &mut visual, "tab", At::Text);
    window.update(&mut visual, |host, window, cx| {
        assert_eq!(host.text.read(cx).handle().call("composing", vec![], window, cx).unwrap_or_else(|_| panic!("IME fact")), json!(true));
    }).unwrap();
}

#[gpui::test]
fn native_tab_survives_replayed_prefix_actions(cx: &mut TestAppContext) {
    for same_key in [false, true] {
        cx.update(|cx| cx.bind_keys(if same_key {
            vec![KeyBinding::new("g tab", Prefix, Some("SequentialFocus")), KeyBinding::new("g tab x", Longer, Some("SequentialFocus"))]
        } else {
            vec![KeyBinding::new("g", Prefix, Some("SequentialFocus")), KeyBinding::new("g h", Longer, Some("SequentialFocus"))]
        }));
        let window = open(cx, false); let mut visual = VisualTestContext::from_window(window.into(), cx); frames(&mut visual);
        focus(window, &mut visual, At::First);
        visual.simulate_keystrokes(if same_key { "g tab tab" } else { "g tab" });
        assert_at(window, &mut visual, At::Second);
        window.update(&mut visual, |host, _, _| assert_eq!(host.prefix_hits, 1)).unwrap();
    }
}

#[gpui::test]
fn native_tab_registry_is_app_scoped(cx: &mut TestAppContext) {
    let other = open(cx, false); let mut first = VisualTestContext::from_window(other.into(), cx); frames(&mut first);
    focus(other, &mut first, At::First);
    let mut next_app = cx.new_app();
    let window = open(&mut next_app, false); let mut second = VisualTestContext::from_window(window.into(), &next_app); frames(&mut second);
    focus(window, &mut second, At::First);
    // Per-App WindowId and FocusId allocators start at the same values.
    // The old App's same-ID owner must not become a witness or drive target.
    other.update(&mut first, |host, window, cx| host.first.read(cx).handle().dispose(window, cx)
        .unwrap_or_else(|_| panic!("retire owner in another App"))).unwrap();
    key(window, &mut second, "tab", At::Second);
    key(window, &mut second, "shift-tab", At::First);
}

#[gpui::test]
fn native_focus_registry_changes_only_for_a_new_physical_binding(cx: &mut TestAppContext) {
    use proto_ui_gpui_native::gpui_native_owner::{detach_native_view, observe_native_focus_registry_for_test};
    let window = open(cx, false); let mut visual = VisualTestContext::from_window(window.into(), cx); frames(&mut visual);
    let changes = Rc::new(std::cell::Cell::new(0)); let observed = changes.clone();
    let _observation = visual.update(|_, cx| observe_native_focus_registry_for_test(cx, move |_| observed.set(observed.get() + 1)));
    visual.run_until_parked();
    // Exercise the real generated Props/drive/render path repeatedly. The
    // stable native target must not publish registry changes as side effects.
    for block in [true, false, true, false] {
        window.update(&mut visual, |host, window, cx| host.first.update(cx, |target, cx|
            target.set_props(json!({"blockTab":block}), window, cx).unwrap_or_else(|_| panic!("real source update")))).unwrap();
        frames(&mut visual);
    }
    assert_eq!(changes.get(), 0, "stable drives must not mutate or notify the App focus registry");
    let epoch = window.update(&mut visual, |host, window, cx| {
        let owner = host.first.read(cx).owner.clone();
        let epoch = owner.borrow().epoch;
        // Withdraw the physical view through the production SDK lifecycle,
        // then let the retained generated component bind its next real frame.
        detach_native_view(&owner); window.refresh(); epoch
    }).unwrap();
    frames(&mut visual);
    window.update(&mut visual, |host, _, cx| {
        let owner = host.first.read(cx).owner.borrow();
        assert!(owner.mounted && owner.bounds.is_some() && owner.epoch != epoch);
    }).unwrap();
    assert!(changes.get() > 0, "a genuinely new view binding must refresh its receipt");
    changes.set(0);
    frames(&mut visual);
    assert_eq!(changes.get(), 0, "the replacement also settles after its binding is registered");
}
