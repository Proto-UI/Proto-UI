import type { Page } from 'playwright-core';

/** Follow the real compact Header journey. This helper neither changes app
 * preferences nor forces interaction with hidden controls. Old baseline pages
 * without the docking marker retain their existing visible selector path. */
export async function revealHeaderPreferences(page: Page): Promise<boolean> {
  const preferences = page.locator('[data-site-header] [data-site-header-preferences]');
  if (!(await preferences.count()) || (await preferences.isVisible())) return false;
  const menu = page.locator(
    '[data-site-header] .site-header-menu [data-projection-generation-state="active"] [data-demo-ref="home-menu"], [data-docs-site-header] [data-site-menu-button]'
  );
  if ((await menu.getAttribute('aria-expanded')) !== 'true') await menu.click();
  await preferences.waitFor({ state: 'visible' });
  return true;
}
