// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Browser, Locator, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser, RUNTIMES, startServer, stopServer } from './browser-harness';
import { runtimePreviewEvidenceIssues, type RuntimePreviewPaint } from './runtime-preview-evidence';

let browser: Browser;
let baseUrl: string;
let source: { sha: string; dirty: boolean };
const directory = path.join(
  process.env.RUNNER_TEMP ?? os.tmpdir(),
  'homepage-evidence',
  'runtime-box'
);
beforeAll(async () => {
  source = {
    sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirty: !!execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
      encoding: 'utf8',
    }).trim(),
  };
  baseUrl = await startServer('/zh-cn/ui-libraries/brutalist/');
  browser = await launchBrowser();
}, 150000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60000);

async function measure(
  root: Locator,
  family: 'shadcn' | 'brutalist',
  expectedPadding: number[]
): Promise<RuntimePreviewPaint> {
  return root.evaluate(
    (root, { family, expectedPadding }) => {
      const surfaces = root.querySelectorAll<HTMLElement>(
        '.pui-runtime-preview-surface[data-pui-style]'
      );
      const frame = surfaces[0]!;
      // Resolve the declared radius variable through an independent length probe;
      // do not derive the expectation from the frame's actual border-radius.
      const lengthProbe = document.createElement('span');
      lengthProbe.style.cssText =
        'position:absolute;visibility:hidden;pointer-events:none;height:0';
      lengthProbe.style.width =
        family === 'brutalist' ? 'var(--pui-radius)' : 'var(--pui-radius-xl)';
      const themeValues = getComputedStyle(frame);
      lengthProbe.style.setProperty('--pui-radius', themeValues.getPropertyValue('--pui-radius'));
      lengthProbe.style.setProperty(
        '--pui-radius-xl',
        themeValues.getPropertyValue('--pui-radius-xl')
      );
      // Keep the independent probe outside the live Proto slot subtree.
      document.body.append(lengthProbe);
      const expectedRadius = parseFloat(getComputedStyle(lengthProbe).width);
      lengthProbe.remove();
      const style = getComputedStyle(frame);
      const rect = frame.getBoundingClientRect();
      const outerPaint: string[] = [];
      for (let element = frame.parentElement; element; element = element.parentElement) {
        if (
          !element.matches(
            '.proto-previewer, .proto-previewer__preview-panel, .proto-previewer__preview, .host, .pui-projection-generation, .pui-projection-scope, .pui-projection-content, .prototype-card, .brutalist-demo-frame'
          )
        )
          continue;
        const paint = getComputedStyle(element);
        const border = ['Top', 'Right', 'Bottom', 'Left'].some(
          (side) =>
            parseFloat(paint.getPropertyValue(`border-${side.toLowerCase()}-width`)) > 0 &&
            paint.getPropertyValue(`border-${side.toLowerCase()}-style`) !== 'none'
        );
        if (
          border ||
          paint.boxShadow !== 'none' ||
          !['transparent', 'rgba(0, 0, 0, 0)'].includes(paint.backgroundColor)
        )
          outerPaint.push(element.className);
      }
      const originalContent = frame.querySelector(
        '[data-demo-ref="__website_runtime_preview_surface__-content"]'
      );
      const children = Array.from((originalContent ?? frame).children).filter(
        (child) => child.getBoundingClientRect().width > 0
      );
      return {
        family,
        surfaceCount: surfaces.length,
        surfaceWidth: rect.width,
        surfaceHeight: rect.height,
        tokens: (frame.getAttribute('data-pui-style') ?? '').split(/\s+/),
        radius: [
          style.borderTopLeftRadius,
          style.borderTopRightRadius,
          style.borderBottomRightRadius,
          style.borderBottomLeftRadius,
        ].map(parseFloat),
        border: [
          style.borderTopWidth,
          style.borderRightWidth,
          style.borderBottomWidth,
          style.borderLeftWidth,
        ].map(parseFloat),
        padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft].map(
          parseFloat
        ),
        expectedRadius,
        expectedPadding,
        background: style.backgroundColor,
        shadow: style.boxShadow,
        ancestorPaint: outerPaint,
        hasRole: frame.hasAttribute('role'),
        hasTabStop: frame.hasAttribute('tabindex'),
        pointerEvents: style.pointerEvents,
        contentContained:
          children.length > 0 &&
          children.every((child) => {
            const box = child.getBoundingClientRect();
            return box.left >= rect.left - 1 && box.right <= rect.right + 1;
          }),
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    },
    { family, expectedPadding }
  );
}

