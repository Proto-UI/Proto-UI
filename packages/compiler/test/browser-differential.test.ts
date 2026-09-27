// @vitest-environment node

import { createServer, type Server } from 'node:http';
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
});
