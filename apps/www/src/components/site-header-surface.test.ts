import { afterEach, describe, expect, it, vi } from 'vitest';
import { headerSurfaceParticipant, initDocumentationHeaderSurface } from './site-header-surface';
import { initHomepageRuntime } from './Homepage/homepage-runtime-client';
import { AdaptToWebComponent } from '@proto.ui/adapter-web-component';
import Toggle from '../../../../packages/prototypes/shadcn/src/toggle/toggle.proto';
import { initSiteHeaderDisclosure } from './site-header-disclosure';
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
      if (faults.failReact && args[0].selection.runtimeId === 'react')
        throw new Error('renderer unavailable');
      return actual.materializeProjectionCandidate(...args);
    },
  };
});
const StatefulToggle = AdaptToWebComponent(Toggle, { registerAs: 'test-header-stable-toggle' });
const candidates: MaterializedProjectionCandidate[] = [];
const handles: Array<{ destroy(): Promise<void> }> = [];
afterEach(async () => {
  for (const handle of handles.splice(0)) await handle.destroy();
  for (const candidate of candidates.splice(0)) await candidate.dispose();
  document.body.replaceChildren();
  localStorage.clear();
  faults.failReact = false;
  faults.calls.length = 0;
  vi.restoreAllMocks();
});
function fixture() {
  document.body.innerHTML = `<header data-site-header><div data-site-header-panel id="panel"><div data-site-header-surface-mount></div><div data-site-header-panel-content><nav aria-label="Primary"><a href="/docs/" target="_blank" rel="noopener">Docs</a></nav><input aria-label="draft" value="keep my text"></div></div></header>`;
  const header = document.querySelector<HTMLElement>('header')!;
  return {
    header,
    panel: header.querySelector<HTMLElement>('[data-site-header-panel]')!,
    content: header.querySelector<HTMLElement>('[data-site-header-panel-content]')!,
    link: header.querySelector('a')!,
    input: header.querySelector('input')!,
  };
}
describe('native Header content inside real family projection surfaces', () => {
  for (const family of ['shadcn', 'brutalist'] as const)
    for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
      it(`${family}/${runtime}: keeps native identity and focus through slot publication and retired cleanup`, async () => {
        const { header, panel, content, link, input } = fixture();
        const participant = headerSurfaceParticipant(header)!;
        const first = {
          generation: 1,
          selection: { runtimeId: runtime, projectionFamilyId: family },
        };
        const a = await participant.materialize(first);
        candidates.push(a);
        expect(content.parentElement).toBe(panel);
        input.focus();
        input.setSelectionRange(2, 5);
        a.activate();
        participant.prepareCommit(first).publish();
        const surface = content.closest('.site-header-popup-surface')!;
        expect(surface).not.toBeNull();
        expect(surface.getAttribute('data-pui-style')).toContain(
          family === 'brutalist' ? 'rounded-base' : 'rounded-xl'
        );
        expect(surface.getAttribute('data-pui-style')).not.toContain('shadow-');
        expect(content.querySelector('a')).toBe(link);
        expect(link.getAttribute('href')).toBe('/docs/');
        expect(link.getAttribute('target')).toBe('_blank');
        expect(input.value).toBe('keep my text');
        expect(document.activeElement).toBe(input);
        expect([input.selectionStart, input.selectionEnd]).toEqual([2, 5]);
        const second = {
          generation: 2,
          selection: {
            runtimeId: runtime,
            projectionFamilyId: family === 'shadcn' ? 'brutalist' : 'shadcn',
          },
        };
        const b = await participant.materialize(second);
        candidates.push(b);
        b.activate();
        participant.prepareCommit(second).publish();
        const activeParent = content.parentElement;
        await a.dispose();
        candidates.splice(candidates.indexOf(a), 1);
        expect(content.parentElement).toBe(activeParent);
        expect(content.isConnected).toBe(true);
        expect(panel.dataset.headerSurfaceGeneration).toBe('2');
        expect(panel.querySelectorAll('.site-header-popup-surface')).toHaveLength(1);
        expect(panel.querySelector('.site-header-popup-surface')?.getAttribute('role')).toBeNull();
        expect(panel.querySelector('.site-header-popup-surface')?.hasAttribute('tabindex')).toBe(
          false
        );
        await b.dispose();
        candidates.splice(candidates.indexOf(b), 1);
        expect(content.parentElement).toBe(panel);
        expect(header.querySelector('input')).toBe(input);
      }, 15000);
    }
  it('preserves an actual WC child instance and uncontrolled state across synchronous slot moves', async () => {
    const { header, content } = fixture();
    const p = headerSurfaceParticipant(header)!;
    const toggle = new StatefulToggle();
    toggle.textContent = 'Keep selection';
    content.append(toggle);
    await vi.waitFor(() => expect(toggle.getExposes().active).toBeTruthy());
    toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => expect(toggle.getExposes().active.get()).toBe(true));
    const active = toggle.getExposes().active;
    for (const [index, runtime] of ['wc', 'react', 'vue', 'vue2'].entries()) {
      const request = {
        generation: index + 1,
        selection: { runtimeId: runtime!, projectionFamilyId: 'shadcn' },
      };
      const next = await p.materialize(request);
      candidates.push(next);
      next.activate();
      p.prepareCommit(request).publish();
      await vi.waitFor(() => expect(toggle.getExposes().active.get()).toBe(true));
      expect(toggle.getExposes().active).toBe(active);
      expect(toggle.isConnected).toBe(true);
      expect(content.querySelector('test-header-stable-toggle')).toBe(toggle);
    }
  }, 15000);

  it('commits the popup with the homepage generation and keeps open state through all four runtimes', async () => {
    const { header, panel, input } = fixture();
    header.dataset.homepageRuntime = '';
    header.insertAdjacentHTML(
      'beforeend',
      '<div id="preferences" data-homepage-actions data-homepage-controls="runtime"><div data-homepage-fallback></div><div data-homepage-mount></div></div><div id="menu" data-homepage-actions><div data-homepage-fallback><span data-homepage-menu>Navigation</span></div><div data-homepage-mount></div></div>'
    );
    const handle = initHomepageRuntime(header)!;
    handles.push(handle);
    await vi.waitFor(() => expect(handle.getSnapshot().phase).toBe('ready'), { timeout: 15000 });
    const firstButton = header.querySelector<HTMLElement>('[data-demo-ref="home-menu"]')!;
    firstButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => expect(header.dataset.siteMenuOpen).toBe('true'));
    input.focus();
    for (const runtime of ['react', 'vue', 'vue2', 'wc']) {
      document.dispatchEvent(
        new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: runtime } })
      );
      await vi.waitFor(() => expect(header.dataset.runtime).toBe(runtime), { timeout: 15000 });
      await vi.waitFor(() => expect(header.dataset.runtimeState).toBe('ready'));
      expect(panel.dataset.headerSurfaceGeneration).toBe(header.dataset.runtimeGeneration);
      expect(panel.dataset.headerSurfaceRuntime).toBe(runtime);
      expect(header.dataset.siteMenuOpen).toBe('true');
      expect(panel.contains(input)).toBe(true);
      expect(document.activeElement).toBe(input);
    }
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    );
    expect(document.activeElement).toBe(
      header.querySelector(
        '[data-projection-generation-state="active"] [data-demo-ref="home-menu"]'
      )
    );
  }, 30000);

  it('retains nested preference owners through compact moves, runtime publication and failure rollback', async () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue(
      Object.assign(new EventTarget(), { matches: true }) as MediaQueryList
    );
    const { header, panel, content } = fixture();
    header.dataset.homepageRuntime = '';
    content.insertAdjacentHTML('beforeend', '<div data-site-header-compact-context></div>');
    header.insertAdjacentHTML(
      'beforeend',
      '<div data-site-header-context><div data-site-header-preferences><div id="preferences" data-homepage-actions data-homepage-controls="runtime"><div data-homepage-fallback></div><div data-homepage-mount></div></div></div></div><div id="menu" data-homepage-actions><div data-homepage-fallback><span data-homepage-menu>Navigation</span></div><div data-homepage-mount></div></div>'
    );
    const preferences = header.querySelector<HTMLElement>('[data-site-header-preferences]')!;
    const mount = preferences.querySelector<HTMLElement>('[data-homepage-mount]')!;
    const handle = initHomepageRuntime(header)!;
    handles.push(handle);
    await vi.waitFor(() => expect(handle.getSnapshot().phase).toBe('ready'), { timeout: 15000 });
    const disclosure = initSiteHeaderDisclosure(header);
    disclosure.toggle();
    expect(panel.contains(preferences)).toBe(true);
    for (const runtime of ['wc', 'react', 'vue', 'vue2', 'wc']) {
      document.dispatchEvent(
        new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: runtime } })
      );
      await vi.waitFor(() => expect(header.dataset.runtime).toBe(runtime), { timeout: 15000 });
      await vi.waitFor(() => expect(header.dataset.runtimeState).toBe('ready'));
      await vi.waitFor(() =>
        expect(mount.querySelectorAll('[data-projection-generation-host]')).toHaveLength(1)
      );
      expect(header.querySelector('[data-site-header-preferences]')).toBe(preferences);
      expect(panel.contains(preferences)).toBe(true);
      const generation = header.dataset.runtimeGeneration;
      const ownScope = mount.querySelector<HTMLElement>(
        '[data-projection-scope="homepage-preferences"]'
      )!;
      expect(ownScope.dataset.projectionGeneration).toBe(generation);
      expect(
        ownScope
          .closest('[data-projection-generation-host]')
          ?.getAttribute('data-projection-owner-host')
      ).toBe('homepage-preferences');
      const triggers = mount.querySelectorAll<HTMLElement>('[role="combobox"]');
      expect(triggers).toHaveLength(2);
      for (const trigger of triggers) {
        expect(trigger.dataset.projectionOwner).toBe('homepage-preferences');
        expect(trigger.dataset.projectionGeneration).toBe(generation);
        expect(trigger.dataset.projectionRuntime).toBe(runtime);
        expect(trigger.closest('[hidden], [inert]')).toBeNull();
      }
      expect(panel.dataset.headerSurfaceGeneration).toBe(generation);
      expect(panel.querySelectorAll('.site-header-popup-surface')).toHaveLength(1);
    }
    const previousScope = mount.querySelector('[data-projection-scope]');
    const previousGeneration = header.dataset.runtimeGeneration;
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    faults.failReact = true;
    document.dispatchEvent(
      new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: 'react' } })
    );
    await vi.waitFor(() => expect(header.dataset.runtimeState).toBe('error'));
    expect(error).toHaveBeenCalled();
    expect(mount.querySelector('[data-projection-scope]')).toBe(previousScope);
    expect(panel.dataset.headerSurfaceGeneration).toBe(previousGeneration);
    expect(panel.contains(preferences)).toBe(true);
    expect(panel.hidden).toBe(false);
    expect(mount.querySelector('[role="combobox"]')?.closest('[hidden], [inert]')).toBeNull();
  }, 30000);

  it('rolls back partial publication into the previous physical slot and restores coordinates', async () => {
    const { header, panel, content } = fixture();
    const p = headerSurfaceParticipant(header)!;
    const request = (generation: number) => ({
      generation,
      selection: { runtimeId: 'wc', projectionFamilyId: 'shadcn' },
    });
    const a = await p.materialize(request(1));
    candidates.push(a);
    a.activate();
    p.prepareCommit(request(1)).publish();
    const previous = content.parentElement;
    const b = await p.materialize(request(2));
    candidates.push(b);
    const publication = p.prepareCommit(request(2));
    b.activate();
    publication.publish();
    publication.rollback();
    expect(content.parentElement).toBe(previous);
    expect(panel.dataset.headerSurfaceGeneration).toBe('1');
    await b.dispose();
    candidates.splice(candidates.indexOf(b), 1);
    expect(content.parentElement).toBe(previous);
  }, 15000);
  it('restarts an initially failed Docs renderer from the latest preference, then destroys once', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { header, panel, content } = fixture();
    faults.failReact = true;
    localStorage.setItem(PREFERRED_ADAPTER_KEY, 'react');
    const handle = initDocumentationHeaderSurface(header)!;
    handles.push(handle);
    expect(initDocumentationHeaderSurface(header)).toBe(handle);
    await vi.waitFor(() => expect(error).toHaveBeenCalled());
    document.dispatchEvent(new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: 'wc' } }));
    await vi.waitFor(() => expect(panel.dataset.headerSurfaceRuntime).toBe('wc'), {
      timeout: 15000,
    });
    expect(faults.calls).toEqual(['react', 'wc']);
    await handle.destroy();
    await handle.destroy();
    handles.length = 0;
    expect(content.parentElement).toBe(panel);
    expect(panel.hasAttribute('data-header-surface-runtime')).toBe(false);
    document.dispatchEvent(
      new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: 'vue' } })
    );
    expect(faults.calls).toEqual(['react', 'wc']);
  }, 20000);
});
