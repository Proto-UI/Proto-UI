import { describe, expect, it, vi } from 'vitest';
import { scheduleAfterWebLayout } from '../src/platform/layout-ready';

describe('adapter-base: Web layout readiness', () => {
  it('waits for two target-realm animation frames before publishing readiness', () => {
    const frames: FrameRequestCallback[] = [];
    const task = vi.fn();
    const fallback = vi.fn();
    const target = {
      ownerDocument: {
        defaultView: {
          requestAnimationFrame(callback: FrameRequestCallback) {
            frames.push(callback);
            return frames.length;
          },
        },
      },
    } as unknown as Element;

    scheduleAfterWebLayout(target, task, fallback);
    expect(frames).toHaveLength(1);
    frames.shift()?.(1);
    expect(task).not.toHaveBeenCalled();
    expect(frames).toHaveLength(1);
    frames.shift()?.(2);

    expect(task).toHaveBeenCalledTimes(1);
    expect(fallback).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'cancels pending and late frame delivery (after first frame=%s)',
    (firstFrame) => {
      const frames = new Map<number, FrameRequestCallback>();
      let serial = 0;
      const task = vi.fn();
      const target = {
        ownerDocument: {
          defaultView: {
            requestAnimationFrame(callback: FrameRequestCallback) {
              frames.set(++serial, callback);
              return serial;
            },
            cancelAnimationFrame(id: number) {
              frames.delete(id);
            },
          },
        },
      } as unknown as Element;
      const cancel = scheduleAfterWebLayout(target, task, vi.fn());
      if (firstFrame) {
        const first = frames.get(1)!;
        frames.delete(1);
        first(1);
      }
      const stale = [...frames.values()][0]!;

      cancel();
      expect(frames.size).toBe(0);
      stale(2);
      expect(frames.size).toBe(0);
      expect(task).not.toHaveBeenCalled();
    }
  );

  it('uses the adapter scheduler when the target realm has no animation frame', () => {
    const task = vi.fn();
    const fallback = vi.fn((callback: () => void) => callback());

    scheduleAfterWebLayout(null, task, fallback);

    expect(fallback).toHaveBeenCalledTimes(1);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('suppresses a cancelled adapter scheduler callback', () => {
    const task = vi.fn();
    let queued = () => {};
    const cancel = scheduleAfterWebLayout(null, task, (callback) => {
      queued = callback;
    });

    cancel();
    queued();

    expect(task).not.toHaveBeenCalled();
  });
});
