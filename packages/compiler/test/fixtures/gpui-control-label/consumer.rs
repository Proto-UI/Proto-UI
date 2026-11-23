//! Actual upstream Base Button/Label/Input compiled as ordinary GPUI source.
use gpui::{prelude::*, px, size, point, AnyWindowHandle, Context, Entity, Element,
    IntoElement, Render, TestAppContext, VisualTestContext, Window, WindowHandle, Modifiers, MouseButton};
use proto_ui_gpui_native::gpui_native_owner::*;
use proto_ui_gpui_native::gpui_native_a11y::Semantics;
use serde_json::json;
use std::rc::Rc;
use std::cell::Cell;

struct NativeChild(Rc<Cell<usize>>);
impl Render for NativeChild {fn render(&mut self,_:&mut Window,_:&mut Context<Self>)->impl IntoElement{let calls=self.0.clone();gpui::div().id("native-interactive-child").child("Native button").on_click(move|_,_,_|calls.set(calls.get()+1))}}

struct Harness {
    button:Entity<button::CompiledComponent>, label:Entity<label::CompiledComponent>,
    reference:ControlLabelRef, extra:Vec<Entity<button::CompiledComponent>>, show_label:bool, repeat_label:bool, repeat_target:bool,
}
impl Render for Harness {
    fn render(&mut self,_:&mut Window,_:&mut Context<Self>)->impl IntoElement {
        let labels=self.show_label.then(||self.label.clone());
        gpui::div().flex().flex_col().size_full().children(labels).child(self.button.clone()).children(self.extra.clone())
            .when(self.repeat_label,|view|view.child(gpui::div().id("second-label-parent").child(self.label.clone())))
            .when(self.repeat_target,|view|view.child(gpui::div().id("second-target-parent").child(self.button.clone())))
    }
}
fn associations(reference:&ControlLabelRef)->NativeInstanceAssociations {NativeInstanceAssociations{control_label:Some(reference.clone())}}
fn open(cx:&mut TestAppContext,reference:Option<ControlLabelRef>)->WindowHandle<Harness>{
    cx.open_window(size(px(280.),px(180.)),move|window,cx|{
        let reference=reference.unwrap_or_default();
        let button=cx.new(|cx|{
            let mut component=button::CompiledComponent::new_with_associations(json!({}),None,associations(&reference),window,cx).unwrap_or_else(|_|panic!("official Button construction"));
            component.set_slot(vec![NativeSnapshot::text_value(Value::string("Action"))],cx).unwrap_or_else(|_|panic!("Button slot"));component
        });
        let label=cx.new(|cx|{
            let mut component=label::CompiledComponent::new_with_associations(json!({}),None,associations(&reference),window,cx).unwrap_or_else(|_|panic!("official Label construction"));
            component.set_slot(vec![NativeSnapshot::text_value(Value::string("Visible caption"))],cx).unwrap_or_else(|_|panic!("Label slot"));component
        });
        Harness{button,label,reference,extra:Vec::new(),show_label:true,repeat_label:false,repeat_target:false}
    })
}
fn frames(cx:&mut VisualTestContext){for _ in 0..3{cx.update(|window,cx|{window.refresh();window.draw(cx).clear(cx);});cx.run_until_parked();}}
fn projected(owner:&OwnerRef)->gpui::accesskit::Node{
    let semantics=Semantics{element:gpui::div(),owner:Rc::downgrade(owner),role:Some(gpui::Role::Button)};
    let mut node=gpui::accesskit::Node::new(semantics.a11y_role().expect("native semantic node"));semantics.write_a11y_info(&mut node);node
}
fn events(host:&Harness,cx:&gpui::App)->Vec<(String,serde_json::Value)>{host.button.read(cx).handle().take_events()}
fn click_signal()->Vec<(String,serde_json::Value)>{vec![("click".into(),json!(null))]}

