import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertDemoSpec, type DemoSpec } from '../PrototypePreviewer/demo-types';
const fakes = vi.hoisted(() => ({
  materialize: vi.fn(),
  restoreFocus: vi.fn(),
  stopTheme: vi.fn(),
  watchTheme: vi.fn(),
  resolveTheme: vi.fn(),
}));
vi.mock('../PrototypePreviewer/projection-materializer', () => ({
  materializeProjectionCandidate: fakes.materialize,
  restoreProjectionControlFocus: fakes.restoreFocus,
}));
vi.mock('../PrototypePreviewer/projection-theme', () => ({
  resolveProjectionThemeSurfaceStyle: fakes.resolveTheme,
  watchProjectionThemeSurfaceStyle: fakes.watchTheme,
}));
import { createHomepageContent, initHomepageRuntime } from './homepage-runtime-client';
import * as siteFamily from '../site-library-family';

type Handle = NonNullable<ReturnType<typeof initHomepageRuntime>>;
let handle: Handle | undefined;
const preferenceListeners: EventListener[] = [];
function fixture(withDemo = false) {
  document.body.innerHTML = `<header data-homepage-runtime data-runtime-label="Page runtime"><output data-homepage-runtime-status></output>
  <div id="navigation" data-homepage-actions data-homepage-controls="runtime"><div data-homepage-fallback><a href="/docs/" data-home-action-variant="minimal">Docs</a><button data-homepage-theme>Theme</button></div><div data-homepage-mount></div></div></header>
  <main><div id="hero" data-homepage-actions><div data-homepage-fallback><a href="https://example.com/docs" target="_blank" rel="noopener">Get started</a></div><div data-homepage-mount></div></div></main>`;
  if (withDemo) {
    const demo = document.createElement('section');
    demo.dataset.homeShowcase = 'website-component-gallery';
    demo.dataset.locale = 'en';
    demo.innerHTML = '<div data-home-demo-host></div><output data-home-demo-status></output>';
    document.body.append(demo);
  }
  return document.querySelector<HTMLElement>('[data-homepage-runtime]')!;
}
function candidate() {
  return {
    activate: vi.fn(),
    dispose: vi.fn(),
    setLocked: vi.fn(),
    setThemeSurfaceStyle: vi.fn(),
    host: document.createElement('div'),
    scope: document.createElement('div'),
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const settle = async () => {
  for (let index = 0; index < 18; index++) await Promise.resolve();
};
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  fakes.materialize.mockReset().mockImplementation(async () => candidate());
  fakes.watchTheme.mockReturnValue(fakes.stopTheme);
  fakes.resolveTheme.mockReset().mockReturnValue({ '--pui-background': '#fff' });
});
afterEach(async () => {
  await handle?.destroy();
  handle = undefined;
  for (const listener of preferenceListeners.splice(0))
    document.removeEventListener('proto-adapter:change', listener);
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('Homepage page-owned runtime', () => {
  it('stages all action groups before hiding native SSR links, with the one global runtime/library control group', async () => {
    const root = fixture();
    const gate = deferred<ReturnType<typeof candidate>>();
    fakes.materialize.mockImplementationOnce(() => gate.promise);
    handle = initHomepageRuntime(root);
    await settle();
    expect(document.querySelector<HTMLElement>('[data-homepage-fallback]')!.hidden).toBe(false);
    expect(fakes.materialize.mock.calls[0]![1].controlIds).toEqual(['runtime', 'family']);
    expect(fakes.materialize.mock.calls[0]![1].controls.runtime.triggerAppearance).toBe('ghost');
    expect(fakes.materialize.mock.calls[0]![1].controls.family.triggerAppearance).toBe('ghost');
    expect(fakes.materialize.mock.calls[1]![1].controlIds).toEqual([]);
    gate.resolve(candidate());
    await settle();
    expect(root.dataset.runtimeState).toBe('ready');
    expect(
      [...document.querySelectorAll<HTMLElement>('[data-homepage-fallback]')].every(
        (element) => element.hidden
      )
    ).toBe(true);
    const content = fakes.materialize.mock.calls[1]![1].content.demo as DemoSpec;
    assertDemoSpec(content);
    expect(JSON.stringify(content.root)).toContain('"tag":"a"');
    expect(JSON.stringify(content.root)).toContain('"href":"https://example.com/docs"');
    expect(JSON.stringify(content.root)).toContain('"target":"_blank"');
    expect(JSON.stringify(content.root)).toContain('"rel":"noopener"');
  });

  it('commits repeated runtime switches to every group and publishes preference after success', async () => {
    const root = fixture();
    handle = initHomepageRuntime(root);
    await settle();
    const old = fakes.materialize.mock.results.map((result) => result.value);
    const controls = fakes.materialize.mock.calls[0]![1].controls;
    controls.runtime.onValueChange('react');
    await settle();
    expect(root.dataset.runtime).toBe('react');
    expect(localStorage.getItem('preferred-prototypes-adapter')).toBe('react');
    expect(
      fakes.materialize.mock.calls
        .slice(-2)
        .every(([request]) => request.selection.runtimeId === 'react')
    ).toBe(true);
    for (const promise of old) expect((await promise).dispose).toHaveBeenCalledOnce();
    expect(fakes.restoreFocus).toHaveBeenCalled();
    controls.runtime.onValueChange('vue2');
    await settle();
    expect(handle!.getSnapshot().selection.runtimeId).toBe('vue2');
  });

  it('keeps the prior whole page on partial materialization failure and disposes prepared siblings', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const root = fixture();
    handle = initHomepageRuntime(root);
    await settle();
    const oldGeneration = handle!.getSnapshot().generation;
    const partial = candidate();
    fakes.materialize
      .mockImplementationOnce(async () => partial)
      .mockRejectedValueOnce(new Error('framework dependency unavailable'));
    fakes.materialize.mock.calls[0]![1].controls.runtime.onValueChange('react');
    await settle();
    expect(root.dataset.runtimeState).toBe('error');
    expect(root.dataset.runtime).toBe('wc');
    expect(handle!.getSnapshot().generation).toBe(oldGeneration);
    expect(partial.activate).not.toHaveBeenCalled();
    expect(partial.dispose).toHaveBeenCalledOnce();
    expect(localStorage.getItem('preferred-prototypes-adapter')).toBeNull();
  });

  it('discards late candidates after a newer selection and preserves the latest whole page', async () => {
    const root = fixture();
    handle = initHomepageRuntime(root);
    await settle();
    const late = deferred<ReturnType<typeof candidate>>();
    fakes.materialize.mockImplementationOnce(() => late.promise);
    const controls = fakes.materialize.mock.calls[0]![1].controls;
    controls.runtime.onValueChange('react');
    await settle();
    controls.runtime.onValueChange('vue');
    await settle();
    const stale = candidate();
    late.resolve(stale);
    await settle();
    expect(root.dataset.runtime).toBe('vue');
    expect(stale.activate).not.toHaveBeenCalled();
    expect(stale.dispose).toHaveBeenCalledOnce();
  });

  it('restores fallback and removes subscriptions on disposal', async () => {
    const root = fixture();
    handle = initHomepageRuntime(root);
    await settle();
    expect(initHomepageRuntime(root)).toBe(handle);
    await handle!.destroy();
    expect(fakes.stopTheme).toHaveBeenCalledTimes(2);
    expect(document.querySelector<HTMLElement>('[data-homepage-fallback]')!.hidden).toBe(false);
    const count = fakes.materialize.mock.calls.length;
    document.dispatchEvent(new CustomEvent('proto-adapter:change', { detail: { adapter: 'vue' } }));
    await settle();
    expect(fakes.materialize.mock.calls).toHaveLength(count);
  });
  it('switches header, native action recipes and demo in one generation with orthogonal runtime/library state and the explicit task recipe', async () => {
    const root = fixture(true);
    handle = initHomepageRuntime(root);
    await settle();
    const demo = document.querySelector<HTMLElement>('[data-home-showcase]')!;
    expect(fakes.materialize.mock.calls).toHaveLength(3);
    expect(demo.dataset.projectionGeneration).toBe(root.dataset.runtimeGeneration);
    expect(demo.dataset.projectionRuntime).toBe('wc');
    const controls = fakes.materialize.mock.calls[0]![1].controls;
    expect(fakes.materialize.mock.calls[2]![1].controlIds).toEqual([]);
    const task = fakes.materialize.mock.calls[2]![1].content;
    expect(task.recipe.id).toBe('website-component-gallery');
    assertDemoSpec(task.demo);
    expect(task.recipe.prototypeIds).toContain('shadcn-textarea-root');
    expect(task.recipe.prototypeIds).toContain('shadcn-switch-root');
    controls.family.onValueChange('brutalist');
    await settle();
    expect(root.dataset.family).toBe('brutalist');
    expect(fakes.restoreFocus.mock.calls.at(-1)?.[0]).toBe(
      root.querySelector('[data-homepage-controls="runtime"] [data-homepage-mount]')
    );
    expect(fakes.restoreFocus.mock.calls.at(-1)?.[1]).toBe('projection-family-select');
    expect(demo.dataset.projectionFamily).toBe('brutalist');
    expect(demo.dataset.projectionComponent).toBe('website-component-gallery');
    expect(document.documentElement.dataset.siteLibraryFamily).toBe('brutalist');
    expect(
      fakes.materialize.mock.calls
        .slice(-3)
        .every(([request]) => request.selection.projectionFamilyId === 'brutalist')
    ).toBe(true);
    const headerDemo = fakes.materialize.mock.calls.at(-3)![1].content.demo;
    expect(JSON.stringify(headerDemo.root)).toContain('brutalist-button');
    expect(JSON.stringify(headerDemo.root)).not.toContain('shadcn-button');
    controls.runtime.onValueChange('react');
    await settle();
    expect(root.dataset.runtime).toBe('react');
    expect(demo.dataset.runnerRuntime).toBe('react');
    expect(demo.dataset.projectionRuntime).toBe('react');
    expect(demo.dataset.projectionGeneration).toBe(root.dataset.runtimeGeneration);
    expect(demo.dataset.projectionComponent).toBe('website-component-gallery');
    expect(root.dataset.family).toBe('brutalist');
  });

  it('rejects partial family requests before changing the committed homepage transaction', async () => {
    const root = fixture(true);
    handle = initHomepageRuntime(root);
    await settle();
    const generation = root.dataset.runtimeGeneration;
    const calls = fakes.materialize.mock.calls.length;
    const controls = fakes.materialize.mock.calls[0]![1].controls;
    for (const family of ['bootstrap-2-3-2', 'liquid-glass', 'unknown']) {
      expect(() => controls.family.onValueChange(family)).toThrow(/unsupported whole-site family/);
      await settle();
      expect(root.dataset.family).toBe('shadcn');
      expect(root.dataset.runtimeState).toBe('ready');
      expect(root.dataset.runtimeGeneration).toBe(generation);
      expect(fakes.materialize.mock.calls).toHaveLength(calls);
    }
    controls.family.onValueChange('brutalist');
    await settle();
    expect(root.dataset.family).toBe('brutalist');
    await handle!.destroy();
    const retiredCalls = fakes.materialize.mock.calls.length;
    expect(() => controls.family.onValueChange('liquid-glass')).not.toThrow();
    expect(fakes.materialize.mock.calls).toHaveLength(retiredCalls);
  });

  it('a failed demo prevents the header and native action groups from committing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const root = fixture(true);
    handle = initHomepageRuntime(root);
    await settle();
    const demo = document.querySelector<HTMLElement>('[data-home-showcase]')!;
    const generation = root.dataset.runtimeGeneration;
    const header = candidate();
    const actions = candidate();
    fakes.materialize
      .mockResolvedValueOnce(header)
      .mockResolvedValueOnce(actions)
      .mockRejectedValueOnce(new Error('demo target failed'));
    fakes.materialize.mock.calls[0]![1].controls.runtime.onValueChange('vue');
    await settle();
    expect(root.dataset.runtimeGeneration).toBe(generation);
    expect(demo.dataset.projectionGeneration).toBe(generation);
    expect(root.dataset.runtime).toBe('wc');
    expect(demo.dataset.runnerRuntime).toBe('wc');
    expect(header.activate).not.toHaveBeenCalled();
    expect(actions.activate).not.toHaveBeenCalled();
    expect(header.dispose).toHaveBeenCalledOnce();
    expect(actions.dispose).toHaveBeenCalledOnce();
  });
  it('rolls back every site family marker when publication fails, including absent markers', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const root = fixture(true);
    document.documentElement.removeAttribute('data-site-library-family');
    const scope = document.createElement('div');
    scope.setAttribute('data-site-family-scope', '');
    document.body.append(scope);
    const apply = siteFamily.applySiteLibraryFamily;
    vi.spyOn(siteFamily, 'applySiteLibraryFamily').mockImplementationOnce((doc, family) => {
      apply(doc, family);
      throw new Error('publication failed');
    });
    handle = initHomepageRuntime(root);
    await settle();
    expect(root.dataset.runtimeState).toBe('error');
    expect(document.documentElement.hasAttribute('data-site-library-family')).toBe(false);
    expect(scope.hasAttribute('data-site-library-family')).toBe(false);
    expect(document.querySelector<HTMLElement>('[data-homepage-fallback]')!.hidden).toBe(false);
  });

  it('ignores stale preference side effects without taking over native navigation', () => {
    const root = fixture();
    const group = document.querySelector<HTMLElement>('[data-homepage-actions]')!;
    const anchor = group.querySelector<HTMLAnchorElement>('a')!;
    let active = false;
    const content = createHomepageContent(
      {
        root: group,
        mount: group,
        fallback: group,
        ownerId: 'test',
        links: [anchor],
        theme: false,
        runtime: false,
      },
      'wc',
      () => active
    );
    const cleanup = content.setup?.({
      host: group,
      refs: {},
      api: {
        call() {},
        getExposes() {
          return undefined;
        },
        setProps() {},
      },
    });
    // Capture at the caller only to keep this unit test from navigating its document.
    const current = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
    let nativeAllowed = false;
    const preventTestNavigation = (event: Event) => {
      nativeAllowed = !event.defaultPrevented;
      event.preventDefault();
    };
    root.addEventListener('click', preventTestNavigation);
    const stale = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
    anchor.dispatchEvent(stale);
    expect(nativeAllowed).toBe(true);
    active = true;
    anchor.dispatchEvent(current);
    expect(nativeAllowed).toBe(true);
    root.removeEventListener('click', preventTestNavigation);
    if (typeof cleanup === 'function') cleanup();
  });
  it('uses the public icon-size Button prop for compact accessible header preferences', () => {
    fixture();
    const group = document.querySelector<HTMLElement>('[data-homepage-actions]')!;
    group.dataset.homepageThemeIcon = 'true';
    group.dataset.homepageThemeLabel = 'Toggle color theme';
    const content = createHomepageContent(
      {
        root: group,
        mount: group,
        fallback: group,
        ownerId: 'preferences',
        links: [],
        theme: true,
        runtime: true,
      },
      'wc',
      () => true
    );
    const button = content.root.kind === 'box' ? content.root.children?.[0] : null;
    expect(
      button && typeof button !== 'string' && button.kind === 'proto' ? button.props : null
    ).toMatchObject({ size: 'icon' });
    expect(
      button && typeof button !== 'string' && button.kind === 'proto' ? button.children : null
    ).toEqual([
      { kind: 'box', className: 'site-header-theme-icon', attrs: { 'aria-hidden': 'true' } },
      { kind: 'box', className: 'home-theme-accessible-label', children: ['Toggle color theme'] },
    ]);
  });
  it('projects the menu as a real family Button and binds only its current runtime command channel', () => {
    fixture();
    const group = document.querySelector<HTMLElement>('[data-homepage-actions]')!;
    group.dataset.homepageMenuLabel = 'Navigation and settings';
    const button = document.createElement('button');
    group.append(button);
    const toggle = vi.fn();
    const unbind = vi.fn();
    const bindButton = vi.fn(() => unbind);
    let active = true;
    const disclosure = { bindButton, toggle, close: vi.fn(), enhance: vi.fn(), destroy: vi.fn() };
    for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
      const content = createHomepageContent(
        {
          root: group,
          mount: group,
          fallback: group,
          ownerId: 'menu',
          links: [],
          theme: false,
          runtime: false,
          menu: true,
          disclosure,
        },
        runtime,
        () => active,
        'brutalist'
      );
      assertDemoSpec(content);
      expect(JSON.stringify(content.root)).toContain('brutalist-button');
      const setProps = vi.fn();
      const cleanup = content.setup!({
        host: group,
        refs: { 'home-menu': button },
        api: {
          setProps,
          call() {},
          getExposes() {
            return undefined;
          },
        },
      });
      expect(bindButton).toHaveBeenCalledWith(button);
      const before = toggle.mock.calls.length;
      if (runtime === 'wc') {
        button.dispatchEvent(new MouseEvent('click'));
        expect(toggle).toHaveBeenCalledTimes(before);
        button.dispatchEvent(new CustomEvent('click'));
      } else setProps.mock.calls[0]![1].onClick();
      expect(toggle).toHaveBeenCalledTimes(before + 1);
      active = false;
      if (runtime === 'wc') button.dispatchEvent(new CustomEvent('click'));
      else setProps.mock.calls[0]![1].onClick();
      expect(toggle).toHaveBeenCalledTimes(before + 1);
      if (typeof cleanup === 'function') cleanup();
      active = true;
    }
    expect(unbind).toHaveBeenCalledTimes(4);
  });

  it('supports a preferences-only header group without inventing a command control', async () => {
    const root = fixture();
    root.querySelector('[data-homepage-fallback]')!.replaceChildren();
    handle = initHomepageRuntime(root);
    await settle();
    expect(root.dataset.runtimeState).toBe('ready');
    expect(fakes.materialize.mock.calls[0]![1].controlIds).toEqual(['runtime', 'family']);
    expect(fakes.materialize.mock.calls[0]![1].controls.runtime.triggerAppearance).toBe('ghost');
    expect(fakes.materialize.mock.calls[0]![1].controls.family.triggerAppearance).toBe('ghost');
  });
});

