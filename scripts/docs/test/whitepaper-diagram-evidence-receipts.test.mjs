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
  diagramContainLimitations,
  diagramPagePaths,
  diagramPngReceipt,
  diagramSha256,
  verifyDiagramReport,
} from '../../../apps/www/scripts/whitepaper-diagram-evidence-receipts.mjs';

const revision = 'a'.repeat(40);
const provenance = { head: revision, tree: 'b'.repeat(40), generated: {} };
const build = {
  file: 'build.json',
  sha256: 'c'.repeat(64),
  inventorySha256: 'd'.repeat(64),
  fileCount: 10,
};
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
    report.pages[locale] = {
      ...paths,
      sourceSha256: diagramSha256(source),
      builtSha256: diagramSha256(built),
    };
    for (const selected of diagramVariants(profile, locale)) {
      const bytes = Buffer.from(`fixture asset ${selected.asset}`);
      sources.set(`apps/www/public${selected.asset}`, bytes);
      sources.set(`apps/www/dist${selected.asset}`, bytes);
      const hash = diagramSha256(bytes);
      report.assets.push({ locale, ...selected, svgSha256: hash, sourceSha256: hash });
      for (const theme of ['light', 'dark']) {
        const fontElements =
          figure === 'information-flow-model'
            ? [
                ...['event', 'feedback', 'props', 'expose', 'context'].map((text) => ({
                  text,
                  classes: ['channel-label'],
                  family: 'ui-monospace, monospace',
                })),
                { text: 'User', classes: ['actor-label'], family: 'ui-sans-serif, sans-serif' },
              ]
            : [{ text: 'fixture label', classes: [], family: 'ui-sans-serif, sans-serif' }];
        report.fonts.push({
          figure,
          revision,
          locale,
          theme,
          variant: selected.name,
          asset: selected.asset,
          svgSha256: hash,
          sourceSha256: hash,
          outcome: 'passed',
          minimumFontSize: 26,
          text: [{ text: 'fixture label', fontSize: 26 }],
          fontElements,
          families: fontElements.map((element) => element.family),
          faces:
            profile.fonts === 'embedded-handwritten'
              ? [
                  { family: 'Proto Diagram Hand Latin', status: 'loaded' },
                  ...(locale === 'zh-cn'
                    ? [{ family: 'Proto Diagram Hand CJK', status: 'loaded' }]
                    : []),
                ]
              : [],
        });
      }
    }
    for (const theme of ['light', 'dark']) {
      for (const capture of diagramEvidenceCases(profile)) {
        const selected = selectDiagramVariant(profile, locale, capture.viewport.width);
        const binding = report.assets.find(
          (item) => item.locale === locale && item.name === selected.name
        );
        const id = diagramEvidenceId(
          profile,
          locale,
          theme,
          capture.viewport.width,
          revision,
          binding.svgSha256,
          capture.scenario
        );
        const measurement = {
          src: `http://127.0.0.1:4321${selected.asset}`,
          asset: selected.asset,
          variant: selected.name,
          svgSha256: binding.svgSha256,
          sourceSha256: binding.sourceSha256,
          complete: true,
          width: 120,
          height: 160,
          alt: 'fixture diagram',
          scheme: theme,
        };
        const receipt = (view, dimensions, source) => {
          const bytes = png(dimensions.width, dimensions.height);
          const file = `${id}-${view}.png`;
          screenshots.set(file, bytes);
          return { file, source, ...diagramPngReceipt(bytes) };
        };
        const entry = {
          id,
          figure,
          revision,
          locale,
          theme,
          asset: selected.asset,
          variant: selected.name,
          fallbackAsset: diagramLocale(profile, locale).asset,
          route: diagramLocale(profile, locale).route,
          viewport: capture.viewport,
          scenario: capture.scenario,
          ...(capture.initialViewport ? { initialViewport: capture.initialViewport } : {}),
          svgSha256: binding.svgSha256,
          sourceSha256: binding.sourceSha256,
          expectedDimensions: { width: selected.width, height: selected.height },
          outcome: 'passed',
          errors: [],
          image: { ...measurement },
          preview: { ...measurement },
          accessibility: {
            triggerLabel: 'Enlarge image: ',
            previewDescription: 'Fixture description',
          },
        };
        const fitWidth = Math.min(
          capture.viewport.width - 32,
          ((capture.viewport.height - 80) * selected.width) / selected.height
        );
        entry.preview = {
          ...measurement,
          x: 16,
          y: 64,
          width: fitWidth,
          height: (fitWidth * selected.height) / selected.width,
        };
        const readingWidth = Math.max(640, selected.width);
        const readingImage = {
          ...measurement,
          x: 16,
          y: 64,
          width: readingWidth,
          height: (readingWidth * selected.height) / selected.width,
          minimumRenderedFontSize: (26 * readingWidth) / selected.width,
        };
        const region = {
          x: 16,
          y: 64,
          width: capture.viewport.width - 32,
          height: capture.viewport.height - 80,
          clientWidth: capture.viewport.width - 32,
          clientHeight: capture.viewport.height - 80,
          scrollWidth: Math.ceil(Math.max(capture.viewport.width - 32, readingImage.width)),
          scrollHeight: Math.ceil(Math.max(capture.viewport.height - 80, readingImage.height)),
          scrollLeft: 0,
          scrollTop: 0,
          mode: 'reading',
          role: 'region',
          label: 'Illustration, scroll horizontally and vertically',
          tabIndex: 0,
          overflowX: 'auto',
          overflowY: 'auto',
        };
        const ranges = {
          x: region.scrollWidth - region.clientWidth,
          y: region.scrollHeight - region.clientHeight,
        };
        const axes = ['x', 'y'].filter((axis) => ranges[axis] > 1);
        region.tabIndex = axes.length ? 0 : -1;
        const wheel = [];
        const keyboard = [];
        let position = { x: 0, y: 0 };
        for (const axis of axes) {
          const before = { ...position };
          position[axis] = ranges[axis];
          wheel.push({ axis, before, after: { ...position } });
        }
        for (const axis of axes) {
          const before = { ...position };
          position[axis] = Math.max(0, position[axis] - 40);
          keyboard.push({
            axis,
            key: axis === 'x' ? 'ArrowLeft' : 'ArrowUp',
            before,
            after: { ...position },
          });
        }
        const reading = {
          outcome: 'passed',
          image: readingImage,
          viewport: region,
          zoomClicks: 0,
          wheel,
          keyboard,
          backgroundBefore: { x: 0, y: 400 },
          backgroundAfter: { x: 0, y: 400 },
          fit: entry.preview,
          fitViewport: {
            ...region,
            mode: 'fit',
            tabIndex: -1,
            x: entry.preview.x,
            y: entry.preview.y,
            width: entry.preview.width,
            height: entry.preview.height,
            clientWidth: Math.round(entry.preview.width),
            clientHeight: Math.round(entry.preview.height),
            scrollWidth: Math.round(entry.preview.width),
            scrollHeight: Math.round(entry.preview.height),
            scrollLeft: 0,
            scrollTop: 0,
          },
        };
        const responsive = diagramVariants(profile, locale).some(
          (variant) => variant.name === 'mobile'
        );
        const phases = responsive
          ? ['repeated-open-dismiss', 'after-back', 'after-forward-back']
          : [];
        entry.readingPreviews = [reading, ...phases.map(() => structuredClone(reading))];
        if (responsive)
          entry.interactions = phases.map((phase, index) => ({
            phase,
            article: { ...measurement },
            preview: entry.readingPreviews[index + 1].fit,
            dismissed: true,
          }));
        entry.articleCapture = receipt('article', capture.viewport, entry.image);
        entry.figureCapture = {
          ...receipt('figure', { width: 120, height: 160 }, { ...measurement }),
          kind: 'viewport-region',
          outcome: 'passed',
          clip: { x: 0, y: 0, width: 120, height: 160 },
        };
        entry.readingCapture = receipt('reading', capture.viewport, readingImage);
        if (axes.length)
          entry.readingEndCapture = receipt('reading-end', capture.viewport, {
            ...readingImage,
            x: readingImage.x - ranges.x,
            y: readingImage.y - ranges.y,
          });
        entry.previewCapture = receipt('preview', capture.viewport, entry.preview);
        entry.screenshots = [
          entry.articleCapture.file,
          entry.figureCapture.file,
          entry.readingCapture.file,
          ...(entry.readingEndCapture ? [entry.readingEndCapture.file] : []),
          entry.previewCapture.file,
        ];
        report.cases.push(entry);
      }
    }
  }
  const from = (map) => async (key) => {
    assert.ok(map.has(key), `Missing fixture file: ${key}`);
    return map.get(key);
  };
  const options = {
    revision,
    provenance,
    build,
    readSource: from(sources),
    readScreenshot: from(screenshots),
  };
  return {
    profile,
    report,
    sources,
    screenshots,
    options,
    verify: () => verifyDiagramReport(profile, report, options),
  };
}

