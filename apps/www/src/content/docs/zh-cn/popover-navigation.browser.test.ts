// @vitest-environment node
// Real public consumers only. Collection does not start Git, a server or a browser.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  RUNTIMES,
  COLOR_SCHEMES,
  chromeExecutable,
  startServer,
  stopServer,
  selectRuntime,
  applyColorScheme,
} from './browser-harness';

const FAMILIES = ['shadcn', 'brutalist'] as const;
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1180, height: 900 },
] as const;
const routeFor = (family: string) =>
  `/en/ui-libraries/${family}/${family === 'brutalist' ? 'components/' : ''}popover/`;
const output =
  process.env.PUI_FINF_FEATURE_EVIDENCE_DIR ?? path.join(tmpdir(), 'pui-popover-navigation');
const hash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const writeJson = (name: string, value: unknown) =>
  writeFile(path.join(output, name), JSON.stringify(value, null, 2) + '\n');
function readSource() {
  const git = (...args: string[]) => execFileSync('git', args).toString().trim();
  const revision = git('rev-parse', 'HEAD');
  const tree = git('rev-parse', 'HEAD^{tree}');
  const trackedChanges = git('diff', '--name-only', 'HEAD');
  const untrackedChanges = git('ls-files', '--others', '--exclude-standard');
  return {
    revision,
    tree,
    cleanExactCommit: !trackedChanges && !untrackedChanges,
    trackedChanges,
    untrackedChanges,
    trackedPatchSha256: hash(execFileSync('git', ['diff', '--binary', 'HEAD'])),
    demos: Object.fromEntries(
      FAMILIES.map((family) => {
        const file = `apps/www/src/content/docs/demo-${family}-popover-navigation.demo.ts`;
        return [file, hash(readFileSync(file))];
      })
    ),
  };
}
let candidate: ReturnType<typeof readSource> | undefined;
let browser: Browser | undefined;
let baseUrl = '';
beforeAll(async () => {
  await mkdir(output, { recursive: true });
  try {
    if (process.env.GITHUB_ACTIONS !== 'true' || !process.env.CANDIDATE_SHA)
      throw new Error('Official exact-head CI only; local collection never launches a browser.');
    candidate = readSource();
    await writeJson('popover-navigation-source.json', {
      candidate,
      expectedCases: 32,
      phase: 'planned; terminal case receipts required',
    });
    expect(candidate.revision).toBe(process.env.CANDIDATE_SHA);
    expect(candidate.cleanExactCommit).toBe(true);
    const requested = process.env.PROTO_UI_BROWSER_BASE_URL;
    if (requested && !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(requested).hostname))
      throw new Error('External documentation server is not allowed.');
    baseUrl = await startServer('/');
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(baseUrl).hostname))
      throw new Error('A job-owned loopback documentation server is required.');
    browser = await chromium.launch({
      executablePath: await chromeExecutable(),
      headless: true,
      chromiumSandbox: true,
      args: ['--disable-dev-shm-usage'],
    });
  } catch (error) {
    await writeJson('popover-navigation-setup.json', {
      candidate,
      result: 'blocked-before-cases',
      error: String(error),
      screenshots: [],
      unexecuted: 'all32 navigation subjects',
    });
    throw error;
  }
}, 180_000);
afterAll(async () => {
  try {
    await browser?.close();
  } finally {
    await stopServer();
  }
}, 60_000);
async function settle(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
}
async function open(page: Page, trigger: Locator) {
  await trigger.click();
  await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('true');
  const id = await trigger.getAttribute('aria-controls');
  if (!id) throw new Error('The live public Trigger must identify Content.');
  const panel = page.locator(`[id=${JSON.stringify(id)}][role="dialog"]`);
  expect(await panel.count()).toBe(1);
  await panel.waitFor({ state: 'visible' });
  await settle(page);
  return panel;
}
async function geometry(panel: Locator) {
  return panel.evaluate((element) => {
    if (!(element instanceof HTMLElement)) throw new Error('Content is not an HTMLElement.');
    const split = element.shadowRoot?.querySelector<HTMLElement>('[data-pui-split-surface]');
    const surface = split ?? element;
    const hostStyle = getComputedStyle(element),
      surfaceStyle = getComputedStyle(surface);
    const box = element.getBoundingClientRect();
    return {
      availableWidth: Number.parseFloat(hostStyle.getPropertyValue('--proto-ui-available-width')),
      availableHeight: Number.parseFloat(hostStyle.getPropertyValue('--proto-ui-available-height')),
      box: {
        x: box.x,
        y: box.y,
        right: box.right,
        bottom: box.bottom,
        width: box.width,
        height: box.height,
      },
      viewport: { width: innerWidth, height: innerHeight },
      splitSurface: !!split,
      overflowY: surfaceStyle.overflowY,
      overscroll: surfaceStyle.overscrollBehaviorY,
      scrollTop: surface.scrollTop,
      scrollHeight: surface.scrollHeight,
      clientHeight: surface.clientHeight,
      pageX: scrollX,
      pageY: scrollY,
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      hostTokens:
        element.getAttribute('data-pui-split-root-style') ?? element.getAttribute('data-pui-style'),
      surfaceTokens: surface.getAttribute('data-pui-style'),
    };
  });
}
async function assertGeometry(panel: Locator) {
  const actual = await geometry(panel);
  for (const value of [
    actual.availableWidth,
    actual.availableHeight,
    actual.box.width,
    actual.box.height,
    actual.clientHeight,
  ]) {
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThan(0);
  }
  expect(Math.abs(actual.box.width - actual.availableWidth)).toBeLessThanOrEqual(1.5);
  expect(Math.abs(actual.box.height - actual.availableHeight)).toBeLessThanOrEqual(1.5);
  expect(actual.box.x).toBeGreaterThanOrEqual(-1.5);
  expect(actual.box.y).toBeGreaterThanOrEqual(-1.5);
  expect(actual.box.right).toBeLessThanOrEqual(actual.viewport.width + 1.5);
  expect(actual.box.bottom).toBeLessThanOrEqual(actual.viewport.height + 1.5);
  expect(actual.documentWidth).toBeLessThanOrEqual(actual.viewport.width + 1);
  expect(actual.overflowY).toBe('auto');
  expect(actual.overscroll).toBe('contain');
  expect(actual.scrollHeight).toBeGreaterThan(actual.clientHeight);
  return actual;
}
const focused = (locator: Locator) => locator.evaluate((element) => element.matches(':focus'));
for (const family of FAMILIES)
  for (const runtime of RUNTIMES)
    for (const scheme of COLOR_SCHEMES)
      for (const viewport of VIEWPORTS) {
        const id = `popover-navigation-${family}-${runtime}-${scheme}-${viewport.width}`;
        const demoId = `demo-${family}-popover-navigation`;
        it(
          id,
          async () => {
            let context: BrowserContext | undefined, page: Page | undefined;
            let stage = 'created',
              result = 'failed',
              failure: string | undefined;
            const screenshots: unknown[] = [],
              errors: string[] = [],
              deniedRequests: string[] = [];
            const observations: Record<string, unknown> = {};
            const capture = async (state: string, observed: unknown) => {
              if (!page || !candidate) throw new Error('Capture lacks a live page/source binding.');
              const file = `${id}-${state}.png`;
              const bytes = await page.screenshot({ path: path.join(output, file) });
              screenshots.push({
                ...candidate,
                family,
                runtime,
                scheme,
                initialViewport: viewport,
                currentViewport: page.viewportSize(),
                demoId,
                state,
                file,
                sha256: hash(bytes),
                observed,
              });
            };
            try {
              if (!browser || !candidate) throw new Error('Native setup did not complete.');
              context = await browser.newContext({
                viewport,
                colorScheme: scheme,
                reducedMotion: 'reduce',
                locale: 'en-US',
                timezoneId: 'UTC',
              });
              await context.route('**/*', (request) => {
                const url = new URL(request.request().url());
                if (url.origin === new URL(baseUrl).origin) return request.continue();
                deniedRequests.push(url.origin);
                return request.abort();
              });
              page = await context.newPage();
              page.setDefaultTimeout(15_000);
              page.setDefaultNavigationTimeout(30_000);
              page.on('pageerror', (error) => errors.push(`${stage}: ${String(error)}`));
              stage = 'navigate';
              const response = await page.goto(`${baseUrl}${routeFor(family)}`, {
                waitUntil: 'networkidle',
              });
              expect(response?.status()).toBe(200);
              const previewer = page.locator(`[data-demo-id=${JSON.stringify(demoId)}]`);
              expect(await previewer.count()).toBe(1);
              await previewer.scrollIntoViewIfNeeded();
              await selectRuntime(page, previewer, runtime, '[data-demo-ref="navigation-root"]', 1);
              await applyColorScheme(page, scheme);
              await page.evaluate(() => document.fonts.ready);
              const trigger = previewer.getByRole('button', { name: 'Menu', exact: true });
              const outside = previewer.getByRole('link', {
                name: 'Outside navigation link',
                exact: true,
              });
              expect(await trigger.getAttribute('aria-expanded')).toBe('false');
              stage = 'open-available-geometry';
              let panel = await open(page, trigger);
              expect(await panel.getAttribute('aria-modal')).toBe('false');
              expect(
                await page
                  .getByRole('dialog', { name: 'Documentation navigation', exact: true })
                  .count()
              ).toBe(1);
              const initial = await assertGeometry(panel);
              observations.initial = initial;
              await capture('open', initial);
              const links = panel.getByRole('link');
              expect(await links.count()).toBe(32);
              expect(await links.first().getAttribute('href')).toBe('#navigation-section-01');
              expect(await links.first().getAttribute('role')).toBeNull();
              expect(await links.first().getAttribute('tabindex')).toBeNull();
              stage = 'native-tab';
              await links.first().focus();
              await page.keyboard.press('Tab');
              expect(await focused(links.nth(1))).toBe(true);
              await page.keyboard.press('Shift+Tab');
              expect(await focused(links.first())).toBe(true);
              stage = 'native-wheel-scroll';
              await panel.hover();
              await page.mouse.wheel(0, 340);
              await expect.poll(async () => (await geometry(panel)).scrollTop).toBeGreaterThan(0);
              await page.mouse.wheel(0, 10000);
              await expect
                .poll(async () => {
                  const value = await geometry(panel);
                  return Math.abs(value.scrollHeight - value.clientHeight - value.scrollTop);
                })
                .toBeLessThanOrEqual(1.5);
              const edgeBefore = await geometry(panel);
              expect(edgeBefore.pageY).toBe(initial.pageY);
              // A page already at its own end cannot demonstrate downward containment.
              // Treat an unobservable fixture as failure, never as a product pass.
              expect(
                edgeBefore.documentHeight - edgeBefore.pageY - edgeBefore.viewport.height
              ).toBeGreaterThan(2);
              await page.mouse.wheel(0, 10000);
              await settle(page);
              const edgeAfter = await geometry(panel);
              expect(
                Math.abs(edgeAfter.scrollHeight - edgeAfter.clientHeight - edgeAfter.scrollTop)
              ).toBeLessThanOrEqual(1.5);
              expect(edgeAfter.pageY).toBe(edgeBefore.pageY);
              expect(edgeAfter.pageX).toBe(edgeBefore.pageX);
              observations.scrollEdge = { before: edgeBefore, after: edgeAfter };
              await capture('scrolled-edge', observations.scrollEdge);
              stage = 'outside-focus';
              await outside.focus();
              await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('false');
              await panel.waitFor({ state: 'hidden' });
              await settle(page);
              expect(await focused(outside)).toBe(true);
              await capture('outside-focus', { retainedOutsideFocus: true });
              stage = 'reopen-escape';
              panel = await open(page, trigger);
              await assertGeometry(panel);
              await page.keyboard.press('Escape');
              await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('false');
              await panel.waitFor({ state: 'hidden' });
              await settle(page);
              expect(await focused(trigger)).toBe(true);
              await capture('escape', { triggerFocused: true });
              stage = 'resized-reopen';
              const resized = {
                width: viewport.width === 390 ? 430 : 1100,
                height: viewport.height - 60,
              };
              await page.setViewportSize(resized);
              await trigger.scrollIntoViewIfNeeded();
              panel = await open(page, trigger);
              observations.resized = await assertGeometry(panel);
              await capture('resized-reopen', observations.resized);
              stage = 'outside-pointer';
              await outside.click();
              await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('false');
              await panel.waitFor({ state: 'hidden' });
              await settle(page);
              expect(await focused(outside)).toBe(true);
              expect(await outside.getAttribute('href')).toBe('#navigation-outside-destination');
              expect(errors).toEqual([]);
              expect(deniedRequests).toEqual([]);
              result = 'passed';
            } catch (error) {
              failure = String(error);
              try {
                await capture('failed', { stage, error: failure });
              } catch (captureError) {
                observations.failureCaptureError = String(captureError);
              }
              throw error;
            } finally {
              try {
                await writeJson(`${id}.json`, {
                  candidate,
                  id,
                  demoId,
                  family,
                  runtime,
                  scheme,
                  initialViewport: viewport,
                  currentViewport: page?.viewportSize(),
                  stage,
                  result,
                  failure,
                  browser: browser?.version(),
                  presetCheck: process.env.PUI_FINF_PRESET_CHECK,
                  observations,
                  errors,
                  deniedRequests,
                  screenshots,
                  unverified: [
                    'website unique-tree handback/fatal retirement',
                    'Trigger design parity',
                    'no-JS/modifier/context-menu activation',
                    'unreduced motion',
                    'GPUI/Qt/Rust',
                  ],
                });
              } finally {
                await context?.close();
              }
            }
          },
          45_000
        );
      }
