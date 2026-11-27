// @vitest-environment node
import { createServer, type Server } from 'node:http';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Browser, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createServer as createViteServer,
  type ViteDevServer,
} from '../../workspace/node_modules/vite/dist/node/index.js';
import { launchBrowser } from '../src/content/docs/zh-cn/browser-harness';
import type {
  createPercentageLab,
  createSwitchLab,
} from '../test-fixtures/shadow-percentage/consumer';

type Sample = ReturnType<ReturnType<typeof createPercentageLab>['sample']>[number];
type SwitchSample = ReturnType<ReturnType<typeof createSwitchLab>['sample']>[number];
let browser: Browser;
let vite: ViteDevServer;
let server: Server;
let baseUrl = '';
let evidenceDir = '';

beforeAll(async () => {
  const artifactRoot = process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR;
  if (artifactRoot) await mkdir(artifactRoot, { recursive: true });
  evidenceDir = await mkdtemp(path.join(artifactRoot ?? tmpdir(), 'shadow-percentage-native-'));
  vite = await createViteServer({
    cacheDir: path.join(evidenceDir, 'vite-cache'),
    configFile: fileURLToPath(
      new URL('../test-fixtures/shadow-percentage/vite.config.ts', import.meta.url)
    ),
    server: { middlewareMode: true, hmr: false },
  });
  server = createServer(vite.middlewares);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing native fixture address');
  baseUrl = `http://127.0.0.1:${address.port}`;
  browser = await launchBrowser();
  console.log(`Shadow percentage native evidence: ${evidenceDir}`);
}, 60000);

