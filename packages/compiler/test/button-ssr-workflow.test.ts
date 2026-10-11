// @vitest-environment node
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

const workflow = parse(readFileSync('.github/workflows/compiler-button-ssr-evidence.yml', 'utf8'));
const sourceStep = workflow.jobs['source-and-browser-evidence'].steps.find(
  (step: { name: string }) =>
    step.name === 'Run source lowering, generated server, types and mismatch controls'
);
const validator = sourceStep.run.match(/<<'JS'\n([\s\S]*?)\nJS(?:\n|$)/)?.[1];
if (!validator) throw new Error('Compiler SSR source report validator is missing');
const complete = {
  numTotalTests: 91,
  numPassedTests: 91,
  numFailedTests: 0,
  numPendingTests: 0,
  success: true,
};
function validate(report: typeof complete) {
  const directory = mkdtempSync(join(tmpdir(), 'compiler-ssr-workflow-'));
  try {
    const filename = join(directory, 'report.json');
    writeFileSync(filename, JSON.stringify(report));
    const result = spawnSync(process.execPath, ['--input-type=module', '-', filename], {
      input: validator,
      encoding: 'utf8',
    });
    if (result.error) throw result.error;
    if (result.signal) throw new Error(`Validator terminated by ${result.signal}`);
    return result.status;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe('Compiler SSR exact source report gate', () => {
  it('accepts the measured 91-control report with the existing three source inputs', () => {
    expect(sourceStep.run.match(/packages\/compiler\/[^\s\\]+\.test\.ts/g)).toEqual([
      'packages/compiler/test/button-ssr.test.ts',
      'packages/compiler/test/button-ssr-server.test.ts',
      'packages/compiler/src/web-component-ssr-style.test.ts',
    ]);
    expect(validate(complete)).toBe(0);
  });
  it.each([68, 90, 92])('rejects a successful report with %s controls', (count) => {
    expect(validate({ ...complete, numTotalTests: count, numPassedTests: count })).not.toBe(0);
  });
  it.each([
    { numPassedTests: 90 },
    { numFailedTests: 1 },
    { numPendingTests: 1 },
    { success: false },
  ])('rejects incomplete or unsuccessful source evidence: %j', (change) => {
    expect(validate({ ...complete, ...change })).not.toBe(0);
  });
});
