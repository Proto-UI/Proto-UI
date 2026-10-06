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
async function fixture(haveRequestCap = true, declareScope = false) {
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
    name: `scope-supersession-${++identity}`,
    setup() {
      if (declareScope) {
        scope = asFocusScope();
        scope.configure({ entry: 'manual' });
      }
      entry = asFocusEntry();
      entry.configure({ strategy: 'descendant-first', fallback: 'none' });
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

// These controlled host rejections exercise real Runtime, FocusModule and FocusCenter.
// C-AS-FOCUSABLE-0001-G, C-AS-FOCUS-ENTRY-0001-H, M-FOCUS-0001-G.
describe('new target intent versus retained entry under active scope', () => {
  for (const kind of ['programmatic', 'native'] as const) {
    it(`${kind}: newer enabled target rejected by scope cancels older entry`, async () => {
      const f = await fixture(),
        scope = await fixture(true, true);
      try {
        f.entry.focus({ reason: 'keyboard', preventScroll: true });
        expect(f.attempts.map((a) => a.kind)).toEqual(['entry']);
        scope.scope!.activate();
        f.request(kind, { reason: 'pointer', preventScroll: false });
        expect(f.port.getWarnings()).toContainEqual(expect.stringContaining('does not contain'));
        expect(f.attempts).toHaveLength(1);
        f.setImpl((el) => {
          el.focus();
          return true;
        });
        f.ready();
        expect(f.attempts).toHaveLength(1);
        expect(document.activeElement).not.toBe(f.child);
        expect(f.port.getFacts()).toMatchObject({
          focused: false,
          active: false,
          focusVisible: false,
        });
        f.ready();
        expect(f.attempts).toHaveLength(1);
      } finally {
        await scope.cleanup();
        await f.cleanup();
      }
    });
    it(`${kind}: disabled target attempt preserves enabled pending entry`, async () => {
      const f = await fixture(),
        scope = await fixture(true, true);
      try {
        f.entry.focus({ reason: 'keyboard', preventScroll: true });
        scope.scope!.activate();
        f.focusable.setDisabled(true);
        f.request(kind, { reason: 'pointer', preventScroll: false });
        f.setImpl((el) => {
          el.focus();
          return true;
        });
        f.ready();
        expect(f.attempts.map((a) => a.kind)).toEqual(['entry', 'entry']);
        expect(f.attempts[1].options).toEqual({ reason: 'keyboard', preventScroll: true });
        expect(document.activeElement).toBe(f.child);
        expect(f.port.getFacts()).toMatchObject({
          focused: false,
          active: false,
          focusVisible: false,
        });
        f.focusable.setDisabled(false);
        f.ready();
        expect(f.attempts).toHaveLength(2);
      } finally {
        await scope.cleanup();
        await f.cleanup();
      }
    });
    it(`${kind}: newer in-scope rejected target replaces pending entry`, async () => {
      const f = await fixture(),
        scope = await fixture(true, true);
      try {
        f.setParent(scope.token);
        f.entry.focus({ reason: 'keyboard', preventScroll: true });
        scope.scope!.activate();
        f.request(kind, { reason: 'pointer', preventScroll: false });
        expect(f.attempts.map((a) => a.kind)).toEqual(['entry', kind]);
        f.setImpl((el) => {
          el.focus();
          return true;
        });
        f.ready();
        expect(f.attempts.map((a) => a.kind)).toEqual(['entry', kind, kind]);
        expect(f.attempts[2].options).toEqual({ reason: 'pointer', preventScroll: false });
        expect(document.activeElement).toBe(f.root);
      } finally {
        await scope.cleanup();
        await f.cleanup();
      }
    });
  }
  it('entry remains distinct from scope-gated target requests when not superseded', async () => {
    const f = await fixture(),
      scope = await fixture(true, true);
    try {
      f.entry.focus({ reason: 'keyboard' });
      scope.scope!.activate();
      f.setImpl((el) => {
        el.focus();
        return true;
      });
      f.ready();
      expect(f.attempts.map((a) => a.kind)).toEqual(['entry', 'entry']);
      expect(document.activeElement).toBe(f.child);
      expect(f.port.getFacts()).toMatchObject({
        focused: false,
        active: false,
        focusVisible: false,
      });
    } finally {
      await scope.cleanup();
      await f.cleanup();
    }
  });
});

describe('target preflight readiness reentry', () => {
  for (const kind of ['programmatic', 'native'] as const) {
    it(`${kind}: synchronous readiness from root getter cannot consume superseded entry`, async () => {
      const f = await fixture(),
        scope = await fixture(true, true);
      try {
        f.entry.focus({ reason: 'keyboard', preventScroll: true });
        scope.scope!.activate();
        f.setImpl((el) => {
          el.focus();
          return true;
        });
        let armed = true;
        f.setRootImpl(() => {
          if (armed) {
            armed = false;
            f.ready();
          }
          return f.root;
        });
        f.request(kind, { reason: 'pointer' });
        expect(armed).toBe(false);
        expect(f.attempts.map((a) => a.kind)).toEqual(['entry']);
        expect(document.activeElement).not.toBe(f.child);
        f.ready();
        expect(f.attempts).toHaveLength(1);
      } finally {
        await scope.cleanup();
        await f.cleanup();
      }
    });
  }
});
