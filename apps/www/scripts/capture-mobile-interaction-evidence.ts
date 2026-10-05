/** Exact-source, real-input mobile navigation and reading regression.
 * Run the same candidate-owned probe from either clean checkout. Normal
 * 390/430 CSS-pixel captures are simulations, not a physical OnePlus device. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import type { Page } from 'playwright-core';
import { launchBrowser, startServer, stopServer } from '../src/content/docs/zh-cn/browser-harness';
import { verifyRevision } from './homepage-evidence-contract';

const { values } = parseArgs({
  options: {
    'revision-kind': { type: 'string' },
    'expected-revision': { type: 'string' },
    out: { type: 'string' },
    'quick-preview': { type: 'boolean', default: false },
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
  procedure:
    'Clean exact checkout and actual public family atoms. Pointer/keyboard/wheel journeys include explicitly labelled click-only programmatic Menu activation and authored same-document history fixtures traversed through real browser Back. The labelled stress cases change host text size to 200%.',
  limits:
    '390/430 CSS-pixel mobile simulations, not a physical OnePlus 13T or complete assistive-technology/engine coverage. 320px/200% is stress-only.',
  cases,
  failures,
};
const save = () => writeFile(path.join(out, 'metrics.json'), JSON.stringify(report, null, 2));
const homeMenu = (page: Page) =>
  page.locator(
    '.site-header-menu [data-projection-generation-state="active"] [data-demo-ref="home-menu"]'
  );
const readyHome = (page: Page, runtime = 'wc') =>
  page.waitForFunction((runtime) => {
    const root = document.querySelector<HTMLElement>('[data-homepage-runtime]');
    return root?.dataset.runtimeState === 'ready' && root.dataset.runtime === runtime;
  }, runtime);
const base = await startServer(['/zh-cn/', '/en/ui-libraries/base/transition/']);
const browser = await launchBrowser();
try {
  for (const width of quickPreview ? [390] : [390, 430])
    for (const locale of quickPreview ? ['zh-cn'] : ['zh-cn', 'en'])
      for (const theme of quickPreview ? (['light'] as const) : (['light', 'dark'] as const)) {
        const id = `${locale}-${width}-${theme}`;
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
          const source = shell.locator('pre');
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
            const backplate = shell.locator('[data-demo-ref="copy-backplate"]');
            const plate = await backplate.evaluate((e) => {
              const style = getComputedStyle(e);
              const canvas = document.createElement('canvas');
              canvas.width = canvas.height = 1;
              const ctx = canvas.getContext('2d')!;
              ctx.fillStyle = style.backgroundColor;
              ctx.fillRect(0, 0, 1, 1);
              return {
                prototype: e.getAttribute('data-projection-prototype'),
                alpha: ctx.getImageData(0, 0, 1, 1).data[3],
                role: e.getAttribute('role'),
                tabindex: e.getAttribute('tabindex'),
              };
            });
            assert.equal(plate.prototype, 'shadcn-surface-root');
            assert.equal(plate.alpha, 255);
            assert.equal(plate.role, null);
            assert.equal(plate.tabindex, null);
            entry.copyBackplate = plate;
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
            const shortSource = shortShell.locator('pre');
            const shortCopy = shortShell.locator('[data-copy] [data-demo-ref="copy-button"]');
            await shortCopy.waitFor({ state: 'visible' });
            await shortShell.scrollIntoViewIfNeeded();
            const shortFacts = await shortSource.evaluate((e) => ({
              height: e.clientHeight,
              fullHeight: e.scrollHeight,
              lineHeight: parseFloat(getComputedStyle(e).lineHeight),
              text: e.querySelector('code')?.getAttribute('data-raw-code'),
              documentOverflow: document.documentElement.scrollWidth - innerWidth,
            }));
            assert.ok(
              shortFacts.text && shortFacts.text.split('\n').length === 1,
              'The real short example is one install command'
            );
            assert.ok(
              shortFacts.height > 0 && shortFacts.height <= shortFacts.lineHeight + 1,
              'Short code keeps its natural one-line height'
            );
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
            assert.equal(
              await page.evaluate(() => navigator.clipboard.readText()),
              shortFacts.text
            );
            entry.shortCode = { ...shortFacts, copy: 'Exact one-line command copied' };
          }

          assert.deepEqual(errors, []);
          entry.outcome = 'passed';
        } catch (error) {
          entry.outcome = 'failed';
          entry.error = error instanceof Error ? error.stack : String(error);
          failures.push(`${id}: ${String(error)}`);
          await screenshot('failure').catch(() => {});
        } finally {
          await save();
          await context.close();
        }
      }
  // Explicit host text enlargement is stress-only, separate from normal-phone views.
  if (kind === 'candidate' && !quickPreview)
    for (const locale of ['zh-cn', 'en']) {
      const id = `${locale}-320-text200-stress`;
      const context = await browser.newContext({
        viewport: { width: 320, height: 640 },
        reducedMotion: 'reduce',
        permissions: ['clipboard-read', 'clipboard-write'],
      });
      const page = await context.newPage();
      const entry: Record<string, unknown> = { id, stressOnly: true, width: 320, textPercent: 200 };
      cases.push(entry);
      try {
        await page.goto(`${base}/${locale}/`, { waitUntil: 'networkidle' });
        await readyHome(page);
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '200%';
        });
        await homeMenu(page).click();
        const body = page.locator('.site-header-native-slot');
        const close = homeMenu(page);
        const before = await close.boundingBox();
        const bounds = await body.boundingBox();
        assert.ok(bounds && before);
        const initialScroll = await body.evaluate((e) => e.scrollTop);
        assert.ok(
          await body.evaluate((e) => e.scrollHeight > e.clientHeight),
          'Stress case genuinely requires menu scrolling'
        );
        await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
        await page.mouse.wheel(0, 1000);
        await page.waitForFunction(
          (previous) =>
            (document.querySelector('.site-header-native-slot')?.scrollTop ?? 0) > previous,
          initialScroll
        );
        const after = await close.boundingBox();
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
        assert.ok(await homeMenu(page).evaluate((e) => e === document.activeElement));
        for (const [sourceKind, route] of [
          ['long', 'ui-libraries/base/transition/'],
          ['short', 'start-here/quick-start/'],
        ] as const) {
          await page.goto(`${base}/${locale}/${route}`, { waitUntil: 'networkidle' });
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
          const shell = page.locator('[data-code-shell]:visible').first();
          const toggle = shell.locator('[data-code-toggle]');
          if (await toggle.isVisible()) await toggle.click();
          const source = shell.locator('pre');
          const copy = shell.locator('[data-copy] [data-demo-ref="copy-button"]');
          await copy.waitFor({ state: 'visible' });
          await shell.scrollIntoViewIfNeeded();
          const facts = await source.evaluate((e) => ({
            height: e.clientHeight,
            fullHeight: e.scrollHeight,
            width: e.clientWidth,
            fullWidth: e.scrollWidth,
            lineHeight: parseFloat(getComputedStyle(e).lineHeight),
            raw: e.querySelector('code')?.getAttribute('data-raw-code'),
            documentOverflow: document.documentElement.scrollWidth - innerWidth,
          }));
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
          await save();
          assert.ok(
            facts.documentOverflow <= 1 && facts.height > 0 && facts.height <= 417,
            'Enlarged source fits its independent viewport'
          );
          if (sourceKind === 'short')
            assert.ok(
              facts.height <= facts.lineHeight + 1,
              'Enlarged short source still has natural one-line height'
            );
          await source.focus();
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
        }
        entry.outcome = 'passed';
      } catch (error) {
        entry.outcome = 'failed';
        entry.error = String(error);
        failures.push(`${id}: ${String(error)}`);
        await page.screenshot({ path: path.join(out, `${id}-failure.png`) }).catch(() => {});
      } finally {
        await context.close();
        await save();
      }
    }
} finally {
  await browser.close();
  await stopServer();
  await save();
}
assert.deepEqual(
  failures,
  [],
  'All mobile cases must pass; retain actual failure screenshots and measurements'
);