#[gpui::test]
fn official_button_assistive_action_enters_its_disabled_guard_and_press_operation(cx:&mut TestAppContext){
    let window=open(cx,None);let mut visual=VisualTestContext::from_window(AnyWindowHandle::from(window),cx);frames(&mut visual);
    window.update(&mut visual,|host,window,cx|{
        let button=host.button.read(cx).handle();
        dispatch_accessibility_action(&button.owner,"activate",None);assert_eq!(button.take_events(),click_signal());
        dispatch(&button.owner,"press.commit",false,event_fields("press.commit"));assert_eq!(button.take_events(),click_signal());
        host.button.update(cx,|component,cx|component.set_props(json!({"disabled":true}),window,cx).unwrap_or_else(|_|panic!("disable Button")));
        dispatch_accessibility_action(&button.owner,"activate",None);assert!(button.take_events().is_empty());
        assert_eq!(button.state("disabled").unwrap_or_else(|_|panic!("disabled state")),json!(true));
        assert!(button.take_failures().is_empty());
    }).unwrap();
}

#[gpui::test]
fn visible_label_names_and_activates_the_actual_button_without_a_new_tab_stop(cx:&mut TestAppContext){
    let window=open(cx,None);let mut visual=VisualTestContext::from_window(AnyWindowHandle::from(window),cx);frames(&mut visual);
    window.update(&mut visual,|host,window,cx|{
        let label=host.label.read(cx).owner.clone();let button=host.button.read(cx).owner.clone();
        assert_eq!(control_label_diagnostic(&label),None);
        assert!(!native_tab_participation(&label));assert!(!native_key_input_needed(&label));
        assert_eq!(projected(&button).labelled_by(),&[label.borrow().modules.a11y_node.expect("real Label node")]);
        assert_eq!(projected(&button).label(),None,"content default yields to the visible Label relation");
        assert!(control_label_accessibility_action(&label,window,cx));assert_eq!(events(host,cx),click_signal());
        host.button.update(cx,|component,cx|component.set_props(json!({"disabled":true}),window,cx).unwrap_or_else(|_|panic!("disable")));
        assert!(control_label_accessibility_action(&label,window,cx));assert!(events(host,cx).is_empty());
        assert!(!projected(&button).labelled_by().is_empty(),"disabled does not remove naming");
        host.label.update(cx,|component,cx|component.set_props(json!({"activation":false}),window,cx).unwrap_or_else(|_|panic!("passive Label")));
        assert!(!control_label_accessibility_action(&label,window,cx));assert!(!control_label_action_available(&label));
        assert!(!projected(&button).labelled_by().is_empty());
        host.label.update(cx,|component,cx|component.set_props(json!({"naming":false,"activation":true}),window,cx).unwrap_or_else(|_|panic!("activation-only Label")));
        assert!(projected(&button).labelled_by().is_empty());assert_eq!(projected(&button).label(),Some("Action"));
    }).unwrap();
}

#[gpui::test]
fn duplicate_detach_and_reference_replacement_never_choose_a_winner(cx:&mut TestAppContext){
    let window=open(cx,None);let mut visual=VisualTestContext::from_window(AnyWindowHandle::from(window),cx);frames(&mut visual);
    window.update(&mut visual,|host,window,cx|{
        let duplicate=cx.new(|cx|button::CompiledComponent::new_with_associations(json!({}),None,associations(&host.reference),window,cx).unwrap_or_else(|_|panic!("duplicate")));
        host.extra.push(duplicate);cx.notify();
    }).unwrap();frames(&mut visual);
    window.update(&mut visual,|host,window,cx|{
        let label=host.label.read(cx).owner.clone();let button=host.button.read(cx).owner.clone();
        assert_eq!(control_label_diagnostic(&label),Some("duplicate-binding"));
        assert!(!control_label_accessibility_action(&label,window,cx));assert!(events(host,cx).is_empty());
        assert!(projected(&button).labelled_by().is_empty());
        let duplicate=host.extra.pop().unwrap();set_instance_associations(&duplicate.read(cx).owner,NativeInstanceAssociations::default());drop(duplicate);cx.notify();
    }).unwrap();frames(&mut visual);
    window.update(&mut visual,|host,window,cx|{
        let label=host.label.read(cx).owner.clone();assert!(control_label_accessibility_action(&label,window,cx));assert_eq!(events(host,cx),click_signal());
        host.show_label=false;cx.notify();
    }).unwrap();frames(&mut visual);
    window.update(&mut visual,|host,window,cx|{
        let label=host.label.read(cx).owner.clone();assert!(!ready(&label));assert!(!control_label_accessibility_action(&label,window,cx));
        let button=host.button.read(cx).owner.clone();assert!(projected(&button).labelled_by().is_empty());
        host.show_label=true;cx.notify();
    }).unwrap();frames(&mut visual);
    window.update(&mut visual,|host,window,cx|{
        let label=host.label.read(cx).owner.clone();assert!(control_label_accessibility_action(&label,window,cx));assert_eq!(events(host,cx),click_signal());
        let unrelated=ControlLabelRef::new();set_instance_associations(&label,associations(&unrelated));
        assert!(!control_label_accessibility_action(&label,window,cx));assert!(events(host,cx).is_empty());
        set_instance_associations(&label,associations(&host.reference));assert!(control_label_accessibility_action(&label,window,cx));assert_eq!(events(host,cx),click_signal());
    }).unwrap();
}

