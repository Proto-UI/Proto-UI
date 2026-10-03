import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const dist = path.join(root, 'apps/www/dist');
const out = process.env.DIAGRAM_EVIDENCE_DIR;
assert.ok(out && path.isAbsolute(out), 'An absolute evidence directory is required');
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
assert.equal(
  revision,
  process.env.CANDIDATE_SHA,
  'Capture the exact candidate, not a merge revision'
);
assert.ok(process.env.CHROME_PATH, 'Use an explicitly identified runner browser');
await fs.mkdir(out, { recursive: true });
const report = {
  revision,
  renderer: 'built Astro documentation / Chromium',
  cases: [],
  fonts: [],
  failures: [],
};
const save = () =>
  fs.writeFile(path.join(out, 'metrics.json'), JSON.stringify(report, null, 2) + '\n');
await save();

const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    let filename = path.resolve(dist, '.' + decodeURIComponent(url.pathname));
    assert.ok(filename.startsWith(dist + path.sep), 'Outside the built documentation tree');
    if ((await fs.stat(filename)).isDirectory()) filename = path.join(filename, 'index.html');
    const bytes = await fs.readFile(filename);
    response.writeHead(200, {
      'Content-Type': types[path.extname(filename)] || 'application/octet-stream',
    });
    response.end(bytes);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
  report.browser = browser.version();
  for (const locale of ['zh-cn', 'en']) {
    const asset = `/diagrams/whitepaper-switch-activation.${locale}.svg`;
    const bytes = await fs.readFile(path.join(dist, asset));
    const authored = await fs.readFile(path.join(root, 'apps/www/public', asset));
    assert.deepEqual(bytes, authored, 'The built asset must equal the candidate source');
    assert.doesNotMatch(
      bytes.toString(),
      /<script\b|<foreignObject\b|\son[a-z]+\s*=|(?:href|src)\s*=/i
    );
    const svgSha256 = createHash('sha256').update(bytes).digest('hex');
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ colorScheme: theme, reducedMotion: 'reduce' });
      await context.route('**/*', (route) => {
        const url = new URL(route.request().url());
        return url.origin === origin || url.protocol === 'data:' ? route.continue() : route.abort();
      });
      // An isolated, source-checked local SVG document inspects embedded fonts.
      // This does not add SVG-document navigation to the production website.
      const probe = await context.newPage();
      await probe.setViewportSize({ width: 960, height: 920 });
      await probe.goto(origin + asset, { waitUntil: 'load' });
      const fontEvidence = await probe.evaluate(async () => {
        await document.fonts.ready;
        return {
          faces: [...document.fonts].map((face) => ({ family: face.family, status: face.status })),
          text: [...document.querySelectorAll('tspan')].map((node) => {
            const box = node.getBBox();
            return {
              text: node.textContent,
              x: box.x,
              y: box.y,
              width: box.width,
              height: box.height,
            };
          }),
        };
      });
      assert.ok(
        fontEvidence.faces.some(
          (face) => face.family.includes('Hand Latin') && face.status === 'loaded'
        )
      );
      if (locale === 'zh-cn')
        assert.ok(
          fontEvidence.faces.some(
            (face) => face.family.includes('Hand CJK') && face.status === 'loaded'
          )
        );
      for (const box of fontEvidence.text) {
        assert.ok(
          box.x >= -1 && box.y >= -1 && box.x + box.width <= 961 && box.y + box.height <= 921,
          `Clipped ${locale}/${theme} text: ${box.text}`
        );
      }
      report.fonts.push({ locale, theme, svgSha256, ...fontEvidence });
      await probe.close();

      for (const viewport of [
        { width: 1440, height: 1000 },
        { width: 390, height: 844 },
      ]) {
        const id = `${locale}-${theme}-${viewport.width}`;
        const page = await context.newPage();
        await page.setViewportSize(viewport);
        page.setDefaultTimeout(15000);
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        const route = `/${locale}/whitepaper/4-semantics-beyond-channels/`;
        const entry = {
          id,
          route,
          viewport,
          theme,
          svgSha256,
          errors,
          screenshots: [],
          outcome: 'running',
        };
        report.cases.push(entry);
        try {
          const response = await page.goto(origin + route, { waitUntil: 'networkidle' });
          assert.equal(response.status(), 200);
          await page.waitForFunction(
            (expected) => document.documentElement.dataset.theme === expected,
            theme
          );
          const image = page.locator(`img[src="${asset}"]`);
          await image.scrollIntoViewIfNeeded();
          await image.evaluate((node) => node.decode());
          await page.evaluate(() => document.fonts.ready);
          entry.image = await image.evaluate((node) => {
            const rect = node.getBoundingClientRect();
            return {
              naturalWidth: node.naturalWidth,
              naturalHeight: node.naturalHeight,
              alt: node.alt,
              complete: node.complete,
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              scheme: getComputedStyle(node).colorScheme,
            };
          });
          assert.equal(entry.image.naturalWidth, 960);
          assert.equal(entry.image.naturalHeight, 920);
          assert.ok(entry.image.complete && entry.image.alt.length > 0);
          assert.equal(entry.image.scheme, theme);
          assert.ok(
            entry.image.x >= -1 && entry.image.x + entry.image.width <= viewport.width + 1,
            'Article image must fit the viewport'
          );
          assert.deepEqual(errors, [], 'No page exceptions');
          const filename = `${id}-article.png`;
          await page.screenshot({ path: path.join(out, filename) });
          entry.screenshots.push(filename);
          const figure = `${id}-figure.png`;
          await image.screenshot({ path: path.join(out, figure) });
          entry.screenshots.push(figure);
          entry.outcome = 'passed';
        } catch (error) {
          entry.outcome = 'failed';
          entry.error = String(error);
          await page.screenshot({ path: path.join(out, `${id}-failure.png`) });
          report.failures.push({ id, error: String(error) });
        } finally {
          await save();
          await page.close();
        }
      }
      await context.close();
    }
  }
  assert.equal(report.cases.length, 8);
  assert.deepEqual(report.failures, []);
  console.log(
    `Verified ${report.cases.length} exact-head article renders and ${report.fonts.length} embedded-font probes.`
  );
} catch (error) {
  report.failures.push({ stage: 'capture', error: String(error) });
  throw error;
} finally {
  await save();
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
