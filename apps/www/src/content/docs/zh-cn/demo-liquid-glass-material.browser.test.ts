// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Browser, BrowserContext, CDPSession, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { observeOwnedMaterialPaint } from './material-paint-observation';
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
let qualityWaitSequence = 0;
async function quality(value: string) {
  const sequence = ++qualityWaitSequence;
  try {
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
  } catch (error) {
    // Failure-only observation: never pause/redraw/rebind or change the original wait.
    const name = `quality-timeout-${sequence}-${value}`;
    const diagnostic: Record<string, unknown> = {
      name,
      expected: value,
      timeoutMs: 20000,
      originalError:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : { value: String(error) },
    };
    try {
      diagnostic.sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], {
        encoding: 'utf8',
        timeout: 2000,
      }).trim();
      diagnostic.sourceTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], {
        encoding: 'utf8',
        timeout: 2000,
      }).trim();
    } catch (sourceError) {
      diagnostic.sourceBindingError = String(sourceError);
    }
    try {
      diagnostic.nativeSnapshot = await page.evaluate(() => {
        const rect = (element: Element) => {
          const bounds = element.getBoundingClientRect();
          return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
        };
        const runtimes = ['wc', 'react', 'vue', 'vue2'];
        return {
          observedAtMs: performance.now(),
          theme: document.documentElement.dataset.theme,
          ready: document.documentElement.dataset.materialReady,
          fixtureError: document.documentElement.dataset.materialError,
          totalRegularNodes: document.querySelectorAll('[data-demo-ref="regular"]').length,
          // No public lease identifier is emitted by this fixture. Do not infer one
          // from a frame number, source revision or private framework internals.
          leaseIdentity: 'not exposed by the existing public diagnostics',
          runtimes: runtimes.map((runtime) => {
            const scope = document.querySelector<HTMLElement>(`[data-material-host="${runtime}"]`);
            const hosts = Array.from(
              scope?.querySelectorAll<HTMLElement>('[data-demo-ref="regular"]') ?? []
            );
            return {
              runtime,
              scopePresent: !!scope,
              scopeGeometry: scope ? rect(scope) : null,
              regularCount: hosts.length,
              hosts: hosts.map((host) => ({
                connected: host.isConnected,
                geometry: rect(host),
                quality: host.dataset.materialQuality ?? null,
                reason: host.dataset.materialReason ?? null,
                source: host.dataset.materialSource ?? null,
                frame: host.dataset.materialFrame ?? null,
                sourceRevision: host.dataset.materialSourceRevision ?? null,
                backend: host.dataset.materialBackend ?? null,
                profile: host.dataset.materialProfile ?? null,
                contact: host.dataset.materialContact ?? null,
                contactSession: host.dataset.materialContactSession ?? null,
                carrier: host.getAttribute('data-pui-material-carrier'),
              })),
              sourceCanvases: Array.from(
                scope?.querySelectorAll<HTMLCanvasElement>('[data-material-backdrop]') ?? []
              ).map((canvas) => ({
                width: canvas.width,
                height: canvas.height,
                connected: canvas.isConnected,
                geometry: rect(canvas),
              })),
            };
          }),
        };
      });
    } catch (snapshotError) {
      diagnostic.snapshotError = String(snapshotError);
    }
    try {
      // Existing fixture-owned read-only resource inspector, not a production dependency.
      diagnostic.resources = await page.evaluate(() =>
        typeof (window as any).liquidMaterialFixture?.metrics === 'function'
          ? (window as any).liquidMaterialFixture.metrics()
          : { available: false, reason: 'fixture metrics unavailable' }
      );
    } catch (resourceError) {
      diagnostic.resourceError = String(resourceError);
    }
    observations.push(diagnostic);
    if (evidence) {
      try {
        await mkdir(evidence, { recursive: true });
        // The four owned fixture scenes only; a later screenshot is not the snapshot's exact frame.
        const screenshot = await page
          .locator('.grid')
          .screenshot({ path: path.join(evidence, `${name}.png`), timeout: 5000 });
        diagnostic.screenshot = `${name}.png`;
        diagnostic.screenshotSha256 = createHash('sha256').update(screenshot).digest('hex');
      } catch (screenshotError) {
        diagnostic.screenshotError = String(screenshotError);
      }
      try {
        await writeFile(path.join(evidence, `${name}.json`), JSON.stringify(diagnostic, null, 2));
      } catch (writeError) {
        diagnostic.writeError = String(writeError);
        console.error('Material failure diagnostic could not be saved', diagnostic.writeError);
      }
    }
    throw error;
  }
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
        const first = await button.evaluate(observeOwnedMaterialPaint);
        expect(first.committed).toBe(true);
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
        const pressedPaint = await button.evaluate(observeOwnedMaterialPaint);
        expect(pressedPaint.committed).toBe(true);
        expect(pressedPaint.quality).toBe('self-optical');
        expect(pressedPaint.source).toBe('visible-app-canvas');
        const pressed = pressedPaint.image;
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
        expect((await button.evaluate(observeOwnedMaterialPaint)).image).toBe('none');
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
      const firstPaint = await page
        .locator('[data-demo-ref="regular"]')
        .first()
        .evaluate(observeOwnedMaterialPaint);
      expect(firstPaint.committed).toBe(true);
      expect(firstPaint.quality).toBe('self-optical');
      expect(firstPaint.source).toBe('visible-app-canvas');
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
            .evaluate(observeOwnedMaterialPaint)
            .then(
              (paint) =>
                paint.committed &&
                paint.quality === 'self-optical' &&
                paint.source === 'visible-app-canvas' &&
                paint.image.includes('data:image/png;base64,') &&
                paint.image !== firstPaint.image
            )
        )
        .toBe(true);
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

