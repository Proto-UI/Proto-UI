// @vitest-environment node
import { execFileSync } from 'node:child_process';
import {
  copyPaintIssues,
  copySourceBindingIssues,
  type CopySourceBinding,
} from './copy-command-evidence';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Browser, Locator, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser, startServer, stopServer } from './browser-harness';

const ROUTE = '/zh-cn/start-here/quick-start/';
let browser: Browser;
let baseUrl: string;
let sourceBinding: CopySourceBinding;
const directory = join(process.env.RUNNER_TEMP || tmpdir(), 'homepage-evidence', 'copy-commands');
beforeAll(async () => {
  sourceBinding = {
    exactSHA: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()),
    expectedSHA: process.env.CANDIDATE_SHA ?? process.env.PROTO_UI_EXPECTED_REVISION ?? null,
    eventSHA: process.env.GITHUB_SHA ?? null,
  };
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'source-binding.json'), JSON.stringify(sourceBinding, null, 2));
  expect(copySourceBindingIssues(sourceBinding, Boolean(process.env.CI))).toEqual([]);
  baseUrl = await startServer(ROUTE);
  browser = await launchBrowser();
}, 300_000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
});

async function ready(root: Locator, runtime: string, family: string) {
  await root.page().waitForFunction(
    ({ selector, runtime, family }) => {
      const root = document.querySelector<HTMLElement>(selector);
      return (
        root?.dataset.copyView === 'ready' &&
        root.dataset.copyRuntime === runtime &&
        root.dataset.copyFamily === family
      );
    },
    {
      selector: await root.evaluate((el) => {
        el.id ||= `copy-test-${crypto.randomUUID()}`;
        return `#${el.id}`;
      }),
      runtime,
      family,
    }
  );
}
async function paint(button: Locator) {
  return button.evaluate((element) => {
    const style = getComputedStyle(element),
      rect = element.getBoundingClientRect(),
      glyph = element.querySelector('svg')!.getBoundingClientRect();
    const family = element.closest<HTMLElement>('[data-site-copy]')?.dataset.copyFamily;
    const ringColor = style.getPropertyValue('--pui-ring').trim();
    const expectedSpread = family === 'brutalist' ? 4 : 3;
    const expectedColor =
      family === 'brutalist' ? ringColor : `color-mix(in oklab, ${ringColor} 50%, transparent)`;
    // Resolve the independent source recipe in the same browser color serializer.
    // Keep the probe outside the live Prototype subtree and never derive it from
    // --pui-ring-shadow or the control's actual box-shadow under test.
    const probe = document.createElement('span');
    probe.style.cssText = 'position:fixed;left:-9999px;top:0;pointer-events:none';
    probe.style.boxShadow = `0 0 0 ${expectedSpread}px ${expectedColor}`;
    document.body.append(probe);
    const expectedRingShadow = getComputedStyle(probe).boxShadow;
    probe.style.boxShadow =
      family === 'brutalist'
        ? `0 0 0 2px ${style.getPropertyValue('--pui-background').trim()}`
        : 'none';
    const expectedRingOffsetShadow = getComputedStyle(probe).boxShadow;
    probe.remove();
    return {
      width: rect.width,
      height: rect.height,
      center: [
        Math.abs(rect.x + rect.width / 2 - glyph.x - glyph.width / 2),
        Math.abs(rect.y + rect.height / 2 - glyph.y - glyph.height / 2),
      ],
      glyph: [glyph.width, glyph.height],
      background: style.backgroundColor,
      shadow: style.boxShadow,
      expectedRingShadow,
      expectedRingOffsetShadow,
      transform: style.transform,
      translate: style.translate,
      hovered: element.hasAttribute('data-hovered'),
      pressed: element.hasAttribute('data-pressed'),
      focusVisible: element.hasAttribute('data-focus-visible'),
      tokens: element.getAttribute('data-pui-style'),
      focused: document.activeElement === element,
    };
  });
}
async function unfocusedPaint(button: Locator) {
  await button.page().mouse.move(0, 0);
  await button.evaluate((element: HTMLElement) => element.blur());
  await expect
    .poll(() =>
      button.evaluate(
        (element) =>
          document.activeElement === element ||
          ['data-hovered', 'data-pressed', 'data-focus-visible'].some((name) =>
            element.hasAttribute(name)
          )
      )
    )
    .toBe(false);
  await button.evaluate(async (element) => {
    await Promise.all(
      element.getAnimations().map((animation) => animation.finished.catch(() => {}))
    );
  });
  // Confirm stability rather than attributing a changed hard shadow to focus.
  await expect
    .poll(async () => {
      const before = await paint(button);
      await button.evaluate(
        () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      );
      const after = await paint(button);
      return (
        before.shadow === after.shadow &&
        before.transform === after.transform &&
        before.translate === after.translate &&
        before.background === after.background &&
        !after.focused &&
        !after.focusVisible &&
        !after.hovered &&
        !after.pressed
      );
    })
    .toBe(true);
  return paint(button);
}