// A separate synthetic v2 fixture, never a converted published v1 report.
// It models contain only and deliberately preserves actual sub-16px font sizes.
function containFixture(figure = 'conditional-consistency') {
  const current = fixture(figure);
  Object.assign(current.report, {
    schemaVersion: 2,
    presentation: 'source-contain',
    readingAcceptance: 'not-assessed',
    motionMode: 'reduced',
    limitations: [...diagramContainLimitations],
  });
  for (const entry of current.report.cases) {
    const selected = selectDiagramVariant(current.profile, entry.locale, entry.viewport.width);
    const source = {
      ...entry.image,
      x: 16,
      y: 64,
      width: 120,
      height: (120 * selected.height) / selected.width,
      minimumRenderedFontSize: (26 * 120) / selected.width,
    };
    const image = {
      ...entry.preview,
      minimumRenderedFontSize: (26 * entry.preview.width) / selected.width,
    };
    const contained = {
      outcome: 'passed',
      presentation: 'source-contain',
      source,
      image,
      dialog: {
        x: image.x,
        y: image.y,
        width: image.width,
        height: image.height,
        role: 'dialog',
        modal: 'true',
        phase: 'entered',
        returnMode: 'origin',
        toolbarCount: 0,
        zoomControlCount: 0,
        readingViewportCount: 0,
        closeCount: 1,
        closeClip: 'inset(50%)',
        style: {
          border: '0px',
          padding: '0px',
          radius: '0px',
          shadow: 'none',
          background: 'rgba(0, 0, 0, 0)',
        },
        scroll: { x: 0, y: 0, maxX: 0, maxY: 0 },
      },
      dismissal: {
        input: 'Escape',
        closed: true,
        focusReturned: true,
        originHidden: false,
        sourceOpacity: 1,
        source: structuredClone(source),
      },
    };
    entry.containedPreviews = entry.readingPreviews.map(() => structuredClone(contained));
    entry.image = structuredClone(source);
    entry.preview = entry.containedPreviews[0].image;
    entry.articleCapture.source = entry.image;
    const figureSize = { width: 120, height: Math.ceil(source.height) };
    const figureBytes = png(figureSize.width, figureSize.height);
    current.screenshots.set(entry.figureCapture.file, figureBytes);
    Object.assign(entry.figureCapture, {
      source: structuredClone(source),
      kind: 'document-region',
      clip: { x: 0, y: 0, ...figureSize },
      ...diagramPngReceipt(figureBytes),
    });
    entry.previewCapture.source = entry.preview;
    entry.previewCapture.after = structuredClone(entry.preview);
    for (const [index, interaction] of (entry.interactions ?? []).entries()) {
      interaction.article = structuredClone(source);
      interaction.preview = entry.containedPreviews[index + 1].image;
    }
    current.screenshots.delete(entry.readingCapture.file);
    if (entry.readingEndCapture) current.screenshots.delete(entry.readingEndCapture.file);
    delete entry.readingPreviews;
    delete entry.readingCapture;
    delete entry.readingEndCapture;
    entry.screenshots = [
      entry.articleCapture.file,
      entry.figureCapture.file,
      entry.previewCapture.file,
    ];
  }
  return current;
}

