// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import type { ExpressionIR, PrototypeIR } from '../src/ir';

const source = (body: string, exposed = 'read') => `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'structural-index',setup(def){
  ${body}
  def.expose.method('read',${exposed});
}});`;

function parsed(body: string, exposed?: string): PrototypeIR {
  const result = parsePrototype(source(body, exposed));
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}

function elements(ir: PrototypeIR): Extract<ExpressionIR, { kind: 'element' }>[] {
  const result: Extract<ExpressionIR, { kind: 'element' }>[] = [];
  function visit(value: unknown) {
    if (value === null || typeof value !== 'object') return;
    if (Array.isArray(value)) return value.forEach(visit);
    const record = value as Record<string, unknown>;
    if (record.kind === 'element') result.push(value as (typeof result)[number]);
    for (const [key, entry] of Object.entries(record))
      if (key !== 'type' && key !== 'span') visit(entry);
  }
  visit(ir);
  return result;
}

describe('open structural record indexing', () => {
  const checkedRead = `const read=(box:{n:number},key:string)=>{
    const value=box[key];return typeof value==='number'?value:0;
  };`;
  it('does not infer a numeric result for an unrestricted string key', () => {
    // Width subtyping permits {n: 1, extra: 'text'} with key='extra'.
    const result = parsePrototype(
      source(`const read=(box:{n:number},key:string)=>(box[key]??0)+1;`)
    );
    expect(result).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1006' }] });
  });

  it('retains unknown when reading an unrestricted key without granting numeric operations', () => {
    const ir = parsed(checkedRead);
    expect(elements(ir)).toHaveLength(1);
    expect(elements(ir)[0].type).toBe('unknown');
    expect(validateIR(JSON.parse(JSON.stringify(ir))).ok).toBe(true);
  });

  it('independently rejects portable IR that narrows an open record to its declared fields', () => {
    const ir = parsed(checkedRead);
    elements(ir)[0].type = { kind: 'union', members: ['number', 'void'] };
    expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
  });

  it.each([
    `const read=(box:number[],key:number)=>(box[key]??0)+1;`,
    `const read=(box:{n:number})=>box['n']+1;`,
  ])('retains checked array indices and static keys: %s', (body) => {
    const ir = parsed(body);
    expect(validateIR(JSON.parse(JSON.stringify(ir))).ok).toBe(true);
  });

  it('retains the independently checked unknown internal-store index path', () => {
    const structural = parsed(checkedRead, `()=>0`);
    const indexed = JSON.parse(JSON.stringify(structural), (_key, value: unknown) => {
      if (value === 'unknown') return { kind: 'value-union', members: ['unknown', 'void'] };
      if (value && typeof value === 'object') {
        const type = value as {
          kind?: string;
          fields?: { name: string; type: string }[];
          members?: unknown[];
        };
        if (type.kind === 'record' && type.fields?.length === 1 && type.fields[0].name === 'n')
          return { kind: 'object', fields: [], index: 'unknown' };
        if (
          type.kind === 'union' &&
          type.members?.includes('number') &&
          type.members.includes('void')
        )
          return { kind: 'value-union', members: ['unknown', 'void'] };
      }
      return value;
    });
    const result = validateIR(indexed);
    expect(result.ok, JSON.stringify(result)).toBe(true);
  });
});
