// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { HOOK_ADMISSION } from '../src/hook-admission';
import { parsePrototype } from '../src/parser';

// Read the actual public export graph without importing/evaluating its hooks.
function publicHookExports(filename: string, seen = new Set<string>()): Set<string> {
  if (seen.has(filename)) return new Set();
  seen.add(filename);
  const file = ts.createSourceFile(
    filename,
    readFileSync(filename, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
  const names = new Set<string>();
  for (const statement of file.statements) {
    if (ts.isExportDeclaration(statement) && !statement.isTypeOnly) {
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements)
          if (!element.isTypeOnly && /^as[A-Z]/.test(element.name.text))
            names.add(element.name.text);
      } else if (
        !statement.exportClause &&
        statement.moduleSpecifier &&
        ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        for (const name of publicHookExports(
          path.resolve(path.dirname(filename), `${statement.moduleSpecifier.text}.ts`),
          seen
        ))
          names.add(name);
      }
    }
    if (
      !ts.canHaveModifiers(statement) ||
      !ts.getModifiers(statement)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    )
      continue;
    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name &&
      /^as[A-Z]/.test(statement.name.text)
    )
      names.add(statement.name.text);
    if (ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations)
        if (ts.isIdentifier(declaration.name) && /^as[A-Z]/.test(declaration.name.text))
          names.add(declaration.name.text);
  }
  return names;
}

function source(imports: string, call: string): string {
  return `import {definePrototype} from '@proto.ui/core';
${imports}
export default definePrototype({name:'renamed-subject',setup(){${call};}});`;
}

describe('public hook admission and actionable frontend diagnostics', () => {
  it('gives every actual public asHook an explicit disposition', () => {
    const hooks = publicHookExports(
      fileURLToPath(new URL('../../hooks/src/index.ts', import.meta.url))
    );
    expect([...hooks].sort()).toEqual(Object.keys(HOOK_ADMISSION).sort());
    for (const admission of Object.values(HOOK_ADMISSION))
      if (admission.status === 'unsupported') expect(admission.reason.trim()).not.toBe('');
  });

  for (const [name, admission] of Object.entries(HOOK_ADMISSION)) {
    if (admission.status === 'admitted') {
      it(`lowers renamed ${name} through direct imports and local forwarding`, () => {
        const args = name === 'asTableStructure' ? "'caption'" : '';
        const direct = parsePrototype(
          source(`import {${name} as renamed} from '@proto.ui/hooks';`, `renamed(${args})`),
          { fileName: 'direct.proto.ts' }
        );
        const forwarded = parsePrototype(
          source("import {renamed} from './bridge';", `renamed(${args})`),
          {
            fileName: 'forwarded.proto.ts',
            files: {
              'bridge.ts': `import {${name} as local} from '@proto.ui/hooks'; export {local as renamed};`,
            },
          }
        );
        for (const result of [direct, forwarded]) {
          expect(result.ok, JSON.stringify(result)).toBe(true);
          if (result.ok) expect(JSON.stringify(result.value.setup)).toContain(admission.operation);
        }
      });
    } else {
      it(`rejects ${name} before lowering with its real import span and reason`, () => {
        const bridge = `import {${name} as local} from '@proto.ui/hooks'; export {local as renamed};`;
        const result = parsePrototype(source("import {renamed} from './bridge';", 'renamed()'), {
          fileName: 'consumer.proto.ts',
          files: { 'bridge.ts': bridge },
        });
        expect(result).toMatchObject({
          ok: false,
          diagnostics: [
            {
              code: 'PUI1003',
              category: 'unsupported-input',
              message: `Unsupported import ${name} from @proto.ui/hooks: ${admission.reason}`,
              span: {
                file: 'bridge.ts',
                start: 8,
                end: 8 + name.length + ' as local'.length,
                line: 1,
                column: 9,
              },
            },
          ],
        });
      });
    }
  }

  it('keeps unknown hook names unsupported, including Object prototype members', () => {
    for (const name of ['asUnregistered', 'constructor', 'toString'])
      expect(
        parsePrototype(source(`import {${name} as renamed} from '@proto.ui/hooks';`, 'renamed()'))
      ).toMatchObject({
        ok: false,
        diagnostics: [
          {
            code: 'PUI1003',
            category: 'unsupported-input',
            message: `Unsupported import ${name} from @proto.ui/hooks.`,
          },
        ],
      });
  });

  it('diagnoses an invalid part declaration and retains its actual source range', () => {
    const input = `import {definePrototype} from '@proto.ui/core';
import {asAccessible} from '@proto.ui/hooks';
export default definePrototype({name:'diagnostic-subject',setup(){
  const accessible=asAccessible();
  accessible.part('content');
}});`;
    const result = parsePrototype(input, { fileName: 'nested/subject.proto.ts' });
    expect(result).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: 'PUI1006',
          category: 'unsupported-input',
          message: 'Invalid argument count for accessible.part.',
          span: {
            file: 'nested/subject.proto.ts',
            start: input.indexOf("accessible.part('content')"),
            line: 5,
            column: 3,
          },
        },
      ],
    });
  });
});
