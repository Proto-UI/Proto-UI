import { afterEach, describe, expect, it, vi } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { AdaptToWebComponent } from '@proto.ui/adapter-web-component';
import { createRuntimeSession } from '@proto.ui/runtime';
import { EXPOSE_STATE_SET_EXPOSES_CAP } from '@proto.ui/module-expose-state';
import {
  asMessageScrollerReading,
  asMessageScrollerViewport,
  captureMessageReadingAnchor,
  messageScrollerRoot,
  messageSelectionRestoreEligible,
  planMessageReadingRestore,
  resolveMessageReadingAnchor,
  sameMessageReadingSelection,
  type MessageReadingAnchor,
  type MessageReadingFrame,
  type MessageReadingInput,
  type MessageReadingMode,
  type MessageReadingSelection,
  type MessageReadingSelectionFacts,
} from '../src/message-scroller';

// P-BASE-MESSAGE-SCROLLER: these are opaque host facts, not DOM message models.
const saved: MessageReadingAnchor = {
  key: 'message-b',
  previousKey: 'message-a',
  index: 1,
  offset: -12,
  scrollOffset: 100,
};
const selection: MessageReadingSelection = {
  key: 'message-b',
  start: 2,
  end: 6,
  prefixHash: 'host-fingerprint',
};
function frame(patch: Partial<MessageReadingFrame> = {}): MessageReadingFrame {
  return {
    epoch: 1,
    scrollOffset: 100,
    viewportSize: 100,
    entries: [
      { key: 'message-a', start: -60, end: -10, primary: true },
      { key: 'message-b', start: -10, end: 30, primary: false },
      { key: 'message-c', start: 30, end: 80, primary: true },
      { key: 'message-d', start: 100, end: 150, primary: true },
    ],
    ...patch,
  };
}
function selectionFacts(
  patch: Partial<MessageReadingSelectionFacts> = {}
): MessageReadingSelectionFacts {
  return {
    epoch: 1,
    record: selection,
    currentKey: 'message-b',
    textLength: 10,
    prefixMatches: true,
    selectionAvailable: true,
    collapsed: true,
    endpointsAvailable: true,
    ...patch,
  };
}
function readerInput(patch: Partial<MessageReadingInput> = {}): MessageReadingInput {
  return {
    kind: 'wheel',
    interactive: false,
    inside: true,
    active: true,
    selection: null,
    ...patch,
  };
}

