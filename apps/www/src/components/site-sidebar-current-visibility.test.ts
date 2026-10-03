import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  initSidebarCurrentVisibility,
  nearestEdgeScrollTop,
  nearestSidebarScroller,
} from './site-sidebar-current-visibility';

let frames: Map<number, FrameRequestCallback>;
let id: number;
let stop: (() => void) | undefined;
beforeEach(() => {
  frames = new Map();
  id = 0;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.set(++id, callback);
    return id;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((key) => {
    frames.delete(key);
  });
});
afterEach(() => {
  stop?.();
  stop = undefined;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
async function flush() {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
    const next = [...frames.entries()];
    frames.clear();
    for (const [, callback] of next) callback(i);
  }
  expect(frames.size, 'request is bounded after actual layout settles').toBe(0);
}
function fixture(mobile = false) {
  document.body.innerHTML =
    '<button id="focus">Keep focus</button><nav class="docs-sidebar"><div class="sidebar-pane"><ul class="top-level"><li><details><summary>Group</summary><a href="/current" aria-current="page">Current article</a></details></li></ul></div></nav>';
  const root = document.querySelector<HTMLElement>('.docs-sidebar')!;
  const pane = root.querySelector<HTMLElement>('.sidebar-pane')!;
  const owner = mobile ? pane : root;
  owner.style.overflowY = 'auto';
  Object.defineProperties(owner, {
    clientHeight: { configurable: true, value: 300 },
    clientTop: { configurable: true, value: 0 },
    scrollHeight: { configurable: true, value: 1500 },
  });
  const rect = (top: number, height: number) => ({
    x: 0,
    y: top,
    top,
    bottom: top + height,
    left: 0,
    right: 240,
    width: 240,
    height,
    toJSON() {},
  });
  vi.spyOn(owner, 'getBoundingClientRect').mockImplementation(() => rect(100, 300));
  const link = root.querySelector<HTMLAnchorElement>('a')!;
  vi.spyOn(link, 'getBoundingClientRect').mockImplementation(() => rect(900 - owner.scrollTop, 44));
  return { root, pane, owner, link };
}
describe('current article nearest-edge layout', () => {
  it.each([false, true])(
    'uses the actual desktop/mobile scroll owner (%s), preserving focus and document scroll',
    async (mobile) => {
      const { root, owner, link } = fixture(mobile);
      const focused = document.querySelector<HTMLButtonElement>('#focus')!;
      focused.focus();
      const oldY = window.scrollY;
      expect(nearestSidebarScroller(link, root)).toBe(owner);
      stop = initSidebarCurrentVisibility(root);
      expect(initSidebarCurrentVisibility(root)).toBe(stop);
      await flush();
      expect(root.querySelector('details')!.open).toBe(true);
      expect(owner.scrollTop).toBe(544);
      expect(document.activeElement).toBe(focused);
      expect(window.scrollY).toBe(oldY);
      expect(link.getBoundingClientRect().bottom).toBe(400);
    }
  );
  it('does not schedule forever without a current article', async () => {
    const { root } = fixture();
    root.querySelector('a')!.remove();
    stop = initSidebarCurrentVisibility(root);
    await flush();
  });
  it('waits for the actual mobile drawer opening', async () => {
    const { root, owner, link } = fixture(true);
    let open = false;
    vi.mocked(link.getBoundingClientRect).mockImplementation(() => ({
      x: 0,
      y: 900 - owner.scrollTop,
      top: 900 - owner.scrollTop,
      bottom: 944 - owner.scrollTop,
      left: 0,
      right: open ? 240 : 0,
      width: open ? 240 : 0,
      height: open ? 44 : 0,
      toJSON() {},
    }));
    stop = initSidebarCurrentVisibility(root);
    await flush();
    expect(owner.scrollTop).toBe(0);
    open = true;
    document.dispatchEvent(new CustomEvent('site-contents:open'));
    await flush();
    expect(owner.scrollTop).toBe(544);
  });
  it.each(['wheel', 'touchstart', 'pointerdown'])(
    'yields to manual %s before late layout/open callbacks',
    async (type) => {
      const { root, owner } = fixture();
      stop = initSidebarCurrentVisibility(root);
      root.dispatchEvent(new Event(type));
      document.dispatchEvent(new CustomEvent('site-contents:open'));
      await flush();
      expect(owner.scrollTop).toBe(0);
    }
  );
  it('does not pull back after the user scrolls away from the revealed item', async () => {
    const { root, owner } = fixture();
    stop = initSidebarCurrentVisibility(root);
    await flush();
    root.dispatchEvent(new WheelEvent('wheel'));
    owner.scrollTop = 10;
    document.dispatchEvent(new CustomEvent('site-contents:open'));
    await flush();
    expect(owner.scrollTop).toBe(10);
  });
  it('cancels queued work on disposal and allows a later route owner', async () => {
    const { root, owner } = fixture();
    const old = initSidebarCurrentVisibility(root);
    old();
    await flush();
    expect(owner.scrollTop).toBe(0);
    stop = initSidebarCurrentVisibility(root);
    expect(stop).not.toBe(old);
    await flush();
    expect(owner.scrollTop).toBe(544);
  });
  it('never selects the body/document as a scroll owner', () => {
    const { root, link } = fixture();
    root.style.overflowY = 'visible';
    document.body.style.overflowY = 'auto';
    expect(nearestSidebarScroller(link, root)).toBeNull();
  });
  it('keeps visible rows stable, clamps bounds and aligns an over-tall row start', () => {
    const input = {
      top: 120,
      bottom: 164,
      viewportTop: 100,
      viewportHeight: 300,
      scrollTop: 50,
      scrollHeight: 1000,
    };
    expect(nearestEdgeScrollTop(input)).toBe(50);
    expect(nearestEdgeScrollTop({ ...input, top: 20, bottom: 64 })).toBe(0);
    expect(nearestEdgeScrollTop({ ...input, top: 120, bottom: 700 })).toBe(70);
    expect(nearestEdgeScrollTop({ ...input, top: 1600, bottom: 1644 })).toBe(700);
  });
});
