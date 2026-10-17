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

test('the whitepaper generator reproduces exactly its eight owned bilingual assets', async () => {
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
    assert.equal(names.length, 8);
    for (const name of names) {
      assert.match(
        name,
        /^whitepaper-(component-anatomy|switch-activation|conditional-consistency|evolution-feedback)\.(en|zh-cn)\.svg$/
      );
      assert.equal(
        await readFile(path.join(generated, name), 'utf8'),
        await readFile(new URL(name, diagrams), 'utf8'),
        name
      );
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
  test(`Evolution metadata retains concurrent work and alternative revisions (${locale})`, async () => {
    const svg = await readFile(
      new URL(`whitepaper-evolution-feedback.${locale}.svg`, diagrams),
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
      locale === 'en'
        ? 'How practice revises the current approximation'
        : '实践怎样修正当前近似'
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
