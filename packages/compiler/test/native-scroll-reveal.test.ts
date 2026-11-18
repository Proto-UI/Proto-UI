// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSupport, supportClosure, typecheckSupport } from './native-support-evidence';

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const dispose of cleanup.splice(0).reverse()) dispose();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});
const support = supportClosure(['scroll']);
const unavailable = { kind: 'rejected', reason: 'unavailable' };

/** Direct emitted host closure model. Ordinary framework consumers live separately. */
function fixture(options: { mount?: boolean; atEnd?: boolean } = {}) {
  const resize: (() => void)[] = [];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize.push(callback);
      }
      observe() {}
      disconnect() {}
    }
  );
  const load = loadSupport(support.files);
  const create = load(support.plan.modulesPath).createNativeAdapterModules as (
    options: Record<string, unknown>
  ) => any;
  const family = {
    debugName: 'native-scroll-family',
    roles: {
      root: { cardinality: { min: 1, max: 1 } },
      surface: { cardinality: { min: 0, max: '*' } },
      item: { cardinality: { min: 0, max: '*' } },
    },
  };
  const outer = document.createElement('div'),
    surface = document.createElement('div'),
    target = document.createElement('div');
  outer.append(surface);
  surface.append(target);
  document.body.append(outer);
  const createOwner = (parent: object | null, role: string, initial: HTMLElement) => {
    const identity = {};
    let current = initial;
    const modules = create({
      ensureSetup() {},
      ensureRuntime() {},
      ensureEvent() {},
      isAlive: () => true,
      isReady: () => true,
      invoke: <T>(callback: () => T) => callback(),
      getRun: () => ({}),
      getResolvedProps: () => ({}),
      getRoot: () => current,
      getLogicalParent: () => parent,
      identity,
      declarations: [],
    });
    modules.anatomy.claim(family, { role });
    cleanup.push(() => modules.dispose());
    return {
      identity,
      modules,
      replace(next: HTMLElement, mount = true) {
        current.replaceWith(next);
        current = next;
        if (mount) modules.mount();
      },
    };
  };
  const root = createOwner(null, 'root', outer),
    owner = createOwner(root.identity, 'surface', surface),
    item = createOwner(owner.identity, 'item', target);
  const scroll = owner.modules.asScrollSurface();
  scroll.configure({
    axes: 'vertical',
    projection: 'system',
    endFollow: { mode: 'while-at-end', axis: 'vertical' },
  });
  let extent = 400;
  Object.defineProperties(surface, {
    clientWidth: { configurable: true, value: 100 },
    scrollWidth: { configurable: true, value: 400 },
    clientHeight: { configurable: true, value: 100 },
    scrollHeight: { configurable: true, get: () => extent },
    clientTop: { configurable: true, value: 2 },
    offsetHeight: { configurable: true, value: 104 },
  });
  surface.scrollTop = options.atEnd ? 300 : 50;
  surface.scrollLeft = 17;
  const geometry = {
    start: options.atEnd ? 300 : 150,
    height: 20,
    onMeasure: undefined as (() => void) | undefined,
  };
  const surfaceBox = () => new DOMRect(20, 100, 104, 104);
  const targetBox = () => {
    const callback = geometry.onMeasure;
    geometry.onMeasure = undefined;
    callback?.();
    return new DOMRect(22, 102 + geometry.start - surface.scrollTop, 80, geometry.height);
  };
  vi.spyOn(surface, 'getBoundingClientRect').mockImplementation(surfaceBox);
  vi.spyOn(surface, 'getClientRects').mockImplementation(
    () => [surfaceBox()] as unknown as DOMRectList
  );
  vi.spyOn(target, 'getBoundingClientRect').mockImplementation(targetBox);
  vi.spyOn(target, 'getClientRects').mockImplementation(
    () => [targetBox()] as unknown as DOMRectList
  );
  root.modules.mount();
  item.modules.mount();
  if (options.mount !== false) owner.modules.mount();
  const part = root.modules.anatomy.partsOf(family, 'item')[0];
  const reveal = (subject = part, requestFamily = family) =>
    scroll.request({ kind: 'reveal', axis: 'vertical', family: requestFamily, part: subject });
  return {
    root,
    owner,
    item,
    createOwner,
    family,
    part,
    outer,
    surface,
    target,
    scroll,
    reveal,
    geometry,
    grow() {
      extent = 500;
      for (const callback of [...resize]) callback();
    },
  };
}
function frames() {
  let next = 0;
  const pending = new Map<number, FrameRequestCallback>();
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    const id = ++next;
    pending.set(id, callback);
    return id;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    pending.delete(id);
  });
  return {
    pending,
    flush() {
      for (const [id, callback] of [...pending]) {
        pending.delete(id);
        callback(16);
      }
    },
  };
}

