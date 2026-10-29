import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Prototype, StyleHandle } from '@proto.ui/core';
import { createRuntimeSession, type RuntimeSession } from '@proto.ui/runtime';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
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
  EFFECTS_CAP,
  VISUAL_FEEDBACK_SINK_CAP,
  type FeedbackPort,
  type VisualFeedbackFrame,
} from '@proto.ui/module-feedback';
import { resolveMaterialStyle, colorContrast } from '../../../adapters/base/src/material/style';
import { activationTurn } from '../../../modules/native-link/test/no-network';
import { THEME } from '../src/theme';
import * as alertDialog from '../src/alert-dialog';
import * as popover from '../src/popover';
import * as drawer from '../src/drawer';
import * as toast from '../src/toast';
import * as autocomplete from '../src/autocomplete';
import * as combobox from '../src/combobox';
import * as command from '../src/command';
import * as contextMenu from '../src/context-menu';
import * as menubar from '../src/menubar';
import * as navigationMenu from '../src/navigation-menu';
import * as dropdown from '../src/dropdown';

// Real Runtime/module frames establish requested ownership and final opaque
// style provenance, not provider/source admission, optical paint or native parity.
interface Unit {
  target: HTMLElement;
  session: RuntimeSession<any>;
  frames: VisualFeedbackFrame[];
  released: unknown[];
  actions: Array<{ name: string; payload: unknown }>;
  readonly exposes: Record<string, any>;
  frame(): VisualFeedbackFrame;
  material(): VisualFeedbackFrame['material'];
  tokens(): string[];
  set(next: Record<string, unknown>): void;
  input(type: string): void;
}
function runtimeHarness() {
  const parents = new Map<unknown, unknown | null>();
  const prototypes = new Map<unknown, Prototype<any, any>>();
  const globalTarget = document.createElement('div');
  const inputScope = {};
  const cleanups: Array<() => Promise<void>> = [];
  function create(
    prototype: Prototype<any, any>,
    initial: Record<string, unknown> = {},
    parent: HTMLElement | null = null
  ): Unit {
    const target = document.createElement('div');
    parents.set(target, parent);
    prototypes.set(target, prototype);
    let props = initial;
    let exposes: Record<string, any> = {};
    const frames: VisualFeedbackFrame[] = [];
    const styles: StyleHandle[] = [];
    const released: unknown[] = [];
    const actions: Array<{ name: string; payload: unknown }> = [];
    const session = createRuntimeSession(prototype, {
      prototypeName: prototype.name,
      getRawProps: () => props,
      schedule: (task) => task(),
      scheduleDelay(duration, task) {
        // Forward the Runtime scheduler rather than waiting a guessed duration.
        // The timeout/pause assertions below drive this bridge with fake time.
        const timer = setTimeout(task, duration);
        return { cancel: () => clearTimeout(timer) };
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
          [EVENT_GLOBAL_INPUT_SCOPE_CAP, () => inputScope],
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
            (value: Record<string, any>) => {
              exposes = value;
            },
          ],
        ]);
        wiring.attach('expose-event', [
          [
            EXPOSE_EVENT_SINK_CAP,
            (name: string, payload: unknown) => {
              actions.push({ name, payload });
            },
          ],
        ]);
        wiring.attach('feedback', [
          [
            EFFECTS_CAP,
            { queueStyle: (style: StyleHandle) => styles.push(style), requestFlush() {} },
          ],
          [
            VISUAL_FEEDBACK_SINK_CAP,
            {
              commit(frame: VisualFeedbackFrame) {
                frames.push(frame);
              },
              release(view: unknown) {
                released.push(view);
              },
            },
          ],
        ]);
      },
    });
    cleanups.push(() => session.dispose());
    return {
      target,
      session,
      frames,
      released,
      actions,
      get exposes() {
        return exposes;
      },
      frame() {
        return frames.at(-1)!;
      },
      material() {
        return session.caps.getPort<FeedbackPort>('feedback')!.exportMaterialFrame!();
      },
      tokens() {
        return styles.at(-1)?.tokens ?? [];
      },
      set(next: Record<string, unknown>) {
        props = next;
        session.controller.applyRawProps(next);
      },
      input(type: string) {
        target.dispatchEvent(new CustomEvent(type));
      },
    };
  }
  return {
    create,
    async dispose() {
      for (const cleanup of cleanups.reverse()) await cleanup();
    },
  };
}

