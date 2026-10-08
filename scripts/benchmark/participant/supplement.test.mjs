import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { jsonBytes, sha256 } from './nine-plan.mjs';
import { freezeSupplement, inspectSupplement, supplementSources } from './supplement-plan.mjs';
import {
  settingDifference,
  usageReference,
  validateSupplementAuthorization,
} from './supplement-runner.mjs';

// Local, read-only evidence fixtures; these tests never dispatch a participant or open a browser.
const sourceRoot = fileURLToPath(new URL('../../../', import.meta.url));
const parentRoot =
  '/Users/yangguangliang/.codex/experiment-artifacts/2026-10-05-noncompiler-value/nine-run-live-v1';
const artifactRoot =
  '/Users/yangguangliang/.codex/experiment-artifacts/2026-10-08-noncompiler-supplement-v1';
const parentDirectory = path.join(parentRoot, 'plan/frozen-v1.2');
const parentLedgerPath = path.join(parentRoot, 'execution/ledger.json');
const parentManifestSha256 = '19c22b29dd5df723efa8f268f7fbf175524b168294e9d201393c0b8696691639';
const parentLedgerSha256 = '8ca8d0609f6b8a37cf490b7815a01d29cfb8b34d05ef9b576c33c74b3e06d596';
const conditions = ['none', 'ordinary', 'proto'];
const mandatorySources = [
  'supplement-plan.mjs',
  'supplement-runner.mjs',
  'supplement-live.mjs',
  'supplement.test.mjs',
].map((name) => `scripts/benchmark/participant/${name}`);

async function fixture(t) {
  // Resolve macOS's temporary-directory symlink before the plan's safe-path checks.
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'supplement-unit-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  const parentBytes = await readFile(path.join(parentDirectory, 'manifest.json'));
  const ledgerBytes = await readFile(parentLedgerPath);
  assert.equal(sha256(parentBytes), parentManifestSha256);
  assert.equal(sha256(ledgerBytes), parentLedgerSha256);
  const parent = JSON.parse(parentBytes);
  const ledger = JSON.parse(ledgerBytes);
  const copiedSourceRoot = path.join(root, 'source');
  for (const source of new Set([
    ...parent.inventory.filter((entry) => entry.source).map((entry) => entry.source),
    ...supplementSources,
  ])) {
    const destination = path.join(copiedSourceRoot, source);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(sourceRoot, source), destination);
  }
  const options = {
    directory: path.join(root, 'frozen'),
    parentDirectory,
    parentManifestSha256,
    parentLedgerPath,
    userAuthorizationPath: path.join(artifactRoot, 'user-authorization.json'),
    diagnosticPath: path.join(artifactRoot, 'diagnostic-result.json'),
    sourceRoot: copiedSourceRoot,
  };
  const frozen = await freezeSupplement(options);
  const inspect = (manifestSha256 = frozen.manifestSha256) =>
    inspectSupplement({
      directory: options.directory,
      manifestSha256,
      sourceRoot: copiedSourceRoot,
    });
  return { root, options, parent, ledger, parentBytes, ledgerBytes, frozen, inspect };
}

test('freeze preserves the exact six suffix slots and byte-identical isolated requests', async (t) => {
  const f = await fixture(t);
  const { manifest, packets } = await f.inspect();
  assert.equal(
    sha256(await readFile(path.join(f.options.directory, 'manifest.json'))),
    f.frozen.manifestSha256
  );
  assert.deepEqual(manifest, f.frozen.manifest);
  assert.deepEqual(
    manifest.schedule.map((slot) => slot.condition),
    ['proto', 'ordinary', 'none', 'none', 'proto', 'ordinary']
  );
  assert.deepEqual(
    manifest.schedule,
    f.parent.schedule.slice(3).map((slot, index) => ({
      ...slot,
      id: `supplement-1-attempt-${index + 1}`,
      originalSlotId: slot.id,
      originalSlotOrdinal: index + 4,
      newAttemptOrdinal: index + 1,
    }))
  );
  assert.deepEqual(manifest.packets, f.parent.packets);
  assert.deepEqual(
    manifest.supplementSources.map((entry) => entry.source),
    supplementSources
  );
  for (const source of mandatorySources)
    assert.ok(
      manifest.supplementSources.some((entry) => entry.source === source),
      source
    );
  for (const condition of conditions) {
    const descriptors = f.parent.packets[condition];
    const packetBytes = await readFile(path.join(parentDirectory, descriptors.packet.path));
    const requestBytes = await readFile(path.join(parentDirectory, descriptors.request.path));
    assert.deepEqual(packets[condition].packet, JSON.parse(packetBytes));
    assert.deepEqual(packets[condition].request, JSON.parse(requestBytes));
    assert.ok(
      packets[condition].requestBytes.equals(requestBytes),
      `${condition}: exact wire bytes`
    );
    assert.equal(sha256(jsonBytes(packets[condition].packet)), descriptors.packet.sha256);
    assert.equal(sha256(packets[condition].requestBytes), descriptors.request.sha256);
  }
  // Exact parent-byte equality also rules out appending baseline, review or earlier output context.
  assert.deepEqual(
    packets.none.packet.materials.map((item) => item.name),
    ['starting-code']
  );
  assert.deepEqual(
    packets.ordinary.packet.materials.map((item) => item.name),
    ['starting-code', 'documentation']
  );
  assert.notEqual(
    packets.ordinary.packet.materials[1].sha256,
    packets.proto.packet.materials[1].sha256
  );
});

