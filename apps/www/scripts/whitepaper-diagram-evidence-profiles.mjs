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

// Keep assets explicit: neither an environment value nor a URL supplies a path.
const variant = (name, asset, width, height) => Object.freeze({ name, asset, width, height });
const assets = Object.freeze({
  'switch-activation': Object.freeze({
    en: Object.freeze([
      variant('desktop', '/diagrams/whitepaper-switch-activation.en.svg', 960, 920),
    ]),
    'zh-cn': Object.freeze([
      variant('desktop', '/diagrams/whitepaper-switch-activation.zh-cn.svg', 960, 920),
    ]),
  }),
  'evolution-feedback': Object.freeze({
    en: Object.freeze([
      variant('desktop', '/diagrams/whitepaper-evolution-feedback.en.svg', 960, 928),
      variant('mobile', '/diagrams/whitepaper-evolution-feedback.mobile.en.svg', 500, 1000),
    ]),
    'zh-cn': Object.freeze([
      variant('desktop', '/diagrams/whitepaper-evolution-feedback.zh-cn.svg', 960, 928),
      variant('mobile', '/diagrams/whitepaper-evolution-feedback.mobile.zh-cn.svg', 500, 1000),
    ]),
  }),
});
const viewport = (width, height) => Object.freeze({ width, height });
const standardCases = Object.freeze([
  Object.freeze({ scenario: 'standard', viewport: viewport(1440, 1000) }),
  Object.freeze({ scenario: 'standard', viewport: viewport(390, 844) }),
]);
const evolutionCases = Object.freeze([
  ...standardCases,
  Object.freeze({ scenario: 'boundary-639', viewport: viewport(639, 1000) }),
  Object.freeze({ scenario: 'boundary-640', viewport: viewport(640, 1000) }),
  Object.freeze({
    scenario: 'resize-to-mobile',
    initialViewport: viewport(1440, 1000),
    viewport: viewport(390, 844),
  }),
  Object.freeze({
    scenario: 'resize-to-desktop',
    initialViewport: viewport(390, 844),
    viewport: viewport(1440, 1000),
  }),
  // The 390 x 844 device rotated. Record the fit; do not promise 16 px labels.
  Object.freeze({ scenario: 'landscape-390', viewport: viewport(844, 390) }),
]);

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
    asset: assets[profile.figure][locale][0].asset,
    route: `/${locale}/whitepaper/${profile.chapter}/`,
  });
}

export function diagramVariants(profile, locale) {
  diagramLocale(profile, locale);
  return assets[profile.figure][locale];
}

export function selectDiagramVariant(profile, locale, width) {
  const variants = diagramVariants(profile, locale);
  assert.ok(Number.isSafeInteger(width) && width > 0, 'Invalid viewport width');
  const name = profile.figure === 'evolution-feedback' && width <= 639 ? 'mobile' : 'desktop';
  return variants.find((item) => item.name === name);
}

export function diagramEvidenceCases(profile) {
  assert.equal(selectDiagramProfile(profile?.figure), profile, 'Use an allowlisted profile');
  return profile.figure === 'evolution-feedback' ? evolutionCases : standardCases;
}

export function diagramEvidenceId(profile, locale, theme, width, revision, svgSha256, scenario = 'standard') {
  diagramLocale(profile, locale);
  assert.ok(theme === 'light' || theme === 'dark', 'Unsupported evidence theme');
  assert.ok(
    diagramEvidenceCases(profile).some(
      (item) => item.scenario === scenario && item.viewport.width === width
    ),
    'Unsupported evidence viewport or scenario'
  );
  assert.match(revision, /^[a-f0-9]{40}$/);
  assert.match(svgSha256, /^[a-f0-9]{64}$/);
  if (profile.figure === 'evolution-feedback') {
    const selected = selectDiagramVariant(profile, locale, width);
    return `${profile.figure}-${selected.name}-${locale}-${theme}-${width}-${scenario}-${revision}-${svgSha256}`;
  }
  return `${profile.figure}-${locale}-${theme}-${width}-${revision}-${svgSha256}`;
}
