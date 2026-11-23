import { describe, expect, it } from 'vitest';
import {
  assertBootstrapButtonEntryMotion,
  assertBootstrapButtonImmediateExit,
  type BootstrapMotionFrame,
  type BootstrapMotionTrace,
} from './bootstrap-button-motion-evidence';

const frame = (y: number, active = false): BootstrapMotionFrame => ({
  time: y * -6,
  y,
  property: active ? 'background-position' : 'none',
  duration: active ? '0.1s' : '0s',
  easing: active ? 'linear' : 'ease',
  width: 65,
  height: 30,
  animations: active
    ? [{ property: 'background-position-y', duration: 100, playState: 'running' }]
    : [],
});
const entry = (): BootstrapMotionTrace => ({
  frames: [frame(0), frame(-5, true), frame(-10, true), frame(-15)],
  native: [{ type: 'pointerenter', trusted: true }],
  events: [
    { type: 'transitionrun', property: 'background-position-y', elapsedTime: 0, trusted: true },
    { type: 'transitionend', property: 'background-position-y', elapsedTime: 0.1, trusted: true },
  ],
});

describe('Bootstrap original Button motion oracle', () => {
  it('accepts measured native 100ms linear entry and immediate exit', () => {
    expect(() => assertBootstrapButtonEntryMotion(entry(), 'pointerenter')).not.toThrow();
    expect(() =>
      assertBootstrapButtonImmediateExit({
        frames: [frame(-15), frame(0)],
        events: [],
        native: [{ type: 'pointerleave', trusted: true }],
      })
    ).not.toThrow();
  });
  it('rejects the old static endpoint implementation even if duration CSS is present', () => {
    const trace = entry();
    trace.frames = [frame(0), frame(0), frame(-15)];
    trace.frames[2].duration = '0.1s';
    trace.events = [];
    expect(() => assertBootstrapButtonEntryMotion(trace, 'pointerenter')).toThrow();
  });
  it('rejects a default 150ms transition and non-linear or geometry-changing motion', () => {
    for (const mutate of [
      (trace: BootstrapMotionTrace) => (trace.frames[1].duration = '0.15s'),
      (trace: BootstrapMotionTrace) => (trace.frames[1].animations[0].duration = 150),
      (trace: BootstrapMotionTrace) => (trace.frames[1].easing = 'ease'),
      (trace: BootstrapMotionTrace) => (trace.frames[1].width = 67),
      (trace: BootstrapMotionTrace) => (trace.events[1].elapsedTime = 0.15),
      (trace: BootstrapMotionTrace) => (trace.native[0].trusted = false),
    ]) {
      const trace = entry();
      mutate(trace);
      expect(() => assertBootstrapButtonEntryMotion(trace, 'pointerenter')).toThrow();
    }
  });
  it('rejects an invented reverse animation even when it eventually returns to zero', () => {
    expect(() =>
      assertBootstrapButtonImmediateExit({
        frames: [frame(-15), frame(-5, true), frame(0)],
        events: [],
        native: [{ type: 'pointerleave', trusted: true }],
      })
    ).toThrow();
  });
});
