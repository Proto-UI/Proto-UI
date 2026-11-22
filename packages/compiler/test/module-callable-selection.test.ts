// @vitest-environment node
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import { moduleCallableFixture } from './module-callable-selection-fixture';

describe('immutable module callable selection and inert import cycles', () => {
  it('retains the selected real helper, its effect, source closure, and portable proof', () => {
    const { source, options } = moduleCallableFixture();
    const result = parsePrototype(source, options);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    expect(result.value.exposes.map((value) => value.name)).toEqual(['answer', 'read']);
    expect(JSON.stringify(result.value.moduleBindings)).toContain('expose.value');
    expect(validateIR(JSON.parse(JSON.stringify(result.value)))).toMatchObject({ ok: true });
    for (const [file, content] of Object.entries({ [options.fileName]: source, ...options.files }))
      expect(result.value.sourceFiles).toContainEqual({
        file,
        content,
        sha256: createHash('sha256').update(content).digest('hex'),
      });
  });

  it('does not invent an effect or body when the static optional branch is undefined', () => {
    const { source, options } = moduleCallableFixture();
    options.files['selection.ts'] = options.files['selection.ts'].replace(
      '[true].includes(true)',
      '[true].includes(false)'
    );
    const result = parsePrototype(source, options);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    expect(result.value.exposes.map((value) => value.name)).toEqual(['read']);
    expect(JSON.stringify(result.value.moduleBindings)).not.toContain('expose.value');
    expect(validateIR(JSON.parse(JSON.stringify(result.value)))).toMatchObject({ ok: true });
  });

  it('checks setup effects reached later through the selected optional default export', () => {
    const { source, options } = moduleCallableFixture();
    const late = source
      .replace('const result=invokeSelected(def);', 'const result=0;')
      .replace("r.el('output',String(result))", "r.el('output',String(invokeSelected(def)))");
    expect(parsePrototype(late, options)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1007' }],
    });
  });

  it.each([
    [
      'mutable condition',
      (value: string) => value.replace('const enabled:boolean', 'let enabled:boolean'),
    ],
    [
      'later local guard',
      (value: string) =>
        value
          .replace('const enabled:boolean=[true].includes(true);', '')
          .replace(
            'export default selected;',
            'const enabled:boolean=true;export default selected;'
          ),
    ],
    [
      'invalid branch signature',
      (value: string) => value.replace('=>number)|undefined', '=>string)|undefined'),
    ],
    [
      'data branch',
      (value: string) => value.replace('enabled?install:undefined', 'enabled?enabled:undefined'),
    ],
    [
      'effectful guard',
      (value: string) => value.replace('[true].includes(true)', 'globalThis.choose()'),
    ],
    [
      'erased selection type',
      (value: string) =>
        value.replace('enabled?install:undefined', '(enabled?install:undefined) as unknown'),
    ],
  ])('refuses %s', (_name, change) => {
    const { source, options } = moduleCallableFixture();
    options.files['selection.ts'] = change(options.files['selection.ts']);
    expect(parsePrototype(source, options).ok).toBe(false);
  });

  it.each([
    [
      'cross-module lexical TDZ',
      "import {guard} from './early';export const selected=guard?run:undefined;export function run():number{return 1;}",
      "import {selected} from './selection';export const guard=selected?true:false;",
    ],
    [
      'arrow initializer TDZ',
      "import {guard} from './early';export const run=():number=>1;export const selected=guard?run:undefined;",
      "import {run} from './selection';const selected=true?run:undefined;export const guard=true;",
    ],
    [
      'default-export snapshot TDZ',
      "import {guard} from './early';function run():number{return 1;}export default run;export const selected=guard?run:undefined;",
      "import run from './selection';const selected=true?run:undefined;export const guard=true;",
    ],
    [
      'partial graph export',
      "import {guard} from './early';export function run():number{return 1;}export const selected=guard?run:undefined;",
      "import {missing} from './selection';export const guard=true;",
    ],
    [
      'effectful factory cycle',
      "import {guard} from './early';import {definePrototype} from '@proto.ui/core';export const Subject=definePrototype({name:'other',setup(){return()=>null;}});export const selected=guard?run:undefined;function run():number{return 1;}",
      "import {Subject} from './selection';export const guard=true;",
    ],
  ])('preserves %s refusal', (_name, selection, early) => {
    const source = `import {definePrototype} from '@proto.ui/core';import {selected} from './selection';export default definePrototype({name:'cycle-negative',setup(){return()=>null;}});`;
    expect(
      parsePrototype(source, {
        fileName: 'subject.proto.ts',
        files: { 'selection.ts': selection, 'early.ts': early },
      }).ok
    ).toBe(false);
  });

  it('admits a hoisted function read across the same inert dependency cycle', () => {
    const source = `import {definePrototype} from '@proto.ui/core';import {selected} from './selection';export default definePrototype({name:'hoisted-cycle',setup(def){def.expose.value('result',selected?.()??0);return()=>null;}});`;
    const files = {
      'selection.ts':
        "import {selected} from './early';export function run():number{return 19;}export {selected};",
      'early.ts': "import {run} from './selection';export const selected=true?run:undefined;",
    };
    const result = parsePrototype(source, { fileName: 'subject.proto.ts', files });
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    expect(validateIR(JSON.parse(JSON.stringify(result.value)))).toMatchObject({ ok: true });
  });

  it('does not perform a lexical read from the unselected conditional branch', () => {
    const source = `import {definePrototype} from '@proto.ui/core';
const chosen:((value:number)=>number)|undefined=false?later:undefined;
const later=(value:number):number=>value;
export default definePrototype({name:'unselected-tdz',setup(def){def.expose.value('value',chosen?.(9)??0);return()=>null;}});`;
    const result = parsePrototype(source);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    expect(validateIR(JSON.parse(JSON.stringify(result.value)))).toMatchObject({ ok: true });
    expect(parsePrototype(source.replace('false?later', 'true?later'))).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1008' }],
    });
  });

  it.each(['target', 'type', 'initializer'])('refuses forged cold module alias %s', (mutation) => {
    const { source, options } = moduleCallableFixture();
    const result = parsePrototype(source, options);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    const ir = JSON.parse(JSON.stringify(result.value));
    const alias = ir.moduleBindings.find(
      (binding: any) => binding.value.kind === 'narrow' && binding.value.value.kind === 'reference'
    );
    if (mutation === 'target') alias.value.value.name = 'outsideOwner';
    else if (mutation === 'type') alias.value.type = 'def';
    else
      alias.value.value = {
        kind: 'operation',
        operation: 'props.get',
        receiver: { kind: 'reference', name: 'def', type: 'def', span: alias.span },
        arguments: [],
        type: alias.value.type,
        span: alias.span,
      };
    expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
  });
});

describe('literal-only scalar membership', () => {
  const parse = (expression: string) =>
    parsePrototype(
      `import {definePrototype} from '@proto.ui/core';const enabled:boolean=${expression};export default definePrototype({name:'literal-membership',setup(def){def.expose.value('enabled',enabled);return()=>null;}});`
    );
  it.each([
    '[true].includes(true)',
    '[true].includes(false)',
    '[1,2].includes(2)',
    "['2'].includes(2)",
    '[-0].includes(0)',
    '[null].includes(null)',
    '[].includes(false)',
  ])('admits pure literal expression %s', (expression) => {
    const result = parse(expression);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    expect(validateIR(JSON.parse(JSON.stringify(result.value)))).toMatchObject({ ok: true });
  });
  it.each([
    '[true,,false].includes(true)',
    '[...[true]].includes(true)',
    '[globalThis.value].includes(true)',
    '[true].includes(globalThis.value)',
    '[true].includes(true,0)',
    '[true]?.includes(true)',
    '({includes(){return true;}}).includes(true)',
    '[true as unknown as string].includes(true)',
  ])('does not borrow the pure proof for %s', (expression) => {
    expect(parse(expression).ok).toBe(false);
  });
});
