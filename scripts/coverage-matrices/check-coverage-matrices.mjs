import fs from 'node:fs';
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

function collectNativeEventAttributeNames() {
  const libDomPath = path.join(path.dirname(ts.getDefaultLibFilePath({})), 'lib.dom.d.ts');
  const sourceFile = ts.createSourceFile(
    libDomPath,
    fs.readFileSync(libDomPath, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
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
  visit(sourceFile);
  return names;
}

// Lowercase inline HTML handlers must be real DOM event attributes. Camel-cased
// JSX component callbacks remain open-ended because application components can
// define their own `onXxx` semantic events.
const NATIVE_EVENT_ATTRIBUTE_NAMES = collectNativeEventAttributeNames();
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
});
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

function labeledValue(value, labelPattern) {
  return value.match(new RegExp(`\\b(?:${labelPattern})\\s*:\\s*([^;|]+)`, 'i'))?.[1].trim();
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
  for (const match of String(value ?? '').matchAll(/`([^`\r\n]+)`/g)) {
    const candidate = match[1].trim().replaceAll('\\', '/');
    if (!/^(?:apps|packages|scripts|spec|internal)\//.test(candidate)) continue;
    if (/[?*{}\[\]]/.test(candidate) || candidate.split('/').includes('..')) continue;
    paths.push(candidate);
  }
  return [...new Set(paths)];
}

function matrixPathReferences(value) {
  const paths = explicitRepositoryPaths(value);
  for (const match of String(value ?? '').matchAll(
    /(?<![`A-Za-z0-9_./-])((?:apps|packages|scripts|spec|internal)\/[A-Za-z0-9][A-Za-z0-9._/-]*[A-Za-z0-9_])/gu
  )) {
    const candidate = match[1];
    if (!/[?*{}\[\]]/.test(candidate) && !candidate.split('/').includes('..')) {
      paths.push(candidate);
    }
  }
  return [...new Set(paths)];
}

function walkFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(absolutePath));
    else if (entry.isFile()) files.push(absolutePath);
  }
  return files;
}

