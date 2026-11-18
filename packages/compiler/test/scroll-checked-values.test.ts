// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import type { PrototypeIR } from '../src/ir';
import { SCROLL_REQUEST_TYPE } from '../src/core-value-types';

const choice = `type Choice={kind:'data';value:number}|{kind:'runner';run:()=>number};`;
const source = (body: string) => `import{definePrototype}from'@proto.ui/core';${choice}
export default definePrototype({name:'checked-scroll-value',setup(def){${body}return r=>r.slot();}});`;
function checked(input: string): PrototypeIR {
  const parsed = parsePrototype(input);
  expect(parsed.ok, JSON.stringify(parsed.ok ? {} : parsed.diagnostics)).toBe(true);
  if (!parsed.ok) throw new Error('source rejected');
  const portable = validateIR(JSON.parse(JSON.stringify(parsed.value)));
  expect(portable.ok, JSON.stringify(portable.ok ? {} : portable.diagnostics)).toBe(true);
  if (!portable.ok) throw new Error('portable IR rejected');
  return portable.value;
}
function records(value: unknown): Record<string, any>[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(records);
  return [value as Record<string, any>, ...Object.values(value).flatMap(records)];
}
const reveal = `import{definePrototype,createAnatomyFamily,type ScrollSurfaceRequest}from'@proto.ui/core';
import{asScrollSurface}from'@proto.ui/hooks';
const FAMILY=createAnatomyFamily('checked-reveal',{roles:{root:{cardinality:{min:1,max:1}},item:{cardinality:{min:0,max:'*'}}}});
export default definePrototype({name:'checked-reveal',setup(def){
  def.anatomy.claim(FAMILY,{role:'root'});const scroll=asScrollSurface();
  def.anatomy.subscribeParts(FAMILY,'item',(_run,parts)=>{
    const part=parts[0];if(part){
      const request:ScrollSurfaceRequest={kind:'reveal',axis:'vertical',family:FAMILY,part};
      scroll.request(request);
    }
  });return r=>r.slot();
}});`;
const requestSource = (request: string) => `import{definePrototype}from'@proto.ui/core';
import{asScrollSurface}from'@proto.ui/hooks';export default definePrototype({name:'checked-request',setup(def){
const scroll=asScrollSurface();def.expose.method('request',(flag:boolean)=>scroll.request(${request}));return r=>r.slot();}});`;

describe('checked evidence for Scroll records containing nominal alternatives', () => {
  it('proves the concrete data arm of a mixed annotation without granting callable authority', () => {
    checked(
      source(`const value:Choice={kind:'data',value:7};def.expose.method('read',()=>value.kind);`)
    );
  });

  it('retains verified family and part fields in an annotated reveal request', () => {
    checked(reveal);
  });

  it('checks both concrete branches of a conditional request', () => {
    checked(
      requestSource(
        `flag?{kind:'by',axis:'vertical',delta:2}:{kind:'to',axis:'vertical',position:0.5}`
      )
    );
  });

  it('does not recover a mutable alias discriminant from its initializer', () => {
    expect(
      parsePrototype(
        source(`const raw={kind:'data',value:7};raw.kind='runner';const value:Choice=raw;`)
      )
    ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1006' }] });
  });

  it('does not hide a callable behind the data arm of a mixed annotation', () => {
    expect(
      parsePrototype(source(`const value:Choice={kind:'data',value:7,hidden:()=>1};`))
    ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1006' }] });
  });

  it('rejects a conditional request with one malformed possible branch', () => {
    expect(
      parsePrototype(
        requestSource(
          `flag?{kind:'by',axis:'vertical',delta:2}:{kind:'to',axis:'vertical',position:'bad'}`
        )
      )
    ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1006' }] });
  });

  it('does not erase a callable hidden in a Scroll position request', () => {
    expect(
      parsePrototype(requestSource(`{kind:'by',axis:'vertical',delta:2,hidden:()=>1}`))
    ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1006' }] });
  });

  it('checks a literal type before using its value as annotation evidence', () => {
    const ir = checked(requestSource(`{kind:'by',axis:'vertical',delta:7}`));
    const operation = records(ir).find(
      (node) => node.kind === 'operation' && node.operation === 'scroll.request'
    )!;
    const value = operation.arguments[0];
    operation.arguments[0] = { kind: 'narrow', value, type: SCROLL_REQUEST_TYPE, span: value.span };
    const literal = records(ir).find((node) => node.kind === 'literal' && node.value === 7)!;
    literal.type = 'string';
    expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
  });

  it('does not recover literal facts from a serialized broad reference', () => {
    const ir = checked(source(`const raw={kind:'by',axis:'vertical',delta:7};const value=raw;`));
    const value = ir.setup.body[1];
    if (value.kind !== 'const' || value.value.kind !== 'reference')
      throw new Error('missing broad reference');
    value.value = {
      kind: 'narrow',
      value: value.value,
      type: SCROLL_REQUEST_TYPE,
      span: value.span,
    };
    expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
  });

  it('does not accept an ordinary record with forged nominal Anatomy metadata', () => {
    const ir = checked(
      reveal.replace(
        /const request:ScrollSurfaceRequest=(\{[^;]+\});\s*scroll.request\(request\);/,
        'scroll.request($1);'
      )
    );
    const request = records(ir).find(
      (node) =>
        node.kind === 'record' &&
        Array.isArray(node.entries) &&
        node.entries.some((entry: any) => entry.key === 'family')
    )!;
    const part = request.entries.find((entry: any) => entry.key === 'part');
    part.value = { kind: 'record', entries: [], type: 'anatomy-part', span: part.value.span };
    expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
  });
});
