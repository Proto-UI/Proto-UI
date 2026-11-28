//! Metadata-only admission for a single, current-process ScreenCaptureKit
//! stream. Pixel acceptance is deliberately absent: the first admitted frame
//! is terminal even when the independent pixel oracle rejects it.

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;

/// A stop request may precede the asynchronous native start completion. Keep
/// that intent and issue exactly one stop after start has actually completed.
#[derive(Default)]
pub struct StopGate {
    started: AtomicBool,
    requested: AtomicBool,
    issued: AtomicBool,
    completed: AtomicBool,
}

impl StopGate {
    pub fn complete_start(&self) -> Option<bool> {
        if self.started.swap(true, Ordering::SeqCst) {
            return None;
        }
        Some(self.should_stop())
    }

    pub fn request(&self) -> bool {
        self.requested.store(true, Ordering::SeqCst);
        self.should_stop()
    }

    fn should_stop(&self) -> bool {
        // Two separate release/acquire flags could both miss the concurrent
        // store. One sequentially consistent order prevents a lost stop when
        // cancellation and the native start callback race on different queues.
        self.started.load(Ordering::SeqCst)
            && self.requested.load(Ordering::SeqCst)
            && !self.issued.swap(true, Ordering::SeqCst)
    }

    pub fn complete_stop(&self) -> bool {
        self.issued.load(Ordering::SeqCst) && !self.completed.swap(true, Ordering::SeqCst)
    }

    pub fn started(&self) -> bool {
        self.started.load(Ordering::SeqCst)
    }

    pub fn requested(&self) -> bool {
        self.requested.load(Ordering::SeqCst)
    }

    pub fn completed(&self) -> bool {
        self.completed.load(Ordering::SeqCst)
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Metadata {
    pub valid: bool,
    pub ready: bool,
    pub status: Option<i64>,
    pub display_time: Option<u64>,
    pub width: usize,
    pub height: usize,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Admission {
    /// Retain the actual native metadata (and its image, when one exists),
    /// without inspecting pixels or treating this as a complete frame.
    Observe(&'static str),
    FirstComplete,
    Retired,
    Fail(&'static str),
}

pub struct FrameAdmission {
    stream: usize,
    phase_started_at: u64,
    width: usize,
    height: usize,
    deadline: Instant,
    retired: bool,
}

impl FrameAdmission {
    pub fn new(phase_started_at: u64, width: usize, height: usize, deadline: Instant) -> Self {
        Self {
            stream: 0,
            phase_started_at,
            width,
            height,
            deadline,
            retired: false,
        }
    }

    pub fn bind_stream(&mut self, stream: usize) -> bool {
        if self.retired || self.stream != 0 || stream == 0 {
            return false;
        }
        self.stream = stream;
        true
    }

    pub fn retire(&mut self) {
        self.retired = true;
    }

    pub fn owns_stream(&self, stream: usize) -> bool {
        self.stream != 0 && stream == self.stream
    }

    pub fn observe(
        &mut self,
        stream: usize,
        metadata: Metadata,
        observed_at: u64,
        now: Instant,
    ) -> Admission {
        if self.retired {
            return Admission::Retired;
        }
        if now >= self.deadline {
            self.retired = true;
            return Admission::Fail("native frame arrived at or after the capture deadline");
        }
        if !self.owns_stream(stream) {
            self.retired = true;
            return Admission::Fail("native frame came from a different stream");
        }
        if !metadata.valid || !metadata.ready {
            return Admission::Observe("sample buffer is not valid and data-ready");
        }
        // SCFrameStatusComplete is 0. Idle/blank/suspended/started/stopped and
        // missing or unknown values cannot establish a complete native frame.
        if metadata.status != Some(0) {
            return Admission::Observe("native frame status is not complete");
        }
        let Some(display_time) = metadata.display_time else {
            return Admission::Observe("native frame has no display time");
        };
        if self.phase_started_at == 0
            || display_time < self.phase_started_at
            || display_time > observed_at
        {
            return Admission::Observe("native frame display time is outside the current phase");
        }
        if metadata.width != self.width || metadata.height != self.height {
            self.retired = true;
            return Admission::Fail("native frame dimensions differ from the requested window");
        }
        // Admission is one-shot and precedes encoding and the pixel oracle.
        // A later image cannot replace the first complete frame's failure.
        self.retired = true;
        Admission::FirstComplete
    }
}