async function observeCopyPage(page: Page) {
  const errors: Array<{ kind: string; text: string }> = [];
  page.on('pageerror', (error) =>
    errors.push({ kind: 'pageerror', text: error.stack ?? error.message })
  );
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type()))
      errors.push({ kind: message.type(), text: message.text() });
  });
  page.on('requestfailed', (request) =>
    errors.push({ kind: 'requestfailed', text: `${request.url()} ${request.failure()?.errorText}` })
  );
  await page.addInitScript(() => {
    const trace: unknown[] = [];
    const record = (kind: string, detail: unknown = null) => {
      if (trace.length < 1000) trace.push({ at: performance.now(), kind, detail });
    };
    (window as any).__copyEvidence = { trace, record };
    for (const type of ['DOMContentLoaded', 'astro:page-load', 'astro:before-swap'])
      document.addEventListener(type, () =>
        record(type, document.documentElement.dataset.siteLibraryFamily)
      );
    window.addEventListener('load', () =>
      record('window.load', document.documentElement.dataset.siteLibraryFamily)
    );
    new MutationObserver((records) => {
      for (const entry of records) {
        const node = entry.target as HTMLElement;
        record('attribute', {
          tag: node.localName,
          id: node.id,
          attribute: entry.attributeName,
          old: entry.oldValue,
          value: node.getAttribute(entry.attributeName!),
          copy: node.hasAttribute('data-site-copy'),
          scope: node.hasAttribute('data-site-family-scope'),
        });
      }
    }).observe(document, {
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: [
        'data-site-library-family',
        'data-projection-family',
        'data-copy-view',
        'data-copy-runtime',
        'data-copy-family',
      ],
    });
  });
  return errors;
}

