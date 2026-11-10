//! This composes the actual authored Base Root, Trigger and Content exports.
//! It is deliberately separate from the six atomic Scope/Entry fixture exports.
use gpui::{prelude::*, AnyView, App, Context, Entity, FocusHandle, Focusable, Render,
    TestAppContext, Window, px};
use proto_ui_gpui_native::gpui_native_owner::NativeSnapshot;
use serde_json::json;

struct NativeChild { focus: FocusHandle }
impl Render for NativeChild {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        gpui::div().size(px(24.)).track_focus(&self.focus)
    }
}
struct PublicPopover {
    root: Entity<public_popover_root::CompiledComponent>,
    content: Entity<public_popover_content::CompiledComponent>,
    native: Entity<NativeChild>,
    outside: FocusHandle,
}
impl PublicPopover {
    fn new(window: &mut Window, cx: &mut Context<Self>) -> Self {
        let root = cx.new(|cx| public_popover_root::CompiledComponent::new(json!({"open":false}), None, window, cx));
        let parent = root.read(cx).handle().owner();
        let trigger = cx.new(|cx| public_popover_trigger::CompiledComponent::new(json!({}), Some(parent.clone()), window, cx));
        let content = cx.new(|cx| public_popover_content::CompiledComponent::new(json!({}), Some(parent), window, cx));
        let native = cx.new(|cx| NativeChild { focus: cx.focus_handle() });
        content.update(cx, |content, cx| content.set_slot(vec![NativeSnapshot::native_view(AnyView::from(native.clone()))], cx));
        root.update(cx, |root, cx| root.set_slot(vec![
            NativeSnapshot::native_view(AnyView::from(trigger)),
            NativeSnapshot::native_view(AnyView::from(content.clone())),
        ], cx));
        Self { root, content, native, outside: cx.focus_handle() }
    }
    fn set_open(&self, open: bool, window: &mut Window, cx: &mut App) {
        self.root.update(cx, |root, cx| root.set_props(json!({"open":open}), window, cx));
    }
}
impl Render for PublicPopover {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        gpui::div().size_full()
            .child(gpui::div().size(px(24.)).track_focus(&self.outside))
            .child(self.root.clone())
    }
}

#[gpui::test]
fn authored_public_content_opens_into_an_ordinary_non_tab_stop_native_child(cx: &mut TestAppContext) {
    let window = cx.open_window(gpui::size(px(500.), px(400.)), PublicPopover::new);
    window.update(cx, |_, window, _| window.activate_window()).unwrap();
    cx.run_until_parked();
    window.update(cx, |host, window, cx| host.set_open(true, window, cx)).unwrap();
    for _ in 0..3 {
        window.update(cx, |_, window, cx| window.draw(cx).clear(cx)).unwrap();
        cx.run_until_parked();
    }
    window.update(cx, |host, window, cx| {
        assert_eq!(host.content.read(cx).handle().state("open"), json!(true));
        let target = &host.native.read(cx).focus;
        assert!(!target.tab_stop);
        assert!(target.is_focused(window), "the actual public Content must reach native Entry");
        assert!(!host.content.read(cx).focus_handle(cx).is_focused(window));
        let owner = host.content.read(cx).owner.borrow();
        assert!(!owner.focusable && !owner.focused && !owner.modules.focus.visible);
    }).unwrap();
}
