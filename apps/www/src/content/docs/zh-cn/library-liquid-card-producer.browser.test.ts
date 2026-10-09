// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import ts from 'typescript';
import type { Browser, Response } from 'playwright-core';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { launchBrowser, startServer, stopServer } from './browser-harness';
import {
  applyDoubleRootTextScale,
  captureCurrentViewport,
  closeEvidenceContext,
  writeFailureRecord,
} from './library-card-capture';
import type { LibraryLiquidCandidateHarness } from '../../../components/library-liquid-scene';
import { readLibraryPlatformFonts } from './library-card-platform-fonts';
type CandidateWindow = Window & { libraryLiquidCardCandidate?: LibraryLiquidCandidateHarness };
import { libraryCardReadabilityFailures } from './library-card-readability';
import {
  holdMediaEmulation,
  readMediaObservation,
  assertMediaObservation,
} from '../../../../../../experiments/material-initial-paint/media-session';
import { verifyInitialPaintArtifact } from '../../../../../../packages/adapters/base/src/material/initial-paint-receipt';

const output =
  process.env.PUI_LIQUID_CARD_EVIDENCE_DIR ??
  path.join(os.tmpdir(), 'library-liquid-card-producer');
const sourceFile = 'apps/www/src/content/docs/zh-cn/library-cards-first-frame.browser.test.ts';
const digest = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
let browser: Browser,
  baseUrl = '',
  sha = '',
  tree = '',
  readCards: (observe?: boolean) => Parameters<typeof libraryCardReadabilityFailures>[0],
  readCardsSha = '';
