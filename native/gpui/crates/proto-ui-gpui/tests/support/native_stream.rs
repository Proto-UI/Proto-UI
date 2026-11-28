//! A single owned-window stream, used only by the native evidence test.
//! Select by native frame metadata, never by the result of the pixel oracle.

use std::collections::BTreeMap;
use std::ffi::{c_char, c_void};
use std::path::Path;
use std::ptr;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock, Weak};
use std::time::{Duration, Instant};

use block2::RcBlock;
use gpui::AsyncApp;
use objc2::runtime::{AnyClass, AnyObject, AnyProtocol, ClassBuilder, Sel};
use objc2::{class, msg_send, sel};

#[path = "capture_frame.rs"]
mod capture_frame;
use capture_frame::{Admission, FrameAdmission, Metadata, StopGate};

use super::{
    captured_image, encode_png, finish, phase_clock, write_fresh, CaptureState, Captured, CfOwned,
    ObjcOwned, Pending, PreparedCapture, Target,
};

#[link(name = "ScreenCaptureKit", kind = "framework")]
extern "C" {
    static SCStreamFrameInfoStatus: *const c_void;
    static SCStreamFrameInfoDisplayTime: *const c_void;
}

#[link(name = "CoreMedia", kind = "framework")]
extern "C" {
    fn CMSampleBufferIsValid(sample: *const c_void) -> u8;
    fn CMSampleBufferDataIsReady(sample: *const c_void) -> u8;
    fn CMSampleBufferGetSampleAttachmentsArray(
        sample: *const c_void,
        create_if_necessary: u8,
    ) -> *const c_void;
    fn CMSampleBufferGetImageBuffer(sample: *const c_void) -> *const c_void;
}

#[link(name = "CoreVideo", kind = "framework")]
extern "C" {
    fn CVPixelBufferGetWidth(buffer: *const c_void) -> usize;
    fn CVPixelBufferGetHeight(buffer: *const c_void) -> usize;
}

#[link(name = "CoreFoundation", kind = "framework")]
extern "C" {
    fn CFArrayGetCount(array: *const c_void) -> isize;
    fn CFArrayGetValueAtIndex(array: *const c_void, index: isize) -> *const c_void;
    fn CFDictionaryGetValue(dictionary: *const c_void, key: *const c_void) -> *const c_void;
    fn CFGetTypeID(value: *const c_void) -> usize;
    fn CFDictionaryGetTypeID() -> usize;
    fn CFNumberGetTypeID() -> usize;
    fn CFNumberGetValue(number: *const c_void, kind: isize, value: *mut c_void) -> u8;
}

#[link(name = "VideoToolbox", kind = "framework")]
extern "C" {
    fn VTCreateCGImageFromCVPixelBuffer(
        buffer: *const c_void,
        options: *const c_void,
        image_out: *mut *mut c_void,
    ) -> i32;
}

extern "C" {
    fn dispatch_queue_create(label: *const c_char, attr: *const c_void) -> *mut c_void;
    fn dispatch_async(queue: *mut c_void, block: *const c_void);
    fn dispatch_release(object: *mut c_void);
}

// Bound memory independently of the original time budget. Hitting either
// limit fails the capture; it never discards an image and continues to pass.
const MAX_FRAME_RECORDS: usize = 1024;
const MAX_EVIDENCE_BYTES: usize = 128 * 1024 * 1024;

struct FrameRecord {
    metadata: Metadata,
    observed_at: u64,
    decision: &'static str,
    png: Option<Vec<u8>>,
    image_error: Option<String>,
}

#[derive(Default)]
struct Journal {
    frames: Vec<FrameRecord>,
    bytes: usize,
}

struct Shared {
    target: Target,
    admission: Mutex<FrameAdmission>,
    captured: Pending<Captured>,
    retired: AtomicBool,
    failure: Mutex<Option<String>>,
    journal: Mutex<Journal>,
}

impl Shared {
    fn fail(&self, error: String) {
        if let Ok(mut failure) = self.failure.lock() {
            failure.get_or_insert_with(|| error.clone());
        }
        self.retired.store(true, Ordering::Release);
        finish(&self.captured, Err(error));
    }

