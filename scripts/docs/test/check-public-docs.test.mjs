import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  checkApiPropsTables,
  checkSpecLifecycleProjection,
  checkLibraryInventory,
  checkLocalizedRoutes,
  checkScaffolding,
  checkUiLibraryProse,
  extractSidebarSlugs,
  findStaleReleaseClaims,
  runPublicDocsCheck,
} from '../check-public-docs.mjs';
import { publicDocPolicy } from '../public-doc-policy.mjs';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

test('a stale current RC install claim fails while an archived page passes', async () => {
  const current = await fs.readFile(path.join(FIXTURES, 'current-rc.md'), 'utf8');
  const archived = await fs.readFile(path.join(FIXTURES, 'archived-rc.md'), 'utf8');
  const input = {
    currentVersion: '0.2.0',
    governedSource: 'spec/versions/V-STABLE.yaml',
    pendingMarkers: ['stable publication pending'],
  };

  const currentErrors = findStaleReleaseClaims({ file: 'current-rc.md', text: current, ...input });
  assert.equal(currentErrors.length, 1);
  assert.match(currentErrors[0], /current-rc\.md:6/);
  assert.match(currentErrors[0], /V-STABLE\.yaml/);
  assert.deepEqual(
    findStaleReleaseClaims({ file: 'archived-rc.md', text: archived, archived: true, ...input }),
    []
  );
});

test('a current prerelease claim fails even when its core differs from stable', async () => {
  const text = await fs.readFile(path.join(FIXTURES, 'different-core-current-rc.md'), 'utf8');
  const errors = findStaleReleaseClaims({
    file: 'different-core-current-rc.md',
    text,
    currentVersion: '0.2.0',
    governedSource: 'spec/versions/V-STABLE.yaml',
  });

  assert.equal(errors.length, 1);
  assert.match(errors[0], /0\.1\.0-rc\.7 is presented as a current install\/release claim/);
});

test('an explicitly draft workspace train is not a current release claim', () => {
  const errors = findStaleReleaseClaims({
    file: 'workspace.md',
    text: 'The current workspace may contain changes for the draft 0.3.0-alpha.0 train.',
    currentVersion: '0.2.0',
    governedSource: 'spec/versions/V-STABLE.yaml',
  });

  assert.deepEqual(errors, []);
});

test('unavailable package export evidence is not an installation recommendation', () => {
  for (const [file, text] of [
    [
      'availability.en.md',
      'The npm artifacts for `@proto.ui/prototypes-test@0.3.0-alpha.1` do not export `./spinner`.',
    ],
    [
      'availability.zh-cn.md',
      'npm 中的 `@proto.ui/prototypes-test@0.3.0-alpha.1` 单包均不导出 `./spinner`。',
    ],
  ]) {
    assert.deepEqual(
      findStaleReleaseClaims({
        file,
        text,
        currentVersion: '0.2.0',
        governedSource: 'spec/versions/V-STABLE.yaml',
      }),
      []
    );
  }
});

test('an unavailable-export note cannot hide a prerelease install or use directive', () => {
  for (const text of [
    'npm install @proto.ui/prototypes-test@0.3.0-alpha.1 # does not export Spinner',
    'Use @proto.ui/prototypes-test@0.3.0-alpha.1, which does not export Spinner.',
  ]) {
    const errors = findStaleReleaseClaims({
      file: 'install.md',
      text,
      currentVersion: '0.2.0',
      governedSource: 'spec/versions/V-STABLE.yaml',
    });
    assert.equal(errors.length, 1);
    assert.match(errors[0], /current install\/release claim/);
  }
});

test('a missing localized primary route reports the exact locale and slug', async () => {
  const result = await checkLocalizedRoutes({
    root: path.join(FIXTURES, 'routes'),
    slugs: ['start'],
    locales: ['en', 'zh-cn'],
  });

  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /locale=zh-cn, slug=start/);
});

