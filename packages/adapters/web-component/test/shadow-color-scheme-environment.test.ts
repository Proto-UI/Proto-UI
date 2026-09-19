import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createDefaultShadowColorSchemeSource,
  createShadowColorSchemeEnvironmentOwner,
  SHADOW_COLOR_SCHEME_ATTRIBUTE,
  type ShadowColorSchemeSource,
} from '../src/shadow-color-scheme-environment';

type MediaController = {
  readonly query: string;
  setMatches(matches: boolean): void;
};

describe('Shadow color-scheme environment owner', () => {
  let media: MediaController;
  let originalMatchMedia: typeof window.matchMedia | undefined;

  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.classList.remove('dark', 'light');
    originalMatchMedia = window.matchMedia;
    media = installMatchMedia(false);
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.classList.remove('dark', 'light');
    if (originalMatchMedia) window.matchMedia = originalMatchMedia;
    else Reflect.deleteProperty(window, 'matchMedia');
  });

  it('projects the existing explicit-theme, system, and light-fallback precedence synchronously', () => {
    media.setMatches(true);
    const systemHost = document.createElement('x-shadow-system-theme');
    const systemOwner = createShadowColorSchemeEnvironmentOwner(systemHost);
    expect(systemOwner.colorScheme).toBe('dark');
    expect(systemHost.getAttribute(SHADOW_COLOR_SCHEME_ATTRIBUTE)).toBe('dark');

    document.documentElement.dataset.theme = 'light';
    const explicitHost = document.createElement('x-shadow-explicit-theme');
    const explicitOwner = createShadowColorSchemeEnvironmentOwner(explicitHost);
    expect(explicitOwner.colorScheme).toBe('light');
    expect(explicitHost.getAttribute(SHADOW_COLOR_SCHEME_ATTRIBUTE)).toBe('light');

    systemOwner.dispose();
    explicitOwner.dispose();
  });

  it('notifies only when document or media changes alter the effective default source', async () => {
    const source = createDefaultShadowColorSchemeSource();
    const listener = vi.fn();
    const unsubscribe = source.subscribe(listener);

    // The shared per-document source batches notifications through a
    // microtask (adapter-base web-color-scheme-source), so media-driven
    // changes are observed after a flush rather than synchronously.
    media.setMatches(true);
    await flushMutationObserver();
    expect(source.get()).toBe('dark');
    expect(listener).toHaveBeenCalledTimes(1);

    document.documentElement.dataset.theme = 'light';
    await flushMutationObserver();
    expect(source.get()).toBe('light');
    expect(listener).toHaveBeenCalledTimes(2);

    media.setMatches(false);
    await flushMutationObserver();
    expect(source.get()).toBe('light');
    expect(listener).toHaveBeenCalledTimes(2);

    document.documentElement.classList.add('dark');
    await flushMutationObserver();
    expect(source.get()).toBe('dark');
    expect(listener).toHaveBeenCalledTimes(3);

    unsubscribe();
    document.documentElement.classList.remove('dark');
    await flushMutationObserver();
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('binds the default source to the host owning document', async () => {
    // D-WEB-COMPONENT-SHADOW-STYLE-0001-D: an adopted host reads and
    // observes its current document environment, not the Adapter module realm.
    document.documentElement.dataset.theme = 'light';
    const owningDocument = document.implementation.createHTMLDocument('owning-document');
    owningDocument.documentElement.dataset.theme = 'dark';
    const host = owningDocument.createElement('x-shadow-adopted-theme');
    owningDocument.body.append(host);
    const owner = createShadowColorSchemeEnvironmentOwner(host);

    expect(owner.colorScheme).toBe('dark');
    expect(host.getAttribute(SHADOW_COLOR_SCHEME_ATTRIBUTE)).toBe('dark');

    owningDocument.documentElement.dataset.theme = 'light';
    await flushMutationObserver();
    expect(owner.colorScheme).toBe('light');
    expect(host.getAttribute(SHADOW_COLOR_SCHEME_ATTRIBUTE)).toBe('light');
    owner.dispose();
  });

  it('uses one explicit source for synchronous reads, marker updates, and terminal cleanup', () => {
    let colorScheme: 'light' | 'dark' = 'light';
    const listeners = new Set<() => void>();
    const source: ShadowColorSchemeSource = {
      get: () => colorScheme,
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
    const host = document.createElement('x-shadow-explicit-source');
    const owner = createShadowColorSchemeEnvironmentOwner(host, source);

    expect(owner.source).toBe(source);
    expect(owner.colorScheme).toBe('light');
    expect(host.getAttribute(SHADOW_COLOR_SCHEME_ATTRIBUTE)).toBe('light');
    expect(listeners.size).toBe(1);

    const setAttribute = vi.spyOn(host, 'setAttribute');
    for (const listener of listeners) listener();
    expect(setAttribute).not.toHaveBeenCalled();

    colorScheme = 'dark';
    for (const listener of listeners) listener();
    expect(owner.colorScheme).toBe('dark');
    expect(host.getAttribute(SHADOW_COLOR_SCHEME_ATTRIBUTE)).toBe('dark');
    expect(setAttribute).toHaveBeenCalledTimes(1);

    owner.dispose();
    owner.dispose();
    expect(listeners.size).toBe(0);
    expect(host.hasAttribute(SHADOW_COLOR_SCHEME_ATTRIBUTE)).toBe(false);

    colorScheme = 'light';
    for (const listener of listeners) listener();
    expect(host.hasAttribute(SHADOW_COLOR_SCHEME_ATTRIBUTE)).toBe(false);
  });

  it('deduplicates one owner per host and restores a pre-existing marker on disposal', () => {
    const host = document.createElement('x-shadow-owner-dedupe');
    host.setAttribute(SHADOW_COLOR_SCHEME_ATTRIBUTE, 'consumer-value');
    const source = staticSource('dark');
    const owner = createShadowColorSchemeEnvironmentOwner(host, source);

    expect(createShadowColorSchemeEnvironmentOwner(host, staticSource('light'))).toBe(owner);
    expect(host.getAttribute(SHADOW_COLOR_SCHEME_ATTRIBUTE)).toBe('dark');

    owner.dispose();
    expect(host.getAttribute(SHADOW_COLOR_SCHEME_ATTRIBUTE)).toBe('consumer-value');
  });

  it('fails closed without leaving a marker when an explicit source is invalid', () => {
    const host = document.createElement('x-shadow-invalid-source');
    const source = staticSource('sepia' as 'light');

    expect(() => createShadowColorSchemeEnvironmentOwner(host, source)).toThrow(
      '[WC Adapter] invalid Shadow color-scheme source value: sepia.'
    );
    expect(host.hasAttribute(SHADOW_COLOR_SCHEME_ATTRIBUTE)).toBe(false);
  });

  it('fails closed when an explicit source does not return an unsubscribe function', () => {
    const host = document.createElement('x-shadow-invalid-subscription');
    const source: ShadowColorSchemeSource = {
      get: () => 'light',
      subscribe: (() => undefined) as unknown as ShadowColorSchemeSource['subscribe'],
    };

    expect(() => createShadowColorSchemeEnvironmentOwner(host, source)).toThrow(
      '[WC Adapter] invalid Shadow color-scheme source subscription.'
    );
    expect(host.hasAttribute(SHADOW_COLOR_SCHEME_ATTRIBUTE)).toBe(false);
  });
});

it('invalidates a callback retained by a failing subscription', () => {
  const host = document.createElement('div');
  let callback!: () => void;
  expect(() =>
    createShadowColorSchemeEnvironmentOwner(host, {
      get: () => 'dark',
      subscribe(cb) {
        callback = cb;
        throw new Error('subscribe canary');
      },
    })
  ).toThrow(/subscribe canary/);
  callback();
  expect(host.hasAttribute(SHADOW_COLOR_SCHEME_ATTRIBUTE)).toBe(false);
});

it('evicts a disposed environment and restores marker even when unsubscribe throws', () => {
  const host = document.createElement('div');
  const first = createShadowColorSchemeEnvironmentOwner(host, {
    get: () => 'light',
    subscribe: () => () => {
      throw new Error('unsubscribe canary');
    },
  });
  expect(() => first.dispose()).toThrow(/unsubscribe canary/);
  expect(host.hasAttribute(SHADOW_COLOR_SCHEME_ATTRIBUTE)).toBe(false);
  const next = createShadowColorSchemeEnvironmentOwner(host, staticSource('dark'));
  expect(next).not.toBe(first);
  expect(next.colorScheme).toBe('dark');
  next.dispose();
});

function staticSource(value: 'light' | 'dark'): ShadowColorSchemeSource {
  return {
    get: () => value,
    subscribe: () => () => {},
  };
}

function installMatchMedia(initialMatches: boolean): MediaController {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQueryList = {
    get matches() {
      return matches;
    },
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
    addListener: (listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
    removeListener: (listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
    dispatchEvent: () => true,
  } as MediaQueryList;

  window.matchMedia = vi.fn(() => mediaQueryList);

  return {
    query: mediaQueryList.media,
    setMatches(next) {
      matches = next;
      const event = { matches, media: mediaQueryList.media } as MediaQueryListEvent;
      for (const listener of listeners) listener(event);
    },
  };
}

async function flushMutationObserver(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}