function loadCatalogEntries(rootDir, issues) {
  const entries = new Map();
  for (const absolutePath of walkFiles(path.join(rootDir, 'spec'))) {
    if (!/\.(?:yaml|yml)$/i.test(absolutePath)) continue;
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

function stripMarkdownCode(content) {
  let fence = null;
  const withoutFences = content
    .split(/\r?\n/)
    .map((line) => {
      const fenceRun = line.match(/^[ \t]*(`{3,}|~{3,})/u)?.[1];
      if (!fence && fenceRun) {
        fence = { character: fenceRun[0], length: fenceRun.length };
        return '';
      }
      if (!fence && /^(?: {4}|\t)/u.test(line)) return '';
      if (!fence) return line;

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

function isDomTypeNode(typeNode, sourceFile) {
  if (!typeNode) return false;
  return /(?:^|[^A-Za-z0-9_$])(?:Document|Element|HTMLElement|HTML[A-Za-z0-9]*Element|SVGElement|Window)(?:[^A-Za-z0-9_$]|$)/u.test(
    typeNode.getText(sourceFile)
  );
}

function domReceiverIdentifiers(sourceFile) {
  const identifiers = new Set(['document', 'window']);
  let changed;
  do {
    changed = false;
    const visit = (node) => {
      if (
        (ts.isParameter(node) || ts.isVariableDeclaration(node)) &&
        ts.isIdentifier(node.name) &&
        (isDomTypeNode(node.type, sourceFile) ||
          (ts.isParameter(node) && /^(?:el|element)$/u.test(node.name.text)) ||
          (ts.isVariableDeclaration(node) &&
            node.initializer &&
            isDomReceiverExpression(node.initializer, sourceFile, identifiers))) &&
        !identifiers.has(node.name.text)
      ) {
        identifiers.add(node.name.text);
        changed = true;
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  } while (changed);
  return identifiers;
}

function isDomAcquisitionCall(expression, sourceFile, receiverIdentifiers) {
  const candidate = unwrapTypeScriptExpression(expression);
  if (!ts.isCallExpression(candidate) || !ts.isPropertyAccessExpression(candidate.expression)) {
    return false;
  }
  const method = candidate.expression.name.text;
  if (!/^(?:closest|createElement|getElementById|querySelector)$/u.test(method)) {
    return false;
  }
  return isDomReceiverExpression(candidate.expression.expression, sourceFile, receiverIdentifiers);
}

function isDomReceiverExpression(expression, sourceFile, receiverIdentifiers) {
  const candidate = unwrapTypeScriptExpression(expression);
  if (ts.isIdentifier(candidate)) return receiverIdentifiers.has(candidate.text);
  if (isDomAcquisitionCall(candidate, sourceFile, receiverIdentifiers)) return true;
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
    /^(?:e|event)$/u.test(owner.text)
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
  const receiverIdentifiers = domReceiverIdentifiers(sourceFile);
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
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const owner = node.expression.expression.getText(sourceFile);
      const method = node.expression.name.text;
      if (
        method === 'addEventListener' ||
        ((owner === 'customElements' || owner.endsWith('.customElements')) && method === 'define')
      ) {
        found = true;
        return;
      }
      if (
        /^(?:blur|focus|scrollBy|scrollIntoView|scrollTo)$/u.test(method) &&
        isDomReceiverExpression(node.expression.expression, sourceFile, receiverIdentifiers)
      ) {
        found = true;
        return;
      }
      if (
        (method === 'setAttribute' ||
          method === 'toggleAttribute' ||
          method === 'removeAttribute') &&
        isDomReceiverExpression(node.expression.expression, sourceFile, receiverIdentifiers) &&
        node.arguments.length > 0 &&
        ts.isStringLiteralLike(node.arguments[0]) &&
        /^aria-/u.test(node.arguments[0].text)
      ) {
        found = true;
        return;
      }
      if (
        ts.isPropertyAccessExpression(node.expression.expression) &&
        node.expression.expression.name.text === 'classList' &&
        isDomReceiverExpression(
          node.expression.expression.expression,
          sourceFile,
          receiverIdentifiers
        ) &&
        /^(?:add|remove|replace|toggle)$/u.test(method)
      ) {
        found = true;
        return;
      }
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const eventProperty = ts.isPropertyAccessExpression(node.left)
        ? node.left.name.text
        : ts.isElementAccessExpression(node.left) &&
            ts.isStringLiteralLike(node.left.argumentExpression)
          ? node.left.argumentExpression.text
          : null;
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
  if (!/\.mdx?$/i.test(absolutePath) && astContainsJsxEventHandler(content)) return true;

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
  return walkFiles(sourceRoot)
    .filter((absolutePath) => /\.(?:astro|vue|svelte|[cm]?[jt]sx?)$/.test(absolutePath))
    .filter((absolutePath) => !absolutePath.startsWith(`${contentRoot}${path.sep}`))
    .concat(
      walkFiles(contentRoot).filter((absolutePath) => /\.(?:mdx?|vue|svelte)$/.test(absolutePath))
    )
    .concat(walkFiles(contentRoot).filter((absolutePath) => /\.[cm]?[jt]sx?$/.test(absolutePath)))
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
  return ['components', 'pages']
    .flatMap((directory) => {
      const absoluteRoot = path.join(websiteSourceRoot, directory);
      return fs.existsSync(absoluteRoot) ? walkFiles(absoluteRoot) : [];
    })
    .filter((absolutePath) => {
      if (
        /\.(?:astro|vue|svelte|[jt]sx)$/i.test(absolutePath) ||
        (absolutePath.startsWith(`${pagesRoot}${path.sep}`) && /\.mdx?$/i.test(absolutePath))
      ) {
        return true;
      }
      return (
        /\.[jt]sx?$/i.test(absolutePath) &&
        astContainsExportedUserFacingComponent(fs.readFileSync(absolutePath, 'utf8'), absolutePath)
      );
    })
    .filter(
      (absolutePath) =>
        !/\.(?:browser\.)?(?:test|spec)\.(?:astro|vue|svelte|[jt]sx?)$/i.test(absolutePath)
    )
    .map((absolutePath) => path.relative(rootDir, absolutePath).replaceAll('\\', '/'))
    .sort();
}

function astContainsExportedUserFacingComponent(content, absolutePath) {
  const sourceFile = ts.createSourceFile(
    absolutePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    /.jsx$/i.test(absolutePath) ? ts.ScriptKind.JSX : ts.ScriptKind.TSX
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

  let containsRenderedSurface = false;
  const visit = (node) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) {
      containsRenderedSurface = true;
      return;
    }
    if (ts.isCallExpression(node)) {
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        reactNamespaceNames.has(node.expression.expression.text) &&
        node.expression.name.text === 'createElement'
      ) {
        containsRenderedSurface = true;
        return;
      }
      if (ts.isIdentifier(node.expression) && reactCreateElementNames.has(node.expression.text)) {
        containsRenderedSurface = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (!containsRenderedSurface) return false;

  return sourceFile.statements.some(
    (statement) =>
      ts.isExportAssignment(statement) ||
      ts.isExportDeclaration(statement) ||
      statement.modifiers?.some(
        (modifier) =>
          modifier.kind === ts.SyntaxKind.ExportKeyword ||
          modifier.kind === ts.SyntaxKind.DefaultKeyword
      )
  );
}

function discoverHarnessUserFacingSources(rootDir) {
  const sourceRoot = path.join(rootDir, 'apps', 'agent-harness', 'src');
  return walkFiles(sourceRoot)
    .filter((absolutePath) => /\.[jt]sx?$/i.test(absolutePath))
    .filter(
      (absolutePath) =>
        !/\.(?:browser\.)?(?:test|spec|stories)\.[jt]sx?$/i.test(absolutePath) &&
        !absolutePath.startsWith(path.join(sourceRoot, 'proto-ui') + path.sep)
    )
    .filter((absolutePath) => {
      const relativeToSource = path.relative(sourceRoot, absolutePath).replaceAll('\\', '/');
      const isRoutedOrPageLevel = /^(?:pages|routes)\//u.test(relativeToSource);
      const content = fs.readFileSync(absolutePath, 'utf8');
      return isRoutedOrPageLevel || astContainsExportedUserFacingComponent(content, absolutePath);
    })
    .map((absolutePath) => path.relative(rootDir, absolutePath).replaceAll('\\', '/'))
    .sort();
}

function discoverHarnessForbiddenInteractionSources(rootDir) {
  const sourceRoot = path.join(rootDir, 'apps', 'agent-harness', 'src');
  return walkFiles(sourceRoot)
    .filter((absolutePath) => /\.[jt]sx?$/i.test(absolutePath))
    .filter(
      (absolutePath) =>
        !/\.(?:browser\.)?(?:test|spec|stories)\.[jt]sx?$/i.test(absolutePath) &&
        !absolutePath.startsWith(path.join(sourceRoot, 'proto-ui') + path.sep)
    )
    .filter((absolutePath) =>
      containsInteractiveSource(sourceTextForInteractionScan(absolutePath), absolutePath)
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
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      addLiteral(node.moduleSpecifier);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    ) {
      addLiteral(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return specifiers;
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
      ...embeddedScriptSegments(content).flatMap((segment) =>
        scriptModuleSpecifiers(segment, absolutePath)
      ),
      ...embeddedStyleSegments(content).flatMap(styleModuleSpecifiers),
    ];
  }
  const source = /\.mdx?$/i.test(absolutePath) ? stripMarkdownCode(content) : content;
  return scriptModuleSpecifiers(source, absolutePath);
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

function guardedWebsiteImport(rootDir, sourcePath, specifier, websiteSourceAliasRoot) {
  const baseSpecifier = specifier.split(/[?#]/u, 1)[0];
  if (/^@proto\.ui\/adapter-[a-z0-9-]+(?:\/|$)/u.test(baseSpecifier)) {
    return { category: 'adapter-package', resolvedPath: null };
  }
  if (/^@proto\.ui\/prototypes-[a-z0-9-]+(?:\/|$)/u.test(baseSpecifier)) {
    return { category: 'prototype-package', resolvedPath: null };
  }
  if (/^@proto\.ui\/module-[a-z0-9-]+(?:\/|$)/u.test(baseSpecifier)) {
    return { category: 'module-package', resolvedPath: null };
  }
  if (/^@proto\.ui\/core(?:\/|$)/u.test(baseSpecifier)) {
    return { category: 'core-package', resolvedPath: null };
  }
  if (/^@proto\.ui\/runtime(?:\/|$)/u.test(baseSpecifier)) {
    return { category: 'runtime-package', resolvedPath: null };
  }
  const websiteAliasPrefix = '@/';
  const isWebsiteSourceAlias =
    websiteSourceAliasRoot && baseSpecifier.startsWith(websiteAliasPrefix);
  if (!baseSpecifier.startsWith('.') && !isWebsiteSourceAlias) return null;

  const resolvedPath = path
    .relative(
      rootDir,
      isWebsiteSourceAlias
        ? path.resolve(websiteSourceAliasRoot, baseSpecifier.slice(websiteAliasPrefix.length))
        : path.resolve(rootDir, path.dirname(sourcePath), baseSpecifier)
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
  return null;
}

function guardedHarnessImport(rootDir, sourcePath, specifier) {
  const baseSpecifier = specifier.split(/[?#]/u, 1)[0];
  if (/^@proto\.ui\/[a-z0-9-]+(?:\/|$)/u.test(baseSpecifier)) {
    return { category: 'proto-ui-package', resolvedPath: null };
  }
  if (!baseSpecifier.startsWith('.')) return null;

  const resolvedPath = path
    .relative(rootDir, path.resolve(rootDir, path.dirname(sourcePath), baseSpecifier))
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
  const configPath = path.join(websiteRoot, 'astro.config.mjs');
  const candidates = walkFiles(sourceRoot)
    .concat(fs.existsSync(configPath) ? [configPath] : [])
    .filter((absolutePath) =>
      /\.(?:astro|mdx?|[cm]?[jt]sx?|css|less|s[ac]ss|vue|svelte)$/i.test(absolutePath)
    )
    .filter((absolutePath) => !/\.(?:browser\.)?(?:test|spec)\.[cm]?[jt]sx?$/i.test(absolutePath));
  const rawImports = [];
  const websiteSourceAliasRoot = configuredWebsiteSourceAliasRoot(rootDir);
  for (const absolutePath of candidates) {
    const sourcePath = path.relative(rootDir, absolutePath).replaceAll('\\', '/');
    for (const specifier of moduleSpecifiersForWebsiteSource(absolutePath)) {
      const guardedImport = guardedWebsiteImport(
        rootDir,
        sourcePath,
        specifier,
        websiteSourceAliasRoot
      );
      if (guardedImport) rawImports.push({ sourcePath, specifier, ...guardedImport });
    }
  }
  return rawImports;
}

function validateWebsiteRawImports(rootDir, relativePath, issues) {
  for (const rawImport of discoverWebsiteRawImports(rootDir)) {
    if (websiteRawImportIsAllowed(rawImport.sourcePath, rawImport.specifier, rawImport)) continue;
    issues.push(
      `${relativePath}: raw Proto UI import \`${rawImport.specifier}\` in \`${rawImport.sourcePath}\` escapes the website consumer-wall allowlist`
    );
  }
}

function discoverHarnessRawImports(rootDir) {
  const sourceRoot = path.join(rootDir, 'apps', 'agent-harness', 'src');
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
  }
  return rawImports;
}

function validateHarnessRawImports(rootDir, relativePath, issues) {
  for (const rawImport of discoverHarnessRawImports(rootDir)) {
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

function requireLabels(value, labels, context, issues) {
  for (const label of labels) {
    if (!value.includes(label)) {
      issues.push(`${context}: missing required \`${label}\` label`);
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

function evidenceRecordLabelValue(record, label) {
  const nextLabelPattern = SELF_HOSTED_WEBSITE_RECORD_LABELS.map(escapeRegularExpression).join('|');
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

function canonicalRetainedEvidenceFile(rootDir, repositoryPath) {
  if (typeof repositoryPath !== 'string') return null;
  const evidenceRoot = path.resolve(rootDir, SELF_HOSTED_WEBSITE_EVIDENCE_ROOT);
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
    for (const repositoryPath of artifactPaths) {
      const absolutePath = path.resolve(rootDir, repositoryPath);
      if (!fs.existsSync(absolutePath)) {
        issues.push(`${context}: ${label} retained artifact does not exist: ${repositoryPath}`);
      } else if (!fs.statSync(absolutePath).isFile()) {
        issues.push(`${context}: ${label} retained artifact must be a file: ${repositoryPath}`);
      } else if (fs.statSync(absolutePath).size === 0) {
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
        const canonicalFrame = canonicalRetainedEvidenceFile(rootDir, framePath);
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

function validateMainRows(config, table, relativePath, rootDir, catalogEntries, issues) {
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
    rowDispositions.set(id, { targetClass, state });

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
      for (const repositoryPath of matrixPathReferences(record.Path)) {
        if (!repositoryPath.startsWith(governedSourcePrefix)) continue;
        const owners = sourceOwners.get(repositoryPath) ?? [];
        owners.push({ id, line: row.line });
        sourceOwners.set(repositoryPath, owners);
      }
    }

    for (const header of config.existingPathHeaders ?? []) {
      for (const repositoryPath of explicitRepositoryPaths(record[header])) {
        if (!fs.existsSync(path.resolve(rootDir, repositoryPath))) {
          issues.push(
            `${context}: ${header} references missing repository path \`${repositoryPath}\``
          );
        }
      }
    }

    const boundRepositoryPaths = new Set([
      ...matrixPathReferences(record.Path),
      ...(config.existingPathHeaders ?? []).flatMap((header) =>
        explicitRepositoryPaths(record[header])
      ),
    ]);
    for (const requiredRepositoryPath of config.requiredRepositoryPathsByRow?.[id] ?? []) {
      if (!boundRepositoryPaths.has(requiredRepositoryPath)) {
        issues.push(
          `${context}: matrix row \`${id}\` must bind repository path \`${requiredRepositoryPath}\` as an exact code span in Path or Evidence`
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
        if (!fs.existsSync(absoluteEvidencePath)) continue;
        if (!fs.statSync(absoluteEvidencePath).isFile()) {
          issues.push(`${context}: self-hosted evidence path must be a file: ${repositoryPath}`);
          continue;
        }
        const evidenceRecord = fs.readFileSync(absoluteEvidencePath, 'utf8');
        requireMeaningfulLabels(
          evidenceRecord,
          SELF_HOSTED_WEBSITE_RECORD_LABELS,
          `${context} self-hosted evidence record ${repositoryPath}`,
          issues
        );
        const evidenceCommit = evidenceRecord.match(/\bCommit:\s*([^\r\n;|]*)/i)?.[1].trim();
        if (evidenceCommit && !/^[0-9a-f]{40}$/i.test(evidenceCommit)) {
          issues.push(
            `${context} self-hosted evidence record ${repositoryPath} must bind Commit to an exact 40-character Git SHA`
          );
        }
        validateSelfHostedWebsiteEvidenceRecord(
          evidenceRecord,
          `${context} self-hosted evidence record ${repositoryPath}`,
          rootDir,
          issues
        );
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
      const implementationPaths = matrixPathReferences(record.Path);
      if (implementationPaths.length === 0) {
        issues.push(
          `${context}: dogfooded rows must bind at least one exact repository implementation path in Path`
        );
      }
      for (const repositoryPath of implementationPaths) {
        if (!fs.existsSync(path.resolve(rootDir, repositoryPath))) {
          issues.push(
            `${context}: dogfooded implementation path does not exist: ${repositoryPath}`
          );
        }
      }
      const harnessImplementationPaths = implementationPaths.filter(
        (repositoryPath) =>
          repositoryPath.startsWith('apps/agent-harness/') &&
          fs.existsSync(path.resolve(rootDir, repositoryPath))
      );
      if (harnessImplementationPaths.length === 0) {
        issues.push(
          `${context}: dogfooded rows must bind at least one existing implementation path under apps/agent-harness/`
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
        if (!fs.existsSync(path.resolve(rootDir, repositoryPath))) {
          issues.push(`${context}: dogfooded evidence path does not exist: ${repositoryPath}`);
          continue;
        }
        const evidenceRecord = fs.readFileSync(path.resolve(rootDir, repositoryPath), 'utf8');
        requireMeaningfulLabels(
          evidenceRecord,
          DOGFOODED_RECORD_LABELS,
          `${context} dogfooded evidence record ${repositoryPath}`,
          issues
        );
        const evidenceCommit = evidenceRecord.match(/\bCommit:\s*([^\r\n;|]*)/i)?.[1].trim();
        if (evidenceCommit && !/^[0-9a-f]{40}$/i.test(evidenceCommit)) {
          issues.push(
            `${context} dogfooded evidence record ${repositoryPath} must bind Commit to an exact 40-character Git SHA`
          );
        }
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
    if (sourcePaths.length !== 1 || !sourcePaths[0].startsWith('apps/www/src/')) {
      issues.push(`${context}: source binding must name exactly one \`apps/www/src/**\` path`);
      continue;
    }
    const sourcePath = sourcePaths[0];
    if (bindings.has(sourcePath)) {
      issues.push(
        `${context}: duplicate source binding for \`${sourcePath}\` (first declared on line ${bindings.get(sourcePath).line})`
      );
      continue;
    }
    const ownerIds = [...row.cells[1].matchAll(/`(www\.[a-z0-9.-]+)`/g)].map((match) => match[1]);
    if (ownerIds.length === 0) {
      issues.push(`${context}: source binding must name at least one owning matrix row ID`);
      continue;
    }
    bindings.set(sourcePath, { line: row.line, ownerIds: [...new Set(ownerIds)] });
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
  const interactiveSources = new Set(discoverWebsiteInteractiveSources(rootDir));
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

    if (directOwners.length === 1 && binding) {
      if (!hasNativeDirectOwner) {
        issues.push(
          `${relativePath}: interactive website source \`${sourcePath}\` is already owned by matrix row \`${directOwners[0].id}\`; use the direct Path or the explicit binding, not both`
        );
        continue;
      }
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
  for (const sourcePath of discoverHarnessForbiddenInteractionSources(rootDir)) {
    const directIds = [
      ...new Set((matrixResult.sourceOwners.get(sourcePath) ?? []).map(({ id }) => id)),
    ];
    const binding = bindings.get(sourcePath);
    const ownerIds = binding?.ownerIds ?? directIds;
    if (ownerIds.length === 0) {
      issues.push(
        `${relativePath}: forbidden Harness interaction source \`${sourcePath}\` must bind an explicit matrix owner with an infrastructure-exempt disposition`
      );
      continue;
    }
    const hasOnlyInfrastructureOwners = ownerIds.every((ownerId) => {
      const disposition = matrixResult.rowDispositions.get(ownerId);
      return (
        disposition?.targetClass === 'infrastructure-exempt' &&
        disposition.state === 'infrastructure-exempt'
      );
    });
    if (!hasOnlyInfrastructureOwners) {
      issues.push(
        `${relativePath}: forbidden Harness interaction source \`${sourcePath}\` requires every owner to use Target class \`infrastructure-exempt\` and State \`infrastructure-exempt\``
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

function validateMatrixFile(rootDir, config, catalogEntries, issues) {
  validateInheritedDependencyVersions(rootDir, config, issues);
  const absolutePath = path.join(rootDir, config.relativePath);
  if (!fs.existsSync(absolutePath)) {
    issues.push(
      `${config.relativePath}: file is missing; create it with ${config.startMarker}, the exact matrix table, ${END_MARKER}, and a ## State totals table`
    );
    return;
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

export function collectCoverageMatrixIssues({ rootDir = process.cwd() } = {}) {
  const issues = [];
  const catalogEntries = loadCatalogEntries(rootDir, issues);
  for (const config of MATRIX_CONFIGS) {
    validateMatrixFile(rootDir, config, catalogEntries, issues);
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
    const result = validateCoverageMatrices();
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
