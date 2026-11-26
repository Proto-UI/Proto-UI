// @vitest-environment node
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser } from '../../../../apps/www/src/content/docs/zh-cn/browser-harness';
import { SHADCN_STYLE_TOKENS } from '../../../cli/src/generated/shadcn-style-tokens';
import { SHADCN_THEME_CSS } from '../../../cli/src/legacy/type';
import {
  renderPrefixedThemeCss,
  renderProtoStyleTokenCss,
} from '../../../cli/src/services/proto-style-css';
import { collectProtoStyleTokens } from '../../../cli/src/services/prototype-style-tokens';

const output = path.join(
  process.env.PUI_FINF_FEATURE_EVIDENCE_DIR ?? tmpdir(),
  'pui-toast-stack-native'
);
let browser: Awaited<ReturnType<typeof launchBrowser>>;
let script: string;
let css: string;
let sourceTokens: string[];

type Rect = {
  x: number;
  y: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};
type ToastRow = {
  number: number;
  index: number | null;
  limited: boolean | null;
  open: boolean;
  order: number;
  z: number | null;
  display: string;
  visibility: string;
  opacity: number;
  transitionProperty: string;
  ariaHidden: string | null;
  painted: boolean;
  rect: Rect;
  classes: string;
};
type Snapshot = {
  stage: string;
  scrollY: number;
  expanded: boolean;
  portaled: boolean;
  viewportPosition: string;
  viewport: Rect;
  origin: Rect;
  rows: ToastRow[];
};
type Frame = {
  time: number;
  rows: Pick<ToastRow, 'number' | 'index' | 'z' | 'order'>[];
  zTransitions: number[];
};

beforeAll(async () => {
  await mkdir(output, { recursive: true });
  sourceTokens = await collectProtoStyleTokens('packages/prototypes/shadcn/src/toast');
  // The fixture consumes the shipped CLI preset, never a private token union
  // assembled from source to conceal a missing exported utility.
  css =
    renderPrefixedThemeCss(SHADCN_THEME_CSS) + '\n' + renderProtoStyleTokenCss(SHADCN_STYLE_TOKENS);
  const bundled = await build({
    stdin: {
      contents: `
        export {toastRoot,toastViewport,toastTitle,toastDescription,toastAction} from './packages/prototypes/shadcn/src/toast';
        export {AdaptToWebComponent as adapt} from './packages/adapters/web-component/src/adapt';
        export {setElementProps} from './packages/adapters/web-component/src/props';
      `,
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'ToastConsumer',
    platform: 'browser',
    tsconfig: 'tsconfig.json',
  });
  script = bundled.outputFiles[0]!.text;
  await writeFile(
    path.join(output, 'consumer-closure.json'),
    JSON.stringify(
      {
        node: process.version,
        sourceTokens,
        missingExportedTokens: sourceTokens.filter((token) => !SHADCN_STYLE_TOKENS.includes(token)),
        presetTokenCount: SHADCN_STYLE_TOKENS.length,
        cssSha256: createHash('sha256').update(css).digest('hex'),
        bundleSha256: createHash('sha256').update(script).digest('hex'),
      },
      null,
      2
    )
  );
  browser = await launchBrowser();
}, 30000);

afterAll(async () => browser?.close());

async function settle(page: Awaited<ReturnType<typeof browser.newPage>>) {
  await page.evaluate(async () => {
    const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await frame();
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => {}))
    );
    await frame();
  });
}

