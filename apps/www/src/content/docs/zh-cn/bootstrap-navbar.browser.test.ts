// @vitest-environment node
// The ordinary runtime inventory collects this suite without starting sockets.
// Its dedicated Actions step supplies the explicit opt-in and exact source SHA.
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Browser, BrowserContext, Locator, Page } from 'playwright-core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser, startServer, stopServer, RUNTIMES } from './browser-harness';
import { revealHeaderPreferences } from './site-header-browser';
import { isUnpaintedBootstrapBoxShadow } from './bootstrap-disabled-paint';

const enabled = process.env.PROTO_UI_BOOTSTRAP_NAVBAR_EVIDENCE === '1';
const directory = process.env.PROTO_UI_BOOTSTRAP_NAVBAR_EVIDENCE_DIR;
const expectedSha = process.env.PROTO_UI_EXPECTED_HEAD_SHA;
const FAMILY = 'bootstrap-2-3-2';
const DOCS = '/en/ui-libraries/bootstrap-2-3-2/button/';
const FIXTURE = '/en/test/new-projection-families/';
const THEMES = ['light', 'dark'] as const;
const VIEWPORTS = [
  { width: 1440, height: 1000 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
] as const;
const expectedCases = [
  ...RUNTIMES.flatMap((runtime) =>
    THEMES.flatMap((theme) => VIEWPORTS.map(({ width }) => `home-${runtime}-${theme}-${width}`))
  ),
  ...THEMES.flatMap((theme) => VIEWPORTS.map(({ width }) => `docs-${theme}-${width}`)),
  ...THEMES.flatMap((theme) => RUNTIMES.map((runtime) => `paint-${runtime}-${theme}`)),
];
const cases = new Map<string, { status: string; error?: string }>();
const results: Array<{ name: string; status: string; errors: unknown }> = [];
const observations: unknown[] = [];
const screenshots: string[] = [];
const pageErrors: string[] = [];
const cleanupErrors: Array<{ phase: string; error: string }> = [];
const protocolErrors: string[] = [];
const seenCases = new Set<string>();
let browser: Browser | undefined;
let context: BrowserContext | undefined;
let page: Page | undefined;
let baseUrl = '';
let sourceSha = '';
let startupError: string | undefined;

async function manifest(status: string) {
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, 'manifest.json'),
    JSON.stringify(
      {
        sourceSha,
        expectedSha,
        status,
        startupError,
        runId: process.env.GITHUB_RUN_ID,
        runAttempt: process.env.GITHUB_RUN_ATTEMPT,
        node: process.version,
        browser: browser?.version(),
        upstream: {
          version: '2.3.2',
          revision: 'b4c4072679943773a7582daa63f545ba818fa627',
          sources: ['less/navbar.less', 'less/variables.less'],
          reference: 'https://getbootstrap.com/2.3.2/components.html#navbar',
        },
        viewports: VIEWPORTS,
        themes: THEMES,
        runtimes: RUNTIMES,
        cases: expectedCases.map((name) => ({
          name,
          ...(cases.get(name) ?? {
            status: status === 'running' || status === 'starting' ? 'pending' : 'blocked',
            error: 'This expected cell was not reached; no success is inferred.',
          }),
        })),
        results,
        observations,
        screenshots,
        pageErrors,
        cleanupErrors,
        protocolErrors,
        scope:
          'Actual www homepage and Docs Bootstrap navbar, plus the public four-Web Button fixture. Blue/dark and mobile 44px targets are Proto UI adaptations. No pixel-identical upstream, physical device, Compiler, non-Web, full-family or IME claim.',
      },
      null,
      2
    )
  );
}
async function capture(name: string, target?: Locator) {
  if (!directory || !page) return;
  const filename = `${name}.png`;
  const options = { path: path.join(directory, filename), animations: 'disabled' as const };
  if (target) await target.screenshot(options);
  else await page.screenshot({ ...options, fullPage: false });
  screenshots.push(filename);
}
async function cell(name: string, run: () => Promise<void>) {
  if (!expectedCases.includes(name) || seenCases.has(name)) {
    const error = `Unexpected or duplicate Navbar evidence cell: ${name}`;
    protocolErrors.push(error);
    throw new Error(error);
  }
  seenCases.add(name);
  try {
    await run();
    cases.set(name, { status: 'passed' });
  } catch (error) {
    cases.set(name, { status: 'failed', error: String(error) });
    try {
      await capture(`${name}-failure`);
    } catch {
      /* Preserve the original failure. */
    }
  } finally {
    await manifest('running');
  }
}
async function attemptCleanup(phase: string, run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    cleanupErrors.push({ phase, error: String(error) });
  }
}
async function newPage(theme: 'light' | 'dark', runtime = 'wc') {
  context = await browser!.newContext({ viewport: VIEWPORTS[0], colorScheme: theme });
  await context.addInitScript(
    (runtime) => localStorage.setItem('preferred-prototypes-adapter', runtime),
    runtime
  );
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    const read = ['GET', 'HEAD'].includes(route.request().method());
    const allowed =
      url.origin === baseUrl ||
      url.origin === 'https://esm.sh' ||
      ['data:', 'blob:'].includes(url.protocol);
    return read && allowed ? route.continue() : route.abort();
  });
  page = await context.newPage();
  page.setDefaultTimeout(10_000);
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  return page;
}
function menu() {
  return page!.locator(
    '[data-site-header] .site-header-menu [data-projection-generation-state="active"] [data-demo-ref="home-menu"], [data-docs-site-header] [data-site-menu-button]'
  );
}
function themeButton() {
  return page!.locator(
    '[data-site-header] .site-header-theme [data-projection-generation-state="active"] [data-demo-ref="home-theme"], [data-docs-site-header] [data-theme-toggle]'
  );
}
function searchButton() {
  return page!.locator('[data-site-header] [data-open-modal]');
}
async function paint(control: Locator) {
  return control.evaluate((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      background: style.backgroundColor,
      image: style.backgroundImage,
      radius: style.borderRadius,
      color: style.color,
      border: style.borderColor,
      shadow: style.boxShadow,
      opacity: style.opacity,
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
      weight: style.fontWeight,
      ring: style.getPropertyValue('--pui-ring-width').trim(),
      ringColor: style.getPropertyValue('--pui-ring-color').trim(),
      ringOffset: style.getPropertyValue('--pui-ring-offset-width').trim(),
      semanticRing: style.getPropertyValue('--pui-ring').trim(),
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
  });
}
async function assertWhiteNavbarFocus(name: string, control: Locator) {
  await expect.poll(async () => (await paint(control)).ring).toBe('2px');
  const focused = await paint(control);
  observations.push({ name, phase: 'navbar-focus-paint', ...focused });
  expect(focused.ringColor).toBe('#ffffff');
  expect(focused.ringOffset).toBe('0px');
  // Check the actual painted shadow layer, not only the custom-property width.
  // The old Docs receipt had 2px with rgb(23,23,23), while Home happened to
  // inherit white. This same-engine computed oracle rejects both dark and
  // near-white page palette leakage without changing the white contract.
  expect(focused.shadow).toMatch(
    /(?:^|,\s*)rgb\(255,\s*255,\s*255\)\s+0px\s+0px\s+0px\s+2px(?:,|$)/
  );
}

