// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';

const entry = (declarations: string, read = 'selected?.()??0') =>
  `import {definePrototype} from '@proto.ui/core';${declarations}
  export default definePrototype({name:'module-initialization-order',setup(def){
    def.expose.method('read',()=>${read});return()=>null;}});`;

const rejectTDZ = (source: string, files: Record<string, string> = {}) => {
  expect(parsePrototype(source, { fileName: 'subject.proto.ts', files })).toMatchObject({
    ok: false,
    diagnostics: [{ code: 'PUI1008', message: expect.stringContaining('before initialization') }],
  });
};
const accept = (source: string, files: Record<string, string> = {}) => {
  const parsed = parsePrototype(source, { fileName: 'subject.proto.ts', files });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  expect(validateIR(JSON.parse(JSON.stringify(parsed.value)))).toMatchObject({ ok: true });
};

describe('every eager module initializer retains lexical binding order', () => {
  it.each(['const first=second;const second=run;', 'const first=second,second=run;'])(
    'does not erase an intermediate TDZ by resolving its final hoisted function: %s',
    (aliases) => {
      rejectTDZ(
        entry(`${aliases}function run():number{return 42;}
      const selected:(()=>number)|undefined=true?first:undefined;`)
      );
    }
  );

  it('checks alias initializers inside an acyclic imported source module', () => {
    rejectTDZ(
      entry(
        "import {first} from './helper';const selected:(()=>number)|undefined=true?first:undefined;"
      ),
      {
        'helper.ts': 'export const first=second;const second=run;function run():number{return 42;}',
      }
    );
  });

  it('preserves cross-module lexical TDZ in an otherwise inert import cycle', () => {
    rejectTDZ(entry("import {selected} from './selection';"), {
      'selection.ts':
        "import {first} from './early';export const second=run;export function run():number{return 42;}export const selected:(()=>number)|undefined=true?first:undefined;",
      'early.ts': "import {second} from './selection';export const first=second;",
    });
  });

  it.each(['later', '{value:later}', '[later]'])(
    'checks ordinary data fields when creating a getter object: %s',
    (snapshot) => {
      rejectTDZ(
        entry(
          `const shared={get value(){return 1;},snapshot:${snapshot}};const later=2;`,
          'shared.value'
        )
      );
    }
  );

  it('allows the same lexical capture inside a deferred getter body', () => {
    accept(entry('const shared={get value(){return later;}};const later=2;', 'shared.value'));
  });

  it.each([
    'const first=run;',
    'const second=run;const first=second;',
    'const second=run,first=second;',
  ])('retains legal initialized and direct hoisted function aliases: %s', (aliases) => {
    accept(
      entry(`${aliases}function run():number{return 42;}
      const selected:(()=>number)|undefined=true?first:undefined;`)
    );
  });

  it('retains linked package factory aliases and named re-exports', () => {
    accept(`import {definePrototype} from '@proto.ui/core';const create=definePrototype;
      export default create({name:'package-alias',setup(){return()=>null;}});`);
    accept(
      `import {define} from './bridge';const create=define;
      export default create({name:'package-forward',setup(){return()=>null;}});`,
      {
        'bridge.ts': "export {definePrototype as define} from '@proto.ui/core';",
      }
    );
  });
});
