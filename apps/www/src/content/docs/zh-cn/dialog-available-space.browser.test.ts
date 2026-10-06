// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Browser, Page, Locator } from 'playwright-core';
import { beforeAll, afterAll, expect, it } from 'vitest';
import {
  RUNTIMES,
  launchBrowser,
  openRoute,
  selectRuntime,
  startServer,
  stopServer,
} from './browser-harness';
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const output = process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR
  ? path.join(process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR, 'dialog-available-space')
  : undefined;
const observations: unknown[] = [];
let browser: Browser, baseUrl: string;
beforeAll(async () => {
  baseUrl = await startServer('/en/ui-libraries/shadcn/dialog/');
  browser = await launchBrowser();
  if (output) await mkdir(output, { recursive: true });
}, 240_000);
afterAll(async () => {
  if (output)
    await writeFile(
      path.join(output, 'observations.json'),
      JSON.stringify(
        {
          sourceSha,
          probeSha: process.env.PROTO_UI_DIALOG_PROBE_SHA ?? sourceSha,
          subject: process.env.PROTO_UI_DIALOG_SUBJECT ?? 'candidate',
          renderer: 'Astro dev server',
          browser: browser?.version(),
          conditions:
            'Real public Dialog. Viewport resizing and CDP page scale emulate available-space changes; not physical keyboard/notch evidence. Long text and 200% root font are explicit stress fixtures.',
          observations,
        },
        null,
        2
      )
    );
  await browser?.close();
  await stopServer();
}, 60_000);
async function frames(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
}
async function facts(dialog: Locator) {
  return dialog.evaluate((e) => {
    const r = e.getBoundingClientRect(),
      s = getComputedStyle(e);
    const mask = Array.from(document.body.children).find(
      (n) =>
        n !== e &&
        n.hasAttribute('data-is-present') &&
        n.hasAttribute('data-pui-root') &&
        n.getAttribute('role') !== 'dialog'
    );
    const m = mask?.getBoundingClientRect();
    const v = visualViewport;
    return {
      rect: r.toJSON(),
      viewport: {
        width: innerWidth,
        height: innerHeight,
        x: v?.offsetLeft ?? 0,
        y: v?.offsetTop ?? 0,
        visibleWidth: v?.width ?? innerWidth,
        visibleHeight: v?.height ?? innerHeight,
        scale: v?.scale ?? 1,
      },
      mask: m?.toJSON(),
      font: parseFloat(getComputedStyle(document.documentElement).fontSize),
      rendering: {
        dpr: devicePixelRatio,
        fonts: document.fonts.status,
        scheme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
        rootClientWidth: document.documentElement.clientWidth,
        rootClientLeft: document.documentElement.clientLeft,
      },
      paint: {
        fontFamily: s.fontFamily,
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        lineHeight: s.lineHeight,
        transitionProperty: s.transitionProperty,
        transitionDuration: s.transitionDuration,
      },
      animations: e.getAnimations().map((a) => ({
        playState: a.playState,
        pending: a.pending,
        property: 'transitionProperty' in a ? a.transitionProperty : null,
      })),
      overflowY: s.overflowY,
      scrollWidth: e.scrollWidth,
      clientWidth: e.clientWidth,
      scrollHeight: e.scrollHeight,
      clientHeight: e.clientHeight,
      scrollTop: e.scrollTop,
      focusInside: e.contains(document.activeElement),
      active: document.activeElement?.outerHTML.slice(0, 300),
      transition: e.getAttribute('data-transition-state'),
      available: {
        width: s.getPropertyValue('--proto-ui-available-region-width'),
        height: s.getPropertyValue('--proto-ui-available-region-height'),
      },
    };
  });
}
async function renderedDialogFonts(page: Page, dialog: Locator) {
  const id = await dialog.getAttribute('id');
  if (!id) return { status: 'missing-id', fonts: [] };
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    await cdp.send('DOM.getDocument');
    const selector = `[id=${JSON.stringify(id)}]`;
    const expression = `(()=>{const root=document.querySelector(${JSON.stringify(selector)});if(!root)return null;const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);for(let node=walker.nextNode();node;node=walker.nextNode()){if(node.textContent.trim())return node.parentElement;}return null;})()`;
    const { result } = await cdp.send('Runtime.evaluate', {
      expression,
      objectGroup: 'dialog-font-evidence',
    });
    if (!result.objectId) return { status: 'no-text', fonts: [] };
    const { nodeId } = await cdp.send('DOM.requestNode', { objectId: result.objectId });
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
    return { status: fonts.some((f) => f.glyphCount > 0) ? 'measured' : 'no-glyphs', fonts };
  } finally {
    await cdp.send('Runtime.releaseObjectGroup', { objectGroup: 'dialog-font-evidence' });
    await cdp.detach();
  }
}
async function capture(page: Page, dialog: Locator, id: string) {
  const data = await facts(dialog);
  const platformFonts = id.endsWith('-390-settled')
    ? await renderedDialogFonts(page, dialog)
    : undefined;
  let image;
  if (output) {
    const bytes = await page.screenshot({ path: path.join(output, `${id}.png`) });
    image = { file: `${id}.png`, sha256: createHash('sha256').update(bytes).digest('hex') };
  }
  observations.push({
    id,
    sourceSha,
    route: new URL(page.url()).pathname,
    viewport: page.viewportSize(),
    data,
    platformFonts,
    image,
  });
  return data;
}
async function settle(dialog: Locator) {
  await expect
    .poll(() => dialog.getAttribute('data-transition-state'), { timeout: 20_000 })
    .toBe('entered');
  await dialog.evaluate(async (e) => {
    await Promise.all(e.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {})));
  });
}
async function reachableActions(page: Page, dialog: Locator) {
  const actions = dialog.getByRole('button');
  const count = await actions.count();
  expect(count).toBeGreaterThan(0);
  const names: string[] = [];
  for (let index = 0; index < count; index++) {
    const action = actions.nth(index);
    await action.scrollIntoViewIfNeeded();
    const fact = await action.evaluate((e) => {
      const dialog = e.closest('[role="dialog"]')!;
      const r = e.getBoundingClientRect(),
        d = dialog.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return {
        text: e.textContent?.trim() ?? '',
        left: r.left,
        right: r.right,
        contentLeft: d.left + dialog.clientLeft,
        contentRight: d.left + dialog.clientLeft + dialog.clientWidth,
        width: r.width,
        height: r.height,
        hit: !!hit && e.contains(hit),
      };
    });
    names.push(fact.text);
    expect(fact.left).toBeGreaterThanOrEqual(fact.contentLeft - 1);
    expect(fact.right).toBeLessThanOrEqual(fact.contentRight + 1);
    expect(fact.width).toBeGreaterThan(0);
    expect(fact.height).toBeGreaterThan(0);
    expect(fact.hit).toBe(true);
    await action.focus();
    expect(
      await action.evaluate(
        (e) => e === document.activeElement || e.contains(document.activeElement)
      )
    ).toBe(true);
  }
  // Verify real sequential navigation, not only programmatic focusability.
  if (count > 1) {
    await actions.first().focus();
    for (let index = 1; index < count; index++) {
      await page.keyboard.press('Tab');
      expect(
        await actions
          .nth(index)
          .evaluate((e) => e === document.activeElement || e.contains(document.activeElement))
      ).toBe(true);
    }
    for (let index = count - 2; index >= 0; index--) {
      await page.keyboard.press('Shift+Tab');
      expect(
        await actions
          .nth(index)
          .evaluate((e) => e === document.activeElement || e.contains(document.activeElement))
      ).toBe(true);
    }
  }
  return names;
}
function bounded(data: Awaited<ReturnType<typeof facts>>) {
  const r = data.rect,
    v = data.viewport,
    g = data.font;
  expect(r.x - v.x).toBeGreaterThanOrEqual(g - 1);
  expect(v.x + v.visibleWidth - r.right).toBeGreaterThanOrEqual(g - 1);
  expect(r.y - v.y).toBeGreaterThanOrEqual(g - 1);
  expect(v.y + v.visibleHeight - r.bottom).toBeGreaterThanOrEqual(g - 1);
  expect(Math.abs(r.x + r.width / 2 - v.x - v.visibleWidth / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(r.y + r.height / 2 - v.y - v.visibleHeight / 2)).toBeLessThanOrEqual(1);
  expect(data.available.width).not.toBe('');
}
for (const family of ['shadcn', 'brutalist'] as const)
  for (const runtime of RUNTIMES) {
    it(`${family}/${runtime}: live available region bounds content, leaves Mask full-size, scrolls long text and restores on close`, async () => {
      const route =
        family === 'shadcn'
          ? '/en/ui-libraries/shadcn/dialog/'
          : '/en/ui-libraries/brutalist/components/dialog/';
      const { context, page, previewer } = await openRoute(browser, baseUrl, route, {
        width: 390,
        height: 900,
      });
      try {
        await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
        await page.evaluate(() => document.fonts.ready);
        // Choose the runtime only after its current generation is published.
        // A visible SSR preview shell alone does not establish an interactive Select.
        await page.waitForFunction(
          () => {
            const root = document.querySelector<HTMLElement>('[data-previewer-id]');
            const scope = root?.querySelector<HTMLElement>('[data-projection-scope]');
            return root?.dataset.projectionMode === 'fixed-family'
              ? scope?.dataset.projectionState === 'ready'
              : !!root?.querySelector('.host [aria-haspopup="dialog"]');
          },
          undefined,
          { timeout: 30_000 }
        );
        const offered = await previewer.getAttribute('data-runtimes');
        if (offered && !JSON.parse(offered).includes(runtime)) {
          throw new Error(`RuntimeNotOffered:${family}/${runtime}:${offered}`);
        }
        await selectRuntime(page, previewer, runtime, '[aria-haspopup="dialog"]', 1);
        const trigger = page.locator('[data-previewer-id] [aria-haspopup="dialog"]').first();
        await trigger.click();
        const dialog = page.getByRole('dialog').last();
        await dialog.waitFor({ state: 'visible' });
        await capture(page, dialog, `${family}-${runtime}-390-immediate`);
        await page.evaluate(() => document.fonts.ready);
        await settle(dialog);
        await frames(page);
        const identity = await dialog.elementHandle();
        for (const width of [390, 430, 320, 1024]) {
          await page.setViewportSize({ width, height: 900 });
          await frames(page);
          const immediate = await capture(
            page,
            dialog,
            `${family}-${runtime}-${width}-resize-immediate`
          );
          // Record both phases before asserting, so historical failures retain
          // a genuinely settled reference without suppressing the early check.
          await settle(dialog);
          await frames(page);
          const data = await capture(page, dialog, `${family}-${runtime}-${width}-settled`);
          bounded(immediate);
          expect(immediate.paint.transitionProperty).not.toBe('all');
          bounded(data);
          expect(data.scrollWidth, 'Content has no hidden horizontal overflow').toBeLessThanOrEqual(
            data.clientWidth + 1
          );
          expect(data.mask?.x).toBe(0);
          expect(data.mask?.y).toBe(0);
          expect(data.mask?.width).toBe(width);
          expect(data.mask?.height).toBe(900);
          expect(await identity?.evaluate((e) => e.isConnected)).toBe(true);
        }
        if (family === 'shadcn') {
          // Explicit localized-text stress fixture; preserve the existing text node,
          // prototype, DOM order, handlers and layout. No style override.
          await dialog.getByRole('button', { name: 'Save changes', exact: true }).evaluate((e) => {
            const walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
              if (node.textContent?.trim() === 'Save changes') {
                node.textContent = '保存全部个人资料更改并继续下一步';
                return;
              }
            }
            throw new Error('Missing original action label text node');
          });
        }
        await page.setViewportSize({ width: 390, height: 360 });
        // Test-only content fixture, no geometry/style/measurement override on the component.
        await dialog.evaluate((e) => {
          const paragraph = document.createElement('p');
          paragraph.dataset.dialogLongFixture = '';
          paragraph.textContent =
            'Long content remains readable and every action remains reachable. '.repeat(100);
          e.append(paragraph);
        });
        await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
        await settle(dialog);
        await frames(page);
        const long = await capture(page, dialog, `${family}-${runtime}-long-font200`);
        bounded(long);
        expect(long.scrollWidth, 'Long-content actions fit the inline region').toBeLessThanOrEqual(
          long.clientWidth + 1
        );
        expect(long.overflowY).toBe('auto');
        expect(long.scrollHeight).toBeGreaterThan(long.clientHeight);
        await dialog.evaluate((e) => {
          e.scrollTop = e.scrollHeight;
        });
        await frames(page);
        expect((await facts(dialog)).scrollTop).toBeGreaterThan(0);
        await reachableActions(page, dialog);
        const longClose = dialog.locator('[data-pui-a11y-actions="activate"]').first();
        await longClose.scrollIntoViewIfNeeded();
        expect(
          await longClose.evaluate((e) => {
            const r = e.getBoundingClientRect();
            const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            return r.width > 0 && r.height > 0 && !!hit && e.contains(hit);
          })
        ).toBe(true);
        await capture(page, dialog, `${family}-${runtime}-long-action-reachable`);
        await page.evaluate(() => document.documentElement.style.removeProperty('font-size'));
        await dialog.locator('[data-dialog-long-fixture]').evaluate((e) => e.remove());
        await page.setViewportSize({ width: 430, height: 900 });
        const cdp = await context.newCDPSession(page);
        await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });
        await settle(dialog);
        await frames(page);
        const zoom = await capture(page, dialog, `${family}-${runtime}-scale2`);
        bounded(zoom);
        expect(zoom.scrollWidth, 'Zoomed actions fit the inline region').toBeLessThanOrEqual(
          zoom.clientWidth + 1
        );
        await reachableActions(page, dialog);
        await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
        await cdp.detach();
        await frames(page);
        bounded(await capture(page, dialog, `${family}-${runtime}-restored`));
        const close = dialog.locator('[data-pui-a11y-actions="activate"]').first();
        await close.scrollIntoViewIfNeeded();
        await close.click();
        await dialog.waitFor({ state: 'hidden' });
        await expect.poll(() => page.locator('[data-pui-available-space-probe]').count()).toBe(0);
        expect(
          await identity?.evaluate((e) =>
            (e as HTMLElement).style.getPropertyValue('--proto-ui-available-region-width')
          )
        ).toBe('');
        await trigger.click();
        await dialog.waitFor({ state: 'visible' });
        await settle(dialog);
        await frames(page);
        bounded(await capture(page, dialog, `${family}-${runtime}-reopened`));
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden' });
      } catch (error) {
        const id = `${family}-${runtime}-failure`;
        const setup = await page.evaluate(() => ({
          url: location.pathname,
          offeredRuntimes: document
            .querySelector('[data-previewer-id]')
            ?.getAttribute('data-runtimes'),
          controls: Array.from(document.querySelectorAll('[role="combobox"]')).map((e) => ({
            id: e.id,
            text: e.textContent,
            controls: e.getAttribute('aria-controls'),
            expanded: e.getAttribute('aria-expanded'),
          })),
          options: Array.from(document.querySelectorAll('[role="option"]')).map((e) => ({
            text: e.textContent,
            id: e.id,
            visible: (e as HTMLElement).getBoundingClientRect().height > 0,
          })),
          runtimeScopes: Array.from(document.querySelectorAll('[data-projection-scope]')).map(
            (e) => ({
              state: e.getAttribute('data-projection-state'),
              runtime: e.getAttribute('data-projection-runtime'),
              generation: e.getAttribute('data-projection-generation'),
            })
          ),
        }));
        let image;
        if (output) {
          const bytes = await page.screenshot({ path: path.join(output, `${id}.png`) });
          image = { file: `${id}.png`, sha256: createHash('sha256').update(bytes).digest('hex') };
        }
        observations.push({ id, sourceSha, error: String(error), setup, image });
        throw error;
      } finally {
        await context.close();
      }
    }, 150_000);
  }
