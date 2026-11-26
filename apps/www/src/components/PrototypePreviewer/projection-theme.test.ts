import { afterEach, describe, expect, it, vi } from 'vitest';

import { BRUTALIST_THEME } from '../../../../../packages/prototypes/brutalist/src/theme';
import { SHADCN_TYPOGRAPHY } from '../../../../../packages/prototypes/shadcn/src/text/typography';
import {
  applyProjectionThemeSurfaceStyle,
  clearProjectionThemeSurfaceStyle,
  resolveProjectionThemeSurfaceStyle,
  scheduleProjectionThemeRead,
  watchProjectionThemeSurfaceStyle,
  type ProjectionThemeSurfaceStyle,
  WEBSITE_SHADCN_THEME_TOKENS,
} from './projection-theme';

afterEach(() => {
  document.documentElement.className = '';
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('style');
});

describe('Website projection theme inputs', () => {
  it('samples each publication scope before releasing writes for the batch', async () => {
    const parent = document.createElement('section');
    const a = parent.appendChild(document.createElement('div'));
    const b = parent.appendChild(document.createElement('div'));
    document.body.append(parent);
    for (const name of WEBSITE_SHADCN_THEME_TOKENS) {
      a.style.setProperty(`--pui-${name}`, `a-${name}`);
      b.style.setProperty(`--pui-${name}`, `b-${name}`);
    }
    const order: string[] = [];
    const first = scheduleProjectionThemeRead(a, () => {
      order.push('read a');
      return resolveProjectionThemeSurfaceStyle('shadcn', a);
    }).then((theme) => {
      order.push('write a');
      b.style.setProperty('--pui-radius', 'after-a');
      return theme;
    });
    const second = scheduleProjectionThemeRead(b, () => {
      order.push('read b');
      return resolveProjectionThemeSurfaceStyle('shadcn', b);
    }).then((theme) => {
      order.push('write b');
      return theme;
    });
    try {
      expect(order).toEqual([]);
      const [themeA, themeB] = await Promise.all([first, second]);
      expect(order).toEqual(['read a', 'read b', 'write a', 'write b']);
      expect(themeA['--pui-radius']).toBe('a-radius');
      expect(themeB['--pui-radius']).toBe('b-radius');
      expect(b.style.getPropertyValue('--pui-radius')).toBe('after-a');
    } finally {
      parent.remove();
    }
  });

  it.each([false, true])(
    'schedules one urgent publication task and handles rejection (%s)',
    async (rejected) => {
      const scope = document.documentElement;
      const view = scope.ownerDocument.defaultView!;
      const previous = Object.getOwnPropertyDescriptor(view, 'scheduler');
      const postTask = vi.fn((callback: () => void) =>
        rejected
          ? Promise.reject(new Error('scheduler unavailable'))
          : Promise.resolve().then(callback)
      );
      Object.defineProperty(view, 'scheduler', { configurable: true, value: { postTask } });
      const firstRead = vi.fn(() => 'first');
      const secondRead = vi.fn(() => 'second');
      try {
        const pending = [
          scheduleProjectionThemeRead(scope, firstRead),
          scheduleProjectionThemeRead(scope, secondRead),
        ];
        await expect(Promise.all(pending)).resolves.toEqual(['first', 'second']);
        expect(postTask).toHaveBeenCalledOnce();
        expect(postTask).toHaveBeenCalledWith(expect.any(Function), {
          priority: 'user-blocking',
        });
        expect(firstRead).toHaveBeenCalledOnce();
        expect(secondRead).toHaveBeenCalledOnce();
      } finally {
        if (previous) Object.defineProperty(view, 'scheduler', previous);
        else Reflect.deleteProperty(view, 'scheduler');
      }
    }
  );

  it('samples within a microtask when the document has no priority scheduler', async () => {
    const scope = document.documentElement;
    const view = scope.ownerDocument.defaultView!;
    const previous = Object.getOwnPropertyDescriptor(view, 'scheduler');
    Object.defineProperty(view, 'scheduler', { configurable: true, value: undefined });
    const read = vi.fn(() => 'current theme');
    try {
      const pending = scheduleProjectionThemeRead(scope, read);
      await Promise.resolve();
      const atCheckpoint = read.mock.calls.length;
      await expect(pending).resolves.toBe('current theme');
      expect(atCheckpoint).toBe(1);
    } finally {
      if (previous) Object.defineProperty(view, 'scheduler', previous);
      else Reflect.deleteProperty(view, 'scheduler');
    }
  });

  it('leaves other queued publications readable when a theme read fails', async () => {
    const scope = document.documentElement;
    const invalid = scheduleProjectionThemeRead(scope, () => {
      throw new Error('theme read failed');
    });
    const pending = scheduleProjectionThemeRead(scope, () => 'next scope value');
    await Promise.all([
      expect(invalid).rejects.toThrow('theme read failed'),
      expect(pending).resolves.toBe('next scope value'),
    ]);
  });

  it('copies only the explicit Website Shadcn input and fails closed on a missing token', () => {
    for (const name of WEBSITE_SHADCN_THEME_TOKENS) {
      document.documentElement.style.setProperty(`--pui-${name}`, `value-${name}`);
    }
    document.documentElement.style.setProperty('--page-private-token', 'do-not-copy');

    const theme = resolveProjectionThemeSurfaceStyle('shadcn', document.documentElement);

    expect(theme['--pui-background']).toBe('value-background');
    expect(Object.keys(theme)).toHaveLength(WEBSITE_SHADCN_THEME_TOKENS.length + 2);
    expect(theme['--pui-font-sans']).toBe(SHADCN_TYPOGRAPHY['font-sans']);
    expect(theme['--pui-font-heading']).toBe(SHADCN_TYPOGRAPHY['font-heading']);
    expect(theme).not.toHaveProperty('--page-private-token');

    document.documentElement.style.removeProperty('--pui-popover');
    expect(() => resolveProjectionThemeSurfaceStyle('shadcn', document.documentElement)).toThrow(
      /missing required --pui-popover/
    );
  });

  it('reads explicit Shadcn typography overrides without borrowing a retained other-family font', () => {
    for (const name of WEBSITE_SHADCN_THEME_TOKENS)
      document.documentElement.style.setProperty(`--pui-${name}`, `value-${name}`);
    document.documentElement.style.setProperty('--pui-font-sans', 'Retained Brutalist');
    document.documentElement.style.setProperty('--site-shadcn-font-sans', 'Authored Sans');
    const first = resolveProjectionThemeSurfaceStyle('shadcn', document.documentElement);
    expect(first['--pui-font-sans']).toBe('Authored Sans');
    expect(first['--pui-font-heading']).toBe(SHADCN_TYPOGRAPHY['font-heading']);
    document.documentElement.style.removeProperty('--site-shadcn-font-sans');
    expect(
      resolveProjectionThemeSurfaceStyle('shadcn', document.documentElement)['--pui-font-sans']
    ).toBe(SHADCN_TYPOGRAPHY['font-sans']);
    expect(
      resolveProjectionThemeSurfaceStyle('brutalist', document.documentElement)['--pui-font-sans']
    ).toBe(BRUTALIST_THEME.light['font-sans']);
    expect(
      resolveProjectionThemeSurfaceStyle('liquid-glass', document.documentElement)[
        '--pui-font-sans'
      ]
    ).not.toContain('Geist');
    expect(
      resolveProjectionThemeSurfaceStyle('bootstrap-2-3-2', document.documentElement)[
        '--pui-font-sans'
      ]
    ).not.toContain('Geist');
  });

  it('withdraws a previous family font with the owned theme map and leaves caller style alone', () => {
    const surface = document.createElement('div');
    surface.style.fontFamily = 'Authored Family';
    const authoredFont = surface.style.fontFamily;
    applyProjectionThemeSurfaceStyle(surface, {
      '--pui-font-sans': SHADCN_TYPOGRAPHY['font-sans'],
    });
    applyProjectionThemeSurfaceStyle(surface, {
      '--pui-font-sans': BRUTALIST_THEME.light['font-sans']!,
    });
    expect(surface.style.getPropertyValue('--pui-font-sans')).not.toContain('Geist');
    applyProjectionThemeSurfaceStyle(surface, {});
    expect(surface.style.getPropertyValue('--pui-font-sans')).toBe('');
    expect(surface.style.fontFamily).toBe(authoredFont);
  });

  it('uses the Prototype-owned Brutalist theme for the active Website color mode', () => {
    expect(resolveProjectionThemeSurfaceStyle('brutalist', document.documentElement)).toMatchObject(
      {
        '--pui-background': BRUTALIST_THEME.light.background,
        '--pui-foreground': BRUTALIST_THEME.light.foreground,
        '--pui-border': BRUTALIST_THEME.light.border,
      }
    );

    document.documentElement.dataset.theme = 'dark';
    expect(resolveProjectionThemeSurfaceStyle('brutalist', document.documentElement)).toMatchObject(
      {
        '--pui-background': BRUTALIST_THEME.dark.background,
        '--pui-foreground': BRUTALIST_THEME.dark.foreground,
        '--pui-border': BRUTALIST_THEME.dark.border,
      }
    );
  });

  it('resolves the nearest explicit Brutalist frame theme before the document theme', () => {
    document.documentElement.classList.add('light');
    const frame = document.createElement('section');
    frame.className = 'brutalist-demo-frame dark';
    const scope = document.createElement('div');
    frame.appendChild(scope);
    document.body.appendChild(frame);

    expect(resolveProjectionThemeSurfaceStyle('brutalist', scope)).toMatchObject({
      '--pui-background': BRUTALIST_THEME.dark.background,
      '--pui-foreground': BRUTALIST_THEME.dark.foreground,
      '--pui-border': BRUTALIST_THEME.dark.border,
    });
  });

  it('watches the owning scope ancestry for explicit Brutalist theme changes', async () => {
    document.documentElement.classList.add('light');
    const frame = document.createElement('section');
    const scope = document.createElement('div');
    frame.appendChild(scope);
    document.body.appendChild(frame);
    const themes: ProjectionThemeSurfaceStyle[] = [];
    const cleanup = watchProjectionThemeSurfaceStyle('brutalist', scope, (theme) => {
      themes.push(theme);
    });

    expect(themes.at(-1)?.['--pui-background']).toBe(BRUTALIST_THEME.light.background);
    frame.classList.add('dark');
    await vi.waitFor(() => {
      expect(themes.at(-1)?.['--pui-background']).toBe(BRUTALIST_THEME.dark.background);
    });

    cleanup();
  });

  it('shares the native color preference listener until the last projection stops watching', async () => {
    const media = new EventTarget() as EventTarget & { matches: boolean };
    media.matches = false;
    const add = vi.spyOn(media, 'addEventListener');
    const remove = vi.spyOn(media, 'removeEventListener');
    const matchMedia = vi.spyOn(window, 'matchMedia').mockReturnValue(media as MediaQueryList);
    const first = document.body.appendChild(document.createElement('div'));
    const second = document.body.appendChild(document.createElement('div'));
    const onFirst = vi.fn();
    const onSecond = vi.fn();
    const offFirst = watchProjectionThemeSurfaceStyle('brutalist', first, onFirst);
    const offSecond = watchProjectionThemeSurfaceStyle('brutalist', second, onSecond);
    try {
      expect(add).toHaveBeenCalledTimes(1);
      expect(onFirst).toHaveBeenCalledTimes(1);
      expect(onSecond).toHaveBeenCalledTimes(1);

      offFirst();
      expect(remove).not.toHaveBeenCalled();
      media.matches = true;
      media.dispatchEvent(new Event('change'));
      await vi.waitFor(() => {
        expect(onSecond).toHaveBeenLastCalledWith(
          expect.objectContaining({ '--pui-background': BRUTALIST_THEME.dark.background })
        );
      });
      expect(onFirst).toHaveBeenCalledTimes(1);

      offSecond();
      expect(remove).toHaveBeenCalledTimes(1);
      const offNext = watchProjectionThemeSurfaceStyle('brutalist', second, vi.fn());
      expect(add).toHaveBeenCalledTimes(2);
      offNext();
      expect(remove).toHaveBeenCalledTimes(2);
    } finally {
      offFirst();
      offSecond();
      first.remove();
      second.remove();
      matchMedia.mockRestore();
    }
  });

  it('uses an explicit light class before a dark system preference', () => {
    const matchMedia = vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
    } as MediaQueryList);
    document.documentElement.classList.add('light');

    try {
      expect(
        resolveProjectionThemeSurfaceStyle('brutalist', document.documentElement)
      ).toMatchObject({
        '--pui-background': BRUTALIST_THEME.light.background,
        '--pui-foreground': BRUTALIST_THEME.light.foreground,
        '--pui-border': BRUTALIST_THEME.light.border,
      });
    } finally {
      matchMedia.mockRestore();
    }
  });

  it('only writes changed live theme declarations and still reclaims owned priority', () => {
    const surface = document.createElement('div');
    const theme = { '--pui-background': '#fff', '--pui-foreground': '#111' } as const;
    applyProjectionThemeSurfaceStyle(surface, theme);
    const write = vi.spyOn(surface.style, 'setProperty');

    applyProjectionThemeSurfaceStyle(surface, theme);
    expect(write).not.toHaveBeenCalled();

    surface.style.setProperty('--pui-background', '#fff', 'important');
    surface.style.setProperty('--pui-foreground', '#777');
    write.mockClear();
    applyProjectionThemeSurfaceStyle(surface, theme);
    expect(write.mock.calls).toEqual([
      ['--pui-background', '#fff'],
      ['--pui-foreground', '#111'],
    ]);
    expect(surface.style.getPropertyPriority('--pui-background')).toBe('');
    expect(surface.style.getPropertyValue('--pui-foreground')).toBe('#111');
    write.mockRestore();
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

  describe('preserved inline theme stamps', () => {
    it.each(['#aabbcc', '#111'])(
      'keeps an existing author tuple %s even when it matches the theme',
      (foreground) => {
        const surface = document.createElement('div');
        const priority = foreground === '#111' ? '' : 'important';
        surface.style.setProperty('--pui-foreground', foreground, priority);
        surface.style.color = 'red';
        applyProjectionThemeSurfaceStyle(
          surface,
          {
            '--pui-foreground': '#111',
            '--pui-background': '#fff',
          },
          'preserve-inline'
        );
        expect(surface.style.getPropertyValue('--pui-foreground')).toBe(foreground);
        expect(surface.style.getPropertyPriority('--pui-foreground')).toBe(priority);
        expect(surface.style.getPropertyValue('--pui-background')).toBe('#fff');
        clearProjectionThemeSurfaceStyle(surface);
        clearProjectionThemeSurfaceStyle(surface);
        expect(surface.style.getPropertyValue('--pui-foreground')).toBe(foreground);
        expect(surface.style.getPropertyPriority('--pui-foreground')).toBe(priority);
        expect(surface.style.getPropertyValue('--pui-background')).toBe('');
        expect(surface.style.color).toBe('red');
      }
    );

    it.each(
      (['value', 'priority', 'removal'] as const).flatMap((takeover) =>
        [false, true].map((refresh) => ({ takeover, refresh }))
      )
    )(
      'leaves a stamped property after author $takeover takeover (refresh=$refresh)',
      ({ takeover, refresh }) => {
        const surface = document.createElement('div');
        applyProjectionThemeSurfaceStyle(
          surface,
          { '--pui-background': '#fff' },
          'preserve-inline'
        );
        if (takeover === 'value') surface.style.setProperty('--pui-background', '#abc');
        else if (takeover === 'priority')
          surface.style.setProperty('--pui-background', '#fff', 'important');
        else surface.style.removeProperty('--pui-background');
        const authored = [
          surface.style.getPropertyValue('--pui-background'),
          surface.style.getPropertyPriority('--pui-background'),
        ];
        if (refresh)
          applyProjectionThemeSurfaceStyle(
            surface,
            { '--pui-background': '#090909' },
            'preserve-inline'
          );
        expect([
          surface.style.getPropertyValue('--pui-background'),
          surface.style.getPropertyPriority('--pui-background'),
        ]).toEqual(authored);
        clearProjectionThemeSurfaceStyle(surface);
        expect([
          surface.style.getPropertyValue('--pui-background'),
          surface.style.getPropertyPriority('--pui-background'),
        ]).toEqual(authored);
      }
    );

    it('updates and retires only its explicitly written missing properties', () => {
      const surface = document.createElement('div');
      surface.style.setProperty('--pui-foreground', '#aabbcc');
      applyProjectionThemeSurfaceStyle(
        surface,
        {
          '--pui-foreground': '#111',
          '--pui-background': '#fff',
          '--pui-border': '#ccc',
        },
        'preserve-inline'
      );
      applyProjectionThemeSurfaceStyle(
        surface,
        {
          '--pui-foreground': '#eee',
          '--pui-background': '#090909',
        },
        'preserve-inline'
      );
      expect(surface.style.getPropertyValue('--pui-foreground')).toBe('#aabbcc');
      expect(surface.style.getPropertyValue('--pui-background')).toBe('#090909');
      expect(surface.style.getPropertyValue('--pui-border')).toBe('');
      clearProjectionThemeSurfaceStyle(surface);
      expect(surface.style.getPropertyValue('--pui-foreground')).toBe('#aabbcc');
      expect(surface.style.getPropertyValue('--pui-background')).toBe('');
    });
  });

  it('watches color-mode changes without self-looping and returns idempotent cleanup', async () => {
    const themes: Array<Readonly<Record<string, string>>> = [];
    const cleanup = watchProjectionThemeSurfaceStyle(
      'brutalist',
      document.documentElement,
      (theme) => {
        themes.push(theme);
        // A consumer-side root write must not make the watcher emit the same map forever.
        document.documentElement.style.setProperty(
          '--watcher-consumer-write',
          String(themes.length)
        );
      }
    );

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

  it('does not reread the theme bank for unchanged attributes and keeps real changes in mixed batches', async () => {
    const scope = document.documentElement;
    for (const name of WEBSITE_SHADCN_THEME_TOKENS)
      scope.style.setProperty(`--pui-${name}`, `value-${name}`);
    scope.className = 'light';
    scope.dataset.theme = 'light';
    const themes: ProjectionThemeSurfaceStyle[] = [];
    const cleanup = watchProjectionThemeSurfaceStyle('shadcn', scope, (theme) =>
      themes.push(theme)
    );
    const records: MutationRecord[] = [];
    const observer = new MutationObserver((batch) => records.push(...batch));
    observer.observe(scope, { attributes: true, attributeOldValue: true });
    const read = vi.spyOn(window, 'getComputedStyle');
    try {
      for (const name of ['class', 'data-theme', 'style'])
        scope.setAttribute(name, scope.getAttribute(name)!);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(records.length).toBeGreaterThan(0);
      expect(read).not.toHaveBeenCalled();
      expect(themes).toHaveLength(1);

      scope.setAttribute('class', scope.getAttribute('class')!);
      scope.style.setProperty('--pui-background', 'changed-background');
      scope.setAttribute('data-theme', scope.getAttribute('data-theme')!);
      await vi.waitFor(() => expect(themes).toHaveLength(2));
      expect(themes[1]?.['--pui-background']).toBe('changed-background');
      expect(read).toHaveBeenCalledOnce();
    } finally {
      cleanup();
      observer.disconnect();
      read.mockRestore();
    }
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
        watchProjectionThemeSurfaceStyle('brutalist', document.documentElement, () => {
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

describe('source-owned partial family themes', () => {
  it('preserves historical Bootstrap light paint and explicit accessible dark adaptations', () => {
    document.documentElement.dataset.theme = 'light';
    const bootstrap = resolveProjectionThemeSurfaceStyle(
      'bootstrap-2-3-2',
      document.documentElement
    );
    const glass = resolveProjectionThemeSurfaceStyle('liquid-glass', document.documentElement);
    expect(bootstrap['--pui-primary']).toBe('#0044cc');
    expect(glass['--pui-secondary']).toBe('#ffffff');
    document.documentElement.dataset.theme = 'dark';
    const bootstrapDark = resolveProjectionThemeSurfaceStyle(
      'bootstrap-2-3-2',
      document.documentElement
    );
    expect(bootstrapDark['--pui-foreground']).toBe('#eeeeee');
    expect(bootstrapDark['--pui-background']).toBe('#161616');
    expect(bootstrapDark['--pui-primary']).toBe(bootstrap['--pui-primary']);
    expect(Object.keys(bootstrapDark).sort()).toEqual(Object.keys(bootstrap).sort());
    const dark = resolveProjectionThemeSurfaceStyle('liquid-glass', document.documentElement);
    expect(dark['--pui-secondary']).toBe('#2c2c2e');
    expect(Object.keys(dark).sort()).toEqual(Object.keys(glass).sort());
  });
});
