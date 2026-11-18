//! Real generated components with the immutable published GPUI dependency.
//! TestAppContext is a native framework consumer, not an OS input/paint claim.
use generated_gpui_component::CompiledComponent;
use gpui::{
    prelude::*, px, size, Context, Entity, Focusable, Render, TestAppContext, Window, WindowHandle,
};
use proto_ui_gpui_native::gpui_native_owner::{
    catch_authored, detach_native_view, dispatch, event_fields, expose_event, expose_method,
    expose_value, focus_setup, focus_setup_config, invoke, native_owner_allocation_count,
    native_resource_counts, record, scroll_frame, scroll_request, strict_equal, NativeSnapshot, Owner, OwnerRef, Value,
    TABLE_STRUCTURE_FAMILY,
};
use serde_json::{json, Value as Json};
use std::{
    panic::{catch_unwind, AssertUnwindSafe},
    rc::Rc,
    time::Duration,
};

struct Harness {
    transition: Entity<CompiledComponent>,
    ordinary: Entity<ordinary::CompiledComponent>,
    other: Entity<ordinary::CompiledComponent>,
    plain: Entity<plain::CompiledComponent>,
    scope: Entity<focus_scope::CompiledComponent>,
    first: Entity<focus_target::CompiledComponent>,
    second: Entity<focus_target::CompiledComponent>,
    cold: Entity<cold::CompiledComponent>,
    mutant: Entity<mutant::CompiledComponent>,
    context_a: Entity<context_a::CompiledComponent>,
    context_other: Entity<context_a::CompiledComponent>,
    context_b: Entity<context_b::PrivateContext>,
    context_child: Entity<context_child::CompiledComponent>,
}
impl Render for Harness {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        gpui::div()
            .size_full()
            .child(self.transition.clone())
            .child(self.ordinary.clone())
            .child(self.other.clone())
            .child(self.plain.clone())
            .child(self.scope.clone())
            .child(self.cold.clone())
            .child(self.mutant.clone())
            .child(self.context_a.clone())
            .child(self.context_other.clone())
            .child(self.context_b.clone())
    }
}
fn open(cx: &mut TestAppContext, props: Json) -> WindowHandle<Harness> {
    let handle = cx.open_window(size(px(600.), px(400.)), |window, cx| {
        let transition = CompiledComponent::create(props.clone(), None, window, cx)
            .expect("native construction");
        let ordinary = ordinary::CompiledComponent::create(json!({}), None, window, cx)
            .expect("native construction");
        let other = ordinary::CompiledComponent::create(json!({}), None, window, cx)
            .expect("native construction");
        let plain = plain::CompiledComponent::create(json!({}), None, window, cx)
            .expect("native construction");
        let scope = focus_scope::CompiledComponent::create(json!({}), None, window, cx)
            .expect("native construction");
        let parent = Rc::downgrade(&scope.read(cx).owner);
        let first =
            focus_target::CompiledComponent::create(json!({}), Some(parent.clone()), window, cx)
                .expect("native construction");
        let second = focus_target::CompiledComponent::create(json!({}), Some(parent), window, cx)
            .expect("native construction");
        scope.update(cx, |scope, cx| {
            scope
                .set_slot(
                    vec![
                        NativeSnapshot::native_view(first.clone().into()),
                        NativeSnapshot::native_view(second.clone().into()),
                    ],
                    cx,
                )
                .expect("native slot update")
        });
        let cold = cold::CompiledComponent::create(
            json!({"enterDuration":50,"leaveDuration":50}),
            None,
            window,
            cx,
        )
        .expect("native construction");
        let mutant = mutant::CompiledComponent::create(props, None, window, cx)
            .expect("native construction");
        let context_a = context_a::CompiledComponent::create(json!({}), None, window, cx)
            .expect("native construction");
        let context_other = context_a::CompiledComponent::create(json!({}), None, window, cx)
            .expect("native construction");
        let context_b = context_b::PrivateContext::create(json!({}), None, window, cx)
            .expect("native construction");
        let context_parent = Rc::downgrade(&context_a.read(cx).owner);
        let context_child =
            context_child::CompiledComponent::create(json!({}), Some(context_parent), window, cx)
                .expect("native construction");
        context_a.update(cx, |view, cx| {
            view.set_slot(
                vec![NativeSnapshot::native_view(context_child.clone().into())],
                cx,
            )
            .expect("native slot update")
        });
        Harness {
            transition,
            ordinary,
            other,
            plain,
            scope,
            first,
            second,
            cold,
            mutant,
            context_a,
            context_other,
            context_b,
            context_child,
        }
    });
    handle
        .update(cx, |_, window, _| window.activate_window())
        .unwrap();
    frames(handle, cx);
    handle
}
fn frames(window: WindowHandle<Harness>, cx: &mut TestAppContext) {
    for _ in 0..3 {
        cx.update_window(window.into(), |_, window, cx| {
            window.refresh();
            window.draw(cx).clear(cx);
        })
        .unwrap();
        cx.run_until_parked();
    }
}
fn exposed(owner: &OwnerRef, name: &str) -> Value {
    owner.borrow().exposes.get(name).unwrap().clone()
}
fn event_names(owner: &OwnerRef) -> Vec<String> {
    owner
        .borrow()
        .emitted
        .iter()
        .map(|(name, _)| name.clone())
        .collect()
}

