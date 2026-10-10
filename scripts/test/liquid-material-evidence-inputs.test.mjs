import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { matchesGlob } from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';

const root = new URL('../../', import.meta.url);
const workflow = parse(
  readFileSync(new URL('.github/workflows/liquid-material-evidence.yml', root), 'utf8')
);
const paths = workflow.on.pull_request.paths;
const covered = (file) => paths.some((pattern) => matchesGlob(file, pattern));
for (const file of [
  'packages/modules/feedback/src/material/shared-policy.ts',
  'packages/modules/feedback/src/material/visual-result.ts',
]) {
  test(`Liquid Glass evidence covers policy input ${file}`, () => {
    assert.ok(readFileSync(new URL(file, root), 'utf8').length > 0);
    assert.ok(covered(file), `Missing material evidence input: ${file}`);
  });
}
test('Liquid Glass evidence validates its bounded trigger contract in CI', () => {
  assert.ok(covered('scripts/test/liquid-material-evidence-inputs.test.mjs'));
  assert.equal(covered('README.md'), false);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.ok(
    Object.values(workflow.jobs).some((job) =>
      job.steps?.some((step) =>
        step.run?.includes('scripts/test/liquid-material-evidence-inputs.test.mjs')
      )
    )
  );
});
