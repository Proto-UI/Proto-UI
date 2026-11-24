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
function fixture(scope: 'document' | 'shadow' = 'document') {
  vi.spyOn(window.CSS, 'supports').mockReturnValue(true);
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: query.includes('no-preference'),
        media: query,
        addEventListener() {},
        removeEventListener() {},
      }) as any
  );
  let now = 0,
    ticket = 0,
    height = 1000;
  vi.spyOn(document.documentElement, 'clientHeight', 'get').mockImplementation(() => height);
  vi.spyOn(window.performance, 'now').mockImplementation(() => now);
  const queue = new Map<number, FrameRequestCallback>();
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    queue.set(++ticket, callback);
    return ticket;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    queue.delete(id);
  });
  const wrapper = document.createElement('div');
  document.body.append(wrapper);
  const el = document.createElement('div');
  (scope === 'shadow' ? wrapper.attachShadow({ mode: 'open' }) : wrapper).append(el);
  // The host boundary test supplies ordinary semantic CSS independently of motion.
  Object.assign(el.style, { position: 'fixed', top: '10%', width: '560px', height: '123px' });
  const outcomes: string[] = [];
  const sink = createWebPresencePresentationSink(el, { queueStyle() {}, requestFlush() {} });
  cleanups.push(() => sink.release(1));
  const owner = {} as PresentationOwnerRef;
  const commit = (patch: Partial<PresencePresentationFrame> = {}) => {
    sink.commit({
      view: 1,
      revision: 1,
      targetRevision: 1,
      style: tw('fixed top-[10%]'),
      owner: {
        owner,
        revision: 1,
        phase: 'entering',
        attempt: { ownerEpoch: 1, phaseAttempt: 1 },
        completion: 'presentation',
        durationMs: 300,
        timeoutMs: 1000,
      },
      closed: { top: { px: 0, rootText: 0, containingBlock: -0.25 }, opacity: 0 },
      entered: { top: { px: 0, rootText: 0, containingBlock: 0.1 }, opacity: 1 },
      easing: [0, 0, 1, 1],
      channelEasing: { top: [0, 0, 0.58, 1] },
      bind() {},
      complete(_binding, outcome) {
        outcomes.push(outcome);
      },
      ...patch,
    });
  };
  return {
    el,
    wrapper,
    sink,
    commit,
    outcomes,
    queue,
    step(time: number) {
      now = time;
      const callbacks = [...queue.values()];
      queue.clear();
      for (const callback of callbacks) callback(time);
    },
    resize(value: number) {
      height = value;
      window.dispatchEvent(new Event('resize'));
    },
  };
}
it.each(['document', 'shadow'] as const)(
  'leases actual fixed top independently of opacity and restores semantic CSS in %s',
  (scope) => {
    const f = fixture(scope);
    f.commit();
    expect(f.el.style.top).toBe('-250px');
    expect(f.el.style.opacity).toBe('0');
    f.step(16);
    f.step(166);
    expect(Number.parseFloat(f.el.style.top)).toBeCloseTo(-250 + 350 * 0.684643187, 5);
    expect(Number(f.el.style.opacity)).toBeCloseTo(0.5, 8);
    f.step(316);
    expect(f.outcomes).toEqual(['finished']);
    expect(f.el.style.top).toBe('10%');
    expect(f.el.style.opacity).toBe('');
    expect(f.queue.size).toBe(0);
  }
);
it('does not overwrite a foreign top baseline or partially fade the surface', () => {
  const f = fixture();
  f.el.style.top = '37px';
  const writes = vi.spyOn(f.el.style, 'setProperty');
  f.commit();
  expect(f.el.style.top).toBe('37px');
  expect(f.el.style.opacity).toBe('');
  expect(writes.mock.calls.some(([name]) => name === 'top' || name === 'opacity')).toBe(false);
  expect(f.outcomes).toEqual(['projection-failed']);
});
it('preserves an external top takeover and retires the whole transient presentation', () => {
  const f = fixture();
  f.commit();
  f.el.style.top = '19px';
  f.step(16);
  expect(f.el.style.top).toBe('19px');
  expect(f.el.style.opacity).toBe('');
  expect(f.queue.size).toBe(0);
  expect(f.outcomes).toEqual(['missing-capability']);
});
it.each(['document', 'shadow'] as const)(
  'refuses a transformed ancestor containing block in %s',
  (scope) => {
    const f = fixture(scope);
    f.wrapper.style.transform = 'translateY(1px)';
    f.commit();
    expect(f.el.style.top).toBe('10%');
    expect(f.el.style.opacity).toBe('');
    expect(f.outcomes).toEqual(['missing-capability']);
    expect(f.queue.size).toBe(0);
  }
);
it('restores the percentage baseline against the current viewport after resize', () => {
  const f = fixture();
  f.commit();
  f.step(16);
  f.step(166);
  const displayed = f.el.style.top;
  f.resize(600);
  expect(f.el.style.top).toBe(displayed);
  f.step(466);
  expect(f.outcomes).toEqual(['finished']);
  expect(f.el.style.top).toBe('10%');
});
it('interpolates and releases a real .8 opacity baseline without replacing it with color alpha', () => {
  const f = fixture();
  f.el.style.opacity = '0.8';
  f.commit({
    style: tw('opacity-80'),
    closed: { opacity: 0 },
    entered: { opacity: 0.8 },
    channelEasing: undefined,
  });
  expect(f.el.style.opacity).toBe('0');
  f.step(16);
  f.step(166);
  expect(Number(f.el.style.opacity)).toBeCloseTo(0.4, 8);
  f.step(316);
  expect(f.el.style.opacity).toBe('0.8');
  expect(f.outcomes).toEqual(['finished']);
});
it('keeps a foreign non-neutral opacity baseline before any top write', () => {
  const f = fixture();
  f.el.style.opacity = '.3';
  const foreignOpacity = f.el.style.opacity;
  f.commit();
  expect(f.el.style.opacity).toBe(foreignOpacity);
  expect(f.el.style.top).toBe('10%');
  expect(f.outcomes).toEqual(['projection-failed']);
});

