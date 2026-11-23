import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  PROTOCOL,
  PIXEL_CASES,
  STAGE_CASES,
  PLAN,
  comparePlanes,
  auditInventory,
  analyzeReceipt,
} from './protocol.mjs';
import { analyzeFromDisk } from '../../scripts/analysis/liquid-canvas-transport.mjs';

const pixels = () => ({
  width: 2,
  height: 2,
  pixels: new Uint8ClampedArray([
    0, 0, 0, 0, 19, 72, 183, 127, 221, 222, 223, 255, 31, 41, 51, 254,
  ]),
});
const emptyReceipt = () => ({
  protocol: PROTOCOL,
  source: {},
  environment: {},
  failures: [],
  contexts: [],
});

// Only the header gates are isolated here. Empty inventories deliberately keep
// overall native acceptance false; these are not synthetic native successes.
const headerReceipt = () => ({
  ...emptyReceipt(),
  source: {
    expectedSha: 'a'.repeat(40),
    start: { sha: 'a'.repeat(40), tree: 'b'.repeat(40), status: '' },
    end: { sha: 'a'.repeat(40), tree: 'b'.repeat(40), status: '' },
    closureStable: true,
    headBound: true,
  },
  environment: { browser: '157.0.8103.78', gpu: {} },
});

test('populated matching header facts pass only their own gates, not absent native evidence', async () => {
  const result = await analyzeReceipt(headerReceipt(), () => pixels());
  assert.equal(result.checks.find((row) => row.id === 'source-bound-native').accepted, true);
  assert.equal(result.checks.find((row) => row.id === 'browser-observed').accepted, true);
  assert.equal(result.accepted, false);
});

for (const [name, change] of [
  [
    'missing-all-identifiers',
    (source) => {
      delete source.expectedSha;
      delete source.start.sha;
      delete source.end.sha;
      delete source.start.tree;
      delete source.end.tree;
    },
  ],
  [
    'uniform-malformed-identifiers',
    (source) => {
      source.expectedSha = source.start.sha = source.end.sha = 'not-a-commit';
      source.start.tree = source.end.tree = 'not-a-tree';
    },
  ],
  [
    'uniform-abbreviated-sha',
    (source) => {
      source.expectedSha = source.start.sha = source.end.sha = 'abcdef1';
    },
  ],
  [
    'missing-both-trees',
    (source) => {
      delete source.start.tree;
      delete source.end.tree;
    },
  ],
  [
    'numeric-identifiers',
    (source) => {
      source.expectedSha = source.start.sha = source.end.sha = 1;
    },
  ],
  [
    'different-valid-end-sha',
    (source) => {
      source.end.sha = 'c'.repeat(40);
    },
  ],
  [
    'different-valid-end-tree',
    (source) => {
      source.end.tree = 'd'.repeat(40);
    },
  ],
  [
    'dirty-start',
    (source) => {
      source.start.status = ' M changed';
    },
  ],
  [
    'changed-closure',
    (source) => {
      source.closureStable = false;
    },
  ],
])
  test(`source header refuses ${name}`, async () => {
    const receipt = headerReceipt();
    change(receipt.source);
    const result = await analyzeReceipt(receipt, () => pixels());
    assert.equal(result.checks.find((row) => row.id === 'source-bound-native').accepted, false);
  });

for (const browser of ['', ' \t\n', null])
  test(`browser header refuses ${JSON.stringify(browser)}`, async () => {
    const receipt = headerReceipt();
    receipt.environment.browser = browser;
    const result = await analyzeReceipt(receipt, () => pixels());
    assert.equal(result.checks.find((row) => row.id === 'browser-observed').accepted, false);
  });

test('frozen inventory preserves every profile/DPR/order and all six 20-sample blocks', () => {
  assert.equal(PIXEL_CASES.length, 72);
  assert.equal(new Set(PIXEL_CASES.map((row) => row.id)).size, 72);
  for (const dpr of [1, 1.5, 2])
    assert.equal(PIXEL_CASES.filter((row) => row.dpr === dpr).length, 24);
  assert.equal(STAGE_CASES.length, 120);
  for (const workload of ['static', 'dynamic'])
    for (const order of ['before', 'after'])
      assert.equal(
        STAGE_CASES.filter((row) => row.workload === workload && row.order === order).length,
        30
      );
  assert.deepEqual(
    Array.from({ length: 6 }, (_, block) => [
      ...new Set(STAGE_CASES.filter((row) => row.block === block).map((row) => row.workload)),
    ]),
    [['static'], ['dynamic'], ['dynamic'], ['static'], ['static'], ['dynamic']]
  );
  assert.equal(PLAN.lifetime.length, 20);
  assert.equal(PLAN.controls.length, 6);
});

test('full independent RGBA equality retains transparent, partial and opaque pixels', () => {
  const result = comparePlanes(pixels(), pixels());
  assert.equal(result.equal, true);
  assert.deepEqual(result.alpha, { transparent: 1, partial: 2, opaque: 1 });
});

for (const byte of [4, 7, 15])
  test(`one changed byte at ${byte} cannot hide behind RGB/alpha normalization`, () => {
    const expected = pixels(),
      changed = pixels();
    changed.pixels[byte]++;
    const result = comparePlanes(changed, expected);
    assert.equal(result.equal, false);
    assert.equal(result.mismatchedBytes, 1);
    assert.equal(result.mismatchedPixels, 1);
    assert.equal(result.firstDifferences[0].byte, byte);
  });

test('equal-length planes with a different physical shape are rejected', () => {
  const changed = pixels();
  changed.width = 4;
  changed.height = 1;
  assert.equal(comparePlanes(changed, pixels()).reason, 'physical-dimensions');
});