    fn retire(&self) {
        self.retired.store(true, Ordering::Release);
        if let Ok(mut admission) = self.admission.lock() {
            admission.retire();
        }
    }

    fn record(&self, frame: FrameRecord) -> Result<Option<usize>, String> {
        let mut journal = self.journal.lock().map_err(|_| "frame journal poisoned")?;
        if self.retired.load(Ordering::Acquire) {
            return Ok(None);
        }
        if journal.frames.len() >= MAX_FRAME_RECORDS {
            return Err("native frame evidence exceeded its record bound".into());
        }
        let index = journal.frames.len();
        journal.frames.push(frame);
        Ok(Some(index))
    }

    fn record_image(&self, index: usize, image: Result<Vec<u8>, String>) -> Result<(), String> {
        let mut journal = self.journal.lock().map_err(|_| "frame journal poisoned")?;
        if self.retired.load(Ordering::Acquire) {
            return Ok(());
        }
        match image {
            Ok(png) => {
                let bytes = journal
                    .bytes
                    .checked_add(png.len())
                    .ok_or("PNG byte overflow")?;
                if bytes > MAX_EVIDENCE_BYTES {
                    journal.frames[index].image_error = Some("PNG evidence bound exceeded".into());
                    return Err("native frame evidence exceeded its byte bound".into());
                }
                journal.bytes = bytes;
                journal.frames[index].png = Some(png);
                journal.frames[index].image_error = None;
            }
            Err(error) => journal.frames[index].image_error = Some(error),
        }
        Ok(())
    }
}

fn outputs() -> &'static Mutex<BTreeMap<usize, Weak<Shared>>> {
    static OUTPUTS: OnceLock<Mutex<BTreeMap<usize, Weak<Shared>>>> = OnceLock::new();
    OUTPUTS.get_or_init(|| Mutex::new(BTreeMap::new()))
}

fn lookup(output: &AnyObject) -> Option<Arc<Shared>> {
    outputs()
        .lock()
        .ok()?
        .get(&(output as *const AnyObject as usize))?
        .upgrade()
}

unsafe fn number(dictionary: *const c_void, key: *const c_void) -> Option<i64> {
    if dictionary.is_null() || CFGetTypeID(dictionary) != CFDictionaryGetTypeID() {
        return None;
    }
    let value = CFDictionaryGetValue(dictionary, key);
    if value.is_null() || CFGetTypeID(value) != CFNumberGetTypeID() {
        return None;
    }
    let mut result = 0i64;
    // kCFNumberSInt64Type. Non-integral/out-of-range values are not accepted.
    (CFNumberGetValue(value, 4, (&mut result as *mut i64).cast()) != 0).then_some(result)
}

unsafe fn metadata(sample: *const c_void) -> (Metadata, *const c_void) {
    let valid = !sample.is_null() && CMSampleBufferIsValid(sample) != 0;
    let ready = valid && CMSampleBufferDataIsReady(sample) != 0;
    let mut metadata = Metadata {
        valid,
        ready,
        status: None,
        display_time: None,
        width: 0,
        height: 0,
    };
    if !valid {
        return (metadata, ptr::null());
    }
    let attachments = CMSampleBufferGetSampleAttachmentsArray(sample, 0);
    if !attachments.is_null() && CFArrayGetCount(attachments) > 0 {
        let frame = CFArrayGetValueAtIndex(attachments, 0);
        metadata.status = number(frame, SCStreamFrameInfoStatus);
        metadata.display_time =
            number(frame, SCStreamFrameInfoDisplayTime).and_then(|value| u64::try_from(value).ok());
    }
    let buffer = if ready {
        CMSampleBufferGetImageBuffer(sample)
    } else {
        ptr::null()
    };
    if !buffer.is_null() {
        metadata.width = CVPixelBufferGetWidth(buffer);
        metadata.height = CVPixelBufferGetHeight(buffer);
    }
    (metadata, buffer)
}

