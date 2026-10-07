import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  authorizePullRequestMerge,
  authorizeReviewSubmission,
  computeReviewIngestionInputDigest,
  computeReviewInputDigest,
  decideReviewRun,
  inspectReviewRevision,
  renderReviewBody,
  reviewChangesSpecEntities,
  reviewPacketKey,
  validateReviewInputForIngestion,
  validateReviewInputSnapshot,
  validateReviewPacket,
  verifyLiveReviewInput,
} from '../review-runtime.mjs';
import { agentEvidence } from './fixtures/agent-evidence.mjs';
import { writeModelTraceFixture } from './fixtures/modeltrace.mjs';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const command = path.join(root, 'scripts/agent-operations/review-packet.mjs');
const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
const legacyInput = () => fixture('review-input-v3-public-main');
const legacyPacket = () => fixture('review-packet-v1-public-main');

// Public source: https://github.com/Proto-UI/Proto-UI/blob/f5bae261491368b586959f1d8b353cf372775221/scripts/agent-operations/test/review-runtime.test.mjs#L34-L110
// License: https://github.com/Proto-UI/Proto-UI/blob/f5bae261491368b586959f1d8b353cf372775221/LICENSE (MIT).
// Input is the unchanged public v3 reviewInput() fixture. Packet adapts the public
// packet() helper to schema v1 COMMENT, omits agentEvidence, and uses no human gates.
// This golden was computed by review-runtime.mjs at that exact public revision.
const golden = '41608b635ae1e121bfda0a871af2ce10e07c131aedd260a6c06c7bbf118e5ba4';

test('public-main v3/v1 COMMENT ingestion preserves the historical shape and golden digest', () => {
  const input = legacyInput();
  const packet = legacyPacket();
  const original = structuredClone(input);
  assert.equal(validateReviewInputForIngestion(input), input);
  assert.equal(computeReviewIngestionInputDigest(input), golden);
  assert.equal(validateReviewPacket(packet, input), packet);
  assert.deepEqual(input, original);
  assert.equal(Object.hasOwn(input, 'reviewerPermissions'), false);
  assert.equal(Object.hasOwn(input, 'pullRequestAuthor'), false);
  assert.deepEqual(Object.keys(input.commits[0]).sort(), ['message', 'sha']);
  const key = reviewPacketKey(packet, input);
  assert.equal(decideReviewRun(packet, input, [key]).duplicate, true);
  assert.equal(inspectReviewRevision(packet, input, input.headSha).stale, false);
  assert.equal(inspectReviewRevision(packet, input, 'c'.repeat(40)).stale, true);
  const body = renderReviewBody(packet);
  assert.match(body, /legacy schema v1.*cannot authorize a review disposition or merge/);
  assert.match(body, /proto-ui:review-packet:sha256=/);
  assert.doesNotMatch(body, /proto-ui:agent-evidence:sha256=/);
});

test('legacy canonicalization sorts evidence without ignoring changed evidence', () => {
  const input = legacyInput();
  input.changedFiles.push({ path: 'docs/broker.md', previousPath: null, status: 'added' });
  input.commits.push({ sha: 'c'.repeat(40), message: 'Earlier change' });
  input.checks.push({ ...input.checks[0], name: 'type-check' });
  input.comments = ['one', 'two'].map((id) => ({
    id,
    author: 'reviewer',
    body: id,
    updatedAt: '2026-08-23T00:00:00.000Z',
  }));
  const reversed = structuredClone(input);
  for (const value of Object.values(reversed)) if (Array.isArray(value)) value.reverse();
  assert.equal(
    computeReviewIngestionInputDigest(input),
    computeReviewIngestionInputDigest(reversed)
  );
  const packet = { ...legacyPacket(), reviewInputDigest: computeReviewIngestionInputDigest(input) };
  for (const change of [
    (value) => {
      value.pullRequestBody += ' changed';
    },
    (value) => {
      value.commits[0].message += ' changed';
    },
    (value) => {
      value.checks[0].conclusion = 'FAILURE';
    },
    (value) => {
      value.comments[0].body += ' changed';
    },
    (value) => {
      value.changedFiles[0].previousPath = 'old/path.go';
    },
  ]) {
    const changed = structuredClone(input);
    change(changed);
    assert.throws(() => validateReviewPacket(packet, changed), /canonical input snapshot/);
  }
  assert.throws(
    () => validateReviewPacket(packet, { ...input, headSha: 'd'.repeat(40) }),
    /does not match its input snapshot/
  );
});

