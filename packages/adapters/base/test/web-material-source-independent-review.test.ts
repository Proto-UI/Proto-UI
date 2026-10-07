import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCanvasBackdropLease, inspectCanvasBackdrop } from '../src/material/source';
const rect = (x: number, y: number, width: number, height: number) =>
  ({
    x,
    y,
    left: x,
    top: y,
    width,
    height,
    right: x + width,
    bottom: y + height,
    toJSON() {},
  }) as DOMRect;
function fixture() {
  const scope = document.createElement('div'),
    canvas = document.createElement('canvas'),
    host = document.createElement('button');
  scope.append(canvas, host);
  document.body.append(scope);
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 400, 240));
  vi.spyOn(host, 'getBoundingClientRect').mockReturnValue(rect(40, 30, 100, 40));
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
  const pixels = new Uint8ClampedArray(400 * 240 * 4).fill(255);
  vi.spyOn(canvas, 'getContext').mockReturnValue({ getImageData: () => ({ data: pixels }) } as any);
  const lease = createCanvasBackdropLease(scope, canvas);
  lease.draw(() => {});
  return { scope, canvas, host, lease };
}
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

it.each(['revoke', 'dispose'] as const)(
  'independent: %s inside paint cannot resurrect the source frame',
  (action) => {
    const f = fixture();
    f.lease.draw(() => f.lease[action]());
    expect(f.lease.current() === null).toBe(true);
  }
);

// Synthetic computed CSS: happy-dom does not implement these CSSOM properties.
// This proves admission's handling of a browser-supplied value, not rendered pixels.
it.each(['clipPath', 'maskImage'] as const)(
  'independent: synthetic computed %s on canvas source is not admitted',
  (property) => {
    const f = fixture();
    const value =
      property === 'clipPath' ? 'inset(50%)' : 'linear-gradient(transparent, transparent)';
    const original = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
      const css = original(element);
      return element === f.canvas
        ? new Proxy(css, {
            get(target, key) {
              return key === property ? value : Reflect.get(target, key);
            },
          })
        : css;
    });
    expect((window.getComputedStyle(f.canvas) as any)[property]).toBe(value);
    expect(inspectCanvasBackdrop(f.host, f.lease.current()).valid).toBe(false);
  }
);

it('a nested current draw supersedes its outer paint callback', () => {
  const f = fixture();
  let replacement: ReturnType<typeof f.lease.current> = null;
  f.lease.draw(() => {
    f.lease.draw(() => {});
    replacement = f.lease.current();
  });
  expect(replacement).not.toBeNull();
  expect(f.lease.current()).toBe(replacement!);
});
it('a failed source preparation revokes prior content and notifies consumers', () => {
  const f = fixture();
  const changed = vi.fn();
  f.lease.subscribe(changed);
  vi.mocked(f.canvas.getContext).mockReturnValue(null);
  expect(() => f.lease.draw(() => {})).toThrow('Backdrop 2D context unavailable');
  expect(f.lease.current()).toBeNull();
  expect(changed).toHaveBeenCalledTimes(1);
});
