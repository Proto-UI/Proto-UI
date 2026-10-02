import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { parseGitPathNames } from '../git-paths.mjs';
import {
  canonicalizeReviewPacket,
  computeReviewedContentDigest,
} from '../reviewed-content-digest.mjs';

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

function runCheckerWithGitHubFixture(fixture, responses = {}) {
  // Test-only runner injection. Production has no file/env escape hatch for
  // replacing GitHub facts with caller-supplied receipts or snapshots.
  const driver = path.join(fixture.root, 'run-checker-fixture.mjs');
  fs.writeFileSync(
    driver,
    `
    import cp from 'node:child_process';
    import { syncBuiltinESMExports } from 'node:module';
    const original = cp.execFileSync;
    const responses = ${JSON.stringify(responses)};
    cp.execFileSync = (command, args, options) => {
      if (command !== 'gh') return original(command, args, options);
      if (args[0] !== 'api' || !Object.hasOwn(responses, args[1])) throw new Error('fixture: live proof unavailable');
      return JSON.stringify(responses[args[1]]);
    };
    syncBuiltinESMExports();
    await import(${JSON.stringify(runChecker)});
  `
  );
  return spawnSync(process.execPath, [driver], { cwd: fixture.root, encoding: 'utf8' });
}

test('review packet canonicalization preserves historical review digests', () => {
  const packet = markdownMetadata('Digest history fixture', {
    integrationEligibility: { status: 'eligible', exactHead: 'satisfied' },
    changeInventory: { reviewedContentDigest: `sha256:${'a'.repeat(64)}` },
    independentReview: {
      reviewedContentDigest: `sha256:${'a'.repeat(64)}`,
      history: [
        { round: 1, reviewedContentDigest: `sha256:${'b'.repeat(64)}` },
        { round: 2, reviewedContentDigest: `sha256:${'a'.repeat(64)}` },
      ],
    },
  });
  const historicalMutation = packet.replace(`sha256:${'b'.repeat(64)}`, `sha256:${'c'.repeat(64)}`);
  const currentMutation = packet.replaceAll(`sha256:${'a'.repeat(64)}`, `sha256:${'d'.repeat(64)}`);
  const closureMutation = packet.replace('status: eligible', 'status: integrated');

  assert.notEqual(canonicalizeReviewPacket(packet), canonicalizeReviewPacket(historicalMutation));
  assert.equal(canonicalizeReviewPacket(packet), canonicalizeReviewPacket(currentMutation));
  assert.notEqual(canonicalizeReviewPacket(packet), canonicalizeReviewPacket(closureMutation));
});

test('reviewed content retains every integration eligibility fact and its evidence', () => {
  const eligibility = {
    status: 'pending',
    exactHead: 'pending',
    trustedCi: 'pending',
    independentReview: 'satisfied',
    livePermission: 'pending',
    dcoOrProvenance: 'pending',
    repositoryRules: 'pending',
    idempotency: 'pending',
    evidence: ['Original inspected evidence'],
  };
  const packet = markdownMetadata('Eligibility binding', { integrationEligibility: eligibility });
  for (const key of Object.keys(eligibility)) {
    const changed = structuredClone(eligibility);
    changed[key] = key === 'evidence' ? ['Unreviewed replacement evidence'] : 'changed';
    assert.notEqual(
      canonicalizeReviewPacket(packet),
      canonicalizeReviewPacket(
        markdownMetadata('Eligibility binding', { integrationEligibility: changed })
      ),
      `${key} must remain bound to the independent review`
    );
  }
});

