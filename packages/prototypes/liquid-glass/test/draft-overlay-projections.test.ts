import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { definePrototype, type Prototype } from '@proto.ui/core';
import { createRuntimeSession, type RuntimeSession } from '@proto.ui/runtime';
import {
  VISUAL_FEEDBACK_SINK_CAP,
  type VisualFeedbackFrame,
} from '@proto.ui/module-feedback';
import {
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_ROOT_TARGET_CAP,
} from '@proto.ui/module-anatomy';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import {
  EVENT_ROOT_TARGET_CAP,
  EVENT_GLOBAL_TARGET_CAP,
  EVENT_GLOBAL_INPUT_SCOPE_CAP,
} from '@proto.ui/module-event';
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
import { DRAWER_CONTEXT, DRAWER_FAMILY } from '@proto.ui/prototypes-base/drawer';
import {
  dialogRoot,
  dialogTrigger,
  dialogMask,
  dialogContent,
  dialogTitle,
  dialogDescription,
  dialogClose,
} from '../src/dialog';
import { hoverCardRoot, hoverCardTrigger, hoverCardContent } from '../src/hover-card';
import { tooltipGroup, tooltipRoot, tooltipTrigger, tooltipContent } from '../src/tooltip';
import {
  drawerRoot,
  drawerTrigger,
  drawerContent,
  drawerHeader,
  drawerFooter,
  drawerClose,
} from '../src/drawer';

/**
 * Real-runtime boundary checks for the first draft overlay batch. Every part
 * is exercised through the actual runtime modules (context, anatomy, event,
 * focus, overlay, presence, feedback) with no source-string or export-list
 * assertions. Optical material admission stays out of scope; complete
 * candidates and style provenance are checked at the exported frame level.
 */

interface SessionUnit {
  target: HTMLElement;
  session: RuntimeSession<any>;
  frames: VisualFeedbackFrame[];
  release: Mock;
  readonly exposes: Record<string, any>;
  frame(): VisualFeedbackFrame;
  set(next: Record<string, unknown>): void;
  input(type: string): void;
}

function createHarness() {
  const parents = new Map<unknown, unknown | null>();
  const prototypes = new Map<unknown, Prototype<any, any>>();
  const globalTarget = document.createElement('div');
  const globalInputScope = {};
  function create(
    prototype: Prototype<any, any>,
    initial: Record<string, unknown> = {},
    parent: object | null = null
  ): SessionUnit {
    const target = document.createElement('div');
    parents.set(target, parent);
    prototypes.set(target, prototype);
    let props = initial;
    let exposes: Record<string, any> = {};
    const frames: VisualFeedbackFrame[] = [];
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
          [EVENT_GLOBAL_INPUT_SCOPE_CAP, () => globalInputScope],
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
      release,
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
        session.controller.applyRawProps(props);
      },
      input(type: string) {
        target.dispatchEvent(new CustomEvent(type));
      },
    };
  }
  return { create, globalTarget };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function dialogFixture(initial: Record<string, unknown> = {}) {
  const h = createHarness();
  const root = h.create(dialogRoot, initial);
  await root.session.mount();
  const trigger = h.create(dialogTrigger, {}, root.target);
  await trigger.session.mount();
  const mask = h.create(dialogMask, {}, root.target);
  await mask.session.mount();
  const content = h.create(dialogContent, {}, root.target);
  await content.session.mount();
  const title = h.create(dialogTitle, {}, content.target);
  await title.session.mount();
  const description = h.create(dialogDescription, {}, content.target);
  await description.session.mount();
  const close = h.create(dialogClose, {}, content.target);
  await close.session.mount();
  return {
    ...h,
    root,
    trigger,
    mask,
    content,
    title,
    description,
    close,
    async dispose() {
      await close.session.dispose();
      await description.session.dispose();
      await title.session.dispose();
      await content.session.dispose();
      await mask.session.dispose();
      await trigger.session.dispose();
      await root.session.dispose();
    },
  };
}

