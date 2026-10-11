// @vitest-environment node
// Dedicated experiment owner: liquid-elevation-control-evidence.yml.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { Browser } from 'playwright-core';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { launchBrowser } from './browser-harness';
import {
  holdMediaEmulation,
  readMediaObservation,
  assertMediaObservation,
} from '../../../../../../experiments/material-initial-paint/media-session';
import type { LibraryLiquidCandidateHarness } from '../../../components/library-liquid-scene';

type ControlWindow = Window & {
  liquidElevationControl?: Record<string, LibraryLiquidCandidateHarness>;
};
const output = process.env.PUI_LIQUID_CONTROL_EVIDENCE_DIR!;
const dist = process.env.PUI_LIQUID_CONTROL_DIST!;
const digest = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
const results: unknown[] = [];
let browser: Browser,
  server: Server,
  baseUrl = '',
  sha = '',
  tree = '';
const safeMedia = {
  'prefers-color-scheme': 'light',
  'prefers-reduced-motion': 'no-preference',
  'prefers-reduced-transparency': 'no-preference',
  'prefers-contrast': 'no-preference',
  'forced-colors': 'none',
};
const sourceState = () => ({
  sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  tree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim(),
  dirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
    encoding: 'utf8',
  }).trim(),
});
beforeAll(async () => {
  if (!output || !dist)
    throw new Error('Dedicated evidence and prebuilt experiment directories are required');
  const state = sourceState();
  sha = state.sha;
  tree = state.tree;
  expect(state.dirty).toBe('');
  if (process.env.CANDIDATE_SHA) expect(sha).toBe(process.env.CANDIDATE_SHA);
  await mkdir(output, { recursive: true });
  expect(await readdir(output)).toEqual([]);
  await readFile(path.join(dist, 'index.html'));
  server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url!, 'http://localhost');
      const file = path.resolve(
        dist,
        '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname))
      );
      if (!file.startsWith(path.resolve(dist) + path.sep)) {
        response.writeHead(403).end();
        return;
      }
      const bytes = await readFile(file);
      response.setHeader(
        'Content-Type',
        file.endsWith('.html')
          ? 'text/html'
          : file.endsWith('.js')
            ? 'text/javascript'
            : file.endsWith('.css')
              ? 'text/css'
              : 'application/octet-stream'
      );
      response.end(bytes);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No isolated server port');
  baseUrl = `http://127.0.0.1:${address.port}`;
  browser = await launchBrowser();
}, 60_000);
afterAll(async () => {
  let failure: unknown;
  try {
    const readback = sourceState();
    const exactSource = readback.sha === sha && readback.tree === tree && !readback.dirty;
    await writeFile(
      path.join(output, 'summary.json'),
      JSON.stringify(
        {
          sha,
          tree,
          readback,
          exactSource,
          browser: browser?.version(),
          scope:
            'Isolated real Liquid Surface none/raised; no product defaults, optical admission, SSR admission, or native adapter acceptance changed',
          results,
        },
        null,
        2
      )
    );
    const files: unknown[] = [];
    const collect = async (directory: string) => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) await collect(file);
        else
          files.push({ file: path.relative(output, file), sha256: digest(await readFile(file)) });
      }
    };
    await collect(output);
    await writeFile(
      path.join(output, 'manifest.json'),
      JSON.stringify({ sha, tree, exactSource, files }, null, 2)
    );
    expect(exactSource).toBe(true);
  } catch (error) {
    failure = error;
  } finally {
    await browser?.close();
    if (server)
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
  }
  if (failure) throw failure;
}, 30_000);
for (const name of [
  'default-off',
  'no-script',
  'optical-on',
  'reduced-transparency',
  'forced-colors',
  'source-revoked',
] as const) {
  it(
    name,
    async () => {
      const directory = path.join(output, name);
      await mkdir(directory, { recursive: true });
      const context = await browser.newContext({
        viewport: { width: 900, height: 1400 },
        deviceScaleFactor: 1,
        colorScheme: 'light',
        javaScriptEnabled: name !== 'no-script',
      });
      await context.route('**/*', (route) =>
        new URL(route.request().url()).origin === baseUrl ? route.continue() : route.abort()
      );
      const page = await context.newPage();
      const issues: unknown[] = [];
      page.on('pageerror', (error) => issues.push(String(error)));
      const requested = {
        ...safeMedia,
        ...(name === 'reduced-transparency' ? { 'prefers-reduced-transparency': 'reduce' } : {}),
        ...(name === 'forced-colors' ? { 'forced-colors': 'active' } : {}),
      };
      let mediaSession: Awaited<ReturnType<typeof holdMediaEmulation>> | undefined;
      try {
        mediaSession = await holdMediaEmulation(context, page, requested, (issue) =>
          issues.push(issue)
        );
        const optical = name !== 'default-off' && name !== 'no-script';
        await page.goto(baseUrl + (optical ? '/?optical=1' : '/'), { waitUntil: 'networkidle' });
        const media = await readMediaObservation(page, requested);
        assertMediaObservation(media);
        if (optical)
          await page.waitForFunction(
            () => Object.keys((window as ControlWindow).liquidElevationControl ?? {}).length === 4
          );
        if (name === 'optical-on' || name === 'source-revoked')
          await page.waitForFunction(
            () =>
              Array.from(
                document.querySelectorAll<HTMLElement>('wc-library-liquid-optical-surface')
              ).every((el) => el.dataset.materialQuality === 'self-optical'),
            undefined,
            { timeout: 30_000 }
          );
        if (name === 'source-revoked') {
          await page.evaluate(() =>
            Object.values((window as ControlWindow).liquidElevationControl!).forEach((h) =>
              h.sourceEnabled(false)
            )
          );
          await page.waitForFunction(() =>
            Array.from(
              document.querySelectorAll<HTMLElement>('wc-library-liquid-optical-surface')
            ).every((el) => el.dataset.materialQuality === 'opaque-fallback')
          );
        }
        if (name === 'reduced-transparency' || name === 'forced-colors')
          await page.waitForFunction(() =>
            Array.from(
              document.querySelectorAll<HTMLElement>('wc-library-liquid-optical-surface')
            ).every((el) =>
              ['opaque-fallback', 'unavailable'].includes(el.dataset.materialQuality ?? '')
            )
          );
        const observations = await page.evaluate(() =>
          Array.from(document.querySelectorAll<HTMLElement>('[data-control-profile]')).map(
            (row) => {
              const host = row.querySelector<HTMLElement>('wc-library-liquid-optical-surface')!,
                canvas = row.querySelector('canvas')!,
                css = getComputedStyle(host),
                rect = host.getBoundingClientRect();
              return {
                id: row.dataset.controlProfile!,
                props: JSON.parse(host.dataset.libraryProps!),
                tokens: host.dataset.puiStyle,
                prototype: host.dataset.libraryPrototype,
                geometry: rect.toJSON(),
                shadow: css.boxShadow,
                radius: css.borderTopLeftRadius,
                background: css.backgroundImage,
                fill: css.backgroundColor,
                quality: host.dataset.materialQuality ?? null,
                reason: host.dataset.materialReason ?? null,
                scene: canvas.getBoundingClientRect().toJSON(),
                sourceState: canvas.parentElement!.dataset.libraryLiquidState ?? null,
                sourcePng: canvas.toDataURL(),
                sceneClip: canvas.getBoundingClientRect().toJSON(),
              };
            }
          )
        );
        expect(observations).toHaveLength(4);
        for (const item of observations) {
          expect(item.prototype).toBe('liquid-glass-surface-root');
          expect(item.geometry.height).toBe(item.id.startsWith('45-') ? 45 : 64);
          expect(item.geometry.width).toBeCloseTo(item.id.startsWith('45-') ? 156.046875 : 222, 3);
          expect(item.scene.width).toBe(536);
          expect(item.scene.height).toBe(160);
          expect(item.tokens!.split(' ')).toContain('rounded-full');
          // Current family emits a pixel radius; CSS clamps this to half-height.
          expect(item.radius).toMatch(/^\d+(\.\d+)?px$/);
          expect(
            Math.min(parseFloat(item.radius), item.geometry.width / 2, item.geometry.height / 2)
          ).toBe(item.geometry.height / 2);
          expect(item.tokens!.split(' ').includes('shadow-sm')).toBe(
            item.props.elevation === 'raised'
          );
          if (name !== 'forced-colors')
            expect(item.shadow === 'none').toBe(item.props.elevation === 'none');
          if (name === 'optical-on') {
            expect(item.quality).toBe('self-optical');
            expect(item.background).toContain('data:image/png;base64,');
          } else {
            expect(item.quality).not.toBe('self-optical');
            expect(item.background).toBe('none');
          }
          await writeFile(
            path.join(directory, `${item.id}-source.png`),
            Buffer.from(item.sourcePng.split(',')[1], 'base64')
          );
          await page.screenshot({
            path: path.join(directory, `${item.id}-scene.png`),
            clip: {
              x: item.sceneClip.x,
              y: item.sceneClip.y,
              width: item.sceneClip.width,
              height: item.sceneClip.height,
            },
            animations: 'disabled',
          });
        }
        for (const h of [45, 64]) {
          const none = observations.find((x) => x.id === `${h}-none`)!,
            raised = observations.find((x) => x.id === `${h}-raised`)!;
          expect(none.geometry.x - none.scene.x).toBeCloseTo(raised.geometry.x - raised.scene.x, 3);
          expect(none.geometry.y - none.scene.y).toBeCloseTo(raised.geometry.y - raised.scene.y, 3);
          expect(none.radius).toBe(raised.radius);
          expect(none.tokens!.split(' ')).toEqual(
            raised.tokens!.split(' ').filter((token) => token !== 'shadow-sm')
          );
        }
        if (name === 'optical-on')
          for (const h of [45, 64]) {
            const none = observations.find((x) => x.id === `${h}-none`)!,
              raised = observations.find((x) => x.id === `${h}-raised`)!;
            expect(none.background).toBe(raised.background);
            expect(none.sourcePng).toBe(raised.sourcePng);
          }
        expect(issues).toEqual([]);
        await page.screenshot({
          path: path.join(directory, 'comparison.png'),
          fullPage: true,
          animations: 'disabled',
        });
        const record = {
          sha,
          tree,
          name,
          media,
          issues,
          observations: observations.map(({ sourcePng, background, ...rest }) => ({
            ...rest,
            sourceSha256: digest(Buffer.from(sourcePng.split(',')[1], 'base64')),
            opticalImageSha256: background === 'none' ? null : digest(background),
          })),
        };
        await writeFile(path.join(directory, 'observations.json'), JSON.stringify(record, null, 2));
        results.push({ name, status: 'passed' });
      } catch (error) {
        results.push({ name, status: 'failed', error: String(error) });
        await writeFile(
          path.join(directory, 'failure.json'),
          JSON.stringify({ sha, tree, name, error: String(error), issues }, null, 2)
        );
        await page
          .screenshot({ path: path.join(directory, 'failure.png'), fullPage: true })
          .catch(() => {});
        throw error;
      } finally {
        await mediaSession?.close();
        await context.close();
      }
    },
    60_000
  );
}
