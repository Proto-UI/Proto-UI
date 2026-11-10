import type { Page } from 'playwright-core';

/** Exact website owner/generation, including physical portals outside site-search. */
export async function searchPart(page: Page, ref: string) {
  // The Dialog is its own lazy projection scope, so its generation is never
  // the opener's command generation.  Resolve the Dialog's own active
  // owner/generation and wait for that public host within the locator budget,
  // so a call made after the open intent never binds a stale generation
  // literal that could wait forever.
  const handle = await page.waitForFunction((ref) => {
    const search = document.querySelector<HTMLElement>('site-search');
    const mount = search?.querySelector<HTMLElement>('[data-search-dialog-mount]');
    const owner = mount?.dataset.projectionOwner;
    const activeHost = [
      ...(mount?.querySelectorAll<HTMLElement>('[data-projection-generation-host]') ?? []),
    ].find((host) => host.dataset.projectionGenerationState === 'active');
    const generation = activeHost?.dataset.projectionGenerationHost;
    if (!owner || !generation) return null;
    return `[data-projection-owner="${CSS.escape(owner)}"][data-projection-generation="${CSS.escape(generation)}"][data-demo-ref="${CSS.escape(ref)}"]`;
  }, ref);
  try {
    const selector = (await handle.jsonValue()) as string;
    return page.locator(selector);
  } finally {
    await handle.dispose();
  }
}

/** Serialized directly into the browser. No private instance/runtime access. */
export function readSearchPublicState() {
  const search = document.querySelector<HTMLElement>('site-search');
  const mount = search?.querySelector<HTMLElement>('[data-search-dialog-mount]');
  const owner = mount?.dataset.projectionOwner;
  // The dialog lives in its own lazy scope; resolve its active generation
  // from the dialog mount's hosts, not the opener's data-search-generation.
  const activeHost = [
    ...(mount?.querySelectorAll<HTMLElement>('[data-projection-generation-host]') ?? []),
  ].find((host) => host.dataset.projectionGenerationState === 'active');
  // Pure observation: a Dialog that has not materialized has no generation.
  // The opener's command generation is never a substitute here.
  const generation = activeHost?.dataset.projectionGenerationHost ?? null;
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
