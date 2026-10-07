//! A capture callback may finish after its test phase has timed out. Only the
//! waiter writes files; a late or duplicate callback cannot publish pixels.

use std::time::Instant;

pub struct CaptureState<T> {
    deadline: Instant,
    result: Option<Result<T, String>>,
    retired: bool,
}

impl<T> CaptureState<T> {
    pub fn new(deadline: Instant) -> Self {
        Self {
            deadline,
            result: None,
            retired: false,
        }
    }

    pub fn complete(&mut self, result: Result<T, String>, now: Instant) -> bool {
        if self.retired || self.result.is_some() || now >= self.deadline {
            return false;
        }
        self.result = Some(result);
        true
    }

    pub fn take(&mut self, now: Instant) -> Option<Result<T, String>> {
        if self.retired {
            return None;
        }
        if let Some(result) = self.result.take() {
            self.retired = true;
            return Some(result);
        }
        if now >= self.deadline {
            self.retired = true;
            return Some(Err(
                "current-process window capture timed out after 5 s".into()
            ));
        }
        None
    }

    pub fn pending(&self, now: Instant) -> bool {
        !self.retired && self.result.is_none() && now < self.deadline
    }
}