#[gpui::test]
fn generated_scroll_request_outcomes_and_retired_end_work(cx: &mut TestAppContext) {
    let window = open(cx, json!({}));
    let component = window.update(cx, |host, window, cx| {
        let component = validation::CompiledComponent::create(json!({}), None, window, cx)
            .expect("native scroll consumer construction");
        let owner = component.read(cx).owner.clone();
        let before = exposed(&owner, "scrollTo").call(vec![]).expect("unmounted outcome");
        assert_eq!(before.member("kind", false).text(), "rejected");
        assert_eq!(before.member("reason", false).text(), "not-mounted");
        assert!(owner.borrow().modules.scroll.request_status.is_empty());
        for malformed in [record(vec![]), Value::Undefined] {
            let refused = catch_authored(|| scroll_request(&Rc::downgrade(&owner), malformed))
                .expect("unmounted refusal precedes kind validation");
            assert_eq!(refused.member("reason", false).text(), "not-mounted");
        }
        assert!(owner.borrow().modules.scroll.request_status.is_empty());
        assert_eq!(exposed(&owner, "scrollEnd").call(vec![]).unwrap().text(), "rejected");
        assert_eq!(owner.borrow().modules.scroll.request_status, "rejected");
        let plain = host.plain.read(cx).owner.clone();
        let undeclared = scroll_request(&Rc::downgrade(&plain), record(vec![]));
        assert_eq!(undeclared.member("reason", false).text(), "not-declared");
        let undeclared_end = scroll_request(&Rc::downgrade(&plain), record(vec![("kind", Value::string("to-end"))]));
        assert_eq!(undeclared_end.member("reason", false).text(), "not-declared");
        assert!(plain.borrow().modules.scroll.request_status.is_empty());
        host.scope.update(cx, |scope, cx| {
            scope.set_slot(vec![NativeSnapshot::native_view(component.clone().into())], cx)
                .expect("mount native scroll consumer");
        });
        component
    }).unwrap();
    frames(window, cx);
    window.update(cx, |_, native_window, cx| {
        let owner = component.read(cx).owner.clone();
        assert!(owner.borrow().mounted);
        let missing_kind = record(vec![("axis", Value::string("vertical"))]);
        assert!(catch_authored(|| scroll_request(&Rc::downgrade(&owner), missing_kind)).is_err());
        for method in ["scrollToKind", "scrollBy", "scrollPage", "scrollDrag", "scrollEnd"] {
            assert_eq!(exposed(&owner, method).call(vec![]).expect("structured outcome member").text(), "dispatched");
        }
        let wrong_axis = exposed(&owner, "scrollWrongAxis").call(vec![]).expect("axis rejection");
        assert_eq!(wrong_axis.member("kind", false).text(), "rejected");
        assert_eq!(wrong_axis.member("reason", false).text(), "unavailable");
        assert_eq!(owner.borrow().modules.scroll.request_status, "pending");
        assert_eq!(exposed(&owner, "scrollEndWrongAxis").call(vec![]).unwrap().member("reason", false).text(), "unavailable");
        assert_eq!(owner.borrow().modules.scroll.request_status, "rejected");

        // A declared, mounted view can still be unavailable. Restore presence
        // before any host frame so this is an isolated readiness refusal.
        assert_eq!(exposed(&owner, "scrollEnd").call(vec![]).unwrap().text(), "dispatched");
        let was_present = owner.borrow().present;
        owner.borrow_mut().present = false;
        let unavailable_position = exposed(&owner, "scrollTo").call(vec![]);
        let position_status = owner.borrow().modules.scroll.request_status.clone();
        let missing_kind = catch_authored(|| scroll_request(&Rc::downgrade(&owner), record(vec![])));
        let nullish_request = catch_authored(|| scroll_request(&Rc::downgrade(&owner), Value::Undefined));
        let unavailable_end = exposed(&owner, "scrollEnd").call(vec![]);
        let end_status = owner.borrow().modules.scroll.request_status.clone();
        owner.borrow_mut().present = was_present;
        let unavailable_position = unavailable_position.expect("not-present position refusal");
        let unavailable_end = unavailable_end.expect("not-present end refusal");
        assert_eq!(missing_kind.expect("not-ready refusal precedes kind validation").member("reason", false).text(), "unavailable");
        assert_eq!(nullish_request.expect("not-ready refusal precedes property access").member("reason", false).text(), "unavailable");
        assert_eq!(unavailable_position.member("kind", false).text(), "rejected");
        assert_eq!(unavailable_position.member("reason", false).text(), "unavailable");
        assert_eq!(position_status, "pending");
        assert_eq!(unavailable_end.text(), "rejected");
        assert_eq!(end_status, "rejected");

        // A missing handle refuses end delivery without allowing a position
        // refusal to overwrite the pending end status. Restore the real handle.
        assert_eq!(exposed(&owner, "scrollEnd").call(vec![]).unwrap().text(), "dispatched");
        let handle = owner.borrow_mut().modules.scroll.handle.take();
        let unavailable_position = exposed(&owner, "scrollTo").call(vec![]);
        let position_status = owner.borrow().modules.scroll.request_status.clone();
        let unavailable_end = exposed(&owner, "scrollEnd").call(vec![]);
        let end_status = owner.borrow().modules.scroll.request_status.clone();
        owner.borrow_mut().modules.scroll.handle = handle;
        let unavailable_position = unavailable_position.expect("missing-handle position refusal");
        let unavailable_end = unavailable_end.expect("missing-handle end refusal");
        assert_eq!(unavailable_position.member("reason", false).text(), "unavailable");
        assert_eq!(position_status, "pending");
        assert_eq!(unavailable_end.text(), "rejected");
        assert_eq!(end_status, "rejected");
        // An accepted end request belongs to this view epoch. Detaching before
        // its next layout must not apply that work to the replacement view.
        assert_eq!(exposed(&owner, "scrollEnd").call(vec![]).unwrap().text(), "dispatched");
        assert!(owner.borrow().modules.scroll.pending_end.is_some());
        detach_native_view(&owner);
        let detached = exposed(&owner, "scrollTo").call(vec![]).expect("detached outcome");
        assert_eq!(detached.member("reason", false).text(), "not-mounted");
        assert_eq!(owner.borrow().modules.scroll.request_status, "pending");
        // Keep while-at-end configured and following, and control only the
        // historical max observation. The current max/offset come from the
        // real ScrollHandle; this does not claim nonzero physical overflow.
        let offset_before = {
            let mut o = owner.borrow_mut();
            let s = &mut o.modules.scroll;
            let handle = s.handle.as_ref().unwrap();
            let max = handle.max_offset();
            let offset = handle.offset();
            s.following = true;
            s.previous_max = gpui::point(max.x + px(1.), max.y + px(1.));
            assert_ne!(max, s.previous_max);
            offset
        };
        scroll_frame(&owner, native_window);
        assert!(owner.borrow().modules.scroll.pending_end.is_none());
        // On this no-overflow surface, rejected status distinguishes stale-work
        // suppression from fallback application; offset equality alone cannot.
        assert_eq!(owner.borrow().modules.scroll.request_status, "rejected");
        assert_eq!(owner.borrow().modules.scroll.handle.as_ref().unwrap().offset(), offset_before);
    }).unwrap();
    frames(window, cx);
    window.update(cx, |_, _, cx| {
        let owner = component.read(cx).owner.clone();
        assert!(owner.borrow().mounted);
        assert!(owner.borrow().modules.scroll.pending_end.is_none());
        assert_eq!(owner.borrow().modules.scroll.request_status, "rejected");
        assert_eq!(exposed(&owner, "scrollToKind").call(vec![]).unwrap().text(), "dispatched");
        let retained = exposed(&owner, "scrollToKind");
        Owner::dispose(&owner);
        assert!(retained.call(vec![]).is_err());
    }).unwrap();
}

