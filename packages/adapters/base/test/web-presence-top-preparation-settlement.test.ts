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

it.each(
  (['document', 'shadow'] as const).flatMap((scope) =>
    (['reduce', 'hidden', 'deadline', 'zero-duration'] as const).map((trigger) => ({
      scope,
      trigger,
    }))
  )
)(
  'settles $trigger during $scope preparation without claiming an unmeasured top profile',
  ({ scope, trigger }) => {
    vi.spyOn(window.CSS, 'supports').mockReturnValue(true);
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string): MediaQueryList => ({
        matches: query.includes(trigger === 'reduce' ? ': reduce' : ': no-preference'),
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
    const queue = new Map<number, FrameRequestCallback>();
    let ticket = 0;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      queue.set(++ticket, callback);
      return ticket;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      queue.delete(id);
    });
    const wrapper = document.createElement('div');
    wrapper.setAttribute(PUI_PORTAL_PREPARING_ATTR, '');
    // This actual ancestor profile must not be provisionally accepted as fixed-to-viewport.
    wrapper.style.transform = 'translateY(1px)';
    if (trigger === 'hidden') wrapper.hidden = true;
    const el = document.createElement('div');
    (scope === 'shadow' ? wrapper.attachShadow({ mode: 'open' }) : wrapper).append(el);
    document.body.append(wrapper);
    Object.assign(el.style, { position: 'fixed', top: '10px', width: '50px', height: '40px' });
    const original = window.getComputedStyle.bind(window);
    let targetReads = 0;
    let ancestorReads = 0;
    vi.spyOn(window, 'getComputedStyle').mockImplementation((target, pseudo) => {
      const value = original(target, pseudo);
      if (target === el) targetReads++;
      if (target === wrapper || target === document.body) ancestorReads++;
      return value;
    });
    let prototype: object | null = Object.getPrototypeOf(document.documentElement);
    let clientHeight: ((this: Element) => number) | undefined;
    while (prototype && !clientHeight) {
      clientHeight = Object.getOwnPropertyDescriptor(prototype, 'clientHeight')?.get;
      prototype = Object.getPrototypeOf(prototype);
    }
    if (!clientHeight) throw new Error('Missing original clientHeight accessor');
    const readClientHeight = clientHeight;
    const viewportReads = vi
      .spyOn(document.documentElement, 'clientHeight', 'get')
      .mockImplementation(() => readClientHeight.call(document.documentElement));
    const writes = vi.spyOn(el.style, 'setProperty');
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
        durationMs: trigger === 'zero-duration' ? 0 : 300,
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
    if (trigger === 'deadline') {
      expect(outcomes).toEqual([]);
      expect(sink.settle('deadline')).toBe(true);
    }
    expect(targetReads).toBe(0);
    expect(ancestorReads).toBe(0);
    expect(viewportReads).not.toHaveBeenCalled();
    expect(writes.mock.calls.some(([name]) => name === 'top' || name === 'opacity')).toBe(false);
    expect(el.style.top).toBe('10px');
    expect(el.style.opacity).toBe('');
    expect(queue.size).toBe(0);
    expect(outcomes).toEqual([trigger === 'reduce' ? 'reduced-motion' : trigger]);
    // Later readiness cannot replay a settled attempt or promote the unsupported profile.
    wrapper.removeAttribute(PUI_PORTAL_PREPARING_ATTR);
    sink.commit({ ...frame, revision: 2 });
    expect(outcomes).toHaveLength(1);
    expect(queue.size).toBe(0);
    expect(targetReads).toBe(0);
  }
);
