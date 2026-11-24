// @vitest-environment node
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SourceGraph } from '../src/parser-module';
import { parseSourceValueType } from '../src/source-values';
import { compileFile, compilePrototype } from '../src/compile';
import { validateIR } from '../src/ir-validation';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const aliases = [
  {
    module: '@proto.ui/core',
    name: 'ImageViewA11yMode',
    declaration: 'packages/core/src/image-view.ts',
    barrel: 'packages/core/src/index.ts',
    specifier: './image-view',
  },
  {
    module: '@proto.ui/core',
    name: 'ImageViewFit',
    declaration: 'packages/core/src/image-view.ts',
    barrel: 'packages/core/src/index.ts',
    specifier: './image-view',
  },
  {
    module: '@proto.ui/core',
    name: 'ImageViewStatus',
    declaration: 'packages/core/src/image-view.ts',
    barrel: 'packages/core/src/index.ts',
    specifier: './image-view',
  },
  {
    module: '@proto.ui/module-table-structure',
    name: 'TableHeaderKind',
    declaration: 'packages/modules/table-structure/src/types.ts',
    barrel: 'packages/modules/table-structure/src/index.ts',
    specifier: './types',
  },
];

function parse(source: string, files: Record<string, string> = {}) {
  const graph = new SourceGraph(source, { fileName: 'input.ts', files });
  const owner = graph.load('input.ts');
  const declaration = owner.file.statements.find(
    (statement): statement is ts.TypeAliasDeclaration =>
      ts.isTypeAliasDeclaration(statement) && statement.name.text === 'Result'
  );
  if (!declaration) throw new Error('Missing Result test declaration');
  return parseSourceValueType(owner, declaration.type);
}

function sharedType(alias: (typeof aliases)[number]) {
  const source = readFileSync(
    new URL(alias.declaration, new URL('../../../', import.meta.url)),
    'utf8'
  );
  return parse(`import type {${alias.name}} from './shared'; type Result=${alias.name};`, {
    'shared.ts': source,
  });
}

