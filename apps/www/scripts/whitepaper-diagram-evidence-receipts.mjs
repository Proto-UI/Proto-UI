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

export const diagramContainLimitations = Object.freeze([
  'Contain is a whole-image overview. Tall diagrams may have small text; measured font sizes do not establish reading-size or text-legibility acceptance.',
  'This capture uses reduced motion. Source-to-contain and return animation frames require separate native motion evidence.',
]);

// Shared by the actual SVG probe and receipt readback. A passing outcome label
// cannot replace the measured font families, authored roles or loaded faces.
export function verifyDiagramFonts(profile, evidence, locale) {
  diagramLocale(profile, locale);
  assert.ok(Array.isArray(evidence.faces), 'Measured font faces are required');
  if (profile.fonts === 'embedded-handwritten') {
    assert.ok(
      evidence.faces.some((face) => face.family.includes('Hand Latin') && face.status === 'loaded')
    );
    if (locale === 'zh-cn')
      assert.ok(
        evidence.faces.some((face) => face.family.includes('Hand CJK') && face.status === 'loaded')
      );
    return;
  }
  assert.equal(profile.fonts, 'system');
  assert.equal(evidence.faces.length, 0, 'System-font diagram must not load embedded faces');
  assert.ok(
    Array.isArray(evidence.fontElements) && evidence.fontElements.length > 0,
    'Inspect actual system-font text'
  );
  assert.deepEqual(
    evidence.families,
    evidence.fontElements.map((element) => element.family),
    'Font family measurements must bind every text element'
  );
  const roles = profile.systemFontRoles || [{ genericFamily: 'sans-serif' }];
  const assignments = roles.map(() => []);
  for (const element of evidence.fontElements) {
    assert.ok(typeof element.text === 'string' && element.text.trim());
    assert.ok(
      Array.isArray(element.classes) &&
        element.classes.every((name) => typeof name === 'string' && name.length > 0)
    );
    assert.ok(typeof element.family === 'string' && element.family.trim());
    const matches = roles.flatMap((role, index) =>
      !role.classes || role.classes.some((name) => element.classes.includes(name)) ? [index] : []
    );
    assert.equal(matches.length, 1, `Exactly one authored font role is required: ${element.text}`);
    const index = matches[0];
    assert.equal(
      element.family.split(',').at(-1).trim(),
      roles[index].genericFamily,
      `Unexpected system font for ${element.text}`
    );
    assignments[index].push(element.text.trim());
  }
  for (const [index, role] of roles.entries()) {
    assert.ok(assignments[index].length > 0, 'Every authored font role must be measured');
    if (role.labels)
      assert.deepEqual(
        [...assignments[index]].sort(),
        [...role.labels].sort(),
        'Measure each declared information channel exactly once'
      );
  }
}

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

