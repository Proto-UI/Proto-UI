import { afterEach, describe, expect, it, vi } from 'vitest';
import { headerSurfaceParticipant, initDocumentationHeaderSurface } from './site-header-surface';
import { initHomepageRuntime } from './Homepage/homepage-runtime-client';
import { AdaptToWebComponent } from '@proto.ui/adapter-web-component';
import Toggle from '../../../../packages/prototypes/shadcn/src/toggle/toggle.proto';
import { initSiteHeaderDisclosure } from './site-header-disclosure';
import { PREFERRED_ADAPTER_EVENT, PREFERRED_ADAPTER_KEY } from './adapter-preference';
import type { MaterializedProjectionCandidate } from './PrototypePreviewer/projection-materializer';
import { initCodeSurface } from './site-code-surface';
import { initCopyCommand } from './site-copy-command';
import {
  deferUntilDocsHeaderPrepared,
  reserveDocsHeaderPreparation,
} from './docs-header-preparation';

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
const faults = vi.hoisted(() => ({
  failReact: false,
  calls: [] as string[],
  holdHeader: undefined as Promise<void> | undefined,
  holdRetirement: undefined as Promise<void> | undefined,
  preparations: [] as Array<{
    runtime: string;
    recipe: string;
    headerRuntime: string | undefined;
    background: boolean;
  }>,
}));
vi.mock('./PrototypePreviewer/projection-materializer', async (original) => {
  const actual = await original<typeof import('./PrototypePreviewer/projection-materializer')>();
  return {
    ...actual,
    materializeProjectionCandidate: async (
      ...args: Parameters<typeof actual.materializeProjectionCandidate>
    ) => {
      const runtime = args[0].selection.runtimeId;
      const options = args[1];
      faults.calls.push(runtime);
      faults.preparations.push({
        runtime,
        recipe: options.content?.recipe.id ?? '',
        background: !!options.backgroundPreparation,
        headerRuntime: document.querySelector<HTMLElement>('[data-site-header-panel]')?.dataset
          .headerSurfaceRuntime,
      });
      if (
        faults.holdHeader &&
        runtime === 'react' &&
        options.ownerId.startsWith('site-header-surface-')
      )
        await faults.holdHeader;
      if (faults.failReact && runtime === 'react') throw new Error('renderer unavailable');
      const candidate = await actual.materializeProjectionCandidate(...args);
      if (runtime !== 'wc' || !options.ownerId.startsWith('site-header-surface-')) return candidate;
      return {
        ...candidate,
        dispose() {
          const pending = faults.holdRetirement;
          return pending ? pending.then(() => candidate.dispose()) : candidate.dispose();
        },
      };
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
  faults.holdHeader = undefined;
  faults.holdRetirement = undefined;
  faults.calls.length = 0;
  faults.preparations.length = 0;
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
        expect((surface as HTMLElement).style.display).toBe('flex');
        expect((surface as HTMLElement).style.flexDirection).toBe('column');
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

  it.each(['publication', 'preparation failure'] as const)(
    'keeps independently registered Docs Copy and Code views usable until Header %s',
    async (outcome) => {
      const { header, panel } = fixture();
      header.dataset.docsSiteHeader = '';
      const code = document.createElement('div');
      const source = document.createElement('pre');
      source.textContent = 'native source';
      code.append(source);
      const copyRoot = document.createElement('div');
      document.body.append(code, copyRoot);
      const surface = initCodeSurface(code);
      const copy = initCopyCommand(copyRoot, () => 'native source');
      handles.push(surface, copy);
      await Promise.all([surface.ready, copy.ready]);
      const oldCopy = copyRoot.querySelector<HTMLElement>('[data-demo-ref="copy-button"]')!;
      expect(oldCopy).toBeTruthy();
      const docs = initDocumentationHeaderSurface(header)!;
      handles.push(docs);
      await vi.waitFor(() => expect(panel.dataset.headerSurfaceRuntime).toBe('wc'));

      const { promise, resolve, reject } = Promise.withResolvers<void>();
      const retirement = Promise.withResolvers<void>();
      faults.holdHeader = promise;
      faults.holdRetirement = retirement.promise;
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        document.dispatchEvent(
          new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: 'react' } })
        );
        await vi.waitFor(() =>
          expect(faults.calls.filter((runtime) => runtime === 'react')).toHaveLength(1)
        );
        await Promise.resolve();
        expect(panel.dataset.headerSurfaceRuntime).toBe('wc');
        expect(code.dataset.codeSurfaceRuntime).toBe('wc');
        expect(copyRoot.dataset.copyRuntime).toBe('wc');
        expect(oldCopy.closest('[inert]')).toBeNull();
        expect(code.querySelector('pre')).toBe(source);

        if (outcome === 'publication') resolve();
        else reject(new Error('controlled Header preparation failure'));
        const headerRuntime = outcome === 'publication' ? 'react' : 'wc';
        if (outcome === 'preparation failure')
          await vi.waitFor(() => expect(error).toHaveBeenCalled());
        await vi.waitFor(() => expect(panel.dataset.headerSurfaceRuntime).toBe(headerRuntime));
        await vi.waitFor(() => expect(code.dataset.codeSurfaceRuntime).toBe('react'));
        await vi.waitFor(() => expect(copyRoot.dataset.copyRuntime).toBe('react'));
        const independent = faults.preparations.filter(
          ({ runtime, recipe }) =>
            runtime === 'react' &&
            (recipe === 'website-code-surface' || recipe === 'website-copy-command')
        );
        expect(independent.map(({ recipe }) => recipe).sort()).toEqual([
          'website-code-surface',
          'website-copy-command',
        ]);
        expect(independent.every((call) => call.headerRuntime === headerRuntime)).toBe(true);
        expect(independent.some((call) => call.background)).toBe(false);
        expect(code.querySelector('pre')).toBe(source);
        expect(source.textContent).toBe('native source');
      } finally {
        resolve();
        retirement.resolve();
      }
    },
    15000
  );
});