function createFixture(
  t,
  {
    remediation = 'modify',
    reuseRole = null,
    baselinePaths = [],
    recordFindingFirst = false,
    reviewStage = 'post-implementation',
    observerConfidence = 0.96,
    verifierConfidence = 0.98,
    reviewConfidence = 0.97,
    durationMinutes = null,
    independentReviewTiming = { reviewMinutes: null },
  } = {}
) {
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
  for (const entry of baselinePaths) writeFile(root, entry, 'baseline content\n');
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['commit', '--quiet', '-m', 'fixture baseline'], { cwd: root });
  const baselineCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  const applyRemediation = () => {
    if (remediation === 'modify') {
      writeFile(root, 'src/example.js', 'export const projection = "after";\n');
    } else if (remediation === 'delete') {
      fs.rmSync(path.join(root, 'src/example.js'));
    } else if (remediation === 'rename') {
      fs.renameSync(path.join(root, 'src/example.js'), path.join(root, 'src/renamed.js'));
    } else if (remediation !== 'none') {
      throw new Error(`unsupported remediation fixture: ${remediation}`);
    }
  };
  if (!recordFindingFirst) applyRemediation();

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
    elapsedMinutes: durationMinutes,
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
    observerConfidence,
    verifier: {
      actorId: 'agent:verifier-1',
      taskId: 'task:verification-1',
      status: 'completed',
      classification: 'confirmed',
      evidence: ['independent reproduction'],
      confidence: verifierConfidence,
    },
    findingDisposition: {
      status: 'automatic-governed-remediation',
      evidence,
      factScore: 2,
      previouslyUnknown: true,
      hasExternalOracle: true,
      actionValue: 2,
      reviewMinutes: durationMinutes,
      notes: 'Current authority fixes the expected result.',
    },
    decisionBoundary,
    remediationReview: {
      status: 'completed',
      packet: reviewPath,
      authorityResolution: 'governed',
      implementationVerification: 'passed',
      integrationEligibility: 'eligible',
      reviewMinutes: durationMinutes,
    },
  };
  writeFile(root, findingPath, markdownMetadata('AM-P0-004-F1: Fixture finding', finding));
  let recordedFindingHead = null;
  if (recordFindingFirst) {
    execFileSync('git', ['add', '--', findingPath], { cwd: root });
    execFileSync(
      'git',
      ['commit', '--quiet', '-m', 'fixture recorded finding before remediation'],
      {
        cwd: root,
      }
    );
    recordedFindingHead = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim();
    applyRemediation();
  }

  execFileSync('git', ['add', '-A', '--', 'src', findingPath], { cwd: root });
  execFileSync('git', ['commit', '--quiet', '-m', 'fixture remediation content'], { cwd: root });
  const implementationPaths =
    remediation === 'none'
      ? []
      : remediation === 'rename'
        ? ['src/example.js', 'src/renamed.js']
        : ['src/example.js'];
  const exactPaths = [findingPath, reviewPath, ...implementationPaths].sort();
  const digestPlaceholder = `sha256:${'0'.repeat(64)}`;

  const reviewer = { actorId: 'agent:reviewer-1', taskId: 'task:review-1' };
  const review = {
    schemaVersion: 2,
    findingId: 'AM-P0-004-F1',
    findingPath,
    runId: 'AM-P0-004',
    stage: reviewStage,
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
      ...independentReviewTiming,
      decision: 'Implementation is technically complete.',
      history: [
        {
          round: 1,
          reviewer,
          reviewedContentDigest: digestPlaceholder,
          classification: 'adequate',
          confidence: reviewConfidence,
          recommendedAction: 'accept-packet',
          summary: 'The bounded diff and evidence agree.',
        },
      ],
    },
  };
  if (reuseRole) {
    const target =
      reuseRole.role === 'remediationAuthor'
        ? review.remediationAuthor
        : review.independentReview.reviewer;
    target[reuseRole.field] = finding[reuseRole.source][reuseRole.field];
  }
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
    worktree: true,
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
      elapsedMinutes: durationMinutes,
      tokenUsage: null,
      candidateFindingCount: 1,
      trackedMutationCount: 0,
    },
    verification: {
      actorId: 'agent:verifier-1',
      taskId: 'task:verification-1',
      status: 'completed',
      classification: 'confirmed',
      confidence: verifierConfidence,
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
    recordedFindingHead,
    findingPath,
    reviewPath,
    finding,
    review,
    run,
    sections,
  };
}

function fixtureDigest(fixture, options = {}) {
  return computeReviewedContentDigest({
    root: fixture.root,
    baseline: fixture.baselineCommit,
    head: fixture.exactHeadSha,
    exactPaths: fixture.review.changeInventory.exactPaths,
    reviewPath: fixture.reviewPath,
    ...options,
  });
}

function commitReviewedFixture(fixture) {
  const writePacket = () =>
    writeFile(
      fixture.root,
      fixture.reviewPath,
      markdownMetadata('AM-P0-004-F1 remediation review packet', fixture.review, fixture.sections)
    );
  writePacket();
  const digest = fixtureDigest(fixture, { worktree: true });
  fixture.review.changeInventory.reviewedContentDigest = digest;
  fixture.review.independentReview.reviewedContentDigest = digest;
  fixture.review.independentReview.history.at(-1).reviewedContentDigest = digest;
  writePacket();
  const worktreeResult = spawnSync(process.execPath, [reviewChecker], {
    cwd: fixture.root,
    encoding: 'utf8',
  });
  assert.equal(worktreeResult.status, 0, worktreeResult.stderr);
  execFileSync('git', ['add', '-A', '--', ...fixture.review.changeInventory.exactPaths], {
    cwd: fixture.root,
    env: { ...process.env, GIT_LITERAL_PATHSPECS: '1' },
  });
  execFileSync('git', ['commit', '--quiet', '-m', 'fixture reviewed update'], {
    cwd: fixture.root,
  });
  fixture.exactHeadSha = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: fixture.root,
    encoding: 'utf8',
  }).trim();
  fixture.run.integration.exactHeadSha = fixture.exactHeadSha;
  writeRunLedger(fixture.root, fixture.run);
  assert.equal(fixtureDigest(fixture), digest, 'pre-commit and exact-head digests agree');
}

const literalNames = [
  ' ',
  ' leading ',
  'trailing ',
  'quote"name',
  'line\nbreak',
  'tab\tname',
  'return\rname',
  'café/文件',
  '\uFEFFname',
];
test('NUL-delimited Git paths preserve names and reject lossy or malformed output', () => {
  assert.deepEqual(parseGitPathNames(Buffer.from(`${literalNames.join('\0')}\0`)), literalNames);
  assert.deepEqual(parseGitPathNames(Buffer.alloc(0)), []);
  assert.throws(() => parseGitPathNames(Buffer.from('name')), /not NUL-terminated/);
  assert.throws(() => parseGitPathNames(Buffer.from('name\0\0')), /empty name/);
  assert.throws(() => parseGitPathNames(Buffer.from([0xff, 0])), /encoded data/);
});
for (const operation of ['add', 'delete']) {
  test(`forward checkers preserve literal Git filenames for ${operation} entries`, (t) => {
    const fixture = createFixture(t, { baselinePaths: operation === 'delete' ? literalNames : [] });
    for (const entry of literalNames) {
      if (operation === 'delete') fs.rmSync(path.join(fixture.root, entry));
      else writeFile(fixture.root, entry, 'reviewed content\n');
    }
    fixture.review.changeInventory.exactPaths.push(...literalNames);
    fixture.review.changeInventory.implementation.push(...literalNames);
    commitReviewedFixture(fixture);
    for (const checker of [reviewChecker, runChecker]) {
      const result = spawnSync(process.execPath, [checker], {
        cwd: fixture.root,
        encoding: 'utf8',
      });
      assert.equal(result.status, 0, `${path.basename(checker)}: ${result.stderr}`);
    }
  });
}

