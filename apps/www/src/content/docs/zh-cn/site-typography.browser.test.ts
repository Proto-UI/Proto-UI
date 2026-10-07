// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Browser, BrowserContext, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser, RUNTIMES, startServer, stopServer } from './browser-harness';
import { revealHeaderPreferences } from './site-header-browser';

// Authority: current bounded #803 native-owner request; app-private
// site-typography.proto.ts / site-typography.ts. Not a stable Base API claim.
const FIXTURE = '/en/test/site-typography/';
const FAMILIES = ['shadcn', 'brutalist'] as const;
const LABELS = { wc: 'Web Components', react: 'React', vue: 'Vue', vue2: 'Vue 2' };
const COPY = 'Alpha original emphasis 中文可以选择与复制 native link';
const SLOGANS = {
  'zh-cn': ['组件可以独立于框架或设计体系', '而不是在不同框架中被反复实现'],
  en: [
    'Components should not depend on frameworks or designs.',
    'Defined once — not rebuilt per framework.',
  ],
};
const output =
  process.env.PROTO_UI_TYPOGRAPHY_EVIDENCE_DIR ??
  path.join(process.env.RUNNER_TEMP ?? os.tmpdir(), 'typography-evidence');
let browser: Browser;
let launch: Promise<Browser> | undefined;
let baseUrl: string;
const records: unknown[] = [];
const source = {
  actualGitHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  expectedHead: process.env.PROTO_UI_EXPECTED_HEAD ?? null,
  eventSha: process.env.GITHUB_SHA ?? null,
  eventName: process.env.GITHUB_EVENT_NAME ?? null,
  dirty: Boolean(
    execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
      encoding: 'utf8',
    }).trim()
  ),
  runId: process.env.GITHUB_RUN_ID ?? null,
  runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
};
async function writeManifest() {
  await mkdir(output, { recursive: true });
  await writeFile(
    path.join(output, 'measurements.json'),
    JSON.stringify(
      {
        schemaVersion: 1,
        source,
        renderer: 'Real Chromium, repository browser-harness and authored Astro routes',
        limits: [
          '200% is root text resize, not browser-UI zoom',
          'Selection preservation uses explicitly injected native Selection and preference events; copy and label/link activation use real browser input',
          'This fixture is test-only native content, not a replacement production page',
        ],
        records,
      },
      null,
      2
    )
  );
}
beforeAll(async () => {
  await writeManifest();
  if (source.expectedHead)
    expect(source.actualGitHead, 'exact checked-out candidate').toBe(source.expectedHead);
  if (process.env.CI)
    expect(source.dirty, 'CI evidence must start from a clean checkout').toBe(false);
  baseUrl = await startServer([FIXTURE, '/zh-cn/', '/en/']);
  launch = launchBrowser();
  browser = await launch;
}, 180_000);
afterAll(async () => {
  await writeManifest();
  await (await launch?.catch(() => undefined))?.close();
  await stopServer();
}, 60_000);

