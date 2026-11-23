// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Browser, Locator, Page } from 'playwright-core';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { RUNTIMES, launchBrowser, selectRuntime, startServer, stopServer } from './browser-harness';

let browser: Browser;
let baseUrl = '';
const evidence = process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR;
const locales = ['en', 'zh-cn'] as const;
const routes = locales.map((locale) => '/' + locale + '/ui-libraries/base/select/');
const cases = locales.flatMap((locale) => RUNTIMES.map((runtime) => ({ locale, runtime })));
const demoSelector = '[data-demo-id="demo-base-select"]';
const triggerSelector = '[role="combobox"]';

beforeAll(async () => {
  baseUrl = await startServer(routes);
  browser = await launchBrowser();
}, 150_000);
afterAll(async () => {
  try {
    await browser?.close();
  } finally {
    await stopServer();
  }
});

const focused = (locator: Locator) =>
  locator.evaluate((element) => {
    let active: Element | null = element.ownerDocument.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    return active === element;
  });

async function selection(previewer: Locator) {
  const root = previewer.locator('.host [data-pui-root][data-value][data-text-value]');
  const state = await root.evaluate((element) => ({
    value: element.getAttribute('data-value'),
    textValue: element.getAttribute('data-text-value'),
  }));
  const value = previewer.locator('.host [data-pui-root][data-display-value]');
  return { ...state, label: (await value.textContent())?.trim() };
}

async function popup(page: Page, trigger: Locator) {
  await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('true');
  const id = await trigger.getAttribute('aria-controls');
  if (!id) throw new Error('Base Select must identify its controlled option surface.');
  const content = page.locator('[id=' + JSON.stringify(id) + ']');
  await content.waitFor({ state: 'visible' });
  expect(await content.getAttribute('role')).toBe('listbox');
  return { id, content };
}

async function nativeName(page: Page) {
  const session = await page.context().newCDPSession(page);
  try {
    const { result } = await session.send('Runtime.evaluate', {
      expression:
        'document.querySelector(\'[data-demo-id="demo-base-select"] .host [role="combobox"]\')',
    });
    if (!result.objectId) throw new Error('Base Select has no native combobox object.');
    const { nodes } = await session.send('Accessibility.getPartialAXTree', {
      objectId: result.objectId,
      fetchRelatives: false,
    });
    if (nodes.length !== 1) throw new Error('Expected one exact Base Select AX subject.');
    return {
      role: nodes[0].role?.value,
      name: nodes[0].name?.value,
      ignored: nodes[0].ignored,
    };
  } finally {
    await session.detach();
  }
}

