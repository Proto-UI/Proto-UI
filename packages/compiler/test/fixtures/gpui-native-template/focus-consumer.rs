//! Current generated Scope/Entry consumers using GPUI's test platform, not an OS display.
//! Compile the authored region/target exports with one shared SDK; see README.md.
use generated_gpui_component::CompiledComponent;
use gpui::{prelude::*, point, px, size, AnyView, AnyWindowHandle, App, Context, Entity,
    FocusHandle, Focusable, Modifiers, MouseButton, Render, TestAppContext, VisualTestContext,
    Window, WindowHandle};
use proto_ui_gpui_native::gpui_native_owner::{invoke, NativeSnapshot, OwnerRef, Value};
use serde_json::{json, Value as Json};
use std::rc::Rc;

type Call = Rc<dyn Fn(&str, Vec<Json>, &mut Window, &mut App) -> Json>;
struct Region {
    view: AnyView,
    owner: OwnerRef,
    focus: FocusHandle,
    call: Call,
    slot: Rc<dyn Fn(Vec<NativeSnapshot>, &mut App)>,
}
#[derive(Clone, Copy)]
enum Policy { Owned, Manual, Default, Container }

struct NativeChild { focus: FocusHandle }
impl Render for NativeChild {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        gpui::div().id("ordinary-native-child").w(px(40.)).h(px(40.)).track_focus(&self.focus)
    }
}
struct Harness {
    region: Region,
    target: Entity<focus_target::CompiledComponent>,
    replacement: Entity<focus_target::CompiledComponent>,
    native: Entity<NativeChild>,
    text: Option<Entity<focus_text::CompiledComponent>>,
    outside: FocusHandle,
    outside_view: Entity<focus_target::CompiledComponent>,
    show_region: bool,
}
impl Harness {
    fn new(policy: Policy, logical: bool, text: bool, window: &mut Window, cx: &mut Context<Self>) -> Self {
        macro_rules! region {
            ($component:ty) => {{
                let entity = cx.new(|cx| <$component>::new(json!({}), None, window, cx));
                let handle = entity.read(cx).handle();
                let owner = handle.owner.clone();
                let focus = entity.read(cx).focus_handle(cx);
                let slot_entity = entity.clone();
                Region { view: AnyView::from(entity), owner, focus,
                    call: Rc::new(move |name, args, window, cx| handle.call(name, args, window, cx)),
                    slot: Rc::new(move |children, cx| slot_entity.update(cx, |view, cx| view.set_slot(children, cx))) }
            }};
        }
        let region = match policy {
            Policy::Owned => region!(CompiledComponent),
            Policy::Manual => region!(focus_manual::CompiledComponent),
            Policy::Default => region!(focus_default::CompiledComponent),
            Policy::Container => region!(focus_container::CompiledComponent),
        };
        let parent = logical.then(|| Rc::downgrade(&region.owner));
        let target = cx.new(|cx| focus_target::CompiledComponent::new(json!({}), parent.clone(), window, cx));
        let replacement = cx.new(|cx| focus_target::CompiledComponent::new(json!({}), parent, window, cx));
        let native = cx.new(|cx| NativeChild { focus: cx.focus_handle() });
        let text = text.then(|| cx.new(|cx| focus_text::CompiledComponent::new(json!({}), None, window, cx)));
        let outside_view = cx.new(|cx| focus_target::CompiledComponent::new(json!({}), None, window, cx));
        let outside = outside_view.read(cx).focus_handle(cx);
        Self { region, target, replacement, native, text, outside, outside_view, show_region: true }
    }
    fn request(&self, name: &str, args: Vec<Json>, window: &mut Window, cx: &mut App) -> Json {
        (self.region.call)(name, args, window, cx)
    }
    fn children(&self, target: bool, replacement: bool, native: bool, cx: &mut App) {
        let mut children = Vec::new();
        if target { children.push(NativeSnapshot::native_view(AnyView::from(self.target.clone()))); }
        if replacement { children.push(NativeSnapshot::native_view(AnyView::from(self.replacement.clone()))); }
        if native { children.push(NativeSnapshot::native_view(AnyView::from(self.native.clone()))); }
        (self.region.slot)(children, cx);
    }
    fn target_call(&self, name: &str, args: Vec<Json>, window: &mut Window, cx: &mut App) {
        self.target.read(cx).handle().call(name, args, window, cx);
    }
}
impl Render for Harness {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        let mut root = gpui::div().size_full().child(self.outside_view.clone());
        if self.show_region { root = root.child(self.region.view.clone()); }
        if let Some(text) = &self.text { root = root.child(text.clone()); }
        root
    }
}
fn open(cx: &mut TestAppContext, policy: Policy, logical: bool, text: bool) -> WindowHandle<Harness> {
    let window = cx.open_window(size(px(400.), px(300.)), |window, cx| Harness::new(policy, logical, text, window, cx));
    window.update(cx, |_, window, _| window.activate_window()).unwrap();
    cx.run_until_parked();
    window
}
fn frames(cx: &mut VisualTestContext) {
    for _ in 0..3 {
        cx.update(|window, cx| { window.refresh(); window.draw(cx).clear(cx); });
        cx.run_until_parked();
    }
}
fn outside(window: WindowHandle<Harness>, cx: &mut VisualTestContext) {
    // The outside focus goes through the actual compiled Focusable request path, so the
    // ordinary owner fact and the Scope previous-owner capture are the real ones.
    window.update(cx, |host, window, cx| host.outside_view.read(cx).handle().call("focus", vec![json!({"reason":"pointer"})], window, cx)).unwrap();
    cx.run_until_parked();
}
fn assert_outside(window: WindowHandle<Harness>, cx: &mut VisualTestContext) {
    window.update(cx, |host, window, _| assert!(host.outside.is_focused(window))).unwrap();
}

