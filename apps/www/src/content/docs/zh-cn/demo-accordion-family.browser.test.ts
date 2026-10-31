// @vitest-environment node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { collectLiquidMaterialObservation } from './liquid-material-observation';
import { withLiquidCardFailureObservation } from './library-liquid-card-observation';
import {
  collectAccordionPendingObservation,
  readAccordionSourceBinding,
} from './accordion-pending-observation';
import type { Browser, Locator, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  RUNTIMES,
  applyColorScheme,
  choosePreviewRuntime,
  launchBrowser,
  openRoute,
  selectRuntime,
  startServer,
  stopServer,
  waitForPreviewRuntime,
} from './browser-harness';
import { revealHeaderPreferences } from './site-header-browser';
import {
  installAccordionInputJournal,
  createAccordionActivationObservation,
} from './accordion-activation-observation';
let activation: ReturnType<typeof createAccordionActivationObservation> = null;
const families = ['base', 'shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'];
const route = (family: string, locale = 'en') => `/${locale}/ui-libraries/${family}/accordion/`;
let browser: Browser,
  baseUrl = '';
const ref = (previewer: Locator, id: string) => previewer.locator(`.host [data-demo-ref="${id}"]`);
const expanded = async (button: Locator, value: boolean) => {
  const poll = activation?.beginPoll(value);
  try {
    await expect
      .poll(() => {
        const read = () => button.getAttribute('aria-expanded');
        return activation && poll ? activation.read(poll, read) : read();
      })
      .toBe(String(value));
    if (poll) activation?.pass(poll);
  } catch (error) {
    if (poll) activation?.fail(poll);
    throw error;
  }
};
// Canonical expanded can precede React's Content view commit. Wait only for
// materialization readiness, then assert IDREFs immediately (never poll the relation).
const materialized = async (content: Locator) => {
  await expect
    .poll(() =>
      content.evaluateAll(
        (nodes) =>
          nodes.length === 1 &&
          !nodes[0].hasAttribute('data-pui-view-pending') &&
          !nodes[0].hasAttribute('data-pui-view-detached')
      )
    )
    .toBe(true);
};
const focused = async (button: Locator) => {
  await expect.poll(() => button.evaluate((el) => document.activeElement === el)).toBe(true);
};
async function selectAccordionRuntime(
  page: Page,
  previewer: Locator,
  runtime: (typeof RUNTIMES)[number]
): Promise<void> {
  if ((await previewer.getAttribute('data-projection-toolbar')) !== 'false')
    return selectRuntime(page, previewer, runtime, '[aria-expanded]', 11);
  // A page that explicitly omits its family toolbar uses the visible Header
  // preference. When a real family Select is introduced, exercise that toolbar.
  const openedMenu = await revealHeaderPreferences(page);
  const preferences = page.locator('[data-site-header] [data-site-header-preferences]');
  await choosePreviewRuntime(page, preferences, runtime);
  if (openedMenu) {
    const menu = page.locator('[data-docs-site-header] [data-site-menu-button]');
    if ((await menu.getAttribute('aria-expanded')) === 'true') await menu.click();
  }
  await waitForPreviewRuntime(page, runtime, '[aria-expanded]', 11);
}

async function observeLayout(page: Page) {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    return {
      viewportWidth,
      pageOverflow: document.documentElement.scrollWidth - viewportWidth,
      overflowing: Array.from(document.querySelectorAll<HTMLElement>('body *'))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          const clipping = [];
          for (let parent = element.parentElement; parent; parent = parent.parentElement) {
            if (['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(parent).overflowX)) {
              const bounds = parent.getBoundingClientRect();
              clipping.push({
                tag: parent.tagName,
                className: parent.className,
                left: bounds.left,
                right: bounds.right,
                clientWidth: parent.clientWidth,
                scrollWidth: parent.scrollWidth,
              });
            }
          }
          return {
            clipping,
            tag: element.tagName.toLowerCase(),
            ref: element.dataset.demoRef ?? null,
            role: element.getAttribute('role'),
            className: element.getAttribute('class'),
            text: element.textContent?.slice(0, 120),
            left: rect.left,
            right: rect.right,
            width: rect.width,
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            display: style.display,
            visibility: style.visibility,
            position: style.position,
            overflowX: style.overflowX,
            minWidth: style.minWidth,
            whiteSpace: style.whiteSpace,
            overflowWrap: style.overflowWrap,
            gridTemplateColumns: style.gridTemplateColumns,
          };
        })
        .filter(
          (item) =>
            item.width > 0 &&
            (item.right > viewportWidth + 1 ||
              item.left < -1 ||
              item.scrollWidth > item.clientWidth + 1)
        ),
    };
  });
}