test('original settings and nonfee boundaries are inherited without changing the parent evidence', async (t) => {
  const f = await fixture(t);
  const { manifest } = await f.inspect();
  assert.deepEqual(manifest.parent, {
    directory: parentDirectory,
    manifestSha256: parentManifestSha256,
    ledgerPath: parentLedgerPath,
    ledgerSha256: parentLedgerSha256,
  });
  for (const row of f.ledger.rows.slice(0, 3))
    assert.deepEqual(manifest.settingsBaseline, row.reportedSettings);
  for (const key of ['model', 'wire', 'coreInventory', 'newFeatureCriteria', 'regressionCriteria'])
    assert.deepEqual(manifest[key], f.parent[key], key);
  for (const key of [
    'participantWallMs',
    'serialDispatchWindowMs',
    'rawResponseBytes',
    'deliverableBytes',
    'browserWallMs',
    'retries',
    'discovery',
  ])
    assert.equal(manifest.budgets[key], f.parent.budgets[key], key);
  assert.equal(manifest.budgets.participantDispatches, 6);
  assert.equal(manifest.budgets.reservations, 6);
  assert.equal(manifest.seed, f.parent.randomization.seed);
  assert.equal(manifest.budgetPolicy.maxParticipantDispatches, 6);
  assert.equal(manifest.budgetPolicy.referenceEnvelopeStopEnabled, false);
  assert.equal(manifest.budgetPolicy.actualMonetaryLimitUSD, null);
  assert.equal(manifest.budgetPolicy.hardMonetaryCapUSD, null);
  assert.equal(manifest.budgetPolicy.actualBillingUSD, null);
  assert.equal(manifest.budgetPolicy.noNewCreditPurchase, true);
  assert.deepEqual(manifest.budgetPolicy.stops, f.parent.budgetPolicy.stops);
  assert.equal(usageReference(null).referenceUSD, null);
  assert.equal(usageReference({ input_tokens: 10 }).referenceUSD, null);
  assert.equal(usageReference({ input_tokens: 10, output_tokens: 20 }).actualUSD, null);
  assert.ok((await readFile(path.join(parentDirectory, 'manifest.json'))).equals(f.parentBytes));
  assert.ok((await readFile(parentLedgerPath)).equals(f.ledgerBytes));
  for (const entry of f.parent.inventory)
    assert.equal(
      sha256(await readFile(path.join(parentDirectory, entry.path))),
      entry.sha256,
      entry.path
    );
});

test('inspection rejects supplemental source drift in copied sources and frozen captures', async (t) => {
  const f = await fixture(t);
  for (const entry of f.frozen.manifest.supplementSources) {
    for (const file of [
      path.join(f.options.sourceRoot, entry.source),
      path.join(f.options.directory, entry.path),
    ]) {
      await t.test(
        `${entry.source}: ${file.startsWith(f.options.sourceRoot) ? 'current copy' : 'frozen capture'}`,
        async () => {
          const original = await readFile(file);
          const changed = Buffer.from(original);
          changed[0] ^= 1; // Same-length mutation exercises the hash check, not just byte count.
          try {
            await writeFile(file, changed);
            await assert.rejects(f.inspect(), /Supplement source digest drift/);
          } finally {
            await writeFile(file, original);
          }
        }
      );
    }
  }
  await f.inspect();
});

test('inspection rejects manifest tampering even when its new digest is supplied', async (t) => {
  const f = await fixture(t);
  const file = path.join(f.options.directory, 'manifest.json');
  const original = await readFile(file);
  for (const [label, mutate] of [
    ['suffix reorder', (m) => m.schedule.reverse()],
    [
      'parent baseline reset',
      (m) => {
        m.settingsBaseline.temperature = 0.5;
      },
    ],
    [
      'fee stop reintroduced',
      (m) => {
        m.budgetPolicy.referenceEnvelopeStopEnabled = true;
      },
    ],
    [
      'mandatory source omitted',
      (m) => {
        m.supplementSources = m.supplementSources.filter((e) => e.source !== mandatorySources[3]);
      },
    ],
  ]) {
    await t.test(label, async () => {
      const changed = JSON.parse(original);
      mutate(changed);
      const bytes = jsonBytes(changed);
      try {
        await writeFile(file, bytes);
        await assert.rejects(f.inspect(), /Supplement manifest changed/);
        await assert.rejects(
          f.inspect(sha256(bytes)),
          /Supplement changes beyond authorized suffix\/execution metadata|Required supplemental source inventory/
        );
      } finally {
        await writeFile(file, original);
      }
    });
  }
  await f.inspect();
});

