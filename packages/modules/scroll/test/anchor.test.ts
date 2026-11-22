import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  MoveGestureHost,
  ScrollAnchorPolicy,
  ScrollEndFollowPolicy,
  ScrollSurfaceSnapshot,
} from '@proto.ui/core';
import { createWebScrollSurfaceHost, type ScrollSurfaceHostLease } from '../src';

const moveGestureHost: MoveGestureHost = {
  attach() {
    return { update() {}, dispose() {} };
  },
};

type Metrics = {
  clientWidth: number;
  scrollWidth: number;
  clientHeight: number;
  scrollHeight: number;
};

function installMetrics(target: HTMLElement, initial: Metrics) {
  const current = { ...initial };
  Object.defineProperties(target, {
    clientWidth: { configurable: true, get: () => current.clientWidth },
    scrollWidth: { configurable: true, get: () => current.scrollWidth },
    clientHeight: { configurable: true, get: () => current.clientHeight },
    scrollHeight: { configurable: true, get: () => current.scrollHeight },
    scrollLeft: { configurable: true, value: 0, writable: true },
    scrollTop: { configurable: true, value: 0, writable: true },
  });
  return (patch: Partial<Metrics>) => Object.assign(current, patch);
}

type FrameHarness = {
  pending: () => number;
  runAll: () => void;
};

function installFrameHarness(): FrameHarness {
  let nextId = 1;
  const callbacks = new Map<number, FrameRequestCallback>();
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    const id = nextId++;
    callbacks.set(id, callback);
    return id;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    callbacks.delete(id);
  });
  return {
    pending: () => callbacks.size,
    runAll() {
      const pending = [...callbacks.entries()];
      callbacks.clear();
      for (const [, callback] of pending) callback(performance.now());
    },
  };
}

type MutationHarness = {
  deliver: (records: MutationRecord[]) => void;
  deliverStale: (records: MutationRecord[]) => void;
};

function installMutationHarness(): MutationHarness {
  type Recorder = {
    callback: MutationCallback;
    target: Node | null;
    connected: boolean;
  };
  const instances: Recorder[] = [];
  class RecordingMutationObserver {
    callback: MutationCallback;
    target: Node | null = null;
    connected = false;
    constructor(callback: MutationCallback) {
      this.callback = callback;
      instances.push(this);
    }
    observe(target: Node) {
      this.target = target;
      this.connected = true;
    }
    disconnect() {
      this.connected = false;
    }
  }
  vi.stubGlobal('MutationObserver', RecordingMutationObserver);
  return {
    deliver(records: MutationRecord[]) {
      const active = instances.find((instance) => instance.connected && instance.target);
      active?.callback(records, {} as MutationObserver);
    },
    deliverStale(records: MutationRecord[]) {
      const last = instances[instances.length - 1];
      last?.callback(records, {} as MutationObserver);
    },
  };
}

const childListRecord = (target: HTMLElement, added: Element[]): MutationRecord =>
  ({
    type: 'childList',
    target,
    addedNodes: added,
    removedNodes: [],
    previousSibling: null,
    nextSibling: null,
    attributeName: null,
    attributeNamespace: null,
    oldValue: null,
  }) as unknown as MutationRecord;

type AnchorConfig = {
  endFollow: ScrollEndFollowPolicy;
  anchor?: ScrollAnchorPolicy;
};

type AnchorFixture = {
  frames: FrameHarness;
  target: HTMLElement;
  mutations: MutationHarness;
  updateMetrics: (patch: Partial<Metrics>) => void;
  snapshots: ScrollSurfaceSnapshot[];
  lease: ScrollSurfaceHostLease;
  scrollTo: (top: number) => void;
  prepend: (messages: Element[]) => void;
};

