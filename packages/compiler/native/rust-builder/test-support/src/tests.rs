#[path = "recorder.rs"]
mod recorder;

use compiled_basesurfaceroot::{BaseSurfaceRoot, BaseSurfaceRootChild, BaseSurfaceRootProps};
use compiled_basetextroot::{BaseTextRoot, BaseTextRootChild, BaseTextRootProps};
use compiled_createdfailure::{CreatedFailure, CreatedFailureProps};
use compiled_createdwatch::{CreatedWatch, CreatedWatchProps};
use compiled_emptyroot::{EmptyRoot, EmptyRootProps};
use compiled_escapedtext::{EscapedText, EscapedTextProps};
use compiled_gpuicounter::{GpuiCounter, GpuiCounterProps};
use compiled_invokereturn::{InvokeReturn, InvokeReturnProps};
use compiled_numericpolicy::{NumericPolicy, NumericPolicyProps};
use compiled_numericstate::{NumericState, NumericStateProps};
use compiled_propsmatrix::{PropsMatrix, PropsMatrixProps};
use compiled_requiredprop::{RequiredProp, RequiredPropProps};
use compiled_rulescheduling::{RuleScheduling, RuleSchedulingProps};
use compiled_slothost::{SlotHost, SlotHostChild, SlotHostProps};
use compiled_updatescheduling::{UpdateScheduling, UpdateSchedulingProps};
use gpui::prelude::*;
use gpui::{point, px, MouseButton};
use std::cell::RefCell;
use std::rc::Rc;
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};

#[test]
fn state_writes_do_not_schedule_native_updates_but_run_update_does() {
    let (text, mut app, mut window) = recorder::recording_window(|_, _| {
        UpdateScheduling::new(UpdateSchedulingProps::default()).unwrap()
    });
    let entity = window.update(|_, _, cx| cx.entity());
    let notifications = Arc::new(AtomicUsize::new(0));
    let observed = notifications.clone();
    let subscription = app.update(|cx| {
        cx.observe(&entity, move |_, _| {
            observed.fetch_add(1, Ordering::SeqCst);
        })
    });
    window.draw();
    text.assert_saw("0");
    window.simulate_click(point(px(20.0), px(20.0)), MouseButton::Left);
    assert_eq!(window.read(|view, _| view.read_state_count()), 1.0);
    assert_eq!(notifications.load(Ordering::SeqCst), 0);
    assert!(!text.lines().iter().any(|line| line == "1"));
    window.simulate_click(point(px(20.0), px(20.0)), MouseButton::Left);
    assert_eq!(window.read(|view, _| view.read_state_count()), 2.0);
    assert_eq!(notifications.load(Ordering::SeqCst), 1);
    window.draw();
    text.assert_saw("2");
    drop(subscription);
    drop(entity);
    drop(window);
    app.update(|cx| cx.shutdown());

    let mut invocation = InvokeReturn::new(InvokeReturnProps::default()).unwrap();
    invocation.handle_click_0().unwrap();
    assert_eq!(invocation.read_state_count(), 1.0);
}

#[test]
fn state_rules_update_root_feedback_without_advancing_template_snapshot() {
    let (text, mut app, mut window) = recorder::recording_window(|_, _| {
        RuleScheduling::new(RuleSchedulingProps::default()).unwrap()
    });
    let entity = window.update(|_, _, cx| cx.entity());
    let notifications = Arc::new(AtomicUsize::new(0));
    let observed = notifications.clone();
    let subscription = app.update(|cx| {
        cx.observe(&entity, move |_, _| {
            observed.fetch_add(1, Ordering::SeqCst);
        })
    });
    let blue = gpui::solid_background(gpui::rgb(0x3b82f6));
    window.draw();
    assert!(!window
        .update(|_, window, _| window.painted_quads())
        .iter()
        .any(|quad| quad.background == blue));
    window.simulate_click(point(px(20.0), px(20.0)), MouseButton::Left);
    assert_eq!(window.read(|view, _| view.read_state_count()), 1.0);
    assert_eq!(notifications.load(Ordering::SeqCst), 1);
    window.draw();
    assert!(window
        .update(|_, window, _| window.painted_quads())
        .iter()
        .any(|quad| quad.background == blue));
    text.assert_saw("0");
    assert!(!text.lines().iter().any(|line| line == "1"));
    drop(subscription);
    drop(entity);
    drop(window);
    app.update(|cx| cx.shutdown());
}

