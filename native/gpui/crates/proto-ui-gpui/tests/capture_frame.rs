#[path = "support/capture_frame.rs"]
mod capture_frame;
#[path = "support/capture_pixels.rs"]
mod capture_pixels;
#[path = "support/capture_state.rs"]
mod capture_state;

use capture_frame::{Admission, FrameAdmission, Metadata, ResourceFailure, StopGate};
use std::time::{Duration, Instant};

fn metadata() -> Metadata {
    Metadata {
        valid: true,
        ready: true,
        status: Some(0),
        display_time: Some(200),
        width: 300,
        height: 332,
    }
}

fn current(now: Instant) -> FrameAdmission {
    let mut gate = FrameAdmission::new(100, 300, 332, now + Duration::from_secs(5));
    assert!(gate.bind_stream(7));
    gate
}

#[test]
fn first_complete_current_native_frame_is_admitted_once() {
    let now = Instant::now();
    let mut gate = current(now);
    assert_eq!(gate.observe(7, metadata(), 300, now), Admission::FirstComplete);
    assert_eq!(gate.observe(7, metadata(), 301, now), Admission::Retired);
}

#[test]
fn started_idle_blank_suspended_stopped_and_unknown_frames_do_not_admit_pixels() {
    let now = Instant::now();
    let mut gate = current(now);
    for status in [None, Some(1), Some(2), Some(3), Some(4), Some(5), Some(99)] {
        let mut frame = metadata();
        frame.status = status;
        assert!(matches!(gate.observe(7, frame, 300, now), Admission::Observe(_)));
    }
    assert_eq!(gate.observe(7, metadata(), 300, now), Admission::FirstComplete);
}

#[test]
fn invalid_or_unready_buffers_do_not_admit_pixels() {
    let now = Instant::now();
    let mut gate = current(now);
    for (valid, ready) in [(false, false), (false, true), (true, false)] {
        let mut frame = metadata();
        frame.valid = valid;
        frame.ready = ready;
        assert!(matches!(gate.observe(7, frame, 300, now), Admission::Observe(_)));
    }
    assert_eq!(gate.observe(7, metadata(), 300, now), Admission::FirstComplete);
}

#[test]
fn absent_previous_phase_and_future_display_times_cannot_be_current_pixels() {
    let now = Instant::now();
    let mut gate = current(now);
    for display_time in [None, Some(0), Some(99), Some(301)] {
        let mut frame = metadata();
        frame.display_time = display_time;
        assert!(matches!(gate.observe(7, frame, 300, now), Admission::Observe(_)));
    }
    assert_eq!(gate.observe(7, metadata(), 300, now), Admission::FirstComplete);
}

#[test]
fn missing_phase_clock_never_qualifies_a_frame() {
    let now = Instant::now();
    let mut gate = FrameAdmission::new(0, 300, 332, now + Duration::from_secs(5));
    assert!(gate.bind_stream(7));
    assert!(matches!(gate.observe(7, metadata(), 300, now), Admission::Observe(_)));
}

#[test]
fn a_foreign_stream_is_terminal_even_if_its_dimensions_and_pixels_would_match() {
    let now = Instant::now();
    let mut gate = current(now);
    assert!(matches!(gate.observe(8, metadata(), 300, now), Admission::Fail(_)));
    assert_eq!(gate.observe(7, metadata(), 300, now), Admission::Retired);
}

#[test]
fn a_missing_or_replaced_stream_binding_is_not_accepted() {
    let now = Instant::now();
    let mut unbound = FrameAdmission::new(100, 300, 332, now + Duration::from_secs(5));
    assert!(matches!(
        unbound.observe(7, metadata(), 300, now),
        Admission::Fail(_)
    ));
    assert!(!unbound.bind_stream(7));
    let mut gate = FrameAdmission::new(100, 300, 332, now + Duration::from_secs(5));
    assert!(!gate.bind_stream(0));
    assert!(gate.bind_stream(7));
    assert!(!gate.bind_stream(8));
    assert_eq!(gate.observe(7, metadata(), 300, now), Admission::FirstComplete);
}

#[test]
fn complete_frame_dimension_failure_cannot_be_replaced_by_a_later_correct_frame() {
    let now = Instant::now();
    for (width, height) in [(0, 332), (301, 332), (300, 331)] {
        let mut gate = current(now);
        let mut frame = metadata();
        frame.width = width;
        frame.height = height;
        assert!(matches!(gate.observe(7, frame, 300, now), Admission::Fail(_)));
        assert_eq!(gate.observe(7, metadata(), 300, now), Admission::Retired);
    }
}

#[test]
fn deadline_is_not_reset_by_an_incomplete_frame() {
    let now = Instant::now();
    let mut gate = current(now);
    let mut started = metadata();
    started.status = Some(4);
    assert!(matches!(
        gate.observe(7, started, 300, now + Duration::from_secs(4)),
        Admission::Observe(_)
    ));
    assert!(matches!(
        gate.observe(7, metadata(), 301, now + Duration::from_secs(5)),
        Admission::Fail(_)
    ));
    assert_eq!(gate.observe(7, metadata(), 302, now), Admission::Retired);
}

