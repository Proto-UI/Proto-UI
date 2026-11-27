export const WEBSITE_NON_INTERACTIVE_PATHS = Object.freeze({
  'www.shell.site-title': Object.freeze(['apps/www/src/components/override/SiteTitle.astro']),
  'www.shell.skip-link': Object.freeze(['apps/www/astro.config.mjs']),
  'www.shell.primary-nav': Object.freeze(['apps/www/src/components/override/Header.astro']),
  'www.shell.social-links': Object.freeze(['apps/www/src/components/override/SocialIcons.astro']),
  'www.shell.header-separators': Object.freeze(['apps/www/src/components/override/Header.astro']),
  'www.shell.page-layout': Object.freeze([
    'apps/www/src/components/override/PageFrame.astro',
    'apps/www/src/components/override/TwoColumnContent.astro',
    'apps/www/src/components/override/ContentPanel.astro',
  ]),
  'www.shell.page-title': Object.freeze(['apps/www/src/components/override/PageTitle.astro']),
  'www.shell.footer': Object.freeze(['apps/www/astro.config.mjs']),
  'www.shell.pagination': Object.freeze(['apps/www/astro.config.mjs']),
  'www.shell.hero-actions': Object.freeze([
    'apps/www/src/components/override/Hero.astro',
    'apps/www/src/components/Homepage/HomeActions.astro',
  ]),
  'www.docs.spec-contract-preview': Object.freeze([
    'apps/www/src/components/SpecContractPreview.astro',
  ]),
  'www.docs.api-table': Object.freeze(['apps/www/src/components/ApiPropsTable.astro']),
  'www.docs.stage-notice': Object.freeze(['apps/www/src/components/DocStageNotice.astro']),
  'www.docs.steps': Object.freeze([
    'apps/www/src/components/Steps.astro',
    'apps/www/src/components/Step.astro',
  ]),
  'www.docs.phase-badge': Object.freeze(['apps/www/src/components/SpecPhaseBadge.astro']),
  'www.docs.entity-links': Object.freeze(['apps/www/src/components/SpecEntityLinks.astro']),
  'www.gallery.lucide-card-grid': Object.freeze([
    'apps/www/src/components/LucideIconGallery.astro',
  ]),
  'www.gallery.ui-library-cards': Object.freeze(['apps/www/src/components/UiLibraryGallery.astro']),
  // Retain the ledger ID after retiring the overview. This binds native family
  // navigation and package inventories, not the detail pages' demo interactions.
  'www.gallery.prototype-library-cards': Object.freeze([
    'apps/www/astro.config.mjs',
    'apps/www/src/components/site-navigation.ts',
    'apps/www/src/components/PrototypeDocumentationIndex.astro',
    'packages/prototypes/base/package.json',
    'packages/prototypes/shadcn/package.json',
    'packages/prototypes/brutalist/package.json',
    'packages/prototypes/lucide/package.json',
    'packages/prototypes/bootstrap-2-3-2/package.json',
    'packages/prototypes/liquid-glass/package.json',
    'apps/www/src/content/docs/en/ui-libraries/base/button.mdx',
    'apps/www/src/content/docs/zh-cn/ui-libraries/base/button.mdx',
    'apps/www/src/content/docs/en/ui-libraries/shadcn/button.mdx',
    'apps/www/src/content/docs/zh-cn/ui-libraries/shadcn/button.mdx',
    'apps/www/src/content/docs/en/ui-libraries/brutalist/components/button.mdx',
    'apps/www/src/content/docs/zh-cn/ui-libraries/brutalist/components/button.mdx',
    'apps/www/src/content/docs/en/ui-libraries/bootstrap-2-3-2/button.mdx',
    'apps/www/src/content/docs/zh-cn/ui-libraries/bootstrap-2-3-2/button.mdx',
    'apps/www/src/content/docs/en/ui-libraries/liquid-glass/button.mdx',
    'apps/www/src/content/docs/zh-cn/ui-libraries/liquid-glass/button.mdx',
    'apps/www/src/content/docs/en/ui-libraries/lucide/index.mdx',
    'apps/www/src/content/docs/zh-cn/ui-libraries/lucide/index.mdx',
    'apps/www/src/content/docs/en/ui-libraries/lucide/icons.mdx',
    'apps/www/src/content/docs/zh-cn/ui-libraries/lucide/icons.mdx',
    'apps/www/src/components/LucideIconGallery.astro',
  ]),
  'www.icons.static-lucide': Object.freeze(['apps/www/src/components/StaticLucideIcon.astro']),
  'www.demo.brutalist-theme-style': Object.freeze([
    'apps/www/src/components/BrutalistPageStyle.astro',
  ]),
  'www.content.document-semantics': Object.freeze([
    'apps/www/src/components/override/MarkdownContent.astro',
  ]),
  'www.content.draft-notice': Object.freeze(['apps/www/astro.config.mjs']),
});

