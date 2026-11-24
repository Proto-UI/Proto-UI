import { describe, expect, it } from 'vitest';
import { definePrototype, tw, type OwnedStateHandle } from '@proto.ui/core';
import { createRuntimeSession } from '../../src';
import type { StatePort } from '@proto.ui/module-state';
import type { FeedbackPort } from '@proto.ui/module-feedback';
import { RESIDENT_MOTION_SINK_CAP, type ResidentMotionFrame } from '@proto.ui/module-feedback';

describe('resident width reads final Runtime targets and registered State', () => {
  it('updates numeric inputs without a second State owner and follows patch/suppress/view lifetime', async () => {
    let percentage!: OwnedStateHandle<number>;
    const frames: ResidentMotionFrame[] = [];
    let commits = 0;
    const prototype = definePrototype({
      name: 'resident-width-runtime',
      setup(def) {
        percentage = def.state.numberRange('percentage', 25, { min: 0, max: 100 });
        def.expose.state('percentage', percentage);
        def.feedback.style.use(tw('w-[calc(var(--pui-percentage)*1%)]'));
        def.feedback.style.transition({
          properties: ['width'],
          durationMs: 600,
          easing: [0.25, 0.1, 0.25, 1],
        });
      },
    });
    const session = createRuntimeSession(prototype, {
      prototypeName: prototype.name,
      getRawProps: () => ({}),
      schedule: (task) => task(),
      commit(_children, signal) {
        commits++;
        signal?.done();
      },
      onRuntimeReady(wiring) {
        wiring.attach('feedback', [
          [
            RESIDENT_MOTION_SINK_CAP,
            {
              commit: (frame: ResidentMotionFrame) => frames.push(frame),
              release() {},
            },
          ],
        ]);
      },
    });
    await session.mount();
    const state = session.caps.getPort<StatePort>('state')!;
    const feedback = session.caps.getPort<FeedbackPort>('feedback')!;
    expect(frames.at(-1)?.numbers).toEqual({ percentage: 25 });
    const before = commits;
    state.set(percentage, 75);
    expect(frames.at(-1)?.numbers).toEqual({ percentage: 75 });
    expect(commits).toBe(before);
    const original = frames.at(-1)!;
    session.invokeInCallbackScope(() => feedback.patchStyle(tw('w-1/2')));
    expect(frames.at(-1)?.style.tokens).toEqual(['w-1/2']);
    expect(frames.at(-1)?.numbers).toEqual({});
    const patchedCount = frames.length;
    state.set(percentage, 50);
    expect(frames.length).toBe(patchedCount);
    expect(original.numbers).toEqual({ percentage: 75 });
    session.invokeInCallbackScope(() => feedback.clearStylePatch());
    expect(frames.at(-1)?.numbers).toEqual({ percentage: 50 });
    session.invokeInCallbackScope(() => feedback.suppressStyle(tw('w-0')));
    expect(frames.at(-1)?.style.tokens).toEqual([]);
    const suppressedCount = frames.length;
    state.set(percentage, 100);
    expect(frames.length).toBe(suppressedCount);
    session.invokeInCallbackScope(() => feedback.clearStylePatch());
    expect(frames.at(-1)?.numbers).toEqual({ percentage: 100 });
    await session.unmount();
    const detachedCount = frames.length;
    state.set(percentage, 20);
    expect(frames.length).toBe(detachedCount);
    await session.mount();
    expect(frames.at(-1)?.view).toBe(2);
    expect(frames.at(-1)?.numbers).toEqual({ percentage: 20 });
    await session.dispose();
    expect(() => state.set(percentage, 30)).toThrow();
  });

  it('does not call an unregistered exposed lookalike or reinterpret a nonnumeric State', async () => {
    let getterCalls = 0;
    const frames: ResidentMotionFrame[] = [];
    const prototype = definePrototype({
      name: 'resident-width-foreign-runtime',
      setup(def) {
        def.expose.value('percentage', {
          get() {
            getterCalls++;
            return 80;
          },
        });
        def.feedback.style.use(tw('w-[calc(var(--pui-percentage)*1%)]'));
        def.feedback.style.transition({
          properties: ['width'],
          durationMs: 600,
          easing: [0.25, 0.1, 0.25, 1],
        });
      },
    });
    const session = createRuntimeSession(prototype, {
      prototypeName: prototype.name,
      getRawProps: () => ({}),
      schedule: (task) => task(),
      commit(_children, signal) {
        signal?.done();
      },
      onRuntimeReady(wiring) {
        wiring.attach('feedback', [
          [
            RESIDENT_MOTION_SINK_CAP,
            {
              commit: (frame: ResidentMotionFrame) => frames.push(frame),
              release() {},
            },
          ],
        ]);
      },
    });
    await session.mount();
    expect(getterCalls).toBe(0);
    expect(frames.at(-1)?.numbers).toEqual({});
    expect(frames.at(-1)?.sourceDiagnostics).toContain(
      'width:numeric-source-unavailable:percentage'
    );
    await session.dispose();
  });
});