test('an unclassified released family gap points to catalog remediation', () => {
  const errors = checkLibraryInventory({
    releaseVersion: '0.2.0',
    bom: {
      __source: 'internal/releases/0.2.0/package-bom.json',
      packages: [{ name: '@proto.ui/prototypes-test' }],
    },
    libraries: [
      {
        id: 'test',
        packageName: '@proto.ui/prototypes-test',
        detailPrefix: 'ui-libraries/test',
        catalogPrefix: 'P-TEST-',
        exportClassifications: {
          '.': {
            kind: 'library-root',
            reason: 'The root barrel aggregates the component families.',
          },
        },
      },
    ],
    manifests: new Map([
      [
        '@proto.ui/prototypes-test',
        { exports: { '.': './dist/index.js', './new-family': './dist/new.js' } },
      ],
    ]),
    catalog: [],
    sidebarSlugs: ['ui-libraries/test'],
  });

  assert.equal(errors.length, 1);
  assert.match(errors[0], /unclassified family\/export/);
  assert.match(errors[0], /P-TEST-NEW-FAMILY/);
});

test('an available exported family missing from the sidebar is rejected', () => {
  const errors = checkLibraryInventory({
    releaseVersion: '0.2.0',
    bom: { packages: [{ name: '@proto.ui/prototypes-test' }] },
    libraries: [
      {
        id: 'test',
        packageName: '@proto.ui/prototypes-test',
        detailPrefix: 'ui-libraries/test',
        catalogPrefix: 'P-TEST-',
        exportClassifications: {
          '.': { kind: 'library-root', reason: 'The overview represents the root barrel.' },
        },
      },
    ],
    manifests: new Map([
      [
        '@proto.ui/prototypes-test',
        { exports: { '.': './dist/index.js', './button': './dist/button.js' } },
      ],
    ]),
    catalog: [{ id: 'P-TEST-BUTTON', since: '0.2.0-rc.1', status: 'draft' }],
    sidebarSlugs: ['ui-libraries/test'],
  });

  assert.equal(errors.length, 1);
  assert.match(errors[0], /absent from primary sidebar slug ui-libraries\/test\/button/);
});

test('a direct family route can differ from its library default without an overview mount', () => {
  const errors = checkLibraryInventory({
    releaseVersion: '0.2.0',
    bom: { packages: [{ name: '@proto.ui/prototypes-test' }] },
    libraries: [
      {
        id: 'test',
        packageName: '@proto.ui/prototypes-test',
        detailPrefix: 'ui-libraries/test',
        catalogPrefix: 'P-TEST-',
        familyRoutes: { button: 'ui-libraries/test/controls/button' },
        exportClassifications: {
          '.': {
            kind: 'library-root',
            reason: 'The root barrel aggregates the component families.',
          },
        },
      },
    ],
    manifests: new Map([
      [
        '@proto.ui/prototypes-test',
        { exports: { '.': './dist/index.js', './button': './dist/button.js' } },
      ],
    ]),
    catalog: [{ id: 'P-TEST-BUTTON', since: '0.2.0-rc.1', status: 'draft' }],
    sidebarSlugs: ['ui-libraries/test/controls/button'],
  });

  assert.deepEqual(errors, []);
});

test('workspace draft exports need navigation before the next stable publication', () => {
  const errors = checkLibraryInventory({
    releaseVersion: '0.2.0',
    workspaceVersion: '0.3.0-alpha.1',
    bom: { packages: [{ name: '@proto.ui/prototypes-test' }] },
    libraries: [
      {
        id: 'test',
        packageName: '@proto.ui/prototypes-test',
        detailPrefix: 'ui-libraries/test',
        catalogPrefix: 'P-TEST-',
      },
    ],
    manifests: new Map([
      ['@proto.ui/prototypes-test', { exports: { './button': './dist/button.js' } }],
    ]),
    catalog: [{ id: 'P-TEST-BUTTON', since: '0.3.0-alpha.1', status: 'draft' }],
    sidebarSlugs: [],
  });

  assert.equal(errors.length, 1);
  assert.match(errors[0], /P-TEST-BUTTON.*absent from primary sidebar/);
});

test('a released family with the wrong sidebar route fails the canonical projection', () => {
  const errors = checkLibraryInventory({
    releaseVersion: '0.2.0',
    bom: { packages: [{ name: '@proto.ui/prototypes-test' }] },
    libraries: [
      {
        id: 'test',
        packageName: '@proto.ui/prototypes-test',
        detailPrefix: 'ui-libraries/test',
        catalogPrefix: 'P-TEST-',
        exportClassifications: {
          '.': {
            kind: 'library-root',
            reason: 'The root barrel aggregates the component families.',
          },
        },
      },
    ],
    manifests: new Map([
      [
        '@proto.ui/prototypes-test',
        { exports: { '.': './dist/index.js', './button': './dist/button.js' } },
      ],
    ]),
    catalog: [{ id: 'P-TEST-BUTTON', since: '0.2.0-rc.1', status: 'draft' }],
    sidebarSlugs: ['ui-libraries/test/wrong'],
  });

  assert.equal(errors.length, 1);
  assert.match(errors[0], /absent from primary sidebar slug ui-libraries\/test\/button/);
});