it('coalesces Docs decoration requests and respects superseding preparation and removal', async () => {
  const retained = document.createElement('div');
  const removed = document.createElement('div');
  document.body.append(retained, removed);
  const first = reserveDocsHeaderPreparation(document);
  let latest: (() => void) | undefined;
  try {
    const run = vi.fn();
    const runRemoved = vi.fn();
    const prepare = deferUntilDocsHeaderPrepared(retained, run);
    const wait = prepare.prepare();
    expect(prepare.prepare()).toBe(wait);
    const gone = deferUntilDocsHeaderPrepared(removed, runRemoved).prepare();
    latest = reserveDocsHeaderPreparation(document);
    first();
    removed.remove();
    await Promise.resolve();
    expect(run).not.toHaveBeenCalled();
    latest();
    await Promise.all([wait, gone]);
    expect(run).toHaveBeenCalledOnce();
    expect(runRemoved).not.toHaveBeenCalled();
  } finally {
    first();
    latest?.();
  }
});

it.each(['first view', 'recovery'] as const)(
  'prepares a Docs Copy and Code $reason while Header preparation is still pending',
  async (reason) => {
    const code = document.createElement('div');
    const copyRoot = document.createElement('div');
    document.body.append(code, copyRoot);
    const release = reserveDocsHeaderPreparation(document);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      if (reason === 'recovery') {
        faults.failReact = true;
        localStorage.setItem(PREFERRED_ADAPTER_KEY, 'react');
      }
      const surface = initCodeSurface(code);
      const copy = initCopyCommand(copyRoot, () => 'native source');
      handles.push(surface, copy);
      if (reason === 'recovery') {
        await vi.waitFor(() => expect(copyRoot.dataset.copyView).toBe('unavailable'));
        await vi.waitFor(() => expect(code.dataset.codeSurfaceView).toBe('unavailable'));
        expect(error).toHaveBeenCalled();
        faults.failReact = false;
        document.dispatchEvent(
          new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: 'wc' } })
        );
      }
      await vi.waitFor(() => expect(copyRoot.dataset.copyRuntime).toBe('wc'));
      await vi.waitFor(() => expect(code.dataset.codeSurfaceRuntime).toBe('wc'));
      expect(
        faults.preparations
          .filter(({ runtime, background }) => runtime === 'wc' && background)
          .map(({ recipe }) => recipe)
          .sort()
      ).toEqual(['website-code-surface', 'website-copy-command']);
      const button = copyRoot.querySelector<HTMLElement>('[data-demo-ref="copy-button"]');
      expect(button).not.toBeNull();
      expect(button?.closest('[inert]')).toBeNull();
      await Promise.all([surface.ready, copy.ready]);
    } finally {
      faults.failReact = false;
      release();
    }
  }
);

