// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
// Liquid Glass is 0.4/WIP, same opt-in shape as PUI_ASYNC_REGION_INCLUDE_WIP.
// These cases stay authored; they are not a 0.3 gate unless explicitly included.
// Unset does not register them: browser CI rejects status 'skipped'.
const includeLiquidWip = process.env.PUI_LIQUID_GLASS_INCLUDE_WIP === '1';
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
    if (includeLiquidWip) it(
      `${theme}: visible dynamic source, optical pixels, motion, input and revocation`,
      async () => {
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
      },
      150000
    );
  it('the actual public Button documentation uses the same optical path on all four runtime panels', async () => {
    await preference('light');
    await page.goto(`${baseUrl}/en/ui-libraries/liquid-glass/button/`, {
      waitUntil: 'networkidle',
    });
    const headerRuntime = page.locator('.site-header-runtime').first();
    for (const runtime of RUNTIMES) {
      await choosePreviewRuntime(page, headerRuntime, runtime);
      const panel = page.locator(`[data-adapter-panel="${runtime}"]`).filter({
        has: page.locator(
          '.proto-previewer[data-demo-id="demo-liquid-glass-button"][data-projection-toolbar="true"]'
        ),
      });
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

  if (includeLiquidWip) it(
    'preserves authored theme tokens through a real WC portal and native observer cleanup',
    async () => {
    if (!evidence)
      throw new Error('Theme ownership artifacts require PROTO_UI_MATERIAL_EVIDENCE_DIR');
    const directory = path.join(evidence, 'theme-ownership');
    await mkdir(directory, { recursive: true });
    const files = [
      'pnpm-lock.yaml',
      'apps/www/src/components/PrototypePreviewer/projection-composition.ts',
      'apps/www/src/components/PrototypePreviewer/projection-theme.ts',
      'apps/www/src/components/PrototypePreviewer/projection-families.ts',
      'apps/www/src/components/PrototypePreviewer/demo-renderer.ts',
      'apps/www/src/components/PrototypePreviewer/demo-types.ts',
      'apps/www/src/components/PrototypePreviewer/prototype-modules.ts',
      'apps/www/src/components/PrototypePreviewer/wc-registry.ts',
      'apps/www/src/components/PrototypePreviewer/preview-material-scene.ts',
      'apps/www/src/content/docs/demo-liquid-glass-dropdown-menu.demo.ts',
      'packages/prototypes/liquid-glass/src/dropdown/content.proto.ts',
      'packages/prototypes/liquid-glass/src/theme.ts',
      'packages/prototypes/base/src/dropdown/content.proto.ts',
      'packages/adapters/web-component/src/adapt.ts',
      'packages/adapters/web-component/src/props.ts',
      'packages/adapters/web-component/src/shadow-profile.ts',
      'packages/adapters/web-component/src/portal-mount.ts',
      'packages/adapters/web-component/src/runtime/modules.ts',
      'packages/adapters/base/src/material/sink.ts',
      'apps/www/src/pages/en/test/liquid-glass-material.astro',
      'apps/www/src/content/docs/zh-cn/browser-harness.ts',
      'apps/www/src/content/docs/zh-cn/demo-liquid-glass-material.browser.test.ts',
      '.github/workflows/liquid-glass-frame-budget.yml',
    ];
    const identity = async () => ({
      head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      tree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim(),
      status: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
      selectedSourceHashes: Object.fromEntries(
        await Promise.all(
          files.map(async (file) => [
            file,
            createHash('sha256')
              .update(await readFile(file))
              .digest('hex'),
          ])
        )
      ),
    });
    const report: Record<string, any> = {
      schemaVersion: 1,
      scope:
        'Candidate-only WC projection theme ownership; not a latency sample or cross-adapter portal certification.',
      inputBoundary:
        'Real Playwright pointer clicks and Escape key. Theme changes and the distinct CSS value/priority overwrite are explicit programmatic consumer inputs; no synthetic pointer/key event, manual reparent, forced stamp or observer delivery.',
      ownershipLimit:
        'A different value or priority is observable. An external write of the same value and priority is indistinguishable and is not claimed here.',
      physicalLifetime:
        'The default non-split WC Dropdown uses its persistent Custom Element as the presentation target. Its real portal unmount invokes revoke with restoreToOrigin=true and restores that same element at its retained origin marker. This does not require other adapters to retain a physical node.',
      opticalBoundary:
        'The authored foreground can legitimately reject optical admission. Material quality/reason/source and document resource observations are retained; optical success and document-wide zero resources are not this ownership oracle.',
      cleanupOwnership:
        'The Website caller explicitly stops its theme watcher before rendered.destroy. Only the latter owns the composition marker observer and supplementary stamps. Harness host removal occurs after product cleanup assertions.',
      nativeObserverObservation:
        'A temporary wrapper of the real MutationObserver.prototype.disconnect records the actual caller stack and disposal phase, preserving native this/arguments/return/exception. It does not replace observers or callbacks, consume mutation records, or make this a timing measurement.',
      sharedObserverBoundary:
        'The marker observer is Document-shared. Physical disconnect is expected here only because a freshly navigated standalone material fixture has no existing projection composition and this case creates exactly one. A remaining registration in a multi-scope document need not disconnect its shared observer.',
      checkpoints: [],
      failures: [],
      console: [],
      pageErrors: [],
      sourceAtStart: await identity(),
    };
    const failure = (stage: string, error: unknown) =>
      report.failures.push({
        stage,
        name: error instanceof Error ? error.name : typeof error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    const onConsole = (message: any) =>
      report.console.push({
        type: message.type(),
        text: message.text(),
        location: message.location(),
      });
    const onError = (error: Error) =>
      report.pageErrors.push({
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    page.on('console', onConsole);
    page.on('pageerror', onError);
    let fixture: import('playwright-core').JSHandle<any> | undefined;
    let stage = 'source-preflight';
    const snapshot = () => fixture!.evaluate((value) => value.snapshot());
    const checkpoint = async (name: string) => {
      const value = await snapshot();
      report.checkpoints.push({ name, ...value });
      return value;
    };
    const screenshot = async (name: string) => {
      const target = await fixture!.evaluateHandle((value) => value.surface as HTMLElement);
      try {
        const element = target.asElement();
        if (!element) throw new Error('Normalized Content presentation surface is unavailable.');
        const buffer = await element.screenshot({
          path: path.join(directory, `${name}.png`),
          timeout: 5000,
        });
        (report.screenshots ??= []).push({
          file: `${name}.png`,
          sha256: createHash('sha256').update(buffer).digest('hex'),
          note: 'Captured after the named checkpoint; not its exact render timestamp.',
        });
      } finally {
        await target.dispose();
      }
    };
    const authored = (value: any) => {
      expect(value.surface.inline['--pui-foreground']).toEqual({ value: '#aabbcc', priority: '' });
      expect(value.authoredTreeUnchanged).toBe(true);
      expect(value.canonicalDemoUnchanged).toBe(true);
      expect(value.surface.id).toBe(value.retainedSurfaceId);
      expect(value.surface.owner).toBe('liquid-theme-native-owner');
      expect(value.surface.generation).toBe('1');
      expect(value.surface.prototype).toBe('liquid-glass-dropdown-content');
    };
    try {
      expect(report.sourceAtStart.status).toBe('');
      if (process.env.CANDIDATE_SHA)
        expect(report.sourceAtStart.head).toBe(process.env.CANDIDATE_SHA);
      await preference('light', { 'prefers-reduced-motion': 'reduce' });
      await page.setViewportSize({ width: 1200, height: 1050 });
      await page.goto(`${baseUrl}${ROUTE}`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.materialReady, undefined, {
        timeout: 30000,
      });
      await page.evaluate(() => (window as any).liquidMaterialFixture.dispose());
      stage = 'mount-real-composition';
      fixture = await page.evaluateHandle(async () => {
        type DemoChild = import('../../../components/PrototypePreviewer/demo-types').DemoChild;
        type DemoSpec = import('../../../components/PrototypePreviewer/demo-types').DemoSpec;
        type DemoSetupContext =
          import('../../../components/PrototypePreviewer/demo-types').DemoSetupContext;
        const load = new Function('url', 'return import(url)') as (url: string) => Promise<any>;
        const { createProjectionComposition } = (await load(
          '/src/components/PrototypePreviewer/projection-composition.ts'
        )) as typeof import('../../../components/PrototypePreviewer/projection-composition');
        const { renderDemo } = (await load(
          '/src/components/PrototypePreviewer/demo-renderer.ts'
        )) as typeof import('../../../components/PrototypePreviewer/demo-renderer');
        const { collectPrototypeIds } = (await load(
          '/src/components/PrototypePreviewer/demo-types.ts'
        )) as typeof import('../../../components/PrototypePreviewer/demo-types');
        const { loadPrototypes } = (await load(
          '/src/components/PrototypePreviewer/prototype-modules.ts'
        )) as typeof import('../../../components/PrototypePreviewer/prototype-modules');
        const { resolveProjectionThemeSurfaceStyle, watchProjectionThemeSurfaceStyle } =
          (await load(
            '/src/components/PrototypePreviewer/projection-theme.ts'
          )) as typeof import('../../../components/PrototypePreviewer/projection-theme');
        const { default: canonical } = (await load(
          '/src/content/docs/demo-liquid-glass-dropdown-menu.demo.ts'
        )) as { default: DemoSpec };
        const canonicalBefore = JSON.stringify(canonical.root);
        const findProto = (
          node: DemoChild,
          prototypeId: string
        ): Extract<DemoChild, { kind: 'proto' }> | undefined => {
          if (typeof node === 'string' || node.kind === 'text') return undefined;
          if (node.kind === 'proto' && node.prototypeId === prototypeId) return node;
          for (const child of node.children ?? []) {
            const found = findProto(child, prototypeId);
            if (found) return found;
          }
          return undefined;
        };
        const originalRoot = findProto(canonical.root, 'liquid-glass-dropdown-root');
        if (!originalRoot) throw new Error('Canonical Liquid Dropdown Root is missing.');
        const root = structuredClone(originalRoot);
        const content = findProto(root, 'liquid-glass-dropdown-content');
        const trigger = findProto(root, 'liquid-glass-dropdown-trigger');
        if (!content || !trigger) throw new Error('Canonical Liquid Dropdown parts are missing.');
        root.ref = 'theme-owner-root';
        content.ref = 'theme-owner-content';
        trigger.ref = 'theme-owner-trigger';
        content.surfaceStyle = [
          ...(Array.isArray(content.surfaceStyle)
            ? content.surfaceStyle
            : content.surfaceStyle
              ? [content.surfaceStyle]
              : []),
          { '--pui-foreground': '#aabbcc', color: 'var(--pui-foreground)' },
        ];
        const declaredBefore = JSON.stringify(content.surfaceStyle);
        const host = document.createElement('div');
        // A construction failure can precede the returned JSHandle. Preserve a
        // test-owned abort receipt and release every actually acquired owner.
        const abortSteps: Array<() => void | Promise<void>> = [];
        const observerDisconnections: Array<Record<string, unknown>> = [];
        let observationPhase = 'mount';
        const observerPrototype = MutationObserver.prototype;
        const originalDisconnect = observerPrototype.disconnect;
        const observedDisconnect: MutationObserver['disconnect'] = function (
          this: MutationObserver,
          ...args: Parameters<MutationObserver['disconnect']>
        ) {
          const entry = {
            at: performance.now(),
            phase: observationPhase,
            stack: new Error('Native observer disconnect callsite').stack,
          };
          try {
            const result = Reflect.apply(originalDisconnect, this, args);
            observerDisconnections.push({ ...entry, outcome: 'returned' });
            return result;
          } catch (error) {
            observerDisconnections.push({ ...entry, outcome: 'threw', error: String(error) });
            throw error;
          }
        };
        observerPrototype.disconnect = observedDisconnect;
        const restoreDisconnect = () => {
          if (observerPrototype.disconnect !== observedDisconnect)
            throw new Error('Native disconnect observation was replaced by another writer.');
          observerPrototype.disconnect = originalDisconnect;
        };
        abortSteps.push(restoreDisconnect);
        (window as any).liquidThemeOwnershipAbort = async () => {
          const errors: string[] = [];
          for (const cleanup of [...abortSteps].reverse()) {
            try {
              await cleanup();
            } catch (error) {
              errors.push(String(error));
            }
          }
          delete (window as any).liquidThemeOwnershipAbort;
          return {
            acquiredCleanupSteps: abortSteps.length,
            errors,
            hostConnected: host.isConnected,
          };
        };
        abortSteps.push(() => host.remove());
        host.dataset.themeOwnershipCase = '';
        host.dataset.theme = 'light';
        host.style.cssText = 'margin:24px;padding:32px;max-width:900px;min-height:160px;';
        document.body.append(host);
        const palettes = {
          light: resolveProjectionThemeSurfaceStyle('liquid-glass', host),
          dark: {} as Record<string, string>,
        };
        host.dataset.theme = 'dark';
        palettes.dark = resolveProjectionThemeSurfaceStyle('liquid-glass', host);
        host.dataset.theme = 'light';
        const observerPrecondition = {
          route: location.pathname,
          preexistingProjectionScopes: document.querySelectorAll('[data-projection-scope]').length,
          preexistingProjectionOwnerSurfaces: document.querySelectorAll(
            '[class*="pui-projection-owner-"]'
          ).length,
        };
        if (
          observerPrecondition.preexistingProjectionScopes ||
          observerPrecondition.preexistingProjectionOwnerSurfaces
        )
          throw new Error(
            'Shared observer scenario precondition: this fresh standalone document already has a projection composition.'
          );
        let context: DemoSetupContext | undefined;
        const composition = createProjectionComposition({
          ownerId: 'liquid-theme-native-owner',
          generation: 1,
          runtimeId: 'wc',
          projectionFamilyId: 'liquid-glass',
          componentId: 'dropdown-menu',
          childDemo: {
            type: 'demo',
            root,
            setup(value) {
              context = value;
            },
          },
          themeSurfaceStyle: palettes.light,
          controlIds: [],
          controls: {
            runtime: {
              label: 'Runtime',
              options: [{ value: 'wc', label: 'WC' }],
              onValueChange() {},
            },
            family: {
              label: 'Family',
              options: [{ value: 'liquid-glass', label: 'Liquid' }],
              onValueChange() {},
            },
            component: {
              label: 'Component',
              options: [{ value: 'dropdown-menu', label: 'Dropdown' }],
              onValueChange() {},
            },
          },
        });
        const projected = findProto(composition.demo.root, 'liquid-glass-dropdown-content')!;
        const projectedRoot = findProto(composition.demo.root, 'liquid-glass-dropdown-root')!;
        const ownerMarker = projected.className
          ?.split(/\s+/)
          .find((value) => value.startsWith('pui-projection-owner-'));
        const generationMarker = projected.className
          ?.split(/\s+/)
          .find((value) => value.startsWith('pui-projection-generation-'));
        const marker = (node: typeof projected) =>
          node.className
            ?.split(/\s+/)
            .find((value) => value.startsWith('pui-projection-prototype-'));
        const contentMarker = marker(projected),
          rootMarker = marker(projectedRoot);
        if (!ownerMarker || !generationMarker || !contentMarker || !rootMarker)
          throw new Error('Projection-owned presentation markers are missing.');
        const ids = new Set<string>();
        collectPrototypeIds(composition.demo.root, ids);
        await loadPrototypes([...ids]);
        const rendered = await renderDemo({ runtime: 'wc', host, demo: composition.demo });
        abortSteps.push(() => rendered.destroy());
        const surfaces = (prototypeMarker: string) =>
          Array.from(document.getElementsByClassName(prototypeMarker)).filter(
            (element): element is HTMLElement =>
              element instanceof HTMLElement &&
              element.classList.contains(ownerMarker) &&
              element.classList.contains(generationMarker)
          );
        const candidates = surfaces(contentMarker),
          roots = surfaces(rootMarker);
        if (candidates.length !== 1 || roots.length !== 1)
          throw new Error(
            'Expected exactly one normalized WC Content and Root presentation surface.'
          );
        const surface = candidates[0]!,
          rootSurface = roots[0]!;
        const publicRef = context?.refs['theme-owner-content'];
        // Preview WC uses its standard, non-split Dropdown profile. Do not apply
        // this physical-node oracle to a split target or another renderer.
        if (!publicRef || publicRef !== surface)
          throw new Error(
            'WC scenario precondition: public Content ref is not this standard persistent presentation surface.'
          );
        const originParent = surface.parentNode;
        if (!originParent || !rootSurface.contains(surface))
          throw new Error(
            'WC scenario precondition: Content does not start beneath its declared Root.'
          );
        const identities = new WeakMap<Node, number>();
        let nextIdentity = 0;
        const id = (node: Node | null | undefined) => {
          if (!node) return null;
          if (!identities.has(node)) identities.set(node, ++nextIdentity);
          return identities.get(node)!;
        };
        const retainedSurfaceId = id(surface);
        const properties = ['--pui-foreground', '--pui-background', '--pui-border'];
        const describe = (element: HTMLElement) => {
          const computed = getComputedStyle(element),
            rect = element.getBoundingClientRect();
          return {
            id: id(element),
            tag: element.tagName,
            connected: element.isConnected,
            parent: id(element.parentNode),
            owner: element.dataset.projectionOwner,
            generation: element.dataset.projectionGeneration,
            prototype: element.dataset.projectionPrototype,
            classes: [...element.classList],
            role: element.getAttribute('role'),
            inline: Object.fromEntries(
              properties.map((property) => [
                property,
                {
                  value: element.style.getPropertyValue(property),
                  priority: element.style.getPropertyPriority(property),
                },
              ])
            ),
            computed: Object.fromEntries(
              [...properties, 'color', 'display', 'visibility'].map((property) => [
                property,
                computed.getPropertyValue(property).trim(),
              ])
            ),
            bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            material: {
              quality: element.dataset.materialQuality,
              reason: element.dataset.materialReason,
              frame: element.dataset.materialFrame,
              contact: element.dataset.materialContact,
              session: element.dataset.materialSession,
              source: element.dataset.materialSource,
              sourceRevision: element.dataset.materialSourceRevision,
            },
          };
        };
        const trace: unknown[] = [],
          themeEvents: unknown[] = [],
          inputs: Array<Record<string, unknown>> = [];
        let overflow = false,
          mutationRecords = 0,
          destroyed = false,
          themeStopped = false;
        const snapshot = () => ({
          at: performance.now(),
          theme: host.dataset.theme,
          retainedSurfaceId,
          surface: describe(surface),
          root: describe(rootSurface),
          publicRef: { id: id(publicRef), sameAsSurface: publicRef === surface },
          originParentId: id(originParent),
          currentSurfaceIds: surfaces(contentMarker).map(id),
          rootContainsSurface: rootSurface.contains(surface),
          restoredToOrigin: surface.parentNode === originParent,
          ownedConnectedNodes: document.getElementsByClassName(ownerMarker).length,
          authoredTreeUnchanged: JSON.stringify(projected.surfaceStyle) === declaredBefore,
          canonicalDemoUnchanged: JSON.stringify(canonical.root) === canonicalBefore,
          themeCallbackCount: themeEvents.length,
          destroyed,
          themeStopped,
          documentResourceObservation: (window as any).liquidMaterialFixture.metrics(),
          canvases: Array.from(host.querySelectorAll('canvas[data-material-backdrop]')).map(
            (canvas) => ({
              id: id(canvas),
              connected: canvas.isConnected,
              width: (canvas as HTMLCanvasElement).width,
              height: (canvas as HTMLCanvasElement).height,
            })
          ),
        });
        const record = (kind: string, details?: unknown) => {
          if (trace.length >= 400) {
            overflow = true;
            return;
          }
          trace.push({ kind, details, snapshot: snapshot() });
        };
        const belongs = (node: Node) =>
          node === host ||
          (node instanceof Element &&
            (node.classList.contains(ownerMarker) ||
              node.querySelector(`.${ownerMarker}`) !== null));
        const observer = new MutationObserver((records) => {
          const relevant = records.filter(
            (entry) =>
              belongs(entry.target) || [...entry.addedNodes, ...entry.removedNodes].some(belongs)
          );
          if (!relevant.length) return;
          mutationRecords += relevant.length;
          if (mutationRecords > 2000) {
            overflow = true;
            return;
          }
          record(
            'native-mutation-delivery',
            relevant.map((entry) => ({
              type: entry.type,
              target: id(entry.target),
              attribute: entry.attributeName,
              oldValue: entry.oldValue,
              currentValue:
                entry.type === 'attributes'
                  ? (entry.target as Element).getAttribute(entry.attributeName!)
                  : null,
              added: [...entry.addedNodes].map(id),
              removed: [...entry.removedNodes].map(id),
            }))
          );
        });
        observer.observe(document.body, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeOldValue: true,
          attributeFilter: [
            'style',
            'class',
            'data-theme',
            'data-projection-owner',
            'data-projection-generation',
          ],
        });
        abortSteps.push(() => observer.disconnect());
        const input = (event: Event) => {
          if (event.type === 'keydown' && (event as KeyboardEvent).key !== 'Escape') return;
          if (
            event.type !== 'keydown' &&
            !(
              event.target instanceof Node &&
              (host.contains(event.target) || surface.contains(event.target))
            )
          )
            return;
          const value = {
            type: event.type,
            trusted: event.isTrusted,
            at: performance.now(),
            target: event.target instanceof Node ? id(event.target) : null,
            key: event instanceof KeyboardEvent ? event.key : null,
          };
          inputs.push(value);
          record('native-input', value);
        };
        for (const name of ['pointerdown', 'pointerup', 'click', 'keydown'])
          document.addEventListener(name, input, true);
        const stopInputs = () => {
          for (const name of ['pointerdown', 'pointerup', 'click', 'keydown'])
            document.removeEventListener(name, input, true);
        };
        abortSteps.push(stopInputs);
        const stopTheme = watchProjectionThemeSurfaceStyle('liquid-glass', host, (theme) => {
          themeEvents.push({ at: performance.now(), theme });
          composition.setThemeSurfaceStyle(theme);
          record('real-theme-watcher');
        });
        abortSteps.push(stopTheme);
        observationPhase = 'running';
        const twoRaf = () =>
          new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Theme ownership RAF deadline')), 2000);
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                clearTimeout(timer);
                resolve();
              })
            );
          });
        const stopCallerTheme = () => {
          if (themeStopped) return;
          observationPhase = 'caller-theme-watcher-stop';
          record('before-caller-theme-watcher-stop');
          stopTheme();
          themeStopped = true;
          record('after-caller-theme-watcher-stop');
          observationPhase = 'after-caller-theme-watcher-stop';
        };
        const destroy = async () => {
          if (destroyed) return;
          observationPhase = 'rendered-destroy';
          record('before-real-destroy');
          try {
            await rendered.destroy();
          } finally {
            destroyed = true;
            await twoRaf();
            record('after-real-destroy');
            observationPhase = 'after-rendered-destroy';
          }
        };
        return {
          host,
          surface,
          palettes,
          observerPrecondition,
          snapshot,
          twoRaf,
          stopCallerTheme,
          destroy,
          record,
          finish() {
            observationPhase = 'harness-cleanup';
            observer.disconnect();
            stopInputs();
            const final = snapshot();
            const hostConnectedBeforeHarnessRemoval = host.isConnected;
            host.remove();
            restoreDisconnect();
            delete (window as any).liquidThemeOwnershipAbort;
            return {
              trace,
              themeEvents,
              inputs,
              mutationRecords,
              overflow,
              final,
              observerDisconnections,
              hostConnectedBeforeHarnessRemoval,
              nativeDisconnectRestored: observerPrototype.disconnect === originalDisconnect,
            };
          },
        };
      });
      report.palettes = await fixture.evaluate((value) => value.palettes);
      report.observerPrecondition = await fixture.evaluate((value) => value.observerPrecondition);
      const light = report.palettes.light,
        dark = report.palettes.dark;
      stage = 'mounted-light';
      const mounted = await checkpoint(stage);
      authored(mounted);
      expect(mounted.publicRef.sameAsSurface).toBe(true);
      expect(mounted.rootContainsSurface).toBe(true);
      expect(mounted.surface.inline['--pui-background'].value).toBe('');
      expect(mounted.root.inline['--pui-background'].value).toBe(light['--pui-background']);
      const trigger = page.locator('[data-demo-ref="theme-owner-trigger"]');
      const waitDetached = () =>
        expect
          .poll(
            async () => {
              const value = await snapshot();
              return (
                value.surface.connected &&
                !value.rootContainsSurface &&
                !value.restoredToOrigin &&
                value.surface.role === 'menu' &&
                value.currentSurfaceIds.length === 1 &&
                value.currentSurfaceIds[0] === value.retainedSurfaceId
              );
            },
            { timeout: 10000 }
          )
          .toBe(true);
      stage = 'native-open-light';
      await trigger.click();
      await waitDetached();
      await expect
        .poll(async () => (await snapshot()).surface.inline['--pui-background'].value)
        .toBe(light['--pui-background']);
      const opened = await checkpoint(stage);
      authored(opened);
      expect(opened.surface.computed.color).toBe('rgb(170, 187, 204)');
      await screenshot('open-light');
      stage = 'detached-dark-via-watcher';
      await fixture.evaluate((value) => {
        value.host.dataset.theme = 'dark';
      });
      await expect
        .poll(async () => ({
          surface: (await snapshot()).surface.inline['--pui-background'].value,
          root: (await snapshot()).root.inline['--pui-background'].value,
        }))
        .toEqual({ surface: dark['--pui-background'], root: dark['--pui-background'] });
      const darkened = await checkpoint(stage);
      authored(darkened);
      expect(darkened.themeCallbackCount).toBeGreaterThan(mounted.themeCallbackCount);
      expect(darkened.surface.computed.color).toBe('rgb(170, 187, 204)');
      await screenshot('open-dark');
      stage = 'native-escape-reattach';
      // No theme setter, marker write or explicit stamp is allowed between
      // Escape and this observation: the real browser observer must clear it.
      await page.keyboard.press('Escape');
      await expect
        .poll(
          async () => {
            const value = await snapshot();
            return (
              value.surface.connected &&
              value.rootContainsSurface &&
              value.restoredToOrigin &&
              value.surface.inline['--pui-background'].value === ''
            );
          },
          { timeout: 10000 }
        )
        .toBe(true);
      const reattached = await checkpoint(stage);
      authored(reattached);
      expect(reattached.currentSurfaceIds).toEqual([reattached.retainedSurfaceId]);
      expect(reattached.surface.inline['--pui-border'].value).toBe('');
      expect(reattached.surface.computed['--pui-background']).toBe(dark['--pui-background']);
      stage = 'author-reclaims-one-stamp';
      await trigger.click();
      await waitDetached();
      await expect
        .poll(async () => (await snapshot()).surface.inline['--pui-background'].value)
        .toBe(dark['--pui-background']);
      await fixture.evaluate((value) => {
        value.surface.style.setProperty('--pui-background', '#123456', 'important');
        value.record('explicit-author-value-and-priority-overwrite');
        value.host.dataset.theme = 'light';
      });
      await expect
        .poll(async () => (await snapshot()).surface.inline['--pui-border'].value)
        .toBe(light['--pui-border']);
      const reclaimed = await checkpoint(stage);
      authored(reclaimed);
      expect(reclaimed.surface.inline['--pui-background']).toEqual({
        value: '#123456',
        priority: 'important',
      });
      expect(reclaimed.root.inline['--pui-background'].value).toBe(light['--pui-background']);
      expect(reclaimed.themeCallbackCount).toBeGreaterThan(darkened.themeCallbackCount);
      await screenshot('author-override');
      stage = 'real-destroy-with-open-portal';
      await fixture.evaluate((value) => value.stopCallerTheme());
      report.callerThemeCleanup = await snapshot();
      expect(report.callerThemeCleanup.surface.connected).toBe(true);
      expect(report.callerThemeCleanup.surface.inline).toEqual(reclaimed.surface.inline);
      await fixture.evaluate((value) => value.destroy());
      const cleaned = await checkpoint(stage);
      authored(cleaned);
      expect(cleaned.surface.connected).toBe(false);
      expect(cleaned.ownedConnectedNodes).toBe(0);
      expect(cleaned.surface.inline['--pui-background']).toEqual({
        value: '#123456',
        priority: 'important',
      });
      expect(cleaned.surface.inline['--pui-border'].value).toBe('');
      await fixture.evaluate(async (value) => {
        value.host.dataset.theme = 'dark';
        await value.twoRaf();
      });
      report.afterStoppedThemeInput = await snapshot();
      expect(report.afterStoppedThemeInput.themeCallbackCount).toBe(cleaned.themeCallbackCount);
      expect(report.afterStoppedThemeInput.surface.inline).toEqual(cleaned.surface.inline);
      expect(report.checkpoints.map((value: any) => value.name)).toEqual([
        'mounted-light',
        'native-open-light',
        'detached-dark-via-watcher',
        'native-escape-reattach',
        'author-reclaims-one-stamp',
        'real-destroy-with-open-portal',
      ]);
    } catch (error) {
      failure(stage, error);
    } finally {
      if (fixture) {
        try {
          await fixture.evaluate((value) => value.stopCallerTheme());
        } catch (error) {
          failure('caller-watcher-cleanup', error);
        }
        try {
          await fixture.evaluate((value) => value.destroy());
        } catch (error) {
          failure('cleanup', error);
        }
        try {
          report.native = await fixture.evaluate((value) => value.finish());
          expect(report.native.overflow).toBe(false);
          expect(report.native.inputs.filter((value: any) => value.type === 'click')).toHaveLength(
            2
          );
          expect(
            report.native.inputs.filter(
              (value: any) => value.type === 'keydown' && value.key === 'Escape'
            )
          ).toHaveLength(1);
          expect(report.native.inputs.every((value: any) => value.trusted === true)).toBe(true);
          expect(report.native.hostConnectedBeforeHarnessRemoval).toBe(true);
          expect(report.native.nativeDisconnectRestored).toBe(true);
          expect(
            report.native.observerDisconnections.some(
              (value: any) =>
                value.phase === 'caller-theme-watcher-stop' &&
                value.outcome === 'returned' &&
                value.stack?.includes('/projection-theme.ts')
            )
          ).toBe(true);
          expect(
            report.native.observerDisconnections.some(
              (value: any) =>
                value.phase === 'rendered-destroy' &&
                value.outcome === 'returned' &&
                value.stack?.includes('/projection-composition.ts')
            )
          ).toBe(true);
        } catch (error) {
          failure('archive-native-observation', error);
        }
        try {
          await fixture.dispose();
        } catch (error) {
          failure('dispose-browser-handle', error);
        }
      } else {
        try {
          report.mountFailureCleanup = await page.evaluate(async () => {
            const abort = (window as any).liquidThemeOwnershipAbort;
            return abort
              ? await abort()
              : { acquiredCleanupSteps: 0, errors: [], available: false };
          });
          expect(report.mountFailureCleanup.errors).toEqual([]);
        } catch (error) {
          failure('incomplete-mount-cleanup', error);
        }
      }
      page.off('console', onConsole);
      page.off('pageerror', onError);
      try {
        report.sourceAtEnd = await identity();
        report.sourceStable =
          JSON.stringify(report.sourceAtStart) === JSON.stringify(report.sourceAtEnd);
        expect(report.sourceStable).toBe(true);
        expect(report.pageErrors).toEqual([]);
      } catch (error) {
        failure('final-source-and-page-errors', error);
      }
      report.completedAt = new Date().toISOString();
      observations.push({
        themeOwnership: 'theme-ownership/report.json',
        checkpoints: report.checkpoints.length,
        failures: report.failures,
      });
      await writeFile(
        path.join(directory, 'console.json'),
        JSON.stringify({ console: report.console, pageErrors: report.pageErrors }, null, 2)
      );
      await writeFile(path.join(directory, 'report.json'), JSON.stringify(report, null, 2));
    }
    expect(report.failures).toEqual([]);
    },
    90000
  );
});

