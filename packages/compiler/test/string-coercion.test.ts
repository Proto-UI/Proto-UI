// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { compilePrototype } from '../src/compile';
import { emitFlutterSource } from '../src/flutter-source';
import { emitQtSource } from '../src/qt-source';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import type { ExpressionIR, PrototypeIR, StatementIR } from '../src/ir';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

function program(body: string): string {
  return `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'ordinary-string-conversion',setup(def){
${body}
return r=>r.el('output','conversion');
}});`;
}

function portable(source: string): PrototypeIR {
  const parsed = parsePrototype(source);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const ir = JSON.parse(JSON.stringify(parsed.value)) as PrototypeIR;
  const checked = validateIR(ir);
  if (!checked.ok) throw new Error(JSON.stringify(checked.diagnostics));
  return ir;
}

function conversions(ir: PrototypeIR): Extract<ExpressionIR, { kind: 'intrinsic' }>[] {
  const found: Extract<ExpressionIR, { kind: 'intrinsic' }>[] = [];
  function visit(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    const node = value as Record<string, unknown>;
    if (node.kind === 'intrinsic' && node.name === 'string')
      found.push(value as Extract<ExpressionIR, { kind: 'intrinsic' }>);
    for (const [key, child] of Object.entries(node))
      if (!['type', 'span', 'sources', 'provenance'].includes(key)) visit(child);
  }
  visit(ir.setup);
  return found;
}

const source = program(`
  def.expose.method('convert',(value:unknown)=>String(value));
  def.expose.method('empty',()=>String());
  def.expose.method('discard',(value:unknown)=>{String(value);return 'done';});
  def.expose.method('caught',(value:unknown)=>{
    try{return String(value);}catch(error){throw error;}
  });
  let count=0;
  function operand(value:unknown){count+=1;return value;}
  def.expose.method('once',(value:unknown)=>{
    count=0;const text=String(operand(value));return {text,count};
  });
`);
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
});

describe('native String conversion', () => {
  it('admits the opaque helper boundary without narrowing its argument', () => {
    const ir = portable(source);
    expect(conversions(ir).some((value) => value.arguments[0]?.type === 'unknown')).toBe(true);
    portable(program(`function normalize(value:unknown){throw new Error('Unknown: '+String(value));}
      def.expose.method('normalize',normalize);`));
  });

  it.each([
    'String(1,2);', 'String?.(1);', 'new String(1);', 'String(...[1]);',
    'String(()=>1);', "String(def.state.number('count',0));",
    'String({toString:()=>1});',
  ])('keeps unsupported forms explicit: %s', (body) => {
    expect(parsePrototype(program(body)).ok).toBe(false);
  });

  it('preserves lexical String bindings as ordinary calls', () => {
    const ir = portable(program(`function String(value:number){return value+1;}
      const result:number=String(2);`));
    expect(conversions(ir)).toHaveLength(0);
  });

  it('rechecks arity and result type in serialized IR', () => {
    const ir = portable(program('const value=String(1);'));
    conversions(ir)[0].arguments.push(conversions(ir)[0].arguments[0]);
    expect(validateIR(ir).ok).toBe(false);
    const wrongResult = portable(program('const value=String(1);'));
    conversions(wrongResult)[0].type = 'number';
    expect(validateIR(wrongResult).ok).toBe(false);
  });

  it('rejects a coherent callable operand in serialized IR', () => {
    const ir = portable(program('const callback=()=>1;const value=String(1);'));
    const callback = ir.setup.body.find((statement): statement is Extract<StatementIR, {kind:'const'}> =>
      statement.kind === 'const' && statement.name === 'callback');
    if (!callback) throw new Error('Missing callable control.');
    conversions(ir)[0].arguments[0] = callback.value;
    expect(validateIR(ir).ok).toBe(false);
  });

  it('invalidates saved mutable observations across opaque coercion', () => {
    expect(parsePrototype(program(`
      let value:string|null='before';
      def.expose.method('read',(input:unknown)=>{
        if(value!==null){String(input);return value.length;}
        return 0;
      });
      def.expose.method('clear',()=>{value=null;});
    `)).ok).toBe(false);
  });

  it('reports GPUI and direct Qt/Flutter as unsupported', () => {
    const text = program('const value=String(1);'), ir = portable(text);
    for (const result of [compilePrototype(text, {profile:'gpui-source-v1'}), emitQtSource(ir), emitFlutterSource(ir)]) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.diagnostics.some((diagnostic) =>
        diagnostic.code === 'PUI4003' && diagnostic.message.includes('String'))).toBe(true);
    }
  });

  it.each(nativeOwnerProfiles)('preserves JavaScript coercion and abrupt completion in %s', async (profile) => {
    const native = await mountNativeOwner(source, profile);
    cleanup.push(() => native.dispose());
    const api = native.handle.getExposes();
    expect(api.empty()).toBe('');
    for (const value of [undefined, null, false, true, -0, NaN, Infinity, -Infinity,
      1e21, 1e-7, 'text', [], [1,null,undefined,2], {}, Symbol('id'), 42n]) {
      expect(api.convert(value)).toBe(String(value));
    }
    expect(() => api.convert({toString:1})).toThrow(TypeError);
    const trace: string[] = [];
    const custom = {
      [Symbol.toPrimitive](hint: string) { trace.push(hint); return 'custom'; },
      toString() { throw new Error('must use the conversion hook first'); },
    };
    expect(api.once(custom)).toEqual({text:'custom',count:1});
    expect(trace).toEqual(['string']);
    trace.length=0;
    expect(api.discard(custom)).toBe('done');
    expect(trace).toEqual(['string']);
    const sentinel = {failure:true};
    const throws = {[Symbol.toPrimitive]() { throw sentinel; }};
    let caught: unknown;
    try { api.caught(throws); } catch (error) { caught=error; }
    expect(caught).toBe(sentinel);
    const fallback = {
      toString() { trace.push('toString'); return {}; },
      valueOf() { trace.push('valueOf'); return 7; },
    };
    trace.length=0;
    expect(api.convert(fallback)).toBe('7');
    expect(trace).toEqual(['toString','valueOf']);
  });
});
