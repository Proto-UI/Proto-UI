import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Page } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { hasCommittedHeaderPreferencesDock, revealHeaderPreferences } from './site-header-browser';
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function fixture({ marker = true, visible = false, expanded = false } = {}) {
  const preferences = {
    count: vi.fn(async () => (marker ? 1 : 0)),
    isVisible: vi.fn(async () => visible),
    waitFor: vi.fn(async () => {}),
  };
  const menu = { getAttribute: vi.fn(async () => String(expanded)), click: vi.fn(async () => {}) };
  const page = {
    waitForFunction: vi.fn(async () => {}),
    locator: vi.fn((selector: string) =>
      selector === '[data-site-header] [data-site-header-preferences]' ? preferences : menu
    ),
  };
  return { page: page as unknown as Page, preferences, menu };
}

describe('native compact Header browser entry', () => {
  it('opens hidden preferences through the actual menu and waits for visibility', async () => {
    const f = fixture();
    expect(await revealHeaderPreferences(f.page)).toBe(true);
    expect(f.menu.click).toHaveBeenCalledWith();
    expect(f.preferences.waitFor).toHaveBeenCalledWith({ state: 'visible' });
    expect(f.page.waitForFunction).toHaveBeenCalledWith(hasCommittedHeaderPreferencesDock);
  });
  it('never toggles an already-open menu closed or changes visible desktop controls', async () => {
    const open = fixture({ expanded: true });
    await revealHeaderPreferences(open.page);
    expect(open.menu.click).not.toHaveBeenCalled();
    expect(open.preferences.waitFor).toHaveBeenCalledWith({ state: 'visible' });
    const desktop = fixture({ visible: true });
    expect(await revealHeaderPreferences(desktop.page)).toBe(false);
    expect(desktop.menu.click).not.toHaveBeenCalled();
  });
  it('preserves the immutable baseline without inventing a compact control path', async () => {
    const baseline = fixture({ marker: false });
    expect(await revealHeaderPreferences(baseline.page)).toBe(false);
    expect(baseline.menu.click).not.toHaveBeenCalled();
    expect(baseline.page.waitForFunction).not.toHaveBeenCalled();
  });
  it('rejects old visible ownership on both sides of a pending viewport move', () => {
    const media = { matches: true } as MediaQueryList;
    vi.spyOn(window, 'matchMedia').mockReturnValue(media);
    document.body.innerHTML =
      '<header data-site-header data-site-menu-ready><div data-site-header-context><div data-site-header-preferences>Original owner</div></div><div data-site-header-compact-context></div></header>';
    const preferences = document.querySelector('[data-site-header-preferences]')!;
    expect(hasCommittedHeaderPreferencesDock()).toBe(false);
    document.querySelector('[data-site-header-compact-context]')!.append(preferences);
    expect(hasCommittedHeaderPreferencesDock()).toBe(true);
    Object.defineProperty(media, 'matches', { value: false });
    expect(hasCommittedHeaderPreferencesDock()).toBe(false);
    document.querySelector('[data-site-header-context]')!.append(preferences);
    expect(hasCommittedHeaderPreferencesDock()).toBe(true);
    document.querySelector('header')!.removeAttribute('data-site-menu-ready');
    expect(hasCommittedHeaderPreferencesDock()).toBe(false);
  });
});

