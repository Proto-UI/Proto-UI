import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';
import test from 'node:test';
import { collectDiagramInventory } from '../../../apps/www/scripts/whitepaper-diagram-inventory.mjs';
import { diagramProfiles } from '../../../apps/www/scripts/whitepaper-diagram-evidence-profiles.mjs';
import {
  diagramPngReceipt,
  diagramSha256,
} from '../../../apps/www/scripts/whitepaper-diagram-evidence-receipts.mjs';
import {
  authoredDiagramCapturePlan,
  authoredSvgDimensions,
  verifyAuthoredDiagramReport,
} from '../../../apps/www/scripts/capture-authored-diagram-evidence.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const revision = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD']).toString().trim();
const inventory = collectDiagramInventory(root, revision);
const plan = authoredDiagramCapturePlan(inventory);

test('all six authored exports and eight canonical references receive both viewport/theme captures', () => {
  assert.equal(new Set(plan.map((entry) => entry.asset)).size, 6);
  assert.equal(new Set(plan.map((entry) => entry.pageSourcePath)).size, 8);
  assert.equal(plan.length, 32);
  assert.deepEqual([...new Set(plan.map((entry) => entry.locale))].sort(), ['en', 'zh-cn']);
  assert.deepEqual([...new Set(plan.map((entry) => entry.viewport.width))].sort(), [1440, 390]);
  assert.equal(diagramProfiles().length, 5, 'No active SVG-document profile was added');
  for (const entry of plan) {
    assert.ok(entry.id.length + '-article.png'.length <= 255);
    assert.ok(
      readFileSync(root + entry.pageSourcePath, 'utf8')
        .split('\n')
        [entry.referenceLine - 1].includes(entry.asset)
    );
  }
});

test('authored intrinsic dimensions are read from their actual retained SVG viewBoxes', () => {
  for (const asset of inventory.assets.filter((entry) => entry.kind === 'authored-export')) {
    const dimensions = authoredSvgDimensions(readFileSync(root + asset.asset));
    assert.ok(dimensions.width > 700 && dimensions.height > 400);
  }
  assert.throws(() => authoredSvgDimensions('<svg/>'));
  assert.throws(() => authoredSvgDimensions('<svg viewBox="0 0 0 10"/>'));
});

const pngs = new Map();
function png(width, height) {
  const key = `${width}/${height}`;
  if (pngs.has(key)) return pngs.get(key);
  const chunk = (type, data) => {
    const content = Buffer.concat([Buffer.from(type), data]);
    const length = Buffer.alloc(4),
      checksum = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
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

// Synthetic in-memory checker fixtures, never browser evidence or product PNGs.
function fixture() {
  const provenance = { head: revision },
    build = { sha256: 'a'.repeat(64) };
  const sources = new Map(),
    screenshots = new Map();
  const report = {
    kind: 'proto-ui.authored-diagram-capture',
    revision,
    provenance,
    completedProvenance: provenance,
    build,
    completedBuild: build,
    visualReview: 'pending',
    browser: 'synthetic-checker-fixture',
    failures: [],
    assets: {},
    pages: {},
    cases: [],
  };
  for (const asset of inventory.assets.filter((entry) => entry.kind === 'authored-export')) {
    const bytes = readFileSync(root + asset.asset),
      url = asset.asset.replace('apps/www/public', '');
    sources.set(asset.asset, bytes);
    sources.set(`apps/www/dist${url}`, bytes);
    report.assets[url] = {
      sourceSha256: asset.sha256,
      builtSha256: asset.sha256,
      ...authoredSvgDimensions(bytes),
    };
  }
  for (const entry of plan) {
    const built = Buffer.from('synthetic built page ' + entry.route);
    sources.set(entry.pageSourcePath, readFileSync(root + entry.pageSourcePath));
    sources.set(`apps/www/dist${entry.route}index.html`, built);
    report.pages[entry.route] = {
      sourcePath: entry.pageSourcePath,
      sourceSha256: entry.pageSourceSha256,
      builtSha256: diagramSha256(built),
    };
    const dimensions = report.assets[entry.asset];
    const image = {
      src: 'http://127.0.0.1:1234' + entry.asset,
      complete: true,
      naturalWidth: dimensions.width,
      naturalHeight: dimensions.height,
      width: 100,
      height: (100 * dimensions.height) / dimensions.width,
      alt: 'Fixture description',
      document: { horizontalOverflow: false },
      style: { display: 'block', visibility: 'visible', opacity: '1', colorScheme: entry.theme },
      inViewportHorizontally: true,
      visibleViewportArea: 100,
      viewport: entry.viewport,
      headerOverlap: [],
    };
    image.documentImage = { x: 0, y: 200, width: image.width, height: image.height };
    const clip = { x: 0, y: 200, width: 100, height: Math.ceil(image.height) };
    const articleFile = `${entry.id}-article.png`,
      figureFile = `${entry.id}-figure.png`;
    screenshots.set(articleFile, png(entry.viewport.width, entry.viewport.height));
    screenshots.set(figureFile, png(clip.width, clip.height));
    report.cases.push({
      ...entry,
      outcome: 'captured',
      errors: [],
      image,
      articleCapture: {
        file: articleFile,
        source: image,
        ...diagramPngReceipt(screenshots.get(articleFile)),
      },
      figureCapture: {
        file: figureFile,
        source: image,
        after: image,
        clip,
        ...diagramPngReceipt(screenshots.get(figureFile)),
      },
    });
  }
  return {
    report,
    options: {
      inventory,
      provenance,
      build,
      readSource: async (file) => sources.get(file),
      readScreenshot: async (file) => screenshots.get(file),
    },
    sources,
  };
}

test('complete byte-bound capture receipts stay pending visual review', async () => {
  const f = fixture();
  assert.deepEqual(await verifyAuthoredDiagramReport(f.report, f.options), {
    cases: 32,
    screenshots: 64,
    visualReview: 'pending',
  });
});

test('missing, failed, hidden, cropped, stale or changed-byte evidence cannot pass the checker', async () => {
  for (const mutate of [
    (f) => f.report.cases.pop(),
    (f) => {
      f.report.cases[0].outcome = 'failed';
    },
    (f) => {
      f.report.cases[0].image.alt = '';
    },
    (f) => {
      f.report.cases[0].image.style.visibility = 'hidden';
    },
    (f) => {
      f.report.cases[0].figureCapture.clip.width = 1;
    },
    (f) => {
      f.report.completedProvenance = { head: '0'.repeat(40) };
    },
    (f) => {
      f.report.cases[0].articleCapture.screenshotSha256 = '0'.repeat(64);
    },
    (f) => {
      f.sources.set('apps/www/dist' + plan[0].asset, Buffer.from('changed SVG'));
    },
  ]) {
    const f = fixture();
    mutate(f);
    await assert.rejects(verifyAuthoredDiagramReport(f.report, f.options));
  }
});
