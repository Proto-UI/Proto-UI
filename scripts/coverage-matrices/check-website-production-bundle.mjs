import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_GRAPH_PATH = 'apps/www/dist/proto-ui-bundle-graph.json';
const APPROVED_DEMONSTRATION_ENTRY_FACADES = new Set([
  'apps/www/src/pages/en/test/new-projection-families.astro?astro&type=script&index=0&lang.ts',
  'apps/www/src/pages/en/test/liquid-glass-material.astro?astro&type=script&index=0&lang.ts',
  'apps/www/src/components/PrototypePreviewer/HomeDemoPreviewer.astro?astro&type=script&index=0&lang.ts',
  'apps/www/src/components/PrototypePreviewer/PrototypePreviewer.astro?astro&type=script&index=0&lang.ts',
  'apps/www/src/components/PrototypePreviewer/previewer-client.ts',
  // The style-isolation fixture page is a route-owned demonstration host: it
  // statically mounts the reviewed Web Component demo renderer and lazily
  // mounts each isolated React/Vue/Vue2 Adapter runtime to compare style
  // projection across hosts.
  'apps/www/src/pages/en/test/style-isolation.astro?astro&type=script&index=0&lang.ts',
]);
// Sitewide runtime consumers are admitted as exact entry/owner pairs, never
// by a directory, filename prefix, or arbitrary reachability to shared chunks.
const REVIEWED_SITE_RUNTIME_OWNERS = new Map([
  [
    'apps/www/src/components/Homepage/HomepageRuntime.astro?astro&type=script&index=0&lang.ts',
    'apps/www/src/components/Homepage/homepage-runtime-client.ts',
  ],
  [
    'apps/www/src/components/override/Header.astro?astro&type=script&index=0&lang.ts',
    'apps/www/src/components/site-header-surface.ts',
  ],
  [
    'apps/www/src/components/override/Search.astro?astro&type=script&index=0&lang.ts',
    'apps/www/src/components/site-search-commands.ts',
  ],
  [
    'apps/www/src/components/SiteCopyBootstrap.astro?astro&type=script&index=0&lang.ts',
    'apps/www/src/components/site-copy-client.ts',
  ],
  [
    'apps/www/src/components/SiteTypographyBootstrap.astro?astro&type=script&index=0&lang.ts',
    'apps/www/src/components/site-typography-client.ts',
  ],
]);
const REVIEWED_RENDERER_MODULE = 'apps/www/src/components/PrototypePreviewer/demo-renderer.ts';
const OPTIONAL_DEMONSTRATION_ENTRY_FACADES = new Set([
  // Kept for retained callers; current homepage is owned by HomepageRuntime.
  'apps/www/src/components/PrototypePreviewer/HomeDemoPreviewer.astro?astro&type=script&index=0&lang.ts',
  'apps/www/src/pages/en/test/site-typography.astro?astro&type=script&index=0&lang.ts',
  'apps/www/src/pages/en/test/bootstrap-state-controls.astro?astro&type=script&index=0&lang.ts',
]);
for (const facade of OPTIONAL_DEMONSTRATION_ENTRY_FACADES)
  APPROVED_DEMONSTRATION_ENTRY_FACADES.add(facade);
const REVIEWED_DEMONSTRATION_RUNTIME_FACADES = new Set([
  'apps/www/src/components/PrototypePreviewer/runtimes/react-runtime.ts',
  'apps/www/src/components/PrototypePreviewer/runtimes/vue-runtime.ts',
  'apps/www/src/components/PrototypePreviewer/runtimes/vue2-runtime.ts',
  'apps/www/src/components/PrototypePreviewer/runtimes/wc-runtime.ts',
]);
const REVIEWED_NULL_FACADE_RUNTIME_MODULES = new Set([
  'apps/www/src/components/PrototypePreviewer/runtimes/react-runtime.ts',
  'apps/www/src/components/PrototypePreviewer/runtimes/vue-runtime.ts',
  'apps/www/src/components/PrototypePreviewer/runtimes/vue2-runtime.ts',
]);
const REQUIRED_ADAPTER_FAMILIES = Object.freeze(['react', 'vue', 'vue2']);
const REVIEWED_WEB_COMPONENT_HOST_MODULE =
  'apps/www/src/components/PrototypePreviewer/wc-registry.ts';
