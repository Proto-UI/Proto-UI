import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { specEntitySchema } from '@proto.ui/spec-schema';
import ts from 'typescript';
import { parse as parseYaml } from 'yaml';

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

// Lowercase inline HTML handlers must be real DOM event attributes. Camel-cased
// JSX component callbacks remain open-ended because application components can
// define their own `onXxx` semantic events.
const NATIVE_EVENT_ATTRIBUTE_NAMES = collectNativeEventAttributeNames();
const GOVERNED_DOM_STATE_PROPERTY_NAMES = new Set([
  ...collectAriaReflectionPropertyNames(),
  'scrollLeft',
  'scrollTop',
  'selectionDirection',
  'selectionEnd',
  'selectionStart',
  'value',
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
  }),
  'apps/www/src/components/PrototypePreviewer/runtimes/vue-runtime.ts': Object.freeze({
    specifiers: Object.freeze(['@proto.ui/adapter-vue']),
  }),
  'apps/www/src/components/PrototypePreviewer/runtimes/vue2-runtime.ts': Object.freeze({
    specifiers: Object.freeze(['@proto.ui/adapter-vue2']),
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
  return /(^|\D)#\d+\b/.test(value);
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
    destructuredProperties = []
  ) => {
    if (ts.isIdentifier(name)) {
      addBinding(
        name.text,
        node,
        initializer,
        intrinsicallyDom,
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
        destructuredProperties.concat(property.text)
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
            /^(?:el|element)$/u.test(node.name.text))
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
  const receiverBindings = { isIdentifierDomCollection, isIdentifierDomReceiver };
  return receiverBindings;
}

function isDomAcquisitionCall(expression, sourceFile, receiverBindings, useNode, visitedBindings) {
  const candidate = unwrapTypeScriptExpression(expression);
  if (!ts.isCallExpression(candidate)) return false;
  const calledMember = staticMemberAccess(candidate.expression);
  if (
    !calledMember ||
    !/^(?:closest|createElement|getElementById|querySelector)$/u.test(calledMember.name)
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
      /^(?:getElementsByClassName|getElementsByName|getElementsByTagName|getElementsByTagNameNS|querySelectorAll)$/u.test(
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
  if (isDomAcquisitionCall(candidate, sourceFile, receiverBindings, useNode, visitedBindings)) {
    return true;
  }
  if (!ts.isPropertyAccessExpression(candidate)) return false;

  const owner = unwrapTypeScriptExpression(candidate.expression);
  if (
    /^(?:body|documentElement|activeElement)$/u.test(candidate.name.text) &&
    ts.isIdentifier(owner) &&
    owner.text === 'document'
  ) {
    return true;
  }
  if (
    /^(?:currentTarget|target)$/u.test(candidate.name.text) &&
    ts.isIdentifier(owner) &&
    /^(?:e|ev|event)$/u.test(owner.text)
  ) {
    return true;
  }
  return (
    candidate.name.text === 'current' &&
    ts.isIdentifier(owner) &&
    /(?:Element|Node|Ref)$/u.test(owner.text)
  );
}

function astContainsInteractiveRuntime(content) {
  const sourceFile = ts.createSourceFile(
    'website-source.tsx',
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const receiverBindings = domReceiverBindings(sourceFile);
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
          method === 'addEventListener' ||
          ((owner === 'customElements' || owner.endsWith('.customElements')) && method === 'define')
        ) {
          found = true;
          return;
        }
        if (
          /^(?:blur|focus|scrollBy|scrollIntoView|scrollTo)$/u.test(method) &&
          isDomReceiverExpression(calledMember.receiver, sourceFile, receiverBindings, node)
        ) {
          found = true;
          return;
        }
        if (
          /^(?:removeAttribute|setAttribute|toggleAttribute)$/u.test(method) &&
          isDomReceiverExpression(calledMember.receiver, sourceFile, receiverBindings, node) &&
          node.arguments.length > 0 &&
          ts.isStringLiteralLike(node.arguments[0]) &&
          /^aria-/u.test(node.arguments[0].text)
        ) {
          found = true;
          return;
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
      const eventProperty =
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken ? assignedProperty?.name : null;
      if (eventProperty && NATIVE_EVENT_ATTRIBUTE_NAMES.has(eventProperty)) {
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
  if (!/\.(?:astro|vue|svelte)$/i.test(absolutePath)) return null;

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
    return /(?:^|\s)(?:@[A-Za-z][\w:-]*|v-on:[A-Za-z][\w:-]*)(?:\.[A-Za-z][\w-]*)*(?=\s|=|\/?\s*>)/u.test(
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

function containsInteractiveSource(content, absolutePath) {
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
  return walkFiles(sourceRoot)
    .filter((absolutePath) => /\.(?:astro|vue|svelte|[cm]?[jt]sx?)$/.test(absolutePath))
    .filter((absolutePath) => !absolutePath.startsWith(`${contentRoot}${path.sep}`))
    .concat(
      walkFiles(contentRoot).filter((absolutePath) =>
        /\.(?:astro|mdx?|vue|svelte)$/i.test(absolutePath)
      )
    )
    .concat(walkFiles(contentRoot).filter((absolutePath) => /\.[cm]?[jt]sx?$/.test(absolutePath)))
    .concat(walkFiles(publicRoot).filter((absolutePath) => /\.[cm]?[jt]sx?$/.test(absolutePath)))
    .filter(
      (absolutePath, index, files) =>
        files.indexOf(absolutePath) === index &&
        !/\.(?:browser\.)?(?:test|spec)\.[cm]?[jt]sx?$/.test(absolutePath)
    )
    .filter((absolutePath) =>
      containsInteractiveSource(sourceTextForInteractionScan(absolutePath), absolutePath)
    )
    .map((absolutePath) => path.relative(rootDir, absolutePath).replaceAll('\\', '/'))
    .sort();
}

function discoverWebsiteComponentSources(rootDir) {
  const websiteSourceRoot = path.join(rootDir, 'apps', 'www', 'src');
  const pagesRoot = path.join(websiteSourceRoot, 'pages');
  return walkFiles(websiteSourceRoot)
    .filter(
      (absolutePath) =>
        !/\.(?:browser\.)?(?:test|spec)\.(?:astro|vue|svelte|[cm]?[jt]sx?)$/i.test(absolutePath)
    )
    .filter((absolutePath) => {
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
  for (const statement of sourceFile.statements) {
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
          containsRenderedSurface(declaration.initializer)
        ) {
          renderedLocalNames.add(declaration.name.text);
        }
      }
    }
  }

  return sourceFile.statements.some((statement) => {
    const directlyExported = statement.modifiers?.some(
      (modifier) =>
        modifier.kind === ts.SyntaxKind.ExportKeyword ||
        modifier.kind === ts.SyntaxKind.DefaultKeyword
    );
    if (directlyExported && containsRenderedSurface(statement)) return true;
    if (ts.isExportAssignment(statement)) {
      return (
        containsRenderedSurface(statement.expression) ||
        (ts.isIdentifier(statement.expression) && renderedLocalNames.has(statement.expression.text))
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
  const isNativeEventName = (name) =>
    /^on[A-Z][A-Za-z0-9_$]*$/u.test(name) || NATIVE_EVENT_ATTRIBUTE_NAMES.has(name);
  const objectLiteralHasNativeEvent = (objectLiteral) =>
    objectLiteral.properties.some((property) => {
      if (
        !ts.isPropertyAssignment(property) &&
        !ts.isMethodDeclaration(property) &&
        !ts.isShorthandPropertyAssignment(property)
      ) {
        return false;
      }
      const name = property.name;
      return (
        (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) && isNativeEventName(name.text)
      );
    });
  const objectBindings = new Map();
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
  const expressionHasNativeEventObject = (expression, useNode, visitedBindings = new Set()) => {
    const candidate = unwrapTypeScriptExpression(expression);
    if (ts.isObjectLiteralExpression(candidate)) return objectLiteralHasNativeEvent(candidate);
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
        return expressionHasNativeEventObject(binding.initializer, binding.node, visitedBindings);
      }
      if (ts.isSourceFile(scope)) break;
    }
    return false;
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

function astContainsHarnessRenderOrEffectAction(content, absolutePath) {
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
  const renderEvaluatedHooks = new Map([
    ['useMemo', 'useMemo'],
    ['useState', 'useState'],
    ['useReducer', 'useReducer'],
    ['useSyncExternalStore', 'useSyncExternalStore'],
  ]);
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
        const importedName = (element.propertyName ?? element.name).text;
        if (/^(?:useEffect|useInsertionEffect|useLayoutEffect)$/u.test(importedName)) {
          effectNames.add(element.name.text);
        }
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
      if (importClause?.name) agentActionOwners.add(importClause.name.text);
      if (importClause?.namedBindings && ts.isNamespaceImport(importClause.namedBindings)) {
        agentActionOwners.add(importClause.namedBindings.name.text);
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
      const importDeclaration = node.parent?.parent?.parent;
      const moduleSpecifier =
        ts.isImportDeclaration(importDeclaration) &&
        ts.isStringLiteralLike(importDeclaration.moduleSpecifier)
          ? importDeclaration.moduleSpecifier.text
          : '';
      if (isAgentActionVerbName(importedName) && hasAgentActionOwnerProvenance(moduleSpecifier)) {
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
      candidate = unwrapTypeScriptExpression(candidate.expression);
    }
    return ts.isIdentifier(candidate) && agentActionOwners.has(candidate.text);
  }
  const isAgentActionExpression = (expression) => {
    const candidate = unwrapTypeScriptExpression(expression);
    if (ts.isIdentifier(candidate)) return agentActionAliases.has(candidate.text);
    if (ts.isPropertyAccessExpression(candidate)) {
      return (
        isAgentActionVerbName(candidate.name.text) &&
        qualifiedActionOwnerHasProvenance(candidate.expression)
      );
    }
    return (
      ts.isElementAccessExpression(candidate) &&
      ts.isStringLiteralLike(candidate.argumentExpression) &&
      isAgentActionVerbName(candidate.argumentExpression.text) &&
      qualifiedActionOwnerHasProvenance(candidate.expression)
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
  const collectCallableBindings = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const initializer = unwrapTypeScriptExpression(node.initializer);
      if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) {
        addCallableBinding(node.name.text, node, initializer, false);
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
      if (node !== executionRoot && ts.isFunctionLike(node)) return;
      if (ts.isCallExpression(node)) {
        const callee = unwrapTypeScriptExpression(node.expression);
        const callable =
          ts.isArrowFunction(callee) || ts.isFunctionExpression(callee)
            ? callee
            : ts.isIdentifier(callee)
              ? resolveCallable(callee.text, callee)
              : null;
        if (callable && !visitedCallables.has(callable) && callable.body) {
          visitedCallables.add(callable);
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
    if (hookKind === 'useSyncExternalStore') return [1, 2];
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
  const collectRenderedFunctionLikes = (root, destination) => {
    const visit = (node) => {
      if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
        if (containsRenderedSurface(node)) destination.add(node);
        return;
      }
      if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
        const hasRenderedSurface = node.members.some(
          (member) =>
            ts.isMethodDeclaration(member) &&
            member.name &&
            (ts.isIdentifier(member.name) || ts.isStringLiteralLike(member.name)) &&
            member.name.text === 'render' &&
            member.body &&
            containsRenderedSurface(member)
        );
        if (hasRenderedSurface) {
          for (const member of node.members) {
            if (
              ts.isMethodDeclaration(member) &&
              member.name &&
              (ts.isIdentifier(member.name) || ts.isStringLiteralLike(member.name)) &&
              /^(?:UNSAFE_componentWillMount|UNSAFE_componentWillReceiveProps|UNSAFE_componentWillUpdate|componentDidMount|componentDidUpdate|componentWillMount|componentWillReceiveProps|componentWillUpdate|getSnapshotBeforeUpdate|render|shouldComponentUpdate)$/u.test(
                member.name.text
              ) &&
              member.body
            ) {
              destination.add(member);
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

  const exportedFunctionLikes = new Set();
  for (const statement of sourceFile.statements) {
    if (ts.isExportAssignment(statement)) {
      const expression = unwrapTypeScriptExpression(statement.expression);
      if (ts.isIdentifier(expression) && renderedLocalDeclarations.has(expression.text)) {
        for (const root of renderedLocalDeclarations.get(expression.text)) {
          exportedFunctionLikes.add(root);
        }
      } else {
        collectRenderedFunctionLikes(expression, exportedFunctionLikes);
      }
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
            node.arguments[index] && executionPathContainsAgentAction(node.arguments[index])
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
  return false;
}

function containsHarnessForbiddenStateMachine(content, absolutePath) {
  return (
    astContainsInteractiveRuntime(content) ||
    astContainsNativeJsxEventHandler(content, absolutePath) ||
    astContainsHarnessRenderOrEffectAction(content, absolutePath)
  );
}

function discoverHarnessForbiddenStateMachineSources(rootDir) {
  const sourceRoot = path.join(rootDir, 'apps', 'agent-harness', 'src');
  return walkFiles(sourceRoot)
    .filter((absolutePath) => /\.[cm]?[jt]sx?$/i.test(absolutePath))
    .filter((absolutePath) => {
      const relativePath = path.relative(sourceRoot, absolutePath).replaceAll('\\', '/');
      const isGeneratedFacade = isGeneratedHarnessFacadeSource(relativePath);
      const isReviewedBootstrap = relativePath === 'proto-ui/bootstrap.tsx';
      return (
        !/\.(?:browser\.)?(?:test|spec|stories)\.[cm]?[jt]sx?$/i.test(absolutePath) &&
        !isGeneratedFacade &&
        !isReviewedBootstrap
      );
    })
    .filter((absolutePath) =>
      containsHarnessForbiddenStateMachine(fs.readFileSync(absolutePath, 'utf8'), absolutePath)
    )
    .map((absolutePath) => path.relative(rootDir, absolutePath).replaceAll('\\', '/'))
    .sort();
}

function scriptModuleSpecifiers(source, fileName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const specifiers = [];
  const addLiteral = (node) => {
    if (node && ts.isStringLiteralLike(node)) specifiers.push(node.text);
  };
  const workerEntrySpecifier = (node) => {
    if (
      !ts.isNewExpression(node) ||
      !ts.isIdentifier(node.expression) ||
      !/^(?:SharedWorker|Worker)$/u.test(node.expression.text) ||
      !node.arguments?.[0]
    ) {
      return null;
    }
    const urlExpression = unwrapTypeScriptExpression(node.arguments[0]);
    if (
      !ts.isNewExpression(urlExpression) ||
      !ts.isIdentifier(urlExpression.expression) ||
      urlExpression.expression.text !== 'URL' ||
      !urlExpression.arguments?.[0] ||
      !ts.isStringLiteralLike(urlExpression.arguments[0]) ||
      !urlExpression.arguments[1]
    ) {
      return null;
    }
    const base = unwrapTypeScriptExpression(urlExpression.arguments[1]);
    return ts.isPropertyAccessExpression(base) &&
      base.name.text === 'url' &&
      ts.isMetaProperty(base.expression) &&
      base.expression.keywordToken === ts.SyntaxKind.ImportKeyword
      ? urlExpression.arguments[0].text
      : null;
  };
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      addLiteral(node.moduleSpecifier);
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const isImportMetaGlob =
        ts.isPropertyAccessExpression(callee) &&
        /^(?:glob|globEager)$/u.test(callee.name.text) &&
        ts.isMetaProperty(callee.expression) &&
        callee.expression.keywordToken === ts.SyntaxKind.ImportKeyword;
      if (
        !isImportMetaGlob &&
        (callee.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(callee) && callee.text === 'require'))
      ) {
        addLiteral(node.arguments[0]);
      }
    } else if (ts.isNewExpression(node)) {
      const workerSpecifier = workerEntrySpecifier(node);
      if (workerSpecifier) specifiers.push(workerSpecifier);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return specifiers;
}

function staticMarkupAttribute(openingTag, name) {
  const pattern = `\\b${escapeRegularExpression(name)}\\s*=\\s*(?:(['"])([^'"]*)\\1|([^\\s'"=<>\\x60]+))`;
  const match = openingTag.match(new RegExp(pattern, 'iu'));
  return match ? (match[2] ?? match[3]) : null;
}
function isExecutableScriptType(type) {
  if (type === null || type.trim() === '' || type.trim().toLowerCase() === 'module') return true;
  const essence = type.split(';', 1)[0].trim().toLowerCase();
  return /^(?:(?:application|text)\/(?:javascript|ecmascript|x-javascript)|text\/(?:javascript1\.[0-5]|jscript|livescript))$/u.test(
    essence
  );
}
function externalScriptModuleSpecifiers(content) {
  return jsxOpeningTagCandidates(content)
    .filter((openingTag) => /^<script\b/iu.test(openingTag))
    .filter((openingTag) => isExecutableScriptType(staticMarkupAttribute(openingTag, 'type')))
    .map((openingTag) => staticMarkupAttribute(openingTag, 'src'))
    .filter((specifier) => typeof specifier === 'string' && specifier.length > 0);
}
function isExternalExecutableScriptSpecifier(specifier) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(specifier);
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
      const targetValue = (target) => target[2] ?? target[3] ?? target[5] ?? target[6];
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

function moduleSpecifiersForWebsiteSource(absolutePath) {
  const content = fs.readFileSync(absolutePath, 'utf8');
  if (/\.(?:css|less|s[ac]ss)$/i.test(absolutePath)) {
    return styleModuleSpecifiers(content);
  }
  if (/\.(?:astro|vue|svelte)$/i.test(absolutePath)) {
    return [
      ...externalScriptModuleSpecifiers(content),
      ...embeddedScriptSegments(content).flatMap((segment) =>
        scriptModuleSpecifiers(segment, absolutePath)
      ),
      ...embeddedStyleSegments(content).flatMap(styleModuleSpecifiers),
    ];
  }
  const source = /\.mdx?$/i.test(absolutePath) ? stripMarkdownCode(content) : content;
  return scriptModuleSpecifiers(source, absolutePath);
}

function viteGlobPatternGroupsForWebsiteSource(absolutePath) {
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

function configuredWebsiteSourceAliasRoot(rootDir) {
  const configPath = path.join(rootDir, 'apps', 'www', 'astro.config.mjs');
  if (!fs.existsSync(configPath)) return null;
  const configSource = fs.readFileSync(configPath, 'utf8');
  const match = configSource.match(
    /\balias\s*:\s*\{[\s\S]*?['"]@['"]\s*:\s*fileURLToPath\s*\(\s*new URL\s*\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url\s*\)\s*\)/u
  );
  return match ? path.resolve(path.dirname(configPath), match[1]) : null;
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

function viteGlobTargets(rootDir, sourcePath, patterns, { aliasRoot = null, viteRoot }) {
  const sourceDirectory = path.dirname(path.resolve(rootDir, sourcePath));
  const targets = new Map();
  const expandPattern = (authoredPattern) => {
    const pattern = authoredPattern.startsWith('!') ? authoredPattern.slice(1) : authoredPattern;
    let absolutePattern = null;
    if (aliasRoot && pattern.startsWith('@/')) {
      absolutePattern = path.resolve(aliasRoot, pattern.slice(2));
    } else if (pattern.startsWith('.')) {
      absolutePattern = path.resolve(sourceDirectory, pattern);
    } else if (pattern.startsWith('/')) {
      absolutePattern = path.resolve(viteRoot, `.${pattern}`);
    }
    if (!absolutePattern) return [];

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
    for (const matchedPath of expandPattern(authoredPattern)) {
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

function guardedWebsiteImport(rootDir, sourcePath, specifier, websiteSourceAliasRoot) {
  const classifiedSpecifier = importSpecifierWithoutViteSuffix(specifier);
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
  const websiteAliasPrefix = '@/';
  const isWebsiteSourceAlias =
    websiteSourceAliasRoot && classifiedSpecifier.startsWith(websiteAliasPrefix);
  if (!classifiedSpecifier.startsWith('.') && !isWebsiteSourceAlias) return null;

  const resolvedPath = path
    .relative(
      rootDir,
      isWebsiteSourceAlias
        ? canonicalImportTarget(
            path.resolve(
              websiteSourceAliasRoot,
              classifiedSpecifier.slice(websiteAliasPrefix.length)
            )
          )
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
function guardedHarnessImport(rootDir, sourcePath, specifier) {
  const classifiedSpecifier = importSpecifierWithoutViteSuffix(specifier);
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
      rootDir,
      canonicalImportTarget(path.resolve(rootDir, path.dirname(sourcePath), classifiedSpecifier))
    )
    .replaceAll('\\', '/');
  if (/^packages\/.+\/src(?:\/|$)/u.test(resolvedPath)) {
    return { category: 'package-internal', resolvedPath };
  }
  return null;
}

function websiteRawImportIsAllowed(sourcePath, specifier, guardedImport) {
  const allowance = WEBSITE_RAW_IMPORT_ALLOWLIST[sourcePath];
  if (!allowance) return false;
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

function discoverWebsiteRawImports(rootDir) {
  const websiteRoot = path.join(rootDir, 'apps', 'www');
  const sourceRoot = path.join(websiteRoot, 'src');
  const publicRoot = path.join(websiteRoot, 'public');
  const configPath = path.join(websiteRoot, 'astro.config.mjs');
  const candidates = walkFiles(sourceRoot)
    .concat(walkFiles(publicRoot))
    .concat(fs.existsSync(configPath) ? [configPath] : [])
    .filter((absolutePath) =>
      /\.(?:astro|mdx?|[cm]?[jt]sx?|css|less|s[ac]ss|vue|svelte)$/i.test(absolutePath)
    )
    .filter((absolutePath) => !/\.(?:browser\.)?(?:test|spec)\.[cm]?[jt]sx?$/i.test(absolutePath));
  const rawImports = [];
  const websiteSourceAliasRoot = configuredWebsiteSourceAliasRoot(rootDir);
  for (const absolutePath of candidates) {
    const sourcePath = path.relative(rootDir, absolutePath).replaceAll('\\', '/');
    if (/\.(?:astro|vue|svelte)$/i.test(absolutePath)) {
      const content = fs.readFileSync(absolutePath, 'utf8');
      for (const specifier of externalScriptModuleSpecifiers(content)) {
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
        sourcePath,
        specifier,
        websiteSourceAliasRoot
      );
      if (guardedImport) rawImports.push({ sourcePath, specifier, ...guardedImport });
    }
    for (const patterns of viteGlobPatternGroupsForWebsiteSource(absolutePath)) {
      for (const target of viteGlobTargets(rootDir, sourcePath, patterns, {
        aliasRoot: websiteSourceAliasRoot,
        viteRoot: websiteRoot,
      })) {
        const guardedImport = guardedWebsiteImport(
          rootDir,
          sourcePath,
          relativeImportSpecifier(sourcePath, rootDir, target.absolutePath),
          websiteSourceAliasRoot
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
    if (rawImport.category === 'external-executable-script') {
      issues.push(
        `${relativePath}: external executable script \`${rawImport.specifier}\` in \`${rawImport.sourcePath}\` is not reviewed`
      );
      continue;
    }
    if (websiteRawImportIsAllowed(rawImport.sourcePath, rawImport.specifier, rawImport)) continue;
    issues.push(
      `${relativePath}: raw Proto UI import \`${rawImport.specifier}\` in \`${rawImport.sourcePath}\` escapes the website consumer-wall allowlist`
    );
  }
}

function discoverHarnessRawImports(rootDir) {
  const sourceRoot = path.join(rootDir, 'apps', 'agent-harness', 'src');
  const harnessRoot = path.join(rootDir, 'apps', 'agent-harness');
  const candidates = walkFiles(sourceRoot)
    .filter((absolutePath) => /\.(?:[cm]?[jt]sx?|css|less|s[ac]ss)$/i.test(absolutePath))
    .filter((absolutePath) => !/\.(?:browser\.)?(?:test|spec)\.[cm]?[jt]sx?$/i.test(absolutePath));
  const rawImports = [];
  for (const absolutePath of candidates) {
    const sourcePath = path.relative(rootDir, absolutePath).replaceAll('\\', '/');
    for (const specifier of moduleSpecifiersForWebsiteSource(absolutePath)) {
      const guardedImport = guardedHarnessImport(rootDir, sourcePath, specifier);
      if (guardedImport) rawImports.push({ sourcePath, specifier, ...guardedImport });
    }
    for (const patterns of viteGlobPatternGroupsForWebsiteSource(absolutePath)) {
      for (const target of viteGlobTargets(rootDir, sourcePath, patterns, {
        viteRoot: harnessRoot,
      })) {
        const guardedImport = guardedHarnessImport(
          rootDir,
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
    if (rawImport.category === 'forbidden-third-party-package') {
      issues.push(
        `${relativePath}: forbidden third-party Harness UI package \`${rawImport.specifier}\` in \`${rawImport.sourcePath}\``
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

function hasImageFileSignature(absolutePath) {
  const signature = readFileSignature(absolutePath);
  if (!signature) return false;
  if (signature.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return true;
  if (signature.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'))) return true;
  if (signature.subarray(0, 6).toString('ascii') === 'GIF87a') return true;
  if (signature.subarray(0, 6).toString('ascii') === 'GIF89a') return true;
  return (
    signature.subarray(0, 4).toString('ascii') === 'RIFF' &&
    signature.subarray(8, 12).toString('ascii') === 'WEBP'
  );
}

function hasVideoFileSignature(absolutePath) {
  const signature = readFileSignature(absolutePath);
  if (!signature) return false;
  return (
    signature.subarray(0, 4).equals(Buffer.from('1a45dfa3', 'hex')) ||
    signature.subarray(4, 8).toString('ascii') === 'ftyp'
  );
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
    const checkoutRevision = gitOutput(rootDir, ['rev-parse', 'HEAD']);
    if (checkoutRevision && headRevision !== checkoutRevision) {
      issues.push(
        `${context}: promotion head \`${headRevision}\` must equal checked-out revision \`${checkoutRevision}\``
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
    if (
      gitOutput(rootDir, ['cat-file', '-t', baseRevision]) === 'commit' &&
      gitOutput(rootDir, ['cat-file', '-t', headRevision]) === 'commit'
    ) {
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
      for (const framePath of frameManifest.frames ?? []) {
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

function validateRetainedEvidenceArtifacts(record, context, rootDir, issues) {
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
      if (!hasVideoFileSignature(absolutePath)) {
        issues.push(
          `${context}: Multi-frame: retained video artifact has an unrecognized signature: ${repositoryPath}`
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
      for (const framePath of manifest.frames) {
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
        if (!hasImageFileSignature(canonicalFrame)) {
          issues.push(
            `${context}: Multi-frame: JSON manifest frame must be a recognized image file: ${String(framePath)}`
          );
        }
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

function validateSelfHostedWebsiteEvidenceRecord(record, context, rootDir, issues) {
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

  validateRetainedEvidenceArtifacts(record, context, rootDir, issues);
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
    }

    if (config.kind === 'website' && (state === 'ready' || state === 'self-hosted')) {
      if (chainIds.length === 0) {
        issues.push(
          `${context}: website State \`${state}\` must inventory at least one catalog entity in Proto UI chain`
        );
      } else {
        const nonActiveEntity = chainIds
          .map((entityId) => [entityId, catalogEntries.get(entityId)?.status ?? 'uncataloged'])
          .find(([, status]) => status !== 'active');
        if (nonActiveEntity) {
          issues.push(
            `${context}: website State \`${state}\` requires every catalog entity in Proto UI chain to be active; received \`${nonActiveEntity[0]}\` (${nonActiveEntity[1]})`
          );
        }
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
        validateSelfHostedWebsiteEvidenceRecord(evidenceRecord, evidenceContext, rootDir, issues);
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
      sourcePath?.startsWith('apps/www/public/') && /\.(?:cjs|js|mjs)$/iu.test(sourcePath);
    if (sourcePaths.length !== 1 || (!isWebsiteSource && !isPublicExecutable)) {
      issues.push(
        `${context}: source binding must name exactly one \`apps/www/src/**\` path or executable \`apps/www/public/**/*.{js,mjs,cjs}\` path`
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
    const result = validateCoverageMatrices({
      baseRevision: process.env.COVERAGE_BASE_REVISION ?? null,
      headRevision: process.env.COVERAGE_HEAD_REVISION ?? null,
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
