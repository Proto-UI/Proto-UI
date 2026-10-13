import { afterEach, expect, it, vi } from 'vitest';
import { tw, type PresentationOwnerRef, type PresentationViewBinding } from '@proto.ui/core';
import { createWebPresencePresentationSink } from '../src/motion/web-presence-presentation';
import type { PresencePresentationFrame } from '@proto.ui/module-feedback';
const zero = { px: 0, rootText: 0, ownBox: 0 };
const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const off of cleanups.splice(0)) off();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
function fixture(preference: 'reduce' | 'unknown' | 'no-preference' = 'reduce') {
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const next = iframe.contentDocument!,
    win = next.defaultView!;
  const media = (value: string) => (query: string) => ({
    matches: query.includes(`: ${value})`),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  });
  vi.spyOn(window, 'matchMedia').mockImplementation(media('no-preference') as any);
  vi.spyOn(win, 'matchMedia').mockImplementation(media(preference) as any);
  vi.spyOn(window.CSS, 'supports').mockReturnValue(true);
  vi.spyOn(win.CSS, 'supports').mockReturnValue(true);
  const oldFrames = new Map<number, FrameRequestCallback>(),
    newFrames = new Map<number, FrameRequestCallback>();
  let ticket = 0;
  const oldRaf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    oldFrames.set(++ticket, cb);
    return ticket;
  });
  const nextRaf = vi.spyOn(win, 'requestAnimationFrame').mockImplementation((cb) => {
    newFrames.set(++ticket, cb);
    return ticket;
  });
  let onCancel: (() => void) | null = null;
  let onSubscribe: (() => void) | null = null;
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    oldFrames.delete(id);
    const cb = onCancel;
    onCancel = null;
    cb?.();
  });
  vi.spyOn(win, 'cancelAnimationFrame').mockImplementation((id) => {
    newFrames.delete(id);
  });
  const oldRemove = vi.spyOn(document, 'removeEventListener'),
    nextAdd = vi.spyOn(next, 'addEventListener');
  const el = document.createElement('div');
  Object.assign(el.style, { width: '320px', height: '200px', boxSizing: 'border-box' });
  document.body.append(el);
  let notify: (document: Document, phase: 'retire' | 'ready') => void = () => {},
    subscriptions = 0,
    unsubscribed = 0;
  const bindings: PresentationViewBinding[] = [];
  const results: string[] = [];
  const sink = createWebPresencePresentationSink(
    el,
    { queueStyle() {}, requestFlush() {} },
    {
      subscribeDocumentChange: (cb) => {
        notify = cb;
        subscriptions++;
        const onInstall = onSubscribe;
        onSubscribe = null;
        onInstall?.();
        return () => {
          unsubscribed++;
        };
      },
    }
  );
  cleanups.push(() => sink.release(1));
  const owner = Object.freeze({}) as PresentationOwnerRef;
  const make = (
    phase: 'entering' | 'leaving' | 'entered' = 'entering'
  ): PresencePresentationFrame => ({
    view: 1,
    revision: 1,
    targetRevision: 1,
    style: tw('bg-background'),
    owner: {
      owner,
      revision: 1,
      phase,
      attempt: phase === 'entered' ? null : { ownerEpoch: 1, phaseAttempt: 1 },
      completion: 'presentation',
      durationMs: 500,
      timeoutMs: 1000,
    },
    closed: { opacity: 0 },
    entered: { opacity: 1 },
    easing: [0.32, 0.72, 0, 1],
    bind: (b) => bindings.push(b),
    complete: (_b, outcome) => results.push(outcome),
  });
  const adopt = () => {
    next.body.append(next.adoptNode(el));
  };
  return {
    el,
    next,
    win,
    sink,
    make,
    adopt,
    signal: (document: Document, phase: 'retire' | 'ready') => notify(document, phase),
    notify: () => {
      notify(el.ownerDocument, 'retire');
      notify(el.ownerDocument, 'ready');
    },
    bindings,
    results,
    oldFrames,
    newFrames,
    oldRaf,
    nextRaf,
    oldRemove,
    nextAdd,
    onCancel: (cb: () => void) => {
      onCancel = cb;
    },
    onSubscribe: (cb: () => void) => {
      onSubscribe = cb;
    },
    subscriptions: () => subscriptions,
    unsubscribed: () => unsubscribed,
  };
}
it.each(['reduce', 'unknown'] as const)(
  'adoption invalidates old binding before cancellation and settles destination %s',
  (preference) => {
    const f = fixture(preference);
    f.sink.commit(f.make());
    const binding = f.bindings.at(-1),
      stale = [...f.oldFrames.values()];
    f.onCancel(() => expect(f.bindings.at(-1)).not.toBe(binding));
    f.adopt();
    f.notify();
    expect(f.oldFrames.size).toBe(0);
    expect(f.newFrames.size).toBe(0);
    expect(f.results).toEqual([preference === 'reduce' ? 'reduced-motion' : 'unknown-preference']);
    expect(f.oldRemove.mock.calls.some(([event]) => event === 'visibilitychange')).toBe(true);
    expect(f.nextAdd.mock.calls.some(([event]) => event === 'visibilitychange')).toBe(true);
    for (const cb of stale) cb(999);
    expect(f.results).toHaveLength(1);
    expect(f.el.style.opacity).toBe('');
  }
);
it('new document frame callbacks replace old callbacks and hidden destination settles', () => {
  const f = fixture('no-preference');
  f.sink.commit(f.make());
  const stale = [...f.oldFrames.values()];
  f.adopt();
  f.notify();
  expect(f.oldFrames.size).toBe(0);
  expect(f.newFrames.size).toBe(1);
  const calls = f.nextRaf.mock.calls.length;
  stale.forEach((cb) => cb(100));
  expect(f.nextRaf).toHaveBeenCalledTimes(calls);
  vi.spyOn(f.next, 'visibilityState', 'get').mockReturnValue('hidden');
  f.next.dispatchEvent(new Event('visibilitychange'));
  expect(f.newFrames.size).toBe(0);
  expect(f.results).toEqual(['hidden']);
});
it('same-document movement does not replace physical binding or duplicate subscriptions', () => {
  const f = fixture();
  f.sink.commit(f.make());
  const binding = f.bindings.at(-1);
  const holder = document.createElement('div');
  document.body.append(holder);
  holder.append(f.el);
  f.notify();
  f.sink.commit(f.make());
  expect(f.bindings.at(-1)).toBe(binding);
  expect(f.subscriptions()).toBe(1);
  expect(f.oldFrames.size).toBe(1);
});
it('commit detects adoption without native notification', () => {
  const f = fixture();
  f.sink.commit(f.make());
  f.adopt();
  f.sink.commit(f.make('leaving'));
  expect(f.results).toEqual(['reduced-motion']);
  expect(f.oldFrames.size).toBe(0);
  expect(f.newFrames.size).toBe(0);
});
it('queued old RAF detects adoption and cannot apply its old frame', () => {
  const f = fixture();
  f.sink.commit(f.make());
  const stale = [...f.oldFrames.values()];
  f.adopt();
  stale[0](20);
  expect(f.results).toEqual(['reduced-motion']);
  expect(f.oldFrames.size).toBe(0);
});
it('disposal during old cancellation wins over rebinding', () => {
  const f = fixture();
  f.sink.commit(f.make());
  f.onCancel(() => f.sink.release(1));
  f.adopt();
  f.notify();
  expect(f.oldFrames.size).toBe(0);
  expect(f.newFrames.size).toBe(0);
  expect(f.results).toEqual([]);
  expect(f.unsubscribed()).toBe(1);
});
it('newest semantic frame during teardown is the destination frame', () => {
  const f = fixture();
  f.sink.commit(f.make());
  f.onCancel(() => f.sink.commit(f.make('leaving')));
  f.adopt();
  f.notify();
  expect(f.results).toEqual(['reduced-motion']);
  expect(f.oldFrames.size).toBe(0);
  expect(f.newFrames.size).toBe(0);
});
it('cancel then release still removes the document subscription', () => {
  const f = fixture();
  f.sink.commit(f.make());
  f.sink.cancel();
  f.sink.release(1);
  expect(f.unsubscribed()).toBe(1);
});

