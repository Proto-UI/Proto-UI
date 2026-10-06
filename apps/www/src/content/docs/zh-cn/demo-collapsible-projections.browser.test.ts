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
  if (family === 'shadcn' || family === 'brutalist')
    return selectRuntime(page, previewer, runtime, '[aria-expanded]', 4);
  // These two families do not claim a Select. The existing site Header owns
  // preference UI outside the demo; select through its actual native clicks.
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
  await expect
    .poll(() => button.evaluate((element) => document.activeElement === element))
    .toBe(true);
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
    const host = element as HTMLElement & { __puiCollapsibleEvidence?: ObservedInput[] };
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
  await mkdir(directory, { recursive: true });
  const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
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
  const imageName = `${name}.png`;
  await previewer.screenshot({
    path: path.join(directory, imageName),
    style: 'astro-dev-toolbar { visibility: hidden; }',
  });
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
}

beforeAll(async () => {
  baseUrl = await startServer(route(FAMILIES[0]));
  browser = await launchBrowser();
}, 150_000);

afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

// T-COLLAPSIBLE-PROJECTIONS-0001: native activation, relationship, L1, retention,
// disabled, controlled ownership, domain isolation and terminal view cleanup.
// SDK/simulated-DOM evidence cannot establish these Chromium surface facts.
for (const family of FAMILIES) {
  const ROUTE = route(family);
  describe.sequential(`${family} Collapsible public browser evidence`, () => {
    for (const runtime of RUNTIMES) {
      it(`${runtime} preserves disclosure ownership through native input and view lifetimes`, async () => {
        const { context, page, previewer } = await openRoute(browser, baseUrl, ROUTE, {
          width: 1280,
          height: 900,
        });
        try {
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
          await capture(previewer, `${family}-${runtime}-controlled-accepted`);

          // Changing the actual renderer terminally removes the old host views.
          // Host IDs may be reused by new owners; disconnection, not ID spelling,
          // proves the old physical views no longer belong to the live surface.
          const oldViews = await previewer.locator('.host [data-pui-root]').elementHandles();
          const nextRuntime = RUNTIMES[(RUNTIMES.indexOf(runtime) + 1) % RUNTIMES.length]!;
          await selectCollapsibleRuntime(page, previewer, family, nextRuntime);
          for (const view of oldViews)
            expect(await view.evaluate((element) => element.isConnected)).toBe(false);
          await expanded(trigger(disclosure(previewer, 'uncontrolled')), false);
          await expanded(trigger(disclosure(previewer, 'controlled')), false);
        } finally {
          await context.close();
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
                return {
                  left: box.left,
                  right: box.right,
                  width: box.width,
                  scrollWidth: element.scrollWidth,
                  clientWidth: element.clientWidth,
                  paddingLeft: parseFloat(style.paddingLeft),
                  paddingRight: parseFloat(style.paddingRight),
                };
              });
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
              while (walker.nextNode()) {
                const text = walker.currentNode;
                if (!text.textContent?.trim()) continue;
                const range = document.createRange();
                range.selectNodeContents(text);
                for (const rect of range.getClientRects())
                  if (rect.width > 0) lines.push({ left: rect.left, right: rect.right });
              }
              return {
                left: box.left,
                right: box.right,
                contentLeft:
                  box.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft),
                contentRight:
                  box.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight),
                lines,
              };
            });
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
