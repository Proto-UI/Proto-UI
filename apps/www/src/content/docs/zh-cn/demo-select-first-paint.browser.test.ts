// @vitest-environment node

import type { Browser, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Locator } from 'playwright-core';
import { RUNTIMES, launchBrowser, openRoute, startServer, stopServer } from './browser-harness';

const SELECT_RUNTIMES = RUNTIMES;

const SELECT_ROUTE = '/en/ui-libraries/brutalist/components/select/';

/** The demo preselects `paper`, whose authored label is `Paper`. */
const AUTHORED_LABEL = 'Paper';

/** Root, trigger, value, the closed content, and its two authored items. */
const MOUNTED_ROOT_COUNT = 6;

/**
 * The shared `selectRuntime` waits on an exact prototype-root count, which is
 * one of the things this file measures, so readiness here waits only for the
 * trigger. Reusing the shared helper would turn every assertion below into a
 * timeout that says nothing about the label.
 */
async function showRuntime(page: Page, previewer: Locator, runtime: string): Promise<void> {
  const selectRoot = previewer.locator('[data-adapter-select-root]');
  await selectRoot.locator('wc-shadcn-select-trigger').click();
  // Select content is portalled while open, so resolve the visible item from
  // the document rather than assuming it remains a child of the previewer.
  await page
    .locator(`wc-shadcn-select-item[data-value="${runtime}"]:visible`)
    .last()
    .click({ force: true });
  await page.waitForFunction(
    (selected) => {
      const root = document.querySelector('[data-previewer-id]');
      const select = root?.querySelector<HTMLElement>('[data-adapter-select-root]');
      const host = root?.querySelector('.host');
      if (!host || select?.getAttribute('data-value') !== selected) return false;
      return Array.from(host.querySelectorAll('*')).some(
        (element) => element.getAttribute('role') === 'combobox'
      );
    },
    runtime,
    { timeout: 20_000 }
  );
  await page.waitForTimeout(300);
}

let browser: Browser;
let baseUrl = '';

type ClosedSelect = {
  label: string;
  displayValue: string | null;
  registeredItems: number;
  mountedRoots: number;
  detachedHosts: number;
  everOpened: boolean;
};

async function readClosedSelect(page: Page): Promise<ClosedSelect> {
  return page.evaluate(() => {
    const host = document.querySelector('[data-previewer-id] .host');
    if (!host) throw new Error('The Select demo must render a previewer host.');
    const trigger = Array.from(host.querySelectorAll('*')).find(
      (element) => element.getAttribute('role') === 'combobox'
    );
    if (!trigger) throw new Error('The Select demo must render a trigger.');
    const value = Array.from(trigger.querySelectorAll('*')).find((element) =>
      element.hasAttribute('data-pui-root')
    );

    return {
      label: (value?.textContent ?? '').trim(),
      displayValue: value?.getAttribute('data-display-value') ?? null,
      // Items live inside the closed content; they register with the Root's
      // collection even though nothing has opened it.
      registeredItems: host.querySelectorAll('[data-collection-index]').length,
      mountedRoots: host.querySelectorAll('[data-pui-root]').length,
      detachedHosts: host.querySelectorAll('[data-pui-view-detached]').length,
      everOpened: !!host.querySelector('[data-open]'),
    };
  });
}

beforeAll(async () => {
  baseUrl = await startServer(SELECT_ROUTE);
  browser = await launchBrowser();
}, 150_000);

afterAll(async () => {
  await browser?.close();
  await stopServer();
});

describe.sequential('Select first paint with the popup never opened', () => {
  it('shows the authored label in every runtime', async () => {
    const { context, page, previewer } = await openRoute(browser, baseUrl, SELECT_ROUTE, {
      width: 1440,
      height: 900,
    });

    try {
      await previewer.scrollIntoViewIfNeeded();
      for (const runtime of SELECT_RUNTIMES) {
        await showRuntime(page, previewer, runtime);
        const closed = await readClosedSelect(page);

        // Nothing in this case may open the popup; the defect it guards only
        // shows before the first open cycle.
        expect(closed.everOpened, `${runtime}/never-opened`).toBe(false);

        // The rendered text is the assertion that matters to a reader of the
        // page. `data-display-value` is checked alongside it because the two
        // drifted apart: the protocol resolved the label while the view kept
        // painting the raw value.
        expect(closed.label, `${runtime}/label`).toBe(AUTHORED_LABEL);
        expect(closed.displayValue, `${runtime}/display-value`).toBe(AUTHORED_LABEL);
      }
    } finally {
      await context.close();
    }
  }, 180_000);

  it('keeps the closed content mounted and marked detached in every runtime', async () => {
    const { context, page, previewer } = await openRoute(browser, baseUrl, SELECT_ROUTE, {
      width: 1440,
      height: 900,
    });

    try {
      await previewer.scrollIntoViewIfNeeded();
      for (const runtime of SELECT_RUNTIMES) {
        await showRuntime(page, previewer, runtime);
        const closed = await readClosedSelect(page);

        expect(closed.detachedHosts, `${runtime}/detached`).toBeGreaterThan(0);
        // Two authored options. Without them registered the label above can
        // only come from a cache, so this is what makes that case meaningful.
        expect(closed.registeredItems, `${runtime}/registered`).toBe(2);
        expect(closed.mountedRoots, `${runtime}/mounted-roots`).toBe(MOUNTED_ROOT_COUNT);
      }
    } finally {
      await context.close();
    }
  }, 180_000);
});
