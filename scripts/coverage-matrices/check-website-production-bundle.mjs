import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_GRAPH_PATH = 'apps/www/dist/proto-ui-bundle-graph.json';
const APPROVED_DEMONSTRATION_ENTRY_FACADES = new Set([
  'apps/www/src/components/PrototypePreviewer/HomeDemoPreviewer.astro?astro&type=script&index=0&lang.ts',
  'apps/www/src/components/PrototypePreviewer/PrototypePreviewer.astro?astro&type=script&index=0&lang.ts',
  'apps/www/src/components/PrototypePreviewer/previewer-client.ts',
]);
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

function forbiddenFrameworkFamily(moduleId) {
  const normalized = moduleIdWithoutQuery(moduleId);
  const adapterMatch = normalized.match(/(?:^|\/)packages\/adapters\/(react|vue|vue2)(?:\/|$)/u);
  if (adapterMatch) return adapterMatch[1];
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
  const packagedAdapterMatch = normalized.match(
    /(?:^|\/)node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?@proto\.ui\/adapter-(react|vue|vue2)(?:\/|$)/u
  );
  return packagedAdapterMatch?.[1] ?? null;
}

function reviewedNullFacadeRuntimeModule(chunk) {
  if (chunk.facadeModuleId !== null || !Array.isArray(chunk.moduleIds)) return null;
  const matches = chunk.moduleIds
    .map(moduleIdWithoutQuery)
    .filter((moduleId) => REVIEWED_NULL_FACADE_RUNTIME_MODULES.has(moduleId));
  return matches.length === 1 ? matches[0] : null;
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
  const routeOwnedDemoRoots = approvedDemoRoots.filter((chunk) => chunk.isEntry);
  const reviewedNullFacadeRuntimeChunks = chunks.filter(
    (chunk) => (chunk.isEntry || chunk.isDynamicEntry) && reviewedNullFacadeRuntimeModule(chunk)
  );
  for (const runtimeModule of REVIEWED_NULL_FACADE_RUNTIME_MODULES) {
    const owners = reviewedNullFacadeRuntimeChunks.filter(
      (chunk) => reviewedNullFacadeRuntimeModule(chunk) === runtimeModule
    );
    if (owners.length !== 1) {
      issues.push(
        `production bundle graph must contain exactly one null-facade runtime chunk proven by \`${runtimeModule}\` (found ${owners.length})`
      );
    }
  }
  const shellRoots = chunks.filter(
    (chunk) =>
      (chunk.isEntry || chunk.isDynamicEntry) &&
      !APPROVED_DEMONSTRATION_ENTRY_FACADES.has(chunk.facadeModuleId) &&
      !REVIEWED_DEMONSTRATION_RUNTIME_FACADES.has(chunk.facadeModuleId) &&
      reviewedNullFacadeRuntimeModule(chunk) === null
  );
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

  const forbiddenModulesByChunk = new Map();
  const adapterFamilies = new Set();
  for (const chunk of chunks) {
    const forbiddenModules = (Array.isArray(chunk.moduleIds) ? chunk.moduleIds : []).filter(
      (moduleId) => {
        const family = forbiddenFrameworkFamily(moduleId);
        if (
          family &&
          /(?:^|\/)packages\/adapters\/(?:react|vue|vue2)(?:\/|$)/u.test(
            moduleIdWithoutQuery(moduleId)
          )
        ) {
          adapterFamilies.add(family);
        }
        return family !== null;
      }
    );
    forbiddenModulesByChunk.set(chunk.fileName, forbiddenModules);
  }
  for (const family of REQUIRED_ADAPTER_FAMILIES) {
    if (!adapterFamilies.has(family)) {
      issues.push(`production bundle graph has no module-level evidence for the ${family} Adapter`);
    }
  }

  for (const shellRoot of shellRoots) {
    const leakedModules = new Set();
    for (const fileName of closure(chunksByFileName, shellRoot.fileName, ['imports'])) {
      for (const moduleId of forbiddenModulesByChunk.get(fileName) ?? [])
        leakedModules.add(moduleId);
    }
    if (leakedModules.size > 0) {
      const shellIdentity = shellRoot.facadeModuleId ?? `<null facade: ${shellRoot.fileName}>`;
      issues.push(
        `Website shell entry \`${shellIdentity}\` statically reaches forbidden React/Vue module(s): ${[...leakedModules].sort().join(', ')}`
      );
    }
  }

  const demoStaticClosure = new Set();
  for (const demoRoot of approvedDemoRoots) {
    for (const fileName of closure(chunksByFileName, demoRoot.fileName, ['imports'])) {
      demoStaticClosure.add(fileName);
    }
  }
  for (const [fileName, forbiddenModules] of forbiddenModulesByChunk) {
    if (forbiddenModules.length > 0 && !demoStaticClosure.has(fileName)) {
      issues.push(
        `forbidden framework chunk \`${fileName}\` is not statically owned by an approved demonstration entry`
      );
    }
  }

  return [...new Set(issues)];
}

export function validateWebsiteProductionBundle(options = {}) {
  const issues = collectWebsiteProductionBundleIssues(options);
  if (issues.length > 0) throw new WebsiteProductionBundleValidationError(issues);
  return { shellRuntime: 'web-component', isolatedDemonstrationRuntimes: 3 };
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
      `[website-production-bundle] OK (${result.shellRuntime} shell; ${result.isolatedDemonstrationRuntimes} isolated demonstration runtimes)`
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