it('revokes a queued Docs decoration replacement when its owner is destroyed', async () => {
  const code = document.createElement('div');
  const copyRoot = document.createElement('div');
  document.body.append(code, copyRoot);
  const surface = initCodeSurface(code);
  const copy = initCopyCommand(copyRoot, () => 'native source');
  handles.push(surface, copy);
  await Promise.all([surface.ready, copy.ready]);
  expect(faults.calls).toEqual(['wc', 'wc']);
  const release = reserveDocsHeaderPreparation(document);
  try {
    document.dispatchEvent(
      new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: 'react' } })
    );
    expect(faults.calls).toEqual(['wc', 'wc']);
    await Promise.all([surface.destroy(), copy.destroy()]);
    release();
    await Promise.resolve();
    expect(faults.calls).toEqual(['wc', 'wc']);
  } finally {
    release();
  }
});

it('keeps local previewer Copy and Code independent of pending Docs Header preparation', async () => {
  const previewer = document.createElement('div');
  previewer.dataset.previewerId = 'local';
  const code = document.createElement('div');
  const copyRoot = document.createElement('div');
  previewer.append(code, copyRoot);
  document.body.append(previewer);
  const release = reserveDocsHeaderPreparation(document);
  try {
    const surface = initCodeSurface(code);
    const copy = initCopyCommand(copyRoot, () => 'native source');
    handles.push(surface, copy);
    await vi.waitFor(() => expect(code.dataset.codeSurfaceRuntime).toBe('wc'));
    await vi.waitFor(() => expect(copyRoot.dataset.copyRuntime).toBe('wc'));
    expect(faults.preparations.some(({ background }) => background)).toBe(false);
  } finally {
    release();
  }
});

it('preserves a focused native language destination when the first homepage projection replaces its fallback', async () => {
  document.body.innerHTML = `<header data-site-header data-homepage-runtime>
    <details data-site-header-panel id="panel" open><summary data-site-header-fallback-summary>Navigation</summary><div data-site-header-surface-mount></div><div data-site-header-panel-content>
      <div id="language" data-homepage-actions><div data-homepage-fallback><a href="/en/" data-home-action-variant="minimal">English</a></div><div data-homepage-mount></div></div>
    </div></details>
    <div id="preferences" data-homepage-actions data-homepage-controls="runtime"><div data-homepage-fallback></div><div data-homepage-mount></div></div>
    <div id="menu" data-homepage-actions><div data-homepage-fallback><span data-homepage-menu>Navigation</span></div><div data-homepage-mount></div></div>
  </header>`;
  const header = document.querySelector<HTMLElement>('header')!;
  header.querySelector<HTMLAnchorElement>('a')!.focus();
  const handle = initHomepageRuntime(header)!;
  handles.push(handle);
  await vi.waitFor(() => expect(handle.getSnapshot().phase).toBe('ready'), { timeout: 15000 });
  const projected = header.querySelector(
    '#language [data-projection-generation-state="active"] a'
  )!;
  expect(projected).not.toBeNull();
  expect(document.activeElement).toBe(projected);
  expect(header.dataset.siteMenuOpen).toBe('true');
  expect(projected.closest('[hidden], [inert]')).toBeNull();
}, 30000);
