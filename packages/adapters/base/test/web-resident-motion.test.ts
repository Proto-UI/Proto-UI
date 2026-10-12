import { afterEach, describe, it, expect, vi } from 'vitest';
import { createWebResidentMotionSink } from '../src/motion/web-resident-motion';
import { createRootStyleEffect, resolveRootStyleEntry } from '@proto.ui/core/internal';
const restores: (() => void)[] = [];
afterEach(() => {
  for (const off of restores.splice(0)) off();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
describe('Web resident motion physical projection (DOM harness, not browser timing)', () => {
  it.each(['document', 'shadow'] as const)(
    'uses one typed projector in %s and cleans stale frames',
    (scope) => {
      vi.spyOn(window.CSS, 'supports').mockReturnValue(true);
      const owner = document.createElement('div');
      document.body.append(owner);
      const el = document.createElement('span');
      (scope === 'shadow' ? owner.attachShadow({ mode: 'open' }) : owner).append(el);
      let now = 0;
      vi.spyOn(window.performance, 'now').mockImplementation(() => now);
      let resize: ResizeObserverCallback = () => {};
      const oldRO = window.ResizeObserver;
      window.ResizeObserver = class {
        constructor(cb: ResizeObserverCallback) {
          resize = cb;
        }
        observe() {}
        disconnect() {}
        unobserve() {}
      } as typeof ResizeObserver;
      restores.push(() => {
        window.ResizeObserver = oldRO;
      });
      const listeners = new Set<() => void>();
      let reduce = false;
      const media = (query: string) => ({
        matches: query.includes(': reduce') ? reduce : !reduce,
        media: query,
        addEventListener: (_key: string, fn: () => void) => listeners.add(fn),
        removeEventListener: (_key: string, fn: () => void) => listeners.delete(fn),
      });
      vi.spyOn(window, 'matchMedia').mockImplementation(media as any);
      let next = 0;
      const scheduled = new Map<number, FrameRequestCallback>();
      const all = new Map<number, FrameRequestCallback>();
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        scheduled.set(++next, cb);
        all.set(next, cb);
        return next;
      });
      vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
        scheduled.delete(id);
      });
      const setProperty = vi.spyOn(el.style, 'setProperty');
      const queueStyle = vi.fn();
      const sink = createWebResidentMotionSink(
        el,
        { queueStyle, requestFlush() {} },
        {
          palette: {
            current: () => ({
              revision: 1,
              colors: { input: [0, 0, 0, 1], primary: [1, 1, 1, 1] },
            }),
            subscribe: () => () => {},
          },
        }
      );
      const commit = (tokens: string[], revision: number) =>
        sink.commit({
          view: 1,
          revision,
          style: createRootStyleEffect(tokens.map((t) => resolveRootStyleEntry(t, 'rule'))),
          declarations: [
            {
              properties: ['translate', 'background-color'],
              durationMs: 100,
              easing: [0, 0, 1, 1],
            },
          ],
        });
      commit(['translate-x-0', 'bg-input'], 1);
      resize(
        [{ target: el, borderBoxSize: [{ inlineSize: 16, blockSize: 16 }] }] as any,
        {} as any
      );
      for (const [id, cb] of [...scheduled]) {
        scheduled.delete(id);
        cb(now);
      }
      commit(['translate-x-[calc(100%_-_2px)]', 'bg-primary'], 2);
      now = 50;
      for (const [id, cb] of [...scheduled]) {
        scheduled.delete(id);
        cb(now);
      }
      expect(Number.parseFloat(el.style.getPropertyValue('translate'))).toBeCloseTo(7);
      const frame = queueStyle.mock.calls.at(-1)![0];
      expect(frame.tokens).toEqual(['bg-primary']);
      expect(frame.entries[0].origin).toBe('rule');
      expect(el.style.backgroundColor).not.toBe('rgb(0, 0, 0)');
      expect(el.style.backgroundColor).not.toBe('rgb(255, 255, 255)');
      const late = [...all.values()].at(-1)!;
      now = 100;
      for (const [id, cb] of [...scheduled]) {
        scheduled.delete(id);
        cb(now);
      }
      expect(el.style.getPropertyValue('background-color')).toBe('');
      expect(scheduled.size).toBe(0);
      // Idle author input survives; the next active lease captures this new baseline.
      el.style.setProperty('background-color', 'red');
      commit(['translate-x-0', 'bg-input'], 3);
      now = 200;
      for (const [id, cb] of [...scheduled]) {
        scheduled.delete(id);
        cb(now);
      }
      expect(el.style.getPropertyValue('background-color')).toBe('red');
      sink.release(1);
      expect(scheduled.size).toBe(0);
      expect(el.style.getPropertyValue('translate')).toBe('');
      const count = queueStyle.mock.calls.length;
      late(90);
      expect(queueStyle).toHaveBeenCalledTimes(count);
    }
  );
});
