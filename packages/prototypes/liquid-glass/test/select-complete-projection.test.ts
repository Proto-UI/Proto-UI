import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { Prototype, StyleHandle, TemplateChildren } from '@proto.ui/core';
import { createRuntimeSession, type RuntimeSession } from '@proto.ui/runtime';
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
  type AnatomyPort,
} from '@proto.ui/module-anatomy';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import { EVENT_ROOT_TARGET_CAP, EVENT_GLOBAL_TARGET_CAP } from '@proto.ui/module-event';
import { EXPOSES_RECORD_SINK_CAP } from '@proto.ui/module-expose-state';
import { EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
import { A11Y_PROJECT_CAP, createWebA11yProjectionRegistry } from '@proto.ui/module-a11y';
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
import { fieldRoot, fieldLabel, fieldDescription, fieldError } from '../src/field';
import fieldSelectTrigger from '../src/field/select-trigger.proto';
import { SELECT_FAMILY } from '@proto.ui/prototypes-base/select';
import {
  selectRoot,
  selectTrigger,
  selectValue,
  selectContent,
  selectItem,
  selectSurface,
  selectViewport,
  selectItemText,
  selectGroup,
  selectLabel,
  selectSeparator,
} from '../src/select';

const MATERIAL_SLOT = {
  version: 2,
  shape: { kind: 'rounded-rect', geometry: 'style' },
  source: { kind: 'in-app-backdrop' },
  fallback: { fill: 'style', foreground: 'style' },
};
const GLASS = { intent: 'liquid-glass' };
const pressCandidate = (phase: 'rest' | 'pressed') => ({
  intent: 'liquid-glass',
  deformation: { kind: 'press', phase, contact: 'pointer' },
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

interface MountedPart {
  target: HTMLElement;
  session: RuntimeSession;
  frames: VisualFeedbackFrame[];
  styles: StyleHandle[];
  commits: TemplateChildren[];
  events: { key: string; payload: unknown }[];
  release: Mock;
  readonly exposes: Record<string, any>;
  readonly feedback: FeedbackPort;
  set(next: Record<string, unknown>): void;
  input(type: string): void;
  mount(): Promise<void>;
  dispose(): Promise<void>;
}

interface SelectFixture {
  create(
    prototype: Prototype<any, any>,
    initial?: Record<string, unknown>,
    parent?: object | null
  ): MountedPart;
  disposeAll(): Promise<void>;
}

function factory(): SelectFixture {
  const parents = new Map<unknown, unknown | null>();
  const prototypes = new Map<unknown, Prototype<any, any>>();
  const globalTarget = document.createElement('div');
  const a11yRegistry = createWebA11yProjectionRegistry();
  const created: MountedPart[] = [];
  function create(
    prototype: Prototype<any, any>,
    initial: Record<string, unknown> = {},
    parent: object | null = null
  ): MountedPart {
    const target = document.createElement('div');
    parents.set(target, parent);
    prototypes.set(target, prototype);
    if (parent instanceof HTMLElement) parent.append(target);
    else document.body.append(target);
    let props = initial;
    let exposes: Record<string, any> = {};
    const frames: VisualFeedbackFrame[] = [];
    const styles: StyleHandle[] = [];
    const commits: TemplateChildren[] = [];
    const events: { key: string; payload: unknown }[] = [];
    const release = vi.fn();
    const session = createRuntimeSession(prototype, {
      prototypeName: prototype.name,
      getRawProps: () => props,
      schedule: (fn) => fn(),
      // Fake timers retain the Runtime's cancellable macrotask boundary.
      scheduleDelay(duration, task) {
        const id = setTimeout(task, duration);
        return { cancel: () => clearTimeout(id) };
      },
      commit: (children, signal) => {
        commits.push(children);
        signal?.done();
      },
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
        wiring.attach('expose-event', [
          [EXPOSE_EVENT_SINK_CAP, (key: string, payload: unknown) => events.push({ key, payload })],
        ]);
        wiring.attach('a11y', [[A11Y_PROJECT_CAP, a11yRegistry.createProjector(() => target)]]);
        wiring.attach('feedback', [
          [
            EFFECTS_CAP,
            { queueStyle: (style: StyleHandle) => styles.push(style), requestFlush() {} },
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
    const part: MountedPart = {
      target,
      session,
      frames,
      styles,
      commits,
      events,
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
      async mount() {
        await session.mount();
      },
      async dispose() {
        await session.dispose();
        target.remove();
        parents.delete(target);
        prototypes.delete(target);
        const index = created.indexOf(part);
        if (index !== -1) created.splice(index, 1);
      },
    };
    created.push(part);
    return part;
  }
  async function disposeAll() {
    for (const part of [...created].reverse()) await part.dispose();
    created.length = 0;
  }
  return { create, disposeAll };
}

async function mountAligned(
  f: SelectFixture,
  rootProps: Record<string, unknown>,
  contentProps: Record<string, unknown> = {}
) {
  const root = f.create(selectRoot, rootProps);
  await root.mount();
  const trigger = f.create(selectTrigger, {}, root.target);
  const value = f.create(selectValue, {}, trigger.target);
  const content = f.create(selectContent, contentProps, root.target);
  const surface = f.create(selectSurface, {}, content.target);
  const viewport = f.create(selectViewport, {}, surface.target);
  const items: MountedPart[] = [];
  const texts: MountedPart[] = [];
  for (const v of ['v0', 'v1', 'v2', 'v3', 'v4']) {
    const item = f.create(selectItem, { value: v, textValue: `Option ${v}` }, viewport.target);
    const text = f.create(selectItemText, {}, item.target);
    items.push(item);
    texts.push(text);
  }
  await trigger.mount();
  await value.mount();
  await content.mount();
  await surface.mount();
  await viewport.mount();
  for (const item of items) await item.mount();
  for (const text of texts) await text.mount();
  return { root, trigger, value, content, surface, viewport, items, texts };
}

describe('Liquid Select complete structural composition (intent only)', () => {
  it('keeps popup paint on the single Surface owner and complete candidate withdrawal follows committed open', async () => {
    const f = factory();
    try {
      const c = await mountAligned(f, {
        defaultOpen: true,
        value: 'v1',
      });
      expect(c.surface.frames.at(-1)?.material.slot).toEqual(MATERIAL_SLOT);
      expect(c.surface.frames.at(-1)?.material.candidates).toEqual([GLASS]);
      expect(c.surface.styles.at(-1)?.tokens).toEqual(
        expect.arrayContaining(['bg-secondary', 'rounded-2xl', 'shadow-md'])
      );
      // The portal frame is not an inactive material owner with a competing fallback.
      expect(c.content.feedback.exportMaterialFrame?.()).toEqual({ slot: null, candidates: [] });
      expect(c.content.styles.at(-1)?.tokens ?? []).not.toContain('bg-secondary');
      expect(c.content.styles.at(-1)?.tokens).toEqual(
        expect.arrayContaining(['flex', 'flex-col', 'outline-none'])
      );
      expect(c.viewport.styles.at(-1)?.tokens).toEqual(
        expect.arrayContaining(['min-h-0', 'overflow-y-auto', 'p-2'])
      );
      const anatomy = c.content.session.caps.getPort<AnatomyPort>('anatomy')!;
      const surfacePart = anatomy.parts(SELECT_FAMILY).find((part) => part.role === 'surface')!;
      const viewportPart = anatomy.descendantsOf(SELECT_FAMILY, surfacePart, 'viewport')[0]!;
      expect(viewportPart).toBeDefined();
      expect(anatomy.descendantsOf(SELECT_FAMILY, viewportPart, 'item')).toHaveLength(5);
      for (const row of anatomy.descendantsOf(SELECT_FAMILY, viewportPart, 'item'))
        expect(anatomy.descendantsOf(SELECT_FAMILY, row, 'item-text')).toHaveLength(1);
      // Controlled value refusal retains the canonical value and structure.
      c.items[2].input('press.commit');
      expect(c.root.exposes.value.get()).toBe('v1');
      expect(c.items[1].exposes.selected.get()).toBe(true);
      expect(c.items[2].exposes.selected.get()).toBe(false);
      expect(c.root.events).toContainEqual({
        key: 'valueChange',
        payload: { value: 'v2', textValue: 'Option v2', reason: 'pointer' },
      });
      expect(c.root.exposes.open.get()).toBe(false);
      c.root.exposes.openDropdown('test');
      c.root.set({ defaultOpen: true, value: 'v2' });
      expect(c.root.exposes.value.get()).toBe('v2');
      expect(c.items[2].exposes.selected.get()).toBe(true);
      expect(c.value.exposes.displayValue.get()).toBe('Option v2');
      // Close withdraws the Surface candidate; the frame never regains paint.
      c.root.exposes.close('test');
      expect(c.root.exposes.open.get()).toBe(false);
      expect(c.surface.frames.at(-1)?.material.candidates).toEqual([]);
      expect(c.surface.frames.at(-1)?.material.slot).toEqual(MATERIAL_SLOT);
      expect(c.content.feedback.exportMaterialFrame?.()).toEqual({ slot: null, candidates: [] });
      c.root.exposes.openDropdown('test');
      expect(c.root.exposes.open.get()).toBe(true);
      expect(c.surface.frames.at(-1)?.material.candidates).toEqual([GLASS]);
      expect(c.content.feedback.exportMaterialFrame?.()).toEqual({ slot: null, candidates: [] });
      // Structural parts commit slot-preserving views without semantics owners.
      expect(c.surface.commits.at(-1)).toMatchObject({ type: { kind: 'slot' } });
      expect(c.viewport.commits.at(-1)).toMatchObject({ type: { kind: 'slot' } });
      expect(c.texts[0].commits.at(-1)).toMatchObject({ type: { kind: 'slot' } });
    } finally {
      await f.disposeAll();
    }
  });

  it('keeps Group/Label/Separator passive, hidden contentless separation and scoped names off glass', async () => {
    const f = factory();
    try {
      const root = f.create(selectRoot, { defaultOpen: true, defaultValue: 'v0' });
      await root.mount();
      const trigger = f.create(selectTrigger, {}, root.target);
      const value = f.create(selectValue, {}, trigger.target);
      const content = f.create(selectContent, {}, root.target);
      const surface = f.create(selectSurface, {}, content.target);
      const viewport = f.create(selectViewport, {}, surface.target);
      const group = f.create(selectGroup, {}, viewport.target);
      const label = f.create(selectLabel, {}, group.target);
      label.target.textContent = 'First group';
      const item = f.create(selectItem, { value: 'v0' }, group.target);
      const text = f.create(selectItemText, {}, item.target);
      const separator = f.create(selectSeparator, {}, viewport.target);
      const otherGroup = f.create(selectGroup, {}, viewport.target);
      const otherLabel = f.create(selectLabel, {}, otherGroup.target);
      otherLabel.target.textContent = 'Second group';
      const otherItem = f.create(selectItem, { value: 'v1' }, otherGroup.target);
      const otherText = f.create(selectItemText, {}, otherItem.target);
      const ungrouped = f.create(selectItem, { value: 'v2' }, viewport.target);
      const ungroupedText = f.create(selectItemText, {}, ungrouped.target);
      for (const part of [
        trigger,
        value,
        content,
        surface,
        viewport,
        group,
        label,
        item,
        text,
        separator,
        otherGroup,
        otherLabel,
        otherItem,
        otherText,
        ungrouped,
        ungroupedText,
      ])
        await part.mount();
      // Passive parts retain slot identity; Separator commits an empty view.
      expect(group.commits.at(-1)).toMatchObject({ type: { kind: 'slot' } });
      expect(label.commits.at(-1)).toMatchObject({ type: { kind: 'slot' } });
      expect(separator.commits.at(-1) ?? []).toEqual([]);
      expect(separator.target.getAttribute('aria-hidden')).toBe('true');
      expect(separator.target.getAttribute('role')).toBeNull();
      expect(group.target.getAttribute('role')).toBe('group');
      expect(label.target.id).not.toBe('');
      expect(otherLabel.target.id).not.toBe(label.target.id);
      expect(group.target.getAttribute('aria-labelledby')).toBe(label.target.id);
      expect(otherGroup.target.getAttribute('aria-labelledby')).toBe(otherLabel.target.id);
      expect(
        root.exposes.getCollectionItems().map((entry: { value: string }) => entry.value)
      ).toEqual(['v0', 'v1', 'v2']);
      // Semantic-only parts never acquire material slots or candidates.
      for (const part of [group, label, separator, viewport, text])
        expect(part.feedback.exportMaterialFrame?.()).toEqual({ slot: null, candidates: [] });
      expect(separator.styles.at(-1)?.tokens).toEqual(
        expect.arrayContaining(['mx-2', 'my-1', 'h-px', 'bg-border'])
      );
      expect(label.styles.at(-1)?.tokens).toEqual(
        expect.arrayContaining(['px-3', 'py-1', 'text-xs', 'text-muted-foreground'])
      );
      await label.dispose();
      expect(group.target.hasAttribute('aria-labelledby')).toBe(false);
      expect(otherGroup.target.getAttribute('aria-labelledby')).toBe(otherLabel.target.id);
      // Grouping did not disturb selection: an ungrouped item commits normally.
      ungrouped.input('press.commit');
      expect(root.exposes.open.get()).toBe(false);
      expect(root.exposes.value.get()).toBe('v2');
    } finally {
      await f.disposeAll();
    }
  });

  it('releases the detached Surface view and replays only the current complete candidate after remount', async () => {
    const f = factory();
    let surface: MountedPart | undefined;
    try {
      const c = await mountAligned(f, { defaultOpen: true, defaultValue: 'v0' });
      surface = c.surface;
      const oldView = c.surface.frames.at(-1)!.view;
      await c.surface.session.unmount();
      expect(c.surface.release).toHaveBeenCalledWith(oldView);
      const before = c.surface.frames.length;
      c.root.exposes.close('test');
      expect(c.surface.frames).toHaveLength(before);
      expect(c.surface.feedback.exportMaterialFrame?.().candidates).toEqual([]);
      await c.surface.session.mount();
      expect(c.surface.frames.at(-1)!.view).toBeGreaterThan(oldView);
      expect(c.surface.frames.at(-1)?.material.candidates).toEqual([]);
      c.root.exposes.openDropdown('test');
      expect(c.surface.frames.at(-1)?.material.candidates).toEqual([GLASS]);
      expect(c.surface.frames.every((frame) => frame.material.candidates.length <= 1)).toBe(true);
      expect(c.content.feedback.exportMaterialFrame?.()).toEqual({ slot: null, candidates: [] });
    } finally {
      await f.disposeAll();
    }
    expect(surface?.feedback.exportMaterialFrame?.()).toEqual({ slot: null, candidates: [] });
  });
});

describe('Liquid Field Select Trigger (intent only)', () => {
  it('associates the canonical Field binding, invalid state and trigger material without a second owner', async () => {
    const f = factory();
    try {
      const field = f.create(fieldRoot);
      await field.mount();
      const label = f.create(fieldLabel, {}, field.target);
      const description = f.create(fieldDescription, {}, field.target);
      const error = f.create(fieldError, {}, field.target);
      label.target.textContent = 'Choice';
      description.target.textContent = 'Choose carefully';
      await label.mount();
      await description.mount();
      await error.mount();
      const root = f.create(selectRoot, { defaultValue: 'v0' }, field.target);
      await root.mount();
      const trigger = f.create(fieldSelectTrigger, {}, root.target);
      const value = f.create(selectValue, {}, trigger.target);
      await trigger.mount();
      await value.mount();
      expect(trigger.frames.at(-1)?.material.slot).toEqual(MATERIAL_SLOT);
      expect(trigger.frames.at(-1)?.material.candidates).toEqual([pressCandidate('rest')]);
      expect(trigger.exposes.invalid.get()).toBe(false);
      expect(trigger.exposes.placeholder.get()).toBe(false);
      field.set({ invalid: true, errors: ['Required'] });
      expect(trigger.exposes.invalid.get()).toBe(true);
      expect(trigger.target.getAttribute('aria-invalid')).toBe('true');
      expect(label.target.id).not.toBe('');
      expect(description.target.id).not.toBe('');
      expect(error.target.id).not.toBe('');
      expect(trigger.target.getAttribute('aria-labelledby')).toBe(label.target.id);
      expect(trigger.target.getAttribute('aria-describedby')).toBe(description.target.id);
      expect(trigger.target.getAttribute('aria-errormessage')).toBe(error.target.id);
      expect(trigger.styles.at(-1)?.tokens).toEqual(
        expect.arrayContaining(['border-2', 'border-foreground'])
      );
      // The ordinary family chevron+slot render is retained on the Field projection.
      const committed = trigger.commits.at(-1) as { type: unknown }[];
      expect(committed).toHaveLength(2);
      expect(committed[0]?.type).toEqual({ kind: 'slot' });
      // Disabled through Field suppresses the press candidates.
      field.set({ invalid: true, errors: ['Required'], disabled: true });
      expect(trigger.exposes.disabled.get()).toBe(true);
      expect(trigger.frames.at(-1)?.material.candidates).toEqual([]);
      field.set({ invalid: false });
      expect(trigger.exposes.invalid.get()).toBe(false);
      expect(trigger.target.hasAttribute('aria-errormessage')).toBe(false);
      expect(trigger.frames.at(-1)?.material.candidates).toEqual([pressCandidate('rest')]);
      expect(root.exposes.value.get()).toBe('v0');
    } finally {
      await f.disposeAll();
    }
  });

  it('keeps standalone behavior and selection ownership when no Field provider exists', async () => {
    const f = factory();
    try {
      const root = f.create(selectRoot, { defaultValue: 'v1' });
      await root.mount();
      const trigger = f.create(fieldSelectTrigger, {}, root.target);
      await trigger.mount();
      expect(trigger.exposes.invalid.get()).toBe(false);
      expect(trigger.exposes.placeholder.get()).toBe(false);
      for (const relation of ['aria-labelledby', 'aria-describedby', 'aria-errormessage'])
        expect(trigger.target.hasAttribute(relation)).toBe(false);
      expect(trigger.frames.at(-1)?.material.candidates).toEqual([pressCandidate('rest')]);
      trigger.input('pointer.down');
      expect(trigger.frames.at(-1)?.material.candidates).toEqual([pressCandidate('pressed')]);
    } finally {
      await f.disposeAll();
    }
  });
});
