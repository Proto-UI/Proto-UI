import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  HOST_ELEMENT_CAP,
  type ExposedStateHandle,
  type FocusEntryConfig,
  type FocusRequestOptions,
  type Prototype,
} from '@proto.ui/core';
import { createRuntimeSession, type RuntimeHost, type RuntimeSession } from '@proto.ui/runtime';
import type { PropsBaseType } from '@proto.ui/types';
import { EXPOSES_RECORD_SINK_CAP } from '@proto.ui/module-expose-state';
import { EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
import { EVENT_GLOBAL_TARGET_CAP, EVENT_ROOT_TARGET_CAP } from '@proto.ui/module-event';
import {
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_ROOT_TARGET_CAP,
} from '@proto.ui/module-anatomy';
import {
  AS_TRIGGER_GET_GROUP_EVENT_TARGET_CAP,
  AS_TRIGGER_GET_PROTO_CAP,
  AS_TRIGGER_INSTANCE_CAP,
  AS_TRIGGER_PARENT_CAP,
} from '@proto.ui/module-as-trigger';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import { BOUNDARY_HOST_BRIDGE_CAP } from '@proto.ui/module-boundary';
import {
  FOCUS_INSTANCE_TOKEN_CAP,
  FOCUS_PARENT_CAP,
  FOCUS_REQUEST_FOCUS_CAP,
  FOCUS_RESOLVE_ENTRY_TARGET_CAP,
  FOCUS_ROOT_TARGET_CAP,
  FOCUS_RUN_IN_CALLBACK_CAP,
  FOCUS_TARGET_READY_CAP,
  type FocusRequestKind,
} from '@proto.ui/module-focus';
import * as base from '../../src/popover';
import * as shadcn from '../../../shadcn/src/popover';
import * as brutalist from '../../../brutalist/src/popover';
import * as bootstrap from '../../../bootstrap-2-3-2/src/popover';
import * as liquid from '../../../liquid-glass/src/popover';
import * as datePicker from '../../src/date-picker';
import type { PopoverRootProps } from '../../src/popover/types';

// P-BASE-POPOVER opening-entry/lifetime/handback and T-POPOVER-OPENING-ENTRY-0001.
// Real Runtime/Focus/WC effects in Happy DOM are source-host evidence, separate
// from browser scrolling, layout, native input and generated compiler profiles.
const families = [base, shadcn, brutalist, bootstrap, liquid];
const owned = new Set<HTMLElement>();
const lives = { created: 0, disposed: 0 };
for (const family of families)
  for (const proto of [
    family.popoverRoot,
    family.popoverTrigger,
    family.popoverContent,
    family.popoverTitle,
    family.popoverClose,
  ])
    AdaptToWebComponent(proto, {
      diagnostics: {
        onLifecycleEvent(event) {
          if (event.type === 'instance.created') lives.created++;
          if (event.type === 'instance.dispose.done') lives.disposed++;
        },
      },
    });
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
afterEach(async () => {
  for (const node of owned) node.remove();
  owned.clear();
  await expect.poll(() => lives.disposed).toBe(lives.created);
  vi.restoreAllMocks();
});
type Parts = Pick<
  typeof base,
  'popoverRoot' | 'popoverTrigger' | 'popoverContent' | 'popoverTitle' | 'popoverClose'
>;
type ContentElement = HTMLElement & {
  getExposes(): { open: ExposedStateHandle<boolean> };
};
type FocusElement = HTMLElement & {
  getExposes(): { focusSelf(options?: FocusRequestOptions): void };
};
function fixture(
  family: Parts = base,
  rootProps: Record<string, unknown> = {},
  initiallyAttach = true
) {
  function element(name: string, props: Record<string, unknown> = {}) {
    const node = document.createElement(name);
    setElementProps(node, props);
    owned.add(node);
    return node;
  }
  // These registered family elements share Base Content/Close public handles.
  const root = element(family.popoverRoot.name, rootProps),
    trigger = element(family.popoverTrigger.name),
    content = element(family.popoverContent.name, {
      enterDuration: 0,
      leaveDuration: 0,
    }) as ContentElement,
    title = element(family.popoverTitle.name),
    close = element(family.popoverClose.name) as FocusElement,
    link = element('a'),
    outside = element('button');
  title.textContent = 'Settings';
  close.textContent = 'Close';
  link.setAttribute('href', '#settings');
  link.textContent = 'Native settings link';
  trigger.textContent = 'Open';
  // Native order differs from logical priority: Close must still win while it
  // is an eligible logical member, including when its host focus is pending.
  content.append(title, link, close);
  root.append(trigger, content);
  // Spy before first mount, forwarding to the real HTMLElement focus effect.
  const focusObservations: Array<{ options: FocusOptions | undefined; alreadyActive: boolean }> =
    [];
  const nativeFocus = close.focus.bind(close);
  const closeFocus = vi.spyOn(close, 'focus').mockImplementation((options) => {
      focusObservations.push({ options, alreadyActive: document.activeElement === close });
      nativeFocus(options);
    }),
    triggerFocus = vi.spyOn(trigger, 'focus'),
    linkFocus = vi.spyOn(link, 'focus'),
    contentFocus = vi.spyOn(content, 'focus');
  const requests: unknown[] = [];
  root.addEventListener('openChange', (e) => requests.push((e as CustomEvent).detail));
  if (initiallyAttach) document.body.append(root, outside);
  return {
    root,
    trigger,
    content,
    close,
    link,
    outside,
    closeFocus,
    triggerFocus,
    linkFocus,
    contentFocus,
    requests,
    focusObservations,
  };
}
function expectEntry(p: ReturnType<typeof fixture>) {
  expect(p.closeFocus).toHaveBeenCalled();
  expect(p.focusObservations[0]).toEqual({
    options: { preventScroll: true },
    alreadyActive: false,
  });
  // Existing Focus readiness can re-project an already acquired owner with its
  // own native policy. Any actual acquisition in this opening window must be
  // scroll-preserving; undefined is allowed only while this same target is active.
  for (const call of p.focusObservations)
    if (!call.alreadyActive) expect(call.options).toEqual({ preventScroll: true });
  expect(document.activeElement).toBe(p.close);
  expect(p.linkFocus).not.toHaveBeenCalled();
  expect(p.contentFocus).not.toHaveBeenCalled();
  expect(p.trigger.getAttribute('aria-expanded')).toBe('true');
}
describe.each(families.map((family) => [family.popoverRoot.name, family] as const))(
  '%s opening entry policy',
  (_name, family) => {
    it('projects scroll-preserving focus on first open and reopen through the real host', async () => {
      const p = fixture(family);
      await flush();
      expect(p.closeFocus).not.toHaveBeenCalled();
      p.trigger.click();
      await flush();
      expectEntry(p);
      expect(p.requests).toEqual([{ open: true, reason: 'trigger.press', focusReason: 'pointer' }]);
      p.close.click();
      await flush();
      expect(p.trigger.getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(p.trigger);
      expect(p.triggerFocus).toHaveBeenCalledWith(undefined); // restoration policy stays unchanged
      p.closeFocus.mockClear();
      p.focusObservations.length = 0;
      p.trigger.click();
      await flush();
      expectEntry(p);
      expect(p.requests).toEqual([
        { open: true, reason: 'trigger.press', focusReason: 'pointer' },
        { open: false, reason: 'close.press', focusReason: 'pointer' },
        { open: true, reason: 'trigger.press', focusReason: 'pointer' },
      ]);
    });
    it('enters native-only descendants on open and keyboard reopen', async () => {
      const p = fixture(family, {}, false);
      p.close.remove();
      document.body.append(p.root, p.outside);
      await flush();
      p.trigger.click();
      await flush();
      expect(document.activeElement).toBe(p.link);
      expect(p.linkFocus.mock.calls[0]).toEqual([{ preventScroll: true }]);
      expect(p.contentFocus).not.toHaveBeenCalled();
      expect(p.closeFocus).not.toHaveBeenCalled();
      expect(p.content.getExposes()).not.toHaveProperty('focused');
      expect(p.content.getExposes()).not.toHaveProperty('focusVisible');
      expect(p.content.getExposes()).not.toHaveProperty('rovingSelected');
      p.content.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await flush();
      expect(document.activeElement).toBe(p.trigger);
      expect(p.trigger.getAttribute('aria-expanded')).toBe('false');
      p.linkFocus.mockClear();
      p.trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      p.trigger.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
      await flush();
      expect(document.activeElement).toBe(p.link);
      expect(p.linkFocus.mock.calls[0]).toEqual([{ preventScroll: true }]);
      expect(p.requests).toEqual([
        { open: true, reason: 'trigger.press', focusReason: 'pointer' },
        { open: false, reason: 'escape', focusReason: 'keyboard' },
        { open: true, reason: 'trigger.press', focusReason: 'keyboard' },
      ]);
    });
  }
);
it('uses empty self fallback once and leaves later native insertion for a new opening', async () => {
  const p = fixture(base, { open: true }, false);
  p.close.remove();
  p.link.remove();
  document.body.append(p.root, p.outside);
  await flush();
  expect(document.activeElement).toBe(p.content);
  expect(p.contentFocus.mock.calls[0]).toEqual([{ preventScroll: true }]);
  expect(p.content.getExposes()).not.toHaveProperty('focused');
  expect(p.content.getAttribute('tabindex')).toBe('0');
  p.contentFocus.mockClear();
  p.content.append(p.link);
  setElementProps(p.root, { open: true });
  await flush();
  expect(document.activeElement).toBe(p.content);
  expect(p.contentFocus).not.toHaveBeenCalled();
  expect(p.linkFocus).not.toHaveBeenCalled();
  setElementProps(p.root, { open: false });
  await flush();
  setElementProps(p.root, { open: true });
  await flush();
  expect(document.activeElement).toBe(p.link);
  expect(p.linkFocus.mock.calls[0]).toEqual([{ preventScroll: true }]);
});
it('applies the same entry option to default-open mounted acquisition', async () => {
  const p = fixture(base, { defaultOpen: true });
  await flush();
  expectEntry(p);
  expect(p.requests).toEqual([]);
});
it('does not focus on a refused controlled open and preserves later owner acceptance', async () => {
  const p = fixture(base, { open: false });
  await flush();
  p.trigger.click();
  await flush();
  expect(p.trigger.getAttribute('aria-expanded')).toBe('false');
  expect(p.closeFocus).not.toHaveBeenCalled();
  expect(p.requests).toEqual([{ open: true, reason: 'trigger.press', focusReason: 'pointer' }]);
  setElementProps(p.root, { open: true });
  await flush();
  expectEntry(p);
});
it('does not reacquire entry for unchanged accepted-open updates', async () => {
  const p = fixture(base, { open: true });
  await flush();
  expectEntry(p);
  p.closeFocus.mockClear();
  setElementProps(p.root, { open: true, a11yLabel: 'Updated settings' });
  await flush();
  expect(p.closeFocus).not.toHaveBeenCalled();
  expect(p.requests).toEqual([]);
});
it('does not rewrite explicit target focus options as a global default', async () => {
  const p = fixture(base, { defaultOpen: true });
  await flush();
  expectEntry(p);
  p.closeFocus.mockClear();
  p.close.getExposes().focusSelf({ reason: 'programmatic' });
  p.close.getExposes().focusSelf({ reason: 'programmatic', preventScroll: false });
  expect(p.closeFocus.mock.calls).toEqual([[undefined], [{ preventScroll: false }]]);
  expect(document.activeElement).toBe(p.close);
});
it('does not let an old close handback overwrite a synchronously accepted newer opening', async () => {
  const p = fixture(base, { open: true });
  await flush();
  expectEntry(p);
  p.triggerFocus.mockClear();
  let reopened = false;
  const unsubscribe = p.content.getExposes().open.subscribe((event) => {
    if (event.type !== 'next' || event.next || reopened) return;
    reopened = true;
    setElementProps(p.root, { open: true });
  });
  try {
    setElementProps(p.root, { open: false });
    await flush();
    expect(reopened).toBe(true);
    expect(p.content.getExposes().open.get()).toBe(true);
    expect(p.trigger.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(p.close);
    expect(p.triggerFocus).not.toHaveBeenCalled();
  } finally {
    unsubscribe();
  }
});

// The actual Base prototypes run against an explicit host readiness port. The
// host can reject acquisition or replace a retained physical view; successful
// requests still call HTMLElement.focus and report the real active element.
async function retainedFixture(logicalChild = false) {
  const rootToken = {},
    triggerToken = {},
    contentToken = {},
    closeToken = {};
  const parents = new Map<unknown, unknown>([
    [rootToken, null],
    [triggerToken, rootToken],
    [contentToken, rootToken],
    [closeToken, contentToken],
  ]);
  const getPrototype = (item: unknown) =>
    item === rootToken
      ? base.popoverRoot
      : item === triggerToken
        ? base.popoverTrigger
        : item === contentToken
          ? base.popoverContent
          : item === closeToken
            ? base.popoverClose
            : null;
  const rootView = document.createElement('div');
  const triggerView = document.createElement('button');
  const closeView = document.createElement('button');
  const outside = document.createElement('button');
  let contentView = document.createElement('div');
  let nativeView = document.createElement('button');
  contentView.tabIndex = -1;
  nativeView.textContent = 'Native entry';
  closeView.textContent = 'Logical Close';
  contentView.append(nativeView);
  if (logicalChild) contentView.append(closeView);
  rootView.append(triggerView, contentView);
  document.body.append(rootView, outside);
  owned.add(rootView);
  owned.add(outside);
  const views = new Map<unknown, HTMLElement>([
    [rootToken, rootView],
    [triggerToken, triggerView],
    [contentToken, contentView],
    [closeToken, closeView],
  ]);
  const ready = new Set<unknown>([rootToken, triggerToken, contentToken, closeToken]);
  const listeners = new Map<object, Set<() => void>>();
  const requests: Array<{ name: string; payload: unknown }> = [];
  const applications: Array<{
    target: HTMLElement;
    options: FocusRequestOptions | undefined;
    kind: FocusRequestKind;
    accepted: boolean;
  }> = [];
  let acceptEntry = true;
  let acceptLogical = true;
  function make<P extends PropsBaseType>(source: Prototype<P>, token: object, initial: P) {
    let raw = initial;
    let record: Record<string, unknown> = {};
    let session: RuntimeSession<P> | null = null;
    const queue: Array<() => void> = [];
    const targetListeners = new Set<() => void>();
    listeners.set(token, targetListeners);
    const host: RuntimeHost<P> = {
      prototypeName: source.name,
      getRawProps: () => raw,
      commit(_children, signal) {
        signal?.done();
      },
      schedule(task) {
        queue.push(task);
      },
      scheduleDelay(duration, task) {
        if (duration !== 0) throw new Error('This fixture uses only zero-duration transitions.');
        let active = true;
        queue.push(() => {
          if (active) task();
        });
        return {
          cancel() {
            active = false;
          },
        };
      },
      onRuntimeReady(wiring) {
        wiring.attach('expose-state', [
          [
            EXPOSES_RECORD_SINK_CAP,
            (next: Record<string, unknown>) => {
              record = next;
            },
          ],
        ]);
        wiring.attach('expose-event', [
          [
            EXPOSE_EVENT_SINK_CAP,
            (name: string, payload: unknown) => requests.push({ name, payload }),
          ],
        ]);
        wiring.attach('event', [
          [EVENT_ROOT_TARGET_CAP, () => views.get(token) ?? null],
          [EVENT_GLOBAL_TARGET_CAP, () => document],
        ]);
        wiring.attach('anatomy', [
          [ANATOMY_INSTANCE_TOKEN_CAP, token],
          [ANATOMY_PARENT_CAP, (item: unknown) => parents.get(item) ?? null],
          [ANATOMY_GET_PROTO_CAP, getPrototype],
          [ANATOMY_ROOT_TARGET_CAP, (item: unknown) => views.get(item) ?? null],
        ]);
        // Commands share the other modules' stable logical identity. Opaque
        // tokens are not EventTargets, so route their semantic input to the
        // actual host view rather than AsTrigger's legacy token fallback.
        wiring.attach('as-trigger', [
          [AS_TRIGGER_INSTANCE_CAP, token],
          [AS_TRIGGER_PARENT_CAP, (item: unknown) => parents.get(item) ?? null],
          [AS_TRIGGER_GET_PROTO_CAP, getPrototype],
          [AS_TRIGGER_GET_GROUP_EVENT_TARGET_CAP, (item: unknown) => views.get(item) ?? null],
        ]);
        wiring.attach('context', [
          [CONTEXT_INSTANCE_TOKEN_CAP, token],
          [CONTEXT_PARENT_CAP, (item: unknown) => parents.get(item) ?? null],
        ]);
        wiring.attach('boundary', [
          [HOST_ELEMENT_CAP, views.get(token)],
          [
            BOUNDARY_HOST_BRIDGE_CAP,
            {
              classify({ sample }: { sample?: { target?: unknown } }) {
                const target = sample?.target;
                if (!(target instanceof Node)) return 'unknown';
                return contentView.contains(target) || triggerView.contains(target)
                  ? 'inside'
                  : 'outside';
              },
            },
          ],
        ]);
        wiring.attach('focus', [
          [FOCUS_INSTANCE_TOKEN_CAP, token],
          [FOCUS_PARENT_CAP, (item: unknown) => parents.get(item) ?? null],
          [FOCUS_ROOT_TARGET_CAP, () => (ready.has(token) ? (views.get(token) ?? null) : null)],
          [
            FOCUS_TARGET_READY_CAP,
            (listener: () => void) => {
              targetListeners.add(listener);
              return () => {
                targetListeners.delete(listener);
              };
            },
          ],
          [
            FOCUS_RESOLVE_ENTRY_TARGET_CAP,
            (container: HTMLElement, config: FocusEntryConfig) => {
              if (config.strategy === 'self') return container;
              return (
                container.querySelector<HTMLElement>('button, a[href]') ??
                (config.fallback === 'self' ? container : null)
              );
            },
          ],
          [
            FOCUS_REQUEST_FOCUS_CAP,
            (
              target: HTMLElement,
              options: FocusRequestOptions | undefined,
              kind: FocusRequestKind
            ) => {
              // Explicit host rejection injection, not a focus observation.
              if ((kind === 'entry' && !acceptEntry) || (target === closeView && !acceptLogical)) {
                applications.push({ target, options, kind, accepted: false });
                return false;
              }
              target.focus(
                typeof options?.preventScroll === 'boolean'
                  ? { preventScroll: options.preventScroll }
                  : undefined
              );
              const accepted = document.activeElement === target;
              applications.push({ target, options, kind, accepted });
              return accepted;
            },
          ],
          [
            FOCUS_RUN_IN_CALLBACK_CAP,
            (fn: () => void) => (session ? session.invokeInCallbackScope(fn) : fn()),
          ],
        ]);
      },
    };
    const current = createRuntimeSession(source, host);
    session = current;
    return {
      session: current,
      queue,
      setProps(next: Partial<P>) {
        raw = { ...raw, ...next };
        current.controller.applyRawProps(raw);
      },
      open() {
        // These actual Base Root/Content sources publish this known state;
        // the generic expose sink cannot retain its author-side declaration.
        const state = record.open as ExposedStateHandle<boolean>;
        return state.get();
      },
    };
  }
  const root = make<PopoverRootProps>(base.popoverRoot, rootToken, { open: false });
  const trigger = make(base.popoverTrigger, triggerToken, {});
  const content = make(base.popoverContent, contentToken, { enterDuration: 0, leaveDuration: 0 });
  const close = logicalChild ? make(base.popoverClose, closeToken, {}) : null;
  const parts = close ? [root, trigger, content, close] : [root, trigger, content];
  function drain() {
    while (parts.some((part) => part.queue.length))
      for (const part of parts) while (part.queue.length) part.queue.shift()!();
  }
  async function mount(part = content) {
    const pending = part.session.mount();
    drain();
    await pending;
    drain();
  }
  // Mounting Content last leaves logical declaration/selection independent of
  // host readiness, just as an Adapter materializes children before reveal.
  for (const part of [root, trigger, ...(close ? [close] : []), content]) {
    const pending = part.session.mount();
    drain();
    await pending;
    drain();
  }
  function notify(token = contentToken) {
    for (const listener of [...(listeners.get(token) ?? [])]) listener();
    drain();
  }
  return {
    root,
    content,
    closeView,
    triggerView,
    outside,
    applications,
    requests,
    mount,
    get nativeView() {
      return nativeView;
    },
    setOpen(open: boolean) {
      root.setProps({ open });
      drain();
    },
    setEntryAccepted(accepted: boolean) {
      acceptEntry = accepted;
    },
    setLogicalAccepted(accepted: boolean) {
      acceptLogical = accepted;
    },
    setCloseReady(available: boolean) {
      if (available) ready.add(closeToken);
      else ready.delete(closeToken);
      notify(closeToken);
    },
    notify,
    replaceContentView() {
      contentView.remove();
      contentView = document.createElement('div');
      contentView.tabIndex = -1;
      nativeView = document.createElement('button');
      nativeView.textContent = 'Replacement native entry';
      contentView.append(nativeView);
      rootView.append(contentView);
      views.set(contentToken, contentView);
    },
    outsidePress() {
      outside.focus();
      outside.dispatchEvent(new Event('host:pointerdown', { bubbles: true }));
      outside.dispatchEvent(new Event('host:pointerup', { bubbles: true }));
      drain();
    },
    async cleanup() {
      for (const part of [...parts].reverse()) await part.session.dispose();
      rootView.remove();
      outside.remove();
    },
  };
}

it.each(['unavailable', 'rejected'] as const)(
  'preserves the selected logical child while its host is %s',
  async (hostState) => {
    const f = await retainedFixture(true);
    try {
      if (hostState === 'unavailable') f.setCloseReady(false);
      else f.setLogicalAccepted(false);
      f.setOpen(true);
      if (hostState === 'unavailable') expect(f.applications).toEqual([]);
      else
        expect(f.applications.at(-1)).toMatchObject({
          target: f.closeView,
          kind: 'programmatic',
          accepted: false,
        });
      f.notify();
      expect(f.applications.every((entry) => entry.target === f.closeView && !entry.accepted)).toBe(
        true
      );
      expect(document.activeElement).not.toBe(f.nativeView);
      f.applications.length = 0;
      f.setLogicalAccepted(true);
      f.setCloseReady(true);
      expect(document.activeElement).toBe(f.closeView);
      expect(f.applications).toEqual([
        {
          target: f.closeView,
          options: { reason: 'programmatic', preventScroll: true },
          kind: 'programmatic',
          accepted: true,
        },
      ]);
    } finally {
      await f.cleanup();
    }
  }
);

it.each([false, true])(
  'retained pending entry respects detached logical close=%s',
  async (closeWhileDetached) => {
    const f = await retainedFixture();
    try {
      f.setEntryAccepted(false);
      f.setOpen(true);
      expect(f.applications.at(-1)).toMatchObject({
        target: f.nativeView,
        kind: 'entry',
        accepted: false,
      });
      const oldNative = f.nativeView;
      const oldEpoch = f.content.session.mountEpoch;
      await f.content.session.unmount();
      f.replaceContentView();
      if (closeWhileDetached) f.setOpen(false);
      f.setEntryAccepted(true);
      f.applications.length = 0;
      f.outside.focus();
      await f.mount();
      f.notify();
      expect(f.content.session.mountEpoch).toBeGreaterThan(oldEpoch);
      expect(f.applications.some((entry) => entry.target === oldNative)).toBe(false);
      if (closeWhileDetached) {
        expect(f.applications).toEqual([]);
        expect(document.activeElement).toBe(f.outside);
        expect(f.root.open()).toBe(false);
        f.setOpen(true);
      }
      expect(document.activeElement).toBe(f.nativeView);
      expect(f.applications).toEqual([
        {
          target: f.nativeView,
          options: { reason: 'programmatic', preventScroll: true },
          kind: 'entry',
          accepted: true,
        },
      ]);
      f.notify();
      expect(f.applications).toHaveLength(1);
    } finally {
      await f.cleanup();
    }
  }
);

it('cancels a refused outside opening before readiness without rearming unchanged open', async () => {
  const f = await retainedFixture();
  try {
    f.setEntryAccepted(false);
    f.setOpen(true);
    expect(f.applications.at(-1)).toMatchObject({ kind: 'entry', accepted: false });
    f.outsidePress();
    expect(f.requests).toContainEqual({
      name: 'openChange',
      payload: {
        open: false,
        reason: 'outside.press',
        focusReason: 'pointer',
      },
    });
    expect(f.root.open()).toBe(true);
    expect(f.content.open()).toBe(true);
    f.setEntryAccepted(true);
    f.applications.length = 0;
    f.notify();
    f.root.setProps({ open: true, disabled: true });
    f.notify();
    expect(f.applications).toEqual([]);
    expect(document.activeElement).toBe(f.outside);
    f.root.setProps({ disabled: false });
    f.notify();
    expect(f.applications).toEqual([]);
    f.setOpen(false);
    expect(document.activeElement).toBe(f.outside);
    f.setOpen(true);
    expect(document.activeElement).toBe(f.nativeView);
    expect(f.applications).toEqual([
      {
        target: f.nativeView,
        options: { reason: 'programmatic', preventScroll: true },
        kind: 'entry',
        accepted: true,
      },
    ]);
  } finally {
    await f.cleanup();
  }
});

for (const proto of [
  datePicker.datePickerRoot,
  datePicker.datePickerTrigger,
  datePicker.datePickerContent,
  datePicker.datePickerDay,
  datePicker.datePickerValue,
])
  AdaptToWebComponent(proto, {
    diagnostics: {
      onLifecycleEvent(event) {
        if (event.type === 'instance.created') lives.created++;
        if (event.type === 'instance.dispose.done') lives.disposed++;
      },
    },
  });
it('Date Picker Content inherits entry preservation and Day selection still closes', async () => {
  function make(name: string, props: Record<string, unknown> = {}) {
    const node = document.createElement(name);
    setElementProps(node, props);
    owned.add(node);
    return node;
  }
  // Date Picker Value publishes its inherited formatted-value state handle.
  const root = make(datePicker.datePickerRoot.name, { defaultValue: '2026-10-01' }),
    trigger = make(datePicker.datePickerTrigger.name),
    content = make(datePicker.datePickerContent.name, { enterDuration: 0, leaveDuration: 0 }),
    day = make(datePicker.datePickerDay.name, { date: '2026-10-12' }),
    value = make(datePicker.datePickerValue.name) as HTMLElement & {
      getExposes(): { displayValue: ExposedStateHandle<string> };
    },
    command = make(base.popoverClose.name);
  command.textContent = 'Close';
  const observations: Array<{ options: FocusOptions | undefined; alreadyActive: boolean }> = [];
  const native = command.focus.bind(command);
  vi.spyOn(command, 'focus').mockImplementation((options) => {
    observations.push({ options, alreadyActive: document.activeElement === command });
    native(options);
  });
  const changes: unknown[] = [];
  root.addEventListener('openChange', (e) => changes.push((e as CustomEvent).detail));
  content.append(command, day);
  root.append(trigger, content, value);
  document.body.append(root);
  await flush();
  trigger.click();
  await flush();
  expect(observations[0]).toEqual({ options: { preventScroll: true }, alreadyActive: false });
  for (const call of observations)
    if (!call.alreadyActive) expect(call.options).toEqual({ preventScroll: true });
  expect(document.activeElement).toBe(command);
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  day.click();
  await flush();
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(trigger);
  expect(value.getExposes().displayValue.get()).toBe('2026-10-12');
  expect(changes).toEqual([
    { open: true, reason: 'trigger.press', focusReason: 'pointer' },
    { open: false, reason: 'date-selection', focusReason: 'pointer' },
  ]);
});
