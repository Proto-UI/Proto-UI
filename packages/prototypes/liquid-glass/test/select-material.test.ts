import { describe, expect, it, vi } from 'vitest';
import type { Prototype, StyleHandle } from '@proto.ui/core';
import { createRuntimeSession } from '@proto.ui/runtime';
import {
  EFFECTS_CAP,
  VISUAL_FEEDBACK_SINK_CAP,
  type FeedbackPort,
  type VisualFeedbackFrame,
} from '@proto.ui/module-feedback';
import {
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_ROOT_TARGET_CAP,
} from '@proto.ui/module-anatomy';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import { EVENT_ROOT_TARGET_CAP, EVENT_GLOBAL_TARGET_CAP } from '@proto.ui/module-event';
import { EXPOSES_RECORD_SINK_CAP } from '@proto.ui/module-expose-state';
import {
  AS_TRIGGER_INSTANCE_CAP,
  AS_TRIGGER_PARENT_CAP,
  AS_TRIGGER_GET_PROTO_CAP,
} from '@proto.ui/module-as-trigger';
import {
  FOCUS_INSTANCE_TOKEN_CAP,
  FOCUS_PARENT_CAP,
  FOCUS_ROOT_TARGET_CAP,
} from '@proto.ui/module-focus';
import { selectRoot, selectTrigger, selectContent } from '../src/select';

async function fixture(sink = true) {
  const parents = new Map<unknown, unknown | null>();
  const prototypes = new Map<unknown, Prototype<any, any>>();
  const globalTarget = document.createElement('div');
  function create(
    prototype: Prototype<any, any>,
    initial: Record<string, unknown> = {},
    parent: object | null = null
  ) {
    const target = document.createElement('div');
    parents.set(target, parent);
    prototypes.set(target, prototype);
    let props = initial;
    let exposes: Record<string, any> = {};
    const frames: VisualFeedbackFrame[] = [];
    const styles: StyleHandle[] = [];
    const release = vi.fn();
    const session = createRuntimeSession(prototype, {
      prototypeName: prototype.name,
      getRawProps: () => props,
      schedule: (fn) => fn(),
      scheduleDelay(duration, task) {
        const id = setTimeout(task, duration);
        return { cancel: () => clearTimeout(id) };
      },
      commit: (_children, signal) => signal?.done(),
      onRuntimeReady(wiring) {
        wiring.attach('anatomy', [
          [ANATOMY_INSTANCE_TOKEN_CAP, target],
          [ANATOMY_PARENT_CAP, (token: unknown) => parents.get(token) ?? null],
          [ANATOMY_GET_PROTO_CAP, (token: unknown) => prototypes.get(token) ?? null],
          [ANATOMY_ROOT_TARGET_CAP, (token: unknown) => token as HTMLElement],
        ]);
        wiring.attach('context', [
          [CONTEXT_INSTANCE_TOKEN_CAP, target],
          [CONTEXT_PARENT_CAP, (token: unknown) => parents.get(token) ?? null],
        ]);
        wiring.attach('event', [
          [EVENT_ROOT_TARGET_CAP, () => target],
          [EVENT_GLOBAL_TARGET_CAP, () => globalTarget],
        ]);
        wiring.attach('as-trigger', [
          [AS_TRIGGER_INSTANCE_CAP, target],
          [AS_TRIGGER_PARENT_CAP, (token: unknown) => parents.get(token) ?? null],
          [AS_TRIGGER_GET_PROTO_CAP, (token: unknown) => prototypes.get(token) ?? null],
        ]);
        wiring.attach('focus', [
          [FOCUS_INSTANCE_TOKEN_CAP, target],
          [FOCUS_PARENT_CAP, (token: unknown) => parents.get(token) ?? null],
          [FOCUS_ROOT_TARGET_CAP, () => target],
        ]);
        wiring.attach('expose-state', [
          [
            EXPOSES_RECORD_SINK_CAP,
            (value: Record<string, unknown>) => {
              exposes = value;
            },
          ],
        ]);
        wiring.attach('feedback', [
          [
            EFFECTS_CAP,
            { queueStyle: (style: StyleHandle) => styles.push(style), requestFlush() {} },
          ],
        ]);
        if (sink)
          wiring.attach('feedback', [
            [
              VISUAL_FEEDBACK_SINK_CAP,
              {
                commit(frame: VisualFeedbackFrame) {
                  frames.push(frame);
                },
                release,
              },
            ],
          ]);
      },
    });
    return {
      target,
      session,
      frames,
      styles,
      release,
      get exposes() {
        return exposes;
      },
      get feedback() {
        return session.caps.getPort<FeedbackPort>('feedback')!;
      },
      set(next: Record<string, unknown>) {
        props = next;
        session.controller.applyRawProps(props);
      },
      input(type: string) {
        target.dispatchEvent(new CustomEvent(type));
      },
    };
  }
  const root = create(selectRoot);
  await root.session.mount();
  const trigger = create(selectTrigger, {}, root.target);
  await trigger.session.mount();
  const content = create(selectContent, {}, root.target);
  await content.session.mount();
  return {
    root,
    trigger,
    content,
    async dispose() {
      await content.session.dispose();
      await trigger.session.dispose();
      await root.session.dispose();
    },
  };
}
const candidate = (phase: 'rest' | 'pressed') => ({
  intent: 'liquid-glass',
  deformation: { kind: 'press', phase },
});

