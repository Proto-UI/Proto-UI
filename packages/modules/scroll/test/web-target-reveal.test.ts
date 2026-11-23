import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MoveGestureHost, ScrollSurfaceSnapshot } from '@proto.ui/core';
import {
  createBoundWebScrollSurfaceHost,
  createWebScrollSurfaceHost,
  type ScrollSurfaceHostLease,
} from '../src';

const leases: ScrollSurfaceHostLease[] = [];
afterEach(() => {
  for (const lease of leases.splice(0)) lease.dispose();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

/** Happy DOM has no layout engine. Injected viewport/target geometry is model
 * evidence; the separate browser journey must prove native layout and input. */
function fixture(bound = false) {
  const outer = document.createElement('div'),
    surface = document.createElement('div');
  const editor = document.createElement('input'),
    target = document.createElement('div');
  outer.append(editor, surface);
  surface.append(target);
  document.body.append(outer);
  Object.defineProperties(surface, {
    clientWidth: { configurable: true, value: 100 },
    scrollWidth: { configurable: true, value: 400 },
    clientHeight: { configurable: true, value: 100 },
    scrollHeight: { configurable: true, value: 400 },
    clientTop: { configurable: true, value: 2 },
    scrollTop: { configurable: true, writable: true, value: 50 },
    scrollLeft: { configurable: true, writable: true, value: 17 },
  });
  outer.scrollTop = 43;
  outer.scrollLeft = 11;
  const geometry = {
    start: 150,
    height: 20,
    rendered: true,
    currentTarget: true,
    currentBinding: true,
    boundTarget: surface as HTMLElement | null,
  };
  const surfaceBox = () => new DOMRect(20, 100, 104, 104);
  const targetBox = () =>
    new DOMRect(22, 102 + geometry.start - surface.scrollTop, 80, geometry.height);
  vi.spyOn(surface, 'getBoundingClientRect').mockImplementation(surfaceBox);
  vi.spyOn(surface, 'getClientRects').mockImplementation(
    () => [surfaceBox()] as unknown as DOMRectList
  );
  vi.spyOn(target, 'getBoundingClientRect').mockImplementation(targetBox);
  vi.spyOn(target, 'getClientRects').mockImplementation(
    () => (geometry.rendered ? [targetBox()] : []) as unknown as DOMRectList
  );
  const moveGestureHost: MoveGestureHost = { attach: () => ({ update() {}, dispose() {} }) };
  const snapshots: ScrollSurfaceSnapshot[] = [];
  const host = bound
    ? createBoundWebScrollSurfaceHost({
        boundary: surface,
        moveGestureHost,
        getTarget: () => geometry.boundTarget,
        isReady: () => geometry.currentBinding,
        subscribeTarget: () => () => {},
      })
    : createWebScrollSurfaceHost(surface, {
        moveGestureHost,
        isCurrentBinding: () => geometry.currentBinding,
      });
  const availability = host.availability?.get();
  const lease = host.attach(
    {
      config: { axes: 'vertical', projection: 'system', endFollow: { mode: 'off' } },
      projection: 'system',
      onFacts: (snapshot) => snapshots.push(snapshot),
    },
    availability?.kind === 'available' ? availability.binding : undefined
  );
  leases.push(lease);
  editor.focus();
  const reveal = (candidate: unknown = target) => {
    expect(lease.reveal, 'the Web host exposes the governed reveal operation').toBeTypeOf(
      'function'
    );
    return lease.reveal!(candidate, 'vertical', () => geometry.currentTarget);
  };
  return { outer, surface, editor, target, geometry, lease, reveal, snapshots, targetBox };
}

describe('vertical target reveal in one Web scroll surface', () => {
  it('moves only the minimum distance while preserving focus, horizontal position and outer offsets', () => {
    const f = fixture();
    expect(f.reveal()).toBe(true);
    expect(f.surface.scrollTop).toBe(70);
    expect(f.surface.scrollLeft).toBe(17);
    expect(f.outer.scrollTop).toBe(43);
    expect(f.outer.scrollLeft).toBe(11);
    expect(document.activeElement).toBe(f.editor);
    expect(f.snapshots.at(-1)?.vertical.position).toBeCloseTo(70 / 300);
  });

  it.each([
    { start: 150, initial: 50, expected: 92 },
    { start: 20, initial: 100, expected: 5 },
  ])(
    'includes border, independent scroll padding and target margins at $start',
    ({ start, initial, expected }) => {
      const f = fixture();
      f.geometry.start = start;
      f.surface.scrollTop = initial;
      f.surface.style.scrollPaddingTop = '10px';
      f.surface.style.scrollPaddingBottom = '15px';
      f.target.style.scrollMarginTop = '5px';
      f.target.style.scrollMarginBottom = '7px';
      f.surface.style.setProperty('scroll-behavior', 'smooth', 'important');
      expect(f.reveal()).toBe(true);
      expect(f.surface.scrollTop).toBe(expected);
      expect(f.surface.style.getPropertyValue('scroll-behavior')).toBe('smooth');
      expect(f.surface.style.getPropertyPriority('scroll-behavior')).toBe('important');
      expect(document.activeElement).toBe(f.editor);
      expect(f.outer.scrollTop).toBe(43);
    }
  );

  it('resolves percentage scroll padding against the actual surface viewport height', () => {
    const f = fixture();
    Object.defineProperty(f.surface, 'clientHeight', { configurable: true, value: 200 });
    vi.mocked(f.surface.getBoundingClientRect).mockReturnValue(new DOMRect(20, 100, 104, 204));
    f.geometry.start = 300;
    f.surface.style.scrollPaddingTop = '10%';
    f.surface.style.scrollPaddingBottom = '15%';
    f.target.style.scrollMarginTop = '5px';
    f.target.style.scrollMarginBottom = '7px';
    expect(f.reveal()).toBe(true);
    expect(f.surface.scrollTop).toBe(157);
    expect(f.outer.scrollTop).toBe(43);
    expect(document.activeElement).toBe(f.editor);
  });

  it.each([
    { owner: 'surface', property: 'scrollPaddingTop', value: 'calc(10% + 10px)' },
    { owner: 'target', property: 'scrollMarginTop', value: '12unknown' },
  ] as const)(
    'rejects an unresolved computed $property value $value instead of treating it as zero',
    ({ owner, property, value }) => {
      const f = fixture();
      const readStyle = window.getComputedStyle.bind(window);
      // Inject the host's computed-value boundary. This is not evidence that a
      // real browser accepts an unknown CSS unit or leaves every calc unresolved.
      vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
        const style = readStyle(element);
        if (element !== f[owner]) return style;
        return new Proxy(style, {
          get(object, key) {
            if (key === property) return value;
            const result = Reflect.get(object, key, object);
            return typeof result === 'function' ? result.bind(object) : result;
          },
        });
      });
      expect(f.reveal()).toBe(false);
      expect(f.surface.scrollTop).toBe(50);
      expect(f.outer.scrollTop).toBe(43);
      expect(document.activeElement).toBe(f.editor);
    }
  );

  it.each([
    { start: 80, height: 20 },
    { start: 0, height: 300 },
  ])('does not move a target contained by or already covering the viewport: %s', (box) => {
    const f = fixture();
    Object.assign(f.geometry, box);
    expect(f.reveal()).toBe(true);
    expect(f.surface.scrollTop).toBe(50);
  });

  it('aligns the nearer leading edge of an oversized target wholly below the viewport', () => {
    const f = fixture();
    f.geometry.start = 160;
    f.geometry.height = 200;
    expect(f.reveal()).toBe(true);
    expect(f.surface.scrollTop).toBe(160);
  });

  it.each([
    { scale: 1, boxSizing: 'border-box', height: '40.5px', padding: '0px', border: '0px' },
    { scale: 2, boxSizing: 'border-box', height: '40.5px', padding: '0px', border: '0px' },
    { scale: 1, boxSizing: 'content-box', height: '30.5px', padding: '3px', border: '2px' },
  ])(
    'keeps a distant edge accurate with fractional $boxSizing height and scale $scale',
    ({ scale, boxSizing, height, padding, border }) => {
      const f = fixture();
      Object.defineProperties(f.surface, {
        clientHeight: { configurable: true, value: boxSizing === 'content-box' ? 37 : 41 },
        offsetHeight: { configurable: true, value: 41 },
        clientTop: { configurable: true, value: boxSizing === 'content-box' ? 2 : 0 },
        scrollHeight: { configurable: true, value: 5500 },
      });
      Object.assign(f.surface.style, { boxSizing, height, padding, borderWidth: border });
      vi.mocked(f.surface.getBoundingClientRect).mockImplementation(
        () => new DOMRect(20, 100, 104 * scale, 40.5 * scale)
      );
      vi.mocked(f.target.getBoundingClientRect).mockImplementation(
        () =>
          new DOMRect(
            22,
            100 + (f.surface.clientTop + 5236 - f.surface.scrollTop) * scale,
            80 * scale,
            290 * scale
          )
      );
      expect(f.reveal()).toBe(true);
      expect(f.surface.scrollTop).toBeCloseTo(5236, 6);
      expect(f.reveal()).toBe(true);
      expect(f.surface.scrollTop).toBeCloseTo(5236, 6);
      expect(f.outer.scrollTop).toBe(43);
      expect(f.surface.scrollLeft).toBe(17);
      expect(document.activeElement).toBe(f.editor);
    }
  );

  it.each([
    { start: -50, expected: 0 },
    { start: 500, expected: 300 },
  ])('clamps movement to the actual native range at $start', ({ start, expected }) => {
    const f = fixture();
    f.geometry.start = start;
    expect(f.reveal()).toBe(true);
    expect(f.surface.scrollTop).toBe(expected);
  });

  it.each(['self', 'outside', 'disconnected', 'foreign-document', 'unrendered', 'hidden'])(
    'rejects a %s target without moving any owner',
    (kind) => {
      const f = fixture();
      let candidate: unknown = f.target;
      if (kind === 'self') candidate = f.surface;
      if (kind === 'outside') candidate = f.editor;
      if (kind === 'disconnected') f.target.remove();
      if (kind === 'foreign-document') {
        const foreign = document.implementation.createHTMLDocument('foreign');
        const child = foreign.createElement('div');
        foreign.body.append(child);
        candidate = child;
      }
      if (kind === 'unrendered') f.geometry.rendered = false;
      if (kind === 'hidden') f.target.style.visibility = 'hidden';
      expect(f.reveal(candidate)).toBe(false);
      expect(f.surface.scrollTop).toBe(50);
      expect(f.outer.scrollTop).toBe(43);
      expect(document.activeElement).toBe(f.editor);
    }
  );

  it.each([
    { kind: 'binding', bound: false },
    { kind: 'part', bound: false },
    { kind: 'binding', bound: true },
    { kind: 'part', bound: true },
  ])('rechecks $kind retirement after measurement (bound host: $bound)', ({ kind, bound }) => {
    const f = fixture(bound);
    vi.mocked(f.target.getBoundingClientRect).mockImplementation(() => {
      if (kind === 'binding') f.geometry.currentBinding = false;
      else f.geometry.currentTarget = false;
      return f.targetBox();
    });
    expect(f.reveal()).toBe(false);
    expect(f.surface.scrollTop).toBe(50);
    expect(f.outer.scrollTop).toBe(43);
    expect(document.activeElement).toBe(f.editor);
  });

  it('the bound host forwards current reveal and retires its old lease when the surface target changes', () => {
    const f = fixture(true);
    expect(f.reveal()).toBe(true);
    expect(f.surface.scrollTop).toBe(70);
    f.surface.scrollTop = 50;
    const replacement = document.createElement('div');
    f.outer.append(replacement);
    f.geometry.boundTarget = replacement;
    expect(f.target.isConnected).toBe(true);
    expect(f.reveal()).toBe(false);
    expect(f.surface.scrollTop).toBe(50);
    expect(replacement.scrollTop).toBe(0);
  });

  it('does not let a disposed host lease reveal a still-connected target', () => {
    const f = fixture();
    f.lease.dispose();
    expect(f.target.isConnected).toBe(true);
    expect(f.reveal()).toBe(false);
    expect(f.surface.scrollTop).toBe(50);
  });

  it('a contained target cancels an older queued end request while ordinary and rejected-reveal end controls still apply', () => {
    // Controlled frame delivery, including an already-captured cancelled frame;
    // this proves request ordering, not native animation-frame scheduling.
    let sequence = 0;
    const frames = new Map<number, FrameRequestCallback>();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      const id = ++sequence;
      frames.set(id, callback);
      return id;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      frames.delete(id);
    });
    const capture = () => {
      const callbacks = [...frames.values()];
      frames.clear();
      return callbacks;
    };
    const f = fixture();
    f.lease.request({ kind: 'to-end', axis: 'vertical' });
    expect(f.surface.scrollTop).toBe(50);
    const ordinary = capture();
    expect(ordinary.length).toBeGreaterThan(0);
    ordinary.forEach((callback) => callback(16));
    expect(f.surface.scrollTop).toBe(300);

    f.surface.scrollTop = 50;
    f.geometry.start = 80; // Already inside the effective viewport.
    f.lease.request({ kind: 'to-end', axis: 'vertical' });
    const superseded = capture();
    expect(superseded.length).toBeGreaterThan(0);
    expect(f.reveal()).toBe(true);
    expect(f.surface.scrollTop).toBe(50);
    superseded.forEach((callback) => callback(32));
    expect(f.surface.scrollTop).toBe(50);
    expect(document.activeElement).toBe(f.editor);
    expect(f.outer.scrollTop).toBe(43);

    // An invalid target has no authority to cancel an older valid request.
    f.lease.request({ kind: 'to-end', axis: 'vertical' });
    f.geometry.currentTarget = false;
    expect(f.reveal()).toBe(false);
    capture().forEach((callback) => callback(48));
    expect(f.surface.scrollTop).toBe(300);

    // A valid reveal retains an explicit reading pause even when the target
    // is at the end; only reader arrival or a to-end command resumes it.
    f.geometry.currentTarget = true;
    f.lease.update({
      config: {
        axes: 'vertical',
        projection: 'system',
        endFollow: { mode: 'while-at-end', axis: 'vertical' },
      },
      projection: 'system',
      onFacts: (snapshot) => f.snapshots.push(snapshot),
    });
    expect(f.lease.pauseFollowing!()).toBe(true);
    f.surface.scrollTop = 200;
    f.geometry.start = 380;
    expect(f.reveal()).toBe(true);
    expect(f.surface.scrollTop).toBe(300);
    expect(f.snapshots.at(-1)?.endFollow.state).toBe('paused');
    f.surface.dispatchEvent(new Event('scroll'));
    expect(f.snapshots.at(-1)?.endFollow.state).toBe('paused');
    expect(document.activeElement).toBe(f.editor);
  });
});
