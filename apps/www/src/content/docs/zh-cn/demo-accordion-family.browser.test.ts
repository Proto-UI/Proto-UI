// @vitest-environment node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { Browser, Locator } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  RUNTIMES,
  applyColorScheme,
  launchBrowser,
  openRoute,
  selectRuntime,
  startServer,
  stopServer,
} from './browser-harness';
const families = ['base', 'shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'];
const route = (family: string, locale = 'en') => `/${locale}/ui-libraries/${family}/accordion/`;
let browser: Browser,
  baseUrl = '';
const ref = (previewer: Locator, id: string) => previewer.locator(`.host [data-demo-ref="${id}"]`);
const expanded = async (button: Locator, value: boolean) => {
  await expect.poll(() => button.getAttribute('aria-expanded')).toBe(String(value));
};
const focused = async (button: Locator) => {
  await expect.poll(() => button.evaluate((el) => document.activeElement === el)).toBe(true);
};
async function capture(
  previewer: Locator,
  name: string,
  subject: { family: string; runtime: string; state: string }
) {
  const base =
    process.env.PROTO_UI_ACCORDION_SCREENSHOT_DIR ??
    (process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR
      ? path.join(process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR, 'accordion')
      : null);
  if (!base) return;
  await mkdir(base, { recursive: true });
  const source = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  await previewer.screenshot({
    path: path.join(base, `${source.slice(0, 12)}-${name}.png`),
    style: 'astro-dev-toolbar { visibility: hidden; }',
  });
  await writeFile(
    path.join(base, `${source.slice(0, 12)}-${name}.json`),
    JSON.stringify(
      {
        sourceSha: source,
        fixture: 'demo-accordion-family.browser.test.ts',
        name,
        ...subject,
        rect: await previewer.boundingBox(),
        aria: await previewer.locator('[aria-expanded]').evaluateAll((elements) =>
          elements.map((el) => ({
            ref: (el as HTMLElement).dataset.demoRef ?? null,
            expanded: el.getAttribute('aria-expanded'),
            disabled: el.getAttribute('aria-disabled'),
            controls: el.getAttribute('aria-controls'),
          }))
        ),
        trustedInputs: await previewer
          .page()
          .evaluate(() => (window as any).__accordionInputEvidence ?? []),
        checkedAt: new Date().toISOString(),
        viewport: previewer.page().viewportSize(),
        environment: await previewer.page().evaluate(() => ({
          theme: document.documentElement.dataset.theme ?? null,
          colorScheme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
          devicePixelRatio,
          rootFontSize: getComputedStyle(document.documentElement).fontSize,
        })),
        comparison:
          'Same source, runtime and viewport across family/state captures; no historical before-image exists.',
      },
      null,
      2
    )
  );
}
beforeAll(async () => {
  baseUrl = await startServer(route('base'));
  browser = await launchBrowser();
}, 150_000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);
describe.sequential('Accordion five families / four native Web consumers', () => {
  for (const family of families)
    for (const runtime of RUNTIMES)
      it(`${family} ${runtime} preserves activation, natural Tab, ownership, relationships and repeatable lifetime`, async () => {
        const { context, page, previewer } = await openRoute(browser, baseUrl, route(family), {
          width: 1280,
          height: 1000,
        });
        try {
          await page.evaluate(() => {
            (window as any).__accordionInputEvidence = [];
            for (const type of ['pointerdown', 'click', 'keydown', 'keyup'])
              document.addEventListener(
                type,
                (event) => {
                  const ref = (event.target as Element | null)
                    ?.closest?.('[data-demo-ref]')
                    ?.getAttribute('data-demo-ref');
                  if (ref)
                    (window as any).__accordionInputEvidence.push({
                      type,
                      trusted: event.isTrusted,
                      ref,
                      key: (event as KeyboardEvent).key ?? null,
                    });
                },
                { capture: true }
              );
          });
          await applyColorScheme(page, 'light');
          await selectRuntime(page, previewer, runtime, '[aria-expanded]', 11);
          const first = ref(previewer, 'single-overview-trigger'),
            second = ref(previewer, 'single-lifetime-trigger'),
            long = ref(previewer, 'single-long-trigger');
          await expanded(first, true);
          await expanded(second, false);
          await capture(ref(previewer, 'single'), `${family}-${runtime}-light-initial-open`, {
            family,
            runtime,
            state: 'initial-open',
          });
          await first.focus();
          await page.keyboard.press('Enter');
          await expanded(first, false);
          await capture(
            ref(previewer, 'single'),
            `${family}-${runtime}-light-closed-keyboard-focus`,
            { family, runtime, state: 'closed-keyboard-focus' }
          );
          await page.keyboard.press('Enter');
          await expanded(first, true);
          await first.focus();
          await page.keyboard.press('ArrowDown');
          await focused(second);
          await expanded(first, true);
          await expanded(second, false);
          await page.keyboard.press('Enter');
          await expanded(first, false);
          await expanded(second, true);
          await focused(second);
          const id = await second.getAttribute('aria-controls');
          expect(id).toBeTruthy();
          expect(await ref(previewer, 'single-lifetime-content').getAttribute('id')).toBe(id);
          expect(
            await ref(previewer, 'single-lifetime-content').getAttribute('aria-labelledby')
          ).toBe(await second.getAttribute('id'));
          const scrollY = await page.evaluate(() => window.scrollY);
          await page.keyboard.press('Space');
          await expanded(second, false);
          expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
          expect(await second.getAttribute('aria-controls')).toBeNull();
          await page.keyboard.press('Enter');
          await expanded(second, true);
          expect(await second.getAttribute('aria-controls')).toBe(id);
          await page.keyboard.press('Tab');
          await focused(long); // disabled header is skipped; no auto focusable Content
          await page.keyboard.press('Home');
          await focused(first);
          await page.keyboard.press('End');
          await focused(long);
          await expanded(second, true);
          await capture(previewer, `${family}-${runtime}-open-focus`, {
            family,
            runtime,
            state: 'open-keyboard-focus',
          });
          const required = ref(previewer, 'multiple-a-trigger');
          expect(await required.getAttribute('aria-disabled')).toBe('true');
          await required.focus();
          await page.keyboard.press('Enter');
          await expanded(required, true);
          const retainedId = await required.getAttribute('aria-controls');
          await ref(previewer, 'multiple-b-trigger').click();
          await required.click();
          await expanded(required, false);
          expect(await required.getAttribute('aria-controls')).toBe(retainedId);
          expect(await ref(previewer, 'multiple-a-content').isVisible()).toBe(false);
          const rtl = ref(previewer, 'rtl-a-trigger');
          await rtl.focus();
          await page.keyboard.press('ArrowLeft');
          await focused(ref(previewer, 'rtl-b-trigger'));
          await expanded(rtl, false);
          const controlled = ref(previewer, 'controlled-a-trigger');
          await controlled.click();
          await expanded(controlled, false);
          await ref(previewer, 'accept').click();
          await expanded(controlled, true);
          await first.click();
          await expanded(first, true);
          await ref(previewer, 'nested-overview-trigger').click();
          await expanded(ref(previewer, 'nested-overview-trigger'), true);
          await expanded(first, true);
          await capture(previewer, `${family}-${runtime}-controlled-nested`, {
            family,
            runtime,
            state: 'controlled-accepted-and-nested-open',
          });
          const old = await first.elementHandle();
          await selectRuntime(
            page,
            previewer,
            RUNTIMES[(RUNTIMES.indexOf(runtime) + 1) % RUNTIMES.length]!,
            '[aria-expanded]',
            11
          );
          expect(await old?.evaluate((el) => el.isConnected)).toBe(false);
        } finally {
          await context.close();
        }
      }, 90_000);
  for (const family of families)
    it(`${family} Chinese 320px / 200% text keeps long labels and overflow inside the page`, async () => {
      const { context, page, previewer } = await openRoute(
        browser,
        baseUrl,
        route(family, 'zh-cn'),
        { width: 320, height: 1100 }
      );
      try {
        await applyColorScheme(page, 'light');
        await selectRuntime(page, previewer, 'react', '[aria-expanded]', 11);
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '200%';
        });
        const button = ref(previewer, 'single-long-trigger');
        await button.click();
        await expanded(button, true);
        expect(await button.evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth
          )
        ).toBeLessThanOrEqual(1);
        await capture(previewer, `${family}-react-zh-320-text200`, {
          family,
          runtime: 'react',
          state: 'long-label-320-text200',
        });
      } finally {
        await context.close();
      }
    }, 90_000);
});