#[gpui::test]
fn empty_owned_entry_acquires_self_without_declaring_target_membership(cx: &mut TestAppContext) {
    let window = open(cx, Policy::Owned, false, false);
    let mut visual = VisualTestContext::from_window(AnyWindowHandle::from(window), cx);
    frames(&mut visual);
    outside(window, &mut visual);
    window.update(&mut visual, |host, window, cx| {
        host.request("activate", vec![json!({"reason":"keyboard","preventScroll":true})], window, cx);
        assert!(host.region.focus.is_focused(window));
        let owner = host.region.owner.borrow();
        assert!(!owner.focusable, "an entry region does not declare Focusable membership");
        assert!(!owner.modules.focus.roving_declared, "an entry region does not declare roving membership");
        assert!(owner.focused, "the permitted self fallback is the actual native focus target");
        assert!(!owner.modules.focus.scope_active, "empty:none is independent of acquired Entry focus");
        assert_eq!(owner.modules.focus.reason, "keyboard");
        assert!(owner.modules.focus.prevent_scroll);
    }).unwrap();
    // A later ordinary native focus transfer must not be stolen by another frame.
    outside(window, &mut visual);
    frames(&mut visual);
    assert_outside(window, &mut visual);
}

#[gpui::test]
fn omitted_fallback_and_both_manual_forms_preserve_outside_focus(cx: &mut TestAppContext) {
    for (policy, options) in [(Policy::Default, vec![json!({})]),
        (Policy::Owned, vec![json!({"entry":"manual"})]),
        (Policy::Manual, vec![json!({"entry":"configured"})])] {
        let window = open(cx, policy, false, false);
        let mut visual = VisualTestContext::from_window(AnyWindowHandle::from(window), cx);
        frames(&mut visual);
        outside(window, &mut visual);
        window.update(&mut visual, |host, window, cx| { host.request("activate", options, window, cx); }).unwrap();
        frames(&mut visual);
        assert_outside(window, &mut visual);
        window.update(&mut visual, |host, window, cx| { host.request("deactivate", vec![json!({})], window, cx); }).unwrap();
    }
}

