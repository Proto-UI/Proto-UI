import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  selectDiagramProfile,
  diagramLocale,
  diagramVariants,
  selectDiagramVariant,
  diagramEvidenceCases,
  diagramEvidenceId,
} from '../../../apps/www/scripts/whitepaper-diagram-evidence-profiles.mjs';

const revision = 'a'.repeat(40);
const hash = 'b'.repeat(64);

test('Switch remains the bounded default; unknown and path-like selections fail', () => {
  assert.equal(selectDiagramProfile().figure, 'switch-activation');
  for (const invalid of [
    '',
    null,
    [],
    {},
    'all',
    '__proto__',
    'constructor',
    '../evolution-feedback',
    'https://example.com/a.svg',
  ]) {
    assert.throws(() => selectDiagramProfile(invalid), /DIAGRAM_EVIDENCE_FIGURE/);
  }
});

for (const [figure, chapter, height, fonts] of [
  ['switch-activation', '4-semantics-beyond-channels', 920, 'embedded-handwritten'],
  ['evolution-feedback', '7-evolving-within-boundaries', 928, 'system'],
]) {
  test(`${figure} binds both locales to actual authored assets, routes and dimensions`, async () => {
    const profile = selectDiagramProfile(figure);
    assert.deepEqual(profile, { figure, chapter, width: 960, height, fonts });
    assert.ok(Object.isFrozen(profile));
    for (const locale of ['en', 'zh-cn']) {
      const { asset, route } = diagramLocale(profile, locale);
      assert.equal(asset, `/diagrams/whitepaper-${figure}.${locale}.svg`);
      assert.equal(route, `/${locale}/whitepaper/${chapter}/`);
      const svg = await readFile(
        new URL(`../../../apps/www/public${asset}`, import.meta.url),
        'utf8'
      );
      const article = await readFile(
        new URL(
          `../../../apps/www/src/content/docs/${locale}/whitepaper/${chapter}.md`,
          import.meta.url
        ),
        'utf8'
      );
      assert.ok(svg.includes(`width="960" height="${height}" viewBox="0 0 960 ${height}"`));
      assert.ok(article.includes(`src="${asset}"`));
      assert.ok(article.includes(`width="960" height="${height}"`));
      assert.equal(svg.includes('@font-face'), fonts === 'embedded-handwritten');
      assert.doesNotMatch(svg, /<script\b|<foreignObject\b|\son[a-z]+\s*=|(?:href|src)\s*=/i);
    }
    assert.throws(() => diagramLocale(profile, '../en'));
    assert.throws(() => diagramLocale({ ...profile }, 'en'), /allowlisted/);
  });
}

test('only the six explicit profile/locale assets can be selected', async () => {
  const expected = {
    'switch-activation': {
      en: ['/diagrams/whitepaper-switch-activation.en.svg'],
      'zh-cn': ['/diagrams/whitepaper-switch-activation.zh-cn.svg'],
    },
    'evolution-feedback': {
      en: [
        '/diagrams/whitepaper-evolution-feedback.en.svg',
        '/diagrams/whitepaper-evolution-feedback.mobile.en.svg',
      ],
      'zh-cn': [
        '/diagrams/whitepaper-evolution-feedback.zh-cn.svg',
        '/diagrams/whitepaper-evolution-feedback.mobile.zh-cn.svg',
      ],
    },
  };
  for (const [figure, locales] of Object.entries(expected)) {
    const profile = selectDiagramProfile(figure);
    for (const [locale, paths] of Object.entries(locales)) {
      const variants = diagramVariants(profile, locale);
      assert.ok(Object.isFrozen(variants));
      assert.deepEqual(
        variants.map((item) => item.asset),
        paths
      );
      for (const selected of variants) {
        assert.ok(Object.isFrozen(selected));
        assert.equal(selected.width, selected.name === 'mobile' ? 500 : 960);
        assert.equal(selected.height, selected.name === 'mobile' ? 1000 : profile.height);
        const svg = await readFile(
          new URL(`../../../apps/www/public${selected.asset}`, import.meta.url),
          'utf8'
        );
        assert.ok(
          svg.includes(
            `width="${selected.width}" height="${selected.height}" viewBox="0 0 ${selected.width} ${selected.height}"`
          )
        );
        assert.doesNotMatch(svg, /<script\b|<foreignObject\b|\son[a-z]+\s*=|(?:href|src)\s*=/i);
        if (selected.name === 'mobile') {
          const article = await readFile(
            new URL(
              `../../../apps/www/src/content/docs/${locale}/whitepaper/${profile.chapter}.md`,
              import.meta.url
            ),
            'utf8'
          );
          assert.ok(
            article.includes(
              `<source media="(max-width: 639px)" srcset="${selected.asset}" width="500" height="1000"`
            )
          );
          assert.match(article, /<picture>\s*<source[^>]+>\s*<img[^>]+>\s*<\/picture>/);
          assert.match(svg, /data-layout="mobile"/);
          assert.doesNotMatch(svg, /@font-face/);
        }
      }
      assert.throws(() => diagramVariants({ ...profile }, locale), /allowlisted/);
      assert.throws(() => diagramVariants(profile, '../en'));
    }
  }
});

