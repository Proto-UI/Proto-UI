import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { readContrastReviewSeparation } from './contrast-review-separation.mjs';

// Injected reader/classification calibrations. These bytes are not native
// screenshots or measured product evidence, and prove no component behavior.
const sha = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const name = 'calibration-wc-dark-keyboard-focus';
const surfaceId = `${name}#/surfaces/0`;
const edgeId = `${surfaceId}/exterior/0/opaqueBorderVsPixel`;
const shadowId = `${surfaceId}/shadows/0/receiving/0/ratio`;
const annotationEvidence = {
  rationale: 'Injected review annotation for separation calibration only.',
  evidence: ['injected:review-calibration'],
};
function surface() {
  return {
    prototype: 'calibration-surface', ref: 'subject', role: 'button',
    inactive: false, visible: true,
    state: { focused: true, focusVisible: true },
    style: { fontSize: '14px', fontWeight: '500' },
    visibility: { classification: 'source-model-visible', limits: [] },
    paint: { limits: [] }, perimeterLimits: [],
    cueDisposition: 'unclassified observation; numerical edge alone is not a verdict',
    textRuns: [{ text: 'Note', ratio: 5.77, fontSize: '14px', fontWeight: '500',
      threshold: 4.5, classification: 'source-model-only', limits: [], basis: 'injected source model' }],
    glyphs: [],
    exterior: [{ side: 'left', point: { x: 1, y: 1, rgb: [23, 23, 23] },
      innerBorderVsBackground: 1.17, opaqueBorderVsPixel: 1.39, opaqueFillVsPixel: 1.18 }],
    shadows: [{ raw: 'rgb(0, 0, 0) 4px 4px 0px 0px',
      renderedAdjacency: 'unresolved', limitation: 'receiving geometry needs cue review',
      receiving: [{ side: 'right', point: { x: 2, y: 2, rgb: [38, 38, 38] }, ratio: 1.39 }] }],
  };
}
async function fixture(t, { surfaces = [surface()], status = 'matched', schemaVersion = 3,
  incomplete = false } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'contrast-review-calibration-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const artifact = async (path, value) => {
    const bytes = typeof value === 'string' ? value : json(value);
    await writeFile(join(directory, path), bytes);
    return { path, digest: sha(bytes) };
  };
  const image = await artifact('calibration.png', 'injected bytes; not a PNG or native evidence');
  const factsFile = await artifact('calibration.facts.json', { surfaces });
  const frame = {
    family: 'calibration', runtime: 'wc', theme: 'dark', requestedState: 'keyboard-focus',
    status, image, factsFile,
    targetObservation: { achieved: status === 'matched' },
    beforeFingerprintDigest: sha('injected-state'), afterFingerprintDigest: sha('injected-state'),
  };
  const frameFile = await artifact('frame-result.json', {
    format: 'create-only-contrast-journal-v1', name, index: 0, frame,
  });
  const entry = { name, index: 0, ...frame, frameFile };
  const report = {
    schemaVersion, runID: 'injected-calibration', baseline: '0'.repeat(40),
    sourceCodeVersion: { status: 'injected-not-product-evidence' },
    frames: [schemaVersion === 3 ? entry : frame],
    cases: [{ family: 'calibration', runtime: 'wc', theme: 'dark', status: 'failed',
      plannedStates: ['keyboard-focus', 'pointer-down'], achievedTargets: ['keyboard-focus'],
      errors: [{ phase: 'pointer-down', error: 'injected failure' }] }],
    failedCases: [{ error: 'injected failure' }],
    evidenceDebt: ['Unexecuted pointer-down; no AT or publication evidence.'],
    disposition: 'partial injected calibration',
    summary: { unexecutedTargets: 1, unresolvedRuntimeThemeCases: 1 },
    fatalError: 'injected earlier fatal error retained as metadata',
  };
  if (incomplete) report.frames.push({ name: 'incomplete', index: 1,
    family: 'calibration', runtime: 'wc', theme: 'light', requestedState: 'rest',
    status: 'attempting', image: null, facts: null, factsFile: null,
    frameFile: await artifact('frame-start.json', { format: 'create-only-contrast-journal-v1',
      name: 'incomplete', index: 1, frame: { family: 'calibration', runtime: 'wc',
        theme: 'light', requestedState: 'rest', status: 'attempting',
        image: null, facts: null, factsFile: null } }) });
  const reportPath = join(directory, 'report-final.json');
  const saveReport = async () => writeFile(reportPath, json(report));
  await saveReport();
  const review = async (overrides = {}) => {
    const path = join(directory, 'review.json');
    await writeFile(path, json({ schemaVersion: 1, reportDigest: sha(await readFile(reportPath)),
      cues: [], grammar: [], perceptual: [], parentSourceKeys: [], ...overrides }));
    return path;
  };
  return { directory, reportPath, report, frame, entry, artifact, saveReport, review };
}

