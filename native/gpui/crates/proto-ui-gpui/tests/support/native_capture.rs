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
use objc2_foundation::{NSOperatingSystemVersion, NSPoint, NSRect, NSSize};

#[path = "capture_state.rs"]
mod capture_state;
use capture_state::CaptureState;

#[path = "native_stream.rs"]
mod native_stream;

#[path = "capture_pixels.rs"]
pub mod capture_pixels;
use capture_pixels::{Rect, Report};

#[link(name = "ScreenCaptureKit", kind = "framework")]
extern "C" {}

#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGImageGetWidth(image: *const c_void) -> usize;
    fn CGImageGetHeight(image: *const c_void) -> usize;
    fn CGColorSpaceCreateDeviceRGB() -> *mut c_void;
    fn CGColorSpaceRelease(space: *mut c_void);
    fn CGBitmapContextCreate(
        data: *mut c_void,
        width: usize,
        height: usize,
        bits_per_component: usize,
        bytes_per_row: usize,
        space: *mut c_void,
        bitmap_info: u32,
    ) -> *mut c_void;
    fn CGContextDrawImage(context: *mut c_void, rect: NSRect, image: *const c_void);
    fn CGContextRelease(context: *mut c_void);
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

struct ColorSpace(*mut c_void);
impl Drop for ColorSpace {
    fn drop(&mut self) {
        if !self.0.is_null() {
            unsafe { CGColorSpaceRelease(self.0) };
        }
    }
}

struct BitmapContext(*mut c_void);
impl Drop for BitmapContext {
    fn drop(&mut self) {
        if !self.0.is_null() {
            unsafe { CGContextRelease(self.0) };
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Target {
    pub window_id: u32,
    pub process_id: i32,
    pub width: usize,
    pub height: usize,
    pub content: Rect,
    pub scale: f64,
    pub view_is_flipped: bool,
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
        let bounds: NSRect = msg_send![view, bounds];
        let view_is_flipped: bool = msg_send![view, isFlipped];
        let in_window: NSRect =
            msg_send![view, convertRect: bounds toView: ptr::null::<AnyObject>()];
        let content = capture_pixels::content_rect(
            width,
            height,
            scale,
            [
                in_window.origin.x,
                in_window.origin.y,
                in_window.size.width,
                in_window.size.height,
            ],
        )?;
        Ok(Self {
            window_id,
            process_id: std::process::id()
                .try_into()
                .map_err(|_| "invalid process ID")?,
            width,
            height,
            content,
            scale,
            view_is_flipped,
            point_width: frame.size.width,
            point_height: frame.size.height,
        })
    }
}

struct Captured {
    png: Vec<u8>,
    pixels: Result<Report, String>,
}

#[derive(Debug)]
pub struct FrameWitness {
    pub callbacks: usize,
    pub visible: bool,
    pub error: Option<String>,
    /// Mach absolute time before the current phase requests its normal frame.
    pub requested_at: u64,
}

impl FrameWitness {
    fn passed(&self) -> bool {
        self.callbacks >= 2 && self.visible && self.error.is_none()
    }
}

type Pending<T> = Arc<Mutex<CaptureState<T>>>;

struct PreparedCapture {
    filter: ObjcOwned,
    configuration: ObjcOwned,
}

extern "C" {
    fn mach_absolute_time() -> u64;
}

pub fn phase_clock() -> u64 {
    // The native SCStreamFrameInfoDisplayTime uses this same host clock.
    unsafe { mach_absolute_time() }
}

fn finish<T>(pending: &Pending<T>, result: Result<T, String>) {
    if let Ok(mut state) = pending.lock() {
        state.complete(result, Instant::now());
    }
}

fn is_pending<T>(pending: &Pending<T>) -> bool {
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

/// Normalize the borrowed ScreenCaptureKit CGImage into a tightly packed,
/// known channel order before examining pixels. The PNG itself is encoded
/// from the original CGImage; this conversion never substitutes rendered or
/// synthetic pixels for OS capture evidence.
unsafe fn rgba_pixels(image: *const c_void, target: Target) -> Result<Vec<u8>, String> {
    let bytes_per_row = target.width.checked_mul(4).ok_or("RGBA stride overflow")?;
    let length = bytes_per_row
        .checked_mul(target.height)
        .filter(|length| *length <= 128 * 1024 * 1024)
        .ok_or("RGBA buffer exceeds capture bounds")?;
    let mut rgba = vec![0u8; length];
    let color = ColorSpace(CGColorSpaceCreateDeviceRGB());
    if color.0.is_null() {
        return Err("RGB color space allocation failed".into());
    }
    // kCGBitmapByteOrder32Big | kCGImageAlphaPremultipliedLast = RGBA8.
    let context = BitmapContext(CGBitmapContextCreate(
        rgba.as_mut_ptr().cast(),
        target.width,
        target.height,
        8,
        bytes_per_row,
        color.0,
        0x4000 | 1,
    ));
    if context.0.is_null() {
        return Err("RGBA bitmap context allocation failed".into());
    }
    CGContextDrawImage(
        context.0,
        NSRect {
            origin: NSPoint { x: 0.0, y: 0.0 },
            size: NSSize {
                width: target.width as f64,
                height: target.height as f64,
            },
        },
        image,
    );
    drop(context);
    Ok(rgba)
}

unsafe fn captured_image(image: *const c_void, target: Target) -> Result<Captured, String> {
    let png = encode_png(image, target)?;
    let pixels = rgba_pixels(image, target).and_then(|rgba| {
        capture_pixels::inspect(
            target.width,
            target.height,
            &rgba,
            target.content,
            target.scale,
        )
    });
    Ok(Captured { png, pixels })
}

/// Starts only the consent-free, current-process content query. The callback
/// selects the exact AppKit window ID and independently verifies its owner and
/// point dimensions. Nothing else is captured or logged.
unsafe fn start(target: Target, pending: Pending<PreparedCapture>) -> Result<(), String> {
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
        // SAFETY: ScreenCaptureKit owns the queried objects for this callback.
        // No AppKit view is touched and no borrowed window pointer escapes;
        // only our owned filter/configuration cross to the stream waiter.
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
            finish(&pending, Ok(PreparedCapture { filter, configuration }));
        }
    });
    let _: () = msg_send![class!(SCShareableContent), getCurrentProcessShareableContentWithCompletionHandler: &*content_ready];
    Ok(())
}

