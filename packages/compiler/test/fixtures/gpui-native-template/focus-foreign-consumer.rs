//! Ordinary native composition against the local patched SDK. The original
//! focus-consumer.rs twenty cases remain a separate, unchanged acceptance suite.
use generated_gpui_component::CompiledComponent;
use gpui::{prelude::*, AnyView, App, Context, Entity, FocusHandle, Focusable,
    Render, StyleRefinement, TestAppContext, Window, WindowHandle, px};
use proto_ui_gpui_native::gpui_native_owner::{NativeSnapshot, OwnerRef};
use serde_json::{json, Value as Json};
use std::rc::Rc;

type Call = Rc<dyn Fn(&str, Vec<Json>, &mut Window, &mut App) -> Json>;
struct Region {
    view: AnyView,
    owner: OwnerRef,
    call: Call,
    slot: Rc<dyn Fn(Vec<NativeSnapshot>, &mut App)>,
    focus: Rc<dyn Fn(&App) -> FocusHandle>,
}
struct ForeignSubtree { handles: Vec<FocusHandle> }
impl Render for ForeignSubtree {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        gpui::div().children(self.handles.iter().map(|handle| {
            gpui::div().size(px(24.)).track_focus(handle)
        }))
    }
}
struct NativeContainer { subtree: Entity<ForeignSubtree> }
impl Render for NativeContainer {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        self.subtree.clone().cached(StyleRefinement::default().size(px(100.)))
    }
}
struct Host {
    region: Region,
    subtree: Entity<ForeignSubtree>,
    outside: FocusHandle,
    show: bool,
}
impl Host {
    fn new(container: bool, window: &mut Window, cx: &mut Context<Self>) -> Self {
        macro_rules! region {
            ($component:ty) => {{
                let view = cx.new(|cx| <$component>::new(json!({}), None, window, cx));
                let handle = view.read(cx).handle();
                let owner = handle.owner.clone();
                let slot_view = view.clone();
                let focus_view = view.clone();
                Region { view: AnyView::from(view), owner,
                    call: Rc::new(move |name, args, window, cx| handle.call(name, args, window, cx)),
                    slot: Rc::new(move |children, cx| slot_view.update(cx, |view, cx| view.set_slot(children, cx))),
                    focus: Rc::new(move |cx| focus_view.read(cx).focus_handle(cx)) }
            }};
        }
        let region = if container { region!(focus_container::CompiledComponent) } else { region!(CompiledComponent) };
        let subtree = cx.new(|_| ForeignSubtree { handles: Vec::new() });
        let native = cx.new(|_| NativeContainer { subtree: subtree.clone() });
        (region.slot)(vec![NativeSnapshot::native_view(AnyView::from(native))], cx);
        Self { region, subtree, outside: cx.focus_handle(), show: true }
    }
    fn call(&self, name: &str, options: Json, window: &mut Window, cx: &mut App) {
        (self.region.call)(name, vec![options], window, cx);
    }
    fn populate(&self, cx: &mut App) {
        self.subtree.update(cx, |subtree, cx| {
            subtree.handles = vec![cx.focus_handle().tab_index(10), cx.focus_handle().tab_index(-1)];
            cx.notify();
        });
    }
}
impl Render for Host {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        let mut root = gpui::div().size_full().child(gpui::div().size(px(24.)).track_focus(&self.outside));
        if self.show { root = root.child(self.region.view.clone()); }
        root
    }
}
fn open(cx: &mut TestAppContext, container: bool) -> WindowHandle<Host> {
    let window = cx.open_window(gpui::size(px(400.), px(300.)), |window, cx| Host::new(container, window, cx));
    window.update(cx, |_, window, _| window.activate_window()).unwrap();
    frames(window, cx);
    window
}
fn frames(window: WindowHandle<Host>, cx: &mut TestAppContext) {
    // A forced Window::refresh would erase the cached-foreign-subtree condition.
    for _ in 0..3 {
        window.update(cx, |_, window, cx| window.draw(cx).clear(cx)).unwrap();
        cx.run_until_parked();
    }
}

#[gpui::test]
fn cached_foreign_changes_project_self_participation_without_moving_focus(cx: &mut TestAppContext) {
    let window = open(cx, false);
    window.update(cx, |host, window, cx| {
        window.focus(&host.outside, cx);
        assert!((host.region.focus)(cx).tab_stop, "only proven native empty uses the region fallback");
        host.populate(cx);
    }).unwrap();
    frames(window, cx);
    let revision = window.update(cx, |host, window, cx| {
        assert!(host.outside.is_focused(window), "readiness and queries must not focus anything");
        assert!(!(host.region.focus)(cx).tab_stop, "a tracked non-tab-stop descendant suppresses self fallback");
        let revision = host.region.owner.borrow().projection_revision;
        host.subtree.update(cx, |subtree, cx| { subtree.handles.clear(); cx.notify(); });
        revision
    }).unwrap();
    frames(window, cx);
    window.update(cx, |host, window, cx| {
        assert!(host.outside.is_focused(window));
        assert!((host.region.focus)(cx).tab_stop);
        assert_eq!(host.region.owner.borrow().projection_revision, revision, "native cached readiness must not rerun authored projection");
    }).unwrap();
}