test('legacy ingestion rejects added authority fields and malformed historical data', () => {
  for (const change of [
    (input) => {
      input.reviewerPermissions = [];
    },
    (input) => {
      input.pullRequestAuthor = 'asserted-author';
    },
    (input) => {
      input.commits[0].author = { login: 'asserted-author' };
    },
    (input) => {
      input.checks[0].providerId = 'asserted-provider';
    },
    (input) => {
      input.commits.push(structuredClone(input.commits[0]));
    },
    (input) => {
      input.changedFiles[0].path = '../escape';
    },
    (input) => {
      input.comments = null;
    },
    (input) => {
      input.reviews = [
        {
          id: 'review',
          author: null,
          state: 'COMMENTED',
          commitSha: input.headSha,
          submittedAt: '2026-08-23T00:00:00.000Z',
          body: '',
        },
      ];
    },
  ]) {
    const input = legacyInput();
    change(input);
    assert.throws(() => validateReviewInputForIngestion(input));
    assert.throws(() => computeReviewIngestionInputDigest(input));
  }
});

test('v3 compatibility cannot ingest formal dispositions or Agent evidence', () => {
  const input = legacyInput();
  for (const recommendedAction of ['APPROVE', 'REQUEST_CHANGES', 'ABSTAIN']) {
    assert.throws(
      () => validateReviewPacket({ ...legacyPacket(), recommendedAction }, input),
      /only ingest a schema v1 COMMENT/
    );
  }
  assert.throws(
    () =>
      validateReviewPacket(
        { ...legacyPacket(), agentEvidence: agentEvidence(input.headSha) },
        input
      ),
    /unexpected or missing fields/
  );
  assert.throws(
    () =>
      validateReviewPacket(
        { ...legacyPacket(), schemaVersion: 2, agentEvidence: agentEvidence(input.headSha) },
        input
      ),
    /only ingest a schema v1 COMMENT/
  );
});

test('strict v5 APIs and mutation boundaries reject legacy input even with caller authority claims', () => {
  const input = legacyInput();
  const packet = legacyPacket();
  for (const validate of [
    validateReviewInputSnapshot,
    computeReviewInputDigest,
    reviewChangesSpecEntities,
  ]) {
    assert.throws(() => validate(input), /schemaVersion/);
  }
  assert.throws(() => verifyLiveReviewInput(packet, input), /schemaVersion/);
  const claims = {
    packet,
    input,
    liveInput: structuredClone(input),
    executionMode: 'human-assisted',
    executionModeSource: 'current-user',
    authorizationId: 'explicit-current-user',
    policy: {},
    credentialCanReview: true,
    credentialCanMerge: true,
    reviewer: 'independent',
    actor: 'maintainer',
    ciConclusion: 'success',
    dcoConclusion: 'success',
    mergeable: 'MERGEABLE',
    mergeStateStatus: 'CLEAN',
  };
  for (const authorize of [authorizeReviewSubmission, authorizePullRequestMerge]) {
    for (const recommendedAction of ['COMMENT', 'APPROVE', 'REQUEST_CHANGES']) {
      assert.throws(
        () => authorize({ ...claims, packet: { ...packet, recommendedAction } }),
        /v3 is read-only; re-collect v5/
      );
    }
  }
});

test('v4 still requires recollection and v5 cannot inherit missing legacy identity facts', () => {
  const v4 = { ...legacyInput(), schemaVersion: 4 };
  for (const validate of [validateReviewInputForIngestion, computeReviewIngestionInputDigest]) {
    assert.throws(() => validate(v4), /v4 must be re-collected as v5/);
  }
  assert.throws(() => validateReviewPacket(legacyPacket(), v4), /v4 must be re-collected as v5/);
  const mislabeled = { ...legacyInput(), schemaVersion: 5 };
  assert.throws(() => validateReviewInputForIngestion(mislabeled), /unexpected or missing fields/);
  assert.throws(
    () => computeReviewIngestionInputDigest(mislabeled),
    /unexpected or missing fields/
  );
});

