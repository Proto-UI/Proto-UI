//! Native snapshot contracts for the actual emitted SDK. Unexecuted v9 fixture.
//! Copy this file into the generated consumer's tests/ without editing generated Rust.

use generated_gpui_component::native::gpui_native_owner::{
    assert_native_slot_children, request_update, strict_equal, NativeCallable, NativeSnapshot, Owner, OwnerRef,
    Value,
};
use generated_gpui_component::native::gpui_native_style::StyleVocabulary;
use serde_json::json;
use std::{cell::Cell, panic::{catch_unwind, AssertUnwindSafe}, rc::Rc};

fn owner() -> OwnerRef {
    let vocabulary = StyleVocabulary::from_json(include_str!(
        "../.proto-ui/fixtures/style-tokens.json"
    )).expect("actual generated style fixture");
    Owner::new(json!({}), Default::default(), |_, _| true, |_| true, |_, _| true,
        Box::leak(Box::new(vocabulary)))
}

#[test]
fn snapshots_keep_scalar_observations_and_array_identity() {
    let text = NativeSnapshot::text_value(Value::string("captured"));
    let alias = text.clone();
    assert!(text.equals(&alias));
    assert_eq!((text.text)(&[]), "captured");
    assert!(text.equals_value(&Value::string("captured")));
    let array = NativeSnapshot::sequence(vec![text.clone(), NativeSnapshot::empty()], None);
    let other = NativeSnapshot::sequence(vec![text], None);
    assert!(array.equals(&array.clone()));
    assert!(!array.equals(&other));
    assert_eq!((array.text)(&[]), "captured");
    assert!(array.truthy());
    assert!(!array.nullish());
}

#[test]
fn native_callable_identity_belongs_to_the_runtime_closure() {
    let count = Rc::new(Cell::new(0));
    let captured = count.clone();
    let call: Rc<dyn Fn() -> NativeSnapshot> = Rc::new(move || {
        captured.set(captured.get() + 1);
        NativeSnapshot::text_value(Value::string("native"))
    });
    let first = NativeCallable { identity: Rc::new(()), call: call.clone() };
    let alias = first.clone();
    let distinct = NativeCallable { identity: Rc::new(()), call };
    assert!(first.equals_native(&alias));
    assert!(!first.equals_native(&distinct));
    assert!(first.truthy());
    assert!(!first.nullish());
    assert_eq!((first.call)().text(), "native");
    assert_eq!((alias.call)().text(), "native");
    assert_eq!(count.get(), 2);
}

#[test]
fn escaping_callable_transport_keeps_the_same_identity_without_boxing_children() {
    let call: Rc<dyn Fn() -> NativeSnapshot> = Rc::new(|| {
        NativeSnapshot::text_value(Value::string("captured native result"))
    });
    let native = NativeCallable { identity: Rc::new(()), call };
    let captured = native.clone();
    let escaped = Value::NativeFunction {
        identity: native.identity.clone(),
        render: Rc::new(move |_| (captured.call)()),
    };
    assert!(native.equals_value(&escaped));
    assert!(strict_equal(&escaped, &escaped.clone()));
    let other = Value::NativeFunction {
        identity: Rc::new(()),
        render: Rc::new(|_| NativeSnapshot::text_value(Value::string("captured native result"))),
    };
    assert!(!native.equals_value(&other));
    assert!(!strict_equal(&escaped, &other));
    match escaped {
        Value::NativeFunction { render, .. } => {
            let snapshot = render(vec![]);
            assert_eq!((snapshot.text)(&[]), "captured native result");
            snapshot.assert_children();
        }
        _ => panic!("ordinary escaping callback transport was replaced"),
    }
}

#[test]
fn invalid_children_are_constructible_but_not_committable() {
    let undefined = NativeSnapshot::invalid(Value::Undefined);
    let boolean = NativeSnapshot::invalid(Value::boolean(true));
    assert!(!undefined.truthy());
    assert!(undefined.nullish());
    assert!(boolean.truthy());
    assert!(!boolean.nullish());
    assert!(catch_unwind(AssertUnwindSafe(|| undefined.assert_children())).is_err());
    assert!(catch_unwind(AssertUnwindSafe(|| boolean.assert_children())).is_err());
    // Merely constructing a discarded invalid branch does not reject another result.
    NativeSnapshot::empty().assert_children();
}

#[test]
fn the_text_factory_rejects_boolean_and_undefined_instead_of_coercing_them() {
    for value in [Value::boolean(true), Value::Undefined] {
        assert!(catch_unwind(AssertUnwindSafe(|| NativeSnapshot::text_value(value))).is_err());
    }
    assert_eq!(NativeSnapshot::text_value(Value::string("text")).text(), "text");
    assert_eq!(NativeSnapshot::text_value(Value::number(7.)).scalar_number(), 7.);
}

