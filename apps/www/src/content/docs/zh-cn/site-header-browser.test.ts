import { describe, expect, it, vi } from 'vitest';
import type { Page } from 'playwright-core';
import { revealHeaderPreferences } from './site-header-browser';

function fixture({ marker = true, visible = false, expanded = false } = {}) {
  const preferences = {
    count: vi.fn(async () => (marker ? 1 : 0)),
    isVisible: vi.fn(async () => visible),
    waitFor: vi.fn(async () => {}),
  };
  const menu = { getAttribute: vi.fn(async () => String(expanded)), click: vi.fn(async () => {}) };
  const page = {
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
  });
});