export const WEBSITE_NON_INTERACTIVE_EXPECTATIONS = Object.freeze({
  ...Object.fromEntries(
    [
      'www.shell.site-title',
      'www.shell.skip-link',
      'www.shell.page-layout',
      'www.shell.page-title',
      'www.shell.footer',
      'www.shell.pagination',
      'www.docs.spec-contract-preview',
      'www.docs.api-table',
      'www.docs.stage-notice',
      'www.docs.steps',
      'www.docs.entity-links',
      'www.gallery.lucide-card-grid',
      'www.gallery.prototype-library-cards',
      'www.content.document-semantics',
      'www.content.draft-notice',
    ].map((id) => [id, Object.freeze({ targetClass: 'native/static', state: 'native/static' })])
  ),
  'www.gallery.ui-library-cards': Object.freeze({
    targetClass: 'site-composition',
    state: 'blocked',
  }),
  'www.shell.primary-nav': Object.freeze({
    targetClass: 'site-composition',
    state: 'research',
  }),
  'www.shell.social-links': Object.freeze({
    targetClass: 'site-composition',
    state: 'research',
  }),
  'www.shell.header-separators': Object.freeze({
    targetClass: 'official-prototype',
    state: 'blocked',
  }),
  'www.shell.hero-actions': Object.freeze({
    targetClass: 'site-composition',
    state: 'research',
  }),
  'www.docs.phase-badge': Object.freeze({
    targetClass: 'official-prototype',
    state: 'blocked',
  }),
  'www.icons.static-lucide': Object.freeze({
    targetClass: 'official-prototype',
    state: 'blocked',
  }),
  'www.demo.brutalist-theme-style': Object.freeze({
    targetClass: 'infrastructure-exempt',
    state: 'infrastructure-exempt',
  }),
});

const websiteNonInteractivePathIds = Object.keys(WEBSITE_NON_INTERACTIVE_PATHS).sort();
const websiteNonInteractiveExpectationIds = Object.keys(
  WEBSITE_NON_INTERACTIVE_EXPECTATIONS
).sort();
if (
  websiteNonInteractivePathIds.length !== websiteNonInteractiveExpectationIds.length ||
  websiteNonInteractivePathIds.some(
    (id, index) => id !== websiteNonInteractiveExpectationIds[index]
  )
) {
  throw new Error(
    'Website non-interactive path and class/state manifests must contain identical surface IDs'
  );
}

export const WEBSITE_HEADERS = [
  'ID',
  'Path',
  'User job',
  'Current owner',
  'Target class',
  'Proto UI chain',
  'Lifecycle',
  'WC host and SSR/no-JS strategy',
  'Dependency and owner',
  'Difficulty',
  'Milestone',
  'State',
  'Evidence',
  'Escape or exemption',
  'Re-review or removal issue',
];

export const AGENT_HARNESS_HEADERS = [
  'ID',
  'Path',
  'User job',
  'Current owner',
  'Target owner',
  'Target class',
  'Proto UI chain',
  'App state and semantic events',
  'Production host and equivalence evidence',
  'Dependency and owner',
  'Difficulty',
  'Milestone',
  'State',
  'Evidence',
  'Escape or exemption',
  'Re-review or removal issue',
];

