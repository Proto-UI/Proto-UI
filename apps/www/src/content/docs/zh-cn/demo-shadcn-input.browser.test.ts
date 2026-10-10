// @vitest-environment node

import type { Browser, Page } from 'playwright-core';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  RUNTIMES,
  applyColorScheme,
  launchBrowser,
  selectRuntime,
  startServer,
  stopServer,
} from './browser-harness';

const ROUTE = '/en/ui-libraries/shadcn/input/';
let browser: Browser;
let baseUrl = '';
let evidenceDir = '';

beforeAll(async () => {
  evidenceDir = await mkdtemp(join(tmpdir(), 'proto-shadcn-input-'));
  console.info(`[shadcn-input-evidence] ${evidenceDir}`);
  baseUrl = await startServer(ROUTE);
  browser = await launchBrowser();
}, 180_000);

afterAll(async () => {
  try {
    await browser?.close();
  } finally {
    await stopServer();
  }
}, 60_000);

async function renderedFacts(page: Page) {
  return page.evaluate(() => {
    const preview = document.querySelector<HTMLElement>('[data-previewer-id]');
    const content = preview?.querySelector<HTMLElement>('[data-projection-content]');
    if (!preview || !content) throw new Error('The Shadcn Input family preview is not ready.');
    const inputs = [...content.querySelectorAll<HTMLInputElement>('input')];
    return {
      projectionMode: preview.dataset.projectionMode,
      projectionFamily: preview.dataset.projectionFamily,
      projectionComponent: preview.dataset.projectionComponent,
      runtime: content.closest('[data-projection-scope]')?.getAttribute('data-projection-runtime'),
      physicalEditorCount: content.querySelectorAll('input,textarea,[contenteditable]').length,
      controls: inputs.map((input) => {
        const style = getComputedStyle(input);
        return {
          type: input.type,
          value: input.value,
          placeholder: input.placeholder,
          disabled: input.disabled,
          readOnly: input.readOnly,
          role: input.getAttribute('role'),
          height: input.getBoundingClientRect().height,
          width: input.getBoundingClientRect().width,
          radius: style.borderTopLeftRadius,
          borderStyle: style.borderTopStyle,
          boxShadow: style.boxShadow,
          transition: style.transitionProperty,
          cursor: style.cursor,
          caretColor: style.caretColor,
          selectionBackground: getComputedStyle(input, '::selection').backgroundColor,
          selectionColor: getComputedStyle(input, '::selection').color,
          focused: input === document.activeElement,
          nativeFocusVisible: input.matches(':focus-visible'),
          projectedFocusVisible: input.hasAttribute('data-focus-visible'),
          background: style.backgroundColor,
          styleTokens: input.getAttribute('data-pui-style'),
        };
      }),
    };
  });
}

async function selectAllTextStyle(page: Page) {
  return page
    .locator('[data-projection-content] input')
    .first()
    .evaluate((input) => {
      const textInput = input as HTMLInputElement;
      textInput.focus();
      textInput.setSelectionRange(0, textInput.value.length);
      const selectionStyle = getComputedStyle(textInput, '::selection');
      return {
        selectedText: textInput.value.slice(
          textInput.selectionStart ?? 0,
          textInput.selectionEnd ?? 0
        ),
        backgroundColor: selectionStyle.backgroundColor,
        color: selectionStyle.color,
      };
    });
}

describe.sequential('Shadcn Input rendered preview acceptance', () => {
  it.each(RUNTIMES)(
    '%s renders Base Input with the Shadcn surface',
    async (runtime) => {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        colorScheme: 'light',
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      try {
        await page.goto(`${baseUrl}${ROUTE}`, { waitUntil: 'domcontentloaded' });
        const preview = page.locator('[data-previewer-id]').first();
        try {
          await selectRuntime(page, preview, runtime, 'input', 3);
        } catch (error) {
          console.error(
            `[shadcn-input-readiness] ${JSON.stringify({
              runtime,
              browserErrors: errors,
              preview: await preview.evaluate((root) => ({
                mode: (root as HTMLElement).dataset.projectionMode,
                family: (root as HTMLElement).dataset.projectionFamily,
                component: (root as HTMLElement).dataset.projectionComponent,
                runtime:
                  root.querySelector<HTMLElement>('[data-projection-scope]')?.dataset
                    .projectionRuntime,
                state:
                  root.querySelector<HTMLElement>('[data-projection-scope]')?.dataset
                    .projectionState,
                runtimeControl: root
                  .querySelector<HTMLElement>('[data-projection-control="runtime"]')
                  ?.innerHTML.slice(0, 900),
                contentChildren: root
                  .querySelector<HTMLElement>('[data-projection-content]')
                  ?.innerHTML.slice(0, 600),
              })),
            })}`
          );
          throw error;
        }
        expect(await preview.getAttribute('data-projection-mode')).toBe('fixed-family');
        expect(await preview.getAttribute('data-projection-family')).toBe('shadcn');
        expect(await preview.getAttribute('data-projection-component')).toBe('input');

        const light = await renderedFacts(page);
        console.info(
          `[shadcn-input-style-probe] ${JSON.stringify({ runtime, control: light.controls[0] })}`
        );
        expect(light.physicalEditorCount).toBe(3);
        expect(light.controls).toHaveLength(3);
        expect(light.controls[0]).toMatchObject({
          type: 'text',
          value: 'Guang',
          placeholder: 'Your name',
          disabled: false,
          readOnly: false,
          role: 'textbox',
          height: 32,
          borderStyle: 'solid',
          cursor: 'text',
          transition: expect.stringContaining('color'),
        });
        expect(light.controls[1]).toMatchObject({
          type: 'text',
          disabled: true,
          cursor: 'not-allowed',
        });
        expect(light.controls[2]).toMatchObject({ type: 'text', readOnly: true });

        const lightSelection = await selectAllTextStyle(page);
        expect(lightSelection.selectedText).toBe('Guang');
        expect(lightSelection.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
        expect(lightSelection.color).not.toBe(light.controls[0]?.caretColor);
        if (runtime === 'wc') {
          await preview.screenshot({ path: join(evidenceDir, 'selection-light-wc.png') });
        }

        await page.locator('[data-projection-content] input').first().click();
        const focused = await renderedFacts(page);
        expect(focused.controls[0]?.focused).toBe(true);
        expect(focused.controls[0]?.projectedFocusVisible).toBe(
          focused.controls[0]?.nativeFocusVisible
        );
        if (focused.controls[0]?.nativeFocusVisible) {
          expect(focused.controls[0]?.boxShadow).not.toBe(light.controls[0]?.boxShadow);
        }

        await applyColorScheme(page, 'dark');
        const dark = await renderedFacts(page);
        expect(dark.controls[0]?.background).not.toBe(light.controls[0]?.background);
        const darkSelection = await selectAllTextStyle(page);
        expect(darkSelection.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
        expect(darkSelection.backgroundColor).not.toBe(lightSelection.backgroundColor);
        if (runtime === 'wc') {
          await preview.screenshot({ path: join(evidenceDir, 'selection-dark-wc.png') });
        }
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    },
    60_000
  );
});
