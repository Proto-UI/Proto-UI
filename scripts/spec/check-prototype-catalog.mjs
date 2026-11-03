import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { parse as parseYaml } from 'yaml';

import { mapWithConcurrency } from './bounded-map.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROTOTYPES_ROOT = path.join(REPO_ROOT, 'packages/prototypes');
const SPEC_PROTOTYPES_ROOT = path.join(REPO_ROOT, 'spec/prototypes');
const SPEC_TESTS_ROOT = path.join(REPO_ROOT, 'spec/tests');
const DEBT_PATH = path.join(REPO_ROOT, 'internal/baselines/prototype-catalog-debt.json');
const SOURCE_EXTENSION = /\.(?:[cm]?[jt]sx?)$/;
const PROTO_SOURCE_EXTENSION = /\.proto\.(?:[cm]?[jt]sx?)$/;
const DECLARATION_NAMES = new Map([
  ['definePrototype', 'prototype'],
  ['defineAsHook', 'asHook'],
]);

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

function relative(file) {
  return path.relative(REPO_ROOT, file).split(path.sep).join('/');
}

function sourceKind(file) {
  if (file.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (file.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (/\.[cm]?js$/.test(file)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function importedDeclarationBindings(sourceFile) {
  const identifiers = new Map();
  const namespaces = new Set();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (statement.moduleSpecifier.text !== '@proto.ui/core') continue;
    const clause = statement.importClause;
    if (!clause?.namedBindings) continue;
    if (ts.isNamespaceImport(clause.namedBindings)) {
      namespaces.add(clause.namedBindings.name.text);
      continue;
    }
    for (const element of clause.namedBindings.elements) {
      const importedName = element.propertyName?.text ?? element.name.text;
      if (DECLARATION_NAMES.has(importedName)) {
        identifiers.set(element.name.text, DECLARATION_NAMES.get(importedName));
      }
    }
  }
  return { identifiers, namespaces };
}

function declarationKind(expression, bindings) {
  if (ts.isIdentifier(expression)) return bindings.identifiers.get(expression.text);
  if (
    ts.isPropertyAccessExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    bindings.namespaces.has(expression.expression.text)
  ) {
    return DECLARATION_NAMES.get(expression.name.text);
  }
  return undefined;
}

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return node.text;
  }
  return undefined;
}

function staticProtocolName(call) {
  const options = call.arguments[0];
  if (!options || !ts.isObjectLiteralExpression(options)) return undefined;
  for (const property of options.properties) {
    if (!ts.isPropertyAssignment(property) || propertyName(property.name) !== 'name') continue;
    const value = property.initializer;
    if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) return value.text;
  }
  return undefined;
}

async function inspectSource(file) {
  const text = await fs.readFile(file, 'utf8');
  const sourceFile = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    sourceKind(file)
  );
  const bindings = importedDeclarationBindings(sourceFile);
  const concrete = [];
  let dynamicDeclarations = 0;
  let topLevelDynamicDeclarations = 0;

  function visit(node, functionDepth = 0) {
    if (ts.isCallExpression(node)) {
      const kind = declarationKind(node.expression, bindings);
      if (kind) {
        const name = staticProtocolName(node);
        if (name) concrete.push({ kind, name });
        else if (functionDepth > 0) dynamicDeclarations += 1;
        else topLevelDynamicDeclarations += 1;
      }
    }
    const childFunctionDepth = ts.isFunctionLike(node) ? functionDepth + 1 : functionDepth;
    ts.forEachChild(node, (child) => visit(child, childFunctionDepth));
  }
  visit(sourceFile);
  return { file: relative(file), concrete, dynamicDeclarations, topLevelDynamicDeclarations };
}

async function loadYamlEntities(directory) {
  const files = await walk(directory, (file) => /\.ya?ml$/.test(file));
  const entities = [];
  for (const file of files) {
    const entity = parseYaml(await fs.readFile(file, 'utf8'));
    if (entity && typeof entity === 'object') entities.push({ ...entity, __file: relative(file) });
  }
  return entities;
}

function sourcePaths(entity) {
  if (!Array.isArray(entity.sources)) return [];
  return entity.sources
    .map((source) => (typeof source === 'string' ? source : source?.path))
    .filter((source) => typeof source === 'string' && !source.includes('://'));
}

function libraryEntityPrefix(source) {
  const match = /^packages\/prototypes\/([^/]+)\/src\//.exec(source);
  if (!match) return undefined;
  return `P-${match[1].toUpperCase().replace(/[^A-Z0-9]+/g, '-')}-`;
}

function referenceIds(references) {
  if (!Array.isArray(references)) return [];
  return references
    .map((reference) => (typeof reference === 'string' ? reference : reference?.id))
    .filter((reference) => typeof reference === 'string');
}

function normalizedDebt(records) {
  return records
    .map((record) => ({
      file: record.file,
      entries: [...record.entries]
        .map(({ kind, name }) => ({ kind, name }))
        .sort((a, b) => `${a.kind}:${a.name}`.localeCompare(`${b.kind}:${b.name}`)),
    }))
    .sort((a, b) => a.file.localeCompare(b.file));
}

function debtKey(record) {
  return `${record.file}|${record.entries.map(({ kind, name }) => `${kind}:${name}`).join(',')}`;
}

