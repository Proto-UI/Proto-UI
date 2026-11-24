//! Native GPUI input must reach the authored press observer.
//! Calling click_event_fields directly would miss a disconnected root handler.
use gpui::{prelude::*, point, px, size, Context, Entity, IntoElement, Modifiers,
    MouseButton, MouseDownEvent, MouseUpEvent, PlatformInput, Render,
    TestAppContext, VisualTestContext, Window, WindowHandle};
use press_modifiers::CompiledComponent;
use serde_json::json;

struct Harness { component: Entity<CompiledComponent> }
impl Render for Harness {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        gpui::div().size_full().child(self.component.clone())
    }
}
fn open(cx: &mut TestAppContext) -> WindowHandle<Harness> {
    cx.open_window(size(px(240.), px(80.)), |window, cx| Harness {
        component: cx.new(|cx| CompiledComponent::new(json!({}), None, window, cx)
            .unwrap_or_else(|_| panic!("press fixture construction failed"))),
    })
}

#[gpui::test]
fn root_native_click_preserves_release_modifiers_for_authored_press(cx: &mut TestAppContext) {
    let window = open(cx);
    let mut visual = VisualTestContext::from_window(window.into(), cx);
    for _ in 0..3 {
        visual.update(|window, cx| { window.refresh(); window.draw(cx).clear(cx); });
        visual.run_until_parked();
    }
    for mask in [0_u8, 1, 2, 4, 8, 15] {
        let modifiers = Modifiers { shift: mask & 1 != 0, control: mask & 2 != 0,
            alt: mask & 4 != 0, platform: mask & 8 != 0, ..Default::default() };
        window.update(&mut visual, |host, window, cx| {
            let position = point(px(30.), px(20.));
            // The press starts without modifiers. A modifier acquired before
            // release belongs to this activation, not the prior down sample.
            window.dispatch_event(PlatformInput::MouseDown(MouseDownEvent {
                position, button: MouseButton::Left, click_count: 1, ..Default::default()
            }), cx);
            window.dispatch_event(PlatformInput::MouseUp(MouseUpEvent {
                position, button: MouseButton::Left, click_count: 1, modifiers, ..Default::default()
            }), cx);
            let handle = host.component.read(cx).handle();
            let expected = json!({"shift": modifiers.shift, "ctrl": modifiers.control,
                "alt": modifiers.alt, "meta": modifiers.platform});
            assert_eq!(handle.take_events(), vec![
                ("pressed".into(), expected)
            ], "modifier mask {mask} must survive the real root click path");
            assert!(handle.take_failures().is_empty());
        }).unwrap();
    }
}

#[gpui::test]
fn root_native_context_menu_preserves_mouse_modifiers_for_authored_observer(cx: &mut TestAppContext) {
    let window = open(cx);
    let mut visual = VisualTestContext::from_window(window.into(), cx);
    for _ in 0..3 {
        visual.update(|window, cx| { window.refresh(); window.draw(cx).clear(cx); });
        visual.run_until_parked();
    }
    for mask in [0_u8, 1, 2, 4, 8, 15] {
        let modifiers = Modifiers { shift: mask & 1 != 0, control: mask & 2 != 0,
            alt: mask & 4 != 0, platform: mask & 8 != 0, ..Default::default() };
        window.update(&mut visual, |host, window, cx| {
            let position = point(px(30.), px(20.));
            window.dispatch_event(PlatformInput::MouseDown(MouseDownEvent {
                position, button: MouseButton::Right, click_count: 1, modifiers, ..Default::default()
            }), cx);
            window.dispatch_event(PlatformInput::MouseUp(MouseUpEvent {
                position, button: MouseButton::Right, click_count: 1, modifiers, ..Default::default()
            }), cx);
            let handle = host.component.read(cx).handle();
            let expected = json!({"shift": modifiers.shift, "ctrl": modifiers.control,
                "alt": modifiers.alt, "meta": modifiers.platform});
            assert_eq!(handle.take_events(), vec![
                ("contextRequested".into(), expected)
            ], "right-click modifier mask {mask} must reach the authored context observer without activation");
            assert!(handle.take_failures().is_empty());
        }).unwrap();
    }
}
