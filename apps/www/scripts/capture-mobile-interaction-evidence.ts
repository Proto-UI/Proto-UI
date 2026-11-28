/** Exact-source, real-input mobile navigation and reading regression.
 * Run the same candidate-owned probe from either clean checkout. Normal
 * 390/430 CSS-pixel captures are simulations, not a physical OnePlus device. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import type { Locator, Page } from 'playwright-core';
import { launchBrowser, startServer, stopServer } from '../src/content/docs/zh-cn/browser-harness';
import { verifyRevision } from './homepage-evidence-contract';
import { createMobileCaptureOwner } from './mobile-capture-owner.mjs';
import { verifyMobileInputs } from './mobile-prepared-inputs.mjs';
import {
  assertClosedHeaderState,
  assertNaturalOneLineCode,
  readCodeReadingGeometry,
} from './mobile-interaction-evidence-contract';

const { values } = parseArgs({
  options: {
    'revision-kind': { type: 'string' },
    'expected-revision': { type: 'string' },
    out: { type: 'string' },
    'quick-preview': { type: 'boolean', default: false },
    'prepared-inputs': { type: 'string' },
  },
});
const kind = values['revision-kind'];
const quickPreview = values['quick-preview'] === true;
assert.ok(kind === 'baseline' || kind === 'candidate');
assert.ok(values.out && values['expected-revision']);
assert.ok(!process.env.PROTO_UI_BROWSER_BASE_URL, 'A source-bound capture starts its own server');
const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const revision = git('rev-parse', 'HEAD');
verifyRevision(
  revision,
  values['expected-revision'],
  git('status', '--porcelain', '--untracked-files=all')
);
const script = fileURLToPath(import.meta.url);
const out = path.resolve(values.out);
await mkdir(out, { recursive: true });
const cases: Array<Record<string, unknown>> = [];
const failures: string[] = [];
const lifecycle: Array<{ stage: string; at: string; activeResources: string[] }> = [];
const report = {
  quickPreview,
  revisionKind: kind,
  revision,
  scriptRevision: execFileSync('git', ['-C', path.dirname(script), 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim(),
  scriptSha256: createHash('sha256')
    .update(await readFile(script))
    .digest('hex'),
  startedAt: new Date().toISOString(),
  interrupted: null as string | null,
  procedure:
    'Clean exact checkout and actual public family atoms. Pointer/keyboard/wheel journeys include explicitly labelled click-only programmatic Menu activation and authored same-document history fixtures traversed through real browser Back. The labelled stress cases change host text size to 200%.',
  limits:
    '390/430 CSS-pixel mobile simulations, not a physical OnePlus 13T or complete assistive-technology/engine coverage. 320px/200% is stress-only.',
  cases,
  failures,
  lifecycle,
};
let pendingSave = Promise.resolve();
const save = () => {
  const snapshot = JSON.stringify(report, null, 2);
  // Cancellation closes Chrome and Astro concurrently. Serialize their evidence
  // writes so one close cannot truncate the other close's JSON snapshot.
  pendingSave = pendingSave
    .catch(() => {})
    .then(() => writeFile(path.join(out, 'metrics.json'), snapshot));
  return pendingSave;
};
const recordLifecycleFailure = (stage: string, error: unknown) => {
  const failure = `lifecycle ${stage}: ${String(error)}`;
  failures.push(failure);
  process.exitCode = 1;
  try {
    writeSync(process.stderr.fd, `${failure}\n`);
  } catch {
    // The nonzero exit and in-memory failure remain even if stderr is unavailable.
  }
};
const recordLifecycle = async (stage: string) => {
  try {
    const observation = {
      stage,
      at: new Date().toISOString(),
      activeResources: process.getActiveResourcesInfo(),
    };
    lifecycle.push(observation);
    writeSync(process.stdout.fd, `[mobile-evidence-lifecycle] ${JSON.stringify(observation)}\n`);
    await save();
  } catch (error) {
    // Evidence failure must fail the job without skipping the original cleanup.
    recordLifecycleFailure(stage, error);
  }
};
// Observation only: no extra timer, forced exit, signal interception or timeout change.
process.once('beforeExit', () => {
  try {
    writeSync(
      process.stdout.fd,
      `[mobile-evidence-lifecycle] ${JSON.stringify({
        stage: 'process-before-exit',
        at: new Date().toISOString(),
        activeResources: process.getActiveResourcesInfo(),
      })}\n`
    );
  } catch (error) {
    recordLifecycleFailure('process-before-exit', error);
  }
});
const homeMenu = (page: Page) =>
  page.locator(
    '.site-header-menu [data-projection-generation-state="active"] [data-demo-ref="home-menu"]'
  );
// Enhancement moves scrolling and keyboard focus from pre to the public
// ScrollArea viewport. Keep the native pre fallback for the aged checkout.
const sourceViewport = (shell: Locator) =>
  shell.locator(
    '[data-code-scroll-ready] [data-code-scroll-viewport], pre:not([data-code-scroll-ready] pre)'
  );
const readyHome = (page: Page, runtime = 'wc') =>
  page.waitForFunction((runtime) => {
    const root = document.querySelector<HTMLElement>('[data-homepage-runtime]');
    return root?.dataset.runtimeState === 'ready' && root.dataset.runtime === runtime;
  }, runtime);
let browser: Awaited<ReturnType<typeof launchBrowser>> | undefined;
const preparedInputs = values['prepared-inputs']
  ? { receiptFile: values['prepared-inputs'], expectedRevision: values['expected-revision'] }
  : undefined;
const owner = createMobileCaptureOwner({
  closeBrowser: async () => {
    await recordLifecycle('browser-close-started');
    await browser?.close();
    await recordLifecycle('browser-close-finished');
  },
  stopServer: async () => {
    await recordLifecycle('server-stop-started');
    await stopServer();
    await recordLifecycle('server-stop-finished');
  },
  save,
  record: (signal: string) => {
    report.interrupted = signal;
    failures.push(`Mobile capture interrupted by ${signal}`);
  },
});
await owner.run(async () => {
  await recordLifecycle('server-start-requested');
  const base = await startServer(['/zh-cn/', '/en/ui-libraries/base/transition/'], preparedInputs);
  owner.checkpoint();
  await recordLifecycle('server-ready');
  browser = await launchBrowser({ captureOwnsSignals: true });
  owner.checkpoint();
  await recordLifecycle('browser-ready');
  for (const width of quickPreview ? [390] : [390, 430])
    for (const locale of quickPreview ? ['zh-cn'] : ['zh-cn', 'en'])
      for (const theme of quickPreview ? (['light'] as const) : (['light', 'dark'] as const)) {
        const id = `${locale}-${width}-${theme}`;
        owner.checkpoint();
        const context = await browser.newContext({
          viewport: { width, height: 844 },
          colorScheme: theme,
          deviceScaleFactor: 1,
          isMobile: true,
          hasTouch: true,
          reducedMotion: 'reduce',
          permissions: ['clipboard-read', 'clipboard-write'],
        });
        const page = await context.newPage();
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        const entry: Record<string, unknown> = {
          id,
          width,
          height: 844,
          theme,
          locale,
          screenshots: [],
          pageErrors: errors,
        };
        const shots = entry.screenshots as string[];
        const screenshot = async (name: string) => {
          const filename = `${id}-${name}.png`;
          await page.screenshot({ path: path.join(out, filename) });
          shots.push(filename);
        };
        cases.push(entry);
        try {
          await page.goto(`${base}/${locale}/`, { waitUntil: 'networkidle' });
          await readyHome(page);
          await homeMenu(page).click();
          await page.locator('[data-site-header-panel]:visible').waitFor();
          const menu = await page.locator('[data-site-header-panel]').evaluate((panel) => {
            const rect = panel.getBoundingClientRect();
            const header = panel.closest('[data-site-header]')!.getBoundingClientRect();
            const surface = panel.querySelector<HTMLElement>('.site-header-popup-surface')!;
            const body = panel.querySelector<HTMLElement>('.site-header-native-slot');
            // Measure the final meaningful row, not a stretchable wrapper that
            // could itself conceal a forced blank footer.
            const content = panel.querySelector<HTMLElement>(
              '.site-header-settings > .site-header-setting:last-child'
            );
            const close = panel
              .closest('[data-site-header]')
              ?.querySelector<HTMLElement>('.site-header-menu [data-demo-ref="home-menu"]');
            return {
              left: rect.left,
              right: rect.right,
              top: rect.top,
              bottom: rect.bottom,
              width: rect.width,
              height: rect.height,
              headerBottom: header.bottom,
              surface: surface?.dataset.projectionPrototype,
              bodyHeight: body?.clientHeight,
              bodyOverflow: body && getComputedStyle(body).overflowY,
              closeHeight: close?.getBoundingClientRect().height,
              extraCloseCount: panel.querySelectorAll(
                '[data-demo-ref="home-menu-close"], [data-site-menu-close]'
              ).length,
              trailingSpace: content ? rect.bottom - content.getBoundingClientRect().bottom : null,
              documentOverflow: document.documentElement.scrollWidth - innerWidth,
            };
          });
          entry.menu = menu;
          await screenshot('navigation-open');
          assert.equal(menu.surface, 'shadcn-surface-root');
          assert.ok(menu.documentOverflow <= 1);
          if (kind === 'candidate') {
            assert.ok(
              Math.abs(menu.left - 8) <= 1 && Math.abs(menu.right - (width - 8)) <= 1,
              'Mobile panel fills safe viewport width'
            );
            assert.ok(Math.abs(menu.top - menu.headerBottom - 5) <= 1);
            assert.ok(menu.bottom <= 837, 'Mobile content fits inside the available viewport');
            assert.equal(menu.extraCloseCount, 0, 'The Header toggle is the single close control');
            assert.ok(
              menu.trailingSpace !== null && menu.trailingSpace >= 0 && menu.trailingSpace <= 24,
              'Natural-height menu has no forced blank area after its content'
            );
            assert.ok((menu.closeHeight ?? 0) >= 44 && (menu.bodyHeight ?? 0) > 250);
            assert.equal(menu.bodyOverflow, 'auto');
          }
          await page.keyboard.press('Escape');
          assert.equal(await homeMenu(page).getAttribute('aria-expanded'), 'false');
          assert.ok(await homeMenu(page).evaluate((e) => e === document.activeElement));
          await page.keyboard.press('Enter');
          assert.equal(await homeMenu(page).getAttribute('aria-expanded'), 'true');
          if (kind === 'candidate') {
            await homeMenu(page).click();
            assert.equal(await homeMenu(page).getAttribute('aria-expanded'), 'false');
            assert.ok(await homeMenu(page).evaluate((e) => e === document.activeElement));
            await page.keyboard.press('Space');
          }
          if (!quickPreview) {
            // Exercise nested Select Escape before its parent and actual generation replacement.
            const runtime = page.locator(
              '#home-preferences [data-projection-control="runtime"] [role="combobox"]'
            );
            await runtime.click();
            await page.keyboard.press('Escape');
            assert.equal(await homeMenu(page).getAttribute('aria-expanded'), 'true');
            for (const [target, label] of [
              ['react', 'React'],
              ['vue', 'Vue'],
              ['vue2', 'Vue 2'],
              ['wc', 'Web Components'],
            ]) {
              await runtime.click();
              const control = await runtime.getAttribute('aria-controls');
              await page
                .locator(`[id=${JSON.stringify(control)}]`)
                .getByRole('option', { name: label, exact: true })
                .click();
              await readyHome(page, target);
              assert.equal(await homeMenu(page).getAttribute('aria-expanded'), 'true');
              if (kind === 'candidate') assert.ok(await homeMenu(page).isVisible());
              if (
                kind === 'candidate' &&
                width === 390 &&
                locale === 'zh-cn' &&
                theme === 'light'
              ) {
                await runtime.click();
                const popup = await runtime.getAttribute('aria-controls');
                // Deliberately click without pointerdown: an accessibility or
                // programmatic activation cannot rely on outside-press cleanup.
                await homeMenu(page).evaluate((element) => (element as HTMLElement).click());
                await page.locator(`[id=${JSON.stringify(popup)}]`).waitFor({ state: 'hidden' });
                assert.equal(await homeMenu(page).getAttribute('aria-expanded'), 'false');
                assert.equal(await runtime.getAttribute('aria-expanded'), 'false');
                assert.ok(
                  await homeMenu(page).evaluate((element) => element === document.activeElement)
                );
                await screenshot(`${target}-click-only-close`);
                await homeMenu(page).click();
                await runtime.click();
                await page.evaluate(() => history.pushState(null, '', '#header-runtime-history'));
                await page.goBack();
                await page.locator(`[id=${JSON.stringify(popup)}]`).waitFor({ state: 'hidden' });
                assert.equal(await homeMenu(page).getAttribute('aria-expanded'), 'false');
                assert.equal(await runtime.getAttribute('aria-expanded'), 'false');
                assert.equal(
                  await page.locator(`[id=${JSON.stringify(popup)}]`).isVisible(),
                  false
                );
                await screenshot(`${target}-history-close`);
                await homeMenu(page).click();
              }
            }
            const originalTheme = await page.locator('html').getAttribute('data-theme');
            const themeControl = page.locator('.site-header-theme [data-demo-ref="home-theme"]');
            await themeControl.click();
            await page.waitForFunction(
              (previous) => document.documentElement.dataset.theme !== previous,
              originalTheme
            );
            assert.equal(await homeMenu(page).getAttribute('aria-expanded'), 'true');
            assert.ok(
              await page.evaluate(() => document.documentElement.scrollWidth - innerWidth <= 1)
            );
            await themeControl.click();
            await page.waitForFunction(
              (previous) => document.documentElement.dataset.theme === previous,
              originalTheme
            );
            await page.locator('#home-navigation-mobile [data-homepage-mount] a').first().click();
            await page.waitForURL(`**/${locale}/start-here/what-you-saw/`);
            assert.equal(
              await page.locator('[data-site-menu-button]').getAttribute('aria-expanded'),
              'false'
            );
            await page.goBack({ waitUntil: 'networkidle' });
            await readyHome(page);
            assert.equal(await homeMenu(page).getAttribute('aria-expanded'), 'false');
            entry.navigationJourneys =
              'Escape, Enter/Space, single Header close, nested Select Escape, WC/React/Vue/Vue2 replacement, theme round trip, native navigation and browser Back';
          }
          await page.goto(`${base}/${locale}/ui-libraries/base/transition/`, {
            waitUntil: 'networkidle',
          });
          await page.waitForSelector('[data-code-panel-init="1"]:visible');
          await page.waitForFunction(() => {
            const shell = [...document.querySelectorAll<HTMLElement>('[data-code-shell]')].find(
              (e) => e.checkVisibility()
            );
            const previewer = shell?.closest('[data-previewer-id]') as
              | (HTMLElement & { __previewer__?: { getCurrentRuntime(): string | null } })
              | null;
            return shell && (!previewer || !!previewer.__previewer__?.getCurrentRuntime());
          });
          const docsMenu = page.locator('[data-site-menu-button]');
          await docsMenu.click();
          if (kind === 'candidate') {
            await docsMenu.click();
            assert.ok(await docsMenu.evaluate((e) => e === document.activeElement));
          } else await page.keyboard.press('Escape');
          const shell = page.locator('[data-code-shell]:visible').first();
          const toggle = shell.locator('[data-code-toggle]');
          if (await toggle.isVisible()) {
            await toggle.focus();
            await page.keyboard.press('Enter');
          }
          assert.equal(await shell.getAttribute('data-code-expanded'), 'true');
          const source = sourceViewport(shell);
          await shell.scrollIntoViewIfNeeded();
          const copy = shell.locator('[data-copy] [data-demo-ref="copy-button"]');
          await copy.waitFor({ state: 'visible' });
          const initialSource = await source.evaluate((e) => ({
            height: e.clientHeight,
            fullHeight: e.scrollHeight,
            width: e.clientWidth,
            fullWidth: e.scrollWidth,
            overflowX: getComputedStyle(e).overflowX,
            documentOverflow: document.documentElement.scrollWidth - innerWidth,
          }));
          entry.code = initialSource;
          await screenshot('code-expanded');
          if (kind === 'candidate') {
            assert.equal(await shell.locator('[data-demo-ref="copy-backplate"]').count(), 0);
            const appearance = await copy.evaluate((e) => {
              const style = getComputedStyle(e);
              const canvas = document.createElement('canvas');
              canvas.width = canvas.height = 1;
              const ctx = canvas.getContext('2d')!;
              const [backgroundAlpha, borderAlpha] = [
                style.backgroundColor,
                style.borderTopColor,
              ].map((color) => {
                ctx.clearRect(0, 0, 1, 1);
                ctx.fillStyle = color;
                ctx.fillRect(0, 0, 1, 1);
                return ctx.getImageData(0, 0, 1, 1).data[3];
              });
              return {
                prototype: e.getAttribute('data-projection-prototype'),
                floating: Boolean(e.closest('[data-code-inner] > .site-code-copy-overlay')),
                backgroundAlpha,
                borderAlpha,
                borderWidth: parseFloat(style.borderTopWidth),
                role: e.getAttribute('role'),
                tabindex: e.getAttribute('tabindex'),
              };
            });
            entry.copyAppearance = appearance;
            assert.equal(appearance.prototype, 'shadcn-button');
            assert.equal(appearance.floating, true);
            assert.equal(appearance.backgroundAlpha, 255);
            assert.ok(appearance.borderWidth > 0 && appearance.borderAlpha > 0);
            assert.equal(appearance.role, 'button');
            assert.equal(appearance.tabindex, '0');
          }
          await copy.hover();
          await screenshot('copy-hover');
          await page.mouse.move(0, 0);
          await source.focus();
          await page.keyboard.press('Shift+Tab');
          assert.ok(
            await copy.evaluate((e) => e === document.activeElement && e.matches(':focus-visible'))
          );
          await screenshot('copy-keyboard-focus');

          if (kind === 'candidate')
            assert.ok(initialSource.height > 144, 'Expanded reading is no longer capped at 9rem');
          assert.ok(initialSource.documentOverflow <= 1);
          const before = await copy.boundingBox();
          await source.focus();
          if (initialSource.fullHeight > initialSource.height + 1) {
            await page.keyboard.press('PageDown');
            await page.waitForFunction(
              () => (document.activeElement as HTMLElement)?.scrollTop > 0
            );
          }
          if (initialSource.fullWidth > initialSource.width + 1) {
            await page.keyboard.press('ArrowRight');
            await page.waitForFunction(
              () => (document.activeElement as HTMLElement)?.scrollLeft > 0
            );
          }
          const after = await copy.boundingBox();
          assert.ok(
            before &&
              after &&
              Math.abs(before.x - after.x) <= 1 &&
              Math.abs(before.y - after.y) <= 1,
            'Code scrolling does not move Copy'
          );
          await screenshot('code-scrolled');
          const raw = await source.locator('code').getAttribute('data-raw-code');
          assert.equal(await copy.getAttribute('data-copy-state'), 'idle');
          await copy.click();
          await page.waitForFunction(() => {
            const active = [...document.querySelectorAll<HTMLElement>('[data-code-shell]')].find(
              (e) => e.checkVisibility()
            );
            return (
              active
                ?.querySelector('[data-demo-ref="copy-button"]')
                ?.getAttribute('data-copy-state') === 'success'
            );
          });
          assert.equal(
            await page.evaluate(() => navigator.clipboard.readText()),
            raw,
            'Copy preserves exact source payload'
          );
          entry.copy = 'Exact raw source copied after native source scrolling';
          if (!quickPreview) {
            await page.goto(`${base}/${locale}/start-here/quick-start/`, {
              waitUntil: 'networkidle',
            });
            const shortShell = page
              .locator('[data-code-example] [data-code-shell]:visible')
              .first();
            await shortShell.waitFor({ state: 'visible' });
            await page.waitForFunction(
              () =>
                [
                  ...document.querySelectorAll<HTMLElement>(
                    '[data-code-example] [data-code-shell]'
                  ),
                ].find((e) => e.checkVisibility())?.dataset.codeExpanded === 'true'
            );
            const shortSource = sourceViewport(shortShell);
            const shortCopy = shortShell.locator('[data-copy] [data-demo-ref="copy-button"]');
            await shortCopy.waitFor({ state: 'visible' });
            await shortShell.scrollIntoViewIfNeeded();
            const shortFacts = await shortSource.evaluate(readCodeReadingGeometry);
            entry.shortCode = { ...shortFacts, text: shortFacts.raw };
            assertNaturalOneLineCode(shortFacts, kind, 'Short code');
            assert.ok(shortFacts.documentOverflow <= 1);
            entry.shortSourceFraming = await page.evaluate(() => ({
              header: document.querySelector('header')?.getBoundingClientRect().toJSON(),
              scrollY,
              ancestors: [
                ...document.querySelectorAll('.site-page-frame, .container-wrapper, header'),
              ].map((e) => ({
                tag: e.localName,
                class: e.className,
                position: getComputedStyle(e).position,
                transform: getComputedStyle(e).transform,
                rect: e.getBoundingClientRect().toJSON(),
              })),
            }));
            await screenshot('code-short-natural');
            assert.equal(await shortCopy.getAttribute('data-copy-state'), 'idle');
            await shortCopy.click();
            await page.waitForFunction(
              () =>
                [...document.querySelectorAll<HTMLElement>('[data-code-example] [data-code-shell]')]
                  .find((e) => e.checkVisibility())
                  ?.querySelector('[data-demo-ref="copy-button"]')
                  ?.getAttribute('data-copy-state') === 'success'
            );
            assert.equal(await page.evaluate(() => navigator.clipboard.readText()), shortFacts.raw);
            entry.shortCode = {
              ...shortFacts,
              text: shortFacts.raw,
              copy: 'Exact one-line command copied',
            };
          }

          assert.deepEqual(errors, []);
          owner.checkpoint();
          entry.outcome = 'passed';
        } catch (error) {
          owner.checkpoint();
          entry.outcome = 'failed';
          entry.error = error instanceof Error ? error.stack : String(error);
          failures.push(`${id}: ${String(error)}`);
          await screenshot('failure').catch(() => {});
        } finally {
          await save();
          await context.close();
        }
      }
  // Direct #856 route/viewport regression. Keep the eight homepage journeys and
  // the two stress cases above/below unchanged; neither substitutes for Docs.
  if (kind === 'candidate' && !quickPreview) {
    const id = 'en-500x761-docs-header-escape';
    owner.checkpoint();
    const route = '/en/start-here/what-you-saw/';
    const context = await browser.newContext({
      viewport: { width: 500, height: 761 },
      deviceScaleFactor: 1,
      colorScheme: 'light',
      locale: 'en-US',
      isMobile: false,
      hasTouch: false,
      reducedMotion: 'no-preference',
    });
    const page = await context.newPage();
    const errors: string[] = [];
    const screenshots: string[] = [];
    const observations: Array<Record<string, unknown>> = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const entry: Record<string, unknown> = {
      id,
      route,
      width: 500,
      height: 761,
      deviceScaleFactor: 1,
      theme: 'light',
      locale: 'en',
      browserVersion: browser.version(),
      sourceRevision: revision,
      candidateOnly: true,
      procedure:
        'Open and close the current public Search Dialog, then use native Menu click and keyboard Enter/Space/Escape on the actual Docs route. Read-only DOM/ARIA observations; no focus(), dispatchEvent(), state/aria writes or runtime handles.',
      limits:
        'Desktop-browser 500x761 CSS viewport simulation, not physical-device or complete assistive-technology coverage. ARIA snapshots are Playwright accessible-tree projections. The older mobile baseline is not the d850 parent and does not provide a new Docs red control.',
      screenshots,
      observations,
      pageErrors: errors,
    };
    cases.push(entry);
    const header = page.locator('[data-docs-site-header]');
    const menu = header.locator('[data-site-menu-button]');
    const panel = header.locator('[data-site-header-panel]');
    const docs = header
      .locator('[data-site-header-navigation]')
      .getByRole('link', { name: 'Docs', exact: true, includeHidden: true });
    const closedSearch = () =>
      header.evaluate((root) => {
        const search = root.querySelector('site-search');
        const commands = search?.querySelectorAll('[data-search-command="open"]');
        const command = commands?.[0];
        const owner = search
          ?.querySelector('[data-search-dialog-mount]')
          ?.getAttribute('data-projection-owner');
        const ownedPopups = [
          ...document.querySelectorAll<HTMLElement>('[role="dialog"], [role="listbox"]'),
        ].filter((popup) => owner && popup.getAttribute('data-projection-owner') === owner);
        return {
          composition: search?.getAttribute('data-search-composition'),
          connected: !!search?.isConnected && !!command?.isConnected,
          commandCount: commands?.length ?? 0,
          commandRole: command?.getAttribute('role'),
          commandExpanded: command?.getAttribute('aria-expanded'),
          commandDisabled: command?.getAttribute('aria-disabled'),
          owner,
          popups: ownedPopups.map((popup) => ({
            role: popup.getAttribute('role'),
            connected: popup.isConnected,
            visible:
              popup.checkVisibility() &&
              popup.getBoundingClientRect().width > 0 &&
              popup.getBoundingClientRect().height > 0 &&
              !popup.closest('[hidden], [inert], [aria-hidden="true"]'),
          })),
        };
      });
    const capture = async (stage: string) => {
      const filename = `${id}-${stage}.png`;
      await page.screenshot({ path: path.join(out, filename) });
      screenshots.push(filename);
      observations.push({
        stage,
        at: new Date().toISOString(),
        url: page.url(),
        expanded: await menu.getAttribute('aria-expanded'),
        panelVisible: await panel.isVisible(),
        docsFocused: await docs.evaluate((element) => element === document.activeElement),
        menuFocused: await menu.evaluate((element) => element === document.activeElement),
        activeElement: await page.evaluate(() => ({
          tag: document.activeElement?.localName,
          id: document.activeElement?.id,
          role: document.activeElement?.getAttribute('role'),
          label: document.activeElement?.getAttribute('aria-label'),
        })),
        closedSearch: await closedSearch(),
        headerAria: await header.ariaSnapshot(),
      });
      await save();
    };
    const closeHeaderWithEscape = async (stage: string) => {
      await page.keyboard.press('Escape');
      const deadline = performance.now() + 1000;
      const immediate = await header.evaluate((root) => {
        const menus = root.querySelectorAll<HTMLElement>('[data-site-menu-button]');
        const panels = root.querySelectorAll<HTMLElement>('[data-site-header-panel]');
        return {
          menuCount: menus.length,
          panelCount: panels.length,
          expanded: menus[0]?.getAttribute('aria-expanded') ?? null,
          hidden: panels[0]?.hidden ?? false,
          inert: panels[0]?.inert ?? false,
          menuFocused: menus[0] === document.activeElement,
        };
      });
      observations.push({
        stage: `${stage}-immediate`,
        at: new Date().toISOString(),
        ...immediate,
      });
      assertClosedHeaderState(immediate);
      // Closing keeps the public leave animation, but it cannot accept input.
      // Physical removal shares the original 1s close budget; capture I/O does
      // not postpone the deadline or add another waiting period.
      const remaining = deadline - performance.now();
      assert.ok(remaining > 0, 'Header close remains inside the original 1000ms budget');
      await panel.waitFor({ state: 'hidden', timeout: remaining });
      await capture(stage);
    };
    try {
      await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
      await header.locator('site-search[data-search-view="ready"]').waitFor();
      const searchCommand = header.locator('site-search [data-search-command="open"]');
      await searchCommand.click();
      const searchDialog = page.getByRole('dialog');
      await searchDialog.waitFor({ state: 'visible' });
      assert.equal(await searchDialog.count(), 1, 'The current Search opens one real Dialog');
      await capture('search-dialog-open');
      await page.keyboard.press('Escape');
      await searchDialog.waitFor({ state: 'hidden' });
      assert.ok(
        await searchCommand.evaluate((element) => element === document.activeElement),
        'Search returns native focus before the Header journey'
      );
      await capture('search-dialog-closed');
      await menu.click();
      await docs.and(page.locator(':focus')).waitFor({ state: 'visible' });
      const search = await closedSearch();
      entry.initialClosedSearch = search;
      assert.equal(search.composition, 'command-dialog');
      assert.equal(search.commandCount, 1, 'One current public Search opener');
      assert.equal(search.commandRole, 'button');
      assert.ok(search.connected && search.commandDisabled !== 'true');
      assert.ok(search.owner, 'Closed Search retains its actual Dialog owner');
      assert.notEqual(search.commandExpanded, 'true');
      assert.ok(
        search.popups.every((popup) => !popup.visible),
        'Closed Search presentation cannot reserve Header Escape'
      );
      for (const reopenKey of ['initial', 'Enter', 'Space']) {
        if (reopenKey !== 'initial') {
          await menu.and(page.locator(':focus')).waitFor({ state: 'visible' });
          await page.keyboard.press(reopenKey);
          await docs.and(page.locator(':focus')).waitFor({ state: 'visible' });
        }
        assert.equal(await menu.getAttribute('aria-expanded'), 'true');
        await capture(`${reopenKey}-before-escape`);
        await closeHeaderWithEscape(`${reopenKey}-after-escape`);
        assert.equal(await menu.getAttribute('aria-expanded'), 'false');
        assert.equal(await panel.isVisible(), false);
        assert.ok(await menu.evaluate((element) => element === document.activeElement));
      }

      // A genuinely open nested Select owns the first Escape; the already
      // closed Search Dialog does not. The next Escape belongs to Header.
      await page.keyboard.press('Enter');
      await docs.and(page.locator(':focus')).waitFor({ state: 'visible' });
      const runtime = header.locator('[data-adapter-select-root] [role="combobox"]');
      await runtime.click();
      const runtimePopupId = await runtime.getAttribute('aria-controls');
      assert.ok(runtimePopupId && !/\s/.test(runtimePopupId));
      const runtimePopup = page.locator(`[id=${JSON.stringify(runtimePopupId)}]`);
      await runtimePopup.waitFor({ state: 'visible' });
      assert.equal(await runtime.getAttribute('aria-expanded'), 'true');
      entry.nestedSelectOpenAria = await runtimePopup.ariaSnapshot();
      await capture('nested-select-open');
      await page.keyboard.press('Escape');
      await runtimePopup.waitFor({ state: 'hidden' });
      await capture('nested-select-first-escape');
      assert.equal(await runtime.getAttribute('aria-expanded'), 'false');
      assert.equal(await menu.getAttribute('aria-expanded'), 'true');
      assert.ok(await runtime.evaluate((element) => element === document.activeElement));
      await closeHeaderWithEscape('nested-select-second-escape');
      assert.equal(await menu.getAttribute('aria-expanded'), 'false');
      assert.equal(await panel.isVisible(), false);
      assert.ok(await menu.evaluate((element) => element === document.activeElement));

      // Separate positive control: Page contents uses a real Dialog owner.
      const contents = header.locator('[data-site-contents-button]:visible');
      await contents.click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor({ state: 'visible' });
      assert.equal(await dialog.count(), 1);
      entry.contentsOpenAria = await dialog.ariaSnapshot();
      await capture('contents-dialog-open');
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      await capture('contents-dialog-escape');
      assert.equal(await contents.getAttribute('aria-expanded'), 'false');
      assert.ok(await contents.evaluate((element) => element === document.activeElement));
      assert.equal(await menu.getAttribute('aria-expanded'), 'false');
      assert.deepEqual(errors, []);
      owner.checkpoint();
      entry.outcome = 'passed';
    } catch (error) {
      owner.checkpoint();
      entry.outcome = 'failed';
      entry.error = error instanceof Error ? error.stack : String(error);
      failures.push(`${id}: ${String(error)}`);
      await capture('failure').catch(() => {});
    } finally {
      await save();
      await context.close();
    }
  }
  // Explicit host text enlargement is stress-only, separate from normal-phone views.
  if (kind === 'candidate' && !quickPreview)
    for (const locale of ['zh-cn', 'en']) {
      const id = `${locale}-320-text200-stress`;
      owner.checkpoint();
      const context = await browser.newContext({
        viewport: { width: 320, height: 640 },
        reducedMotion: 'reduce',
        permissions: ['clipboard-read', 'clipboard-write'],
      });
      const page = await context.newPage();
      const entry: Record<string, unknown> = { id, stressOnly: true, width: 320, textPercent: 200 };
      const observations: Array<Record<string, unknown>> = [];
      entry.observations = observations;
      const observe = async (stage: string) => {
        entry.stage = stage;
        const facts = await page.evaluate(() => ({
          viewport: { width: innerWidth, height: innerHeight },
          rootFont: getComputedStyle(document.documentElement).fontSize,
          documentOverflow: document.documentElement.scrollWidth - innerWidth,
          scroll: { x: scrollX, y: scrollY },
          activeElement: {
            tag: document.activeElement?.localName,
            role: document.activeElement?.getAttribute('role'),
            ref: document.activeElement?.getAttribute('data-demo-ref'),
          },
          boxes: [
            '[data-homepage-runtime]',
            '[data-site-header-panel]',
            '.site-header-native-slot',
            '.site-header-menu [data-projection-generation-state="active"] [data-demo-ref="home-menu"]',
            '[data-site-header-settings]',
            '[data-code-shell]',
            '[data-code-shell] [data-code-scroll-viewport]',
            '[data-code-shell] pre',
          ].flatMap((selector) =>
            [...document.querySelectorAll<HTMLElement>(selector)].map((node) => ({
              selector,
              rect: node.getBoundingClientRect().toJSON(),
              visible: node.checkVisibility(),
              expanded: node.getAttribute('aria-expanded'),
              scrollTop: node.scrollTop,
              clientHeight: node.clientHeight,
              scrollHeight: node.scrollHeight,
              overflowX: getComputedStyle(node).overflowX,
              overflowY: getComputedStyle(node).overflowY,
            }))
          ),
        }));
        observations.push({ stage, at: new Date().toISOString(), ...facts });
        await save();
      };
      cases.push(entry);
      try {
        entry.stage = 'home-navigation';
        await page.goto(`${base}/${locale}/`, { waitUntil: 'networkidle' });
        entry.stage = 'home-readiness';
        await readyHome(page);
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '200%';
        });
        entry.stage = 'home-native-menu-open';
        await homeMenu(page).click();
        await observe('enlarged-header-open');
        const body = page.locator('.site-header-native-slot');
        const close = homeMenu(page);
        const before = await close.boundingBox();
        const bounds = await body.boundingBox();
        assert.ok(
          bounds && before,
          'The enlarged panel and its native close toggle have layout boxes'
        );
        const initialScroll = await body.evaluate((e) => e.scrollTop);
        assert.ok(
          await body.evaluate((e) => e.scrollHeight > e.clientHeight),
          'Stress case genuinely requires menu scrolling'
        );
        await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
        await observe('before-native-menu-scroll');
        await page.mouse.wheel(0, 1000);
        await page.waitForFunction(
          (previous) =>
            (document.querySelector('.site-header-native-slot')?.scrollTop ?? 0) > previous,
          initialScroll
        );
        const after = await close.boundingBox();
        await observe('after-native-menu-scroll');
        assert.ok(
          after && Math.abs(before.y - after.y) <= 1,
          'The single Header close toggle stays reachable while menu content scrolls'
        );
        assert.ok(after.y >= 0 && after.y + after.height <= 640);
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth - innerWidth <= 1)
        );
        await page.screenshot({ path: path.join(out, `${id}-scrolled.png`) });
        entry.screenshots = [`${id}-scrolled.png`];
        await close.click();
        await observe('enlarged-header-closed');
        assert.ok(await homeMenu(page).evaluate((e) => e === document.activeElement));
        for (const [sourceKind, route] of [
          ['long', 'ui-libraries/base/transition/'],
          ['short', 'start-here/quick-start/'],
        ] as const) {
          entry.stage = `code-${sourceKind}-navigation`;
          await page.goto(`${base}/${locale}/${route}`, { waitUntil: 'networkidle' });
          entry.stage = `code-${sourceKind}-readiness`;
          await page.waitForSelector('[data-code-panel-init="1"]:visible');
          await page.evaluate(() => {
            document.documentElement.style.fontSize = '200%';
          });
          if (sourceKind === 'long')
            await page.waitForFunction(() => {
              const shell = [...document.querySelectorAll<HTMLElement>('[data-code-shell]')].find(
                (e) => e.checkVisibility()
              );
              const previewer = shell?.closest('[data-previewer-id]') as
                | (HTMLElement & { __previewer__?: { getCurrentRuntime(): string | null } })
                | null;
              return !!previewer?.__previewer__?.getCurrentRuntime();
            });
          entry.stage = `code-${sourceKind}-controls`;
          const shell = page.locator('[data-code-shell]:visible').first();
          const toggle = shell.locator('[data-code-toggle]');
          if (await toggle.isVisible()) await toggle.click();
          const source = sourceViewport(shell);
          const copy = shell.locator('[data-copy] [data-demo-ref="copy-button"]');
          await copy.waitFor({ state: 'visible' });
          await shell.scrollIntoViewIfNeeded();
          const facts = await source.evaluate(readCodeReadingGeometry);
          entry[`code-${sourceKind}`] = facts;
          entry[`code-${sourceKind}-layout`] = await page.evaluate(() => ({
            header: document.querySelector('header')?.getBoundingClientRect().toJSON(),
            scrollY,
            overflow: [...document.querySelectorAll<HTMLElement>('body *')]
              .filter(
                (e) => e.checkVisibility() && e.getBoundingClientRect().right > innerWidth + 1
              )
              .slice(0, 20)
              .map((e) => ({
                tag: e.localName,
                class: e.className,
                rect: e.getBoundingClientRect().toJSON(),
                overflowX: getComputedStyle(e).overflowX,
              })),
          }));
          await observe(`code-${sourceKind}-layout`);
          assert.ok(facts.containsSource, 'The reading viewport contains the actual source pre');
          assert.ok(
            facts.fullHeight + 1 >= facts.sourceHeight && facts.fullWidth + 1 >= facts.sourceWidth,
            'The complete source remains within the reachable scroll extent'
          );
          assert.ok(
            (facts.fullHeight <= facts.height + 1 || /^(auto|scroll)$/.test(facts.overflowY)) &&
              (facts.fullWidth <= facts.width + 1 || /^(auto|scroll)$/.test(facts.overflowX)),
            'Overflowing source stays scrollable on both axes'
          );
          assert.ok(
            facts.documentOverflow <= 1 &&
              facts.height > 0 &&
              facts.height <= Math.min(36 * facts.rootFontSize, 0.65 * facts.viewportHeight) + 1,
            'Enlarged source fits its independent viewport'
          );
          if (sourceKind === 'short') assertNaturalOneLineCode(facts, kind, 'Enlarged short code');
          entry.stage = `code-${sourceKind}-keyboard-scroll`;
          await source.focus();
          assert.ok(
            await source.evaluate((e) => e === document.activeElement),
            'The source viewport owns keyboard focus'
          );
          if (facts.fullHeight > facts.height + 1) {
            await page.keyboard.press('PageDown');
            await page.waitForFunction(
              () => (document.activeElement as HTMLElement)?.scrollTop > 0
            );
          }
          if (facts.fullWidth > facts.width + 1) {
            await page.keyboard.press('ArrowRight');
            await page.waitForFunction(
              () => (document.activeElement as HTMLElement)?.scrollLeft > 0
            );
          }
          const filename = `${id}-code-${sourceKind}.png`;
          await page.screenshot({ path: path.join(out, filename) });
          (entry.screenshots as string[]).push(filename);
          assert.equal(await copy.getAttribute('data-copy-state'), 'idle');
          entry.stage = `code-${sourceKind}-copy`;
          await copy.click();
          await page.waitForFunction(
            () =>
              [...document.querySelectorAll<HTMLElement>('[data-code-shell]')]
                .find((e) => e.checkVisibility())
                ?.querySelector('[data-demo-ref="copy-button"]')
                ?.getAttribute('data-copy-state') === 'success'
          );
          assert.equal(await page.evaluate(() => navigator.clipboard.readText()), facts.raw);
          entry[`code-${sourceKind}`] = {
            ...facts,
            copy: 'Exact source copied after enlarged keyboard scroll',
          };
          await observe(`code-${sourceKind}-complete`);
        }
        owner.checkpoint();
        entry.outcome = 'passed';
      } catch (error) {
        owner.checkpoint();
        entry.outcome = 'failed';
        entry.failedStage = entry.stage;
        entry.error = error instanceof Error ? error.stack : String(error);
        failures.push(`${id}: ${String(error)}`);
        await observe('failure').catch(() => {});
        await page.screenshot({ path: path.join(out, `${id}-failure.png`) }).catch(() => {});
      } finally {
        await context.close();
        await save();
      }
    }
  await recordLifecycle('cases-loop-finished');
});
owner.checkpoint();
if (preparedInputs) await verifyMobileInputs({ root: process.cwd(), ...preparedInputs });
assert.deepEqual(
  failures,
  [],
  'All mobile cases must pass; retain actual failure screenshots and measurements'
);
await recordLifecycle('assertions-complete');
