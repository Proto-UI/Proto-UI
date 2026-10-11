// @vitest-environment node
// Official real-input Web evidence. This does not claim GPUI or upstream pixel parity.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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

const route = '/en/ui-libraries/shadcn/popover/';
const demoId = 'demo-shadcn-popover';
const output =
  process.env.PUI_FINF_FEATURE_EVIDENCE_DIR ?? path.join(tmpdir(), 'pui-popover-title');
const revision = execFileSync('git', ['rev-parse', 'HEAD']).toString().trim();
const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}']).toString().trim();
const trackedChanges = execFileSync('git', ['diff', '--name-only', 'HEAD']).toString().trim();
const untrackedChanges = execFileSync('git', ['ls-files', '--others', '--exclude-standard'])
  .toString()
  .trim();
const candidate = {
  revision,
  tree,
  cleanExactCommit: !trackedChanges && !untrackedChanges,
  trackedChanges: trackedChanges ? trackedChanges.split('\n') : [],
  untrackedChanges: untrackedChanges ? untrackedChanges.split('\n') : [],
  trackedPatchSha256: createHash('sha256')
    .update(execFileSync('git', ['diff', '--binary', 'HEAD']))
    .digest('hex'),
};
const references = {
  proposal: 'internal/contracts/overlay/shadcn-popover-title.presentation.v0.md',
  upstream: 'c2a67849be260701852b0977ba15eb5f3a0ce2a4',
  cssBlob: '514a3e8e00deac2ef59fee04c57cb10fd277ef39',
  url: 'https://github.com/shadcn-ui/ui/blob/c2a67849be260701852b0977ba15eb5f3a0ce2a4/apps/v4/registry/styles/style-nova.css#L925-L944',
};
const writeJson = (name: string, value: unknown) =>
  writeFile(path.join(output, name), JSON.stringify(value, null, 2) + '\n');
let browser: Browser;
let baseUrl = '';

