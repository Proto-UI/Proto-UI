// Source-reviewed library entry composition. Exact file bytes and import
// strings only; no family/directory exemption or stable lifecycle promotion.
// Owner: www.gallery.ui-library-cards. Shared server closure is separately
// owned by www.build.style-generation through startup-prerender-imports.mjs.
export const LIBRARY_CARD_IMPORT_ALLOWLIST = Object.freeze({
  'apps/www/src/components/UiLibraryGallery.astro': Object.freeze({
    sourceSha256: '89685fbeab258ff0565abc7fbc38aed4fa00d92bb41c106cd25fd0954bcbb14e',
    specifiers: Object.freeze([
      '../../../../packages/prototypes/brutalist/src/theme',
      '../../../../packages/prototypes/bootstrap-2-3-2/src/theme',
      '../../../../packages/prototypes/liquid-glass/src/theme',
    ]),
  }),
  'apps/www/src/components/library-card-client.ts': Object.freeze({
    sourceSha256: '6f7c427be2a9e7a0802d5eacdaa3f95bb5c57a06ee1c6d7191d2d7a5b1f43f03',
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