const candidate = { intent: 'liquid-glass' };
const slot = {
  version: 2,
  shape: { kind: 'rounded-rect', geometry: 'style' },
  source: { kind: 'in-app-backdrop' },
  fallback: { fill: 'style', foreground: 'style' },
};
function expectOpaqueFallback(unit: Unit) {
  expect(unit.tokens().some((token) => /^opacity-/.test(token))).toBe(false);
  for (const theme of ['light', 'dark'] as const) {
    const style = resolveMaterialStyle(unit.frame().style.tokens, THEME[theme]);
    expect(style.provenance).toBe('post-patch-complete');
    expect(style.competingPaint).toEqual([]);
    expect(style.fill?.[3]).toBe(1);
    expect(style.foreground?.[3]).toBe(1);
    expect(colorContrast(style.fill!, style.foreground!)).toBeGreaterThanOrEqual(4.5);
  }
}
function expectOrdinary(unit: Unit) {
  expect(unit.material()).toEqual({ slot: null, candidates: [] });
}
const flush = async () => {
  for (let turn = 0; turn < 20; turn++) await Promise.resolve();
};

const overlays = [
  {
    name: 'AlertDialog',
    root: alertDialog.alertDialogRoot,
    trigger: alertDialog.alertDialogTrigger,
    content: alertDialog.alertDialogContent,
    title: alertDialog.alertDialogTitle,
    description: alertDialog.alertDialogDescription,
    mask: alertDialog.alertDialogMask,
    close: alertDialog.alertDialogCancel,
    extra: alertDialog.alertDialogAction,
  },
  {
    name: 'Popover',
    root: popover.popoverRoot,
    trigger: popover.popoverTrigger,
    content: popover.popoverContent,
    title: popover.popoverTitle,
    description: popover.popoverDescription,
    close: popover.popoverClose,
  },
  {
    name: 'Drawer',
    root: drawer.drawerRoot,
    trigger: drawer.drawerTrigger,
    content: drawer.drawerContent,
    title: drawer.drawerTitle,
    description: drawer.drawerDescription,
    mask: drawer.drawerMask,
    close: drawer.drawerClose,
    extra: drawer.drawerHandle,
  },
];