beforeAll(async () => {
  await mkdir(output, { recursive: true });
  await writeJson('popover-title-source.json', {
    candidate,
    revision,
    tree,
    references,
    demoId,
    route,
    expectedCases: RUNTIMES.length * COLOR_SCHEMES.length,
    phase: 'Planned. Only terminal case receipts establish executed results.',
  });
  try {
    if (process.env.GITHUB_ACTIONS !== 'true' || !process.env.CANDIDATE_SHA)
      throw new Error(
        'Official GitHub Actions only; local source tests do not launch a native browser.'
      );
    expect(revision).toBe(process.env.CANDIDATE_SHA);
    expect(execFileSync('git', ['diff', '--name-only', 'HEAD']).toString().trim()).toBe('');
    expect(
      execFileSync('git', ['ls-files', '--others', '--exclude-standard']).toString().trim()
    ).toBe('');
    const requestedBase = process.env.PROTO_UI_BROWSER_BASE_URL;
    if (
      requestedBase &&
      !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(requestedBase).hostname)
    )
      throw new Error('An external evidence server is not allowed.');
    baseUrl = await startServer('/');
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(baseUrl).hostname))
      throw new Error('Evidence requires this job’s own loopback documentation server.');
    browser = await chromium.launch({
      executablePath: await chromeExecutable(),
      headless: true,
      chromiumSandbox: true,
      args: ['--disable-dev-shm-usage'],
    });
  } catch (error) {
    await writeJson('popover-title-setup.json', {
      candidate,
      revision,
      tree,
      result: 'blocked-before-browser',
      error: String(error),
      screenshots: [],
      unexecuted: [
        'all eight runtime/theme cases',
        'custom inheritance',
        'real input and lifecycle',
        '320px and 200% root text',
      ],
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

async function focused(locator: Locator) {
  return locator.evaluate((element) => element.matches(':focus'));
}

async function open(page: Page, trigger: Locator) {
  await trigger.click();
  await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('true');
  const id = await trigger.getAttribute('aria-controls');
  if (!id) throw new Error('Popover trigger must identify its content.');
  const panel = page.locator(`[id=${JSON.stringify(id)}][role="dialog"]`);
  await panel.waitFor({ state: 'visible' });
  return panel;
}

async function titleFor(page: Page, panel: Locator) {
  const id = await panel.getAttribute('aria-labelledby');
  if (!id) throw new Error('The live Title must name Content.');
  const title = page.locator(`[id=${JSON.stringify(id)}]`);
  expect(await title.count()).toBe(1);
  return title;
}

async function typography(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return {
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
      fontWeight: style.fontWeight,
      fontFamily: style.fontFamily,
      text: element.textContent,
      id: element.id,
      rootSize: getComputedStyle(document.documentElement).fontSize,
      titleTokens: element.getAttribute('data-pui-style'),
      bounds: { x: box.x, right: box.right, width: box.width, height: box.height },
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    };
  });
}

async function defaultTypography(title: Locator, panel: Locator) {
  const actual = await typography(title);
  const container = await typography(panel);
  const rem = Number.parseFloat(actual.rootSize);
  expect(Number.parseFloat(actual.fontSize)).toBeCloseTo(0.875 * rem, 5);
  expect(Number.parseFloat(actual.lineHeight)).toBeCloseTo(1.25 * rem, 5);
  expect(actual.fontWeight).toBe('500');
  expect(actual.fontSize).toBe(container.fontSize);
  expect(actual.fontFamily).toBe(container.fontFamily);
  expect(actual.lineHeight).toBe(container.lineHeight);
  return { title: actual, content: container };
}

for (const runtime of RUNTIMES)
  for (const scheme of COLOR_SCHEMES) {
    const id = `popover-title-${runtime}-${scheme}`;
    it(
      id,
      async () => {
        let context: BrowserContext | undefined;
        let page: Page | undefined;
        let stage = 'created';
        let result = 'failed';
        let failure: string | undefined;
        const screenshots: unknown[] = [];
        const errors: string[] = [];
        const deniedRequests: string[] = [];
        const observations: Record<string, unknown> = {};
        try {
          context = await browser.newContext({
            viewport: { width: 1280, height: 1000 },
            colorScheme: scheme,
            reducedMotion: 'reduce',
            locale: 'en-US',
            timezoneId: 'UTC',
          });
          page = await context.newPage();
          page.setDefaultTimeout(15_000);
          page.setDefaultNavigationTimeout(30_000);
          page.on('pageerror', (error) => errors.push(`${stage}: ${String(error)}`));
          await context.route('**/*', (request) => {
            const url = new URL(request.request().url());
            if (url.origin === new URL(baseUrl).origin) return request.continue();
            deniedRequests.push(url.origin);
            return request.abort();
          });
          stage = 'navigate';
          const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
          expect(response?.status()).toBe(200);
          const previewer = page.locator('[data-previewer-id]').first();
          await previewer.scrollIntoViewIfNeeded();
          await selectRuntime(page, previewer, runtime, '[data-demo-ref="root"]', 1);
          await applyColorScheme(page, scheme);
          await page.evaluate(() => document.fonts.ready);
          const trigger = previewer.getByRole('button', { name: 'Open Popover', exact: true });
          const outside = previewer.getByRole('button', {
            name: 'Outside focus target',
            exact: true,
          });
          const capture = async (state: string, observation: unknown) => {
            const file = `${id}-${state}.png`;
            const bytes = await page!.screenshot({ path: path.join(output, file) });
            screenshots.push({
              revision,
              tree,
              demoId,
              state,
              file,
              sha256: createHash('sha256').update(bytes).digest('hex'),
              observation,
              environment: await page!.evaluate(() => ({
                viewport: { width: innerWidth, height: innerHeight },
                dpr: devicePixelRatio,
                fonts: document.fonts.status,
                rootSize: getComputedStyle(document.documentElement).fontSize,
              })),
            });
          };
          stage = 'default-title';
          let panel = await open(page, trigger);
          let title = await titleFor(page, panel);
          expect(await panel.getAttribute('aria-modal')).toBe('false');
          expect(await title.getAttribute('tabindex')).toBeNull();
          observations.default = await defaultTypography(title, panel);
          await capture('default', observations.default);

          stage = 'explicit-ancestor-inheritance';
          const original = await panel.evaluate((element) => {
            const node = element as HTMLElement;
            const previous = { fontSize: node.style.fontSize, lineHeight: node.style.lineHeight };
            // Explicit test fixture only: style the existing ancestor, never Title.
            node.style.fontSize = '19px';
            node.style.lineHeight = '31px';
            return previous;
          });
          const inherited = await typography(title);
          expect(inherited).toMatchObject({
            fontSize: '19px',
            lineHeight: '31px',
            fontWeight: '500',
          });
          observations.inherited = inherited;
          await capture('inherited', inherited);
          await panel.evaluate((element, previous) => {
            const node = element as HTMLElement;
            node.style.fontSize = previous.fontSize;
            node.style.lineHeight = previous.lineHeight;
          }, original);
          await defaultTypography(title, panel);

          stage = 'title-name-lifecycle';
          if (runtime === 'wc') {
            // WC disconnect/reconnect is host-owned. Direct DOM mutation cannot
            // establish React/Vue renderer-owned isolated Title remount.
            const titleId = await title.getAttribute('id');
            await title.evaluate((element) => {
              element.textContent = 'Updated Popover settings';
            });
            expect(
              await page
                .getByRole('dialog', { name: 'Updated Popover settings', exact: true })
                .count()
            ).toBe(1);
            const retainedTitle = await title.elementHandle();
            if (!retainedTitle) throw new Error('Title handle disappeared.');
            await retainedTitle.evaluate((element) => element.remove());
            await expect.poll(() => panel.getAttribute('aria-labelledby')).toBeNull();
            expect(await panel.getAttribute('aria-label')).toBe('Popover');
            await panel.evaluate((element, child) => element.prepend(child), retainedTitle);
            await retainedTitle.dispose();
            title = await titleFor(page, panel);
            expect(await title.getAttribute('id')).toBe(titleId);
            await title.evaluate((element) => {
              element.textContent = 'Popover settings';
            });
            await defaultTypography(title, panel);
            observations.titleLifecycle = 'WC native disconnect/reconnect exercised.';
          } else {
            observations.titleLifecycle =
              'Renderer-driven isolated Title removal/remount untested. Only public close/reopen is exercised below.';
          }

          stage = 'close-reopen-escape';
          await panel.getByRole('button', { name: 'Close', exact: true }).click();
          await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('false');
          await expect.poll(() => focused(trigger)).toBe(true);
          await page.keyboard.press('Enter');
          await panel.waitFor({ state: 'visible' });
          await defaultTypography(await titleFor(page, panel), panel);
          await page.keyboard.press('Escape');
          await panel.waitFor({ state: 'hidden' });
          await expect.poll(() => focused(trigger)).toBe(true);

          stage = 'real-tab-outside';
          panel = await open(page, trigger);
          const closeBeforeTab = panel.getByRole('button', { name: 'Close', exact: true });
          await expect.poll(() => focused(closeBeforeTab)).toBe(true);
          observations.beforeOutsideTab = { closeFocused: await focused(closeBeforeTab) };
          await capture('inside-focus-before-tab', observations.beforeOutsideTab);
          await page.keyboard.press('Tab');
          await expect.poll(() => focused(outside)).toBe(true);
          await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('false');
          await panel.waitFor({ state: 'hidden' });
          observations.outside = { focused: await focused(outside), closed: true };
          await capture('outside-focus', observations.outside);

          stage = 'narrow-200-percent-root-text';
          await page.setViewportSize({ width: 320, height: 1000 });
          await page.evaluate(() => {
            document.documentElement.style.fontSize = '200%';
          });
          await trigger.scrollIntoViewIfNeeded();
          panel = await open(page, trigger);
          title = await titleFor(page, panel);
          await title.evaluate((element) => {
            element.textContent = 'Long Popover settings title for readable narrow screen layout';
          });
          observations.narrowText = await defaultTypography(title, panel);
          const narrow = await typography(title);
          const bounds = await typography(panel);
          expect(narrow.bounds.x).toBeGreaterThanOrEqual(bounds.bounds.x - 1);
          expect(narrow.bounds.right).toBeLessThanOrEqual(bounds.bounds.right + 1);
          expect(narrow.scrollWidth).toBeLessThanOrEqual(narrow.clientWidth + 1);
          await capture('320px-200-percent-root-text', {
            ...(observations.narrowText as object),
            limit:
              '200% root text-size fixture, not physical browser zoom or upstream pixel parity.',
          });
          await panel.getByRole('button', { name: 'Close', exact: true }).click();
          await panel.waitFor({ state: 'hidden' });
          expect(errors).toEqual([]);
          expect(deniedRequests).toEqual([]);
          result = 'passed';
        } catch (error) {
          failure = String(error);
          if (page) {
            try {
              const file = `${id}-failure.png`;
              const bytes = await page.screenshot({
                path: path.join(output, file),
                timeout: 5_000,
              });
              screenshots.push({
                revision,
                tree,
                stage,
                file,
                sha256: createHash('sha256').update(bytes).digest('hex'),
              });
            } catch (captureError) {
              errors.push(`failure capture: ${String(captureError)}`);
            }
          }
          throw error;
        } finally {
          try {
            await writeJson(`${id}.json`, {
              revision,
              tree,
              references,
              demoId,
              runtime,
              scheme,
              stage,
              result,
              failure,
              errors,
              deniedRequests,
              observations,
              screenshots,
              browser: browser.version(),
            });
          } finally {
            await context?.close();
          }
        }
      },
      120_000
    );
  }
