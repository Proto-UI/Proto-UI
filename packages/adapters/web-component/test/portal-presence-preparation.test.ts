import { afterEach, expect, it, vi } from 'vitest';
import { tw, type PresentationOwnerRef } from '@proto.ui/core';
import { createWebPresencePresentationSink } from '@proto.ui/adapter-base';
import type { PresencePresentationFrame } from '@proto.ui/module-feedback';
import {
  beginWebComponentPortalViewAcquisition,
  createWebComponentPortalMount,
} from '../src/portal-mount';
import { PUI_PORTAL_PREPARING_ATTR } from '../src/host-display';

const zero = { px: 0, rootText: 0, ownBox: 0 };
const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function fixture(scope: 'document' | 'shadow' = 'document') {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  vi.spyOn(window.CSS, 'supports').mockReturnValue(true);
  let preference: 'no-preference' | 'reduce' | 'unknown' = 'no-preference';
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        get matches() {
          return preference !== 'unknown' && query.includes(`: ${preference})`);
        },
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent: () => true,
      }) as MediaQueryList
  );
  let now = 0;
  let serial = 0;
  const frames = new Map<number, FrameRequestCallback>();
  vi.spyOn(window.performance, 'now').mockImplementation(() => now);
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.set(++serial, callback);
    return serial;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((ticket) => frames.delete(ticket));
  const resizeCallbacks = new Set<ResizeObserverCallback>();
  vi.spyOn(window, 'ResizeObserver').mockImplementation(function (callback) {
    resizeCallbacks.add(callback);
    return {
      observe() {},
      unobserve() {},
      disconnect() {
        resizeCallbacks.delete(callback);
      },
    };
  });
  const origin = document.createElement('section');
  const host = document.createElement('div');
  origin.append(host);
  document.body.append(origin);
  const surface = scope === 'shadow' ? document.createElement('div') : host;
  if (surface !== host) host.attachShadow({ mode: 'open' }).append(surface);
  Object.assign(surface.style, { width: '320px', height: '200px', boxSizing: 'border-box' });
  let missingOutsidePreparation = false;
  let preparedGeometryReads = 0;
  const computedStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
    const style = computedStyle(element, pseudo);
    if (element !== surface) return style;
    // Inject only the native receipt's computed geometry: display suppression
    // yielded auto, not a usable reference box. The real portal owns its marker
    // and two-frame lifetime; this DOM model does not claim layout or paint.
    return new Proxy(style, {
      get(target, property) {
        if (
          (property === 'width' || property === 'height') &&
          (host.hasAttribute(PUI_PORTAL_PREPARING_ATTR) || missingOutsidePreparation)
        ) {
          if (host.hasAttribute(PUI_PORTAL_PREPARING_ATTR)) preparedGeometryReads++;
          return 'auto';
        }
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  });
  const portal = createWebComponentPortalMount();
  const effects = { queueStyle: vi.fn(), requestFlush: vi.fn() };
  const sink = createWebPresencePresentationSink(surface, effects);
  cleanups.push(() => {
    sink.release(1);
    portal.unmount(host);
  });
  const owner = Object.freeze({}) as PresentationOwnerRef;
  const results: Array<{ attempt: number; outcome: string }> = [];
  const bindings: unknown[] = [];
  let revision = 0;
  const commit = (attempt = 1, durationMs = 500) => {
    const next: PresencePresentationFrame = {
      view: 1,
      revision: ++revision,
      targetRevision: 1,
      style: tw('bg-background'),
      owner: {
        owner,
        revision,
        phase: 'entering',
        attempt: { ownerEpoch: 1, phaseAttempt: attempt },
        completion: 'presentation',
        durationMs,
        timeoutMs: 1000,
      },
      closed: { translate: [zero, { ...zero, ownBox: 1 }], opacity: 0 },
      entered: { translate: [zero, zero], opacity: 1 },
      easing: [0.32, 0.72, 0, 1],
      bind: (binding) => bindings.push(binding),
      complete: (_binding, outcome) => results.push({ attempt, outcome }),
    };
    sink.commit(next);
    return next;
  };
  const begin = () => {
    // The acquisition is deliberately controlled. Separate existing tests use
    // actual Runtime epochs to prove reentry and retained-view acquisition.
    const releaseAcquisition = beginWebComponentPortalViewAcquisition(host);
    portal.mount(host);
    releaseAcquisition();
    expect(host.hasAttribute(PUI_PORTAL_PREPARING_ATTR)).toBe(true);
  };
  const flushMutations = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
  const frame = async (time: number) => {
    now = time;
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) callback(time);
    await flushMutations();
  };
  return {
    surface,
    host,
    portal,
    sink,
    effects,
    frames,
    results,
    bindings,
    commit,
    begin,
    frame,
    resize: () => {
      for (const callback of resizeCallbacks) callback([], {} as ResizeObserver);
    },
    preparedGeometryReads: () => preparedGeometryReads,
    missing: () => {
      missingOutsidePreparation = true;
    },
    preference: (next: typeof preference) => {
      preference = next;
    },
  };
}

