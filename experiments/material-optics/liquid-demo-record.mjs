// Observation only. A recording is not a passing optical or visual conformance result.
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(new URL('../../apps/www/package.json', import.meta.url));
const { chromium } = require('playwright-core');
const evidence = process.env.OPTICAL_EVIDENCE_DIR;
if (!evidence) throw new Error('Missing evidence directory');
await mkdir(evidence, { recursive: true });
const files = new Map(
  await Promise.all(
    ['liquid-demo.html', 'heightfield.mjs'].map(async (name) => [
      name,
      await readFile(new URL(name, import.meta.url), 'utf8'),
    ])
  )
);
const server = createServer((request, response) => {
  const name = request.url === '/' ? 'liquid-demo.html' : request.url.slice(1);
  if (!files.has(name)) {
    response.writeHead(404);
    response.end();
    return;
  }
  response.writeHead(200, {
    'content-type': name.endsWith('.mjs') ? 'text/javascript' : 'text/html',
  });
  response.end(files.get(name));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let browser, context, page;
const report = {
  sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  node: process.version,
  status: 'not-recorded',
  viewport: { width: 780, height: 800 },
  screenshotCalls: 0,
  errors: [],
  scope:
    'Actual current experimental scene; recording runs even when optical acceptance fails, which remains a separate result',
};
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  report.browser = browser.version();
  context = await browser.newContext({
    viewport: report.viewport,
    deviceScaleFactor: 1,
    recordVideo: { dir: path.join(evidence, 'clean-video'), size: report.viewport },
  });
  page = await context.newPage();
  page.on('pageerror', (e) => report.errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => document.body.dataset.ready === 'true');
  const hold = () => page.waitForTimeout(350); // Explicit presentation hold, never a correctness retry.
  await hold();
  const point = await page
    .getByRole('button', { name: 'Press the refractive surface', exact: true })
    .boundingBox();
  await page.mouse.move(point.x + point.width * 0.3, point.y + point.height / 2);
  await page.mouse.down();
  await page.waitForFunction(() => window.liquidExperiment.state.press === 1);
  await hold();
  await page.mouse.move(point.x + point.width * 0.7, point.y + point.height / 2, { steps: 8 });
  await hold();
  await page.mouse.up();
  await page.waitForFunction(() => window.liquidExperiment.state.press === 0);
  await hold();
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Button / menu', exact: true }).click();
    await page.waitForFunction(() => document.body.dataset.animating === 'false');
    await hold();
  }
  await page.getByRole('button', { name: 'Move light', exact: true }).click();
  await hold();
  await page.getByRole('button', { name: 'Move real background', exact: true }).click();
  await hold();
  report.samples = await page.evaluate(() => window.liquidExperiment.samples);
  report.status = 'recorded-not-accepted';
  if (report.errors.length) throw new Error(report.errors.join('\n'));
} catch (error) {
  report.status = 'recording-failed';
  report.failure = String(error.stack ?? error);
  throw error;
} finally {
  const video = page?.video();
  await context?.close();
  if (video) await copyFile(await video.path(), path.join(evidence, 'experimental-liquid.webm'));
  await writeFile(
    path.join(evidence, 'recording-observations.json'),
    JSON.stringify(report, null, 2)
  );
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