#[gpui::test]
fn ordinary_source_aliases_captures_defaults_exceptions_and_public_values(cx: &mut TestAppContext) {
    let window = open(cx, json!({}));
    frames(window, cx);
    window
        .update(cx, |host, window, cx| {
            let one = host.ordinary.read(cx).handle();
            let two = host.other.read(cx).handle();
            assert_eq!(
                one.call("same", vec![], window, cx)
                    .expect("authored host call"),
                json!(true)
            );
            assert_eq!(
                one.call("increment", vec![], window, cx)
                    .expect("authored host call"),
                json!(1.0)
            );
            assert_eq!(
                one.call("read", vec![], window, cx)
                    .expect("authored host call"),
                json!(1.0)
            );
            assert_eq!(
                two.call("read", vec![], window, cx)
                    .expect("authored host call"),
                json!(0.0)
            );
            assert_eq!(
                one.call("forward", vec![], window, cx)
                    .expect("authored host call"),
                json!("later")
            );
            assert_eq!(
                one.call("even", vec![json!(12)], window, cx)
                    .expect("authored host call"),
                json!(true)
            );
            assert_eq!(
                one.call("even", vec![json!(11)], window, cx)
                    .expect("authored host call"),
                json!(false)
            );
            assert_eq!(
                one.call("defaults", vec![], window, cx)
                    .expect("authored host call"),
                json!(12.0)
            );
            assert_eq!(
                one.call("explicitDefault", vec![json!(8)], window, cx)
                    .expect("authored host call"),
                json!(89.0)
            );
            assert_eq!(
                one.call("defaults", vec![], window, cx)
                    .expect("authored host call"),
                json!(23.0)
            );
            assert_eq!(
                one.call("defaultCapture", vec![], window, cx)
                    .expect("authored host call"),
                json!(7.0)
            );
            assert_eq!(
                one.call("freezeAlias", vec![], window, cx)
                    .expect("authored host call"),
                json!(true)
            );
            assert_eq!(
                one.call("caughtIdentity", vec![], window, cx)
                    .expect("authored host call"),
                json!(true)
            );
            assert_eq!(
                one.call("optional", vec![json!(true)], window, cx)
                    .expect("authored host call"),
                json!({"calls":0.0,"value":-1.0})
            );
            assert_eq!(
                one.call("optional", vec![json!(false)], window, cx)
                    .expect("authored host call"),
                json!({"calls":1.0,"value":42.0})
            );
            assert_eq!(
                one.call("spread", vec![], window, cx)
                    .expect("authored host call"),
                json!({"independent":true,"overwrite":true,"own":true,"finite":true})
            );
            let first = one
                .call("shared", vec![], window, cx)
                .expect("authored host call")
                .as_f64()
                .unwrap();
            assert_eq!(
                two.call("shared", vec![], window, cx)
                    .expect("authored host call"),
                json!(first + 1.)
            );
            let controls = exposed(&one.owner, "controls");
            assert_eq!(
                controls
                    .member("increment", false)
                    .call(vec![])
                    .expect("public callable result")
                    .num(),
                2.
            );
            assert_eq!(
                controls
                    .member("read", false)
                    .call(vec![])
                    .expect("public callable result")
                    .num(),
                2.
            );
            assert!(strict_equal(
                &exposed(&host.transition.read(cx).owner, "sameHandle"),
                &Value::boolean(true)
            ));
        })
        .unwrap();
}

#[gpui::test]
fn no_unrelated_capability_state_handles_listeners_or_metadata_are_initialized(
    cx: &mut TestAppContext,
) {
    let window = open(cx, json!({}));
    frames(window, cx);
    window
        .update(cx, |host, _, cx| {
            assert_eq!(
                exposed(&host.plain.read(cx).owner, "demand").data(),
                json!({"observedCalls":1.0,"tag":7.0,"same":true,"distinct":true})
            );
            let plain = host.plain.read(cx).native_resource_counts();
            for key in [
                "states",
                "hooks",
                "listeners",
                "stateWatchers",
                "propsWatchers",
                "contextSubscriptions",
                "anatomySubscriptions",
                "collectionStates",
                "scrollHandles",
                "boundaryRegions",
                "boundaryCallbacks",
                "metadataKeys",
                "schedulerBindings",
                "delays",
                "presenceOwners",
                "nativeSubscriptions",
            ] {
                assert_eq!(plain[key], json!(0), "unrelated {key}: {plain}");
            }
            for key in [
                "pointerInput",
                "keyInput",
                "boundaryInput",
                "focusObservation",
            ] {
                assert_eq!(plain[key], json!(false), "{key}");
            }
            let ordinary = host.ordinary.read(cx).native_resource_counts();
            assert_eq!(ordinary["schedulerBindings"], json!(1));
            assert_eq!(ordinary["metadataKeys"], json!(0));
            assert_eq!(ordinary["nativeSubscriptions"], json!(0));
            let focus = host.first.read(cx).native_resource_counts();
            assert_eq!(focus["nativeSubscriptions"], json!(3));
            assert_eq!(focus["scrollHandles"], json!(0));
            println!(
                "native-resource-evidence {}",
                json!({"plain":plain,"ordinary":ordinary,"focus":focus})
            );
        })
        .unwrap();
}

#[gpui::test]
fn zero_delay_is_async_cancel_and_dispose_release_pending_work(cx: &mut TestAppContext) {
    let window = open(cx, json!({}));
    frames(window, cx);
    window
        .update(cx, |host, window, cx| {
            let handle = host.ordinary.read(cx).handle();
            handle
                .call("schedule", vec![json!(0)], window, cx)
                .expect("authored host call");
            assert_eq!(
                handle
                    .call("completed", vec![], window, cx)
                    .expect("authored host call"),
                json!(0.0)
            );
        })
        .unwrap();
    frames(window, cx);
    window
        .update(cx, |host, window, cx| {
            let handle = host.ordinary.read(cx).handle();
            assert_eq!(
                handle
                    .call("completed", vec![], window, cx)
                    .expect("authored host call"),
                json!(1.0)
            );
            handle
                .call("schedule", vec![json!(5)], window, cx)
                .expect("authored host call");
            handle
                .call("cancel", vec![], window, cx)
                .expect("authored host call");
        })
        .unwrap();
    cx.background_executor
        .advance_clock(Duration::from_millis(10));
    frames(window, cx);
    window
        .update(cx, |host, window, cx| {
            let handle = host.ordinary.read(cx).handle();
            assert_eq!(
                handle
                    .call("completed", vec![], window, cx)
                    .expect("authored host call"),
                json!(1.0)
            );
            handle
                .call("schedule", vec![json!(1.0e30)], window, cx)
                .expect("authored host call");
            assert_eq!(native_resource_counts(&handle.owner)["delays"], json!(1));
            handle.dispose(window, cx).expect("authored host dispose");
            assert_eq!(native_resource_counts(&handle.owner)["delays"], json!(0));
        })
        .unwrap();
    cx.background_executor
        .advance_clock(Duration::from_secs(10));
    frames(window, cx);
}

#[gpui::test]
fn actual_transition_timer_phase_events_and_zero_duration(cx: &mut TestAppContext) {
    let window = open(
        cx,
        json!({"defaultOpen":true,"enterDuration":0,"leaveDuration":0}),
    );
    frames(window, cx);
    window
        .update(cx, |host, window, cx| {
            let handle = host.transition.read(cx).handle();
            assert_eq!(
                handle.state("transitionState").expect("native State read"),
                json!("entered")
            );
            handle
                .call("leave", vec![], window, cx)
                .expect("authored host call");
            assert_eq!(
                handle.state("transitionState").expect("native State read"),
                json!("leaving")
            );
            assert_eq!(event_names(&handle.owner), vec!["beforeLeave"]);
        })
        .unwrap();
    frames(window, cx);
    window
        .update(cx, |host, window, cx| {
            let handle = host.transition.read(cx).handle();
            assert_eq!(
                handle.state("transitionState").expect("native State read"),
                json!("closed")
            );
            assert_eq!(
                handle.state("isPresent").expect("native State read"),
                json!(false)
            );
            handle
                .call("enter", vec![], window, cx)
                .expect("authored host call");
        })
        .unwrap();
    frames(window, cx);
    window
        .update(cx, |host, _, cx| {
            let handle = host.transition.read(cx).handle();
            assert_eq!(
                handle.state("transitionState").expect("native State read"),
                json!("entered")
            );
            assert_eq!(
                event_names(&handle.owner),
                vec!["beforeLeave", "afterLeave", "beforeEnter", "afterEnter"]
            );
        })
        .unwrap();
}

