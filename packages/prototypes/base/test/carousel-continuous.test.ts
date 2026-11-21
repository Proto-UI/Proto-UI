import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as base from '../src/carousel';
import * as shadcn from '../../shadcn/src/carousel';
import * as brutalist from '../../brutalist/src/carousel';
import * as bootstrap from '../../bootstrap-2-3-2/src/carousel';
import * as glass from '../../liquid-glass/src/carousel';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';

const families = { base, shadcn, brutalist, 'bootstrap-2-3-2': bootstrap, 'liquid-glass': glass };
for (const family of Object.values(families))
  for (const name of [
    'carouselRoot',
    'carouselViewport',
    'carouselSlide',
    'carouselPrevious',
    'carouselNext',
  ] as const)
    AdaptToWebComponent(family[name]);
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
  vi.useRealTimers();
});
const pointer = (type: string, x: number, y = 10, pointerType = 'mouse') =>
  new PointerEvent(type, {
    pointerId: 8,
    pointerType,
    isPrimary: true,
    button: 0,
    clientX: x,
    clientY: y,
    bubbles: true,
    cancelable: true,
  });
async function fixture(props: Record<string, unknown> = {}, family = 'base', count = 5) {
  const root = document.createElement(`${family}-carousel-root`) as any;
  const viewport = document.createElement(`${family}-carousel-viewport`) as any;
  const previous = document.createElement(`${family}-carousel-previous`) as any;
  const next = document.createElement(`${family}-carousel-next`) as any;
  const slides = Array.from({ length: count }, (_, index) => {
    const el = document.createElement(`${family}-carousel-slide`) as any;
    setElementProps(el, { index });
    el.textContent = `Item ${index + 1}`;
    return el;
  });
  setElementProps(root, props);
  let width = 300,
    height = 300,
    extent = (count * 300) / Number(props.slidesPerView ?? 1);
  const vertical = () => root.getAttribute('data-test-vertical') === 'true';
  if (props.orientation === 'vertical') root.setAttribute('data-test-vertical', 'true');
  Object.defineProperties(viewport, {
    clientWidth: { configurable: true, get: () => width },
    clientHeight: { configurable: true, get: () => height },
    scrollWidth: { configurable: true, get: () => (vertical() ? width : extent) },
    scrollHeight: { configurable: true, get: () => (vertical() ? extent : height) },
    scrollLeft: { configurable: true, value: 0, writable: true },
    scrollTop: { configurable: true, value: 0, writable: true },
  });
  viewport.getBoundingClientRect = () => new DOMRect(0, 0, width, height);
  if (props.direction === 'rtl') viewport.style.direction = 'rtl';
  viewport.append(...slides);
  root.append(viewport, previous, next);
  document.body.append(root);
  await flush();
  window.dispatchEvent(new Event('resize'));
  await flush();
  const changes: number[] = [];
  root.addEventListener('indexChange', (event: CustomEvent) => changes.push(event.detail.index));
  return {
    root,
    viewport,
    slides,
    previous,
    next,
    changes,
    resize: async (newWidth: number, newExtent: number) => {
      width = newWidth;
      extent = newExtent;
      window.dispatchEvent(new Event('resize'));
      await flush();
    },
    drag: async (end: number, type = 'mouse') => {
      viewport.dispatchEvent(pointer('pointerdown', 250, 250, type));
      viewport.dispatchEvent(
        pointer('pointermove', vertical() ? 250 : 230, vertical() ? 230 : 250, type)
      );
      viewport.dispatchEvent(
        pointer('pointermove', vertical() ? 250 : end, vertical() ? end : 250, type)
      );
      await flush();
    },
    release: async (end: number, type = 'mouse') => {
      viewport.dispatchEvent(
        pointer('pointerup', vertical() ? 250 : end, vertical() ? end : 250, type)
      );
      await flush();
    },
  };
}