afterAll(async () => {
  try {
    await browser?.close();
  } finally {
    await vite?.close();
    if (server?.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}, 60000);

async function frames(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
}
async function sample(page: Page): Promise<Sample[]> {
  return page.evaluate(() => (window as any).percentageLab.sample());
}
async function switchSample(page: Page): Promise<SwitchSample[]> {
  return page.evaluate(() => (window as any).switchLab.sample());
}
async function observed(
  name: string,
  suite: 'percentage' | 'switch',
  action: (page: Page, observations: unknown[]) => Promise<void>
) {
  const context = await browser.newContext({
    viewport: { width: 1100, height: 1200 },
    colorScheme: 'light',
  });
  const page = await context.newPage();
  const errors: string[] = [];
  const observations: unknown[] = [];
  let failure: string | undefined;
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.goto(`${baseUrl}/?suite=${suite}`);
    await page.waitForSelector('body[data-ready="true"]', { timeout: 20000 });
    await action(page, observations);
    expect(errors).toEqual([]);
    await page.screenshot({ path: path.join(evidenceDir, `${name}.png`) });
  } catch (error) {
    failure = String(error);
    await page.screenshot({ path: path.join(evidenceDir, `${name}-failure.png`) }).catch(() => {});
    throw error;
  } finally {
    await writeFile(
      path.join(evidenceDir, `${name}.json`),
      JSON.stringify(
        {
          browser: browser.version(),
          name,
          suite,
          failure,
          errors,
          observations,
        },
        null,
        2
      )
    );
    await context.close();
  }
}

// Independent equations from the governed criterion. Neither CSS text nor a
// source-token parser supplies the expected host displacement.
function displacement(expression: number, width: number, p: number, rootFont: number) {
  const r = rootFont / 16;
  const equations = [
    width - 4,
    ((width - 2) * p) / 100,
    ((width - 4) * p) / 100,
    ((width - 8) * p) / 100,
    ((2 - width) * p) / 100,
    ((4 - width) * p) / 100,
    ((8 - width) * p) / 100,
    1 + ((width + 1) * p) / 100,
    -1 - ((width + 1) * p) / 100,
    -r,
    2 - width,
    8 - width,
    -width - 2,
    4 - width,
    r + ((width + 2 - r) * p) / 100,
    -r - ((width + 2 - r) * p) / 100,
  ];
  return equations[expression]!;
}
function aligned(row: Sample) {
  return (
    Math.abs(row.surface.x - row.host.x) < 0.08 &&
    Math.abs(row.surface.width - row.host.width) < 0.08 &&
    Math.abs(row.caller.x - row.host.x) < 0.08 &&
    Math.abs(row.caller.width - row.host.width) < 0.08
  );
}
function check(rows: Sample[], expression: number, p: number, width: number, font: number) {
  expect(rows).toHaveLength(2);
  const staticExpression = expression === 0 || (expression >= 9 && expression <= 13);
  for (const row of rows) {
    expect(row.rootFont).toBe(font);
    expect(row.host.width).toBeCloseTo((width * font) / 16, 2);
    expect(row.host.x - row.anchor.x).toBeCloseTo(
      displacement(expression, row.host.width, p, font),
      1
    );
    expect(aligned(row)).toBe(true);
    expect(row.slotIdentity).toBe(true);
    expect(row.callerIdentity).toBe(true);
    expect(row.hit).toBe(true);
    expect(row.state).toBe(staticExpression ? null : p);
    expect(row.inlinePercentage).toBe(staticExpression ? '' : String(p));
  }
}

describe.sequential('finite Shadow Root native percentage and rem translations', () => {
  it.each([16, 32].flatMap((font) => ['ltr', 'rtl'].map((direction) => ({ font, direction }))))(
    '$font px root text with $direction preserves all finite operands and native hit geometry',
    async ({ font, direction }) =>
      observed(`matrix-${font}-${direction}`, 'percentage', async (page, observations) => {
        await page.evaluate((size) => {
          document.documentElement.style.fontSize = `${size}px`;
        }, font);
        for (let expression = 0; expression < 16; expression++)
          for (const width of [16, 32, 48]) {
            await page.evaluate((config) => (window as any).percentageLab.mount(config), {
              expression,
              width,
              direction,
            });
            await frames(page);
            for (const p of [0, 25, 50, 75, 100]) {
              await page.evaluate((value) => (window as any).percentageLab.move(value), p);
              await frames(page);
              const rows = await sample(page);
              observations.push({ expression, width, p, rows });
              check(rows, expression, p, width, font);
              if (p === 50) {
                for (const row of rows)
                  await page.mouse.click(
                    row.host.x + row.host.width / 2,
                    row.host.y + row.host.height / 2
                  );
                expect((await sample(page)).map((row) => row.trustedClicks)).toEqual([
                  [true],
                  [true],
                ]);
              }
            }
          }
      }),
    120000
  );

  it.each([14, 15])(
    'expression %s keeps intermediate frames and reversal aligned, then restores declared transition',
    async (expression) =>
      observed(`motion-${expression}`, 'percentage', async (page, observations) => {
        await page.evaluate((expression) => {
          document.documentElement.style.fontSize = '32px';
          (window as any).percentageLab.mount({ expression, width: 32, direction: 'rtl' });
        }, expression);
        await frames(page);
        await page.evaluate(() => (window as any).percentageLab.animate(true));
        await frames(page);
        const motion = (await page.evaluate(async () => {
          const lab = (window as any).percentageLab;
          const samples = [];
          lab.move(100);
          for (let frame = 0; frame < 6; frame++) {
            await new Promise(requestAnimationFrame);
            samples.push({ phase: 'outbound', rows: lab.sample() });
          }
          lab.move(0);
          for (let frame = 0; frame < 18; frame++) {
            await new Promise(requestAnimationFrame);
            samples.push({ phase: 'reverse', rows: lab.sample() });
          }
          return samples;
        })) as Array<{ phase: string; rows: Sample[] }>;
        observations.push(...motion);
        const start = displacement(expression, 64, 0, 32);
        const end = displacement(expression, 64, 100, 32);
        expect(
          motion.some(
            ({ phase, rows }) =>
              phase === 'outbound' &&
              rows.every((row) => {
                const x = row.host.x - row.anchor.x;
                return x > Math.min(start, end) + 1 && x < Math.max(start, end) - 1;
              })
          )
        ).toBe(true);
        for (const { rows } of motion) {
          for (const row of rows) expect(aligned(row)).toBe(true);
          expect(rows[0].host.x - rows[0].anchor.x).toBeCloseTo(
            rows[1].host.x - rows[1].anchor.x,
            1
          );
        }
        check(await sample(page), expression, 0, 32, 32);
        await page.evaluate(() => (window as any).percentageLab.animate(false));
        await frames(page);
        expect((await sample(page)).map((row) => row.transition)).toEqual(['none', 'none']);
        await page.evaluate(() => (window as any).percentageLab.animate(true));
        await frames(page);
        expect((await sample(page)).every((row) => row.transition.includes('transform'))).toBe(
          true
        );
      }),
    120000
  );

  it(
    'reacquires the current owner view, rejects retired controls and retains independent nested progress',
    async () =>
      observed('lifetime', 'percentage', async (page, observations) => {
        await page.evaluate(() =>
          (window as any).percentageLab.mount({ expression: 15, width: 16, direction: 'ltr' })
        );
        await frames(page);
        await page.evaluate(() => (window as any).percentageLab.move(25));
        await frames(page);
        check(await sample(page), 15, 25, 16, 16);
        await page.evaluate(() => (window as any).percentageLab.present(false));
        await frames(page);
        const absent = await page.evaluate(() => (window as any).percentageLab.absence());
        observations.push({ absent });
        expect(absent.every((row: any) => row.rootTokens === null && row.callerIdentity)).toBe(
          true
        );
        await page.evaluate(() => {
          (window as any).percentageLab.move(50);
          (window as any).percentageLab.present(true);
        });
        await frames(page);
        const remounted = await sample(page);
        observations.push({ remounted });
        check(remounted, 15, 50, 16, 16);
        expect(remounted.map((row) => row.setups)).toEqual([1, 1]);
        await page.evaluate(() => (window as any).percentageLab.disconnect());
        await frames(page);
        expect(
          (await page.evaluate(() => (window as any).percentageLab.invokeStale())).every(
            (row: any) => row.threw
          )
        ).toBe(true);
        await page.evaluate(() => (window as any).percentageLab.reconnect());
        await frames(page);
        const reconnected = await sample(page);
        observations.push({ reconnected });
        check(reconnected, 15, 0, 16, 16);
        expect(reconnected.map((row) => row.setups)).toEqual([2, 2]);
        await page.evaluate(() => (window as any).percentageLab.nested());
        await frames(page);
        const nested = await page.evaluate(() => (window as any).percentageLab.nestedSample());
        observations.push({ nested });
        expect(nested.map((row: any) => row.inlinePercentage)).toEqual(['75', '25']);
        expect(nested[0].slotContainsHost).toBe(true);
        expect(nested[0].host.x - nested[0].anchor.x).toBeCloseTo(
          displacement(2, nested[0].host.width, 75, 16),
          1
        );
        expect(nested[1].host.x - nested[0].host.x).toBeCloseTo(
          // The outer RTL block starts its narrower child at the right edge;
          // only the child's own authored expression contributes translation.
          nested[0].host.width -
            nested[1].host.width +
            displacement(8, nested[1].host.width, 25, 16),
          1
        );
      }),
    120000
  );

  it(
    'detects double-transform geometry without treating that counterexample as a pass',
    async () =>
      observed('geometry-control', 'percentage', async (page, observations) => {
        await page.evaluate(() =>
          (window as any).percentageLab.mount({ expression: 14, width: 32, direction: 'rtl' })
        );
        await frames(page);
        expect((await sample(page)).every(aligned)).toBe(true);
        await page.evaluate(() => (window as any).percentageLab.duplicateSurfaceGeometry(8));
        const negative = await sample(page);
        observations.push({ negative });
        expect(aligned(negative[0])).toBe(true);
        expect(aligned(negative[1])).toBe(false);
        await page.evaluate(() => (window as any).percentageLab.duplicateSurfaceGeometry(null));
        expect((await sample(page)).every(aligned)).toBe(true);
      }),
    120000
  );

  it.each([16, 32])(
    'real public Switch and Thumb keep mirrored click/Space endpoints at %s px',
    async (font) =>
      observed(`public-switch-${font}`, 'switch', async (page, observations) => {
        await page.evaluate((size) => {
          document.documentElement.style.fontSize = `${size}px`;
        }, font);
        for (const style of [
          'new-york-v4',
          'vega',
          'nova',
          'maia',
          'lyra',
          'mira',
          'luma',
          'sera',
          'rhea',
        ])
          for (const size of ['default', 'sm']) {
            await page.evaluate(({ style, size }) => (window as any).switchLab.mount(style, size), {
              style,
              size,
            });
            await frames(page);
            // This consumer checks settled endpoints. Sera authors an initial
            // rem translation, so retain its entrance transition and observe
            // the real rest endpoint before measuring subsequent travel.
            await expect
              .poll(
                async () =>
                  (await switchSample(page)).every(
                    (row) =>
                      !row.checked &&
                      Math.abs(
                        row.translationX -
                          (style === 'sera' ? (row.direction === 'rtl' ? -font : font) / 16 : 0)
                      ) < 0.01
                  ),
                { timeout: 1000 }
              )
              .toBe(true);
            const before = await switchSample(page);
            observations.push({ style, size, before });
            expect(
              before.every(
                (row) => row.checked === false && row.retainedThumb && row.rootFont === font
              )
            ).toBe(true);
            for (const profile of ['light', 'split']) {
              const ltr = before.find((row) => row.profile === profile && row.direction === 'ltr')!;
              const rtl = before.find((row) => row.profile === profile && row.direction === 'rtl')!;
              expect(ltr.thumb.x - ltr.root.x).toBeCloseTo(
                rtl.root.x + rtl.root.width - rtl.thumb.x - rtl.thumb.width,
                1
              );
            }
            for (const row of before)
              await page.locator(`[data-switch-case="${row.profile}-${row.direction}"]`).click();
            const settled = async () => {
              const rows = await switchSample(page);
              return rows.every((row, index) => {
                const inset = style === 'sera' ? font / 16 : 0;
                const travel =
                  row.thumb.width +
                  (style === 'sera' ? 2 : style === 'luma' ? -8 : style === 'rhea' ? -4 : -2) -
                  inset;
                const actual =
                  row.thumb.x - row.root.x - (before[index].thumb.x - before[index].root.x);
                return (
                  row.checked &&
                  Math.abs(actual - (row.direction === 'rtl' ? -travel : travel)) < 0.15
                );
              });
            };
            await expect.poll(settled, { timeout: 1000 }).toBe(true);
            const checked = await switchSample(page);
            observations.push({ style, size, before, checked });
            expect(
              checked.every(
                (row) => row.retainedThumb && row.trustedClicks.length === 1 && row.trustedClicks[0]
              )
            ).toBe(true);
            for (const row of checked)
              await page
                .locator(`[data-switch-case="${row.profile}-${row.direction}"]`)
                .press('Space');
            await expect
              .poll(
                async () =>
                  (await switchSample(page)).every(
                    (row, index) =>
                      !row.checked &&
                      Math.abs(
                        row.thumb.x - row.root.x - (before[index].thumb.x - before[index].root.x)
                      ) < 0.15
                  ),
                { timeout: 1000 }
              )
              .toBe(true);
          }
      }),
    120000
  );
});
