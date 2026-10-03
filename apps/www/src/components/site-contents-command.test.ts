import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { contentsCommandParticipant } from './site-contents-command';
import { initDocumentationHeaderSurface } from './site-header-surface';
import {
  initSiteContentsNavigation,
  initSiteHeaderDisclosure,
  siteContentsNavigation,
} from './site-header-disclosure';
import { PREFERRED_ADAPTER_EVENT, PREFERRED_ADAPTER_KEY } from './adapter-preference';
import type { MaterializedProjectionCandidate } from './PrototypePreviewer/projection-materializer';
vi.mock('./PrototypePreviewer/runtimes/react-runtime', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/packages/adapters/react/package.json');
  return {
    loadReact: async () => ({
      React: require('react'),
      ReactDOM: { ...require('react-dom'), ...require('react-dom/client') },
    }),
  };
});
vi.mock('./PrototypePreviewer/runtimes/vue-runtime', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/apps/www/package.json');
  return { loadVue: async () => require('vue') };
});
vi.mock('./PrototypePreviewer/runtimes/vue2-runtime', async (original) => {
  const actual = await original<typeof import('./PrototypePreviewer/runtimes/vue2-runtime')>();
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/packages/adapters/vue2/package.json');
  return { ...actual, loadVue2: async () => require('vue') };
});
vi.mock('./PrototypePreviewer/projection-theme', () => ({
  resolveProjectionThemeSurfaceStyle: () => ({
    '--pui-background': '#fff',
    '--pui-foreground': '#111',
  }),
  applyProjectionThemeSurfaceStyle: () => {},
  watchProjectionThemeSurfaceStyle: (
    _family: unknown,
    _root: unknown,
    callback: (value: Record<string, string>) => void
  ) => {
    callback({ '--pui-background': '#fff', '--pui-foreground': '#111' });
    return () => {};
  },
}));
const faults = vi.hoisted(() => ({ failReact: false, calls: [] as string[] }));
vi.mock('./PrototypePreviewer/projection-materializer', async (original) => {
  const actual = await original<typeof import('./PrototypePreviewer/projection-materializer')>();
  return {
    ...actual,
    materializeProjectionCandidate: async (
      ...args: Parameters<typeof actual.materializeProjectionCandidate>
    ) => {
      faults.calls.push(args[0].selection.runtimeId);
      if (
        faults.failReact &&
        args[0].selection.runtimeId === 'react' &&
        args[1].ownerId.startsWith('site-contents-')
      )
        throw new Error('renderer unavailable');
      return actual.materializeProjectionCandidate(...args);
    },
  };
});

const candidates: MaterializedProjectionCandidate[] = [];
const handles: Array<{ destroy(): void | Promise<void> }> = [];
const participants: Array<NonNullable<ReturnType<typeof contentsCommandParticipant>>> = [];
afterEach(async () => {
  for (const handle of handles.splice(0)) await handle.destroy();
  for (const candidate of candidates.splice(0)) await candidate.dispose();
  for (const participant of participants.splice(0)) participant.dispose();
  initSiteContentsNavigation(document)?.();
  document.body.replaceChildren();
  document.body.removeAttribute('data-mobile-menu-expanded');
  localStorage.clear();
  faults.failReact = false;
  faults.calls.length = 0;
  vi.restoreAllMocks();
});
function fixture() {
  // Read production SSR markup; replace only Astro's localized label input.
  const command = readFileSync('apps/www/src/components/SiteContentsCommand.astro', 'utf8')
    .replace(/^---[\s\S]*?---\s*/, '')
    .replace(/=\{label\}/g, '="Page contents"');
  document.body.innerHTML = `<header data-site-header><div data-site-header-panel id="panel"><div data-site-header-surface-mount></div><div data-site-header-panel-content><nav data-site-header-navigation><a href="/docs/">Docs</a></nav><input aria-label="setting" /></div></div>${command}<button data-menu>Navigation</button></header><div id="starlight__sidebar"><a href="/article/">Article</a></div><button data-outside>Outside</button>`;
  const header = document.querySelector<HTMLElement>('header')!;
  const root = header.querySelector<HTMLElement>('[data-site-contents-command]')!;
  return {
    header,
    root,
    fallback: root.querySelector<HTMLButtonElement>('button')!,
    panel: header.querySelector<HTMLElement>('[data-site-header-panel]')!,
    article: document.querySelector<HTMLAnchorElement>('#starlight__sidebar a')!,
  };
}
const activeButton = (root: HTMLElement) =>
  root.querySelector<HTMLElement>(
    '[data-projection-generation-state="active"] [data-site-contents-button]'
  )!;