describe('continuous Carousel through the real Web Component Adapter', () => {
  it('moves before release, retains all slide extents, then snaps and changes the committed index', async () => {
    const f = await fixture();
    await f.drag(50);
    expect(f.viewport.scrollLeft).toBeCloseTo(200);
    expect(f.viewport.getExposes().dragging.get()).toBe(true);
    expect(f.root.getExposes().index.get()).toBe(0);
    expect(f.changes).toEqual([]);
    expect(f.slides[1].getExposes().hidden.get()).toBe(false);
    expect(f.slides.every((slide: HTMLElement) => !slide.hasAttribute('hidden'))).toBe(true);
    await f.release(50);
    expect(f.viewport.scrollLeft).toBeCloseTo(300);
    expect(f.root.getExposes().index.get()).toBe(1);
    expect(f.changes).toEqual([1]);
    expect(f.viewport.getExposes().dragging.get()).toBe(false);
  });
  it('restores a rejected controlled drag and moves when the owner later accepts', async () => {
    const f = await fixture({ index: 0 });
    await f.drag(50);
    await f.release(50);
    expect(f.changes).toEqual([1]);
    expect(f.root.getExposes().index.get()).toBe(0);
    expect(f.viewport.scrollLeft).toBe(0);
    await f.drag(50);
    await f.release(50);
    expect(f.changes).toEqual([1, 1]);
    setElementProps(f.root, { index: 1 });
    await flush();
    expect(f.viewport.scrollLeft).toBe(300);
  });
  it('uses synchronous controlled acceptance and cancels without a proposal', async () => {
    const f = await fixture({ index: 0 });
    f.root.addEventListener('indexChange', (event: CustomEvent) =>
      setElementProps(f.root, { index: event.detail.index })
    );
    await f.drag(50);
    await f.release(50);
    expect(f.viewport.scrollLeft).toBe(300);
    await f.drag(50);
    f.viewport.dispatchEvent(pointer('pointercancel', 50));
    await flush();
    expect(f.viewport.scrollLeft).toBe(300);
    expect(f.changes).toEqual([1]);
  });
  it('settles native scroll to a snap point through the same controlled protocol', async () => {
    const f = await fixture({ index: 0 });
    vi.useFakeTimers();
    f.viewport.scrollLeft = 190;
    f.viewport.dispatchEvent(new Event('scroll'));
    await flush();
    expect(f.viewport.getExposes().scrollPosition.get()).toBeCloseTo(190 / 1200);
    expect(f.root.getExposes().index.get()).toBe(0);
    await vi.advanceTimersByTimeAsync(121);
    await flush();
    expect(f.changes).toEqual([1]);
    expect(f.viewport.scrollLeft).toBe(0);
  });
  it('maintains multiple visible items and clamps to the final aligned group after resize', async () => {
    const f = await fixture({ slidesPerView: 3, minSlideSize: 150 });
    expect(f.root.getExposes().visibleSlides.get()).toBeCloseTo(3);
    expect(f.root.getExposes().maxIndex.get()).toBe(2);
    expect(f.slides.map((slide: any) => slide.getExposes().hidden.get())).toEqual([
      false,
      false,
      false,
      true,
      true,
    ]);
    f.root.getExposes().requestIndex(4);
    await flush();
    expect(f.root.getExposes().index.get()).toBe(2);
    expect(f.viewport.scrollLeft).toBeCloseTo(200);
    await f.resize(300, 750); // Five 150px items: two fit after the minimum-size constraint.
    expect(f.root.getExposes().visibleSlides.get()).toBeCloseTo(2);
    expect(f.root.getExposes().maxIndex.get()).toBe(3);
    expect(f.viewport.scrollLeft).toBeCloseTo(300);
    f.next.click();
    await flush();
    expect(f.viewport.scrollLeft).toBeCloseTo(450);
    expect(f.next.getExposes().disabled.get()).toBe(true);
    expect(f.slides[0].style.getPropertyValue('--pui-basis')).toBe(String(100 / 3));
    expect(f.slides[0].style.getPropertyValue('--pui-min-size')).toBe('150');
  });
  it.each(['pointercancel', 'lostpointercapture'])(
    'cancels %s and makes a retired view inert',
    async (terminal) => {
      const f = await fixture();
      await f.drag(50);
      f.viewport.dispatchEvent(pointer(terminal, 50));
      await flush();
      expect(f.changes).toEqual([]);
      expect(f.viewport.scrollLeft).toBe(0);
      await f.drag(50);
      f.root.remove();
      await flush();
      f.viewport.dispatchEvent(pointer('pointerup', 50));
      await flush();
      expect(f.changes).toEqual([]);
    }
  );
  it('cancels on disable and stops disabled navigation and drag requests', async () => {
    const f = await fixture();
    await f.drag(50);
    setElementProps(f.root, { disabled: true });
    await flush();
    expect(f.viewport.scrollLeft).toBe(0);
    await f.release(50);
    f.next.click();
    await f.drag(50);
    await f.release(50);
    expect(f.changes).toEqual([]);
  });
  it('cancels a touch contact and invalidates an active basis when the viewport resizes', async () => {
    const f = await fixture();
    await f.drag(50, 'touch');
    expect(f.viewport.scrollLeft).toBe(200);
    f.viewport.dispatchEvent(pointer('pointercancel', 50, 250, 'touch'));
    await flush();
    expect(f.viewport.scrollLeft).toBe(0);
    await f.drag(50);
    await f.resize(600, 1500);
    await f.release(50);
    expect(f.viewport.getExposes().dragging.get()).toBe(false);
    expect(f.viewport.scrollLeft).toBe(0);
    expect(f.changes).toEqual([]);
  });
  it('retires a contact on owner index or axis changes without committing the stale release', async () => {
    const f = await fixture({ index: 0 });
    await f.drag(50);
    setElementProps(f.root, { index: 2 });
    await flush();
    expect(f.viewport.scrollLeft).toBe(600);
    await f.release(50);
    expect(f.changes).toEqual([]);
    await f.drag(50);
    f.root.setAttribute('data-test-vertical', 'true');
    setElementProps(f.root, { index: 2, orientation: 'vertical' });
    await flush();
    expect(f.viewport.style.overflowY).toBe('auto');
    expect(f.viewport.style.overflowX).toBe('hidden');
    expect(f.viewport.scrollTop).toBe(600);
    await f.release(50);
    expect(f.changes).toEqual([]);
  });
  it('preserves the initial index and uses the reachable multi-item range for buttons and keys', async () => {
    const f = await fixture({ defaultIndex: 2, slidesPerView: 2, loop: true });
    expect(f.root.getExposes().index.get()).toBe(2);
    expect(f.viewport.scrollLeft).toBe(300);
    f.next.click();
    f.next.click();
    await flush();
    expect(f.root.getExposes().index.get()).toBe(0);
    f.previous.click();
    await flush();
    expect(f.root.getExposes().index.get()).toBe(3);
    expect(f.viewport.scrollLeft).toBe(450);
    f.viewport.focus();
    await flush();
    f.viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    await flush();
    expect(f.viewport.scrollLeft).toBe(0);
    f.viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    await flush();
    expect(f.viewport.scrollLeft).toBe(450);
  });
  it('maps vertical contact to vertical scrolling', async () => {
    const f = await fixture({ orientation: 'vertical' });
    await f.drag(50);
    await f.release(50);
    expect(f.viewport.scrollTop).toBe(300);
    expect(f.viewport.scrollLeft).toBe(0);
  });
  it('maps RTL logical next to negative native offsets', async () => {
    const f = await fixture({ direction: 'rtl' });
    f.viewport.dispatchEvent(pointer('pointerdown', 50));
    f.viewport.dispatchEvent(pointer('pointermove', 70));
    f.viewport.dispatchEvent(pointer('pointermove', 250));
    await flush();
    expect(f.viewport.scrollLeft).toBe(-200);
    f.viewport.dispatchEvent(pointer('pointerup', 250));
    await flush();
    expect(f.viewport.scrollLeft).toBe(-300);
    expect(f.changes).toEqual([1]);
  });
  it.each(Object.keys(families))('%s inherits continuous multi-item semantics', async (family) => {
    const f = await fixture({ slidesPerView: 2 }, family);
    await f.drag(50);
    await f.release(50);
    expect(f.root.getExposes().index.get()).toBe(1);
    expect(f.viewport.scrollLeft).toBeCloseTo(150);
    expect(f.slides[1].getExposes().hidden.get()).toBe(false);
    expect(f.slides[2].getExposes().hidden.get()).toBe(false);
    const tokens = f.slides[0].getAttribute('data-pui-style').split(' ');
    const basis = tokens.find((token: string) => token.startsWith('basis-'));
    expect(basis).toContain('max(calc(var(--pui-basis)');
    expect(renderProtoStyleTokenCss([basis])).toContain('flex-basis: min(100%,max(');
  });
});

it('chooses the actually nearest end-aligned partial-item snap', () => {
  expect(base.carouselSnapIndex(2.24, 2.5)).toBe(2);
  expect(base.carouselSnapIndex(2.26, 2.5)).toBe(3);
  expect(base.carouselPosition(3, 5, 2.5)).toBe(1);
});