#[gpui::test]
fn selected_logical_child_waits_for_its_view_without_region_fallback(cx: &mut TestAppContext) {
    let window = open(cx, Policy::Owned, true, false);
    let mut visual = VisualTestContext::from_window(AnyWindowHandle::from(window), cx);
    frames(&mut visual);
    outside(window, &mut visual);
    window.update(&mut visual, |host, window, cx| {
        assert!(!host.target.read(cx).owner.borrow().mounted);
        host.request("activate", vec![json!({"reason":"keyboard","preventScroll":true})], window, cx);
        assert!(host.outside.is_focused(window));
        assert!(!host.region.focus.is_focused(window));
        host.children(true, false, false, cx);
    }).unwrap();
    frames(&mut visual);
    window.update(&mut visual, |host, window, cx| {
        assert!(host.target.read(cx).focus_handle(cx).is_focused(window));
        let handle = host.target.read(cx).handle();
        assert_eq!(handle.state("focused"), json!(true));
        assert_eq!(handle.state("focusVisible"), json!(true));
        assert!(!host.region.owner.borrow().focused);
    }).unwrap();
}

#[gpui::test]
fn rejected_selected_logical_child_does_not_delegate_region_entry(cx: &mut TestAppContext) {
    let window = open(cx, Policy::Owned, true, false);
    let mut visual = VisualTestContext::from_window(AnyWindowHandle::from(window), cx);
    window.update(&mut visual, |host, _, cx| host.children(true, false, false, cx)).unwrap();
    frames(&mut visual);
    window.update(&mut visual, |host, window, cx| {
        window.disable_focus(cx);
        host.request("activate", vec![json!({})], window, cx);
        assert!(!host.target.read(cx).focus_handle(cx).is_focused(window));
        assert!(!host.region.focus.is_focused(window));
        assert!(!host.region.owner.borrow().focus_requested);
        assert!(!host.target.read(cx).handle().state("focused").as_bool().unwrap());
    }).unwrap();
    frames(&mut visual);
    window.update(&mut visual, |host, _, _| assert!(!host.region.owner.borrow().focus_requested)).unwrap();
}

#[gpui::test]
fn inactive_detached_close_cancels_owned_entry_but_independent_first_unresolved_is_noop(cx: &mut TestAppContext) {
    for independent in [false, true] {
        let window = open(cx, Policy::Owned, false, false);
        let mut visual = VisualTestContext::from_window(AnyWindowHandle::from(window), cx);
        frames(&mut visual);
        outside(window, &mut visual);
        window.update(&mut visual, |host, _, cx| { host.show_region = false; cx.notify(); }).unwrap();
        frames(&mut visual);
        window.update(&mut visual, |host, window, cx| {
            assert!(!host.region.owner.borrow().mounted);
            host.request(if independent { "enter" } else { "activate" }, vec![json!({})], window, cx);
            if !independent { host.request("deactivate", vec![json!({})], window, cx); }
            host.show_region = true;
            cx.notify();
        }).unwrap();
        frames(&mut visual);
        assert_outside(window, &mut visual);
    }
}

#[gpui::test]
fn retained_detach_rebind_delivers_only_the_current_activation(cx: &mut TestAppContext) {
    let window = open(cx, Policy::Owned, false, false);
    let mut visual = VisualTestContext::from_window(AnyWindowHandle::from(window), cx);
    frames(&mut visual);
    window.update(&mut visual, |host, _, cx| { host.show_region = false; cx.notify(); }).unwrap();
    frames(&mut visual);
    window.update(&mut visual, |host, window, cx| {
        host.request("activate", vec![json!({"reason":"pointer"})], window, cx);
        host.request("deactivate", vec![json!({})], window, cx);
        host.request("activate", vec![json!({"reason":"keyboard","preventScroll":true})], window, cx);
        host.show_region = true;
        cx.notify();
    }).unwrap();
    frames(&mut visual);
    window.update(&mut visual, |host, window, _| {
        assert!(host.region.focus.is_focused(window));
        assert_eq!(host.region.owner.borrow().modules.focus.reason, "keyboard");
        assert!(host.region.owner.borrow().modules.focus.prevent_scroll);
    }).unwrap();
    outside(window, &mut visual);
    frames(&mut visual);
    assert_outside(window, &mut visual);
}

