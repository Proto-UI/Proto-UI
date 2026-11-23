// @vitest-environment node
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { compilePrototype } from '../src/compile';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';

// These are current-public-source regressions, not the private IR10 source bank.
const owner = (setup: string) => `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'source-demand-owner',setup(def){
${setup}
return r=>r.el('output','ready');
}});`;

describe('source callable declaration demand', () => {
  it.each([
    `function dormant(){ globalThis.document.title='must not run'; }`,
    `const dormant=()=>globalThis.document;`,
    `const dormant=()=>globalThis.document;const alias=dormant;const again=alias;`,
    `function first(){second();globalThis.document;}function second(){first();}`,
    `const fallback=()=>globalThis.document;const dormant=(value:unknown=fallback())=>value;`,
  ])('does not admit a body solely because its inert declaration exists: %s', (declarations) => {
    const source = owner(`${declarations}\ndef.expose.value('answer',42);`);
    const result = parsePrototype(source);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    expect(result.value.sourceFiles).toEqual([
      {
        file: 'input.proto.ts',
        content: source,
        sha256: createHash('sha256').update(source).digest('hex'),
      },
    ]);
    expect(result.value.exposes.map((entry) => entry.name)).toEqual(['answer']);
    expect(validateIR(JSON.parse(JSON.stringify(result.value)))).toMatchObject({ ok: true });
  });

  it.each([
    'dormant();',
    'const alias=dormant;alias();',
    "def.expose.method('run',dormant);",
    "const record={run:dormant};def.expose.value('record',record);",
    "def.expose.method('get',()=>dormant);",
    'def.lifecycle.onMounted(()=>dormant());',
    'const pass=(fn:()=>void)=>fn();pass(dormant);',
  ])('checks the whole body when a call or escape is possible: %s', (use) => {
    const source = owner(`function dormant():void {globalThis.document;} ${use}`);
    expect(parsePrototype(source)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1005', message: expect.stringContaining('globalThis') }],
    });
  });

  it('does not publish effects from an uncalled optional-default installation helper', () => {
    const source = owner(`
      const install=()=>{def.expose.value('answer',42);};
      const call=(fn:(()=>void)|undefined=install)=>{fn?.();};
      const alias=call;
      def.expose.method('read',()=>42);
    `);
    const result = parsePrototype(source);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    expect(result.value.exposes.map((entry) => entry.name)).toEqual(['read']);
    expect(validateIR(JSON.parse(JSON.stringify(result.value)))).toMatchObject({ ok: true });
  });

  it('retains the real default helper body and effect when called through aliases', () => {
    const source = owner(`
      const install=()=>{def.expose.value('answer',42);};
      const call=(fn:(()=>void)|undefined=install)=>{fn?.();};
      const alias=call;alias();
      def.expose.method('read',()=>42);
    `);
    const result = parsePrototype(source);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    expect(result.value.exposes.map((entry) => entry.name)).toEqual(['answer', 'read']);
    expect(validateIR(JSON.parse(JSON.stringify(result.value)))).toMatchObject({ ok: true });
    expect(JSON.stringify(result.value.setup)).toContain('expose.value');
    expect(JSON.stringify(result.value.setup)).toContain('default');
  });

  it('retains the setup-only phase refusal for the same optional default', () => {
    const source = owner(`
      const install=()=>{def.expose.value('answer',42);};
      const call=(fn:(()=>void)|undefined=install)=>{fn?.();};
      const alias=call;def.expose.method('late',()=>alias());
    `);
    expect(parsePrototype(source)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1007' }],
    });
  });

  it.each([
    ['const alias=dormant;const dormant=()=>42;', 'PUI1005'],
    ['const dormant=()=>42;const dormant=()=>43;', 'PUI1005'],
    ['const data=globalThis.document;', 'PUI1005'],
    ['function dormant(value:MissingType):number{globalThis.document;return 42;}', 'PUI1020'],
    ['function dormant(value:number,value:number):number{return 42;}', 'PUI1005'],
    ['function dormant(...values:number[]):number{return 42;}', 'PUI1004'],
    ['const value=10;const f=(value:number=value)=>value;f();', 'PUI1006'],
    ['const later=10;const f=(value:number=later,later=1)=>value;f();', 'PUI1006'],
  ])('preserves initialization, duplicate, and actual initializer checks: %s', (body, code) => {
    expect(parsePrototype(owner(body))).toMatchObject({
      ok: false,
      diagnostics: [{ code }],
    });
  });

  it('still validates an imported module and every reached definition descriptor', () => {
    const source = `import {definePrototype} from '@proto.ui/core';
import {unselected} from './dependency';
export default definePrototype({name:'entry',setup(){function dormant(){globalThis.document;}return r=>r.el('span');}});`;
    const invalid = `import {definePrototype} from '@proto.ui/core';
export const unselected=definePrototype({name:'invalid',setup:123});`;
    expect(
      parsePrototype(source, { fileName: 'entry.ts', files: { 'dependency.ts': invalid } })
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1006', span: { file: 'dependency.ts' } }],
    });
    const effectful = `export const unselected=globalThis.document.title='effect';`;
    expect(
      parsePrototype(source, { fileName: 'entry.ts', files: { 'dependency.ts': effectful } })
    ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1004' }] });
  });

  it.each([
    'react-runtime-v1',
    'react-dom-source-v1',
    'vue-source-v1',
    'vue2-source-v1',
    'web-component-source-v1',
    'gpui-source-v1',
  ])('emits only checked reached behavior for %s without a callable stub', (profile) => {
    const source = owner(`function dormant(){globalThis.document.title='not checked';}
      const alias=dormant;def.expose.value('answer',42);`);
    const compiled = compilePrototype(source, { profile });
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
    expect(compiled.value.ir.sourceFiles[0].content).toBe(source);
    expect(compiled.value.output.code).not.toContain('not checked');
    expect(compiled.value.output.code).not.toMatch(/(?:function|const|let)\s+dormant\b/);
  });
});