describe.each(overlays)('Liquid $name functional popup ownership', (parts) => {
  it('retains one Content candidate through controlled refusal and owner updates', async () => {
    const h = runtimeHarness();
    const mount = async (prototype: Prototype<any, any>, parent: HTMLElement | null = null) => {
      const unit = h.create(prototype, {}, parent);
      await unit.session.mount();
      return unit;
    };
    try {
      const root = h.create(parts.root, { open: false });
      await root.session.mount();
      const trigger = await mount(parts.trigger, root.target);
      const mask = parts.mask ? await mount(parts.mask, root.target) : null;
      const content = await mount(parts.content, root.target);
      const title = await mount(parts.title, content.target);
      const description = await mount(parts.description, content.target);
      const close = await mount(parts.close, content.target);
      const extra = parts.extra ? await mount(parts.extra, content.target) : null;
      for (const unit of [root, trigger, title, description, close, mask, extra])
        if (unit) expectOrdinary(unit);
      expect(content.material()).toEqual({ slot, candidates: [] });
      root.set({ open: true });
      expect(root.exposes.open.get()).toBe(true);
      expect(content.exposes.open.get()).toBe(true);
      expect(content.material()).toEqual({ slot, candidates: [candidate] });
      expectOpaqueFallback(content);
      close.set({ disabled: true });
      close.input('press.commit');
      expect(close.exposes.disabled.get()).toBe(true);
      expect(root.actions.filter((event) => event.name === 'openChange')).toEqual([]);
      expectOpaqueFallback(close);
      close.set({});
      close.input('press.commit');
      expect(close.exposes.disabled.get()).toBe(false);
      expect(root.actions.filter((event) => event.name === 'openChange')).toEqual([
        { name: 'openChange', payload: expect.objectContaining({ open: false }) },
      ]);
      expect(root.exposes.open.get()).toBe(true);
      expect(content.material().candidates).toEqual([candidate]);
      root.set({ open: false });
      expect(content.material().candidates).toEqual([]);
      root.set({ open: true });
      expect(content.material().candidates).toEqual([candidate]);
      if (parts.name === 'AlertDialog' && extra) {
        extra.input('pointer.enter');
        expect(extra.tokens()).toContain('shadow-md');
        extra.input('pointer.down');
        expect(extra.tokens()).toContain('shadow-xs');
        extra.set({ disabled: true });
        extra.input('press.commit');
        expect(extra.tokens()).toContain('shadow-none');
        expect(extra.tokens()).not.toContain('shadow-md');
        expect(extra.tokens()).not.toContain('shadow-xs');
        expect(extra.actions.filter((event) => event.name === 'action')).toEqual([]);
        expectOpaqueFallback(extra);
        extra.set({});
        extra.input('press.commit');
        expect(extra.actions.filter((event) => event.name === 'action')).toEqual([
          { name: 'action', payload: { reason: 'action.press' } },
        ]);
        expect(root.exposes.open.get()).toBe(true);
        expect(content.material().candidates).toEqual([candidate]);
      }
      root.set({ open: false, disabled: true });
      expect(trigger.exposes.disabled.get()).toBe(true);
      trigger.input('press.commit');
      expect(root.exposes.open.get()).toBe(false);
      expectOpaqueFallback(trigger);
      const view = content.frame().view;
      await content.session.unmount();
      expect(content.released).toContain(view);
      await content.session.mount();
      expect(content.frame().view).not.toBe(view);
      expect(content.material().candidates).toEqual([]);
    } finally {
      await h.dispose();
    }
  });
});

it('Toast withdraws its sole surface candidate on timeout and retains Base pause/action ownership', async () => {
  vi.useFakeTimers();
  const h = runtimeHarness();
  try {
    const viewport = h.create(toast.toastViewport);
    await viewport.session.mount();
    const root = h.create(toast.toastRoot, { duration: 100 }, viewport.target);
    await root.session.mount();
    const title = h.create(toast.toastTitle, {}, root.target);
    const description = h.create(toast.toastDescription, {}, root.target);
    const action = h.create(toast.toastAction, {}, root.target);
    const close = h.create(toast.toastClose, {}, root.target);
    for (const unit of [title, description, action, close]) await unit.session.mount();
    for (const unit of [viewport, title, description, action, close]) expectOrdinary(unit);
    expect(root.material()).toEqual({ slot, candidates: [candidate] });
    expectOpaqueFallback(root);
    await vi.advanceTimersByTimeAsync(30);
    root.input('pointer.enter');
    expect(root.exposes.paused.get()).toBe(true);
    await vi.advanceTimersByTimeAsync(500);
    expect(root.exposes.open.get()).toBe(true);
    expect(root.material().candidates).toEqual([candidate]);
    root.input('pointer.leave');
    await vi.advanceTimersByTimeAsync(69);
    expect(root.exposes.open.get()).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(root.exposes.open.get()).toBe(false);
    expect(root.material().candidates).toEqual([]);
    root.set({ open: true, duration: 0 });
    action.set({ disabled: true });
    action.input('press.commit');
    expect(action.actions.filter((event) => event.name === 'action')).toEqual([]);
    expectOpaqueFallback(action);
    action.set({});
    action.input('press.commit');
    expect(action.actions.filter((event) => event.name === 'action')).toEqual([
      { name: 'action', payload: undefined },
    ]);
    expect(root.exposes.open.get()).toBe(true);
    expect(root.material().candidates).toEqual([candidate]);
    root.set({ open: false, duration: 0 });
    expect(root.material().candidates).toEqual([]);
    expectOpaqueFallback(root);
  } finally {
    await h.dispose();
    vi.useRealTimers();
  }
});