pub async fn capture(
    target: Target,
    path: &Path,
    frames: FrameWitness,
    cx: &AsyncApp,
) -> Result<Report, String> {
    // Query, stream start, first complete frame, stop and output-queue drain
    // share the original capture deadline. No stage receives a fresh 5 s.
    let deadline = Instant::now() + Duration::from_secs(5);
    let pending = Arc::new(Mutex::new(CaptureState::new(deadline)));
    // SAFETY: framework access is guarded by availability; target is a value
    // snapshot of our live test window, not an arbitrary externally supplied ID.
    unsafe {
        start(target, Arc::clone(&pending))?;
    }
    let prepared = loop {
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
    let stream = native_stream::capture(
        target,
        prepared,
        frames.requested_at,
        deadline,
        path,
        cx,
    )
    .await?;
    let captured = stream.captured?;
    // Retain original failed pixels and their counts as well as successful
    // evidence. Only this waiter writes files; late/duplicate callbacks still
    // cannot create or replace any artifact.
    write_fresh(path, &captured.png)?;
    let rectangle = |rect: Rect| {
        serde_json::json!({
            "x": rect.x, "y": rect.y, "width": rect.width, "height": rect.height,
        })
    };
    let evidence = match &captured.pixels {
        Ok(report) => serde_json::json!({
            "rule": "two-label-content-v1",
            "passed": report.passed() && frames.passed() && stream.resource_error.is_none(),
            "pixelGatePassed": report.passed(),
            "platformFrames": { "callbacks": frames.callbacks, "visible": frames.visible, "error": frames.error },
            "nativeStream": stream.receipt,
            "windowId": target.window_id,
            "processId": target.process_id,
            "width": target.width,
            "height": target.height,
            "scale": target.scale,
            "viewIsFlipped": target.view_is_flipped,
            "rgbaFormat": "premultiplied-rgba8",
            "content": rectangle(report.content),
            "labels": report.labels.iter().map(|label| serde_json::json!({
                "label": label.label,
                "roi": rectangle(label.roi),
                "backgroundPixels": label.background,
                "inkPixels": label.ink,
                "inkColumns": label.ink_columns,
                "inkRows": label.ink_rows,
                "segmentedRows": label.segmented_rows,
                "passed": label.passed,
            })).collect::<Vec<_>>(),
        }),
        Err(error) => serde_json::json!({
            "rule": "two-label-content-v1", "passed": false, "error": error,
            "platformFrames": { "callbacks": frames.callbacks, "visible": frames.visible, "error": frames.error },
            "nativeStream": stream.receipt,
            "windowId": target.window_id, "processId": target.process_id,
        }),
    };
    let evidence_bytes = serde_json::to_vec_pretty(&evidence).map_err(|error| error.to_string())?;
    write_fresh(&path.with_extension("pixels.json"), &evidence_bytes)?;
    let report = captured.pixels?;
    if !frames.passed() {
        return Err(format!(
            "normal platform frame wait failed: {frames:?}; pixels: {report:?}"
        ));
    }
    if !report.passed() {
        return Err(format!("two-label content pixel gate failed: {report:?}"));
    }
    if let Some(error) = stream.resource_error {
        return Err(error);
    }
    Ok(report)
}

fn write_fresh(path: &Path, bytes: &[u8]) -> Result<(), String> {
    // Refuse old artifacts rather than silently reusing them.
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|error| format!("fresh capture artifact creation failed: {error}"))?;
    if let Err(error) = file.write_all(bytes) {
        drop(file);
        let _ = std::fs::remove_file(path);
        return Err(format!("capture artifact write failed: {error}"));
    }
    Ok(())
}