unsafe fn image(buffer: *const c_void) -> Result<CfOwned, String> {
    if buffer.is_null() {
        return Err("native sample has no pixel buffer".into());
    }
    let mut image = ptr::null_mut();
    let status = VTCreateCGImageFromCVPixelBuffer(buffer, ptr::null(), &mut image);
    let image = CfOwned(image);
    if status != 0 || image.0.is_null() {
        return Err(format!(
            "native pixel-buffer image conversion failed: {status}"
        ));
    }
    Ok(image)
}

unsafe fn native_error(stage: &str, error: *mut AnyObject) -> String {
    if error.is_null() {
        return format!("{stage}: no NSError supplied");
    }
    // Keep the native error code without copying localized/userInfo content.
    let code: isize = msg_send![error, code];
    format!("{stage}: NSError code {code}")
}

unsafe extern "C" fn output_frame(
    output: &AnyObject,
    _selector: Sel,
    stream: *mut AnyObject,
    sample: *const c_void,
    output_type: isize,
) {
    let Some(shared) = lookup(output) else {
        return;
    };
    if shared.retired.load(Ordering::Acquire) {
        return;
    }
    if output_type != 0 {
        shared.fail("owned window stream delivered a non-screen output".into());
        return;
    }
    let observed_at = phase_clock();
    let (metadata, buffer) = metadata(sample);
    let admission = match shared.admission.lock() {
        Ok(mut admission) => {
            admission.observe(stream as usize, metadata, observed_at, Instant::now())
        }
        Err(_) => {
            shared.fail("frame admission poisoned".into());
            return;
        }
    };
    let decision = match admission {
        Admission::Retired => return,
        Admission::Observe(reason) | Admission::Fail(reason) => reason,
        Admission::FirstComplete => "first-current-complete-frame",
    };
    let index = match shared.record(FrameRecord {
        metadata,
        observed_at,
        decision,
        png: None,
        image_error: Some("native image copy was not completed before retirement".into()),
    }) {
        Ok(Some(index)) => index,
        Ok(None) => return,
        Err(error) => {
            shared.fail(error);
            return;
        }
    };
    match admission {
        Admission::FirstComplete => {
            // The sample and its CVPixelBuffer remain borrowed only for this
            // callback. Copy actual OS pixels now; never retain the sample.
            // Admission has already retired, before this one pixel inspection.
            let captured = image(buffer).and_then(|image| captured_image(image.0, shared.target));
            if let Ok(mut journal) = shared.journal.lock() {
                if !shared.retired.load(Ordering::Acquire) {
                    journal.frames[index].image_error = captured.as_ref().err().cloned();
                }
            }
            finish(&shared.captured, captured);
        }
        Admission::Observe(_) | Admission::Fail(_) => {
            // Preserve rejected native metadata and, when available, the raw
            // image. This path deliberately does not call the pixel oracle.
            let raw = if metadata.width == 0
                || metadata.height == 0
                || metadata.width > 8192
                || metadata.height > 8192
            {
                Err("native sample has no bounded image dimensions".into())
            } else {
                image(buffer).and_then(|image| {
                    encode_png(
                        image.0,
                        Target {
                            width: metadata.width,
                            height: metadata.height,
                            ..shared.target
                        },
                    )
                })
            };
            if let Err(error) = shared.record_image(index, raw) {
                shared.fail(error);
            }
            if let Admission::Fail(reason) = admission {
                shared.fail(reason.into());
            }
        }
        Admission::Retired => {}
    }
}

unsafe extern "C" fn stopped_with_error(
    output: &AnyObject,
    _selector: Sel,
    stream: *mut AnyObject,
    error: *mut AnyObject,
) {
    if let Some(shared) = lookup(output) {
        if !shared.retired.load(Ordering::Acquire) {
            let owns_stream = shared
                .admission
                .lock()
                .is_ok_and(|admission| admission.owns_stream(stream as usize));
            if !owns_stream {
                shared.fail("native error came from a different stream".into());
                return;
            }
            shared.fail(native_error("owned window stream stopped", error));
        }
    }
}

