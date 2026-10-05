import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  initSiteContentsNavigation,
  initSiteHeaderDisclosure,
  type SiteHeaderDisclosure,
} from './site-header-disclosure';

let disclosure: SiteHeaderDisclosure | undefined;
let destroyContents: (() => void) | undefined;
let query: MediaQueryList;
function fixture(mobile = true) {
  const target = new EventTarget();
  query = Object.assign(target, { matches: mobile }) as MediaQueryList;
  vi.spyOn(window, 'matchMedia').mockReturnValue(query);
  document.body.innerHTML = `<header data-site-header>
    <nav data-site-header-desktop-navigation><a href="/docs/">Docs</a></nav>
    <div data-site-header-panel id="navigation-panel">
      <nav data-site-header-navigation><a href="/docs/">Docs</a></nav><div data-site-header-compact-context></div>
      <div data-site-header-settings id="settings-panel"><a href="/zh-cn/">简体中文</a></div>
    </div>
    <div data-site-header-context><div data-site-header-preferences><button data-runtime>Runtime</button><input value="retained" /></div><button data-contents>Contents</button></div><button data-menu>Menu</button>
  </header><button data-outside>Outside</button>`;
  const root = document.querySelector<HTMLElement>('header')!;
  const button = root.querySelector<HTMLButtonElement>('[data-menu]')!;
  disclosure = initSiteHeaderDisclosure(root);
  disclosure.bindButton(button);
  return {
    root,
    button,
    navigation: root.querySelector<HTMLElement>('[data-site-header-navigation]')!,
    desktopNavigation: root.querySelector<HTMLElement>('[data-site-header-desktop-navigation]')!,
    panel: root.querySelector<HTMLElement>('[data-site-header-panel]')!,
    settings: root.querySelector<HTMLElement>('[data-site-header-settings]')!,
  };
}
beforeEach(() => vi.restoreAllMocks());
afterEach(() => {
  destroyContents?.();
  destroyContents = undefined;
  disclosure?.destroy();
  document.body.removeAttribute('data-mobile-menu-expanded');
  disclosure = undefined;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('shared website navigation disclosure', () => {
  it('keeps SSR navigation available until a real Button is ready, then opens and returns focus on Escape', async () => {
    const { root, button, navigation, settings } = fixture();
    expect(navigation.hidden).toBe(false);
    expect(settings.hidden).toBe(false);
    expect(initSiteHeaderDisclosure(root)).toBe(disclosure);
    disclosure!.enhance();
    expect(navigation.hidden).toBe(true);
    expect(settings.hidden).toBe(true);
    expect(button.getAttribute('aria-controls')).toBe('navigation-panel');
    disclosure!.toggle();
    await Promise.resolve();
    expect(navigation.hidden).toBe(false);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(navigation.querySelector('a'));
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    );
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button);
  });

  it('moves the same preferences owner into the compact panel only after enhancement', () => {
    const { root, panel } = fixture();
    const context = root.querySelector('[data-site-header-context]')!;
    const preferences = root.querySelector('[data-site-header-preferences]')!;
    const input = preferences.querySelector('input')!;
    expect(preferences.parentElement).toBe(context);
    disclosure!.enhance();
    expect(panel.contains(preferences)).toBe(true);
    expect(preferences.querySelector('input')).toBe(input);
    expect(context.contains(root.querySelector('[data-contents]'))).toBe(true);
    disclosure!.destroy();
    expect(preferences.parentElement).toBe(context);
    expect(input.value).toBe('retained');
  });

  it('keeps focused preferences visible and preserves identity across both breakpoint moves', () => {
    const { root, panel, button } = fixture(false);
    disclosure!.enhance();
    const preferences = root.querySelector('[data-site-header-preferences]')!;
    const input = preferences.querySelector('input')!;
    input.focus();
    input.setSelectionRange(1, 4);
    Object.defineProperty(query, 'matches', { value: true, configurable: true });
    query.dispatchEvent(new Event('change'));
    expect(panel.contains(preferences)).toBe(true);
    expect(panel.hidden).toBe(false);
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([1, 4]);
    Object.defineProperty(query, 'matches', { value: false, configurable: true });
    query.dispatchEvent(new Event('change'));
    expect(preferences.parentElement).toBe(root.querySelector('[data-site-header-context]'));
    expect(document.activeElement).toBe(input);
    Object.defineProperty(query, 'matches', { value: true, configurable: true });
    query.dispatchEvent(new Event('change'));
    disclosure!.close();
    expect(document.activeElement).toBe(button);
    expect(root.querySelectorAll('[data-site-header-preferences]')).toHaveLength(1);
  });

  it('keeps desktop links inline while the controlled settings are collapsed', async () => {
    const { button, navigation, desktopNavigation, settings, panel } = fixture(false);
    disclosure!.enhance();
    expect(desktopNavigation.hidden).toBe(false);
    expect(navigation.hidden).toBe(true);
    expect(settings.hidden).toBe(true);
    expect(panel.hidden).toBe(true);
    expect(button.getAttribute('aria-controls')).toBe('navigation-panel');
    disclosure!.toggle();
    await Promise.resolve();
    expect(document.activeElement).toBe(settings.querySelector('a'));
    disclosure!.close();
    expect(desktopNavigation.hidden).toBe(false);
    expect(navigation.hidden).toBe(true);
  });

  it('retains open state and rebinds return focus across a runtime generation', async () => {
    const { root, button } = fixture();
    disclosure!.enhance();
    disclosure!.toggle();
    const staged = document.createElement('div');
    staged.dataset.projectionGenerationState = 'prepared';
    const replacement = document.createElement('button');
    staged.append(replacement);
    root.append(staged);
    const unbind = disclosure!.bindButton(replacement);
    expect(replacement.getAttribute('aria-expanded')).toBe('true');
    button.remove();
    staged.dataset.projectionGenerationState = 'active';
    disclosure!.enhance();
    expect(root.dataset.siteMenuOpen).toBe('true');
    disclosure!.close(true);
    expect(document.activeElement).toBe(replacement);
    unbind();
  });

  it('does not close while using Runtime or a portaled Select, and respects the Select Escape', () => {
    const { root } = fixture();
    disclosure!.enhance();
    disclosure!.toggle();
    root
      .querySelector('[data-runtime]')!
      .dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(root.dataset.siteMenuOpen).toBe('true');
    const listbox = document.createElement('div');
    listbox.setAttribute('role', 'listbox');
    listbox.id = 'owned-language-options';
    root.querySelector('[data-runtime]')!.setAttribute('aria-controls', listbox.id);
    document.body.append(listbox);
    listbox.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    listbox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(root.dataset.siteMenuOpen).toBe('true');
    document
      .querySelector('[data-outside]')!
      .dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(root.dataset.siteMenuOpen).toBe('false');
  });

  it('lets an open nested Select consume immediate Escape before its delayed focus entry', () => {
    const { root } = fixture();
    disclosure!.enhance();
    disclosure!.toggle();
    const trigger = root.querySelector<HTMLElement>('[data-runtime]')!;
    const popup = document.createElement('div');
    popup.id = 'immediate-nested';
    popup.setAttribute('role', 'listbox');
    document.body.append(popup);
    trigger.setAttribute('aria-controls', popup.id);
    trigger.setAttribute('aria-expanded', 'true');
    trigger.addEventListener(
      'keydown',
      () => {
        trigger.setAttribute('aria-expanded', 'false');
        popup.remove();
      },
      { once: true }
    );
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(root.dataset.siteMenuOpen).toBe('true');
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(root.dataset.siteMenuOpen).toBe('false');
  });

  it('does not treat an unrelated portaled listbox as Header-owned', () => {
    const { root } = fixture();
    disclosure!.enhance();
    disclosure!.toggle();
    const foreign = document.createElement('div');
    foreign.id = 'foreign-options';
    foreign.setAttribute('role', 'listbox');
    document.body.append(foreign);
    foreign.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(root.dataset.siteMenuOpen).toBe('false');
  });

  it('restores a focused inline link to Menu when shrinking, without moving mounted nodes', () => {
    const { desktopNavigation: navigation, button } = fixture(false);
    disclosure!.enhance();
    const link = navigation.querySelector('a')!;
    link.focus();
    Object.defineProperty(query, 'matches', { value: true });
    query.dispatchEvent(new Event('change'));
    expect(navigation.hidden).toBe(true);
    expect(document.activeElement).toBe(button);
    expect(navigation.querySelector('a')).toBe(link);
  });

  it('keeps an open disclosure usable when mobile navigation becomes hidden on desktop', async () => {
    const { navigation, desktopNavigation, panel, button } = fixture(true);
    disclosure!.enhance();
    disclosure!.toggle();
    await Promise.resolve();
    expect(document.activeElement).toBe(navigation.querySelector('a'));
    Object.defineProperty(query, 'matches', { value: false });
    query.dispatchEvent(new Event('change'));
    expect(navigation.hidden).toBe(true);
    expect(desktopNavigation.hidden).toBe(false);
    expect(panel.hidden).toBe(false);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(button);
  });

  it('restores readable fallback and removes listeners on disposal', () => {
    const { root, navigation, settings } = fixture();
    disclosure!.enhance();
    disclosure!.toggle();
    disclosure!.destroy();
    expect(navigation.hidden).toBe(false);
    expect(settings.hidden).toBe(false);
    expect(root.hasAttribute('data-site-menu-ready')).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(root.hasAttribute('data-site-menu-open')).toBe(false);
  });

  it('makes global navigation and contents mutually exclusive so one Escape returns focus only to the active opener', async () => {
    const { root, button } = fixture();
    const contentsHost = document.createElement('starlight-menu-button');
    const contentsButton = document.createElement('button');
    contentsButton.textContent = 'Contents';
    contentsHost.append(contentsButton);
    root.append(contentsHost);
    // Model Starlight's existing click owner; the website only coordinates drawers.
    contentsButton.addEventListener('click', () => {
      contentsHost.setAttribute('aria-expanded', 'true');
      document.body.setAttribute('data-mobile-menu-expanded', '');
    });
    const desktopQuery = Object.assign(new EventTarget(), { matches: false }) as MediaQueryList;
    vi.mocked(window.matchMedia).mockReturnValue(desktopQuery);
    destroyContents = initSiteContentsNavigation(document);
    expect(initSiteContentsNavigation(document)).toBe(destroyContents);
    disclosure!.enhance();

    contentsButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(contentsButton.getAttribute('aria-expanded')).toBe('true');
    disclosure!.toggle();
    await Promise.resolve();
    expect(contentsButton.getAttribute('aria-expanded')).toBe('false');
    expect(document.body.hasAttribute('data-mobile-menu-expanded')).toBe(false);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    );
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keyup', { key: 'Escape', bubbles: true })
    );
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute('aria-expanded')).toBe('false');

    disclosure!.toggle();
    await Promise.resolve();
    contentsButton.focus();
    contentsButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(contentsButton.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(contentsButton);
    contentsButton.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    );
    contentsButton.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));
    expect(document.activeElement).toBe(contentsButton);
    expect(contentsButton.getAttribute('aria-expanded')).toBe('false');
  });

  it('cleans both drawer listeners and contents observer before Astro navigation', async () => {
    const { root, button } = fixture();
    const host = document.createElement('starlight-menu-button');
    host.innerHTML = '<button>Contents</button>';
    root.append(host);
    vi.mocked(window.matchMedia).mockReturnValue(
      Object.assign(new EventTarget(), { matches: false }) as MediaQueryList
    );
    destroyContents = initSiteContentsNavigation(document);
    disclosure!.enhance();
    disclosure!.toggle();
    document.dispatchEvent(new Event('astro:before-swap'));
    host.setAttribute('aria-expanded', 'true');
    document.body.setAttribute('data-mobile-menu-expanded', '');
    await new Promise((resolve) => setTimeout(resolve, 0));
    button.focus();
    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape' }));
    expect(document.activeElement).toBe(button);
    expect(host.getAttribute('aria-expanded')).toBe('true');
    expect(root.hasAttribute('data-site-menu-open')).toBe(false);
  });
});

