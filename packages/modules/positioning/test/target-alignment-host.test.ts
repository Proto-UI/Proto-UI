import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AnchoredPositionConnection } from '@proto.ui/core';
import { createTargetAlignmentLease } from '../src/web/target-alignment-host';

const rect = (left: number, top: number, width: number, height: number) =>
  ({
    left,
    right: left + width,
    top,
    bottom: top + height,
    width,
    height,
    x: left,
    y: top,
    toJSON() {},
  }) as DOMRect;
function dimensions(node: HTMLElement, properties: Record<string, unknown>) {
  for (const [key, value] of Object.entries(properties))
    Object.defineProperty(node, key, { configurable: true, value });
}
function fixture() {
  const frame = document.createElement('div'),
    surface = document.createElement('div'),
    scrollport = document.createElement('div');
  const blockReference = document.createElement('button'),
    inlineReference = document.createElement('span');
  const blockTarget = document.createElement('div'),
    inlineTarget = document.createElement('span');
  blockReference.append(inlineReference);
  frame.append(surface);
  surface.append(scrollport);
  scrollport.append(blockTarget);
  blockTarget.append(inlineTarget);
  document.body.append(blockReference, frame);
  surface.style.cssText = 'border:1px solid black;padding:0px;';
  scrollport.style.padding = '4px';
  dimensions(blockTarget, { offsetTop: 36, offsetHeight: 32, offsetParent: scrollport });
  dimensions(scrollport, {
    offsetTop: 0,
    offsetHeight: 104,
    scrollHeight: 104,
    offsetParent: surface,
  });
  dimensions(surface, {
    offsetLeft: 0,
    offsetWidth: 180,
    offsetTop: 0,
    offsetHeight: 106,
    clientHeight: 104,
    clientLeft: 1,
    clientTop: 1,
    offsetParent: frame,
  });
  dimensions(inlineTarget, { offsetLeft: 12, offsetWidth: 50, offsetParent: scrollport });
  dimensions(frame, { offsetTop: 0, offsetParent: null });
  blockReference.getBoundingClientRect = () => rect(180, 240, 180, 36);
  inlineReference.getBoundingClientRect = () => rect(193, 248, 50, 20);
  surface.getBoundingClientRect = () => rect(0, 0, 180, 106);
  inlineTarget.getBoundingClientRect = () => rect(13, 37, 50, 20);
  const onAlignment = vi.fn();
  const connection: AnchoredPositionConnection = {
    anchor: blockReference,
    floating: frame,
    config: {
      side: 'bottom',
      align: 'start',
      sideOffset: 4,
      alignOffset: 0,
      strategy: 'fixed',
      avoidCollisions: true,
      collisionBoundary: 'viewport',
      collisionPadding: 10,
    },
    targetAlignment: {
      surface,
      scrollport,
      blockReference,
      inlineReference,
      blockTarget,
      inlineTarget,
      atStart: false,
      atEnd: false,
      constraints: {
        boundary: 'layout-viewport',
        margin: 10,
        minimumTargetSpanCount: 5,
        inlineOverflow: 'preserve-start',
        expandOnScroll: true,
      },
    },
    onAlignment,
  };
  return { frame, surface, scrollport, blockTarget, connection, onAlignment };
}
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe('neutral target geometry host', () => {
  it('applies the fixed-source plan and restores only its owned frame styles', () => {
    const f = fixture();
    f.frame.style.height = '23px';
    const lease = createTargetAlignmentLease(f.connection);
    expect(f.onAlignment).toHaveBeenCalledWith({ status: 'applied' });
    expect(f.frame.style.left).toBe('180px');
    expect(f.frame.style.justifyContent).toBe('normal');
    expect(f.frame.style.minHeight).toBe('106px');
    expect(f.frame.style.position).toBe('fixed');
    f.frame.style.left = '777px';
    lease.dispose();
    expect(f.frame.style.left).toBe('777px');
    expect(f.frame.style.height).toBe('23px');
    expect(f.frame.style.position).toBe('');
  });
  it('does not report missing or detached targets as successful geometry', () => {
    const f = fixture();
    f.blockTarget.remove();
    const lease = createTargetAlignmentLease(f.connection);
    expect(f.onAlignment).toHaveBeenCalledWith({
      status: 'pending-target',
      reason: 'detached-target',
    });
    expect(f.frame.style.height).toBe('');
    lease.dispose();
  });
  it('backs off after external style ownership loss, including priority-only writes', () => {
    const f = fixture();
    const lease = createTargetAlignmentLease(f.connection);
    f.frame.style.setProperty('height', f.frame.style.height, 'important');
    lease.requestUpdate();
    expect(f.onAlignment).toHaveBeenLastCalledWith({
      status: 'unavailable',
      reason: 'ownership-lost',
    });
    lease.dispose();
    expect(f.frame.style.getPropertyPriority('height')).toBe('important');
  });
  it('expands only after the first frame, writes end alignment and reads actual corrected scroll', () => {
    const f = fixture();
    let frameCallback: FrameRequestCallback | null = null;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frameCallback = callback;
      return 1;
    });
    const lease = createTargetAlignmentLease(f.connection);
    const initial = Number.parseFloat(f.frame.style.height);
    f.scrollport.scrollTop = 5;
    f.scrollport.dispatchEvent(new Event('scroll'));
    expect(Number.parseFloat(f.frame.style.height)).toBe(initial);
    const ready = frameCallback as FrameRequestCallback | null;
    if (!ready) throw new Error('Missing first-frame readiness');
    ready(0);
    f.scrollport.scrollTop = 25;
    f.scrollport.dispatchEvent(new Event('scroll'));
    expect(Number.parseFloat(f.frame.style.height)).toBe(initial + 20);
    expect(f.frame.style.justifyContent).toBe('flex-end');
    expect(f.scrollport.scrollTop).toBe(0);
    const onAlignment = vi.fn();
    lease.update({ ...f.connection, onAlignment });
    expect(Number.parseFloat(f.frame.style.height)).toBe(initial + 20);
    expect(f.frame.style.justifyContent).toBe('flex-end');
    expect(onAlignment).toHaveBeenCalledWith({ status: 'applied' });
    f.scrollport.dispatchEvent(new Event('scroll'));
    expect(Number.parseFloat(f.frame.style.height)).toBe(initial + 20);
    lease.dispose();
  });
  it('a stale same-frame lease cannot restore over a synchronously acquired successor', () => {
    const f = fixture();
    f.frame.style.height = '23px';
    let successor: ReturnType<typeof createTargetAlignmentLease> | null = null;
    const old = createTargetAlignmentLease({
      ...f.connection,
      onAlignment(status) {
        if (status.status === 'applied') successor = createTargetAlignmentLease(f.connection);
      },
    });
    const height = f.frame.style.height;
    old.dispose();
    expect(f.frame.style.height).toBe(height);
    expect(f.frame.style.position).toBe('fixed');
    const current = successor as ReturnType<typeof createTargetAlignmentLease> | null;
    if (!current) throw new Error('Missing reentrant successor');
    current.dispose();
    expect(f.frame.style.height).toBe('23px');
    expect(f.frame.style.position).toBe('');
  });
  it('ignores stale geometry after disposal', () => {
    const f = fixture();
    const lease = createTargetAlignmentLease(f.connection);
    lease.dispose();
    f.onAlignment.mockClear();
    lease.requestUpdate();
    lease.update(f.connection);
    expect(f.onAlignment).not.toHaveBeenCalled();
    expect(f.frame.style.position).toBe('');
  });
  for (const direction of ['ltr', 'rtl'] as const) {
    it(`keeps ${direction} layout alignment when the painted surface scales after applied`, () => {
      const f = fixture();
      const { blockReference, inlineReference, inlineTarget } = f.connection.targetAlignment!;
      const wrapper = document.createElement('div');
      f.surface.append(wrapper);
      wrapper.append(f.scrollport);
      dimensions(wrapper, { offsetLeft: 11, clientLeft: 3, offsetParent: f.surface });
      dimensions(f.scrollport, {
        offsetLeft: 5,
        clientLeft: 2,
        offsetParent: wrapper,
        offsetHeight: 312,
        scrollHeight: 312,
      });
      dimensions(f.blockTarget, { offsetLeft: 1, clientLeft: 1, offsetTop: 8, offsetHeight: 104 });
      dimensions(inlineTarget as HTMLElement, { offsetLeft: 1, offsetParent: f.blockTarget });
      dimensions(f.surface, { offsetHeight: 314, clientHeight: 312 });
      let width = 320;
      let referenceLeft = 41.25;
      let scale = 1;
      vi.spyOn(window, 'innerWidth', 'get').mockImplementation(() => width);
      vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(900);
      f.frame.style.direction = direction;
      const edge = direction === 'ltr' ? 'left' : 'right';
      const inset = () => Number.parseFloat(f.frame.style[edge]) || 0;
      const layoutWidth = () => Math.min(315.4375, width - inset());
      const layoutLeft = () => (direction === 'ltr' ? inset() : width - inset() - layoutWidth());
      // The CSSOM layout facts stay unscaled; the painted rectangles include the Surface transform.
      Object.defineProperty(f.surface, 'offsetWidth', {
        configurable: true,
        get: () => Math.round(layoutWidth()),
      });
      Object.defineProperty(inlineTarget, 'offsetWidth', {
        configurable: true,
        get: () => Math.round(layoutWidth() - 98),
      });
      f.frame.getBoundingClientRect = () => rect(layoutLeft(), 0, layoutWidth(), 314);
      f.surface.getBoundingClientRect = () =>
        rect(
          layoutLeft() + (layoutWidth() * (1 - scale)) / 2,
          0,
          layoutWidth() * scale,
          314 * scale
        );
      (inlineTarget as HTMLElement).getBoundingClientRect = () =>
        rect(
          f.surface.getBoundingClientRect().left + 25 * scale,
          21,
          (layoutWidth() - 98) * scale,
          80 * scale
        );
      (blockReference as HTMLElement).getBoundingClientRect = () =>
        rect(referenceLeft, 628, 238, 114);
      (inlineReference as HTMLElement).getBoundingClientRect = () =>
        rect(referenceLeft + 25, 645, 156, 80);
      const lease = createTargetAlignmentLease(f.connection);
      try {
        expect(f.onAlignment).toHaveBeenLastCalledWith({ status: 'applied' });
        expect(f.frame.style[edge]).toBe('10px');
        scale = 0.95;
        f.surface.style.transform = 'scale(0.95)';
        f.onAlignment.mockClear();
        lease.update({ ...f.connection });
        expect(f.onAlignment).toHaveBeenLastCalledWith({ status: 'applied' });
        expect(f.frame.style[edge]).toBe('10px');
        expect(f.frame.style.minWidth).toBe(direction === 'ltr' ? '238px' : '254px');
        width = 600;
        referenceLeft = 180.25;
        lease.requestUpdate();
        expect(f.frame.style[edge]).toBe(direction === 'ltr' ? '180.25px' : '165.75px');
        expect(f.onAlignment).not.toHaveBeenCalledWith({
          status: 'unavailable',
          reason: 'invalid-geometry',
        });
      } finally {
        lease.dispose();
      }
      expect(f.surface.style.transform).toBe('scale(0.95)');
    });
    it(`retains actual signed inline scrolling in ${direction}`, () => {
      const f = fixture();
      const inlineTarget = f.connection.targetAlignment!.inlineTarget as HTMLElement;
      f.frame.style.direction = direction;
      inlineTarget.getBoundingClientRect = () => rect(13 - f.scrollport.scrollLeft, 37, 50, 20);
      const lease = createTargetAlignmentLease(f.connection);
      try {
        expect(f.onAlignment).toHaveBeenLastCalledWith({ status: 'applied' });
        const scroll = direction === 'ltr' ? 5 : -5;
        f.scrollport.scrollLeft = scroll;
        expect(f.scrollport.scrollLeft).toBe(scroll);
        lease.update({ ...f.connection });
        expect(f.onAlignment).toHaveBeenLastCalledWith({ status: 'applied' });
        expect(f.frame.style[direction === 'ltr' ? 'left' : 'right']).toBe(
          direction === 'ltr' ? '185px' : `${window.innerWidth - 355}px`
        );
      } finally {
        lease.dispose();
      }
    });
  }
});

