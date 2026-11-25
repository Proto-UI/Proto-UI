import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const generator = new URL(
  '../../../apps/www/scripts/generate-whitepaper-diagrams.mjs',
  import.meta.url
);
const diagrams = new URL('../../../apps/www/public/diagrams/', import.meta.url);

// The responsive variants share the generator with the reviewed desktop diagrams.
const desktopSha256 = {
  'component-anatomy.en': 'b198d0969717417504b0631ed58b6b6698b4243dfc5a2d4475e038b61a4c8157',
  'component-anatomy.zh-cn': 'fca77c8262744dcc370ba89e8239d43c28122db5f6b4cfecb9ee46b4a5bd1184',
  'conditional-consistency.en': '5d24f0d566cbcfb8bba47c43336e12afe7424137424294182bfffe81bf827e1a',
  'conditional-consistency.zh-cn':
    '9eaaf1b5c7f69ca6fe8cdbe6808d43695b1115830d83b003849c7ba15a529fb7',
  'evolution-feedback.en': 'f1e5ba376b02f75430ba0efd0f4779bf7687eacc3d0c59b02ce3902f5ea04041',
  'evolution-feedback.zh-cn': '81dcdabdbed66da7c7042b5584f48726e4b6cfa706911832a1ce91bcfcd78f9b',
  'switch-activation.en': '3552003db261bc795a2ff74976334563b9be4293dbbf14a7b2e853479d9a1232',
  'switch-activation.zh-cn': '11c193fd5aeb9132422d0ac6af69c99f2cf718d01201c60d794e53dadae8cce4',
};

