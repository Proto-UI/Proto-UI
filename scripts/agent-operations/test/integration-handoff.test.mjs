import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadSkillRegistry, resolveSkill, validateSkillHandoff } from '../skill-registry.mjs';
import { computeReviewInputDigest, computeReviewPacketDigest } from '../review-runtime.mjs';
import { publicationRoundTrip } from './fixtures/review-publication.mjs';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const registry = loadSkillRegistry({ root });
const integration = resolveSkill('pui-integrate', registry);
const originalType = 'published-review-packet';

function withIntegrationFiles(run) {
  const directory = mkdtempSync(path.join(tmpdir(), 'pui-integration-handoff-'));
  try {
    const fixture = publicationRoundTrip();
    const artifacts = [
      ['review-packet', fixture.mergePacket, computeReviewPacketDigest],
      ['review-input', fixture.collected, computeReviewInputDigest],
      [originalType, fixture.reviewed, computeReviewPacketDigest],
    ].map(([type, value, digest]) => {
      const reference = path.join(directory, `${type}.json`);
      writeFileSync(reference, JSON.stringify(value));
      return { type, reference, digest: `sha256:${digest(value)}` };
    });
    artifacts.push({ type: 'mutation-authorization', reference: 'explicit-current-user' });
    const handoff = {
      schemaVersion: 1,
      kind: 'proto-ui.skill-handoff',
      entrypoint: 'development',
      executionMode: 'human-assisted',
      executionModeSource: 'current-user',
      fromId: 'pui-review',
      nextSkillId: 'pui-integrate',
      artifacts,
      humanGates: [],
      notes: [],
    };
    const handoffPath = path.join(directory, 'handoff.json');
    const callsPath = path.join(directory, 'calls.jsonl');
    const preloadPath = path.join(directory, 'mock-gh.mjs');
    writeFileSync(
      preloadPath,
      `
      import cp from 'node:child_process';
      import { appendFileSync } from 'node:fs';
      import { syncBuiltinESMExports } from 'node:module';
      cp.execFileSync = (command, args) => {
        appendFileSync(process.env.PUI_HANDOFF_TEST_CALLS, JSON.stringify({ command, args }) + '\\n');
        throw new Error('mock live collection boundary reached');
      };
      syncBuiltinESMExports();
      `
    );
    const options = new Map([
      ['review-packet', '--packet'],
      ['review-input', '--input'],
      [originalType, '--published-review-packet'],
      ['mutation-authorization', '--authorization'],
    ]);
    const invoke = (candidate = handoff, supplied = artifacts) => {
      writeFileSync(handoffPath, JSON.stringify(candidate));
      writeFileSync(callsPath, '');
      const result = spawnSync(
        process.execPath,
        [
          '--import',
          pathToFileURL(preloadPath).href,
          path.join(root, 'scripts/agent-operations/review-packet.mjs'),
          'merge-pull-request',
          '--mode',
          'human-assisted',
          '--mode-source',
          'current-user',
          '--handoff',
          handoffPath,
          ...supplied.flatMap(({ type, reference }) => [options.get(type), reference]),
        ],
        {
          cwd: root,
          encoding: 'utf8',
          env: { ...process.env, PUI_HANDOFF_TEST_CALLS: callsPath },
        }
      );
      assert.ifError(result.error);
      return { ...result, calls: readFileSync(callsPath, 'utf8') };
    };
    run({ artifacts, handoff, invoke, fixture });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('exact declared integration inputs route both refreshed and original review packets', () => {
  withIntegrationFiles(({ artifacts, handoff, invoke, fixture }) => {
    const declared = integration.requires.map((type) => {
      const artifact = artifacts.find((item) => item.type === type);
      assert.ok(artifact, `missing fixture for declared artifact ${type}`);
      return artifact;
    });
    const routed = { ...handoff, artifacts: declared };
    assert.equal(validateSkillHandoff(routed, registry).nextSkill.id, 'pui-integrate');
    const result = invoke(routed, declared);
    assert.match(result.stderr, /mock live collection boundary reached/);
    assert.match(result.calls, /"command":"gh"/);
    assert.notEqual(fixture.mergePacket.reviewInputDigest, fixture.reviewed.reviewInputDigest);
    assert.notEqual(
      computeReviewPacketDigest(fixture.mergePacket),
      computeReviewPacketDigest(fixture.reviewed)
    );
  });
});

test('integration cannot route or collect live input without the distinct original artifact', () => {
  withIntegrationFiles(({ handoff, invoke }) => {
    const missing = {
      ...handoff,
      artifacts: handoff.artifacts.filter(({ type }) => type !== originalType),
    };
    assert.throws(
      () => validateSkillHandoff(missing, registry),
      /lacks artifact required by pui-integrate: published-review-packet/
    );
    // Supplying the original CLI file does not repair an incomplete handoff.
    const result = invoke(missing);
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /lacks artifact required by pui-integrate: published-review-packet/
    );
    assert.equal(result.calls, '');
  });
});

test('integration binds the original artifact reference and complete packet digest before collection', () => {
  withIntegrationFiles(({ handoff, invoke }) => {
    for (const mutate of [
      (artifact) => ({ ...artifact, reference: `${artifact.reference}.different` }),
      (artifact) => ({ ...artifact, digest: `sha256:${'f'.repeat(64)}` }),
      ({ digest: _digest, ...artifact }) => artifact,
    ]) {
      const unbound = {
        ...handoff,
        artifacts: handoff.artifacts.map((artifact) =>
          artifact.type === originalType ? mutate(artifact) : artifact
        ),
      };
      assert.equal(validateSkillHandoff(unbound, registry).nextSkill.id, 'pui-integrate');
      const result = invoke(unbound);
      assert.equal(result.status, 1);
      assert.match(
        result.stderr,
        /integration handoff published-review-packet artifact does not bind/
      );
      assert.equal(result.calls, '');
    }
  });
});

test('changing the original file content invalidates its retained handoff digest', () => {
  withIntegrationFiles(({ handoff, invoke, fixture }) => {
    const original = handoff.artifacts.find(({ type }) => type === originalType);
    // A different observation time is structurally valid, but it is not the
    // exact original that this handoff retained before publication.
    writeFileSync(
      original.reference,
      JSON.stringify({ ...fixture.reviewed, observedAt: '2026-08-27T06:00:01.000Z' })
    );
    const result = invoke();
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /published-review-packet artifact does not bind original packet content/
    );
    assert.equal(result.calls, '');
  });
});

