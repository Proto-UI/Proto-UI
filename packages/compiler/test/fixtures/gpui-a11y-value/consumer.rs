//! Generated component + actual SDK bridge on GPUI's test platform.
//! Window::handle_a11y_action is private in the pinned host. These tests call the
//! same bridge as the registered callback; an OS AT-SPI setter proves that link.
use component::CompiledComponent;
use gpui::{prelude::*, px, size, AnyWindowHandle, Context, Entity, IntoElement,
    Element, Render, TestAppContext, VisualTestContext, Window, WindowHandle};
use gpui::accesskit::ActionData;
use proto_ui_gpui_native::gpui_native_owner::{
    action_from_name, default_accessibility_event, detach_native_view, dispatch,
    dispatch_accessibility_action, event_fields, Owner, OwnerRef, Value,
};
use proto_ui_gpui_native::gpui_native_a11y::Semantics;
use serde_json::json;
use std::rc::Rc;

// This is the production Element::write_a11y_info projection into a real
// AccessKit node. It does not infer properties from the stored owner map.
fn projected_node(owner: &OwnerRef) -> gpui::accesskit::Node {
    let semantics = Semantics { element: gpui::div(), owner: Rc::downgrade(owner), role: Some(gpui::Role::Slider) };
    let mut node = gpui::accesskit::Node::new(semantics.a11y_role().expect("native role"));
    semantics.write_a11y_info(&mut node);
    node
}

struct Harness { component: Entity<CompiledComponent> }
impl Render for Harness {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        gpui::div().size_full().child(self.component.clone())
    }
}
fn open(cx: &mut TestAppContext, disabled: bool) -> WindowHandle<Harness> {
    cx.open_window(size(px(240.), px(80.)), |window, cx| Harness {
        component: cx.new(|cx| CompiledComponent::new(json!({"disabled": disabled}), None, window, cx)
            .unwrap_or_else(|_| panic!("numeric fixture construction failed"))),
    })
}
fn frames(cx: &mut VisualTestContext) {
    for _ in 0..3 {
        cx.update(|window, cx| { window.refresh(); window.draw(cx).clear(cx); });
        cx.run_until_parked();
    }
}

#[gpui::test]
fn finite_native_request_keeps_precision_route_policy_and_control(cx: &mut TestAppContext) {
    let window = open(cx, false);
    let mut visual = VisualTestContext::from_window(AnyWindowHandle::from(window), cx);
    frames(&mut visual);
    window.update(&mut visual, |host, _, cx| {
        let handle = host.component.read(cx).handle();
        assert_eq!(action_from_name("setValue"), gpui::AccessibleAction::SetValue);
        assert_eq!(default_accessibility_event("setValue"), "host:a11y-set-value");
        for next in [0.63, 2.5, -3.125] {
            assert!(dispatch_accessibility_action(&handle.owner, "setValue", Some(&ActionData::NumericValue(next))),
                "the authored synchronous control prevents the native default");
            assert_eq!(handle.take_events(), vec![("requested".into(), json!({"type":"host:numeric-request", "value":next}))]);
            assert_eq!(handle.state("value").unwrap_or_else(|_| panic!("state failed")).as_f64(), Some(0.5),
                "the bridge neither writes State nor clamps the request to its range");
        }
        assert_eq!(handle.state("calls").unwrap_or_else(|_| panic!("state failed")).as_f64(), Some(3.));
        assert_eq!(handle.state("once").unwrap_or_else(|_| panic!("state failed")).as_f64(), Some(1.));
        assert_eq!(handle.state("onceZero").unwrap_or_else(|_| panic!("state failed")).as_f64(), Some(1.));
        assert_eq!(handle.state("onceOne").unwrap_or_else(|_| panic!("state failed")).as_f64(), Some(1.));
        assert_eq!(handle.state("obsolete").unwrap_or_else(|_| panic!("state failed")).as_f64(), Some(0.));
        assert!(handle.take_failures().is_empty());
    }).unwrap();
}

