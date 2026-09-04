import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { parse as parseYaml } from 'yaml';
import { publicDocPolicy } from './public-doc-policy.mjs';

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DOC_EXTENSIONS = ['.md', '.mdx', '/index.md', '/index.mdx'];
const PRERELEASE_PATTERN = /\b\d+\.\d+\.\d+-[0-9A-Za-z.-]+\b/g;
const INSTALL_CONTEXT =
  /(?:\bnpx\b|\bnpm\s+(?:i|install)\b|\bpnpm\s+(?:add|dlx)\b|\byarn\s+add\b|@proto\.ui\/[\w-]+@)/i;
const CURRENT_CONTEXT =
  /\b(?:current|currently|latest|stable|recommended|install|use)\b|当前|目前|最新|稳定|推荐|安装|使用/i;
const HISTORICAL_CONTEXT =
  /\b(?:historical|archived|previous|former|preceding|prerelease evidence)\b|历史|归档|此前|先前|候选阶段|历史证据/i;
const DEVELOPMENT_CONTEXT =
  /\b(?:draft|workspace|development train|unpublished)\b|草案|工作区|开发中|未发布/i;

function relative(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function lineNumber(text, offset) {
  return text.slice(0, offset).split('\n').length;
}

function parseSemver(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(version);
  if (!match) throw new Error(`Invalid governed version: ${version}`);
  return {
    raw: version,
    core: `${match[1]}.${match[2]}.${match[3]}`,
    numbers: match.slice(1, 4).map(Number),
    prerelease: match[4],
  };
}

function compareIdentifiers(left, right) {
  const leftNumber = /^\d+$/.test(left) ? Number(left) : undefined;
  const rightNumber = /^\d+$/.test(right) ? Number(right) : undefined;
  if (leftNumber !== undefined && rightNumber !== undefined) return leftNumber - rightNumber;
  if (leftNumber !== undefined) return -1;
  if (rightNumber !== undefined) return 1;
  return left.localeCompare(right);
}

export function compareSemver(leftVersion, rightVersion) {
  const left = parseSemver(leftVersion);
  const right = parseSemver(rightVersion);
  for (let index = 0; index < 3; index += 1) {
    if (left.numbers[index] !== right.numbers[index]) {
      return left.numbers[index] - right.numbers[index];
    }
  }
  if (!left.prerelease && !right.prerelease) return 0;
  if (!left.prerelease) return 1;
  if (!right.prerelease) return -1;
  const leftParts = left.prerelease.split('.');
  const rightParts = right.prerelease.split('.');
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    if (leftParts[index] === undefined) return -1;
    if (rightParts[index] === undefined) return 1;
    const comparison = compareIdentifiers(leftParts[index], rightParts[index]);
    if (comparison !== 0) return comparison;
  }
  return 0;
}

async function walk(directory, predicate) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(entryPath, predicate)));
    if (entry.isFile() && predicate(entryPath)) files.push(entryPath);
  }
  return files;
}

async function loadVersionTruth(root, policy) {
  const directory = path.join(root, policy.release.versionEntities);
  const files = await walk(directory, (file) => /\.ya?ml$/.test(file));
  const entities = [];
  for (const file of files) {
    const entity = parseYaml(await fs.readFile(file, 'utf8'));
    if (entity?.type === 'version' && entity.release?.version) {
      entities.push({ ...entity, __file: relative(root, file) });
    }
  }
  const stable = entities
    .filter(
      (entity) =>
        entity.status === 'active' &&
        entity.release.channel === 'stable' &&
        !parseSemver(entity.release.version).prerelease
    )
    .sort((left, right) => compareSemver(right.release.version, left.release.version))[0];
  if (!stable) {
    throw new Error(
      `No active stable version entity found under ${policy.release.versionEntities}; the docs checker cannot infer current release truth.`
    );
  }
  const bomSource = stable.sources
    ?.map((source) => (typeof source === 'string' ? source : source?.path))
    .find((source) => typeof source === 'string' && source.endsWith('/package-bom.json'));
  if (!bomSource)
    throw new Error(`${stable.__file}: active stable entity does not reference a package BOM.`);
  const bom = JSON.parse(await fs.readFile(path.join(root, bomSource), 'utf8'));
  if (bom.releaseVersion !== stable.release.version) {
    throw new Error(
      `${bomSource}: releaseVersion ${bom.releaseVersion} does not match ${stable.__file} (${stable.release.version}).`
    );
  }
  const stableCore = parseSemver(stable.release.version).core;
  const precedingPrerelease = entities
    .filter((entity) => {
      const version = parseSemver(entity.release.version);
      return entity.status === 'active' && version.core === stableCore && version.prerelease;
    })
    .sort((left, right) => compareSemver(right.release.version, left.release.version))[0];
  return { stable, bom, bomSource, precedingPrerelease };
}