#[gpui::test]
fn source_mutation_changes_actual_generated_machine_behavior(cx: &mut TestAppContext) {
    let window = open(
        cx,
        json!({"defaultOpen":true,"enterDuration":100,"leaveDuration":100}),
    );
    frames(window, cx);
    window
        .update(cx, |host, window, cx| {
            let original = host.transition.read(cx).handle();
            let mutant = host.mutant.read(cx).handle();
            for name in ["leave", "complete", "enter"] {
                original
                    .call(name, vec![], window, cx)
                    .expect("authored host call");
                mutant
                    .call(name, vec![], window, cx)
                    .expect("authored host call");
            }
        })
        .unwrap();
    frames(window, cx);
    window
        .update(cx, |host, window, cx| {
            let original = host.transition.read(cx).handle();
            let mutant = host.mutant.read(cx).handle();
            original
                .call("complete", vec![], window, cx)
                .expect("authored host call");
            mutant
                .call("complete", vec![], window, cx)
                .expect("authored host call");
            assert_eq!(
                original
                    .state("transitionState")
                    .expect("native State read"),
                json!("entered")
            );
            assert_eq!(
                mutant.state("transitionState").expect("native State read"),
                json!("entered")
            );
            assert_eq!(event_names(&original.owner).last().unwrap(), "afterEnter");
            assert_eq!(event_names(&mutant.owner).last().unwrap(), "beforeLeave");
        })
        .unwrap();
}

#[gpui::test]
fn actual_transition_interrupt_policies_and_cold_preparation(cx: &mut TestAppContext) {
    let window = open(
        cx,
        json!({"defaultOpen":true,"enterDuration":50,"leaveDuration":50,"interrupt":"wait"}),
    );
    frames(window, cx);
    window
        .update(cx, |host, window, cx| {
            let handle = host.transition.read(cx).handle();
            handle
                .call("leave", vec![], window, cx)
                .expect("authored host call");
            handle
                .call("enter", vec![], window, cx)
                .expect("authored host call");
            assert_eq!(
                handle.state("transitionState").expect("native State read"),
                json!("leaving")
            );
            handle
                .call("complete", vec![], window, cx)
                .expect("authored host call");
            let cold = host.cold.read(cx).handle();
            cold.call("enter", vec![], window, cx)
                .expect("authored host call");
            assert_eq!(
                cold.state("transitionState").expect("native State read"),
                json!("preparing")
            );
        })
        .unwrap();
    frames(window, cx);
    window
        .update(cx, |host, window, cx| {
            let handle = host.transition.read(cx).handle();
            assert_eq!(
                handle.state("transitionState").expect("native State read"),
                json!("entering")
            );
            let cold = host.cold.read(cx).handle();
            let release = invoke(
                &cold.owner,
                "expose-method",
                &exposed(&cold.owner, "capturePreparation"),
                vec![],
            );
            assert!(!release.nullish());
            release.call(vec![]).expect("public callable result");
            assert_eq!(
                cold.state("transitionState").expect("native State read"),
                json!("entering")
            );
            cold.call("complete", vec![], window, cx)
                .expect("authored host call");
            assert_eq!(
                cold.state("transitionState").expect("native State read"),
                json!("entered")
            );
            cold.call("leave", vec![], window, cx)
                .expect("authored host call");
            cold.call("complete", vec![], window, cx)
                .expect("authored host call");
            release.call(vec![]).expect("public callable result");
            assert_eq!(
                cold.state("transitionState").expect("native State read"),
                json!("closed")
            );
        })
        .unwrap();
}

#[gpui::test]
fn authored_capture_records_privileged_children_and_shared_registration_order(
    cx: &mut TestAppContext,
) {
    let window = open(cx, json!({}));
    frames(window, cx);
    window.update(cx,|host,_,cx|{
        let proof=exposed(&host.scope.read(cx).owner,"builtinCaptureProof").data();
        assert_eq!(proof,json!({"name":"asFocusable","privileged":true,"mode":"once","order":0.0,"afterOrder":2.0,"afterPrivileged":false,"sameRaw":true,"sameHandle":true,"sameGetter":true,"initiallyFocused":false}));
    }).unwrap();
}

#[gpui::test]
fn default_native_focus_scope_and_roving_use_real_handles(cx: &mut TestAppContext) {
    let window = open(cx, json!({}));
    frames(window, cx);
    for (method, expected_first) in [("first", true), ("next", false), ("next", true)] {
        window
            .update(cx, |host, window, cx| {
                host.scope
                    .read(cx)
                    .handle()
                    .call(method, vec![], window, cx)
                    .expect("authored host call");
                assert_eq!(
                    host.first.focus_handle(cx).is_focused(window),
                    expected_first,
                    "physical focus after {method}"
                );
                assert_eq!(
                    host.second.focus_handle(cx).is_focused(window),
                    !expected_first,
                    "physical focus after {method}"
                );
            })
            .unwrap();
        frames(window, cx);
        window
            .update(cx, |host, _, cx| {
                assert_eq!(
                    host.first
                        .read(cx)
                        .handle()
                        .state("focused")
                        .expect("native State read"),
                    json!(expected_first),
                    "observed focus after {method}"
                );
                assert_eq!(
                    host.second
                        .read(cx)
                        .handle()
                        .state("focused")
                        .expect("native State read"),
                    json!(!expected_first),
                    "observed focus after {method}"
                );
            })
            .unwrap();
    }
    window
        .update(cx, |host, window, cx| {
            host.second
                .read(cx)
                .handle()
                .call("disable", vec![json!(true)], window, cx)
                .expect("authored host call");
            host.scope
                .read(cx)
                .handle()
                .call("last", vec![], window, cx)
                .expect("authored host call");
            assert!(host.first.focus_handle(cx).is_focused(window));
        })
        .unwrap();
}

#[gpui::test]
fn public_callable_results_preserve_alias_scope_and_terminal_lifetime(cx: &mut TestAppContext) {
    let window = open(cx, json!({}));
    frames(window, cx);
    window
        .update(cx, |host, window, cx| {
            let handle = host.ordinary.read(cx).handle();
            assert!(strict_equal(
                &exposed(&handle.owner, "controls"),
                &exposed(&handle.owner, "controlsAlias")
            ));
            let callback = exposed(&handle.owner, "returnFunction")
                .call(vec![])
                .expect("public callable result");
            let returned = exposed(&handle.owner, "returnControls")
                .call(vec![])
                .expect("public callable result");
            assert!(strict_equal(
                &returned,
                &exposed(&handle.owner, "returnControls")
                    .call(vec![])
                    .expect("public callable result")
            ));
            assert_eq!(
                callback.call(vec![]).expect("public callable result").num(),
                1.
            );
            assert_eq!(
                returned
                    .member("increment", false)
                    .call(vec![])
                    .expect("public callable result")
                    .num(),
                2.
            );
            let refreshed = exposed(&handle.owner, "returnControls")
                .call(vec![])
                .expect("public callable result");
            assert!(strict_equal(&returned, &refreshed));
            assert!(strict_equal(
                &returned.member("increment", false),
                &refreshed.member("increment", false)
            ));
            assert_eq!(refreshed.member("value", false).num(), 2.);
            let pure = exposed(&handle.owner, "returnPure")
                .call(vec![])
                .expect("public callable result");
            assert_eq!(
                pure.call(vec![]).expect("public callable result").num(),
                42.
            );
            handle.dispose(window, cx).expect("authored host dispose");
            for callback in [callback, pure, returned.member("increment", false)] {
                assert_eq!(
                    callback
                        .call(vec![])
                        .unwrap_err()
                        .member("code", false)
                        .text(),
                    "OWNER_DISPOSED"
                );
            }
        })
        .unwrap();
}