const libraryDirectories = (await fs.readdir(PROTOTYPES_ROOT, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(PROTOTYPES_ROOT, entry.name, 'src'));
const existingSourceDirectories = [];
for (const directory of libraryDirectories) {
  try {
    if ((await fs.stat(directory)).isDirectory()) existingSourceDirectories.push(directory);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

const sourceFiles = (
  await Promise.all(
    existingSourceDirectories.map((directory) =>
      walk(directory, (file) => SOURCE_EXTENSION.test(file) && !file.endsWith('.d.ts'))
    )
  )
).flat();
const inspections = await mapWithConcurrency(sourceFiles, 8, inspectSource);
const concreteFiles = inspections.filter((inspection) => inspection.concrete.length > 0);
const protoFiles = inspections.filter((inspection) => PROTO_SOURCE_EXTENSION.test(inspection.file));
const errors = [];

for (const inspection of concreteFiles) {
  if (!PROTO_SOURCE_EXTENSION.test(inspection.file)) {
    errors.push(`${inspection.file}: static protocol declarations must live in a *.proto.* file`);
  }
}
for (const inspection of inspections) {
  if (inspection.topLevelDynamicDeclarations > 0) {
    errors.push(
      `${inspection.file}: top-level protocol declarations require an inline static name; dynamic names are only valid inside factories`
    );
  }
}
for (const inspection of protoFiles) {
  if (inspection.concrete.length === 0) {
    errors.push(
      `${inspection.file}: *.proto.* file has no statically named definePrototype/defineAsHook`
    );
  }
}

const identityOwners = new Map();
for (const inspection of concreteFiles) {
  for (const entry of inspection.concrete) {
    const key = `${entry.kind}:${entry.name}`;
    const previous = identityOwners.get(key);
    if (previous)
      errors.push(`${inspection.file}: duplicate ${key}; first declared in ${previous}`);
    else identityOwners.set(key, inspection.file);
  }
}

const prototypeEntities = await loadYamlEntities(SPEC_PROTOTYPES_ROOT);
const testEntities = await loadYamlEntities(SPEC_TESTS_ROOT);
const testsById = new Map(testEntities.map((entity) => [entity.id, entity]));
const prototypesBySource = new Map();
for (const entity of prototypeEntities) {
  for (const source of sourcePaths(entity)) {
    const owners = prototypesBySource.get(source) ?? [];
    owners.push(entity);
    prototypesBySource.set(source, owners);
  }
}

const concreteByFile = new Map(concreteFiles.map((inspection) => [inspection.file, inspection]));
for (const entity of prototypeEntities) {
  for (const source of sourcePaths(entity).filter((candidate) =>
    PROTO_SOURCE_EXTENSION.test(candidate)
  )) {
    if (!concreteByFile.has(source)) {
      errors.push(`${entity.__file}: source ${source} is not a concrete protocol declaration file`);
    }
  }
}

const validatedPrototypeIds = new Set();
const uncovered = [];
for (const inspection of concreteFiles) {
  const expectedPrefix = libraryEntityPrefix(inspection.file);
  const owners = (prototypesBySource.get(inspection.file) ?? []).filter((entity) =>
    expectedPrefix ? entity.id?.startsWith(expectedPrefix) : true
  );
  if (owners.length === 0) {
    uncovered.push({ file: inspection.file, entries: inspection.concrete });
    continue;
  }
  for (const entity of owners) {
    if (validatedPrototypeIds.has(entity.id)) continue;
    validatedPrototypeIds.add(entity.id);
    const testIds = referenceIds(entity.verifies?.tests);
    if (testIds.length === 0) {
      errors.push(`${entity.__file}: cataloged prototype ${entity.id} must declare verifies.tests`);
      continue;
    }
    for (const testId of testIds) {
      const test = testsById.get(testId);
      if (!test) {
        errors.push(`${entity.__file}: verifies missing test entity ${testId}`);
        continue;
      }
      const exercised = referenceIds(test.exercises?.prototypes);
      if (!exercised.includes(entity.id)) {
        errors.push(`${test.__file}: ${testId} must exercise verified prototype ${entity.id}`);
      }
    }
  }
}

const debtDocument = JSON.parse(await fs.readFile(DEBT_PATH, 'utf8'));
if (debtDocument.schemaVersion !== 1 || !Array.isArray(debtDocument.uncataloged)) {
  errors.push(`${relative(DEBT_PATH)}: expected schemaVersion 1 and an uncataloged array`);
}
const actualDebt = normalizedDebt(uncovered);
const expectedDebt = normalizedDebt(debtDocument.uncataloged ?? []);
const actualDebtByKey = new Map(actualDebt.map((record) => [debtKey(record), record]));
const expectedDebtByKey = new Map(expectedDebt.map((record) => [debtKey(record), record]));
for (const [key, record] of actualDebtByKey) {
  if (!expectedDebtByKey.has(key)) {
    errors.push(`${record.file}: uncataloged protocol is not declared as existing debt (${key})`);
  }
}
for (const [key, record] of expectedDebtByKey) {
  if (!actualDebtByKey.has(key)) {
    errors.push(
      `${relative(DEBT_PATH)}: remove resolved or stale debt entry (${record.file}; ${key})`
    );
  }
}

const dynamicFiles = inspections.filter((inspection) => inspection.dynamicDeclarations > 0);
console.log(
  `[prototype-catalog] ${concreteFiles.length} declaration files, ${identityOwners.size} static authoring entries, ${validatedPrototypeIds.size} cataloged P entities, ${actualDebt.length} known debt files, ${dynamicFiles.length} dynamic factory files.`
);
if (errors.length > 0) {
  console.error(`\n[prototype-catalog] FAILED (${errors.length})`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log('[prototype-catalog] OK');
}
