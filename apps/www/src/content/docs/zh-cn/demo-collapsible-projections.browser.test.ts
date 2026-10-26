// @vitest-environment node

import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import type { Browser, Locator, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  RUNTIMES,
  choosePreviewRuntime,
  launchBrowser,
  openRoute,
  selectRuntime,
  startServer,
  stopServer,
} from './browser-harness';
import { revealHeaderPreferences } from './site-header-browser';
import {
  collectCollapsibleFocusFailure,
  collectCollapsibleFocusSample,
  collectCollapsibleViewConnections,
} from './collapsible-focus-observation';
import { probeCollapsibleFocusPaths } from './collapsible-focus-path-probe';

const FAMILIES = ['shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'] as const;
const route = (family: string, language = 'en') =>
  `/${language}/ui-libraries/${family}${family === 'brutalist' ? '/components' : ''}/collapsible/`;
let browser: Browser;
let baseUrl = '';

function disclosure(previewer: Locator, ref: string): Locator {
  return previewer.locator(`.host [data-demo-ref="${ref}"]`);
}

function trigger(root: Locator): Locator {
  return root.getByRole('button', { includeHidden: true });
}

function content(root: Locator): Locator {
  // WC retains a logical Custom Element while its host view is detached.
  return root.locator('[data-pui-root]:not([role="button"]):not([data-pui-view-detached])');
}

async function absentContent(root: Locator): Promise<void> {
  await expect.poll(() => content(root).count()).toBe(0);
  for (const placeholder of await root.locator('[data-pui-view-detached]').all()) {
    expect(await placeholder.isVisible()).toBe(false);
  }
}

async function selectCollapsibleRuntime(
  page: Page,
  previewer: Locator,
  family: string,
  runtime: (typeof RUNTIMES)[number]
): Promise<void> {
  if ((await previewer.getAttribute('data-projection-toolbar')) !== 'false')
    return selectRuntime(page, previewer, runtime, '[aria-expanded]', 4);
  // Only pages explicitly omitting their toolbar use the real site Header.
  // A subsequently declared family Select must be exercised through its toolbar.
  const openedMenu = await revealHeaderPreferences(page);
  const preferences = page.locator('[data-site-header] [data-site-header-preferences]');
  await choosePreviewRuntime(page, preferences, runtime);
  if (openedMenu) {
    const menu = page.locator('[data-docs-site-header] [data-site-menu-button]');
    if ((await menu.getAttribute('aria-expanded')) === 'true') await menu.click();
  }
  await expect.poll(() => previewer.getAttribute('data-projection-runtime')).toBe(runtime);
  await expect.poll(() => previewer.getAttribute('data-projection-state')).toBe('ready');
  await expect
    .poll(() => previewer.locator('[data-projection-content] [aria-expanded]').count())
    .toBe(4);
}

async function expanded(button: Locator, value: boolean): Promise<void> {
  await expect.poll(() => button.getAttribute('aria-expanded')).toBe(String(value));
}

async function focused(button: Locator): Promise<void> {
  // Read one strict current match without locator handle acquisition/layout reads.
  // Keep observing an evaluation still pending
  // when expect.poll expires. Post-timeout focus is not a prior successful sample.
  const startedAt = performance.now();
  const route = button.page().url();
  const maxRecordedSamples = 32;
  const samples: Array<{
    index: number;
    startedMs: number;
    settledMs?: number;
    result?: boolean;
    browser?: unknown;
    error?: string;
  }> = [];
  let failed = false;
  try {
    await expect
      .poll(async () => {
        // Vitest may retry a pending callback even after its outer timeout.
        // Keep that original behavior, but never extend this diagnostic's
        // lifetime or storage. Only pre-timeout samples can settle late below.
        if (failed || samples.length >= maxRecordedSamples)
          return (await button.evaluateAll(collectCollapsibleFocusSample)).focused;
        const sample: (typeof samples)[number] = {
          index: samples.length,
          startedMs: performance.now() - startedAt,
        };
        samples.push(sample);
        try {
          const observation = await button.evaluateAll(collectCollapsibleFocusSample);
          sample.result = observation.focused;
          sample.browser = observation;
          return observation.focused;
        } catch (sampleError) {
          sample.error = String(sampleError);
          throw sampleError;
        } finally {
          sample.settledMs = performance.now() - startedAt;
          if (failed)
            console.error(
              '[collapsible-focus-poll-late-settlement]',
              JSON.stringify({ route, nodeStartedAt: startedAt, sample })
            );
        }
      })
      .toBe(true);
  } catch (error) {
    failed = true;
    console.error(
      '[collapsible-focus-poll-timeout]',
      JSON.stringify({
        route,
        nodeTimeOrigin: performance.timeOrigin,
        nodeStartedAt: startedAt,
        failedMs: performance.now() - startedAt,
        maxRecordedSamples,
        sampleLimitReached: samples.length === maxRecordedSamples,
        error: String(error),
        samples,
      })
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const facts = await Promise.race([
        button.evaluateAll(collectCollapsibleFocusFailure),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Read-only focus diagnostic exceeded 1000ms')),
            1000
          );
        }),
      ]);
      console.error(
        '[collapsible-focus-failure]',
        JSON.stringify({ route: button.page().url(), facts })
      );
    } catch (diagnosticError) {
      console.error('[collapsible-focus-diagnostic-unavailable]', String(diagnosticError));
    } finally {
      clearTimeout(timer);
    }
    throw error;
  }
}

