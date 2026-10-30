// @vitest-environment node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { Browser, Page } from 'playwright-core';
import { launchBrowser, startServer, stopServer } from './browser-harness';
let browser: Browser;
let baseUrl: string;
const storageKey = 'proto-ui.sidebar.manual.v1';
const out =
  process.env.PROTO_UI_SIDEBAR_EVIDENCE_DIR ??
  (process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR
    ? path.join(process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR, 'sidebar-disclosure')
    : undefined);
beforeAll(async () => {
  baseUrl = await startServer('/zh-cn/start-here/quick-start/');
  browser = await launchBrowser();
}, 150_000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);
async function facts(page: Page) {
  return page.locator('[data-site-sidebar-policy] .top-level details').evaluateAll((nodes) =>
    nodes.map((node) => {
      const details = node as HTMLDetailsElement;
      return {
        id: details.dataset.siteSidebarGroup ?? '',
        managed:
          [...details.querySelectorAll<HTMLAnchorElement>('a[href]')].length > 0 &&
          [...details.querySelectorAll<HTMLAnchorElement>('a[href]')].every((link) =>
            /\/ui-libraries(?:\/|$)/.test(new URL(link.href).pathname)
          ),
        open: details.open,
        current: !!details.querySelector('a[aria-current="page"]'),
        summary: details.querySelector('summary')?.textContent?.trim(),
      };
    })
  );
}
for (const locale of ['zh-cn', 'en'])
  for (const width of [320, 390, 1440]) {
    const family = width === 320 ? 'brutalist' : 'shadcn';
    const article =
      family === 'brutalist'
        ? 'ui-libraries/brutalist/components/button/'
        : 'start-here/quick-start/';
    it(`preserves native manual disclosure across reload and locale ${locale}/${width}`, async () => {
      const context = await browser.newContext({ viewport: { width, height: 960 } });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const frames: unknown[] = [];
      let failed = false;
      const evidenceErrors: string[] = [];
      const record = async () => {
        if (!out) return;
        await mkdir(out, { recursive: true });
        await writeFile(
          path.join(out, `${locale}-${width}.json`),
          JSON.stringify(
            {
              source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
              tree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim(),
              url: page.url(),
              errors,
              frames,
              evidenceErrors,
              facts: await facts(page).catch(() => null),
            },
            null,
            2
          )
        );
      };
      // Observer only: record native details states on every early frame, without
      // hiding, forcing disclosure, interpreting keys or replacing product code.
      await context.addInitScript(() => {
        const observations: unknown[] = [];
        (window as unknown as { __sidebarFrames: unknown[] }).__sidebarFrames = observations;
        let count = 0;
        const sample = () => {
          const root = document.querySelector('[data-site-sidebar-policy]');
          if (root)
            observations.push({
              t: performance.now(),
              ready: root.getAttribute('data-site-sidebar-policy-epoch'),
              groups: [...root.querySelectorAll('details')].map((d) => ({
                id: d.dataset.siteSidebarGroup ?? '',
                open: d.open,
                current: !!d.querySelector('[aria-current="page"]'),
              })),
            });
          if (++count < 120) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      try {
        await page.goto(`${baseUrl}/${locale}/${article}`);
        await page
          .locator('[data-site-sidebar-policy][data-site-sidebar-policy-epoch]')
          .waitFor({ state: 'attached' });
        const initial = await facts(page);
        expect(initial.length).toBeGreaterThan(5);
        expect(initial.filter((x) => x.managed).length).toBeGreaterThan(0);
        expect(initial.filter((x) => x.managed).every((x) => x.open === x.current)).toBe(true);
        expect(initial.filter((x) => !x.managed).every((x) => x.open)).toBe(true);
        if (width < 1024) {
          const opener = page.locator('[data-site-contents-command]').getByRole('button');
          await opener.click();
        }
        const other = page
          .locator('[data-site-sidebar-policy] details[data-site-sidebar-managed="true"]:visible')
          .filter({ hasNot: page.locator('a[aria-current="page"]') })
          .first();
        // Existing Starlight session writer still owns non-UI historical state.
        const legacy = page
          .locator('[data-site-sidebar-policy] .top-level > li > details')
          .filter({ hasNot: page.locator('a[href*="/ui-libraries/"]') })
          .filter({ hasNot: page.locator('a[aria-current="page"]') })
          .first();
        const legacyId = await legacy.getAttribute('data-site-sidebar-group');
        expect(legacyId).toBeTruthy();
        const legacyDesktop = await page.evaluate(() => matchMedia('(min-width: 50em)').matches);
        const legacyIndex = await legacy
          .locator(':scope > sl-sidebar-restore')
          .getAttribute('data-index');
        expect(legacyIndex).not.toBeNull();
        await legacy.locator(':scope > summary').focus();
        await page.keyboard.press('Enter');
        expect(await legacy.evaluate((node) => (node as HTMLDetailsElement).open)).toBe(false);
        await expect
          .poll(() =>
            page.evaluate((index) => {
              const state = JSON.parse(sessionStorage.getItem('sl-sidebar-state') || 'null');
              return state?.open?.[Number(index)];
            }, legacyIndex)
          )
          .toBe(false);
        const id = await other.getAttribute('data-site-sidebar-group');
        expect(id).toBeTruthy();
        const summary = other.locator(':scope > summary');
        // Cancel after the policy's bubbling listener: defaultPrevented must
        // invalidate its pending intent, not leave false manual arbitration.
        await page.evaluate(() =>
          document.addEventListener('click', (event) => event.preventDefault(), { once: true })
        );
        await summary.focus();
        await page.keyboard.press('Enter');
        expect(await other.evaluate((node) => (node as HTMLDetailsElement).open)).toBe(false);
        expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBeNull();
        expect(
          await page.locator('[data-site-sidebar-policy]').evaluate((node) => {
            const lease = (node as HTMLElement & { [key: symbol]: { readIntent(): string } })[
              Symbol.for('proto-ui.site-sidebar-disclosure.v1')
            ];
            return lease!.readIntent();
          })
        ).toBe('none');
        await summary.focus();
        await page.keyboard.press('Enter');
        await expect
          .poll(() => other.evaluate((node) => (node as HTMLDetailsElement).open))
          .toBe(true);
        await expect
          .poll(() => page.evaluate((key) => localStorage.getItem(key), storageKey))
          .toContain(JSON.stringify(id!));
        const stored = await page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key)!).open,
          storageKey
        );
        expect(stored[id!]).toBe(true);
        // Synthetic click cannot change the manual history record.
        await summary.evaluate((node) => (node as HTMLElement).click());
        expect(
          await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).open, storageKey)
        ).toEqual(stored);
        await page.reload();
        await page
          .locator('[data-site-sidebar-policy][data-site-sidebar-policy-epoch]')
          .waitFor({ state: 'attached' });
        expect((await facts(page)).find((x) => x.id === id)?.open).toBe(true);
        expect(
          await page
            .locator('[data-site-sidebar-policy] .top-level > li > details')
            .filter({ hasNot: page.locator('a[href*="/ui-libraries/"]') })
            .filter({ hasNot: page.locator('a[aria-current="page"]') })
            .first()
            .evaluate((node) => (node as HTMLDetailsElement).open)
        ).toBe(!legacyDesktop);
        const cold = await page.evaluate(
          () =>
            (
              window as unknown as {
                __sidebarFrames: Array<{ groups: Array<{ id: string; open: boolean }> }>;
              }
            ).__sidebarFrames
        );
        frames.push(cold);
        expect(cold.length, 'saved-history cold frames must actually be observed').toBeGreaterThan(
          0
        );
        for (const frame of cold) {
          expect(
            frame.groups.find((group) => group.id === id)?.open,
            'saved manual expansion is present from every observed frame'
          ).toBe(true);
          expect(
            frame.groups.find((group) => group.id === legacyId)?.open,
            'non-UI legacy history is restored from every observed frame (desktop only)'
          ).toBe(!legacyDesktop);
        }
        const alternate = locale === 'en' ? 'zh-cn' : 'en';
        await page.goto(`${baseUrl}/${alternate}/${article}`);
        await page
          .locator('[data-site-sidebar-policy][data-site-sidebar-policy-epoch]')
          .waitFor({ state: 'attached' });
        const translated = await facts(page);
        expect(translated.map((x) => x.id)).toEqual(initial.map((x) => x.id));
        expect(translated.find((x) => x.id === id)?.open).toBe(true);
        expect(translated.filter((x) => x.current).every((x) => x.open)).toBe(true);
        // Locale changes the upstream label/href hash: old indexed state must not leak.
        expect(translated.filter((x) => !x.managed).every((x) => x.open)).toBe(true);
        expect(errors).toEqual([]);
        if (out) {
          await mkdir(out, { recursive: true });
          await page.screenshot({
            path: path.join(out, `${locale}-${width}-restored.png`),
            fullPage: true,
          });
        }
      } catch (error) {
        failed = true;
        // Preserve measurements before attempting screenshots; diagnostics must
        // never replace the original assertion/navigation failure.
        try {
          await record();
        } catch (secondary) {
          evidenceErrors.push(String(secondary));
        }
        if (out) {
          try {
            await mkdir(out, { recursive: true });
            await page.screenshot({
              path: path.join(out, `${locale}-${width}-failure.png`),
              fullPage: true,
            });
          } catch (secondary) {
            evidenceErrors.push(String(secondary));
          }
        }
        throw error;
      } finally {
        const cleanupErrors: unknown[] = [];
        try {
          await record();
        } catch (error) {
          cleanupErrors.push(error);
        }
        try {
          await context.close();
        } catch (error) {
          cleanupErrors.push(error);
        }
        if (cleanupErrors.length) {
          if (!failed) throw new AggregateError(cleanupErrors, 'Sidebar evidence/cleanup failed');
          console.error('Sidebar secondary evidence/cleanup failures', cleanupErrors);
        }
      }
    }, 90_000);
  }
it('no-JS SSR scopes current-only defaults to UI Libraries and preserves other native groups', async () => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 1440, height: 960 },
  });
  try {
    const page = await context.newPage();
    await page.goto(`${baseUrl}/zh-cn/start-here/quick-start/`);
    const initial = await facts(page);
    expect(initial.length).toBeGreaterThan(5);
    expect(initial.filter((x) => x.managed).length).toBeGreaterThan(0);
    expect(initial.filter((x) => x.managed).every((x) => x.open === x.current)).toBe(true);
    expect(initial.filter((x) => !x.managed).every((x) => x.open)).toBe(true);
    const group = page
      .locator('[data-site-sidebar-policy] .top-level > li > details')
      .filter({ has: page.locator('a[href*="/ui-libraries/"]') })
      .first();
    await group.locator(':scope > summary').click();
    expect(await group.evaluate((node) => (node as HTMLDetailsElement).open)).toBe(true);
    const link = group.locator('a[href]').first();
    expect(await link.isVisible()).toBe(true);
  } finally {
    await context.close();
  }
}, 30_000);
