import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { retainHappyDomMutationCallbacks } from '../../../../scripts/test/happy-dom-mutation-keepalive.mjs';
import { PREFERRED_ADAPTER_EVENT } from './adapter-preference';
import { initDocumentationTypography } from './site-typography-client';

// The participant, WC renderer and MutationObserver are real. Theme values are
// supplied explicitly because these tests concern discovery ownership, not CSS
// token resolution or browser layout costs.
vi.mock('./PrototypePreviewer/projection-theme', async (original) => {
  const actual = await original<typeof import('./PrototypePreviewer/projection-theme')>();
  const theme = { '--pui-background': '#fff', '--pui-foreground': '#111' };
  return {
    resolveProjectionThemeSurfaceStyle: () => theme,
    applyProjectionThemeSurfaceStyle: actual.applyProjectionThemeSurfaceStyle,
    watchProjectionThemeSurfaceStyle: (
      _family: unknown,
      _root: unknown,
      callback: (value: Record<string, string>) => void
    ) => {
      callback(theme);
      return () => {};
    },
  };
});
vi.mock('./PrototypePreviewer/runtimes/vue-runtime', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/apps/www/package.json');
  return { loadVue: async () => require('vue') };
});

let observerKeeper: ReturnType<typeof retainHappyDomMutationCallbacks>;
beforeAll(() => {
  observerKeeper = retainHappyDomMutationCallbacks(window);
});
afterAll(() => observerKeeper.restore());
const handles: Array<{ destroy(): Promise<void> }> = [];
afterEach(async () => {
  for (const handle of handles.splice(0)) await handle.destroy();
  document.body.replaceChildren();
  localStorage.clear();
  vi.restoreAllMocks();
});
const settle = async () => {
  for (let index = 0; index < 12; index++) await new Promise((resolve) => setTimeout(resolve, 5));
};

function fixture() {
  document.body.innerHTML =
    '<main data-site-family-scope><div data-doc-flow><p id="article">Native article <em>source</em></p><section id="island" data-pui-root><div id="results"></div><div id="actions"></div></section></div></main>';
  return {
    root: document.querySelector<HTMLElement>('main')!,
    flow: document.querySelector<HTMLElement>('[data-doc-flow]')!,
    article: document.querySelector<HTMLElement>('#article')!,
    island: document.querySelector<HTMLElement>('#island')!,
    results: document.querySelector<HTMLElement>('#results')!,
    actions: document.querySelector<HTMLElement>('#actions')!,
  };
}

async function start() {
  const handle = initDocumentationTypography(document)!;
  handles.push(handle);
  await handle.ready;
  await settle();
  return handle;
}

function observeInventory(root: HTMLElement) {
  const queries = vi.spyOn(root, 'querySelectorAll');
  return () =>
    queries.mock.calls.filter(([selector]) => selector.includes('[data-site-typography]')).length;
}