function verifyReadingPreview(reading, viewport, minimumFontSize, selected) {
  assert.equal(reading.outcome, 'passed');
  const region = reading.viewport;
  const image = reading.image;
  assert.ok(region && image, 'Reading image and viewport measurements are required');
  for (const key of [
    'x',
    'y',
    'width',
    'height',
    'clientWidth',
    'clientHeight',
    'scrollWidth',
    'scrollHeight',
    'scrollLeft',
    'scrollTop',
  ])
    assert.ok(Number.isFinite(region[key]), `Finite reading viewport ${key}`);
  assert.ok(
    region.width > 0 && region.height > 0 && region.clientWidth > 0 && region.clientHeight > 0
  );
  assert.ok(
    region.x >= -1 &&
      region.y >= -1 &&
      region.x + region.width <= viewport.width + 1 &&
      region.y + region.height <= viewport.height + 1,
    'Reading viewport must remain inside the window'
  );
  assert.equal(region.mode, 'reading');
  assert.equal(region.role, 'region');
  assert.ok(region.label?.trim());
  assert.equal(
    region.tabIndex,
    region.scrollWidth > region.clientWidth + 1 || region.scrollHeight > region.clientHeight + 1
      ? 0
      : -1,
    'Only a viewport with actual scroll range participates in sequential focus'
  );
  assert.equal(region.overflowX, 'auto');
  assert.equal(region.overflowY, 'auto');
  assert.ok(Math.abs(region.scrollLeft) <= 1 && Math.abs(region.scrollTop) <= 1);
  assert.ok(
    Math.abs(region.scrollWidth - Math.max(region.clientWidth, image.width)) <= 2 &&
      Math.abs(region.scrollHeight - Math.max(region.clientHeight, image.height)) <= 2,
    'Reading scroll extents must account for the actual image'
  );
  assert.ok(
    Math.abs(image.width / image.height - selected.width / selected.height) < 0.01,
    'Reading must preserve the diagram aspect ratio'
  );
  assert.ok(
    Number.isInteger(reading.zoomClicks) && reading.zoomClicks >= 0 && reading.zoomClicks <= 2
  );
  const actualFontSize = (minimumFontSize * image.width) / selected.width;
  assert.ok(
    Math.abs(image.minimumRenderedFontSize - actualFontSize) < 0.001,
    'Rendered font size must derive from the actual source font and image scale'
  );
  assert.ok(actualFontSize >= 16, 'Reading labels must meet the 16 CSS px target');
  const ranges = {
    x: region.scrollWidth - region.clientWidth,
    y: region.scrollHeight - region.clientHeight,
  };
  const axes = ['x', 'y'].filter((axis) => ranges[axis] > 1);
  assert.deepEqual(
    reading.wheel?.map((sample) => sample.axis),
    axes,
    'Every overflowing axis needs actual native wheel evidence'
  );
  assert.deepEqual(
    reading.keyboard?.map((sample) => sample.axis),
    axes,
    'Every overflowing axis needs actual keyboard evidence'
  );
  for (const sample of reading.wheel) {
    assert.ok(sample.before && sample.after);
    assert.ok(
      Number.isFinite(sample.before[sample.axis]) && Number.isFinite(sample.after[sample.axis])
    );
    assert.ok(
      sample.after[sample.axis] > sample.before[sample.axis] + 1 &&
        Math.abs(sample.after[sample.axis] - ranges[sample.axis]) <= 1,
      'Native wheel must reach the far edge of the image'
    );
  }
  for (const sample of reading.keyboard) {
    assert.equal(sample.key, sample.axis === 'x' ? 'ArrowLeft' : 'ArrowUp');
    assert.ok(sample.before && sample.after);
    assert.ok(
      Number.isFinite(sample.before[sample.axis]) && Number.isFinite(sample.after[sample.axis])
    );
    assert.ok(
      sample.after[sample.axis] >= 0 && sample.after[sample.axis] < sample.before[sample.axis] - 1,
      'Native keyboard must move the reading viewport'
    );
  }
  assert.ok(
    Number.isFinite(reading.backgroundBefore?.x) && Number.isFinite(reading.backgroundBefore?.y)
  );
  assert.deepEqual(
    reading.backgroundAfter,
    reading.backgroundBefore,
    'Panning must not move the background'
  );
  assert.equal(reading.fitViewport?.mode, 'fit');
  assert.equal(reading.fitViewport.tabIndex, -1);
  const fitPort = reading.fitViewport;
  for (const key of ['x', 'y', 'clientWidth', 'clientHeight', 'scrollWidth', 'scrollHeight'])
    assert.ok(Number.isFinite(fitPort[key]), `Finite fit viewport ${key}`);
  assert.ok(
    fitPort.clientWidth > 0 &&
      fitPort.clientHeight > 0 &&
      fitPort.scrollWidth <= fitPort.clientWidth + 1 &&
      fitPort.scrollHeight <= fitPort.clientHeight + 1 &&
      reading.fit.x >= fitPort.x - 1 &&
      reading.fit.y >= fitPort.y - 1 &&
      reading.fit.x + reading.fit.width <= fitPort.x + fitPort.clientWidth + 1 &&
      reading.fit.y + reading.fit.height <= fitPort.y + fitPort.clientHeight + 1,
    'Fit overview must be complete inside its own native scrollport'
  );
  assert.ok(
    Math.abs(reading.fitViewport.scrollLeft) <= 1 && Math.abs(reading.fitViewport.scrollTop) <= 1
  );
  assert.ok(
    reading.fit?.x >= -1 &&
      reading.fit.y >= -1 &&
      reading.fit.x + reading.fit.width <= viewport.width + 1 &&
      reading.fit.y + reading.fit.height <= viewport.height + 1,
    'Fit overview must contain the complete diagram'
  );
}

