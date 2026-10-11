// @vitest-environment node
// Browser paint and real input evidence only; no native GPUI/Qt or upstream pixel-diff claim.
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
import {
  DROPDOWN_DEMOS,
  dropdownPreviewSelector,
  observeDropdownItem,
  observeDropdownGeometry,
  channelsClose,
  hasNamedDropdownGroup,
  type DropdownRecipe,
} from './finf-dropdown-recipe-evidence';

const ROUTE = '/en/ui-libraries/shadcn/dropdown-menu/';
const output =
  process.env.PUI_FINF_FEATURE_EVIDENCE_DIR ?? path.join(tmpdir(), 'pui-finf-dropdown-evidence');
const revision = execFileSync('git', ['rev-parse', 'HEAD']).toString().trim();
const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}']).toString().trim();
const references = {
  upstreamCommit: 'c2a67849be260701852b0977ba15eb5f3a0ce2a4',
  novaCssBlob: '514a3e8e00deac2ef59fee04c57cb10fd277ef39',
  url: 'https://github.com/shadcn-ui/ui/blob/c2a67849be260701852b0977ba15eb5f3a0ce2a4/apps/v4/registry/styles/style-nova.css',
  criteria: [
    'P-SHADCN-DROPDOWN-MENU-ITEM-DESTRUCTIVE-PALETTE',
    'P-SHADCN-DROPDOWN-MENU-LABEL-INSET',
  ],
  limits:
    'Source-derived Nova tint/inset oracle; pressed is the local same-palette extension. Not a same-state upstream pixel comparison or native/packed acceptance.',
};
const writeJson = (name: string, value: unknown) =>
  writeFile(path.join(output, name), JSON.stringify(value, null, 2) + '\n');
