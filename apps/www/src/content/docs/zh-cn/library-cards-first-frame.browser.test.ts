// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Browser, Page } from 'playwright-core';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { launchBrowser, startServer, stopServer, RUNTIMES } from './browser-harness';
import { PREFERRED_ADAPTER_KEY } from '../../../components/adapter-preference-key';
const route = '/zh-cn/ui-libraries/';
const directory =
  process.env.PUI_LIBRARY_CARD_EVIDENCE_DIR ?? path.join(os.tmpdir(), 'library-card-evidence');
let browser: Browser;
let baseUrl: string;
let sha: string;
let tree: string;
let dirty: boolean;
beforeAll(async () => {
  sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim();
  dirty = !!execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
    encoding: 'utf8',
  }).trim();
  if (process.env.CANDIDATE_SHA) expect(sha).toBe(process.env.CANDIDATE_SHA);
  await mkdir(directory, { recursive: true });
  baseUrl = await startServer(route);
  browser = await launchBrowser();
}, 150_000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);
function readCards(observe = false) {
  const read = () => {
    const gallery = document
      .querySelector<HTMLElement>('.library-gallery')!
      .getBoundingClientRect();
    const measure = (owner: HTMLElement, leaf: HTMLElement = owner) => {
      const rect = owner.getBoundingClientRect();
      const css = getComputedStyle(leaf);
      let effectiveOpacity = 1;
      for (let node: HTMLElement | null = leaf; node; node = node.parentElement)
        effectiveOpacity *= Number(getComputedStyle(node).opacity);
      return {
        x: rect.x - gallery.x,
        y: rect.y - gallery.y,
        width: rect.width,
        height: rect.height,
        fontFamily: css.fontFamily,
        fontSize: css.fontSize,
        fontWeight: css.fontWeight,
        lineHeight: css.lineHeight,
        letterSpacing: css.letterSpacing,
        color: css.color,
        opacity: css.opacity,
        effectiveOpacity,
        visibility: css.visibility,
        display: css.display,
        border: css.border,
        radius: css.borderRadius,
        shadow: css.boxShadow,
        fill: css.backgroundColor,
        overflow: owner.scrollWidth - owner.clientWidth,
      };
    };
    return [...document.querySelectorAll<HTMLElement>('[data-library]')].map((card) => {
      const surface = card.querySelector<HTMLElement>('.library-card__surface')!;
      const title = card.querySelector<HTMLElement>('h2')!;
      const body = card.querySelector<HTMLElement>('.library-card__content p')!;
      const action = card.querySelector<HTMLElement>('[data-library-action]')!;
      return {
        family: card.dataset.library,
        root: measure(surface),
        title: measure(title, title.querySelector<HTMLElement>('[data-library-part]')!),
        body: measure(body, body.querySelector<HTMLElement>('[data-library-part]')!),
        action: measure(action, action.querySelector<HTMLElement>('[data-library-part$="text"]')!),
        actionSurface: measure(action.querySelector<HTMLElement>('.library-card__action')!),
        tokens: surface.getAttribute('data-pui-style'),
        anchors: [...card.querySelectorAll('a')].map((a) => ({
          href: a.getAttribute('href'),
          label: a.textContent?.trim(),
        })),
      };
    });
  };
  if (observe) {
    const state = { running: true, frames: [] as ReturnType<typeof read>[] };
    (window as typeof window & { __libraryFrames?: typeof state }).__libraryFrames = state;
    let previous = '';
    const frame = () => {
      if (!state.running) return;
      const value = read();
      const serialized = JSON.stringify(value);
      if (serialized !== previous) {
        state.frames.push(value);
        previous = serialized;
      }
      requestAnimationFrame(frame);
    };
    frame();
  }
  return read();
}
async function captureCurrentViewport(
  page: Page,
  file: string,
  clip?: { x: number; y: number; width: number; height: number; scale: number }
) {
  // Do not use Playwright screenshot here: it awaits document.fonts.ready,
  // which is intentionally blocked by this test's own font request gate.
  const session = await page.context().newCDPSession(page);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const screenshot = await Promise.race([
      session.send('Page.captureScreenshot', {
        format: 'png',
        fromSurface: true,
        captureBeyondViewport: !!clip,
        ...(clip ? { clip } : {}),
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Current-frame screenshot exceeded 15s')),
          15_000
        );
      }),
    ]);
    const bytes = Buffer.from(screenshot.data, 'base64');
    await writeFile(file, bytes);
    return { file: path.basename(file), sha256: createHash('sha256').update(bytes).digest('hex') };
  } finally {
    if (timer) clearTimeout(timer);
    await session.detach();
  }
}
const families = [
  'base',
  'shadcn',
  'lucide',
  'brutalist',
  'bootstrap-2-3-2',
  'liquid-glass',
] as const;
async function captureFamilyCards(
  page: Page,
  name: string,
  phase: 'held-first-frame' | 'enhanced-endpoint'
) {
  const originalScroll = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
  const images = [];
  try {
    for (const family of families) {
      const card = page.locator(`[data-library="${family}"]`);
      await card.scrollIntoViewIfNeeded();
      const clip = await card.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const x = Math.max(0, rect.x + scrollX - 8);
        const y = Math.max(0, rect.y + scrollY - 8);
        return {
          x,
          y,
          width: Math.min(rect.width + 16, document.documentElement.scrollWidth - x),
          height: Math.min(rect.height + 16, document.documentElement.scrollHeight - y),
          scale: 1,
        };
      });
      expect(clip.width).toBeGreaterThan(0);
      expect(clip.height).toBeGreaterThan(0);
      images.push({
        family,
        phase,
        clip,
        ...(await captureCurrentViewport(
          page,
          path.join(directory, `${name}-${phase}-${family}.png`),
          clip
        )),
      });
    }
  } finally {
    await page.evaluate(({ x, y }) => scrollTo(x, y), originalScroll);
  }
  await writeFile(
    path.join(directory, `${name}-${phase}-images.json`),
    JSON.stringify(
      {
        sha,
        tree,
        dirty,
        role: 'Six individual family appearance screenshots. Endpoints do not replace intermediate-frame observations.',
        images,
      },
      null,
      2
    )
  );
  return images;
}
async function stopFrames(page: Page) {
  return page.evaluate(() => {
    const state = (
      window as typeof window & { __libraryFrames?: { running: boolean; frames: unknown[] } }
    ).__libraryFrames;
    if (state) state.running = false;
    return state?.frames ?? [];
  });
}
describe('actual library Cards preserve their first frame', () => {
  for (const runtime of RUNTIMES)
    for (const dark of [false, true]) {
      it(`${runtime} ${dark ? 'dark' : 'light'} delayed scripts, native focus and reload`, async () => {
        const context = await browser.newContext({
          viewport: { width: 1440, height: 1000 },
          colorScheme: dark ? 'dark' : 'light',
        });
        await context.addInitScript(
          ({ runtime, key, dark }) => {
            localStorage.setItem(key, runtime);
            localStorage.setItem('starlight-theme', dark ? 'dark' : 'light');
          },
          { runtime, key: PREFERRED_ADAPTER_KEY, dark }
        );
        const page = await context.newPage();
        let release!: () => void;
        let gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        const name = `${runtime}-${dark}`;
        const heldFonts: string[] = [];
        const heldScripts: string[] = [];
        let released = false;
        let phase = 'loading SSR';
        let before: ReturnType<typeof readCards> | undefined;
        let after: ReturnType<typeof readCards> | undefined;
        let frames: unknown[] = [];
        let reloadBefore: ReturnType<typeof readCards> | undefined;
        let reloadAfter: ReturnType<typeof readCards> | undefined;
        let reloadFrames: unknown[] = [];
        let fontFaces: Array<{ family: string; status: string }> = [];
        await page.route('**/*', async (r) => {
          const kind = r.request().resourceType();
          if (!released && ['script', 'font'].includes(kind)) {
            (kind === 'font' ? heldFonts : heldScripts).push(r.request().url());
            await gate;
          }
          await r.continue();
        });
        try {
          await page.goto(baseUrl + route, { waitUntil: 'commit' });
          await page.locator('[data-library="liquid-glass"] h2').waitFor();
          // Request the actual card face before asserting that fonts were gated.
          await page.locator('[data-library="brutalist"] h2').scrollIntoViewIfNeeded();
          await expect.poll(() => heldFonts.length).toBeGreaterThan(0);
          fontFaces = await page.evaluate(() =>
            [...document.fonts].map((face) => ({ family: face.family, status: face.status }))
          );
          expect(
            fontFaces.some(
              (face) => face.family.includes('Library DM Sans') && face.status === 'loading'
            )
          ).toBe(true);
          expect(heldScripts.length).toBeGreaterThan(0);
          // Optional faces must settle on their first-frame fallback while the
          // real font request is still held. No fonts.ready wait before release.
          await page.waitForTimeout(150);
          // Use a source anchor for upgrade focus retention. A primary action
          // gains a legitimate new observed focus ring only after enhancement;
          // it must not contaminate the resting-state first-frame oracle.
          const link = page.locator('[data-library="shadcn"] .library-card__credits a').first();
          await link.focus();
          before = await page.evaluate(readCards, true);
          expect(before).toHaveLength(6);
          expect(
            before.every(
              (card) =>
                card.root.width > 0 &&
                card.root.height > 0 &&
                card.root.visibility === 'visible' &&
                card.root.opacity === '1'
            )
          ).toBe(true);
          phase = 'capturing held-script/held-font frame';
          await captureCurrentViewport(page, path.join(directory, `${name}-before.png`));
          await captureFamilyCards(page, name, 'held-first-frame');
          phase = 'upgrading';
          released = true;
          release();
          await page.waitForFunction(() =>
            [...document.querySelectorAll('[data-library-part]')].every((el) =>
              customElements.get(el.localName)
            )
          );
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(250);
          after = await page.evaluate(readCards, false);
          frames = await stopFrames(page);
          expect(after).toEqual(before);
          expect(frames.length).toBeGreaterThan(0);
          for (const frame of frames) expect(frame).toEqual(before);
          await expect.poll(() => link.evaluate((el) => document.activeElement === el)).toBe(true);
          expect(await page.locator('a a').count()).toBe(0);
          await captureCurrentViewport(page, path.join(directory, `${name}-after.png`));
          await captureFamilyCards(page, name, 'enhanced-endpoint');
          phase = 'reloading';
          // A newly cached optional face may legitimately differ between visits.
          // Compare the reload's own held first frame with its upgrade, rather
          // than demand identical font availability across separate visits.
          released = false;
          gate = new Promise<void>((resolve) => {
            release = resolve;
          });
          await page.reload({ waitUntil: 'commit' });
          await page.locator('[data-library="liquid-glass"] h2').waitFor();
          await page.waitForTimeout(150);
          reloadBefore = await page.evaluate(readCards, true);
          await captureCurrentViewport(page, path.join(directory, `${name}-reload-before.png`));
          released = true;
          release();
          await page.waitForFunction(() =>
            [...document.querySelectorAll('[data-library-part]')].every((el) =>
              customElements.get(el.localName)
            )
          );
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(250);
          reloadAfter = await page.evaluate(readCards, false);
          reloadFrames = await stopFrames(page);
          expect(reloadAfter).toEqual(reloadBefore);
          for (const frame of reloadFrames) expect(frame).toEqual(reloadBefore);
          await captureCurrentViewport(page, path.join(directory, `${name}-reload-after.png`));
          phase = 'passed';
        } catch (error) {
          await captureCurrentViewport(page, path.join(directory, `${name}-failure.png`)).catch(
            () => {}
          );
          frames = await stopFrames(page).catch(() => frames);
          await writeFile(
            path.join(directory, `${name}-failure.json`),
            JSON.stringify(
              {
                sha,
                tree,
                dirty,
                phase,
                error: String(error),
                heldFonts,
                heldScripts,
                fontFaces,
                before,
                after,
                frames,
                reloadBefore,
                reloadAfter,
                reloadFrames,
              },
              null,
              2
            )
          );
          throw error;
        } finally {
          released = true;
          release();
          await writeFile(
            path.join(directory, `${name}.json`),
            JSON.stringify(
              {
                sha,
                tree,
                dirty,
                phase,
                heldFonts,
                heldScripts,
                fontFaces,
                before,
                after,
                frames,
                reloadBefore,
                reloadAfter,
                reloadFrames,
              },
              null,
              2
            )
          );
          await context.close();
        }
      }, 90_000);
    }
  it('keeps all destinations available with no JavaScript at 320px and 200% text', async () => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 320, height: 900 },
    });
    const page = await context.newPage();
    await page.goto(baseUrl + route);
    await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
    expect(await page.locator('[data-library-action]').count()).toBe(6);
    const cards = await page.evaluate(readCards, false);
    expect(cards.every((card) => card.root.overflow < 2 && card.root.width > 0)).toBe(true);
    expect(await page.locator('a a').count()).toBe(0);
    await page.screenshot({
      path: path.join(directory, 'no-script-320-text-200.png'),
      fullPage: true,
    });
    await context.close();
  }, 90_000);
});
