import type { Page } from 'playwright-core';

/** Native viewport resize can precede the application matchMedia callback.
 * Sample the committed owner location, not transient visibility in the old row. */
export function hasCommittedHeaderPreferencesDock(): boolean {
  const preferences = document.querySelector<HTMLElement>(
    '[data-site-header] [data-site-header-preferences]'
  );
  const root = preferences?.closest('[data-site-header]');
  if (!root?.hasAttribute('data-site-menu-ready')) return false;
  return window.matchMedia('(max-width: 47.999rem)').matches
    ? !!preferences?.closest('[data-site-header-compact-context]')
    : !!preferences?.parentElement?.matches('[data-site-header-context]');
}

/** Follow the real compact Header journey. This helper neither changes app
 * preferences nor forces interaction with hidden controls. Old baseline pages
 * without the docking marker retain their existing visible selector path. */
export async function revealHeaderPreferences(page: Page): Promise<boolean> {
  const preferences = page.locator('[data-site-header] [data-site-header-preferences]');
  if (!(await preferences.count())) return false;
  await page.waitForFunction(hasCommittedHeaderPreferencesDock);
  if (await preferences.isVisible()) return false;
  const menu = page.locator(
    '[data-site-header] .site-header-menu [data-projection-generation-state="active"] [data-demo-ref="home-menu"], [data-docs-site-header] [data-site-menu-button]'
  );
  if ((await menu.getAttribute('aria-expanded')) !== 'true') await menu.click();
  await preferences.waitFor({ state: 'visible' });
  return true;
}