async function evidence(page: Page, root: Locator | null, name: string, facts: unknown) {
  await mkdir(directory, { recursive: true });
  // Metadata is written even if there is no ready control. The old success-only
  // capture lost the exact three Install failures this evidence must distinguish.
  const observed = await page
    .evaluate(() => ({
      readyState: document.readyState,
      documentFamily: document.documentElement.dataset.siteLibraryFamily,
      theme: document.documentElement.dataset.theme,
      preferredRuntime: localStorage.getItem('preferred-prototypes-adapter'),
      trace: (window as any).__copyEvidence?.trace ?? [],
      roots: Array.from(document.querySelectorAll<HTMLElement>('[data-site-copy]')).map((root) => {
        const ancestors = [];
        for (let node: HTMLElement | null = root; node; node = node.parentElement)
          if (
            node.matches(
              '[data-site-library-family], [data-projection-family], [data-previewer-id], [data-adapter-panel]'
            )
          )
            ancestors.push({
              tag: node.localName,
              id: node.id,
              family: node.dataset.siteLibraryFamily,
              projectionFamily: node.dataset.projectionFamily,
              runtime: node.dataset.projectionRuntime,
              previewer: node.dataset.previewerId,
              sourceHost: node.dataset.adapterPanel,
            });
        return {
          id: root.id,
          view: root.dataset.copyView,
          runtime: root.dataset.copyRuntime,
          family: root.dataset.copyFamily,
          title: root.title,
          ancestors,
          generations: Array.from(
            root.querySelectorAll<HTMLElement>('[data-projection-generation-host]')
          ).map((host) => ({
            state: host.dataset.projectionGenerationState,
            runtime: host.dataset.projectionRuntime,
            family: host.dataset.projectionFamily,
            inert: host.inert,
          })),
          buttons: Array.from(
            root.querySelectorAll<HTMLElement>('[data-demo-ref="copy-button"]')
          ).map((button) => ({
            tag: button.localName,
            state: button.dataset.copyState,
            tokens: button.getAttribute('data-pui-style'),
            focused: document.activeElement === button,
            rect: button.getBoundingClientRect().toJSON(),
          })),
        };
      }),
    }))
    .catch((error) => ({ captureError: String(error) }));
  await writeFile(
    join(directory, `${name}.json`),
    JSON.stringify(
      {
        ...sourceBinding,
        viewport: page.viewportSize(),
        url: page.url(),
        ...(facts as object),
        observed,
      },
      null,
      2
    )
  );
  if (root && (await root.count()))
    await root.scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => {});
  const session = await page.context().newCDPSession(page);
  try {
    const capture = await session.send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(directory, `${name}.png`), Buffer.from(capture.data, 'base64'));
  } finally {
    await session.detach();
  }
}

async function recordFailure(
  page: Page,
  root: Locator | null,
  name: string,
  state: unknown,
  errors: unknown,
  error: unknown
) {
  await evidence(page, root, `${name}-failure`, {
    outcome: 'failed',
    state,
    errors,
    failure:
      error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
  }).catch((captureError) => console.error('[Copy evidence] failure capture failed', captureError));
}

async function applyFamilyFixture(page: Page, family: string) {
  await page.evaluate((family) => {
    (window as any).__copyEvidence?.record('fixture.family', {
      family,
      readyState: document.readyState,
    });
    document.documentElement.dataset.siteLibraryFamily = family;
    document
      .querySelectorAll<HTMLElement>('[data-site-family-scope]')
      .forEach((scope) => (scope.dataset.siteLibraryFamily = family));
  }, family);
}

