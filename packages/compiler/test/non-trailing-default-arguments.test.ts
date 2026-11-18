// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import type { ExpressionIR, PrototypeIR } from '../src/ir';

type Placement = 'local' | 'module';
const core = "import {definePrototype} from '@proto.ui/core';";

function source(placement: Placement, argumentsText: string, trailing = false): string {
  const parameters = trailing ? 'first:number,last:number=7' : 'first:number=7,last:number';
  const declaration =
    placement === 'module'
      ? `function run(${parameters}) { return first + last; }`
      : `const run = (${parameters}) => first + last;`;
  return `${core}
    ${placement === 'module' ? declaration : ''}
    export default definePrototype({name:'default-parameter-positions',setup(def){
      ${placement === 'local' ? declaration : ''}
      const result=run(${argumentsText});
      def.expose.value('result',result);
    }});`;
}

function parsed(input: string): PrototypeIR {
  const result = parsePrototype(input);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}

function portable(input: string): PrototypeIR {
  const result = validateIR(JSON.parse(JSON.stringify(parsed(input))));
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}

function expressions<K extends ExpressionIR['kind']>(
  root: unknown,
  kind: K
): Array<Extract<ExpressionIR, { kind: K }>> {
  const found: Array<Extract<ExpressionIR, { kind: K }>> = [];
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    if ('kind' in value && value.kind === kind)
      found.push(value as Extract<ExpressionIR, { kind: K }>);
    Object.values(value).forEach(visit);
  };
  visit(root);
  return found;
}

describe('default parameters keep their positional call contract', () => {
  it.each(['local', 'module'] as const)(
    'admits the supplied default position and required final argument through %s source and portable IR',
    (placement) => {
      const ir = portable(source(placement, '2,3'));
      expect(expressions(ir, placement === 'module' ? 'helper-call' : 'call')).toHaveLength(1);
    }
  );

  it.each(['local', 'module'] as const)(
    'admits explicit undefined before the required final argument through %s source and portable IR',
    (placement) => {
      const ir = portable(source(placement, 'undefined,3'));
      expect(expressions(ir, placement === 'module' ? 'helper-call' : 'call')).toHaveLength(1);
    }
  );

  it.each(['local', 'module'] as const)(
    'rejects a missing required final argument at %s source intake',
    (placement) => {
      expect(parsePrototype(source(placement, '2'))).toMatchObject({
        ok: false,
        diagnostics: [{ code: 'PUI1006', message: expect.stringMatching(/argument count/i) }],
      });
    }
  );

  it.each(['local', 'module'] as const)(
    'rechecks a missing required final argument in %s portable IR',
    (placement) => {
      const ir = portable(source(placement, '2,3'));
      const calls = expressions(ir, placement === 'module' ? 'helper-call' : 'call');
      expect(calls).toHaveLength(1);
      // Start from independently accepted source and portable IR. Remove only
      // the actual final operand; the callable signature and types are unchanged.
      calls[0].arguments = calls[0].arguments.slice(0, 1);
      expect(validateIR(JSON.parse(JSON.stringify(ir)))).toMatchObject({
        ok: false,
        diagnostics: [{ code: 'PUI2002', message: expect.stringMatching(/argument count/i) }],
      });
    }
  );

  it('rejects assigning a two-position callable to a one-position source view', () => {
    expect(
      parsePrototype(`${core}
        export default definePrototype({name:'short-callable-view',setup(){
          const run=(first:number=7,last:number)=>first+last;
          const shortened:(first:number)=>number=run;
        }});`)
    ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1006' }] });
  });

  it('rejects the same shortened callable view in independently validated portable IR', () => {
    const ir = portable(`${core}
      export default definePrototype({name:'portable-callable-view',setup(){
        const run=(first:number=7,last:number)=>first+last;
        const accepted:(first:number,last:number)=>number=run;
      }});`);
    const narrowed = expressions(ir, 'narrow');
    expect(narrowed).toHaveLength(1);
    const type = narrowed[0].type;
    if (typeof type === 'string' || type.kind !== 'callable')
      throw new Error('Expected the actual declared callable view');
    narrowed[0].type = { ...type, parameters: type.parameters.slice(0, 1) };
    expect(validateIR(JSON.parse(JSON.stringify(ir)))).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI2002' }],
    });
  });

  it('accepts a positional view that explicitly admits undefined for the leading default', () => {
    portable(`${core}
      export default definePrototype({name:'default-accepts-undefined',setup(def){
        const run=(first:number=7,last:number)=>first+last;
        const accepted:(first:number|undefined,last:number)=>number=run;
        def.expose.value('result',accepted(undefined,3));
      }});`);
  });

  it.each(['local', 'module'] as const)(
    'keeps omission of a trailing default valid through %s source and portable IR',
    (placement) => {
      portable(source(placement, '2', true));
    }
  );
});