export function findStaleReleaseClaims({
  file,
  text,
  currentVersion,
  governedSource,
  archived = false,
  pendingMarkers = [],
}) {
  if (archived) return [];
  const errors = [];
  for (const marker of pendingMarkers) {
    const offset = text.toLocaleLowerCase().indexOf(marker.toLocaleLowerCase());
    if (offset !== -1) {
      errors.push(
        `${file}:${lineNumber(text, offset)}: current page says "${marker}" after stable ${currentVersion} became active. Governed source: ${governedSource}. Remove the pending-publication claim or classify the route as archived with a reason.`
      );
    }
  }
  let lineOffset = 0;
  for (const line of text.split('\n')) {
    for (const match of line.matchAll(PRERELEASE_PATTERN)) {
      const installClaim = INSTALL_CONTEXT.test(line);
      const currentClaim =
        CURRENT_CONTEXT.test(line) &&
        !HISTORICAL_CONTEXT.test(line) &&
        !DEVELOPMENT_CONTEXT.test(line);
      if (!installClaim && !currentClaim) continue;
      errors.push(
        `${file}:${lineNumber(text, lineOffset + (match.index ?? 0))}: ${match[0]} is presented as a current install/release claim, but ${currentVersion} is the active stable release. Governed source: ${governedSource}. Use the derived stable version or rewrite the text as explicitly historical.`
      );
    }
    lineOffset += line.length + 1;
  }
  return errors;
}

export function extractSidebarSlugs(source, sourcePath = 'apps/www/astro.config.mjs') {
  const slugs = [...source.matchAll(/\bslug:\s*['"]([^'"]+)['"]/g)].map((match) => match[1]);
  const duplicates = slugs.filter((slug, index) => slugs.indexOf(slug) !== index);
  if (duplicates.length > 0) {
    throw new Error(
      `${sourcePath}: duplicate primary sidebar slug(s): ${[...new Set(duplicates)].join(', ')}`
    );
  }
  return slugs;
}

async function resolveDocSource(root, locale, slug) {
  const base = path.join(root, 'apps/www/src/content/docs', locale, slug);
  for (const extension of DOC_EXTENSIONS) {
    const candidate = `${base}${extension}`;
    try {
      if ((await fs.stat(candidate)).isFile()) return candidate;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  return undefined;
}

export async function checkLocalizedRoutes({ root, slugs, locales, fallbacks = [] }) {
  const errors = [];
  const sources = [];
  for (const locale of locales) {
    for (const slug of slugs) {
      const source = await resolveDocSource(root, locale, slug);
      if (source) {
        sources.push({ locale, slug, file: source });
        continue;
      }
      const fallback = fallbacks.find((entry) => entry.locale === locale && entry.slug === slug);
      if (fallback?.reason) continue;
      errors.push(
        `apps/www/src/content/docs/${locale}/${slug}: missing primary sidebar route for locale=${locale}, slug=${slug}. Add .md/.mdx content or a reviewed navigation fallback with a reason in scripts/docs/public-doc-policy.mjs.`
      );
    }
  }
  return { errors, sources };
}

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
  return undefined;
}

function objectStringProperty(node, name) {
  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property) || propertyName(property.name) !== name) continue;
    if (ts.isStringLiteral(property.initializer)) return property.initializer.text;
  }
  return undefined;
}

export function extractOverviewEntries(source, sourcePath) {
  const opening = source.indexOf('---');
  const closing = source.indexOf('---', opening + 3);
  if (opening !== 0 || closing === -1)
    throw new Error(`${sourcePath}: expected an Astro frontmatter script.`);
  const script = source.slice(opening + 3, closing);
  const sourceFile = ts.createSourceFile(
    sourcePath,
    script,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  let initializer;
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === 'entriesByLibrary') {
        initializer = declaration.initializer;
      }
    }
  }
  if (!initializer || !ts.isObjectLiteralExpression(initializer)) {
    throw new Error(
      `${sourcePath}: could not find the static entriesByLibrary overview inventory.`
    );
  }
  const result = new Map();
  for (const libraryProperty of initializer.properties) {
    if (!ts.isPropertyAssignment(libraryProperty)) continue;
    const library = propertyName(libraryProperty.name);
    if (!library || !ts.isArrayLiteralExpression(libraryProperty.initializer)) continue;
    const entries = [];
    for (const element of libraryProperty.initializer.elements) {
      if (!ts.isObjectLiteralExpression(element)) continue;
      const id = objectStringProperty(element, 'id');
      const href = objectStringProperty(element, 'href');
      if (id) entries.push({ id, href });
    }
    result.set(library, entries);
  }
  return result;
}

