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
// Deterministic used-layout facts, not a native CSS layout engine. The row
// cannot grow until the same host has installed the containing minimum span.
function sizingFixture() {
  const f = fixture();
  const reference = f.connection.targetAlignment!.blockReference as HTMLElement;
  let width = 340;
  let ready = true;
  let maximumRowWidth = Infinity;
  dimensions(reference, { offsetHeight: 44 });
  Object.defineProperty(reference, 'offsetWidth', { configurable: true, get: () => width });
  reference.getBoundingClientRect = () => rect(180, 240, width, 44);
  f.surface.style.margin = '0px';
  f.scrollport.style.border = '0px';
  f.scrollport.style.margin = '0px';
  f.blockTarget.style.margin = '0px';
  const get = (node: HTMLElement, key: string, read: () => number) =>
    Object.defineProperty(node, key, { configurable: true, get: read });
  get(f.surface, 'offsetWidth', () =>
    Math.max(180, Number.parseFloat(f.frame.style.minWidth) || 0)
  );
  get(f.surface, 'clientWidth', () => f.surface.offsetWidth - 2);
  get(f.scrollport, 'offsetWidth', () => f.surface.clientWidth);
  get(f.scrollport, 'clientWidth', () => f.scrollport.offsetWidth);
  get(f.blockTarget, 'offsetWidth', () =>
    Math.min(
      Number.parseFloat(f.blockTarget.style.width) || 32,
      f.scrollport.clientWidth - 8,
      maximumRowWidth
    )
  );
  get(f.blockTarget, 'offsetHeight', () =>
    ready ? Number.parseFloat(f.blockTarget.style.height) || 32 : 0
  );
  get(f.blockTarget, 'clientWidth', () => f.blockTarget.offsetWidth);
  get(f.blockTarget, 'scrollWidth', () => f.blockTarget.clientWidth);
  get(f.blockTarget, 'clientHeight', () => f.blockTarget.offsetHeight);
  get(f.blockTarget, 'scrollHeight', () => f.blockTarget.clientHeight);
  const connection: AnchoredPositionConnection = {
    ...f.connection,
    targetAlignment: {
      ...f.connection.targetAlignment!,
      sizeMatch: { reference, targets: [f.blockTarget] },
    },
  };
  return {
    ...f,
    connection,
    setReady(value: boolean) {
      ready = value;
    },
    resize(value: number) {
      width = value;
    },
    constrainRow(value: number) {
      maximumRowWidth = value;
    },
  };
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// Injected CSSOM viewport facts distinguish unavailable layout from ownership.
// Native full-page capture and focus recovery are verified separately.
describe('recoverable viewport absence', () => {
  it.each([
    { width: 1000, height: 0, root: false },
    { width: 1, height: 1, root: false },
    { width: 1000, height: 19, root: false },
    { width: 1000, height: 20, root: false },
    { width: 0, height: 800, root: false },
    { width: 1, height: 1, root: true },
  ])('retains current claims through $width x $height (root CSSOM: $root)', (missing) => {
    const control = controlledBoxObservers();
    let width = 1000,
      height = 800,
      rootWidth = 0,
      rootHeight = 0;
    vi.stubGlobal('innerWidth', width);
    vi.stubGlobal('innerHeight', height);
    const root = document.documentElement;
    const originalRootFields = ['clientWidth', 'clientHeight'].map(
      (name) => [name, Object.getOwnPropertyDescriptor(root, name)] as const
    );
    Object.defineProperty(root, 'clientWidth', { configurable: true, get: () => rootWidth });
    Object.defineProperty(root, 'clientHeight', { configurable: true, get: () => rootHeight });
    const f = sizingFixture();
    f.frame.style.height = '23px';
    const originalFrame = f.frame.getAttribute('style');
    const originalRow = f.blockTarget.getAttribute('style');
    const lease = createTargetAlignmentLease(f.connection);
    try {
      expect(f.onAlignment).toHaveBeenLastCalledWith({ status: 'applied' });
      const frame = f.frame.getAttribute('style'),
        row = f.blockTarget.getAttribute('style');
      vi.mocked(window.requestAnimationFrame).mock.calls[0]![0](0);
      if (missing.root) {
        rootWidth = missing.width;
        rootHeight = missing.height;
      } else {
        width = missing.width;
        height = missing.height;
      }
      vi.stubGlobal('innerWidth', width);
      vi.stubGlobal('innerHeight', height);
      lease.requestUpdate();
      expect(f.onAlignment).toHaveBeenLastCalledWith({
        status: 'pending-target',
        reason: 'missing-target',
      });
      f.scrollport.scrollTop = 20;
      f.scrollport.dispatchEvent(new Event('scroll'));
      expect(f.frame.getAttribute('style')).toBe(frame);
      expect(f.blockTarget.getAttribute('style')).toBe(row);
      expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
      width = 1000;
      height = 800;
      rootWidth = 0;
      rootHeight = 0;
      vi.stubGlobal('innerWidth', width);
      vi.stubGlobal('innerHeight', height);
      f.resize(208);
      const reference = f.connection.targetAlignment!.blockReference as HTMLElement;
      reference.getBoundingClientRect = () => rect(260, 180, 208, 44);
      control.notify(reference, 'border-box');
      expect(f.onAlignment).toHaveBeenLastCalledWith({ status: 'applied' });
      // The authored Surface border sits outside the target's aligned edge.
      expect(Number.parseFloat(f.frame.style.left) + f.surface.clientLeft).toBe(260);
      expect(f.frame.style.minWidth).toBe('218px');
      expect([f.blockTarget.offsetWidth, f.blockTarget.offsetHeight]).toEqual([208, 44]);
      expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
    } finally {
      lease.dispose();
      for (const [name, descriptor] of originalRootFields) {
        if (descriptor) Object.defineProperty(root, name, descriptor);
        else Reflect.deleteProperty(root, name);
      }
    }
    expect(f.frame.getAttribute('style')).toBe(originalFrame);
    expect(f.blockTarget.getAttribute('style')).toBe(originalRow);
  });

  it.each(['frame', 'row'] as const)('still rejects a foreign %s write while pending', (part) => {
    controlledBoxObservers();
    let height = 800;
    vi.stubGlobal('innerHeight', height);
    const f = sizingFixture();
    const lease = createTargetAlignmentLease(f.connection);
    const target = part === 'frame' ? f.frame : f.blockTarget;
    const field = part === 'frame' ? 'min-width' : 'width';
    try {
      height = 1;
      vi.stubGlobal('innerHeight', height);
      lease.requestUpdate();
      expect(f.onAlignment).toHaveBeenLastCalledWith({
        status: 'pending-target',
        reason: 'missing-target',
      });
      const sameValue = target.style.getPropertyValue(field);
      target.style.setProperty(field, sameValue, 'important');
      lease.requestUpdate();
      expect(f.onAlignment).toHaveBeenLastCalledWith({
        status: 'unavailable',
        reason: 'ownership-lost',
      });
      height = 800;
      vi.stubGlobal('innerHeight', height);
      lease.requestUpdate();
      expect(f.onAlignment).toHaveBeenLastCalledWith({
        status: 'unavailable',
        reason: 'ownership-lost',
      });
      expect(target.style.getPropertyValue(field)).toBe(sameValue);
      expect(target.style.getPropertyPriority(field)).toBe('important');
    } finally {
      lease.dispose();
    }
    expect(target.style.getPropertyPriority(field)).toBe('important');
  });

  it('does not let an initially pending generation reclaim a successor frame', () => {
    controlledBoxObservers();
    let height = 1;
    vi.stubGlobal('innerHeight', height);
    const f = sizingFixture();
    const priorStatus = vi.fn(),
      currentStatus = vi.fn();
    const prior = createTargetAlignmentLease({ ...f.connection, onAlignment: priorStatus });
    let current: ReturnType<typeof createTargetAlignmentLease> | undefined;
    try {
      expect(priorStatus).toHaveBeenLastCalledWith({
        status: 'pending-target',
        reason: 'missing-target',
      });
      expect(f.frame.style.position).toBe('');
      expect(f.blockTarget.style.width).toBe('');
      height = 800;
      vi.stubGlobal('innerHeight', height);
      current = createTargetAlignmentLease({ ...f.connection, onAlignment: currentStatus });
      expect(currentStatus).toHaveBeenLastCalledWith({ status: 'applied' });
      const frame = f.frame.getAttribute('style'),
        row = f.blockTarget.getAttribute('style');
      prior.requestUpdate();
      expect(priorStatus).toHaveBeenLastCalledWith({
        status: 'unavailable',
        reason: 'ownership-lost',
      });
      prior.dispose();
      expect(f.frame.getAttribute('style')).toBe(frame);
      expect(f.blockTarget.getAttribute('style')).toBe(row);
      current.requestUpdate();
      expect(currentStatus).toHaveBeenLastCalledWith({ status: 'applied' });
    } finally {
      prior.dispose();
      current?.dispose();
    }
  });

  it('cannot recover a disposed pending viewport lease through queued observations', () => {
    const control = controlledBoxObservers();
    let height = 800;
    vi.stubGlobal('innerHeight', height);
    const f = sizingFixture();
    const lease = createTargetAlignmentLease(f.connection);
    height = 1;
    vi.stubGlobal('innerHeight', height);
    lease.requestUpdate();
    const calls = f.onAlignment.mock.calls.length;
    lease.dispose();
    f.frame.style.left = '901px';
    f.blockTarget.style.height = '73px';
    height = 800;
    vi.stubGlobal('innerHeight', height);
    for (const observer of control.observers) observer.replayQueued();
    lease.requestUpdate();
    expect(f.onAlignment).toHaveBeenCalledTimes(calls);
    expect(f.frame.style.left).toBe('901px');
    expect(f.blockTarget.style.height).toBe('73px');
  });

  it.each([
    { width: -1, height: 1 },
    { width: 1000, height: -1 },
    { width: 1000, height: Number.NaN },
    { width: Number.POSITIVE_INFINITY, height: 1 },
  ])('keeps invalid viewport $width x $height terminal', ({ width, height }) => {
    controlledBoxObservers();
    vi.stubGlobal('innerWidth', width);
    vi.stubGlobal('innerHeight', height);
    const f = sizingFixture();
    const lease = createTargetAlignmentLease(f.connection);
    try {
      expect(f.onAlignment).toHaveBeenLastCalledWith({
        status: 'unavailable',
        reason: 'invalid-geometry',
      });
      expect(f.onAlignment).not.toHaveBeenCalledWith({ status: 'applied' });
      expect(f.frame.style.maxHeight).toBe('');
    } finally {
      lease.dispose();
    }
  });
});

describe('neutral target geometry host', () => {
  for (const change of ['outer scroll', 'reference resize'] as const) {
    it(`retires expanded end alignment before a new reference plan after ${change}`, () => {
      const f = sizingFixture();
      const reference = f.connection.targetAlignment!.blockReference as HTMLElement;
      let referenceTop = 240;
      let naturalContentHeight = 600;
      reference.getBoundingClientRect = () => rect(180, referenceTop, reference.offsetWidth, 44);
      let frameCallback: FrameRequestCallback | null = null;
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
        frameCallback = callback;
        return 1;
      });
      // Explicit one-child flex layout simulation, not browser rendering.
      // Initially the Frame constrains a taller Surface, making inner scroll
      // possible. Moving the reference or reflowing content later leaves free
      // space. Derive the row's top from host writes, not expected alignment.
      const frameHeight = () =>
        Math.max(
          Number.parseFloat(f.frame.style.minHeight) || 0,
          Math.min(
            Number.parseFloat(f.frame.style.height) || naturalContentHeight + 2,
            Number.parseFloat(f.frame.style.maxHeight) || Infinity
          )
        );
      const get = (node: HTMLElement, key: string, read: () => number) =>
        Object.defineProperty(node, key, { configurable: true, get: read });
      get(f.surface, 'offsetHeight', () => Math.min(naturalContentHeight + 2, frameHeight()));
      get(f.surface, 'clientHeight', () => f.surface.offsetHeight - 2);
      get(f.scrollport, 'offsetHeight', () => f.surface.clientHeight);
      get(f.scrollport, 'clientHeight', () => f.scrollport.offsetHeight);
      get(f.scrollport, 'scrollHeight', () => naturalContentHeight);
      let actualScroll = 0;
      Object.defineProperty(f.scrollport, 'scrollTop', {
        configurable: true,
        get: () => actualScroll,
        set: (value: number) => {
          actualScroll = Math.max(
            0,
            Math.min(value, f.scrollport.scrollHeight - f.scrollport.clientHeight)
          );
        },
      });
      const rowTop = () => {
        const margin = Number.parseFloat(f.frame.style.marginTop);
        const usedHeight = frameHeight();
        const frameTop = f.frame.style.bottom ? window.innerHeight - margin - usedHeight : margin;
        const surfaceTop =
          f.frame.style.justifyContent === 'flex-end'
            ? Math.max(0, usedHeight - f.surface.offsetHeight)
            : 0;
        return (
          frameTop +
          surfaceTop +
          f.surface.clientTop +
          f.blockTarget.offsetTop -
          f.scrollport.scrollTop
        );
      };
      f.frame.style.justifyContent = 'flex-start';
      const lease = createTargetAlignmentLease(f.connection);
      try {
        expect(f.onAlignment).toHaveBeenLastCalledWith({ status: 'applied' });
        expect(rowTop()).toBe(referenceTop);
        const ready = frameCallback as FrameRequestCallback | null;
        if (!ready) throw new Error('Missing first-frame readiness');
        ready(0);
        expect(f.scrollport.scrollHeight - f.scrollport.clientHeight).toBeGreaterThanOrEqual(25);
        f.scrollport.scrollTop = 25;
        expect(f.scrollport.scrollTop).toBe(25);
        f.scrollport.dispatchEvent(new Event('scroll'));
        expect(f.frame.style.justifyContent).toBe('flex-end');
        const expandedHeight = f.frame.style.height;
        const expandedRowTop = rowTop();
        // Same-reference refresh is not a new plan: preserve expansion.
        lease.update({ ...f.connection });
        expect(f.frame.style.height).toBe(expandedHeight);
        expect(f.frame.style.justifyContent).toBe('flex-end');
        expect(rowTop()).toBe(expandedRowTop);
        if (change === 'outer scroll') {
          referenceTop -= 180;
          document.dispatchEvent(new Event('scroll'));
        } else {
          // A wider reference also reflows the ordinary unsized rows.
          f.resize(500);
          naturalContentHeight = 400;
          window.dispatchEvent(new Event('resize'));
        }
        expect(frameHeight()).toBeGreaterThan(f.surface.offsetHeight);
        expect(rowTop()).toBe(referenceTop);
        expect(f.frame.style.justifyContent).toBe('normal');
        expect(f.scrollport.scrollTop).toBe(0);
        // A follow-up notification must not restore stale expansion state.
        lease.requestUpdate();
        expect(rowTop()).toBe(referenceTop);
      } finally {
        lease.dispose();
      }
      expect(f.frame.style.justifyContent).toBe('flex-start');
    });
  }
  it('moves the sized row with its reference after outer scroll and restores the frame width lease', () => {
    const f = sizingFixture();
    dimensions(f.blockTarget, { offsetLeft: 4 });
    const reference = f.connection.targetAlignment!.blockReference as HTMLElement;
    let top = 240;
    reference.getBoundingClientRect = () => rect(180, top, 340, 44);
    const lease = createTargetAlignmentLease(f.connection);
    expect(f.onAlignment).toHaveBeenLastCalledWith({ status: 'applied' });
    expect(f.frame.style.left).toBe('175px');
    expect(f.frame.style.width).toBe('350px');
    const before = Number.parseFloat(f.frame.style.height);
    top += 40;
    document.dispatchEvent(new Event('scroll'));
    expect(Number.parseFloat(f.frame.style.height)).toBe(before - 40);
    top -= 40;
    window.dispatchEvent(new Event('resize'));
    expect(Number.parseFloat(f.frame.style.height)).toBe(before);
    lease.dispose();
    expect(f.frame.style.width).toBe('');
  });
  it('rejects a matched row clipped by an independently constrained viewport', () => {
    const f = sizingFixture();
    f.resize(180);
    // Controlled CSSOM facts: the row keeps its requested border box while
    // an authored Surface maximum prevents its clipping viewport from growing.
    f.surface.style.maxWidth = '160px';
    f.scrollport.style.overflowX = 'hidden';
    dimensions(f.surface, { offsetWidth: 160, clientWidth: 158 });
    dimensions(f.scrollport, { offsetWidth: 158, clientWidth: 150 });
    Object.defineProperty(f.blockTarget, 'offsetWidth', {
      configurable: true,
      get: () => Number.parseFloat(f.blockTarget.style.width) || 32,
    });
    const lease = createTargetAlignmentLease(f.connection);
    try {
      expect(f.onAlignment).toHaveBeenLastCalledWith({
        status: 'unavailable',
        reason: 'size-conflict',
      });
      expect(f.onAlignment.mock.calls.some(([status]) => status.status === 'applied')).toBe(false);
      expect([f.blockTarget.style.width, f.blockTarget.style.height]).toEqual(['', '']);
      expect(f.surface.style.maxWidth).toBe('160px');
      expect(f.scrollport.style.overflowX).toBe('hidden');
    } finally {
      lease.dispose();
    }
  });

  it('rolls back size writes before reporting a failed containing-layout plan', () => {
    const f = sizingFixture();
    const atFailure: string[][] = [];
    const lease = createTargetAlignmentLease({
      ...f.connection,
      onAlignment(status) {
        f.onAlignment(status);
        if (status.status === 'unavailable')
          atFailure.push([f.blockTarget.style.width, f.blockTarget.style.height]);
      },
    });
    expect(f.onAlignment).toHaveBeenLastCalledWith({ status: 'applied' });
    // Keep the row connected but invalidate its containing-layout association.
    document.body.append(f.scrollport);
    lease.requestUpdate();
    expect(f.onAlignment).toHaveBeenLastCalledWith({
      status: 'unavailable',
      reason: 'invalid-geometry',
    });
    expect(atFailure).toEqual([['', '']]);
    expect([f.blockTarget.style.width, f.blockTarget.style.height]).toEqual(['', '']);
    f.surface.append(f.scrollport);
    lease.requestUpdate();
    expect(f.onAlignment).toHaveBeenLastCalledWith({
      status: 'unavailable',
      reason: 'invalid-geometry',
    });
    expect([f.blockTarget.style.width, f.blockTarget.style.height]).toEqual(['', '']);
    lease.dispose();
  });

  it('rolls back owned row sizing but preserves a frame author override on admission failure', () => {
    const f = sizingFixture();
    const atFailure: string[][] = [];
    const lease = createTargetAlignmentLease({
      ...f.connection,
      onAlignment(status) {
        f.onAlignment(status);
        if (status.status === 'unavailable')
          atFailure.push([f.blockTarget.style.width, f.blockTarget.style.height]);
      },
    });
    expect(f.onAlignment).toHaveBeenLastCalledWith({ status: 'applied' });
    f.frame.style.setProperty('min-width', '900px', 'important');
    lease.requestUpdate();
    expect(f.onAlignment).toHaveBeenLastCalledWith({
      status: 'unavailable',
      reason: 'ownership-lost',
    });
    expect(atFailure).toEqual([['', '']]);
    expect([f.blockTarget.style.width, f.blockTarget.style.height]).toEqual(['', '']);
    lease.dispose();
    expect(f.frame.style.getPropertyValue('min-width')).toBe('900px');
    expect(f.frame.style.getPropertyPriority('min-width')).toBe('important');
  });

  it('recovers an initially missing reference box through the same current host lease', () => {
    const control = controlledBoxObservers();
    const f = sizingFixture();
    const reference = f.connection.targetAlignment!.blockReference as HTMLElement;
    f.resize(0);
    const lease = createTargetAlignmentLease(f.connection);
    expect(f.onAlignment).toHaveBeenLastCalledWith({
      status: 'pending-target',
      reason: 'missing-target',
    });
    expect(f.onAlignment.mock.calls.some(([status]) => status.status === 'applied')).toBe(false);
    expect(f.blockTarget.style.width).toBe('');
    f.resize(208);
    control.notify(reference, 'border-box');
    expect(f.onAlignment).toHaveBeenLastCalledWith({ status: 'applied' });
    expect([f.blockTarget.offsetWidth, f.blockTarget.offsetHeight]).toEqual([208, 44]);
    expect(f.frame.style.minWidth).toBe('218px');
    lease.dispose();
  });

  it('reports recovered applied status after layout disappears without scheduling another entry frame', () => {
    const control = controlledBoxObservers();
    const f = sizingFixture();
    const reference = f.connection.targetAlignment!.blockReference as HTMLElement;
    const lease = createTargetAlignmentLease(f.connection);
    expect(f.onAlignment).toHaveBeenLastCalledWith({ status: 'applied' });
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
    f.resize(0);
    control.notify(reference, 'border-box');
    expect(f.onAlignment).toHaveBeenLastCalledWith({
      status: 'pending-target',
      reason: 'missing-target',
    });
    f.resize(208);
    control.notify(reference, 'border-box');
    expect(f.onAlignment).toHaveBeenLastCalledWith({ status: 'applied' });
    expect(f.onAlignment.mock.calls.map(([status]) => status.status)).toEqual([
      'applied',
      'pending-target',
      'applied',
    ]);
    expect([f.blockTarget.offsetWidth, f.blockTarget.offsetHeight]).toEqual([208, 44]);
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
    control.notify(reference, 'content-box');
    expect(f.onAlignment).toHaveBeenCalledTimes(3);
    lease.dispose();
  });

  it('does not resume a pending lease after disposal or overwrite an author edit', () => {
    const control = controlledBoxObservers();
    const f = sizingFixture();
    f.resize(0);
    const lease = createTargetAlignmentLease(f.connection);
    expect(f.onAlignment).toHaveBeenLastCalledWith({
      status: 'pending-target',
      reason: 'missing-target',
    });
    lease.dispose();
    f.blockTarget.style.height = '73px';
    f.resize(208);
    for (const observer of control.observers) observer.replayQueued();
    lease.requestUpdate();
    expect(f.onAlignment).toHaveBeenCalledTimes(1);
    expect(f.blockTarget.style.height).toBe('73px');
    expect(f.blockTarget.style.width).toBe('');
  });

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
  it('admits matching row width and height only after the containing span is installed', () => {
    const f = sizingFixture();
    const lease = createTargetAlignmentLease(f.connection);
    expect(f.onAlignment).toHaveBeenLastCalledWith({ status: 'applied' });
    expect(f.frame.style.minWidth).toBe('350px');
    expect([f.blockTarget.offsetWidth, f.blockTarget.offsetHeight]).toEqual([340, 44]);
    f.resize(208);
    lease.requestUpdate();
    expect([f.blockTarget.offsetWidth, f.blockTarget.offsetHeight]).toEqual([208, 44]);
    f.resize(132);
    lease.requestUpdate();
    expect([f.blockTarget.offsetWidth, f.blockTarget.offsetHeight]).toEqual([132, 44]);
    expect(f.frame.style.width).toBe('142px');
    expect(f.onAlignment.mock.calls.every(([status]) => status.status !== 'unavailable')).toBe(
      true
    );
    lease.dispose();
    expect(f.blockTarget.style.width).toBe('');
    expect(f.blockTarget.style.height).toBe('');
  });

  it('keeps missing row layout pending and can admit the same lease when actual layout appears', () => {
    const f = sizingFixture();
    f.setReady(false);
    const lease = createTargetAlignmentLease(f.connection);
    expect(f.onAlignment).toHaveBeenLastCalledWith({
      status: 'pending-target',
      reason: 'missing-target',
    });
    expect(f.onAlignment.mock.calls.some(([status]) => status.status === 'applied')).toBe(false);
    f.setReady(true);
    lease.requestUpdate();
    expect(f.onAlignment).toHaveBeenLastCalledWith({ status: 'applied' });
    expect([f.blockTarget.offsetWidth, f.blockTarget.offsetHeight]).toEqual([340, 44]);
    lease.dispose();
  });

  it('still rejects a real row max-size conflict after solving the outer constraints', () => {
    const f = sizingFixture();
    f.constrainRow(320);
    const lease = createTargetAlignmentLease(f.connection);
    expect(f.frame.style.minWidth).toBe('350px');
    expect(f.onAlignment).toHaveBeenLastCalledWith({
      status: 'unavailable',
      reason: 'size-conflict',
    });
    expect(f.onAlignment.mock.calls.some(([status]) => status.status === 'applied')).toBe(false);
    expect(f.blockTarget.style.width).toBe('');
    expect(f.blockTarget.style.height).toBe('');
    lease.dispose();
  });

  it('re-solves a reference resize at final readback instead of admitting the older plan', () => {
    const f = sizingFixture();
    const reference = f.connection.targetAlignment!.blockReference as HTMLElement;
    let reads = 0;
    let boundary: { minimumSpan: string; rowWidth: string } | undefined;
    // Deterministic layout-read seam: the sixth read is after the first
    // constrained/settled plan, at final size verification. Not native evidence.
    Object.defineProperty(reference, 'offsetWidth', {
      configurable: true,
      get() {
        reads++;
        if (reads === 6) {
          boundary = { minimumSpan: f.frame.style.minWidth, rowWidth: f.blockTarget.style.width };
          f.resize(208);
        }
        return reads >= 6 ? 208 : 340;
      },
    });
    const lease = createTargetAlignmentLease(f.connection);
    expect(reads).toBeGreaterThan(6);
    expect(boundary).toEqual({ minimumSpan: '350px', rowWidth: '340px' });
    expect(f.onAlignment).toHaveBeenLastCalledWith({ status: 'applied' });
    expect(f.frame.style.minWidth).toBe('218px');
    expect([f.blockTarget.offsetWidth, f.blockTarget.offsetHeight]).toEqual([208, 44]);
    lease.dispose();
  });

  it('does not report applied when reference layout never stabilizes within the existing passes', () => {
    const f = sizingFixture();
    const reference = f.connection.targetAlignment!.blockReference as HTMLElement;
    let reads = 0;
    Object.defineProperty(reference, 'offsetWidth', {
      configurable: true,
      get() {
        reads++;
        const width = reads % 2 ? 340 : 208;
        f.resize(width);
        return width;
      },
    });
    const atFailure: string[][] = [];
    const lease = createTargetAlignmentLease({
      ...f.connection,
      onAlignment(status) {
        f.onAlignment(status);
        if (status.status === 'unavailable')
          atFailure.push([f.blockTarget.style.width, f.blockTarget.style.height]);
      },
    });
    expect(f.onAlignment).toHaveBeenLastCalledWith({
      status: 'unavailable',
      reason: 'invalid-geometry',
    });
    expect(f.onAlignment.mock.calls.some(([status]) => status.status === 'applied')).toBe(false);
    expect(reads).toBeLessThanOrEqual(32);
    expect(atFailure).toEqual([['', '']]);
    expect([f.blockTarget.style.width, f.blockTarget.style.height]).toEqual(['', '']);
    lease.dispose();
    expect(f.blockTarget.style.width).toBe('');
    expect(f.blockTarget.style.height).toBe('');
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
        expect(f.frame.style.minWidth).toBe('238px');
        width = 600;
        referenceLeft = 180.25;
        lease.requestUpdate();
        expect(f.frame.style[edge]).toBe(direction === 'ltr' ? '180.25px' : '181.75px');
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
          direction === 'ltr' ? '180px' : `${window.innerWidth - 360}px`
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
    observing(target: Element) {
      // Retain the registration history after disconnect clears the live targets.
      return observers.filter((observer) =>
        observer.observe.mock.calls.some(([observed]) => observed === target)
      );
    },
    notify(target: Element, changedBox: ResizeObserverBoxOptions) {
      for (const observer of observers) observer.notify(target, changedBox);
    },
  };
}

// Controlled root/body layout facts. These model notification selection and
// current-reference readback; native browser tests own actual scrollbar layout.
function rootSpaceGeometry() {
  const root = document.documentElement,
    body = document.body;
  let rootWidth = 900,
    bodyWidth = 900,
    bodyLeft = 0;
  vi.spyOn(root, 'clientWidth', 'get').mockImplementation(() => rootWidth);
  vi.spyOn(root, 'getBoundingClientRect').mockImplementation(() => rect(0, 0, rootWidth, 768));
  vi.spyOn(body, 'clientWidth', 'get').mockImplementation(() => bodyWidth);
  vi.spyOn(body, 'getBoundingClientRect').mockImplementation(() =>
    rect(bodyLeft, 0, bodyWidth, 768)
  );
  return {
    root,
    body,
    referenceLeft(source: 'root' | 'body') {
      return source === 'root' ? rootWidth / 2 : bodyLeft + bodyWidth / 2;
    },
    resize(source: 'root' | 'body', width: number) {
      if (source === 'root') rootWidth = width;
      else bodyWidth = width;
    },
    moveBody(left: number) {
      bodyLeft = left;
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
      const boxes = control.observing(f.frame);
      const roots = control.observing(document.documentElement);
      expect(boxes).toHaveLength(2);
      expect(roots).toHaveLength(1);
      expect(new Set(control.observers)).toEqual(new Set([...boxes, ...roots]));
      for (const [index, box] of ['content-box', 'border-box'].entries()) {
        expect(boxes[index].observe.mock.calls).toEqual(
          expected.map((target) => [target, { box }])
        );
      }
      expect(roots[0].observe.mock.calls).toEqual([[document.documentElement], [document.body]]);
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
      const boxes = control.observing(f.frame);
      const roots = control.observing(document.documentElement);
      expect(boxes).toHaveLength(2);
      expect(roots).toHaveLength(1);
      expect(new Set(control.observers)).toEqual(new Set([...boxes, ...roots]));
      for (const observer of boxes) {
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
      const oldBoxes = control.observing(first.frame);
      const newBoxes = control.observing(second.frame);
      const roots = control.observing(document.documentElement);
      expect(oldBoxes).toHaveLength(2);
      expect(newBoxes).toHaveLength(2);
      expect(roots).toHaveLength(2);
      expect(new Set(control.observers)).toEqual(new Set([...oldBoxes, ...newBoxes, ...roots]));
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
      const boxes = control.observing(f.frame);
      const roots = control.observing(document.documentElement);
      expect(boxes).toHaveLength(4);
      expect(roots).toHaveLength(2);
      expect(new Set(control.observers)).toEqual(new Set([...boxes, ...roots]));
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

describe('neutral target geometry root-space observation', () => {
  for (const source of ['root', 'body'] as const) {
    for (const direction of ['ltr', 'rtl'] as const) {
      it(`remeasures a fixed-size reference after ${source}-only geometry changes in ${direction}`, () => {
        const control = controlledBoxObservers();
        const space = rootSpaceGeometry();
        const f = fixture();
        f.frame.style.direction = direction;
        const reference = f.connection.targetAlignment!.blockReference as HTMLElement;
        const measure = vi.fn(() => rect(space.referenceLeft(source), 240, 180, 36));
        reference.getBoundingClientRect = measure;
        const lease = createTargetAlignmentLease(f.connection);
        const edge = direction === 'ltr' ? 'left' : 'right';
        try {
          expect(f.frame.style[edge]).toBe(direction === 'ltr' ? '450px' : '270px');
          expect(f.onAlignment).toHaveBeenLastCalledWith({ status: 'applied' });
          measure.mockClear();
          f.onAlignment.mockClear();
          control.notify(space[source], 'content-box');
          expect(measure).not.toHaveBeenCalled();

          // No frame/target size change, scroll, resize or manual lease update:
          // only the page containing geometry changes this reference's origin.
          space.resize(source, 870);
          expect(f.frame.style[edge]).toBe(direction === 'ltr' ? '450px' : '270px');
          control.notify(space[source], 'content-box');
          expect(f.frame.style[edge]).toBe(
            direction === 'ltr' ? '435px' : source === 'root' ? '255px' : '285px'
          );
          expect(f.frame.style.minWidth).toBe('180px');
          expect(measure).toHaveBeenCalled();
          expect(f.onAlignment).not.toHaveBeenCalled();
          measure.mockClear();
          control.notify(space[source], 'content-box');
          expect(measure).not.toHaveBeenCalled();

          lease.dispose();
          f.frame.style[edge] = '777px';
          space.resize(source, 840);
          for (const observer of control.observing(space.root)) observer.replayQueued();
          expect(f.frame.style[edge]).toBe('777px');
          expect(measure).not.toHaveBeenCalled();
          expect(f.onAlignment).not.toHaveBeenCalled();
        } finally {
          lease.dispose();
        }
      });
    }
  }

  it('shares root observation without retaining a disposed target owner', () => {
    const control = controlledBoxObservers();
    const space = rootSpaceGeometry();
    const first = fixture(),
      second = fixture();
    const firstReference = first.connection.targetAlignment!.blockReference as HTMLElement;
    const secondReference = second.connection.targetAlignment!.blockReference as HTMLElement;
    firstReference.getBoundingClientRect = () => rect(space.referenceLeft('root'), 240, 180, 36);
    secondReference.getBoundingClientRect = () =>
      rect(space.referenceLeft('root') - 200, 240, 180, 36);
    const a = createTargetAlignmentLease(first.connection);
    const b = createTargetAlignmentLease(second.connection);
    try {
      const roots = control.observing(space.root);
      expect(roots).toHaveLength(1);
      expect(control.observing(first.frame)).toHaveLength(2);
      expect(control.observing(second.frame)).toHaveLength(2);
      a.dispose();
      first.frame.style.left = '777px';
      first.onAlignment.mockClear();
      expect(roots[0].disconnect).not.toHaveBeenCalled();
      space.resize('root', 870);
      control.notify(space.root, 'content-box');
      expect(first.frame.style.left).toBe('777px');
      expect(first.onAlignment).not.toHaveBeenCalled();
      expect(second.frame.style.left).toBe('235px');
      b.dispose();
      expect(roots[0].disconnect).toHaveBeenCalledOnce();
      second.frame.style.left = '888px';
      second.onAlignment.mockClear();
      space.resize('root', 840);
      roots[0].replayQueued();
      expect(first.frame.style.left).toBe('777px');
      expect(second.frame.style.left).toBe('888px');
      expect(first.onAlignment).not.toHaveBeenCalled();
      expect(second.onAlignment).not.toHaveBeenCalled();
    } finally {
      a.dispose();
      b.dispose();
    }
  });

  it('responds to body-origin mutations and releases the mutation subscription on disposal', async () => {
    const space = rootSpaceGeometry();
    const f = fixture();
    const reference = f.connection.targetAlignment!.blockReference as HTMLElement;
    const measure = vi.fn(() => rect(space.referenceLeft('body'), 240, 180, 36));
    reference.getBoundingClientRect = measure;
    const previousStyle = space.body.getAttribute('style');
    const lease = createTargetAlignmentLease(f.connection);
    try {
      expect(f.frame.style.left).toBe('450px');
      // Geometry is simulated, while this notification uses the real DOM
      // MutationObserver; no ResizeObserver notification is injected.
      space.moveBody(15);
      space.body.style.marginLeft = '15px';
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(f.frame.style.left).toBe('465px');
      lease.dispose();
      f.frame.style.left = '777px';
      measure.mockClear();
      f.onAlignment.mockClear();
      space.moveBody(30);
      space.body.style.marginLeft = '30px';
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(f.frame.style.left).toBe('777px');
      expect(measure).not.toHaveBeenCalled();
      expect(f.onAlignment).not.toHaveBeenCalled();
    } finally {
      lease.dispose();
      if (previousStyle === null) space.body.removeAttribute('style');
      else space.body.setAttribute('style', previousStyle);
    }
  });
});
