// @vitest-environment node
// Actual public-page evidence; no Apple-native/GPUI or upstream pixel-parity claim.
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium, type Browser, type Locator, type Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  RUNTIMES,
  COLOR_SCHEMES,
  chromeExecutable,
  startServer,
  stopServer,
  selectRuntime,
  applyColorScheme,
} from './browser-harness';

const output =
  process.env.PUI_FINF_FEATURE_EVIDENCE_DIR ?? path.join(tmpdir(), 'pui-liquid-dropdown');
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const sourceTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim();
let browser: Browser;
let baseUrl = '';
beforeAll(async () => {
  await mkdir(output, { recursive: true });
  if (process.env.GITHUB_ACTIONS !== 'true' || process.env.CANDIDATE_SHA !== sourceSha)
    throw new Error(
      'Official exact-head GitHub Actions evidence only; local native run not authorized here.'
    );
  expect(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()).toBe('');
  const external = process.env.PROTO_UI_BROWSER_BASE_URL;
  if (external && !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(external).hostname))
    throw new Error('Only a loopback evidence server is allowed.');
  baseUrl = await startServer('/');
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(baseUrl).hostname))
    throw new Error('Only a loopback evidence server is allowed.');
  browser = await chromium.launch({
    executablePath: await chromeExecutable(),
    headless: true,
    chromiumSandbox: true,
    args: ['--disable-dev-shm-usage'],
  });
}, 180_000);
afterAll(async () => {
  try {
    await browser?.close();
  } finally {
    await stopServer();
  }
}, 60_000);

const observe = (target: Locator) =>
  target.evaluateAll((elements) => {
    if (elements.length !== 1 || !elements[0]!.isConnected)
      throw new Error('Expected one connected public Trigger');
    const element = elements[0] as HTMLElement,
      css = getComputedStyle(element);
    return {
      quality: element.dataset.materialQuality ?? null,
      reason: element.dataset.materialReason ?? null,
      phase: element.dataset.materialPhase ?? null,
      expanded: element.getAttribute('aria-expanded'),
      disabled: element.getAttribute('aria-disabled'),
      color: css.color,
      backgroundColor: css.backgroundColor,
      backgroundImagePresent: css.backgroundImage !== 'none',
      opacity: css.opacity,
      browserNow: performance.now(),
      browserTimeOrigin: performance.timeOrigin,
    };
  });
