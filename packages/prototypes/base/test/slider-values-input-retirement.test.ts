import { expect, it } from 'vitest';
import { createRuntimeSession, type RuntimeHost } from '@proto.ui/runtime';
import type { AxisInputHostBinding, AxisInputSample } from '@proto.ui/core';
import { sliderValuesRoot, sliderValuesTrack, sliderValuesThumb } from '../src/slider';
import {
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_ROOT_TARGET_CAP,
} from '@proto.ui/module-anatomy';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import { EVENT_ROOT_TARGET_CAP, EVENT_GLOBAL_TARGET_CAP } from '@proto.ui/module-event';
import {
  FOCUS_ROOT_TARGET_CAP,
  FOCUS_REQUEST_FOCUS_CAP,
  FOCUS_SET_FOCUSABLE_CAP,
} from '@proto.ui/module-focus';
import { AXIS_INPUT_HOST_CAP } from '@proto.ui/module-axis-input';
import { EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
import { EXPOSE_STATE_SET_EXPOSES_CAP } from '@proto.ui/module-expose-state';

/** Actual Runtime sessions with explicit synthetic input/focus host seams.
 * Unlike DOM removal, terminal disposal happens inside the synchronous call
 * stack, so a later read from a retired RunHandle cannot hide behind a tick. */
async function fixture() {
  const rootToken = document.createElement('div'),
    trackToken = document.createElement('div');
  const thumbTokens = [document.createElement('div'), document.createElement('div')];
  const parents = new Map<object, object>([
    [trackToken, rootToken],
    ...thumbTokens.map((token) => [token, trackToken] as const),
  ]);
  const protos = new Map<object, any>([
    [rootToken, sliderValuesRoot],
    [trackToken, sliderValuesTrack],
    ...thumbTokens.map((token) => [token, sliderValuesThumb] as const),
  ]);
  let binding: AxisInputHostBinding | null = null;
  let onFocus = () => {};
  let onChange = () => {};
  const events: Array<{ name: string; value: unknown }> = [];
  function make(token: HTMLElement, raw: Record<string, unknown>) {
    let x: Record<string, any> = {};
    const proto = protos.get(token);
    const host: RuntimeHost<any> = {
      prototypeName: proto.name,
      getRawProps: () => raw,
      schedule: (task) => task(),
      commit: (_change, signal) => signal?.done(),
      onRuntimeReady(w) {
        w.attach('anatomy', [
          [ANATOMY_INSTANCE_TOKEN_CAP, token],
          [ANATOMY_PARENT_CAP, (item: object) => parents.get(item) ?? null],
          [ANATOMY_GET_PROTO_CAP, (item: object) => protos.get(item) ?? null],
          [ANATOMY_ROOT_TARGET_CAP, (item: object) => item],
        ]);
        w.attach('context', [
          [CONTEXT_INSTANCE_TOKEN_CAP, token],
          [CONTEXT_PARENT_CAP, (item: object) => parents.get(item) ?? null],
        ]);
        w.attach('event', [
          [EVENT_ROOT_TARGET_CAP, () => token],
          [EVENT_GLOBAL_TARGET_CAP, () => document],
        ]);
        w.attach('focus', [
          [FOCUS_ROOT_TARGET_CAP, () => token],
          [FOCUS_SET_FOCUSABLE_CAP, () => {}],
          [
            FOCUS_REQUEST_FOCUS_CAP,
            () => {
              onFocus();
              return true;
            },
          ],
        ]);
        w.attach('axis-input', [
          [
            AXIS_INPUT_HOST_CAP,
            {
              attach(next: AxisInputHostBinding) {
                binding = next;
                return {
                  update(next: AxisInputHostBinding) {
                    binding = next;
                  },
                  dispose() {},
                };
              },
            },
          ],
        ]);
        w.attach('expose-event', [
          [
            EXPOSE_EVENT_SINK_CAP,
            (name: string, value: unknown) => {
              events.push({ name, value });
              if (name === 'valueChange') onChange();
            },
          ],
        ]);
        w.attach('expose-state', [
          [
            EXPOSE_STATE_SET_EXPOSES_CAP,
            (next: Record<string, unknown>) => {
              x = next;
            },
          ],
        ]);
      },
    };
    return {
      session: createRuntimeSession(proto, host),
      get x() {
        return x;
      },
    };
  }
  const root = make(rootToken, { defaultValue: [20, 80] }),
    track = make(trackToken, {});
  const thumbs = thumbTokens.map((token, index) => make(token, { index }));
  const all = [root, track, ...thumbs];
  for (const instance of all) await instance.session.mount();
  return {
    root,
    track,
    thumbs,
    all,
    events,
    setFocus(callback: () => void) {
      onFocus = callback;
    },
    setChange(callback: () => void) {
      onChange = callback;
    },
    receiver() {
      expect(binding).not.toBeNull();
      expect(binding!.config.disabled).toBe(false);
      return binding!.onSample;
    },
    async dispose() {
      for (const instance of [...all].reverse()) await instance.session.dispose();
    },
  };
}
const sample = (phase: 'start' | 'move' | 'end'): AxisInputSample => ({
  phase,
  position: phase === 'start' ? 0.2 : 0.3,
  delta: phase === 'start' ? 0 : 0.1,
  totalDelta: phase === 'start' ? 0 : 0.1,
  originIndex: 0,
});

for (const boundary of ['begin', 'focus', 'request'] as const) {
  for (const retired of ['root', 'track', 'all'] as const) {
    it(`terminates Track continuation when ${retired} is synchronously disposed at ${boundary}`, async () => {
      const f = await fixture();
      let stopped = false;
      const dispose = () => {
        if (stopped) return;
        stopped = true;
        for (const item of retired === 'all' ? [...f.all].reverse() : [f[retired]])
          void item.session.dispose();
      };
      if (boundary === 'begin')
        f.root.x.interacting.subscribe((event: any) => {
          if (event.type === 'next' && event.next) dispose();
        });
      if (boundary === 'focus') f.setFocus(dispose);
      if (boundary === 'request') f.setChange(dispose);
      const receive = f.receiver();
      try {
        expect(() =>
          f.track.session.invokeInCallbackScope(() => receive(sample('start')))
        ).not.toThrow();
        if (boundary === 'request')
          expect(() =>
            f.track.session.invokeInCallbackScope(() => receive(sample('move')))
          ).not.toThrow();
        expect(stopped).toBe(true);
        expect(() => receive(sample('end'))).not.toThrow();
        expect(f.events.filter((event) => event.name === 'valueCommit')).toEqual([]);
        if (retired === 'track') expect(f.root.x.interacting.get()).toBe(false);
      } finally {
        await f.dispose();
      }
    });
  }
}
