// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Browser, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser, startServer, stopServer } from './browser-harness';
import { readSearchReadyWithinBudget, searchReadinessWasOnTime } from './site-search-evidence';
import { readSearchPublicState, searchInput, searchPart } from './site-search-public-browser';

let browser: Browser;
let baseUrl: string;
const route = (family: string) =>
  `/zh-cn/ui-libraries/${family}/${family === 'brutalist' ? 'components/' : ''}button/`;
beforeAll(async () => {
  baseUrl = await startServer(route('shadcn'));
  browser = await launchBrowser();
}, 150_000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

// String-evaluated import intentionally runs in the browser's Vite graph. A
// transformed Node-side import could create a different module/participant.
// Only the first materialization rejection and optional delivery gate are
// injected. Real participants, controllers, public composition and DOM run.
const installFault = `async () => {
  const { searchCommandParticipant } = await import('/src/components/site-search-commands.ts');
  const root = document.querySelector('site-search');
  const owner = searchCommandParticipant(root);
  const original = owner.materializeDialog.bind(owner);
  let release;
  const gate = new Promise(done => release = done);
  const trace = window.__searchRecovery = {
    root, owner, attempts: [], prepared: [], activated: [], disposed: [],
    hold: false, release, sourceOwner: root.querySelector('[data-open-modal]'),
  };
  owner.materializeDialog = async (...args) => {
    const call = trace.attempts.length + 1;
    trace.attempts.push({ call, runtime: args[0].selection.runtimeId, generation: args[0].generation, at: performance.now() });
    if (call === 1) throw new Error('Injected first Dialog materialization failure');
    const candidate = await original(...args);
    trace.prepared.push({ call, host: candidate.host, at: performance.now() });
    if (trace.hold && call === 2) await gate;
    return {
      ...candidate,
      activate() { trace.activated.push(call); return candidate.activate(); },
      dispose() { trace.disposed.push(call); return candidate.dispose(); },
    };
  };
}`;

async function prepare(page: Page, family: string) {
  // Dev has no generated Pagefind index. This data boundary is independent
  // from the injected projection failure; production-index guards stay separate.
  await page.route('**/pagefind/pagefind.js', (request) =>
    request.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: `
      export async function options() {}
      export async function search(query) {
        return { results: [{ id: query, data: async () => ({ url: '/zh-cn/overview/', meta: { title: 'Result ' + query } }) }] };
      }`,
    })
  );
  expect((await page.goto(`${baseUrl}${route(family)}`, { waitUntil: 'networkidle' }))?.ok()).toBe(
    true
  );
  const readiness = await page.evaluate(readSearchReadyWithinBudget, { startedAt: Date.now() });
  expect(searchReadinessWasOnTime(readiness), JSON.stringify(readiness)).toBe(true);
  expect(
    await page.locator('[data-search-dialog-mount] [data-projection-generation-host]').count()
  ).toBe(0);
  await page.evaluate(installFault);
  await page
    .locator('site-search [data-projection-generation-state="active"] [data-open-modal]')
    .click();
  await expect
    .poll(() => page.locator('site-search').getAttribute('data-search-view'))
    .toBe('unavailable');
  expect(await page.evaluate(() => (window as any).__searchRecovery.attempts.length)).toBe(1);
  expect(await page.evaluate(readSearchPublicState)).toMatchObject({
    generation: null,
    inputConnected: undefined,
  });
  return readiness;
}
async function observe(page: Page) {
  return page.evaluate(() => {
    const trace = (window as any).__searchRecovery;
    return {
      attempts: trace.attempts,
      prepared: trace.prepared.map((item: any) => ({
        call: item.call,
        connected: item.host.isConnected,
        state: item.host.dataset.projectionGenerationState,
      })),
      activated: trace.activated,
      disposed: trace.disposed,
      sameRoot: document.querySelector('site-search') === trace.root,
      sameOpener: trace.root.querySelector('[data-open-modal]') === trace.sourceOwner,
      view: trace.root.dataset.searchView,
      runtime: trace.root.dataset.searchRuntime,
      sessionOpen: trace.owner.isOpen(),
    };
  });
}
async function record(page: Page, id: string, samples: unknown[], error?: unknown) {
  const evidence =
    process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR ?? process.env.PROTO_UI_BROWSER_EVIDENCE_DIR;
  if (!evidence) return;
  const directory = path.join(evidence, 'search-first-dialog-recovery');
  await mkdir(directory, { recursive: true });
  const sourcePath = 'apps/www/src/components/site-search-commands.ts';
  await writeFile(
    path.join(directory, `${id}.json`),
    JSON.stringify(
      {
        sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        sourcePath,
        sourceDigest: createHash('sha256')
          .update(await readFile(sourcePath))
          .digest('hex'),
        browser: browser.version(),
        samples,
        terminal: error ? 'failed' : 'passed',
        error: error ? String(error) : null,
        boundary:
          'Actual Chromium/Web public Dialog and lifecycle; controlled first materialization failure and Pagefind resource, not generated-index or physical IME evidence.',
      },
      null,
      2
    )
  );
  await page.screenshot({ path: path.join(directory, `${id}.png`) });
}

