import { describe, expect, it } from 'vitest';
import { getUpdateOrderingIssues } from '../src/targets/action-flow';
import type { ActionStatementIR } from '../src/ir/types';

const update: ActionStatementIR = { kind: 'request-update' };
const write: ActionStatementIR = {
  kind: 'state-set',
  stateName: 'count',
  value: { kind: 'literal', value: 1 },
};
const ret: ActionStatementIR = { kind: 'return' };

describe('Native explicit-update admission', () => {
  it('accepts one terminal request on each callback path, including a helper tail', () => {
    expect(getUpdateOrderingIssues([write, update, ret])).toEqual([]);
    expect(getUpdateOrderingIssues([{ kind: 'invoke', body: [write, update, ret] }])).toEqual([]);
    expect(
      getUpdateOrderingIssues([
        {
          kind: 'if',
          condition: { kind: 'literal', value: true },
          then: [update, ret],
          otherwise: [write, update],
        },
      ])
    ).toEqual([]);
  });

  it('retains request-point snapshots and repeated commit scheduling as unmet semantics', () => {
    expect(getUpdateOrderingIssues([update, write])).not.toEqual([]);
    expect(getUpdateOrderingIssues([update, update])).not.toEqual([]);
    expect(getUpdateOrderingIssues([{ kind: 'invoke', body: [update, ret] }, write])).not.toEqual(
      []
    );
    expect(
      getUpdateOrderingIssues([
        { kind: 'if', condition: { kind: 'literal', value: true }, then: [update], otherwise: [] },
        update,
      ])
    ).not.toEqual([]);
  });

  it('keeps a branch return distinct from a helper return', () => {
    const branch: ActionStatementIR = {
      kind: 'if',
      condition: { kind: 'literal', value: true },
      then: [update, ret],
      otherwise: [],
    };
    expect(getUpdateOrderingIssues([branch, write, update])).toEqual([]);
    expect(
      getUpdateOrderingIssues([{ kind: 'invoke', body: [branch] }, write, update])
    ).not.toEqual([]);
  });
});