const REVIEWED_WEBSITE_CONTROL_MODULE = 'apps/www/src/components/site-shadcn-controls.ts';
// Existing exact source owners in WEBSITE_RAW_IMPORT_ALLOWLIST. Native links
// have their own Surface/Text WC bridge; neither boundary admits React/Vue.
const REVIEWED_WEBSITE_CONTROL_APIS = new Set([
  REVIEWED_WEBSITE_CONTROL_MODULE,
  'apps/www/src/components/site-native-controls.ts',
]);
// Exact Adapter modules reviewed for the site-control bridge closure.
// #801 adds the two source providers imported by the same WC adapt entry;
// exact-head production graph verification remains required for their placement.
// Matrix rule 6 is authoritative; new modules require review, not family-wide inheritance.
const REVIEWED_WEBSITE_CONTROL_ADAPTER_MODULES = new Set([
  'packages/adapters/base/src/events/web-default-action.ts',
  'packages/adapters/base/src/events/web-event-router.ts',
  'packages/adapters/base/src/gate/event-gate.ts',
  'packages/adapters/base/src/gestures/web-move-gesture-host.ts',
  'packages/adapters/base/src/host/adapter-host.ts',
  'packages/adapters/base/src/host/exposes.ts',
  'packages/adapters/base/src/host/surface-projection.ts',
  'packages/adapters/base/src/host/view-epoch-owner.ts',
  'packages/adapters/base/src/host/view-visibility.ts',
  'packages/adapters/base/src/index.ts',
  'packages/adapters/base/src/lifecycle/teardown.ts',
  'packages/adapters/base/src/platform/focus-entry.ts',
  'packages/adapters/base/src/platform/focus-order.ts',
  'packages/adapters/base/src/platform/instance-tree.ts',
  'packages/adapters/base/src/platform/layout-ready.ts',
  'packages/adapters/base/src/platform/web-color-scheme-source.ts',
  'packages/adapters/base/src/platform/web-preferences.ts',
  'packages/adapters/base/src/platform/web-preference-source.ts',
  'packages/adapters/base/src/platform/web-style-support-source.ts',
  'packages/adapters/base/src/public-types.ts',
  'packages/adapters/base/src/types.ts',
  'packages/adapters/base/src/wiring/caps-builder.ts',
  'packages/adapters/base/src/wiring/host-wiring.ts',
  'packages/adapters/web-component/src/adapt.ts',
  'packages/adapters/web-component/src/commit.ts',
  'packages/adapters/web-component/src/debug/hooks.ts',
  'packages/adapters/web-component/src/feedback-style.ts',
  'packages/adapters/web-component/src/host-display.ts',
  'packages/adapters/web-component/src/index.ts',
  'packages/adapters/web-component/src/platform/instance-tree.ts',
  'packages/adapters/web-component/src/platform/meta.ts',
  'packages/adapters/web-component/src/props.ts',
  // Accepted WC-owned opaque fallback/visual-node bookkeeping; this does not
  // admit shader/compiler assets or opt-in installation into ordinary shells.
  'packages/adapters/web-component/src/material/owned-texture-sink.ts',
  'packages/adapters/web-component/src/runtime/experimental-visual-consumer.ts',
  'packages/adapters/web-component/src/visual-surface.ts',
  'packages/adapters/web-component/src/runtime/effects-port.ts',
  'packages/adapters/web-component/src/runtime/modules.ts',
  'packages/adapters/web-component/src/runtime/session.ts',
  'packages/adapters/web-component/src/slot-projector.ts',
  'packages/adapters/web-component/src/style.ts',
  'packages/adapters/web-component/src/types.ts',
  // Merged #652 host resources; exact WC closure only, not shell import APIs.
  'packages/adapters/web-component/src/color-scheme-source.ts',
  'packages/adapters/web-component/src/focus-scope-targets.ts',
  'packages/adapters/web-component/src/keyed-meta-sources.ts',
  'packages/adapters/web-component/src/portal-conceal.ts',
  'packages/adapters/web-component/src/portal-mount.ts',
  'packages/adapters/web-component/src/shadow-color-scheme-environment.ts',
  'packages/adapters/web-component/src/shadow-inner-surface.ts',
  'packages/adapters/web-component/src/shadow-owner-shell.ts',
  'packages/adapters/web-component/src/shadow-profile.ts',
  'packages/adapters/web-component/src/shadow-split-effects.ts',
  'packages/adapters/web-component/src/shadow-split-meta.ts',
  'packages/adapters/web-component/src/shadow-split-resources.ts',
  'packages/adapters/web-component/src/shadow-style-artifact.ts',
  'packages/adapters/web-component/src/shadow-stylesheet-owner.ts',
  'packages/adapters/web-component/src/shadow-text-control-surface.ts',
]);

