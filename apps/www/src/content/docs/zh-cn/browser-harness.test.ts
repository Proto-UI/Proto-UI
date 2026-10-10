import type { Locator, Page } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  choosePreviewRuntime,
  runtimeSelectTrigger,
  selectRuntime,
  startServer,
  waitForPreviewRuntime,
} from './browser-harness';

describe('runtime evidence counts the original demonstrated slot', () => {
  afterEach(() => document.body.replaceChildren());
  async function observed(runtime: 'wc' | 'react' | 'vue' | 'vue2') {
    let result: boolean | undefined;
    const page = {
      locator: (selector: string) =>
        fixtureLocator(
          () => Array.from(document.querySelectorAll<HTMLElement>(selector)),
          selector
        ),
      waitForFunction: async (
        predicate: (args: unknown) => boolean,
        args: unknown,
        options: unknown
      ) => {
        expect(options).toEqual({ timeout: 20_000 });
        result = predicate(args);
      },
    } as unknown as Page;
    await waitForPreviewRuntime(page, runtime, '[data-pui-root]', 2);
    return result;
  }
  function mount(runtime: 'wc' | 'react' | 'vue' | 'vue2') {
    const tag = runtime === 'wc' ? 'wc-test-command' : 'div';
    document.body.innerHTML = `<div data-previewer-id="test" data-projection-mode="fixed-family" data-projection-toolbar="false">
      <div class="host"><div data-projection-scope data-projection-runtime="${runtime}" data-projection-state="ready">
        <div data-projection-content><div class="pui-runtime-preview-surface" data-demo-ref="__website_runtime_preview_surface__" data-pui-root>
          <div data-original-demo ${runtime === 'vue' ? 'data-v-app' : ''}><${tag} data-pui-root></${tag}><${tag} data-pui-root></${tag}></div>
        </div></div>
      </div></div></div>`;
    Object.assign(document.querySelector('[data-previewer-id]')!, {
      __previewer__: { getCurrentRuntime: () => runtime },
    });
    if (runtime === 'react')
      Object.assign(document.querySelector('.pui-runtime-preview-surface')!, {
        '__reactFiber$fixture': {},
      });
    if (runtime === 'vue2')
      Object.assign(document.querySelector('[data-original-demo] [data-pui-root]')!, {
        __vue__: {},
      });
  }
  it('does not admit a generic renderer until its public commit and passive shell both exist', async () => {
    mount('react');
    const root = document.querySelector<HTMLElement>('[data-previewer-id]')!;
    delete root.dataset.projectionMode;
    const select = document.createElement('div');
    select.dataset.adapterSelectRoot = '';
    select.dataset.value = 'react';
    select.innerHTML = '<button role="combobox" aria-controls="legacy-options">React</button>';
    root.append(select);
    let committed: string | null = null;
    Object.assign(root, { __previewer__: { getCurrentRuntime: () => committed } });
    const surface = root.querySelector<HTMLElement>('.pui-runtime-preview-surface')!;
    root.querySelector('.host')!.replaceChildren(surface);
    const original = surface.firstElementChild!;
    surface.replaceWith(original);
    expect(await observed('react')).toBe(false);
    original.replaceWith(surface);
    surface.append(original);
    expect(await observed('react')).toBe(false);
    committed = 'react';
    expect(await observed('react')).toBe(true);
    committed = 'vue';
    expect(await observed('react')).toBe(false);
  });
  it('keeps the remaining-component paint measurements on the same original slot', () => {
    const source = readFileSync(
      'apps/www/src/content/docs/zh-cn/demo-brutalist-remaining.browser.test.ts',
      'utf8'
    );
    const selector = source.match(
      /function roots\(previewer: Locator\): Locator \{\s*return previewer\.locator\(\s*'([^']+)'/
    )?.[1];
    expect(selector).toBeTruthy();
    mount('wc');
    const root = document.querySelector('[data-previewer-id]')!;
    expect(root.querySelectorAll(selector!)).toHaveLength(2);
    const slot = root.querySelector('[data-original-demo]')!;
    slot.append(slot.firstElementChild!.cloneNode());
    expect(root.querySelectorAll(selector!)).toHaveLength(3);
    expect(source).not.toContain("'[data-projection-content] [data-pui-root]'");
  });
  it.each(['demo-brutalist-controls', 'demo-brutalist-button'])(
    'keeps %s private physical-root selectors inside the demonstrated slot',
    (name) => {
      const source = readFileSync(
        `apps/www/src/content/docs/zh-cn/${name}.browser.test.ts`,
        'utf8'
      );
      const selectors = [
        ...source.matchAll(
          /'([^'\n]*\[data-projection-content\][^'\n]*\[data-pui-root\][^'\n]*)'/g
        ),
      ].map((match) => match[1]!);
      expect(selectors.length).toBeGreaterThan(0);
      mount('wc');
      const root = document.querySelector('[data-previewer-id]')!;
      for (const selector of selectors) {
        expect(selector).toContain(
          '.pui-runtime-preview-surface[data-demo-ref="__website_runtime_preview_surface__"]'
        );
        expect(document.querySelectorAll(selector)).toHaveLength(2);
      }
      root.querySelector('[data-original-demo]')!.append(document.createElement('div'));
      root
        .querySelector('[data-original-demo]')!
        .lastElementChild!.setAttribute('data-pui-root', '');
      for (const selector of selectors) expect(document.querySelectorAll(selector)).toHaveLength(3);
    }
  );
  it.each(['wc', 'react', 'vue', 'vue2'] as const)(
    'retains exact %s owner and two original roots',
    async (runtime) => {
      mount(runtime);
      expect(await observed(runtime)).toBe(true);
    }
  );
  it.each([
    'missing',
    'extra-inside',
    'extra-outside',
    'duplicate-boundary',
    'wrong-owner',
    'unmarked-boundary',
    'not-ready',
  ] as const)('rejects %s without increasing the expected root count', async (mutation) => {
    mount('wc');
    const content = document.querySelector('[data-projection-content]')!;
    const surface = content.firstElementChild!;
    const slot = document.querySelector('[data-original-demo]')!;
    if (mutation === 'missing') slot.firstElementChild!.remove();
    if (mutation === 'extra-inside') slot.append(slot.firstElementChild!.cloneNode());
    if (mutation === 'extra-outside') content.append(slot.firstElementChild!.cloneNode());
    if (mutation === 'duplicate-boundary') content.append(surface.cloneNode(true));
    if (mutation === 'wrong-owner')
      slot.innerHTML = '<div data-pui-root></div><div data-pui-root></div>';
    if (mutation === 'unmarked-boundary') surface.removeAttribute('data-demo-ref');
    if (mutation === 'not-ready')
      document.querySelector<HTMLElement>('[data-projection-scope]')!.dataset.projectionState =
        'preparing';
    expect(await observed('wc')).toBe(false);
  });
});