describe('Compiler Scroll current-view and reveal host closure', () => {
  it('returns not-mounted or unavailable without replaying into a later root', () => {
    const f = fixture({ mount: false });
    expect(f.scroll.request({ kind: 'to', axis: 'vertical', position: 0.5 })).toEqual({
      kind: 'rejected',
      reason: 'not-mounted',
    });
    f.owner.modules.mount();
    expect(f.surface.scrollTop).toBe(50);
    const replacement = document.createElement('div');
    f.owner.replace(replacement, false);
    expect(f.scroll.request({ kind: 'to', axis: 'vertical', position: 0.5 })).toEqual(unavailable);
    f.owner.modules.mount();
    expect(replacement.scrollTop).toBe(0);
  });

  it('queues only within the current synchronous attachment transaction', () => {
    const f = fixture({ mount: false });
    let outcome: unknown,
      during = -1;
    f.scroll.projection.watch(() => {
      outcome = f.scroll.request({ kind: 'to', axis: 'vertical', position: 0.5 });
      during = f.surface.scrollTop;
    });
    f.owner.modules.mount();
    expect(outcome).toEqual({ kind: 'queued' });
    expect(during).toBe(50);
    expect(f.surface.scrollTop).toBe(150);
  });

  it('drops queued work when an attachment observer replaces the view', () => {
    const f = fixture({ mount: false });
    let outcome: unknown,
      replaced = false;
    const replacement = document.createElement('div');
    Object.defineProperties(replacement, {
      clientHeight: { value: 100 },
      scrollHeight: { value: 500 },
    });
    f.scroll.projection.watch(() => {
      if (replaced) return;
      replaced = true;
      outcome = f.scroll.request({ kind: 'to', axis: 'vertical', position: 0.5 });
      f.owner.replace(replacement);
    });
    f.owner.modules.mount();
    expect(outcome).toEqual({ kind: 'queued' });
    expect(f.surface.scrollTop).toBe(50);
    expect(replacement.scrollTop).toBe(0);
  });

  it('rejects reveal during acquisition, then delivers the same current part after attachment', () => {
    const f = fixture({ mount: false });
    let outcome: unknown;
    f.scroll.projection.watch(() => {
      outcome = f.reveal();
    });
    f.owner.modules.mount();
    expect(outcome).toEqual(unavailable);
    expect(f.surface.scrollTop).toBe(50);
    expect(f.reveal()).toEqual({ kind: 'dispatched' });
    expect(f.surface.scrollTop).toBe(70);
  });

  it('moves the minimum vertical distance while preserving focus and other offsets', () => {
    const f = fixture();
    const editor = document.createElement('input');
    f.outer.prepend(editor);
    editor.focus();
    f.outer.scrollTop = 43;
    f.outer.scrollLeft = 11;
    expect(f.reveal()).toEqual({ kind: 'dispatched' });
    expect(f.surface.scrollTop).toBe(70);
    expect(f.surface.scrollLeft).toBe(17);
    expect(f.outer.scrollTop).toBe(43);
    expect(f.outer.scrollLeft).toBe(11);
    expect(document.activeElement).toBe(editor);
  });

  it('rejects fabricated, self, sibling-domain and foreign-family identities', () => {
    const f = fixture();
    expect(f.reveal({ role: 'item' })).toEqual(unavailable);
    expect(f.reveal(f.root.modules.anatomy.partsOf(f.family, 'surface')[0])).toEqual(unavailable);
    const otherRoot = document.createElement('div'),
      otherItem = document.createElement('div');
    otherRoot.append(otherItem);
    document.body.append(otherRoot);
    const root = f.createOwner(null, 'root', otherRoot),
      item = f.createOwner(root.identity, 'item', otherItem);
    root.modules.mount();
    item.modules.mount();
    expect(f.reveal(root.modules.anatomy.partsOf(f.family, 'item')[0])).toEqual(unavailable);
    expect(f.reveal(f.part, { ...f.family })).toEqual(unavailable);
    expect(f.surface.scrollTop).toBe(50);
  });

  it.each(['part', 'view'] as const)(
    'does not apply old geometry after synchronous %s retirement',
    (retirement) => {
      const f = fixture();
      const replacement = document.createElement('div');
      f.geometry.onMeasure = () =>
        retirement === 'part' ? f.item.modules.dispose() : f.owner.replace(replacement);
      expect(f.reveal()).toEqual(unavailable);
      expect(f.surface.scrollTop).toBe(50);
      expect(replacement.scrollTop).toBe(0);
    }
  );

  it('lets a valid no-op reveal supersede an older pending end request', () => {
    const clock = frames(),
      f = fixture({ atEnd: true });
    f.grow();
    expect(f.scroll.endFollow.requestStatus.get()).toBe('pending');
    expect(clock.pending.size).toBe(1);
    expect(f.reveal()).toEqual({ kind: 'dispatched' });
    expect(f.surface.scrollTop).toBe(300);
    expect(clock.pending.size).toBe(0);
    clock.flush();
    expect(f.surface.scrollTop).toBe(300);
  });

  it.each([
    { nestedStart: 300, writes: [220] },
    { nestedStart: 100, writes: [] },
  ])(
    'stops the older reveal after a cancellation observer reenters at $nestedStart',
    ({ nestedStart, writes: expectedWrites }) => {
      const clock = frames(),
        f = fixture({ atEnd: true });
      f.grow();
      expect(f.scroll.endFollow.requestStatus.get()).toBe('pending');
      f.surface.scrollTop = 50;
      f.geometry.start = 150;
      let position = 50;
      const writes: number[] = [];
      Object.defineProperty(f.surface, 'scrollTop', {
        configurable: true,
        get: () => position,
        set(value: number) {
          writes.push(value);
          position = value;
        },
      });
      let nestedOutcome: unknown;
      f.scroll.endFollow.requestStatus.watch((_run: unknown, event: { next: string }) => {
        if (event.next !== 'rejected') return;
        f.geometry.start = nestedStart;
        nestedOutcome = f.reveal();
      });
      // The older reveal measured 70 before the cancellation notification
      // published its rejected status to the observer.
      expect(f.reveal()).toEqual(unavailable);
      expect(nestedOutcome).toEqual({ kind: 'dispatched' });
      expect(writes).toEqual(expectedWrites);
      expect(f.surface.scrollTop).toBe(
        expectedWrites.length ? expectedWrites[expectedWrites.length - 1] : 50
      );
      expect(clock.pending.size).toBe(0);
      clock.flush();
      expect(writes).toEqual(expectedWrites);
    }
  );

  it.each(['hidden', 'zero-height', 'unresolved-inset'] as const)(
    'keeps the older reveal after a cancellation observer issues a %s reveal',
    (refusal) => {
      const clock = frames(),
        f = fixture({ atEnd: true });
      f.grow();
      expect(f.scroll.endFollow.requestStatus.get()).toBe('pending');
      f.surface.scrollTop = 50;
      f.geometry.start = 150;
      let nestedOutcome: unknown;
      f.scroll.endFollow.requestStatus.watch((_run: unknown, event: { next: string }) => {
        if (event.next !== 'rejected') return;
        if (refusal === 'hidden') f.target.style.visibility = 'hidden';
        else if (refusal === 'zero-height') f.geometry.height = 0;
        else f.target.style.scrollMarginTop = 'calc(1px + 1em)';
        nestedOutcome = f.reveal();
      });
      expect(f.reveal()).toEqual({ kind: 'dispatched' });
      expect(nestedOutcome).toEqual(unavailable);
      expect(f.surface.scrollTop).toBe(70);
      expect(clock.pending.size).toBe(0);
      clock.flush();
      expect(f.surface.scrollTop).toBe(70);
    }
  );

  it('lets a valid reveal during measurement supersede the older reveal', () => {
    const f = fixture();
    let position = 50;
    const writes: number[] = [];
    Object.defineProperty(f.surface, 'scrollTop', {
      configurable: true,
      get: () => position,
      set(value: number) {
        writes.push(value);
        position = value;
      },
    });
    let nestedOutcome: unknown;
    f.geometry.onMeasure = () => {
      f.geometry.start = 300;
      nestedOutcome = f.reveal();
      f.geometry.start = 150;
    };
    expect(f.reveal()).toEqual(unavailable);
    expect(nestedOutcome).toEqual({ kind: 'dispatched' });
    expect(writes).toEqual([220]);
    expect(f.surface.scrollTop).toBe(220);
  });

  it('keeps the older reveal after a zero-height reveal during measurement', () => {
    const f = fixture();
    let nestedOutcome: unknown;
    f.geometry.onMeasure = () => {
      f.geometry.height = 0;
      nestedOutcome = f.reveal();
      f.geometry.height = 20;
    };
    expect(f.reveal()).toEqual({ kind: 'dispatched' });
    expect(nestedOutcome).toEqual(unavailable);
    expect(f.surface.scrollTop).toBe(70);
  });

  it('preserves an older pending end request after an invalid reveal', () => {
    const clock = frames(),
      f = fixture({ atEnd: true });
    f.grow();
    expect(clock.pending.size).toBe(1);
    expect(f.reveal({ role: 'item' })).toEqual(unavailable);
    expect(clock.pending.size).toBe(1);
    clock.flush();
    expect(f.surface.scrollTop).toBe(400);
    expect(f.scroll.endFollow.requestStatus.get()).toBe('applied');
  });

  it.each([undefined, new Error('projection observer failed')])(
    'keeps the replacement view when a retired attachment observer throws %s',
    (failure) => {
      const f = fixture({ mount: false });
      const added = vi.spyOn(f.surface, 'addEventListener'),
        removed = vi.spyOn(f.surface, 'removeEventListener');
      const replacement = document.createElement('div');
      Object.defineProperties(replacement, {
        clientHeight: { value: 100 },
        scrollHeight: { value: 500 },
      });
      const events: string[] = [];
      let replaced = false;
      f.scroll.projection.watch((_run: unknown, event: { next: string }) => {
        events.push(event.next);
        if (event.next === 'unresolved') throw failure;
        if (replaced) return;
        replaced = true;
        f.owner.replace(replacement);
        throw failure;
      });
      let threw = false,
        caught: unknown;
      try {
        f.owner.modules.mount();
      } catch (error) {
        threw = true;
        caught = error;
      }
      // Every old physical listener is released before the original observer
      // failure escapes; an old mount catch must leave the newer lease intact.
      expect(added.mock.calls.length).toBeGreaterThan(0);
      expect(removed.mock.calls).toEqual(expect.arrayContaining(added.mock.calls));
      expect(f.scroll.request({ kind: 'by', axis: 'vertical', delta: 1 })).toEqual({
        kind: 'dispatched',
      });
      expect(replacement.scrollTop).toBe(1);
      expect(threw).toBe(true);
      expect(caught).toBe(failure);
      // The null-view reset cannot borrow the epoch of the replacement view
      // merely because this notification queue is already draining.
      expect(events).toEqual(['system', 'system']);
    }
  );

  it('cancels pending end work during its own status notification before a frame is registered', () => {
    const clock = frames(),
      f = fixture({ atEnd: true });
    let outcome: unknown;
    f.scroll.endFollow.requestStatus.watch((_run: unknown, event: { next: string }) => {
      if (event.next === 'pending') outcome = f.reveal();
    });
    f.grow();
    expect(outcome).toEqual({ kind: 'dispatched' });
    expect(clock.pending.size).toBe(0);
    expect(f.scroll.endFollow.requestStatus.get()).toBe('rejected');
    expect(f.scroll.endFollow.state.get()).toBe('paused');
    expect(f.surface.scrollTop).toBe(300);
  });

  it('to-end applied status completes following without nested work', () => {
    const f = fixture({ mount: false });
    const observations: object[] = [];
    const sample = (point: string) => {
      const value = {
        point,
        offset: f.surface.scrollTop,
        atEnd: f.scroll.vertical.atEnd.get(),
        state: f.scroll.endFollow.state.get(),
        status: f.scroll.endFollow.requestStatus.get(),
      };
      observations.push(value);
      return value;
    };
    let appliedCalls = 0;
    f.scroll.endFollow.requestStatus.watch((_run: unknown, event: { next: string }) => {
      if (event.next !== 'applied') return;
      appliedCalls++;
      sample('applied-entry');
    });
    f.owner.modules.mount();
    sample('before-request');
    const outcome = f.scroll.request({ kind: 'to-end', axis: 'vertical' });
    const final = sample('outer-return');
    console.info(
      'scroll-to-end-applied-diagnostic',
      JSON.stringify({ scenario: 'control', outcome, observations })
    );
    expect(outcome).toEqual({ kind: 'dispatched' });
    expect(appliedCalls).toBe(1);
    expect(final).toEqual({
      point: 'outer-return',
      offset: 300,
      atEnd: true,
      state: 'following',
      status: 'applied',
    });
  });

  it('to-end applied status preserves the later same-view reveal pause', () => {
    const f = fixture({ mount: false });
    const observations: object[] = [];
    const sample = (point: string) => {
      const value = {
        point,
        offset: f.surface.scrollTop,
        atEnd: f.scroll.vertical.atEnd.get(),
        state: f.scroll.endFollow.state.get(),
        status: f.scroll.endFollow.requestStatus.get(),
      };
      observations.push(value);
      return value;
    };
    let appliedCalls = 0;
    let nestedOutcome: unknown, nestedFacts: object | undefined;
    f.scroll.endFollow.requestStatus.watch((_run: unknown, event: { next: string }) => {
      if (event.next !== 'applied') return;
      appliedCalls++;
      if (appliedCalls !== 1) return;
      sample('applied-entry');
      nestedOutcome = f.reveal();
      nestedFacts = sample('nested-return');
    });
    f.owner.modules.mount();
    sample('before-request');
    const outcome = f.scroll.request({ kind: 'to-end', axis: 'vertical' });
    const final = sample('outer-return');
    console.info(
      'scroll-to-end-applied-diagnostic',
      JSON.stringify({ scenario: 'nested-reveal', outcome, nestedOutcome, observations })
    );
    expect(appliedCalls).toBe(1);
    expect(outcome).toEqual({ kind: 'dispatched' });
    expect(nestedOutcome).toEqual({ kind: 'dispatched' });
    expect(f.surface.isConnected).toBe(true);
    expect(f.target.parentNode).toBe(f.surface);
    expect(f.owner.modules.anatomy.partsOf(f.family, 'item')[0]).toBe(f.part);
    expect(nestedFacts).toEqual({
      point: 'nested-return',
      offset: 150,
      atEnd: false,
      state: 'paused',
      status: 'applied',
    });
    expect(final).toEqual({
      point: 'outer-return',
      offset: 150,
      atEnd: false,
      state: 'paused',
      status: 'applied',
    });
  });

  it.each([
    { axis: 'horizontal', contact: false },
    { axis: 'vertical', contact: true },
    { axis: 'horizontal', contact: true },
  ] as const)(
    'to-end completion controls resumes $axis with contact=$contact',
    ({ axis, contact }) => {
      const f = fixture({ mount: false });
      f.scroll.configure({
        axes: 'both',
        projection: 'system',
        endFollow: { mode: 'while-at-end', axis },
      });
      f.owner.modules.mount();
      if (contact) f.surface.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1 }));
      const outcome = f.scroll.request({ kind: 'to-end', axis });
      const facts = {
        axis,
        contact,
        outcome,
        offset: axis === 'horizontal' ? f.surface.scrollLeft : f.surface.scrollTop,
        atEnd: f.scroll[axis].atEnd.get(),
        state: f.scroll.endFollow.state.get(),
        status: f.scroll.endFollow.requestStatus.get(),
      };
      console.info('scroll-to-end-completion-control', JSON.stringify(facts));
      expect(facts).toEqual({
        axis,
        contact,
        outcome: { kind: 'dispatched' },
        offset: 300,
        atEnd: true,
        state: 'following',
        status: 'applied',
      });
    }
  );

  it('to-end completion controls keeps an off follow policy off', () => {
    const f = fixture({ mount: false });
    f.scroll.configure({ endFollow: { mode: 'off' } });
    f.owner.modules.mount();
    const before = f.scroll.endFollow.state.get();
    const outcome = f.scroll.request({ kind: 'to-end', axis: 'vertical' });
    const facts = {
      before,
      outcome,
      offset: f.surface.scrollTop,
      atEnd: f.scroll.vertical.atEnd.get(),
      state: f.scroll.endFollow.state.get(),
      status: f.scroll.endFollow.requestStatus.get(),
    };
    console.info('scroll-to-end-completion-control', JSON.stringify({ scenario: 'off', ...facts }));
    expect(facts).toEqual({
      before: 'off',
      outcome: { kind: 'dispatched' },
      offset: 300,
      atEnd: true,
      state: 'off',
      status: 'applied',
    });
  });

  it('to-end completion controls does not repeat following after a state-watcher reveal', () => {
    const f = fixture({ mount: false });
    const observations: object[] = [];
    const sample = (point: string) => {
      const value = {
        point,
        offset: f.surface.scrollTop,
        atEnd: f.scroll.vertical.atEnd.get(),
        state: f.scroll.endFollow.state.get(),
        status: f.scroll.endFollow.requestStatus.get(),
      };
      observations.push(value);
      return value;
    };
    let followingEvents = 0;
    let nestedOutcome: unknown, nestedFacts: ReturnType<typeof sample> | undefined;
    f.scroll.endFollow.state.watch((_run: unknown, event: { next: string }) => {
      if (event.next !== 'following') return;
      followingEvents++;
      if (followingEvents !== 1) return;
      sample('following-entry');
      nestedOutcome = f.reveal();
      nestedFacts = sample('nested-return');
    });
    f.owner.modules.mount();
    const outcome = f.scroll.request({ kind: 'to-end', axis: 'vertical' });
    const final = sample('outer-return');
    console.info(
      'scroll-to-end-completion-control',
      JSON.stringify({
        scenario: 'state-watcher-reveal',
        outcome,
        nestedOutcome,
        followingEvents,
        observations,
      })
    );
    expect(outcome).toEqual({ kind: 'dispatched' });
    expect(nestedOutcome).toEqual({ kind: 'dispatched' });
    expect(nestedFacts).toMatchObject({ offset: 150, atEnd: false, state: 'paused' });
    expect(final).toEqual({
      point: 'outer-return',
      offset: 150,
      atEnd: false,
      state: 'paused',
      status: 'applied',
    });
    expect(followingEvents).toBe(1);
  });

  it('to-end completion controls preserves a newer pending status created by a state watcher', () => {
    const clock = frames(),
      f = fixture({ mount: false });
    const observations: object[] = [];
    const sample = (point: string) => {
      const value = {
        point,
        offset: f.surface.scrollTop,
        atEnd: f.scroll.vertical.atEnd.get(),
        state: f.scroll.endFollow.state.get(),
        status: f.scroll.endFollow.requestStatus.get(),
        frames: clock.pending.size,
      };
      observations.push(value);
      return value;
    };
    let created = false;
    f.scroll.endFollow.state.watch((_run: unknown, event: { next: string }) => {
      if (event.next !== 'following' || created) return;
      created = true;
      sample('following-entry');
      f.grow();
      sample('new-pending-return');
    });
    f.owner.modules.mount();
    const outcome = f.scroll.request({ kind: 'to-end', axis: 'vertical' });
    const beforeFrame = sample('outer-return');
    clock.flush();
    const afterFrame = sample('new-frame-return');
    console.info(
      'scroll-to-end-completion-control',
      JSON.stringify({ scenario: 'state-watcher-pending', outcome, observations })
    );
    expect(outcome).toEqual({ kind: 'dispatched' });
    expect(created).toBe(true);
    expect(beforeFrame.frames).toBe(1);
    expect(afterFrame).toMatchObject({ offset: 400, atEnd: true, status: 'applied', frames: 0 });
    expect(beforeFrame.status).toBe('pending');
  });

  it('does not let a cancelled frame retire a newer pending end request', () => {
    const clock = frames(),
      f = fixture({ atEnd: true });
    f.grow();
    expect(clock.pending.size).toBe(1);
    const stale = clock.pending.values().next().value!;
    expect(f.reveal()).toEqual({ kind: 'dispatched' });
    expect(clock.pending.size).toBe(0);
    f.surface.scrollTop = 400;
    f.surface.dispatchEvent(new Event('scroll'));
    f.grow();
    expect(clock.pending.size).toBe(1);
    stale(16);
    expect(clock.pending.size).toBe(1);
    expect(f.scroll.endFollow.requestStatus.get()).toBe('pending');
    clock.flush();
    expect(f.scroll.endFollow.requestStatus.get()).toBe('applied');
    expect(f.surface.scrollTop).toBe(400);
  });

  it('stops old axis facts when an observer replaces the generation during publication', () => {
    const f = fixture({ mount: false }),
      replacement = document.createElement('div');
    Object.defineProperties(replacement, {
      clientWidth: { value: 100 },
      scrollWidth: { value: 900 },
      clientHeight: { value: 100 },
      scrollHeight: { value: 500 },
    });
    replacement.scrollLeft = 320;
    replacement.scrollTop = 100;
    let replaced = false;
    f.scroll.horizontal.position.watch(() => {
      if (!replaced) {
        replaced = true;
        f.owner.replace(replacement);
      }
    });
    f.owner.modules.mount();
    const snapshot = f.scroll.getSnapshot();
    expect(snapshot.horizontal.position).toBe(0.4);
    expect(snapshot.horizontal.visibleRatio).toBeCloseTo(1 / 9);
    expect(snapshot.vertical.position).toBe(0.25);
    expect(snapshot.vertical.visibleRatio).toBe(0.2);
  });

  it('rejects unresolved computed insets without moving the host', () => {
    const f = fixture(),
      readStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
      const style = readStyle(element);
      return element === f.surface
        ? new Proxy(style, {
            get(target, key) {
              return key === 'scrollPaddingTop'
                ? 'calc(10% + 10px)'
                : Reflect.get(target, key, target);
            },
          })
        : style;
    });
    expect(f.reveal()).toEqual(unavailable);
    expect(f.surface.scrollTop).toBe(50);
  });

  it('keeps the entire reached standalone Scroll support graph strictly typed', () => {
    expect(typecheckSupport(support.files)).toBe('');
  });
});