export class WebsiteProductionBundleValidationError extends Error {
  constructor(issues) {
    super(`Website production bundle validation failed:\n- ${issues.join('\n- ')}`);
    this.name = 'WebsiteProductionBundleValidationError';
    this.issues = issues;
  }
}

function moduleIdWithoutQuery(moduleId) {
  return moduleId.split('?', 1)[0].replaceAll('\\', '/');
}

function adapterFamilyForModule(moduleId) {
  const normalized = moduleIdWithoutQuery(moduleId);
  const adapterMatch = normalized.match(/(?:^|\/)packages\/adapters\/(react|vue|vue2)(?:\/|$)/u);
  if (adapterMatch) return adapterMatch[1];
  const packagedAdapterMatch = normalized.match(
    /(?:^|\/)node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?@proto\.ui\/adapter-(react|vue|vue2)(?:\/|$)/u
  );
  return packagedAdapterMatch?.[1] ?? null;
}

function forbiddenFrameworkFamily(moduleId) {
  const adapterFamily = adapterFamilyForModule(moduleId);
  if (adapterFamily) return adapterFamily;
  const normalized = moduleIdWithoutQuery(moduleId);
  if (
    /(?:^|\/)node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?(?:react|react-dom)(?:\/|$)/u.test(
      normalized
    )
  ) {
    return 'react';
  }
  if (
    /(?:^|\/)node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?(?:vue|@vue\/[^/]+)(?:\/|$)/u.test(
      normalized
    )
  ) {
    return 'vue';
  }
  return null;
}

function isWebComponentAdapterModule(moduleId) {
  const normalized = moduleIdWithoutQuery(moduleId);
  return (
    /(?:^|\/)packages\/adapters\/web-component(?:\/|$)/u.test(normalized) ||
    /(?:^|\/)node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?@proto\.ui\/adapter-web-component(?:\/|$)/u.test(
      normalized
    )
  );
}

function isProtoUiAdapterModule(moduleId) {
  const normalized = moduleIdWithoutQuery(moduleId);
  return (
    /(?:^|\/)packages\/adapters\/[a-z0-9-]+(?:\/|$)/u.test(normalized) ||
    /(?:^|\/)node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?@proto\.ui\/adapter-[a-z0-9-]+(?:\/|$)/u.test(
      normalized
    )
  );
}
function isReviewedWebsiteControlAdapterModule(moduleId) {
  return REVIEWED_WEBSITE_CONTROL_ADAPTER_MODULES.has(moduleIdWithoutQuery(moduleId));
}

function reviewedNullFacadeRuntimeModules(chunk) {
  if (
    (chunk.facadeModuleId !== null &&
      !REVIEWED_NULL_FACADE_RUNTIME_MODULES.has(chunk.facadeModuleId)) ||
    !Array.isArray(chunk.moduleIds)
  )
    return [];
  return [
    ...new Set(
      chunk.moduleIds
        .map(moduleIdWithoutQuery)
        .filter(
          (moduleId) =>
            REVIEWED_NULL_FACADE_RUNTIME_MODULES.has(moduleId) &&
            (chunk.facadeModuleId === null || chunk.facadeModuleId === moduleId)
        )
    ),
  ];
}

function dynamicRuntimeChunksForFamily(chunks, family) {
  return chunks.filter(
    (chunk) =>
      chunk.isDynamicEntry &&
      chunk.moduleIds.some((moduleId) => adapterFamilyForModule(moduleId) === family)
  );
}

function runtimeFamilyModulesInClosure(chunksByFileName, rootFileName, edgeFields) {
  const families = new Set();
  for (const fileName of closure(chunksByFileName, rootFileName, edgeFields)) {
    for (const moduleId of chunksByFileName.get(fileName)?.moduleIds ?? []) {
      const family = forbiddenFrameworkFamily(moduleId);
      if (family && REQUIRED_ADAPTER_FAMILIES.includes(family)) families.add(family);
    }
  }
  return families;
}
function loadGraph(rootDir, graphPath, issues) {
  const absolutePath = path.resolve(rootDir, graphPath);
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    issues.push(
      `production bundle graph is missing at \`${graphPath}\`; run the Website production build first`
    );
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    issues.push(`production bundle graph \`${graphPath}\` is not valid JSON: ${error.message}`);
    return null;
  }
}

