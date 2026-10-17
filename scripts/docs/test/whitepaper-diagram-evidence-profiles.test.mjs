import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  selectDiagramProfile,
  diagramLocale,
  diagramEvidenceId,
} from '../../../apps/www/scripts/whitepaper-diagram-evidence-profiles.mjs';

const revision = 'a'.repeat(40);
const hash = 'b'.repeat(64);

test('Switch remains the bounded default; unknown and path-like selections fail', () => {
  assert.equal(selectDiagramProfile().figure, 'switch-activation');
  for (const invalid of ['', null, [], {}, 'all', '__proto__', 'constructor', '../evolution-feedback', 'https://example.com/a.svg']) {
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
      const svg = await readFile(new URL(`../../../apps/www/public${asset}`, import.meta.url), 'utf8');
      const article = await readFile(new URL(`../../../apps/www/src/content/docs/${locale}/whitepaper/${chapter}.md`, import.meta.url), 'utf8');
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

test('evidence identities distinguish figure, locale, theme, width, revision and asset', () => {
  const ids = new Set();
  for (const figure of ['switch-activation', 'evolution-feedback']) {
    for (const locale of ['en', 'zh-cn']) {
      for (const theme of ['light', 'dark']) {
        for (const width of [390, 1440]) {
          const id = diagramEvidenceId(selectDiagramProfile(figure), locale, theme, width, revision, hash);
          assert.ok(id.includes(revision) && id.includes(hash));
          ids.add(id);
        }
      }
    }
  }
  assert.equal(ids.size, 16);
  const profile = selectDiagramProfile();
  const original = diagramEvidenceId(profile, 'en', 'light', 390, revision, hash);
  assert.notEqual(original, diagramEvidenceId(profile, 'en', 'light', 390, 'c'.repeat(40), hash));
  assert.notEqual(original, diagramEvidenceId(profile, 'en', 'light', 390, revision, 'd'.repeat(64)));
  assert.throws(() => diagramEvidenceId(profile, 'en', 'light', 800, revision, hash));
  assert.throws(() => diagramEvidenceId(profile, 'en', 'dark', 390, 'HEAD', hash));
  assert.throws(() => diagramEvidenceId(profile, 'en', 'system', 390, revision, hash));
});

test('runner rejects an unknown selection before dependency, asset or browser initialization', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL(
    '../../../apps/www/scripts/capture-whitepaper-diagram-evidence.mjs', import.meta.url
  ))], {
    encoding: 'utf8',
    env: { DIAGRAM_EVIDENCE_FIGURE: '../not-allowed' },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /DIAGRAM_EVIDENCE_FIGURE must be/);
  assert.doesNotMatch(result.stderr, /ERR_MODULE_NOT_FOUND|An absolute evidence directory|ENOENT/);
});
