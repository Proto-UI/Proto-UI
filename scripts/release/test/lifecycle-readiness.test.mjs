import assert from 'node:assert/strict';
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const report = (args) =>
  spawnSync(process.execPath, ['--import', 'tsx', 'scripts/spec/lifecycle-report.mjs', ...args], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1 << 25,
  });
const ids = 'C-A11Y-PART-RELATIONSHIP-0001,T-A11Y-PART-RELATIONSHIP-0001';

test('release lifecycle CLI distinguishes scoped review from full-inventory completion', () => {
  const scoped = report(['--check', '--entities', ids, '--json']);
  assert.equal(scoped.status, 0, scoped.stderr);
  const data = JSON.parse(scoped.stdout);
  assert.equal(data.basis, 'current-catalog');
  assert.equal(data.summary.reviewedDrafts, 2);
  assert.ok(data.unreviewedEntities.length > 0);
  assert.equal(
    data.rows
      .filter((row) => ids.split(',').includes(row.entityId))
      .every((row) => row.status === 'draft'),
    true
  );
  const full = report(['--check']);
  assert.equal(full.status, 1);
  assert.match(full.stderr, /has no authored release disposition/);
  const wrongScope = report(['--check', '--entities', 'C-ABSENT-0001']);
  assert.equal(wrongScope.status, 1);
  assert.match(wrongScope.stderr, /outside the report scope/);
});

test('release lifecycle reports are reproducible and require a declared version', () => {
  const first = report(['--json']);
  const second = report(['--json']);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(second.stdout, first.stdout);
  const unknown = report(['--version', '99.0.0']);
  assert.notEqual(unknown.status, 0);
  assert.match(unknown.stderr, /No V entity declares/);
});

test('release preparation and changed-entity CI invoke the lifecycle tools', () => {
  const rehearsal = readFileSync(new URL('../rehearse.mjs', import.meta.url), 'utf8');
  assert.match(rehearsal, /'release:lifecycle'/);
  assert.match(rehearsal, /lifecycle-review\.json/);
  const workflow = parse(
    readFileSync(new URL('../../../.github/workflows/ci.yml', import.meta.url), 'utf8')
  );
  const steps = workflow.jobs.test.steps;
  assert.equal(
    steps.find((step) => step.uses?.startsWith('actions/checkout')).with['fetch-depth'],
    0
  );
  const gate = steps.find((step) => step.name === 'Public documentation gate and repository tests');
  assert.match(gate.env.SPEC_AUTHORING_BASE, /pull_request\.base\.sha/);
  assert.match(gate.run, /check:spec-authoring -- --base/);
});