fn output_class() -> Result<&'static AnyClass, String> {
    static CLASS: OnceLock<Result<&'static AnyClass, String>> = OnceLock::new();
    CLASS
        .get_or_init(|| {
            let mut class = ClassBuilder::new("ProtoUIEvidenceWindowStreamOutput", class!(NSObject))
                .ok_or("could not allocate the owned stream output class")?;
            for name in ["SCStreamOutput", "SCStreamDelegate"] {
                class.add_protocol(
                    AnyProtocol::get(name).ok_or("native stream protocol unavailable")?,
                );
            }
            unsafe {
                class.add_method(
                    sel!(stream:didOutputSampleBuffer:ofType:),
                    output_frame as unsafe extern "C" fn(_, _, _, _, _),
                );
                class.add_method(
                    sel!(stream:didStopWithError:),
                    stopped_with_error as unsafe extern "C" fn(_, _, _, _),
                );
            }
            Ok(class.register())
        })
        .clone()
}

struct Queue(*mut c_void);
impl Drop for Queue {
    fn drop(&mut self) {
        if !self.0.is_null() {
            unsafe { dispatch_release(self.0) };
        }
    }
}

struct Resources {
    stream: ObjcOwned,
    output: ObjcOwned,
    queue: Queue,
    // The exact verified filter/configuration outlive start, output and stop.
    _prepared: PreparedCapture,
    shared: Arc<Shared>,
    started: Pending<()>,
    stopped: Pending<()>,
    stop_gate: StopGate,
    stop_succeeded: AtomicBool,
    output_removed: AtomicBool,
    queue_drained: AtomicBool,
}

// SAFETY: no AppKit view/window object is retained here. ScreenCaptureKit owns
// asynchronous stream calls, immutable filter/configuration and a stateless
// NSObject output. Arc keeps all native owners alive through their callbacks;
// shared Rust state is locked/atomic, and sample callbacks use one serial queue.
unsafe impl Send for Resources {}
unsafe impl Sync for Resources {}

impl Resources {
    fn request_stop(self: &Arc<Self>) {
        self.shared.retire();
        // A cancellation while start is outstanding must not stop too early
        // and leave a stream that subsequently starts. Its late start callback
        // owns these resources and must honor this same sticky stop request.
        if self.stop_gate.request() {
            self.stop();
        }
    }

    fn stop(self: &Arc<Self>) {
        let owner = Arc::clone(self);
        let stopped = RcBlock::new(move |error: *mut AnyObject| {
            if !owner.stop_gate.complete_stop() {
                return;
            }
            let mut result = if error.is_null() {
                owner.stop_succeeded.store(true, Ordering::Release);
                Ok(())
            } else {
                Err(unsafe { native_error("owned window stream failed to stop", error) })
            };
            unsafe {
                let mut error: *mut AnyObject = ptr::null_mut();
                let removed: bool = msg_send![owner.stream.0, removeStreamOutput: owner.output.0 type: 0isize error: &mut error];
                owner
                    .output_removed
                    .store(removed && error.is_null(), Ordering::Release);
                if (!removed || !error.is_null()) && result.is_ok() {
                    result = Err(native_error(
                        "owned window stream output removal failed",
                        error,
                    ));
                }
                let owner = Arc::clone(&owner);
                let queue = owner.queue.0;
                let drained = RcBlock::new(move || {
                    // stop completion alone does not guarantee a drained
                    // output queue. Detach output, then fence our serial queue;
                    // retired identity checks also reject any late delivery.
                    let mut result = result.clone();
                    let removed = outputs().lock().ok().and_then(|mut outputs| {
                        outputs
                            .remove(&(owner.output.0 as usize))
                            .and_then(|entry| entry.upgrade())
                    });
                    if !removed
                        .as_ref()
                        .is_some_and(|shared| Arc::ptr_eq(shared, &owner.shared))
                        && result.is_ok()
                    {
                        result =
                            Err("exact native output registration could not be retired".into());
                    }
                    owner.queue_drained.store(true, Ordering::Release);
                    finish(&owner.stopped, result);
                });
                dispatch_async(queue, (&*drained as *const _).cast());
            }
        });
        unsafe {
            let _: () = msg_send![self.stream.0, stopCaptureWithCompletionHandler: &*stopped];
        }
    }
}