async function observeContentFlow(content: Locator) {
  return content.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const child = element.firstElementChild;
    const childRect = child?.getBoundingClientRect();
    return {
      tag: element.tagName,
      runtime: element.getAttribute('data-projection-runtime'),
      tokens: element.getAttribute('data-pui-style'),
      display: style.display,
      paddingLeft: parseFloat(style.paddingLeft),
      paddingRight: parseFloat(style.paddingRight),
      paddingBottom: parseFloat(style.paddingBottom),
      borderLeft: parseFloat(style.borderLeftWidth),
      borderRight: parseFloat(style.borderRightWidth),
      borderBottom: parseFloat(style.borderBottomWidth),
      rect: { left: rect.left, right: rect.right, bottom: rect.bottom, height: rect.height },
      child: childRect
        ? {
            left: childRect.left,
            right: childRect.right,
            bottom: childRect.bottom,
            height: childRect.height,
          }
        : null,
      rootFontSize: parseFloat(getComputedStyle(document.documentElement).fontSize),
    };
  });
}

function assertContentFlow(facts: Awaited<ReturnType<typeof observeContentFlow>>) {
  expect(facts.display).toBe('block');
  expect(facts.child).not.toBeNull();
  expect(facts.child!.height).toBeGreaterThan(0);
  expect(
    Math.abs(facts.child!.left - facts.rect.left - facts.borderLeft - facts.paddingLeft)
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(facts.rect.right - facts.child!.right - facts.borderRight - facts.paddingRight)
  ).toBeLessThanOrEqual(1);
  expect(facts.rect.bottom - facts.child!.bottom - facts.borderBottom).toBeGreaterThanOrEqual(
    facts.paddingBottom - 1
  );
}

