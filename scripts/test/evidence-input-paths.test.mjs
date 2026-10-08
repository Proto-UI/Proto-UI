import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { matchesGlob } from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';

const root = new URL('../../', import.meta.url);
const read = (file) => readFileSync(new URL(file, root), 'utf8');

const docs = 'apps/www/src/content/docs';
const cases = {
  'accordion-family-evidence': [
    'packages/prototypes/bootstrap-2-3-2/src/theme.ts',
    'packages/prototypes/liquid-glass/src/theme.ts',
    'packages/prototypes/brutalist/src/theme.ts',
  ],
  'dialog-available-space-evidence': [
    `${docs}/zh-cn/demo-shadcn-dialog.demo.ts`,
    `${docs}/zh-cn/demo-brutalist-dialog.demo.ts`,
    ...['en', 'zh-cn'].flatMap((locale) => [
      `${docs}/${locale}/ui-libraries/shadcn/dialog.mdx`,
      `${docs}/${locale}/ui-libraries/brutalist/components/dialog.mdx`,
    ]),
  ],
};
for (const [name, inputs] of Object.entries(cases)) {
  const workflow = parse(read(`.github/workflows/${name}.yml`));
  const paths = workflow.on.pull_request.paths;
  const covered = (file, filters = paths) => filters.some((pattern) => matchesGlob(file, pattern));
  for (const file of inputs) {
    test(`${name} schedules fresh evidence when only ${file} changes`, () => {
      // Confirm these are actual current inputs, not invented examples.
      assert.ok(read(file).length > 0);
      assert.ok(covered(file), `Missing evidence input: ${file}`);
      assert.equal(
        covered(
          file,
          paths.filter((pattern) => !matchesGlob(file, pattern))
        ),
        false
      );
    });
  }
  test(`${name} retains bounded triggers and read-only permissions`, () => {
    assert.equal(covered('README.md'), false);
    assert.equal(covered('packages/prototypes/base/src/button/index.ts'), false);
    assert.deepEqual(workflow.permissions, { contents: 'read' });
    assert.ok('workflow_dispatch' in workflow.on);
    assert.ok(covered('scripts/test/evidence-input-paths.test.mjs'));
    assert.ok(
      Object.values(workflow.jobs).some((job) =>
        job.steps?.some((step) => step.run?.includes('scripts/test/evidence-input-paths.test.mjs'))
      )
    );
  });
}