describe.sequential('Copy commands: real consumer recipes across public runtimes', () => {
  it('writes the real browser clipboard from trusted activation', async () => {
    const context = await browser.newContext({
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    const page = await context.newPage();
    const errors = await observeCopyPage(page);
    try {
      await page.goto(`${baseUrl}${ROUTE}`, { waitUntil: 'domcontentloaded' });
      const root = page.locator('.expressive-code [data-site-copy]').first();
      await ready(root, 'wc', 'shadcn');
      const expected = await root.getAttribute('data-site-copy-text');
      await root.locator('[data-demo-ref="copy-button"]').click();
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLElement>('.expressive-code [data-demo-ref="copy-button"]')
            ?.dataset.copyState === 'success'
      );
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
      await evidence(page, root, 'trusted-clipboard', { outcome: 'passed', errors });
    } catch (error) {
      await recordFailure(page, null, 'trusted-clipboard', 'trusted clipboard', errors, error);
      throw error;
    } finally {
      await context.close();
    }
  }, 60_000);
  it('leaves exact selectable source available without JavaScript', async () => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 1000 },
    });
    const page = await context.newPage();
    const errors = await observeCopyPage(page);
    try {
      await page.goto(`${baseUrl}${ROUTE}`, { waitUntil: 'domcontentloaded' });
      const source = page.locator('.expressive-code pre').first();
      expect((await source.textContent())?.trim()).toBeTruthy();
      const facts = await source.evaluate((element) => ({
        selectable: getComputedStyle(element).userSelect !== 'none',
        overflow: getComputedStyle(element).overflowX,
      }));
      expect(facts.selectable).toBe(true);
      expect(['auto', 'scroll']).toContain(facts.overflow);
      expect(await page.locator('[data-site-copy] [role="button"]').count()).toBe(0);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
      ).toBeLessThanOrEqual(1);
      await evidence(page, source, 'nojs-source', { outcome: 'passed', errors });
    } catch (error) {
      await recordFailure(page, null, 'nojs-source', 'no JavaScript', errors, error);
      throw error;
    } finally {
      await context.close();
    }
  });
  for (const runtime of ['wc', 'react', 'vue', 'vue2']) {
    it(`${runtime}: InstallCommand keeps source-host identity separate from its Copy runtime`, async () => {
      const context = await browser.newContext({ viewport: { width: 390, height: 1000 } });
      await context.addInitScript((runtime) => {
        localStorage.setItem('preferred-prototypes-adapter', runtime);
        Object.assign(window, { __installCopyWrites: [] });
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: {
            writeText(text: string) {
              (window as any).__installCopyWrites.push(text);
              return Promise.resolve();
            },
          },
        });
      }, runtime);
      const page = await context.newPage();
      const errors = await observeCopyPage(page);
      const stage = { action: 'navigate', family: 'shadcn' };
      let observedRoot: Locator | null = null;
      try {
        await page.goto(`${baseUrl}/zh-cn/ui-libraries/shadcn/button/`, {
          waitUntil: 'domcontentloaded',
        });
        // This older documentation has no Vue2 installation snippet. Expose its
        // real WC source card as a labelled fixture; do not invent a Vue2 command.
        if (runtime === 'vue2')
          await page
            .locator('[data-install-command-card]')
            .first()
            .evaluate((card) => {
              const panel = card.closest<HTMLElement>('[data-adapter-panel]')!;
              panel.style.display = '';
              panel.dataset.copyFixture = 'wc-source-vue2-renderer';
            });
        const card = page.locator('[data-install-command-card]:visible').first();
        await card.waitFor();
        const root = card.locator('[data-site-copy]');
        observedRoot = root;
        const expected = await card
          .locator('[data-command-panel]:not([hidden]) [data-command]')
          .textContent();
        for (const family of ['shadcn', 'brutalist']) {
          stage.family = family;
          stage.action = 'family input and ready';
          await applyFamilyFixture(page, family);
          await ready(root, runtime, family);
          stage.action = 'trusted copy activation';
          const button = root.locator('[data-demo-ref="copy-button"]');
          const count = await page.evaluate(() => (window as any).__installCopyWrites.length);
          await button.click();
          await page.waitForFunction(
            (count) => (window as any).__installCopyWrites.length === count + 1,
            count
          );
          expect(await page.evaluate(() => (window as any).__installCopyWrites.at(-1))).toBe(
            expected
          );
          const facts = await paint(button);
          expect(facts.glyph).toEqual([18, 18]);
          expect(Math.max(...facts.center)).toBeLessThanOrEqual(1);
          await evidence(page, root, `${runtime}-${family}-install`, {
            runtime,
            family,
            sourceHostFixture: runtime === 'vue2' ? 'existing wc snippet' : false,
            familyInput: 'explicit docs consumer fixture',
            errors,
            stage: { ...stage },
            facts,
          });
        }
      } catch (error) {
        await recordFailure(
          page,
          observedRoot,
          `${runtime}-${stage.family}-install`,
          stage,
          errors,
          error
        );
        throw error;
      } finally {
        await context.close();
      }
    }, 90_000);
  }
  for (const runtime of ['wc', 'react', 'vue', 'vue2'])
    for (const family of ['shadcn', 'brutalist']) {
      it(`${runtime}/${family}: exact EC and CodePanel payload, paint, keyboard, failure and repeat`, async () => {
        const context = await browser.newContext({
          viewport: { width: runtime === 'wc' ? 1440 : 390, height: 1000 },
        });
        await context.addInitScript((runtime) => {
          localStorage.setItem('preferred-prototypes-adapter', runtime);
          const state = { writes: [] as string[], fail: false };
          Object.assign(window, { __copyFixture: state });
          Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: {
              writeText(text: string) {
                state.writes.push(text);
                return state.fail ? Promise.reject(new Error('fixture denial')) : Promise.resolve();
              },
            },
          });
          // Deliberate negative control: no successful fallback may mask a rejection.
          Object.defineProperty(document, 'execCommand', {
            configurable: true,
            value: () => false,
          });
        }, runtime);
        const page = await context.newPage();
        const errors = await observeCopyPage(page);
        const stage = { action: 'navigate', family, index: -1, theme: 'light' };
        let observedRoot: Locator | null = null;
        try {
          await page.goto(`${baseUrl}${ROUTE}`, { waitUntil: 'domcontentloaded' });
          await page.waitForSelector('[data-code-panel-init="1"]:visible');
          // Docs has no family picker. This explicit consumer-input fixture uses
          // the same family markers as applySiteLibraryFamily; screenshots label it.
          stage.family = family;
          stage.action = 'family input and ready';
          await applyFamilyFixture(page, family);
          const panel = page.locator('[data-code-shell]:visible').first();
          await panel.waitFor();
          const toggle = panel.locator('[data-code-toggle]');
          if (await toggle.isVisible()) await toggle.click();
          const roots = [
            page.locator('.expressive-code [data-site-copy]').first(),
            panel.locator('[data-site-copy]'),
          ];
          for (const [index, root] of roots.entries()) {
            stage.index = index;
            observedRoot = root;
            stage.action = 'ready';
            await ready(root, runtime, family);
            const button = root.locator('[data-demo-ref="copy-button"]');
            const expected = await root.evaluate((root) =>
              root.hasAttribute('data-site-copy-text')
                ? root.getAttribute('data-site-copy-text')
                : root.closest('[data-code-shell]')!.querySelector<HTMLElement>('code')!.dataset
                    .rawCode
            );
            const name = await button.textContent();
            expect(name?.trim()).toBeTruthy();
            for (const theme of ['light', 'dark']) {
              stage.theme = theme;
              stage.action = 'baseline';
              await page.evaluate(
                (theme) => (document.documentElement.dataset.theme = theme),
                theme
              );
              const baseline = await unfocusedPaint(button);
              expect([baseline.width, baseline.height]).toEqual(
                family === 'shadcn' ? [32, 32] : [40, 40]
              );
              expect(baseline.glyph).toEqual([18, 18]);
              expect(Math.max(...baseline.center)).toBeLessThanOrEqual(1);
              // Record baseline before any assertion on the first interactive state.
              await evidence(page, root, `${runtime}-${family}-${index}-${theme}-baseline`, {
                runtime,
                family,
                theme,
                baseline,
                errors,
              });
              stage.action = 'hover';
              await button.hover();
              await expect
                .poll(async () =>
                  copyPaintIssues(
                    family as 'shadcn' | 'brutalist',
                    baseline,
                    await paint(button),
                    'hover'
                  )
                )
                .toEqual([]);
              const hovered = await paint(button);
              stage.action = 'pressed';
              await page.mouse.down();
              try {
                await expect
                  .poll(async () =>
                    copyPaintIssues(
                      family as 'shadcn' | 'brutalist',
                      hovered,
                      await paint(button),
                      'pressed'
                    )
                  )
                  .toEqual([]);
                await evidence(page, root, `${runtime}-${family}-${index}-${theme}-pressed`, {
                  runtime,
                  family,
                  theme,
                  baseline,
                  hovered,
                  pressed: await paint(button),
                  errors,
                });
              } finally {
                // Release away from the command so the paint probe itself does not copy.
                await page.mouse.move(0, 0);
                await page.mouse.up();
              }
              stage.action = 'focus baseline';
              const unfocused = await unfocusedPaint(button);
              await evidence(page, root, `${runtime}-${family}-${index}-${theme}-unfocused`, {
                runtime,
                family,
                theme,
                unfocused,
                errors,
              });
              stage.action = 'focus';
              await page.keyboard.press('Tab');
              await button.focus();
              await expect
                .poll(async () =>
                  copyPaintIssues(
                    family as 'shadcn' | 'brutalist',
                    unfocused,
                    await paint(button),
                    'focus'
                  )
                )
                .toEqual([]);
              const focused = await paint(button);
              await evidence(page, root, `${runtime}-${family}-${index}-${theme}-focus`, {
                runtime,
                family,
                theme,
                familyInput: 'explicit docs consumer fixture',
                baseline,
                hovered,
                unfocused,
                focused,
              });
            }
            for (const key of ['Enter', 'Space']) {
              stage.action = `keyboard ${key}`;
              const count = await page.evaluate(
                () => ((window as any).__copyFixture.writes as string[]).length
              );
              await button.focus();
              expect(await button.evaluate((element) => document.activeElement === element)).toBe(
                true
              );
              const beforeScroll = await page.evaluate(() => scrollY);
              await page.keyboard.press(key);
              await page.waitForFunction(
                (count) => ((window as any).__copyFixture.writes as string[]).length === count + 1,
                count
              );
              await page.waitForFunction(
                ({ selector }) =>
                  document.querySelector<HTMLElement>(selector)?.dataset.copyState === 'success',
                { selector: `#${await root.getAttribute('id')} [data-demo-ref="copy-button"]` }
              );
              const writes = await page.evaluate(
                () => (window as any).__copyFixture.writes as string[]
              );
              expect(writes.length).toBe(count + 1);
              expect(writes.at(-1)).toBe(expected);
              expect(await button.textContent()).toBe(name);
              expect(await root.locator('[role="status"]').textContent()).toContain('已复制');
              // Copy remains focusable while pending; the effect owner handles
              // overlap. Settlement must not steal focus or allow Space scrolling.
              expect(await button.evaluate((element) => document.activeElement === element)).toBe(
                true
              );
              expect(await page.evaluate(() => scrollY)).toBe(beforeScroll);
            }
            stage.action = 'clipboard rejection';
            await page.evaluate(() => {
              (window as any).__copyFixture.fail = true;
            });
            await button.click();
            await page.waitForFunction(
              ({ selector }) =>
                document.querySelector<HTMLElement>(selector)?.dataset.copyState === 'error',
              { selector: `#${await root.getAttribute('id')} [data-demo-ref="copy-button"]` }
            );
            expect(await root.locator('[role="status"]').textContent()).toContain('复制失败');
            stage.action = 'clipboard retry';
            await page.evaluate(() => {
              (window as any).__copyFixture.fail = false;
            });
            await button.click();
            await page.waitForFunction(
              ({ selector }) =>
                document.querySelector<HTMLElement>(selector)?.dataset.copyState === 'success',
              { selector: `#${await root.getAttribute('id')} [data-demo-ref="copy-button"]` }
            );
            expect(await button.textContent()).toBe(name);
          }
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
          ).toBeLessThanOrEqual(1);
          expect(await page.locator('.expressive-code .copy button').count()).toBe(0);
        } catch (error) {
          await recordFailure(
            page,
            observedRoot,
            `${runtime}-${family}-${stage.index}-${stage.theme}`,
            stage,
            errors,
            error
          );
          throw error;
        } finally {
          await context.close();
        }
      }, 90_000);
    }
});
