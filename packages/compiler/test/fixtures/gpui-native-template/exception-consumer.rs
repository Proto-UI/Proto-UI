//! New exception-only consumer for the generated exception-flow.proto.ts crate.
//! The existing original20, foreign5 and actual public composition consumers stay unchanged.
use generated_gpui_component::CompiledComponent;
use gpui::{prelude::*, px, size, App, Context, Entity, Render, TestAppContext, Window};
use proto_ui_gpui_native::gpui_native_owner::{
    anatomy_parts, anatomy_version, authored_finally, authored_finally_override, catch_authored,
    context_read, context_update, invoke, record, strict_equal, throw_value, StaticDeclaration, Value,
};
use serde_json::{json, Value as Json};
use std::{cell::Cell, ops::ControlFlow, panic::{catch_unwind, AssertUnwindSafe}, rc::Rc, sync::Arc};

fn caught(action: impl FnOnce()) -> Value {
    match catch_authored(action) {
        Err(value) => value,
        Ok(()) => panic!("expected an authored throw"),
    }
}

#[test]
fn authored_values_keep_presence_identity_and_numeric_bits() {
    let record_value = record(vec![("code", Value::string("EXAMPLE"))]);
    let array_value = Value::Array(Rc::new(vec![Value::number(1.)]));
    let function_value = Value::Function(Rc::new(|_| Value::Undefined));
    for expected in [Value::Undefined, Value::boolean(false), Value::number(0.),
        Value::Json(Json::Null), Value::string(""), record_value, array_value, function_value] {
        let original = expected.clone();
        let actual = caught(|| throw_value(expected));
        assert!(strict_equal(&actual, &original));
    }
    for number in [-0.0, f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
        let actual = caught(|| throw_value(Value::number(number)));
        assert_eq!(actual.num().to_bits(), number.to_bits());
    }
}

#[test]
fn rethrow_and_caught_string_members_keep_original_values() {
    let original = record(vec![("code", Value::string("OTHER"))]);
    let actual = caught(|| {
        let first = caught(|| throw_value(original.clone()));
        assert!(!strict_equal(&first.caught_member("code", true), &Value::string("EXPECTED")));
        throw_value(first);
    });
    assert!(strict_equal(&actual, &original));
    let text = Value::string("😀a");
    assert!(strict_equal(&text.caught_member("length", false), &Value::number(3.)));
    let high = caught(|| throw_value(text.caught_member("0", false)));
    assert!(!strict_equal(&high, &text.caught_member("1", false)));
    assert!(strict_equal(&high, &text.caught_member("0", false)));
    assert!(strict_equal(&text.caught_member("2", false), &Value::string("a")));
    assert!(strict_equal(&text.caught_member("01", false), &Value::Undefined));
}

#[test]
fn finalizer_completion_overrides_only_authored_completion() {
    let original = record(vec![("code", Value::string("BODY"))]);
    let value: ControlFlow<Value> = authored_finally(
        || throw_value(original),
        || ControlFlow::Break(Value::string("override")),
    );
    match value {
        ControlFlow::Break(value) => assert!(strict_equal(&value, &Value::string("override"))),
        ControlFlow::Continue(()) => panic!("the final return was lost"),
    }
    let replaced = caught(|| {
        let _ = authored_finally(
            || ControlFlow::Break(Value::string("discarded")),
            || throw_value(Value::boolean(false)),
        );
    });
    assert!(strict_equal(&replaced, &Value::boolean(false)));
    let replaced_throw = caught(|| {
        let _: ControlFlow<Value> = authored_finally(
            || throw_value(record(vec![("code", Value::string("first"))])),
            || throw_value(Value::Undefined),
        );
    });
    assert!(strict_equal(&replaced_throw, &Value::Undefined));
    // A proven terminal finally can replace a different concrete Rust return ABI.
    let value: ControlFlow<Value> = authored_finally_override(
        || ControlFlow::<usize>::Break(7),
        || ControlFlow::Break(Value::boolean(true)),
    );
    match value {
        ControlFlow::Break(value) => assert!(value.bool()),
        ControlFlow::Continue(()) => panic!("the final return was lost"),
    }
}

#[test]
fn unrelated_native_failure_keeps_payload_and_runs_cleanup_once() {
    for cleanup_throws in [false, true] {
        let identity = Arc::new(());
        let count = Cell::new(0);
        let result = catch_unwind(AssertUnwindSafe(|| {
            let _: ControlFlow<Value> = authored_finally(
                || match catch_authored(|| std::panic::resume_unwind(Box::new(identity.clone()))) {
                    Ok(value) => value,
                    Err(_) => panic!("an unrelated native payload became an authored value"),
                },
                || {
                    count.set(count.get() + 1);
                    if cleanup_throws { throw_value(Value::Undefined); }
                    ControlFlow::Break(Value::boolean(true))
                },
            );
        }));
        assert_eq!(count.get(), 1);
        let payload = match result {
            Err(payload) => payload,
            Ok(()) => panic!("native failure was converted to success"),
        };
        let retained = payload.downcast::<Arc<()>>().unwrap_or_else(|_| panic!("native payload was replaced"));
        assert!(Arc::ptr_eq(&identity, &retained));
    }
}

