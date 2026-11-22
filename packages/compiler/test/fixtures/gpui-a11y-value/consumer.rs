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
