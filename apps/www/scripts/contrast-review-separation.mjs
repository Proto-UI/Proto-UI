import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const digest = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const ISSUE_CRITERIA = Array.from({ length: 8 }, (_, index) =>
  `issue.469.${String(index + 1).padStart(3, '0')}`
);
const FRAME_PAIRS = new Map([
  ...['main', 'primary', 'secondary', 'canary', 'mint', 'lavender', 'coral', 'sky', 'destructive']
    .map((fill) => [fill, `${fill}-foreground`]),
  ['background', 'foreground'],
  ['secondary-background', 'foreground'],
  ['card', 'card-foreground'],
  ['popover', 'popover-foreground'],
  ['foreground', 'background'],
]);

function requireText(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing ${name}.`);
  return value;
}

function requireList(value, name) {
  if (!Array.isArray(value)) throw new Error(`Expected ${name} array.`);
  return value;
}

async function readBoundArtifact(directory, reference) {
  requireText(reference?.path, 'artifact path');
  if (!/^sha256:[a-f0-9]{64}$/.test(reference.digest ?? ''))
    throw new Error(`Missing artifact digest: ${reference.path}`);
  const absolute = resolve(directory, reference.path);
  const within = relative(directory, absolute);
  if (isAbsolute(reference.path) || within === '..' || within.startsWith(`..${sep}`))
    throw new Error(`Artifact path leaves the report directory: ${reference.path}`);
  const bytes = await readFile(absolute);
  if (digest(bytes) !== reference.digest)
    throw new Error(`Artifact digest mismatch: ${reference.path}`);
  return bytes;
}

async function readFrame(directory, entry, schemaVersion) {
  if (schemaVersion === 2) return entry;
  const event = JSON.parse(await readBoundArtifact(directory, entry.frameFile));
  if (event.format !== 'create-only-contrast-journal-v1' || event.name !== entry.name ||
      event.index !== entry.index || !event.frame)
    throw new Error(`Frame journal identity mismatch: ${entry.name}`);
  for (const key of ['family', 'runtime', 'theme', 'requestedState', 'status']) {
    if (entry[key] !== event.frame[key])
      throw new Error(`Frame receipt mismatch: ${entry.name}/${key}`);
  }
  for (const key of ['image', 'factsFile']) {
    if (entry[key]?.path !== event.frame[key]?.path ||
        entry[key]?.digest !== event.frame[key]?.digest)
      throw new Error(`Frame artifact receipt mismatch: ${entry.name}/${key}`);
  }
  return event.frame;
}

function textFloor(fontSize, fontWeight) {
  // WCAG large text needs rendered size as well as weight; bold alone never
  // changes the measured ratio or lowers the normal-text floor.
  const size = /^([0-9]+(?:\.[0-9]+)?)px$/.exec(fontSize ?? '');
  const pixels = size ? Number(size[1]) : NaN;
  const weight = fontWeight === 'bold' ? 700 : Number(fontWeight);
  return pixels >= 24 || (pixels >= 18.6666666667 && weight >= 700) ? 3 : 4.5;
}

/** Project recorded numbers, never recompute paint or decide cue necessity. */
function measurements(name, frame, facts) {
  const rows = [];
  for (const [surfaceIndex, surface] of requireList(facts.surfaces, 'facts surfaces').entries()) {
    const identity = {
      frame: name,
      family: frame.family,
      runtime: frame.runtime,
      theme: frame.theme,
      requestedState: frame.requestedState,
      surfaceIndex,
      prototype: surface.prototype ?? null,
      ref: surface.ref ?? null,
      role: surface.role ?? null,
    };
    const add = (path, domain, ratio, floor, source, limits = []) => {
      if (ratio !== null && (typeof ratio !== 'number' || !Number.isFinite(ratio) || ratio < 1))
        throw new Error(`Invalid recorded ratio: ${name}#/surfaces/${surfaceIndex}/${path}`);
      rows.push({
        ...identity,
        id: `${name}#/surfaces/${surfaceIndex}/${path}`,
        domain,
        ratio,
        floor,
        comparison: ratio === null ? 'unmeasured' : ratio < floor ? 'below-floor' : 'at-or-above-floor',
        captureStatus: frame.status,
        inactive: surface.inactive,
        visible: surface.visible,
        rawCueDisposition: surface.cueDisposition ?? null,
        source,
        limits: [...new Set(limits)],
        cueReview: { classification: 'unclassified' },
      });
    };
    const text = (path, value, font = value) => add(
      path, 'text', value.ratio ?? null, textFloor(font.fontSize, font.fontWeight),
      { ...value, fontSize: font.fontSize, fontWeight: font.fontWeight },
      [...(surface.visibility?.limits ?? []), ...(value.limits ?? [])]
    );
    for (const [index, run] of (surface.textRuns ?? []).entries())
      text(`textRuns/${index}/ratio`, run);
    if (surface.textContrast) text('textContrast/ratio', {
      ...surface.textContrast, ...surface.textContrastDisposition,
    }, surface.style);
    if (surface.placeholder) text('placeholder/ratio', surface.placeholder, surface.style);
    for (const [index, glyph] of (surface.glyphs ?? []).entries()) {
      for (const paint of ['fill', 'stroke']) add(
        `glyphs/${index}/${paint}Contrast`, 'non-text', glyph[`${paint}Contrast`] ?? null, 3,
        glyph, [...(glyph.limits ?? []), ...(glyph[`${paint}Limits`] ?? [])]
      );
    }
    for (const [index, edge] of (surface.exterior ?? []).entries()) {
      for (const metric of ['innerBorderVsBackground', 'opaqueBorderVsPixel', 'opaqueFillVsPixel'])
        add(`exterior/${index}/${metric}`, 'non-text', edge[metric] ?? null, 3, edge,
          [...(surface.paint?.limits ?? []), ...(surface.perimeterLimits ?? [])]);
    }
    for (const [index, shadow] of (surface.shadows ?? []).entries()) {
      if (shadow.inset) add(`shadows/${index}/insetVsFill`, 'non-text',
        shadow.insetVsFill ?? null, 3, shadow, shadow.limits ?? []);
      for (const [receivingIndex, receiving] of (shadow.receiving ?? []).entries())
        add(`shadows/${index}/receiving/${receivingIndex}/ratio`, 'non-text',
          receiving.ratio ?? null, 3, { ...receiving, raw: shadow.raw,
            basis: shadow.renderedAdjacency, limitation: shadow.limitation }, shadow.limits ?? []);
    }
  }
  return rows;
}