#[test]
fn anonymous_slot_multiplicity_follows_aliases_and_nested_sequences() {
    let slot = NativeSnapshot::slot();
    let duplicate = NativeSnapshot::sequence(vec![
        slot.clone(), NativeSnapshot::sequence(vec![slot.clone()], None),
    ], None);
    assert_eq!(duplicate.slot_count, 2);
    assert!(catch_unwind(AssertUnwindSafe(|| duplicate.assert_children())).is_err());
    let many = NativeSnapshot::sequence(vec![duplicate.clone(), duplicate], None);
    assert_eq!(many.slot_count, 2, "count saturates rather than wrapping");
    slot.assert_children();
    let external = NativeSnapshot::text_value(Value::string("external"));
    assert_eq!((slot.text)(&[external]), "external");
}

#[test]
fn external_slot_validation_rejects_later_invalid_and_nested_slot_children() {
    let valid = NativeSnapshot::text_value(Value::string("retained"));
    assert_native_slot_children(&[valid.clone()]);
    assert!(catch_unwind(AssertUnwindSafe(|| assert_native_slot_children(&[
        valid.clone(), NativeSnapshot::invalid(Value::boolean(false)),
    ]))).is_err());
    assert!(catch_unwind(AssertUnwindSafe(|| assert_native_slot_children(&[
        NativeSnapshot::sequence(vec![NativeSnapshot::slot()], None),
    ]))).is_err());
    assert_eq!((valid.text)(&[]), "retained");
}

#[test]
fn only_explicit_projection_intent_reinvokes_the_authored_renderer() {
    let owner = owner();
    let calls = Rc::new(Cell::new(0));
    let renderer_calls = calls.clone();
    Owner::finish(&owner, Value::Renderer(Rc::new(move |_| {
        renderer_calls.set(renderer_calls.get() + 1);
        NativeSnapshot::text_value(Value::number(renderer_calls.get() as f64))
    })));
    Owner::project(&owner);
    let first = owner.borrow().projection.as_ref().unwrap().clone();
    let revision = owner.borrow().projection_revision;
    for _ in 0..3 { Owner::project(&owner); }
    assert_eq!(calls.get(), 1);
    assert_eq!(owner.borrow().projection_revision, revision);
    assert!(Rc::ptr_eq(&first.identity, &owner.borrow().projection.as_ref().unwrap().identity));
    request_update(&Rc::downgrade(&owner));
    Owner::project(&owner);
    assert_eq!(calls.get(), 2);
    assert_eq!(owner.borrow().projection_revision, revision + 1);
    assert!(!Rc::ptr_eq(&first.identity, &owner.borrow().projection.as_ref().unwrap().identity));
    Owner::dispose(&owner);
}

#[test]
fn failed_projection_preserves_previous_snapshot_and_restores_the_phase() {
    let owner = owner();
    let invalid = Rc::new(Cell::new(false));
    let chosen = invalid.clone();
    Owner::finish(&owner, Value::Renderer(Rc::new(move |_| {
        if chosen.get() {
            NativeSnapshot::sequence(vec![NativeSnapshot::slot(), NativeSnapshot::slot()], None)
        } else {
            NativeSnapshot::text_value(Value::string("accepted"))
        }
    })));
    Owner::project(&owner);
    let accepted = owner.borrow().projection.as_ref().unwrap().clone();
    let revision = owner.borrow().projection_revision;
    invalid.set(true);
    request_update(&Rc::downgrade(&owner));
    assert!(catch_unwind(AssertUnwindSafe(|| Owner::project(&owner))).is_err());
    assert_eq!(owner.borrow().phase, "idle");
    assert_eq!(owner.borrow().projection_revision, revision);
    assert!(Rc::ptr_eq(&accepted.identity, &owner.borrow().projection.as_ref().unwrap().identity));
    Owner::dispose(&owner);
}

#[test]
fn an_authored_renderer_panic_restores_phase_without_a_partial_projection() {
    let owner = owner();
    let panic_next = Rc::new(Cell::new(false));
    let chosen = panic_next.clone();
    Owner::finish(&owner, Value::Renderer(Rc::new(move |_| {
        assert!(!chosen.get(), "authored renderer failure");
        NativeSnapshot::text_value(Value::string("before failure"))
    })));
    Owner::project(&owner);
    let accepted = owner.borrow().projection.as_ref().unwrap().clone();
    let revision = owner.borrow().projection_revision;
    panic_next.set(true);
    request_update(&Rc::downgrade(&owner));
    assert!(catch_unwind(AssertUnwindSafe(|| Owner::project(&owner))).is_err());
    assert_eq!(owner.borrow().phase, "idle");
    assert_eq!(owner.borrow().projection_revision, revision);
    assert!(Rc::ptr_eq(&accepted.identity, &owner.borrow().projection.as_ref().unwrap().identity));
    Owner::dispose(&owner);
}
