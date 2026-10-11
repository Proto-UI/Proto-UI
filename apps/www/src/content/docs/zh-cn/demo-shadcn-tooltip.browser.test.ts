// @vitest-environment node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Browser, JSHandle, Page } from 'playwright-core';
import { observeTooltipPress } from './tooltip-pressed-observation';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  COLOR_SCHEMES,
  RUNTIMES,
  applyColorScheme,
  launchBrowser,
  selectRuntime,
  startServer,
  stopServer,
} from './browser-harness';

const ROUTE = '/zh-cn/ui-libraries/shadcn/tooltip/';
const requestedRuntime = process.env.PROTO_UI_SHADCN_TOOLTIP_BROWSER_RUNTIME;
const TEST_RUNTIMES = requestedRuntime
  ? RUNTIMES.filter((runtime) => runtime === requestedRuntime)
  : RUNTIMES;

if (requestedRuntime && TEST_RUNTIMES.length === 0) {
  throw new Error(
    `PROTO_UI_SHADCN_TOOLTIP_BROWSER_RUNTIME must be one of ${RUNTIMES.join(', ')}; received ${requestedRuntime}.`
  );
}

type PressObservation = JSHandle<ReturnType<typeof observeTooltipPress>>;

async function capturePressFailure(
  page: Page,
  observation: PressObservation | null,
  runtime: string,
  error: unknown,
  triggerBox: { x: number; y: number; width: number; height: number } | null
) {
  try {
    // Freeze failure facts in one browser turn, before metadata, I/O or release.
    const captured = await page
      .evaluate((observer) => {
        const evidence = observer?.freeze() ?? null;
        const previewer = Array.from(document.querySelectorAll('[data-previewer-id]')).find(
          (element) =>
            evidence?.previewerId == null ||
            element.getAttribute('data-previewer-id') === evidence.previewerId
        );
        const rect = previewer?.getBoundingClientRect();
        const x = Math.max(0, rect?.x ?? 0);
        const y = Math.max(0, rect?.y ?? 0);
        const width = Math.min(innerWidth, rect?.right ?? 0) - x;
        const height = Math.min(innerHeight, rect?.bottom ?? 0) - y;
        return {
          evidence,
          // Omit URL credentials, query and fragment from saved public evidence.
          pageUrl: `${location.origin}${location.pathname}`,
          screenshotClip: width > 0 && height > 0 ? { x, y, width, height } : null,
        };
      }, observation)
      .catch((failure) => ({
        evidence: null,
        pageUrl: null,
        screenshotClip: null,
        observationError: String(failure),
      }));
    const source = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim();
    const sourceDirty = Boolean(
      execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()
    );
    const diagnosticFiles = Object.fromEntries(
      ['demo-shadcn-tooltip.browser.test.ts', 'tooltip-pressed-observation.ts'].map((file) => [
        file,
        createHash('sha256')
          .update(readFileSync(new URL(file, import.meta.url)))
          .digest('hex'),
      ])
    );
    const directory = path.join(
      process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR ?? path.join(tmpdir(), 'proto-ui-runtime-evidence'),
      'tooltip-pressed',
      `${source.slice(0, 12)}-${runtime}-${Date.now()}`
    );
    await mkdir(directory, { recursive: true });
    const configured = new URL(baseUrl);
    const serverMode = process.env.PROTO_UI_BROWSER_BASE_URL
      ? 'caller-provided-base-url'
      : 'test-owned-server';
    await writeFile(
      path.join(directory, 'failure.json'),
      JSON.stringify(
        {
          testCheckout: { head: source, headTree: tree, dirty: sourceDirty, diagnosticFiles },
          pageSourceRevision: null,
          pageSourceBinding:
            'Local test checkout is recorded; served-page revision is not attested by this diagnostic.',
          configuredBaseUrl: `${configured.origin}${configured.pathname}`,
          serverMode,
          runtime,
          route: ROUTE,
          browser: browser.version(),
          capturedAt: new Date().toISOString(),
          failure: String(error),
          sampledTriggerBox: triggerBox,
          ...captured,
          screenshotScope:
            'Visible previewer intersection only; no full-page or unrelated screen capture.',
          screenshotUnavailable: captured.screenshotClip
            ? null
            : 'No observed visible previewer clip.',
        },
        null,
        2
      )
    );
    console.info(`[tooltip-pressed] failure evidence: ${directory}`);
    // Persist DOM facts first. A screenshot failure must not hide the assertion.
    if (captured.screenshotClip) {
      await page.screenshot({
        path: path.join(directory, 'failure.png'),
        clip: captured.screenshotClip,
        caret: 'initial',
        timeout: 2000,
      });
    }
  } catch (captureError) {
    console.warn('[tooltip-pressed] failure capture incomplete', captureError);
  }
}