test('complete five-profile locale/theme/view matrices retain separate capture and acceptance meaning', async () => {
  const counts = [];
  for (const profile of diagramProfiles()) {
    const current = fixture(profile.figure);
    const result = await current.verify();
    counts.push(result.cases);
    assert.equal(
      result.screenshots,
      current.report.cases.reduce((total, entry) => total + (entry.readingEndCapture ? 5 : 4), 0)
    );
    assert.equal(result.fontProbes, diagramVariants(profile, 'en').length * 4);
    assert.equal(Object.hasOwn(result, 'accepted'), false);
  }
  assert.deepEqual(counts, [28, 28, 28, 28, 8]);
});

test('font-role readback rejects wrong families, missing roles, changed channel labels and embedded system faces', async () => {
  for (const mutate of [
    (font) => {
      font.fontElements[0].family = 'ui-sans-serif, sans-serif';
    },
    (font) => {
      font.fontElements.at(-1).family = 'ui-monospace, monospace';
    },
    (font) => {
      font.fontElements[0].classes = [];
    },
    (font) => {
      font.fontElements[0].classes = ['unreviewed-label'];
    },
    (font) => {
      font.fontElements[0].classes.push('actor-label');
    },
    (font) => {
      font.fontElements[0].text = 'state';
    },
    (font) => {
      font.fontElements.pop();
    },
    (font) => {
      font.fontElements.splice(0, 1);
    },
    (font) => {
      font.fontElements[0].family = 'fake-monospace';
    },
    (font) => {
      font.faces.push({ family: 'Remote Face', status: 'loaded' });
    },
  ]) {
    const current = fixture('information-flow-model');
    const font = current.report.fonts[0];
    mutate(font);
    font.families = font.fontElements.map((element) => element.family);
    await assert.rejects(current.verify);
  }
});

