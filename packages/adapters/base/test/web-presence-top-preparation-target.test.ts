import { afterEach, expect, it, vi } from 'vitest';
import { tw, type PresentationOwnerRef } from '@proto.ui/core';
import type { PresencePresentationFrame } from '@proto.ui/module-feedback';
import { createWebPresencePresentationSink } from '../src/motion/web-presence-presentation';
import { PUI_PORTAL_PREPARING_ATTR } from '../src/host/view-visibility';

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

it.each(['document', 'shadow'] as const)(
  'keeps finished semantics for a completed current attempt with a new preparing target in %s',
  (scope) => {
    vi.spyOn(window.CSS, 'supports').mockReturnValue(true);
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string): MediaQueryList => ({
        matches: query.includes(': no-preference'),
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() {
          return true;
        },
      })
    );
    let now = 0,
      ticket = 0;
    const queue = new Map<number, FrameRequestCallback>();
    vi.spyOn(window.performance, 'now').mockImplementation(() => now);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      queue.set(++ticket, callback);
      return ticket;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      queue.delete(id);
    });
    const step = (time: number) => {
      now = time;
      const callbacks = [...queue.values()];
      queue.clear();
      for (const callback of callbacks) callback(time);
    };
    const wrapper = document.createElement('div');
    const el = document.createElement('div');
    (scope === 'shadow' ? wrapper.attachShadow({ mode: 'open' }) : wrapper).append(el);
    document.body.append(wrapper);
    Object.assign(el.style, { position: 'fixed', top: '10px', width: '50px', height: '40px' });
    const outcomes: string[] = [];
    const sink = createWebPresencePresentationSink(el, { queueStyle() {}, requestFlush() {} });
    cleanups.push(() => sink.release(1));
    const frame: PresencePresentationFrame = {
      view: 1,
      revision: 1,
      targetRevision: 1,
      style: tw('fixed top-[10px]'),
      owner: {
        owner: Object.freeze({}) as PresentationOwnerRef,
        revision: 1,
        phase: 'entering',
        attempt: { ownerEpoch: 1, phaseAttempt: 1 },
        completion: 'presentation',
        durationMs: 300,
        timeoutMs: 1000,
      },
      closed: { top: { px: -25, rootText: 0, containingBlock: 0 }, opacity: 0 },
      entered: { top: { px: 10, rootText: 0, containingBlock: 0 }, opacity: 1 },
      easing: [0, 0, 1, 1],
      bind() {},
      complete(_binding, outcome) {
        outcomes.push(outcome);
      },
    };
    sink.commit(frame);
    step(16);
    step(316);
    expect(outcomes).toEqual(['finished']);
    expect(queue.size).toBe(0);
    wrapper.setAttribute(PUI_PORTAL_PREPARING_ATTR, '');
    wrapper.style.transform = 'translateY(1px)';
    const original = window.getComputedStyle.bind(window);
    let targetReads = 0,
      ancestorReads = 0;
    vi.spyOn(window, 'getComputedStyle').mockImplementation((target, pseudo) => {
      const value = original(target, pseudo);
      if (target === el) targetReads++;
      if (target === wrapper || target === document.body) ancestorReads++;
      return value;
    });
    const writes = vi.spyOn(el.style, 'setProperty');
    sink.commit({
      ...frame,
      revision: 2,
      targetRevision: 2,
      closed: { top: { px: -30, rootText: 0, containingBlock: 0 }, opacity: 0 },
    });
    expect(targetReads).toBe(0);
    expect(ancestorReads).toBe(0);
    expect(writes.mock.calls.some(([name]) => name === 'top' || name === 'opacity')).toBe(false);
    expect(el.style.top).toBe('10px');
    expect(el.style.opacity).toBe('');
    expect(queue.size).toBe(0);
    expect(outcomes).toEqual(['finished', 'finished']);
  }
);