it('remeasures preceding-row wrapping after inline constraints before applied', () => {
  const f = fixture();
  Object.defineProperty(f.blockTarget, 'offsetTop', {
    configurable: true,
    get: () => (f.frame.style.minWidth ? 36 : 68),
  });
  const spans: number[] = [];
  const lease = createTargetAlignmentLease({
    ...f.connection,
    onAlignment(status) {
      if (status.status === 'applied') spans.push(Number.parseFloat(f.frame.style.height));
    },
  });
  expect(spans).toEqual([53 + (window.innerHeight - 20 - 248)]);
  lease.dispose();
});
it('checks block-constrained metrics before releasing applied', () => {
  const f = fixture();
  Object.defineProperty(f.blockTarget, 'offsetTop', {
    configurable: true,
    get: () => (f.frame.style.height ? 68 : 36),
  });
  const spans: number[] = [];
  const lease = createTargetAlignmentLease({
    ...f.connection,
    onAlignment(status) {
      if (status.status === 'applied') spans.push(Number.parseFloat(f.frame.style.height));
    },
  });
  expect(spans).toEqual([85 + (window.innerHeight - 20 - 248)]);
  lease.dispose();
});
it('does not report applied for non-settling constraint feedback', () => {
  const f = fixture();
  Object.defineProperty(f.blockTarget, 'offsetTop', {
    configurable: true,
    get: () => (Number.parseFloat(f.frame.style.height) > 570 ? 36 : 68),
  });
  const lease = createTargetAlignmentLease(f.connection);
  expect(f.onAlignment).not.toHaveBeenCalledWith({ status: 'applied' });
  expect(f.onAlignment).toHaveBeenCalledWith({ status: 'unavailable', reason: 'invalid-geometry' });
  lease.dispose();
});