const results: unknown[] = [];
const safeMedia = {
  'prefers-reduced-motion': 'no-preference',
  'prefers-reduced-transparency': 'no-preference',
  'prefers-contrast': 'no-preference',
  'forced-colors': 'none',
};
async function boundedBody(read: () => Promise<Buffer>): Promise<Buffer> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      read(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Fixture response body exceeded 10s')), 10_000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
beforeAll(async () => {
  sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim();
  expect(
    execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
      encoding: 'utf8',
    }).trim()
  ).toBe('');
  if (process.env.CANDIDATE_SHA) expect(sha).toBe(process.env.CANDIDATE_SHA);
  await mkdir(output, { recursive: true });
  expect(await readdir(output)).toEqual([]);
  // Reuse the actual existing observer without copying/weakening its geometry
  // or readability model and without executing the other browser suite/hooks.
  const source = await readFile(sourceFile, 'utf8');
  const ast = ts.createSourceFile(sourceFile, source, ts.ScriptTarget.Latest, true);
  const declaration = ast.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === 'readCards'
  );
  if (!declaration) throw new Error('Current library Card observer was not found');
  const code = declaration.getText(ast);
  readCardsSha = digest(code);
  const js = ts.transpileModule(code, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  readCards = new Function(`${js};return readCards;`)();
  baseUrl = await startServer([
    '/en/test/liquid-library-card/',
    '/zh-cn/test/liquid-library-card/',
  ]);
  browser = await launchBrowser();
}, 150_000);
afterAll(async () => {
  let failure: unknown;
  try {
    const readback = {
      sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      tree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim(),
      dirty: !!execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
        encoding: 'utf8',
      }).trim(),
    };
    const exactSource = readback.sha === sha && readback.tree === tree && !readback.dirty;
    await writeFile(
      path.join(output, 'summary.json'),
      JSON.stringify(
        {
          sha,
          tree,
          readback,
          exactSource,
          sourceFile,
          readCardsSha,
          browser: browser?.version(),
          scope:
            'Actual complete Liquid Card candidate producer plus opaque no-JS readability. No prerender adoption, no-JS optical paint, four-Adapter Card parity or production rollout claim.',
          results,
        },
        null,
        2
      )
    );
    const files: Array<{ file: string; sha256: string }> = [];
    async function collect(directory: string) {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) await collect(file);
        else if (entry.name !== 'manifest.json')
          files.push({ file: path.relative(output, file), sha256: digest(await readFile(file)) });
      }
    }
    await collect(output);
    await writeFile(
      path.join(output, 'manifest.json'),
      JSON.stringify({ sha, tree, exactSource, files }, null, 2)
    );
    expect(exactSource).toBe(true);
  } catch (error) {
    failure = error;
  }
  try {
    if (browser) await closeEvidenceContext(browser, !!failure);
  } catch (error) {
    failure ??= error;
  }
  try {
    await stopServer();
  } catch (error) {
    failure ??= error;
  }
  if (failure) throw failure;
}, 60_000);
describe('actual complete Liquid Card optical producer', () => {
  for (const locale of ['en', 'zh-cn'])
    for (const theme of ['light', 'dark'])
      for (const mobile of [false, true]) {
        const name = `${locale}-${theme}-${mobile ? '320-text200' : '1440-text100'}`;
        it(
          name,
          async () => {
            const directory = path.join(output, name);
            await mkdir(directory, { recursive: true });
            const context = await browser.newContext({
              viewport: mobile ? { width: 320, height: 900 } : { width: 1440, height: 1000 },
              deviceScaleFactor: 1,
              colorScheme: theme as 'light' | 'dark',
            });
            await context.route('**/*', (route) =>
              new URL(route.request().url()).origin === new URL(baseUrl).origin
                ? route.continue()
                : route.abort()
            );
            await context.addInitScript(
              (theme) => localStorage.setItem('starlight-theme', theme),
              theme
            );
            const page = await context.newPage(),
              issues: unknown[] = [],
              assets: unknown[] = [],
              pendingAssets: Promise<void>[] = [];
            const collectResponse = (response: Response) => {
              if (new URL(response.url()).origin !== new URL(baseUrl).origin) return;
              pendingAssets.push(
                (async () => {
                  try {
                    const bytes = await boundedBody(() => response.body()),
                      assetSha = digest(bytes);
                    await mkdir(path.join(output, 'assets'), { recursive: true });
                    writeFileSync(path.join(output, 'assets', assetSha + '.bin'), bytes);
                    assets.push({
                      url: new URL(response.url()).pathname + new URL(response.url()).search,
                      status: response.status(),
                      type: response.headers()['content-type'],
                      sha256: assetSha,
                      bytes: bytes.length,
                    });
                  } catch (error) {
                    issues.push({
                      operation: 'asset-body',
                      url: response.url(),
                      error: String(error),
                    });
                  }
                })()
              );
            };
            page.on('response', collectResponse);
            let failed = false,
              mediaSession: Awaited<ReturnType<typeof holdMediaEmulation>> | undefined;
            let media: Awaited<ReturnType<typeof readMediaObservation>> | undefined;
            try {
              const requested = { ...safeMedia, 'prefers-color-scheme': theme };
              mediaSession = await holdMediaEmulation(context, page, requested, (issue) =>
                issues.push(issue)
              );
              await page.goto(`${baseUrl}/${locale}/test/liquid-library-card/`, {
                waitUntil: 'networkidle',
              });
              media = await readMediaObservation(page, requested);
              assertMediaObservation(media);
              const card = page.locator('[data-library-liquid-candidate]');
              if (mobile) {
                const scale = await page.evaluate(applyDoubleRootTextScale);
                expect(scale.after).toBe(scale.before * 2);
                expect(scale.priority).toBe('important');
              }
              await card.scrollIntoViewIfNeeded();
              await page.waitForFunction(
                () => {
                  try {
                    return (
                      (window as CandidateWindow).libraryLiquidCardCandidate?.state().quality ===
                      'self-optical'
                    );
                  } catch {
                    return false;
                  }
                },
                undefined,
                { timeout: 30_000 }
              );
              await page.evaluate(() =>
                (window as CandidateWindow).libraryLiquidCardCandidate!.beginCapture()
              );
              await expect
                .poll(
                  () =>
                    page.evaluate(async () => {
                      try {
                        await (window as CandidateWindow).libraryLiquidCardCandidate!.artifact();
                        return true;
                      } catch {
                        return false;
                      }
                    }),
                  { timeout: 15_000 }
                )
                .toBe(true);
              const artifact = await page.evaluate(() =>
                (window as CandidateWindow).libraryLiquidCardCandidate!.artifact()
              );
              expect(
                await verifyInitialPaintArtifact(artifact.serialized, artifact.binding)
              ).toEqual(artifact.receipt);
              const cards = await page.evaluate(readCards, false);
              expect(libraryCardReadabilityFailures(cards)).toEqual([]);
              expect(await page.locator('[data-library-action]').count()).toBe(6);
              expect(await page.locator('a a').count()).toBe(0);
              const source = await card.evaluate((element) => {
                const canvas = element.querySelector('canvas')!,
                  host = element.querySelector('wc-library-liquid-optical-surface')!;
                return {
                  directCanvas: canvas.parentElement?.hasAttribute('data-library-liquid-scene'),
                  canvas: canvas.getBoundingClientRect().toJSON(),
                  host: host.getBoundingClientRect().toJSON(),
                  canvasVisibility: getComputedStyle(canvas).visibility,
                  blur: getComputedStyle(host).backdropFilter,
                  quality: (host as HTMLElement).dataset.materialQuality,
                  source: (host as HTMLElement).dataset.materialSource,
                  actionOwners: element.querySelectorAll('a[data-library-action]').length,
                  extraControls: element.querySelectorAll('button,[role="button"],[tabindex]')
                    .length,
                };
              });
              expect(source.directCanvas).toBe(true);
              expect(source.canvasVisibility).toBe('visible');
              expect(source.blur).toBe('none');
              expect(source.quality).toBe('self-optical');
              expect(source.source).toBe('visible-app-canvas');
              expect(source.actionOwners).toBe(1);
              expect(source.extraControls).toBe(0);
              const fonts = await readLibraryPlatformFonts(page, 'liquid-glass');
              const clip = await card.evaluate((element) => {
                const r = element.getBoundingClientRect();
                return {
                  x: Math.max(0, r.x + scrollX - 8),
                  y: Math.max(0, r.y + scrollY - 8),
                  width: r.width + 16,
                  height: r.height + 16,
                  scale: 1,
                };
              });
              const image = await captureCurrentViewport(
                page,
                path.join(directory, 'actual-liquid-card.png'),
                clip
              );
              page.off('response', collectResponse);
              await Promise.all(pendingAssets);
              expect(
                await page.evaluate(() =>
                  (window as CandidateWindow).libraryLiquidCardCandidate!.artifact()
                )
              ).toEqual(artifact);
              expect(issues).toEqual([]);
              await writeFile(
                path.join(directory, 'producer.json'),
                JSON.stringify(
                  {
                    sha,
                    tree,
                    name,
                    role: 'actual complete Card enhanced candidate producer; not first-frame acceptance',
                    artifact,
                    cards,
                    source,
                    fonts,
                    media,
                    image,
                    assets,
                    readCardsSha,
                  },
                  null,
                  2
                )
              );
              results.push({ name, passed: true, image });
            } catch (error) {
              failed = true;
              const failureImage = await captureCurrentViewport(
                page,
                path.join(directory, 'failure.png')
              ).catch((issue) => ({ error: String(issue) }));
              const state = await page
                .evaluate(() => {
                  try {
                    return (window as CandidateWindow).libraryLiquidCardCandidate?.state();
                  } catch (error) {
                    return { error: String(error) };
                  }
                })
                .catch((issue) => ({ error: String(issue) }));
              await writeFailureRecord(path.join(directory, 'failure.json'), {
                sha,
                tree,
                name,
                error: String(error),
                state,
                media,
                failureImage,
                assets,
                issues,
              });
              results.push({ name, passed: false, error: String(error) });
              throw error;
            } finally {
              page.off('response', collectResponse);
              await Promise.all(pendingAssets);
              await mediaSession?.close();
              await closeEvidenceContext(context, failed);
            }
          },
          90_000
        );
      }
});

