import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
const pin = '3306a802724874a85f93079702b2795370a279d4';

for (const path of [
  'packages/prototypes/brutalist/README.md',
  'apps/www/src/content/docs/en/ui-libraries/brutalist/index.mdx',
  'apps/www/src/content/docs/zh-cn/ui-libraries/brutalist/index.mdx',
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
  test(`${locale} Card docs describe the current black outer frame and unbordered sections`, () => {
    const source = read(
      `apps/www/src/content/docs/${locale}/ui-libraries/brutalist/components/card.mdx`
    );
    assert.doesNotMatch(source, /ink frame|方向性 ink 分隔线|foreground.*重绘/);
    assert.match(source, locale === 'en' ? /2px.*black frame/ : /2px.*黑色外框/);
    assert.match(source, locale === 'en' ? /no section borders by default/ : /默认不加分段边框/);
    for (const part of ['header', 'footer']) {
      const implementation = read(`packages/prototypes/brutalist/src/card/${part}.proto.ts`);
      assert.doesNotMatch(implementation, /\bborder(?:-|\b)/);
      const catalog = read(`spec/prototypes/P-BRUTALIST-CARD-${part.toUpperCase()}.yaml`);
      assert.match(catalog, /^summary:.*without mandatory section borders/m);
    }
    assert.match(
      read('packages/prototypes/brutalist/src/card/root.proto.ts'),
      /border-2 border-black/
    );
  });
}