function reviewEvidence(review) {
  requireText(review.rationale, 'review rationale');
  const evidence = requireList(review.evidence, 'review evidence');
  if (!evidence.length) throw new Error('Review evidence cannot be empty.');
  evidence.forEach((value) => requireText(value, 'review evidence reference'));
}

/**
 * Read an existing native audit and optional exact-report-bound annotations.
 * Reviews are supplied assertions, not authenticated independent acceptance.
 * All numerical rows remain present after annotation, including redundant or
 * decorative below-floor observations. No output field certifies WCAG.
 */
export async function readContrastReviewSeparation(reportPath, reviewPath = null) {
  reportPath = resolve(reportPath);
  const reportBytes = await readFile(reportPath);
  const reportDigest = digest(reportBytes);
  const report = JSON.parse(reportBytes);
  if (![2, 3].includes(report.schemaVersion)) throw new Error('Expected audit schema 2 or 3.');
  requireText(report.runID, 'audit runID');
  requireList(report.frames, 'audit frames');
  requireList(report.cases, 'audit cases');
  const reviewBytes = reviewPath === null ? null : await readFile(reviewPath);
  const review = reviewBytes === null ? {
    schemaVersion: 1, reportDigest, cues: [], grammar: [], perceptual: [], parentSourceKeys: [],
  } : JSON.parse(reviewBytes);
  if (review.schemaVersion !== 1 || review.reportDigest !== reportDigest)
    throw new Error('Review annotations must bind the exact original report digest.');
  for (const key of ['cues', 'grammar', 'perceptual', 'parentSourceKeys'])
    requireList(review[key], key);
  review.parentSourceKeys.forEach((key) => requireText(key, 'parent source key'));
  const frames = [];
  const rows = [];
  const surfaces = new Map();
  for (const [index, entry] of report.frames.entries()) {
    const name = entry.name ?? `${entry.family}-${entry.runtime}-${entry.theme}-${entry.requestedState}`;
    if (frames.some((frame) => frame.name === name)) throw new Error(`Duplicate frame: ${name}`);
    const frame = await readFrame(dirname(reportPath), entry, report.schemaVersion);
    if (frame.image) await readBoundArtifact(dirname(reportPath), frame.image);
    if (frame.fingerprintsFile) await readBoundArtifact(dirname(reportPath), frame.fingerprintsFile);
    const facts = frame.factsFile
      ? JSON.parse(await readBoundArtifact(dirname(reportPath), frame.factsFile))
      : frame.facts;
    frames.push({ name, index, ...frame, facts: undefined });
    if (!facts) continue; // A failed start remains visible, never zero-gap success.
    for (const [surfaceIndex, surface] of requireList(facts.surfaces, 'facts surfaces').entries())
      surfaces.set(`${name}#/surfaces/${surfaceIndex}`, surface);
    rows.push(...measurements(name, frame, facts));
  }
  const byId = new Map(rows.map((row) => [row.id, row]));
  const seen = new Set();
  for (const cue of review.cues) {
    const row = byId.get(cue.id);
    if (!row || row.domain !== 'non-text' || seen.has(cue.id))
      throw new Error(`Unknown, duplicate or non-indicator cue annotation: ${cue.id}`);
    if (!['required', 'redundant', 'decorative', 'unclassified'].includes(cue.classification))
      throw new Error(`Unknown supplied cue classification: ${cue.classification}`);
    reviewEvidence(cue);
    seen.add(cue.id);
    row.cueReview = { ...cue, provenance: 'supplied annotation; independent review not authenticated' };
  }
  const grammar = review.grammar.map((item) => {
    if (!surfaces.has(item.surface)) throw new Error(`Unknown grammar surface: ${item.surface}`);
    requireText(item.fillRole, 'fill role');
    requireText(item.frameRole, 'frame role');
    requireText(item.source, 'source annotation reference');
    reviewEvidence(item);
    const expectedFrameRole = FRAME_PAIRS.get(item.fillRole) ?? null;
    return { ...item, expectedFrameRole,
      comparisonTo427: expectedFrameRole === null ? 'undeclared-pair'
        : expectedFrameRole === item.frameRole ? 'matches-declared-pair' : 'pair-mismatch',
      disposition: 'source annotation only; reconcile current P authority before a repair',
      authority: 'https://github.com/Proto-UI/Proto-UI/issues/427#issuecomment-5376913069',
    };
  });
  const perceptual = review.perceptual.map((item) => {
    if (!surfaces.has(item.surface)) throw new Error(`Unknown perceptual surface: ${item.surface}`);
    requireText(item.observation, 'perceptual observation');
    reviewEvidence(item);
    return { ...item, disposition: 'perceptual review only; no numeric WCAG verdict' };
  });
  const { frames: _originalFrames, ...audit } = report;
  return {
    schemaVersion: 1,
    kind: 'contrast-review-separation',
    originalIssueCriteria: ISSUE_CRITERIA,
    parentSourceKeys: review.parentSourceKeys,
    input: { reportPath, reportDigest, runID: report.runID, baseline: report.baseline,
      reviewPath, reviewDigest: reviewBytes === null ? null : digest(reviewBytes) },
    disposition: 'review projection only; WCAG conformance and Issue completion not determined',
    audit,
    frames,
    text: rows.filter((row) => row.domain === 'text'),
    nonText: rows.filter((row) => row.domain === 'non-text'),
    belowFloor: rows.filter((row) => row.comparison === 'below-floor').map((row) => row.id),
    grammar,
    perceptual,
    limits: [
      'Rows preserve probe numbers and limits; source-model metrics are not rendered-pixel or general CSS conformance.',
      'Required/redundant/decorative are supplied annotations only. Missing review remains unclassified; no alternative cue is inferred.',
      'Frame grammar comparison does not authorize source changes, clear numerical failures or supersede current draft P entities.',
      'Capture failure, unsupported domains, unexecuted targets, publication and assistive-technology debts remain in the original input.',
      'No new component run or cue review is performed by this offline projection. Counts of rows do not count unique normative assertions.',
    ],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length < 3 || process.argv.length > 4)
    throw new Error('Usage: node contrast-review-separation.mjs report-final.json [review.json]');
  const result = await readContrastReviewSeparation(process.argv[2], process.argv[3] ?? null);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