// Bounded diagnostic collector. These observations do not assert an optimization.
// Existing three cases above retain their original bodies, deadlines and assertions.
type ProbeRole = 'observer-off' | 'observer-on';
let ownObserverSequence = 0;

async function snapshotMaterial(page: Page) {
  return page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-material-quality]'));
    const canvases = Array.from(
      document.querySelectorAll<HTMLCanvasElement>('[data-material-backdrop]')
    );
    const fixture = (window as any).liquidMaterialFixture;
    return {
      at: performance.now(),
      url: location.href,
      visibility: document.visibilityState,
      dpr: devicePixelRatio,
      viewport: { width: innerWidth, height: innerHeight },
      previewErrorPresent: document.body.textContent?.includes('[Preview Error]') === true,
      structuredPreviewErrors: Array.from(document.querySelectorAll('[data-preview-recovery]'))
        .slice(0, 16)
        .map((n) => n.textContent?.slice(0, 1024)),
      nodesTruncated: nodes.length > 128,
      canvasesTruncated: canvases.length > 64,
      nodes: nodes.slice(0, 128).map((node) => ({
        connected: node.isConnected,
        quality: node.dataset.materialQuality ?? null,
        reason: node.dataset.materialReason ?? null,
        source: node.dataset.materialSource ?? null,
        frame: node.dataset.materialFrame ?? null,
        revision: node.dataset.materialSourceRevision ?? null,
      })),
      canvases: canvases.slice(0, 64).map((canvas) => ({
        connected: canvas.isConnected,
        width: canvas.width,
        height: canvas.height,
      })),
      // This is unavailable on real public docs. Never substitute zeros or import a second pool.
      resources:
        typeof fixture?.metrics === 'function'
          ? { available: true, value: fixture.metrics() }
          : {
              available: false,
              reason: 'No existing same-document fixture inspector on this route',
            },
    };
  });
}