test('reasoned non-component and overview-only exports pass intentionally', () => {
  const input = {
    releaseVersion: '0.2.0',
    bom: { packages: [{ name: '@proto.ui/prototypes-icons' }] },
    libraries: [
      {
        id: 'icons',
        packageName: '@proto.ui/prototypes-icons',
        overviewSlug: 'ui-libraries/icons',
        catalogPrefix: 'P-ICONS-',
        exportClassifications: {
          '.': { kind: 'library-root', reason: 'The root barrel maps to the overview.' },
          './manifest': { kind: 'non-component', reason: 'Metadata is not a component.' },
          './icons/*': {
            kind: 'overview-only',
            catalogId: 'P-ICONS-ICON',
            reason: 'Generated entries share one searchable overview.',
          },
        },
      },
    ],
    manifests: new Map([
      [
        '@proto.ui/prototypes-icons',
        {
          exports: {
            '.': './dist/index.js',
            './manifest': './dist/manifest.js',
            './icons/*': './dist/*.js',
          },
        },
      ],
    ]),
    catalog: [{ id: 'P-ICONS-ICON', since: '0.2.0-rc.1', status: 'draft' }],
    sidebarSlugs: ['ui-libraries/icons'],
  };

  assert.deepEqual(checkLibraryInventory(input), []);
  const missingOverview = checkLibraryInventory({ ...input, sidebarSlugs: [] });
  assert.equal(missingOverview.length, 1);
  assert.match(missingOverview[0], /overview route ui-libraries\/icons is missing/);
});

test('public scaffolding reports the source file and marker', async () => {
  const text = await fs.readFile(path.join(FIXTURES, 'placeholder.md'), 'utf8');
  const errors = checkScaffolding({
    documents: [{ locale: 'zh-cn', slug: 'guide', file: 'placeholder.md', text }],
    markers: ['写作提示', 'Coming soon'],
  });

  assert.equal(errors.length, 1);
  assert.match(errors[0], /placeholder\.md:3/);
  assert.match(errors[0], /写作提示/);
});

test('public spec lifecycle guides expose the activation-history boundary', () => {
  const errors = checkSpecLifecycleProjection({
    documents: [
      {
        locale: 'en',
        slug: 'specifications/introduction',
        file: 'apps/www/src/content/docs/en/specifications/introduction.md',
        text: 'Every entity has a `since` version and a lifecycle status.',
      },
      {
        locale: 'zh-cn',
        slug: 'specifications/introduction',
        file: 'apps/www/src/content/docs/zh-cn/specifications/introduction.md',
        text: '普通实体使用 `activeSince` 记录稳定生效版本。',
      },
    ],
  });

  assert.deepEqual(errors, [
    'apps/www/src/content/docs/en/specifications/introduction.md: public spec lifecycle guide must explain `activeSince` as distinct from `since`.',
    'apps/www/src/content/docs/zh-cn/specifications/introduction.md: public spec lifecycle guide must state that `activeSince` may equal `since` for an identity introduced stable.',
  ]);
});

test('the Shadcn Input sidebar route opens its real demo in both locales', async () => {
  const root = new URL('../../../', import.meta.url);
  const slug = 'ui-libraries/shadcn/input';
  const config = await fs.readFile(new URL('apps/www/astro.config.mjs', root), 'utf8');
  assert.ok(extractSidebarSlugs(config).includes(slug));
  for (const locale of publicDocPolicy.locales) {
    const source = await fs.readFile(
      new URL(`apps/www/src/content/docs/${locale}/${slug}.mdx`, root),
      'utf8'
    );
    assert.match(source, /<PrototypePreviewer\s+demoId="demo-shadcn-input"/);
  }
});

test('the public catalog validates current family routes without a retired overview', async () => {
  const result = await runPublicDocsCheck();
  assert.deepEqual(result.errors, []);
});