it.each(['document', 'shadow'] as const)(
  'keeps a cold attempt pending across real portal preparation in %s',
  async (scope) => {
    const f = fixture(scope);
    f.commit();
    expect(f.surface.style.getPropertyValue('translate')).toContain('200px');
    f.begin();
    f.resize();
    await f.frame(16);
    expect(f.results).toEqual([]);
    expect(f.preparedGeometryReads()).toBe(0);
    expect(f.host.hasAttribute(PUI_PORTAL_PREPARING_ATTR)).toBe(true);
    await f.frame(32);
    expect(f.host.hasAttribute(PUI_PORTAL_PREPARING_ATTR)).toBe(false);
    expect(f.results).toEqual([]);
    await f.frame(48);
    expect(f.surface.style.getPropertyValue('translate')).toContain('200px');
    await f.frame(548);
    expect(f.results).toEqual([{ attempt: 1, outcome: 'finished' }]);
    expect(f.frames.size).toBe(0);
  }
);

it('accepts semantic style and the latest binding while preparation withholds geometry', async () => {
  const f = fixture();
  f.begin();
  const first = f.commit(1);
  const latest = f.commit(2);
  expect(f.effects.queueStyle).toHaveBeenCalledWith(first.style);
  expect(f.effects.queueStyle).toHaveBeenCalledWith(latest.style);
  expect(f.bindings).toHaveLength(2);
  expect(f.preparedGeometryReads()).toBe(0);
  expect(f.results).toEqual([]);
  await f.frame(16);
  await f.frame(32);
  await f.frame(48);
  await f.frame(548);
  expect(f.results).toEqual([{ attempt: 2, outcome: 'finished' }]);
});

it('settles the independent deadline before preparation releases and never replays it', async () => {
  const f = fixture();
  f.begin();
  f.commit();
  expect(f.results).toEqual([]);
  expect(f.sink.settle('deadline')).toBe(true);
  expect(f.results).toEqual([{ attempt: 1, outcome: 'deadline' }]);
  expect(f.host.hasAttribute(PUI_PORTAL_PREPARING_ATTR)).toBe(true);
  await f.frame(16);
  await f.frame(32);
  await f.frame(1000);
  expect(f.results).toEqual([{ attempt: 1, outcome: 'deadline' }]);
  expect(f.frames.size).toBe(0);
});

it.each(['cancel', 'release'] as const)(
  '%s during preparation invalidates pending frame delivery and later readiness',
  async (operation) => {
    const f = fixture();
    f.commit();
    const stale = [...f.frames.values()][0]!;
    f.begin();
    if (operation === 'release') f.sink.release(1);
    else f.sink.cancel();
    stale(16);
    await f.frame(16);
    await f.frame(32);
    await f.frame(548);
    expect(f.results).toEqual([]);
    expect(f.surface.style.getPropertyValue('translate')).toBe('');
    expect(f.surface.style.opacity).toBe('');
    expect(f.frames.size).toBe(0);
  }
);

it('still diagnoses unresolved units outside an owned preparation barrier', () => {
  const f = fixture();
  f.missing();
  f.commit();
  expect(f.results).toEqual([{ attempt: 1, outcome: 'unresolved-units' }]);
  expect(f.frames.size).toBe(0);
});

it('does not defer invalid policy or zero duration behind preparation', () => {
  const f = fixture();
  f.begin();
  f.commit(1, 1000);
  expect(f.results).toEqual([{ attempt: 1, outcome: 'invalid-policy' }]);
  f.commit(2, 0);
  // The original missing-unit outcome stays immediate, including when a zero
  // duration does not need an animation frame. Preparation grants no fallback.
  expect(f.results.at(-1)).toEqual({ attempt: 2, outcome: 'unresolved-units' });
});

it('does not withhold a retained portal view under the separate theme reveal guard', async () => {
  const f = fixture();
  f.portal.mount(f.host);
  expect(f.host.getAttribute('data-pui-view-revealing')).toBe('portal');
  expect(f.host.hasAttribute(PUI_PORTAL_PREPARING_ATTR)).toBe(false);
  f.commit();
  expect(f.surface.style.getPropertyValue('translate')).toContain('200px');
  await f.frame(16);
  await f.frame(516);
  expect(f.results).toEqual([{ attempt: 1, outcome: 'finished' }]);
});

it.each([
  ['reduce', 'reduced-motion'],
  ['unknown', 'unknown-preference'],
  ['hidden', 'hidden'],
  ['lost-opacity', 'projection-failed'],
] as const)(
  'settles %s during preparation without delivering any portal frame',
  async (cause, outcome) => {
    const f = fixture();
    f.commit();
    f.begin();
    if (cause === 'hidden') f.host.hidden = true;
    else if (cause === 'lost-opacity') f.surface.style.opacity = '.4';
    else f.preference(cause);
    f.resize();
    expect(f.results).toEqual([{ attempt: 1, outcome }]);
    expect(f.host.hasAttribute(PUI_PORTAL_PREPARING_ATTR)).toBe(true);
    // Only the existing portal reveal barrier remains queued, not presentation.
    expect(f.frames.size).toBe(1);
    await f.frame(16);
    await f.frame(32);
    await f.frame(548);
    expect(f.results).toEqual([{ attempt: 1, outcome }]);
    if (cause === 'lost-opacity') expect(f.surface.style.opacity).toBe('.4');
  }
);

it.each([
  ['reduce', 'reduced-motion'],
  ['unknown', 'unknown-preference'],
] as const)(
  'settles an initial nonzero %s owner while the portal is still preparing',
  (preference, outcome) => {
    const f = fixture();
    f.begin();
    f.preference(preference);
    f.commit();
    expect(f.results).toEqual([{ attempt: 1, outcome }]);
    expect(f.host.hasAttribute(PUI_PORTAL_PREPARING_ATTR)).toBe(true);
    expect(f.frames.size).toBe(1);
  }
);