#[gpui::test]
fn borrowed_state_notifications_snapshot_registrations_and_drain_after_falsy_failure(
    cx: &mut TestAppContext,
) {
    let window = open(cx, json!({}));
    frames(window, cx);
    window
        .update(cx, |host, window, cx| {
            let handle = host.ordinary.read(cx).handle();
            let failure = handle
                .call("write", vec![json!(1)], window, cx)
                .unwrap_err();
            assert_eq!(failure.num(), 0.);
            assert_eq!(
                handle.state("watched").expect("native State read"),
                json!(2.0)
            );
            assert_eq!(
                handle
                    .call("watchTrace", vec![], window, cx)
                    .expect("authored host call"),
                json!("a1,b1,a2,b2,")
            );
            handle
                .call("write", vec![json!(3)], window, cx)
                .expect("authored host call");
            assert_eq!(
                handle
                    .call("watchTrace", vec![], window, cx)
                    .expect("authored host call"),
                json!("a1,b1,a2,b2,a3,b3,")
            );
            // The typed public entry uses the same default Result boundary.
            let typed = host.other.read(cx).handle();
            assert_eq!(typed.method_0(1., window, cx).unwrap_err().num(), 0.);
            assert_eq!(
                typed.state("watched").expect("native State read"),
                json!(2.0)
            );
        })
        .unwrap();
}

#[gpui::test]
fn context_channels_preserve_nested_order_cancellation_and_aggregate_failures(
    cx: &mut TestAppContext,
) {
    let window = open(cx, json!({}));
    frames(window, cx);
    window
        .update(cx, |host, window, cx| {
            let handle = host.ordinary.read(cx).handle();
            // No caller-owned unwind guard: the default public API returns its
            // authored Result before crossing GPUI's Entity lease boundary.
            let failure = host
                .ordinary
                .update(cx, |view, cx| {
                    view.set_props(json!({"contextWrite":1}), window, cx)
                })
                .unwrap_err();
            assert_eq!(failure.num(), 0.);
            assert!(!host.ordinary.read(cx).owner.borrow().disposed);
            assert_eq!(
                handle
                    .call("contextTrace", vec![], window, cx)
                    .expect("authored host call"),
                json!("a1,x1,b1,a2,b2,")
            );
            let failure = host
                .ordinary
                .update(cx, |view, cx| {
                    view.set_props(json!({"contextWrite":5}), window, cx)
                })
                .unwrap_err();
            assert_eq!(failure.member("name", false).text(), "AggregateError");
            let errors = failure.member("errors", false).items();
            assert_eq!(errors.len(), 2);
            assert_eq!(errors[0].num(), 0.);
            assert!(!errors[1].bool());
            host.ordinary.update(cx, |view, cx| {
                view.set_props(json!({"contextWrite":3}), window, cx)
                    .expect("authored host set_props")
            });
            host.ordinary.update(cx, |view, cx| {
                view.set_props(json!({"contextWrite":4}), window, cx)
                    .expect("authored host set_props")
            });
            assert_eq!(
                handle
                    .call("contextTrace", vec![], window, cx)
                    .expect("authored host call"),
                json!("a1,x1,b1,a2,b2,a5,b5,a3,a4,")
            );
        })
        .unwrap();
}

#[gpui::test]
fn unmounted_callbacks_cannot_rearm_delay_even_when_they_throw(cx: &mut TestAppContext) {
    let window = open(cx, json!({}));
    frames(window, cx);
    let mut retained = Vec::new();
    window
        .update(cx, |host, window, cx| {
            host.ordinary.update(cx, |view, cx| {
                view.set_props(json!({"present":false,"rearmOnUnmount":true}), window, cx)
                    .expect("authored host set_props")
            });
            host.other.update(cx, |view, cx| {
                view.set_props(
                    json!({"rearmOnUnmount":true,"throwUnmount":true}),
                    window,
                    cx,
                )
                .expect("authored host set_props")
            });
            let throwing = host.other.read(cx).owner.clone();
            let thrown = catch_authored(|| detach_native_view(&throwing)).unwrap_err();
            assert_eq!(thrown.num(), 0.);
            for owner in [&host.ordinary.read(cx).owner, &throwing] {
                retained.push(exposed(owner, "lifecycle"));
            }
            assert_eq!(native_resource_counts(&throwing)["delays"], json!(0));
            host.other.update(cx, |view, cx| {
                view.set_props(json!({"present":false}), window, cx)
                    .expect("authored host set_props")
            });
        })
        .unwrap();
    frames(window, cx);
    cx.background_executor
        .advance_clock(Duration::from_millis(10));
    frames(window, cx);
    for value in retained {
        assert_eq!(value.member("delayed", false).num(), 0.);
    }
}

#[gpui::test]
fn throwing_before_dispose_retires_resources_and_preserves_falsy_failure(cx: &mut TestAppContext) {
    let window = open(cx, json!({}));
    frames(window, cx);
    window
        .update(cx, |host, window, cx| {
            host.ordinary.update(cx, |view, cx| {
                view.set_props(json!({"failDispose":true}), window, cx)
                    .expect("authored host set_props")
            });
            let handle = host.ordinary.read(cx).handle();
            let observations = exposed(&handle.owner, "lifecycle");
            let pure = exposed(&handle.owner, "returnPure")
                .call(vec![])
                .expect("public callable result");
            handle
                .call("schedule", vec![json!(100)], window, cx)
                .expect("authored host call");
            let failure = handle.dispose(window, cx).unwrap_err();
            assert_eq!(failure.num(), 0.);
            assert!(handle.owner.borrow().disposed);
            assert_eq!(observations.member("first", false).num(), 1.);
            assert_eq!(observations.member("second", false).num(), 0.);
            let resources = host.ordinary.read(cx).native_resource_counts();
            for key in [
                "states",
                "hooks",
                "listeners",
                "stateWatchers",
                "contextSubscriptions",
                "delays",
                "metadataKeys",
                "schedulerBindings",
                "presenceOwners",
                "nativeSubscriptions",
            ] {
                assert_eq!(resources[key], json!(0), "{key}");
            }
            assert_eq!(
                pure.call(vec![]).unwrap_err().member("code", false).text(),
                "OWNER_DISPOSED"
            );
        })
        .unwrap();
}

