// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import type { Browser, ElementHandle } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  bindNativeTooltipHandoff,
  prepareTooltipHandoffProbe,
} from '../../../../scripts/contrast-tooltip-handoff-driver';
import {
  compileTooltipWarmHandoffPlan,
  TOOLTIP_WARM_HANDOFF_STATE,
} from '../../../../scripts/contrast-tooltip-handoff.mjs';
import { PROJECTION_FAMILY_MANIFESTS } from '../../../components/PrototypePreviewer/projection-families';
import { surfacePrototypeId } from '../../../components/surface-recipes';
import { launchBrowser, choosePreviewRuntime, applyColorScheme } from './browser-harness';
import tooltipDemo from './demo-brutalist-tooltip.demo';

const RUNTIMES = ['wc', 'react', 'vue'] as const;
const THEMES = ['light', 'dark'] as const;
const ROUTE = '/en/ui-libraries/brutalist/components/tooltip/';
let browser: Browser;
let probeCode = '';
let handoffCode = '';

beforeAll(async () => {
  // Main supervises the source-bound server. This consumer never starts a
  // second server or substitutes an inline mock for the actual authored page.
  if (!process.env.PROTO_UI_BROWSER_BASE_URL)
    throw new Error('Set PROTO_UI_BROWSER_BASE_URL to the independently supervised docs server.');
  probeCode = (await transform(
    await readFile(new URL('../../../../scripts/contrast-probe.browser.ts', import.meta.url), 'utf8'),
    { loader: 'ts', format: 'iife', globalName: 'puiContrastProbe', keepNames: false }
  )).code;
  handoffCode = (await prepareTooltipHandoffProbe()).code;
  browser = await launchBrowser();
}, 30_000);

afterAll(async () => {
  await browser?.close();
});

async function openConsumer(runtime: (typeof RUNTIMES)[number], theme: (typeof THEMES)[number]) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);
    const response = await page.goto(`${process.env.PROTO_UI_BROWSER_BASE_URL}${ROUTE}`, { waitUntil: 'networkidle' });
    if (!response?.ok()) throw new Error('Tooltip consumer route did not load.');
    const previewer = page.locator('[data-previewer-id][data-demo-id="demo-brutalist-tooltip"]');
    expect(await previewer.count()).toBe(1);
    await previewer.waitFor({ state: 'visible' });
    const serializedRuntimes = await previewer.getAttribute('data-runtimes');
    const plan = compileTooltipWarmHandoffPlan(tooltipDemo, serializedRuntimes);
    expect(plan.cells).toContainEqual({ runtime, theme });
    await choosePreviewRuntime(page, previewer, runtime);
    await previewer.locator(`[data-projection-scope][data-projection-runtime="${runtime}"][data-projection-state="ready"]`).waitFor({ state: 'attached' });
    await applyColorScheme(page, theme);
    await previewer.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await page.addScriptTag({ content: probeCode });
    await page.addScriptTag({ content: handoffCode });
    const handle = await previewer.elementHandle();
    const previewerId = await previewer.getAttribute('data-previewer-id');
    if (!handle || !previewerId || !serializedRuntimes) throw new Error('Missing physical Tooltip subject.');
    const manifest = PROJECTION_FAMILY_MANIFESTS.brutalist.families.tooltip;
    const consumer = await bindNativeTooltipHandoff(page, {
      previewer: handle as ElementHandle<HTMLElement>,
      previewerId,
      expected: {
        recipeId: manifest.recipeId,
        contentRecipeId: `website-runtime-preview:${manifest.recipeId}`,
        shellPrototypeId: surfacePrototypeId('brutalist'),
        serializedRuntimes,
        family: 'tooltip', runtime,
        rootPrototypeId: manifest.parts.root.prototypeId,
        prototypeIds: manifest.recipePrototypeIds,
      },
    }, plan);
    return {
      context, page, consumer, plan,
      async close() {
        try { await consumer.dispose(); }
        finally {
          try { await handle.dispose(); }
          finally { await context.close(); }
        }
      },
    };
  } catch (error) {
    await context.close();
    throw error;
  }
}

