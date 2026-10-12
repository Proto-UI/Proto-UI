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
    offsetTop: 0,
    offsetHeight: 106,
    clientHeight: 104,
    clientTop: 1,
    offsetParent: frame,
  });
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