function assertChronology(snapshot: Snapshot, newestFirst: number[], visible: number) {
  const rows = newestFirst.map((number) => snapshot.rows.find((row) => row.number === number)!);
  expect
    .soft(
      rows.map((row) => row.index),
      `${snapshot.stage}: full opening index`
    )
    .toEqual(newestFirst.map((_, index) => index));
  expect
    .soft(
      rows.map((row) => row.order),
      `${snapshot.stage}: CSS order`
    )
    .toEqual(newestFirst.map((_, index) => index));
  expect
    .soft(
      rows.map((row) => row.limited),
      `${snapshot.stage}: visibility window`
    )
    .toEqual(newestFirst.map((_, index) => index >= visible));
  expect
    .soft(
      rows.filter((row) => row.painted).map((row) => row.number),
      `${snapshot.stage}: painted roots`
    )
    .toEqual(newestFirst.slice(0, visible));
  expect
    .soft(
      rows.every((row) => Number.isInteger(row.z)),
      `${snapshot.stage}: numeric z-index`
    )
    .toBe(true);
  expect
    .soft(
      rows.slice(1).every((row, index) => row.z! < rows[index]!.z!),
      `${snapshot.stage}: strict newest-first paint order`
    )
    .toBe(true);
  expect
    .soft(
      rows.filter((row) => row.limited).every((row) => row.ariaHidden === 'true'),
      `${snapshot.stage}: overflow excluded from accessibility tree`
    )
    .toBe(true);
}

function assertVerticalOrder(
  snapshot: Snapshot,
  newestFirst: number[],
  position: 'bottom-right' | 'top-right',
  expanded: boolean
) {
  const rows = newestFirst
    .map((number) => snapshot.rows.find((row) => row.number === number)!)
    .filter((row) => row.painted);
  expect.soft(rows.length, `${snapshot.stage}: visible geometry control`).toBeGreaterThanOrEqual(3);
  expect
    .soft(
      rows.slice(1).every((older, index) => {
        const newer = rows[index]!;
        return position === 'bottom-right'
          ? expanded
            ? older.rect.bottom < newer.rect.top
            : older.rect.bottom < newer.rect.bottom
          : expanded
            ? older.rect.top > newer.rect.bottom
            : older.rect.top > newer.rect.top;
      }),
      `${snapshot.stage}: ${position} ${expanded ? 'expanded' : 'collapsed'} physical chronology`
    )
    .toBe(true);
}

