export const publicDocPolicy = {
  locales: ['en', 'zh-cn'],
  navigation: {
    source: 'apps/www/astro.config.mjs',
    fallbacks: [],
  },
  release: {
    versionEntities: 'spec/versions',
    additionalCurrentProjections: ['README.md', 'README.zh-CN.md'],
    archivedRoutes: [],
    pendingMarkers: [
      'stable publication pending',
      'publication is still pending',
      'publication remains pending',
      '稳定版发布仍待完成',
      '稳定版仍待发布',
      '发布仍待完成',
    ],
  },
  scaffolding: {
    markers: ['写作提示', 'Coming soon'],
    exceptions: [],
  },
  overviewInventory: 'apps/www/src/components/PrototypeLibraryOverview.astro',
  libraries: [
    {
      id: 'base',
      packageName: '@proto.ui/prototypes-base',
      overviewSlug: 'ui-libraries/base',
      detailPrefix: 'ui-libraries/base',
      catalogPrefix: 'P-BASE-',
      familyAliases: { dropdown: 'dropdown-menu' },
      exportClassifications: {
        '.': {
          kind: 'library-root',
          reason:
            'The root export aggregates the library and is represented by the overview route.',
        },
        './behaviors': {
          kind: 'non-component',
          reason: 'Reusable behavior hooks are authoring utilities, not a component family.',
        },
        './tools': {
          kind: 'non-component',
          reason: 'Prototype authoring tools are utilities, not a component family.',
        },
      },
    },
    {
      id: 'shadcn',
      packageName: '@proto.ui/prototypes-shadcn',
      overviewSlug: 'ui-libraries/shadcn',
      detailPrefix: 'ui-libraries/shadcn',
      catalogPrefix: 'P-SHADCN-',
      familyAliases: { dropdown: 'dropdown-menu' },
      exportClassifications: {
        '.': {
          kind: 'library-root',
          reason:
            'The root export aggregates the library and is represented by the overview route.',
        },
        './component-presets': {
          kind: 'non-component',
          reason: 'Component preset metadata supports tooling and is not a component family.',
        },
      },
    },
    {
      id: 'brutalist',
      packageName: '@proto.ui/prototypes-brutalist',
      overviewSlug: 'ui-libraries/brutalist',
      detailPrefix: 'ui-libraries/brutalist/components',
      catalogPrefix: 'P-BRUTALIST-',
      familyAliases: { dropdown: 'dropdown-menu' },
      exportClassifications: {
        '.': {
          kind: 'library-root',
          reason:
            'The root export aggregates the library and is represented by the overview route.',
        },
        './theme': {
          kind: 'non-component',
          reason:
            'The theme export contains design tokens and stylesheet metadata, not a component family.',
        },
      },
    },
    {
      id: 'lucide',
      packageName: '@proto.ui/prototypes-lucide',
      overviewSlug: 'ui-libraries/lucide',
      catalogPrefix: 'P-LUCIDE-',
      exportClassifications: {
        '.': {
          kind: 'library-root',
          reason: 'The root export is represented by the searchable icon-library overview.',
        },
        './icons': {
          kind: 'overview-only',
          catalogId: 'P-LUCIDE-ICON',
          reason:
            'Thousands of generated glyphs share one catalog protocol and one searchable overview.',
        },
        './icons/*': {
          kind: 'overview-only',
          catalogId: 'P-LUCIDE-ICON',
          reason:
            'Per-icon entrypoints are generated specializations of one protocol, not standalone pages.',
        },
        './manifest': {
          kind: 'non-component',
          reason: 'Generated icon metadata is a tooling surface, not a component family.',
        },
        './snippets': {
          kind: 'non-component',
          reason: 'Generated usage snippets are tooling data, not a component family.',
        },
        './loaders': {
          kind: 'non-component',
          reason: 'Dynamic loader helpers are delivery infrastructure, not a component family.',
        },
        './all': {
          kind: 'non-component',
          reason: 'The all-icons barrel is an aggregate delivery surface, not a separate family.',
        },
      },
    },
  ],
};
