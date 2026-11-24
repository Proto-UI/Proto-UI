// @vitest-environment node
// Execute the real matrix expressions and pre-checkout shell guard. No browser,
// dependency installation, workflow dispatch or representative case is executed.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

const WORKFLOW = '.github/workflows/finf-representative-features-evidence.yml';
const REPOSITORY = 'Proto-UI/Proto-UI';
const workflow = parse(readFileSync(WORKFLOW, 'utf8'));
const job = workflow.jobs['representative-features'];
const validation = job.steps.find((step: { id?: string }) => step.id === 'popover_dispatch');
const ORIGINAL_GROUPS = [
  'forms',
  'calendar',
  'disclosure-overlays',
  'modal-overlays',
  'runtime-tabs',
  'slider',
  'dropdown',
  'liquid-dropdown',
  'popover-title',
  'popover-navigation',
  'drawer-intrinsic',
  'drawer-command-density',
  'popover-command-density',
  'neo-popover-title',
  'resident-motion-capability',
  'shadcn-toggle',
  'shadcn-switch-consumer',
  'shadcn-drawer-presence',
  'shadcn-card',
  'brutalist-switch-consumer',
];
const FULL_GROUPS = [...ORIGINAL_GROUPS, 'liquid-reservation'];

type Invocation = {
  event?: string;
  workflowRef?: string;
  feature?: string;
  popover?: string;
};
function context(input: Invocation = {}, group = '') {
  return {
    github: {
      event_name: input.event ?? 'workflow_dispatch',
      workflow_ref: input.workflowRef ?? `${REPOSITORY}/${WORKFLOW}@refs/heads/candidate`,
      repository: REPOSITORY,
    },
    // An absent Actions string property evaluates to the empty string.
    inputs: { feature_group: input.feature ?? '', popover_evidence: input.popover ?? '' },
    matrix: { group },
  };
}
function expression(value: string, values: ReturnType<typeof context>) {
  const match = value.trim().match(/^\$\{\{([\s\S]*)\}\}$/);
  if (!match) throw new Error('Expected the actual workflow expression');
  // This workflow uses string comparisons, &&/||, !, startsWith, format and
  // fromJSON. Translate only its comparison primitive (Actions ignores case),
  // then execute its unchanged branch expression; do not reimplement selection.
  const translated = match[1].replace(
    /((?:github|inputs)\.\w+)\s*(!=|==)\s*('[^']*')/g,
    (_text, left: string, operator: string, right: string) =>
      `${operator === '!=' ? '!' : ''}equal(${left}, ${right})`
  );
  if (/\s(?:==|!=)\s/.test(translated)) throw new Error('Unsupported comparison in workflow');
  return vm.runInNewContext(
    `(${translated})`,
    {
      ...values,
      equal: (left: string, right: string) => left.toLowerCase() === right.toLowerCase(),
      startsWith: (text: string, prefix: string) =>
        text.toLowerCase().startsWith(prefix.toLowerCase()),
      format: (pattern: string, ...args: string[]) =>
        pattern.replace(/\{(\d+)\}/g, (_match, index: string) => args[Number(index)]),
      fromJSON: JSON.parse,
    },
    { timeout: 1000 }
  );
}
function groups(input: Invocation) {
  const excluded = expression(job.strategy.matrix.exclude, context(input)) as Array<{
    group: string;
  }>;
  return (job.strategy.matrix.group as string[]).filter(
    (group) => !excluded.some((entry) => entry.group === group)
  );
}
function validate(input: Invocation, group: string) {
  const temporary = mkdtempSync(path.join(os.tmpdir(), 'pui-finf-selection-'));
  const output = path.join(temporary, 'outputs');
  try {
    const env = Object.fromEntries(
      Object.entries(validation.env).map(([name, value]) => [
        name,
        expression(String(value), context(input, group)),
      ])
    );
    const result = spawnSync('bash', ['--noprofile', '--norc', '-c', validation.run], {
      cwd: temporary,
      encoding: 'utf8',
      env: { PATH: process.env.PATH, ...env, GITHUB_OUTPUT: output },
      timeout: 5000,
    });
    let outputs = '';
    try {
      outputs = readFileSync(output, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    return { status: result.status, signal: result.signal, stderr: result.stderr, outputs };
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

describe('Finf workflow selection executes before setup', () => {
  it('adds one explicit choice and preserves all twenty original groups and execution budgets', () => {
    expect(workflow.on.workflow_dispatch.inputs.feature_group.options).toEqual([
      'all',
      'calendar',
      'liquid-reservation',
    ]);
    expect(workflow.on.workflow_dispatch.inputs.feature_group.default).toBe('all');
    expect(workflow.on.workflow_dispatch.inputs.popover_evidence.default).toBe('all');
    expect(job.strategy.matrix.group).toEqual(FULL_GROUPS);
    expect(new Set(job.strategy.matrix.group).size).toBe(21);
    expect(job['timeout-minutes']).toBe(35);
    expect(job.strategy['fail-fast']).toBe(false);
    expect(job.strategy['max-parallel']).toBe(4);
    expect(job.steps[0]).toBe(validation);
    expect(job.steps[1].uses).toBe('actions/checkout@v4');
  });

  for (const feature of ['calendar', 'liquid-reservation'])
    it(`direct ${feature}/all runs only its requested group`, () => {
      const input = { feature, popover: 'all' };
      expect(groups(input)).toEqual([feature]);
      expect(validate(input, feature)).toMatchObject({
        status: 0,
        signal: null,
        outputs: 'mode=all\n',
      });
    });

  it('direct all/all retains the full matrix and validates each group', () => {
    const input = { feature: 'all', popover: 'all' };
    expect(groups(input)).toEqual(FULL_GROUPS);
    for (const group of groups(input)) expect(validate(input, group).status).toBe(0);
  });

  for (const popover of ['normal', 'wrong-width', 'nonsettling'])
    it(`preserves the existing targeted Popover ${popover} mode`, () => {
      const input = { feature: 'all', popover };
      expect(groups(input)).toEqual(['disclosure-overlays']);
      expect(validate(input, 'disclosure-overlays')).toMatchObject({
        status: 0,
        signal: null,
        outputs: `mode=${popover}\n`,
      });
    });

  for (const event of ['pull_request', 'push', 'schedule', 'workflow_call'])
    it(`${event} preserves the complete inventory regardless of unrelated inputs`, () => {
      const input = { event, feature: 'liquid-reservation', popover: 'wrong-width' };
      expect(groups(input)).toEqual(FULL_GROUPS);
      for (const group of groups(input))
        expect(validate(input, group)).toMatchObject({ status: 0, outputs: 'mode=all\n' });
    });

  it('a reusable call from another dispatched workflow cannot inherit its manual selectors', () => {
    const input = {
      event: 'workflow_dispatch',
      workflowRef: `${REPOSITORY}/.github/workflows/ci.yml@refs/heads/candidate`,
      feature: 'liquid-reservation',
      popover: 'nonsettling',
    };
    expect(groups(input)).toEqual(FULL_GROUPS);
    expect(validate(input, 'forms')).toMatchObject({ status: 0, outputs: 'mode=all\n' });
  });

  for (const input of [
    {},
    { popover: 'all' },
    { feature: 'all' },
    { feature: 'unknown', popover: 'all' },
    { feature: 'forms', popover: 'all' },
    { feature: 'liquid-reservations', popover: 'all' },
    { feature: 'all', popover: 'unknown' },
    ...['calendar', 'liquid-reservation'].flatMap((feature) =>
      ['', 'normal', 'wrong-width', 'nonsettling', 'unknown'].map((popover) => ({
        feature,
        popover,
      }))
    ),
  ])
    it(`keeps one rejecting job for invalid/missing selection ${JSON.stringify(input)}`, () => {
      const selected = groups(input);
      expect(selected).toHaveLength(1);
      const result = validate(input, selected[0]);
      expect(result.status).toBe(2);
      expect(result.signal).toBeNull();
      expect(result.outputs).toBe('');
      expect(result.stderr).not.toBe('');
    });

  it('the shell guard rejects an explicit reservation arriving in a different matrix group', () => {
    const result = validate({ feature: 'liquid-reservation', popover: 'all' }, 'calendar');
    expect(result.status).toBe(2);
    expect(result.outputs).toBe('');
  });
});
