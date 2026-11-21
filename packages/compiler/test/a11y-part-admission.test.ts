// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import { compilePrototype } from '../src/compile';
import type { ExpressionIR, PrototypeIR } from '../src/ir';

const prefix = `import {definePrototype,createAnatomyFamily} from '@proto.ui/core';
import {asAccessible} from '@proto.ui/hooks';
const FAMILY=createAnatomyFamily('unrelated-public-name',{roles:{root:{cardinality:{min:1,max:1}}}});`;
function source(body: string) {
  return `${prefix}export default definePrototype({name:'arbitrary-owner',setup(def){
    def.anatomy.claim(FAMILY,{role:'root'});const accessible=asAccessible();
    ${body}
    return r=>r.el('section');
  }});`;
}
function portable(body: string): PrototypeIR {
  const parsed = parsePrototype(source(body), { fileName: 'ordinary-relationship.proto.ts' });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const checked = validateIR(JSON.parse(JSON.stringify(parsed.value)));
  if (!checked.ok) throw new Error(JSON.stringify(checked.diagnostics));
  return checked.value;
}
function operations(ir: PrototypeIR): Extract<ExpressionIR, { kind: 'operation' }>[] {
  const found: Extract<ExpressionIR, { kind: 'operation' }>[] = [];
  function visit(value: unknown) {
    if (!value || typeof value !== 'object') return;
    if ('kind' in value && value.kind === 'operation') found.push(value as Extract<ExpressionIR, { kind: 'operation' }>);
    for (const child of Object.values(value)) visit(child);
  }
  visit(ir);
  return found;
}

describe('draft anatomy-part relationship compiler admission', () => {
  it('preserves direct string and empty reference-list declarations', () => {
    portable(`accessible.relation('labelledBy',{target:'authored-id',mode:'append'});accessible.relation('controls',{target:[]});`);
  });

  it('retains family identity and State keys through source and serialized IR', () => {
    const ir = portable(`const key=def.state.string('key','a/b [arbitrary]');
      accessible.part(FAMILY,{key});
      const target={kind:'part' as const,family:FAMILY,role:'root',key};
      accessible.relation('controls',{target,mode:'append'});`);
    expect(operations(ir).map(operation => operation.operation)).toContain('accessible.part');
    expect(validateIR(JSON.parse(JSON.stringify(ir)))).toMatchObject({ ok: true });
  });

  it.each([
    `accessible.part('family',{key:'value'});`,
    `accessible.part(FAMILY,{});`,
    `accessible.part(FAMILY,{key:42});`,
    `accessible.part(FAMILY,{key:def.state.bool('key',true)});`,
    `accessible.relation('controls',{target:{kind:'part',family:'family',role:'root',key:'value'}});`,
    `accessible.relation('controls',{target:{kind:'part',family:FAMILY,role:4,key:'value'}});`,
    `accessible.relation('controls',{target:{kind:'part',family:FAMILY,role:'root',key:4}});`,
    `accessible.relation('controls',{target:{kind:'part',family:FAMILY,role:'root'}});`,
    `accessible.relation('controls',{target:{kind:'other',family:FAMILY,role:'root',key:'value'}});`,
    `accessible.relation('controls',{target:'host-id',mode:'guess'});`,
    `def.lifecycle.onMounted(()=>accessible.part(FAMILY,{key:'value'}));`,
  ])('rejects invalid source: %s', body => {
    expect(parsePrototype(source(body))).toMatchObject({ ok: false });
  });

  it.each(['family', 'missing-key', 'numeric-key'] as const)('independently rejects coherent serialized %s forgery', mutation => {
    const ir = portable(`accessible.part(FAMILY,{key:'value'});`);
    const part = operations(ir).find(operation => operation.operation === 'accessible.part')!;
    if (mutation === 'family') part.arguments[0] = { kind: 'literal', type: 'string', value: 'family', span: part.span };
    else part.arguments[1] = {
      kind: 'record',
      type: { kind: 'record', fields: mutation === 'missing-key' ? [] : [{ name: 'key', type: 'number' }] },
      entries: mutation === 'missing-key' ? [] : [{ key: 'key', value: { kind: 'literal', type: 'number', value: 42, span: part.span } }],
      span: part.span,
    };
    expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
  });

  it('independently rejects a serialized structured target with a wrong nominal family', () => {
    const ir = portable(`accessible.relation('controls',{target:{kind:'part',family:FAMILY,role:'root',key:'value'}});`);
    const relation = operations(ir).find(operation => operation.operation === 'accessible.relation')!;
    const config = relation.arguments[1];
    if (config.kind !== 'record') throw new Error('Missing relationship config');
    const target = config.entries.find(entry => entry.key === 'target')!.value;
    if (target.kind !== 'record') throw new Error('Missing structured target');
    const family = target.entries.find(entry => entry.key === 'family')!;
    family.value = { kind: 'literal', type: 'string', value: 'family', span: target.span };
    // Rebuild coherent ordinary record types; the operation contract must still reject it.
    target.type = { kind: 'record', fields: [
      { name: 'kind', type: 'string' }, { name: 'family', type: 'string' },
      { name: 'role', type: 'string' }, { name: 'key', type: 'string' },
    ] };
    config.type = { kind: 'record', fields: [{ name: 'target', type: target.type }] };
    expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
  });

  it('independently rejects a setup declaration moved into a mounted callback', () => {
    const ir = portable(`accessible.part(FAMILY,{key:'value'});def.lifecycle.onMounted(()=>{});`);
    const declaration = ir.setup.body.findIndex(statement => statement.kind === 'effect' && statement.expression.kind === 'operation' && statement.expression.operation === 'accessible.part');
    const mounted = operations(ir).find(operation => operation.operation === 'lifecycle.onMounted')!;
    const callback = mounted.arguments[0];
    if (callback.kind !== 'function') throw new Error('Missing mounted callback');
    callback.function.body.push(ir.setup.body.splice(declaration, 1)[0]);
    expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
  });

  it('keeps non-DOM native part lowering explicitly unavailable', () => {
    expect(compilePrototype(source(`accessible.part(FAMILY,{key:'value'});`), { profile: 'gpui-source-v1' })).toMatchObject({
      ok: false,
      diagnostics: [expect.objectContaining({ code: 'PUI4003', message: expect.stringContaining('accessible.part') })],
    });
  });
});
