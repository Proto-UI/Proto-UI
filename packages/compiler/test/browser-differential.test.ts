// @vitest-environment node

import { createServer, type Server } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Browser, Page } from '../../../apps/www/node_modules/playwright-core/types/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// Workspace-sibling paths resolve relative to this file inside the monorepo,
// keeping the suite portable across host checkouts.
import { createServer as createViteServer } from '../../../apps/workspace/node_modules/vite/dist/node/index.js';
import { launchBrowser } from '../../../apps/www/src/content/docs/zh-cn/browser-harness';
import { compareTraces, type SemanticCheckpoint, type TraceValue } from '../src/conformance/trace';

type ViteDevServer = Awaited<ReturnType<typeof createViteServer>>;

let server: Server;
let vite: ViteDevServer;
let browser: Browser;
let baseUrl = '';
let evidenceDir = '';

beforeAll(async () => {
  evidenceDir = await mkdtemp(path.join(tmpdir(), 'proto-compiler-differential-'));
  vite = await createViteServer({
    cacheDir: path.join(evidenceDir, 'vite-cache'),
    configFile: fileURLToPath(
      new URL('./fixtures/differential-browser/vite.config.ts', import.meta.url)
    ),
    server: { middlewareMode: true, hmr: false },
  });
  server = createServer(vite.middlewares);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Compiler differential fixture has no TCP address.');
  baseUrl = `http://127.0.0.1:${address.port}`;
  browser = await launchBrowser();
  console.log(`Compiler differential browser evidence: ${evidenceDir}`);
}, 120_000);