describe('candidate Card keeps its complete opaque no-JS fallback', () => {
  for (const locale of ['en', 'zh-cn'])
    it(`${locale} 320px with 200% text`, async () => {
      const name = `${locale}-no-script-opaque-320-text200`,
        directory = path.join(output, name);
      await mkdir(directory, { recursive: true });
      const context = await browser.newContext({
        javaScriptEnabled: false,
        viewport: { width: 320, height: 900 },
      });
      await context.route('**/*', (route) =>
        new URL(route.request().url()).origin === new URL(baseUrl).origin
          ? route.continue()
          : route.abort()
      );
      const page = await context.newPage();
      let failed = false,
        mediaSession: Awaited<ReturnType<typeof holdMediaEmulation>> | undefined;
      let media: Awaited<ReturnType<typeof readMediaObservation>> | undefined;
      try {
        const requested = { ...safeMedia, 'prefers-color-scheme': 'light' };
        mediaSession = await holdMediaEmulation(context, page, requested, (issue) =>
          console.warn(issue)
        );
        await page.goto(`${baseUrl}/${locale}/test/liquid-library-card/`);
        media = await readMediaObservation(page, requested);
        assertMediaObservation(media);
        const scale = await page.evaluate(applyDoubleRootTextScale);
        expect(scale.after).toBe(scale.before * 2);
        expect(scale.priority).toBe('important');
        const cards = await page.evaluate(readCards, false);
        expect(libraryCardReadabilityFailures(cards)).toEqual([]);
        expect(await page.locator('[data-library-action]').count()).toBe(6);
        expect(await page.locator('a a').count()).toBe(0);
        const card = page.locator('[data-library-liquid-candidate]');
        await card.scrollIntoViewIfNeeded();
        const clip = await card.evaluate((element) => {
          const r = element.getBoundingClientRect();
          return {
            x: Math.max(0, r.x + scrollX - 8),
            y: Math.max(0, r.y + scrollY - 8),
            width: r.width + 16,
            height: r.height + 16,
            scale: 1,
          };
        });
        const image = await captureCurrentViewport(
          page,
          path.join(directory, 'opaque-fallback-only.png'),
          clip
        );
        expect(
          await card
            .locator('wc-library-liquid-optical-surface')
            .getAttribute('data-material-quality')
        ).toBeNull();
        await card.locator('a[data-library-action]').click();
        await page.waitForURL(`${baseUrl}/${locale}/ui-libraries/liquid-glass/`);
        await writeFile(
          path.join(directory, 'fallback.json'),
          JSON.stringify(
            {
              sha,
              tree,
              role: 'Opaque accessible fallback only; not a Liquid optical appearance result',
              scale,
              media,
              cards,
              image,
              destination: page.url(),
            },
            null,
            2
          )
        );
        results.push({ name, passed: true, role: 'opaque-no-JS', image });
      } catch (error) {
        failed = true;
        const image = await captureCurrentViewport(page, path.join(directory, 'failure.png')).catch(
          (issue) => ({ error: String(issue) })
        );
        await writeFailureRecord(path.join(directory, 'failure.json'), {
          sha,
          tree,
          error: String(error),
          media,
          image,
        });
        results.push({ name, passed: false, error: String(error) });
        throw error;
      } finally {
        await mediaSession?.close();
        await closeEvidenceContext(context, failed);
      }
    }, 90_000);
});
