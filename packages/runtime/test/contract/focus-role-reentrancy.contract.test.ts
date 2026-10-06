import { describe, expect, it } from 'vitest';
import { definePrototype, type FocusRequestOptions } from '@proto.ui/core';
import { asFocusEntry, asFocusable, asFocusScope } from '@proto.ui/hooks';
import { createRuntimeSession } from '@proto.ui/runtime';
import { EVENT_ROOT_TARGET_CAP, EVENT_GLOBAL_TARGET_CAP } from '@proto.ui/module-event';
import {
  FOCUS_ROOT_TARGET_CAP,
  FOCUS_REQUEST_FOCUS_CAP,
  FOCUS_BLUR_CAP,
  FOCUS_TARGET_READY_CAP,
  FOCUS_INSTANCE_TOKEN_CAP,
  FOCUS_PARENT_CAP,
  FOCUS_RESOLVE_ENTRY_TARGET_CAP,
  FOCUS_RUN_IN_CALLBACK_CAP,
  type FocusPort,
} from '@proto.ui/module-focus';

type Kind = 'programmatic' | 'native' | 'entry';
let identity = 10000;
async function fixture(haveRequestCap = true, declareScope = false, selfEntry = false) {
  let scope: ReturnType<typeof asFocusScope> | undefined;
  let parentToken: unknown = null;
  let parentObserver: (() => void) | undefined;
  let entry!: ReturnType<typeof asFocusEntry>;
  let focusable!: ReturnType<typeof asFocusable>;
  const root = document.createElement('div');
  root.tabIndex = 0;
  const child = document.createElement('button');
  root.append(child);
  document.body.append(root);
  let target: HTMLElement | null = root;
  let resolved: HTMLElement | null = child;
  let rootImpl: (() => HTMLElement | null) | undefined;
  let eligibleObserver: (next: boolean) => void = () => {};
  let observer: (next: boolean) => void = () => {};
  let resolveImpl: (() => HTMLElement | null) | undefined;
  let attachFocus: () => void;
  const token = {};
  const listeners = new Set<() => void>();
  const attempts: Array<{
    target: HTMLElement;
    options: FocusRequestOptions | undefined;
    kind: Kind;
  }> = [];
  let impl: (
    el: HTMLElement,
    options: FocusRequestOptions | undefined,
    kind: Kind
  ) => boolean = () => false;
  const proto = definePrototype({
    name: `transition-attack-${++identity}`,
    setup() {
      if (declareScope) {
        scope = asFocusScope();
        scope.configure({ entry: 'manual' });
      }
      entry = asFocusEntry();
      entry.configure(
        selfEntry
          ? { strategy: 'self', fallback: 'self' }
          : { strategy: 'descendant-first', fallback: 'none' }
      );
      focusable = asFocusable();
      focusable.focusable.watch((_ctx, event) => {
        if (event.type === 'next') eligibleObserver(event.next);
      });
      focusable.focused.watch((_ctx, event) => {
        if (event.type === 'next') observer(event.next);
      });
      return (r) => r.el('div');
    },
  });
  let session: ReturnType<typeof createRuntimeSession>;
  session = createRuntimeSession(proto, {
    prototypeName: proto.name,
    getRawProps: () => ({}),
    schedule: (fn) => fn(),
    commit: (_children, signal) => signal?.done(),
    onRuntimeReady(wiring) {
      wiring.attach('event', [
        [EVENT_ROOT_TARGET_CAP, () => root],
        [EVENT_GLOBAL_TARGET_CAP, () => window],
      ]);
      attachFocus = () =>
        wiring.attach(
          'focus',
          [
            [FOCUS_INSTANCE_TOKEN_CAP, token],
            [
              FOCUS_PARENT_CAP,
              (instance: unknown) => {
                parentObserver?.();
                return instance === token ? parentToken : null;
              },
            ],
            [FOCUS_ROOT_TARGET_CAP, () => (rootImpl ? rootImpl() : target)],
            [FOCUS_BLUR_CAP, (el: HTMLElement) => el.blur()],
            [FOCUS_RESOLVE_ENTRY_TARGET_CAP, () => (resolveImpl ? resolveImpl() : resolved)],
            [
              FOCUS_REQUEST_FOCUS_CAP,
              (el: HTMLElement, options: FocusRequestOptions | undefined, kind: Kind) => {
                attempts.push({ target: el, options, kind });
                return impl(el, options, kind);
              },
            ],
            [
              FOCUS_TARGET_READY_CAP,
              (fn: () => void) => {
                listeners.add(fn);
                return () => listeners.delete(fn);
              },
            ],
            [FOCUS_RUN_IN_CALLBACK_CAP, (fn: () => void) => session.invokeInCallbackScope(fn)],
          ].filter(([cap]) => haveRequestCap || cap !== FOCUS_REQUEST_FOCUS_CAP) as any
        );
      attachFocus();
    },
  });
  await session.mount();
  return {
    root,
    child,
    entry,
    focusable,
    scope,
    token,
    session,
    attempts,
    setParent(v: unknown) {
      parentToken = v;
    },
    setParentObserver(v: typeof parentObserver) {
      parentObserver = v;
    },
    port: session.caps.getPort<FocusPort>('focus')!,
    setRootImpl(v: typeof rootImpl) {
      rootImpl = v;
    },
    setEligibleObserver(v: typeof eligibleObserver) {
      eligibleObserver = v;
    },
    setObserver(v: typeof observer) {
      observer = v;
    },
    setResolveImpl(v: typeof resolveImpl) {
      resolveImpl = v;
    },
    setRequestCap(v: boolean) {
      haveRequestCap = v;
      attachFocus();
    },
    setTarget(v: HTMLElement | null) {
      target = v;
    },
    setResolved(v: HTMLElement | null) {
      resolved = v;
    },
    setImpl(v: typeof impl) {
      impl = v;
    },
    ready() {
      for (const fn of [...listeners]) fn();
    },
    request(kind: Kind, options: FocusRequestOptions) {
      if (kind === 'entry') entry.focus(options);
      else if (kind === 'native') focusable.focusSelf(options);
      else focusable.focus(options);
    },
    async cleanup() {
      await session.dispose();
      root.remove();
    },
  };
}

