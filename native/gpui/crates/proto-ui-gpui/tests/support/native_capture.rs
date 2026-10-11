//! Evidence-only ScreenCaptureKit access to this process's exact test window.
//! There is no desktop/display capture, permission request, or fallback to an
//! unfiltered API. This is not the production material source provider.

use std::ffi::{c_char, c_void};
use std::fs::OpenOptions;
use std::io::Write;
use std::path::Path;
use std::ptr;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use block2::RcBlock;
use gpui::AsyncApp;
use objc2::runtime::AnyObject;
use objc2::{class, msg_send, sel};
use objc2_foundation::{NSOperatingSystemVersion, NSRect};

#[path = "capture_state.rs"]
mod capture_state;
use capture_state::CaptureState;

#[link(name = "ScreenCaptureKit", kind = "framework")]
extern "C" {}

#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGImageGetWidth(image: *const c_void) -> usize;
    fn CGImageGetHeight(image: *const c_void) -> usize;
}

#[link(name = "CoreFoundation", kind = "framework")]
extern "C" {
    fn CFDataCreateMutable(allocator: *const c_void, capacity: isize) -> *mut c_void;
    fn CFDataGetLength(data: *const c_void) -> isize;
    fn CFDataGetBytePtr(data: *const c_void) -> *const u8;
    fn CFStringCreateWithCString(
        allocator: *const c_void,
        text: *const c_char,
        encoding: u32,
    ) -> *mut c_void;
    fn CFRelease(value: *const c_void);
}

#[link(name = "ImageIO", kind = "framework")]
extern "C" {
    fn CGImageDestinationCreateWithData(
        data: *mut c_void,
        kind: *const c_void,
        count: usize,
        options: *const c_void,
    ) -> *mut c_void;
    fn CGImageDestinationAddImage(
        destination: *mut c_void,
        image: *const c_void,
        properties: *const c_void,
    );
    fn CGImageDestinationFinalize(destination: *mut c_void) -> bool;
}

struct CfOwned(*mut c_void);
impl Drop for CfOwned {
    fn drop(&mut self) {
        if !self.0.is_null() {
            // SAFETY: these wrappers own one Create-rule reference.
            unsafe { CFRelease(self.0) };
        }
    }
}

