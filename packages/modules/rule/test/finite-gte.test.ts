import { expect, it, vi } from 'vitest';
import { tw, type OwnedStateHandle } from '@proto.ui/core';
import { compileRule } from '../src/compile';
import { evaluateRulesToPlan } from '../src/eval';
function make(threshold = 768) {
  return {
    id: 1,
    ...compileRule<Record<string, unknown>>({
      when: (w) => w.meta('viewport.width').gte(threshold),
      intent: (i) => i.feedback.style.use(tw('text-sm')),
    }),
  };
}
it('serializes one finite numeric comparison and its normal dependency without reading host state', () => {
  const rule = make();
  expect(rule.deps).toEqual([{ kind: 'meta', key: 'viewport.width' }]);
  expect(rule.when).toEqual({
    type: 'gte',
    left: { type: 'meta', key: 'viewport.width' },
    right: 768,
  });
  expect(JSON.parse(JSON.stringify(rule.when))).toEqual(rule.when);
});
it.each([
  [767.9, false],
  [768, true],
  [768.1, true],
  [0, false],
  [-1, false],
  [null, false],
  [undefined, false],
  ['768', false],
  [true, false],
  [NaN, false],
  [Infinity, false],
  [-Infinity, false],
  ['unknown', false],
  [{}, false],
])('uses finite numeric lhs %s without coercion', (value, active) => {
  expect(evaluateRulesToPlan([make()], { props: {}, readMeta: () => value }).tokens).toEqual(
    active ? ['text-sm'] : []
  );
});
it.each([NaN, Infinity, -Infinity, '768', null, undefined, {}])(
  'rejects malformed authored rhs %s synchronously',
  (value) => {
    expect(() =>
      compileRule({
        when: (w) => w.meta('viewport.width').gte(value as number),
        intent: (i) => i.feedback.style.use(tw('text-sm')),
      })
    ).toThrow(/finite number/);
  }
);
it('reads prop/state values through existing identities and never consumes a live getter during recording', () => {
  const get = vi.fn(() => 4);
  const state = { id: 'number-state', get } as unknown as OwnedStateHandle<number>;
  const rule = {
    id: 2,
    ...compileRule<{ count: number }>({
      when: (w) => w.all(w.prop('count').gte(-2.5), w.state(state).gte(4)),
      intent: (i) => i.feedback.style.use(tw('opacity-50')),
    }),
  };
  expect(get).not.toHaveBeenCalled();
  expect(rule.deps).toEqual([
    { kind: 'prop', key: 'count' },
    { kind: 'state', id: 'number-state' },
  ]);
  expect(evaluateRulesToPlan([rule], { props: { count: 0 }, readState: () => 4 }).tokens).toEqual([
    'opacity-50',
  ]);
});
it('withdraws the threshold contribution without changing equality semantics', () => {
  const a = {
      id: 0,
      ...compileRule<Record<string, unknown>>({
        when: (w) => w.prop('mode').eq('normal'),
        intent: (i) => i.feedback.style.use(tw('text-base')),
      }),
    },
    b = make();
  for (const width of [500, 800, 500])
    expect(
      evaluateRulesToPlan([a, b], { props: { mode: 'normal' }, readMeta: () => width }).tokens
    ).toEqual([width >= 768 ? 'text-sm' : 'text-base']);
});
it('rejects scalar gte on number.list without changing its existing eq exclusion', () => {
  const state = { id: 'list', __stateKind: 'number.list' } as any;
  expect(() =>
    compileRule({
      when: (w) => w.state(state).gte(2),
      intent: (i) => i.feedback.style.use(tw('text-sm')),
    })
  ).toThrow(/number.list/);
});
it.each([NaN, Infinity, -Infinity, '768', null, undefined, {}])(
  'fails closed for forged nonfinite/nonnumeric IR rhs %s',
  (value) => {
    const rule = make();
    (rule.when as any).right = value;
    expect(evaluateRulesToPlan([rule], { props: {}, readMeta: () => 900 }).tokens).toEqual([]);
  }
);
it('preserves boolean composition and short-circuit reads', () => {
  const read = vi.fn(() => 1000);
  const rule = {
    id: 1,
    ...compileRule<Record<string, unknown>>({
      when: (w) => w.all(w.f(), w.meta('viewport.width').gte(768)),
      intent: (i) => i.feedback.style.use(tw('text-sm')),
    }),
  };
  expect(evaluateRulesToPlan([rule], { props: {}, readMeta: read }).tokens).toEqual([]);
  expect(read).not.toHaveBeenCalled();
});
