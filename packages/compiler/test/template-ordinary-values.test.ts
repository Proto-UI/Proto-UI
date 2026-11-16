import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import type { ExpressionIR, FunctionIR, StatementIR, ValueType } from '../src/ir';
import { nativeShape, NativeLexicalScope, type NativeShape } from '../src/template-shape';
import { collectVue2NativeChildShapes } from '../src/vue2-native-template';

const span = {
  file: 'ordinary-shapes.proto.ts',
  start: 0,
  end: 1,
  line: 1,
  column: 1,
  endLine: 1,
  endColumn: 2,
};
const text = (value: string): ExpressionIR => ({ kind: 'literal', value, type: 'string', span });
const ref = (name: string, type: ValueType = 'template'): ExpressionIR => ({
  kind: 'reference',
  name,
  type,
  span,
});
const call = (callee: ExpressionIR, args: ExpressionIR[] = []): ExpressionIR => ({
  kind: 'call',
  callee,
  arguments: args,
  optional: false,
  type: 'template',
  span,
});
const returned = (value: ExpressionIR): StatementIR => ({ kind: 'return', value, span });
const fn = (
  parameters: FunctionIR['parameters'],
  body: StatementIR[],
  returnType: ValueType = 'template'
): ExpressionIR => ({
  kind: 'function',
  type: { kind: 'callable', parameters, returnType },
  span,
  function: { context: 'helper', phase: 'render', parameters, body, returnType, span },
});
const leafKinds = (shape: NativeShape): string[] =>
  'items' in shape ? shape.items.flatMap(leafKinds) : [shape.kind];

describe('ordinary IR native child provenance', () => {
  it('keeps nested generic calls and callee declaration captures separate from caller names', () => {
    const scope = NativeLexicalScope.empty()
      .bind('captured', text('declaration'))
      .bind('draw', fn([], [returned(ref('captured', 'string'))]))
      .bind(
        'wrap',
        fn([{ name: 'captured', type: 'string' }], [returned(call(ref('draw', 'function')))])
      );
    expect(leafKinds(nativeShape(call(ref('wrap', 'function'), [text('caller')]), scope)!)).toEqual(
      ['text']
    );
  });

  it('keeps defaults in left-to-right callee scope and preserves explicit null', () => {
    const scope = NativeLexicalScope.empty().bind(
      'draw',
      fn(
        [
          { name: 'first', type: 'template', default: text('default') },
          { name: 'second', type: 'template', default: ref('first') },
        ],
        [returned(ref('second'))]
      )
    );
    expect(leafKinds(nativeShape(call(ref('draw', 'function')), scope)!)).toEqual(['text']);
    expect(
      leafKinds(
        nativeShape(
          call(ref('draw', 'function'), [{ kind: 'undefined', type: 'void', span }]),
          scope
        )!
      )
    ).toEqual(['text']);
    expect(
      leafKinds(
        nativeShape(
          call(ref('draw', 'function'), [{ kind: 'literal', value: null, type: 'null', span }]),
          scope
        )!
      )
    ).toEqual(['null']);
  });

  it('uses a forward lexical binding for closure provenance without widening an unknown template', () => {
    const node: ExpressionIR = {
      kind: 'operation',
      operation: 'render.slot',
      arguments: [],
      type: 'template',
      span,
    };
    const statements: StatementIR[] = [
      { kind: 'const', name: 'draw', value: fn([], [returned(ref('child'))]), span },
      { kind: 'const', name: 'child', value: node, span },
    ];
    expect(
      leafKinds(
        nativeShape(call(ref('draw', 'function')), NativeLexicalScope.empty().block(statements))!
      )
    ).toEqual(['node']);
    expect(
      nativeShape(
        { kind: 'narrow', value: ref('unknown', 'unknown'), type: 'template', span },
        NativeLexicalScope.empty()
      )
    ).toBeNull();
  });

  it('joins conditional callable targets and preserves their distinct child categories', () => {
    const choice: ExpressionIR = {
      kind: 'conditional',
      condition: { kind: 'literal', value: true, type: 'boolean', span },
      then: fn([], [returned(text('text'))]),
      otherwise: fn([], [returned({ kind: 'literal', value: null, type: 'null', span })]),
      type: 'function',
      span,
    };
    expect(leafKinds(nativeShape(call(choice), NativeLexicalScope.empty())!)).toEqual([
      'text',
      'null',
    ]);
  });

  it.each([
    `const make=(value:string)=>r.el('span',value);const alias=make;return r.el('div',alias('text'));`,
    `const wrapper=(fn:()=>string)=>()=>fn();const draw=()=> 'value';return r.el('div',wrapper(wrapper(draw))());`,
    `const draw=(first:string='a',second:string=first)=>second;return r.el('div',draw());`,
    `const recurse=(count:number):string=>{if(count===0)return 'end';return recurse(count-1);};return r.el('div',recurse(2));`,
  ])('collects actual Vue2 child contexts through ordinary calls: %s', (body) => {
    const parsed = parsePrototype(
      `import {definePrototype} from '@proto.ui/core';export default definePrototype({name:'ordinary-shapes',setup(){return r=>{${body}};}});`,
      { fileName: span.file }
    );
    expect(parsed.ok, JSON.stringify(parsed)).toBe(true);
    if (!parsed.ok) return;
    const shapes = collectVue2NativeChildShapes(parsed.value);
    expect(leafKinds(shapes.resultShape)).toEqual(['node']);
    expect(shapes.invoked.size).toBeGreaterThanOrEqual(3);
  });
});
