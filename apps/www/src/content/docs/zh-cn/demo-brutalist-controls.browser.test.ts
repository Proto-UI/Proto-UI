// @vitest-environment node

import { spawn, type ChildProcess } from 'node:child_process';
import { waitForServerReadiness } from '../../../../../../scripts/test/server-readiness.mjs';
import { access } from 'node:fs/promises';
import { createServer } from 'node:net';
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Locator,
  type JSHandle,
  type Page,
} from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  RUNTIMES as EVERY_RUNTIME,
  runtimeSelectTrigger,
  selectRuntime as selectPreviewRuntime,
} from './browser-harness';

const RUNTIMES = ['wc', 'react', 'vue'] as const;
type RuntimeId = (typeof RUNTIMES)[number];

const SWITCH_ROUTE = '/en/ui-libraries/brutalist/components/switch/';
const TABS_ROUTE = '/en/ui-libraries/brutalist/components/tabs/';
const SCROLL_AREA_ROUTE = '/en/ui-libraries/brutalist/components/scroll-area/';
const TEXTAREA_ROUTE = '/en/ui-libraries/brutalist/components/textarea/';
const TOOLTIP_ROUTE = '/en/ui-libraries/brutalist/components/tooltip/';
const DROPDOWN_ROUTE = '/en/ui-libraries/brutalist/components/dropdown-menu/';
const BUTTON_ROUTE = '/en/ui-libraries/brutalist/components/button/';
const GEOMETRY_EPSILON = 0.5;

const COLOR_SCHEMES = ['light', 'dark'] as const;
type ColorScheme = (typeof COLOR_SCHEMES)[number];

/** Scopes assertions to this demo so unrelated page chrome cannot satisfy them. */
const TEXTAREA_DEMO_SCOPE = '[data-demo-id="demo-brutalist-textarea"]';

/** Demo-authored surfaces around the Textarea; the physical control is styled by the Prototype. */
const TEXTAREA_DEMO_SURFACES = [
  'toggleProps',
  'focusButton',
  'blurButton',
  'stateLabel',
  'eventLog',
] as const;

/** WCAG 2.1 AA for normal text. */
const MIN_TEXT_CONTRAST = 4.5;

/** WCAG 2.1 AA for a non-text boundary that carries meaning. */
const MIN_BOUNDARY_CONTRAST = 3;

let browser: Browser;
let devServer: ChildProcess | null = null;
let baseUrl = '';
let serverOutput = '';

async function availablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Unable to reserve a browser-test port.'));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

async function chromeExecutable(): Promise<string> {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.LOCALAPPDATA
      ? `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`
      : undefined,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next standard Chrome/Chromium location.
    }
  }

  throw new Error('Chrome/Chromium is required; set CHROME_PATH to its executable.');
}

async function waitForServer(url: string): Promise<void> {
  try {
    await waitForServerReadiness(url, {
      timeoutMs: 120_000,
      server: devServer,
      readOutput: () => serverOutput,
    });
  } catch (error) {
    console.error(
      `[browser-harness] readiness failed: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
}

function recordServerOutput(chunk: Buffer): void {
  serverOutput = `${serverOutput}${chunk.toString()}`.slice(-20_000);
}

async function startServer(): Promise<string> {
  const externalBaseUrl = process.env.PROTO_UI_BROWSER_BASE_URL?.replace(/\/$/, '');
  if (externalBaseUrl) {
    await waitForServer(`${externalBaseUrl}${SWITCH_ROUTE}`);
    return externalBaseUrl;
  }

  const port = await availablePort();
  const executable = process.platform === 'win32' ? 'corepack.cmd' : 'corepack';
  devServer = spawn(
    executable,
    [
      'pnpm@10.32.1',
      '--filter',
      'apps-www',
      'dev',
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
    ],
    {
      cwd: process.cwd(),
      detached: process.platform !== 'win32',
      shell: process.platform === 'win32',
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  devServer.stdout?.on('data', recordServerOutput);
  devServer.stderr?.on('data', recordServerOutput);

  const url = `http://127.0.0.1:${port}`;
  await waitForServer(`${url}${SWITCH_ROUTE}`);
  return url;
}

async function stopServer(): Promise<void> {
  if (!devServer || devServer.exitCode !== null || !devServer.pid) return;
  const pid = devServer.pid;
  if (process.platform === 'win32') {
    await new Promise<void>((resolve) => {
      const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      killer.once('error', () => resolve());
      killer.once('exit', () => resolve());
    });
    return;
  }

  const signalTarget = -pid;
  process.kill(signalTarget, 'SIGTERM');

  const exited = await Promise.race([
    new Promise<boolean>((resolve) => devServer?.once('exit', () => resolve(true))),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5_000)),
  ]);
  if (!exited && devServer.exitCode === null) process.kill(signalTarget, 'SIGKILL');
}

async function openRoute(
  route: string,
  viewport: Readonly<{ width: number; height: number }>
): Promise<{ context: BrowserContext; page: Page; previewer: Locator }> {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
  const previewer = page.locator('[data-previewer-id]').first();
  await previewer.waitFor({ state: 'visible' });
  return { context, page, previewer };
}

async function selectRuntime(
  page: Page,
  previewer: Locator,
  runtime: RuntimeId,
  readySelector: string,
  expectedCount: number
): Promise<void> {
  await selectPreviewRuntime(page, previewer, runtime, readySelector, expectedCount);
}

/**
 * Emulates a colour scheme and waits until the documentation theme script has
 * projected it, so a measurement cannot read the previous theme.
 */
async function applyColorScheme(page: Page, colorScheme: ColorScheme): Promise<void> {
  await page.emulateMedia({ colorScheme });
  await page.waitForFunction(
    (scheme) => document.documentElement.dataset.theme === scheme,
    colorScheme,
    { timeout: 10_000 }
  );
}
type TextareaFocusSnapshot = {
  active: boolean;
  focused: boolean;
  focusVisible: boolean;
  nativeFocusVisible: boolean;
  hostFocused: boolean;
  hostFocusVisible: boolean;
  surfaceFocusVisible: boolean;
  hostTabIndex: string | null;
  surfaceTabIndex: number;
  textareaCount: number;
  boxShadow: string;
};

async function wcTextareaFocusSnapshot(previewer: Locator): Promise<TextareaFocusSnapshot> {
  return previewer.evaluate((root) => {
    const host = root.querySelector<HTMLElement>(
      '[data-projection-content] .pui-runtime-preview-surface[data-demo-ref="__website_runtime_preview_surface__"] [data-pui-root]'
    );
    const textarea = root.querySelector<HTMLTextAreaElement>('textarea');
    if (!host || !textarea) throw new Error('Web Component Textarea projection is missing.');
    const exposes = (
      host as HTMLElement & {
        getExposes(): {
          focused: { get(): boolean };
          focusVisible: { get(): boolean };
        };
      }
    ).getExposes();
    return {
      active: document.activeElement === textarea,
      focused: exposes.focused.get(),
      focusVisible: exposes.focusVisible.get(),
      nativeFocusVisible: textarea.matches(':focus-visible'),
      hostFocused: host.hasAttribute('data-focused'),
      hostFocusVisible: host.hasAttribute('data-focus-visible'),
      surfaceFocusVisible: textarea.hasAttribute('data-focus-visible'),
      hostTabIndex: host.getAttribute('tabindex'),
      surfaceTabIndex: textarea.tabIndex,
      textareaCount: root.querySelectorAll('textarea').length,
      boxShadow: getComputedStyle(textarea).boxShadow,
    };
  });
}

/**
 * Resolves each demo surface's text colour and nearest opaque backdrop through a
 * 1x1 canvas, so `oklch()` and other non-`rgb()` computed values are measured as
 * painted, then returns the text and border contrast ratios per demo ref.
 */
