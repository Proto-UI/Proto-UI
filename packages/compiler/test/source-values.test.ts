// @vitest-environment node
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SourceGraph } from '../src/parser-module';
import { parseSourceValueType } from '../src/source-values';
import { requiredTypeSourceSpecifiers } from '../src/source-type-resolution';

function parse(source: string, files: Record<string, string> = {}) {
  const graph = new SourceGraph(source, { fileName: 'input.ts', files });
  const module = graph.load('input.ts');
  const declaration = module.file.statements.find(
    (node) => ts.isTypeAliasDeclaration(node) && node.name.text === 'Result'
  ) as ts.TypeAliasDeclaration;
  return parseSourceValueType(module, declaration.type);
}

describe('ordinary source value types', () => {
  it('extracts exact literal alternatives from an immutable tuple without widening', () => {
    expect(parse(`const IDs=['vega','nova','vega',7,true,null] as const;
      type Result=(typeof IDs)[number];`)).toEqual(
      parse(`type Result='vega'|'nova'|7|true|null;`)
    );
    expect(parse(`const IDs=[-2] as const; type Result=(typeof IDs)[number];`))
      .toEqual({ kind: 'literal', value: -2 });
    expect(parse(`const IDs=[] as const; type Result=(typeof IDs)[number];`))
      .toEqual({ kind: 'union', members: [] });
  });
  it('preserves tuple declaration identity through erased renamed imports and re-exports', () => {
    expect(parse(`import type {Renamed as Local} from './barrel';
      type Result=(typeof Local)[number];`, {
      'barrel.ts': `export {IDs as Renamed} from './values';`,
      'values.ts': `export const IDs=['first','second'] as const; arbitraryRuntimeCall();`,
    })).toEqual(parse(`type Result='first'|'second';`));
  });
  it('loads a value mentioned only by typeof as an erased source edge and records its source', () => {
    const source = `import type {IDs} from './values'; type Result=(typeof IDs)[number];`;
    const graph = new SourceGraph(source, { fileName: 'input.ts', files: {
      'values.ts': `export const IDs=['kept'] as const; runtimeOnly();`,
    } });
    const owner = graph.load('input.ts');
    expect([...requiredTypeSourceSpecifiers(owner.file)]).toEqual(['./values']);
    const declaration = owner.file.statements.find(ts.isTypeAliasDeclaration)!;
    expect(parseSourceValueType(owner, declaration.type)).toEqual({ kind: 'literal', value: 'kept' });
    expect([...graph.typeSources.keys()]).toContain('values.ts');
    expect(graph.modules.has('values.ts')).toBe(false);
  });
  it('accepts unambiguous star paths to the same tuple declaration', () => {
    expect(parse(`import type {IDs} from './barrel'; type Result=(typeof IDs)[number];`, {
      'barrel.ts': `export * from './left'; export * from './right';`,
      'left.ts': `export {IDs} from './values';`,
      'right.ts': `export {IDs} from './values';`,
      'values.ts': `export const IDs=['one'] as const;`,
    })).toEqual({ kind: 'literal', value: 'one' });
  });
  it('reads the unchanged shared style-scope type through its authored alias', () => {
    const context = readFileSync(
      new URL('../../prototypes/shadcn/src/style-scope/context.ts', import.meta.url), 'utf8'
    );
    expect(parse(`import type {ShadcnStyleId} from './context'; type Result=ShadcnStyleId;`, {
      'context.ts': context,
    })).toEqual(parse(`type Result='vega'|'nova'|'maia'|'lyra'|'mira'|'luma'|'sera'|'rhea'|'new-york-v4';`));
  });
  it.each([
    `let IDs=['a'] as const;`,
    `const IDs=['a'];`,
    `const IDs:readonly string[]=['a'] as const;`,
    `declare const IDs:readonly ['a'];`,
    `const IDs=makeTuple();`,
    `const IDs=Object.freeze(['a']);`,
    `const IDs=['a',runtimeValue] as const;`,
    `const IDs=[...other] as const;`,
    `const IDs=[, 'a'] as const;`,
    `const IDs=[{value:'a'}] as const;`,
    `const IDs=[1e999] as const;`,
    `const IDs=['a'] as unknown as readonly ['a'];`,
  ])('rejects a non-static or widened value query: %s', (declaration) => {
    expect(() => parse(`import type {IDs} from './values'; type Result=(typeof IDs)[number];`, {
      'values.ts': `export ${declaration}`,
    }))
      .toThrow('Numeric value queries require an immutable module literal tuple');
  });
  it.each(['typeof IDs', '(typeof IDs)[0]', '(typeof namespace.IDs)[number]'])(
    'keeps unsupported TypeQuery shapes rejected: %s', (type) => {
      expect(() => parse(`const IDs=['a'] as const; type Result=${type};`)).toThrow();
    }
  );
  it('rejects missing, ambiguous and cyclic imported tuple identities', () => {
    expect(() => parse(`import type {IDs} from './missing'; type Result=(typeof IDs)[number];`))
      .toThrow();
    expect(() => parse(`import type {IDs} from './barrel'; type Result=(typeof IDs)[number];`, {
      'barrel.ts': `export * from './left'; export * from './right';`,
      'left.ts': `export const IDs=['left'] as const;`,
      'right.ts': `export const IDs=['right'] as const;`,
    })).toThrow('Ambiguous type export IDs');
    expect(() => parse(`import type {IDs} from './cycle'; type Result=(typeof IDs)[number];`, {
      'cycle.ts': `export {IDs} from './cycle';`,
    })).toThrow('Cyclic type export IDs');
  });
  it.each([
    `function helper(IDs: readonly string[]) { type Result=(typeof IDs)[number]; }`,
    `function helper() { if (true) { var IDs=['local']; } type Result=(typeof IDs)[number]; }`,
    `namespace inner { const IDs=['local'] as const; type Result=(typeof IDs)[number]; }`,
  ])('does not replace a lexical shadow with the module tuple: %s', (body) => {
    const graph = new SourceGraph(`const IDs=['module'] as const;
      ${body}`, {
      fileName: 'input.ts',
    });
    const owner = { graph, file: ts.createSourceFile(
      'input.ts', graph.sources['input.ts'], ts.ScriptTarget.Latest, true, ts.ScriptKind.TS
    ) };
    let query: ts.TypeNode | undefined;
    const visit = (node: ts.Node): void => {
      if (ts.isTypeAliasDeclaration(node) && node.name.text === 'Result') query = node.type;
      ts.forEachChild(node, visit);
    };
    visit(owner.file);
    expect(() => parseSourceValueType(owner, query!)).toThrow(
      'Numeric value queries require an immutable module literal tuple'
    );
  });
  it.each(['number[]', 'Array<number>', 'ReadonlyArray<number>'])(
    'normalizes the data array spelling %s',
    (type) => {
      expect(parse(`type Result=${type};`)).toEqual({ kind: 'array', element: 'number' });
    }
  );
  it.each(['(()=>void)[]', 'Array<()=>void>', 'ReadonlyArray<()=>void>'])(
    'gives the same located non-data array boundary for %s',
    (type) => {
      expect(() => parse(`type Result=${type};`)).toThrow('Array elements must be data values.');
    }
  );
  it('resolves generic function records and optional callbacks through imported aliases', () => {
    const type = parse(
      `import type {Driver as Aliased} from './types'; type Result=Aliased<number>;`,
      {
        'types.ts': `export type Driver<T>={read():T; write(value:T):void; optional?:()=>boolean;};`,
      }
    );
    expect(type).toMatchObject({
      kind: 'object',
      fields: [
        { name: 'read', type: { kind: 'callable', returnType: 'number' } },
        {
          name: 'write',
          type: { kind: 'callable', parameters: [{ type: 'number' }], returnType: 'void' },
        },
        { name: 'optional', optional: true },
      ],
    });
  });
  it('preserves nullable function identity without granting JSON serialization', () => {
    expect(parse(`type Result=(()=>void)|null;`)).toMatchObject({
      kind: 'value-union',
      members: [{ kind: 'callable' }, 'null'],
    });
  });
  it('preserves Readonly write constraints rather than collapsing to a mutable data record', () => {
    expect(parse(`type Result=Readonly<{value:number}>;`)).toMatchObject({
      kind: 'object',
      fields: [{ name: 'value', type: 'number', readonly: true }],
    });
  });
  it('resolves actual authored Transition driver and handle type declarations', () => {
    const files = Object.fromEntries(
      ['machine.ts', 'types.ts'].map((name) => [
        name,
        readFileSync(
          new URL(`../../prototypes/base/src/transition/${name}`, import.meta.url),
          'utf8'
        ),
      ])
    );
    expect(
      parse(
        `import type {TransitionMachineDriver} from './machine'; type Result=TransitionMachineDriver;`,
        files
      )
    ).toMatchObject({ kind: 'object' });
    expect(
      parse(`import type {TransitionHandles} from './types'; type Result=TransitionHandles;`, files)
    ).toMatchObject({ kind: 'object' });
  });
  it('does not identify a local PresentationOwnerRef by its name', () => {
    expect(
      parse(`type PresentationOwnerRef={value:number}; type Result=PresentationOwnerRef;`)
    ).toEqual({ kind: 'record', fields: [{ name: 'value', type: 'number' }] });
  });
});
