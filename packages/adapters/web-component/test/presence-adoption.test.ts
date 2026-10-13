import { afterEach, expect, it, vi } from 'vitest';
import { definePrototype, tw } from '@proto.ui/core';
import { asTransition, type TransitionProps } from '@proto.ui/prototypes-base/transition';
import { AdaptToWebComponent, setElementProps } from '../src';
const flush = async () => {
  for (let i = 0; i < 24; i++) await Promise.resolve();
};
let id = 0;
const roots: HTMLElement[] = [];
afterEach(async () => {
  roots.splice(0).forEach((el) => el.remove());
  await flush();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
async function fixture(initialOpen = false) {
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const next = iframe.contentDocument!,
    nextWindow = next.defaultView!;
  const media = (value: string) => (query: string) => ({
    matches: query.includes(`: ${value})`),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  });
  vi.spyOn(window, 'matchMedia').mockImplementation(media('no-preference') as any);
  vi.spyOn(nextWindow, 'matchMedia').mockImplementation(media('reduce') as any);
  let ticket = 0;
  const frames = new Map<number, FrameRequestCallback>();
  const oldRaf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    frames.set(++ticket, cb);
    return ticket;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((n) => frames.delete(n));
  const nextRaf = vi.spyOn(nextWindow, 'requestAnimationFrame').mockImplementation(() => 777);
  const destinationListeners = vi.spyOn(next, 'addEventListener'),
    oldRemoval = vi.spyOn(document, 'removeEventListener');
  const events: string[] = [];
  const P = definePrototype<TransitionProps>({
    name: `x-presence-adoption-${++id}`,
    setup(def) {
      const transition = asTransition();
      transition.configure({
        enterDuration: 500,
        leaveDuration: 500,
        completion: { kind: 'presentation', timeoutMs: 1000 },
      });
      def.feedback.style.use(tw('bg-background'));
      def.feedback.style.presence({
        owner: transition.presentationOwner,
        closed: { opacity: 0 },
        entered: { opacity: 1 },
        easing: [0.32, 0.72, 0, 1],
      });
    },
  });
  const C = AdaptToWebComponent(P, {
    diagnostics: { onLifecycleEvent: (event) => events.push(event.type) },
  });
  const el = new C();
  setElementProps(el, { open: initialOpen });
  document.body.append(el);
  roots.push(el);
  await flush();
  const phase = () => (el.getExposes() as any).transitionState.get();
  const target = async (open: boolean) => {
    setElementProps(el, { open });
    await flush();
  };
  const adopt = async () => {
    next.body.append(next.adoptNode(el));
    (el as any).adoptedCallback(document, next);
    await flush();
  };
  return {
    el,
    next,
    phase,
    target,
    adopt,
    events,
    frames,
    oldRaf,
    nextRaf,
    destinationListeners,
    oldRemoval,
  };
}
it('real WC adoption retains the instance but retires pending old-document presentation', async () => {
  const f = await fixture();
  await f.target(true);
  expect(f.phase()).toBe('entering');
  const exposes = f.el.getExposes().transitionState;
  const stale = [...f.frames.values()];
  const before = f.events.length;
  await f.adopt();
  expect(f.el.getExposes().transitionState).toBe(exposes);
  expect(f.events.slice(before)).not.toContain('instance.dispose.done');
  expect(f.phase()).toBe('entered');
  expect(f.frames.size).toBe(0);
  expect(f.nextRaf).not.toHaveBeenCalled();
  expect(f.destinationListeners.mock.calls.some(([event]) => event === 'visibilitychange')).toBe(
    true
  );
  expect(f.oldRemoval.mock.calls.some(([event]) => event === 'visibilitychange')).toBe(true);
  for (const cb of stale) cb(999);
  await flush();
  expect(f.phase()).toBe('entered');
  await f.target(false);
  expect(f.phase()).toBe('closed');
  await f.target(true);
  expect(f.phase()).toBe('entered');
});
it('settled open adoption uses destination preference for later leave', async () => {
  const f = await fixture(true);
  expect(f.phase()).toBe('entered');
  await f.adopt();
  f.oldRaf.mockClear();
  await f.target(false);
  expect(f.phase()).toBe('closed');
  expect(f.oldRaf).not.toHaveBeenCalled();
  expect(f.nextRaf).not.toHaveBeenCalled();
});
it('same-document reconnect does not interrupt an active attempt', async () => {
  const f = await fixture();
  await f.target(true);
  const holder = document.createElement('div');
  document.body.append(holder);
  holder.append(f.el);
  (f.el as any).adoptedCallback(document, document);
  await flush();
  expect(f.phase()).toBe('entering');
  expect(f.frames.size).toBeGreaterThan(0);
  expect(f.destinationListeners.mock.calls.some(([event]) => event === 'visibilitychange')).toBe(
    false
  );
});
it('final disposal removes all presentation document observers', async () => {
  const f = await fixture(true);
  await f.adopt();
  const remove = vi.spyOn(f.next, 'removeEventListener');
  f.el.remove();
  await flush();
  expect(f.events).toContain('instance.dispose.done');
  expect(remove.mock.calls.some(([event]) => event === 'visibilitychange')).toBe(true);
  const before = f.nextRaf.mock.calls.length;
  (f.el as any).adoptedCallback(f.next, document);
  expect(f.nextRaf).toHaveBeenCalledTimes(before);
});

it('document retirement precedes existing update work and skips removed listeners', async () => {
  const f = await fixture(true);
  const order: string[] = [];
  const listeners = (f.el as any)._documentChangeListeners as Set<
    (document: Document, phase: string) => void
  >;
  const removed = () => order.push('removed');
  listeners.add((_document, phase) => {
    order.push(phase);
    listeners.delete(removed);
  });
  listeners.add(removed);
  const controller = (f.el as any)._controller;
  const update = controller.update.bind(controller);
  vi.spyOn(controller, 'update').mockImplementation(() => {
    expect(order).toContain('retire');
    order.push('update');
    update();
  });
  const adopted = f.next.adoptNode(f.el);
  (f.el as any).adoptedCallback(document, f.next);
  f.next.body.append(adopted);
  await flush();
  expect(order.indexOf('retire')).toBeLessThan(order.indexOf('update'));
  expect(order).toContain('ready');
  expect(order).not.toContain('removed');
});
it('throwing document listener cannot skip destination metadata and readiness', async () => {
  const f = await fixture(true);
  const phases: string[] = [];
  const listeners = (f.el as any)._documentChangeListeners as Set<
    (document: Document, phase: string) => void
  >;
  listeners.add(() => {
    throw Error('listener failure');
  });
  listeners.add((_document, phase) => phases.push(phase));
  await expect(f.adopt()).resolves.toBeUndefined();
  expect(phases).toEqual(['retire', 'ready']);
  await f.target(false);
  expect(f.phase()).toBe('closed');
});

it('adoption during retained leave completes only the destination epoch', async () => {
  const f = await fixture(true);
  await f.target(false);
  expect(f.phase()).toBe('leaving');
  const stale = [...f.frames.values()];
  await f.adopt();
  expect(f.phase()).toBe('closed');
  expect(f.frames.size).toBe(0);
  for (const callback of stale) callback(999);
  await flush();
  expect(f.phase()).toBe('closed');
  await f.target(true);
  expect(f.phase()).toBe('entered');
});