test('responsive selection is width-bound, with an exact 639/640 boundary and no caller asset path', () => {
  const evolution = selectDiagramProfile('evolution-feedback');
  const activation = selectDiagramProfile();
  for (const locale of ['en', 'zh-cn']) {
    for (const width of [1, 390, 639, 640, 844, 1440]) {
      const selected = selectDiagramVariant(evolution, locale, width);
      assert.equal(selected.name, width <= 639 ? 'mobile' : 'desktop');
      assert.equal(selected, diagramVariants(evolution, locale)[width <= 639 ? 1 : 0]);
      assert.equal(
        selectDiagramVariant(activation, locale, width),
        diagramVariants(activation, locale)[0]
      );
    }
    for (const invalid of [0, -1, 639.5, NaN, Infinity, '390', '/diagrams/other.svg', {}]) {
      assert.throws(() => selectDiagramVariant(evolution, locale, invalid), /viewport width/);
    }
  }
});

test('Switch captures stay unchanged; evolution adds bounded resize, boundary and landscape cases', () => {
  const standard = [
    { scenario: 'standard', viewport: { width: 1440, height: 1000 } },
    { scenario: 'standard', viewport: { width: 390, height: 844 } },
  ];
  assert.deepEqual(diagramEvidenceCases(selectDiagramProfile()), standard);
  const cases = diagramEvidenceCases(selectDiagramProfile('evolution-feedback'));
  assert.deepEqual(cases, [
    ...standard,
    { scenario: 'boundary-639', viewport: { width: 639, height: 1000 } },
    { scenario: 'boundary-640', viewport: { width: 640, height: 1000 } },
    {
      scenario: 'resize-to-mobile',
      initialViewport: { width: 1440, height: 1000 },
      viewport: { width: 390, height: 844 },
    },
    {
      scenario: 'resize-to-desktop',
      initialViewport: { width: 390, height: 844 },
      viewport: { width: 1440, height: 1000 },
    },
    { scenario: 'landscape-390', viewport: { width: 844, height: 390 } },
  ]);
  assert.ok(Object.isFrozen(cases));
  for (const item of cases) {
    assert.ok(Object.isFrozen(item) && Object.isFrozen(item.viewport));
    if (item.initialViewport) assert.ok(Object.isFrozen(item.initialViewport));
  }
  assert.throws(() => diagramEvidenceCases({ ...selectDiagramProfile() }), /allowlisted/);
});

test('evidence identities distinguish figure, locale, theme, width, revision and asset', () => {
  const ids = new Set();
  for (const figure of ['switch-activation', 'evolution-feedback']) {
    for (const locale of ['en', 'zh-cn']) {
      for (const theme of ['light', 'dark']) {
        for (const width of [390, 1440]) {
          const id = diagramEvidenceId(
            selectDiagramProfile(figure),
            locale,
            theme,
            width,
            revision,
            hash
          );
          assert.ok(id.includes(revision) && id.includes(hash));
          ids.add(id);
        }
      }
    }
  }
  assert.equal(ids.size, 16);
  const profile = selectDiagramProfile();
  const original = diagramEvidenceId(profile, 'en', 'light', 390, revision, hash);
  assert.equal(original, `switch-activation-en-light-390-${revision}-${hash}`);
  assert.notEqual(original, diagramEvidenceId(profile, 'en', 'light', 390, 'c'.repeat(40), hash));
  assert.notEqual(
    original,
    diagramEvidenceId(profile, 'en', 'light', 390, revision, 'd'.repeat(64))
  );
  assert.throws(() => diagramEvidenceId(profile, 'en', 'light', 800, revision, hash));
  assert.throws(() => diagramEvidenceId(profile, 'en', 'dark', 390, 'HEAD', hash));
  assert.throws(() => diagramEvidenceId(profile, 'en', 'system', 390, revision, hash));
});

test('evolution identities bind variant and scenario as well as selected asset hash', () => {
  const profile = selectDiagramProfile('evolution-feedback');
  const ids = new Set();
  for (const locale of ['en', 'zh-cn']) {
    for (const theme of ['light', 'dark']) {
      for (const { viewport, scenario } of diagramEvidenceCases(profile)) {
        const selected = selectDiagramVariant(profile, locale, viewport.width);
        const id = diagramEvidenceId(
          profile,
          locale,
          theme,
          viewport.width,
          revision,
          hash,
          scenario
        );
        assert.equal(
          id,
          `evolution-feedback-${selected.name}-${locale}-${theme}-${viewport.width}-${scenario}-${revision}-${hash}`
        );
        ids.add(id);
      }
    }
  }
  assert.equal(ids.size, 28);
  assert.throws(() => diagramEvidenceId(profile, 'en', 'light', 390, revision, hash, '../asset'));
  assert.throws(() =>
    diagramEvidenceId(profile, 'en', 'light', 640, revision, hash, 'boundary-639')
  );
  assert.throws(() =>
    diagramEvidenceId(selectDiagramProfile(), 'en', 'light', 639, revision, hash, 'boundary-639')
  );
});

test('runner rejects an unknown selection before dependency, asset or browser initialization', () => {
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(
        new URL(
          '../../../apps/www/scripts/capture-whitepaper-diagram-evidence.mjs',
          import.meta.url
        )
      ),
    ],
    {
      encoding: 'utf8',
      env: { DIAGRAM_EVIDENCE_FIGURE: '../not-allowed' },
    }
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /DIAGRAM_EVIDENCE_FIGURE must be/);
  assert.doesNotMatch(result.stderr, /ERR_MODULE_NOT_FOUND|An absolute evidence directory|ENOENT/);
});
