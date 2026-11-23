// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { conditionRefinements } from '../src/expression-types';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import type { ExpressionIR, ValueType } from '../src/ir';

const span = {
  file: 'caught.proto.ts',
  start: 0,
  end: 1,
  line: 1,
  column: 1,
  endLine: 1,
  endColumn: 2,
};
function proof(type: ValueType, runtimeType: string): ExpressionIR {
  return {
    kind: 'binary',
    operator: '===',
    type: 'boolean',
    span,
    left: {
      kind: 'intrinsic',
      name: 'typeof',
      type: 'string',
      span,
      arguments: [{ kind: 'reference', name: 'caught', type, span }],
    },
    right: { kind: 'literal', value: runtimeType, type: 'string', span },
  };
}

describe('caught runtime values retain ordinary primitive proofs', () => {
  it.each(['number', 'string', 'boolean', 'undefined'])(
    'refines a positive typeof %s without turning a reachable branch into bottom',
    (runtimeType) => {
      expect(conditionRefinements(proof('exception', runtimeType), true)).toEqual([
        ['caught', runtimeType === 'undefined' ? 'void' : runtimeType],
      ]);
      expect(conditionRefinements(proof('exception', runtimeType), false)).toEqual([
        ['caught', 'exception'],
      ]);
    }
  );

  it('does not infer nominal or callable authority from object/function observations', () => {
    for (const runtimeType of ['function', 'object'])
      expect(conditionRefinements(proof('exception', runtimeType), true)).toEqual([
        ['caught', 'exception'],
      ]);
    expect(conditionRefinements(proof('number', 'string'), true)).toEqual([
      ['caught', { kind: 'union', members: [] }],
    ]);
  });

  it('preserves the same proof when parser output is independently validated', () => {
    const source = `import {definePrototype} from '@proto.ui/core';
      export default definePrototype({name:'caught-scalar-proof',setup(def){
        def.expose.method('compare',()=>{try{throw '𐀀';}catch(error){
          const high=error[0];const low=error[1];
          if(typeof high==='string'&&typeof low==='string')return high<low;
          return false;
        }});return r=>r.el('div');}});`;
    const parsed = parsePrototype(source);
    expect(parsed.ok, JSON.stringify(parsed)).toBe(true);
    if (!parsed.ok) return;
    const checked = validateIR(structuredClone(parsed.value));
    expect(checked.ok, JSON.stringify(checked)).toBe(true);
    const relations: ExpressionIR[] = [];
    const visit = (value: unknown) => {
      if (!value || typeof value !== 'object') return;
      if (
        'kind' in value &&
        value.kind === 'binary' &&
        'operator' in value &&
        value.operator === '<'
      )
        relations.push(value as ExpressionIR);
      Object.values(value).forEach(visit);
    };
    visit(parsed.value);
    expect(relations).toHaveLength(1);
    expect(relations[0].type).toBe('boolean');
  });
});
