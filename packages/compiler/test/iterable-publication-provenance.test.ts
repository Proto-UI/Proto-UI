// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { compilePrototype } from '../src/compile';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import { callableEffectIssue } from '../src/callable-effects';
import type { ExpressionIR, PrototypeIR } from '../src/ir';

const normalize = `const collect=(input:unknown):string[]=>{
  if(!Array.isArray(input))return[];
  return [...new Set(input.filter((item):item is string=>typeof item==='string'&&item.length>0))];
};`;
const source = (setup: string, body: string) => `
  import {definePrototype,type DefHandle,type RunHandle} from '@proto.ui/core';
  type Props={values?:readonly string[]|null};
  export default definePrototype({name:'iterable-publication',setup(def:DefHandle<Props>){
    def.props.define({values:{type:'object',empty:'fallback'}});
    def.props.setDefaults({values:[]});
    def.expose.event('changed',{payload:'json'});
    ${setup}
    def.event.on('press.commit',run=>{${body}});
    return r=>r.slot();
  }});`;
const hidden = `const original={value:'ok',hidden:undefined};
  const view:Readonly<{value:string}>=original;`;
const publication = (value: string) => `run.expose.emit('changed',{value:${value}});`;

describe('iterable publication retains actual element provenance', () => {
  it.each([
    ['Set spread', '', `const values=new Set(['a','b']);${publication('[...values]')}`],
    ['Array.from Set', '', `const values=new Set(['a','b']);${publication('Array.from(values)')}`],
    [
      'Set mutation through an alias',
      '',
      `const values=new Set<string>();const alias=values;alias.add('a');${publication('[...values]')}`,
    ],
    ['empty Set', '', publication('[...new Set<string>()]')],
    ['Set size', '', `const values=new Set(['a']);${publication('values.size')}`],
    ['Set helper result', normalize, publication("collect(['a','b'])")],
    ['optional and null host array', normalize, publication('collect(run.props.get().values)')],
    [
      'host array without Set',
      normalize.replace('[...new Set(', '(').replace('))];', '));'),
      publication('collect(run.props.get().values)'),
    ],
    [
      'deferred collection publication',
      normalize + `let pending:Array<()=>void>=[];`,
      `const value=collect(run.props.get().values);pending.push(()=>run.expose.emit('changed',{value}));while(pending.length)pending.shift()!();`,
    ],
    [
      'mutable lexical collection',
      normalize + `let current:string[]=[];`,
      `current=collect(run.props.get().values);${publication("current.filter(item=>item!=='x')")}`,
    ],
    [
      'copy before a later Set membership write',
      '',
      `${hidden}
      const values=new Set<Readonly<{value:string}>>([{value:'safe'}]);
      const copied=[...values];values.add(view);${publication('copied')}`,
    ],
    [
      'fresh copies of selected fields',
      '',
      `${hidden}
      const values=new Set([view]);${publication('[...values].map(item=>({value:item.value}))')}`,
    ],
  ])('admits %s through source and serialized IR', (_, setup, body) => {
    const result = compilePrototype(source(setup, body), { profile: 'react-dom-source-v1' });
    expect(result.ok, JSON.stringify(result.ok ? null : result.diagnostics)).toBe(true);
    if (!result.ok) return;
    const cold = validateIR(JSON.parse(JSON.stringify(result.value.ir)));
    expect(cold.ok, JSON.stringify(cold.ok ? null : cold.diagnostics)).toBe(true);
  });

  it.each([
    [
      'hidden undefined member',
      `${hidden}const values=new Set([view]);${publication('[...values]')}`,
    ],
    [
      'later Set membership write',
      `${hidden}
      const values=new Set<Readonly<{value:string}>>([{value:'safe'}]);
      const alias=values;alias.add(view);${publication('[...values]')}`,
    ],
    [
      'borrowed nested record after array materialization',
      `
      const original:{value:string,hidden:string|undefined}={value:'ok',hidden:'safe'};
      const view:Readonly<{value:string}>=original;
      const values=new Set([view]);const copied=[...values];
      original.hidden=undefined;${publication('copied')}`,
    ],
  ])('rejects retained %s', (_, body) => {
    const parsed = parsePrototype(source('', body));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.diagnostics[0].message).toContain('Outward JSON payload retains');
  });

  it.each([
    ['raw Set', `run.expose.emit('changed',new Set(['a']));`],
    [
      'unproved array view',
      `const original=run.props.getRaw().values;
      if(!Array.isArray(original))return;
      const values:readonly string[]=original;${publication('[...new Set(values)]')}`,
    ],
    ['nested Set', publication("{values:new Set(['a'])}")],
    [
      'hidden callable',
      `const original={value:'ok',hidden:()=>{}};
      const view:Readonly<{value:string}>=original;${publication('[...new Set([view])]')}`,
    ],
    [
      'hidden State',
      `const original={value:'ok',hidden:flag};
      const view:Readonly<{value:string}>=original;${publication('[...new Set([view])]')}`,
    ],
  ])('does not grant a data boundary to %s', (_, body) => {
    const parsed = parsePrototype(source("const flag=def.state.bool('flag',false);", body));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.diagnostics[0].code).toBe('PUI1006');
  });

  it('independently rejects a raw Set substituted into serialized publication', () => {
    const parsed = parsePrototype(
      source('', `const values=new Set(['a']);${publication('[...values]')}`)
    );
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const ir: PrototypeIR = JSON.parse(JSON.stringify(parsed.value));
    let changed = false;
    visit(ir, (value) => {
      if (value.kind !== 'operation' || value.operation !== 'expose.emit') return;
      const payload = value.arguments[1];
      if (payload.kind !== 'record' || payload.entries[0].value.kind !== 'array-spread')
        throw new Error('Set materialization fixture');
      value.arguments[1] = JSON.parse(JSON.stringify(payload.entries[0].value.parts[0].value));
      changed = true;
    });
    expect(changed).toBe(true);
    expect(callableEffectIssue(ir)?.message).toContain('Outward JSON payload retains');
    expect(validateIR(ir).ok).toBe(false);
  });

  it('independently rejects replacing serialized field copies with retained elements', () => {
    const parsed = parsePrototype(
      source(
        '',
        `${hidden}
      const values=new Set([view]);run.expose.emit('changed',[...values].map(item=>({value:item.value})));`
      )
    );
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const ir: PrototypeIR = JSON.parse(JSON.stringify(parsed.value));
    let changed = false;
    visit(ir, (value) => {
      if (value.kind !== 'operation' || value.operation !== 'expose.emit') return;
      const payload = value.arguments[1];
      if (payload.kind !== 'intrinsic' || payload.name !== 'array.map')
        throw new Error('field copy fixture');
      value.arguments[1] = JSON.parse(JSON.stringify(payload.arguments[0]));
      changed = true;
    });
    expect(changed).toBe(true);
    const cold = validateIR(ir);
    expect(cold.ok).toBe(false);
    if (!cold.ok) expect(cold.diagnostics[0].message).toContain('Outward JSON payload retains');
  });
});

function visit(value: unknown, inspect: (value: ExpressionIR) => void): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item) => visit(item, inspect));
    return;
  }
  inspect(value as ExpressionIR);
  Object.values(value).forEach((item) => visit(item, inspect));
}