// This fixture models notification selection, not native CSS layout or ResizeObserver delivery.
function controlledBoxObservers() {
  const observers: ControlledObserver[] = [];
  class ControlledObserver implements ResizeObserver {
    readonly targets = new Map<Element, ResizeObserverBoxOptions>();
    active = true;
    constructor(readonly callback: ResizeObserverCallback) {
      observers.push(this);
    }
    readonly observe = vi.fn((target: Element, options: ResizeObserverOptions = {}) => {
      this.targets.set(target, options.box ?? 'content-box');
    });
    readonly unobserve = vi.fn((target: Element) => {
      this.targets.delete(target);
    });
    readonly disconnect = vi.fn(() => {
      this.active = false;
      this.targets.clear();
    });
    notify(target: Element, changedBox: ResizeObserverBoxOptions) {
      if (this.active && this.targets.get(target) === changedBox) this.callback([], this);
    }
    replayQueued() {
      this.callback([], this);
    }
  }
  vi.stubGlobal('ResizeObserver', ControlledObserver);
  vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  return {
    observers,
    notify(target: Element, changedBox: ResizeObserverBoxOptions) {
      for (const observer of observers) observer.notify(target, changedBox);
    },
  };
}

describe('neutral target geometry box-observation contract', () => {
  it('observes the independent literal target set once for each measured box', () => {
    const control = controlledBoxObservers();
    const f = fixture();
    const targets = f.connection.targetAlignment!;
    const expected = [
      f.frame,
      f.surface,
      f.scrollport,
      targets.blockReference,
      targets.inlineReference,
      f.blockTarget,
      targets.inlineTarget,
    ];
    const lease = createTargetAlignmentLease(f.connection);
    try {
      expect(control.observers).toHaveLength(2);
      for (const [index, box] of ['content-box', 'border-box'].entries()) {
        expect(control.observers[index].observe.mock.calls).toEqual(
          expected.map((target) => [target, { box }])
        );
      }
    } finally {
      lease.dispose();
    }
    for (const observer of control.observers) expect(observer.disconnect).toHaveBeenCalledOnce();
  });

  it('deduplicates aliased physical target identities separately for both boxes', () => {
    const control = controlledBoxObservers();
    const f = fixture();
    const targets = f.connection.targetAlignment!;
    const lease = createTargetAlignmentLease({
      ...f.connection,
      targetAlignment: { ...targets, inlineTarget: f.blockTarget },
    });
    try {
      expect(control.observers).toHaveLength(2);
      for (const observer of control.observers) {
        expect(observer.observe).toHaveBeenCalledTimes(6);
        expect(
          observer.observe.mock.calls.filter(([target]) => target === f.blockTarget)
        ).toHaveLength(1);
      }
    } finally {
      lease.dispose();
    }
  });

  for (const changedPart of ['border', 'padding'] as const) {
    it(`remeasures ${changedPart}-only reference growth without an unrelated resize or scroll`, () => {
      const control = controlledBoxObservers();
      const f = fixture();
      const reference = f.connection.targetAlignment!.blockReference as HTMLElement;
      const contentWidth = 176;
      let border = 2;
      let padding = 0;
      reference.getBoundingClientRect = () =>
        rect(180, 240, contentWidth + 2 * border + 2 * padding, 36);
      const lease = createTargetAlignmentLease(f.connection);
      try {
        expect(f.frame.style.minWidth).toBe('180px');
        if (changedPart === 'border') border = 12;
        else padding = 10;
        expect(f.frame.style.minWidth).toBe('180px');
        control.notify(reference, 'border-box');
        expect(f.frame.style.minWidth).toBe('200px');
      } finally {
        lease.dispose();
      }
    });
  }

  it('retains content-only invalidation when a fixed outer box gains inner padding', () => {
    const control = controlledBoxObservers();
    const f = fixture();
    const lease = createTargetAlignmentLease(f.connection);
    try {
      expect(f.frame.style.minHeight).toBe('106px');
      // Explicit fixture facts: outer Surface/scrollport sizes stay fixed. Only inner position
      // and the Surface content box change; no observed target has a border-box size change.
      f.surface.style.paddingTop = '4px';
      dimensions(f.scrollport, { offsetTop: 4 });
      expect(f.surface.offsetHeight).toBe(106);
      expect(f.scrollport.offsetHeight).toBe(104);
      expect(f.frame.style.minHeight).toBe('106px');
      control.notify(f.surface, 'content-box');
      expect(f.frame.style.minHeight).toBe('110px');
    } finally {
      lease.dispose();
    }
  });

  it('keeps ordinary content growth observable without extra applied notifications', () => {
    const control = controlledBoxObservers();
    const f = fixture();
    const reference = f.connection.targetAlignment!.blockReference as HTMLElement;
    let contentWidth = 176;
    reference.getBoundingClientRect = () => rect(180, 240, contentWidth + 4, 36);
    const lease = createTargetAlignmentLease(f.connection);
    try {
      expect(f.frame.style.minWidth).toBe('180px');
      f.onAlignment.mockClear();
      contentWidth = 196;
      control.notify(reference, 'content-box');
      control.notify(reference, 'border-box');
      expect(f.frame.style.minWidth).toBe('200px');
      expect(f.onAlignment).not.toHaveBeenCalled();
    } finally {
      lease.dispose();
    }
  });

  it('retires both old observers on target replacement while the new pair remains usable', () => {
    const control = controlledBoxObservers();
    const first = fixture();
    const second = fixture();
    const lease = createTargetAlignmentLease(first.connection);
    const oldObservers = [...control.observers];
    try {
      lease.update(second.connection);
      expect(control.observers).toHaveLength(4);
      for (const observer of oldObservers) expect(observer.disconnect).toHaveBeenCalledOnce();
      expect(first.frame.style.minWidth).toBe('');
      second.onAlignment.mockClear();
      const reference = second.connection.targetAlignment!.blockReference as HTMLElement;
      reference.getBoundingClientRect = () => rect(180, 240, 200, 36);
      for (const observer of oldObservers) observer.replayQueued();
      expect(first.frame.style.minWidth).toBe('');
      expect(second.frame.style.minWidth).toBe('180px');
      expect(second.onAlignment).not.toHaveBeenCalled();
      control.notify(reference, 'border-box');
      expect(second.frame.style.minWidth).toBe('200px');
    } finally {
      lease.dispose();
    }
  });

  it('does not let queued callbacks overwrite author styles after disposal', () => {
    const control = controlledBoxObservers();
    const f = fixture();
    const lease = createTargetAlignmentLease(f.connection);
    lease.dispose();
    f.frame.style.minWidth = '777px';
    f.onAlignment.mockClear();
    for (const observer of control.observers) {
      expect(observer.disconnect).toHaveBeenCalledOnce();
      observer.replayQueued();
    }
    expect(f.frame.style.minWidth).toBe('777px');
    expect(f.onAlignment).not.toHaveBeenCalled();
  });

  it('measures current geometry on reopen and ignores the preceding pair', () => {
    const control = controlledBoxObservers();
    const f = fixture();
    const reference = f.connection.targetAlignment!.blockReference as HTMLElement;
    let width = 180;
    reference.getBoundingClientRect = () => rect(180, 240, width, 36);
    const first = createTargetAlignmentLease(f.connection);
    const oldObservers = [...control.observers];
    first.dispose();
    width = 200;
    const reopened = createTargetAlignmentLease(f.connection);
    try {
      expect(control.observers).toHaveLength(4);
      expect(f.frame.style.minWidth).toBe('200px');
      width = 300;
      for (const observer of oldObservers) observer.replayQueued();
      expect(f.frame.style.minWidth).toBe('200px');
      control.notify(reference, 'border-box');
      expect(f.frame.style.minWidth).toBe('300px');
    } finally {
      reopened.dispose();
    }
  });
});
