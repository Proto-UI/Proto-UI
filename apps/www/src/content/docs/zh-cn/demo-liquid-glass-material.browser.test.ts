// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Browser, BrowserContext, CDPSession, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  launchBrowser,
  startServer,
  stopServer,
  RUNTIMES,
  choosePreviewRuntime,
} from './browser-harness';
const ROUTE = '/en/test/liquid-glass-material/';
const evidence = process.env.PROTO_UI_MATERIAL_EVIDENCE_DIR;
let browser: Browser,
  context: BrowserContext,
  page: Page,
  cdp: CDPSession,
  baseUrl = '';
const observations: unknown[] = [];
const safe = {
  'prefers-reduced-motion': 'no-preference',
  'prefers-reduced-transparency': 'no-preference',
  'prefers-contrast': 'no-preference',
  'forced-colors': 'none',
};
async function preference(theme: string, overrides: Record<string, string> = {}) {
  await cdp.send('Emulation.setEmulatedMedia', {
    features: Object.entries({ ...safe, 'prefers-color-scheme': theme, ...overrides }).map(
      ([name, value]) => ({ name, value })
    ),
  });
}
async function capture(name: string) {
  if (evidence) {
    await mkdir(evidence, { recursive: true });
    await page.screenshot({ path: path.join(evidence, `${name}.png`), fullPage: true });
  }
}
async function quality(value: string) {
  await page.waitForFunction(
    (expected) =>
      Array.from(document.querySelectorAll<HTMLElement>('[data-demo-ref="regular"]')).length ===
        4 &&
      Array.from(document.querySelectorAll<HTMLElement>('[data-demo-ref="regular"]')).every(
        (el) => el.dataset.materialQuality === expected
      ),
    value,
    { timeout: 20000 }
  );
}
beforeAll(async () => {
  baseUrl = await startServer(ROUTE);
  browser = await launchBrowser();
  context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  // Only this owned fixture and its same-origin assets may be requested.
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === new URL(baseUrl).origin
      ? route.continue()
      : route.abort()
  );
  await context.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    const contexts: WebGLRenderingContext[] = [];
    (window as any).materialContexts = contexts;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      kind: string,
      ...args: any[]
    ): any {
      const result = (original as any).call(this, kind, ...args);
      if (kind === 'webgl' && result && !contexts.includes(result)) contexts.push(result);
      return result;
    } as typeof original;
  });
  page = await context.newPage();
  cdp = await context.newCDPSession(page);
}, 150000);
afterAll(async () => {
  if (evidence) {
    await mkdir(evidence, { recursive: true });
    await writeFile(
      path.join(evidence, 'metadata.json'),
      JSON.stringify(
        {
          sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
          route: ROUTE,
          node: process.version,
          browser: browser?.version(),
          runtimes: RUNTIMES,
          scope:
            'V2 self-optical over visible dynamic app-owned canvas. No arbitrary DOM/compositor capture, native or Apple equivalence.',
          observations,
        },
        null,
        2
      )
    );
  }
  await context?.close();
  await browser?.close();
  await stopServer();
}, 60000);
describe.sequential('V2 optical paint through four real Web Adapter runtimes', () => {
  for (const theme of ['light', 'dark'] as const)
    it(`${theme}: visible dynamic source, optical pixels, motion, input and revocation`, async () => {
      await preference(theme);
      await page.goto(`${baseUrl}${ROUTE}?theme=${theme}`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.materialReady, undefined, {
        timeout: 60000,
      });
      await quality('self-optical');
      await page.evaluate(() => (window as any).liquidMaterialFixture.pause(true));
      await capture(`${theme}-four-web-optics`);
      for (const runtime of RUNTIMES) {
        const host = page.locator(`[data-material-host="${runtime}"]`),
          button = host.getByRole('button', { name: 'Regular action', exact: true });
        const first = await button.evaluate((el) => ({
          image: (el as HTMLElement).style.backgroundImage,
          quality: (el as HTMLElement).dataset.materialQuality,
          source: (el as HTMLElement).dataset.materialSource,
          blur: getComputedStyle(el).backdropFilter,
          canvas: el.querySelectorAll('canvas').length,
        }));
        expect(first.quality).toBe('self-optical');
        expect(first.source).toBe('visible-app-canvas');
        expect(first.blur).toBe('none');
        expect(first.canvas).toBe(0);
        expect(first.image).toContain('data:image/png');
        const zero = await page.evaluate(
          (runtime) => (window as any).liquidMaterialFixture.zeroRefraction(runtime),
          runtime
        );
        expect(first.image).not.toContain(zero);
        if (evidence) {
          await writeFile(
            path.join(evidence, `${theme}-${runtime}-optical-rest.png`),
            Buffer.from(first.image.slice(5, -2).split(',')[1], 'base64')
          );
          await writeFile(
            path.join(evidence, `${theme}-${runtime}-zero-refraction.png`),
            Buffer.from(zero.split(',')[1], 'base64')
          );
          await host
            .getByRole('button', { name: 'Opaque action', exact: true })
            .screenshot({ path: path.join(evidence, `${theme}-${runtime}-opaque.png`) });
        }

        expect(
          await host
            .getByRole('button', { name: 'Opaque action', exact: true })
            .getAttribute('data-material-quality')
        ).toBe('opaque-fallback');
        await button.hover();
        await page.mouse.down();
        await button.waitFor({ state: 'visible' });
        await page.waitForFunction(
          (selector) =>
            document.querySelector<HTMLElement>(selector)?.dataset.materialPhase === 'pressed',
          `[data-material-host="${runtime}"] [data-demo-ref="regular"]`
        );
        const pressed = await button.evaluate((el) => (el as HTMLElement).style.backgroundImage);
        expect(pressed).not.toBe(first.image);
        const changed = await page.evaluate(
          async ({ a, b }) => {
            async function decode(css: string) {
              const image = new Image();
              image.src = css.slice(5, -2);
              await image.decode();
              const canvas = document.createElement('canvas');
              canvas.width = image.width;
              canvas.height = image.height;
              const ctx = canvas.getContext('2d')!;
              ctx.drawImage(image, 0, 0);
              return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            }
            const x = await decode(a),
              y = await decode(b);
            let count = 0;
            if (x.length !== y.length) throw new Error('Optical image dimensions changed');
            for (let i = 0; i < x.length; i += 4)
              if (
                Math.abs(x[i] - y[i]) +
                  Math.abs(x[i + 1] - y[i + 1]) +
                  Math.abs(x[i + 2] - y[i + 2]) >
                3
              )
                count++;
            return count;
          },
          { a: first.image, b: pressed }
        );
        expect(changed).toBeGreaterThan(20);
        await capture(`${theme}-${runtime}-pressed`);
        await page.mouse.up();
        await button.focus();
        await page.keyboard.press('Space');
        await page.keyboard.press('Enter');
        await expect
          .poll(() => page.locator(`[data-activations="${runtime}"]`).textContent())
          .not.toBe('0 activations');
        await page.evaluate(
          (runtime) => (window as any).liquidMaterialFixture.source(runtime, false),
          runtime
        );
        await expect
          .poll(() => button.getAttribute('data-material-quality'))
          .toBe('opaque-fallback');
        expect(await button.evaluate((el) => (el as HTMLElement).style.backgroundImage)).toBe(
          'none'
        );
        await capture(`${theme}-${runtime}-source-lost`);
        await page.evaluate(
          (runtime) => (window as any).liquidMaterialFixture.source(runtime, true),
          runtime
        );
        await expect.poll(() => button.getAttribute('data-material-quality')).toBe('self-optical');
        // A sibling overlay is not present in the source canvas and must reject sampling.
        await button.evaluate((el) => {
          const block = document.createElement('div');
          block.dataset.materialNegative = '';
          const r = el.getBoundingClientRect(),
            root = el.closest('[data-material-scene]')!,
            s = root.getBoundingClientRect();
          Object.assign(block.style, {
            position: 'absolute',
            left: `${r.left - s.left}px`,
            top: `${r.top - s.top}px`,
            width: '20px',
            height: '20px',
            background: 'red',
          });
          root.append(block);
        });
        await expect
          .poll(() => button.getAttribute('data-material-reason'))
          .toBe('source-overlapping-content');
        await host.locator('[data-material-negative]').evaluate((el) => el.remove());
        await expect.poll(() => button.getAttribute('data-material-quality')).toBe('self-optical');
        observations.push({
          theme,
          runtime,
          requested: 'liquid-glass',
          backend: 'self-optical',
          source: 'visible-app-canvas',
          pressPixelsChanged: true,
          sourceLossRecovered: true,
          overlapRejected: true,
        });
      }
      await preference(theme, { 'prefers-reduced-motion': 'reduce' });
      await quality('self-optical');
      await expect
        .poll(() =>
          page.locator('[data-demo-ref="regular"]').first().getAttribute('data-material-motion')
        )
        .toBe('static');
      await preference(theme, { 'prefers-reduced-transparency': 'reduce' });
      await quality('opaque-fallback');
      await capture(`${theme}-reduced-transparency`);
      await preference(theme);
      await quality('self-optical');
      // Moving the same controls must resample the same visible source coordinates.
      const firstImage = await page
        .locator('[data-demo-ref="regular"]')
        .first()
        .evaluate((el) => (el as HTMLElement).style.backgroundImage);
      await page
        .locator('[data-demo-ref="regular"]')
        .first()
        .evaluate((el) => {
          (el as HTMLElement).style.position = 'relative';
          (el as HTMLElement).style.left = '5px';
        });
      await expect
        .poll(() =>
          page
            .locator('[data-demo-ref="regular"]')
            .first()
            .evaluate((el) => (el as HTMLElement).style.backgroundImage)
        )
        .not.toBe(firstImage);
      await page.setViewportSize({ width: 1100, height: 1000 });
      await quality('self-optical');
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 1100,
        height: 1000,
        deviceScaleFactor: 2,
        mobile: false,
      });
      await quality('self-optical');
      await capture(`${theme}-dpr-two`);
      await cdp.send('Emulation.clearDeviceMetricsOverride');
      await quality('self-optical');
      await page.setViewportSize({ width: 1440, height: 1050 });
      await quality('self-optical');
      // Same-generation inputs are shared, and >16 surfaces keep one live rendering context.
      const beforeStress = await page.evaluate(() =>
        (window as any).liquidMaterialFixture.metrics()
      );
      await page.evaluate(() => (window as any).liquidMaterialFixture.stress(20));
      await expect
        .poll(() =>
          page.locator('[data-material-stress] [data-material-quality="self-optical"]').count()
        )
        .toBe(20);
      const afterStress = await page.evaluate(() =>
        (window as any).liquidMaterialFixture.metrics()
      );
      expect(afterStress.contexts).toBe(1);
      expect(afterStress.consumers).toBeGreaterThan(16);
      expect(afterStress.pendingImages + afterStress.decodedImages).toBeLessThanOrEqual(
        afterStress.consumers
      );
      expect(afterStress.peakPendingImages).toBeLessThanOrEqual(afterStress.consumers);
      expect(afterStress.sourceUploads - beforeStress.sourceUploads).toBeLessThan(8);
      await page.waitForTimeout(300); // Let the finite DOM/ResizeObserver delivery settle.
      const staticStart = await page.evaluate(() =>
        (window as any).liquidMaterialFixture.metrics()
      );
      await page.waitForTimeout(500);
      const staticEnd = await page.evaluate(() => (window as any).liquidMaterialFixture.metrics());
      expect(staticEnd.renders).toBe(staticStart.renders);
      await capture(`${theme}-twenty-surface-shared-context`);
      const canLose = await page.evaluate(() => {
        const extension = (window as any).materialContexts[0].getExtension('WEBGL_lose_context');
        (window as any).materialLoss = extension;
        extension?.loseContext();
        return !!extension;
      });
      expect(canLose).toBe(true);
      await quality('opaque-fallback');
      await page.evaluate(() => (window as any).materialLoss.restoreContext());
      await quality('self-optical');
      observations.push({
        theme,
        beforeStress,
        afterStress,
        staticStart,
        staticEnd,
        sharedContextLossRecovered: true,
      });
      await page.evaluate(() => (window as any).liquidMaterialFixture.dispose());
      expect(await page.locator('[data-material-backdrop]').count()).toBe(0);
      expect(
        await page.evaluate(() => (window as any).liquidMaterialFixture.metrics())
      ).toMatchObject({ contexts: 0, pendingImages: 0, decodedImages: 0 });
    }, 150000);
  it('the actual public Button documentation uses the same optical path on all four runtime panels', async () => {
    await preference('light');
    await page.goto(`${baseUrl}/en/ui-libraries/liquid-glass/button/`, {
      waitUntil: 'networkidle',
    });
    const headerRuntime = page.locator('.site-header-runtime').first();
    for (const runtime of RUNTIMES) {
      await choosePreviewRuntime(page, headerRuntime, runtime);
      const panel = page.locator(`[data-adapter-panel="${runtime}"]`);
      await panel.waitFor({ state: 'visible' });
      const button = panel.getByRole('button', { name: 'Back', exact: true });
      await expect
        .poll(() => button.getAttribute('data-material-quality'), { timeout: 30000 })
        .toBe('self-optical');
      expect(
        await panel
          .locator('.liquid-functional-demo')
          .evaluate((el) => getComputedStyle(el).backgroundImage)
      ).toBe('none');
      expect(await panel.locator('[data-material-backdrop]').count()).toBeGreaterThan(0);
      await button.click();
      await expect.poll(() => panel.getByRole('status').textContent()).not.toBe('0 activations');
      await capture(`public-button-${runtime}`);
      observations.push({
        publicRoute: '/en/ui-libraries/liquid-glass/button/',
        runtime,
        quality: 'self-optical',
        actualPreviewer: true,
        baseActivation: true,
      });
    }
  }, 150000);
});