#[gpui::test]
fn current_view_replaces_the_old_queued_entry_recipient(cx: &mut TestAppContext) {
    let window = open(cx, Policy::Owned, true, false);
    let mut visual = VisualTestContext::from_window(AnyWindowHandle::from(window), cx);
    window.update(&mut visual, |host, window, cx| {
        host.target_call("navigation", vec![json!("none")], window, cx);
        host.replacement.read(cx).handle().call("navigation", vec![json!("none")], window, cx);
        host.children(true, false, false, cx);
    }).unwrap();
    frames(&mut visual);
    outside(window, &mut visual);
    window.update(&mut visual, |host, _, cx| {
        // Stage the actual compiled authored callback before the host drive, so physical
        // replacement occurs while its old recipient is genuinely still queued.
        let callback = host.region.owner.borrow().exposes.get("activate").unwrap().clone();
        invoke(&host.region.owner, "expose-method", &callback,
            vec![Value::json(json!({"reason":"keyboard","preventScroll":true}))]);
        assert!(host.target.read(cx).owner.borrow().focus_requested);
        host.children(false, true, false, cx);
    }).unwrap();
    frames(&mut visual);
    window.update(&mut visual, |host, window, cx| {
        assert!(!host.target.read(cx).owner.borrow().mounted);
        assert!(!host.target.read(cx).owner.borrow().focus_requested);
        assert!(!host.target.read(cx).focus_handle(cx).is_focused(window));
        assert!(host.replacement.read(cx).focus_handle(cx).is_focused(window));
        assert_eq!(host.replacement.read(cx).handle().state("focusVisible"), json!(true));
    }).unwrap();
}

#[gpui::test]
fn another_windows_independent_intent_does_not_cancel_this_activation(cx: &mut TestAppContext) {
    let first = open(cx, Policy::Owned, false, false);
    let second = open(cx, Policy::Owned, false, false);
    let mut first_visual = VisualTestContext::from_window(AnyWindowHandle::from(first), cx);
    let mut second_visual = VisualTestContext::from_window(AnyWindowHandle::from(second), cx);
    frames(&mut first_visual);
    frames(&mut second_visual);
    first.update(&mut first_visual, |host, _, cx| { host.show_region = false; cx.notify(); }).unwrap();
    frames(&mut first_visual);
    first.update(&mut first_visual, |host, window, cx| { host.request("activate", vec![json!({})], window, cx); }).unwrap();
    second.update(&mut second_visual, |host, window, cx| { host.request("enter", vec![json!({})], window, cx); }).unwrap();
    first.update(&mut first_visual, |host, _, cx| { host.show_region = true; cx.notify(); }).unwrap();
    frames(&mut first_visual);
    first.update(&mut first_visual, |host, window, _| assert!(host.region.focus.is_focused(window))).unwrap();
}

#[gpui::test]
fn independent_target_request_survives_old_scope_close(cx: &mut TestAppContext) {
    let window = open(cx, Policy::Owned, true, false);
    let mut visual = VisualTestContext::from_window(AnyWindowHandle::from(window), cx);
    frames(&mut visual);
    window.update(&mut visual, |host, window, cx| {
        host.request("activate", vec![json!({})], window, cx);
        host.target_call("focus", vec![json!({"reason":"pointer"})], window, cx);
        host.request("deactivate", vec![json!({})], window, cx);
        host.children(true, false, false, cx);
    }).unwrap();
    frames(&mut visual);
    window.update(&mut visual, |host, window, cx| {
        assert!(host.target.read(cx).focus_handle(cx).is_focused(window));
        assert_eq!(host.target.read(cx).handle().state("focusVisible"), json!(false));
    }).unwrap();
}