async function ownBrowserGpu(browser: Browser, page: Page) {
  const session = await browser.newBrowserCDPSession();
  let failed = false;
  try {
    const info = await session.send('SystemInfo.getInfo');
    const contexts = await page.evaluate(() => {
      const actual: WebGLRenderingContext[] = (window as any).materialContexts ?? [];
      const entries = actual.slice(0, 64).map((gl) => {
        if (gl.isContextLost()) return { lost: true };
        const extension = gl.getExtension('WEBGL_debug_renderer_info');
        return {
          lost: false,
          vendor: gl.getParameter(gl.VENDOR),
          renderer: gl.getParameter(gl.RENDERER),
          unmaskedVendor: extension ? gl.getParameter(extension.UNMASKED_VENDOR_WEBGL) : null,
          unmaskedRenderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : null,
          debugAvailable: !!extension,
        };
      });
      return { actualCount: actual.length, truncated: actual.length > 64, entries };
    });
    // Deliberately omit info.commandLine, machine path and unrelated process/account metadata.
    return {
      browser: browser.version(),
      devices: info.gpu.devices,
      featureStatus: info.gpu.featureStatus ?? null,
      contexts,
      softwareRendererDetected: /swiftshader|llvmpipe|softpipe|software raster|swrast/i.test(
        JSON.stringify(contexts)
      ),
      hardwareAccelerationAccepted: false,
    };
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    try {
      await session.detach();
    } catch (error) {
      if (failed) console.error('GPU observation cleanup also failed', error);
      else throw error;
    }
  }
}

async function startPageObserver(page: Page, ownerId: string) {
  return page.evaluateHandle((ownerId) => {
    if ((window as any).__puiOwnedPerformanceProbe) throw new Error('Own probe already active');
    const frames: { at: number; interval: number }[] = [],
      longTasks: { start: number; duration: number }[] = [];
    let previous: number | null = null,
      raf = 0,
      active = true,
      truncated = false;
    const recordTasks = (entries: PerformanceEntry[]) => {
      for (const entry of entries) {
        if (longTasks.length >= 256) {
          truncated = true;
          break;
        }
        longTasks.push({ start: entry.startTime, duration: entry.duration });
      }
    };
    const supported = PerformanceObserver.supportedEntryTypes.includes('longtask');
    let observer: PerformanceObserver | null = null;
    let published: object | null = null;
    const stopAllocated = () => {
      const errors: string[] = [];
      active = false;
      try {
        cancelAnimationFrame(raf);
      } catch (error) {
        errors.push(`cancel rAF: ${error}`);
      }
      if (observer) {
        try {
          recordTasks(observer.takeRecords());
        } catch (error) {
          errors.push(`take records: ${error}`);
        }
        try {
          observer.disconnect();
        } catch (error) {
          errors.push(`disconnect: ${error}`);
        }
      }
      return errors;
    };
    const tick = (time: number) => {
      if (!active) return;
      if (previous !== null) {
        if (frames.length < 600) frames.push({ at: time, interval: time - previous });
        else truncated = true;
      }
      previous = time;
      raf = requestAnimationFrame(tick);
    };
    try {
      observer = supported
        ? new PerformanceObserver((list) => recordTasks(list.getEntries()))
        : null;
      observer?.observe({ type: 'longtask', buffered: false });
      raf = requestAnimationFrame(tick);
      const owned = {
        ownerId,
        stop() {
          const errors = stopAllocated();
          // Never remove an unknown replacement's observer ownership marker.
          if ((window as any).__puiOwnedPerformanceProbe !== published)
            throw new Error('Own performance observer identity changed');
          delete (window as any).__puiOwnedPerformanceProbe;
          if (errors.length) throw new Error(errors.join('\n'));
          return {
            ownerId,
            frames,
            longTasks,
            supported,
            truncated,
            stoppedAt: performance.now(),
            interpretation:
              'rAF intervals are not compositor FPS; long tasks do not identify function cause',
          };
        },
      };
      published = owned;
      (window as any).__puiOwnedPerformanceProbe = owned;
      // Stable handle retains only this own observer, not material or project nodes.
      return owned;
    } catch (error) {
      const cleanupErrors = stopAllocated();
      if (cleanupErrors.length)
        console.error('Own observer start cleanup also failed', cleanupErrors);
      // Allocation can fail before the marker is published. Clear only our own marker.
      if (published && (window as any).__puiOwnedPerformanceProbe === published)
        delete (window as any).__puiOwnedPerformanceProbe;
      throw error;
    }
  }, ownerId);
}

