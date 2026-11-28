//! Real CaptureState ownership controls. These prove the Rust handoff/drop
//! behavior, not ScreenCaptureKit's foreign-object thread-safety contract.

#[path = "support/capture_state.rs"]
mod capture_state;

use capture_state::CaptureState;
use std::cell::Cell;
use std::sync::{Arc, Barrier, Mutex};
use std::thread::{self, ThreadId};
use std::time::{Duration, Instant};

type Drops = Arc<Mutex<Vec<(usize, ThreadId)>>>;

// Deliberately non-Clone and !Sync, like the sealed native preparation pair.
// Mutex handoff requires Send, not concurrent access to the value itself.
struct Owner {
    identity: usize,
    value: Cell<usize>,
    drops: Drops,
}

impl Owner {
    fn new(identity: usize, drops: &Drops) -> Self {
        Self {
            identity,
            value: Cell::new(42),
            drops: Arc::clone(drops),
        }
    }
}

impl Drop for Owner {
    fn drop(&mut self) {
        self.drops
            .lock()
            .unwrap()
            .push((self.identity, thread::current().id()));
    }
}

#[test]
fn the_complete_owner_moves_once_from_producer_to_consumer() {
    fn send_sync<T: Send + Sync>() {}
    send_sync::<Arc<Mutex<CaptureState<Owner>>>>();
    let now = Instant::now();
    let state = Arc::new(Mutex::new(CaptureState::new(now + Duration::from_secs(5))));
    let drops = Drops::default();
    let callback = Arc::clone(&state);
    let callback_drops = Arc::clone(&drops);
    let producer = thread::spawn(move || {
        let owner = Owner::new(1, &callback_drops);
        owner.value.set(84);
        let mut state = callback.lock().unwrap();
        assert!(state.pending(now));
        assert!(state.complete(Ok(owner), now));
        thread::current().id()
    })
    .join()
    .unwrap();
    assert_ne!(producer, thread::current().id());
    assert!(drops.lock().unwrap().is_empty());
    let owner = state.lock().unwrap().take(now).unwrap().unwrap();
    assert_eq!(owner.identity, 1);
    assert_eq!(owner.value.get(), 84);
    assert!(!state.lock().unwrap().pending(now));
    assert!(state.lock().unwrap().take(now).is_none());
    drop(owner);
    drop(state);
    assert_eq!(*drops.lock().unwrap(), vec![(1, thread::current().id())]);
}

#[test]
fn a_duplicate_callback_drops_only_its_rejected_owner() {
    let now = Instant::now();
    let state = Arc::new(Mutex::new(CaptureState::new(now + Duration::from_secs(5))));
    let drops = Drops::default();
    let callback = Arc::clone(&state);
    let callback_drops = Arc::clone(&drops);
    let producer = thread::spawn(move || {
        let mut state = callback.lock().unwrap();
        assert!(state.complete(Ok(Owner::new(1, &callback_drops)), now));
        assert!(!state.pending(now));
        assert!(!state.complete(Ok(Owner::new(2, &callback_drops)), now));
        thread::current().id()
    })
    .join()
    .unwrap();
    assert_eq!(*drops.lock().unwrap(), vec![(2, producer)]);
    let owner = state.lock().unwrap().take(now).unwrap().unwrap();
    assert_eq!(owner.identity, 1);
    drop(owner);
    assert!(state.lock().unwrap().take(now).is_none());
    drop(state);
    assert_eq!(
        *drops.lock().unwrap(),
        vec![(2, producer), (1, thread::current().id())]
    );
}

#[test]
fn a_timed_out_waiter_releases_late_preparation_on_its_producer() {
    let deadline = Instant::now() + Duration::from_secs(5);
    let state = Arc::new(Mutex::new(CaptureState::<Owner>::new(deadline)));
    let drops = Drops::default();
    assert!(!state.lock().unwrap().pending(deadline));
    assert!(state.lock().unwrap().take(deadline).unwrap().is_err());
    let callback = Arc::clone(&state);
    let callback_drops = Arc::clone(&drops);
    let producer = thread::spawn(move || {
        assert!(!callback
            .lock()
            .unwrap()
            .complete(Ok(Owner::new(1, &callback_drops)), deadline));
        thread::current().id()
    })
    .join()
    .unwrap();
    assert!(state.lock().unwrap().take(deadline).is_none());
    drop(state);
    assert_eq!(*drops.lock().unwrap(), vec![(1, producer)]);
}

#[test]
fn abandoning_the_waiter_drops_queued_and_later_owners_exactly_once() {
    let now = Instant::now();
    let drops = Drops::default();
    let state = Arc::new(Mutex::new(CaptureState::new(now + Duration::from_secs(5))));
    let callback = Arc::clone(&state);
    let callback_drops = Arc::clone(&drops);
    thread::spawn(move || {
        let mut state = callback.lock().unwrap();
        assert!(state.pending(now));
        assert!(state.complete(Ok(Owner::new(1, &callback_drops)), now));
    })
    .join()
    .unwrap();
    assert!(drops.lock().unwrap().is_empty());
    drop(state);
    assert_eq!(*drops.lock().unwrap(), vec![(1, thread::current().id())]);

    let state = Arc::new(Mutex::new(CaptureState::new(now + Duration::from_secs(5))));
    let callback = Arc::clone(&state);
    let callback_drops = Arc::clone(&drops);
    let barrier = Arc::new(Barrier::new(2));
    let callback_barrier = Arc::clone(&barrier);
    let producer = thread::spawn(move || {
        callback_barrier.wait();
        assert!(callback
            .lock()
            .unwrap()
            .complete(Ok(Owner::new(2, &callback_drops)), now));
        thread::current().id()
    });
    drop(state);
    barrier.wait();
    let producer = producer.join().unwrap();
    assert_eq!(
        *drops.lock().unwrap(),
        vec![(1, thread::current().id()), (2, producer)]
    );
}