test('six-only authorization preserves missing-usage stops and requires live review bindings', async (t) => {
  const f = await fixture(t);
  const { manifest, manifestSha256 } = f.frozen;
  const validate = (authorization, mode) =>
    validateSupplementAuthorization({ authorization, manifest, manifestSha256, mode });
  const offline = {
    approved: true,
    manifestSha256,
    mode: 'offline-synthetic',
    maxDispatches: 6,
    retries: 0,
  };
  const live = {
    ...offline,
    mode: 'live-participant',
    routeFingerprint: manifest.executionConfig.routeFingerprint,
    moneyRisk: {
      explicitUserApproval: true,
      unknownActualBillingAccepted: true,
      referenceEnvelopeIsNotHardCap: true,
      noNewCreditPurchase: true,
      costLimitsRemovedByUser: true,
    },
    allowUnknownUsage: false,
    userDecisionReference: f.options.userAuthorizationPath,
    reviewReference: path.join(f.root, 'synthetic-independent-review.json'),
    reviewSha256: sha256('synthetic review digest; no dispatch authorization issued'),
  };
  assert.doesNotThrow(() => validate(offline, offline.mode));
  assert.doesNotThrow(() => validate(live, live.mode));
  for (const authorization of [offline, live]) {
    assert.throws(() => validate({ ...authorization, maxDispatches: 9 }, authorization.mode));
    assert.throws(() => validate({ ...authorization, retries: 1 }, authorization.mode));
    assert.throws(
      () => validate({ ...authorization, manifestSha256: '0'.repeat(64) }, authorization.mode),
      /Authorization plan mismatch/
    );
  }
  assert.throws(
    () => validate({ ...live, allowUnknownUsage: true }, live.mode),
    /Existing missing-usage stop policy required/
  );
  assert.throws(() => validate({ ...live, reviewSha256: 'not-a-digest' }, live.mode));
  assert.throws(() => validate({ ...live, reviewReference: 'relative-review.json' }, live.mode));
  for (const key of ['reviewReference', 'reviewSha256']) {
    const changed = { ...live };
    delete changed[key];
    assert.throws(() => validate(changed, live.mode), /Authorization fields/);
  }
});

const comparatorManifest = {
  model: { requestedAlias: 'gpt-6.1-sol' },
  wire: { max_output_tokens: 8192 },
};
const reported = {
  model: 'gpt-6.1-sol',
  max_output_tokens: null,
  temperature: 1,
  top_p: 0.98,
  reasoning: { context: 'all_turns', effort: 'medium', mode: 'standard', summary: null },
  service_tier: 'default',
  tools: [],
  tool_choice: 'none',
  store: false,
};

test('setting comparison ignores JSON object key order without changing the baseline', () => {
  const first = structuredClone(reported);
  const before = jsonBytes(first);
  const next = Object.fromEntries(Object.entries(structuredClone(first)).reverse());
  next.reasoning = { summary: null, mode: 'standard', effort: 'medium', context: 'all_turns' };
  assert.notEqual(JSON.stringify(first), JSON.stringify(next));
  assert.equal(settingDifference(first, next, comparatorManifest), null);
  assert.ok(jsonBytes(first).equals(before));
});

test('setting comparison still stops actual model, fixed-wire or reported setting changes', () => {
  for (const [change, expected] of [
    [{ model: 'different-model' }, 'returned-model-mismatch'],
    [{ tools: [{ type: 'function' }] }, 'returned-setting-mismatch:tools'],
    [{ tool_choice: 'auto' }, 'returned-setting-mismatch:tool_choice'],
    [{ store: true }, 'returned-setting-mismatch:store'],
    [{ max_output_tokens: 8193 }, 'returned-setting-mismatch:max_output_tokens'],
    [{ temperature: 0.5 }, 'reported-identity-or-setting-change'],
    [{ top_p: 0.5 }, 'reported-identity-or-setting-change'],
    [
      { reasoning: { ...reported.reasoning, effort: 'high' } },
      'reported-identity-or-setting-change',
    ],
    [
      { reasoning: { ...reported.reasoning, summary: 'auto' } },
      'reported-identity-or-setting-change',
    ],
    [{ service_tier: 'priority' }, 'reported-identity-or-setting-change'],
  ]) {
    assert.equal(
      settingDifference(reported, { ...reported, ...change }, comparatorManifest),
      expected,
      JSON.stringify(change)
    );
  }
});