describe('Search participates in the existing homepage generation', () => {
  function withSearch() {
    const root = fixture(true);
    const search = document.createElement('site-search');
    search.innerHTML =
      '<div data-search-command-mount="open"></div><dialog><input value="Button"><div data-search-command-mount="close"></div><div data-search-command-mount="retry"></div></dialog>';
    root.append(search);
    return { root, search, dialog: search.querySelector('dialog')! };
  }
  it('uses one generation for all commands and preserves the native service DOM through library/runtime changes', async () => {
    const { root, search, dialog } = withSearch();
    handle = initHomepageRuntime(root);
    await settle();
    expect(search.dataset.searchGeneration).toBe(root.dataset.runtimeGeneration);
    const searchCalls = () =>
      fakes.materialize.mock.calls.filter(([, options]) =>
        options.ownerId.startsWith('site-search-')
      );
    expect(searchCalls()).toHaveLength(3);
    const controls = fakes.materialize.mock.calls[0]![1].controls;
    controls.family.onValueChange('brutalist');
    await settle();
    controls.runtime.onValueChange('vue2');
    await settle();
    expect(search.dataset.searchGeneration).toBe(root.dataset.runtimeGeneration);
    expect(search.dataset.searchFamily).toBe('brutalist');
    expect(search.dataset.searchRuntime).toBe('vue2');
    expect(
      new Set(
        searchCalls()
          .slice(-3)
          .map(([request]) => request.generation)
      ).size
    ).toBe(1);
    expect(search.querySelector('dialog')).toBe(dialog);
    expect(search.querySelector('input')!.value).toBe('Button');
    expect(initHomepageRuntime(root)).toBe(handle);
  });
  it('retains the whole old page if one Search command fails and never publishes mixed generations', async () => {
    const { root, search, dialog } = withSearch();
    handle = initHomepageRuntime(root);
    await settle();
    const before = root.dataset.runtimeGeneration;
    const controls = fakes.materialize.mock.calls[0]![1].controls;
    const staged: ReturnType<typeof candidate>[] = [];
    fakes.materialize.mockImplementation(async (_request, options) => {
      if (options.ownerId.endsWith('-close')) throw new Error('search close projection failed');
      const result = candidate();
      staged.push(result);
      return result;
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    controls.family.onValueChange('brutalist');
    await settle();
    expect(root.dataset.runtimeGeneration).toBe(before);
    expect(search.dataset.searchGeneration).toBe(before);
    expect(search.dataset.searchFamily).toBe('shadcn');
    expect(search.querySelector('dialog')).toBe(dialog);
    for (const item of staged) {
      expect(item.activate).not.toHaveBeenCalled();
      expect(item.dispose).toHaveBeenCalledOnce();
    }
    expect(error).toHaveBeenCalled();
  });
});

describe('pending homepage runtime preference intent', () => {
  async function begin() {
    localStorage.setItem('preferred-prototypes-adapter', 'wc');
    const root = fixture();
    handle = initHomepageRuntime(root);
    await settle();
    const controls = fakes.materialize.mock.calls[0]![1].controls;
    const values: string[] = [];
    const listener: EventListener = (event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.source === root) values.push(detail.adapter);
    };
    document.addEventListener('proto-adapter:change', listener);
    preferenceListeners.push(listener);
    const published = () => values;
    return { root, controls, published };
  }
  async function pending() {
    const current = await begin();
    const gate = deferred<ReturnType<typeof candidate>>();
    fakes.materialize.mockImplementationOnce(() => gate.promise);
    current.controls.runtime.onValueChange('react');
    await settle();
    expect(current.published()).toEqual([]);
    expect(localStorage.getItem('preferred-prototypes-adapter')).toBe('wc');
    return { ...current, gate };
  }
  for (const axis of ['family', 'component'] as const) {
    it(`carries user intent through a superseding ${axis} coordinator request exactly once`, async () => {
      const { root, controls, published, gate } = await pending();
      try {
        // Component is a coordinator callback boundary; the current homepage
        // does not expose an additional component picker to native users.
        controls[axis].onValueChange(axis === 'family' ? 'brutalist' : 'switch');
        await settle();
        expect(root.dataset.runtimeState).toBe('ready');
        expect(handle!.getSnapshot().selection.runtimeId).toBe('react');
        expect(localStorage.getItem('preferred-prototypes-adapter')).toBe('react');
        expect(published()).toEqual(['react']);
        gate.resolve(candidate());
        await settle();
        expect(published()).toEqual(['react']);
      } finally {
        gate.resolve(candidate());
      }
    });
  }
  it('discards a never-committed intent after superseding failure and does not publish it on a later family success', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { root, controls, published, gate } = await pending();
    try {
      fakes.materialize.mockRejectedValueOnce(new Error('family preparation failed'));
      controls.family.onValueChange('brutalist');
      await settle();
      expect(root.dataset.runtimeState).toBe('error');
      expect(handle!.getSnapshot().selection.runtimeId).toBe('wc');
      gate.resolve(candidate());
      await settle();
      controls.family.onValueChange('brutalist');
      await settle();
      expect(root.dataset.runtimeState).toBe('ready');
      expect(localStorage.getItem('preferred-prototypes-adapter')).toBe('wc');
      expect(published()).toEqual([]);
    } finally {
      gate.resolve(candidate());
    }
  });
  it('retains the one pending intent across repeated same-runtime selections', async () => {
    const { controls, published, gate } = await pending();
    try {
      const count = fakes.materialize.mock.calls.length;
      controls.runtime.onValueChange('react');
      expect(fakes.materialize.mock.calls).toHaveLength(count);
      controls.family.onValueChange('brutalist');
      await settle();
      controls.runtime.onValueChange('react');
      gate.resolve(candidate());
      await settle();
      expect(published()).toEqual(['react']);
    } finally {
      gate.resolve(candidate());
    }
  });
  it('replaces pending intent when the user explicitly selects the old runtime again', async () => {
    const { controls, published, gate } = await pending();
    try {
      controls.runtime.onValueChange('wc');
      await settle();
      gate.resolve(candidate());
      await settle();
      expect(handle!.getSnapshot().selection.runtimeId).toBe('wc');
      expect(localStorage.getItem('preferred-prototypes-adapter')).toBe('wc');
      expect(published()).toEqual(['wc']);
    } finally {
      gate.resolve(candidate());
    }
  });
  it('does not publish after teardown or resurrect late pending candidates', async () => {
    const { published, gate } = await pending();
    const destruction = handle!.destroy();
    gate.resolve(candidate());
    await destruction;
    handle = undefined;
    await settle();
    expect(localStorage.getItem('preferred-prototypes-adapter')).toBe('wc');
    expect(published()).toEqual([]);
  });
  it('still notifies the document once if optional preference storage throws', async () => {
    const { controls, published, gate } = await pending();
    try {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('storage blocked');
      });
      controls.family.onValueChange('brutalist');
      await settle();
      expect(handle!.getSnapshot().selection.runtimeId).toBe('react');
      expect(published()).toEqual(['react']);
    } finally {
      gate.resolve(candidate());
    }
  });
  it('does not republish an external adapter request as a pending homepage choice', async () => {
    const { controls, published, gate } = await pending();
    try {
      document.dispatchEvent(
        new CustomEvent('proto-adapter:change', { detail: { adapter: 'vue' } })
      );
      await settle();
      controls.family.onValueChange('brutalist');
      await settle();
      expect(handle!.getSnapshot().selection.runtimeId).toBe('vue');
      expect(published()).toEqual([]);
      expect(localStorage.getItem('preferred-prototypes-adapter')).toBe('wc');
    } finally {
      gate.resolve(candidate());
    }
  });
  it('publishes only the already-committed runtime retained by a later failed family request', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const retired = deferred<void>();
    const old = candidate();
    old.dispose.mockImplementation(() => retired.promise);
    fakes.materialize.mockResolvedValueOnce(old);
    const { root, controls, published } = await begin();
    try {
      controls.runtime.onValueChange('react');
      await settle();
      expect(handle!.getSnapshot().phase).toBe('ready');
      expect(handle!.getSnapshot().selection.runtimeId).toBe('react');
      expect(published()).toEqual([]);
      fakes.materialize.mockRejectedValueOnce(new Error('later family failed'));
      controls.family.onValueChange('brutalist');
      await settle();
      expect(root.dataset.runtimeState).toBe('error');
      expect(handle!.getSnapshot().selection).toEqual({
        runtimeId: 'react',
        projectionFamilyId: 'shadcn',
      });
      expect(localStorage.getItem('preferred-prototypes-adapter')).toBe('react');
      expect(published()).toEqual(['react']);
      retired.resolve();
      await settle();
      expect(published()).toEqual(['react']);
    } finally {
      retired.resolve();
    }
  });
});

