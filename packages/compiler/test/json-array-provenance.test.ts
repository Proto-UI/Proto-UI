// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import type { ExpressionIR, PrototypeIR } from '../src/ir';

const source = (setup: string, body: string, payload = 'result') => `
  import {definePrototype} from '@proto.ui/core';
  export default definePrototype({name:'json-array-provenance',setup(def){
    def.expose.event('changed',{payload:'json'});
    ${setup}
    def.event.on('press.commit',run=>{
      ${body}
      const retained=result;
      run.expose.emit('changed',${payload});
    });
  }});`;
const hidden = `const original={value:'ok',hidden:undefined};
  const view:Readonly<{value:string}>=original;
  const safe:Readonly<{value:string}>={value:'safe'};`;
const host = `let values:readonly {value:string}[]=[];
  def.expose.method('replace',(next:readonly {value:string}[])=>{values=next;});`;

function admitted(input: string): PrototypeIR {
  const parsed = parsePrototype(input);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const cold = validateIR(JSON.parse(JSON.stringify(parsed.value)));
  if (!cold.ok) throw new Error(JSON.stringify(cold.diagnostics));
  return parsed.value;
}

/** Supply the retained value independently to cold IR after source admitted
 * only a fresh plain copy. No serialized analysis fact is trusted. */
function refused(setup: string, body: string, array = false): void {
  const parsed = parsePrototype(source(setup, body));
  expect(parsed).toMatchObject({
    ok: false,
    diagnostics: [
      { code: 'PUI1006', message: expect.stringContaining('Outward JSON payload retains') },
    ],
  });
  const ir = admitted(
    source(setup, body, array ? 'result.map(item=>({value:item.value}))' : '{value:result.value}')
  );
  let retained: ExpressionIR | undefined;
  let sink: Extract<ExpressionIR, { kind: 'operation' }> | undefined;
  const walk = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) return value.forEach(walk);
    const node = value as Record<string, unknown>;
    if (node.kind === 'const' && node.name === 'retained') retained = node.value as ExpressionIR;
    if (node.kind === 'operation' && node.operation === 'expose.emit') sink = node as typeof sink;
    Object.values(node).forEach(walk);
  };
  walk(ir);
  expect(retained).toBeDefined();
  expect(sink).toBeDefined();
  sink!.arguments[1] = retained!;
  expect(validateIR(JSON.parse(JSON.stringify(ir)))).toMatchObject({
    ok: false,
    diagnostics: [
      { code: 'PUI2002', message: expect.stringContaining('Outward JSON payload retains') },
    ],
  });
}