const menuBars = [
  {
    name: 'Menubar',
    root: menubar.menubarRoot,
    trigger: menubar.menubarTrigger,
    content: menubar.menubarContent,
    item: menubar.menubarItem,
  },
  {
    name: 'NavigationMenu',
    root: navigationMenu.navigationMenuRoot,
    trigger: navigationMenu.navigationMenuTrigger,
    content: navigationMenu.navigationMenuContent,
    item: navigationMenu.navigationMenuItem,
  },
];
describe.each(menuBars)('Liquid $name distinct popup identity', (parts) => {
  it('moves the candidate only with accepted owner value, not a refused command', async () => {
    const h = runtimeHarness();
    try {
      const root = h.create(parts.root, { value: 'file' });
      await root.session.mount();
      const triggers: Unit[] = [];
      const panels: Unit[] = [];
      const items: Unit[] = [];
      for (const value of ['file', 'edit']) {
        const trigger = h.create(parts.trigger, { value }, root.target);
        await trigger.session.mount();
        const panel = h.create(parts.content, { value }, root.target);
        await panel.session.mount();
        const item = h.create(parts.item, { value: value + '-action' }, panel.target);
        await item.session.mount();
        triggers.push(trigger);
        panels.push(panel);
        items.push(item);
      }
      for (const unit of [root, ...triggers, ...items]) expectOrdinary(unit);
      expect(panels.map((panel) => panel.material().candidates)).toEqual([[candidate], []]);
      for (const panel of panels) expectOpaqueFallback(panel);
      triggers[1].input('press.commit');
      expect(root.exposes.value.get()).toBe('file');
      expect(root.actions.filter((event) => event.name === 'valueChange')).toEqual([
        { name: 'valueChange', payload: expect.objectContaining({ value: 'edit' }) },
      ]);
      expect(panels.map((panel) => panel.material().candidates)).toEqual([[candidate], []]);
      root.set({ value: 'edit' });
      expect(panels.map((panel) => panel.material().candidates)).toEqual([[], [candidate]]);
      items[1].set({ value: 'edit-action', disabled: true });
      items[1].input('press.commit');
      expect(items[1].exposes.disabled.get()).toBe(true);
      expect(items[1].tokens()).not.toContain('opacity-50');
      expect(items[1].actions.filter((event) => event.name === 'select')).toEqual([]);
      items[1].set({ value: 'edit-action' });
      items[1].input('press.commit');
      expect(items[1].actions.filter((event) => event.name === 'select')).toEqual([
        { name: 'select', payload: { value: 'edit-action', menuValue: 'edit' } },
      ]);
      expect(root.exposes.value.get()).toBe('edit');
      root.set({ value: '' });
      expect(panels.map((panel) => panel.material().candidates)).toEqual([[], []]);
    } finally {
      await h.dispose();
    }
  });
});