test('native-fact-shaped numbers keep text, inner/outer edges and shadow observations distinct', async (t) => {
  const f = await fixture(t);
  const result = await readContrastReviewSeparation(f.reportPath);
  assert.equal(result.text[0].ratio, 5.77);
  assert.equal(result.text[0].floor, 4.5);
  assert.equal(result.text[0].comparison, 'at-or-above-floor');
  assert.deepEqual(result.nonText.map((row) => row.ratio), [1.17, 1.39, 1.18, 1.39]);
  assert.equal(result.belowFloor.length, 4);
  assert.ok(result.nonText.every((row) => row.cueReview.classification === 'unclassified'));
  assert.ok(result.nonText.every((row) => row.rawCueDisposition === surface().cueDisposition));
  assert.equal(result.nonText[3].source.basis, 'unresolved');
  assert.deepEqual(result.grammar, []);
  assert.deepEqual(result.perceptual, []);
});

test('supplied decorative/redundant reviews and perceptual feedback cannot erase below-floor numbers', async (t) => {
  const f = await fixture(t);
  const review = await f.review({
    cues: [{ id: edgeId, classification: 'redundant', ...annotationEvidence },
      { id: shadowId, classification: 'decorative', ...annotationEvidence }],
    grammar: [{ surface: surfaceId, fillRole: 'main', frameRole: 'foreground',
      source: 'injected:recipe-preimage', ...annotationEvidence }],
    perceptual: [{ surface: surfaceId, observation: 'Injected glare review', ...annotationEvidence }],
    parentSourceKeys: ['issue.469.003', 'injected:parent-condition'],
  });
  const result = await readContrastReviewSeparation(f.reportPath, review);
  assert.equal(result.nonText.find((row) => row.id === edgeId).ratio, 1.39);
  assert.equal(result.nonText.find((row) => row.id === shadowId).ratio, 1.39);
  assert.equal(result.belowFloor.length, 4);
  assert.equal(result.grammar[0].comparisonTo427, 'pair-mismatch');
  assert.equal(result.grammar[0].expectedFrameRole, 'main-foreground');
  assert.equal(result.text[0].ratio, 5.77);
  assert.equal(result.perceptual.length, 1);
  assert.deepEqual(result.parentSourceKeys, ['issue.469.003', 'injected:parent-condition']);
  assert.equal(result.originalIssueCriteria.length, 8);
  assert.equal(result.nonText.find((row) => row.id === edgeId).cueReview.provenance,
    'supplied annotation; independent review not authenticated');
});

test('normal text is not granted a large-text exception by weight or rounded ratios', async (t) => {
  const s = surface();
  s.textRuns = [
    { ratio: 3.5, fontSize: '16px', fontWeight: '900', limits: [] },
    { ratio: 3.5, fontSize: '24px', fontWeight: '400', limits: [] },
    { ratio: 3.5, fontSize: '18.6666666667px', fontWeight: '700', limits: [] },
    { ratio: 4.499999999999999, fontSize: '14px', fontWeight: '500', limits: [] },
  ];
  const f = await fixture(t, { surfaces: [s] });
  const result = await readContrastReviewSeparation(f.reportPath);
  assert.deepEqual(result.text.map((row) => row.floor), [4.5, 3, 3, 4.5]);
  assert.deepEqual(result.text.map((row) => row.comparison),
    ['below-floor', 'at-or-above-floor', 'at-or-above-floor', 'below-floor']);
  assert.equal(result.text[0].ratio, result.text[1].ratio);
  assert.equal(result.text[3].ratio, 4.499999999999999);
});

test('unsupported, inactive, failed and unfinished observations preserve original debt and state', async (t) => {
  const s = surface();
  s.inactive = true;
  s.visibility.limits = ['rounded-overflow-unsupported'];
  s.textRuns[0].ratio = null;
  s.textRuns[0].classification = 'unsupported';
  s.textRuns[0].limits = ['inactive-component'];
  s.exterior[0].opaqueBorderVsPixel = null;
  const f = await fixture(t, { surfaces: [s], status: 'known-unsupported', incomplete: true });
  const result = await readContrastReviewSeparation(f.reportPath);
  assert.equal(result.frames.length, 2);
  assert.equal(result.frames[0].status, 'known-unsupported');
  assert.equal(result.frames[1].status, 'attempting');
  assert.equal(result.text[0].ratio, null);
  assert.equal(result.text[0].source.classification, 'unsupported');
  assert.deepEqual(result.text[0].limits, ['rounded-overflow-unsupported', 'inactive-component']);
  assert.equal(result.text[0].inactive, true);
  assert.equal(result.nonText[1].comparison, 'unmeasured');
  assert.equal(result.nonText[0].cueReview.classification, 'unclassified');
  assert.deepEqual(result.audit.cases, f.report.cases);
  assert.deepEqual(result.audit.failedCases, f.report.failedCases);
  assert.deepEqual(result.audit.evidenceDebt, f.report.evidenceDebt);
  assert.equal(result.audit.fatalError, f.report.fatalError);
  assert.deepEqual(result.audit.summary, f.report.summary);
});

