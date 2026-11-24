#[path = "recorder.rs"]
mod recorder;

use compiled_escapedtext::{EscapedText, EscapedTextProps};
use compiled_gpuicounter::{GpuiCounter, GpuiCounterProps};
use compiled_numericstate::{NumericState, NumericStateProps};
use compiled_propsmatrix::{PropsMatrix, PropsMatrixProps};
use compiled_requiredprop::{RequiredProp, RequiredPropProps};
use gpui::{point, px, MouseButton};

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
        cx.notify();
    });
    window.draw();
    text.assert_saw("Infinity");
    window.update(|view, _, cx| {
        view.handle_click_2().unwrap();
        cx.notify();
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