async function demoSurfaceContrast(
  page: Page,
  scope: string,
  refs: readonly string[]
): Promise<Record<string, { text: number; border: number }>> {
  return page.evaluate(
    ({ scope: scopeSelector, refs: surfaceRefs }) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Canvas 2D context is required to resolve painted colours.');

      const paint = (color: string): [number, number, number, number] => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = '#000';
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
        return [r, g, b, a / 255];
      };
      const backdrop = (element: Element): [number, number, number, number] => {
        let current: Element | null = element;
        while (current) {
          const color = paint(getComputedStyle(current).backgroundColor);
          if (color[3] > 0.95) return color;
          current = current.parentElement;
        }
        return [255, 255, 255, 1];
      };
      const luminance = ([r, g, b]: [number, number, number, number]): number => {
        const [rl, gl, bl] = [r, g, b].map((channel) => {
          const value = channel / 255;
          return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
      };

      const ratio = (a: number, b: number): number => {
        const lighter = Math.max(a, b);
        const darker = Math.min(a, b);
        return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
      };

      const previewer = document.querySelector(scopeSelector);
      if (!previewer) throw new Error(`Demo scope ${scopeSelector} is missing.`);

      const result: Record<string, { text: number; border: number }> = {};
      for (const ref of surfaceRefs) {
        const element = previewer.querySelector(`[data-demo-ref="${ref}"]`);
        if (!element) throw new Error(`Demo ref ${ref} is missing.`);
        const style = getComputedStyle(element);
        const background = luminance(backdrop(element));
        result[ref] = {
          text: ratio(luminance(paint(style.color)), background),
          border: ratio(luminance(paint(style.borderTopColor)), background),
        };
      }
      return result;
    },
    { scope, refs }
  );
}

type ViewportRing = {
  focusVisible: boolean;
  layers: string[];
  insetLayers: string[];
  bounds: { x: number; y: number; width: number; height: number };
  scrollTop: number;
  scrollLeft: number;
};

/**
 * Splits the Viewport box-shadow into layers and keeps the inset ones. An inset
 * layer with zero offsets and a positive spread is what "visible on all four
 * sides" means in computed-style terms; an outward layer would be clipped by the
 * Root and is what this projection must not produce.
 */
/**
 * Waits for a keypress to actually move the surface, however loaded the run is.
 * Comparing against the position before the press means the case never has to
 * reset the surface, which the composed projection owns rather than the test.
 */
async function waitForScrollBeyond(
  page: Page,
  axis: 'scrollTop' | 'scrollLeft',
  from: number
): Promise<void> {
  await page.waitForFunction(
    ({ property, previous }) => {
      const viewport = document.querySelector<HTMLElement>(
        '[data-previewer-id] [data-demo-ref="scrollViewport"]'
      );
      return (viewport?.[property] ?? 0) > previous;
    },
    { property: axis, previous: from },
    { timeout: 10_000 }
  );
}

async function viewportRing(page: Page): Promise<ViewportRing> {
  return page.evaluate(() => {
    const viewport = document.querySelector<HTMLElement>(
      '[data-previewer-id] [data-demo-ref="scrollViewport"]'
    );
    if (!viewport) throw new Error('The Brutalist Scroll Area demo must render its Viewport.');

    const shadow = getComputedStyle(viewport).boxShadow;
    const parts: string[] = [];
    let depth = 0;
    let current = '';
    for (const char of shadow === 'none' ? '' : shadow) {
      if (char === '(') depth += 1;
      if (char === ')') depth -= 1;
      if (char === ',' && depth === 0) {
        parts.push(current.trim());
        current = '';
        continue;
      }
      current += char;
    }
    if (current.trim()) parts.push(current.trim());

    const rect = viewport.getBoundingClientRect();
    return {
      focusVisible: viewport.hasAttribute('data-focus-visible'),
      layers: parts,
      insetLayers: parts.filter((layer) => layer.includes('inset')),
      bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      scrollTop: viewport.scrollTop,
      scrollLeft: viewport.scrollLeft,
    };
  });
}

/** Every Button fill this suite reads, paired with the theme variable it names. */
const BUTTON_FILLS = {
  solidMain: ['--pui-main', '--pui-main-foreground'],
  surface: ['--pui-secondary-background', '--pui-foreground'],
  destructive: ['--pui-destructive', '--pui-destructive-foreground'],
  disabledSolid: ['--pui-main', '--pui-main-foreground'],
  disabledSurface: ['--pui-secondary-background', '--pui-foreground'],
} as const;

type ButtonFill = {
  background: string;
  color: string;
  opacity: string;
  variables: { background: string; color: string };
  hovered: boolean;
  pressed: boolean;
};

/**
 * Reads each Button fill and the value of the variable it names on that same
 * projected presentation surface through one 1x1 canvas. The Website scope
 * deliberately keeps lane variables off `:root`, so the surface is the actual
 * consumer-owned theme boundary. Comparing the pair is what "resolves through
 * the theme variable" means; comparing two schemes only proves the surface moved.
 */
/**
 * Switches the host theme through the site's own control surface.
 *
 * `P-BRUTALIST-BUTTON-LIVE-THEME` names host-theme-driven CSS variable
 * resolution as the supported mechanism and puts `prefers-color-scheme`
 * outside the criterion, so `emulateMedia` would let a Button written entirely
 * in media queries satisfy this case. Calling `StarlightTheme.set` rather than
 * writing attributes means the case exercises the exact signal the documentation
 * theme toggle emits: `data-theme` and `color-scheme` on the root, and nothing
 * else. Setting a `.dark` class here as well would keep the case green if the
 * `:root[data-theme='dark']` selector broke, which is the selector the real
 * toggle depends on.
 */
async function applyHostTheme(page: Page, scheme: ColorScheme): Promise<void> {
  await page.evaluate((next) => {
    const host = window as unknown as { StarlightTheme?: { set(theme: string): void } };
    if (!host.StarlightTheme) throw new Error('The documentation theme provider must be present.');
    host.StarlightTheme.set(next);
  }, scheme);
  await page.waitForFunction((next) => document.documentElement.dataset.theme === next, scheme, {
    timeout: 10_000,
  });
}

/**
 * Overrides the theme variables `P-BRUTALIST-BUTTON-LIGHT-DARK` requires the
 * surface and destructive fills to resolve through, each with a value in no
 * palette and distinct from the others, so a pair hard-coded to the current
 * Light or Dark values cannot pass and no fill can satisfy the check by
 * following a variable it does not name.
 *
 * The solid accent variables are deliberately absent. That criterion asks solid
 * pairs to be theme-invariant and asks for variable resolution from surface and
 * destructive only, so a conforming projection may materialize the accent pair
 * as fixed colours. Canarying it would fail that projection for conforming.
 */
const CANARY_VALUES: Record<string, string> = {
  '--pui-secondary-background': 'rgb(7, 8, 9)',
  '--pui-foreground': 'rgb(10, 11, 12)',
  '--pui-destructive': 'rgb(13, 14, 15)',
  '--pui-destructive-foreground': 'rgb(16, 17, 18)',
};

type CanaryThemeOwner = {
  candidate: {
    activate(): void;
    setThemeSurfaceStyle(theme: Record<string, string>): void;
    dispose(): void | Promise<void>;
  };
  mount: HTMLElement;
  theme: Record<string, string>;
  nodes: Record<string, HTMLElement>;
  events: Array<Record<string, unknown>>;
  expectedRestamp: string;
};