test('run checker rejects a committed whitespace-only path omitted from the reviewed inventory', (t) => {
  const fixture = createFixture(t);
  writeFile(fixture.root, ' ', 'unreviewed content\n');
  execFileSync('git', ['add', '--', ' '], { cwd: fixture.root });
  execFileSync('git', ['commit', '--quiet', '-m', 'fixture unreviewed whitespace path'], {
    cwd: fixture.root,
  });
  fixture.run.integration.exactHeadSha = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: fixture.root,
    encoding: 'utf8',
  }).trim();
  writeRunLedger(fixture.root, fixture.run);
  const result = spawnSync(process.execPath, [runChecker], { cwd: fixture.root, encoding: 'utf8' });
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /changed inventory does not match/);
});

test('run checker rejects a squash receipt with an additional whitespace-only path', (t) => {
  const fixture = createFixture(t);
  writeFile(fixture.root, ' ', 'unreviewed squash content\n');
  execFileSync('git', ['add', '--', ' '], { cwd: fixture.root });
  const tree = execFileSync('git', ['write-tree'], { cwd: fixture.root, encoding: 'utf8' }).trim();
  const mergeCommitSha = execFileSync(
    'git',
    ['commit-tree', tree, '-p', fixture.baselineCommit, '-m', 'fixture squash'],
    { cwd: fixture.root, encoding: 'utf8' }
  ).trim();
  fixture.run.integration.status = 'integrated';
  fixture.run.integration.receipt = {
    repositoryId: 'github.com:Proto-UI/Proto-UI',
    pullRequest: 1,
    authorizationId: 'explicit-current-user',
    headSha: fixture.exactHeadSha,
    liveHeadSha: fixture.exactHeadSha,
    mergeCommitSha,
    mergeMethod: 'squash',
    mergedAt: '2026-10-01T00:00:00Z',
  };
  writeRunLedger(fixture.root, fixture.run);
  const result = spawnSync(process.execPath, [runChecker], { cwd: fixture.root, encoding: 'utf8' });
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /mergeCommitSha changed paths must match/);
});

for (const parentKind of ['unrelated-root', 'unmerged-baseline-child']) {
  test(`run checker rejects a fabricated integrated receipt on an ${parentKind}`, (t) => {
    const fixture = createFixture(t);
    fixture.finding.remediationReview.integrationEligibility = 'integrated';
    fixture.review.integrationEligibility.status = 'integrated';
    writeFile(
      fixture.root,
      fixture.findingPath,
      markdownMetadata('AM-P0-004-F1: Fixture finding', fixture.finding)
    );
    commitReviewedFixture(fixture);
    let parent = fixture.baselineCommit;
    if (parentKind === 'unrelated-root') {
      const baselineTree = execFileSync('git', ['rev-parse', `${parent}^{tree}`], {
        cwd: fixture.root,
        encoding: 'utf8',
      }).trim();
      parent = execFileSync('git', ['commit-tree', baselineTree, '-m', 'unrelated root'], {
        cwd: fixture.root,
        encoding: 'utf8',
      }).trim();
    }
    const exactTree = execFileSync('git', ['rev-parse', `${fixture.exactHeadSha}^{tree}`], {
      cwd: fixture.root,
      encoding: 'utf8',
    }).trim();
    const mergeCommitSha = execFileSync(
      'git',
      ['commit-tree', exactTree, '-p', parent, '-m', 'fabricated squash'],
      {
        cwd: fixture.root,
        encoding: 'utf8',
      }
    ).trim();
    fixture.run.integration.status = 'integrated';
    fixture.run.integration.receipt = {
      repositoryId: 'github.com:Proto-UI/Proto-UI',
      pullRequest: 1,
      authorizationId: 'explicit-current-user',
      headSha: fixture.exactHeadSha,
      liveHeadSha: fixture.exactHeadSha,
      mergeCommitSha,
      mergeMethod: 'squash',
      mergedAt: '2026-10-01T00:00:00Z',
    };
    writeRunLedger(fixture.root, fixture.run);
    const result = runCheckerWithGitHubFixture(fixture);
    assert.equal(
      result.status,
      1,
      'local matching bytes and caller-provided receipt cannot prove a GitHub merge'
    );
    assert.match(
      result.stderr,
      parentKind === 'unrelated-root' ? /merge parent does not descend/ : /missing live merge proof/
    );
    if (parentKind === 'unmerged-baseline-child') {
      const prefix = 'repos/Proto-UI/Proto-UI/';
      const live = runCheckerWithGitHubFixture(fixture, {
        [`${prefix}pulls/1`]: {
          number: 1,
          state: 'closed',
          merged: true,
          base: { ref: 'main', repo: { full_name: 'Proto-UI/Proto-UI' } },
          head: { sha: fixture.exactHeadSha },
          merge_commit_sha: mergeCommitSha,
          merged_at: fixture.run.integration.receipt.mergedAt,
        },
        [`${prefix}git/commits/${mergeCommitSha}`]: {
          sha: mergeCommitSha,
          parents: [{ sha: fixture.baselineCommit }],
        },
        [`${prefix}git/ref/heads/main`]: {
          ref: 'refs/heads/main',
          object: { type: 'commit', sha: mergeCommitSha },
        },
        [`${prefix}compare/${fixture.baselineCommit}...${fixture.baselineCommit}?per_page=1`]: {
          status: 'identical',
          base_commit: { sha: fixture.baselineCommit },
          merge_base_commit: { sha: fixture.baselineCommit },
        },
        [`${prefix}compare/${mergeCommitSha}...${mergeCommitSha}?per_page=1`]: {
          status: 'identical',
          base_commit: { sha: mergeCommitSha },
          merge_base_commit: { sha: mergeCommitSha },
        },
      });
      assert.equal(live.status, 1);
      assert.match(
        live.stderr,
        /actual GitHub merge is verified, but trusted receipt-producer evidence for the historical squash method is unavailable/
      );
      assert.doesNotMatch(live.stderr, /missing live merge proof/);
    }
  });
}