function catalogIdFor(library, exportName) {
  const subpath = exportName.slice(2);
  const family = library.familyAliases?.[subpath] ?? subpath;
  return {
    family,
    catalogId: `${library.catalogPrefix}${family.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`,
  };
}

function entityAvailableInRelease(entity, releaseVersion) {
  if (!entity?.since || compareSemver(entity.since, releaseVersion) > 0) return false;
  if (entity.status !== 'removed') return true;
  return entity.removedSince ? compareSemver(entity.removedSince, releaseVersion) > 0 : false;
}

export function checkLibraryInventory({
  releaseVersion,
  bom,
  libraries,
  manifests,
  catalog,
  overviewEntries,
  sidebarSlugs,
}) {
  const errors = [];
  const releasedPackages = new Set(bom.packages.map((entry) => entry.name));
  const catalogById = new Map(catalog.map((entity) => [entity.id, entity]));
  const sidebar = new Set(sidebarSlugs);
  for (const library of libraries) {
    if (!releasedPackages.has(library.packageName)) {
      errors.push(
        `${library.packageName}: library policy is configured, but the package is absent from the ${releaseVersion} BOM. Governed source: ${bom.__source ?? 'package BOM'}.`
      );
      continue;
    }
    const manifest = manifests.get(library.packageName);
    if (!manifest) {
      errors.push(
        `${library.packageName}: package manifest could not be loaded from the release BOM path.`
      );
      continue;
    }
    if (!sidebar.has(library.overviewSlug)) {
      errors.push(
        `${library.packageName}: overview route ${library.overviewSlug} is missing from the primary sidebar.`
      );
    }
    for (const exportName of Object.keys(manifest.exports ?? {})) {
      const classification = library.exportClassifications?.[exportName];
      if (classification) {
        if (!classification.reason) {
          errors.push(
            `${library.packageName} ${exportName}: explicit classification requires a reason.`
          );
        }
        if (classification.kind === 'overview-only') {
          const entity = catalogById.get(classification.catalogId);
          if (!entity || !entityAvailableInRelease(entity, releaseVersion)) {
            errors.push(
              `${library.packageName} ${exportName}: overview-only classification points to unavailable catalog entity ${classification.catalogId} for ${releaseVersion}.`
            );
          }
        }
        continue;
      }
      if (!exportName.startsWith('./') || exportName.includes('*')) {
        errors.push(
          `${library.packageName} ${exportName}: unclassified export. Add a component catalog relation or a reasoned non-component/overview-only classification in scripts/docs/public-doc-policy.mjs.`
        );
        continue;
      }
      const { family, catalogId } = catalogIdFor(library, exportName);
      const entity = catalogById.get(catalogId);
      if (!entity) {
        errors.push(
          `${library.packageName} ${exportName}: unclassified family/export; expected catalog entity ${catalogId}. Add the relation or an explicit reasoned exception.`
        );
        continue;
      }
      if (!entityAvailableInRelease(entity, releaseVersion)) continue;
      const entries = overviewEntries.get(library.id) ?? [];
      const overviewEntry = entries.find((entry) => entry.id === family);
      if (!overviewEntry) {
        errors.push(
          `${library.packageName} ${exportName}: released family ${family} (${catalogId}) is absent from the ${library.id} overview inventory in apps/www/src/components/PrototypeLibraryOverview.astro.`
        );
      }
      const expectedSlug = `${library.detailPrefix}/${family}`;
      if (overviewEntry) {
        const relativeDetail = path.posix.relative(`${library.overviewSlug}/`, `${expectedSlug}/`);
        const expectedHref = `./${relativeDetail}${relativeDetail.endsWith('/') ? '' : '/'}`;
        if (overviewEntry.href !== expectedHref) {
          errors.push(
            `${library.packageName} ${exportName}: overview entry ${family} links to ${overviewEntry.href ?? 'no href'}, expected localized relative href ${expectedHref} for ${expectedSlug}.`
          );
        }
      }
      if (!sidebar.has(expectedSlug)) {
        errors.push(
          `${library.packageName} ${exportName}: released family ${family} (${catalogId}) is absent from primary sidebar slug ${expectedSlug}.`
        );
      }
    }
  }
  return errors;
}

export function checkScaffolding({ documents, markers, exceptions = [] }) {
  const errors = [];
  for (const document of documents) {
    for (const marker of markers) {
      let offset = document.text.indexOf(marker);
      while (offset !== -1) {
        const exception = exceptions.find(
          (entry) =>
            entry.locale === document.locale &&
            entry.slug === document.slug &&
            entry.marker === marker
        );
        if (!exception?.reason) {
          errors.push(
            `${document.file}:${lineNumber(document.text, offset)}: public primary route contains authoring marker "${marker}". Replace the scaffolding or add a reviewed route-specific exception with a reason in scripts/docs/public-doc-policy.mjs.`
          );
        }
        offset = document.text.indexOf(marker, offset + marker.length);
      }
    }
  }
  return errors;
}