async function controls(root: Locator): Promise<string> {
  await expect.poll(() => trigger(root).getAttribute('aria-controls')).not.toBeNull();
  const id = (await trigger(root).getAttribute('aria-controls'))!;
  expect(await content(root).getAttribute('id')).toBe(id);
  expect(await content(root).getAttribute('role')).toBeNull();
  expect(await content(root).evaluate((element) => (element as HTMLElement).tabIndex)).toBe(-1);
  return id;
}

type ObservedInput = {
  type: string;
  trusted: boolean;
  key: string | null;
  targetRef: string | null;
  role: string | null;
  time: number;
};

async function trackInput(previewer: Locator): Promise<void> {
  await previewer.evaluate((element) => {
    const host = element as HTMLElement & {
      __puiCollapsibleEvidence?: ObservedInput[];
      __puiCollapsibleLastPointerTarget?: Element | null;
    };
    if (host.__puiCollapsibleEvidence) return;
    host.__puiCollapsibleEvidence = [];
    for (const type of [
      'pointerdown',
      'pointerup',
      'click',
      'keydown',
      'keyup',
      'focusin',
      'focusout',
    ]) {
      host.addEventListener(
        type,
        (event) => {
          const target = event.target instanceof Element ? event.target : null;
          if (type === 'pointerdown')
            host.__puiCollapsibleLastPointerTarget =
              target?.closest('[role="button"],button') ?? target;
          host.__puiCollapsibleEvidence!.push({
            type,
            trusted: event.isTrusted,
            key: event instanceof KeyboardEvent ? event.key : null,
            targetRef: target?.closest('[data-demo-ref]')?.getAttribute('data-demo-ref') ?? null,
            role: target?.getAttribute('role') ?? null,
            time: performance.now(),
          });
        },
        { capture: true }
      );
    }
  });
}