#[gpui::test]
fn invalid_native_and_direct_host_values_do_not_spend_once(cx: &mut TestAppContext) {
    let window = open(cx, false);
    let mut visual = VisualTestContext::from_window(AnyWindowHandle::from(window), cx);
    frames(&mut visual);
    window.update(&mut visual, |host, _, cx| {
        let handle = host.component.read(cx).handle();
        for invalid in [None, Some(ActionData::Value("0.63".into())),
            Some(ActionData::NumericValue(f64::NAN)),
            Some(ActionData::NumericValue(f64::INFINITY)),
            Some(ActionData::NumericValue(f64::NEG_INFINITY))] {
            assert!(!dispatch_accessibility_action(&handle.owner, "setValue", invalid.as_ref()));
        }
        for invalid in [None, Some(json!("0.63")), Some(json!(true)), Some(json!(null))] {
            let mut fields = event_fields("host:numeric-request");
            if let Some(invalid) = invalid { fields.insert("value".into(), invalid); }
            assert!(!dispatch(&handle.owner, "host:numeric-request", false, fields));
        }
        assert!(handle.take_events().is_empty());
        assert_eq!(handle.state("calls").unwrap_or_else(|_| panic!("state failed")).as_f64(), Some(0.));
        assert_eq!(handle.state("once").unwrap_or_else(|_| panic!("state failed")).as_f64(), Some(0.));
        assert_eq!(handle.state("onceZero").unwrap_or_else(|_| panic!("state failed")).as_f64(), Some(0.));
        assert_eq!(handle.state("onceOne").unwrap_or_else(|_| panic!("state failed")).as_f64(), Some(0.));
        assert!(!dispatch_accessibility_action(&handle.owner, "increment", None), "undeclared actions do not dispatch");
        assert!(dispatch_accessibility_action(&handle.owner, "setValue", Some(&ActionData::NumericValue(0.25))));
        assert_eq!(handle.state("once").unwrap_or_else(|_| panic!("state failed")).as_f64(), Some(1.));
        assert_eq!(handle.state("onceZero").unwrap_or_else(|_| panic!("state failed")).as_f64(), Some(1.));
        assert_eq!(handle.state("onceOne").unwrap_or_else(|_| panic!("state failed")).as_f64(), Some(1.));
        assert!(handle.take_failures().is_empty());
    }).unwrap();
}

#[gpui::test]
fn pruned_numeric_declaration_keeps_ingress_guards_for_every_callback_arity(cx: &mut TestAppContext) {
    let window = open(cx, false);
    let mut visual = VisualTestContext::from_window(AnyWindowHandle::from(window), cx);
    frames(&mut visual);
    window.update(&mut visual, |host, _, cx| {
        let handle = host.component.read(cx).handle();
        for invalid in [None, Some(json!("0.63")), Some(json!(true)), Some(json!(null))] {
            let mut fields = event_fields("host:pruned-numeric");
            if let Some(invalid) = invalid { fields.insert("value".into(), invalid); }
            assert!(!dispatch(&handle.owner, "host:pruned-numeric", false, fields));
        }
        for key in ["prunedZero", "prunedOne", "prunedTwo"] {
            assert_eq!(handle.state(key).expect("declared state").as_f64(), Some(0.),
                "invalid direct ingress must not invoke any callback or consume once");
        }
        for value in [0.25, 0.75] {
            let mut fields = event_fields("host:pruned-numeric");
            fields.insert("value".into(), json!(value));
            assert!(!dispatch(&handle.owner, "host:pruned-numeric", false, fields));
            for key in ["prunedZero", "prunedOne", "prunedTwo"] {
                assert_eq!(handle.state(key).expect("declared state").as_f64(), Some(1.));
            }
        }
        assert!(handle.take_events().is_empty());
        assert!(handle.take_failures().is_empty());
    }).unwrap();
}