it('reads one page-owned theme before updating nested language/social candidates', async () => {
  const root = fixture();
  const language = document.createElement('div');
  language.id = 'language';
  language.dataset.homepageActions = '';
  language.innerHTML =
    '<div data-homepage-fallback><a href="/en/">English</a></div><div data-homepage-mount></div>';
  const oldSurface = document.createElement('div');
  oldSurface.style.setProperty('--pui-background', '#fff');
  oldSurface.append(language);
  root.append(oldSurface);
  let dark = false;
  // Model a retained projected shell's old, explicit theme. This test isolates
  // coordinator ownership; the browser lane verifies actual CSS and paint.
  fakes.resolveTheme.mockImplementation((_family, scope) => ({
    '--pui-background': scope === language ? '#fff' : dark ? '#111' : '#fff',
    '--pui-foreground': scope === language ? '#111' : dark ? '#fff' : '#111',
  }));
  handle = initHomepageRuntime(root);
  await settle();
  const candidates = await Promise.all(fakes.materialize.mock.results.map((r) => r.value));
  const generation = handle!.getSnapshot().generation;
  const shadcnWatch = fakes.watchTheme.mock.calls.find(([family]) => family === 'shadcn')!;
  for (const next of [true, false, true]) {
    dark = next;
    shadcnWatch[2]();
    for (const candidate of candidates)
      expect(candidate.setThemeSurfaceStyle).toHaveBeenLastCalledWith({
        '--pui-background': dark ? '#111' : '#fff',
        '--pui-foreground': dark ? '#fff' : '#111',
      });
    expect(handle!.getSnapshot().generation).toBe(generation);
  }
});