it.each([
  {
    name: 'ContextMenu',
    root: contextMenu.contextMenuRoot,
    trigger: contextMenu.contextMenuTrigger,
    content: contextMenu.contextMenuContent,
    item: contextMenu.contextMenuItem,
  },
  {
    name: 'Dropdown',
    root: dropdown.dropdownRoot,
    trigger: dropdown.dropdownTrigger,
    content: dropdown.dropdownContent,
    item: dropdown.dropdownItem,
  },
])('$name keeps the popup fallback complete and disabled item activation inert', async (parts) => {
  const h = runtimeHarness();
  try {
    const root = h.create(parts.root, { open: true });
    await root.session.mount();
    const trigger = h.create(parts.trigger, {}, root.target);
    await trigger.session.mount();
    const content = h.create(parts.content, {}, root.target);
    await content.session.mount();
    const item = h.create(parts.item, { value: 'copy', disabled: true }, content.target);
    await item.session.mount();
    expectOrdinary(root);
    expectOrdinary(item);
    if (parts.name === 'Dropdown') {
      const group = h.create(dropdown.dropdownGroup, {}, content.target);
      await group.session.mount();
      const label = h.create(dropdown.dropdownLabel, {}, group.target);
      const separator = h.create(dropdown.dropdownSeparator, {}, content.target);
      const shortcut = h.create(dropdown.dropdownShortcut, {}, item.target);
      for (const unit of [label, separator, shortcut]) await unit.session.mount();
      for (const unit of [group, label, separator, shortcut]) expectOrdinary(unit);
    }
    expect(content.material()).toEqual({ slot, candidates: [candidate] });
    expectOpaqueFallback(content);
    item.input('pointer.enter');
    item.input('press.commit');
    expect(item.exposes.disabled.get()).toBe(true);
    expect(item.tokens()).not.toContain('opacity-50');
    expect(item.tokens()).not.toContain('bg-accent');
    expect(item.actions.filter((event) => event.name === 'select')).toEqual([]);
    expect(root.exposes.open.get()).toBe(true);
    root.set({ open: false });
    expect(content.material().candidates).toEqual([]);
    if (parts.name === 'ContextMenu') expectOrdinary(trigger);
    else {
      expect(trigger.material().candidates).toHaveLength(1);
      trigger.set({ disabled: true });
      expect(trigger.material().candidates).toEqual([]);
      expectOpaqueFallback(trigger);
    }
  } finally {
    await h.dispose();
  }
});

// These source consumers use the real Web Component Adapter and its actual
// TextControl/NativeLink projections. Happy DOM is not real-browser evidence.
type ProtoElement = HTMLElement & { getExposes(): Record<string, any> };
const owned = new Set<HTMLElement>();
const lives = { created: 0, disposed: 0 };
const searchFamilies = [
  {
    name: 'Autocomplete',
    inline: false,
    root: autocomplete.autocompleteRoot,
    input: autocomplete.autocompleteInput,
    content: autocomplete.autocompleteContent,
    item: autocomplete.autocompleteItem,
    empty: autocomplete.autocompleteEmpty,
  },
  {
    name: 'Combobox',
    inline: false,
    root: combobox.comboboxRoot,
    input: combobox.comboboxInput,
    content: combobox.comboboxContent,
    item: combobox.comboboxItem,
    empty: combobox.comboboxEmpty,
  },
  {
    name: 'Command',
    inline: true,
    root: command.commandRoot,
    input: command.commandInput,
    content: command.commandContent,
    item: command.commandItem,
    empty: command.commandEmpty,
  },
];
for (const parts of [autocomplete, combobox, command, contextMenu, navigationMenu, dropdown])
  for (const value of Object.values(parts))
    if (value && typeof value === 'object' && 'name' in value && 'setup' in value)
      AdaptToWebComponent(value as Prototype<any, any>, {
        diagnostics: {
          onLifecycleEvent(event) {
            if (event.type === 'instance.created') lives.created++;
            if (event.type === 'instance.dispose.done') lives.disposed++;
          },
        },
      });