/** DOM-only Locator double: exercises selectors and serialized predicates, not native input. */
function fixtureLocator(resolve: () => HTMLElement[], selector?: string): Locator {
  const one = () => {
    const nodes = resolve();
    if (nodes.length !== 1) throw new Error(`Expected one fixture target, got ${nodes.length}`);
    return nodes[0]!;
  };
  const locator = {
    nodes: resolve,
    selector,
    page: () => observedPage().page,
    or: (other: Locator) =>
      fixtureLocator(() => [
        ...new Set([...resolve(), ...(other as unknown as { nodes(): HTMLElement[] }).nodes()]),
      ]),
    filter: ({ hasNot }: { hasNot: Locator }) =>
      fixtureLocator(() =>
        resolve().filter(
          (root) => !root.querySelector((hasNot as unknown as { selector: string }).selector)
        )
      ),
    locator: (selector: string) =>
      fixtureLocator(() =>
        resolve().flatMap((root) => Array.from(root.querySelectorAll<HTMLElement>(selector)))
      ),
    first: () => fixtureLocator(() => resolve().slice(0, 1)),
    and: (other: Locator) =>
      fixtureLocator(() =>
        resolve().filter((node) =>
          (other as unknown as { nodes(): HTMLElement[] }).nodes().includes(node)
        )
      ),
    getByRole: (role: string, options: { name?: string; exact?: boolean } = {}) =>
      fixtureLocator(() =>
        resolve()
          .flatMap((root) => Array.from(root.querySelectorAll<HTMLElement>(`[role="${role}"]`)))
          .filter((node) => options.name === undefined || node.textContent?.trim() === options.name)
      ),
    count: async () => resolve().length,
    waitFor: async () => {
      one();
    },
    getAttribute: async (name: string) => one().getAttribute(name),
    click: async () => one().click(),
    evaluate: async (predicate: (node: HTMLElement) => unknown) => predicate(one()),
  };
  return locator as unknown as Locator;
}
function locatorFor(root: HTMLElement): Locator {
  return fixtureLocator(() => [root]);
}
function observedPage() {
  let result: boolean | undefined;
  const page = {
    locator: (selector: string) =>
      fixtureLocator(() => Array.from(document.querySelectorAll<HTMLElement>(selector)), selector),
    waitForFunction: async (
      predicate: (args: unknown) => boolean,
      args: unknown,
      options: unknown
    ) => {
      expect(options).toEqual({ timeout: 20_000 });
      result = predicate(args);
    },
  } as unknown as Page;
  return { page, result: () => result };
}
const runtimeLabels = { wc: 'Web Components', react: 'React', vue: 'Vue', vue2: 'Vue 2' };
type Runtime = keyof typeof runtimeLabels;
function mountRuntime(
  shell: 'fixed' | 'generic' | 'legacy',
  runtime: Runtime = 'react',
  id = 'fixture'
) {
  const root = document.createElement('section');
  root.dataset.previewerId = id;
  const tag = runtime === 'wc' ? 'wc-test-root' : 'div';
  const tabs = Object.entries(runtimeLabels)
    .map(
      ([value, label]) =>
        `<button role="tab" data-runtime-tab="${value}" aria-selected="${value === runtime}">${label}</button>`
    )
    .join('');
  const surface = `<div class="pui-runtime-preview-surface" data-demo-ref="__website_runtime_preview_surface__" data-pui-root><${tag} data-pui-root data-ready></${tag}></div>`;
  if (shell === 'fixed') {
    root.dataset.projectionMode = 'fixed-family';
    root.innerHTML = `<div class="host"><div data-projection-generation-state="active"><div data-projection-scope data-projection-runtime="${runtime}" data-projection-state="ready"><div data-projection-control="runtime" data-runtime-tabs><div role="tablist">${tabs}</div></div><div data-projection-content>${surface}</div></div></div></div>`;
  } else if (shell === 'generic') {
    root.innerHTML = `<div data-runtime-tabs-mount><div data-runtime-tabs-root aria-busy="false"><div role="tablist">${tabs}</div><div role="tabpanel"><div class="host">${surface}</div></div></div></div>`;
  } else {
    root.innerHTML = `<div data-adapter-select-root data-value="${runtime}"><button role="combobox" aria-controls="${id}-options">${runtimeLabels[runtime]}</button></div><div class="host">${surface}</div>`;
  }
  document.body.append(root);
  const first = root.querySelector<HTMLElement>('[data-ready]')!;
  if (runtime === 'react')
    Object.assign(root.querySelector('.pui-runtime-preview-surface')!, {
      '__reactFiber$fixture': {},
    });
  if (runtime === 'vue') root.querySelector('.host')!.setAttribute('data-v-app', '');
  if (runtime === 'vue2') Object.assign(first, { __vue__: {} });
  let committed: string | null = runtime;
  Object.assign(root, { __previewer__: { getCurrentRuntime: () => committed } });
  const observed = observedPage();
  const check = async () => {
    await waitForPreviewRuntime(observed.page, runtime, '[data-ready]', 1);
    return observed.result();
  };
  return {
    root,
    check,
    committed: (value: string | null) => {
      committed = value;
    },
  };
}

