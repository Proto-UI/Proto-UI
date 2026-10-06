// @vitest-environment node
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { launchBrowser } from '../../../../apps/www/src/content/docs/zh-cn/browser-harness';
import type * as Fixture from './fixtures/focus-intent-native';

declare global {
  interface Window {
    focusIntentNative: typeof Fixture;
  }
}
let browser: Awaited<ReturnType<typeof launchBrowser>>;
let bundle: string;
beforeAll(async () => {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('./fixtures/focus-intent-native.ts', import.meta.url))],
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    globalName: 'focusIntentNative',
    target: 'es2022',
    define: { 'process.env.NODE_ENV': '"development"' },
  });
  bundle = result.outputFiles[0].text;
  browser = await launchBrowser();
}, 60_000);
afterAll(async () => browser?.close());

// HC-FOCUS-TARGET-0001-C; C-AS-FOCUSABLE-0001-G. Native proof uses real
// CSS focus rejection, frame delivery, and trusted events on isolated own UI.
for (const runtime of ['react', 'vue', 'vue2', 'wc'] as const) {
  it.each(['programmatic', 'native', 'entry'] as const)(
    `${runtime} native %s requests renew exhausted budgets only on explicit new intent`,
    async (kind) => {
      const context = await browser.newContext();
      try {
        const page = await context.newPage();
        await page.setContent('<!doctype html><body></body>');
        await page.addScriptTag({ content: bundle });
        const result = await page.evaluate(
          ({ runtime, kind }) => window.focusIntentNative.observeIntentBudget(runtime, kind),
          { runtime, kind }
        );
        console.info('[native-intent-budget]', JSON.stringify({ runtime, kind, ...result }));
        expect(result).toEqual({
          cycles: ['omitted', 'reused'].map((options) => ({
            options,
            rejected: true,
            exhaustedAfterReveal: true,
            newRejected: true,
            recovered: true,
          })),
          trustedFocusEvents: 2,
        });
      } finally {
        await context.close();
      }
    }
  );
  it(`${runtime} native descendant rejection stays bounded while its independent root remains focused`, async () => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.setContent('<!doctype html><body></body>');
      await page.addScriptTag({ content: bundle });
      const result = await page.evaluate(
        (runtime) => window.focusIntentNative.observeFocusedRootBudget(runtime),
        runtime
      );
      console.info('[native-focused-root-budget]', JSON.stringify({ runtime, ...result }));
      expect(result).toEqual({
        initialRootActive: true,
        afterBudget: {
          rootActive: true,
          rootFocused: true,
          descendantActive: false,
          trustedDescendantFocusEvents: 0,
        },
        explicitRecovery: true,
        trustedDescendantFocusEvents: 1,
      });
    } finally {
      await context.close();
    }
  });
}

for (const runtime of ['react', 'vue', 'vue2', 'wc'] as const) {
  it.each(['programmatic', 'native', 'entry'] as const)(
    `${runtime} ordinary commits preserve an exhausted %s same-view layout budget`,
    async (kind) => {
      const context = await browser.newContext();
      try {
        const page = await context.newPage();
        await page.setContent('<!doctype html><body></body>');
        await page.addScriptTag({ content: bundle });
        const result = await page.evaluate(
          ({ runtime, kind }) =>
            window.focusIntentNative.observeSameViewCommitBudget(runtime, kind),
          { runtime, kind }
        );
        console.info('[native-same-view-budget]', JSON.stringify({ runtime, kind, ...result }));
        expect(result).toEqual({
          sameRoot: true,
          rejected: true,
          commitsStillPending: [true, true],
          freshAcquired: true,
          focused: kind === 'entry' ? null : true,
          trustedFocusEvents: 1,
        });
      } finally {
        await context.close();
      }
    }
  );
}

for (const runtime of ['vue2', 'wc'] as const) {
  it.each(['programmatic', 'native', 'entry'] as const)(
    `${runtime} preserves a fresh %s request issued from onUnmounted`,
    async (kind) => {
      const context = await browser.newContext();
      try {
        const page = await context.newPage();
        await page.setContent('<!doctype html><body></body>');
        await page.addScriptTag({ content: bundle });
        const result = await page.evaluate(
          ({ runtime, kind }) => window.focusIntentNative.observeNewTeardownRequest(runtime, kind),
          { runtime, kind }
        );
        console.info('[native-new-teardown-request]', JSON.stringify({ runtime, kind, ...result }));
        expect(result.during).toHaveLength(1);
        expect(result.during[0].connected).toBe(true);
        if (kind !== 'programmatic')
          expect(result.during[0]).toEqual({ connected: true, active: false, focused: false });
        else if (runtime === 'vue2')
          expect(result.during[0]).toEqual({ connected: true, active: true, focused: true });
        else {
          // WC already hides its retained shell. If CSS rejects the programmatic
          // effect, it stays pending; acceptance must synchronize its own facts.
          expect(result.during[0].focused).toBe(result.during[0].active);
        }
        expect(result.after).toEqual({ active: true, focused: true });
        expect(result.trustedReadyFocusEvents).toBe(1);
      } finally {
        await context.close();
      }
    }
  );
}

