import { describe, expect, it, vi } from 'vitest';
import type { Prototype } from '@proto.ui/core';
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
import { EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
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
import { VISUAL_FEEDBACK_SINK_CAP, type VisualFeedbackFrame } from '@proto.ui/module-feedback';
import button from '../src/button';
import toggle from '../src/toggle';
import { formRoot, formSubmit, formReset } from '../src/form';
import {
  accordionRoot,
  accordionItem,
  accordionHeading,
  accordionTrigger,
  accordionContent,
} from '../src/accordion';
import { collapsibleRoot, collapsibleTrigger, collapsibleContent } from '../src/collapsible';
import {
  selectRoot,
  selectTrigger,
  selectContent,
  selectSurface,
  selectViewport,
  selectItem,
  selectItemText,
} from '../src/select';
import { dropdownRoot, dropdownTrigger, dropdownContent } from '../src/dropdown';

const commands = [
  {
    name: 'Button',
    prototype: button,
    root: null,
    content: null,
  },
  {
    name: 'Toggle',
    prototype: toggle,
    root: null,
    content: null,
  },
  {
    name: 'Submit',
    prototype: formSubmit,
    root: formRoot,
    content: null,
  },
  {
    name: 'Reset',
    prototype: formReset,
    root: formRoot,
    content: null,
  },
  {
    name: 'Accordion',
    prototype: accordionTrigger,
    root: accordionRoot,
    content: accordionContent,
  },
  {
    name: 'Collapsible',
    prototype: collapsibleTrigger,
    root: collapsibleRoot,
    content: collapsibleContent,
  },
  {
    name: 'Select',
    prototype: selectTrigger,
    root: selectRoot,
    content: selectContent,
  },
  {
    name: 'Dropdown',
    prototype: dropdownTrigger,
    root: dropdownRoot,
    content: dropdownContent,
  },
] as const;
type Command = (typeof commands)[number];
const HOVER = ['shadow-md', 'ring-1', 'ring-inset', 'ring-border'];

async function fixture(
  command: Command,
  initial: Record<string, unknown> = {},
  rootInitial: Record<string, unknown> = {}
) {
  const parents = new Map<unknown, unknown>();
  const prototypes = new Map<unknown, Prototype<any, any>>();
  const global = new EventTarget();
  const sessions: ReturnType<typeof createRuntimeSession>[] = [];
  const create = async (
    prototype: Prototype<any, any>,
    initial: Record<string, unknown> = {},
    parent: HTMLElement | null = null
  ) => {
    const target = document.createElement('div');
    // A portable host supplies its observed native focus-visible fact. This
    // fixture does not claim happy-dom implements native focus or CSS optics.
    let nativeFocusVisible = false;
    const matches = target.matches.bind(target);
    vi.spyOn(target, 'matches').mockImplementation((selector) =>
      selector === ':focus-visible' ? nativeFocusVisible : matches(selector)
    );
    parents.set(target, parent);
    prototypes.set(target, prototype);
    let props = initial;
    let exposes: Record<string, any> = {};
    const frames: VisualFeedbackFrame[] = [];
    const events: Array<{ key: string; payload: unknown }> = [];
    const release = vi.fn();
    const session = createRuntimeSession(prototype, {
      prototypeName: prototype.name,
      getRawProps: () => props,
      schedule: (task) => task(),
      scheduleDelay(duration, task) {
        const id = setTimeout(task, duration);
        return { cancel: () => clearTimeout(id) };
      },
      commit: (_children, signal) => signal?.done(),
      onRuntimeReady(w) {
        const parentOf = (token: unknown) => parents.get(token) ?? null;
        const protoOf = (token: unknown) => prototypes.get(token) ?? null;
        w.attach('anatomy', [
          [ANATOMY_INSTANCE_TOKEN_CAP, target],
          [ANATOMY_PARENT_CAP, parentOf],
          [ANATOMY_GET_PROTO_CAP, protoOf],
          [ANATOMY_ROOT_TARGET_CAP, (token: unknown) => token as HTMLElement],
        ]);
        w.attach('context', [
          [CONTEXT_INSTANCE_TOKEN_CAP, target],
          [CONTEXT_PARENT_CAP, parentOf],
        ]);
        w.attach('as-trigger', [
          [AS_TRIGGER_INSTANCE_CAP, target],
          [AS_TRIGGER_PARENT_CAP, parentOf],
          [AS_TRIGGER_GET_PROTO_CAP, protoOf],
        ]);
        w.attach('focus', [
          [FOCUS_INSTANCE_TOKEN_CAP, target],
          [FOCUS_PARENT_CAP, parentOf],
          [FOCUS_ROOT_TARGET_CAP, () => target],
        ]);
        w.attach('event', [
          [EVENT_ROOT_TARGET_CAP, () => target],
          [EVENT_GLOBAL_TARGET_CAP, () => global],
        ]);
        w.attach('expose-state', [
          [
            EXPOSES_RECORD_SINK_CAP,
            (next: Record<string, any>) => {
              exposes = next;
            },
          ],
        ]);
        w.attach('expose-event', [
          [EXPOSE_EVENT_SINK_CAP, (key: string, payload: unknown) => events.push({ key, payload })],
        ]);
        w.attach('feedback', [
          [
            VISUAL_FEEDBACK_SINK_CAP,
            { commit: (frame: VisualFeedbackFrame) => frames.push(frame), release },
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
      events,
      release,
      state: () => exposes,
      frame: () => frames.at(-1)!,
      tokens: () => frames.at(-1)!.style.tokens,
      input: (type: string) => target.dispatchEvent(new CustomEvent(type)),
      focus(visible: boolean) {
        nativeFocusVisible = visible;
        target.dispatchEvent(new CustomEvent('host:focus'));
      },
      set(next: Record<string, unknown>) {
        props = next;
        session.controller.applyRawProps(next);
      },
    };
  };
  const root = command.root ? await create(command.root, rootInitial) : null;
  const item =
    command.name === 'Accordion' ? await create(accordionItem, { value: 'a' }, root!.target) : null;
  const heading = item ? await create(accordionHeading, {}, item.target) : null;
  const control = await create(command.prototype, initial, heading?.target ?? root?.target);
  if (command.content) {
    const content = await create(command.content, {}, item?.target ?? root!.target);
    if (command.name === 'Select') {
      const surface = await create(selectSurface, {}, content.target);
      const viewport = await create(selectViewport, {}, surface.target);
      const option = await create(selectItem, { value: 'one', textValue: 'One' }, viewport.target);
      await create(selectItemText, {}, option.target);
    }
  }
  return {
    root,
    control,
    global,
    disable: () =>
      command.name === 'Accordion'
        ? root!.set({ ...rootInitial, disabled: true })
        : control.set({ ...initial, disabled: true }),
    async dispose() {
      for (const session of sessions.reverse()) await session.dispose();
    },
  };
}

// Portable frames establish ownership and recipe behavior only, not optical paint.
describe('Liquid command interaction recipe over eight implemented Base owners', () => {
  it.each(commands)(
    '$name separates static hover, press and visible focus without changing fallback or persistent state',
    async (command) => {
      const f = await fixture(command);
      const c = f.control;
      try {
        const fill = c.tokens().filter((token) => /^(bg-|text-)/.test(token));
        const geometry = () =>
          c
            .tokens()
            .filter((token) =>
              /^(?:inline-flex$|flex$|shrink-|items-|justify-|gap-|rounded-|border$|border-[0-9]|p[xytrbl]?-|m[xytrbl]?-|w-|h-|size-|min-|max-|whitespace-|break-|wrap-|leading-|font-)/.test(
                token
              )
            );
        const initialGeometry = geometry();
        const persistent = () =>
          Object.fromEntries(
            ['active', 'expanded', 'open', 'placeholder']
              .filter((key) => c.state()[key])
              .map((key) => [key, c.state()[key].get()])
          );
        const before = persistent();
        expect(c.frame().material.candidates).toHaveLength(1);
        expect(c.frame().material.candidates[0]).toMatchObject({
          intent: 'liquid-glass',
          deformation: { kind: 'press', phase: 'rest', contact: 'pointer' },
        });
        c.input('pointer.enter');
        expect(c.state().hovered.get()).toBe(true);
        expect(c.state().pressed.get()).toBe(false);
        expect(c.tokens()).toEqual(expect.arrayContaining(HOVER));
        expect(c.tokens().filter((token) => /^(bg-|text-)/.test(token))).toEqual(fill);
        expect(geometry()).toEqual(initialGeometry);
        expect(persistent()).toEqual(before);
        c.input('pointer.down');
        expect(c.state().pressed.get()).toBe(true);
        expect(c.tokens()).toContain('shadow-xs');
        expect(geometry()).toEqual(initialGeometry);
        expect(c.tokens()).not.toContain('shadow-md');
        expect(c.tokens()).not.toContain('ring-1');
        expect(c.frame().material.candidates).toHaveLength(1);
        expect(c.frame().material.candidates[0]).toMatchObject({
          deformation: { phase: 'pressed' },
        });
        c.input('pointer.up');
        expect(c.tokens()).toEqual(expect.arrayContaining(HOVER));
        f.global.dispatchEvent(new CustomEvent('key.down'));
        c.focus(true);
        expect(c.state().focusVisible.get()).toBe(true);
        expect(c.tokens()).toEqual(
          expect.arrayContaining(['ring-2', 'ring-ring', 'forced-colors-focus-outline'])
        );
        expect(c.tokens()).not.toContain('ring-1');
        expect(c.tokens()).not.toContain('ring-border');
        expect(c.tokens()).not.toContain('shadow-md');
        c.input('pointer.down');
        expect(c.tokens()).toContain('ring-2');
        expect(c.tokens()).toContain('shadow-xs');
        expect(geometry()).toEqual(initialGeometry);
        expect(persistent()).toEqual(before);
        expect(c.events).toEqual([]);
        expect(c.frames.every((frame) => frame.material.candidates.length <= 1)).toBe(true);
      } finally {
        await f.dispose();
      }
    }
  );

  it.each(commands)(
    '$name retains opaque current-state fallback and a declared empty material slot when disabled',
    async (command) => {
      const f = await fixture(command, command.name === 'Toggle' ? { active: true } : {});
      const c = f.control;
      try {
        const fill = c.tokens().filter((token) => /^(bg-|text-)/.test(token));
        const geometry = () =>
          c
            .tokens()
            .filter((token) =>
              /^(?:inline-flex$|flex$|shrink-|items-|justify-|gap-|rounded-|border$|border-[0-9]|p[xytrbl]?-|m[xytrbl]?-|w-|h-|size-|min-|max-|whitespace-|break-|wrap-|leading-|font-)/.test(
                token
              )
            );
        const initialGeometry = geometry();
        c.input('pointer.enter');
        c.input('pointer.down');
        f.disable();
        expect(c.state().disabled.get()).toBe(true);
        expect(c.state().pressed.get()).toBe(false);
        expect(c.frame().material.slot).not.toBeNull();
        expect(c.frame().material.candidates).toEqual([]);
        expect(c.tokens()).toContain('shadow-none');
        expect(c.tokens()).not.toContain('opacity-50');
        expect(c.tokens()).not.toContain('shadow-md');
        expect(c.tokens()).not.toContain('shadow-xs');
        expect(c.tokens()).not.toContain('ring-1');
        expect(c.tokens().filter((token) => /^(bg-|text-)/.test(token))).toEqual(fill);
        expect(geometry()).toEqual(initialGeometry);
        c.input('pointer.enter');
        c.input('pointer.down');
        c.input('press.commit');
        expect(c.frame().material.candidates).toEqual([]);
        expect(c.events).toEqual([]);
        if (command.name === 'Toggle') expect(c.state().active.get()).toBe(true);
      } finally {
        await f.dispose();
      }
    }
  );

  it('Accordion collapseBlocked withdraws interaction paint/material while preserving focus and expansion', async () => {
    const f = await fixture(commands[4], {}, { openItems: ['a'], allowEmpty: false });
    const c = f.control;
    try {
      expect(c.state().disabled.get()).toBe(false);
      expect(c.state().collapseBlocked.get()).toBe(true);
      expect(c.state().expanded.get()).toBe(true);
      c.input('pointer.enter');
      c.input('pointer.down');
      expect(c.tokens()).not.toContain('shadow-md');
      expect(c.tokens()).not.toContain('shadow-xs');
      expect(c.tokens()).toContain('shadow-none');
      expect(c.tokens()).not.toContain('pointer-events-none');
      expect(c.frame().material.candidates).toEqual([]);
      f.global.dispatchEvent(new CustomEvent('key.down'));
      c.focus(true);
      expect(c.state().focused.get()).toBe(true);
      expect(c.tokens()).toContain('ring-2');
      c.input('press.commit');
      expect(c.state().expanded.get()).toBe(true);
      expect(f.root!.events).toEqual([]);
      f.root!.set({ openItems: ['a'], allowEmpty: true });
      expect(c.frame().material.candidates).toHaveLength(1);
    } finally {
      await f.dispose();
    }
  });

  it('Dropdown keeps a separate eligible focused-but-not-focus-visible elevation', async () => {
    const f = await fixture(commands[7]);
    const c = f.control;
    try {
      f.global.dispatchEvent(new CustomEvent('pointer.down'));
      c.focus(false);
      expect(c.state().focused.get()).toBe(true);
      expect(c.state().focusVisible.get()).toBe(false);
      expect(c.tokens()).toContain('shadow-md');
      expect(c.tokens()).not.toContain('ring-1');
      c.input('pointer.down');
      expect(c.tokens()).not.toContain('shadow-md');
      expect(c.tokens()).toContain('shadow-xs');
      c.set({ disabled: true });
      expect(c.tokens()).not.toContain('shadow-md');
    } finally {
      await f.dispose();
    }
  });

  it.each(commands.slice(0, 4))(
    '$name honors material opaque and restores auto on raw prop removal',
    async (command) => {
      const f = await fixture(command, { material: 'opaque' });
      try {
        expect(f.control.frame().material.candidates).toEqual([]);
        f.control.input('pointer.enter');
        expect(f.control.tokens()).toEqual(expect.arrayContaining(HOVER));
        f.control.set({});
        expect(f.control.frame().material.candidates).toHaveLength(1);
        if (command.name === 'Button') {
          f.control.set({ variant: 'prominent' });
          expect(f.control.frame().material.candidates).toEqual([
            {
              intent: 'liquid-glass',
              variant: 'regular',
              tint: 'style-fill',
              deformation: { kind: 'press', phase: 'rest', contact: 'pointer' },
            },
          ]);
          expect(f.control.tokens()).toContain('bg-primary');
          expect(f.control.tokens()).toContain('text-primary-foreground');
        }
      } finally {
        await f.dispose();
      }
    }
  );

  it.each(commands.slice(2, 4))(
    '$name inherits Form registration and requests exactly one Base-owned action',
    async (command) => {
      const f = await fixture(command);
      const event = command.name === 'Submit' ? 'submit' : 'reset';
      try {
        f.control.input('pointer.enter');
        f.control.input('pointer.down');
        f.control.input('pointer.up');
        expect(f.root!.events).toEqual([]);
        f.control.input('press.commit');
        expect(f.root!.events.filter((entry) => entry.key === event)).toHaveLength(1);
        f.root!.set({ disabled: true });
        expect(f.control.state().disabled.get()).toBe(true);
        expect(f.control.frame().material.candidates).toEqual([]);
        f.control.input('press.commit');
        expect(f.root!.events.filter((entry) => entry.key === event)).toHaveLength(1);
        f.root!.set({});
        expect(f.control.state().disabled.get()).toBe(false);
        expect(f.control.frame().material.candidates).toHaveLength(1);
        f.control.set({ disabled: true });
        f.control.input('press.commit');
        expect(f.root!.events.filter((entry) => entry.key === event)).toHaveLength(1);
        expect(f.control.tokens()).toContain('shadow-none');
        expect(f.control.tokens()).not.toContain('opacity-50');
        f.control.set({});
        f.control.input('press.commit');
        expect(f.root!.events.filter((entry) => entry.key === event)).toHaveLength(2);
      } finally {
        await f.dispose();
      }
    }
  );

  it.each([
    { disabled: false, blocked: false },
    { disabled: true, blocked: false },
    { disabled: false, blocked: true },
    { disabled: true, blocked: true },
  ])(
    'Accordion keeps quiet feedback for disabled $disabled and collapse-blocked $blocked',
    async ({ disabled, blocked }) => {
      const f = await fixture(
        commands[4],
        {},
        {
          disabled,
          openItems: blocked ? ['a'] : [],
          allowEmpty: !blocked,
        }
      );
      try {
        expect(f.control.state().disabled.get()).toBe(disabled);
        expect(f.control.state().collapseBlocked.get()).toBe(blocked);
        for (const token of ['shadow-none', 'cursor-not-allowed'])
          expect(f.control.tokens().includes(token)).toBe(disabled || blocked);
        expect(f.control.frame().material.candidates).toHaveLength(disabled || blocked ? 0 : 1);
      } finally {
        await f.dispose();
      }
    }
  );
});