const click = (button: HTMLElement) =>
  button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
const request = (runtime: string, family = 'shadcn', generation = 1) => ({
  generation,
  selection: { runtimeId: runtime, projectionFamilyId: family },
});

describe('Docs Contents actual family Button command', () => {
  it('uses an app-owned fallback and actual composition, never an upstream or nested Button listener', () => {
    const { header, root, fallback } = fixture();
    expect(header.querySelector('starlight-menu-button')).toBeNull();
    expect(root.querySelectorAll('button')).toHaveLength(1);
    const source = readFileSync('apps/www/src/components/override/Header.astro', 'utf8');
    expect(source).not.toContain('MobileMenuToggle');
    expect(source).toContain('<SiteContentsCommand');
    const frame = readFileSync('apps/www/src/components/override/PageFrame.astro', 'utf8');
    expect(frame).toMatch(/<noscript>[\s\S]*?\[data-site-contents-command\][\s\S]*?display: none/);
    expect(fallback.getAttribute('aria-label')).toBe('Page contents');
    expect(fallback.getAttribute('aria-controls')).toBe('starlight__sidebar');
    const owner = siteContentsNavigation(document)!;
    expect(siteContentsNavigation(document)).toBe(owner);
    expect(initSiteContentsNavigation(document)).toBe(owner.destroy);
    const opened = vi.fn();
    document.addEventListener('site-contents:open', opened, { once: true });
    fallback.click();
    expect(root.getAttribute('aria-expanded')).toBe('true');
    expect(opened).toHaveBeenCalledOnce();
    fallback.click();
    expect(root.getAttribute('aria-expanded')).toBe('false');
    fallback.disabled = true;
    click(fallback);
    expect(root.getAttribute('aria-expanded')).toBe('false');
  });
  for (const family of ['shadcn', 'brutalist'])
    for (const runtime of ['wc', 'react', 'vue', 'vue2']) {
      it(`${family}/${runtime}: public click, Enter and Space each toggle once; real disabled and family paint remain owned`, async () => {
        const { header, root, fallback } = fixture();
        const participant = contentsCommandParticipant(header)!;
        participants.push(participant);
        fallback.focus();
        const commit = request(runtime, family);
        const candidate = await participant.materialize(commit);
        candidates.push(candidate);
        const staging = candidate.host.querySelector<HTMLElement>('[data-site-contents-button]')!;
        click(staging);
        await settle();
        expect(root.getAttribute('aria-expanded')).toBe('false');
        expect(fallback.hidden).toBe(false);
        candidate.activate();
        participant.prepareCommit(commit).publish();
        await settle();
        const button = activeButton(root);
        expect(fallback.hidden).toBe(true);
        expect(fallback.inert).toBe(true);
        expect(document.activeElement).toBe(button);
        expect(button.getAttribute('role')).toBe('button');
        expect(button.textContent).toContain('Page contents');
        expect(button.getAttribute('aria-controls')).toBe('starlight__sidebar');
        expect(button.getAttribute('aria-expanded')).toBe('false');
        expect(button.querySelector('button, [role="button"]')).toBeNull();
        const tokens = button.getAttribute('data-pui-style')!;
        expect(tokens).toContain(family === 'shadcn' ? 'border-transparent' : 'rounded-base');
        expect(tokens).toContain(family === 'shadcn' ? 'bg-transparent' : 'border-2');
        if (family === 'brutalist') expect(tokens).toContain('shadow-[4px_4px_0_0_#000]');
        click(button);
        await settle();
        expect(button.getAttribute('aria-expanded')).toBe('true');
        expect(document.body.hasAttribute('data-mobile-menu-expanded')).toBe(true);
        click(fallback);
        await settle();
        expect(button.getAttribute('aria-expanded')).toBe('true');
        for (const key of ['Enter', ' ']) {
          const before = button.getAttribute('aria-expanded');
          button.focus();
          button.dispatchEvent(
            new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
          );
          button.dispatchEvent(
            new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true })
          );
          await settle();
          expect(button.getAttribute('aria-expanded')).toBe(before === 'true' ? 'false' : 'true');
        }
        participant.setDisabled(true);
        await settle();
        expect(button.getAttribute('aria-disabled')).toBe('true');
        const expanded = button.getAttribute('aria-expanded');
        click(button);
        await settle();
        expect(button.getAttribute('aria-expanded')).toBe(expanded);
        participant.setDisabled(false);
        await settle();
        click(button);
        candidate.setLocked?.(true);
        click(button);
        await settle();
        expect(button.getAttribute('aria-expanded')).toBe(expanded);
        candidate.setLocked?.(false);
        click(button);
        await settle();
        expect(button.getAttribute('aria-expanded')).not.toBe(expanded);
      }, 20000);
    }
  it('defers Escape return focus while locked and revokes it after a newer focus, disposal or partial-publication rollback', async () => {
    const { header, root, fallback, article } = fixture();
    const participant = contentsCommandParticipant(header)!;
    participants.push(participant);
    const commit = request('wc');
    const candidate = await participant.materialize(commit);
    candidates.push(candidate);
    candidate.activate();
    const publication = participant.prepareCommit(commit);
    publication.publish();
    await settle();
    const button = activeButton(root);
    click(button);
    await settle();
    article.focus();
    candidate.setLocked?.(true);
    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', cancelable: true }));
    expect(root.getAttribute('aria-expanded')).toBe('false');
    candidate.setLocked?.(false);
    expect(document.activeElement).toBe(button);
    click(button);
    await settle();
    article.focus();
    candidate.setLocked?.(true);
    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', cancelable: true }));
    const outside = document.querySelector<HTMLElement>('[data-outside]')!;
    outside.focus();
    candidate.setLocked?.(false);
    expect(document.activeElement).toBe(outside);
    publication.rollback();
    await candidate.dispose();
    candidates.splice(candidates.indexOf(candidate), 1);
    expect(fallback.hidden).toBe(false);
    expect(fallback.inert).toBe(false);
    expect(root.dataset.contentsRuntime).toBeUndefined();
    fallback.click();
    expect(root.getAttribute('aria-expanded')).toBe('true');
    participant.dispose();
    click(button);
    fallback.click();
    await settle();
    expect(root.getAttribute('aria-expanded')).toBe('false');
  });
  it('commits both Header participants, preserves directory state through runtime switches, and returns Escape to the current Button', async () => {
    const { header, root, panel, article, fallback } = fixture();
    const disclosure = initSiteHeaderDisclosure(header);
    handles.push(disclosure);
    const menu = header.querySelector<HTMLElement>('[data-menu]')!;
    disclosure.bindButton(menu);
    disclosure.enhance();
    const handle = initDocumentationHeaderSurface(header)!;
    handles.push(handle);
    expect(initDocumentationHeaderSurface(header)).toBe(handle);
    await vi.waitFor(() => expect(root.dataset.contentsRuntime).toBe('wc'), { timeout: 15000 });
    click(activeButton(root));
    await vi.waitFor(() => expect(root.getAttribute('aria-expanded')).toBe('true'));
    for (const runtime of ['react', 'vue', 'vue2', 'wc']) {
      article.focus();
      document.dispatchEvent(
        new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: runtime } })
      );
      await vi.waitFor(() => expect(root.dataset.contentsRuntime).toBe(runtime), {
        timeout: 15000,
      });
      expect(root.dataset.contentsGeneration).toBe(panel.dataset.headerSurfaceGeneration);
      expect(root.dataset.contentsRuntime).toBe(panel.dataset.headerSurfaceRuntime);
      expect(activeButton(root).getAttribute('aria-expanded')).toBe('true');
      expect(document.activeElement).toBe(article);
    }
    document.dispatchEvent(
      new KeyboardEvent('keyup', { key: 'Escape', bubbles: true, cancelable: true })
    );
    expect(root.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(activeButton(root));
    disclosure.toggle();
    await settle();
    click(activeButton(root));
    await settle();
    expect(header.dataset.siteMenuOpen).toBe('false');
    expect(root.getAttribute('aria-expanded')).toBe('true');
    disclosure.toggle();
    expect(root.getAttribute('aria-expanded')).toBe('false');
    disclosure.close();
    click(activeButton(root));
    await settle();
    article.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(root.getAttribute('aria-expanded')).toBe('true');
    document
      .querySelector('[data-outside]')!
      .dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(root.getAttribute('aria-expanded')).toBe('false');
    click(activeButton(root));
    await settle();
    click(article);
    expect(root.getAttribute('aria-expanded')).toBe('false');
    await handle.destroy();
    await handle.destroy();
    expect(root.querySelector('[data-projection-generation-host]')).toBeNull();
    expect(fallback.hidden).toBe(false);
    expect(fallback.inert).toBe(false);
    const next = initDocumentationHeaderSurface(header)!;
    handles.push(next);
    expect(next).not.toBe(handle);
    await vi.waitFor(() => expect(root.dataset.contentsRuntime).toBe('wc'), { timeout: 15000 });
    click(activeButton(root));
    await settle();
    expect(root.getAttribute('aria-expanded')).toBe('true');
  }, 30000);
  it('revokes queued command activation synchronously when the Header scope starts destruction', async () => {
    const { header, root } = fixture();
    const handle = initDocumentationHeaderSurface(header)!;
    handles.push(handle);
    await vi.waitFor(() => expect(root.dataset.contentsRuntime).toBe('wc'), { timeout: 15000 });
    const opened = vi.fn();
    document.addEventListener('site-contents:open', opened);
    click(activeButton(root));
    const cleanup = handle.destroy();
    await cleanup;
    document.removeEventListener('site-contents:open', opened);
    expect(opened).not.toHaveBeenCalled();
    expect(document.body.hasAttribute('data-mobile-menu-expanded')).toBe(false);
  });
  it('retains SSR after one participant fails, retries, and rolls back a later failed switch without relabeling the old Button', async () => {
    const { header, root, panel, fallback } = fixture();
    faults.failReact = true;
    localStorage.setItem(PREFERRED_ADAPTER_KEY, 'react');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handle = initDocumentationHeaderSurface(header)!;
    handles.push(handle);
    await vi.waitFor(() => expect(error).toHaveBeenCalled(), { timeout: 15000 });
    expect(root.dataset.contentsRuntime).toBeUndefined();
    expect(panel.dataset.headerSurfaceRuntime).toBeUndefined();
    expect(root.querySelector('[data-projection-generation-host]')).toBeNull();
    expect(panel.querySelector('[data-projection-generation-host]')).toBeNull();
    expect(fallback.hidden).toBe(false);
    fallback.click();
    expect(root.getAttribute('aria-expanded')).toBe('true');
    document.dispatchEvent(new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: 'wc' } }));
    await vi.waitFor(() => expect(root.dataset.contentsRuntime).toBe('wc'), { timeout: 15000 });
    const before = activeButton(root);
    const generation = root.dataset.contentsGeneration;
    error.mockClear();
    document.dispatchEvent(
      new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: 'react' } })
    );
    await vi.waitFor(() => expect(error).toHaveBeenCalled(), { timeout: 15000 });
    expect(activeButton(root)).toBe(before);
    expect(root.dataset.contentsRuntime).toBe('wc');
    expect(root.dataset.contentsGeneration).toBe(generation);
    expect(panel.dataset.headerSurfaceGeneration).toBe(generation);
    click(before);
    await settle();
    expect(root.getAttribute('aria-expanded')).toBe('false');
  }, 30000);
});
