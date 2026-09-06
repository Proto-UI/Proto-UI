#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

import { findProtoPackages, getRoot, readVersion } from './version-utils.mjs';

const root = getRoot();
const version = readVersion(root);
const specDir = join(root, 'spec');
const governancePath = join(root, 'internal', 'governance', 'launch-package-governance.json');
const violations = [];

const packages = findProtoPackages(root);
for (const pkg of packages) {
  if (pkg.manifest.version !== version.raw) {
    violations.push(
      `${pkg.manifest.name} is ${pkg.manifest.version ?? '<missing>'}; expected ${version.raw}`
    );
  }
}

const documents = existsSync(specDir) ? loadYamlDocuments(specDir) : [];
const versionEntities = documents
  .filter(({ value }) => value?.type === 'version')
  .map(({ filePath, value }) => ({ filePath, value }));
const declaredVersions = new Set();
const versionEntityCounts = new Map();

for (const { filePath, value } of versionEntities) {
  const releaseVersion = value.release?.version;
  if (!releaseVersion) {
    violations.push(`${filePath}: version entity is missing release.version`);
    continue;
  }
  declaredVersions.add(releaseVersion);
  versionEntityCounts.set(releaseVersion, (versionEntityCounts.get(releaseVersion) ?? 0) + 1);

  if (value.since !== releaseVersion) {
    violations.push(`${filePath}: since must equal release.version ${releaseVersion}`);
  }
  if (value.release.gitTag !== `v${releaseVersion}`) {
    violations.push(`${filePath}: gitTag must be v${releaseVersion}`);
  }
  if (value.release.packageVersionPolicy !== 'exact') {
    violations.push(`${filePath}: packageVersionPolicy must be exact`);
  }
  if (value.release.packageScope !== 'public-@proto.ui') {
    violations.push(`${filePath}: packageScope must be public-@proto.ui`);
  }
  if (!['draft', 'active'].includes(value.status)) {
    violations.push(`${filePath}: version entity status must be draft or active`);
  }
  const expectedChannel = releaseVersion.includes('-') ? 'prerelease' : 'stable';
  if (value.release.channel !== expectedChannel) {
    violations.push(`${filePath}: channel must be ${expectedChannel}`);
  }
  const expectedDistTag = releaseVersion.includes('-') ? 'next' : 'latest';
  if (value.release.npmDistTag !== expectedDistTag) {
    violations.push(`${filePath}: npmDistTag must be ${expectedDistTag}`);
  }
  if (value.status === 'active') {
    if (!value.release.publishedAt)
      violations.push(`${filePath}: active release needs publishedAt`);
    if (!/^[0-9a-f]{40}$/.test(value.release.commit ?? '')) {
      violations.push(`${filePath}: active release needs a 40-character commit`);
    }
    if (!/^sha256:[0-9a-f]{64}$/.test(value.release.specSnapshotDigest ?? '')) {
      violations.push(`${filePath}: active release needs a sha256 specSnapshotDigest`);
    }
  }
}

for (const [releaseVersion, count] of versionEntityCounts) {
  if (count > 1)
    violations.push(`release version ${releaseVersion} is declared by ${count} V entities`);
}

const currentReleaseEntities = versionEntities.filter(
  ({ value }) => value.release?.version === version.raw
);
if (currentReleaseEntities.length !== 1) {
  violations.push(
    `VERSION ${version.raw} must have exactly one V entity; found ${currentReleaseEntities.length}`
  );
}

for (const { filePath, value } of documents) {
  for (const reference of collectVersionReferences(value)) {
    if (isLegacyAuthoringVersion(reference.version)) continue;
    if (!declaredVersions.has(reference.version)) {
      violations.push(
        `${filePath}: ${reference.path} uses undeclared release version ${reference.version}`
      );
    }
  }
}

if (existsSync(governancePath)) {
  const governance = JSON.parse(readFileSync(governancePath, 'utf8'));
  if (governance.releaseLine !== `v${version.raw}`) {
    violations.push(
      `${governancePath}: releaseLine ${governance.releaseLine ?? '<missing>'} must be v${version.raw}`
    );
  }
}

if (violations.length > 0) {
  console.error(`check-version-governance: ${violations.length} violation(s)`);
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(
  `check-version-governance: ${version.raw}, ${packages.length} public packages, ${versionEntities.length} V entity`
);

function loadYamlDocuments(dir) {
  const documents = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const filePath = join(dir, entry.name);
    if (entry.isDirectory()) documents.push(...loadYamlDocuments(filePath));
    else if (entry.isFile() && /\.ya?ml$/i.test(entry.name)) {
      documents.push({ filePath, value: parse(readFileSync(filePath, 'utf8')) });
    }
  }
  return documents;
}

function collectVersionReferences(value, path = [], references = []) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectVersionReferences(entry, [...path, index], references));
    return references;
  }
  if (!value || typeof value !== 'object') return references;

  for (const [key, entry] of Object.entries(value)) {
    const nextPath = [...path, key];
    if (
      typeof entry === 'string' &&
      ['since', 'until', 'activeSince', 'deprecatedSince', 'removedSince', 'version'].includes(
        key
      ) &&
      /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(entry)
    ) {
      references.push({ path: nextPath.join('.'), version: entry });
    } else {
      collectVersionReferences(entry, nextPath, references);
    }
  }
  return references;
}

function isLegacyAuthoringVersion(value) {
  const match = /^(\d+)\.(\d+)\./.exec(value);
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return major === 0 && minor < 2;
}