#[gpui::test]
fn later_numeric_declaration_does_not_filter_an_earlier_generic_listener(cx: &mut TestAppContext) {
    let window = open(cx, false);
    let mut visual = VisualTestContext::from_window(AnyWindowHandle::from(window), cx);
    frames(&mut visual);
    window.update(&mut visual, |host, _, cx| {
        let handle = host.component.read(cx).handle();
        let mut fields = event_fields("host:ordered-numeric");
        fields.insert("value".into(), json!("opaque host input"));
        assert!(!dispatch(&handle.owner, "host:ordered-numeric", false, fields));
        assert_eq!(handle.state("beforeDeclaration").expect("generic state").as_f64(), Some(1.));
        assert_eq!(handle.state("afterDeclaration").expect("numeric state").as_f64(), Some(0.));
        let mut fields = event_fields("host:ordered-numeric");
        fields.insert("value".into(), json!(0.25));
        assert!(!dispatch(&handle.owner, "host:ordered-numeric", false, fields));
        assert_eq!(handle.state("beforeDeclaration").expect("generic state").as_f64(), Some(1.));
        assert_eq!(handle.state("afterDeclaration").expect("numeric state").as_f64(), Some(1.));
        assert!(handle.take_failures().is_empty());
    }).unwrap();
}

#[gpui::test]
fn native_owner_detach_and_terminal_disposal_block_value_delivery(cx: &mut TestAppContext) {
    let window = open(cx, false);
    let mut visual = VisualTestContext::from_window(AnyWindowHandle::from(window), cx);
    frames(&mut visual);
    window.update(&mut visual, |host, _, cx| {
        let handle = host.component.read(cx).handle();
        detach_native_view(&handle.owner);
        assert!(!dispatch_accessibility_action(&handle.owner, "setValue", Some(&ActionData::NumericValue(0.4))));
        assert!(handle.take_events().is_empty());
        Owner::dispose(&handle.owner);
        assert!(!dispatch_accessibility_action(&handle.owner, "setValue", Some(&ActionData::NumericValue(0.8))));
        assert!(handle.take_events().is_empty());
        assert!(handle.take_failures().is_empty());
    }).unwrap();
}

#[gpui::test]
fn authored_disabled_policy_may_reject_a_valid_numeric_request(cx: &mut TestAppContext) {
    let window = open(cx, true);
    let mut visual = VisualTestContext::from_window(AnyWindowHandle::from(window), cx);
    frames(&mut visual);
    window.update(&mut visual, |host, _, cx| {
        let handle = host.component.read(cx).handle();
        assert!(!dispatch_accessibility_action(&handle.owner, "setValue", Some(&ActionData::NumericValue(0.8))));
        assert!(handle.take_events().is_empty());
        assert_eq!(handle.state("calls").unwrap_or_else(|_| panic!("state failed")).as_f64(), Some(0.));
        assert_eq!(handle.state("value").unwrap_or_else(|_| panic!("state failed")).as_f64(), Some(0.5));
        assert!(handle.take_failures().is_empty());
    }).unwrap();
}

