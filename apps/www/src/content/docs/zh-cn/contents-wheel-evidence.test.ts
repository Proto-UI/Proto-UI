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
    host.attachShadow({ mode: 'open' }).append(surface);
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
});