describe('Shadcn Toast native stack and document placement', () => {
  it('ships the complete Toast source token closure in the CLI preset', () => {
    expect(sourceTokens.filter((token) => !SHADCN_STYLE_TOKENS.includes(token))).toEqual([]);
  });

  for (const width of [1280, 390]) {
    for (const position of ['bottom-right', 'top-right'] as const) {
      it(`${width}px ${position} preserves twelve creation/opening ranks, visible limits and fixed portal geometry`, async () => {
        const height = width === 390 ? 844 : 900;
        const page = await browser.newPage({ viewport: { width, height } });
        const errors: string[] = [];
        const snapshots: Snapshot[] = [];
        const keyboard: Array<{ activeId: string; toast: number | null }> = [];
        let frames: Frame[] = [];
        page.on('pageerror', (error) => errors.push(String(error)));
        const name = `${width}-${position}`;
        const sample = async (stage: string) => {
          const snapshot = (await page.evaluate(
            (stage) => (window as any).toastFixture.snapshot(stage),
            stage
          )) as Snapshot;
          snapshots.push(snapshot);
          return snapshot;
        };
        try {
          await page.route('**/*', (route) => route.abort());
          await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
          await page.setContent(`<!doctype html><html><head></head><body>
            <main><h1>Toast stack / ${width}px / ${position}</h1>
              <button id="create-toast">Create notification</button>
              <section id="origin"><p>RuntimeBox-like clipped origin</p></section>
              <button id="after-origin">After notifications</button>
            </main><div class="scroll-space"></div>
          </body></html>`);
          await page.addStyleTag({ content: css });
          await page.addStyleTag({
            content: `
            *,*::before,*::after{box-sizing:border-box}
            html{font-size:16px}body{margin:0;background:#f8fafc;color:#172033;font-family:Arial,sans-serif}
            main{padding:20px}h1{font-size:18px}button{padding:8px 12px}
            #create-toast{margin-top:140px}
            #origin{transform:translate(0);overflow:hidden;position:relative;width:240px;height:180px;margin:80px 0 24px;border:2px dashed #94a3b8;background:#eef2ff}
            #origin>p{padding:8px;font-size:12px}.scroll-space{height:1800px}
          `,
          });
          await page.addScriptTag({ content: script });
          await page.evaluate(
            ({ position }) => {
              const consumer = (window as any).ToastConsumer;
              const Viewport = consumer.adapt(consumer.toastViewport);
              const Root = consumer.adapt(consumer.toastRoot);
              const Title = consumer.adapt(consumer.toastTitle);
              const Description = consumer.adapt(consumer.toastDescription);
              const Action = consumer.adapt(consumer.toastAction);
              const viewport = new Viewport();
              viewport.id = 'toast-viewport';
              const origin = document.querySelector('#origin')!;
              const viewportProps: Record<string, unknown> = {
                styleProfile: 'new-york-v4',
                duration: 0,
                // Omission is deliberate: the bottom case verifies the default.
                ...(position === 'top-right' ? { position } : {}),
              };
              consumer.setElementProps(viewport, viewportProps);
              origin.append(viewport);
              const roots: any[] = [];
              const rootProps: Record<string, unknown>[] = [];
              const nativeClicks: boolean[] = [];
              const frames: any[] = [];
              const rect = (element: Element) => {
                const r = element.getBoundingClientRect();
                return {
                  x: r.x,
                  y: r.y,
                  top: r.top,
                  right: r.right,
                  bottom: r.bottom,
                  width: r.width,
                  height: r.height,
                };
              };
              const rows = () =>
                roots.map((root, i) => {
                  const style = getComputedStyle(root),
                    exposes = root.getExposes(),
                    box = rect(root);
                  return {
                    number: i + 1,
                    index: exposes.stackIndex?.get() ?? null,
                    limited: exposes.limited?.get() ?? null,
                    open: exposes.open.get(),
                    order: Number(style.order),
                    z: style.zIndex === 'auto' ? null : Number(style.zIndex),
                    display: style.display,
                    visibility: style.visibility,
                    opacity: Number(style.opacity),
                    transitionProperty: style.transitionProperty,
                    ariaHidden: root.getAttribute('aria-hidden'),
                    painted:
                      style.display !== 'none' &&
                      style.visibility !== 'hidden' &&
                      Number(style.opacity) > 0 &&
                      box.width > 0 &&
                      box.height > 0,
                    rect: box,
                    classes: root.className,
                  };
                });
              let recording = true;
              const record = (time: number) => {
                if (!recording) return;
                frames.push({
                  time,
                  rows: rows().map(({ number, index, z, order }) => ({ number, index, z, order })),
                  zTransitions: roots.flatMap((root, i) =>
                    root
                      .getAnimations()
                      .some((animation: any) => animation.transitionProperty === 'z-index')
                      ? [i + 1]
                      : []
                  ),
                });
                requestAnimationFrame(record);
              };
              requestAnimationFrame(record);
              document.querySelector('#create-toast')!.addEventListener('click', (event) => {
                nativeClicks.push(event.isTrusted);
                const number = roots.length + 1;
                const root = new Root(),
                  title = new Title(),
                  description = new Description(),
                  action = new Action();
                root.id = `toast-${number}`;
                root.dataset.toastNumber = String(number);
                title.textContent = `Notification ${number}`;
                description.textContent = `Saved change ${number}.`;
                action.textContent = 'Review';
                action.id = `toast-action-${number}`;
                consumer.setElementProps(action, { keepOpen: true });
                const props = { defaultOpen: true, duration: 0, styleProfile: 'new-york-v4' };
                consumer.setElementProps(root, props);
                root.append(title, description, action);
                roots.push(root);
                rootProps.push(props);
                viewport.append(root);
              });
              (window as any).toastFixture = {
                viewport,
                roots,
                rootProps,
                viewportProps,
                nativeClicks,
                stopFrames() {
                  recording = false;
                  return frames;
                },
                snapshot(stage: string) {
                  return {
                    stage,
                    scrollY: window.scrollY,
                    expanded: viewport.getExposes().expanded.get(),
                    portaled: viewport.isConnected && !origin.contains(viewport),
                    viewportPosition: getComputedStyle(viewport).position,
                    viewport: rect(viewport),
                    origin: rect(origin),
                    rows: rows(),
                  };
                },
                updateOldProps() {
                  rootProps[0] = { ...rootProps[0], type: 'info', dismissible: false };
                  consumer.setElementProps(roots[0], rootProps[0]);
                },
                setVisible(count: number) {
                  viewportProps.visibleToasts = count;
                  consumer.setElementProps(viewport, viewportProps);
                },
              };
            },
            { position }
          );
          await settle(page);
          const button = await page.locator('#create-toast').boundingBox();
          expect(button).not.toBeNull();
          for (let i = 0; i < 12; i++) {
            await page.mouse.click(button!.x + button!.width / 2, button!.y + button!.height / 2);
          }
          await settle(page);
          frames = await page.evaluate(() => (window as any).toastFixture.stopFrames());
          const newestFirst = Array.from({ length: 12 }, (_, index) => 12 - index);
          const collapsed = await sample('collapsed-12');
          await page.screenshot({ path: path.join(output, `${name}-collapsed-12.png`) });
          expect
            .soft(await page.evaluate(() => (window as any).toastFixture.nativeClicks))
            .toEqual(Array(12).fill(true));
          expect.soft(collapsed.rows).toHaveLength(12);
          expect
            .soft(collapsed.portaled, 'viewport escapes the transformed clipped author origin')
            .toBe(true);
          expect.soft(collapsed.viewportPosition).toBe('fixed');
          expect.soft(collapsed.viewport.right).toBeCloseTo(width - 24, 0);
          expect
            .soft(position === 'bottom-right' ? collapsed.viewport.bottom : collapsed.viewport.top)
            .toBeCloseTo(position === 'bottom-right' ? height - 24 : 24, 0);
          expect.soft(collapsed.viewport.width).toBeLessThanOrEqual(width - 32);
          expect.soft(collapsed.viewport.x).toBeGreaterThanOrEqual(0);
          assertChronology(collapsed, newestFirst, 3);
          assertVerticalOrder(collapsed, newestFirst, position, false);

          const frontZ = collapsed.rows.find((row) => row.number === 12)!.z;
          const badFrames = frames.filter(
            (frame) =>
              frame.rows.length &&
              (frame.zTransitions.length > 0 ||
                frame.rows.some(
                  (row) =>
                    row.index !== frame.rows.length - row.number ||
                    row.z !== frontZ! - (frame.rows.length - row.number)
                ))
          );
          expect
            .soft(
              frames.some((frame) => frame.rows.length > 1 && frame.rows.length < 12),
              'RAF samples cover the creation burst'
            )
            .toBe(true);
          expect
            .soft(
              badFrames.slice(0, 8),
              'every animation frame retains the immediate integer paint rank'
            )
            .toEqual([]);
          expect
            .soft(
              collapsed.rows.every(
                (row) =>
                  !row.transitionProperty
                    .split(',')
                    .some((property) => ['all', 'z-index'].includes(property.trim()))
              ),
              'z-index is not an interpolated transition property'
            )
            .toBe(true);

          await page.evaluate(() => (window as any).toastFixture.updateOldProps());
          await settle(page);
          assertChronology(await sample('old-props-update'), newestFirst, 3);

          await page.mouse.move(4, 4);
          await page.mouse.wheel(0, 540);
          await page.waitForFunction(() => window.scrollY > 100);
          await settle(page);
          const scrolled = await sample('scrolled');
          expect.soft(scrolled.scrollY).toBeGreaterThan(100);
          expect.soft(scrolled.viewport.x).toBeCloseTo(collapsed.viewport.x, 1);
          expect.soft(scrolled.viewport.y).toBeCloseTo(collapsed.viewport.y, 1);
          expect.soft(scrolled.origin.y).toBeLessThan(collapsed.origin.y - 100);

          // Establish the native tab sequence at an authored control, then use
          // real keyboard input; no custom focus handler supplies the result.
          await page.locator('#create-toast').focus();
          for (let i = 0; i < 18; i++) {
            await page.keyboard.press('Tab');
            keyboard.push(
              await page.evaluate(() => {
                const active = document.activeElement as HTMLElement | null;
                const root = active?.closest('[data-toast-number]') as HTMLElement | null;
                return {
                  activeId: active?.id ?? '',
                  toast: root ? Number(root.dataset.toastNumber) : null,
                };
              })
            );
          }
          const focusedToasts = [
            ...new Set(
              keyboard.map((step) => step.toast).filter((value): value is number => value !== null)
            ),
          ].sort((a, b) => a - b);
          expect
            .soft(focusedToasts, 'only visible Toast commands participate in native Tab navigation')
            .toEqual([10, 11, 12]);

          await page.evaluate(() => {
            (document.activeElement as HTMLElement)?.blur();
            window.scrollTo(0, 0);
          });
          await settle(page);
          const front = (await sample('before-hover')).rows.find((row) => row.number === 12)!.rect;
          await page.mouse.move(
            Math.max(1, Math.min(width - 1, front.x + front.width / 2)),
            Math.max(1, Math.min(height - 1, front.y + front.height / 2))
          );
          await settle(page);
          const expanded = await sample('expanded-hover');
          await page.screenshot({ path: path.join(output, `${name}-expanded.png`) });
          expect.soft(expanded.expanded, 'native pointer hover expands the viewport').toBe(true);
          assertChronology(expanded, newestFirst, 3);
          assertVerticalOrder(expanded, newestFirst, position, true);

          await page.evaluate(() => (window as any).toastFixture.setVisible(5));
          await settle(page);
          const five = await sample('visible-five');
          assertChronology(five, newestFirst, 5);
          assertVerticalOrder(five, newestFirst, position, true);

          await page.evaluate(() =>
            (window as any).toastFixture.roots[0].getExposes().close('programmatic')
          );
          await settle(page);
          await page.evaluate(() => (window as any).toastFixture.roots[0].getExposes().openToast());
          await settle(page);
          const reopenedOrder = [1, ...newestFirst.filter((number) => number !== 1)];
          const reopened = await sample('old-root-reopened');
          assertChronology(reopened, reopenedOrder, 5);
          assertVerticalOrder(reopened, reopenedOrder, position, true);
          await page.screenshot({ path: path.join(output, `${name}-reopened-five.png`) });
          expect.soft(errors).toEqual([]);
        } finally {
          await writeFile(
            path.join(output, `${name}-samples.json`),
            JSON.stringify(
              {
                browserVersion: browser.version(),
                chromiumSandbox: true,
                viewport: { width, height },
                position,
                snapshots,
                frames,
                keyboard,
                errors,
              },
              null,
              2
            )
          );
          await page.close();
        }
      }, 30000);
    }
  }
});

