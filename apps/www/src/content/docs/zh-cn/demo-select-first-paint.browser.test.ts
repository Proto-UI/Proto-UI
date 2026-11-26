// @vitest-environment node

import type { Browser, Page } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
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
const SELECT_DEMO_SELECTOR = '[data-demo-id="demo-brutalist-select-input"]';

/** The controlled timezone demo preselects `jst`, whose authored label is `Japan Standard Time (JST)`. */
const AUTHORED_LABEL = 'Japan Standard Time (JST)';
const FIRST_LABEL = 'Eastern Standard Time (EST)';
const LAST_LABEL = 'New Zealand Standard Time (NZST)';

/** Twelve authored timezone options. */
const REGISTERED_ITEM_COUNT = 12;

/** Root, trigger, value, closed content, twelve authored items, and the Reset button. */
const MOUNTED_ROOT_COUNT = 17;

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
    ({ selected, selector }) => {
      const root = document.querySelector<HTMLElement>(selector);
      const host = root?.querySelector<HTMLElement>('.host');
      const activeTab = root?.querySelector<HTMLElement>(
        `[data-runtime-tabs-mount] [data-runtime-tabs-root] [data-runtime-tab=${JSON.stringify(selected)}][role="tab"][aria-selected="true"]`
      );
      if (!host || !activeTab) {
        return false;
      }
      return Array.from(host.querySelectorAll('*')).some(
        (element) => element.getAttribute('role') === 'combobox'
      );
    },
    { selected: runtime, selector: SELECT_DEMO_SELECTOR },
    { timeout: 20_000 }
  );
  await page.waitForTimeout(300);
}

let browser: Browser;
let baseUrl = '';

async function retainObservation(page: Page, runtime: string, stage: string, observed: unknown) {
  const directory = process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  const key = `select-${runtime}-${stage}`;
  await page.screenshot({ path: join(directory, `${key}.png`) });
  await writeFile(
    join(directory, `${key}.json`),
    JSON.stringify(
      {
        testSource: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        servedPageRevision: null,
        sourceBinding:
          'The supervising release receipt binds the separately served page; this file records the test checkout.',
        runtime,
        stage,
        route: SELECT_ROUTE,
        browser: browser.version(),
        observed,
        outcome: 'observation-only; the corresponding Vitest result records assertion acceptance',
        scope: 'Native public Select projection and focus; not an OS assistive-technology session.',
      },
      null,
      2
    ) + '\n'
  );
}

type ClosedSelect = {
  label: string;
  displayValue: string | null;
  registeredItems: number;
  mountedRoots: number;
  detachedHosts: number;
  everOpened: boolean;
};

async function readClosedSelect(page: Page): Promise<ClosedSelect> {
  return page.evaluate((selector) => {
    const host = document.querySelector(`${selector} .host`);
    if (!host) throw new Error('The Select demo must render projected content.');
    const boundaries = host.querySelectorAll(
      '.pui-runtime-preview-surface[data-demo-ref="__website_runtime_preview_surface__"]'
    );
    if (boundaries.length !== 1)
      throw new Error('The Select demo requires one exact runtime surface boundary.');
    const content = boundaries[0];
    if (
      Array.from(host.querySelectorAll('[data-pui-root]')).some(
        (node) => node !== content && !content.contains(node)
      )
    )
      throw new Error('An unexpected Prototype is outside the original Select slot.');
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
  }, SELECT_DEMO_SELECTOR);
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
    const { context, page } = await openRoute(browser, baseUrl, SELECT_ROUTE, {
      width: 1440,
      height: 900,
    });
    const previewer = page.locator(SELECT_DEMO_SELECTOR);

    try {
      await previewer.scrollIntoViewIfNeeded();
      for (const runtime of SELECT_RUNTIMES) {
        await showRuntime(page, previewer, runtime);
        const closed = await readClosedSelect(page);
        await retainObservation(page, runtime, 'never-opened-label', closed);

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
    const { context, page } = await openRoute(browser, baseUrl, SELECT_ROUTE, {
      width: 1440,
      height: 900,
    });
    const previewer = page.locator(SELECT_DEMO_SELECTOR);

    try {
      await previewer.scrollIntoViewIfNeeded();
      for (const runtime of SELECT_RUNTIMES) {
        await showRuntime(page, previewer, runtime);
        const closed = await readClosedSelect(page);
        await retainObservation(page, runtime, 'closed-mounted-content', closed);

        expect(closed.detachedHosts, `${runtime}/detached`).toBeGreaterThan(0);
        // Authored options must register while closed so first-paint label
        // resolution comes from live collection entries, not a cache.
        expect(closed.registeredItems, `${runtime}/registered`).toBe(REGISTERED_ITEM_COUNT);
        expect(closed.mountedRoots, `${runtime}/mounted-roots`).toBe(MOUNTED_ROOT_COUNT);
      }
    } finally {
      await context.close();
    }
  }, 180_000);
});

