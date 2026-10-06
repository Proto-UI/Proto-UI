// @vitest-environment node

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { Browser, Locator } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  RUNTIMES,
  launchBrowser,
  openRoute,
  selectRuntime,
  startServer,
  stopServer,
} from './browser-harness';

const ROUTE = '/en/ui-libraries/base/collapsible/';
let browser: Browser;
let baseUrl = '';

function disclosure(previewer: Locator, ref: string): Locator {
  return previewer.locator(`.host [data-demo-ref="${ref}"]`);
}

function trigger(root: Locator): Locator {
  return root.getByRole('button', { includeHidden: true });
}

function content(root: Locator): Locator {
  // WC retains a logical Custom Element while its host view is detached.
  return root.locator('[data-pui-root]:not([role="button"]):not([data-pui-view-detached])');
}

async function absentContent(root: Locator): Promise<void> {
  await expect.poll(() => content(root).count()).toBe(0);
  for (const placeholder of await root.locator('[data-pui-view-detached]').all()) {
    expect(await placeholder.isVisible()).toBe(false);
  }
}

async function expanded(button: Locator, value: boolean): Promise<void> {
  await expect.poll(() => button.getAttribute('aria-expanded')).toBe(String(value));
}

async function focused(button: Locator): Promise<void> {
  await expect
    .poll(() => button.evaluate((element) => document.activeElement === element))
    .toBe(true);
}

async function controls(root: Locator): Promise<string> {
  await expect.poll(() => trigger(root).getAttribute('aria-controls')).not.toBeNull();
  const id = (await trigger(root).getAttribute('aria-controls'))!;
  expect(await content(root).getAttribute('id')).toBe(id);
  expect(await content(root).getAttribute('role')).toBeNull();
  expect(await content(root).evaluate((element) => (element as HTMLElement).tabIndex)).toBe(-1);
  return id;
}

async function capture(previewer: Locator, name: string): Promise<void> {
  const directory = process.env.PROTO_UI_COLLAPSIBLE_SCREENSHOT_DIR;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  await previewer.screenshot({
    path: path.join(directory, `${name}.png`),
    style: 'astro-dev-toolbar { visibility: hidden; }',
  });
}

beforeAll(async () => {
  baseUrl = await startServer(ROUTE);
  browser = await launchBrowser();
}, 150_000);

afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