test('both general Feedback references explain the bounded selection exception', async () => {
  for (const locale of ['en', 'zh-cn']) {
    const source = await fs.readFile(
      new URL(
        `../../../apps/www/src/content/docs/${locale}/specifications/feedback.mdx`,
        import.meta.url
      ),
      'utf8'
    );
    assert.match(source, /selection:<style-token>/);
    assert.match(source, /tw\('selection:bg-primary'\)/);
    assert.match(source, /tw\('selection:hover:bg-primary'\)/);
  }
});

test('checkUiLibraryProse passes clean bilingual ui-libraries docs and ignores fenced code blocks', () => {
  const errors = checkUiLibraryProse({
    documents: [
      {
        locale: 'zh-cn',
        file: 'apps/www/src/content/docs/zh-cn/ui-libraries/shadcn/button.mdx',
        text: [
          '---',
          'title: Button',
          'description: Shadcn 风格的按钮组件。',
          '---',
          '',
          '本页示例使用 **Shadcn Rhea** 风格。',
          '',
          '```ts',
          '// Finf synthetic-DOM socket EPERM 不宣称 验收缺口',
          'const sha = "3d98900e9b73c45f035f8109e9d41ba6a51685e7";',
          '```',
          '',
          '~~~txt',
          'does not claim visual parity or rendered parity',
          '~~~',
        ].join('\n'),
      },
      {
        locale: 'en',
        file: 'apps/www/src/content/docs/en/ui-libraries/shadcn/button.mdx',
        text: [
          '---',
          'title: Button',
          'description: Shadcn styled button component.',
          '---',
          '',
          'The examples on this page use the **Shadcn Rhea** style preset.',
        ].join('\n'),
      },
      {
        locale: 'zh-cn',
        file: 'apps/www/src/content/docs/zh-cn/ui-libraries/brutalist/components/badge.mdx',
        text: ['---', 'title: Badge', '---', '', '简约标签组件。'].join('\n'),
      },
    ],
  });

  assert.deepEqual(errors, []);
});

test('checkUiLibraryProse flags audit boilerplate and defensive hedging with accurate line numbers', () => {
  const errors = checkUiLibraryProse({
    documents: [
      {
        locale: 'zh-cn',
        file: 'apps/www/src/content/docs/zh-cn/ui-libraries/base/switch.mdx',
        text: [
          '---',
          'title: Switch',
          'description: 开关组件。',
          '---',
          '```sh',
          'echo "Finf ignored inside fence"',
          '```',
          '当前为 Finf 草案，本地启动被 socket EPERM 阻止，不伪报通过。',
          '当前 synthetic-DOM 与 synthetic DOM 测试存在验收缺口。',
          '不宣称全部对齐，两者不混称，也不代表浏览器与原生宿主验收已完成。',
        ].join('\n'),
      },
      {
        locale: 'en',
        file: 'apps/www/src/content/docs/en/ui-libraries/base/switch.mdx',
        text: [
          '---',
          'title: Switch',
          'description: Toggle switch.',
          '---',
          'This page does not claim full browser parity.',
          'It is not a claim of rendered parity or visual parity.',
          'This prototype does not claim acceptance or completion.',
        ].join('\n'),
      },
    ],
  });

  assert.ok(
    errors.some((e) => e.includes('zh-cn/ui-libraries/base/switch.mdx:8:') && e.includes('Finf'))
  );
  assert.ok(
    errors.some(
      (e) => e.includes('zh-cn/ui-libraries/base/switch.mdx:8:') && e.includes('socket EPERM')
    )
  );
  assert.ok(
    errors.some((e) => e.includes('zh-cn/ui-libraries/base/switch.mdx:8:') && e.includes('不伪报'))
  );
  assert.ok(
    errors.some(
      (e) => e.includes('zh-cn/ui-libraries/base/switch.mdx:9:') && e.includes('synthetic-DOM')
    )
  );
  assert.ok(
    errors.some(
      (e) => e.includes('zh-cn/ui-libraries/base/switch.mdx:9:') && e.includes('synthetic DOM')
    )
  );
  assert.ok(
    errors.some(
      (e) => e.includes('zh-cn/ui-libraries/base/switch.mdx:9:') && e.includes('验收缺口')
    )
  );
  assert.ok(
    errors.some((e) => e.includes('zh-cn/ui-libraries/base/switch.mdx:10:') && e.includes('不宣称'))
  );
  assert.ok(
    errors.some((e) => e.includes('zh-cn/ui-libraries/base/switch.mdx:10:') && e.includes('不混称'))
  );
  assert.ok(
    errors.some(
      (e) => e.includes('zh-cn/ui-libraries/base/switch.mdx:10:') && e.includes('不代表…验收')
    )
  );
  assert.ok(
    errors.some(
      (e) => e.includes('en/ui-libraries/base/switch.mdx:5:') && e.includes('does not claim')
    )
  );
  assert.ok(
    errors.some(
      (e) => e.includes('en/ui-libraries/base/switch.mdx:6:') && e.includes('not a claim of')
    )
  );
  assert.ok(
    errors.some(
      (e) => e.includes('en/ui-libraries/base/switch.mdx:6:') && e.includes('rendered parity')
    )
  );
  assert.ok(
    errors.some(
      (e) => e.includes('en/ui-libraries/base/switch.mdx:6:') && e.includes('visual parity')
    )
  );
  assert.ok(
    errors.some(
      (e) => e.includes('en/ui-libraries/base/switch.mdx:7:') && e.includes('does not claim')
    )
  );
});