#[gpui::test]
fn independent_crates_with_identical_context_source_ids_remain_private(cx: &mut TestAppContext) {
    let window = open(cx, json!({}));
    frames(window, cx);
    window
        .update(cx, |host, _, cx| {
            let key = |owner: &OwnerRef| {
                Value::ContextKey(owner.borrow().providers.keys().next().unwrap().clone())
            };
            let first = key(&host.context_a.read(cx).owner);
            let same_module = key(&host.context_other.read(cx).owner);
            let independent = key(&host.context_b.read(cx).owner);
            assert!(strict_equal(&first, &same_module));
            assert!(!strict_equal(&first, &independent));
            let family = |owner: &OwnerRef| {
                Value::StaticCapability(
                    owner
                        .borrow()
                        .modules
                        .topology
                        .claims
                        .values()
                        .find(|claim| claim.family.id != TABLE_STRUCTURE_FAMILY.id)
                        .unwrap()
                        .family,
                )
            };
            let first = family(&host.context_a.read(cx).owner);
            assert!(strict_equal(
                &first,
                &family(&host.context_other.read(cx).owner)
            ));
            assert!(!strict_equal(
                &first,
                &family(&host.context_b.read(cx).owner)
            ));
            assert!(!strict_equal(
                &first,
                &family(&host.context_child.read(cx).owner)
            ));
            let shared = Value::StaticCapability(&TABLE_STRUCTURE_FAMILY);
            for owner in [
                &host.context_a.read(cx).owner,
                &host.context_b.read(cx).owner,
                &host.context_child.read(cx).owner,
            ] {
                let bound = Value::StaticCapability(
                    owner
                        .borrow()
                        .modules
                        .topology
                        .claims
                        .values()
                        .find(|claim| claim.family.id == TABLE_STRUCTURE_FAMILY.id)
                        .unwrap()
                        .family,
                );
                assert!(strict_equal(&shared, &bound));
            }
            assert_eq!(
                host.context_child
                    .read(cx)
                    .handle()
                    .state("value")
                    .expect("native State read"),
                json!(-1.0)
            );
        })
        .unwrap();
}

#[gpui::test]
fn unsupported_physical_focus_cannot_be_enabled_through_manual_sdk(cx: &mut TestAppContext) {
    let window = open(cx, json!({}));
    frames(window, cx);
    window
        .update(cx, |host, _, cx| {
            let owner = host.plain.read(cx).owner.clone();
            let weak = Rc::downgrade(&owner);
            owner.borrow_mut().phase = "setup";
            assert!(catch_unwind(AssertUnwindSafe(|| focus_setup(&weak, "focus-entry"))).is_err());
            assert!(catch_unwind(AssertUnwindSafe(|| focus_setup_config(
                &weak,
                "focus-scope",
                record(vec![("entryFallback", Value::string("entry"))])
            )))
            .is_err());
            owner.borrow_mut().phase = "idle";
            assert!(owner.borrow().modules.hooks.is_empty());
            // Disposal is an ordinary native ownership operation and does not need
            // the unavailable physical focus-tree interface.
            Owner::dispose(&owner);
            assert!(owner.borrow().disposed);
            assert!(
                catch_authored(|| exposed(&host.ordinary.read(cx).owner, "caughtIdentity")
                    .call(vec![])
                    .expect("public callable result"))
                .is_ok()
            );
        })
        .unwrap();
}

#[gpui::test]
fn duplicate_expose_keys_fail_during_actual_generated_setup_and_manual_sdk(
    cx: &mut TestAppContext,
) {
    let window = open(cx, json!({}));
    frames(window, cx);
    let before = window
        .update(cx, |host, window, cx| {
            let before = native_owner_allocation_count();
            let failure = duplicate::CompiledComponent::create(json!({}), None, window, cx)
                .err()
                .expect("duplicate setup must fail");
            assert_eq!(failure.member("code", false).text(), "EXPOSE_DUPLICATE");
            let failure = created_failure::CompiledComponent::create(json!({}), None, window, cx)
                .err()
                .expect("created callback must fail");
            assert_eq!(failure.num(), 0.);
            let next = plain::CompiledComponent::create(json!({}), None, window, cx)
                .expect("host can create another entity after both failures");
            assert!(!next.read(cx).owner.borrow().disposed);
            assert_eq!(
                host.ordinary
                    .read(cx)
                    .handle()
                    .call("forward", vec![], window, cx)
                    .expect("prior entity remains usable"),
                json!("later")
            );
            let vocabulary = host.plain.read(cx).owner.borrow().style_vocabulary;
            let owner = Owner::new(
                json!({}),
                Default::default(),
                |_, _| true,
                |_| true,
                |_, _| true,
                vocabulary,
            );
            let weak = Rc::downgrade(&owner);
            expose_value(&weak, Value::string("same"), Value::number(1.));
            for operation in [0, 1, 2] {
                let failure = catch_authored(|| match operation {
                    0 => expose_value(&weak, Value::string("same"), Value::number(2.)),
                    1 => expose_method(
                        &weak,
                        Value::string("same"),
                        Value::Function(Rc::new(|_| Value::Undefined)),
                    ),
                    _ => expose_event(&weak, Value::string("same")),
                })
                .err()
                .expect("duplicate registration must fail");
                assert_eq!(failure.member("code", false).text(), "EXPOSE_DUPLICATE");
            }
            let failure =
                catch_authored(|| expose_value(&weak, Value::string(""), Value::number(1.)))
                    .err()
                    .expect("empty expose key must fail");
            assert_eq!(failure.member("code", false).text(), "EXPOSE_KEY_INVALID");
            Owner::dispose(&owner);
            before
        })
        .unwrap();
    frames(window, cx);
    // GPUI releases the rejected insertion and the successful temporary entity
    // at its host turn boundary. None may retain a native owner after that turn.
    assert_eq!(native_owner_allocation_count(), before);
}

#[gpui::test]
fn input_control_expires_at_callback_return_and_unwind(cx: &mut TestAppContext) {
    let window = open(cx, json!({}));
    frames(window, cx);
    window
        .update(cx, |host, window, cx| {
            for (target, throws) in [(&host.first, false), (&host.second, true)] {
                let handle = target.read(cx).handle();
                let mut fields = event_fields("key.down");
                fields.insert("key".into(), json!(if throws { "throw" } else { "normal" }));
                assert!(dispatch(&handle.owner, "key.down", false, fields));
                let failures = handle.take_failures();
                assert_eq!(failures.len(), usize::from(throws));
                if throws {
                    assert_eq!(failures[0].error.num(), 0.);
                }
                assert!(!target.read(cx).owner.borrow().disposed);
                dispatch(&handle.owner, "key.up", false, event_fields("key.up"));
                assert_eq!(
                    handle
                        .call("expiredInputRejected", vec![], window, cx)
                        .expect("authored host call"),
                    json!(true)
                );
            }
        })
        .unwrap();
}

#[gpui::test]
fn actual_host_keyboard_failure_reports_exact_value_without_retiring_entity(
    cx: &mut TestAppContext,
) {
    let window = open(cx, json!({}));
    window
        .update(cx, |host, window, cx| {
            host.first
                .read(cx)
                .handle()
                .call("focus", vec![], window, cx)
                .expect("focus native target");
        })
        .unwrap();
    frames(window, cx);
    // Real GPUI key routing runs the generated native callback under its own
    // host lease, with no test-owned catch_authored or manually dispatched event.
    cx.simulate_keystrokes(window.into(), "t");
    window
        .update(cx, |host, window, cx| {
            window.dispatch_event(
                gpui::PlatformInput::KeyUp(gpui::KeyUpEvent {
                    keystroke: gpui::Keystroke::parse("t").unwrap(),
                }),
                cx,
            );
            let handle = host.first.read(cx).handle();
            let failures = handle.take_failures();
            assert_eq!(failures.len(), 1);
            assert_eq!(failures[0].phase, "key.down");
            assert_eq!(failures[0].error.num(), 0.);
            assert!(!handle.owner.borrow().disposed);
            assert_eq!(
                handle
                    .call("expiredInputRejected", vec![], window, cx)
                    .expect("next key callback"),
                json!(true)
            );
        })
        .unwrap();
    cx.simulate_keystrokes(window.into(), "n");
    window
        .update(cx, |host, window, cx| {
            let handle = host.first.read(cx).handle();
            assert!(handle.take_failures().is_empty());
            assert_eq!(
                handle
                    .call("expiredInputRejected", vec![], window, cx)
                    .expect("entity remains callable"),
                json!(true)
            );
        })
        .unwrap();
}