for (const target of ['review-packet', 'implementation']) {
  for (const modeCase of [
    'unstaged-executable',
    'ignored-worktree-executable',
    'staged-executable',
    'staged-executable-overridden',
    'untracked-executable',
  ]) {
    test(`worktree digest honors Git mode semantics for ${target}: ${modeCase}`, (t) => {
      const fixture = createFixture(t);
      const entry = target === 'review-packet' ? fixture.reviewPath : 'src/example.js';
      execFileSync(
        'git',
        [
          'config',
          'core.filemode',
          ['unstaged-executable', 'staged-executable-overridden'].includes(modeCase)
            ? 'true'
            : 'false',
        ],
        {
          cwd: fixture.root,
        }
      );
      if (modeCase.startsWith('staged-executable')) {
        execFileSync('git', ['update-index', '--chmod=+x', '--', entry], { cwd: fixture.root });
        fs.chmodSync(path.join(fixture.root, entry), 0o644);
      } else {
        if (modeCase === 'untracked-executable')
          execFileSync('git', ['rm', '--cached', '--quiet', '--', entry], { cwd: fixture.root });
        fs.chmodSync(path.join(fixture.root, entry), 0o755);
      }
      const indexBefore = execFileSync('git', ['ls-files', '--stage', '-z'], { cwd: fixture.root });
      const worktreeDigest = fixtureDigest(fixture, { worktree: true });
      assert.deepEqual(
        execFileSync('git', ['ls-files', '--stage', '-z'], { cwd: fixture.root }),
        indexBefore
      );
      execFileSync('git', ['add', '--', entry], { cwd: fixture.root });
      execFileSync('git', ['commit', '--quiet', '--allow-empty', '-m', 'fixture mode update'], {
        cwd: fixture.root,
      });
      const head = execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: fixture.root,
        encoding: 'utf8',
      }).trim();
      assert.equal(fixtureDigest(fixture, { head }), worktreeDigest);
      const actualMode = execFileSync('git', ['ls-tree', head, '--', entry], {
        cwd: fixture.root,
        encoding: 'utf8',
      }).slice(0, 6);
      assert.equal(
        actualMode,
        ['unstaged-executable', 'staged-executable'].includes(modeCase) ? '100755' : '100644'
      );
    });
  }
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
test('schema-v2 ledgers reject runs without explicit schema identity', (t) => {
  const fixture = createFixture(t);
  delete fixture.run.schemaVersion;
  writeRunLedger(fixture.root, fixture.run);
  const result = spawnSync(process.execPath, [runChecker], {
    cwd: fixture.root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /schemaVersion must explicitly declare 1 or 2/);
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

test('recorded finding remains valid when later remediation retains its frozen observation baseline', (t) => {
  const fixture = createFixture(t, { recordFindingFirst: true });
  assert.notEqual(fixture.recordedFindingHead, fixture.baselineCommit);
  const findingAtRecord = execFileSync(
    'git',
    ['show', `${fixture.recordedFindingHead}:${fixture.findingPath}`],
    { cwd: fixture.root }
  );
  assert.deepEqual(fs.readFileSync(path.join(fixture.root, fixture.findingPath)), findingAtRecord);
  assert.equal(
    execFileSync(
      'git',
      [
        'diff',
        '--name-only',
        '-z',
        fixture.recordedFindingHead,
        fixture.exactHeadSha,
        '--',
        fixture.findingPath,
      ],
      { cwd: fixture.root, encoding: 'utf8' }
    ),
    '',
    'remediation does not rewrite the previously recorded finding'
  );
  assert.deepEqual(
    parseGitPathNames(
      execFileSync(
        'git',
        ['diff', '--name-only', '-z', fixture.baselineCommit, fixture.exactHeadSha, '--'],
        {
          cwd: fixture.root,
        }
      )
    ).sort(),
    [...fixture.review.changeInventory.exactPaths].sort(),
    'the frozen mission baseline still includes the finding in the complete changed-path set'
  );
  for (const checker of [reviewChecker, runChecker]) {
    const result = spawnSync(process.execPath, [checker], { cwd: fixture.root, encoding: 'utf8' });
    assert.equal(result.status, 0, `${path.basename(checker)}: ${result.stderr}`);
  }
});

for (const stage of ['post-implementation', 'post-implementation-pilot']) {
  for (const checker of [reviewChecker, runChecker]) {
    test(`${path.basename(checker)} rejects ${stage} finding-and-packet-only remediation`, (t) => {
      const fixture = createFixture(t, { remediation: 'none', reviewStage: stage });
      assert.deepEqual(
        parseGitPathNames(
          execFileSync(
            'git',
            ['diff', '--name-only', '-z', fixture.baselineCommit, fixture.exactHeadSha, '--'],
            { cwd: fixture.root }
          )
        ).sort(),
        [fixture.findingPath, fixture.reviewPath].sort()
      );
      const result = spawnSync(process.execPath, [checker], {
        cwd: fixture.root,
        encoding: 'utf8',
      });
      assert.equal(result.status, 1, result.stdout);
      assert.match(result.stderr, /reviewed remediation content outside the finding and packet/);
      assert.doesNotMatch(result.stderr, /changed inventory does not match|digest does not match/);
    });
  }

  test(`review checker rejects ${stage} inventory that omits the linked finding`, (t) => {
    const fixture = createFixture(t);
    fixture.review.stage = stage;
    fixture.review.changeInventory.exactPaths = fixture.review.changeInventory.exactPaths.filter(
      (entry) => entry !== fixture.findingPath
    );
    const writePacket = () =>
      writeFile(
        fixture.root,
        fixture.reviewPath,
        markdownMetadata('AM-P0-004-F1 remediation review packet', fixture.review, fixture.sections)
      );
    writePacket();
    const digest = fixtureDigest(fixture, { worktree: true });
    fixture.review.changeInventory.reviewedContentDigest = digest;
    fixture.review.independentReview.reviewedContentDigest = digest;
    fixture.review.independentReview.history.at(-1).reviewedContentDigest = digest;
    writePacket();

    // These evidence fields are not otherwise tied to the run ledger. Omitting
    // the finding leaves their changes invisible to the declared path digest.
    fixture.finding.expected = 'An unreviewed replacement requirement.';
    fixture.finding.reproduction = 'An unreviewed replacement reproduction.';
    writeFile(
      fixture.root,
      fixture.findingPath,
      markdownMetadata('AM-P0-004-F1: Fixture finding', fixture.finding)
    );
    assert.equal(fixtureDigest(fixture, { worktree: true }), digest);
    const result = spawnSync(process.execPath, [reviewChecker], {
      cwd: fixture.root,
      encoding: 'utf8',
    });
    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /exactPaths must include the linked finding/);
    assert.doesNotMatch(result.stderr, /reviewed-content digest does not match/);
  });
}

function recordWithoutRemediation(fixture, disposition) {
  const noFinding = disposition === 'record-no-finding';
  const blocked = disposition === 'bounded-follow-up';
  const actionValue = blocked ? 1 : 0;
  const classification = noFinding
    ? 'no-finding'
    : blocked
      ? 'unresolved-semantic-question'
      : 'expected-behavior';
  fixture.finding.verifier.status = blocked ? 'blocked' : 'completed';
  fixture.finding.verifier.classification = classification;
  fixture.run.verification = { ...fixture.finding.verifier };
  fixture.finding.findingDisposition = {
    ...fixture.finding.findingDisposition,
    status: disposition,
    factScore: 0,
    previouslyUnknown: false,
    actionValue,
    notes: 'Independent evidence supports recording this outcome without remediation.',
  };
  fixture.finding.remediationReview = {
    status: 'not-required',
    packet: null,
    authorityResolution: 'not-required',
    implementationVerification: 'not-required',
    integrationEligibility: 'not-required',
    reviewMinutes: null,
  };
  fixture.run.findingDisposition.status = disposition;
  fixture.run.outcome.previouslyUnknown = false;
  fixture.run.outcome.actionValue = actionValue;
  fixture.run.automatedCompletion = {
    status: 'not-required',
    completionRule: 'not-required',
    validationStatus: 'not-required',
    completedOn: null,
    reviewPacket: null,
  };
  fixture.run.integration = {
    status: 'not-required',
    exactHeadSha: null,
    receipt: null,
    evidence: [],
  };
  if (noFinding) {
    fixture.run.findingPaths = [];
    fixture.run.observer.candidateFindingCount = 0;
    fs.rmSync(path.join(fixture.root, fixture.findingPath));
  } else {
    writeFile(
      fixture.root,
      fixture.findingPath,
      markdownMetadata('AM-P0-004-F1: Fixture finding', fixture.finding)
    );
  }
  fs.rmSync(path.join(fixture.root, fixture.reviewPath));
  writeRunLedger(fixture.root, fixture.run);
}

for (const aliasPrefix of ['./', 'internal/./']) {
  test(`run checker rejects finding alias ${aliasPrefix} as remediation content`, (t) => {
    const fixture = createFixture(t, { remediation: 'none' });
    fixture.review.findingPath =
      aliasPrefix === './'
        ? `./${fixture.findingPath}`
        : fixture.findingPath.replace('internal/', 'internal/./');
    fixture.run.findingPaths = [fixture.review.findingPath];
    const writePacket = () =>
      writeFile(
        fixture.root,
        fixture.reviewPath,
        markdownMetadata('AM-P0-004-F1 remediation review packet', fixture.review, fixture.sections)
      );
    writePacket();
    const digest = fixtureDigest(fixture, { worktree: true });
    fixture.review.changeInventory.reviewedContentDigest = digest;
    fixture.review.independentReview.reviewedContentDigest = digest;
    fixture.review.independentReview.history.at(-1).reviewedContentDigest = digest;
    writePacket();
    execFileSync('git', ['add', fixture.reviewPath], { cwd: fixture.root });
    execFileSync('git', ['commit', '--quiet', '-m', 'fixture aliased finding path'], {
      cwd: fixture.root,
    });
    fixture.run.integration.exactHeadSha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: fixture.root,
      encoding: 'utf8',
    }).trim();
    writeRunLedger(fixture.root, fixture.run);

    const result = spawnSync(process.execPath, [runChecker], {
      cwd: fixture.root,
      encoding: 'utf8',
    });
    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /exact-head inventory must include the linked finding/);
    assert.doesNotMatch(result.stderr, /changed inventory does not match|digest does not match/);
  });
}