#[test]
fn created_hydration_and_ordered_resolved_watches_match_canonical_snapshots() {
    let props = |label: &str, amount: f64| CreatedWatchProps {
        prop_label: Some(Some(label.to_owned())),
        prop_amount: Some(Some(amount)),
    };
    let (text, mut app, mut window) =
        recorder::recording_window(|_, _| CreatedWatch::new(props("Hydrated", 2.0)).unwrap());
    window.draw();
    text.assert_saw("Hydrated");
    assert_eq!(window.read(|view, _| view.read_state_order()), "");
    assert_eq!(window.read(|view, _| view.read_state_created()), "Hydrated");

    window.update(|view, _, cx| view.set_props(props("Hydrated", 2.0), cx).unwrap());
    assert_eq!(window.read(|view, _| view.read_state_order()), "");
    window.update(|view, _, cx| view.set_props(props("Hydrated", 3.0), cx).unwrap());
    assert_eq!(window.read(|view, _| view.read_state_order()), "AB");
    assert_eq!(window.read(|view, _| view.read_state_previous()), 2.0);
    assert_eq!(window.read(|view, _| view.read_state_current()), 3.0);
    window.update(|view, _, cx| view.set_props(props("Renamed", 3.0), cx).unwrap());
    assert_eq!(window.read(|view, _| view.read_state_order()), "ABAC");
    assert_eq!(window.read(|view, _| view.read_state_created()), "Hydrated");

    window.update(|view, _, cx| view.set_props(props("Renamed", -0.0), cx).unwrap());
    assert!(window
        .read(|view, _| view.read_state_current())
        .is_sign_negative());
    window.update(|view, _, cx| view.set_props(props("Renamed", 0.0), cx).unwrap());
    assert!(window
        .read(|view, _| view.read_state_previous())
        .is_sign_negative());
    assert!(!window
        .read(|view, _| view.read_state_current())
        .is_sign_negative());
    assert_eq!(window.read(|view, _| view.read_state_order()), "ABACABAB");
    window.update(|view, _, cx| view.set_props(props("Renamed", f64::NAN), cx).unwrap());
    assert_eq!(window.read(|view, _| view.read_state_order()), "ABACABAB");
    window.update(|view, _, cx| view.set_props(CreatedWatchProps::default(), cx).unwrap());
    assert_eq!(window.read(|view, _| view.read_state_order()), "ABACABABAC");
    window.draw();
    text.assert_saw("ABACABABAC");

    let error = window.update(|view, _, cx| view.set_props(props("Initial", 13.0), cx));
    assert!(error.is_err());
    assert_eq!(
        window.read(|view, _| view.read_state_order()),
        "ABACABABACA"
    );
    assert_eq!(window.read(|view, _| view.read_state_current()), 13.0);
    window.draw();
    // Live effects and resolved values survive a watcher failure, but a failed
    // host update does not commit a new template. Later watchers do not execute.
    assert_eq!(window.read(|view, _| view.read_prop_amount()), Some(13.0));
    assert!(!text.lines().iter().any(|line| line == "13"));
    assert!(!text.lines().iter().any(|line| line == "ABACABABACA"));
    assert_eq!(window.read(|view, _| view.read_state_created()), "Hydrated");
    drop(window);
    app.update(|cx| cx.shutdown());
    assert!(CreatedFailure::new(CreatedFailureProps::default()).is_err());
}

#[test]
fn native_state_policies_clamp_only_initial_range_and_validate_every_write() {
    let mut view = NumericPolicy::new(NumericPolicyProps::default()).unwrap();
    assert_eq!(view.read_state_bounded(), 0.0);
    assert_eq!(view.read_state_stepped(), 0.5);
    assert_eq!(view.read_state_optioned(), 0.5);
    view.handle_click_0().unwrap();
    assert_eq!(view.read_state_bounded(), 5.0);
    assert!(view.handle_click_1().is_err());
    assert_eq!(view.read_state_bounded(), 5.0);
    view.handle_click_2().unwrap();
    assert_eq!(view.read_state_stepped(), 0.75);
    assert!(view.handle_click_3().is_err());
    assert_eq!(view.read_state_stepped(), 0.75);
    view.handle_click_4().unwrap();
    assert_eq!(view.read_state_optioned(), 2.5);
    assert!(view.handle_click_5().is_err());
    assert_eq!(view.read_state_optioned(), 2.5);
}

