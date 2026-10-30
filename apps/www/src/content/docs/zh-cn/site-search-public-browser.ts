import type { Page } from 'playwright-core';

/** Exact website owner/generation, including physical portals outside site-search. */
export async function searchPart(page: Page, ref: string) {
  const selector = await page.evaluate((ref) => {
    const search = document.querySelector<HTMLElement>('site-search');
    const mount = search?.querySelector<HTMLElement>('[data-search-dialog-mount]');
    const owner = mount?.dataset.projectionOwner;
    const generation = search?.dataset.searchGeneration;
    if (!owner || !generation) throw new Error('Search owner/generation is not committed');
    return `[data-projection-owner="${CSS.escape(owner)}"][data-projection-generation="${CSS.escape(generation)}"][data-demo-ref="${CSS.escape(ref)}"]`;
  }, ref);
  return page.locator(selector);
}

/** Serialized directly into the browser. No private instance/runtime access. */
export function readSearchPublicState() {
  const search = document.querySelector<HTMLElement>('site-search');
  const mount = search?.querySelector<HTMLElement>('[data-search-dialog-mount]');
  const owner = mount?.dataset.projectionOwner;
  const generation = search?.dataset.searchGeneration;
  const part = (ref: string) =>
    owner && generation
      ? document.querySelector<HTMLElement>(
          `[data-projection-owner="${CSS.escape(owner)}"][data-projection-generation="${CSS.escape(generation)}"][data-demo-ref="${CSS.escape(ref)}"]`
        )
      : null;
  const panel = part('panel');
  const control = part('query');
  const input = control?.matches('input')
    ? (control as HTMLInputElement)
    : control?.querySelector<HTMLInputElement>('input');
  const box = panel?.getBoundingClientRect();
  const visible =
    !!panel &&
    panel.isConnected &&
    !panel.closest('[inert]') &&
    !!box?.width &&
    !!box?.height &&
    getComputedStyle(panel).display !== 'none' &&
    getComputedStyle(panel).visibility !== 'hidden';
  return {
    owner,
    generation,
    open: visible,
    panelBox: box?.toJSON(),
    query: input?.value,
    inputConnected: input?.isConnected,
    inputFocused: input === document.activeElement,
    openCount: (window as any).__puiSearchOpenCount ?? 0,
  };
}

export async function searchInput(page: Page) {
  const part = await searchPart(page, 'query');
  return (await part.evaluate((node) => node.matches('input'))) ? part : part.locator('input');
}
