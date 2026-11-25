import { describe, expect, it } from 'vitest';
import type { Prototype } from '@proto.ui/core';
import { createRuntimeSession } from '@proto.ui/runtime';
import {
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_ROOT_TARGET_CAP,
} from '@proto.ui/module-anatomy';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import {
  EVENT_GLOBAL_INPUT_SCOPE_CAP,
  EVENT_GLOBAL_TARGET_CAP,
  EVENT_ROOT_TARGET_CAP,
} from '@proto.ui/module-event';
import { EXPOSES_RECORD_SINK_CAP } from '@proto.ui/module-expose-state';
import { EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
import {
  AS_TRIGGER_GET_PROTO_CAP,
  AS_TRIGGER_INSTANCE_CAP,
  AS_TRIGGER_PARENT_CAP,
} from '@proto.ui/module-as-trigger';
import {
  FOCUS_INSTANCE_TOKEN_CAP,
  FOCUS_PARENT_CAP,
  FOCUS_ROOT_TARGET_CAP,
} from '@proto.ui/module-focus';
import {
  RULE_META_GET_CAP,
  RULE_META_PREFERENCE_SOURCE_CAP,
  type PreferenceKey,
} from '@proto.ui/module-rule-meta';
import {
  PRESENCE_RUN_IN_CALLBACK_CAP,
  VISUAL_FEEDBACK_SINK_CAP,
  type VisualFeedbackFrame,
} from '@proto.ui/module-feedback';
import { dropdownRoot, dropdownTrigger, dropdownContent } from '../src/dropdown';

type Motion = 'no-preference' | 'reduce' | 'unknown' | undefined;
type Delay = { durationMs: number; task(): void; cancelled: boolean };

// These real Runtime frames establish phase/style/material ownership, not native
// CSS animation, source admission or GPU paint. The original browser matrix
// remains responsible for optical pixels, geometry, focus and portal ownership.
async function fixture(motion: Motion, contentProps: Record<string, unknown> = {}) {
  const parents = new Map<unknown, unknown>();
  const prototypes = new Map<unknown, Prototype<any, any>>();
  const subscribers = new Map<() => void, readonly PreferenceKey[]>();
  const sessions: ReturnType<typeof createRuntimeSession>[] = [];
  const globalTarget = new EventTarget();
  const inputScope = {};
  // The existing Web provider exposes both the sampled Transition key and the
  // subscribable preference key from the same current media fact.
  const getter = (key: string) =>
    key === 'reducedMotion' || key === 'preference.reducedMotion' ? motion : undefined;

  async function create(
    prototype: Prototype<any, any>,
    initial: Record<string, unknown> = {},
    parent: HTMLElement | null = null
  ) {
    const target = document.createElement('div');
    parents.set(target, parent);
    prototypes.set(target, prototype);
    let props = initial;
    let exposes: Record<string, any> = {};
    const frames: VisualFeedbackFrame[] = [];
    const events: string[] = [];
    const delays: Delay[] = [];
    let mounted = false;
    let terminal = false;
    let generation = 0;
    const session = createRuntimeSession(prototype, {
      prototypeName: prototype.name,
      getRawProps: () => props,
      schedule: (task) => task(),
      scheduleDelay(durationMs, task) {
        // Preserve the actual Runtime scheduler callback so negative controls
        // can deliver a cancelled callback without replacing the phase owner.
        const pending = { durationMs, task, cancelled: false };
        delays.push(pending);
        return {
          cancel() {
            pending.cancelled = true;
          },
        };
      },
      commit: (_children, signal) => signal?.done(),
      viewOperations: {
        capture() {
          if (!mounted || terminal) return null;
          const epoch = generation;
          return Object.freeze({
            isCurrent: () => mounted && !terminal && epoch === generation,
          });
        },
      },
      onLifecycleEvent(event) {
        if (event.type === 'mount.phase') {
          generation++;
          mounted = event.phase === 'mounted';
        } else if (event.type === 'instance.dispose.begin') {
          terminal = true;
          mounted = false;
          generation++;
        }
      },
      onRuntimeReady(wiring) {
        const parentOf = (token: unknown) => parents.get(token) ?? null;
        const prototypeOf = (token: unknown) => prototypes.get(token) ?? null;
        wiring.attach('anatomy', [
          [ANATOMY_INSTANCE_TOKEN_CAP, target],
          [ANATOMY_PARENT_CAP, parentOf],
          [ANATOMY_GET_PROTO_CAP, prototypeOf],
          [ANATOMY_ROOT_TARGET_CAP, (token: unknown) => token as HTMLElement],
        ]);
        wiring.attach('context', [
          [CONTEXT_INSTANCE_TOKEN_CAP, target],
          [CONTEXT_PARENT_CAP, parentOf],
        ]);
        wiring.attach('as-trigger', [
          [AS_TRIGGER_INSTANCE_CAP, target],
          [AS_TRIGGER_PARENT_CAP, parentOf],
          [AS_TRIGGER_GET_PROTO_CAP, prototypeOf],
        ]);
        wiring.attach('focus', [
          [FOCUS_INSTANCE_TOKEN_CAP, target],
          [FOCUS_PARENT_CAP, parentOf],
          [FOCUS_ROOT_TARGET_CAP, () => target],
        ]);
        wiring.attach('event', [
          [EVENT_ROOT_TARGET_CAP, () => target],
          [EVENT_GLOBAL_TARGET_CAP, () => globalTarget],
          [EVENT_GLOBAL_INPUT_SCOPE_CAP, () => inputScope],
        ]);
        wiring.attach('expose-state', [
          [
            EXPOSES_RECORD_SINK_CAP,
            (next: Record<string, any>) => {
              exposes = next;
            },
          ],
        ]);
        wiring.attach('expose-event', [
          [EXPOSE_EVENT_SINK_CAP, (name: string) => events.push(name)],
        ]);
        wiring.attach('rule-meta', [
          [RULE_META_GET_CAP, getter],
          [
            RULE_META_PREFERENCE_SOURCE_CAP,
            {
              getter,
              subscribe(keys: readonly PreferenceKey[], invalidate: () => void) {
                subscribers.set(invalidate, keys);
                return () => subscribers.delete(invalidate);
              },
            },
          ],
        ]);
        wiring.attach('feedback', [
          [
            PRESENCE_RUN_IN_CALLBACK_CAP,
            (callback: () => void) => session.invokeInCallbackScope(callback),
          ],
          [
            VISUAL_FEEDBACK_SINK_CAP,
            {
              commit: (frame: VisualFeedbackFrame) => frames.push(frame),
              release() {},
            },
          ],
        ]);
      },
    });
    sessions.push(session);
    await session.mount();
    return {
      target,
      session,
      frames,
      delays,
      events,
      get exposes() {
        return exposes;
      },
      frame() {
        const frame = frames.at(-1);
        if (!frame) throw new Error(`Missing visual frame for ${prototype.name}`);
        return frame;
      },
      set(next: Record<string, unknown>) {
        props = next;
        session.controller.applyRawProps(next);
      },
      pending() {
        const pending = delays.at(-1);
        if (!pending) throw new Error('Missing actual Transition completion callback');
        return pending;
      },
    };
  }

  const root = await create(dropdownRoot, { open: false });
  await create(dropdownTrigger, {}, root.target);
  const content = await create(dropdownContent, contentProps, root.target);
  return {
    root,
    content,
    open: (open: boolean) => root.set({ open }),
    preference(next: Motion) {
      motion = next;
      for (const [invalidate, keys] of [...subscribers])
        if (keys.includes('preference.reducedMotion')) invalidate();
    },
    async dispose() {
      for (const session of sessions.reverse()) await session.dispose();
    },
  };
}

const motionTokens = ['animate-in', 'fade-in-0', 'zoom-in-95', 'duration-150'];
const expectMotion = (frame: VisualFeedbackFrame, moving: boolean) => {
  for (const token of motionTokens) expect(frame.style.tokens.includes(token), token).toBe(moving);
};
const expectOpenMaterial = (frame: VisualFeedbackFrame) => {
  expect(frame.material.candidates).toEqual([{ intent: 'liquid-glass' }]);
  expect(frame.style.tokens).toContain('bg-secondary');
  expect(frame.style.tokens).toContain('text-secondary-foreground');
};

describe('Liquid Dropdown finite entry and material rest', () => {
  it.each([
    { label: 'default', props: {}, duration: 150 },
    { label: 'zero override', props: { enterDuration: 0 }, duration: 0 },
    { label: 'short override', props: { enterDuration: 25 }, duration: 25 },
    { label: 'long override', props: { enterDuration: 400 }, duration: 400 },
  ])('releases entry animation at entered with $label duration', async ({ props, duration }) => {
    const f = await fixture('no-preference', props);
    try {
      f.open(true);
      expect(f.content.exposes.transitionState.get()).toBe('entering');
      expectMotion(f.content.frame(), true);
      expectOpenMaterial(f.content.frame());
      expect(f.content.pending().durationMs).toBe(duration);
      f.content.pending().task();
      expect(f.content.exposes.transitionState.get()).toBe('entered');
      expect(f.content.exposes.open.get()).toBe(true);
      expectMotion(f.content.frame(), false);
      expectOpenMaterial(f.content.frame());
      expect(f.content.events.filter((name) => name === 'afterEnter')).toHaveLength(1);
    } finally {
      await f.dispose();
    }
  });

  it.each(['reduce', 'unknown', undefined] as const)(
    'keeps every entry frame static for motion preference %s',
    async (motion) => {
      const f = await fixture(motion);
      try {
        const start = f.content.frames.length;
        f.open(true);
        expectOpenMaterial(f.content.frame());
        expect(f.content.pending().durationMs).toBe(motion === 'reduce' ? 0 : 150);
        f.content.pending().task();
        expect(f.content.exposes.transitionState.get()).toBe('entered');
        for (const frame of f.content.frames.slice(start)) expectMotion(frame, false);
        expectOpenMaterial(f.content.frame());
      } finally {
        await f.dispose();
      }
    }
  );

  it('withdraws live motion without retiming the phase or replaying animation at rest', async () => {
    const f = await fixture('no-preference');
    try {
      f.open(true);
      const entry = f.content.pending();
      const delayCount = f.content.delays.length;
      expectMotion(f.content.frame(), true);
      f.preference('reduce');
      expectMotion(f.content.frame(), false);
      expectOpenMaterial(f.content.frame());
      expect(f.content.pending()).toBe(entry);
      expect(f.content.delays).toHaveLength(delayCount);
      f.preference('no-preference');
      expectMotion(f.content.frame(), true);
      entry.task();
      expect(f.content.exposes.transitionState.get()).toBe('entered');
      const rest = f.content.frames.length;
      f.preference('reduce');
      f.preference('no-preference');
      for (const frame of f.content.frames.slice(rest)) expectMotion(frame, false);
      expectMotion(f.content.frame(), false);
      expectOpenMaterial(f.content.frame());
      expect(f.content.delays).toHaveLength(delayCount);
    } finally {
      await f.dispose();
    }
  });

  it('keeps cancelled entry and leave callbacks from completing a reopened menu', async () => {
    const f = await fixture('no-preference');
    try {
      f.open(true);
      const oldEntry = f.content.pending();
      f.open(false);
      const oldLeave = f.content.pending();
      expect(oldEntry.cancelled).toBe(true);
      expect(oldLeave.durationMs).toBe(0);
      expectMotion(f.content.frame(), false);
      expect(f.content.frame().material.candidates).toEqual([]);
      f.open(true);
      const currentEntry = f.content.pending();
      expect(currentEntry).not.toBe(oldEntry);
      expect(oldLeave.cancelled).toBe(true);
      const events = [...f.content.events];
      oldEntry.task();
      oldLeave.task();
      expect(f.content.events).toEqual(events);
      expect(f.content.exposes.transitionState.get()).toBe('entering');
      expectMotion(f.content.frame(), true);
      expectOpenMaterial(f.content.frame());
      currentEntry.task();
      expect(f.content.exposes.transitionState.get()).toBe('entered');
      expectMotion(f.content.frame(), false);
      expectOpenMaterial(f.content.frame());
    } finally {
      await f.dispose();
    }
  });

  it('retires the old entry completion across unmount and remount', async () => {
    const f = await fixture('no-preference');
    try {
      f.open(true);
      const oldEntry = f.content.pending();
      await f.content.session.unmount();
      expect(oldEntry.cancelled).toBe(true);
      await f.content.session.mount();
      const currentEntry = f.content.pending();
      expect(currentEntry).not.toBe(oldEntry);
      expect(f.content.exposes.transitionState.get()).toBe('entering');
      oldEntry.task();
      expect(f.content.exposes.transitionState.get()).toBe('entering');
      expectMotion(f.content.frame(), true);
      currentEntry.task();
      expect(f.content.exposes.transitionState.get()).toBe('entered');
      expectMotion(f.content.frame(), false);
      expectOpenMaterial(f.content.frame());
    } finally {
      await f.dispose();
    }
  });
});