it('throwing old observer cleanup cannot wedge destination admission', () => {
  const f = fixture();
  f.sink.commit(f.make());
  f.oldRemove.mockImplementationOnce(() => {
    throw Error('cleanup failure');
  });
  f.adopt();
  expect(() => f.notify()).not.toThrow();
  expect(f.results).toEqual(['reduced-motion']);
  expect(f.sink.diagnostics?.()).toContain('document-cleanup-failed');
});
it('subscription registration reentry queues newest frame without duplicate registration', () => {
  const f = fixture();
  f.onSubscribe(() => f.sink.commit(f.make('leaving')));
  f.sink.commit(f.make());
  expect(f.subscriptions()).toBe(1);
  expect(f.results).toEqual(['finished']);
  expect(f.oldFrames.size).toBe(0);
});
it('disposal during subscription registration releases its returned lease once', () => {
  const f = fixture();
  f.onSubscribe(() => f.sink.release(1));
  f.sink.commit(f.make());
  expect(f.unsubscribed()).toBe(1);
  expect(f.oldFrames.size).toBe(0);
  expect(f.results).toEqual([]);
});
it('failed invalidation callback does not leave the document handoff suspended', () => {
  const f = fixture();
  const frame = f.make();
  let calls = 0;
  const bind = frame.bind;
  f.sink.commit({
    ...frame,
    bind(binding) {
      if (++calls === 2) throw Error('bind failure');
      bind(binding);
    },
  });
  f.adopt();
  expect(() => f.notify()).not.toThrow();
  expect(f.results).toEqual(['reduced-motion']);
  expect(f.sink.diagnostics?.()).toContain('document-binding-failed');
});