#[gpui::test]
fn physical_reorder_replace_and_detach_resolve_the_current_foreign_handle(cx: &mut TestAppContext) {
    let window = open(cx, false);
    window.update(cx, |host, _, cx| host.populate(cx)).unwrap();
    frames(window, cx);
    for replace in [false, true] {
        window.update(cx, |host, _, cx| host.subtree.update(cx, |subtree, cx| {
            if replace { subtree.handles = vec![cx.focus_handle()]; }
            else { subtree.handles.reverse(); }
            cx.notify();
        })).unwrap();
        frames(window, cx);
        window.update(cx, |host, window, cx| {
            host.call("activate", json!({"reason":"keyboard","preventScroll":true}), window, cx);
            assert!(host.subtree.read(cx).handles[0].is_focused(window));
            let region = host.region.owner.borrow();
            assert!(!region.focusable && !region.focused && !region.modules.focus.visible);
            assert!(region.modules.focus.entry_intent.is_none());
        }).unwrap();
    }
    window.update(cx, |host, window, cx| {
        window.focus(&host.outside, cx);
        host.subtree.update(cx, |subtree, cx| { subtree.handles.clear(); cx.notify(); });
    }).unwrap();
    frames(window, cx);
    window.update(cx, |host, window, cx| {
        assert!(host.outside.is_focused(window), "readiness must not repeat an accepted acquisition");
        host.call("enter", json!({}), window, cx);
        assert!((host.region.focus)(cx).is_focused(window));
    }).unwrap();
}

#[gpui::test]
fn rejected_foreign_entry_keeps_request_identity_across_cached_readiness(cx: &mut TestAppContext) {
    let window = open(cx, true);
    window.update(cx, |host, _, cx| host.populate(cx)).unwrap();
    frames(window, cx);
    let id = window.update(cx, |host, window, cx| {
        window.disable_focus(cx);
        host.call("activate", json!({"reason":"keyboard","preventScroll":true}), window, cx);
        let owner = host.region.owner.borrow();
        assert!(owner.modules.focus.entry_intent.is_some());
        owner.modules.focus.intent
    }).unwrap();
    window.update(cx, |host, _, cx| host.subtree.update(cx, |subtree, cx| {
        subtree.handles = vec![cx.focus_handle()]; cx.notify();
    })).unwrap();
    frames(window, cx);
    window.update(cx, |host, window, cx| {
        let owner = host.region.owner.borrow();
        assert_eq!(owner.modules.focus.intent, id);
        assert!(owner.modules.focus.entry_intent.is_some());
        assert!(!owner.focused && !owner.modules.focus.visible);
        assert!(!host.subtree.read(cx).handles[0].is_focused(window));
        assert!(!(host.region.focus)(cx).tab_stop);
    }).unwrap();
}

#[gpui::test]
fn inactive_observer_independent_foreign_entry_survives_old_activation_cancel(cx: &mut TestAppContext) {
    let window = open(cx, true);
    window.update(cx, |host, _, cx| host.populate(cx)).unwrap();
    frames(window, cx);
    let independent = window.update(cx, |host, window, cx| {
        window.disable_focus(cx);
        host.call("activate", json!({}), window, cx);
        let activation = host.region.owner.borrow().modules.focus.intent;
        (host.region.call)("armIndependentEntry", vec![], window, cx);
        host.call("deactivate", json!({}), window, cx);
        let owner = host.region.owner.borrow();
        assert!(owner.modules.focus.intent > activation);
        assert!(owner.modules.focus.entry_intent.is_some());
        assert_eq!(owner.modules.focus.reason, "pointer");
        owner.modules.focus.intent
    }).unwrap();
    window.update(cx, |host, _, cx| host.subtree.update(cx, |subtree, cx| { subtree.handles.reverse(); cx.notify(); })).unwrap();
    frames(window, cx);
    window.update(cx, |host, _, _| {
        let owner = host.region.owner.borrow();
        assert_eq!(owner.modules.focus.intent, independent);
        assert!(owner.modules.focus.entry_intent.is_some());
        assert_eq!(owner.modules.focus.reason, "pointer");
        assert!(owner.modules.focus.prevent_scroll);
    }).unwrap();
}

#[gpui::test]
fn detached_activation_uses_only_new_native_lifetime_and_explicit_cancel_is_final(cx: &mut TestAppContext) {
    for cancel in [false, true] {
        let window = open(cx, false);
        window.update(cx, |host, _, cx| { host.populate(cx); host.show = false; cx.notify(); }).unwrap();
        frames(window, cx);
        window.update(cx, |host, window, cx| {
            window.focus(&host.outside, cx);
            host.call("activate", json!({"reason":"keyboard","preventScroll":true}), window, cx);
            if cancel { host.call("deactivate", json!({}), window, cx); }
            host.subtree.update(cx, |subtree, cx| { subtree.handles = vec![cx.focus_handle()]; cx.notify(); });
            host.show = true;
            cx.notify();
        }).unwrap();
        frames(window, cx);
        window.update(cx, |host, window, cx| {
            assert_eq!(host.subtree.read(cx).handles[0].is_focused(window), !cancel);
            assert_eq!(host.outside.is_focused(window), cancel);
            assert!(!host.region.owner.borrow().focused);
            assert!(host.region.owner.borrow().modules.focus.entry_intent.is_none());
        }).unwrap();
    }
}
