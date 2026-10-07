// @vitest-environment node
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { launchBrowser } from '../../../../apps/www/src/content/docs/zh-cn/browser-harness';
import type * as Fixture from './fixtures/focus-request-native';

declare global {
  interface Window {
    vueFocusRequestNative: typeof Fixture;
  }
}

let browser: Awaited<ReturnType<typeof launchBrowser>>;
let bundle: string;
beforeAll(async () => {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('./fixtures/focus-request-native.ts', import.meta.url))],
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    globalName: 'vueFocusRequestNative',
    target: 'es2022',
    define: { 'process.env.NODE_ENV': '"development"' },
  });
  bundle = result.outputFiles[0].text;
  browser = await launchBrowser();
}, 60_000);
afterAll(async () => browser?.close());

// HC-FOCUS-TARGET-0001-D and C-AS-FOCUS-ENTRY-0001-H: actual native
// focus/blur events, actual Vue lifecycle gates, and source-bound first-party UI.
it.each(['programmatic', 'native', 'entry'] as const)(
  'native Vue preserves %s request admission and observed fact ownership',
  async (kind) => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.setContent('<!doctype html><body></body>');
      await page.addScriptTag({ content: bundle });
      const result = await page.evaluate(
        (kind) => window.vueFocusRequestNative.observeFocusKind(kind),
        kind
      );
      console.info('[native-vue-focus-kind]', JSON.stringify({ kind, ...result }));
      expect(result).toEqual({
        during: [{ active: kind === 'programmatic', focused: kind === 'programmatic' }],
        after: { active: true, focused: true },
        trustedFocusEvents: 1,
      });
    } finally {
      await context.close();
    }
  }
);

it.each(['entry', 'entry-disable', 'entry-blur', 'native'] as const)(
  'native Vue follows actual nested-owner readiness and cancellation: %s',
  async (mode) => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.setContent('<!doctype html><body></body>');
      await page.addScriptTag({ content: bundle });
      const result = await page.evaluate(
        (mode) => window.vueFocusRequestNative.observeNestedOwner(mode),
        mode
      );
      console.info('[native-vue-focus-owner]', JSON.stringify({ mode, ...result }));
      const applies = mode === 'entry' || mode === 'native';
      expect(result).toEqual({
        readyControl: { active: true, focused: true },
        during: [{ active: false, focused: false }],
        after: { active: applies, focused: applies },
        trustedFocusEvents: applies ? 1 : 0,
      });
    } finally {
      await context.close();
    }
  }
);

it.each(['retained', 'terminal'] as const)(
  'native Vue re-resolves an entry after ordinary owner removal without focusing its departing node: %s',
  async (removal) => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.setContent('<!doctype html><body></body>');
      await page.addScriptTag({ content: bundle });
      const result = await page.evaluate(
        (removal) => window.vueFocusRequestNative.observeOwnerRemoval(removal),
        removal
      );
      console.info('[native-vue-focus-owner-removal]', JSON.stringify({ removal, ...result }));
      expect(result).toEqual({
        during: [{ connected: true, active: false, focused: false }],
        oldConnected: false,
        after: { active: true, focused: true },
        trustedOldFocusEvents: 0,
        trustedFallbackFocusEvents: 1,
      });
    } finally {
      await context.close();
    }
  }
);