#[gpui::test]
fn primary_click_activates_once_but_modified_dragged_and_unknown_slot_input_do_not(cx:&mut TestAppContext){
    let window=open(cx,None);let mut visual=VisualTestContext::from_window(AnyWindowHandle::from(window),cx);frames(&mut visual);
    let position=window.update(&mut visual,|host,_,cx|host.label.read(cx).owner.borrow().bounds.expect("visible label").center()).unwrap();
    visual.simulate_click(position,Modifiers::default());
    window.update(&mut visual,|host,_,cx|assert_eq!(events(host,cx),click_signal())).unwrap();
    visual.simulate_click(position,Modifiers{shift:true,..Default::default()});
    window.update(&mut visual,|host,_,cx|assert!(events(host,cx).is_empty())).unwrap();
    visual.simulate_mouse_down(position,MouseButton::Left,Modifiers::default());
    visual.simulate_mouse_move(position+point(px(9.),px(0.)),MouseButton::Left,Modifiers::default());
    visual.simulate_mouse_move(position,MouseButton::Left,Modifiers::default());
    visual.simulate_mouse_up(position,MouseButton::Left,Modifiers::default());
    window.update(&mut visual,|host,_,cx|assert!(events(host,cx).is_empty())).unwrap();
    let native_calls=Rc::new(Cell::new(0));
    window.update(&mut visual,|host,_,cx|{
        let nested=cx.new(|_|NativeChild(native_calls.clone()));host.label.update(cx,|label,cx|label.set_slot(vec![NativeSnapshot::native_view(nested.into())],cx).unwrap_or_else(|_|panic!("unknown native slot")));
    }).unwrap();frames(&mut visual);
    let position=window.update(&mut visual,|host,_,cx|{assert_eq!(control_label_diagnostic(&host.label.read(cx).owner),Some("unsupported-pointer-content"));host.label.read(cx).owner.borrow().bounds.unwrap().center()}).unwrap();
    visual.simulate_click(position,Modifiers::default());
    assert_eq!(native_calls.get(),1,"the native descendant keeps its own action");
    window.update(&mut visual,|host,_,cx|assert!(events(host,cx).is_empty())).unwrap();
}

