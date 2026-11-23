import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readContrastProvenance } from './contrast-provenance.mjs';
import { collectDiagramInventory } from './whitepaper-diagram-inventory.mjs';
import { verifyDiagramBuild } from './whitepaper-diagram-build.mjs';
import { diagramPngReceipt, diagramSha256 } from './whitepaper-diagram-evidence-receipts.mjs';

const viewports = [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
];

// These are existing article image references, not an active SVG document allowlist.
export function authoredDiagramCapturePlan(inventory) {
  assert.equal(inventory.kind, 'proto-ui.whitepaper-diagram-inventory');
  assert.match(inventory.revision, /^[a-f0-9]{40}$/);
  const plan = [];
  for (const asset of inventory.assets.filter((entry) => entry.kind === 'authored-export')) {
    const occurrences = new Map();
    for (const reference of asset.references.filter(
      (entry) => entry.status === 'canonical-article'
    )) {
      const match = reference.path.match(
        /^apps\/www\/src\/content\/docs\/(en|zh-cn)\/whitepaper\/([^/]+)\.md$/
      );
      assert.ok(match, 'Use an actual canonical whitepaper source');
      const [, locale, chapter] = match;
      const imageIndex = occurrences.get(reference.path) ?? 0;
      occurrences.set(reference.path, imageIndex + 1);
      const url = asset.asset.replace(/^apps\/www\/public/, '');
      assert.ok(url.startsWith('/diagrams/') && url.endsWith('.svg'));
      assert.match(asset.sha256, /^[a-f0-9]{64}$/);
      for (const theme of ['light', 'dark'])
        for (const viewport of viewports) {
          const name = path.basename(url, '.svg').replaceAll('.', '-');
          plan.push({
            id: `authored-${name}-${locale}-${chapter}-${reference.line}-${theme}-${viewport.width}-${inventory.revision}-${asset.sha256}`,
            revision: inventory.revision,
            asset: url,
            sourcePath: asset.asset,
            sourceSha256: asset.sha256,
            pageSourcePath: reference.path,
            pageSourceSha256: reference.sha256,
            referenceLine: reference.line,
            imageIndex,
            locale,
            route: `/${locale}/whitepaper/${chapter}/`,
            theme,
            viewport,
          });
        }
    }
  }
  assert.ok(plan.length > 0, 'Authored article consumers are required');
  assert.equal(
    new Set(plan.map((entry) => entry.id)).size,
    plan.length,
    'Unique capture identities'
  );
  return plan;
}

export function authoredSvgDimensions(source) {
  const tag = String(source).match(/<svg\b[^>]*>/)?.[0];
  const viewBox = tag
    ?.match(/\bviewBox="([^"]+)"/)?.[1]
    .trim()
    .split(/[ ,]+/)
    .map(Number);
  assert.ok(viewBox?.length === 4 && viewBox.every(Number.isFinite));
  assert.ok(viewBox[2] > 0 && viewBox[3] > 0, 'Authored SVG has a positive viewBox');
  return { viewBox, width: viewBox[2], height: viewBox[3] };
}

// getBoundingClientRect measures the border box. SVG intrinsic proportions
// belong to the image content; retain the outer box for visibility and PNG clips.
export function authoredImageContentBox(image) {
  assert.ok(Number.isFinite(image.width) && image.width > 0);
  assert.ok(Number.isFinite(image.height) && image.height > 0);
  for (const kind of ['border', 'padding']) {
    const edges = image.style[kind];
    assert.ok(
      edges &&
        ['top', 'right', 'bottom', 'left'].every(
          (edge) => Number.isFinite(edges[edge]) && edges[edge] >= 0
        ),
      `Measured nonnegative ${kind} edges are required`
    );
  }
  const { border, padding } = image.style;
  const width = image.width - border.left - border.right - padding.left - padding.right;
  const height = image.height - border.top - border.bottom - padding.top - padding.bottom;
  assert.ok(width > 0 && height > 0, 'Image content box must be positive');
  return { width, height };
}

function verifyAuthoredImageGeometry(image, dimensions) {
  assert.deepEqual(
    image.contentBox,
    authoredImageContentBox(image),
    'Recompute content geometry from measured border and padding edges'
  );
  assert.ok(
    Math.abs(image.naturalWidth / image.naturalHeight - dimensions.width / dimensions.height) < 0.01
  );
  assert.ok(
    Math.abs(
      image.contentBox.width / image.contentBox.height - dimensions.width / dimensions.height
    ) < 0.01,
    'Image content aspect ratio differs from its SVG'
  );
}