describe('MessageScroller finite-data reading criteria', () => {
  it('distinguishes first crossing from visible primary preference and the bottom boundary', () => {
    expect(
      captureMessageReadingAnchor(frame(), {
        capture: 'first-crossing',
        inset: 0,
        predecessor: true,
      })
    ).toEqual({ ...saved, offset: -10 });
    expect(
      captureMessageReadingAnchor(frame(), {
        capture: 'visible-preferred',
        inset: 0,
        predecessor: true,
      })
    ).toMatchObject({ key: 'message-c', previousKey: 'message-b', index: 2, offset: 30 });
    const below = frame({ entries: [frame().entries[3]!] });
    expect(
      captureMessageReadingAnchor(below, {
        capture: 'first-crossing',
        inset: 0,
        predecessor: true,
      }).key
    ).toBe('message-d');
    expect(
      captureMessageReadingAnchor(below, {
        capture: 'visible-preferred',
        inset: 0,
        predecessor: true,
      })
    ).toEqual({ key: '', previousKey: '', index: -1, offset: 0, scrollOffset: 100 });
  });

  it('uses the authored inset and falls back to the first visible non-primary entry', () => {
    const entries = frame().entries.map((entry) => ({ ...entry, primary: false }));
    expect(
      captureMessageReadingAnchor(frame({ entries }), {
        capture: 'visible-preferred',
        inset: 30,
        predecessor: true,
      }).key
    ).toBe('message-c');
  });

  it('never lets a negative inset make an offscreen primary win visible-preferred capture', () => {
    const value = frame({
      entries: [
        { key: 'above-only', start: -30, end: -10, primary: true },
        { key: 'visible', start: 0, end: 30, primary: false },
      ],
    });
    expect(
      captureMessageReadingAnchor(value, {
        capture: 'first-crossing',
        inset: -20,
        predecessor: true,
      }).key
    ).toBe('above-only');
    expect(
      captureMessageReadingAnchor(value, {
        capture: 'visible-preferred',
        inset: -20,
        predecessor: true,
      }).key
    ).toBe('visible');
  });

  it('keeps the first visible primary instead of a later visible primary', () => {
    const value = frame({
      entries: [
        { key: 'fallback', start: 0, end: 10, primary: false },
        { key: 'first-primary', start: 10, end: 20, primary: true },
        { key: 'second-primary', start: 20, end: 30, primary: true },
      ],
    });
    expect(
      captureMessageReadingAnchor(value, {
        capture: 'visible-preferred',
        inset: 0,
        predecessor: true,
      }).key
    ).toBe('first-primary');
  });

  it.each([
    ['partially visible above', -30, 10, 'candidate'],
    ['ends at the top boundary', -30, 0, 'fallback'],
    ['starts at the bottom boundary', 100, 130, 'fallback'],
  ] as const)('checks visible intersection when an entry %s', (_reason, start, end, expected) => {
    const value = frame({
      entries: [
        { key: 'candidate', start, end, primary: true },
        { key: 'fallback', start: 10, end: 30, primary: false },
      ],
    });
    expect(
      captureMessageReadingAnchor(value, {
        capture: 'visible-preferred',
        inset: -40,
        predecessor: true,
      }).key
    ).toBe(expected);
  });

  it('captures no visible entry in an empty viewport while preserving first-crossing policy', () => {
    const value = frame({
      viewportSize: 0,
      entries: [{ key: 'crosses-top', start: -10, end: 10, primary: true }],
    });
    expect(
      captureMessageReadingAnchor(value, {
        capture: 'visible-preferred',
        inset: 0,
        predecessor: true,
      })
    ).toEqual({ key: '', previousKey: '', index: -1, offset: 0, scrollOffset: 100 });
    expect(
      captureMessageReadingAnchor(value, {
        capture: 'first-crossing',
        inset: 0,
        predecessor: true,
      }).key
    ).toBe('crosses-top');
  });

  it('restores exact identity before predecessor and never invents a key from saved index', () => {
    const reordered = frame({ entries: [...frame().entries].reverse(), scrollOffset: 150 });
    expect(resolveMessageReadingAnchor(saved, ['message-b', 'message-a'], true)).toEqual({
      key: 'message-b',
      index: 0,
    });
    expect(planMessageReadingRestore(saved, reordered, true)).toEqual({
      kind: 'by',
      match: 'exact',
      delta: 2,
    });
    const predecessor = frame({
      entries: [{ key: 'message-a', start: 8, end: 40, primary: true }],
      scrollOffset: 150,
    });
    expect(planMessageReadingRestore(saved, predecessor, true)).toEqual({
      kind: 'by',
      match: 'previous',
      delta: 20,
    });
    expect(planMessageReadingRestore(saved, predecessor, false)).toEqual({
      kind: 'by',
      match: 'offset',
      delta: -50,
    });
    expect(resolveMessageReadingAnchor(saved, ['replacement-a', 'replacement-b'], true)).toBeNull();
    expect(planMessageReadingRestore(null, reordered, true)).toEqual({
      kind: 'none',
      match: 'none',
      delta: 0,
    });
  });

  it.each<[string, Partial<MessageReadingSelectionFacts>]>([
    ['missing record', { record: null }],
    ['empty identity', { record: { ...selection, key: '' }, currentKey: '' }],
    ['different current entry', { currentKey: 'other-message' }],
    ['negative start', { record: { ...selection, start: -1 } }],
    ['empty range', { record: { ...selection, end: selection.start } }],
    ['short current text', { textLength: selection.end - 1 }],
    ['changed text prefix', { prefixMatches: false }],
    ['missing selection capability', { selectionAvailable: false }],
    ['user already has a selection', { collapsed: false }],
    ['missing endpoints', { endpointsAvailable: false }],
  ])('refuses selection restoration with %s', (_reason, patch) => {
    expect(messageSelectionRestoreEligible(selectionFacts())).toBe(true);
    expect(messageSelectionRestoreEligible(selectionFacts(patch))).toBe(false);
  });

  it('deduplicates complete selection identity, including changed content fingerprints', () => {
    expect(sameMessageReadingSelection(selection, { ...selection })).toBe(true);
    for (const changed of [
      null,
      { ...selection, key: 'other-message' },
      { ...selection, start: 1 },
      { ...selection, end: 7 },
      { ...selection, prefixHash: 'new-content' },
    ]) {
      expect(sameMessageReadingSelection(selection, changed)).toBe(false);
    }
  });
});

