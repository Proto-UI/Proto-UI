import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  applyColorScheme,
  COLOR_SCHEMES,
  launchBrowser,
  RUNTIMES,
  selectRuntime,
  startServer,
  stopServer,
} from '../../src/content/docs/zh-cn/browser-harness';

// The same driver runs against both source trees. It records actual components;
// it never injects styles, synthetic content, or an expected animation phase.
const output = process.env.PROTO_UI_SPINNER_EVIDENCE_DIR;
assert(output, 'PROTO_UI_SPINNER_EVIDENCE_DIR is required');
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const driverSha256 = createHash('sha256')
  .update(await readFile(new URL(import.meta.url)))
  .digest('hex');
const route = '/en/ui-libraries/brutalist/components/spinner/';
const selector = '[data-projection-content] [data-pui-root][data-demo-ref^="spinner-"]';
await mkdir(output, { recursive: true });
const browser = await launchBrowser();
const records: unknown[] = [];
try {
  const baseUrl = await startServer(route);
  for (const [name, viewport] of Object.entries({
    desktop: { width: 960, height: 720 },
    mobile: { width: 320, height: 844 },
  })) {
    const context = await browser.newContext({
      viewport,
      reducedMotion: 'no-preference',
      ...(name === 'desktop' ? { recordVideo: { dir: output, size: viewport } } : {}),
    });
    try {
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
      const previewer = page.locator('[data-previewer-id]').first();
      for (const runtime of RUNTIMES) {
        await selectRuntime(page, previewer, runtime, selector, 5);
        for (const theme of COLOR_SCHEMES) {
          await applyColorScheme(page, theme);
          for (const motion of ['no-preference', 'reduce'] as const) {
            await page.emulateMedia({ reducedMotion: motion });
            await previewer.scrollIntoViewIfNeeded();
            const surfaces = await previewer.locator(selector).evaluateAll((elements) =>
              elements.map((element) => {
                const css = getComputedStyle(element);
                const backgroundColors: string[] = [];
                let supportedPaint = true;
                for (let node: Element | null = element; node; node = node.parentElement) {
                  const ancestor = getComputedStyle(node);
                  backgroundColors.push(ancestor.backgroundColor);
                  supportedPaint &&=
                    ancestor.backgroundImage === 'none' &&
                    ancestor.opacity === '1' &&
                    ancestor.filter === 'none' &&
                    ancestor.backdropFilter === 'none' &&
                    ancestor.mixBlendMode === 'normal';
                }
                // Use Chromium's own CSS Color parser and source-over painter.
                // This detached color probe never changes the component's DOM,
                // styling, animation, or screenshot. Unsupported paint stays null.
                // Prove opacity before 8-bit canvas readback: alpha=.999 can
                // round to 255. A known opaque ancestor makes source-over's
                // final background opaque; unknown computed syntax stays false.
                const opaquePaint = [css.color, ...backgroundColors].map((color) => {
                  const match = /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(([^()]*)\)$/.exec(
                    color.trim()
                  );
                  if (!match) return false;
                  const body = match[1]!;
                  const alpha = body.includes('/')
                    ? body.split('/')[1]!.trim()
                    : body.split(',').length === 4
                      ? body.split(',')[3]!.trim()
                      : null;
                  return alpha === null || /^(?:1(?:\.0+)?|100(?:\.0+)?%)$/.test(alpha);
                });
                const opaqueForeground = opaquePaint[0] === true;
                const opaqueBackground = opaquePaint.slice(1).some(Boolean);
                const canvas = new OffscreenCanvas(1, 1);
                const painter = canvas.getContext('2d', { colorSpace: 'srgb' });
                let foregroundRgba: number[] | null = null;
                let backgroundRgba: number[] | null = null;
                if (
                  painter &&
                  supportedPaint &&
                  CSS.supports('color', css.color) &&
                  backgroundColors.every((color) => CSS.supports('color', color))
                ) {
                  for (const color of [...backgroundColors].reverse()) {
                    painter.fillStyle = color;
                    painter.fillRect(0, 0, 1, 1);
                  }
                  backgroundRgba = Array.from(painter.getImageData(0, 0, 1, 1).data);
                  painter.clearRect(0, 0, 1, 1);
                  painter.fillStyle = css.color;
                  painter.fillRect(0, 0, 1, 1);
                  foregroundRgba = Array.from(painter.getImageData(0, 0, 1, 1).data);
                }
                return {
                  ref: element.getAttribute('data-demo-ref'),
                  width: css.width,
                  height: css.height,
                  radius: css.borderTopLeftRadius,
                  borderWidth: css.borderRightWidth,
                  color: css.color,
                  borderColor: css.borderRightColor,
                  gapColor: css.borderTopColor,
                  animationName: css.animationName,
                  animationDuration: css.animationDuration,
                  animationTimingFunction: css.animationTimingFunction,
                  animationIterationCount: css.animationIterationCount,
                  animationPlayState: css.animationPlayState,
                  backgroundColors,
                  opaqueForeground,
                  opaqueBackground,
                  colorProbe: 'native-offscreen-canvas-srgb',
                  foregroundRgba,
                  backgroundRgba,
                  supportedPaint,
                  ariaHidden: element.getAttribute('aria-hidden'),
                  role: element.getAttribute('role'),
                };
              })
            );
            // Color math stays in Node: tsx's keepNames helpers must never be
            // captured inside a function that Playwright serializes to the page.
            const luminance = (channels: number[]) =>
              channels
                .map((channel) => channel / 255)
                .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
                .reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i]!, 0);
            const facts = surfaces.map((surface) => {
              const fg =
                surface.opaqueForeground && surface.foregroundRgba?.[3] === 255
                  ? luminance(surface.foregroundRgba.slice(0, 3))
                  : null;
              const bg =
                surface.opaqueBackground && surface.backgroundRgba?.[3] === 255
                  ? luminance(surface.backgroundRgba.slice(0, 3))
                  : null;
              const contrast =
                fg !== null && bg !== null
                  ? (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05)
                  : null;
              return { ...surface, contrast };
            });
            // Observe all five real roots through a complete natural turn.
            // This never pauses/seeks animation or injects an expected position.
            const frames = await previewer.locator(selector).evaluateAll(
              async (elements, duration) => {
                const samples: Array<{
                  time: number;
                  roots: Array<{
                    transform: string;
                    angle: number;
                    centerX: number;
                    centerY: number;
                    originX: number;
                    originY: number;
                    width: number;
                    height: number;
                    parentCenterY: number;
                    parentAlignItems: string;
                  }>;
                }> = [];
                let started = 0;
                do {
                  const time = await new Promise<number>((resolve) =>
                    requestAnimationFrame(resolve)
                  );
                  if (!samples.length) started = time;
                  samples.push({
                    time,
                    roots: elements.map((element) => {
                      const style = getComputedStyle(element);
                      const rect = element.getBoundingClientRect();
                      const parent =
                        element.closest(
                          '[data-demo-ref="saving-button"], [data-demo-ref="busy-region"]'
                        ) ?? element.parentElement!;
                      const parentRect = parent.getBoundingClientRect();
                      const origin = style.transformOrigin.split(' ').map(Number.parseFloat);
                      const matrix =
                        style.transform === 'none' ? null : new DOMMatrixReadOnly(style.transform);
                      return {
                        transform: style.transform,
                        angle: matrix
                          ? ((Math.atan2(matrix.b, matrix.a) * 180) / Math.PI + 360) % 360
                          : 0,
                        centerX: (rect.left + rect.right) / 2,
                        centerY: (rect.top + rect.bottom) / 2,
                        originX: origin[0]!,
                        originY: origin[1]!,
                        width: (element as HTMLElement).offsetWidth,
                        height: (element as HTMLElement).offsetHeight,
                        parentCenterY: (parentRect.top + parentRect.bottom) / 2,
                        parentAlignItems: getComputedStyle(parent).alignItems,
                      };
                    }),
                  });
                } while (samples.at(-1)!.time - started < duration);
                return samples;
              },
              motion === 'reduce' ? 200 : 1100
            );
            const file = `${name}-${runtime}-${theme}-${motion}.png`;
            await previewer.screenshot({ path: path.join(output, file), animations: 'allow' });
            const overflow = await page.evaluate(
              () => document.documentElement.scrollWidth > document.documentElement.clientWidth
            );
            records.push({
              sourceSha,
              route,
              viewport,
              runtime,
              theme,
              motion,
              file,
              facts,
              frames,
              overflow,
              errors: [...errors],
            });
            assert.equal(facts.length, 5);
            for (const fact of facts) {
              assert.equal(fact.borderColor, fact.color);
              assert.equal(fact.gapColor, 'rgba(0, 0, 0, 0)');
              assert.equal(fact.borderWidth, '2px');
              assert.equal(fact.ariaHidden, 'true');
              assert.equal(fact.role, null);
              assert(fact.contrast !== null && fact.contrast >= 3, JSON.stringify(fact));
              assert.equal(fact.animationName, motion === 'reduce' ? 'none' : 'pui-spin');
              if (motion !== 'reduce') {
                assert.equal(fact.animationDuration, '1s');
                assert.equal(fact.animationTimingFunction, 'linear');
                assert.equal(fact.animationIterationCount, 'infinite');
                assert.equal(fact.animationPlayState, 'running');
              }
            }
            assert(frames.at(-1)!.time - frames[0]!.time >= (motion === 'reduce' ? 200 : 1000));
            for (let index = 0; index < 5; index++) {
              const initial = frames[0]!.roots[index]!;
              const transforms = new Set(frames.map((frame) => frame.roots[index]!.transform));
              assert(motion === 'reduce' ? transforms.size === 1 : transforms.size > 1);
              if (motion !== 'reduce') {
                const quadrants = new Set(
                  frames.map((frame) => Math.floor(frame.roots[index]!.angle / 90))
                );
                assert.equal(quadrants.size, 4, 'a whole rotation must sample every quadrant');
                let angularTravel = 0;
                for (let frame = 1; frame < frames.length; frame++) {
                  const previous = frames[frame - 1]!;
                  const current = frames[frame]!;
                  assert(current.time - previous.time < 500, 'a half-turn sample gap is unproven');
                  const delta =
                    (current.roots[index]!.angle - previous.roots[index]!.angle + 360) % 360;
                  assert(delta < 180, 'ambiguous angular sample');
                  angularTravel += delta;
                }
                assert(angularTravel >= 360, 'every Root must actually complete a whole turn');
              }
              for (const frame of frames) {
                const root = frame.roots[index]!;
                assert.equal(root.width, [16, 24, 32, 24, 16][index]);
                assert.equal(root.height, root.width);
                assert(Math.abs(root.originX - root.width / 2) <= 0.25, 'rotation origin x');
                assert(Math.abs(root.originY - root.height / 2) <= 0.25, 'rotation origin y');
                assert(Math.abs(root.centerX - initial.centerX) <= 0.25, 'center x drift');
                assert(Math.abs(root.centerY - initial.centerY) <= 0.25, 'center y drift');
                assert.equal(root.parentAlignItems, 'center');
                assert(
                  Math.abs(root.centerY - root.parentCenterY) <= 0.25,
                  'parent/inline vertical center'
                );
              }
            }
            assert.equal(overflow, false, `${name}/${runtime}/${theme}/${motion} page overflow`);
          }
        }
      }
      assert.deepEqual(errors, [], 'page exceptions');
      const video = page.video();
      await context.close();
      if (video) await video.saveAs(path.join(output, `${name}-motion.webm`));
    } finally {
      await context.close();
    }
  }
} finally {
  await writeFile(
    path.join(output, 'manifest.json'),
    JSON.stringify(
      {
        sourceSha,
        driverSha256,
        capturedAt: new Date().toISOString(),
        browser: browser.version(),
        records,
      },
      null,
      2
    )
  );
  await stopServer();
  await browser.close();
}
assert.equal(records.length, 32, 'both viewports, four runtimes, two themes and two motion modes');
console.log(`Captured ${records.length} Spinner cases at ${sourceSha}`);
