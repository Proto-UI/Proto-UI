// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import type { ExpressionIR, PrototypeIR } from '../src/ir';

const imports = `import {definePrototype,createAnatomyFamily,type ScrollSurfaceRequest,type ScrollSurfaceRequestOutcome} from '@proto.ui/core';
import {asScrollSurface} from '@proto.ui/hooks';`;
const source = (body: string) => `${imports}
export default definePrototype({name:'scroll-outcome-contract',setup(def){
  const scroll=asScrollSurface();
  ${body}
  return r=>r.el('section',r.slot());
}});`;
function checked(input: string): PrototypeIR {
  const parsed = parsePrototype(input);
  expect(parsed.ok, JSON.stringify(parsed.ok ? {} : parsed.diagnostics)).toBe(true);
  if (!parsed.ok) throw new Error('source rejected');
  const portable = validateIR(JSON.parse(JSON.stringify(parsed.value)));
  expect(portable.ok, JSON.stringify(portable.ok ? {} : portable.diagnostics)).toBe(true);
  if (!portable.ok) throw new Error('portable IR rejected');
  return portable.value;
}
function operations(value: unknown): Extract<ExpressionIR, { kind: 'operation' }>[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(operations);
  const node = value as Record<string, unknown>;
  return [
    ...(node.kind === 'operation' && node.operation === 'scroll.request'
      ? [value as Extract<ExpressionIR, { kind: 'operation' }>]
      : []),
    ...Object.values(node).flatMap(operations),
  ];
}

describe('C-SCROLL-0001 typed request and delivery outcome', () => {
  it.each([
    `{kind:'by',axis:'vertical',delta:20}`,
    `{kind:'to',axis:'horizontal',position:0.5}`,
    `{kind:'page',axis:'vertical',direction:'before'}`,
    `{kind:'control-drag',axis:'horizontal',position:0.25}`,
    `{kind:'to-end',axis:'vertical'}`,
  ])('retains a structured outcome in source and serialized IR: %s', (request) => {
    const ir = checked(source(`def.expose.method('request',()=>scroll.request(${request}));`));
    const call = operations(ir)[0];
    expect(call).toBeDefined();
    expect(call.type).toMatchObject({ kind: 'union' });
    expect(JSON.stringify(call.type)).toContain('dispatched');
    expect(JSON.stringify(call.type)).toContain('queued');
    expect(JSON.stringify(call.type)).toContain('not-mounted');
  });

  it('admits the core request/outcome aliases and discriminant reads', () => {
    checked(
      source(`
      def.expose.method('request',()=>{
        const request:ScrollSurfaceRequest={kind:'to',axis:'vertical',position:0.5};
        const outcome:ScrollSurfaceRequestOutcome=scroll.request(request);
        if(outcome.kind==='rejected') return outcome.reason;
        return outcome.kind;
      });`)
    );
  });

  it('admits a reveal carrying an actual checked Anatomy family and current part', () => {
    checked(`${imports}
      const FAMILY=createAnatomyFamily('scroll-reveal',{roles:{root:{cardinality:{min:1,max:1}},item:{cardinality:{min:0,max:'*'}}}});
      export default definePrototype({name:'typed-reveal',setup(def){
        def.anatomy.claim(FAMILY,{role:'root'});
        const scroll=asScrollSurface();
        def.anatomy.subscribeParts(FAMILY,'item',(_run,parts)=>{
          const part=parts[0];
          if(part) scroll.request({kind:'reveal',axis:'vertical',family:FAMILY,part});
        });
        return r=>r.el('section',r.slot());
      }});`);
  });

  it.each([
    `{kind:'teleport',axis:'vertical',position:0.5}`,
    `{kind:'by',axis:'diagonal',delta:20}`,
    `{kind:'by',axis:'vertical'}`,
    `{kind:'by',axis:'vertical',delta:'20'}`,
    `{kind:'to',axis:'vertical'}`,
    `{kind:'page',axis:'vertical',direction:'up'}`,
    `{kind:'reveal',axis:'horizontal',family:{},part:{}}`,
    `{kind:'reveal',axis:'vertical',family:{},part:{role:'item'}}`,
  ])('rejects a malformed request at source intake: %s', (request) => {
    expect(
      parsePrototype(source(`def.expose.method('request',()=>scroll.request(${request}));`))
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1006' }],
    });
  });

  it('rejects a forged void result in serialized IR', () => {
    const parsed = parsePrototype(
      source(
        `def.expose.method('request',()=>scroll.request({kind:'by',axis:'vertical',delta:20}));`
      )
    );
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const ir = JSON.parse(JSON.stringify(parsed.value));
    operations(ir)[0].type = 'void';
    expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
  });

  it.each([
    ['kind', 'teleport'],
    ['axis', 'diagonal'],
    ['delta', '20'],
  ])('rejects a forged request %s in serialized IR', (field, value) => {
    const parsed = parsePrototype(
      source(
        `def.expose.method('request',()=>scroll.request({kind:'by',axis:'vertical',delta:20}));`
      )
    );
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const ir = JSON.parse(JSON.stringify(parsed.value));
    const request = operations(ir)[0].arguments[0];
    if (
      request.kind !== 'record' ||
      typeof request.type === 'string' ||
      request.type.kind !== 'record'
    )
      throw new Error('missing finite request record');
    const entry = request.entries.find((candidate) => candidate.key === field)!;
    const type = { kind: 'literal', value } as const;
    entry.value = { kind: 'literal', value, type, span: entry.value.span };
    request.type.fields.find((candidate) => candidate.name === field)!.type = type;
    expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
  });
});
