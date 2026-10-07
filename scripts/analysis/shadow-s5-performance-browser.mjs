import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Report real-browser scheduling evidence; deterministic route-work budgets
// live in event-router-work.test.ts, not machine-dependent frame assertions.
const { chromium } = createRequire(new URL('../../apps/www/package.json', import.meta.url))(
  'playwright-core'
);
const rounds = Number(process.env.PUI_PERF_ROUNDS ?? 3);
assert.ok(Number.isInteger(rounds) && rounds > 0 && rounds <= 20);
const output = await mkdtemp(join(tmpdir(), 'pui-s5-performance-'));
const browser = await chromium.launch({
  headless: process.env.PUI_PERF_HEADED !== '1',
  executablePath:
    process.env.PUI_CHROME_EXECUTABLE ??
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    colorScheme: 'light',
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(
    `${process.env.PROTO_UI_BROWSER_BASE_URL ?? 'http://127.0.0.1:4321'}/zh-cn/internal/demo-matrix/#shadow-split-s5`,
    { waitUntil: 'domcontentloaded', timeout: 60_000 }
  );
  await page.waitForSelector('[data-shadow-s5][data-ready="true"]');
  await page.waitForFunction(
    () => {
      const previews = [...document.querySelectorAll('[data-previewer-id]')];
      return (
        previews.length > 0 &&
        previews.every(
          (el) =>
            el.getAttribute('data-inited') === '1' &&
            (el.querySelector('.host')?.childElementCount ?? 0) > 0
        )
      );
    },
    undefined,
    { timeout: 60_000 }
  );
  await page.locator('[data-shadow-s5]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(2000);
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) errors.push(`Unexpected navigation/HMR: ${frame.url()}`);
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const results = [];
  for (let round = 0; round < rounds; round++) {
    for (const action of ['click', 'type'])
      for (const key of ['styled', 'tab'])
        for (const profile of ['light', 'split', 'mixed']) {
          const editor = page.locator(
            `[data-s5-profile="${profile}"] [data-s5-component="${key}"] textarea`
          );
          await editor.scrollIntoViewIfNeeded();
          if (action === 'click') await editor.evaluate((el) => el.blur());
          else await editor.evaluate((el) => el.focus());
          await page.waitForTimeout(300);
          const before = await cdp.send('Performance.getMetrics');
          await page.evaluate(() => {
            window.__s5Perf = { frames: [], running: true };
            const state = window.__s5Perf;
            let last = performance.now();
            const frame = (time) => {
              state.frames.push(time - last);
              last = time;
              if (state.running) requestAnimationFrame(frame);
            };
            requestAnimationFrame(frame);
          });
          if (action === 'click') await editor.click();
          else await page.keyboard.type('x');
          await page.waitForTimeout(500);
          const frames = await page.evaluate(() => {
            window.__s5Perf.running = false;
            return window.__s5Perf.frames.filter((value) => value >= 0);
          });
          const after = await cdp.send('Performance.getMetrics');
          const delta = (name) =>
            after.metrics.find((x) => x.name === name).value -
            before.metrics.find((x) => x.name === name).value;
          assert.ok(await editor.evaluate((el) => el.matches(':focus')));
          const result = {
            round,
            action,
            profile,
            key,
            maxFrameMs: Math.max(...frames),
            framesOver25ms: frames.filter((v) => v > 25),
            scriptMs: delta('ScriptDuration') * 1000,
            styleMs: delta('RecalcStyleDuration') * 1000,
            layoutMs: delta('LayoutDuration') * 1000,
          };
          results.push(result);
          console.log(JSON.stringify(result));
        }
  }
  const report = {
    browser: browser.version(),
    headed: process.env.PUI_PERF_HEADED === '1',
    viewport: { width: 1440, height: 1100 },
    rounds,
    errors,
    results,
  };
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`Performance evidence: ${join(output, 'report.json')}`);
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