describe('actual Header Button anchoring', () => {
  it('keeps the current binding when an older lease for the same Button retires', () => {
    const { root, button, panel } = fixture(false);
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 360, 56));
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(new DOMRect(280, 6, 44, 44));
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 280, 300));
    const old = disclosure!.bindButton(button);
    disclosure!.bindButton(button);
    old();
    disclosure!.enhance();
    disclosure!.toggle();
    expect(panel.style.getPropertyValue('--site-header-panel-top')).toBe('55px');
  });
  it('follows state-driven Button translation without a resize and cancels late work', async () => {
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrame = 0;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    });
    const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      frames.delete(id);
    });
    const { root, button, panel } = fixture(false);
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    vi.spyOn(root, 'offsetWidth', 'get').mockReturnValue(360);
    vi.spyOn(root, 'offsetHeight', 'get').mockReturnValue(56);
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 360, 56));
    let translated = false;
    vi.spyOn(button, 'getBoundingClientRect').mockImplementation(
      () => new DOMRect(translated ? 284 : 280, translated ? 10 : 6, 44, 44)
    );
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 280, 300));
    disclosure!.enhance();
    disclosure!.toggle();
    expect(panel.style.getPropertyValue('--site-header-panel-top')).toBe('55px');
    translated = true;
    button.setAttribute('data-hovered', '');
    button.setAttribute('data-pressed', '');
    await vi.waitFor(() => expect(frames.size).toBe(1));
    const [id, callback] = [...frames][0];
    frames.delete(id);
    callback(0);
    expect(panel.style.getPropertyValue('--site-header-panel-top')).toBe('59px');
    expect(panel.style.getPropertyValue('--site-header-panel-left')).toBe('48px');
    translated = false;
    button.removeAttribute('data-hovered');
    button.removeAttribute('data-pressed');
    await vi.waitFor(() => expect(frames.size).toBe(1));
    const late = [...frames.values()][0];
    disclosure!.destroy();
    expect(cancel).toHaveBeenCalled();
    expect(frames.size).toBe(0);
    late(0);
    expect(panel.style.getPropertyValue('--site-header-panel-top')).toBe('');
  });
  for (const width of [320, 390])
    for (const rtl of [false, true]) {
      it(`${width}px ${rtl ? 'RTL' : 'LTR'} anchors the painted box to the current Button`, () => {
        const { root, button, panel } = fixture(false);
        root.style.direction = rtl ? 'rtl' : 'ltr';
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
        vi.spyOn(root, 'offsetWidth', 'get').mockReturnValue(width - 32);
        vi.spyOn(root, 'offsetHeight', 'get').mockReturnValue(56);
        vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(
          new DOMRect(16, 10, width - 32, 56)
        );
        const anchorLeft = rtl ? 24 : width - 68;
        vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(
          new DOMRect(anchorLeft, 16, 44, 44)
        );
        vi.spyOn(panel, 'getBoundingClientRect').mockImplementation(
          () =>
            new DOMRect(
              0,
              0,
              Math.min(
                352,
                parseFloat(panel.style.getPropertyValue('--site-header-panel-max-width'))
              ),
              500
            )
        );
        disclosure!.enhance();
        disclosure!.toggle();
        const panelWidth = panel.getBoundingClientRect().width;
        const left = parseFloat(panel.style.getPropertyValue('--site-header-panel-left')) + 16;
        expect(rtl ? left : left + panelWidth).toBe(rtl ? anchorLeft : anchorLeft + 44);
        expect(left).toBeGreaterThanOrEqual(8);
        expect(left + panelWidth).toBeLessThanOrEqual(width - 8);
        expect(panel.style.getPropertyValue('--site-header-panel-top')).toBe('55px');
        expect(panel.style.getPropertyValue('--site-header-panel-max-height')).toBe('771px');
        // Header height may include wrapped branding; anchor remains this Button.
        vi.mocked(root.getBoundingClientRect).mockReturnValue(new DOMRect(16, 10, width - 32, 100));
        vi.mocked(Object.getOwnPropertyDescriptor(root, 'offsetHeight')!.get!).mockReturnValue(100);
        window.dispatchEvent(new Event('resize'));
        expect(panel.style.getPropertyValue('--site-header-panel-top')).toBe('55px');
      });
    }

  it('repositions from the newly active runtime Button and clears owned measurements on destroy', () => {
    const { root, button, panel } = fixture(false);
    vi.spyOn(root, 'offsetWidth', 'get').mockReturnValue(360);
    vi.spyOn(root, 'offsetHeight', 'get').mockReturnValue(56);
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 360, 56));
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(new DOMRect(300, 6, 44, 44));
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 280, 400));
    disclosure!.enhance();
    disclosure!.toggle();
    expect(panel.style.getPropertyValue('--site-header-panel-top')).toBe('55px');
    const nextHost = document.createElement('div');
    nextHost.dataset.projectionGenerationState = 'staging';
    const next = document.createElement('button');
    nextHost.append(next);
    root.append(nextHost);
    vi.spyOn(next, 'getBoundingClientRect').mockReturnValue(new DOMRect(280, 28, 44, 44));
    disclosure!.bindButton(next);
    expect(panel.style.getPropertyValue('--site-header-panel-top')).toBe('55px');
    button.remove();
    nextHost.dataset.projectionGenerationState = 'active';
    disclosure!.enhance();
    expect(panel.style.getPropertyValue('--site-header-panel-top')).toBe('77px');
    expect(panel.style.getPropertyValue('--site-header-panel-left')).toBe('44px');
    disclosure!.destroy();
    expect(panel.style.getPropertyValue('--site-header-panel-top')).toBe('');
  });
});

