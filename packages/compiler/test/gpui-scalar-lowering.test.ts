// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { compilePrototype } from '../src/compile';
import { emitGpuiSource } from '../src/gpui-source';
import { parsePrototype } from '../src/parser';
import { gpuiNumberLiteral } from '../src/gpui-scalar-lowering';

function program(body: string): string {
  return `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'native-data-shapes',setup(def){
${body}
return r=>r.el('div');}});`;
}

function generated(body: string): string {
  const parsed = parsePrototype(program(body));
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const result = emitGpuiSource(parsed.value);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value.code;
}

describe('checked GPUI scalar representation', () => {
  it('keeps numeric cells and required callable arguments/results native until a public boundary', () => {
    const code = generated(`let count=0;
      const update=(amount:number,enabled:boolean)=>{if(enabled)count+=amount;return count;};
      def.expose.method('update',(amount:number)=>update(amount,true));`);
    expect(code).toContain('RefCell<f64>');
    expect(code).toContain('Rc<dyn Fn(f64, bool)->f64>');
    expect(code).toContain('Rc<dyn Fn(f64)->f64>');
    expect(code).not.toContain('scalar_number()');
    expect(code).toContain('ordinary:Some(ordinary)');
    expect(code).toContain('Value::number(ordinary_call(');
  });

  it('keeps optional/default arguments as values and preserves the default callback ABI', () => {
    const code =
      generated(`function apply(value:number,fn:(input:number)=>number=(input)=>input+1){return fn(value);}
      def.expose.method('run',()=>apply(4,undefined));`);
    expect(code).toContain('Rc<dyn Fn(f64, Value)->f64>');
    expect(code).toContain('matches!(&argument, Value::Undefined)');
    expect(code).toContain('.ordinary.clone().expect("checked native data callable")');
  });

  it('lowers checked Math.abs through the native number operation', () => {
    const result = compilePrototype(
      program(`def.expose.method('absolute',(value:number)=>Math.abs(value));`),
      { profile: 'gpui-source-v1' }
    );
    expect(result.ok, JSON.stringify(result.ok ? null : result.diagnostics)).toBe(true);
    if (!result.ok) return;
    expect(result.value.output.code).toContain('.scalar_number().abs()');
  });

  it.each([
    [1e21, '1e+21_f64'],
    [1e30, '1e+30_f64'],
    [-1e30, '-1e+30_f64'],
    [5e-324, '5e-324_f64'],
    [-5e-324, '-5e-324_f64'],
    [-0, '-0.0_f64'],
    [1, '1.0_f64'],
    [NaN, 'f64::NAN'],
    [Infinity, 'f64::INFINITY'],
    [-Infinity, 'f64::NEG_INFINITY'],
  ])('uses valid Rust float syntax without changing %s', (value, expected) => {
    expect(gpuiNumberLiteral(value as number)).toBe(expected);
  });

  it('keeps string relations on lossless UTF-16 values after a closed predicate is inlined', () => {
    const code = generated(`function compare(left:string,right:string){return left<right;}
      def.expose.method('run',()=>compare('𐀀',''));`);
    expect(code).toContain('string_units().cmp(&relational_right.string_units())');
    expect(code).not.toContain('.text().encode_utf16()');
  });

  it('keeps string relations on lossless UTF-16 values in a first-class native boolean callable', () => {
    const code = generated(`function compare(left:string,right:string){return left<right;}
      def.expose.method('compare',compare);
      def.expose.method('run',()=>compare('𐀀',''));`);
    expect(code).toContain('Rc<dyn Fn(Value, Value)->bool>');
    expect(code).toContain('string_units().cmp(&relational_right.string_units())');
    expect(code).not.toContain('.text().encode_utf16()');
  });

  it('admits the complete source fixture through the public GPUI profile', () => {
    const source = readFileSync(
      new URL('./fixtures/gpui-ordinary-values/scalars.proto.ts', import.meta.url),
      'utf8'
    );
    const result = compilePrototype(source, { profile: 'gpui-source-v1' });
    expect(result.ok, JSON.stringify(result)).toBe(true);
  });
});
