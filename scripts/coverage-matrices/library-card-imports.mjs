// Source-reviewed library entry composition. Exact file bytes and import
// strings only; no family/directory exemption or stable lifecycle promotion.
// Owner: www.gallery.ui-library-cards. Shared server closure is separately
// owned by www.build.style-generation through startup-prerender-imports.mjs.
// Source/edge reconciliation at main 248f8270d is recorded in
// internal/records/2026-11-24-main-website-boundary-repair.json.
import { SYNCHRONOUS_STEPS_SOURCE_CLOSURE } from './synchronous-steps-imports.mjs';

export const LIBRARY_CARD_IMPORT_ALLOWLIST = Object.freeze({
  // Exact compatibility re-export for the existing all-step teardown owner.
  'packages/adapters/base/src/host/synchronous-steps.ts': Object.freeze({
    sourceSha256: 'ebfcf79bfb3d09c1644edb81b32e876796f84c75f8831c631b7fcfd3a63262de',
    companionSources: SYNCHRONOUS_STEPS_SOURCE_CLOSURE,
    specifiers: Object.freeze(['@proto.ui/core/internal']),
  }),
  'packages/adapters/base/src/material/geometry-watch.ts': Object.freeze({
    sourceSha256: '258a99fb6f4f40aaa0276bef7c633126fb1c295af83f19a2bb3b55d20a8a6966',
    specifiers: Object.freeze(['./paint-mutations']),
  }),
  'packages/adapters/base/src/material/contact-motion.ts': Object.freeze({
    sourceSha256: '3c037b199f60e74e7b1ff259996fed9d292eb7ab4eeb45f4ff6a155bc8ef7cbe',
    specifiers: Object.freeze(['../events/pointer-contact', './program']),
  }),
  'packages/adapters/base/src/material/initial-paint-bridge.ts': Object.freeze({
    sourceSha256: 'b9753d61a404049a90dbe9e9ef3ede552ec7895c91183b0608a249ec9d9ee1da',
    specifiers: Object.freeze(['@proto.ui/module-feedback', './program']),
  }),
  'packages/adapters/base/src/material/initial-paint-receipt.ts': Object.freeze({
    sourceSha256: '26a4568ffe77dd689f1516ec50935e23bfb854490cf98a204583f986d690ecb6',
    specifiers: Object.freeze(['@proto.ui/module-feedback', './program', './style']),
  }),
  'packages/adapters/base/src/material/preferences.ts': Object.freeze({
    sourceSha256: 'b1ffcdca8b3b58ff4ba7f9edc6d9dd8595b1e99b513fa7e71086af14759b533f',
    specifiers: Object.freeze(['@proto.ui/module-feedback/internal/shared-policy']),
  }),
  'packages/adapters/base/src/material/sink.ts': Object.freeze({
    sourceSha256: '6ad0b1c37967d3ac6aff3de80fc9492f99b727887fd1987e0f013e819931f2fe',
    companionSource: Object.freeze({
      path: 'packages/adapters/base/src/host/synchronous-steps.ts',
      sha256: 'ebfcf79bfb3d09c1644edb81b32e876796f84c75f8831c631b7fcfd3a63262de',
    }),
    specifiers: Object.freeze([
      '../host/synchronous-steps',
      './initial-paint-bridge',
      './paint-mutations',
      '../events/pointer-contact',
      './contact-motion',
      './contact-carrier',
      './contact-profile',
      './paint-reservation',
      './style-tint-profile',
      './image-prepare',
      './geometry-watch',
      '@proto.ui/core',
      '@proto.ui/module-feedback',
      '@proto.ui/module-feedback/internal/shared-policy',
      './source',
      './preferences',
      './program',
      './program-inputs',
      './source-refresh-task',
      './program-pool',
      './style',
    ]),
  }),
  // Exact lazy geometry consumer of the shared physical lease owner.
  // Its source admission does not permit geometry in a public shell bundle.
  'packages/adapters/base/src/material/paint-reservation.ts': Object.freeze({
    sourceSha256: '09845878f6672da933ac8a1cf4bc529962ea6cbfe7ed4e010737a283ba382622',
    specifiers: Object.freeze(['../platform/web-material-paint-reservation', './border-outline']),
  }),
  // The reviewed synchronous ref/lease owner keeps the original public callback
  // and one private registry. No optical geometry or additional raw API is admitted.
  'packages/adapters/base/src/platform/web-material-paint-reservation.ts': Object.freeze({
    sourceSha256: 'dc3e8851ed9ed863b59072d4ae21122710dc09e13d3d389774d0b52cd595f7c8',
    specifiers: Object.freeze(['@proto.ui/core', '@proto.ui/module-feedback']),
  }),
  // Promote the existing contact-carrier edge to a complete source binding.
  // The two new helpers preserve bounded canvas admission and all-step cleanup.
  'packages/adapters/base/src/material/source.ts': Object.freeze({
    sourceSha256: '6ff1e20429691dcfcff2be4685ceb685321df7e0156e6c8dada2c4c1d05aed1d',
    companionSource: Object.freeze({
      path: 'packages/adapters/base/src/host/synchronous-steps.ts',
      sha256: 'ebfcf79bfb3d09c1644edb81b32e876796f84c75f8831c631b7fcfd3a63262de',
    }),
    specifiers: Object.freeze([
      '../host/synchronous-steps',
      './border-outline',
      './contact-carrier',
    ]),
  }),
  'packages/adapters/base/src/material/initial-paint-experiment.ts': Object.freeze({
    sourceSha256: 'ab70cf1a0698f1b0dab6c581dbf33cc66f46d30b74051e3a1685379d5ae69952',
    specifiers: Object.freeze([
      '@proto.ui/module-feedback',
      './program',
      './sink',
      './source',
      './preferences',
      './style',
      './initial-paint-receipt',
      './initial-paint-bridge',
    ]),
  }),
  'apps/www/src/components/library-liquid-scene.ts': Object.freeze({
    sourceSha256: 'd8ccbb061715254ca258abef8e686561aa87cafd9327d84d7a789e8759740a0b',
    specifiers: Object.freeze([
      '@proto.ui/core',
      '@proto.ui/module-feedback',
      '@proto.ui/adapter-base/web-material',
      '../../../../packages/adapters/base/src/material/initial-paint-experiment',
      '../../../../packages/prototypes/liquid-glass/src/theme',
    ]),
  }),
  'apps/www/src/components/library-liquid-card-client.ts': Object.freeze({
    sourceSha256: 'a706b27a7331bef6fb27828a4b6964dc5d0cc3e9eff1b07312d70a850f11261f',
    specifiers: Object.freeze(['@proto.ui/adapter-web-component']),
  }),
  'apps/www/src/components/UiLibraryGallery.astro': Object.freeze({
    sourceSha256: 'b93920864a23913c3f752b748c30a32c5f4bafda35b83d0065d26ce8861a4a19',
    specifiers: Object.freeze([
      '../../../../packages/prototypes/brutalist/src/theme',
      '../../../../packages/prototypes/bootstrap-2-3-2/src/theme',
      '../../../../packages/prototypes/liquid-glass/src/theme',
    ]),
  }),
  'packages/adapters/base/src/material/style-tint-profile.ts': Object.freeze({
    sourceSha256: '2e9bb4ca8c903ec0863f4d5a6b18c7486c609a4ef4e806ba6eaf459cd49003cc',
    specifiers: Object.freeze(['./contact-profile', './liquidgl-kernel.generated', './style']),
  }),
  // Exact consumer-owned withdrawal of the serialized Library SSR style seed.
  // The import is type-only; this grants no general Adapter hydration boundary.
  'apps/www/src/components/library-style-seed.ts': Object.freeze({
    sourceSha256: '74b2ff6fd9a002b7ce64f576c24a6638dea1aaa9cddae7bb9388f2cc6c18e50b',
    specifiers: Object.freeze(['@proto.ui/adapter-web-component']),
  }),
  'apps/www/src/components/library-card-client.ts': Object.freeze({
    sourceSha256: 'a76ff8694ef17cc01d0da51c1e9e8efc5fa7192dec59d916a601c3088f8d3ff3',
    specifiers: Object.freeze(['@proto.ui/adapter-web-component']),
  }),
  'apps/www/src/components/library-card-prototypes.ts': Object.freeze({
    sourceSha256: 'a3b68f1d7e9d8b00a683d826cedd549b73d9fba686c0dbe6a79d13772fbafabf',
    specifiers: Object.freeze([
      '@proto.ui/prototypes-base/surface',
      '@proto.ui/prototypes-base/text',
      '@proto.ui/prototypes-shadcn/surface',
      '@proto.ui/prototypes-shadcn/card',
      '@proto.ui/prototypes-shadcn/text',
      '@proto.ui/prototypes-brutalist/surface',
      '@proto.ui/prototypes-brutalist/text',
      '@proto.ui/prototypes-brutalist/card',
      '@proto.ui/prototypes-bootstrap-2-3-2/surface',
      '@proto.ui/prototypes-bootstrap-2-3-2/text',
      '@proto.ui/prototypes-liquid-glass/surface',
      '@proto.ui/prototypes-liquid-glass/text',
    ]),
  }),
});

// Exact interactive resources reached by the private capture API. Their bytes
// and single blocked Card owner are checked independently of import admission.
export const LIBRARY_CARD_INTERACTIVE_MATERIAL_SOURCES = Object.freeze({
  'packages/adapters/base/src/material/geometry-watch.ts':
    LIBRARY_CARD_IMPORT_ALLOWLIST['packages/adapters/base/src/material/geometry-watch.ts']
      .sourceSha256,
  'packages/adapters/base/src/material/initial-paint-experiment.ts':
    LIBRARY_CARD_IMPORT_ALLOWLIST['packages/adapters/base/src/material/initial-paint-experiment.ts']
      .sourceSha256,
  'packages/adapters/base/src/material/preferences.ts':
    LIBRARY_CARD_IMPORT_ALLOWLIST['packages/adapters/base/src/material/preferences.ts']
      .sourceSha256,
  'packages/adapters/base/src/material/style-tint-profile.ts':
    LIBRARY_CARD_IMPORT_ALLOWLIST['packages/adapters/base/src/material/style-tint-profile.ts']
      .sourceSha256,
});