export function checkSpecLifecycleProjection({ documents }) {
  const errors = [];
  for (const document of documents) {
    if (document.slug !== 'specifications/introduction') continue;
    if (!document.text.includes('`activeSince`')) {
      errors.push(
        `${document.file}: public spec lifecycle guide must explain \`activeSince\` as distinct from \`since\`.`
      );
    }
  }
  return errors;
}

async function loadCatalog(root) {
  const files = await walk(path.join(root, 'spec/prototypes'), (file) => /\.ya?ml$/.test(file));
  return Promise.all(files.map(async (file) => parseYaml(await fs.readFile(file, 'utf8'))));
}

async function loadLibraryManifests(root, bom, libraries) {
  const byName = new Map(bom.packages.map((entry) => [entry.name, entry]));
  const manifests = new Map();
  for (const library of libraries) {
    const packageEntry = byName.get(library.packageName);
    if (!packageEntry) continue;
    const manifest = JSON.parse(
      await fs.readFile(path.join(root, packageEntry.path, 'package.json'), 'utf8')
    );
    manifests.set(library.packageName, manifest);
  }
  return manifests;
}

export async function runPublicDocsCheck({ root = DEFAULT_ROOT, policy = publicDocPolicy } = {}) {
  const errors = [];
  const releaseTruth = await loadVersionTruth(root, policy);
  releaseTruth.bom.__source = releaseTruth.bomSource;
  const navigationPath = path.join(root, policy.navigation.source);
  const sidebarSlugs = extractSidebarSlugs(
    await fs.readFile(navigationPath, 'utf8'),
    policy.navigation.source
  );
  const routeCheck = await checkLocalizedRoutes({
    root,
    slugs: sidebarSlugs,
    locales: policy.locales,
    fallbacks: policy.navigation.fallbacks,
  });
  errors.push(...routeCheck.errors);

  const archived = new Set(
    policy.release.archivedRoutes.flatMap((entry) =>
      entry.locales.map((locale) => `${locale}:${entry.slug}`)
    )
  );
  const primaryDocuments = await Promise.all(
    routeCheck.sources.map(async (source) => ({
      ...source,
      file: relative(root, source.file),
      text: await fs.readFile(source.file, 'utf8'),
    }))
  );
  errors.push(...checkSpecLifecycleProjection({ documents: primaryDocuments }));
  for (const entry of policy.release.archivedRoutes) {
    if (!entry.reason)
      errors.push(`archived route ${entry.slug}: classification requires a reason.`);
  }
  const releaseDocuments = [
    ...primaryDocuments,
    ...(await Promise.all(
      policy.release.additionalCurrentProjections.map(async (file) => ({
        locale: 'repository',
        slug: file,
        file,
        text: await fs.readFile(path.join(root, file), 'utf8'),
      }))
    )),
  ];
  for (const document of releaseDocuments) {
    errors.push(
      ...findStaleReleaseClaims({
        file: document.file,
        text: document.text,
        currentVersion: releaseTruth.stable.release.version,
        governedSource: releaseTruth.stable.__file,
        archived: archived.has(`${document.locale}:${document.slug}`),
        pendingMarkers: policy.release.pendingMarkers,
      })
    );
  }
  errors.push(
    ...checkScaffolding({
      documents: primaryDocuments,
      markers: policy.scaffolding.markers,
      exceptions: policy.scaffolding.exceptions,
    })
  );

  const overviewPath = path.join(root, policy.overviewInventory);
  const overviewEntries = extractOverviewEntries(
    await fs.readFile(overviewPath, 'utf8'),
    policy.overviewInventory
  );
  errors.push(
    ...checkLibraryInventory({
      releaseVersion: releaseTruth.stable.release.version,
      bom: releaseTruth.bom,
      libraries: policy.libraries,
      manifests: await loadLibraryManifests(root, releaseTruth.bom, policy.libraries),
      catalog: await loadCatalog(root),
      overviewEntries,
      sidebarSlugs,
    })
  );
  return { errors, releaseTruth, sidebarSlugs, primaryDocuments };
}

async function main() {
  const result = await runPublicDocsCheck();
  if (result.errors.length > 0) {
    console.error(`[public-docs] ${result.errors.length} drift issue(s) found:`);
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `[public-docs] OK: ${result.releaseTruth.stable.release.version} from ${result.releaseTruth.stable.__file}; ${result.sidebarSlugs.length} bilingual primary routes; ${publicDocPolicy.libraries.length} library inventories.`
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`[public-docs] ${error.stack ?? error.message}`);
    process.exitCode = 1;
  });
}
