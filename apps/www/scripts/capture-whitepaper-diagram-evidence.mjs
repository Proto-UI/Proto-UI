import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  selectDiagramProfile,
  diagramLocale,
  diagramVariants,
  selectDiagramVariant,
  diagramEvidenceCases,
  diagramEvidenceId,
} from './whitepaper-diagram-evidence-profiles.mjs';

// Reject unknown selections before filesystem access or browser initialization.
const profile = selectDiagramProfile(process.env.DIAGRAM_EVIDENCE_FIGURE);
const { chromium } = await import('playwright-core');

const root = fileURLToPath(new URL('../../../', import.meta.url));
const dist = path.join(root, 'apps/www/dist');
const evidenceRoot = process.env.DIAGRAM_EVIDENCE_DIR;
assert.ok(
  evidenceRoot && path.isAbsolute(evidenceRoot),
  'An absolute evidence directory is required'
);
const out = path.join(evidenceRoot, profile.figure);
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
  figure: profile.figure,
  profile,
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
    const { asset, route } = diagramLocale(profile, locale);
    const verified = new Map();
    for (const selected of diagramVariants(profile, locale)) {
      const bytes = await fs.readFile(path.join(dist, selected.asset));
      const authored = await fs.readFile(path.join(root, 'apps/www/public', selected.asset));
      assert.deepEqual(bytes, authored, `The built asset must equal the candidate source: ${selected.asset}`);
      assert.doesNotMatch(
        bytes.toString(),
        /<script\b|<foreignObject\b|\son[a-z]+\s*=|(?:href|src)\s*=/i
      );
      verified.set(selected.name, {
        ...selected,
        svgSha256: createHash('sha256').update(bytes).digest('hex'),
        sourceSha256: createHash('sha256').update(authored).digest('hex'),
      });
    }
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ colorScheme: theme, reducedMotion: 'reduce' });
      await context.route('**/*', (route) => {
        const url = new URL(route.request().url());
        return url.origin === origin || url.protocol === 'data:' ? route.continue() : route.abort();
      });
      // An isolated, source-checked local SVG document inspects the profile fonts.
      // This does not add SVG-document navigation to the production website.
      const fontProbes = new Map();
      for (const selected of verified.values()) {
        const probe = await context.newPage();
        const fontEntry = {
          figure: profile.figure, revision, asset: selected.asset,
          variant: selected.name, locale, theme, svgSha256: selected.svgSha256,
          width: selected.width, height: selected.height,
          sourceSha256: selected.sourceSha256, outcome: 'running',
        };
        report.fonts.push(fontEntry);
        try {
          await probe.setViewportSize({ width: selected.width, height: selected.height });
          await probe.goto(origin + selected.asset, { waitUntil: 'load' });
          const fontEvidence = await probe.evaluate(async () => {
            await document.fonts.ready;
            const bounds = (node) => {
              const { x, y, width, height } = node.getBBox();
              return { x, y, width, height };
            };
            return {
              families: [...document.querySelectorAll('text')].map(
                (node) => getComputedStyle(node).fontFamily
              ),
              faces: [...document.fonts].map((face) => ({ family: face.family, status: face.status })),
              cards: [...document.querySelectorAll('[data-node], [data-diagnosis]')].map((node) => ({
                name: node.getAttribute('data-node') || node.getAttribute('data-diagnosis'),
                ...bounds(node.querySelector(':scope > rect')),
              })),
              text: [...document.querySelectorAll('tspan')].map((node) => {
                const group = node.closest('[data-node], [data-diagnosis]');
                return {
                  text: node.textContent,
                  fontSize: Number.parseFloat(getComputedStyle(node).fontSize),
                  ...bounds(node),
                  ...(group ? { card: bounds(group.querySelector(':scope > rect')) } : {}),
                };
              }),
            };
          });
          Object.assign(fontEntry, fontEvidence);
          if (profile.fonts === 'embedded-handwritten') {
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
          } else {
            assert.equal(fontEvidence.faces.length, 0, 'System-font diagram must not load embedded faces');
            assert.ok(fontEvidence.families.length > 0, 'Inspect actual system-font text');
            assert.ok(fontEvidence.families.every((family) => family.includes('sans-serif')));
          }
          for (const box of fontEvidence.text) {
            assert.ok(
              box.x >= -1 && box.y >= -1 &&
                box.x + box.width <= selected.width + 1 &&
                box.y + box.height <= selected.height + 1,
              `Clipped ${locale}/${theme}/${selected.name} text: ${box.text}`
            );
            if (box.card) {
              assert.ok(
                box.x >= box.card.x - 1 && box.y >= box.card.y - 1 &&
                  box.x + box.width <= box.card.x + box.card.width + 1 &&
                  box.y + box.height <= box.card.y + box.card.height + 1,
                `Label exceeds its card: ${box.text}`
              );
            }
          }
          assert.ok(fontEvidence.text.length > 0, 'Measure visible SVG labels');
          fontEntry.minimumFontSize = Math.min(...fontEvidence.text.map((box) => box.fontSize));
          if (selected.name === 'mobile') {
            assert.ok(fontEntry.minimumFontSize >= 26, 'Every visible mobile label is at least 26 SVG units');
            assert.equal(fontEvidence.cards.length, 8, 'Measure the three lanes, evidence and four alternatives');
          }
          fontEntry.outcome = 'passed';
        } catch (error) {
          fontEntry.outcome = 'failed';
          fontEntry.error = String(error);
          report.failures.push({ stage: 'font-probe', ...fontEntry });
        } finally {
          fontProbes.set(selected.name, fontEntry);
          await save();
          await probe.close();
        }
      }

      for (const capture of diagramEvidenceCases(profile)) {
        const { viewport, scenario, initialViewport } = capture;
        const selected = verified.get(selectDiagramVariant(profile, locale, viewport.width).name);
        const { svgSha256 } = selected;
        const id = diagramEvidenceId(profile, locale, theme, viewport.width, revision, svgSha256, scenario);
        const page = await context.newPage();
        await page.setViewportSize(initialViewport || viewport);
        page.setDefaultTimeout(15000);
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        const entry = {
          id,
          figure: profile.figure,
          revision,
          asset: selected.asset,
          variant: selected.name,
          fallbackAsset: asset,
          locale,
          route,
          viewport,
          scenario,
          ...(initialViewport ? { initialViewport } : {}),
          theme,
          svgSha256,
          sourceSha256: selected.sourceSha256,
          expectedDimensions: { width: selected.width, height: selected.height },
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
          // Locate the stable fallback img, then verify what picture actually chose.
          const image = page.locator(`img[src="${asset}"]`);
          const measureImage = (node) => {
            const rect = node.getBoundingClientRect();
            return {
              src: node.currentSrc,
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
          };
          const measureVisibleRegion = (node) => {
            const box = (element) => {
              const { x, y, width, height } = element.getBoundingClientRect();
              return { x, y, width, height };
            };
            const image = box(node);
            const headers = [...new Set(document.querySelectorAll('header, [role="banner"], .header'))]
              .filter((element) => {
                const style = getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                return style.display !== 'none' && style.visibility !== 'hidden' &&
                  Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
              })
              .map((element) => ({ ...box(element), position: getComputedStyle(element).position }));
            const overlaps = (a, b) =>
              a.x < b.x + b.width && a.x + a.width > b.x &&
              a.y < b.y + b.height && a.y + a.height > b.y;
            const headerOverlap = headers.filter((header) => overlaps(image, header));
            const topInset = Math.max(0, ...headers
              .filter((header) => header.y <= 1 && header.y + header.height > 0 &&
                header.x < image.x + image.width && header.x + header.width > image.x)
              .map((header) => header.y + header.height));
            const fullyInViewport = image.x >= 0 && image.y >= 0 &&
              image.x + image.width <= innerWidth && image.y + image.height <= innerHeight;
            return {
              image, headers, headerOverlap, topInset, fullyInViewport,
              fullyVisible: fullyInViewport && headerOverlap.length === 0,
              fitsUnobstructedViewport: image.width <= innerWidth &&
                image.height + topInset + 16 <= innerHeight,
              viewport: { width: innerWidth, height: innerHeight },
              scroll: { x: scrollX, y: scrollY },
              documentImage: { ...image, x: image.x + scrollX, y: image.y + scrollY },
              document: {
                width: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
                height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
              },
            };
          };
          const bindMeasurement = (measurement, expected) => {
            assert.equal(measurement.src, origin + expected.asset, 'Use the viewport-selected allowlisted asset');
            assert.equal(measurement.naturalWidth, expected.width);
            assert.equal(measurement.naturalHeight, expected.height);
            assert.ok(measurement.complete && measurement.alt.length > 0);
            assert.equal(measurement.scheme, theme);
            assert.ok(measurement.width > 0 && measurement.height > 0);
            assert.ok(
              Math.abs(measurement.width / measurement.height - expected.width / expected.height) < 0.01,
              'The selected intrinsic aspect ratio must survive picture and preview layout'
            );
            const fontProbe = fontProbes.get(expected.name);
            assert.equal(fontProbe.outcome, 'passed', 'Selected-variant font and geometry probe must pass');
            return {
              ...measurement,
              variant: expected.name,
              asset: expected.asset,
              svgSha256: expected.svgSha256,
              sourceSha256: expected.sourceSha256,
              minimumRenderedFontSize: fontProbe.minimumFontSize * measurement.width / expected.width,
            };
          };
          const readArticle = async (expected, size) => {
            // The authored fallback is lazy-loaded, so make it load before waiting.
            await image.scrollIntoViewIfNeeded();
            await page.waitForFunction(
              ({ fallback, source, width, height }) => {
                const node = document.querySelector(`img[src="${fallback}"]`);
                return node?.complete && node.currentSrc === source &&
                  node.naturalWidth === width && node.naturalHeight === height;
              },
              { fallback: asset, source: origin + expected.asset, width: expected.width, height: expected.height }
            );
            await image.scrollIntoViewIfNeeded();
            await image.evaluate((node) => node.decode());
            await page.evaluate(() => document.fonts.ready);
            const measurement = bindMeasurement(await image.evaluate(measureImage), expected);
            assert.ok(
              measurement.x >= -1 && measurement.x + measurement.width <= size.width + 1,
              'Article image must fit the viewport'
            );
            if (profile.figure === 'evolution-feedback') {
              assert.ok(await page.evaluate(() =>
                document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
              ), 'The article must not introduce horizontal overflow');
              // A viewport article image may be partial. Record that explicitly;
              // do not equate source dimensions with unobstructed visibility.
              measurement.visibleRegion = await image.evaluate(measureVisibleRegion);
            }
            if (expected.name === 'mobile' && size.width === 390 && size.height === 844) {
              assert.ok(measurement.minimumRenderedFontSize >= 16, '390 px article labels meet the project-specific 16 px target');
            }
            return measurement;
          };
          if (initialViewport) {
            const before = verified.get(selectDiagramVariant(profile, locale, initialViewport.width).name);
            entry.beforeResize = await readArticle(before, initialViewport);
            await page.setViewportSize(viewport);
          }
          entry.image = await readArticle(selected, viewport);
          if (scenario === 'landscape-390') {
            entry.readabilityLimit = '844 x 390 landscape records actual fitted text sizes; no 16 px minimum is promised.';
          }
          assert.deepEqual(errors, [], 'No page exceptions');
          const filename = `${id}-article.png`;
          await page.screenshot({ path: path.join(out, filename) });
          entry.screenshots.push(filename);
          if (profile.figure === 'evolution-feedback') {
            entry.articleCapture = {
              kind: 'viewport', file: filename, viewport, source: entry.image,
              screenshotSha256: createHash('sha256').update(await fs.readFile(path.join(out, filename))).digest('hex'),
            };
          }
          const figure = `${id}-figure.png`;
          if (profile.figure !== 'evolution-feedback') {
            await image.screenshot({ path: path.join(out, figure) });
            entry.screenshots.push(figure);
          } else {
            const originalRegion = await image.evaluate(measureVisibleRegion);
            assert.ok(originalRegion.headers.length > 0, 'Measure the actual site header');
            const configuredViewport = page.viewportSize();
            assert.deepEqual(configuredViewport, viewport);
            const fullPage = !originalRegion.fitsUnobstructedViewport;
            const kind = fullPage ? 'document-region' : 'viewport-region';
            const figureFile = `${id}-figure-${fullPage ? 'document' : 'viewport'}.png`;
            entry.figureCapture = { kind, file: figureFile, originalRegion, outcome: 'running' };
            try {
              // Only genuine scrolling changes the view. Tall figures need a
              // document-region capture at the same responsive viewport size.
              await page.evaluate(({ fullPage, region }) => {
                window.scrollTo({
                  left: fullPage ? 0 : region.scroll.x,
                  top: fullPage ? 0 : Math.max(0, region.documentImage.y - region.topInset - 8),
                  behavior: 'instant',
                });
              }, { fullPage, region: originalRegion });
              await page.evaluate(() => new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve))
              ));
              const positioned = await image.evaluate(measureVisibleRegion);
              Object.assign(entry.figureCapture, { positioned });
              assert.ok(positioned.headers.length > 0, 'The header remains present during figure capture');
              assert.deepEqual(positioned.viewport, viewport, 'Capture must keep the real responsive viewport');
              assert.equal(positioned.headerOverlap.length, 0, 'The complete figure must not intersect the site header');
              if (fullPage) {
                assert.deepEqual(positioned.scroll, { x: 0, y: 0 }, 'Document capture starts at the real document top');
              } else {
                assert.ok(positioned.fullyVisible, 'Natural scrolling must expose the complete figure below the header');
              }
              const bounds = fullPage ? positioned.documentImage : positioned.image;
              const clip = {
                x: Math.floor(bounds.x), y: Math.floor(bounds.y),
                width: Math.ceil(bounds.x + bounds.width) - Math.floor(bounds.x),
                height: Math.ceil(bounds.y + bounds.height) - Math.floor(bounds.y),
              };
              const limit = fullPage ? positioned.document : positioned.viewport;
              assert.ok(clip.x >= 0 && clip.y >= 0 && clip.width > 0 && clip.height > 0);
              assert.ok(clip.x + clip.width <= limit.width && clip.y + clip.height <= limit.height,
                'The outward-rounded clip must contain the full image without document/viewport trimming');
              entry.figureCapture.clip = clip;
              entry.figureCapture.source = bindMeasurement(await image.evaluate(measureImage), selected);
              // Playwright 1.58.2 Chromium uses native captureBeyondViewport for
              // fullPage + clip; it does not resize the responsive layout viewport.
              await page.screenshot({
                path: path.join(out, figureFile), fullPage, clip,
                scale: 'css', caret: 'initial', animations: 'allow',
              });
              entry.screenshots.push(figureFile);
              const png = await fs.readFile(path.join(out, figureFile));
              assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
              const dimensions = { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
              Object.assign(entry.figureCapture, {
                dimensions, screenshotSha256: createHash('sha256').update(png).digest('hex'),
              });
              assert.deepEqual(dimensions, { width: clip.width, height: clip.height });
              assert.deepEqual(page.viewportSize(), configuredViewport);
              const after = await image.evaluate(measureVisibleRegion);
              entry.figureCapture.after = after;
              assert.deepEqual(after.viewport, positioned.viewport);
              assert.deepEqual(after.scroll, positioned.scroll);
              assert.deepEqual(after.documentImage, positioned.documentImage);
              assert.equal(after.headerOverlap.length, 0);
              entry.figureCapture.afterSource = bindMeasurement(await image.evaluate(measureImage), selected);
              entry.figureCapture.outcome = 'passed';
            } catch (error) {
              entry.figureCapture.outcome = 'failed';
              entry.figureCapture.error = String(error);
              throw error;
            } finally {
              await page.evaluate(({ x, y }) =>
                window.scrollTo({ left: x, top: y, behavior: 'instant' }), originalRegion.scroll
              );
            }
          }
          // Exercise the actual enhanced page control and themed Dialog. Never
          // substitute direct SVG navigation for a broken production preview.
          const trigger = page.locator('[data-docs-image-trigger]').filter({ has: image });
          const preview = page.locator('.docs-image-full');
          const openPreview = async () => {
            await trigger.click();
            await preview.waitFor({ state: 'visible' });
            await preview.evaluate((node) => node.decode());
            await page.waitForFunction(() => {
              const content = document.querySelector('[data-docs-image-content]');
              return (
                content?.getAttribute('data-transition-state') === 'entered' &&
                content.getAnimations().every(
                  (animation) => !animation.pending && animation.playState !== 'running'
                )
              );
            });
            const measurement = bindMeasurement(await preview.evaluate(measureImage), selected);
            assert.equal(measurement.alt, entry.image.alt);
            assert.ok(
              measurement.x >= -1 && measurement.y >= -1 &&
                measurement.x + measurement.width <= viewport.width + 1 &&
                measurement.y + measurement.height <= viewport.height + 1,
              'The themed full-size preview must contain the complete diagram'
            );
            if (selected.name === 'mobile' && viewport.width === 390 && viewport.height === 844) {
              assert.ok(measurement.minimumRenderedFontSize >= 16, '390 px Dialog labels meet the project-specific 16 px target');
            }
            assert.equal(new URL(page.url()).pathname, route, 'Preview must stay on the article');
            return measurement;
          };
          const dismissPreview = async () => {
            await page.keyboard.press('Escape');
            await page.waitForFunction(() => {
              const content = document.querySelector('[data-docs-image-content]');
              return !content || content.hasAttribute('data-pui-view-detached');
            });
          };
          entry.preview = await openPreview();
          const fullSize = `${id}-preview.png`;
          await page.screenshot({ path: path.join(out, fullSize) });
          entry.screenshots.push(fullSize);
          await dismissPreview();
          if (profile.figure === 'evolution-feedback') {
            entry.interactions = [];
            const exerciseAgain = async (phase) => {
              const article = await readArticle(selected, viewport);
              const dialog = await openPreview();
              await dismissPreview();
              entry.interactions.push({ phase, article, preview: dialog, dismissed: true });
            };
            await exerciseAgain('repeated-open-dismiss');
            const otherRoute = diagramLocale(selectDiagramProfile('switch-activation'), locale).route;
            // Cross-document history works at mobile widths without relying on a
            // hidden sidebar link. Recheck the real enhanced page after each return.
            const departure = await page.goto(origin + otherRoute, { waitUntil: 'networkidle' });
            assert.equal(departure.status(), 200);
            await page.goBack({ waitUntil: 'networkidle' });
            await page.waitForURL(origin + route);
            await exerciseAgain('after-back');
            await page.goForward({ waitUntil: 'networkidle' });
            await page.waitForURL(origin + otherRoute);
            await page.goBack({ waitUntil: 'networkidle' });
            await page.waitForURL(origin + route);
            await exerciseAgain('after-forward-back');
          }
          assert.deepEqual(errors, [], 'No preview or dismissal exceptions');
          entry.outcome = 'passed';
        } catch (error) {
          entry.outcome = 'failed';
          entry.error = String(error);
          report.failures.push({ id, error: String(error) });
          const failure = `${id}-failure.png`;
          try {
            await page.screenshot({ path: path.join(out, failure) });
            entry.screenshots.push(failure);
          } catch (screenshotError) {
            entry.failureScreenshotError = String(screenshotError);
          }
        } finally {
          try {
            await save();
          } finally {
            await page.close();
          }
        }
      }
      await context.close();
    }
  }
  assert.equal(report.cases.length, diagramEvidenceCases(profile).length * 4);
  assert.equal(report.fonts.length, diagramVariants(profile, 'en').length * 4);
  assert.deepEqual(report.failures, []);
  console.log(
    `Verified ${report.cases.length} exact-head article renders and ${report.fonts.length} ${profile.fonts} font probes.`
  );
} catch (error) {
  report.failures.push({ stage: 'capture', error: String(error) });
  throw error;
} finally {
  try {
    await save();
  } finally {
    try {
      await browser?.close();
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  }
}
