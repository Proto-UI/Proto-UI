// @vitest-environment node
import ts from 'typescript';
import { expect, it } from 'vitest';
import { extractRuleDeclaration } from '../src/rule-declarations';
import { evaluateRulePlan, lowerRulePlan } from '../src/rule-plan';
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
it('admits the finite gte threshold through the source profile', () => {
  const result = lowerRulePlan([extract('gte')]);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  expect(
    evaluateRulePlan(result.value, { props: { count: 4 }, states: {} }).activeRuleIds.length
  ).toBe(1);
});
it('keeps serialized gte numeric and rejects a malformed threshold', () => {
  const rule = JSON.parse(JSON.stringify(extract('eq')));
  rule.when.type = 'gte';
  expect(lowerRulePlan([rule]).ok).toBe(true);
  rule.when.right = '4';
  expect(lowerRulePlan([rule])).toMatchObject({
    ok: false,
    diagnostics: [{ code: 'PUI2024', category: 'invalid-ir' }],
  });
  expect(lowerRulePlan([extract('eq')]).ok).toBe(true);
});
