// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { compilePrototype } from '../src/compile';
import { lowerRulePlan } from '../src/rule-plan';

describe('draft decoration is not silently compiled as host paint', () => {
  it('rejects source declaration and target addressing until portable lowering is defined', () => {
    const hostControl = compilePrototype(`import {definePrototype,tw} from '@proto.ui/core';
      export default definePrototype({name:'owned-leaf',setup(def){
        def.feedback.style.use(tw('opacity-50'));
        return r=>r.el('span');
      }});`);
    expect(hostControl.ok).toBe(true);
    const result = compilePrototype(`import {definePrototype,tw} from '@proto.ui/core';
      export default definePrototype({name:'owned-leaf',setup(def){
        const target=def.feedback.style.declareDecoration();
        def.feedback.style.to(target).use(tw('opacity-50'));
        return r=>r.decoration(target);
      }});`);
    expect(result.ok).toBe(false);
  });
  it('rejects an addressed serialized op rather than ignoring the target field', () => {
    const span = {
      file: 'target.proto.ts',
      start: 0,
      end: 1,
      line: 1,
      column: 1,
      endLine: 1,
      endColumn: 2,
    };
    const declarations = [
      {
        operation: 'rule.declare',
        id: 1,
        order: 0,
        deps: [],
        when: { type: 'true', span },
        span,
        intent: {
          kind: 'ops',
          ops: [
            {
              kind: 'feedback.style.use',
              id: 'paint',
              target: 'leaf',
              handles: [{ kind: 'tw', tokens: ['opacity-50'] }],
              span,
            },
          ],
        },
      },
    ] as any;
    const { target: _target, ...hostOp } = declarations[0].intent.ops[0];
    expect(lowerRulePlan([{ ...declarations[0], intent: { kind: 'ops', ops: [hostOp] } }]).ok).toBe(
      true
    );
    const result = lowerRulePlan(declarations);
    expect(result).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2024' }] });
  });
});