async function createCanaryThemeOwner(
  page: Page,
  runtime: string
): Promise<JSHandle<CanaryThemeOwner>> {
  // A string expression stays native in the browser; Vitest's SSR transform
  // must not replace import() with its Node-side private loader helper.
  const nativeImport = await page.evaluateHandle<(path: string) => Promise<any>>(`(path) => {
    const allowed = [
      '/src/components/PrototypePreviewer/projection-materializer.ts',
      '/src/components/PrototypePreviewer/projection-theme.ts'
    ];
    if (!allowed.includes(path)) throw new Error('Unapproved canary module path');
    return import(path);
  }`);
  let factoryFailed = false;
  try {
    return await page.evaluateHandle(
      async ({ runtimeId, refs, loadModule }) => {
        const materializerUrl = '/src/components/PrototypePreviewer/projection-materializer.ts';
        const themeUrl = '/src/components/PrototypePreviewer/projection-theme.ts';
        const { materializeProjectionCandidate } = await loadModule(materializerUrl);
        const { resolveProjectionThemeSurfaceStyle } = await loadModule(themeUrl);
        const mount = document.createElement('div');
        mount.dataset.theme = 'light';
        document.body.appendChild(mount);
        let candidate: CanaryThemeOwner['candidate'] | undefined;
        try {
          candidate = await materializeProjectionCandidate(
            { selection: { runtimeId, projectionFamilyId: 'brutalist' }, generation: 1 },
            {
              mount,
              ownerId: `button-canary-${runtimeId}-${crypto.randomUUID()}`,
              componentId: 'button',
              controlIds: [],
              controls: {
                runtime: {
                  label: 'Runtime',
                  options: [{ value: runtimeId, label: runtimeId }],
                  onValueChange() {},
                },
                family: {
                  label: 'Family',
                  options: [{ value: 'brutalist', label: 'Brutalist' }],
                  onValueChange() {},
                },
                component: {
                  label: 'Component',
                  options: [{ value: 'button', label: 'Button' }],
                  onValueChange() {},
                },
              },
            }
          );
          if (!candidate) throw new Error('The materializer must return a controlled candidate.');
          candidate.activate();
          const nodes = Object.fromEntries(
            refs.map((ref) => {
              const node = mount.querySelector<HTMLElement>(`[data-demo-ref="${ref}"]`);
              if (!node) throw new Error(`The controlled Button projection must render ${ref}.`);
              return [ref, node];
            })
          );
          return {
            candidate,
            mount,
            nodes,
            theme: resolveProjectionThemeSurfaceStyle('brutalist', mount),
            events: [],
            expectedRestamp: '',
          };
        } catch (error) {
          try {
            await candidate?.dispose();
          } finally {
            mount.remove();
          }
          throw error;
        }
      },
      { runtimeId: runtime, refs: Object.keys(BUTTON_FILLS), loadModule: nativeImport }
    );
  } catch (error) {
    factoryFailed = true;
    throw error;
  } finally {
    try {
      await nativeImport.dispose();
    } catch (error) {
      if (!factoryFailed) throw error;
      console.warn('Canary native loader cleanup failed', error);
    }
  }
}

async function applyCanaryTheme(
  page: Page,
  owner: JSHandle<CanaryThemeOwner>,
  on: boolean
): Promise<void> {
  await owner.evaluate(
    (state, { enabled, values }) => {
      state.candidate.setThemeSurfaceStyle(enabled ? { ...state.theme, ...values } : state.theme);
      for (const [ref, surface] of Object.entries(state.nodes)) {
        if (
          !surface.isConnected ||
          state.mount.querySelector(`[data-demo-ref="${ref}"]`) !== surface
        )
          throw new Error(`Owner theme update replaced the ${ref} node.`);
      }
      const node = state.nodes.surface;
      const property = '--pui-secondary-background';
      state.expectedRestamp = enabled ? values[property] : state.theme[property];
      state.events.push({
        step: enabled ? 'owner-canary' : 'owner-restore',
        value: node.style.getPropertyValue(property),
        sameNode: state.mount.querySelector('[data-demo-ref="surface"]') === node,
      });
      // Force an observable owner restamp, not a delay: removing the inline
      // value makes the next matching value evidence of a real write.
      node.style.removeProperty(property);
      node.classList.toggle('button-canary-restamp-probe');
      state.events.push({
        step: 'marker-change',
        value: node.style.getPropertyValue(property),
        owner: node.dataset.projectionOwner,
        generation: node.dataset.projectionGeneration,
      });
    },
    { enabled: on, values: CANARY_VALUES }
  );
  await page.waitForFunction(
    (state) =>
      Object.entries(state.nodes).every(
        ([ref, surface]) =>
          surface.isConnected && state.mount.querySelector(`[data-demo-ref="${ref}"]`) === surface
      ) &&
      state.nodes.surface.style.getPropertyValue('--pui-secondary-background').trim() ===
        state.expectedRestamp,
    owner,
    { timeout: 10_000 }
  );
  await owner.evaluate((state) => {
    state.events.push({
      step: 'restamp-observed',
      value: state.nodes.surface.style.getPropertyValue('--pui-secondary-background'),
      sameNode: state.mount.querySelector('[data-demo-ref="surface"]') === state.nodes.surface,
    });
  });
}

async function buttonFills(
  page: Page,
  scope?: JSHandle<HTMLElement>
): Promise<Record<keyof typeof BUTTON_FILLS, ButtonFill>> {
  return page.evaluate(
    ({ fills, scopeRoot }) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Canvas 2D context is required to resolve painted colours.');

      const paint = (color: string): string => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = '#000';
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        return Array.from(context.getImageData(0, 0, 1, 1).data).join(',');
      };

      const result: Record<string, unknown> = {};
      for (const [ref, [backgroundVar, colorVar]] of Object.entries(fills)) {
        const element = (scopeRoot ?? document).querySelector<HTMLElement>(
          `${scopeRoot ? '' : '[data-previewer-id] '}[data-demo-ref="${ref}"]`
        );
        if (!element) throw new Error(`The Brutalist Button demo must render ${ref}.`);
        const style = getComputedStyle(element);
        result[ref] = {
          background: paint(style.backgroundColor),
          color: paint(style.color),
          opacity: style.opacity,
          variables: {
            background: paint(style.getPropertyValue(backgroundVar).trim()),
            color: paint(style.getPropertyValue(colorVar).trim()),
          },
          hovered: element.hasAttribute('data-hovered'),
          pressed: element.hasAttribute('data-pressed'),
        };
      }
      return result as Record<string, ButtonFill>;
    },
    { fills: BUTTON_FILLS, scopeRoot: scope }
  );
}

beforeAll(async () => {
  baseUrl = await startServer();
  browser = await chromium.launch({
    executablePath: await chromeExecutable(),
    headless: true,
    args: ['--disable-dev-shm-usage', '--no-sandbox'],
  });
}, 150_000);

afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

