import assert from 'node:assert/strict';
import test from 'node:test';
import {
  emptyCloudReviewLedger,
  LEDGER_REPOSITORY,
  LEDGER_PRINCIPAL,
  reduceCloudReviewLedger,
} from '../cloud-review-ledger.mjs';
import {
  cloudReviewMaterialDigest,
  matchesCloudReviewMaterialReceipt,
  validateCloudReviewMaterial,
} from '../cloud-review-material.mjs';
import { analysis } from './fixtures/cloud-review.mjs';

function projection() {
  const { input } = analysis();
  input.reviews = [
    {
      id: 'PRR_99',
      author: LEDGER_PRINCIPAL.login,
      state: 'APPROVED',
      commitSha: input.headSha,
      submittedAt: '2026-10-03T00:02:00Z',
      body: 'Exact review body',
    },
  ];
  return {
    version: 1,
    input,
    reviewIdentities: [{ nodeId: 'PRR_99', id: '99', authorId: LEDGER_PRINCIPAL.id }],
  };
}
function command(reviewMaterial = projection()) {
  return {
    type: 'enqueue',
    deliveryId: 'own-material-schema',
    pullRequest: 487,
    eventKind: 'human-review',
    materialDigest: cloudReviewMaterialDigest(reviewMaterial),
    reviewMaterial,
  };
}
function receipt(p = projection()) {
  return {
    repositoryId: LEDGER_REPOSITORY,
    pullRequest: 487,
    id: '99',
    nodeId: 'PRR_99',
    authorId: LEDGER_PRINCIPAL.id,
    authorLogin: LEDGER_PRINCIPAL.login,
    commitId: p.input.headSha,
    state: 'APPROVED',
    body: 'Exact review body',
  };
}
const empty = () => emptyCloudReviewLedger({ publicationEnabled: true });

test('review material projection is schema-exact, target-bound and raw-digest-bound', async (t) => {
  const cases = [
    [
      'null',
      (c) => {
        c.reviewMaterial = null;
      },
    ],
    [
      'version missing',
      (c) => {
        delete c.reviewMaterial.version;
      },
    ],
    ...[0, 2, null, '1'].map((version) => [
      `version ${JSON.stringify(version)}`,
      (c) => {
        c.reviewMaterial.version = version;
      },
    ]),
    [
      'extra field',
      (c) => {
        c.reviewMaterial.extra = true;
      },
    ],
    [
      'missing input',
      (c) => {
        delete c.reviewMaterial.input;
      },
    ],
    [
      'extra input field',
      (c) => {
        c.reviewMaterial.input.extra = true;
      },
    ],
    [
      'missing input field',
      (c) => {
        delete c.reviewMaterial.input.comments;
      },
    ],
    [
      'repository',
      (c) => {
        c.reviewMaterial.input.repositoryId = 'github.com:other/repository';
      },
    ],
    [
      'pull request',
      (c) => {
        c.reviewMaterial.input.pullRequest = 488;
      },
    ],
    [
      'raw digest',
      (c) => {
        c.materialDigest = 'f'.repeat(64);
      },
    ],
    [
      'body not digest-bound',
      (c) => {
        c.reviewMaterial.input.pullRequestBody += 'changed';
      },
    ],
    [
      'review body not digest-bound',
      (c) => {
        c.reviewMaterial.input.reviews[0].body += 'changed';
      },
    ],
    [
      'identity not digest-bound',
      (c) => {
        c.reviewMaterial.reviewIdentities[0].authorId = '123';
      },
    ],
    [
      'missing identities',
      (c) => {
        delete c.reviewMaterial.reviewIdentities;
      },
    ],
    [
      'incomplete identities',
      (c) => {
        c.reviewMaterial.reviewIdentities = [];
      },
    ],
    [
      'extra identity field',
      (c) => {
        c.reviewMaterial.reviewIdentities[0].extra = true;
      },
    ],
    [
      'missing identity field',
      (c) => {
        delete c.reviewMaterial.reviewIdentities[0].id;
      },
    ],
    [
      'identity node mismatch',
      (c) => {
        c.reviewMaterial.reviewIdentities[0].nodeId = 'PRR_other';
      },
    ],
    [
      'numeric identity type',
      (c) => {
        c.reviewMaterial.reviewIdentities[0].id = 99;
      },
    ],
    [
      'malformed identity',
      (c) => {
        c.reviewMaterial.reviewIdentities[0].id = '-1';
      },
    ],
    [
      'malformed actor identity',
      (c) => {
        c.reviewMaterial.reviewIdentities[0].authorId = 'unknown';
      },
    ],
  ];
  for (const [name, mutate] of cases)
    await t.test(name, () => {
      const c = command();
      mutate(c);
      assert.throws(() => reduceCloudReviewLedger(empty(), c));
    });
  assert.equal(reduceCloudReviewLedger(empty(), command()).pending[0].generation, 1);
  const duplicate = projection();
  duplicate.input.reviews.push({ ...duplicate.input.reviews[0], id: 'PRR_100' });
  duplicate.reviewIdentities.push({ ...duplicate.reviewIdentities[0], nodeId: 'PRR_100' });
  assert.throws(
    () => reduceCloudReviewLedger(empty(), command(duplicate)),
    /duplicate review material identity/
  );
});

