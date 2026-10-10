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
import { fieldRoot, fieldControl } from '../src/field';

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
  const root = create(fieldRoot);
  await root.session.mount();
  const control = create(fieldControl, { defaultValue: 'Text editor' }, root.target);
  await control.session.mount();
  return {
    root,
    control,
    async dispose() {
      await control.session.dispose();
      await root.session.dispose();
    },
  };
}

describe('Liquid Field static editing-surface material (intent only)', () => {
  it('declares one static optical candidate and opaque fallback, without a button deformation', async () => {
    const f = await fixture();
    try {
      expect(f.control.frames.at(-1)?.material.slot).toEqual({
        version: 2,
        shape: { kind: 'rounded-rect', geometry: 'style' },
        source: { kind: 'in-app-backdrop' },
        fallback: { fill: 'style', foreground: 'style' },
      });
      expect(f.control.frames.at(-1)?.material.candidates).toEqual([{ intent: 'liquid-glass' }]);
      expect(f.control.frames.at(-1)?.style.tokens).toContain('bg-background');
      expect(f.control.frames.at(-1)?.style.tokens).toContain('text-foreground');
      f.root.set({ disabled: true, invalid: true, errors: ['Current error'] });
      expect(f.control.exposes.invalid.get()).toBe(true);
      expect(f.control.exposes.disabled.get()).toBe(true);
      expect(f.control.frames.at(-1)?.material.candidates).toEqual([{ intent: 'liquid-glass' }]);
      expect(f.control.frames.every((frame) => frame.material.candidates.length <= 1)).toBe(true);
      expect(f.root.feedback.exportMaterialFrame?.()).toEqual({ slot: null, candidates: [] });
    } finally {
      await f.dispose();
    }
  });
  it('keeps explicit opaque style and diagnostic when the visual sink is missing', async () => {
    const f = await fixture(false);
    try {
      expect(f.control.frames).toEqual([]);
      expect(f.control.feedback.materialDiagnostics?.()).toContain('material-host-unavailable');
      expect(f.control.styles.at(-1)?.tokens).toContain('bg-background');
      expect(f.control.feedback.exportMaterialFrame?.().candidates).toEqual([
        { intent: 'liquid-glass' },
      ]);
    } finally {
      await f.dispose();
    }
  });
  it('releases the detached surface, remounts a fresh epoch and cannot revive a disposed sink', async () => {
    const f = await fixture();
    const before = f.control.frames.at(-1)!.view;
    await f.control.session.unmount();
    expect(f.control.release).toHaveBeenCalledWith(before);
    await f.control.session.mount();
    expect(f.control.frames.at(-1)!.view).toBeGreaterThan(before);
    expect(f.control.frames.at(-1)?.material.candidates).toEqual([{ intent: 'liquid-glass' }]);
    await f.dispose();
    const count = f.control.frames.length;
    f.control.input('pointer.down');
    expect(f.control.frames).toHaveLength(count);
    expect(f.control.feedback.exportMaterialFrame?.()).toEqual({ slot: null, candidates: [] });
  });
});