#[gpui::test]
fn numeric_facts_reach_the_actual_accesskit_node_and_follow_authored_updates(cx: &mut TestAppContext) {
    let window = open(cx, false);
    let mut visual = VisualTestContext::from_window(AnyWindowHandle::from(window), cx);
    frames(&mut visual);
    window.update(&mut visual, |host, window, cx| {
        let handle = host.component.read(cx).handle();
        let initial = projected_node(&handle.owner);
        assert_eq!(initial.numeric_value(), Some(0.5));
        assert_eq!(initial.min_numeric_value(), Some(0.));
        assert_eq!(initial.max_numeric_value(), Some(1.));
        assert_eq!(initial.value(), Some("Half"));
        assert!(!initial.is_disabled());
        assert!(!initial.is_read_only());
        for value in [0., 0.63, 1.] {
            handle.call("accept", vec![json!(value)], window, cx).unwrap_or_else(|_| panic!("authored accept failed"));
            assert_eq!(projected_node(&handle.owner).numeric_value(), Some(value));
        }
        for flag in [true, false] {
            handle.call("setDisabled", vec![json!(flag)], window, cx).unwrap_or_else(|_| panic!("authored state failed"));
            handle.call("setReadOnly", vec![json!(flag)], window, cx).unwrap_or_else(|_| panic!("authored state failed"));
            let next = projected_node(&handle.owner);
            assert_eq!(next.is_disabled(), flag);
            assert_eq!(next.is_read_only(), flag);
            assert_eq!(next.numeric_value(), Some(1.));
        }
        assert!(handle.take_failures().is_empty());
    }).unwrap();
}

#[gpui::test]
fn numeric_projection_rejects_invalid_native_facts_instead_of_coercing_to_zero(cx: &mut TestAppContext) {
    let window = open(cx, false);
    let mut visual = VisualTestContext::from_window(AnyWindowHandle::from(window), cx);
    frames(&mut visual);
    window.update(&mut visual, |host, _, cx| {
        let handle = host.component.read(cx).handle();
        // Inject bad native facts below the authored State normalizer to test
        // the projector's own finite/type boundary. Valid author State writes
        // still use the generated accept/setDisabled/setReadOnly methods above.
        for invalid in [Value::number(f64::NAN), Value::number(f64::INFINITY),
            Value::number(f64::NEG_INFINITY), Value::string("0.5"), Value::boolean(true), Value::Undefined] {
            for key in ["valueNow", "valueMin", "valueMax"] {
                let state = handle.owner.borrow().accessible_states.get(key).cloned().expect("declared state");
                let Value::State(state) = state else { panic!("expected actual State handle") };
                *state.value.borrow_mut() = invalid.clone();
            }
            let node = projected_node(&handle.owner);
            assert_eq!(node.numeric_value(), None);
            assert_eq!(node.min_numeric_value(), None);
            assert_eq!(node.max_numeric_value(), None);
        }
    }).unwrap();
}

macro_rules! native_control {
    ($harness:ident, $component:path, $open:ident) => {
        struct $harness { component: Entity<$component> }
        impl Render for $harness {
            fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
                gpui::div().size_full().child(self.component.clone())
            }
        }
        fn $open(cx: &mut TestAppContext, props: serde_json::Value) -> WindowHandle<$harness> {
            cx.open_window(size(px(240.), px(80.)), |window, cx| $harness {
                component: cx.new(|cx| <$component>::new(props, None, window, cx)
                    .unwrap_or_else(|_| panic!("authored control construction failed"))),
            })
        }
    };
}
native_control!(ActivationHarness, activation::CompiledComponent, open_activation);
native_control!(HostActivationHarness, host_activation::CompiledComponent, open_host_activation);
native_control!(TextHarness, text::CompiledComponent, open_text);

#[gpui::test]
fn assistive_activation_enters_authored_press_before_expose_and_disabled_policy(cx: &mut TestAppContext) {
    let window = open_activation(cx, json!({}));
    let mut visual = VisualTestContext::from_window(AnyWindowHandle::from(window), cx);
    frames(&mut visual);
    window.update(&mut visual, |host, window, cx| {
        let handle = host.component.read(cx).handle();
        assert_eq!(action_from_name("activate"), gpui::AccessibleAction::Click);
        assert!(dispatch_accessibility_action(&handle.owner, "activate", None));
        assert_eq!(handle.take_events(), vec![("invoked".into(), json!({"count":2.0,"selected":true}))]);
        assert_eq!(handle.state("count").unwrap_or_else(|_| panic!("count state")).as_f64(), Some(2.));
        assert!(dispatch(&handle.owner, "press.commit", false, event_fields("press.commit")));
        assert_eq!(handle.take_events(), vec![("invoked".into(), json!({"count":4.0,"selected":false}))]);
        handle.call("setDisabled", vec![json!(true)], window, cx).unwrap_or_else(|_| panic!("disable"));
        assert!(!dispatch_accessibility_action(&handle.owner, "activate", None));
        assert!(handle.take_events().is_empty());
        assert_eq!(handle.state("count").unwrap_or_else(|_| panic!("count state")).as_f64(), Some(4.));
        detach_native_view(&handle.owner);
        assert!(!dispatch_accessibility_action(&handle.owner, "activate", None));
        Owner::dispose(&handle.owner);
        assert!(!dispatch_accessibility_action(&handle.owner, "activate", None));
        assert!(handle.take_failures().is_empty());
    }).unwrap();
}

