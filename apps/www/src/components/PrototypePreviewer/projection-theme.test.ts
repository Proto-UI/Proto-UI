import { afterEach, describe, expect, it, vi } from 'vitest';

import { BRUTALIST_THEME } from '../../../../../packages/prototypes/brutalist/src/theme';
import {
  applyProjectionThemeSurfaceStyle,
  resolveProjectionThemeSurfaceStyle,
  watchProjectionThemeSurfaceStyle,
  WEBSITE_SHADCN_THEME_TOKENS,
} from './projection-theme';

afterEach(() => {
  document.documentElement.className = '';
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('style');
});

describe('Website projection theme inputs', () => {
  it('copies only the explicit Website Shadcn input and fails closed on a missing token', () => {
    for (const name of WEBSITE_SHADCN_THEME_TOKENS) {
      document.documentElement.style.setProperty(`--pui-${name}`, `value-${name}`);
    }
    document.documentElement.style.setProperty('--page-private-token', 'do-not-copy');

    const theme = resolveProjectionThemeSurfaceStyle('shadcn', document);

    expect(theme['--pui-background']).toBe('value-background');
    expect(Object.keys(theme)).toHaveLength(WEBSITE_SHADCN_THEME_TOKENS.length);
    expect(theme).not.toHaveProperty('--page-private-token');

    document.documentElement.style.removeProperty('--pui-popover');
    expect(() => resolveProjectionThemeSurfaceStyle('shadcn', document)).toThrow(
      /missing required --pui-popover/
    );
  });

  it('uses the Prototype-owned Brutalist theme for the active Website color mode', () => {
    expect(resolveProjectionThemeSurfaceStyle('brutalist', document)).toMatchObject({
      '--pui-background': BRUTALIST_THEME.light.background,
      '--pui-foreground': BRUTALIST_THEME.light.foreground,
      '--pui-border': BRUTALIST_THEME.light.border,
    });

    document.documentElement.dataset.theme = 'dark';
    expect(resolveProjectionThemeSurfaceStyle('brutalist', document)).toMatchObject({
      '--pui-background': BRUTALIST_THEME.dark.background,
      '--pui-foreground': BRUTALIST_THEME.dark.foreground,
      '--pui-border': BRUTALIST_THEME.dark.border,
    });
  });

  it('uses an explicit light class before a dark system preference', () => {
    const matchMedia = vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
    } as MediaQueryList);
    document.documentElement.classList.add('light');

    try {
      expect(resolveProjectionThemeSurfaceStyle('brutalist', document)).toMatchObject({
        '--pui-background': BRUTALIST_THEME.light.background,
        '--pui-foreground': BRUTALIST_THEME.light.foreground,
        '--pui-border': BRUTALIST_THEME.light.border,
      });
    } finally {
      matchMedia.mockRestore();
    }
  });

  it('applies a closed theme copy and removes properties retired from its owned shape', () => {
    const surface = document.createElement('div');
    applyProjectionThemeSurfaceStyle(surface, {
      '--pui-background': '#fff',
      '--pui-foreground': '#111',
    });

    expect(surface.style.getPropertyValue('--pui-background')).toBe('#fff');
    expect(surface.style.getPropertyValue('--pui-foreground')).toBe('#111');

    applyProjectionThemeSurfaceStyle(surface, {
      '--pui-background': '#090909',
    });
    expect(surface.style.getPropertyValue('--pui-background')).toBe('#090909');
    expect(surface.style.getPropertyValue('--pui-foreground')).toBe('');
  });

  it('watches color-mode changes without self-looping and returns idempotent cleanup', async () => {
    const themes: Array<Readonly<Record<string, string>>> = [];
    const cleanup = watchProjectionThemeSurfaceStyle('brutalist', document, (theme) => {
      themes.push(theme);
      // A consumer-side root write must not make the watcher emit the same map forever.
      document.documentElement.style.setProperty('--watcher-consumer-write', String(themes.length));
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(themes).toHaveLength(1);
    expect(themes[0]?.['--pui-background']).toBe(BRUTALIST_THEME.light.background);

    document.documentElement.dataset.theme = 'dark';
    await vi.waitFor(() => {
      expect(themes).toHaveLength(2);
      expect(themes[1]?.['--pui-background']).toBe(BRUTALIST_THEME.dark.background);
    });

    cleanup();
    cleanup();
    document.documentElement.dataset.theme = 'light';
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(themes).toHaveLength(2);
  });

  it('disconnects every observer when the initial watcher publication throws', () => {
    const originalMutationObserver = Object.getOwnPropertyDescriptor(window, 'MutationObserver');
    const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
    const observe = vi.fn();
    const disconnect = vi.fn();
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    class TestMutationObserver {
      observe = observe;
      disconnect = disconnect;
      takeRecords = () => [];
    }
    const colorScheme = {
      matches: false,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener,
      removeEventListener,
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList;

    Object.defineProperty(window, 'MutationObserver', {
      configurable: true,
      writable: true,
      value: TestMutationObserver,
    });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn(() => colorScheme),
    });

    try {
      expect(() =>
        watchProjectionThemeSurfaceStyle('brutalist', document, () => {
          throw new Error('initial theme publication failed');
        })
      ).toThrow('initial theme publication failed');
      expect(observe).toHaveBeenCalledTimes(1);
      expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
      expect(disconnect).toHaveBeenCalledTimes(1);
      expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    } finally {
      if (originalMutationObserver) {
        Object.defineProperty(window, 'MutationObserver', originalMutationObserver);
      } else {
        Reflect.deleteProperty(window, 'MutationObserver');
      }
      if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', originalMatchMedia);
      else Reflect.deleteProperty(window, 'matchMedia');
    }
  });
});
