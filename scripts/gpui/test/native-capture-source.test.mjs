import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// These are source-bound privacy/evidence regressions, not macOS execution or
// pixel acceptance. The separate real-window CI job must still compile/run.
const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const native = 'native/gpui/crates/proto-ui-gpui/';
const capture = read(`${native}tests/support/native_capture.rs`);
const stream = read(`${native}tests/support/native_stream.rs`);
const frame = read(`${native}tests/support/capture_frame.rs`);
const runner = read(`${native}tests/accesskit_macos.rs`);
const allCapture = `${capture}\n${stream}`;

test('capture queries only current-process content and selects exact ownership', () => {
  assert.match(capture, /getCurrentProcessShareableContentWithCompletionHandler/);
  assert.doesNotMatch(
    allCapture,
    /getShareableContentWithCompletionHandler|getShareableContentExcludingDesktopWindows|CGWindowListCreateImage|CGRequestScreenCaptureAccess|captureImageInRect/
  );
  for (const field of [
    'window_id != target.window_id',
    'process_id == target.process_id',
    'frame.size.width == target.point_width',
    'frame.size.height == target.point_height',
  ]) {
    assert.ok(capture.includes(field), field);
  }
  assert.match(capture, /initWithDesktopIndependentWindow: selected/);
  assert.match(capture, /setIncludeChildWindows: false/);
  assert.match(capture, /setShowsCursor: false/);
  assert.match(capture, /setCapturesAudio: false/);
});

