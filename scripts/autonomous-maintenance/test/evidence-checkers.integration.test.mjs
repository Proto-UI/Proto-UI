import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { computeReviewedContentDigest } from '../reviewed-content-digest.mjs';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(testDirectory, '..', '..', '..');
const runChecker = path.join(workspaceRoot, 'scripts/autonomous-maintenance/check-runs.mjs');
const reviewChecker = path.join(
  workspaceRoot,
  'scripts/autonomous-maintenance/check-review-packets.mjs'
);

function writeFile(root, relativePath, content) {
  const file = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function markdownMetadata(title, metadata, sections = []) {
  return [
    `# ${title}`,
    '',
    '<!-- prettier-ignore -->',
    '```yaml',
    YAML.stringify(metadata).trimEnd(),
    '```',
    '',
    ...sections.flatMap((section) => [`## ${section}`, '', 'Fixture evidence.', '']),
  ].join('\n');
}

function writeRunLedger(root, run) {
  writeFile(
    root,
    'internal/autonomous-maintenance/phase-0/runs.yaml',
    YAML.stringify({ schemaVersion: 2, runs: [run] })
  );
}

function createFixture(t, { remediation = 'modify' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-ui-maintenance-check-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  execFileSync('git', ['config', 'core.autocrlf', 'false'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'checker@example.invalid'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'Checker Fixture'], { cwd: root });

  writeFile(
    root,
    'spec/contracts/C-TEST-0001.yaml',
    YAML.stringify({
      id: 'C-TEST-0001',
      status: 'active',
      criteria: [{ id: 'C-TEST-0001-A', statement: 'Fixture authority.' }],
    })
  );
  writeFile(root, 'src/example.js', 'export const projection = "before";\n');
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['commit', '--quiet', '-m', 'fixture baseline'], { cwd: root });
  const baselineCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  if (remediation === 'modify') {
    writeFile(root, 'src/example.js', 'export const projection = "after";\n');
  } else if (remediation === 'delete') {
    fs.rmSync(path.join(root, 'src/example.js'));
  } else if (remediation === 'rename') {
    fs.renameSync(path.join(root, 'src/example.js'), path.join(root, 'src/renamed.js'));
  } else {
    throw new Error(`unsupported remediation fixture: ${remediation}`);
  }

  const findingPath = 'internal/autonomous-maintenance/phase-0/findings/AM-P0-004-F1.md';
  const reviewPath = 'internal/autonomous-maintenance/phase-0/reviews/AM-P0-004-F1.md';
  const evidence = ['active authority and external oracle'];
  const decisionBoundary = {
    class: 'none',
    status: 'not-required',
    question: null,
    resolution: null,
    evidence: [],
  };
  const finding = {
    schemaVersion: 2,
    findingId: 'AM-P0-004-F1',
    runId: 'AM-P0-004',
    mission: 'Fixture mission',
    baselineCommit,
    scope: ['C-TEST-0001'],
    budgetClass: 'small',
    elapsedMinutes: null,
    claim: 'The projection differs from authority.',
    entities: ['C-TEST-0001'],
    criteria: ['C-TEST-0001-A'],
    lifecycle: 'Current active projection.',
    expected: 'The projection follows authority.',
    observed: 'The projection differs from authority.',
    reproduction: 'Compare the exact baseline artifacts.',
    commands: ['node --test fixture'],
    evidence: ['independent reproduction'],
    counterEvidence: [],
    likelyRootCause: 'The projection was stale.',
    impact: 'Readers infer incorrect behavior.',
    suggestedAction: 'Correct the bounded projection.',
    observer: {
      actorId: 'agent:observer-1',
      taskId: 'task:observation-1',
    },
    observerConfidence: 0.96,
    verifier: {
      actorId: 'agent:verifier-1',
      taskId: 'task:verification-1',
      status: 'completed',
      classification: 'confirmed',
      evidence: ['independent reproduction'],
      confidence: 0.98,
    },
    findingDisposition: {
      status: 'automatic-governed-remediation',
      evidence,
      factScore: 2,
      previouslyUnknown: true,
      hasExternalOracle: true,
      actionValue: 2,
      reviewMinutes: null,
      notes: 'Current authority fixes the expected result.',
    },
    decisionBoundary,
    remediationReview: {
      status: 'completed',
      packet: reviewPath,
      authorityResolution: 'governed',
      implementationVerification: 'passed',
      integrationEligibility: 'eligible',
      reviewMinutes: null,
    },
  };
  writeFile(root, findingPath, markdownMetadata('AM-P0-004-F1: Fixture finding', finding));

  execFileSync('git', ['add', '-A', '--', 'src', findingPath], { cwd: root });
  execFileSync('git', ['commit', '--quiet', '-m', 'fixture remediation content'], { cwd: root });
  const implementationPaths =
    remediation === 'rename' ? ['src/example.js', 'src/renamed.js'] : ['src/example.js'];
  const exactPaths = [findingPath, reviewPath, ...implementationPaths].sort();
  const digestPlaceholder = `sha256:${'0'.repeat(64)}`;

  const reviewer = { actorId: 'agent:reviewer-1', taskId: 'task:review-1' };
  const review = {
    schemaVersion: 2,
    findingId: 'AM-P0-004-F1',
    findingPath,
    runId: 'AM-P0-004',
    stage: 'post-implementation',
    reviewStatus: 'completed',
    baselineCommit,
    remediationAuthor: {
      actorId: 'agent:remediator-1',
      taskId: 'task:remediation-1',
    },
    decisionBoundary,
    automatedCompletion: {
      status: 'complete',
      rule: 'adequate-independent-review-and-required-validation',
      validationStatus: 'passed',
      completedOn: '2026-08-27',
    },
    integrationEligibility: {
      status: 'eligible',
      exactHead: 'satisfied',
      trustedCi: 'satisfied',
      independentReview: 'satisfied',
      livePermission: 'satisfied',
      dcoOrProvenance: 'satisfied',
      repositoryRules: 'satisfied',
      idempotency: 'satisfied',
      evidence: ['exact-head fixture evidence'],
    },
    authority: [
      {
        id: 'C-TEST-0001',
        path: 'spec/contracts/C-TEST-0001.yaml',
        lifecycle: 'active',
        changeRole: 'pre-existing-authority',
        anchors: ['C-TEST-0001-A'],
        proposedAnchors: [],
      },
    ],
    changeInventory: {
      exactPaths,
      reviewedContentDigest: digestPlaceholder,
      spec: [],
      implementation: implementationPaths,
      tests: [],
    },
    affectedSurfaces: { direct: ['Fixture projection'], indirect: [], excluded: [], unknown: [] },
    evidenceClaims: [
      {
        id: 'E1',
        claim: 'The bounded projection changed.',
        proof: ['source diff'],
        limits: ['Does not prove unrelated behavior.'],
      },
    ],
    residualRisks: [],
    independentReview: {
      required: true,
      status: 'adequate',
      reviewer,
      reviewedContentDigest: digestPlaceholder,
      reviewMinutes: null,
      decision: 'Implementation is technically complete.',
      history: [
        {
          round: 1,
          reviewer,
          reviewedContentDigest: digestPlaceholder,
          classification: 'adequate',
          confidence: 0.97,
          recommendedAction: 'accept-packet',
          summary: 'The bounded diff and evidence agree.',
        },
      ],
    },
  };
  const sections = [
    'Decision boundary',
    'Behavioral delta',
    'State transitions',
    'Change and impact map',
    'Authority analysis',
    'Implementation argument',
    'Evidence matrix',
    'Residual risks and limits',
    'Independent review',
    'Reviewer checklist',
  ];
  writeFile(
    root,
    reviewPath,
    markdownMetadata('AM-P0-004-F1 remediation review packet', review, sections)
  );
  execFileSync('git', ['add', reviewPath], { cwd: root });
  execFileSync('git', ['commit', '--quiet', '-m', 'fixture independent review packet'], {
    cwd: root,
  });
  const provisionalHeadSha = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  const contentDigest = computeReviewedContentDigest({
    root,
    baseline: baselineCommit,
    head: provisionalHeadSha,
    exactPaths,
    reviewPath,
  });
  review.changeInventory.reviewedContentDigest = contentDigest;
  review.independentReview.reviewedContentDigest = contentDigest;
  review.independentReview.history[0].reviewedContentDigest = contentDigest;
  writeFile(
    root,
    reviewPath,
    markdownMetadata('AM-P0-004-F1 remediation review packet', review, sections)
  );
  execFileSync('git', ['add', reviewPath], { cwd: root });
  execFileSync('git', ['commit', '--quiet', '--amend', '--no-edit'], { cwd: root });
  const exactHeadSha = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();

  const packetMutation = structuredClone(review);
  packetMutation.affectedSurfaces.indirect = ['Unreviewed packet-only scope expansion.'];
  writeFile(
    root,
    reviewPath,
    markdownMetadata('AM-P0-004-F1 remediation review packet', packetMutation, sections)
  );
  execFileSync('git', ['add', reviewPath], { cwd: root });
  execFileSync('git', ['commit', '--quiet', '-m', 'fixture post-review packet mutation'], {
    cwd: root,
  });
  const packetOnlyMutationHead = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  execFileSync('git', ['checkout', '--quiet', '--detach', exactHeadSha], { cwd: root });

  const mutationPath = remediation === 'rename' ? 'src/renamed.js' : 'src/example.js';
  writeFile(root, mutationPath, 'export const projection = "changed after review";\n');
  execFileSync('git', ['add', mutationPath], { cwd: root });
  execFileSync('git', ['commit', '--quiet', '-m', 'fixture post-review mutation'], { cwd: root });
  const postReviewMutationHead = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();

  execFileSync('git', ['checkout', '--quiet', '--detach', baselineCommit], { cwd: root });
  execFileSync('git', ['checkout', exactHeadSha, '--', findingPath, reviewPath], { cwd: root });
  execFileSync('git', ['add', findingPath, reviewPath], { cwd: root });
  execFileSync('git', ['commit', '--quiet', '-m', 'fixture evidence without remediation'], {
    cwd: root,
  });
  const missingRemediationHead = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  execFileSync('git', ['checkout', '--quiet', '--detach', exactHeadSha], { cwd: root });

  writeFile(
    root,
    'internal/autonomous-maintenance/phase-0/missions/run-004.md',
    '# Fixture mission\n\nRun ID: `AM-P0-004`\n'
  );
  writeFile(
    root,
    'internal/autonomous-maintenance/phase-0/mission-queue.yaml',
    'schemaVersion: 2\nmissions: []\n'
  );
  const run = {
    schemaVersion: 2,
    id: 'AM-P0-004',
    missionPath: 'internal/autonomous-maintenance/phase-0/missions/run-004.md',
    findingPaths: [findingPath],
    baselineCommit,
    budgetClass: 'small',
    observer: {
      actorId: 'agent:observer-1',
      taskId: 'task:observation-1',
      status: 'completed',
      elapsedMinutes: null,
      tokenUsage: null,
      candidateFindingCount: 1,
      trackedMutationCount: 0,
    },
    verification: {
      actorId: 'agent:verifier-1',
      taskId: 'task:verification-1',
      status: 'completed',
      classification: 'confirmed',
      confidence: 0.98,
    },
    findingDisposition: { status: 'automatic-governed-remediation', evidence },
    decisionBoundary,
    automatedCompletion: {
      status: 'complete',
      completionRule: 'adequate-independent-review-and-required-validation',
      validationStatus: 'passed',
      completedOn: '2026-08-27',
      reviewPacket: reviewPath,
    },
    integration: {
      status: 'eligible',
      exactHeadSha,
      receipt: null,
      evidence: ['exact-head fixture evidence'],
    },
    outcome: { previouslyUnknown: true, actionValue: 2, residualRiskCount: 0 },
  };
  writeRunLedger(root, run);

  return {
    root,
    baselineCommit,
    exactHeadSha,
    postReviewMutationHead,
    packetOnlyMutationHead,
    missingRemediationHead,
    findingPath,
    reviewPath,
    finding,
    review,
    run,
    sections,
  };
}

test('run checker parses coherent v2 finding evidence and rejects contradictory completion', (t) => {
  const fixture = createFixture(t);
  const positive = spawnSync(process.execPath, [runChecker], {
    cwd: fixture.root,
    encoding: 'utf8',
  });
  assert.equal(positive.status, 0, positive.stderr);
  assert.match(positive.stdout, /\[autonomous-runs\] OK/);

  fixture.finding.decisionBoundary = {
    class: 'unresolved-product-direction',
    status: 'pending',
    question: 'Which rule should be normative?',
    resolution: null,
    evidence: [],
  };
  fixture.finding.remediationReview.authorityResolution = 'unresolved';
  writeFile(
    fixture.root,
    fixture.findingPath,
    markdownMetadata('AM-P0-004-F1: Fixture finding', fixture.finding)
  );
  const negative = spawnSync(process.execPath, [runChecker], {
    cwd: fixture.root,
    encoding: 'utf8',
  });
  assert.equal(negative.status, 1);
  assert.match(negative.stderr, /cannot claim completed remediation/);
  assert.match(negative.stderr, /cannot bypass unresolved product direction/);
});

test('run checker rejects baseline and a descendant that omits the remediation', (t) => {
  const fixture = createFixture(t);

  fixture.run.integration.exactHeadSha = fixture.baselineCommit;
  writeRunLedger(fixture.root, fixture.run);
  const baseline = spawnSync(process.execPath, [runChecker], {
    cwd: fixture.root,
    encoding: 'utf8',
  });
  assert.equal(baseline.status, 1);
  assert.match(baseline.stderr, /exactHeadSha must differ from baselineCommit/);

  fixture.run.integration.exactHeadSha = fixture.missingRemediationHead;
  writeRunLedger(fixture.root, fixture.run);
  const missingRemediation = spawnSync(process.execPath, [runChecker], {
    cwd: fixture.root,
    encoding: 'utf8',
  });
  assert.equal(missingRemediation.status, 1);
  assert.match(missingRemediation.stderr, /changed inventory does not match/);
  assert.match(missingRemediation.stderr, /src\/example\.js/);
});

test('run checker rejects a same-path mutation after independent review', (t) => {
  const fixture = createFixture(t);
  fixture.run.integration.exactHeadSha = fixture.postReviewMutationHead;
  writeRunLedger(fixture.root, fixture.run);

  const result = spawnSync(process.execPath, [runChecker], {
    cwd: fixture.root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /reviewed-content digest does not match/);
  assert.doesNotMatch(result.stderr, /changed inventory does not match/);
});

test('run checker rejects a packet-only mutation after independent review', (t) => {
  const fixture = createFixture(t);
  fixture.run.integration.exactHeadSha = fixture.packetOnlyMutationHead;
  writeRunLedger(fixture.root, fixture.run);

  const result = spawnSync(process.execPath, [runChecker], {
    cwd: fixture.root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /reviewed-content digest does not match/);
  assert.doesNotMatch(result.stderr, /changed inventory does not match/);
});

test('run checker rejects non-independent Observer and Verifier identities', (t) => {
  const fixture = createFixture(t);
  fixture.finding.verifier.actorId = fixture.finding.observer.actorId;
  fixture.finding.verifier.taskId = fixture.finding.observer.taskId;
  fixture.run.verification.actorId = fixture.run.observer.actorId;
  fixture.run.verification.taskId = fixture.run.observer.taskId;
  writeFile(
    fixture.root,
    fixture.findingPath,
    markdownMetadata('AM-P0-004-F1: Fixture finding', fixture.finding)
  );
  writeRunLedger(fixture.root, fixture.run);

  const result = spawnSync(process.execPath, [runChecker], {
    cwd: fixture.root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /verifier\.actorId must differ from observer\.actorId/);
  assert.match(result.stderr, /verifier\.taskId must differ from observer\.taskId/);
});

test('review checker accepts independent v2 identities and rejects self-review', (t) => {
  const fixture = createFixture(t);
  const positive = spawnSync(process.execPath, [reviewChecker], {
    cwd: fixture.root,
    encoding: 'utf8',
  });
  assert.equal(positive.status, 0, positive.stderr);
  assert.match(positive.stdout, /\[autonomous-review\] OK/);

  fixture.review.independentReview.reviewer = structuredClone(fixture.review.remediationAuthor);
  fixture.review.independentReview.history[0].reviewer = structuredClone(
    fixture.review.remediationAuthor
  );
  writeFile(
    fixture.root,
    fixture.reviewPath,
    markdownMetadata('AM-P0-004-F1 remediation review packet', fixture.review, fixture.sections)
  );
  const negative = spawnSync(process.execPath, [reviewChecker], {
    cwd: fixture.root,
    encoding: 'utf8',
  });
  assert.equal(negative.status, 1);
  assert.match(negative.stderr, /must differ from remediationAuthor\.actorId/);
  assert.match(negative.stderr, /must differ from remediationAuthor\.taskId/);
});

for (const remediation of ['delete', 'rename']) {
  test(`forward checkers accept an exact reviewed ${remediation} remediation`, (t) => {
    const fixture = createFixture(t, { remediation });
    const reviewResult = spawnSync(process.execPath, [reviewChecker], {
      cwd: fixture.root,
      encoding: 'utf8',
    });
    assert.equal(reviewResult.status, 0, reviewResult.stderr);
    assert.match(reviewResult.stdout, /\[autonomous-review\] OK/);

    const runResult = spawnSync(process.execPath, [runChecker], {
      cwd: fixture.root,
      encoding: 'utf8',
    });
    assert.equal(runResult.status, 0, runResult.stderr);
    assert.match(runResult.stdout, /\[autonomous-runs\] OK/);
  });
}
