import { afterEach, expect, it, vi } from 'vitest';
import { tw, type PresentationOwnerRef } from '@proto.ui/core';
import { acquireWebTranslation } from '@proto.ui/module-positioning';
import { createWebPresencePresentationSink } from '../src/motion/web-presence-presentation';
import { PUI_PORTAL_PREPARING_ATTR } from '../src/host/view-visibility';
import type { PresencePresentationFrame } from '@proto.ui/module-feedback';
const zero = { px: 0, rootText: 0, ownBox: 0 };
const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const off of cleanups.splice(0)) off();
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
    ticket = 0;
  const frames = new Map<number, FrameRequestCallback>();
  vi.spyOn(window.performance, 'now').mockImplementation(() => now);
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    frames.set(++ticket, cb);
    return ticket;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id);
  });
  const wrapper = document.createElement('div');
  document.body.append(wrapper);
  const el = document.createElement('div');
  (scope === 'shadow' ? wrapper.attachShadow({ mode: 'open' }) : wrapper).append(el);
  Object.assign(el.style, { width: '320px', height: '200px', boxSizing: 'border-box' });
  const results: string[] = [];
  const sink = createWebPresencePresentationSink(el, { queueStyle() {}, requestFlush() {} });
  cleanups.push(() => sink.release(1));
  let revision = 0;
  const owner = Object.freeze({}) as PresentationOwnerRef;
  const commit = (phase: 'entering' | 'entered' | 'leaving' = 'entering') =>
    sink.commit({
      view: 1,
      targetRevision: 1,
      revision: ++revision,
      style: tw('bg-background'),
      owner: {
        owner,
        revision,
        phase,
        attempt: phase === 'entered' ? null : { ownerEpoch: 1, phaseAttempt: revision },
        completion: 'presentation',
        durationMs: 500,
        timeoutMs: 1000,
      },
      closed: { translate: [zero, { ...zero, ownBox: 1 }], opacity: 0 },
      entered: { translate: [zero, zero], opacity: 1 },
      easing: [0.32, 0.72, 0, 1],
      bind() {},
      complete: (_, outcome) => results.push(outcome),
    });
  const frame = (time: number) => {
    now = time;
    const pending = [...frames.values()];
    frames.clear();
    for (const cb of pending) cb(time);
  };
  return { el, sink, commit, frame, frames, results };
}
it.each(['document', 'shadow'] as const)(
  'composes live layout displacement and releases settled presence leases in %s',
  (scope) => {
    const f = fixture(scope);
    const layout = acquireWebTranslation(f.el, 'layout');
    cleanups.push(() => layout.release());
    expect(layout.set([zero, { ...zero, ownBox: -1 }])).toBe(true);
    f.commit();
    expect(f.el.style.getPropertyValue('translate')).toContain('-100%');
    expect(f.el.style.getPropertyValue('translate')).toContain('200px');
    expect(f.el.style.opacity).toBe('0');
    layout.set([zero, { ...zero, ownBox: -0.6 }]);
    expect(f.el.style.getPropertyValue('translate')).toContain('-60%');
    expect(f.el.style.getPropertyValue('translate')).toContain('200px');
    f.frame(16);
    f.frame(516);
    expect(f.results).toEqual(['finished']);
    expect(f.el.style.getPropertyValue('translate')).toBe('0px -60%');
    expect(f.el.style.opacity).toBe('');
    f.commit('entered');
    expect(f.el.style.getPropertyValue('translate')).toBe('0px -60%');
    expect(f.el.style.opacity).toBe('');
    expect(f.frames.size).toBe(0);
  }
);
it('rejects a nonadmitted opacity owner before any transient translation write', () => {
  const f = fixture();
  f.el.style.opacity = '.4';
  const writes = vi.spyOn(f.el.style, 'setProperty');
  f.commit();
  expect(f.el.style.opacity).toBe('.4');
  expect(f.el.style.getPropertyValue('translate')).toBe('');
  expect(writes.mock.calls.some(([name]) => name === 'translate')).toBe(false);
  expect(f.results).toEqual(['projection-failed']);
  expect(f.frames.size).toBe(0);
});
it('preserves external translation takeover and ends the current attempt', () => {
  const f = fixture();
  f.commit();
  f.el.style.setProperty('translate', '17px 19px');
  f.frame(16);
  expect(f.el.style.getPropertyValue('translate')).toBe('17px 19px');
  expect(f.results).toEqual(['projection-failed']);
  expect(f.frames.size).toBe(0);
});

function observePreparation(preparing: boolean, channel: 'blockSize' | 'opacity') {
  const f = fixture();
  if (preparing) f.el.parentElement!.setAttribute(PUI_PORTAL_PREPARING_ATTR, '');
  const original = window.getComputedStyle.bind(window);
  let targetReads = 0;
  // Observe real host reads without substituting a geometry or style result.
  vi.spyOn(window, 'getComputedStyle').mockImplementation((target, pseudo) => {
    const result = original(target, pseudo);
    if (target === f.el) targetReads++;
    return result;
  });
  const frame: PresencePresentationFrame = {
    view: 1,
    revision: 1,
    targetRevision: 1,
    style: tw('block'),
    owner: {
      owner: Object.freeze({}) as PresentationOwnerRef,
      revision: 1,
      phase: 'entering',
      attempt: { ownerEpoch: 1, phaseAttempt: 1 },
      completion: 'presentation',
      durationMs: 350,
      timeoutMs: 1000,
    },
    closed: channel === 'blockSize' ? { blockSize: 0 } : { opacity: 0 },
    entered: channel === 'blockSize' ? { blockSize: 'intrinsic' } : { opacity: 1 },
    easing: [0.25, 0.1, 0.25, 1],
    bind() {},
    complete: (_, outcome) => f.results.push(outcome),
  };
  f.sink.commit(frame);
  return { ...f, targetReads };
}

it.each(['opacity', 'blockSize'] as const)(
  'withholds actual target measurements and presentation writes for %s during portal preparation',
  (channel) => {
    const f = observePreparation(true, channel);
    expect(f.targetReads).toBe(0);
    expect(f.results).toEqual([]);
    expect(f.frames.size).toBe(0);
    expect(f.el.style.getPropertyValue('block-size')).toBe('');
  }
);

it('reads the actual ready target before starting intrinsic block-size presentation', () => {
  const f = observePreparation(false, 'blockSize');
  expect(f.targetReads).toBeGreaterThan(0);
  expect(f.el.style.getPropertyValue('block-size')).toBe('0px');
  expect(f.frames.size).toBe(1);
  expect(f.results).toEqual([]);
});