if (includeLiquidWip) describe.sequential('bounded release lifecycle', () => {
  it(
    'retains complete paint geometry, finishes real release tails and rejects late completions',
    async () => {
    if (!evidence)
      throw new Error('Release lifecycle artifacts require PROTO_UI_MATERIAL_EVIDENCE_DIR');
    const directory = path.join(evidence, 'release-lifecycle');
    await mkdir(directory, { recursive: true });
    const files = [
      'pnpm-lock.yaml',
      'packages/adapters/base/src/material/sink.ts',
      'packages/adapters/base/src/material/program.ts',
      'packages/adapters/base/src/material/program-pool.ts',
      'packages/adapters/base/src/material/source.ts',
      'packages/adapters/base/src/material/source-refresh-task.ts',
      'packages/adapters/base/src/material/contact-motion.ts',
      'packages/adapters/base/src/material/contact-profile.ts',
      'packages/adapters/base/src/material/contact-carrier.ts',
      'packages/adapters/base/src/material/image-prepare.ts',
      'packages/adapters/base/src/events/pointer-contact.ts',
      'apps/www/src/components/PrototypePreviewer/preview-material-scene.ts',
      'apps/www/src/pages/en/test/liquid-glass-material.astro',
      'apps/www/src/content/docs/zh-cn/browser-harness.ts',
      'apps/www/src/content/docs/zh-cn/material-paint-observation.ts',
      'apps/www/src/content/docs/zh-cn/demo-liquid-glass-material.browser.test.ts',
      '.github/workflows/liquid-glass-frame-budget.yml',
    ];
    const identity = async () => ({
      head: execFileSync('git', ['rev-parse', 'HEAD'], {
        encoding: 'utf8',
      }).trim(),
      tree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], {
        encoding: 'utf8',
      }).trim(),
      status: execFileSync('git', ['status', '--porcelain'], {
        encoding: 'utf8',
      }).trim(),
      hashes: Object.fromEntries(
        await Promise.all(
          files.map(async (file) => [
            file,
            createHash('sha256')
              .update(await readFile(file))
              .digest('hex'),
          ])
        )
      ),
    });
    const report: Record<string, any> = {
      schemaVersion: 1,
      scope:
        'Candidate-only real-browser lifecycle acceptance; not matched latency or input-to-photon evidence.',
      clock:
        'Unmodified performance.now and native RAF. Exact same-clock branches have separate deterministic unit controls.',
      controlledDecode:
        'Only the next actual PNG Image.decode promise delivery is gated; native invocation and settlement are recorded separately. No fake image, completion or decode duration.',
      cancellation:
        'Trusted Playwright down/up; pointercancel and window blur below are explicitly synthetic DOM lifecycle delivery, not OS-generated cancellation.',
      releaseProfileMs: 240,
      observationDeadlineMs: 2000,
      cases: [],
      failures: [],
      console: [],
      pageErrors: [],
      sourceAtStart: await identity(),
    };
    const onConsole = (message: any) =>
      report.console.push({
        type: message.type(),
        text: message.text(),
        location: message.location(),
      });
    const onError = (error: Error) =>
      report.pageErrors.push({
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    page.on('console', onConsole);
    page.on('pageerror', onError);
    const resources = () => page.evaluate(() => (window as any).liquidMaterialFixture.metrics());
    const twoRaf = () =>
      page.evaluate(
        () =>
          new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Post-action RAF deadline')), 2000);
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                clearTimeout(timer);
                resolve();
              })
            );
          })
      );
    const zeroResources = (value: Record<string, number>) => {
      for (const key of [
        'contexts',
        'consumers',
        'pendingImages',
        'decodedImages',
        'pendingSourceRefreshTasks',
      ])
        expect(value[key], `released resource ${key}`).toBe(0);
    };
    const archiveImage = async (name: string, css: string) => {
      const encoded = /data:image\/png;base64,([A-Za-z0-9+/=]+)/.exec(css)?.[1];
      const bytes = encoded ? Buffer.from(encoded, 'base64') : Buffer.from(css);
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      if (encoded) await writeFile(path.join(directory, `${name}.png`), bytes);
      return {
        sha256,
        bytes: bytes.length,
        png: encoded ? `${name}.png` : null,
      };
    };
    const checkpoint = (label: string) =>
      page.evaluate((label) => (window as any).__liquidReleaseProbe.snapshot(label), label);
    const prepare = async (runtime: string, theme = 'light') => {
      await preference(theme);
      await page.setViewportSize({ width: 1000, height: 1050 });
      await page.goto(`${baseUrl}${ROUTE}?theme=${theme}`, {
        waitUntil: 'networkidle',
      });
      await page.waitForFunction(() => document.documentElement.dataset.materialReady, undefined, {
        timeout: 60000,
      });
      await page.evaluate(() => (window as any).liquidMaterialFixture.pause(true));
      await page.waitForFunction(
        () => (window as any).liquidMaterialFixture.metrics().pendingImages === 0
      );
      const selector = `[data-material-host="${runtime}"] [data-demo-ref="regular"]`;
      const target = page.locator(selector);
      await target.hover();
      await page.waitForFunction(
        (selector) => {
          const node = document.querySelector<HTMLElement>(selector);
          return (
            node?.dataset.materialQuality === 'self-optical' &&
            node.dataset.materialContact === 'rest' &&
            (window as any).liquidMaterialFixture.metrics().pendingImages === 0
          );
        },
        selector,
        { timeout: 2000 }
      );
      await twoRaf();
      await page.evaluate(
        ({ selector, observeSource }) => {
          const target = document.querySelector<HTMLElement>(selector)!;
          const observe = Function(
            `return (${observeSource})`
          )() as typeof observeOwnedMaterialPaint;
          const images: string[] = [],
            imageIds = new Map<string, number>();
          const state: any = {
            snapshots: [],
            inputs: [],
            images,
            truncated: false,
          };
          const snapshot = (label: string) => {
            const { image, ...paint } = observe(target);
            if (!imageIds.has(image)) {
              imageIds.set(image, images.length);
              images.push(image);
            }
            const entry = {
              at: performance.now(),
              label,
              connected: target.isConnected,
              frame: target.dataset.materialFrame ?? null,
              contact: target.dataset.materialContact ?? null,
              session: target.dataset.materialContactSession ?? null,
              sourceRevision: target.dataset.materialSourceRevision ?? null,
              reason: target.dataset.materialReason ?? null,
              imageId: imageIds.get(image),
              imageNone: image === 'none',
              paint,
              resources: (window as any).liquidMaterialFixture.metrics(),
            };
            if (state.snapshots.length < 1200) state.snapshots.push(entry);
            else state.truncated = true;
            return entry;
          };
          const input = (event: Event) =>
            state.inputs.push({
              type: event.type,
              at: performance.now(),
              timestamp: event.timeStamp,
              trusted: event.isTrusted,
              pointerId: event instanceof PointerEvent ? event.pointerId : null,
            });
          for (const name of ['pointerdown', 'pointerup', 'pointercancel'])
            target.addEventListener(name, input, true);
          window.addEventListener('blur', input, true);
          const observer = new MutationObserver(() => snapshot('mutation'));
          observer.observe(target, {
            attributes: true,
            attributeFilter: [
              'data-material-frame',
              'data-material-contact',
              'data-material-quality',
              'data-material-reason',
              'data-material-source-revision',
            ],
          });
          let raf = 0;
          const tick = () => {
            snapshot('raf');
            raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
          (window as any).__liquidReleaseProbe = {
            state,
            snapshot,
            stop() {
              cancelAnimationFrame(raf);
              observer.disconnect();
              for (const name of ['pointerdown', 'pointerup', 'pointercancel'])
                target.removeEventListener(name, input, true);
              window.removeEventListener('blur', input, true);
              snapshot('stop');
              delete (window as any).__liquidReleaseProbe;
              return state;
            },
          };
          snapshot('initial');
        },
        { selector, observeSource: observeOwnedMaterialPaint.toString() }
      );
      return { selector, target };
    };
    const ownedRest = async (selector: string, afterFrame: number) => {
      await page.waitForFunction(
        ({ selector, afterFrame }) => {
          const node = document.querySelector<HTMLElement>(selector);
          return (
            node?.dataset.materialQuality === 'self-optical' &&
            node.dataset.materialContact === 'rest' &&
            Number(node.dataset.materialFrame) > afterFrame &&
            (window as any).liquidMaterialFixture.metrics().pendingImages === 0
          );
        },
        { selector, afterFrame },
        { timeout: 2000 }
      );
      const state = await checkpoint('settled-rest');
      expect(state.paint.committed).toBe(true);
      expect(state.paint.geometryMatches).toBe(true);
      return state;
    };
    const installGate = () =>
      page.evaluate(() => {
        const original = HTMLImageElement.prototype.decode;
        const state: any = {
          armed: true,
          ticket: null,
          autoOpened: false,
          restored: false,
        };
        let open = () => {},
          timer: ReturnType<typeof setTimeout> | undefined;
        const wrapped = function (this: HTMLImageElement) {
          const actual = original.call(this);
          if (!state.armed || !this.src.startsWith('data:image/png;base64,')) return actual;
          state.armed = false;
          const ticket: any = {
            startedAt: performance.now(),
            source: this.src,
            nativeState: 'pending',
            deliveredAt: null,
          };
          state.ticket = ticket;
          const barrier = new Promise<void>((resolve) => {
            open = () => {
              ticket.openedAt ??= performance.now();
              resolve();
            };
          });
          // Consume native rejection immediately, retaining its actual error for delivery.
          const native = actual.then(
            () => {
              ticket.nativeState = 'fulfilled';
              ticket.nativeSettledAt = performance.now();
              return { ok: true as const };
            },
            (error: unknown) => {
              ticket.nativeState = 'rejected';
              ticket.nativeSettledAt = performance.now();
              ticket.nativeError = String(error);
              return { ok: false as const, error };
            }
          );
          timer = setTimeout(() => {
            state.autoOpened = true;
            open();
          }, 2500);
          return Promise.all([native, barrier]).then(([result]) => {
            clearTimeout(timer);
            ticket.deliveredAt = performance.now();
            if (!result.ok) throw result.error;
          });
        };
        HTMLImageElement.prototype.decode = wrapped;
        (window as any).__liquidDecodeGate = {
          state,
          open() {
            open();
          },
          restore() {
            open();
            clearTimeout(timer);
            if (HTMLImageElement.prototype.decode !== wrapped)
              throw new Error('Decode gate ownership changed');
            HTMLImageElement.prototype.decode = original;
            state.restored = true;
            return state;
          },
        };
      });
    const finish = async (entry: Record<string, any>) => {
      const trace = await page.evaluate(() => (window as any).__liquidReleaseProbe?.stop() ?? null);
      if (trace) {
        const images = trace.images as string[];
        trace.images = await Promise.all(
          images.map((css, i) => archiveImage(`${entry.name}-image-${i}`, css))
        );
        entry.trace = trace;
        expect(trace.truncated, 'bounded release trace overflow').toBe(false);
      }
    };
    let pointerDown = false;
    const down = async () => {
      await page.mouse.down();
      pointerDown = true;
    };
    const up = async () => {
      await page.mouse.up();
      pointerDown = false;
    };
    const runCase = async (name: string, work: (entry: Record<string, any>) => Promise<void>) => {
      const entry: Record<string, any> = { name };
      report.cases.push(entry);
      try {
        await work(entry);
      } catch (error) {
        entry.failure =
          error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : String(error);
        report.failures.push({ name, error: entry.failure });
      } finally {
        try {
          await page.evaluate(() => {
            const gate = (window as any).__liquidDecodeGate;
            if (gate) gate.restore();
          });
        } catch (error) {
          report.failures.push({
            name: `${name}-gate-restore`,
            error: String(error),
          });
        }
        try {
          if (pointerDown) await up();
          await page.evaluate(() => (window as any).liquidMaterialFixture.dispose());
          entry.cleanupImmediate = await resources();
          await twoRaf();
          entry.cleanupAfterTwoRaf = await resources();
          zeroResources(entry.cleanupImmediate);
          zeroResources(entry.cleanupAfterTwoRaf);
          for (const key of [
            'renders',
            'sourceRefreshTasksScheduled',
            'sourceRefreshTasksCancelled',
            'sourceRefreshTasksRun',
          ])
            expect(entry.cleanupAfterTwoRaf[key], `post-disposal ${key}`).toBe(
              entry.cleanupImmediate[key]
            );
        } catch (error) {
          report.failures.push({
            name: `${name}-cleanup`,
            error: String(error),
          });
        }
        try {
          entry.gate = await page.evaluate(() => {
            const gate = (window as any).__liquidDecodeGate;
            const value = gate?.state ?? null;
            delete (window as any).__liquidDecodeGate;
            return value;
          });
          if (entry.gate?.ticket?.source) {
            entry.gate.ticket.image = await archiveImage(
              `${name}-gated-native`,
              entry.gate.ticket.source
            );
            delete entry.gate.ticket.source;
          }
        } catch (error) {
          report.failures.push({
            name: `${name}-gate-evidence`,
            error: String(error),
          });
        }
        // Preserve the complete trace even when a cleanup/resource assertion failed.
        try {
          await finish(entry);
        } catch (error) {
          report.failures.push({
            name: `${name}-trace-evidence`,
            error: String(error),
          });
        }
        await writeFile(path.join(directory, 'report.json'), JSON.stringify(report, null, 2));
      }
    };
    try {
      expect(report.sourceAtStart.status).toBe('');
      if (process.env.CANDIDATE_SHA)
        expect(report.sourceAtStart.head).toBe(process.env.CANDIDATE_SHA);
      for (const [runtime, theme] of [
        ...RUNTIMES.map((runtime) => [runtime, 'light'] as const),
        ['wc', 'dark'] as const,
      ]) {
        await runCase(`natural-${theme}-${runtime}`, async (entry) => {
          entry.mode = 'natural native decode and trusted pointer input';
          const { selector, target } = await prepare(runtime, theme);
          entry.before = await checkpoint('before-down');
          expect(entry.before.paint.committed).toBe(true);
          expect(entry.before.paint.geometryMatches).toBe(true);
          await target.screenshot({
            path: path.join(directory, `${entry.name}-rest.png`),
          });
          await down();
          await page.waitForFunction(
            (selector) =>
              document.querySelector<HTMLElement>(selector)?.dataset.materialContact === 'held' &&
              (window as any).liquidMaterialFixture.metrics().pendingImages === 0,
            selector,
            { timeout: 2000 }
          );
          entry.held = await checkpoint('decoded-held');
          await target.screenshot({
            path: path.join(directory, `${entry.name}-held.png`),
          });
          await up();
          entry.afterUp = await checkpoint('after-trusted-up');
          entry.rest = await ownedRest(selector, Number(entry.held.frame));
          await target.screenshot({
            path: path.join(directory, `${entry.name}-returned.png`),
          });
          await page.waitForTimeout(270);
          entry.quietStart = await resources();
          await twoRaf();
          entry.quietEnd = await resources();
          expect(entry.quietEnd.renders).toBe(entry.quietStart.renders);
          const observed = await page.evaluate(() => (window as any).__liquidReleaseProbe.state);
          const upEvent = observed.inputs.find((input: any) => input.type === 'pointerup');
          expect(observed.inputs.map((input: any) => input.type)).toEqual([
            'pointerdown',
            'pointerup',
          ]);
          const releases = observed.snapshots.filter(
            (sample: any) => sample.at >= upEvent.at && sample.contact === 'release'
          );
          expect(releases.length).toBeGreaterThan(0);
          expect(
            observed.inputs
              .filter((input: any) => input.type === 'pointerdown' || input.type === 'pointerup')
              .every((input: any) => input.trusted)
          ).toBe(true);
          expect(entry.rest.session).toBe(entry.held.session);
          for (const sample of [entry.before, entry.held, ...releases, entry.rest]) {
            expect(sample.paint.committed).toBe(true);
            expect(sample.paint.geometryMatches).toBe(true);
            expect(sample.paint.carrierGeometry).toEqual(entry.before.paint.carrierGeometry);
            expect(sample.sourceRevision).toBe(entry.before.sourceRevision);
          }
        });
      }
      for (const action of ['up', 'cancel', 'blur', 'source-revoke', 'dispose']) {
        await runCase(`controlled-pending-${action}`, async (entry) => {
          entry.mode =
            'Controlled delivery of one real native decode promise; excluded from latency evidence';
          const { selector } = await prepare('wc');
          entry.before = await checkpoint('before-gated-down');
          await installGate();
          await down();
          await page.waitForFunction(
            () =>
              (window as any).__liquidDecodeGate.state.ticket !== null &&
              (window as any).liquidMaterialFixture.metrics().pendingImages > 0,
            undefined,
            { timeout: 2000 }
          );
          entry.pending = await checkpoint('native-decode-delivery-pending');
          expect(entry.pending.resources.pendingImages).toBeGreaterThan(0);
          if (action === 'up') await up();
          else if (action === 'cancel')
            await page.evaluate((selector) => {
              const id = (window as any).__liquidReleaseProbe.state.inputs.find(
                (input: any) => input.type === 'pointerdown'
              ).pointerId;
              document.querySelector(selector)!.dispatchEvent(
                new PointerEvent('pointercancel', {
                  bubbles: true,
                  pointerId: id,
                  pointerType: 'mouse',
                  isPrimary: true,
                })
              );
            }, selector);
          else if (action === 'blur')
            await page.evaluate(() => window.dispatchEvent(new Event('blur')));
          else if (action === 'source-revoke')
            await page.evaluate(() => (window as any).liquidMaterialFixture.source('wc', false));
          else await page.evaluate(() => (window as any).liquidMaterialFixture.dispose());
          entry.afterAction = await checkpoint(`after-${action}`);
          await page.evaluate(() => (window as any).__liquidDecodeGate.open());
          await page.waitForFunction(
            () => (window as any).__liquidDecodeGate.state.ticket.deliveredAt !== null,
            undefined,
            { timeout: 2000 }
          );
          if (action !== 'up') await up(); // Explicit late up must not revive cancelled ownership.
          await twoRaf();
          entry.afterLateDelivery = await checkpoint('after-native-completion-delivery');
          const gate = await page.evaluate(() => (window as any).__liquidDecodeGate.state);
          expect(gate.autoOpened).toBe(false);
          expect(gate.ticket.openedAt).toBeGreaterThanOrEqual(entry.afterAction.at);
          expect(gate.ticket.nativeSettledAt).toBeGreaterThanOrEqual(gate.ticket.startedAt);
          if (action === 'up') expect(gate.ticket.nativeState).toBe('fulfilled');
          if (action === 'dispose') {
            zeroResources(entry.afterAction.resources);
            zeroResources(entry.afterLateDelivery.resources);
            expect(entry.afterLateDelivery.connected).toBe(false);
          } else if (action === 'source-revoke') {
            for (const sample of [entry.afterAction, entry.afterLateDelivery]) {
              expect(sample.paint.quality).toBe('opaque-fallback');
              expect(sample.paint.carrier).toBe(null);
              expect(sample.paint.committed).toBe(false);
              expect(sample.imageNone).toBe(true);
            }
            await page.evaluate(() => (window as any).liquidMaterialFixture.source('wc', true));
            entry.recovered = await ownedRest(selector, Number(entry.before.frame));
          } else {
            entry.rest = await ownedRest(selector, Number(entry.before.frame));
            expect(entry.rest.sourceRevision).toBe(entry.before.sourceRevision);
            expect(Number(entry.rest.session)).toBe(Number(entry.before.session) + 1);
            if (action === 'up') {
              const observed = await page.evaluate(
                () => (window as any).__liquidReleaseProbe.state
              );
              expect(
                observed.snapshots.some(
                  (sample: any) =>
                    sample.at >= gate.ticket.deliveredAt && sample.contact === 'release'
                )
              ).toBe(true);
            }
            if (action !== 'up') {
              const observed = await page.evaluate(
                () => (window as any).__liquidReleaseProbe.state
              );
              const rejected = observed.snapshots.filter(
                (sample: any) =>
                  sample.at >= entry.afterAction.at &&
                  (sample.contact === 'held' || sample.contact === 'release')
              );
              expect(rejected).toEqual([]);
            }
          }
        });
      }
      await runCase('full-footprint-negative-guards', async (entry) => {
        const { target } = await prepare('wc');
        entry.before = await checkpoint('expanded-idle');
        await target.evaluate((host) => {
          const root = host.closest('[data-material-scene]')!;
          const r = host.getBoundingClientRect(),
            s = root.getBoundingClientRect();
          const block = document.createElement('div');
          block.dataset.releaseFootprintGuard = '';
          Object.assign(block.style, {
            position: 'absolute',
            left: `${r.right - s.left + 2}px`,
            top: `${r.top - s.top + r.height / 2}px`,
            width: '2px',
            height: '2px',
            background: 'red',
          });
          root.append(block);
        });
        entry.obstruction = await target.evaluate((host) => {
          const block = document.querySelector('[data-release-footprint-guard]')!;
          const h = host.getBoundingClientRect(),
            b = block.getBoundingClientRect();
          return {
            hostRight: h.right,
            obstructionLeft: b.left,
            obstructionRight: b.right,
          };
        });
        expect(entry.obstruction.obstructionLeft).toBeGreaterThanOrEqual(
          entry.obstruction.hostRight
        );
        expect(entry.obstruction.obstructionRight).toBeLessThanOrEqual(
          entry.obstruction.hostRight + entry.before.paint.paintOutset
        );
        await expect
          .poll(() => target.getAttribute('data-material-reason'), {
            timeout: 2000,
          })
          .toBe('source-overlapping-content');
        entry.outsideHostOverlap = await checkpoint('outside-host-inside-full-footprint');
        expect(entry.outsideHostOverlap.paint.quality).toBe('opaque-fallback');
        expect(entry.outsideHostOverlap.paint.committed).toBe(false);
        expect(entry.outsideHostOverlap.paint.carrier).toBe(null);
        expect(entry.outsideHostOverlap.imageNone).toBe(true);
        await page.screenshot({
          path: path.join(directory, 'full-footprint-idle-overlap.png'),
        });
        await page.locator('[data-release-footprint-guard]').evaluate((node) => node.remove());
        entry.recovered = await ownedRest(
          '[data-material-host="wc"] [data-demo-ref="regular"]',
          Number(entry.before.frame)
        );
        await target.evaluate((host) => {
          (host as HTMLElement).style.overflow = 'hidden';
        });
        await expect
          .poll(() => target.getAttribute('data-material-reason'), {
            timeout: 2000,
          })
          .toBe('source-expanded-paint-clipped');
        entry.clipped = await checkpoint('expanded-footprint-clipped');
        expect(entry.clipped.paint.quality).toBe('opaque-fallback');
        expect(entry.clipped.paint.committed).toBe(false);
        expect(entry.clipped.paint.carrier).toBe(null);
        expect(entry.clipped.imageNone).toBe(true);
        await page.screenshot({
          path: path.join(directory, 'full-footprint-clipped.png'),
        });
      });
    } finally {
      page.off('console', onConsole);
      page.off('pageerror', onError);
      report.sourceAtEnd = await identity();
      report.sourceStable =
        JSON.stringify(report.sourceAtStart) === JSON.stringify(report.sourceAtEnd);
      await writeFile(path.join(directory, 'report.json'), JSON.stringify(report, null, 2));
      await writeFile(
        path.join(directory, 'console.json'),
        JSON.stringify({ console: report.console, pageErrors: report.pageErrors }, null, 2)
      );
      observations.push({
        releaseLifecycle: 'release-lifecycle/report.json',
        sourceStable: report.sourceStable,
        failures: report.failures,
      });
    }
    expect(report.sourceStable).toBe(true);
    expect(report.pageErrors).toEqual([]);
    expect(report.cases).toHaveLength(11);
    expect(report.failures).toEqual([]);
    },
    150000
  );
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
      result.traceAdmission = {
        browser: browser.version(),
        requested: categories,
        response: available,
      };
      await mkdir(evidence, { recursive: true });
      await writeFile(
        path.join(evidence, `performance-${name}-trace-admission.json`),
        JSON.stringify(result.traceAdmission, null, 2)
      );
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