function element(prototype: Prototype<any, any>, props: Record<string, unknown> = {}) {
  const node = document.createElement(prototype.name) as ProtoElement;
  setElementProps(node, props);
  owned.add(node);
  return node;
}
afterEach(async () => {
  for (const node of owned) node.remove();
  owned.clear();
  await expect.poll(() => lives.disposed).toBe(lives.created);
  vi.useRealTimers();
});
function searchFixture(
  parts: (typeof searchFamilies)[number],
  props: Record<string, unknown> = {}
) {
  const root = element(parts.root, props);
  const input = element(parts.input, { a11yLabel: 'Search commands', placeholder: 'Find' });
  const content = element(parts.content);
  const empty = element(parts.empty);
  empty.textContent = 'No matches';
  const choices = [
    ['apple', 'Apple'],
    ['pear', 'Pear'],
    ['disabled', 'Disabled'],
  ].map(([value, textValue]) => {
    const item = element(parts.item, { value, textValue, disabled: value === 'disabled' });
    const label = document.createElement('span');
    label.textContent = textValue;
    item.append(label);
    return { item, label };
  });
  content.append(...choices.map((choice) => choice.item), empty);
  root.append(input, content);
  document.body.append(root);
  return { root, input, content, empty, choices };
}
describe.each(searchFamilies)('Liquid $name single-editor source consumer', (parts) => {
  it('preserves actual editor, authored option content and composition/selection ownership', async () => {
    const f = searchFixture(parts);
    await flush();
    const editor = f.input.querySelector('input')!;
    expect(editor).toBeInstanceOf(HTMLInputElement);
    expect(f.input.querySelectorAll('input, textarea')).toHaveLength(1);
    expect(editor.placeholder).toBe('Find');
    expect(editor.getAttribute('role')).toBe('combobox');
    for (const { item, label } of f.choices) expect(item.contains(label)).toBe(true);
    const selected: unknown[] = [];
    f.root.addEventListener(parts.inline ? 'execute' : 'valueChange', (event) => {
      selected.push((event as CustomEvent).detail);
    });
    editor.focus();
    editor.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    editor.value = 'pe';
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, data: 'pe', isComposing: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(f.input.getExposes().composing.get()).toBe(true);
    expect(selected).toEqual([]);
    editor.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'pe' }));
    await flush();
    expect(f.root.getExposes().inputValue.get()).toBe('pe');
    expect(f.root.getExposes().visibleCount.get()).toBe(1);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await flush();
    expect(document.activeElement).toBe(editor);
    expect(editor.getAttribute('aria-activedescendant')).toBe(f.choices[1].item.id);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await flush();
    expect(selected).toEqual([
      expect.objectContaining({ value: parts.name === 'Autocomplete' ? 'Pear' : 'pear' }),
    ]);
    expect(f.root.getExposes().open.get()).toBe(parts.inline);
    expect(f.input.querySelector('input')).toBe(editor);
    expect(f.choices[1].item.contains(f.choices[1].label)).toBe(true);
  });

  it('retains controlled query refusal, empty state and readOnly/disabled policy', async () => {
    const f = searchFixture(parts, { inputValue: '', value: 'owner', open: true });
    await flush();
    const editor = f.input.querySelector('input')!;
    const proposals: unknown[] = [];
    f.root.addEventListener('inputValueChange', (event) =>
      proposals.push((event as CustomEvent).detail)
    );
    editor.value = 'Pear';
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, data: 'Pear' }));
    await flush();
    expect(proposals).toEqual([{ value: 'Pear', composing: false }]);
    expect(f.root.getExposes().inputValue.get()).toBe('');
    expect(editor.value).toBe('');
    setElementProps(f.root, { inputValue: 'absent', value: 'owner', open: true });
    await flush();
    expect(f.root.getExposes().visibleCount.get()).toBe(0);
    expect(f.empty.getExposes().visible.get()).toBe(true);
    setElementProps(f.root, { inputValue: 'Pear', value: 'owner', open: true, readOnly: true });
    await flush();
    expect(editor.readOnly).toBe(true);
    expect(f.root.getExposes().select('pear')).toBe(false);
    setElementProps(f.root, { inputValue: '', value: 'owner', open: true, disabled: true });
    await flush();
    expect(editor.disabled).toBe(true);
    expect(f.root.getExposes().select('disabled')).toBe(false);
    expect(f.root.getExposes().value.get()).toBe('owner');
  });
});

