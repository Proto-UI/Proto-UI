import { describe, expect, it } from 'vitest';
import { evaluateRulesToPlan } from '../src/eval';
import { compileRule } from '../src/compile';
import { tw } from '@proto.ui/core';

describe('draft runtime Rule decoration addresses', () => {
  it.each([undefined, null, 0, 'leaf'])(
    'rejects a present invalid address %s instead of painting the host',
    (target) => {
      expect(() =>
        evaluateRulesToPlan(
          [
            {
              id: 1,
              deps: [],
              when: { type: 'true' },
              intent: {
                kind: 'ops',
                ops: [{ kind: 'feedback.style.use', target, handles: [tw('bg-red-500')] }],
              },
            },
          ] as any,
          { props: {} }
        )
      ).toThrow('invalid decoration address');
    }
  );
  it('preserves opaque identity and per-target order separately from host tokens', () => {
    const target = {} as any;
    const ir = compileRule({
      when: (w) => w.t(),
      intent: (i) => {
        i.feedback.style.use(tw('p-4'));
        i.feedback.style.to(target).use(tw('bg-red-500'));
        i.feedback.style.to(target).use(tw('bg-blue-500'));
      },
    });
    const plan = evaluateRulesToPlan([{ ...ir, id: 1 }], { props: {} });
    expect(plan.tokens).toEqual(['p-4']);
    expect(plan.decorations?.[0].target).toBe(target);
    expect(plan.decorations?.[0].handles.map((h) => h.tokens)).toEqual([
      ['bg-red-500'],
      ['bg-blue-500'],
    ]);
  });
});