describe('documentation runtime control locator', () => {
  afterEach(() => document.body.replaceChildren());
  it.each(['shadcn', 'brutalist'])(
    'retains the actual %s Header runtime Select, not language',
    async (family) => {
      const root = document.createElement('header');
      root.innerHTML = `<wc-${family}-select-root data-language-select-root><button role="combobox" data-control="language"></button></wc-${family}-select-root><wc-${family}-select-root data-adapter-select-root><button role="combobox" data-control="runtime" aria-controls="options"></button></wc-${family}-select-root>`;
      document.body.append(root);
      expect(await runtimeSelectTrigger(locatorFor(root)).getAttribute('data-control')).toBe(
        'runtime'
      );
      const options = document.createElement('div');
      options.id = 'options';
      options.innerHTML = '<button role="option">React</button>';
      document.body.append(options);
      const click = vi.fn();
      options.firstElementChild!.addEventListener('click', click);
      await choosePreviewRuntime(observedPage().page, locatorFor(root), 'react');
      expect(click).toHaveBeenCalledOnce();
    }
  );
  it('keeps legacy fixed-family runtime controls separate from component Selects', async () => {
    const root = document.createElement('div');
    root.innerHTML =
      '<div data-projection-control="component"><button role="combobox" data-control="component"></button></div><div data-projection-control="runtime"><button role="combobox" data-control="runtime"></button></div>';
    expect(await runtimeSelectTrigger(locatorFor(root)).getAttribute('data-control')).toBe(
      'runtime'
    );
  });
  it.each(['fixed', 'generic'] as const)(
    '%s selects a real named Runtime Tab and uses the selected tab as the focus anchor',
    async (shell) => {
      const fixture = mountRuntime(shell);
      const decoy = document.createElement('button');
      decoy.setAttribute('role', 'tab');
      decoy.textContent = 'Vue';
      fixture.root.querySelector('.host')!.append(decoy);
      const target = fixture.root.querySelector('[data-runtime-tab="vue"]')!;
      const click = vi.fn();
      target.addEventListener('click', click);
      await choosePreviewRuntime(observedPage().page, locatorFor(fixture.root), 'vue');
      expect(click).toHaveBeenCalledOnce();
      expect(
        await runtimeSelectTrigger(locatorFor(fixture.root)).getAttribute('data-runtime-tab')
      ).toBe('react');
    }
  );
  it.each([
    'data-runtime-tabs-mount',
    'data-runtime-tabs-root',
    'data-runtime-tabs',
    'data-runtime-tab',
  ])(
    'never falls back to legacy Select when %s exists without a usable Tabs shell',
    async (marker) => {
      const fixture = mountRuntime('legacy');
      const pending = document.createElement('div');
      pending.setAttribute(marker, '');
      fixture.root.append(pending);
      const click = vi.fn();
      fixture.root.querySelector('[role="combobox"]')!.addEventListener('click', click);
      await expect(
        choosePreviewRuntime(observedPage().page, locatorFor(fixture.root), 'react')
      ).rejects.toThrow();
      expect(click).not.toHaveBeenCalled();
      expect(await fixture.check()).toBe(false);
    }
  );
});