for (const disposition of ['record-no-finding', 'record-rejected', 'bounded-follow-up']) {
  test(`run checker preserves ${disposition} without a remediation packet or implementation`, (t) => {
    const fixture = createFixture(t, { remediation: 'none' });
    recordWithoutRemediation(fixture, disposition);
    assert.equal(
      execFileSync('git', ['diff', fixture.baselineCommit, '--', 'src'], {
        cwd: fixture.root,
        encoding: 'utf8',
      }),
      ''
    );
    const result = spawnSync(process.execPath, [runChecker], {
      cwd: fixture.root,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
  });
}

for (const [label, timing, valid] of [
  ['omitted', {}, true],
  ['null', { reviewMinutes: null }, true],
  ['positive fraction', { reviewMinutes: 0.25 }, true],
  ['positive integer', { reviewMinutes: 1 }, true],
  ['zero', { reviewMinutes: 0 }, false],
  ['negative', { reviewMinutes: -1 }, false],
  ['.nan', { reviewMinutes: NaN }, false],
  ['.inf', { reviewMinutes: Infinity }, false],
  ['-.inf', { reviewMinutes: -Infinity }, false],
]) {
  test(`forward checkers validate optional independent review duration ${label} through real YAML`, (t) => {
    const fixture = createFixture(t, { independentReviewTiming: timing });
    const packet = fs.readFileSync(path.join(fixture.root, fixture.reviewPath), 'utf8');
    if (label.includes('.')) assert.ok(packet.includes(`reviewMinutes: ${label}\n`));
    for (const checker of [reviewChecker, runChecker]) {
      const result = spawnSync(process.execPath, [checker], {
        cwd: fixture.root,
        encoding: 'utf8',
      });
      assert.equal(result.status, valid ? 0 : 1, result.stderr || result.stdout);
      if (!valid) {
        assert.match(
          result.stderr,
          /independentReview\.reviewMinutes must be null or a positive number/
        );
        assert.doesNotMatch(result.stderr, /reviewed-content digest does not match/);
      }
    }
  });
}

for (const [minutes, scalar] of [
  [NaN, '.nan'],
  [Infinity, '.inf'],
  [-Infinity, '-.inf'],
  [0, '0'],
]) {
  test(`run checker rejects real YAML duration ${scalar} in forward evidence`, (t) => {
    const fixture = createFixture(t, { durationMinutes: minutes });
    const findingYaml = fs.readFileSync(path.join(fixture.root, fixture.findingPath), 'utf8');
    const ledgerYaml = fs.readFileSync(
      path.join(fixture.root, 'internal/autonomous-maintenance/phase-0/runs.yaml'),
      'utf8'
    );
    assert.ok(findingYaml.includes(`elapsedMinutes: ${scalar}\n`));
    assert.ok(findingYaml.includes(`reviewMinutes: ${scalar}\n`));
    assert.ok(ledgerYaml.includes(`elapsedMinutes: ${scalar}\n`));
    const result = spawnSync(process.execPath, [runChecker], {
      cwd: fixture.root,
      encoding: 'utf8',
    });
    assert.equal(result.status, 1, result.stdout);
    for (const field of [
      'elapsedMinutes',
      'findingDisposition.reviewMinutes',
      'remediationReview.reviewMinutes',
      'observer.elapsedMinutes',
    ]) {
      assert.ok(
        result.stderr.includes(`${field} must be null or a positive number`),
        `${field}: ${result.stderr}`
      );
    }
    assert.doesNotMatch(result.stderr, /reviewed-content digest does not match/);
  });
}

for (const minutes of [null, 0.25, 1]) {
  test(`forward checkers preserve valid duration ${String(minutes)} through real YAML`, (t) => {
    const fixture = createFixture(t, { durationMinutes: minutes });
    for (const checker of [reviewChecker, runChecker]) {
      const result = spawnSync(process.execPath, [checker], {
        cwd: fixture.root,
        encoding: 'utf8',
      });
      assert.equal(result.status, 0, `${path.basename(checker)}: ${result.stderr}`);
    }
  });
}

for (const minutes of [null, 0.25, 1, NaN, Infinity, -Infinity, 0, -1]) {
  test(`legacy run checker validates review durations ${String(minutes)} through real YAML`, (t) => {
    const fixture = createFixture(t, { remediation: 'none' });
    const run = fixture.run;
    run.schemaVersion = 1;
    run.findingPaths = [];
    for (const key of [
      'findingDisposition',
      'decisionBoundary',
      'automatedCompletion',
      'integration',
    ]) {
      delete run[key];
    }
    run.humanDecisions = Object.fromEntries(
      ['findingDisposition', 'semantic', 'integration'].map((key) => [
        key,
        { status: 'not-required', reviewMinutes: minutes },
      ])
    );
    run.remediation = {
      status: 'not-required',
      completionRule: 'not-required',
      validationStatus: 'not-required',
      completedOn: '2026-08-27',
      reviewPacket: null,
    };
    writeRunLedger(fixture.root, run);
    const result = spawnSync(process.execPath, [runChecker], {
      cwd: fixture.root,
      encoding: 'utf8',
    });
    if (minutes === null || (Number.isFinite(minutes) && minutes > 0)) {
      assert.equal(result.status, 0, result.stderr);
    } else {
      assert.equal(result.status, 1, result.stdout);
      for (const field of ['findingDisposition', 'semantic', 'integration']) {
        assert.ok(
          result.stderr.includes(
            `humanDecisions.${field}.reviewMinutes must be null or a positive number`
          ),
          result.stderr
        );
      }
    }
  });
}

for (const [field, error] of [
  ['observerConfidence', /observerConfidence must be between 0 and 1/],
  ['verifierConfidence', /resolved verifier confidence must be between 0 and 1/],
  ['reviewConfidence', /independentReview\.history\[0\]\.confidence must be between 0 and 1/],
]) {
  test(`evidence checker rejects real YAML .nan in ${field}`, (t) => {
    const fixture = createFixture(t, { [field]: NaN });
    const yamlFile = field === 'reviewConfidence' ? fixture.reviewPath : fixture.findingPath;
    assert.match(fs.readFileSync(path.join(fixture.root, yamlFile), 'utf8'), /: \.nan\n/);
    const checker = field === 'reviewConfidence' ? reviewChecker : runChecker;
    const result = spawnSync(process.execPath, [checker], {
      cwd: fixture.root,
      encoding: 'utf8',
    });
    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, error);
    assert.doesNotMatch(result.stderr, /reviewed-content digest does not match/);
  });
}

test('run checker rejects real YAML .nan in resolved verification without a linked finding', (t) => {
  const fixture = createFixture(t, { remediation: 'none', verifierConfidence: NaN });
  recordWithoutRemediation(fixture, 'record-no-finding');
  const result = spawnSync(process.execPath, [runChecker], {
    cwd: fixture.root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /verification\.confidence must be between 0 and 1/);
});

for (const [field, error] of [
  ['observerConfidence', /exact-head finding: observerConfidence must be between 0 and 1/],
  [
    'verifierConfidence',
    /exact-head finding: resolved verifier confidence must be between 0 and 1/,
  ],
]) {
  test(`run checker rejects committed ${field} .nan after current evidence is repaired`, (t) => {
    const fixture = createFixture(t, { [field]: NaN });
    const committedFinding = execFileSync(
      'git',
      ['show', `${fixture.exactHeadSha}:${fixture.findingPath}`],
      { cwd: fixture.root, encoding: 'utf8' }
    );
    assert.match(committedFinding, /: \.nan\n/);
    fixture.finding.observerConfidence = 0.96;
    fixture.finding.verifier.confidence = 0.98;
    fixture.run.verification.confidence = 0.98;
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
    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, error);
    assert.doesNotMatch(result.stderr, /changed inventory does not match|digest does not match/);
  });
}

for (const confidence of [0, 1]) {
  test(`forward checkers preserve confidence boundary ${confidence} through real YAML`, (t) => {
    const fixture = createFixture(t, {
      observerConfidence: confidence,
      verifierConfidence: confidence,
      reviewConfidence: confidence,
    });
    for (const checker of [reviewChecker, runChecker]) {
      const result = spawnSync(process.execPath, [checker], {
        cwd: fixture.root,
        encoding: 'utf8',
      });
      assert.equal(result.status, 0, `${path.basename(checker)}: ${result.stderr}`);
    }
  });
}

for (const stage of ['post-implementation', 'post-implementation-pilot']) {
  test(`review checker rejects ${stage} finding symlink instead of trusting its unhashed target`, (t) => {
    if (process.platform === 'win32') return t.skip('POSIX symlink fixture');
    const fixture = createFixture(t);
    fixture.review.stage = stage;
    fixture.review.integrationEligibility.status = 'pending';
    fixture.review.integrationEligibility.exactHead = 'pending';
    const findingFile = path.join(fixture.root, fixture.findingPath);
    const target = path.join(fixture.root, '.fixture-evidence/finding.md');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.renameSync(findingFile, target);
    fs.symlinkSync(path.relative(path.dirname(findingFile), target), findingFile);
    const writePacket = () =>
      writeFile(
        fixture.root,
        fixture.reviewPath,
        markdownMetadata('AM-P0-004-F1 remediation review packet', fixture.review, fixture.sections)
      );
    writePacket();
    const digest = fixtureDigest(fixture, { worktree: true });
    fixture.review.changeInventory.reviewedContentDigest = digest;
    fixture.review.independentReview.reviewedContentDigest = digest;
    fixture.review.independentReview.history.at(-1).reviewedContentDigest = digest;
    writePacket();
    fixture.finding.expected = 'Unreviewed replacement requirement.';
    fixture.finding.reproduction = 'Unreviewed replacement reproduction.';
    fs.writeFileSync(target, markdownMetadata('AM-P0-004-F1: Fixture finding', fixture.finding));
    assert.equal(fixtureDigest(fixture, { worktree: true }), digest);
    const result = spawnSync(process.execPath, [reviewChecker], {
      cwd: fixture.root,
      encoding: 'utf8',
    });
    assert.equal(result.status, 1, result.stdout);
    assert.match(
      result.stderr,
      /findingPath must be a regular repository file without symlink components/
    );
    assert.doesNotMatch(result.stderr, /reviewed-content digest does not match/);
  });
}

test('review checker rejects finding symlink ancestors inside the repository', (t) => {
  if (process.platform === 'win32') return t.skip('POSIX symlink fixture');
  const fixture = createFixture(t);
  const directory = path.dirname(path.join(fixture.root, fixture.findingPath));
  const target = path.join(fixture.root, '.fixture-findings');
  fs.renameSync(directory, target);
  fs.symlinkSync(path.relative(path.dirname(directory), target), directory, 'dir');
  const result = spawnSync(process.execPath, [reviewChecker], {
    cwd: fixture.root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 1, result.stdout);
  assert.match(
    result.stderr,
    /findingPath must be a regular repository file without symlink components/
  );
});

test('review checker rejects special finding files without waiting for a FIFO writer', (t) => {
  if (process.platform === 'win32') return t.skip('POSIX FIFO fixture');
  const fixture = createFixture(t);
  const findingFile = path.join(fixture.root, fixture.findingPath);
  fs.rmSync(findingFile);
  execFileSync('mkfifo', [findingFile]);
  const result = spawnSync(process.execPath, [reviewChecker], {
    cwd: fixture.root,
    encoding: 'utf8',
    timeout: 2000,
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 1, result.stdout);
  assert.match(
    result.stderr,
    /findingPath must be a regular repository file without symlink components/
  );
});

test('review checker accepts a regular finding through an outer workspace symlink', (t) => {
  if (process.platform === 'win32') return t.skip('POSIX symlink fixture');
  const fixture = createFixture(t);
  const aliasRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-ui-workspace-alias-'));
  t.after(() => fs.rmSync(aliasRoot, { recursive: true, force: true }));
  const alias = path.join(aliasRoot, 'workspace');
  fs.symlinkSync(fixture.root, alias, 'dir');
  const result = spawnSync(process.execPath, [reviewChecker], { cwd: alias, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('included finding evidence changes invalidate completed review', (t) => {
  const fixture = createFixture(t);
  const positive = spawnSync(process.execPath, [reviewChecker], {
    cwd: fixture.root,
    encoding: 'utf8',
  });
  assert.equal(positive.status, 0, positive.stderr);
  const original = structuredClone(fixture.finding);
  const reviewedDigest = fixture.review.changeInventory.reviewedContentDigest;
  for (const field of ['expected', 'observed', 'reproduction', 'impact', 'evidence']) {
    const changed = structuredClone(original);
    changed[field] = field === 'evidence' ? ['Unreviewed evidence.'] : 'Unreviewed replacement.';
    writeFile(
      fixture.root,
      fixture.findingPath,
      markdownMetadata('AM-P0-004-F1: Fixture finding', changed)
    );
    assert.notEqual(fixtureDigest(fixture, { worktree: true }), reviewedDigest, field);
    const result = spawnSync(process.execPath, [reviewChecker], {
      cwd: fixture.root,
      encoding: 'utf8',
    });
    assert.equal(result.status, 1, `${field}: ${result.stdout}`);
    assert.match(result.stderr, /reviewed-content digest does not match/);
  }
});

test('reviewed-content digests treat inventory paths as literal Git pathspecs', (t) => {
  const fixture = createFixture(t);
  const exactPaths = [...fixture.review.changeInventory.exactPaths, ':(exclude)**'].sort();
  const reviewed = computeReviewedContentDigest({
    root: fixture.root,
    baseline: fixture.baselineCommit,
    head: fixture.exactHeadSha,
    exactPaths,
    reviewPath: fixture.reviewPath,
  });
  const mutated = computeReviewedContentDigest({
    root: fixture.root,
    baseline: fixture.baselineCommit,
    head: fixture.postReviewMutationHead,
    exactPaths,
    reviewPath: fixture.reviewPath,
  });

  assert.notEqual(mutated, reviewed);
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

test('run checker rejects normalized impossible merge timestamps', (t) => {
  const fixture = createFixture(t);
  fixture.run.integration = {
    status: 'integrated',
    exactHeadSha: fixture.exactHeadSha,
    receipt: {
      repositoryId: 'github.com:Proto-UI/Proto-UI',
      pullRequest: 509,
      authorizationId: 'explicit-current-user',
      headSha: fixture.exactHeadSha,
      liveHeadSha: fixture.exactHeadSha,
      mergeCommitSha: 'f'.repeat(40),
      mergeMethod: 'squash',
      mergedAt: '2026-02-31T00:00:00Z',
    },
    evidence: ['exact-head fixture evidence'],
  };
  writeRunLedger(fixture.root, fixture.run);

  const result = spawnSync(process.execPath, [runChecker], {
    cwd: fixture.root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /mergedAt must be an RFC 3339 timestamp/);
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

for (const role of ['remediationAuthor', 'reviewer']) {
  for (const source of ['observer', 'verifier']) {
    for (const field of ['actorId', 'taskId']) {
      test(`both checkers reject ${role} reusing ${source}.${field}`, (t) => {
        // Phase-0 independent remediation path: discovery contexts remain read-only.
        // Set identities before hashing so only role independence invalidates this packet.
        const fixture = createFixture(t, { reuseRole: { role, source, field } });
        const results = [reviewChecker, runChecker].map((checker) => ({
          checker,
          result: spawnSync(process.execPath, [checker], {
            cwd: fixture.root,
            encoding: 'utf8',
          }),
        }));
        for (const { checker, result } of results) {
          assert.equal(result.status, 1, `${path.basename(checker)} accepted cross-role reuse`);
          assert.match(result.stderr, new RegExp(`must differ from ${source}\\.${field}`));
          assert.doesNotMatch(result.stderr, /reviewed-content digest does not match/);
        }
      });
    }
  }
}

test('review checker recomputes completed packet digests before integration eligibility', (t) => {
  const fixture = createFixture(t);
  fixture.review.integrationEligibility = {
    status: 'pending',
    exactHead: 'pending',
    trustedCi: 'pending',
    independentReview: 'satisfied',
    livePermission: 'pending',
    dcoOrProvenance: 'pending',
    repositoryRules: 'pending',
    idempotency: 'pending',
    evidence: [],
  };
  const staleDigest = `sha256:${'f'.repeat(64)}`;
  fixture.review.changeInventory.reviewedContentDigest = staleDigest;
  fixture.review.independentReview.reviewedContentDigest = staleDigest;
  fixture.review.independentReview.history[0].reviewedContentDigest = staleDigest;
  writeFile(
    fixture.root,
    fixture.reviewPath,
    markdownMetadata('AM-P0-004-F1 remediation review packet', fixture.review, fixture.sections)
  );

  const result = spawnSync(process.execPath, [reviewChecker], {
    cwd: fixture.root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /reviewed-content digest does not match/);
});

test('an adequate packet cannot replace integration evidence while retaining its reviewed digest', (t) => {
  const fixture = createFixture(t);
  fixture.review.integrationEligibility.evidence = ['Unreviewed replacement integration evidence'];
  writeFile(
    fixture.root,
    fixture.reviewPath,
    markdownMetadata('AM-P0-004-F1 remediation review packet', fixture.review, fixture.sections)
  );
  const result = spawnSync(process.execPath, [reviewChecker], {
    cwd: fixture.root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /reviewed-content digest does not match/);
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
