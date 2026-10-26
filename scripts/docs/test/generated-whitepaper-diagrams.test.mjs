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

// The responsive addition must not redraw the eight existing cd3b03a assets.
const desktopSha256 = {
  'component-anatomy.en': 'b9a92f31f47aa90da0249071cfca23adadc51ac526c1dda3b0b4e3abbca3ee3f',
  'component-anatomy.zh-cn': 'e20a501f9d1ffa17255aeb25b2d3282dd370cb8e43a63bb2f257bd7b15754056',
  'conditional-consistency.en': 'd2d41bfbf0f846c081663713365e6bbcc332c19beedbb50639013f81e1f80a8a',
  'conditional-consistency.zh-cn':
    '50faabe7b5ca4c8ce39042bf49efb94b50da5c71076846c24afc5c46bad7e9a6',
  'evolution-feedback.en': 'd1b31fde58a0866b8a8a7c77d01ef6f25cd3209505c847532930a31b55ad6682',
  'evolution-feedback.zh-cn': 'e6331476ff25de268950ccfb3fcc4f481f495c69b54432459a2baaf52b95ad69',
  'switch-activation.en': '3552003db261bc795a2ff74976334563b9be4293dbbf14a7b2e853479d9a1232',
  'switch-activation.zh-cn': '11c193fd5aeb9132422d0ac6af69c99f2cf718d01201c60d794e53dadae8cce4',
};

test('the whitepaper generator reproduces exactly its ten owned bilingual assets', async () => {
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
  for (const locale of ['en', 'zh-cn']) {
    const svg = await readFile(
      new URL(`whitepaper-switch-activation.${locale}.svg`, diagrams),
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
      assert.ok(group.includes(`<rect x="${32 + 156 * index}" y="108" width="140" height="116"`));
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
      assert.ok(group?.includes(`<rect x="44" y="${472 + 100 * index}" width="428" height="88"`));
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
    assert.equal([...svg.matchAll(/<path\b[^>]*class="line"/g)].length, edges.length);
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