describe('runtime readiness rejects uncommitted or unrelated shells', () => {
  afterEach(() => document.body.replaceChildren());
  for (const shell of ['fixed', 'generic', 'legacy'] as const) {
    it.each(['wc', 'react', 'vue', 'vue2'] as const)(
      `${shell} accepts a committed %s with exact original controls`,
      async (runtime) => {
        expect(await mountRuntime(shell, runtime).check()).toBe(true);
      }
    );
  }
  for (const shell of ['fixed', 'generic'] as const) {
    it.each([
      'busy',
      'inert',
      'hidden',
      'disabled',
      'unselected',
      'duplicate-selected',
      'wrong-label',
      'wrong-framework',
      'duplicate-surface',
      'extra-root',
      'missing-target',
      'startup',
      'mismatched-shell',
    ] as const)(`${shell} rejects %s`, async (mutation) => {
      const fixture = mountRuntime(shell);
      const root = fixture.root;
      const control = root.querySelector<HTMLElement>(
        shell === 'fixed' ? '[data-runtime-tabs]' : '[data-runtime-tabs-root]'
      )!;
      const tab = root.querySelector<HTMLElement>('[data-runtime-tab="react"]')!;
      const surface = root.querySelector('.pui-runtime-preview-surface')!;
      if (mutation === 'busy') control.setAttribute('aria-busy', 'true');
      if (mutation === 'inert') root.querySelector('.host')!.setAttribute('inert', '');
      if (mutation === 'hidden') surface.setAttribute('hidden', '');
      if (mutation === 'disabled') tab.setAttribute('aria-disabled', 'true');
      if (mutation === 'unselected') tab.setAttribute('aria-selected', 'false');
      if (mutation === 'duplicate-selected')
        root.querySelector('[data-runtime-tab="wc"]')!.setAttribute('aria-selected', 'true');
      if (mutation === 'wrong-label') tab.textContent = 'Vue';
      if (mutation === 'wrong-framework') {
        delete (surface as any)['__reactFiber$fixture'];
        Object.assign(root.querySelector('[data-ready]')!, { __vue__: {} });
      }
      if (mutation === 'duplicate-surface') surface.after(surface.cloneNode(true));
      if (mutation === 'extra-root') {
        const extra = document.createElement('div');
        extra.setAttribute('data-pui-root', '');
        surface.after(extra);
      }
      if (mutation === 'missing-target') root.querySelector('[data-ready]')!.remove();
      if (mutation === 'startup')
        root.querySelector('.host')!.setAttribute('data-previewer-startup-pending', '');
      if (mutation === 'mismatched-shell')
        root.dataset.projectionMode = shell === 'generic' ? 'fixed-family' : 'generic';
      expect(await fixture.check()).toBe(false);
    });
    it(`${shell} does not admit an uncommitted runtime`, async () => {
      const fixture = mountRuntime(shell);
      if (shell === 'fixed')
        fixture.root
          .querySelector('[data-projection-scope]')!
          .setAttribute('data-projection-state', 'preparing');
      else fixture.committed(null);
      expect(await fixture.check()).toBe(false);
    });
  }
  it('observes an explicitly toolbar=false committed fixed projection', async () => {
    const fixture = mountRuntime('fixed');
    fixture.root.dataset.projectionToolbar = 'false';
    fixture.root.querySelector('[data-runtime-tabs]')!.remove();
    expect(await fixture.check()).toBe(true);
    fixture.root
      .querySelector('[data-projection-scope]')!
      .setAttribute('data-projection-state', 'preparing');
    expect(await fixture.check()).toBe(false);
  });
  for (const toolbar of [true, false]) {
    it.each(['null', 'wrong-runtime', 'missing-controller', 'missing-getter'] as const)(
      `fixed toolbar=${toolbar} rejects %s despite ready scope and selected React`,
      async (mutation) => {
        const fixture = mountRuntime('fixed');
        if (!toolbar) {
          fixture.root.dataset.projectionToolbar = 'false';
          fixture.root.querySelector('[data-runtime-tabs]')!.remove();
        }
        expect(await fixture.check()).toBe(true);
        if (mutation === 'null') fixture.committed(null);
        if (mutation === 'wrong-runtime') fixture.committed('vue');
        if (mutation === 'missing-controller') delete (fixture.root as any).__previewer__;
        if (mutation === 'missing-getter') (fixture.root as any).__previewer__ = {};
        expect(await fixture.check()).toBe(false);
      }
    );
  }
  it('selectRuntime checks its exact previewer instead of accepting a ready first previewer', async () => {
    mountRuntime('generic', 'react', 'decoy');
    const target = mountRuntime('generic', 'react', 'target');
    target.committed(null);
    const observed = observedPage();
    await selectRuntime(observed.page, locatorFor(target.root), 'react', '[data-ready]', 1);
    expect(observed.result()).toBe(false);
    target.committed('react');
    await selectRuntime(observed.page, locatorFor(target.root), 'react', '[data-ready]', 1);
    expect(observed.result()).toBe(true);
  });
});

