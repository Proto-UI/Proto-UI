// @vitest-environment node
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser } from '../../../../apps/www/src/content/docs/zh-cn/browser-harness';
import type {
  AsyncRegionConsumer,
  AsyncRegionFamily,
  AsyncRegionSnapshot,
} from './async-region-native-consumer';

declare global {
  interface Window {
    consumer: AsyncRegionConsumer;
  }
}

const families = [
  { family: 'base', prefix: 'base', scope: '0.3' },
  { family: 'shadcn', prefix: 'shadcn', scope: '0.3' },
  { family: 'brutalist', prefix: 'brutalist', scope: '0.3' },
  { family: 'bootstrap-2-3-2', prefix: 'bootstrap-2-3-2', scope: '0.4/WIP' },
  { family: 'liquid-glass', prefix: 'liquid-glass', scope: '0.4/WIP' },
] as const satisfies readonly {
  family: AsyncRegionFamily;
  prefix: string;
  scope: '0.3' | '0.4/WIP';
}[];
const includeWip = process.env.PUI_ASYNC_REGION_INCLUDE_WIP === '1';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
let browser: Awaited<ReturnType<typeof launchBrowser>>;
let output: string;
let bundleSha256: string;

beforeAll(async () => {
  const parent = process.env.PUI_FINF_FEATURE_EVIDENCE_DIR ?? tmpdir();
  await mkdir(parent, { recursive: true });
  output = await mkdtemp(path.join(parent, 'async-region-'));
  console.info(`Async Region native evidence: ${output}`);
  const built = await build({
    entryPoints: [fileURLToPath(new URL('./async-region-native-consumer.ts', import.meta.url))],
    absWorkingDir: root,
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'AsyncRegionConsumer',
    platform: 'browser',
    tsconfig: path.join(root, 'tsconfig.json'),
  });
  const bundle = built.outputFiles[0];
  if (!bundle) throw new Error('The Async Region consumer bundle is missing.');
  bundleSha256 = createHash('sha256').update(bundle.contents).digest('hex');
  await writeFile(path.join(output, 'consumer.js'), bundle.contents);
  browser = await launchBrowser();
  await writeFile(
    path.join(output, 'setup.json'),
    JSON.stringify(
      {
        browserVersion: browser.version(),
        bundleSha256,
        host: 'Web Component in Chromium',
        includeWip,
        enabledCases: includeWip ? 10 : 6,
        optionalWipCases: 4,
        acceptance: 'Native editing and busy projection only; actual AT delivery is untested.',
      },
      null,
      2
    )
  );
}, 30_000);

afterAll(async () => browser?.close());

function expectRegion(
  snapshot: AsyncRegionSnapshot,
  prefix: string,
  busy: boolean,
  value: string,
  payload: string
) {
  expect(snapshot).toMatchObject({
    regionName: `${prefix}-async-region-root`,
    liveRegionName: `${prefix}-live-region-root`,
    regionConstructor: true,
    liveRegionConstructor: true,
    ariaBusy: String(busy),
    busy,
    sameBusyHandle: true,
    exposes: ['busy'],
    role: null,
    live: null,
    label: null,
    labelledBy: null,
    tabIndex: -1,
    inert: false,
    ariaDisabled: null,
    sameInput: true,
    sameRetry: true,
    sameLiveRegion: true,
    samePayload: true,
    payload,
    liveRole: 'status',
    livePoliteness: 'polite',
    liveAtomic: 'true',
    inputValue: value,
    inputDisabled: false,
    inputReadOnly: false,
    retryDisabled: false,
  });
}

function expectEditing(snapshot: AsyncRegionSnapshot) {
  expect(snapshot).toMatchObject({
    activeId: 'draft',
    selectionStart: 0,
    selectionEnd: 'Draft retained'.length,
  });
}