describe('outward JSON array traversal keeps actual values', () => {
  it.each([
    [
      'empty explicit seed',
      `const values:number[]=[];`,
      `const result=values.reduce((acc,item)=>({value:'copy'}),view);`,
    ],
    [
      'nonempty unchanged seed',
      `const values=[1];`,
      `const result=values.reduce((acc,item)=>acc,view);`,
    ],
    [
      'actual element',
      `const values=[view];`,
      `const result=values.reduce((acc,item)=>item,safe);`,
    ],
    [
      'implicit first element with no callback',
      `const values=[view];`,
      `const result=values.reduce((acc,item)=>({value:'copy'}));`,
    ],
    [
      'implicit first element across iterations',
      `const values=[view,view];`,
      `const result=values.reduce((acc,item)=>acc);`,
    ],
    [
      'later callback result',
      `const values=[1,2];`,
      `let seen=false;const result=values.reduce((acc,item)=>{if(seen)return view;seen=true;return {value:'copy'};},safe);`,
    ],
    [
      'pop removes the only guaranteed iteration',
      `const values=[1];`,
      `values.pop();const result=values.reduce((acc,item)=>({value:'copy'}),view);`,
    ],
    [
      'shift removes the only guaranteed iteration',
      `const values=[1];`,
      `values.shift();const result=values.reduce((acc,item)=>({value:'copy'}),view);`,
    ],
    [
      'conditional pop',
      `const values=[1];const flag=def.state.bool('flag',false);`,
      `if(flag.get())values.pop();const result=values.reduce((acc,item)=>({value:'copy'}),view);`,
    ],
    [
      'another host callback can empty a captured array',
      `const values=[1];def.expose.method('empty',()=>{values.pop();});`,
      `const result=values.reduce((acc,item)=>({value:'copy'}),view);`,
    ],
    [
      'push retains the actual child',
      `const values:Readonly<{value:string}>[]=[];`,
      `values.push(view);const result=values.reduce((acc,item)=>item,safe);`,
    ],
    [
      'unknown host length can be empty',
      host,
      `const result=values.reduce((acc,item)=>({value:item.value}),view);`,
    ],
  ])('rejects %s at source and cold IR', (_name, setup, body) => refused(hidden + setup, body));

  it.each([
    [
      'one iteration replaces an invalid seed',
      `const values=[1];`,
      `const result=values.reduce((acc,item)=>({value:'copy'}),view);`,
    ],
    [
      'multiple iterations replace an invalid seed',
      `const values=[1,2,3];`,
      `const result=values.reduce((acc,item)=>({value:acc.value}),view);`,
    ],
    [
      'zero iterations do not invoke the callback',
      `const values:number[]=[];`,
      `const result=values.reduce((acc,item)=>view,safe);`,
    ],
    [
      'one implicit seed does not invoke the callback',
      `const values=[safe];`,
      `const result=values.reduce((acc,item)=>view);`,
    ],
    [
      'no implicit seed throws before publication',
      `const values:Readonly<{value:string}>[]=[];`,
      `const result=values.reduce((acc,item)=>view);`,
    ],
    [
      'push proves one iteration',
      `const values:number[]=[];`,
      `values.push(1);const result=values.reduce((acc,item)=>({value:'copy'}),view);`,
    ],
    [
      'pop keeps one guaranteed iteration',
      '',
      `const values=[1,2];values.pop();const result=values.reduce((acc,item)=>({value:'copy'}),view);`,
    ],
    [
      'from preserves nonempty extent',
      `const values=[1];`,
      `const result=Array.from(values).reduce((acc,item)=>({value:'copy'}),view);`,
    ],
    [
      'slice preserves nonempty extent',
      `const values=[1];`,
      `const result=values.slice().reduce((acc,item)=>({value:'copy'}),view);`,
    ],
    [
      'spread preserves nonempty extent',
      `const values=[1];`,
      `const result=[...values].reduce((acc,item)=>({value:'copy'}),view);`,
    ],
    [
      'unknown host length keeps a safe seed',
      host,
      `const result=values.reduce((acc,item)=>({value:item.value}),safe);`,
    ],
    [
      'shrinking after the first call does not restore the seed',
      `const values=[1,2];const reduced=values.reduce((acc,item)=>{values.pop();values.pop();return {value:'copy'};},view);`,
      `const result=reduced;`,
    ],
  ])('preserves %s at source and cold IR', (_name, setup, body) =>
    admitted(source(hidden + setup, body))
  );

  it.each([
    'values',
    'values.filter(item=>true)',
    'values.map(item=>item)',
    'Array.from(values)',
    '[...values]',
  ])('preserves checked host data through %s', (expression) =>
    admitted(source(host, `const result=${expression};`))
  );

  const late = `const original={ready:true,value:'bad',hidden:undefined};
    const view:Readonly<{ready:boolean;value:string}>=original;
    const seed:Readonly<{ready:boolean;value:string}>={ready:false,value:'safe'};`;
  const reducer = '(acc,item)=>{if(acc.ready)return view;return {ready:true,value:"copy"};}';
  it('passes the actual first result to a second invocation', () => {
    refused(late, `const result=[1,2].reduce(${reducer},seed);`);
  });
  it('does not invent a second invocation for a singleton', () => {
    admitted(source(late, `const result=[1].reduce(${reducer},seed);`));
  });
  it('retains a map result after its callback empties the input array', () => {
    refused(
      `${hidden}const values=[1,2];`,
      `const mapped=values.map(item=>{values.pop();values.pop();return view;});
      const result=mapped.reduce((acc,item)=>item,safe);`
    );
  });
  it('keeps a guaranteed first map result separate from the reduce seed', () => {
    admitted(
      source(
        `${hidden}const values=[1,2];`,
        `
      const mapped=values.map(item=>({value:'copy'}));
      const result=mapped.reduce((acc,item)=>item,view);`
      )
    );
  });

  it.each([
    'values.filter(item=>true)',
    'values.map(item=>item)',
    'Array.from(values)',
    '[...values]',
  ])('does not wash a hidden child through %s', (expression) =>
    refused(
      `${hidden}const values:readonly Readonly<{value:string}>[]=[view];`,
      `const result=${expression};`,
      true
    )
  );

  it.each([
    'values',
    'values.filter(item=>true)',
    'values.map(item=>item)',
    'Array.from(values)',
    '[...values]',
  ])("keeps a host array's original non-JSON element through %s", (expression) =>
    refused(
      `let stored:readonly {value:string;hidden:undefined}[]=[];
      def.expose.method('replace',(next:readonly {value:string;hidden:undefined}[])=>{stored=next;});`,
      `const values:readonly {value:string}[]=stored;const result=${expression};`,
      true
    )
  );

  const hostShapes = [
    [
      'record',
      'Readonly<{value:string;hidden:undefined}>',
      'Readonly<{value:string}>',
      'view',
      false,
    ],
    [
      'nested record',
      '{child:{value:string;hidden:undefined}}',
      '{child:{value:string}}',
      'view.child',
      false,
    ],
    [
      'nested array',
      '{child:readonly {value:string;hidden:undefined}[]}',
      '{child:readonly {value:string}[]}',
      'view.child.map(item=>item)',
      true,
    ],
    [
      'union',
      'Readonly<{value:string;hidden:undefined}>|Readonly<{value:string;hidden:string}>',
      'Readonly<{value:string}>',
      'view',
      false,
    ],
    [
      'array union',
      'readonly (Readonly<{value:string;hidden:undefined}>|Readonly<{value:string;hidden:string}>)[]',
      'readonly Readonly<{value:string}>[]',
      'view.map(item=>item)',
      true,
    ],
  ] as const;
  const hostShape = (type: string) => `let stored:(${type})|undefined=undefined;
    def.expose.method('replace',(next:${type})=>{stored=next;});`;
  it.each(hostShapes)(
    'rejects a narrowed host %s independently at source and cold IR',
    (_name, type, narrow, value, array) =>
      refused(
        hostShape(type),
        `if(!stored)return;const view:${narrow}=stored;const result=${value};`,
        array
      )
  );
  it.each(hostShapes)('retains the checked JSON host %s positive', (_name, type, narrow, value) =>
    admitted(
      source(
        hostShape(type.replaceAll('hidden:undefined', 'hidden:string')),
        `if(!stored)return;const view:${narrow}=stored;const result=${value};`
      )
    )
  );
  it.each(['{value:string;get hidden():string}', '{child:{value:string;get hidden():string}}'])(
    'keeps the existing source type boundary for host accessor signatures: %s',
    (type) =>
      expect(parsePrototype(source(hostShape(type), `const result={value:'safe'};`))).toMatchObject(
        {
          ok: false,
          diagnostics: [
            {
              code: 'PUI1020',
              message: 'Ordinary records require statically declared fields or methods.',
            },
          ],
        }
      )
  );

  it('preserves an earlier phase refusal reached through reduce', () => {
    const parsed = parsePrototype(
      source(
        `${hidden}def.props.define({enabled:{type:'boolean',default:false}});`,
        `
      const result=[1].reduce((acc,item)=>{def.props.setDefaults({enabled:true});return view;},safe);`
      )
    );
    expect(parsed).toMatchObject({
      ok: false,
      diagnostics: [
        { code: 'PUI1007', message: 'props.setDefaults is not permitted in callback.' },
      ],
    });
  });
});