#[gpui::test]
fn explicit_host_activation_keeps_its_authored_route_without_trigger(cx: &mut TestAppContext) {
    let window = open_host_activation(cx, json!({}));
    let mut visual = VisualTestContext::from_window(AnyWindowHandle::from(window), cx);
    frames(&mut visual);
    window.update(&mut visual, |host, _, cx| {
        let handle = host.component.read(cx).handle();
        // No portable default prevention was requested by this host extension.
        assert!(!dispatch_accessibility_action(&handle.owner, "activate", None));
        assert_eq!(handle.state("count").unwrap_or_else(|_| panic!("count state")).as_f64(), Some(7.));
        assert_eq!(handle.take_events(), vec![("changed".into(), json!({"count":7.0}))]);
        assert!(handle.take_failures().is_empty());
    }).unwrap();
}

#[gpui::test]
fn conditional_accessibility_projects_only_applicable_current_facts(cx: &mut TestAppContext) {
    let window = open_activation(cx, json!({}));
    let mut visual = VisualTestContext::from_window(AnyWindowHandle::from(window), cx);
    frames(&mut visual);
    window.update(&mut visual, |host, window, cx| {
        let handle = host.component.read(cx).handle();
        let hidden = projected_node(&handle.owner);
        assert_eq!(hidden.toggled(), None);
        assert_eq!(hidden.is_selected(), None);
        assert_eq!(hidden.is_expanded(), None);
        handle.call("setSelected", vec![json!(true)], window, cx).unwrap_or_else(|_| panic!("select"));
        handle.call("setObsolete", vec![json!(false)], window, cx).unwrap_or_else(|_| panic!("obsolete"));
        assert_eq!(projected_node(&handle.owner).toggled(), None);
        handle.call("setApplicable", vec![json!(true)], window, cx).unwrap_or_else(|_| panic!("enable"));
        let active = projected_node(&handle.owner);
        assert_eq!(active.toggled(), Some(gui_toggled(true)));
        assert_eq!(active.is_selected(), Some(true));
        assert_eq!(active.is_expanded(), Some(true));
        handle.call("setApplicable", vec![json!(false)], window, cx).unwrap_or_else(|_| panic!("disable"));
        handle.call("setSelected", vec![json!(false)], window, cx).unwrap_or_else(|_| panic!("select"));
        handle.call("setApplicable", vec![json!(true)], window, cx).unwrap_or_else(|_| panic!("enable"));
        assert_eq!(projected_node(&handle.owner).toggled(), Some(gui_toggled(false)));
        // Probe corrupt runtime facts below State's normalizer. The projector
        // must omit, never coerce, veto or replace that source value.
        let condition = handle.owner.borrow().accessible_state_conditions.get("pressed").cloned().unwrap();
        let Value::State(condition) = condition else { panic!("real condition State") };
        *condition.value.borrow_mut() = Value::Undefined;
        assert_eq!(projected_node(&handle.owner).toggled(), None);
        assert!(matches!(*condition.value.borrow(), Value::Undefined));
        *condition.value.borrow_mut() = Value::boolean(true);
        assert_eq!(projected_node(&handle.owner).toggled(), Some(gui_toggled(false)));
        assert!(handle.take_failures().is_empty());
    }).unwrap();
}
fn gui_toggled(value: bool) -> gpui::Toggled { if value { gpui::Toggled::True } else { gpui::Toggled::False } }