test('terminal local reviews and integration receipts do not require a published approval', () => {
  for (const [fromId, type] of [
    ['pui-review', 'review-packet'],
    ['pui-integrate', 'mutation-receipt'],
  ]) {
    const handoff = {
      schemaVersion: 1,
      kind: 'proto-ui.skill-handoff',
      entrypoint: 'development',
      executionMode: 'human-assisted',
      executionModeSource: 'current-user',
      fromId,
      nextSkillId: null,
      artifacts: [{ type, reference: `memory:${type}` }],
      humanGates: [],
      notes: [],
    };
    assert.equal(validateSkillHandoff(handoff, registry).nextSkill, null);
  }
});

test('internal fast-linear PR handoff enters pui-integrate with exact-head verification and without review packets', () => {
  const head = 'a'.repeat(40);
  const digest = (ch) => `sha256:${ch.repeat(64)}`;
  const baseHandoff = {
    schemaVersion: 2,
    kind: 'proto-ui.skill-handoff',
    entrypoint: 'development',
    executionMode: 'human-assisted',
    executionModeSource: 'current-user',
    fromId: 'pui-validate',
    nextSkillId: 'pui-integrate',
    outcome: 'completed',
    binding: {
      repositoryId: 'github.com:Proto-UI/Proto-UI',
      scopeId: 'pr-1988',
      headSha: head,
      reviewInputDigest: null,
    },
    artifacts: [
      { type: 'capability-envelope', reference: 'memory:env', digest: digest('1') },
      {
        type: 'evidence-report',
        reference: 'memory:evidence',
        digest: digest('2'),
        revision: head,
        result: 'passed',
      },
      { type: 'github-snapshot', reference: 'memory:gh', digest: digest('3') },
      { type: 'mutation-authorization', reference: 'memory:auth', digest: digest('4') },
      {
        type: 'internal-pr-verification',
        reference: 'memory:internal-pr',
        digest: digest('5'),
        revision: head,
      },
    ],
    humanGates: [],
    notes: [],
  };

  const validated = validateSkillHandoff(baseHandoff, registry);
  assert.equal(validated.nextSkill.id, 'pui-integrate');
  assert.deepEqual(validated.nextSkill.requires, [
    'capability-envelope',
    'evidence-report',
    'github-snapshot',
    'mutation-authorization',
    'internal-pr-verification',
  ]);

  // Mismatched head revision fails closed.
  assert.throws(
    () =>
      validateSkillHandoff(
        {
          ...baseHandoff,
          artifacts: baseHandoff.artifacts.map((artifact) =>
            artifact.type === 'internal-pr-verification'
              ? { ...artifact, revision: 'b'.repeat(40) }
              : artifact
          ),
        },
        registry
      ),
    /internal-pr-verification must bind its exact current head/
  );

  // Non-passed evidence report fails closed.
  assert.throws(
    () =>
      validateSkillHandoff(
        {
          ...baseHandoff,
          artifacts: baseHandoff.artifacts.map((artifact) =>
            artifact.type === 'evidence-report' ? { ...artifact, result: 'failed' } : artifact
          ),
        },
        registry
      ),
    /requires a passed current-head evidence-report with digest/
  );

  // Routing to another leaf fails closed.
  assert.throws(
    () => validateSkillHandoff({ ...baseHandoff, nextSkillId: 'pui-review' }, registry),
    /next leaf does not admit internal linear integration/
  );
});
