// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compilePrototype } from '../src/compile';
import { validateIR } from '../src/ir-validation';

const prototype = (body: string) => `
  import {definePrototype} from '@proto.ui/core';
  export default definePrototype({name:'array-brand-observation',setup(def){
    ${body}
    return r=>r.slot();
  }});`;
const predicate = `const inspect=(input:unknown)=>Array.isArray(input);
  def.expose.method('inspect',
    (input?:number[]|{length:number}|string|number|boolean|null)=>inspect(input));`;

describe('GPUI ordinary Array.isArray lowering', () => {
  it('compiles an opaque helper behind a finite public boundary and revalidates cold IR', () => {
    const result = compilePrototype(prototype(predicate), { profile: 'gpui-source-v1' });
    expect(result.ok, JSON.stringify(result.ok ? null : result.diagnostics)).toBe(true);
    if (!result.ok) return;
    expect(validateIR(JSON.parse(JSON.stringify(result.value.ir))).ok).toBe(true);
    expect(result.value.output.code).toContain('Value::Array(_) | Value::Json(Json::Array(_))');
  });

  it('compiles the independent native array, tuple, non-array and evaluation-order fixture', () => {
    const source = readFileSync(
      new URL('./fixtures/gpui-ordinary-values/scalars.proto.ts', import.meta.url),
      'utf8'
    );
    const result = compilePrototype(source, { profile: 'gpui-source-v1' });
    expect(result.ok, JSON.stringify(result.ok ? null : result.diagnostics)).toBe(true);
    if (!result.ok) return;
    expect(validateIR(JSON.parse(JSON.stringify(result.value.ir))).ok).toBe(true);
  });

  it.each(['qt-source-v1', 'flutter-source-v1'] as const)(
    'preserves the unavailable target profile boundary on %s',
    (profile) => {
      const result = compilePrototype(prototype(predicate), { profile });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.diagnostics[0]).toMatchObject({ code: 'PUI4001' });
    }
  );

  it('keeps native template reflection explicitly unsupported', () => {
    const source = `import {definePrototype} from '@proto.ui/core';
      export default definePrototype({name:'native-template-inspection',setup(def){
        return r=>r.el('div',Array.isArray(r.el('div'))?'array':'node');
      }});`;
    const result = compilePrototype(source, { profile: 'gpui-source-v1' });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(
        result.diagnostics.some((entry) => entry.message.includes('native template aggregates'))
      ).toBe(true);
  });

  it('does not broaden the native getter-object admission', () => {
    const result = compilePrototype(
      prototype(`def.expose.method('inspect',()=>Array.isArray({get length(){return 1;}}));`),
      { profile: 'gpui-source-v1' }
    );
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.diagnostics.some((entry) => entry.message.includes('Record getters'))).toBe(
        true
      );
  });
});
