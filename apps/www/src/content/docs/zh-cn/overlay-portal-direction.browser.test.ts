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
        await page.keyboard.press('Escape');
        await reopened.waitFor({ state: 'hidden' });
        // Retain every paired state and its screenshot even when the mismatch
        // is red. No new host behavior is inferred from source inspection alone.
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