let browser: Browser;
let baseUrl = '';

beforeAll(async () => {
  baseUrl = await startServer(ROUTE);
  browser = await launchBrowser();
}, 180_000);

afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

describe.sequential('shadcn Tooltip browser acceptance', () => {
  it('blockifies positioned inline-flex boxes without changing their inner layout', async () => {
    const context = await browser.newContext();
    try {
      // Self-authored CSS characterization, independent of Tooltip implementation.
      // https://www.w3.org/TR/2025/WD-css-position-3-20251007/#position-property
      // https://www.w3.org/TR/2026/CRD-css-display-3-20260605/#transformations
      await context.route('**/*', (route) => route.abort());
      const page = await context.newPage();
      await page.setContent(`<!doctype html>
        <style>
          html { font-size: 16px; }
          .surface {
            display: inline-flex;
            width: fit-content;
            max-width: 20rem;
            align-items: center;
            gap: 0.375rem;
          }
          #absolute { position: absolute; }
          #fixed { position: fixed; }
        </style>
        <div style="display: block">
          <div class="surface" id="static"><span>First</span><span>Second</span></div>
          <div class="surface" id="absolute"><span>First</span><span>Second</span></div>
          <div class="surface" id="fixed"><span>First</span><span>Second</span></div>
        </div>`);
      for (const position of ['static', 'absolute', 'fixed']) {
        const paint = await page.locator(`#${position}`).evaluate((element) => {
          const style = getComputedStyle(element);
          const first = element.children[0].getBoundingClientRect();
          const second = element.children[1].getBoundingClientRect();
          return {
            position: style.position,
            display: style.display,
            maxWidth: style.maxWidth,
            gap: style.gap,
            alignItems: style.alignItems,
            physicalGap: second.left - first.right,
          };
        });
        expect(paint.position).toBe(position);
        expect(paint.display).toBe(position === 'static' ? 'inline-flex' : 'flex');
        expect(paint.maxWidth).toBe('320px');
        expect(paint.gap).toBe('6px');
        expect(paint.alignItems).toBe('center');
        expect(paint.physicalGap).toBeCloseTo(6, 5);
      }
    } finally {
      await context.close();
    }
  });

  it('renders state feedback and a supplementary body portal in every public runtime', async () => {
    const context = await browser.newContext({ viewport: { width: 320, height: 844 } });
    const page = await context.newPage();
    await page.goto(`${baseUrl}${ROUTE}`, {
      waitUntil: 'domcontentloaded',
      timeout: 120_000,
    });
    const previewer = page.locator('[data-previewer-id]').first();
    await previewer.waitFor({ state: 'visible', timeout: 120_000 });

    try {
      for (const runtime of TEST_RUNTIMES) {
        await selectRuntime(page, previewer, runtime, '[data-demo-ref="accountTrigger"]', 1);
        const account = previewer.locator('[data-demo-ref="accountTrigger"]');
        const notifications = previewer.locator('[data-demo-ref="notificationsTrigger"]');

        expect(await account.getAttribute('tabindex'), `${runtime}/account-tabindex`).toBe('0');
        expect(
          await notifications.getAttribute('tabindex'),
          `${runtime}/notifications-tabindex`
        ).toBe('0');
        expect(await account.getAttribute('role'), `${runtime}/account-role`).toBeNull();
        expect(
          await account.getAttribute('aria-describedby'),
          `${runtime}/closed-description`
        ).toBeNull();
        expect(await page.getByRole('tooltip').count(), `${runtime}/closed-content`).toBe(0);

        await page.keyboard.press('Tab');
        await account.focus();
        await expect.poll(() => page.getByRole('tooltip').count(), { message: runtime }).toBe(1);

        const describedBy = await account.getAttribute('aria-describedby');
        const tooltipId = describedBy?.split(/\s+/).find(Boolean);
        if (!tooltipId) throw new Error(`${runtime}: focused Trigger did not publish describedBy.`);
        const content = page.locator(`[id="${tooltipId}"]`);

        expect(await content.getAttribute('role'), `${runtime}/content-role`).toBe('tooltip');
        expect(await content.getAttribute('tabindex'), `${runtime}/content-tabindex`).toBeNull();
        expect(await content.textContent(), `${runtime}/content-text`).toContain(
          'Open account settings.'
        );
        expect(
          await content.locator('a,button,input,select,textarea,[tabindex]').count(),
          `${runtime}/content-focusables`
        ).toBe(0);
        expect(await content.locator('svg').count(), `${runtime}/arrow-absence`).toBe(0);

        expect(
          await page.evaluate(
            ({ id }) => {
              const preview = document.querySelector('[data-previewer-id]');
              const portaled = document.getElementById(id);
              return Boolean(
                preview &&
                portaled &&
                document.body.contains(portaled) &&
                !preview.contains(portaled)
              );
            },
            { id: tooltipId }
          ),
          `${runtime}/renderer-owned-body-portal`
        ).toBe(true);

        await account.hover();
        await expect
          .poll(() => account.evaluate((element) => getComputedStyle(element).opacity), {
            message: `${runtime}/hover-opacity`,
          })
          .toBe('0.7');
        expect(
          await account.evaluate((element) => getComputedStyle(element).boxShadow),
          `${runtime}/focus-ring`
        ).not.toBe('none');

        const pressObservation = await account
          .evaluateHandle(observeTooltipPress)
          .catch((error) => {
            console.warn('[tooltip-pressed] observer installation failed', error);
            return null;
          });
        let triggerBox: { x: number; y: number; width: number; height: number } | null = null;
        let pressFailed = false;
        try {
          triggerBox = await account.boundingBox();
          if (!triggerBox) throw new Error(`${runtime}: Trigger has no rendered geometry.`);
          await page.mouse.move(
            triggerBox.x + triggerBox.width / 2,
            triggerBox.y + triggerBox.height / 2
          );
          await page.mouse.down();
          await expect
            .poll(() => account.evaluate((element) => getComputedStyle(element).transform), {
              message: `${runtime}/pressed-scale`,
            })
            .not.toBe('none');
        } catch (error) {
          pressFailed = true;
          await capturePressFailure(page, pressObservation, runtime, error, triggerBox);
          throw error;
        } finally {
          try {
            await page.mouse.up();
          } catch (releaseError) {
            if (!pressFailed) throw releaseError;
            console.warn(
              '[tooltip-pressed] mouse release also failed; preserving original failure',
              releaseError
            );
          } finally {
            await pressObservation?.evaluate((observer) => observer.stop()).catch(() => {});
            await pressObservation?.dispose().catch(() => {});
          }
        }

        const openedContent = await content.elementHandle();
        if (!openedContent) throw new Error(`${runtime}: Content identity missing.`);
        const themePaints: string[] = [];
        for (const colorScheme of COLOR_SCHEMES) {
          await applyColorScheme(page, colorScheme);
          expect(
            await content.evaluate((element, original) => element === original, openedContent)
          ).toBe(true);
          const paint = await content.evaluate((element) => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            const probe = document.createElement('span');
            probe.style.backgroundColor = 'var(--pui-foreground)';
            probe.style.color = 'var(--pui-background)';
            element.append(probe);
            const expected = getComputedStyle(probe);
            const expectedBackground = expected.backgroundColor;
            const expectedColor = expected.color;
            probe.remove();
            return {
              expectedBackground,
              expectedColor,
              position: style.position,
              display: style.display,
              maxWidth: style.maxWidth,
              gap: style.gap,
              borderRadius: style.borderRadius,
              borderWidth: style.borderTopWidth,
              backgroundColor: style.backgroundColor,
              color: style.color,
              boxShadow: style.boxShadow,
              fontSize: style.fontSize,
              paddingInline: style.paddingInline,
              paddingBlock: style.paddingBlock,
              width: rect.width,
              height: rect.height,
            };
          });
          expect(paint.borderRadius, `${runtime}/${colorScheme}/radius`).not.toBe('0px');
          expect(paint.borderWidth, `${runtime}/${colorScheme}/border`).toBe('0px');
          // CSS Position 3 §2 blockifies an absolute/fixed positioned box.
          // Preserve the authored inline-flex recipe; verify its computed value.
          expect(paint.position).toBe('fixed');
          expect(paint.display).toBe('flex');
          expect(paint.maxWidth).toBe('320px');
          expect(paint.gap).toBe('6px');
          themePaints.push(paint.backgroundColor);
          expect(paint.backgroundColor).toBe(paint.expectedBackground);
          expect(paint.color).toBe(paint.expectedColor);
          expect(paint.backgroundColor, `${runtime}/${colorScheme}/background`).not.toBe(
            'rgba(0, 0, 0, 0)'
          );
          expect(paint.color, `${runtime}/${colorScheme}/color`).not.toBe(paint.backgroundColor);
          expect(paint.boxShadow, `${runtime}/${colorScheme}/shadow`).toBe('none');
          expect(paint.fontSize, `${runtime}/${colorScheme}/font-size`).toBe('12px');
          expect(paint.paddingInline, `${runtime}/${colorScheme}/padding-inline`).toBe('12px');
          expect(paint.paddingBlock, `${runtime}/${colorScheme}/padding-block`).toBe('6px');
          expect(paint.width, `${runtime}/${colorScheme}/width`).toBeGreaterThan(20);
          expect(paint.height, `${runtime}/${colorScheme}/height`).toBeGreaterThan(10);
          expect(paint.width, `${runtime}/${colorScheme}/short-fit-width`).toBeLessThan(320);
          const longPaint = await content.evaluate((element) => {
            const description = document.createElement('span');
            description.textContent =
              'A supplementary tooltip description with several words that should wrap within the governed maximum width. '.repeat(
                4
              );
            element.append(description);
            const rect = element.getBoundingClientRect();
            const result = {
              width: rect.width,
              height: rect.height,
              scrollWidth: element.scrollWidth,
              clientWidth: element.clientWidth,
            };
            description.remove();
            return result;
          });
          expect(longPaint.width).toBeLessThanOrEqual(320);
          expect(longPaint.height).toBeGreaterThan(paint.height);
          expect(longPaint.scrollWidth).toBeLessThanOrEqual(longPaint.clientWidth);
        }

        expect(new Set(themePaints).size).toBe(COLOR_SCHEMES.length);
        await openedContent.dispose();
        await page.keyboard.press('Escape');
        await expect.poll(() => page.getByRole('tooltip').count(), { message: runtime }).toBe(0);
        expect(
          await account.getAttribute('aria-describedby'),
          `${runtime}/closed-description`
        ).toBeNull();
        await expect
          .poll(
            () =>
              account.evaluate(
                (trigger) =>
                  document.activeElement === trigger || trigger.contains(document.activeElement)
              ),
            { message: `${runtime}/focus-retained` }
          )
          .toBe(true);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth
          ),
          `${runtime}/document-overflow`
        ).toBe(0);
      }
    } finally {
      await context.close();
    }
  }, 240_000);
});
