// @vitest-environment node

import type { Browser, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RUNTIMES, launchBrowser, openRoute, startServer, stopServer } from './browser-harness';

const MATRIX_ROUTE = '/zh-cn/internal/demo-matrix/';

type MatrixFacts = {
  demos: number;
  previewers: number;
  initialized: number;
  errors: number;
  overflow: number;
  adapterColumns: string;
  runtimeRows: Record<string, number>;
};

async function waitForMatrix(page: Page): Promise<void> {
  await page.waitForFunction(
    (runtimeCount) => {
      const demos = document.querySelectorAll('.demo-matrix__item').length;
      const previewers = document.querySelectorAll('[data-previewer-id]').length;
      const initialized = document.querySelectorAll('[data-previewer-id][data-inited="1"]').length;
      return demos > 0 && previewers === demos * runtimeCount && initialized === previewers;
    },
    RUNTIMES.length,
    { timeout: 60_000 }
  );

  // Framework loaders settle after the preview roots are marked initialized;
  // wait for the final host content so a slow import cannot be reported as a
  // false matrix failure.
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll<HTMLElement>('[data-previewer-id] .host')].every(
        (host) => host.childElementCount > 0 || host.textContent?.includes('[Preview Error]')
      ),
    undefined,
    { timeout: 60_000 }
  );
}

async function readMatrixFacts(page: Page): Promise<MatrixFacts> {
  return page.evaluate((runtimeIds) => {
    const root = document.documentElement;
    const adapters = [...document.querySelectorAll<HTMLElement>('.demo-matrix__adapter')];
    const runtimeRows = Object.fromEntries(
      runtimeIds.map((runtime) => [
        runtime,
        adapters.filter((adapter) =>
          adapter
            .getAttribute('aria-label')
            ?.endsWith(
              runtime === 'wc'
                ? 'Web Components'
                : runtime === 'vue2'
                  ? 'Vue 2'
                  : runtime[0].toUpperCase() + runtime.slice(1)
            )
        ).length,
      ])
    );
    const firstGrid = document.querySelector<HTMLElement>('.demo-matrix__adapters');
    return {
      demos: document.querySelectorAll('.demo-matrix__item').length,
      previewers: document.querySelectorAll('[data-previewer-id]').length,
      initialized: document.querySelectorAll('[data-previewer-id][data-inited="1"]').length,
      errors: [...document.querySelectorAll('[data-previewer-id]')].filter((previewer) =>
        previewer.textContent?.includes('[Preview Error]')
      ).length,
      overflow: root.scrollWidth - root.clientWidth,
      adapterColumns: firstGrid ? getComputedStyle(firstGrid).gridTemplateColumns : '',
      runtimeRows,
    };
  }, RUNTIMES);
}

async function chooseGlobalAdapter(page: Page, runtime: string): Promise<void> {
  const root = page.locator('wc-shadcn-select-root[data-adapter-select-root]').first();
  await root.locator('wc-shadcn-select-trigger').click();
  await page
    .locator(
      `wc-shadcn-select-content[data-transition-state="entered"] wc-shadcn-select-item[data-value="${runtime}"]`
    )
    .click({ force: true });
  await page.waitForFunction(
    (selected) =>
      document.querySelector<HTMLElement>('wc-shadcn-select-root[data-adapter-select-root]')
        ?.dataset.value === selected,
    runtime,
    { timeout: 10_000 }
  );
}

let browser: Browser;
let baseUrl = '';

beforeAll(async () => {
  baseUrl = await startServer(MATRIX_ROUTE);
  browser = await launchBrowser();
}, 150_000);

afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

describe.sequential('Website Demo Matrix browser smoke', () => {
  it('mounts every demo in every official adapter without errors or overflow', async () => {
    const { context, page } = await openRoute(browser, baseUrl, MATRIX_ROUTE, {
      width: 1440,
      height: 900,
    });

    try {
      await waitForMatrix(page);
      const facts = await readMatrixFacts(page);
      expect(facts.demos).toBeGreaterThan(0);
      expect(facts.previewers).toBe(facts.demos * RUNTIMES.length);
      expect(facts.initialized).toBe(facts.previewers);
      expect(facts.errors).toBe(0);
      expect(facts.overflow).toBeLessThanOrEqual(0);
      for (const runtime of RUNTIMES) {
        expect(facts.runtimeRows[runtime], runtime).toBe(facts.demos);
      }

      await chooseGlobalAdapter(page, 'vue2');
      await page.waitForFunction(
        () =>
          [
            ...document.querySelectorAll<HTMLElement>(
              '.demo-matrix__adapter[aria-label$="Vue 2"] .host'
            ),
          ].every(
            (host) => host.childElementCount > 0 || host.textContent?.includes('[Preview Error]')
          ),
        undefined,
        { timeout: 30_000 }
      );
      await chooseGlobalAdapter(page, 'react');
      await page.waitForFunction(
        () =>
          [
            ...document.querySelectorAll<HTMLElement>(
              '.demo-matrix__adapter[aria-label$="React"] .host'
            ),
          ].every(
            (host) => host.childElementCount > 0 || host.textContent?.includes('[Preview Error]')
          ),
        undefined,
        { timeout: 30_000 }
      );
    } finally {
      await context.close();
    }
  }, 180_000);

  it('keeps the four-column matrix readable at 320px', async () => {
    const { context, page } = await openRoute(browser, baseUrl, MATRIX_ROUTE, {
      width: 320,
      height: 900,
    });

    try {
      await waitForMatrix(page);
      const facts = await readMatrixFacts(page);
      expect(facts.errors).toBe(0);
      expect(facts.overflow).toBeLessThanOrEqual(0);
      expect(facts.adapterColumns.split(' ').filter(Boolean)).toHaveLength(1);
      expect(facts.previewers).toBe(facts.demos * RUNTIMES.length);
    } finally {
      await context.close();
    }
  }, 180_000);
});