it.each(['top', 'opacity'] as const)(
  'rejects a foreign !important %s rule that keeps the baseline despite an owned inline write',
  (property) => {
    const f = fixture();
    f.el.id = 'presence-important-probe';
    const sheet = document.createElement('style');
    sheet.textContent =
      '#presence-important-probe { ' +
      property +
      ': ' +
      (property === 'top' ? '10%' : '1') +
      ' !important; }';
    document.head.append(sheet);
    cleanups.push(() => sheet.remove());
    const baseline = getComputedStyle(f.el)[property];
    const writes = vi.spyOn(f.el.style, 'setProperty');
    f.commit();
    // The endpoint write was attempted; the cascade never adopted that sample.
    expect(
      writes.mock.calls.some(
        ([name, value]) => name === property && value === (property === 'top' ? '-250px' : '0')
      )
    ).toBe(true);
    expect(f.outcomes).toEqual(['projection-failed']);
    expect(f.queue.size).toBe(0);
    expect(f.el.style.top).toBe('10%');
    expect(f.el.style.opacity).toBe('');
    expect(getComputedStyle(f.el)[property]).toBe(baseline);
  }
);
it.each(['top', 'opacity'] as const)(
  'does not acknowledge %s when the host silently refuses a physical write',
  (property) => {
    const f = fixture();
    const set = f.el.style.setProperty.bind(f.el.style);
    vi.spyOn(f.el.style, 'setProperty').mockImplementation((name, value, priority) => {
      if (name !== property) set(name, value, priority);
    });
    f.commit();
    expect(f.outcomes).toEqual(['projection-failed']);
    expect(f.queue.size).toBe(0);
    expect(f.el.style.top).toBe('10%');
    expect(f.el.style.opacity).toBe('');
  }
);

it.each([
  ['document', false],
  ['shadow', false],
  ['document', true],
  ['shadow', true],
] as const)(
  'defers top profile reads during portal preparation, then rechecks %s support (transformed=%s)',
  (scope, transformed) => {
    vi.spyOn(window.CSS, 'supports').mockReturnValue(true);
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query.includes('no-preference'),
          media: query,
          addEventListener() {},
          removeEventListener() {},
        }) as MediaQueryList
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
    if (transformed) wrapper.style.transform = 'translateY(1px)';
    const el = document.createElement('div');
    (scope === 'shadow' ? wrapper.attachShadow({ mode: 'open' }) : wrapper).append(el);
    document.body.append(wrapper);
    Object.assign(el.style, { position: 'fixed', top: '10px', width: '50px', height: '40px' });
    const original = window.getComputedStyle.bind(window);
    let targetReads = 0;
    let ancestorReads = 0;
    // Observe the actual host values; neither geometry nor CSS is substituted.
    vi.spyOn(window, 'getComputedStyle').mockImplementation((target, pseudo) => {
      const result = original(target, pseudo);
      if (target === el) targetReads++;
      if (target === wrapper || target === document.body) ancestorReads++;
      return result;
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
    expect(targetReads).toBe(0);
    expect(ancestorReads).toBe(0);
    expect(viewportReads).not.toHaveBeenCalled();
    expect(el.style.top).toBe('10px');
    expect(el.style.opacity).toBe('');
    expect(outcomes).toEqual([]);
    expect(queue.size).toBe(0);

    wrapper.removeAttribute(PUI_PORTAL_PREPARING_ATTR);
    // The same retained view, owner, attempt and target must recheck actual readiness.
    sink.commit({ ...frame, revision: 2 });
    expect(targetReads).toBeGreaterThan(0);
    expect(ancestorReads).toBeGreaterThan(0);
    if (transformed) {
      expect(outcomes).toEqual(['missing-capability']);
      expect(el.style.top).toBe('10px');
      expect(el.style.opacity).toBe('');
      expect(queue.size).toBe(0);
    } else {
      expect(viewportReads).toHaveBeenCalled();
      expect(outcomes).toEqual([]);
      expect(el.style.top).toBe('-25px');
      expect(el.style.opacity).toBe('0');
      expect(queue.size).toBe(1);
    }
  }
);