describe('documentation typography discovery ownership', () => {
  it('inventories initial native source without borrowing a component island', async () => {
    const { article, results } = fixture();
    const source = article.firstChild;
    const label = document.createElement('p');
    label.textContent = 'Private result label';
    results.append(label);
    await start();
    expect(article.dataset.typographyRuntime).toBe('wc');
    expect(article.querySelector('[data-site-typography-slot]')?.firstChild).toBe(source);
    expect(label.hasAttribute('data-typography-owner')).toBe(false);
    expect(label.parentElement).toBe(results);
  });

  it.each(['data-pui-root', 'data-previewer-id'])(
    'does not inventory results and actions committed inside %s',
    async (boundary) => {
      const { root, article, island, results, actions } = fixture();
      island.removeAttribute('data-pui-root');
      island.setAttribute(boundary, '');
      await start();
      const generation = article.dataset.typographyGeneration;
      const inventoryReads = observeInventory(root);
      const result = document.createElement('p');
      result.textContent = 'A private result';
      const action = document.createElement('button');
      action.textContent = 'Load more';
      results.append(result);
      actions.append(action);
      await settle();
      expect(inventoryReads()).toBe(0);
      expect(article.dataset.typographyGeneration).toBe(generation);
      expect(result.parentElement).toBe(results);
      expect(result.hasAttribute('data-typography-owner')).toBe(false);
    }
  );

  it('does not rescan for an explicit typography marker that remains inside a private component', async () => {
    const { root, article, results } = fixture();
    const label = document.createElement('p');
    label.textContent = 'Private label';
    results.append(label);
    await start();
    const generation = article.dataset.typographyGeneration;
    const inventoryReads = observeInventory(root);
    label.dataset.siteTypography = 'body';
    await settle();
    expect(inventoryReads()).toBe(0);
    expect(article.dataset.typographyGeneration).toBe(generation);
    expect(label.hasAttribute('data-typography-owner')).toBe(false);
  });

  it('still refreshes explicit runtime and family selections after private mutations', async () => {
    const { root, article, results } = fixture();
    await start();
    results.append(document.createTextNode('Private update'));
    await settle();
    const inventoryReads = observeInventory(root);
    document.dispatchEvent(
      new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: 'vue' } })
    );
    await vi.waitFor(() => expect(article.dataset.typographyRuntime).toBe('vue'));
    root.dataset.siteLibraryFamily = 'brutalist';
    await vi.waitFor(() => expect(article.dataset.typographyFamily).toBe('brutalist'));
    expect(inventoryReads()).toBeGreaterThan(0);
    expect(article.textContent).toBe('Native article source');
  });

  it('reconciles real article source appended outside its borrowed carrier', async () => {
    const { root, article } = fixture();
    await start();
    const inventoryReads = observeInventory(root);
    const added = document.createTextNode(' Added native copy');
    article.append(added);
    await vi.waitFor(() =>
      expect(added.parentElement?.closest('[data-site-typography-slot]')).not.toBeNull()
    );
    expect(inventoryReads()).toBeGreaterThan(0);
    expect(article.textContent).toBe('Native article source Added native copy');
  });

  it('discovers new Markdown and a native paragraph moved out of a component boundary', async () => {
    const { root, flow, results } = fixture();
    const moved = document.createElement('p');
    moved.textContent = 'Moved native copy';
    results.append(moved);
    await start();
    const inventoryReads = observeInventory(root);
    const added = document.createElement('p');
    const source = document.createTextNode('New Markdown');
    added.append(source);
    flow.append(added, moved);
    await vi.waitFor(() => expect(added.dataset.typographyRuntime).toBe('wc'));
    await vi.waitFor(() => expect(moved.dataset.typographyRuntime).toBe('wc'));
    expect(added.querySelector('[data-site-typography-slot]')?.firstChild).toBe(source);
    expect(inventoryReads()).toBeGreaterThan(0);
    results.append(moved);
    await vi.waitFor(() => expect(moved.hasAttribute('data-typography-owner')).toBe(false));
    expect(moved.textContent).toBe('Moved native copy');
    expect(moved.parentElement).toBe(results);
  });

  it('keeps explicit native labels in an allowed passive Header frame discoverable', async () => {
    const { root, flow } = fixture();
    const frame = document.createElement('div');
    frame.className = 'site-header-popup-surface';
    frame.dataset.puiRoot = '';
    frame.dataset.projectionPrototype = 'shadcn-surface-root';
    const content = document.createElement('div');
    content.dataset.siteHeaderPanelContent = '';
    frame.append(content);
    flow.append(frame);
    await start();
    const inventoryReads = observeInventory(root);
    const label = document.createElement('label');
    label.dataset.siteTypography = 'label';
    label.textContent = 'Native Header label';
    content.append(label);
    await vi.waitFor(() => expect(label.dataset.typographyRuntime).toBe('wc'));
    expect(inventoryReads()).toBeGreaterThan(0);
  });

  it('discovers and retires an allowed Header frame inserted inside a private parent', async () => {
    const { root, island } = fixture();
    await start();
    const inventoryReads = observeInventory(root);
    const frame = document.createElement('div');
    frame.className = 'site-header-popup-surface';
    frame.dataset.puiRoot = '';
    frame.dataset.projectionPrototype = 'shadcn-surface-root';
    const content = document.createElement('div');
    content.dataset.siteHeaderPanelContent = '';
    const label = document.createElement('label');
    label.dataset.siteTypography = 'label';
    const source = document.createTextNode('Nested native Header label');
    label.append(source);
    content.append(label);
    frame.append(content);
    island.append(frame);
    await vi.waitFor(() => expect(label.dataset.typographyRuntime).toBe('wc'));
    expect(label.querySelector('[data-site-typography-slot]')?.firstChild).toBe(source);
    frame.remove();
    await vi.waitFor(() => expect(label.hasAttribute('data-typography-owner')).toBe(false));
    expect(label.firstChild).toBe(source);
    expect(inventoryReads()).toBeGreaterThan(0);
  });

  it('reconciles explicit labels moved into Header content and marker withdrawal there', async () => {
    const { root, flow, results } = fixture();
    const frame = document.createElement('div');
    frame.className = 'site-header-popup-surface';
    frame.dataset.puiRoot = '';
    frame.dataset.projectionPrototype = 'shadcn-surface-root';
    const content = document.createElement('div');
    content.dataset.siteHeaderPanelContent = '';
    frame.append(content);
    flow.append(frame);
    const label = document.createElement('label');
    label.dataset.siteTypography = 'label';
    const source = document.createTextNode('Transferred native Header label');
    label.append(source);
    results.append(label);
    await start();
    expect(label.hasAttribute('data-typography-owner')).toBe(false);
    const inventoryReads = observeInventory(root);
    content.append(label);
    await vi.waitFor(() => expect(label.dataset.typographyRuntime).toBe('wc'));
    label.removeAttribute('data-site-typography');
    await vi.waitFor(() => expect(label.hasAttribute('data-typography-owner')).toBe(false));
    expect(label.firstChild).toBe(source);
    label.dataset.siteTypography = 'label';
    await vi.waitFor(() => expect(label.dataset.typographyRuntime).toBe('wc'));
    label.dataset.siteTypography = 'not-a-typography-role';
    await vi.waitFor(() => expect(label.hasAttribute('data-typography-owner')).toBe(false));
    expect(label.firstChild).toBe(source);
    expect(inventoryReads()).toBeGreaterThan(0);
  });

  it('retires existing native labels when a private owner mutation follows lost Header eligibility', async () => {
    const { root, flow } = fixture();
    const frame = document.createElement('div');
    frame.className = 'site-header-popup-surface';
    frame.dataset.puiRoot = '';
    frame.dataset.projectionPrototype = 'shadcn-surface-root';
    const content = document.createElement('div');
    content.dataset.siteHeaderPanelContent = '';
    const label = document.createElement('label');
    label.dataset.siteTypography = 'label';
    const source = document.createTextNode('Previously admitted native label');
    label.append(source);
    content.append(label);
    frame.append(content);
    flow.append(frame);
    await start();
    expect(label.dataset.typographyRuntime).toBe('wc');
    const inventoryReads = observeInventory(root);
    // Class changes are outside the observer's existing attribute filter. Its
    // next childList notification must still reconcile already borrowed source,
    // even when neither the target nor the added node is that source itself.
    frame.classList.remove('site-header-popup-surface');
    frame.append(document.createElement('span'));
    await vi.waitFor(() => expect(label.hasAttribute('data-typography-owner')).toBe(false));
    expect(label.firstChild).toBe(source);
    expect(inventoryReads()).toBeGreaterThan(0);
  });

  it('keeps the explicit status exception inside a passive Header below another component owner', async () => {
    const { root, flow } = fixture();
    const showcase = document.createElement('div');
    showcase.dataset.homeShowcase = '';
    showcase.dataset.puiRoot = '';
    const frame = document.createElement('div');
    frame.className = 'site-header-popup-surface';
    frame.dataset.puiRoot = '';
    frame.dataset.projectionPrototype = 'shadcn-surface-root';
    const content = document.createElement('div');
    content.dataset.siteHeaderPanelContent = '';
    frame.append(content);
    showcase.append(frame);
    flow.append(showcase);
    await start();
    const inventoryReads = observeInventory(root);
    const status = document.createElement('output');
    status.dataset.homeDemoStatus = '';
    status.dataset.siteTypography = 'label';
    const source = document.createTextNode('Explicit authored status');
    status.append(source);
    content.append(status);
    await vi.waitFor(() => expect(status.dataset.typographyRuntime).toBe('wc'));
    expect(status.querySelector('[data-site-typography-slot]')?.firstChild).toBe(source);
    expect(inventoryReads()).toBeGreaterThan(0);
  });

  it('still discovers and releases an explicit native status inside a Previewer', async () => {
    const { root, island } = fixture();
    island.removeAttribute('data-pui-root');
    island.dataset.previewerId = 'preview';
    await start();
    const inventoryReads = observeInventory(root);
    const status = document.createElement('output');
    status.dataset.homeDemoStatus = '';
    status.dataset.siteTypography = 'label';
    const source = document.createTextNode('Native status');
    status.append(source);
    island.append(status);
    await vi.waitFor(() => expect(status.dataset.typographyRuntime).toBe('wc'));
    expect(status.querySelector('[data-site-typography-slot]')?.firstChild).toBe(source);
    status.removeAttribute('data-site-typography');
    await vi.waitFor(() => expect(status.hasAttribute('data-typography-owner')).toBe(false));
    expect(status.firstChild).toBe(source);
    expect(inventoryReads()).toBeGreaterThan(0);
  });

  it.each(['data-pui-root', 'data-previewer-id'])(
    'rechecks an outer paragraph when inline %s changes block eligibility',
    async (boundary) => {
      const { root, flow } = fixture();
      const paragraph = document.createElement('p');
      const privateInline = document.createElement('span');
      privateInline.setAttribute(boundary, '');
      privateInline.append(document.createElement('div'));
      paragraph.append(document.createTextNode('Native prefix '), privateInline);
      flow.append(paragraph);
      await start();
      expect(paragraph.hasAttribute('data-typography-owner')).toBe(false);
      const inventoryReads = observeInventory(root);
      privateInline.replaceChildren(document.createTextNode('Inline private value'));
      await vi.waitFor(() => expect(paragraph.dataset.typographyRuntime).toBe('wc'));
      expect(inventoryReads()).toBeGreaterThan(0);
      expect(paragraph.textContent).toBe('Native prefix Inline private value');
    }
  );

  it('does not hide source mutations inside Typography own projected slot', async () => {
    const { root, article } = fixture();
    await start();
    const inventoryReads = observeInventory(root);
    const slot = article.querySelector<HTMLElement>('[data-site-typography-slot]')!;
    const block = document.createElement('div');
    block.textContent = 'New authored block';
    slot.append(block);
    await vi.waitFor(() => expect(article.hasAttribute('data-typography-owner')).toBe(false));
    expect(inventoryReads()).toBeGreaterThan(0);
    expect(article.contains(block)).toBe(true);
    expect(block.isConnected).toBe(true);
  });
});
