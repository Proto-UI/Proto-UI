// Source-reviewed library entry composition. Exact file bytes and import
// strings only; no family/directory exemption or stable lifecycle promotion.
// Owner: www.gallery.ui-library-cards. Shared server closure is separately
// owned by www.build.style-generation through startup-prerender-imports.mjs.
export const LIBRARY_CARD_IMPORT_ALLOWLIST = Object.freeze({
  'apps/www/src/components/UiLibraryGallery.astro': Object.freeze({
    sourceSha256: 'f38518533a89c292296d86f48359c2b6efb334f6022c0e7c3965d1d8686ce6a4',
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
    sourceSha256: 'ba4ca0bc1fcb094f99307679d193d52bc17e77491bbd23f6710874ddf09a77a5',
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