#[gpui::test]
fn entry_disable_retains_target_intent_and_target_disable_retains_entry_intent(cx: &mut TestAppContext) {
    let window = open(cx, Policy::Owned, false, false);
    let mut visual = VisualTestContext::from_window(AnyWindowHandle::from(window), cx);
    frames(&mut visual);
    window.update(&mut visual, |host, window, cx| {
        host.target_call("focus", vec![json!({})], window, cx);
        host.target_call("disableEntry", vec![json!(true)], window, cx);
        host.children(true, false, false, cx);
    }).unwrap();
    frames(&mut visual);
    window.update(&mut visual, |host, window, cx| {
        assert!(host.target.read(cx).focus_handle(cx).is_focused(window));
        host.target_call("disableEntry", vec![json!(false)], window, cx);
        host.target_call("disable", vec![json!(true)], window, cx);
        window.focus(&host.outside, cx);
        host.target_call("enter", vec![json!({"reason":"keyboard"})], window, cx);
        assert!(host.target.read(cx).focus_handle(cx).is_focused(window));
        assert_eq!(host.target.read(cx).handle().state("focused"), json!(false));
    }).unwrap();
}

#[gpui::test]
fn entry_disable_and_terminal_disposal_do_not_replay_pending_owned_entry(cx: &mut TestAppContext) {
    for dispose in [false, true] {
        let window = open(cx, Policy::Owned, false, false);
        let mut visual = VisualTestContext::from_window(AnyWindowHandle::from(window), cx);
        frames(&mut visual);
        outside(window, &mut visual);
        window.update(&mut visual, |host, _, cx| { host.show_region = false; cx.notify(); }).unwrap();
        frames(&mut visual);
        window.update(&mut visual, |host, window, cx| {
            host.request("activate", vec![json!({})], window, cx);
            if dispose { proto_ui_gpui_native::gpui_native_owner::Owner::dispose(&host.region.owner); }
            else {
                host.request("disableEntry", vec![json!(true)], window, cx);
                host.request("disableEntry", vec![json!(false)], window, cx);
            }
            host.show_region = true;
            cx.notify();
        }).unwrap();
        frames(&mut visual);
        assert_outside(window, &mut visual);
    }
}

#[gpui::test]
fn inactive_observer_reentry_survives_old_deactivation_and_restoration(cx: &mut TestAppContext) {
    let window = open(cx, Policy::Container, false, false);
    let mut visual = VisualTestContext::from_window(AnyWindowHandle::from(window), cx);
    frames(&mut visual);
    outside(window, &mut visual);
    window.update(&mut visual, |host, _, cx| { host.show_region = false; cx.notify(); }).unwrap();
    frames(&mut visual);
    window.update(&mut visual, |host, window, cx| {
        host.request("activate", vec![json!({})], window, cx);
        host.request("armReentry", vec![], window, cx);
        host.request("deactivate", vec![json!({})], window, cx);
        host.show_region = true;
        cx.notify();
    }).unwrap();
    frames(&mut visual);
    window.update(&mut visual, |host, window, _| {
        assert!(host.region.owner.borrow().modules.focus.scope_active);
        assert!(host.region.focus.is_focused(window));
        assert_eq!(host.region.owner.borrow().modules.focus.reason, "keyboard");
    }).unwrap();
}