type ReadingApi = {
  readingMode: { get(): MessageReadingMode };
  restoringReading: { get(): boolean };
  scrollYVisibleRatio: { get(): number };
  getReadingEpoch(): number;
  beginReading(following: boolean, anchor: MessageReadingAnchor | null): void;
  resumeReading(): void;
  readingInput(input: MessageReadingInput, value: MessageReadingFrame | null): void;
  captureReading(value: MessageReadingFrame): MessageReadingAnchor | null;
  restoreReading(value: MessageReadingFrame): number;
  commitReadingRestore(ticket: number, value: MessageReadingFrame): void;
  observeReadingScroll(value: MessageReadingFrame): void;
  readingAnchorForPersistence(value: MessageReadingFrame): MessageReadingAnchor | null;
  planSelectionRestore(facts: MessageReadingSelectionFacts): number;
  commitSelectionRestore(ticket: number): void;
};
type ReadingElement = HTMLElement & { getExposes(): ReadingApi };
AdaptToWebComponent(messageScrollerRoot, { registerAs: 'reading-contract-root' });
AdaptToWebComponent(
  definePrototype({
    name: 'reading-contract-viewport',
    setup() {
      asMessageScrollerViewport();
      asMessageScrollerReading();
    },
  })
);

async function microtasks() {
  for (let n = 0; n < 30; n++) await Promise.resolve();
}
async function fixture() {
  let nextFrame = 0;
  const frames = new Map<number, FrameRequestCallback>();
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id);
  });
  const pump = async () => {
    await microtasks();
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) callback(performance.now());
    await microtasks();
  };
  const root = document.createElement('reading-contract-root');
  const viewport = document.createElement('reading-contract-viewport') as ReadingElement;
  const metrics = { scrollHeight: 400 };
  Object.defineProperties(viewport, {
    clientWidth: { configurable: true, get: () => 100 },
    scrollWidth: { configurable: true, get: () => 100 },
    clientHeight: { configurable: true, get: () => 100 },
    scrollHeight: { configurable: true, get: () => metrics.scrollHeight },
    scrollTop: { configurable: true, value: 0, writable: true },
    scrollLeft: { configurable: true, value: 0, writable: true },
  });
  viewport.append(document.createElement('div'));
  root.append(viewport);
  document.body.append(root);
  await pump();
  window.dispatchEvent(new Event('resize'));
  await pump();
  const api = viewport.getExposes();
  expect(api.getReadingEpoch()).toBeGreaterThan(0);
  const currentFrame = (patch: Partial<MessageReadingFrame> = {}) =>
    frame({ epoch: api.getReadingEpoch(), scrollOffset: viewport.scrollTop, ...patch });
  return { root, viewport, metrics, api, pump, currentFrame };
}

afterEach(async () => {
  document.body.replaceChildren();
  await microtasks();
  vi.restoreAllMocks();
});