test('authoring preserves identities across deletion, replacement, and file moves', () => {
  const fixture = mkdtempSync(path.join(tmpdir(), 'proto-lifecycle-authoring-'));
  const run = (command, args) =>
    spawnSync(command, args, {
      cwd: fixture,
      encoding: 'utf8',
      env: { ...process.env, TSX_TSCONFIG_PATH: path.join(root, 'tsconfig.json') },
    });
  const check = () =>
    run(process.execPath, [
      '--import',
      'tsx',
      'scripts/spec/check-lifecycle-authoring.mjs',
      '--base',
      'HEAD',
    ]);
  try {
    // Reuse existing history; this fixture never creates a commit.
    const cloned = run('git', ['clone', '--quiet', '--shared', root, fixture]);
    assert.equal(cloned.status, 0, cloned.stderr);
    symlinkSync(path.join(root, 'node_modules'), path.join(fixture, 'node_modules'), 'dir');
    copyFileSync(
      path.join(root, 'scripts/spec/check-lifecycle-authoring.mjs'),
      path.join(fixture, 'scripts/spec/check-lifecycle-authoring.mjs')
    );
    const versionPath = path.join(fixture, 'VERSION');
    const originalVersion = readFileSync(versionPath, 'utf8');
    writeFileSync(versionPath, '0.2.0\n');
    assert.equal(run('git', ['diff', '--name-only', 'HEAD', '--', 'spec']).stdout, '');
    const versionOnly = check();
    assert.equal(versionOnly.status, 0, versionOnly.stderr);
    assert.match(versionOnly.stdout, /1 changed catalog inputs checked/);
    writeFileSync(versionPath, originalVersion);

    const rationalePath = path.join(fixture, 'spec/contracts/C-A11Y-PART-RELATIONSHIP-0001.yaml');
    const rationaleSource = readFileSync(rationalePath, 'utf8');
    const withoutRationale = parse(rationaleSource);
    delete withoutRationale.lifecycleRationale;
    writeFileSync(rationalePath, JSON.stringify(withoutRationale));
    const rationaleRemoval = check();
    assert.equal(rationaleRemoval.status, 1);
    assert.match(rationaleRemoval.stderr, /retain recorded lifecycleRationale/);
    writeFileSync(rationalePath, rationaleSource);

    const targetPath = path.join(fixture, 'spec/contracts/C-AS-TRANSITION-0001.yaml');
    const targetSource = readFileSync(targetPath, 'utf8');
    const activeTestPath = path.join(fixture, 'spec/tests/T-AS-TRANSITION-0001.yaml');
    const activeTestSource = readFileSync(activeTestPath, 'utf8');
    const target = parse(targetSource);
    target.criteria = target.criteria.filter(
      (criterion) => criterion.id !== 'C-AS-TRANSITION-0001-K'
    );
    writeFileSync(targetPath, JSON.stringify(target));
    const externalCriterion = check();
    assert.equal(externalCriterion.status, 1, externalCriterion.stdout);
    assert.match(externalCriterion.stderr, /T-AS-TRANSITION-0001: case-invalid-criterion/);
    assert.match(externalCriterion.stderr, /C-AS-TRANSITION-0001-K/);
    assert.equal(readFileSync(activeTestPath, 'utf8'), activeTestSource);
    writeFileSync(targetPath, targetSource);

    const editedActiveTest = parse(activeTestSource);
    editedActiveTest.cases[0].covers = [];
    writeFileSync(activeTestPath, JSON.stringify(editedActiveTest));
    const disconnectedCase = check();
    assert.equal(disconnectedCase.status, 1, disconnectedCase.stdout);
    assert.match(disconnectedCase.stderr, /T-AS-TRANSITION-0001: case-needs-criteria/);
    for (const status of ['deprecated', 'removed']) {
      const retirementOwner = parse(targetSource);
      if (status === 'removed') {
        retirementOwner.verifies.tests = [{ id: 'T-AS-TRANSITION-0001', until: '0.5.0' }];
        writeFileSync(targetPath, JSON.stringify(retirementOwner));
      }
      writeFileSync(
        activeTestPath,
        JSON.stringify({
          ...editedActiveTest,
          status,
          deprecatedSince: '0.4.0',
          removedSince: status === 'removed' ? '0.5.0' : undefined,
          lifecycleRationale: 'The future retirement boundary was reviewed.',
        })
      );
      const futureRetirement = check();
      assert.equal(futureRetirement.status, 1, futureRetirement.stdout);
      assert.match(futureRetirement.stderr, /T-AS-TRANSITION-0001: case-needs-criteria/);
      writeFileSync(targetPath, targetSource);
    }
    writeFileSync(activeTestPath, activeTestSource);

    const entityPath = path.join(fixture, 'spec/contracts/C-A11Y-PART-RELATIONSHIP-0001.yaml');
    const movedPath = path.join(fixture, 'spec/contracts/moved-relationship.yaml');
    const original = readFileSync(entityPath, 'utf8');
    for (const extension of ['txt', 'YAML']) {
      const renamedPath = path.join(fixture, `spec/contracts/renamed-relationship.${extension}`);
      const renamed = run('git', ['mv', entityPath, renamedPath]);
      assert.equal(renamed.status, 0, renamed.stderr);
      assert.match(run('git', ['diff', '--name-status', 'HEAD', '--', 'spec']).stdout, /^R100\s/m);
      const lostIdentity = check();
      assert.equal(lostIdentity.status, 1, lostIdentity.stdout);
      assert.match(lostIdentity.stderr, /C-A11Y-PART-RELATIONSHIP-0001: retain the entity/);
      const restored = run('git', ['mv', renamedPath, entityPath]);
      assert.equal(restored.status, 0, restored.stderr);
    }
    renameSync(entityPath, movedPath);
    const moved = check();
    assert.equal(moved.status, 0, moved.stderr);
    writeFileSync(
      movedPath,
      JSON.stringify({
        ...parse(original),
        status: 'active',
        activeSince: '0.3.0-alpha.0',
      })
    );
    const promotedMove = check();
    assert.equal(promotedMove.status, 1);
    assert.match(promotedMove.stderr, /updated lifecycleRationale/);
    assert.match(promotedMove.stderr, /new admission revision/);
    const draft = parse(original);
    writeFileSync(
      movedPath,
      JSON.stringify({
        ...draft,
        status: 'active',
        activeSince: '0.3.0-alpha.0',
        lifecycleRationale: 'The proposed admission was reviewed.',
        revisions: [
          ...(draft.revisions ?? []),
          {
            version: '0.3.0-alpha.0',
            change: 'admitted',
            summary: 'Admission was reviewed.',
          },
        ],
      })
    );
    const incompletePromotion = check();
    assert.equal(incompletePromotion.status, 1);
    assert.match(incompletePromotion.stderr, /admission activation-blocked/);
    assert.match(incompletePromotion.stderr, /admission criterion-needs-evidence/);
    rmSync(movedPath);
    const deleted = check();
    assert.equal(deleted.status, 1);
    assert.match(deleted.stderr, /C-A11Y-PART-RELATIONSHIP-0001: retain the entity/);
    writeFileSync(
      entityPath,
      original.replaceAll('C-A11Y-PART-RELATIONSHIP-0001', 'C-A11Y-PART-RELATIONSHIP-0099')
    );
    const replaced = check();
    assert.equal(replaced.status, 1);
    assert.match(replaced.stderr, /C-A11Y-PART-RELATIONSHIP-0001: retain the entity/);
    writeFileSync(entityPath, original);
    writeFileSync(
      path.join(fixture, 'spec/contracts/C-REVIEW-UNTRACKED-0001.yaml'),
      JSON.stringify({
        id: 'C-REVIEW-UNTRACKED-0001',
        type: 'contract',
        title: 'Untracked draft',
        status: 'draft',
        since: '0.3.0-alpha.0',
      })
    );
    const untracked = check();
    assert.equal(untracked.status, 1);
    assert.match(untracked.stderr, /C-REVIEW-UNTRACKED-0001: .*requires lifecycleRationale/);
    const newActive = {
      id: 'C-REVIEW-UNTRACKED-0001',
      type: 'contract',
      title: 'New admission',
      status: 'active',
      since: '0.3.0-alpha.0',
      activeSince: '0.3.0-alpha.0',
      lifecycleRationale: 'The initial admission was reviewed.',
    };
    const newPath = path.join(fixture, 'spec/contracts/C-REVIEW-UNTRACKED-0001.yaml');
    writeFileSync(newPath, JSON.stringify(newActive));
    const emptyAdmission = check();
    assert.equal(emptyAdmission.status, 1);
    assert.match(emptyAdmission.stderr, /admission missing-statement/);
    assert.match(emptyAdmission.stderr, /admission missing-criteria/);
    newActive.statement = 'A bounded requirement.';
    newActive.criteria = [{ id: 'C-REVIEW-UNTRACKED-0001-A', text: 'A reviewed criterion.' }];
    writeFileSync(newPath, JSON.stringify(newActive));
    const evidencePath = path.join(fixture, 'spec/tests/T-REVIEW-UNTRACKED-0001.yaml');
    writeFileSync(
      evidencePath,
      JSON.stringify({
        id: 'T-REVIEW-UNTRACKED-0001',
        type: 'test',
        title: 'Admission evidence',
        status: 'draft',
        since: '0.3.0-alpha.0',
        lifecycleRationale: 'The execution map remains under review.',
        verifies: { contracts: [newActive.id] },
        cases: [
          {
            id: 'T-REVIEW-UNTRACKED-0001-CASE-ONE',
            title: 'Requirement',
            covers: ['C-REVIEW-UNTRACKED-0001-A'],
            expectation: 'governed-result',
          },
        ],
        implementations: [
          {
            id: 'runtime',
            kind: 'runtime-test',
            status: 'passing',
            required: true,
            path: 'packages/spec/fixtures/test/lifecycle-readiness.test.ts',
            consumesCases: ['T-REVIEW-UNTRACKED-0001-CASE-ONE'],
          },
        ],
      })
    );
    const supportedAdmission = check();
    assert.equal(supportedAdmission.status, 0, supportedAdmission.stderr);
    rmSync(evidencePath);

    const historicalTestPath = path.join(fixture, 'spec/tests/T-LIFECYCLE-0001.yaml');
    const historicalTestSource = readFileSync(historicalTestPath, 'utf8');
    const historicalTest = parse(historicalTestSource);
    newActive.since = '0.2.0';
    newActive.activeSince = '0.2.0';
    writeFileSync(newPath, JSON.stringify(newActive));
    historicalTest.verifies.contracts.push({ id: newActive.id, since: '0.2.0' });
    const newCaseId = `${historicalTest.id}-CASE-NEW-ADMISSION`;
    historicalTest.cases.push({
      id: newCaseId,
      title: 'Newly cataloged admission evidence',
      covers: ['C-REVIEW-UNTRACKED-0001-A'],
      expectation: 'governed-result',
    });
    historicalTest.implementations.push({
      id: 'current-admission-evidence',
      kind: 'runtime-test',
      status: 'passing',
      required: true,
      path: 'packages/spec/fixtures/test/lifecycle-readiness.test.ts',
      consumesCases: [newCaseId],
    });
    writeFileSync(historicalTestPath, JSON.stringify(historicalTest));
    const historicalAdmission = check();
    assert.equal(historicalAdmission.status, 1, historicalAdmission.stdout);
    assert.match(historicalAdmission.stderr, /historical/i);
    newActive.activeSince = readFileSync(path.join(fixture, 'VERSION'), 'utf8').trim();
    writeFileSync(newPath, JSON.stringify(newActive));
    const currentAdmission = check();
    assert.equal(currentAdmission.status, 0, currentAdmission.stderr);
    writeFileSync(historicalTestPath, historicalTestSource);
    rmSync(path.join(fixture, 'spec/contracts/C-REVIEW-UNTRACKED-0001.yaml'));
    const linkedSource = path.join(fixture, 'relationship-source.txt');
    writeFileSync(linkedSource, original);
    rmSync(entityPath);
    symlinkSync(linkedSource, entityPath, 'file');
    const typeChange = run('git', ['diff', '--name-status', 'HEAD', '--', 'spec/contracts']);
    assert.match(typeChange.stdout, /^T\s+spec\/contracts\/C-A11Y-PART-RELATIONSHIP-0001.yaml/m);
    const linked = check();
    assert.equal(linked.status, 1);
    assert.match(linked.stderr, /C-A11Y-PART-RELATIONSHIP-0001: retain the entity/);
    rmSync(entityPath);
    writeFileSync(entityPath, original);
    const contractsDir = path.join(fixture, 'spec/contracts');
    const linkedDirectory = path.join(fixture, 'linked-contracts');
    renameSync(contractsDir, linkedDirectory);
    symlinkSync(linkedDirectory, contractsDir, 'dir');
    const parentLinked = check();
    assert.equal(parentLinked.status, 1);
    assert.match(parentLinked.stderr, /C-A11Y-PART-RELATIONSHIP-0001: retain the entity/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
