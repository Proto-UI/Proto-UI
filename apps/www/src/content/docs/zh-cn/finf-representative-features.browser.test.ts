// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { chromium, type Browser, type Page, type Locator } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromeExecutable, startServer, stopServer, selectRuntime } from './browser-harness';

// Three real component journeys, not homepage cards or a full Finf acceptance matrix.
const routes = {
  form: '/en/ui-libraries/shadcn/form/',
  calendar: '/en/ui-libraries/shadcn/calendar/',
  drawer: '/en/ui-libraries/shadcn/drawer/',
} as const;
const output =
  process.env.PUI_FINF_FEATURE_EVIDENCE_DIR ?? path.join(tmpdir(), 'pui-finf-feature-evidence');
const revision = execFileSync('git', ['rev-parse', 'HEAD']).toString().trim();
const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}']).toString().trim();
let browser: Browser;
let baseUrl = '';

beforeAll(async () => {
  if (process.env.CANDIDATE_SHA) expect(revision).toBe(process.env.CANDIDATE_SHA);
  await mkdir(output, { recursive: true });
  await writeFile(
    path.join(output, 'source.json'),
    JSON.stringify(
      {
        revision,
        tree,
        scope:
          'Shadcn Form, Calendar and Drawer; React Web runtime only; not complete Finf acceptance',
      },
      null,
      2
    )
  );
  baseUrl = await startServer(Object.values(routes));
  // Keep the native browser sandbox. A blocked launch is a real missing result,
  // not permission to retry with --no-sandbox or to substitute synthetic images.
  browser = await chromium.launch({
    executablePath: await chromeExecutable(),
    headless: true,
    chromiumSandbox: true,
    args: ['--disable-dev-shm-usage'],
  });
}, 180_000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 30_000);

async function capture(
  page: Page,
  component: keyof typeof routes,
  state: Record<string, unknown>,
  previewer?: Locator
) {
  const file = `shadcn-${component}-react.png`;
  await page.evaluate(() => document.fonts.ready);
  if (previewer)
    await previewer.screenshot({ path: path.join(output, file), animations: 'disabled' });
  else await page.screenshot({ path: path.join(output, file), animations: 'disabled' });
  const bytes = await readFile(path.join(output, file));
  await writeFile(
    path.join(output, `shadcn-${component}-react.json`),
    JSON.stringify(
      {
        revision,
        tree,
        route: routes[component],
        runtime: 'react',
        viewport: page.viewportSize(),
        screenshot: file,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        state,
      },
      null,
      2
    )
  );
}

async function journey(
  component: keyof typeof routes,
  run: (page: Page, previewer: Locator) => Promise<void>
) {
  const context = await browser.newContext({
    viewport: { width: 1365, height: 1000 },
    colorScheme: 'light',
  });
  const page = await context.newPage();
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return ['http:', 'https:'].includes(url.protocol) && url.origin !== new URL(baseUrl).origin
      ? route.abort()
      : route.continue();
  });
  try {
    await page.goto(`${baseUrl}${routes[component]}`, { waitUntil: 'networkidle' });
    const previewer = page.locator('[data-previewer-id]').first();
    await previewer.waitFor({ state: 'visible' });
    await run(page, previewer);
    expect(pageErrors).toEqual([]);
  } catch (error) {
    await page
      .screenshot({
        path: path.join(output, `shadcn-${component}-failed.png`),
        animations: 'disabled',
      })
      .catch(() => {});
    throw error;
  } finally {
    await writeFile(
      path.join(output, `${component}-page-errors.json`),
      JSON.stringify({ revision, tree, pageErrors }, null, 2)
    );
    await context.close();
  }
}

describe('Finf source-bound representative feature screenshots', () => {
  it('captures the real Form editors after edit, reset and fresh edit', async () => {
    await journey('form', async (page, previewer) => {
      await selectRuntime(page, previewer, 'react', '[data-demo-ref="form"]', 1);
      const form = previewer.locator('[data-demo-ref="form"]');
      const editor = form.locator('input').first();
      await editor.fill('Finf sample');
      expect(await editor.inputValue()).toBe('Finf sample');
      await form.getByRole('button', { name: /Reset values/ }).click();
      await expect.poll(() => editor.inputValue()).toBe('');
      await editor.fill('Finf sample');
      await capture(
        page,
        'form',
        { editedValue: await editor.inputValue(), resetObserved: true },
        previewer
      );
    });
  }, 90_000);
  it('captures the real Calendar after native date selection', async () => {
    await journey('calendar', async (page, previewer) => {
      await selectRuntime(page, previewer, 'react', '[role="gridcell"]', 42);
      const day = previewer.getByRole('gridcell', { name: '2026-10-15', exact: true });
      await day.click();
      await expect.poll(() => day.getAttribute('aria-selected')).toBe('true');
      const box = await day.boundingBox();
      expect(box?.width).toBeGreaterThan(0);
      expect(box?.height).toBeGreaterThan(0);
      await capture(
        page,
        'calendar',
        {
          selectedDate: '2026-10-15',
          ariaSelected: await day.getAttribute('aria-selected'),
          selectedCell: box,
        },
        previewer
      );
    });
  }, 90_000);
  it('captures the real Drawer after opening and keyboard snapping', async () => {
    await journey('drawer', async (page, previewer) => {
      await selectRuntime(page, previewer, 'react', '[data-demo-ref="root"]', 1);
      await previewer.getByRole('button', { name: 'Open Drawer', exact: true }).click();
      const panel = page.locator('[data-demo-ref="panel"][role="dialog"]');
      await panel.waitFor({ state: 'visible' });
      const handle = panel.getByRole('separator', { name: 'Resize drawer', exact: true });
      await handle.focus();
      await page.keyboard.press('Home');
      await expect
        .poll(() =>
          panel.evaluate((element) =>
            getComputedStyle(element).getPropertyValue('--pui-offset-percentage').trim()
          )
        )
        .toBe('50');
      const rect = await panel.boundingBox();
      expect(rect?.height).toBeGreaterThan(0);
      await capture(page, 'drawer', { snapPoint: 0.5, offsetPercentage: 50, panel: rect });
      await panel.getByRole('button', { name: 'Close', exact: true }).click();
      await expect.poll(() => panel.isVisible()).toBe(false);
    });
  }, 90_000);
});