describe('MessageScroller reading Hook through the Web Component adapter', () => {
  it('keeps the initial hint through empty, zero-height and fallback layouts until reader input', async () => {
    const { api, currentFrame } = await fixture();
    api.beginReading(false, saved);
    expect(api.readingMode.get()).toBe('history');
    expect(api.restoreReading(currentFrame({ entries: [] }))).toBe(-1);
    const fallback = currentFrame({
      entries: [{ key: 'other', start: 0, end: 10, primary: true }],
    });
    const fallbackTicket = api.restoreReading(fallback);
    expect(fallbackTicket).toBeGreaterThanOrEqual(0);
    api.commitReadingRestore(fallbackTicket, currentFrame({ scrollOffset: 100 }));
    api.observeReadingScroll(currentFrame({ scrollOffset: 160 }));
    const zeroHeight = currentFrame({
      entries: [{ key: 'message-b', start: 0, end: 0, primary: true }],
    });
    const exactTicket = api.restoreReading(zeroHeight);
    expect(exactTicket).toBeGreaterThan(fallbackTicket);
    api.commitReadingRestore(exactTicket, zeroHeight);
    expect(api.captureReading(currentFrame())).toEqual(saved);
    expect(api.readingAnchorForPersistence(currentFrame())).toBeNull();
    expect(api.restoringReading.get()).toBe(true);
    api.readingInput(readerInput(), currentFrame());
    expect(api.restoringReading.get()).toBe(false);
    expect(api.readingAnchorForPersistence(currentFrame())).toMatchObject({ key: 'message-b' });
  });

  it('leaves one anchor owner when the host observes a prepend', async () => {
    const { api, viewport, metrics, pump } = await fixture();
    api.beginReading(false, saved);
    viewport.scrollTop = 100;
    viewport.dispatchEvent(new Event('scroll'));
    await pump();
    expect(api.scrollYVisibleRatio.get()).toBeCloseTo(0.25);
    metrics.scrollHeight = 600;
    viewport.prepend(document.createElement('div'));
    // Deliver the real DOM observer, then explicitly measure the changed host
    // extent. The ratio assertion proves the update was observed before the
    // unchanged offset is treated as absence of duplicate anchor compensation.
    await new Promise((resolve) => setTimeout(resolve, 0));
    window.dispatchEvent(new Event('resize'));
    await pump();
    expect(api.scrollYVisibleRatio.get()).toBeCloseTo(1 / 6);
    expect(viewport.scrollTop).toBe(100);
    expect(api.readingMode.get()).toBe('history');
  });

  it.each(['inactive', 'outside'] as const)('does not retire a hint for %s input', async (kind) => {
    const { api, currentFrame } = await fixture();
    api.beginReading(false, saved);
    api.readingInput(
      readerInput(kind === 'inactive' ? { active: false } : { inside: false }),
      currentFrame()
    );
    expect(api.restoringReading.get()).toBe(true);
    expect(api.captureReading(currentFrame())).toEqual(saved);
  });

  it('deduplicates selection replay without treating it as reader takeover', async () => {
    const { api, currentFrame } = await fixture();
    api.beginReading(false, saved);
    const facts = selectionFacts({ epoch: api.getReadingEpoch() });
    const ticket = api.planSelectionRestore(facts);
    expect(ticket).toBeGreaterThanOrEqual(0);
    api.readingInput(readerInput({ kind: 'selection', selection }), currentFrame());
    expect(api.restoringReading.get()).toBe(true);
    expect(api.readingMode.get()).toBe('history');
    api.commitSelectionRestore(ticket);
    expect(api.planSelectionRestore(facts)).toBe(-1);
    api.readingInput(readerInput({ kind: 'selection', selection }), currentFrame());
    expect(api.restoringReading.get()).toBe(true);
    expect(api.readingMode.get()).toBe('history');
    expect(api.captureReading(currentFrame())).toEqual(saved);
    api.readingInput(readerInput({ kind: 'pointer', interactive: true }), currentFrame());
    expect(api.restoringReading.get()).toBe(false);
    expect(api.readingMode.get()).toBe('interacting');
  });

  it('revokes old exposed handles when a Web Component is terminally detached', async () => {
    const { root, viewport, api, currentFrame, pump } = await fixture();
    api.beginReading(false, saved);
    const oldFrame = currentFrame();
    const oldTicket = api.planSelectionRestore(selectionFacts({ epoch: oldFrame.epoch }));
    expect(oldTicket).toBeGreaterThanOrEqual(0);
    viewport.remove();
    await pump();
    expect(() => api.getReadingEpoch()).toThrow(/after terminal disposal/);
    expect(() => api.commitSelectionRestore(oldTicket)).toThrow(/after terminal disposal/);
    root.append(viewport);
    await pump();
    const current = viewport.getExposes();
    expect(current).not.toBe(api);
    expect(current.readingMode.get()).toBe('following');
    expect(() => api.beginReading(false, saved)).toThrow(/after terminal disposal/);
    expect(current.readingMode.get()).toBe('following');
  });

  it.each(['pointer', 'key', 'wheel', 'focus', 'backfill'] as const)(
    'retires the initial hint for an explicit %s reader handoff',
    async (kind) => {
      const { api, currentFrame } = await fixture();
      api.beginReading(false, saved);
      api.readingInput(readerInput({ kind }), currentFrame());
      expect(api.restoringReading.get()).toBe(false);
      expect(api.readingAnchorForPersistence(currentFrame())).not.toBeNull();
    }
  );

  it('resumes the tail explicitly and stops offering history selection or persistence', async () => {
    const { api, viewport, currentFrame, pump } = await fixture();
    api.beginReading(false, saved);
    viewport.scrollTop = 100;
    api.resumeReading();
    await pump();
    expect(api.readingMode.get()).toBe('following');
    expect(api.restoringReading.get()).toBe(false);
    expect(viewport.scrollTop).toBe(300);
    expect(api.captureReading(currentFrame())).toBeNull();
    expect(api.readingAnchorForPersistence(currentFrame())).toBeNull();
    expect(api.planSelectionRestore(selectionFacts({ epoch: api.getReadingEpoch() }))).toBe(-1);
  });
});