// T-BASE-COLLAPSIBLE-0001: native activation, relationship, L1, retention,
// disabled, controlled ownership, domain isolation and terminal view cleanup.
// SDK/simulated-DOM evidence cannot establish these Chromium surface facts.
describe.sequential('Base Collapsible public browser evidence', () => {
  for (const runtime of RUNTIMES) {
    it(`${runtime} preserves disclosure ownership through native input and view lifetimes`, async () => {
      const { context, page, previewer } = await openRoute(browser, baseUrl, ROUTE, {
        width: 1280,
        height: 900,
      });
      try {
        await selectRuntime(page, previewer, runtime, '[aria-expanded]', 4);
        const uncontrolled = disclosure(previewer, 'uncontrolled');
        const retained = disclosure(previewer, 'retained');
        const disabled = disclosure(previewer, 'disabled');
        const controlled = disclosure(previewer, 'controlled');
        const button = trigger(uncontrolled);

        // The initial closed default has no Content host view or dangling IDREF.
        await expanded(button, false);
        await absentContent(uncontrolled);
        expect(await button.getAttribute('aria-controls')).toBeNull();
        await expanded(trigger(retained), true);
        await expanded(trigger(disabled), true);
        await expanded(trigger(controlled), false);
        expect(await trigger(disabled).getAttribute('aria-disabled')).toBe('true');
        expect(
          await trigger(disabled).evaluate((element) => (element as HTMLElement).tabIndex)
        ).toBe(-1);
        await capture(previewer, `${runtime}-initial`);

        // Pointer activation focuses the Trigger, never the role-neutral Content.
        await button.click();
        await expanded(button, true);
        await expect.poll(() => content(uncontrolled).isVisible()).toBe(true);
        const identity = await controls(uncontrolled);
        await focused(button);
        await capture(previewer, `${runtime}-open`);

        // A focused Space closes once and cannot scroll the documentation.
        const scrollY = await page.evaluate(() => window.scrollY);
        await page.keyboard.press('Space');
        await expanded(button, false);
        await absentContent(uncontrolled);
        expect(await button.getAttribute('aria-controls')).toBeNull();
        expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
        await focused(button);

        // Repeat L1 rematerialization: the reusable service restores the same
        // live logical reservation; activation never transfers focus to Content.
        for (let cycle = 0; cycle < 2; cycle += 1) {
          await page.keyboard.press('Enter');
          await expanded(button, true);
          expect(await controls(uncontrolled)).toBe(identity);
          await focused(button);
          await page.keyboard.press('Enter');
          await expanded(button, false);
          await absentContent(uncontrolled);
          expect(await button.getAttribute('aria-controls')).toBeNull();
        }

        // Natural Tab follows authored order, not roving or Content focus entry.
        await page.keyboard.press('Tab');
        await focused(trigger(retained));
        const retainedIdentity = await controls(retained);
        await page.keyboard.press('Space');
        await expanded(trigger(retained), false);
        expect(await content(retained).count()).toBe(1);
        expect(await controls(retained)).toBe(retainedIdentity);
        expect(await content(retained).getAttribute('aria-hidden')).toBe('true');
        await expect.poll(() => content(retained).isVisible()).toBe(false);
        expect(
          await content(retained).evaluate((element) => getComputedStyle(element).display)
        ).toBe('none');

        // The disabled-but-open disclosure is skipped, not forcibly closed.
        await page.keyboard.press('Tab');
        await focused(trigger(controlled));
        await expanded(trigger(disabled), true);
        await expect.poll(() => content(disabled).isVisible()).toBe(true);

        // An ignored controlled request cannot optimistically open any part.
        await page.keyboard.press('Enter');
        await expanded(trigger(controlled), false);
        await absentContent(controlled);
        expect(await trigger(controlled).getAttribute('aria-controls')).toBeNull();
        await page.keyboard.press('Tab');
        const accept = previewer.getByRole('button', {
          name: 'Accept pending controlled request',
          exact: true,
        });
        await focused(accept);
        await page.keyboard.press('Enter');
        await expanded(trigger(controlled), true);
        await expect.poll(() => content(controlled).isVisible()).toBe(true);
        const controlledIdentity = await controls(controlled);
        expect(controlledIdentity).not.toBe(retainedIdentity);
        expect(controlledIdentity).not.toBe(await controls(disabled));
        await focused(accept);
        await expanded(button, false);
        await expanded(trigger(retained), false);
        await capture(previewer, `${runtime}-controlled-accepted`);

        // Changing the actual renderer terminally removes the old host views.
        // Host IDs may be reused by new owners; disconnection, not ID spelling,
        // proves the old physical views no longer belong to the live surface.
        const oldViews = await previewer.locator('.host [data-pui-root]').elementHandles();
        const nextRuntime = RUNTIMES[(RUNTIMES.indexOf(runtime) + 1) % RUNTIMES.length]!;
        await selectRuntime(page, previewer, nextRuntime, '[aria-expanded]', 4);
        for (const view of oldViews)
          expect(await view.evaluate((element) => element.isConnected)).toBe(false);
        await expanded(trigger(disclosure(previewer, 'uncontrolled')), false);
        await expanded(trigger(disclosure(previewer, 'controlled')), false);
      } finally {
        await context.close();
      }
    }, 60_000);
  }

  it('renders the Chinese narrow page through the same public disclosure', async () => {
    const { context, page, previewer } = await openRoute(
      browser,
      baseUrl,
      '/zh-cn/ui-libraries/base/collapsible/',
      { width: 390, height: 900 }
    );
    try {
      await selectRuntime(page, previewer, 'vue2', '[aria-expanded]', 4);
      const root = disclosure(previewer, 'uncontrolled');
      await trigger(root).click();
      await expanded(trigger(root), true);
      await controls(root);
      await expect.poll(() => content(root).isVisible()).toBe(true);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        )
      ).toBeLessThanOrEqual(0);
      await capture(previewer, 'vue2-zh-cn-390-open');
    } finally {
      await context.close();
    }
  }, 60_000);
});