#[gpui::test]
fn window_deactivation_retires_a_label_pointer_request_without_adding_focus(cx:&mut TestAppContext){
    let window=open(cx,None);let mut visual=VisualTestContext::from_window(AnyWindowHandle::from(window),cx);
    window.update(&mut visual,|_,window,_|window.activate_window()).unwrap();visual.run_until_parked();frames(&mut visual);
    let position=window.update(&mut visual,|host,window,cx|{
        let label=host.label.read(cx).owner.clone();
        assert!(window.is_window_active());assert!(!native_tab_participation(&label));assert!(!native_focus_observation_needed(&label));
        let position=label.borrow().bounds.expect("visible label").center();position
    }).unwrap();
    visual.simulate_mouse_down(position,MouseButton::Left,Modifiers::default());
    let other=visual.open_window(size(px(80.),px(40.)),|_,_|NativeChild(Rc::new(Cell::new(0))));
    other.update(&mut visual,|_,window,_|window.activate_window()).unwrap();visual.run_until_parked();
    window.update(&mut visual,|host,window,cx|{assert!(!window.is_window_active());assert!(events(host,cx).is_empty());}).unwrap();
    window.update(&mut visual,|_,window,_|window.activate_window()).unwrap();visual.run_until_parked();
    window.update(&mut visual,|_,window,_|assert!(window.is_window_active())).unwrap();
    visual.simulate_mouse_up(position,MouseButton::Left,Modifiers::default());
    window.update(&mut visual,|host,_,cx|assert!(events(host,cx).is_empty(),"inactive then active cannot revive the old pointer request")).unwrap();
    visual.simulate_click(position,Modifiers::default());
    window.update(&mut visual,|host,_,cx|{assert_eq!(events(host,cx),click_signal());assert!(host.label.read(cx).handle().take_failures().is_empty());}).unwrap();
}

#[gpui::test]
fn a_shared_reference_does_not_authorize_different_native_windows(cx:&mut TestAppContext){
    let reference=ControlLabelRef::new();let first=open(cx,Some(reference.clone()));let second=open(cx,Some(reference.clone()));
    let mut visual=VisualTestContext::from_window(AnyWindowHandle::from(first),cx);frames(&mut visual);
    second.update(&mut visual,|host,_,cx|{set_instance_associations(&host.label.read(cx).owner,NativeInstanceAssociations::default());}).unwrap();
    first.update(&mut visual,|host,_,cx|{set_instance_associations(&host.button.read(cx).owner,NativeInstanceAssociations::default());}).unwrap();
    // Draw through the window context, without leasing its root Harness while
    // GPUI itself needs that same entity to render the new frame.
    let mut second_visual=VisualTestContext::from_window(AnyWindowHandle::from(second),cx);frames(&mut second_visual);
    first.update(&mut visual,|host,window,cx|{
        let label=host.label.read(cx).owner.clone();assert_eq!(control_label_diagnostic(&label),Some("foreign-tree-scope"));
        assert!(!control_label_accessibility_action(&label,window,cx));assert!(events(host,cx).is_empty());
    }).unwrap();
}


#[gpui::test]
fn official_button_space_default_prevention_keeps_one_press_intent(cx:&mut TestAppContext){
    let window=open(cx,None);let mut visual=VisualTestContext::from_window(AnyWindowHandle::from(window),cx);frames(&mut visual);
    window.update(&mut visual,|host,window,cx|host.button.read(cx).handle().call("focusSelf",vec![],window,cx).unwrap_or_else(|_|panic!("focus Button"))).unwrap();
    frames(&mut visual);
    for key in ["space","enter"]{
        visual.simulate_keystrokes(key);
        window.update(&mut visual,|host,_,cx|{assert_eq!(events(host,cx),click_signal(),"{key} must activate once after default prevention and native click de-duplication");assert!(host.button.read(cx).handle().take_failures().is_empty());}).unwrap();
    }
}


struct DelegatedInput {input:Entity<input_delegate::CompiledComponent>}
impl Render for DelegatedInput {fn render(&mut self,_:&mut Window,_:&mut Context<Self>)->impl IntoElement{gpui::div().size_full().child(self.input.clone())}}
#[gpui::test]
fn an_authored_input_capture_keeps_its_scalar_empty_renderer_and_native_editor(cx:&mut TestAppContext){
    let window=cx.open_window(size(px(240.),px(60.)),|window,cx|DelegatedInput{input:cx.new(|cx|input_delegate::CompiledComponent::new(json!({"defaultValue":"initial"}),None,window,cx).unwrap_or_else(|_|panic!("delegated Input construction")))});
    let mut visual=VisualTestContext::from_window(AnyWindowHandle::from(window),cx);frames(&mut visual);
    window.update(&mut visual,|host,window,cx|{
        let handle=host.input.read(cx).handle();assert!(ready(&handle.owner));
        assert_eq!(handle.call("sameRun",vec![],window,cx).unwrap_or_else(|_|panic!("handle identity")),json!(true));
        assert_eq!(handle.state("value").unwrap_or_else(|_|panic!("value")),json!("initial"));
        assert_eq!(handle.call("resetValue",vec![json!("new 😀")],window,cx).unwrap_or_else(|_|panic!("reset")),json!(true));
        assert_eq!(handle.state("value").unwrap_or_else(|_|panic!("reset value")),json!("new 😀"));
        assert!(handle.take_failures().is_empty());
    }).unwrap();frames(&mut visual);
}