async function capture(
  previewer: Locator,
  name: string,
  subject: { family: string; runtime: string; state: string; contentFlow?: unknown }
) {
  const base =
    process.env.PROTO_UI_ACCORDION_SCREENSHOT_DIR ??
    (process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR
      ? path.join(process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR, 'accordion')
      : null);
  if (!base) return;
  await mkdir(base, { recursive: true });
  const source = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  await previewer.screenshot({
    path: path.join(base, `${source.slice(0, 12)}-${name}.png`),
    style: 'astro-dev-toolbar { visibility: hidden; }',
  });
  if (name.includes('320-text200'))
    await previewer
      .page()
      .screenshot({ path: path.join(base, `${source.slice(0, 12)}-${name}-viewport.png`) });
  await writeFile(
    path.join(base, `${source.slice(0, 12)}-${name}.json`),
    JSON.stringify(
      {
        sourceSha: source,
        sourceDirty:
          execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
            encoding: 'utf8',
          }).trim().length > 0,
        layout: await observeLayout(previewer.page()),
        material:
          subject.family === 'liquid-glass'
            ? await Promise.all(
                (await previewer.locator('[aria-expanded]').all()).map((node) =>
                  node.evaluate(collectLiquidMaterialObservation)
                )
              )
            : [],
        fixture: 'demo-accordion-family.browser.test.ts',
        name,
        ...subject,
        rect: await previewer.boundingBox(),
        aria: await previewer.locator('[aria-expanded]').evaluateAll((elements) =>
          elements.map((el) => ({
            ref: (el as HTMLElement).dataset.demoRef ?? null,
            expanded: el.getAttribute('aria-expanded'),
            disabled: el.getAttribute('aria-disabled'),
            controls: el.getAttribute('aria-controls'),
          }))
        ),
        trustedInputs: await previewer
          .page()
          .evaluate(() => (window as any).__accordionInputEvidence ?? []),
        checkedAt: new Date().toISOString(),
        viewport: previewer.page().viewportSize(),
        environment: await previewer.page().evaluate(() => ({
          theme: document.documentElement.dataset.theme ?? null,
          colorScheme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
          devicePixelRatio,
          rootFontSize: getComputedStyle(document.documentElement).fontSize,
        })),
        comparison:
          'Same source, runtime and viewport across family/state captures; no historical before-image exists.',
      },
      null,
      2
    )
  );
}
beforeAll(async () => {
  baseUrl = await startServer(route('base'));
  browser = await launchBrowser();
}, 150_000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);
describe.sequential('Accordion five families / four native Web consumers', () => {
  for (const family of families)
    for (const runtime of RUNTIMES)
      it(`${family} ${runtime} preserves activation, natural Tab, ownership, relationships and repeatable lifetime`, async () => {
        const { context, page, previewer } = await openRoute(browser, baseUrl, route(family), {
          width: 1280,
          height: 1000,
        });
        try {
          await page.evaluate(
            installAccordionInputJournal,
            !!process.env.PROTO_UI_ACCORDION_ACTIVATION_PROBE_DIR &&
              family === 'liquid-glass' &&
              runtime === 'react'
          );
          await applyColorScheme(page, 'light');
          await selectAccordionRuntime(page, previewer, runtime);
          const first = ref(previewer, 'single-overview-trigger'),
            second = ref(previewer, 'single-lifetime-trigger'),
            long = ref(previewer, 'single-long-trigger');
          if (family === 'liquid-glass' && runtime === 'react')
            activation = createAccordionActivationObservation(page, second);
          await expanded(first, true);
          await expanded(second, false);
          await capture(ref(previewer, 'single'), `${family}-${runtime}-light-initial-open`, {
            family,
            runtime,
            state: 'initial-open',
          });
          await first.focus();
          await page.keyboard.press('Enter');
          await expanded(first, false);
          await capture(
            ref(previewer, 'single'),
            `${family}-${runtime}-light-closed-keyboard-focus`,
            { family, runtime, state: 'closed-keyboard-focus' }
          );
          await page.keyboard.press('Enter');
          await expanded(first, true);
          await first.focus();
          await page.keyboard.press('ArrowDown');
          await focused(second);
          await expanded(first, true);
          await expanded(second, false);
          await page.keyboard.press('Enter');
          await expanded(first, false);
          await expanded(second, true);
          await focused(second);
          await materialized(ref(previewer, 'single-lifetime-content'));
          const id = await second.getAttribute('aria-controls');
          expect(id).toBeTruthy();
          expect(await ref(previewer, 'single-lifetime-content').getAttribute('id')).toBe(id);
          expect(
            await ref(previewer, 'single-lifetime-content').getAttribute('aria-labelledby')
          ).toBe(await second.getAttribute('id'));
          const scrollY = await page.evaluate(() => window.scrollY);
          activation?.setPhase('second-space-close');
          await page.keyboard.press('Space');
          await expanded(second, false);
          expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
          expect(await second.getAttribute('aria-controls')).toBeNull();
          activation?.setPhase('second-fresh-enter');
          await page.keyboard.press('Enter');
          await expanded(second, true);
          await materialized(ref(previewer, 'single-lifetime-content'));
          expect(await second.getAttribute('aria-controls')).toBe(id);
          expect(await ref(previewer, 'single-lifetime-content').getAttribute('id')).toBe(id);
          expect(
            await ref(previewer, 'single-lifetime-content').getAttribute('aria-labelledby')
          ).toBe(await second.getAttribute('id'));
          activation?.setPhase('after-target');
          await page.keyboard.press('Tab');
          await focused(long); // disabled header is skipped; no auto focusable Content
          await page.keyboard.press('Home');
          await focused(first);
          await page.keyboard.press('End');
          await focused(long);
          await expanded(second, true);
          await capture(previewer, `${family}-${runtime}-open-focus`, {
            family,
            runtime,
            state: 'open-keyboard-focus',
          });
          const required = ref(previewer, 'multiple-a-trigger');
          expect(await required.getAttribute('aria-disabled')).toBe('true');
          await required.focus();
          await page.keyboard.press('Enter');
          await expanded(required, true);
          const retainedId = await required.getAttribute('aria-controls');
          await ref(previewer, 'multiple-b-trigger').click();
          await required.click();
          await expanded(required, false);
          expect(await required.getAttribute('aria-controls')).toBe(retainedId);
          expect(await ref(previewer, 'multiple-a-content').isVisible()).toBe(false);
          if (family === 'shadcn') {
            // The family open-flow rule must not defeat retained Base hiding.
            expect(await ref(previewer, 'multiple-a-content').count()).toBe(1);
            expect(
              await ref(previewer, 'multiple-a-content').evaluate(
                (el) => getComputedStyle(el).display
              )
            ).toBe('none');
          }
          const rtl = ref(previewer, 'rtl-a-trigger');
          await rtl.focus();
          await page.keyboard.press('ArrowLeft');
          await focused(ref(previewer, 'rtl-b-trigger'));
          await expanded(rtl, false);
          const controlled = ref(previewer, 'controlled-a-trigger');
          await controlled.click();
          await expanded(controlled, false);
          await ref(previewer, 'accept').click();
          await expanded(controlled, true);
          await first.click();
          await expanded(first, true);
          await withLiquidCardFailureObservation(
            () => ref(previewer, 'nested-overview-trigger').click(),
            () =>
              ref(previewer, 'nested-overview-trigger').evaluate(
                collectAccordionPendingObservation
              ),
            async (facts) => {
              const directory =
                process.env.PROTO_UI_ACCORDION_SCREENSHOT_DIR ??
                (process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR
                  ? path.join(process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR, 'accordion')
                  : null);
              if (!directory) return;
              await mkdir(directory, { recursive: true });
              const { sourceSha, sourceTree, sourceDirty } = readAccordionSourceBinding((args) =>
                execFileSync('git', args, { encoding: 'utf8' })
              );
              // At most one retained observation per exact source/family/runtime.
              // EEXIST is secondary and never replaces the original native failure.
              await writeFile(
                path.join(
                  directory,
                  `${sourceSha.slice(0, 12)}-${family}-${runtime}-nested-click-failure.json`
                ),
                JSON.stringify(
                  { sourceSha, sourceTree, sourceDirty, family, runtime, facts },
                  null,
                  2
                ),
                { flag: 'wx' }
              );
            },
            (error) => console.error('[accordion failure observation]', String(error)),
            1000
          );
          await expanded(ref(previewer, 'nested-overview-trigger'), true);
          await expanded(first, true);
          await capture(previewer, `${family}-${runtime}-controlled-nested`, {
            family,
            runtime,
            state: 'controlled-accepted-and-nested-open',
          });
          const old = await first.elementHandle();
          await selectAccordionRuntime(
            page,
            previewer,
            RUNTIMES[(RUNTIMES.indexOf(runtime) + 1) % RUNTIMES.length]!
          );
          expect(await old?.evaluate((el) => el.isConnected)).toBe(false);
        } catch (error) {
          activation?.failCase();
          throw error;
        } finally {
          const closing = activation;
          let contextClosed = false;
          try {
            try {
              await closing?.beforeClose();
            } catch {}
            await context.close();
            contextClosed = true;
          } finally {
            activation = null;
            try {
              await closing?.afterClose(contextClosed);
            } catch {}
          }
        }
      }, 90_000);
  for (const family of families)
    it(`${family} Chinese 320px / 200% text keeps long labels and overflow inside the page`, async () => {
      const { context, page, previewer } = await openRoute(
        browser,
        baseUrl,
        route(family, 'zh-cn'),
        { width: 320, height: 1100 }
      );
      try {
        await applyColorScheme(page, 'light');
        await selectAccordionRuntime(page, previewer, 'react');
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '200%';
        });
        const button = ref(previewer, 'single-long-trigger');
        await button.click();
        await expanded(button, true);
        // Preserve the exact failing paint and read-only geometry before the
        // strict assertion; a red run must still contain its useful evidence.
        await capture(previewer, `${family}-react-zh-320-text200`, {
          family,
          runtime: 'react',
          state: 'long-label-320-text200',
        });
        if (family !== 'base') {
          const chevron = await button.locator('svg').evaluate((el) => {
            const bounds = el.getBoundingClientRect();
            const frame = el.parentElement!;
            return {
              width: bounds.width,
              height: bounds.height,
              shrink: getComputedStyle(frame).flexShrink,
              pointerEvents: getComputedStyle(frame).pointerEvents,
            };
          });
          expect(chevron.width).toBeCloseTo(family === 'brutalist' ? 20 : 16, 1);
          expect(chevron.height).toBeCloseTo(family === 'brutalist' ? 20 : 16, 1);
          expect(chevron.shrink).toBe('0');
          expect(chevron.pointerEvents).toBe('none');
        }
        expect(await button.evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
        const layout = await observeLayout(page);
        expect(layout.pageOverflow, JSON.stringify(layout.overflowing)).toBeLessThanOrEqual(1);
      } finally {
        await context.close();
      }
    }, 90_000);
  for (const runtime of RUNTIMES) {
    for (const scenario of [
      { width: 1180, rootPercent: 100 },
      { width: 390, rootPercent: 200 },
    ]) {
      it(`shadcn ${runtime} Rhea homepage block child respects profile padding at ${scenario.width}px / ${scenario.rootPercent}% text`, async () => {
        const context = await browser.newContext({
          viewport: { width: scenario.width, height: 1000 },
        });
        const page = await context.newPage();
        const pageErrors: string[] = [];
        page.on('pageerror', (error) => pageErrors.push(error.message));
        const label = { wc: 'Web Components', react: 'React', vue: 'Vue', vue2: 'Vue 2' }[runtime];
        try {
          await page.goto(`${baseUrl}/en/`, { waitUntil: 'networkidle' });
          await applyColorScheme(page, 'light');
          const gallery = page.getByRole('region', {
            name: 'Interactive component gallery',
            exact: true,
          });
          await gallery.waitFor({ state: 'visible' });
          await page
            .getByText('Web Components · Ready', { exact: true })
            .waitFor({ state: 'visible' });
          if (runtime !== 'wc') {
            const openedMenu = await revealHeaderPreferences(page);
            const runtimeTrigger = page.getByRole('combobox', {
              name: 'Page runtime',
              exact: true,
            });
            await runtimeTrigger.click();
            const popupId = await runtimeTrigger.getAttribute('aria-controls');
            expect(popupId).toBeTruthy();
            await page
              .locator(`[id=${JSON.stringify(popupId)}]`)
              .getByRole('option', { name: label, exact: true })
              .click();
            await page.getByText(`${label} · Ready`, { exact: true }).waitFor({ state: 'visible' });
            if (openedMenu) {
              const menu = page.locator(
                '[data-site-header] .site-header-menu [data-projection-generation-state="active"] [data-demo-ref="home-menu"]'
              );
              if ((await menu.getAttribute('aria-expanded')) === 'true') await menu.click();
            }
          }
          await page.getByText(`${label} · Ready`, { exact: true }).waitFor({ state: 'visible' });
          // Isolated test environment only, not a production DOM style patch.
          await page.evaluate((percent) => {
            document.documentElement.style.fontSize = `${percent}%`;
          }, scenario.rootPercent);
          await page.evaluate(async () => {
            await document.fonts.ready;
            await new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
            );
          });
          const trigger = gallery.getByRole('button', { name: 'Where do I start?', exact: true });
          const accordion = gallery.locator('[data-demo-ref="composition-help"]');
          const content = accordion
            .locator('[data-projection-prototype="shadcn-accordion-content"]')
            .first();
          await expanded(trigger, true);
          await materialized(content);
          await expect.poll(() => content.getAttribute('data-projection-runtime')).toBe(runtime);
          const facts = await observeContentFlow(content);
          const shot = `shadcn-${runtime}-rhea-flow-${scenario.width}-text${scenario.rootPercent}`;
          await capture(accordion, shot, {
            family: 'shadcn',
            runtime,
            state: 'rhea-open-block-child',
            contentFlow: facts,
          });
          // This fixture intentionally binds the real Rhea consumer, rather
          // than mistaking the documentation's Nova compatibility default for it.
          expect(facts.tokens?.split(/\s+/)).toContain('px-4');
          expect(facts.paddingLeft).toBe(facts.rootFontSize);
          expect(facts.paddingRight).toBe(facts.rootFontSize);
          expect(facts.paddingBottom).toBe(facts.rootFontSize);
          assertContentFlow(facts);
          await trigger.click();
          await expanded(trigger, false);
          await expect.poll(() => content.isVisible()).toBe(false);
          await trigger.click();
          await expanded(trigger, true);
          await materialized(content);
          const reopened = await observeContentFlow(content);
          await capture(accordion, `${shot}-reopened`, {
            family: 'shadcn',
            runtime,
            state: 'rhea-reopened-block-child',
            contentFlow: reopened,
          });
          assertContentFlow(reopened);
          expect(pageErrors).toEqual([]);
        } finally {
          await context.close();
        }
      }, 90_000);
    }
  }
});
