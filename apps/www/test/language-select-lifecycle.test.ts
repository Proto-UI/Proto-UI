// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { Window, type HTMLElement } from 'happy-dom';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';

const sourceUrl = new URL('../src/components/override/LanguageSelect.astro', import.meta.url);
const source = readFileSync(sourceUrl, 'utf8');
const scripts = [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
const windows: Window[] = [];
const localePaths = { en: '/en/docs/overview/', 'zh-cn': '/zh-cn/docs/overview/' };

type SelectRoot = HTMLElement & {
  getExposes?: () => { value?: { get?: () => string } };
};

function createHarness(
  options: {
    readyState?: 'loading' | 'interactive' | 'complete';
    storedLocale?: string;
    cookie?: string;
  } = {}
) {
  const browser = new Window({
    url: 'https://language-select.test/en/docs/overview/',
    settings: {
      disableJavaScriptEvaluation: true,
      disableJavaScriptFileLoading: true,
      disableCSSFileLoading: true,
      disableIframePageLoading: true,
    },
  });
  windows.push(browser);
  const { document, localStorage } = browser;
  Object.defineProperty(document, 'readyState', {
    configurable: true,
    value: options.readyState ?? 'complete',
  });
  if (options.storedLocale) localStorage.setItem('preferred-locale', options.storedLocale);
  if (options.cookie) document.cookie = options.cookie;

  const setItem = vi.spyOn(localStorage, 'setItem');
  // A setter-only spy can shadow the inherited getter in happy-dom. Keep both
  // native accessors so assertions and the production sync read use its jar.
  let cookieOwner: object | null = document;
  let cookieDescriptor: PropertyDescriptor | undefined;
  while (cookieOwner && !cookieDescriptor) {
    cookieDescriptor = Object.getOwnPropertyDescriptor(cookieOwner, 'cookie');
    cookieOwner = Object.getPrototypeOf(cookieOwner);
  }
  const readCookie = cookieDescriptor?.get;
  const writeCookie = cookieDescriptor?.set;
  if (!readCookie || !writeCookie) throw new Error('Missing native cookie accessors');
  const setCookie = vi.fn((value: string) => writeCookie.call(document, value));
  Object.defineProperty(document, 'cookie', {
    configurable: true,
    enumerable: cookieDescriptor?.enumerable ?? false,
    get: () => readCookie.call(document),
    set: setCookie,
  });
  expect(typeof document.cookie).toBe('string');
  const navigate = vi.fn();
  const initSiteControls = vi.fn();
  const log = vi.fn();
  const error = vi.fn();
  // Observe assignments without letting a test initiate a browser navigation.
  const location = {
    get pathname() {
      return '/en/docs/overview/';
    },
    set pathname(value: string) {
      navigate(value);
    },
  };

  function addSelect(family: 'shadcn' | 'brutalist' = 'shadcn', currentLocale = 'en') {
    const root = document.createElement(`wc-${family}-select-root`) as SelectRoot;
    root.setAttribute('data-site-select-root', '');
    root.setAttribute('data-language-select-root', '');
    root.dataset.currentLocale = currentLocale;
    root.dataset.localePaths = JSON.stringify(localePaths);
    document.body.append(root);
    const addEventListener = vi.spyOn(root, 'addEventListener');
    return {
      root,
      handlerCount: () =>
        addEventListener.mock.calls.filter(([type]) => type === 'valueChange').length,
    };
  }

  function start() {
    // Evaluate the complete production client script, not a copied initializer.
    // CommonJS transpilation erases only TypeScript syntax and lets us replace
    // the unrelated site-control bootstrap at its actual import boundary.
    expect(scripts).toHaveLength(1);
    expect(scripts[0][1].trim()).toBe('');
    expect(scripts[0][2]).toContain("from '../site-shadcn-controls'");
    const compiled = transpileModule(scripts[0][2], {
      fileName: 'LanguageSelect.client.ts',
      compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 },
      reportDiagnostics: true,
    });
    expect(compiled.diagnostics ?? []).toHaveLength(0);
    runInNewContext(
      compiled.outputText,
      {
        document,
        window: { location },
        localStorage,
        console: { log, error },
        exports: {},
        require(id: string) {
          if (id !== '../site-shadcn-controls') throw new Error(`Unexpected client import: ${id}`);
          return { initSiteControls };
        },
      },
      { filename: sourceUrl.pathname, timeout: 1_000 }
    );
  }

  function pageLoad() {
    document.dispatchEvent(new browser.Event('astro:page-load'));
  }

  function change(root: SelectRoot, value?: string) {
    root.dispatchEvent(
      new browser.CustomEvent('valueChange', {
        detail: value === undefined ? undefined : { value },
        bubbles: true,
      })
    );
  }

  return {
    browser,
    document,
    localStorage,
    setItem,
    setCookie,
    navigate,
    initSiteControls,
    log,
    error,
    addSelect,
    start,
    pageLoad,
    change,
  };
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(windows.splice(0).map((browser) => browser.happyDOM.close()));
});