describe.each(aliases)('public finite value export $module:$name', (alias) => {
  it('matches the unchanged shared declaration AST and actual public barrel export', () => {
    const barrel = ts.createSourceFile(
      'index.ts',
      readFileSync(new URL(alias.barrel, new URL('../../../', import.meta.url)), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );
    expect(
      barrel.statements.some(
        (statement) =>
          ts.isExportDeclaration(statement) &&
          !statement.exportClause &&
          statement.moduleSpecifier &&
          ts.isStringLiteral(statement.moduleSpecifier) &&
          statement.moduleSpecifier.text === alias.specifier
      )
    ).toBe(true);
    expect(
      parse(`import type {${alias.name}} from '${alias.module}'; type Result=${alias.name};`)
    ).toEqual(sharedType(alias));
  });

  it('keeps identity through renamed imports, transparent aliases and local re-exports', () => {
    expect(
      parse(`import type {Renamed as Local} from './barrel'; type Result=Local;`, {
        'barrel.ts': `export type {Wrapped as Renamed} from './inner';`,
        'inner.ts': `import type {${alias.name} as Public} from '${alias.module}'; export type Wrapped=Public;`,
      })
    ).toEqual(sharedType(alias));
  });

  it('resolves a namespace import by its public export identity', () => {
    expect(
      parse(`import type * as Public from '${alias.module}'; type Result=Public.${alias.name};`)
    ).toEqual(sharedType(alias));
  });

  it('does not replace a local homonym with the public finite alternatives', () => {
    expect(parse(`type ${alias.name}='authored'; type Result=${alias.name};`)).toEqual({
      kind: 'literal',
      value: 'authored',
    });
  });

  it.each(['@foreign/types', '@proto.ui/types'])(
    'does not grant the same spelling to the unrelated package %s',
    (module) => {
      expect(() =>
        parse(`import type {${alias.name}} from '${module}'; type Result=${alias.name};`)
      ).toThrow(`Type ${module}:${alias.name} has no semantic declaration.`);
    }
  );

  it('rejects type arguments for the nongeneric public export', () => {
    expect(() =>
      parse(
        `import type {${alias.name}} from '${alias.module}'; type Result=${alias.name}<string>;`
      )
    ).toThrow('does not accept type arguments.');
  });
});

describe('public finite type admission boundaries', () => {
  it('does not confuse Core and Module export surfaces', () => {
    expect(() =>
      parse(`import type {TableHeaderKind} from '@proto.ui/core'; type Result=TableHeaderKind;`)
    ).toThrow('has no semantic declaration.');
    expect(() =>
      parse(
        `import type {ImageViewFit} from '@proto.ui/module-table-structure'; type Result=ImageViewFit;`
      )
    ).toThrow('has no semantic declaration.');
  });

  it('does not resolve inherited object keys or unknown public exports', () => {
    for (const name of ['constructor', 'toString', 'NotAPublicType']) {
      expect(() =>
        parse(`import type {${name}} from '@proto.ui/module-table-structure'; type Result=${name};`)
      ).toThrow('has no semantic declaration.');
    }
  });

  it('retains ambiguous re-export rejection between a public export and local homonym', () => {
    expect(() =>
      parse(`import type {Choice} from './barrel'; type Result=Choice;`, {
        'barrel.ts': `export * from './public'; export * from './local';`,
        'public.ts': `export type {TableHeaderKind as Choice} from '@proto.ui/module-table-structure';`,
        'local.ts': `export type Choice='column'|'row';`,
      })
    ).toThrow('Ambiguous type export Choice.');
  });

  it('keeps the finite union in cold IR and rejects an out-of-set authored value', () => {
    const source = (value: string) => `import {definePrototype} from '@proto.ui/core';
      import type {TableHeaderKind as Kind} from '@proto.ui/module-table-structure';
      export default definePrototype({name:'ordinary-alias-value',setup(def){
        const kind:Kind='${value}';
        def.lifecycle.onCreated((run)=>{run.update();});
        return r=>r.el('span',kind);
      }});`;
    const accepted = compilePrototype(source('column'), { profile: 'gpui-source-v1' });
    expect(accepted.ok, JSON.stringify(accepted)).toBe(true);
    if (!accepted.ok) throw new Error('Expected admitted finite data');
    const cold = validateIR(JSON.parse(JSON.stringify(accepted.value.ir)));
    expect(cold.ok, JSON.stringify(cold)).toBe(true);
    expect(accepted.value.ir.setup.body[0]).toMatchObject({
      kind: 'const',
      name: 'kind',
      value: {
        type: {
          kind: 'union',
          members: [
            { kind: 'literal', value: 'column' },
            { kind: 'literal', value: 'row' },
          ],
        },
      },
    });
    const rejected = compilePrototype(source('diagonal'), { profile: 'gpui-source-v1' });
    expect(rejected.ok).toBe(false);
    if (rejected.ok) throw new Error('Out-of-set assignment was admitted');
    expect(rejected.diagnostics[0].span.line).toBe(4);
    expect(rejected.diagnostics[0].category).not.toBe('compiler-defect');
  });

  it('compiles the unchanged complete Base Image source and accepts its cold IR', async () => {
    const result = await compileFile('packages/prototypes/base/src/image/root.proto.ts', {
      root,
      profile: 'gpui-source-v1',
    });
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (!result.ok) throw new Error('Original Image source was rejected');
    expect(validateIR(JSON.parse(JSON.stringify(result.value.ir))).ok).toBe(true);
    expect(result.value.ir.sourceFiles.map((file) => file.file)).toContain(
      'packages/prototypes/base/src/image/root.proto.ts'
    );
    expect(result.value.output.code).toContain('ImageView');
    expect(
      result.value.output.dependencies?.some((dependency) =>
        /^@proto\.ui\/(?:runtime|hooks|module-|prototypes-|adapter-)/.test(dependency.name)
      )
    ).not.toBe(true);
  });

  it('preserves the separate original HeaderCell array-prop refusal after resolving its alias', async () => {
    const result = await compileFile('packages/prototypes/base/src/table/header-cell.proto.ts', {
      root,
      profile: 'gpui-source-v1',
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Array props need independent admission');
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: 'PUI1006',
        category: 'unsupported-input',
        message: 'Only declared primitive props are currently admitted.',
        span: expect.objectContaining({
          file: 'packages/prototypes/base/src/table/header-cell.proto.ts',
        }),
      }),
    ]);
  });
});
