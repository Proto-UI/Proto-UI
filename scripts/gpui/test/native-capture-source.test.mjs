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
const runner = read(`${native}tests/accesskit_macos.rs`);

test('capture queries only current-process content and selects exact ownership', () => {
  assert.match(capture, /getCurrentProcessShareableContentWithCompletionHandler/);
  assert.doesNotMatch(
    capture,
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
  assert.doesNotMatch(callbacks, /OpenOptions|write_all|std::fs::|File::/);
  assert.match(
    capture,
    /CaptureState::new\(\s*Instant::now\(\) \+ Duration::from_secs\(5\),?\s*\)/
  );
  assert.match(capture, /create_new\(true\)/);
  assert.match(capture, /CGImageGetWidth\(image\) != target.width/);
  assert.match(capture, /CGImageGetHeight\(image\) != target.height/);
  assert.match(capture, /let _keep_alive = \(&filter, &configuration\)/);
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