function verifyContainedPreview(contained, viewport, minimumFontSize, selected) {
  assert.equal(contained.outcome, 'passed');
  assert.equal(contained.presentation, 'source-contain');
  const { source, image, dialog, dismissal } = contained;
  assert.ok(source && image && dialog && dismissal, 'Complete contain observations are required');
  for (const [label, rect] of Object.entries({ source, image, dialog })) {
    for (const key of ['x', 'y', 'width', 'height'])
      assert.ok(Number.isFinite(rect[key]), `Finite ${label} ${key}`);
    assert.ok(rect.width > 0 && rect.height > 0, `Positive ${label} dimensions`);
  }
  assert.ok(
    source.x + source.width > 0 &&
      source.y + source.height > 0 &&
      source.x < viewport.width &&
      source.y < viewport.height,
    'The actual opening source must intersect the viewport'
  );
  assert.ok(
    image.x >= -1 &&
      image.y >= -1 &&
      image.x + image.width <= viewport.width + 1 &&
      image.y + image.height <= viewport.height + 1,
    'Contain must show the complete image inside the window'
  );
  for (const key of ['x', 'y', 'width', 'height'])
    assert.ok(Math.abs(image[key] - dialog[key]) <= 1, 'The image has no surrounding frame');
  for (const measurement of [source, image, dismissal.source]) {
    assert.ok(
      Math.abs(measurement.width / measurement.height - selected.width / selected.height) < 0.01,
      'Contain preserves the selected image aspect ratio'
    );
    const actualFontSize = (minimumFontSize * measurement.width) / selected.width;
    assert.ok(
      Number.isFinite(measurement.minimumRenderedFontSize) &&
        Math.abs(measurement.minimumRenderedFontSize - actualFontSize) < 0.001,
      'Contain records the actual scaled font size without claiming a reading-size pass'
    );
  }
  assert.equal(image.src, source.src);
  assert.equal(image.alt, source.alt);
  assert.equal(dialog.role, 'dialog');
  assert.equal(dialog.modal, 'true');
  assert.equal(dialog.phase, 'entered');
  assert.equal(dialog.returnMode, 'origin');
  assert.equal(dialog.toolbarCount, 0);
  assert.equal(dialog.zoomControlCount, 0);
  assert.equal(dialog.readingViewportCount, 0);
  assert.equal(dialog.closeCount, 1);
  assert.equal(dialog.closeClip, 'inset(50%)');
  assert.deepEqual(dialog.style, {
    border: '0px',
    padding: '0px',
    radius: '0px',
    shadow: 'none',
    background: 'rgba(0, 0, 0, 0)',
  });
  for (const key of ['x', 'y', 'maxX', 'maxY'])
    assert.ok(Number.isFinite(dialog.scroll?.[key]), `Finite contain scroll ${key}`);
  assert.ok(Math.abs(dialog.scroll.x) <= 1 && Math.abs(dialog.scroll.y) <= 1);
  assert.ok(
    Math.abs(dialog.scroll.maxX) <= 1 && Math.abs(dialog.scroll.maxY) <= 1,
    'No hidden outer scroll range'
  );
  assert.equal(dismissal.input, 'Escape');
  assert.equal(dismissal.closed, true);
  assert.equal(dismissal.focusReturned, true);
  assert.equal(dismissal.originHidden, false);
  assert.equal(dismissal.sourceOpacity, 1);
  assert.equal(dismissal.source.src, source.src);
  assert.equal(dismissal.source.alt, source.alt);
}