export async function verifyAuthoredDiagramReport(
  report,
  { inventory, provenance, build, readSource, readScreenshot }
) {
  const plan = authoredDiagramCapturePlan(inventory);
  assert.equal(report.kind, 'proto-ui.authored-diagram-capture');
  assert.equal(report.revision, inventory.revision);
  assert.equal(provenance.head, inventory.revision);
  assert.deepEqual(report.provenance, provenance);
  assert.deepEqual(report.completedProvenance, provenance, 'Capture source changed');
  assert.deepEqual(report.build, build);
  assert.deepEqual(report.completedBuild, build, 'Capture build changed');
  assert.equal(report.visualReview, 'pending', 'Captured pixels are not a visual approval');
  assert.ok(report.browser?.trim());
  assert.deepEqual(report.failures, []);
  const assets = inventory.assets.filter((entry) => entry.kind === 'authored-export');
  assert.deepEqual(
    Object.keys(report.assets).sort(),
    assets.map((entry) => entry.asset.replace(/^apps\/www\/public/, '')).sort()
  );
  for (const asset of assets) {
    const url = asset.asset.replace(/^apps\/www\/public/, '');
    const source = await readSource(asset.asset);
    assert.equal(diagramSha256(source), asset.sha256);
    assert.equal(
      diagramSha256(await readSource(`apps/www/dist${url}`)),
      asset.sha256,
      'Built authored SVG differs from source'
    );
    assert.deepEqual(report.assets[url], {
      sourceSha256: asset.sha256,
      builtSha256: asset.sha256,
      ...authoredSvgDimensions(source),
    });
  }
  const pages = new Map(plan.map((entry) => [entry.route, entry]));
  assert.deepEqual(Object.keys(report.pages).sort(), [...pages.keys()].sort());
  for (const [route, entry] of pages) {
    assert.equal(diagramSha256(await readSource(entry.pageSourcePath)), entry.pageSourceSha256);
    assert.deepEqual(report.pages[route], {
      sourcePath: entry.pageSourcePath,
      sourceSha256: entry.pageSourceSha256,
      builtSha256: diagramSha256(await readSource(`apps/www/dist${route}index.html`)),
    });
  }
  assert.equal(report.cases.length, plan.length);
  const receipts = new Map(report.cases.map((entry) => [entry.id, entry]));
  assert.equal(receipts.size, plan.length);
  for (const expected of plan) {
    const entry = receipts.get(expected.id);
    assert.ok(entry, `Missing authored reference: ${expected.id}`);
    for (const [key, value] of Object.entries(expected)) assert.deepEqual(entry[key], value);
    assert.equal(entry.outcome, 'captured');
    assert.deepEqual(entry.errors, []);
    assert.ok(
      entry.image.complete && entry.image.naturalWidth > 0 && entry.image.naturalHeight > 0
    );
    assert.ok(entry.image.alt.trim());
    assert.equal(new URL(entry.image.src).pathname, expected.asset);
    assert.notEqual(entry.image.style.display, 'none');
    assert.notEqual(entry.image.style.visibility, 'hidden');
    assert.equal(entry.image.style.colorScheme, expected.theme);
    assert.ok(Number(entry.image.style.opacity) > 0 && entry.image.visibleViewportArea > 0);
    assert.equal(entry.image.document.horizontalOverflow, false);
    assert.equal(entry.image.inViewportHorizontally, true);
    const dimensions = report.assets[expected.asset];
    verifyAuthoredImageGeometry(entry.image, dimensions);
    for (const kind of ['article', 'figure']) {
      const capture = entry[kind + 'Capture'];
      assert.equal(capture.file, `${expected.id}-${kind}.png`);
      assert.deepEqual(diagramPngReceipt(await readScreenshot(capture.file)), {
        dimensions: capture.dimensions,
        screenshotSha256: capture.screenshotSha256,
      });
    }
    assert.deepEqual(entry.articleCapture.dimensions, expected.viewport);
    assert.deepEqual(entry.articleCapture.source, entry.image);
    const positioned = entry.figureCapture.source;
    for (const measured of [positioned, entry.figureCapture.after]) {
      verifyAuthoredImageGeometry(measured, dimensions);
      assert.deepEqual(measured.contentBox, entry.image.contentBox);
    }
    assert.deepEqual(positioned.viewport, expected.viewport);
    assert.deepEqual(positioned.documentImage, entry.image.documentImage);
    assert.deepEqual(entry.figureCapture.after.documentImage, positioned.documentImage);
    assert.deepEqual(entry.figureCapture.after.viewport, expected.viewport);
    assert.deepEqual(positioned.headerOverlap, []);
    const bounds = positioned.documentImage;
    assert.deepEqual(
      entry.figureCapture.clip,
      {
        x: Math.floor(bounds.x),
        y: Math.floor(bounds.y),
        width: Math.ceil(bounds.x + bounds.width) - Math.floor(bounds.x),
        height: Math.ceil(bounds.y + bounds.height) - Math.floor(bounds.y),
      },
      'Capture the entire real figure at its article layout size'
    );
    assert.deepEqual(entry.figureCapture.dimensions, {
      width: entry.figureCapture.clip.width,
      height: entry.figureCapture.clip.height,
    });
  }
  return { cases: plan.length, screenshots: plan.length * 2, visualReview: 'pending' };
}

