import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { validateSkillHandoff } from '../skill-registry.mjs';
const digest = (bytes) => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
for (const version of [1, 2])
  test(`v${version} validation can bind digestless candidate inputs without returning to the producer`, () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'candidate-binding-'));
    try {
      const candidatePath = path.join(directory, 'candidate.json'),
        oldReportPath = path.join(directory, 'before.json');
      writeFileSync(candidatePath, 'actual candidate');
      writeFileSync(oldReportPath, 'actual old report');
      const prior = {
        schemaVersion: version,
        kind: 'proto-ui.skill-handoff',
        entrypoint: 'development',
        executionMode: 'human-assisted',
        executionModeSource: 'current-user',
        fromId: 'pui-regression',
        nextSkillId: 'pui-validate',
        artifacts: [
          { type: 'authority-map', reference: 'fixture:authority' },
          { type: 'candidate-change', reference: pathToFileURL(candidatePath).href },
          { type: 'evidence-report', reference: oldReportPath },
        ],
        humanGates: [],
        notes: [],
      };
      if (version === 2) {
        prior.outcome = 'completed';
        prior.binding = {
          repositoryId: 'github.com:Proto-UI/Proto-UI',
          scopeId: 'pull-request:825',
          headSha: 'a'.repeat(40),
          reviewInputDigest: null,
        };
      }
      const review = {
        ...structuredClone(prior),
        fromId: 'pui-validate',
        nextSkillId: 'pui-review',
      };
      review.artifacts = review.artifacts.filter((a) => a.type !== 'evidence-report');
      const candidate = review.artifacts.find((a) => a.type === 'candidate-change');
      candidate.digest = digest('actual candidate');
      if (version === 2) candidate.revision = prior.binding.headSha;
      const report = {
        type: 'evidence-report',
        reference: 'fixture:new-report',
        digest: digest('new report'),
      };
      if (version === 2) {
        report.revision = prior.binding.headSha;
        report.result = 'failed';
      }
      review.artifacts.push(report, { type: 'review-input', reference: 'fixture:review' });
      assert.equal(validateSkillHandoff(prior).nextSkill.id, 'pui-validate');
      assert.equal(
        validateSkillHandoff(review, undefined, { priorHandoff: prior }).nextSkill.id,
        'pui-review'
      );
      for (const mutate of [
        (h) => (h.artifacts.find((a) => a.type === 'candidate-change').reference = oldReportPath),
        (h) => (h.artifacts.find((a) => a.type === 'evidence-report').reference = oldReportPath),
      ]) {
        const bad = structuredClone(review);
        mutate(bad);
        assert.throws(() => validateSkillHandoff(bad, undefined, { priorHandoff: prior }));
      }
      const file = path.join(directory, 'review.json'),
        input = path.join(directory, 'input.json');
      writeFileSync(file, JSON.stringify(review));
      writeFileSync(input, JSON.stringify(prior));
      for (const command of [
        ['scripts/agent-operations/resolve-skill.mjs'],
        [
          'scripts/agent-operations/review-packet.mjs',
          'eligibility',
          '--review-class',
          'review-governance-and-release-evidence',
        ],
      ]) {
        const result = spawnSync(
          process.execPath,
          [...command, '--handoff', file, '--prior-handoff', input],
          { encoding: 'utf8' }
        );
        assert.equal(result.status, 0, result.stderr);
      }

      // No file is opened by the validator. The actual validation step computes the
      // hash; this structural API cannot authenticate a caller's newly supplied hash.
      const untrusted = structuredClone(review);
      untrusted.artifacts.find((a) => a.type === 'candidate-change').digest = digest('invented');
      assert.equal(
        validateSkillHandoff(untrusted, undefined, { priorHandoff: prior }).nextSkill.id,
        'pui-review'
      );
      const alreadyBound = {
        ...structuredClone(prior),
        artifacts: prior.artifacts.map((a) =>
          a.type === 'candidate-change' ? structuredClone(candidate) : a
        ),
      };
      assert.throws(() =>
        validateSkillHandoff(untrusted, undefined, { priorHandoff: alreadyBound })
      );
      // References remain opaque, including unreadable paths; no new filesystem or network access.
      const opaquePrior = structuredClone(prior),
        opaqueReview = structuredClone(review);
      opaquePrior.artifacts.find((a) => a.type === 'candidate-change').reference =
        'file:///unavailable/private-candidate';
      opaqueReview.artifacts.find((a) => a.type === 'candidate-change').reference =
        'file:///unavailable/private-candidate';
      assert.equal(
        validateSkillHandoff(opaqueReview, undefined, { priorHandoff: opaquePrior }).nextSkill.id,
        'pui-review'
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