struct StopOnDrop(Arc<Resources>);
impl Drop for StopOnDrop {
    fn drop(&mut self) {
        self.0.request_stop();
    }
}

unsafe fn open(
    target: Target,
    prepared: PreparedCapture,
    phase_started_at: u64,
    deadline: Instant,
) -> Result<Arc<Resources>, String> {
    if Instant::now() >= deadline {
        return Err("native stream cannot start after the capture deadline".into());
    }
    let shared = Arc::new(Shared {
        target,
        admission: Mutex::new(FrameAdmission::new(
            phase_started_at,
            target.width,
            target.height,
            deadline,
        )),
        captured: Arc::new(Mutex::new(CaptureState::new(deadline))),
        retired: AtomicBool::new(false),
        failure: Mutex::new(None),
        journal: Mutex::new(Journal::default()),
    });
    let queue = Queue(dispatch_queue_create(
        c"org.proto-ui.native-evidence".as_ptr(),
        ptr::null(),
    ));
    if queue.0.is_null() {
        return Err("could not create the native stream output queue".into());
    }
    let output = ObjcOwned(msg_send![output_class()?, new]);
    if output.0.is_null() {
        return Err("could not create the native stream output".into());
    }
    let stream: *mut AnyObject = msg_send![class!(SCStream), alloc];
    let stream = ObjcOwned(msg_send![stream, initWithFilter: prepared.filter.0 configuration: prepared.configuration.0 delegate: output.0]);
    if stream.0.is_null() {
        return Err("could not create the owned window stream".into());
    }
    if !shared
        .admission
        .lock()
        .map_err(|_| "frame admission poisoned")?
        .bind_stream(stream.0 as usize)
    {
        return Err("could not bind the exact native stream".into());
    }
    let mut error: *mut AnyObject = ptr::null_mut();
    let added: bool = msg_send![stream.0, addStreamOutput: output.0 type: 0isize sampleHandlerQueue: queue.0.cast::<AnyObject>() error: &mut error];
    if !added || !error.is_null() {
        return Err(native_error(
            "could not attach the owned window stream output",
            error,
        ));
    }
    {
        let mut outputs = outputs()
            .lock()
            .map_err(|_| "native output registry poisoned")?;
        if outputs.contains_key(&(output.0 as usize)) {
            return Err("native output identity is already registered".into());
        }
        outputs.insert(output.0 as usize, Arc::downgrade(&shared));
    }
    let resources = Arc::new(Resources {
        stream,
        output,
        queue,
        _prepared: prepared,
        shared,
        started: Arc::new(Mutex::new(CaptureState::new(deadline))),
        stopped: Arc::new(Mutex::new(CaptureState::new(deadline))),
        stop_gate: StopGate::default(),
        stop_succeeded: AtomicBool::new(false),
        output_removed: AtomicBool::new(false),
        queue_drained: AtomicBool::new(false),
    });
    let owner = Arc::clone(&resources);
    let started = RcBlock::new(move |error: *mut AnyObject| {
        // Only the first callback can resolve start or trigger a deferred stop.
        let Some(stop_now) = owner.stop_gate.complete_start() else {
            return;
        };
        let result = if error.is_null() {
            Ok(())
        } else {
            let error = unsafe { native_error("owned window stream failed to start", error) };
            owner.shared.fail(error.clone());
            Err(error)
        };
        finish(&owner.started, result);
        if stop_now {
            owner.stop();
        }
    });
    let _: () = msg_send![resources.stream.0, startCaptureWithCompletionHandler: &*started];
    Ok(resources)
}

async fn wait<T>(pending: &Pending<T>, cx: &AsyncApp) -> Result<T, String> {
    loop {
        if let Some(result) = pending
            .lock()
            .map_err(|_| "native stream state poisoned")?
            .take(Instant::now())
        {
            return result;
        }
        cx.background_executor()
            .timer(Duration::from_millis(20))
            .await;
    }
}

