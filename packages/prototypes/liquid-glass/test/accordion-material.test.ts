import { describe, expect, it, vi } from 'vitest';
import type { Prototype, StyleHandle } from '@proto.ui/core';
import { createRuntimeSession } from '@proto.ui/runtime';
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
import {
  EFFECTS_CAP,
  MATERIAL_PAINT_RESERVATION_CAP,
  VISUAL_FEEDBACK_SINK_CAP,
  type VisualFeedbackFrame,
  type FeedbackPort,
} from '@proto.ui/module-feedback';
import {
  accordionRoot,
  accordionItem,
  accordionHeading,
  accordionTrigger,
  accordionContent,
} from '../src/accordion';

async function fixture(withSink = true, triggerProps: Record<string, unknown> = {}) {
  const partStyles: StyleHandle[][] = Array.from({ length: 5 }, () => []);
  const frames: VisualFeedbackFrame[] = [],
    styles: StyleHandle[] = [],
    release = vi.fn();
  const prototypes = [
    accordionRoot,
    accordionItem,
    accordionHeading,
    accordionTrigger,
    accordionContent,
  ];
  const targets = prototypes.map(() => document.createElement('div'));
  let nativeFocusVisible = false;
  const matches = targets[3].matches.bind(targets[3]);
  const focusMatch = vi
    .spyOn(targets[3], 'matches')
    .mockImplementation((selector) =>
      selector === ':focus-visible' ? nativeFocusVisible : matches(selector)
    );
  const parentIndexes = [-1, 0, 1, 2, 1],
    raw: Record<string, unknown>[] = [{}, { value: 'a' }, {}, triggerProps, {}];
  const parent = (token: unknown) => {
    const i = targets.indexOf(token as HTMLDivElement);
    return i >= 0 ? (targets[parentIndexes[i]] ?? null) : null;
  };
  const exposes: Record<string, any>[] = [];
  const sessions = prototypes.map((prototype, index) =>
    createRuntimeSession(prototype as Prototype<any>, {
      prototypeName: prototype.name,
      getRawProps: () => raw[index],
      schedule: (task) => task(),
      scheduleDelay(duration, task) {
        const id = setTimeout(task, duration);
        return { cancel: () => clearTimeout(id) };
      },
      commit: (_children, signal) => signal?.done(),
      onRuntimeReady(wiring) {
        wiring.attach('anatomy', [
          [ANATOMY_INSTANCE_TOKEN_CAP, targets[index]],
          [ANATOMY_PARENT_CAP, parent],
          [
            ANATOMY_GET_PROTO_CAP,
            (token: unknown) => prototypes[targets.indexOf(token as HTMLDivElement)] ?? null,
          ],
          [ANATOMY_ROOT_TARGET_CAP, (token: unknown) => token as HTMLElement],
        ]);
        wiring.attach('context', [
          [CONTEXT_INSTANCE_TOKEN_CAP, targets[index]],
          [CONTEXT_PARENT_CAP, parent],
        ]);
        wiring.attach('as-trigger', [
          [AS_TRIGGER_INSTANCE_CAP, targets[index]],
          [AS_TRIGGER_PARENT_CAP, parent],
          [
            AS_TRIGGER_GET_PROTO_CAP,
            (token: unknown) => prototypes[targets.indexOf(token as HTMLDivElement)] ?? null,
          ],
        ]);
        wiring.attach('focus', [
          [FOCUS_INSTANCE_TOKEN_CAP, targets[index]],
          [FOCUS_PARENT_CAP, parent],
          [FOCUS_ROOT_TARGET_CAP, () => targets[index]],
        ]);
        wiring.attach('event', [
          [EVENT_ROOT_TARGET_CAP, () => targets[index]],
          [EVENT_GLOBAL_TARGET_CAP, () => document],
        ]);
        wiring.attach('expose-state', [
          [
            EXPOSES_RECORD_SINK_CAP,
            (next: Record<string, any>) => {
              exposes[index] = next;
            },
          ],
        ]);
        wiring.attach('feedback', [
          [MATERIAL_PAINT_RESERVATION_CAP, true],
          [
            EFFECTS_CAP,
            {
              queueStyle: (style: StyleHandle) => {
                partStyles[index].push(style);
                if (index === 3) styles.push(style);
              },
              requestFlush() {},
            },
          ],
        ]);
        if (index === 3) {
          if (withSink)
            wiring.attach('feedback', [
              [
                VISUAL_FEEDBACK_SINK_CAP,
                { commit: (frame: VisualFeedbackFrame) => frames.push(frame), release },
              ],
            ]);
        }
      },
    })
  );
  for (const session of sessions) await session.mount();
  const port = sessions[3].caps.getPort<FeedbackPort>('feedback')!;
  return {
    frames,
    styles,
    partStyles,
    release,
    port,
    sessions,
    exposes,
    target: targets[3],
    focus() {
      nativeFocusVisible = true;
      targets[3].dispatchEvent(new CustomEvent('host:focus'));
    },
    blur() {
      nativeFocusVisible = false;
      targets[3].dispatchEvent(new CustomEvent('host:blur'));
    },
    setRoot(next: Record<string, unknown>) {
      raw[0] = next;
      sessions[0].controller.applyRawProps(next);
    },
    async dispose() {
      for (const session of [...sessions].reverse()) await session.dispose();
      focusMatch.mockRestore();
    },
  };
}
describe('Accordion explicit material consumer, without native paint claims', () => {
  it.each(['regular', 'prominent'])(
    '%s expanded feedback preserves its own ring until the independent visible focus takes ownership',
    async (prominence) => {
      const f = await fixture(true, { prominence });
      try {
        f.setRoot({ openItems: ['a'], allowEmpty: false });
        expect(f.exposes[3].expanded.get()).toBe(true);
        expect(f.exposes[3].collapseBlocked.get()).toBe(true);
        const expanded = [...f.frames.at(-1)!.style.tokens];
        const persistentColor = prominence === 'prominent' ? 'ring-border' : 'ring-foreground/10';
        expect(expanded).toEqual(
          expect.arrayContaining(['font-semibold', 'ring-1', 'ring-inset', persistentColor])
        );
        for (const event of ['pointer.enter', 'pointer.down', 'pointer.up', 'pointer.leave']) {
          f.target.dispatchEvent(new CustomEvent(event));
          expect(f.frames.at(-1)!.style.tokens).toEqual(expanded);
          expect(f.frames.at(-1)?.material.candidates).toEqual([]);
        }
        document.dispatchEvent(new CustomEvent('key.down'));
        f.focus();
        expect(f.exposes[3].focusVisible.get()).toBe(true);
        expect(f.frames.at(-1)!.style.tokens).toEqual(
          expect.arrayContaining([
            'font-semibold',
            'ring-2',
            'ring-ring',
            'forced-colors-focus-outline',
          ])
        );
        for (const token of ['ring-1', 'ring-inset', persistentColor])
          expect(f.frames.at(-1)!.style.tokens).not.toContain(token);
        f.blur();
        expect(f.exposes[3].focusVisible.get()).toBe(false);
        expect(f.frames.at(-1)!.style.tokens).toEqual(expanded);
        expect(f.exposes[3].expanded.get()).toBe(true);
        expect(f.frames.at(-1)?.material.candidates).toEqual([]);
      } finally {
        await f.dispose();
      }
    }
  );
  it('keeps Item transparent while Trigger and Content retain their own fallback paint', async () => {
    const f = await fixture(false);
    try {
      expect(f.partStyles[1].at(-1)?.tokens).toContain('bg-transparent');
      expect(f.partStyles[1].at(-1)?.tokens).not.toContain('bg-background');
      expect(f.partStyles[3].at(-1)?.tokens).toContain('bg-background');
      expect(f.partStyles[4].at(-1)?.tokens).toContain('bg-background');
      expect(f.partStyles[4].at(-1)?.tokens).toContain('rounded-2xl');
      expect(
        f.sessions[1].caps.getPort<FeedbackPort>('feedback')?.exportMaterialFrame?.().candidates
      ).toEqual([]);
    } finally {
      await f.dispose();
    }
  });
  it('declares a shared slot and submits one explicit optical candidate through rest, press, release and disabled', async () => {
    const f = await fixture();
    try {
      expect(f.frames.at(-1)?.material.slot).toEqual({
        version: 2,
        paintReservation: 'required',
        shape: { kind: 'rounded-rect', geometry: 'style' },
        source: { kind: 'in-app-backdrop' },
        fallback: { fill: 'style', foreground: 'style' },
      });
      const candidate = (phase: string) => [
        { intent: 'liquid-glass', deformation: { kind: 'press', phase, contact: 'pointer' } },
      ];
      expect(f.frames.at(-1)?.material.candidates).toEqual(candidate('rest'));
      f.target.dispatchEvent(new Event('pointer.down'));
      expect(f.exposes[3].pressed.get()).toBe(true);
      expect(f.frames.at(-1)?.material.candidates).toEqual(candidate('pressed'));
      f.target.dispatchEvent(new Event('pointer.up'));
      expect(f.frames.at(-1)?.material.candidates).toEqual(candidate('rest'));
      f.target.dispatchEvent(new Event('pointer.down'));
      f.setRoot({ disabled: true });
      expect(f.exposes[3].pressed.get()).toBe(false);
      expect(f.frames.at(-1)?.material.candidates).toEqual([]);
      f.target.dispatchEvent(new Event('pointer.down'));
      expect(f.frames.at(-1)?.material.candidates).toEqual([]);
      expect(f.frames.every((frame) => frame.material.candidates.length <= 1)).toBe(true);
      expect(
        f.frames.every((frame) =>
          frame.material.candidates.every((candidate) => candidate.intent === 'liquid-glass')
        )
      ).toBe(true);
      expect(f.frames.at(-1)?.style.tokens).toContain('bg-background');
      expect(f.frames.at(-1)?.style.tokens).toContain('text-start');
      expect(f.frames.at(-1)?.style.tokens).toContain('text-foreground');
    } finally {
      await f.dispose();
    }
  });
  it('retains the declared opaque fallback and diagnoses absence rather than pretending native blur is optical glass', async () => {
    const f = await fixture(false);
    try {
      expect(f.frames).toEqual([]);
      expect(f.port.materialDiagnostics?.()).toContain('material-host-unavailable');
      expect(f.styles.at(-1)?.tokens).toContain('bg-background');
      expect(f.styles.at(-1)?.tokens).toContain('text-start');
      expect(f.styles.at(-1)?.tokens).toContain('text-foreground');
      expect(f.port.exportMaterialFrame?.().candidates).toEqual([
        {
          intent: 'liquid-glass',
          deformation: { kind: 'press', phase: 'rest', contact: 'pointer' },
        },
      ]);
    } finally {
      await f.dispose();
    }
  });
  it('releases a detached view and replays a new epoch without retaining pressed material or reviving disposed sinks', async () => {
    const f = await fixture();
    try {
      f.target.dispatchEvent(new Event('pointer.down'));
      const first = f.frames.at(-1)!.view;
      await f.sessions[3].unmount();
      expect(f.release).toHaveBeenCalledWith(first);
      const count = f.frames.length;
      await f.sessions[3].mount();
      expect(f.frames.length).toBeGreaterThan(count);
      expect(f.frames.at(-1)!.view).toBeGreaterThan(first);
      expect(f.frames.at(-1)?.material.candidates).toEqual([
        {
          intent: 'liquid-glass',
          deformation: { kind: 'press', phase: 'rest', contact: 'pointer' },
        },
      ]);
    } finally {
      await f.dispose();
    }
    const count = f.frames.length;
    f.target.dispatchEvent(new Event('pointer.down'));
    expect(f.frames).toHaveLength(count);
    expect(f.port.exportMaterialFrame?.()).toEqual({ slot: null, candidates: [] });
  });
});