// Bounded role-scoped cancellation controls for tentative entry execution.
describe('third-repair role controls', () => {
  for (const kind of ['programmatic', 'native'] as const) {
    it(`entry outer preserves request when already-disabled ${kind} is attempted`, async () => {
      const f = await fixture();
      try {
        f.focusable.setDisabled(true);
        let once = true;
        f.setImpl(() => {
          if (once) {
            once = false;
            f.request(kind, { reason: 'pointer' });
          }
          return false;
        });
        f.entry.focus({ reason: 'keyboard' });
        f.setImpl(() => true);
        f.ready();
        expect(f.attempts.map((x) => ({ kind: x.kind, options: x.options }))).toEqual([
          { kind: 'entry', options: { reason: 'keyboard' } },
          { kind: 'entry', options: { reason: 'keyboard' } },
        ]);
      } finally {
        await f.cleanup();
      }
    });
    it(`${kind} survives entry-role cancellation inside first unresolved entry`, async () => {
      const f = await fixture();
      try {
        let once = true;
        f.setImpl(() => {
          if (once) {
            once = false;
            f.setResolveImpl(() => {
              f.entry.setDisabled(true);
              f.entry.setDisabled(false);
              return null;
            });
            f.entry.focus({ reason: 'pointer' });
            f.setResolveImpl(undefined);
          }
          return false;
        });
        f.request(kind, { reason: 'keyboard' });
        f.setImpl(() => true);
        f.ready();
        expect(f.attempts.map((x) => ({ kind: x.kind, options: x.options }))).toEqual([
          { kind, options: { reason: 'keyboard' } },
          { kind, options: { reason: 'keyboard' } },
        ]);
      } finally {
        await f.cleanup();
      }
    });
  }
});

