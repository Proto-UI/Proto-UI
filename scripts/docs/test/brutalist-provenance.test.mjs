import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const read = (path) => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
const pin = '3306a802724874a85f93079702b2795370a279d4';

// Section borders are optional: the current public parts default divider to
// false and admit their border only through a Rule that requires divider=true.
// Inspect actual style calls, so a conditional token does not look like an
// unconditional section border merely because it occurs in the source file.
const assertOptionalDivider = (implementation, part) => {
  const source = ts.createSourceFile(
    `${part}.proto.ts`,
    implementation,
    ts.ScriptTarget.Latest,
    true
  );
  const borderCalls = [];
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(source).endsWith('.feedback.style.use') &&
      node.arguments.some((argument) => /\bborder(?:-|\b)/.test(argument.getText(source)))
    )
      borderCalls.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.match(implementation, /def\.props\.setDefaults\(\{\s*divider:\s*false\s*\}\)/);
  assert.ok(borderCalls.length > 0, `${part} retains its explicit divider style`);
  for (const call of borderCalls) {
    const rule = ts.findAncestor(
      call,
      (node) => ts.isCallExpression(node) && node.expression.getText(source) === 'def.rule'
    );
    assert.ok(rule, `${part} has no unconditional border`);
    const object = rule.arguments[0];
    assert.ok(ts.isObjectLiteralExpression(object));
    const when = object.properties.find(
      (node) => ts.isPropertyAssignment(node) && node.name.getText(source) === 'when'
    )?.initializer;
    assert.ok(when && ts.isArrowFunction(when) && when.parameters.length === 1);
    const receiver = when.parameters[0].name.getText(source);
    const requiresDivider = (condition) => {
      if (!ts.isCallExpression(condition) || !ts.isPropertyAccessExpression(condition.expression))
        return false;
      const target = condition.expression;
      if (target.getText(source) === `${receiver}.all`)
        return condition.arguments.some(requiresDivider);
      const prop = target.expression;
      return (
        target.name.text === 'eq' &&
        condition.arguments.length === 1 &&
        condition.arguments[0].kind === ts.SyntaxKind.TrueKeyword &&
        ts.isCallExpression(prop) &&
        prop.expression.getText(source) === `${receiver}.prop` &&
        prop.arguments.length === 1 &&
        ts.isStringLiteral(prop.arguments[0]) &&
        prop.arguments[0].text === 'divider'
      );
    };
    assert.ok(requiresDivider(when.body), `${part} border requires divider=true`);
  }
};

for (const path of [
  'packages/prototypes/brutalist/README.md',
  'apps/www/src/content/docs/en/ui-libraries/brutalist/design-contract.mdx',
  'apps/www/src/content/docs/zh-cn/ui-libraries/brutalist/design-contract.mdx',
  'internal/governance/package-surface-map.md',
  'internal/governance/package-surface-map.zh-CN.md',
]) {
  test(`${path} distinguishes maintained implementation from visual provenance`, () => {
    const source = read(path);
    const brutalistSection = path.includes('package-surface-map')
      ? source.split('### 8.3 `@proto.ui/prototypes-brutalist`')[1].split('\n---')[0]
      : source;
    assert.doesNotMatch(
      brutalistSection,
      /contributor-authored|贡献者原创|only general Neo-Brutalist visual references/i
    );
    assert.match(brutalistSection, /neobrutalism(?:\.dev|-components)/);
    assert.ok(brutalistSection.includes(pin));
    assert.match(brutalistSection, /MIT/);
    assert.match(brutalistSection, /semantic implementation|语义实现/);
  });
}

test('the visual source retains its author and complete MIT notice separately from semantics', () => {
  const source = read('packages/prototypes/brutalist/THIRD_PARTY_NOTICES.md');
  assert.ok(source.includes(pin));
  assert.match(source, /Copyright \(c\) 2023 Samuel Breznjak/);
  assert.match(source, /Permission is hereby granted/);
  assert.match(source, /THE SOFTWARE IS PROVIDED "AS IS"/);
  const authority = read('spec/knowledge/K-BRUTALIST-0001.yaml');
  assert.match(authority, /preserving license attribution for adapted recipes/);
  assert.match(authority, /Proto UI maintains its own semantic implementation/);
});

for (const locale of ['en', 'zh-cn']) {
  test(`${locale} Card docs explain the black frame and opt-in section dividers`, () => {
    const source = read(
      `apps/www/src/content/docs/${locale}/ui-libraries/brutalist/components/card.mdx`
    );
    assert.doesNotMatch(source, /ink frame|方向性 ink 分隔线|foreground.*重绘/);
    for (const part of ['header', 'footer']) {
      const implementation = read(`packages/prototypes/brutalist/src/card/${part}.proto.ts`);
      assertOptionalDivider(implementation, part);
      const catalog = read(`spec/prototypes/P-BRUTALIST-CARD-${part.toUpperCase()}.yaml`);
      assert.match(catalog, /^summary:.*without mandatory section borders/m);
    }
    const prose = source.split('\n---\n').at(-1);
    assert.match(
      prose,
      locale === 'en' ? /2px[^\n.]*black (?:frame|border)/i : /2px[^\n。]*黑色(?:外框|边框)/
    );
    assert.match(
      source,
      locale === 'en'
        ? /Header[^\n.]*Footer[^\n.]*\b(?:without|no)\b[^\n.]*borders?[^\n.]*\bdefault\b/i
        : /Header[^\n。]*Footer[^\n。]*默认[^\n。]*(?:不加|没有|无)[^\n。]*边框/
    );
    assert.match(
      prose,
      locale === 'en'
        ? /divider=\{true\}[^\n.]*2px[^\n.]*dividers?/i
        : /divider=\{true\}[^\n。]*2px[^\n。]*分隔线/
    );
    for (const part of ['Header', 'Footer']) {
      const api = source.split(`### BrutalistCard${part}\n`)[1]?.split('\n##')[0];
      assert.ok(api, `${locale} documents the ${part} API`);
      assert.match(api, /name:\s*'divider',\s*type:\s*'boolean',\s*default:\s*'false'/);
    }
    assert.match(
      read('packages/prototypes/brutalist/src/card/root.proto.ts'),
      /border-2 border-black/
    );
    // The Web Component adapter tests in packages/prototypes/brutalist/test/card.test.ts
    // cover the Root frame and both section dividers before, during, and after opt-in.
  });
}
