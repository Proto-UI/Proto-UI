#[path = "support/capture_state.rs"]
mod capture_state;

use capture_state::CaptureState;
use std::time::{Duration, Instant};

#[test]
fn current_result_is_consumed_once() {
    let now = Instant::now();
    let mut state = CaptureState::new(now + Duration::from_secs(5));
    assert!(state.pending(now));
    assert!(state.complete(Ok(vec![1, 2, 3]), now));
    assert!(!state.pending(now));
    assert!(!state.complete(Ok(vec![4]), now));
    assert_eq!(state.take(now), Some(Ok(vec![1, 2, 3])));
    assert_eq!(state.take(now), None);
    assert!(!state.complete(Ok(vec![5]), now));
}

#[test]
fn timeout_retires_callback_before_any_output_can_be_returned() {
    let now = Instant::now();
    let deadline = now + Duration::from_secs(5);
    let mut state = CaptureState::<Vec<u8>>::new(deadline);
    assert_eq!(state.take(now), None);
    assert!(!state.pending(deadline));
    assert!(!state.complete(Ok(vec![1]), deadline));
    assert!(state.take(deadline).unwrap().is_err());
    assert!(!state.complete(Ok(vec![2]), deadline));
    assert_eq!(state.take(deadline), None);
}

#[test]
fn failure_is_preserved_and_cannot_be_replaced_by_later_pixels() {
    let now = Instant::now();
    let mut state = CaptureState::<Vec<u8>>::new(now + Duration::from_secs(5));
    assert!(state.complete(Err("capture unavailable".into()), now));
    assert!(!state.complete(Ok(vec![1]), now));
    assert_eq!(state.take(now), Some(Err("capture unavailable".into())));
}