// Post-open-screenshot observation only. It is not an optical acceptance vote.
async function observeContent(page: Page) {
  const nodeStartedAt = performance.now(),
    nodeTimeOrigin = performance.timeOrigin;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // The bound does not cancel evaluate; its late completion only reads and cannot append logs.
    const sample = await Promise.race([
      page
        .evaluate(() => {
          const rect = (element: Element) => {
            const box = element.getBoundingClientRect();
            return { x: box.x, y: box.y, width: box.width, height: box.height };
          };
          const menus = [...document.querySelectorAll<HTMLElement>('[role="menu"]')].filter(
            (element) => {
              const css = getComputedStyle(element);
              return element.isConnected && css.display !== 'none' && css.visibility !== 'hidden';
            }
          );
          const sources = [
            ...document.querySelectorAll<HTMLCanvasElement>(
              '[data-material-scene="visible-app-canvas"] > canvas[data-material-backdrop]'
            ),
          ];
          // Preserve ambiguity rather than silently choosing one menu/source.
          const menu = menus.length === 1 ? menus[0]! : null;
          const css = menu ? getComputedStyle(menu) : null;
          return {
            browserNow: performance.now(),
            browserTimeOrigin: performance.timeOrigin,
            menuCount: menus.length,
            content: menu
              ? {
                  connected: menu.isConnected,
                  quality: menu.dataset.materialQuality ?? null,
                  reason: menu.dataset.materialReason ?? null,
                  rect: rect(menu),
                  color: css!.color,
                  backgroundColor: css!.backgroundColor,
                  backgroundImagePresent: css!.backgroundImage !== 'none',
                  opacity: css!.opacity,
                  insideMaterialScene: !!menu.closest('[data-material-scene="visible-app-canvas"]'),
                }
              : null,
            sources: sources.map((canvas) => ({
              connected: canvas.isConnected,
              rect: rect(canvas),
              containsContent: !!menu && !!canvas.parentElement?.contains(menu),
            })),
          };
        })
        .then((value) => ({ status: 'sampled' as const, value })),
      new Promise<{ status: 'timeout' }>((resolve) => {
        timer = setTimeout(() => resolve({ status: 'timeout' }), 1000);
      }),
    ]);
    return { nodeStartedAt, nodeTimeOrigin, nodeFinishedAt: performance.now(), sample };
  } catch {
    // Do not replace an existing assertion or expose arbitrary page/error text.
    return {
      nodeStartedAt,
      nodeTimeOrigin,
      nodeFinishedAt: performance.now(),
      sample: { status: 'read-error' },
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
for (const runtime of RUNTIMES)
  for (const scheme of COLOR_SCHEMES)
    it(`Liquid Dropdown ${runtime} ${scheme} real Trigger material and menu ownership`, async () => {
      const id = `liquid-dropdown-${runtime}-${scheme}`;
      const context = await browser.newContext({
        viewport: { width: 1280, height: 1000 },
        colorScheme: scheme,
        reducedMotion: 'no-preference',
      });
      const page = await context.newPage();
      page.setDefaultTimeout(15_000);
      page.setDefaultNavigationTimeout(30_000);
      const observations: unknown[] = [],
        deniedRequests: string[] = [];
      let lastMaterialObservation: Awaited<ReturnType<typeof observe>> | null = null;
      let contentObservation: Awaited<ReturnType<typeof observeContent>> | null = null;
      let stage = 'navigate',
        held = false,
        failure: string | null = null;
      const watchdog = setTimeout(() => {
        void context.close().catch(() => {});
      }, 110_000);
      await context.route('**/*', (request) => {
        const url = new URL(request.request().url());
        if (url.origin === new URL(baseUrl).origin) return request.continue();
        deniedRequests.push(url.origin);
        return request.abort();
      });
      try {
        const response = await page.goto(`${baseUrl}/en/ui-libraries/liquid-glass/dropdown-menu/`, {
          waitUntil: 'networkidle',
        });
        expect(response?.status()).toBe(200);
        const previewer = page.locator('[data-demo-id="demo-liquid-glass-dropdown-menu"]');
        await previewer.scrollIntoViewIfNeeded();
        stage = 'runtime-selection';
        await selectRuntime(page, previewer, runtime, '[aria-haspopup="menu"]', 1);
        await applyColorScheme(page, scheme);
        const trigger = previewer.getByRole('button', { name: 'Open', exact: true });
        const capture = async (state: string, target = trigger) => {
          stage = `capture:${state}`;
          observations.push({
            state,
            observation: await observe(target),
            image: `${id}-${state}.png`,
          });
          await page.screenshot({ path: path.join(output, `${id}-${state}.png`) });
        };
        stage = 'rest-material';
        await expect
          .poll(
            async () => {
              lastMaterialObservation = await observe(trigger);
              return lastMaterialObservation.quality;
            },
            { timeout: 10_000 }
          )
          .toBe('self-optical');
        expect((await observe(trigger)).expanded).toBe('false');
        await capture('rest');
        const box = await trigger.boundingBox();
        if (!box) throw new Error('Public Trigger has no pointer target');
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        held = true;
        stage = 'pressed-material';
        await expect
          .poll(
            async () => {
              lastMaterialObservation = await observe(trigger);
              return lastMaterialObservation.phase;
            },
            { timeout: 10_000 }
          )
          .toBe('pressed');
        await capture('pressed');
        expect((await observe(trigger)).quality).toBe('self-optical');
        await page.mouse.up();
        held = false;
        stage = 'open';
        await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('true');
        await expect.poll(() => page.getByRole('menu').isVisible()).toBe(true);
        await capture('open');
        contentObservation = await observeContent(page);
        await page.keyboard.press('Escape');
        await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('false');
        // The current public page keeps the disabled Trigger in its separate
        // opaque example. Select and prove this demo's actual runtime as well.
        stage = 'disabled-runtime-selection';
        const disabledPreviewer = page.locator(
          '[data-demo-id="demo-liquid-glass-dropdown-menu-opaque"]'
        );
        await disabledPreviewer.scrollIntoViewIfNeeded();
        await selectRuntime(page, disabledPreviewer, runtime, '[aria-haspopup="menu"]', 2);
        const disabled = disabledPreviewer.getByRole('button', {
          name: 'Unavailable',
          exact: true,
        });
        stage = 'disabled';
        expect((await observe(disabled)).disabled).toBe('true');
        const disabledBox = await disabled.boundingBox();
        if (!disabledBox) throw new Error('Disabled Trigger has no public box');
        await page.mouse.click(
          disabledBox.x + disabledBox.width / 2,
          disabledBox.y + disabledBox.height / 2
        );
        expect((await observe(disabled)).expanded).toBe('false');
        expect(await page.getByRole('menu').count()).toBe(0);
        await capture('disabled', disabled);
        expect(deniedRequests).toEqual([]);
      } catch (error) {
        failure = String(error);
        try {
          await page.screenshot({ path: path.join(output, `${id}-failure.png`) });
        } catch {
          /* Keep the original failure. */
        }
        throw error;
      } finally {
        if (held) {
          try {
            await page.mouse.up();
          } catch {
            /* Closing a failed page still releases input. */
          }
        }
        clearTimeout(watchdog);
        try {
          await context.close();
        } finally {
          await writeFile(
            path.join(output, `${id}.json`),
            JSON.stringify(
              {
                sourceSha,
                sourceTree,
                runtime,
                scheme,
                stage,
                failure,
                observations,
                lastMaterialObservation,
                contentObservation,
                deniedRequests,
                scope:
                  'Current public Liquid Dropdown source; fallback is not optical completion; no Apple/GPUI parity.',
              },
              null,
              2
            )
          );
        }
      }
    }, 120_000);
