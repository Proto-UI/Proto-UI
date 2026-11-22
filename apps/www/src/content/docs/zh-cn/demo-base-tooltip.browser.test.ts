// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Browser, Page } from 'playwright-core';
import { beforeAll, afterAll, expect, it } from 'vitest';
import {
  RUNTIMES,
  launchBrowser,
  openRoute,
  selectRuntime,
  startServer,
  stopServer,
} from './browser-harness';

let browser: Browser;
let baseUrl = '';
const evidence = process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR;
const firstDescription = 'View account settings and profile details.';
const secondDescription = 'Review recent alerts and notification preferences.';
const cases = (['en', 'zh-cn'] as const).flatMap((locale) =>
  RUNTIMES.map((runtime) => ({ locale, runtime }))
);

beforeAll(async () => {
  baseUrl = await startServer('/en/ui-libraries/base/tooltip/');
  browser = await launchBrowser();
}, 150_000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
});

async function focusedDescription(page: Page) {
  const session = await page.context().newCDPSession(page);
  try {
    const { result } = await session.send('Runtime.evaluate', {
      expression:
        '(() => { let e = document.activeElement; while (e?.shadowRoot?.activeElement) e = e.shadowRoot.activeElement; return e; })()',
    });
    if (!result.objectId) throw new Error('The focused Tooltip subject has no native object');
    const { nodes } = await session.send('Accessibility.getPartialAXTree', {
      objectId: result.objectId,
      fetchRelatives: false,
    });
    if (nodes.length !== 1)
      throw new Error(`Expected one native AX subject, received ${nodes.length}`);
    return {
      role: nodes[0].role?.value,
      ignored: nodes[0].ignored,
      description: nodes[0].description?.value ?? '',
    };
  } finally {
    await session.detach();
  }
}

it.each(cases)(
  '$locale Base Tooltip works through the published $runtime selector',
  async ({ locale, runtime }) => {
    const route = `/${locale}/ui-libraries/base/tooltip/`;
    const { page, context, previewer } = await openRoute(browser, baseUrl, route, {
      width: 390,
      height: 844,
    });
    const observations: unknown[] = [];
    const errors: string[] = [];
    let failure: string | null = null;
    page.on('pageerror', (error) => errors.push(error.message));
    const subject = (text: string) =>
      previewer
        .locator('.host [data-pui-root][tabindex="0"]')
        .filter({ hasText: new RegExp(`^${text}$`) });
    try {
      await selectRuntime(page, previewer, runtime, '[data-pui-root]', 7);
      const account = subject('Account');
      const notifications = subject('Notifications');
      expect(await account.count()).toBe(1);
      expect(await notifications.count()).toBe(1);
      expect(await page.getByRole('tooltip').count()).toBe(0);
      await account.focus();
      await expect.poll(() => page.getByRole('tooltip').textContent()).toBe(firstDescription);
      const first = await focusedDescription(page);
      observations.push({ stage: 'first focus', ...first });
      expect(first).toMatchObject({ ignored: false, description: firstDescription });

      // Input moves between the two real authored triggers. No wrapper or test
      // focus helper supplies the sibling's focus event on its behalf.
      await page.keyboard.press('Tab');
      expect(await notifications.evaluate((element) => document.activeElement === element)).toBe(
        true
      );
      await expect.poll(() => page.getByRole('tooltip').textContent()).toBe(secondDescription);
      expect(await page.getByRole('tooltip').count()).toBe(1);
      const second = await focusedDescription(page);
      observations.push({ stage: 'native Tab to sibling', ...second });
      expect(second.description).toBe(secondDescription);

      await page.keyboard.press('Shift+Tab');
      expect(await account.evaluate((element) => document.activeElement === element)).toBe(true);
      await expect.poll(() => page.getByRole('tooltip').textContent()).toBe(firstDescription);
      await page.keyboard.press('Escape');
      await expect.poll(() => page.getByRole('tooltip').count()).toBe(0);
      expect(await account.getAttribute('aria-describedby')).toBeNull();
      const closed = await focusedDescription(page);
      observations.push({ stage: 'Escape retains focus without description', ...closed });
      expect(closed.description).toBe('');

      // Reopen before switching so a leaked old portal cannot pass cleanup.
      await notifications.focus();
      await expect.poll(() => page.getByRole('tooltip').textContent()).toBe(secondDescription);
      const retired = await notifications.elementHandle();
      if (!retired) throw new Error('Expected the first owner before runtime replacement');
      const replacement = runtime === 'wc' ? 'react' : 'wc';
      await selectRuntime(page, previewer, replacement, '[data-pui-root]', 7);
      expect(await retired.evaluate((element) => element.isConnected)).toBe(false);
      await retired.dispose();
      await expect.poll(() => page.getByRole('tooltip').count()).toBe(0);
      await subject('Account').focus();
      await expect.poll(() => page.getByRole('tooltip').textContent()).toBe(firstDescription);
      const replaced = await focusedDescription(page);
      observations.push({ stage: 'replacement owner', runtime: replacement, ...replaced });
      expect(replaced.description).toBe(firstDescription);
      expect(errors).toEqual([]);
      if (evidence) {
        await mkdir(evidence, { recursive: true });
        await page.screenshot({ path: join(evidence, `base-tooltip-${locale}-${runtime}.png`) });
      }
    } catch (error) {
      failure = error instanceof Error ? (error.stack ?? error.message) : String(error);
      throw error;
    } finally {
      try {
        if (evidence) {
          await mkdir(evidence, { recursive: true });
          await writeFile(
            join(evidence, `base-tooltip-${locale}-${runtime}.json`),
            JSON.stringify(
              {
                testSource: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
                servedPageRevision: null,
                sourceBinding:
                  'The test checkout is recorded; the supervising release run must bind its separately served page to the same source.',
                browser: browser.version(),
                route,
                runtime,
                outcome: failure ? 'FAIL' : 'PASS',
                failure,
                errors,
                observations,
                scope:
                  'Native public documentation consumer and browser AX; not native OS assistive technology.',
              },
              null,
              2
            ) + '\n'
          );
        }
      } finally {
        await context.close();
      }
    }
  },
  90_000
);
