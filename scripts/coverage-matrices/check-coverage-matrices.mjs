import { spawnSync } from 'node:child_process';
import { decodeVideoEvidence } from './decode-video-evidence.mjs';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { builtinModules, createRequire } from 'node:module';
import { inflateSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { moduleResolve } from 'import-meta-resolve';
import { specEntitySchema } from '@proto.ui/spec-schema';
import ts from 'typescript';
import { parse as parseYaml } from 'yaml';
import { parse as parseHtml } from 'parse5';
import { parse as parseAstro } from '@astrojs/compiler/sync';

const TOTAL_HEADERS = ['State', 'Count'];
const TARGET_CLASS_TOTAL_HEADERS = ['Target class', 'Count'];
const END_MARKER = '<!-- coverage-matrix:end -->';
const CATALOG_ID_PATTERN = /\b(?:A|C|D|HC|K|M|P|T|V)-[A-Z0-9]+(?:[.-][A-Z0-9]+)*\b/g;
const CATALOG_STATUSES = Object.freeze(['draft', 'active', 'deprecated', 'removed']);
const WEBSITE_SHIPPED_STATES = Object.freeze([
  'self-hosted',
  'ready',
  'native/static',
  'infrastructure-exempt',
]);
const INTERACTIVE_SOURCE_PATTERNS = Object.freeze([
  /<script\b|\baddEventListener\s*\(|\bcustomElements\.define\s*\(|\b(?:Intersection|Mutation|Resize)Observer\s*\(/i,
  /\b[A-Za-z_$][\w$]*\.on[a-z][A-Za-z0-9_$]*\s*=/u,
]);

const LIB_DOM_SOURCE_FILE = (() => {
  const libDomPath = path.join(path.dirname(ts.getDefaultLibFilePath({})), 'lib.dom.d.ts');
  return ts.createSourceFile(
    libDomPath,
    fs.readFileSync(libDomPath, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
})();

function collectNativeEventAttributeNames() {
  const names = new Set();
  const containsFunctionType = (node) => {
    let found = false;
    const visit = (child) => {
      if (found) return;
      if (ts.isFunctionTypeNode(child)) found = true;
      else ts.forEachChild(child, visit);
    };
    visit(node);
    return found;
  };
  const visit = (node) => {
    if (
      ts.isPropertySignature(node) &&
      ts.isIdentifier(node.name) &&
      /^on[a-z]/u.test(node.name.text) &&
      node.type &&
      containsFunctionType(node.type)
    ) {
      names.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(LIB_DOM_SOURCE_FILE);
  return names;
}

function collectAriaReflectionPropertyNames() {
  const ariaMixin = LIB_DOM_SOURCE_FILE.statements.find(
    (statement) => ts.isInterfaceDeclaration(statement) && statement.name.text === 'ARIAMixin'
  );
  if (!ariaMixin) return new Set();
  return new Set(
    ariaMixin.members
      .filter((member) => ts.isPropertySignature(member) && ts.isIdentifier(member.name))
      .map((member) => member.name.text)
  );
}

// HTML event attribute names are ASCII case-insensitive. Camel-cased JSX
// component callbacks remain open-ended because application components can
// define their own `onXxx` semantic events.
const NATIVE_EVENT_ATTRIBUTE_NAMES = collectNativeEventAttributeNames();
const GOVERNED_DOM_STATE_PROPERTY_NAMES = new Set([
  ...collectAriaReflectionPropertyNames(),
  'checked',
  'className',
  'disabled',
  'hidden',
  'indeterminate',
  'inert',
  'open',
  'selected',
  'tabIndex',
  'scrollLeft',
  'scrollTop',
  'selectedIndex',
  'selectionDirection',
  'selectionEnd',
  'selectionStart',
  'value',
]);
const GOVERNED_DOM_STATE_ATTRIBUTE_NAMES = new Set([
  'checked',
  'class',
  'disabled',
  'hidden',
  'inert',
  'open',
  'selected',
  'tabindex',
  'value',
]);
const DOM_RECEIVER_VALUED_PROPERTY_NAMES = new Set([
  'firstElementChild',
  'lastElementChild',
  'parentElement',
  'parentNode',
  'offsetParent',
  'nextElementSibling',
  'previousElementSibling',
  'firstChild',
  'lastChild',
  'nextSibling',
  'previousSibling',
  'shadowRoot',
  'host',
  'ownerDocument',
  'content',
]);
const DOGFOODED_EVIDENCE_LABELS = Object.freeze([
  'Build:',
  'Browser:',
  'Accessibility:',
  'Lifecycle:',
  'Design:',
]);
const DOGFOODED_RECORD_LABELS = Object.freeze([
  ...DOGFOODED_EVIDENCE_LABELS,
  'Commit:',
  'Environment:',
  'Fixtures:',
  'Commands:',
  'Results:',
]);
const SELF_HOSTED_WEBSITE_EVIDENCE_ROOT = 'internal/website/evidence/';
const SELF_HOSTED_WEBSITE_RECORD_LABELS = Object.freeze([
  'Commit:',
  'Environment:',
  'Routes:',
  'Build:',
  'Browser:',
  'Accessibility:',
  'Screenshot:',
  'Multi-frame:',
  'Commands:',
  'Results:',
]);
const WEBSITE_RAW_IMPORT_ALLOWLIST = Object.freeze({
  'apps/www/src/components/PrototypePreviewer/demo-renderer.ts': Object.freeze({
    specifiers: Object.freeze([
      '@proto.ui/core',
      '@proto.ui/adapter-web-component',
      '@proto.ui/adapter-react',
      '@proto.ui/adapter-vue',
      '@proto.ui/adapter-vue2',
    ]),
  }),
  'apps/www/src/components/PrototypePreviewer/wc-registry.ts': Object.freeze({
    specifiers: Object.freeze(['@proto.ui/core', '@proto.ui/adapter-web-component']),
  }),
  'apps/www/src/components/PrototypePreviewer/registry.ts': Object.freeze({
    specifiers: Object.freeze(['@proto.ui/core']),
  }),
  'apps/www/src/components/PrototypePreviewer/runtimes/react-runtime.ts': Object.freeze({
    specifiers: Object.freeze(['@proto.ui/adapter-react']),
    viteIgnoredDynamicImports: Object.freeze([
      'https://esm.sh/react@18',
      'https://esm.sh/react-dom@18',
    ]),
  }),
  'apps/www/src/components/PrototypePreviewer/runtimes/vue-runtime.ts': Object.freeze({
    specifiers: Object.freeze(['@proto.ui/adapter-vue']),
    viteIgnoredDynamicImports: Object.freeze(['https://esm.sh/vue@3']),
  }),
  'apps/www/src/components/PrototypePreviewer/runtimes/vue2-runtime.ts': Object.freeze({
    specifiers: Object.freeze(['@proto.ui/adapter-vue2']),
    viteIgnoredDynamicImports: Object.freeze(['https://esm.sh/vue@2.6.14']),
  }),
  'apps/www/src/components/PrototypePreviewer/runtimes/wc-runtime.ts': Object.freeze({
    specifiers: Object.freeze(['@proto.ui/adapter-web-component']),
  }),
  'apps/www/src/components/PrototypePreviewer/prototype-modules.ts': Object.freeze({
    categories: Object.freeze(['prototype-package', 'prototype-internal']),
  }),
  'apps/www/src/components/BrutalistPageStyle.astro': Object.freeze({
    resolvedPaths: Object.freeze(['packages/prototypes/brutalist/src/theme']),
  }),
  'apps/www/src/components/PrototypePreviewer/projection-theme.ts': Object.freeze({
    resolvedPaths: Object.freeze([
      'packages/prototypes/brutalist/src/theme',
      'packages/prototypes/bootstrap-2-3-2/src/theme',
      'packages/prototypes/liquid-glass/src/theme',
    ]),
  }),
  'apps/www/src/components/LucideIconGallery.astro': Object.freeze({
    specifierPrefixes: Object.freeze(['@proto.ui/prototypes-lucide']),
  }),
  'apps/www/src/components/StaticLucideIcon.astro': Object.freeze({
    specifierPrefixes: Object.freeze(['@proto.ui/prototypes-lucide']),
  }),
  'apps/www/src/components/site-shadcn-controls.ts': Object.freeze({
    specifiers: Object.freeze([
      '@proto.ui/adapter-web-component',
      '@proto.ui/prototypes-shadcn/button',
      '@proto.ui/prototypes-shadcn/select',
    ]),
  }),
  // Accepted documentation-media bridge (#787/#797). These are exact source
  // imports, not a family-wide or active-SVG admission.
  'apps/www/src/components/documentation-image-controls.ts': Object.freeze({
    specifiers: Object.freeze([
      '@proto.ui/adapter-web-component',
      '@proto.ui/prototypes-shadcn/button',
      '@proto.ui/prototypes-shadcn/dialog',
      '@proto.ui/prototypes-brutalist/button',
      '@proto.ui/prototypes-brutalist/dialog',
      '@proto.ui/prototypes-brutalist/theme',
    ]),
  }),
  'apps/www/src/components/documentation-image-zoom.proto.ts': Object.freeze({
    specifiers: Object.freeze(['@proto.ui/core', '@proto.ui/prototypes-base/dialog']),
  }),
  'apps/www/src/pages/en/test/liquid-glass-material.astro': Object.freeze({
    specifiers: Object.freeze(['@proto.ui/prototypes-liquid-glass/button']),
    resolvedPaths: Object.freeze(['packages/prototypes/liquid-glass/src/theme']),
  }),
  'apps/www/src/pages/en/test/new-projection-families.astro': Object.freeze({
    specifiers: Object.freeze([
      '@proto.ui/prototypes-bootstrap-2-3-2/button',
      '@proto.ui/prototypes-liquid-glass/button',
    ]),
    resolvedPaths: Object.freeze([
      'packages/prototypes/bootstrap-2-3-2/src/theme',
      'packages/prototypes/liquid-glass/src/theme',
    ]),
  }),
  'apps/www/src/components/override/Search.astro': Object.freeze({
    viteIgnoredDynamicImports: Object.freeze(['`${bundlePath}pagefind.js`']),
  }),
});

const HARNESS_REVIEWED_THIRD_PARTY_SCRIPT_IMPORTS = new Set(['react']);
const HARNESS_GENERATED_FACADE_SOURCE_PATHS = new Set([
  'proto-ui/components/index.ts',
  'proto-ui/components/react/index.ts',
  'proto-ui/components/vue/index.ts',
  'proto-ui/components/wc/index.ts',
]);
const NODE_BUILTIN_SPECIFIERS = new Set(
  builtinModules.map((specifier) => specifier.replace(/^node:/u, ''))
);

function isReviewedHarnessThirdPartyPackage(sourcePath, specifier) {
  return (
    /\.[cm]?[jt]sx?$/iu.test(sourcePath) &&
    HARNESS_REVIEWED_THIRD_PARTY_SCRIPT_IMPORTS.has(specifier)
  );
}

function isNodeBuiltinSpecifier(specifier) {
  return NODE_BUILTIN_SPECIFIERS.has(specifier.replace(/^node:/u, '').split('/')[0]);
}

function isGeneratedHarnessFacadeSource(relativeToHarnessSource) {
  return HARNESS_GENERATED_FACADE_SOURCE_PATHS.has(relativeToHarnessSource);
}
const HARNESS_RAW_IMPORT_ALLOWLIST = Object.freeze({
  // M0 authorizes only the React Adapter entry. Any prototype/facade entry
  // must be admitted here exactly in the same change that approves it.
  'apps/agent-harness/src/proto-ui/bootstrap.tsx': Object.freeze({
    specifiers: Object.freeze(['@proto.ui/adapter-react']),
  }),
});
const WEBSITE_NON_INTERACTIVE_PATHS = Object.freeze({
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
    'apps/www/src/components/override/pattern/LinkButton.astro',
  ]),
  'www.docs.spec-contract-preview': Object.freeze([
    'apps/www/src/components/SpecContractPreview.astro',
  ]),
  'www.docs.api-table': Object.freeze(['apps/www/src/components/ApiPropsTable.astro']),
  'www.docs.stage-notice': Object.freeze(['apps/www/src/components/DocStageNotice.astro']),
  'www.docs.phase-badge': Object.freeze(['apps/www/src/components/SpecPhaseBadge.astro']),
  'www.docs.entity-links': Object.freeze(['apps/www/src/components/SpecEntityLinks.astro']),
  'www.gallery.lucide-card-grid': Object.freeze([
    'apps/www/src/components/LucideIconGallery.astro',
  ]),
  'www.gallery.ui-library-cards': Object.freeze(['apps/www/src/components/UiLibraryGallery.astro']),
  'www.gallery.prototype-library-cards': Object.freeze([
    'apps/www/src/components/PrototypeLibraryOverview.astro',
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

const WEBSITE_NON_INTERACTIVE_EXPECTATIONS = Object.freeze({
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
      'www.docs.entity-links',
      'www.gallery.lucide-card-grid',
      'www.gallery.ui-library-cards',
      'www.gallery.prototype-library-cards',
      'www.content.document-semantics',
      'www.content.draft-notice',
    ].map((id) => [id, Object.freeze({ targetClass: 'native/static', state: 'native/static' })])
  ),
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

const WEBSITE_HEADERS = [
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

const AGENT_HARNESS_HEADERS = [
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

const WEBSITE_SURFACE_IDS = Object.freeze([
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

const AGENT_HARNESS_SURFACE_IDS = Object.freeze([
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

const WEBSITE_DOCUMENT_SEMANTICS_CLOSURE = Object.freeze({
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
      'www.search.input-results': Object.freeze(['@pagefind/default-ui']),
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

function parseMarkdownRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;

  const cells = [];
  let current = '';
  const inner = trimmed.slice(1, -1);
  for (let index = 0; index < inner.length; index += 1) {
    const character = inner[index];
    if (character === '\\' && inner[index + 1] === '|') {
      current += '|';
      index += 1;
      continue;
    }
    if (character === '|') {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += character;
  }
  cells.push(current.trim());
  return cells;
}

function stripInlineCode(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('`') && trimmed.endsWith('`') && trimmed.length > 1) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function isMeaningful(value) {
  const normalized = stripInlineCode(value)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_~]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[.!?。！？:;，、]+$/u, '')
    .trim();
  return ![
    '',
    '-',
    '—',
    '–',
    'none',
    'n/a',
    'na',
    'not applicable',
    'tbd',
    'todo',
    'unknown',
    'unclassified',
  ].includes(normalized);
}

function findExactLineIndexes(lines, expected) {
  const indexes = [];
  lines.forEach((line, index) => {
    if (line.trim() === expected) indexes.push(index);
  });
  return indexes;
}

function formatHeaders(headers) {
  return `| ${headers.join(' | ')} |`;
}

function parseTable(
  lines,
  fromIndex,
  toIndex,
  expectedHeaders,
  label,
  issues,
  { requireContiguous = false } = {}
) {
  let headerIndex = -1;
  for (let index = fromIndex; index < toIndex; index += 1) {
    if (lines[index].trim().startsWith('|')) {
      headerIndex = index;
      break;
    }
  }

  if (headerIndex === -1) {
    issues.push(
      `${label}: missing Markdown table; expected header ${formatHeaders(expectedHeaders)}`
    );
    return null;
  }

  const headers = parseMarkdownRow(lines[headerIndex]);
  if (!headers || headers.length !== expectedHeaders.length) {
    issues.push(`${label}: malformed header; expected exactly ${formatHeaders(expectedHeaders)}`);
    return null;
  }
  if (headers.some((header, index) => header !== expectedHeaders[index])) {
    issues.push(
      `${label}: header mismatch; expected exactly ${formatHeaders(expectedHeaders)}, received ${formatHeaders(headers)}`
    );
  }

  const separator = parseMarkdownRow(lines[headerIndex + 1] ?? '');
  if (
    !separator ||
    separator.length !== headers.length ||
    separator.some((cell) => !/^:?-{3,}:?$/.test(cell))
  ) {
    issues.push(
      `${label}: header must be followed by a ${headers.length}-column Markdown separator row`
    );
    return null;
  }

  const rows = [];
  let tableInterrupted = false;
  for (let index = headerIndex + 2; index < toIndex; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      const hasLaterContent = lines.slice(index + 1, toIndex).some((entry) => entry.trim());
      if (!requireContiguous || !hasLaterContent) break;
      if (!tableInterrupted) {
        issues.push(
          `${label}: line ${index + 1} interrupts the matrix; data rows must remain contiguous through ${END_MARKER}`
        );
        tableInterrupted = true;
      }
      continue;
    }
    if (!line.trim().startsWith('|')) {
      if (!requireContiguous) {
        if (rows.length > 0) break;
        continue;
      }
      if (!tableInterrupted) {
        issues.push(
          `${label}: line ${index + 1} interrupts the matrix; data rows must remain contiguous through ${END_MARKER}`
        );
        tableInterrupted = true;
      }
      continue;
    }
    const cells = parseMarkdownRow(line);
    if (!cells || cells.length !== expectedHeaders.length) {
      issues.push(
        `${label}: line ${index + 1} has ${cells?.length ?? 0} columns; expected ${expectedHeaders.length}. Escape literal pipes as \\|.`
      );
      continue;
    }
    rows.push({ line: index + 1, cells });
  }

  if (rows.length === 0) issues.push(`${label}: matrix must contain at least one data row`);
  return { headers, rows };
}

function rowRecord(headers, cells) {
  return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']));
}

function includesIssue(value) {
  return /(^|\D)#[1-9]\d*\b/.test(value);
}
function issueBindings(value) {
  return [...value.matchAll(/#([1-9]\d*)\b/gu)].map((match) => {
    const suffix = value.slice((match.index ?? 0) + match[0].length);
    const linkedUrl =
      value[(match.index ?? 0) - 1] === '[' ? (suffix.match(/^\]\(([^)]+)\)/u)?.[1] ?? null) : null;
    return { number: Number(match[1]), linkedUrl };
  });
}

function labeledValue(value, labelPattern) {
  return value.match(new RegExp(`\\b(?:${labelPattern})\\s*:\\s*([^;|]+)`, 'i'))?.[1].trim();
}

function normalizedOwnerToken(value) {
  const owner = labeledValue(value, 'owners?');
  return (
    owner
      ?.split(/[.!?。！？]/u, 1)[0]
      .trim()
      .toLowerCase() || null
  );
}

function includesConcreteOwnerLabel(value) {
  const owner = labeledValue(value, 'owners?');
  return owner !== undefined && isMeaningful(owner);
}

function includesSubstantiveReasonLabel(value) {
  const reason = labeledValue(value, 'reason');
  if (reason === undefined || !isMeaningful(reason)) return false;
  return (reason.match(/[A-Za-z0-9][A-Za-z0-9/-]*/g) ?? []).length >= 4;
}

function includesBoundedLimitOrTrigger(escapeOrExemption, reReviewOrRemoval) {
  const policyText = `${escapeOrExemption} ${reReviewOrRemoval}`;
  const limit = labeledValue(policyText, 'limit');
  return (
    (limit !== undefined && isMeaningful(limit)) ||
    /\b(?:if|when|whenever|until|unless)\s+[^.;|]{3,}/i.test(policyText) ||
    /\blimited to\s+[^.;|]{3,}/i.test(policyText) ||
    /\bon\b[^.;|]{0,80}\b(?:change|selection|upgrade|addition|removal|expansion|adoption|introduction|extraction)\b/i.test(
      policyText
    )
  );
}

function includesForbiddenClassification(value) {
  return /\b(?:unknown|unclassified)\b/i.test(value);
}

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function reportsCatalogEntityStatus(value, entityId, status) {
  const directAssociation = new RegExp(
    `\\b${escapeRegularExpression(entityId)}\\s*=\\s*${escapeRegularExpression(status)}\\b`,
    'i'
  );
  if (directAssociation.test(value)) return true;

  const entityPattern = new RegExp(`\\b${escapeRegularExpression(entityId)}\\b`, 'i');
  return value.split(';').some((clause) => {
    if (!entityPattern.test(clause)) return false;
    const reportedStatuses = CATALOG_STATUSES.filter((candidate) =>
      new RegExp(`\\b${candidate}\\b`, 'i').test(clause)
    );
    return reportedStatuses.length === 1 && reportedStatuses[0] === status;
  });
}

function explicitRepositoryPaths(value) {
  const paths = [];
  for (const match of value.matchAll(/`([^`\r\n]+)`/g)) {
    const candidate = match[1].trim().replaceAll('\\', '/');
    if (!/^(?:apps|docs|packages|scripts|spec|internal)\//.test(candidate)) continue;
    if (/[?*{}\[\]]/.test(candidate) || candidate.split('/').includes('..')) continue;
    paths.push(candidate);
  }
  return paths;
}

function repositoryPathsFromMatrixPath(value) {
  const paths = explicitRepositoryPaths(value);
  const candidate = value.trim().replaceAll('\\', '/');
  if (
    /^(?:apps|docs|packages|scripts|spec|internal)\/[A-Za-z0-9._@+()/-]+$/u.test(candidate) &&
    !candidate.split('/').includes('..')
  ) {
    paths.push(candidate);
  }
  return [...new Set(paths)];
}

function walkFiles(
  directory,
  { boundary = directory, issues = null, label = 'source', rootDir = path.dirname(directory) } = {}
) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  const canonicalBoundary = fs.realpathSync.native(boundary);
  const isWithinBoundary = (candidate) => {
    const relative = path.relative(canonicalBoundary, candidate);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
  };
  const visit = (authoredDirectory, canonicalAncestors) => {
    const canonicalDirectory = fs.realpathSync.native(authoredDirectory);
    if (canonicalAncestors.has(canonicalDirectory)) return;
    const nextAncestors = new Set(canonicalAncestors).add(canonicalDirectory);
    for (const entry of fs.readdirSync(authoredDirectory, { withFileTypes: true })) {
      const absolutePath = path.join(authoredDirectory, entry.name);
      if (entry.isSymbolicLink()) {
        let canonicalPath;
        try {
          canonicalPath = fs.realpathSync.native(absolutePath);
        } catch {
          issues?.push(
            `${label} symlink \`${path.relative(rootDir, absolutePath).replaceAll('\\', '/')}\` is broken`
          );
          continue;
        }
        if (!isWithinBoundary(canonicalPath)) {
          issues?.push(
            `${label} symlink \`${path.relative(rootDir, absolutePath).replaceAll('\\', '/')}\` resolves outside its governed source root ${path.relative(rootDir, boundary).replaceAll('\\', '/')}`
          );
          continue;
        }
        const target = fs.statSync(absolutePath);
        if (target.isDirectory()) visit(absolutePath, nextAncestors);
        else if (target.isFile()) files.push(absolutePath);
        continue;
      }
      if (entry.isDirectory()) visit(absolutePath, nextAncestors);
      else if (entry.isFile()) files.push(absolutePath);
    }
  };
  visit(directory, new Set());
  return files;
}

function loadCatalogEntries(rootDir, issues) {
  const entries = new Map();
  for (const absolutePath of walkFiles(path.join(rootDir, 'spec'))) {
    if (!/\.ya?ml$/i.test(absolutePath)) continue;
    const content = fs.readFileSync(absolutePath, 'utf8');
    const relativePath = path.relative(rootDir, absolutePath).replaceAll('\\', '/');
    let document;
    try {
      document = parseYaml(content);
    } catch (error) {
      issues.push(`${relativePath}: catalog YAML could not be parsed: ${error.message}`);
      continue;
    }

    const idResult = specEntitySchema.shape.id.safeParse(document?.id);
    const statusResult = specEntitySchema.shape.status.safeParse(document?.status);
    if (!idResult.success) {
      issues.push(`${relativePath}: catalog id is invalid or missing`);
      continue;
    }
    if (!statusResult.success) {
      issues.push(`${relativePath}: catalog status is invalid`);
      continue;
    }
    entries.set(idResult.data, { absolutePath, status: statusResult.data });
  }
  return entries;
}
function loadGovernanceSnapshot(rootDir, issues) {
  const relativePath = 'internal/coverage-matrices/github-governance-snapshot.json';
  const absolutePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(absolutePath)) {
    issues.push(`${relativePath}: repository-owned governance snapshot is missing`);
    return { issues: new Map(), pullRequests: new Map() };
  }
  let snapshot;
  try {
    snapshot = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    issues.push(`${relativePath}: governance snapshot is invalid JSON: ${error.message}`);
    return { issues: new Map(), pullRequests: new Map() };
  }
  if (
    snapshot?.schemaVersion !== 1 ||
    snapshot.repository !== 'Proto-UI/Proto-UI' ||
    !Array.isArray(snapshot.issues)
  ) {
    issues.push(
      `${relativePath}: snapshot must use schemaVersion 1, repository Proto-UI/Proto-UI, and an issues array`
    );
    return { issues: new Map(), pullRequests: new Map() };
  }
  const issueMap = new Map();
  let previousNumber = 0;
  for (const issue of snapshot.issues) {
    const number = issue?.number;
    const canonicalUrl = `https://github.com/Proto-UI/Proto-UI/issues/${number}`;
    const owners = issue?.owners;
    if (!Number.isSafeInteger(number) || number <= 0 || issueMap.has(number)) {
      issues.push(`${relativePath}: every Issue must have a unique positive integer number`);
      continue;
    }
    if (number <= previousNumber) {
      issues.push(`${relativePath}: Issue entries must be sorted by ascending number`);
    }
    previousNumber = number;
    if (
      typeof issue.nodeId !== 'string' ||
      issue.nodeId.length === 0 ||
      issue.url !== canonicalUrl ||
      typeof issue.title !== 'string' ||
      issue.title.length === 0 ||
      !/^(?:OPEN|CLOSED)$/u.test(issue.state ?? '') ||
      (issue.stateReason !== null && typeof issue.stateReason !== 'string') ||
      typeof issue.updatedAt !== 'string' ||
      Number.isNaN(Date.parse(issue.updatedAt)) ||
      !Array.isArray(owners) ||
      owners.length === 0 ||
      owners.some(
        (owner, index) =>
          typeof owner !== 'string' ||
          owner.length === 0 ||
          owner !== owner.toLowerCase() ||
          (index > 0 && owners[index - 1].localeCompare(owner) >= 0)
      )
    ) {
      issues.push(
        `${relativePath}: Issue #${number} must retain canonical nodeId, URL, title, state/stateReason, updatedAt, and sorted lowercase owners`
      );
    }
    issueMap.set(number, issue);
  }
  const pullRequestMap = new Map(
    (Array.isArray(snapshot.pullRequests) ? snapshot.pullRequests : []).map((pullRequest) => [
      pullRequest.number,
      pullRequest,
    ])
  );
  return { issues: issueMap, pullRequests: pullRequestMap };
}

function stripMarkdownCode(content) {
  let fence = null;
  const mdxBlockTags = [];
  const updateMdxBlockTags = (visibleLine) => {
    for (const match of visibleLine.matchAll(
      /<\s*(\/?)\s*([A-Za-z][\w:.-]*)\b[^>]*?(\/?)\s*>|<\s*(\/?)\s*>/gu
    )) {
      const isFragment = match[4] !== undefined;
      const closing = isFragment ? match[4] === '/' : match[1] === '/';
      const tag = isFragment ? '<>' : match[2];
      const selfClosing = !isFragment && match[3] === '/';
      if (closing) {
        const matchingIndex = mdxBlockTags.lastIndexOf(tag);
        if (matchingIndex >= 0) mdxBlockTags.splice(matchingIndex);
      } else if (!selfClosing) {
        mdxBlockTags.push(tag);
      }
    }
  };
  const withoutFences = content
    .split(/\r?\n/)
    .map((line) => {
      const fenceRun = line.match(/^[ \t]*(`{3,}|~{3,})/u)?.[1];
      if (!fence && fenceRun) {
        fence = { character: fenceRun[0], length: fenceRun.length };
        return '';
      }
      if (!fence) {
        const visibleLine = line.replace(/(?<!`)(`+)(?!`)[^\r\n]*?(?<!`)\1(?!`)/gu, '');
        if (mdxBlockTags.length > 0) {
          updateMdxBlockTags(visibleLine);
          return line;
        }

        if (/^(?: {4}|\t)/u.test(line)) return '';

        const trimmedLine = visibleLine.trimStart();
        if (/^<(?:[A-Za-z]|>)/u.test(trimmedLine)) updateMdxBlockTags(visibleLine);
        return line;
      }

      const closingRun = line.match(/^[ \t]*(`+|~+)[ \t]*$/u)?.[1];
      if (closingRun && closingRun[0] === fence.character && closingRun.length >= fence.length) {
        fence = null;
      }
      return '';
    })
    .join('\n');

  return withoutFences.replace(/(?<!`)(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)/gu, '');
}

function sourceTextForInteractionScan(absolutePath) {
  if (/\.svg$/i.test(absolutePath)) return fs.readFileSync(absolutePath, 'utf8');
  const content = fs
    .readFileSync(absolutePath, 'utf8')
    .replace(/<script\b([^>]*)>[\s\S]*?<\/script\s*>/giu, (script, attributes) => {
      const type =
        attributes.match(/\btype\s*=\s*(?:(["'])(.*?)\1|([^\s"'=<>`]+))/iu)?.[2] ??
        attributes.match(/\btype\s*=\s*([^\s"'=<>`]+)/iu)?.[1];
      return /^application\/(?:ld\+)?json$/iu.test(type ?? '') ? '' : script;
    });
  if (!/\.mdx?$/i.test(absolutePath)) return content;
  // Documentation examples contain literal event-listener snippets. They are
  // authored text, not website state machines; real MDX script/handler markup
  // remains visible after Markdown fences and inline code spans are removed.
  return stripMarkdownCode(content);
}

function astContainsJsxEventHandler(content) {
  const sourceFile = ts.createSourceFile(
    'website-source.tsx',
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  let found = false;
  const visit = (node) => {
    if (found) return;
    if (
      ts.isJsxAttribute(node) &&
      ((ts.isIdentifier(node.name) &&
        (/^on[A-Z][A-Za-z0-9_$]*$/u.test(node.name.text) ||
          NATIVE_EVENT_ATTRIBUTE_NAMES.has(node.name.text))) ||
        (ts.isJsxNamespacedName(node.name) &&
          node.name.namespace.text === 'client' &&
          /^(?:idle|load|media|only|visible)$/u.test(node.name.name.text)))
    ) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function unwrapTypeScriptExpression(expression) {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}
function staticMemberAccess(expression) {
  const candidate = unwrapTypeScriptExpression(expression);
  if (ts.isPropertyAccessExpression(candidate)) {
    return { name: candidate.name.text, receiver: candidate.expression };
  }
  if (
    ts.isElementAccessExpression(candidate) &&
    candidate.argumentExpression &&
    ts.isStringLiteralLike(candidate.argumentExpression)
  ) {
    return { name: candidate.argumentExpression.text, receiver: candidate.expression };
  }
  return null;
}

function isDomTypeNode(typeNode, sourceFile) {
  if (!typeNode) return false;
  return /(?:^|[^A-Za-z0-9_$])(?:Document|Element|HTMLElement|HTML[A-Za-z0-9]*Element|SVGElement|Window)(?:[^A-Za-z0-9_$]|$)/u.test(
    typeNode.getText(sourceFile)
  );
}

function domReceiverBindings(sourceFile) {
  const bindingsByName = new Map();
  const lexicalScope = (node) => {
    for (let current = node.parent; current; current = current.parent) {
      if (ts.isBlock(current) || ts.isFunctionLike(current) || ts.isSourceFile(current)) {
        return current;
      }
    }
    return sourceFile;
  };
  const addBinding = (name, node, initializer, intrinsicallyDom, destructuredProperties = null) => {
    const bindings = bindingsByName.get(name) ?? [];
    bindings.push({
      destructuredProperties,
      initializer,
      intrinsicallyDom,
      node,
      position: node.getStart(sourceFile),
      scope: lexicalScope(node),
    });
    bindingsByName.set(name, bindings);
  };
  const collectBindingName = (
    name,
    node,
    initializer,
    intrinsicallyDom,
    destructuredProperties = [],
    fromParameter = false
  ) => {
    if (ts.isIdentifier(name)) {
      addBinding(
        name.text,
        node,
        initializer,
        intrinsicallyDom ||
          (fromParameter &&
            /^(?:currentTarget|target)$/u.test(destructuredProperties.at(-1) ?? '')),
        destructuredProperties.length > 0 ? destructuredProperties : null
      );
      return;
    }
    if (!ts.isObjectBindingPattern(name)) return;
    for (const element of name.elements) {
      if (element.dotDotDotToken) continue;
      const property = element.propertyName ?? element.name;
      if (!ts.isIdentifier(property) && !ts.isStringLiteralLike(property)) continue;
      collectBindingName(
        element.name,
        element,
        initializer,
        intrinsicallyDom,
        destructuredProperties.concat(property.text),
        fromParameter
      );
    }
  };
  const collect = (node) => {
    if (ts.isParameter(node) || ts.isVariableDeclaration(node)) {
      collectBindingName(
        node.name,
        node,
        node.initializer ? unwrapTypeScriptExpression(node.initializer) : null,
        isDomTypeNode(node.type, sourceFile) ||
          (ts.isParameter(node) &&
            ts.isIdentifier(node.name) &&
            /^(?:el|element)$/u.test(node.name.text)),
        [],
        ts.isParameter(node)
      );
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.left)
    ) {
      addBinding(node.left.text, node, unwrapTypeScriptExpression(node.right), false);
    }
    ts.forEachChild(node, collect);
  };
  collect(sourceFile);

  const latestBinding = (name, useNode) => {
    const usePosition = useNode.getStart(sourceFile);
    const bindings = bindingsByName.get(name) ?? [];
    for (let scope = lexicalScope(useNode); scope; scope = lexicalScope(scope)) {
      const binding = bindings
        .filter((entry) => entry.scope === scope && entry.position < usePosition)
        .sort((left, right) => right.position - left.position)[0];
      if (binding) return binding;
      if (ts.isSourceFile(scope)) break;
    }
    return null;
  };
  const isIdentifierDomReceiver = (name, useNode, visitedBindings = new Set()) => {
    const binding = latestBinding(name, useNode);
    if (!binding) return name === 'document' || name === 'window';
    if (binding.intrinsicallyDom) return true;
    if (!binding.initializer || visitedBindings.has(binding)) return false;
    visitedBindings.add(binding);
    if (binding.destructuredProperties) {
      const owner = unwrapTypeScriptExpression(binding.initializer);
      const propertyChain = binding.destructuredProperties;
      const lastProperty = propertyChain.at(-1);
      const ownerProperty =
        propertyChain.at(-2) ??
        (ts.isIdentifier(owner) || ts.isPropertyAccessExpression(owner)
          ? owner.getText(sourceFile)
          : '');
      if (lastProperty === 'current' && /(?:Element|Node|Ref)$/u.test(ownerProperty)) {
        return true;
      }
      if (
        /^(?:body|documentElement|activeElement)$/u.test(lastProperty) &&
        ts.isIdentifier(owner) &&
        owner.text === 'document'
      ) {
        return true;
      }
      return (
        /^(?:currentTarget|target)$/u.test(lastProperty) &&
        ts.isIdentifier(owner) &&
        /^(?:e|ev|event)$/u.test(owner.text)
      );
    }
    return isDomReceiverExpression(
      binding.initializer,
      sourceFile,
      receiverBindings,
      binding.node,
      visitedBindings
    );
  };
  const isIdentifierDomCollection = (name, useNode, visitedBindings = new Set()) => {
    const binding = latestBinding(name, useNode);
    if (!binding?.initializer || binding.destructuredProperties || visitedBindings.has(binding)) {
      return false;
    }
    visitedBindings.add(binding);
    return isDomCollectionExpression(
      binding.initializer,
      sourceFile,
      receiverBindings,
      binding.node,
      visitedBindings
    );
  };
  const receiverBindings = { isIdentifierDomCollection, isIdentifierDomReceiver, latestBinding };
  return receiverBindings;
}

function isDomAcquisitionCall(expression, sourceFile, receiverBindings, useNode, visitedBindings) {
  const candidate = unwrapTypeScriptExpression(expression);
  if (!ts.isCallExpression(candidate)) return false;
  const calledMember = staticMemberAccess(candidate.expression);
  if (
    !calledMember ||
    !/^(?:adoptNode|attachShadow|cloneNode|closest|createDocumentFragment|createElement|createElementNS|elementFromPoint|getElementById|getRootNode|importNode|querySelector)$/u.test(
      calledMember.name
    )
  ) {
    return false;
  }
  return isDomReceiverExpression(
    calledMember.receiver,
    sourceFile,
    receiverBindings,
    useNode,
    visitedBindings
  );
}

function isDomCollectionExpression(
  expression,
  sourceFile,
  receiverBindings,
  useNode,
  visitedBindings
) {
  const candidate = unwrapTypeScriptExpression(expression);
  if (ts.isIdentifier(candidate)) {
    return receiverBindings.isIdentifierDomCollection(candidate.text, useNode, visitedBindings);
  }
  if (ts.isCallExpression(candidate)) {
    const calledMember = staticMemberAccess(candidate.expression);
    return Boolean(
      calledMember &&
      /^(?:elementsFromPoint|getElementsByClassName|getElementsByName|getElementsByTagName|getElementsByTagNameNS|querySelectorAll)$/u.test(
        calledMember.name
      ) &&
      isDomReceiverExpression(
        calledMember.receiver,
        sourceFile,
        receiverBindings,
        useNode,
        visitedBindings
      )
    );
  }
  const member = staticMemberAccess(candidate);
  return Boolean(
    member &&
    /^(?:childNodes|children|elements|forms|images|links|options|selectedOptions)$/u.test(
      member.name
    ) &&
    isDomReceiverExpression(member.receiver, sourceFile, receiverBindings, useNode, visitedBindings)
  );
}

function isDomReceiverExpression(
  expression,
  sourceFile,
  receiverBindings,
  useNode = expression,
  visitedBindings = new Set()
) {
  const candidate = unwrapTypeScriptExpression(expression);
  if (ts.isIdentifier(candidate)) {
    return receiverBindings.isIdentifierDomReceiver(candidate.text, useNode, visitedBindings);
  }
  if (
    ts.isElementAccessExpression(candidate) &&
    isDomCollectionExpression(
      candidate.expression,
      sourceFile,
      receiverBindings,
      useNode,
      visitedBindings
    )
  ) {
    return true;
  }
  if (ts.isCallExpression(candidate)) {
    const collectionMethod = staticMemberAccess(candidate.expression);
    if (
      collectionMethod &&
      /^(?:item|namedItem)$/u.test(collectionMethod.name) &&
      isDomCollectionExpression(
        collectionMethod.receiver,
        sourceFile,
        receiverBindings,
        useNode,
        visitedBindings
      )
    ) {
      return true;
    }
  }
  if (isDomAcquisitionCall(candidate, sourceFile, receiverBindings, useNode, visitedBindings)) {
    return true;
  }
  const member = staticMemberAccess(candidate);
  if (!member) return false;
  const owner = unwrapTypeScriptExpression(member.receiver);
  if (
    /^(?:body|documentElement|activeElement)$/u.test(member.name) &&
    ts.isIdentifier(owner) &&
    owner.text === 'document'
  ) {
    return true;
  }
  if (
    /^(?:currentTarget|target)$/u.test(member.name) &&
    ts.isIdentifier(owner) &&
    /^(?:e|ev|event)$/u.test(owner.text)
  ) {
    return true;
  }
  if (DOM_RECEIVER_VALUED_PROPERTY_NAMES.has(member.name)) {
    return isDomReceiverExpression(owner, sourceFile, receiverBindings, useNode, visitedBindings);
  }
  return (
    member.name === 'current' && ts.isIdentifier(owner) && /(?:Element|Node|Ref)$/u.test(owner.text)
  );
}

function astContainsInteractiveRuntime(content, { harnessGeometry = false } = {}) {
  const sourceFile = ts.createSourceFile(
    'website-source.tsx',
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const receiverBindings = domReceiverBindings(sourceFile);
  const geometryRefBindings = new Set();
  const collectGeometryRefs = (node) => {
    if (
      ts.isJsxAttribute(node) &&
      node.name.getText(sourceFile) === 'ref' &&
      node.initializer &&
      ts.isJsxExpression(node.initializer) &&
      node.initializer.expression &&
      ts.isIdentifier(node.initializer.expression)
    ) {
      const tag = node.parent.parent.tagName;
      if (tag && ts.isIdentifier(tag) && /^[a-z]/u.test(tag.text)) {
        const binding = receiverBindings.latestBinding(node.initializer.expression.text, node);
        if (binding) geometryRefBindings.add(binding);
      }
    }
    ts.forEachChild(node, collectGeometryRefs);
  };
  if (harnessGeometry) collectGeometryRefs(sourceFile);
  const isGeometryReceiver = (expression, useNode, seen = new Set()) => {
    const candidate = unwrapTypeScriptExpression(expression);
    if (ts.isIdentifier(candidate)) {
      const binding = receiverBindings.latestBinding(candidate.text, useNode);
      if (binding?.initializer && !binding.intrinsicallyDom) {
        if (seen.has(binding) || seen.size >= 64) return false;
        seen.add(binding);
        return isGeometryReceiver(binding.initializer, binding.node, seen);
      }
    }
    const member = staticMemberAccess(candidate);
    if (member?.name === 'current' && ts.isIdentifier(member.receiver))
      return geometryRefBindings.has(receiverBindings.latestBinding(member.receiver.text, useNode));
    return isDomReceiverExpression(candidate, sourceFile, receiverBindings, useNode);
  };
  const literalBindings = topLevelConstStringBindings(sourceFile);
  let found = false;
  const visit = (node) => {
    if (found) return;
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'addEventListener'
    ) {
      found = true;
      return;
    }
    if (ts.isCallExpression(node)) {
      const calledMember = staticMemberAccess(node.expression);
      if (calledMember) {
        const owner = calledMember.receiver.getText(sourceFile);
        const method = calledMember.name;
        if (
          owner === 'Object' &&
          method === 'assign' &&
          node.arguments[0] &&
          isDomReceiverExpression(node.arguments[0], sourceFile, receiverBindings, node) &&
          node.arguments.slice(1).some((argument) => {
            const source = unwrapTypeScriptExpression(argument);
            if (!ts.isObjectLiteralExpression(source)) return false;
            return source.properties.some((property) => {
              if (!('name' in property) || !property.name) return false;
              const propertyName = ts.isComputedPropertyName(property.name)
                ? unwrapTypeScriptExpression(property.name.expression)
                : property.name;
              const name =
                ts.isIdentifier(propertyName) || ts.isStringLiteralLike(propertyName)
                  ? propertyName.text
                  : null;
              return (
                name !== null &&
                (NATIVE_EVENT_ATTRIBUTE_NAMES.has(name) ||
                  GOVERNED_DOM_STATE_PROPERTY_NAMES.has(name))
              );
            });
          })
        ) {
          found = true;
          return;
        }
        if (
          (method === 'addEventListener' &&
            (!harnessGeometry ||
              isDomReceiverExpression(
                calledMember.receiver,
                sourceFile,
                receiverBindings,
                node
              ))) ||
          ((owner === 'customElements' || owner.endsWith('.customElements')) && method === 'define')
        ) {
          found = true;
          return;
        }
        if (
          harnessGeometry &&
          /^(?:getBoundingClientRect|getClientRects)$/u.test(method) &&
          isGeometryReceiver(calledMember.receiver, node)
        ) {
          found = true;
          return;
        }
        if (
          /^(?:blur|click|close|dispatchEvent|focus|hidePopover|scrollBy|scrollIntoView|scrollTo|select|setRangeText|setSelectionRange|showModal|showPopover|togglePopover)$/u.test(
            method
          ) &&
          isDomReceiverExpression(calledMember.receiver, sourceFile, receiverBindings, node)
        ) {
          found = true;
          return;
        }
        if (
          /^(?:removeAttribute|setAttribute|toggleAttribute)$/u.test(method) &&
          isDomReceiverExpression(calledMember.receiver, sourceFile, receiverBindings, node)
        ) {
          const nameArgument = node.arguments[0];
          const name =
            nameArgument && ts.isStringLiteralLike(nameArgument)
              ? nameArgument.text
              : nameArgument &&
                  ts.isIdentifier(nameArgument) &&
                  literalBindings.has(nameArgument.text)
                ? literalBindings.get(nameArgument.text)
                : null;
          const normalizedName = typeof name === 'string' ? name.toLowerCase() : null;
          if (
            normalizedName === null ||
            normalizedName.startsWith('aria-') ||
            GOVERNED_DOM_STATE_ATTRIBUTE_NAMES.has(normalizedName) ||
            NATIVE_EVENT_ATTRIBUTE_NAMES.has(normalizedName)
          ) {
            found = true;
            return;
          }
        }
        const classListAccess = staticMemberAccess(calledMember.receiver);
        if (
          classListAccess?.name === 'classList' &&
          isDomReceiverExpression(classListAccess.receiver, sourceFile, receiverBindings, node) &&
          /^(?:add|remove|replace|toggle)$/u.test(method)
        ) {
          found = true;
          return;
        }
      }
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    ) {
      const assignedProperty = staticMemberAccess(node.left);
      if (
        assignedProperty &&
        GOVERNED_DOM_STATE_PROPERTY_NAMES.has(assignedProperty.name) &&
        isDomReceiverExpression(assignedProperty.receiver, sourceFile, receiverBindings, node)
      ) {
        found = true;
        return;
      }
      const eventProperty = assignedProperty?.name;
      if (
        eventProperty &&
        NATIVE_EVENT_ATTRIBUTE_NAMES.has(eventProperty) &&
        (!harnessGeometry ||
          isDomReceiverExpression(assignedProperty.receiver, sourceFile, receiverBindings, node))
      ) {
        found = true;
        return;
      }
    }
    if (
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      (node.operator === ts.SyntaxKind.PlusPlusToken ||
        node.operator === ts.SyntaxKind.MinusMinusToken)
    ) {
      const updatedProperty = staticMemberAccess(node.operand);
      if (
        updatedProperty &&
        GOVERNED_DOM_STATE_PROPERTY_NAMES.has(updatedProperty.name) &&
        isDomReceiverExpression(updatedProperty.receiver, sourceFile, receiverBindings, node)
      ) {
        found = true;
        return;
      }
    }
    if (ts.isNewExpression(node)) {
      const constructorName = ts.isIdentifier(node.expression)
        ? node.expression.text
        : ts.isPropertyAccessExpression(node.expression)
          ? node.expression.name.text
          : node.expression.getText(sourceFile);
      if (/^(?:Intersection|Mutation|Resize)Observer$/u.test(constructorName)) {
        found = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function jsxOpeningTagCandidates(content) {
  const candidates = [];
  for (let start = 0; start < content.length; start += 1) {
    if (content[start] !== '<' || !/[A-Za-z]/u.test(content[start + 1] ?? '')) continue;

    let braceDepth = 0;
    let quote = null;
    let escaped = false;
    for (let cursor = start + 2; cursor < content.length; cursor += 1) {
      const character = content[cursor];
      if (quote) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === quote) quote = null;
        continue;
      }
      if (character === '"' || character === "'" || character === '`') {
        quote = character;
        continue;
      }
      if (character === '{') {
        braceDepth += 1;
        continue;
      }
      if (character === '}' && braceDepth > 0) {
        braceDepth -= 1;
        continue;
      }
      if (character === '<' && braceDepth === 0) break;
      if (character === '>' && braceDepth === 0) {
        candidates.push(content.slice(start, cursor + 1));
        start = cursor;
        break;
      }
    }
  }
  return candidates;
}

function maskStringsInMdxBraceExpressions(content) {
  const characters = [...content];
  let braceDepth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index];
    if (lineComment) {
      if (character === '\n' || character === '\r') lineComment = false;
      else characters[index] = ' ';
      continue;
    }
    if (blockComment) {
      if (character === '*' && characters[index + 1] === '/') {
        characters[index] = ' ';
        characters[index + 1] = ' ';
        index += 1;
        blockComment = false;
      } else if (character !== '\n' && character !== '\r') {
        characters[index] = ' ';
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = null;
      if (character !== '\n' && character !== '\r') characters[index] = ' ';
      continue;
    }
    if (braceDepth > 0 && (character === '"' || character === "'" || character === '`')) {
      quote = character;
      characters[index] = ' ';
      continue;
    }
    if (braceDepth > 0 && character === '/' && characters[index + 1] === '/') {
      lineComment = true;
      characters[index] = ' ';
      characters[index + 1] = ' ';
      index += 1;
      continue;
    }
    if (braceDepth > 0 && character === '/' && characters[index + 1] === '*') {
      blockComment = true;
      characters[index] = ' ';
      characters[index + 1] = ' ';
      index += 1;
      continue;
    }
    if (character === '{') braceDepth += 1;
    else if (character === '}' && braceDepth > 0) braceDepth -= 1;
  }
  return characters.join('');
}

function markupSourceForJsxFallback(content, absolutePath) {
  if (/\.mdx?$/i.test(absolutePath)) return maskStringsInMdxBraceExpressions(content);
  if (!/\.(?:html?|astro|vue|svelte)$/i.test(absolutePath)) return null;

  let markup = content;
  if (/\.astro$/i.test(absolutePath)) {
    markup = markup.replace(/^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/u, '');
  }
  return markup.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/giu, '');
}

function openingTagAttributeSyntax(candidate) {
  let syntax = '';
  let quote = null;
  let braceDepth = 0;
  let escaped = false;
  for (const character of candidate) {
    if (quote) {
      syntax += ' ';
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      syntax += ' ';
      continue;
    }
    if (character === '{') {
      braceDepth += 1;
      syntax += ' ';
      continue;
    }
    if (character === '}' && braceDepth > 0) {
      braceDepth -= 1;
      syntax += ' ';
      continue;
    }
    syntax += braceDepth > 0 ? ' ' : character;
  }
  return syntax;
}

function containsFrameworkTemplateEventDirective(candidate, absolutePath) {
  const syntax = openingTagAttributeSyntax(candidate);
  if (/\.vue$/i.test(absolutePath)) {
    return /(?:^|\s)(?:@(?:[A-Za-z][\w:-]*|\[[^\]\s]+\])|v-on(?::(?:[A-Za-z][\w:-]*|\[[^\]\s]+\]))?)(?:\.[A-Za-z][\w-]*)*(?=\s|=|\/?\s*>)/u.test(
      syntax
    );
  }
  if (/\.svelte$/i.test(absolutePath)) {
    return /(?:^|\s)on:[A-Za-z][\w-]*(?:\|[A-Za-z][\w-]*)*(?=\s|=|\/?\s*>)/u.test(syntax);
  }
  return false;
}

function containsJsxEventHandler(content, absolutePath) {
  if (
    !/\.mdx?$/i.test(absolutePath) &&
    (astContainsJsxEventHandler(content) || astContainsNativeJsxEventHandler(content, absolutePath))
  ) {
    return true;
  }
  if (
    /\.(?:astro|vue|svelte)$/i.test(absolutePath) &&
    embeddedScriptSegments(content).some((segment) => astContainsJsxEventHandler(segment))
  ) {
    return true;
  }

  const markupSource = markupSourceForJsxFallback(content, absolutePath);
  if (markupSource === null) return false;

  // Mixed markup sources are not a single TypeScript syntax tree, so parse
  // each real template opening-tag candidate independently after excluding
  // frontmatter and script regions. The scanner tracks expressions and quotes.
  return jsxOpeningTagCandidates(markupSource).some((candidate) => {
    const selfClosingCandidate = candidate.replace(/\/?\s*>$/u, ' />');
    return (
      astContainsJsxEventHandler(selfClosingCandidate) ||
      containsFrameworkTemplateEventDirective(candidate, absolutePath)
    );
  });
}

// Inventory only: SVG document execution has no reviewed admission profile.
// Do not interpret XML entities, evaluate scripts, or reuse HTML script/src rules.
function publicSvgSourceIssues(content) {
  const reasons = new Set();
  if (/[\u0000\ufffd]/u.test(content)) reasons.add('unsupported XML encoding');
  const markupParts = [];
  const styles = [];
  let style = null;
  let previousEnd = 0;
  // Tokenize processing instructions, comments, CDATA and quoted tags together.
  // A comment opener inside a PI or CDATA must not consume later real markup.
  for (const token of content.matchAll(
    /<(?:\?[\s\S]*?\?|!\[CDATA\[[\s\S]*?\]\]|!--[\s\S]*?--|(?:[^"'<>]|"[^"]*"|'[^']*')*)>/gu
  )) {
    if (style !== null) style += content.slice(previousEnd, token.index);
    previousEnd = token.index + token[0].length;
    if (token[0].startsWith('<?')) {
      if (/^<\?xml-stylesheet(?=[\s?])/iu.test(token[0])) {
        reasons.add('stylesheet resource instruction');
      }
      if (/^<\?xml\s/iu.test(token[0])) {
        const encoding = token[0].match(/\bencoding\s*=\s*['"]([^'"]+)['"]/iu)?.[1];
        if (encoding && !/^(?:utf-8|us-ascii)$/iu.test(encoding)) {
          reasons.add('unsupported XML encoding');
        }
      }
      continue;
    }
    if (token[0].startsWith('<!--')) continue;
    if (token[0].startsWith('<![CDATA[')) {
      if (style !== null) style += token[0].slice(9, -3);
      continue;
    }
    markupParts.push(token[0]);
    const styleTag = token[0].match(/^<(\/?)(?:[^\s/>:]+:)?style(?=[\s/>])/iu);
    if (styleTag?.[1] === '/') {
      if (style !== null) styles.push(style);
      style = null;
    } else if (styleTag && !/\/\s*>$/u.test(token[0])) {
      if (style !== null) styles.push(style);
      style = '';
    } else if (style !== null) {
      style += token[0];
    }
  }
  if (style !== null) styles.push(style + content.slice(previousEnd));
  const markup = markupParts.join('');
  if (/<!ENTITY\b|<!DOCTYPE\b[^>]*\[/iu.test(markup)) {
    reasons.add('XML entity declarations or internal subset');
  }
  // Preserve the exact conventional declaration already used by retained static
  // whitepaper art. This does not resolve/fetch the DTD or admit active XML.
  const legacySvgDoctype =
    '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">';
  for (const match of markup.matchAll(/<!DOCTYPE\b(?:"[^"]*"|'[^']*'|[^"'<>])*>/giu)) {
    if (/\b(?:SYSTEM|PUBLIC)\b/u.test(match[0]) && match[0] !== legacySvgDoctype) {
      reasons.add('external XML document-type resource');
    }
  }

  const isFragment = (value) => /^#[^\s&\\{}]+$/u.test(value);
  const isEmbeddedImage = (value) =>
    /^data:image\/(?:png|gif|jpeg|webp|avif|svg\+xml);base64,[A-Za-z0-9+/=]+$/iu.test(value);
  const isEmbeddedFont = (value) =>
    /^data:font\/(?:woff2?|ttf|otf);base64,[A-Za-z0-9+/=]+$/iu.test(value);
  const inspectStyle = (style) => {
    let source = '';
    let quote = null;
    for (let index = 0; index < style.length; index += 1) {
      const character = style[index];
      if (quote) {
        source += character;
        if (character === '\\') source += style[++index] ?? '';
        else if (character === quote) quote = null;
      } else if (character === '"' || character === "'") {
        quote = character;
        source += character;
      } else if (character === '/' && style[index + 1] === '*') {
        const end = style.indexOf('*/', index + 2);
        if (end === -1) break;
        index = end + 1;
      } else {
        source += character;
      }
    }
    // Escapes/entities can conceal resource syntax. Keep it unverified instead
    // of claiming CSS/XML decoding or treating candidate text as trusted code.
    if (/\\|&|@import\b|(?:-webkit-)?image-set\s*\(/iu.test(source)) {
      reasons.add('encoded, imported or image-set stylesheet resource');
    }
    for (const opening of source.matchAll(/url\(/giu)) {
      const match = source
        .slice(opening.index + opening[0].length)
        .match(/^\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/u);
      if (!match) {
        reasons.add('unresolved stylesheet resource URL');
        continue;
      }
      const value = (match[1] ?? match[2] ?? match[3]).trim();
      if (!isFragment(value) && !isEmbeddedFont(value) && !isEmbeddedImage(value)) {
        reasons.add('stylesheet resource URL');
      }
    }
  };
  for (const style of styles) inspectStyle(style);
  // XML quotes have no backslash escape. Consume complete quoted attributes so
  // event-like text inside an ordinary value does not create another attribute.
  for (const match of markup.matchAll(
    /<([^\s/<>"'=!?]+)(?=[\s/>])((?:"[^"]*"|'[^']*'|[^"'<>])*)>/gu
  )) {
    const localName = match[1].split(':').at(-1).toLowerCase();
    if (localName === 'script') reasons.add('script element (inline or href/xlink:href resource)');
    if (/^(?:foreignobject|iframe|object|embed|webview)$/u.test(localName)) {
      reasons.add('foreign content element');
    }
    if (/^(?:animate(?:motion|transform|color)?|set|discard)$/u.test(localName)) {
      reasons.add('declarative animation');
    }
    for (const attribute of match[2].matchAll(
      /([^\s=/'">]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gu
    )) {
      const name = attribute[1].toLowerCase();
      const attributeName = name.split(':').at(-1);
      const value = attribute[2] ?? attribute[3] ?? attribute[4];
      if (/^on[a-z]/u.test(attributeName)) reasons.add('event handler attribute');
      if (name === 'xmlns' || name.startsWith('xmlns:')) continue;
      if (attributeName === 'href' || attributeName === 'src' || name === 'xml:base') {
        // Local paint/use fragments and embedded image-mode bytes are static
        // cases, not authorization to open those bytes as an active document.
        if (!isFragment(value) && !(localName === 'image' && isEmbeddedImage(value))) {
          reasons.add('document resource attribute');
        }
      }
      if (
        /^(?:style|fill|stroke|filter|clip-path|mask|cursor|marker(?:-start|-mid|-end)?)$/u.test(
          attributeName
        ) ||
        /url\s*\(/iu.test(value)
      )
        inspectStyle(value);
    }
  }
  return [...reasons];
}

function containsInteractiveSource(content, absolutePath) {
  if (/\.svg$/i.test(absolutePath)) return publicSvgSourceIssues(content).length > 0;
  if (/\.[cm]?[jt]sx?$/i.test(absolutePath)) {
    return astContainsInteractiveRuntime(content) || containsJsxEventHandler(content, absolutePath);
  }
  return (
    (/\.mdx?$/i.test(absolutePath) && astContainsInteractiveRuntime(content)) ||
    INTERACTIVE_SOURCE_PATTERNS.some((pattern) => pattern.test(content)) ||
    containsJsxEventHandler(content, absolutePath)
  );
}

function discoverWebsiteInteractiveSources(rootDir) {
  const sourceRoot = path.join(rootDir, 'apps', 'www', 'src');
  const contentRoot = path.join(sourceRoot, 'content', 'docs');
  const publicRoot = path.join(rootDir, 'apps', 'www', 'public');
  const candidates = walkFiles(sourceRoot)
    .filter((absolutePath) => /\.(?:html?|astro|vue|svelte|[cm]?[jt]sx?)$/.test(absolutePath))
    .filter((absolutePath) => !absolutePath.startsWith(`${contentRoot}${path.sep}`))
    .concat(
      walkFiles(contentRoot).filter((absolutePath) =>
        /\.(?:astro|mdx?|vue|svelte)$/i.test(absolutePath)
      )
    )
    .concat(walkFiles(contentRoot).filter((absolutePath) => /\.[cm]?[jt]sx?$/.test(absolutePath)))
    .concat(
      walkFiles(publicRoot).filter((absolutePath) =>
        /\.(?:svg|html?|[cm]?[jt]sx?)$/i.test(absolutePath)
      )
    )
    .filter((absolutePath, index, files) => files.indexOf(absolutePath) === index);
  const reachable = reachableSourcePaths(
    candidates,
    configuredWebsiteSourceAliases(rootDir),
    rootDir
  );
  return [...new Set([...candidates, ...reachable])]
    .filter((absolutePath) => !isTestNamedSource(absolutePath) || reachable.has(absolutePath))
    .filter((absolutePath) =>
      containsInteractiveSource(sourceTextForInteractionScan(absolutePath), absolutePath)
    )
    .map((absolutePath) => path.relative(rootDir, absolutePath).replaceAll('\\', '/'))
    .sort();
}

function discoverWebsiteComponentSources(rootDir) {
  const websiteSourceRoot = path.join(rootDir, 'apps', 'www', 'src');
  const pagesRoot = path.join(websiteSourceRoot, 'pages');
  const publicRoot = path.join(rootDir, 'apps', 'www', 'public');
  return walkFiles(websiteSourceRoot)
    .concat(walkFiles(publicRoot).filter((absolutePath) => /\.html?$/i.test(absolutePath)))
    .filter(
      (absolutePath) =>
        !/\.(?:browser\.)?(?:test|spec)\.(?:astro|vue|svelte|[cm]?[jt]sx?)$/i.test(absolutePath)
    )
    .filter((absolutePath) => {
      if (absolutePath.startsWith(`${publicRoot}${path.sep}`) && /\.html?$/i.test(absolutePath)) {
        return true;
      }
      if (/\.(?:astro|vue|svelte)$/i.test(absolutePath)) return true;
      if (absolutePath.startsWith(`${pagesRoot}${path.sep}`) && /\.mdx?$/i.test(absolutePath)) {
        return true;
      }
      return (
        /\.[cm]?[jt]sx?$/i.test(absolutePath) &&
        astContainsExportedUserFacingComponent(fs.readFileSync(absolutePath, 'utf8'), absolutePath)
      );
    })
    .map((absolutePath) => path.relative(rootDir, absolutePath).replaceAll('\\', '/'))
    .sort();
}

function astContainsExportedUserFacingComponent(content, absolutePath) {
  const scriptKind = /\.jsx$/i.test(absolutePath)
    ? ts.ScriptKind.JSX
    : /\.js$/i.test(absolutePath)
      ? ts.ScriptKind.JS
      : /\.ts$/i.test(absolutePath)
        ? ts.ScriptKind.TS
        : ts.ScriptKind.TSX;
  const sourceFile = ts.createSourceFile(
    absolutePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    scriptKind
  );
  const reactNamespaceNames = new Set();
  const reactCreateElementNames = new Set();
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteralLike(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== 'react'
    ) {
      continue;
    }
    const importClause = statement.importClause;
    if (importClause?.name) reactNamespaceNames.add(importClause.name.text);
    if (importClause?.namedBindings && ts.isNamespaceImport(importClause.namedBindings)) {
      reactNamespaceNames.add(importClause.namedBindings.name.text);
    }
    if (importClause?.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
      for (const element of importClause.namedBindings.elements) {
        if ((element.propertyName ?? element.name).text === 'createElement') {
          reactCreateElementNames.add(element.name.text);
        }
      }
    }
  }

  const containsRenderedSurface = (root) => {
    let found = false;
    const visit = (node) => {
      if (found) return;
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) {
        found = true;
        return;
      }
      if (ts.isCallExpression(node)) {
        if (
          ts.isPropertyAccessExpression(node.expression) &&
          ts.isIdentifier(node.expression.expression) &&
          reactNamespaceNames.has(node.expression.expression.text) &&
          node.expression.name.text === 'createElement'
        ) {
          found = true;
          return;
        }
        if (ts.isIdentifier(node.expression) && reactCreateElementNames.has(node.expression.text)) {
          found = true;
          return;
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(root);
    return found;
  };

  const renderedLocalNames = new Set();
  const localCallableDeclarations = new Map();
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name && statement.body) {
      localCallableDeclarations.set(statement.name.text, statement);
    }
    if (
      (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) &&
      statement.name &&
      containsRenderedSurface(statement)
    ) {
      renderedLocalNames.add(statement.name.text);
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.initializer &&
          (ts.isArrowFunction(unwrapTypeScriptExpression(declaration.initializer)) ||
            ts.isFunctionExpression(unwrapTypeScriptExpression(declaration.initializer)))
        ) {
          localCallableDeclarations.set(declaration.name.text, declaration.initializer);
        }
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.initializer &&
          containsRenderedSurface(declaration.initializer)
        ) {
          renderedLocalNames.add(declaration.name.text);
        }
      }
    }
  }
  const callsRenderedLocal = (root) => {
    let found = false;
    const visit = (node) => {
      if (found) return;
      if (node !== root && ts.isFunctionLike(node)) return;
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(unwrapTypeScriptExpression(node.expression)) &&
        renderedLocalNames.has(unwrapTypeScriptExpression(node.expression).text)
      ) {
        found = true;
        return;
      }
      ts.forEachChild(node, visit);
    };
    visit(root);
    return found;
  };
  let renderedLocalsChanged = true;
  while (renderedLocalsChanged) {
    renderedLocalsChanged = false;
    for (const [name, declaration] of localCallableDeclarations) {
      if (!renderedLocalNames.has(name) && callsRenderedLocal(declaration)) {
        renderedLocalNames.add(name);
        renderedLocalsChanged = true;
      }
    }
  }
  const wrappedExpressionReferencesRenderedLocal = (expression) => {
    const candidate = unwrapTypeScriptExpression(expression);
    if (ts.isIdentifier(candidate)) return renderedLocalNames.has(candidate.text);
    return (
      ts.isCallExpression(candidate) &&
      candidate.arguments.some(wrappedExpressionReferencesRenderedLocal)
    );
  };

  return sourceFile.statements.some((statement) => {
    const directlyExported = statement.modifiers?.some(
      (modifier) =>
        modifier.kind === ts.SyntaxKind.ExportKeyword ||
        modifier.kind === ts.SyntaxKind.DefaultKeyword
    );
    if (directlyExported && containsRenderedSurface(statement)) return true;
    if (
      directlyExported &&
      (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) &&
      statement.name &&
      renderedLocalNames.has(statement.name.text)
    ) {
      return true;
    }
    if (
      directlyExported &&
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some(
        (declaration) =>
          declaration.initializer &&
          wrappedExpressionReferencesRenderedLocal(declaration.initializer)
      )
    ) {
      return true;
    }
    if (ts.isExportAssignment(statement)) {
      return (
        containsRenderedSurface(statement.expression) ||
        wrappedExpressionReferencesRenderedLocal(statement.expression)
      );
    }
    if (
      ts.isExportDeclaration(statement) &&
      !statement.moduleSpecifier &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      return statement.exportClause.elements.some((element) =>
        renderedLocalNames.has((element.propertyName ?? element.name).text)
      );
    }
    return false;
  });
}
function countHarnessExportedUserFacingSurfaces(content, absolutePath) {
  const scriptKind = /\.jsx$/i.test(absolutePath)
    ? ts.ScriptKind.JSX
    : /\.js$/i.test(absolutePath)
      ? ts.ScriptKind.JS
      : /\.ts$/i.test(absolutePath)
        ? ts.ScriptKind.TS
        : ts.ScriptKind.TSX;
  const sourceFile = ts.createSourceFile(
    absolutePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    scriptKind
  );
  const renderedLocalNames = new Set();
  const localCallableDeclarations = new Map();
  const containsRenderedSurface = (root) => {
    let rendered = false;
    const visit = (node) => {
      if (rendered) return;
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) {
        rendered = true;
        return;
      }
      if (ts.isCallExpression(node)) {
        const expression = unwrapTypeScriptExpression(node.expression);
        if (
          (ts.isPropertyAccessExpression(expression) && expression.name.text === 'createElement') ||
          (ts.isIdentifier(expression) && expression.text === 'createElement')
        ) {
          rendered = true;
          return;
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(root);
    return rendered;
  };
  const wrappedExpressionReferencesRenderedLocal = (expression) => {
    const candidate = unwrapTypeScriptExpression(expression);
    if (ts.isIdentifier(candidate)) return renderedLocalNames.has(candidate.text);
    return (
      ts.isCallExpression(candidate) &&
      candidate.arguments.some(wrappedExpressionReferencesRenderedLocal)
    );
  };
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name && statement.body) {
      localCallableDeclarations.set(statement.name.text, statement);
    }
    if (
      (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) &&
      statement.name &&
      containsRenderedSurface(statement)
    ) {
      renderedLocalNames.add(statement.name.text);
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.initializer &&
          (ts.isArrowFunction(unwrapTypeScriptExpression(declaration.initializer)) ||
            ts.isFunctionExpression(unwrapTypeScriptExpression(declaration.initializer)))
        ) {
          localCallableDeclarations.set(declaration.name.text, declaration.initializer);
        }
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.initializer &&
          containsRenderedSurface(declaration.initializer)
        ) {
          renderedLocalNames.add(declaration.name.text);
        }
      }
    }
  }
  const callsRenderedLocal = (root) => {
    let found = false;
    const visit = (node) => {
      if (found) return;
      if (node !== root && ts.isFunctionLike(node)) return;
      const expression = ts.isCallExpression(node)
        ? unwrapTypeScriptExpression(node.expression)
        : null;
      if (expression && ts.isIdentifier(expression) && renderedLocalNames.has(expression.text)) {
        found = true;
        return;
      }
      ts.forEachChild(node, visit);
    };
    visit(root);
    return found;
  };
  let renderedLocalsChanged = true;
  while (renderedLocalsChanged) {
    renderedLocalsChanged = false;
    for (const [name, declaration] of localCallableDeclarations) {
      if (!renderedLocalNames.has(name) && callsRenderedLocal(declaration)) {
        renderedLocalNames.add(name);
        renderedLocalsChanged = true;
      }
    }
  }
  const exportedNames = new Set();
  for (const statement of sourceFile.statements) {
    const isExported = statement.modifiers?.some(
      (modifier) =>
        modifier.kind === ts.SyntaxKind.ExportKeyword ||
        modifier.kind === ts.SyntaxKind.DefaultKeyword
    );
    if (isExported && (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement))) {
      if (statement.name && renderedLocalNames.has(statement.name.text)) {
        exportedNames.add(statement.name.text);
      } else if (
        !statement.name &&
        statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword) &&
        containsRenderedSurface(statement)
      ) {
        exportedNames.add('default');
      }
    } else if (isExported && ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.initializer &&
          (containsRenderedSurface(declaration.initializer) ||
            wrappedExpressionReferencesRenderedLocal(declaration.initializer))
        ) {
          exportedNames.add(declaration.name.text);
        }
      }
    } else if (ts.isExportAssignment(statement)) {
      if (
        containsRenderedSurface(statement.expression) ||
        wrappedExpressionReferencesRenderedLocal(statement.expression)
      ) {
        exportedNames.add('default');
      }
    } else if (
      ts.isExportDeclaration(statement) &&
      !statement.moduleSpecifier &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        const localName = (element.propertyName ?? element.name).text;
        if (renderedLocalNames.has(localName)) exportedNames.add(element.name.text);
      }
    }
  }
  return exportedNames.size;
}

function discoverHarnessUserFacingSources(rootDir) {
  const sourceRoot = path.join(rootDir, 'apps', 'agent-harness', 'src');
  return walkFiles(sourceRoot)
    .filter((absolutePath) => /\.[cm]?[jt]sx?$/i.test(absolutePath))
    .filter((absolutePath) => {
      const relativePath = path.relative(sourceRoot, absolutePath).replaceAll('\\', '/');
      return (
        !/\.(?:browser\.)?(?:test|spec|stories)\.[cm]?[jt]sx?$/i.test(absolutePath) &&
        !isGeneratedHarnessFacadeSource(relativePath)
      );
    })
    .filter((absolutePath) => {
      const relativeToSource = path.relative(sourceRoot, absolutePath).replaceAll('\\', '/');
      const isRoutedOrPageLevel = /^(?:pages|routes)\//u.test(relativeToSource);
      const content = fs.readFileSync(absolutePath, 'utf8');
      return isRoutedOrPageLevel || astContainsExportedUserFacingComponent(content, absolutePath);
    })
    .map((absolutePath) => path.relative(rootDir, absolutePath).replaceAll('\\', '/'))
    .sort();
}

function astContainsNativeJsxEventHandler(content, absolutePath) {
  const sourceFile = ts.createSourceFile(
    absolutePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    /\.jsx$/i.test(absolutePath) ? ts.ScriptKind.JSX : ts.ScriptKind.TSX
  );
  const reactNamespaceNames = new Set();
  const reactCreateElementNames = new Set();
  const importedObjectBindings = new Map();
  const resolveRelativeModule = (specifier) => {
    if (!specifier.startsWith('.')) return null;
    const base = path.resolve(
      path.dirname(absolutePath),
      importSpecifierWithoutViteSuffix(specifier)
    );
    const variants = [
      base,
      ...['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts'].map(
        (extension) => `${base}${extension}`
      ),
      ...['index.js', 'index.jsx', 'index.mjs', 'index.cjs', 'index.ts', 'index.tsx'].map((name) =>
        path.join(base, name)
      ),
    ];
    return (
      variants.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) ??
      null
    );
  };
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteralLike(statement.moduleSpecifier)) {
      continue;
    }
    const importClause = statement.importClause;
    const specifier = statement.moduleSpecifier.text;
    if (specifier === 'react') {
      if (importClause?.name) reactNamespaceNames.add(importClause.name.text);
      if (importClause?.namedBindings && ts.isNamespaceImport(importClause.namedBindings)) {
        reactNamespaceNames.add(importClause.namedBindings.name.text);
      }
      if (importClause?.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
        for (const element of importClause.namedBindings.elements) {
          if (
            !element.isTypeOnly &&
            (element.propertyName ?? element.name).text === 'createElement'
          ) {
            reactCreateElementNames.add(element.name.text);
          }
        }
      }
      continue;
    }
    if (!importClause || importClause.isTypeOnly) continue;
    const targetPath = resolveRelativeModule(specifier);
    const addImportedObject = (localName, importedName) => {
      importedObjectBindings.set(localName, { importedName, targetPath });
    };
    if (importClause.name) addImportedObject(importClause.name.text, 'default');
    if (importClause.namedBindings && ts.isNamespaceImport(importClause.namedBindings)) {
      addImportedObject(importClause.namedBindings.name.text, '*');
    } else if (importClause.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
      for (const element of importClause.namedBindings.elements) {
        if (!element.isTypeOnly) {
          addImportedObject(element.name.text, (element.propertyName ?? element.name).text);
        }
      }
    }
  }
  const isNativeEventName = (name) => {
    if (/^on[A-Z][A-Za-z0-9_$]*$/u.test(name) || NATIVE_EVENT_ATTRIBUTE_NAMES.has(name)) {
      return true;
    }
    if (!/[A-Z]/u.test(name)) return false;
    const asciiLowercaseName = name.replace(/[A-Z]/gu, (character) =>
      String.fromCharCode(character.charCodeAt(0) + 32)
    );
    return NATIVE_EVENT_ATTRIBUTE_NAMES.has(asciiLowercaseName);
  };
  const objectPropertyName = (name) => {
    if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text;
    if (ts.isComputedPropertyName(name)) {
      const expression = unwrapTypeScriptExpression(name.expression);
      if (ts.isStringLiteralLike(expression)) return expression.text;
    }
    return null;
  };
  const objectLiteralHasNativeEvent = (objectLiteral, useNode, visitedBindings, visitedCallables) =>
    objectLiteral.properties.some((property) => {
      if (ts.isSpreadAssignment(property)) {
        return expressionHasNativeEventObject(
          property.expression,
          useNode,
          new Set(visitedBindings),
          new Set(visitedCallables)
        );
      }
      if (
        !ts.isPropertyAssignment(property) &&
        !ts.isMethodDeclaration(property) &&
        !ts.isShorthandPropertyAssignment(property)
      ) {
        return false;
      }
      const name = objectPropertyName(property.name);
      return name !== null && isNativeEventName(name);
    });
  const objectBindings = new Map();
  const callableBindings = new Map();
  const lexicalScope = (node) => {
    for (let current = node.parent; current; current = current.parent) {
      if (ts.isBlock(current) || ts.isFunctionLike(current) || ts.isSourceFile(current)) {
        return current;
      }
    }
    return sourceFile;
  };
  const collectObjectBindings = (node) => {
    if ((ts.isVariableDeclaration(node) || ts.isParameter(node)) && ts.isIdentifier(node.name)) {
      const bindings = objectBindings.get(node.name.text) ?? [];
      bindings.push({
        initializer: node.initializer ? unwrapTypeScriptExpression(node.initializer) : null,
        node,
        position: node.getStart(sourceFile),
        scope: lexicalScope(node),
      });
      objectBindings.set(node.name.text, bindings);
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const initializer = unwrapTypeScriptExpression(node.initializer);
      if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) {
        const bindings = callableBindings.get(node.name.text) ?? [];
        bindings.push({
          callable: initializer,
          hoisted: false,
          position: node.getStart(sourceFile),
          scope: lexicalScope(node),
        });
        callableBindings.set(node.name.text, bindings);
      }
    }
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      const bindings = callableBindings.get(node.name.text) ?? [];
      bindings.push({
        callable: node,
        hoisted: true,
        position: node.getStart(sourceFile),
        scope: lexicalScope(node),
      });
      callableBindings.set(node.name.text, bindings);
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.left)
    ) {
      const bindings = objectBindings.get(node.left.text) ?? [];
      bindings.push({
        initializer: unwrapTypeScriptExpression(node.right),
        node,
        position: node.getStart(sourceFile),
        scope: lexicalScope(node),
      });
      objectBindings.set(node.left.text, bindings);
    }
    ts.forEachChild(node, collectObjectBindings);
  };
  collectObjectBindings(sourceFile);
  const resolveCallable = (name, useNode) => {
    const bindings = callableBindings.get(name) ?? [];
    const usePosition = useNode.getStart(sourceFile);
    for (let scope = lexicalScope(useNode); scope; scope = lexicalScope(scope)) {
      const binding = bindings
        .filter((entry) => entry.scope === scope && (entry.hoisted || entry.position < usePosition))
        .sort((left, right) => right.position - left.position)[0];
      if (binding) return binding.callable;
      if (ts.isSourceFile(scope)) break;
    }
    return null;
  };
  const callableReturnExpressions = (callable) => {
    if (ts.isArrowFunction(callable) && !ts.isBlock(callable.body)) {
      return [{ expression: callable.body, useNode: callable }];
    }
    const returned = [];
    const visit = (node) => {
      if (node !== callable && ts.isFunctionLike(node)) return;
      if (ts.isReturnStatement(node) && node.expression) {
        returned.push({ expression: node.expression, useNode: node });
        return;
      }
      ts.forEachChild(node, visit);
    };
    if (callable.body) visit(callable.body);
    return returned;
  };
  const importedObjectHasNativeEvent = (name) => {
    const imported = importedObjectBindings.get(name);
    if (!imported) return false;
    if (!imported.targetPath || imported.importedName === '*') return true;

    let targetContent;
    try {
      targetContent = fs.readFileSync(imported.targetPath, 'utf8');
    } catch {
      return true;
    }
    const targetSourceFile = ts.createSourceFile(
      imported.targetPath,
      targetContent,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
    const localInitializers = new Map();
    for (const statement of targetSourceFile.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.initializer) {
          localInitializers.set(
            declaration.name.text,
            unwrapTypeScriptExpression(declaration.initializer)
          );
        }
      }
    }

    let localName = imported.importedName;
    let initializer = null;
    if (localName === 'default') {
      const exportedDefault = targetSourceFile.statements.find(
        (statement) => ts.isExportAssignment(statement) && !statement.isExportEquals
      );
      initializer = exportedDefault?.expression ?? null;
    } else {
      for (const statement of targetSourceFile.statements) {
        if (
          ts.isVariableStatement(statement) &&
          statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
        ) {
          const declaration = statement.declarationList.declarations.find(
            (candidate) => ts.isIdentifier(candidate.name) && candidate.name.text === localName
          );
          if (declaration?.initializer) initializer = declaration.initializer;
        }
        if (
          ts.isExportDeclaration(statement) &&
          statement.exportClause &&
          ts.isNamedExports(statement.exportClause)
        ) {
          const reexport = statement.exportClause.elements.find(
            (element) => element.name.text === localName
          );
          if (reexport) {
            if (statement.moduleSpecifier) return true;
            localName = (reexport.propertyName ?? reexport.name).text;
          }
        }
      }
      initializer ??= localInitializers.get(localName) ?? null;
    }
    if (!initializer) return true;

    const inspect = (expression, visitedNames = new Set()) => {
      const candidate = unwrapTypeScriptExpression(expression);
      if (ts.isObjectLiteralExpression(candidate)) {
        return candidate.properties.some((property) => {
          if (ts.isSpreadAssignment(property)) return true;
          if (!('name' in property) || !property.name) return false;
          const propertyName = objectPropertyName(property.name);
          return propertyName === null || isNativeEventName(propertyName);
        });
      }
      if (ts.isIdentifier(candidate)) {
        if (visitedNames.has(candidate.text)) return true;
        const localInitializer = localInitializers.get(candidate.text);
        if (!localInitializer) return true;
        visitedNames.add(candidate.text);
        return inspect(localInitializer, visitedNames);
      }
      return true;
    };
    return inspect(initializer);
  };
  const expressionHasNativeEventObject = (
    expression,
    useNode,
    visitedBindings = new Set(),
    visitedCallables = new Set()
  ) => {
    const candidate = unwrapTypeScriptExpression(expression);
    if (ts.isObjectLiteralExpression(candidate)) {
      return objectLiteralHasNativeEvent(candidate, useNode, visitedBindings, visitedCallables);
    }
    if (ts.isCallExpression(candidate)) {
      const callee = unwrapTypeScriptExpression(candidate.expression);
      if (!ts.isIdentifier(callee)) return false;
      const callable = resolveCallable(callee.text, candidate);
      if (!callable || visitedCallables.has(callable)) return false;
      visitedCallables.add(callable);
      return callableReturnExpressions(callable).some((returned) =>
        expressionHasNativeEventObject(
          returned.expression,
          returned.useNode,
          new Set(visitedBindings),
          new Set(visitedCallables)
        )
      );
    }
    if (!ts.isIdentifier(candidate)) return false;

    const bindings = objectBindings.get(candidate.text) ?? [];
    const usePosition = useNode.getStart(sourceFile);
    for (let scope = lexicalScope(useNode); scope; scope = lexicalScope(scope)) {
      const binding = bindings
        .filter((entry) => entry.scope === scope && entry.position < usePosition)
        .sort((left, right) => right.position - left.position)[0];
      if (binding) {
        if (!binding.initializer || visitedBindings.has(binding)) return false;
        visitedBindings.add(binding);
        return expressionHasNativeEventObject(
          binding.initializer,
          binding.node,
          visitedBindings,
          visitedCallables
        );
      }
      if (ts.isSourceFile(scope)) break;
    }
    return importedObjectHasNativeEvent(candidate.text);
  };
  let found = false;
  const visit = (node) => {
    if (found) return;
    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name)) {
      const element = node.parent?.parent;
      const tagName =
        (ts.isJsxOpeningElement(element) || ts.isJsxSelfClosingElement(element)) &&
        ts.isIdentifier(element.tagName)
          ? element.tagName.text
          : null;
      if (tagName && /^[a-z]/u.test(tagName) && isNativeEventName(node.name.text)) {
        found = true;
        return;
      }
    }
    if (ts.isJsxSpreadAttribute(node)) {
      const element = node.parent?.parent;
      const tagName =
        (ts.isJsxOpeningElement(element) || ts.isJsxSelfClosingElement(element)) &&
        ts.isIdentifier(element.tagName)
          ? element.tagName.text
          : null;
      if (
        tagName &&
        /^[a-z]/u.test(tagName) &&
        expressionHasNativeEventObject(node.expression, node)
      ) {
        found = true;
        return;
      }
    }
    if (ts.isCallExpression(node) && node.arguments.length >= 2) {
      const isReactCreateElement =
        (ts.isPropertyAccessExpression(node.expression) &&
          ts.isIdentifier(node.expression.expression) &&
          reactNamespaceNames.has(node.expression.expression.text) &&
          node.expression.name.text === 'createElement') ||
        (ts.isIdentifier(node.expression) && reactCreateElementNames.has(node.expression.text));
      const intrinsicTag = node.arguments[0];
      const props = node.arguments[1];
      if (
        isReactCreateElement &&
        ts.isStringLiteralLike(intrinsicTag) &&
        expressionHasNativeEventObject(props, node)
      ) {
        found = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function astContainsHarnessRenderOrEffectAction(content, absolutePath, visitedPaths = new Set()) {
  const canonicalPath = path.resolve(absolutePath);
  if (visitedPaths.has(canonicalPath)) return false;
  const nextVisitedPaths = new Set(visitedPaths);
  nextVisitedPaths.add(canonicalPath);
  const sourceFile = ts.createSourceFile(
    absolutePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    /\.jsx$/i.test(absolutePath)
      ? ts.ScriptKind.JSX
      : /\.js$/i.test(absolutePath)
        ? ts.ScriptKind.JS
        : /\.ts$/i.test(absolutePath)
          ? ts.ScriptKind.TS
          : ts.ScriptKind.TSX
  );
  const effectNames = new Set(['useEffect', 'useInsertionEffect', 'useLayoutEffect']);
  const imperativeHandleNames = new Set(['useImperativeHandle']);
  const callbackFactoryNames = new Set(['useCallback']);
  const renderEvaluatedHooks = new Map([
    ['useMemo', 'useMemo'],
    ['useState', 'useState'],
    ['useReducer', 'useReducer'],
    ['useSyncExternalStore', 'useSyncExternalStore'],
  ]);
  const reactNamespaceNames = new Set();
  const reactCreateElementNames = new Set();
  const importedCallables = new Map();
  const resolveRelativeModule = (specifier) => {
    if (!specifier.startsWith('.')) return null;
    const base = path.resolve(
      path.dirname(absolutePath),
      importSpecifierWithoutViteSuffix(specifier)
    );
    const variants = [
      base,
      ...['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts'].map(
        (extension) => `${base}${extension}`
      ),
      ...['index.js', 'index.jsx', 'index.mjs', 'index.cjs', 'index.ts', 'index.tsx'].map((name) =>
        path.join(base, name)
      ),
    ];
    return (
      variants.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) ??
      null
    );
  };
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteralLike(statement.moduleSpecifier)) {
      continue;
    }
    const importClause = statement.importClause;
    if (statement.moduleSpecifier.text !== 'react') {
      const targetPath = resolveRelativeModule(statement.moduleSpecifier.text);
      if (targetPath && importClause?.name) {
        importedCallables.set(importClause.name.text, {
          importedName: 'default',
          targetPath,
        });
      }
      if (
        targetPath &&
        importClause?.namedBindings &&
        ts.isNamedImports(importClause.namedBindings)
      ) {
        for (const element of importClause.namedBindings.elements) {
          importedCallables.set(element.name.text, {
            importedName: (element.propertyName ?? element.name).text,
            targetPath,
          });
        }
      }
      continue;
    }
    if (importClause?.name) reactNamespaceNames.add(importClause.name.text);
    if (importClause?.namedBindings && ts.isNamespaceImport(importClause.namedBindings)) {
      reactNamespaceNames.add(importClause.namedBindings.name.text);
    }
    if (importClause?.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
      for (const element of importClause.namedBindings.elements) {
        const importedName = (element.propertyName ?? element.name).text;
        if (/^(?:useEffect|useInsertionEffect|useLayoutEffect)$/u.test(importedName)) {
          effectNames.add(element.name.text);
        }
        if (importedName === 'useImperativeHandle') imperativeHandleNames.add(element.name.text);
        if (importedName === 'useCallback') callbackFactoryNames.add(element.name.text);
        if (/^(?:useMemo|useReducer|useState|useSyncExternalStore)$/u.test(importedName)) {
          renderEvaluatedHooks.set(element.name.text, importedName);
        }
        if (importedName === 'createElement') reactCreateElementNames.add(element.name.text);
      }
    }
  }

  const hookAliasEdges = [];
  const collectHookAliases = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const initializer = unwrapTypeScriptExpression(node.initializer);
      if (
        ts.isPropertyAccessExpression(initializer) &&
        ts.isIdentifier(initializer.expression) &&
        reactNamespaceNames.has(initializer.expression.text)
      ) {
        if (/^(?:useEffect|useInsertionEffect|useLayoutEffect)$/u.test(initializer.name.text)) {
          effectNames.add(node.name.text);
        }
        if (initializer.name.text === 'useImperativeHandle') {
          imperativeHandleNames.add(node.name.text);
        }
        if (initializer.name.text === 'useCallback') callbackFactoryNames.add(node.name.text);
        if (/^(?:useMemo|useReducer|useState|useSyncExternalStore)$/u.test(initializer.name.text)) {
          renderEvaluatedHooks.set(node.name.text, initializer.name.text);
        }
      } else if (ts.isIdentifier(initializer)) {
        hookAliasEdges.push([node.name.text, initializer.text]);
      }
    }
    if (
      ts.isBindingElement(node) &&
      ts.isIdentifier(node.name) &&
      node.propertyName &&
      (ts.isIdentifier(node.propertyName) || ts.isStringLiteralLike(node.propertyName)) &&
      ts.isVariableDeclaration(node.parent?.parent) &&
      ts.isIdentifier(node.parent.parent.initializer) &&
      reactNamespaceNames.has(node.parent.parent.initializer.text)
    ) {
      if (/^(?:useEffect|useInsertionEffect|useLayoutEffect)$/u.test(node.propertyName.text)) {
        effectNames.add(node.name.text);
      }
      if (node.propertyName.text === 'useImperativeHandle') {
        imperativeHandleNames.add(node.name.text);
      }
      if (node.propertyName.text === 'useCallback') callbackFactoryNames.add(node.name.text);
      if (/^(?:useMemo|useReducer|useState|useSyncExternalStore)$/u.test(node.propertyName.text)) {
        renderEvaluatedHooks.set(node.name.text, node.propertyName.text);
      }
    }
    ts.forEachChild(node, collectHookAliases);
  };
  collectHookAliases(sourceFile);
  let hookAliasesChanged = true;
  while (hookAliasesChanged) {
    hookAliasesChanged = false;
    for (const [alias, sourceName] of hookAliasEdges) {
      if (!effectNames.has(alias) && effectNames.has(sourceName)) {
        effectNames.add(alias);
        hookAliasesChanged = true;
      }
      if (!imperativeHandleNames.has(alias) && imperativeHandleNames.has(sourceName)) {
        imperativeHandleNames.add(alias);
        hookAliasesChanged = true;
      }
      if (!callbackFactoryNames.has(alias) && callbackFactoryNames.has(sourceName)) {
        callbackFactoryNames.add(alias);
        hookAliasesChanged = true;
      }
      if (!renderEvaluatedHooks.has(alias) && renderEvaluatedHooks.has(sourceName)) {
        renderEvaluatedHooks.set(alias, renderEvaluatedHooks.get(sourceName));
        hookAliasesChanged = true;
      }
    }
  }

  const isAgentActionVerbName = (name) => {
    const candidate = name.replace(/^on([A-Z])/u, (_match, initial) => initial.toLowerCase());
    return /^(?:approve|delete|deny|navigate|patch|retry|send|stop|upload)(?:[A-Z0-9_$].*)?$/u.test(
      candidate
    );
  };
  const hasExplicitAgentActionModuleProvenance = (owner) =>
    /(?:^|[/._-])(?:agent[-_.]?)?actions?(?:$|[/._-])/iu.test(owner);
  const hasAgentActionOwnerProvenance = (owner) =>
    /(?:action|agent|api|approval|client|command|props|request|run|service|tool)/iu.test(owner);
  const bindingElementOwnerProvenance = (bindingElement) => {
    const ownerParts = [];
    let current = bindingElement;
    while (ts.isBindingElement(current)) {
      const parentPattern = current.parent;
      const declaration = parentPattern?.parent;
      if (ts.isBindingElement(declaration)) {
        const ownerName = declaration.propertyName ?? declaration.name;
        if (ts.isIdentifier(ownerName) || ts.isStringLiteralLike(ownerName)) {
          ownerParts.unshift(ownerName.text);
        }
        current = declaration;
        continue;
      }
      if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
        ownerParts.unshift(declaration.initializer.getText(sourceFile));
      } else if (ts.isParameter(declaration)) {
        ownerParts.unshift('props');
      }
      break;
    }
    return ownerParts.join('.');
  };
  const agentActionAliases = new Set();
  const agentActionOwners = new Set();
  const agentActionModuleOwners = new Set();
  const aliasEdges = [];
  const bindingElementComesFromParameter = (bindingElement) => {
    let declaration = bindingElement.parent?.parent;
    while (ts.isBindingElement(declaration)) declaration = declaration.parent?.parent;
    return ts.isParameter(declaration);
  };
  const collectActionAliases = (node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteralLike(node.moduleSpecifier) &&
      hasAgentActionOwnerProvenance(node.moduleSpecifier.text)
    ) {
      const importClause = node.importClause;
      const explicitActionModule = hasExplicitAgentActionModuleProvenance(
        node.moduleSpecifier.text
      );
      if (importClause?.name) {
        agentActionOwners.add(importClause.name.text);
        if (explicitActionModule) agentActionAliases.add(importClause.name.text);
      }
      if (importClause?.namedBindings && ts.isNamespaceImport(importClause.namedBindings)) {
        agentActionOwners.add(importClause.namedBindings.name.text);
        if (explicitActionModule) agentActionModuleOwners.add(importClause.namedBindings.name.text);
      }
      if (importClause?.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
        for (const specifier of importClause.namedBindings.elements) {
          if (explicitActionModule) agentActionAliases.add(specifier.name.text);
        }
      }
    }
    if (
      ts.isParameter(node) &&
      ts.isIdentifier(node.name) &&
      hasAgentActionOwnerProvenance(node.name.text)
    ) {
      agentActionOwners.add(node.name.text);
    }
    if (
      ts.isBindingElement(node) &&
      ts.isIdentifier(node.name) &&
      bindingElementComesFromParameter(node) &&
      hasAgentActionOwnerProvenance(node.name.text)
    ) {
      agentActionOwners.add(node.name.text);
    }
    if (ts.isImportSpecifier(node)) {
      const importedName = (node.propertyName ?? node.name).text;
      if (isAgentActionVerbName(importedName)) {
        agentActionAliases.add(node.name.text);
      }
    }
    if (
      ts.isBindingElement(node) &&
      ts.isIdentifier(node.name) &&
      (ts.isIdentifier(node.propertyName ?? node.name) ||
        ts.isStringLiteralLike(node.propertyName ?? node.name)) &&
      isAgentActionVerbName((node.propertyName ?? node.name).text) &&
      hasAgentActionOwnerProvenance(bindingElementOwnerProvenance(node))
    ) {
      agentActionAliases.add(node.name.text);
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const initializer = unwrapTypeScriptExpression(node.initializer);
      if (ts.isIdentifier(initializer)) {
        aliasEdges.push([node.name.text, initializer.text]);
      } else if (ts.isPropertyAccessExpression(initializer)) {
        aliasEdges.push([node.name.text, initializer.name.text]);
        if (
          isAgentActionVerbName(initializer.name.text) &&
          qualifiedActionOwnerHasProvenance(initializer.expression)
        ) {
          agentActionAliases.add(node.name.text);
        }
      } else if (
        ts.isElementAccessExpression(initializer) &&
        ts.isStringLiteralLike(initializer.argumentExpression) &&
        isAgentActionVerbName(initializer.argumentExpression.text) &&
        qualifiedActionOwnerHasProvenance(initializer.expression)
      ) {
        agentActionAliases.add(node.name.text);
      }
    }
    ts.forEachChild(node, collectActionAliases);
  };
  collectActionAliases(sourceFile);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [alias, sourceName] of aliasEdges) {
      if (!agentActionAliases.has(alias) && agentActionAliases.has(sourceName)) {
        agentActionAliases.add(alias);
        changed = true;
      }
    }
  }
  function qualifiedActionOwnerHasProvenance(expression) {
    let candidate = unwrapTypeScriptExpression(expression);
    while (ts.isPropertyAccessExpression(candidate) || ts.isElementAccessExpression(candidate)) {
      if (
        ts.isPropertyAccessExpression(candidate) &&
        candidate.name.text === 'props' &&
        candidate.expression.kind === ts.SyntaxKind.ThisKeyword
      ) {
        return true;
      }
      candidate = unwrapTypeScriptExpression(candidate.expression);
    }
    return ts.isIdentifier(candidate) && agentActionOwners.has(candidate.text);
  }
  function qualifiedActionModuleOwnerHasProvenance(expression) {
    let candidate = unwrapTypeScriptExpression(expression);
    while (ts.isPropertyAccessExpression(candidate) || ts.isElementAccessExpression(candidate)) {
      candidate = unwrapTypeScriptExpression(candidate.expression);
    }
    return ts.isIdentifier(candidate) && agentActionModuleOwners.has(candidate.text);
  }
  const isAgentActionExpression = (expression) => {
    const candidate = unwrapTypeScriptExpression(expression);
    if (ts.isIdentifier(candidate)) return agentActionAliases.has(candidate.text);
    if (ts.isPropertyAccessExpression(candidate)) {
      return (
        qualifiedActionModuleOwnerHasProvenance(candidate.expression) ||
        (isAgentActionVerbName(candidate.name.text) &&
          qualifiedActionOwnerHasProvenance(candidate.expression))
      );
    }
    return (
      ts.isElementAccessExpression(candidate) &&
      ts.isStringLiteralLike(candidate.argumentExpression) &&
      (qualifiedActionModuleOwnerHasProvenance(candidate.expression) ||
        (isAgentActionVerbName(candidate.argumentExpression.text) &&
          qualifiedActionOwnerHasProvenance(candidate.expression)))
    );
  };
  const isAgentActionCall = (node) => {
    if (!ts.isCallExpression(node)) return false;
    return isAgentActionExpression(node.expression);
  };
  const callableBindings = new Map();
  const callableLexicalScope = (node) => {
    for (let current = node.parent; current; current = current.parent) {
      if (ts.isBlock(current) || ts.isFunctionLike(current) || ts.isSourceFile(current)) {
        return current;
      }
    }
    return sourceFile;
  };
  const addCallableBinding = (name, node, callable, hoisted) => {
    const bindings = callableBindings.get(name) ?? [];
    bindings.push({
      callable,
      hoisted,
      position: node.getStart(sourceFile),
      scope: callableLexicalScope(node),
    });
    callableBindings.set(name, bindings);
  };
  const useCallbackArgument = (initializer) => {
    if (!ts.isCallExpression(initializer) || !initializer.arguments[0]) return null;
    const callee = unwrapTypeScriptExpression(initializer.expression);
    const isUseCallback =
      (ts.isIdentifier(callee) && callbackFactoryNames.has(callee.text)) ||
      (ts.isPropertyAccessExpression(callee) &&
        ts.isIdentifier(callee.expression) &&
        reactNamespaceNames.has(callee.expression.text) &&
        callee.name.text === 'useCallback');
    if (!isUseCallback) return null;
    const callback = unwrapTypeScriptExpression(initializer.arguments[0]);
    return ts.isArrowFunction(callback) || ts.isFunctionExpression(callback) ? callback : null;
  };
  const collectCallableBindings = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const initializer = unwrapTypeScriptExpression(node.initializer);
      const callable =
        ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)
          ? initializer
          : useCallbackArgument(initializer);
      if (callable) {
        addCallableBinding(node.name.text, node, callable, false);
      }
    }
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      addCallableBinding(node.name.text, node, node, true);
    }
    ts.forEachChild(node, collectCallableBindings);
  };
  collectCallableBindings(sourceFile);
  const resolveCallable = (name, useNode) => {
    const bindings = callableBindings.get(name) ?? [];
    const usePosition = useNode.getStart(sourceFile);
    for (let scope = callableLexicalScope(useNode); scope; scope = callableLexicalScope(scope)) {
      const binding = bindings
        .filter((entry) => entry.scope === scope && (entry.hoisted || entry.position < usePosition))
        .sort((left, right) => right.position - left.position)[0];
      if (binding) return binding.callable;
      if (ts.isSourceFile(scope)) break;
    }
    return null;
  };
  const importedCallableContainsAgentAction = (name) => {
    const imported = importedCallables.get(name);
    if (!imported || nextVisitedPaths.has(path.resolve(imported.targetPath))) return false;
    const targetContent = fs.readFileSync(imported.targetPath, 'utf8');
    const probeName = '__protoUiImportedActionProbe';
    const createElementName = '__protoUiCreateElementProbe';
    let callableName = imported.importedName;
    let callableProbe = '';
    if (imported.importedName === 'default') {
      const defaultCallableName = '__protoUiDefaultCallableProbe';
      const targetSourceFile = ts.createSourceFile(
        imported.targetPath,
        targetContent,
        ts.ScriptTarget.Latest,
        true,
        /\.jsx$/i.test(imported.targetPath)
          ? ts.ScriptKind.JSX
          : /\.js$/i.test(imported.targetPath)
            ? ts.ScriptKind.JS
            : /\.ts$/i.test(imported.targetPath)
              ? ts.ScriptKind.TS
              : ts.ScriptKind.TSX
      );
      for (const statement of targetSourceFile.statements) {
        const isDefault = statement.modifiers?.some(
          (modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword
        );
        if (isDefault && ts.isFunctionDeclaration(statement)) {
          const expression = statement
            .getText(targetSourceFile)
            .replace(/^export\s+default\s+/u, '');
          callableProbe = `const ${defaultCallableName} = ${expression};`;
          break;
        }
        if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
          callableProbe = `const ${defaultCallableName} = ${statement.expression.getText(targetSourceFile)};`;
          break;
        }
        if (
          ts.isExportDeclaration(statement) &&
          !statement.moduleSpecifier &&
          statement.exportClause &&
          ts.isNamedExports(statement.exportClause)
        ) {
          const defaultExport = statement.exportClause.elements.find(
            (element) => element.name.text === 'default'
          );
          if (defaultExport) {
            callableProbe = `const ${defaultCallableName} = ${(defaultExport.propertyName ?? defaultExport.name).text};`;
            break;
          }
        }
      }
      if (!callableProbe) return false;
      callableName = defaultCallableName;
    }
    const probedContent = `${targetContent}\n${callableProbe}\nimport { createElement as ${createElementName} } from 'react';\nexport function ${probeName}() { ${callableName}(); return ${createElementName}('section'); }\n`;
    return astContainsHarnessRenderOrEffectAction(
      probedContent,
      imported.targetPath,
      nextVisitedPaths
    );
  };
  const resolveClassLocalCallable = (callee) => {
    const member = staticMemberAccess(callee);
    if (!member || unwrapTypeScriptExpression(member.receiver).kind !== ts.SyntaxKind.ThisKeyword)
      return null;
    let owner = callee.parent;
    while (owner && !ts.isClassDeclaration(owner) && !ts.isClassExpression(owner)) {
      if (ts.isFunctionExpression(owner) || ts.isFunctionDeclaration(owner)) return null;
      owner = owner.parent;
    }
    if (!owner) return null;
    const declaration = owner.members.find((entry) => {
      if (entry.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword))
        return false;
      const name =
        entry.name && (ts.isIdentifier(entry.name) || ts.isStringLiteralLike(entry.name))
          ? entry.name.text
          : null;
      return name === member.name;
    });
    if (declaration && ts.isMethodDeclaration(declaration) && declaration.body) return declaration;
    if (declaration && ts.isPropertyDeclaration(declaration) && declaration.initializer) {
      const value = unwrapTypeScriptExpression(declaration.initializer);
      if (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) return value;
    }
    return null;
  };
  const executionPathContainsAgentAction = (root) => {
    let found = false;
    const candidate = unwrapTypeScriptExpression(root);
    const resolvedRoot = ts.isIdentifier(candidate)
      ? (resolveCallable(candidate.text, candidate) ?? candidate)
      : candidate;
    const executionNode = ts.isFunctionLike(resolvedRoot) ? resolvedRoot.body : resolvedRoot;
    if (!executionNode) return false;
    const visitedCallables = new Set();
    if (ts.isFunctionLike(resolvedRoot)) visitedCallables.add(resolvedRoot);
    const visit = (node, executionRoot = executionNode) => {
      if (found) return;
      if (isAgentActionCall(node)) {
        found = true;
        return;
      }
      if (node !== executionRoot && ts.isFunctionLike(node)) {
        if (ts.isReturnStatement(node.parent) && node.body) visit(node.body, node.body);
        return;
      }
      if (ts.isCallExpression(node)) {
        const callee = unwrapTypeScriptExpression(node.expression);
        const scheduledCallbackName = ts.isIdentifier(callee)
          ? callee.text
          : ts.isPropertyAccessExpression(callee) &&
              ts.isIdentifier(callee.expression) &&
              /^(?:globalThis|self|window)$/u.test(callee.expression.text)
            ? callee.name.text
            : null;
        const promiseReactionName =
          ts.isPropertyAccessExpression(callee) &&
          /^(?:then|catch|finally)$/u.test(callee.name.text)
            ? callee.name.text
            : null;
        const scheduledCallbackArguments = promiseReactionName
          ? node.arguments.slice(0, promiseReactionName === 'then' ? 2 : 1)
          : scheduledCallbackName &&
              /^(?:queueMicrotask|requestAnimationFrame|requestIdleCallback|setInterval|setTimeout)$/u.test(
                scheduledCallbackName
              ) &&
              node.arguments[0]
            ? node.arguments.slice(0, 1)
            : [];
        for (const callbackArgument of scheduledCallbackArguments) {
          const callbackExpression = unwrapTypeScriptExpression(callbackArgument);
          const scheduledCallable =
            ts.isArrowFunction(callbackExpression) || ts.isFunctionExpression(callbackExpression)
              ? callbackExpression
              : ts.isIdentifier(callbackExpression)
                ? resolveCallable(callbackExpression.text, callbackExpression)
                : null;
          if (scheduledCallable && !visitedCallables.has(scheduledCallable)) {
            visitedCallables.add(scheduledCallable);
            const callbackBody = ts.isFunctionLike(scheduledCallable)
              ? scheduledCallable.body
              : scheduledCallable;
            if (callbackBody) visit(callbackBody, callbackBody);
            if (found) return;
          }
        }
        const callable =
          ts.isArrowFunction(callee) || ts.isFunctionExpression(callee)
            ? callee
            : ts.isIdentifier(callee)
              ? resolveCallable(callee.text, callee)
              : resolveClassLocalCallable(callee);
        if (
          !callable &&
          ts.isIdentifier(callee) &&
          importedCallableContainsAgentAction(callee.text)
        ) {
          found = true;
          return;
        }
        if (callable && !visitedCallables.has(callable) && callable.body) {
          if (visitedCallables.size >= 500) {
            found = true;
            return;
          }
          visitedCallables.add(callable);
          for (const argument of node.arguments) {
            const callbackExpression = unwrapTypeScriptExpression(argument);
            const callback =
              ts.isArrowFunction(callbackExpression) || ts.isFunctionExpression(callbackExpression)
                ? callbackExpression
                : ts.isIdentifier(callbackExpression)
                  ? resolveCallable(callbackExpression.text, callbackExpression)
                  : null;
            if (callback && !visitedCallables.has(callback) && callback.body) {
              visitedCallables.add(callback);
              visit(callback.body, callback.body);
              if (found) return;
            }
          }
          visit(callable.body, callable.body);
          if (found) return;
        }
      }
      ts.forEachChild(node, (child) => visit(child, executionRoot));
    };
    visit(executionNode, executionNode);
    return found;
  };
  const isReactHookCall = (node, localNames, canonicalPattern) => {
    if (!ts.isCallExpression(node)) return false;
    const expression = unwrapTypeScriptExpression(node.expression);
    if (ts.isIdentifier(expression)) return localNames.has(expression.text);
    return (
      ts.isPropertyAccessExpression(expression) &&
      ts.isIdentifier(expression.expression) &&
      reactNamespaceNames.has(expression.expression.text) &&
      canonicalPattern.test(expression.name.text)
    );
  };
  const isEffectCall = (node) =>
    isReactHookCall(node, effectNames, /^(?:useEffect|useInsertionEffect|useLayoutEffect)$/u);
  const isImperativeHandleCall = (node) =>
    isReactHookCall(node, imperativeHandleNames, /^useImperativeHandle$/u);
  const renderEvaluatedCallbackIndexes = (node) => {
    if (!ts.isCallExpression(node)) return [];
    const expression = unwrapTypeScriptExpression(node.expression);
    const hookKind = ts.isIdentifier(expression)
      ? renderEvaluatedHooks.get(expression.text)
      : ts.isPropertyAccessExpression(expression) &&
          ts.isIdentifier(expression.expression) &&
          reactNamespaceNames.has(expression.expression.text)
        ? expression.name.text
        : null;
    if (hookKind === 'useReducer') return [0, 2];
    if (hookKind === 'useSyncExternalStore') return [0, 1, 2];
    return hookKind === 'useMemo' || hookKind === 'useState' ? [0] : [];
  };

  let found = false;
  const visitEffects = (node) => {
    if (found) return;
    if (
      isEffectCall(node) &&
      node.arguments[0] &&
      (isAgentActionExpression(node.arguments[0]) ||
        executionPathContainsAgentAction(node.arguments[0]))
    ) {
      found = true;
      return;
    }
    if (
      isImperativeHandleCall(node) &&
      node.arguments[1] &&
      (isAgentActionExpression(node.arguments[1]) ||
        executionPathContainsAgentAction(node.arguments[1]))
    ) {
      found = true;
      return;
    }
    ts.forEachChild(node, visitEffects);
  };
  visitEffects(sourceFile);
  if (found) return true;

  const containsRenderedSurface = (root) => {
    let rendered = false;
    const visit = (node) => {
      if (rendered) return;
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) {
        rendered = true;
        return;
      }
      if (ts.isCallExpression(node)) {
        const expression = unwrapTypeScriptExpression(node.expression);
        if (
          (ts.isPropertyAccessExpression(expression) &&
            ts.isIdentifier(expression.expression) &&
            reactNamespaceNames.has(expression.expression.text) &&
            expression.name.text === 'createElement') ||
          (ts.isIdentifier(expression) && reactCreateElementNames.has(expression.text))
        ) {
          rendered = true;
          return;
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(root);
    return rendered;
  };
  const renderedLocalDeclarations = new Map();
  const classMemberCallable = (member) => {
    if (ts.isConstructorDeclaration(member) && member.body) return member;
    if (ts.isMethodDeclaration(member) && member.body) return member;
    if (ts.isPropertyDeclaration(member) && member.initializer) {
      const initializer = unwrapTypeScriptExpression(member.initializer);
      if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) {
        return initializer;
      }
    }
    return null;
  };
  const classMemberName = (member) =>
    ts.isConstructorDeclaration(member)
      ? 'constructor'
      : member.name && (ts.isIdentifier(member.name) || ts.isStringLiteralLike(member.name))
        ? member.name.text
        : null;
  const collectRenderedFunctionLikes = (root, destination) => {
    const visit = (node) => {
      if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
        if (containsRenderedSurface(node)) destination.add(node);
        return;
      }
      if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
        const hasRenderedSurface = node.members.some((member) => {
          const callable = classMemberCallable(member);
          return (
            classMemberName(member) === 'render' &&
            callable !== null &&
            containsRenderedSurface(callable)
          );
        });
        if (hasRenderedSurface) {
          for (const member of node.members) {
            const callable = classMemberCallable(member);
            const memberName = classMemberName(member);
            if (
              callable &&
              memberName &&
              /^(?:constructor|UNSAFE_componentWillMount|UNSAFE_componentWillReceiveProps|UNSAFE_componentWillUpdate|componentDidCatch|componentDidMount|componentDidUpdate|componentWillMount|componentWillReceiveProps|componentWillUnmount|componentWillUpdate|getDerivedStateFromError|getDerivedStateFromProps|getSnapshotBeforeUpdate|render|shouldComponentUpdate)$/u.test(
                memberName
              )
            ) {
              destination.add(callable);
            }
            if (ts.isPropertyDeclaration(member) && member.initializer) {
              const initializer = unwrapTypeScriptExpression(member.initializer);
              if (!ts.isArrowFunction(initializer) && !ts.isFunctionExpression(initializer)) {
                destination.add(initializer);
              }
            }
          }
        }
        return;
      }
      ts.forEachChild(node, visit);
    };
    visit(root);
  };
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name && statement.body) {
      if (containsRenderedSurface(statement)) {
        renderedLocalDeclarations.set(statement.name.text, new Set([statement]));
      }
      continue;
    }
    if (ts.isClassDeclaration(statement) && statement.name) {
      const roots = new Set();
      collectRenderedFunctionLikes(statement, roots);
      if (roots.size > 0) renderedLocalDeclarations.set(statement.name.text, roots);
      continue;
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
        const roots = new Set();
        collectRenderedFunctionLikes(declaration.initializer, roots);
        if (roots.size > 0) renderedLocalDeclarations.set(declaration.name.text, roots);
      }
    }
  }
  const collectWrappedRenderedLocals = (expression, destination) => {
    const candidate = unwrapTypeScriptExpression(expression);
    if (ts.isIdentifier(candidate)) {
      for (const root of renderedLocalDeclarations.get(candidate.text) ?? []) {
        destination.add(root);
      }
      return;
    }
    if (ts.isCallExpression(candidate)) {
      for (const argument of candidate.arguments) {
        collectWrappedRenderedLocals(argument, destination);
      }
    }
  };

  const exportedFunctionLikes = new Set();
  for (const statement of sourceFile.statements) {
    if (ts.isExportAssignment(statement)) {
      const expression = unwrapTypeScriptExpression(statement.expression);
      collectWrappedRenderedLocals(expression, exportedFunctionLikes);
      collectRenderedFunctionLikes(expression, exportedFunctionLikes);
      continue;
    }
    if (
      ts.isExportDeclaration(statement) &&
      !statement.moduleSpecifier &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        const localName = (element.propertyName ?? element.name).text;
        for (const root of renderedLocalDeclarations.get(localName) ?? []) {
          exportedFunctionLikes.add(root);
        }
      }
      continue;
    }
    const exported = statement.modifiers?.some(
      (modifier) =>
        modifier.kind === ts.SyntaxKind.ExportKeyword ||
        modifier.kind === ts.SyntaxKind.DefaultKeyword
    );
    if (!exported) continue;
    const statementName =
      (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name
        ? statement.name.text
        : null;
    if (statementName && renderedLocalDeclarations.has(statementName)) {
      for (const root of renderedLocalDeclarations.get(statementName)) {
        exportedFunctionLikes.add(root);
      }
    } else {
      collectRenderedFunctionLikes(statement, exportedFunctionLikes);
    }
  }
  for (const functionLike of exportedFunctionLikes) {
    if (executionPathContainsAgentAction(functionLike)) return true;
    const visitRender = (node) => {
      if (found) return;
      if (node !== functionLike && ts.isFunctionLike(node)) return;
      if (isAgentActionCall(node)) {
        found = true;
        return;
      }
      const callbackIndexes = renderEvaluatedCallbackIndexes(node);
      if (
        callbackIndexes.some(
          (index) =>
            node.arguments[index] &&
            (isAgentActionExpression(node.arguments[index]) ||
              executionPathContainsAgentAction(node.arguments[index]))
        )
      ) {
        found = true;
        return;
      }
      ts.forEachChild(node, visitRender);
    };
    visitRender(functionLike);
    if (found) return true;
  }
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) &&
      !ts.isFunctionDeclaration(statement) &&
      !ts.isClassDeclaration(statement) &&
      executionPathContainsAgentAction(statement)
    ) {
      return true;
    }
  }
  return false;
}

function containsHarnessForbiddenStateMachine(content, absolutePath) {
  if (/\.html?$/i.test(absolutePath)) {
    return (
      containsJsxEventHandler(content, absolutePath) ||
      embeddedScriptSegments(content).some(
        (script) =>
          astContainsInteractiveRuntime(script, { harnessGeometry: true }) ||
          astContainsNativeJsxEventHandler(script, absolutePath) ||
          astContainsHarnessRenderOrEffectAction(script, absolutePath)
      )
    );
  }
  return (
    astContainsInteractiveRuntime(content, { harnessGeometry: true }) ||
    astContainsNativeJsxEventHandler(content, absolutePath) ||
    astContainsHarnessRenderOrEffectAction(content, absolutePath)
  );
}

function harnessProductionSourceSet(rootDir) {
  const harnessRoot = path.resolve(rootDir, 'apps', 'agent-harness');
  const sourceRoot = path.join(harnessRoot, 'src');
  const rootMarkup = fs.existsSync(harnessRoot)
    ? fs
        .readdirSync(harnessRoot, { withFileTypes: true })
        .filter((entry) => entry.isFile() && /\.html?$/i.test(entry.name))
        .map((entry) => path.join(harnessRoot, entry.name))
    : [];
  const sourceRootCandidates = [
    ...walkFiles(sourceRoot),
    ...walkFiles(path.join(harnessRoot, 'public')),
    ...rootMarkup,
  ].filter((absolutePath) => /\.(?:html?|[cm]?[jt]sx?|css|less|s[ac]ss)$/i.test(absolutePath));
  const reachable = reachableSourcePaths(sourceRootCandidates, undefined, rootDir);
  const candidates = [...new Set([...sourceRootCandidates, ...reachable])].filter(
    (absolutePath) => !isTestNamedSource(absolutePath) || reachable.has(absolutePath)
  );
  const harnessSources = candidates.filter((absolutePath) => {
    const relativePath = path.relative(harnessRoot, absolutePath);
    return (
      !path.isAbsolute(relativePath) &&
      relativePath !== '..' &&
      !relativePath.startsWith(`..${path.sep}`)
    );
  });
  return { harnessRoot, sourceRoot, candidates, harnessSources };
}

function discoverHarnessForbiddenStateMachineSources(rootDir) {
  const { sourceRoot, candidates } = harnessProductionSourceSet(rootDir);
  return candidates
    .filter((absolutePath) => /\.(?:html?|[cm]?[jt]sx?)$/i.test(absolutePath))
    .filter((absolutePath) => {
      const relativePath = path.relative(sourceRoot, absolutePath).replaceAll('\\', '/');
      return !isGeneratedHarnessFacadeSource(relativePath);
    })
    .filter((absolutePath) =>
      containsHarnessForbiddenStateMachine(fs.readFileSync(absolutePath, 'utf8'), absolutePath)
    )
    .map((absolutePath) => path.relative(rootDir, absolutePath).replaceAll('\\', '/'))
    .sort();
}

const UNRESOLVED_DYNAMIC_IMPORT_SPECIFIER = '<unresolved dynamic import>';
const UNRESOLVED_DYNAMIC_REQUIRE_SPECIFIER = '<unresolved dynamic require>';
const VITE_IGNORED_DYNAMIC_IMPORT_SPECIFIER_PREFIX = '<@vite-ignore dynamic import:';
const UNRESOLVED_IMPORTSCRIPTS_SPECIFIER = '<unresolved importScripts target>';
const EXTERNAL_IMPORTSCRIPTS_SPECIFIER_PREFIX = '<external importScripts target:';
const UNRESOLVED_WORKER_ENTRY_SPECIFIER = '<unresolved Worker entry>';
const EXTERNAL_WORKER_ENTRY_SPECIFIER_PREFIX = '<external Worker entry:';
const EXTERNAL_SCRIPT_ELEMENT_SPECIFIER_PREFIX = '<external script element src:';
const EXTERNAL_STYLESHEET_ELEMENT_SPECIFIER_PREFIX = '<external stylesheet element href:';

function viteIgnoredDynamicImportSpecifier(argument, sourceFile, literalBindings) {
  const boundary = ts.isStringLiteralLike(argument)
    ? argument.text
    : ts.isIdentifier(argument) && literalBindings.has(argument.text)
      ? literalBindings.get(argument.text)
      : argument.getText(sourceFile).trim();
  return `${VITE_IGNORED_DYNAMIC_IMPORT_SPECIFIER_PREFIX}${boundary}>`;
}

function viteIgnoredDynamicImportBoundary(specifier) {
  return specifier.startsWith(VITE_IGNORED_DYNAMIC_IMPORT_SPECIFIER_PREFIX) &&
    specifier.endsWith('>')
    ? specifier.slice(VITE_IGNORED_DYNAMIC_IMPORT_SPECIFIER_PREFIX.length, -1)
    : null;
}

function topLevelConstStringBindings(sourceFile) {
  const literalBindings = new Map();
  for (const statement of sourceFile.statements) {
    if (
      !ts.isVariableStatement(statement) ||
      !(statement.declarationList.flags & ts.NodeFlags.Const)
    ) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.initializer &&
        ts.isStringLiteralLike(declaration.initializer)
      ) {
        literalBindings.set(declaration.name.text, declaration.initializer.text);
      }
    }
  }
  return literalBindings;
}

function importScriptsTargetSpecifier(argument, literalBindings) {
  const target = ts.isStringLiteralLike(argument)
    ? argument.text
    : ts.isIdentifier(argument) && literalBindings.has(argument.text)
      ? literalBindings.get(argument.text)
      : null;
  if (typeof target !== 'string' || target.length === 0) {
    return UNRESOLVED_IMPORTSCRIPTS_SPECIFIER;
  }
  if (isExternalExecutableScriptSpecifier(target)) {
    return `${EXTERNAL_IMPORTSCRIPTS_SPECIFIER_PREFIX}${target}>`;
  }
  return target.startsWith('.') ? target : `./${target}`;
}

function externalImportScriptsTarget(specifier) {
  return specifier.startsWith(EXTERNAL_IMPORTSCRIPTS_SPECIFIER_PREFIX) && specifier.endsWith('>')
    ? specifier.slice(EXTERNAL_IMPORTSCRIPTS_SPECIFIER_PREFIX.length, -1)
    : null;
}
function externalWorkerEntrySpecifier(target) {
  return `${EXTERNAL_WORKER_ENTRY_SPECIFIER_PREFIX}${target}>`;
}

function externalWorkerEntryTarget(specifier) {
  return specifier.startsWith(EXTERNAL_WORKER_ENTRY_SPECIFIER_PREFIX) && specifier.endsWith('>')
    ? specifier.slice(EXTERNAL_WORKER_ENTRY_SPECIFIER_PREFIX.length, -1)
    : null;
}
function externalScriptElementSpecifier(target) {
  return `${EXTERNAL_SCRIPT_ELEMENT_SPECIFIER_PREFIX}${target}>`;
}

function externalScriptElementTarget(specifier) {
  return specifier.startsWith(EXTERNAL_SCRIPT_ELEMENT_SPECIFIER_PREFIX) && specifier.endsWith('>')
    ? specifier.slice(EXTERNAL_SCRIPT_ELEMENT_SPECIFIER_PREFIX.length, -1)
    : null;
}

function scriptModuleSpecifiers(source, fileName, { harnessPreviewBoundary = false } = {}) {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const specifiers = [];
  const literalBindings = topLevelConstStringBindings(sourceFile);
  const receiverBindings = domReceiverBindings(sourceFile);
  const scriptElementBindings = new Map();
  const scriptLexicalScope = (node) => {
    for (let current = node.parent; current; current = current.parent) {
      if (ts.isBlock(current) || ts.isFunctionLike(current) || ts.isSourceFile(current)) {
        return current;
      }
    }
    return sourceFile;
  };
  const addScriptElementBinding = (name, node, initializer) => {
    const bindings = scriptElementBindings.get(name) ?? [];
    bindings.push({
      initializer: initializer ? unwrapTypeScriptExpression(initializer) : null,
      node,
      position: node.getStart(sourceFile),
      scope: scriptLexicalScope(node),
    });
    scriptElementBindings.set(name, bindings);
  };
  const collectScriptElementBindings = (node) => {
    if (
      (ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isImportClause(node) ||
        ts.isImportSpecifier(node) ||
        ts.isNamespaceImport(node)) &&
      node.name
    ) {
      addScriptElementBinding(node.name.text, node, null);
    }
    if ((ts.isVariableDeclaration(node) || ts.isParameter(node)) && ts.isIdentifier(node.name)) {
      addScriptElementBinding(node.name.text, node, node.initializer);
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.left)
    ) {
      addScriptElementBinding(node.left.text, node, node.right);
    }
    ts.forEachChild(node, collectScriptElementBindings);
  };
  collectScriptElementBindings(sourceFile);
  const isResourceElementCreation = (expression, tagName) => {
    const candidate = unwrapTypeScriptExpression(expression);
    if (!ts.isCallExpression(candidate) || !candidate.arguments[0]) return null;
    const member = staticMemberAccess(candidate.expression);
    return Boolean(
      member &&
      member.name === 'createElement' &&
      ts.isStringLiteralLike(candidate.arguments[0]) &&
      candidate.arguments[0].text.toLowerCase() === tagName &&
      (isDomReceiverExpression(member.receiver, sourceFile, receiverBindings, candidate) ||
        resolveLocalValue(member.receiver, candidate, new Set(), (receiver, useNode) =>
          isBrowserGlobal(receiver, useNode, ['document'])
        ))
    );
  };
  const resourceElementCreation = (expression, useNode, tagName, visitedBindings = new Set()) => {
    const candidate = unwrapTypeScriptExpression(expression);
    if (isResourceElementCreation(candidate, tagName)) return candidate;
    if (isGlobalObjectAssign(candidate, useNode) && candidate.arguments[0]) {
      return resourceElementCreation(candidate.arguments[0], useNode, tagName, visitedBindings);
    }
    if (!ts.isIdentifier(candidate)) return null;
    const bindings = scriptElementBindings.get(candidate.text) ?? [];
    const usePosition = useNode.getStart(sourceFile);
    for (let scope = scriptLexicalScope(useNode); scope; scope = scriptLexicalScope(scope)) {
      const binding = bindings
        .filter((entry) => entry.scope === scope && entry.position < usePosition)
        .sort((left, right) => right.position - left.position)[0];
      if (binding) {
        if (!binding.initializer || visitedBindings.has(binding)) return null;
        visitedBindings.add(binding);
        return resourceElementCreation(binding.initializer, binding.node, tagName, visitedBindings);
      }
      if (ts.isSourceFile(scope)) break;
    }
    return null;
  };
  const isScriptElementExpression = (expression, useNode) =>
    Boolean(resourceElementCreation(expression, useNode, 'script'));
  // Body mutation on a proven script receiver remains unverified: tracking its
  // type, insertion timing and later reassignment is outside this bounded scan.
  const scriptBodyProperties = new Set(['text', 'textContent', 'innerText', 'innerHTML']);
  const scriptBodyMethods = new Set([
    'append',
    'appendChild',
    'prepend',
    'replaceChildren',
    'insertBefore',
    'replaceChild',
  ]);
  const scriptElementSourceSpecifier = (argument) => {
    if (!argument) return DYNAMIC_EXECUTABLE_SCRIPT_SPECIFIER;
    const source = unwrapTypeScriptExpression(argument);
    const target = ts.isStringLiteralLike(source)
      ? source.text
      : ts.isIdentifier(source) && literalBindings.has(source.text)
        ? literalBindings.get(source.text)
        : null;
    const normalizedTarget =
      typeof target === 'string' ? normalizeBrowserResourceUrl(target) : null;
    return normalizedTarget !== null && isExternalExecutableScriptSpecifier(normalizedTarget)
      ? externalScriptElementSpecifier(normalizedTarget)
      : DYNAMIC_EXECUTABLE_SCRIPT_SPECIFIER;
  };
  const addLiteral = (node) => {
    if (node && ts.isStringLiteralLike(node)) specifiers.push(node.text);
  };
  const workerEntrySpecifier = (node) => {
    if (
      !ts.isNewExpression(node) ||
      !isBrowserGlobal(node.expression, node, ['SharedWorker', 'Worker']) ||
      !node.arguments?.[0]
    ) {
      return null;
    }
    const urlExpression = unwrapTypeScriptExpression(node.arguments[0]);
    if (ts.isStringLiteralLike(urlExpression)) {
      return isExternalExecutableScriptSpecifier(urlExpression.text)
        ? externalWorkerEntrySpecifier(urlExpression.text)
        : UNRESOLVED_WORKER_ENTRY_SPECIFIER;
    }
    if (
      !ts.isNewExpression(urlExpression) ||
      !ts.isIdentifier(urlExpression.expression) ||
      urlExpression.expression.text !== 'URL' ||
      !urlExpression.arguments?.[0] ||
      !ts.isStringLiteralLike(urlExpression.arguments[0]) ||
      !urlExpression.arguments[1]
    ) {
      return UNRESOLVED_WORKER_ENTRY_SPECIFIER;
    }
    const target = urlExpression.arguments[0].text;
    if (isExternalExecutableScriptSpecifier(target)) {
      return externalWorkerEntrySpecifier(target);
    }
    const base = unwrapTypeScriptExpression(urlExpression.arguments[1]);
    return ts.isPropertyAccessExpression(base) &&
      base.name.text === 'url' &&
      ts.isMetaProperty(base.expression) &&
      base.expression.keywordToken === ts.SyntaxKind.ImportKeyword
      ? target
      : UNRESOLVED_WORKER_ENTRY_SPECIFIER;
  };
  const linkMutations = new Map();
  const recordLinkMutation = (receiver, property, value, useNode) => {
    const element = resourceElementCreation(receiver, useNode, 'link');
    if (!element || !['rel', 'href'].includes(property)) return;
    const entries = linkMutations.get(element) ?? [];
    const candidate = value && unwrapTypeScriptExpression(value);
    const literal =
      candidate && ts.isStringLiteralLike(candidate)
        ? candidate.text
        : candidate && ts.isIdentifier(candidate)
          ? literalBindings.get(candidate.text)
          : null;
    entries.push({ property, literal: typeof literal === 'string' ? literal : null });
    linkMutations.set(element, entries);
  };
  const hasLocalBinding = (name, useNode) => {
    const bindings = scriptElementBindings.get(name) ?? [];
    for (let scope = scriptLexicalScope(useNode); scope; scope = scriptLexicalScope(scope)) {
      if (
        bindings.some((entry) => {
          // A declaration shadows the global for its whole lexical lifetime,
          // including the TDZ or hoisted pre-initialization portion. An ordinary
          // assignment alone does not introduce a new local binding.
          if (ts.isBinaryExpression(entry.node)) return false;
          let declaredScope = entry.scope;
          if (
            ts.isVariableDeclaration(entry.node) &&
            ts.isVariableDeclarationList(entry.node.parent) &&
            !(entry.node.parent.flags & ts.NodeFlags.BlockScoped)
          ) {
            for (let parent = entry.node.parent; parent; parent = parent.parent) {
              if (ts.isFunctionLike(parent) || ts.isSourceFile(parent)) {
                declaredScope = parent;
                break;
              }
            }
          }
          return declaredScope === scope;
        })
      )
        return true;
      if (ts.isSourceFile(scope)) break;
    }
    return false;
  };
  const isGlobalMethod = (expression, useNode, globalName, methodName) => {
    if (!ts.isCallExpression(expression)) return false;
    const member = staticMemberAccess(expression.expression);
    if (member?.name !== methodName) return false;
    const owner = unwrapTypeScriptExpression(member.receiver);
    if (ts.isIdentifier(owner))
      return owner.text === globalName && !hasLocalBinding(globalName, useNode);
    const qualified = staticMemberAccess(owner);
    return (
      qualified?.name === globalName &&
      ts.isIdentifier(qualified.receiver) &&
      /^(?:globalThis|self|window)$/u.test(qualified.receiver.text) &&
      !hasLocalBinding(qualified.receiver.text, useNode)
    );
  };
  const isGlobalObjectAssign = (expression, useNode) =>
    isGlobalMethod(expression, useNode, 'Object', 'assign');
  const inspectResourceAssignment = (node) => {
    if (!isGlobalObjectAssign(node, node) || !node.arguments[0]) return;
    const target = node.arguments[0];
    const script = isScriptElementExpression(target, node);
    const link = resourceElementCreation(target, node, 'link');
    if (!script && !link) return;
    const unknown = () => {
      if (script) specifiers.push(DYNAMIC_EXECUTABLE_SCRIPT_SPECIFIER);
      if (link) {
        recordLinkMutation(target, 'rel', null, node);
        recordLinkMutation(target, 'href', null, node);
      }
    };
    for (const source of node.arguments.slice(1)) {
      const object = unwrapTypeScriptExpression(source);
      if (!ts.isObjectLiteralExpression(object)) {
        unknown();
        continue;
      }
      for (const property of object.properties) {
        if (ts.isSpreadAssignment(property) || !property.name) {
          unknown();
          continue;
        }
        const name = ts.isComputedPropertyName(property.name)
          ? unwrapTypeScriptExpression(property.name.expression)
          : property.name;
        const key =
          (ts.isIdentifier(name) && !ts.isComputedPropertyName(property.name)) ||
          ts.isStringLiteralLike(name)
            ? name.text
            : null;
        if (key === null) {
          unknown();
          continue;
        }
        const value = ts.isPropertyAssignment(property)
          ? property.initializer
          : ts.isShorthandPropertyAssignment(property)
            ? property.name
            : null;
        if (script && key === 'src') specifiers.push(scriptElementSourceSpecifier(value));
        if (script && scriptBodyProperties.has(key))
          specifiers.push(DYNAMIC_EXECUTABLE_SCRIPT_SPECIFIER);
        if (link) recordLinkMutation(target, key, value, node);
      }
    }
  };
  const inspectReflectResourceMutation = (node) => {
    if (!isGlobalMethod(node, node, 'Reflect', 'set') || !node.arguments[0]) return;
    const target = node.arguments[0];
    const script = isScriptElementExpression(target, node);
    const link = resourceElementCreation(target, node, 'link');
    if (!script && !link) return;
    const argument = node.arguments[1] && unwrapTypeScriptExpression(node.arguments[1]);
    const property = argument && ts.isStringLiteralLike(argument) ? argument.text : null;
    if (script && scriptBodyProperties.has(property))
      specifiers.push(DYNAMIC_EXECUTABLE_SCRIPT_SPECIFIER);
    if (script && (property === 'src' || property === null)) {
      specifiers.push(
        property === null
          ? DYNAMIC_EXECUTABLE_SCRIPT_SPECIFIER
          : scriptElementSourceSpecifier(node.arguments[2])
      );
    }
    if (link) {
      if (property !== null) recordLinkMutation(target, property, node.arguments[2], node);
      else {
        recordLinkMutation(target, 'rel', null, node);
        recordLinkMutation(target, 'href', null, node);
      }
    }
  };
  const isGlobalNavigator = (expression, useNode) => {
    const candidate = unwrapTypeScriptExpression(expression);
    if (ts.isIdentifier(candidate))
      return candidate.text === 'navigator' && !hasLocalBinding('navigator', useNode);
    const member = staticMemberAccess(candidate);
    return (
      member?.name === 'navigator' &&
      ts.isIdentifier(member.receiver) &&
      /^(?:globalThis|self|window)$/u.test(member.receiver.text) &&
      !hasLocalBinding(member.receiver.text, useNode)
    );
  };
  const isBrowserGlobal = (expression, useNode, names) => {
    const candidate = unwrapTypeScriptExpression(expression);
    if (ts.isIdentifier(candidate))
      return names.includes(candidate.text) && !hasLocalBinding(candidate.text, useNode);
    const member = staticMemberAccess(candidate);
    return Boolean(
      member &&
      names.includes(member.name) &&
      ts.isIdentifier(member.receiver) &&
      /^(?:globalThis|self|window)$/u.test(member.receiver.text) &&
      !hasLocalBinding(member.receiver.text, useNode)
    );
  };
  const resolveLocalValue = (expression, useNode, seen, match) => {
    const candidate = unwrapTypeScriptExpression(expression);
    if (match(candidate, useNode, seen)) return true;
    if (!ts.isIdentifier(candidate)) return false;
    for (let scope = scriptLexicalScope(useNode); scope; scope = scriptLexicalScope(scope)) {
      const entries = (scriptElementBindings.get(candidate.text) ?? []).filter(
        (entry) => entry.scope === scope
      );
      const binding = entries
        .filter((entry) => entry.position < useNode.getStart(sourceFile))
        .sort((a, b) => b.position - a.position)[0];
      if (entries.length) {
        if (!binding?.initializer || seen.has(binding) || seen.size >= 64) return false;
        seen.add(binding);
        return resolveLocalValue(binding.initializer, binding.node, seen, match);
      }
      if (ts.isSourceFile(scope)) break;
    }
    return false;
  };
  const isAudioContext = (expression, useNode, seen) =>
    resolveLocalValue(
      expression,
      useNode,
      seen,
      (candidate, node) =>
        ts.isNewExpression(candidate) &&
        isBrowserGlobal(candidate.expression, node, [
          'AudioContext',
          'OfflineAudioContext',
          'webkitAudioContext',
        ])
    );
  const isWorklet = (expression, useNode, seen = new Set()) =>
    resolveLocalValue(expression, useNode, seen, (candidate, node, visited) => {
      const member = staticMemberAccess(candidate);
      return Boolean(
        member &&
        ((member.name === 'paintWorklet' && isBrowserGlobal(member.receiver, node, ['CSS'])) ||
          (member.name === 'audioWorklet' && isAudioContext(member.receiver, node, visited)))
      );
    });
  const visit = (node) => {
    if (
      (ts.isCallExpression(node) || ts.isNewExpression(node)) &&
      resolveLocalValue(node.expression, node, new Set(), (candidate, useNode) =>
        isBrowserGlobal(candidate, useNode, ['eval', 'Function'])
      )
    )
      specifiers.push(UNVERIFIED_RUNTIME_COMPILATION_SPECIFIER);
    if (
      /\.[cm]?[jt]sx?$/iu.test(fileName) &&
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      ts.isIdentifier(node.tagName)
    ) {
      const tag = node.tagName.text;
      if (!harnessPreviewBoundary && /^(?:iframe|object|embed|webview)$/u.test(tag))
        specifiers.push(UNREVIEWED_WEBSITE_EMBED_SPECIFIER);
      if (tag === 'script') {
        const attributes = new Map();
        let opaque = false;
        for (const attribute of node.attributes.properties) {
          if (!ts.isJsxAttribute(attribute) || !ts.isIdentifier(attribute.name)) {
            opaque = true;
            continue;
          }
          const name = attribute.name.text;
          if (attributes.has(name)) opaque = true;
          const initializer = attribute.initializer;
          attributes.set(
            name,
            initializer && ts.isJsxExpression(initializer) ? initializer.expression : initializer
          );
        }
        const typeNode = attributes.get('type');
        const type = typeNode && ts.isStringLiteralLike(typeNode) ? typeNode.text : null;
        if (
          opaque ||
          (attributes.has('type') && (type === null || hasHtmlCharacterReference(type)))
        )
          specifiers.push(DYNAMIC_EXECUTABLE_SCRIPT_SPECIFIER);
        else if (type?.trim().toLowerCase() === 'importmap')
          specifiers.push(DYNAMIC_EXECUTABLE_SCRIPT_SPECIFIER);
        else if (isExecutableScriptType(type)) {
          if (attributes.has('src'))
            specifiers.push(scriptElementSourceSpecifier(attributes.get('src')));
          else if (
            attributes.has('dangerouslySetInnerHTML') ||
            (ts.isJsxOpeningElement(node) &&
              node.parent.children.some((child) => !ts.isJsxText(child) || child.text.trim()))
          )
            specifiers.push(DYNAMIC_EXECUTABLE_SCRIPT_SPECIFIER);
        }
      }
    }
    if (
      harnessPreviewBoundary &&
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      ts.isIdentifier(node.tagName) &&
      /^(?:iframe|object|embed|webview)$/u.test(node.tagName.text)
    )
      specifiers.push('<unreviewed Harness preview>');
    if (ts.isCallExpression(node)) {
      const member = staticMemberAccess(node.expression);
      if (
        member &&
        /^(?:createElement|createElementNS)$/u.test(member.name) &&
        resolveLocalValue(member.receiver, node, new Set(), (candidate, useNode) =>
          isBrowserGlobal(candidate, useNode, ['document'])
        )
      ) {
        const argument = node.arguments[member.name === 'createElementNS' ? 1 : 0];
        let tag = null;
        if (argument)
          resolveLocalValue(argument, node, new Set(), (candidate) => {
            if (!ts.isStringLiteralLike(candidate)) return false;
            tag = candidate.text.toLowerCase();
            return true;
          });
        if (
          (tag === null && harnessPreviewBoundary) ||
          /^(?:iframe|object|embed|webview)$/u.test(tag)
        )
          specifiers.push(
            harnessPreviewBoundary
              ? '<unreviewed Harness preview>'
              : UNREVIEWED_WEBSITE_EMBED_SPECIFIER
          );
      }
    }

    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    ) {
      const assignedProperty = staticMemberAccess(node.left);
      const assignedTarget = unwrapTypeScriptExpression(node.left);
      if (!assignedProperty && ts.isElementAccessExpression(assignedTarget)) {
        const receiver = assignedTarget.expression;
        if (isScriptElementExpression(receiver, node))
          specifiers.push(DYNAMIC_EXECUTABLE_SCRIPT_SPECIFIER);
        if (resourceElementCreation(receiver, node, 'link')) {
          recordLinkMutation(receiver, 'rel', null, node);
          recordLinkMutation(receiver, 'href', null, node);
        }
      }
      if (assignedProperty)
        recordLinkMutation(assignedProperty.receiver, assignedProperty.name, node.right, node);
      if (
        assignedProperty?.name === 'src' &&
        isScriptElementExpression(assignedProperty.receiver, node)
      ) {
        specifiers.push(scriptElementSourceSpecifier(node.right));
      }
      if (
        assignedProperty &&
        scriptBodyProperties.has(assignedProperty.name) &&
        isScriptElementExpression(assignedProperty.receiver, node)
      ) {
        specifiers.push(DYNAMIC_EXECUTABLE_SCRIPT_SPECIFIER);
      }
    }
    if (ts.isCallExpression(node)) {
      inspectResourceAssignment(node);
      inspectReflectResourceMutation(node);
      const calledMember = staticMemberAccess(node.expression);
      if (
        calledMember &&
        scriptBodyMethods.has(calledMember.name) &&
        node.arguments.length > 0 &&
        isScriptElementExpression(calledMember.receiver, node)
      ) {
        specifiers.push(DYNAMIC_EXECUTABLE_SCRIPT_SPECIFIER);
      }
      const attributeName = node.arguments[0];
      if (calledMember?.name === 'setAttribute') {
        const property =
          attributeName && ts.isStringLiteralLike(attributeName)
            ? attributeName.text.toLowerCase()
            : null;
        if (property) recordLinkMutation(calledMember.receiver, property, node.arguments[1], node);
        else {
          recordLinkMutation(calledMember.receiver, 'rel', null, node);
          recordLinkMutation(calledMember.receiver, 'href', null, node);
          if (isScriptElementExpression(calledMember.receiver, node))
            specifiers.push(DYNAMIC_EXECUTABLE_SCRIPT_SPECIFIER);
        }
      }

      if (calledMember?.name === 'addModule' && isWorklet(calledMember.receiver, node)) {
        const argument = node.arguments[0] && unwrapTypeScriptExpression(node.arguments[0]);
        const target =
          argument && ts.isStringLiteralLike(argument)
            ? argument.text
            : argument && ts.isIdentifier(argument)
              ? literalBindings.get(argument.text)
              : null;
        // Browser URL resolution is not Vite's source resolver: a local/dynamic
        // worklet URL stays unverified until its exact public entry is modeled.
        specifiers.push(
          typeof target === 'string' && isExternalExecutableScriptSpecifier(target)
            ? externalWorkerEntrySpecifier(target)
            : UNRESOLVED_WORKER_ENTRY_SPECIFIER
        );
      }
      const serviceWorker =
        calledMember?.name === 'register' ? staticMemberAccess(calledMember.receiver) : null;
      if (
        serviceWorker?.name === 'serviceWorker' &&
        isGlobalNavigator(serviceWorker.receiver, node)
      ) {
        const argument = node.arguments[0] && unwrapTypeScriptExpression(node.arguments[0]);
        const target =
          argument && ts.isStringLiteralLike(argument)
            ? argument.text
            : argument && ts.isIdentifier(argument)
              ? literalBindings.get(argument.text)
              : null;
        specifiers.push(
          typeof target === 'string' && isExternalExecutableScriptSpecifier(target)
            ? externalWorkerEntrySpecifier(target)
            : UNRESOLVED_WORKER_ENTRY_SPECIFIER
        );
      }

      if (
        calledMember?.name === 'setAttribute' &&
        isScriptElementExpression(calledMember.receiver, node) &&
        attributeName &&
        ts.isStringLiteralLike(attributeName) &&
        attributeName.text.toLowerCase() === 'src'
      ) {
        specifiers.push(scriptElementSourceSpecifier(node.arguments[1]));
      }
    }
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      addLiteral(node.moduleSpecifier);
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const importScriptsCallee = unwrapTypeScriptExpression(callee);
      const isImportScriptsCall =
        (ts.isIdentifier(importScriptsCallee) && importScriptsCallee.text === 'importScripts') ||
        (ts.isPropertyAccessExpression(importScriptsCallee) &&
          importScriptsCallee.name.text === 'importScripts' &&
          ts.isIdentifier(importScriptsCallee.expression) &&
          /^(?:globalThis|self)$/u.test(importScriptsCallee.expression.text));
      const isImportMetaGlob =
        ts.isPropertyAccessExpression(callee) &&
        /^(?:glob|globEager)$/u.test(callee.name.text) &&
        ts.isMetaProperty(callee.expression) &&
        callee.expression.keywordToken === ts.SyntaxKind.ImportKeyword;
      if (isImportScriptsCall) {
        for (const argument of node.arguments) {
          specifiers.push(importScriptsTargetSpecifier(argument, literalBindings));
        }
      } else if (
        !isImportMetaGlob &&
        (callee.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(callee) && callee.text === 'require'))
      ) {
        const argument = node.arguments[0];
        const viteIgnored =
          callee.kind === ts.SyntaxKind.ImportKeyword &&
          /\/\*\s*@vite-ignore\s*\*\//u.test(node.getFullText(sourceFile));
        if (argument && viteIgnored) {
          specifiers.push(viteIgnoredDynamicImportSpecifier(argument, sourceFile, literalBindings));
        } else if (argument && ts.isStringLiteralLike(argument)) {
          addLiteral(argument);
        } else if (callee.kind === ts.SyntaxKind.ImportKeyword) {
          specifiers.push(UNRESOLVED_DYNAMIC_IMPORT_SPECIFIER);
        } else if (argument && ts.isIdentifier(argument) && literalBindings.has(argument.text)) {
          specifiers.push(literalBindings.get(argument.text));
        } else {
          specifiers.push(UNRESOLVED_DYNAMIC_REQUIRE_SPECIFIER);
        }
      }
    } else if (ts.isNewExpression(node)) {
      const workerSpecifier = workerEntrySpecifier(node);
      if (workerSpecifier) specifiers.push(workerSpecifier);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  for (const mutations of linkMutations.values()) {
    const hrefs = mutations.filter((entry) => entry.property === 'href');
    if (hrefs.length === 0) continue;
    const relations = mutations.filter((entry) => entry.property === 'rel');
    if (relations.length === 0 || relations.some((entry) => entry.literal === null)) {
      specifiers.push(DYNAMIC_STYLESHEET_REL_SPECIFIER);
      continue;
    }
    if (
      !relations.some((entry) => entry.literal.toLowerCase().split(/\s+/u).includes('stylesheet'))
    )
      continue;
    for (const { literal } of hrefs) {
      if (literal === null) specifiers.push(DYNAMIC_STYLESHEET_LINK_SPECIFIER);
      else {
        const normalized = normalizeBrowserResourceUrl(literal);
        if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(normalized))
          specifiers.push(`${EXTERNAL_STYLESHEET_ELEMENT_SPECIFIER_PREFIX}${normalized}>`);
      }
    }
  }
  return specifiers;
}

// URL Standard basic-parser preprocessing. Relative browser resources use an
// HTTP(S) document base, where reverse solidus also acts as a path separator.
function normalizeBrowserResourceUrl(value) {
  const normalized = value
    .replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/gu, '')
    .replace(/[\t\n\r]/gu, '');
  return !/^[a-z][a-z0-9+.-]*:/iu.test(normalized) ||
    /^(?:https?|file|ftp|wss?):/iu.test(normalized)
    ? normalized.replaceAll('\\', '/')
    : normalized;
}
function staticMarkupResourceUrl(openingTag, name) {
  const value = staticMarkupAttribute(openingTag, name);
  return value === null ? null : normalizeBrowserResourceUrl(value);
}

function staticMarkupAttribute(openingTag, name) {
  const pattern = `\\b${escapeRegularExpression(name)}\\s*=\\s*(?:(['"])([^'"]*)\\1|([^\\s'"=<>\\x60]+))`;
  const match = openingTag.match(new RegExp(pattern, 'iu'));
  return match ? (match[2] ?? match[3]) : null;
}
function hasHtmlCharacterReference(value) {
  return /&(?:#(?:\d+|x[\da-f]+);?|[a-z][a-z\d]+;)/iu.test(value);
}

function isExecutableScriptType(type) {
  if (type === null || type.trim() === '' || type.trim().toLowerCase() === 'module') return true;
  const essence = type.split(';', 1)[0].trim().toLowerCase();
  return /^(?:(?:application|text)\/(?:javascript|ecmascript|x-javascript)|text\/(?:javascript1\.[0-5]|jscript|livescript))$/u.test(
    essence
  );
}
const DYNAMIC_EXECUTABLE_SCRIPT_SPECIFIER = '<dynamic executable script src>';
const UNREVIEWED_WEBSITE_EMBED_SPECIFIER = '<unreviewed Website embed>';
const UNVERIFIED_MARKUP_HANDLER_SPECIFIER = '<unverified markup event handler>';
const UNVERIFIED_RUNTIME_COMPILATION_SPECIFIER = '<unverified runtime compilation>';
const DYNAMIC_STYLESHEET_LINK_SPECIFIER = '<dynamic stylesheet href>';
const DYNAMIC_STYLESHEET_REL_SPECIFIER = '<dynamic stylesheet relation>';
const DYNAMIC_DOCUMENT_BASE_SPECIFIER = '<dynamic document base href>';
const DYNAMIC_EXECUTABLE_SCRIPT_TYPE_SPECIFIER = '<dynamic executable script type>';

function externalScriptModuleSpecifiers(content) {
  return jsxOpeningTagCandidates(content)
    .filter((openingTag) => /^<script\b/iu.test(openingTag))
    .flatMap((openingTag) => {
      const hasSrc = /\bsrc\s*=/iu.test(openingTag);
      const type = staticMarkupAttribute(openingTag, 'type');
      const dynamicType =
        /(?:^|\s)(?::type|v-bind:type)\s*=/iu.test(openingTag) ||
        /(?:^|\s)type\s*=\s*(?:\{|\$\{)/iu.test(openingTag) ||
        (type !== null && hasHtmlCharacterReference(type));
      if (hasSrc && dynamicType) return [DYNAMIC_EXECUTABLE_SCRIPT_TYPE_SPECIFIER];
      if (!isExecutableScriptType(type) || !hasSrc) return [];

      if (/(?:^|\s)(?::src|v-bind:src)\s*=/iu.test(openingTag)) {
        return [DYNAMIC_EXECUTABLE_SCRIPT_SPECIFIER];
      }
      const specifier = staticMarkupResourceUrl(openingTag, 'src');
      if (!specifier || /[{}\x60]/u.test(specifier) || hasHtmlCharacterReference(specifier)) {
        return [DYNAMIC_EXECUTABLE_SCRIPT_SPECIFIER];
      }
      return [specifier];
    });
}
function documentBaseSpecifiers(content) {
  return jsxOpeningTagCandidates(content)
    .filter((openingTag) => /^<base\b/iu.test(openingTag))
    .flatMap((openingTag) => {
      const hasHref = /(?:^|\s)(?:href|:href|v-bind:href)\s*=/iu.test(openingTag);
      if (!hasHref) return [];
      if (/(?:^|\s)(?::href|v-bind:href)\s*=/iu.test(openingTag)) {
        return [DYNAMIC_DOCUMENT_BASE_SPECIFIER];
      }
      const href = staticMarkupResourceUrl(openingTag, 'href');
      if (!href || /[{}\x60]/u.test(href) || hasHtmlCharacterReference(href)) {
        return [DYNAMIC_DOCUMENT_BASE_SPECIFIER];
      }
      return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(href) ? [href] : [];
    });
}
function stylesheetLinkSpecifiers(content) {
  return jsxOpeningTagCandidates(content)
    .filter((openingTag) => /^<link\b/iu.test(openingTag))
    .flatMap((openingTag) => {
      const hasHref = /(?:^|\s)(?:href|:href|v-bind:href)\s*=/iu.test(openingTag);
      if (!hasHref) return [];

      const hasRel = /(?:^|\s)rel\s*=/iu.test(openingTag);
      const relAttribute = staticMarkupAttribute(openingTag, 'rel');
      const dynamicRel =
        /(?:^|\s)(?::rel|v-bind:rel)\s*=/iu.test(openingTag) ||
        (hasRel && /(?:^|\s)rel\s*=\s*(?:\{|\$\{)/iu.test(openingTag)) ||
        (relAttribute !== null && hasHtmlCharacterReference(relAttribute));

      if (dynamicRel) return [DYNAMIC_STYLESHEET_REL_SPECIFIER];
      if (!hasRel) return [];

      const rel = staticMarkupAttribute(openingTag, 'rel');
      if (rel === null || /[{}\x60]/u.test(rel)) {
        return [DYNAMIC_STYLESHEET_REL_SPECIFIER];
      }
      if (!rel.split(/\s+/u).some((token) => token.toLowerCase() === 'stylesheet')) return [];

      if (/(?:^|\s)(?::href|v-bind:href)\s*=/iu.test(openingTag)) {
        return [DYNAMIC_STYLESHEET_LINK_SPECIFIER];
      }
      const specifier = staticMarkupResourceUrl(openingTag, 'href');
      if (!specifier || /[{}\x60]/u.test(specifier) || hasHtmlCharacterReference(specifier)) {
        return [DYNAMIC_STYLESHEET_LINK_SPECIFIER];
      }
      return [specifier];
    });
}
function containsProductionImportMap(content) {
  return jsxOpeningTagCandidates(content).some((openingTag) => {
    if (!/^<script\b/iu.test(openingTag)) return false;
    const type = staticMarkupAttribute(openingTag, 'type');
    const opaqueType =
      /(?:^|\s)(?::type|v-bind:type)\s*=/iu.test(openingTag) ||
      /(?:^|\s)type\s*=\s*(?:\{|\$\{)/iu.test(openingTag) ||
      (type !== null && hasHtmlCharacterReference(type));
    // An opaque type could become importmap even without a src attribute.
    // Do not decode candidate HTML or claim that it is definitely an import map.
    return opaqueType || type?.trim().toLowerCase() === 'importmap';
  });
}
// Reviewed production map in apps/www/astro.config.mjs. This is an exact URL
// allowlist, not an assertion about immutable content at those remote URLs.
const REVIEWED_ASTRO_IMPORTS = Object.freeze({
  react: 'https://esm.sh/react@18',
  'react-dom/client': 'https://esm.sh/react-dom@18/client',
  vue: 'https://esm.sh/vue@3',
});

function astroHeadImportMapIssues(rootDir) {
  const sourcePath = 'apps/www/astro.config.mjs';
  const absolutePath = path.join(rootDir, sourcePath);
  if (!fs.existsSync(absolutePath)) return [];
  const issues = [];
  const reject = (reason) =>
    issues.push({
      sourcePath,
      specifier: '<config import map>',
      category: 'unreviewed-config-import-map',
      reason,
    });
  if (!fs.lstatSync(absolutePath).isFile() || fs.lstatSync(absolutePath).isSymbolicLink()) {
    reject('config source is not a regular reviewed file');
    return issues;
  }
  const sourceFile = ts.createSourceFile(
    absolutePath,
    fs.readFileSync(absolutePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  const propertyName = (name) => {
    if (ts.isComputedPropertyName(name)) {
      const value = unwrapTypeScriptExpression(name.expression);
      return ts.isStringLiteralLike(value) ? value.text : null;
    }
    return ts.isIdentifier(name) || ts.isStringLiteralLike(name) ? name.text : null;
  };
  const fields = (node) => {
    const value = unwrapTypeScriptExpression(node);
    if (!ts.isObjectLiteralExpression(value)) return null;
    const result = new Map();
    for (const property of value.properties) {
      if (!ts.isPropertyAssignment(property)) return null;
      const name = propertyName(property.name);
      if (name === null || result.has(name)) return null;
      result.set(name, unwrapTypeScriptExpression(property.initializer));
    }
    return result;
  };
  const literal = (node) => (node && ts.isStringLiteralLike(node) ? node.text : null);
  let mapCount = 0;
  const inspectHead = (node) => {
    const head = unwrapTypeScriptExpression(node);
    if (!ts.isArrayLiteralExpression(head))
      return reject('dynamic head configuration is unverified');
    for (const entry of head.elements) {
      const item = fields(entry);
      const tag = item && literal(item.get('tag'));
      if (!tag) {
        reject('dynamic head entry is unverified');
        continue;
      }
      if (tag.toLowerCase() !== 'script') continue;
      const attrs = item.has('attrs') ? fields(item.get('attrs')) : null;
      const type = attrs && literal(attrs.get('type'))?.trim().toLowerCase();
      if (type === 'application/json' || type === 'application/ld+json') continue;
      if (type !== 'importmap') {
        reject('unreviewed executable or dynamic head script');
        continue;
      }
      mapCount += 1;
      const content = literal(item.get('content'));
      if (content === null || item.size !== 3 || attrs.size !== 1) {
        reject('import map entry shape is unverified');
        continue;
      }
      let map;
      try {
        map = JSON.parse(content);
      } catch {
        reject('import map JSON is invalid');
        continue;
      }
      const imports = map && typeof map === 'object' && !Array.isArray(map) && map.imports;
      if (
        !imports ||
        typeof imports !== 'object' ||
        Array.isArray(imports) ||
        Object.keys(map).length !== 1 ||
        Object.keys(imports).length !== Object.keys(REVIEWED_ASTRO_IMPORTS).length ||
        Object.entries(REVIEWED_ASTRO_IMPORTS).some(
          ([key, value]) => !Object.hasOwn(imports, key) || imports[key] !== value
        )
      )
        reject('import map does not match the exact reviewed mappings');
    }
  };
  const visit = (node) => {
    if (ts.isPropertyAssignment(node)) {
      const name = propertyName(node.name);
      if (name === 'head') inspectHead(node.initializer);
      else if (name === null) reject('computed config field is unverified');
    } else if (ts.isShorthandPropertyAssignment(node) && node.name.text === 'head') {
      reject('shorthand head configuration is unverified');
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (sourceFile.parseDiagnostics.length) reject('config syntax is unverified');
  if (mapCount > 1) reject('multiple config import maps are unreviewed');
  return issues;
}

function isExternalExecutableScriptSpecifier(specifier) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/|\/\/)/iu.test(specifier);
}

function scriptViteGlobPatternGroups(source, fileName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const groups = [];
  const literalPatterns = (node) => {
    if (ts.isStringLiteralLike(node)) return [node.text];
    if (!ts.isArrayLiteralExpression(node)) return [];
    return node.elements.filter(ts.isStringLiteralLike).map((element) => element.text);
  };
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'glob' &&
      ts.isMetaProperty(node.expression.expression) &&
      node.expression.expression.keywordToken === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0]
    ) {
      const patterns = literalPatterns(node.arguments[0]);
      if (patterns.length > 0) groups.push(patterns);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return groups;
}

function embeddedScriptSegments(content) {
  const segments = [];
  const frontmatter = content.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/u);
  if (frontmatter) segments.push(frontmatter[1]);
  for (const match of content.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/giu)) {
    segments.push(match[1]);
  }
  return segments;
}

function styleModuleSpecifiers(content) {
  const specifiers = [];
  let quote = null;
  let escaped = false;
  let inComment = false;
  let inLineComment = false;
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (inLineComment) {
      if (character === '\n' || character === '\r') inLineComment = false;
      continue;
    }
    if (inComment) {
      if (character === '*' && content[index + 1] === '/') {
        inComment = false;
        index += 1;
      }
      continue;
    }
    if (character === '/' && content[index + 1] === '*') {
      inComment = true;
      index += 1;
      continue;
    }
    if (character === '/' && content[index + 1] === '/') {
      inLineComment = true;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (!/^@(?:import|use|forward)\b/iu.test(content.slice(index))) {
      continue;
    }
    const directive = content.slice(index).match(/^@(import|use|forward)\b\s+/iu);
    if (directive) {
      const targetPattern =
        /^(?:url\(\s*(?:(['"])([^'"]+)\1|([^'"\s)]+))\s*\)|(?:(['"])([^'"]+)\4|([^'"\s;,)]+)))/u;
      const directiveTailOffset =
        directive[1].toLowerCase() === 'import'
          ? (content.slice(index + directive[0].length).match(/^\([^)]*\)\s*/u)?.[0].length ?? 0)
          : 0;
      const firstTarget = content
        .slice(index + directive[0].length + directiveTailOffset)
        .match(targetPattern);
      if (!firstTarget) continue;
      const targetValue = (target) => {
        const value = target[2] ?? target[3] ?? target[5] ?? target[6];
        return directive[1].toLowerCase() === 'import' ? normalizeBrowserResourceUrl(value) : value;
      };
      specifiers.push(targetValue(firstTarget));
      let consumedLength = directive[0].length + directiveTailOffset + firstTarget[0].length;
      if (directive[1].toLowerCase() === 'import') {
        while (true) {
          const comma = content.slice(index + consumedLength).match(/^\s*,\s*/u);
          if (!comma) break;
          const additionalTarget = content
            .slice(index + consumedLength + comma[0].length)
            .match(targetPattern);
          if (!additionalTarget) break;
          specifiers.push(targetValue(additionalTarget));
          consumedLength += comma[0].length + additionalTarget[0].length;
        }
      }
      index += consumedLength - 1;
    }
  }
  return specifiers;
}

function embeddedStyleSegments(content) {
  return [...content.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/giu)].map((match) => match[1]);
}

function promotionStyleResourceUrls(absolutePath) {
  const styles = /\.(?:css|less|s[ac]ss)$/iu.test(absolutePath)
    ? [fs.readFileSync(absolutePath, 'utf8')]
    : /\.(?:html?|astro|vue|svelte)$/iu.test(absolutePath)
      ? embeddedStyleSegments(fs.readFileSync(absolutePath, 'utf8'))
      : [];
  const urls = [];
  const unverified = () => {
    throw new Error(`promotion CSS resource URL in ${absolutePath} remains unverified`);
  };
  const decodeCss = (value) =>
    value.replace(
      /\\(?:([\da-f]{1,6})(?:\r\n|[\t\n\r\f ])?|([\s\S]))/giu,
      (_match, hex, character) => {
        if (!hex) return /[\n\r\f]/u.test(character) ? '' : character;
        const code = Number.parseInt(hex, 16);
        return code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)
          ? '\uFFFD'
          : String.fromCodePoint(code);
      }
    );
  // A bounded lexical URL collector, not a general CSS parser or sanitizer.
  // Quoted examples and comments are opaque; URL values retain CSS escapes.
  for (const content of styles) {
    // CSS preprocessing replaces raw NUL with U+FFFD before tokenization.
    // Do not let browser URL trimming silently bind a different asset instead.
    // https://www.w3.org/TR/css-syntax-3/#input-preprocessing
    if (content.includes('\0')) unverified();
    let index = 0;
    const whitespace = () => {
      while (/[\t\n\r\f ]/u.test(content[index] ?? '') && index < content.length) index += 1;
    };
    const quoted = () => {
      const quote = content[index++];
      const start = index;
      while (index < content.length) {
        if (content[index] === '\\') {
          index += 2;
          continue;
        }
        if (content[index] === quote) return content.slice(start, index++);
        index += 1;
      }
      return unverified();
    };
    while (index < content.length) {
      if (content.startsWith('/*', index)) {
        const end = content.indexOf('*/', index + 2);
        if (end < 0) unverified();
        index = end + 2;
        continue;
      }
      if (content[index] === '"' || content[index] === "'") {
        quoted();
        continue;
      }
      const identifier = content
        .slice(index)
        .match(/^(?:[-_a-z\d]|\\(?:[\da-f]{1,6}(?:\r\n|[\t\n\r\f ])?|[^\n\r\f]))+/iu)?.[0];
      if (!identifier) {
        index += 1;
        continue;
      }
      index += identifier.length;
      const functionName = decodeCss(identifier).toLowerCase();
      if (/^(?:-webkit-)?image-set$/u.test(functionName) && content[index] === '(') unverified();
      if (functionName !== 'url' || content[index] !== '(') continue;
      index += 1;
      whitespace();
      let value;
      if (content[index] === '"' || content[index] === "'") {
        value = quoted();
        whitespace();
      } else {
        const start = index;
        while (index < content.length && content[index] !== ')') {
          if (content[index] === '\\') {
            const escape = content
              .slice(index)
              .match(/^\\(?:[\da-f]{1,6}(?:\r\n|[\t\n\r\f ])?|[^\n\r\f])/iu)?.[0];
            if (!escape) unverified();
            index += escape.length;
          } else if (/[\t\n\r\f ]/u.test(content[index])) break;
          else {
            if (/[('"\u0000-\u0008\u000b\u000e-\u001f\u007f]/u.test(content[index])) unverified();
            index += 1;
          }
        }
        value = content.slice(start, index);
        whitespace();
      }
      if (content[index++] !== ')') unverified();
      const url = normalizeBrowserResourceUrl(decodeCss(value));
      if (/[\u0000-\u001f\u007f]/u.test(url) || /(?:#|@|\$)\{/u.test(url)) unverified();
      if (!url || url.startsWith('#') || /^data:/iu.test(url)) continue;
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/iu.test(url)) unverified();
      urls.push(url);
    }
  }
  return urls;
}

function externalStylesheetSpecifiersForWebsiteSource(absolutePath) {
  const content = fs.readFileSync(absolutePath, 'utf8');
  const styleSpecifiers = /\.(?:css|less|s[ac]ss)$/i.test(absolutePath)
    ? styleModuleSpecifiers(content)
    : /\.(?:astro|vue|svelte)$/i.test(absolutePath)
      ? embeddedStyleSegments(content).flatMap(styleModuleSpecifiers)
      : [];
  const markup = /\.mdx?$/i.test(absolutePath) ? stripMarkdownCode(content) : content;
  const linkSpecifiers = /\.(?:html?|astro|mdx?|vue|svelte)$/i.test(absolutePath)
    ? stylesheetLinkSpecifiers(markup)
    : [];
  return [...styleSpecifiers, ...linkSpecifiers].filter(
    (specifier) =>
      specifier === DYNAMIC_STYLESHEET_LINK_SPECIFIER ||
      specifier === DYNAMIC_STYLESHEET_REL_SPECIFIER ||
      /^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(specifier)
  );
}

function markupEventHandlerSpecifiers(content, absolutePath, options) {
  if (!/\.(?:html?|astro)$/iu.test(absolutePath)) return [];
  const specifiers = [];
  const inspect = (body, raw, literal, sourceLocation) => {
    // A parser result is source evidence, never execution or admission. Browser
    // handler URLs do not inherit the component source file's module base.
    if (!sourceLocation || !literal || hasHtmlCharacterReference(raw)) {
      specifiers.push(UNVERIFIED_MARKUP_HANDLER_SPECIFIER);
      return;
    }
    const parsed = ts.createSourceFile(
      absolutePath,
      body,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS
    );
    if (
      parsed.parseDiagnostics.length > 0 ||
      scriptModuleSpecifiers(body, absolutePath, options).length > 0
    )
      specifiers.push(UNVERIFIED_MARKUP_HANDLER_SPECIFIER);
  };
  try {
    if (/\.html?$/iu.test(absolutePath)) {
      const visit = (node) => {
        for (const attribute of node.attrs ?? []) {
          if (!NATIVE_EVENT_ATTRIBUTE_NAMES.has(attribute.name.toLowerCase())) continue;
          const location =
            node.sourceCodeLocation?.attrs?.[
              attribute.prefix ? `${attribute.prefix}:${attribute.name}` : attribute.name
            ];
          const raw = location ? content.slice(location.startOffset, location.endOffset) : '';
          const literal = /^[^\s=]+\s*=\s*(["'])([\s\S]*)\1$/u.test(raw);
          inspect(attribute.value, raw, literal, location);
        }
        for (const child of node.childNodes ?? []) visit(child);
        // Template content is separately stored by the HTML parser. Inventory
        // still sees handlers that can become active when the template is used.
        if (node.content) visit(node.content);
      };
      visit(parseHtml(content, { sourceCodeLocationInfo: true }));
    } else {
      const parsed = parseAstro(content, { position: true });
      if (parsed.diagnostics.some((diagnostic) => diagnostic.severity === 1)) {
        specifiers.push(UNVERIFIED_MARKUP_HANDLER_SPECIFIER);
        return specifiers;
      }
      const visit = (node, foreignContent = false, parentIsElement = false) => {
        const nativeElement = node.type === 'element' || node.type === 'custom-element';
        const childIsForeign =
          foreignContent || (nativeElement && /^(?:svg|math)$/iu.test(node.name));
        // Astro can retain foreign-content integration markup as raw text
        // (for example SVG title). Any markup in that text stays unverified;
        // a quoted delimiter must not hide its possible browser structure.
        if (
          foreignContent &&
          parentIsElement &&
          node.type === 'text' &&
          /<[A-Za-z!/?]/u.test(node.value)
        )
          specifiers.push(UNVERIFIED_MARKUP_HANDLER_SPECIFIER);
        if (nativeElement) {
          for (const attribute of node.attributes ?? []) {
            if (!NATIVE_EVENT_ATTRIBUTE_NAMES.has(attribute.name.toLowerCase())) continue;
            const raw = attribute.raw ?? '';
            const literal =
              attribute.kind === 'quoted' && /^["']/u.test(raw) && raw.at(-1) === raw[0];
            inspect(attribute.value, raw, literal, attribute.position);
          }
        }
        // Component callback props and expression text are not native HTML
        // attributes; real elements nested in expressions still get visited.
        for (const child of node.children ?? []) visit(child, childIsForeign, nativeElement);
      };
      visit(parsed.ast);
    }
  } catch {
    specifiers.push(UNVERIFIED_MARKUP_HANDLER_SPECIFIER);
  }
  return specifiers;
}

function moduleSpecifiersForWebsiteSource(absolutePath, options = {}) {
  if (/\.svg$/i.test(absolutePath)) return [];
  const content = fs.readFileSync(absolutePath, 'utf8');
  if (/\.(?:css|less|s[ac]ss)$/i.test(absolutePath)) {
    return styleModuleSpecifiers(content);
  }
  if (/\.html?$/i.test(absolutePath)) {
    return [
      ...markupEventHandlerSpecifiers(content, absolutePath, options),
      ...stylesheetLinkSpecifiers(content).filter(
        (specifier) =>
          !specifier.startsWith('<') && !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(specifier)
      ),
      ...externalScriptModuleSpecifiers(content).filter(
        (specifier) =>
          specifier !== DYNAMIC_EXECUTABLE_SCRIPT_SPECIFIER &&
          specifier !== DYNAMIC_EXECUTABLE_SCRIPT_TYPE_SPECIFIER
      ),
      ...embeddedScriptSegments(content).flatMap((segment) =>
        scriptModuleSpecifiers(segment, absolutePath, options)
      ),
    ];
  }
  if (/\.(?:astro|vue|svelte)$/i.test(absolutePath)) {
    return [
      ...markupEventHandlerSpecifiers(content, absolutePath, options),
      ...stylesheetLinkSpecifiers(content).filter(
        (specifier) =>
          !specifier.startsWith('<') && !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(specifier)
      ),
      ...externalScriptModuleSpecifiers(content).filter(
        (specifier) =>
          specifier !== DYNAMIC_EXECUTABLE_SCRIPT_SPECIFIER &&
          specifier !== DYNAMIC_EXECUTABLE_SCRIPT_TYPE_SPECIFIER
      ),
      ...embeddedScriptSegments(content).flatMap((segment) =>
        scriptModuleSpecifiers(segment, absolutePath, options)
      ),
      ...embeddedStyleSegments(content).flatMap(styleModuleSpecifiers),
    ];
  }
  const source = /\.mdx?$/i.test(absolutePath) ? stripMarkdownCode(content) : content;
  return scriptModuleSpecifiers(source, absolutePath, options);
}

function viteGlobPatternGroupsForWebsiteSource(absolutePath) {
  if (/\.svg$/i.test(absolutePath)) return [];
  const content = fs.readFileSync(absolutePath, 'utf8');
  if (/\.(?:css|less|s[ac]ss)$/i.test(absolutePath)) return [];
  if (/\.(?:astro|vue|svelte)$/i.test(absolutePath)) {
    return embeddedScriptSegments(content).flatMap((segment) =>
      scriptViteGlobPatternGroups(segment, absolutePath)
    );
  }
  const source = /\.mdx?$/i.test(absolutePath) ? stripMarkdownCode(content) : content;
  return scriptViteGlobPatternGroups(source, absolutePath);
}

function configuredWebsiteSourceAliases(rootDir) {
  const configPath = path.join(rootDir, 'apps', 'www', 'astro.config.mjs');
  const aliases = new Map();
  const unsupported = new Set();
  let unsupportedAll = false;
  if (!fs.existsSync(configPath)) return { aliases, unsupported, unsupportedAll };
  const configSource = fs.readFileSync(configPath, 'utf8');
  const sourceFile = ts.createSourceFile(
    configPath,
    configSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  const propertyName = (node) =>
    node.name && (ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name))
      ? node.name.text
      : null;
  const aliasReplacement = (expression) => {
    const candidate = unwrapTypeScriptExpression(expression);
    if (ts.isStringLiteralLike(candidate)) {
      return path.isAbsolute(candidate.text)
        ? candidate.text
        : path.resolve(path.dirname(configPath), candidate.text);
    }
    if (
      !ts.isCallExpression(candidate) ||
      !ts.isIdentifier(candidate.expression) ||
      candidate.expression.text !== 'fileURLToPath' ||
      !candidate.arguments[0]
    ) {
      return null;
    }
    const url = unwrapTypeScriptExpression(candidate.arguments[0]);
    if (
      !ts.isNewExpression(url) ||
      !ts.isIdentifier(url.expression) ||
      url.expression.text !== 'URL' ||
      !url.arguments?.[0] ||
      !ts.isStringLiteralLike(url.arguments[0])
    ) {
      return null;
    }
    return path.resolve(path.dirname(configPath), url.arguments[0].text);
  };
  const visit = (node) => {
    if (ts.isPropertyAssignment(node) && propertyName(node) === 'alias') {
      const aliasInitializer = unwrapTypeScriptExpression(node.initializer);
      if (ts.isObjectLiteralExpression(aliasInitializer)) {
        for (const property of aliasInitializer.properties) {
          if (!ts.isPropertyAssignment(property)) continue;
          const key = propertyName(property);
          if (!key) continue;
          const replacement = aliasReplacement(property.initializer);
          if (replacement) aliases.set(key, replacement);
          else unsupported.add(key);
        }
      } else if (ts.isArrayLiteralExpression(aliasInitializer)) {
        for (const element of aliasInitializer.elements) {
          const entry = unwrapTypeScriptExpression(element);
          if (!ts.isObjectLiteralExpression(entry)) {
            unsupportedAll = true;
            continue;
          }
          const findProperty = entry.properties.find(
            (property) => ts.isPropertyAssignment(property) && propertyName(property) === 'find'
          );
          const replacementProperty = entry.properties.find(
            (property) =>
              ts.isPropertyAssignment(property) && propertyName(property) === 'replacement'
          );
          const find =
            findProperty && ts.isPropertyAssignment(findProperty)
              ? unwrapTypeScriptExpression(findProperty.initializer)
              : null;
          if (!find || !ts.isStringLiteralLike(find)) {
            unsupportedAll = true;
            continue;
          }
          const replacement =
            replacementProperty && ts.isPropertyAssignment(replacementProperty)
              ? aliasReplacement(replacementProperty.initializer)
              : null;
          if (replacement) aliases.set(find.text, replacement);
          else unsupported.add(find.text);
        }
      } else {
        unsupportedAll = true;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return { aliases, unsupported, unsupportedAll };
}

function configuredAliasMatch(specifier, aliasConfig) {
  for (const [key, replacement] of [...aliasConfig.aliases].sort(
    ([left], [right]) => right.length - left.length
  )) {
    if (specifier === key || specifier.startsWith(`${key}/`)) {
      return {
        replacement,
        suffix: specifier.slice(key.length).replace(/^\//u, ''),
      };
    }
  }
  return null;
}

function matchesUnsupportedAlias(specifier, aliasConfig) {
  return (
    aliasConfig.unsupportedAll === true ||
    [...aliasConfig.unsupported].some((key) => specifier === key || specifier.startsWith(`${key}/`))
  );
}

function importSpecifierWithoutViteSuffix(specifier) {
  return specifier.replace(/[?#].*$/u, '');
}

function canonicalImportTarget(absolutePath) {
  if (/[?*{}\[\]]/u.test(absolutePath)) return absolutePath;
  let existing = absolutePath;
  const suffix = [];
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) return absolutePath;
    suffix.unshift(path.basename(existing));
    existing = parent;
  }
  return path.join(fs.realpathSync(existing), ...suffix);
}

// Package globs are admitted with iterative directory reads. A post-glob
// module-count check cannot bound the work or allocation of fs.globSync itself.
const PACKAGE_GLOB_LIMITS = Object.freeze({ entries: 10_000, depth: 64, pathBytes: 1024 });
export function boundedPackageGlobTargets(
  packageRoot,
  absolutePattern,
  budget = { entries: 0 },
  limits = PACKAGE_GLOB_LIMITS
) {
  const unverified = (reason) => new Error(`package glob ${reason}; closure remains unverified`);
  if (Buffer.byteLength(absolutePattern) > limits.pathBytes)
    throw unverified('exceeds the path-byte bound');
  const canonicalRoot = fs.realpathSync(packageRoot);
  const assertInside = (candidate) => {
    const relative = path.relative(canonicalRoot, canonicalImportTarget(candidate));
    if (relative.startsWith('..') || path.isAbsolute(relative))
      throw unverified('resolves outside its package');
    if (relative.split(path.sep).length > limits.depth)
      throw unverified('exceeds the directory-depth bound');
    if (Buffer.byteLength(relative) > limits.pathBytes)
      throw unverified('exceeds the path-byte bound');
  };
  // Start at the literal directory prefix rather than enumerate unrelated
  // package trees. The first glob segment and everything below it stay bounded.
  const segments = absolutePattern.split(path.sep);
  const firstGlob = segments.findIndex((segment) => /[?*{}[\]]|[!+@]\(/u.test(segment));
  const prefix =
    firstGlob < 0
      ? path.dirname(absolutePattern)
      : segments.slice(0, firstGlob).join(path.sep) || path.parse(absolutePattern).root;
  assertInside(prefix);
  if (!fs.existsSync(prefix)) return [];
  const matches = [];
  const pending = [prefix];
  while (pending.length > 0) {
    const directory = pending.pop();
    assertInside(directory);
    const handle = fs.opendirSync(directory, { bufferSize: 1 });
    try {
      let entry;
      while ((entry = handle.readSync()) !== null) {
        if (++budget.entries > limits.entries)
          throw unverified('exceeds the entry-enumeration bound');
        const candidate = path.join(directory, entry.name);
        assertInside(candidate);
        // Do not follow aliases/cycles while claiming a complete package glob.
        if (entry.isSymbolicLink()) throw unverified('contains an unsupported symlink');
        if (entry.isDirectory()) pending.push(candidate);
        else if (entry.isFile() && path.matchesGlob(candidate, absolutePattern))
          matches.push(candidate);
      }
    } finally {
      handle.closeSync();
    }
  }
  return matches;
}

function viteGlobTargets(
  rootDir,
  sourcePath,
  patterns,
  { aliasConfig, viteRoot, packageRoot, globBudget }
) {
  const sourceDirectory = path.dirname(path.resolve(rootDir, sourcePath));
  const targets = new Map();
  const resolvePattern = (authoredPattern) => {
    const pattern = authoredPattern.startsWith('!') ? authoredPattern.slice(1) : authoredPattern;
    let absolutePattern = null;
    const aliasMatch = configuredAliasMatch(pattern, aliasConfig);
    if (aliasMatch) {
      absolutePattern = path.resolve(aliasMatch.replacement, aliasMatch.suffix);
    } else if (pattern.startsWith('.')) {
      absolutePattern = path.resolve(sourceDirectory, pattern);
    } else if (pattern.startsWith('/')) {
      absolutePattern = path.resolve(viteRoot, `.${pattern}`);
    }
    return absolutePattern;
  };
  if (
    packageRoot &&
    ((globBudget.patterns += patterns.length) > 128 ||
      patterns.some((pattern) => Buffer.byteLength(pattern) > 1024))
  )
    throw new Error('package glob pattern bound exceeded; closure remains unverified');
  const expandPattern = (authoredPattern) => {
    const absolutePattern = resolvePattern(authoredPattern);
    if (!absolutePattern) return [];
    if (packageRoot) return boundedPackageGlobTargets(packageRoot, absolutePattern, globBudget);
    return fs
      .globSync(absolutePattern.replaceAll('\\', '/'))
      .map((matchedPath) => path.resolve(matchedPath))
      .filter((matchedPath) => fs.existsSync(matchedPath) && fs.statSync(matchedPath).isFile());
  };
  const positivePatterns = patterns.filter((pattern) => !pattern.startsWith('!'));
  const negativePatterns = patterns.filter((pattern) => pattern.startsWith('!'));
  for (const authoredPattern of positivePatterns) {
    for (const matchedPath of expandPattern(authoredPattern)) {
      targets.set(matchedPath, authoredPattern);
    }
  }
  for (const authoredPattern of negativePatterns) {
    const negativePattern = resolvePattern(authoredPattern);
    const excluded = packageRoot
      ? [...targets.keys()].filter(
          (candidate) => negativePattern && path.matchesGlob(candidate, negativePattern)
        )
      : expandPattern(authoredPattern);
    for (const matchedPath of excluded) {
      targets.delete(matchedPath);
    }
  }
  return [...targets].map(([absolutePath, authoredPattern]) => ({
    absolutePath,
    authoredPattern,
  }));
}

function relativeImportSpecifier(sourcePath, rootDir, targetPath) {
  let specifier = path
    .relative(path.dirname(path.resolve(rootDir, sourcePath)), targetPath)
    .replaceAll('\\', '/');
  if (!specifier.startsWith('.')) specifier = `./${specifier}`;
  return specifier;
}

function isReviewedBuildTimeModuleSpecifier(sourcePath, specifier) {
  // Public assets and entry HTML execute directly in the browser. They cannot
  // inherit the Node/Astro/Vite resolvers used by compiled application sources.
  if (/\/public\/|\.html?$/iu.test(sourcePath)) return false;
  if (isNodeBuiltinSpecifier(specifier)) return true;
  return (
    sourcePath.startsWith('apps/www/src/') &&
    new Set([
      'astro:content',
      'astro:middleware',
      'virtual:starlight/user-config',
      'virtual:starlight/project-context',
      'virtual:starlight/pagefind-config',
    ]).has(specifier)
  );
}

function guardedWebsiteImport(
  rootDir,
  canonicalRootDir,
  sourcePath,
  specifier,
  websiteAliasConfig
) {
  if (specifier === DYNAMIC_STYLESHEET_REL_SPECIFIER)
    return { category: 'dynamic-stylesheet-relation', resolvedPath: null };
  if (specifier === DYNAMIC_STYLESHEET_LINK_SPECIFIER)
    return { category: 'dynamic-stylesheet-link', resolvedPath: null };
  if (
    specifier.startsWith(EXTERNAL_STYLESHEET_ELEMENT_SPECIFIER_PREFIX) &&
    specifier.endsWith('>')
  ) {
    return {
      category: 'external-stylesheet',
      specifier: specifier.slice(EXTERNAL_STYLESHEET_ELEMENT_SPECIFIER_PREFIX.length, -1),
      resolvedPath: null,
    };
  }
  const viteIgnoredBoundary = viteIgnoredDynamicImportBoundary(specifier);
  if (viteIgnoredBoundary !== null) {
    return {
      category: 'vite-ignored-dynamic-import',
      boundary: viteIgnoredBoundary,
      resolvedPath: null,
    };
  }
  const externalWorkerScript = externalImportScriptsTarget(specifier);
  if (externalWorkerScript !== null) {
    return {
      category: 'external-executable-script',
      specifier: externalWorkerScript,
      resolvedPath: null,
    };
  }
  const externalWorkerEntry = externalWorkerEntryTarget(specifier);
  if (externalWorkerEntry !== null) {
    return {
      category: 'external-executable-script',
      specifier: externalWorkerEntry,
      resolvedPath: null,
    };
  }
  const externalScriptElement = externalScriptElementTarget(specifier);
  if (externalScriptElement !== null) {
    return {
      category: 'external-executable-script',
      specifier: externalScriptElement,
      resolvedPath: null,
    };
  }
  if (specifier === UNVERIFIED_MARKUP_HANDLER_SPECIFIER)
    return { category: 'unverified-markup-handler', resolvedPath: null };
  if (specifier === UNVERIFIED_RUNTIME_COMPILATION_SPECIFIER)
    return { category: 'unverified-runtime-compilation', resolvedPath: null };
  if (specifier === DYNAMIC_EXECUTABLE_SCRIPT_SPECIFIER) {
    return { category: 'dynamic-executable-script', resolvedPath: null };
  }
  if (specifier === UNREVIEWED_WEBSITE_EMBED_SPECIFIER)
    return { category: 'unreviewed-embed', resolvedPath: null };
  if (specifier === UNRESOLVED_WORKER_ENTRY_SPECIFIER) {
    return { category: 'unresolved-worker-entry', resolvedPath: null };
  }
  if (specifier === UNRESOLVED_IMPORTSCRIPTS_SPECIFIER) {
    return { category: 'unresolved-worker-script', resolvedPath: null };
  }
  const classifiedSpecifier = importSpecifierWithoutViteSuffix(specifier);
  if (
    /^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(classifiedSpecifier) &&
    !isReviewedBuildTimeModuleSpecifier(sourcePath, classifiedSpecifier)
  ) {
    return {
      category: 'external-executable-script',
      specifier: classifiedSpecifier,
      resolvedPath: null,
    };
  }
  if (classifiedSpecifier === UNRESOLVED_DYNAMIC_IMPORT_SPECIFIER) {
    return { category: 'unresolved-dynamic-import', resolvedPath: null };
  }
  if (classifiedSpecifier === UNRESOLVED_DYNAMIC_REQUIRE_SPECIFIER) {
    return { category: 'unresolved-dynamic-require', resolvedPath: null };
  }
  if (/^@proto\.ui\/adapter-[a-z0-9-]+(?:\/|$)/u.test(classifiedSpecifier)) {
    return { category: 'adapter-package', resolvedPath: null };
  }
  if (/^@proto\.ui\/prototypes-[a-z0-9-]+(?:\/|$)/u.test(classifiedSpecifier)) {
    return { category: 'prototype-package', resolvedPath: null };
  }
  if (/^@proto\.ui\/module-[a-z0-9-]+(?:\/|$)/u.test(classifiedSpecifier)) {
    return { category: 'module-package', resolvedPath: null };
  }
  if (/^@proto\.ui\/core(?:\/|$)/u.test(classifiedSpecifier)) {
    return { category: 'core-package', resolvedPath: null };
  }
  if (/^@proto\.ui\/runtime(?:\/|$)/u.test(classifiedSpecifier)) {
    return { category: 'runtime-package', resolvedPath: null };
  }
  if (/^@proto\.ui\/hooks(?:\/|$)/u.test(classifiedSpecifier)) {
    return { category: 'hooks-package', resolvedPath: null };
  }
  const aliasMatch = configuredAliasMatch(classifiedSpecifier, websiteAliasConfig);
  if (matchesUnsupportedAlias(classifiedSpecifier, websiteAliasConfig)) {
    return { category: 'unresolved-alias', resolvedPath: null };
  }
  if (!classifiedSpecifier.startsWith('.') && !aliasMatch) return null;
  const resolvedPath = path
    .relative(
      canonicalRootDir,
      aliasMatch
        ? canonicalImportTarget(path.resolve(aliasMatch.replacement, aliasMatch.suffix))
        : canonicalImportTarget(
            path.resolve(rootDir, path.dirname(sourcePath), classifiedSpecifier)
          )
    )
    .replaceAll('\\', '/');
  if (/^packages\/prototypes\/[^/]+\/src(?:\/|$)/u.test(resolvedPath)) {
    return { category: 'prototype-internal', resolvedPath };
  }
  if (/^packages\/adapters\/[^/]+\/src(?:\/|$)/u.test(resolvedPath)) {
    return { category: 'adapter-internal', resolvedPath };
  }
  if (/^packages\/modules\/[^/]+\/src(?:\/|$)/u.test(resolvedPath)) {
    return { category: 'module-internal', resolvedPath };
  }
  if (/^packages\/core\/src(?:\/|$)/u.test(resolvedPath)) {
    return { category: 'core-internal', resolvedPath };
  }
  if (/^packages\/runtime\/src(?:\/|$)/u.test(resolvedPath)) {
    return { category: 'runtime-internal', resolvedPath };
  }
}

function inspectBarePackageForGuardedWebsiteImports(
  rootDir,
  canonicalRootDir,
  importingPath,
  specifier,
  websiteAliasConfig,
  cache,
  forcedEntryPath = null
) {
  const classifiedSpecifier = importSpecifierWithoutViteSuffix(specifier);
  if (
    classifiedSpecifier.startsWith('.') ||
    classifiedSpecifier.startsWith('/') ||
    isNodeBuiltinSpecifier(classifiedSpecifier)
  ) {
    return null;
  }
  if (forcedEntryPath !== null) {
    if (cache.has(forcedEntryPath)) return cache.get(forcedEntryPath);
    cache.set(forcedEntryPath, null);
    return inspectBarePackageEntry(
      rootDir,
      canonicalRootDir,
      forcedEntryPath,
      websiteAliasConfig,
      cache
    );
  }
  const require = createRequire(pathToFileURL(importingPath));
  const entryCandidates = new Set();
  try {
    entryCandidates.add(require.resolve(classifiedSpecifier));
  } catch {
    // fall through to import-condition resolution below.
  }
  try {
    // Resolve only; never import or execute package code. Vite's production
    // client conditions include module/browser/production, plus ESM import.
    // Unlike require.resolve options, this API actually selects these conditions
    // and preserves exports key specificity and authored condition order.
    entryCandidates.add(
      fileURLToPath(
        moduleResolve(
          classifiedSpecifier,
          pathToFileURL(importingPath),
          new Set(['browser', 'import', 'module', 'production'])
        )
      )
    );
  } catch {
    // CommonJS resolution above remains the fallback when an import entry is absent.
  }
  const entryPaths = [...entryCandidates];
  if (entryPaths.length === 0) return null;
  if (entryPaths.length > 1) {
    // Multiple export conditions resolve to different files; inspect each
    // candidate so a browser/import entry cannot smuggle a governed layer
    // past the CommonJS condition the require resolver selects.
    for (const candidate of entryPaths) {
      if (cache.has(candidate)) {
        const cached = cache.get(candidate);
        if (cached) return cached;
        continue;
      }
      cache.set(candidate, null);
      const candidateResult = inspectBarePackageEntry(
        rootDir,
        canonicalRootDir,
        candidate,
        websiteAliasConfig,
        cache
      );
      if (candidateResult) return candidateResult;
    }
    return null;
  }
  const entryPath = entryPaths[0];
  if (cache.has(entryPath)) return cache.get(entryPath);
  cache.set(entryPath, null);
  return inspectBarePackageEntry(rootDir, canonicalRootDir, entryPath, websiteAliasConfig, cache);
}

const PACKAGE_SOURCE_PATTERN = /\.(?:[cm]?[jt]sx?|css|less|s[ac]ss|astro|vue|svelte|html?)$/iu;

function inspectBarePackageEntry(rootDir, canonicalRootDir, entryPath, websiteAliasConfig, cache) {
  let packageRoot = path.dirname(entryPath);
  while (path.dirname(packageRoot) !== packageRoot) {
    const manifestPath = path.join(packageRoot, 'package.json');
    if (fs.existsSync(manifestPath)) break;
    packageRoot = path.dirname(packageRoot);
  }
  const manifestPath = path.join(packageRoot, 'package.json');
  if (!fs.existsSync(manifestPath)) return null;
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    return null;
  }
  const dependencyNames = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
  ]);
  // `require.resolve` only selects the CommonJS condition, but Vite bundles
  // the import/browser condition. Enumerate every exports-map target so the
  // scanner cannot miss a governed layer behind an unselected condition.
  const exportTargets = new Set([entryPath]);
  const collectExportTargets = (node) => {
    if (typeof node === 'string') {
      const targetPath = path.resolve(packageRoot, node);
      if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
        exportTargets.add(targetPath);
      }
      return;
    }
    if (node && typeof node === 'object') {
      for (const value of Object.values(node)) collectExportTargets(value);
    }
  };
  collectExportTargets(manifest.exports);
  // Vite's client entry fields are lower precedence than a resolved exports
  // map. Browser replacement objects still describe in-package rewrites.
  // https://vite.dev/config/shared-options#resolve-mainfields
  let unresolvedEntryTarget = null;
  const collectClientTargets = (value) => {
    if (typeof value === 'string') {
      const base = path.resolve(packageRoot, value);
      const candidates = [
        base,
        ...['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'].map(
          (extension) => base + extension
        ),
        ...['index.mjs', 'index.js', 'index.ts', 'index.tsx'].map((file) => path.join(base, file)),
      ];
      const resolved = candidates.find(
        (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()
      );
      if (resolved) exportTargets.add(resolved);
      else unresolvedEntryTarget = value;
    } else if (value && typeof value === 'object') {
      for (const target of Object.values(value)) collectClientTargets(target);
    }
  };
  if (!manifest.exports) {
    for (const field of ['browser', 'module', 'jsnext:main', 'jsnext'])
      collectClientTargets(manifest[field]);
  } else if (manifest.browser && typeof manifest.browser === 'object') {
    collectClientTargets(manifest.browser);
  }
  if (unresolvedEntryTarget !== null) {
    const result = {
      category: 'unresolved-package-entry',
      resolvedPath: path.relative(rootDir, manifestPath).replaceAll('\\', '/'),
      entryTarget: unresolvedEntryTarget,
    };
    cache.set(entryPath, result);
    return result;
  }

  const resolveRelative = (sourcePath, importedSpecifier) => {
    const classified = importSpecifierWithoutViteSuffix(importedSpecifier);
    if (!classified.startsWith('.')) return null;
    const base = path.resolve(path.dirname(sourcePath), classified);
    const variants = [
      base,
      ...[
        '.js',
        '.jsx',
        '.mjs',
        '.cjs',
        '.ts',
        '.tsx',
        '.mts',
        '.cts',
        '.css',
        '.less',
        '.scss',
        '.sass',
      ].map((extension) => `${base}${extension}`),
      ...['index.js', 'index.jsx', 'index.mjs', 'index.cjs', 'index.ts', 'index.tsx'].map((name) =>
        path.join(base, name)
      ),
    ];
    return (
      variants.find((candidate) => {
        const relative = path.relative(packageRoot, candidate);
        return (
          relative !== '' &&
          !relative.startsWith('..') &&
          !path.isAbsolute(relative) &&
          fs.existsSync(candidate) &&
          fs.statSync(candidate).isFile()
        );
      }) ?? null
    );
  };
  // https://nodejs.org/api/packages.html#subpath-imports: imports use package-root
  // targets and exact/pattern keys. Inspect all conditions conservatively.
  const isPackageSelfReference = (specifier) =>
    typeof manifest.name === 'string' &&
    (specifier === manifest.name || specifier.startsWith(`${manifest.name}/`));
  const resolvePackageImports = (specifier, sourcePath, seenMappings = new Set()) => {
    const selfSpecifier = importSpecifierWithoutViteSuffix(specifier);
    const selfReference = isPackageSelfReference(selfSpecifier);
    if (!specifier.startsWith('#') && !selfReference) return [specifier];
    if (seenMappings.has(specifier) || seenMappings.size >= 64) return null;
    seenMappings.add(specifier);
    const exports = manifest.exports;
    const mappings = selfReference
      ? exports &&
        typeof exports === 'object' &&
        Object.keys(exports).some((key) => key.startsWith('.'))
        ? exports
        : { '.': exports }
      : manifest.imports;
    if (!mappings || typeof mappings !== 'object') return null;
    const keySpecifier = selfReference
      ? `.${selfSpecifier.slice(manifest.name.length)}`
      : specifier;
    let mapping = Object.hasOwn(mappings, keySpecifier) ? mappings[keySpecifier] : undefined;
    let substitution = null;
    if (mapping === undefined) {
      const matches = Object.keys(mappings)
        .filter((key) => {
          const parts = key.split('*');
          return (
            parts.length === 2 &&
            keySpecifier.startsWith(parts[0]) &&
            keySpecifier.endsWith(parts[1]) &&
            keySpecifier.length >= parts[0].length + parts[1].length
          );
        })
        .sort(
          (left, right) => right.indexOf('*') - left.indexOf('*') || right.length - left.length
        );
      if (matches.length === 0) return null;
      const key = matches[0];
      const [prefix, suffix] = key.split('*');
      substitution = keySpecifier.slice(prefix.length, keySpecifier.length - suffix.length);
      mapping = mappings[key];
    }
    const targets = [];
    const visit = (node) => {
      if (typeof node === 'string')
        targets.push(substitution === null ? node : node.replaceAll('*', () => substitution));
      else if (node && typeof node === 'object') Object.values(node).forEach(visit);
    };
    visit(mapping);
    if (targets.length === 0) return null;
    const resolved = [];
    for (const target of targets) {
      if (target.startsWith('./')) {
        const absolute = path.resolve(packageRoot, target);
        const relative = path.relative(
          canonicalImportTarget(packageRoot),
          canonicalImportTarget(absolute)
        );
        if (
          relative.startsWith('..') ||
          path.isAbsolute(relative) ||
          !fs.existsSync(absolute) ||
          !fs.statSync(absolute).isFile()
        )
          return null;
        resolved.push(
          relativeImportSpecifier(path.relative(rootDir, sourcePath), rootDir, absolute)
        );
      } else if (selfReference) {
        // Package exports must stay package-relative; never reinterpret a
        // malformed self export as another package or reset the traversal cap.
        return null;
      } else if (isPackageSelfReference(importSpecifierWithoutViteSuffix(target))) {
        const selfTargets = resolvePackageImports(target, sourcePath, new Set(seenMappings));
        if (!selfTargets) return null;
        resolved.push(...selfTargets);
      } else if (isNodeBuiltinSpecifier(target)) {
        resolved.push(target);
      } else if (
        !target.startsWith('#') &&
        !target.startsWith('/') &&
        !target.startsWith('.') &&
        !/^[a-z][a-z0-9+.-]*:/iu.test(target)
      ) {
        // Direct governed layers are classified below even when fixtures do not
        // install them. Other mapped packages must actually resolve.
        if (
          !guardedWebsiteImport(
            rootDir,
            canonicalRootDir,
            path.relative(rootDir, sourcePath),
            target,
            websiteAliasConfig
          )
        ) {
          try {
            createRequire(pathToFileURL(sourcePath)).resolve(target);
          } catch {
            return null;
          }
        }
        dependencyNames.add(
          target.startsWith('@') ? target.split('/').slice(0, 2).join('/') : target.split('/')[0]
        );
        resolved.push(target);
      } else return null;
    }
    return resolved;
  };
  const pending = [...exportTargets];
  const visited = new Set();
  const globBudget = { entries: 0, patterns: 0 };
  while (pending.length > 0 && visited.size < 500) {
    const sourcePath = pending.pop();
    if (visited.has(sourcePath) || !PACKAGE_SOURCE_PATTERN.test(sourcePath)) continue;
    visited.add(sourcePath);
    try {
      for (const patterns of viteGlobPatternGroupsForWebsiteSource(sourcePath)) {
        for (const target of viteGlobTargets(
          rootDir,
          path.relative(rootDir, sourcePath),
          patterns,
          {
            aliasConfig: websiteAliasConfig,
            viteRoot: path.join(rootDir, 'apps', 'www'),
            packageRoot,
            globBudget,
          }
        )) {
          const relative = path.relative(
            canonicalImportTarget(packageRoot),
            canonicalImportTarget(target.absolutePath)
          );
          if (relative.startsWith('..') || path.isAbsolute(relative)) {
            const result = {
              category: 'unresolved-package-entry',
              resolvedPath: path.relative(rootDir, sourcePath).replaceAll('\\', '/'),
              entryTarget: `glob:${target.authoredPattern}`,
            };
            cache.set(entryPath, result);
            return result;
          }
          if (!visited.has(target.absolutePath)) pending.push(target.absolutePath);
        }
      }
    } catch (error) {
      const result = {
        category: 'unresolved-package-entry',
        resolvedPath: path.relative(rootDir, sourcePath).replaceAll('\\', '/'),
        entryTarget: `glob:${error.message}`,
      };
      cache.set(entryPath, result);
      return result;
    }
    const dependencySpecifiers = [];
    for (const originalSpecifier of moduleSpecifiersForWebsiteSource(sourcePath)) {
      const mapped = resolvePackageImports(originalSpecifier, sourcePath);
      if (mapped === null) {
        const result = {
          category: 'unresolved-package-entry',
          resolvedPath: path.relative(rootDir, manifestPath).replaceAll('\\', '/'),
          entryTarget: originalSpecifier,
        };
        cache.set(entryPath, result);
        return result;
      }
      dependencySpecifiers.push(...mapped);
    }
    for (const dependencySpecifier of dependencySpecifiers) {
      const guarded = guardedWebsiteImport(
        rootDir,
        canonicalRootDir,
        path.relative(rootDir, sourcePath).replaceAll('\\', '/'),
        dependencySpecifier,
        websiteAliasConfig
      );
      if (
        guarded &&
        /^(?:adapter|prototype|module|core|runtime|hooks)-(?:package|internal)$/u.test(
          guarded.category
        )
      ) {
        const result = {
          category: `transitive-${guarded.category}`,
          resolvedPath: path.relative(rootDir, sourcePath).replaceAll('\\', '/'),
        };
        cache.set(entryPath, result);
        return result;
      }
      const target = resolveRelative(sourcePath, dependencySpecifier);
      if (target) {
        if (!visited.has(target)) pending.push(target);
        continue;
      }
      const nestedSpecifier = importSpecifierWithoutViteSuffix(dependencySpecifier);
      const nestedPackageName = nestedSpecifier.startsWith('@')
        ? nestedSpecifier.split('/').slice(0, 2).join('/')
        : nestedSpecifier.split('/')[0];
      if (dependencyNames.has(nestedPackageName) && !isNodeBuiltinSpecifier(nestedSpecifier)) {
        const nestedImport = inspectBarePackageForGuardedWebsiteImports(
          rootDir,
          canonicalRootDir,
          sourcePath,
          nestedSpecifier,
          websiteAliasConfig,
          cache
        );
        if (nestedImport) {
          cache.set(entryPath, nestedImport);
          return nestedImport;
        }
      }
    }
  }
  if (
    pending.some((candidate) => !visited.has(candidate) && PACKAGE_SOURCE_PATTERN.test(candidate))
  ) {
    const result = {
      category: 'incomplete-package-traversal',
      resolvedPath: path.relative(rootDir, packageRoot).replaceAll('\\', '/'),
    };
    cache.set(entryPath, result);
    return result;
  }
  return null;
}
function guardedHarnessImport(rootDir, canonicalRootDir, sourcePath, specifier) {
  if (specifier === DYNAMIC_STYLESHEET_REL_SPECIFIER)
    return { category: 'dynamic-stylesheet-relation', resolvedPath: null };
  if (specifier === DYNAMIC_STYLESHEET_LINK_SPECIFIER)
    return { category: 'dynamic-stylesheet-link', resolvedPath: null };
  if (
    specifier.startsWith(EXTERNAL_STYLESHEET_ELEMENT_SPECIFIER_PREFIX) &&
    specifier.endsWith('>')
  ) {
    return {
      category: 'external-stylesheet',
      specifier: specifier.slice(EXTERNAL_STYLESHEET_ELEMENT_SPECIFIER_PREFIX.length, -1),
      resolvedPath: null,
    };
  }
  const viteIgnoredBoundary = viteIgnoredDynamicImportBoundary(specifier);
  if (viteIgnoredBoundary !== null) {
    return {
      category: 'vite-ignored-dynamic-import',
      boundary: viteIgnoredBoundary,
      resolvedPath: null,
    };
  }
  const externalWorkerScript = externalImportScriptsTarget(specifier);
  if (externalWorkerScript !== null) {
    return {
      category: 'external-executable-script',
      specifier: externalWorkerScript,
      resolvedPath: null,
    };
  }
  const externalWorkerEntry = externalWorkerEntryTarget(specifier);
  if (externalWorkerEntry !== null) {
    return {
      category: 'external-executable-script',
      specifier: externalWorkerEntry,
      resolvedPath: null,
    };
  }
  const externalScriptElement = externalScriptElementTarget(specifier);
  if (externalScriptElement !== null) {
    return {
      category: 'external-script-element',
      specifier: externalScriptElement,
      resolvedPath: null,
    };
  }
  if (specifier === UNVERIFIED_MARKUP_HANDLER_SPECIFIER)
    return { category: 'unverified-markup-handler', resolvedPath: null };
  if (specifier === UNVERIFIED_RUNTIME_COMPILATION_SPECIFIER)
    return { category: 'unverified-runtime-compilation', resolvedPath: null };
  if (specifier === DYNAMIC_EXECUTABLE_SCRIPT_SPECIFIER) {
    return { category: 'dynamic-script-element', resolvedPath: null };
  }
  if (specifier === UNRESOLVED_WORKER_ENTRY_SPECIFIER) {
    return { category: 'unresolved-worker-entry', resolvedPath: null };
  }
  if (specifier === UNRESOLVED_IMPORTSCRIPTS_SPECIFIER) {
    return { category: 'unresolved-worker-script', resolvedPath: null };
  }
  const classifiedSpecifier = importSpecifierWithoutViteSuffix(specifier);
  if (
    /^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(classifiedSpecifier) &&
    !isReviewedBuildTimeModuleSpecifier(sourcePath, classifiedSpecifier)
  ) {
    return {
      category: 'external-executable-script',
      specifier: classifiedSpecifier,
      resolvedPath: null,
    };
  }
  if (classifiedSpecifier === UNRESOLVED_DYNAMIC_IMPORT_SPECIFIER) {
    return { category: 'unresolved-dynamic-import', resolvedPath: null };
  }
  if (classifiedSpecifier === UNRESOLVED_DYNAMIC_REQUIRE_SPECIFIER) {
    return { category: 'unresolved-dynamic-require', resolvedPath: null };
  }
  if (/^@proto\.ui\/[a-z0-9-]+(?:\/|$)/u.test(classifiedSpecifier)) {
    return { category: 'proto-ui-package', resolvedPath: null };
  }
  if (!classifiedSpecifier.startsWith('.')) {
    if (
      isNodeBuiltinSpecifier(classifiedSpecifier) ||
      isReviewedHarnessThirdPartyPackage(sourcePath, specifier)
    ) {
      return null;
    }
    return { category: 'forbidden-third-party-package', resolvedPath: null };
  }
  const resolvedPath = path
    .relative(
      canonicalRootDir,
      canonicalImportTarget(path.resolve(rootDir, path.dirname(sourcePath), classifiedSpecifier))
    )
    .replaceAll('\\', '/');
  if (/^packages\/.+\/src(?:\/|$)/u.test(resolvedPath)) {
    return { category: 'package-internal', resolvedPath };
  }
  return null;
}

const REVIEWED_PROTOTYPE_PACKAGE_DEPENDENCY_CATEGORIES = new Set([
  'prototype-internal',
  'prototype-package',
  'core-package',
  'hooks-package',
]);

function isReviewedPrototypePackageSource(sourcePath) {
  return /^packages\/prototypes\/[^/]+\/src(?:\/|$)/u.test(sourcePath);
}

function isReviewedPrototypePackageDependency(sourcePath, guardedImport) {
  return (
    isReviewedPrototypePackageSource(sourcePath) &&
    REVIEWED_PROTOTYPE_PACKAGE_DEPENDENCY_CATEGORIES.has(guardedImport.category)
  );
}

function websiteRawImportIsAllowed(sourcePath, specifier, guardedImport) {
  if (isReviewedPrototypePackageDependency(sourcePath, guardedImport)) return true;
  const allowance = WEBSITE_RAW_IMPORT_ALLOWLIST[sourcePath];
  if (!allowance) return false;
  if (
    guardedImport.category === 'vite-ignored-dynamic-import' &&
    allowance.viteIgnoredDynamicImports?.includes(guardedImport.boundary)
  ) {
    return true;
  }
  if (allowance.specifiers?.includes(specifier)) return true;
  if (
    allowance.specifierPrefixes?.some(
      (prefix) => specifier === prefix || specifier.startsWith(`${prefix}/`)
    )
  ) {
    return true;
  }
  if (allowance.categories?.includes(guardedImport.category)) return true;
  return allowance.resolvedPaths?.includes(guardedImport.resolvedPath) ?? false;
}

function isTestNamedSource(absolutePath) {
  return /\.(?:browser\.)?(?:test|spec)\.[cm]?[jt]sx?$/iu.test(absolutePath);
}

// Mirror the checked-in Website proto-ui-source resolver without evaluating
// candidate configuration. The full config fingerprint fails closed for any
// unreviewed resolver/plugin shape; updates require source review and parity tests.
// Reviewed main contributions change CSS layer order and accepted family
// sidebar entries; resolver functions and plugin shape stay intact. Parity/mutation tests retain
// fail-closed behavior for every other configuration change.
const PROMOTION_RESOLVER_CONFIG_SHA256 =
  '856cc74b95d480cbdb0f1253823f306f41a7101ee41815cd68269786c839fc0d';
export function promotionBarePackageTargets(root, specifier, metadata) {
  const unverified = () =>
    new Error(`promotion package closure for ${specifier} remains unverified`);
  const configPath = path.join(root, 'apps/www/astro.config.mjs');
  if (
    !fs.existsSync(configPath) ||
    !fs.lstatSync(configPath).isFile() ||
    path.relative(root, fs.realpathSync(configPath)).startsWith('..') ||
    createHash('sha256').update(fs.readFileSync(configPath)).digest('hex') !==
      PROMOTION_RESOLVER_CONFIG_SHA256
  )
    throw new Error(
      'promotion package resolver configuration is unrecognized; closure remains unverified'
    );
  metadata.add(configPath);
  const assertRepositoryFile = (target) => {
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) throw unverified();
    const canonical = fs.realpathSync(target);
    const relative = path.relative(root, canonical);
    if (
      relative.startsWith('..') ||
      path.isAbsolute(relative) ||
      spawnSync('git', ['--literal-pathspecs', 'ls-files', '--error-unmatch', '--', relative], {
        cwd: root,
        stdio: 'ignore',
      }).status !== 0
    )
      throw unverified();
    return canonical;
  };
  if (specifier.startsWith('@proto.ui/')) {
    const [segment, ...rest] = specifier.slice('@proto.ui/'.length).split('/');
    if (
      !/^[a-z0-9-]+$/u.test(segment) ||
      rest.some((part) => !part || part === '.' || part === '..')
    )
      throw unverified();
    const directory = segment.startsWith('module-')
      ? path.join('modules', segment.slice(7))
      : segment.startsWith('adapter-')
        ? path.join('adapters', segment.slice(8))
        : segment.startsWith('prototypes-')
          ? path.join('prototypes', segment.slice(11))
          : segment;
    const packageRoot = path.join(root, 'packages', directory);
    const manifestPath = assertRepositoryFile(path.join(packageRoot, 'package.json'));
    metadata.add(manifestPath);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const subpath = rest.length ? `./${rest.join('/')}` : '.';
    for (const [key, value] of Object.entries(manifest.exports ?? {})) {
      const match = key.includes('*')
        ? subpath.match(
            new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('\\*', '(.+)')}$`)
          )
        : key === subpath
          ? []
          : null;
      if (!match) continue;
      const target =
        typeof value === 'string' ? value : (value?.import ?? value?.default ?? value?.types);
      if (typeof target !== 'string') throw unverified();
      const sourceTarget = target
        .replace('*', match[1] ?? '')
        .replace('./dist/', './src/')
        .replace(/\.d\.ts$/u, '.ts')
        .replace(/\.js$/u, '.ts');
      const candidate = assertRepositoryFile(path.resolve(packageRoot, sourceTarget));
      const relative = path.relative(fs.realpathSync(packageRoot), candidate);
      if (relative.startsWith('..') || path.isAbsolute(relative)) throw unverified();
      return [candidate];
    }
    throw unverified();
  }
  // Installed external packages are not historical Git source evidence. Do not
  // silently equate today's node_modules bytes or lock metadata with a capture.
  throw unverified();
}

function reachableSourcePaths(
  candidates,
  aliasConfig = { aliases: new Map(), unsupported: new Set() },
  root = process.cwd(),
  { promotionPackages = false } = {}
) {
  const canonicalRoot = fs.realpathSync(root);
  const packageMetadata = new Set();
  const sourceGlobBudget = { entries: 0, patterns: 0 };
  const candidateByPath = new Map(
    candidates.map((candidate) => [path.resolve(candidate), candidate])
  );
  const resolveLocalImport = (sourcePath, specifier, viteRoot) => {
    const classifiedSpecifier = importSpecifierWithoutViteSuffix(specifier);
    const aliasMatch = configuredAliasMatch(classifiedSpecifier, aliasConfig);
    const rootRelative = /^\/(?!\/)/u.test(classifiedSpecifier);
    if (!classifiedSpecifier.startsWith('.') && !aliasMatch && !rootRelative) {
      if (
        !promotionPackages ||
        isReviewedBuildTimeModuleSpecifier(
          path.relative(root, sourcePath).replaceAll('\\', '/'),
          classifiedSpecifier
        )
      )
        return null;
      return promotionBarePackageTargets(root, classifiedSpecifier, packageMetadata);
    }
    const bases = aliasMatch
      ? [path.resolve(aliasMatch.replacement, aliasMatch.suffix)]
      : rootRelative
        ? [
            path.resolve(viteRoot, `.${classifiedSpecifier}`),
            path.resolve(viteRoot, 'public', `.${classifiedSpecifier}`),
          ]
        : [path.resolve(path.dirname(sourcePath), classifiedSpecifier)];
    if (
      rootRelative &&
      bases.some((base) => {
        const relative = path.relative(root, base);
        return relative.startsWith('..') || path.isAbsolute(relative);
      })
    )
      throw new Error('Vite-root import escapes the repository');
    const variants = bases.flatMap((base) => [
      base,
      ...[
        '.astro',
        '.css',
        '.less',
        '.scss',
        '.sass',
        '.vue',
        '.svelte',
        '.js',
        '.jsx',
        '.mjs',
        '.cjs',
        '.ts',
        '.tsx',
        '.mts',
        '.cts',
      ].map((extension) => `${base}${extension}`),
      ...[
        'index.js',
        'index.jsx',
        'index.mjs',
        'index.cjs',
        'index.ts',
        'index.tsx',
        'index.mts',
        'index.cts',
      ].map((indexName) => path.join(base, indexName)),
    ]);
    return (
      variants
        .map((candidate) => candidateByPath.get(candidate) ?? candidate)
        .filter((candidate) => {
          const canonical = fs.existsSync(candidate)
            ? fs.realpathSync(candidate)
            : canonicalImportTarget(candidate);
          const relative = path.relative(canonicalRoot, canonical);
          if (relative.startsWith('..') || path.isAbsolute(relative))
            throw new Error(
              `${rootRelative ? 'Vite-root' : 'Source'} import resolves outside the repository`
            );
          return fs.existsSync(candidate) && fs.statSync(candidate).isFile();
        }) ?? null
    );
  };
  const reachable = new Set(candidates.filter((candidate) => !isTestNamedSource(candidate)));
  const pending = [...reachable].map((sourcePath) => ({
    sourcePath,
    viteRoot: path
      .relative(root, sourcePath)
      .replaceAll('\\', '/')
      .startsWith('apps/agent-harness/')
      ? path.join(root, 'apps', 'agent-harness')
      : path.join(root, 'apps', 'www'),
  }));
  const visitedContexts = new Set();
  while (pending.length > 0) {
    const { sourcePath, viteRoot } = pending.pop();
    const sourceRelative = path.relative(canonicalRoot, fs.realpathSync(sourcePath));
    if (sourceRelative.startsWith('..') || path.isAbsolute(sourceRelative))
      throw new Error('Source import resolves outside the repository');
    const contextKey = `${sourcePath}\0${viteRoot}`;
    if (visitedContexts.has(contextKey)) continue;
    if (promotionPackages && visitedContexts.size >= 500)
      throw new Error('promotion package closure reached the 500-module bound; remains unverified');
    visitedContexts.add(contextKey);
    if (promotionPackages) {
      for (const url of promotionStyleResourceUrls(sourcePath)) {
        let resourcePath;
        try {
          resourcePath = decodeURIComponent(url.split(/[?#]/u, 1)[0]);
        } catch {
          throw new Error(`promotion CSS resource URL ${url} remains unverified`);
        }
        if (!resourcePath || resourcePath.includes('\0') || resourcePath.includes('\\'))
          throw new Error(`promotion CSS resource URL ${url} remains unverified`);
        if (resourcePath.startsWith('/')) {
          const relative = path.relative(viteRoot, path.resolve(viteRoot, `.${resourcePath}`));
          if (relative.startsWith('..') || path.isAbsolute(relative))
            throw new Error(
              'promotion CSS resource URL escapes its application root; remains unverified'
            );
        }
        // CSS URLs without ./ are stylesheet-relative, not bare package imports.
        const bases = resourcePath.startsWith('/')
          ? [
              path.resolve(viteRoot, 'public', `.${resourcePath}`),
              path.resolve(viteRoot, `.${resourcePath}`),
            ]
          : [path.resolve(path.dirname(sourcePath), resourcePath)];
        const resource = bases.find(
          (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()
        );
        if (!resource)
          throw new Error(`promotion CSS resource URL ${url} is unresolved; remains unverified`);
        const relative = path.relative(canonicalRoot, fs.realpathSync(resource));
        if (relative.startsWith('..') || path.isAbsolute(relative))
          throw new Error(
            'promotion CSS resource resolves outside the repository; remains unverified'
          );
        // Comparing only today's canonical target cannot prove which bytes a
        // historical symlink selected. Reject links in any resource component.
        for (let component = resource; component !== path.resolve(root); ) {
          if (fs.lstatSync(component).isSymbolicLink())
            throw new Error('promotion CSS resource symlink remains unverified');
          const parent = path.dirname(component);
          if (parent === component) break;
          component = parent;
        }
        // Hash resource bytes only. Fonts/images, even with code-like bytes or
        // extensions, do not become executable module traversal roots.
        reachable.add(resource);
      }
    }
    for (const specifier of moduleSpecifiersForWebsiteSource(sourcePath)) {
      const targets = resolveLocalImport(sourcePath, specifier, viteRoot);
      for (const target of targets ?? []) {
        reachable.add(target);
        pending.push({ sourcePath: target, viteRoot });
      }
    }
    const relativeSourcePath = path.relative(root, sourcePath).replaceAll('\\', '/');
    for (const patterns of viteGlobPatternGroupsForWebsiteSource(sourcePath)) {
      for (const target of viteGlobTargets(root, relativeSourcePath, patterns, {
        aliasConfig,
        viteRoot,
        packageRoot: root,
        globBudget: sourceGlobBudget,
      })) {
        if (target.absolutePath) {
          reachable.add(target.absolutePath);
          pending.push({ sourcePath: target.absolutePath, viteRoot });
        }
      }
    }
  }
  for (const metadataPath of packageMetadata) reachable.add(metadataPath);
  if (promotionPackages) {
    const config = path.join(root, 'apps/www/astro.config.mjs');
    if (fs.existsSync(config)) reachable.add(config);
  }
  return reachable;
}

// Existing local static browser-default baseline, not a general iframe allowance.
const REVIEWED_STYLE_BASELINE_EMBED_SHA256 =
  '6b4aab88932f3e54de9a87ff75e022630b2b1198511a8cadbc05aa1e61cf5c95';
function unreviewedWebsiteEmbeds(content, sourcePath) {
  const markup = markupSourceForJsxFallback(
    content.replace(/<!--[\s\S]*?-->/gu, '').replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/giu, ''),
    sourcePath
  );
  if (markup === null) return [];
  const pattern = /\.html?$/iu.test(sourcePath)
    ? /^<(?:iframe|object|embed|webview)\b/iu
    : /^<(?:iframe|object|embed|webview)\b/u;
  const embeds = jsxOpeningTagCandidates(markup).filter((tag) => pattern.test(tag));
  return embeds.filter(
    (tag) =>
      sourcePath !== 'apps/www/src/pages/en/test/style-isolation.astro' ||
      embeds.length !== 1 ||
      createHash('sha256').update(tag).digest('hex') !== REVIEWED_STYLE_BASELINE_EMBED_SHA256
  );
}

function discoverWebsiteRawImports(rootDir) {
  const canonicalRootDir = canonicalImportTarget(path.resolve(rootDir));
  const websiteRoot = path.join(rootDir, 'apps', 'www');
  const sourceRoot = path.join(websiteRoot, 'src');
  const publicRoot = path.join(websiteRoot, 'public');
  const configPath = path.join(websiteRoot, 'astro.config.mjs');
  const allCandidates = walkFiles(sourceRoot)
    .concat(walkFiles(publicRoot))
    .concat(fs.existsSync(configPath) ? [configPath] : [])
    .filter(
      (absolutePath) =>
        /\.(?:html?|astro|mdx?|[cm]?[jt]sx?|css|less|s[ac]ss|vue|svelte)$/i.test(absolutePath) ||
        (absolutePath.startsWith(`${publicRoot}${path.sep}`) && /\.svg$/i.test(absolutePath))
    );
  const websiteAliasConfig = configuredWebsiteSourceAliases(rootDir);
  const reachable = reachableSourcePaths(allCandidates, websiteAliasConfig, rootDir);
  const candidates = [...new Set([...allCandidates, ...reachable])].filter(
    (absolutePath) => !isTestNamedSource(absolutePath) || reachable.has(absolutePath)
  );
  const rawImports = astroHeadImportMapIssues(rootDir);
  const bareInspectionCache = new Map();
  for (const absolutePath of candidates) {
    const sourcePath = path.relative(rootDir, absolutePath).replaceAll('\\', '/');
    if (/\.svg$/i.test(absolutePath)) {
      for (const reason of publicSvgSourceIssues(fs.readFileSync(absolutePath, 'utf8'))) {
        rawImports.push({
          sourcePath,
          reason,
          category: 'unverified-public-svg',
          resolvedPath: null,
        });
      }
      continue;
    }
    for (const specifier of externalStylesheetSpecifiersForWebsiteSource(absolutePath)) {
      rawImports.push({
        sourcePath,
        specifier,
        category:
          specifier === DYNAMIC_STYLESHEET_REL_SPECIFIER
            ? 'dynamic-stylesheet-relation'
            : specifier === DYNAMIC_STYLESHEET_LINK_SPECIFIER
              ? 'dynamic-stylesheet-link'
              : 'external-stylesheet',
        resolvedPath: null,
      });
    }
    if (/\.(?:html?|astro|mdx?|vue|svelte)$/i.test(absolutePath)) {
      const content = fs.readFileSync(absolutePath, 'utf8');
      const markup = /\.mdx?$/i.test(absolutePath) ? stripMarkdownCode(content) : content;
      for (const _embed of unreviewedWebsiteEmbeds(markup, sourcePath))
        rawImports.push({
          sourcePath,
          specifier: UNREVIEWED_WEBSITE_EMBED_SPECIFIER,
          category: 'unreviewed-embed',
          resolvedPath: null,
        });
      for (const specifier of documentBaseSpecifiers(markup)) {
        rawImports.push({
          sourcePath,
          specifier,
          category:
            specifier === DYNAMIC_DOCUMENT_BASE_SPECIFIER
              ? 'dynamic-document-base'
              : 'external-document-base',
          resolvedPath: null,
        });
      }
      if (containsProductionImportMap(markup)) {
        rawImports.push({
          sourcePath,
          specifier: '<production import map>',
          category: 'production-import-map',
          resolvedPath: null,
        });
      }
      for (const specifier of externalScriptModuleSpecifiers(markup)) {
        if (specifier === DYNAMIC_EXECUTABLE_SCRIPT_TYPE_SPECIFIER) {
          rawImports.push({
            sourcePath,
            specifier,
            category: 'dynamic-executable-script-type',
            resolvedPath: null,
          });
          continue;
        }
        if (specifier === DYNAMIC_EXECUTABLE_SCRIPT_SPECIFIER) {
          rawImports.push({
            sourcePath,
            specifier,
            category: 'dynamic-executable-script',
            resolvedPath: null,
          });
          continue;
        }
        if (isExternalExecutableScriptSpecifier(specifier)) {
          rawImports.push({
            sourcePath,
            specifier,
            category: 'external-executable-script',
            resolvedPath: null,
          });
        }
      }
    }
    for (const specifier of moduleSpecifiersForWebsiteSource(absolutePath)) {
      const guardedImport = guardedWebsiteImport(
        rootDir,
        canonicalRootDir,
        sourcePath,
        specifier,
        websiteAliasConfig
      );
      if (guardedImport) rawImports.push({ sourcePath, specifier, ...guardedImport });
      else {
        const transitiveGuardedImport = inspectBarePackageForGuardedWebsiteImports(
          rootDir,
          canonicalRootDir,
          absolutePath,
          specifier,
          websiteAliasConfig,
          bareInspectionCache
        );
        if (transitiveGuardedImport) {
          rawImports.push({ sourcePath, specifier, ...transitiveGuardedImport });
        }
      }
    }
    for (const patterns of viteGlobPatternGroupsForWebsiteSource(absolutePath)) {
      for (const target of viteGlobTargets(rootDir, sourcePath, patterns, {
        aliasConfig: websiteAliasConfig,
        viteRoot: websiteRoot,
      })) {
        const guardedImport = guardedWebsiteImport(
          rootDir,
          canonicalRootDir,
          sourcePath,
          relativeImportSpecifier(sourcePath, rootDir, target.absolutePath),
          websiteAliasConfig
        );
        if (guardedImport) {
          rawImports.push({
            sourcePath,
            specifier: target.authoredPattern,
            ...guardedImport,
          });
        }
      }
    }
  }
  return rawImports;
}

function validateWebsiteRawImports(rootDir, relativePath, issues) {
  for (const rawImport of discoverWebsiteRawImports(rootDir)) {
    if (rawImport.category === 'unverified-public-svg') {
      issues.push(
        `${relativePath}: public SVG \`${rawImport.sourcePath}\` contains ${rawImport.reason}; active document behavior remains unverified and is not admitted by a Source-scan binding`
      );
      continue;
    }
    if (rawImport.category === 'unverified-markup-handler') {
      issues.push(
        `${relativePath}: unverified markup event handler in \`${rawImport.sourcePath}\` requires a statically readable literal body without an unreviewed executable resource entry`
      );
      continue;
    }
    if (rawImport.category === 'unverified-runtime-compilation') {
      issues.push(
        `${relativePath}: runtime code compilation in \`${rawImport.sourcePath}\` is unverified; recognized eval/Function entry points require an explicit reviewed admission`
      );
      continue;
    }
    if (rawImport.category === 'unreviewed-embed') {
      issues.push(
        `${relativePath}: unreviewed executable embed in \`${rawImport.sourcePath}\` is not admitted for Website consumer-wall review`
      );
      continue;
    }
    if (rawImport.category === 'unreviewed-config-import-map') {
      issues.push(
        `${relativePath}: import map / head script in \`${rawImport.sourcePath}\` is unverified: ${rawImport.reason}`
      );
      continue;
    }

    if (rawImport.category === 'incomplete-package-traversal') {
      issues.push(
        `${relativePath}: package traversal for \`${rawImport.specifier}\` in \`${rawImport.sourcePath}\` reached the 500-module bound; its closure remains unverified`
      );
      continue;
    }
    if (rawImport.category === 'unresolved-package-entry') {
      issues.push(
        `${relativePath}: package entry target \`${rawImport.entryTarget}\` for \`${rawImport.specifier}\` in \`${rawImport.sourcePath}\` is unresolved; its browser closure remains unverified`
      );
      continue;
    }

    if (rawImport.category === 'production-import-map') {
      issues.push(
        `${relativePath}: production import map or unverified script type in \`${rawImport.sourcePath}\` is not reviewed`
      );
      continue;
    }
    if (rawImport.category === 'external-document-base') {
      issues.push(
        `${relativePath}: external document base href \`${rawImport.specifier}\` in \`${rawImport.sourcePath}\` is not reviewed`
      );
      continue;
    }
    if (rawImport.category === 'dynamic-document-base') {
      issues.push(
        `${relativePath}: dynamic document base href in \`${rawImport.sourcePath}\` must be statically bounded for Website consumer-wall review`
      );
      continue;
    }
    if (rawImport.category === 'external-stylesheet') {
      if (websiteRawImportIsAllowed(rawImport.sourcePath, rawImport.specifier, rawImport)) continue;
      issues.push(
        `${relativePath}: external stylesheet \`${rawImport.specifier}\` in \`${rawImport.sourcePath}\` is not reviewed`
      );
      continue;
    }
    if (rawImport.category === 'dynamic-stylesheet-link') {
      issues.push(
        `${relativePath}: dynamic stylesheet source in \`${rawImport.sourcePath}\` must be static for consumer-wall review`
      );
      continue;
    }
    if (rawImport.category === 'dynamic-stylesheet-relation') {
      issues.push(
        `${relativePath}: dynamic stylesheet relation in \`${rawImport.sourcePath}\` must be statically bounded for consumer-wall review`
      );
      continue;
    }
    if (rawImport.category === 'external-executable-script') {
      issues.push(
        `${relativePath}: external executable script \`${rawImport.specifier}\` in \`${rawImport.sourcePath}\` is not reviewed`
      );
      continue;
    }
    if (rawImport.category === 'dynamic-executable-script-type') {
      issues.push(
        `${relativePath}: dynamic executable script type in \`${rawImport.sourcePath}\` must be statically bounded for Website consumer-wall review`
      );
      continue;
    }
    if (rawImport.category === 'dynamic-executable-script') {
      issues.push(
        `${relativePath}: dynamic executable script source in \`${rawImport.sourcePath}\` must be static for consumer-wall review`
      );
      continue;
    }
    if (rawImport.category === 'vite-ignored-dynamic-import') {
      if (websiteRawImportIsAllowed(rawImport.sourcePath, rawImport.specifier, rawImport)) continue;
      issues.push(
        `${relativePath}: @vite-ignore dynamic import in \`${rawImport.sourcePath}\` is not reviewed against an exact URL boundary`
      );
      continue;
    }
    if (rawImport.category === 'unresolved-dynamic-import') {
      issues.push(
        `${relativePath}: unresolved dynamic import in \`${rawImport.sourcePath}\` must be statically bounded for consumer-wall review`
      );
      continue;
    }
    if (rawImport.category === 'unresolved-dynamic-require') {
      issues.push(
        `${relativePath}: unresolved dynamic require in \`${rawImport.sourcePath}\` must be statically bounded for consumer-wall review`
      );
      continue;
    }
    if (rawImport.category === 'unresolved-worker-entry') {
      issues.push(
        `${relativePath}: unresolved Worker/SharedWorker entry in \`${rawImport.sourcePath}\` must be statically bounded for Website consumer-wall review`
      );
      continue;
    }
    if (rawImport.category === 'unresolved-worker-script') {
      issues.push(
        `${relativePath}: unresolved importScripts target in \`${rawImport.sourcePath}\` must be statically bounded for Website consumer-wall review`
      );
      continue;
    }
    if (websiteRawImportIsAllowed(rawImport.sourcePath, rawImport.specifier, rawImport)) continue;
    issues.push(
      `${relativePath}: raw Proto UI import \`${rawImport.specifier}\` in \`${rawImport.sourcePath}\` escapes the website consumer-wall allowlist${rawImport.category?.startsWith('transitive-') ? ` (found ${rawImport.category} in \`${rawImport.resolvedPath}\`)` : ''}`
    );
  }
}

function discoverHarnessRawImports(rootDir) {
  const canonicalRootDir = canonicalImportTarget(path.resolve(rootDir));
  const { harnessRoot, candidates } = harnessProductionSourceSet(rootDir);
  const rawImports = [];
  for (const absolutePath of candidates) {
    const sourcePath = path.relative(rootDir, absolutePath).replaceAll('\\', '/');
    if (/\.html?$/i.test(absolutePath)) {
      const content = fs.readFileSync(absolutePath, 'utf8').replace(/<!--[\s\S]*?-->/gu, '');
      const markup = markupSourceForJsxFallback(content, absolutePath);
      if (
        jsxOpeningTagCandidates(markup).some((tag) =>
          /^<(?:iframe|object|embed|webview)\b/iu.test(tag)
        )
      )
        rawImports.push({
          sourcePath,
          specifier: '<unreviewed Harness preview>',
          category: 'unreviewed-preview',
          resolvedPath: null,
        });
      if (containsProductionImportMap(content))
        rawImports.push({
          sourcePath,
          specifier: '<production import map>',
          category: 'production-import-map',
          resolvedPath: null,
        });
      for (const specifier of documentBaseSpecifiers(content))
        rawImports.push({
          sourcePath,
          specifier,
          category:
            specifier === DYNAMIC_DOCUMENT_BASE_SPECIFIER
              ? 'dynamic-document-base'
              : 'external-document-base',
          resolvedPath: null,
        });
    }
    for (const specifier of externalStylesheetSpecifiersForWebsiteSource(absolutePath)) {
      rawImports.push({
        sourcePath,
        specifier,
        category:
          specifier === DYNAMIC_STYLESHEET_REL_SPECIFIER
            ? 'dynamic-stylesheet-relation'
            : specifier === DYNAMIC_STYLESHEET_LINK_SPECIFIER
              ? 'dynamic-stylesheet-link'
              : 'external-stylesheet',
        resolvedPath: null,
      });
    }
    for (let specifier of moduleSpecifiersForWebsiteSource(absolutePath, {
      harnessPreviewBoundary: true,
    })) {
      if (specifier === '<unreviewed Harness preview>') {
        rawImports.push({
          sourcePath,
          specifier,
          category: 'unreviewed-preview',
          resolvedPath: null,
        });
        continue;
      }
      if (/\.html?$/i.test(absolutePath) && /^\/(?!\/)/u.test(specifier)) {
        const localPath = [
          path.join(harnessRoot, specifier),
          path.join(harnessRoot, 'public', specifier),
        ].find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
        if (localPath) specifier = relativeImportSpecifier(sourcePath, rootDir, localPath);
      }
      const guardedImport = guardedHarnessImport(rootDir, canonicalRootDir, sourcePath, specifier);
      if (guardedImport) rawImports.push({ sourcePath, specifier, ...guardedImport });
    }
    for (const patterns of viteGlobPatternGroupsForWebsiteSource(absolutePath)) {
      for (const target of viteGlobTargets(rootDir, sourcePath, patterns, {
        viteRoot: harnessRoot,
      })) {
        const guardedImport = guardedHarnessImport(
          rootDir,
          canonicalRootDir,
          sourcePath,
          relativeImportSpecifier(sourcePath, rootDir, target.absolutePath)
        );
        if (guardedImport) {
          rawImports.push({
            sourcePath,
            specifier: target.authoredPattern,
            ...guardedImport,
          });
        }
      }
    }
  }
  return rawImports;
}

function validateHarnessRawImports(rootDir, relativePath, issues) {
  for (const rawImport of discoverHarnessRawImports(rootDir)) {
    if (rawImport.category === 'unverified-markup-handler') {
      issues.push(
        `${relativePath}: unverified markup event handler in \`${rawImport.sourcePath}\` requires a statically readable literal body without an unreviewed executable resource entry`
      );
      continue;
    }
    if (rawImport.category === 'unverified-runtime-compilation') {
      issues.push(
        `${relativePath}: runtime code compilation in \`${rawImport.sourcePath}\` is unverified; recognized eval/Function entry points require an explicit reviewed admission`
      );
      continue;
    }
    if (
      rawImport.category === 'unreviewed-preview' ||
      rawImport.category === 'production-import-map'
    ) {
      issues.push(
        `${relativePath}: ${rawImport.category === 'unreviewed-preview' ? 'unreviewed executable preview or unresolved native element creation' : 'production import map or unverified script type'} in \`${rawImport.sourcePath}\` is not admitted for Harness consumer-wall review`
      );
      continue;
    }

    if (
      rawImport.category === 'external-document-base' ||
      rawImport.category === 'dynamic-document-base'
    ) {
      issues.push(
        `${relativePath}: ${rawImport.category === 'external-document-base' ? `external document base href \`${rawImport.specifier}\`` : 'dynamic document base href'} in \`${rawImport.sourcePath}\` is not reviewed for Harness consumer-wall review`
      );
      continue;
    }
    if (rawImport.category === 'external-stylesheet') {
      issues.push(
        `${relativePath}: external stylesheet \`${rawImport.specifier}\` in \`${rawImport.sourcePath}\` is not reviewed`
      );
      continue;
    }
    if (
      rawImport.category === 'dynamic-stylesheet-relation' ||
      rawImport.category === 'dynamic-stylesheet-link'
    ) {
      issues.push(
        `${relativePath}: dynamic stylesheet ${rawImport.category === 'dynamic-stylesheet-relation' ? 'relation' : 'source'} in \`${rawImport.sourcePath}\` must be statically bounded for Harness consumer-wall review`
      );
      continue;
    }
    if (rawImport.category === 'external-executable-script') {
      issues.push(
        `${relativePath}: external executable worker script \`${rawImport.specifier}\` in \`${rawImport.sourcePath}\` is not reviewed for Harness consumer-wall review`
      );
      continue;
    }
    if (rawImport.category === 'external-script-element') {
      issues.push(
        `${relativePath}: external executable script \`${rawImport.specifier}\` in \`${rawImport.sourcePath}\` is not reviewed for Harness consumer-wall review`
      );
      continue;
    }
    if (rawImport.category === 'dynamic-script-element') {
      issues.push(
        `${relativePath}: dynamic executable script source in \`${rawImport.sourcePath}\` must be statically bounded for Harness consumer-wall review`
      );
      continue;
    }

    if (rawImport.category === 'forbidden-third-party-package') {
      issues.push(
        `${relativePath}: forbidden third-party Harness UI package \`${rawImport.specifier}\` in \`${rawImport.sourcePath}\``
      );
      continue;
    }
    if (rawImport.category === 'unresolved-dynamic-import') {
      issues.push(
        `${relativePath}: unresolved dynamic import in \`${rawImport.sourcePath}\` must be statically bounded for Harness consumer-wall review`
      );
      continue;
    }
    if (rawImport.category === 'unresolved-dynamic-require') {
      issues.push(
        `${relativePath}: unresolved dynamic require in \`${rawImport.sourcePath}\` must be statically bounded for Harness consumer-wall review`
      );
      continue;
    }
    if (rawImport.category === 'unresolved-worker-entry') {
      issues.push(
        `${relativePath}: unresolved Worker/SharedWorker entry in \`${rawImport.sourcePath}\` must be statically bounded for Harness consumer-wall review`
      );
      continue;
    }
    if (rawImport.category === 'unresolved-worker-script') {
      issues.push(
        `${relativePath}: unresolved importScripts target in \`${rawImport.sourcePath}\` must be statically bounded for Harness consumer-wall review`
      );
      continue;
    }
    if (rawImport.category === 'vite-ignored-dynamic-import') {
      issues.push(
        `${relativePath}: @vite-ignore dynamic import in \`${rawImport.sourcePath}\` is not reviewed against an exact URL boundary`
      );
      continue;
    }
    const allowance = HARNESS_RAW_IMPORT_ALLOWLIST[rawImport.sourcePath];
    if (allowance?.specifiers?.includes(rawImport.specifier)) continue;
    issues.push(
      `${relativePath}: raw Proto UI import \`${rawImport.specifier}\` in \`${rawImport.sourcePath}\` escapes the Harness consumer-wall allowlist`
    );
  }
}

function lockedReference(entry) {
  return typeof entry === 'string' ? entry : entry?.version;
}

function importerDependencyReference(lockfile, importer, packageName) {
  const importerRecord = lockfile?.importers?.[importer];
  for (const dependencyKind of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    const reference = lockedReference(importerRecord?.[dependencyKind]?.[packageName]);
    if (reference) return reference;
  }
  return undefined;
}

function lockedSemanticVersion(reference) {
  return String(reference ?? '').match(/^([0-9]+\.[0-9]+\.[0-9]+)/)?.[1];
}

function transitivePackageVersions(lockfile, dependencyRoot, targetPackageName) {
  const rootReference = importerDependencyReference(
    lockfile,
    dependencyRoot.importer,
    dependencyRoot.packageName
  );
  if (!rootReference) return [];

  const versions = new Set();
  const pending = [{ packageName: dependencyRoot.packageName, reference: rootReference }];
  const visited = new Set();
  while (pending.length > 0) {
    const current = pending.pop();
    const snapshotKey = `${current.packageName}@${current.reference}`;
    if (visited.has(snapshotKey)) continue;
    visited.add(snapshotKey);

    if (current.packageName === targetPackageName) {
      const version = lockedSemanticVersion(current.reference);
      if (version) versions.add(version);
    }

    const snapshot = lockfile?.snapshots?.[snapshotKey];
    if (!snapshot) continue;
    for (const dependencyKind of ['dependencies', 'optionalDependencies']) {
      for (const [packageName, entry] of Object.entries(snapshot[dependencyKind] ?? {})) {
        const reference = lockedReference(entry);
        if (reference) pending.push({ packageName, reference });
      }
    }
  }
  return [...versions].sort();
}

function validateInheritedDependencyVersions(rootDir, config, issues) {
  const dependencies = (config.inheritedSurfaceManifests ?? [])
    .flatMap((manifest) =>
      (manifest.dependencies ?? (manifest.dependency ? [manifest.dependency] : [])).map(
        (dependency) => ({
          source: manifest.source,
          dependencyRoot: manifest.dependencyRoot,
          ...dependency,
        })
      )
    )
    .filter(({ packageName }) => packageName);
  if (dependencies.length === 0) return;

  const lockfilePath = path.join(rootDir, 'pnpm-lock.yaml');
  if (!fs.existsSync(lockfilePath)) {
    issues.push(
      `${config.relativePath}: pnpm-lock.yaml is required to validate inherited surfaces`
    );
    return;
  }
  const lockfile = parseYaml(fs.readFileSync(lockfilePath, 'utf8'));
  for (const { dependencyRoot, importer, packageName, source, version } of dependencies) {
    const importerVersion = importer
      ? lockedSemanticVersion(importerDependencyReference(lockfile, importer, packageName))
      : undefined;
    const transitiveVersions = dependencyRoot
      ? transitivePackageVersions(lockfile, dependencyRoot, packageName)
      : [];
    const packageVersions = importer
      ? []
      : dependencyRoot
        ? []
        : [
            ...new Set(
              Object.keys(lockfile?.packages ?? {}).flatMap((packageKey) => {
                const prefix = `${packageName}@`;
                if (!packageKey.startsWith(prefix)) return [];
                const resolvedVersion = lockedSemanticVersion(packageKey.slice(prefix.length));
                return resolvedVersion ? [resolvedVersion] : [];
              })
            ),
          ];
    const resolvedVersions = importerVersion
      ? [importerVersion]
      : dependencyRoot
        ? transitiveVersions
        : packageVersions;
    if (resolvedVersions.length === 0) {
      issues.push(
        `${config.relativePath}: cannot resolve inherited dependency ${packageName} from pnpm-lock.yaml ${
          importer
            ? `importer ${importer}`
            : dependencyRoot
              ? `${dependencyRoot.packageName} reachable from importer ${dependencyRoot.importer}`
              : 'packages'
        }`
      );
      continue;
    }
    if (
      resolvedVersions.length !== 1 ||
      resolvedVersions[0] !== version ||
      !source.includes(`${packageName}@${version}`)
    ) {
      issues.push(
        `${config.relativePath}: inherited manifest ${source} must match resolved ${resolvedVersions
          .map((resolvedVersion) => `${packageName}@${resolvedVersion}`)
          .join(', ')}`
      );
    }
  }
}

function requireMeaningfulLabels(value, labels, context, issues) {
  const nextLabelPattern = labels.map(escapeRegularExpression).join('|');
  for (const label of labels) {
    const match = value.match(labelValuePattern(label, nextLabelPattern));
    if (!match) {
      issues.push(`${context}: missing required \`${label}\` label`);
    } else if (!isMeaningful(match[1])) {
      issues.push(`${context}: required \`${label}\` label must have a meaningful value`);
    }
  }
}

function labelValuePattern(label, nextLabelPattern) {
  return new RegExp(
    `\\b${escapeRegularExpression(label)}[ \\t]*(.*?)(?=;|\\b(?:${nextLabelPattern})[ \\t]*|[\\r\\n]|$)`,
    'i'
  );
}

function evidenceRecordLabelValue(record, label, labels = SELF_HOSTED_WEBSITE_RECORD_LABELS) {
  const nextLabelPattern = labels.map(escapeRegularExpression).join('|');
  return record.match(labelValuePattern(label, nextLabelPattern))?.[1].trim() ?? '';
}

function inlineCodeValues(value) {
  return [...value.matchAll(/`([^`\r\n]+)`/g)].map((match) => match[1].trim());
}

function readFileSignature(absolutePath, length = 12) {
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) return false;
  const descriptor = fs.openSync(absolutePath, 'r');
  const signature = Buffer.alloc(length);
  try {
    return signature.subarray(0, fs.readSync(descriptor, signature, 0, length, 0));
  } finally {
    fs.closeSync(descriptor);
  }
}

const PNG_CRC_TABLE = Array.from({ length: 256 }, (_unused, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function pngCrc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = PNG_CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const MAX_IMAGE_BYTES = 32 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 16 * 1024 * 1024;
const MAX_DECODED_IMAGE_BYTES = 128 * 1024 * 1024;

function hasValidPngPixelStream(
  idatData,
  width,
  height,
  bitDepth,
  colorType,
  interlaceMethod,
  paletteSize
) {
  let channels;
  let validBitDepth;
  switch (colorType) {
    case 0:
      channels = 1;
      validBitDepth = [1, 2, 4, 8, 16].includes(bitDepth);
      break;
    case 2:
      channels = 3;
      validBitDepth = bitDepth === 8 || bitDepth === 16;
      break;
    case 3:
      channels = 1;
      validBitDepth = [1, 2, 4, 8].includes(bitDepth);
      break;
    case 4:
      channels = 2;
      validBitDepth = bitDepth === 8 || bitDepth === 16;
      break;
    case 6:
      channels = 4;
      validBitDepth = bitDepth === 8 || bitDepth === 16;
      break;
    default:
      return false;
  }
  if (!validBitDepth || width * height > MAX_IMAGE_PIXELS) return false;

  const passes =
    interlaceMethod === 0
      ? [[0, 0, 1, 1]]
      : [
          [0, 0, 8, 8],
          [4, 0, 8, 8],
          [0, 4, 4, 8],
          [2, 0, 4, 4],
          [0, 2, 2, 4],
          [1, 0, 2, 2],
          [0, 1, 1, 2],
        ];
  const rowPlans = [];
  let decodedByteLength = 0n;
  for (const [startX, startY, stepX, stepY] of passes) {
    const passWidth = width <= startX ? 0 : Math.ceil((width - startX) / stepX);
    const passHeight = height <= startY ? 0 : Math.ceil((height - startY) / stepY);
    if (passWidth === 0 || passHeight === 0) continue;
    const rowLength = 1 + Math.ceil((passWidth * channels * bitDepth) / 8);
    if (!Number.isSafeInteger(rowLength)) return false;
    rowPlans.push({ rows: passHeight, rowLength, width: passWidth });
    decodedByteLength += BigInt(passHeight) * BigInt(rowLength);
  }
  if (decodedByteLength === 0n || decodedByteLength > BigInt(MAX_DECODED_IMAGE_BYTES)) {
    return false;
  }

  const expectedByteLength = Number(decodedByteLength);
  let decoded;
  try {
    decoded = inflateSync(idatData, { maxOutputLength: expectedByteLength });
  } catch {
    return false;
  }
  if (decoded.length !== expectedByteLength) return false;

  let offset = 0;
  // https://www.w3.org/TR/png-3/#9Filters and #11PLTE: palette indexes
  // must be checked after reconstruction. Decoders may recover invalid indexes
  // as black pixels, which is insufficient for validating retained evidence.
  for (const { rows, rowLength, width: passWidth } of rowPlans) {
    let previous = Buffer.alloc(rowLength - 1);
    for (let row = 0; row < rows; row += 1) {
      const filter = decoded[offset];
      if (filter > 4) return false;
      if (colorType === 3) {
        const reconstructed = Buffer.alloc(rowLength - 1);
        for (let byte = 0; byte < reconstructed.length; byte += 1) {
          const left = reconstructed[byte - 1] ?? 0;
          const above = previous[byte];
          const upperLeft = previous[byte - 1] ?? 0;
          let predictor = 0;
          if (filter === 1) predictor = left;
          else if (filter === 2) predictor = above;
          else if (filter === 3) predictor = Math.floor((left + above) / 2);
          else if (filter === 4) {
            const estimate = left + above - upperLeft;
            const distances = [
              Math.abs(estimate - left),
              Math.abs(estimate - above),
              Math.abs(estimate - upperLeft),
            ];
            predictor =
              distances[0] <= distances[1] && distances[0] <= distances[2]
                ? left
                : distances[1] <= distances[2]
                  ? above
                  : upperLeft;
          }
          reconstructed[byte] = (decoded[offset + 1 + byte] + predictor) & 0xff;
        }
        for (let pixel = 0; pixel < passWidth; pixel += 1) {
          const bit = pixel * bitDepth;
          const index =
            (reconstructed[Math.floor(bit / 8)] >> (8 - bitDepth - (bit % 8))) &
            ((1 << bitDepth) - 1);
          if (index >= paletteSize) return false;
        }
        previous = reconstructed;
      }
      offset += rowLength;
    }
  }
  return offset === decoded.length;
}

function hasValidPngImageData(data) {
  if (data.length < 57 || !data.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
    return false;
  }
  let offset = 8;
  let chunkIndex = 0;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlaceMethod = 0;
  let hasImageData = false;
  let hasPaletteChunk = false;
  let paletteSize = 0;
  let hasIdatChunk = false;
  let idatSequenceEnded = false;
  let idatByteLength = 0;
  const idatChunks = [];
  while (offset + 12 <= data.length) {
    const length = data.readUInt32BE(offset);
    const typeStart = offset + 4;
    const payloadStart = typeStart + 4;
    const payloadEnd = payloadStart + length;
    const chunkEnd = payloadEnd + 4;
    if (chunkEnd > data.length) return false;
    const type = data.subarray(typeStart, payloadStart).toString('ascii');
    if (pngCrc32(data.subarray(typeStart, payloadEnd)) !== data.readUInt32BE(payloadEnd)) {
      return false;
    }
    if (chunkIndex === 0) {
      if (
        type !== 'IHDR' ||
        length !== 13 ||
        data.readUInt32BE(payloadStart) === 0 ||
        data.readUInt32BE(payloadStart + 4) === 0
      ) {
        return false;
      }
      width = data.readUInt32BE(payloadStart);
      height = data.readUInt32BE(payloadStart + 4);
      bitDepth = data.readUInt8(payloadStart + 8);
      colorType = data.readUInt8(payloadStart + 9);
      if (data.readUInt8(payloadStart + 10) !== 0 || data.readUInt8(payloadStart + 11) !== 0) {
        return false;
      }
      interlaceMethod = data.readUInt8(payloadStart + 12);
      if (interlaceMethod !== 0 && interlaceMethod !== 1) return false;
    }
    if (type === 'PLTE') {
      if (hasIdatChunk || hasPaletteChunk || length === 0 || length > 768 || length % 3 !== 0)
        return false;
      paletteSize = length / 3;
      if (colorType === 3 && paletteSize > 2 ** bitDepth) return false;
      hasPaletteChunk = true;
    }
    if (type === 'IDAT') {
      if (idatSequenceEnded) return false;
      if (colorType === 3 && !hasPaletteChunk) return false;
      hasIdatChunk = true;
      if (length > 0) {
        hasImageData = true;
        idatChunks.push(data.subarray(payloadStart, payloadEnd));
        idatByteLength += length;
      }
    } else if (hasIdatChunk && type !== 'IEND') {
      idatSequenceEnded = true;
    }
    if (type === 'IEND') {
      if (length !== 0 || !hasImageData || chunkEnd !== data.length) return false;
      return hasValidPngPixelStream(
        Buffer.concat(idatChunks, idatByteLength),
        width,
        height,
        bitDepth,
        colorType,
        interlaceMethod,
        paletteSize
      );
    }
    offset = chunkEnd;
    chunkIndex += 1;
  }
  return false;
}

// `sharp` is an existing Website dependency. Decode immutable input bytes in a
// bounded child; metadata/compression differences cannot manufacture a transition.
const IMAGE_VALIDATION_SCRIPT = `
const sharp = require(process.argv[1]);
const { createHash } = require('node:crypto');
const data = require('node:fs').readFileSync(0);
sharp.cache(false);
sharp.concurrency(1);
sharp(data, { failOn: 'warning', limitInputPixels: ${MAX_IMAGE_PIXELS}, sequentialRead: true })
  .toColourspace('srgb').ensureAlpha().raw({ depth: 'ushort' }).toBuffer({ resolveWithObject: true }).then(
    ({ data, info }) => {
      if (data.length > ${MAX_DECODED_IMAGE_BYTES}) { process.exitCode = 1; return; }
      process.stdout.write(JSON.stringify({ width: info.width, height: info.height, channels: info.channels, digest: createHash('sha256').update(data).digest('hex') }));
    },
    () => { process.exitCode = 1; }
  );
`;
const requireFromWebsite = createRequire(new URL('../../apps/www/package.json', import.meta.url));

function readBoundedImageBytes(absolutePath) {
  let descriptor;
  try {
    descriptor = fs.openSync(absolutePath, 'r');
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile() || stat.size > MAX_IMAGE_BYTES) return null;
    // The extra byte detects growth after fstat. Every read has a fixed bound;
    // the same captured bytes feed structure checks, cache identity and decoder.
    const data = Buffer.alloc(stat.size + 1);
    let size = 0;
    while (size < data.length) {
      const count = fs.readSync(descriptor, data, size, data.length - size, null);
      if (count === 0) break;
      size += count;
    }
    return size > stat.size ? null : data.subarray(0, size);
  } catch {
    return null;
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

const decodedImageCache = new Map();
function decodedImageData(data) {
  const digest = createHash('sha256').update(data).digest('hex');
  if (decodedImageCache.has(digest)) return decodedImageCache.get(digest);
  let sharpEntry;
  try {
    sharpEntry = requireFromWebsite.resolve('sharp');
  } catch {
    return null;
  }
  const result = spawnSync(process.execPath, ['-e', IMAGE_VALIDATION_SCRIPT, sharpEntry], {
    input: data,
    encoding: 'utf8',
    maxBuffer: 4096,
    timeout: 15_000,
    windowsHide: true,
  });
  let decoded = null;
  if (result.error === undefined && result.status === 0) {
    try {
      const value = JSON.parse(result.stdout);
      if (
        Number.isSafeInteger(value.width) &&
        value.width > 0 &&
        Number.isSafeInteger(value.height) &&
        value.height > 0 &&
        value.width * value.height <= MAX_IMAGE_PIXELS &&
        value.channels === 4 &&
        /^[a-f0-9]{64}$/u.test(value.digest)
      )
        decoded = value;
    } catch {
      /* Decoder output must be complete and bounded. */
    }
  }
  if (decodedImageCache.size >= 128)
    decodedImageCache.delete(decodedImageCache.keys().next().value);
  decodedImageCache.set(digest, decoded);
  return decoded;
}

function hasImageFileSignature(absolutePath) {
  return validatedImageData(absolutePath) !== null;
}

function validatedImageData(absolutePath) {
  const data = readBoundedImageBytes(absolutePath);
  if (data === null) return null;
  if (hasValidPngImageData(data)) return decodedImageData(data);

  if (
    data.length >= 14 &&
    /^(?:GIF87a|GIF89a)$/u.test(data.subarray(0, 6).toString('ascii')) &&
    data.readUInt16LE(6) > 0 &&
    data.readUInt16LE(8) > 0 &&
    data.at(-1) === 0x3b
  ) {
    return decodedImageData(data);
  }

  if (
    data.length >= 20 &&
    data.subarray(0, 4).toString('ascii') === 'RIFF' &&
    data.subarray(8, 12).toString('ascii') === 'WEBP' &&
    data.readUInt32LE(4) + 8 === data.length &&
    /^(?:VP8 |VP8L|VP8X)$/u.test(data.subarray(12, 16).toString('ascii'))
  ) {
    return decodedImageData(data);
  }

  if (
    data.length < 8 ||
    data[0] !== 0xff ||
    data[1] !== 0xd8 ||
    data.at(-2) !== 0xff ||
    data.at(-1) !== 0xd9
  ) {
    return null;
  }
  let offset = 2;
  let hasFrame = false;
  while (offset + 3 < data.length - 2) {
    if (data[offset] !== 0xff) return null;
    while (data[offset] === 0xff) offset += 1;
    const marker = data[offset];
    offset += 1;
    if (marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 1 >= data.length) return null;
    const segmentLength = data.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > data.length) return null;
    if (
      ((marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)) &&
      segmentLength >= 7 &&
      data.readUInt16BE(offset + 3) > 0 &&
      data.readUInt16BE(offset + 5) > 0
    ) {
      hasFrame = true;
    }
    offset += segmentLength;
    if (marker === 0xda) break;
  }
  return hasFrame ? decodedImageData(data) : null;
}

function canonicalFileWithinRoot(
  rootDir,
  repositoryPath,
  evidenceRootRelative = SELF_HOSTED_WEBSITE_EVIDENCE_ROOT
) {
  if (typeof repositoryPath !== 'string') return null;
  const evidenceRoot = path.resolve(rootDir, evidenceRootRelative);
  const absolutePath = path.resolve(rootDir, repositoryPath);
  const relativePath = path.relative(evidenceRoot, absolutePath);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) return null;
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) return null;

  const canonicalRoot = fs.realpathSync.native(evidenceRoot);
  const canonicalPath = fs.realpathSync.native(absolutePath);
  const canonicalRelativePath = path.relative(canonicalRoot, canonicalPath);
  if (
    !canonicalRelativePath ||
    canonicalRelativePath.startsWith('..') ||
    path.isAbsolute(canonicalRelativePath)
  ) {
    return null;
  }
  return canonicalPath;
}

function gitOutput(rootDir, args) {
  const result = spawnSync('git', args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

function evidenceCommitMetadata(
  rootDir,
  commit,
  evidenceKind,
  context,
  issues,
  promotionContext,
  implementationPaths
) {
  if (!commit || !/^[0-9a-f]{40}$/iu.test(commit)) return null;
  const objectType = gitOutput(rootDir, ['cat-file', '-t', commit]);
  if (objectType === null) {
    issues.push(
      `${context}: ${evidenceKind} evidence Commit \`${commit}\` does not resolve to a Git commit`
    );
    return null;
  }
  if (objectType !== 'commit') {
    issues.push(
      `${context}: ${evidenceKind} evidence Commit \`${commit}\` must identify a commit object directly`
    );
    return null;
  }

  const { baseRevision, headRevision, mergeRevision } = promotionContext;
  if (!baseRevision || !headRevision) {
    issues.push(`${context}: promotion validation requires explicit base and head revisions`);
  } else {
    for (const [role, revision] of [
      ['base', baseRevision],
      ['head', headRevision],
    ]) {
      if (
        !/^[0-9a-f]{40}$/iu.test(revision) ||
        gitOutput(rootDir, ['cat-file', '-t', revision]) !== 'commit'
      ) {
        issues.push(
          `${context}: promotion history proof is unavailable for ${role} \`${revision}\``
        );
      }
    }
    const mergeRevisionIsCommit =
      !mergeRevision ||
      (/^[0-9a-f]{40}$/iu.test(mergeRevision) &&
        gitOutput(rootDir, ['cat-file', '-t', mergeRevision]) === 'commit');
    if (mergeRevision && !mergeRevisionIsCommit) {
      issues.push(
        `${context}: promotion merge revision \`${mergeRevision}\` must identify a commit object directly`
      );
    }
    const checkoutRevision = gitOutput(rootDir, ['rev-parse', 'HEAD']);
    if (
      checkoutRevision &&
      headRevision !== checkoutRevision &&
      mergeRevision !== checkoutRevision
    ) {
      issues.push(
        `${context}: promotion head \`${headRevision}\` or merge revision \`${mergeRevision ?? ''}\` must equal checked-out revision \`${checkoutRevision}\``
      );
    }
    if (gitOutput(rootDir, ['cat-file', '-t', baseRevision]) === 'commit') {
      const ancestry = spawnSync('git', ['merge-base', '--is-ancestor', commit, baseRevision], {
        cwd: rootDir,
        stdio: 'ignore',
      });
      if (ancestry.status === 1) {
        issues.push(
          `${context}: ${evidenceKind} evidence Commit \`${commit}\` is not contained in the reviewed base \`${baseRevision}\``
        );
      } else if (ancestry.status !== 0) {
        issues.push(
          `${context}: promotion history proof is unavailable for base \`${baseRevision}\``
        );
      }
    }
    const baseRevisionIsCommit = gitOutput(rootDir, ['cat-file', '-t', baseRevision]) === 'commit';
    const headRevisionIsCommit = gitOutput(rootDir, ['cat-file', '-t', headRevision]) === 'commit';
    if (mergeRevision && mergeRevisionIsCommit && baseRevisionIsCommit && headRevisionIsCommit) {
      for (const [role, revision] of [
        ['reviewed base', baseRevision],
        ['exact head', headRevision],
      ]) {
        const containedByMerge = spawnSync(
          'git',
          ['merge-base', '--is-ancestor', revision, mergeRevision],
          { cwd: rootDir, stdio: 'ignore' }
        );
        if (containedByMerge.status === 1) {
          issues.push(
            `${context}: ${role} \`${revision}\` must be an ancestor of merge revision \`${mergeRevision}\``
          );
        } else if (containedByMerge.status !== 0) {
          issues.push(
            `${context}: promotion history proof is unavailable between ${role} and merge revision`
          );
        }
      }
    } else if (!mergeRevision && baseRevisionIsCommit && headRevisionIsCommit) {
      const baseToHead = spawnSync(
        'git',
        ['merge-base', '--is-ancestor', baseRevision, headRevision],
        { cwd: rootDir, stdio: 'ignore' }
      );
      if (baseToHead.status === 1) {
        issues.push(
          `${context}: reviewed base \`${baseRevision}\` must be an ancestor of exact head \`${headRevision}\``
        );
      } else if (baseToHead.status !== 0) {
        issues.push(`${context}: promotion history proof is unavailable between base and head`);
      }
    }
  }
  if (mergeRevision && commit === mergeRevision) {
    issues.push(
      `${context}: evidence Commit must not equal the temporary pull-request merge commit`
    );
  }

  for (const repositoryPath of implementationPaths) {
    const retainedImplementation = canonicalFileWithinRoot(
      rootDir,
      repositoryPath,
      repositoryPath.startsWith('apps/www/') ? 'apps/www/' : 'apps/agent-harness/'
    );
    if (!retainedImplementation) {
      issues.push(
        `${context}: promoted implementation \`${repositoryPath}\` must resolve within its governed application root`
      );
    }
    const atEvidence = spawnSync('git', ['show', `${commit}:${repositoryPath}`], {
      cwd: rootDir,
      encoding: null,
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 16 * 1024 * 1024,
    });
    if (atEvidence.status !== 0) {
      issues.push(
        `${context}: promoted implementation \`${repositoryPath}\` is absent at evidence Commit \`${commit}\``
      );
    } else if (
      retainedImplementation &&
      !Buffer.from(atEvidence.stdout).equals(fs.readFileSync(retainedImplementation))
    ) {
      issues.push(
        `${context}: promoted implementation \`${repositoryPath}\` differs from evidence Commit \`${commit}\``
      );
    }
  }

  const aliasConfig = implementationPaths.some((repositoryPath) =>
    repositoryPath.startsWith('apps/www/')
  )
    ? configuredWebsiteSourceAliases(rootDir)
    : { aliases: new Map(), unsupported: new Set() };
  const sourceImplementationRoots = implementationPaths
    .map((repositoryPath) => path.resolve(rootDir, repositoryPath))
    .filter((absolutePath) => fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile());
  const sourceDependencyPaths = reachableSourcePaths(
    sourceImplementationRoots,
    aliasConfig,
    rootDir,
    { promotionPackages: true }
  );
  for (const absoluteDependencyPath of sourceDependencyPaths) {
    const canonicalDependencyPath = canonicalImportTarget(absoluteDependencyPath);
    const repositoryPath = path.relative(rootDir, canonicalDependencyPath).replaceAll('\\', '/');
    if (
      repositoryPath === '' ||
      repositoryPath.startsWith('../') ||
      path.isAbsolute(repositoryPath)
    ) {
      issues.push(`${context}: promoted dependency must resolve within the repository`);
      continue;
    }
    if (implementationPaths.includes(repositoryPath)) continue;
    const atEvidence = spawnSync('git', ['show', `${commit}:${repositoryPath}`], {
      cwd: rootDir,
      encoding: null,
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 16 * 1024 * 1024,
    });
    if (atEvidence.status !== 0) {
      issues.push(
        `${context}: promoted dependency \`${repositoryPath}\` is absent at evidence Commit \`${commit}\``
      );
    } else if (!Buffer.from(atEvidence.stdout).equals(fs.readFileSync(canonicalDependencyPath))) {
      issues.push(
        `${context}: promoted dependency \`${repositoryPath}\` differs from evidence Commit \`${commit}\``
      );
    }
  }

  const tree = gitOutput(rootDir, ['show', '-s', '--format=%T', commit]);
  return tree ? { commit, tree } : null;
}

function sha256File(absolutePath) {
  return createHash('sha256').update(fs.readFileSync(absolutePath)).digest('hex');
}
function sourceScanDigest(absolutePath) {
  const normalizedSource = fs.readFileSync(absolutePath, 'utf8').replace(/\r\n?/gu, '\n');
  return createHash('sha256').update(normalizedSource).digest('hex');
}

function validateEvidenceResultsManifest({
  rootDir,
  record,
  recordLabels,
  artifactLabels,
  evidenceRootRelative,
  commitMetadata,
  evidenceKind,
  context,
  issues,
}) {
  if (!commitMetadata) return;
  const resultsPaths = explicitRepositoryPaths(
    evidenceRecordLabelValue(record, 'Results:', recordLabels)
  ).filter((repositoryPath) => repositoryPath.startsWith(evidenceRootRelative));
  if (resultsPaths.length !== 1) {
    issues.push(
      `${context}: ${evidenceKind} evidence Results must bind exactly one machine-readable manifest under ${evidenceRootRelative}**`
    );
    return;
  }
  const resultsPath = resultsPaths[0];
  const canonicalResultsPath = canonicalFileWithinRoot(rootDir, resultsPath, evidenceRootRelative);
  if (!canonicalResultsPath || !/\.json$/iu.test(resultsPath)) {
    issues.push(
      `${context}: ${evidenceKind} evidence Results must resolve to a retained JSON manifest under ${evidenceRootRelative}**`
    );
    return;
  }
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(canonicalResultsPath, 'utf8'));
  } catch (error) {
    issues.push(
      `${context}: ${evidenceKind} evidence Results manifest is invalid JSON: ${error.message}`
    );
    return;
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    issues.push(`${context}: ${evidenceKind} evidence Results manifest must be an object`);
    return;
  }
  const manifestKeys = new Set([
    'schemaVersion',
    'kind',
    'repository',
    'revision',
    'tree',
    'commands',
    'results',
    'artifacts',
  ]);
  const unknownManifestKeys = Object.keys(manifest).filter((key) => !manifestKeys.has(key));
  if (unknownManifestKeys.length > 0) {
    issues.push(
      `${context}: ${evidenceKind} evidence Results manifest has unknown keys: ${unknownManifestKeys.join(', ')}`
    );
  }
  if (manifest.schemaVersion !== 1) {
    issues.push(`${context}: ${evidenceKind} evidence Results manifest schemaVersion must be 1`);
  }
  if (manifest.kind !== 'proto-ui.coverage-evidence-results') {
    issues.push(
      `${context}: ${evidenceKind} evidence Results manifest kind must be proto-ui.coverage-evidence-results`
    );
  }
  if (manifest.repository !== 'Proto-UI/Proto-UI') {
    issues.push(
      `${context}: ${evidenceKind} evidence Results repository must be Proto-UI/Proto-UI`
    );
  }
  if (manifest.revision !== commitMetadata.commit) {
    issues.push(`${context}: ${evidenceKind} evidence Results revision must equal Commit`);
  }
  if (typeof manifest.tree !== 'string' || manifest.tree.length === 0) {
    issues.push(
      `${context}: ${evidenceKind} evidence Results manifest must contain non-empty tree`
    );
  } else if (manifest.tree !== commitMetadata.tree) {
    issues.push(`${context}: ${evidenceKind} evidence Results tree must match the Commit tree`);
  }
  for (const field of ['commands', 'results', 'artifacts']) {
    if (!Array.isArray(manifest[field]) || manifest[field].length === 0) {
      issues.push(
        `${context}: ${evidenceKind} evidence Results manifest must contain non-empty ${field}`
      );
    }
  }
  if (Array.isArray(manifest.commands)) {
    for (const command of manifest.commands) {
      if (
        !command ||
        typeof command !== 'object' ||
        Array.isArray(command) ||
        Object.keys(command).some((key) => key !== 'command' && key !== 'status') ||
        typeof command.command !== 'string' ||
        command.command.length === 0 ||
        command.status !== 'passed'
      ) {
        issues.push(
          `${context}: ${evidenceKind} evidence Results commands must name non-empty commands with passed status and no unknown keys`
        );
      }
    }
    const manifestCommands = new Set(manifest.commands.map((entry) => entry?.command));
    const commandValue = evidenceRecordLabelValue(record, 'Commands:', recordLabels);
    const inlineCommands = inlineCodeValues(commandValue);
    const recordCommands =
      inlineCommands.length > 0
        ? inlineCommands
        : /^(?:corepack\s+)?(?:bun|node|npm|pnpm(?:@[^\s]+)?|yarn)(?:\s|$)/u.test(commandValue)
          ? [commandValue]
          : [];
    if (recordCommands.length === 0) {
      issues.push(
        `${context}: ${evidenceKind} evidence record Commands must name at least one executable command`
      );
    }
    for (const command of recordCommands) {
      if (!manifestCommands.has(command)) {
        issues.push(
          `${context}: ${evidenceKind} evidence Results commands must include record command \`${command}\``
        );
      }
    }
  }
  if (Array.isArray(manifest.results)) {
    for (const result of manifest.results) {
      if (
        !result ||
        typeof result !== 'object' ||
        Array.isArray(result) ||
        Object.keys(result).some((key) => key !== 'name' && key !== 'status') ||
        typeof result.name !== 'string' ||
        result.name.length === 0 ||
        result.status !== 'passed'
      ) {
        issues.push(
          `${context}: ${evidenceKind} evidence Results entries must have non-empty names and passed status and no unknown keys`
        );
      }
    }
  }
  const requiredArtifactPaths = new Set(
    artifactLabels.flatMap((label) =>
      explicitRepositoryPaths(evidenceRecordLabelValue(record, label, recordLabels)).filter(
        (repositoryPath) => repositoryPath.startsWith(evidenceRootRelative)
      )
    )
  );
  for (const frameManifestPath of explicitRepositoryPaths(
    evidenceRecordLabelValue(record, 'Multi-frame:', recordLabels)
  )) {
    if (!/\.json$/iu.test(frameManifestPath)) continue;
    const canonicalManifestPath = canonicalFileWithinRoot(
      rootDir,
      frameManifestPath,
      evidenceRootRelative
    );
    if (!canonicalManifestPath) continue;
    try {
      const frameManifest = JSON.parse(fs.readFileSync(canonicalManifestPath, 'utf8'));
      for (const frameEntry of frameManifest.frames ?? []) {
        const framePath = typeof frameEntry === 'string' ? frameEntry : frameEntry?.path;
        if (typeof framePath === 'string' && framePath.startsWith(evidenceRootRelative)) {
          requiredArtifactPaths.add(framePath);
        }
      }
    } catch {
      // The retained-artifact validator reports malformed frame manifests.
    }
  }
  const canonicalKey = (absolutePath) =>
    process.platform === 'win32' ? absolutePath.toLowerCase() : absolutePath;
  const requiredCanonicalArtifacts = new Map();
  for (const repositoryPath of requiredArtifactPaths) {
    const canonicalPath = canonicalFileWithinRoot(rootDir, repositoryPath, evidenceRootRelative);
    if (canonicalPath) requiredCanonicalArtifacts.set(canonicalKey(canonicalPath), repositoryPath);
  }

  const manifestArtifacts = new Map();
  if (Array.isArray(manifest.artifacts)) {
    for (const artifact of manifest.artifacts) {
      const repositoryPath = artifact?.path;
      if (
        !artifact ||
        typeof artifact !== 'object' ||
        Array.isArray(artifact) ||
        Object.keys(artifact).some((key) => key !== 'path' && key !== 'size' && key !== 'sha256') ||
        typeof repositoryPath !== 'string' ||
        !Number.isSafeInteger(artifact.size) ||
        artifact.size <= 0 ||
        !/^[0-9a-f]{64}$/u.test(artifact.sha256 ?? '')
      ) {
        issues.push(
          `${context}: ${evidenceKind} evidence Results artifacts must use exact path, positive size, and lowercase SHA-256 fields`
        );
        if (typeof repositoryPath !== 'string') continue;
      }
      const canonicalArtifactPath = canonicalFileWithinRoot(
        rootDir,
        repositoryPath,
        evidenceRootRelative
      );
      if (!canonicalArtifactPath) {
        issues.push(
          `${context}: ${evidenceKind} evidence Results artifact must resolve within ${evidenceRootRelative}**: ${repositoryPath}`
        );
        continue;
      }
      const artifactKey = canonicalKey(canonicalArtifactPath);
      if (artifactKey === canonicalKey(canonicalResultsPath)) {
        issues.push(
          `${context}: ${evidenceKind} evidence Results artifacts must not include the Results manifest itself`
        );
        continue;
      }
      if (manifestArtifacts.has(artifactKey)) {
        issues.push(
          `${context}: ${evidenceKind} evidence Results artifacts must have unique canonical paths`
        );
        continue;
      }
      manifestArtifacts.set(artifactKey, { artifact, repositoryPath });
      if (!requiredCanonicalArtifacts.has(artifactKey)) {
        issues.push(
          `${context}: ${evidenceKind} evidence Results artifacts contain unreferenced retained artifact \`${repositoryPath}\``
        );
      }
      const actualSize = fs.statSync(canonicalArtifactPath).size;
      const actualDigest = sha256File(canonicalArtifactPath);
      if (artifact.size !== actualSize || artifact.sha256 !== actualDigest) {
        issues.push(
          `${context}: ${evidenceKind} evidence Results artifact metadata does not match retained file: ${repositoryPath}`
        );
      }
    }
  }
  for (const [artifactKey, repositoryPath] of requiredCanonicalArtifacts) {
    if (!manifestArtifacts.has(artifactKey)) {
      issues.push(
        `${context}: ${evidenceKind} evidence Results artifacts must include record artifact \`${repositoryPath}\``
      );
    }
  }
}

function validateDogfoodedRetainedEvidenceArtifacts(record, context, rootDir, issues) {
  const evidenceRoot = 'internal/agent-harness/evidence/';
  for (const labelName of DOGFOODED_EVIDENCE_LABELS) {
    const artifactPaths = explicitRepositoryPaths(
      evidenceRecordLabelValue(record, labelName, DOGFOODED_RECORD_LABELS)
    ).filter((repositoryPath) => repositoryPath.startsWith(evidenceRoot));
    if (artifactPaths.length !== 1) {
      issues.push(
        `${context}: dogfooded evidence ${labelName} must bind exactly one retained artifact under ${evidenceRoot}**`
      );
      continue;
    }
    const repositoryPath = artifactPaths[0];
    const canonicalPath = canonicalFileWithinRoot(rootDir, repositoryPath, evidenceRoot);
    if (!canonicalPath) {
      issues.push(
        `${context}: dogfooded evidence ${labelName} retained artifact must resolve within ${evidenceRoot}**: ${repositoryPath}`
      );
    } else if (fs.statSync(canonicalPath).size === 0) {
      issues.push(
        `${context}: dogfooded evidence ${labelName} retained artifact must not be empty: ${repositoryPath}`
      );
    }
  }
}

function validateDogfoodedMatrixEvidenceArtifacts(record, context, rootDir, issues) {
  const evidenceRoot = 'internal/agent-harness/evidence/';
  for (const labelName of DOGFOODED_EVIDENCE_LABELS) {
    const artifactPaths = explicitRepositoryPaths(
      evidenceRecordLabelValue(record.Evidence, labelName, DOGFOODED_EVIDENCE_LABELS)
    ).filter((repositoryPath) => repositoryPath.startsWith(evidenceRoot));
    if (artifactPaths.length !== 1) {
      issues.push(
        `${context}: dogfooded matrix Evidence ${labelName} must bind exactly one retained artifact under ${evidenceRoot}**`
      );
      continue;
    }
    const canonicalPath = canonicalFileWithinRoot(rootDir, artifactPaths[0], evidenceRoot);
    if (!canonicalPath) {
      issues.push(
        `${context}: dogfooded matrix Evidence ${labelName} retained artifact must resolve within ${evidenceRoot}**: ${artifactPaths[0]}`
      );
    } else if (fs.statSync(canonicalPath).size === 0) {
      issues.push(
        `${context}: dogfooded matrix Evidence ${labelName} retained artifact must not be empty: ${artifactPaths[0]}`
      );
    }
  }
}

function validateRetainedEvidenceArtifacts(record, context, rootDir, issues, matrixRecord = null) {
  const artifactLabels = [
    'Build:',
    'Browser:',
    'Accessibility:',
    'Screenshot:',
    'Multi-frame:',
    'Results:',
  ];
  const artifactsByLabel = new Map();
  for (const label of artifactLabels) {
    const value = evidenceRecordLabelValue(record, label);
    const artifactPaths = explicitRepositoryPaths(value).filter((repositoryPath) =>
      repositoryPath.startsWith(SELF_HOSTED_WEBSITE_EVIDENCE_ROOT)
    );
    artifactsByLabel.set(label, artifactPaths);
    if (artifactPaths.length === 0) {
      issues.push(
        `${context}: ${label} must bind an exact retained artifact under internal/website/evidence/**`
      );
      continue;
    }
    if (artifactPaths.length > 1) {
      issues.push(
        `${context}: ${label} must bind exactly one retained artifact under internal/website/evidence/**`
      );
    }
    for (const repositoryPath of artifactPaths) {
      const absolutePath = path.resolve(rootDir, repositoryPath);
      const retainedArtifactPath = canonicalFileWithinRoot(rootDir, repositoryPath);
      if (!retainedArtifactPath) {
        if (!fs.existsSync(absolutePath)) {
          issues.push(`${context}: ${label} retained artifact does not exist: ${repositoryPath}`);
        } else if (!fs.statSync(absolutePath).isFile()) {
          issues.push(`${context}: ${label} retained artifact must be a file: ${repositoryPath}`);
        } else {
          issues.push(
            `${context}: ${label} retained artifact must resolve within internal/website/evidence/**: ${repositoryPath}`
          );
        }
      } else if (fs.statSync(retainedArtifactPath).size === 0) {
        issues.push(`${context}: ${label} retained artifact must not be empty: ${repositoryPath}`);
      }
    }
  }
  if (matrixRecord) {
    for (const label of artifactLabels.filter((name) => name !== 'Results:')) {
      const matrixPaths = explicitRepositoryPaths(
        evidenceRecordLabelValue(matrixRecord.Evidence, label, DOGFOODED_EVIDENCE_LABELS)
      ).filter((repositoryPath) => repositoryPath.startsWith(SELF_HOSTED_WEBSITE_EVIDENCE_ROOT));
      const retainedPaths = new Set(artifactsByLabel.get(label) ?? []);
      for (const repositoryPath of matrixPaths) {
        if (!retainedPaths.has(repositoryPath)) {
          issues.push(
            `${context}: matrix Evidence ${label} path must also appear in the retained Results manifest: ${repositoryPath}`
          );
        }
      }
    }
  }

  for (const repositoryPath of artifactsByLabel.get('Screenshot:') ?? []) {
    const absolutePath = path.resolve(rootDir, repositoryPath);
    if (
      !/\.(?:gif|jpe?g|png|webp)$/i.test(repositoryPath) ||
      !hasImageFileSignature(absolutePath)
    ) {
      issues.push(
        `${context}: Screenshot: retained artifact must be a recognized image file: ${repositoryPath}`
      );
    }
  }

  for (const repositoryPath of artifactsByLabel.get('Multi-frame:') ?? []) {
    const absolutePath = path.resolve(rootDir, repositoryPath);
    if (/\.(?:mkv|mov|mp4|webm)$/i.test(repositoryPath)) {
      try {
        decodeVideoEvidence(absolutePath);
      } catch (error) {
        issues.push(
          `${context}: Multi-frame: retained video artifact must be structurally valid and contain frame data; bounded decoder unverified (${error.message}): ${repositoryPath}`
        );
      }
      continue;
    }
    if (!/\.json$/i.test(repositoryPath) || !fs.existsSync(absolutePath)) {
      issues.push(
        `${context}: Multi-frame: retained artifact must be a recognized video or JSON frame manifest: ${repositoryPath}`
      );
      continue;
    }
    try {
      const manifest = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
      if (!Array.isArray(manifest.frames) || manifest.frames.length < 2) {
        issues.push(
          `${context}: Multi-frame: JSON manifest must retain at least two distinct frame paths: ${repositoryPath}`
        );
        continue;
      }
      const canonicalFrames = new Set();
      const frameDigests = new Set();
      for (const frameEntry of manifest.frames) {
        const framePath = typeof frameEntry === 'string' ? frameEntry : frameEntry?.path;
        const canonicalFrame = canonicalFileWithinRoot(rootDir, framePath);
        if (!canonicalFrame) {
          issues.push(
            `${context}: Multi-frame: JSON manifest frame must be an existing retained artifact under internal/website/evidence/**: ${String(framePath)}`
          );
          continue;
        }
        canonicalFrames.add(
          process.platform === 'win32' ? canonicalFrame.toLowerCase() : canonicalFrame
        );
        const image = validatedImageData(canonicalFrame);
        if (image)
          frameDigests.add(`${image.width}x${image.height}:${image.channels}:${image.digest}`);
        if (!image) {
          issues.push(
            `${context}: Multi-frame: JSON manifest frame must be a recognized image file: ${String(framePath)}`
          );
        }
      }
      if (frameDigests.size < 2) {
        issues.push(
          `${context}: Multi-frame: JSON manifest must retain at least two content-distinct frames: ${repositoryPath}`
        );
      }
      if (canonicalFrames.size < 2) {
        issues.push(
          `${context}: Multi-frame: JSON manifest must retain at least two canonically distinct frame paths: ${repositoryPath}`
        );
      }
    } catch {
      issues.push(`${context}: Multi-frame: JSON frame manifest is invalid: ${repositoryPath}`);
    }
  }
  return artifactsByLabel;
}

function validateSelfHostedWebsiteEvidenceRecord(record, context, rootDir, issues, matrixRecord) {
  const routes = inlineCodeValues(evidenceRecordLabelValue(record, 'Routes:')).filter((value) =>
    /^\/(?:[A-Za-z0-9._~!$&'()*+,;=:@%-]+\/)*[A-Za-z0-9._~!$&'()*+,;=:@%-]*$/u.test(value)
  );
  if (routes.length === 0) {
    issues.push(`${context}: Routes: must name at least one exact \`/route/\` in inline code`);
  }

  const commands = inlineCodeValues(evidenceRecordLabelValue(record, 'Commands:')).filter((value) =>
    /^(?:corepack\s+)?(?:bun|node|npm|pnpm(?:@[^\s]+)?|yarn)(?:\s|$)/u.test(value)
  );
  if (commands.length === 0) {
    issues.push(`${context}: Commands: must name at least one executable command in inline code`);
  }

  validateRetainedEvidenceArtifacts(record, context, rootDir, issues, matrixRecord);
}

function validateMainRows(
  config,
  table,
  relativePath,
  rootDir,
  catalogEntries,
  governanceSnapshot,
  promotionContext,
  issues
) {
  if (!table) {
    return {
      stateCounts: new Map(),
      targetClassCounts: new Map(),
      seenIds: new Map(),
      sourceOwners: new Map(),
      rowDispositions: new Map(),
    };
  }
  const seenIds = new Map();
  const stateCounts = new Map(config.allowedStates.map((state) => [state, 0]));
  const targetClassCounts = new Map(
    config.allowedTargetClasses.map((targetClass) => [targetClass, 0])
  );
  const sourceOwners = new Map();
  const rowDispositions = new Map();
  const nonInteractiveEntries = new Map(
    (config.nonInteractiveSurfaceManifests ?? []).flatMap((manifest) =>
      manifest.entries.map((entry) => [entry.id, entry])
    )
  );

  for (const row of table.rows) {
    const record = rowRecord(config.headers, row.cells);
    const context = `${relativePath}:${row.line}`;
    const id = stripInlineCode(record.ID);
    const targetClass = stripInlineCode(record['Target class']);
    const state = stripInlineCode(record.State);
    const recordText = Object.values(record).join(' ');

    for (const [header, value] of Object.entries(record)) {
      if (!value.trim()) issues.push(`${context}: ${header} must not be empty`);
      if (includesForbiddenClassification(value)) {
        issues.push(`${context}: ${header} must not contain unknown or unclassified`);
      }
    }

    if (!config.idPattern.test(id)) {
      issues.push(`${context}: unstable ID \`${id}\`; expected the form \`${config.idExample}\``);
    }
    if (seenIds.has(id)) {
      issues.push(`${context}: duplicate ID \`${id}\` (first declared on line ${seenIds.get(id)})`);
    } else {
      seenIds.set(id, row.line);
    }
    rowDispositions.set(id, {
      targetClass,
      state,
      sourcePaths: repositoryPathsFromMatrixPath(record.Path),
      escapeOrExemption: record['Escape or exemption'],
    });

    if (!config.allowedTargetClasses.includes(targetClass)) {
      issues.push(
        `${context}: unsupported Target class \`${targetClass}\`; allowed: ${config.allowedTargetClasses.join(', ')}`
      );
    } else {
      targetClassCounts.set(targetClass, (targetClassCounts.get(targetClass) ?? 0) + 1);
    }
    if (!config.allowedStates.includes(state)) {
      issues.push(
        `${context}: unsupported State \`${state}\`; allowed: ${config.allowedStates.join(', ')}`
      );
    } else {
      stateCounts.set(state, (stateCounts.get(state) ?? 0) + 1);
    }
    const difficulty = stripInlineCode(record.Difficulty);
    if (config.allowedDifficulties && !config.allowedDifficulties.includes(difficulty)) {
      issues.push(
        `${context}: unsupported Difficulty \`${difficulty}\`; allowed: ${config.allowedDifficulties.join(', ')}`
      );
    }

    const requiredState = config.classStateRequirements?.[targetClass];
    if (requiredState && state !== requiredState) {
      issues.push(
        `${context}: Target class \`${targetClass}\` requires State \`${requiredState}\`, received \`${state}\``
      );
    }
    const requiredTargetClass = config.stateClassRequirements?.[state];
    if (requiredTargetClass && targetClass !== requiredTargetClass) {
      issues.push(
        `${context}: State \`${state}\` requires Target class \`${requiredTargetClass}\`, received \`${targetClass}\``
      );
    }

    const governedSourcePrefix =
      config.kind === 'website' ? 'apps/www/src/' : 'apps/agent-harness/src/';
    if (config.kind === 'website' || config.kind === 'agent-harness') {
      const matrixSourcePaths =
        config.kind === 'agent-harness'
          ? repositoryPathsFromMatrixPath(record.Path)
          : explicitRepositoryPaths(record.Path);
      for (const repositoryPath of matrixSourcePaths) {
        if (!repositoryPath.startsWith(governedSourcePrefix)) continue;
        const owners = sourceOwners.get(repositoryPath) ?? [];
        owners.push({ id, line: row.line });
        sourceOwners.set(repositoryPath, owners);
      }
    }

    const boundRepositoryPaths = new Set(
      (config.existingPathHeaders ?? []).flatMap((header) =>
        explicitRepositoryPaths(record[header])
      )
    );
    for (const header of config.existingPathHeaders ?? []) {
      for (const repositoryPath of explicitRepositoryPaths(record[header])) {
        if (!fs.existsSync(path.resolve(rootDir, repositoryPath))) {
          issues.push(
            `${context}: ${header} references missing repository path \`${repositoryPath}\``
          );
        }
      }
    }
    for (const requiredRepositoryPath of config.requiredRepositoryPathsByRow?.[id] ?? []) {
      if (!boundRepositoryPaths.has(requiredRepositoryPath)) {
        issues.push(
          `${context}: matrix row \`${id}\` must bind repository path \`${requiredRepositoryPath}\` as an exact code span in Path or Evidence`
        );
      }
    }
    const inlineCode = new Set(Object.values(record).flatMap(inlineCodeValues));
    if (id === 'www.search.input-results') {
      const ownsPagefindUi =
        record['Current owner'].includes('`@pagefind/default-ui`') &&
        record['Proto UI chain'].includes('P-BASE-INPUT') &&
        inlineCode.has('new PagefindUI') &&
        state === 'blocked' &&
        /(?:^|\D)#420\b/u.test(record['Dependency and owner']);
      if (!ownsPagefindUi) {
        issues.push(
          `${context}: matrix row \`www.search.input-results\` must structurally own \`new PagefindUI\` through \`@pagefind/default-ui\`, \`P-BASE-INPUT\`, blocked state, and dependency Issue #420`
        );
      }
    }
    for (const requiredValue of config.requiredInlineCodeByRow?.[id] ?? []) {
      if (!inlineCode.has(requiredValue)) {
        issues.push(
          `${context}: matrix row \`${id}\` must bind \`${requiredValue}\` as interaction-owned UI`
        );
      }
    }
    const closureBinding = config.closureBindingsByRow?.[id];
    if (closureBinding) {
      if (!new RegExp(`\\bIssue #${closureBinding.issue}\\b`, 'u').test(record.Evidence)) {
        issues.push(
          `${context}: closure binding for \`${id}\` must retain Issue #${closureBinding.issue}`
        );
      }
      if (
        !new RegExp(`\\bmerged PR #${closureBinding.pullRequest}\\b`, 'iu').test(record.Evidence)
      ) {
        issues.push(
          `${context}: closure binding for \`${id}\` must retain merged PR #${closureBinding.pullRequest}`
        );
      }
      if (!inlineCode.has(closureBinding.implementationHead)) {
        issues.push(
          `${context}: closure binding for \`${id}\` must retain reviewed PR #${closureBinding.pullRequest} head \`${closureBinding.implementationHead}\``
        );
      }
      if (!inlineCode.has(closureBinding.mergeCommit)) {
        issues.push(
          `${context}: closure binding for \`${id}\` must retain merged PR #${closureBinding.pullRequest} commit \`${closureBinding.mergeCommit}\``
        );
      }
      for (const requiredValue of [...closureBinding.routes, ...closureBinding.repositoryPaths]) {
        if (!inlineCode.has(requiredValue)) {
          issues.push(`${context}: closure binding for \`${id}\` must retain \`${requiredValue}\``);
        }
      }
      for (const phrase of closureBinding.reReviewPhrases) {
        if (!record['Re-review or removal issue'].includes(phrase)) {
          issues.push(
            `${context}: closure binding for \`${id}\` must retain re-review trigger \`${phrase}\``
          );
        }
      }
      const pullRequest = governanceSnapshot.pullRequests.get(closureBinding.pullRequest);
      if (
        !pullRequest ||
        pullRequest.state !== 'MERGED' ||
        pullRequest.headSha !== closureBinding.implementationHead ||
        pullRequest.mergeCommit !== closureBinding.mergeCommit ||
        pullRequest.url !==
          `https://github.com/Proto-UI/Proto-UI/pull/${closureBinding.pullRequest}`
      ) {
        issues.push(
          `${context}: closure binding for \`${id}\` must match the repository-owned merged PR #${closureBinding.pullRequest} snapshot`
        );
      }
    }

    const referencedIds = [...new Set(recordText.match(CATALOG_ID_PATTERN) ?? [])];
    for (const entityId of referencedIds) {
      if (!catalogEntries.has(entityId)) {
        issues.push(`${context}: references uncataloged entity ID \`${entityId}\``);
      }
    }

    const lifecycleText = config.kind === 'website' ? record.Lifecycle : record['Proto UI chain'];
    const chainIds = [...new Set(record['Proto UI chain'].match(CATALOG_ID_PATTERN) ?? [])];
    for (const requiredEntityId of config.requiredCatalogIdsByRow?.[id] ?? []) {
      if (!chainIds.includes(requiredEntityId)) {
        issues.push(
          `${context}: matrix row \`${id}\` must inventory catalog entity \`${requiredEntityId}\` in Proto UI chain`
        );
      }
    }
    const referencedStatuses = new Set(
      chainIds.map((entityId) => catalogEntries.get(entityId)?.status).filter(Boolean)
    );
    for (const catalogStatus of referencedStatuses) {
      if (!new RegExp(`\\b${catalogStatus}\\b`, 'i').test(lifecycleText)) {
        issues.push(
          `${context}: ${config.kind === 'website' ? 'Lifecycle' : 'Proto UI chain'} must report catalog status \`${catalogStatus}\` for referenced entities`
        );
      }
    }
    for (const entityId of chainIds) {
      const catalogStatus = catalogEntries.get(entityId)?.status;
      if (catalogStatus && !reportsCatalogEntityStatus(lifecycleText, entityId, catalogStatus)) {
        issues.push(
          `${context}: ${config.kind === 'website' ? 'Lifecycle' : 'Proto UI chain'} must associate catalog entity \`${entityId}\` with status \`${catalogStatus}\``
        );
      }
    }

    if (config.kind === 'website' && WEBSITE_SHIPPED_STATES.includes(state)) {
      const removedChainEntities = chainIds.filter(
        (entityId) => catalogEntries.get(entityId)?.status === 'removed'
      );
      if (removedChainEntities.length > 0) {
        issues.push(
          `${context}: shipped website State \`${state}\` must not consume removed catalog entities: ${removedChainEntities
            .map((entityId) => `\`${entityId}\``)
            .join(', ')}`
        );
      }
      const nonActiveEntity = chainIds
        .map((entityId) => [entityId, catalogEntries.get(entityId)?.status ?? 'uncataloged'])
        .find(([, status]) => status !== 'active');
      if (nonActiveEntity) {
        issues.push(
          `${context}: shipped website State \`${state}\` requires every catalog entity in Proto UI chain to be active; received \`${nonActiveEntity[0]}\` (${nonActiveEntity[1]})`
        );
      }
    }

    if (config.kind === 'website' && (state === 'ready' || state === 'self-hosted')) {
      if (chainIds.length === 0) {
        issues.push(
          `${context}: website State \`${state}\` must inventory at least one catalog entity in Proto UI chain`
        );
      }
      const activeSemanticOwner = chainIds.find(
        (entityId) =>
          /^(?:P|M)-/.test(entityId) && catalogEntries.get(entityId)?.status === 'active'
      );
      if (!activeSemanticOwner) {
        issues.push(
          `${context}: website State ${state} requires an active Prototype or Module semantic owner in Proto UI chain; an Adapter profile alone is insufficient`
        );
      }
    }

    for (const header of config.ownerHeaders) {
      if (!isMeaningful(record[header])) issues.push(`${context}: ${header} must name an owner`);
    }
    if (!isMeaningful(record.Evidence)) {
      issues.push(`${context}: Evidence must name a baseline, executable check, or evidence path`);
    }
    if (config.kind === 'website' && state === 'self-hosted') {
      const promotedImplementationPaths = repositoryPathsFromMatrixPath(record.Path).filter(
        (repositoryPath) => repositoryPath.startsWith('apps/www/')
      );
      if (promotedImplementationPaths.length === 0) {
        issues.push(
          `${context}: self-hosted rows must bind at least one exact apps/www implementation path in Path`
        );
      }
      const evidencePaths = explicitRepositoryPaths(record.Evidence).filter((repositoryPath) =>
        repositoryPath.startsWith(SELF_HOSTED_WEBSITE_EVIDENCE_ROOT)
      );
      if (evidencePaths.length === 0) {
        issues.push(
          `${context}: self-hosted rows must bind an exact internal/website/evidence/** path in Evidence`
        );
      }
      for (const repositoryPath of evidencePaths) {
        const absoluteEvidencePath = path.resolve(rootDir, repositoryPath);
        const retainedEvidencePath = canonicalFileWithinRoot(rootDir, repositoryPath);
        if (!retainedEvidencePath) {
          if (!fs.existsSync(absoluteEvidencePath)) {
            issues.push(`${context}: self-hosted evidence path does not exist: ${repositoryPath}`);
          } else {
            issues.push(
              `${context}: self-hosted evidence path must resolve within internal/website/evidence/**: ${repositoryPath}`
            );
          }
          continue;
        }
        const evidenceRecord = fs.readFileSync(retainedEvidencePath, 'utf8');
        requireMeaningfulLabels(
          evidenceRecord,
          SELF_HOSTED_WEBSITE_RECORD_LABELS,
          `${context} self-hosted evidence record ${repositoryPath}`,
          issues
        );
        const evidenceContext = `${context} self-hosted evidence record ${repositoryPath}`;
        const evidenceCommit = evidenceRecord.match(/\bCommit:\s*([^\r\n;|]*)/i)?.[1].trim();
        if (evidenceCommit && !/^[0-9a-f]{40}$/i.test(evidenceCommit)) {
          issues.push(`${evidenceContext} must bind Commit to an exact 40-character Git SHA`);
        }
        const commitMetadata = evidenceCommitMetadata(
          rootDir,
          evidenceCommit,
          'self-hosted',
          evidenceContext,
          issues,
          promotionContext,
          promotedImplementationPaths
        );
        validateSelfHostedWebsiteEvidenceRecord(
          evidenceRecord,
          evidenceContext,
          rootDir,
          issues,
          record
        );
        validateEvidenceResultsManifest({
          rootDir,
          record: evidenceRecord,
          recordLabels: SELF_HOSTED_WEBSITE_RECORD_LABELS,
          artifactLabels: ['Build:', 'Browser:', 'Accessibility:', 'Screenshot:', 'Multi-frame:'],
          evidenceRootRelative: SELF_HOSTED_WEBSITE_EVIDENCE_ROOT,
          commitMetadata,
          evidenceKind: 'self-hosted',
          context: evidenceContext,
          issues,
        });
      }
    }
    if (config.kind === 'agent-harness' && state === 'dogfooded') {
      const removedChainEntities = chainIds.filter(
        (entityId) => catalogEntries.get(entityId)?.status === 'removed'
      );
      if (removedChainEntities.length > 0) {
        issues.push(
          `${context}: dogfooded rows must not consume removed catalog entities: ${removedChainEntities
            .map((entityId) => `\`${entityId}\``)
            .join(', ')}`
        );
      }
      const implementationPaths = repositoryPathsFromMatrixPath(record.Path);
      if (implementationPaths.length === 0) {
        issues.push(
          `${context}: dogfooded rows must bind at least one exact repository implementation path in Path`
        );
      }
      for (const repositoryPath of implementationPaths) {
        const absoluteImplementationPath = path.resolve(rootDir, repositoryPath);
        if (!fs.existsSync(absoluteImplementationPath)) {
          issues.push(
            `${context}: dogfooded implementation path does not exist: ${repositoryPath}`
          );
        } else if (!fs.statSync(absoluteImplementationPath).isFile()) {
          issues.push(
            `${context}: dogfooded implementation path must be a file: ${repositoryPath}`
          );
        } else if (
          repositoryPath.startsWith('apps/agent-harness/') &&
          !canonicalFileWithinRoot(rootDir, repositoryPath, 'apps/agent-harness/')
        ) {
          issues.push(
            `${context}: dogfooded implementation path must resolve within apps/agent-harness/**: ${repositoryPath}`
          );
        }
      }
      const harnessImplementationPaths = implementationPaths.filter(
        (repositoryPath) =>
          repositoryPath.startsWith('apps/agent-harness/') &&
          canonicalFileWithinRoot(rootDir, repositoryPath, 'apps/agent-harness/')
      );
      if (harnessImplementationPaths.length === 0) {
        issues.push(
          `${context}: dogfooded rows must bind at least one existing implementation file under apps/agent-harness/`
        );
      }
      const evidencePaths = explicitRepositoryPaths(record.Evidence).filter((repositoryPath) =>
        repositoryPath.startsWith('internal/agent-harness/evidence/')
      );
      if (evidencePaths.length === 0) {
        issues.push(
          `${context}: dogfooded rows must bind an exact internal/agent-harness/evidence/** path in Evidence`
        );
      }
      let evidenceRecordFound = false;
      for (const repositoryPath of evidencePaths) {
        const absoluteEvidencePath = path.resolve(rootDir, repositoryPath);
        const retainedEvidencePath = canonicalFileWithinRoot(
          rootDir,
          repositoryPath,
          'internal/agent-harness/evidence/'
        );
        if (!retainedEvidencePath) {
          if (!fs.existsSync(absoluteEvidencePath)) {
            issues.push(`${context}: dogfooded evidence path does not exist: ${repositoryPath}`);
          } else {
            issues.push(
              `${context}: dogfooded evidence path must resolve within internal/agent-harness/evidence/**: ${repositoryPath}`
            );
          }
          continue;
        }
        const evidenceRecord = fs.readFileSync(retainedEvidencePath, 'utf8');
        const hasAnyRecordLabel = DOGFOODED_RECORD_LABELS.some((label) =>
          new RegExp(`\\b${escapeRegularExpression(label)}`, 'iu').test(evidenceRecord)
        );
        if (!hasAnyRecordLabel) continue;
        evidenceRecordFound = true;
        requireMeaningfulLabels(
          evidenceRecord,
          DOGFOODED_RECORD_LABELS,
          `${context} dogfooded evidence record ${repositoryPath}`,
          issues
        );
        const evidenceContext = `${context} dogfooded evidence record ${repositoryPath}`;
        const evidenceCommit = evidenceRecord.match(/\bCommit:\s*([^\r\n;|]*)/i)?.[1].trim();
        if (evidenceCommit && !/^[0-9a-f]{40}$/i.test(evidenceCommit)) {
          issues.push(`${evidenceContext} must bind Commit to an exact 40-character Git SHA`);
        }
        const commitMetadata = evidenceCommitMetadata(
          rootDir,
          evidenceCommit,
          'dogfooded',
          evidenceContext,
          issues,
          promotionContext,
          harnessImplementationPaths
        );
        validateDogfoodedRetainedEvidenceArtifacts(
          evidenceRecord,
          evidenceContext,
          rootDir,
          issues
        );
        validateEvidenceResultsManifest({
          rootDir,
          record: evidenceRecord,
          recordLabels: DOGFOODED_RECORD_LABELS,
          artifactLabels: DOGFOODED_EVIDENCE_LABELS,
          evidenceRootRelative: 'internal/agent-harness/evidence/',
          commitMetadata,
          evidenceKind: 'dogfooded',
          context: evidenceContext,
          issues,
        });
      }
      if (!evidenceRecordFound) {
        issues.push(
          `${context}: dogfooded rows must bind one evidence record with all required labels`
        );
      }
      validateDogfoodedMatrixEvidenceArtifacts(record, context, rootDir, issues);
      requireMeaningfulLabels(record.Evidence, DOGFOODED_EVIDENCE_LABELS, context, issues);
    }

    if (
      (state === 'blocked' || state === 'research') &&
      !includesIssue(record['Dependency and owner'])
    ) {
      issues.push(
        `${context}: ${state} rows must link a dependency as #<issue> in Dependency and owner`
      );
    }
    if (
      (state === 'blocked' || state === 'research') &&
      !includesConcreteOwnerLabel(record['Dependency and owner'])
    ) {
      issues.push(
        `${context}: ${state} rows must give the \`owner:\` or \`owners:\` label a concrete value in Dependency and owner`
      );
    }
    const dependencyCell = record['Dependency and owner'];
    const dependencyOwner = normalizedOwnerToken(dependencyCell);
    const seenDependencyIssues = new Set();
    for (const binding of issueBindings(dependencyCell)) {
      const canonicalIssueUrl = `https://github.com/Proto-UI/Proto-UI/issues/${binding.number}`;
      if (seenDependencyIssues.has(binding.number)) {
        issues.push(`${context}: dependency issue #${binding.number} is bound more than once`);
        continue;
      }
      seenDependencyIssues.add(binding.number);
      if (binding.linkedUrl && binding.linkedUrl !== canonicalIssueUrl) {
        issues.push(
          `${context}: dependency issue #${binding.number} must use the canonical Proto-UI/Proto-UI Issue URL`
        );
      }
      const governanceIssue = governanceSnapshot.issues.get(binding.number);
      if (!governanceIssue) {
        issues.push(
          `${context}: dependency issue #${binding.number} is absent from the Proto-UI/Proto-UI governance snapshot`
        );
        continue;
      }
      if (governanceIssue.url !== canonicalIssueUrl) {
        issues.push(
          `${context}: dependency issue #${binding.number} snapshot URL is not canonical for Proto-UI/Proto-UI`
        );
      }
      if (governanceIssue.state !== 'OPEN' && (state === 'blocked' || state === 'research')) {
        issues.push(
          `${context}: dependency issue #${binding.number} must be OPEN for a ${state} row; snapshot state is ${governanceIssue.state}/${governanceIssue.stateReason ?? 'NONE'}`
        );
      }
      if (dependencyOwner && !governanceIssue.owners?.includes(dependencyOwner)) {
        issues.push(
          `${context}: dependency owner \`${dependencyOwner}\` is not reviewed for issue #${binding.number}`
        );
      }
    }

    const exemptLike =
      config.exemptTargetClasses.includes(targetClass) || config.exemptStates.includes(state);
    if (
      config.kind === 'website' &&
      (targetClass === 'native/static' || state === 'native/static') &&
      !nonInteractiveEntries.has(id)
    ) {
      issues.push(
        `${context}: native/static website row \`${id}\` must be registered in a non-interactive surface manifest`
      );
    }
    const nonInteractiveExpectation = nonInteractiveEntries.get(id);
    if (
      config.kind === 'website' &&
      nonInteractiveExpectation &&
      (targetClass !== nonInteractiveExpectation.targetClass ||
        state !== nonInteractiveExpectation.state)
    ) {
      issues.push(
        `${context}: non-interactive manifest row \`${id}\` must use Target class \`${nonInteractiveExpectation.targetClass}\` and State \`${nonInteractiveExpectation.state}\``
      );
    }
    const escapeOrExemption = record['Escape or exemption'];
    const reReviewOrRemoval = record['Re-review or removal issue'];
    if (exemptLike) {
      if (!isMeaningful(escapeOrExemption)) {
        issues.push(`${context}: exempt/native rows must state a reason in Escape or exemption`);
      }
      if (!includesConcreteOwnerLabel(record['Dependency and owner'])) {
        issues.push(
          `${context}: exempt/native rows must give the \`owner:\` or \`owners:\` label a concrete value in Dependency and owner`
        );
      }
      if (!includesSubstantiveReasonLabel(escapeOrExemption)) {
        issues.push(
          `${context}: exempt/native rows must give the \`reason:\` label a substantive explanation in Escape or exemption`
        );
      }
      if (!isMeaningful(reReviewOrRemoval)) {
        issues.push(
          `${context}: exempt/native rows must state a re-review trigger in Re-review or removal issue`
        );
      }
      if (!includesIssue(reReviewOrRemoval)) {
        issues.push(`${context}: exempt/native rows must link re-review or removal as #<issue>`);
      }
      if (!includesBoundedLimitOrTrigger(escapeOrExemption, reReviewOrRemoval)) {
        issues.push(
          `${context}: exempt/native rows must state a bounded \`limit:\` or conditional trigger`
        );
      }
    } else if (isMeaningful(escapeOrExemption) && !includesIssue(reReviewOrRemoval)) {
      issues.push(`${context}: temporary escapes must link their removal as #<issue>`);
    }
    const seenReReviewIssues = new Set();
    for (const binding of issueBindings(reReviewOrRemoval)) {
      const canonicalIssueUrl = `https://github.com/Proto-UI/Proto-UI/issues/${binding.number}`;
      if (seenReReviewIssues.has(binding.number)) {
        issues.push(`${context}: re-review issue #${binding.number} is bound more than once`);
        continue;
      }
      seenReReviewIssues.add(binding.number);
      if (binding.linkedUrl && binding.linkedUrl !== canonicalIssueUrl) {
        issues.push(
          `${context}: re-review issue #${binding.number} must use the canonical Proto-UI/Proto-UI Issue URL`
        );
      }
      const governanceIssue = governanceSnapshot.issues.get(binding.number);
      if (!governanceIssue) {
        issues.push(
          `${context}: re-review issue #${binding.number} is absent from the Proto-UI/Proto-UI governance snapshot`
        );
        continue;
      }
      if (governanceIssue.state !== 'OPEN') {
        issues.push(
          `${context}: re-review issue #${binding.number} must be OPEN; snapshot state is ${governanceIssue.state}/${governanceIssue.stateReason ?? 'NONE'}`
        );
      }
    }

    if (config.kind === 'website') {
      requireMeaningfulLabels(
        record['WC host and SSR/no-JS strategy'],
        ['WC:', 'SSR:', 'no-JS:'],
        `${context}: WC host and SSR/no-JS strategy`,
        issues
      );
    } else {
      requireMeaningfulLabels(
        record['App state and semantic events'],
        ['App state:', 'Events:'],
        `${context}: App state and semantic events`,
        issues
      );
      requireMeaningfulLabels(
        record['Production host and equivalence evidence'],
        ['Host:', 'WC:', 'React:', 'Vue:'],
        `${context}: Production host and equivalence evidence`,
        issues
      );
    }
  }

  const manifestedIds = new Map([
    ...(config.inheritedSurfaceManifests ?? []).flatMap((manifest) =>
      manifest.ids.map((id) => [id, `inherited manifest ${manifest.source}`])
    ),
    ...(config.nonInteractiveSurfaceManifests ?? []).flatMap((manifest) =>
      manifest.entries.map((entry) => [entry.id, `non-interactive manifest ${manifest.source}`])
    ),
  ]);
  for (const requiredId of new Set([
    ...(config.requiredIds ?? []),
    ...Object.keys(config.requiredCatalogIdsByRow ?? {}),
    ...Object.keys(config.requiredRepositoryPathsByRow ?? {}),
    ...manifestedIds.keys(),
  ])) {
    if (!seenIds.has(requiredId)) {
      const manifestSource = manifestedIds.has(requiredId)
        ? ` from ${manifestedIds.get(requiredId)}`
        : '';
      issues.push(
        `${relativePath}: required inventory surface ID \`${requiredId}\` is missing${manifestSource}`
      );
    }
  }

  return { stateCounts, targetClassCounts, seenIds, sourceOwners, rowDispositions };
}

function parseSourceBindings(lines, afterIndex, relativePath, issues) {
  const headingIndexes = findExactLineIndexes(lines, '## Source-scan bindings').filter(
    (index) => index > afterIndex
  );
  if (headingIndexes.length === 0) return new Map();
  if (headingIndexes.length !== 1) {
    issues.push(
      `${relativePath}: expected at most one \`## Source-scan bindings\` heading after ${END_MARKER}; found ${headingIndexes.length}`
    );
    return new Map();
  }

  const headingIndex = headingIndexes[0];
  const nextHeadingOffset = lines
    .slice(headingIndex + 1)
    .findIndex((line) => /^#{1,6}\s+/.test(line.trim()));
  const tableEnd = nextHeadingOffset === -1 ? lines.length : headingIndex + 1 + nextHeadingOffset;
  const table = parseTable(
    lines,
    headingIndex + 1,
    tableEnd,
    ['Interactive or integration source', 'Owning matrix row', 'Source SHA-256'],
    `${relativePath} Source-scan bindings`,
    issues,
    { requireContiguous: true }
  );
  const bindings = new Map();
  if (!table) return bindings;

  for (const row of table.rows) {
    const context = `${relativePath}:${row.line}`;
    const sourcePaths = explicitRepositoryPaths(row.cells[0]);
    const sourcePath = sourcePaths[0];
    const isWebsiteSource = sourcePath?.startsWith('apps/www/src/');
    const isPublicExecutable =
      sourcePath?.startsWith('apps/www/public/') &&
      /\.(?:cjs|html?|js|mjs|svg)$/iu.test(sourcePath);
    if (sourcePaths.length !== 1 || (!isWebsiteSource && !isPublicExecutable)) {
      issues.push(
        `${context}: source binding must name exactly one \`apps/www/src/**\` path or executable \`apps/www/public/**/*.{html,js,mjs,cjs,svg}\` path`
      );
      continue;
    }
    if (bindings.has(sourcePath)) {
      issues.push(
        `${context}: duplicate source binding for \`${sourcePath}\` (first declared on line ${bindings.get(sourcePath).line})`
      );
      continue;
    }
    const digest = stripInlineCode(row.cells[2]);
    if (!/^[0-9a-f]{64}$/u.test(digest)) {
      issues.push(`${context}: source binding must retain a lowercase SHA-256 source fingerprint`);
      continue;
    }
    const ownerIds = [...row.cells[1].matchAll(/`(www\.[a-z0-9.-]+)`/g)].map((match) => match[1]);
    if (ownerIds.length === 0) {
      issues.push(`${context}: source binding must name at least one owning matrix row ID`);
      continue;
    }
    bindings.set(sourcePath, { digest, line: row.line, ownerIds: [...new Set(ownerIds)] });
  }
  return bindings;
}

function validateWebsiteSourceBindings(
  rootDir,
  relativePath,
  lines,
  afterIndex,
  matrixResult,
  issues
) {
  const bindings = parseSourceBindings(lines, afterIndex, relativePath, issues);
  for (const [sourcePath, binding] of bindings) {
    const absolutePath = path.resolve(rootDir, sourcePath);
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      issues.push(
        `${relativePath}:${binding.line}: source binding references missing path \`${sourcePath}\``
      );
      continue;
    }
    if (sourceScanDigest(absolutePath) !== binding.digest) {
      issues.push(
        `${relativePath}:${binding.line}: source fingerprint for \`${sourcePath}\` does not match its reviewed SHA-256`
      );
    }
  }
  const interactiveSources = new Set(discoverWebsiteInteractiveSources(rootDir));
  for (const sourcePath of interactiveSources) {
    if (!bindings.has(sourcePath)) {
      issues.push(
        `${relativePath}: interactive website source \`${sourcePath}\` is missing a reviewed Source-scan binding and fingerprint`
      );
    }
  }
  for (const binding of bindings.values()) {
    for (const ownerId of binding.ownerIds) {
      if (!matrixResult.seenIds.has(ownerId)) {
        issues.push(
          `${relativePath}:${binding.line}: source binding references missing matrix row \`${ownerId}\``
        );
      }
    }
  }

  for (const sourcePath of discoverWebsiteComponentSources(rootDir)) {
    const directOwners = matrixResult.sourceOwners.get(sourcePath) ?? [];
    const binding = bindings.get(sourcePath);
    if (directOwners.length === 0 && !binding) {
      issues.push(
        `${relativePath}: website component source \`${sourcePath}\` is not classified by a matrix row`
      );
      continue;
    }
    if (directOwners.length === 1 && binding) {
      const directId = directOwners[0].id;
      const boundIds = [...new Set(binding.ownerIds)].sort();
      if (!boundIds.includes(directId)) {
        issues.push(
          `${relativePath}:${binding.line}: website component source \`${sourcePath}\` has direct matrix owner \`${directId}\` outside source binding owner(s) ${boundIds.map((id) => `\`${id}\``).join(', ')}; include the direct owner in the grouped binding`
        );
      }
    }
    if (directOwners.length > 1) {
      const directIds = [...new Set(directOwners.map(({ id }) => id))].sort();
      if (!binding) {
        issues.push(
          `${relativePath}: website component source \`${sourcePath}\` appears in multiple matrix Path cells (${directIds.join(', ')}); add one explicit grouped binding naming exactly those rows`
        );
        continue;
      }
      const boundIds = [...binding.ownerIds].sort();
      if (
        directIds.length !== boundIds.length ||
        directIds.some((ownerId, index) => ownerId !== boundIds[index])
      ) {
        issues.push(
          `${relativePath}:${binding.line}: grouped binding for component \`${sourcePath}\` must name exactly the matrix Path owners (${directIds.join(', ')})`
        );
      }
    }
  }

  for (const sourcePath of interactiveSources) {
    const directOwners = matrixResult.sourceOwners.get(sourcePath) ?? [];
    const binding = bindings.get(sourcePath);
    if (directOwners.length === 0 && !binding) {
      issues.push(
        `${relativePath}: interactive website source \`${sourcePath}\` is not bound to a matrix row`
      );
      continue;
    }

    const directIds = [...new Set(directOwners.map(({ id }) => id))];
    const effectiveOwnerIds = binding?.ownerIds ?? directIds;
    const hasNonNativeOwner = effectiveOwnerIds.some((ownerId) => {
      const disposition = matrixResult.rowDispositions.get(ownerId);
      return (
        disposition &&
        (disposition.targetClass !== 'native/static' || disposition.state !== 'native/static')
      );
    });
    const hasNativeDirectOwner = directIds.some((ownerId) => {
      const disposition = matrixResult.rowDispositions.get(ownerId);
      return disposition?.targetClass === 'native/static' && disposition.state === 'native/static';
    });
    if ((hasNativeDirectOwner || directOwners.length === 0) && !hasNonNativeOwner) {
      issues.push(
        `${relativePath}: interactive website source \`${sourcePath}\` is owned only by native/static rows; bind it to the non-native interaction owner or reclassify the surface`
      );
      continue;
    }

    if (directOwners.length === 1 && binding && !binding.ownerIds.includes(directOwners[0].id)) {
      issues.push(
        `${relativePath}:${binding.line}: grouped binding for \`${sourcePath}\` must include direct matrix Path owner \`${directOwners[0].id}\``
      );
    }

    if (directOwners.length > 1) {
      if (!binding) {
        const directSummary = directOwners.map(({ id }) => `\`${id}\``).join(', ');
        issues.push(
          `${relativePath}: interactive website source \`${sourcePath}\` appears in multiple matrix Path cells (${directSummary}); add one explicit grouped binding naming exactly those rows`
        );
        continue;
      }
      directIds.sort();
      const boundIds = [...binding.ownerIds].sort();
      if (
        directIds.length !== boundIds.length ||
        directIds.some((ownerId, index) => ownerId !== boundIds[index])
      ) {
        issues.push(
          `${relativePath}:${binding.line}: grouped binding for \`${sourcePath}\` must name exactly the matrix Path owners (${directIds.join(', ')})`
        );
      }
    }
  }
}

function parseHarnessSourceBindings(lines, afterIndex, relativePath, issues) {
  const headingIndexes = findExactLineIndexes(lines, '## Source-scan bindings').filter(
    (index) => index > afterIndex
  );
  if (headingIndexes.length === 0) return new Map();
  if (headingIndexes.length !== 1) {
    issues.push(
      `${relativePath}: expected at most one \`## Source-scan bindings\` heading after ${END_MARKER}; found ${headingIndexes.length}`
    );
    return new Map();
  }

  const headingIndex = headingIndexes[0];
  const nextHeadingOffset = lines
    .slice(headingIndex + 1)
    .findIndex((line) => /^#{1,6}\s+/.test(line.trim()));
  const tableEnd = nextHeadingOffset === -1 ? lines.length : headingIndex + 1 + nextHeadingOffset;
  const table = parseTable(
    lines,
    headingIndex + 1,
    tableEnd,
    ['Interactive or integration source', 'Owning matrix row'],
    `${relativePath} Source-scan bindings`,
    issues,
    { requireContiguous: true }
  );
  const bindings = new Map();
  if (!table) return bindings;

  for (const row of table.rows) {
    const context = `${relativePath}:${row.line}`;
    const sourcePaths = explicitRepositoryPaths(row.cells[0]);
    if (sourcePaths.length !== 1 || !sourcePaths[0].startsWith('apps/agent-harness/src/')) {
      issues.push(
        `${context}: source binding must name exactly one \`apps/agent-harness/src/**\` path`
      );
      continue;
    }
    const sourcePath = sourcePaths[0];
    if (bindings.has(sourcePath)) {
      issues.push(
        `${context}: duplicate source binding for \`${sourcePath}\` (first declared on line ${bindings.get(sourcePath).line})`
      );
      continue;
    }
    const ownerIds = [...row.cells[1].matchAll(/`(harness\.[a-z0-9.-]+)`/g)].map(
      (match) => match[1]
    );
    if (ownerIds.length === 0) {
      issues.push(`${context}: source binding must name at least one owning matrix row ID`);
      continue;
    }
    bindings.set(sourcePath, { line: row.line, ownerIds: [...new Set(ownerIds)] });
  }
  return bindings;
}

function validateHarnessSourceBindings(
  rootDir,
  relativePath,
  lines,
  afterIndex,
  matrixResult,
  issues
) {
  const bindings = parseHarnessSourceBindings(lines, afterIndex, relativePath, issues);
  for (const [sourcePath, binding] of bindings) {
    if (!fs.existsSync(path.resolve(rootDir, sourcePath))) {
      issues.push(
        `${relativePath}:${binding.line}: source binding references missing path \`${sourcePath}\``
      );
    }
    for (const ownerId of binding.ownerIds) {
      if (!matrixResult.seenIds.has(ownerId)) {
        issues.push(
          `${relativePath}:${binding.line}: source binding references missing matrix row \`${ownerId}\``
        );
      }
    }
  }

  for (const sourcePath of discoverHarnessUserFacingSources(rootDir)) {
    const directOwners = matrixResult.sourceOwners.get(sourcePath) ?? [];
    const directIds = [...new Set(directOwners.map(({ id }) => id))].sort();
    const binding = bindings.get(sourcePath);
    if (directIds.length === 0 && !binding) {
      issues.push(
        `${relativePath}: Harness user-facing source \`${sourcePath}\` is not classified by a matrix row or Source-scan binding`
      );
      continue;
    }
    const surfaceCount = countHarnessExportedUserFacingSurfaces(
      fs.readFileSync(path.resolve(rootDir, sourcePath), 'utf8'),
      path.resolve(rootDir, sourcePath)
    );
    const effectiveOwnerCount = new Set([...directIds, ...(binding?.ownerIds ?? [])]).size;
    if (surfaceCount > effectiveOwnerCount) {
      issues.push(
        `${relativePath}: Harness user-facing source \`${sourcePath}\` exposes ${surfaceCount} exported surfaces but has only ${effectiveOwnerCount} distinct matrix owner${effectiveOwnerCount === 1 ? '' : 's'}`
      );
    }
    if (directIds.length === 1 && binding) {
      issues.push(
        `${relativePath}:${binding.line}: Harness user-facing source \`${sourcePath}\` is already owned by matrix row \`${directIds[0]}\`; use the direct Path or the explicit binding, not both`
      );
      continue;
    }
    if (directIds.length > 1) {
      if (!binding) {
        issues.push(
          `${relativePath}: Harness user-facing source \`${sourcePath}\` appears in multiple matrix Path cells (${directIds.join(', ')}); add one explicit grouped binding naming exactly those rows`
        );
        continue;
      }
      const boundIds = [...binding.ownerIds].sort();
      if (
        directIds.length !== boundIds.length ||
        directIds.some((ownerId, index) => ownerId !== boundIds[index])
      ) {
        issues.push(
          `${relativePath}:${binding.line}: grouped binding for Harness source \`${sourcePath}\` must name exactly the matrix Path owners (${directIds.join(', ')})`
        );
      }
    }
  }

  for (const sourcePath of discoverHarnessForbiddenStateMachineSources(rootDir)) {
    const directOwnerIds = (matrixResult.sourceOwners.get(sourcePath) ?? []).map(({ id }) => id);
    const boundOwnerIds = bindings.get(sourcePath)?.ownerIds ?? [];
    const ownerIds = [...new Set([...directOwnerIds, ...boundOwnerIds])].sort();
    const hasExactInfrastructureDisposition =
      ownerIds.length > 0 &&
      ownerIds.every((ownerId) => {
        const disposition = matrixResult.rowDispositions.get(ownerId);
        const exactLimit = labeledValue(disposition?.escapeOrExemption ?? '', 'limit');
        return (
          disposition?.targetClass === 'infrastructure-exempt' &&
          disposition?.state === 'infrastructure-exempt' &&
          disposition.sourcePaths.includes(sourcePath) &&
          exactLimit !== undefined &&
          ((disposition.sourcePaths.length === 1 &&
            /\bthis exact (?:source|file)\b/iu.test(exactLimit)) ||
            repositoryPathsFromMatrixPath(exactLimit).includes(sourcePath))
        );
      });
    if (!hasExactInfrastructureDisposition) {
      const dispositionSummary =
        ownerIds.length === 0
          ? 'no matrix owner'
          : ownerIds
              .map((ownerId) => {
                const disposition = matrixResult.rowDispositions.get(ownerId);
                return `${ownerId} (${disposition?.targetClass ?? 'missing'}/${disposition?.state ?? 'missing'})`;
              })
              .join(', ');
      issues.push(
        `${relativePath}: Harness source \`${sourcePath}\` contains a forbidden interaction or DOM state machine; only an exact infrastructure-exempt/infrastructure-exempt matrix disposition is permitted (received ${dispositionSummary})`
      );
    }
  }
}

function validateTotals(config, lines, afterIndex, actualCounts, relativePath, issues) {
  const totalHeadingIndexes = findExactLineIndexes(lines, '## State totals').filter(
    (index) => index > afterIndex
  );
  if (totalHeadingIndexes.length !== 1) {
    issues.push(
      `${relativePath}: expected exactly one \`## State totals\` heading after ${END_MARKER}; found ${totalHeadingIndexes.length}`
    );
    return;
  }

  const headingIndex = totalHeadingIndexes[0];
  const nextHeadingOffset = lines
    .slice(headingIndex + 1)
    .findIndex((line) => /^#{1,6}\s+/.test(line.trim()));
  const tableEnd = nextHeadingOffset === -1 ? lines.length : headingIndex + 1 + nextHeadingOffset;
  const totalsTable = parseTable(
    lines,
    headingIndex + 1,
    tableEnd,
    TOTAL_HEADERS,
    `${relativePath} State totals`,
    issues
  );
  if (!totalsTable) return;

  const declaredCounts = new Map();
  let declaredTotal = null;
  for (const row of totalsTable.rows) {
    const [rawState, rawCount] = row.cells;
    const state = stripInlineCode(rawState);
    const context = `${relativePath}:${row.line}`;
    if (state === 'Total') {
      if (declaredTotal !== null) {
        issues.push(`${context}: duplicate totals row for \`Total\``);
        continue;
      }
      if (!/^\d+$/.test(rawCount.trim())) {
        issues.push(`${context}: Count must be a non-negative integer, received \`${rawCount}\``);
        continue;
      }
      declaredTotal = Number.parseInt(rawCount, 10);
      continue;
    }
    if (!config.allowedStates.includes(state)) {
      issues.push(
        `${context}: unsupported totals State \`${state}\`; allowed: ${config.allowedStates.join(', ')}`
      );
      continue;
    }
    if (declaredCounts.has(state)) {
      issues.push(`${context}: duplicate totals row for State \`${state}\``);
      continue;
    }
    if (!/^\d+$/.test(rawCount.trim())) {
      issues.push(`${context}: Count must be a non-negative integer, received \`${rawCount}\``);
      continue;
    }
    declaredCounts.set(state, Number.parseInt(rawCount, 10));
  }

  for (const state of config.allowedStates) {
    if (!declaredCounts.has(state)) {
      issues.push(`${relativePath}: State totals is missing \`${state}\``);
      continue;
    }
    const declared = declaredCounts.get(state);
    const actual = actualCounts.get(state) ?? 0;
    if (declared !== actual) {
      issues.push(
        `${relativePath}: State totals declares ${state}=${declared}, but the matrix contains ${actual}`
      );
    }
  }

  if (declaredTotal !== null) {
    const actualTotal = [...actualCounts.values()].reduce((sum, count) => sum + count, 0);
    if (declaredTotal !== actualTotal) {
      issues.push(
        `${relativePath}: State totals declares Total=${declaredTotal}, but the matrix contains ${actualTotal} rows`
      );
    }
  }
}

function validateTargetClassTotals(config, lines, afterIndex, actualCounts, relativePath, issues) {
  const headingIndexes = findExactLineIndexes(lines, '## Target-class totals').filter(
    (index) => index > afterIndex
  );
  if (headingIndexes.length !== 1) {
    issues.push(
      `${relativePath}: expected exactly one \`## Target-class totals\` heading after ${END_MARKER}; found ${headingIndexes.length}`
    );
    return;
  }

  const headingIndex = headingIndexes[0];
  const nextHeadingOffset = lines
    .slice(headingIndex + 1)
    .findIndex((line) => /^#{1,6}\s+/.test(line.trim()));
  const tableEnd = nextHeadingOffset === -1 ? lines.length : headingIndex + 1 + nextHeadingOffset;
  const totalsTable = parseTable(
    lines,
    headingIndex + 1,
    tableEnd,
    TARGET_CLASS_TOTAL_HEADERS,
    `${relativePath} Target-class totals`,
    issues
  );
  if (!totalsTable) return;

  const declaredCounts = new Map();
  for (const row of totalsTable.rows) {
    const [rawTargetClass, rawCount] = row.cells;
    const targetClass = stripInlineCode(rawTargetClass);
    const context = `${relativePath}:${row.line}`;
    if (!config.allowedTargetClasses.includes(targetClass)) {
      issues.push(
        `${context}: unsupported totals Target class \`${targetClass}\`; allowed: ${config.allowedTargetClasses.join(', ')}`
      );
      continue;
    }
    if (declaredCounts.has(targetClass)) {
      issues.push(`${context}: duplicate totals row for Target class \`${targetClass}\``);
      continue;
    }
    if (!/^\d+$/.test(rawCount.trim())) {
      issues.push(`${context}: Count must be a non-negative integer, received \`${rawCount}\``);
      continue;
    }
    declaredCounts.set(targetClass, Number.parseInt(rawCount, 10));
  }

  for (const targetClass of config.allowedTargetClasses) {
    if (!declaredCounts.has(targetClass)) {
      issues.push(`${relativePath}: Target-class totals is missing \`${targetClass}\``);
      continue;
    }
    const declared = declaredCounts.get(targetClass);
    const actual = actualCounts.get(targetClass) ?? 0;
    if (declared !== actual) {
      issues.push(
        `${relativePath}: Target-class totals declares ${targetClass}=${declared}, but the matrix contains ${actual}`
      );
    }
  }
}

function validateMatrixFile(
  rootDir,
  config,
  catalogEntries,
  governanceSnapshot,
  promotionContext,
  issues
) {
  validateInheritedDependencyVersions(rootDir, config, issues);
  const absolutePath = path.join(rootDir, config.relativePath);
  if (!fs.existsSync(absolutePath)) {
    issues.push(
      `${config.relativePath}: file is missing; create it with ${config.startMarker}, the exact matrix table, ${END_MARKER}, and a ## State totals table`
    );
    return;
  }
  const governedSourceRoots =
    config.kind === 'website'
      ? [
          ['apps/www/src', 'Website source'],
          ['apps/www/public', 'Website public source'],
        ]
      : [['apps/agent-harness/src', 'Harness source']];
  for (const [sourceRootRelative, label] of governedSourceRoots) {
    const sourceRoot = path.resolve(rootDir, sourceRootRelative);
    if (fs.existsSync(sourceRoot)) {
      walkFiles(sourceRoot, {
        boundary: sourceRoot,
        issues,
        label,
        rootDir,
      });
    }
  }

  const content = fs.readFileSync(absolutePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const starts = findExactLineIndexes(lines, config.startMarker);
  const ends = findExactLineIndexes(lines, END_MARKER);
  if (starts.length !== 1) {
    issues.push(
      `${config.relativePath}: expected exactly one ${config.startMarker}; found ${starts.length}`
    );
    return;
  }
  const endIndexes = ends.filter((index) => index > starts[0]);
  if (endIndexes.length !== 1) {
    issues.push(
      `${config.relativePath}: expected exactly one ${END_MARKER} after ${config.startMarker}; found ${endIndexes.length}`
    );
    return;
  }

  const endIndex = endIndexes[0];
  const table = parseTable(
    lines,
    starts[0] + 1,
    endIndex,
    config.headers,
    `${config.relativePath} ${config.kind} matrix`,
    issues,
    { requireContiguous: true }
  );
  const matrixResult = validateMainRows(
    config,
    table,
    config.relativePath,
    rootDir,
    catalogEntries,
    governanceSnapshot,
    promotionContext,
    issues
  );
  validateTotals(config, lines, endIndex, matrixResult.stateCounts, config.relativePath, issues);
  if (config.kind === 'agent-harness') {
    validateTargetClassTotals(
      config,
      lines,
      endIndex,
      matrixResult.targetClassCounts,
      config.relativePath,
      issues
    );
    validateHarnessRawImports(rootDir, config.relativePath, issues);
    validateHarnessSourceBindings(
      rootDir,
      config.relativePath,
      lines,
      endIndex,
      matrixResult,
      issues
    );
  } else {
    validateWebsiteRawImports(rootDir, config.relativePath, issues);
    validateWebsiteSourceBindings(
      rootDir,
      config.relativePath,
      lines,
      endIndex,
      matrixResult,
      issues
    );
  }
}

export function collectCoverageMatrixIssues({
  rootDir = process.cwd(),
  baseRevision = null,
  headRevision = null,
  mergeRevision = null,
} = {}) {
  const issues = [];
  const catalogEntries = loadCatalogEntries(rootDir, issues);
  const governanceSnapshot = loadGovernanceSnapshot(rootDir, issues);
  const promotionContext = { baseRevision, headRevision, mergeRevision };
  for (const config of MATRIX_CONFIGS) {
    validateMatrixFile(
      rootDir,
      config,
      catalogEntries,
      governanceSnapshot,
      promotionContext,
      issues
    );
  }
  return issues;
}

export function validateCoverageMatrices(options = {}) {
  const issues = collectCoverageMatrixIssues(options);
  if (issues.length > 0) throw new CoverageMatrixValidationError(issues);
  return { matrixCount: MATRIX_CONFIGS.length };
}

function isMainModule() {
  if (!process.argv[1]) return false;
  return pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
}

if (isMainModule()) {
  try {
    const checkoutRevision = gitOutput(process.cwd(), ['rev-parse', 'HEAD']);
    const result = validateCoverageMatrices({
      baseRevision: process.env.COVERAGE_BASE_REVISION ?? checkoutRevision,
      headRevision: process.env.COVERAGE_HEAD_REVISION ?? checkoutRevision,
      mergeRevision: process.env.COVERAGE_MERGE_REVISION ?? null,
    });
    console.log(`[coverage-matrices] OK (${result.matrixCount} matrices)`);
  } catch (error) {
    if (error instanceof CoverageMatrixValidationError) {
      console.error(`[coverage-matrices] ${error.message}`);
      process.exitCode = 1;
    } else {
      throw error;
    }
  }
}