async function capture(
  page: Page,
  root: Locator,
  id: string,
  family: string,
  runtime: string,
  paint: RuntimePreviewPaint
) {
  await mkdir(directory, { recursive: true });
  const overviewArticle = root.locator(
    'xpath=ancestor::article[contains(concat(" ", normalize-space(@class), " "), " prototype-card ")]'
  );
  const subject = (await overviewArticle.count()) ? overviewArticle : root;
  // Include the overview title and former outer-frame area, with enough room
  // for the actual canvas hard shadow; a tight inner crop would hide the bug.
  await subject.screenshot({ path: path.join(directory, `${id}.png`) });
  await writeFile(
    path.join(directory, `${id}.json`),
    JSON.stringify(
      {
        schemaVersion: 1,
        source,
        capturedAt: new Date().toISOString(),
        url: page.url(),
        viewport: page.viewportSize(),
        family,
        runtime,
        theme: await page.locator('html').getAttribute('data-theme'),
        screenshot: `${id}.png`,
        paint,
        renderer: 'Actual Chromium; public documentation; overview article or standalone preview',
      },
      null,
      2
    )
  );
}

async function ready(root: Locator, runtime: string) {
  await root.scrollIntoViewIfNeeded();
  await root.page().waitForFunction(
    ({ id, runtime }) => {
      const root = document.querySelector<HTMLElement>(`[data-previewer-id="${id}"]`);
      const owner = root as HTMLElement & {
        __previewer__?: { getCurrentRuntime(): string | null };
      };
      return (
        owner?.__previewer__?.getCurrentRuntime() === runtime &&
        !!root?.querySelector('.pui-runtime-preview-surface[data-pui-style]')
      );
    },
    { id: await root.getAttribute('data-previewer-id'), runtime },
    { timeout: 45000 }
  );
}