test('other system figures remain sans-only and retain complete font measurement bindings', async () => {
  for (const figure of ['component-anatomy', 'conditional-consistency', 'evolution-feedback']) {
    for (const mutate of [
      (font) => {
        font.fontElements[0].family = 'ui-monospace, monospace';
        font.families = font.fontElements.map((element) => element.family);
      },
      (font) => {
        delete font.fontElements;
      },
      (font) => {
        font.families = [];
      },
      (font) => {
        font.fontElements[0].family = 'fake-sans-serif';
        font.families = font.fontElements.map((element) => element.family);
      },
    ]) {
      const current = fixture(figure);
      mutate(current.report.fonts[0]);
      await assert.rejects(current.verify);
    }
  }
});

test('omitted locale/theme/scenario cases and duplicated cases or font probes are rejected', async () => {
  for (const mutate of [
    (report) => {
      report.cases = report.cases.filter((entry) => entry.locale !== 'zh-cn');
    },
    (report) => {
      report.cases.pop();
    },
    (report) => {
      report.cases.push(report.cases[0]);
    },
    (report) => {
      report.fonts.push(report.fonts[0]);
    },
    (report) => {
      report.fonts.pop();
    },
  ]) {
    const current = fixture('evolution-feedback');
    mutate(current.report);
    await assert.rejects(current.verify);
  }
});

