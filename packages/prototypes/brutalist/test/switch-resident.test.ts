import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { switchRoot, switchThumb } from '../src/switch';

// Deterministic physical-input substitutes, not browser trajectory evidence.
const Root = AdaptToWebComponent(switchRoot);
const Thumb = AdaptToWebComponent(switchThumb);
const flush = async () => {
  for (let n = 0; n < 12; n++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
  document.documentElement.style.removeProperty('font-size');
  vi.restoreAllMocks();
});

function harness(font: number) {
  document.documentElement.style.fontSize = `${font}px`;
  vi.spyOn(window.CSS, 'supports').mockReturnValue(true);
  let now = 0,
    id = 0,
    preference = 'no-preference';
  const callbacks = new Map<number, FrameRequestCallback>();
  const allCallbacks: FrameRequestCallback[] = [];
  const mediaListeners = new Set<() => void>();
  vi.spyOn(window.performance, 'now').mockImplementation(() => now);
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    callbacks.set(++id, cb);
    allCallbacks.push(cb);
    return id;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((key) => {
    callbacks.delete(key);
  });
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        get matches() {
          return query === `(prefers-reduced-motion: ${preference})`;
        },
        media: query,
        addEventListener: (_key: string, cb: () => void) => mediaListeners.add(cb),
        removeEventListener: (_key: string, cb: () => void) => mediaListeners.delete(cb),
      }) as unknown as MediaQueryList
  );
  const observers = new Map<Element, ResizeObserverCallback>();
  vi.spyOn(window, 'ResizeObserver').mockImplementation(function (cb: ResizeObserverCallback) {
    const owned = new Set<Element>();
    return {
      observe(el: Element) {
        owned.add(el);
        observers.set(el, cb);
      },
      unobserve(el: Element) {
        owned.delete(el);
        observers.delete(el);
      },
      disconnect() {
        for (const el of owned) observers.delete(el);
      },
    } as ResizeObserver;
  });
  return {
    callbacks,
    allCallbacks,
    async frame(time: number) {
      now = time;
      for (const [key, cb] of [...callbacks]) {
        callbacks.delete(key);
        cb(time);
      }
      await flush();
    },
    clock(time: number) {
      now = time;
    },
    async preference(next: string) {
      preference = next;
      for (const cb of mediaListeners) cb();
      await flush();
    },
    async measure(thumb: Element) {
      observers.get(thumb)?.(
        [
          { target: thumb, borderBoxSize: [{ inlineSize: font, blockSize: font }] },
        ] as unknown as ResizeObserverEntry[],
        {} as ResizeObserver
      );
      await flush();
    },
    async mount(props: Record<string, unknown> = {}) {
      const root = new Root(),
        thumb = new Thumb();
      setElementProps(root, props);
      root.append(thumb);
      document.body.append(root);
      await flush();
      await this.measure(thumb);
      return { root, thumb };
    },
  };
}
const position = (thumb: HTMLElement) =>
  thumb.style.getPropertyValue('translate').split(' ').map(Number.parseFloat);

describe.each([16, 32])('Brutalist resident Thumb at %ipx root font', (font) => {
  it('settles initial checked targets, then moves only x from the acknowledged frame on rapid reversal', async () => {
    // T-BRUTALIST-SWITCH-0001-CASE-RESIDENT
    const h = harness(font);
    const { root, thumb } = await h.mount({ defaultChecked: true });
    expect(position(thumb)).toEqual([font * 1.25, -font / 2]);
    await h.frame(0);
    expect(h.callbacks.size).toBe(0);
    root.click();
    await flush();
    expect(root.getExposes().checked.get()).toBe(false);
    expect(position(thumb)).toEqual([font * 1.25, -font / 2]);
    await h.frame(45);
    const painted = position(thumb);
    expect(painted[0]).toBeGreaterThan(0);
    expect(painted[0]).toBeLessThan(font * 1.25);
    expect(painted[1]).toBe(-font / 2);
    // Wall time passes without a delivered presentation; reverse from acknowledged paint.
    h.clock(400);
    root.click();
    await flush();
    expect(position(thumb)).toEqual(painted);
    await h.frame(420);
    const reversed = position(thumb);
    expect(reversed[0]).toBeGreaterThan(painted[0]);
    expect(reversed[1]).toBe(-font / 2);
    root.click();
    await flush();
    expect(position(thumb)).toEqual(reversed);
    await h.frame(800);
    expect(position(thumb)).toEqual([0, -font / 2]);
    expect(h.callbacks.size).toBe(0);
    const tokens = thumb.getAttribute('data-pui-style') ?? '';
    expect(tokens).not.toMatch(/transition-|duration-|translate-[xy]-/);
    expect(tokens).toContain('bg-white');
    expect(root.getAttribute('data-pui-style')).toContain('p-0');
    expect(root.style.getPropertyValue('translate')).toBe('');
  });

  it('controlled refusal and disabled input do not animate; cancellation cannot undo accepted checked', async () => {
    const h = harness(font);
    const { root, thumb } = await h.mount({ checked: false });
    await h.frame(0);
    root.click();
    await flush();
    expect(root.getExposes().checked.get()).toBe(false);
    expect(position(thumb)).toEqual([0, -font / 2]);
    expect(h.callbacks.size).toBe(0);
    setElementProps(root, { checked: true, disabled: true });
    await flush();
    await h.frame(200);
    root.click();
    await flush();
    expect(root.getExposes().checked.get()).toBe(true);
    expect(position(thumb)).toEqual([font * 1.25, -font / 2]);
    expect(h.callbacks.size).toBe(0);
    setElementProps(root, {});
    await flush();
    root.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await flush();
    expect(root.getExposes().pressed.get()).toBe(true);
    const before = root.getExposes().checked.get();
    root.click();
    await flush();
    const accepted = root.getExposes().checked.get();
    expect(accepted).not.toBe(before);
    root.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true }));
    await flush();
    expect(root.getExposes().pressed.get()).toBe(false);
    expect(root.getExposes().checked.get()).toBe(accepted);
    await h.frame(400);
    expect(position(thumb)[0]).toBe(accepted ? font * 1.25 : 0);
  });

  it('reduce/unknown settle, preference restoration never replays, remount retires old frames', async () => {
    const h = harness(font);
    const { root, thumb } = await h.mount();
    await h.frame(0);
    root.click();
    await flush();
    await h.frame(40);
    await h.preference('reduce');
    expect(position(thumb)).toEqual([font * 1.25, -font / 2]);
    expect(h.callbacks.size).toBe(0);
    await h.preference('no-preference');
    expect(h.callbacks.size).toBe(0);
    root.click();
    await flush();
    await h.frame(70);
    await h.preference('unknown');
    expect(position(thumb)).toEqual([0, -font / 2]);
    expect(h.callbacks.size).toBe(0);
    await h.preference('no-preference');
    root.click();
    await flush();
    await h.frame(90);
    const stale = h.allCallbacks.at(-1)!;
    root.remove();
    await flush();
    expect(h.callbacks.size).toBe(0);
    document.body.append(root);
    await flush();
    await h.measure(thumb);
    const current = root.getExposes().checked.get();
    expect(position(thumb)).toEqual([current ? font * 1.25 : 0, -font / 2]);
    await h.frame(100);
    const remounted = thumb.style.getPropertyValue('translate');
    stale(999);
    await flush();
    expect(thumb.style.getPropertyValue('translate')).toBe(remounted);
    expect(h.callbacks.size).toBe(0);
  });
});
