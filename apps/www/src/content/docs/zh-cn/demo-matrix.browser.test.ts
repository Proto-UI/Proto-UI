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
  adapterColumnCount: number;
  runtimeRows: Record<string, number>;
};

type InteractiveFact = {
  role: string;
  name: string;
};

const INTERACTIVE_ROLES = [
  'button',
  'checkbox',
  'combobox',
  'menuitem',
  'radio',
  'switch',
  'tab',
  'textbox',
] as const;

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
    const firstColumns = new Set(
      [...(firstGrid?.querySelectorAll<HTMLElement>(':scope > .demo-matrix__adapter') ?? [])].map(
        (adapter) => Math.round(adapter.getBoundingClientRect().left)
      )
    );
    return {
      demos: document.querySelectorAll('.demo-matrix__item').length,
      previewers: document.querySelectorAll('[data-previewer-id]').length,
      initialized: document.querySelectorAll('[data-previewer-id][data-inited="1"]').length,
      errors: [...document.querySelectorAll('[data-previewer-id]')].filter((previewer) =>
        previewer.textContent?.includes('[Preview Error]')
      ).length,
      overflow: root.scrollWidth - root.clientWidth,
      adapterColumns: firstGrid ? getComputedStyle(firstGrid).gridTemplateColumns : '',
      adapterColumnCount: firstColumns.size,
      runtimeRows,
    };
  }, RUNTIMES);
}

/**
 * Read only rendered, non-zero-sized controls. Portaled dialog/menu parts are
 * present in the document while closed, but are not part of the visible
 * matrix surface until the corresponding trigger opens them.
 */
async function readInteractiveFacts(page: Page): Promise<Record<string, InteractiveFact[][]>> {
  return page.evaluate((interactiveRoles) => {
    const roles = new Set<string>(interactiveRoles);
    const accessibleName = (element: HTMLElement): string => {
      const labelledBy = element.getAttribute('aria-labelledby');
      const labelledText = labelledBy
        ? labelledBy
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent ?? '')
            .join(' ')
        : '';
      return (
        element.getAttribute('aria-label') ||
        labelledText ||
        element.getAttribute('title') ||
        element.textContent ||
        ''
      )
        .trim()
        .replace(/\s+/g, ' ');
    };
    const visible = (element: HTMLElement): boolean => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden'
      );
    };

    const result: Record<string, InteractiveFact[][]> = {};
    document.querySelectorAll<HTMLElement>('.demo-matrix__item').forEach((item) => {
      result[item.id] = Array.from(
        item.querySelectorAll<HTMLElement>(
          ':scope > .demo-matrix__adapters > .demo-matrix__adapter'
        )
      ).map((adapter) =>
        Array.from(adapter.querySelectorAll<HTMLElement>('[role],button,input,select,textarea'))
          .filter((element) => {
            const role = element.getAttribute('role');
            return (
              ((role && roles.has(role)) ||
                ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName)) &&
              visible(element)
            );
          })
          .map((element) => ({
            role: element.getAttribute('role') || element.tagName.toLowerCase(),
            name: accessibleName(element),
          }))
      );
    });
    return result;
  }, INTERACTIVE_ROLES);
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
      expect(facts.adapterColumnCount).toBe(RUNTIMES.length);
      for (const runtime of RUNTIMES) {
        expect(facts.runtimeRows[runtime], runtime).toBe(facts.demos);
      }

      const interactive = await readInteractiveFacts(page);
      for (const [demoId, adapters] of Object.entries(interactive)) {
        const signatures = adapters.map((controls) =>
          controls.map(({ role, name }) => `${role}|${name}`)
        );
        expect(
          signatures.flat().every((signature) => signature.endsWith('|') === false),
          `${demoId} has an unnamed visible interactive control`
        ).toBe(true);
        expect(
          new Set(signatures.map((signature) => JSON.stringify(signature))).size,
          `${demoId} accessible controls differ across runtimes`
        ).toBeLessThanOrEqual(1);
      }

      const waitForAdapterBroadcast = () =>
        page.evaluate(
          () =>
            new Promise<boolean>((resolve) => {
              document.addEventListener('proto-adapter:change', () => resolve(true), {
                once: true,
              });
            })
        );
      const vue2Broadcast = waitForAdapterBroadcast();
      await chooseGlobalAdapter(page, 'vue2');
      await vue2Broadcast;
      const reactBroadcast = waitForAdapterBroadcast();
      await chooseGlobalAdapter(page, 'react');
      await reactBroadcast;
    } finally {
      await context.close();
    }
  }, 180_000);

  for (const width of [320, 390]) {
    it(`keeps the matrix readable at ${width}px`, async () => {
      const { context, page } = await openRoute(browser, baseUrl, MATRIX_ROUTE, {
        width,
        height: 900,
      });

      try {
        await waitForMatrix(page);
        const facts = await readMatrixFacts(page);
        expect(facts.errors).toBe(0);
        expect(facts.overflow).toBeLessThanOrEqual(0);
        expect(facts.adapterColumnCount).toBe(1);
        expect(facts.previewers).toBe(facts.demos * RUNTIMES.length);
      } finally {
        await context.close();
      }
    }, 180_000);
  }

  it('moves focus into the Base Dialog content in every runtime', async () => {
    const { context, page } = await openRoute(browser, baseUrl, MATRIX_ROUTE, {
      width: 1440,
      height: 900,
    });

    const runtimeLabels: Record<string, string> = {
      wc: 'Web Components',
      react: 'React',
      vue: 'Vue',
      vue2: 'Vue 2',
    };

    try {
      await waitForMatrix(page);
      const dialogRow = page.locator('#demo-base-dialog');

      for (const runtime of RUNTIMES) {
        const region = dialogRow.locator(
          `.demo-matrix__adapter[aria-label="demo-base-dialog ${runtimeLabels[runtime]}"]`
        );
        const trigger = region.locator('[aria-haspopup="dialog"]');
        await trigger.scrollIntoViewIfNeeded();
        const contentId = await trigger.getAttribute('aria-controls');
        expect(contentId, `${runtime} dialog controls`).toBeTruthy();
        await trigger.click();

        await page.waitForFunction(
          (id) => {
            const content = id ? document.getElementById(id) : null;
            return Boolean(
              content &&
              getComputedStyle(content).display !== 'none' &&
              document.activeElement &&
              content.contains(document.activeElement)
            );
          },
          contentId,
          { timeout: 10_000 }
        );

        const cancel = page
          .locator(`[id="${contentId}"] [data-pui-a11y-actions="activate"]`)
          .first();
        await cancel.click();
        await page.waitForFunction(
          (id) => {
            const content = id ? document.getElementById(id) : null;
            return !content || getComputedStyle(content).display === 'none';
          },
          contentId,
          { timeout: 10_000 }
        );
        await expect
          .poll(() => trigger.evaluate((element) => document.activeElement === element), {
            timeout: 10_000,
          })
          .toBe(true);
      }
    } finally {
      await context.close();
    }
  }, 180_000);
});
