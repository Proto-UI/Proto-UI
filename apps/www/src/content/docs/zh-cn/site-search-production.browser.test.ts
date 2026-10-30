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

/** Scope includes portals outside site-search; read coordinates after every generation commit. */
async function parts(page: Page) {
  const coordinates = await page.locator('site-search').evaluate((root) => ({
    owner: root.querySelector<HTMLElement>('[data-search-dialog-mount]')?.dataset.projectionOwner,
    generation: (root as HTMLElement).dataset.searchGeneration,
  }));
  if (!coordinates.owner || !coordinates.generation)
    throw new Error('Missing committed Search coordinates');
  const scope = `[data-projection-owner=${JSON.stringify(coordinates.owner)}][data-projection-generation=${JSON.stringify(coordinates.generation)}]`;
  const ref = (name: string) => page.locator(`${scope}[data-demo-ref=${JSON.stringify(name)}]`);
  return {
    ...coordinates,
    panel: ref('panel'),
    close: ref('close'),
    retry: ref('search-page-action'),
    status: ref('status'),
    input: page.locator(
      `${scope}[data-demo-ref="query"]:is(input), ${scope}[data-demo-ref="query"] input`
    ),
    items: page.locator(`${scope}[data-demo-ref="results"] [role="option"]`),
  };
}
async function resultRows(page: Page) {
  const current = await parts(page);
  return current.items.evaluateAll((items) =>
    items.map((item, index) => {
      const metadata = item.querySelector<HTMLElement>('[data-search-result-url]');
      return {
        index,
        rawHref: metadata?.textContent?.trim() ?? null,
        label: item.textContent?.trim() ?? '',
        visibleURL: metadata?.textContent ?? '',
      };
    })
  );
}
async function capture(page: Page, family: string, state: string, facts: unknown) {
  await mkdir(evidenceDirectory, { recursive: true });
  const observed = await page.evaluate(() => {
    const search = document.querySelector<HTMLElement>('site-search');
    const owner = search?.querySelector<HTMLElement>('[data-search-dialog-mount]')?.dataset
      .projectionOwner;
    const generation = search?.dataset.searchGeneration;
    const scoped = [
      ...document.querySelectorAll<HTMLElement>(
        '[data-projection-owner][data-projection-generation]'
      ),
    ].filter(
      (node) =>
        node.dataset.projectionOwner === owner && node.dataset.projectionGeneration === generation
    );
    const ref = (name: string) => scoped.find((node) => node.dataset.demoRef === name);
    const query = ref('query');
    const input = (query?.matches('input') ? query : query?.querySelector('input')) as
      | HTMLInputElement
      | undefined;
    const panel = ref('panel');
    const panelRect = panel?.getBoundingClientRect();
    const panelStyle = panel ? getComputedStyle(panel) : undefined;
    const panelVisible =
      !!panel?.isConnected &&
      !!panelRect?.width &&
      !!panelRect?.height &&
      panelStyle?.display !== 'none' &&
      panelStyle?.visibility !== 'hidden' &&
      !panel.closest('[inert], [hidden], [data-pui-view-detached]');
    return {
      owner,
      generation,
      searchState: search ? { ...search.dataset } : null,
      panelVisible,
      panelBox: panel?.getBoundingClientRect().toJSON(),
      panelRole: panel?.getAttribute('role'),
      readyState: document.readyState,
      headings: [...document.querySelectorAll('h1')].map((heading) => ({
        text: heading.textContent,
        html: heading.outerHTML.slice(0, 2000),
        visible: heading.getBoundingClientRect().height > 0,
      })),
      activeElement: document.activeElement?.outerHTML.slice(0, 2000),
      query: input?.value,
      inputFocused: input === document.activeElement,
      inputConnected: input?.isConnected,
      inputBox: input?.getBoundingClientRect().toJSON(),
      results: [...(ref('results')?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])].map(
        (item) => {
          const box = item.getBoundingClientRect();
          const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
          const hit = document.elementFromPoint(point.x, point.y);
          return {
            href: item.querySelector<HTMLElement>('[data-search-result-url]')?.textContent?.trim(),
            text: item.textContent,
            box: box.toJSON(),
            point,
            hit: hit?.outerHTML.slice(0, 800),
            ownsCenter: hit === item || (hit !== null && item.contains(hit)),
            role: item.getAttribute('role'),
          };
        }
      ),
      timeline: (window as any).__searchProductionTimeline ?? [],
    };
  });
  const screenshot = `${family}-${state}.png`;
  // Persist facts before screenshot I/O; failure capture must not erase the original assertion.
  await writeFile(
    path.join(evidenceDirectory, `${family}-${state}.json`),
    JSON.stringify(
      {
        schemaVersion: 2,
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
          'Actual public Dialog/Command composition, portal ownership, real Pagefind data and native navigation',
      },
      null,
      2
    )
  );
  await page.screenshot({ path: path.join(evidenceDirectory, screenshot) });
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
        const record = (event: Event, phase: string) => {
          const search = document.querySelector<HTMLElement>('site-search');
          const owner = search?.querySelector<HTMLElement>('[data-search-dialog-mount]')?.dataset
            .projectionOwner;
          const generation = search?.dataset.searchGeneration;
          if (!(event.target instanceof Element)) return;
          const target = event.target;
          const projection = target.closest<HTMLElement>('[data-projection-owner]');
          if (!search?.contains(target) && projection?.dataset.projectionOwner !== owner) return;
          timeline.push({
            at: performance.now(),
            type: event.type,
            phase,
            owner,
            generation,
            target: {
              tag: target.localName,
              ref: (target as HTMLElement).dataset.demoRef,
              role: target.getAttribute('role'),
              generation: projection?.dataset.projectionGeneration,
            },
            active: document.activeElement?.outerHTML.slice(0, 600),
            key: event instanceof KeyboardEvent ? event.key : undefined,
            trusted: event.isTrusted,
            defaultPrevented: event.defaultPrevented,
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
          await route.continue();
          return;
        }
        if (blockIndex) {
          failedProbes++;
          await route.fulfill({ status: 503, body: '' });
        } else {
          successfulProbes++;
          await retryGate;
          await route.continue();
        }
      });
      // No non-test HTTP origin is reachable through this test browser context.
      await context.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (/^https?:$/.test(url.protocol) && url.origin !== baseUrl) {
          await route.abort('blockedbyclient');
          return;
        }
        await route.continue();
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
        await expect.poll(() => trigger.getAttribute('aria-disabled')).toBe('false');
        expect(await trigger.evaluate((element) => element.localName)).toBe(`wc-${family}-button`);
        expect(await trigger.getAttribute('role')).toBe('button');
        stage = 'head503';
        await trigger.locator('svg').click();
        let current = await parts(page);
        await current.retry.waitFor({ state: 'visible' });
        expect(await current.panel.getAttribute('role')).toBe('dialog');
        expect(await current.close.evaluate((element) => element.localName)).toBe(
          `wc-${family}-dialog-close`
        );
        expect(await current.close.getAttribute('role')).toBe('button');
        expect(await current.close.locator('button,[role="button"]').count()).toBe(0);
        expect(await current.retry.getAttribute('role')).toBe('button');
        // Empty-open preparation failure focuses the real Retry, not a dead service shell.
        await expect
          .poll(() => current.retry.evaluate((element) => element === document.activeElement))
          .toBe(true);
        expect(failedProbes).toBe(1);
        expect(successfulProbes).toBe(0);
        const variantToken = family === 'brutalist' ? 'bg-secondary-background' : 'bg-secondary';
        expect(await current.retry.getAttribute('data-pui-style')).toContain(variantToken);
        await capture(page, family, 'head503', {
          failedProbes,
          successfulProbes,
          pagefindResponses,
        });

        stage = 'retry';
        blockIndex = false;
        await current.retry.click();
        await expect.poll(() => successfulProbes).toBe(1);
        await expect.poll(() => current.retry.getAttribute('aria-disabled')).toBe('true');
        expect(await current.retry.getAttribute('data-pui-style')).toContain(variantToken);
        const pendingOldInput = await current.input.elementHandle();
        if (!pendingOldInput) throw new Error('Expected committed Search element: pendingOldInput');
        await page.evaluate(() =>
          document.dispatchEvent(
            new CustomEvent('proto-adapter:change', { detail: { adapter: 'vue' } })
          )
        );
        await expect
          .poll(() => page.locator('site-search').getAttribute('data-search-runtime'))
          .toBe('vue');
        current = await parts(page);
        await expect.poll(() => current.retry.getAttribute('aria-disabled')).toBe('true');
        expect(await current.retry.getAttribute('data-pui-style')).toContain(variantToken);
        releaseRetry();
        await current.input.waitFor({ state: 'visible' });
        await expect
          .poll(() => current.input.evaluate((element) => element === document.activeElement))
          .toBe(true);
        await expect.poll(() => current.retry.count()).toBe(0);
        expect(successfulProbes).toBe(1);
        await expect
          .poll(() => pendingOldInput.evaluate((element) => element.isConnected))
          .toBe(false);
        await pendingOldInput.dispose();
        expect(
          pagefindResponses.some(
            (entry) =>
              entry.method === 'GET' &&
              entry.url.endsWith('/pagefind/pagefind.js') &&
              entry.status === 200
          )
        ).toBe(true);

        stage = 'query';
        const stableInput = await current.input.elementHandle();
        if (!stableInput) throw new Error('Expected committed Search element: stableInput');
        await current.input.fill('Button');
        const sourceUrl = page.url();
        const sourcePath = new URL(sourceUrl).pathname.replace(/\/$/, '');
        await expect
          .poll(async () => (await parts(page)).items.count(), { timeout: 20_000 })
          .toBeGreaterThan(0);
        const eligible = (row: Awaited<ReturnType<typeof resultRows>>[number]) => {
          if (!row.rawHref) return false;
          const targetPath = new URL(row.rawHref, baseUrl).pathname.replace(/\/$/, '');
          return (
            targetPath !== sourcePath &&
            /\/ui-libraries\/(?:shadcn|base|brutalist\/components)\/button$/.test(targetPath)
          );
        };
        await expect
          .poll(async () => (await resultRows(page)).some(eligible), { timeout: 20_000 })
          .toBe(true);
        const rows = await resultRows(page);
        for (const row of rows) {
          expect(row.rawHref).toBeTruthy();
          const target = new URL(row.rawHref!, baseUrl);
          expect(target.origin).toBe(baseUrl);
          expect(target.pathname).toMatch(/^\/zh-cn\//);
          expect(row.visibleURL).toContain(row.rawHref);
        }
        const destination = rows.find(eligible)!;
        const target = new URL(destination.rawHref!, baseUrl);
        expect(destination.label).toMatch(/Button/i);
        const destinationResponse = await page.request.get(target.href);
        expect(destinationResponse.ok(), 'Search result destination must return a document').toBe(
          true
        );
        expect(destinationResponse.headers()['content-type']).toContain('text/html');
        expect(
          await current.input.evaluate((element, previous) => element === previous, stableInput)
        ).toBe(true);
        await stableInput.dispose();
        await capture(page, family, 'results', {
          query: 'Button',
          rows,
          destination,
          destinationStatus: destinationResponse.status(),
          failedProbes,
          successfulProbes,
          pagefindResponses,
        });
        for (const runtime of ['react', 'vue2', 'wc']) {
          stage = `runtime-${runtime}`;
          const oldInput = await current.input.elementHandle();
          if (!oldInput) throw new Error('Expected committed Search element: oldInput');
          const oldPanel = await current.panel.elementHandle();
          if (!oldPanel) throw new Error('Expected committed Search element: oldPanel');
          const oldClose = await current.close.elementHandle();
          if (!oldClose) throw new Error('Expected committed Search element: oldClose');
          const oldGeneration = current.generation;
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
          current = await parts(page);
          expect(current.generation).not.toBe(oldGeneration);
          await current.input.waitFor({ state: 'visible' });
          expect(
            await current.input.evaluate((element, previous) => element === previous, oldInput)
          ).toBe(false);
          expect(
            await current.panel.evaluate((element, previous) => element === previous, oldPanel)
          ).toBe(false);
          await expect.poll(() => oldInput.evaluate((element) => element.isConnected)).toBe(false);
          await expect.poll(() => oldPanel.evaluate((element) => element.isConnected)).toBe(false);
          expect(await current.input.inputValue()).toBe('Button');
          await expect.poll(() => current.items.count()).toBeGreaterThan(0);
          expect((await resultRows(page)).some((row) => row.rawHref === destination.rawHref)).toBe(
            true
          );
          expect(successfulProbes).toBe(1);
          // Detached old handles are deliberately exercised; they cannot mutate the new session.
          await oldInput.evaluate((element) => {
            const input = element as HTMLInputElement;
            input.value = 'retired-query-must-not-write';
            input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
          });
          await oldClose.evaluate((element) => (element as HTMLElement).click());
          await page.evaluate(
            () =>
              new Promise<void>((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
              )
          );
          expect(await current.input.inputValue()).toBe('Button');
          expect(await current.panel.isVisible()).toBe(true);
          expect(await current.panel.getAttribute('data-pui-view-detached')).toBeNull();
          await oldInput.dispose();
          await oldPanel.dispose();
          await oldClose.dispose();
          await capture(page, family, `results-${runtime}`, {
            query: 'Button',
            runtime,
            oldGeneration,
            generation: current.generation,
            successfulProbes,
            pagefindResponses,
          });
        }

        stage = 'close-focus';
        await current.close.click();
        await expect
          .poll(() => trigger.evaluate((element) => element === document.activeElement))
          .toBe(true);
        stage = 'reopen-focus';
        await trigger.press('Enter');
        current = await parts(page);
        await current.input.waitFor({ state: 'visible' });
        await expect
          .poll(() => current.input.evaluate((element) => element === document.activeElement))
          .toBe(true);
        expect(await current.input.inputValue()).toBe('Button');
        await expect
          .poll(async () =>
            (await resultRows(page)).some((row) => row.rawHref === destination.rawHref)
          )
          .toBe(true);
        await capture(page, family, 'reopen', { successfulProbes, pagefindResponses });
        stage = 'result-navigation';
        const refreshedRows = await resultRows(page);
        const destinationIndex = refreshedRows.findIndex(
          (row) => row.rawHref === destination.rawHref
        );
        expect(destinationIndex).toBeGreaterThanOrEqual(0);
        const result = current.items.nth(destinationIndex);
        expect((await result.locator('[data-search-result-url]').textContent())?.trim()).toBe(
          destination.rawHref
        );
        await result.scrollIntoViewIfNeeded();
        expect(
          await result.evaluate((element) => {
            const box = element.getBoundingClientRect();
            const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
            return hit === element || !!(hit && element.contains(hit));
          }),
          'The actual CommandItem must own its pointer hit target'
        ).toBe(true);
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
        if (clickOutcome.status === 'rejected') throw clickOutcome.reason;
        if (responseOutcome.status === 'rejected') throw responseOutcome.reason;
        const navigationResponse = responseOutcome.value;
        expect(
          navigationResponse.ok(),
          'Click must produce a successful main-document navigation'
        ).toBe(true);
        expect(navigationResponse.request().isNavigationRequest()).toBe(true);
        expect(navigationResponse.request().frame()).toBe(page.mainFrame());
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
          navigationStatus: navigationResponse.status(),
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

// CDP definitions: ChromeDevTools/devtools-protocol browser_protocol.json Input domain.
// Input.imeSetComposition supplies candidate text; Input.insertText uses Chromium's native
// non-key text insertion. Actual trusted compositionend is required below, not assumed.
describe.sequential('Required native Search IME and keyboard execution', () => {
  for (const family of ['shadcn', 'brutalist'] as const) {
    it(`${family} retains the editor through native composition and executes current results by keyboard`, async () => {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        colorScheme: 'light',
      });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      const errors: string[] = [];
      const navigations: Array<{ url: string; status: number }> = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('response', (response) => {
        if (
          response.request().isNavigationRequest() &&
          response.request().frame() === page.mainFrame()
        )
          navigations.push({ url: response.url(), status: response.status() });
      });
      await context.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (/^https?:$/.test(url.protocol) && url.origin !== baseUrl) {
          await route.abort('blockedbyclient');
          return;
        }
        await route.continue();
      });
      let holdFragments = true;
      let fragmentRequests = 0;
      let releaseFragments = () => {};
      const fragmentGate = new Promise<void>((resolve) => {
        releaseFragments = resolve;
      });
      // Delay, never substitute, genuine generated document fragments. This makes the
      // selection-vs-async-results boundary observable without changing backend data.
      await page.route('**/pagefind/fragment/**', async (route) => {
        fragmentRequests++;
        if (holdFragments) await fragmentGate;
        await route.continue();
      });
      await page.addInitScript(() => {
        localStorage.setItem('starlight-theme', 'light');
        const events: unknown[] = [];
        (window as any).__searchImeEvents = events;
        for (const name of [
          'compositionstart',
          'compositionupdate',
          'compositionend',
          'beforeinput',
          'input',
          'keydown',
          'keyup',
        ]) {
          document.addEventListener(
            name,
            (event) => {
              const target = event.target;
              if (!(target instanceof Element) || !target.closest('[data-demo-ref="query"]'))
                return;
              const input =
                target instanceof HTMLInputElement ? target : target.querySelector('input');
              events.push({
                type: event.type,
                trusted: event.isTrusted,
                composing: 'isComposing' in event ? (event as InputEvent).isComposing : undefined,
                data: 'data' in event ? (event as InputEvent).data : undefined,
                key: event instanceof KeyboardEvent ? event.key : undefined,
                inputType: event instanceof InputEvent ? event.inputType : undefined,
                value: input?.value,
                start: input?.selectionStart,
                end: input?.selectionEnd,
              });
              if (events.length > 160) events.shift();
            },
            true
          );
        }
      });
      let stage = 'navigate';
      let originalFailure = false;
      let inputHandle: Awaited<ReturnType<Page['$']>> = null;
      let staleResult: Awaited<ReturnType<Page['$']>> = null;
      try {
        const response = await page.goto(`${baseUrl}${routeFor(family)}`, {
          waitUntil: 'networkidle',
        });
        expect(response?.ok()).toBe(true);
        const sourceUrl = page.url();
        const sourcePath = new URL(sourceUrl).pathname.replace(/\/$/, '');
        const trigger = page.locator(
          'site-search [data-projection-generation-state="active"] [data-open-modal]'
        );
        await expect.poll(() => trigger.getAttribute('aria-disabled')).toBe('false');
        await trigger.click();
        let current = await parts(page);
        await current.input.waitFor({ state: 'visible' });
        await current.input.focus();
        inputHandle = await current.input.elementHandle();
        if (!inputHandle) throw new Error('Missing actual IME editor');
        stage = 'async-selection';
        await cdp.send('Input.insertText', { text: 'Button' });
        await expect.poll(() => fragmentRequests).toBeGreaterThan(0);
        await page.keyboard.press('Shift+ArrowLeft');
        await page.keyboard.press('Shift+ArrowLeft');
        const selection = await current.input.evaluate((element) => ({
          start: (element as HTMLInputElement).selectionStart,
          end: (element as HTMLInputElement).selectionEnd,
        }));
        expect(selection).toEqual({ start: 4, end: 6 });
        holdFragments = false;
        releaseFragments();
        await expect.poll(() => current.items.count(), { timeout: 20_000 }).toBeGreaterThan(0);
        expect(
          await current.input.evaluate((element, original) => element === original, inputHandle)
        ).toBe(true);
        expect(
          await current.input.evaluate((element) => ({
            start: (element as HTMLInputElement).selectionStart,
            end: (element as HTMLInputElement).selectionEnd,
          }))
        ).toEqual(selection);
        staleResult = await current.items.first().elementHandle();
        if (!staleResult) throw new Error('Missing pre-composition result');
        const beforeCompositionNavigation = navigations.length;
        stage = 'native-composition-partial';
        await cdp.send('Input.imeSetComposition', {
          text: '中',
          selectionStart: 1,
          selectionEnd: 1,
          replacementStart: 0,
          replacementEnd: 6,
        });
        await expect.poll(() => current.input.inputValue()).toBe('中');
        await expect.poll(() => current.items.count()).toBe(0);
        expect(await staleResult.evaluate((element) => element.isConnected)).toBe(false);
        await page.keyboard.press('ArrowDown');
        expect(page.url()).toBe(sourceUrl);
        expect(navigations).toHaveLength(beforeCompositionNavigation);
        const partial = await page.evaluate(
          () =>
            (window as any).__searchImeEvents as Array<{
              type: string;
              trusted: boolean;
              composing?: boolean;
            }>
        );
        expect(partial.some((event) => event.type === 'compositionstart' && event.trusted)).toBe(
          true
        );
        expect(
          partial.some(
            (event) => event.type === 'input' && event.trusted && event.composing === true
          )
        ).toBe(true);
        expect(partial.some((event) => event.type === 'compositionend')).toBe(false);
        expect(
          await current.input.evaluate((element, original) => element === original, inputHandle)
        ).toBe(true);
        await capture(page, `${family}-ime`, 'partial', {
          fragmentRequests,
          selection,
          partial,
          navigations,
        });
        stage = 'native-composition-commit';
        await cdp.send('Input.insertText', { text: 'Button' });
        await expect.poll(() => current.input.inputValue()).toBe('Button');
        await expect
          .poll(async () =>
            page.evaluate(() =>
              ((window as any).__searchImeEvents as Array<{ type: string; trusted: boolean }>).some(
                (event) => event.type === 'compositionend' && event.trusted
              )
            )
          )
          .toBe(true);
        await expect.poll(() => current.items.count(), { timeout: 20_000 }).toBeGreaterThan(0);
        expect(
          await current.input.evaluate((element, original) => element === original, inputHandle)
        ).toBe(true);
        expect(
          await current.input.evaluate((element) => ({
            start: (element as HTMLInputElement).selectionStart,
            end: (element as HTMLInputElement).selectionEnd,
          }))
        ).toEqual({ start: 6, end: 6 });
        expect(page.url()).toBe(sourceUrl);
        const committed = await page.evaluate(() => (window as any).__searchImeEvents);
        await capture(page, `${family}-ime`, 'committed', { committed, navigations });
        stage = 'real-empty-result';
        await current.input.fill('zxqv948271605emptycontract');
        const empty = page.locator(
          `[data-projection-owner=${JSON.stringify(current.owner)}][data-projection-generation=${JSON.stringify(current.generation)}][data-demo-ref="results"]`
        );
        await expect.poll(() => empty.textContent(), { timeout: 20_000 }).toBe('未找到结果');
        expect(await current.items.count()).toBe(0);
        expect(
          await current.input.evaluate((element, original) => element === original, inputHandle)
        ).toBe(true);
        expect(page.url()).toBe(sourceUrl);
        await capture(page, `${family}-ime`, 'empty', {
          query: 'zxqv948271605emptycontract',
          navigations,
        });
        await current.input.fill('Button');
        await expect.poll(() => current.items.count(), { timeout: 20_000 }).toBeGreaterThan(0);
        stage = 'escape-reopen';
        await page.keyboard.press('Escape');
        await expect
          .poll(() => trigger.evaluate((element) => element === document.activeElement))
          .toBe(true);
        await trigger.press('Enter');
        current = await parts(page);
        await current.input.waitFor({ state: 'visible' });
        await expect
          .poll(() => current.input.evaluate((element) => element === document.activeElement))
          .toBe(true);
        expect(await current.input.inputValue()).toBe('Button');
        await expect.poll(() => current.items.count()).toBeGreaterThan(0);
        const inputBox = await current.input.boundingBox();
        if (!inputBox) throw new Error('Input has no visible bounds');
        expect(inputBox.y).toBeGreaterThanOrEqual(0);
        expect(inputBox.y + inputBox.height).toBeLessThanOrEqual(721);
        stage = 'keyboard-current-result';
        let href: string | null = null;
        const count = await current.items.count();
        for (let index = 0; index <= count; index++) {
          await page.keyboard.press('ArrowDown');
          const active = await current.input.evaluate((element) => {
            let control: Element | null = element;
            while (control && !control.hasAttribute('aria-activedescendant'))
              control = control.parentElement;
            const id = control?.getAttribute('aria-activedescendant');
            const item = id ? document.getElementById(id) : null;
            return {
              id,
              href: item?.querySelector('[data-search-result-url]')?.textContent?.trim() ?? null,
              owner: (item as HTMLElement | null)?.dataset.projectionOwner,
              generation: (item as HTMLElement | null)?.dataset.projectionGeneration,
            };
          });
          if (!active.href) continue;
          expect(active.owner).toBe(current.owner);
          expect(active.generation).toBe(current.generation);
          const target = new URL(active.href, baseUrl);
          expect(target.origin).toBe(baseUrl);
          expect(target.pathname).toMatch(/^\/zh-cn\//);
          if (
            target.pathname.replace(/\/$/, '') !== sourcePath &&
            /\/ui-libraries\/(?:shadcn|base|brutalist\/components)\/button$/.test(
              target.pathname.replace(/\/$/, '')
            )
          ) {
            href = target.href;
            break;
          }
        }
        expect(href, 'ArrowDown must reach a different actual documentation result').not.toBeNull();
        const target = new URL(href!);
        const [navigation, activation] = await Promise.allSettled([
          page.waitForResponse(
            (response) =>
              response.request().isNavigationRequest() &&
              response.request().frame() === page.mainFrame() &&
              new URL(response.url()).pathname.replace(/\/$/, '') ===
                target.pathname.replace(/\/$/, '')
          ),
          page.keyboard.press('Enter'),
        ]);
        if (activation.status === 'rejected') throw activation.reason;
        if (navigation.status === 'rejected') throw navigation.reason;
        expect(navigation.value.ok()).toBe(true);
        await page.waitForURL(
          (url) =>
            url.origin === target.origin &&
            url.pathname.replace(/\/$/, '') === target.pathname.replace(/\/$/, '') &&
            url.hash === target.hash
        );
        expect(page.url()).not.toBe(sourceUrl);
        await expect.poll(() => page.locator('h1').first().textContent()).toMatch(/Button/i);
        await capture(page, `${family}-ime`, 'keyboard-destination', {
          href,
          committed,
          navigations,
        });
        expect(errors).toEqual([]);
      } catch (error) {
        originalFailure = true;
        const events = await page
          .evaluate(() => (window as any).__searchImeEvents ?? [])
          .catch(() => []);
        await capture(page, `${family}-ime`, `failure-${stage}`, {
          error: String(error),
          errors,
          events,
          fragmentRequests,
          navigations,
        }).catch((captureError) =>
          console.warn('[Search IME] failure capture unavailable', captureError)
        );
        throw error;
      } finally {
        holdFragments = false;
        releaseFragments();
        const cleanup = await Promise.allSettled([
          inputHandle?.dispose(),
          staleResult?.dispose(),
          cdp.detach(),
        ]);
        try {
          await context.close();
        } catch (error) {
          cleanup.push({ status: 'rejected', reason: error });
        }
        const failures = cleanup.flatMap((result) =>
          result.status === 'rejected' ? [result.reason] : []
        );
        if (failures.length) {
          if (!originalFailure) throw new AggregateError(failures, 'Search IME cleanup failed');
          console.warn('[Search IME] Cleanup failures after original failure', failures);
        }
      }
    }, 90_000);
  }
});
