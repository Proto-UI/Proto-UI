mod disabled;
pub mod context;
pub mod owned_tasks;
pub use disabled::button_availability;

use gpui::{App, Context, WeakEntity};
use std::collections::VecDeque;

/// One reached writable location. Reading an untouched String borrows its original storage.
pub struct PendingWrite<'a, T> {
    published: &'a T,
    pending: Option<T>,
}

impl<'a, T> PendingWrite<'a, T> {
    pub fn new(published: &'a T) -> Self {
        Self { published, pending: None }
    }

    pub fn read(&self) -> &T {
        self.pending.as_ref().unwrap_or(self.published)
    }

    pub fn write(&mut self, next: T) {
        self.pending = Some(next);
    }

    pub fn finish(self) -> Option<T> {
        self.pending
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SegmentFailure {
    pub reason: &'static str,
    pub file: &'static str,
    pub start: u64,
    pub end: u64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ActionOutcome {
    Committed,
    Queued,
    Disposed,
    Failed(SegmentFailure),
}

/// Dispatch from an external native owner through a weak handle. A callback
/// already borrowing this entity dispatches through its `actions(cx)` directly.
pub fn with_owner<T: 'static>(
    owner: &WeakEntity<T>,
    cx: &mut App,
    action: impl FnOnce(&mut T, &mut Context<T>) -> ActionOutcome,
) -> ActionOutcome {
    match owner.upgrade() {
        Some(owner) => owner.update(cx, action),
        None => ActionOutcome::Disposed,
    }
}

/// A native notification and all signals from one commit finish before the next queued action.
#[derive(Debug)]
pub struct PublicationQueue<A> {
    publishing: bool,
    waiting: VecDeque<A>,
}

impl<A> Default for PublicationQueue<A> {
    fn default() -> Self {
        Self { publishing: false, waiting: VecDeque::new() }
    }
}

impl<A> PublicationQueue<A> {
    pub fn admit(&mut self, action: A) -> Option<A> {
        if self.publishing {
            self.waiting.push_back(action);
            None
        } else {
            Some(action)
        }
    }

    /// Enqueue the end marker after the actual GPUI notify/emit effects. A weak
    /// entity ties both the marker and queued work to the original lifetime.
    pub fn after_effects<T: 'static>(
        &mut self,
        cx: &mut Context<T>,
        resume: fn(&mut T, &mut Context<T>),
    ) {
        self.publishing = true;
        let owner = cx.weak_entity();
        cx.defer(move |app| {
            if let Some(owner) = owner.upgrade() {
                owner.update(app, resume);
            }
        });
    }

    pub fn resume(&mut self) {
        self.publishing = false;
    }

    /// A queued action that publishes a new batch installs its own end marker.
    pub fn next_ready(&mut self) -> Option<A> {
        if self.publishing { None } else { self.waiting.pop_front() }
    }
}
