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
import { writeModelTraceFixture } from './fixtures/modeltrace.mjs';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const registry = loadSkillRegistry({ root });
const integration = resolveSkill('pui-integrate', registry);
const originalType = 'published-review-packet';

function withIntegrationFiles(run) {
  const directory = mkdtempSync(path.join(tmpdir(), 'pui-integration-handoff-'));
  try {
    const fixture = publicationRoundTrip();
    const identity = writeModelTraceFixture(directory, fixture.collected.repositoryId);
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
    artifacts.push(identity.artifact);
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
      ['modeltrace-record', '--record'],
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
          '--context',
          identity.contextPath,
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
