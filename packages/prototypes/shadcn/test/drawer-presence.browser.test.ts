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
import { DRAWER_PRESENCE_SOURCE_FILES } from './fixtures/drawer-presence-sources';
let browser: Awaited<ReturnType<typeof launchBrowser>>, script: string, tokens: string[];
const output =
  process.env.PUI_FINF_FEATURE_EVIDENCE_DIR ?? path.join(tmpdir(), 'pui-drawer-presence-evidence');
beforeAll(async () => {
  tokens = (await collectProtoStyleTokensFromFiles(DRAWER_PRESENCE_SOURCE_FILES)).filter(
    (x): x is string => typeof x === 'string'
  );
  await mkdir(output, { recursive: true });
  script = (
    await build({
      stdin: {
        contents:
          "export {createDrawerPresenceFixture,createDrawerScrollFixture} from './packages/prototypes/shadcn/test/fixtures/drawer-presence';",
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
        // Report setup/admission failure before attempting exposed motion samples.
        expect(errors, `${scope} Root/Content/Mask setup`).toEqual([]);
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

describe('real Drawer semantic Scroll physical target', () => {
  it.each(['document', 'shadow'] as const)(
    '%s keeps one bounded slot scrollport',
    async (scope) => {
      const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
      const samples: unknown[] = [],
        errors: string[] = [];
      page.on('pageerror', (error) => errors.push(String(error)));
      try {
        await page.route('**/*', (route) => route.abort());
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.setContent('<style>html{font-size:16px}body{margin:0}</style>');
        await page.addScriptTag({ content: script });
        await page.evaluate(
          ({ scope, css, artifact }) => {
            const sheet = document.createElement('style');
            sheet.textContent = css;
            document.head.append(sheet);
            (window as any).scrollFixture = (window as any).DrawerFixture.createDrawerScrollFixture(
              scope === 'shadow'
                ? { shadow: { mode: 'open', presentation: 'split', styleArtifact: artifact } }
                : {}
            );
            (window as any).scrollFixture.open();
          },
          {
            scope,
            css: renderProtoStyleTokenCss(tokens),
            artifact: renderProtoShadowSplitStyleArtifact(tokens),
          }
        );
        const sample = () => page.evaluate(() => (window as any).scrollFixture.sample());
        await expect.poll(async () => (await sample()).phase).toBe('entered');
        await expect.poll(async () => (await sample()).facts.projection).toBe('system');
        const initial = await sample();
        samples.push({ stage: 'initial', ...initial });
        expect(errors).toEqual([]);
        expect(initial.isHost).toBe(scope === 'document');
        expect(initial.clientHeight).toBeGreaterThan(0);
        expect(initial.surfaceRect.height).toBeLessThanOrEqual(201);
        expect(initial.scrollHeight).toBeGreaterThan(initial.clientHeight);
        const assertHorizontalClip = async (
          stage: string,
          leftWidth: number,
          bottomHeight: number
        ) => {
          // Bottom spans the whole available width by contract. Use the admitted
          // left-side 20rem recipe so an outside-edge hit probe is actually visible.
          await page.evaluate(() => (window as any).scrollFixture.side('left'));
          await expect.poll(async () => (await sample()).acceptedSide).toBe('left');
          await expect
            .poll(async () => Math.round((await sample()).surfaceRect.width))
            .toBe(leftWidth);
          const clipping = await sample();
          samples.push({ stage, ...clipping });
          expect(clipping.clipProbe).toMatchObject({
            withinViewport: true,
            hitPresent: true,
            childExtends: true,
            childCoversY: true,
            clipped: true,
          });
          expect(clipping.overflowX).toBe('hidden');
          expect(clipping.overflowY).toBe('auto');
          await page.evaluate(() => (window as any).scrollFixture.side('bottom'));
          await expect.poll(async () => (await sample()).acceptedSide).toBe('bottom');
          await expect
            .poll(async () => ({
              width: Math.round((await sample()).surfaceRect.width),
              height: Math.round((await sample()).surfaceRect.height),
            }))
            .toEqual({ width: 800, height: bottomHeight });
          samples.push({ stage: `${stage}-restored-bottom`, ...(await sample()) });
        };
        await assertHorizontalClip('left-clipping', 320, 200);
        expect(initial.overflowX).toBe('hidden');
        expect(initial.overflowY).toBe('auto');
        const outcome = await page.evaluate(() => (window as any).scrollFixture.request(0.5));
        expect(outcome.kind).toBe('dispatched');
        await expect.poll(async () => (await sample()).scrollTop).toBeGreaterThan(100);
        const requested = await sample();
        samples.push({ stage: 'semantic-request', ...requested });
        expect(requested.surfaceRect.y).toBeCloseTo(initial.surfaceRect.y, 1);
        expect(requested.firstRect.y).toBeLessThan(initial.firstRect.y);
        expect(requested.background).toBe(initial.background);
        expect(requested.border).toBe(initial.border);
        if (scope === 'shadow') expect(requested.hostScrollTop).toBe(0);
        await page.mouse.move(requested.surfaceRect.x + 20, requested.surfaceRect.y + 20);
        await page.mouse.wheel(0, 120);
        await expect
          .poll(async () => (await sample()).scrollTop)
          .toBeGreaterThan(requested.scrollTop);
        samples.push({ stage: 'wheel', ...(await sample()) });
        await page.locator('#drawer-scroll-start').focus();
        await expect.poll(async () => (await sample()).scrollTop).toBeLessThan(30);
        await page.keyboard.press('PageDown');
        await expect.poll(async () => (await sample()).scrollTop).toBeGreaterThan(30);
        samples.push({ stage: 'keyboard-scroll', ...(await sample()) });
        await page.locator('#drawer-scroll-start').focus();
        await page.keyboard.press('Tab');
        await expect
          .poll(async () =>
            page
              .locator('#drawer-scroll-end')
              .evaluate((el) => el === el.ownerDocument.activeElement)
          )
          .toBe(true);
        const focused = await sample();
        samples.push({ stage: 'focus-reveal', ...focused });
        expect(focused.lastRect.bottom).toBeLessThanOrEqual(focused.surfaceRect.bottom + 1);
        expect(focused.lastRect.top).toBeGreaterThanOrEqual(focused.surfaceRect.top - 1);
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '20px';
        });
        await expect.poll(async () => (await sample()).surfaceRect.height).toBeGreaterThan(240);
        const resized = await sample();
        samples.push({ stage: 'root-text-resize', ...resized });
        expect(resized.surfaceRect.height).toBeLessThanOrEqual(251);
        await assertHorizontalClip('left-clipping-resized', 400, 250);
        expect(errors).toEqual([]);
        await page.screenshot({
          path: path.join(output, `drawer-${scope}-scroll.png`),
          fullPage: true,
        });
      } finally {
        await writeFile(
          path.join(output, `drawer-${scope}-scroll-trace.json`),
          JSON.stringify({ scope, samples, errors }, null, 2)
        );
        await page.close();
      }
    },
    20000
  );
});

// Diagnostic replay of the actual public nested demo. Its explicit-height pair is
// a control, not a replacement for the intrinsic public page or a production fix.
describe('public www Drawer cold-entry diagnostic', () => {
  it.each([false, true])(
    'animates the public cold entry with measured intrinsic geometry (fixed control=%s)',
    async (fixedControl) => {
      const { buildPublicDrawerEntryProbe, buildPublicDrawerBoxCss } =
        await import('./fixtures/drawer-entry-build');
      const { readdir } = await import('node:fs/promises');
      const files: string[] = [];
      for (const family of ['base', 'shadcn']) {
        const directory = `packages/prototypes/${family}/src/drawer`;
        for (const file of await readdir(directory))
          if (file.endsWith('.ts')) files.push(`${directory}/${file}`);
      }
      const demoPath = '../../../../apps/www/src/content/docs/demo-shadcn-drawer.demo';
      const demo = (await import(demoPath)).default;
      const boxTokens = new Set<string>();
      const walk = (node: any) => {
        for (const token of (node.className ?? '').split(/\s+/)) if (token) boxTokens.add(token);
        for (const child of node.children ?? []) if (typeof child === 'object') walk(child);
      };
      walk(demo.root);
      const sourceTokens = (await collectProtoStyleTokensFromFiles(files)).filter(
        (token): token is string => typeof token === 'string'
      );
      const css = `${await buildPublicDrawerBoxCss([...boxTokens])}\n${renderProtoStyleTokenCss(sourceTokens)}`;
      const diagnosticScript = await buildPublicDrawerEntryProbe();
      const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(String(error)));
      let result: unknown;
      try {
        await page.route('**/*', (route) => route.abort());
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.setContent('<style>html{font-size:16px}body{margin:0;background:white}</style>');
        await page.addStyleTag({ content: css });
        await page.addScriptTag({ content: diagnosticScript });
        await page.evaluate(async (fixed) => {
          (window as any).publicEntry = await (
            window as any
          ).PublicDrawerEntry.createPublicDrawerEntryFixture(fixed);
        }, fixedControl);
        // Let initial closed admission finish, exactly as a human clicks a ready demo.
        await page.locator('wc-shadcn-drawer-trigger').waitFor({ state: 'visible' });
        await page.evaluate(() => {
          const samples: unknown[] = [];
          (window as any).__entryFrames = samples;
          const sample = () => {
            const content = document.querySelector('wc-shadcn-drawer-content') as HTMLElement & {
              getExposes?: () => any;
            };
            const mask = document.querySelector('wc-shadcn-drawer-mask') as HTMLElement;
            samples.push({
              time: performance.now(),
              phase: content?.getExposes?.().transitionState.get(),
              rect: content?.getBoundingClientRect().toJSON(),
              translate: content?.style.translate,
              maskOpacity: mask ? getComputedStyle(mask).opacity : null,
            });
          };
          (window as any).__entryRequestedAt = performance.now();
          const end = performance.now() + 750;
          (window as any).__entryDone = new Promise<void>((resolve) => {
            const frame = () => {
              sample();
              if (performance.now() < end) requestAnimationFrame(frame);
              else resolve();
            };
            requestAnimationFrame(frame);
          });
          (window as any).publicEntry.open();
        });
        await page.evaluate(() => (window as any).__entryDone);
        result = await page.evaluate(() => ({
          requestedAt: (window as any).__entryRequestedAt,
          events: (window as any).__drawerEntryProbe,
          frames: (window as any).__entryFrames,
        }));
        expect(errors).toEqual([]);
        const events = (result as any).events as any[];
        expect(
          events.some(
            (event) =>
              event.channel === 'content' &&
              event.phase === 'entering' &&
              event.kind === 'environment'
          )
        ).toBe(true);
        expect(
          events.some(
            (event) =>
              event.channel === 'content' && event.phase === 'entering' && event.kind === 'complete'
          )
        ).toBe(true);
        const completion = events.find(
          (event) =>
            event.channel === 'content' && event.phase === 'entering' && event.kind === 'complete'
        );
        expect(completion.detail.outcome).toBe('finished');
        const moving = (result as any).frames.filter(
          (frame: any) => frame.phase === 'entering' && frame.rect.height > 0
        );
        expect(moving.length).toBeGreaterThan(1);
        expect(
          Math.max(...moving.map((frame: any) => frame.rect.y)) -
            Math.min(...moving.map((frame: any) => frame.rect.y))
        ).toBeGreaterThan(1);
        expect((result as any).frames.at(-1).phase).toBe('entered');
        await page.screenshot({
          path: path.join(
            output,
            `drawer-public-${fixedControl ? 'fixed-control' : 'intrinsic'}-settled.png`
          ),
        });
      } finally {
        // Failure-safe extraction preserves setup and partial first-attempt records.
        if (!result)
          result = await page
            .evaluate(() => ({
              events: (window as any).__drawerEntryProbe,
              frames: (window as any).__entryFrames,
            }))
            .catch(() => null);
        await writeFile(
          path.join(
            output,
            `drawer-public-${fixedControl ? 'fixed-control' : 'intrinsic'}-diagnostic.json`
          ),
          JSON.stringify(
            {
              fixedControl,
              diagnosticOnly: false,
              intrinsicMotionAssertion: true,
              observationMayForceLayout: true,
              errors,
              result,
            },
            null,
            2
          )
        );
        await page.evaluate(() => (window as any).publicEntry?.dispose()).catch(() => {});
        await page.close();
      }
    },
    30000
  );
});