function validateChunkRecord(chunk, index, issues) {
  const context = `production bundle graph chunk ${index}`;
  if (!chunk || typeof chunk !== 'object' || Array.isArray(chunk)) {
    issues.push(`${context} must be an object`);
    return false;
  }
  if (typeof chunk.fileName !== 'string' || chunk.fileName.length === 0) {
    issues.push(`${context} must have a non-empty fileName`);
    return false;
  }
  for (const field of ['imports', 'dynamicImports', 'moduleIds']) {
    if (!Array.isArray(chunk[field]) || chunk[field].some((value) => typeof value !== 'string')) {
      issues.push(`${context} \`${chunk.fileName}\` must have a string-array ${field} field`);
    }
  }
  if (chunk.facadeModuleId !== null && typeof chunk.facadeModuleId !== 'string') {
    issues.push(`${context} \`${chunk.fileName}\` facadeModuleId must be a string or null`);
  }
  if (typeof chunk.isEntry !== 'boolean' || typeof chunk.isDynamicEntry !== 'boolean') {
    issues.push(`${context} \`${chunk.fileName}\` must record boolean entry flags`);
  }
  return true;
}

function closure(chunksByFileName, rootFileName, edgeFields) {
  const seen = new Set();
  const pending = [rootFileName];
  while (pending.length > 0) {
    const fileName = pending.pop();
    if (seen.has(fileName)) continue;
    seen.add(fileName);
    const chunk = chunksByFileName.get(fileName);
    if (!chunk) continue;
    for (const field of edgeFields) {
      if (!Array.isArray(chunk[field])) continue;
      for (const importedFileName of chunk[field]) {
        if (typeof importedFileName === 'string') pending.push(importedFileName);
      }
    }
  }
  return seen;
}