pub(super) struct StreamResult {
    pub captured: Result<Captured, String>,
    pub resource_error: Option<String>,
    pub receipt: serde_json::Value,
}

pub(super) async fn capture(
    target: Target,
    prepared: PreparedCapture,
    phase_started_at: u64,
    deadline: Instant,
    path: &Path,
    cx: &AsyncApp,
) -> Result<StreamResult, String> {
    let owner = unsafe { open(target, prepared, phase_started_at, deadline)? };
    let _stop_on_drop = StopOnDrop(Arc::clone(&owner));
    let started = wait(&owner.started, cx).await;
    let captured = if started.is_ok() {
        wait(&owner.shared.captured, cx).await
    } else {
        // Retain an already completed first image even if native startup also
        // failed. The independent resource error still prevents a pass.
        owner
            .shared
            .captured
            .lock()
            .map_err(|_| "native stream state poisoned")?
            .take(Instant::now())
            .unwrap_or_else(|| Err("native stream did not start".into()))
    };
    owner.request_stop();
    let stopped = wait(&owner.stopped, cx).await;
    let stopped_within_deadline = stopped.is_ok();
    let mut resource_error = started
        .err()
        .or_else(|| {
            owner
                .shared
                .failure
                .lock()
                .ok()
                .and_then(|failure| failure.clone())
        })
        .or_else(|| stopped.err());
    let frames = std::mem::take(
        &mut owner
            .shared
            .journal
            .lock()
            .map_err(|_| "frame journal poisoned")?
            .frames,
    );
    let mut records = Vec::with_capacity(frames.len());
    let stem = path
        .file_stem()
        .ok_or("capture path has no filename")?
        .to_string_lossy();
    for (index, frame) in frames.into_iter().enumerate() {
        let mut artifact = None;
        let mut image_error = frame.image_error;
        if let Some(png) = frame.png {
            let name = format!("{stem}.frame-{index:04}.png");
            if let Err(error) = write_fresh(&path.with_file_name(&name), &png) {
                resource_error.get_or_insert_with(|| error.clone());
                image_error = Some(error);
            } else {
                artifact = Some(name);
            }
        }
        records.push(serde_json::json!({
            "index": index, "status": frame.metadata.status,
            "valid": frame.metadata.valid, "dataReady": frame.metadata.ready,
            "displayTimeMach": frame.metadata.display_time, "observedAtMach": frame.observed_at,
            "width": frame.metadata.width, "height": frame.metadata.height,
            "decision": frame.decision, "png": artifact, "imageError": image_error,
        }));
    }
    let mut receipt = serde_json::json!({
        "rule": "first-current-complete-native-frame-v1",
        "windowId": target.window_id, "processId": target.process_id,
        "phaseStartedAtMach": phase_started_at,
        "startCompleted": owner.stop_gate.started(),
        "stopRequested": owner.stop_gate.requested(),
        "stopCompleted": owner.stop_gate.completed(),
        "stopSucceeded": owner.stop_succeeded.load(Ordering::Acquire),
        "outputRemoved": owner.output_removed.load(Ordering::Acquire),
        "queueDrained": owner.queue_drained.load(Ordering::Acquire),
        "stopAndDrainWithinCaptureDeadline": stopped_within_deadline,
        "resourceError": resource_error,
        "captureError": captured.as_ref().err(),
        "canonicalPng": captured.as_ref().ok().and_then(|_| path.file_name()).map(|name| name.to_string_lossy()),
        "frames": records,
    });
    let bytes = serde_json::to_vec_pretty(&receipt).map_err(|error| error.to_string())?;
    if let Err(error) = write_fresh(&path.with_extension("frames.json"), &bytes) {
        resource_error.get_or_insert_with(|| error.clone());
        receipt["evidenceWriteError"] = serde_json::json!(error);
    }
    Ok(StreamResult {
        captured,
        resource_error,
        receipt,
    })
}
