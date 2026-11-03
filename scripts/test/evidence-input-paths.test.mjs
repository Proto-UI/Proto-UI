import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { matchesGlob } from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';

const root = new URL('../../', import.meta.url);
const read = (file) => readFileSync(new URL(file, root), 'utf8');

// Dialog has two separate checkouts. Node resolves a probe's packages from its
// own candidate tree, even when the product subject already has dependencies.
test('Dialog candidate-owned package probes install their own locked dependency closure first', () => {
  const workflow = parse(read('.github/workflows/dialog-available-space-evidence.yml'));
  const steps = workflow.jobs['matched-browser'].steps;
  const probeIndex = steps.findIndex((step) => step.run?.includes('node --test candidate/'));
  assert.ok(probeIndex > 0);
  const hasCandidateInstall = (candidateSteps) =>
    candidateSteps
      .slice(0, probeIndex)
      .some(
        (step) =>
          step['working-directory'] === 'candidate' &&
          /corepack pnpm@10\.32\.1 install --frozen-lockfile --ignore-scripts/.test(step.run ?? '')
      );
  assert.equal(
    hasCandidateInstall(steps),
    true,
    'subject dependencies cannot satisfy candidate imports'
  );
  assert.equal(
    hasCandidateInstall(
      steps.map((step) => ({
        ...step,
        'working-directory':
          step['working-directory'] === 'candidate' ? 'subject' : step['working-directory'],
      }))
    ),
    false,
    'installing only the product subject is the observed regression'
  );
});