async function runCase(
  id: string,
  action: (page: Page, context: BrowserContext, record: Record<string, unknown>) => Promise<void>,
  options: { noJS?: boolean; runtime?: string } = {}
) {
  const context = await browser.newContext({
    viewport: { width: 960, height: 800 },
    javaScriptEnabled: !options.noJS,
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  if (options.runtime)
    await context.addInitScript(
      (runtime) => localStorage.setItem('preferred-prototypes-adapter', runtime),
      options.runtime
    );
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  page.setDefaultNavigationTimeout(45_000);
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  const record: Record<string, unknown> = {
    id,
    startedAt: new Date().toISOString(),
    source,
    pageErrors,
    consoleErrors,
    screenshots: [],
  };
  records.push(record);
  try {
    await action(page, context, record);
    if (!record.injectedFailure) expect(pageErrors, 'unexpected browser exceptions').toEqual([]);
    record.outcome = 'passed';
  } catch (error) {
    record.outcome = 'failed';
    record.error = String(error);
    try {
      await capture(page, record, `${id}-failure`);
    } catch (captureError) {
      record.failureCaptureError = String(captureError);
    }
    throw error;
  } finally {
    record.url = page.url();
    record.trace = `${id}-trace.zip`;
    try {
      await context.tracing.stop({ path: path.join(output, `${id}-trace.zip`) });
    } finally {
      await writeManifest();
      await context.close();
    }
  }
}
async function capture(page: Page, record: Record<string, unknown>, id: string) {
  const filename = `${id}.png`;
  await page.screenshot({ path: path.join(output, filename) });
  (record.screenshots as string[]).push(filename);
}
async function platformFonts(context: BrowserContext, page: Page, selector: string) {
  const cdp = await context.newCDPSession(page);
  try {
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument');
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
    expect(nodeId, `real font node ${selector}`).toBeGreaterThan(0);
    return (await cdp.send('CSS.getPlatformFontsForNode', { nodeId })).fonts;
  } finally {
    await cdp.detach();
  }
}
async function renderedRoleFonts(context: BrowserContext, page: Page, selector: string) {
  const cdp = await context.newCDPSession(page);
  try {
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    await cdp.send('DOM.getDocument');
    const expression = `(function(){const root=document.querySelector(${JSON.stringify(selector)});if(!root)return null;const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);for(let node=walker.nextNode();node;node=walker.nextNode()){if(node.textContent.trim())return node.parentElement;}return null;})()`;
    const { result } = await cdp.send('Runtime.evaluate', {
      expression,
      objectGroup: 'typography-role-fonts',
    });
    if (!result.objectId) return { status: 'no-text-node', selector };
    const { nodeId } = await cdp.send('DOM.requestNode', { objectId: result.objectId });
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
    return {
      selector,
      status: fonts.some((font) => font.glyphCount > 0) ? 'measured' : 'no-rendered-glyphs',
      fonts,
    };
  } finally {
    await cdp.send('Runtime.releaseObjectGroup', { objectGroup: 'typography-role-fonts' });
    await cdp.detach();
  }
}
async function accessibleName(context: BrowserContext, page: Page, selector: string) {
  const cdp = await context.newCDPSession(page);
  try {
    await cdp.send('DOM.enable');
    await cdp.send('Accessibility.enable');
    const { root } = await cdp.send('DOM.getDocument');
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
    const result = await cdp.send('Accessibility.getPartialAXTree', {
      nodeId,
      fetchRelatives: false,
    });
    return result.nodes.map((node) => ({
      role: node.role?.value,
      name: node.name?.value,
      ignored: node.ignored,
    }));
  } finally {
    await cdp.detach();
  }
}
async function fixtureReady(page: Page, runtime: string, family: string) {
  await page.waitForFunction(
    ({ runtime, family }) => {
      const owner = document.querySelector<HTMLElement>('#native-title');
      return (
        owner?.dataset.typographyRuntime === runtime &&
        owner.dataset.typographyFamily === family &&
        owner.querySelector('[data-typography-prototype][data-pui-root]')
      );
    },
    { runtime, family },
    { timeout: 30_000 }
  );
}
async function sourceIntegrity(page: Page) {
  return page.evaluate(() => {
    type Saved = { native: HTMLElement; text: string; texts: Text[]; values: string[] };
    const saved = (window as unknown as { __nativeTypographySources: Saved[] })
      .__nativeTypographySources;
    return saved.map(({ native, text, texts, values }) => ({
      tag: native.tagName,
      id: native.id,
      connected: native.isConnected,
      text: native.textContent,
      expected: text,
      originalSources: texts.every(
        (node, index) =>
          node.isConnected && native.contains(node) && node.textContent === values[index]
      ),
      textNodeCount: (() => {
        const walker = document.createTreeWalker(native, NodeFilter.SHOW_TEXT);
        let count = 0;
        while (walker.nextNode()) count++;
        return count;
      })(),
      originalTextNodeCount: texts.length,
      carrierCount: native.querySelectorAll('[data-site-typography-carrier]').length,
      surfaceCount: native.querySelectorAll('[data-typography-prototype][data-pui-root]').length,
      invalidBlocks: native.querySelectorAll('div,section,p,h1,h2,h3,fieldset').length,
      nestedFocusable: native.querySelectorAll(
        '[data-site-typography-carrier] [tabindex], [data-site-typography-carrier] [role="button"]'
      ).length,
    }));
  });
}
function assertSourceIntegrity(measured: Awaited<ReturnType<typeof sourceIntegrity>>) {
  expect(measured.length).toBeGreaterThanOrEqual(8);
  for (const node of measured) {
    expect(node.connected).toBe(true);
    expect(node.originalSources).toBe(true);
    expect(node.text).toBe(node.expected);
    expect(node.textNodeCount).toBe(node.originalTextNodeCount);
    expect(node.carrierCount).toBe(1);
    expect(node.surfaceCount).toBe(1);
    expect(node.invalidBlocks).toBe(0);
    expect(node.nestedFocusable).toBe(0);
  }
}
async function typographyPaint(page: Page, selector: string) {
  return page.locator(selector).evaluate((native) => {
    const surface = native.querySelector<HTMLElement>('[data-typography-prototype]') ?? native;
    const css = getComputedStyle(surface);
    const box = surface.getBoundingClientRect();
    return {
      nativeTag: native.tagName,
      text: native.textContent,
      font: css.fontFamily,
      size: parseFloat(css.fontSize),
      weight: css.fontWeight,
      lineHeight: css.lineHeight,
      userSelect: css.userSelect,
      display: css.display,
      color: css.color,
      textTransform: css.textTransform,
      width: box.width,
      height: box.height,
      tokens: surface.getAttribute('data-pui-style'),
    };
  });
}
async function overflow(page: Page) {
  return page.evaluate(() => ({
    viewport: innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    rootFont: getComputedStyle(document.documentElement).fontSize,
    // Preserve the actual offenders when the aggregate width assertion fails.
    overflowNodes: [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && (box.right > innerWidth + 1 || box.left < -1);
      })
      .map((element) => ({
        tag: element.localName,
        class: element.className,
        text: element.textContent?.slice(0, 100),
        x: element.getBoundingClientRect().x,
        width: element.getBoundingClientRect().width,
        whiteSpace: getComputedStyle(element).whiteSpace,
      })),
  }));
}
async function copySelection(page: Page) {
  await page.keyboard.press('ControlOrMeta+C');
  return page.evaluate(() => navigator.clipboard.readText());
}

describe.sequential('native SiteTypography rendered evidence', () => {
  for (const runtime of RUNTIMES)
    for (const family of FAMILIES) {
      it(`${runtime}/${family}: native labels, accessibility, original nodes, genuine copy and cross-generation selection`, async () => {
        await runCase(
          `native-${runtime}-${family}`,
          async (page, context, record) => {
            await page.goto(baseUrl + FIXTURE, { waitUntil: 'networkidle' });
            await page.locator('#fixture-family').selectOption(family);
            await fixtureReady(page, runtime, family);
            record.initial = await sourceIntegrity(page);
            assertSourceIntegrity(record.initial as Awaited<ReturnType<typeof sourceIntegrity>>);
            await page.locator('#native-label').click();
            expect(
              await page
                .locator('#native-input')
                .evaluate((input) => document.activeElement === input)
            ).toBe(true);
            record.inputAX = await accessibleName(context, page, '#native-input');
            expect(record.inputAX).toEqual([
              { role: 'textbox', name: 'Your name 姓名', ignored: false },
            ]);
            record.groupAX = await accessibleName(context, page, '#native-group');
            expect(record.groupAX).toEqual([
              { role: 'group', name: 'Options 选项', ignored: false },
            ]);
            expect(
              await page
                .getByRole('heading', { name: 'Native typography acceptance', exact: true })
                .count()
            ).toBe(1);
            expect(
              await page.getByRole('textbox', { name: 'Your name 姓名', exact: true }).count()
            ).toBe(1);
            await page.locator('#native-link').click();
            expect(new URL(page.url()).hash).toBe('#native-target');
            // Real mouse paragraph selection, followed by OS-style browser copy.
            await page.locator('#native-copy').scrollIntoViewIfNeeded();
            const point = await page.locator('#native-copy').evaluate((p) => {
              const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
              const text = walker.nextNode()!;
              const range = document.createRange();
              range.setStart(text, 0);
              range.setEnd(text, 1);
              const rect = range.getBoundingClientRect();
              return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
            });
            await page.mouse.click(point.x, point.y, { clickCount: 3 });
            record.mouseSelectedText = await page.evaluate(() => getSelection()?.toString());
            expect((record.mouseSelectedText as string).trim().replace(/\s+/g, ' ')).toBe(COPY);
            record.mouseCopiedText = await copySelection(page);
            expect((record.mouseCopiedText as string).trim().replace(/\s+/g, ' ')).toBe(COPY);
            // A scripted backward native Selection isolates rematerialization from
            // the different selection caused by clicking a settings control.
            await page.evaluate(() => {
              const p = document.querySelector('#native-copy')!;
              const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
              const nodes: Node[] = [];
              while (walker.nextNode())
                if (walker.currentNode.textContent?.trim()) nodes.push(walker.currentNode);
              getSelection()!.setBaseAndExtent(
                nodes.at(-1)!,
                nodes.at(-1)!.textContent!.length,
                nodes[0]!,
                nodes[0]!.textContent!.indexOf('Alpha')
              );
            });
            record.rawBackwardBeforeReplacement = await page.evaluate(() =>
              getSelection()!.toString()
            );
            const next = RUNTIMES[(RUNTIMES.indexOf(runtime) + 1) % RUNTIMES.length]!;
            await page.evaluate(
              (adapter) =>
                document.dispatchEvent(
                  new CustomEvent('proto-adapter:change', { detail: { adapter } })
                ),
              next
            );
            await fixtureReady(page, next, family);
            record.backwardSelection = await page.evaluate(() => {
              const selection = getSelection()!;
              const p = document.querySelector('#native-copy')!;
              const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
              const nodes: Node[] = [];
              while (walker.nextNode())
                if (walker.currentNode.textContent?.trim()) nodes.push(walker.currentNode);
              return {
                text: selection.toString(),
                normalizedText: selection.toString().trim().replace(/\s+/g, ' '),
                anchorIsLastSource: selection.anchorNode === nodes.at(-1),
                focusIsFirstSource: selection.focusNode === nodes[0],
                anchorOffset: selection.anchorOffset,
                focusOffset: selection.focusOffset,
                focusAtFirstWord: selection.focusOffset === nodes[0]!.textContent!.indexOf('Alpha'),
              };
            });
            expect((record.backwardSelection as { text: string }).text).toBe(
              record.rawBackwardBeforeReplacement
            );
            expect(record.backwardSelection).toMatchObject({
              normalizedText: COPY,
              anchorIsLastSource: true,
              focusIsFirstSource: true,
              anchorOffset: 'native link'.length,
              focusAtFirstWord: true,
            });
            record.backwardCopiedText = await copySelection(page);
            expect((record.backwardCopiedText as string).trim().replace(/\s+/g, ' ')).toBe(COPY);
            record.afterReplacement = await sourceIntegrity(page);
            assertSourceIntegrity(
              record.afterReplacement as Awaited<ReturnType<typeof sourceIntegrity>>
            );
            await page.locator('#fixture-runtime').selectOption(runtime);
            await fixtureReady(page, runtime, family);
            await page.evaluate(() => document.fonts.ready);
            record.headingPaint = await typographyPaint(page, '#native-title');
            record.bodyPaint = await typographyPaint(page, '#latin-copy');
            expect((record.headingPaint as { size: number }).size).toBeGreaterThan(
              (record.bodyPaint as { size: number }).size
            );
            expect((record.bodyPaint as { size: number }).size).toBe(16);
            record.latinFonts = await platformFonts(
              context,
              page,
              '#latin-copy [data-site-typography-slot]'
            );
            record.cjkFonts = await platformFonts(
              context,
              page,
              '#cjk-copy [data-site-typography-slot]'
            );
            const latin = record.latinFonts as Awaited<ReturnType<typeof platformFonts>>;
            const cjk = record.cjkFonts as typeof latin;
            expect(latin.some((font) => font.glyphCount > 0)).toBe(true);
            expect(
              cjk.some((font) => font.glyphCount > 0 && !/^DM Sans(?:\s|$)/.test(font.familyName))
            ).toBe(true);
            expect(
              cjk.some((font) => font.glyphCount > 0 && /^DM Sans(?:\s|$)/.test(font.familyName))
            ).toBe(false);
            if (family === 'brutalist')
              expect(
                latin.some(
                  (font) =>
                    font.glyphCount > 0 &&
                    font.isCustomFont &&
                    /^DM Sans(?:\s|$)/.test(font.familyName)
                )
              ).toBe(true);
            await capture(page, record, `native-${runtime}-${family}`);
          },
          { runtime }
        );
      }, 90_000);
    }

  for (const locale of ['zh-cn', 'en'] as const)
    for (const runtime of RUNTIMES)
      for (const family of FAMILIES)
        it(`${locale}/${runtime}/${family}: real homepage generation and narrow text resize`, async () => {
          await runCase(
            `homepage-${locale}-${runtime}-${family}`,
            async (page, context, record) => {
              await page.setViewportSize({ width: 1280, height: 900 });
              await page.goto(`${baseUrl}/${locale}/`, { waitUntil: 'networkidle' });
              await homepageReady(page);
              await chooseHomepage(page, 'runtime', LABELS[runtime]);
              await chooseHomepage(page, 'family', family === 'shadcn' ? 'Shadcn' : 'Brutalist');
              await homepageReady(page, runtime, family);
              const measurements: unknown[] = [];
              record.states = measurements;
              const failures: string[] = [];
              // Four explicit independent observations per runtime/family. A narrow
              // assertion failure retains its frame and does not suppress later sizes.
              for (const width of [320, 390])
                for (const textPercent of [100, 200]) {
                  const state: Record<string, unknown> = { runtime, family, width, textPercent };
                  measurements.push(state);
                  try {
                    await page.setViewportSize({ width, height: 844 });
                    await page.evaluate((percent) => {
                      document.documentElement.style.fontSize = `${percent}%`;
                    }, textPercent);
                    await page.waitForFunction(
                      () =>
                        document.querySelector(
                          '[data-site-typography="slogan"] [data-pui-style~="text-2xl"]'
                        ),
                      undefined,
                      { timeout: 15_000 }
                    );
                    await page.evaluate(
                      () =>
                        new Promise<void>((resolve) =>
                          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
                        )
                    );
                    const slogan = await typographyPaint(page, '[data-site-typography="slogan"]');
                    const tagline = await typographyPaint(page, '[data-site-typography="tagline"]');
                    const geometry = await overflow(page);
                    const generation = await page.evaluate(() => {
                      const root = document.querySelector<HTMLElement>('[data-homepage-runtime]')!;
                      return {
                        page: root.dataset.runtimeGeneration,
                        text: document.querySelector<HTMLElement>(
                          '[data-site-typography="slogan"]'
                        )!.dataset.typographyGeneration,
                        runtime: root.dataset.runtime,
                        family: root.dataset.family,
                      };
                    });
                    const galleryText = await page
                      .locator('[data-home-showcase] [data-home-text]')
                      .evaluateAll((nodes) =>
                        nodes.map((node) => ({
                          text: node.textContent,
                          owners: Array.from(node.querySelectorAll('[data-pui-root]')).map(
                            (owner) => ({
                              prototype: owner.getAttribute('data-projection-prototype'),
                              runtime: owner.getAttribute('data-projection-runtime'),
                              family: owner.getAttribute('data-projection-family'),
                              generation: owner.getAttribute('data-projection-generation'),
                            })
                          ),
                        }))
                      );
                    expect(galleryText).toHaveLength(28);
                    for (const text of galleryText) {
                      expect(text.owners).toHaveLength(1);
                      expect(text.owners[0]).toMatchObject({
                        prototype: `${family}-text-root`,
                        runtime,
                        family,
                        generation: generation.page,
                      });
                    }
                    Object.assign(state, { slogan, tagline, geometry, generation, galleryText });
                    expect(slogan.text).toBe(SLOGANS[locale][0]);
                    expect(tagline.text).toBe(SLOGANS[locale][1]);
                    expect(slogan.size).toBeGreaterThan(tagline.size);
                    expect(slogan.textTransform).toBe('none');
                    expect(generation).toMatchObject({ runtime, family });
                    expect(generation.text).toBe(generation.page);
                    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewport + 1);
                    expect(geometry.bodyWidth).toBeLessThanOrEqual(geometry.viewport + 1);
                    state.outcome = 'passed';
                  } catch (error) {
                    state.outcome = 'failed';
                    state.error = String(error);
                    failures.push(`${width}/${textPercent}: ${error}`);
                  } finally {
                    await capture(
                      page,
                      record,
                      `homepage-${locale}-${runtime}-${family}-${width}-text${textPercent}-${state.outcome}`
                    );
                  }
                }
              await page.evaluate(() => {
                document.documentElement.style.fontSize = '100%';
              });
              await page.setViewportSize({ width: 390, height: 844 });
              await revealHeaderPreferences(page);
              await page.evaluate(() => document.fonts.ready);
              record.roleFonts = {};
              for (const [role, selector] of Object.entries({
                navigation: '[data-site-header-navigation] a',
                runtimeLabel: '[data-projection-control-label="runtime"]',
                galleryTitle: '[data-home-showcase] .home-gallery__title',
                galleryLabel: '[data-home-showcase] .home-settings__label',
                slogan: '[data-site-typography="slogan"]',
              }))
                (record.roleFonts as Record<string, unknown>)[role] = await renderedRoleFonts(
                  context,
                  page,
                  selector
                );
              await capture(
                page,
                record,
                `homepage-${locale}-${runtime}-${family}-mobile-role-fonts`
              );
              expect(failures, 'every configured viewport was attempted').toEqual([]);
            },
            { runtime }
          );
        }, 120_000);

  for (const family of FAMILIES)
    it(`${family}: real documentation follows shared runtime preferences with separate scope ownership`, async () => {
      await runCase(`docs-${family}`, async (page, _context, record) => {
        await page.goto(
          `${baseUrl}/en/ui-libraries/${family === 'brutalist' ? 'brutalist/components' : 'shadcn'}/button/`,
          {
            waitUntil: 'networkidle',
          }
        );
        const title = page.locator('h1[data-site-typography="h1"]');
        const originalTitle = await title.elementHandle();
        const states: unknown[] = [];
        record.states = states;
        for (const runtime of RUNTIMES) {
          await revealHeaderPreferences(page);
          const trigger = page.locator(
            '[data-docs-site-header] [data-adapter-select-root] [role="combobox"]'
          );
          await trigger.click();
          const id = await trigger.getAttribute('aria-controls');
          expect(id).toBeTruthy();
          const portal = page.locator(`[id=${JSON.stringify(id)}]`);
          await portal.getByRole('option', { name: LABELS[runtime], exact: true }).click();
          await portal.waitFor({ state: 'hidden' });
          await page.waitForFunction(
            ({ runtime, family }) => {
              const title = document.querySelector<HTMLElement>('h1[data-site-typography="h1"]');
              return (
                title?.dataset.typographyOwner === 'documentation-typography' &&
                title.dataset.typographyRuntime === runtime &&
                title.dataset.typographyFamily === family &&
                title.querySelector('[data-pui-root][data-typography-prototype]')
              );
            },
            { runtime, family },
            { timeout: 30_000 }
          );
          const generation = await title.getAttribute('data-typography-generation');
          // Public preview pickers may publish the common preference, and
          // adapter-panel examples intentionally omit a local picker. Observe
          // actual scope coordinates instead of inventing a private preference.
          const scopes = await page
            .locator('[data-previewer-id] [data-projection-scope]')
            .evaluateAll((nodes) =>
              nodes.map((node) => ({
                owner: node.getAttribute('data-projection-scope'),
                runtime: node.getAttribute('data-projection-runtime'),
                family: node.getAttribute('data-projection-family'),
                generation: node.getAttribute('data-projection-generation'),
              }))
            );
          expect(await page.locator('[data-previewer-id] [data-typography-owner]').count()).toBe(0);
          expect(await title.getAttribute('data-typography-runtime')).toBe(runtime);
          expect(await title.getAttribute('data-typography-generation')).toBe(generation);
          expect(
            await originalTitle!.evaluate(
              (node) =>
                node.isConnected && node === document.querySelector('h1[data-site-typography="h1"]')
            )
          ).toBe(true);
          states.push({
            runtime,
            family,
            scopes,
            generation,
            paint: await typographyPaint(page, 'h1[data-site-typography="h1"]'),
          });
        }
        await capture(page, record, `docs-${family}`);
      });
    }, 180_000);

  for (const mode of ['no-js', 'initial-module-failure'] as const)
    for (const target of ['homepage', 'native-fixture'] as const)
      it(`${target}/${mode}: original SSR hierarchy and native activation remain available`, async () => {
        await runCase(
          `${target}-${mode}`,
          async (page, context, record) => {
            let blocked = 0;
            if (mode === 'initial-module-failure') {
              record.injectedFailure =
                'Blocked actual site-typography module request before its first execution';
              await context.route(
                /\/site-typography(?:-client)?(?:\.proto)?\.ts(?:\?.*)?$/,
                async (route) => {
                  blocked++;
                  await route.abort('failed');
                }
              );
            }
            await page.setViewportSize({ width: 390, height: 844 });
            await page.goto(baseUrl + (target === 'homepage' ? '/zh-cn/' : FIXTURE), {
              waitUntil: 'networkidle',
            });
            if (mode === 'initial-module-failure')
              expect(
                blocked,
                'failure injection must reach a real requested module'
              ).toBeGreaterThan(0);
            expect(await page.locator('[data-typography-prototype]').count()).toBe(0);
            const title =
              target === 'homepage' ? '[data-site-typography="slogan"]' : '#native-title';
            const body =
              target === 'homepage' ? '[data-site-typography="tagline"]' : '#native-copy';
            record.headingPaint = await typographyPaint(page, title);
            record.bodyPaint = await typographyPaint(page, body);
            expect((record.headingPaint as { size: number }).size).toBeGreaterThan(
              (record.bodyPaint as { size: number }).size
            );
            expect((record.headingPaint as { height: number }).height).toBeGreaterThan(0);
            if (target === 'homepage') {
              expect(await page.locator(title).textContent()).toBe(SLOGANS['zh-cn'][0]);
              const link = page.locator(
                '#homepage-hero-actions [data-homepage-fallback] a[href="#home-demo-previewer"]'
              );
              expect(await link.isVisible()).toBe(true);
              await link.click();
              expect(new URL(page.url()).hash).toBe('#home-demo-previewer');
            } else {
              await page.locator('#native-label').click();
              expect(
                await page
                  .locator('#native-input')
                  .evaluate((input) => input === document.activeElement)
              ).toBe(true);
              expect(await accessibleName(context, page, '#native-input')).toEqual([
                { role: 'textbox', name: 'Your name 姓名', ignored: false },
              ]);
              await page.locator('#native-link').click();
              expect(new URL(page.url()).hash).toBe('#native-target');
            }
            record.blockedRequests = blocked;
            record.geometry = await overflow(page);
            await page.evaluate(() => scrollTo(0, 0));
            await capture(page, record, `${target}-${mode}`);
          },
          { noJS: mode === 'no-js' }
        );
      }, 90_000);
});

