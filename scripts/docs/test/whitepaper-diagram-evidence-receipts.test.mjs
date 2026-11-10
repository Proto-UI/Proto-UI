import assert from 'node:assert/strict';
import test from 'node:test';
import { crc32, deflateSync } from 'node:zlib';
import {
  diagramProfiles,
  diagramLocale,
  diagramVariants,
  diagramEvidenceCases,
  diagramEvidenceId,
  selectDiagramProfile,
  selectDiagramVariant,
} from '../../../apps/www/scripts/whitepaper-diagram-evidence-profiles.mjs';
import {
  diagramPagePaths,
  diagramPngReceipt,
  diagramSha256,
  verifyDiagramReport,
} from '../../../apps/www/scripts/whitepaper-diagram-evidence-receipts.mjs';

const revision = 'a'.repeat(40);
const provenance = { head: revision, tree: 'b'.repeat(40), generated: {} };
const build = { file: 'build.json', sha256: 'c'.repeat(64), inventorySha256: 'd'.repeat(64), fileCount: 10 };
const pngs = new Map();
function png(width, height) {
  const key = `${width}/${height}`;
  if (pngs.has(key)) return pngs.get(key);
  const chunk = (type, data) => {
    const content = Buffer.concat([Buffer.from(type), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE(crc32(content));
    return Buffer.concat([length, content, checksum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const bytes = Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.alloc((width * 4 + 1) * height))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  pngs.set(key, bytes);
  return bytes;
}

// Deliberately constructed receipt fixtures exercise the checker. They are not
// browser renders and are never written into a product-evidence directory.
function fixture(figure = 'conditional-consistency') {
  const profile = selectDiagramProfile(figure);
  const sources = new Map();
  const screenshots = new Map();
  const report = {
    schemaVersion: 1,
    kind: 'proto-ui.whitepaper-diagram-capture',
    revision,
    figure,
    profile,
    provenance: structuredClone(provenance),
    completedProvenance: structuredClone(provenance),
    build: structuredClone(build),
    completedBuild: structuredClone(build),
    browser: 'checker-test-fixture',
    failures: [],
    pages: {},
    assets: [],
    fonts: [],
    cases: [],
  };
  for (const locale of ['en', 'zh-cn']) {
    const paths = diagramPagePaths(profile, locale);
    const source = Buffer.from(`fixture article ${locale}`);
    const built = Buffer.from(`fixture built article ${locale}`);
    sources.set(paths.sourcePath, source);
    sources.set(paths.builtPath, built);
    report.pages[locale] = { ...paths, sourceSha256: diagramSha256(source), builtSha256: diagramSha256(built) };
    for (const selected of diagramVariants(profile, locale)) {
      const bytes = Buffer.from(`fixture asset ${selected.asset}`);
      sources.set(`apps/www/public${selected.asset}`, bytes);
      sources.set(`apps/www/dist${selected.asset}`, bytes);
      const hash = diagramSha256(bytes);
      report.assets.push({ locale, ...selected, svgSha256: hash, sourceSha256: hash });
      for (const theme of ['light', 'dark']) {
        report.fonts.push({
          figure, revision, locale, theme, variant: selected.name, asset: selected.asset,
          svgSha256: hash, sourceSha256: hash, outcome: 'passed',
          minimumFontSize: 26, text: [{ text: 'fixture label', fontSize: 26 }],
        });
      }
    }
    for (const theme of ['light', 'dark']) {
      for (const capture of diagramEvidenceCases(profile)) {
        const selected = selectDiagramVariant(profile, locale, capture.viewport.width);
        const binding = report.assets.find((item) => item.locale === locale && item.name === selected.name);
        const id = diagramEvidenceId(profile, locale, theme, capture.viewport.width, revision, binding.svgSha256, capture.scenario);
        const measurement = {
          src: `http://127.0.0.1:4321${selected.asset}`,
          asset: selected.asset, variant: selected.name, svgSha256: binding.svgSha256,
          sourceSha256: binding.sourceSha256, complete: true, width: 120, height: 160,
          alt: 'fixture diagram', scheme: theme,
        };
        const receipt = (view, dimensions, source) => {
          const bytes = png(dimensions.width, dimensions.height);
          const file = `${id}-${view}.png`;
          screenshots.set(file, bytes);
          return { file, source, ...diagramPngReceipt(bytes) };
        };
        const entry = {
          id, figure, revision, locale, theme, asset: selected.asset, variant: selected.name,
          fallbackAsset: diagramLocale(profile, locale).asset, route: diagramLocale(profile, locale).route,
          viewport: capture.viewport, scenario: capture.scenario,
          ...(capture.initialViewport ? { initialViewport: capture.initialViewport } : {}),
          svgSha256: binding.svgSha256, sourceSha256: binding.sourceSha256,
          expectedDimensions: { width: selected.width, height: selected.height },
          outcome: 'passed', errors: [], image: { ...measurement }, preview: { ...measurement },
          accessibility: { triggerLabel: 'Enlarge image: ', previewDescription: 'Fixture description' },
        };
        entry.articleCapture = receipt('article', capture.viewport, entry.image);
        entry.figureCapture = {
          ...receipt('figure', { width: 120, height: 160 }, { ...measurement }),
          kind: 'viewport-region', outcome: 'passed', clip: { x: 0, y: 0, width: 120, height: 160 },
        };
        entry.previewCapture = receipt('preview', capture.viewport, entry.preview);
        entry.screenshots = [entry.articleCapture.file, entry.figureCapture.file, entry.previewCapture.file];
        report.cases.push(entry);
      }
    }
  }
  const from = (map) => async (key) => {
    assert.ok(map.has(key), `Missing fixture file: ${key}`);
    return map.get(key);
  };
  const options = { revision, provenance, build, readSource: from(sources), readScreenshot: from(screenshots) };
  return { profile, report, sources, screenshots, options, verify: () => verifyDiagramReport(profile, report, options) };
}

test('complete five-profile locale/theme/view matrices retain separate capture and acceptance meaning', async () => {
  const counts = [];
  for (const profile of diagramProfiles()) {
    const current = fixture(profile.figure);
    const result = await current.verify();
    counts.push(result.cases);
    assert.equal(result.screenshots, result.cases * 3);
    assert.equal(result.fontProbes, diagramVariants(profile, 'en').length * 4);
    assert.equal(Object.hasOwn(result, 'accepted'), false);
  }
  assert.deepEqual(counts, [8, 28, 8, 8, 8]);
});

test('omitted locale/theme/scenario cases and duplicated cases or font probes are rejected', async () => {
  for (const mutate of [
    (report) => { report.cases = report.cases.filter((entry) => entry.locale !== 'zh-cn'); },
    (report) => { report.cases.pop(); },
    (report) => { report.cases.push(report.cases[0]); },
    (report) => { report.fonts.push(report.fonts[0]); },
    (report) => { report.fonts.pop(); },
  ]) {
    const current = fixture('evolution-feedback');
    mutate(current.report);
    await assert.rejects(current.verify);
  }
});

test('old revisions, source changes during capture and failed probes cannot pass', async () => {
  for (const mutate of [
    (report) => { report.revision = 'c'.repeat(40); },
    (report) => { report.completedProvenance.tree = 'd'.repeat(40); },
    (report) => { report.build.inventorySha256 = 'e'.repeat(64); },
    (report) => { report.failures.push({ error: 'preserved failure' }); },
    (report) => { report.fonts[0].outcome = 'failed'; },
    (report) => { report.cases[0].outcome = 'running'; },
    (report) => { report.cases[0].preview.sourceSha256 = 'e'.repeat(64); },
    (report) => { report.cases[0].preview.src = 'https://example.com/unrelated.svg'; },
  ]) {
    const current = fixture();
    mutate(current.report);
    await assert.rejects(current.verify);
  }
});

test('article, built page and built asset bytes remain bound to the actual candidate', async () => {
  for (const selectPath of [
    (current) => current.report.pages.en.sourcePath,
    (current) => current.report.pages.en.builtPath,
    (current) => `apps/www/dist${current.report.assets[0].asset}`,
    (current) => `apps/www/public${current.report.assets[0].asset}`,
  ]) {
    const current = fixture();
    current.sources.set(selectPath(current), Buffer.from('changed bytes'));
    await assert.rejects(current.verify);
  }
});

test('missing, replaced and wrong-sized screenshots are rejected independently of passing case labels', async () => {
  const missing = fixture();
  missing.screenshots.delete(missing.report.cases[0].previewCapture.file);
  await assert.rejects(missing.verify, /Missing fixture file/);
  const replaced = fixture();
  replaced.screenshots.set(replaced.report.cases[0].articleCapture.file, png(1, 1));
  await assert.rejects(replaced.verify, /dimensions/);
  const changed = fixture();
  const filename = changed.report.cases[0].figureCapture.file;
  const bytes = Buffer.from(changed.screenshots.get(filename));
  bytes[bytes.length - 20] ^= 1;
  changed.screenshots.set(filename, bytes);
  await assert.rejects(changed.verify, /Screenshot bytes changed/);
});

test('screenshot references cannot escape the capture directory or borrow another view', async () => {
  const outside = fixture();
  outside.report.cases[0].articleCapture.file = '../../outside.png';
  outside.report.cases[0].screenshots[0] = '../../outside.png';
  await assert.rejects(outside.verify, /basename/);
  const borrowed = fixture();
  borrowed.report.cases[0].previewCapture = borrowed.report.cases[0].articleCapture;
  borrowed.report.cases[0].screenshots[2] = borrowed.report.cases[0].articleCapture.file;
  await assert.rejects(borrowed.verify, /own screenshot/);
});

test('PNG receipts reject truncation and invalid headers instead of trusting filenames', () => {
  const bytes = png(2, 3);
  assert.deepEqual(diagramPngReceipt(bytes).dimensions, { width: 2, height: 3 });
  assert.throws(() => diagramPngReceipt(bytes.subarray(0, -1)), /PNG end/);
  const invalid = Buffer.from(bytes);
  invalid[0] = 0;
  assert.throws(() => diagramPngReceipt(invalid), /PNG signature/);
});