test('the whitepaper generator reproduces exactly its sixteen owned bilingual assets', async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'pui-whitepaper-diagrams-'));
  try {
    await mkdir(path.join(temporary, 'scripts'));
    const copy = path.join(temporary, 'scripts/generate-whitepaper-diagrams.mjs');
    await writeFile(copy, await readFile(generator));
    await writeFile(
      path.join(temporary, 'scripts/whitepaper-diagram-fonts.json'),
      await readFile(
        new URL('../../../apps/www/scripts/whitepaper-diagram-fonts.json', import.meta.url)
      )
    );
    execFileSync(process.execPath, [copy]);
    const generated = path.join(temporary, 'public/diagrams');
    const names = await readdir(generated);
    assert.deepEqual(
      names.sort(),
      [
        ...Object.keys(desktopSha256).map((name) => `whitepaper-${name}.svg`),
        ...['component-anatomy', 'switch-activation', 'conditional-consistency'].flatMap((figure) =>
          ['en', 'zh-cn'].map((locale) => `whitepaper-${figure}.mobile.${locale}.svg`)
        ),
        'whitepaper-evolution-feedback.mobile.en.svg',
        'whitepaper-evolution-feedback.mobile.zh-cn.svg',
      ].sort()
    );
    for (const name of names) {
      const bytes = await readFile(path.join(generated, name));
      const originalHash = desktopSha256[name.replace(/^whitepaper-/, '').replace(/\.svg$/, '')];
      if (originalHash) {
        assert.equal(createHash('sha256').update(bytes).digest('hex'), originalHash, name);
      }
      assert.equal(bytes.toString('utf8'), await readFile(new URL(name, diagrams), 'utf8'), name);
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

for (const locale of ['en', 'zh-cn']) {
  test(`Switch activation retains owner, channel and explicit-effect claims (${locale})`, async () => {
    const svg = await readFile(
      new URL(`whitepaper-switch-activation.${locale}.svg`, diagrams),
      'utf8'
    );
    assert.match(svg, /viewBox="0 0 960 920"/);
    assert.match(svg, /aria-labelledby="title" aria-describedby="description"/);
    assert.match(svg, /<title id="title">[^<]+<\/title>/);
    assert.match(svg, /<desc id="description">[^<]+<\/desc>/);
    for (const label of [
      'User',
      'Switch Root',
      'App Maker',
      'Switch Thumb',
      'Event · activate',
      'Expose',
      'Context',
      'nextChecked = !checked',
      'checked ← nextChecked',
    ]) {
      assert.ok(svg.includes(label), label);
    }
    assert.match(svg, locale === 'en' ? /The sole owner of checked/ : /checked 的唯一 owner/);
    assert.match(
      svg,
      locale === 'en' ? /Request Root’s Feedback refresh/ : /请求 Root 的 Feedback 重新求值/
    );
    assert.match(
      svg,
      locale === 'en' ? /not synchronous callback timing/ : /不规定 callback 的同步时序/
    );
    // The output uses one owner enclosure, no repeated step cards, and separate
    // outgoing Expose and Context edges. These guards do not replace visual review.
    assert.equal([...svg.matchAll(/<rect\b/g)].length, 0);
    assert.equal([...svg.matchAll(/data-owner="root"/g)].length, 1);
    const edges = [...svg.matchAll(/data-edge="([^"]+)"[^>]*marker-end="url\(#hand-arrow\)"/g)].map(
      (m) => m[1]
    );
    assert.deepEqual(edges, [
      'event-to-root',
      'root-step-1-to-2',
      'root-step-2-to-3',
      'root-step-3-to-4',
      'expose-to-maker',
      'context-to-thumb',
    ]);
    // Only this generator-owned static output is checked; this is not a general
    // SVG parser or a replacement for the independent public-SVG admission work.
    assert.doesNotMatch(svg, /<script\b|<foreignObject\b|\son[a-z]+\s*=|(?:href|src)\s*=/i);
  });
}

for (const locale of ['en', 'zh-cn']) {
  for (const variant of ['', '.mobile']) {
    test(`Evolution metadata retains concurrent work and alternative revisions (${locale}${variant})`, async () => {
      const svg = await readFile(
        new URL(`whitepaper-evolution-feedback${variant}.${locale}.svg`, diagrams),
        'utf8'
      );
      const root = svg.match(/^<svg\b[^>]*>/)?.[0];
      assert.ok(root);
      assert.match(root, /role="img" aria-labelledby="title" aria-describedby="description"/);
      // Marker paint must inherit the same theme variables as the diagram wires.
      assert.match(svg, /<g class="evo-root">\s*<defs>[\s\S]*?<marker id="evo-arrow-sm"/);
      assert.ok(root.includes(`xml:lang="${locale}"`));
      for (const id of ['title', 'description']) {
        assert.equal([...svg.matchAll(new RegExp(`\\bid="${id}"`, 'g'))].length, 1, id);
      }
      assert.equal([...svg.matchAll(/<title\b/g)].length, 1);
      assert.equal([...svg.matchAll(/<desc\b/g)].length, 1);
      const titles = [...svg.matchAll(/<title\b[^>]*>([^<]+)<\/title>/g)];
      assert.equal(titles.length, 1);
      assert.equal(
        titles[0][1],
        locale === 'en' ? 'How practice revises the current approximation' : '实践怎样修正当前近似'
      );
      assert.match(svg, /<title id="title">/);
      const descriptions = [...svg.matchAll(/<desc\b[^>]*>([^<]+)<\/desc>/g)];
      assert.equal(descriptions.length, 1);
      assert.match(svg, /<desc id="description">/);
      const description = descriptions[0][1];
      const relations =
        locale === 'en'
          ? [
              'Theory and kernel, prototype libraries, and the translation layer advance concurrently.',
              'Implementations, conformance tests, and real use provide evidence for diagnosis:',
              'implementation drift calls for an implementation fix',
              'a Host capability gap calls for improved translation',
              'omitted necessary semantics or a definition overfitted to a class of Host calls for a Prototype revision',
              'a counterexample to fundamental relations calls for reexamining the theory',
              'These are alternative diagnoses, not sequential stages.',
              'Revise the relevant layer explicitly and test again;',
              'implementation behavior does not silently become a rule.',
            ]
          : [
              '理论与内核、原型库和翻译层并行推进。',
              '实现、符合性测试与真实使用提供归因证据：',
              '实现偏差需要修正实现',
              'Host 能力缺口需要补足翻译能力',
              '必要语义遗漏或定义对某类 Host 过拟合需要修正 Prototype',
              '基础关系出现反例需要重新检查理论',
              '这些是不同的归因方向，不是依次完成的阶段。',
              '明确修正对应层并重新检验；',
              '实现结果不会静默成为新标准。',
            ];
      for (const relation of relations) assert.ok(description.includes(relation), relation);
      // These generated-document assertions do not establish how a screen reader
      // exposes SVG metadata through the chapter's separate <img> embedding.
      assert.doesNotMatch(svg, /<script\b|<foreignObject\b|\son[a-z]+\s*=|(?:href|src)\s*=/i);
    });
  }
}

// Font data is pinned, locally embedded and limited to this figure's visible glyphs.
test('handwritten font subsets cover visible labels and retain content hashes', async () => {
  const { fonts, upstreamCommit } = JSON.parse(
    await readFile(
      new URL('../../../apps/www/scripts/whitepaper-diagram-fonts.json', import.meta.url),
      'utf8'
    )
  );
  assert.equal(upstreamCommit, '214cd6e6e8ac3ad6b68486aa7aa7241abdf9445f');
  for (const font of fonts) {
    const bytes = Buffer.from(font.woff2, 'base64');
    assert.equal(bytes.subarray(0, 4).toString(), 'wOF2');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), font.sha256);
    assert.ok(font.sources.length > 0);
  }
  for (const locale of ['en', 'zh-cn'])
    for (const variant of ['', '.mobile']) {
      const svg = await readFile(
        new URL(`whitepaper-switch-activation${variant}.${locale}.svg`, diagrams),
        'utf8'
      );
      const usedFonts = fonts.filter((font) => locale === 'zh-cn' || font.family.endsWith('Latin'));
      const covered = new Set(usedFonts.flatMap((font) => font.codepoints));
      const labels = [...svg.matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)]
        .map((m) =>
          m[1]
            .replaceAll('&amp;', '&')
            .replaceAll('&lt;', '<')
            .replaceAll('&gt;', '>')
            .replaceAll('&quot;', '"')
        )
        .join('');
      for (const c of labels)
        assert.ok(covered.has(c.codePointAt(0)) || c === '←', `Uncovered ${locale} glyph: ${c}`);
      for (const font of usedFonts) assert.ok(svg.includes(font.woff2), font.family);
      if (locale === 'en')
        assert.ok(!svg.includes(fonts.find((font) => font.family.endsWith('CJK')).woff2));
    }
});