// Executed only within the actual article. No cloned DOM or SVG-document probe.
export function measureImage(node) {
  const box = (element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x, y, width, height };
  };
  const rect = box(node),
    style = getComputedStyle(node);
  const overlaps = (a, b) =>
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  const headers = [...new Set(document.querySelectorAll('header, [role="banner"], .header'))]
    .filter((element) => {
      const s = getComputedStyle(element),
        r = box(element);
      return (
        s.display !== 'none' &&
        s.visibility !== 'hidden' &&
        Number(s.opacity) > 0 &&
        r.width > 0 &&
        r.height > 0
      );
    })
    .map(box);
  const article = node.closest('.sl-markdown-content') || node.closest('main');
  const width = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
  const height = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  const visibleWidth = Math.max(0, Math.min(rect.x + rect.width, innerWidth) - Math.max(0, rect.x));
  const visibleHeight = Math.max(
    0,
    Math.min(rect.y + rect.height, innerHeight) - Math.max(0, rect.y)
  );
  return {
    src: node.currentSrc,
    complete: node.complete,
    naturalWidth: node.naturalWidth,
    naturalHeight: node.naturalHeight,
    alt: node.alt,
    caption: node.closest('figure')?.querySelector('figcaption')?.textContent?.trim() || '',
    describedBy: (node.getAttribute('aria-describedby') || '')
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => ({ id, text: document.getElementById(id)?.textContent?.trim() || '' })),
    ...rect,
    documentImage: { ...rect, x: rect.x + scrollX, y: rect.y + scrollY },
    article: article ? box(article) : null,
    style: {
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      colorScheme: style.colorScheme,
      filter: style.filter,
      boxSizing: style.boxSizing,
      border: Object.fromEntries(
        ['Top', 'Right', 'Bottom', 'Left'].map((side) => [
          side.toLowerCase(),
          Number.parseFloat(style[`border${side}Width`]),
        ])
      ),
      padding: Object.fromEntries(
        ['Top', 'Right', 'Bottom', 'Left'].map((side) => [
          side.toLowerCase(),
          Number.parseFloat(style[`padding${side}`]),
        ])
      ),
    },
    viewport: { width: innerWidth, height: innerHeight },
    scroll: { x: scrollX, y: scrollY },
    document: {
      width,
      height,
      horizontalOverflow: width > document.documentElement.clientWidth + 1,
    },
    inViewportHorizontally: rect.x >= -1 && rect.x + rect.width <= innerWidth + 1,
    visibleViewportArea: visibleWidth * visibleHeight,
    fullyInViewport:
      rect.x >= 0 &&
      rect.y >= 0 &&
      rect.x + rect.width <= innerWidth &&
      rect.y + rect.height <= innerHeight,
    headers,
    headerOverlap: headers.filter((header) => overlaps(header, rect)),
    visibilityBoundary:
      'Viewport geometry and header overlap; not a pixel, clipping-ancestor or assistive-technology verdict.',
  };
}

