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
import { choosePreviewRuntime, runtimeSelectTrigger } from './browser-harness';

const RUNTIMES = ['wc', 'react', 'vue'] as const;
type RuntimeId = (typeof RUNTIMES)[number];

const COLOR_SCHEMES = ['light', 'dark'] as const;
type ColorScheme = (typeof COLOR_SCHEMES)[number];

const TEXTAREA_ROUTE = '/en/ui-libraries/base/textarea/';
const SCROLL_AREA_ROUTE = '/en/ui-libraries/base/scroll-area/';

/** The demo order: one surface that overflows, one that fits its content. */
const SCROLLING = 0;
const FITTING = 1;
const VIEWPORT_SELECTOR = '[data-pui-scroll-projection]';
const TEXTAREA_DEMO_SCOPE = '[data-demo-id="demo-base-textarea"]';
const TEXTAREA_OUTPUT_SURFACES = ['stateLabel', 'eventLog', 'help'] as const;
const MIN_TEXT_CONTRAST = 4.5;

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

async function spawnServer(): Promise<string> {
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
  await waitForServer(`${url}${TEXTAREA_ROUTE}`);
  return url;
}

async function startServer(): Promise<string> {
  const externalBaseUrl = process.env.PROTO_UI_BROWSER_BASE_URL?.replace(/\/$/, '');
  if (externalBaseUrl) {
    await waitForServer(`${externalBaseUrl}${TEXTAREA_ROUTE}`);
    return externalBaseUrl;
  }

  // availablePort() releases the socket before the child binds it, so two
  // browser suites running in parallel can be handed the same port and
  // --strictPort kills the loser. Retry on a fresh port instead.
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await spawnServer();
    } catch (error) {
      lastError = error;
      await stopServer();
      devServer = null;
      serverOutput = '';
    }
  }
  throw lastError;
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
  await choosePreviewRuntime(page, previewer, runtime);
  await page.waitForFunction(
    ({ expectedCount: count, readySelector: selector, runtime: selectedRuntime }) => {
      const root = document.querySelector<HTMLElement>('[data-previewer-id]');
      const select = root?.querySelector<HTMLElement>('[data-adapter-select-root]');
      const host = root?.querySelector<HTMLElement>('.host');
      const firstRoot = host?.querySelector<HTMLElement>('[data-pui-root]');
      if (!root || !select || !host || select.dataset.value !== selectedRuntime) return false;
      if (host.querySelectorAll(selector).length !== count || !firstRoot) return false;
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

/**
 * Returns the text contrast ratio of each demo ref. Colours resolve through a
 * 1x1 canvas so `lab()`, `oklch()`, and other non-`rgb()` computed values are
 * measured as painted. These surfaces paint no background of their own, so the
 * backdrop composites every translucent ancestor - the previewer panel is 30%
 * alpha - down onto the nearest opaque one.
 */
async function demoTextContrast(
  page: Page,
  scope: string,
  refs: readonly string[]
): Promise<Record<string, number>> {
  return page.evaluate(
    ({ scope: scopeSelector, refs: surfaceRefs }) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Canvas 2D context is required to resolve painted colours.');

      const paint = (color: string): [number, number, number, number] => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = 'rgba(0,0,0,0)';
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
        return [r, g, b, a / 255];
      };
      const backdrop = (element: Element): [number, number, number] => {
        const translucent: [number, number, number, number][] = [];
        let current: Element | null = element;
        let opaque: [number, number, number] | null = null;
        while (current) {
          const color = paint(getComputedStyle(current).backgroundColor);
          if (color[3] >= 0.999) {
            opaque = [color[0], color[1], color[2]];
            break;
          }
          if (color[3] > 0) translucent.push(color);
          current = current.parentElement;
        }
        if (!opaque) {
          const fallback = paint(getComputedStyle(document.body).backgroundColor);
          opaque = [fallback[0], fallback[1], fallback[2]];
        }
        let composed = opaque;
        for (let index = translucent.length - 1; index >= 0; index -= 1) {
          const [r, g, b, a] = translucent[index];
          composed = [
            r * a + composed[0] * (1 - a),
            g * a + composed[1] * (1 - a),
            b * a + composed[2] * (1 - a),
          ];
        }
        return composed;
      };
      const luminance = ([r, g, b]: [number, number, number]): number => {
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

      const demo = document.querySelector(scopeSelector);
      if (!demo) throw new Error(`Demo scope ${scopeSelector} is missing.`);

      const result: Record<string, number> = {};
      for (const ref of surfaceRefs) {
        const element = demo.querySelector(`[data-demo-ref="${ref}"]`);
        if (!element) throw new Error(`Demo ref ${ref} is missing.`);
        const [r, g, b] = paint(getComputedStyle(element).color);
        result[ref] = ratio(luminance([r, g, b]), luminance(backdrop(element)));
      }
      return result;
    },
    { scope, refs }
  );
}

type ViewportFacts = {
  tabIndexAttribute: string | null;
  role: string | null;
  focused: boolean;
  focusVisible: boolean;
  canScroll: boolean;
  scrollTop: number;
  focusableInRoot: number;
};

/** Reads both Viewports the way a keyboard user meets them. */
async function viewportFacts(page: Page): Promise<ViewportFacts[]> {
  return page.evaluate((selector) => {
    const viewports = [
      ...document.querySelectorAll<HTMLElement>(`[data-previewer-id] ${selector}`),
    ];
    return viewports.map((viewport) => {
      const root = viewport.closest<HTMLElement>(
        '[data-pui-root]:not([data-pui-scroll-projection])'
      );
      return {
        tabIndexAttribute: viewport.getAttribute('tabindex'),
        role: viewport.getAttribute('role'),
        focused: viewport.hasAttribute('data-focused'),
        focusVisible: viewport.hasAttribute('data-focus-visible'),
        canScroll:
          viewport.hasAttribute('data-scroll-vertical-can-scroll-after') ||
          viewport.hasAttribute('data-scroll-vertical-can-scroll-before'),
        scrollTop: viewport.scrollTop,
        focusableInRoot: [...(root ?? viewport).querySelectorAll<HTMLElement>('*')].filter(
          (node) => node.tabIndex >= 0
        ).length,
      };
    });
  }, VIEWPORT_SELECTOR);
}

/** Adds or removes content so the fitting surface crosses the overflow boundary. */
async function setFittingContent(page: Page, rows: number): Promise<void> {
  await page.evaluate(
    ({ selector, rows: count }) => {
      const viewport = document.querySelectorAll<HTMLElement>(`[data-previewer-id] ${selector}`)[1];
      if (!viewport) throw new Error('The Base Scroll Area demo must render two Viewports.');
      const list = viewport.firstElementChild;
      if (!list) throw new Error('The fitting Viewport must render its content list.');
      list.querySelectorAll('[data-test-row]').forEach((row) => row.remove());
      for (let index = 0; index < count; index += 1) {
        const row = document.createElement('div');
        row.setAttribute('data-test-row', '');
        row.textContent = `Added row ${index + 1}`;
        list.append(row);
      }
    },
    { selector: VIEWPORT_SELECTOR, rows }
  );
}

/**
 * Waits on the scroll fact rather than on the tab stop. The fact is published
 * with or without the focus slice, so a missing tab stop fails on the assertion
 * that names it instead of on a readiness timeout that does not.
 */
/**
 * A wheel notch is delivered asynchronously and the scroll may be smoothed, so
 * a fixed pause races the browser under load. Wait for the offset instead.
 */
async function waitForScrolled(page: Page, index: number): Promise<void> {
  await page.waitForFunction(
    ({ selector, index: at }) => {
      const viewport = document.querySelectorAll<HTMLElement>(`[data-previewer-id] ${selector}`)[
        at
      ];
      return Boolean(viewport && viewport.scrollTop > 0);
    },
    { selector: VIEWPORT_SELECTOR, index },
    { timeout: 10_000 }
  );
}

async function waitForCanScroll(page: Page, index: number, expected: boolean): Promise<void> {
  await page.waitForFunction(
    ({ selector, index: at, expected: want }) => {
      const viewport = document.querySelectorAll<HTMLElement>(`[data-previewer-id] ${selector}`)[
        at
      ];
      if (!viewport) return false;
      return viewport.hasAttribute('data-scroll-vertical-can-scroll-after') === want;
    },
    { selector: VIEWPORT_SELECTOR, index, expected },
    { timeout: 10_000 }
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

describe.sequential('Base control documentation browser regressions', () => {
  it('keeps Textarea demo output surfaces readable in both themes and all runtimes', async () => {
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

          const atRest = await demoTextContrast(
            page,
            TEXTAREA_DEMO_SCOPE,
            TEXTAREA_OUTPUT_SURFACES
          );
          for (const ref of TEXTAREA_OUTPUT_SURFACES) {
            expect(atRest[ref], `${runtime}/${colorScheme}/${ref}/rest`).toBeGreaterThanOrEqual(
              MIN_TEXT_CONTRAST
            );
          }

          // The output panels carry live text; measure them again once the demo
          // has written into them, since that is the state a reader looks at.
          await previewer.locator('[data-demo-ref="toggleProps"]').click();
          await page.waitForFunction(
            (scope) =>
              document
                .querySelector(`${scope} [data-demo-ref="stateLabel"]`)
                ?.textContent?.includes('disabled=true') === true,
            TEXTAREA_DEMO_SCOPE
          );
          const whileDisabled = await demoTextContrast(
            page,
            TEXTAREA_DEMO_SCOPE,
            TEXTAREA_OUTPUT_SURFACES
          );
          for (const ref of TEXTAREA_OUTPUT_SURFACES) {
            expect(
              whileDisabled[ref],
              `${runtime}/${colorScheme}/${ref}/disabled`
            ).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
          }

          await previewer.locator('[data-demo-ref="toggleProps"]').click();
          await page.waitForFunction(
            (scope) =>
              document
                .querySelector(`${scope} [data-demo-ref="stateLabel"]`)
                ?.textContent?.includes('disabled=false') === true,
            TEXTAREA_DEMO_SCOPE
          );
        }
      }
    } finally {
      await context.close();
    }
  }, 180_000);
  it('gives a tab stop only to the Viewport that can scroll, in all runtimes', async () => {
    const { context, page, previewer } = await openRoute(SCROLL_AREA_ROUTE, {
      width: 1440,
      height: 900,
    });

    try {
      await previewer.scrollIntoViewIfNeeded();
      for (const runtime of RUNTIMES) {
        await selectRuntime(page, previewer, runtime, VIEWPORT_SELECTOR, 2);
        await waitForCanScroll(page, SCROLLING, true);

        const facts = await viewportFacts(page);
        expect(facts, `${runtime}/count`).toHaveLength(2);
        expect(facts[SCROLLING].canScroll, `${runtime}/scrolling-can-scroll`).toBe(true);
        expect(facts[FITTING].canScroll, `${runtime}/fitting-can-scroll`).toBe(false);

        // A surface with nowhere to scroll would be an empty tab stop.
        expect(facts[SCROLLING].tabIndexAttribute, `${runtime}/scrolling-tabindex`).toBe('0');
        expect(facts[FITTING].tabIndexAttribute, `${runtime}/fitting-tabindex`).toBe('-1');

        for (const [index, viewport] of facts.entries()) {
          // Taking focus is not a reason to invent a widget role.
          expect(viewport.role, `${runtime}/role-${index}`).toBeNull();
        }
        // One tab stop per scrolling Scroll Area, and it is the Viewport. A
        // second focusable node inside the same Root would be a duplicate stop.
        expect(facts[SCROLLING].focusableInRoot, `${runtime}/scrolling-stops`).toBe(1);
        expect(facts[FITTING].focusableInRoot, `${runtime}/fitting-stops`).toBe(0);
      }
    } finally {
      await context.close();
    }
  }, 240_000);

  it('follows content between scrollable and not, in all runtimes', async () => {
    const { context, page, previewer } = await openRoute(SCROLL_AREA_ROUTE, {
      width: 1440,
      height: 900,
    });

    try {
      await previewer.scrollIntoViewIfNeeded();
      for (const runtime of RUNTIMES) {
        await selectRuntime(page, previewer, runtime, VIEWPORT_SELECTOR, 2);
        await waitForCanScroll(page, FITTING, false);
        expect(
          (await viewportFacts(page))[FITTING].tabIndexAttribute,
          `${runtime}/fitting-before`
        ).toBe('-1');

        await setFittingContent(page, 12);
        await waitForCanScroll(page, FITTING, true);
        expect((await viewportFacts(page))[FITTING].tabIndexAttribute, `${runtime}/grown`).toBe(
          '0'
        );

        await setFittingContent(page, 0);
        await waitForCanScroll(page, FITTING, false);
        expect((await viewportFacts(page))[FITTING].tabIndexAttribute, `${runtime}/shrunk`).toBe(
          '-1'
        );
      }
    } finally {
      await context.close();
    }
  }, 240_000);

  it('separates keyboard entry from pointer entry on the Viewport, in all runtimes', async () => {
    const { context, page, previewer } = await openRoute(SCROLL_AREA_ROUTE, {
      width: 1440,
      height: 900,
    });

    try {
      await previewer.scrollIntoViewIfNeeded();
      for (const runtime of RUNTIMES) {
        await selectRuntime(page, previewer, runtime, VIEWPORT_SELECTOR, 2);
        await waitForCanScroll(page, SCROLLING, true);

        await runtimeSelectTrigger(previewer).focus();
        await page.keyboard.press('Tab');
        await page.waitForTimeout(200);

        const keyboard = (await viewportFacts(page))[SCROLLING];
        expect(keyboard.focused, `${runtime}/keyboard-focused`).toBe(true);
        expect(keyboard.focusVisible, `${runtime}/keyboard-focus-visible`).toBe(true);

        await page.mouse.click(5, 5);
        await previewer
          .locator(VIEWPORT_SELECTOR)
          .first()
          .click({ position: { x: 8, y: 8 } });
        await page.waitForTimeout(100);

        const pointer = (await viewportFacts(page))[SCROLLING];
        expect(pointer.focused, `${runtime}/pointer-focused`).toBe(true);
        expect(pointer.focusVisible, `${runtime}/pointer-focus-visible`).toBe(false);
      }
    } finally {
      await context.close();
    }
  }, 240_000);

  it('keeps keyboard and wheel scrolling on the Viewport, in all runtimes', async () => {
    const { context, page, previewer } = await openRoute(SCROLL_AREA_ROUTE, {
      width: 1440,
      height: 900,
    });

    try {
      await previewer.scrollIntoViewIfNeeded();
      for (const runtime of RUNTIMES) {
        await selectRuntime(page, previewer, runtime, VIEWPORT_SELECTOR, 2);
        await waitForCanScroll(page, SCROLLING, true);

        const viewport = previewer.locator(VIEWPORT_SELECTOR).first();
        await runtimeSelectTrigger(previewer).focus();
        await page.keyboard.press('Tab');
        await page.waitForTimeout(100);

        for (const key of ['ArrowDown', 'PageDown', 'End']) {
          const before = (await viewportFacts(page))[SCROLLING].scrollTop;
          await page.keyboard.press(key);
          await page.waitForTimeout(200);
          const after = (await viewportFacts(page))[SCROLLING].scrollTop;
          expect(after, `${runtime}/${key}`).toBeGreaterThan(before);
        }

        await page.keyboard.press('Home');
        await page.waitForTimeout(200);
        expect((await viewportFacts(page))[SCROLLING].scrollTop, `${runtime}/Home`).toBe(0);

        await viewport.hover();
        await page.mouse.wheel(0, 120);
        await waitForScrolled(page, SCROLLING);
        expect(
          (await viewportFacts(page))[SCROLLING].scrollTop,
          `${runtime}/wheel`
        ).toBeGreaterThan(0);
      }
    } finally {
      await context.close();
    }
  }, 240_000);
});