describe('tentative entry parent chain', () => {
  it('entry disable across two unresolved reservations preserves the underlying target', async () => {
    const f = await fixture();
    try {
      let once = true;
      let depth = 0;
      f.setImpl(() => {
        if (once) {
          once = false;
          f.setResolveImpl(() => {
            depth++;
            if (depth === 1) f.entry.focus({ reason: 'pointer' });
            else {
              f.entry.setDisabled(true);
              f.entry.setDisabled(false);
            }
            return null;
          });
          f.entry.focus({ reason: 'pointer' });
          f.setResolveImpl(undefined);
        }
        return false;
      });
      f.focusable.focus({ reason: 'keyboard' });
      f.setImpl(() => true);
      f.ready();
      expect(f.attempts.map((x) => ({ kind: x.kind, options: x.options }))).toEqual([
        { kind: 'programmatic', options: { reason: 'keyboard' } },
        { kind: 'programmatic', options: { reason: 'keyboard' } },
      ]);
    } finally {
      await f.cleanup();
    }
  });
});

it.each(['new entry', 'no target', 'entry disabled', 'new blur'] as const)(
  'target disable preserves the latest eligible observer operation: %s',
  async (action) => {
    const f = await fixture(true, false, true);
    try {
      f.setResolved(f.root);
      f.setImpl((el) => {
        el.focus();
        return true;
      });
      f.focusable.focus();
      expect(document.activeElement).toBe(f.root);
      if (action === 'no target') f.setResolved(null);
      if (action === 'entry disabled') f.entry.setDisabled(true);
      f.setEligibleObserver((next) => {
        if (next) return;
        if (action === 'new blur') f.focusable.blur();
        else f.entry.focus({ reason: 'pointer' });
      });
      f.focusable.setDisabled(true);
      expect(f.focusable.focusable.get()).toBe(false);
      expect(document.activeElement === f.root).toBe(action === 'new entry');
      expect(f.attempts.filter((attempt) => attempt.kind === 'entry')).toHaveLength(
        action === 'new entry' ? 1 : 0
      );
    } finally {
      await f.cleanup();
    }
  }
);

it.each(['pending', 'pending then blur', 'pending then disable entry'] as const)(
  'target disable clears old physical focus while preserving newer entry policy: %s',
  async (action) => {
    const f = await fixture();
    let accepts = false;
    // Forward real DOM events into the Runtime host event vocabulary.
    f.root.addEventListener('focus', () => f.root.dispatchEvent(new Event('host:focus')));
    f.root.addEventListener('blur', () => f.root.dispatchEvent(new Event('host:blur')));
    try {
      f.setImpl((el, _options, kind) => {
        if (kind === 'entry' && !accepts) return false;
        el.focus();
        return true;
      });
      f.focusable.focus({ reason: 'keyboard' });
      expect(document.activeElement).toBe(f.root);
      expect(f.focusable.focused.get()).toBe(true);
      f.setEligibleObserver((next) => {
        if (next) return;
        f.entry.focus({ reason: 'keyboard', preventScroll: true });
        if (action === 'pending then blur') f.focusable.blur();
        else if (action === 'pending then disable entry') f.entry.setDisabled(true);
      });
      f.focusable.setDisabled(true);
      expect(document.activeElement).not.toBe(f.root);
      expect(f.port.getFacts()).toMatchObject({
        focused: false,
        active: false,
        focusVisible: false,
      });
      accepts = true;
      f.ready();
      expect(document.activeElement === f.child).toBe(action === 'pending');
      expect(f.attempts.filter((attempt) => attempt.kind === 'entry')).toHaveLength(
        action === 'pending' ? 2 : 1
      );
      if (action === 'pending')
        expect(f.attempts.at(-1)?.options).toEqual({ reason: 'keyboard', preventScroll: true });
    } finally {
      await f.cleanup();
    }
  }
);

