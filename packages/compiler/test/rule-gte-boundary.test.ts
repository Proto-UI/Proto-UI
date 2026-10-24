// @vitest-environment node
import ts from 'typescript';
import { expect, it } from 'vitest';
import { CompilerRejection } from '../src/diagnostics';
import { extractRuleDeclaration } from '../src/rule-declarations';
import { lowerRulePlan } from '../src/rule-plan';
function extract(operator: 'eq' | 'gte') {
  const file = ts.createSourceFile(
    'numeric.proto.ts',
    `const rule={when:w=>w.prop('count').${operator}(4),intent:i=>i.feedback.style.use(paint)};`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const node = (file.statements[0] as ts.VariableStatement).declarationList.declarations[0]
    .initializer as ts.ObjectLiteralExpression;
  return extractRuleDeclaration(node, {
    id: 1,
    order: 0,
    props: new Map([['count', 'number']]),
    resolveState: () => undefined,
    resolveStyle: () => ({ kind: 'tw', tokens: ['text-sm'] }),
  });
}
it('retains explicit source-profile rejection until complete compiler gte admission', () => {
  try {
    extract('gte');
    throw new Error('gte was unexpectedly admitted');
  } catch (error) {
    expect(error).toBeInstanceOf(CompilerRejection);
    expect((error as CompilerRejection).diagnostic).toMatchObject({
      code: 'PUI1024',
      category: 'unsupported-input',
    });
  }
});
it('does not silently interpret a serialized gte as another portable-plan operator', () => {
  const rule = JSON.parse(JSON.stringify(extract('eq')));
  rule.when.type = 'gte';
  expect(lowerRulePlan([rule])).toMatchObject({
    ok: false,
    diagnostics: [{ code: 'PUI2024', category: 'invalid-ir' }],
  });
  expect(lowerRulePlan([extract('eq')]).ok).toBe(true);
});
