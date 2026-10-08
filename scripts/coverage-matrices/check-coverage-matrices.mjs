import { STARTUP_PRERENDER_IMPORT_ALLOWLIST } from './startup-prerender-imports.mjs';
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
import { parse as parseHtml, parseFragment as parseHtmlFragment } from 'parse5';
import { parse as parseAstro } from '@astrojs/compiler/sync';
import { createProcessor as createMarkdownProcessor } from '@mdx-js/mdx';
import { parse as parseVue, NodeTypes as VueNodeTypes } from '@vue/compiler-dom';

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
  ...STARTUP_PRERENDER_IMPORT_ALLOWLIST,
  // Exact #652 acceptance compositions. Their App controls remain blocked
  // consumers, not an infrastructure or stable-prototype exemption.
  'apps/www/src/components/PrototypePreviewer/shadow-split-acceptance.ts': Object.freeze({
    sourceSha256: '6ec435217573ac35458cd1ea79b27a9cc95f5137e942cf72b7118a825978cb7a',
    specifiers: Object.freeze([
      '@proto.ui/adapter-web-component',
      '@proto.ui/prototypes-brutalist/badge',
      '@proto.ui/prototypes-shadcn/checkbox',
    ]),
  }),
  'apps/www/src/components/PrototypePreviewer/shadow-split-s2.ts': Object.freeze({
    sourceSha256: '6ef1cb15c224e47045993911e1e6b7c14ad0f93f65df5014c86282118a3a83be',
    specifiers: Object.freeze([
      '@proto.ui/adapter-web-component',
      '@proto.ui/prototypes-brutalist/badge',
      '@proto.ui/prototypes-shadcn/button',
      '@proto.ui/prototypes-shadcn/checkbox',
      '@proto.ui/prototypes-shadcn/switch',
    ]),
  }),
  'apps/www/src/components/PrototypePreviewer/shadow-split-s3.ts': Object.freeze({
    sourceSha256: '3b7d4778ff754adde59b7cd77862070416e5dcfbcc429a3eef3c99a6eb8df108',
    specifiers: Object.freeze([
      '@proto.ui/adapter-web-component',
      '@proto.ui/prototypes-brutalist/badge',
      '@proto.ui/prototypes-shadcn/button',
      '@proto.ui/prototypes-shadcn/checkbox',
      '@proto.ui/prototypes-shadcn/switch',
      '@proto.ui/prototypes-shadcn/tabs',
    ]),
  }),
  'apps/www/src/components/PrototypePreviewer/shadow-split-s4.ts': Object.freeze({
    sourceSha256: '4492f622a7d0cd411f60ea7e3906205219cb9b4bc2d1062c0eed5703e1bfd514',
    specifiers: Object.freeze([
      '@proto.ui/adapter-web-component',
      '@proto.ui/prototypes-shadcn/dialog',
    ]),
  }),
  'apps/www/src/components/PrototypePreviewer/shadow-split-s5.ts': Object.freeze({
    sourceSha256: 'fa92aa85ff8afb7a0f0233155e485dc3363ee886068015ceb979162e2ae66cbf',
    specifiers: Object.freeze([
      '@proto.ui/adapter-web-component',
      '@proto.ui/prototypes-base/input',
      '@proto.ui/prototypes-base/textarea',
      '@proto.ui/prototypes-shadcn/tabs',
      '@proto.ui/prototypes-shadcn/textarea',
    ]),
  }),
  // Exact opt-in optical host and its owned-source diagnostics, not app controls.
  'apps/www/src/components/PrototypePreviewer/preview-material-provider.ts': Object.freeze({
    specifiers: Object.freeze(['@proto.ui/core', '@proto.ui/module-feedback']),
  }),
  'apps/www/src/components/PrototypePreviewer/preview-material-scene.ts': Object.freeze({
    specifiers: Object.freeze(['@proto.ui/adapter-base/web-material']),
    resolvedPaths: Object.freeze(['packages/prototypes/liquid-glass/src/theme']),
  }),
  'packages/adapters/base/src/material/program-pool.ts': Object.freeze({
    resolvedPaths: Object.freeze([
      'packages/adapters/base/src/material/image-prepare',
      'packages/adapters/base/src/material/program',
    ]),
  }),
  'packages/adapters/base/src/material/program.ts': Object.freeze({
    resolvedPaths: Object.freeze([
      'packages/adapters/base/src/material/contact-profile',
      'packages/adapters/base/src/material/liquidgl-kernel.generated',
      'packages/adapters/base/src/material/style',
      'packages/adapters/base/src/material/source',
    ]),
  }),
  // Continuous contact is still the exact opt-in optical host closure (#420).
  // These reviewed edges admit neither sibling modules nor foreign consumers.
  'packages/adapters/base/src/material/contact-profile.ts': Object.freeze({
    resolvedPaths: Object.freeze(['packages/adapters/base/src/material/liquidgl-kernel.generated']),
  }),
  'packages/adapters/base/src/material/source.ts': Object.freeze({
    resolvedPaths: Object.freeze(['packages/adapters/base/src/material/contact-carrier']),
  }),
  'packages/adapters/base/src/material/contact-carrier.ts': Object.freeze({
    resolvedPaths: Object.freeze(['packages/adapters/base/src/material/paint-mutations']),
  }),
  'packages/adapters/base/src/material/style.ts': Object.freeze({
    specifiers: Object.freeze(['@proto.ui/core']),
  }),
  'apps/www/src/components/PrototypePreviewer/runtimes/retryable-module.ts': Object.freeze({
    viteIgnoredDynamicImports: Object.freeze(['url']),
    sourceSha256: '32011cbe30566785c4e081e32cada2780ef6a6d5349d10331aace4eead0a12f2',
  }),

  // Reviewed Field validation request type consumed by the blocked demo controller.
  'apps/www/src/content/docs/field-demo.shared.ts': Object.freeze({
    specifiers: Object.freeze(['@proto.ui/prototypes-base/field']),
  }),
  // Accepted main integrations: exact source owners and public inputs only.
  // These bindings do not promote draft components or admit sibling imports.
  'apps/www/src/components/Homepage/homepage-text.ts': Object.freeze({
    specifiers: Object.freeze(['@proto.ui/prototypes-base/text']),
  }),
  'apps/www/src/components/InstallCommandCard.astro': Object.freeze({
    specifiers: Object.freeze(['@proto.ui/adapter-web-component']),
  }),
  'apps/www/src/components/site-link-recipes.ts': Object.freeze({
    specifiers: Object.freeze([
      '@proto.ui/prototypes-base/surface',
      '@proto.ui/prototypes-base/text',
    ]),
  }),
  'apps/www/src/components/site-native-controls.ts': Object.freeze({
    specifiers: Object.freeze([
      '@proto.ui/adapter-web-component',
      '@proto.ui/prototypes-shadcn/surface',
      '@proto.ui/prototypes-brutalist/surface',
      '@proto.ui/prototypes-shadcn/text',
      '@proto.ui/prototypes-brutalist/text',
    ]),
  }),
  'apps/www/src/components/site-search-commands.ts': Object.freeze({
    specifiers: Object.freeze(['@proto.ui/module-expose-state']),
    resolvedPaths: Object.freeze([
      'packages/prototypes/lucide/src/icons/search',
      'packages/prototypes/lucide/src/icons/x',
    ]),
  }),
  'apps/www/src/components/site-text-recipes.ts': Object.freeze({
    specifiers: Object.freeze(['@proto.ui/prototypes-base/text']),
  }),
  'apps/www/src/components/surface-recipes.ts': Object.freeze({
    specifiers: Object.freeze(['@proto.ui/prototypes-base/surface']),
  }),
  'apps/www/src/components/SiteLibraryStyle.astro': Object.freeze({
    resolvedPaths: Object.freeze(['packages/prototypes/brutalist/src/theme']),
  }),

  // Per-render DemoSpec association-key lowering to a public opaque identity.
  // No ordinary website controller or private host lookup is admitted here.
  'apps/www/src/components/PrototypePreviewer/demo-associations.ts': Object.freeze({
    specifiers: Object.freeze(['@proto.ui/core']),
  }),
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
      '@proto.ui/prototypes-brutalist/button',
      '@proto.ui/prototypes-brutalist/select',
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
      '@proto.ui/prototypes-base/button',
      '@proto.ui/prototypes-base/dialog',
      '@proto.ui/prototypes-shadcn/surface',
      '@proto.ui/prototypes-brutalist/surface',
      '@proto.ui/prototypes-shadcn/text',
      '@proto.ui/prototypes-brutalist/text',
    ]),
  }),
  'apps/www/src/pages/en/test/liquid-glass-material.astro': Object.freeze({
    specifiers: Object.freeze([
      '@proto.ui/prototypes-liquid-glass/button',
      '@proto.ui/adapter-base/web-material',
    ]),
    resolvedPaths: Object.freeze([
      'packages/prototypes/liquid-glass/src/theme',
      'packages/adapters/base/src/material/program-pool',
      'packages/adapters/base/src/material/program',
      'packages/adapters/base/src/material/style',
    ]),
  }),
  // Bounded four-runtime fixture of the actual eight Bootstrap source parts.
  // Its authored commands remain separately blocked consumer compositions.
  'apps/www/src/pages/en/test/bootstrap-state-controls.astro': Object.freeze({
    specifiers: Object.freeze(['@proto.ui/prototypes-bootstrap-2-3-2']),
    resolvedPaths: Object.freeze(['packages/prototypes/bootstrap-2-3-2/src/theme']),
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

function stripMarkdownCode(content, { preserveInlineCode = false } = {}) {
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
      const fenceLine = line.replace(/^(?: {0,3}>[ \t]?)+/u, '');
      const fenceRun = fenceLine.match(/^[ \t]*(`{3,}|~{3,})/u)?.[1];
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

      const closingRun = fenceLine.match(/^[ \t]*(`+|~+)[ \t]*$/u)?.[1];
      if (closingRun && closingRun[0] === fence.character && closingRun.length >= fence.length) {
        fence = null;
      }
      return '';
    })
    .join('\n');

  return preserveInlineCode
    ? withoutFences
    : withoutFences.replace(/(?<!`)(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)/gu, '');
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
      if (
        ts.isBlock(current) ||
        ts.isFunctionLike(current) ||
        ts.isClassLike(current) ||
        ts.isCatchClause(current) ||
        ts.isForStatement(current) ||
        ts.isForInStatement(current) ||
        ts.isForOfStatement(current) ||
        ts.isCaseBlock(current) ||
        ts.isClassStaticBlockDeclaration(current) ||
        ts.isSourceFile(current)
      ) {
        return current;
      }
    }
    return sourceFile;
  };
  const declarationScope = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isVariableDeclarationList(node.parent) &&
      !(node.parent.flags & ts.NodeFlags.BlockScoped)
    ) {
      for (let current = node.parent; current; current = current.parent)
        if (
          ts.isFunctionLike(current) ||
          ts.isSourceFile(current) ||
          ts.isClassStaticBlockDeclaration(current)
        )
          return current;
    }
    return lexicalScope(node);
  };
  const addBinding = (
    name,
    node,
    initializer,
    intrinsicallyDom,
    destructuredProperties = null,
    scope = lexicalScope(node)
  ) => {
    const bindings = bindingsByName.get(name) ?? [];
    bindings.push({
      destructuredProperties,
      initializer,
      intrinsicallyDom,
      node,
      position: node.getStart(sourceFile),
      scope,
    });
    bindingsByName.set(name, bindings);
  };
  const collectBindingName = (
    name,
    node,
    initializer,
    intrinsicallyDom,
    destructuredProperties = [],
    fromParameter = false,
    scope = lexicalScope(node)
  ) => {
    if (ts.isIdentifier(name)) {
      addBinding(
        name.text,
        node,
        initializer,
        intrinsicallyDom ||
          (fromParameter &&
            /^(?:currentTarget|target)$/u.test(destructuredProperties.at(-1) ?? '')),
        destructuredProperties.length > 0 ? destructuredProperties : null,
        scope
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
        fromParameter,
        scope
      );
    }
  };
  const collect = (node) => {
    if ((ts.isFunctionExpression(node) || ts.isClassExpression(node)) && node.name)
      addBinding(node.name.text, node, null, false, null, node);
    if (
      (ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isImportClause(node) ||
        ts.isImportSpecifier(node) ||
        ts.isNamespaceImport(node)) &&
      node.name
    )
      addBinding(node.name.text, node, null, false);
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
        ts.isParameter(node),
        declarationScope(node)
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
      const entries = bindings.filter((entry) => entry.scope === scope);
      if (entries.length > 0)
        return (
          entries
            .filter((entry) => entry.position < usePosition)
            .sort((left, right) => right.position - left.position)[0] ?? null
        );
      if (ts.isSourceFile(scope)) break;
    }
    return null;
  };
  const hasLocalBinding = (name, useNode) => {
    for (let scope = lexicalScope(useNode); scope; scope = lexicalScope(scope)) {
      if ((bindingsByName.get(name) ?? []).some((entry) => entry.scope === scope)) return true;
      if (ts.isSourceFile(scope)) break;
    }
    return false;
  };
  const isIdentifierDomReceiver = (name, useNode, visitedBindings = new Set()) => {
    const binding = latestBinding(name, useNode);
    if (!binding)
      return (name === 'document' || name === 'window') && !hasLocalBinding(name, useNode);
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
        isBrowserDocumentExpression(owner, sourceFile, receiverBindings, useNode, visitedBindings)
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
  const receiverBindings = {
    isIdentifierDomCollection,
    isIdentifierDomReceiver,
    latestBinding,
    hasLocalBinding,
  };
  return receiverBindings;
}

function isBrowserDocumentExpression(
  expression,
  sourceFile,
  receiverBindings,
  useNode,
  seen = new Set()
) {
  const candidate = unwrapTypeScriptExpression(expression);
  if (ts.isIdentifier(candidate)) {
    const binding = receiverBindings.latestBinding(candidate.text, useNode);
    if (!binding)
      return (
        candidate.text === 'document' && !receiverBindings.hasLocalBinding('document', useNode)
      );
    if (
      !binding.initializer ||
      binding.destructuredProperties ||
      seen.has(binding) ||
      seen.size >= 64
    )
      return false;
    seen.add(binding);
    return isBrowserDocumentExpression(
      binding.initializer,
      sourceFile,
      receiverBindings,
      binding.node,
      seen
    );
  }
  const member = staticMemberAccess(candidate);
  const owner = member && unwrapTypeScriptExpression(member.receiver);
  return Boolean(
    member?.name === 'document' &&
    owner &&
    ts.isIdentifier(owner) &&
    /^(?:window|self|globalThis)$/u.test(owner.text) &&
    !receiverBindings.hasLocalBinding(owner.text, useNode)
  );
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
  if (isBrowserDocumentExpression(candidate, sourceFile, receiverBindings, useNode)) return true;
  const member = staticMemberAccess(candidate);
  if (!member) return false;
  const owner = unwrapTypeScriptExpression(member.receiver);
  if (
    /^(?:body|documentElement|activeElement)$/u.test(member.name) &&
    isBrowserDocumentExpression(owner, sourceFile, receiverBindings, useNode, visitedBindings)
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

function jsxOpeningTagCandidates(content, { includeOffsets = false, commentRanges = null } = {}) {
  const candidates = [];
  for (let start = 0; start < content.length; start += 1) {
    if (content.startsWith('<!--', start)) {
      const end = content.indexOf('-->', start + 4);
      commentRanges?.push({ start, end: end < 0 ? content.length : end + 3 });
      if (end < 0) break;
      start = end + 2;
      continue;
    }
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
        candidates.push(
          includeOffsets ? { start, end: cursor + 1 } : content.slice(start, cursor + 1)
        );
        start = cursor;
        break;
      }
    }
  }
  return candidates;
}

function maskStringsInMdxBraceExpressions(content) {
  const characters = content.split('');
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

function markupSourceForJsxFallback(content, absolutePath, { scriptsAlreadyMasked = false } = {}) {
  if (/\.mdx?$/i.test(absolutePath)) return maskStringsInMdxBraceExpressions(content);
  if (!/\.(?:html?|astro|vue|svelte)$/i.test(absolutePath)) return null;

  let markup = content;
  if (/\.astro$/i.test(absolutePath)) {
    markup = markup.replace(/^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/u, '');
  }
  return scriptsAlreadyMasked
    ? markup
    : markup.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/giu, '');
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

function maskMdxEsmLiteralText(content, absolutePath) {
  if (!/\.mdx$/iu.test(absolutePath)) return content;
  const parsed = ts.createSourceFile(
    'document.mdx',
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const characters = content.split('');
  const erase = (start, end) => {
    for (let index = start; index < end; index += 1)
      if (!/[\r\n]/u.test(characters[index])) characters[index] = ' ';
  };
  const mask = (node, insideJsx = false) => {
    insideJsx ||=
      ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node);
    if (!insideJsx) {
      for (const position of [node.pos, node.end])
        for (const comment of [
          ...(ts.getLeadingCommentRanges(content, position) ?? []),
          ...(ts.getTrailingCommentRanges(content, position) ?? []),
        ])
          erase(comment.pos, comment.end);
    }
    let owner = node;
    while (
      owner.parent &&
      owner.parent.expression === owner &&
      unwrapTypeScriptExpression(owner.parent) !== owner.parent
    )
      owner = owner.parent;
    const jsxAttributeValue =
      ts.isJsxAttribute(owner.parent) ||
      (ts.isJsxExpression(owner.parent) && ts.isJsxAttribute(owner.parent.parent));
    if (
      (ts.isStringLiteralLike(node) ||
        ts.isTemplateLiteralToken(node) ||
        node.kind === ts.SyntaxKind.RegularExpressionLiteral) &&
      !jsxAttributeValue
    ) {
      erase(node.getStart(parsed), node.end);
      return;
    }
    ts.forEachChild(node, (child) => mask(child, insideJsx));
  };
  for (const statement of parsed.statements) {
    if (
      ts.isImportDeclaration(statement) ||
      ts.isExportDeclaration(statement) ||
      ts.isExportAssignment(statement) ||
      statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    )
      mask(statement);
  }
  return characters.join('');
}

function containsNativeMdxControl(content, absolutePath) {
  if (!/\.mdx?$/iu.test(absolutePath)) return false;
  return authoredResourceTags(content, absolutePath).some(({ name, attributes, opaque, jsx }) => {
    if (
      /^(?:button|details|summary|form|input|select|textarea|option|optgroup|dialog)$/u.test(name)
    )
      return true;
    if (name !== 'video' && name !== 'audio') return false;
    if (opaque) return true;
    const controls = attributes.get('controls');
    return !!controls && (!jsx || controls.encoded || controls.value === null || !!controls.value);
  });
}

function containsInteractiveSource(content, absolutePath, authoredContent = content) {
  if (/\.svg$/i.test(absolutePath)) return publicSvgSourceIssues(content).length > 0;
  if (/\.[cm]?[jt]sx?$/i.test(absolutePath)) {
    return astContainsInteractiveRuntime(content) || containsJsxEventHandler(content, absolutePath);
  }
  return (
    containsNativeMdxControl(authoredContent, absolutePath) ||
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
      containsInteractiveSource(
        sourceTextForInteractionScan(absolutePath),
        absolutePath,
        /\.mdx?$/iu.test(absolutePath) ? fs.readFileSync(absolutePath, 'utf8') : undefined
      )
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
  const scheduledActionBindings = domReceiverBindings(sourceFile);
  const visibleScheduledActionOwner = (expression, useNode, seen = new Set()) => {
    let owner = unwrapTypeScriptExpression(expression);
    while (ts.isPropertyAccessExpression(owner) || ts.isElementAccessExpression(owner))
      owner = unwrapTypeScriptExpression(owner.expression);
    if (!ts.isIdentifier(owner)) return owner.kind === ts.SyntaxKind.ThisKeyword;
    const binding = scheduledActionBindings.latestBinding(owner.text, useNode);
    if (!binding)
      return (
        !scheduledActionBindings.hasLocalBinding(owner.text, useNode) &&
        agentActionOwners.has(owner.text)
      );
    if (seen.has(binding) || seen.size >= 64) return false;
    seen.add(binding);
    if (
      ts.isImportClause(binding.node) ||
      ts.isImportSpecifier(binding.node) ||
      ts.isNamespaceImport(binding.node)
    )
      return true;
    if (
      ts.isParameter(binding.node) ||
      (ts.isBindingElement(binding.node) && bindingElementComesFromParameter(binding.node))
    )
      return hasAgentActionOwnerProvenance(owner.text);
    return Boolean(
      binding.initializer && visibleScheduledActionOwner(binding.initializer, binding.node, seen)
    );
  };
  const isScheduledAgentActionExpression = (expression, seen = new Set()) => {
    const candidate = unwrapTypeScriptExpression(expression);
    if (!isAgentActionExpression(candidate)) return false;
    let owner = candidate;
    while (ts.isPropertyAccessExpression(owner) || ts.isElementAccessExpression(owner))
      owner = unwrapTypeScriptExpression(owner.expression);
    if (!ts.isIdentifier(owner)) return true;
    const binding = scheduledActionBindings.latestBinding(owner.text, candidate);
    if (!binding) return !scheduledActionBindings.hasLocalBinding(owner.text, candidate);
    if (seen.has(binding) || seen.size >= 64) return false;
    seen.add(binding);
    if (
      ts.isImportClause(binding.node) ||
      ts.isImportSpecifier(binding.node) ||
      ts.isNamespaceImport(binding.node)
    )
      return true;
    // Parameters retain the existing explicit owner/verb provenance rule;
    // a concrete local value must not inherit a same-named import's identity.
    if (
      ts.isParameter(binding.node) ||
      (ts.isBindingElement(binding.node) && bindingElementComesFromParameter(binding.node))
    )
      return hasAgentActionOwnerProvenance(owner.text) || agentActionAliases.has(owner.text);
    if (!binding.initializer) return false;
    if (ts.isIdentifier(candidate)) {
      if (binding.destructuredProperties)
        return visibleScheduledActionOwner(binding.initializer, binding.node, seen);
      return isScheduledAgentActionExpression(binding.initializer, seen);
    }
    return visibleScheduledActionOwner(binding.initializer, binding.node, seen);
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
          if (isScheduledAgentActionExpression(callbackArgument)) {
            found = true;
            return;
          }
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

// Cache only pure parser output, never filesystem reads, ownership decisions or
// evidence. A caller still supplies the currently read complete source bytes.
export function createScriptSpecifierCache() {
  const entries = new Map();
  let retainedBytes = 0;
  return (source, fileName, options, scan) => {
    const key = JSON.stringify([
      fileName,
      Boolean(options.harnessPreviewBoundary),
      createHash('sha256').update(source).digest('hex'),
    ]);
    if (entries.has(key)) return [...entries.get(key)];
    const result = scan();
    const bytes =
      Buffer.byteLength(key) + result.reduce((total, entry) => total + Buffer.byteLength(entry), 0);
    if (entries.size < 4096 && retainedBytes + bytes <= 8 * 1024 * 1024) {
      entries.set(key, [...result]);
      retainedBytes += bytes;
    }
    return result;
  };
}
let activeScriptSpecifierCache = null;
function scriptModuleSpecifiers(source, fileName, options = {}) {
  const scan = () => scanScriptModuleSpecifiers(source, fileName, options);
  return activeScriptSpecifierCache
    ? activeScriptSpecifierCache(source, fileName, options, scan)
    : scan();
}
function scanScriptModuleSpecifiers(source, fileName, { harnessPreviewBoundary = false } = {}) {
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
    const ordinaryTag =
      member?.name === 'createElement' &&
      ts.isStringLiteralLike(candidate.arguments[0]) &&
      candidate.arguments[0].text.toLowerCase() === tagName;
    const namespacedTag =
      member?.name === 'createElementNS' &&
      ts.isStringLiteralLike(candidate.arguments[0]) &&
      candidate.arguments[0].text === 'http://www.w3.org/1999/xhtml' &&
      candidate.arguments[1] &&
      ts.isStringLiteralLike(candidate.arguments[1]) &&
      candidate.arguments[1].text.split(':').at(-1) === tagName;
    return Boolean(
      member &&
      (ordinaryTag || namespacedTag) &&
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
  // Only literal strings and lexically resolved const-string bindings are
  // interpreted. No candidate expression, markup, CSS or script is executed.
  const literalString = (expression, useNode, seen = new Set()) => {
    if (!expression) return null;
    const candidate = unwrapTypeScriptExpression(expression);
    if (ts.isStringLiteralLike(candidate)) return candidate.text;
    if (!ts.isIdentifier(candidate) || seen.size >= 64) return null;
    const binding = receiverBindings.latestBinding(candidate.text, useNode);
    if (
      !binding?.initializer ||
      seen.has(binding) ||
      !ts.isVariableDeclaration(binding.node) ||
      !ts.isVariableDeclarationList(binding.node.parent) ||
      !(binding.node.parent.flags & ts.NodeFlags.Const)
    )
      return null;
    seen.add(binding);
    return literalString(binding.initializer, binding.node, seen);
  };
  const isDomMutationTarget = (expression, useNode, seen = new Set()) => {
    const candidate = unwrapTypeScriptExpression(expression);
    if (!isDomReceiverExpression(candidate, sourceFile, receiverBindings, useNode)) return false;
    if (!ts.isIdentifier(candidate)) return true;
    const binding = receiverBindings.latestBinding(candidate.text, useNode);
    if (!binding) return true;
    if (seen.has(binding) || seen.size >= 64) return false;
    seen.add(binding);
    const directDomType = (type) => {
      if (ts.isParenthesizedTypeNode(type)) return directDomType(type.type);
      if (ts.isUnionTypeNode(type) || ts.isIntersectionTypeNode(type))
        return type.types.some(directDomType);
      return (
        ts.isTypeReferenceNode(type) &&
        /^(?:Document|Element|HTMLElement|HTML[A-Za-z0-9]*Element|SVGElement|Window)$/u.test(
          type.typeName.getText(sourceFile)
        )
      );
    };
    // The older ownership heuristic accepts DOM types nested in containers.
    // A Record/Map/array of elements is not itself a DOM mutation target.
    if (
      binding.node.type &&
      isDomTypeNode(binding.node.type, sourceFile) &&
      !directDomType(binding.node.type)
    )
      return binding.initializer
        ? isDomMutationTarget(binding.initializer, binding.node, seen)
        : false;
    if (!binding.intrinsicallyDom && binding.initializer)
      return isDomMutationTarget(binding.initializer, binding.node, seen);
    return true;
  };
  const domElementNamespace = (expression, useNode, seen = new Set()) => {
    const namespaceFromType = (type) => {
      const text = type?.getText(sourceFile) ?? '';
      if (/^(?:HTMLElement|HTML[A-Za-z]+Element)(?:\s*\|\s*null)?$/u.test(text))
        return 'http://www.w3.org/1999/xhtml';
      if (/^SVG[A-Za-z]*Element(?:\s*\|\s*null)?$/u.test(text)) return 'http://www.w3.org/2000/svg';
      return null;
    };
    const candidate = unwrapTypeScriptExpression(expression);
    if (ts.isIdentifier(candidate)) {
      const binding = receiverBindings.latestBinding(candidate.text, useNode);
      if (!binding || seen.has(binding) || seen.size >= 64 || binding.destructuredProperties)
        return null;
      seen.add(binding);
      return (
        namespaceFromType(binding.node.type) ??
        (binding.initializer ? domElementNamespace(binding.initializer, binding.node, seen) : null)
      );
    }
    if (ts.isCallExpression(candidate)) {
      const member = staticMemberAccess(candidate.expression);
      if (
        member &&
        isBrowserDocumentExpression(member.receiver, sourceFile, receiverBindings, useNode)
      ) {
        if (member.name === 'createElement') return 'http://www.w3.org/1999/xhtml';
        if (member.name === 'createElementNS')
          return literalString(candidate.arguments[0], useNode);
      }
      return namespaceFromType(candidate.typeArguments?.[0]);
    }
    const member = staticMemberAccess(candidate);
    return member &&
      /^(?:body|documentElement)$/u.test(member.name) &&
      isBrowserDocumentExpression(member.receiver, sourceFile, receiverBindings, useNode)
      ? 'http://www.w3.org/1999/xhtml'
      : null;
  };
  const styleBodyProperties = new Set(['textContent', 'innerText', 'innerHTML']);
  const inspectStyleBody = (value, useNode) => {
    const css = literalString(value, useNode);
    if (css === null) {
      specifiers.push(UNVERIFIED_STYLE_BODY_SPECIFIER);
      return;
    }
    if (domCssHasUnverifiedResource(css)) specifiers.push(UNVERIFIED_DOM_RESOURCE_SPECIFIER);
    for (const target of styleModuleSpecifiers(css)) {
      const normalized = normalizeBrowserResourceUrl(target);
      // Browser-inserted CSS has a document base, not this source module's
      // directory. A local import cannot be silently resolved as a Vite edge.
      specifiers.push(
        /^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(normalized)
          ? `${EXTERNAL_STYLESHEET_ELEMENT_SPECIFIER_PREFIX}${normalized}>`
          : UNVERIFIED_STYLE_BODY_SPECIFIER
      );
    }
  };
  const inspectDomBodyProperty = (target, property, value, useNode) => {
    const style = resourceElementCreation(target, useNode, 'style');
    if (style && styleBodyProperties.has(property)) {
      inspectStyleBody(value, useNode);
      return;
    }
    if (
      !/^(?:innerHTML|outerHTML)$/u.test(property ?? '') ||
      !isDomMutationTarget(target, useNode) ||
      (property === 'innerHTML' && isScriptElementExpression(target, useNode))
    )
      return;
    const html = literalString(value, useNode);
    if (html === null) specifiers.push(OPAQUE_HTML_SINK_SPECIFIER);
    else if (literalHtmlHasUnreviewedEntry(html, specifiers))
      specifiers.push(UNVERIFIED_HTML_SINK_SPECIFIER);
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
    const style = resourceElementCreation(target, node, 'style');
    const dom = isDomMutationTarget(target, node);
    if (!script && !link && !style && !dom) return;
    const unknown = () => {
      if (dom) specifiers.push(OPAQUE_HTML_SINK_SPECIFIER);
      if (script) specifiers.push(DYNAMIC_EXECUTABLE_SCRIPT_SPECIFIER);
      if (style) specifiers.push(UNVERIFIED_STYLE_BODY_SPECIFIER);
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
        const key = ts.isComputedPropertyName(property.name)
          ? literalString(name, node)
          : ts.isIdentifier(name) || ts.isStringLiteralLike(name)
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
        inspectDomBodyProperty(target, key, value, node);
      }
    }
  };
  const inspectReflectResourceMutation = (node) => {
    if (!isGlobalMethod(node, node, 'Reflect', 'set') || !node.arguments[0]) return;
    const target = node.arguments[0];
    const script = isScriptElementExpression(target, node);
    const link = resourceElementCreation(target, node, 'link');
    const style = resourceElementCreation(target, node, 'style');
    const dom = isDomMutationTarget(target, node);
    if (!script && !link && !style && !dom) return;
    const argument = node.arguments[1] && unwrapTypeScriptExpression(node.arguments[1]);
    const property = literalString(argument, node);
    if (dom && property === null) specifiers.push(OPAQUE_HTML_SINK_SPECIFIER);
    inspectDomBodyProperty(target, property, node.arguments[2], node);
    if (style && property === null) specifiers.push(UNVERIFIED_STYLE_BODY_SPECIFIER);
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
  const timerMutatedBindings = new Set();
  const recordTimerMutationTarget = (expression) => {
    const candidate = unwrapTypeScriptExpression(expression);
    if (ts.isIdentifier(candidate)) {
      // Attribute writes to their nearest lexical declaration, rather than
      // poisoning an unrelated callback with the same spelling in another scope.
      for (let scope = scriptLexicalScope(candidate); scope; scope = scriptLexicalScope(scope)) {
        const declarations = (scriptElementBindings.get(candidate.text) ?? []).filter(
          (entry) => entry.scope === scope && !ts.isBinaryExpression(entry.node)
        );
        if (declarations.length) {
          declarations.forEach((binding) => timerMutatedBindings.add(binding));
          break;
        }
        if (ts.isSourceFile(scope)) break;
      }
    } else if (ts.isArrayLiteralExpression(candidate))
      candidate.elements.forEach(recordTimerMutationTarget);
    else if (ts.isObjectLiteralExpression(candidate))
      candidate.properties.forEach((property) => {
        if (ts.isShorthandPropertyAssignment(property)) recordTimerMutationTarget(property.name);
        else if (ts.isPropertyAssignment(property)) recordTimerMutationTarget(property.initializer);
        else if (ts.isSpreadAssignment(property)) recordTimerMutationTarget(property.expression);
      });
    else if (ts.isSpreadElement(candidate)) recordTimerMutationTarget(candidate.expression);
  };
  const collectTimerMutations = (node) => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    )
      recordTimerMutationTarget(node.left);
    if (
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator)
    )
      recordTimerMutationTarget(node.operand);
    if (ts.isForOfStatement(node) || ts.isForInStatement(node))
      recordTimerMutationTarget(node.initializer);
    ts.forEachChild(node, collectTimerMutations);
  };
  collectTimerMutations(sourceFile);
  // Timer handlers are executable inputs. Only syntax-proven callables bypass
  // the compilation wall; types, imported values and default parameters do not
  // prove what value reaches the browser. Mutable aliases remain unverified.
  const isProvenTimerCallback = (expression, useNode, seen = new Set()) => {
    if (!expression) return false;
    const candidate = unwrapTypeScriptExpression(expression);
    if (ts.isArrowFunction(candidate) || ts.isFunctionExpression(candidate)) return true;
    if (!ts.isIdentifier(candidate)) return false;
    const entries = scriptElementBindings.get(candidate.text) ?? [];
    for (let scope = scriptLexicalScope(useNode); scope; scope = scriptLexicalScope(scope)) {
      const local = entries.filter((entry) => entry.scope === scope);
      if (local.length) {
        if (local.length !== 1 || seen.has(local[0]) || seen.size >= 64) return false;
        const binding = local[0];
        if (timerMutatedBindings.has(binding)) return false;
        if (ts.isFunctionDeclaration(binding.node)) return Boolean(binding.node.body);
        if (
          !ts.isVariableDeclaration(binding.node) ||
          !ts.isVariableDeclarationList(binding.node.parent) ||
          !(binding.node.parent.flags & ts.NodeFlags.Const) ||
          binding.position >= useNode.getStart(sourceFile) ||
          !binding.initializer
        )
          return false;
        seen.add(binding);
        return isProvenTimerCallback(binding.initializer, binding.node, seen);
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
        ((['paintWorklet', 'animationWorklet', 'layoutWorklet'].includes(member.name) &&
          isBrowserGlobal(member.receiver, node, ['CSS'])) ||
          (member.name === 'audioWorklet' && isAudioContext(member.receiver, node, visited)))
      );
    });
  // WASM native provenance has its own complete lexical environment. Merely
  // binding a name suppresses the global; it does not prove the bound value.
  // Keep the older DOM/ownership receiver classifiers outside this repair.
  const wasmBindings = new Map();
  const wasmAssignments = [];
  const wasmScope = (node, functionOnly = false) => {
    for (let current = node.parent; current; current = current.parent) {
      if (
        ts.isFunctionLike(current) ||
        ts.isSourceFile(current) ||
        ts.isClassStaticBlockDeclaration(current) ||
        ts.isModuleBlock(current) ||
        (!functionOnly &&
          (ts.isBlock(current) ||
            ts.isCatchClause(current) ||
            ts.isForStatement(current) ||
            ts.isForOfStatement(current) ||
            ts.isForInStatement(current) ||
            ts.isCaseBlock(current) ||
            ts.isClassExpression(current) ||
            ts.isClassDeclaration(current)))
      )
        return current;
    }
    return null;
  };
  const wasmPropertyKey = (name) =>
    ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)
      ? name.text
      : ts.isComputedPropertyName(name) && ts.isStringLiteralLike(name.expression)
        ? name.expression.text
        : null;
  // TypeScript-only syntax is not a runtime shadow. Use the locked parser's
  // namespace instance classification rather than guessing from child names.
  // Const-enum-only namespaces/ambient const enums depend on emit options:
  // they cannot certify that a same-named browser value was replaced.
  const wasmBindingEmission = (node) => {
    if (ts.isFunctionDeclaration(node) && !node.body) return 'erased';
    let ambient = sourceFile.isDeclarationFile;
    for (let current = node; current; current = current.parent) {
      if (
        (ts.isImportClause(current) ||
          ts.isImportSpecifier(current) ||
          ts.isImportEqualsDeclaration(current)) &&
        current.isTypeOnly
      )
        return 'erased';
      if (
        ts.canHaveModifiers(current) &&
        ts.getModifiers(current)?.some((modifier) => modifier.kind === ts.SyntaxKind.DeclareKeyword)
      )
        ambient = true;
    }
    if (ambient)
      return ts.isEnumDeclaration(node) &&
        ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ConstKeyword)
        ? 'rewrite'
        : 'erased';
    if (ts.isModuleDeclaration(node)) {
      const state = ts.getModuleInstanceState(node);
      if (state === ts.ModuleInstanceState.NonInstantiated) return 'erased';
      if (state === ts.ModuleInstanceState.ConstEnumOnly) return 'rewrite';
    }
    return 'runtime';
  };
  const addWasmNames = (name, declaration, steps = []) => {
    const emission = wasmBindingEmission(declaration);
    if (emission === 'erased') return;

    if (ts.isIdentifier(name)) {
      const entries = wasmBindings.get(name.text) ?? [];
      const variable = ts.isVariableDeclaration(declaration);
      const hoisted =
        variable &&
        ts.isVariableDeclarationList(declaration.parent) &&
        !(declaration.parent.flags & ts.NodeFlags.BlockScoped);
      entries.push({
        node: declaration,
        steps,
        initializer: declaration.initializer ?? null,
        rewrite: emission === 'rewrite',
        scope: wasmScope(declaration, hoisted),
        position: declaration.getStart(sourceFile),
      });
      wasmBindings.set(name.text, entries);
      return;
    }
    for (const [index, element] of name.elements.entries()) {
      if (!ts.isBindingElement(element)) continue;
      const property = element.propertyName ?? element.name;
      const key = ts.isArrayBindingPattern(name)
        ? String(index)
        : ts.isIdentifier(property) ||
            ts.isStringLiteralLike(property) ||
            ts.isNumericLiteral(property)
          ? property.text
          : ts.isComputedPropertyName(property) && ts.isStringLiteralLike(property.expression)
            ? property.expression.text
            : null;
      addWasmNames(element.name, declaration, [
        ...steps,
        {
          key,
          rest: Boolean(element.dotDotDotToken),
          fallback: element.initializer ?? null,
          excluded: ts.isObjectBindingPattern(name)
            ? name.elements
                .slice(0, index)
                .map((previous) => wasmPropertyKey(previous.propertyName ?? previous.name))
                .filter((key) => key !== null)
            : [],
          restIndex: ts.isArrayBindingPattern(name) ? index : null,
        },
      ]);
    }
  };
  const collectWasmBindings = (node) => {
    if (ts.isVariableDeclaration(node) || ts.isParameter(node)) addWasmNames(node.name, node);
    else if (
      (ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isEnumDeclaration(node) ||
        ts.isImportEqualsDeclaration(node) ||
        (ts.isModuleDeclaration(node) && ts.isIdentifier(node.name)) ||
        ts.isImportClause(node) ||
        ts.isImportSpecifier(node) ||
        ts.isNamespaceImport(node)) &&
      node.name
    )
      addWasmNames(node.name, node);
    if (
      (ts.isFunctionExpression(node) || ts.isClassExpression(node)) &&
      node.name &&
      wasmBindingEmission(node) !== 'erased'
    ) {
      addWasmNames(node.name, node);
      wasmBindings.get(node.name.text).at(-1).scope = node;
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.left)
    )
      wasmAssignments.push(node);
    ts.forEachChild(node, collectWasmBindings);
  };
  collectWasmBindings(sourceFile);
  // Minified dependency bundles reuse a few names in thousands of scopes.
  // Index the completed, immutable inventory by its actual scope rather than
  // filtering every same-spelled binding for every native-entry probe.
  const wasmBindingsByScope = new WeakMap();
  for (const [name, entries] of wasmBindings)
    for (const entry of entries) {
      if (!wasmBindingsByScope.has(entry.scope)) wasmBindingsByScope.set(entry.scope, new Map());
      const scope = wasmBindingsByScope.get(entry.scope);
      if (!scope.has(name)) scope.set(name, []);
      scope.get(name).push(entry);
    }
  const wasmAssignmentsByName = new Map();
  for (const assignment of wasmAssignments) {
    const name = assignment.left.text;
    if (!wasmAssignmentsByName.has(name)) wasmAssignmentsByName.set(name, []);
    wasmAssignmentsByName.get(name).push(assignment);
  }
  const wasmBindingLookups = new WeakMap();
  const wasmBindingAt = (name, at) => {
    if (!wasmBindingLookups.has(at)) wasmBindingLookups.set(at, new Map());
    const cached = wasmBindingLookups.get(at);
    if (cached.has(name)) return cached.get(name);
    for (let scope = wasmScope(at); scope; scope = wasmScope(scope)) {
      const entries = wasmBindingsByScope.get(scope)?.get(name);
      if (entries?.length) {
        cached.set(name, entries);
        return entries;
      }
    }
    const empty = [];
    cached.set(name, empty);
    return empty;
  };
  const wasmMethods = new Set([
    'compile',
    'compileStreaming',
    'instantiate',
    'instantiateStreaming',
  ]);
  const wasmConstructors = new Set(['Module', 'Instance']);
  const wasmGlobals = new Set(['globalThis', 'window', 'self']);
  const wasmUnboundValue = (name) =>
    new Set(
      name === 'WebAssembly'
        ? ['wasm']
        : name === 'Reflect'
          ? ['reflect']
          : wasmGlobals.has(name)
            ? ['global']
            : ['unknown']
    );
  // A budget/cycle fallback is path-dependent uncertainty, not a reusable
  // aggregate fact. Do not let either positive or negative caches preserve it.
  let wasmProjectionIncomplete = 0;
  const wasmAggregateNativeContents = new WeakMap();
  const wasmMayContainNative = (values, at, seen, depth = 0, aggregates = new Set()) => {
    if (depth >= 64) {
      wasmProjectionIncomplete++;
      return true;
    }
    return [...values].some((value) => {
      if (typeof value === 'string') return !['defined', 'undefined', 'unknown'].includes(value);
      if (value.restSource !== undefined)
        return wasmMayContainNative(new Set([value.restSource]), at, seen, depth + 1, aggregates);
      if (aggregates.has(value)) {
        wasmProjectionIncomplete++;
        return true;
      }
      if (wasmAggregateNativeContents.has(value)) return wasmAggregateNativeContents.get(value);
      const visitedAggregates = new Set(aggregates).add(value);
      const completeAtStart = wasmProjectionIncomplete;
      const members = ts.isArrayLiteralExpression(value)
        ? value.elements
        : value.properties.flatMap((property) =>
            ts.isPropertyAssignment(property)
              ? [property.initializer]
              : ts.isShorthandPropertyAssignment(property)
                ? [property.name]
                : ts.isSpreadAssignment(property)
                  ? [property.expression]
                  : []
          );
      const result = members.some((member) =>
        wasmMayContainNative(
          wasmValue(member, member, new Set(seen)),
          member,
          seen,
          depth + 1,
          visitedAggregates
        )
      );
      if (completeAtStart === wasmProjectionIncomplete)
        wasmAggregateNativeContents.set(value, result);
      return result;
    });
  };
  const wasmAggregateProjections = new WeakMap();
  const projectWasmValue = (
    values,
    key,
    at,
    seen,
    rest = false,
    excluded = [],
    restIndex = null
  ) => {
    const result = new Set();
    for (const value of values) {
      // An aggregate can return through a later spread reassignment without
      // revisiting the binding in wasmValue's local path. Keep its projection
      // on the same branch's path so self/mutual spreads terminate. A cycle is
      // opaque, never proof that a possible native entry is absent.
      if (typeof value !== 'string' && (seen.has(value) || seen.size >= 64)) {
        wasmProjectionIncomplete++;
        result.add('unknown-native');
        continue;
      }
      const projectedSeen = typeof value === 'string' ? seen : new Set(seen).add(value);
      if (value === 'defined' || value === 'undefined') {
        result.add('undefined');
        continue;
      }
      if (value === 'unknown') {
        result.add('unknown');
        continue;
      }
      if (rest) {
        result.add({ restSource: value, excluded: new Set(excluded), restIndex });
        continue;
      }
      if (typeof value !== 'string' && value.restSource !== undefined) {
        if (value.excluded.has(key)) {
          result.add('undefined');
          continue;
        }
        const projectedKey =
          value.restIndex !== null && /^(?:0|[1-9][0-9]*)$/u.test(key ?? '')
            ? String(Number(key) + value.restIndex)
            : key;
        for (const projected of projectWasmValue(
          new Set([value.restSource]),
          projectedKey,
          at,
          projectedSeen
        ))
          result.add(projected);
        if (typeof value.restSource === 'string') result.add('undefined');
      } else if (typeof value !== 'string') {
        if (key === null) {
          // Literal aggregates containing a native source retain uncertainty;
          // a rest/default is not a claim that native properties were copied.
          if (wasmMayContainNative(new Set([value]), at, projectedSeen))
            result.add('unknown-native');
          continue;
        }
        const cached = wasmAggregateProjections.get(value)?.get(key);
        if (cached) {
          for (const entry of cached) result.add(entry);
          continue;
        }
        const completeAtStart = wasmProjectionIncomplete;
        // Literal members capture values when this literal is evaluated, not
        // when a later caller projects it. Later reassignments must not flow
        // backwards into an earlier spread snapshot.
        let projected = new Set(['undefined']);
        if (ts.isArrayLiteralExpression(value)) {
          const member = value.elements[Number(key)];
          if (member && !ts.isOmittedExpression(member))
            projected = wasmValue(member, member, new Set(projectedSeen));
        } else
          for (const property of value.properties) {
            if (ts.isPropertyAssignment(property) && wasmPropertyKey(property.name) === key)
              projected = wasmValue(property.initializer, property, new Set(projectedSeen));
            else if (ts.isShorthandPropertyAssignment(property) && property.name.text === key)
              projected = wasmValue(property.name, property, new Set(projectedSeen));
            else if (ts.isMethodDeclaration(property) && wasmPropertyKey(property.name) === key)
              projected = new Set(['defined']);
            else if (ts.isSpreadAssignment(property)) {
              for (const spread of projectWasmValue(
                wasmValue(property.expression, property, new Set(projectedSeen)),
                key,
                property,
                new Set(projectedSeen)
              ))
                projected.add(spread);
            }
          }
        // With the source position fixed above, static-key projection is a
        // reusable snapshot. Share it across historical spread branches so a
        // linear reassignment chain does not expand exponentially.
        if (completeAtStart === wasmProjectionIncomplete) {
          if (!wasmAggregateProjections.has(value)) wasmAggregateProjections.set(value, new Map());
          wasmAggregateProjections.get(value).set(key, projected);
        }
        for (const value of projected) result.add(value);
      } else if (value === 'unknown-native') result.add('unknown-native');
      else if (key === null) result.add(value === 'wasm' ? 'unknown-native' : 'unknown-container');
      else if (value === 'unknown-container' && wasmMethods.has(key)) result.add(`method:${key}`);
      else if (value === 'unknown-container' && wasmConstructors.has(key))
        result.add(`constructor:${key}`);
      else if (value === 'unknown-container' && key === 'WebAssembly') result.add('wasm');
      else if (value === 'global' && wasmGlobals.has(key)) result.add('global');
      else if (value === 'global' && key === 'WebAssembly') result.add('wasm');
      else if (value === 'global' && key === 'Reflect') result.add('reflect');
      else if (value === 'wasm' && wasmMethods.has(key)) result.add(`method:${key}`);
      else if (value === 'wasm' && wasmConstructors.has(key)) result.add(`constructor:${key}`);
      else if (value === 'wasm' && /^(?:Memory|Table|Global|Tag|Exception|validate)$/u.test(key))
        result.add('defined');
      else result.add('unknown');
    }
    return result;
  };
  const wasmValue = (expression, at, seen = new Set()) => {
    if (!expression) return new Set(['unknown']);
    if (seen.size >= 64) {
      wasmProjectionIncomplete++;
      return new Set(['unknown-native']);
    }
    const candidate = unwrapTypeScriptExpression(expression);
    if (ts.isIdentifier(candidate)) {
      const bindings = wasmBindingAt(candidate.text, at);
      if (bindings.length) {
        const result = new Set();
        for (const binding of bindings) {
          if (binding.position >= at.getStart(sourceFile)) continue;
          // Revisiting an earlier value of one binding is progress, as in
          // a=business; b=a; a=b. Only the same binding at the same evaluation
          // position is a cycle; the shared depth bound still limits the path.
          const visitKey = `binding:${binding.position}:${candidate.text}:${at.getStart(sourceFile)}`;
          if (seen.has(visitKey)) {
            wasmProjectionIncomplete++;
            result.add('unknown-native');
            continue;
          }
          const visited = new Set(seen).add(visitKey);
          let values = wasmValue(binding.initializer, binding.node, visited);
          if (binding.rewrite)
            for (const possible of wasmUnboundValue(candidate.text)) values.add(possible);
          for (const step of binding.steps) {
            values = projectWasmValue(
              values,
              step.key,
              binding.node,
              visited,
              step.rest,
              step.excluded,
              step.restIndex
            );
            if (
              step.fallback &&
              (values.size === 0 ||
                values.has('unknown') ||
                values.has('undefined') ||
                values.has('unknown-native') ||
                values.has('unknown-container'))
            )
              for (const fallback of wasmValue(step.fallback, binding.node, visited))
                values.add(fallback);
          }
          // Track only assignments bound to this declaration, never same-name
          // assignments under a different parameter/block/catch/loop scope.
          for (const assignment of wasmAssignmentsByName.get(candidate.text) ?? [])
            if (
              assignment.left.text === candidate.text &&
              assignment.end <= at.getStart(sourceFile) &&
              wasmBindingAt(candidate.text, assignment).includes(binding)
            )
              for (const value of wasmValue(assignment.right, assignment, visited))
                values.add(value);
          for (const value of values) result.add(value);
        }
        return result;
      }
      return wasmUnboundValue(candidate.text);
    }
    const member = staticMemberAccess(candidate);
    if (member)
      return projectWasmValue(wasmValue(member.receiver, at, seen), member.name, at, seen);
    if (ts.isElementAccessExpression(candidate))
      return projectWasmValue(
        wasmValue(candidate.expression, at, seen),
        ts.isNumericLiteral(candidate.argumentExpression)
          ? candidate.argumentExpression.text
          : null,
        at,
        seen
      );
    if (ts.isObjectLiteralExpression(candidate) || ts.isArrayLiteralExpression(candidate))
      return new Set([candidate]);
    if (
      ts.isFunctionExpression(candidate) ||
      ts.isArrowFunction(candidate) ||
      ts.isClassExpression(candidate) ||
      ts.isStringLiteralLike(candidate) ||
      ts.isNumericLiteral(candidate) ||
      [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(
        candidate.kind
      )
    )
      return new Set(['defined']);
    return new Set(['unknown']);
  };
  const isNativeWasmEntry = (expression, useNode, constructors = false) =>
    [...wasmValue(expression, useNode)].some(
      (value) =>
        typeof value === 'string' &&
        (value === 'unknown-native' || value.startsWith(constructors ? 'constructor:' : 'method:'))
    );
  // Reuse the complete lexical binding inventory, but project only these
  // browser receiver identities. No business object, callback or fetched code
  // is evaluated to discover a navigation or service-worker owner.
  const browserGlobalValue = (name) =>
    wasmGlobals.has(name)
      ? 'global'
      : ['navigator', 'location', 'document', 'open'].includes(name)
        ? name
        : null;
  const projectBrowserValue = (values, key) =>
    new Set(
      [...values].flatMap((value) => {
        if (value === 'opaque-browser' || key === null) return ['opaque-browser'];
        if (value === 'global' && wasmGlobals.has(key)) return ['global'];
        if (value === 'global' && ['navigator', 'location', 'document', 'open'].includes(key))
          return [key];
        if (value === 'document' && key === 'location') return ['location'];
        if (value === 'navigator' && key === 'serviceWorker') return ['service-worker'];
        if (value === 'service-worker' && key === 'register') return ['worker-register'];
        if (value === 'location' && key === 'href') return ['location-href'];
        if (value === 'location' && /^(?:assign|replace)$/u.test(key)) return ['location-navigate'];
        return [];
      })
    );
  const browserValue = (expression, at, seen = new Set()) => {
    if (!expression) return new Set();
    if (seen.size >= 64) return new Set(['opaque-browser']);
    const candidate = unwrapTypeScriptExpression(expression);
    if (ts.isIdentifier(candidate)) {
      const bindings = wasmBindingAt(candidate.text, at);
      if (bindings.length === 0) {
        const value = browserGlobalValue(candidate.text);
        return new Set(value ? [value] : []);
      }
      const result = new Set();
      for (const binding of bindings) {
        if (binding.position >= at.getStart(sourceFile) || seen.has(binding)) continue;
        const visited = new Set(seen).add(binding);
        let values = browserValue(binding.initializer, binding.node, visited);
        if (binding.rewrite) {
          const value = browserGlobalValue(candidate.text);
          if (value) values.add(value);
        }
        for (const step of binding.steps) {
          values = step.rest
            ? new Set(values.size > 0 ? ['opaque-browser'] : [])
            : projectBrowserValue(values, step.key);
          if ((values.size === 0 || values.has('opaque-browser')) && step.fallback)
            for (const value of browserValue(step.fallback, binding.node, visited))
              values.add(value);
        }
        for (const assignment of wasmAssignmentsByName.get(candidate.text) ?? [])
          if (
            assignment.left.text === candidate.text &&
            assignment.getStart(sourceFile) < at.getStart(sourceFile) &&
            wasmBindingAt(candidate.text, assignment).includes(binding)
          )
            for (const value of browserValue(assignment.right, assignment, visited))
              values.add(value);
        for (const value of values) result.add(value);
      }
      return result;
    }
    if (ts.isElementAccessExpression(candidate) && !staticMemberAccess(candidate)) {
      return projectBrowserValue(browserValue(candidate.expression, at, seen), null);
    }
    const member = staticMemberAccess(candidate);
    return member
      ? projectBrowserValue(browserValue(member.receiver, at, seen), member.name)
      : new Set();
  };
  const nativeConstBinding = (candidate, at, seen) => {
    if (!ts.isIdentifier(candidate) || seen.size >= 64) return null;
    const bindings = wasmBindingAt(candidate.text, at);
    if (bindings.length !== 1) return null;
    const binding = bindings[0];
    return !seen.has(binding) &&
      binding.position < at.getStart(sourceFile) &&
      binding.steps.length === 0 &&
      binding.initializer &&
      ts.isVariableDeclaration(binding.node) &&
      ts.isVariableDeclarationList(binding.node.parent) &&
      binding.node.parent.flags & ts.NodeFlags.Const
      ? binding
      : null;
  };
  const nativeLiteralString = (expression, at, seen = new Set()) => {
    if (!expression) return null;
    const candidate = unwrapTypeScriptExpression(expression);
    if (ts.isStringLiteralLike(candidate)) return candidate.text;
    const binding = nativeConstBinding(candidate, at, seen);
    return binding
      ? nativeLiteralString(binding.initializer, binding.node, new Set(seen).add(binding))
      : null;
  };
  const scriptResourceSpecifier = (node) => {
    const constructor = unwrapTypeScriptExpression(node.expression);
    const member = staticMemberAccess(constructor);
    const owner = member && unwrapTypeScriptExpression(member.receiver);
    const mayBeNative = (name) => {
      const bindings = wasmBindingAt(name, node);
      return bindings.length === 0 || bindings.some((binding) => binding.rewrite);
    };
    const nativeUrl = ts.isIdentifier(constructor)
      ? constructor.text === 'URL' && mayBeNative('URL')
      : member?.name === 'URL' &&
        ts.isIdentifier(owner) &&
        wasmGlobals.has(owner.text) &&
        mayBeNative(owner.text);
    if (!nativeUrl || !node.arguments?.[1]) return null;
    const base = staticMemberAccess(unwrapTypeScriptExpression(node.arguments[1]));
    const meta = base && unwrapTypeScriptExpression(base.receiver);
    if (
      base?.name !== 'url' ||
      !ts.isMetaProperty(meta) ||
      meta.keywordToken !== ts.SyntaxKind.ImportKeyword
    )
      return null;
    const target = nativeLiteralString(node.arguments[0], node);
    // Directory/base metadata is not a file asset. Other bases (location,
    // localization, business URLs) never enter this module-relative profile.
    if (target !== null && /^(?:\.{0,2}|(?:\.{1,2}\/)+)$/u.test(target)) return null;
    return `${SCRIPT_RESOURCE_SPECIFIER_PREFIX}${JSON.stringify(target)}>`;
  };
  const nodeModuleImports = new Map();
  for (const entries of wasmBindings.values())
    for (const binding of entries) {
      let declaration = binding.node;
      while (declaration && !ts.isImportDeclaration(declaration)) declaration = declaration.parent;
      if (
        !declaration ||
        !ts.isStringLiteralLike(declaration.moduleSpecifier) ||
        !['node:module', 'module'].includes(declaration.moduleSpecifier.text)
      )
        continue;
      if (ts.isImportSpecifier(binding.node)) {
        const importedName = (binding.node.propertyName ?? binding.node.name).text;
        if (importedName === 'createRequire') nodeModuleImports.set(binding, 'factory');
        else if (importedName === 'default') nodeModuleImports.set(binding, 'module');
      } else if (ts.isNamespaceImport(binding.node) || ts.isImportClause(binding.node))
        nodeModuleImports.set(binding, 'module');
    }
  const nodeLoaderCaptured = (binding, at) =>
    ts.isFunctionLike(wasmScope(at, true)) && wasmScope(at, true) !== wasmScope(binding.node, true);
  const nodeLoaderBindingVisible = (binding, at) =>
    binding.position < at.getStart(sourceFile) || nodeLoaderCaptured(binding, at);
  const nodeLoaderAssignmentVisible = (binding, assignment, at) =>
    assignment.end <= at.getStart(sourceFile) || nodeLoaderCaptured(binding, at);
  // A bounded resolver may run out of depth before reaching an import. Check
  // only its finite lexical dependency graph before making that opaque: a
  // deep business alias beside an unused Node import is not native evidence.
  const nodeLoaderMayBeNative = (expression, at) => {
    const pending = [[expression, at]];
    const visited = new Set();
    while (pending.length) {
      const [value, context] = pending.pop();
      if (!value) continue;
      const candidate = unwrapTypeScriptExpression(value);
      if (ts.isIdentifier(candidate)) {
        for (const binding of wasmBindingAt(candidate.text, context)) {
          if (nodeModuleImports.has(binding)) return true;
          if (!nodeLoaderBindingVisible(binding, context)) continue;
          const key = `${binding.position}:${candidate.text}:${context.getStart(sourceFile)}`;
          if (visited.has(key)) continue;
          visited.add(key);
          if (
            !binding.steps.some(
              (step) => !step.rest && step.key !== null && step.key !== 'createRequire'
            )
          )
            pending.push([binding.initializer, binding.node]);
          for (const assignment of wasmAssignmentsByName.get(candidate.text) ?? [])
            if (
              nodeLoaderAssignmentVisible(binding, assignment, context) &&
              wasmBindingAt(candidate.text, assignment).includes(binding)
            )
              pending.push([assignment.right, assignment]);
        }
      } else if (ts.isCallExpression(candidate)) pending.push([candidate.expression, candidate]);
      else {
        const member = staticMemberAccess(candidate);
        if (member?.name === 'createRequire') pending.push([member.receiver, context]);
      }
    }
    return false;
  };
  // Cache completed lexical results, not path-dependent cycle/depth fallbacks.
  // A result records every binding/use-context it consulted and its alias depth:
  // a different caller may reuse it only outside that ancestry and depth limit.
  const nodeLoaderCompleted = new WeakMap();
  const nodeLoaderFrames = [];
  let nodeLoaderFallbacks = 0;
  const nodeLoaderValue = (expression, at, seen = new Set()) => {
    if (!expression) return new Set();
    if (seen.size >= 64) {
      nodeLoaderFallbacks += 1;
      return new Set(nodeLoaderMayBeNative(expression, at) ? ['opaque'] : []);
    }
    const candidate = unwrapTypeScriptExpression(expression);
    const cached = nodeLoaderCompleted.get(candidate)?.get(at);
    if (
      cached &&
      seen.size + cached.depth < 64 &&
      ![...cached.dependencies].some((key) => seen.has(key))
    ) {
      for (const frame of nodeLoaderFrames) {
        for (const key of cached.dependencies) frame.dependencies.add(key);
        frame.depth = Math.max(frame.depth, seen.size - frame.startDepth + cached.depth);
      }
      return new Set(cached.values);
    }
    const frame = { dependencies: new Set(), startDepth: seen.size, depth: 0 };
    const fallbacks = nodeLoaderFallbacks;
    nodeLoaderFrames.push(frame);
    const result = resolveNodeLoaderValue(candidate, at, seen);
    nodeLoaderFrames.pop();
    if (fallbacks === nodeLoaderFallbacks) {
      const entries = nodeLoaderCompleted.get(candidate) ?? new WeakMap();
      entries.set(at, { ...frame, values: new Set(result) });
      nodeLoaderCompleted.set(candidate, entries);
    }
    return result;
  };
  const resolveNodeLoaderValue = (candidate, at, seen) => {
    if (ts.isIdentifier(candidate)) {
      const result = new Set();
      for (const binding of wasmBindingAt(candidate.text, at)) {
        const imported = nodeModuleImports.get(binding);
        if (imported) {
          result.add(imported);
          continue;
        }
        if (!nodeLoaderBindingVisible(binding, at)) continue;
        const visitKey = `node-loader:${binding.position}:${candidate.text}:${at.getStart(sourceFile)}`;
        for (const frame of nodeLoaderFrames) {
          frame.dependencies.add(visitKey);
          frame.depth = Math.max(frame.depth, seen.size + 1 - frame.startDepth);
        }
        if (seen.has(visitKey)) {
          nodeLoaderFallbacks += 1;
          if (nodeLoaderMayBeNative(candidate, at)) result.add('opaque');
          continue;
        }
        const visited = new Set(seen).add(visitKey);
        let values = nodeLoaderValue(binding.initializer, binding.node, visited);
        for (const step of binding.steps)
          values = new Set(
            [...values].flatMap((value) =>
              value === 'opaque' || step.rest || step.key === null
                ? ['opaque']
                : value === 'module' && step.key === 'createRequire'
                  ? ['factory']
                  : []
            )
          );
        for (const assignment of wasmAssignmentsByName.get(candidate.text) ?? [])
          if (
            nodeLoaderAssignmentVisible(binding, assignment, at) &&
            wasmBindingAt(candidate.text, assignment).includes(binding)
          ) {
            const assigned = nodeLoaderValue(assignment.right, assignment, visited);
            // Rebound native loader/factory values are unverified; do not
            // invent a control-flow proof or taint ordinary business aliases.
            if (values.size > 0 || assigned.size > 0) values = new Set(['opaque']);
          }
        if (binding.position >= at.getStart(sourceFile) && values.size > 0)
          values = new Set(['opaque']);
        for (const value of values) result.add(value);
      }
      return result;
    }
    if (ts.isCallExpression(candidate)) {
      const factory = nodeLoaderValue(candidate.expression, candidate, seen);
      return new Set(factory.has('factory') ? ['loader'] : factory.has('opaque') ? ['opaque'] : []);
    }
    const member = staticMemberAccess(candidate);
    if (member)
      return new Set(
        [...nodeLoaderValue(member.receiver, at, seen)].flatMap((value) =>
          value === 'opaque'
            ? ['opaque']
            : value === 'module' && member.name === 'createRequire'
              ? ['factory']
              : []
        )
      );
    return new Set();
  };
  const isNativeNavigationProperty = (receiver, property, at, attribute = false) =>
    ['a', 'area', 'form', 'button', 'input', 'iframe', 'frame', 'object'].some(
      (tag) =>
        (['button', 'input'].includes(tag)
          ? property === (attribute ? 'formaction' : 'formAction')
          : ['a', 'area'].includes(tag)
            ? property === 'href'
            : isNavigationUrlAttribute(tag, property)) &&
        Boolean(resourceElementCreation(receiver, at, tag))
    );
  const inspectNavigationValue = (expression, at) => {
    const literal = nativeLiteralString(expression, at);
    if (literal === null) specifiers.push(UNVERIFIED_DOM_RESOURCE_SPECIFIER);
    else if (isExecutableNavigationUrl(literal, false))
      specifiers.push(UNVERIFIED_NAVIGATION_URL_SPECIFIER);
  };
  const resourceNamespace = (expression, at, seen = new Set()) => {
    if (!expression) return 'other';
    const candidate = unwrapTypeScriptExpression(expression);
    if (
      candidate.kind === ts.SyntaxKind.NullKeyword ||
      (ts.isIdentifier(candidate) &&
        candidate.text === 'undefined' &&
        wasmBindingAt('undefined', at).length === 0)
    )
      return 'native';
    const literal = nativeLiteralString(candidate, at);
    if (literal !== null) return literal === '' ? 'native' : 'other';
    if (ts.isIdentifier(candidate) && seen.size < 64) {
      const binding = nativeConstBinding(candidate, at, seen);
      if (binding)
        return resourceNamespace(binding.initializer, binding.node, new Set(seen).add(binding));
    }
    return 'unknown';
  };
  const visit = (node) => {
    if (ts.isCallExpression(node) && nodeModuleImports.size > 0) {
      const loader = nodeLoaderValue(node.expression, node);
      if (loader.has('loader') || loader.has('opaque')) {
        // The Node factory's resolution base/result is not this parser's
        // ordinary import resolver. Keep consumption unverified instead of
        // manufacturing relative edges. Literal governed package identities
        // are retained for the existing installed-package layer inspection.
        specifiers.push(UNRESOLVED_DYNAMIC_REQUIRE_SPECIFIER);
        const target = nativeLiteralString(node.arguments[0], node);
        if (target?.startsWith('@proto.ui/')) specifiers.push(target);
      }
    }
    const assignmentTarget =
      ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
        ? unwrapTypeScriptExpression(node.left)
        : null;
    const nativeNavigationTarget =
      assignmentTarget &&
      (!ts.isIdentifier(assignmentTarget) ||
        (assignmentTarget.text === 'location' && wasmBindingAt('location', node).length === 0));
    if (
      (ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        !ts.isIdentifier(assignmentTarget) &&
        browserValue(node.left, node).has('opaque-browser')) ||
      (ts.isCallExpression(node) && browserValue(node.expression, node).has('opaque-browser'))
    )
      specifiers.push(UNVERIFIED_DOM_RESOURCE_SPECIFIER);
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      nativeNavigationTarget &&
      [...browserValue(node.left, node)].some(
        (value) => value === 'location' || value === 'location-href'
      )
    )
      inspectNavigationValue(node.right, node);
    if (
      ts.isCallExpression(node) &&
      [...browserValue(node.expression, node)].some(
        (value) => value === 'location-navigate' || value === 'open'
      )
    )
      inspectNavigationValue(node.arguments[0], node);
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const member = staticMemberAccess(node.expression);
      if (
        isNativeWasmEntry(node.expression, node, ts.isNewExpression(node)) ||
        (ts.isCallExpression(node) &&
          member &&
          /^(?:call|apply|bind)$/u.test(member.name) &&
          isNativeWasmEntry(member.receiver, node)) ||
        (ts.isCallExpression(node) &&
          member?.name === 'apply' &&
          wasmValue(member.receiver, node).has('reflect') &&
          node.arguments[0] &&
          isNativeWasmEntry(node.arguments[0], node))
      )
        specifiers.push(UNVERIFIED_RUNTIME_COMPILATION_SPECIFIER);
    }
    if (ts.isCallExpression(node)) {
      const isTimer = (expression) =>
        resolveLocalValue(expression, node, new Set(), (candidate, useNode) =>
          isBrowserGlobal(candidate, useNode, ['setTimeout', 'setInterval'])
        );
      const arrayHandler = (expression) => {
        const candidate = expression && unwrapTypeScriptExpression(expression);
        return candidate && ts.isArrayLiteralExpression(candidate) ? candidate.elements[0] : null;
      };
      let timer = isTimer(node.expression);
      let handler = node.arguments[0];
      const member = staticMemberAccess(node.expression);
      if (member && ['call', 'apply', 'bind'].includes(member.name) && isTimer(member.receiver)) {
        timer = true;
        handler = member.name === 'apply' ? arrayHandler(node.arguments[1]) : node.arguments[1];
      }
      if (
        isGlobalMethod(node, node, 'Reflect', 'apply') &&
        node.arguments[0] &&
        isTimer(node.arguments[0])
      ) {
        timer = true;
        handler = arrayHandler(node.arguments[2]);
      }
      if (timer && !isProvenTimerCallback(handler, node))
        specifiers.push(UNVERIFIED_RUNTIME_COMPILATION_SPECIFIER);
    }
    if (
      (ts.isCallExpression(node) || ts.isNewExpression(node)) &&
      resolveLocalValue(node.expression, node, new Set(), (candidate, useNode) =>
        isBrowserGlobal(candidate, useNode, ['eval', 'Function'])
      )
    )
      specifiers.push(UNVERIFIED_RUNTIME_COMPILATION_SPECIFIER);
    // Function receives the template array as constructor input and compiles
    // it after string coercion. eval as a tag receives a non-string and does
    // not share this behavior. No template body or payload is evaluated here.
    if (
      ts.isTaggedTemplateExpression(node) &&
      resolveLocalValue(node.tag, node, new Set(), (candidate, useNode) =>
        isBrowserGlobal(candidate, useNode, ['Function'])
      )
    )
      specifiers.push(UNVERIFIED_RUNTIME_COMPILATION_SPECIFIER);
    if (
      /\.[cm]?[jt]sx?$/iu.test(fileName) &&
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      ts.isIdentifier(node.tagName)
    ) {
      const tag = node.tagName.text;
      for (const attribute of node.attributes.properties) {
        if (!ts.isJsxAttribute(attribute)) continue;
        const name = attribute.name.getText(sourceFile);
        if (!isNavigationUrlAttribute(tag, name) || !attribute.initializer) continue;
        const quoted = ts.isStringLiteralLike(attribute.initializer);
        const value = quoted
          ? attribute.initializer
          : ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression
            ? unwrapTypeScriptExpression(attribute.initializer.expression)
            : null;
        if (value && ts.isStringLiteralLike(value) && isExecutableNavigationUrl(value.text, quoted))
          specifiers.push(UNVERIFIED_NAVIGATION_URL_SPECIFIER);
      }
      if (tag === 'link') {
        const attributes = new Map();
        let opaque = false;
        for (const attribute of node.attributes.properties) {
          if (!ts.isJsxAttribute(attribute)) {
            opaque = true;
            continue;
          }
          const name = attribute.name.getText(sourceFile);
          if (attributes.has(name)) opaque = true;
          const init = attribute.initializer;
          const value = init && ts.isJsxExpression(init) ? init.expression : init;
          const literal = nativeLiteralString(value, node);
          attributes.set(
            name,
            ts.isStringLiteralLike(init ?? {}) && literal?.includes('&') ? null : literal
          );
        }
        if (opaque) specifiers.push(DYNAMIC_STYLESHEET_REL_SPECIFIER);
        else if (attributes.has('href')) {
          const rel = attributes.get('rel');
          if (attributes.has('rel') && rel === null)
            specifiers.push(DYNAMIC_STYLESHEET_REL_SPECIFIER);
          else if (rel?.toLowerCase().split(/\s+/u).includes('stylesheet')) {
            const href = attributes.get('href');
            if (href === null) specifiers.push(DYNAMIC_STYLESHEET_LINK_SPECIFIER);
            else {
              const normalized = normalizeBrowserResourceUrl(href);
              if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(normalized))
                specifiers.push(`${EXTERNAL_STYLESHEET_ELEMENT_SPECIFIER_PREFIX}${normalized}>`);
            }
          }
        }
      }
      if (!harnessPreviewBoundary && /^(?:iframe|object|embed|webview)$/u.test(tag))
        specifiers.push(UNREVIEWED_WEBSITE_EMBED_SPECIFIER);
      if (/^s[cC][rR][iI][pP][tT]$/u.test(tag)) {
        const attributes = new Map();
        let opaque = false;
        for (const attribute of node.attributes.properties) {
          if (!ts.isJsxAttribute(attribute)) {
            opaque = true;
            continue;
          }
          const name = attribute.name.getText(sourceFile);
          if (attributes.has(name)) opaque = true;
          const initializer = attribute.initializer;
          attributes.set(
            name,
            initializer && ts.isJsxExpression(initializer) ? initializer.expression : initializer
          );
        }
        let svg = false;
        for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
          if (!ts.isJsxElement(ancestor) || ancestor.openingElement === node) continue;
          const name = ancestor.openingElement.tagName.getText(sourceFile);
          if (name === 'foreignObject') break;
          if (name === 'svg') {
            svg = true;
            break;
          }
        }
        const sourceName = svg
          ? attributes.has('href')
            ? 'href'
            : attributes.has('xlinkHref')
              ? 'xlinkHref'
              : 'xlink:href'
          : 'src';
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
          if (attributes.has(sourceName))
            specifiers.push(scriptElementSourceSpecifier(attributes.get(sourceName)));
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
      let assignedProperty = staticMemberAccess(node.left);
      const assignedTarget = unwrapTypeScriptExpression(node.left);
      if (!assignedProperty && ts.isElementAccessExpression(assignedTarget)) {
        const name = literalString(assignedTarget.argumentExpression, node);
        if (name !== null) assignedProperty = { name, receiver: assignedTarget.expression };
      }
      if (!assignedProperty && ts.isElementAccessExpression(assignedTarget)) {
        const receiver = assignedTarget.expression;
        if (isDomMutationTarget(receiver, node)) specifiers.push(OPAQUE_HTML_SINK_SPECIFIER);
        if (isScriptElementExpression(receiver, node))
          specifiers.push(DYNAMIC_EXECUTABLE_SCRIPT_SPECIFIER);
        if (resourceElementCreation(receiver, node, 'style'))
          specifiers.push(UNVERIFIED_STYLE_BODY_SPECIFIER);
        if (resourceElementCreation(receiver, node, 'link')) {
          recordLinkMutation(receiver, 'rel', null, node);
          recordLinkMutation(receiver, 'href', null, node);
        }
      }
      if (
        assignedProperty &&
        isNativeNavigationProperty(assignedProperty.receiver, assignedProperty.name, node)
      )
        inspectNavigationValue(
          node.operatorToken.kind === ts.SyntaxKind.EqualsToken ? node.right : undefined,
          node
        );
      if (assignedProperty) {
        recordLinkMutation(assignedProperty.receiver, assignedProperty.name, node.right, node);
        if (
          node.operatorToken.kind !== ts.SyntaxKind.EqualsToken &&
          /^(?:innerHTML|outerHTML)$/u.test(assignedProperty.name) &&
          isDomMutationTarget(assignedProperty.receiver, node)
        )
          specifiers.push(UNVERIFIED_HTML_SINK_SPECIFIER);
        else if (
          node.operatorToken.kind !== ts.SyntaxKind.EqualsToken &&
          styleBodyProperties.has(assignedProperty.name) &&
          resourceElementCreation(assignedProperty.receiver, node, 'style')
        )
          specifiers.push(UNVERIFIED_STYLE_BODY_SPECIFIER);
        else
          inspectDomBodyProperty(
            assignedProperty.receiver,
            assignedProperty.name,
            node.right,
            node
          );
      }
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
      // These browser methods parse markup without a module-graph edge. Keep
      // their bodies unverified rather than treating quoted HTML as inert JS.
      if (
        calledMember &&
        node.arguments.length > 0 &&
        ((/^(?:write|writeln)$/u.test(calledMember.name) &&
          resolveLocalValue(calledMember.receiver, node, new Set(), (candidate, useNode) =>
            isBrowserDocumentExpression(candidate, sourceFile, receiverBindings, useNode)
          )) ||
          (calledMember.name === 'insertAdjacentHTML' &&
            isDomReceiverExpression(calledMember.receiver, sourceFile, receiverBindings, node)))
      )
        specifiers.push(UNVERIFIED_HTML_SINK_SPECIFIER);
      if (
        calledMember &&
        scriptBodyMethods.has(calledMember.name) &&
        node.arguments.length > 0 &&
        isScriptElementExpression(calledMember.receiver, node)
      ) {
        specifiers.push(DYNAMIC_EXECUTABLE_SCRIPT_SPECIFIER);
      }
      if (
        calledMember &&
        scriptBodyMethods.has(calledMember.name) &&
        node.arguments.length > 0 &&
        resourceElementCreation(calledMember.receiver, node, 'style')
      ) {
        specifiers.push(UNVERIFIED_STYLE_BODY_SPECIFIER);
      }
      // Event-handler content attributes compile strings. Assigning a string
      // to an event-handler IDL property is a different operation.
      if (
        calledMember &&
        /^(?:setAttribute|setAttributeNS)$/u.test(calledMember.name) &&
        isDomMutationTarget(calledMember.receiver, node)
      ) {
        const namespaced = calledMember.name === 'setAttributeNS';
        const namespace = node.arguments[0] && unwrapTypeScriptExpression(node.arguments[0]);
        const nativeNamespace =
          !namespaced ||
          namespace?.kind === ts.SyntaxKind.NullKeyword ||
          literalString(namespace, node) === '';
        const rawName = literalString(node.arguments[namespaced ? 1 : 0], node);
        // DOM setAttributeNS preserves the local name's case. Ordinary
        // setAttribute folds ASCII case only for HTML elements/documents.
        const elementNamespace = domElementNamespace(calledMember.receiver, node);
        const lowercaseName = rawName?.replace(/[A-Z]/gu, (character) => character.toLowerCase());
        const name =
          !namespaced && elementNamespace === 'http://www.w3.org/1999/xhtml'
            ? lowercaseName
            : rawName;
        if (
          nativeNamespace &&
          (NATIVE_EVENT_ATTRIBUTE_NAMES.has(name) ||
            (!namespaced &&
              elementNamespace === null &&
              NATIVE_EVENT_ATTRIBUTE_NAMES.has(lowercaseName)))
        )
          specifiers.push(UNVERIFIED_MARKUP_HANDLER_SPECIFIER);
      }
      const namespaceAttribute = calledMember?.name === 'setAttributeNS';
      const namespaceKind = namespaceAttribute
        ? resourceNamespace(node.arguments[0], node)
        : 'native';
      const resourceAttributeCall =
        calledMember?.name === 'setAttribute' || (namespaceAttribute && namespaceKind === 'native');
      if (
        namespaceKind === 'unknown' &&
        (isScriptElementExpression(calledMember.receiver, node) ||
          resourceElementCreation(calledMember.receiver, node, 'link'))
      )
        specifiers.push(UNVERIFIED_DOM_RESOURCE_SPECIFIER);
      const resourceAttributeName = node.arguments[namespaceAttribute ? 1 : 0];
      const resourceAttributeValue = node.arguments[namespaceAttribute ? 2 : 1];
      if (resourceAttributeCall) {
        const rawProperty = nativeLiteralString(resourceAttributeName, node);
        const property =
          rawProperty === null
            ? null
            : namespaceAttribute
              ? rawProperty
              : rawProperty.toLowerCase();
        if (property && isNativeNavigationProperty(calledMember.receiver, property, node, true))
          inspectNavigationValue(resourceAttributeValue, node);
        if (property) {
          const literal = nativeLiteralString(resourceAttributeValue, node);
          recordLinkMutation(
            calledMember.receiver,
            property,
            literal === null ? null : ts.factory.createStringLiteral(literal),
            node
          );
        } else {
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
      let workerRegistration = browserValue(node.expression, node).has('worker-register');
      let workerArgument = node.arguments[0];
      if (
        calledMember &&
        ['call', 'apply'].includes(calledMember.name) &&
        browserValue(calledMember.receiver, node).has('worker-register')
      ) {
        workerRegistration = true;
        const args = node.arguments[1] && unwrapTypeScriptExpression(node.arguments[1]);
        workerArgument =
          calledMember.name === 'call'
            ? node.arguments[1]
            : args &&
                ts.isArrayLiteralExpression(args) &&
                args.elements.length > 0 &&
                !ts.isSpreadElement(args.elements[0])
              ? args.elements[0]
              : undefined;
      }
      if (workerRegistration) {
        const argument = workerArgument && unwrapTypeScriptExpression(workerArgument);
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
        resourceAttributeCall &&
        isScriptElementExpression(calledMember.receiver, node) &&
        resourceAttributeName &&
        (namespaceAttribute
          ? nativeLiteralString(resourceAttributeName, node)
          : nativeLiteralString(resourceAttributeName, node)?.toLowerCase()) === 'src'
      ) {
        specifiers.push(scriptElementSourceSpecifier(resourceAttributeValue));
      }
    }
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      addLiteral(node.moduleSpecifier);
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const nativeImportScripts = (expression, useNode) =>
        resolveLocalValue(expression, useNode, new Set(), (candidate, at) => {
          if (ts.isIdentifier(candidate))
            return (
              candidate.text === 'importScripts' &&
              !receiverBindings.hasLocalBinding('importScripts', at)
            );
          const member = staticMemberAccess(candidate);
          return (
            member?.name === 'importScripts' &&
            ts.isIdentifier(member.receiver) &&
            /^(?:globalThis|self)$/u.test(member.receiver.text) &&
            !receiverBindings.hasLocalBinding(member.receiver.text, at)
          );
        });
      const invocation = staticMemberAccess(callee);
      const indirectImportScripts =
        invocation &&
        /^(?:call|apply)$/u.test(invocation.name) &&
        nativeImportScripts(invocation.receiver, node);
      const isImportScriptsCall = nativeImportScripts(callee, node);
      const isImportMetaGlob =
        ts.isPropertyAccessExpression(callee) &&
        /^(?:glob|globEager)$/u.test(callee.name.text) &&
        ts.isMetaProperty(callee.expression) &&
        callee.expression.keywordToken === ts.SyntaxKind.ImportKeyword;
      if (isImportScriptsCall || indirectImportScripts) {
        let argumentsToInspect = [...node.arguments];
        if (indirectImportScripts) {
          const receiver = node.arguments[0] && unwrapTypeScriptExpression(node.arguments[0]);
          const nativeReceiver =
            receiver &&
            ts.isIdentifier(receiver) &&
            /^(?:self|globalThis)$/u.test(receiver.text) &&
            !receiverBindings.hasLocalBinding(receiver.text, node);
          // A static business receiver cannot invoke this native Worker method.
          // Opaque rebinding is unverified, never evidence of a loaded URL.
          if (!nativeReceiver) {
            if (!receiver || !ts.isObjectLiteralExpression(receiver))
              specifiers.push(UNRESOLVED_IMPORTSCRIPTS_SPECIFIER);
            argumentsToInspect = [];
          } else if (invocation.name === 'call') argumentsToInspect = node.arguments.slice(1);
          else {
            const list = node.arguments[1] && unwrapTypeScriptExpression(node.arguments[1]);
            if (
              !list ||
              list.kind === ts.SyntaxKind.NullKeyword ||
              (ts.isIdentifier(list) &&
                list.text === 'undefined' &&
                !receiverBindings.hasLocalBinding('undefined', node))
            )
              argumentsToInspect = [];
            else if (ts.isArrayLiteralExpression(list)) argumentsToInspect = [...list.elements];
            else {
              specifiers.push(UNRESOLVED_IMPORTSCRIPTS_SPECIFIER);
              argumentsToInspect = [];
            }
          }
        }
        for (const argument of argumentsToInspect)
          specifiers.push(importScriptsTargetSpecifier(argument, literalBindings));
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
      const resourceSpecifier = scriptResourceSpecifier(node);
      if (resourceSpecifier) specifiers.push(resourceSpecifier);
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

// Tokenize entire attributes, never suffix-match names or scan inside values.
// This is shared by literal HTML and template opening tags; expression-valued
// attributes remain opaque instead of being interpreted as HTML strings.
function markupAttributeTokens(openingTag, caseSensitive = false) {
  const attributes = new Map();
  let cursor = openingTag.match(/^<[^\s/>]+/u)?.[0].length ?? openingTag.length;
  while (cursor < openingTag.length) {
    while (/[\t\n\r\f /]/u.test(openingTag[cursor] ?? '')) cursor += 1;
    if (!openingTag[cursor] || openingTag[cursor] === '>') break;
    const start = cursor;
    while (cursor < openingTag.length && !/[\t\n\r\f /=>]/u.test(openingTag[cursor])) cursor += 1;
    const authoredName = openingTag.slice(start, cursor);
    const name = caseSensitive ? authoredName : authoredName.toLowerCase();
    if (!name) {
      cursor += 1;
      continue;
    }
    while (/[\t\n\r\f ]/u.test(openingTag[cursor] ?? '')) cursor += 1;
    let value = '';
    let dynamic = false;
    if (openingTag[cursor] === '=') {
      cursor += 1;
      while (/[\t\n\r\f ]/u.test(openingTag[cursor] ?? '')) cursor += 1;
      const quote = openingTag[cursor];
      if (quote === '"' || quote === "'") {
        const valueStart = ++cursor;
        while (cursor < openingTag.length && openingTag[cursor] !== quote) cursor += 1;
        value = openingTag.slice(valueStart, cursor);
        if (openingTag[cursor] !== quote) dynamic = true;
        else cursor += 1;
      } else if (quote === '{') {
        // Skip the whole expression, including quoted attribute-looking text.
        dynamic = true;
        let depth = 0;
        let string = null;
        do {
          const character = openingTag[cursor++];
          if (string) {
            if (character === '\\') cursor += 1;
            else if (character === string) string = null;
          } else if (/['"`]/u.test(character)) string = character;
          else if (character === '{') depth += 1;
          else if (character === '}') depth -= 1;
        } while (cursor < openingTag.length && depth > 0);
        value = null;
      } else {
        const valueStart = cursor;
        while (cursor < openingTag.length && !/[\t\n\r\f >]/u.test(openingTag[cursor])) cursor += 1;
        value = openingTag.slice(valueStart, cursor);
        dynamic = /[{}\x60]/u.test(value);
      }
    }
    // Native HTML keeps the first duplicate attribute.
    if (!attributes.has(name)) attributes.set(name, { value, dynamic });
  }
  return attributes;
}
function staticMarkupAttribute(openingTag, name) {
  const attribute = markupAttributeTokens(openingTag).get(name.toLowerCase());
  return attribute && !attribute.dynamic ? attribute.value : null;
}
function hasMarkupAttribute(openingTag, ...names) {
  const attributes = markupAttributeTokens(openingTag);
  return names.some((name) => attributes.has(name));
}
function dynamicMarkupAttribute(openingTag, name) {
  const attributes = markupAttributeTokens(openingTag);
  return Boolean(
    attributes.get(name)?.dynamic || attributes.has(`:${name}`) || attributes.has(`v-bind:${name}`)
  );
}
function hasHtmlCharacterReference(value) {
  return /&(?:#(?:\d+|x[\da-f]+);?|[a-z][a-z\d]+;)/iu.test(value);
}

function isExecutableScriptType(type) {
  if (type === null || type.trim() === '' || type.trim().toLowerCase() === 'module') return true;
  const essence = type.split(';', 1)[0].trim().toLowerCase();
  return /^(?:(?:application|text)\/(?:javascript|ecmascript|x-javascript|x-ecmascript)|text\/(?:javascript1\.[0-5]|jscript|livescript))$/u.test(
    essence
  );
}
const DYNAMIC_EXECUTABLE_SCRIPT_SPECIFIER = '<dynamic executable script src>';
const UNREVIEWED_WEBSITE_EMBED_SPECIFIER = '<unreviewed Website embed>';
const UNVERIFIED_MARKUP_HANDLER_SPECIFIER = '<unverified markup event handler>';
const UNVERIFIED_HTML_SINK_SPECIFIER = '<unverified DOM HTML sink>';
const OPAQUE_HTML_SINK_SPECIFIER = '<opaque DOM HTML sink>';
const UNVERIFIED_DOM_RESOURCE_SPECIFIER = '<unverified DOM-authored resource>';
const UNVERIFIED_STYLE_BODY_SPECIFIER = '<unverified DOM style body>';

function domCssHasUnverifiedResource(css) {
  try {
    // Reuse the existing CSS URL lexer without reading a candidate file. DOM
    // strings have a browser base, so this repair does not certify their URLs
    // against the JavaScript file's source directory.
    return promotionStyleResourceUrls('<DOM CSS>', [css]).length > 0;
  } catch {
    return true;
  }
}

function literalHtmlHasUnreviewedEntry(html, specifiers) {
  let unverified = false;
  const visit = (node) => {
    const attrs = new Map((node.attrs ?? []).map((attr) => [attr.name, attr.value]));
    if (
      node.tagName === 'script' ||
      /^(?:iframe|object|embed|webview|base)$/u.test(node.tagName ?? '') ||
      (node.tagName === 'link' &&
        (attrs.get('rel') ?? '').toLowerCase().split(/\s+/u).includes('stylesheet'))
    )
      unverified = true;
    if (
      node.tagName === 'style' &&
      styleModuleSpecifiers((node.childNodes ?? []).map((child) => child.value ?? '').join(''))
        .length
    )
      unverified = true;
    const css =
      node.tagName === 'style'
        ? (node.childNodes ?? []).map((child) => child.value ?? '').join('')
        : attrs.get('style');
    if (typeof css === 'string' && domCssHasUnverifiedResource(css))
      specifiers.push(UNVERIFIED_DOM_RESOURCE_SPECIFIER);
    const resourceNames = /^(?:img|source|video|audio|track|input|image|use|link)$/u.test(
      node.tagName ?? ''
    )
      ? ['src', 'srcset', 'poster', 'href']
      : [];
    for (const name of resourceNames) {
      if (!attrs.has(name)) continue;
      const url = normalizeBrowserResourceUrl(attrs.get(name));
      if (name === 'srcset' || (!url.startsWith('#') && !/^data:/iu.test(url)))
        specifiers.push(UNVERIFIED_DOM_RESOURCE_SPECIFIER);
    }
    for (const [name, value] of attrs)
      if (
        NATIVE_EVENT_ATTRIBUTE_NAMES.has(name) ||
        (isNavigationUrlAttribute(node.tagName, name) && isExecutableNavigationUrl(value))
      )
        unverified = true;
    for (const child of node.childNodes ?? []) visit(child);
    if (node.content) visit(node.content);
  };
  // A document parse drops context-dependent table tags; a default template
  // fragment retains them. Keep the document view too so html/body wrapper
  // attributes cannot disappear in the opposite direction. These are
  // conservative inspection views, not an inferred live insertion context.
  visit(parseHtmlFragment(html));
  visit(parseHtml(html));
  return unverified;
}
const UNVERIFIED_NAVIGATION_URL_SPECIFIER = '<unverified executable navigation URL>';
const SCRIPT_RESOURCE_SPECIFIER_PREFIX = '<module-relative script resource ';
function isScriptResourceSpecifier(specifier) {
  return specifier.startsWith(SCRIPT_RESOURCE_SPECIFIER_PREFIX) && specifier.endsWith('>');
}
function isNavigationUrlAttribute(tag, name) {
  return (
    (/^(?:a|area)$/u.test(tag) && /^(?:href|xlink:href)$/u.test(name)) ||
    (tag === 'form' && name === 'action') ||
    (/^(?:button|input)$/u.test(tag) && name.toLowerCase() === 'formaction') ||
    (/^(?:iframe|frame)$/u.test(tag) && name === 'src') ||
    (tag === 'object' && name === 'data')
  );
}
function isExecutableNavigationUrl(value, decodeEntities = false) {
  // HTML/JSX attribute text decodes character references before URL parsing;
  // JavaScript expression strings do not. This never evaluates URL payloads.
  if (decodeEntities && value.includes('&')) {
    const parsed = parseHtml(`<a href="${value.replaceAll('"', '&quot;')}"></a>`);
    const find = (node) =>
      node.tagName === 'a'
        ? node.attrs.find((attr) => attr.name === 'href')?.value
        : (node.childNodes ?? []).map(find).find((result) => result !== undefined);
    value = find(parsed) ?? value;
  }
  return /^javascript:/iu.test(normalizeBrowserResourceUrl(value));
}
const UNVERIFIED_RUNTIME_COMPILATION_SPECIFIER = '<unverified runtime compilation>';
const DYNAMIC_STYLESHEET_LINK_SPECIFIER = '<dynamic stylesheet href>';
const DYNAMIC_STYLESHEET_REL_SPECIFIER = '<dynamic stylesheet relation>';
const DYNAMIC_DOCUMENT_BASE_SPECIFIER = '<dynamic document base href>';
const DYNAMIC_EXECUTABLE_SCRIPT_TYPE_SPECIFIER = '<dynamic executable script type>';

function externalScriptModuleSpecifiers(content, absolutePath = 'source.html') {
  let markup = content;
  if (/\.mdx?$/iu.test(absolutePath)) {
    try {
      markup = maskMdxEsmLiteralText(markdownResourceSource(content, absolutePath), absolutePath);
    } catch {
      return [DYNAMIC_EXECUTABLE_SCRIPT_SPECIFIER];
    }
  }
  markup = markup.replace(/^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/u, '');
  const framework = !/\.(?:html?|md)$/iu.test(absolutePath);
  const masked = framework ? maskStringsInMdxBraceExpressions(markup) : markup;
  // HTML parsing supplies foreign-content and integration-point namespaces.
  // Capitalized framework components must not become native SVG/script tags
  // merely because the HTML tokenizer folds their spelling.
  const parseable = framework ? masked.replace(/(<\/?)[A-Z]/gu, '$1x') : masked;
  const svgScripts = new Set();
  const inspect = (node) => {
    if (
      node.namespaceURI === 'http://www.w3.org/2000/svg' &&
      node.tagName === 'script' &&
      node.sourceCodeLocation?.startTag
    )
      svgScripts.add(node.sourceCodeLocation.startTag.startOffset);
    for (const child of node.childNodes ?? []) inspect(child);
    if (node.content) inspect(node.content);
  };
  inspect(parseHtmlFragment(parseable, { sourceCodeLocationInfo: true }));
  inspect(parseHtml(parseable, { sourceCodeLocationInfo: true }));
  return jsxOpeningTagCandidates(masked, { includeOffsets: true })
    .filter(({ start, end }) =>
      (framework
        ? /^<s[cC][rR][iI][pP][tT](?=[\t\n\r\f />])/u
        : /^<script(?=[\t\n\r\f />])/iu
      ).test(markup.slice(start, end))
    )
    .flatMap(({ start, end }) => {
      const openingTag = markup.slice(start, end);
      const svg = svgScripts.has(start);
      if (
        svg &&
        framework &&
        [...markupAttributeTokens(openingTag).keys()].some(
          (name) =>
            name.startsWith('{') ||
            name === 'v-bind' ||
            name.startsWith('v-bind:[') ||
            name.startsWith(':[')
        )
      )
        return [DYNAMIC_EXECUTABLE_SCRIPT_SPECIFIER];
      // SVG2 href wins by presence, including an opaque/empty value. The
      // deprecated XLink attribute is a fallback, never an additional load.
      const sourceName = svg
        ? hasMarkupAttribute(openingTag, 'href', ':href', 'v-bind:href')
          ? 'href'
          : /\.mdx$/iu.test(absolutePath) &&
              markupAttributeTokens(openingTag, true).has('xlinkHref')
            ? 'xlinkhref'
            : 'xlink:href'
        : 'src';
      const hasSource = hasMarkupAttribute(
        openingTag,
        sourceName,
        `:${sourceName}`,
        `v-bind:${sourceName}`
      );
      const type = staticMarkupAttribute(openingTag, 'type');
      const dynamicType =
        dynamicMarkupAttribute(openingTag, 'type') ||
        (type !== null && hasHtmlCharacterReference(type));
      if (hasSource && dynamicType) return [DYNAMIC_EXECUTABLE_SCRIPT_TYPE_SPECIFIER];
      if (!isExecutableScriptType(type) || !hasSource) return [];
      if (dynamicMarkupAttribute(openingTag, sourceName))
        return [DYNAMIC_EXECUTABLE_SCRIPT_SPECIFIER];
      const specifier = staticMarkupResourceUrl(openingTag, sourceName);
      if (!specifier || /[{}\x60]/u.test(specifier) || hasHtmlCharacterReference(specifier))
        return [DYNAMIC_EXECUTABLE_SCRIPT_SPECIFIER];
      return [specifier];
    });
}

function documentBaseSpecifiers(content, absolutePath) {
  if (/\.vue$/iu.test(absolutePath)) {
    try {
      return authoredVueResourceTags(content, absolutePath)
        .filter(({ name }) => name === 'base')
        .flatMap(({ attributes }) => {
          for (const name of attributes.keys())
            if (name.toLowerCase() === ':href' || name === 'v-bind')
              return [DYNAMIC_DOCUMENT_BASE_SPECIFIER];
          const href = attributes.get('href');
          if (!href) return [];
          if (href.encoded || /[{}\x60]/u.test(href.value))
            return [DYNAMIC_DOCUMENT_BASE_SPECIFIER];
          const url = normalizeBrowserResourceUrl(href.value);
          if (!url) return [DYNAMIC_DOCUMENT_BASE_SPECIFIER];
          return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(url) ? [url] : [];
        });
    } catch {
      return [DYNAMIC_DOCUMENT_BASE_SPECIFIER];
    }
  }
  return jsxOpeningTagCandidates(content)
    .filter((openingTag) => /^<base\b/iu.test(openingTag))
    .flatMap((openingTag) => {
      const hasHref = hasMarkupAttribute(openingTag, 'href', ':href', 'v-bind:href');
      if (!hasHref) return [];
      if (dynamicMarkupAttribute(openingTag, 'href')) {
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
      const hasHref = hasMarkupAttribute(openingTag, 'href', ':href', 'v-bind:href');
      if (!hasHref) return [];

      const hasRel = hasMarkupAttribute(openingTag, 'rel');
      const relAttribute = staticMarkupAttribute(openingTag, 'rel');
      const dynamicRel =
        dynamicMarkupAttribute(openingTag, 'rel') ||
        (relAttribute !== null && hasHtmlCharacterReference(relAttribute));

      if (dynamicRel) return [DYNAMIC_STYLESHEET_REL_SPECIFIER];
      if (!hasRel) return [];

      const rel = staticMarkupAttribute(openingTag, 'rel');
      if (rel === null || /[{}\x60]/u.test(rel)) {
        return [DYNAMIC_STYLESHEET_REL_SPECIFIER];
      }
      if (!rel.split(/\s+/u).some((token) => token.toLowerCase() === 'stylesheet')) return [];

      if (dynamicMarkupAttribute(openingTag, 'href')) {
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
      dynamicMarkupAttribute(openingTag, 'type') ||
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

function astroHeadImportMapIssues(
  rootDir,
  localStylesheets = [],
  inlineStyles = [],
  { promotion = false } = {}
) {
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
      if (tag.toLowerCase() !== 'script') {
        if (!['link', 'base', 'style'].includes(tag.toLowerCase())) continue;
        const attrs = item.has('attrs') ? fields(item.get('attrs')) : new Map();
        if (!attrs) {
          reject('dynamic head resource attributes are unverified');
          continue;
        }
        const attributes = [];
        let opaque = false;
        for (const [name, value] of attrs) {
          // Astro stringifies booleans on non-boolean resource attributes.
          // They are not absent/bare HTML flags; keep non-string URLs/relations
          // unverified rather than silently omitting a stylesheet/base edge.
          if (
            /^(?:href|rel)$/iu.test(name) &&
            (value.kind === ts.SyntaxKind.FalseKeyword || value.kind === ts.SyntaxKind.TrueKeyword)
          ) {
            opaque = true;
            break;
          }
          if (value.kind === ts.SyntaxKind.FalseKeyword) continue;
          if (value.kind === ts.SyntaxKind.TrueKeyword && /^[a-z][\w:-]*$/iu.test(name)) {
            attributes.push(name);
            continue;
          }
          const text = literal(value);
          if (text === null || /["<>]/u.test(text) || !/^[a-z][\w:-]*$/iu.test(name)) {
            opaque = true;
            break;
          }
          attributes.push(`${name}="${text}"`);
        }
        if (opaque) {
          reject('dynamic head resource attributes are unverified');
          continue;
        }
        if (
          promotion &&
          tag.toLowerCase() === 'base' &&
          [...attrs.keys()].some((name) => name.toLowerCase() === 'href')
        ) {
          reject('promotion document base href resolution is unverified');
          continue;
        }
        const markup = `<${tag.toLowerCase()} ${attributes.join(' ')}>`;
        for (const specifier of documentBaseSpecifiers(markup, absolutePath))
          issues.push({
            sourcePath,
            specifier,
            category:
              specifier === DYNAMIC_DOCUMENT_BASE_SPECIFIER
                ? 'dynamic-document-base'
                : 'external-document-base',
            resolvedPath: null,
          });
        const styles = stylesheetLinkSpecifiers(markup);
        if (tag.toLowerCase() === 'style') {
          const style = literal(item.get('content'));
          if (style === null) {
            reject('dynamic head stylesheet content is unverified');
            continue;
          }
          inlineStyles.push(style);
          styles.push(...styleModuleSpecifiers(style));
        }
        for (const specifier of styles) {
          const category =
            specifier === DYNAMIC_STYLESHEET_REL_SPECIFIER
              ? 'dynamic-stylesheet-relation'
              : specifier === DYNAMIC_STYLESHEET_LINK_SPECIFIER
                ? 'dynamic-stylesheet-link'
                : /^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(specifier)
                  ? 'external-stylesheet'
                  : null;
          if (category) issues.push({ sourcePath, specifier, category, resolvedPath: null });
          else
            localStylesheets.push(
              specifier.startsWith('/') || specifier.startsWith('.') ? specifier : `./${specifier}`
            );
        }
        continue;
      }
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
  // Follow only the exported Astro configuration and its Starlight options.
  // A business object's `head` field elsewhere in this module is not emitted HTML.
  const configNames = new Set(['defineConfig']);
  const starlightNames = new Set(['starlight']);
  const otherIntegrationNames = new Set();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteralLike(statement.moduleSpecifier))
      continue;
    const module = statement.moduleSpecifier.text;
    const clause = statement.importClause;
    if (module === '@astrojs/starlight' && clause?.name) starlightNames.add(clause.name.text);
    if (module !== '@astrojs/starlight' && module !== 'astro/config') {
      if (clause?.name) otherIntegrationNames.add(clause.name.text);
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings))
        for (const binding of clause.namedBindings.elements)
          otherIntegrationNames.add(binding.name.text);
    }
    if (
      module === 'astro/config' &&
      clause?.namedBindings &&
      ts.isNamedImports(clause.namedBindings)
    )
      for (const binding of clause.namedBindings.elements)
        if ((binding.propertyName ?? binding.name).text === 'defineConfig')
          configNames.add(binding.name.text);
  }
  const active = new Set();
  const inspectConfig = (expression) => {
    const node = unwrapTypeScriptExpression(expression);
    if (active.has(node)) {
      reject('cyclic head configuration is unverified');
      return;
    }
    active.add(node);
    try {
      if (ts.isIdentifier(node)) {
        // A const object can still be mutated or escape through an alias. Do
        // not certify its historical/config-emitted shape from its initializer.
        reject('dynamic or shorthand head configuration is unverified');
        return;
      }
      if (ts.isCallExpression(node)) {
        if (
          ts.isIdentifier(node.expression) &&
          (configNames.has(node.expression.text) || starlightNames.has(node.expression.text)) &&
          node.arguments.length === 1
        )
          inspectConfig(node.arguments[0]);
        else reject('dynamic or shorthand head configuration is unverified');
        return;
      }
      if (!ts.isObjectLiteralExpression(node)) {
        reject('dynamic or shorthand head configuration is unverified');
        return;
      }
      for (const property of node.properties) {
        if (ts.isSpreadAssignment(property)) {
          reject('spread config field is unverified');
          continue;
        }
        const name = propertyName(property.name);
        if (name === null) {
          reject('computed config field is unverified');
          continue;
        }
        if (name === 'head') {
          if (ts.isPropertyAssignment(property)) inspectHead(property.initializer);
          else reject('shorthand head configuration is unverified');
        } else if (name === 'integrations') {
          if (!ts.isPropertyAssignment(property)) {
            reject('shorthand or getter integration head configuration is unverified');
            continue;
          }
          const integrations = unwrapTypeScriptExpression(property.initializer);
          if (!ts.isArrayLiteralExpression(integrations)) {
            reject('dynamic integration head configuration is unverified');
            continue;
          }
          for (const integration of integrations.elements) {
            const entry = unwrapTypeScriptExpression(integration);
            if (ts.isCallExpression(entry) && ts.isIdentifier(entry.expression)) {
              if (starlightNames.has(entry.expression.text)) inspectConfig(entry);
              else if (!otherIntegrationNames.has(entry.expression.text))
                reject('opaque integration head configuration is unverified');
            } else reject('opaque integration head configuration is unverified');
          }
        }
      }
    } finally {
      active.delete(node);
    }
  };
  for (const statement of sourceFile.statements) {
    if (ts.isExportAssignment(statement) && !statement.isExportEquals)
      inspectConfig(statement.expression);
    else if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause) &&
      statement.exportClause.elements.some((entry) => entry.name.text === 'default')
    )
      reject('indirect default head configuration is unverified');
  }
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

function decodeCssEscapes(value) {
  return value.replace(
    /\\(?:([\da-f]{1,6})(?:\r\n|[\t\n\r\f ])?|([\s\S]))/giu,
    (_match, hex, character) => {
      if (!hex) return /[\n\r\f]/u.test(character) ? '' : character;
      const code = Number.parseInt(hex, 16);
      return code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)
        ? '\uFFFD'
        : String.fromCodePoint(code);
    }
  );
}

function styleModuleSpecifiers(content) {
  const specifiers = [];
  const escapePattern = /^\\(?:[\da-f]{1,6}(?:\r\n|[\t\n\r\f ])?|[\s\S])/iu;
  const identifierPattern = /^(?:[-_a-z\d]|\\(?:[\da-f]{1,6}(?:\r\n|[\t\n\r\f ])?|[^\n\r\f]))+/iu;
  const targetAt = (offset) => {
    const tail = content.slice(offset);
    const identifier = tail.match(identifierPattern)?.[0];
    const urlFunction =
      identifier &&
      decodeCssEscapes(identifier).toLowerCase() === 'url' &&
      tail[identifier.length] === '(';
    let cursor = urlFunction ? identifier.length + 1 : 0;
    if (urlFunction) while (/[\t\n\r\f ]/u.test(tail[cursor] ?? '')) cursor += 1;
    const quote = /['"]/u.test(tail[cursor] ?? '') ? tail[cursor++] : null;
    const start = cursor;
    while (cursor < tail.length) {
      if (tail[cursor] === '\\') {
        const escape = tail.slice(cursor).match(escapePattern)?.[0];
        if (!escape) return null;
        cursor += escape.length;
      } else if (quote ? tail[cursor] === quote : /[\s;,)'"]/u.test(tail[cursor])) break;
      else cursor += 1;
    }
    const value = tail.slice(start, cursor);
    if (!value || (quote && tail[cursor++] !== quote)) return null;
    if (urlFunction) {
      while (/[\t\n\r\f ]/u.test(tail[cursor] ?? '')) cursor += 1;
      if (tail[cursor++] !== ')') return null;
    }
    return { value: decodeCssEscapes(value), length: cursor };
  };
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
    if (character !== '@') continue;
    const name = content.slice(index + 1).match(identifierPattern)?.[0];
    const directiveName = name && decodeCssEscapes(name).toLowerCase();
    if (!/^(?:import|use|forward)$/u.test(directiveName ?? '')) continue;
    // An at-keyword may be directly followed by a string token. CSS comments
    // also separate tokens without requiring a whitespace character.
    let directiveLength = 1 + name.length;
    while (true) {
      const separator = content
        .slice(index + directiveLength)
        .match(/^(?:\s+|\/\*[\s\S]*?\*\/)/u)?.[0];
      if (!separator) break;
      directiveLength += separator.length;
    }
    {
      const directiveTailOffset =
        directiveName === 'import'
          ? (content.slice(index + directiveLength).match(/^\([^)]*\)\s*/u)?.[0].length ?? 0)
          : 0;
      const firstTarget = targetAt(index + directiveLength + directiveTailOffset);
      if (!firstTarget) continue;
      const targetValue = (target) =>
        directiveName === 'import' ? normalizeBrowserResourceUrl(target.value) : target.value;
      specifiers.push(targetValue(firstTarget));
      let consumedLength = directiveLength + directiveTailOffset + firstTarget.length;
      if (directiveName === 'import') {
        while (true) {
          const comma = content.slice(index + consumedLength).match(/^\s*,\s*/u);
          if (!comma) break;
          const additionalTarget = targetAt(index + consumedLength + comma[0].length);
          if (!additionalTarget) break;
          specifiers.push(targetValue(additionalTarget));
          consumedLength += comma[0].length + additionalTarget.length;
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

function parseAuthoredMarkdown(content, absolutePath) {
  let markdown = content.replace(/^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/u, '');
  if (/\.mdx$/iu.test(absolutePath)) {
    // Preserve the existing inert HTML-comment tolerance for MDX without
    // treating comment-looking bytes inside attributes/ESM strings as comments.
    const comments = [];
    jsxOpeningTagCandidates(
      maskStringsInMdxBraceExpressions(maskMdxEsmLiteralText(markdown, absolutePath)),
      { commentRanges: comments }
    );
    const characters = markdown.split('');
    for (const { start, end } of comments)
      for (let index = start; index < end; index += 1)
        if (!/[\r\n]/u.test(characters[index])) characters[index] = ' ';
    markdown = characters.join('');
  }
  try {
    return {
      markdown,
      tree: createMarkdownProcessor({ format: /\.mdx$/iu.test(absolutePath) ? 'mdx' : 'md' }).parse(
        markdown
      ),
    };
  } catch {
    throw new Error(`promotion markup resource URL in ${absolutePath} remains unverified`);
  }
}

function markdownResourceSource(content, absolutePath) {
  const { markdown, tree } = parseAuthoredMarkdown(content, absolutePath);
  const characters = markdown
    .split('')
    .map((character) => (/[\r\n]/u.test(character) ? character : ' '));
  const copy = (start, end) => {
    for (let index = start; index < end; index += 1) characters[index] = markdown[index];
  };
  const visit = (node) => {
    const start = node.position?.start.offset,
      end = node.position?.end.offset;
    if (
      node.type === 'html' ||
      node.type === 'mdxjsEsm' ||
      /^mdx(?:Flow|Text)Expression$/u.test(node.type)
    ) {
      copy(start, end);
      return;
    }
    if (/^mdxJsx/u.test(node.type)) {
      // Keep native/component tag syntax, but let each child AST node decide
      // whether its bytes are HTML/JSX or genuine Markdown code/text.
      copy(start, node.children[0]?.position.start.offset ?? end);
      if (node.children.length) copy(node.children.at(-1).position.end.offset, end);
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(tree);
  return characters.join('');
}

function markdownStyleSegments(content, absolutePath) {
  const { tree } = parseAuthoredMarkdown(content, absolutePath);
  const unverified = () => {
    throw new Error(`promotion CSS resource URL in ${absolutePath} remains unverified`);
  };
  const styles = [];
  if (/\.md$/iu.test(absolutePath)) {
    const opaqueContent = '<unverified-markdown-style-content>';
    // Raw HTML nodes are already parsed as HTML by CommonMark. Backticks in a
    // raw block remain ordinary bytes, unlike actual code/inlineCode nodes.
    // Inline raw style tags may surround text nodes; use their rendered text.
    // Other Markdown-generated markup inside CSS is deliberately unverified.
    const render = (node) => {
      if (node.type === 'html') return node.value;
      if (node.type === 'text')
        return node.value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
      if (node.type === 'definition') return '';
      const children = (node.children ?? []).map(render).join('');
      return /^(?:root|paragraph)$/u.test(node.type)
        ? children
        : `${opaqueContent}${children}${opaqueContent}`;
    };
    const visitHtml = (node) => {
      if (node.tagName === 'style') {
        const value = (node.childNodes ?? []).map((child) => child.value ?? '').join('');
        if (value.includes(opaqueContent)) unverified();
        styles.push(value);
      }
      for (const child of node.childNodes ?? []) visitHtml(child);
      if (node.content) visitHtml(node.content);
    };
    visitHtml(parseHtml(render(tree)));
    return styles;
  }
  const staticText = (node) => {
    if (node.type === 'text') return node.value;
    if (/^mdx(?:Flow|Text)Expression$/u.test(node.type)) {
      const body = node.data?.estree?.body;
      if (body?.length === 0) return '';
      const expression =
        body?.length === 1 && body[0].type === 'ExpressionStatement' ? body[0].expression : null;
      if (expression?.type === 'Literal' && typeof expression.value === 'string')
        return expression.value;
      if (
        expression?.type === 'TemplateLiteral' &&
        expression.expressions.length === 0 &&
        expression.quasis.every((quasi) => typeof quasi.value.cooked === 'string')
      )
        return expression.quasis.map((quasi) => quasi.value.cooked).join('');
    }
    return unverified();
  };
  const visit = (node) => {
    if (/^mdxJsx/u.test(node.type) && node.name === 'style') {
      if (
        node.attributes.some(
          (attribute) =>
            attribute.type !== 'mdxJsxAttribute' ||
            /^(?:children|set:html|set:text|dangerouslySetInnerHTML)$/u.test(attribute.name)
        )
      )
        unverified();
      styles.push(node.children.map(staticText).join(''));
      return;
    }
    if (node.type === 'mdxjsEsm' || /^mdx(?:Flow|Text)Expression$/u.test(node.type)) {
      const source = ts.createSourceFile(
        'markdown-style.tsx',
        node.value,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
      );
      const inspect = (candidate) => {
        if (
          (ts.isJsxOpeningElement(candidate) || ts.isJsxSelfClosingElement(candidate)) &&
          candidate.tagName.getText() === 'style'
        )
          unverified();
        ts.forEachChild(candidate, inspect);
      };
      inspect(source);
      return;
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(tree);
  return styles;
}

// Read authored native tags only. JSX is walked as syntax, never evaluated;
// Markdown examples and module literal text are masked before lexical fallback.
// Vue owns SFC template ancestry, self-closing tags and directive parsing.
// This is parse-only: no template compilation, plugin transform or evaluation.
function vueTemplateElements(content) {
  const result = [];
  const visit = (node) => {
    if (node.type === VueNodeTypes.ELEMENT) {
      if (/^(?:script|style)$/u.test(node.tag)) return;
      if (
        node.tag === 'template' &&
        node.props.some(
          (property) =>
            property.type === VueNodeTypes.ATTRIBUTE &&
            property.name === 'lang' &&
            property.value &&
            property.value.content !== 'html'
        )
      )
        throw new Error('unsupported Vue template language');
      result.push(node);
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(parseVue(content));
  return result;
}

function authoredVueResourceTags(content, absolutePath) {
  try {
    return vueTemplateElements(content).map((node) => {
      const attributes = new Map();
      for (const property of node.props) {
        if (property.type === VueNodeTypes.ATTRIBUTE) {
          // Under v-pre the Vue parser exposes directive-looking names as
          // inert attributes, not runtime style/binding directives.
          if (/^(?:@|:|v-)/u.test(property.name)) continue;
          attributes.set(property.name.toLowerCase(), {
            value: property.value?.content ?? '',
            encoded: hasHtmlCharacterReference(property.loc.source),
          });
        } else if (property.type === VueNodeTypes.DIRECTIVE) {
          // Binding modifiers change delivery, not the bound native attribute.
          // Keep v-pre attributes inert; dynamic/object bindings stay opaque.
          const name =
            property.name === 'bind'
              ? property.arg?.isStatic
                ? `:${property.arg.content}`
                : 'v-bind'
              : property.rawName;
          attributes.set(name, {
            value: null,
            encoded: hasHtmlCharacterReference(property.loc.source),
          });
        }
      }
      return { name: node.tag, attributes, opaque: false, jsx: false };
    });
  } catch {
    throw new Error(`promotion CSS resource URL in ${absolutePath} remains unverified`);
  }
}

function authoredResourceTags(content, absolutePath, { documentBaseContext = false } = {}) {
  if (/\.vue$/iu.test(absolutePath)) return authoredVueResourceTags(content, absolutePath);
  const tags = [];
  const literal = (node) => {
    if (!node) return true;
    if (ts.isJsxExpression(node)) node = node.expression;
    if (!node) return null;
    node = unwrapTypeScriptExpression(node);
    if (ts.isStringLiteralLike(node)) return node.text;
    if (node.kind === ts.SyntaxKind.FalseKeyword || node.kind === ts.SyntaxKind.NullKeyword)
      return false;
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    return null;
  };
  const inspectJsx = (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = node.tagName.getText();
      if (/^[a-z][a-z\d-]*$/u.test(name)) {
        const attributes = new Map();
        let opaque = false;
        for (const attribute of node.attributes.properties) {
          if (!ts.isJsxAttribute(attribute)) {
            opaque = true;
            continue;
          }
          const key = attribute.name.getText();
          if (attributes.has(key)) opaque = true;
          attributes.set(key, {
            value: literal(attribute.initializer),
            encoded:
              !!attribute.initializer &&
              ts.isStringLiteralLike(attribute.initializer) &&
              hasHtmlCharacterReference(attribute.initializer.text),
          });
        }
        tags.push({ name, attributes, opaque, jsx: true });
      }
    }
    ts.forEachChild(node, inspectJsx);
  };
  if (/\.[cm]?[jt]sx?$/iu.test(absolutePath)) {
    inspectJsx(
      ts.createSourceFile(absolutePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    );
    return tags;
  }
  if (!/\.(?:html?|astro|mdx?|vue|svelte)$/iu.test(absolutePath)) return tags;
  let raw = content;
  if (/\.mdx?$/iu.test(absolutePath)) {
    try {
      raw = markdownResourceSource(content, absolutePath);
    } catch {
      // Inventory still recognizes bounded native markup in an invalid source;
      // promotion independently rejects every Markdown/MDX parse failure.
      raw = stripMarkdownCode(content);
    }
    raw = maskMdxEsmLiteralText(raw, absolutePath);
  }
  raw = raw
    .replace(/^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/u, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/giu, '');
  const masked =
    /\.html?$/iu.test(absolutePath) || /\.md$/iu.test(absolutePath)
      ? raw
      : maskStringsInMdxBraceExpressions(raw);
  if (/\.(?:html?|md)$/iu.test(absolutePath)) {
    const inspectHtml = (node, inTemplate = false) => {
      if (node.sourceCodeLocation?.startTag) {
        const attributes = new Map(
          (node.attrs ?? []).map((attribute) => {
            const key = attribute.prefix ? `${attribute.prefix}:${attribute.name}` : attribute.name;
            const range = node.sourceCodeLocation.attrs[key];
            return [
              key,
              {
                value: attribute.value,
                encoded:
                  !!range &&
                  hasHtmlCharacterReference(raw.slice(range.startOffset, range.endOffset)),
              },
            ];
          })
        );
        tags.push({
          name: node.tagName,
          attributes,
          opaque: false,
          jsx: false,
          inertDocumentBase: inTemplate || node.namespaceURI !== 'http://www.w3.org/1999/xhtml',
        });
      }
      for (const child of node.childNodes ?? []) inspectHtml(child, inTemplate);
      if (node.content) inspectHtml(node.content, true);
    };
    inspectHtml(parseHtml(raw, { sourceCodeLocationInfo: true }));
  } else {
    const inertBaseRanges = [];
    if (documentBaseContext && /<base\b/iu.test(raw)) {
      // The lexical fallback retains authored tags for several formats. For
      // base only, preserve parser-proven raw-text/template ancestry so text
      // resembling markup cannot change the document-base classification.
      try {
        const parsed = parseAstro(raw, { position: true });
        if (!parsed.diagnostics.some((diagnostic) => diagnostic.severity === 1)) {
          const visit = (node, foreignContent = false) => {
            const childIsForeign =
              foreignContent || (node.type === 'element' && /^(?:svg|math)$/u.test(node.name));
            if (
              !foreignContent &&
              node.type === 'element' &&
              /^(?:style|textarea|title|template)$/u.test(node.name) &&
              Number.isInteger(node.position?.start?.offset) &&
              Number.isInteger(node.position?.end?.offset)
            )
              inertBaseRanges.push([node.position.start.offset, node.position.end.offset]);
            else for (const child of node.children ?? []) visit(child, childIsForeign);
          };
          visit(parsed.ast);
        }
      } catch {
        /* No proven inert context: preserve the unverified base. */
      }
    }
    for (const { start, end } of jsxOpeningTagCandidates(masked, { includeOffsets: true })) {
      const candidate = raw.slice(start, end);
      const source = ts.createSourceFile(
        'resource.tsx',
        candidate.replace(/\/?\s*>$/u, ' />'),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
      );
      const count = tags.length;
      inspectJsx(source);
      if (inertBaseRanges.some(([from, to]) => start >= from && start < to))
        for (const tag of tags.slice(count)) tag.inertDocumentBase = true;
      if (source.parseDiagnostics.length) {
        if (tags.length > count) tags.at(-1).opaque = true;
        else {
          const name = candidate.match(/^<([a-z][a-z\d-]*)(?=[\s/>])/u)?.[1];
          if (name) tags.push({ name, attributes: new Map(), opaque: true, jsx: true });
        }
      }
    }
  }
  return tags;
}

function promotionMarkupResourceUrls(absolutePath) {
  if (!/\.(?:html?|astro|mdx?|vue|svelte|[cm]?[jt]sx?)$/iu.test(absolutePath)) return [];
  const content = fs.readFileSync(absolutePath, 'utf8');
  const urls = [];
  const unverified = () => {
    throw new Error(`promotion markup resource URL in ${absolutePath} remains unverified`);
  };
  const add = (value, encoded = false) => {
    if (typeof value !== 'string' || encoded || /[{}\x60\0]/u.test(value)) unverified();
    const url = normalizeBrowserResourceUrl(value);
    if (/[\u0000-\u001f\u007f]/u.test(url)) unverified();
    if (url.startsWith('#') || /^data:/iu.test(url)) return;
    if (!url || /^(?:[a-z][a-z\d+.-]*:|\/\/)/iu.test(url)) unverified();
    urls.push(url);
  };
  const attributesByTag = {
    img: ['src', 'srcset', 'srcSet'],
    video: ['src', 'poster'],
    audio: ['src'],
    source: ['src', 'srcset', 'srcSet'],
    track: ['src'],
    image: ['href', 'xlink:href', 'xlinkHref'],
    use: ['href', 'xlink:href', 'xlinkHref'],
    input: ['src'],
  };
  for (const { name, attributes, opaque, inertDocumentBase } of authoredResourceTags(
    content,
    absolutePath,
    { documentBaseContext: true }
  )) {
    // Document bases affect relative markup/inline-style resources across the
    // rendered page. Source-file-relative lookup is not evidence for that URL.
    if (
      name === 'base' &&
      !inertDocumentBase &&
      (opaque ||
        [...attributes.keys()].some((key) =>
          ['href', ':href', 'v-bind:href', 'v-bind'].includes(key.toLowerCase())
        ))
    )
      throw new Error(`promotion document base href in ${absolutePath} remains unverified`);
    const names = attributesByTag[name];
    if (!names) continue;
    if (
      opaque ||
      attributes.has('v-bind') ||
      names.some((key) => attributes.has(`:${key}`) || attributes.has(`v-bind:${key}`))
    )
      unverified();
    for (const key of names) {
      const attribute = attributes.get(key);
      if (!attribute) continue;
      if (/^srcset$/iu.test(key)) {
        if (typeof attribute.value !== 'string' || attribute.encoded) unverified();
        for (const candidate of attribute.value.split(',')) {
          const match = candidate.trim().match(/^(\S+)(?:\s+(?:\d+w|(?:\d+(?:\.\d+)?|\.\d+)x))?$/u);
          if (!match) unverified();
          add(match[1]);
        }
      } else add(attribute.value, attribute.encoded);
    }
  }
  if (/\.mdx?$/iu.test(absolutePath)) {
    // Parse only, using the same AST boundary as authored HTML/JSX inventory.
    const { tree } = parseAuthoredMarkdown(content, absolutePath);
    const definitions = new Map();
    const references = [];
    const visit = (node) => {
      if (node.type === 'definition' && !definitions.has(node.identifier))
        definitions.set(node.identifier, node.url);
      if (node.type === 'image') add(node.url);
      if (node.type === 'imageReference') references.push(node.identifier);
      if (/^mdxJsx/u.test(node.type) && /^(?:script|style)$/iu.test(node.name ?? '')) return;
      for (const child of node.children ?? []) visit(child);
    };
    visit(tree);
    for (const reference of references) {
      const target = definitions.get(reference);
      if (target === undefined) unverified();
      add(target);
    }
  }
  return urls;
}

function promotionStyleResourceUrls(absolutePath, inlineStyles = []) {
  const styles = /\.(?:css|less|s[ac]ss)$/iu.test(absolutePath)
    ? [fs.readFileSync(absolutePath, 'utf8')]
    : /\.(?:html?|astro|vue|svelte)$/iu.test(absolutePath)
      ? embeddedStyleSegments(fs.readFileSync(absolutePath, 'utf8'))
      : [];
  if (/\.mdx?$/iu.test(absolutePath))
    styles.push(...markdownStyleSegments(fs.readFileSync(absolutePath, 'utf8'), absolutePath));
  if (/\.(?:html?|astro|mdx?|vue|svelte|[cm]?[jt]sx?)$/iu.test(absolutePath)) {
    const content = fs.readFileSync(absolutePath, 'utf8');
    for (const { attributes, opaque } of authoredResourceTags(content, absolutePath)) {
      const style = attributes.get('style');
      if (attributes.has(':style') || attributes.has('v-bind:style'))
        throw new Error(`promotion CSS resource URL in ${absolutePath} remains unverified`);
      if (!style) continue;
      if (opaque || attributes.has('v-bind') || typeof style.value !== 'string' || style.encoded)
        throw new Error(`promotion CSS resource URL in ${absolutePath} remains unverified`);
      styles.push(style.value);
    }
  }
  styles.push(...inlineStyles);
  const urls = [];
  const unverified = () => {
    throw new Error(`promotion CSS resource URL in ${absolutePath} remains unverified`);
  };
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
      const functionName = decodeCssEscapes(identifier).toLowerCase();
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
      const url = normalizeBrowserResourceUrl(decodeCssEscapes(value));
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
  if (!/\.(?:html?|astro|vue)$/iu.test(absolutePath)) return [];
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
    if (/\.vue$/iu.test(absolutePath)) {
      for (const node of vueTemplateElements(content)) {
        for (const property of node.props) {
          const native = property.type === VueNodeTypes.ATTRIBUTE;
          if (native) {
            const name = property.name.toLowerCase();
            const value = property.value?.content ?? '';
            if (isNavigationUrlAttribute(node.tag, name) && isExecutableNavigationUrl(value))
              specifiers.push(UNVERIFIED_NAVIGATION_URL_SPECIFIER);
            if (!NATIVE_EVENT_ATTRIBUTE_NAMES.has(name)) continue;
          } else if (property.type === VueNodeTypes.DIRECTIVE) {
            if (/^(?:cloak|once|pre|else)$/u.test(property.name)) continue;
            if (property.name === 'html') {
              specifiers.push(UNVERIFIED_HTML_SINK_SPECIFIER);
              continue;
            }
            if (property.arg && !property.arg.isStatic)
              specifiers.push(UNVERIFIED_MARKUP_HANDLER_SPECIFIER);
          } else continue;
          const raw = property.loc.source;
          const literal = /^[^\s=]+\s*=\s*(["'])([\s\S]*)\1$/u.test(raw);
          inspect(
            native ? (property.value?.content ?? '') : (property.exp?.content ?? ''),
            raw,
            literal,
            { startOffset: property.loc.start.offset, endOffset: property.loc.end.offset }
          );
        }
      }
    } else if (/\.html?$/iu.test(absolutePath)) {
      const visit = (node) => {
        for (const attribute of node.attrs ?? []) {
          if (
            isNavigationUrlAttribute(node.tagName, attribute.name) &&
            isExecutableNavigationUrl(attribute.value)
          )
            specifiers.push(UNVERIFIED_NAVIGATION_URL_SPECIFIER);
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
            if (isNavigationUrlAttribute(node.name, attribute.name.toLowerCase())) {
              let value = attribute.value;
              if (attribute.kind === 'expression') {
                const expression = ts.createSourceFile(
                  'attribute.ts',
                  `(${value})`,
                  ts.ScriptTarget.Latest,
                  true
                );
                const statement = expression.statements[0];
                const literal =
                  statement && ts.isExpressionStatement(statement)
                    ? unwrapTypeScriptExpression(statement.expression)
                    : null;
                value = literal && ts.isStringLiteralLike(literal) ? literal.text : '';
              }
              if (isExecutableNavigationUrl(value, attribute.kind !== 'expression'))
                specifiers.push(UNVERIFIED_NAVIGATION_URL_SPECIFIER);
            }
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

function templateNavigationUrlSpecifiers(content, absolutePath, options) {
  if (!/\.(?:mdx?|vue|svelte)$/iu.test(absolutePath)) return [];
  const raw = /\.mdx?$/iu.test(absolutePath)
    ? maskMdxEsmLiteralText(stripMarkdownCode(content), absolutePath)
    : markupSourceForJsxFallback(content, absolutePath);
  // Mask expression strings to locate real tags, but inspect the original
  // attribute bytes. Preserve UTF-16 offsets even when a string contains emoji.
  const masked = maskStringsInMdxBraceExpressions(raw);
  const found = new Set();
  if (/\.mdx$/iu.test(absolutePath)) {
    // Preserve JavaScript template literals, but never re-admit Markdown code
    // blocks or HTML comments through the separate ESM attribute pass. The tag
    // scanner keeps comment-looking text inside quoted attributes intact.
    const esmText = maskMdxEsmLiteralText(content, absolutePath);
    const commentRanges = [];
    jsxOpeningTagCandidates(esmText, { commentRanges });
    const characters = esmText.split('');
    for (const { start, end } of commentRanges)
      for (let index = start; index < end; index += 1)
        if (!/[\r\n]/u.test(characters[index])) characters[index] = ' ';
    const esm = ts.createSourceFile(
      'document.mdx',
      stripMarkdownCode(characters.join(''), { preserveInlineCode: true }),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
    for (const statement of esm.statements) {
      if (
        !(
          ts.isExportAssignment(statement) ||
          statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
        )
      )
        continue;
      for (const specifier of scriptModuleSpecifiers(
        statement.getText(esm),
        'mdx-esm.tsx',
        options
      ))
        if (specifier === UNVERIFIED_NAVIGATION_URL_SPECIFIER) found.add(specifier);
    }
  }
  for (const { start, end } of jsxOpeningTagCandidates(masked, { includeOffsets: true })) {
    const candidate = raw.slice(start, end);
    const name = candidate.match(/^<([A-Za-z][\w:-]*)/u)?.[1];
    const nativeName = /\.md$/iu.test(absolutePath) ? name?.toLowerCase() : name;
    if (!/^(?:a|area|form|button|input|iframe|frame|object)$/u.test(nativeName ?? '')) continue;
    const parsed = parseHtml(candidate);
    const visit = (node) => {
      for (const attribute of node.attrs ?? [])
        if (
          isNavigationUrlAttribute(node.tagName, attribute.name) &&
          isExecutableNavigationUrl(attribute.value)
        )
          found.add(UNVERIFIED_NAVIGATION_URL_SPECIFIER);
      for (const child of node.childNodes ?? []) visit(child);
      if (node.content) visit(node.content);
    };
    visit(parsed);
    if (!/\.md$/iu.test(absolutePath))
      for (const specifier of scriptModuleSpecifiers(
        candidate.replace(/\/?\s*>$/u, ' />'),
        'native-navigation.tsx',
        options
      ))
        if (specifier === UNVERIFIED_NAVIGATION_URL_SPECIFIER) found.add(specifier);
  }
  return [...found];
}

function markdownScriptModuleSpecifiers(content, absolutePath, options) {
  const specifiers = [];
  try {
    const { tree } = parseAuthoredMarkdown(content, absolutePath);
    const inspectBody = (body) =>
      specifiers.push(...scriptModuleSpecifiers(body, absolutePath, options));
    if (/\.md$/iu.test(absolutePath)) {
      // Raw HTML blocks keep their literal script bytes. Actual Markdown code
      // and inline-code nodes never enter the HTML parser.
      const opaque = '<unverified-markdown-script-content>';
      const render = (node) => {
        if (node.type === 'html') return node.value;
        if (node.type === 'text')
          return node.value
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;');
        if (node.type === 'definition') return '';
        const children = (node.children ?? []).map(render).join('');
        return /^(?:root|paragraph)$/u.test(node.type) ? children : `${opaque}${children}${opaque}`;
      };
      const visit = (node) => {
        if (node.tagName === 'script') {
          const attrs = new Map((node.attrs ?? []).map((attr) => [attr.name, attr.value]));
          if (isExecutableScriptType(attrs.get('type') ?? null) && !attrs.has('src')) {
            const body = (node.childNodes ?? []).map((child) => child.value ?? '').join('');
            if (body.includes(opaque)) specifiers.push(DYNAMIC_EXECUTABLE_SCRIPT_SPECIFIER);
            else inspectBody(body);
          }
        }
        for (const child of node.childNodes ?? []) visit(child);
        if (node.content) visit(node.content);
      };
      visit(parseHtml(render(tree)));
      return specifiers;
    }
    const staticExpression = (node) => {
      const body = node.data?.estree?.body;
      if (body?.length === 0) return '';
      const expression =
        body?.length === 1 && body[0].type === 'ExpressionStatement' ? body[0].expression : null;
      if (expression?.type === 'Literal' && typeof expression.value === 'string')
        return expression.value;
      if (
        expression?.type === 'TemplateLiteral' &&
        expression.expressions.length === 0 &&
        expression.quasis.every((quasi) => typeof quasi.value.cooked === 'string')
      )
        return expression.quasis.map((quasi) => quasi.value.cooked).join('');
      return null;
    };
    const visit = (node) => {
      if (/^mdxJsx/u.test(node.type)) {
        for (const attribute of node.attributes ?? []) {
          const expression =
            attribute.type === 'mdxJsxExpressionAttribute'
              ? attribute.value
              : attribute.value && typeof attribute.value === 'object'
                ? attribute.value.value
                : null;
          if (typeof expression === 'string') inspectBody(expression);
        }
      }
      if (/^mdxJsx/u.test(node.type) && /^s[cC][rR][iI][pP][tT]$/u.test(node.name ?? '')) {
        const attrs = new Map();
        let opaque = false;
        for (const attribute of node.attributes) {
          if (attribute.type !== 'mdxJsxAttribute') {
            opaque = true;
            continue;
          }
          const value =
            typeof attribute.value === 'string' || attribute.value === null
              ? (attribute.value ?? '')
              : staticExpression(attribute.value);
          attrs.set(attribute.name, value);
          if (value === null && /^(?:type|src)$/u.test(attribute.name)) opaque = true;
          if (/^(?:children|set:html|set:text|dangerouslySetInnerHTML)$/u.test(attribute.name))
            opaque = true;
        }
        if (opaque) {
          specifiers.push(DYNAMIC_EXECUTABLE_SCRIPT_SPECIFIER);
          return;
        }
        if (!isExecutableScriptType(attrs.get('type') ?? null) || attrs.has('src')) {
          // JSX expressions still execute while rendering a data-script node;
          // only its literal text is inert JavaScript.
          for (const child of node.children) visit(child);
          return;
        }
        const chunks = node.children.map((child) =>
          child.type === 'text' ? child.value : staticExpression(child)
        );
        if (chunks.includes(null)) specifiers.push(DYNAMIC_EXECUTABLE_SCRIPT_SPECIFIER);
        else inspectBody(chunks.join(''));
        return;
      }
      if (node.type === 'mdxjsEsm' || /^mdx(?:Flow|Text)Expression$/u.test(node.type)) {
        inspectBody(node.value);
        return;
      }
      for (const child of node.children ?? []) visit(child);
    };
    visit(tree);
  } catch {
    specifiers.push(DYNAMIC_EXECUTABLE_SCRIPT_SPECIFIER);
  }
  return specifiers;
}

function moduleSpecifiersForWebsiteSource(absolutePath, options = {}) {
  if (/\.svg$/i.test(absolutePath)) return [];
  const content = fs.readFileSync(absolutePath, 'utf8');
  if (absolutePath.endsWith(`${path.sep}apps${path.sep}www${path.sep}astro.config.mjs`)) {
    const localStylesheets = [];
    astroHeadImportMapIssues(path.resolve(path.dirname(absolutePath), '../..'), localStylesheets);
    return [...localStylesheets, ...scriptModuleSpecifiers(content, absolutePath, options)];
  }

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
      ...externalScriptModuleSpecifiers(content, absolutePath).filter(
        (specifier) => specifier !== DYNAMIC_EXECUTABLE_SCRIPT_TYPE_SPECIFIER
      ),
      ...embeddedScriptSegments(content).flatMap((segment) =>
        scriptModuleSpecifiers(segment, absolutePath, options)
      ),
    ];
  }
  if (/\.(?:astro|vue|svelte)$/i.test(absolutePath)) {
    return [
      ...templateNavigationUrlSpecifiers(content, absolutePath, options),
      ...markupEventHandlerSpecifiers(content, absolutePath, options),
      ...stylesheetLinkSpecifiers(content).filter(
        (specifier) =>
          !specifier.startsWith('<') && !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(specifier)
      ),
      ...externalScriptModuleSpecifiers(content, absolutePath).filter(
        (specifier) => specifier !== DYNAMIC_EXECUTABLE_SCRIPT_TYPE_SPECIFIER
      ),
      ...embeddedScriptSegments(content).flatMap((segment) =>
        scriptModuleSpecifiers(segment, absolutePath, options)
      ),
      ...embeddedStyleSegments(content).flatMap(styleModuleSpecifiers),
    ];
  }
  return [
    ...templateNavigationUrlSpecifiers(content, absolutePath, options),
    ...(/\.mdx?$/iu.test(absolutePath)
      ? markdownScriptModuleSpecifiers(content, absolutePath, options)
      : scriptModuleSpecifiers(content, absolutePath, options)),
  ];
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
  const inspectAlias = (node) => {
    if (!ts.isPropertyAssignment(node)) {
      unsupportedAll = true;
      return;
    }
    if (ts.isPropertyAssignment(node) && propertyName(node) === 'alias') {
      const aliasInitializer = unwrapTypeScriptExpression(node.initializer);
      if (ts.isObjectLiteralExpression(aliasInitializer)) {
        for (const property of aliasInitializer.properties) {
          const key = propertyName(property);
          if (!key) {
            unsupportedAll = true;
            continue;
          }
          if (!ts.isPropertyAssignment(property)) {
            unsupported.add(key);
            continue;
          }
          const replacement = aliasReplacement(property.initializer);
          if (replacement) aliases.set(key, replacement);
          else unsupported.add(key);
        }
      } else if (ts.isArrayLiteralExpression(aliasInitializer)) {
        for (const element of aliasInitializer.elements) {
          const entry = unwrapTypeScriptExpression(element);
          if (
            !ts.isObjectLiteralExpression(entry) ||
            entry.properties.some((property) => !ts.isPropertyAssignment(property))
          ) {
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
  };
  const configNames = new Set(['defineConfig']);
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteralLike(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== 'astro/config' ||
      !statement.importClause?.namedBindings ||
      !ts.isNamedImports(statement.importClause.namedBindings)
    )
      continue;
    for (const binding of statement.importClause.namedBindings.elements)
      if ((binding.propertyName ?? binding.name).text === 'defineConfig')
        configNames.add(binding.name.text);
  }
  // Only values consumed by the exported Astro -> Vite -> resolve configuration
  // can define an alias. Unused business objects/functions are not configuration.
  const inspectConfig = (expression, level = 0) => {
    const node = unwrapTypeScriptExpression(expression);
    if (
      level === 0 &&
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      configNames.has(node.expression.text) &&
      node.arguments.length === 1
    ) {
      inspectConfig(node.arguments[0]);
      return;
    }
    if (!ts.isObjectLiteralExpression(node)) {
      unsupportedAll = true;
      return;
    }
    const selected = ['vite', 'resolve', 'alias'][level];
    let selectedCount = 0;
    for (const property of node.properties) {
      if (ts.isSpreadAssignment(property) || propertyName(property) === null) {
        unsupportedAll = true;
        continue;
      }
      if (propertyName(property) !== selected) continue;
      if (++selectedCount > 1) unsupportedAll = true;
      if (level === 2) inspectAlias(property);
      else if (ts.isPropertyAssignment(property)) inspectConfig(property.initializer, level + 1);
      else unsupportedAll = true;
    }
  };
  for (const statement of sourceFile.statements) {
    if (ts.isExportAssignment(statement) && !statement.isExportEquals)
      inspectConfig(statement.expression);
    else if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause) &&
      statement.exportClause.elements.some((entry) => entry.name.text === 'default')
    )
      unsupportedAll = true;
  }
  if (sourceFile.parseDiagnostics.length) unsupportedAll = true;
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

function isReviewedBuildTimeModuleSpecifier(sourcePath, specifier, rootDir, metadata = new Set()) {
  // Public assets and entry HTML execute directly in the browser. They cannot
  // inherit the Node/Astro/Vite resolvers used by compiled application sources.
  if (/\/public\/|\.html?$/iu.test(sourcePath)) return false;
  if (isNodeBuiltinSpecifier(specifier)) return true;
  if (specifier === 'virtual:proto-ui/runtime-retry-urls') {
    const owners = new Set([
      'apps/www/src/components/PrototypePreviewer/demo-renderer.ts',
      'apps/www/src/components/PrototypePreviewer/runtimes/react-runtime.ts',
      'apps/www/src/components/PrototypePreviewer/runtimes/vue-runtime.ts',
      'apps/www/src/components/PrototypePreviewer/runtimes/vue2-runtime.ts',
    ]);
    if (!owners.has(sourcePath) || !rootDir) return false;
    const inputs = [
      ['apps/www/astro.config.mjs', PROMOTION_FINF_RETRY_AUDIT_CONFIG_SHA256],
      [PROMOTION_RETRY_PLUGIN_PATH, PROMOTION_RETRY_PLUGIN_SHA256],
      [PROMOTION_AUDIT_PLUGIN_PATH, PROMOTION_AUDIT_PLUGIN_SHA256],
    ];
    try {
      for (const [relative, sha] of inputs) {
        const target = path.join(rootDir, relative);
        assertPromotionModulePath(rootDir, target);
        if (
          !fs.lstatSync(target).isFile() ||
          createHash('sha256').update(fs.readFileSync(target)).digest('hex') !== sha
        )
          return false;
      }
    } catch {
      return false;
    }
    for (const [relative] of inputs) metadata.add(path.join(rootDir, relative));
    return true;
  }

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
  if (specifier === UNVERIFIED_NAVIGATION_URL_SPECIFIER)
    return { category: 'unverified-navigation-url', resolvedPath: null };
  if (specifier === UNVERIFIED_MARKUP_HANDLER_SPECIFIER)
    return { category: 'unverified-markup-handler', resolvedPath: null };
  // An opaque string is retained as research evidence, never interpreted as
  // a module URL or admitted by the promotion evidence closure.
  if (specifier === OPAQUE_HTML_SINK_SPECIFIER || specifier === UNVERIFIED_DOM_RESOURCE_SPECIFIER)
    return null;
  if (specifier === UNVERIFIED_HTML_SINK_SPECIFIER)
    return { category: 'unverified-html-sink', resolvedPath: null };
  if (specifier === UNVERIFIED_STYLE_BODY_SPECIFIER)
    return { category: 'unverified-style-body', resolvedPath: null };
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
    !isReviewedBuildTimeModuleSpecifier(sourcePath, classifiedSpecifier, rootDir)
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
      if (isScriptResourceSpecifier(originalSpecifier)) continue;
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
  if (specifier === UNVERIFIED_NAVIGATION_URL_SPECIFIER)
    return { category: 'unverified-navigation-url', resolvedPath: null };
  if (specifier === UNVERIFIED_MARKUP_HANDLER_SPECIFIER)
    return { category: 'unverified-markup-handler', resolvedPath: null };
  // An opaque string is retained as research evidence, never interpreted as
  // a module URL or admitted by the promotion evidence closure.
  if (specifier === OPAQUE_HTML_SINK_SPECIFIER || specifier === UNVERIFIED_DOM_RESOURCE_SPECIFIER)
    return null;
  if (specifier === UNVERIFIED_HTML_SINK_SPECIFIER)
    return { category: 'unverified-html-sink', resolvedPath: null };
  if (specifier === UNVERIFIED_STYLE_BODY_SPECIFIER)
    return { category: 'unverified-style-body', resolvedPath: null };
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
    !isReviewedBuildTimeModuleSpecifier(sourcePath, classifiedSpecifier, rootDir)
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

function websiteRawImportIsAllowed(sourcePath, specifier, guardedImport, rootDir) {
  if (isReviewedPrototypePackageDependency(sourcePath, guardedImport)) return true;
  const allowance = WEBSITE_RAW_IMPORT_ALLOWLIST[sourcePath];
  if (!allowance) return false;
  if (allowance.sourceSha256) {
    const target = path.join(rootDir, sourcePath);
    try {
      assertPromotionModulePath(rootDir, target);
      if (
        !fs.lstatSync(target).isFile() ||
        createHash('sha256').update(fs.readFileSync(target)).digest('hex') !==
          allowance.sourceSha256
      )
        return false;
    } catch {
      return false;
    }
  }

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

// Historical Node-only test helpers live beside documentation fixtures. They
// are not production roots; any import from a production seed restores them
// (and their complete dependency closure) to every source/consumer scan.
const WEBSITE_TEST_HELPER_PATHS = [
  '/apps/www/src/content/docs/zh-cn/browser-harness.ts',
  '/apps/www/src/content/docs/zh-cn/site-search-evidence.ts',
];
function isTestNamedSource(absolutePath) {
  if (
    WEBSITE_TEST_HELPER_PATHS.some((suffix) => absolutePath.replaceAll('\\', '/').endsWith(suffix))
  )
    return true;
  return /\.(?:browser\.)?(?:test|spec)\.[cm]?[jt]sx?$/iu.test(absolutePath);
}

// Mirror the checked-in Website proto-ui-source resolver without evaluating
// candidate configuration. The full config fingerprint fails closed for any
// unreviewed resolver/plugin shape; updates require source review and parity tests.
// Reviewed main contributions change CSS layer order and accepted family
// sidebar entries and source-reviewed Copy render plugin; resolver functions stay intact. Parity/mutation tests retain
// fail-closed behavior for every other configuration change.
const PROMOTION_RESOLVER_CONFIG_SHA256 =
  '21c1a41e74c5ac1d03a9f71cd8c9feb401cc4e3d143df6eb7d1a03b4c510d377';
// Exact opt-in, serve-only contrast audit profile. Its imported plugin bytes
// are part of the reviewed resolver boundary, not an unrestricted plugin hook.
const PROMOTION_AUDIT_CONFIG_SHA256 =
  'f9736918dfcf0d1eaffc9205e562e18bedcbb61df085ebc20bdbb7ed36f716ee';
// Retain the exact previously reviewed main configurations. The accepted #875
// profile differs only by the Base Collapsible sidebar item; resolver bytes
// and the required audit helper remain unchanged.
const PROMOTION_HISTORICAL_CONFIG_SHA256 =
  'd96e4e9086541e713e95f1fa8cda44a7af04795f37f4a91f9f3f93de75ea9f30';
const PROMOTION_HISTORICAL_AUDIT_CONFIG_SHA256 =
  'b07dfc4350c16a8bee3b65717887cc5d592002f2cb492e134c60a3d18519a6de';
// Finf source-reviewed sidebar additions and the one lazy association chunk
// exclusion leave the mirrored resolver unchanged. Retain both historic profiles.
const PROMOTION_FINF_CONFIG_SHA256 =
  '368441f22060c0a9adec23a98320e87fb68df4b64c1a3d8e7e3ff3877944f475';
const PROMOTION_FINF_AUDIT_CONFIG_SHA256 =
  '37e3dc63ada011e330c32ed2c97af28600a87cdef0d892c3ed9adb8b3b84e705';
const PROMOTION_AUDIT_PLUGIN_PATH = 'apps/www/scripts/contrast-provenance.mjs';
const PROMOTION_AUDIT_PLUGIN_SHA256 =
  'a1e7103b44b29063a9bc47d6e7d0881122b9184ff29c239275e00cba8315462a';
// Reviewed closed runtime recovery URL plugin. It only resolves its two virtual
// modules and delegates the fixed eleven acquisition entries to the same resolver.
// Its exact helper bytes are evidence metadata; arbitrary plugins stay rejected.
const PROMOTION_FINF_RETRY_AUDIT_CONFIG_SHA256 =
  '428f9cbe0c5fe19f4d24a74afeebddcfcad0f00c929144df205a94c45e87f8ac';
const PROMOTION_RETRY_PLUGIN_PATH = 'apps/www/scripts/runtime-retry-urls.mjs';
const PROMOTION_RETRY_PLUGIN_SHA256 =
  '510d0fd3bbd96804c6ea989e2da47531188890721f260822521a11c69000c224';
export function promotionBarePackageTargets(root, specifier, metadata) {
  const unverified = () =>
    new Error(`promotion package closure for ${specifier} remains unverified`);
  const configPath = path.join(root, 'apps/www/astro.config.mjs');
  const unrecognizedConfig = () =>
    new Error(
      'promotion package resolver configuration is unrecognized; closure remains unverified'
    );
  if (
    !fs.existsSync(configPath) ||
    !fs.lstatSync(configPath).isFile() ||
    path.relative(root, fs.realpathSync(configPath)).startsWith('..')
  )
    throw unrecognizedConfig();
  const configSha = createHash('sha256').update(fs.readFileSync(configPath)).digest('hex');
  const retryProfile = configSha === PROMOTION_FINF_RETRY_AUDIT_CONFIG_SHA256;
  const auditProfile =
    configSha === PROMOTION_AUDIT_CONFIG_SHA256 ||
    configSha === PROMOTION_HISTORICAL_AUDIT_CONFIG_SHA256 ||
    configSha === PROMOTION_FINF_AUDIT_CONFIG_SHA256 ||
    retryProfile;
  if (
    configSha !== PROMOTION_RESOLVER_CONFIG_SHA256 &&
    configSha !== PROMOTION_HISTORICAL_CONFIG_SHA256 &&
    configSha !== PROMOTION_FINF_CONFIG_SHA256 &&
    !auditProfile
  )
    throw unrecognizedConfig();
  metadata.add(configPath);
  if (auditProfile) {
    const pluginPath = path.join(root, PROMOTION_AUDIT_PLUGIN_PATH);
    assertPromotionModulePath(root, pluginPath);
    if (
      !fs.existsSync(pluginPath) ||
      !fs.lstatSync(pluginPath).isFile() ||
      createHash('sha256').update(fs.readFileSync(pluginPath)).digest('hex') !==
        PROMOTION_AUDIT_PLUGIN_SHA256
    )
      throw new Error(
        'promotion audit resolver plugin is unrecognized; closure remains unverified'
      );
    metadata.add(pluginPath);
  }
  if (retryProfile) {
    const pluginPath = path.join(root, PROMOTION_RETRY_PLUGIN_PATH);
    assertPromotionModulePath(root, pluginPath);
    if (
      !fs.existsSync(pluginPath) ||
      !fs.lstatSync(pluginPath).isFile() ||
      createHash('sha256').update(fs.readFileSync(pluginPath)).digest('hex') !==
        PROMOTION_RETRY_PLUGIN_SHA256
    )
      throw new Error(
        'promotion retry resolver plugin is unrecognized; closure remains unverified'
      );
    metadata.add(pluginPath);
  }
  const assertRepositoryFile = (target) => {
    assertPromotionModulePath(root, target);
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

function promotionResourcePath(
  root,
  canonicalRoot,
  sourcePath,
  viteRoot,
  kind,
  url,
  { directoryMetadataRevision = null } = {}
) {
  let resourcePath;
  try {
    resourcePath = decodeURIComponent(url.split(/[?#]/u, 1)[0]);
  } catch {
    throw new Error(`promotion ${kind} resource URL ${url} remains unverified`);
  }
  if (!resourcePath || resourcePath.includes('\0') || resourcePath.includes('\\'))
    throw new Error(`promotion ${kind} resource URL ${url} remains unverified`);
  if (resourcePath.startsWith('/')) {
    const relative = path.relative(viteRoot, path.resolve(viteRoot, `.${resourcePath}`));
    if (relative.startsWith('..') || path.isAbsolute(relative))
      throw new Error(
        `promotion ${kind} resource URL escapes its application root; remains unverified`
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
    (candidate) =>
      fs.existsSync(candidate) &&
      (fs.statSync(candidate).isFile() ||
        (directoryMetadataRevision && fs.statSync(candidate).isDirectory()))
  );
  if (!resource)
    throw new Error(`promotion ${kind} resource URL ${url} is unresolved; remains unverified`);
  const relative = path.relative(canonicalRoot, fs.realpathSync(resource));
  if (relative.startsWith('..') || path.isAbsolute(relative))
    throw new Error(
      `promotion ${kind} resource resolves outside the repository; remains unverified`
    );
  // Comparing only today's canonical target cannot prove which bytes a
  // historical symlink selected. Reject links in any resource component.
  for (let component = resource; component !== path.resolve(root); ) {
    if (fs.lstatSync(component).isSymbolicLink())
      throw new Error(`promotion ${kind} resource symlink remains unverified`);
    const parent = path.dirname(component);
    if (parent === component) break;
    component = parent;
  }
  if (directoryMetadataRevision && fs.statSync(resource).isDirectory()) {
    // A current directory alone is not proof of metadata: an evidenced asset
    // file may have been replaced by a directory. Require a historical tree.
    const historicalType = spawnSync(
      'git',
      [
        'cat-file',
        '-t',
        `${directoryMetadataRevision}:${path.relative(root, resource).replaceAll('\\', '/')}`,
      ],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
    if (historicalType.status !== 0 || historicalType.stdout.trim() !== 'tree')
      throw new Error(`promotion ${kind} resource directory metadata remains unverified`);
    return null;
  }
  if (directoryMetadataRevision) {
    const relative = path.relative(root, resource).replaceAll('\\', '/');
    const historicalEntry = spawnSync(
      'git',
      ['ls-tree', '-z', directoryMetadataRevision, '--', `:(literal)${relative}`],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
    // git-show on mode 120000 returns link text, not the historical resource.
    // A current regular file must not make those bytes into capture evidence.
    if (
      historicalEntry.status !== 0 ||
      !/^(?:100644|100755) blob [0-9a-f]+\t/u.test(historicalEntry.stdout)
    )
      throw new Error(`promotion ${kind} resource historical file identity remains unverified`);
  }
  return resource;
}

// Retain authored module identity before realpath can erase a historical link.
// Ordinary consumer resolution still supports canonical in-repository imports;
// this stricter rule applies only when comparing source bytes with evidence.
function assertPromotionModulePath(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  if (relative.startsWith('..') || path.isAbsolute(relative))
    throw new Error('promotion module resolves outside the repository; remains unverified');
  let component = path.resolve(root);
  for (const part of relative.split(path.sep)) {
    component = path.join(component, part);
    let stat;
    try {
      stat = fs.lstatSync(component, { throwIfNoEntry: false });
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') break;
      throw error;
    }
    if (stat?.isSymbolicLink())
      throw new Error('promotion module dependency symlink remains unverified');
    if (!stat) break;
  }
}

function reachableSourcePaths(
  candidates,
  aliasConfig = { aliases: new Map(), unsupported: new Set() },
  root = process.cwd(),
  { promotionPackages = false, promotionRevision = null } = {}
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
          classifiedSpecifier,
          root,
          packageMetadata
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
          if (promotionPackages) assertPromotionModulePath(root, candidate);
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
  if (promotionPackages) {
    const config = path.join(root, 'apps/www/astro.config.mjs');
    if (fs.existsSync(config)) {
      const localStylesheets = [];
      const inlineStyles = [];
      const configIssues = astroHeadImportMapIssues(root, localStylesheets, inlineStyles, {
        promotion: true,
      });
      if (configIssues.length) throw new Error('promotion config head resources remain unverified');
      const viteRoot = path.join(root, 'apps/www');
      for (const url of promotionStyleResourceUrls(config, inlineStyles))
        reachable.add(
          promotionResourcePath(root, canonicalRoot, config, viteRoot, 'head CSS', url)
        );
      for (const url of localStylesheets) {
        const target = promotionResourcePath(
          root,
          canonicalRoot,
          config,
          viteRoot,
          'head stylesheet',
          url
        );
        reachable.add(target);
        pending.push({ sourcePath: target, viteRoot });
      }
    }
  }
  const visitedContexts = new Set();
  while (pending.length > 0) {
    const { sourcePath, viteRoot } = pending.pop();
    if (promotionPackages) assertPromotionModulePath(root, sourcePath);
    const sourceRelative = path.relative(canonicalRoot, fs.realpathSync(sourcePath));
    if (sourceRelative.startsWith('..') || path.isAbsolute(sourceRelative))
      throw new Error('Source import resolves outside the repository');
    const contextKey = `${sourcePath}\0${viteRoot}`;
    if (visitedContexts.has(contextKey)) continue;
    if (promotionPackages && visitedContexts.size >= 500)
      throw new Error('promotion package closure reached the 500-module bound; remains unverified');
    visitedContexts.add(contextKey);
    if (promotionPackages) {
      for (const [kind, url] of [
        ...promotionStyleResourceUrls(sourcePath).map((url) => ['CSS', url]),
        ...promotionMarkupResourceUrls(sourcePath).map((url) => ['markup', url]),
      ]) {
        const resource = promotionResourcePath(
          root,
          canonicalRoot,
          sourcePath,
          viteRoot,
          kind,
          url
        );
        // Hash resource bytes only. Fonts/images, even with code-like bytes or
        // extensions, do not become executable module traversal roots.
        reachable.add(resource);
      }
    }
    for (const specifier of moduleSpecifiersForWebsiteSource(sourcePath)) {
      if (isScriptResourceSpecifier(specifier)) {
        if (promotionPackages) {
          const url = JSON.parse(specifier.slice(SCRIPT_RESOURCE_SPECIFIER_PREFIX.length, -1));
          if (
            typeof url !== 'string' ||
            url !== url.trim() ||
            /[\u0000-\u001f\u007f]/u.test(url) ||
            /^(?:[a-z][a-z\d+.-]*:|\/\/)/iu.test(url)
          )
            throw new Error(`promotion script resource URL in ${sourcePath} remains unverified`);
          const resource = promotionResourcePath(
            root,
            canonicalRoot,
            sourcePath,
            viteRoot,
            'script',
            url,
            { directoryMetadataRevision: promotionRevision }
          );
          // Native URL construction supplies a resource edge, never an
          // executable module edge, even if the file contains source text.
          if (resource) reachable.add(resource);
        }
        continue;
      }
      if (specifier === UNVERIFIED_DOM_RESOURCE_SPECIFIER) {
        if (promotionPackages)
          throw new Error(`promotion DOM-authored resource in ${sourcePath} remains unverified`);
        continue;
      }
      if (specifier === OPAQUE_HTML_SINK_SPECIFIER) {
        if (promotionPackages)
          throw new Error(`promotion opaque DOM HTML sink in ${sourcePath} remains unverified`);
        continue;
      }
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
function maskAuthoredMarkupComments(content, sourcePath, { includeScripts = false } = {}) {
  const ranges = [];
  try {
    if (/\.html?$/iu.test(sourcePath)) {
      const visit = (node) => {
        if (
          (node.nodeName === '#comment' || (includeScripts && node.tagName === 'script')) &&
          node.sourceCodeLocation
        )
          ranges.push([node.sourceCodeLocation.startOffset, node.sourceCodeLocation.endOffset]);
        for (const child of node.childNodes ?? []) visit(child);
        if (node.content) visit(node.content);
      };
      visit(parseHtml(content, { sourceCodeLocationInfo: true }));
    } else if (/\.astro$/iu.test(sourcePath)) {
      const result = parseAstro(content, { position: true });
      if (result.diagnostics.some((diagnostic) => diagnostic.severity === 1)) return content;
      const nodePositions = [];
      const visit = (node) => {
        if (
          node.position &&
          (node.type === 'comment' ||
            (includeScripts && node.type === 'element' && node.name?.toLowerCase() === 'script'))
        )
          nodePositions.push({
            startByte: node.position.start.offset,
            endByte: node.position.end.offset,
            comment: node.type === 'comment',
          });
        for (const child of node.children ?? []) visit(child);
      };
      visit(result.ast);
      if (nodePositions.length === 0) return content;
      // Astro reports UTF-8 byte offsets; parse5 reports JavaScript code units.
      // Convert only requested boundaries in one pass, without allocating a
      // source-length map or repeatedly decoding prefixes for every comment.
      const requested = new Set(
        nodePositions.flatMap(({ startByte, endByte }) => [startByte, endByte])
      );
      const codeUnitOffsets = new Map();
      let byteOffset = 0;
      let codeUnitOffset = 0;
      for (const character of content) {
        if (requested.has(byteOffset)) codeUnitOffsets.set(byteOffset, codeUnitOffset);
        byteOffset += Buffer.byteLength(character, 'utf8');
        codeUnitOffset += character.length;
      }
      if (requested.has(byteOffset)) codeUnitOffsets.set(byteOffset, codeUnitOffset);
      for (const { startByte, endByte, comment } of nodePositions) {
        const offset = codeUnitOffsets.get(startByte);
        const end = codeUnitOffsets.get(endByte);
        if (offset === undefined || end === undefined) continue;
        // Astro's comment start excludes the four ASCII delimiter bytes.
        const start = comment && !content.startsWith('<!--', offset) ? offset - 4 : offset;
        if (
          start >= 0 &&
          (comment ? content.startsWith('<!--', start) : content[start] === '<') &&
          end >= offset &&
          end <= content.length
        )
          ranges.push([start, end]);
      }
    }
  } catch {
    // Do not erase unproven bytes. The existing tag lexer remains the fallback.
    return content;
  }
  const characters = content.split('');
  for (const [start, end] of ranges)
    for (let index = start; index < end; index += 1)
      if (characters[index] !== '\n' && characters[index] !== '\r') characters[index] = ' ';
  return characters.join('');
}
function unreviewedWebsiteEmbeds(content, sourcePath) {
  const parserOwned = /\.(?:html?|astro)$/iu.test(sourcePath);
  const markup = markupSourceForJsxFallback(
    maskAuthoredMarkupComments(content, sourcePath, { includeScripts: parserOwned }),
    sourcePath,
    { scriptsAlreadyMasked: parserOwned }
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
      for (const specifier of documentBaseSpecifiers(markup, absolutePath)) {
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
      for (const specifier of externalScriptModuleSpecifiers(content, absolutePath)) {
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
      if (isScriptResourceSpecifier(specifier)) continue;
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
    if (rawImport.category === 'unverified-navigation-url') {
      issues.push(
        `${relativePath}: executable navigation URL in \`${rawImport.sourcePath}\` is unverified; javascript: payloads are not admitted`
      );
      continue;
    }
    if (rawImport.category === 'unverified-style-body') {
      issues.push(
        `${relativePath}: DOM style body in \`${rawImport.sourcePath}\` is unverified; CSS must be a static string with no unresolved browser imports`
      );
      continue;
    }
    if (rawImport.category === 'unverified-html-sink') {
      issues.push(
        `${relativePath}: DOM HTML sink in \`${rawImport.sourcePath}\` is unverified; recognized HTML-parsing calls and innerHTML/outerHTML writes require static inspected markup or explicit reviewed admission`
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
        `${relativePath}: runtime code compilation in \`${rawImport.sourcePath}\` is unverified; recognized eval/Function, WebAssembly and string-or-unresolved timer entry points require an explicit reviewed admission`
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
      if (websiteRawImportIsAllowed(rawImport.sourcePath, rawImport.specifier, rawImport, rootDir))
        continue;
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
      if (websiteRawImportIsAllowed(rawImport.sourcePath, rawImport.specifier, rawImport, rootDir))
        continue;
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
    if (websiteRawImportIsAllowed(rawImport.sourcePath, rawImport.specifier, rawImport, rootDir))
      continue;
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
      const content = maskAuthoredMarkupComments(fs.readFileSync(absolutePath, 'utf8'), sourcePath);
      const markup = markupSourceForJsxFallback(
        maskAuthoredMarkupComments(content, sourcePath, { includeScripts: true }),
        absolutePath,
        { scriptsAlreadyMasked: true }
      );
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
      for (const specifier of documentBaseSpecifiers(content, absolutePath))
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
      if (isScriptResourceSpecifier(specifier)) continue;
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
    if (rawImport.category === 'unverified-navigation-url') {
      issues.push(
        `${relativePath}: executable navigation URL in \`${rawImport.sourcePath}\` is unverified; javascript: payloads are not admitted`
      );
      continue;
    }
    if (rawImport.category === 'unverified-style-body') {
      issues.push(
        `${relativePath}: DOM style body in \`${rawImport.sourcePath}\` is unverified; CSS must be a static string with no unresolved browser imports`
      );
      continue;
    }
    if (rawImport.category === 'unverified-html-sink') {
      issues.push(
        `${relativePath}: DOM HTML sink in \`${rawImport.sourcePath}\` is unverified; recognized HTML-parsing calls and innerHTML/outerHTML writes require static inspected markup or explicit reviewed admission`
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
        `${relativePath}: runtime code compilation in \`${rawImport.sourcePath}\` is unverified; recognized eval/Function, WebAssembly and string-or-unresolved timer entry points require an explicit reviewed admission`
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
    { promotionPackages: true, promotionRevision: commit }
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

// The public optical diagnostic fixture reaches this reviewed host resource
// owner directly. It remains an exact source+digest+owner binding, never a
// packages/** exemption or admission of another application's controller.
const WEBSITE_STARTUP_EVENT_SOURCE = 'packages/modules/event/src/kernel.ts';
const WEBSITE_STARTUP_EVENT_SHA256 =
  STARTUP_PRERENDER_IMPORT_ALLOWLIST[WEBSITE_STARTUP_EVENT_SOURCE].sourceSha256;
const WEBSITE_OPTICAL_HOST_SOURCE = 'packages/adapters/base/src/material/program-pool.ts';
const WEBSITE_OPTICAL_HOST_SHA256 =
  '9fc0918aa83c85f0c5f99d4080dad1f8f247cbf266401c63e65bd8257839c658';
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
    const isReviewedOpticalHost = sourcePath === WEBSITE_OPTICAL_HOST_SOURCE;
    if (
      sourcePaths.length !== 1 ||
      (!isWebsiteSource &&
        !isPublicExecutable &&
        !isReviewedOpticalHost &&
        sourcePath !== WEBSITE_STARTUP_EVENT_SOURCE)
    ) {
      issues.push(
        `${context}: source binding must name exactly one \`apps/www/src/**\` path, executable \`apps/www/public/**/*.{html,js,mjs,cjs,svg}\` path, or an exact reviewed optical/build-time event source`
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
    if (sourcePath === WEBSITE_STARTUP_EVENT_SOURCE) {
      try {
        assertPromotionModulePath(rootDir, absolutePath);
        if (
          !fs.lstatSync(absolutePath).isFile() ||
          sourceScanDigest(absolutePath) !== WEBSITE_STARTUP_EVENT_SHA256 ||
          binding.digest !== WEBSITE_STARTUP_EVENT_SHA256 ||
          binding.ownerIds.length !== 1 ||
          binding.ownerIds[0] !== 'www.build.style-generation'
        )
          throw new Error('unexpected build-time event bytes or owner');
      } catch {
        issues.push(
          `${relativePath}:${binding.line}: exact startup event source, digest and build owner remain unverified`
        );
        continue;
      }
    }
    if (sourcePath === WEBSITE_OPTICAL_HOST_SOURCE) {
      try {
        assertPromotionModulePath(rootDir, absolutePath);
        if (
          !fs.lstatSync(absolutePath).isFile() ||
          createHash('sha256').update(fs.readFileSync(absolutePath)).digest('hex') !==
            WEBSITE_OPTICAL_HOST_SHA256 ||
          binding.digest !== WEBSITE_OPTICAL_HOST_SHA256 ||
          binding.ownerIds.length !== 1 ||
          binding.ownerIds[0] !== 'www.demo.raw-adapter-runtimes'
        )
          throw new Error('unexpected host bytes or owner');
      } catch {
        issues.push(
          `${relativePath}:${binding.line}: exact optical host source, digest and owner remain unverified`
        );
        continue;
      }
    }
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
  const previousCache = activeScriptSpecifierCache;
  activeScriptSpecifierCache = createScriptSpecifierCache();
  try {
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
  } finally {
    activeScriptSpecifierCache = previousCache;
  }
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