it('inline Command content has no material while retaining its visible listbox', async () => {
  const h = runtimeHarness();
  try {
    const root = h.create(command.commandRoot);
    await root.session.mount();
    const content = h.create(command.commandContent, {}, root.target);
    await content.session.mount();
    const empty = h.create(command.commandEmpty, {}, content.target);
    await empty.session.mount();
    expectOrdinary(root);
    expectOrdinary(content);
    expectOrdinary(empty);
    expect(root.exposes.open.get()).toBe(true);
    expect(content.exposes.open.get()).toBe(true);
    expect(empty.exposes.visible.get()).toBe(true);
    expectOpaqueFallback(content);
    root.session.invokeInCallbackScope(() => root.exposes.close());
    expect(content.exposes.open.get()).toBe(true);
    expectOrdinary(content);
  } finally {
    await h.dispose();
  }
});

it.each([
  {
    name: 'Autocomplete',
    root: autocomplete.autocompleteRoot,
    content: autocomplete.autocompleteContent,
    empty: autocomplete.autocompleteEmpty,
  },
  {
    name: 'Combobox',
    root: combobox.comboboxRoot,
    content: combobox.comboboxContent,
    empty: combobox.comboboxEmpty,
  },
])(
  '$name requests material only for its accepted open popup, not the empty label',
  async (parts) => {
    const h = runtimeHarness();
    try {
      const root = h.create(parts.root, { open: false });
      await root.session.mount();
      const content = h.create(parts.content, {}, root.target);
      await content.session.mount();
      const empty = h.create(parts.empty, {}, content.target);
      await empty.session.mount();
      expectOrdinary(root);
      expectOrdinary(empty);
      expect(content.material()).toEqual({ slot, candidates: [] });
      root.session.invokeInCallbackScope(() => root.exposes.openPopup());
      expect(root.actions.filter((event) => event.name === 'openChange')).toEqual([
        { name: 'openChange', payload: { open: true, reason: 'programmatic' } },
      ]);
      expect(root.exposes.open.get()).toBe(false);
      expect(content.material().candidates).toEqual([]);
      root.set({ open: true });
      expect(content.material()).toEqual({ slot, candidates: [candidate] });
      expectOpaqueFallback(content);
      expect(empty.exposes.visible.get()).toBe(true);
      root.set({ open: false });
      expect(content.material().candidates).toEqual([]);
    } finally {
      await h.dispose();
    }
  }
);

it('Dropdown group keeps caller content, live label withdrawal and passive shortcut ownership', async () => {
  const root = element(dropdown.dropdownRoot, { defaultOpen: true });
  const trigger = element(dropdown.dropdownTrigger);
  const content = element(dropdown.dropdownContent);
  const group = element(dropdown.dropdownGroup, { a11yLabel: 'Fallback account' });
  const label = element(dropdown.dropdownLabel);
  label.textContent = 'Account';
  const item = element(dropdown.dropdownItem, { value: 'profile', textValue: 'Profile' });
  const shortcut = element(dropdown.dropdownShortcut);
  shortcut.textContent = '⌘P';
  const separator = element(dropdown.dropdownSeparator);
  const caller = document.createElement('span');
  caller.textContent = 'Profile';
  item.append(caller, shortcut);
  group.append(label, item);
  content.append(group, separator);
  root.append(trigger, content);
  document.body.append(root);
  await flush();
  expect(group.getAttribute('aria-labelledby')).toBe(label.id);
  expect(item.contains(caller)).toBe(true);
  expect(separator.getAttribute('role')).toBe('separator');
  for (const part of [group, label, shortcut, separator])
    expect(part.hasAttribute('tabindex')).toBe(false);
  expect(root.getExposes().getCollectionCount()).toBe(1);
  const actions: unknown[] = [];
  item.addEventListener('select', (event) => actions.push((event as CustomEvent).detail));
  shortcut.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', metaKey: true, bubbles: true }));
  expect(actions).toEqual([]);
  label.remove();
  await flush();
  expect(group.hasAttribute('aria-labelledby')).toBe(false);
  expect(group.getAttribute('aria-label')).toBe('Fallback account');
  group.prepend(label);
  await flush();
  expect(group.getAttribute('aria-labelledby')).toBe(label.id);
  item.click();
  await flush();
  expect(actions).toEqual([{ value: 'profile', reason: 'pointer' }]);
  expect(root.getExposes().open.get()).toBe(false);
});