// Fixed browser source, not a host function for Vitest to rewrite and serialize.
// The only interpolated value is a validated, JSON-encoded data argument below.
const PUBLIC_POOL_READER_SOURCE = String.raw`async (binding) => {
  const url = new URL(binding.url);
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== location.origin ||
      url.username || url.password || url.hash || url.href !== binding.url ||
      !/\/packages\/adapters\/base\/src\/material\/program-pool\.ts$/.test(url.pathname))
    throw new Error('Observed resource inspector URL is not the exact same-origin module');
  if (!/^[a-f0-9]{64}$/.test(binding.transformedSha256) ||
      !Number.isSafeInteger(binding.transformedBytes) || binding.transformedBytes <= 0 ||
      binding.transformedBytes > 1024 * 1024)
    throw new Error('Observed resource inspector response binding is invalid');
  // Reuse the exact already-loaded URL, including query. No cache buster,
  // guessed path, second module identity, acquire, render or production global.
  const module = await import(binding.url);
  if (typeof module.inspectWebOpticalResources !== 'function')
    throw new Error('Actual public module does not expose its existing inspector');
  const actual = module.inspectWebOpticalResources(document);
  const emptyDocument = document.implementation.createHTMLDocument('owned-empty-control');
  const empty = module.inspectWebOpticalResources(emptyDocument);
  return { binding, actual, empty, documentUrl: location.href };
}`;