struct NativeChildCounter {
    count: usize,
    drops: Arc<AtomicUsize>,
    bounds: Rc<RefCell<Option<gpui::Bounds<gpui::Pixels>>>>,
}
impl Drop for NativeChildCounter {
    fn drop(&mut self) {
        self.drops.fetch_add(1, Ordering::SeqCst);
    }
}
impl gpui::Render for NativeChildCounter {
    fn render(
        &mut self,
        _: &mut gpui::Window,
        cx: &mut gpui::Context<Self>,
    ) -> impl gpui::IntoElement {
        let bounds = self.bounds.clone();
        gpui::div()
            .id("native-child-counter")
            .relative()
            .w_32()
            .h_12()
            .on_click(cx.listener(|this, _, _, cx| {
                this.count += 1;
                cx.notify();
            }))
            .child(format!("Child count {}", self.count))
            .child(
                gpui::canvas(
                    move |layout, _, _| {
                        *bounds.borrow_mut() = Some(layout);
                    },
                    |_, _, _, _| {},
                )
                .absolute()
                .top_0()
                .left_0()
                .size_full(),
            )
    }
}

#[test]
fn mixed_slot_children_keep_native_identity_and_release_replaced_views() {
    let (text, mut app, mut window) =
        recorder::recording_window(|_, _| SlotHost::new(SlotHostProps::default()).unwrap());
    let drops = Arc::new(AtomicUsize::new(0));
    let bounds = Rc::new(RefCell::new(None));
    let child = app.new_entity(|_| NativeChildCounter {
        count: 0,
        drops: drops.clone(),
        bounds: bounds.clone(),
    });
    let weak_child = child.downgrade();
    window.update(|view, _, cx| {
        view.set_children(
            vec![
                SlotHostChild::Text("Slot before".to_owned()),
                SlotHostChild::View(child.clone().into()),
                SlotHostChild::Text("Slot after".to_owned()),
            ],
            cx,
        )
    });
    window.draw();
    for line in [
        "Root before",
        "Slot before",
        "Child count 0",
        "Slot after",
        "Root after",
    ] {
        text.assert_saw(line);
    }
    let position = bounds
        .borrow()
        .expect("native child prepaint bounds")
        .center();
    window.simulate_click(position, MouseButton::Left);
    window.draw();
    assert_eq!(app.read_entity(&child, |view, _| view.count), 1);
    assert_eq!(window.read(|view, _| view.read_state_clicks()), 1.0);
    text.assert_saw("Child count 1");

    window.update(|view, _, cx| {
        view.set_props(
            SlotHostProps {
                prop_label: Some(Some("Updated parent".to_owned())),
            },
            cx,
        )
        .unwrap();
        view.set_children(
            vec![
                SlotHostChild::Text("Replacement text".to_owned()),
                SlotHostChild::View(child.clone().into()),
            ],
            cx,
        );
    });
    window.draw();
    text.assert_saw("Updated parent");
    text.assert_saw("Replacement text");
    assert_eq!(app.read_entity(&child, |view, _| view.count), 1);
    assert_eq!(drops.load(Ordering::SeqCst), 0);
    drop(child);

    // Removing the slot's last owner releases the native Entity after GPUI has
    // retired frame-local element references. No compiler retention registry exists.
    window.update(|view, _, cx| {
        view.set_children(vec![SlotHostChild::Text("Removed child".to_owned())], cx)
    });
    window.draw();
    window.draw();
    app.update(|_| {});
    assert_eq!(drops.load(Ordering::SeqCst), 1);
    assert!(app
        .read(|cx| weak_child.upgrade().map(|entity| entity.read(cx).count))
        .is_none());
    assert_eq!(window.read(|view, _| view.read_state_clicks()), 1.0);
    drop(window);
    app.update(|cx| cx.shutdown());
}

