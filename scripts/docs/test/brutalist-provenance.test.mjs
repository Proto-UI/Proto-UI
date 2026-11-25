import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
const pin = '3306a802724874a85f93079702b2795370a279d4';

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
    // The Web Component adapter tests in packages/prototypes/brutalist/test/card.test.ts
    // cover the Root frame and both section dividers before, during, and after opt-in.
  });
}