struct ObjcOwned(*mut AnyObject);
impl Drop for ObjcOwned {
    fn drop(&mut self) {
        if !self.0.is_null() {
            // SAFETY: these wrappers own one alloc/init or new reference.
            unsafe {
                let _: () = msg_send![self.0, release];
            }
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Target {
    pub window_id: u32,
    pub process_id: i32,
    pub width: usize,
    pub height: usize,
    point_width: f64,
    point_height: f64,
}

impl Target {
    /// # Safety
    /// `view` is this test's live NSView, read on the AppKit main thread.
    pub unsafe fn from_view(view: *mut AnyObject) -> Result<Self, String> {
        let window: *mut AnyObject = msg_send![view, window];
        if window.is_null() {
            return Err("the test view has no live NSWindow".into());
        }
        let number: isize = msg_send![window, windowNumber];
        let window_id = u32::try_from(number)
            .ok()
            .filter(|id| *id != 0)
            .ok_or("the test window has no valid window number")?;
        let frame: NSRect = msg_send![window, frame];
        let scale: f64 = msg_send![window, backingScaleFactor];
        let dimensions = [frame.size.width, frame.size.height, scale];
        if dimensions
            .iter()
            .any(|value| !value.is_finite() || *value <= 0.0)
        {
            return Err("invalid test window dimensions".into());
        }
        let width = (frame.size.width * scale).round() as usize;
        let height = (frame.size.height * scale).round() as usize;
        if width == 0 || height == 0 || width > 8192 || height > 8192 {
            return Err("test window dimensions exceed capture bounds".into());
        }
        Ok(Self {
            window_id,
            process_id: std::process::id()
                .try_into()
                .map_err(|_| "invalid process ID")?,
            width,
            height,
            point_width: frame.size.width,
            point_height: frame.size.height,
        })
    }
}

type Pending = Arc<Mutex<CaptureState<Vec<u8>>>>;

fn finish(pending: &Pending, result: Result<Vec<u8>, String>) {
    if let Ok(mut state) = pending.lock() {
        state.complete(result, Instant::now());
    }
}

fn is_pending(pending: &Pending) -> bool {
    pending
        .lock()
        .is_ok_and(|state| state.pending(Instant::now()))
}

/// # Safety
/// `image` is the live CGImage supplied for this callback only.
unsafe fn encode_png(image: *const c_void, target: Target) -> Result<Vec<u8>, String> {
    if image.is_null() {
        return Err("ScreenCaptureKit returned no image".into());
    }
    if CGImageGetWidth(image) != target.width || CGImageGetHeight(image) != target.height {
        return Err("ScreenCaptureKit image dimensions differ from the requested window".into());
    }
    let data = CfOwned(CFDataCreateMutable(ptr::null(), 0));
    let kind = CfOwned(CFStringCreateWithCString(
        ptr::null(),
        c"public.png".as_ptr(),
        0x0800_0100,
    ));
    if data.0.is_null() || kind.0.is_null() {
        return Err("PNG buffer allocation failed".into());
    }
    let destination = CfOwned(CGImageDestinationCreateWithData(
        data.0,
        kind.0,
        1,
        ptr::null(),
    ));
    if destination.0.is_null() {
        return Err("PNG encoder allocation failed".into());
    }
    CGImageDestinationAddImage(destination.0, image, ptr::null());
    if !CGImageDestinationFinalize(destination.0) {
        return Err("PNG encoding failed".into());
    }
    let length = CFDataGetLength(data.0);
    let bytes = CFDataGetBytePtr(data.0);
    if !(8..=128 * 1024 * 1024).contains(&length) || bytes.is_null() {
        return Err("invalid PNG byte length".into());
    }
    let bytes = std::slice::from_raw_parts(bytes, length as usize);
    if !bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        return Err("invalid PNG signature".into());
    }
    Ok(bytes.to_vec())
}

/// Starts only the consent-free, current-process content query. The callback
/// selects the exact AppKit window ID and independently verifies its owner and
/// point dimensions. Nothing else is captured or logged.
unsafe fn start(target: Target, pending: Pending) -> Result<(), String> {
    let info: *mut AnyObject = msg_send![class!(NSProcessInfo), processInfo];
    let version: NSOperatingSystemVersion = msg_send![info, operatingSystemVersion];
    if version.majorVersion < 14 || (version.majorVersion == 14 && version.minorVersion < 4) {
        return Err("current-process screenshot evidence requires macOS 14.4 or newer".into());
    }
    let available: bool = msg_send![class!(SCShareableContent), respondsToSelector: sel!(getCurrentProcessShareableContentWithCompletionHandler:)];
    if !available {
        return Err("current-process ScreenCaptureKit API is unavailable".into());
    }
    let content_ready = RcBlock::new(move |content: *mut AnyObject, error: *mut AnyObject| {
        if !is_pending(&pending) {
            return;
        }
        if !error.is_null() || content.is_null() {
            finish(
                &pending,
                Err("current-process shareable-content query failed".into()),
            );
            return;
        }
        // SAFETY: ScreenCaptureKit owns these objects for this callback. No
        // AppKit view is touched here and no pointer escapes this callback.
        unsafe {
            let windows: *mut AnyObject = msg_send![content, windows];
            let count: usize = msg_send![windows, count];
            let mut selected = ptr::null_mut();
            for index in 0..count {
                let candidate: *mut AnyObject = msg_send![windows, objectAtIndex: index];
                let window_id: u32 = msg_send![candidate, windowID];
                if window_id != target.window_id {
                    continue;
                }
                let app: *mut AnyObject = msg_send![candidate, owningApplication];
                if app.is_null() {
                    continue;
                }
                let process_id: i32 = msg_send![app, processID];
                let frame: NSRect = msg_send![candidate, frame];
                if process_id == target.process_id
                    && frame.size.width == target.point_width
                    && frame.size.height == target.point_height
                {
                    selected = candidate;
                    break;
                }
            }
            if selected.is_null() {
                finish(
                    &pending,
                    Err("exact current-process window and dimensions were not found".into()),
                );
                return;
            }
            if !is_pending(&pending) {
                return;
            }
            let filter: *mut AnyObject = msg_send![class!(SCContentFilter), alloc];
            let filter = ObjcOwned(msg_send![filter, initWithDesktopIndependentWindow: selected]);
            let configuration = ObjcOwned(msg_send![class!(SCStreamConfiguration), new]);
            if filter.0.is_null() || configuration.0.is_null() {
                finish(&pending, Err("window capture configuration failed".into()));
                return;
            }
            let _: () = msg_send![configuration.0, setWidth: target.width];
            let _: () = msg_send![configuration.0, setHeight: target.height];
            let _: () = msg_send![configuration.0, setShowsCursor: false];
            let _: () = msg_send![configuration.0, setCapturesAudio: false];
            let _: () = msg_send![configuration.0, setIncludeChildWindows: false];
            let _: () = msg_send![configuration.0, setIgnoreShadowsSingleWindow: true];
            let filter_ptr = filter.0;
            let configuration_ptr = configuration.0;
            let result_pending = Arc::clone(&pending);
            let image_ready = RcBlock::new(move |image: *const c_void, error: *mut AnyObject| {
                // Own both inputs for the copied completion block's entire
                // lifetime, including timeout/late-result disposal. Do not
                // rely on undocumented argument retention by the manager.
                let _keep_alive = (&filter, &configuration);
                if !is_pending(&result_pending) {
                    return;
                }
                let result = if error.is_null() {
                    // The CGImage is borrowed for this invocation. Encode and
                    // copy its bytes before ScreenCaptureKit releases it.
                    encode_png(image, target)
                } else {
                    Err("exact-window screenshot failed".into())
                };
                finish(&result_pending, result);
            });
            // ScreenCaptureKit copies the asynchronous completion block;
            // that block explicitly owns the filter and configuration.
            let _: () = msg_send![class!(SCScreenshotManager), captureImageWithFilter: filter_ptr configuration: configuration_ptr completionHandler: &*image_ready];
        }
    });
    let _: () = msg_send![class!(SCShareableContent), getCurrentProcessShareableContentWithCompletionHandler: &*content_ready];
    Ok(())
}

pub async fn capture(target: Target, path: &Path, cx: &AsyncApp) -> Result<(), String> {
    let pending = Arc::new(Mutex::new(CaptureState::new(
        Instant::now() + Duration::from_secs(5),
    )));
    // SAFETY: framework access is guarded by availability; target is a value
    // snapshot of our live test window, not an arbitrary externally supplied ID.
    unsafe {
        start(target, Arc::clone(&pending))?;
    }
    let bytes = loop {
        let ready = pending
            .lock()
            .map_err(|_| "capture state poisoned")?
            .take(Instant::now());
        if let Some(result) = ready {
            break result?;
        }
        // Keep the AppKit/GPUI main loop available to ScreenCaptureKit.
        cx.background_executor()
            .timer(Duration::from_millis(20))
            .await;
    };
    // Only this waiter writes files. A timed-out callback can never create or
    // replace a PNG. Refuse old artifacts instead of silently reusing them.
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|error| format!("fresh PNG creation failed: {error}"))?;
    if let Err(error) = file.write_all(&bytes) {
        drop(file);
        let _ = std::fs::remove_file(path);
        return Err(format!("PNG write failed: {error}"));
    }
    Ok(())
}