test('every exact receipt binding is necessary to remove only the actual own review', async (t) => {
  const p = projection();
  validateCloudReviewMaterial(p, LEDGER_REPOSITORY, 487);
  const own = receipt(p);
  const raw = cloudReviewMaterialDigest(p);
  const noReview = structuredClone(p);
  noReview.input.reviews = [];
  noReview.reviewIdentities = [];
  assert.equal(cloudReviewMaterialDigest(p, [own]), cloudReviewMaterialDigest(noReview));
  for (const [field, value] of Object.entries({
    repositoryId: 'github.com:other/repository',
    pullRequest: 488,
    id: '100',
    nodeId: 'PRR_100',
    authorId: '123',
    authorLogin: 'contributor',
    commitId: 'c'.repeat(40),
    state: 'DISMISSED',
    body: 'different body',
  }))
    await t.test(field, () => {
      const mismatched = { ...own, [field]: value };
      assert.equal(matchesCloudReviewMaterialReceipt(p, 0, mismatched), false);
      assert.equal(cloudReviewMaterialDigest(p, [mismatched]), raw);
    });
  for (const field of ['id', 'authorId']) {
    const missing = structuredClone(p);
    missing.reviewIdentities[0][field] = null;
    validateCloudReviewMaterial(missing, LEDGER_REPOSITORY, 487);
    assert.equal(matchesCloudReviewMaterialReceipt(missing, 0, own), false);
  }
  const human = structuredClone(p);
  human.input.reviews.push({
    ...human.input.reviews[0],
    id: 'PRR_100',
    author: 'contributor',
    body: 'Human',
  });
  human.reviewIdentities.push({ nodeId: 'PRR_100', id: '100', authorId: '123' });
  assert.notEqual(cloudReviewMaterialDigest(human, [own]), cloudReviewMaterialDigest(noReview));
});

test('versioned delivery replay validates projections but never replaces immutable intake', () => {
  const c = command();
  const state = reduceCloudReviewLedger(empty(), c);
  assert.deepEqual(reduceCloudReviewLedger(state, c), state);
  const malformed = structuredClone(c);
  malformed.reviewMaterial.extra = true;
  assert.throws(
    () => reduceCloudReviewLedger(state, malformed),
    /unexpected review material fields/
  );
  const altered = structuredClone(c);
  altered.reviewMaterial.input.pullRequestBody = 'different';
  altered.materialDigest = cloudReviewMaterialDigest(altered.reviewMaterial);
  assert.throws(
    () => reduceCloudReviewLedger(state, altered),
    /delivery id reused with different evidence/
  );
  const fieldless = { ...c };
  delete fieldless.reviewMaterial;
  assert.throws(
    () => reduceCloudReviewLedger(state, fieldless),
    /delivery id reused with different evidence/
  );
  const legacy = reduceCloudReviewLedger(empty(), fieldless);
  assert.throws(
    () => reduceCloudReviewLedger(legacy, c),
    /delivery id reused with different evidence/
  );
});

