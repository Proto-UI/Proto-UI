import assert from 'node:assert/strict';

// Only generator-owned diagrams with a reviewed article and typography contract.
// Dimensions: generate-whitepaper-diagrams.mjs; font policy: diagrams/README.md.
const profiles = Object.freeze({
  'switch-activation': Object.freeze({
    figure: 'switch-activation',
    chapter: '4-semantics-beyond-channels',
    width: 960,
    height: 920,
    fonts: 'embedded-handwritten',
  }),
  'evolution-feedback': Object.freeze({
    figure: 'evolution-feedback',
    chapter: '7-evolving-within-boundaries',
    width: 960,
    height: 928,
    fonts: 'system',
  }),
});

export function selectDiagramProfile(selection = 'switch-activation') {
  assert.ok(
    typeof selection === 'string' && Object.hasOwn(profiles, selection),
    'DIAGRAM_EVIDENCE_FIGURE must be switch-activation or evolution-feedback'
  );
  return profiles[selection];
}

export function diagramLocale(profile, locale) {
  assert.equal(selectDiagramProfile(profile?.figure), profile, 'Use an allowlisted profile');
  assert.ok(locale === 'zh-cn' || locale === 'en', 'Unsupported diagram locale');
  return Object.freeze({
    asset: `/diagrams/whitepaper-${profile.figure}.${locale}.svg`,
    route: `/${locale}/whitepaper/${profile.chapter}/`,
  });
}

export function diagramEvidenceId(profile, locale, theme, width, revision, svgSha256) {
  diagramLocale(profile, locale);
  assert.ok(theme === 'light' || theme === 'dark', 'Unsupported evidence theme');
  assert.ok(width === 390 || width === 1440, 'Unsupported evidence viewport');
  assert.match(revision, /^[a-f0-9]{40}$/);
  assert.match(svgSha256, /^[a-f0-9]{64}$/);
  return `${profile.figure}-${locale}-${theme}-${width}-${revision}-${svgSha256}`;
}