async function sampleWindow(
  browser: Browser,
  page: Page,
  pageSession: CDPSession,
  role: ProbeRole,
  name: string,
  operation: () => Promise<void>,
  inspect: () => Promise<unknown>
) {
  if (!/^[a-z0-9-]{1,80}$/.test(name)) throw new Error('Invalid own evidence name');
  if (!evidence) throw new Error('Own performance diagnostic requires an evidence directory');
  const contexts = browser.contexts();
  if (contexts.length !== 1 || contexts[0].pages().length !== 1 || contexts[0].pages()[0] !== page)
    throw new Error('Own browser-wide trace requires exactly the single owned diagnostic page');
  const observerId = `${name}-${++ownObserverSequence}`;
  const traceSession = role === 'observer-on' ? await browser.newBrowserCDPSession() : null;
  const traceEvents: unknown[] = [];
  let traceBytes = 0,
    traceTruncated = false,
    traceStarted = false,
    observerAttempted = false;
  let observerHandle: Awaited<ReturnType<typeof startPageObserver>> | null = null;
  const traceState: { completion?: Record<string, unknown> } = {};
  let traceResolve: ((value: Record<string, unknown>) => void) | null = null;
  const completion = new Promise<Record<string, unknown>>((resolve) => {
    traceResolve = resolve;
  });
  const onData = (event: { value: unknown[] }) => {
    const bytes = Buffer.byteLength(JSON.stringify(event.value));
    if (traceBytes + bytes > 16 * 1024 * 1024) {
      traceTruncated = true;
      return;
    }
    traceBytes += bytes;
    for (const item of event.value) traceEvents.push(item);
  };
  const onComplete = (event: Record<string, unknown>) => {
    traceState.completion = event;
    traceResolve?.(event);
  };
  const result: Record<string, unknown> = { role, name, started: new Date().toISOString() };
  let originalError: unknown,
    operationFailed = false;
  try {
    // Both roles share only these bounded read snapshots and Performance domain counters.
    // Performance.enable belongs to the enclosing diagnostic once, not the old three cases.
    result.before = await inspect();
    result.metricsBefore = await pageSession.send('Performance.getMetrics');
    if (traceSession) {
      traceSession.on('Tracing.dataCollected', onData);
      traceSession.on('Tracing.tracingComplete', onComplete);
      const categories = ['devtools.timeline', 'blink.user_timing', 'v8', 'cc', 'gpu'];
      const available = await traceSession.send('Tracing.getCategories');
      const missing = categories.filter((category) => !available.categories.includes(category));
      if (missing.length)
        throw new Error(`Requested trace categories unavailable: ${missing.join(',')}`);
      await traceSession.send('Tracing.start', {
        transferMode: 'ReportEvents',
        tracingBackend: 'chrome',
        traceConfig: {
          recordMode: 'recordUntilFull',
          traceBufferSizeInKb: 8192,
          enableSampling: false,
          enableSystrace: false,
          includedCategories: categories,
        },
      });
      traceStarted = true;
      observerAttempted = true;
      observerHandle = await startPageObserver(page, observerId);
    }
    // Caller uses a fixed1s idle or real hover+1s dwell, no source/policy/quality modification.
    await operation();
    result.metricsAfter = await pageSession.send('Performance.getMetrics');
    result.after = await inspect();
  } catch (error) {
    operationFailed = true;
    originalError = error;
    result.originalError = String(error);
  } finally {
    const cleanupErrors: string[] = [];
    if (observerHandle) {
      try {
        // Stop the exact allocated observer even if a foreign marker replaced it.
        // stop() cancels our work first, then reports identity drift without deleting foreign state.
        result.pageObserver = await observerHandle.evaluate((owned) => owned.stop());
      } catch (error) {
        cleanupErrors.push(`observer: ${error}`);
      } finally {
        try {
          await observerHandle.dispose();
        } catch (error) {
          cleanupErrors.push(`observer handle: ${error}`);
        }
      }
    } else if (observerAttempted) {
      try {
        await page.evaluate((observerId) => {
          if ((window as any).__puiOwnedPerformanceProbe?.ownerId === observerId)
            throw new Error('Failed observer start left its ownership marker');
        }, observerId);
      } catch (error) {
        cleanupErrors.push(`observer failed-start: ${error}`);
      }
    }
    if (traceSession) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        if (traceStarted) {
          await Promise.race([
            (async () => {
              await traceSession.send('Tracing.end');
              return completion;
            })(),
            new Promise((_, reject) => {
              timer = setTimeout(() => reject(new Error('Own trace flush exceeded5000ms')), 5000);
            }),
          ]);
        }
      } catch (error) {
        cleanupErrors.push(`trace: ${error}`);
      } finally {
        if (timer) clearTimeout(timer);
        traceSession.off('Tracing.dataCollected', onData);
        traceSession.off('Tracing.tracingComplete', onComplete);
        try {
          await traceSession.detach();
        } catch (error) {
          cleanupErrors.push(`detach: ${error}`);
        }
      }
    }
    result.ended = new Date().toISOString();
    result.cleanupErrors = cleanupErrors;
    result.trace = {
      started: traceStarted,
      eventCount: traceEvents.length,
      bytes: traceBytes,
      truncated: traceTruncated,
      completion: traceState.completion ?? null,
    };
    result.measurementAccepted = false; // An explicit validator must examine quality/counters/GPU/coverage/trace; never default green.
    if (evidence) {
      try {
        await mkdir(evidence, { recursive: true });
        await writeFile(
          path.join(evidence, `performance-${name}.json`),
          JSON.stringify(result, null, 2)
        );
        if (traceSession)
          await writeFile(
            path.join(evidence, `performance-${name}.trace.json`),
            JSON.stringify({
              traceEvents,
              incomplete:
                traceTruncated ||
                !traceState.completion ||
                traceState.completion.dataLossOccurred === true ||
                cleanupErrors.length > 0,
            })
          );
      } catch (error) {
        cleanupErrors.push(`evidence write: ${error}`);
        // Never replace the original product/operation exception with a secondary capture error.
        console.error('Own performance evidence was not fully saved', result, cleanupErrors);
      }
    }
    if (operationFailed) throw originalError;
    if (cleanupErrors.length) throw new Error(cleanupErrors.join('\n'));
  }
  return result;
}

