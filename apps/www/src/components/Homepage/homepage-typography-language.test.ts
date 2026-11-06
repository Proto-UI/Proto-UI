import { afterAll, beforeAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { retainHappyDomMutationCallbacks } from '../../../../../scripts/test/happy-dom-mutation-keepalive.mjs';
import { PREFERRED_ADAPTER_KEY } from '../adapter-preference';
import { initHomepageRuntime } from './homepage-runtime-client';
import type { MaterializedProjectionCandidate } from '../PrototypePreviewer/projection-materializer';

type TypographyCandidate = MaterializedProjectionCandidate;
const preparation = vi.hoisted(() => ({
  next: null as null | ((candidate: TypographyCandidate) => Promise<TypographyCandidate>),
  count: 0,
}));
const loading = vi.hoisted(() => ({
  next: null as null | (() => Promise<void>),
}));
vi.mock('../site-typography', async (original) => {
  const actual = await original<typeof import('../site-typography')>();
  return {
    ...actual,
    siteTypographyParticipant(...args: Parameters<typeof actual.siteTypographyParticipant>) {
      const participant = actual.siteTypographyParticipant(...args);
      return {
        ...participant,
        async materialize(request: Parameters<typeof participant.materialize>[0]) {
          preparation.count++;
          const candidate = await participant.materialize(request);
          const next = preparation.next;
          preparation.next = null;
          return next ? next(candidate) : candidate;
        },
      };
    },
  };
});
// Pause at the earlier loading boundary, before the participant can finish
// preparing a language-refresh batch. The hold applies to the typography
// prototype load only, so no unrelated page participant is stalled.
vi.mock('../PrototypePreviewer/prototype-modules', async (original) => {
  const actual = await original<typeof import('../PrototypePreviewer/prototype-modules')>();
  return {
    ...actual,
    async loadPrototypes(ids: string[]) {
      const next = ids.some((id) => id.endsWith('-text-root')) ? loading.next : null;
      loading.next = null;
      await next?.();
      await actual.loadPrototypes(ids);
    },
  };
});
// The installed React package replaces only CDN acquisition; the renderer and
// adapter remain real. WC and Vue/Vue2 destroy coverage already exists in the
// four-adapter ownership suite.
vi.mock('../PrototypePreviewer/runtimes/react-runtime', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/packages/adapters/react/package.json');
  return {
    loadReact: async () => ({
      React: require('react'),
      ReactDOM: { ...require('react-dom'), ...require('react-dom/client') },
    }),
  };
});
vi.mock('../PrototypePreviewer/projection-theme', async (original) => {
  const actual = await original<typeof import('../PrototypePreviewer/projection-theme')>();
  return {
    ...actual,
    resolveProjectionThemeSurfaceStyle: () => ({ '--pui-background': '#fff' }),
    watchProjectionThemeSurfaceStyle: () => () => {},
  };
});
let observerKeeper: ReturnType<typeof retainHappyDomMutationCallbacks>;
beforeAll(() => {
  observerKeeper = retainHappyDomMutationCallbacks(window);
});
afterAll(() => observerKeeper.restore());
let handle: NonNullable<ReturnType<typeof initHomepageRuntime>> | undefined;
afterEach(async () => {
  await handle?.destroy();
  handle = undefined;
  document.body.replaceChildren();
  document.documentElement.removeAttribute('lang');
  localStorage.clear();
  vi.restoreAllMocks();
});
const note = () => document.querySelector<HTMLTextAreaElement>('[data-language-draft]')!;
const surface = () => document.querySelector('h1 [data-typography-prototype]')!;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { resolve, promise };
}
function holdNext() {
  const entered = deferred<TypographyCandidate>();
  const gate = deferred<void>();
  preparation.next = async (candidate) => {
    const wrapped = {
      ...candidate,
      activate: vi.fn(candidate.activate),
      dispose: vi.fn(candidate.dispose),
    };
    entered.resolve(wrapped);
    await gate.promise;
    return wrapped;
  };
  return { entered: entered.promise, release: () => gate.resolve() };
}
async function editPage() {
  handle = initHomepageRuntime(document.querySelector('[data-homepage-runtime]')!)!;
  await expect.poll(() => handle!.getSnapshot().phase).toBe('ready');
  const input = note();
  input.value = 'Keep my unsaved note';
  input.focus();
  input.setSelectionRange(5, 5);
  const summary = document.querySelector<HTMLInputElement>('[data-language-checked]')!;
  summary.checked = true;
  return {
    input,
    summary,
    owner: document.querySelector('[data-previewer-id]'),
    snapshot: handle!.getSnapshot(),
  };
}