function withCliFixtures(run) {
  const directory = mkdtempSync(path.join(tmpdir(), 'poppy-legacy-ingestion-'));
  try {
    const inputPath = path.join(directory, 'input.json');
    const packetPath = path.join(directory, 'packet.json');
    const handoffPath = path.join(directory, 'handoff.json');
    const ghMarker = path.join(directory, 'unexpected-gh-call');
    const trace = writeModelTraceFixture(directory);
    writeFileSync(inputPath, JSON.stringify(legacyInput()));
    writeFileSync(packetPath, JSON.stringify(legacyPacket()));
    writeFileSync(
      handoffPath,
      JSON.stringify({
        schemaVersion: 1,
        kind: 'proto-ui.skill-handoff',
        entrypoint: 'development',
        executionMode: 'human-assisted',
        executionModeSource: 'current-user',
        fromId: 'pui-dev', // This fixture starts at review intake, not a validation transition.
        nextSkillId: 'pui-review',
        artifacts: [
          { type: 'authority-map', reference: 'legacy compatibility contract' },
          { type: 'candidate-change', reference: 'legacy COMMENT ingestion' },
          { type: 'evidence-report', reference: 'public-main canonical v3 golden' },
          { type: 'review-input', reference: inputPath },
          trace.artifact,
        ],
        humanGates: [],
        notes: [],
      })
    );
    writeFileSync(
      path.join(directory, 'gh'),
      `#!${process.execPath}\nrequire('node:fs').writeFileSync(${JSON.stringify(ghMarker)}, 'unexpected'); process.exit(99);\n`,
      { mode: 0o755 }
    );
    const options = {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${directory}:${process.env.PATH}` },
    };
    run({ inputPath, packetPath, handoffPath, ghMarker, options, trace });
    assert.equal(existsSync(ghMarker), false, 'legacy commands must not invoke GitHub');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('CLI read-only digest, validate, and inspect retain actual v3/v1 compatibility', () => {
  withCliFixtures(({ inputPath, packetPath, handoffPath, options }) => {
    const cli = (args) => JSON.parse(execFileSync(process.execPath, [command, ...args], options));
    const digest = cli(['input-digest', '--input', inputPath]);
    assert.equal(digest.reviewInputDigest, golden);
    const args = ['--input', inputPath, '--packet', packetPath, '--handoff', handoffPath];
    const validation = cli(['validate', ...args]);
    assert.equal(validation.valid, true);
    const inspection = cli([
      'inspect',
      ...args,
      '--current-base',
      legacyInput().baseSha,
      '--current-head',
      legacyInput().headSha,
      '--seen-keys',
      validation.key,
    ]);
    assert.equal(inspection.revision.stale, false);
    assert.equal(inspection.run.duplicate, true);
  });
});

test('CLI legacy write commands reject before live collection or mutation', () => {
  withCliFixtures(({ inputPath, packetPath, handoffPath, options, trace }) => {
    for (const action of ['submit-review', 'merge-pull-request']) {
      if (action === 'merge-pull-request') {
        const handoff = JSON.parse(readFileSync(handoffPath, 'utf8'));
        handoff.fromId = 'pui-review';
        handoff.nextSkillId = 'pui-integrate';
        handoff.artifacts = [
          { type: 'review-input', reference: inputPath },
          { type: 'review-packet', reference: packetPath },
          { type: 'published-review-packet', reference: packetPath },
          { type: 'mutation-authorization', reference: 'explicit-current-user' },
          trace.artifact,
        ];
        writeFileSync(handoffPath, JSON.stringify(handoff));
      }
      const result = spawnSync(
        process.execPath,
        [
          command,
          action,
          '--mode',
          'human-assisted',
          '--mode-source',
          'current-user',
          '--input',
          inputPath,
          '--packet',
          packetPath,
          '--handoff',
          handoffPath,
          '--authorization',
          'explicit-current-user',
          '--record',
          trace.recordPath,
          '--context',
          trace.contextPath,
        ],
        options
      );
      assert.equal(result.status, 1);
      assert.match(result.stderr, /v3 is read-only; re-collect v5/);
    }
  });
});
