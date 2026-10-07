import { describe, expect, it } from 'vitest';
import { definePrototype, type FocusRequestOptions } from '@proto.ui/core';
import { asFocusEntry, asFocusable } from '@proto.ui/hooks';
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
let identity = 0;
async function fixture(haveRequestCap = true) {
  let entry!: ReturnType<typeof asFocusEntry>;
  let focusable!: ReturnType<typeof asFocusable>;
  const root = document.createElement('div');
  root.tabIndex = 0;
  const child = document.createElement('button');
  root.append(child);
  document.body.append(root);
  let target: HTMLElement | null = root;
  let resolved: HTMLElement | null = child;
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
      entry = asFocusEntry();
      entry.configure({ strategy: 'descendant-first', fallback: 'none' });
      focusable = asFocusable();
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
            [FOCUS_PARENT_CAP, () => null],
            [FOCUS_ROOT_TARGET_CAP, () => target],
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
    session,
    attempts,
    port: session.caps.getPort<FocusPort>('focus')!,
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

// Real Runtime and Module/Center; deterministic host-cap reentry. This is not native-browser evidence.
describe('controlled host synchronous request boundary', () => {
  for (const oldKind of ['programmatic', 'native', 'entry'] as const) {
    for (const nextKind of ['programmatic', 'native', 'entry'] as const) {
      it(`${oldKind} rejected outer does not replace newer ${nextKind} intent`, async () => {
        const f = await fixture();
        try {
          let nested = false;
          f.setImpl(() => {
            if (!nested) {
              nested = true;
              f.request(nextKind, { reason: 'pointer', preventScroll: false });
            }
            return false;
          });
          f.request(oldKind, { reason: 'keyboard', preventScroll: true });
          expect(f.attempts).toHaveLength(2);
          f.setImpl(() => true);
          f.ready();
          expect(f.attempts.slice(2).map((x) => ({ kind: x.kind, options: x.options }))).toEqual([
            { kind: nextKind, options: { reason: 'pointer', preventScroll: false } },
          ]);
        } finally {
          await f.cleanup();
        }
      });
    }
    for (const action of ['blur', 'disable-reenable'] as const) {
      it(`${oldKind} rejected outer does not revive after synchronous ${action}`, async () => {
        const f = await fixture();
        try {
          f.setImpl(() => {
            if (action === 'blur') f.focusable.blur();
            else if (oldKind === 'entry') {
              f.entry.setDisabled(true);
              f.entry.setDisabled(false);
            } else {
              f.focusable.setDisabled(true);
              f.focusable.setDisabled(false);
            }
            return false;
          });
          f.request(oldKind, { reason: 'keyboard' });
          f.setImpl(() => true);
          f.ready();
          expect(f.attempts).toHaveLength(1);
          expect(f.port.getFacts()).toMatchObject({
            focused: false,
            active: false,
            focusVisible: false,
          });
        } finally {
          await f.cleanup();
        }
      });
    }
  }
  for (const condition of ['root-absent', 'resolver-null'] as const) {
    for (const oldKind of ['programmatic', 'native'] as const) {
      it(`first entry ${condition} leaves previous ${oldKind} pending untouched`, async () => {
        const f = await fixture();
        try {
          f.request(oldKind, { reason: 'keyboard' });
          if (condition === 'root-absent') f.setTarget(null);
          else f.setResolved(null);
          f.entry.focus({ reason: 'pointer' });
          f.setTarget(f.root);
          f.setResolved(f.child);
          f.setImpl(() => true);
          f.ready();
          expect(f.attempts.slice(1).map((x) => ({ kind: x.kind, options: x.options }))).toEqual([
            { kind: oldKind, options: { reason: 'keyboard' } },
          ]);
        } finally {
          await f.cleanup();
        }
      });
    }
  }
  it('programmatic accepted outer preserves synchronous blur cancellation facts', async () => {
    const f = await fixture();
    try {
      f.setImpl(() => {
        f.focusable.blur();
        return true;
      });
      f.focusable.focus({ reason: 'keyboard' });
      expect(f.port.getFacts()).toMatchObject({
        focused: false,
        active: false,
        focusVisible: false,
      });
    } finally {
      await f.cleanup();
    }
  });
  it('programmatic accepted outer preserves a newer pending native intent and its facts', async () => {
    const f = await fixture();
    try {
      f.setImpl((_el, options) => {
        if (options?.reason === 'keyboard') {
          f.focusable.focusSelf({ reason: 'pointer' });
          return true;
        }
        return false;
      });
      f.focusable.focus({ reason: 'keyboard' });
      expect(f.port.getFacts()).toMatchObject({
        focused: false,
        active: false,
        focusVisible: false,
      });
      f.setImpl(() => true);
      f.ready();
      expect(f.attempts.at(-1)?.options).toEqual({ reason: 'pointer' });
    } finally {
      await f.cleanup();
    }
  });
  it('programmatic accepted outer does not steal Center ownership from a newer other instance', async () => {
    const a = await fixture(),
      b = await fixture();
    try {
      b.setImpl(() => true);
      a.setImpl(() => {
        b.focusable.focus({ reason: 'pointer' });
        return true;
      });
      a.focusable.focus({ reason: 'keyboard' });
      expect(a.port.getFacts()).toMatchObject({
        focused: false,
        active: false,
        focusVisible: false,
      });
      expect(b.port.getFacts()).toMatchObject({ focused: true, active: true, focusVisible: false });
    } finally {
      await a.cleanup();
      await b.cleanup();
    }
  });
});

describe('controls and additional no-owner boundaries', () => {
  for (const kind of ['programmatic', 'native', 'entry'] as const) {
    it(`${kind} control retains rejected request without reentry`, async () => {
      const f = await fixture();
      try {
        f.request(kind, { reason: 'keyboard' });
        f.setImpl(() => true);
        f.ready();
        expect(f.attempts.map((x) => x.kind)).toEqual([kind, kind]);
        expect(f.port.getFacts().focused).toBe(kind === 'programmatic');
      } finally {
        await f.cleanup();
      }
    });
    it(`${kind} control keeps pending when unrelated role disabled inside host`, async () => {
      const f = await fixture();
      try {
        f.setImpl(() => {
          if (kind === 'entry') f.focusable.setDisabled(true);
          else f.entry.setDisabled(true);
          return false;
        });
        f.request(kind, { reason: 'keyboard' });
        f.setImpl(() => true);
        f.ready();
        expect(f.attempts.map((x) => x.kind)).toEqual([kind, kind]);
      } finally {
        await f.cleanup();
      }
    });
    it(`${kind} throwing outer does not erase newer entry`, async () => {
      const f = await fixture();
      try {
        f.setImpl((_el, options) => {
          if (options?.reason === 'keyboard') {
            f.entry.focus({ reason: 'pointer' });
            throw Error('host exception');
          }
          return false;
        });
        expect(() => f.request(kind, { reason: 'keyboard' })).toThrow('host exception');
        f.setImpl(() => true);
        f.ready();
        expect(f.attempts.at(-1)?.options).toEqual({ reason: 'pointer' });
      } finally {
        await f.cleanup();
      }
    });
  }
  for (const kind of ['programmatic', 'native'] as const) {
    it(`first entry missing-cap leaves previous ${kind} pending untouched`, async () => {
      const f = await fixture(false);
      try {
        f.request(kind, { reason: 'keyboard' });
        f.entry.focus({ reason: 'pointer' });
        f.setRequestCap(true);
        f.setImpl(() => true);
        f.ready();
        expect(f.attempts.map((x) => ({ kind: x.kind, options: x.options }))).toEqual([
          { kind, options: { reason: 'keyboard' } },
        ]);
      } finally {
        await f.cleanup();
      }
    });
    it(`no-target entry during ${kind} host call is a no-op`, async () => {
      const f = await fixture();
      try {
        f.setImpl(() => {
          f.setTarget(null);
          f.entry.focus({ reason: 'pointer' });
          f.setTarget(f.root);
          return false;
        });
        f.request(kind, { reason: 'keyboard' });
        f.setImpl(() => true);
        f.ready();
        expect(f.attempts.slice(1).map((x) => ({ kind: x.kind, options: x.options }))).toEqual([
          { kind, options: { reason: 'keyboard' } },
        ]);
      } finally {
        await f.cleanup();
      }
    });
  }
  it('resolver reentry cannot replace newer target pending with old entry', async () => {
    const f = await fixture();
    try {
      f.setResolveImpl(() => {
        f.focusable.focusSelf({ reason: 'pointer' });
        return f.child;
      });
      f.entry.focus({ reason: 'keyboard' });
      f.setResolveImpl(undefined);
      f.setImpl(() => true);
      f.ready();
      expect(f.attempts.at(-1)?.kind).toBe('native');
      expect(f.attempts.at(-1)?.options).toEqual({ reason: 'pointer' });
    } finally {
      await f.cleanup();
    }
  });
  it('Center cleanup observer can transfer owner without older request stealing it', async () => {
    const a = await fixture(),
      b = await fixture(),
      c = await fixture();
    try {
      for (const f of [a, b, c])
        f.setImpl((el) => {
          el.focus();
          return el.ownerDocument.activeElement === el;
        });
      a.focusable.focus({ reason: 'keyboard' });
      a.setObserver((next) => {
        if (!next) c.focusable.focus({ reason: 'pointer' });
      });
      b.focusable.focus({ reason: 'keyboard' });
      expect(document.activeElement).toBe(c.root);
      expect([
        a.port.getFacts().focused,
        b.port.getFacts().focused,
        c.port.getFacts().focused,
      ]).toEqual([false, false, true]);
    } finally {
      await a.cleanup();
      await b.cleanup();
      await c.cleanup();
    }
  });
});

describe('DOM-effect controls through controlled host capability', () => {
  for (const kind of ['programmatic', 'native', 'entry'] as const) {
    it(`${kind} native focus observer blur must not create later replay`, async () => {
      const f = await fixture();
      try {
        const actualTarget = kind === 'entry' ? f.child : f.root;
        f.setImpl((el) => {
          el.focus();
          return el.ownerDocument.activeElement === el;
        });
        actualTarget.addEventListener(
          'focus',
          () => {
            f.focusable.blur();
            actualTarget.blur();
          },
          { once: true }
        );
        f.request(kind, { reason: 'keyboard' });
        expect(document.activeElement).not.toBe(actualTarget);
        f.ready();
        expect(f.attempts).toHaveLength(1);
        expect(document.activeElement).not.toBe(actualTarget);
      } finally {
        await f.cleanup();
      }
    });
    it(`${kind} native focus observer newest other target remains owner after readiness`, async () => {
      const f = await fixture(),
        next = await fixture();
      try {
        const actualTarget = kind === 'entry' ? f.child : f.root;
        for (const x of [f, next])
          x.setImpl((el) => {
            el.focus();
            return el.ownerDocument.activeElement === el;
          });
        actualTarget.addEventListener('focus', () => next.focusable.focus({ reason: 'pointer' }), {
          once: true,
        });
        f.request(kind, { reason: 'keyboard' });
        expect(document.activeElement).toBe(next.root);
        expect(next.focusable.focused.get()).toBe(true);
        f.ready();
        expect(document.activeElement).toBe(next.root);
        expect(next.focusable.focused.get()).toBe(true);
      } finally {
        await f.cleanup();
        await next.cleanup();
      }
    });
  }
});

describe('state-observer effects after a legitimately accepted application', () => {
  it('focused observer blur wins over remaining programmatic fact writes', async () => {
    const f = await fixture();
    try {
      f.setImpl((el) => {
        el.focus();
        return el.ownerDocument.activeElement === el;
      });
      f.setObserver((next) => {
        if (next) f.focusable.blur();
      });
      f.focusable.focus({ reason: 'keyboard' });
      expect(document.activeElement).not.toBe(f.root);
      expect(f.port.getFacts()).toMatchObject({
        focused: false,
        active: false,
        focusVisible: false,
      });
    } finally {
      await f.cleanup();
    }
  });
  it('focused observer refocus wins over remaining explicit blur fact writes', async () => {
    const f = await fixture();
    try {
      f.setImpl((el) => {
        el.focus();
        return el.ownerDocument.activeElement === el;
      });
      f.focusable.focus({ reason: 'keyboard' });
      f.setObserver((next) => {
        if (!next) f.focusable.focus({ reason: 'keyboard' });
      });
      f.focusable.blur();
      expect(document.activeElement).toBe(f.root);
      expect(f.port.getFacts()).toMatchObject({ focused: true, active: true, focusVisible: true });
    } finally {
      await f.cleanup();
    }
  });
});
