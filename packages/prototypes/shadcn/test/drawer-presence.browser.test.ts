// @vitest-environment node
// Native-browser evidence: authored for CI; do not substitute DOM-model results for this run.
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser } from '../../../../apps/www/src/content/docs/zh-cn/browser-harness';
import {
  renderProtoShadowSplitStyleArtifact,
  renderProtoStyleTokenCss,
} from '../../../cli/src/services/proto-style-css';
import { collectProtoStyleTokensFromFiles } from '../../../cli/src/services/prototype-style-tokens';
let browser: Awaited<ReturnType<typeof launchBrowser>>, script: string, tokens: string[];
const output =
  process.env.PUI_FINF_FEATURE_EVIDENCE_DIR ?? path.join(tmpdir(), 'pui-drawer-presence-evidence');
beforeAll(async () => {
  tokens = (
    await collectProtoStyleTokensFromFiles([
      'packages/prototypes/shadcn/src/drawer/content.proto.ts',
      'packages/prototypes/shadcn/src/drawer/mask.proto.ts',
      'packages/prototypes/base/src/drawer/root.proto.ts',
      'packages/prototypes/base/src/drawer/content.proto.ts',
      'packages/prototypes/base/src/drawer/overlay.proto.ts',
      'packages/prototypes/base/src/drawer/snap.ts',
    ])
  ).filter((x): x is string => typeof x === 'string');
  await mkdir(output, { recursive: true });
  script = (
    await build({
      stdin: {
        contents:
          "export {createDrawerPresenceFixture} from './packages/prototypes/shadcn/test/fixtures/drawer-presence';",
        resolveDir: process.cwd(),
        loader: 'ts',
      },
      bundle: true,
      write: false,
      format: 'iife',
      globalName: 'DrawerFixture',
      platform: 'browser',
      tsconfig: 'tsconfig.json',
    })
  ).outputFiles[0].text;
  browser = await launchBrowser();
}, 30000);
afterAll(async () => {
  await browser?.close();
});
describe('real Shadcn Drawer source physical presentation', () => {
  it.each(['document', 'shadow'] as const)(
    '%s captures slide/fade, retention, reversal and reduction',
    async (scope) => {
      const page = await browser.newPage();
      const samples: unknown[] = [];
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(String(error)));
      try {
        await page.route('**/*', (route) => route.abort());
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.setContent('<style>html{font-size:16px}body{margin:0;background:#eee}</style>');
        await page.addScriptTag({ content: script });
        await page.evaluate(
          ({ scope, css, artifact }) => {
            const sheet = document.createElement('style');
            sheet.textContent = css;
            document.head.append(sheet);
            (window as any).fixture = (window as any).DrawerFixture.createDrawerPresenceFixture(
              scope === 'shadow'
                ? { shadow: { mode: 'open', presentation: 'split', styleArtifact: artifact } }
                : {}
            );
          },
          {
            scope,
            css: renderProtoStyleTokenCss(tokens),
            artifact: {
              ...renderProtoShadowSplitStyleArtifact(tokens),
              cssText:
                renderProtoShadowSplitStyleArtifact(tokens).cssText +
                '\n:host(shadcn-drawer-content) [part="surface"]{width:320px;height:200px;box-sizing:border-box;background:white}:host(shadcn-drawer-mask) [part="surface"]{width:800px;height:600px;box-sizing:border-box}',
            },
          }
        );
        await page.waitForTimeout(30);
        await page.evaluate(() => (window as any).fixture.style());
        const sample = () => page.evaluate(() => (window as any).fixture.sample());
        const target = (open: boolean) =>
          page.evaluate((open) => (window as any).fixture.target(open), open);
        await target(true);
        await page.waitForTimeout(80);
        const early = await sample();
        samples.push({ stage: 'enter-early', ...early });
        expect(early.contentPhase).toBe('entering');
        expect(Number(early.opacity)).toBeGreaterThan(0);
        expect(Number(early.opacity)).toBeLessThan(1);
        await page.waitForTimeout(120);
        const middle = await sample();
        samples.push({ stage: 'enter-middle', ...middle });
        expect(middle.rect.y).not.toBe(early.rect.y);
        await page.screenshot({
          path: path.join(output, `drawer-${scope}-enter.png`),
          fullPage: true,
        });
        await page.waitForTimeout(400);
        expect((await sample()).contentPhase).toBe('entered');
        await target(false);
        await page.waitForTimeout(90);
        const leaving = await sample();
        samples.push({ stage: 'leaving', ...leaving });
        expect(leaving.contentPhase).toBe('leaving');
        expect(leaving.detached).toBe(false);
        await target(true);
        const reversal = await sample();
        samples.push({ stage: 'reversal', ...reversal });
        expect(Math.abs(reversal.rect.y - leaving.rect.y)).toBeLessThan(15);
        await page.waitForTimeout(600);
        expect((await sample()).contentPhase).toBe('entered');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await target(false);
        await page.waitForTimeout(40);
        const reduced = await sample();
        samples.push({ stage: 'reduced-close', ...reduced });
        expect(reduced.contentPhase).toBe('closed');
        expect(reduced.maskPhase).toBe('closed');
        expect(errors).toEqual([]);
      } finally {
        await writeFile(
          path.join(output, `drawer-${scope}-trace.json`),
          JSON.stringify({ scope, samples, errors }, null, 2)
        );
        await page.close();
      }
    },
    20000
  );
});