type ClosingRow = {
  number: number;
  open: boolean;
  present: boolean;
  phase: string;
  z: number;
  display: string;
  top: number;
  bottom: number;
  width: number;
  centerHit: string | null;
};

describe('Shadcn Toast nonzero leave presence', () => {
  for (const position of ['bottom-right', 'top-right'] as const) {
    for (const expand of [false, true]) {
      it(
        position +
          ' ' +
          (expand ? 'expanded' : 'collapsed') +
          ' keeps the next notification at its anchor while its predecessor leaves',
        async () => {
          const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
          const name = 'closing-' + position + '-' + (expand ? 'expanded' : 'collapsed');
          const errors: string[] = [];
          page.on('pageerror', (error) => errors.push(String(error)));
          let observation: {
            before: ClosingRow[];
            frames: Array<{ time: number; rows: ClosingRow[] }>;
          } | null = null;
          try {
            await page.route('**/*', (route) => route.abort());
            await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
            await page.setContent('<!doctype html><h1>Close, then immediately create</h1>');
            await page.addStyleTag({ content: css });
            await page.addStyleTag({
              content: '*{box-sizing:border-box}body{margin:0;font:16px Arial,sans-serif}',
            });
            await page.addScriptTag({ content: script });
            await page.evaluate(
              ({ position, expand }) => {
                const consumer = (window as any).ToastConsumer;
                const Viewport = consumer.adapt(consumer.toastViewport);
                const Root = consumer.adapt(consumer.toastRoot);
                const Title = consumer.adapt(consumer.toastTitle);
                const viewport = new Viewport();
                consumer.setElementProps(viewport, {
                  position,
                  expand,
                  visibleToasts: 3,
                  duration: 0,
                  styleProfile: 'new-york-v4',
                });
                document.body.append(viewport);
                const roots: any[] = [];
                const add = () => {
                  const number = roots.length + 1;
                  const root = new Root(),
                    title = new Title();
                  root.id = 'closing-toast-' + number;
                  title.textContent = 'Notification ' + number;
                  consumer.setElementProps(root, {
                    defaultOpen: true,
                    duration: 0,
                    leaveDuration: 500,
                    styleProfile: 'new-york-v4',
                  });
                  root.append(title);
                  roots.push(root);
                  viewport.append(root);
                };
                const read = () =>
                  roots.map((root, index) => {
                    const style = getComputedStyle(root),
                      exposed = root.getExposes();
                    const rect = root.getBoundingClientRect();
                    const hit = document.elementFromPoint(
                      rect.x + rect.width / 2,
                      rect.y + rect.height / 2
                    );
                    return {
                      number: index + 1,
                      open: exposed.open.get(),
                      present: exposed.isPresent.get(),
                      phase: exposed.transitionState.get(),
                      z: Number(style.zIndex),
                      display: style.display,
                      top: rect.top,
                      bottom: rect.bottom,
                      width: rect.width,
                      centerHit: hit?.closest('shadcn-toast-root')?.id ?? null,
                    };
                  });
                for (let i = 0; i < 3; i++) add();
                const fixture = {
                  before: [] as ReturnType<typeof read>,
                  frames: [] as Array<{ time: number; rows: ReturnType<typeof read> }>,
                  done: false,
                  begin() {
                    this.before = read();
                    const start = performance.now();
                    // Both operations use public consumer APIs. No state, geometry,
                    // CSS rank or transition phase is injected by the fixture.
                    roots[2].getExposes().close('programmatic');
                    add();
                    const record = (time: number) => {
                      const rows = read();
                      this.frames.push({ time: time - start, rows });
                      if (rows[2]!.present) requestAnimationFrame(record);
                      else this.done = true;
                    };
                    requestAnimationFrame(record);
                  },
                };
                (window as any).closingFixture = fixture;
              },
              { position, expand }
            );
            await settle(page);
            await page.evaluate(() => (window as any).closingFixture.begin());
            await page.waitForFunction(() => (window as any).closingFixture.frames.length >= 3);
            await page.screenshot({ path: path.join(output, name + '.png') });
            await page.waitForFunction(() => (window as any).closingFixture.done, undefined, {
              timeout: 5000,
            });
            observation = await page.evaluate(() => {
              const fixture = (window as any).closingFixture;
              return { before: fixture.before, frames: fixture.frames };
            });
            expect(observation!.before).toHaveLength(3);
            const frames = observation!.frames;
            const leaving = frames.filter((frame) => frame.rows[2]!.present);
            expect(
              leaving.some((frame) => frame.time >= 300),
              'the configured leave presence survives'
            ).toBe(true);
            expect(
              leaving.every(
                (frame) =>
                  frame.rows[2]!.phase === 'leaving' &&
                  frame.rows[2]!.display !== 'none' &&
                  frame.rows[2]!.width > 0
              )
            ).toBe(true);
            const misplaced = frames.filter((frame) => {
              const newest = frame.rows[3]!;
              const edge = position === 'bottom-right' ? newest.bottom : newest.top;
              const expectedEdge = position === 'bottom-right' ? 876 : 24;
              const predecessor = frame.rows[2]!;
              return (
                Math.abs(edge - expectedEdge) > 0.25 ||
                newest.centerHit !== 'closing-toast-4' ||
                frame.rows.some((row) => row.open && row.number !== 4 && row.z >= newest.z) ||
                (predecessor.present && predecessor.z >= newest.z)
              );
            });
            expect(
              misplaced.slice(0, 8),
              'every frame keeps the newest open Toast at the document edge and above the leaving predecessor'
            ).toEqual([]);
            expect(frames.at(-1)!.rows[2]!.phase).toBe('closed');
            expect(frames.at(-1)!.rows[3]!.open).toBe(true);
            expect(errors).toEqual([]);
          } finally {
            await writeFile(
              path.join(output, name + '.json'),
              JSON.stringify(
                {
                  browserVersion: browser.version(),
                  chromiumSandbox: true,
                  position,
                  expand,
                  leaveDuration: 500,
                  observation,
                  errors,
                },
                null,
                2
              )
            );
            await page.close();
          }
        },
        10000
      );
    }
  }
});