it.each(cases)(
  '$locale Base Select preserves native selection and cleanup through the public $runtime selector',
  async ({ locale, runtime }) => {
    const route = '/' + locale + '/ui-libraries/base/select/';
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const errors: string[] = [];
    const observations: unknown[] = [];
    let failure: string | null = null;
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(baseUrl + route, { waitUntil: 'networkidle' });
      const previewer = page.locator(demoSelector);
      await previewer.waitFor({ state: 'visible' });
      await selectRuntime(page, previewer, runtime, triggerSelector, 1);
      expect(await previewer.locator('[data-runtime-tabs-mount] [role="tab"]').count()).toBe(4);
      const trigger = previewer.locator('.host').getByRole('combobox', {
        name: 'Framework selector',
        exact: true,
      });
      expect(await trigger.count()).toBe(1);
      const empty = { value: '', textValue: '', label: 'Pick a framework' };
      await expect.poll(() => selection(previewer)).toEqual(empty);
      const name = await nativeName(page);
      expect(name).toEqual({ role: 'combobox', name: 'Framework selector', ignored: false });
      observations.push({ stage: 'initial', runtime, selection: await selection(previewer), name });

      if (runtime === 'vue2') {
        const code = await previewer
          .locator('[data-code-content] code')
          .getAttribute('data-raw-code');
        expect(code).toContain("from '@proto.ui/adapter-vue2'");
        expect(code).toContain("from '@proto.ui/prototypes-base/select'");
        expect(code).toContain('accessibleLabel="Framework selector"');
      }

      // A real click supplies entry; subsequent navigation never focuses an option for the component.
      await trigger.click();
      const first = await popup(page, trigger);
      expect(
        (await first.content.locator('[role="option"]').allTextContents()).map((s) => s.trim())
      ).toEqual(['React', 'Vue', 'Web Components']);
      const option = (content: Locator, label: string) =>
        content.getByRole('option', { name: label, exact: true });
      await expect.poll(() => focused(option(first.content, 'React'))).toBe(true);
      await page.keyboard.press('ArrowDown');
      await expect.poll(() => focused(option(first.content, 'Vue'))).toBe(true);
      expect(await selection(previewer)).toEqual(empty);
      await page.keyboard.press('Enter');
      const vue = { value: 'vue', textValue: 'Vue', label: 'Vue' };
      await expect.poll(() => selection(previewer)).toEqual(vue);
      await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('false');
      await expect.poll(() => focused(trigger)).toBe(true);

      // Native selected-item reentry and transient End navigation must not commit a new value.
      await page.keyboard.press('ArrowDown');
      const second = await popup(page, trigger);
      await expect.poll(() => focused(option(second.content, 'Vue'))).toBe(true);
      expect(await option(second.content, 'Vue').getAttribute('aria-selected')).toBe('true');
      await page.keyboard.press('End');
      await expect.poll(() => focused(option(second.content, 'Web Components'))).toBe(true);
      expect(await option(second.content, 'Web Components').getAttribute('aria-selected')).toBe(
        'false'
      );
      expect(await selection(previewer)).toEqual(vue);
      await page.keyboard.press('Escape');
      await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('false');
      await expect.poll(() => focused(trigger)).toBe(true);
      expect(await selection(previewer)).toEqual(vue);
      expect(await nativeName(page)).toEqual(name);
      observations.push({
        stage: 'keyboard selection and Escape',
        selection: await selection(previewer),
      });

      await trigger.click();
      const third = await popup(page, trigger);
      await option(third.content, 'Web Components').click();
      const wc = { value: 'wc', textValue: 'Web Components', label: 'Web Components' };
      await expect.poll(() => selection(previewer)).toEqual(wc);
      await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('false');
      expect(await nativeName(page)).toEqual(name);
      observations.push({ stage: 'pointer selection', selection: await selection(previewer) });

      // Retain the actual open nodes: a new healthy render cannot conceal an old portal leak.
      await trigger.click();
      const retiring = await popup(page, trigger);
      const previousTrigger = await trigger.elementHandle();
      const previousContent = await retiring.content.elementHandle();
      const samePreviewer = await previewer.elementHandle();
      if (!previousTrigger || !previousContent || !samePreviewer)
        throw new Error('The retiring Select generation must have real native nodes.');
      const replacement = runtime === 'wc' ? 'react' : 'wc';
      await selectRuntime(page, previewer, replacement, triggerSelector, 1);
      expect(await samePreviewer.evaluate((element) => element.isConnected)).toBe(true);
      await expect
        .poll(() => previousTrigger.evaluate((element) => element.isConnected))
        .toBe(false);
      await expect
        .poll(() => previousContent.evaluate((element) => element.isConnected))
        .toBe(false);
      expect(await page.locator('[id=' + JSON.stringify(retiring.id) + ']').count()).toBe(0);
      await expect.poll(() => selection(previewer)).toEqual(empty);
      observations.push({
        stage: 'same previewer runtime replacement',
        replacement,
        retiredId: retiring.id,
      });
      await previousTrigger.dispose();
      await previousContent.dispose();
      await samePreviewer.dispose();

      // Return to this case's runtime and remove its owner while the popup is genuinely open.
      await selectRuntime(page, previewer, runtime, triggerSelector, 1);
      await trigger.click();
      const removing = await popup(page, trigger);
      const removedContent = await removing.content.elementHandle();
      if (!removedContent) throw new Error('The removed preview must own an open popup.');
      if (evidence) {
        await mkdir(evidence, { recursive: true });
        await page.screenshot({
          path: join(evidence, 'base-select-' + locale + '-' + runtime + '.png'),
        });
      }
      await previewer.evaluate((element) => element.remove());
      await expect
        .poll(() => removedContent.evaluate((element) => element.isConnected))
        .toBe(false);
      expect(await page.locator('[id=' + JSON.stringify(removing.id) + ']').count()).toBe(0);
      expect(await page.locator(demoSelector).count()).toBe(0);
      await removedContent.dispose();
      observations.push({ stage: 'removed owner releases portal', removedId: removing.id });
      expect(errors).toEqual([]);
    } catch (error) {
      failure = error instanceof Error ? (error.stack ?? error.message) : String(error);
      throw error;
    } finally {
      try {
        if (evidence) {
          await mkdir(evidence, { recursive: true });
          await writeFile(
            join(evidence, 'base-select-' + locale + '-' + runtime + '.json'),
            JSON.stringify(
              {
                testSource: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
                servedPageRevision: null,
                sourceBinding:
                  'The supervising run must bind the separately served page to this tested source.',
                browser: browser.version(),
                route,
                runtime,
                outcome: failure ? 'FAIL' : 'PASS',
                failure,
                errors,
                observations,
                scope:
                  'Native public documentation renderer, input and browser AX; not OS assistive technology.',
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
