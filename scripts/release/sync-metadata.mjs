import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { ROOT_DIR, getAllPackages } from './lib.mjs';
import { validatePreservedReadmeMetadata } from './readme-metadata.mjs';

const REPO_URL = 'https://github.com/Proto-UI/Proto-UI';
const REPO_GIT_URL = 'git+https://github.com/Proto-UI/Proto-UI.git';
const BUGS_URL = 'https://github.com/Proto-UI/Proto-UI/issues';
const RELEASE_VERSION = readFileSync(join(ROOT_DIR, 'VERSION'), 'utf8').trim();

const PACKAGE_RULES = {
  '@proto.ui/core': {
    description: 'Proto UI core syntax and protocol primitives.',
    kind: 'infrastructure',
    purpose:
      'Provides the core authoring syntax, protocol primitives, and shared contracts used across Proto UI packages.',
    role: 'Core package for defining prototypes, handles, template primitives, and protocol-facing developer APIs.',
  },
  '@proto.ui/runtime': {
    description: 'Proto UI runtime that executes prototypes under the Proto UI contracts.',
    kind: 'infrastructure',
    purpose:
      'Implements the runtime execution flow that adapters can host under the Proto UI contracts.',
    role: 'Runtime package that coordinates setup, rendering, lifecycle, module orchestration, and host execution boundaries.',
  },
  '@proto.ui/types': {
    description: 'Shared type definitions for Proto UI packages.',
    kind: 'infrastructure',
    purpose:
      'Provides the unified type definitions shared by the rest of the Proto UI package graph.',
    role: 'Type foundation package used by core, runtime, modules, adapters, and prototype libraries.',
  },
  '@proto.ui/hooks': {
    description: 'Proto UI built-in author-facing hooks powered by the runtime bridge.',
    kind: 'infrastructure',
    purpose:
      'Provides the built-in `as-*` hook DSL used by prototypes, while keeping runtime bridge mechanics out of `@proto.ui/core`.',
    role: 'Author-facing hook package for focus, overlay, trigger, collection, boundary, hit-participation, scroll-surface, and text-control helpers.',
    // Contributor-authored README documents authoring constraints; preserve it.
    preserveReadme: true,
  },
  '@proto.ui/module-base': {
    description: 'Base package for building Proto UI modules.',
    kind: 'module-base',
    capability: 'module foundation',
    purpose:
      'Provides the base template, shared capabilities, and development utilities for building Proto UI modules.',
    role: 'Module foundation package used to implement adapter-facing modules in a consistent way.',
  },
  '@proto.ui/adapter-base': {
    description: 'Base package for building Proto UI adapters.',
    kind: 'adapter-base',
    target: 'custom adapter hosts',
    purpose:
      'Provides the base template, shared host wiring, and common runtime bridges for building Proto UI adapters.',
    role: 'Adapter foundation package used to translate Proto UI contracts into concrete host integrations.',
  },
  '@proto.ui/module-a11y': {
    description: 'Proto UI module that records accessibility semantic object IR.',
    kind: 'module',
    capability: 'accessibility semantic object IR recording',
    purpose:
      'Records accessibility semantic object IR for host projection. This package is intentionally not a Web ARIA wrapper; adapters decide how to map the semantic object snapshot to their host accessibility surface.',
    role: 'Adapter-facing module package used by the Proto UI runtime and adapter layer.',
    // Contributor-authored README states the non-ARIA ownership boundary; preserve it.
    preserveReadme: true,
    extraKeywords: ['accessibility'],
  },
  '@proto.ui/module-anatomy': moduleRule('anatomy capability'),
  '@proto.ui/module-as-trigger': moduleRule('as-trigger capability'),
  '@proto.ui/module-boundary': {
    description: 'Proto UI module that provides interaction-boundary capability.',
    kind: 'module',
    capability: 'interaction-boundary capability',
    purpose:
      'Provides boundary judgments such as click-outside and focus-outside so prototypes can react to interactions that happen beyond their own region.',
    role: 'Adapter-facing module package used by the Proto UI runtime and adapter layer.',
  },
  '@proto.ui/module-collection': {
    description: 'Proto UI module that projects explicit ordered collection item sets.',
    kind: 'module',
    capability: 'ordered collection projection',
    purpose:
      'Projects anatomy order into ordered collection snapshots. It does not own selection, focus movement, keyboard policy, or accessibility pattern semantics.',
    role: 'Adapter-facing module package used by the Proto UI runtime and adapter layer.',
    // Contributor-authored README states the non-ownership boundary; preserve it.
    preserveReadme: true,
  },
  '@proto.ui/module-context': moduleRule('context capability'),
  '@proto.ui/module-event': {
    ...moduleRule('event capability'),
    preserveReadme: true,
  },
  '@proto.ui/module-expose': moduleRule('expose capability'),
  '@proto.ui/module-expose-event': {
    ...moduleRule('outward signal expose capability'),
    preserveReadme: true,
    extraKeywords: ['signal'],
  },
  '@proto.ui/module-expose-state': moduleRule('state expose capability'),
  '@proto.ui/module-expose-state-web': moduleRule('web state expose capability'),
  '@proto.ui/module-feedback': moduleRule('feedback capability'),
  '@proto.ui/module-focus': moduleRule('focus capability'),
  '@proto.ui/module-hit-participation': {
    description: 'Proto UI module that provides hit-participation capability.',
    kind: 'module',
    capability: 'hit-participation capability',
    purpose:
      'Provides reliable hit-testing semantics and click participation interpretation for prototype interaction logic.',
    role: 'Adapter-facing module package used by the Proto UI runtime and adapter layer.',
    extraKeywords: ['hit-participation'],
  },
  '@proto.ui/module-overlay': moduleRule('overlay capability'),
  '@proto.ui/module-positioning': {
    description: 'Proto UI module for host-mediated anchored positioning.',
    kind: 'module',
    capability: 'host-mediated anchored positioning',
    purpose:
      'Provides collision-aware placement policy and host leases so prototypes can position floating content relative to an anchor without owning browser geometry APIs.',
    role: 'Adapter-facing module package used by the Proto UI runtime and adapter layer.',
    // Contributor-authored README documents the external runtime dependency; preserve it.
    preserveReadme: true,
  },
  '@proto.ui/module-presence': {
    description: 'Proto UI module that provides structural presence governance for adapters.',
    kind: 'module',
    capability: 'structural presence governance',
    purpose:
      'Provides soft mount and unmount timing so transition-driven prototypes can keep host elements present until exit work is complete.',
    role: 'Adapter-facing module package used by the Proto UI runtime and adapter layer.',
    extraKeywords: ['transition'],
  },
  '@proto.ui/module-props': moduleRule('props capability'),
  '@proto.ui/module-rule': moduleRule('rule capability'),
  '@proto.ui/module-rule-expose-state-web': moduleRule('rule-based web state expose capability'),
  '@proto.ui/module-rule-meta': moduleRule('rule metadata capability'),
  '@proto.ui/module-scroll': moduleRule('host-mediated scroll capability'),
  '@proto.ui/module-state': moduleRule('state capability'),
  '@proto.ui/module-state-accessibility': moduleRule('state accessibility capability'),
  '@proto.ui/module-state-interaction': moduleRule('state interaction capability'),
  '@proto.ui/module-test-sys': moduleRule('test system capability'),
  '@proto.ui/module-text-control': {
    description: 'Proto UI portable multiline text-control host protocol.',
    kind: 'module',
    capability: 'multiline text-control host protocol',
    purpose:
      'Owns the host boundary for a semantic plain-text/multiline/host-owned editing requirement: stable controlled or uncontrolled value ownership, normalized input/change/IME composition events, live property projection, and physical focus access. Adapters select the physical host editor; the current Web profile resolves the requirement to `HTMLTextAreaElement`.',
    role: 'Adapter-facing dependency used by Base Textarea and the official Web Component, React, Vue, and Vue 2 adapters.',
    // Contributor-authored README documents the host-boundary contract, non-goals,
    // exports, and the draft rc.7 publication status; preserve it.
    preserveReadme: true,
    extraKeywords: ['text-control', 'textarea'],
  },
  '@proto.ui/adapter-react': adapterRule('React'),
  '@proto.ui/adapter-vue': adapterRule('Vue'),
  '@proto.ui/adapter-vue2': {
    ...adapterRule('Vue 2.6'),
    description:
      'Translates Proto UI prototypes into Vue 2.6 component options for official Web Adapter use.',
    purpose:
      'Translates Proto UI prototypes into Vue 2.6 component options that run through the Proto UI Adapter contracts.',
    preserveReadme: true,
    extraKeywords: ['vue', 'vue2'],
  },
  '@proto.ui/adapter-web-component': adapterRule('Web Components'),
  '@proto.ui/cli': {
    description:
      'Proto UI command line tooling for initialization, component facade generation, and style presets.',
    kind: 'cli',
    purpose:
      'Provides command line tooling for initializing Proto UI workspaces and generating framework integration assets.',
    role: 'CLI package used by applications and maintainers to scaffold Proto UI configuration and generated files.',
  },
  '@proto.ui/prototypes-base': {
    description: 'Base Proto UI prototype library for reusable interaction prototypes.',
    kind: 'prototype-lib',
    style: 'base',
    purpose:
      'Provides the base Proto UI prototype library and reusable interaction prototypes that work with Proto UI adapters.',
    role: 'Prototype library package intended to be consumed together with Proto UI adapters.',
    // Contributor-authored README documents family imports and behavior boundaries.
    preserveReadme: true,
  },
  '@proto.ui/prototypes-shadcn': {
    description: 'shadcn-style Proto UI prototype library for adapter-driven components.',
    kind: 'prototype-lib',
    style: 'shadcn-style',
    purpose:
      'Provides a shadcn-style Proto UI prototype library that works with Proto UI adapters.',
    role: 'Prototype library package intended to be consumed together with Proto UI adapters.',
    // Contributor-authored README retains upstream attribution and family boundaries.
    preserveReadme: true,
  },
  '@proto.ui/prototypes-brutalist': {
    description: 'Neo-Brutalist Proto UI prototype library with package and CLI family imports.',
    kind: 'prototype-lib',
    style: 'neo-brutalist',
    purpose:
      'Provides a Proto UI design-language foundation: square geometry, strong structural borders, hard offset shadows, flat paired colors, and explicit light/dark theme variables.',
    role: 'Prototype library package providing the Neo-Brutalist design language, consumed together with Proto UI adapters via package and CLI family imports.',
    // Contributor-authored README documents families, boundaries, imports, and
    // provenance; metadata sync must not replace it with the generated readme.
    preserveReadme: true,
  },
  '@proto.ui/prototypes-lucide': {
    description: 'Lucide-based Proto UI icon prototype library and svg render helpers.',
    kind: 'prototype-lib',
    style: 'lucide',
    purpose:
      'Provides a standalone `lucide-icon` prototype, per-icon static entrypoints for tree-shaking, a compatibility `renderLucideIcon()` helper, and generated manifest/snippets/loaders for docs and lazy-loading scenarios.',
    role: 'Prototype-oriented icon utilities for Proto UI render templates.',
    // Contributor-authored README keeps Lucide/Feather attribution, generation
    // guidance, and consumption/license notes; preserve it byte-for-byte.
    preserveReadme: true,
    extraKeywords: ['icon', 'svg'],
  },
};