#[gpui::test]
fn generated_text_reset_retains_controlled_truth_and_utf16_scalar_semantics(cx: &mut TestAppContext) {
    for controlled in [false, true] {
        let window = open_text(cx, json!({"controlled":controlled}));
        let mut visual = VisualTestContext::from_window(AnyWindowHandle::from(window), cx);
        frames(&mut visual);
        window.update(&mut visual, |host, window, cx| {
            let handle = host.component.read(cx).handle();
            assert_eq!(handle.call("reset", vec![json!("a\r\n😀候b")], window, cx).unwrap_or_else(|_| panic!("reset")), json!(!controlled));
            assert_eq!(handle.call("value", vec![], window, cx).unwrap_or_else(|_| panic!("value")), json!(if controlled {"truth"} else {"a😀候b"}));
            assert_eq!(handle.call("length", vec![], window, cx).unwrap_or_else(|_| panic!("length")).as_f64(), Some(5.0));
            assert_eq!(handle.call("composing", vec![], window, cx).unwrap_or_else(|_| panic!("composing")), json!(false));
            for (value, floor, round, negative) in [(1.5,1.,2.,false),(-1.5,-2.,-1.,true),(-0.5,-1.,0.,true),(0.49999999999999994,0.,0.,false)] {
                assert_eq!(handle.call("math", vec![json!(value)], window, cx).unwrap_or_else(|_| panic!("math")), json!({"floor":floor,"round":round,"negative":negative}));
            }
            for (input, expected) in [(" 0x10 ","16"),(" 0b11 ","3"),("", "0"),("-0", "0"),("Infinity", "invalid"),("no", "invalid")] {
                assert_eq!(handle.call("parse", vec![json!(input)], window, cx).unwrap_or_else(|_| panic!("parse")), json!(expected));
            }
            assert_eq!(handle.call("reset", vec![], window, cx).unwrap_or_else(|_| panic!("reset default")), json!(!controlled));
            assert_eq!(handle.call("value", vec![], window, cx).unwrap_or_else(|_| panic!("value")), json!(if controlled {"truth"} else {"seed"}));
            detach_native_view(&handle.owner);
            assert_eq!(handle.call("reset", vec![json!("detached")], window, cx).unwrap_or_else(|_| panic!("reset detached")), json!(false));
            assert!(handle.take_failures().is_empty());
        }).unwrap();
    }
}


native_control!(ModifiersHarness, press_modifiers::CompiledComponent, open_press_modifiers);
#[gpui::test]
fn actual_pointer_press_preserves_all_portable_modifiers(cx:&mut TestAppContext) {
    use proto_ui_gpui_native::gpui_native_owner::NativeSnapshot;
    let window=open_press_modifiers(cx,json!({}));
    let mut visual=VisualTestContext::from_window(AnyWindowHandle::from(window),cx);
    window.update(&mut visual,|host,_,cx|host.component.update(cx,|component,cx|component.set_slot(vec![NativeSnapshot::text_value(Value::string("Modified action"))],cx).unwrap_or_else(|_|panic!("native label")))).unwrap();
    frames(&mut visual);
    let point=window.update(&mut visual,|host,_,cx|host.component.read(cx).owner.borrow().bounds.expect("native hit area").center()).unwrap();
    visual.simulate_click(point,gpui::Modifiers{shift:true,control:true,alt:true,platform:true,..Default::default()});
    window.update(&mut visual,|host,_,cx|assert_eq!(host.component.read(cx).handle().take_events(),vec![("pressed".into(),json!({"shift":true,"ctrl":true,"alt":true,"meta":true}))])).unwrap();
}