for (const runtime of ['react', 'vue', 'vue2', 'wc'] as const) {
  it(`${runtime} preserves native blur-listener reentrant focus across the old disable stack`, async () => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.setContent('<!doctype html><body></body>');
      await page.addScriptTag({ content: bundle });
      const result = await page.evaluate(
        (runtime) => window.focusIntentNative.observeBlurReentry(runtime),
        runtime
      );
      console.info('[native-blur-reentry]', JSON.stringify({ runtime, ...result }));
      const focused = { active: true, focused: true, focusable: true };
      expect(result).toEqual({
        initial: focused,
        during: [focused],
        after: focused,
        settled: focused,
        trustedBlurEvents: 1,
        trustedFocusEvents: 2,
      });
    } finally {
      await context.close();
    }
  });
}

for (const runtime of ['react', 'vue', 'vue2', 'wc'] as const) {
  it.each(['programmatic', 'native', 'entry'] as const)(
    `${runtime} retains an exhausted %s allowance across retained hide/show`,
    async (kind) => {
      const context = await browser.newContext();
      try {
        const page = await context.newPage();
        await page.setContent('<!doctype html><body></body>');
        await page.addScriptTag({ content: bundle });
        const result = await page.evaluate(
          ({ runtime, kind }) => window.focusIntentNative.observeRetainedViewBudget(runtime, kind),
          { runtime, kind }
        );
        console.info('[native-retained-budget]', JSON.stringify({ runtime, kind, ...result }));
        expect(result).toEqual({
          rejected: true,
          retainedViewsReady: [true, true],
          replacementsStillPending: [true, true],
          freshAcquired: true,
          focused: kind === 'entry' ? null : true,
          trustedFocusEvents: 1,
        });
      } finally {
        await context.close();
      }
    }
  );
}

for (const runtime of ['react', 'vue', 'vue2', 'wc'] as const) {
  for (const mode of ['open', 'closed', 'nested'] as const) {
    for (const kind of ['programmatic', 'native', 'entry'] as const) {
      it(`native ${runtime} ${kind} accepts focus inside ${mode} shadow root`, async () => {
        const context = await browser.newContext();
        try {
          const page = await context.newPage();
          await page.setContent('<!doctype html><body></body>');
          await page.addScriptTag({ content: bundle });
          const result = await page.evaluate(
            ({ runtime, mode, kind }) =>
              window.focusIntentNative.observeShadowAcquisition(runtime, mode, kind),
            { runtime, mode, kind }
          );
          expect(result).toEqual({
            retargeted: true,
            activeInOwnRoot: true,
            knownOwner: true,
            pending: false,
            focused: true,
            trustedFocusEvents: 1,
          });
        } finally {
          await context.close();
        }
      });
    }
  }
}
for (const kind of ['programmatic', 'native', 'entry'] as const) {
  it(`native WC shadow text-control ${kind} completes without pending retries`, async () => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.setContent('<!doctype html><body></body>');
      await page.addScriptTag({ content: bundle });
      const result = await page.evaluate(
        (kind) => window.focusIntentNative.observeShadowAcquisition('wc', 'own-control', kind),
        kind
      );
      expect(result).toEqual({
        retargeted: true,
        activeInOwnRoot: true,
        knownOwner: true,
        pending: false,
        focused: true,
        trustedFocusEvents: 1,
      });
    } finally {
      await context.close();
    }
  });
}
it('native delegatesFocus keeps sibling, blur and detached ownership distinct', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.setContent('<!doctype html><body></body>');
    await page.addScriptTag({ content: bundle });
    expect(
      await page.evaluate(() => window.focusIntentNative.observeDelegatedShadowFocus())
    ).toEqual({
      delegated: { hostRetargeted: true, firstActive: true, secondActive: false },
      moved: { firstActive: false, secondActive: true },
      blurred: false,
      detached: false,
    });
  } finally {
    await context.close();
  }
});