describe('Search first lazy Dialog failure recovery in Chromium', () => {
  for (const family of ['shadcn', 'brutalist']) {
    it(`${family} reopens the same owner and keeps a usable query after first materialization failure`, async () => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 960 } });
      const page = await context.newPage();
      const samples: unknown[] = [];
      let failure: unknown;
      try {
        samples.push({
          step: 'first-failed',
          readiness: await prepare(page, family),
          state: await observe(page),
        });
        await page.keyboard.press('Control+k');
        await page.keyboard.press('Control+k');
        const input = await searchInput(page);
        await input.fill('recovered');
        await expect
          .poll(async () => (await page.evaluate(readSearchPublicState)).query)
          .toBe('recovered');
        await expect
          .poll(async () => (await searchPart(page, 'results')).textContent())
          .toContain('Result recovered');
        const recovered = await observe(page);
        samples.push({
          step: 'recovered-query',
          state: recovered,
          public: await page.evaluate(readSearchPublicState),
        });
        expect(recovered).toMatchObject({
          sameRoot: true,
          sameOpener: true,
          view: 'ready',
          sessionOpen: true,
          activated: [2],
        });
        expect(recovered.attempts).toHaveLength(2);
        await page.keyboard.press('Escape');
        await expect
          .poll(async () => (await page.evaluate(readSearchPublicState)).open)
          .toBe(false);
        await page.keyboard.press('Control+k');
        await expect
          .poll(async () => (await page.evaluate(readSearchPublicState)).query)
          .toBe('recovered');
        expect((await observe(page)).attempts).toHaveLength(2);
        samples.push({
          step: 'reopen-retains-query',
          state: await observe(page),
          public: await page.evaluate(readSearchPublicState),
        });
      } catch (error) {
        failure = error;
        throw error;
      } finally {
        try {
          await record(page, `${family}-reopen`, samples, failure);
        } finally {
          await context.close();
        }
      }
    }, 60_000);
  }

  it.each(['wc', 'react', 'vue', 'vue2'])(
    'retries the failed first Dialog on %s preference',
    async (runtime) => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 960 } });
      const page = await context.newPage();
      const samples: unknown[] = [];
      let failure: unknown;
      try {
        samples.push({
          step: 'first-failed',
          readiness: await prepare(page, 'shadcn'),
          state: await observe(page),
        });
        await page.evaluate(
          (runtime) =>
            document.dispatchEvent(
              new CustomEvent('proto-adapter:change', { detail: { adapter: runtime } })
            ),
          runtime
        );
        const input = await searchInput(page);
        await input.fill('runtime');
        await expect
          .poll(async () => (await searchPart(page, 'results')).textContent())
          .toContain('Result runtime');
        const recovered = await observe(page);
        samples.push({
          step: 'preference-recovered',
          state: recovered,
          public: await page.evaluate(readSearchPublicState),
        });
        expect(recovered).toMatchObject({
          sameRoot: true,
          view: 'ready',
          runtime,
          sessionOpen: true,
          activated: [2],
        });
        expect(recovered.attempts).toHaveLength(2);
        expect(recovered.attempts[1].runtime).toBe(runtime);
      } catch (error) {
        failure = error;
        throw error;
      } finally {
        try {
          await record(page, `preference-${runtime}`, samples, failure);
        } finally {
          await context.close();
        }
      }
    },
    60_000
  );

  it.each(['dispose', 'supersede'] as const)(
    'retires pending recovery after %s and repeated open intents',
    async (mode) => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 960 } });
      const page = await context.newPage();
      const samples: unknown[] = [];
      let failure: unknown;
      try {
        samples.push({
          step: 'first-failed',
          readiness: await prepare(page, 'shadcn'),
          state: await observe(page),
        });
        await page.evaluate(() => {
          (window as any).__searchRecovery.hold = true;
        });
        for (let index = 0; index < 3; index++) {
          await page.keyboard.press('Control+k');
          await page.keyboard.press('Control+k');
        }
        await expect.poll(async () => (await observe(page)).prepared.length).toBe(1);
        expect((await observe(page)).attempts).toHaveLength(2);
        samples.push({ step: 'pending-repeated-opens', state: await observe(page) });
        if (mode === 'dispose') {
          await page.locator('site-search').evaluate((root) => root.remove());
        } else {
          await page.evaluate(() =>
            document.dispatchEvent(
              new CustomEvent('proto-adapter:change', { detail: { adapter: 'react' } })
            )
          );
          const input = await searchInput(page);
          await input.fill('newest');
          await expect
            .poll(async () => (await searchPart(page, 'results')).textContent())
            .toContain('Result newest');
        }
        await page.evaluate(() => (window as any).__searchRecovery.release());
        await expect.poll(async () => (await observe(page)).disposed).toContain(2);
        const final = await observe(page);
        samples.push({
          step: 'late-candidate-retired',
          state: final,
          public: await page.evaluate(readSearchPublicState),
        });
        expect(final.activated).not.toContain(2);
        expect(final.prepared.find((item: any) => item.call === 2)?.connected).toBe(false);
        if (mode === 'dispose') {
          expect(final.sameRoot).toBe(false);
          expect(await page.locator('[data-demo-ref="panel"]').count()).toBe(0);
          await page.keyboard.press('Control+k');
          expect((await observe(page)).attempts).toHaveLength(2);
        } else {
          expect(final).toMatchObject({ view: 'ready', runtime: 'react', activated: [3] });
          expect((await page.evaluate(readSearchPublicState)).query).toBe('newest');
        }
      } catch (error) {
        failure = error;
        throw error;
      } finally {
        try {
          await record(page, `pending-${mode}`, samples, failure);
        } finally {
          await context.close();
        }
      }
    },
    60_000
  );
});
