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
    name: `transition-attack-${++identity}`,
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
          ].filter(
            ([cap]) =>
              cap !== FOCUS_INSTANCE_TOKEN_CAP &&
              (haveRequestCap || cap !== FOCUS_REQUEST_FOCUS_CAP)
          ) as any
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

describe('absent stable instance token preflight', () => {
  it('fallback root-token read cannot let old focus overwrite a newer request', async () => {
    const f = await fixture();
    try {
      f.setImpl(() => true);
      let armed = true;
      f.setRootImpl(() => {
        if (armed) {
          armed = false;
          f.focusable.focus({ reason: 'pointer' });
        }
        return f.root;
      });
      f.focusable.focus({ reason: 'keyboard' });
      expect(f.attempts.map((x) => x.options)).toEqual([{ reason: 'pointer' }]);
      expect(f.port.getFacts()).toMatchObject({ focused: true, active: true, focusVisible: false });
    } finally {
      await f.cleanup();
    }
  });
});
