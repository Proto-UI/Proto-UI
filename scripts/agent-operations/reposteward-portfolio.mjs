import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export const TRIAL_VERSION = '2026-08-22.manual-shadow';
export const ENGINE_REPOSITORY = 'tiammomo/RepoSteward';
export const ENGINE_COMMIT = 'e5db7d3496ef15072135533c5b9f4da91084b553';
export const TARGET_REPOSITORY = 'Proto-UI/Proto-UI';

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function boundedString(value, max = 1000) {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

export function validateRepoStewardPortfolio(raw) {
  assert(object(raw), 'portfolio root must be an object');
  assert(/^[0-9a-f]{64}$/.test(raw.snapshot_digest ?? ''), 'snapshot_digest is invalid');
  assert(
    raw.expected_digest === '' || /^[0-9a-f]{64}$/.test(raw.expected_digest ?? ''),
    'expected_digest is invalid'
  );
  if (raw.expected_digest === '') {
    assert(
      raw.matches_expected_digest === null,
      'matches_expected_digest must be null without an expectation'
    );
  } else {
    assert(
      typeof raw.matches_expected_digest === 'boolean',
      'matches_expected_digest must be boolean with an expectation'
    );
    assert(
      raw.matches_expected_digest === (raw.snapshot_digest === raw.expected_digest),
      'matches_expected_digest does not match the supplied digest'
    );
  }
  assert(object(raw.snapshot), 'snapshot must be an object');

  const snapshot = raw.snapshot;
  assert(snapshot.schema_version === 1, 'snapshot.schema_version must be 1');
  assert(
    String(snapshot.repository).toLowerCase() === TARGET_REPOSITORY.toLowerCase(),
    `snapshot.repository must be ${TARGET_REPOSITORY}`
  );
  assert(typeof snapshot.complete === 'boolean', 'snapshot.complete must be boolean');
  assert(Array.isArray(snapshot.pull_requests), 'snapshot.pull_requests must be an array');
  assert(Array.isArray(snapshot.overlaps), 'snapshot.overlaps must be an array');
  assert(Array.isArray(snapshot.errors), 'snapshot.errors must be an array');
  assert(object(snapshot.stats), 'snapshot.stats must be an object');

  const pullNumbers = new Set();
  for (const [index, pullRequest] of snapshot.pull_requests.entries()) {
    const prefix = `snapshot.pull_requests[${index}]`;
    assert(object(pullRequest), `${prefix} must be an object`);
    assert(
      Number.isInteger(pullRequest.number) && pullRequest.number > 0,
      `${prefix}.number is invalid`
    );
    assert(!pullNumbers.has(pullRequest.number), `${prefix}.number is duplicated`);
    pullNumbers.add(pullRequest.number);
    assert(boundedString(pullRequest.title, 500), `${prefix}.title is invalid`);
    assert(
      String(pullRequest.url).toLowerCase() ===
        `https://github.com/${TARGET_REPOSITORY}/pull/${pullRequest.number}`.toLowerCase(),
      `${prefix}.url is invalid`
    );
    assert(/^[0-9a-f]{40}$/.test(pullRequest.head_sha ?? ''), `${prefix}.head_sha is invalid`);
    assert(/^[0-9a-f]{40}$/.test(pullRequest.base_sha ?? ''), `${prefix}.base_sha is invalid`);
    assert(typeof pullRequest.draft === 'boolean', `${prefix}.draft must be boolean`);
    assert(
      typeof pullRequest.facts_complete === 'boolean',
      `${prefix}.facts_complete must be boolean`
    );
    assert(Array.isArray(pullRequest.files), `${prefix}.files must be an array`);
    assert(Array.isArray(pullRequest.checks), `${prefix}.checks must be an array`);
  }

  for (const [index, overlap] of snapshot.overlaps.entries()) {
    const prefix = `snapshot.overlaps[${index}]`;
    assert(object(overlap), `${prefix} must be an object`);
    assert(pullNumbers.has(overlap.left), `${prefix}.left does not reference an open pull request`);
    assert(
      pullNumbers.has(overlap.right),
      `${prefix}.right does not reference an open pull request`
    );
    assert(overlap.left < overlap.right, `${prefix} must use a stable ascending pair`);
    assert(
      Array.isArray(overlap.files) && overlap.files.length > 0,
      `${prefix}.files must not be empty`
    );
    assert(
      overlap.file_count === overlap.files.length,
      `${prefix}.file_count does not match files`
    );
  }

  for (const [index, error] of snapshot.errors.entries()) {
    const prefix = `snapshot.errors[${index}]`;
    assert(object(error), `${prefix} must be an object`);
    assert(
      error.pull_number === null || pullNumbers.has(error.pull_number),
      `${prefix}.pull_number does not reference an open pull request`
    );
    assert(boundedString(error.message, 2000), `${prefix}.message is invalid`);
  }

  const stats = snapshot.stats;
  const draftCount = snapshot.pull_requests.filter((pullRequest) => pullRequest.draft).length;
  const incompleteCount = snapshot.pull_requests.filter(
    (pullRequest) => !pullRequest.facts_complete
  ).length;
  const overlappingFiles = new Set(snapshot.overlaps.flatMap((overlap) => overlap.files));
  assert(
    stats.pull_requests === snapshot.pull_requests.length,
    'stats.pull_requests does not match'
  );
  assert(stats.draft_pull_requests === draftCount, 'stats.draft_pull_requests does not match');
  assert(
    stats.overlapping_pairs === snapshot.overlaps.length,
    'stats.overlapping_pairs does not match'
  );
  assert(
    stats.files_in_overlaps === overlappingFiles.size,
    'stats.files_in_overlaps does not match'
  );
  assert(
    stats.incomplete_pull_requests === incompleteCount,
    'stats.incomplete_pull_requests does not match'
  );
  if (snapshot.complete) {
    assert(snapshot.errors.length === 0, 'a complete snapshot must not contain errors');
    assert(incompleteCount === 0, 'a complete snapshot must not contain incomplete pull requests');
  }

  return raw;
}

export function buildEnvelope(raw, options) {
  validateRepoStewardPortfolio(raw);
  const generatedAt = new Date(options.generatedAt);
  assert(!Number.isNaN(generatedAt.valueOf()), 'generatedAt must be an ISO date-time');
  assert(
    String(options.engineCommit) === ENGINE_COMMIT,
    'engineCommit does not match the registered pin'
  );
  assert(boundedString(String(options.runId), 100), 'runId is invalid');
  const runAttempt = Number(options.runAttempt);
  assert(Number.isInteger(runAttempt) && runAttempt > 0, 'runAttempt must be a positive integer');

  const { snapshot } = raw;
  return {
    schemaVersion: 1,
    trialVersion: TRIAL_VERSION,
    mode: 'manual-shadow',
    generatedAt: generatedAt.toISOString(),
    repository: TARGET_REPOSITORY,
    engine: {
      repository: ENGINE_REPOSITORY,
      commit: ENGINE_COMMIT,
      command: 'portfolio inspect',
    },
    githubRun: {
      id: String(options.runId),
      attempt: runAttempt,
    },
    snapshot: {
      digest: raw.snapshot_digest,
      expectedDigest: raw.expected_digest || null,
      matchesExpectedDigest: raw.matches_expected_digest,
      complete: snapshot.complete,
      pullRequestCount: snapshot.stats.pull_requests,
      draftPullRequestCount: snapshot.stats.draft_pull_requests,
      overlappingPairCount: snapshot.stats.overlapping_pairs,
      overlappingFileCount: snapshot.stats.files_in_overlaps,
      incompletePullRequestCount: snapshot.stats.incomplete_pull_requests,
      errorCount: snapshot.errors.length,
    },
    writeOperationsPerformed: 0,
  };
}

export function renderStepSummary(envelope) {
  const status = envelope.snapshot.complete ? 'complete' : 'incomplete (see raw artifact errors)';
  const lines = [
    '## RepoSteward portfolio shadow trial',
    '',
    `- Engine commit: \`${envelope.engine.commit}\``,
    `- Snapshot: \`${envelope.snapshot.digest}\``,
    `- Completeness: ${status}`,
    `- Open pull requests: ${envelope.snapshot.pullRequestCount}`,
    `- Draft pull requests: ${envelope.snapshot.draftPullRequestCount}`,
    `- Overlapping PR pairs: ${envelope.snapshot.overlappingPairCount}`,
    `- Files present in overlaps: ${envelope.snapshot.overlappingFileCount}`,
    `- Incomplete pull requests: ${envelope.snapshot.incompletePullRequestCount}`,
    `- Snapshot errors: ${envelope.snapshot.errorCount}`,
    `- GitHub writes performed: ${envelope.writeOperationsPerformed}`,
  ];
  if (envelope.snapshot.expectedDigest) {
    lines.push(
      `- Expected snapshot: \`${envelope.snapshot.expectedDigest}\``,
      `- Expected digest match: ${envelope.snapshot.matchesExpectedDigest ? 'yes' : 'no'}`
    );
  }
  lines.push('');
  return lines.join('\n');
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (
      [
        '--input',
        '--output',
        '--summary',
        '--engine-commit',
        '--run-id',
        '--run-attempt',
        '--generated-at',
      ].includes(option)
    ) {
      args[option.slice(2).replaceAll('-', '_')] = argv[++index];
    } else {
      throw new Error(`Unknown option: ${option}`);
    }
  }
  for (const required of [
    'input',
    'output',
    'summary',
    'engine_commit',
    'run_id',
    'run_attempt',
    'generated_at',
  ]) {
    if (!args[required]) throw new Error(`--${required.replaceAll('_', '-')} is required`);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const raw = JSON.parse(fs.readFileSync(path.resolve(args.input), 'utf8'));
  const envelope = buildEnvelope(raw, {
    engineCommit: args.engine_commit,
    runId: args.run_id,
    runAttempt: args.run_attempt,
    generatedAt: args.generated_at,
  });
  fs.writeFileSync(path.resolve(args.output), `${JSON.stringify(envelope, null, 2)}\n`);
  fs.writeFileSync(path.resolve(args.summary), renderStepSummary(envelope));
  console.log(
    `[reposteward-portfolio] OK (${envelope.snapshot.pullRequestCount} pull requests, ${envelope.snapshot.overlappingPairCount} overlap pairs, complete=${envelope.snapshot.complete})`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(`[reposteward-portfolio] ${error.message}`);
    process.exitCode = 1;
  }
}