// setViewportSize can settle before the application's matchMedia callback moves
// the existing owner. A visible old dock is not readiness for the new layout.
describe('Header owner docking before visibility sampling', () => {
  it('does not return from the visible desktop owner before compact docking', async () => {
    let docked = false;
    const f = fixture({ visible: true });
    f.preferences.isVisible.mockImplementation(async () => !docked);
    const waitForFunction = vi.fn(async (predicate: () => boolean) => {
      expect(predicate()).toBe(false);
      docked = true;
      expect(predicate()).toBe(true);
    });
    Object.assign(f.page, { waitForFunction });
    const media = { matches: true } as MediaQueryList;
    vi.spyOn(window, 'matchMedia').mockReturnValue(media);
    document.body.innerHTML =
      '<header data-site-header data-site-menu-ready><div data-site-header-context></div><div data-site-header-compact-context></div></header>';
    const owner = document.createElement('div');
    owner.dataset.siteHeaderPreferences = '';
    document.querySelector('[data-site-header-context]')!.append(owner);
    waitForFunction.mockImplementation(async (predicate: () => boolean) => {
      expect(predicate()).toBe(false);
      document.querySelector('[data-site-header-compact-context]')!.append(owner);
      docked = true;
      expect(predicate()).toBe(true);
    });

    expect(await revealHeaderPreferences(f.page)).toBe(true);
    expect(waitForFunction).toHaveBeenCalledOnce();
    expect(f.menu.click).toHaveBeenCalledOnce();
    expect(f.preferences.waitFor).toHaveBeenCalledWith({ state: 'visible' });
  });

  it('does not open the menu while compact controls are moving back to desktop', async () => {
    let docked = false;
    const f = fixture();
    f.preferences.isVisible.mockImplementation(async () => docked);
    const waitForFunction = vi.fn(async (predicate: () => boolean) => {
      expect(predicate()).toBe(false);
      docked = true;
      expect(predicate()).toBe(true);
    });
    Object.assign(f.page, { waitForFunction });
    const media = { matches: false } as MediaQueryList;
    vi.spyOn(window, 'matchMedia').mockReturnValue(media);
    document.body.innerHTML =
      '<header data-site-header data-site-menu-ready><div data-site-header-context></div><div data-site-header-compact-context></div></header>';
    const owner = document.createElement('div');
    owner.dataset.siteHeaderPreferences = '';
    document.querySelector('[data-site-header-compact-context]')!.append(owner);
    waitForFunction.mockImplementation(async (predicate: () => boolean) => {
      expect(predicate()).toBe(false);
      document.querySelector('[data-site-header-context]')!.append(owner);
      docked = true;
      expect(predicate()).toBe(true);
    });

    expect(await revealHeaderPreferences(f.page)).toBe(false);
    expect(waitForFunction).toHaveBeenCalledOnce();
    expect(f.menu.click).not.toHaveBeenCalled();
  });
});

it('preserves a failed owner-docking wait without clicking or bypassing it', async () => {
  const f = fixture();
  const failure = new Error('owner docking did not complete');
  Object.assign(f.page, {
    waitForFunction: vi.fn(async () => {
      throw failure;
    }),
  });
  await expect(revealHeaderPreferences(f.page)).rejects.toBe(failure);
  expect(f.preferences.isVisible).not.toHaveBeenCalled();
  expect(f.menu.click).not.toHaveBeenCalled();
});

it('aligns child diagnostic capture with its unchanged 36px/44px geometry assertion', () => {
  const source = readFileSync(
    'apps/www/src/content/docs/zh-cn/home-demo-runtime.browser.test.ts',
    'utf8'
  );
  expect(source).toContain('expect(geometry.triggerHeight).toBeCloseTo(width >= 768 ? 36 : 44, 0)');
  const match = source.match(/const expectedTriggerHeight = ([^;]+);\s*if \(([\s\S]*?)\) \{/);
  expect(match).not.toBeNull();
  const captureRequired = new Function(
    'width',
    'geometry',
    `const expectedTriggerHeight = ${match![1]}; return (${match![2]});`
  ) as (width: number, geometry: { triggerHeight: number }) => boolean;
  for (const [width, height, expected] of [
    [1440, 36, false],
    [1440, 44, true],
    [390, 44, false],
    [390, 36, true],
    [1440, 36.49, false],
    [1440, 36.5, true],
    [390, Number.NaN, true],
  ] as const)
    expect(captureRequired(width, { triggerHeight: height })).toBe(expected);
});