test('review material projection is accepted only by enqueue, never terminal commands', () => {
  const owner = 'a'.repeat(32);
  const enqueue = command();
  const pending = reduceCloudReviewLedger(empty(), enqueue);
  const claimed = reduceCloudReviewLedger(pending, { type: 'claim', owner, pullRequest: 487 });
  const staged = reduceCloudReviewLedger(claimed, {
    type: 'stagePublicationIntent',
    owner,
    ...analysis(),
  });
  const cases = [
    [
      empty(),
      {
        type: 'captureInitialSweep',
        sweepId: 'owner-requested-open-pr-sweep-2026-10-03',
        pullRequests: [487],
      },
    ],
    [pending, { type: 'claim', owner, pullRequest: 487 }],
    [claimed, { type: 'abandon', owner }],
    ...['finishAnalysis', 'stageIntent', 'stageSimulationIntent', 'stagePublicationIntent'].map(
      (type) => [claimed, { type, owner, ...analysis() }]
    ),
    [staged, { type: 'cancelPublicationIntent', owner, intentId: staged.slot.intent.id }],
    [staged, { type: 'finalizePublication', owner, response: {}, readback: {} }],
    [staged, { type: 'finalizeSimulation', owner, response: {}, readback: {} }],
  ];
  for (const [state, c] of cases)
    assert.throws(
      () => reduceCloudReviewLedger(state, { ...c, reviewMaterial: projection() }),
      /unexpected command fields/,
      c.type
    );
});

test('receipt normalization is explicitly versioned only on the persisted publication intent', () => {
  const owner = 'a'.repeat(32);
  const pending = reduceCloudReviewLedger(empty(), command());
  const claimed = reduceCloudReviewLedger(pending, { type: 'claim', owner, pullRequest: 487 });
  const legacy = reduceCloudReviewLedger(claimed, {
    type: 'stagePublicationIntent',
    owner,
    ...analysis(),
  });
  const marked = reduceCloudReviewLedger(claimed, {
    type: 'stagePublicationIntent',
    owner,
    ...analysis(),
    receiptNormalizationVersion: 1,
  });
  assert.equal(legacy.slot.intent.analysis.receiptNormalizationVersion, undefined);
  assert.equal(marked.slot.intent.analysis.receiptNormalizationVersion, 1);
  for (const field of ['body', 'bodyDigest', 'packetDigest', 'id'])
    assert.equal(marked.slot.intent[field], legacy.slot.intent[field]);
  for (const receiptNormalizationVersion of [0, 2, null, '1'])
    assert.throws(
      () =>
        reduceCloudReviewLedger(claimed, {
          type: 'stagePublicationIntent',
          owner,
          ...analysis(),
          receiptNormalizationVersion,
        }),
      /unsupported receipt normalization version/
    );
  const cases = [
    [
      empty(),
      {
        type: 'captureInitialSweep',
        sweepId: 'owner-requested-open-pr-sweep-2026-10-03',
        pullRequests: [487],
      },
    ],
    [empty(), command()],
    [pending, { type: 'claim', owner, pullRequest: 487 }],
    [claimed, { type: 'abandon', owner }],
    ...['finishAnalysis', 'stageIntent', 'stageSimulationIntent'].map((type) => [
      claimed,
      { type, owner, ...analysis() },
    ]),
    [marked, { type: 'cancelPublicationIntent', owner, intentId: marked.slot.intent.id }],
    [marked, { type: 'finalizePublication', owner, response: {}, readback: {} }],
    [marked, { type: 'finalizeSimulation', owner, response: {}, readback: {} }],
  ];
  for (const [state, c] of cases)
    assert.throws(
      () => reduceCloudReviewLedger(state, { ...c, receiptNormalizationVersion: 1 }),
      /unexpected command fields/,
      c.type
    );
});