#[gpui::test]
fn state_validation_uses_authored_errors_without_unwinding_native_entities(
    cx: &mut TestAppContext,
) {
    let window = open(cx, json!({}));
    window
        .update(cx, |_, window, cx| {
            let entity = validation::CompiledComponent::create(json!({}), None, window, cx)
                .expect("validation fixture construction");
            let attempt = entity.update(cx, |view, cx| {
                view.handle().call("attempt", vec![], window, cx)
            });
            assert_eq!(
                attempt.expect("source try/catch catches State validation"),
                json!(true)
            );
            let handle = entity.read(cx).handle();
            assert_eq!(handle.call("read", vec![], window, cx).unwrap(), json!(0.0));
            let failure = entity
                .update(cx, |view, cx| {
                    view.handle().call("invalid", vec![], window, cx)
                })
                .expect_err("uncaught validation reaches the native Result boundary");
            assert_eq!(failure.member("name", false).text(), "Error");
            assert_eq!(handle.call("read", vec![], window, cx).unwrap(), json!(0.0));
            assert_eq!(
                handle.call("valid", vec![], window, cx).unwrap(),
                json!(1.0)
            );
            assert!(!entity.read(cx).owner.borrow().disposed);
            let retry = validation_retry::CompiledComponent::create(json!({}), None, window, cx)
                .expect("failed validation cannot reserve the State name");
            let retry_handle = retry.read(cx).handle();
            assert_eq!(retry_handle.value_0().unwrap().data(), json!(true));
            assert_eq!(retry_handle.state_1().unwrap(), 0.);
        })
        .unwrap();
}

#[gpui::test]
fn invalid_native_inputs_return_errors_and_leave_entities_usable(cx: &mut TestAppContext) {
    let window = open(cx, json!({}));
    window
        .update(cx, |host, window, cx| {
            let failure = plain::CompiledComponent::create(json!([]), None, window, cx)
                .err()
                .expect("invalid raw construction props must return an error");
            assert_eq!(failure.member("name", false).text(), "TypeError");
            let entity =
                validation::CompiledComponent::create(json!({}), None, window, cx).unwrap();
            let handle = entity.read(cx).handle();
            let bad_arguments = entity.update(cx, |view, cx| {
                view.handle().call("valid", vec![json!(1)], window, cx)
            });
            assert_eq!(
                bad_arguments.unwrap_err().member("name", false).text(),
                "TypeError"
            );
            assert_eq!(handle.call("read", vec![], window, cx).unwrap(), json!(0.0));
            let unknown = entity.update(cx, |view, cx| {
                view.handle().call("absent", vec![], window, cx)
            });
            assert_eq!(unknown.unwrap_err().member("name", false).text(), "Error");
            assert_eq!(
                handle
                    .state("absent")
                    .unwrap_err()
                    .member("name", false)
                    .text(),
                "Error"
            );
            let bad_props = entity.update(cx, |view, cx| view.set_props(json!([]), window, cx));
            assert_eq!(
                bad_props.unwrap_err().member("name", false).text(),
                "TypeError"
            );
            let bad_slot = entity.update(cx, |view, cx| {
                view.set_slot(vec![NativeSnapshot::slot()], cx)
            });
            assert_eq!(bad_slot.unwrap_err().member("name", false).text(), "Error");
            assert!(entity.read(cx).owner.borrow().slot.is_empty());
            assert_eq!(
                handle.call("valid", vec![], window, cx).unwrap(),
                json!(1.0)
            );
            assert!(!entity.read(cx).owner.borrow().disposed);
            assert!(handle.host_target().is_ok());
            handle.dispose(window, cx).unwrap();
            assert_eq!(
                handle
                    .host_target()
                    .unwrap_err()
                    .member("code", false)
                    .text(),
                "OWNER_DISPOSED"
            );
            let plain = host.plain.read(cx).handle();
            assert_eq!(plain.value_0().unwrap().member("tag", false).num(), 7.);
            plain.dispose(window, cx).unwrap();
            assert_eq!(
                plain.value_0().unwrap_err().member("code", false).text(),
                "OWNER_DISPOSED"
            );
        })
        .unwrap();
}

#[gpui::test]
fn public_values_keep_identity_when_returned_through_the_same_owner(cx: &mut TestAppContext) {
    let window = open(cx, json!({}));
    window
        .update(cx, |_, window, cx| {
            let entity = roundtrip::CompiledComponent::create(json!({}), None, window, cx).unwrap();
            let handle = entity.read(cx).handle();
            let record = entity
                .update(cx, |view, cx| view.handle().method_0(window, cx))
                .unwrap();
            let echoed = entity
                .update(cx, |view, cx| {
                    view.handle().method_1(record.clone(), window, cx)
                })
                .unwrap();
            assert!(
                strict_equal(&record, &echoed),
                "public record echo must keep its identity"
            );
            let action = record.member("action", false);
            assert!(strict_equal(&action, &echoed.member("action", false)));
            assert_eq!(action.call(vec![]).unwrap().num(), 7.);
            let callback = handle.method_2(window, cx).unwrap();
            let echoed_callback = handle.method_3(callback.clone(), window, cx).unwrap();
            assert!(
                strict_equal(&callback, &echoed_callback),
                "public callable echo must keep its identity"
            );
            assert_eq!(echoed_callback.call(vec![]).unwrap().num(), 7.);
            handle.dispose(window, cx).unwrap();
            for callback in [action, callback, echoed_callback] {
                assert_eq!(
                    callback
                        .call(vec![])
                        .unwrap_err()
                        .member("code", false)
                        .text(),
                    "OWNER_DISPOSED"
                );
            }
        })
        .unwrap();
}

#[gpui::test]
fn replaced_members_of_public_records_receive_the_owner_lifetime_guard(cx: &mut TestAppContext) {
    let window = open(cx, json!({}));
    window
        .update(cx, |_, window, cx| {
            let entity =
                public_mutation::CompiledComponent::create(json!({}), None, window, cx).unwrap();
            let handle = entity.read(cx).handle();
            let record = handle.method_0(window, cx).unwrap();
            let first_action = record.member("action", false);
            let returned = handle.method_1(record.clone(), window, cx).unwrap();
            assert!(strict_equal(&record, &returned));
            let action = returned.member("action", false);
            assert!(!strict_equal(&first_action, &action));
            assert_eq!(action.call(vec![]).unwrap().num(), 9.);
            handle.dispose(window, cx).unwrap();
            assert_eq!(
                action
                    .call(vec![])
                    .unwrap_err()
                    .member("code", false)
                    .text(),
                "OWNER_DISPOSED"
            );
            assert_eq!(
                first_action
                    .call(vec![])
                    .unwrap_err()
                    .member("code", false)
                    .text(),
                "OWNER_DISPOSED"
            );
        })
        .unwrap();
}