it('ContextMenu keeps context opening distinct from ordinary click and preserves its authored target', async () => {
  const root = element(contextMenu.contextMenuRoot);
  const trigger = element(contextMenu.contextMenuTrigger);
  const caller = document.createElement('span');
  caller.textContent = 'Open contextual actions';
  trigger.append(caller);
  const content = element(contextMenu.contextMenuContent);
  const item = element(contextMenu.contextMenuItem, { value: 'copy' });
  item.textContent = 'Copy';
  content.append(item);
  root.append(trigger, content);
  document.body.append(root);
  await flush();
  trigger.click();
  expect(root.getExposes().open.get()).toBe(false);
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  trigger.dispatchEvent(event);
  await flush();
  expect(event.defaultPrevented).toBe(true);
  expect(root.getExposes().open.get()).toBe(true);
  expect(trigger.contains(caller)).toBe(true);
  item.click();
  await flush();
  expect(root.getExposes().open.get()).toBe(false);
});

it('Navigation Link keeps one native anchor and its caller content, modified activation and disabled withdrawal', async () => {
  const root = element(navigationMenu.navigationMenuRoot, { defaultValue: 'guide' });
  const trigger = element(navigationMenu.navigationMenuTrigger, { value: 'guide' });
  const content = element(navigationMenu.navigationMenuContent, { value: 'guide' });
  const link = element(navigationMenu.navigationMenuLink, { href: '#guide', current: true });
  const caller = document.createElement('span');
  caller.textContent = 'Guide';
  link.append(caller);
  content.append(link);
  root.append(trigger, content);
  document.body.append(root);
  await flush();
  const anchor = link.querySelector('a')!;
  expect(link.querySelectorAll('a')).toHaveLength(1);
  expect(anchor.contains(caller)).toBe(true);
  expect(anchor.getAttribute('aria-current')).toBe('page');
  const navigations: unknown[] = [];
  link.addEventListener('navigate', (event) => navigations.push((event as CustomEvent).detail));
  const modified = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    button: 0,
    ctrlKey: true,
  });
  anchor.dispatchEvent(modified);
  // The production NativeLink host observes activation in a later platform
  // task, after native defaults. Use its existing no-network activation barrier;
  // fake time would not exercise that ordering against the Web Adapter.
  await activationTurn();
  await flush();
  expect(modified.defaultPrevented).toBe(false);
  expect(navigations).toEqual([{ href: '#guide', target: '_self', rel: '', modified: true }]);
  expect(root.getExposes().value.get()).toBe('guide');
  setElementProps(link, { href: '#new', disabled: true });
  await flush();
  const disabled = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
  anchor.dispatchEvent(disabled);
  expect(disabled.defaultPrevented).toBe(true);
  expect(anchor.hasAttribute('href')).toBe(false);
  expect(anchor.hasAttribute('aria-current')).toBe(false);
  expect(navigations).toHaveLength(1);
  setElementProps(link, { href: '#new' });
  await flush();
  expect(link.querySelector('a')).toBe(anchor);
  const ordinary = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
  anchor.dispatchEvent(ordinary);
  await activationTurn();
  await flush();
  expect(ordinary.defaultPrevented).toBe(false);
  expect(navigations.at(-1)).toEqual({ href: '#new', target: '_self', rel: '', modified: false });
  expect(root.getExposes().value.get()).toBe('');
});