async function assertOrdinarySearchFocus(name: string) {
  await page!.keyboard.press('Tab');
  await searchButton().focus();
  await expect.poll(async () => (await paint(searchButton())).ring).toBe('2px');
  const focused = await paint(searchButton());
  observations.push({ name, phase: 'ordinary-search-focus-paint', ...focused });
  expect(focused.ringColor).toBe(focused.semanticRing);
  expect(focused.ringColor).not.toBe('#ffffff');
  expect(focused.ringOffset).toBe('2px');
  expect(focused.shadow).toContain('0px 0px 0px 4px');
}

async function assertCommandPaint(name: string, width: number) {
  const theme = await paint(themeButton());
  const search = await paint(searchButton());
  const facts = await themeButton().evaluate((element) => {
    const header = element.closest('[data-site-header]');
    const glyph = element.querySelector('svg, .site-header-theme-icon');
    if (!header || !glyph) throw new Error('Navbar theme command requires its visible glyph.');
    const glyphStyle = getComputedStyle(glyph);
    const rect = glyph.getBoundingClientRect();
    return {
      background: getComputedStyle(header).backgroundImage,
      glyphColor: glyph instanceof SVGElement ? glyphStyle.stroke : glyphStyle.borderTopColor,
      glyphOpacity: glyphStyle.opacity,
      glyphWidth: rect.width,
      glyphHeight: rect.height,
    };
  });
  observations.push({ name, phase: 'command-paint', theme, search, ...facts });
  // The public family context must survive SSR -> WC upgrade. A white glyph
  // on the ordinary raised field was visible in the first real Docs receipt.
  expect(theme.background).toBe('rgba(0, 0, 0, 0)');
  expect(theme.image).toBe('none');
  expect(theme.color).toBe('rgb(255, 255, 255)');
  expect(theme.opacity).toBe('1');
  expect(theme.height).toBe(width < 768 ? 44 : 40);
  expect(facts.glyphColor).toBe('rgb(255, 255, 255)');
  expect(facts.glyphOpacity).toBe('1');
  expect(facts.glyphWidth).toBeGreaterThanOrEqual(16);
  expect(facts.glyphHeight).toBeGreaterThanOrEqual(16);
  const colors = facts.background.match(/rgb\([\d\s,]+\)/g) ?? [];
  expect(colors).toHaveLength(2);
  const luminance = (color: string) => {
    const channels = color.match(/[\d.]+/g)!.map((part) => {
      const value = Number(part) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
  };
  // Both actual computed blue gradient endpoints must contrast with the white
  // non-text glyph; transparent rest paint leaves those endpoints visible.
  const contrast = colors.map((color) => 1.05 / (luminance(color) + 0.05));
  observations.push({ name, phase: 'theme-glyph-contrast', colors, contrast });
  expect(Math.min(...contrast)).toBeGreaterThanOrEqual(3);
  // The documentation loader must retain Bootstrap instead of silently
  // selecting Shadcn. Check the actual painted field, not a stylesheet token.
  expect(await searchButton().getAttribute('data-site-control-family')).toBe(FAMILY);
  expect(search.radius).toBe('4px');
  expect(search.image).toContain('linear-gradient');
  expect(search.color).toBe('rgb(51, 51, 51)');
}
async function selectFamily() {
  await revealHeaderPreferences(page!);
  const trigger = page!.locator(
    '[data-homepage-runtime] [data-projection-generation-state="active"] [data-projection-control="family"] [role="combobox"]'
  );
  await trigger.click();
  const id = await trigger.getAttribute('aria-controls');
  expect(id).toBeTruthy();
  await page!
    .locator(`[id=${JSON.stringify(id)}]`)
    .getByRole('option', {
      name: 'Bootstrap 2.3.2 · WIP',
      exact: true,
    })
    .click();
  await page!.waitForFunction(() => {
    const root = document.querySelector<HTMLElement>('[data-homepage-runtime]');
    return root?.dataset.runtimeState === 'ready' && root.dataset.family === 'bootstrap-2-3-2';
  });
}
async function assertGeometry(name: string, width: number) {
  const facts = await page!.locator('[data-site-header]').evaluate((header) => {
    const rect = (node: Element) => {
      const r = node.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    const visible = (node: Element) => {
      const r = node.getBoundingClientRect();
      return (
        r.width > 0 &&
        r.height > 0 &&
        getComputedStyle(node).visibility !== 'hidden' &&
        !node.closest('[hidden],[inert],[data-projection-generation-state="retired"]')
      );
    };
    const targets = [
      ...header.querySelectorAll(
        [
          '.site-header-brand a',
          '[data-site-header-desktop-navigation] a',
          '[data-site-header-wide-preferences] [role="combobox"]',
          '[data-open-modal]',
          '.site-header-theme [role="button"]',
          '.site-header-menu [role="button"]',
        ].join(',')
      ),
    ]
      .filter(visible)
      .map((node) => ({
        label: node.getAttribute('aria-label') || node.textContent?.trim(),
        ...rect(node),
      }));
    return {
      header: rect(header),
      viewport: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      row: getComputedStyle(header).getPropertyValue('--site-header-row-height').trim(),
      targets,
    };
  });
  observations.push({ name, geometry: facts });
  expect(facts.scrollWidth).toBeLessThanOrEqual(width + 1);
  expect(facts.row).toBe(width < 768 ? '3.5rem' : '40px');
  for (const target of facts.targets) {
    expect(target.x, `${target.label} left`).toBeGreaterThanOrEqual(-1);
    expect(target.right, `${target.label} right`).toBeLessThanOrEqual(width + 1);
    expect(target.y).toBeGreaterThanOrEqual(facts.header.y - 1);
    expect(target.bottom).toBeLessThanOrEqual(facts.header.bottom + 1);
  }
  for (let i = 0; i < facts.targets.length; i++)
    for (const b of facts.targets.slice(i + 1)) {
      const a = facts.targets[i];
      const overlap =
        Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1 &&
        Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1;
      expect(overlap, `${a.label} overlaps ${b.label}`).toBe(false);
    }
  if (width === 1440) expect(facts.header.height).toBeLessThanOrEqual(42);
  const search = await paint(searchButton());
  expect(search.height).toBe(width < 768 ? 44 : 30);
  expect((await paint(menu())).height).toBe(width < 768 ? 44 : 40);
  const text = page!
    .locator(
      '.site-header-brand [data-demo-ref^="home-link-text-"], .site-header-brand [data-site-link-content] [data-pui-style]'
    )
    .last();
  const brand = await paint(text);
  expect(brand.fontSize).toBe('20px');
  expect(brand.lineHeight).toBe('20px');
  expect(brand.weight).toBe('200');
  observations.push({ name, search, brand });
}
async function exerciseHeader(name: string, theme: 'light' | 'dark', width: number) {
  const currentMenu = menu();
  if ((await currentMenu.getAttribute('aria-expanded')) === 'true')
    await page!.keyboard.press('Escape');
  await page!.mouse.move(0, 200);
  await assertGeometry(name, width);
  await assertCommandPaint(name, width);
  await capture(`${name}-closed`);
  if (width >= 768) {
    const link = page!.locator('[data-site-header-desktop-navigation] a:visible').first();
    const surface = link.locator('[data-demo-ref^="home-link-surface-"], [data-site-link-content]');
    await link.hover();
    const selected = await link.getAttribute('aria-current');
    const linkPaint = await paint(surface);
    expect(linkPaint.background).toBe(
      selected && selected !== 'false' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.1)'
    );
    expect(linkPaint.color).toBe('rgb(255, 255, 255)');
    await page!.keyboard.press('Tab');
    await link.focus();
    await assertWhiteNavbarFocus(`${name}-navigation`, surface);
    await capture(`${name}-navigation-focus`, page!.locator('[data-site-header]'));
    await link.evaluate((element) => (element as HTMLElement).blur());
  }
  await page!.keyboard.press('Tab');
  await themeButton().focus();
  await assertWhiteNavbarFocus(`${name}-theme`, themeButton());
  await capture(`${name}-theme-focus`, page!.locator('[data-site-header]'));
  await themeButton().evaluate((element) => (element as HTMLElement).blur());
  await currentMenu.hover();
  expect((await paint(currentMenu)).background).toBe('rgba(0, 0, 0, 0.1)');
  await capture(`${name}-hover`);
  await page!.mouse.down();
  expect((await paint(currentMenu)).background).toBe('rgba(0, 0, 0, 0.2)');
  await capture(`${name}-pressed`, page!.locator('[data-site-header]'));
  await page!.mouse.up();
  await expect.poll(() => currentMenu.getAttribute('aria-expanded')).toBe('true');
  const panel = page!.locator('[data-site-header-panel]');
  await expect
    .poll(async () => {
      const panelBox = await panel.boundingBox();
      const triggerBox = await currentMenu.boundingBox();
      const headerBox = await page!.locator('[data-site-header]').boundingBox();
      if (!panelBox || !triggerBox || !headerBox) return false;
      const top = width < 768 ? headerBox.y + headerBox.height : triggerBox.y + triggerBox.height;
      const aligned =
        width < 768
          ? Math.abs(panelBox.x - 8)
          : Math.abs(panelBox.x + panelBox.width - triggerBox.x - triggerBox.width);
      return aligned <= 1.5 && Math.abs(panelBox.y - top - 5) <= 1.5;
    })
    .toBe(true);
  const bounds = await panel.boundingBox();
  const trigger = await currentMenu.boundingBox();
  expect(bounds).toBeTruthy();
  expect(trigger).toBeTruthy();
  expect(bounds!.x).toBeGreaterThanOrEqual(7);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width - 7);
  expect(bounds!.y).toBeGreaterThanOrEqual(trigger!.y + trigger!.height - 1);
  observations.push({ name, openPanel: bounds, trigger });
  await capture(`${name}-expanded`);
  await page!.keyboard.press('Escape');
  await expect.poll(() => currentMenu.getAttribute('aria-expanded')).toBe('false');
  expect(await currentMenu.evaluate((element) => document.activeElement === element)).toBe(true);
  await page!.keyboard.press('Tab');
  await currentMenu.focus();
  await assertWhiteNavbarFocus(`${name}-menu`, currentMenu);
  await capture(`${name}-focus`, page!.locator('[data-site-header]'));
  // Keyboard opening and a second Escape use the existing disclosure owner.
  await page!.keyboard.press('Enter');
  await expect.poll(() => currentMenu.getAttribute('aria-expanded')).toBe('true');
  await page!.keyboard.press('Escape');
  await expect.poll(() => currentMenu.getAttribute('aria-expanded')).toBe('false');
  // Resize/docking does not create another Select. Inspect its genuine popup.
  await revealHeaderPreferences(page!);
  const select = page!
    .locator('[data-site-header] [data-site-header-preferences] [role="combobox"]:visible')
    .first();
  await select.click();
  const controlled = await select.getAttribute('aria-controls');
  expect(controlled).toBeTruthy();
  const list = page!.locator(`[id=${JSON.stringify(controlled)}]`);
  await list.waitFor({ state: 'visible' });
  const popup = await list.boundingBox();
  expect(popup!.x).toBeGreaterThanOrEqual(-1);
  expect(popup!.x + popup!.width).toBeLessThanOrEqual(width + 1);
  await capture(`${name}-select`);
  await page!.keyboard.press('Escape');
  await expect.poll(() => select.getAttribute('aria-expanded')).toBe('false');
  expect(await select.evaluate((element) => document.activeElement === element)).toBe(true);
  if ((await currentMenu.getAttribute('aria-expanded')) === 'true')
    await page!.keyboard.press('Escape');
  await themeButton().click();
  await expect
    .poll(() => page!.locator('html').getAttribute('data-theme'))
    .toBe(theme === 'light' ? 'dark' : 'light');
  await page!.mouse.move(0, 200);
  await page!.keyboard.press('Tab');
  await themeButton().focus();
  await assertWhiteNavbarFocus(`${name}-theme-switched`, themeButton());
  await capture(`${name}-theme-switched-focus`, page!.locator('[data-site-header]'));
  await themeButton().click();
  await expect.poll(() => page!.locator('html').getAttribute('data-theme')).toBe(theme);
  await page!.mouse.move(0, 200);
  await page!.keyboard.press('Tab');
  await themeButton().focus();
  await assertWhiteNavbarFocus(`${name}-theme-restored`, themeButton());
  await capture(`${name}-theme-restored-focus`, page!.locator('[data-site-header]'));
  await page!.keyboard.press('Tab');
  await assertCommandPaint(`${name}-theme-restored`, width);
  await assertOrdinarySearchFocus(name);
  await searchButton().click();
  const dialog = page!.locator('[role="dialog"]:visible');
  await dialog.waitFor({ state: 'visible' });
  await page!.keyboard.press('Escape');
  await expect.poll(() => dialog.count()).toBe(0);
  expect(await searchButton().evaluate((element) => document.activeElement === element)).toBe(true);
}

describe.skipIf(!enabled).sequential('Bootstrap navbar exact-head native evidence', () => {
  beforeAll(async () => {
    try {
      sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
      await manifest('starting');
      if (
        process.env.GITHUB_ACTIONS !== 'true' ||
        !expectedSha?.match(/^[a-f0-9]{40}$/) ||
        sourceSha !== expectedSha
      )
        throw new Error(
          'Navbar evidence requires GitHub Actions and the exact checked-out source SHA.'
        );
      if (!directory || process.env.PROTO_UI_BROWSER_BASE_URL)
        throw new Error(
          'Navbar evidence requires its own fresh local source server and evidence directory.'
        );
      execFileSync('git', ['diff', '--exit-code', 'HEAD'], { stdio: 'pipe' });
      if (
        execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], {
          encoding: 'utf8',
        }).trim()
      )
        throw new Error('Navbar evidence rejects untracked or modified source inputs.');
      expect(new Set(expectedCases).size).toBe(expectedCases.length);
      baseUrl = await startServer('/en/');
      browser = await launchBrowser();
    } catch (error) {
      startupError = String(error);
      await manifest('startup-failed');
      throw error;
    }
  }, 150_000);
  afterEach(async ({ task }) => {
    const result = {
      name: task.name,
      status: task.result?.state ?? 'unknown',
      errors:
        task.result?.errors?.map((error) => ({ message: error.message, stack: error.stack })) ?? [],
    };
    results.push(result);
    const previousCleanupErrors = cleanupErrors.length;
    await attemptCleanup(`${task.name}: failure capture`, async () => {
      if (page && !page.isClosed() && task.result?.state === 'fail')
        await capture(`case-${results.length}-failure`);
    });
    await attemptCleanup(`${task.name}: fixture`, async () => {
      if (page && !page.isClosed()) {
        await page.evaluate(async () => {
          const fixture = (
            window as unknown as { projectionFamilyFixture?: { dispose(): Promise<void> } }
          ).projectionFamilyFixture;
          await fixture?.dispose();
        });
      }
    });
    await attemptCleanup(`${task.name}: context`, async () => context?.close());
    if (cleanupErrors.length !== previousCleanupErrors) result.status = 'fail';
    context = undefined;
    page = undefined;
    await manifest('running');
  });
  afterAll(async () => {
    await attemptCleanup('final context', async () => context?.close());
    await attemptCleanup('browser', async () => browser?.close());
    await attemptCleanup('source server', stopServer);
    const complete = expectedCases.every((name) => cases.get(name)?.status === 'passed');
    await manifest(
      !startupError &&
        complete &&
        results.length === 12 &&
        results.every((r) => r.status === 'pass') &&
        pageErrors.length === 0 &&
        cleanupErrors.length === 0 &&
        protocolErrors.length === 0
        ? 'passed'
        : 'failed'
    );
    expect(complete, 'Every expected viewport/runtime/theme cell must have passed').toBe(true);
    expect(results).toHaveLength(12);
    expect(results.every((result) => result.status === 'pass')).toBe(true);
    expect(pageErrors).toEqual([]);
    expect(cleanupErrors).toEqual([]);
    expect(protocolErrors).toEqual([]);
  }, 60_000);

  for (const runtime of RUNTIMES)
    for (const theme of THEMES) {
      it(`keeps the ${runtime} ${theme} homepage navbar usable through three viewport changes`, async () => {
        const current = await newPage(theme, runtime);
        await current.goto(`${baseUrl}/en/`, { waitUntil: 'networkidle' });
        await current.waitForFunction(
          (runtime) => {
            const root = document.querySelector<HTMLElement>('[data-homepage-runtime]');
            return root?.dataset.runtimeState === 'ready' && root.dataset.runtime === runtime;
          },
          runtime,
          { timeout: 30_000 }
        );
        await selectFamily();
        const identity = await menu().elementHandle();
        const generation = await current
          .locator('[data-homepage-runtime]')
          .getAttribute('data-runtime-generation');
        for (const viewport of VIEWPORTS)
          await cell(`home-${runtime}-${theme}-${viewport.width}`, async () => {
            await current.setViewportSize(viewport);
            await revealHeaderPreferences(current);
            if ((await menu().getAttribute('aria-expanded')) === 'true')
              await current.keyboard.press('Escape');
            await exerciseHeader(
              `home-${runtime}-${theme}-${viewport.width}`,
              theme,
              viewport.width
            );
            expect(
              await menu().evaluate((element, original) => element === original, identity)
            ).toBe(true);
            expect(
              await current
                .locator('[data-homepage-runtime]')
                .getAttribute('data-runtime-generation')
            ).toBe(generation);
          });
        await identity?.dispose();
        const failures = VIEWPORTS.filter(
          ({ width }) => cases.get(`home-${runtime}-${theme}-${width}`)?.status !== 'passed'
        );
        expect(failures).toEqual([]);
        // Follow an actual compact navigation entry before disposing the document.
        await menu().click();
        const destination = current.locator('.site-header-popup-navigation a:visible').first();
        const href = await destination.getAttribute('href');
        expect(href).toBeTruthy();
        await destination.click();
        await current.waitForURL(new URL(href!, baseUrl).href);
      }, 120_000);
    }
  for (const theme of THEMES) {
    it(`keeps ${theme} documentation controls in the same navbar composition`, async () => {
      const current = await newPage(theme);
      await current.goto(`${baseUrl}${DOCS}`, { waitUntil: 'networkidle' });
      await current.locator('[data-docs-site-header][data-site-menu-ready]').waitFor();
      await current.locator('.site-header-brand [data-site-link-enhanced]').waitFor();
      expect(await current.locator('html').getAttribute('data-site-library-family')).toBe(FAMILY);
      for (const viewport of VIEWPORTS)
        await cell(`docs-${theme}-${viewport.width}`, async () => {
          await current.setViewportSize(viewport);
          await revealHeaderPreferences(current);
          if ((await menu().getAttribute('aria-expanded')) === 'true')
            await current.keyboard.press('Escape');
          await exerciseHeader(`docs-${theme}-${viewport.width}`, theme, viewport.width);
        });
      expect(
        VIEWPORTS.filter(({ width }) => cases.get(`docs-${theme}-${width}`)?.status !== 'passed')
      ).toEqual([]);
    }, 120_000);
    it(`restores actual ${theme} Button paint on the same four Web owners`, async () => {
      const current = await newPage(theme);
      await current.goto(`${baseUrl}${FIXTURE}?theme=${theme}`, { waitUntil: 'networkidle' });
      await current.waitForFunction(
        () => document.documentElement.dataset.familyFixtureReady === 'true',
        undefined,
        { timeout: 60_000 }
      );
      for (const runtime of RUNTIMES)
        await cell(`paint-${runtime}-${theme}`, async () => {
          const button = current
            .locator(`[data-runtime-host="${FAMILY}-${runtime}"]`)
            .getByRole('button', { name: 'Back', exact: true });
          const original = await button.elementHandle();
          const set = (props: Record<string, unknown>) =>
            current.evaluate(
              ({ runtime, props }) => {
                (
                  window as unknown as {
                    projectionFamilyFixture: {
                      setProps(key: string, ref: string, props: Record<string, unknown>): void;
                    };
                  }
                ).projectionFamilyFixture.setProps(`bootstrap-2-3-2-${runtime}`, 'default', props);
              },
              { runtime, props }
            );
          await current.mouse.move(0, 0);
          const ordinary = await paint(button);
          expect(ordinary.image).toContain('linear-gradient');
          await set({ colorContext: 'navbar' });
          await expect.poll(async () => (await paint(button)).image).toBe('none');
          const rest = await paint(button);
          expect(rest.background).toBe('rgba(0, 0, 0, 0)');
          expect(rest.color).toBe('rgb(255, 255, 255)');
          expect(rest.border).toBe('rgba(0, 0, 0, 0)');
          expect(isUnpaintedBootstrapBoxShadow(rest.shadow)).toBe(true);
          await button.hover();
          expect((await paint(button)).background).toBe('rgba(0, 0, 0, 0.1)');
          await current.mouse.down();
          const pressed = await paint(button);
          expect(pressed.background).toBe('rgba(0, 0, 0, 0.2)');
          expect(pressed.shadow).toContain('inset');
          await set({ disabled: true });
          expect((await paint(button)).image).toBe('none');
          expect(isUnpaintedBootstrapBoxShadow((await paint(button)).shadow)).toBe(true);
          await current.mouse.up();
          await current.mouse.move(0, 0);
          await set({ disabled: false, colorContext: 'default' });
          await button.evaluate((element) => (element as HTMLElement).blur());
          await expect.poll(async () => (await paint(button)).image).toBe(ordinary.image);
          const restored = await paint(button);
          for (const key of [
            'background',
            'image',
            'color',
            'border',
            'shadow',
            'opacity',
            'width',
            'height',
          ] as const)
            expect(restored[key], `${runtime} restored ${key}`).toBe(ordinary[key]);
          expect(await button.evaluate((element, before) => element === before, original)).toBe(
            true
          );
          observations.push({ runtime, theme, ordinary, rest, pressed, restored });
          await capture(
            `paint-${runtime}-${theme}`,
            current.locator(`[data-runtime-host="${FAMILY}-${runtime}"]`)
          );
          await original?.dispose();
        });
      expect(
        RUNTIMES.filter((runtime) => cases.get(`paint-${runtime}-${theme}`)?.status !== 'passed')
      ).toEqual([]);
    }, 120_000);
  }
});