#[gpui::test]
fn scalar_conversion_matches_the_ecmascript_operator_reference(cx: &mut TestAppContext) {
    let reference: Json = serde_json::from_str(include_str!("scalar-reference.json")).unwrap();
    let window = open(cx, json!({}));
    window
        .update(cx, |_, window, cx| {
            let entity = scalars::CompiledComponent::create(json!({}), None, window, cx).unwrap();
            let handle = entity.read(cx).handle();
            let mut failures = Vec::new();
            for case in reference["strings"].as_array().unwrap() {
                let input = case["input"].clone();
                let actual = handle
                    .call("probe", vec![input.clone()], window, cx)
                    .unwrap();
                let expected = &case["expected"];
                let numeric_equal = if expected["number"].is_null() {
                    actual["number"].is_null()
                } else {
                    actual["number"].as_f64().unwrap().to_bits()
                        == u64::from_str_radix(case["numberBits"].as_str().unwrap(), 16).unwrap()
                };
                if !numeric_equal
                    || ["finite", "nan", "negativeZero", "text"]
                        .iter()
                        .any(|key| actual[key] != expected[key])
                {
                    failures.push(format!("{input}: expected {expected}, actual {actual}"));
                }
            }
            let texts = handle.call("arithmeticTexts", vec![], window, cx).unwrap();
            if texts != reference["arithmeticTexts"] {
                failures.push(format!(
                    "arithmetic text: expected {}, actual {texts}",
                    reference["arithmeticTexts"]
                ));
            }
            assert!(failures.is_empty(), "{}", failures.join("\n"));
        })
        .unwrap();
}

#[gpui::test]
fn pending_and_failed_once_hooks_preserve_the_core_registration_result(cx: &mut TestAppContext) {
    let window = open(cx, json!({}));
    window
        .update(cx, |_, window, cx| {
            let pending = hook_pending::CompiledComponent::create(json!({}), None, window, cx)
                .expect(
                    "same-name pending installation returns fallback without rerunning a loser",
                );
            for key in [
                "initialDistinct",
                "initialTruthy",
                "nestedSame",
                "completeSame",
                "postShadowSame",
                "postShadowWinner",
                "childInstalled",
            ] {
                assert!(
                    exposed(&pending.read(cx).owner, key).bool(),
                    "pending proof {key}"
                );
            }
            assert!(!pending
                .read(cx)
                .owner
                .borrow()
                .exposes
                .contains_key("loser"));
            let failed =
                hook_failed::CompiledComponent::create(json!({}), None, window, cx).unwrap();
            for key in ["attempted", "caught", "freshFallback", "truthyFallback"] {
                assert!(
                    exposed(&failed.read(cx).owner, key).bool(),
                    "failed proof {key}"
                );
            }
            let undefined =
                hook_undefined::CompiledComponent::create(json!({}), None, window, cx).unwrap();
            for key in ["undefinedFirst", "undefinedAgain"] {
                assert!(
                    exposed(&undefined.read(cx).owner, key).bool(),
                    "undefined projection proof {key}"
                );
            }
            let projected =
                hook_project_failed::CompiledComponent::create(json!({}), None, window, cx)
                    .unwrap();
            for key in ["caught", "retainedRawCapture", "truthyCapture"] {
                assert!(
                    exposed(&projected.read(cx).owner, key).bool(),
                    "failed projection proof {key}"
                );
            }
        })
        .unwrap();
}

#[gpui::test]
fn callable_hook_options_capture_the_current_installation_frame(cx: &mut TestAppContext) {
    let window = open(cx, json!({}));
    window
        .update(cx, |_, window, cx| {
            let direct =
                hook_options::CompiledComponent::create(json!({}), None, window, cx).unwrap();
            assert!(exposed(&direct.read(cx).owner, "flagValue").bool());
            let handle = direct.read(cx).handle();
            assert_eq!(
                handle.call("readFlag", vec![], window, cx).unwrap(),
                json!(true)
            );
            let factory =
                hook_options_factory::CompiledComponent::create(json!({}), None, window, cx)
                    .unwrap();
            assert!(exposed(&factory.read(cx).owner, "flagValue").bool());
            let handle = factory.read(cx).handle();
            assert_eq!(
                handle.call("readFlag", vec![], window, cx).unwrap(),
                json!(true)
            );
            let multiple =
                hook_options_multiple::CompiledComponent::create(json!({}), None, window, cx)
                    .unwrap();
            let owner = &multiple.read(cx).owner;
            assert!(exposed(owner, "first").bool());
            assert_eq!(exposed(owner, "second").num(), 2.);
            assert!(!exposed(owner, "firstLeaksSecond").bool());
            assert!(!exposed(owner, "secondLeaksFirst").bool());
            let nested =
                hook_options_nested::CompiledComponent::create(json!({}), None, window, cx)
                    .unwrap();
            let owner = &nested.read(cx).owner;
            assert!(!exposed(owner, "outerLeaksState").bool());
            assert!(exposed(owner, "innerState").bool());
        })
        .unwrap();
}

#[gpui::test]
fn conditional_hook_installation_keeps_each_possible_first_callback(cx: &mut TestAppContext) {
    let window = open(cx, json!({}));
    window
        .update(cx, |_, window, cx| {
            let skipped =
                hook_conditional::CompiledComponent::create(json!({}), None, window, cx).unwrap();
            let handle = skipped.read(cx).handle();
            assert_eq!(
                handle.call("read", vec![], window, cx).unwrap().as_f64(),
                Some(1.)
            );
            let taken =
                hook_conditional_taken::CompiledComponent::create(json!({}), None, window, cx)
                    .unwrap();
            let handle = taken.read(cx).handle();
            assert_eq!(
                handle.call("read", vec![], window, cx).unwrap().as_f64(),
                Some(0.)
            );
            let entity =
                hook_conditional_multiple::CompiledComponent::create(json!({}), None, window, cx)
                    .unwrap();
            let handle = entity.read(cx).handle();
            assert_eq!(
                handle.call("read", vec![], window, cx).unwrap().as_f64(),
                Some(1.)
            );
        })
        .unwrap();
}

#[gpui::test]
fn later_public_mutation_reaches_the_next_native_render(cx: &mut TestAppContext) {
    let window = cx.open_window(size(px(600.), px(400.)), |window, cx| {
        render_mutation::CompiledComponent::new(json!({}), None, window, cx).unwrap()
    });
    for _ in 0..3 {
        cx.update_window(window.into(), |_, window, cx| {
            window.refresh();
            window.draw(cx).clear(cx);
        })
        .unwrap();
        cx.run_until_parked();
    }
    window
        .update(cx, |view, window, cx| {
            {
                let owner = view.owner.borrow();
                assert_eq!(
                    proto_ui_gpui_native::gpui_native_owner::text_content(
                        &owner.projection,
                        &owner.slot
                    ),
                    "1"
                );
            }
            view.handle().call("replace", vec![], window, cx).unwrap();
            // This profile uses explicit updates. The authored Props watcher requests
            // the next render through run.update; the consumer changes normal Props.
            view.set_props(json!({"tick":1}), window, cx).unwrap();
        })
        .unwrap();
    for _ in 0..3 {
        cx.update_window(window.into(), |_, window, cx| {
            window.refresh();
            window.draw(cx).clear(cx);
        })
        .unwrap();
        cx.run_until_parked();
    }
    window
        .update(cx, |view, _, _| {
            {
                let owner = view.owner.borrow();
                assert_eq!(
                    proto_ui_gpui_native::gpui_native_owner::text_content(
                        &owner.projection,
                        &owner.slot
                    ),
                    "9"
                );
            }
            assert!(view.handle().take_failures().is_empty());
        })
        .unwrap();
}
