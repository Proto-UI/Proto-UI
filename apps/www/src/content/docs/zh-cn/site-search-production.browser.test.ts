// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let browser: Browser;
let baseUrl: string;
let source: { sha: string; dirty: boolean };
const evidenceDirectory = path.join(
  process.env.RUNNER_TEMP ?? os.tmpdir(),
  'homepage-evidence',
  'search-production'
);
const routeFor = (family: 'shadcn' | 'brutalist') =>
  `/zh-cn/ui-libraries/${family}/${family === 'brutalist' ? 'components/' : ''}button/`;

beforeAll(async () => {
  // This standalone suite has no dev fallback and no conditional skip. The
  // managed runner must build real Pagefind assets and own the given preview.
  if (
    process.env.PROTO_UI_SEARCH_PRODUCTION_REQUIRED !== '1' ||
    !process.env.PROTO_UI_SEARCH_PRODUCTION_BASE_URL
  ) {
    throw new Error('Production search evidence requires run-search-production-evidence.mjs');
  }
  const url = new URL(process.env.PROTO_UI_SEARCH_PRODUCTION_BASE_URL);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.pathname !== '/') {
    throw new Error('Production search evidence requires the managed loopback preview origin');
  }
  baseUrl = url.origin;
  source = {
    sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirty: !!execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
      encoding: 'utf8',
    }).trim(),
  };
  if (process.env.CANDIDATE_SHA && source.sha !== process.env.CANDIDATE_SHA) {
    throw new Error('Production search evidence does not match the exact candidate SHA');
  }
  if (!process.env.PROTO_UI_SEARCH_PRODUCTION_CDP) {
    throw new Error('Production search suite requires the runner-owned Chrome CDP endpoint');
  }
  browser = await chromium.connectOverCDP(process.env.PROTO_UI_SEARCH_PRODUCTION_CDP, {
    timeout: 30_000,
  });
}, 60_000);
afterAll(async () => {
  await browser?.close();
}, 30_000);

async function capture(page: Page, family: string, state: string, facts: unknown) {
  await mkdir(evidenceDirectory, { recursive: true });
  const observed = await page.evaluate(() => {
    const search = document.querySelector('site-search');
    const input = search?.querySelector<HTMLInputElement>('.pagefind-ui__search-input');
    return {
      dialogOpen: search?.querySelector('dialog')?.open,
      activeElement: document.activeElement?.outerHTML.slice(0, 2000),
      query: input?.value,
      inputFocused: input === document.activeElement,
      inputConnected: input?.isConnected,
      inputBox: input?.getBoundingClientRect().toJSON(),
      clearType: search?.querySelector<HTMLButtonElement>('.pagefind-ui__search-clear')?.type,
      searchState: search instanceof HTMLElement ? { ...search.dataset } : null,
      results: [
        ...(search?.querySelectorAll<HTMLAnchorElement>('.pagefind-ui__result-link') ?? []),
      ].map((link) => {
        const box = link.getBoundingClientRect();
        const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        const hit = document.elementFromPoint(point.x, point.y);
        const pseudo = getComputedStyle(link, '::after');
        let nearestPositionedAncestor: HTMLElement | null = link;
        while (
          nearestPositionedAncestor &&
          getComputedStyle(nearestPositionedAncestor).position === 'static'
        )
          nearestPositionedAncestor = nearestPositionedAncestor.parentElement;
        return {
          href: link.getAttribute('href'),
          text: link.textContent,
          box: box.toJSON(),
          point,
          hit: hit?.outerHTML.slice(0, 800),
          ownsCenter: hit === link || (hit !== null && link.contains(hit)),
          position: getComputedStyle(link).position,
          pseudo: {
            content: pseudo.content,
            position: pseudo.position,
            inset: pseudo.inset,
            width: pseudo.width,
            height: pseudo.height,
          },
          nearestPositionedAncestor: nearestPositionedAncestor
            ? {
                tag: nearestPositionedAncestor.localName,
                className: nearestPositionedAncestor.className,
                box: nearestPositionedAncestor.getBoundingClientRect().toJSON(),
              }
            : null,
        };
      }),
      timeline: (window as any).__searchProductionTimeline ?? [],
    };
  });
  const screenshot = `${family}-${state}.png`;
  await page.screenshot({ path: path.join(evidenceDirectory, screenshot) });
  await writeFile(
    path.join(evidenceDirectory, `${family}-${state}.json`),
    JSON.stringify(
      {
        schemaVersion: 1,
        source,
        capturedAt: new Date().toISOString(),
        screenshot,
        url: page.url(),
        viewport: page.viewportSize(),
        family,
        state,
        facts,
        observed,
        renderer:
          'Built Astro preview with generated Pagefind assets; only initial HEAD failure and retry HEAD delay injected',
        boundary:
          'Native dialog and Pagefind visuals remain CSS-owned; this verifies the three family Button commands and real search recovery',
      },
      null,
      2
    )
  );
}

