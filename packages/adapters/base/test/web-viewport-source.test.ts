import { describe, expect, it, vi } from 'vitest';
import {
  createDefaultWebViewportSource,
  readWebViewportWidth,
} from '../src/platform/web-viewport-source';
function fixture(width: unknown = 768) {
  const listeners = new Set<() => void>();
  const view = {
    innerWidth: width,
    addEventListener: vi.fn((_type, fn) => listeners.add(fn)),
    removeEventListener: vi.fn((_type, fn) => listeners.delete(fn)),
  };
  const doc = { defaultView: view } as unknown as Document;
  const getter = (key: string) => readWebViewportWidth(doc, key);
  return {
    view,
    doc,
    getter,
    listeners,
    resize(value: unknown) {
      view.innerWidth = value;
      for (const fn of listeners) fn();
    },
  };
}
describe('bounded layout viewport width source', () => {
  it.each([0, 767.5, 768, 4096])('reads CSS-pixel width %s without rounding', (width) => {
    const f = fixture(width);
    expect(f.getter('viewport.width')).toBe(width);
    expect(f.getter('viewport.height')).toBeUndefined();
  });
  it.each([undefined, null, -1, NaN, Infinity, -Infinity, '768', true])(
    'does not coerce invalid width %s',
    (width) => {
      const f = fixture();
      f.view.innerWidth = width;
      expect(f.getter('viewport.width')).toBe('unknown');
    }
  );
  it('has no SSR source or fabricated width', () => {
    expect(readWebViewportWidth(undefined, 'viewport.width')).toBe('unknown');
    expect(createDefaultWebViewportSource(() => 999, {} as Document)).toBeUndefined();
  });
  it('shares one lazy listener, coalesces changes, samples fresh and releases the last lease', async () => {
    const f = fixture();
    const a = createDefaultWebViewportSource(f.getter, f.doc)!;
    const b = createDefaultWebViewportSource(f.getter, f.doc)!;
    const x = vi.fn(),
      y = vi.fn();
    expect(f.listeners.size).toBe(0);
    const no = a.subscribe([], x);
    expect(f.listeners.size).toBe(0);
    no();
    const rx = a.subscribe(['viewport.width'], x),
      ry = b.subscribe(['viewport.width'], y);
    expect(f.listeners.size).toBe(1);
    expect(x).not.toHaveBeenCalled();
    f.resize(800);
    f.resize(900);
    expect(f.getter('viewport.width')).toBe(900);
    await Promise.resolve();
    expect(x).toHaveBeenCalledTimes(1);
    expect(y).toHaveBeenCalledTimes(1);
    f.resize(900);
    await Promise.resolve();
    expect(x).toHaveBeenCalledTimes(1);
    rx();
    rx();
    expect(f.listeners.size).toBe(1);
    ry();
    expect(f.listeners.size).toBe(0);
  });
  it('discards queued and captured old-generation work across release/remount', async () => {
    const f = fixture();
    const source = createDefaultWebViewportSource(f.getter, f.doc)!;
    const x = vi.fn();
    const r = source.subscribe(['viewport.width'], x);
    const old = [...f.listeners][0];
    f.resize(900);
    r();
    const y = vi.fn();
    const r2 = source.subscribe(['viewport.width'], y);
    old();
    await Promise.resolve();
    expect(x).not.toHaveBeenCalled();
    expect(y).not.toHaveBeenCalled();
    f.resize(901);
    await Promise.resolve();
    expect(y).toHaveBeenCalledTimes(1);
    r2();
  });
  it('isolates documents and duplicate callback subscriptions', async () => {
    const a = fixture(),
      b = fixture();
    const fn = vi.fn();
    const s = createDefaultWebViewportSource(a.getter, a.doc)!;
    const r1 = s.subscribe(['viewport.width'], fn),
      r2 = s.subscribe(['viewport.width'], fn);
    const r3 = createDefaultWebViewportSource(b.getter, b.doc)!.subscribe(['viewport.width'], fn);
    r1();
    a.resize(900);
    await Promise.resolve();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(b.listeners.size).toBe(1);
    r2();
    r3();
  });
});