// This checks the completeness and byte bindings of a real capture. It does not
// authenticate a report author, approve a diagram or establish full Issue closure.
export async function verifyDiagramReport(
  profile,
  report,
  { revision, provenance, build, readSource, readScreenshot }
) {
  assert.ok([1, 2].includes(report.schemaVersion), 'Known diagram capture schema is required');
  const sourceContain = report.schemaVersion === 2;
  if (sourceContain) {
    assert.equal(report.presentation, 'source-contain');
    assert.equal(report.readingAcceptance, 'not-assessed');
    assert.equal(report.motionMode, 'reduced');
    assert.deepEqual(report.limitations, diagramContainLimitations);
  }
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
  const fonts = uniqueIndex(
    report.fonts,
    (item) => `${item.locale}/${item.theme}/${item.variant}`,
    'font probe'
  );
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
    assert.equal(
      page.sourceSha256,
      diagramSha256(await readSource(paths.sourcePath)),
      'Article source changed'
    );
    assert.equal(
      page.builtSha256,
      diagramSha256(await readSource(paths.builtPath)),
      'Built article changed'
    );
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
        verifyDiagramFonts(profile, font, locale);
        assert.ok(Array.isArray(font.text) && font.text.length > 0, 'Measured text is required');
        assert.ok(Number.isFinite(font.minimumFontSize) && font.minimumFontSize > 0);
      }
    }
    for (const theme of ['light', 'dark']) {
      for (const capture of diagramEvidenceCases(profile)) {
        expectedCases++;
        const selected = selectDiagramVariant(profile, locale, capture.viewport.width);
        const binding = assets.get(`${locale}/${selected.name}`);
        const id = diagramEvidenceId(
          profile,
          locale,
          theme,
          capture.viewport.width,
          revision,
          binding.svgSha256,
          capture.scenario
        );
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
        assert.deepEqual(entry.expectedDimensions, {
          width: selected.width,
          height: selected.height,
        });
        assert.deepEqual(entry.errors, []);
        const responsive = diagramVariants(profile, locale).some(
          (variant) => variant.name === 'mobile'
        );
        const phases = responsive
          ? ['repeated-open-dismiss', 'after-back', 'after-forward-back']
          : [];
        assert.deepEqual(
          entry.interactions?.map((interaction) => interaction.phase) ?? [],
          phases,
          'Required repeated-open and history phases must remain complete'
        );
        const font = fonts.get(`${locale}/${theme}/${selected.name}`);
        let previewMeasurements;
        if (sourceContain) {
          for (const key of [
            'readingPreviews',
            'readingObservations',
            'readingCapture',
            'readingEndCapture',
          ])
            assert.equal(entry[key], undefined, 'Contain cannot relabel reading evidence');
          assert.ok(
            Array.isArray(entry.containedPreviews),
            'Actual contain observations are required'
          );
          assert.equal(entry.containedPreviews.length, phases.length + 1);
          for (const contained of entry.containedPreviews)
            verifyContainedPreview(contained, capture.viewport, font.minimumFontSize, selected);
          assert.deepEqual(entry.preview, entry.containedPreviews[0].image);
          previewMeasurements = entry.containedPreviews.flatMap((contained) => [
            contained.source,
            contained.image,
            contained.dismissal.source,
          ]);
        } else {
          assert.ok(
            Array.isArray(entry.readingPreviews),
            'Actual reading viewport evidence is required'
          );
          assert.equal(
            entry.readingPreviews.length,
            phases.length + 1,
            'Every open must exercise reading and fit'
          );
          for (const reading of entry.readingPreviews)
            verifyReadingPreview(reading, capture.viewport, font.minimumFontSize, selected);
          assert.deepEqual(entry.preview, entry.readingPreviews[0].fit);
          previewMeasurements = entry.readingPreviews.flatMap((reading) => [
            reading.image,
            reading.fit,
          ]);
        }
        for (const [index, interaction] of (entry.interactions ?? []).entries()) {
          assert.equal(interaction.dismissed, true);
          assert.deepEqual(
            interaction.preview,
            sourceContain
              ? entry.containedPreviews[index + 1].image
              : entry.readingPreviews[index + 1].fit
          );
        }
        for (const measurement of [
          entry.image,
          entry.preview,
          entry.figureCapture?.source,
          ...previewMeasurements,
        ]) {
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
        assert.ok(
          entry.accessibility?.triggerLabel?.trim(),
          'Actual preview control text is required'
        );
        assert.ok(
          entry.accessibility.previewDescription?.trim(),
          'Actual Dialog description is required'
        );
        if (entry.accessibility.caption) {
          assert.ok(entry.accessibility.previewDescription.includes(entry.accessibility.caption));
        }
        assert.equal(entry.figureCapture.outcome, 'passed');
        assert.ok(['viewport-region', 'document-region'].includes(entry.figureCapture.kind));
        assert.deepEqual(entry.articleCapture.source, entry.image);
        assert.deepEqual(entry.previewCapture.source, entry.preview);
        if (sourceContain)
          assert.deepEqual(
            entry.previewCapture.after,
            entry.previewCapture.source,
            'The contain image must remain unchanged across its PNG capture'
          );
        assert.deepEqual(entry.articleCapture.dimensions, capture.viewport);
        assert.deepEqual(entry.previewCapture.dimensions, capture.viewport);
        assert.deepEqual(entry.figureCapture.dimensions, {
          width: entry.figureCapture.clip.width,
          height: entry.figureCapture.clip.height,
        });
        let panned = false;
        if (!sourceContain) {
          assert.deepEqual(entry.readingCapture?.source, entry.readingPreviews[0].image);
          assert.deepEqual(entry.readingCapture.dimensions, capture.viewport);
          panned = entry.readingPreviews[0].wheel.length > 0;
          assert.equal(
            Boolean(entry.readingEndCapture),
            panned,
            'A scrollable reading viewport needs its own far-edge capture'
          );
        }
        if (panned) {
          assert.deepEqual(entry.readingEndCapture.dimensions, capture.viewport);
          const end = entry.readingEndCapture.source;
          const first = entry.readingPreviews[0];
          assert.equal(end.asset, first.image.asset);
          assert.equal(end.svgSha256, first.image.svgSha256);
          assert.equal(end.sourceSha256, first.image.sourceSha256);
          assert.equal(end.width, first.image.width);
          assert.equal(end.height, first.image.height);
          const x = first.wheel.find((sample) => sample.axis === 'x')?.after.x ?? 0;
          const y = first.wheel.find((sample) => sample.axis === 'y')?.after.y ?? 0;
          assert.ok(
            Math.abs(end.x - (first.image.x - x)) <= 1 &&
              Math.abs(end.y - (first.image.y - y)) <= 1,
            'The far-edge capture must show the actual panned image'
          );
        }
        const captures = [
          entry.articleCapture,
          entry.figureCapture,
          ...(!sourceContain ? [entry.readingCapture] : []),
          ...(panned ? [entry.readingEndCapture] : []),
          entry.previewCapture,
        ];
        assert.deepEqual(
          entry.screenshots,
          captures.map((item) => item.file)
        );
        for (const view of captures) await verifyScreenshot(view, id);
      }
    }
  }
  assert.equal(assets.size, expectedAssets, 'Unexpected assets');
  assert.equal(fonts.size, expectedFonts, 'Unexpected font probes');
  assert.equal(cases.size, expectedCases, 'Unexpected capture cases');
  return {
    ...(sourceContain
      ? {
          schemaVersion: 2,
          presentation: 'source-contain',
          readingAcceptance: 'not-assessed',
          motionMode: 'reduced',
          limitations: [...diagramContainLimitations],
        }
      : {}),
    figure: profile.figure,
    revision,
    cases: expectedCases,
    fontProbes: expectedFonts,
    screenshots: usedScreenshots.size,
  };
}