export const WEBSITE_SURFACE_IDS = Object.freeze([
  'www.shell.site-title',
  'www.shell.skip-link',
  'www.shell.primary-nav',
  'www.shell.social-links',
  'www.shell.header-separators',
  'www.shell.theme-toggle',
  'www.shell.theme-provider',
  'www.shell.language-select',
  'www.shell.adapter-select',
  'www.shell.mobile-menu-toggle',
  'www.shell.mobile-menu-panel',
  'www.shell.mobile-theme-select',
  'www.shell.sidebar-navigation',
  'www.shell.page-layout',
  'www.shell.page-title',
  'www.shell.table-of-contents',
  'www.shell.mobile-table-of-contents',
  'www.shell.footer',
  'www.shell.pagination',
  'www.shell.hero-actions',
  'www.shell.hero-hash-scroll',
  'www.search.launcher',
  'www.search.dialog',
  'www.search.input-results',
  'www.search.loading-failure',
  'www.search.pagefind-engine',
  'www.docs.code-example-host-tabs',
  'www.docs.code-example-file-tabs',
  'www.docs.code-panel-copy',
  'www.docs.code-panel-expand',
  'www.docs.expressive-code-copy-feedback',
  'www.docs.expressive-code-scroll-focus',
  'www.docs.install-manager-tabs',
  'www.docs.install-copy',
  'www.docs.wiki-term',
  'www.docs.spec-contract-preview',
  'www.docs.api-table',
  'www.docs.stage-notice',
  'www.docs.steps',
  'www.docs.phase-badge',
  'www.docs.entity-links',
  'www.gallery.lucide-search',
  'www.gallery.lucide-load-more',
  'www.gallery.lucide-card-grid',
  'www.gallery.lucide-dialog',
  'www.gallery.lucide-copy',
  'www.gallery.lucide-lazy-loader',
  'www.gallery.ui-library-cards',
  'www.gallery.prototype-library-cards',
  'www.icons.static-lucide',
  'www.demo.prototype-previewer',
  'www.demo.runtime-select',
  'www.demo.authored-controllers',
  'www.demo.home-demo-select',
  'www.demo.code-panel',
  'www.demo.demo-matrix',
  'www.demo.raw-adapter-runtimes',
  'www.demo.lazy-mount-observer',
  'www.demo.brutalist-theme-style',
  'www.route.root-locale-redirect',
  'www.route.locale-middleware',
  'www.route.content-collections',
  'www.route.astro-starlight',
  'www.build.markdown-mdx',
  'www.build.pagefind-index',
  'www.build.shiki',
  'www.build.sitemap',
  'www.build.style-generation',
  'www.content.document-semantics',
  'www.content.draft-notice',
]);