function publicPoolReadExpression(binding: PublicPoolBinding, documentUrl: string) {
  const url = new URL(binding.url);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.origin !== new URL(documentUrl).origin ||
    url.username ||
    url.password ||
    url.hash ||
    url.href !== binding.url ||
    !/\/packages\/adapters\/base\/src\/material\/program-pool\.ts$/.test(url.pathname)
  )
    throw new Error('Observed resource inspector URL is not the exact same-origin module');
  if (
    !/^[a-f0-9]{64}$/.test(binding.transformedSha256) ||
    !Number.isSafeInteger(binding.transformedBytes) ||
    binding.transformedBytes <= 0 ||
    binding.transformedBytes > 1024 * 1024
  )
    throw new Error('Observed resource inspector response binding is invalid');
  const argument = JSON.stringify({
    url: binding.url,
    transformedSha256: binding.transformedSha256,
    transformedBytes: binding.transformedBytes,
  })
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  return `(${PUBLIC_POOL_READER_SOURCE})(${argument})`;
}

function poolRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function readPublicPool(page: Page, binding: PublicPoolBinding) {
  const result = await page.evaluate<unknown>(publicPoolReadExpression(binding, page.url()));
  if (
    !poolRecord(result) ||
    !poolRecord(result.binding) ||
    result.binding.url !== binding.url ||
    result.binding.transformedSha256 !== binding.transformedSha256 ||
    result.binding.transformedBytes !== binding.transformedBytes ||
    !poolRecord(result.actual) ||
    !poolRecord(result.empty) ||
    typeof result.documentUrl !== 'string' ||
    result.documentUrl !== page.url()
  )
    throw new Error('Actual public inspector returned an unbound or malformed observation');
  return { binding, actual: result.actual, empty: result.empty, documentUrl: result.documentUrl };
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

if (includeLiquidWip) describe('bounded public Liquid live-canvas diagnostics', () => {
  it(
    'records actual four-runtime idle/hover work without accepting an optimization',
    async () => {
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
      gpuObservations: [],
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
        const panel = page.locator(`[data-adapter-panel="${runtime}"]`).filter({
          has: page.locator(
            '.proto-previewer[data-demo-id="demo-liquid-glass-button"][data-projection-toolbar="true"]'
          ),
        });
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
        (summary.gpuObservations as unknown[]).push({ runtime, gpu });
        await mkdir(evidence, { recursive: true });
        await writeFile(
          path.join(evidence, `performance-${runtime}-gpu.json`),
          JSON.stringify({ runtime, gpu }, null, 2)
        );
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
    },
    150000
  );
});
