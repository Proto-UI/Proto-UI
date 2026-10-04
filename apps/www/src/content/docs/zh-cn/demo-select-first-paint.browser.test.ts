// @vitest-environment node

import type { Browser, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Locator } from 'playwright-core';
import {
  RUNTIMES,
  choosePreviewRuntime,
  launchBrowser,
  openRoute,
  startServer,
  stopServer,
} from './browser-harness';

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
async function showRuntime(
  page: Page,
  previewer: Locator,
  runtime: (typeof RUNTIMES)[number]
): Promise<void> {
  await choosePreviewRuntime(page, previewer, runtime);
  await page.waitForFunction(
    (selected) => {
      const root = document.querySelector('[data-previewer-id]');
      const scope = root?.querySelector<HTMLElement>('[data-projection-scope]');
      const content = scope?.querySelector<HTMLElement>('[data-projection-content]');
      if (
        !content ||
        scope?.dataset.projectionRuntime !== selected ||
        scope.dataset.projectionState !== 'ready'
      ) {
        return false;
      }
      return Array.from(content.querySelectorAll('*')).some(
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
    const content = document.querySelector('[data-previewer-id] [data-projection-content]');
    if (!content) throw new Error('The Select demo must render projected content.');
    const trigger = Array.from(content.querySelectorAll('*')).find(
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
      registeredItems: content.querySelectorAll('[data-collection-index]').length,
      mountedRoots: content.querySelectorAll('[data-pui-root]').length,
      detachedHosts: content.querySelectorAll('[data-pui-view-detached]').length,
      everOpened: !!content.querySelector('[data-open]'),
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

describe.sequential('React Select retained native entry focus', () => {
  it('observes selected entry and native End/Home without committing selection', async () => {
    const { context, page, previewer } = await openRoute(browser, baseUrl, SELECT_ROUTE, {
      width: 1440,
      height: 900,
    });

    try {
      await previewer.scrollIntoViewIfNeeded();
      await showRuntime(page, previewer, 'react');
      const trigger = previewer.locator('[data-projection-content] [role="combobox"]');
      await trigger.click();
      const controlledId = await trigger.getAttribute('aria-controls');
      if (!controlledId) throw new Error('The open Select must identify its option surface.');
      const content = page.locator(`[id=${JSON.stringify(controlledId)}]`);
      const paper = content.getByRole('option', { name: AUTHORED_LABEL, exact: true });
      const ink = content.getByRole('option', { name: 'Ink', exact: true });
      const readFocus = (option: Locator) =>
        option.evaluate((element) => ({
          nativeFocused: element.ownerDocument.activeElement === element,
          observedFocused: element.hasAttribute('data-focused'),
        }));

      // Only the component requests entry focus. Reading both DOM focus and
      // the public fact projection catches focus applied behind a closed gate.
      await expect
        .poll(() => readFocus(paper), { message: 'react/selected-entry' })
        .toEqual({
          nativeFocused: true,
          observedFocused: true,
        });
      // Use page input: locator.press() would focus the option first and mask
      // a missing native entry event by injecting the fact navigation needs.
      await page.keyboard.press('End');
      await expect
        .poll(() => readFocus(ink), { message: 'react/End' })
        .toEqual({
          nativeFocused: true,
          observedFocused: true,
        });
      // Home must move from a non-first member; an ignored Home cannot pass.
      await page.keyboard.press('Home');
      await expect
        .poll(() => readFocus(paper), { message: 'react/Home' })
        .toEqual({
          nativeFocused: true,
          observedFocused: true,
        });
      expect(await paper.getAttribute('aria-selected')).toBe('true');
      expect(await ink.getAttribute('aria-selected')).toBe('false');
    } finally {
      await context.close();
    }
  }, 180_000);
});