// These are native input/DOM/paint-model consumers. The contrast audit's actual
// source-bound PNG/facts journal is a separate required run, not a mock here.
describe('Tooltip contrast warm sibling consumer', () => {
  for (const runtime of RUNTIMES) for (const theme of THEMES) {
    it(`${runtime}/${theme}: preserves cold delay, then hands off the same Group without reset`, async () => {
      const fixture = await openConsumer(runtime, theme);
      try {
        const observations: Record<string, unknown>[] = [];
        const record: Record<string, unknown> = {};
        await fixture.consumer.run(async (state) => {
          const observation = await fixture.consumer.observe(state === TOOLTIP_WARM_HANDOFF_STATE ? 'warm' : 'cold');
          expect(observation.achieved, state).toBe(true);
          expect(observation.samePhysicalGroup, state).toBe(true);
          expect(observation.pairs.every((pair) => pair.samePhysicalRoot && pair.samePhysicalTrigger), state).toBe(true);
          observations.push({ state, observation });
        }, record);
        const warm = await fixture.consumer.observe('warm');
        expect(warm.pairs[0].closed).toBe(true);
        expect(warm.pairs[0].painted).toBe(false);
        expect(warm.pairs[1].content?.achieved).toBe(true);
        expect(warm.pairs[0].descriptions).not.toContain(warm.pairs[0].contentId);
        expect(warm.pairs[1].descriptions).toContain(warm.pairs[1].contentId);
        expect(warm.pairs[1].contentId).not.toBe(warm.pairs[0].contentId);
        expect(warm.timing?.nativePointerEnter).toBe(true);
        expect(warm.timing?.firstPaintMs).toBeLessThan(fixture.plan.warmDeadlineMs);
        expect(observations.map((item) => item.state)).toEqual(['hover', 'hover-open', TOOLTIP_WARM_HANDOFF_STATE]);
        expect(record.stage).toBe('captured');
      } finally { await fixture.close(); }
    }, 30_000);
  }

  it('rejects an absent physical Group without sending corrective input', async () => {
    const fixture = await openConsumer('wc', 'light');
    try {
      await fixture.consumer.binding.evaluate((value) => value.group.removeAttribute('data-projection-prototype'));
      await expect(fixture.consumer.arm('cold')).rejects.toThrow(/shared Group|physical lease/);
    } finally { await fixture.close(); }
  }, 30_000);

  it('rejects replacement of an original Root despite copied public identity', async () => {
    const fixture = await openConsumer('wc', 'light');
    try {
      await fixture.consumer.binding.evaluate((value) => {
        const original = value.pairs[0].root;
        const replacement = document.createElement('div');
        for (const attribute of original.attributes) replacement.setAttribute(attribute.name, attribute.value);
        original.replaceWith(replacement);
      });
      await expect(fixture.consumer.arm('cold')).rejects.toThrow(/authored Root|view retired/);
    } finally { await fixture.close(); }
  }, 30_000);

  it('rejects an ended Root view even when the same physical node and lease attributes return', async () => {
    const fixture = await openConsumer('wc', 'light');
    try {
      await fixture.consumer.binding.evaluate((value) => {
        const root = value.pairs[0].root;
        const parent = root.parentElement;
        if (!parent) throw new Error('The authored Root has no live parent.');
        root.remove();
        parent.append(root);
      });
      await expect(fixture.consumer.arm('cold')).rejects.toThrow(/view retired|physical lease/);
    } finally { await fixture.close(); }
  }, 30_000);

  for (const fault of ['replaced-trigger', 'replaced-content', 'foreign-content', 'stale-lease'] as const) {
    it(`rejects ${fault} between cold opening and warm handoff`, async () => {
      const fixture = await openConsumer('wc', 'light');
      try {
        await fixture.consumer.arm('cold');
        await fixture.consumer.hover(0);
        expect((await fixture.consumer.wait('cold'))?.achieved).toBe(true);
        await fixture.consumer.binding.evaluate((value, fault) => {
          if (fault === 'stale-lease') {
            value.scope.dataset.projectionGeneration = `${value.generation}-retired`;
            return;
          }
          const original = fault === 'replaced-trigger' ? value.pairs[1].trigger : value.pairs[0].content?.node;
          if (!original) throw new Error('The cold native consumer did not bind first Content.');
          if (fault === 'foreign-content') {
            original.dataset.projectionOwner = 'injected-foreign-owner';
            return;
          }
          // An inert replacement avoids constructing a second custom-element
          // Runtime. Its same IDs/lease attributes must still be rejected.
          const replacement = document.createElement('div');
          for (const attribute of original.attributes) replacement.setAttribute(attribute.name, attribute.value);
          replacement.textContent = original.textContent;
          original.replaceWith(replacement);
        }, fault);
        await expect(fixture.consumer.arm('warm')).rejects.toThrow(/replaced|foreign|lease|view retired|current/);
      } finally { await fixture.close(); }
    }, 30_000);
  }

  it('rejects a painted first Content retained after the second native opening', async () => {
    const fixture = await openConsumer('wc', 'light');
    try {
      await fixture.consumer.run(async (state) => {
        const phase = state === TOOLTIP_WARM_HANDOFF_STATE ? 'warm' : 'cold';
        expect((await fixture.consumer.observe(phase)).achieved, state).toBe(true);
      }, {});
      await fixture.consumer.binding.evaluate((value) => {
        const content = value.pairs[0].content?.node;
        if (!content) throw new Error('First physical Content was never bound.');
        if (!content.isConnected) value.pairs[0].root.append(content);
        content.style.cssText = 'display:block!important;visibility:visible!important;opacity:1!important;position:fixed!important;left:40px!important;top:120px!important;width:260px!important;height:60px!important;background:white!important;color:black!important;transform:none!important;filter:none!important;clip:auto!important;clip-path:none!important;transition:none!important;animation:none!important;';
      });
      const after = await fixture.consumer.observe('warm');
      expect(after.pairs[0].painted).toBe(true);
      expect(after.pairs[1].painted).toBe(true);
      expect(after.achieved).toBe(false);
    } finally { await fixture.close(); }
  }, 30_000);

  for (const runtime of RUNTIMES) {
    it(`${runtime}: rejects a second paint delayed to the authored cold budget`, async () => {
      const fixture = await openConsumer(runtime, 'light');
      try {
        await fixture.consumer.arm('cold');
        await fixture.consumer.hover(0);
        expect((await fixture.consumer.wait('cold'))?.achieved).toBe(true);
        await fixture.consumer.binding.evaluate((value) => {
          const first = value.pairs[0].content;
          if (!first) throw new Error('First physical Content was never bound.');
          const style = document.createElement('style');
          style.textContent = `[data-pui-root][data-projection-prototype="brutalist-tooltip-content"][data-projection-owner=${JSON.stringify(value.owner)}]:not([id=${JSON.stringify(first.id)}]) { opacity: 0 !important; }`;
          document.head.append(style);
          value.pairs[1].trigger.addEventListener('pointerenter', (event) => {
            if (!event.isTrusted) throw new Error('The delay injection needs a native second intent.');
            // This integration counterexample needs the native platform clock:
            // a fake timer would erase the actual cold/warm input distinction.
            // The real Group stays untouched; this is not a product defect.
            window.setTimeout(() => style.remove(), value.plan.openDelay);
          }, { capture: true, once: true });
        });
        await fixture.consumer.arm('warm');
        await fixture.consumer.hover(1);
        await expect(fixture.consumer.wait('warm')).rejects.toThrow(/cold-delay path/);
        const failed = await fixture.consumer.observe('warm');
        expect(failed.achieved).toBe(false);
        expect(failed.timing?.nativePointerEnter).toBe(true);
        expect(failed.pairs[1].open).toBe(true);
        expect(failed.pairs[1].painted).toBe(false);
        // The injected cold wait eventually paints, yet remains failed: late
        // success cannot retroactively satisfy the original warm deadline.
        await expect.poll(async () => (await fixture.consumer.observe('warm')).pairs[1].painted).toBe(true);
        expect((await fixture.consumer.observe('warm')).achieved).toBe(false);
      } finally { await fixture.close(); }
    }, 30_000);
  }
});
