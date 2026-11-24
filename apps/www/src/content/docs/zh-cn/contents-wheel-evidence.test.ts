import { afterEach, describe, expect, it, vi } from 'vitest';
import { observeContentsWheel } from './contents-wheel-evidence';

// Injected layout is only an oracle control. Real scrolling is exercised by
// homepage-dogfood.browser.test.ts with Chromium and trusted mouse-wheel input.
function fixture(split = false) {
  const host = document.createElement('div');
  document.body.append(host);
  host.style.setProperty('--proto-ui-available-height', '400px');
  host.style.setProperty('--proto-ui-available-width', '300px');
  const surface = split ? document.createElement('div') : host;
  if (split) {
    surface.setAttribute('data-pui-split-surface', '');
    const root = host.attachShadow({ mode: 'open' });
    root.append(surface);
    // happy-dom has no native shadow hit testing; inject its observed target
    // just as the fixture injects layout and the document-level hit below.
    Object.defineProperty(root, 'elementFromPoint', {
      value: () => root.querySelector('[data-pui-split-surface]'),
    });
  }
  surface.style.overflowY = 'auto';
  Object.defineProperties(surface, {
    clientHeight: { value: 400, configurable: true },
    scrollHeight: { value: 1200, configurable: true },
  });
  vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue(new DOMRect(20, 60, 300, 400));
  vi.spyOn(document, 'elementFromPoint').mockReturnValue(host);
  const observer = observeContentsWheel(host);
  return { host, surface, observer };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('Contents wheel observation boundaries', () => {
  it('rejects a zero-height surface even when its reported scroll range is positive', () => {
    const { surface, observer } = fixture();
    try {
      Object.defineProperty(surface, 'clientHeight', { value: 0 });
      vi.mocked(surface.getBoundingClientRect).mockReturnValue(new DOMRect(20, 60, 300, 0));
      expect(observer.read()).toMatchObject({ max: 1200, visible: false, ready: false });
      expect(surface.scrollTop).toBe(0);
    } finally {
      observer.dispose();
    }
  });

  it('requires real available-space facts and a viewport-contained surface before input', () => {
    const { host, surface, observer } = fixture();
    try {
      expect(observer.read()).toMatchObject({ ready: true, hitInContent: true });
      host.style.removeProperty('--proto-ui-available-height');
      expect(observer.read()).toMatchObject({ positioned: false, ready: false });
      host.style.setProperty('--proto-ui-available-height', '400px');
      vi.mocked(surface.getBoundingClientRect).mockReturnValue(new DOMRect(20, 2000, 300, 400));
      expect(observer.read()).toMatchObject({ positioned: true, visible: false, ready: false });
    } finally {
      observer.dispose();
    }
  });

  it('does not follow a replacement split surface as if it were the stimulated owner', () => {
    const { host, surface, observer } = fixture(true);
    try {
      expect(observer.read()).toMatchObject({ ready: true, sameSurface: true });
      const replacement = document.createElement('div');
      replacement.setAttribute('data-pui-split-surface', '');
      host.shadowRoot!.replaceChildren(replacement);
      expect(observer.read()).toMatchObject({ ready: false, sameSurface: false });
      expect(surface.scrollTop).toBe(0);
      expect(replacement.scrollTop).toBe(0);
    } finally {
      observer.dispose();
    }
  });

  it('rejects a different current dialog and a detached retained dialog', () => {
    const { host, observer } = fixture();
    const replacement = document.createElement('div');
    document.body.append(replacement);
    try {
      expect(observer.read(replacement)).toMatchObject({
        connected: true,
        sameDialog: false,
        sameSurface: true,
        ready: false,
      });
      host.remove();
      expect(observer.read(replacement)).toMatchObject({
        connected: false,
        sameDialog: false,
        sameSurface: true,
        ready: false,
      });
    } finally {
      observer.dispose();
    }
  });

  it('rejects lost readiness even when the retained current owner has moved', () => {
    const { host, surface, observer } = fixture();
    try {
      const before = observer.read(host);
      expect(before.ready).toBe(true);
      surface.scrollTop = 100;
      surface.style.overflowY = 'hidden';
      expect(observer.read(host)).toMatchObject({
        connected: true,
        sameDialog: true,
        sameSurface: true,
        top: 100,
        ready: false,
      });
      surface.style.overflowY = 'auto';
      vi.mocked(surface.getBoundingClientRect).mockReturnValue(new DOMRect(20, 2000, 300, 400));
      expect(observer.read(host)).toMatchObject({
        connected: true,
        sameDialog: true,
        sameSurface: true,
        top: 100,
        visible: false,
        ready: false,
      });
    } finally {
      observer.dispose();
    }
  });

  it('resolves a document hit retargeted to the host of the public shadow surface', () => {
    const { surface, observer } = fixture(true);
    const publicSurfaceObserver = observeContentsWheel(surface);
    try {
      expect(publicSurfaceObserver.read()).toMatchObject({ hitInContent: true });
      const outside = document.createElement('button');
      document.body.append(outside);
      vi.mocked(document.elementFromPoint).mockReturnValue(outside);
      expect(publicSurfaceObserver.read()).toMatchObject({ hitInContent: false });
    } finally {
      publicSurfaceObserver.dispose();
      observer.dispose();
    }
  });

  it('records synthetic/cancelled input honestly and removes its passive listener on disposal', async () => {
    const { surface, observer } = fixture();
    surface.addEventListener('wheel', (event) => event.preventDefault());
    surface.dispatchEvent(
      new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 500 })
    );
    await Promise.resolve();
    expect(observer.read().wheels).toEqual([
      {
        trusted: false,
        deltaY: 500,
        surfaceInPath: true,
        contentInPath: true,
        defaultPrevented: true,
      },
    ]);
    expect(surface.scrollTop).toBe(0);
    observer.dispose();
    surface.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 500 }));
    expect(observer.read().wheels).toHaveLength(1);
  });

  it('distinguishes an inner zero-range containment node from the retained public scroll owner', () => {
    const { surface, observer } = fixture();
    const pane = document.createElement('div');
    pane.id = 'borrowed-pane';
    pane.style.overflowX = 'hidden';
    pane.style.overflowY = 'hidden';
    pane.style.overscrollBehaviorY = 'contain';
    const target = document.createElement('summary');
    pane.append(target);
    surface.append(pane);
    vi.mocked(document.elementFromPoint).mockReturnValue(target);
    try {
      const before = observer.inspect();
      expect(before.content).toMatchObject({ isContent: true, hasShadowRoot: false });
      expect(before.hitChain.map((node) => node.tag).slice(0, 3)).toEqual([
        'summary',
        'div',
        'div',
      ]);
      expect(before.hitChain[1]).toMatchObject({
        id: 'borrowed-pane',
        isSurface: false,
        overflowY: 'hidden',
        overscrollY: 'contain',
        clientHeight: 0,
        scrollHeight: 0,
      });
      target.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 500 }));
      // Injected offsets/events exercise the recorder only, not UA scrolling.
      surface.scrollTop = 100;
      surface.dispatchEvent(new Event('scroll'));
      surface.scrollTop = 0;
      surface.dispatchEvent(new Event('scroll'));
      const after = observer.inspect();
      expect(after.wheelPaths[0].path.map((node) => node.tag).slice(0, 3)).toEqual([
        'summary',
        'div',
        'div',
      ]);
      expect(
        after.scrolls.map(({ top, trusted, target }) => [top, trusted, target.isSurface])
      ).toEqual([
        [100, false, true],
        [0, false, true],
      ]);
      for (let index = 0; index < 63; index++) surface.dispatchEvent(new Event('scroll'));
      expect(observer.inspect().scrolls).toHaveLength(64);
      expect(observer.inspect().droppedScrolls).toBe(1);
      observer.dispose();
      surface.dispatchEvent(new Event('scroll'));
      expect(observer.inspect().droppedScrolls).toBe(1);
    } finally {
      observer.dispose();
    }
  });

  it('samples cancellation at read time even after an intervening microtask checkpoint', async () => {
    const { surface, observer } = fixture();
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 500 });
    try {
      surface.dispatchEvent(event);
      await Promise.resolve();
      expect(observer.read().wheels[0].defaultPrevented).toBe(false);
      // Simulate a later native listener's cancellation after a checkpoint.
      // This checks the oracle's lifetime, not browser event dispatch ordering.
      event.preventDefault();
      expect(observer.read().wheels[0].defaultPrevented).toBe(true);
      expect(surface.scrollTop).toBe(0);
    } finally {
      observer.dispose();
    }
  });
});