describe('shared Runtime selector compatibility boundaries', () => {
  afterEach(() => document.body.replaceChildren());
  it('keeps a Header Select usable when a different previewer declares Tabs', async () => {
    mountRuntime('generic', 'react', 'other');
    const root = document.createElement('header');
    root.innerHTML =
      '<div data-adapter-select-root><button role="combobox" aria-controls="header-options">Web Components</button></div>';
    const options = document.createElement('div');
    options.id = 'header-options';
    options.innerHTML = '<button role="option">Vue</button>';
    document.body.append(root, options);
    const click = vi.fn();
    options.firstElementChild!.addEventListener('click', click);
    await choosePreviewRuntime(observedPage().page, locatorFor(root), 'vue');
    expect(click).toHaveBeenCalledOnce();
  });
  it('retains an actual legacy fixed-family Select and does not substitute body options without aria-controls', async () => {
    const fixture = mountRuntime('fixed');
    const control = fixture.root.querySelector('[data-runtime-tabs]')!;
    control.removeAttribute('data-runtime-tabs');
    control.innerHTML = '<button role="combobox">React</button>';
    expect(await fixture.check()).toBe(true);
    const decoy = document.createElement('button');
    decoy.setAttribute('role', 'option');
    decoy.textContent = 'React';
    document.body.append(decoy);
    const click = vi.fn();
    decoy.addEventListener('click', click);
    await expect(
      choosePreviewRuntime(observedPage().page, locatorFor(fixture.root), 'react')
    ).rejects.toThrow('no controlled option surface');
    expect(click).not.toHaveBeenCalled();
  });
  it.each([
    'duplicate-controls',
    'no-selected',
    'duplicate-selected',
    'wrong-value',
    'wrong-label',
    'pending-scope',
  ] as const)('does not choose a legacy decoy when Tabs are %s', async (mutation) => {
    const fixture = mountRuntime(mutation === 'pending-scope' ? 'fixed' : 'generic');
    const selected = fixture.root.querySelector('[data-runtime-tab="react"]')!;
    if (mutation === 'duplicate-controls') {
      const controls = fixture.root.querySelector('[data-runtime-tabs-root]')!;
      controls.after(controls.cloneNode(true));
    }
    if (mutation === 'no-selected') selected.setAttribute('aria-selected', 'false');
    if (mutation === 'duplicate-selected')
      fixture.root.querySelector('[data-runtime-tab="vue"]')!.setAttribute('aria-selected', 'true');
    if (mutation === 'wrong-value') selected.setAttribute('data-runtime-tab', 'wrong');
    if (mutation === 'wrong-label') selected.textContent = 'Wrong';
    if (mutation === 'pending-scope')
      fixture.root
        .querySelector('[data-projection-scope]')!
        .setAttribute('data-projection-state', 'preparing');
    const legacy = document.createElement('div');
    legacy.dataset.adapterSelectRoot = '';
    legacy.innerHTML = '<button role="combobox">React</button>';
    fixture.root.prepend(legacy);
    const click = vi.fn();
    legacy.firstElementChild!.addEventListener('click', click);
    await expect(
      choosePreviewRuntime(observedPage().page, locatorFor(fixture.root), 'react')
    ).rejects.toThrow();
    expect(click).not.toHaveBeenCalled();
    expect(await fixture.check()).toBe(false);
  });
  it.each([
    'staging',
    'error',
    'duplicate-id',
    'duplicate-host',
    'unowned-react',
    'wrong-runtime',
    'css-hidden',
  ] as const)('rejects %s with otherwise correct selected state', async (mutation) => {
    const fixture = mountRuntime('fixed');
    const root = fixture.root;
    if (mutation === 'staging')
      root
        .querySelector('[data-projection-generation-state]')!
        .setAttribute('data-projection-generation-state', 'staging');
    if (mutation === 'error')
      root.querySelector('[data-projection-scope]')!.setAttribute('data-projection-state', 'error');
    if (mutation === 'duplicate-id') root.after(root.cloneNode(true));
    if (mutation === 'duplicate-host') root.append(root.querySelector('.host')!.cloneNode(true));
    if (mutation === 'unowned-react')
      delete (root.querySelector('.pui-runtime-preview-surface') as any)['__reactFiber$fixture'];
    if (mutation === 'wrong-runtime')
      root.querySelector('[data-projection-scope]')!.setAttribute('data-projection-runtime', 'vue');
    if (mutation === 'css-hidden') root.style.display = 'none';
    expect(await fixture.check()).toBe(false);
  });
  it('keeps the original popup, generation, paint and native drag-selection assertions after replacing only the Runtime locator', () => {
    const surface = readFileSync(
      'apps/www/src/content/docs/zh-cn/runtime-preview-surface.browser.test.ts',
      'utf8'
    );
    expect(surface).toContain(".getByRole('tab', { name: 'React', exact: true })");
    expect(surface).toContain("await trigger.press('Enter')");
    expect(surface).toContain(
      "await demoPopup.getByRole('option', { name: 'Ink', exact: true }).click()"
    );
    expect(surface).toContain("connected: true, text: 'Ink', expanded: 'false', popupHidden: true");
    expect(surface).toContain(').toBe(generation)');
    expect(surface).toContain('runtimePreviewEvidenceIssues(await measure(root');
    expect(surface).toContain('timeout: 45000');
    const draft = readFileSync(
      'apps/www/src/content/docs/zh-cn/demo-select-draft-projections.browser.test.ts',
      'utf8'
    );
    expect(draft).toContain('const trigger = runtimeSelectTrigger(previewer)');
    expect(draft).toContain("getComputedStyle(node).userSelect)).toBe('none')");
    expect(draft).toContain('await page.mouse.down()');
    expect(draft).toContain('await page.mouse.up()');
    expect(draft).toContain("getSelection()?.toString() ?? '')).toBe('')");
  });
});

