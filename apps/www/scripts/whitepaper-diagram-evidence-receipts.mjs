import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  diagramLocale,
  diagramVariants,
  diagramEvidenceCases,
  diagramEvidenceId,
  selectDiagramVariant,
} from './whitepaper-diagram-evidence-profiles.mjs';

export const diagramSha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function diagramPagePaths(profile, locale) {
  const { route } = diagramLocale(profile, locale);
  return {
    sourcePath: `apps/www/src/content/docs/${locale}/whitepaper/${profile.chapter}.md`,
    builtPath: `apps/www/dist${route}index.html`,
  };
}

export function diagramPngReceipt(bytes) {
  assert.ok(Buffer.isBuffer(bytes) && bytes.length >= 45, 'A complete PNG is required');
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'PNG signature');
  assert.equal(bytes.readUInt32BE(8), 13, 'PNG IHDR length');
  assert.equal(bytes.subarray(12, 16).toString(), 'IHDR', 'PNG dimensions');
  assert.equal(bytes.subarray(-12).toString('hex'), '0000000049454e44ae426082', 'PNG end');
  const dimensions = { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  assert.ok(dimensions.width > 0 && dimensions.height > 0, 'Positive PNG dimensions');
  return { dimensions, screenshotSha256: diagramSha256(bytes) };
}

function uniqueIndex(items, key, label) {
  assert.ok(Array.isArray(items), `${label} must be an array`);
  const index = new Map();
  for (const item of items) {
    const id = key(item);
    assert.ok(!index.has(id), `Duplicate ${label}: ${id}`);
    index.set(id, item);
  }
  return index;
}