// A focused host fixture: the real homepage coordinator, MutationObserver and
// WC public Text preserve authored native form state. It deliberately excludes
// the separate gallery integration suite and does not claim gallery acceptance.
// HappyDOM lacks :lang; only that host query is supplied below, not font/paint.
describe('homepage observes authored language changes without a page commit', () => {
  beforeEach(() => {
    localStorage.clear();
    preparation.next = null;
    preparation.count = 0;
    loading.next = null;
    const media = Object.assign(new EventTarget(), {
      matches: false,
      media: '(max-width: 47.999rem)',
      onchange: null,
    }) as MediaQueryList;
    vi.spyOn(window, 'matchMedia').mockReturnValue(media);
    document.body.innerHTML = `<header data-homepage-runtime>
      <output data-homepage-runtime-status></output>
      <div id="navigation" data-homepage-actions data-homepage-controls="runtime">
        <div data-homepage-fallback><a href="/docs/">Docs</a></div>
        <div data-homepage-mount></div>
      </div>
    </header><main><h1 data-site-typography="slogan">Stable original source</h1>
      <section data-previewer-id="authored-form-fixture">
        <textarea data-language-draft></textarea><input data-language-checked type="checkbox">
      </section></main>`;
    document.documentElement.lang = 'en';
    const nativeMatches = HTMLElement.prototype.matches;
    vi.spyOn(HTMLElement.prototype, 'matches').mockImplementation(function (
      this: HTMLElement,
      selector
    ) {
      if (selector !== ':lang(zh)') return nativeMatches.call(this, selector);
      const language = this.closest('[lang]')?.getAttribute('lang')?.toLowerCase() ?? '';
      return language === 'zh' || language.startsWith('zh-');
    });
  });

  for (const ancestor of ['html', 'main', 'h1'] as const) {
    it(`${ancestor} lang alone automatically refreshes the slogan and preserves native form state`, async () => {
      const before = await editPage();
      const h1 = document.querySelector('h1')!;
      const source = h1.querySelector('[data-site-typography-slot]')!.firstChild;
      await new Promise((resolve) => setTimeout(resolve, 100));
      const baseline = preparation.count;
      const target = document.querySelector<HTMLElement>(ancestor)!;
      target.lang = 'zh-CN';
      await expect.poll(() => surface().getAttribute('data-pui-style')).toContain('font-medium');
      expect(surface().getAttribute('data-pui-style')).toContain('tracking-normal');
      expect(surface().getAttribute('data-pui-style')).toContain('leading-tight');
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(preparation.count).toBe(baseline + 1);
      expect(h1.querySelector('[data-site-typography-slot]')!.firstChild).toBe(source);
      expect(handle!.getSnapshot()).toEqual(before.snapshot);
      expect(document.querySelector('[data-previewer-id]')).toBe(before.owner);
      expect(note()).toBe(before.input);
      expect(note().value).toBe('Keep my unsaved note');
      expect(note().selectionStart).toBe(5);
      expect(document.activeElement).toBe(before.input);
      expect(before.summary.checked).toBe(true);
      target.lang = 'en';
      await expect.poll(() => surface().getAttribute('data-pui-style')).toContain('font-semibold');
      expect(surface().getAttribute('data-pui-style')).toContain('leading-[1.1]');
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(preparation.count).toBe(baseline + 2);
      expect(h1.querySelector('[data-site-typography-slot]')!.firstChild).toBe(source);
      expect(handle!.getSnapshot()).toEqual(before.snapshot);
      expect(note()).toBe(before.input);
    });
  }

  it('an explicit English slogan overrides Chinese html until that override is removed', async () => {
    const h1 = document.querySelector('h1')!;
    h1.lang = 'en';
    const before = await editPage();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const baseline = preparation.count;
    const originalSurface = surface();
    document.documentElement.lang = 'zh-Hans';
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(preparation.count).toBe(baseline);
    expect(surface()).toBe(originalSurface);
    expect(surface().getAttribute('data-pui-style')).toContain('font-semibold');
    h1.removeAttribute('lang');
    await expect.poll(() => surface().getAttribute('data-pui-style')).toContain('font-medium');
    expect(preparation.count).toBe(baseline + 1);
    expect(handle!.getSnapshot()).toEqual(before.snapshot);
    expect(note()).toBe(before.input);
  });

  it('does not rebuild typography when only a non-slogan target changes language', async () => {
    const heading = document.createElement('h2');
    heading.textContent = 'Independent ordinary heading';
    document.querySelector('main')!.append(heading);
    const before = await editPage();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const baseline = preparation.count;
    const originalSurface = surface();
    const ordinarySurface = heading.querySelector('[data-typography-prototype]');
    heading.lang = 'zh-CN';
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(preparation.count).toBe(baseline);
    expect(surface()).toBe(originalSurface);
    expect(heading.querySelector('[data-typography-prototype]')).toBe(ordinarySurface);
    expect(handle!.getSnapshot()).toEqual(before.snapshot);
    expect(note()).toBe(before.input);
  });

  it('coalesces language changes during preparation without publishing the stale recipe', async () => {
    const before = await editPage();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const originalSurface = surface();
    const held = holdNext();
    document.documentElement.lang = 'zh-CN';
    const pending = await held.entered;
    document.documentElement.lang = 'en';
    held.release();
    await expect.poll(() => pending.dispose).toHaveBeenCalledOnce();
    expect(pending.activate).not.toHaveBeenCalled();
    expect(surface()).toBe(originalSurface);
    expect(surface().getAttribute('data-pui-style')).toContain('font-semibold');
    expect(handle!.getSnapshot()).toEqual(before.snapshot);
    expect(note()).toBe(before.input);
    document.documentElement.lang = 'zh-TW';
    await expect.poll(() => surface().getAttribute('data-pui-style')).toContain('font-medium');
    expect(handle!.getSnapshot()).toEqual(before.snapshot);
    expect(note()).toBe(before.input);
  });

  it('destroy retires a pending language refresh and ignores later language changes', async () => {
    const before = await editPage();
    const h1 = document.querySelector('h1')!;
    const source = h1.querySelector('[data-site-typography-slot]')!.firstChild;
    await new Promise((resolve) => setTimeout(resolve, 100));
    const held = holdNext();
    document.documentElement.lang = 'zh-CN';
    const pending = await held.entered;
    const destroyed = handle!.destroy();
    held.release();
    await destroyed;
    handle = undefined;
    expect(pending.activate).not.toHaveBeenCalled();
    expect(pending.dispose).toHaveBeenCalledOnce();
    expect(document.querySelectorAll('[data-site-typography-batch]')).toHaveLength(0);
    expect(document.querySelectorAll('[data-typography-prototype]')).toHaveLength(0);
    expect(document.querySelectorAll('[data-projection-generation-host]')).toHaveLength(0);
    expect(h1.hasAttribute('data-typography-owner')).toBe(false);
    expect(h1.firstChild).toBe(source);
    expect(note()).toBe(before.input);
    expect(note().value).toBe('Keep my unsaved note');
    const retired = preparation.count;
    document.documentElement.lang = 'en';
    await new Promise((resolve) => setTimeout(resolve, 100));
    document.documentElement.lang = 'zh-TW';
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(preparation.count).toBe(retired);
    expect(document.querySelectorAll('[data-typography-owner]')).toHaveLength(0);
    expect(h1.firstChild).toBe(source);
  });

  it('destroy during prototype loading rejects the refresh before a candidate exists', async () => {
    const before = await editPage();
    const h1 = document.querySelector('h1')!;
    const source = h1.querySelector('[data-site-typography-slot]')!.firstChild;
    await new Promise((resolve) => setTimeout(resolve, 100));
    const baseline = preparation.count;
    const loadEntered = deferred<void>();
    const gate = deferred<void>();
    loading.next = async () => {
      loadEntered.resolve();
      await gate.promise;
    };
    document.documentElement.lang = 'zh-CN';
    await loadEntered.promise;
    const destroyed = handle!.destroy();
    gate.resolve();
    await destroyed;
    handle = undefined;
    expect(preparation.count).toBe(baseline + 1);
    expect(document.querySelectorAll('[data-site-typography-batch]')).toHaveLength(0);
    expect(document.querySelectorAll('[data-typography-prototype]')).toHaveLength(0);
    expect(h1.hasAttribute('data-typography-owner')).toBe(false);
    expect(h1.firstChild).toBe(source);
    expect(note()).toBe(before.input);
    expect(note().value).toBe('Keep my unsaved note');
    document.documentElement.lang = 'zh-TW';
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(preparation.count).toBe(baseline + 1);
    expect(h1.firstChild).toBe(source);
  });

  it('destroy before observer delivery ignores the queued language change', async () => {
    const before = await editPage();
    const h1 = document.querySelector('h1')!;
    const source = h1.querySelector('[data-site-typography-slot]')!.firstChild;
    await new Promise((resolve) => setTimeout(resolve, 100));
    const baseline = preparation.count;
    document.documentElement.lang = 'zh-CN';
    await handle!.destroy();
    handle = undefined;
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(preparation.count).toBe(baseline);
    expect(document.querySelectorAll('[data-site-typography-batch]')).toHaveLength(0);
    expect(document.querySelectorAll('[data-typography-prototype]')).toHaveLength(0);
    expect(h1.hasAttribute('data-typography-owner')).toBe(false);
    expect(h1.firstChild).toBe(source);
    expect(note()).toBe(before.input);
  });

  it('root removal during a pending language refresh retires the batch without reviving source', async () => {
    const before = await editPage();
    const h1 = document.querySelector('h1')!;
    const source = h1.querySelector('[data-site-typography-slot]')!.firstChild;
    await new Promise((resolve) => setTimeout(resolve, 100));
    const held = holdNext();
    document.documentElement.lang = 'zh-CN';
    const pending = await held.entered;
    document.querySelector('[data-homepage-runtime]')!.remove();
    const destroyed = handle!.destroy();
    held.release();
    await destroyed;
    handle = undefined;
    await expect.poll(() => pending.dispose).toHaveBeenCalledOnce();
    expect(document.querySelectorAll('[data-site-typography-batch]')).toHaveLength(0);
    expect(document.querySelectorAll('[data-typography-prototype]')).toHaveLength(0);
    expect(document.querySelectorAll('[data-projection-generation-host]')).toHaveLength(0);
    expect(h1.hasAttribute('data-typography-owner')).toBe(false);
    expect(h1.firstChild).toBe(source);
    expect(note()).toBe(before.input);
    expect(note().value).toBe('Keep my unsaved note');
    const retired = preparation.count;
    document.documentElement.lang = 'zh-TW';
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(preparation.count).toBe(retired);
    expect(h1.firstChild).toBe(source);
  });

  it('a page swap during a pending language refresh retires the batch and preserves source', async () => {
    const before = await editPage();
    const h1 = document.querySelector('h1')!;
    const source = h1.querySelector('[data-site-typography-slot]')!.firstChild;
    await new Promise((resolve) => setTimeout(resolve, 100));
    const held = holdNext();
    document.documentElement.lang = 'zh-CN';
    const pending = await held.entered;
    document.dispatchEvent(new Event('astro:before-swap'));
    held.release();
    await expect.poll(() => pending.dispose).toHaveBeenCalledOnce();
    expect(pending.activate).not.toHaveBeenCalled();
    expect(document.querySelectorAll('[data-site-typography-batch]')).toHaveLength(0);
    expect(document.querySelectorAll('[data-typography-prototype]')).toHaveLength(0);
    expect(document.querySelectorAll('[data-projection-generation-host]')).toHaveLength(0);
    expect(h1.hasAttribute('data-typography-owner')).toBe(false);
    expect(h1.firstChild).toBe(source);
    expect(note()).toBe(before.input);
    expect(note().value).toBe('Keep my unsaved note');
    handle = undefined;
    const retired = preparation.count;
    document.documentElement.lang = 'zh-TW';
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(preparation.count).toBe(retired);
    expect(h1.firstChild).toBe(source);
  });

  it('destroy retires a pending React language refresh and preserves source', async () => {
    localStorage.setItem(PREFERRED_ADAPTER_KEY, 'react');
    const before = await editPage();
    const h1 = document.querySelector('h1')!;
    const source = h1.querySelector('[data-site-typography-slot]')!.firstChild;
    await expect.poll(() => surface().getAttribute('data-typography-runtime')).toBe('react');
    await new Promise((resolve) => setTimeout(resolve, 100));
    const held = holdNext();
    document.documentElement.lang = 'zh-CN';
    const pending = await held.entered;
    const destroyed = handle!.destroy();
    held.release();
    await destroyed;
    handle = undefined;
    expect(pending.activate).not.toHaveBeenCalled();
    expect(pending.dispose).toHaveBeenCalledOnce();
    expect(document.querySelectorAll('[data-site-typography-batch]')).toHaveLength(0);
    expect(document.querySelectorAll('[data-typography-prototype]')).toHaveLength(0);
    expect(h1.hasAttribute('data-typography-owner')).toBe(false);
    expect(h1.firstChild).toBe(source);
    expect(note()).toBe(before.input);
    expect(note().value).toBe('Keep my unsaved note');
    const retired = preparation.count;
    document.documentElement.lang = 'zh-TW';
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(preparation.count).toBe(retired);
    expect(h1.firstChild).toBe(source);
  });
});
