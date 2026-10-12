import { afterEach, expect, it, vi } from 'vitest';
import { createWebResidentMotionSink } from '../src/motion/web-resident-motion';
afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
it('binds one source to each replacement surface and unsubscribes the retired view', () => {
  const calls: HTMLElement[] = [];
  const cleanups: ReturnType<typeof vi.fn>[] = [];
  const invalidations: (() => void)[] = [];
  const factory = (surface: HTMLElement) => {
    calls.push(surface);
    const off = vi.fn();
    cleanups.push(off);
    return {
      current: () => ({ revision: 1, colors: { input: [0, 0, 0, 1] as const } }),
      subscribe(cb: () => void) {
        invalidations.push(cb);
        return off;
      },
    };
  };
  const one = document.createElement('div'),
    two = document.createElement('div');
  document.body.append(one, two);
  const write = vi.fn();
  const options = { palette: factory };
  const first = createWebResidentMotionSink(one, { queueStyle: write, requestFlush() {} }, options);
  const frame = {
    view: 1,
    revision: 1,
    style: { kind: 'tw' as const, tokens: ['bg-input'] },
    declarations: [
      { properties: ['background-color' as const], durationMs: 100, easing: [0, 0, 1, 1] as const },
    ],
  };
  first.commit(frame);
  expect(calls).toEqual([one]);
  first.release(1);
  expect(cleanups[0]).toHaveBeenCalledTimes(1);
  const count = write.mock.calls.length;
  invalidations[0]();
  expect(write).toHaveBeenCalledTimes(count);
  const second = createWebResidentMotionSink(
    two,
    { queueStyle: write, requestFlush() {} },
    options
  );
  second.commit({ ...frame, view: 2 });
  expect(calls).toEqual([one, two]);
  second.release(2);
  expect(cleanups[1]).toHaveBeenCalledTimes(1);
});
