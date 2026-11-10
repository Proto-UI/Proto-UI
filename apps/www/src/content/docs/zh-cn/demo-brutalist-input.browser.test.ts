// @vitest-environment node
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Browser, Locator, Page } from 'playwright-core';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import {
  RUNTIMES,
  launchBrowser,
  startServer,
  stopServer,
  selectRuntime,
  applyColorScheme,
} from './browser-harness';
import { createInputEvidence, type InputCaptureScope, type InputEvidenceSession } from './input-visual-evidence';

const ROUTES = ['/en/ui-libraries/brutalist/components/input/', '/zh-cn/ui-libraries/brutalist/components/input/'];
let browser: Browser;
let baseUrl = '';
let evidenceDir = '';
let evidence: InputEvidenceSession;
beforeAll(async () => {
  evidenceDir =
    process.env.PROTO_UI_NEO_INPUT_EVIDENCE_DIR ??
    (process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR
      ? join(process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR, 'neo-input')
      : undefined) ??
    (await mkdtemp(join(tmpdir(), 'proto-neo-input-')));
  baseUrl = await startServer(ROUTES);
  browser = await launchBrowser();
  evidence = await createInputEvidence(evidenceDir, 'brutalist', browser);
  console.info(`[neo-input-evidence] ${evidenceDir} ${JSON.stringify({
    sourceSha: evidence.source.sourceSha,
    sourceDirty: evidence.source.sourceDirty,
    sourceTreeSha256: evidence.source.sourceTreeSha256,
    upstream:
      'ekmas/neobrutalism-components@3306a802724874a85f93079702b2795370a279d4/src/components/ui/input.tsx',
  })}`);
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

async function facts(page: Page) {
  return page.locator('[data-projection-content] input').evaluateAll((inputs) =>
    inputs.map((element) => {
      const input = element as HTMLInputElement;
      const css = getComputedStyle(input);
      const rect = input.getBoundingClientRect();
      return {
        value: input.value,
        disabled: input.disabled,
        readOnly: input.readOnly,
        height: rect.height,
        width: rect.width,
        fontSize: css.fontSize,
        lineHeight: css.lineHeight,
        paddingInline: css.paddingInlineStart,
        paddingBlock: css.paddingTop,
        border: css.borderTopWidth,
        boxShadow: css.boxShadow,
        ringColor: css.getPropertyValue('--pui-ring-color').trim(),
        focused: document.activeElement === input,
        nativeFocusVisible: input.matches(':focus-visible'),
        projectedFocusVisible: input.hasAttribute('data-focus-visible'),
        opacity: css.opacity,
        cursor: css.cursor,
        left: rect.left,
        right: rect.right,
      };
    })
  );
}
async function capture(preview: Locator, scope: InputCaptureScope) {
  const receipt = await evidence.capture(preview, scope);
  console.info(`[neo-input-capture] ${JSON.stringify({
    image: receipt.image,
    screenshotSha256: receipt.screenshotSha256,
  })}`);
}

describe.sequential('Standalone Neo Input real-consumer acceptance', () => {
  for (const locale of ['en', 'zh-cn'] as const)
    it.each(RUNTIMES)(
    `${locale}/%s editing, focus, disabled/readOnly, light/dark and 320px/200%% root font`,
    async (runtime) => {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        colorScheme: 'light',
      });
      const page = await context.newPage();
      try {
        const response = await page.goto(`${baseUrl}/${locale}/ui-libraries/brutalist/components/input/`, { waitUntil: 'domcontentloaded' });
        expect(response?.status()).toBe(200);
        await applyColorScheme(page, 'light');
        const preview = page.locator('[data-previewer-id]').first();
        await selectRuntime(page, preview, runtime, 'input', 3);
        expect(await preview.getAttribute('data-projection-family')).toBe('brutalist');
        const inputs = page.locator('[data-projection-content] input');
        await expect.poll(async () => inputs.count()).toBe(3);
        expect(
          await page
            .locator(
              '[data-projection-content] textarea,[data-projection-content] [contenteditable]'
            )
            .count()
        ).toBe(0);
        const baseline = await facts(page);
        expect(baseline[0]).toMatchObject({
          value: 'Guang',
          disabled: false,
          readOnly: false,
          height: 40,
          fontSize: '14px',
          lineHeight: '20px',
          paddingInline: '12px',
          paddingBlock: '8px',
          border: '2px',
        });
        expect(baseline[1]).toMatchObject({
          disabled: true,
          opacity: '0.5',
          cursor: 'not-allowed',
        });
        expect(baseline[2]).toMatchObject({ readOnly: true });
        await capture(preview, { locale, runtime, scheme: 'light', state: 'initial', observations: baseline });
        await inputs.first().click();
        await inputs.first().fill('Edited with real browser input');
        expect(await inputs.first().inputValue()).toBe('Edited with real browser input');
        await capture(preview, { locale, runtime, scheme: 'light', state: 'edited', observations: await facts(page) });
        await page.keyboard.press('Tab');
        expect(await inputs.nth(2).evaluate((el) => document.activeElement === el)).toBe(true);
        await page.keyboard.type('ignored');
        expect(await inputs.nth(2).inputValue()).toBe('Base keeps this focusable.');
        await capture(preview, { locale, runtime, scheme: 'light', state: 'readonly', observations: await facts(page) });
        await page.keyboard.press('Shift+Tab');
        expect(await inputs.first().evaluate((el) => document.activeElement === el)).toBe(true);
        await expect.poll(async () => (await facts(page))[0].projectedFocusVisible).toBe(true);
        for (const scheme of ['light', 'dark'] as const) {
          await applyColorScheme(page, scheme);
          // Theme switch controls can move focus; restore through keyboard navigation.
          await inputs.nth(2).focus();
          await page.keyboard.press('Shift+Tab');
          const focused = (await facts(page))[0];
          expect(focused.focused).toBe(true);
          expect(focused.projectedFocusVisible).toBe(focused.nativeFocusVisible);
          expect(focused.boxShadow).not.toBe('none');
          expect(['#000', '#000000', 'rgb(0, 0, 0)']).toContain(focused.ringColor);
          await capture(preview, { locale, runtime, scheme, state: 'focused', observations: await facts(page) });
        }
        // Synthetic event transport coverage only. Native composition/OS candidate
        // windows require a separate real-IME run, never inferred from this probe.
        await inputs.first().evaluate((element) => {
          const input = element as HTMLInputElement;
          input.dispatchEvent(
            new CompositionEvent('compositionstart', { bubbles: true, data: '候' })
          );
          input.value = '候选';
          input.dispatchEvent(
            new InputEvent('input', {
              bubbles: true,
              data: '选',
              inputType: 'insertCompositionText',
              isComposing: true,
            })
          );
          input.dispatchEvent(
            new CompositionEvent('compositionupdate', { bubbles: true, data: '候选' })
          );
          input.dispatchEvent(
            new CompositionEvent('compositionend', { bubbles: true, data: '候选' })
          );
        });
        expect(await inputs.first().inputValue()).toBe('候选');
        await capture(preview, { locale, runtime, scheme: 'dark', state: 'composition-events', observations: { method: 'Synthetic CompositionEvent/InputEvent and DOM value injection; no native IME claim', controls: await facts(page) } });
        await page.setViewportSize({ width: 320, height: 900 });
        await capture(preview, { locale, runtime, scheme: 'dark', state: '320-text100', observations: await facts(page) });
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '200%';
        });
        for (const scheme of ['dark', 'light'] as const) {
          await applyColorScheme(page, scheme);
          const enlarged = await facts(page);
          expect(enlarged[0]).toMatchObject({
            height: 80,
            fontSize: '28px',
            lineHeight: '40px',
            paddingInline: '24px',
            paddingBlock: '16px',
          });
          for (const control of enlarged) {
            expect(control.left).toBeGreaterThanOrEqual(0);
            expect(control.right).toBeLessThanOrEqual(320);
          }
          await capture(preview, { locale, runtime, scheme, state: '320-text200', observations: enlarged });
        }
      } finally {
        await context.close();
      }
    },
    120_000
  );
});