// Same installed-framework substitutions as the existing projection integration
// suite. These checks observe real adapter ownership; no DOM ownership markers are injected.
vi.mock('../../../components/PrototypePreviewer/runtimes/react-runtime', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/packages/adapters/react/package.json');
  return {
    loadReact: async () => ({
      React: require('react'),
      ReactDOM: { ...require('react-dom'), ...require('react-dom/client') },
    }),
  };
});
vi.mock('../../../components/PrototypePreviewer/runtimes/vue-runtime', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/apps/www/package.json');
  return { loadVue: async () => require('vue') };
});
vi.mock('../../../components/PrototypePreviewer/runtimes/vue2-runtime', async (original) => {
  const current =
    await original<typeof import('../../../components/PrototypePreviewer/runtimes/vue2-runtime')>();
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/packages/adapters/vue2/package.json');
  return { ...current, loadVue2: async () => require('vue') };
});
describe('shared readiness with the actual installed adapters, emulated DOM only', () => {
  const cleanup: Array<() => Promise<void> | void> = [];
  afterEach(async () => {
    for (const destroy of cleanup.splice(0)) await destroy();
    document.body.replaceChildren();
    localStorage.clear();
  });
  for (const shell of ['fixed', 'generic'] as const) {
    it.each(['wc', 'react', 'vue', 'vue2'] as const)(
      `${shell} observes committed %s and rejects its subsequent host lock`,
      async (runtime) => {
        const { initPreviewer } =
          await import('../../../components/PrototypePreviewer/previewer-client');
        const { initProjectedPreviewer } =
          await import('../../../components/PrototypePreviewer/projected-previewer-client');
        const { SHADCN_THEME_CSS } = await import('../../../../../../packages/cli/src/legacy/type');
        const { renderPrefixedThemeCss } =
          await import('../../../../../../packages/cli/src/services/proto-style-css');
        const root = document.createElement('section');
        root.dataset.previewerId = `real-${shell}-${runtime}`;
        if (shell === 'fixed') root.dataset.projectionMode = 'fixed-family';
        root.innerHTML =
          shell === 'generic'
            ? '<div data-runtime-tabs-mount></div><div data-panel="preview"><div class="host"></div></div>'
            : '<div class="host"></div>';
        for (const match of renderPrefixedThemeCss(SHADCN_THEME_CSS)
          .split('}')[0]!
          .matchAll(/(--pui-[\w-]+):\s*([^;]+);/g)) {
          root.style.setProperty(match[1]!, match[2]!);
          root.querySelector<HTMLElement>('.host')!.style.setProperty(match[1]!, match[2]!);
        }
        document.body.append(root);
        cleanup.push(() => (root as any).__previewer__?.destroy());
        if (shell === 'generic')
          initPreviewer({
            root,
            prototypeId: 'shadcn-button',
            initialRuntime: runtime,
            runtimeList: ['wc', 'react', 'vue', 'vue2'],
            demoProps: {},
          });
        else
          initProjectedPreviewer({
            root,
            initialRuntime: runtime,
            runtimeList: ['wc', 'react', 'vue', 'vue2'],
            projectionFamilyId: 'shadcn',
            componentId: 'button',
            toolbar: true,
          });
        const observed = observedPage();
        // The authored fixed demo has six Buttons (demo-shadcn-button.demo.ts).
        // The generic fixture mounts one directly requested shadcn-button.
        const expectedCount = shell === 'fixed' ? 6 : 1;
        await vi.waitFor(
          async () => {
            await waitForPreviewRuntime(observed.page, runtime, '[role="button"]', expectedCount);
            expect(observed.result()).toBe(true);
          },
          { timeout: 10_000 }
        );
        expect(await runtimeSelectTrigger(locatorFor(root)).getAttribute('aria-selected')).toBe(
          'true'
        );
        root.querySelector<HTMLElement>('.host')!.inert = true;
        await waitForPreviewRuntime(observed.page, runtime, '[role="button"]', expectedCount);
        expect(observed.result()).toBe(false);
      },
      20_000
    );
  }
});