type PublicPoolBinding = {
  url: string;
  transformedSha256: string;
  transformedBytes: number;
};

async function readPublicPool(page: Page, binding: PublicPoolBinding) {
  return page.evaluate(async (binding) => {
    if (new URL(binding.url).origin !== location.origin)
      throw new Error('Observed resource inspector is not same-origin');
    // Reuse the exact already-loaded URL, including query. No second copy,
    // guessed path, cache buster, acquire, render or production global.
    const module = await import(/* @vite-ignore */ binding.url);
    if (typeof module.inspectWebOpticalResources !== 'function')
      throw new Error('Actual public module does not expose its existing inspector');
    const actual = module.inspectWebOpticalResources(document);
    const emptyDocument = document.implementation.createHTMLDocument('owned-empty-control');
    const empty = module.inspectWebOpticalResources(emptyDocument);
    return { binding, actual, empty, documentUrl: location.href };
  }, binding);
}

function requireMaterialCounters(value: Record<string, unknown>) {
  for (const name of ['contexts', 'consumers', 'renders', 'sourcePreparations', 'sourceUploads']) {
    const count = value[name];
    if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0)
      throw new Error(`Real material counter ${name} is absent, nonfinite or zero`);
  }
  if (value.contexts !== 1 || value.lost !== false)
    throw new Error('Real document optical pool is not the single live pool');
}