// This checks the completeness and byte bindings of a real capture. It does not
// authenticate a report author, approve a diagram or establish full Issue closure.
export async function verifyDiagramReport(profile, report, {
  revision,
  provenance,
  build,
  readSource,
  readScreenshot,
}) {
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.kind, 'proto-ui.whitepaper-diagram-capture');
  assert.match(revision, /^[a-f0-9]{40}$/);
  assert.equal(report.revision, revision, 'Capture the current candidate revision');
  assert.equal(report.figure, profile.figure);
  assert.deepEqual(report.profile, profile);
  assert.equal(provenance.head, revision);
  assert.deepEqual(report.provenance, provenance, 'Capture source identity must remain current');
  assert.deepEqual(report.completedProvenance, provenance, 'Source changed during capture');
  assert.deepEqual(report.build, build, 'Capture must use the candidate production build');
  assert.deepEqual(report.completedBuild, build, 'Production bytes changed during capture');
  assert.ok(typeof report.browser === 'string' && report.browser.length > 0);
  assert.deepEqual(report.failures, [], 'Failed captures are not complete evidence');
  assert.deepEqual(Object.keys(report.pages).sort(), ['en', 'zh-cn']);
  const assets = uniqueIndex(report.assets, (item) => `${item.locale}/${item.name}`, 'asset');
  const fonts = uniqueIndex(report.fonts, (item) => `${item.locale}/${item.theme}/${item.variant}`, 'font probe');
  const cases = uniqueIndex(report.cases, (item) => item.id, 'capture case');
  const usedScreenshots = new Set();
  let expectedAssets = 0;
  let expectedFonts = 0;
  let expectedCases = 0;

  const verifyScreenshot = async (capture, id) => {
    assert.ok(capture && typeof capture.file === 'string', 'Screenshot receipt is required');
    assert.ok(
      capture.file.startsWith(`${id}-`) && /^[a-z0-9-]+\.png$/.test(capture.file),
      'Screenshot must be a candidate-bound basename'
    );
    assert.ok(!usedScreenshots.has(capture.file), 'Each view needs its own screenshot');
    usedScreenshots.add(capture.file);
    const actual = diagramPngReceipt(await readScreenshot(capture.file));
    assert.deepEqual(capture.dimensions, actual.dimensions, 'Screenshot dimensions changed');
    assert.equal(capture.screenshotSha256, actual.screenshotSha256, 'Screenshot bytes changed');
  };

  for (const locale of ['en', 'zh-cn']) {
    const { asset: fallbackAsset, route } = diagramLocale(profile, locale);
    const page = report.pages[locale];
    const paths = diagramPagePaths(profile, locale);
    assert.equal(page.sourcePath, paths.sourcePath);
    assert.equal(page.builtPath, paths.builtPath);
    assert.equal(page.sourceSha256, diagramSha256(await readSource(paths.sourcePath)), 'Article source changed');
    assert.equal(page.builtSha256, diagramSha256(await readSource(paths.builtPath)), 'Built article changed');
    for (const selected of diagramVariants(profile, locale)) {
      expectedAssets++;
      const binding = assets.get(`${locale}/${selected.name}`);
      assert.ok(binding, `Missing asset: ${locale}/${selected.name}`);
      for (const [key, value] of Object.entries(selected)) assert.equal(binding[key], value);
      const source = await readSource(`apps/www/public${selected.asset}`);
      const built = await readSource(`apps/www/dist${selected.asset}`);
      assert.deepEqual(built, source, 'Built SVG must equal the actual candidate source');
      assert.equal(binding.sourceSha256, diagramSha256(source));
      assert.equal(binding.svgSha256, binding.sourceSha256);
      for (const theme of ['light', 'dark']) {
        expectedFonts++;
        const font = fonts.get(`${locale}/${theme}/${selected.name}`);
        assert.ok(font, `Missing font probe: ${locale}/${theme}/${selected.name}`);
        assert.equal(font.outcome, 'passed');
        assert.equal(font.revision, revision);
        assert.equal(font.figure, profile.figure);
        assert.equal(font.asset, selected.asset);
        assert.equal(font.svgSha256, binding.svgSha256);
        assert.equal(font.sourceSha256, binding.sourceSha256);
        assert.ok(Array.isArray(font.text) && font.text.length > 0, 'Measured text is required');
        assert.ok(Number.isFinite(font.minimumFontSize) && font.minimumFontSize > 0);
      }
    }
    for (const theme of ['light', 'dark']) {
      for (const capture of diagramEvidenceCases(profile)) {
        expectedCases++;
        const selected = selectDiagramVariant(profile, locale, capture.viewport.width);
        const binding = assets.get(`${locale}/${selected.name}`);
        const id = diagramEvidenceId(profile, locale, theme, capture.viewport.width, revision, binding.svgSha256, capture.scenario);
        const entry = cases.get(id);
        assert.ok(entry, `Missing capture case: ${id}`);
        assert.equal(entry.outcome, 'passed');
        assert.equal(entry.figure, profile.figure);
        assert.equal(entry.revision, revision);
        assert.equal(entry.locale, locale);
        assert.equal(entry.theme, theme);
        assert.equal(entry.route, route);
        assert.equal(entry.scenario, capture.scenario);
        assert.deepEqual(entry.viewport, capture.viewport);
        assert.deepEqual(entry.initialViewport, capture.initialViewport);
        assert.equal(entry.variant, selected.name);
        assert.equal(entry.asset, selected.asset);
        assert.equal(entry.fallbackAsset, fallbackAsset);
        assert.equal(entry.svgSha256, binding.svgSha256);
        assert.equal(entry.sourceSha256, binding.sourceSha256);
        assert.deepEqual(entry.expectedDimensions, { width: selected.width, height: selected.height });
        assert.deepEqual(entry.errors, []);
        for (const measurement of [entry.image, entry.preview, entry.figureCapture?.source]) {
          assert.ok(measurement, 'Article, figure and preview measurements are required');
          assert.equal(measurement.asset, selected.asset);
          assert.equal(measurement.variant, selected.name);
          assert.equal(measurement.svgSha256, binding.svgSha256);
          assert.equal(measurement.sourceSha256, binding.sourceSha256);
          const sourceUrl = new URL(measurement.src);
          assert.equal(sourceUrl.protocol, 'http:');
          assert.equal(sourceUrl.hostname, '127.0.0.1');
          assert.equal(sourceUrl.pathname, selected.asset);
          assert.equal(sourceUrl.search + sourceUrl.hash, '');
          assert.ok(measurement.complete && measurement.width > 0 && measurement.height > 0);
          assert.equal(measurement.scheme, theme);
          assert.ok(measurement.alt?.trim(), 'Actual accessible image text is required');
        }
        assert.equal(entry.preview.alt, entry.image.alt);
        assert.ok(entry.accessibility?.triggerLabel?.trim(), 'Actual preview control text is required');
        assert.ok(entry.accessibility.previewDescription?.trim(), 'Actual Dialog description is required');
        if (entry.accessibility.caption) {
          assert.ok(entry.accessibility.previewDescription.includes(entry.accessibility.caption));
        }
        assert.equal(entry.figureCapture.outcome, 'passed');
        assert.ok(['viewport-region', 'document-region'].includes(entry.figureCapture.kind));
        assert.deepEqual(entry.articleCapture.source, entry.image);
        assert.deepEqual(entry.previewCapture.source, entry.preview);
        assert.deepEqual(entry.articleCapture.dimensions, capture.viewport);
        assert.deepEqual(entry.previewCapture.dimensions, capture.viewport);
        assert.deepEqual(entry.figureCapture.dimensions, {
          width: entry.figureCapture.clip.width,
          height: entry.figureCapture.clip.height,
        });
        const captures = [entry.articleCapture, entry.figureCapture, entry.previewCapture];
        assert.deepEqual(entry.screenshots, captures.map((item) => item.file));
        for (const view of captures) await verifyScreenshot(view, id);
      }
    }
  }
  assert.equal(assets.size, expectedAssets, 'Unexpected assets');
  assert.equal(fonts.size, expectedFonts, 'Unexpected font probes');
  assert.equal(cases.size, expectedCases, 'Unexpected capture cases');
  return { figure: profile.figure, revision, cases: expectedCases, fontProbes: expectedFonts, screenshots: usedScreenshots.size };
}