function installAnchorFixture(config: AnchorConfig): AnchorFixture {
  const frames = installFrameHarness();
  const mutations = installMutationHarness();
  const target = document.createElement('div');
  const updateMetrics = installMetrics(target, {
    clientWidth: 100,
    scrollWidth: 100,
    clientHeight: 100,
    scrollHeight: 400,
  });
  target.append(
    document.createElement('div'),
    document.createElement('div'),
    document.createElement('div')
  );
  document.body.append(target);
  const snapshots: ScrollSurfaceSnapshot[] = [];
  const lease = createWebScrollSurfaceHost(target, { moveGestureHost }).attach({
    config: {
      axes: 'vertical',
      projection: 'system',
      endFollow: config.endFollow,
      anchor: config.anchor,
    },
    projection: 'system',
    onFacts: (snapshot) => snapshots.push(snapshot),
  });
  frames.runAll();
  return {
    frames,
    target,
    mutations,
    updateMetrics,
    snapshots,
    lease,
    scrollTo(top: number) {
      target.scrollTop = top;
      target.dispatchEvent(new Event('scroll'));
    },
    prepend(messages: Element[]) {
      target.prepend(...messages);
    },
  };
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('module-scroll: anchor host contract', () => {
  const anchorVertical: ScrollAnchorPolicy = { mode: 'preserve-visible', axis: 'vertical' };

  it('compensates batch head growth away from end by the extent delta', () => {
    const f = installAnchorFixture({ endFollow: { mode: 'off' }, anchor: anchorVertical });
    f.scrollTo(100);
    const first = document.createElement('div');
    const second = document.createElement('div');
    f.prepend([first, second]);
    f.updateMetrics({ scrollHeight: 600 });
    f.mutations.deliver([childListRecord(f.target, [first, second])]);

    expect(f.target.scrollTop).toBe(300);
    expect(f.snapshots.at(-1)?.vertical.atEnd).toBe(false);
    f.lease.dispose();
  });

  it('leaves head growth at the end to end-follow without anchor compensation', () => {
    const f = installAnchorFixture({
      endFollow: { mode: 'while-at-end', axis: 'vertical' },
      anchor: anchorVertical,
    });
    expect(f.target.scrollTop).toBe(300);
    expect(f.snapshots.at(-1)?.endFollow.state).toBe('following');

    const message = document.createElement('div');
    f.prepend([message]);
    f.updateMetrics({ scrollHeight: 450 });
    f.mutations.deliver([childListRecord(f.target, [message])]);

    expect(f.frames.pending()).toBeGreaterThan(0);
    expect(f.target.scrollTop).toBe(300);
    f.frames.runAll();
    expect(f.target.scrollTop).toBe(350);
    expect(f.snapshots.at(-1)?.endFollow.state).toBe('following');
    f.lease.dispose();
  });

  it('does not compensate non-head appends away from end', () => {
    const f = installAnchorFixture({ endFollow: { mode: 'off' }, anchor: anchorVertical });
    f.scrollTo(100);
    const message = document.createElement('div');
    f.target.append(message);
    f.updateMetrics({ scrollHeight: 500 });
    f.mutations.deliver([childListRecord(f.target, [message])]);

    expect(f.target.scrollTop).toBe(100);
    expect(f.snapshots.at(-1)?.vertical.atEnd).toBe(false);
    f.lease.dispose();
  });

  it('keeps the anchor axis offset stable across a viewport resize', () => {
    const f = installAnchorFixture({ endFollow: { mode: 'off' }, anchor: anchorVertical });
    expect(f.target.scrollTop).toBe(0);
    f.scrollTo(100);
    f.updateMetrics({ clientHeight: 80, scrollHeight: 450 });
    window.dispatchEvent(new Event('resize'));

    expect(f.target.scrollTop).toBe(100);
    expect(f.snapshots.at(-1)?.vertical.atEnd).toBe(false);
    f.lease.dispose();
  });

  it('treats an absent anchor policy as off', () => {
    const f = installAnchorFixture({ endFollow: { mode: 'off' } });
    f.scrollTo(100);
    const message = document.createElement('div');
    f.prepend([message]);
    f.updateMetrics({ scrollHeight: 500 });
    f.mutations.deliver([childListRecord(f.target, [message])]);

    expect(f.target.scrollTop).toBe(100);
    f.lease.dispose();
  });

  it('clears anchor evidence on dispose so late mutations cannot compensate', () => {
    const f = installAnchorFixture({ endFollow: { mode: 'off' }, anchor: anchorVertical });
    f.scrollTo(100);
    const message = document.createElement('div');
    f.prepend([message]);
    f.updateMetrics({ scrollHeight: 500 });
    f.lease.dispose();
    f.mutations.deliverStale([childListRecord(f.target, [message])]);

    expect(f.target.scrollTop).toBe(100);
  });

  it('consumes head-growth evidence while the end-follow lease owns the axis', () => {
    const f = installAnchorFixture({
      endFollow: { mode: 'while-at-end', axis: 'vertical' },
      anchor: anchorVertical,
    });
    // Follow-owned head growth: pending evidence must be consumed, not
    // carried into a later anchor-owned pass.
    const first = document.createElement('div');
    f.prepend([first]);
    f.updateMetrics({ scrollHeight: 450 });
    f.mutations.deliver([childListRecord(f.target, [first])]);
    f.frames.runAll();
    expect(f.target.scrollTop).toBe(350);
    expect(f.snapshots.at(-1)?.endFollow.state).toBe('following');

    // Reader departs; the observation syncs while the reader is away.
    f.scrollTo(200);

    // Later non-head growth with an unchanged offset must not compensate —
    // the consumed head-growth evidence was already spent while following.
    const tail = document.createElement('div');
    f.target.append(tail);
    f.updateMetrics({ scrollHeight: 550 });
    f.mutations.deliver([childListRecord(f.target, [tail])]);

    expect(f.target.scrollTop).toBe(200);
    f.lease.dispose();
  });

  it('compensates each head-growth delivery inside one frame', () => {
    const f = installAnchorFixture({ endFollow: { mode: 'off' }, anchor: anchorVertical });
    f.scrollTo(100);

    const first = document.createElement('div');
    f.prepend([first]);
    f.updateMetrics({ scrollHeight: 500 });
    f.mutations.deliver([childListRecord(f.target, [first])]);
    expect(f.target.scrollTop).toBe(200);

    // A second delivery in the same frame (no scroll event between them)
    // must still compensate by its own delta: the baseline is the
    // post-compensation offset, not the pre-write offset.
    const second = document.createElement('div');
    f.prepend([second]);
    f.updateMetrics({ scrollHeight: 600 });
    f.mutations.deliver([childListRecord(f.target, [second])]);
    expect(f.target.scrollTop).toBe(300);
    f.lease.dispose();
  });

  it('does not treat the first append to an empty target as head growth', () => {
    const f = installAnchorFixture({ endFollow: { mode: 'off' }, anchor: anchorVertical });
    f.target.replaceChildren();
    f.updateMetrics({ clientHeight: 100, scrollHeight: 400 });
    f.scrollTo(0);

    const first = document.createElement('div');
    const second = document.createElement('div');
    f.target.append(first, second);
    f.mutations.deliver([childListRecord(f.target, [first, second])]);

    // Nothing moved above existing content; the offset stays at the top.
    expect(f.target.scrollTop).toBe(0);
    f.lease.dispose();
  });
});