describe('Async Region native Web Component consumers', () => {
  for (const { family, prefix, scope } of families) {
    for (const initiallyBusy of [undefined, true] as const) {
      const mode = initiallyBusy === undefined ? 'default' : 'initially-busy';
      it.skipIf(scope === '0.4/WIP' && !includeWip)(
        `${family} (${scope}), ${mode}: retains native editing and retry through busy transitions`,
        async () => {
          // P-BASE-ASYNC-REGION-BUSY/DYNAMIC/CONTENT/NO-INTERACTION.
          // Native input/selection belongs to the authored input, not the Region.
          const id = `${family}-${mode}`;
          const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${family} Async Region native consumer</title>
<style>body { margin: 0; } main { padding: 32px; font: 16px/1.5 system-ui; } button, input { font: inherit; } label { display: block; }</style>
</head><body>
<script src="./consumer.js"></script>
<script>window.consumer = AsyncRegionConsumer.mount(${JSON.stringify(family)}, ${initiallyBusy === undefined ? 'undefined' : 'true'});</script>
</body></html>`;
          const fixturePath = path.join(output, `${id}.html`);
          await writeFile(fixturePath, html);
          const fixtureSha256 = createHash('sha256').update(html).digest('hex');
          const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
          const errors: string[] = [];
          const samples: { stage: string; observed: AsyncRegionSnapshot }[] = [];
          const screenshots: { path: string; sha256: string }[] = [];
          let result: 'passed' | 'failed' = 'failed';
          let failure: string | null = null;
          page.on('pageerror', (error) => errors.push(String(error)));
          const capture = async (stage: string) => {
            const imagePath = path.join(output, `${id}-${stage}.png`);
            const bytes = await page.screenshot({ path: imagePath });
            screenshots.push({
              path: imagePath,
              sha256: createHash('sha256').update(bytes).digest('hex'),
            });
          };
          try {
            await page.route(/^https?:\/\//, (route) => route.abort());
            await page.goto(pathToFileURL(fixturePath).href);
            expect(errors).toEqual([]);
            const initial = await page.evaluate(() => window.consumer.read());
            samples.push({ stage: 'initial', observed: initial });
            expectRegion(initial, prefix, initiallyBusy === true, 'Draft', 'No new messages.');
            await capture('initial');

            // Sentinel focus is setup. All input under test uses native keyboard delivery.
            await page.locator('#before').focus();
            await page.keyboard.press('Tab');
            expect(
              await page
                .getByRole('textbox', { name: 'Draft reply' })
                .evaluate((element) => element === document.activeElement)
            ).toBe(true);
            await page.keyboard.press('End');
            await page.keyboard.type(' retained');
            await page.keyboard.press('Home');
            await page.keyboard.press('Shift+End');
            const editing = await page.evaluate(() => window.consumer.read());
            samples.push({ stage: 'editing', observed: editing });
            expectRegion(
              editing,
              prefix,
              initiallyBusy === true,
              'Draft retained',
              'No new messages.'
            );
            expectEditing(editing);

            // Read in the same task as the props write: no grace wait can hide a sync failure.
            const busy = await page.evaluate(() => {
              window.consumer.setBusy(true);
              window.consumer.updatePayload('Checking messages.');
              return window.consumer.read();
            });
            samples.push({ stage: 'busy', observed: busy });
            expectRegion(busy, prefix, true, 'Draft retained', 'Checking messages.');
            expectEditing(busy);
            await capture('busy');

            const ready = await page.evaluate(() => {
              window.consumer.updatePayload('3 new messages.');
              window.consumer.setBusy(false);
              return window.consumer.read();
            });
            samples.push({ stage: 'ready', observed: ready });
            expectRegion(ready, prefix, false, 'Draft retained', '3 new messages.');
            expectEditing(ready);
            await capture('ready');

            const reset = await page.evaluate(() => {
              window.consumer.setBusy(true);
              const before = window.consumer.read();
              window.consumer.resetBusy();
              return { before, after: window.consumer.read() };
            });
            samples.push(
              { stage: 'before-prop-removal', observed: reset.before },
              { stage: 'after-prop-removal', observed: reset.after }
            );
            expectRegion(reset.before, prefix, true, 'Draft retained', '3 new messages.');
            expectRegion(reset.after, prefix, false, 'Draft retained', '3 new messages.');
            expectEditing(reset.before);
            expectEditing(reset.after);

            await page.evaluate(() => window.consumer.setBusy(true));
            await page.keyboard.press('Backspace');
            await page.keyboard.type('Revised');
            const revised = await page.evaluate(() => window.consumer.read());
            samples.push({ stage: 'edited-while-busy', observed: revised });
            expectRegion(revised, prefix, true, 'Revised', '3 new messages.');
            expect(revised.activeId).toBe('draft');
            expect(revised.selectionStart).toBe('Revised'.length);
            expect(revised.selectionEnd).toBe('Revised'.length);
            await page.keyboard.press('Tab');
            expect(
              await page
                .getByRole('button', { name: 'Retry', exact: true })
                .evaluate((element) => element === document.activeElement)
            ).toBe(true);
            await page.keyboard.press('Enter');
            const retried = await page.evaluate(() => window.consumer.read());
            samples.push({ stage: 'retry-while-busy', observed: retried });
            expectRegion(retried, prefix, true, 'Revised', '3 new messages.');
            expect(retried.retryCount).toBe(1);
            expect(retried.nativeEvents).toEqual(
              expect.arrayContaining([
                expect.objectContaining({ type: 'input', target: 'draft', trusted: true }),
                expect.objectContaining({ type: 'click', target: 'retry', trusted: true }),
              ])
            );
            await page.keyboard.press('Tab');
            expect(
              await page
                .getByRole('button', { name: 'After region' })
                .evaluate((element) => element === document.activeElement)
            ).toBe(true);
            expect(errors).toEqual([]);
            result = 'passed';
          } catch (error) {
            failure = String(error);
            throw error;
          } finally {
            try {
              await writeFile(
                path.join(output, `${id}.json`),
                JSON.stringify(
                  {
                    family,
                    scope,
                    mode,
                    host: 'Web Component in Chromium',
                    browserVersion: browser.version(),
                    bundleSha256,
                    fixturePath,
                    fixtureSha256,
                    result,
                    failure,
                    errors,
                    samples,
                    screenshots,
                    limitations: [
                      'No actual assistive-technology delivery was measured.',
                      'Native input belongs to authored HTML controls; no shared Focus acceptance is implied.',
                      'No family typography/color, responsive, non-Web or other Web-Adapter acceptance is implied.',
                      'Bootstrap and Liquid Glass are optional 0.4/WIP source samples.',
                    ],
                  },
                  null,
                  2
                )
              );
            } finally {
              await page.close();
            }
          }
        },
        30_000
      );
    }
  }
});