export async function captureAuthoredDiagrams({ root, directory, revision, executablePath }) {
  assert.ok(directory && path.isAbsolute(directory), 'An absolute evidence directory is required');
  assert.ok(executablePath, 'Use an explicitly identified runner browser');
  const provenance = readContrastProvenance(root);
  assert.equal(provenance.head, revision, 'Capture the exact candidate');
  const inventory = collectDiagramInventory(root, revision);
  const build = await verifyDiagramBuild({ root, directory, revision });
  const out = path.join(directory, 'authored-exports');
  await fs.mkdir(out); // Never overwrite a prior capture, including a failed one.
  const report = {
    schemaVersion: 1,
    kind: 'proto-ui.authored-diagram-capture',
    revision,
    provenance,
    build,
    scope:
      'Actual canonical article image geometry and captures; no SVG-document navigation or visual approval.',
    visualReview: 'pending',
    renderer: 'built Astro documentation / Chromium',
    chromiumSandbox: true,
    collectorSha256: diagramSha256(await fs.readFile(fileURLToPath(import.meta.url))),
    pages: {},
    assets: {},
    failures: [],
    cases: authoredDiagramCapturePlan(inventory).map((entry) => ({
      ...entry,
      outcome: 'not-run',
      errors: [],
      screenshots: [],
    })),
  };
  const save = () =>
    fs.writeFile(path.join(out, 'metrics.json'), JSON.stringify(report, null, 2) + '\n');
  await save();
  const dist = path.join(root, 'apps/www/dist');
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
      let file = path.resolve(
        dist,
        '.' + decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname)
      );
      assert.ok(file.startsWith(dist + path.sep));
      if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html');
      const bytes = await fs.readFile(file);
      response.writeHead(200, {
        'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      });
      response.end(bytes);
    } catch {
      response.writeHead(404);
      response.end('Not found');
    }
  });
  let browser;
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const { chromium } = await import('playwright-core');
    browser = await chromium.launch({ executablePath, headless: true, chromiumSandbox: true });
    report.browser = browser.version();
    for (const entry of report.cases) {
      entry.outcome = 'running';
      await save();
      let context;
      try {
        const source = await fs.readFile(path.join(root, entry.sourcePath));
        const built = await fs.readFile(path.join(dist, entry.asset));
        assert.equal(diagramSha256(source), entry.sourceSha256);
        assert.equal(
          diagramSha256(built),
          entry.sourceSha256,
          'Built authored SVG differs from source'
        );
        const dimensions = authoredSvgDimensions(source);
        report.assets[entry.asset] = {
          sourceSha256: entry.sourceSha256,
          builtSha256: diagramSha256(built),
          ...dimensions,
        };
        const pageSource = await fs.readFile(path.join(root, entry.pageSourcePath));
        assert.equal(diagramSha256(pageSource), entry.pageSourceSha256);
        report.pages[entry.route] = {
          sourcePath: entry.pageSourcePath,
          sourceSha256: entry.pageSourceSha256,
          builtSha256: diagramSha256(await fs.readFile(path.join(dist, entry.route, 'index.html'))),
        };
        context = await browser.newContext({
          viewport: entry.viewport,
          colorScheme: entry.theme,
          reducedMotion: 'reduce',
        });
        await context.route('**/*', (route) => {
          const url = new URL(route.request().url());
          return url.origin === origin || url.protocol === 'data:'
            ? route.continue()
            : route.abort();
        });
        const page = await context.newPage();
        page.setDefaultTimeout(15000);
        page.on('pageerror', (error) => entry.errors.push(error.message));
        const response = await page.goto(origin + entry.route, { waitUntil: 'networkidle' });
        assert.equal(response.status(), 200);
        await page.waitForFunction(
          (theme) => document.documentElement.dataset.theme === theme,
          entry.theme
        );
        const image = page.locator(`img[src="${entry.asset}"]`).nth(entry.imageIndex);
        await image.scrollIntoViewIfNeeded();
        await image.evaluate((node) => node.decode());
        await page.evaluate(() => document.fonts.ready);
        entry.image = await image.evaluate(measureImage);
        entry.image.contentBox = authoredImageContentBox(entry.image);
        assert.equal(entry.image.src, origin + entry.asset);
        assert.ok(
          entry.image.complete && entry.image.naturalWidth > 0 && entry.image.naturalHeight > 0
        );
        verifyAuthoredImageGeometry(entry.image, dimensions);
        const articleFile = `${entry.id}-article.png`;
        await page.screenshot({ path: path.join(out, articleFile), scale: 'css' });
        entry.articleCapture = {
          file: articleFile,
          source: entry.image,
          ...diagramPngReceipt(await fs.readFile(path.join(out, articleFile))),
        };
        entry.screenshots.push(articleFile);
        // Keep the responsive viewport and use native document coordinates for
        // the full image. Never resize the viewport or hide a fixed site header.
        await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
        await page.evaluate(
          () =>
            new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        );
        const positioned = await image.evaluate(measureImage);
        positioned.contentBox = authoredImageContentBox(positioned);
        const bounds = positioned.documentImage;
        const clip = {
          x: Math.floor(bounds.x),
          y: Math.floor(bounds.y),
          width: Math.ceil(bounds.x + bounds.width) - Math.floor(bounds.x),
          height: Math.ceil(bounds.y + bounds.height) - Math.floor(bounds.y),
        };
        assert.ok(clip.x >= 0 && clip.y >= 0 && clip.width > 0 && clip.height > 0);
        assert.ok(
          clip.x + clip.width <= positioned.document.width &&
            clip.y + clip.height <= positioned.document.height
        );
        assert.equal(positioned.headerOverlap.length, 0);
        const figureFile = `${entry.id}-figure.png`;
        await page.screenshot({
          path: path.join(out, figureFile),
          fullPage: true,
          clip,
          scale: 'css',
          caret: 'initial',
          animations: 'allow',
        });
        const after = await image.evaluate(measureImage);
        after.contentBox = authoredImageContentBox(after);
        assert.deepEqual(after.viewport, entry.viewport);
        assert.deepEqual(
          after.documentImage,
          positioned.documentImage,
          'Capture must not resize the real article'
        );
        entry.figureCapture = {
          file: figureFile,
          clip,
          source: positioned,
          after,
          ...diagramPngReceipt(await fs.readFile(path.join(out, figureFile))),
        };
        entry.screenshots.push(figureFile);
        assert.ok(entry.image.alt.trim());
        assert.ok(await image.isVisible());
        assert.notEqual(entry.image.style.display, 'none');
        assert.notEqual(entry.image.style.visibility, 'hidden');
        assert.equal(entry.image.style.colorScheme, entry.theme);
        assert.ok(Number(entry.image.style.opacity) > 0 && entry.image.visibleViewportArea > 0);
        assert.ok(entry.image.describedBy.every((description) => description.text));
        assert.equal(entry.image.document.horizontalOverflow, false);
        assert.equal(entry.image.inViewportHorizontally, true);
        assert.deepEqual(entry.errors, []);
        entry.outcome = 'captured';
      } catch (error) {
        entry.outcome = 'failed';
        entry.error = String(error);
        report.failures.push({ id: entry.id, error: entry.error });
        const page = context?.pages()[0];
        if (page)
          try {
            const file = `${entry.id}-failure.png`;
            await page.screenshot({ path: path.join(out, file), scale: 'css' });
            entry.failureCapture = {
              file,
              ...diagramPngReceipt(await fs.readFile(path.join(out, file))),
            };
          } catch (captureError) {
            entry.failureScreenshotError = String(captureError);
          }
      } finally {
        await save();
        await context?.close();
      }
    }
    report.completedProvenance = readContrastProvenance(root);
    report.completedBuild = await verifyDiagramBuild({ root, directory, revision });
    report.summary = await verifyAuthoredDiagramReport(report, {
      inventory,
      provenance,
      build,
      readSource: (filename) => fs.readFile(path.join(root, filename)),
      readScreenshot: (filename) => fs.readFile(path.join(out, filename)),
    });
    report.outcome = 'captured';
  } catch (error) {
    report.failures.push({ stage: 'capture', error: String(error) });
    report.outcome = 'failed';
  } finally {
    for (const entry of report.cases)
      if (entry.outcome === 'not-run')
        entry.reason =
          'Capture initialization or an earlier infrastructure failure prevented execution.';
    try {
      await save();
    } finally {
      try {
        await browser?.close();
      } finally {
        if (server.listening) await new Promise((resolve) => server.close(resolve));
      }
    }
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const report = await captureAuthoredDiagrams({
    root: fileURLToPath(new URL('../../../', import.meta.url)),
    directory: process.env.DIAGRAM_EVIDENCE_DIR,
    revision: process.env.CANDIDATE_SHA,
    executablePath: process.env.CHROME_PATH,
  });
  console.log(
    JSON.stringify({
      outcome: report.outcome,
      cases: report.cases.length,
      failures: report.failures.length,
      visualReview: report.visualReview,
    })
  );
  process.exitCode = report.outcome === 'captured' ? 0 : 1;
}