// Geometry is injected here; browser evidence measures the real layout.
describe('Docs header offset ownership', () => {
  function measuredFixture(initial = '7rem') {
    let deliver!: () => void;
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          deliver = callback;
        }
        observe = observe;
        disconnect = disconnect;
      }
    );
    document.body.innerHTML =
      '<div class="site-page-frame"><header data-site-header data-docs-site-header><div data-site-header-panel><nav data-site-header-navigation></nav><div data-site-header-settings></div></div></header></div>';
    const frame = document.querySelector<HTMLElement>('.site-page-frame')!;
    const root = frame.querySelector<HTMLElement>('header')!;
    if (initial) frame.style.setProperty('--header-height', initial, 'important');
    let height = 137;
    vi.spyOn(root, 'offsetHeight', 'get').mockImplementation(() => height);
    const writes = vi.spyOn(frame.style, 'setProperty');
    disclosure = initSiteHeaderDisclosure(root);
    disclosure.enhance();
    return {
      frame,
      root,
      deliver: () => deliver(),
      observe,
      disconnect,
      writes,
      setHeight: (next: number) => {
        height = next;
      },
    };
  }
  afterEach(() => vi.unstubAllGlobals());

  it('publishes actual height once, ignores unchanged portal delivery and follows font-driven height', () => {
    const h = measuredFixture();
    expect(h.frame.style.getPropertyValue('--header-height')).toBe('137px');
    expect(h.observe).toHaveBeenCalledWith(h.root);
    expect(h.observe).toHaveBeenCalledWith(h.root.querySelector('[data-site-header-panel]'));
    expect(initSiteHeaderDisclosure(h.root)).toBe(disclosure);
    const writes = h.writes.mock.calls.length;
    const portal = document.createElement('div');
    portal.setAttribute('role', 'listbox');
    document.body.append(portal);
    h.deliver();
    h.deliver();
    expect(h.writes.mock.calls).toHaveLength(writes);
    h.setHeight(221);
    h.deliver();
    expect(h.frame.style.getPropertyValue('--header-height')).toBe('221px');
    h.setHeight(0);
    h.deliver();
    expect(h.frame.style.getPropertyValue('--header-height')).toBe('221px');
  });

  it('restores the exact fallback priority, disconnects and ignores late observer delivery', () => {
    const h = measuredFixture();
    document.dispatchEvent(new Event('astro:before-swap'));
    expect(h.disconnect).toHaveBeenCalledOnce();
    expect(h.frame.style.getPropertyValue('--header-height')).toBe('7rem');
    expect(h.frame.style.getPropertyPriority('--header-height')).toBe('important');
    h.setHeight(500);
    h.deliver();
    expect(h.frame.style.getPropertyValue('--header-height')).toBe('7rem');
  });

  it('removes an initially absent value without overwriting a later external owner', () => {
    const first = measuredFixture('');
    expect(first.frame.style.getPropertyValue('--header-height')).toBe('137px');
    disclosure!.destroy();
    expect(first.frame.style.getPropertyValue('--header-height')).toBe('');
    const second = measuredFixture('');
    second.frame.style.setProperty('--header-height', '137px', 'important');
    disclosure!.destroy();
    expect(second.frame.style.getPropertyValue('--header-height')).toBe('137px');
    expect(second.frame.style.getPropertyPriority('--header-height')).toBe('important');
  });
});