describe('Liquid Select shared material consumer (intent only, no paint claim)', () => {
  it('declares one Trigger slot and consumes Base pressed/rest as mutually exclusive whole candidates', async () => {
    const f = await fixture();
    try {
      expect(f.trigger.frames.at(-1)?.material.slot).toEqual({
        version: 2,
        shape: { kind: 'rounded-rect', geometry: 'style' },
        source: { kind: 'in-app-backdrop' },
        fallback: { fill: 'style', foreground: 'style' },
      });
      expect(f.trigger.frames.at(-1)?.material.candidates).toEqual([candidate('rest')]);
      expect(f.root.feedback.exportMaterialFrame?.()).toEqual({ slot: null, candidates: [] });
      expect(f.content.feedback.exportMaterialFrame?.().slot).toEqual(
        f.trigger.frames.at(-1)?.material.slot
      );
      expect(f.content.feedback.exportMaterialFrame?.().candidates).toEqual([]);
      f.trigger.input('pointer.down');
      expect(f.trigger.exposes.pressed.get()).toBe(true);
      expect(f.trigger.frames.at(-1)?.material.candidates).toEqual([candidate('pressed')]);
      f.trigger.input('pointer.cancel');
      expect(f.trigger.frames.at(-1)?.material.candidates).toEqual([candidate('rest')]);
      f.trigger.input('pointer.down');
      f.root.set({ disabled: true });
      expect(f.trigger.exposes.pressed.get()).toBe(false);
      expect(f.trigger.frames.at(-1)?.material.candidates).toEqual([candidate('rest')]);
      // Setup can project an unresolved empty candidate with the opaque fallback;
      // no complete frame may combine conflicting rest/pressed candidates.
      expect(f.trigger.frames.every((frame) => frame.material.candidates.length <= 1)).toBe(true);
      expect(
        f.trigger.frames.every((frame) =>
          frame.material.candidates.every((item) => item.intent === 'liquid-glass')
        )
      ).toBe(true);
    } finally {
      await f.dispose();
    }
  });

  it('keeps real disclosure ownership, styles and logical lifetime with a missing visual host', async () => {
    const f = await fixture(false);
    try {
      expect(f.trigger.frames).toEqual([]);
      expect(f.trigger.feedback.materialDiagnostics?.()).toEqual(['material-host-unavailable']);
      expect(f.trigger.styles.at(-1)?.tokens).toEqual(
        expect.arrayContaining(['bg-secondary', 'text-foreground', 'rounded-xl'])
      );
      expect(f.trigger.feedback.exportMaterialFrame?.().candidates).toEqual([candidate('rest')]);
      f.trigger.input('press.commit');
      expect(f.root.exposes.open.get()).toBe(true);
      expect(f.content.exposes.open.get()).toBe(true);
      expect(f.content.feedback.exportMaterialFrame?.().candidates).toEqual([
        { intent: 'liquid-glass' },
      ]);
      f.trigger.input('press.commit');
      expect(f.root.exposes.open.get()).toBe(false);
      expect(f.content.exposes.open.get()).toBe(false);
      expect(f.content.feedback.exportMaterialFrame?.().candidates).toEqual([]);
      expect(f.trigger.feedback.exportMaterialFrame?.().candidates).toEqual([candidate('rest')]);
    } finally {
      await f.dispose();
    }
  });

  it('releases the old view and replays current Base state after remount without stale candidates', async () => {
    const f = await fixture();
    try {
      f.trigger.input('pointer.down');
      const old = f.trigger.frames.at(-1)!.view;
      await f.trigger.session.unmount();
      const count = f.trigger.frames.length;
      expect(f.trigger.release).toHaveBeenCalledWith(old);
      expect(f.trigger.exposes.pressed.get()).toBe(false);
      await f.trigger.session.mount();
      expect(f.trigger.frames.length).toBeGreaterThan(count);
      expect(f.trigger.frames.at(-1)!.view).toBeGreaterThan(old);
      expect(f.trigger.frames.at(-1)?.material.candidates).toEqual([candidate('rest')]);
    } finally {
      await f.dispose();
    }
    expect(f.trigger.feedback.exportMaterialFrame?.()).toEqual({ slot: null, candidates: [] });
  });
});
