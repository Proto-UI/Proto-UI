// @vitest-environment node
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SourceGraph } from '../src/parser-module';
import { parseSourceValueType } from '../src/source-values';

function parse(source: string, files: Record<string, string> = {}) {
  const graph = new SourceGraph(source, { fileName: 'input.ts', files });
  const module = graph.load('input.ts');
  const declaration = module.file.statements.find(
    (node) => ts.isTypeAliasDeclaration(node) && node.name.text === 'Result'
  ) as ts.TypeAliasDeclaration;
  return parseSourceValueType(module, declaration.type);
}

describe('ordinary source value types', () => {
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