let browser: Browser;
let baseUrl = '';
beforeAll(async () => {
  await mkdir(output, { recursive: true });
  await writeJson('dropdown-source.json', {
    revision,
    tree,
    references,
    demos: DROPDOWN_DEMOS,
    runtimes: RUNTIMES,
    schemes: COLOR_SCHEMES,
    expectedCases: 16,
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
      throw new Error('Evidence requires the job’s own loopback documentation server.');
    browser = await chromium.launch({
      executablePath: await chromeExecutable(),
      headless: true,
      chromiumSandbox: true,
      args: ['--disable-dev-shm-usage'],
    });
  } catch (error) {
    await writeJson('dropdown-setup.json', {
      revision,
      tree,
      result: 'blocked-before-browser',
      error: String(error),
      screenshots: [],
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

async function hasFocus(locator: Locator) {
  return locator.evaluate((element) => element === document.activeElement);
}
async function openMenu(page: Page, trigger: Locator) {
  await trigger.click();
  await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('true');
  const id = await trigger.getAttribute('aria-controls');
  if (!id) throw new Error('The selected demo trigger must identify its own menu.');
  const menu = page.locator(`[id=${JSON.stringify(id)}][role="menu"]`);
  expect(await menu.count()).toBe(1);
  await menu.waitFor({ state: 'visible' });
  // Observe the real enter animation; do not inject CSS or hide it with a sleep.
  await expect
    .poll(
      () =>
        menu.evaluate((element) => {
          const style = getComputedStyle(element);
          return (
            style.opacity === '1' &&
            ['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(style.transform) &&
            element.getAnimations().every((animation) => animation.playState === 'finished')
          );
        }),
      { timeout: 10_000 }
    )
    .toBe(true);
  return menu;
}
async function palette(item: Locator, percent: number) {
  await expect
    .poll(
      async () => {
        const value = await observeDropdownItem(item, percent);
        return (
          channelsClose(value.backgroundRgba, value.expectedBackgroundRgba) &&
          channelsClose(value.foregroundRgba, value.expectedForegroundRgba) &&
          value.iconRgba !== null &&
          channelsClose(value.iconRgba, value.expectedForegroundRgba)
        );
      },
      { timeout: 10_000 }
    )
    .toBe(true);
  return observeDropdownItem(item, percent);
}
async function icon(item: Locator, pathFragment: string) {
  await expect
    .poll(async () => (await observeDropdownGeometry(item)).icon?.shapes ?? 0)
    .toBeGreaterThan(0);
  const value = await observeDropdownGeometry(item);
  expect(value.icon).toMatchObject({ width: 16, height: 16, viewBox: '0 0 24 24' });
  expect(value.icon!.paths.join('|')).toContain(pathFragment);
  return value;
}

for (const recipe of Object.keys(DROPDOWN_DEMOS) as DropdownRecipe[])
  for (const runtime of RUNTIMES)
    for (const scheme of COLOR_SCHEMES)
      it(`Dropdown ${recipe} ${runtime} ${scheme} actual recipe paint and native input`, async () => {
        const id = `dropdown-${recipe}-${runtime}-${scheme}`;
        const screenshots: unknown[] = [];
        const errors: unknown[] = [];
        const deniedRequests: string[] = [];
        let stage = 'created';
        let result = 'failed';
        let failure: string | undefined;
        let mouseHeld = false;
        let context: BrowserContext | undefined;
        let diagnosticPage: Page | undefined;
        let watchdog: ReturnType<typeof setTimeout> | undefined;
        let watchdogExpired = false;
        try {
          context = await browser.newContext({
            viewport: { width: 1280, height: 1000 },
            colorScheme: scheme,
            reducedMotion: 'reduce',
          });
          const page = await context.newPage();
          page.setDefaultTimeout(15_000);
          page.setDefaultNavigationTimeout(30_000);
          diagnosticPage = page;
          watchdog = setTimeout(() => {
            watchdogExpired = true;
            void context
              ?.close()
              .catch((error) => errors.push({ stage: 'watchdog-close', message: String(error) }));
          }, 80_000);
          page.on('pageerror', (error) =>
            errors.push({ stage, url: page.url(), message: String(error) })
          );
          await context.route('**/*', (route) => {
            const requestUrl = new URL(route.request().url());
            if (requestUrl.origin === new URL(baseUrl).origin) return route.continue();
            deniedRequests.push(requestUrl.origin);
            return route.abort();
          });
          stage = 'navigate';
          const response = await page.goto(`${baseUrl}${ROUTE}`, { waitUntil: 'networkidle' });
          expect(response?.status()).toBe(200);
          const previewer = page.locator(dropdownPreviewSelector(recipe));
          expect(await previewer.count()).toBe(1);
          await previewer.scrollIntoViewIfNeeded();
          await previewer.waitFor({ state: 'visible' });
          stage = 'runtime-readiness';
          await selectRuntime(page, previewer, runtime, '[data-demo-ref="trigger"]', 1);
          await applyColorScheme(page, scheme);
          const trigger = previewer.locator('[data-demo-ref="trigger"]');
          expect(await trigger.count()).toBe(1);
          const capture = async (state: string, observation: unknown, menu?: Locator) => {
            stage = `capture:${state}`;
            // Full viewport includes the selected trigger AND its portalled menu.
            const file = `${id}-${state}.png`;
            const bytes = await page.screenshot({ path: path.join(output, file) });
            screenshots.push({
              revision,
              tree,
              demoId: DROPDOWN_DEMOS[recipe],
              state,
              file,
              sha256: createHash('sha256').update(bytes).digest('hex'),
              observation,
              triggerBox: await trigger.boundingBox(),
              menuBox: menu ? await menu.boundingBox() : null,
            });
          };
          stage = 'open';
          let menu = await openMenu(page, trigger);
          const ref = (name: string) => menu.locator(`[data-demo-ref="${name}"]`);
          if (recipe === 'destructive') {
            expect(await menu.getByRole('menuitem').count()).toBe(5);
            const item = ref('delete');
            await expect.poll(() => hasFocus(ref('edit'))).toBe(true);
            await page.mouse.move(0, 0);
            await expect
              .poll(async () => (await observeDropdownItem(item, 0)).backgroundRgba[3])
              .toBe(0);
            const rest = await observeDropdownItem(item, 0);
            expect(channelsClose(rest.foregroundRgba, rest.expectedForegroundRgba)).toBe(true);
            const icons = [];
            for (const [name, shape] of [
              ['edit', 'M21.174'],
              ['share', 'M12 2v13'],
              ['archive', 'M10 12h4'],
              ['delete', 'M3 6h18'],
              ['delete-disabled', 'M3 6h18'],
            ])
              icons.push({ name, geometry: await icon(ref(name!), shape!) });
            expect(await menu.locator('svg').count()).toBe(5);
            await capture('rest', { rest, icons }, menu);
            stage = 'keyboard-focus';
            for (let step = 0; step < 3; step++) await page.keyboard.press('ArrowDown');
            await expect.poll(() => hasFocus(item)).toBe(true);
            await expect.poll(() => item.getAttribute('data-focus-visible')).not.toBeNull();
            const percent = scheme === 'dark' ? 20 : 10;
            await capture('focus', await palette(item, percent), menu);
            stage = 'pointer-pressed';
            await item.hover();
            await page.mouse.down();
            mouseHeld = true;
            await expect.poll(() => item.getAttribute('data-pressed')).not.toBeNull();
            expect(await trigger.getAttribute('aria-expanded')).toBe('true');
            await capture('pressed', await palette(item, percent), menu);
            // Release away from the command, then Escape: avoid synthesizing a command.
            await page.mouse.move(0, 0);
            await page.mouse.up();
            mouseHeld = false;
            await page.keyboard.press('Escape');
            await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('false');
            await expect.poll(() => hasFocus(trigger)).toBe(true);
            stage = 'disabled-keyboard';
            menu = await openMenu(page, trigger);
            await expect.poll(() => hasFocus(ref('edit'))).toBe(true);
            await page.keyboard.press('End');
            const disabled = ref('delete-disabled');
            await expect.poll(() => hasFocus(disabled)).toBe(true);
            expect(await observeDropdownItem(disabled, percent)).toMatchObject({
              disabled: 'true',
              opacity: '0.5',
              pointerEvents: 'none',
            });
            await page.keyboard.press('Enter');
            await page.keyboard.press('Space');
            expect(await hasFocus(disabled)).toBe(true);
            expect(await trigger.getAttribute('aria-expanded')).toBe('true');
            await capture('disabled', await palette(disabled, percent), menu);
            stage = 'activate';
            await page.keyboard.press('ArrowUp');
            await expect.poll(() => hasFocus(ref('delete'))).toBe(true);
            await page.keyboard.press('Enter');
          } else {
            await expect.poll(() => hasFocus(ref('copy'))).toBe(true);
            expect(await menu.getByRole('menuitem').count()).toBe(4);
            const copy = await icon(ref('copy'), 'M4 16');
            const cut = await icon(ref('cut'), 'M8.12 8.12');
            expect(await menu.locator('svg').count()).toBe(2);
            const label = await observeDropdownGeometry(ref('actions-label'));
            const inset = await observeDropdownGeometry(ref('more-label'));
            const paste = await observeDropdownGeometry(ref('paste'));
            const rename = await observeDropdownGeometry(ref('rename'));
            expect(label.paddingLeft).toBeCloseTo(label.rem * 0.375, 3);
            for (const measured of [inset, paste, rename]) {
              expect(measured.paddingLeft).toBeCloseTo(measured.rem * 1.75, 3);
              expect(measured.textX).not.toBeNull();
              expect(measured.textX! - measured.x).toBeCloseTo(measured.rem * 1.75, 3);
              expect(measured.icon).toBeNull();
            }
            expect(Math.abs(paste.textX! - copy.textX!)).toBeLessThan(0.5);
            expect(Math.abs(inset.textX! - rename.textX!)).toBeLessThan(0.5);
            for (const [group, labelName] of [
              ['actions-group', 'actions-label'],
              ['more-group', 'more-label'],
            ]) {
              const labelId = await ref(labelName!).getAttribute('id');
              expect(labelId).toBeTruthy();
              expect(
                hasNamedDropdownGroup(
                  await ref(group!).getAttribute('role'),
                  await ref(group!).getAttribute('aria-labelledby'),
                  labelId
                )
              ).toBe(true);
              expect(await ref(labelName!).getAttribute('tabindex')).toBeNull();
            }
            await capture('inset', { copy, cut, label, inset, paste, rename }, menu);
            stage = 'passive-label-navigation';
            for (const next of ['cut', 'paste', 'rename']) {
              await page.keyboard.press('ArrowDown');
              await expect.poll(() => hasFocus(ref(next))).toBe(true);
            }
            await page.keyboard.press('End');
            await expect.poll(() => hasFocus(ref('rename'))).toBe(true);
            await page.keyboard.press('Home');
            await expect.poll(() => hasFocus(ref('copy'))).toBe(true);
            await page.keyboard.press('Escape');
            await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('false');
            await expect.poll(() => hasFocus(trigger)).toBe(true);
            menu = await openMenu(page, trigger);
            await ref('paste').click();
          }
          stage = 'closed';
          await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('false');
          await expect.poll(() => hasFocus(trigger)).toBe(true);
          await menu.waitFor({ state: 'hidden' });
          await capture('closed', { focused: await hasFocus(trigger) });
          expect(watchdogExpired).toBe(false);
          expect(errors).toEqual([]);
          expect(deniedRequests).toEqual([]);
          result = 'passed';
        } catch (error) {
          failure = String(error);
          const file = `${id}-failure.png`;
          try {
            if (!diagnosticPage) throw new Error('No page was created for a failure screenshot.');
            const bytes = await diagnosticPage.screenshot({
              path: path.join(output, file),
              timeout: 5_000,
            });
            screenshots.push({
              revision,
              tree,
              state: 'failure',
              stage,
              file,
              sha256: createHash('sha256').update(bytes).digest('hex'),
            });
          } catch (captureError) {
            errors.push({ stage: 'failure-capture', message: String(captureError) });
          }
          throw error;
        } finally {
          if (watchdog) clearTimeout(watchdog);
          if (mouseHeld) await diagnosticPage?.mouse.up().catch(() => {});
          try {
            await writeJson(`${id}.json`, {
              revision,
              tree,
              references,
              demoId: DROPDOWN_DEMOS[recipe],
              runtime,
              scheme,
              result,
              stage,
              failure,
              errors,
              deniedRequests,
              watchdogExpired,
              browser: browser.version(),
              screenshots,
            });
          } finally {
            await context?.close();
          }
        }
      }, 90_000);
