// @vitest-environment node
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { compileFile } from '../src/compile';
import type { PrototypeIR } from '../src/ir';

const core = "import {definePrototype} from '@proto.ui/core';";
function parsed(source: string, files: Record<string, string> = {}): PrototypeIR {
  const result = parsePrototype(source, { fileName: 'entry.proto.ts', files });
  expect(result.ok, JSON.stringify(result)).toBe(true);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}
function semantic(value: unknown, bindings = new Map<string, string>()): unknown {
  if (Array.isArray(value)) return value.map((value) => semantic(value, bindings));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !['span', 'source', 'sourceFiles'].includes(key))
      .map(([key, value]) => {
        if (key === 'bindingId' && typeof value === 'string') {
          if (!bindings.has(value)) bindings.set(value, `binding:${bindings.size}`);
          return [key, bindings.get(value)];
        }
        return [key, semantic(value, bindings)];
      })
  );
}
const read = (name: string) =>
  `export default definePrototype({name:'sample',setup(def){def.expose.method('read',(value:${name})=>value.count);}});`;

describe('source normalization and semantic symbol identity', () => {
  it('does not change a local record type when its name resembles a public capability', () => {
    const first = parsed(`${core} type MyOptions={count:number};${read('MyOptions')}`);
    const second = parsed(
      `${core} type FocusRequestOptions={count:number};${read('FocusRequestOptions')}`
    );
    expect(semantic(second)).toEqual(semantic(first));
  });

  it.each([
    ["import type {Options} from './types';", 'Options'],
    ["import type {Options as Renamed} from './types';", 'Renamed'],
    ["import type {Forwarded as Renamed} from './barrel';", 'Renamed'],
    ["import type * as Shapes from './types';", 'Shapes.Options'],
    ["import type {Options as Original} from './types';type Renamed=Original;", 'Renamed'],
  ])('normalizes erased data imports and barrels: %s', (imports, name) => {
    const direct = parsed(`${core} type Options={count:number};${read('Options')}`);
    const imported = parsed(`${core}${imports}${read(name)}`, {
      'types.ts': 'export interface Options {count:number}',
      'barrel.ts': "export type {Options as Forwarded} from './types';",
    });
    expect(semantic(imported)).toEqual(semantic(direct));
    expect(imported.sourceFiles.some((file) => file.file === 'types.ts')).toBe(true);
  });

  it.each([
    ["import type {FocusRequestOptions} from '@proto.ui/core';", 'FocusRequestOptions'],
    ["import type {FocusRequestOptions as Request} from '@proto.ui/core';", 'Request'],
    ["import type {Request} from './barrel';", 'Request'],
    [
      "import type {FocusRequestOptions as Imported} from '@proto.ui/core';type Request=Imported;",
      'Request',
    ],
  ])('keeps the canonical focus type through aliases: %s', (imports, name) => {
    const result = parsed(
      `${core}${imports}export default definePrototype({name:'sample',setup(def){def.expose.method('read',(value:${name})=>value.preventScroll ?? false);}});`,
      {
        'barrel.ts': "export type {FocusRequestOptions as Request} from '@proto.ui/core';",
      }
    );
    expect(result.exposes[0]).toMatchObject({ kind: 'method', returnType: 'boolean' });
  });

  it.each(['focus', 'focusSelf'])(
    'infers callback data from the resolved %s operation signature',
    (operation) => {
      const result = parsed(
        `${core}import {asFocusable as focusAbility} from '@proto.ui/hooks';export default definePrototype({name:'sample',setup(def){const target=focusAbility();const renamed=target;def.expose.method('request',options=>renamed.${operation}(options));}});`
      );
      expect(result.exposes[0]).toMatchObject({
        kind: 'method',
        parameters: [{ name: 'options', optional: true, type: { kind: 'record' } }],
      });
    }
  );

  it('does not infer capability authority from an unrelated method spelling', () => {
    const source = `${core}export default definePrototype({name:'sample',setup(def){const fake={focusSelf:1};def.expose.method('read',options=>fake.focusSelf(options));}});`;
    expect(parsePrototype(source)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1006' }] });
  });

  it.each([
    'function setup(def){def.expose.value("value",3);}',
    'const setup=(def)=>{def.expose.value("value",3);};',
    'const setup=function(def){def.expose.value("value",3);};',
    'const original=(def)=>{def.expose.value("value",3);};const setup=original;',
    'const original=(def)=>{def.expose.value("value",3);};const middle=original;const setup=middle;',
  ])('normalizes static setup declaration form: %s', (setup) => {
    const actual = parsed(`${core}${setup}export default definePrototype({name:'sample',setup});`);
    const baseline = parsed(
      `${core}export default definePrototype({name:'sample',setup(def){def.expose.value('value',3);}});`
    );
    expect(semantic(actual)).toEqual(semantic(baseline));
  });

  it('preserves imported setup lexical ownership through a re-export and alias', () => {
    const result = parsed(
      `${core}import {setup as original} from './barrel';const setup=original;export default definePrototype({name:'sample',setup});`,
      {
        'barrel.ts': "export {setup} from './owner';",
        'owner.ts': 'const value=7;export const setup=def=>{def.expose.value("value",value);};',
      }
    );
    expect(result.moduleBindings).toMatchObject([{ value: { kind: 'literal', value: 7 } }]);
  });

  it('normalizes static module helper aliases', () => {
    const result = parsed(
      `${core}const add=(value:number)=>value+1;const alias=add;export default definePrototype({name:'sample',setup(def){def.expose.method('add',(value:number)=>alias(value));}});`
    );
    expect(result.moduleBindings).toHaveLength(1);
    expect(result.moduleBindings?.[0].value).toMatchObject({ kind: 'function' });
  });

  it('resolves the prototype factory binding through a source barrel', () => {
    const result = parsed(
      "import {make as sourceFactory} from './barrel';const make=sourceFactory;export default make({name:'sample',setup(){}});",
      {
        'barrel.ts': "export {definePrototype as make} from '@proto.ui/core';",
      }
    );
    expect(result.name).toBe('sample');
  });

  it.each([
    `${core}const setup=missing();export default definePrototype({name:'sample',setup});`,
    `${core}const setup=other;const other=def=>{};export default definePrototype({name:'sample',setup});`,
    `${core}const a=b;const b=a;export default definePrototype({name:'sample',setup(){}});`,
    `${core}let count=0;const snapshot=count;export default definePrototype({name:'sample',setup(){}});`,
    `${core}globalThis.executed=true;export default definePrototype({name:'sample',setup(){}});`,
  ])('retains effect, lifetime and initialization rejection: %s', (source) => {
    expect(parsePrototype(source)).toMatchObject({ ok: false });
    expect((globalThis as { executed?: boolean }).executed).toBeUndefined();
  });

  it('keeps an erased type file outside the executable module graph', () => {
    const result = parsed(`${core}import type {Options} from './types';${read('Options')}`, {
      'types.ts': 'globalThis.executed=true;export type Options={count:number};',
    });
    expect(result.exposes[0]).toMatchObject({ kind: 'method' });
    expect((globalThis as { executed?: boolean }).executed).toBeUndefined();
  });

  it('rejects ambiguous and recursive type bindings with located diagnostics', () => {
    for (const files of [
      {
        'barrel.ts': "export type * from './a';export type * from './b';",
        'a.ts': 'export type Options={count:number};',
        'b.ts': 'export type Options={count:string};',
      },
      {
        'barrel.ts': "export type {Options} from './a';",
        'a.ts': "import type {Other} from './b';export type Options={count:Other};",
        'b.ts': "import type {Options} from './a';export type Other=Options;",
      },
    ])
      expect(
        parsePrototype(`${core}import type {Options} from './barrel';${read('Options')}`, { files })
      ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1020' }] });
  });

  it('loads referenced type sources for a real compileFile consumer', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'pui-source-types-'));
    try {
      await mkdir(path.join(root, 'types'));
      await writeFile(
        path.join(root, 'entry.proto.ts'),
        `${core}import type {Forwarded as Options} from './types';${read('Options')}`
      );
      await writeFile(
        path.join(root, 'types/index.ts'),
        "export type {Options as Forwarded} from './value';"
      );
      await writeFile(path.join(root, 'types/value.ts'), 'export type Options={count:number};');
      const result = await compileFile('entry.proto.ts', { root, profile: 'react-dom-source-v1' });
      expect(result.ok, JSON.stringify(result)).toBe(true);
      if (result.ok)
        expect(result.value.ir.sourceFiles.map((file) => file.file)).toEqual([
          'entry.proto.ts',
          'types/index.ts',
          'types/value.ts',
        ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