function requireEmptyDocumentCounters(value: Record<string, unknown>) {
  for (const name of [
    'contexts',
    'consumers',
    'pendingImages',
    'decodedImages',
    'imagePreparations',
  ])
    if (value[name] !== 0) throw new Error(`Empty-document control leaked ${name}`);
  // No program exists for an empty document, so work fields must be absent,
  // not borrowed from the positive document or filled with invented values.
  for (const name of ['renders', 'sourcePreparations', 'sourceUploads'])
    if (Object.hasOwn(value, name)) throw new Error(`Empty-document control has program ${name}`);
}

describe('bounded public Liquid live-canvas diagnostics', () => {
  it('records actual four-runtime idle/hover work without accepting an optimization', async () => {
    if (!evidence) throw new Error('Diagnostic artifacts require PROTO_UI_MATERIAL_EVIDENCE_DIR');
    const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      timeout: 2000,
    }).trim();
    const sourceTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], {
      encoding: 'utf8',
      timeout: 2000,
    }).trim();
    const expectedSha = process.env.CANDIDATE_SHA ?? null;
    const dirty = Boolean(
      execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
        encoding: 'utf8',
        timeout: 2000,
      }).trim()
    );
    if (process.env.CI && dirty)
      throw new Error('Diagnostic must start from a clean source checkout');
    if (process.env.CI && (!expectedSha || sourceSha !== expectedSha))
      throw new Error('Diagnostic checkout does not match the actual CI candidate');
    const originalPool = execFileSync(
      'git',
      ['show', `${sourceSha}:packages/adapters/base/src/material/program-pool.ts`],
      { timeout: 2000 }
    );
    const summary: Record<string, unknown> = {
      sourceSha,
      sourceTree,
      expectedSha,
      dirty,
      browser: browser.version(),
      originalPoolSha256: createHash('sha256').update(originalPool).digest('hex'),
      started: new Date().toISOString(),
      windows: [],
      resourceObservations: [],
      captureComplete: false,
      productOptimizationAccepted: false,
      hardwareUserLagAccepted: false,
      limitations: [
        'Sequential observer-off/on windows are not a counterbalanced benchmark',
        'rAF intervals are not compositor FPS; long tasks alone do not identify causality',
        'Representative Button only; Select, heavy scenes, cold/scroll/teardown and full route inventory remain open',
        'Software or unknown GPU is diagnostic evidence, not hardware-user-lag acceptance',
        'Optical counters describe the shared document pool, not exclusive cost attributable to one Button',
      ],
    };
    const urls = new Set<string>();
    const modules = new Map<string, PublicPoolBinding>();
    const pending = new Set<Promise<void>>();
    const moduleErrors: string[] = [];
    let moduleResponses = 0,
      moduleResponsesTruncated = false;
    const onResponse = (response: import('playwright-core').Response) => {
      const url = new URL(response.url());
      if (
        url.origin !== new URL(baseUrl).origin ||
        !/\/packages\/adapters\/base\/src\/material\/program-pool\.ts$/.test(url.pathname)
      )
        return;
      moduleResponses = Math.min(moduleResponses + 1, Number.MAX_SAFE_INTEGER);
      if (moduleResponses > 16) {
        moduleResponsesTruncated = true;
        return;
      }
      urls.add(response.url());
      const task = (async () => {
        if (!response.ok() || response.request().resourceType() !== 'script')
          throw new Error('Observed pool response is not a successful script');
        const length = Number(response.headers()['content-length']);
        if (Number.isFinite(length) && length > 1024 * 1024)
          throw new Error('Pool response exceeds1MiB');
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const body = await Promise.race([
            response.body(),
            new Promise<never>((_resolve, reject) => {
              timer = setTimeout(
                () => reject(new Error('Pool response body exceeded5000ms')),
                5000
              );
            }),
          ]);
          if (body.byteLength > 1024 * 1024) throw new Error('Pool response exceeds1MiB');
          const binding = {
            url: response.url(),
            transformedBytes: body.byteLength,
            transformedSha256: createHash('sha256').update(body).digest('hex'),
          };
          const previous = modules.get(binding.url);
          if (previous && previous.transformedSha256 !== binding.transformedSha256)
            throw new Error('Same observed module URL changed bytes');
          modules.set(binding.url, binding);
          await mkdir(evidence, { recursive: true });
          await writeFile(
            path.join(evidence, `performance-pool-${binding.transformedSha256}.txt`),
            body
          );
        } finally {
          if (timer !== undefined) clearTimeout(timer);
        }
      })().catch((error) => {
        moduleErrors.push(String(error));
      });
      pending.add(task);
      void task.finally(() => pending.delete(task));
    };
    const binding = async () => {
      await Promise.all([...pending]);
      if (moduleResponsesTruncated || moduleErrors.length || urls.size !== 1 || modules.size !== 1)
        throw new Error(
          `Public pool identity unavailable/ambiguous: ${JSON.stringify({
            urls: [...urls],
            errors: moduleErrors,
            bound: modules.size,
            moduleResponses,
            moduleResponsesTruncated,
          })}`
        );
      return [...modules.values()][0];
    };
    let originalError: unknown,
      failed = false,
      performanceEnabled = false;
    page.on('response', onResponse);
    try {
      await preference('light');
      await page.goto(`${baseUrl}/en/ui-libraries/liquid-glass/button/`, {
        waitUntil: 'networkidle',
      });
      summary.initialPage = await snapshotMaterial(page);
      if (await page.getByText('[Preview Error]', { exact: false }).count())
        throw new Error('Public preview initialization failed; no material performance measured');
      await cdp.send('Performance.enable');
      performanceEnabled = true;
      const headerRuntime = page.locator('.site-header-runtime').first();
      for (const runtime of RUNTIMES) {
        await choosePreviewRuntime(page, headerRuntime, runtime);
        const panel = page.locator(`[data-adapter-panel="${runtime}"]`);
        await panel.waitFor({ state: 'visible' });
        const button = panel.getByRole('button', { name: 'Back', exact: true });
        await expect
          .poll(() => button.getAttribute('data-material-quality'), { timeout: 30000 })
          .toBe('self-optical');
        const inspect = async () => {
          const pool = await readPublicPool(page, await binding());
          const resourceObservations = summary.resourceObservations as unknown[];
          if (resourceObservations.length >= 64)
            throw new Error('Resource observation cap exceeded');
          resourceObservations.push({ runtime, at: new Date().toISOString(), pool });
          requireMaterialCounters(pool.actual);
          requireEmptyDocumentCounters(pool.empty);
          const target = await button.evaluate((node) => {
            const rect = node.getBoundingClientRect();
            return {
              connected: node.isConnected,
              quality: node.getAttribute('data-material-quality'),
              reason: node.getAttribute('data-material-reason'),
              width: rect.width,
              height: rect.height,
              hovered: node.matches(':hover'),
            };
          });
          const scene = await snapshotMaterial(page);
          const canvases = await panel.locator('[data-material-backdrop]').evaluateAll((nodes) =>
            nodes.map((node) => ({
              connected: node.isConnected,
              width: (node as HTMLCanvasElement).width,
              height: (node as HTMLCanvasElement).height,
            }))
          );
          if (
            !target.connected ||
            target.quality !== 'self-optical' ||
            target.width <= 0 ||
            target.height <= 0 ||
            !canvases.some((node) => node.connected && node.width > 0 && node.height > 0) ||
            scene.previewErrorPresent ||
            scene.nodesTruncated ||
            scene.canvasesTruncated ||
            scene.visibility !== 'visible'
          )
            throw new Error('Actual public material scene is unavailable or truncated');
          return { runtime, target, canvases, scene, pool };
        };
        const gpu = await ownBrowserGpu(browser, page);
        if (
          !gpu.contexts.actualCount ||
          gpu.contexts.truncated ||
          !gpu.contexts.entries.some((entry) => !entry.lost)
        )
          throw new Error('No complete actual material WebGL-context observation');
        await page.mouse.move(0, 0);
        const initial = await inspect();
        if (initial.target.hovered) throw new Error('Idle control starts hovered');
        const windows = [];
        for (const [role, phase] of [
          ['observer-off', 'warm-idle'],
          ['observer-on', 'warm-idle'],
          ['observer-on', 'hover'],
        ] as const) {
          const measured = await sampleWindow(
            browser,
            page,
            cdp,
            role,
            `${runtime}-${role}-${phase}`,
            async () => {
              if (phase === 'hover') await button.hover();
              await page.waitForTimeout(1000);
            },
            inspect
          );
          const before = measured.before as Awaited<ReturnType<typeof inspect>>;
          const after = measured.after as Awaited<ReturnType<typeof inspect>>;
          for (const name of [
            'renders',
            'sourceUploads',
            'sourcePreparations',
            'renderMilliseconds',
            'encodeMilliseconds',
          ]) {
            const left = before.pool.actual[name],
              right = after.pool.actual[name];
            if (
              typeof left !== 'number' ||
              typeof right !== 'number' ||
              !Number.isFinite(left) ||
              !Number.isFinite(right) ||
              left < 0 ||
              right < left
            )
              throw new Error(`Counter ${name} absent or reset within a bound window`);
          }
          if (phase === 'hover' && !after.target.hovered)
            throw new Error('Actual hover did not land on the material control');
          if (role === 'observer-on') {
            const trace = measured.trace as {
              started: boolean;
              eventCount: number;
              bytes: number;
              truncated: boolean;
              completion?: { dataLossOccurred?: boolean };
            };
            const observer = measured.pageObserver as {
              frames?: unknown[];
              truncated?: boolean;
              supported?: boolean;
            };
            if (
              !trace.started ||
              trace.eventCount <= 0 ||
              trace.bytes <= 0 ||
              trace.truncated ||
              !trace.completion ||
              trace.completion.dataLossOccurred !== false ||
              observer.truncated ||
              observer.supported !== true ||
              !observer.frames?.length
            )
              throw new Error('Bounded observer/trace evidence is incomplete');
          }
          measured.captureComplete = true;
          windows.push(measured);
        }
        await capture(`performance-public-button-${runtime}`);
        (summary.windows as unknown[]).push({ runtime, gpu, windows });
      }
      await binding();
      summary.captureComplete = true;
    } catch (error) {
      failed = true;
      originalError = error;
      summary.error = String(error);
      try {
        summary.failureSnapshot = await snapshotMaterial(page);
        await capture('performance-public-failure');
      } catch (captureError) {
        summary.failureCaptureError = String(captureError);
      }
    } finally {
      page.off('response', onResponse);
      await Promise.all([...pending]);
      const cleanupErrors: string[] = [];
      if (performanceEnabled) {
        try {
          await cdp.send('Performance.disable');
        } catch (error) {
          cleanupErrors.push(String(error));
        }
      }
      summary.ended = new Date().toISOString();
      summary.modules = [...modules.values()];
      summary.observedModuleUrls = [...urls];
      summary.moduleResponses = moduleResponses;
      summary.moduleResponsesTruncated = moduleResponsesTruncated;
      summary.moduleErrors = moduleErrors;
      summary.cleanupErrors = cleanupErrors;
      if (cleanupErrors.length || moduleErrors.length || moduleResponsesTruncated)
        summary.captureComplete = false;
      try {
        await mkdir(evidence, { recursive: true });
        await writeFile(
          path.join(evidence, 'performance-diagnostic-summary.json'),
          JSON.stringify(summary, null, 2)
        );
      } catch (error) {
        summary.captureComplete = false;
        cleanupErrors.push(`summary write: ${error}`);
        console.error(summary, error);
      }
      if (failed) throw originalError;
      if (cleanupErrors.length || moduleErrors.length || moduleResponsesTruncated)
        throw new Error(
          [
            ...cleanupErrors,
            ...moduleErrors,
            ...(moduleResponsesTruncated ? ['Pool-response observation cap exceeded'] : []),
          ].join('\n')
        );
    }
  }, 150000);
});