async function capture(previewer: Locator, name: string): Promise<void> {
  const directory = process.env.PROTO_UI_COLLAPSIBLE_SCREENSHOT_DIR;
  if (!directory) return;
  const captureStartedAt = name.startsWith('liquid-glass-') ? performance.now() : null;
  const captureStage = (stage: string, phase: 'start' | 'done') => {
    if (captureStartedAt === null) return;
    const nodeNow = performance.now();
    console.error(
      '[collapsible-capture-stage]',
      JSON.stringify({
        name,
        stage,
        phase,
        captureStartedAt,
        nodeNow,
        nodeTimeOrigin: performance.timeOrigin,
        elapsedMs: nodeNow - captureStartedAt,
      })
    );
  };
  captureStage('directory', 'start');
  await mkdir(directory, { recursive: true });
  captureStage('directory', 'done');
  captureStage('source', 'start');
  const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  captureStage('source', 'done');
  captureStage('layout', 'start');
  const observation = await previewer.evaluate((element) => {
    const host = element as HTMLElement & { __puiCollapsibleEvidence?: ObservedInput[] };
    return {
      url: location.href,
      runtime:
        host.dataset.projectionRuntime ??
        host.querySelector<HTMLElement>('[data-projection-runtime]')?.dataset.projectionRuntime ??
        null,
      family: host.dataset.projectionFamily ?? null,
      theme: document.documentElement.dataset.theme ?? null,
      darkClass: document.documentElement.classList.contains('dark'),
      rootFontSize: getComputedStyle(document.documentElement).fontSize,
      interaction: [...(host.__puiCollapsibleEvidence ?? [])],
      parts: Array.from(host.querySelectorAll<HTMLElement>('.host [data-pui-root]')).map((node) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return {
          tag: node.tagName.toLowerCase(),
          disclosure: node.closest('[data-demo-ref]')?.getAttribute('data-demo-ref') ?? null,
          role: node.getAttribute('role'),
          expanded: node.getAttribute('aria-expanded'),
          disabled: node.getAttribute('aria-disabled'),
          hidden: node.getAttribute('aria-hidden'),
          controls: node.getAttribute('aria-controls'),
          detached: node.hasAttribute('data-pui-view-detached'),
          text: node.textContent?.slice(0, 400),
          rect: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
          },
          clientWidth: node.clientWidth,
          scrollWidth: node.scrollWidth,
          style: {
            display: style.display,
            visibility: style.visibility,
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            lineHeight: style.lineHeight,
            paddingLeft: style.paddingLeft,
            paddingRight: style.paddingRight,
            paddingTop: style.paddingTop,
            paddingBottom: style.paddingBottom,
            color: style.color,
            backgroundColor: style.backgroundColor,
          },
        };
      }),
    };
  });
  captureStage('layout', 'done');
  const imageName = `${name}.png`;
  captureStage('png', 'start');
  await previewer.screenshot({
    path: path.join(directory, imageName),
    style: 'astro-dev-toolbar { visibility: hidden; }',
  });
  captureStage('png', 'done');
  captureStage('record', 'start');
  await writeFile(
    path.join(directory, `${name}.json`),
    JSON.stringify(
      {
        schemaVersion: 1,
        comparison: 'actual state comparison; not a before/after implementation claim',
        sourceSha,
        inputProvenance:
          'Playwright keyboard and pointer; focus setup may be programmatic. Observed isTrusted is not a human-input claim.',
        sourceDirty:
          execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
            encoding: 'utf8',
          }).trim().length > 0,
        name,
        image: imageName,
        viewport: previewer.page().viewportSize(),
        materialScope: name.startsWith('liquid-glass-')
          ? 'opaque intermediate presentation; optical material and GPUI paint pending'
          : 'family presentation',
        ...observation,
      },
      null,
      2
    ) + '\n'
  );
  captureStage('record', 'done');
}

beforeAll(async () => {
  baseUrl = await startServer(route(FAMILIES[0]));
  browser = await launchBrowser();
}, 150_000);

afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

// Runs only in a separate post-failure workflow step, never as an acceptance replacement.
if (process.env.PROTO_UI_COLLAPSIBLE_FOCUS_PATH_DIAGNOSTIC === '1') {
  describe.sequential('Collapsible independent focus-path diagnostic', () => {
    for (const runtime of RUNTIMES) {
      for (const order of ['AB', 'BA'] as const) {
        it(`${runtime} ${order} uses a fresh context`, async () => {
          const directory = process.env.PROTO_UI_COLLAPSIBLE_SCREENSHOT_DIR;
          if (!directory) throw new Error('Source-bound diagnostic output directory is required');
          await probeCollapsibleFocusPaths({
            browser,
            url: `${baseUrl}${route('liquid-glass')}`,
            directory: path.join(directory, 'diagnostics'),
            sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
            runtime,
            order,
            async prepare(page) {
              const previewer = page.locator('[data-previewer-id]').first();
              await trackInput(previewer);
              await selectCollapsibleRuntime(page, previewer, 'liquid-glass', runtime);
              return trigger(disclosure(previewer, 'uncontrolled'));
            },
            async verifyExpanded(page, button) {
              const root = disclosure(page.locator('[data-previewer-id]').first(), 'uncontrolled');
              await expanded(button, true);
              await expect.poll(() => content(root).isVisible()).toBe(true);
              await controls(root);
            },
          });
        }, 100_000);
      }
    }
  });
}