test('checkUiLibraryProse flags 40-char commit SHAs except in design-contract.mdx', () => {
  const sha = '3306a802724874a85f93079702b2795370a279d4';
  const errors = checkUiLibraryProse({
    documents: [
      {
        locale: 'en',
        file: 'apps/www/src/content/docs/en/ui-libraries/brutalist/design-contract.mdx',
        text: `---\ntitle: Design Contract\n---\nPinned reference ${sha}.\n`,
      },
      {
        locale: 'zh-cn',
        file: 'apps/www/src/content/docs/zh-cn/ui-libraries/brutalist/design-contract.mdx',
        text: `---\ntitle: 设计契约\ndescription: 设计参考说明。\n---\n固定提交 ${sha}。\n`,
      },
      {
        locale: 'en',
        file: 'apps/www/src/content/docs/en/ui-libraries/shadcn/card.mdx',
        text: `---\ntitle: Card\n---\nReference commit ${sha}.\n`,
      },
    ],
  });

  assert.equal(errors.length, 1);
  assert.match(errors[0], /shadcn\/card\.mdx:4:.*40-char commit SHA/);
});

test('checkUiLibraryProse flags zh-cn ui-libraries frontmatter descriptions without Chinese characters', () => {
  const errors = checkUiLibraryProse({
    documents: [
      {
        locale: 'zh-cn',
        file: 'apps/www/src/content/docs/zh-cn/ui-libraries/base/field.mdx',
        text: [
          '---',
          'title: Field',
          'description: Atomic Field labeling and validation.',
          '---',
          '',
          '用于表单字段组合。',
        ].join('\n'),
      },
    ],
  });

  assert.equal(errors.length, 1);
  assert.match(errors[0], /zh-cn\/ui-libraries\/base\/field\.mdx:3:.*must contain Chinese text/);
});

test('checkApiPropsTables rejects prose misused in default column and accepts description column', () => {
  const errors = checkApiPropsTables({
    documents: [
      {
        file: 'apps/www/src/content/docs/zh-cn/ui-libraries/shadcn/button.mdx',
        text: [
          '<ApiPropsTable',
          "  headers={{ name: '成员', type: '类型', default: '说明' }}",
          "  rows={[{ name: 'click', type: 'Event<void>', default: '指针点击时触发' }]}",
          '/>',
          '<ApiPropsTable',
          "  headers={{ name: '属性', type: '类型', default: '默认值' }}",
          "  rows={[{ name: 'mode', type: 'string', default: '这是很长的说明句子，不应该放在默认值里。' }]}",
          '/>',
          '<ApiPropsTable',
          "  headers={{ name: '成员', type: '类型', description: '说明' }}",
          "  rows={[{ name: 'click', type: 'Event<void>', description: '指针点击或键盘 Enter / Space 激活时触发（禁用态不触发）' }]}",
          '/>',
          '<ApiPropsTable',
          "  headers={{ name: '属性', type: '类型', default: '默认值' }}",
          "  rows={[{ name: 'disabled', type: 'boolean', default: 'false' }]}",
          '/>',
        ].join('\n'),
      },
    ],
  });

  assert.equal(errors.length, 2);
  assert.match(errors[0], /button\.mdx:2:.*non-default column "说明".*headers\.description/);
  assert.match(errors[0], /Do NOT weaken this check or hack table tests/);
  assert.match(errors[1], /button\.mdx:7:.*prose or overly long text into "default"/);
});
