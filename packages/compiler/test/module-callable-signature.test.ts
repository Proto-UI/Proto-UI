// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';

const source = (declaration: string, enabled = false) =>
  `import {definePrototype} from '@proto.ui/core';${declaration}
  const selected=${enabled}?run:undefined;
  export default definePrototype({name:'selection-signature',setup(def){
    def.expose.value('selected',selected===undefined);return()=>null;}});`;

describe('module callable selection keeps dormant signature obligations', () => {
  it.each([
    ['function run(...values:number[]):number{return 1;}', 'PUI1004'],
    ['function run(value:number,value:number):number{return 1;}', 'PUI1005'],
    ['function* run():number{return 1;}', 'PUI1004'],
    ['function run(value:number=later,later:number=1):number{return value;}', 'PUI1006'],
  ])('rejects an unselected callable with an unsupported signature: %s', (declaration, code) => {
    expect(parsePrototype(source(declaration))).toMatchObject({
      ok: false,
      diagnostics: [{ code }],
    });
  });

  it('checks the actual imported callable declaration through a named re-export', () => {
    expect(
      parsePrototype(source("import {run} from './bridge';"), {
        fileName: 'subject.proto.ts',
        files: {
          'bridge.ts': "export {run} from './helper';",
          'helper.ts': 'export function run(...values:number[]):number{return 1;}',
        },
      })
    ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1004' }] });
  });

  it('keeps unsupported captures inside the unselected body and default inert', () => {
    const declaration =
      'function run(value:number=globalThis.unsupportedDefault()):number{globalThis.unsupportedBody();return value;}';
    const parsed = parsePrototype(source(declaration));
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    expect(validateIR(JSON.parse(JSON.stringify(parsed.value)))).toMatchObject({ ok: true });
    expect(JSON.stringify(parsed.value.moduleBindings)).not.toContain('unsupportedBody');
    expect(parsePrototype(source(declaration, true))).toMatchObject({ ok: false });
  });

  it('retains a valid earlier-parameter default and inferred callable result', () => {
    const parsed = parsePrototype(
      source('function run(value:number=1,next:number=value){return next;}')
    );
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    expect(validateIR(JSON.parse(JSON.stringify(parsed.value)))).toMatchObject({ ok: true });
  });
});
