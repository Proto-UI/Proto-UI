import { describe, expect, it } from 'vitest';
import {
  LIQUID_STATE_CONTROL_CASES,
  assessLiquidStateControls,
} from './liquid-state-controls-evidence';

const completed = () =>
  LIQUID_STATE_CONTROL_CASES.map((name) => ({ name, status: 'pass', errors: [] }));

describe('Liquid state-control complete-run evidence', () => {
  it('accepts exactly 31 distinct completed consumers', () => {
    expect(LIQUID_STATE_CONTROL_CASES).toHaveLength(31);
    expect(new Set(LIQUID_STATE_CONTROL_CASES).size).toBe(31);
    expect(assessLiquidStateControls(completed())).toMatchObject({
      status: 'passed',
      missing: [],
      duplicates: [],
      unexpected: [],
      failures: [],
    });
  });

  it('retains every unexecuted owner as blocked after a filtered or interrupted run', () => {
    const report = assessLiquidStateControls(completed().slice(0, 10));
    expect(report.status).toBe('blocked');
    expect(report.missing).toEqual(LIQUID_STATE_CONTROL_CASES.slice(10));
    expect(report.results.filter((result) => result.status === 'blocked')).toHaveLength(21);
  });

  it('does not let duplicate passes fill a missing control case', () => {
    const report = assessLiquidStateControls([...completed().slice(0, -1), completed()[0]]);
    expect(report.status).toBe('failed');
    expect(report.missing).toEqual([LIQUID_STATE_CONTROL_CASES.at(-1)]);
    expect(report.duplicates).toEqual([LIQUID_STATE_CONTROL_CASES[0]]);
  });

  it.each(['skip', 'todo', 'fail', 'unknown'])(
    'rejects an executed %s terminal state',
    (status) => {
      const results = completed();
      results[0].status = status;
      expect(assessLiquidStateControls(results).status).toBe('failed');
    }
  );

  it('rejects late page or teardown errors after all assertions passed', () => {
    const errors = ['late uncaught page error', 'browser close failed'];
    expect(assessLiquidStateControls(completed(), errors)).toMatchObject({
      status: 'failed',
      failures: errors,
    });
  });

  it('preserves case errors even when a runner marked the case passed', () => {
    const results = completed();
    const report = assessLiquidStateControls([
      { ...results[0], errors: [{ message: 'view disposal failed' }] },
      ...results.slice(1),
    ]);
    expect(report.status).toBe('failed');
  });

  it('cannot count a different family or diagnostic toward the inventory', () => {
    const report = assessLiquidStateControls([
      ...completed(),
      { name: 'Bootstrap-only pass', status: 'pass', errors: [] },
    ]);
    expect(report.status).toBe('failed');
    expect(report.unexpected).toEqual(['Bootstrap-only pass']);
  });
});
