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
            const facts = await previewer.locator(selector).evaluateAll((elements) =>
              elements.map((element) => {
                const css = getComputedStyle(element);
                const rgb = (color: string) => {
                  const values = color.match(/[\d.]+/g)?.map(Number);
                  if (!values || values.length < 3 || (values[3] ?? 1) !== 1) return null;
                  return values.slice(0, 3);
                };
                let background: number[] | null = null;
                for (let node: Element | null = element; node; node = node.parentElement) {
                  background = rgb(getComputedStyle(node).backgroundColor);
                  if (background) break;
                }
                const foreground = rgb(css.color);
                const luminance = (channels: number[]) =>
                  channels
                    .map((channel) => channel / 255)
                    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
                    .reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i]!, 0);
                const fg = foreground && luminance(foreground);
                const bg = background && luminance(background);
                const contrast =
                  fg !== null && bg !== null
                    ? (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05)
                    : null;
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
                  contrast,
                  ariaHidden: element.getAttribute('aria-hidden'),
                  role: element.getAttribute('role'),
                };
              })
            );
            // Sample naturally rendered animation frames. Reduced motion must
            // stay still; motion-enabled output must genuinely advance.
            const frames = await previewer
              .locator(selector)
              .first()
              .evaluate(async (element) => {
                const samples: { time: number; transform: string }[] = [];
                for (let i = 0; i < 20; i++) {
                  const time = await new Promise<number>((resolve) =>
                    requestAnimationFrame(resolve)
                  );
                  samples.push({ time, transform: getComputedStyle(element).transform });
                }
                return samples;
              });
            const transforms = new Set(frames.map((frame) => frame.transform));
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
            }
            assert(motion === 'reduce' ? transforms.size === 1 : transforms.size > 1);
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
