import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadSkillRegistry, validateSkillHandoff } from '../skill-registry.mjs';
const registry = loadSkillRegistry();
const digest = (letter) => `sha256:${letter.repeat(64)}`;
function fixture(version) {
  const prior = {
    schemaVersion: version,
    kind: 'proto-ui.skill-handoff',
    entrypoint: 'development',
    executionMode: 'human-assisted',
    executionModeSource: 'current-user',
    fromId: 'pui-package-budget',
    nextSkillId: 'pui-validate',
    artifacts: ['authority-map', 'candidate-change', 'evidence-report', 'review-input'].map(
      (type) => ({ type, reference: `fixture:${type}`, digest: digest('a') })
    ),
    humanGates: [],
    notes: [],
  };
  if (version === 2) {
    prior.outcome = 'completed';
    prior.binding = {
      repositoryId: 'github.com:Proto-UI/Proto-UI',
      scopeId: 'pull-request:825',
      headSha: 'b'.repeat(40),
      reviewInputDigest: null,
    };
    for (const a of prior.artifacts)
      if (['candidate-change', 'evidence-report'].includes(a.type)) {
        a.revision = prior.binding.headSha;
        if (a.type === 'evidence-report') a.result = 'failed';
      }
  }
  const stale = { ...structuredClone(prior), fromId: 'pui-validate', nextSkillId: 'pui-review' };
  const good = structuredClone(stale);
  const report = {
    ...good.artifacts.find((a) => a.type === 'evidence-report'),
    reference: 'fixture:final-report',
    digest: digest('c'),
  };
  if (version === 2) report.result = 'passed';
  good.artifacts = good.artifacts.filter((a) => a.type !== 'evidence-report').concat(report);
  return { prior, stale, good };
}
for (const version of [1, 2]) {
  test(`v${version} validation rejects carried reports and requires received candidate`, () => {
    const { prior, stale, good } = fixture(version);
    assert.throws(() => validateSkillHandoff(stale, registry));
    assert.throws(() => validateSkillHandoff(stale, registry, { priorHandoff: prior }));
    assert.equal(
      validateSkillHandoff(good, registry, { priorHandoff: prior }).nextSkill.id,
      'pui-review'
    );
    for (const mutate of [
      (h) => (h.artifacts.find((a) => a.type === 'evidence-report').digest = digest('a')),
      (h) => delete h.artifacts.find((a) => a.type === 'evidence-report').digest,
      (h) => (h.artifacts.find((a) => a.type === 'candidate-change').digest = digest('d')),
    ]) {
      const h = structuredClone(good);
      mutate(h);
      assert.throws(() => validateSkillHandoff(h, registry, { priorHandoff: prior }));
    }
    if (version === 2) {
      for (const result of ['passed', 'failed', 'partial', 'not-run']) {
        const observed = structuredClone(good);
        observed.artifacts.find((a) => a.type === 'evidence-report').result = result;
        assert.equal(
          validateSkillHandoff(observed, registry, { priorHandoff: prior }).nextSkill.id,
          'pui-review'
        );
      }
      const historical = structuredClone(good);
      historical.artifacts.push(prior.artifacts.find((a) => a.type === 'evidence-report'));
      assert.equal(
        validateSkillHandoff(historical, registry, { priorHandoff: prior }).nextSkill.id,
        'pui-review'
      );
      for (const mutate of [
        (h) => (h.artifacts.find((a) => a.type === 'evidence-report').revision = 'd'.repeat(40)),
        (h) => delete h.artifacts.find((a) => a.type === 'evidence-report').result,
        (h) => (h.binding.headSha = 'e'.repeat(40)),
      ]) {
        const h = structuredClone(good);
        mutate(h);
        assert.throws(() => validateSkillHandoff(h, registry, { priorHandoff: prior }));
      }
    }
  });
  test(`v${version} actual resolver rejects stale evidence with and without predecessor`, () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'validation-refresh-'));
    const { prior, stale, good } = fixture(version);
    const file = path.join(dir, 'handoff.json'),
      received = path.join(dir, 'prior.json');
    writeFileSync(received, JSON.stringify(prior));
    const run = (h, withPrior = true) => {
      writeFileSync(file, JSON.stringify(h));
      return spawnSync(
        process.execPath,
        [
          'scripts/agent-operations/resolve-skill.mjs',
          '--handoff',
          file,
          ...(withPrior ? ['--prior-handoff', received] : []),
        ],
        { encoding: 'utf8' }
      );
    };
    try {
      assert.equal(run(stale).status, 1);
      assert.equal(run(stale, false).status, 1);
      const result = run(good);
      assert.equal(result.status, 0, result.stderr);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

for (const version of [1, 2]) {
  test(`v${version} review CLI consumes the actual validation predecessor`, () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'review-refresh-'));
    const file = path.join(directory, 'handoff.json');
    const priorFile = path.join(directory, 'prior.json');
    const { prior, stale, good } = fixture(version);
    writeFileSync(priorFile, JSON.stringify(prior));
    const run = (handoff, withPrior = true) => {
      writeFileSync(file, JSON.stringify(handoff));
      return spawnSync(
        process.execPath,
        [
          'scripts/agent-operations/review-packet.mjs',
          'eligibility',
          '--handoff',
          file,
          '--review-class',
          'review-governance-and-release-evidence',
          ...(withPrior ? ['--prior-handoff', priorFile] : []),
        ],
        { encoding: 'utf8' }
      );
    };
    try {
      const missing = run(good, false);
      assert.equal(missing.status, 1);
      assert.match(missing.stderr, /requires the handoff received/);
      const unchanged = run(stale);
      assert.equal(unchanged.status, 1);
      assert.match(unchanged.stderr, /new current-candidate evidence/);
      const refreshed = run(good);
      assert.equal(refreshed.status, 0, refreshed.stderr);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
