// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Browser, Locator, Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { launchBrowser, RUNTIMES, startServer, stopServer } from './browser-harness';

// Consumer DOM direction is a test-controlled author input. The public Select,
// its portal, computed direction and all pointer/key effects remain real.
// HC-OVERLAY-PORTAL-0001-A and C-AS-OVERLAY-0001 require preserved logical
// ancestry across a renderer-owned portal; this probes its Web inherited context.
let browser: Browser;
let baseUrl: string;
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const output = process.env.PROTO_UI_PORTAL_DIRECTION_SCREENSHOT_DIR;
const observations: unknown[] = [];
beforeAll(async () => {
  baseUrl = await startServer('/zh-cn/');
  browser = await launchBrowser();
  if (output) await mkdir(output, { recursive: true });
}, 150_000);
afterAll(async () => {
  if (output) {
    await writeFile(
      path.join(output, 'observations.json'),
      JSON.stringify(
        {
          sourceSha,
          sourceDirty:
            execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
              encoding: 'utf8',
            }).trim().length > 0,
          browser: browser?.version(),
          provenance:
            'Author dir changes are injected DOM context; Select activation uses Playwright native pointer/keyboard, never owner-state mutation.',
          observations,
        },
        null,
        2
      )
    );
  }
  await browser?.close();
  await stopServer();
}, 60_000);
async function frames(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
}
async function sample(page: Page, anchor: Locator, popup: Locator, name: string) {
  const anchorHandle = await anchor.elementHandle();
  const popupHandle = await popup.elementHandle();
  if (!anchorHandle || !popupHandle) throw new Error('Real Select owner and portal required');
  await frames(page);
  const facts = await page.evaluate(
    ({ anchor, popup }) => ({
      bodyDirection: getComputedStyle(document.body).direction,
      authorDirection: getComputedStyle(anchor).direction,
      popupDirection: getComputedStyle(popup).direction,
      popupDirAttribute: popup.getAttribute('dir'),
      popupInlineDirection: (popup as HTMLElement).style.direction,
      popupRect: popup.getBoundingClientRect().toJSON(),
      anchorRect: anchor.getBoundingClientRect().toJSON(),
      portalled: !popup.closest('[data-home-settings]'),
      optionDirections: Array.from(popup.querySelectorAll('[role="option"]')).map(
        (option) => getComputedStyle(option).direction
      ),
      expanded: anchor.getAttribute('aria-expanded'),
    }),
    { anchor: anchorHandle, popup: popupHandle }
  );
  if (output) await page.screenshot({ path: path.join(output, `${name}.png`) });
  observations.push({ name, viewport: page.viewportSize(), facts });
  return facts;
}
for (const runtime of RUNTIMES) {
  for (const bodyDirection of ['ltr', 'rtl'] as const) {
    it(`${runtime}/${bodyDirection}: a body portal follows author direction through live changes and reopen`, async () => {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      try {
        await page.addInitScript((runtime) => {
          localStorage.setItem('preferred-prototypes-adapter', runtime);
        }, runtime);
        const response = await page.goto(`${baseUrl}/zh-cn/`);
        expect(response?.status()).toBe(200);
        await page.waitForFunction(
          (runtime) => {
            const root = document.querySelector<HTMLElement>('[data-homepage-runtime]');
            return (
              root?.dataset.runtimeState === 'ready' &&
              root.dataset.runtime === runtime &&
              root.dataset.family === 'shadcn'
            );
          },
          runtime,
          { timeout: 45_000 }
        );
        const author = page.locator('[data-home-settings]');
        const anchor = page.getByRole('combobox', { name: '通知方式', exact: true });
        await page.evaluate((direction) => {
          document.documentElement.dir = direction;
          document.body.dir = direction;
        }, bodyDirection);
        await author.evaluate(
          (element, direction) => element.setAttribute('dir', direction),
          bodyDirection
        );
        await anchor.click();
        const id = await anchor.getAttribute('aria-controls');
        expect(id).toBeTruthy();
        const popup = page.locator(`[id=${JSON.stringify(id)}]`);
        await popup.waitFor({ state: 'visible' });
        const matching = await sample(
          page,
          anchor,
          popup,
          `${runtime}-${bodyDirection}-matching-control`
        );
        const opposite = bodyDirection === 'ltr' ? 'rtl' : 'ltr';
        const responsiveStyle = await page.addStyleTag({
          content: `
            [data-home-settings] { direction: ${bodyDirection}; }
            @media (max-width: 1100px) {
              [data-home-settings] { direction: ${opposite}; }
            }
          `,
        });
        // The test injects only viewport changes between these samples, never
        // class, style or dir mutations on the observed author ancestry.
        await page.setViewportSize({ width: 1000, height: 1000 });
        const responsive = await sample(
          page,
          anchor,
          popup,
          `${runtime}-${bodyDirection}-responsive-narrow`
        );
        expect(responsive.authorDirection).toBe(opposite);
        expect(responsive.popupDirection).toBe(opposite);
        expect(responsive.popupDirAttribute).toBe(opposite);
        await page.setViewportSize({ width: 1440, height: 1000 });
        const responsiveRestored = await sample(
          page,
          anchor,
          popup,
          `${runtime}-${bodyDirection}-responsive-wide`
        );
        expect(responsiveRestored.authorDirection).toBe(bodyDirection);
        expect(responsiveRestored.popupDirection).toBe(bodyDirection);
        expect(responsiveRestored.popupDirAttribute).toBe(bodyDirection);
        await responsiveStyle.evaluate((element) => element.parentNode?.removeChild(element));
        await author.evaluate(
          (element, direction) => element.setAttribute('dir', direction),
          opposite
        );
        const changed = await sample(
          page,
          anchor,
          popup,
          `${runtime}-${bodyDirection}-opposite-live`
        );
        await page.keyboard.press('Escape');
        await popup.waitFor({ state: 'hidden' });
        await anchor.click();
        const reopenedId = await anchor.getAttribute('aria-controls');
        expect(reopenedId).toBeTruthy();
        const reopened = page.locator(`[id=${JSON.stringify(reopenedId)}]`);
        await reopened.waitFor({ state: 'visible' });
        const reacquired = await sample(
          page,
          anchor,
          reopened,
          `${runtime}-${bodyDirection}-opposite-reopened`
        );
        await author.evaluate(
          (element, direction) => element.setAttribute('dir', direction),
          bodyDirection
        );
        const restored = await sample(
          page,
          anchor,
          reopened,
          `${runtime}-${bodyDirection}-matching-restored`
        );
        // A local author override must survive the global bridge. This is real
        // DOM author input, not a patched computed-style result.
        await author.evaluate((element) => element.setAttribute('dir', 'rtl'));
        await reopened.evaluate((element) => element.setAttribute('dir', 'ltr'));
        const explicit = await sample(
          page,
          anchor,
          reopened,
          `${runtime}-${bodyDirection}-explicit-ltr`
        );
        await reopened.evaluate((element) => element.removeAttribute('dir'));
        const inherited = await sample(
          page,
          anchor,
          reopened,
          `${runtime}-${bodyDirection}-override-removed`
        );
        const firstOption = reopened.locator('[role="option"]').first();
        await firstOption.evaluate((element) => element.setAttribute('dir', 'ltr'));
        const nested = await sample(
          page,
          anchor,
          reopened,
          `${runtime}-${bodyDirection}-nested-ltr`
        );
        await firstOption.evaluate((element) => element.removeAttribute('dir'));

        // Move only the consumer's author container within its existing parent.
        // The portal target stays renderer-owned at body throughout migration.
        await author.evaluate((element) => {
          const wrapper = element.ownerDocument.createElement('div');
          wrapper.setAttribute('data-portal-direction-migration', '');
          wrapper.setAttribute('dir', 'ltr');
          element.parentNode!.insertBefore(wrapper, element);
          element.removeAttribute('dir');
          wrapper.appendChild(element);
        });
        const migrated = await sample(
          page,
          anchor,
          reopened,
          `${runtime}-${bodyDirection}-origin-migrated`
        );
        await page
          .locator('[data-portal-direction-migration]')
          .evaluate((element) => element.setAttribute('dir', 'rtl'));
        const migrationChanged = await sample(
          page,
          anchor,
          reopened,
          `${runtime}-${bodyDirection}-migrated-live`
        );
        // CSS authored on the physical popup still outranks the projected dir.
        await reopened.evaluate((element) => {
          (element as HTMLElement).style.direction = 'ltr';
        });
        const localCss = await sample(
          page,
          anchor,
          reopened,
          `${runtime}-${bodyDirection}-local-css`
        );
        await reopened.evaluate((element) => {
          (element as HTMLElement).style.removeProperty('direction');
        });
        const retired = await reopened.elementHandle();
        await page.keyboard.press('Escape');
        await reopened.waitFor({ state: 'hidden' });
        await frames(page);
        const retiredDir = await retired!.getAttribute('dir');
        await page
          .locator('[data-portal-direction-migration]')
          .evaluate((element) => element.setAttribute('dir', 'ltr'));
        await frames(page);
        const retiredAfterSourceChange = await retired!.getAttribute('dir');
        await author.evaluate((element, direction) => {
          const wrapper = element.parentElement!;
          element.setAttribute('dir', direction);
          wrapper.parentNode!.insertBefore(element, wrapper);
          wrapper.remove();
        }, bodyDirection);
        observations.push({
          name: `${runtime}-${bodyDirection}-released`,
          retiredDir,
          retiredAfterSourceChange,
        });
        // Retain every paired state and its screenshot even when the mismatch
        // is red. No new host behavior is inferred from source inspection alone.
        expect(explicit.popupDirection).toBe('ltr');
        expect(explicit.popupDirAttribute).toBe('ltr');
        expect(inherited.popupDirection).toBe('rtl');
        expect(nested.popupDirection).toBe('rtl');
        expect(nested.optionDirections[0]).toBe('ltr');
        expect(migrated.popupDirection).toBe('ltr');
        expect(migrationChanged.popupDirection).toBe('rtl');
        expect(localCss.popupDirection).toBe('ltr');
        expect(localCss.popupInlineDirection).toBe('ltr');
        expect(retiredDir).toBe(null);
        expect(retiredAfterSourceChange).toBe(null);
        expect(matching.authorDirection).toBe(bodyDirection);
        expect(changed.authorDirection).toBe(opposite);
        expect(reacquired.authorDirection).toBe(opposite);
        expect(restored.authorDirection).toBe(bodyDirection);
        for (const facts of [matching, changed, reacquired, restored]) {
          expect(facts.portalled).toBe(true);
          expect(facts.expanded).toBe('true');
          expect(facts.popupDirection).toBe(facts.authorDirection);
          expect(facts.optionDirections.length).toBeGreaterThan(0);
          expect(
            facts.optionDirections.every((direction) => direction === facts.authorDirection)
          ).toBe(true);
        }
      } finally {
        await page.close();
      }
    }, 90_000);
  }
}
