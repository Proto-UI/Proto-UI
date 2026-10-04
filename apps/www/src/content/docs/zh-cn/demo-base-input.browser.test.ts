// @vitest-environment node
import type { Browser } from 'playwright-core';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RUNTIMES, launchBrowser, selectRuntime, startServer, stopServer } from './browser-harness';

let browser: Browser;
let baseUrl = '';
let evidenceDir = '';
beforeAll(async () => {
  evidenceDir = await mkdtemp(join(tmpdir(), 'proto-base-input-'));
  console.info('[base-input-evidence] ' + evidenceDir);
  baseUrl = await startServer(['/en/ui-libraries/base/input/', '/zh-cn/ui-libraries/base/input/']);
  browser = await launchBrowser();
}, 180_000);
afterAll(async () => {
  try {
    await browser?.close();
  } finally {
    await stopServer();
  }
}, 60_000);

// P-BASE-INPUT-PHYSICAL-TARGET, VALUE-OWNERSHIP, A11Y-AND-FOCUS, BOUNDARY.
// Real reader controls and actual editors; no fabricated preview state.
describe.sequential('Base Input live documentation RuntimeBox', () => {
  for (const locale of ['en', 'zh-cn'])
    it.each(RUNTIMES)(
      locale + '/%s: real Base editors and runtime replacement',
      async (runtime) => {
        const context = await browser.newContext({ viewport: { width: 960, height: 800 } });
        // Explicit unavailable-CDN condition, not a mocked framework or editor.
        const blockedFrameworkRequests: string[] = [];
        await context.route('https://esm.sh/**', async (route) => {
          blockedFrameworkRequests.push(route.request().url());
          await route.abort('blockedbyclient');
        });
        const page = await context.newPage();
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        try {
          const response = await page.goto(baseUrl + '/' + locale + '/ui-libraries/base/input/', {
            waitUntil: 'domcontentloaded',
          });
          expect(response?.status()).toBe(200);
          const preview = page.locator('[data-previewer-id]').first();
          // A reader reveals the lazy preview before operating its runtime control.
          await preview.scrollIntoViewIfNeeded();
          try {
            await selectRuntime(page, preview, runtime, 'input', 4);
          } catch (error) {
            console.error(
              '[base-input-readiness] ' +
                JSON.stringify({
                  locale,
                  runtime,
                  errors,
                  facts: await preview.evaluate((root) => ({
                    mode: (root as HTMLElement).dataset.projectionMode,
                    hostHTML: root.querySelector('.host')?.innerHTML.slice(0, 3600),
                    roots: [...root.querySelectorAll('[data-pui-root]')].map(
                      (node) => node.tagName
                    ),
                    physicalInputs: root.querySelectorAll('input').length,
                    runtimeControl: root
                      .querySelector('[data-adapter-select-root]')
                      ?.outerHTML.slice(0, 900),
                  })),
                })
            );
            await preview.screenshot({
              path: join(evidenceDir, locale + '-' + runtime + '-readiness-failed.png'),
            });
            throw error;
          }
          const host = preview.locator('.host');
          expect(await host.locator('input,textarea,[contenteditable]').count()).toBe(4);
          expect(
            await host
              .locator('input')
              .evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).type))
          ).toEqual(Array(4).fill('text'));
          const editable = host.getByRole('textbox', { name: 'Editable Base Input', exact: true });
          const controlled = host.getByRole('textbox', {
            name: 'Controlled Base Input',
            exact: true,
          });
          const disabled = host.getByRole('textbox', { name: 'Disabled Base Input', exact: true });
          const readonly = host.getByRole('textbox', { name: 'Read-only Base Input', exact: true });
          expect(await editable.inputValue()).toBe('Edit this Base Input');
          expect(await controlled.inputValue()).toBe('Owner-controlled value');
          expect(await disabled.isDisabled()).toBe(true);
          expect(await readonly.getAttribute('readonly')).not.toBeNull();
          await preview.screenshot({
            path: join(evidenceDir, locale + '-' + runtime + '-initial.png'),
          });
          await editable.fill('Uncontrolled edit');
          expect(await editable.inputValue()).toBe('Uncontrolled edit');
          await controlled.fill('Controlled accepted');
          await expect.poll(async () => controlled.inputValue()).toBe('Controlled accepted');
          await expect
            .poll(async () => host.locator('[data-demo-ref="status"]').textContent())
            .toBe('Owner accepted: Controlled accepted');
          await readonly.focus();
          expect(await readonly.evaluate((element) => element === document.activeElement)).toBe(
            true
          );
          await readonly.press('End');
          await readonly.press('x');
          expect(await readonly.inputValue()).toBe('Read-only value');
          expect(await disabled.inputValue()).toBe('Unavailable');
          const hints = await editable.evaluate((element) => {
            const input = element as HTMLInputElement;
            return {
              type: input.type,
              name: input.name,
              inputMode: input.inputMode,
              enterKeyHint: input.enterKeyHint,
              minLength: input.minLength,
              maxLength: input.maxLength,
            };
          });
          expect(hints).toEqual({
            type: 'text',
            name: 'protocol-note',
            inputMode: 'text',
            enterKeyHint: 'done',
            minLength: 1,
            maxLength: 120,
          });
          await preview.screenshot({
            path: join(evidenceDir, locale + '-' + runtime + '-edited.png'),
          });
          const replacement = runtime === 'react' ? 'vue' : 'react';
          await selectRuntime(page, preview, replacement, 'input', 4);
          expect(await host.locator('input,textarea,[contenteditable]').count()).toBe(4);
          expect(
            await host
              .getByRole('textbox', { name: 'Editable Base Input', exact: true })
              .inputValue()
          ).toBe('Edit this Base Input');
          expect(
            await host
              .getByRole('textbox', { name: 'Controlled Base Input', exact: true })
              .inputValue()
          ).toBe('Owner-controlled value');
          expect(errors).toEqual([]);
          expect(blockedFrameworkRequests).toEqual([]);
        } finally {
          await context.close();
        }
      },
      90_000
    );
});
