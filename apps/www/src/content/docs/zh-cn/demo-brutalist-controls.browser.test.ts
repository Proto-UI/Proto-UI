// @vitest-environment node

import { spawn, type ChildProcess } from 'node:child_process';
import { access } from 'node:fs/promises';
import { createServer } from 'node:net';
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const RUNTIMES = ['wc', 'react', 'vue'] as const;
type RuntimeId = (typeof RUNTIMES)[number];

const SWITCH_ROUTE = '/en/ui-libraries/brutalist/components/switch/';
const TABS_ROUTE = '/en/ui-libraries/brutalist/components/tabs/';
const SCROLL_AREA_ROUTE = '/en/ui-libraries/brutalist/components/scroll-area/';
const TEXTAREA_ROUTE = '/en/ui-libraries/brutalist/components/textarea/';
const DROPDOWN_ROUTE = '/en/ui-libraries/brutalist/components/dropdown-menu/';
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
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (devServer && devServer.exitCode !== null) {
      throw new Error(`Documentation dev server exited early.\n${serverOutput}`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
    } catch {
      // The dev server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}.\n${serverOutput}`);
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
  const signalTarget = process.platform === 'win32' ? devServer.pid : -devServer.pid;
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
  await previewer.locator('select.adapter-select').selectOption(runtime);
  await page.waitForFunction(
    ({ expectedCount: count, readySelector: selector, runtime: selectedRuntime }) => {
      const root = document.querySelector<HTMLElement>('[data-previewer-id]');
      const select = root?.querySelector<HTMLSelectElement>('select.adapter-select');
      const host = root?.querySelector<HTMLElement>('.host');
      const firstRoot = host?.querySelector<HTMLElement>('[data-pui-root]');
      if (!root || !select || !host || select.value !== selectedRuntime) return false;
      if (root.querySelectorAll(selector).length !== count || !firstRoot) return false;
      if (selectedRuntime === 'wc') return firstRoot.tagName.startsWith('WC-');
      if (selectedRuntime === 'vue') return host.hasAttribute('data-v-app');
      // React owns neither a custom element nor a Vue app root. The host tag is
      // not always a div: a text-control Prototype roots on its native control.
      return !firstRoot.tagName.startsWith('WC-') && !host.hasAttribute('data-v-app');
    },
    { expectedCount, readySelector, runtime },
    { timeout: 20_000 }
  );
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
    const host = root.querySelector<HTMLElement>('.host [data-pui-root]');
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
        const root = previewer.locator('.host > [data-pui-root]').first();
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
        const trigger = previewer.locator('[data-pui-root]').nth(1);
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

  it('contains Scroll Area and its scrollbar at 320px without document overflow', async () => {
    const viewportWidth = 320;
    const { context, page, previewer } = await openRoute(SCROLL_AREA_ROUTE, {
      width: viewportWidth,
      height: 844,
    });
    const widths: number[] = [];

    try {
      for (const runtime of RUNTIMES) {
        await selectRuntime(page, previewer, runtime, '[data-demo-ref="scrollbar"]', 1);
        const root = previewer.locator('.host > div > [data-pui-root]').first();
        const scrollbar = previewer.locator('[data-demo-ref="scrollbar"]').first();
        const rootBox = await root.boundingBox();
        const scrollbarBox = await scrollbar.boundingBox();
        expect(rootBox, runtime).not.toBeNull();
        expect(scrollbarBox, runtime).not.toBeNull();

        widths.push(rootBox!.width);
        expect(rootBox!.x, runtime).toBeGreaterThanOrEqual(-GEOMETRY_EPSILON);
        expect(rootBox!.x + rootBox!.width, runtime).toBeLessThanOrEqual(
          viewportWidth + GEOMETRY_EPSILON
        );
        expect(scrollbarBox!.x, runtime).toBeGreaterThanOrEqual(rootBox!.x);
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

      expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(GEOMETRY_EPSILON);
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
      const runtimeSelect = previewer.locator('select.adapter-select');
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
              '[data-previewer-id] .host [data-pui-root]'
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
              .querySelector<HTMLElement>('[data-previewer-id] .host [data-pui-root]')
              ?.hasAttribute('data-focused')
        );
        const blurred = await wcTextareaFocusSnapshot(previewer);
        expect(blurred.focused, `${colorScheme}/blur focused expose`).toBe(false);
        expect(blurred.focusVisible, `${colorScheme}/blur focusVisible expose`).toBe(false);

        await textarea.click();
        await page.waitForFunction(
          () =>
            document
              .querySelector<HTMLElement>('[data-previewer-id] .host [data-pui-root]')
              ?.hasAttribute('data-focused') === true
        );
        const pointer = await wcTextareaFocusSnapshot(previewer);
        expect(pointer.active, `${colorScheme}/pointer active target`).toBe(true);
        expect(pointer.focused, `${colorScheme}/pointer focused expose`).toBe(true);
        expect(pointer.focusVisible, `${colorScheme}/pointer focusVisible expose`).toBe(false);
        expect(pointer.hostFocusVisible, `${colorScheme}/pointer host marker`).toBe(false);
        expect(pointer.surfaceFocusVisible, `${colorScheme}/pointer surface marker`).toBe(false);
        expect(pointer.boxShadow, `${colorScheme}/modality-specific ring`).not.toBe(
          keyboard.boxShadow
        );
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

          await previewer.locator('select.adapter-select').focus();
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
});
