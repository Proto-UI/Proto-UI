# GPUI own-window capture reconstruction

Date: 2026-10-07. Source base: `7a7c0bed14592562b127dad34bc3527c2001429a`. Related work: #872 and the exact-head CI record for `1d166ee703d2653cc32109dec914c31ae28bd869`.

## Recovery boundary

The fifth source commit survived in GitHub. The later local capture tree `1bd50ef40e90c37f8d64a1792311f2ee55a1cc60` could not be recovered through the Git tree API on 2026-10-07 (422, invalid object). This is a newly reconstructed candidate, not a byte-identical recovery or reuse of its old review result.

The original macOS test reached the Label assertions and then stopped because the pinned GPUI platform does not implement `Window.render_to_image`. No PNG was obtained and the later native activation checks did not run. The historical failure remains a failure.

## Bounded repair

- Keep GPUI at `62e5991dd0f0c8a3af8d5e7e9c4652490d468db8`.
- Use macOS 14.4+ ScreenCaptureKit's current-process query only. Select the live test window by exact window number, current PID and unchanged point size.
- Capture that desktop-independent window only, with no cursor, child windows, audio, desktop capture, permission prompt or unrestricted fallback.
- Set exact physical pixel dimensions; validate the returned image dimensions and PNG encoding. The PNG includes only this test window, including its own title bar, not the surrounding desktop.
- Give callbacks a five-second deadline and a one-result retirement gate. Callbacks can only produce memory buffers. Only the waiting test writes a new PNG, so a late callback cannot publish or overwrite evidence.
- Await capture without blocking the main loop, then re-read accessibility objects before invoking actions. Preserve capture errors while still running subsequent native actions, and report a failed terminal result if any capture failed. Do not convert a missing image into a passing test.
- Expose only already-locked `block2 0.5.1` and `objc2-foundation 0.2.2` to the feature-gated test. Cargo regenerated exactly those two dependency edges, with no package updates.

Apple's current-process API is documented at https://developer.apple.com/documentation/screencapturekit/scshareablecontent/getcurrentprocessshareablecontent(completionhandler:). The screenshot API is https://developer.apple.com/documentation/screencapturekit/scscreenshotmanager/captureimage(contentfilter:configuration:completionhandler:).

## Evidence and remaining work

Source regression tests guard query scope, ownership, OS gate, unchanged pin, late-write separation, action continuation, and SHA-bound artifact requirements. Pure Rust state tests cover one-time consumption, duplicate and late results, and preservation of failures. These do not establish SDK compatibility or native pixels.

Local checks on 2026-10-07 used the official stable Rust 1.99.0 toolchain and Node 24.19.0:

- PASS: all three executable Rust capture-state tests (standalone `rustc --test`).
- PASS: all five source privacy/evidence guards. A first rerun after rustfmt exposed a whitespace-sensitive source assertion; its matcher was corrected without changing the timeout requirement, and all five passed again.
- PASS: whole-workspace `cargo fmt --all --check`. This also required two formatting-only corrections already present in the recovered fifth source, in `tests/layout.rs` and `tests/style_map.rs`.
- PASS: Cargo generated exactly two direct dependency edges, with zero package updates and the original GPUI pin unchanged.
- PASS, LIMITED: the capture helper type-checks for `x86_64-apple-darwin` using the exact locked Objective-C crates. The isolated compile-only harness stubs GPUI scheduling; it neither links the macOS SDK nor runs a window and does not establish native API behavior.
- NOT RUN: Clippy (local component setup was interrupted), full native crate compilation, actual macOS execution, decoded PNG inspection and independent acceptance.

Do not mark GPUI parity, AvailableSpace, native material, explicit Liquid Glass, or any Finf acceptance row complete from this evidence repair.

Explicit Liquid Glass remains the requested self-implemented optical effect. ScreenCaptureKit here is evidence-only and is not a production glass source. Adaptive native blur is a separate intent and cannot satisfy explicit glass.