export function collectWebsiteProductionBundleIssues({
  rootDir = process.cwd(),
  graph,
  graphPath = DEFAULT_GRAPH_PATH,
} = {}) {
  const issues = [];
  const bundleGraph = graph ?? loadGraph(rootDir, graphPath, issues);
  if (!bundleGraph) return issues;
  if (bundleGraph.version !== 1 || !Array.isArray(bundleGraph.chunks)) {
    issues.push('production bundle graph must have version 1 and a chunks array');
    return issues;
  }

  const chunks = bundleGraph.chunks.filter((chunk, index) =>
    validateChunkRecord(chunk, index, issues)
  );
  const chunksByFileName = new Map();
  for (const chunk of chunks) {
    if (chunksByFileName.has(chunk.fileName)) {
      issues.push(`production bundle graph has duplicate chunk fileName \`${chunk.fileName}\``);
    } else {
      chunksByFileName.set(chunk.fileName, chunk);
    }
  }
  for (const chunk of chunks) {
    for (const field of ['imports', 'dynamicImports']) {
      if (!Array.isArray(chunk[field])) continue;
      for (const importedFileName of chunk[field]) {
        if (typeof importedFileName === 'string' && !chunksByFileName.has(importedFileName)) {
          issues.push(
            `production bundle graph chunk \`${chunk.fileName}\` ${field} references missing chunk \`${importedFileName}\``
          );
        }
      }
    }
  }

  const approvedDemoRoots = chunks.filter(
    (chunk) =>
      (chunk.isEntry || chunk.isDynamicEntry) &&
      APPROVED_DEMONSTRATION_ENTRY_FACADES.has(chunk.facadeModuleId)
  );

  for (const facadeModuleId of APPROVED_DEMONSTRATION_ENTRY_FACADES) {
    const owners = approvedDemoRoots.filter((chunk) => chunk.facadeModuleId === facadeModuleId);
    if (
      owners.length !== 1 &&
      !(owners.length === 0 && OPTIONAL_DEMONSTRATION_ENTRY_FACADES.has(facadeModuleId))
    ) {
      issues.push(
        `production bundle graph must contain exactly one approved demonstration entry for \`${facadeModuleId}\` (found ${owners.length})`
      );
    }
  }
  const routeOwnedDemoRoots = approvedDemoRoots.filter((chunk) => chunk.isEntry);
  const reviewedNullFacadeRuntimeChunks = chunks.filter(
    (chunk) =>
      (chunk.isEntry || chunk.isDynamicEntry) && reviewedNullFacadeRuntimeModules(chunk).length > 0
  );
  for (const runtimeModule of REVIEWED_NULL_FACADE_RUNTIME_MODULES) {
    const owners = reviewedNullFacadeRuntimeChunks.filter((chunk) =>
      reviewedNullFacadeRuntimeModules(chunk).includes(runtimeModule)
    );
    if (owners.length !== 1) {
      issues.push(
        `production bundle graph must contain exactly one null-facade runtime chunk proven by \`${runtimeModule}\` (found ${owners.length})`
      );
    }
  }
  for (const runtimeChunk of chunks) {
    if (
      (REVIEWED_DEMONSTRATION_RUNTIME_FACADES.has(runtimeChunk.facadeModuleId) ||
        reviewedNullFacadeRuntimeModules(runtimeChunk).length > 0) &&
      (runtimeChunk.isEntry || !runtimeChunk.isDynamicEntry)
    )
      issues.push(
        `reviewed demonstration runtime chunk \`${runtimeChunk.fileName}\` must be dynamic-only; direct static entries are not reviewed`
      );
  }
  const shellRoots = chunks.filter(
    (chunk) =>
      chunk.isEntry &&
      !APPROVED_DEMONSTRATION_ENTRY_FACADES.has(chunk.facadeModuleId) &&
      !REVIEWED_DEMONSTRATION_RUNTIME_FACADES.has(chunk.facadeModuleId) &&
      reviewedNullFacadeRuntimeModules(chunk).length === 0
  );
  const reviewedSiteRoots = new Set();
  for (const root of shellRoots) {
    const owner = REVIEWED_SITE_RUNTIME_OWNERS.get(root.facadeModuleId);
    if (!owner) continue;
    const modules = new Set(
      [...closure(chunksByFileName, root.fileName, ['imports'])]
        .flatMap((file) => chunksByFileName.get(file)?.moduleIds ?? [])
        .map(moduleIdWithoutQuery)
    );
    if (modules.has(owner) && modules.has(REVIEWED_RENDERER_MODULE))
      reviewedSiteRoots.add(root.fileName);
    // Identity-only or static use does not need a renderer admission. A runtime
    // edge without both source owners falls through to the ordinary shell wall.
  }
  if (shellRoots.length === 0) issues.push('production bundle graph has no Website shell roots');
  if (routeOwnedDemoRoots.length === 0) {
    issues.push('production bundle graph has no explicitly route-owned demonstration entry');
  }

  const reachableEntryChunks = new Set();
  for (const root of [...shellRoots, ...routeOwnedDemoRoots]) {
    for (const fileName of closure(chunksByFileName, root.fileName, [
      'imports',
      'dynamicImports',
    ])) {
      reachableEntryChunks.add(fileName);
    }
  }
  for (const demoRoot of approvedDemoRoots) {
    if (!reachableEntryChunks.has(demoRoot.fileName)) {
      issues.push(
        `approved demonstration entry \`${demoRoot.facadeModuleId}\` is orphaned from shell or route-owned entry reachability`
      );
    }
  }
  for (const runtimeEntry of chunks.filter(
    (chunk) =>
      (chunk.isEntry || chunk.isDynamicEntry) &&
      REVIEWED_DEMONSTRATION_RUNTIME_FACADES.has(chunk.facadeModuleId)
  )) {
    if (!reachableEntryChunks.has(runtimeEntry.fileName)) {
      issues.push(
        `reviewed demonstration runtime entry \`${runtimeEntry.facadeModuleId}\` is orphaned from shell or route-owned entry reachability`
      );
    }
  }

  const hasProvenWebComponentDemonstrationHost = routeOwnedDemoRoots.some((demoRoot) => {
    const moduleIds = [...closure(chunksByFileName, demoRoot.fileName, ['imports'])].flatMap(
      (fileName) => chunksByFileName.get(fileName)?.moduleIds ?? []
    );
    return (
      moduleIds.some(
        (moduleId) => moduleIdWithoutQuery(moduleId) === REVIEWED_WEB_COMPONENT_HOST_MODULE
      ) && moduleIds.some(isWebComponentAdapterModule)
    );
  });
  if (!hasProvenWebComponentDemonstrationHost) {
    issues.push(
      'production bundle graph has no route-owned demonstration entry with static module-level evidence for both the reviewed Web Component facade registry and Web Component Adapter'
    );
  }

  const forbiddenModulesByChunk = new Map();
  const adapterFamilies = new Set();
  for (const chunk of chunks) {
    const moduleIds = Array.isArray(chunk.moduleIds) ? chunk.moduleIds : [];
    for (const moduleId of moduleIds) {
      const adapterFamily = adapterFamilyForModule(moduleId);
      if (adapterFamily) adapterFamilies.add(adapterFamily);
    }
    const forbiddenModules = moduleIds.filter(
      (moduleId) => forbiddenFrameworkFamily(moduleId) !== null
    );
    forbiddenModulesByChunk.set(chunk.fileName, forbiddenModules);
  }
  for (const family of REQUIRED_ADAPTER_FAMILIES) {
    if (!adapterFamilies.has(family)) {
      issues.push(`production bundle graph has no module-level evidence for the ${family} Adapter`);
    }
  }

  const dynamicAdapterFamilies = new Set();
  for (const family of REQUIRED_ADAPTER_FAMILIES) {
    const owners = dynamicRuntimeChunksForFamily(chunks, family);
    if (owners.length === 0) {
      issues.push(`production bundle graph has no dynamic runtime chunk for the ${family} Adapter`);
    } else {
      dynamicAdapterFamilies.add(family);
    }
  }

  for (const demoRoot of routeOwnedDemoRoots) {
    const staticFamilies = runtimeFamilyModulesInClosure(chunksByFileName, demoRoot.fileName, [
      'imports',
    ]);
    for (const family of staticFamilies) {
      issues.push(
        `route-owned demonstration entry \`${demoRoot.facadeModuleId}\` statically includes the ${family} Adapter; framework runtimes must remain lazy`
      );
    }
    const completeClosure = closure(chunksByFileName, demoRoot.fileName, [
      'imports',
      'dynamicImports',
    ]);
    for (const family of dynamicAdapterFamilies) {
      const owners = dynamicRuntimeChunksForFamily(chunks, family);
      if (!owners.some((owner) => completeClosure.has(owner.fileName))) {
        issues.push(
          `route-owned demonstration entry \`${demoRoot.facadeModuleId}\` does not dynamically reach a ${family} Adapter runtime chunk`
        );
      }
    }
  }

  const reviewedWebsiteControlChunks = new Set(
    chunks
      .filter((chunk) =>
        chunk.moduleIds.some(
          (moduleId) => moduleIdWithoutQuery(moduleId) === REVIEWED_WEBSITE_CONTROL_MODULE
        )
      )
      .map((chunk) => chunk.fileName)
  );
  if (reviewedWebsiteControlChunks.size !== 1) {
    issues.push(
      `production bundle graph must contain exactly one reviewed Website control bridge chunk (found ${reviewedWebsiteControlChunks.size})`
    );
  }
  if (
    reviewedWebsiteControlChunks.size === 1 &&
    !shellRoots.some((shellRoot) => {
      const shellClosure = closure(chunksByFileName, shellRoot.fileName, ['imports']);
      return [...reviewedWebsiteControlChunks].some((fileName) => shellClosure.has(fileName));
    })
  ) {
    issues.push('no Website shell statically reaches the reviewed Website control bridge');
  }
  for (const shellRoot of shellRoots) {
    const shellClosure = closure(chunksByFileName, shellRoot.fileName, ['imports']);
    const leakedModules = new Set();
    for (const fileName of shellClosure) {
      const chunk = chunksByFileName.get(fileName);
      for (const moduleId of chunk?.moduleIds ?? []) {
        const isFrameworkModule = forbiddenFrameworkFamily(moduleId) !== null;
        const isUnapprovedAdapter =
          isProtoUiAdapterModule(moduleId) &&
          !(
            reviewedWebsiteControlChunks.has(fileName) &&
            isReviewedWebsiteControlAdapterModule(moduleId)
          );
        if (isFrameworkModule || isUnapprovedAdapter) leakedModules.add(moduleId);
      }
    }
    if (leakedModules.size > 0) {
      const shellIdentity = shellRoot.facadeModuleId ?? `<null facade: ${shellRoot.fileName}>`;
      issues.push(
        `Website shell entry \`${shellIdentity}\` statically reaches forbidden React/Vue module(s) or Proto UI Adapter module(s): ${[...leakedModules].sort().join(', ')}`
      );
    }
  }
  for (const shellRoot of shellRoots) {
    const staticClosure = closure(chunksByFileName, shellRoot.fileName, ['imports']);
    const completeClosure = closure(chunksByFileName, shellRoot.fileName, [
      'imports',
      'dynamicImports',
    ]);
    const dynamicallyReachedModules = new Set();
    for (const fileName of completeClosure) {
      if (staticClosure.has(fileName)) continue;
      const chunk = chunksByFileName.get(fileName);
      for (const moduleId of chunk?.moduleIds ?? []) {
        if (forbiddenFrameworkFamily(moduleId) !== null || isProtoUiAdapterModule(moduleId)) {
          dynamicallyReachedModules.add(moduleId);
        }
      }
    }
    if (reviewedSiteRoots.has(shellRoot.fileName)) {
      // Follow module-owned edges, not every edge of a shared renderer chunk.
      // Module identity (including queries) must remain exact throughout this
      // traversal; chunk membership alone never supplies importer provenance.
      const moduleRecords = bundleGraph.modules;
      const modulesById = new Map();
      let validModuleGraph = Array.isArray(moduleRecords);
      for (const record of Array.isArray(moduleRecords) ? moduleRecords : []) {
        if (
          !record ||
          typeof record.id !== 'string' ||
          !record.id ||
          modulesById.has(record.id) ||
          !['imports', 'dynamicImports'].every(
            (field) =>
              Array.isArray(record[field]) && record[field].every((id) => typeof id === 'string')
          )
        ) {
          validModuleGraph = false;
          continue;
        }
        modulesById.set(record.id, record);
      }
      for (const record of modulesById.values()) {
        if ([...record.imports, ...record.dynamicImports].some((id) => !modulesById.has(id)))
          validModuleGraph = false;
      }
      for (const fileName of completeClosure) {
        if ((chunksByFileName.get(fileName)?.moduleIds ?? []).some((id) => !modulesById.has(id)))
          validModuleGraph = false;
      }
      if (!validModuleGraph || !modulesById.has(REVIEWED_RENDERER_MODULE)) {
        issues.push(
          `reviewed Website runtime entry \`${shellRoot.facadeModuleId}\` requires complete renderer module-edge provenance`
        );
      }
      const rendererModules = validModuleGraph
        ? closure(modulesById, REVIEWED_RENDERER_MODULE, ['imports', 'dynamicImports'])
        : new Set();
      // Target membership does not authorize another importer's edge to that
      // same target. Find forbidden dependencies reachable without passing
      // through the reviewed renderer API, preserving importer identities.
      const bypassTargets = new Map();
      if (validModuleGraph) {
        const importers = new Map();
        for (const record of modulesById.values()) {
          for (const target of [...record.imports, ...record.dynamicImports]) {
            if (!importers.has(target)) importers.set(target, new Set());
            importers.get(target).add(record.id);
          }
        }
        const reviewedBridgeModules = new Set(
          [...reviewedWebsiteControlChunks]
            .flatMap((fileName) => chunksByFileName.get(fileName)?.moduleIds ?? [])
            .filter(isReviewedWebsiteControlAdapterModule)
        );
        const pending = [];
        for (const fileName of completeClosure) {
          for (const id of chunksByFileName.get(fileName)?.moduleIds ?? []) {
            if (
              (forbiddenFrameworkFamily(id) !== null || isProtoUiAdapterModule(id)) &&
              !reviewedBridgeModules.has(id)
            ) {
              bypassTargets.set(id, id);
              pending.push(id);
            }
          }
        }
        for (let cursor = 0; cursor < pending.length; cursor++) {
          const target = pending[cursor];
          for (const importer of importers.get(target) ?? []) {
            if (importer === REVIEWED_RENDERER_MODULE || bypassTargets.has(importer)) continue;
            bypassTargets.set(importer, bypassTargets.get(target));
            pending.push(importer);
          }
        }
        for (const fileName of completeClosure) {
          for (const importer of chunksByFileName.get(fileName)?.moduleIds ?? []) {
            if (!rendererModules.has(importer) && bypassTargets.has(importer)) {
              issues.push(
                `reviewed Website runtime entry \`${shellRoot.facadeModuleId}\` has an unowned importer edge bypassing its renderer: ${importer} -> ${bypassTargets.get(importer)}`
              );
            }
          }
        }
        // A reviewed bridge target still needs importer provenance. Trace it
        // separately: only this target class may stop at the exact controls API;
        // sharing a visited map with other targets could hide an unsafe origin.
        const bridgeOwnedModules = new Set(
          [...REVIEWED_WEBSITE_CONTROL_APIS].flatMap((id) => [
            ...closure(modulesById, id, ['imports', 'dynamicImports']),
          ])
        );
        const bridgeBypassTargets = new Map();
        const bridgePending = [];
        for (const fileName of completeClosure) {
          for (const id of chunksByFileName.get(fileName)?.moduleIds ?? []) {
            if (reviewedBridgeModules.has(id)) {
              bridgeBypassTargets.set(id, id);
              bridgePending.push(id);
            }
          }
        }
        for (let cursor = 0; cursor < bridgePending.length; cursor++) {
          const target = bridgePending[cursor];
          for (const importer of importers.get(target) ?? []) {
            if (
              importer === REVIEWED_RENDERER_MODULE ||
              REVIEWED_WEBSITE_CONTROL_APIS.has(importer) ||
              bridgeBypassTargets.has(importer)
            )
              continue;
            bridgeBypassTargets.set(importer, bridgeBypassTargets.get(target));
            bridgePending.push(importer);
          }
        }
        for (const fileName of completeClosure) {
          for (const importer of chunksByFileName.get(fileName)?.moduleIds ?? []) {
            if (
              !rendererModules.has(importer) &&
              !bridgeOwnedModules.has(importer) &&
              bridgeBypassTargets.has(importer)
            ) {
              issues.push(
                `reviewed Website runtime entry \`${shellRoot.facadeModuleId}\` has an unowned importer edge bypassing its site-control bridge: ${importer} -> ${bridgeBypassTargets.get(importer)}`
              );
            }
          }
        }
      }
      for (const fileName of completeClosure) {
        if (staticClosure.has(fileName)) continue;
        for (const moduleId of chunksByFileName.get(fileName)?.moduleIds ?? []) {
          if (
            (forbiddenFrameworkFamily(moduleId) !== null || isProtoUiAdapterModule(moduleId)) &&
            !rendererModules.has(moduleId)
          ) {
            issues.push(
              `reviewed Website runtime entry \`${shellRoot.facadeModuleId}\` reaches Adapter module outside its renderer closure: ${moduleId}`
            );
          }
        }
      }
      continue;
    }
    if (dynamicallyReachedModules.size > 0) {
      const shellIdentity = shellRoot.facadeModuleId ?? `<null facade: ${shellRoot.fileName}>`;
      issues.push(
        `Website shell entry \`${shellIdentity}\` dynamically reaches forbidden React/Vue module(s) or Proto UI Adapter module(s): ${[...dynamicallyReachedModules].sort().join(', ')}`
      );
    }
  }

  const demoStaticClosure = new Set();
  const demoCompleteClosure = new Set();
  for (const demoRoot of [
    ...approvedDemoRoots,
    ...shellRoots.filter((root) => reviewedSiteRoots.has(root.fileName)),
  ]) {
    for (const fileName of closure(chunksByFileName, demoRoot.fileName, ['imports'])) {
      demoStaticClosure.add(fileName);
    }
    for (const fileName of closure(chunksByFileName, demoRoot.fileName, [
      'imports',
      'dynamicImports',
    ])) {
      demoCompleteClosure.add(fileName);
    }
  }
  for (const [fileName, forbiddenModules] of forbiddenModulesByChunk) {
    if (
      forbiddenModules.length > 0 &&
      !demoStaticClosure.has(fileName) &&
      !demoCompleteClosure.has(fileName)
    ) {
      issues.push(
        `forbidden framework chunk \`${fileName}\` is not owned by an approved demonstration entry`
      );
    }
  }

  return [...new Set(issues)];
}

export function validateWebsiteProductionBundle(options = {}) {
  const issues = collectWebsiteProductionBundleIssues(options);
  if (issues.length > 0) throw new WebsiteProductionBundleValidationError(issues);
  return {
    shellRuntime: 'native/static with source-owned lazy runtime consumers',
    primaryDemonstrationHost: 'web-component',
    isolatedDemonstrationRuntimes: 3,
  };
}

function isMainModule() {
  return (
    Boolean(process.argv[1]) &&
    pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
  );
}

if (isMainModule()) {
  try {
    const result = validateWebsiteProductionBundle();
    console.log(
      `[website-production-bundle] OK (${result.shellRuntime} shell; ${result.primaryDemonstrationHost} primary demonstration host; ${result.isolatedDemonstrationRuntimes} isolated demonstration runtimes)`
    );
  } catch (error) {
    if (error instanceof WebsiteProductionBundleValidationError) {
      console.error(`[website-production-bundle] ${error.message}`);
      process.exitCode = 1;
    } else {
      throw error;
    }
  }
}