describe.sequential('Brutalist control documentation browser regressions', () => {
  it('gives every Switch a non-empty accessible name in all runtimes', async () => {
    const { context, page, previewer } = await openRoute(SWITCH_ROUTE, {
      width: 1440,
      height: 900,
    });

    try {
      for (const runtime of RUNTIMES) {
        await selectRuntime(page, previewer, runtime, '[role="switch"]', 3);
        const switches = previewer.getByRole('switch');
        const names: string[] = [];
        for (let index = 0; index < 3; index += 1) {
          const snapshot = await switches.nth(index).ariaSnapshot();
          names.push(snapshot.match(/switch "([^"]+)"/)?.[1] ?? '');
        }
        expect(names, runtime).toEqual(['Email alerts', 'Release alerts', 'Archived alerts']);
        expect(await switches.nth(0).getAttribute('aria-checked'), runtime).toBe('false');
        expect(await switches.nth(1).getAttribute('aria-checked'), runtime).toBe('true');
        expect(await switches.nth(2).getAttribute('aria-disabled'), runtime).toBe('true');
      }
    } finally {
      await context.close();
    }
  }, 90_000);

  it('keeps the Tabs Root bounds stable across selection in all runtimes', async () => {
    const { context, page, previewer } = await openRoute(TABS_ROUTE, {
      width: 1440,
      height: 900,
    });

    try {
      for (const runtime of RUNTIMES) {
        await selectRuntime(page, previewer, runtime, '[role="tab"]', 2);
        const root = previewer
          .locator(
            '[data-projection-content] .pui-runtime-preview-surface[data-demo-ref="__website_runtime_preview_surface__"] [data-pui-root]'
          )
          .first();
        const before = await root.boundingBox();
        expect(before, runtime).not.toBeNull();

        const details = previewer.getByRole('tab', { name: 'Details' });
        await details.click();
        await page.waitForFunction(
          () =>
            document
              .querySelector('[data-previewer-id] [role="tab"]:nth-of-type(2)')
              ?.getAttribute('aria-selected') === 'true'
        );

        const after = await root.boundingBox();
        expect(after, runtime).not.toBeNull();
        expect(Math.abs(after!.x - before!.x), runtime).toBeLessThanOrEqual(GEOMETRY_EPSILON);
        expect(Math.abs(after!.width - before!.width), runtime).toBeLessThanOrEqual(
          GEOMETRY_EPSILON
        );
      }
    } finally {
      await context.close();
    }
  }, 90_000);

  it('keeps Dropdown placement fixed while Trigger hover and press transforms change', async () => {
    const { context, page, previewer } = await openRoute(DROPDOWN_ROUTE, {
      width: 1440,
      height: 900,
    });
    try {
      for (const runtime of RUNTIMES) {
        await selectRuntime(page, previewer, runtime, '[data-pui-root]', 5);
        const trigger = previewer
          .locator(
            '[data-projection-content] .pui-runtime-preview-surface[data-demo-ref="__website_runtime_preview_surface__"] [data-pui-root]'
          )
          .nth(1);
        await trigger.click();
        await expect.poll(() => page.getByRole('menu').count(), { message: runtime }).toBe(1);
        await page.waitForTimeout(200);
        const hoverMenu = await page.getByRole('menu').boundingBox();
        const hoverTransform = await trigger.evaluate(
          (element) => getComputedStyle(element).transform
        );
        expect(hoverMenu, runtime).not.toBeNull();

        await page.mouse.move(5, 5);
        await page.waitForTimeout(200);
        const restMenu = await page.getByRole('menu').boundingBox();
        const restTransform = await trigger.evaluate(
          (element) => getComputedStyle(element).transform
        );
        expect(restMenu, runtime).not.toBeNull();
        expect(restTransform, `${runtime}/rest-vs-hover-transform`).not.toBe(hoverTransform);
        expect(Math.abs(restMenu!.x - hoverMenu!.x), `${runtime}/rest-x`).toBeLessThanOrEqual(
          GEOMETRY_EPSILON
        );
        expect(Math.abs(restMenu!.y - hoverMenu!.y), `${runtime}/rest-y`).toBeLessThanOrEqual(
          GEOMETRY_EPSILON
        );

        const triggerBox = await trigger.boundingBox();
        if (!triggerBox) throw new Error(`${runtime}: Dropdown Trigger has no rendered bounds.`);
        await page.mouse.move(
          triggerBox.x + triggerBox.width / 2,
          triggerBox.y + triggerBox.height / 2
        );
        await page.mouse.down();
        await page.waitForTimeout(200);
        const pressedMenu = await page.getByRole('menu').boundingBox();
        const pressedTransform = await trigger.evaluate(
          (element) => getComputedStyle(element).transform
        );
        expect(pressedMenu, runtime).not.toBeNull();
        expect(pressedTransform, `${runtime}/pressed-vs-rest-transform`).not.toBe(restTransform);
        expect(Math.abs(pressedMenu!.x - hoverMenu!.x), `${runtime}/pressed-x`).toBeLessThanOrEqual(
          GEOMETRY_EPSILON
        );
        expect(Math.abs(pressedMenu!.y - hoverMenu!.y), `${runtime}/pressed-y`).toBeLessThanOrEqual(
          GEOMETRY_EPSILON
        );
        await page.mouse.up();
      }
    } finally {
      await context.close();
    }
  }, 90_000);

  it('composes the transparent Tooltip Group across Web Components, React, and Vue', async () => {
    const { context, page, previewer } = await openRoute(TOOLTIP_ROUTE, {
      width: 1440,
      height: 900,
    });

    const expectTooltipPaint = async (tooltip: Locator, expectedText: string, frame: string) => {
      const paint = await tooltip.evaluate((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return {
          id: (element as HTMLElement).id,
          text: element.textContent,
          tabIndex: (element as HTMLElement).tabIndex,
          interactive: element.querySelectorAll('a,button,input,select,textarea,[tabindex]').length,
          borderRadius: style.borderRadius,
          borderWidth: style.borderTopWidth,
          borderColor: style.borderTopColor,
          backgroundColor: style.backgroundColor,
          color: style.color,
          boxShadow: style.boxShadow,
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          textTransform: style.textTransform,
          paddingInline: style.paddingInline,
          paddingBlock: style.paddingBlock,
          width: rect.width,
          height: rect.height,
        };
      });
      expect(paint.text, frame).toContain(expectedText);
      expect(paint.tabIndex, frame).toBe(-1);
      expect(paint.interactive, frame).toBe(0);
      expect(paint.borderRadius, frame).toBe('5px');
      expect(paint.borderWidth, frame).toBe('2px');
      // The preview frame and the renderer-owned body portal must resolve one shared theme.
      const resolved = await page.evaluate(() => {
        const boundary = document.querySelector('[data-brutalist-tooltip-theme-boundary]');
        if (!(boundary instanceof HTMLElement)) {
          throw new Error('The Tooltip page must expose its shared theme boundary.');
        }
        const portal = document.querySelector('[role="tooltip"]');
        if (!(portal instanceof HTMLElement)) {
          throw new Error('The Tooltip renderer must expose its body portal surface.');
        }
        const readPaint = (parent: HTMLElement) => {
          const probe = document.createElement('div');
          probe.style.color = 'var(--pui-foreground)';
          probe.style.backgroundColor = 'var(--pui-secondary-background)';
          parent.appendChild(probe);
          const style = getComputedStyle(probe);
          const result = {
            foreground: style.color,
            background: style.backgroundColor,
          };
          probe.remove();
          return result;
        };
        return {
          boundary: readPaint(boundary),
          portal: readPaint(portal),
        };
      });
      expect(resolved.boundary, frame).toEqual(resolved.portal);
      expect(paint.backgroundColor, frame).toBe(resolved.boundary.background);
      expect(paint.color, frame).toBe(resolved.boundary.foreground);
      expect(paint.borderColor, frame).toBe('rgb(0, 0, 0)');
      // The source-aligned popup is flat in either portal location.
      expect(paint.boxShadow, frame).toBe('none');
      expect(paint.fontFamily.toLowerCase(), frame).toContain('dm sans');
      expect(paint.fontSize, frame).toBe('14px');
      expect(Number(paint.fontWeight), frame).toBe(500);
      expect(paint.textTransform, frame).toBe('none');
      expect(paint.paddingInline, frame).toBe('12px');
      expect(paint.paddingBlock, frame).toBe('6px');
      expect(paint.width, frame).toBeGreaterThan(20);
      expect(paint.height, frame).toBeGreaterThan(20);
      return paint;
    };

    try {
      // Choosing each declared runtime is the evidence: `selectRuntime` waits
      // for `[data-adapter-select-root].dataset.value` to equal it before the
      // host is accepted. Reading an option inventory would retest the
      // previewer's own Select, whose items exist only while it is open.
      // Pin the browser preference to Light; both palettes below must come from the host theme API.
      await page.emulateMedia({ colorScheme: 'light' });
      for (const runtime of RUNTIMES) {
        await selectRuntime(page, previewer, runtime, '[data-pui-root]', 7);
        await applyHostTheme(page, 'light');
        // Scoped to the rendered host: the previewer chrome is Proto UI too, so
        // a previewer-wide count is not evidence about this demo.
        const roots = previewer.locator(
          '[data-projection-content] .pui-runtime-preview-surface[data-demo-ref="__website_runtime_preview_surface__"] [data-pui-root]'
        );
        expect(await roots.count(), runtime).toBe(7);
        expect(await roots.nth(0).getAttribute('data-pui-root'), runtime).toBe('');
        const firstTrigger = roots.filter({ hasText: 'Hover or focus for details' }).last();
        const secondTrigger = roots.filter({ hasText: 'Move to the second trigger' }).last();
        await expect.poll(() => page.getByRole('tooltip').count(), { message: runtime }).toBe(0);

        await firstTrigger.hover();
        await page.waitForTimeout(100);
        expect(await page.getByRole('tooltip').count(), `${runtime}/cold-delay`).toBe(0);
        const firstTooltip = page
          .getByRole('tooltip')
          .filter({ hasText: 'Portable Base behavior, Brutalist visual grammar' });
        await expect.poll(() => firstTooltip.count(), { message: runtime }).toBe(1);
        const lightPaint = await expectTooltipPaint(
          firstTooltip,
          'Portable Base behavior, Brutalist visual grammar',
          `${runtime}/light`
        );
        const lightTooltipNode = await firstTooltip.elementHandle();
        if (!lightTooltipNode) throw new Error(`${runtime}: Tooltip Content has no DOM node.`);
        const firstTooltipId = lightPaint.id;
        expect(firstTooltipId, runtime).toBeTruthy();
        // The Brutalist projection materializes a closed theme copy, so Website
        // overrides on :root must not leak into the projected portal surface.
        const tooltipCanaries = {
          foreground: 'rgb(17, 83, 139)',
          background: 'rgb(211, 89, 127)',
        } as const;
        await page.evaluate(({ foreground, background }) => {
          const root = document.documentElement;
          root.style.setProperty('--pui-foreground', foreground);
          root.style.setProperty('--pui-background', background);
        }, tooltipCanaries);
        const canaryPaint = await expectTooltipPaint(
          firstTooltip,
          'Portable Base behavior, Brutalist visual grammar',
          `${runtime}/canary`
        );
        expect(canaryPaint.backgroundColor, `${runtime}/canary/fill-closure`).toBe(
          lightPaint.backgroundColor
        );
        expect(canaryPaint.color, `${runtime}/canary/ink-closure`).toBe(lightPaint.color);
        expect(canaryPaint.borderColor, `${runtime}/canary/border-closure`).toBe(
          lightPaint.borderColor
        );
        expect(canaryPaint.boxShadow, `${runtime}/canary/hard-shadow-closure`).toBe(
          lightPaint.boxShadow
        );
        await page.evaluate(() => {
          const root = document.documentElement;
          root.style.removeProperty('--pui-foreground');
          root.style.removeProperty('--pui-background');
        });
        await applyHostTheme(page, 'dark');
        const darkPaint = await expectTooltipPaint(
          firstTooltip,
          'Portable Base behavior, Brutalist visual grammar',
          `${runtime}/dark-repaint`
        );
        const darkTooltipNode = await firstTooltip.elementHandle();
        if (!darkTooltipNode) throw new Error(`${runtime}: Tooltip Content has no DOM node.`);
        const sameTooltipNode = await page.evaluate(
          ([before, after]) => before === after,
          [lightTooltipNode, darkTooltipNode]
        );
        expect(sameTooltipNode, `${runtime}/same-mounted-content`).toBe(true);
        await lightTooltipNode.dispose();
        await darkTooltipNode.dispose();
        expect(darkPaint.id, `${runtime}/same-mounted-content`).toBe(firstTooltipId);
        expect(darkPaint.backgroundColor, `${runtime}/live-fill-repaint`).not.toBe(
          lightPaint.backgroundColor
        );
        expect(darkPaint.color, `${runtime}/live-ink-repaint`).not.toBe(lightPaint.color);
        expect(
          (await firstTrigger.getAttribute('aria-describedby'))?.split(/\s+/),
          runtime
        ).toContain(firstTooltipId);

        // The Group is warm after the first owner closes, so the sibling opens without the cold delay.
        await secondTrigger.hover();
        const secondTooltip = page
          .getByRole('tooltip')
          .filter({ hasText: 'Group preserves the shared warm-delay domain' });
        await expect
          .poll(
            async () => ({
              second: await secondTooltip.count(),
              first: await firstTooltip.count(),
              total: await page.getByRole('tooltip').count(),
              firstOwnsDescription:
                (await firstTrigger.getAttribute('aria-describedby'))
                  ?.split(/\s+/)
                  .includes(firstTooltipId!) ?? false,
            }),
            { message: `${runtime}/warm-owner-handoff`, timeout: 300, interval: 25 }
          )
          .toEqual({ second: 1, first: 0, total: 1, firstOwnsDescription: false });
        await expectTooltipPaint(
          secondTooltip,
          'Group preserves the shared warm-delay domain',
          `${runtime}/dark-warm-owner`
        );

        const secondTooltipId = await secondTooltip.getAttribute('id');
        expect(secondTooltipId, runtime).toBeTruthy();
        expect(
          (await secondTrigger.getAttribute('aria-describedby'))?.split(/\s+/),
          runtime
        ).toContain(secondTooltipId);

        // Closing the final owner must unmount Content and remove its owned IDREF token.
        await page.mouse.move(0, 0);
        await expect
          .poll(
            async () => ({
              total: await page.getByRole('tooltip').count(),
              secondOwnsDescription:
                (await secondTrigger.getAttribute('aria-describedby'))
                  ?.split(/\s+/)
                  .includes(secondTooltipId!) ?? false,
            }),
            { message: `${runtime}/final-owner-teardown` }
          )
          .toEqual({ total: 0, secondOwnsDescription: false });
      }
    } finally {
      await context.close();
    }
  }, 90_000);

  it('contains Scroll Area and its scrollbar at 320px without document overflow', async () => {
    const viewportWidth = 320;
    const { context, page, previewer } = await openRoute(SCROLL_AREA_ROUTE, {
      width: viewportWidth,
      height: 844,
    });
    const widths: Array<{ runtime: RuntimeId; width: number }> = [];

    try {
      for (const runtime of RUNTIMES) {
        await selectRuntime(page, previewer, runtime, '[data-demo-ref="scrollbar"]', 1);
        const root = previewer
          .locator(
            '[data-projection-content] .pui-runtime-preview-surface[data-demo-ref="__website_runtime_preview_surface__"] [data-pui-root]'
          )
          .first();
        const scrollbar = previewer.locator('[data-demo-ref="scrollbar"]').first();
        const rootBox = await root.boundingBox();
        const scrollbarBox = await scrollbar.boundingBox();
        expect(rootBox, runtime).not.toBeNull();
        expect(scrollbarBox, runtime).not.toBeNull();

        widths.push({ runtime, width: rootBox!.width });
        const layoutChain = await previewer.evaluate((element) => {
          const selectors = [
            '[data-projection-generation-state="active"]',
            '[data-projection-scope]',
            '.pui-projection-controls',
            '[data-projection-control="runtime"]',
            '[data-projection-control="runtime"] [role="combobox"]',
            '[data-projection-control="runtime"] [data-projection-prototype$="select-value"]',
            '[data-projection-content]',
            '[data-projection-content] > div',
            '[data-projection-content] .pui-runtime-preview-surface[data-demo-ref="__website_runtime_preview_surface__"] [data-pui-root]',
          ];
          return {
            viewportWidth: innerWidth,
            documentWidth: document.documentElement.scrollWidth,
            nodes: selectors.map((selector) => {
              const node = element.querySelector<HTMLElement>(selector);
              if (!node) return { selector, missing: true } as const;
              const rect = node.getBoundingClientRect();
              const style = getComputedStyle(node);
              return {
                selector,
                tag: node.tagName,
                text: node.textContent?.trim().slice(0, 100),
                x: rect.x,
                width: rect.width,
                contentLeft:
                  rect.x + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft),
                contentRight:
                  rect.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight),
                clientWidth: node.clientWidth,
                scrollWidth: node.scrollWidth,
                display: style.display,
                cssWidth: style.width,
                minWidth: style.minWidth,
                maxWidth: style.maxWidth,
                boxSizing: style.boxSizing,
                padding: style.padding,
                flex: style.flex,
                gridTemplateColumns: style.gridTemplateColumns,
                runtime: node.dataset.projectionRuntime,
                generation: node.dataset.projectionGeneration,
                state: node.dataset.projectionState,
                prototype: node.dataset.projectionPrototype,
              };
            }),
          };
        });
        console.info('Scroll Area 320px layout chain', JSON.stringify({ runtime, ...layoutChain }));
        const layoutBox = (selector: string) => {
          const node = layoutChain.nodes.find((entry) => entry.selector === selector);
          if (!node || node.missing === true) {
            throw new Error(`${runtime}/${selector}: expected rendered layout node.`);
          }
          return node;
        };
        const scopeBox = layoutBox('[data-projection-scope]');
        const controlsBox = layoutBox('.pui-projection-controls');
        const contentBox = layoutBox('[data-projection-content]');
        const runtimeControlBox = layoutBox('[data-projection-control="runtime"]');
        // Document overflow alone cannot detect children clipped by the preview frame.
        for (const [name, box] of [
          ['toolbar', controlsBox],
          ['content', contentBox],
        ] as const) {
          expect(box.x, `${runtime}/${name}/scope-left`).toBeGreaterThanOrEqual(
            scopeBox.contentLeft - GEOMETRY_EPSILON
          );
          expect(box.x + box.width, `${runtime}/${name}/scope-right`).toBeLessThanOrEqual(
            scopeBox.contentRight + GEOMETRY_EPSILON
          );
        }
        expect(
          runtimeControlBox.x,
          `${runtime}/runtime-control/toolbar-left`
        ).toBeGreaterThanOrEqual(controlsBox.contentLeft - GEOMETRY_EPSILON);
        expect(
          runtimeControlBox.x + runtimeControlBox.width,
          `${runtime}/runtime-control/toolbar-right`
        ).toBeLessThanOrEqual(controlsBox.contentRight + GEOMETRY_EPSILON);
        expect(rootBox!.x, `${runtime}/root/content-left`).toBeGreaterThanOrEqual(
          contentBox.contentLeft - GEOMETRY_EPSILON
        );
        expect(rootBox!.x + rootBox!.width, `${runtime}/root/content-right`).toBeLessThanOrEqual(
          contentBox.contentRight + GEOMETRY_EPSILON
        );
        expect(rootBox!.x, runtime).toBeGreaterThanOrEqual(-GEOMETRY_EPSILON);
        expect(rootBox!.x + rootBox!.width, runtime).toBeLessThanOrEqual(
          viewportWidth + GEOMETRY_EPSILON
        );
        expect(scrollbarBox!.x, runtime).toBeGreaterThanOrEqual(rootBox!.x);
        expect(
          scrollbarBox!.x + scrollbarBox!.width,
          `${runtime}/scrollbar/root-right`
        ).toBeLessThanOrEqual(rootBox!.x + rootBox!.width + GEOMETRY_EPSILON);
        expect(scrollbarBox!.x + scrollbarBox!.width, runtime).toBeLessThanOrEqual(
          viewportWidth + GEOMETRY_EPSILON
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth
          ),
          runtime
        ).toBe(0);
      }

      const measuredWidths = widths.map(({ width }) => width);
      expect(
        Math.max(...measuredWidths) - Math.min(...measuredWidths),
        `Scroll Area width parity: ${JSON.stringify(widths)}`
      ).toBeLessThanOrEqual(GEOMETRY_EPSILON);
    } finally {
      await context.close();
    }
  }, 90_000);

  it('projects one native WC Textarea focus target and its Brutalist ring by modality', async () => {
    const { context, page, previewer } = await openRoute(TEXTAREA_ROUTE, {
      width: 1440,
      height: 900,
    });

    try {
      await previewer.scrollIntoViewIfNeeded();
      await selectRuntime(page, previewer, 'wc', 'textarea', 1);
      const runtimeSelect = runtimeSelectTrigger(previewer);
      const textarea = previewer.locator('textarea');

      const initial = await wcTextareaFocusSnapshot(previewer);
      expect(initial.textareaCount).toBe(1);
      expect(initial.hostTabIndex).toBeNull();
      expect(initial.surfaceTabIndex).toBe(0);

      for (const colorScheme of COLOR_SCHEMES) {
        await applyColorScheme(page, colorScheme);
        await runtimeSelect.focus();
        await page.keyboard.press('Tab');
        await page.waitForFunction(
          () => {
            const root = document.querySelector<HTMLElement>(
              '[data-previewer-id] [data-projection-content] .pui-runtime-preview-surface[data-demo-ref="__website_runtime_preview_surface__"] [data-pui-root]'
            );
            return (
              root?.hasAttribute('data-focused') === true && root.hasAttribute('data-focus-visible')
            );
          },
          undefined,
          { timeout: 10_000 }
        );

        const keyboard = await wcTextareaFocusSnapshot(previewer);
        expect(keyboard.active, `${colorScheme}/keyboard active target`).toBe(true);
        expect(keyboard.focused, `${colorScheme}/keyboard focused expose`).toBe(true);
        expect(keyboard.focusVisible, `${colorScheme}/keyboard focusVisible expose`).toBe(true);
        expect(keyboard.hostFocused, `${colorScheme}/keyboard host focused marker`).toBe(true);
        expect(keyboard.hostFocusVisible, `${colorScheme}/keyboard host marker`).toBe(true);
        expect(keyboard.surfaceFocusVisible, `${colorScheme}/keyboard surface marker`).toBe(true);

        expect(keyboard.boxShadow, `${colorScheme}/physical ring inner edge`).toContain(
          '0px 0px 0px 2px'
        );
        expect(keyboard.boxShadow, `${colorScheme}/physical ring outer edge`).toContain(
          '0px 0px 0px 4px'
        );
        await textarea.evaluate((element) => (element as HTMLTextAreaElement).blur());
        await page.waitForFunction(
          () =>
            !document
              .querySelector<HTMLElement>(
                '[data-previewer-id] [data-projection-content] .pui-runtime-preview-surface[data-demo-ref="__website_runtime_preview_surface__"] [data-pui-root]'
              )
              ?.hasAttribute('data-focused')
        );
        const blurred = await wcTextareaFocusSnapshot(previewer);
        expect(blurred.focused, `${colorScheme}/blur focused expose`).toBe(false);
        expect(blurred.focusVisible, `${colorScheme}/blur focusVisible expose`).toBe(false);

        await textarea.click();
        await page.waitForFunction(
          () =>
            document
              .querySelector<HTMLElement>(
                '[data-previewer-id] [data-projection-content] .pui-runtime-preview-surface[data-demo-ref="__website_runtime_preview_surface__"] [data-pui-root]'
              )
              ?.hasAttribute('data-focused') === true
        );
        const pointer = await wcTextareaFocusSnapshot(previewer);
        expect(pointer.active, `${colorScheme}/pointer active target`).toBe(true);
        expect(pointer.focused, `${colorScheme}/pointer focused expose`).toBe(true);
        expect(pointer.focusVisible, `${colorScheme}/pointer focusVisible expose`).toBe(
          pointer.nativeFocusVisible
        );
        expect(pointer.hostFocusVisible, `${colorScheme}/pointer host marker`).toBe(
          pointer.nativeFocusVisible
        );
        expect(pointer.surfaceFocusVisible, `${colorScheme}/pointer surface marker`).toBe(
          pointer.nativeFocusVisible
        );
        if (pointer.nativeFocusVisible) {
          expect(pointer.boxShadow, `${colorScheme}/host-derived ring`).toBe(keyboard.boxShadow);
        } else {
          expect(pointer.boxShadow, `${colorScheme}/host-derived no-ring`).not.toBe(
            keyboard.boxShadow
          );
        }
        await textarea.evaluate((element) => (element as HTMLTextAreaElement).blur());
      }
    } finally {
      await applyColorScheme(page, 'light');
      await context.close();
    }
  }, 90_000);

  it('keeps Textarea demo controls and logs readable in both themes and all runtimes', async () => {
    const { context, page, previewer } = await openRoute(TEXTAREA_ROUTE, {
      width: 1440,
      height: 900,
    });

    try {
      await previewer.scrollIntoViewIfNeeded();
      for (const runtime of RUNTIMES) {
        await selectRuntime(page, previewer, runtime, '[data-demo-ref="eventLog"]', 1);

        for (const colorScheme of COLOR_SCHEMES) {
          await applyColorScheme(page, colorScheme);

          const atRest = await demoSurfaceContrast(
            page,
            TEXTAREA_DEMO_SCOPE,
            TEXTAREA_DEMO_SURFACES
          );
          for (const ref of TEXTAREA_DEMO_SURFACES) {
            expect(
              atRest[ref].text,
              `${runtime}/${colorScheme}/${ref}/rest text`
            ).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
            expect(
              atRest[ref].border,
              `${runtime}/${colorScheme}/${ref}/rest border`
            ).toBeGreaterThanOrEqual(MIN_BOUNDARY_CONTRAST);
          }

          await previewer.locator('[data-demo-ref="focusButton"]').hover();
          await previewer.locator('[data-demo-ref="focusButton"]').focus();
          const whileActive = await demoSurfaceContrast(page, TEXTAREA_DEMO_SCOPE, ['focusButton']);
          expect(
            whileActive.focusButton.text,
            `${runtime}/${colorScheme}/focusButton/hover-focus`
          ).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);

          await previewer.locator('[data-demo-ref="toggleProps"]').click();
          await page.waitForFunction(
            () =>
              document
                .querySelector(
                  '[data-demo-id="demo-brutalist-textarea"] [data-demo-ref="stateLabel"]'
                )
                ?.textContent?.includes('disabled=true') === true
          );
          const whileDisabled = await demoSurfaceContrast(
            page,
            TEXTAREA_DEMO_SCOPE,
            TEXTAREA_DEMO_SURFACES
          );
          for (const ref of TEXTAREA_DEMO_SURFACES) {
            expect(
              whileDisabled[ref].text,
              `${runtime}/${colorScheme}/${ref}/disabled text`
            ).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
            expect(
              whileDisabled[ref].border,
              `${runtime}/${colorScheme}/${ref}/disabled border`
            ).toBeGreaterThanOrEqual(MIN_BOUNDARY_CONTRAST);
          }

          await previewer.locator('[data-demo-ref="toggleProps"]').click();
          await page.waitForFunction(
            () =>
              document
                .querySelector(
                  '[data-demo-id="demo-brutalist-textarea"] [data-demo-ref="stateLabel"]'
                )
                ?.textContent?.includes('disabled=false') === true
          );
        }
      }
    } finally {
      await applyColorScheme(page, 'light');
      await context.close();
    }
  }, 150_000);

  it('contains the Textarea demo at 320px without document overflow', async () => {
    const viewportWidth = 320;
    const { context, page, previewer } = await openRoute(TEXTAREA_ROUTE, {
      width: viewportWidth,
      height: 844,
    });

    try {
      // The previewer mounts its demo lazily, so it has to reach the viewport
      // before a runtime switch can settle at this width.
      await previewer.scrollIntoViewIfNeeded();
      for (const runtime of RUNTIMES) {
        await selectRuntime(page, previewer, runtime, '[data-demo-ref="eventLog"]', 1);
        for (const ref of TEXTAREA_DEMO_SURFACES) {
          const box = await previewer.locator(`[data-demo-ref="${ref}"]`).boundingBox();
          expect(box, `${runtime}/${ref}`).not.toBeNull();
          expect(box!.x, `${runtime}/${ref}`).toBeGreaterThanOrEqual(-GEOMETRY_EPSILON);
          expect(box!.x + box!.width, `${runtime}/${ref}`).toBeLessThanOrEqual(
            viewportWidth + GEOMETRY_EPSILON
          );
        }
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth
          ),
          runtime
        ).toBe(0);
      }
    } finally {
      await context.close();
    }
  }, 120_000);
  it('rings the focused Scroll Area inside its own box, in both themes and all runtimes', async () => {
    const { context, page, previewer } = await openRoute(SCROLL_AREA_ROUTE, {
      width: 1440,
      height: 900,
    });

    try {
      for (const runtime of RUNTIMES) {
        await selectRuntime(page, previewer, runtime, '[data-demo-ref="scrollbar"]', 1);
        for (const scheme of COLOR_SCHEMES) {
          await applyColorScheme(page, scheme);
          const label = `${runtime}/${scheme}`;

          const resting = await viewportRing(page);
          expect(resting.focusVisible, `${label}/resting-focus`).toBe(false);
          expect(resting.insetLayers, `${label}/resting-ring`).toHaveLength(0);

          await runtimeSelectTrigger(previewer).focus();
          await page.keyboard.press('Tab');
          await page.waitForFunction(
            () =>
              document
                .querySelector('[data-previewer-id] [data-demo-ref="scrollViewport"]')
                ?.hasAttribute('data-focus-visible') === true,
            undefined,
            { timeout: 10_000 }
          );

          const focused = await viewportRing(page);
          // Exactly one inset layer, drawn from the theme ring.
          expect(focused.insetLayers, `${label}/inset-count`).toHaveLength(1);
          // Zero offsets with a positive spread is the whole border box, so the
          // ring shows on all four sides rather than only where it is not clipped.
          expect(focused.insetLayers[0], `${label}/inset-shape`).toMatch(
            /^\S.*\s0px 0px 0px [1-9]\d*px inset$/
          );
          // Every other composed layer draws nothing, so no outward ring exists
          // for the Root to clip. `ring-offset-0` collapses the offset layer and
          // the Viewport declares no shadow of its own.
          for (const layer of focused.layers.filter((entry) => !entry.includes('inset'))) {
            expect(layer, `${label}/outward`).toMatch(/(?:0px 0px 0px 0px$|^rgba\(0, 0, 0, 0\))/);
          }

          // Taking focus must not move or resize the surface.
          expect(focused.bounds, `${label}/geometry`).toEqual(resting.bounds);

          // Both axes still scroll while the ring is up. Scrolling is smooth and
          // this run shares one dev server, so wait on the position rather than
          // on a fixed delay that a loaded run can outlast.
          await page.keyboard.press('ArrowDown');
          await waitForScrollBeyond(page, 'scrollTop', focused.scrollTop);
          await page.keyboard.press('ArrowRight');
          await waitForScrollBeyond(page, 'scrollLeft', focused.scrollLeft);

          const scrolled = await viewportRing(page);
          expect(scrolled.insetLayers, `${label}/ring-after-scroll`).toEqual(focused.insetLayers);
          expect(scrolled.bounds, `${label}/geometry-after-scroll`).toEqual(resting.bounds);

          // Blur so the next scheme starts from a resting surface. The scroll
          // position is left where it is: selectRuntime remounts the demo
          // between runtimes, and four arrow presses stay well inside the
          // surface, so nothing here needs to drive the scroll offset back.
          await page.mouse.click(5, 5);
          await page.waitForFunction(
            () =>
              document
                .querySelector('[data-previewer-id] [data-demo-ref="scrollViewport"]')
                ?.hasAttribute('data-focused') === false,
            undefined,
            { timeout: 10_000 }
          );
        }
      }
    } finally {
      await context.close();
    }
  }, 240_000);

  it('repaints theme-following Button fills on a host theme change in all runtimes', async () => {
    const { context, page, previewer } = await openRoute(BUTTON_ROUTE, {
      width: 1440,
      height: 900,
    });

    try {
      // Pinned for the whole case, and never changed again. Dark is then reached
      // only through the host theme, so a media-query implementation cannot
      // satisfy any measurement below.
      await page.emulateMedia({ colorScheme: 'light' });

      for (const runtime of EVERY_RUNTIME) {
        await selectPreviewRuntime(page, previewer, runtime, '[data-demo-ref="surface"]', 1);
        // Park the pointer off the demo: a repaint that needed a hover to land
        // would otherwise pass here and fail for a reader who never moves.
        await page.mouse.move(0, 0);

        const painted: Record<
          ColorScheme,
          Record<keyof typeof BUTTON_FILLS, ButtonFill>
        > = {} as never;
        for (const scheme of COLOR_SCHEMES) {
          await applyHostTheme(page, scheme);

          const rootSignal = await page.evaluate(() => ({
            theme: document.documentElement.dataset.theme,
            darkClass: document.documentElement.classList.contains('dark'),
          }));
          expect(rootSignal.theme, `${runtime}/${scheme}/host-signal`).toBe(scheme);
          // The documentation toggle sets no class. If this case set one, a
          // broken `:root[data-theme='dark']` selector would still look healthy
          // here while the real toggle left mounted Buttons in Light.
          expect(rootSignal.darkClass, `${runtime}/${scheme}/no-class-signal`).toBe(false);

          const fills = await buttonFills(page);
          painted[scheme] = fills;

          for (const [ref, fill] of Object.entries(fills)) {
            const label = `${runtime}/${scheme}/${ref}`;
            // Each fill is the theme variable it names, not a copy of the value
            // that variable happened to hold when the control mounted.
            expect(fill.background, `${label}/background`).toBe(fill.variables.background);
            expect(fill.color, `${label}/color`).toBe(fill.variables.color);
            expect(fill.hovered, `${label}/hovered`).toBe(false);
            expect(fill.pressed, `${label}/pressed`).toBe(false);
          }

          // Disabled lowers emphasis without leaving the theme: same pair as the
          // enabled control of the same variant, at half opacity.
          expect(fills.disabledSurface.background, `${runtime}/${scheme}/disabled-pair`).toBe(
            fills.surface.background
          );
          expect(fills.disabledSurface.color, `${runtime}/${scheme}/disabled-ink`).toBe(
            fills.surface.color
          );
          expect(fills.disabledSurface.opacity, `${runtime}/${scheme}/disabled-opacity`).toBe(
            '0.5'
          );
        }

        // Surface is the fill this family moves between schemes; if the theme
        // ever collapsed, every assertion above would still hold.
        expect(painted.dark.surface.background, `${runtime}/surface-moves`).not.toBe(
          painted.light.surface.background
        );
        expect(painted.dark.disabledSurface.background, `${runtime}/disabled-moves`).not.toBe(
          painted.light.disabledSurface.background
        );
        // Accent pairs are theme-invariant, enabled and disabled alike.
        expect(painted.dark.solidMain.background, `${runtime}/accent-invariant`).toBe(
          painted.light.solidMain.background
        );
        expect(painted.dark.solidMain.color, `${runtime}/accent-ink-invariant`).toBe(
          painted.light.solidMain.color
        );
        expect(painted.dark.disabledSolid.background, `${runtime}/disabled-accent`).toBe(
          painted.light.disabledSolid.background
        );

        // Back to the scheme this runtime started in, so the repaint is proven
        // to run both ways rather than only into Dark.
        await applyHostTheme(page, 'light');
        const restored = await buttonFills(page);
        expect(restored.surface.background, `${runtime}/restored`).toBe(
          painted.light.surface.background
        );
        expect(restored.surface.color, `${runtime}/restored-ink`).toBe(painted.light.surface.color);

        // Both schemes above are palettes an implementation could hard-code.
        // Exercise arbitrary values through a test-owned real candidate's
        // public owner channel. The Website Light/Dark integration above stays
        // unchanged; direct child writes bypass its theme owner (#764).
        const owner = await createCanaryThemeOwner(page, runtime);
        let scope: JSHandle<HTMLElement> | undefined;
        let canaryFailed = false;
        try {
          scope = await owner.getProperty('mount');
          const baseline = await buttonFills(page, scope);
          await applyCanaryTheme(page, owner, true);
          const canary = await buttonFills(page, scope);
          for (const [ref, fill] of Object.entries(canary)) {
            const key = ref as keyof typeof BUTTON_FILLS;
            const label = `${runtime}/canary/${ref}`;
            const [backgroundVar] = BUTTON_FILLS[key];
            if (backgroundVar in CANARY_VALUES) {
              // A theme-following fill has to land on the moved variable. A pair
              // hard-coded to a value both palettes share satisfies both schemes
              // and fails here, which is the whole point of the canary.
              expect(fill.background, `${label}/background`).toBe(fill.variables.background);
              expect(fill.color, `${label}/color`).toBe(fill.variables.color);
              expect(fill.background, `${label}/moved`).not.toBe(baseline[key].background);
              expect(fill.color, `${label}/ink-moved`).not.toBe(baseline[key].color);
              continue;
            }
            // A fixed accent pair owns no theme variable to follow, so moving the
            // surface and destructive variables must leave it exactly where it was.
            expect(fill.background, `${label}/fixed`).toBe(baseline[key].background);
            expect(fill.color, `${label}/fixed-ink`).toBe(baseline[key].color);
          }
          await applyCanaryTheme(page, owner, false);
          expect(await buttonFills(page, scope), `${runtime}/canary/owner-restored`).toEqual(
            baseline
          );
        } catch (error) {
          canaryFailed = true;
          throw error;
        } finally {
          try {
            const evidence = await owner.evaluate(
              (state, properties) => ({
                events: state.events,
                expectedRestamp: state.expectedRestamp,
                nodes: Object.fromEntries(
                  Object.entries(state.nodes).map(([ref, node]) => [
                    ref,
                    {
                      connected: node.isConnected,
                      sameNode: state.mount.querySelector(`[data-demo-ref="${ref}"]`) === node,
                      inline: Object.fromEntries(
                        properties.map((name) => [name, node.style.getPropertyValue(name)])
                      ),
                      background: getComputedStyle(node).backgroundColor,
                    },
                  ])
                ),
              }),
              Object.keys(CANARY_VALUES)
            );
            console.info(
              'BUTTON_CANARY_OWNER_EVIDENCE',
              JSON.stringify({ runtime, outcome: canaryFailed ? 'failed' : 'passed', ...evidence })
            );
          } catch (error) {
            console.warn('BUTTON_CANARY_OWNER_EVIDENCE unavailable', error);
          }
          let cleanupFailed = false;
          let cleanupFailure: unknown;
          const cleanup = async (action: () => void | Promise<void>) => {
            try {
              await action();
            } catch (error) {
              if (!cleanupFailed) cleanupFailure = error;
              cleanupFailed = true;
              console.warn('Button canary cleanup failed', error);
            }
          };
          try {
            await cleanup(() =>
              owner.evaluate(async (state) => {
                try {
                  await state.candidate.dispose();
                } finally {
                  state.mount.remove();
                }
              })
            );
          } finally {
            try {
              await cleanup(() => scope?.dispose());
            } finally {
              await cleanup(() => owner.dispose());
            }
          }
          if (cleanupFailed && !canaryFailed) throw cleanupFailure;
        }
      }
    } finally {
      await context.close();
    }
  }, 240_000);
});
