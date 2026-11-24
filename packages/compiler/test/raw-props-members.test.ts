// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import { memberValueType } from '../src/value-types';
import type { ExpressionIR, PrototypeIR } from '../src/ir';

const source = (body: string) => `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'raw-members',setup(def){
  def.props.define({choice:{type:'enum',options:['a','b']}});
  def.props.setDefaults({choice:'a'});
  ${body}
}});`;

function parsed(body: string): PrototypeIR {
  const result = parsePrototype(source(body));
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}

function rawMembers(ir: PrototypeIR): Extract<ExpressionIR, { kind: 'member' }>[] {
  const found: Extract<ExpressionIR, { kind: 'member' }>[] = [];
  function visit(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) return value.forEach(visit);
    const node = value as Record<string, unknown>;
    if (node.kind === 'member' && (node.object as ExpressionIR)?.type === 'record')
      found.push(value as (typeof found)[number]);
    for (const [key, child] of Object.entries(node))
      if (key !== 'type' && key !== 'span') visit(child);
  }
  visit(ir);
  return found;
}

describe('opaque raw Props static members', () => {
  it.each([
    `def.props.watchRawAll((run)=>{const choice=run.props.getRaw().choice;});`,
    `def.props.watchRawAll((run)=>{const raw=run.props.getRaw();const choice=raw.undeclared;});`,
    `return (r)=>{const choice=r.read.props.getRaw().choice;return r.el('span',[]);};`,
    `def.props.watchRawAll((run,next,prev)=>{const a=next.choice;const b=prev.undeclared;});`,
  ])('retains unknown through portable round-trip: %s', (body) => {
    const ir = parsed(body);
    expect(rawMembers(ir).length).toBeGreaterThan(0);
    expect(rawMembers(ir).every((member) => member.type === 'unknown')).toBe(true);
    expect(validateIR(JSON.parse(JSON.stringify(ir))).ok).toBe(true);
  });

  it('composes imported generic declaration helpers with raw observation', () => {
    const result = parsePrototype(
      `import {definePrototype} from '@proto.ui/core';
      import {declareChoice} from './choice';
      export default definePrototype({name:'imported-raw',setup(def){
        declareChoice(def);
        def.props.watchRawAll((run)=>{const choice=run.props.getRaw().choice;});
      }});`,
      {
        fileName: 'entry.proto.ts',
        files: {
          'choice.ts': `import type {DefHandle} from '@proto.ui/core';
          const IDS=['a','b'] as const;
          type Props={choice?:'a'|'b'};
          export function declareChoice(def:DefHandle<Props>){
            const checked=def as unknown as DefHandle<Props>;
            checked.props.define({choice:{type:'enum',options:[...IDS]}});
          }`,
        },
      }
    );
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    expect(result.value.props).toMatchObject([
      {
        name: 'choice',
        type: {
          kind: 'union',
          members: [
            { kind: 'literal', value: 'a' },
            { kind: 'literal', value: 'b' },
          ],
        },
      },
    ]);
    expect(rawMembers(result.value)[0].type).toBe('unknown');
    expect(validateIR(JSON.parse(JSON.stringify(result.value))).ok).toBe(true);
  });

  it.each(['string', 'run', { kind: 'literal', value: 'a' }] as const)(
    'rejects forged checked raw member type %j',
    (type) => {
      const ir = parsed(`def.props.watchRawAll((run)=>{const choice=run.props.getRaw().choice;});`);
      rawMembers(ir)[0].type = type;
      expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
    }
  );

  it.each([
    `def.props.watchRawAll((run)=>{run.props.getRaw().choice();});`,
    `def.props.watchRawAll((run)=>{run.props.getRaw().choice.props.get();});`,
    `def.props.watchRawAll((run)=>{run.props.getRaw().choice='b';});`,
    `def.props.watchRawAll((run)=>{const raw=run.props.getRaw();raw.choice='b';});`,
    `def.props.watchRawAll((run)=>{const choice=run.props.get().undeclared;});`,
    `def.expose.method('read',()=>({other:1}).choice);`,
    `def.props.watchRawAll((run)=>{const read=(key:string)=>run.props.getRaw()[key];read('choice');});`,
  ])('preserves rejected authority, writes and missing finite fields: %s', (body) => {
    expect(parsePrototype(source(body))).toMatchObject({ ok: false });
  });

  it('does not admit the body of a raw-member helper that is never called', () => {
    const ir = parsed(
      `def.props.watchRawAll((run)=>{const read=(key:string)=>run.props.getRaw()[key];});`
    );
    expect(validateIR(JSON.parse(JSON.stringify(ir))).ok).toBe(true);
  });

  it('distinguishes opaque markers from finite records and checked fields', () => {
    expect(memberValueType('record', 'absent')).toBe('unknown');
    expect(
      memberValueType({ kind: 'record', fields: [{ name: 'choice', type: 'string' }] }, 'choice')
    ).toBe('string');
    expect(() => memberValueType({ kind: 'record', fields: [] }, 'choice')).toThrow();
    expect(() => memberValueType({ kind: 'object', fields: [] }, 'choice')).toThrow();
  });
});
