import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';

const operations = [
  "def.props.watch(['value'],()=>{})",
  'def.props.watchAll(()=>{})',
  "def.props.watchRaw(['value'],()=>{})",
  'def.props.watchRawAll(()=>{})',
];
function source(body: string) {
  return `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'watch-cleanup',setup(def){
def.props.define({value:{type:'number',default:0}});${body}}});`;
}
describe('Props cleanup callable contract', () => {
  for (const operation of operations) {
    it.each([
      'return stop;',
      'const alias=stop;return alias;',
      'const factory=()=>stop;return factory();',
    ])(`retains the checked native cleanup from ${operation}: %s`, (tail) => {
      const parsed = parsePrototype(source(`const stop=${operation};stop();${tail}`));
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
      expect(validateIR(JSON.parse(JSON.stringify(parsed.value))).ok).toBe(true);
    });
    it(`rejects arguments and forged authority on ${operation}`, () => {
      const invalid = parsePrototype(source(`const stop=${operation};stop(1);`));
      expect(invalid).toMatchObject({
        ok: false,
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            code: 'PUI1006',
            message: 'Callable argument count mismatch.',
          }),
        ]),
      });
      const valid = parsePrototype(source(`const stop=${operation};return stop;`));
      if (!valid.ok) throw new Error(JSON.stringify(valid.diagnostics));
      const declaration = valid.value.setup.body.find(
        (statement) => statement.kind === 'const' && statement.name === 'stop'
      );
      if (declaration?.kind !== 'const') throw new Error('Missing cleanup binding');
      declaration.value.type = { kind: 'callable', parameters: [], returnType: 'run' };
      expect(validateIR(valid.value)).toMatchObject({
        ok: false,
        diagnostics: expect.arrayContaining([
          expect.objectContaining({ code: 'PUI2002', message: 'IR expression type mismatch.' }),
        ]),
      });
    });
  }
});