afterAll(async () => {
  try {
    await browser?.close();
  } finally {
    try {
      await vite?.close();
    } finally {
      if (server?.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }
}, 60_000);

interface PathSnapshot {
  displayName: string;
  disabled: TraceValue;
  hovered: TraceValue;
  pressed: TraceValue;
  focused: TraceValue;
  focusVisible: TraceValue;
  clicks: number;
}

interface BoardSnapshot {
  reference: PathSnapshot;
  candidate: PathSnapshot;
}

interface PresentationSnapshot {
  box: { x: number; y: number; width: number; height: number };
  style: Record<string, string>;
  centerHit: boolean;
}

async function readPresentation(
  page: Page,
  side: 'reference' | 'candidate'
): Promise<PresentationSnapshot> {
  return page.evaluate((which) => {
    const container = document.getElementById(`${which}-root`)!;
    const element = container.querySelector<HTMLElement>('[data-pui-root]')!;
    const parent = container.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const center = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return {
      box: { x: box.x - parent.x, y: box.y - parent.y, width: box.width, height: box.height },
      style: Object.fromEntries(
        [
          'display',
          'visibility',
          'opacity',
          'pointerEvents',
          'backgroundColor',
          'color',
          'borderTopColor',
          'borderTopWidth',
          'fontFamily',
          'fontSize',
          'lineHeight',
        ].map((key) => [
          key,
          style.getPropertyValue(key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)),
        ])
      ),
      centerHit: center === element || element.contains(center),
    };
  }, side);
}

async function readBoard(page: Page): Promise<BoardSnapshot> {
  return page.evaluate(() =>
    (window as unknown as { differential: { read(): BoardSnapshot } }).differential.read()
  );
}

function semantic(board: BoardSnapshot, side: 'reference' | 'candidate'): SemanticCheckpoint[] {
  return [board[side]].map((snapshot) => ({
    step: 'browser-observed',
    phase: 'mounted',
    ownerId: snapshot.displayName,
    parentId: null,
    viewEpoch: 1,
    kind: 'snapshot',
    data: {
      disabled: snapshot.disabled ?? null,
      hovered: snapshot.hovered ?? null,
      pressed: snapshot.pressed ?? null,
      focused: snapshot.focused ?? null,
      focusVisible: snapshot.focusVisible ?? null,
      clicks: snapshot.clicks,
    },
  }));
}

describe.sequential('real-browser Adapter/generated differential', () => {
  it('compares layout, paint, center hit and accessibility under the same consumer CSS', async () => {
    const context = await browser.newContext({
      viewport: { width: 1000, height: 650 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(baseUrl);
      await page.waitForSelector('body[data-ready="true"]');
      const reference = page.locator('#reference-root [data-pui-root]');
      const candidate = page.locator('#candidate-root [data-pui-root]');
      await expect.poll(() => reference.count()).toBe(1);
      await expect.poll(() => candidate.count()).toBe(1);
      // Button has no prescribed visual theme. Apply one identical consumer style
      // and compare two real browser renderings, not compiler-generated CSS text.
      await page.addStyleTag({
        content: `
        #reference-root, #candidate-root { display: inline-block; width: 220px; height: 80px;
          padding: 8px; box-sizing: border-box; vertical-align: top; }
        [data-pui-root] { box-sizing: border-box; display: flex; align-items: center;
          justify-content: center; width: 176px; height: 44px; border: 2px solid #172c42;
          background: #e7f1ed; color: #172c42; font: 600 16px/20px Arial;
          cursor: pointer; }
      `,
      });
      await page.evaluate(() => document.fonts.ready);
      const referencePresentation = await readPresentation(page, 'reference');
      const candidatePresentation = await readPresentation(page, 'candidate');
      expect(referencePresentation.centerHit).toBe(true);
      expect(candidatePresentation).toEqual(referencePresentation);
      const referenceA11y = await reference.ariaSnapshot();
      const candidateA11y = await candidate.ariaSnapshot();
      expect(candidateA11y).toBe(referenceA11y);
      const referencePixels = await reference.screenshot();
      const candidatePixels = await candidate.screenshot();
      expect(candidatePixels.equals(referencePixels)).toBe(true);

      // Unknown-to-the-comparator negative control: an altered candidate must
      // fail the computed presentation, screenshot and hit oracles.
      await candidate.evaluate((element: HTMLElement) => {
        element.style.opacity = '0';
        element.style.pointerEvents = 'none';
      });
      const mutant = await readPresentation(page, 'candidate');
      expect(mutant).not.toEqual(referencePresentation);
      expect(mutant.centerHit).toBe(false);
      const mutantPixels = await candidate.screenshot();
      expect(mutantPixels.equals(referencePixels)).toBe(false);
      expect(errors).toEqual([]);
      const { writeFile } = await import('node:fs/promises');
      await writeFile(
        path.join(evidenceDir, 'browser-presentation.json'),
        JSON.stringify(
          {
            browser: browser.version(),
            styleFamily: 'shared-consumer-css',
            reference: referencePresentation,
            candidate: candidatePresentation,
            mutant,
            accessibility: { reference: referenceA11y, candidate: candidateA11y },
            sha256: Object.fromEntries(
              [
                ['reference', referencePixels],
                ['candidate', candidatePixels],
                ['mutant', mutantPixels],
              ].map(([name, pixels]) => [name, createHash('sha256').update(pixels).digest('hex')])
            ),
          },
          null,
          2
        )
      );
    } finally {
      await context.close();
    }
  }, 120_000);

  it('executes real pointer, focus, keyboard and accessibility input with equal semantic facts', async () => {
    const context = await browser.newContext({ viewport: { width: 1000, height: 650 } });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(baseUrl);
      await page.waitForSelector('body[data-ready="true"]');
      const referenceButton = page.locator('#reference-root [data-pui-root]');
      const candidateButton = page.locator('#candidate-root [data-pui-root]');
      await expect.poll(() => referenceButton.count()).toBe(1);
      await expect.poll(() => candidateButton.count()).toBe(1);

      // 1. Real mouse hover on each target, observed after that target's own
      // hover: one physical pointer cannot hover both roots at once.
      const hover = async (locator: typeof referenceButton, side: 'reference' | 'candidate') => {
        const box = await locator.boundingBox();
        expect(box).not.toBeNull();
        await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
        await expect.poll(() => readBoard(page)).toMatchObject({ [side]: { hovered: true } });
        return readBoard(page);
      };
      const referenceHover = await hover(referenceButton, 'reference');
      const candidateHover = await hover(candidateButton, 'candidate');
      expect(candidateHover.reference.hovered).toBe(false);
      expect(referenceHover.candidate.hovered).toBe(false);

      // 2. Real mouse press and release on each target, observed per target.
      const press = async (locator: typeof referenceButton, side: 'reference' | 'candidate') => {
        const box = await locator.boundingBox();
        await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
        await page.mouse.down();
        await expect
          .poll(() => readBoard(page))
          .toMatchObject({ [side]: { pressed: true, hovered: true } });
        await page.mouse.up();
        await expect.poll(() => readBoard(page)).toMatchObject({ [side]: { pressed: false } });
        return readBoard(page);
      };
      const referenceClick = await press(referenceButton, 'reference');
      const candidateClick = await press(candidateButton, 'candidate');
      expect(referenceClick.reference.clicks).toBe(1);
      expect(candidateClick.candidate.clicks).toBe(1);

      // 3. Keyboard focus and Enter activation on each target.
      const focusAndActivate = async (
        locator: typeof referenceButton,
        side: 'reference' | 'candidate'
      ) => {
        const clicksBefore = (await readBoard(page))[side].clicks;
        await locator.focus();
        await expect.poll(() => readBoard(page)).toMatchObject({ [side]: { focused: true } });
        await page.keyboard.press('Enter');
        await expect
          .poll(() => readBoard(page))
          .toMatchObject({ [side]: { clicks: clicksBefore + 1 } });
        return readBoard(page);
      };
      const referenceKeyActivation = await focusAndActivate(referenceButton, 'reference');
      const candidateKeyActivation = await focusAndActivate(candidateButton, 'candidate');
      expect(referenceKeyActivation.reference.focused).toBe(true);
      expect(candidateKeyActivation.candidate.focused).toBe(true);

      // 4. Disabled gating under real input: prop change then click attempts.
      await page.evaluate(() =>
        (
          window as unknown as {
            differential: { setDisabled(next: boolean): Promise<BoardSnapshot> };
          }
        ).differential.setDisabled(true)
      );
      await expect
        .poll(() => readBoard(page))
        .toMatchObject({
          reference: { disabled: true },
          candidate: { disabled: true },
        });
      const disabledReferenceBox = await referenceButton.boundingBox();
      const disabledCandidateBox = await candidateButton.boundingBox();
      await page.mouse.move(disabledReferenceBox!.x + 5, disabledReferenceBox!.y + 5);
      await page.mouse.down();
      await page.mouse.up();
      await page.mouse.move(disabledCandidateBox!.x + 5, disabledCandidateBox!.y + 5);
      await page.mouse.down();
      await page.mouse.up();
      const afterDisabledClicks = await readBoard(page);
      expect(afterDisabledClicks.reference.clicks).toBe(referenceKeyActivation.reference.clicks);
      expect(afterDisabledClicks.candidate.clicks).toBe(candidateKeyActivation.candidate.clicks);
      expect(afterDisabledClicks.reference.disabled).toBe(true);
      expect(afterDisabledClicks.candidate.disabled).toBe(true);

      // 5. Accessible semantics: role, name from content, disabled state.
      const referenceA11y = await referenceButton.evaluate((element) => ({
        role: element.getAttribute('role'),
        ariaDisabled: element.getAttribute('aria-disabled'),
        tabIndex: element.tabIndex,
        text: element.textContent,
      }));
      const candidateA11y = await candidateButton.evaluate((element) => ({
        role: element.getAttribute('role'),
        ariaDisabled: element.getAttribute('aria-disabled'),
        tabIndex: element.tabIndex,
        text: element.textContent,
      }));
      expect(candidateA11y.role).toBe(referenceA11y.role);
      expect(candidateA11y.ariaDisabled).toBe(referenceA11y.ariaDisabled);
      expect(candidateA11y.tabIndex).toBe(referenceA11y.tabIndex);
      expect(candidateA11y.text).toBe(referenceA11y.text);

      // 6. First-divergence comparison of the final observed state.
      const finalBoard = await readBoard(page);
      const comparison = compareTraces(
        semantic(finalBoard, 'reference'),
        semantic(finalBoard, 'candidate'),
        {
          referenceIdentity: {
            reason: 'Per-root opaque instance IDs',
            aliases: { reference: 'browser-button' },
          },
          candidateIdentity: {
            reason: 'Per-root opaque instance IDs',
            aliases: { candidate: 'browser-button' },
          },
        }
      );
      expect(comparison).toEqual({ equal: true });
      expect(errors).toEqual([]);
      const snapshot = {
        reference: finalBoard.reference,
        candidate: finalBoard.candidate,
        browser: browser.version(),
      };
      const { writeFile } = await import('node:fs/promises');
      await writeFile(
        path.join(evidenceDir, 'browser-differential.json'),
        JSON.stringify(snapshot, null, 2)
      );
    } finally {
      await context.close();
    }
  }, 120_000);

  it('preserves semantic facts through disabled omission and view remount with real input', async () => {
    const context = await browser.newContext({ viewport: { width: 1000, height: 650 } });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(baseUrl);
      await page.waitForSelector('body[data-ready="true"]');
      const referenceButton = page.locator('#reference-root [data-pui-root]');
      const candidateButton = page.locator('#candidate-root [data-pui-root]');
      await expect.poll(() => referenceButton.count()).toBe(1);
      await expect.poll(() => candidateButton.count()).toBe(1);

      // 1. Disable, then omit the disabled prop entirely (key removed).
      await page.evaluate(() =>
        (
          window as unknown as {
            differential: { setDisabled(next: boolean): Promise<BoardSnapshot> };
          }
        ).differential.setDisabled(true)
      );
      await expect
        .poll(() => readBoard(page))
        .toMatchObject({
          reference: { disabled: true },
          candidate: { disabled: true },
        });
      await page.evaluate(() =>
        (
          window as unknown as {
            differential: { omitDisabled(): Promise<BoardSnapshot> };
          }
        ).differential.omitDisabled()
      );
      await expect
        .poll(() => readBoard(page))
        .toMatchObject({
          reference: { disabled: false },
          candidate: { disabled: false },
        });

      // 2. Real clicks after omission: both targets emit exactly one click.
      const clicksBeforeOmission = await readBoard(page);
      for (const locator of [referenceButton, candidateButton]) {
        const box = await locator.boundingBox();
        expect(box).not.toBeNull();
        await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
        await page.mouse.down();
        await page.mouse.up();
      }
      const afterOmissionClicks = await readBoard(page);
      expect(afterOmissionClicks.reference.clicks).toBe(clicksBeforeOmission.reference.clicks + 1);
      expect(afterOmissionClicks.candidate.clicks).toBe(clicksBeforeOmission.candidate.clicks + 1);

      // 3. Remount the host view: logical state and click counts survive.
      await page.evaluate(() =>
        (
          window as unknown as {
            differential: { remount(): Promise<BoardSnapshot> };
          }
        ).differential.remount()
      );
      await expect.poll(() => referenceButton.count()).toBe(1);
      await expect.poll(() => candidateButton.count()).toBe(1);
      const afterRemount = await readBoard(page);
      expect(afterRemount.reference.disabled).toBe(false);
      expect(afterRemount.candidate.disabled).toBe(false);
      expect(afterRemount.reference.clicks).toBe(afterOmissionClicks.reference.clicks);
      expect(afterRemount.candidate.clicks).toBe(afterOmissionClicks.candidate.clicks);

      // 4. Real interaction still works after remount on both targets.
      for (const locator of [referenceButton, candidateButton]) {
        const box = await locator.boundingBox();
        expect(box).not.toBeNull();
        await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
        await page.mouse.down();
        await page.mouse.up();
      }
      const afterRemountClicks = await readBoard(page);
      expect(afterRemountClicks.reference.clicks).toBe(afterRemount.reference.clicks + 1);
      expect(afterRemountClicks.candidate.clicks).toBe(afterRemount.candidate.clicks + 1);
      // A real mouse click moves host focus to the clicked target, so the
      // second click leaves it focused while the first is not. Blur both
      // targets and move the pointer away before the final comparison so
      // both paths are in observationally equivalent input positions.
      await page.mouse.move(0, 0);
      await referenceButton.evaluate((element: HTMLElement) => element.blur());
      await candidateButton.evaluate((element: HTMLElement) => element.blur());
      await expect
        .poll(() => readBoard(page))
        .toMatchObject({
          reference: { focused: false },
          candidate: { focused: false },
        });

      // 5. Equal final semantic state under justified identity aliases.
      const finalBoard = await readBoard(page);
      const comparison = compareTraces(
        semantic(finalBoard, 'reference'),
        semantic(finalBoard, 'candidate'),
        {
          referenceIdentity: {
            reason: 'Per-root opaque instance IDs',
            aliases: { reference: 'browser-button' },
          },
          candidateIdentity: {
            reason: 'Per-root opaque instance IDs',
            aliases: { candidate: 'browser-button' },
          },
        }
      );
      expect(comparison).toEqual({ equal: true });
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  }, 120_000);
});