it('isolates stale frames and selection tickets across one RuntimeSession mount epoch', async () => {
  // Unlike terminal WC removal, RuntimeSession.unmount keeps this same setup
  // and its opaque request sequence alive. No native host input is claimed.
  let api!: ReadingApi;
  const prototype = definePrototype({
    name: 'reading-runtime-epoch',
    setup() {
      asMessageScrollerReading();
    },
  });
  const session = createRuntimeSession(prototype, {
    prototypeName: prototype.name,
    getRawProps: () => ({}),
    commit(_children, signal) {
      signal?.done();
    },
    schedule(task) {
      task();
    },
    onRuntimeReady(wiring) {
      wiring.attach('expose-state', [
        [EXPOSE_STATE_SET_EXPOSES_CAP, (next: unknown) => (api = next as ReadingApi)],
      ]);
    },
  });
  const call = <T>(action: () => T): T => {
    let result!: T;
    session.invokeInCallbackScope(() => {
      result = action();
    });
    return result;
  };
  try {
    await session.mount();
    call(() => api.beginReading(false, saved));
    const oldFrame = frame({ epoch: api.getReadingEpoch() });
    const oldTicket = call(() =>
      api.planSelectionRestore(selectionFacts({ epoch: oldFrame.epoch }))
    );
    expect(oldTicket).toBeGreaterThanOrEqual(0);
    await session.unmount();
    expect(api.getReadingEpoch()).toBe(-1);
    await session.mount();
    const epoch = api.getReadingEpoch();
    expect(epoch).toBeGreaterThan(oldFrame.epoch);
    expect(call(() => api.captureReading(oldFrame))).toBeNull();
    expect(call(() => api.restoreReading(oldFrame))).toBe(-1);
    expect(call(() => api.planSelectionRestore(selectionFacts({ epoch: oldFrame.epoch })))).toBe(
      -1
    );
    const facts = selectionFacts({ epoch });
    call(() => api.commitSelectionRestore(oldTicket));
    const newTicket = call(() => api.planSelectionRestore(facts));
    expect(newTicket).toBeGreaterThan(oldTicket);
    call(() => api.commitSelectionRestore(oldTicket));
    call(() => api.commitSelectionRestore(newTicket));
    expect(call(() => api.planSelectionRestore(facts))).toBe(-1);
    expect(call(() => api.captureReading(frame({ epoch })))).toEqual(saved);
  } finally {
    await session.dispose();
  }
});