#[gpui::test]
fn one_logical_participant_with_two_physical_views_cannot_name_or_activate(cx:&mut TestAppContext){
    for target_duplicate in [false,true]{
        let window=open(cx,None);let mut visual=VisualTestContext::from_window(AnyWindowHandle::from(window),cx);frames(&mut visual);
        let initial=window.update(&mut visual,|host,_,cx|host.label.read(cx).owner.borrow().bounds.expect("unique label").center()).unwrap();
        visual.simulate_click(initial,Modifiers::default());
        window.update(&mut visual,|host,_,cx|{
            assert_eq!(events(host,cx),click_signal());
            if target_duplicate{host.repeat_target=true;}else{host.repeat_label=true;}cx.notify();
        }).unwrap();frames(&mut visual);
        let duplicate_position=window.update(&mut visual,|host,window,cx|{
            let label=host.label.read(cx).owner.clone();let button=host.button.read(cx).owner.clone();
            let duplicated=if target_duplicate{button.clone()}else{label.clone()};
            assert_eq!(duplicated.borrow().modules.a11y_bindings,2,"one actual Entity is laid out through two different native parents");
            assert!(control_label_diagnostic(&label).is_some(),"ambiguous physical binding has a diagnostic");
            assert!(!control_label_action_available(&label));
            assert!(projected(&button).labelled_by().is_empty(),"naming may not choose either native occurrence");
            assert!(!control_label_accessibility_action(&label,window,cx),"direct assistive input also requires a unique current view");
            assert!(events(host,cx).is_empty());
            let position=label.borrow().bounds.expect("last laid-out label").center();position
        }).unwrap();
        visual.simulate_click(initial,Modifiers::default());
        visual.simulate_click(duplicate_position,Modifiers::default());
        window.update(&mut visual,|host,_,cx|{
            assert!(events(host,cx).is_empty(),"neither physical occurrence is elected as the pointer owner");
            host.repeat_target=false;host.repeat_label=false;cx.notify();
        }).unwrap();frames(&mut visual);
        window.update(&mut visual,|host,window,cx|{
            let label=host.label.read(cx).owner.clone();let button=host.button.read(cx).owner.clone();
            assert_eq!(label.borrow().modules.a11y_bindings,1);assert_eq!(button.borrow().modules.a11y_bindings,1);
            assert_eq!(control_label_diagnostic(&label),None);
            assert!(control_label_accessibility_action(&label,window,cx));assert_eq!(events(host,cx),click_signal());
        }).unwrap();
        let position=window.update(&mut visual,|host,_,cx|host.label.read(cx).owner.borrow().bounds.unwrap().center()).unwrap();
        visual.simulate_mouse_down(position,MouseButton::Left,Modifiers::default());
        window.update(&mut visual,|host,_,cx|{
            if target_duplicate{host.repeat_target=true;}else{host.repeat_label=true;}cx.notify();
        }).unwrap();frames(&mut visual);
        window.update(&mut visual,|host,_,cx|{host.repeat_target=false;host.repeat_label=false;cx.notify();}).unwrap();frames(&mut visual);
        visual.simulate_mouse_up(position,MouseButton::Left,Modifiers::default());
        window.update(&mut visual,|host,_,cx|assert!(events(host,cx).is_empty(),"an old pointer request cannot revive after an ambiguous frame is removed")).unwrap();
        visual.simulate_click(position,Modifiers::default());
        window.update(&mut visual,|host,_,cx|{assert_eq!(events(host,cx),click_signal());assert!(host.label.read(cx).handle().take_failures().is_empty());}).unwrap();
    }
}