const rootPackage = JSON.parse(readFileSync(join(ROOT_DIR, 'package.json'), 'utf8'));
const packages = getAllPackages().filter(
  (pkg) => pkg.relDir !== 'packages/legacy/rule' && !pkg.isReleaseExcluded
);

// No-write preflight: rule coverage must be closed before any manifest, README,
// or root package mutation, so a future omission cannot leave a partially
// synchronized workspace behind.
const missingRules = packages.filter((pkg) => !PACKAGE_RULES[pkg.name]);
if (missingRules.length > 0) {
  throw new Error(
    `No metadata rule defined for: ${missingRules.map((pkg) => pkg.name).join(', ')}`
  );
}

for (const pkg of packages) {
  const rule = PACKAGE_RULES[pkg.name];
  if (!rule.preserveReadme) continue;
  validatePreservedReadmeMetadata({
    packageName: pkg.name,
    version: RELEASE_VERSION,
    internalDeps: pkg.internalDeps,
    contents: readFileSync(join(pkg.dir, 'README.md'), 'utf8'),
  });
}

for (const pkg of packages) {
  const rule = PACKAGE_RULES[pkg.name];

  const nextManifest = {
    ...pkg.manifest,
    version: RELEASE_VERSION,
    private: false,
    description: rule.description,
    license: 'MIT',
    homepage: `${REPO_URL}/tree/main/${pkg.relDir}`,
    repository: {
      type: 'git',
      url: REPO_GIT_URL,
      directory: pkg.relDir,
    },
    bugs: {
      url: BUGS_URL,
    },
    publishConfig: {
      access: 'public',
      ...(pkg.manifest.publishConfig ?? {}),
    },
    keywords: buildKeywords(pkg, rule),
  };

  writeFileSync(pkg.manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`);
  // Rules may opt out of generated READMEs to keep curated, contributor-authored
  // package documentation intact while manifest metadata still round-trips.
  if (!rule.preserveReadme) {
    writeFileSync(join(pkg.dir, 'README.md'), buildReadme(pkg, rule));
  }
}

rootPackage.scripts = {
  ...rootPackage.scripts,
  'release:sync-metadata': 'node scripts/release/sync-metadata.mjs',
};
writeFileSync(join(ROOT_DIR, 'package.json'), `${JSON.stringify(rootPackage, null, 2)}\n`);

function moduleRule(capability) {
  return {
    description: `Proto UI module that provides ${capability} for adapters.`,
    kind: 'module',
    capability,
    purpose: `Provides ${capability} to adapters running Proto UI prototypes.`,
    role: 'Adapter-facing module package used by the Proto UI runtime and adapter layer.',
  };
}

function adapterRule(target) {
  return {
    description: `Translates Proto UI prototypes into ${target} component functions for use with Proto UI adapters.`,
    kind: 'adapter',
    target,
    purpose: `Translates Proto UI prototypes into ${target} component functions that run through the Proto UI adapter contracts.`,
    role: 'Adapter package intended to be used together with Proto UI prototypes and the shared runtime stack.',
  };
}

function buildKeywords(pkg, rule) {
  const keywords = new Set(['proto-ui']);
  for (const token of pkg.name.replace('@', '').split(/[/.-]/g)) {
    if (token) keywords.add(token);
  }
  if (rule.kind === 'module' || rule.kind === 'module-base') keywords.add('module');
  if (rule.kind === 'adapter' || rule.kind === 'adapter-base') keywords.add('adapter');
  if (rule.kind === 'cli') keywords.add('cli');
  if (rule.kind === 'prototype-lib') keywords.add('prototype-library');
  if (rule.target) keywords.add(String(rule.target).toLowerCase().replace(/\s+/g, '-'));
  if (rule.style) keywords.add(String(rule.style).toLowerCase().replace(/\s+/g, '-'));
  for (const keyword of rule.extraKeywords ?? []) keywords.add(keyword);
  return Array.from(keywords);
}

function buildReadme(pkg, rule) {
  const installName = pkg.name;
  const sourceEntries = listTopLevelSourceEntries(pkg.dir);
  const related =
    pkg.internalDeps.length > 0
      ? pkg.internalDeps.map((dep) => `- \`${dep}\``).join('\n')
      : '- None';

  return `# ${pkg.name}

${rule.description}

## Purpose

${rule.purpose}

## Package Role

${rule.role}

## Install

\`\`\`bash
npm install ${installName}@${RELEASE_VERSION}
\`\`\`

## Internal Structure

${sourceEntries}

## Related Internal Packages

${related}

## License

MIT
`;
}

function listTopLevelSourceEntries(dir) {
  const srcDir = join(dir, 'src');
  try {
    const entries = readdirSync(srcDir, { withFileTypes: true })
      .map((entry) => {
        const suffix = entry.isDirectory() ? '/' : '';
        return `- \`src/${entry.name}${suffix}\``;
      })
      .sort();
    if (entries.length === 0) return '- Source layout is intentionally minimal.';
    return entries.join('\n');
  } catch {
    return '- Source files are emitted from the package build script.';
  }
}
