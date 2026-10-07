// @vitest-environment node
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { launchBrowser } from '../../../../apps/www/src/content/docs/zh-cn/browser-harness';
import type * as Fixture from './fixtures/focus-entry-native';

declare global {
  interface Window {
    focusEntryNative: typeof Fixture;
  }
}

let browser: Awaited<ReturnType<typeof launchBrowser>>;
let bundle: string;
beforeAll(async () => {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('./fixtures/focus-entry-native.ts', import.meta.url))],
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    globalName: 'focusEntryNative',
    target: 'es2022',
    define: { 'process.env.NODE_ENV': '"development"' },
  });
  bundle = result.outputFiles[0].text;
  browser = await launchBrowser();
}, 60_000);
afterAll(async () => browser?.close());

for (const completion of ['apply', 'entry-disable', 'explicit-blur'] as const) {
  it(`native descendant entry observes actual owner readiness and ${completion}`, async () => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.setContent('<!doctype html><body></body>');
      await page.addScriptTag({ content: bundle });
      const result = await page.evaluate(
        (completion) => window.focusEntryNative.observeEntryOwner(completion),
        completion
      );
      console.info('[native-entry-owner]', JSON.stringify({ completion, ...result }));
      expect(result).toEqual({
        readyControl: { active: true, focused: true },
        during: [{ active: false, focused: false }],
        after: { active: completion === 'apply', focused: completion === 'apply' },
        trustedFocusEvents: completion === 'apply' ? 1 : 0,
      });
    } finally {
      await context.close();
    }
  });
}

it('native connected descendant entry gets fresh retries after each actual CSS rejection and success', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.setContent('<!doctype html><body></body>');
    await page.addScriptTag({ content: bundle });
    const result = await page.evaluate(() => window.focusEntryNative.observeRepeatedEntry());
    console.info('[native-entry-retry]', JSON.stringify(result));
    expect(result.cycles).toEqual(
      Array.from({ length: 4 }, () => ({ connected: true, rejected: true, acquired: true }))
    );
    expect(result.exhausted).toBe(true);
    expect(result.supersedingRejected).toBe(true);
    expect(result.supersedingAcquired).toBe(true);
  } finally {
    await context.close();
  }
});

it.each(['programmatic', 'native', 'entry'] as const)(
  'native host preserves the approved %s request/fact rule',
  async (kind) => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.setContent('<!doctype html><body></body>');
      await page.addScriptTag({ content: bundle });
      const result = await page.evaluate(
        (kind) => window.focusEntryNative.observeFocusKind(kind),
        kind
      );
      console.info('[native-focus-kind]', JSON.stringify({ kind, ...result }));
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

it.each(['retained-hide', 'terminal-unmount'] as const)(
  'native entry re-resolves after ordinary owner %s without focusing the departing node',
  async (mode) => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.setContent('<!doctype html><body></body>');
      await page.addScriptTag({ content: bundle });
      const result = await page.evaluate(
        (mode) => window.focusEntryNative.observeOrdinaryOwnerDisposal(mode),
        mode
      );
      console.info('[native-entry-owner-disposal]', JSON.stringify({ mode, ...result }));
      expect(result.oldConnected).toBe(false);
      expect(result.oldFocusEvents).toBe(0);
      expect(result.fallbackActive).toBe(true);
      expect(result.fallbackFocused).toBe(true);
      expect(result.trustedFallbackFocusEvents).toBe(1);
    } finally {
      await context.close();
    }
  }
);