describe.sequential('Required production Search recovery with generated Pagefind', () => {
  for (const family of ['shadcn', 'brutalist'] as const) {
    it(`${family} recovers from HEAD503, searches Button and follows a real documentation result`, async () => {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 960 },
        colorScheme: 'light',
      });
      const page = await context.newPage();
      const errors: string[] = [];
      let navigationOutcomes: { click: string; response: string } | undefined;
      const documentResponses: Array<{ url: string; status: number }> = [];
      const pagefindResponses: Array<{ url: string; method: string; status: number }> = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('response', (response) => {
        if (
          response.request().isNavigationRequest() &&
          response.request().frame() === page.mainFrame()
        )
          documentResponses.push({ url: response.url(), status: response.status() });
        if (new URL(response.url()).pathname.startsWith('/pagefind/'))
          pagefindResponses.push({
            url: response.url(),
            method: response.request().method(),
            status: response.status(),
          });
      });
      await page.addInitScript(() => {
        localStorage.setItem('starlight-theme', 'light');
        const timeline: unknown[] = [];
        (window as any).__searchProductionTimeline = timeline;
        const describe = (target: EventTarget | null) =>
          target instanceof Element
            ? {
                tag: target.localName,
                command: (target as HTMLElement).dataset.searchCommand,
                className: target.getAttribute('class'),
              }
            : null;
        const record = (event: Event, phase: string) => {
          const search = document.querySelector('site-search');
          if (!(event.target instanceof Node) || !search?.contains(event.target)) return;
          timeline.push({
            at: performance.now(),
            type: event.type,
            phase,
            target: describe(event.target),
            active: describe(document.activeElement),
            key: event instanceof KeyboardEvent ? event.key : undefined,
            trusted: event.isTrusted,
            defaultPrevented: event.defaultPrevented,
            dialogOpen: search.querySelector('dialog')?.open,
            query: search.querySelector<HTMLInputElement>('.pagefind-ui__search-input')?.value,
          });
          if (timeline.length > 160) timeline.shift();
        };
        for (const type of [
          'keydown',
          'keypress',
          'keyup',
          'click',
          'submit',
          'beforeinput',
          'input',
          'focusin',
          'focusout',
          'close',
          'cancel',
        ]) {
          window.addEventListener(type, (event) => record(event, 'capture'), true);
          window.addEventListener(type, (event) => record(event, 'bubble'));
        }
      });
      let blockIndex = true;
      let failedProbes = 0;
      let successfulProbes = 0;
      let releaseRetry = () => {};
      const retryGate = new Promise<void>((resolve) => {
        releaseRetry = resolve;
      });
      await page.route('**/pagefind/pagefind.js', async (route) => {
        if (route.request().method() !== 'HEAD') {
          await route.continue(); // Real generated runtime, never substituted.
          return;
        }
        if (blockIndex) {
          failedProbes++;
          await route.fulfill({ status: 503, body: '' });
        } else {
          successfulProbes++;
          await retryGate;
          await route.continue(); // Real restored index HEAD.
        }
      });
      let stage = 'navigate';
      try {
        const response = await page.goto(`${baseUrl}${routeFor(family)}`, {
          waitUntil: 'networkidle',
        });
        expect(response?.ok(), 'Production documentation route must exist').toBe(true);
        const trigger = page.locator(
          'site-search [data-projection-generation-state="active"] [data-open-modal]'
        );
        const retry = page.locator(
          'site-search [data-projection-generation-state="active"] .search-failure__retry'
        );
        const close = page.locator(
          'site-search [data-projection-generation-state="active"] [data-close-modal]'
        );
        await expect.poll(() => trigger.getAttribute('aria-disabled')).toBe('false');
        for (const button of [trigger, close, retry]) {
          expect(await button.evaluate((element) => element.localName)).toBe(`wc-${family}-button`);
          expect(await button.getAttribute('role')).toBe('button');
        }
        stage = 'head503';
        await trigger.locator('svg').click();
        await retry.waitFor({ state: 'visible' });
        await expect
          .poll(() => retry.evaluate((element) => element === document.activeElement))
          .toBe(true);
        expect(failedProbes).toBe(1);
        expect(successfulProbes).toBe(0);
        const variantToken = family === 'brutalist' ? 'bg-secondary-background' : 'bg-secondary';
        expect(await retry.getAttribute('data-pui-style')).toContain(variantToken);
        await capture(page, family, 'head503', {
          failedProbes,
          successfulProbes,
          pagefindResponses,
        });

        stage = 'retry';
        blockIndex = false;
        await retry.click();
        await expect.poll(() => retry.getAttribute('aria-disabled')).toBe('true');
        expect(await retry.getAttribute('data-pui-style')).toContain(variantToken);
        expect(await retry.getAttribute('data-pui-style')).toContain(
          family === 'brutalist' ? 'h-9' : 'h-7'
        );
        // Switch the Docs Search view while the real restored HEAD is pending.
        // The service and its request survive; all three views change together.
        await page.evaluate(() =>
          document.dispatchEvent(
            new CustomEvent('proto-adapter:change', { detail: { adapter: 'vue' } })
          )
        );
        await expect
          .poll(() => page.locator('site-search').getAttribute('data-search-runtime'))
          .toBe('vue');
        expect(await retry.getAttribute('aria-disabled')).toBe('true');
        releaseRetry();
        const input = page.locator('site-search .pagefind-ui__search-input');
        await input.waitFor({ state: 'visible' });
        await expect
          .poll(() => input.evaluate((element) => element === document.activeElement))
          .toBe(true);
        expect(await retry.getAttribute('aria-disabled')).not.toBe('true');
        expect(successfulProbes).toBe(1);
        expect(await retry.getAttribute('data-pui-style')).toContain(variantToken);
        expect(
          pagefindResponses.some(
            (entry) =>
              entry.method === 'GET' &&
              entry.url.endsWith('/pagefind/pagefind.js') &&
              entry.status === 200
          )
        ).toBe(true);

        // Actual query/results are required: focusing an empty service shell
        // alone does not establish recovery of the generated search index.
        stage = 'query';
        await input.fill('Button');
        const resultLinks = page.locator('site-search .pagefind-ui__result-link');
        const sourceUrl = page.url();
        const sourcePath = new URL(sourceUrl).pathname.replace(/\/$/, '');
        await expect.poll(() => resultLinks.count(), { timeout: 20_000 }).toBeGreaterThan(0);
        await expect
          .poll(
            async () =>
              (
                await resultLinks.evaluateAll((links) =>
                  links.map((link) => (link as HTMLAnchorElement).href)
                )
              ).some((href) => {
                const targetPath = new URL(href).pathname.replace(/\/$/, '');
                return (
                  targetPath !== sourcePath &&
                  /\/ui-libraries\/(?:shadcn|base|brutalist\/components)\/button$/.test(targetPath)
                );
              }),
            { timeout: 20_000 }
          )
          .toBe(true);
        const links = await resultLinks.evaluateAll((elements) =>
          elements.map((element) => ({
            href: (element as HTMLAnchorElement).href,
            label: element.textContent?.trim() ?? '',
            rawHref: element.getAttribute('href'),
          }))
        );
        for (const link of links) {
          const target = new URL(link.href);
          expect(target.origin).toBe(baseUrl);
          expect(target.pathname).toMatch(/^\/zh-cn\//);
        }
        const destination = links.find((link) => {
          const targetPath = new URL(link.href).pathname.replace(/\/$/, '');
          return (
            targetPath !== sourcePath &&
            /\/ui-libraries\/(?:shadcn|base|brutalist\/components)\/button$/.test(targetPath)
          );
        })!;
        expect(new URL(destination.href).pathname.replace(/\/$/, '')).not.toBe(sourcePath);
        expect(destination.label).toMatch(/Button/i);
        const destinationResponse = await page.request.get(destination.href);
        expect(destinationResponse.ok(), 'Search result destination must return a document').toBe(
          true
        );
        expect(destinationResponse.headers()['content-type']).toContain('text/html');
        await capture(page, family, 'results', {
          query: 'Button',
          links,
          destination,
          destinationStatus: destinationResponse.status(),
          failedProbes,
          successfulProbes,
          pagefindResponses,
        });

        await page.evaluate(() =>
          Object.assign(window, {
            __searchInput: document.querySelector('site-search .pagefind-ui__search-input'),
            __searchDialog: document.querySelector('site-search dialog'),
            __searchResult: document.querySelector('site-search .pagefind-ui__result-link'),
          })
        );
        for (const runtime of ['react', 'vue2', 'wc']) {
          stage = `runtime-${runtime}`;
          await page.evaluate(
            (runtime) =>
              document.dispatchEvent(
                new CustomEvent('proto-adapter:change', { detail: { adapter: runtime } })
              ),
            runtime
          );
          await expect
            .poll(() => page.locator('site-search').getAttribute('data-search-runtime'))
            .toBe(runtime);
          expect(
            await page.evaluate(
              () =>
                document.querySelector('site-search .pagefind-ui__search-input') ===
                (window as any).__searchInput
            )
          ).toBe(true);
          expect(
            await page.evaluate(
              () => document.querySelector('site-search dialog') === (window as any).__searchDialog
            )
          ).toBe(true);
          expect(
            await page.evaluate(
              () =>
                document.querySelector('site-search .pagefind-ui__result-link') ===
                (window as any).__searchResult
            )
          ).toBe(true);
          expect(await input.inputValue()).toBe('Button');
          expect(successfulProbes).toBe(1);
          await capture(page, family, `results-${runtime}`, {
            query: 'Button',
            runtime,
            successfulProbes,
            pagefindResponses,
          });
        }

        // Close and reopen use real Button/public-focus paths after service
        // recovery; the existing query and real result links remain usable.
        stage = 'close-focus';
        await close.click();
        await expect
          .poll(() => trigger.evaluate((element) => element === document.activeElement))
          .toBe(true);
        stage = 'reopen-focus';
        await trigger.press('Enter');
        await expect
          .poll(() => input.evaluate((element) => element === document.activeElement))
          .toBe(true);
        expect(await input.inputValue()).toBe('Button');
        await capture(page, family, 'reopen', { successfulProbes, pagefindResponses });
        stage = 'result-navigation';
        // Follow the exact authored result href rather than reconstructing it.
        const result = page
          .locator(
            `site-search .pagefind-ui__result-link[href=${JSON.stringify(destination.rawHref)}]`
          )
          .first();
        const target = new URL(destination.href);
        await result.scrollIntoViewIfNeeded();
        await capture(page, family, 'before-result-click', { destination, documentResponses });
        const [responseOutcome, clickOutcome] = await Promise.allSettled([
          page.waitForResponse(
            (response) =>
              response.request().isNavigationRequest() &&
              response.request().frame() === page.mainFrame() &&
              new URL(response.url()).pathname.replace(/\/$/, '') ===
                target.pathname.replace(/\/$/, '')
          ),
          result.click(),
        ]);
        navigationOutcomes = {
          click: clickOutcome.status === 'fulfilled' ? 'completed' : String(clickOutcome.reason),
          response:
            responseOutcome.status === 'fulfilled'
              ? `HTTP ${responseOutcome.value.status()} ${responseOutcome.value.url()}`
              : String(responseOutcome.reason),
        };
        // Both promises are observed. A blocked click must not be hidden by
        // the response timer winning Promise.all's rejection race.
        if (clickOutcome.status === 'rejected') throw clickOutcome.reason;
        if (responseOutcome.status === 'rejected') throw responseOutcome.reason;
        const navigationResponse = responseOutcome.value;
        expect(
          navigationResponse?.ok(),
          'Click must produce a successful main-document navigation'
        ).toBe(true);
        expect(navigationResponse?.request().isNavigationRequest()).toBe(true);
        expect(navigationResponse?.request().frame()).toBe(page.mainFrame());
        await page.waitForURL(
          (url) =>
            url.origin === target.origin &&
            url.pathname.replace(/\/$/, '') === target.pathname.replace(/\/$/, '') &&
            url.hash === target.hash
        );
        expect(page.url()).not.toBe(sourceUrl);
        expect(new URL(page.url()).pathname.replace(/\/$/, '')).not.toBe(sourcePath);
        await expect.poll(() => page.locator('h1').first().textContent()).toMatch(/Button/i);
        await capture(page, family, 'destination', {
          query: 'Button',
          sourceUrl,
          destination,
          navigationStatus: navigationResponse?.status(),
          navigationOutcomes,
          documentResponses,
          pagefindResponses,
        });
        expect(errors).toEqual([]);
      } catch (error) {
        await capture(page, family, `failure-${stage}`, {
          error: String(error),
          errors,
          navigationOutcomes,
          documentResponses,
          failedProbes,
          successfulProbes,
          pagefindResponses,
        }).catch((captureError) =>
          console.warn('[Search production] Failure capture unavailable', captureError)
        );
        throw error;
      } finally {
        releaseRetry();
        await context.close();
      }
    }, 90_000);
  }
});