#[gpui::test]
fn independent_entry_from_inactive_observer_survives_old_previous_restore(cx: &mut TestAppContext) {
    let window = open(cx, Policy::Container, false, false);
    let mut visual = VisualTestContext::from_window(AnyWindowHandle::from(window), cx);
    frames(&mut visual);
    outside(window, &mut visual);
    window.update(&mut visual, |host, window, cx| {
        host.request("activate", vec![json!({})], window, cx);
        host.request("armIndependentEntry", vec![], window, cx);
        host.request("deactivate", vec![json!({})], window, cx);
        assert!(host.region.focus.is_focused(window));
        assert!(!host.outside.is_focused(window));
    }).unwrap();
    frames(&mut visual);
    window.update(&mut visual, |host, window, _| assert!(host.region.focus.is_focused(window))).unwrap();
}

#[gpui::test]
fn restore_none_and_ordinary_previous_keep_their_distinct_host_effects(cx: &mut TestAppContext) {
    for (policy, restores) in [(Policy::Owned, false), (Policy::Container, true)] {
        let window = open(cx, policy, false, false);
        let mut visual = VisualTestContext::from_window(AnyWindowHandle::from(window), cx);
        frames(&mut visual);
        outside(window, &mut visual);
        window.update(&mut visual, |host, window, cx| {
            host.request("activate", vec![json!({})], window, cx);
            assert!(host.region.focus.is_focused(window));
        }).unwrap();
        visual.run_until_parked();
        window.update(&mut visual, |host, window, cx| {
            host.request("deactivate", vec![json!({})], window, cx);
            assert_eq!(host.outside.is_focused(window), restores);
            assert_eq!(host.region.focus.is_focused(window), !restores);
        }).unwrap();
    }
}

#[gpui::test]
fn newer_independent_entry_before_close_is_not_cancelled_by_the_old_activation(cx: &mut TestAppContext) {
    let window = open(cx, Policy::Container, false, false);
    let mut visual = VisualTestContext::from_window(AnyWindowHandle::from(window), cx);
    frames(&mut visual);
    outside(window, &mut visual);
    window.update(&mut visual, |host, window, cx| { host.request("activate", vec![json!({})], window, cx); }).unwrap();
    visual.run_until_parked();
    window.update(&mut visual, |host, window, cx| {
        let callback = host.region.owner.borrow().exposes.get("enter").unwrap().clone();
        invoke(&host.region.owner, "expose-method", &callback, vec![Value::json(json!({"reason":"pointer"}))]);
        host.request("deactivate", vec![json!({})], window, cx);
        assert!(host.region.focus.is_focused(window));
        assert_eq!(host.region.owner.borrow().modules.focus.reason, "pointer");
    }).unwrap();
    frames(&mut visual);
    window.update(&mut visual, |host, window, _| assert!(host.region.focus.is_focused(window))).unwrap();
}

#[gpui::test]
fn explicit_target_blur_retires_its_staged_independent_entry(cx: &mut TestAppContext) {
    let window = open(cx, Policy::Owned, false, false);
    let mut visual = VisualTestContext::from_window(AnyWindowHandle::from(window), cx);
    window.update(&mut visual, |host, _, cx| host.children(true, false, false, cx)).unwrap();
    frames(&mut visual);
    outside(window, &mut visual);
    window.update(&mut visual, |host, window, cx| {
        let owner = host.target.read(cx).owner.clone();
        let callback = owner.borrow().exposes.get("enter").unwrap().clone();
        invoke(&owner, "expose-method", &callback, vec![Value::json(json!({}))]);
        host.target_call("blur", vec![], window, cx);
    }).unwrap();
    frames(&mut visual);
    assert_outside(window, &mut visual);
}