export const AGENT_HARNESS_SURFACE_IDS = Object.freeze([
  'harness.shell.frame',
  'harness.shell.brand',
  'harness.shell.theme-control',
  'harness.shell.mobile-navigation',
  'harness.shell.resizable-panes',
  'harness.sessions.list',
  'harness.sessions.grouped-tree',
  'harness.sessions.search',
  'harness.sessions.create',
  'harness.sessions.selection',
  'harness.sessions.rename',
  'harness.sessions.archive-delete',
  'harness.sessions.state-indicator',
  'harness.run.header',
  'harness.run.status',
  'harness.run.usage-summary',
  'harness.run.stop-retry',
  'harness.run.reasoning-trace',
  'harness.run.agent-lanes',
  'harness.run.tool-invocation',
  'harness.run.approval-request',
  'harness.run.questionnaire',
  'harness.transcript.viewport',
  'harness.transcript.follow-tail',
  'harness.transcript.history-anchor',
  'harness.transcript.windowing',
  'harness.transcript.user-message',
  'harness.transcript.assistant-message',
  'harness.transcript.authored-content',
  'harness.transcript.code-block',
  'harness.transcript.attachment',
  'harness.transcript.empty-loading-error',
  'harness.transcript.live-feedback',
  'harness.composer.root',
  'harness.composer.input',
  'harness.composer.actions',
  'harness.composer.suggestions',
  'harness.composer.attachments',
  'harness.composer.file-intake',
  'harness.composer.feedback',
  'harness.workspace.plan-todo',
  'harness.workspace.file-tree',
  'harness.workspace.branch-checkpoints',
  'harness.workspace.artifact-workspace',
  'harness.workspace.artifact-tabs',
  'harness.workspace.code-log',
  'harness.workspace.static-diff',
  'harness.workspace.image-artifact',
  'harness.workspace.inspector',
  'harness.workspace.artifact-actions',
  'harness.workspace.empty',
  'harness.future.terminal-chrome',
  'harness.future.terminal-engine',
  'harness.future.editor-chrome',
  'harness.future.editor-engine',
  'harness.future.preview-chrome',
  'harness.future.preview-engine',
  'harness.infrastructure.markdown',
  'harness.infrastructure.syntax-highlighter',
  'harness.infrastructure.diff-engine',
  'harness.infrastructure.agent-backend',
  'harness.infrastructure.react-bootstrap',
  'harness.shared.icons',
]);

export const WEBSITE_DOCUMENT_SEMANTICS_CLOSURE = Object.freeze({
  issue: 579,
  pullRequest: 580,
  implementationHead: '2a6d5f3208d91e5c9862a67408a39ff208d43306',
  mergeCommit: '9841c86a10940267fb30ee25b63c9a5a39f76fe6',
  routes: Object.freeze([
    '/en/ui-libraries/shadcn/select/',
    '/zh-cn/ui-libraries/shadcn/select/',
    '/en/start-here/quick-start/',
    '/zh-cn/start-here/quick-start/',
  ]),
  repositoryPaths: Object.freeze([
    'apps/www/src/components/override/MarkdownContent.astro',
    'apps/www/src/styles/markdown.css',
    'apps/www/src/content/docs/zh-cn/docs-content-flow.browser.test.ts',
    'docs/evidence/579-docs-content-flow',
  ]),
  reReviewPhrases: Object.freeze([
    'MarkdownContent override',
    'docs-flow selectors',
    'Starlight reset behavior',
    'MarkdownContent/Starlight',
  ]),
});

