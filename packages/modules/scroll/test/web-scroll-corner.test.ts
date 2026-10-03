import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ScrollSurfaceHostAttachment } from '../src/caps';
import { createWebScrollSurfaceHost } from '../src';

const INSET = '--proto-ui-scroll-track-end-inset';
const moveHost = {
  attach: () => ({ update() {}, dispose() {} }),
};

function fixture() {
  const viewport = document.createElement('div');
  let extent = 400;
  Object.defineProperties(viewport, {
    clientWidth: { value: 100 },
    clientHeight: { value: 100 },
    scrollWidth: { get: () => extent },
    scrollHeight: { get: () => extent },
  });
  const makeControl = (axis: 'vertical' | 'horizontal', thickness: number) => {
    const track = document.createElement('div');
    const thumb = document.createElement('div');
    track.style.boxSizing = 'border-box';
    track.style[axis === 'vertical' ? 'width' : 'height'] = `${thickness}px`;
    const inset = () => parseFloat(track.style.getPropertyValue(INSET)) || 0;
    const cross = () => (track.style.display === 'none' ? 0 : thickness);
    Object.defineProperties(track, {
      offsetWidth: { get: () => (axis === 'vertical' ? cross() : 100 - inset()) },
      offsetHeight: { get: () => (axis === 'horizontal' ? cross() : 100 - inset()) },
      clientWidth: { get: () => (axis === 'vertical' ? cross() : 100 - inset()) },
      clientHeight: { get: () => (axis === 'horizontal' ? cross() : 100 - inset()) },
    });
    track.append(thumb);
    document.body.append(track);
    return { getAxis: () => axis, trackTarget: track, thumbTarget: thumb };
  };
  const vertical = makeControl('vertical', 16);
  const horizontal = makeControl('horizontal', 12);
  document.body.append(viewport);
  const connection = (
    controls = [vertical, horizontal],
    projection: 'composed' | 'system' = 'composed'
  ): ScrollSurfaceHostAttachment => ({
    config: { axes: 'both', projection: 'composed', endFollow: { mode: 'off' } },
    projection,
    composedChrome: { scope: {}, controls },
    onFacts() {},
  });
  return {
    viewport,
    vertical,
    horizontal,
    connection,
    fit: () => {
      extent = 100;
    },
  };
}

afterEach(() => document.body.replaceChildren());

describe('Web composed track corner', () => {
  it('measures fractional border boxes and releases detached or reoriented opposite controls', () => {
    const f = fixture();
    f.vertical.trackTarget.style.boxSizing = 'content-box';
    f.vertical.trackTarget.style.width = '8.5px';
    f.vertical.trackTarget.style.padding = '0 1.5px';
    f.vertical.trackTarget.style.border = '2px solid black';
    const lease = createWebScrollSurfaceHost(f.viewport, { moveGestureHost: moveHost }).attach(
      f.connection()
    );
    try {
      expect(f.horizontal.trackTarget.style.getPropertyValue(INSET)).toBe('15.5px');
      f.horizontal.trackTarget.remove();
      window.dispatchEvent(new Event('resize'));
      expect(f.vertical.trackTarget.style.getPropertyValue(INSET)).toBe('0px');
      document.body.append(f.horizontal.trackTarget);
      window.dispatchEvent(new Event('resize'));
      expect(f.vertical.trackTarget.style.getPropertyValue(INSET)).toBe('12px');
      f.vertical.getAxis = () => 'horizontal';
      lease.update(f.connection());
      expect(f.horizontal.trackTarget.style.getPropertyValue(INSET)).toBe('0px');
      expect(f.vertical.trackTarget.style.getPropertyValue(INSET)).toBe('0px');
    } finally {
      lease.dispose();
    }
  });
  it('reserves the opposite track thickness before deriving thumb travel and does not rewrite unchanged insets', () => {
    const f = fixture();
    const lease = createWebScrollSurfaceHost(f.viewport, { moveGestureHost: moveHost }).attach(
      f.connection()
    );
    try {
      expect(f.vertical.trackTarget.style.getPropertyValue(INSET)).toBe('12px');
      expect(f.horizontal.trackTarget.style.getPropertyValue(INSET)).toBe('16px');
      expect(f.vertical.thumbTarget.style.getPropertyValue('--proto-ui-scroll-thumb-size')).toBe(
        '22px'
      );
      expect(f.horizontal.thumbTarget.style.getPropertyValue('--proto-ui-scroll-thumb-size')).toBe(
        '21px'
      );
      lease.request({ kind: 'to', axis: 'vertical', position: 1 });
      expect(f.vertical.thumbTarget.style.getPropertyValue('--proto-ui-scroll-thumb-offset')).toBe(
        '66px'
      );
      const writes = vi.spyOn(f.vertical.trackTarget.style, 'setProperty');
      lease.update(f.connection());
      expect(writes.mock.calls.filter(([name]) => name === INSET)).toHaveLength(0);
      f.fit();
      window.dispatchEvent(new Event('resize'));
      expect(f.vertical.thumbTarget.style.display).toBe('none');
      expect(f.horizontal.thumbTarget.style.display).toBe('none');
      expect(f.vertical.trackTarget.style.display).not.toBe('none');
      expect(f.vertical.trackTarget.style.getPropertyValue(INSET)).toBe('12px');
    } finally {
      lease.dispose();
    }
  });

  it.each(['', 'important'])(
    'restores authored %s insets on replacement, fallback, and disposal',
    (priority) => {
      const f = fixture();
      f.vertical.trackTarget.style.setProperty(INSET, '3px', priority);
      const lease = createWebScrollSurfaceHost(f.viewport, { moveGestureHost: moveHost }).attach(
        f.connection()
      );
      try {
        lease.update(f.connection([f.vertical]));
        expect(f.vertical.trackTarget.style.getPropertyValue(INSET)).toBe('0px');
        expect(f.horizontal.trackTarget.style.getPropertyValue(INSET)).toBe('');
        lease.update(f.connection());
        f.horizontal.trackTarget.style.display = 'none';
        window.dispatchEvent(new Event('resize'));
        expect(f.vertical.trackTarget.style.getPropertyValue(INSET)).toBe('0px');
        f.horizontal.trackTarget.style.display = '';
        window.dispatchEvent(new Event('resize'));
        expect(f.vertical.trackTarget.style.getPropertyValue(INSET)).toBe('12px');
        lease.update(f.connection(undefined, 'system'));
        expect(f.vertical.trackTarget.style.getPropertyValue(INSET)).toBe('3px');
        expect(f.vertical.trackTarget.style.getPropertyPriority(INSET)).toBe(priority);
        lease.update(f.connection());
        expect(f.vertical.trackTarget.style.getPropertyValue(INSET)).toBe('12px');
      } finally {
        lease.dispose();
      }
      expect(f.vertical.trackTarget.style.getPropertyValue(INSET)).toBe('3px');
      expect(f.vertical.trackTarget.style.getPropertyPriority(INSET)).toBe(priority);
      expect(f.horizontal.trackTarget.style.getPropertyValue(INSET)).toBe('');
    }
  );
});