#[gpui::test]
fn rejected_independent_entry_survives_old_scope_close_and_entry_disable_retires_it(cx: &mut TestAppContext) {
    let window = open(cx, Policy::Container, false, false);
    let mut visual = VisualTestContext::from_window(AnyWindowHandle::from(window), cx);
    frames(&mut visual);
    window.update(&mut visual, |host, window, cx| {
        window.disable_focus(cx);
        host.request("activate", vec![json!({})], window, cx);
        host.request("enter", vec![json!({"reason":"pointer","preventScroll":true})], window, cx);
        host.request("deactivate", vec![json!({})], window, cx);
        assert!(!host.region.focus.is_focused(window));
        let owner = host.region.owner.borrow();
        assert!(!owner.focused && !owner.modules.focus.visible);
        assert!(owner.modules.focus.entry_intent.is_some(), "old Scope cleanup must retain the newer rejected independent Entry");
        assert_eq!(owner.modules.focus.reason, "pointer");
    }).unwrap();
    frames(&mut visual);
    window.update(&mut visual, |host, window, cx| {
        host.request("disableEntry", vec![json!(true)], window, cx);
        host.request("disableEntry", vec![json!(false)], window, cx);
        assert!(host.region.owner.borrow().modules.focus.entry_intent.is_none());
    }).unwrap();
    frames(&mut visual);
    window.update(&mut visual, |host, window, _| {
        assert!(!host.region.focus.is_focused(window));
        assert!(!host.region.owner.borrow().focus_requested);
    }).unwrap();
}

#[gpui::test]
fn active_observer_can_close_before_any_owned_fallback_request(cx: &mut TestAppContext) {
    let window = open(cx, Policy::Container, false, false);
    let mut visual = VisualTestContext::from_window(AnyWindowHandle::from(window), cx);
    frames(&mut visual);
    outside(window, &mut visual);
    window.update(&mut visual, |host, window, cx| {
        host.request("armCloseOnActivate", vec![], window, cx);
        host.request("activate", vec![json!({})], window, cx);
        assert!(!host.region.owner.borrow().modules.focus.scope_active);
    }).unwrap();
    frames(&mut visual);
    assert_outside(window, &mut visual);
}

#[gpui::test]
fn native_text_pointer_supersedes_detached_owned_entry(cx: &mut TestAppContext) {
    let window = open(cx, Policy::Owned, false, true);
    let mut visual = VisualTestContext::from_window(AnyWindowHandle::from(window), cx);
    frames(&mut visual);
    window.update(&mut visual, |host, _, cx| { host.show_region = false; cx.notify(); }).unwrap();
    frames(&mut visual);
    let position = window.update(&mut visual, |host, window, cx| {
        host.request("activate", vec![json!({})], window, cx);
        let text = host.text.as_ref().unwrap().read(cx);
        let bounds = text.owner.borrow().bounds.expect("actual rendered text Root");
        bounds.origin + point(px(2.), px(2.))
    }).unwrap();
    visual.simulate_mouse_down(position, MouseButton::Left, Modifiers::default());
    window.update(&mut visual, |host, window, cx| {
        assert!(host.text.as_ref().unwrap().read(cx).focus_handle(cx).is_focused(window));
        host.show_region = true;
        cx.notify();
    }).unwrap();
    frames(&mut visual);
    window.update(&mut visual, |host, window, cx| {
        assert!(host.text.as_ref().unwrap().read(cx).focus_handle(cx).is_focused(window));
        assert!(!host.region.focus.is_focused(window));
    }).unwrap();
}

// Deliberately live acceptance counterexample: inherited Entry descendant discovery is unresolved.
// A failing result here must remain a failure, not be relabelled as self-fallback support.
#[gpui::test]
fn ordinary_native_only_descendant_wins_over_self_without_logical_membership(cx: &mut TestAppContext) {
    let window = open(cx, Policy::Owned, false, false);
    let mut visual = VisualTestContext::from_window(AnyWindowHandle::from(window), cx);
    window.update(&mut visual, |host, _, cx| host.children(false, false, true, cx)).unwrap();
    frames(&mut visual);
    outside(window, &mut visual);
    window.update(&mut visual, |host, window, cx| {
        host.request("activate", vec![json!({})], window, cx);
        assert!(host.native.read(cx).focus.is_focused(window), "descendant-first must discover an ordinary nested native FocusHandle");
        assert!(!host.region.focus.is_focused(window));
        assert!(!host.region.owner.borrow().focusable);
    }).unwrap();
}