describe('documentation server readiness diagnostics', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('accepts the observed 3.6s HTTP 200 response within the existing total budget', async () => {
    vi.useFakeTimers();
    vi.stubEnv('PROTO_UI_BROWSER_BASE_URL', 'http://documentation.test');
    // Native AbortSignal.timeout does not use Vitest's fake clock. Model its
    // real deadline so the old 2s abort remains a discriminating negative.
    vi.spyOn(AbortSignal, 'timeout').mockImplementation((delay) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), delay);
      return controller.signal;
    });
    const cancel = vi.fn().mockResolvedValue(undefined);
    const fetch = vi.fn(
      (_url, { signal }: RequestInit) =>
        new Promise((resolve, reject) => {
          const finish = () => {
            signal?.removeEventListener('abort', abort);
            clearTimeout(timer);
          };
          const abort = () => {
            finish();
            reject(signal?.reason);
          };
          const timer = setTimeout(() => {
            finish();
            resolve({ ok: true, status: 200, statusText: 'OK', body: { cancel } });
          }, 3_600);
          signal?.addEventListener('abort', abort, { once: true });
        })
    );
    vi.stubGlobal('fetch', fetch);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = startServer('/ready/').catch((error: Error) => error);
    await vi.advanceTimersByTimeAsync(125_000);
    expect(await result).toBe('http://documentation.test');
    expect(fetch).toHaveBeenCalledOnce();
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('reports the last HTTP status immediately before rejecting the hook', async () => {
    vi.useFakeTimers();
    vi.stubEnv('PROTO_UI_BROWSER_BASE_URL', 'http://documentation.test');
    const cancel = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        body: { cancel },
      })
    );
    const output = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = startServer('/ready/').catch((error: Error) => error);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(await result).toMatchObject({
      message: expect.stringContaining('HTTP 503 Service Unavailable'),
    });
    expect(output).toHaveBeenCalledOnce();
    expect(output).toHaveBeenCalledWith(
      expect.stringContaining(
        '[browser-harness] readiness failed: Timed out waiting for http://documentation.test/ready/'
      )
    );
    expect(cancel).toHaveBeenCalled();
  });

  it('retains the latest connection error and cause instead of a prior HTTP response', async () => {
    vi.useFakeTimers();
    vi.stubEnv('PROTO_UI_BROWSER_BASE_URL', 'http://documentation.test');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Internal Server Error' })
        .mockRejectedValue(
          new TypeError('fetch failed', { cause: new Error('connect ECONNREFUSED 127.0.0.1:1234') })
        )
    );
    const output = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = startServer('/ready/').catch((error: Error) => error);
    await vi.advanceTimersByTimeAsync(120_000);
    const error = await result;
    expect(error).toMatchObject({
      message: expect.stringContaining(
        'TypeError: fetch failed; cause=Error: connect ECONNREFUSED'
      ),
    });
    expect(output).toHaveBeenCalledOnce();
  });

  it('releases an unused successful readiness response and does not report failure', async () => {
    vi.stubEnv('PROTO_UI_BROWSER_BASE_URL', 'http://documentation.test');
    const cancel = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK', body: { cancel } })
    );
    const output = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await startServer('/ready/')).toBe('http://documentation.test');
    expect(cancel).toHaveBeenCalledOnce();
    expect(output).not.toHaveBeenCalled();
  });
});
