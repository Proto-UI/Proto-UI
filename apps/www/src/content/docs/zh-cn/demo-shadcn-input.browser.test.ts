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
import { createInputEvidence, type InputEvidenceSession } from './input-visual-evidence';

const ROUTES = ['/en/ui-libraries/shadcn/input/', '/zh-cn/ui-libraries/shadcn/input/'];
let browser: Browser;
let baseUrl = '';
let evidenceDir = '';
let evidence: InputEvidenceSession;

beforeAll(async () => {
  evidenceDir = process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR
    ? join(process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR, 'shadcn-input')
    : await mkdtemp(join(tmpdir(), 'pui-input-shadcn-'));
  console.info(`[shadcn-input-evidence] ${evidenceDir}`);
  baseUrl = await startServer(ROUTES);
  browser = await launchBrowser();
  evidence = await createInputEvidence(evidenceDir, 'shadcn', browser);
}, 180_000);

afterAll(async () => {
  try {
    await browser?.close();
  } finally {
    try {
      await evidence?.finish();
    } finally {
      await stopServer();
    }
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
  for (const locale of ['en', 'zh-cn'] as const)
    it.each(RUNTIMES)(
    `${locale}/%s renders Base Input with the Shadcn surface`,
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
        const response = await page.goto(`${baseUrl}/${locale}/ui-libraries/shadcn/input/`, { waitUntil: 'domcontentloaded' });
        expect(response?.status()).toBe(200);
        await applyColorScheme(page, 'light');
        const preview = page.locator('[data-previewer-id]').first();
        const capture = async (scheme: 'light' | 'dark', state: string, observations: unknown) =>
          evidence.capture(preview, { locale, runtime, scheme, state, observations });
        try {
          await selectRuntime(page, preview, runtime, 'input', 3);
        } catch (error) {
          console.error(
            `[shadcn-input-readiness] ${JSON.stringify({
              runtime,
              locale,
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
        await capture('light', 'initial', light);

        const lightSelection = await selectAllTextStyle(page);
        expect(lightSelection.selectedText).toBe('Guang');
        expect(lightSelection.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
        expect(lightSelection.color).not.toBe(light.controls[0]?.caretColor);
        await capture('light', 'selection', { method: 'DOM focus/setSelectionRange; static selection presentation', selection: lightSelection });

        await page.locator('[data-projection-content] input').first().click();
        const focused = await renderedFacts(page);
        expect(focused.controls[0]?.focused).toBe(true);
        expect(focused.controls[0]?.projectedFocusVisible).toBe(
          focused.controls[0]?.nativeFocusVisible
        );
        if (focused.controls[0]?.nativeFocusVisible) {
          expect(focused.controls[0]?.boxShadow).not.toBe(light.controls[0]?.boxShadow);
        }
        await capture('light', 'pointer-focused', focused);

        await applyColorScheme(page, 'dark');
        const dark = await renderedFacts(page);
        expect(dark.controls[0]?.background).not.toBe(light.controls[0]?.background);
        await capture('dark', 'pointer-focused', dark);
        const darkSelection = await selectAllTextStyle(page);
        expect(darkSelection.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
        expect(darkSelection.backgroundColor).not.toBe(lightSelection.backgroundColor);
        await capture('dark', 'selection', { method: 'DOM focus/setSelectionRange; static selection presentation', selection: darkSelection });
        const inputs = page.locator('[data-projection-content] input');
        await inputs.first().press('End');
        await page.keyboard.type(' native');
        expect(await inputs.first().inputValue()).toBe('Guang native');
        await capture('dark', 'edited', await renderedFacts(page));
        await page.keyboard.press('Tab');
        expect(await inputs.nth(2).evaluate((input) => input === document.activeElement)).toBe(true);
        await page.keyboard.type('ignored');
        expect(await inputs.nth(2).inputValue()).toBe('Base keeps this focusable.');
        expect(await inputs.nth(1).inputValue()).toBe('Unavailable');
        await capture('dark', 'readonly', await renderedFacts(page));
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    },
    60_000
  );
});