it('preserves an acquired self-entry while a subsequent observer entry awaits its descendant', async () => {
  const f = await fixture();
  let accepts = true;
  try {
    f.setImpl((el, _options, kind) => {
      if (kind === 'entry' && !accepts) return false;
      el.focus();
      return true;
    });
    f.focusable.focus();
    f.setEligibleObserver((next) => {
      if (next) return;
      f.setResolved(f.root);
      f.entry.focus({ reason: 'keyboard', preventScroll: true });
      f.setResolved(f.child);
      accepts = false;
      f.entry.focus({ reason: 'pointer', preventScroll: false });
    });
    f.focusable.setDisabled(true);
    expect(document.activeElement).toBe(f.root);
    accepts = true;
    f.ready();
    expect(document.activeElement).toBe(f.child);
    expect(f.attempts.at(-1)?.options).toEqual({ reason: 'pointer', preventScroll: false });
  } finally {
    await f.cleanup();
  }
});

it.each([
  'disable entry',
  'disable then reenable entry',
  'explicit no target',
  'explicit blur',
] as const)(
  'does not count an entry cancelled inside accepted host focus as a surviving acquisition: %s',
  async (action) => {
    const f = await fixture(true, false, true);
    try {
      f.setResolved(f.root);
      f.setImpl((el, _options, kind) => {
        el.focus();
        if (kind === 'entry') {
          if (action === 'explicit blur') f.focusable.blur();
          else if (action === 'explicit no target') {
            f.setResolved(null);
            f.entry.focus();
          } else {
            f.entry.setDisabled(true);
            if (action === 'disable then reenable entry') f.entry.setDisabled(false);
          }
        }
        return true;
      });
      f.focusable.focus();
      f.setEligibleObserver((next) => {
        if (!next) f.entry.focus({ preventScroll: true });
      });
      f.focusable.setDisabled(true);
      expect(document.activeElement).not.toBe(f.root);
      expect(f.port.getFacts()).toMatchObject({
        focused: false,
        active: false,
        focusVisible: false,
      });
      f.setResolved(f.root);
      f.ready();
      expect(document.activeElement).not.toBe(f.root);
      expect(f.attempts.filter((attempt) => attempt.kind === 'entry')).toHaveLength(1);
    } finally {
      await f.cleanup();
    }
  }
);

it.each(['pending', 'acquired self', 'acquired child'] as const)(
  'target disable distinguishes acquisition from pending intent inside root getter: %s',
  async (action) => {
    const f = await fixture();
    let accepts = action !== 'pending';
    try {
      f.setImpl((el, _options, kind) => {
        if (kind === 'entry' && !accepts) return false;
        el.focus();
        return true;
      });
      f.focusable.focus({ reason: 'keyboard' });
      expect(document.activeElement).toBe(f.root);
      if (action === 'acquired self') f.setResolved(f.root);
      let once = true;
      f.setRootImpl(() => {
        if (once) {
          once = false;
          f.entry.focus({ reason: 'keyboard', preventScroll: true });
        }
        return f.root;
      });
      f.focusable.setDisabled(true);
      expect(document.activeElement === f.root).toBe(action === 'acquired self');
      if (action === 'pending') {
        expect(f.port.getFacts()).toMatchObject({
          focused: false,
          active: false,
          focusVisible: false,
        });
        accepts = true;
        f.ready();
        expect(document.activeElement).toBe(f.child);
        expect(f.attempts.filter((attempt) => attempt.kind === 'entry')).toHaveLength(2);
        expect(f.attempts.at(-1)?.options).toEqual({ reason: 'keyboard', preventScroll: true });
      } else {
        expect(document.activeElement).toBe(action === 'acquired self' ? f.root : f.child);
        expect(f.attempts.filter((attempt) => attempt.kind === 'entry')).toHaveLength(1);
      }
    } finally {
      await f.cleanup();
    }
  }
);