#[test]
fn cancellation_retires_old_phase_without_admitting_its_late_callback() {
    let now = Instant::now();
    let mut old = current(now);
    old.retire();
    let mut next = FrameAdmission::new(400, 300, 332, now + Duration::from_secs(5));
    assert!(next.bind_stream(8));
    assert_eq!(old.observe(7, metadata(), 500, now), Admission::Retired);
    let mut current_frame = metadata();
    current_frame.display_time = Some(450);
    assert_eq!(next.observe(8, current_frame, 500, now), Admission::FirstComplete);
}

#[test]
fn first_complete_black_frame_fails_original_pixel_oracle_and_cannot_be_replaced() {
    let now = Instant::now();
    let mut gate = current(now);
    assert_eq!(gate.observe(7, metadata(), 300, now), Admission::FirstComplete);
    let mut black = vec![0; 300 * 332 * 4];
    for pixel in black.chunks_exact_mut(4) {
        pixel[3] = 255;
    }
    let report = capture_pixels::inspect(
        300,
        332,
        &black,
        capture_pixels::content_rect(300, 332, 1.0, [0.0, 0.0, 300.0, 300.0]).unwrap(),
        1.0,
    )
    .unwrap();
    assert!(!report.passed());
    assert_eq!(report.content.y, 32);
    for (index, label) in report.labels.iter().enumerate() {
        assert_eq!(label.label, ["passive", "actionable"][index]);
        assert_eq!(label.roi.x, 16);
        assert_eq!(label.roi.y, 48 + index * 64);
        assert_eq!(label.roi.width, 268);
        assert_eq!(label.roi.height, 32);
        assert_eq!(label.background, 0);
        assert_eq!(label.ink, 8576);
        assert_eq!(label.ink_columns, 268);
        assert_eq!(label.ink_rows, 32);
        assert_eq!(label.segmented_rows, 0);
        assert!(!label.passed);
    }
    assert_eq!(gate.observe(7, metadata(), 301, now), Admission::Retired);
}

#[test]
fn stop_error_after_pixel_retirement_or_timeout_cannot_be_replaced_by_success() {
    let now = Instant::now();
    let deadline = now + Duration::from_secs(5);
    let mut pixels = current(now);
    assert_eq!(
        pixels.observe(7, metadata(), 300, now),
        Admission::FirstComplete
    );
    pixels.retire();
    let mut resource = ResourceFailure::default();
    assert!(resource.record("same-stream delegate stop error 17".into()));
    assert!(!resource.record("a later error cannot replace the first".into()));
    // Native stop, output removal and queue drain can all succeed after the
    // delegate failure; sealing must still make that cleanup result fail.
    let fenced = match resource.seal() {
        Some(error) => Err(error),
        None => Ok(()),
    };
    let mut stopped = capture_state::CaptureState::new(deadline);
    assert!(stopped.complete(fenced, now));
    assert!(!stopped.complete(Ok(()), now));
    assert_eq!(
        stopped.take(now).unwrap().unwrap_err(),
        "same-stream delegate stop error 17"
    );
    assert_eq!(
        resource.error().map(String::as_str),
        Some("same-stream delegate stop error 17")
    );
    let mut completed_phase = ResourceFailure::default();
    assert_eq!(completed_phase.seal(), None);
    assert!(!completed_phase.record("late old-phase delegate error".into()));
    assert_eq!(completed_phase.error(), None);
    let mut failed = capture_state::CaptureState::<()>::new(deadline);
    assert!(failed.complete(Err("native stop failed".into()), now));
    assert!(!failed.complete(Ok(()), now));
    assert!(failed.take(now).unwrap().is_err());
    let mut expired = capture_state::CaptureState::<()>::new(deadline);
    assert!(expired.take(deadline).unwrap().is_err());
    assert!(!expired.complete(Ok(()), deadline));
    assert!(!expired.pending(deadline));
}

#[test]
fn cancellation_before_start_stays_pending_and_stops_the_late_start_once() {
    let gate = StopGate::default();
    assert!(!gate.request());
    assert!(!gate.request());
    assert!(gate.requested());
    assert!(!gate.started());
    assert_eq!(gate.complete_start(), Some(true));
    assert_eq!(gate.complete_start(), None);
    assert!(!gate.request());
    assert!(gate.complete_stop());
    assert!(!gate.complete_stop());
    assert!(gate.completed());
}

#[test]
fn normal_start_then_cancellation_issues_exactly_one_stop() {
    let gate = StopGate::default();
    assert_eq!(gate.complete_start(), Some(false));
    assert!(gate.started());
    assert!(!gate.requested());
    assert!(!gate.complete_stop());
    assert!(gate.request());
    assert!(!gate.request());
    assert!(gate.complete_stop());
    assert!(!gate.complete_stop());
}

#[test]
fn racing_start_and_drop_cannot_lose_or_duplicate_the_stop_request() {
    use std::sync::{Arc, Barrier};
    let gate = Arc::new(StopGate::default());
    let barrier = Arc::new(Barrier::new(2));
    let starting_gate = Arc::clone(&gate);
    let starting_barrier = Arc::clone(&barrier);
    let start = std::thread::spawn(move || {
        starting_barrier.wait();
        starting_gate.complete_start().unwrap()
    });
    barrier.wait();
    let stopped_here = gate.request();
    assert_ne!(stopped_here, start.join().unwrap());
    assert!(gate.complete_stop());
}