it('a reentrant destination-ready notification waits until old leases are retired', () => {
  const f = fixture();
  f.sink.commit(f.make());
  f.onCancel(() => f.notify());
  f.adopt();
  f.notify();
  expect(f.results).toEqual(['reduced-motion']);
  expect(f.oldFrames.size).toBe(0);
  expect(f.newFrames.size).toBe(0);
  expect(f.el.style.opacity).toBe('');
});
// happy-dom15 makes ownerDocument nonconfigurable after adoptNode; a second native
// adoption throws before host code. Preserve that browser-only evidence obligation.
it.todo('native repeated adoption back to the original Document during cancellation');

it('a newly installed destination sink waits for adoption-ready before initial projection', () => {
  const f = fixture();
  f.onSubscribe(() => f.signal(f.el.ownerDocument, 'retire'));
  f.sink.commit(f.make());
  expect(f.oldFrames.size).toBe(0);
  expect(f.el.style.opacity).toBe('');
  expect(f.results).toEqual([]);
  f.signal(f.el.ownerDocument, 'ready');
  expect(f.oldFrames.size).toBe(1);
  expect(f.el.style.opacity).toBe('0');
});

it('early observer cleanup failure cannot skip remaining old-document resources', () => {
  const f = fixture();
  f.sink.commit(f.make());
  const mutation = vi.spyOn(window.MutationObserver.prototype, 'disconnect');
  vi.spyOn(window.ResizeObserver.prototype, 'disconnect').mockImplementationOnce(() => {
    throw Error('early resize cleanup');
  });
  f.adopt();
  f.notify();
  expect(mutation).toHaveBeenCalled();
  expect(f.oldRemove.mock.calls.some(([event]) => event === 'visibilitychange')).toBe(true);
  expect(f.results).toEqual(['reduced-motion']);
  expect(f.sink.diagnostics?.()).toContain('document-cleanup-failed');
});