async function hoverCardFixture(initial: Record<string, unknown> = {}) {
  const h = createHarness();
  const root = h.create(hoverCardRoot, initial);
  await root.session.mount();
  const trigger = h.create(hoverCardTrigger, {}, root.target);
  await trigger.session.mount();
  const content = h.create(hoverCardContent, {}, root.target);
  await content.session.mount();
  return {
    ...h,
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

async function disposeAll(units: SessionUnit[]) {
  for (const unit of [...units].reverse()) await unit.session.dispose();
}

afterEach(() => {
  vi.useRealTimers();
});

describe('liquid-glass dialog projection', () => {
  it('toggles through real Base open ownership with material only on open Content', async () => {
    const f = await dialogFixture();
    try {
      expect(f.root.exposes.open.get()).toBe(false);
      expect(f.content.exposes.open.get()).toBe(false);
      // Mask keeps an ordinary dimming layer; it never becomes a material owner.
      expect(f.mask.frame().material).toEqual({ slot: null, candidates: [] });
      expect(f.mask.frame().style.tokens).toEqual(
        expect.arrayContaining(['fixed', 'bg-black/50'])
      );
      expect(f.content.frame().material.slot).toEqual({
        version: 2,
        shape: { kind: 'rounded-rect', geometry: 'style' },
        source: { kind: 'in-app-backdrop' },
        fallback: { fill: 'style', foreground: 'style' },
      });
      expect(f.content.frame().material.candidates).toEqual([]);

      f.trigger.input('press.commit');
      await expect.poll(() => f.root.exposes.open.get()).toBe(true);
      await flush();
      expect(f.content.exposes.open.get()).toBe(true);
      expect(f.content.frame().material.candidates).toEqual([
        { intent: 'liquid-glass' },
      ]);
      expect(f.content.frame().style.tokens).toEqual(
        expect.arrayContaining(['fixed', 'rounded-2xl', 'bg-secondary'])
      );
      // Neutral label parts stay style-only with no expose authority.
      expect(f.title.exposes).toEqual({});
      expect(f.description.exposes).toEqual({});
      expect(f.title.frame().style.tokens).toEqual(expect.arrayContaining(['text-lg']));
      expect(f.description.frame().style.tokens).toEqual(
        expect.arrayContaining(['text-muted-foreground'])
      );
      expect(f.title.frame().material).toEqual({ slot: null, candidates: [] });

      f.close.input('press.commit');
      await expect.poll(() => f.root.exposes.open.get()).toBe(false);
      await flush();
      expect(f.content.exposes.open.get()).toBe(false);
      expect(f.content.frame().material.candidates).toEqual([]);
    } finally {
      await f.dispose();
    }
  });

  it('refuses to move a controlled open on trigger and close presses', async () => {
    const f = await dialogFixture({ open: true });
    try {
      await expect.poll(() => f.root.exposes.open.get()).toBe(true);
      f.trigger.input('press.commit');
      await flush();
      expect(f.root.exposes.open.get()).toBe(true);
      f.close.input('press.commit');
      await flush();
      expect(f.root.exposes.open.get()).toBe(true);
      // The retained complete candidate still describes the open surface.
      expect(f.content.frame().material.candidates).toEqual([
        { intent: 'liquid-glass' },
      ]);
    } finally {
      await f.dispose();
    }
  });

  it('keeps a disabled family closed and reports the exposed trigger state', async () => {
    const f = await dialogFixture({ disabled: true });
    try {
      for (const command of [f.trigger, f.close]) {
        expect(command.exposes.disabled.get()).toBe(true);
        expect(command.frame().style.tokens).toEqual(
          expect.arrayContaining([
            'bg-secondary',
            'text-secondary-foreground',
            'cursor-not-allowed',
            'shadow-none',
          ])
        );
        expect(command.frame().style.tokens).not.toContain('opacity-50');
      }
      f.trigger.input('press.commit');
      await flush();
      expect(f.root.exposes.open.get()).toBe(false);
      expect(f.content.frame().material.candidates).toEqual([]);
    } finally {
      await f.dispose();
    }
  });

  it('routes a real Escape through the overlay dismissal path', async () => {
    const f = await dialogFixture();
    try {
      f.trigger.input('press.commit');
      await expect.poll(() => f.content.exposes.transitionState?.get()).toBe('entered');
      f.globalTarget.dispatchEvent(new CustomEvent('key.down', { detail: { key: 'Escape' } }));
      await expect.poll(() => f.root.exposes.open.get()).toBe(false);
      await flush();
      expect(f.content.exposes.open.get()).toBe(false);
    } finally {
      await f.dispose();
    }
  });

  it('retains the Base alert description diagnostic without a description part', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const h = createHarness();
    const root = h.create(dialogRoot, { alert: true, open: true });
    await root.session.mount();
    const content = h.create(dialogContent, {}, root.target);
    await content.session.mount();
    await flush();
    try {
      expect(
        warn.mock.calls.filter((call) =>
          String(call[0]).includes('[base-dialog-content] Alert Dialog requires')
        )
      ).toHaveLength(1);
    } finally {
      await content.session.dispose();
      await root.session.dispose();
      warn.mockRestore();
    }
  });
});

describe('liquid-glass hover-card projection', () => {
  it('delays pointer open, bridges into content, and delays close', async () => {
    vi.useFakeTimers();
    const f = await hoverCardFixture({ openDelay: 100, closeDelay: 50 });
    try {
      f.trigger.input('pointer.enter');
      await vi.advanceTimersByTimeAsync(99);
      expect(f.root.exposes.open.get()).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(f.root.exposes.open.get()).toBe(true);
      expect(f.content.exposes.open.get()).toBe(true);
      expect(f.content.frame().material.candidates).toEqual([
        { intent: 'liquid-glass' },
      ]);

      // The trigger→content hover bridge holds the card open while the pointer
      // crosses; leaving content starts a fresh close deadline.
      f.trigger.input('pointer.leave');
      await vi.advanceTimersByTimeAsync(10);
      f.content.input('pointer.enter');
      await vi.advanceTimersByTimeAsync(200);
      expect(f.root.exposes.open.get()).toBe(true);
      f.content.input('pointer.leave');
      await vi.advanceTimersByTimeAsync(49);
      expect(f.root.exposes.open.get()).toBe(true);
      await vi.advanceTimersByTimeAsync(1);
      expect(f.root.exposes.open.get()).toBe(false);
      expect(f.content.frame().material.candidates).toEqual([]);
    } finally {
      await f.dispose();
    }
  });

  it('reverses a pending open and honors controlled and disabled roots', async () => {
    vi.useFakeTimers();
    const f = await hoverCardFixture({ openDelay: 100, closeDelay: 50 });
    try {
      f.trigger.input('pointer.enter');
      await vi.advanceTimersByTimeAsync(50);
      f.trigger.input('pointer.leave');
      await vi.advanceTimersByTimeAsync(100);
      expect(f.root.exposes.open.get()).toBe(false);
      expect(f.content.frame().material.candidates).toEqual([]);
    } finally {
      await f.dispose();
    }

    const controlled = await hoverCardFixture({ open: true, closeDelay: 40 });
    try {
      controlled.trigger.input('pointer.leave');
      await vi.advanceTimersByTimeAsync(200);
      expect(controlled.root.exposes.open.get()).toBe(true);
      expect(controlled.content.exposes.open.get()).toBe(true);
    } finally {
      await controlled.dispose();
    }

    const disabled = await hoverCardFixture({ disabled: true, openDelay: 10 });
    try {
      disabled.trigger.input('pointer.enter');
      await vi.advanceTimersByTimeAsync(50);
      expect(disabled.root.exposes.open.get()).toBe(false);
      expect(disabled.trigger.exposes.disabled.get()).toBe(true);
    } finally {
      await disabled.dispose();
    }
  });
});

describe('liquid-glass tooltip projection', () => {
  it('keeps Group semantic-only while Roots honor warm handoff within skip delay', async () => {
    vi.useFakeTimers();
    const h = createHarness();
    const group = h.create(tooltipGroup, { openDelay: 400, closeDelay: 50, skipDelay: 300 });
    await group.session.mount();
    const first = h.create(tooltipRoot, {}, group.target);
    await first.session.mount();
    const firstTrigger = h.create(tooltipTrigger, {}, first.target);
    await firstTrigger.session.mount();
    const firstContent = h.create(tooltipContent, {}, first.target);
    await firstContent.session.mount();
    const second = h.create(tooltipRoot, {}, group.target);
    await second.session.mount();
    const secondTrigger = h.create(tooltipTrigger, {}, second.target);
    await secondTrigger.session.mount();
    const secondContent = h.create(tooltipContent, {}, second.target);
    await secondContent.session.mount();
    try {
      // Semantic-only coordinator: no painted or material output on any frame.
      expect(
        group.frames.every(
          (frame) =>
            frame.style.tokens.length === 0 &&
            frame.material.slot === null &&
            frame.material.candidates.length === 0
        )
      ).toBe(true);
      expect(group.exposes).toEqual({});

      firstTrigger.input('pointer.enter');
      // Inherits the Group openDelay because Root did not provide its own.
      await vi.advanceTimersByTimeAsync(399);
      expect(first.exposes.open.get()).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(first.exposes.open.get()).toBe(true);
      expect(firstContent.exposes.open.get()).toBe(true);

      firstTrigger.input('pointer.leave');
      await vi.advanceTimersByTimeAsync(50);
      expect(first.exposes.open.get()).toBe(false);

      // Warm handoff: the sibling opens immediately instead of waiting 400ms.
      secondTrigger.input('pointer.enter');
      await vi.advanceTimersByTimeAsync(0);
      expect(second.exposes.open.get()).toBe(true);
      expect(secondContent.exposes.open.get()).toBe(true);

      // Tooltip Content is an ordinary opaque surface: real style, no slot.
      expect(secondContent.frame().material).toEqual({
        slot: null,
        candidates: [],
      });
      expect(secondContent.frame().style.tokens).toEqual(
        expect.arrayContaining(['bg-secondary', 'text-secondary-foreground', 'text-xs'])
      );
    } finally {
      await disposeAll([
        group,
        first,
        firstTrigger,
        firstContent,
        second,
        secondTrigger,
        secondContent,
      ]);
    }
  });

  it('honors controlled refusal after a delayed close request', async () => {
    vi.useFakeTimers();
    const h = createHarness();
    const root = h.create(tooltipRoot, { open: true, closeDelay: 40 });
    await root.session.mount();
    const trigger = h.create(tooltipTrigger, {}, root.target);
    await trigger.session.mount();
    const content = h.create(tooltipContent, {}, root.target);
    await content.session.mount();
    try {
      trigger.input('pointer.leave');
      await vi.advanceTimersByTimeAsync(100);
      expect(root.exposes.open.get()).toBe(true);
      // A controlled Root stays open while Content only mirrors the context.
      expect(content.exposes.open.get()).toBe(true);
    } finally {
      await disposeAll([root, trigger, content]);
    }
  });
});

describe('liquid-glass drawer structural parts', () => {
  it('Header and Footer join the anatomy family as passive slot containers', async () => {
    const facts: Record<string, any> = {};
    const probe = definePrototype({
      name: 'liquid-glass-drawer-structure-probe',
      setup(def) {
        def.context.subscribe(DRAWER_CONTEXT);
        def.lifecycle.onMounted((run) => {
          facts.rootId = run.context.read(DRAWER_CONTEXT).rootId;
          facts.headers = run.anatomy.partsOf(DRAWER_FAMILY, 'header');
          facts.footers = run.anatomy.partsOf(DRAWER_FAMILY, 'footer');
        });
        return (r) => r.r.slot();
      },
    });
    const h = createHarness();
    const root = h.create(drawerRoot, { defaultOpen: false });
    await root.session.mount();
    const trigger = h.create(drawerTrigger, {}, root.target);
    await trigger.session.mount();
    const content = h.create(drawerContent, {}, root.target);
    await content.session.mount();
    const header = h.create(drawerHeader, {}, content.target);
    await header.session.mount();
    const footer = h.create(drawerFooter, {}, content.target);
    await footer.session.mount();
    // Family containment only admits content→close; keep the close button a
    // direct content child while header/footer siblings are exercised.
    const close = h.create(drawerClose, {}, content.target);
    await close.session.mount();
    const observer = h.create(probe, {}, content.target);
    await observer.session.mount();
    try {
      expect(facts.headers).toHaveLength(1);
      expect(facts.footers).toHaveLength(1);
      // Passive slot presentation: family spacing plus the side-driven
      // vertical-drawer centering recipe, no input/expose/material.
      expect(header.frame().style.tokens).toEqual(
        expect.arrayContaining(['flex', 'flex-col', 'gap-0.5', 'p-4', 'text-center'])
      );
      expect(footer.frame().style.tokens).toEqual(
        expect.arrayContaining(['mt-[auto]', 'flex', 'flex-col', 'gap-2', 'p-4'])
      );
      expect(header.exposes).toEqual({});
      expect(footer.exposes).toEqual({});
      expect(header.frame().material).toEqual({ slot: null, candidates: [] });
      expect(footer.frame().material).toEqual({ slot: null, candidates: [] });

      // Existing drawer protocol stays intact with the new parts mounted.
      trigger.input('press.commit');
      await expect.poll(() => root.exposes.open.get()).toBe(true);
      close.input('press.commit');
      await expect.poll(() => root.exposes.open.get()).toBe(false);
    } finally {
      await disposeAll([root, trigger, content, header, footer, close, observer]);
    }
  });
});
