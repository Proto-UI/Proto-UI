// Source-reviewed library entry composition. Exact file bytes and import
// strings only; no family/directory exemption or stable lifecycle promotion.
// Owner: www.gallery.ui-library-cards. Shared server closure is separately
// owned by www.build.style-generation through startup-prerender-imports.mjs.
export const LIBRARY_CARD_IMPORT_ALLOWLIST = Object.freeze({
  'packages/adapters/base/src/material/geometry-watch.ts': Object.freeze({
    sourceSha256: '258a99fb6f4f40aaa0276bef7c633126fb1c295af83f19a2bb3b55d20a8a6966',
    specifiers: Object.freeze(['./paint-mutations']),
  }),
  'packages/adapters/base/src/material/contact-motion.ts': Object.freeze({
    sourceSha256: 'fccf22b6e0947e260f9a31e898f90af5ef753488ba0406d9a8d40438d89387b6',
    specifiers: Object.freeze(['../events/pointer-contact', './program']),
  }),
  'packages/adapters/base/src/material/initial-paint-bridge.ts': Object.freeze({
    sourceSha256: 'b9753d61a404049a90dbe9e9ef3ede552ec7895c91183b0608a249ec9d9ee1da',
    specifiers: Object.freeze(['@proto.ui/module-feedback', './program']),
  }),
  'packages/adapters/base/src/material/initial-paint-receipt.ts': Object.freeze({
    sourceSha256: 'cbee21d09ff8e43ca7bd0a61e1deb40a2b8c3aa09249550ae8446175e2419155',
    specifiers: Object.freeze(['@proto.ui/module-feedback', './program', './style']),
  }),
  'packages/adapters/base/src/material/preferences.ts': Object.freeze({
    sourceSha256: '65f4f5549fa8c8826f522b34cfd159caa4c05a09bae163196c89a524d3982819',
    specifiers: Object.freeze(['@proto.ui/module-feedback/internal/shared-policy']),
  }),
  'packages/adapters/base/src/material/sink.ts': Object.freeze({
    sourceSha256: 'e94e9a2c7078189f79b44eafa12177ebad4aa3926bd26898b46448f6b10d4635',
    specifiers: Object.freeze([
      './initial-paint-bridge',
      './paint-mutations',
      '../events/pointer-contact',
      './contact-motion',
      './contact-carrier',
      './contact-profile',
      './image-prepare',
      './geometry-watch',
      '@proto.ui/core',
      '@proto.ui/module-feedback',
      '@proto.ui/module-feedback/internal/shared-policy',
      './source',
      './preferences',
      './program',
      './program-pool',
      './style',
    ]),
  }),
  'packages/adapters/base/src/material/initial-paint-experiment.ts': Object.freeze({
    sourceSha256: '4a5526992ba29b83df17917deb7560af47ea7ab7e53a04379535bb354f534451',
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
    sourceSha256: 'a2b9d2019202dea0d1a7f7c6157afef3897a71acadb5a00ca64951570d8fc2e0',
    specifiers: Object.freeze(['@proto.ui/adapter-web-component']),
  }),
  'apps/www/src/components/UiLibraryGallery.astro': Object.freeze({
    sourceSha256: '10b46c6a95217cc6756b50393de8c6d7a542dbd8cf148524a3ae56fc643fa4a2',
    specifiers: Object.freeze([
      '../../../../packages/prototypes/brutalist/src/theme',
      '../../../../packages/prototypes/bootstrap-2-3-2/src/theme',
      '../../../../packages/prototypes/liquid-glass/src/theme',
    ]),
  }),
  'apps/www/src/components/library-card-client.ts': Object.freeze({
    sourceSha256: '782f2ff171266ecf7c7d412fdb50f00261f511f1aa769c402dd5b5fe7de14294',
    specifiers: Object.freeze(['@proto.ui/adapter-web-component']),
  }),
  'apps/www/src/components/library-card-prototypes.ts': Object.freeze({
    sourceSha256: '7f13431804ae16891b05c8d75394a1c7be45b1bdc95eaf1bc8817b3ddcf48eb4',
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
});