test('an advertised fingerprint sidecar must match its bound bytes', async (t) => {
  const f = await fixture(t, { schemaVersion: 2 });
  const path = 'calibration.fingerprints.json';
  f.frame.fingerprintsFile = await f.artifact(path, {
    before: 'injected-state', facts: 'injected-state', after: 'injected-state',
  });
  await f.saveReport();
  assert.equal((await readContrastReviewSeparation(f.reportPath)).frames.length, 1);
  await writeFile(join(f.directory, path), '{}');
  await assert.rejects(readContrastReviewSeparation(f.reportPath), /Artifact digest mismatch/);
});

test('annotation reuse rejects a different report even when the selected rows look identical', async (t) => {
  const f = await fixture(t);
  const review = await f.review();
  f.report.disposition = 'a different retained report';
  await f.saveReport();
  await assert.rejects(readContrastReviewSeparation(f.reportPath, review), /exact original report digest/);
});

test('changed image, facts and journal bytes are rejected against retained digests', async (t) => {
  for (const path of ['calibration.png', 'calibration.facts.json', 'frame-result.json']) {
    const f = await fixture(t);
    await writeFile(join(f.directory, path), 'changed bytes');
    await assert.rejects(readContrastReviewSeparation(f.reportPath), /Artifact digest mismatch/);
  }
});

test('a compact receipt cannot assign another native state to a bound journal record', async (t) => {
  const f = await fixture(t);
  f.report.frames[0].requestedState = 'pointer-down';
  await f.saveReport();
  await assert.rejects(readContrastReviewSeparation(f.reportPath), /Frame receipt mismatch/);
});

test('unknown and duplicate cue reviews cannot silently replace another observation', async (t) => {
  const f = await fixture(t);
  for (const cues of [
    [{ id: 'unknown', classification: 'required', ...annotationEvidence }],
    [{ id: `${surfaceId}/textRuns/0/ratio`, classification: 'decorative', ...annotationEvidence }],
    [1, 2].map(() => ({ id: edgeId, classification: 'required', ...annotationEvidence })),
  ]) {
    const review = await f.review({ cues });
    await assert.rejects(readContrastReviewSeparation(f.reportPath, review), /cue annotation/);
  }
});

test('historical schema2 metrics stay source-bound and unknown grammar pairs remain unresolved', async (t) => {
  const f = await fixture(t, { schemaVersion: 2 });
  const review = await f.review({ grammar: [
    { surface: surfaceId, fillRole: 'foreground', frameRole: 'background',
      source: 'injected:inverse-source', ...annotationEvidence },
    { surface: surfaceId, fillRole: 'authored-unknown', frameRole: 'black',
      source: 'injected:unknown-source', ...annotationEvidence },
  ] });
  const result = await readContrastReviewSeparation(f.reportPath, review);
  assert.equal(result.audit.schemaVersion, 2);
  assert.equal(result.grammar[0].comparisonTo427, 'matches-declared-pair');
  assert.equal(result.grammar[1].comparisonTo427, 'undeclared-pair');
  assert.equal(result.grammar[1].expectedFrameRole, null);
  assert.equal(result.nonText[1].ratio, 1.39);
  assert.equal(result.nonText[1].cueReview.classification, 'unclassified');
});

test('the offline CLI emits the separated projection without writing into retained input artifacts', async (t) => {
  const f = await fixture(t);
  const before = await readdir(f.directory);
  const run = spawnSync(process.execPath, [
    fileURLToPath(new URL('./contrast-review-separation.mjs', import.meta.url)), f.reportPath,
  ], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(run.stdout);
  assert.equal(result.text[0].ratio, 5.77);
  assert.equal(result.nonText[1].ratio, 1.39);
  assert.equal(result.nonText[1].cueReview.classification, 'unclassified');
  assert.equal(result.belowFloor.length, 4);
  assert.deepEqual(await readdir(f.directory), before);
});