export const MATRIX_CONFIGS = Object.freeze([
  Object.freeze({
    kind: 'website',
    relativePath: 'internal/website/self-hosting-coverage-matrix.md',
    startMarker: '<!-- coverage-matrix:start website -->',
    headers: WEBSITE_HEADERS,
    idPattern: /^www\.[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/,
    idExample: 'www.shell.search',
    allowedTargetClasses: [
      'official-prototype',
      'site-composition',
      'native/static',
      'infrastructure-exempt',
    ],
    allowedStates: [
      'self-hosted',
      'ready',
      'research',
      'blocked',
      'native/static',
      'infrastructure-exempt',
    ],
    allowedDifficulties: Object.freeze(['F1', 'F2', 'F3', 'F4', 'F5']),
    ownerHeaders: ['Current owner', 'Dependency and owner'],
    existingPathHeaders: ['Path', 'Evidence'],
    requiredIds: WEBSITE_SURFACE_IDS,
    requiredCatalogIdsByRow: Object.freeze({
      'www.demo.raw-adapter-runtimes': Object.freeze([
        'A-WEB-COMPONENT-0001',
        'A-REACT-18-19-0001',
        'A-VUE-3-0001',
        'A-VUE-2-0001',
      ]),
    }),
    requiredRepositoryPathsByRow: Object.freeze({
      ...WEBSITE_NON_INTERACTIVE_PATHS,
    }),
    requiredInlineCodeByRow: Object.freeze({
      'www.search.input-results': Object.freeze(['Dialog', 'Command', 'InputShell']),
    }),
    closureBindingsByRow: Object.freeze({
      'www.content.document-semantics': WEBSITE_DOCUMENT_SEMANTICS_CLOSURE,
    }),
    inheritedSurfaceManifests: Object.freeze([
      Object.freeze({
        source: '@astrojs/starlight@0.35.3',
        dependency: Object.freeze({
          importer: 'apps/www',
          packageName: '@astrojs/starlight',
          version: '0.35.3',
        }),
        ids: Object.freeze([
          'www.shell.skip-link',
          'www.shell.mobile-menu-toggle',
          'www.shell.mobile-menu-panel',
          'www.shell.mobile-theme-select',
          'www.shell.sidebar-navigation',
          'www.shell.mobile-table-of-contents',
          'www.shell.footer',
          'www.shell.pagination',
          'www.content.draft-notice',
        ]),
      }),
      Object.freeze({
        source: '@expressive-code/core@0.41.7 and @expressive-code/plugin-frames@0.41.7',
        dependencyRoot: Object.freeze({
          importer: 'apps/www',
          packageName: '@astrojs/starlight',
        }),
        dependencies: Object.freeze([
          Object.freeze({ packageName: '@expressive-code/core', version: '0.41.7' }),
          Object.freeze({ packageName: '@expressive-code/plugin-frames', version: '0.41.7' }),
        ]),
        ids: Object.freeze([
          'www.docs.expressive-code-copy-feedback',
          'www.docs.expressive-code-scroll-focus',
        ]),
      }),
    ]),
    nonInteractiveSurfaceManifests: Object.freeze([
      Object.freeze({
        source: 'repository-owned non-interactive website projections',
        entries: Object.freeze(
          Object.entries(WEBSITE_NON_INTERACTIVE_EXPECTATIONS).map(([id, expectation]) =>
            Object.freeze({ id, ...expectation })
          )
        ),
      }),
    ]),
    classStateRequirements: {
      'native/static': 'native/static',
      'infrastructure-exempt': 'infrastructure-exempt',
    },
    stateClassRequirements: {
      'native/static': 'native/static',
      'infrastructure-exempt': 'infrastructure-exempt',
    },
    exemptTargetClasses: ['native/static', 'infrastructure-exempt'],
    exemptStates: ['native/static', 'infrastructure-exempt'],
  }),
  Object.freeze({
    kind: 'agent-harness',
    relativePath: 'internal/agent-harness/dogfood-coverage-matrix.md',
    startMarker: '<!-- coverage-matrix:start agent-harness -->',
    headers: AGENT_HARNESS_HEADERS,
    idPattern: /^harness\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+)*$/,
    idExample: 'harness.transcript.viewport',
    allowedTargetClasses: [
      'official-prototype',
      'composition',
      'app-local-proto',
      'native/static',
      'infrastructure-exempt',
    ],
    allowedStates: [
      'dogfooded',
      'app-local-proto',
      'ready',
      'research',
      'blocked',
      'native/static',
      'infrastructure-exempt',
    ],
    ownerHeaders: ['Current owner', 'Target owner', 'Dependency and owner'],
    requiredIds: AGENT_HARNESS_SURFACE_IDS,
    classStateRequirements: {
      'native/static': 'native/static',
      'infrastructure-exempt': 'infrastructure-exempt',
    },
    stateClassRequirements: {
      'app-local-proto': 'app-local-proto',
      'native/static': 'native/static',
      'infrastructure-exempt': 'infrastructure-exempt',
    },
    exemptTargetClasses: ['native/static', 'infrastructure-exempt'],
    exemptStates: ['native/static', 'infrastructure-exempt'],
  }),
]);

export class CoverageMatrixValidationError extends Error {
  constructor(issues) {
    super(
      `Coverage matrix validation failed with ${issues.length} issue${issues.length === 1 ? '' : 's'}:\n${issues
        .map((issue) => `- ${issue}`)
        .join('\n')}`
    );
    this.name = 'CoverageMatrixValidationError';
    this.issues = issues;
  }
}
