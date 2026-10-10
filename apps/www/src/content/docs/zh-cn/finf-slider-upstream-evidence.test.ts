// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import { assertDemoSpec } from '../../../components/PrototypePreviewer/demo-types';
import demo from '../demo-shadcn-slider.demo';
const filename = 'apps/www/src/content/docs/zh-cn/finf-slider-upstream.browser.test.ts';
const workflowFile = '.github/workflows/finf-representative-features-evidence.yml';
const source = readFileSync(filename, 'utf8');
const workflow = parse(readFileSync(workflowFile, 'utf8'));
const { PRODUCTION_BROWSER_OWNERS, PRODUCTION_BROWSER_SUITES } = createRequire(import.meta.url)(
  '../../../../../../scripts/test/runtime-test-plan.mjs'
);
it('owns Slider evidence in the existing workflow with exact-source and sandbox guards', () => {
  expect(PRODUCTION_BROWSER_OWNERS[filename]).toBe(workflowFile);
  expect(PRODUCTION_BROWSER_SUITES).toContain(filename);
  expect(workflow.jobs['representative-features'].strategy.matrix.group).toContain('slider');
  expect(readFileSync(workflowFile, 'utf8')).toContain('TEST_FILE=' + filename);
  for (const guard of [
    'process.env.CANDIDATE_SHA',
    "['diff', '--name-only', 'HEAD']",
    'chromiumSandbox: true',
    'blocked-before-browser',
    'finally',
    "kind: 'inside-corner'",
    "kind: 'outside-corner'",
    "forcedColors: 'active'",
  ])
    expect(source).toContain(guard);
  expect(source).not.toContain('--no-sandbox');
  expect(source).not.toContain('dispatchEvent(');
  expect(source).not.toContain('setElementProps(');
});
it('documents the six public examples using original prototypes without painted test doubles', () => {
  expect(() => assertDemoSpec(demo)).not.toThrow();
  const examples = (demo.root as any).children;
  expect(examples.map((row: any) => row.attrs['data-slider-case'])).toEqual([
    'horizontal',
    'disabled',
    'readonly',
    'rtl',
    'field',
    'vertical',
  ]);
  expect(JSON.stringify(demo)).toContain('shadcn-slider-field-thumb');
  expect(JSON.stringify(demo)).toContain('shadcn-field-root');
  expect(source).toContain('multi-thumb/range constraints');
  expect(source).toContain(
    'Source-derived geometry and state assertions, not a same-state upstream pixel diff.'
  );
});