#[test]
fn actual_base_text_and_surface_props_and_slots_reach_native_layout() {
    let (text, mut app, mut window) =
        recorder::recording_window(|_, _| BaseTextRoot::new(BaseTextRootProps::default()).unwrap());
    assert_eq!(
        window.read(|view, _| view.read_prop_size()).as_deref(),
        Some("base")
    );
    window.update(|view, _, cx| {
        view.set_children(
            vec![BaseTextRootChild::Text("Base Text content".to_owned())],
            cx,
        );
        view.set_props(
            BaseTextRootProps {
                prop_size: Some(Some("xl".to_owned())),
                ..Default::default()
            },
            cx,
        )
        .unwrap();
    });
    window.draw();
    text.assert_saw("Base Text content");
    assert_eq!(
        window.read(|view, _| view.read_prop_size()).as_deref(),
        Some("xl")
    );
    window.update(|view, _, cx| {
        view.set_props(
            BaseTextRootProps {
                prop_size: Some(Some("invalid".to_owned())),
                ..Default::default()
            },
            cx,
        )
        .unwrap()
    });
    assert_eq!(
        window.read(|view, _| view.read_prop_size()).as_deref(),
        Some("xl")
    );
    window.update(|view, _, cx| view.set_props(BaseTextRootProps::default(), cx).unwrap());
    assert_eq!(
        window.read(|view, _| view.read_prop_size()).as_deref(),
        Some("base")
    );
    drop(window);
    app.update(|cx| cx.shutdown());

    let (text, mut app, mut window) = recorder::recording_window(|_, _| {
        BaseSurfaceRoot::new(BaseSurfaceRootProps::default()).unwrap()
    });
    assert_eq!(window.read(|view, _| view.read_prop_hovered()), Some(false));
    window.update(|view, _, cx| {
        view.set_children(
            vec![BaseSurfaceRootChild::Text(
                "Base Surface content".to_owned(),
            )],
            cx,
        );
        view.set_props(
            BaseSurfaceRootProps {
                prop_hovered: Some(Some(true)),
                ..Default::default()
            },
            cx,
        )
        .unwrap();
    });
    window.draw();
    text.assert_saw("Base Surface content");
    assert_eq!(window.read(|view, _| view.read_prop_hovered()), Some(true));
    drop(window);
    app.update(|cx| cx.shutdown());
}

#[test]
fn empty_fragment_still_constructs_a_native_root() {
    let (_, mut app, mut window) =
        recorder::recording_window(|_, _| EmptyRoot::new(EmptyRootProps::default()).unwrap());
    window.draw();
    drop(window);
    app.update(|cx| cx.shutdown());
}

#[test]
fn real_native_click_changes_state_and_reaches_text_layout() {
    let (text, mut app, mut window) =
        recorder::recording_window(|_, _| GpuiCounter::new(GpuiCounterProps::default()).unwrap());
    window.draw();
    text.assert_saw("Count:");
    text.assert_saw("0");
    assert_eq!(window.read(|view, _| view.read_state_count()), 0.0);

    window.simulate_click(point(px(20.0), px(20.0)), MouseButton::Left);
    window.draw();
    assert_eq!(window.read(|view, _| view.read_state_count()), 1.0);
    assert!(!window.read(|view, _| view.read_state_hidden()));
    text.assert_saw("1");

    window.simulate_click(point(px(20.0), px(20.0)), MouseButton::Left);
    window.draw();
    assert_eq!(window.read(|view, _| view.read_state_count()), 0.5);
    assert!(window.read(|view, _| view.read_state_hidden()));
    text.assert_saw("0.5");

    window.update(|view, _, cx| {
        view.set_props(
            GpuiCounterProps {
                prop_label: Some(Some("Updated:".to_owned())),
            },
            cx,
        )
        .unwrap()
    });
    window.draw();
    text.assert_saw("Updated:");
    assert_eq!(window.read(|view, _| view.read_state_count()), 0.5);
    assert!(window.update(|view, _, _| view.take_error()).is_none());
    drop(window);
    app.update(|cx| cx.shutdown());
}

