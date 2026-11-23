import { describe, it, expect, vi } from 'vitest';
import {
  prominentTintDemo,
  paintProminentTintSource,
  paintProminentTintConstantSource,
  PROMINENT_TINT_CONSTANT_CODES,
  PROMINENT_TINT_CONTROLS,
  createProminentTintPlan,
  createProminentTintCheckpoint,
  assessProminentTintCompletion,
  prominentTintPreferenceStages,
} from './liquid-prominent-tint-fixture';
import type { DemoNode, DemoRuntimeApi } from '../../../components/PrototypePreviewer/demo-types';
const nodes = (node: DemoNode): DemoNode[] => [
  node,
  ...('children' in node
    ? (node.children ?? []).flatMap((child) => (typeof child === 'string' ? [] : nodes(child)))
    : []),
];
describe('real prominent command fixture ownership', () => {
  it.each(PROMINENT_TINT_CONTROLS)('uses real single Form owner and real action %s', (control) => {
    const patch = vi.fn();
    const api = { setProps: patch } as unknown as DemoRuntimeApi;
    const events: any[] = [];
    const demo = prominentTintDemo('submit', control, 'text', () => {}, events);
    const protos = nodes(demo.root).filter((n) => n.kind === 'proto');
    expect(protos).toHaveLength(2);
    expect(protos[0]).toMatchObject({ prototypeId: 'liquid-glass-form-root', ref: 'owner' });
    expect(protos[1]).toMatchObject({
      prototypeId: control === 'neutral' ? 'liquid-glass-form-reset' : 'liquid-glass-form-submit',
      props: { material: control === 'opaque' ? 'opaque' : 'auto' },
    });
    demo.setup!({ api, host: document.createElement('div'), refs: {} });
    expect(patch.mock.calls[0][0]).toBe('owner');
    expect(JSON.stringify(demo.root)).toContain(control === 'neutral' ? 'Reset' : 'Submit');
  });
  it('keeps icon-only accessible names without inventing selected state', () => {
    const demo = prominentTintDemo('button', 'tinted', 'icon-only', () => {}, []);
    expect(
      nodes(demo.root).find((n) => n.kind === 'box' && n.attrs?.['data-tint-foreground'] === '')
    ).toMatchObject({ attrs: { role: 'img', 'aria-label': 'Continue' } });
    expect(JSON.stringify(demo.root)).not.toContain('active');
    expect(JSON.stringify(demo.root)).not.toContain('width');
  });
  it('paints deterministically with predeclared phase and no random noise or time', () => {
    const calls: unknown[][] = [];
    const ctx = {
      fillRect: (...x: unknown[]) => calls.push(x),
      beginPath() {},
      moveTo() {},
      lineTo() {},
      fill() {},
      fillText: (...x: unknown[]) => calls.push(x),
    } as unknown as CanvasRenderingContext2D;
    paintProminentTintSource(ctx, 320, 180, 'gray-boundary', 'dark', 0);
    expect(calls).toHaveLength(10);
    expect(calls[0]).toEqual([0, 0, 32, 180]);
  });
  it('keeps all 48 original cases and adds exactly eight constant-field sequences', () => {
    const plan = createProminentTintPlan();
    expect(plan.cases).toHaveLength(56);
    expect(plan.cases.filter((entry) => entry.kind === 'journey')).toHaveLength(32);
    expect(plan.cases.filter((entry) => entry.kind === 'preferences')).toHaveLength(16);
    expect(plan.cases.filter((entry) => entry.kind === 'constant-field')).toHaveLength(8);
    const captures = plan.cases.flatMap((entry) => entry.captures);
    expect(captures).toHaveLength(1688);
    expect(new Set(captures).size).toBe(1688);
    expect(
      plan.cases
        .filter((entry) => entry.kind !== 'constant-field')
        .flatMap((entry) => entry.captures)
    ).toHaveLength(1608);
    for (const runtime of plan.runtimes) {
      const shard = createProminentTintPlan(runtime);
      expect(shard.cases).toHaveLength(14);
      expect(shard.cases.flatMap((entry) => entry.captures)).toHaveLength(422);
    }
    expect(() => createProminentTintPlan('invalid')).toThrow(/shard/);
    expect(prominentTintPreferenceStages('button')).toHaveLength(33);
    expect(prominentTintPreferenceStages('submit')).toHaveLength(36);
  });
  it('serializes useful planned/running partial matrices and only finalizes on normal completion', () => {
    const plan = createProminentTintPlan('wc'),
      first = plan.cases[0];
    const planned = createProminentTintCheckpoint(plan, { cases: {}, captures: {} }, 'planned');
    expect(planned.partial).toBe(true);
    expect(planned.expectedCases).toBe(14);
    expect(planned.cases.every((entry) => entry.status === 'not-run')).toBe(true);
    const state = {
      cases: { [first.id]: { status: 'running' } },
      captures: {
        [first.captures[0]]: { status: 'failed', error: 'registered PNG size mismatch' },
        [first.captures[1]]: { status: 'running' },
        [first.captures[2]]: { status: 'captured-before-assertion' },
      },
    };
    const running = JSON.parse(
      JSON.stringify(createProminentTintCheckpoint(plan, state, 'running'))
    );
    expect(running.cases[0].status).toBe('running');
    expect(running.cases[0].captures[0].status).toBe('failed');
    expect(running.cases[0].captures[1].status).toBe('running');
    expect(running.cases[0].captures[3].status).toBe('not-run');
    const final = createProminentTintCheckpoint(plan, state, 'terminal');
    expect(final.partial).toBe(false);
    expect(final.cases[0].status).toBe('interrupted-at-normal-finalization');
    expect(final.cases[0].captures[0].status).toBe('failed');
    expect(final.cases[0].captures[1].status).toBe('interrupted-at-normal-finalization');
    expect(final.cases[0].captures[2].status).toBe('interrupted-at-normal-finalization');
    expect(final.cases[0].captures[3].status).toBe('blocked-at-normal-finalization');
    expect(final.cases[1].status).toBe('blocked-at-normal-finalization');
  });
  it('paints only the separately frozen solid fields, with an exact return to A', () => {
    const fillRect = vi.fn();
    const ctx = { fillStyle: '', fillRect } as unknown as CanvasRenderingContext2D;
    const styles: string[] = [];
    for (const code of PROMINENT_TINT_CONSTANT_CODES) {
      paintProminentTintConstantSource(ctx, 358, 182, code);
      styles.push(String(ctx.fillStyle));
    }
    expect(styles).toEqual([
      'rgb(32, 32, 32)',
      'rgb(96, 96, 96)',
      'rgb(160, 160, 160)',
      'rgb(224, 224, 224)',
      'rgb(32, 32, 32)',
    ]);
    expect(fillRect).toHaveBeenCalledTimes(5);
    expect(fillRect.mock.calls.every((args) => JSON.stringify(args) === '[0,0,358,182]')).toBe(
      true
    );
    for (const code of [NaN, -1, 0, 31, 255, 256])
      expect(() => paintProminentTintConstantSource(ctx, 358, 182, code)).toThrow('Undeclared');
  });
  it('never marks a subset or a cleanup failure complete even when every executed case passed', () => {
    const plan = createProminentTintPlan('wc');
    const cases = Object.fromEntries(
      plan.cases.map((entry) => [entry.id, { status: 'completed' }])
    );
    const captures = Object.fromEntries(
      plan.cases.flatMap((entry) =>
        entry.captures.map((id) => [id, { status: 'passed-observation-checks' }])
      )
    );
    expect(assessProminentTintCompletion(plan, cases, captures).status).toBe('completed');
    expect(
      assessProminentTintCompletion(plan, cases, captures, ['browser.close failed']).status
    ).toBe('incomplete');
    const partial = { ...cases };
    delete partial[plan.cases.at(-1)!.id];
    expect(assessProminentTintCompletion(plan, partial, captures).incompleteCases).toEqual([
      plan.cases.at(-1)!.id,
    ]);
    const missing = { ...captures };
    delete missing[plan.cases[0].captures[0]];
    expect(assessProminentTintCompletion(plan, cases, missing).status).toBe('incomplete');
    expect(
      assessProminentTintCompletion(
        plan,
        { ...cases, unrelated: { status: 'completed' } },
        captures
      ).status
    ).toBe('incomplete');
  });
});