describe('processed language selector script lifecycle', () => {
  it('keeps language initialization in one Astro-processed script, never inline per instance', () => {
    expect(scripts).toHaveLength(1);
    expect(scripts[0][1].trim()).toBe('');
    expect(source).not.toMatch(/<script\b[^>]*\bis:inline\b/);
    expect(scripts[0][2]).toContain('initSiteControls(document)');
    expect(scripts[0][2]).toContain('[data-language-select-root]');
  });

  it.each(['interactive', 'complete'] as const)(
    'binds both rendered controls once when the document is %s',
    (readyState) => {
      const h = createHarness({ readyState });
      const first = h.addSelect('shadcn');
      const second = h.addSelect('brutalist');
      h.start();

      expect(h.initSiteControls).toHaveBeenCalledTimes(1);

      expect(h.initSiteControls).toHaveBeenCalledWith(h.document);
      for (const control of [first, second]) {
        expect(control.root.dataset.languageSelectInitialized).toBe('true');
        expect(control.handlerCount()).toBe(1);
      }
    }
  );

  it('waits for DOMContentLoaded when loading and binds each control only once', () => {
    const h = createHarness({ readyState: 'loading' });
    const first = h.addSelect();
    const second = h.addSelect('brutalist');
    h.start();
    expect(first.handlerCount()).toBe(0);
    expect(second.handlerCount()).toBe(0);

    h.document.dispatchEvent(new h.browser.Event('DOMContentLoaded'));
    h.document.dispatchEvent(new h.browser.Event('DOMContentLoaded'));
    h.pageLoad();
    expect(first.handlerCount()).toBe(1);
    expect(second.handlerCount()).toBe(1);
    h.change(second.root, 'zh-cn');
    expect(h.navigate).toHaveBeenCalledTimes(1);
    expect(h.navigate).toHaveBeenCalledWith(localePaths['zh-cn']);
  });

  it('does not duplicate valueChange handlers on repeated Astro page loads', () => {
    const h = createHarness();
    const first = h.addSelect();
    const second = h.addSelect('brutalist');
    h.start();
    h.pageLoad();
    h.pageLoad();
    h.pageLoad();

    expect(h.initSiteControls).toHaveBeenCalledTimes(4);
    expect(first.handlerCount()).toBe(1);
    expect(second.handlerCount()).toBe(1);
    for (const control of [first, second]) {
      h.navigate.mockClear();
      h.setItem.mockClear();
      h.change(control.root, 'zh-cn');
      expect(h.navigate).toHaveBeenCalledTimes(1);
      expect(h.navigate).toHaveBeenCalledWith(localePaths['zh-cn']);
      expect(h.setItem).toHaveBeenCalledTimes(1);
      expect(h.setItem).toHaveBeenCalledWith('preferred-locale', 'zh-cn');
    }
  });

  it('binds a newly inserted root on page load without rebinding retained roots', () => {
    const h = createHarness();
    const retained = h.addSelect();
    h.start();
    const inserted = h.addSelect('brutalist', 'zh-cn');
    expect(inserted.handlerCount()).toBe(0);
    h.pageLoad();
    h.pageLoad();

    expect(retained.handlerCount()).toBe(1);
    expect(inserted.handlerCount()).toBe(1);
    expect(inserted.root.dataset.languageSelectInitialized).toBe('true');
    h.change(inserted.root, 'en');
    expect(h.navigate).toHaveBeenCalledTimes(1);
    expect(h.navigate).toHaveBeenCalledWith(localePaths.en);
  });

  it.each([
    ['en', 'zh-cn', localePaths['zh-cn']],
    ['zh-cn', 'en', localePaths.en],
  ])('maps %s to the declared %s path and persists the new preference', (current, next, path) => {
    const h = createHarness();
    const { root } = h.addSelect('shadcn', current);
    h.start();
    h.change(root, next);

    expect(h.navigate).toHaveBeenCalledTimes(1);

    expect(h.navigate).toHaveBeenCalledWith(path);
    expect(h.localStorage.getItem('preferred-locale')).toBe(next);
    expect(h.document.cookie).toBe(`preferred-locale=${next}`);
    expect(h.setCookie).toHaveBeenCalledTimes(1);
    expect(h.setCookie.mock.calls[0][0]).toMatch(
      new RegExp(`^preferred-locale=${next}; path=/; expires=.+ GMT; SameSite=Lax$`)
    );
  });

  it('does not navigate or persist for the current locale or an unmapped locale', () => {
    const h = createHarness();
    const { root } = h.addSelect();
    h.start();
    h.change(root, 'en');
    h.change(root, 'unknown');
    h.change(root);
    expect(h.navigate).not.toHaveBeenCalled();
    expect(h.setItem).not.toHaveBeenCalled();
    expect(h.setCookie).not.toHaveBeenCalled();
  });

  it('uses the exposed value when event detail is absent, while explicit detail wins', () => {
    const h = createHarness();
    const { root } = h.addSelect();
    root.getExposes = () => ({ value: { get: () => 'zh-cn' } });
    h.start();
    h.change(root, 'en');
    expect(h.navigate).not.toHaveBeenCalled();
    h.change(root);
    expect(h.navigate).toHaveBeenCalledTimes(1);
    expect(h.navigate).toHaveBeenCalledWith(localePaths['zh-cn']);
  });

  it('synchronizes a stored preference to the cookie only once across both controls', () => {
    const h = createHarness({ storedLocale: 'zh-cn', cookie: 'preferred-locale=en; path=/' });
    h.addSelect();
    h.addSelect('brutalist');
    h.start();
    h.pageLoad();

    expect(h.document.cookie).toBe('preferred-locale=zh-cn');
    expect(h.setItem).toHaveBeenCalledTimes(1);
    expect(h.setItem).toHaveBeenCalledWith('preferred-locale', 'zh-cn');
    expect(h.setCookie).toHaveBeenCalledTimes(1);
    expect(h.navigate).not.toHaveBeenCalled();
  });

  it('leaves an already synchronized cookie and stored preference untouched', () => {
    const h = createHarness({ storedLocale: 'zh-cn', cookie: 'preferred-locale=zh-cn; path=/' });
    h.addSelect();
    h.addSelect('brutalist');
    h.start();
    expect(h.setItem).not.toHaveBeenCalled();
    expect(h.setCookie).not.toHaveBeenCalled();
    expect(h.navigate).not.toHaveBeenCalled();
  });

  it('still binds and writes the cookie when localStorage is unavailable', () => {
    const h = createHarness();
    const { root, handlerCount } = h.addSelect();
    vi.spyOn(h.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('unavailable');
    });
    h.setItem.mockImplementation(() => {
      throw new Error('unavailable');
    });
    h.start();
    expect(handlerCount()).toBe(1);
    h.change(root, 'zh-cn');
    expect(h.document.cookie).toBe('preferred-locale=zh-cn');
    expect(h.navigate).toHaveBeenCalledTimes(1);
    expect(h.navigate).toHaveBeenCalledWith(localePaths['zh-cn']);
  });

  it('preserves malformed-JSON rejection without blocking valid siblings, and retries after repair', () => {
    const h = createHarness();
    const malformed = h.addSelect();
    malformed.root.dataset.localePaths = '{not-json';
    const valid = h.addSelect('brutalist');
    h.start();

    expect(h.error).toHaveBeenCalledTimes(1);
    expect(h.error.mock.calls[0][0]).toBe('[Language Select] Failed to parse locale paths:');
    expect(malformed.root.dataset.languageSelectInitialized).toBeUndefined();
    expect(malformed.handlerCount()).toBe(0);
    expect(valid.handlerCount()).toBe(1);
    h.change(malformed.root, 'zh-cn');
    expect(h.navigate).not.toHaveBeenCalled();

    malformed.root.dataset.localePaths = JSON.stringify(localePaths);
    h.pageLoad();
    h.pageLoad();
    expect(malformed.root.dataset.languageSelectInitialized).toBe('true');
    expect(malformed.handlerCount()).toBe(1);
    expect(valid.handlerCount()).toBe(1);
    h.change(malformed.root, 'zh-cn');
    expect(h.navigate).toHaveBeenCalledTimes(1);
    expect(h.navigate).toHaveBeenCalledWith(localePaths['zh-cn']);
  });
});