// Proposed visual-label guard. Real article/Dialog renders still decide readability.
for (const locale of ['en', 'zh-cn']) {
  test(`Evolution visible labels retain the fixed canvas and larger type (${locale})`, async () => {
    const svg = await readFile(
      new URL(`whitepaper-evolution-feedback.${locale}.svg`, diagrams),
      'utf8'
    );
    assert.match(svg, /viewBox="0 0 960 928"/);
    const alternatives = svg.slice(
      svg.indexOf('<g data-alternatives="diagnoses">'),
      svg.indexOf('<path data-relation="revision-loop"')
    );
    assert.match(
      alternatives,
      /<rect x="80" y="496" width="856" height="376"[^>]+class="evo-zone"/
    );
    assert.doesNotMatch(alternatives, /<path\b/, 'the diagnoses are alternatives, not stages');
    assert.match(
      svg,
      /data-relation="revision-loop" data-from="diagnoses" data-to="work" d="M80 684 /
    );
    const sizes = [...svg.matchAll(/<text\b[^>]*font-size="([0-9.]+)"/g)].map((m) => Number(m[1]));
    assert.ok(sizes.length > 0);
    assert.ok(
      sizes.every((size) => size >= 36),
      'visible labels at least 36 SVG units'
    );
    for (const label of locale === 'en'
      ? [
          'Three concurrent lines of work',
          'Practice provides evidence',
          'Which layer needs revision?',
          'Implementation drift',
          'Host capability gap',
          'Omission or overfitting',
          'Relation challenged',
          'Revise explicitly, then test again.',
        ]
      : [
          '三条主线并行推进',
          '实践提供证据',
          '归因：哪一层需要修正？',
          '实现偏差',
          'Host 能力缺口',
          '义务遗漏或过拟合',
          '基础关系出现反例',
          '明确修正，再次检验。',
        ]) {
      assert.ok(svg.includes(label), label);
    }
  });
}