test('empty, partial, wrong typed and over-budget readbacks cannot count as full equality', () => {
  for (const changed of [
    { width: 0, height: 0, pixels: new Uint8Array() },
    { ...pixels(), pixels: new Uint8Array(12) },
    { ...pixels(), pixels: new Uint16Array(16) },
    { width: 2049, height: 1, pixels: new Uint8Array(2049 * 4) },
  ])
    assert.equal(comparePlanes(changed, changed).equal, false);
});

test('a duplicate success cannot stand in for an omitted original case', () => {
  const actual = PIXEL_CASES.map((row) => ({ ...row, status: 'ok' }));
  actual[1] = { ...actual[0] };
  const audit = auditInventory(actual, PIXEL_CASES, 'pixels');
  assert.ok(audit.problems.some((message) => message.includes('duplicate')));
  assert.ok(audit.problems.some((message) => message.includes('missing')));
});

test('failed, unattempted and fabricated status rows retain distinct accounting', () => {
  const actual = PIXEL_CASES.map((row) => ({ ...row, status: 'ok' }));
  actual[0].status = 'failed';
  actual[1].status = 'unattempted';
  actual[2].status = 'skipped-as-success';
  const audit = auditInventory(actual, PIXEL_CASES, 'pixels');
  assert.equal(audit.failed, 1);
  assert.equal(audit.unattempted, 1);
  assert.ok(audit.problems.some((message) => message.includes('invalid status')));
});

test('no native observation remains unexecuted, without a product budget claim', async () => {
  const result = await analyzeReceipt(emptyReceipt(), () => {
    throw new Error('must not fabricate pixels');
  });
  assert.equal(result.accepted, false);
  assert.equal(result.productBudget, 'not-evaluated');
  assert.equal(result.inventory.pixels.unattempted, 72);
  assert.equal(result.inventory.stages.unattempted, 120);
});

test('reader independently rejects reversed times and duplicate render work', async () => {
  const report = emptyReceipt(),
    row = {
      ...STAGE_CASES[0],
      status: 'ok',
      timestamps: {
        renderStart: 10,
        renderEnd: 9,
        copyStart: 11,
        copySubmitted: 12,
        copyReadbackEnd: 13,
        encodeStart: 14,
        encodeEnd: 15,
        decodeStart: 16,
        decodeReady: 17,
        callbackStart: 17,
        callbackEnd: 18,
      },
      encoderCalls: 1,
      copyCalls: 1,
      encoderReturnMatchesProgram: true,
      encoderArguments: ['image/png'],
      programCounters: { renders: 2 },
      imageCounters: {
        imagePreparations: 1,
        imageDecodes: 1,
        imageReadyCallbacks: 1,
        imageDecodeFailures: 0,
        imageDecodeCancellations: 0,
        imageReadyCallbackFailures: 0,
        imageReuseHits: 0,
      },
      planes: { candidateRaw: 'candidate', referenceRaw: 'reference' },
    };
  report.contexts = [{ dpr: 1, errors: [], pixels: [], stages: [row], lifetime: [], controls: [] }];
  const result = await analyzeReceipt(report, async () => pixels());
  assert.ok(result.failures.some((failure) => failure.id === `${row.id}/timings`));
  assert.ok(result.failures.some((failure) => failure.id === `${row.id}/complete-work`));
  assert.equal(result.stageResults.length, 0);
});

test('reader reports a real leak even when collection labels itself successful', async () => {
  const report = emptyReceipt();
  report.contexts = [
    {
      dpr: 1,
      environment: { devicePixelRatio: 1, secureContext: true },
      errors: [],
      pixels: [],
      stages: [],
      lifetime: [],
      controls: [],
      cleanup: { immediate: { ownersLive: 1 }, afterTwoRaf: { ownersLive: 1 } },
    },
  ];
  const result = await analyzeReceipt(report, async () => pixels());
  assert.ok(result.failures.some((failure) => failure.id === 'cleanup-1-immediate'));
  assert.ok(result.failures.some((failure) => failure.id === 'cleanup-1-afterTwoRaf'));
});

test('original raw artifact corruption is rejected by the independent disk reader', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pui-canvas-reader-'));
  try {
    const original = Buffer.from(pixels().pixels),
      changed = Buffer.from(original);
    changed[8]++;
    const report = {
      ...emptyReceipt(),
      artifacts: [
        {
          path: 'pixels.rgba',
          bytes: original.length,
          sha256: createHash('sha256').update(original).digest('hex'),
        },
      ],
    };
    await writeFile(path.join(directory, 'pixels.rgba'), changed);
    await writeFile(path.join(directory, 'report.json'), JSON.stringify(report));
    const analysis = await analyzeFromDisk(path.join(directory, 'report.json'), false);
    assert.ok(
      analysis.artifactFailures.some(
        (row) => row.path === 'pixels.rgba' && row.error.includes('digest')
      )
    );
    assert.equal(analysis.accepted, false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('receipt paths cannot make the disk reader open files outside its own evidence directory', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pui-canvas-reader-path-'));
  try {
    const report = {
      ...emptyReceipt(),
      artifacts: [{ path: '../outside.rgba', bytes: 16, sha256: '0'.repeat(64) }],
    };
    await writeFile(path.join(directory, 'report.json'), JSON.stringify(report));
    const analysis = await analyzeFromDisk(path.join(directory, 'report.json'), false);
    assert.ok(analysis.artifactFailures.some((row) => row.error.includes('Unsafe path')));
    assert.equal(
      await readFile(path.join(directory, 'report.json'), 'utf8'),
      JSON.stringify(report)
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
