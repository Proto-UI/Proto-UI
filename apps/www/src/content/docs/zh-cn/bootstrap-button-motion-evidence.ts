import assert from 'node:assert/strict';

export interface BootstrapMotionFrame {
  time: number;
  y: number;
  property: string;
  duration: string;
  easing: string;
  width: number;
  height: number;
  animations: Array<{ property: string; duration: number | string; playState: string }>;
}
export interface BootstrapMotionTrace {
  frames: BootstrapMotionFrame[];
  events: Array<{ type: string; property: string; elapsedTime: number; trusted: boolean }>;
  native: Array<{ type: string; trusted: boolean }>;
  interruption?: { kind: string; time: number; y: number; active: boolean };
}
export function isBackgroundPosition(property: string): boolean {
  // Chromium reports the changing longhand when the authored shorthand is used.
  return property === 'background-position' || property === 'background-position-y';
}
const near = (actual: number, expected: number) => Math.abs(actual - expected) <= 0.05;

/** Pinned buttons.less entry, measured from native events and actual rendered frames. */
export function assertBootstrapButtonEntryMotion(
  trace: BootstrapMotionTrace,
  input: 'pointerenter' | 'focus'
): void {
  assert.ok(trace.native.some((event) => event.type === input && event.trusted));
  assert.ok(trace.frames.length > 2, 'Entry requires real initial, moving and terminal frames.');
  assert.ok(near(trace.frames[0].y, 0), 'Ordinary paint must start at its resting endpoint.');
  assert.ok(near(trace.frames.at(-1)!.y, -15), 'Entry must settle at the upstream -15px endpoint.');
  assert.ok(
    trace.frames.some((frame) => frame.y < -0.05 && frame.y > -14.95),
    'Static endpoints without a measured intermediate frame do not establish motion.'
  );
  assert.ok(
    trace.frames.every((frame) => frame.y >= -15.05 && frame.y <= 0.05),
    'The finite linear entry must not overshoot.'
  );
  const moving = trace.frames.filter((frame) => frame.animations.length > 0);
  assert.ok(moving.length, 'A browser-owned CSS transition must actually run.');
  for (const frame of moving) {
    assert.equal(frame.property, 'background-position');
    assert.equal(frame.duration, '0.1s');
    assert.equal(frame.easing, 'linear');
    for (const animation of frame.animations) {
      assert.ok(isBackgroundPosition(animation.property));
      assert.equal(animation.duration, 100);
    }
  }
  const events = trace.events.filter((event) => isBackgroundPosition(event.property));
  assert.ok(events.some((event) => event.type === 'transitionrun' && event.trusted));
  assert.ok(
    events.some(
      (event) =>
        event.type === 'transitionend' && event.trusted && Math.abs(event.elapsedTime - 0.1) < 1e-6
    ),
    'The native completed transition must report the original 100ms duration.'
  );
  assert.ok(!events.some((event) => event.type === 'transitioncancel'));
  for (const frame of trace.frames) {
    assert.ok(near(frame.width, trace.frames[0].width));
    assert.ok(near(frame.height, trace.frames[0].height));
  }
}

/** Upstream removes the transition declaration on exit; reverse movement is immediate. */
export function assertBootstrapButtonImmediateExit(trace: BootstrapMotionTrace): void {
  assert.ok(
    trace.native.some((event) => ['pointerleave', 'blur'].includes(event.type) && event.trusted)
  );
  assert.ok(trace.frames.length >= 2);
  assert.ok(near(trace.frames[0].y, -15));
  assert.ok(near(trace.frames.at(-1)!.y, 0));
  assert.equal(trace.frames.at(-1)!.property, 'none');
  assert.ok(trace.frames.every((frame) => near(frame.y, -15) || near(frame.y, 0)));
  assert.ok(trace.frames.every((frame) => frame.animations.length === 0));
  assert.ok(!trace.events.some((event) => isBackgroundPosition(event.property)));
}