test('capture has an explicit OS gate and keeps the original upstream pin', () => {
  assert.match(capture, /version.majorVersion < 14/);
  assert.match(capture, /version.minorVersion < 4/);
  assert.match(
    capture,
    /respondsToSelector: sel!\(getCurrentProcessShareableContentWithCompletionHandler:/
  );
  const workspace = read('native/gpui/Cargo.toml');
  const pins = [...workspace.matchAll(/rev = "([a-f0-9]+)"/g)].map((match) => match[1]);
  assert.deepEqual(pins, Array(2).fill('62e5991dd0f0c8a3af8d5e7e9c4652490d468db8'));
});

test('asynchronous callbacks cannot write files and waiter refuses stale PNGs', () => {
  const callbacks = capture.slice(
    capture.indexOf('unsafe fn start'),
    capture.indexOf('pub async fn capture')
  );
  const streamCallbacks = stream.slice(
    stream.indexOf('unsafe extern "C" fn output_frame'),
    stream.indexOf('pub(super) async fn capture')
  );
  assert.doesNotMatch(
    `${callbacks}\n${streamCallbacks}`,
    /OpenOptions|write_all|std::fs::|File::|write_fresh\(/
  );
  assert.match(capture, /let deadline = Instant::now\(\) \+ Duration::from_secs\(5\)/);
  assert.match(capture, /CaptureState::new\(deadline\)/);
  assert.doesNotMatch(stream, /Duration::from_secs\(/);
  assert.equal([...stream.matchAll(/CaptureState::new\(deadline\)/g)].length, 3);
  assert.match(capture, /create_new\(true\)/);
  assert.match(capture, /CGImageGetWidth\(image\) != target.width/);
  assert.match(capture, /CGImageGetHeight\(image\) != target.height/);
  assert.match(stream, /_prepared: PreparedCapture/);
  assert.match(stream, /struct StopOnDrop\(Arc<Resources>\)/);
});

test('native frame selection is metadata-only and never retries the pixel oracle', () => {
  assert.doesNotMatch(allCapture, /SCScreenshotManager|captureImageWithFilter/);
  assert.doesNotMatch(frame, /report\.passed\(|capture_pixels::|captured_image\(/);
  assert.equal([...stream.matchAll(/captured_image\(/g)].length, 1);
  const qualified = stream.slice(
    stream.indexOf('Admission::FirstComplete => {'),
    stream.indexOf('Admission::Observe(_) | Admission::Fail(_) => {')
  );
  assert.match(qualified, /captured_image\(image\.0, shared.target\)/);
  assert.match(frame, /metadata.status != Some\(0\)/);
  assert.match(frame, /display_time < self.phase_started_at/);
  assert.match(frame, /display_time > observed_at/);
  assert.match(frame, /self.stream != 0 && stream == self.stream/);
  assert.match(frame, /if !self.owns_stream\(stream\)/);
  assert.match(frame, /self.retired = true;\s*Admission::FirstComplete/);
  assert.match(stream, /CMSampleBufferIsValid\(sample\)/);
  assert.match(stream, /CMSampleBufferDataIsReady\(sample\)/);
  assert.match(stream, /VTCreateCGImageFromCVPixelBuffer/);
  assert.doesNotMatch(allCapture, /render_to_image\(/);
});

test('native stop removes output, fences its serial queue and rejects late phase delivery', () => {
  assert.match(
    stream,
    /dispatch_queue_create\(\s*c"org.proto-ui.native-evidence".as_ptr\(\),\s*ptr::null\(\),?\s*\)/
  );
  assert.match(stream, /removeStreamOutput: owner.output.0 type: 0isize/);
  assert.match(stream, /dispatch_async\(queue,/);
  assert.doesNotMatch(stream, /dispatch_sync/);
  assert.match(stream, /shared.retired.load\(Ordering::Acquire\)/);
  assert.match(stream, /admission.observe\(stream as usize,/);
  assert.match(stream, /admission.owns_stream\(stream as usize\)/);
  assert.match(stream, /Arc::ptr_eq\(shared, &owner.shared\)/);
  assert.match(stream, /owner.stop_gate.complete_start\(\)/);
  assert.match(stream, /self.stop_gate.request\(\)/);
  assert.match(stream, /owner.stop_gate.complete_stop\(\)/);
  const nativeErrors = stream.slice(
    stream.indexOf('unsafe extern "C" fn stopped_with_error'),
    stream.indexOf('fn output_class')
  );
  assert.doesNotMatch(nativeErrors, /shared.retired/);
  assert.match(stream, /match failure.seal\(\)/);
  assert.ok(
    stream.indexOf('match failure.seal()') < stream.indexOf('finish(&owner.stopped, result)')
  );
  assert.match(capture, /frames.passed\(\) && stream.resource_error.is_none\(\)/);
  assert.match(capture, /if let Some\(error\) = stream.resource_error/);
});

test('incomplete frame metadata and original failed pixels remain evidence', () => {
  assert.match(stream, /"frames": records/);
  assert.match(stream, /"captureError": captured.as_ref\(\).err\(\)/);
  assert.match(stream, /with_extension\("frames.json"\)/);
  assert.match(stream, /\.frame-\{index:04\}\.png/);
  assert.match(capture, /write_fresh\(path, &captured.png\)\?/);
  assert.ok(
    capture.indexOf('write_fresh(path, &captured.png)') < capture.indexOf('if !report.passed()')
  );
});

test('capture failures preserve later native actions and fail the terminal run', () => {
  assert.doesNotMatch(runner, /render_to_image\(\)/);
  assert.match(runner, /self.capture_failures.push\(failure\)/);
  const firstCapture = runner.indexOf('run.capture("action-enabled", cx).await');
  const passiveAction = runner.indexOf('let passive_accepted = run.press(passive, cx).await');
  assert.ok(firstCapture > 0 && passiveAction > firstCapture);
  assert.match(runner.slice(firstCapture, passiveAction), /let labels: Vec<Seen>/);
  assert.match(runner, /if run.capture_failures.is_empty\(\)/);
  assert.match(runner, /capture failures:[\s\S]*process::exit\(1\)/);
});

test('CI requires both current-phase PNGs and records source plus hashes', () => {
  const workflow = read('.github/workflows/ci.yml');
  assert.match(workflow, /git rev-parse HEAD/);
  assert.match(workflow, /test -s evidence\/control-label-action-enabled.png/);
  assert.match(workflow, /test -s evidence\/control-label-action-disabled.png/);
  assert.match(workflow, /shasum -a 256 evidence\/control-label-\*\.png/);
});

test('only the macOS evidence feature builds and links real SDK protocol declarations', () => {
  const build = read(`${native}build.rs`);
  const witness = read(`${native}tests/support/native_protocols.m`);
  assert.match(build, /env::var\("CARGO_CFG_TARGET_OS"\).as_deref\(\) != Ok\("macos"\)/);
  assert.match(build, /env::var_os\("CARGO_FEATURE_MACOS_ACCESSIBILITY_TEST"\).is_none\(\)/);
  assert.ok(build.indexOf('return;') < build.indexOf('Command::new("xcrun")'));
  assert.match(build, /CARGO_CFG_TARGET_ARCH/);
  assert.match(build, /"--sdk", "macosx", "--show-sdk-path"/);
  assert.match(build, /"-fblocks"/);
  assert.match(build, /env::var_os\("OUT_DIR"\)/);
  assert.match(build, /cargo:rustc-link-search=native=/);
  assert.doesNotMatch(build, /cargo:rustc-link-lib|cargo:rustc-link-arg|cfg!\(target_os/);
  assert.match(witness, /#import <ScreenCaptureKit\/ScreenCaptureKit.h>/);
  for (const name of ['SCStreamOutput', 'SCStreamDelegate']) {
    assert.ok(witness.includes(`@protocol(${name})`));
  }
  assert.doesNotMatch(
    witness,
    /@interface|@implementation|objc_allocateProtocol|objc_registerProtocol/
  );
  assert.match(stream, /#\[link\(name = "proto_ui_capture_protocols", kind = "static"\)\]/);
  assert.match(stream, /protocol.name\(\) != name \|\| !protocol.conforms_to\(base\)/);
  assert.match(
    stream,
    /AnyProtocol::get\(name\).is_some_and\(\|actual\| ptr::eq\(actual, protocol\)\)/
  );
  assert.match(stream, /class.add_protocol\(protocol\)/);
});

test('only the sealed preparation pair can move through the Mutex and its settings precede publication', () => {
  assert.match(capture, /unsafe impl Send for PreparedCapture \{\}/);
  assert.doesNotMatch(allCapture, /unsafe impl (?:Send|Sync) for (?:ObjcOwned|CfOwned)/);
  assert.doesNotMatch(allCapture, /unsafe impl Sync for PreparedCapture|arc_with_non_send_sync/);
  const structure = capture.match(/^struct PreparedCapture \{[\s\S]*?^\}/m)?.[0];
  assert.ok(structure, 'The preparation type and its fields stay private');
  assert.doesNotMatch(structure, /pub |Clone|NSView|NSWindow/);
  assert.match(capture, /type Pending<T> = Arc<Mutex<CaptureState<T>>>/);
  const publication = capture.indexOf('Ok(PreparedCapture {');
  assert.ok(publication > capture.lastIndexOf('msg_send![configuration.0, set'));
  assert.equal([...capture.matchAll(/Ok\(PreparedCapture \{/g)].length, 1);
  assert.equal([...stream.matchAll(/prepared\.filter\.0/g)].length, 1);
  assert.equal([...stream.matchAll(/prepared\.configuration\.0/g)].length, 1);
  assert.match(stream, /_prepared: prepared/);
  const transfer = read(`${native}tests/capture_transfer.rs`);
  assert.match(transfer, /\#\[path = "support\/capture_state.rs"\]/);
  assert.match(transfer, /thread::spawn/);
  assert.match(transfer, /impl Drop for Owner/);
  assert.doesNotMatch(transfer, /unsafe|thread::sleep/);
});

test('the separate runtime lookup cannot emit the protocols or enumerate capture targets', () => {
  const probe = read('scripts/gpui/native-protocol-lookup.m');
  assert.doesNotMatch(
    probe,
    /@protocol\s*\(|ScreenCaptureKit\/ScreenCaptureKit.h|SCShareableContent|captureImage|startCapture|NSWindow|CGWindow/
  );
  for (const name of ['SCStreamOutput', 'SCStreamDelegate']) {
    assert.ok(probe.includes(`objc_getProtocol("${name}")`));
  }
  assert.match(probe, /dlopen\(/);
  assert.match(probe, /objc_getClass\("SCStream"\)/);
});