#[test]
fn full_prop_snapshots_preserve_canonical_fallback_history() {
    let mut view = PropsMatrix::new(PropsMatrixProps::default()).unwrap();
    assert_eq!(view.read_prop_label().as_deref(), Some("Default"));
    assert_eq!(view.read_prop_amount(), Some(2.0));
    assert_eq!(view.read_prop_nullable().as_deref(), Some("Fallback"));

    view.update_props(PropsMatrixProps {
        prop_label: Some(Some("First".to_owned())),
        prop_amount: Some(Some(7.0)),
        prop_nullable: Some(Some("Accepted".to_owned())),
    })
    .unwrap();
    view.update_props(PropsMatrixProps {
        prop_label: Some(None),
        prop_amount: Some(Some(f64::INFINITY)),
        prop_nullable: Some(None),
    })
    .unwrap();
    assert_eq!(view.read_prop_label().as_deref(), Some("First"));
    assert_eq!(view.read_prop_amount(), Some(7.0));
    assert_eq!(view.read_prop_nullable(), None);

    // Omitting a property releases the host value, without deleting prevValid.
    view.update_props(PropsMatrixProps::default()).unwrap();
    assert_eq!(view.read_prop_label().as_deref(), Some("Default"));
    assert_eq!(view.read_prop_amount(), Some(2.0));
    view.update_props(PropsMatrixProps {
        prop_label: Some(None),
        prop_amount: Some(Some(-1.0)),
        prop_nullable: None,
    })
    .unwrap();
    assert_eq!(view.read_prop_label().as_deref(), Some("First"));
    assert_eq!(view.read_prop_amount(), Some(7.0));

    // No host value was provided to this second instance: histories are separate.
    let second = PropsMatrix::new(PropsMatrixProps {
        prop_label: Some(None),
        prop_amount: Some(Some(f64::NAN)),
        prop_nullable: None,
    })
    .unwrap();
    assert_eq!(second.read_prop_label().as_deref(), Some("Default"));
    assert_eq!(second.read_prop_amount(), Some(2.0));
}

#[test]
fn required_props_error_only_when_no_nonempty_fallback_exists() {
    assert!(RequiredProp::new(RequiredPropProps::default()).is_err());
    let mut view = RequiredProp::new(RequiredPropProps {
        prop_required: Some(Some("Provided".to_owned())),
    })
    .unwrap();
    view.update_props(RequiredPropProps {
        prop_required: Some(None),
    })
    .unwrap();
    assert_eq!(view.read_prop_required().as_deref(), Some("Provided"));
    assert!(view.update_props(RequiredPropProps::default()).is_err());
}

#[test]
fn native_f64_actions_match_signed_zero_fraction_and_non_nan_validation() {
    let mut view = NumericState::new(NumericStateProps::default()).unwrap();
    assert!(view.read_state_number().is_sign_negative());
    view.handle_click_0().unwrap();
    assert_eq!(view.read_state_number(), 0.0);
    assert!(!view.read_state_number().is_sign_negative());
    view.handle_click_1().unwrap();
    assert_eq!(view.read_state_number(), f64::INFINITY);
    view.handle_click_2().unwrap();
    assert_eq!(view.read_state_number(), 0.5);
    assert!(view.handle_click_3().is_err());
    assert_eq!(view.read_state_number(), 0.5);
}

#[test]
fn numeric_display_uses_ecmascript_formatting_in_real_render() {
    let (text, mut app, mut window) =
        recorder::recording_window(|_, _| NumericState::new(NumericStateProps::default()).unwrap());
    window.draw();
    text.assert_saw("0");
    assert!(!text.lines().iter().any(|line| line == "-0"));
    window.update(|view, _, cx| {
        view.handle_click_1().unwrap();
        view.set_props(NumericStateProps::default(), cx).unwrap();
    });
    window.draw();
    text.assert_saw("Infinity");
    window.update(|view, _, cx| {
        view.handle_click_2().unwrap();
        view.set_props(NumericStateProps::default(), cx).unwrap();
    });
    window.draw();
    text.assert_saw("0.5");
    window.simulate_click(point(px(20.0), px(20.0)), MouseButton::Left);
    window.draw();
    // Registered handlers run in source order, and an invalid set stops the
    // remaining callbacks. The fifth callback's 999 must never be assigned.
    assert_eq!(window.read(|view, _| view.read_state_number()), 0.5);
    assert!(window.update(|view, _, _| view.take_error()).is_some());
    drop(window);
    app.update(|cx| cx.shutdown());
}

#[test]
fn escaped_literals_reach_gpui_as_text() {
    let (text, mut app, mut window) =
        recorder::recording_window(|_, _| EscapedText::new(EscapedTextProps::default()).unwrap());
    window.draw();
    let lines = text.lines().join("\n");
    assert!(lines.contains("\"; panic!(\"injected\"); //"), "{lines:?}");
    assert!(lines.contains("<script>& 😀"), "{lines:?}");
    drop(window);
    app.update(|cx| cx.shutdown());
}