describe('Shadcn Toast hover stability across peeking edges and inter-card gaps', () => {
  for (const position of ['bottom-right', 'top-right'] as const) {
    it(`T-TOAST-STACK-0001-CASE-HOVER-STABILITY (${position}): stays expanded without oscillation across peeking edge and gap coordinates`, async () => {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(String(error)));
      try {
        await page.route('**/*', (route) => route.abort());
        await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
        await page.setContent('<!doctype html><h1>Toast hover stability</h1>');
        await page.addStyleTag({ content: css });
        await page.addStyleTag({
          content: '*{box-sizing:border-box}body{margin:0;font:16px Arial,sans-serif}',
        });
        await page.addScriptTag({ content: script });
        await page.evaluate(
          ({ position }) => {
            const consumer = (window as any).ToastConsumer;
            const Viewport = consumer.adapt(consumer.toastViewport);
            const Root = consumer.adapt(consumer.toastRoot);
            const Title = consumer.adapt(consumer.toastTitle);
            const Description = consumer.adapt(consumer.toastDescription);
            const viewport = new Viewport();
            consumer.setElementProps(viewport, {
              position,
              visibleToasts: 3,
              duration: 0,
              styleProfile: 'new-york-v4',
            });
            document.body.append(viewport);
            const roots: any[] = [];
            for (let i = 1; i <= 3; i++) {
              const root = new Root();
              const title = new Title();
              const desc = new Description();
              title.textContent = `Toast ${i}`;
              desc.textContent = `Body for notification ${i}`;
              consumer.setElementProps(root, {
                defaultOpen: true,
                duration: 0,
                styleProfile: 'new-york-v4',
              });
              root.append(title, desc);
              roots.push(root);
              viewport.append(root);
            }
            (window as any).hoverFixture = { viewport, roots };
          },
          { position }
        );
        await settle(page);

        // Locate the exact peeking strip of the second-newest toast (stackIndex=1):
        // in collapsed mode it peeks out above (bottom-right) or below (top-right)
        // the newest card, at the exact y-band that becomes the 14px gap-3.5 once expanded.
        const probePoint = await page.evaluate((position) => {
          const { viewport, roots } = (window as any).hoverFixture;
          const newest = roots[2].getBoundingClientRect();
          const second = roots[1].getBoundingClientRect();
          const x = second.x + second.width / 2;
          const y =
            position === 'bottom-right'
              ? (second.top + newest.top) / 2
              : (newest.bottom + second.bottom) / 2;
          return {
            x,
            y,
            initialPointerEvents: getComputedStyle(viewport).pointerEvents,
            initialExpanded: viewport.getExposes().expanded.get(),
          };
        }, position);

        expect(probePoint.initialExpanded).toBe(false);
        expect(probePoint.initialPointerEvents).toBe('none');

        await page.mouse.move(probePoint.x, probePoint.y);

        // Observe 24 animation frames while pointer remains stationary on the peeking/gap coordinate.
        const hoverSample = await page.evaluate(async () => {
          const { viewport, roots } = (window as any).hoverFixture;
          const states: boolean[] = [];
          const pointerEvents: string[] = [];
          const frame = () =>
            new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          await frame();
          for (let i = 0; i < 24; i++) {
            await frame();
            states.push(viewport.getExposes().expanded.get());
            pointerEvents.push(getComputedStyle(viewport).pointerEvents);
          }
          const r0 = roots[2].getBoundingClientRect();
          const r1 = roots[1].getBoundingClientRect();
          const r2 = roots[0].getBoundingClientRect();
          return {
            states,
            pointerEvents,
            gapY: r0.top > r1.bottom ? (r1.bottom + r0.top) / 2 : (r0.bottom + r1.top) / 2,
            gap2Y: r1.top > r2.bottom ? (r2.bottom + r1.top) / 2 : (r1.bottom + r2.top) / 2,
            midX: r1.x + r1.width / 2,
          };
        });

        expect(hoverSample.states.every((v) => v === true)).toBe(true);
        expect(hoverSample.pointerEvents.every((v) => v === 'auto')).toBe(true);

        // Move explicitly into both inter-card gaps and confirm zero collapse/oscillation.
        for (const y of [hoverSample.gapY, hoverSample.gap2Y]) {
          await page.mouse.move(hoverSample.midX, y);
          const gapStates = await page.evaluate(async () => {
            const { viewport } = (window as any).hoverFixture;
            const states: boolean[] = [];
            const frame = () =>
              new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
            for (let i = 0; i < 12; i++) {
              await frame();
              states.push(viewport.getExposes().expanded.get());
            }
            return states;
          });
          expect(gapStates.every((v) => v === true)).toBe(true);
        }

        // Leaving viewport collapses cleanly and restores pointer-events: none.
        await page.mouse.move(10, 10);
        await settle(page);
        const afterLeave = await page.evaluate(() => {
          const { viewport } = (window as any).hoverFixture;
          return {
            expanded: viewport.getExposes().expanded.get(),
            pointerEvents: getComputedStyle(viewport).pointerEvents,
          };
        });
        expect(afterLeave).toEqual({ expanded: false, pointerEvents: 'none' });

        // Re-hover then dismiss all toasts: viewport must reset hasOpen/expanded/pointer-events.
        await page.mouse.move(probePoint.x, probePoint.y);
        await settle(page);
        const afterDismissAll = await page.evaluate(async () => {
          const { viewport } = (window as any).hoverFixture;
          viewport.getExposes().dismissAll('programmatic');
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          return {
            hasOpen: viewport.getExposes().hasOpen.get(),
            expanded: viewport.getExposes().expanded.get(),
            pointerEvents: getComputedStyle(viewport).pointerEvents,
          };
        });
        expect(afterDismissAll).toEqual({
          hasOpen: false,
          expanded: false,
          pointerEvents: 'none',
        });
        expect(errors).toEqual([]);
      } finally {
        await page.close();
      }
    }, 20000);
  }
});
