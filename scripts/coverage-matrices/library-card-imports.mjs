// Source-reviewed library entry composition. Exact file bytes and import
// strings only; no family/directory exemption or stable lifecycle promotion.
// Owner: www.gallery.ui-library-cards. Shared server closure is separately
// owned by www.build.style-generation through startup-prerender-imports.mjs.
export const LIBRARY_CARD_IMPORT_ALLOWLIST = Object.freeze({
  'packages/adapters/base/src/material/initial-paint-experiment.ts': Object.freeze({
    sourceSha256: '4a5526992ba29b83df17917deb7560af47ea7ab7e53a04379535bb354f534451',
    specifiers: Object.freeze([
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
    sourceSha256: '4ae7937ed88f53188639abd8507217c5933145851e28cd3498fefcefe77e7fdf',
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
    sourceSha256: '1ebc076d75f1ce6e00d1cb4b47160b18418d8e767f90dafd1d819ec2b611aeab',
    specifiers: Object.freeze([
      '@proto.ui/prototypes-base/surface',
      '@proto.ui/prototypes-base/text',
      '@proto.ui/prototypes-shadcn/surface',
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