async function homepageReady(page: Page, runtime?: string, family?: string) {
  await page.waitForFunction(
    ({ runtime, family }) => {
      const root = document.querySelector<HTMLElement>('[data-homepage-runtime]');
      return (
        root?.dataset.runtimeState === 'ready' &&
        (!runtime || root.dataset.runtime === runtime) &&
        (!family || root.dataset.family === family)
      );
    },
    { runtime, family },
    { timeout: 30_000 }
  );
}
async function chooseHomepage(page: Page, control: string, label: string) {
  await revealHeaderPreferences(page);
  const trigger = page.locator(
    `[data-homepage-runtime] [data-projection-control="${control}"] [role="combobox"]`
  );
  await trigger.click();
  const id = await trigger.getAttribute('aria-controls');
  expect(id).toBeTruthy();
  const portal = page.locator(`[id=${JSON.stringify(id)}]`);
  await portal.getByRole('option', { name: label, exact: true }).click();
  await portal.waitFor({ state: 'hidden' });
  await homepageReady(page);
}

// Application composition only: public Text remains unchanged. These native
// owners must have useful matching line boxes even when no runtime can mount.
describe.sequential('document reading native fallback', () => {
  for (const [name, route, titleSize, titleLeading] of [
    ['shadcn', '/zh-cn/start-here/quick-start/', '30px', '37.5px'],
    ['brutalist', '/en/ui-libraries/brutalist/components/button/', '36px', '44px'],
    ['homepage', '/zh-cn/', '36px', '44px'],
  ] as const) {
    it(`${name}: retains its own no-JavaScript heading scale`, async () => {
      await runCase(
        `reading-fallback-${name}`,
        async (page, _context, record) => {
          await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
          const native = page.locator('main[data-pagefind-body] h1').first();
          const paint = await native.evaluate((node) => {
            const style = getComputedStyle(node);
            return { size: style.fontSize, leading: style.lineHeight, text: node.textContent };
          });
          record.headingPaint = paint;
          expect(paint.size).toBe(titleSize);
          expect(paint.leading).toBe(titleLeading);
          expect(await page.locator('[data-typography-prototype]').count()).toBe(0);
          if (name === 'shadcn') {
            record.descriptionPaint = await page
              .locator('main[data-pagefind-body] p[data-site-typography="tagline"]')
              .evaluate((node) => {
                const style = getComputedStyle(node);
                return { size: style.fontSize, leading: style.lineHeight };
              });
            expect(record.descriptionPaint).toEqual({ size: '16px', leading: '26px' });
          }
          await capture(page, record, `reading-fallback-${name}`);
        },
        { noJS: true }
      );
    }, 90_000);
  }
});