// T-COLLAPSIBLE-PROJECTIONS-0001: native activation, relationship, L1, retention,
// disabled, controlled ownership, domain isolation and terminal view cleanup.
// SDK/simulated-DOM evidence cannot establish these Chromium surface facts.
for (const family of FAMILIES) {
  const ROUTE = route(family);
  describe.sequential(`${family} Collapsible public browser evidence`, () => {
    for (const runtime of RUNTIMES) {
      it(`${runtime} preserves disclosure ownership through native input and view lifetimes`, async () => {
        const caseStartedAt = performance.now();
        // Node-only diagnostic. "done" records callback progress, not Vitest
        // acceptance: timed-out async work can settle after the next case starts.
        const tailStage = (stage: string, phase: 'start' | 'done') => {
          if (family !== 'liquid-glass') return;
          const nodeNow = performance.now();
          console.error(
            '[collapsible-tail-stage]',
            JSON.stringify({
              family,
              runtime,
              caseStartedAt,
              stage,
              phase,
              nodeNow,
              nodeTimeOrigin: performance.timeOrigin,
              elapsedMs: nodeNow - caseStartedAt,
            })
          );
        };
        tailStage('case-body', 'start');
        tailStage('open-route', 'start');
        const { context, page, previewer } = await openRoute(browser, baseUrl, ROUTE, {
          width: 1280,
          height: 900,
        });
        tailStage('open-route', 'done');
        try {
          tailStage('native-journey', 'start');
          await trackInput(previewer);
          await selectCollapsibleRuntime(page, previewer, family, runtime);
          const uncontrolled = disclosure(previewer, 'uncontrolled');
          const retained = disclosure(previewer, 'retained');
          const disabled = disclosure(previewer, 'disabled');
          const controlled = disclosure(previewer, 'controlled');
          const button = trigger(uncontrolled);

          // The initial closed default has no Content host view or dangling IDREF.
          await expanded(button, false);
          await absentContent(uncontrolled);
          expect(await button.getAttribute('aria-controls')).toBeNull();
          await expanded(trigger(retained), true);
          await expanded(trigger(disabled), true);
          await expanded(trigger(controlled), false);
          expect(await trigger(disabled).getAttribute('aria-disabled')).toBe('true');
          expect(
            await trigger(disabled).evaluate((element) => (element as HTMLElement).tabIndex)
          ).toBe(-1);
          await capture(previewer, `${family}-${runtime}-initial`);

          // Pointer activation focuses the Trigger, never the role-neutral Content.
          await button.click();
          await expanded(button, true);
          await expect.poll(() => content(uncontrolled).isVisible()).toBe(true);
          const identity = await controls(uncontrolled);
          await focused(button);
          await capture(previewer, `${family}-${runtime}-open`);

          // A focused Space closes once and cannot scroll the documentation.
          const scrollY = await page.evaluate(() => window.scrollY);
          await page.keyboard.press('Space');
          await expanded(button, false);
          await absentContent(uncontrolled);
          expect(await button.getAttribute('aria-controls')).toBeNull();
          expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
          await focused(button);
          await capture(previewer, `${family}-${runtime}-keyboard-focus-closed`);

          // Repeat L1 rematerialization: the reusable service restores the same
          // live logical reservation; activation never transfers focus to Content.
          for (let cycle = 0; cycle < 2; cycle += 1) {
            await page.keyboard.press('Enter');
            await expanded(button, true);
            expect(await controls(uncontrolled)).toBe(identity);
            await focused(button);
            if (cycle === 0) await capture(previewer, `${family}-${runtime}-keyboard-focus-open`);
            await page.keyboard.press('Enter');
            await expanded(button, false);
            await absentContent(uncontrolled);
            expect(await button.getAttribute('aria-controls')).toBeNull();
          }

          // Natural Tab follows authored order, not roving or Content focus entry.
          await page.keyboard.press('Tab');
          await focused(trigger(retained));
          const retainedIdentity = await controls(retained);
          await page.keyboard.press('Space');
          await expanded(trigger(retained), false);
          expect(await content(retained).count()).toBe(1);
          expect(await controls(retained)).toBe(retainedIdentity);
          expect(await content(retained).getAttribute('aria-hidden')).toBe('true');
          await expect.poll(() => content(retained).isVisible()).toBe(false);
          expect(
            await content(retained).evaluate((element) => getComputedStyle(element).display)
          ).toBe('none');

          // The disabled-but-open disclosure is skipped, not forcibly closed.
          await page.keyboard.press('Tab');
          await focused(trigger(controlled));
          await expanded(trigger(disabled), true);
          await expect.poll(() => content(disabled).isVisible()).toBe(true);

          // An ignored controlled request cannot optimistically open any part.
          await page.keyboard.press('Enter');
          await expanded(trigger(controlled), false);
          await absentContent(controlled);
          expect(await trigger(controlled).getAttribute('aria-controls')).toBeNull();
          await page.keyboard.press('Tab');
          const accept = previewer.getByRole('button', {
            name: 'Accept',
            exact: true,
          });
          await focused(accept);
          await page.keyboard.press('Enter');
          await expanded(trigger(controlled), true);
          await expect.poll(() => content(controlled).isVisible()).toBe(true);
          const controlledIdentity = await controls(controlled);
          expect(controlledIdentity).not.toBe(retainedIdentity);
          expect(controlledIdentity).not.toBe(await controls(disabled));
          await focused(accept);
          await expanded(button, false);
          await expanded(trigger(retained), false);
          tailStage('native-journey', 'done');
          tailStage('controlled-capture', 'start');
          await capture(previewer, `${family}-${runtime}-controlled-accepted`);
          tailStage('controlled-capture', 'done');

          // Changing the actual renderer terminally removes the old host views.
          // Host IDs may be reused by new owners; disconnection, not ID spelling,
          // proves the old physical views no longer belong to the live surface.
          tailStage('old-views', 'start');
          const oldViews = await previewer.locator('.host [data-pui-root]').elementHandles();
          tailStage('old-views', 'done');
          const nextRuntime = RUNTIMES[(RUNTIMES.indexOf(runtime) + 1) % RUNTIMES.length]!;
          tailStage('runtime-switch', 'start');
          await selectCollapsibleRuntime(page, previewer, family, nextRuntime);
          tailStage('runtime-switch', 'done');
          tailStage('old-view-disconnection', 'start');
          const oldConnections = await page.evaluate(collectCollapsibleViewConnections, oldViews);
          expect(oldConnections).toEqual(oldViews.map(() => false));
          tailStage('old-view-disconnection', 'done');
          tailStage('final-expanded-uncontrolled', 'start');
          await expanded(trigger(disclosure(previewer, 'uncontrolled')), false);
          tailStage('final-expanded-uncontrolled', 'done');
          tailStage('final-expanded-controlled', 'start');
          await expanded(trigger(disclosure(previewer, 'controlled')), false);
          tailStage('final-expanded-controlled', 'done');
          tailStage('case-body', 'done');
        } finally {
          tailStage('context-close', 'start');
          await context.close();
          tailStage('context-close', 'done');
        }
      }, 60_000);
    }

    for (const runtime of RUNTIMES) {
      it(`${runtime} preserves padding and wraps long text at 320px and 200% type`, async () => {
        const { context, page, previewer } = await openRoute(browser, baseUrl, ROUTE, {
          width: 320,
          height: 900,
        });
        try {
          await trackInput(previewer);
          await selectCollapsibleRuntime(page, previewer, family, runtime);
          await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
          const root = disclosure(previewer, 'uncontrolled');
          await trigger(root).click();
          await expanded(trigger(root), true);
          for (const theme of ['light', 'dark']) {
            await page.evaluate((value) => {
              document.documentElement.dataset.theme = value;
              document.documentElement.classList.toggle('dark', value === 'dark');
            }, theme);
            for (const target of [root, content(root)]) {
              const geometry = await target.evaluate((node) => {
                const element = node as HTMLElement;
                const box = element.getBoundingClientRect();
                const style = getComputedStyle(element);
                const geometry = Object.freeze({
                  left: box.left,
                  right: box.right,
                  width: box.width,
                  scrollWidth: element.scrollWidth,
                  clientWidth: element.clientWidth,
                  paddingLeft: parseFloat(style.paddingLeft),
                  paddingRight: parseFloat(style.paddingRight),
                });
                if (
                  !(geometry.width > 0 && geometry.left >= 0 && geometry.right <= 320) ||
                  !(geometry.scrollWidth - geometry.clientWidth <= 1)
                ) {
                  try {
                    const layout = (target: Element) => {
                      const css = getComputedStyle(target);
                      return {
                        display: css.display,
                        width: css.width,
                        minWidth: css.minWidth,
                        maxWidth: css.maxWidth,
                        boxSizing: css.boxSizing,
                        font: css.font,
                        padding: css.padding,
                        borderWidth: css.borderWidth,
                        margin: css.margin,
                        position: css.position,
                        transform: css.transform,
                        overflowX: css.overflowX,
                        gridTemplateColumns: css.gridTemplateColumns,
                        gridAutoColumns: css.gridAutoColumns,
                        flexBasis: css.flexBasis,
                        flexShrink: css.flexShrink,
                        flexGrow: css.flexGrow,
                        alignItems: css.alignItems,
                        alignSelf: css.alignSelf,
                        justifyContent: css.justifyContent,
                        justifySelf: css.justifySelf,
                      };
                    };
                    const ancestors = [];
                    let ancestor = element.parentElement;
                    for (let depth = 0; ancestor && depth < 8; depth++) {
                      const rect = ancestor.getBoundingClientRect();
                      ancestors.push({
                        tag: ancestor.localName,
                        id: ancestor.id,
                        className: ancestor.getAttribute('class'),
                        demoRef: ancestor.getAttribute('data-demo-ref'),
                        materialScene: ancestor.getAttribute('data-material-scene'),
                        rect: {
                          left: rect.left,
                          right: rect.right,
                          top: rect.top,
                          bottom: rect.bottom,
                          width: rect.width,
                          height: rect.height,
                        },
                        clientWidth: ancestor.clientWidth,
                        scrollWidth: ancestor.scrollWidth,
                        offsetWidth: ancestor.offsetWidth,
                        scrollLeft: ancestor.scrollLeft,
                        layout: layout(ancestor),
                      });
                      ancestor = ancestor.parentElement;
                    }
                    return {
                      ...geometry,
                      diagnostic: {
                        boundary: 'Adjacent same-turn reads after original geometry; not atomic.',
                        self: {
                          tag: element.localName,
                          tokens: element.getAttribute('data-pui-style'),
                          layout: layout(element),
                        },
                        viewport: {
                          width: window.innerWidth,
                          clientWidth: document.documentElement.clientWidth,
                          dpr: window.devicePixelRatio,
                        },
                        ancestors,
                        ancestorsTruncated: ancestor !== null,
                      },
                    };
                  } catch (error) {
                    return { ...geometry, diagnostic: { error: String(error) } };
                  }
                }
                return geometry;
              });
              if (
                !(geometry.width > 0 && geometry.left >= 0 && geometry.right <= 320) ||
                !(geometry.scrollWidth - geometry.clientWidth <= 1)
              )
                console.error(
                  `[collapsible-narrow-geometry] ${family}/${runtime}/${theme}/${target === root ? 'root' : 'content'}`,
                  JSON.stringify(geometry)
                );
              expect(geometry.width).toBeGreaterThan(0);
              expect(geometry.left).toBeGreaterThanOrEqual(0);
              expect(geometry.right).toBeLessThanOrEqual(320);
              expect(geometry.scrollWidth - geometry.clientWidth).toBeLessThanOrEqual(1);
            }
            const textBounds = await trigger(root).evaluate((node) => {
              const host = node as HTMLElement;
              const box = host.getBoundingClientRect();
              const style = getComputedStyle(host);
              const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
              const lines: Array<{ left: number; right: number }> = [];
              const glyphs: Array<{
                text: string;
                whitespace: boolean;
                left: number;
                right: number;
                top: number;
                bottom: number;
              }> = [];
              while (walker.nextNode()) {
                const text = walker.currentNode;
                if (!text.textContent?.trim()) continue;
                const range = document.createRange();
                range.selectNodeContents(text);
                for (const rect of range.getClientRects())
                  if (rect.width > 0) lines.push({ left: rect.left, right: rect.right });
                // Observe individual code points separately, but retain the
                // original whole-Range assertion until actual paint evidence
                // distinguishes hanging pre-wrap whitespace from visible text.
                let offset = 0;
                for (const glyph of text.textContent ?? '') {
                  const character = document.createRange();
                  character.setStart(text, offset);
                  offset += glyph.length;
                  character.setEnd(text, offset);
                  for (const rect of character.getClientRects()) {
                    if (rect.width > 0)
                      glyphs.push({
                        text: glyph,
                        whitespace: /^\s$/u.test(glyph),
                        left: rect.left,
                        right: rect.right,
                        top: rect.top,
                        bottom: rect.bottom,
                      });
                  }
                }
              }
              return {
                left: box.left,
                right: box.right,
                contentLeft:
                  box.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft),
                contentRight:
                  box.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight),
                lines,
                glyphs,
                whiteSpace: style.whiteSpace,
                overflowWrap: style.overflowWrap,
              };
            });
            // Preserve the failed target before any padding assertion. The
            // previous capture was after the assertion, losing all16 narrow
            // failures. A Trigger-only original avoids sticky site-header
            // occlusion in a tall whole-previewer screenshot.
            const evidenceDirectory = process.env.PROTO_UI_COLLAPSIBLE_SCREENSHOT_DIR;
            if (evidenceDirectory) {
              await mkdir(evidenceDirectory, { recursive: true });
              const name = `${family}-${runtime}-320-text200-${theme}-text-bounds`;
              const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], {
                encoding: 'utf8',
              }).trim();
              await trigger(root).screenshot({
                path: path.join(evidenceDirectory, `${name}-trigger.png`),
              });
              await writeFile(
                path.join(evidenceDirectory, `${name}.json`),
                JSON.stringify(
                  {
                    sourceSha,
                    sourceDirty:
                      execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
                        encoding: 'utf8',
                      }).trim().length > 0,
                    family,
                    runtime,
                    theme,
                    viewport: page.viewportSize(),
                    rootFontSize: await page.evaluate(
                      () => getComputedStyle(document.documentElement).fontSize
                    ),
                    screenshot: `${name}-trigger.png`,
                    screenshotSubject:
                      'actual Collapsible Trigger, no image editing or visibility mutation',
                    originalOracleRetained: true,
                    textBounds,
                    outlyingVisibleGlyphs: textBounds.glyphs.filter(
                      (glyph) =>
                        !glyph.whitespace &&
                        (glyph.left < textBounds.contentLeft - 1 ||
                          glyph.right > textBounds.contentRight + 1)
                    ),
                    outlyingWhitespaceGlyphs: textBounds.glyphs.filter(
                      (glyph) =>
                        glyph.whitespace &&
                        (glyph.left < textBounds.contentLeft - 1 ||
                          glyph.right > textBounds.contentRight + 1)
                    ),
                  },
                  null,
                  2
                )
              );
              await capture(
                previewer,
                `${family}-${runtime}-320-text200-${theme}-before-text-assertion`
              );
            }
            expect(textBounds.left).toBeGreaterThanOrEqual(0);
            expect(textBounds.right).toBeLessThanOrEqual(320);
            expect(textBounds.lines.length).toBeGreaterThan(0);
            for (const line of textBounds.lines) {
              expect(line.left).toBeGreaterThanOrEqual(textBounds.contentLeft - 1);
              expect(line.right).toBeLessThanOrEqual(textBounds.contentRight + 1);
            }
            for (const target of [trigger(root), content(root)]) {
              const padding = await target.evaluate((node) => {
                const s = getComputedStyle(node);
                return [parseFloat(s.paddingLeft), parseFloat(s.paddingRight)];
              });
              expect(Math.min(...padding)).toBeGreaterThanOrEqual(12);
            }
            await capture(previewer, `${family}-${runtime}-320-text200-${theme}-open`);
          }
          await trigger(root).focus();
          await page.keyboard.press('Space');
          await expanded(trigger(root), false);
          await absentContent(root);
        } finally {
          await context.close();
        }
      }, 60_000);
    }

    it('renders the Chinese narrow page through the same public disclosure', async () => {
      const { context, page, previewer } = await openRoute(
        browser,
        baseUrl,
        route(family, 'zh-cn'),
        { width: 390, height: 900 }
      );
      try {
        await trackInput(previewer);
        await selectCollapsibleRuntime(page, previewer, family, 'vue2');
        const root = disclosure(previewer, 'uncontrolled');
        await trigger(root).click();
        await expanded(trigger(root), true);
        await controls(root);
        await expect.poll(() => content(root).isVisible()).toBe(true);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth
          )
        ).toBeLessThanOrEqual(0);
        await capture(previewer, `${family}-vue2-zh-cn-390-open`);
      } finally {
        await context.close();
      }
    }, 60_000);
  });
}