describe.sequential('React Select retained native entry focus', () => {
  it('observes selected entry and native End/Home without committing selection', async () => {
    const { context, page } = await openRoute(browser, baseUrl, SELECT_ROUTE, {
      width: 1440,
      height: 900,
    });
    const previewer = page.locator(SELECT_DEMO_SELECTOR);

    try {
      await previewer.scrollIntoViewIfNeeded();
      await showRuntime(page, previewer, 'react');
      const trigger = previewer.locator('.host [role="combobox"]');
      await trigger.click();
      const controlledId = await trigger.getAttribute('aria-controls');
      if (!controlledId) throw new Error('The open Select must identify its option surface.');
      const content = page.locator(`[id=${JSON.stringify(controlledId)}]`);
      const selected = content.getByRole('option', { name: AUTHORED_LABEL, exact: true });
      const first = content.getByRole('option', { name: FIRST_LABEL, exact: true });
      const last = content.getByRole('option', { name: LAST_LABEL, exact: true });
      const readFocus = (option: Locator) =>
        option.evaluate((element) => ({
          nativeFocused: element.ownerDocument.activeElement === element,
          observedFocused: element.hasAttribute('data-focused'),
        }));

      // Only the component requests entry focus. Reading both DOM focus and
      // the public fact projection catches focus applied behind a closed gate.
      await expect
        .poll(() => readFocus(selected), { message: 'react/selected-entry' })
        .toEqual({
          nativeFocused: true,
          observedFocused: true,
        });
      await retainObservation(page, 'react', 'selected-entry', {
        selected: await readFocus(selected),
        first: await readFocus(first),
        last: await readFocus(last),
        ariaSelected: {
          selected: await selected.getAttribute('aria-selected'),
          first: await first.getAttribute('aria-selected'),
          last: await last.getAttribute('aria-selected'),
        },
      });
      // Use page input: locator.press() would focus the option first and mask
      // a missing native entry event by injecting the fact navigation needs.
      await page.keyboard.press('End');
      await expect
        .poll(() => readFocus(last), { message: 'react/End' })
        .toEqual({
          nativeFocused: true,
          observedFocused: true,
        });
      await retainObservation(page, 'react', 'native-End', {
        selected: await readFocus(selected),
        first: await readFocus(first),
        last: await readFocus(last),
        ariaSelected: {
          selected: await selected.getAttribute('aria-selected'),
          first: await first.getAttribute('aria-selected'),
          last: await last.getAttribute('aria-selected'),
        },
      });
      // Home must move from a non-first member; an ignored Home cannot pass.
      await page.keyboard.press('Home');
      await expect
        .poll(() => readFocus(first), { message: 'react/Home' })
        .toEqual({
          nativeFocused: true,
          observedFocused: true,
        });
      await retainObservation(page, 'react', 'native-Home', {
        selected: await readFocus(selected),
        first: await readFocus(first),
        last: await readFocus(last),
        ariaSelected: {
          selected: await selected.getAttribute('aria-selected'),
          first: await first.getAttribute('aria-selected'),
          last: await last.getAttribute('aria-selected'),
        },
      });
      expect(await selected.getAttribute('aria-selected')).toBe('true');
      expect(await first.getAttribute('aria-selected')).toBe('false');
      expect(await last.getAttribute('aria-selected')).toBe('false');
    } finally {
      await context.close();
    }
  }, 180_000);
});
