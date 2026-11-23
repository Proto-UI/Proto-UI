import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertServedArtifacts,
  expectedConsumers,
  validatePreparedConsumers,
} from './verify-native.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const groups = ['tooltip', 'select', 'old-cli'];
const stages = [
  'pack',
  ...groups.map((group) => group + '-preparation'),
  ...groups.map((group) => group + '-native'),
];

export function checkPipelineTerminal(pipeline, candidate) {
  assert.equal(pipeline.kind, 'installed-public-consumer-pipeline');
  assert.equal(pipeline.candidate, candidate);
  assert.equal(pipeline.status, 'passed', 'pipeline did not pass');
  assert(pipeline.finishedAt, 'pipeline has no terminal time');
  assert(!pipeline.failure && !pipeline.interrupted, 'pipeline retained a failure or interruption');
  assert.deepEqual(
    pipeline.rows.map((row) => row.name),
    stages,
    'pipeline stage inventory changed'
  );
  assert(
    pipeline.rows.every((row) => row.status === 'passed'),
    'failed or unrun stage cannot pass'
  );
  assert.equal(pipeline.sourceBefore.head, candidate);
  assert.equal(pipeline.sourceBefore.status, '');
  assert.deepEqual(pipeline.sourceAfter, pipeline.sourceBefore, 'candidate source drifted');
  assert.deepEqual(pipeline.helpersAfter, pipeline.helpersBefore, 'owner helpers drifted');
  assert.match(pipeline.node, /^v24\./, 'canonical owner did not use Node 24');
}

export function verifyResult(outputArgument, repositoryArgument, candidate) {
  assert(/^[0-9a-f]{40}$/.test(candidate), 'full candidate SHA required');
  const output = realpathSync(outputArgument);
  const repository = realpathSync(repositoryArgument);
  const pipeline = JSON.parse(readFileSync(join(output, 'pipeline.json'), 'utf8'));
  checkPipelineTerminal(pipeline, candidate);
  assert.equal(
    digest(readFileSync(join(output, 'authored-files.json'))),
    pipeline.authoredFilesSha256
  );
  const results = [];
  for (const group of groups) {
    const prepared = validatePreparedConsumers(join(output, group), repository, group, candidate);
    const prepStage = pipeline.rows.find((row) => row.name === group + '-preparation');
    assert.equal(
      realpathSync(prepStage.receipt),
      realpathSync(join(output, group, 'execution.json'))
    );
    assert.equal(prepStage.receiptSha256, prepared.installationReceiptSha256);
    const directory = join(output, group + '-native');
    const nativePath = join(directory, 'native.json');
    assert(lstatSync(nativePath).isFile() && !lstatSync(nativePath).isSymbolicLink());
    const bytes = readFileSync(nativePath);
    const native = JSON.parse(bytes);
    const stage = pipeline.rows.find((row) => row.name === group + '-native');
    assert.equal(realpathSync(stage.receipt), realpathSync(nativePath));
    assert.equal(digest(bytes), stage.receiptSha256);
    assert.equal(native.status, 'passed');
    assert.equal(native.group, group);
    assert.equal(native.candidate, candidate);
    assert.equal(native.installationReceiptSha256, prepared.installationReceiptSha256);
    assert.equal(native.packBindingSha256, prepared.execution.packBindingSha256);
    assert.deepEqual(native.preparedSource, prepared.binding.source);
    assert.deepEqual(native.packageOverrides, prepared.execution.packageOverrides);
    assert(native.finishedAt && native.browser, 'native browser execution did not finish');
    assert.equal(native.browserStarted, true);
    assert.equal(native.chromiumSandbox, true);
    assert.equal(native.serverClosed, true);
    assert.deepEqual(native.cleanupFailures, []);
    assert(!native.setupFailure && !native.integrityFailure);
    assert.match(native.node, /^v24\./);
    assert.deepEqual(
      native.rows.map(({ family, host }) => ({ family, host })),
      expectedConsumers(group)
    );
    assertServedArtifacts(native.responses, prepared.execution);
    for (const row of native.rows) {
      assert.equal(row.status, 'passed');
      assert.deepEqual(row.pageErrors, []);
      assert.deepEqual(row.consoleErrors, []);
      assert(!row.failure && !row.cleanupFailure && !row.captureFailure);
      const expected = ['open', 'closed'].map(
        (stage) => row.family + '-' + row.host + '-' + stage + '.png'
      );
      assert.deepEqual(
        row.captures.map((item) => item.path),
        expected,
        'native captures are incomplete'
      );
      for (const item of row.captures) {
        const path = join(directory, item.path);
        assert(lstatSync(path).isFile() && !lstatSync(path).isSymbolicLink());
        const capture = readFileSync(path);
        assert.equal(capture.length, item.bytes);
        assert.equal(digest(capture), item.sha256);
        assert.equal(capture.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      }
      if (group === 'old-cli') {
        assert.deepEqual(row.expectedRejection, {
          assertion: 'body-portal-outside-authored-app',
          observedProductOutcome: 'rejected',
          expected: true,
        });
      } else assert.equal(row.expectedRejection, undefined);
    }
    results.push({ group, status: 'passed', apps: native.rows.length });
  }
  return { candidate, status: 'passed', groups: results };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(
    process.argv.length,
    5,
    'usage: verify-result.mjs EVIDENCE REPOSITORY CANDIDATE_SHA'
  );
  console.log(JSON.stringify(verifyResult(...process.argv.slice(2))));
}