for (const locale of ['en', 'zh-cn']) {
  test(`Evolution mobile preserves parallel work, alternatives and readable type (${locale})`, async () => {
    const svg = await readFile(
      new URL(`whitepaper-evolution-feedback.mobile.${locale}.svg`, diagrams),
      'utf8'
    );
    const desktop = await readFile(
      new URL(`whitepaper-evolution-feedback.${locale}.svg`, diagrams),
      'utf8'
    );
    assert.match(svg, /width="500" height="1000" viewBox="0 0 500 1000"/);
    assert.match(svg, /data-layout="mobile"/);
    assert.equal(
      svg.match(/<desc id="description">[\s\S]*?<\/desc>/)[0],
      desktop.match(/<desc id="description">[\s\S]*?<\/desc>/)[0]
    );
    const sizes = [...svg.matchAll(/<text\b[^>]*font-size="([0-9.]+)"/g)].map((match) =>
      Number(match[1])
    );
    assert.ok(sizes.length > 0 && sizes.every((size) => size >= 26));

    const lanes = ['theory-kernel', 'prototype-libraries', 'translation-layer'];
    for (const [index, lane] of lanes.entries()) {
      const group = svg.match(new RegExp(`<g data-node="${lane}">([\\s\\S]*?)<\\/g>`))?.[1];
      assert.ok(group, lane);
      const [x, width] = [
        [32, 140],
        [188, 140],
        [342, 144],
      ][index];
      assert.ok(group.includes(`<rect x="${x}" y="108" width="${width}" height="116"`));
    }
    assert.deepEqual(
      [...svg.matchAll(/data-node="([^"]+)"/g)].map((match) => match[1]),
      [...lanes, 'practice-evidence']
    );
    assert.equal([...svg.matchAll(/data-alternatives="diagnoses"/g)].length, 1);
    assert.deepEqual(
      [...svg.matchAll(/data-diagnosis="([^"]+)"/g)].map((match) => match[1]),
      ['implementation', 'host-capability', 'prototype', 'theory']
    );
    for (const [index, diagnosis] of [
      'implementation',
      'host-capability',
      'prototype',
      'theory',
    ].entries()) {
      const group = svg.match(
        new RegExp(`<g data-diagnosis="${diagnosis}">([\\s\\S]*?)<\\/g>`)
      )?.[1];
      assert.ok(group?.includes(`<rect x="44" y="${488 + 100 * index}" width="428" height="92"`));
      assert.doesNotMatch(group, /<path\b/);
    }
    const alternatives = svg.slice(
      svg.indexOf('<g data-alternatives="diagnoses">'),
      svg.indexOf('<path data-relation="revision-loop"')
    );
    assert.doesNotMatch(alternatives, /<path\b/, 'no edges sequence the diagnosis cards');
    const edges = [
      ...svg.matchAll(
        /<path data-relation="([^"]+)" data-from="([^"]+)" data-to="([^"]+)" d="([^"]+)"/g
      ),
    ].map((match) => match.slice(1));
    assert.equal([...svg.matchAll(/<path\b[^>]*class="evo-wire"/g)].length, edges.length);
    assert.deepEqual(
      edges.map(([relation, from, to]) => [relation, from, to]),
      [
        ['work-exchange', lanes[0], lanes[1]],
        ['work-exchange', lanes[1], lanes[0]],
        ['work-exchange', lanes[1], lanes[2]],
        ['work-exchange', lanes[2], lanes[1]],
        ...lanes.map((lane) => ['practice-input', lane, 'practice-evidence']),
        ['evidence-entry', 'work', 'practice-evidence'],
        ['diagnose', 'practice-evidence', 'diagnoses'],
        ['revision-loop', 'diagnoses', 'work'],
        ...lanes.map((lane) => ['revision-return', 'diagnoses', lane]),
      ]
    );
    assert.deepEqual(
      edges.filter(([relation]) => relation === 'revision-return').map((edge) => edge[3]),
      ['M102 94 V105', 'M258 94 V105', 'M414 94 V105']
    );
    // Card contents carry condition and action. No path connects one diagnosis to another.
    for (const label of locale === 'en'
      ? [
          'Three concurrent lines of work',
          'Alternative diagnoses, not stages',
          'Implementation drift',
          'Fix implementation',
          'Host capability gap',
          'Improve translation',
          'Omission or overfitting',
          'Revise the Prototype',
          'Relation challenged',
          'Revisit the theory',
          'Revise, then test again.',
          'No silent rule changes.',
        ]
      : [
          '三条主线并行推进',
          '不同归因，并非先后阶段',
          '实现偏差',
          '修正实现',
          'Host 能力缺口',
          '补足翻译能力',
          '义务遗漏或过拟合',
          '修正 Prototype',
          '基础关系出现反例',
          '重审理论',
          '明确修正，再次检验。',
          '实现结果不静默成为标准。',
        ]) {
      assert.ok(svg.includes(label), label);
    }
    assert.doesNotMatch(
      svg,
      /@font-face|<script\b|<foreignObject\b|\son[a-z]+\s*=|(?:href|src)\s*=/i
    );
  });
}