describe('compact navigation viewport and history', () => {
  for (const width of [390, 430]) {
    it(`${width}px uses the remaining visual viewport rather than a 22rem trigger popup`, () => {
      const { root, button, panel } = fixture();
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
      vi.spyOn(root, 'offsetWidth', 'get').mockReturnValue(width - 32);
      vi.spyOn(root, 'offsetHeight', 'get').mockReturnValue(56);
      vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(new DOMRect(16, 0, width - 32, 56));
      vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(new DOMRect(width - 68, 6, 44, 44));
      vi.spyOn(panel, 'getBoundingClientRect').mockImplementation(
        () =>
          new DOMRect(
            0,
            0,
            parseFloat(panel.style.getPropertyValue('--site-header-panel-max-width')),
            783
          )
      );
      disclosure!.enhance();
      disclosure!.toggle();
      expect(panel.style.getPropertyValue('--site-header-panel-left')).toBe('-8px');
      expect(panel.style.getPropertyValue('--site-header-panel-max-width')).toBe(`${width - 16}px`);
      expect(panel.style.getPropertyValue('--site-header-panel-top')).toBe('61px');
      expect(panel.style.getPropertyValue('--site-header-panel-max-height')).toBe('775px');
      // Hover/pressed translation cannot move a full-width mobile panel.
      vi.mocked(button.getBoundingClientRect).mockReturnValue(new DOMRect(width - 64, 10, 44, 44));
      window.dispatchEvent(new Event('resize'));
      expect(panel.style.getPropertyValue('--site-header-panel-top')).toBe('61px');
      // A genuinely taller header moves the panel without hiding its Close row.
      vi.mocked(root.getBoundingClientRect).mockReturnValue(new DOMRect(16, 0, width - 32, 100));
      vi.mocked(Object.getOwnPropertyDescriptor(root, 'offsetHeight')!.get!).mockReturnValue(100);
      window.dispatchEvent(new Event('resize'));
      expect(panel.style.getPropertyValue('--site-header-panel-top')).toBe('105px');
      expect(panel.style.getPropertyValue('--site-header-panel-max-height')).toBe('731px');
    });
  }
  it('closes on Back/Forward and restored pages without adding history entries', () => {
    const { panel } = fixture();
    const push = vi.spyOn(history, 'pushState');
    disclosure!.enhance();
    disclosure!.toggle();
    expect(panel.hidden).toBe(false);
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(panel.hidden).toBe(true);
    disclosure!.toggle();
    window.dispatchEvent(new Event('pageshow'));
    expect(panel.hidden).toBe(true);
    expect(push).not.toHaveBeenCalled();
  });
});