describe('RuntimeBox single actual Prototype surface', () => {
  for (const family of ['shadcn', 'brutalist'] as const) {
    for (const runtime of RUNTIMES) {
      it(`${family}/${runtime}: lazy overview has one family canvas in light/dark and at 390px`, async () => {
        const page = await browser.newPage({
          viewport: { width: 1440, height: 1000 },
          colorScheme: 'light',
        });
        try {
          await page.addInitScript((runtime) => {
            localStorage.setItem('preferred-prototypes-adapter', runtime);
            localStorage.setItem('starlight-theme', 'light');
          }, runtime);
          await page.goto(`${baseUrl}/zh-cn/ui-libraries/${family}/`, { waitUntil: 'networkidle' });
          // The Shadcn overview reuses its real variants demo; it has never
          // registered a demo named "demo-shadcn-button".
          const demoId = family === 'shadcn' ? 'demo-button-variants' : 'demo-brutalist-button';
          const root = page.locator(`.prototype-card [data-demo-id="${demoId}"]`);
          await ready(root, runtime);
          const light = await measure(root, family, [16, 16, 16, 16]);
          await capture(page, root, `${family}-${runtime}-overview-light`, family, runtime, light);
          expect(runtimePreviewEvidenceIssues(light)).toEqual([]);
          // Explicit consumer color-mode input. The same committed demo keeps
          // running while its actual surface theme changes.
          await page.evaluate(() => {
            document.documentElement.dataset.theme = 'dark';
            document.documentElement.classList.remove('light');
            document.documentElement.classList.add('dark');
          });
          await page.waitForFunction(
            ({ id, background }) => {
              const frame = document.querySelector(
                `[data-previewer-id="${id}"] .pui-runtime-preview-surface[data-pui-style]`
              );
              return !!frame && getComputedStyle(frame).backgroundColor !== background;
            },
            { id: await root.getAttribute('data-previewer-id'), background: light.background }
          );
          await page.setViewportSize({ width: 390, height: 844 });
          await root.scrollIntoViewIfNeeded();
          const dark = await measure(root, family, [16, 16, 16, 16]);
          await capture(
            page,
            root,
            `${family}-${runtime}-overview-dark-narrow`,
            family,
            runtime,
            dark
          );
          expect(runtimePreviewEvidenceIssues(dark)).toEqual([]);
          expect(dark.background).not.toBe(light.background);
          // Live negative control: reinstating the old wrapper border must be
          // caught by the same computed-paint assertion, then fully restored.
          const originalStyle = await root.evaluate((root) => {
            const article = root.closest<HTMLElement>('.prototype-card')!;
            const style = article.getAttribute('style');
            article.style.border = '2px solid black';
            return style;
          });
          try {
            expect(
              runtimePreviewEvidenceIssues(await measure(root, family, [16, 16, 16, 16]))
            ).toContain('duplicate ancestor paint');
          } finally {
            await root.evaluate((root, previous) => {
              const article = root.closest('.prototype-card')!;
              if (previous === null) article.removeAttribute('style');
              else article.setAttribute('style', previous);
            }, originalStyle);
          }
        } finally {
          await page.close();
        }
      }, 90000);
    }
  }

  it('keeps Runtime Tabs outside the canvas and the demonstrated Select popup usable at 390px', async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    try {
      await page.goto(`${baseUrl}/zh-cn/ui-libraries/brutalist/components/select/`, {
        waitUntil: 'networkidle',
      });
      const root = page.locator('[data-demo-id="demo-brutalist-select"]').first();
      await ready(root, 'wc');
      const paint = await measure(root, 'brutalist', [20, 16, 20, 16]);
      expect(runtimePreviewEvidenceIssues(paint)).toEqual([]);
      const trigger = root
        .locator(
          '[data-projection-scope][data-projection-state="ready"] [data-projection-control="runtime"][data-runtime-tabs]'
        )
        .getByRole('tab', { name: 'React', exact: true });
      expect(
        await trigger.evaluate((element) => !!element.closest('.pui-runtime-preview-surface'))
      ).toBe(false);
      await trigger.focus();
      expect(await trigger.evaluate((element) => document.activeElement === element)).toBe(true);
      await trigger.press('Enter');
      await ready(root, 'react');
      expect(await trigger.getAttribute('aria-selected')).toBe('true');
      const demoTrigger = root.locator('.pui-runtime-preview-surface [role="combobox"]');
      await demoTrigger.click();
      const demoPopupId = await demoTrigger.getAttribute('aria-controls');
      const demoPopup = page.locator(`[id=${JSON.stringify(demoPopupId)}]`);
      await demoPopup.waitFor({ state: 'visible' });
      const selectedTrigger = await demoTrigger.elementHandle();
      if (!selectedTrigger) throw new Error('The original demonstrated Select trigger is missing.');
      const generation = await selectedTrigger.evaluate((element) =>
        element.closest('[data-projection-generation]')?.getAttribute('data-projection-generation')
      );
      expect(generation).toBeTruthy();
      await demoPopup.getByRole('option', { name: 'Ink', exact: true }).click();
      try {
        await expect
          .poll(
            async () => ({
              ...(await selectedTrigger.evaluate((element) => ({
                connected: element.isConnected,
                text: element.textContent?.trim(),
                expanded: element.getAttribute('aria-expanded'),
              }))),
              popupHidden: !(await demoPopup.isVisible()),
            }),
            { timeout: 2000, message: 'The same React Select trigger must commit Ink and close' }
          )
          .toEqual({ connected: true, text: 'Ink', expanded: 'false', popupHidden: true });
        expect(
          await selectedTrigger.evaluate((element) =>
            element
              .closest('[data-projection-generation]')
              ?.getAttribute('data-projection-generation')
          )
        ).toBe(generation);
      } catch (error) {
        await mkdir(directory, { recursive: true });
        await writeFile(
          path.join(directory, 'brutalist-react-narrow-select-failure.json'),
          JSON.stringify(
            {
              source,
              capturedAt: new Date().toISOString(),
              error: String(error),
              generation,
              trigger: await selectedTrigger.evaluate((element) => ({
                connected: element.isConnected,
                html: element.outerHTML,
              })),
              popupVisible: await demoPopup.isVisible(),
              popup: await demoPopup.evaluateAll((nodes) =>
                nodes.map((element) => ({
                  html: element.outerHTML,
                  style: {
                    visibility: getComputedStyle(element).visibility,
                    opacity: getComputedStyle(element).opacity,
                    display: getComputedStyle(element).display,
                  },
                }))
              ),
            },
            null,
            2
          )
        );
        throw error;
      } finally {
        await selectedTrigger.dispose();
      }
      expect(await root.getAttribute('data-projection-family')).toBe('brutalist');
      expect(
        runtimePreviewEvidenceIssues(await measure(root, 'brutalist', [20, 16, 20, 16]))
      ).toEqual([]);
      await capture(
        page,
        root,
        'brutalist-fixed-toolbar-react-narrow',
        'brutalist',
        'react',
        await measure(root, 'brutalist', [20, 16, 20, 16])
      );
    } finally {
      await page.close();
    }
  }, 90000);

  it('resolves the current preference when a below-fold overview card first becomes visible', async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    try {
      await page.addInitScript(() => localStorage.setItem('preferred-prototypes-adapter', 'wc'));
      await page.goto(`${baseUrl}/zh-cn/ui-libraries/shadcn/`, { waitUntil: 'networkidle' });
      const root = page.locator('.prototype-card [data-previewer-id]').last();
      expect(await root.getAttribute('data-inited')).toBeNull();
      await page.evaluate(() => {
        localStorage.setItem('preferred-prototypes-adapter', 'vue2');
        document.dispatchEvent(
          new CustomEvent('proto-adapter:change', { detail: { adapter: 'vue2' } })
        );
      });
      await ready(root, 'vue2');
      expect(runtimePreviewEvidenceIssues(await measure(root, 'shadcn', [16, 16, 16, 16]))).toEqual(
        []
      );
    } finally {
      await page.close();
    }
  }, 90000);

  it('covers the generic Base path and keeps its demonstrated command operable', async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    try {
      await page.goto(`${baseUrl}/zh-cn/ui-libraries/base/button/`, { waitUntil: 'networkidle' });
      const root = page.locator('[data-demo-id="demo-base-button"]');
      await ready(root, 'wc');
      expect(await root.getAttribute('data-projection-mode')).toBeNull();
      const paint = await measure(root, 'shadcn', [24, 16, 24, 16]);
      expect(runtimePreviewEvidenceIssues(paint)).toEqual([]);
      const command = root.locator('.pui-runtime-preview-surface [role="button"]').first();
      await command.focus();
      expect(await command.evaluate((element) => element === document.activeElement)).toBe(true);
      await command.press('Enter');
      expect(await command.evaluate((element) => element === document.activeElement)).toBe(true);
      await capture(page, root, 'base-generic-wc', 'shadcn', 'wc', paint);
    } finally {
      await page.close();
    }
  }, 90000);

  for (const runtime of RUNTIMES)
    it(`${runtime}: preserves forward/backward generated shell and slot Selection endpoints`, async () => {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      try {
        await page.addInitScript(
          (runtime) => localStorage.setItem('preferred-prototypes-adapter', runtime),
          runtime
        );
        await page.goto(`${baseUrl}/zh-cn/ui-libraries/base/image/`, { waitUntil: 'networkidle' });
        const root = page.locator('[data-demo-id="demo-base-image"]');
        await ready(root, runtime);
        for (const boundary of ['.pui-runtime-preview-surface', '[data-passive-shell-slot]']) {
          for (const backward of [false, true]) {
            const before = await root.evaluate(
              (root, { boundary, backward }) => {
                const wrapper = root.querySelector(boundary)!;
                const content = root.querySelector(
                  '[data-demo-ref="__website_runtime_preview_surface__-content"]'
                )!;
                const selection = document.getSelection()!;
                selection.setBaseAndExtent(
                  wrapper,
                  backward ? wrapper.childNodes.length : 0,
                  wrapper,
                  backward ? 0 : wrapper.childNodes.length
                );
                (root as any).__selectionSource = content;
                return {
                  text: selection.toString(),
                  family: root.getAttribute('data-site-library-family'),
                };
              },
              { boundary, backward }
            );
            expect(before.text.length).toBeGreaterThan(0);
            const family = before.family === 'brutalist' ? 'shadcn' : 'brutalist';
            await root.evaluate(
              (root, family) => root.setAttribute('data-site-library-family', family),
              family
            );
            await expect
              .poll(() =>
                root.locator('.pui-runtime-preview-surface').getAttribute('data-projection-family')
              )
              .toBe(family);
            const after = await root.evaluate((root) => {
              const selection = document.getSelection()!;
              const source = (root as any).__selectionSource;
              return {
                text: selection.toString(),
                connected: source.isConnected,
                same:
                  source ===
                  root.querySelector(
                    '[data-demo-ref="__website_runtime_preview_surface__-content"]'
                  ),
                anchor: selection.anchorOffset,
                focus: selection.focusOffset,
                anchorParent: selection.anchorNode === source.parentNode,
                focusParent: selection.focusNode === source.parentNode,
              };
            });
            expect(after).toMatchObject({
              text: before.text,
              connected: true,
              same: true,
              anchorParent: true,
              focusParent: true,
              anchor: backward ? 1 : 0,
              focus: backward ? 0 : 1,
            });
            await capture(
              page,
              root,
              `selection-${runtime}-${boundary.includes('slot') ? 'slot' : 'surface'}-${backward ? 'backward' : 'forward'}`,
              family,
              runtime,
              await measure(root, family, [24, 16, 24, 16])
            );
          }
        }
      } finally {
        await page.close();
      }
    }, 90000);

  it('keeps overview titles, destinations and fallback readable without JavaScript', async () => {
    const started = performance.now();
    const phase = (name: string) =>
      console.log(
        '[runtime-preview-no-js]',
        JSON.stringify({ phase: name, elapsedMs: performance.now() - started, source })
      );
    phase('context:start');
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    });
    phase('context:ready');
    try {
      phase('page:start');
      const page = await context.newPage();
      phase('page:ready');
      await page.goto(`${baseUrl}/zh-cn/ui-libraries/brutalist/`, {
        waitUntil: 'domcontentloaded',
      });
      phase('navigation:ready');
      const article = page.locator('#brutalist-button');
      phase('assertions:start');
      expect(await article.locator('h2').innerText()).toBe('Button');
      expect(await article.locator('a').getAttribute('href')).toBe('./components/button/');
      expect(await article.locator('noscript').innerText()).toContain('JavaScript');
      expect(await article.locator('[role="button"]').count()).toBe(0);
      await article.locator('a').focus();
      expect(
        await article.locator('a').evaluate((element) => document.activeElement === element)
      ).toBe(true);
      phase('assertions:passed');
    } finally {
      phase('context:closing');
      await context.close();
      phase('context:closed');
    }
  });
});