// Responsive presentation must retain independent ownership and timing claims.
for (const locale of ['en', 'zh-cn']) {
  for (const [figure, height] of [
    ['component-anatomy', 1740],
    ['switch-activation', 1740],
    ['conditional-consistency', 1920],
  ]) {
    test(figure + ' mobile preserves the complete semantic ledger (' + locale + ')', async () => {
      const svg = await readFile(
        new URL('whitepaper-' + figure + '.mobile.' + locale + '.svg', diagrams),
        'utf8'
      );
      const desktop = await readFile(
        new URL('whitepaper-' + figure + '.' + locale + '.svg', diagrams),
        'utf8'
      );
      assert.ok(
        svg.includes('width="500" height="' + height + '" viewBox="0 0 500 ' + height + '"')
      );
      assert.match(svg, /data-layout="mobile"/);
      assert.match(svg, /aria-labelledby="title" aria-describedby="description"/);
      assert.equal(
        svg.match(/<desc id="description">[\s\S]*?<\/desc>/)[0],
        desktop.match(/<desc id="description">[\s\S]*?<\/desc>/)[0],
        'Responsive presentation must not drop any ownership, timing or evidence qualification'
      );
      const sizes = [...svg.matchAll(/<text\b[^>]*font-size="([0-9.]+)"/g)].map((m) =>
        Number(m[1])
      );
      assert.ok(sizes.length > 0 && sizes.every((size) => size >= 26));
      assert.doesNotMatch(svg, /<script\b|<foreignObject\b|\son[a-z]+\s*=|(?:href|src)\s*=/i);
      const visible = [...svg.matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)]
        .map((m) =>
          m[1]
            .replaceAll('&amp;', '&')
            .replaceAll('&lt;', '<')
            .replaceAll('&gt;', '>')
            .replaceAll('&quot;', '"')
        )
        .join(' ')
        .replace(/\s+/g, ' ');
      if (figure === 'component-anatomy') {
        assert.deepEqual(
          [...svg.matchAll(/data-part="([^"]+)"/g)].map((m) => m[1]),
          ['switch-root', 'switch-thumb', 'select-root', 'trigger', 'value', 'content', 'item']
        );
        assert.match(svg, /data-relation="context" data-from="switch-root" data-to="switch-thumb"/);
        assert.equal([...svg.matchAll(/data-example="fixed-caret"/g)].length, 1);
        assert.doesNotMatch(
          svg,
          /data-part="[^"]*caret[^"]*"/i,
          'A boundary example must not become a new Base Select part'
        );
        for (const label of locale === 'en'
          ? [
              'Root: sole owner of checked',
              'Root handles activation',
              'Thumb: derived display state',
              'Two Components, one Switch',
              'Each has independent relations',
              'Fixed Caret: Feedback only',
              'May remain inside Trigger',
              'Own Event / Props / Expose or Context: a separate Component.',
              'not a new Base Select part.',
              'This does not prescribe a Host tree.',
            ]
          : [
              'Root：checked 的唯一 owner',
              '由 Root 处理 activation',
              'Thumb：派生展示状态',
              '两个 Component，一个 Switch',
              '各自承担独立交互关系',
              '固定 Caret：只有 Feedback',
              '可以附属于 Trigger',
              '独立的 Event / Props / Expose 或 Context： 需要独立 Component。',
              '不是新增的 Base Select part；',
              '结构示意不规定实际 Host tree。',
            ])
          assert.ok(visible.includes(label), label);
        assert.equal([...svg.matchAll(/data-node="/g)].length, 2);
      } else if (figure === 'switch-activation') {
        assert.deepEqual(
          [...svg.matchAll(/data-owner="([^"]+)"/g)].map((m) => m[1]),
          ['root', 'maker', 'thumb']
        );
        assert.equal(
          [...svg.matchAll(/<rect\b/g)].length,
          0,
          'Keep the existing hand-drawn owner treatment'
        );
        assert.deepEqual(
          [...svg.matchAll(/data-edge="([^"]+)"[^>]*marker-end="url\(#hand-arrow\)"/g)].map(
            (m) => m[1]
          ),
          [
            'event-to-root',
            'root-step-1-to-2',
            'root-step-2-to-3',
            'root-step-3-to-4',
            'expose-to-maker',
            'context-to-thumb',
          ]
        );
        for (const label of [
          'Event · activate',
          'nextChecked = !checked',
          'checked ← nextChecked',
          'checked / disabled',
          ...(locale === 'en'
            ? [
                'Uncontrolled and enabled',
                'The sole owner of checked',
                'Emit checkedChange',
                'Request Root’s Feedback refresh',
                'Receive Context',
                'Store derived state',
                'Request its own Feedback refresh',
                'Root and Thumb request their effects explicitly.',
                'Cross-component arrows show channels, not synchronous callback timing.',
              ]
            : [
                '非受控、未禁用',
                'checked 的唯一 owner',
                '发出 checkedChange',
                '请求 Root 的 Feedback 重新求值',
                '接收 Context',
                '保存派生展示状态',
                '请求自己的 Feedback 重新求值',
                '对外效果由 Root 与 Thumb 分别显式发起。',
                '跨组件箭头表示信息通路， 不规定 callback 的同步时序。',
              ]),
        ])
          assert.ok(visible.includes(label), label);
        assert.equal([...svg.matchAll(/data-node="/g)].length, 0);
      } else {
        assert.deepEqual(
          [...svg.matchAll(/data-comparison="([^"]+)"/g)].map((m) => m[1]),
          ['input-feedback', 'normalized-dom', 'pixels']
        );
        assert.deepEqual(
          [...svg.matchAll(/data-relation="([^"]+)" data-from="([^"]+)" data-to="([^"]+)"/g)].map(
            (m) => m.slice(1)
          ),
          ['input-feedback', 'normalized-dom', 'pixels'].map((id) => [
            'permits-comparison',
            id + '-conditions',
            id + '-result',
          ])
        );
        assert.equal(
          [...svg.matchAll(/<path\b[^>]*class="line/g)].length,
          3,
          'No path must imply promotion between comparison rows'
        );
        for (const label of [
          'Prototype / applicable profile',
          'Normalized DOM',
          'tolerance / exclusion',
          ...(locale === 'en'
            ? [
                'Identity · channels',
                'State transitions · lifecycle order',
                'required Feedback',
                'Input behavior and Feedback',
                'Same Web family; governed',
                'and projection policy',
                'unit scale, font shaping,',
                'color, rasterization',
                'Pixel output',
                'reasons and scope in advance.',
                'These are conditions, not tiers.',
                'They do not imply complete evidence across Hosts.',
              ]
            : [
                '身份 · 通路 · State transition',
                'Lifecycle order · 必需 Feedback',
                '输入行为与 Feedback',
                '同属 Web family；共享受治理的',
                '与 projection policy',
                '单位比例、字体 shaping、',
                '像素表现',
                '需预先约定。',
                '这些条件不是自动晋级的等级。',
                '本图不代表已有完整跨 Host 证据。',
              ]),
        ])
          assert.ok(visible.includes(label), label);
        assert.equal([...svg.matchAll(/data-node="/g)].length, 4);
      }
    });
  }
}