test('old revisions, source changes during capture and failed probes cannot pass', async () => {
  for (const mutate of [
    (report) => {
      report.revision = 'c'.repeat(40);
    },
    (report) => {
      report.completedProvenance.tree = 'd'.repeat(40);
    },
    (report) => {
      report.build.inventorySha256 = 'e'.repeat(64);
    },
    (report) => {
      report.failures.push({ error: 'preserved failure' });
    },
    (report) => {
      report.fonts[0].outcome = 'failed';
    },
    (report) => {
      report.cases[0].outcome = 'running';
    },
    (report) => {
      report.cases[0].preview.sourceSha256 = 'e'.repeat(64);
    },
    (report) => {
      report.cases[0].preview.src = 'https://example.com/unrelated.svg';
    },
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
  borrowed.report.cases[0].previewCapture = {
    ...borrowed.report.cases[0].articleCapture,
    source: borrowed.report.cases[0].preview,
  };
  borrowed.report.cases[0].screenshots[borrowed.report.cases[0].screenshots.length - 1] =
    borrowed.report.cases[0].articleCapture.file;
  await assert.rejects(borrowed.verify, /own screenshot/);
});

test('reading acceptance rejects clipped viewports, tiny text, invented movement and missing phases', async () => {
  const controls = [
    (entry) => {
      delete entry.readingPreviews;
    },
    (entry) => {
      entry.readingPreviews[0].viewport.width = entry.viewport.width + 1;
    },
    (entry) => {
      entry.readingPreviews[0].image.minimumRenderedFontSize = 999;
    },
    (entry) => {
      entry.readingPreviews[0].viewport.scrollWidth = 1;
    },
    (entry) => {
      entry.readingPreviews[0].wheel = [];
    },
    (entry) => {
      entry.readingPreviews[0].keyboard = [];
    },
    (entry) => {
      const sample = entry.readingPreviews[0].wheel[0];
      sample.after = { ...sample.before };
    },
    (entry) => {
      const sample = entry.readingPreviews[0].keyboard[0];
      sample.after = { ...sample.before };
    },
    (entry) => {
      entry.readingPreviews[0].backgroundAfter.y += 1;
    },
    (entry) => {
      entry.readingPreviews[0].fitViewport.mode = 'reading';
    },
    (entry) => {
      entry.readingPreviews[0].fit.width = entry.viewport.width + 100;
    },
    (entry) => {
      delete entry.readingCapture;
    },
    (entry) => {
      delete entry.readingEndCapture;
    },
    (entry) => {
      entry.readingEndCapture.source.x = 100000;
    },
    (entry) => {
      entry.interactions.pop();
    },
    (entry) => {
      entry.readingPreviews.pop();
    },
  ];
  for (const mutate of controls) {
    const current = fixture('evolution-feedback');
    const entry = current.report.cases.find((sample) => sample.viewport.width === 390);
    mutate(entry);
    await assert.rejects(current.verify);
  }
});

test('reading checks reject actual tiny text, stale focus participation and a clipped Fit scrollport', async () => {
  const controls = [
    {
      name: 'font size derived from a genuinely undersized image',
      diagnostic: /16 CSS px target/,
      mutate(entry) {
        const reading = entry.readingPreviews[0];
        reading.image.width = (entry.expectedDimensions.width * 15) / 26;
        reading.image.height = (entry.expectedDimensions.height * 15) / 26;
        reading.image.minimumRenderedFontSize = 15;
        const port = reading.viewport;
        port.scrollWidth = Math.ceil(Math.max(port.clientWidth, reading.image.width));
        port.scrollHeight = Math.ceil(Math.max(port.clientHeight, reading.image.height));
        port.tabIndex =
          port.scrollWidth > port.clientWidth + 1 || port.scrollHeight > port.clientHeight + 1
            ? 0
            : -1;
      },
    },
    {
      name: 'a reading viewport without scroll range remains in sequential focus',
      diagnostic: /actual scroll range participates/,
      mutate(entry) {
        const port = entry.readingPreviews[0].viewport;
        port.scrollWidth = port.clientWidth;
        port.scrollHeight = port.clientHeight;
        port.tabIndex = 0;
      },
    },
    {
      name: 'Fit image is inside the window but clipped by its own scrollport',
      diagnostic: /complete inside its own native scrollport/,
      mutate(entry) {
        const port = entry.readingPreviews[0].fitViewport;
        port.clientHeight -= 10;
        port.scrollHeight = port.clientHeight;
      },
    },
    {
      name: 'Fit scrollport retains a horizontal scroll range',
      diagnostic: /complete inside its own native scrollport/,
      mutate(entry) {
        const port = entry.readingPreviews[0].fitViewport;
        port.scrollWidth = port.clientWidth + 10;
      },
    },
    {
      name: 'Fit scrollport retains a vertical scroll range',
      diagnostic: /complete inside its own native scrollport/,
      mutate(entry) {
        const port = entry.readingPreviews[0].fitViewport;
        port.scrollHeight = port.clientHeight + 10;
      },
    },
  ];
  for (const control of controls) {
    const current = fixture('evolution-feedback');
    const entry = current.report.cases.find((sample) => sample.viewport.width === 390);
    control.mutate(entry);
    await assert.rejects(current.verify, control.diagnostic, control.name);
  }
});

test('PNG receipts reject truncation and invalid headers instead of trusting filenames', () => {
  const bytes = png(2, 3);
  assert.deepEqual(diagramPngReceipt(bytes).dimensions, { width: 2, height: 3 });
  assert.throws(() => diagramPngReceipt(bytes.subarray(0, -1)), /PNG end/);
  const invalid = Buffer.from(bytes);
  invalid[0] = 0;
  assert.throws(() => diagramPngReceipt(invalid), /PNG signature/);
});

test('v2 contain receipts retain all profiles and low measured fonts without a reading acceptance claim', async () => {
  const counts = [];
  let measuredSmallText = false;
  for (const profile of diagramProfiles()) {
    const current = containFixture(profile.figure);
    const result = await current.verify();
    counts.push(result.cases);
    assert.equal(result.schemaVersion, 2);
    assert.equal(result.presentation, 'source-contain');
    assert.equal(result.readingAcceptance, 'not-assessed');
    assert.equal(result.motionMode, 'reduced');
    assert.deepEqual(result.limitations, diagramContainLimitations);
    assert.equal(result.screenshots, current.report.cases.length * 3);
    assert.equal(result.fontProbes, diagramVariants(profile, 'en').length * 4);
    assert.equal(Object.hasOwn(result, 'accepted'), false);
    measuredSmallText ||= current.report.cases.some(
      (entry) => entry.preview.minimumRenderedFontSize < 16
    );
  }
  assert.deepEqual(counts, [28, 28, 28, 28, 8]);
  assert.equal(measuredSmallText, true, 'The overview must not invent a 16px reading result');
});

test('v2 refuses unknown scope, legacy relabeling and missing or contaminated contain evidence', async () => {
  for (const mutate of [
    (report) => {
      report.schemaVersion = 3;
    },
    (report) => {
      report.schemaVersion = 1;
    },
    (report) => {
      report.presentation = 'reading';
    },
    (report) => {
      report.readingAcceptance = 'passed';
    },
    (report) => {
      report.motionMode = 'full';
    },
    (report) => {
      report.limitations = [];
    },
    (report) => {
      report.cases[0].readingPreviews = [];
    },
    (report) => {
      report.cases[0].readingCapture = report.cases[0].previewCapture;
    },
    (report) => {
      delete report.cases[0].containedPreviews;
    },
    (report) => {
      report.cases[0].containedPreviews.pop();
    },
    (report) => {
      report.cases[0].interactions.pop();
    },
  ]) {
    const current = containFixture();
    mutate(current.report);
    await assert.rejects(current.verify);
  }
  const legacy = fixture();
  Object.assign(legacy.report, {
    schemaVersion: 2,
    presentation: 'source-contain',
    readingAcceptance: 'not-assessed',
    motionMode: 'reduced',
    limitations: [...diagramContainLimitations],
  });
  await assert.rejects(legacy.verify, /relabel reading evidence/);
});

test('v2 rejects toolbar, clipped geometry, fabricated font sizes and failed source restoration', async () => {
  for (const mutate of [
    (sample) => {
      sample.outcome = 'failed';
    },
    (sample) => {
      sample.dialog.toolbarCount = 1;
    },
    (sample) => {
      sample.dialog.zoomControlCount = 3;
    },
    (sample) => {
      sample.dialog.readingViewportCount = 1;
    },
    (sample) => {
      sample.dialog.closeCount = 0;
    },
    (sample) => {
      sample.dialog.closeClip = 'none';
    },
    (sample) => {
      sample.dialog.returnMode = 'fade';
    },
    (sample) => {
      sample.dialog.style.padding = '8px';
    },
    (sample) => {
      sample.dialog.scroll.maxY = 50;
    },
    (sample) => {
      sample.image.x = -20;
    },
    (sample) => {
      sample.image.height *= 2;
    },
    (sample) => {
      sample.source.y = -100000;
    },
    (sample) => {
      sample.image.minimumRenderedFontSize = 999;
    },
    (sample) => {
      sample.image.alt = 'Replacement meaning';
    },
    (sample) => {
      sample.dismissal.focusReturned = false;
    },
    (sample) => {
      sample.dismissal.originHidden = true;
    },
    (sample) => {
      sample.dismissal.sourceOpacity = 0;
    },
    (sample) => {
      sample.dismissal.source.src = 'http://127.0.0.1:4321/unrelated.svg';
    },
  ]) {
    const current = containFixture();
    mutate(current.report.cases[0].containedPreviews[0]);
    await assert.rejects(current.verify);
  }
});

test('v2 still binds every SVG, current source, production build and PNG including its post-capture geometry', async () => {
  for (const mutate of [
    (current) => {
      current.report.completedProvenance.tree = 'e'.repeat(40);
    },
    (current) => {
      current.report.build.inventorySha256 = 'e'.repeat(64);
    },
    (current) => {
      current.report.cases[0].containedPreviews[0].source.sourceSha256 = 'e'.repeat(64);
    },
    (current) => {
      current.report.cases[0].previewCapture.after.x += 1;
    },
    (current) => {
      current.report.cases[0].previewCapture.screenshotSha256 = 'e'.repeat(64);
    },
    (current) => {
      current.screenshots.delete(current.report.cases[0].previewCapture.file);
    },
    (current) => {
      current.sources.set(current.report.pages.en.sourcePath, Buffer.from('changed article'));
    },
  ]) {
    const current = containFixture();
    mutate(current);
    await assert.rejects(current.verify);
  }
});
