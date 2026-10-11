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
import { formRoot, formSubmit, formReset } from '../../liquid-glass/src/form';

async function fixture(sink = true, action = formSubmit) {
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
  const root = create(formRoot);
  await root.session.mount();
  const control = create(action, {}, root.target);
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

describe('Liquid Form action material intent and opaque fallback', () => {
  it.each([formSubmit, formReset])(
    'gates material and press deformation for $name without adding a Button owner',
    async (action) => {
      const f = await fixture(true, action);
      try {
        expect(f.control.frames.at(-1)?.material.slot?.fallback).toEqual({
          fill: 'style',
          foreground: 'style',
        });
        expect(f.control.frames.at(-1)?.material.candidates).toEqual([
          {
            intent: 'liquid-glass',
            variant: 'regular',
            deformation: { kind: 'press', phase: 'rest', contact: 'pointer' },
          },
        ]);
        f.control.input('pointer.down');
        expect(f.control.frames.at(-1)?.material.candidates[0]).toMatchObject({
          deformation: { phase: 'pressed' },
        });
        f.control.input('pointer.cancel');
        expect(f.control.frames.at(-1)?.material.candidates[0]).toMatchObject({
          deformation: { phase: 'rest' },
        });
        f.root.set({ disabled: true });
        expect(f.control.frames.at(-1)?.material.candidates).toEqual([]);
        expect(f.control.frames.at(-1)?.style.tokens).toContain('opacity-50');
        f.root.set({ disabled: false });
        f.control.set({ material: 'opaque' });
        expect(f.control.frames.at(-1)?.material.candidates).toEqual([]);
        expect(f.control.frames.at(-1)?.style.tokens).toContain(
          action === formSubmit ? 'bg-primary' : 'bg-secondary'
        );
        f.control.set({});
        expect(f.control.frames.at(-1)?.material.candidates).toHaveLength(1);
        expect(f.control.frames.every((frame) => frame.material.candidates.length <= 1)).toBe(true);
      } finally {
        await f.dispose();
      }
    }
  );
  it('retains complete opaque fill without an optical sink', async () => {
    const f = await fixture(false);
    try {
      expect(f.control.styles.at(-1)?.tokens).toContain('bg-primary');
      expect(f.control.styles.at(-1)?.tokens).toContain('text-primary-foreground');
    } finally {
      await f.dispose();
    }
  });
});