struct Harness { component: Entity<CompiledComponent> }
impl Render for Harness {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        gpui::div().child(self.component.clone())
    }
}
impl Harness {
    fn call(&self, name: &str, arguments: Vec<Json>, window: &mut Window, cx: &mut App) -> Json {
        self.component.read(cx).handle().call(name, arguments, window, cx)
    }
}

fn family_config() -> Value {
    let role = || record(vec![("cardinality", record(vec![("min", Value::number(1.)), ("max", Value::number(1.))]))]);
    record(vec![("debugName", Value::string("exception test family")), ("roles", record(vec![("root", role())]))])
}
static UNCLAIMED_FAMILY: StaticDeclaration = StaticDeclaration {
    id: "exception-test-family", kind: "anatomy-family", config: family_config,
};

#[gpui::test]
fn generated_source_control_flow_and_context_failure_delivery(cx: &mut TestAppContext) {
    let window = cx.open_window(size(px(300.), px(200.)), |window, cx| Harness {
        component: cx.new(|cx| CompiledComponent::new(json!({}), None, window, cx)),
    });
    cx.run_until_parked();
    window.update(cx, |host, window, cx| {
        for name in ["sameRecord", "sameArray", "codeDiscrimination", "caughtScope", "propertyError", "stringUnits", "finalThrow", "replaceThrow"] {
            assert_eq!(host.call(name, vec![], window, cx), json!(true), "{name}");
        }
        for tag in 0..5 { assert_eq!(host.call("falsy", vec![json!(tag)], window, cx), json!(true)); }
        for (tag, expected) in [Value::number(0.), Value::boolean(false), Value::Json(Json::Null), Value::Undefined, Value::string("")].into_iter().enumerate() {
            host.call("resetTrace", vec![], window, cx);
            let actual = caught(|| { host.call("uncaughtFalsy", vec![json!(tag)], window, cx); });
            assert!(strict_equal(&actual, &expected));
            assert_eq!(host.call("readTrace", vec![], window, cx), json!("unhandled-final;"));
        }
        host.call("resetTrace", vec![], window, cx);
        assert_eq!(host.call("rethrowRecord", vec![], window, cx), json!(true));
        assert_eq!(host.call("readTrace", vec![], window, cx), json!("body;inner;inner-final;outer;outer-final;"));
        host.call("resetTrace", vec![], window, cx);
        assert_eq!(host.call("finalReturn", vec![], window, cx), json!("override"));
        assert_eq!(host.call("readTrace", vec![], window, cx), json!("try;finally;"));
        host.call("resetTrace", vec![], window, cx);
        assert_eq!(host.call("returnTraceBeforeFinally", vec![], window, cx), json!(""));
        assert_eq!(host.call("readTrace", vec![], window, cx), json!("after;"));
        let owner = host.component.read(cx).handle().owner.clone();
        let key = Value::string(owner.borrow().providers.keys().next().expect("authored provider"));
        for (tag, expected) in [(1, Value::number(0.)), (2, Value::boolean(false)),
            (3, Value::Json(Json::Null)), (4, Value::Undefined)] {
            host.call("resetTrace", vec![], window, cx);
            let weak = Rc::downgrade(&owner);
            let key = key.clone();
            let update = Value::Function(Rc::new(move |_| context_update(&weak, key.clone(), record(vec![("value", Value::number(tag as f64))]), false)));
            let actual = caught(|| { invoke(&owner, "expose-method", &update, vec![]); });
            assert!(strict_equal(&actual, &expected));
            // The authored second subscriber runs after the first throws; tag 1
            // also has a secondary throw, which must not replace the primary 0.
            assert_eq!(host.call("readTrace", vec![], window, cx), json!("later;"));
        }
        host.call("resetTrace", vec![], window, cx);
        let weak = Rc::downgrade(&owner);
        let update_key = key.clone();
        let update = Value::Function(Rc::new(move |_| context_update(&weak, update_key.clone(), record(vec![("value", Value::number(9.))]), false)));
        invoke(&owner, "expose-method", &update, vec![]);
        assert_eq!(host.call("readTrace", vec![], window, cx), json!("later;"));
        assert_eq!(owner.borrow().providers[&key.text()].member("value", false).num(), 9.);

        // Explicit failure injection: remove this real generated owner's provider.
        // This observes error classification, not a complete tree-disposal journey.
        owner.borrow_mut().providers.clear();
        let disconnected = caught(|| { context_read(&Rc::downgrade(&owner), key.clone(), false); });
        assert!(strict_equal(&disconnected.caught_member("code", false), &Value::string("CONTEXT_DISCONNECTED")));
        let invalid_domain = caught(|| { anatomy_parts(&Rc::downgrade(&owner), Value::StaticCapability(&UNCLAIMED_FAMILY), Value::Undefined); });
        assert!(strict_equal(&invalid_domain.caught_member("code", false), &Value::string("ANATOMY_CLAIM_INVALID")));
        let invalid_version = caught(|| { anatomy_version(&Rc::downgrade(&owner), Value::StaticCapability(&UNCLAIMED_FAMILY)); });
        assert!(strict_equal(&invalid_version.caught_member("code", false), &Value::string("ANATOMY_CLAIM_INVALID")));
    }).unwrap();
}
