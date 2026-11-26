import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { canonicalJson, compareCanonicalText } from './frontend/program.ts';
import { PROTO_TARGETS } from './frontend/types.ts';
import type { ProtoAnalysis, ProtoTarget } from './frontend/types.ts';

export type ManifestJson =
  | null
  | boolean
  | number
  | string
  | ManifestJson[]
  | { [key: string]: ManifestJson };
export type ManifestFileRole = 'entrypoint' | 'dependency' | 'configuration' | 'evidence';

export interface SourceRepository {
  id: string;
  name: string;
  /** A full Git object identity, never a moving branch or abbreviated revision. */
  revision: string;
}

export interface SourceFileReference {
  repositoryId: string;
  path: string;
  role: ManifestFileRole;
  /** Optional independently obtained Git blob identity. */
  gitBlob?: string;
}

export interface ManifestSourceFile extends SourceFileReference {
  sha256: string | null;
  byteLength: number | null;
}

export interface SourceEntrypoint {
  id: string;
  repositoryId: string;
  path: string;
  exportName: string;
}

export interface ReportedSourceCount {
  scope: string;
  unit: 'files' | 'prototype-files' | 'prototype-declarations' | 'families' | 'lines';
  count: number;
  source: string;
  revision?: string;
}

export interface SourceManifestConfiguration {
  languageVersion: string;
  ruleSetVersion: string;
  compilerVersion: string;
  requiredTargets: ProtoTarget[];
  /** Null means a shared frontend snapshot has not yet been bound. */
  frontendConfigurationHash: string | null;
  settings: { [key: string]: ManifestJson };
}

export interface SourceManifestRequest {
  consumerId: string;
  repositories: SourceRepository[];
  files: SourceFileReference[];
  /** Explicit registrations; .proto.ts filenames do not create component counts. */
  entrypoints: SourceEntrypoint[];
  configuration: SourceManifestConfiguration;
  sourceState: 'unmigrated' | 'migrated' | 'unknown';
  inventory: {
    complete: boolean;
    missing: string[];
    reportedCounts: ReportedSourceCount[];
  };
  provenance?: { [key: string]: ManifestJson };
}

export interface SourceManifest extends Omit<SourceManifestRequest, 'files'> {
  schemaVersion: 1;
  files: ManifestSourceFile[];
}

/**
 * A caller-selected exact snapshot. The reader must return original bytes and
 * must not run author code. Identity is supplied by the snapshot provider;
 * the verifier checks that identity and each byte digest, not GitHub access.
 */
export interface SourceSnapshot {
  repositoryId: string;
  revision: string;
  directory?: string;
  readFile(relativePath: string): Uint8Array | undefined;
  /** Current existence proof; '.' names the snapshot root. Undefined is unavailable. */
  probePath?(relativePath: string, kind: 'file' | 'directory'): boolean | undefined;
}

export interface ManifestIssue {
  code: string;
  kind: 'missing' | 'mismatch';
  message: string;
  repositoryId?: string;
  path?: string;
}

export interface ManifestFileVerification extends SourceFileReference {
  status: 'matched' | 'changed' | 'missing' | 'snapshot-missing' | 'revision-mismatch' | 'unbound';
  expectedSha256: string | null;
  actualSha256: string | null;
  actualByteLength: number | null;
}

export interface SourceManifestEvidence {
  inputDigest: string;
}

export interface ManifestResolutionProbeVerification {
  path: string;
  kind: 'file' | 'directory';
  repositoryId?: string;
  relativePath?: string;
  expectedExists: boolean;
  actualExists: boolean | null;
}

export interface SourceManifestVerification {
  schemaVersion: 1;
  status: 'matched' | 'mismatch' | 'incomplete';
  manifestDigest: string;
  configurationDigest: string;
  currentSourceDigest: string;
  inputDigest: string;
  files: ManifestFileVerification[];
  resolutionProbes: ManifestResolutionProbeVerification[];
  issues: ManifestIssue[];
  counts: {
    declaredFiles: number;
    declaredSourceFiles: number;
    declaredDependencyFiles: number;
    declaredConfigurationFiles: number;
    declaredEvidenceFiles: number;
    declaredEntrypoints: number;
    matchedSourceFiles: number;
    entrypointsWithMatchedSourceBytes: number;
    reported: ReportedSourceCount[];
  };
  sharedAnalysis: {
    provided: boolean;
    closureComplete: boolean;
    boundToManifest: boolean;
  };
  previousInputEvidenceMatches: boolean | null;
  priorInputEvidenceReusable: boolean;
  /** A source inventory is not a language or execution certificate. */
  sourceValid: null;
  compilationVerified: false;
  conformanceVerified: false;
}

export interface VerifySourceManifestOptions {
  snapshots: readonly SourceSnapshot[];
  configuration: SourceManifestConfiguration;
  /** Reuse the real frontend's closure. This module has no module resolver. */
  analysis?: ProtoAnalysis;
  previousEvidence?: SourceManifestEvidence;
}

const gitRevision = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const sha256Pattern = /^[0-9a-f]{64}$/;
const fileRoles = new Set(['entrypoint', 'dependency', 'configuration', 'evidence']);
const countUnits = new Set([
  'files',
  'prototype-files',
  'prototype-declarations',
  'families',
  'lines',
]);
const fileKey = (file: Pick<SourceFileReference, 'repositoryId' | 'path'>) =>
  `${file.repositoryId}\0${file.path}`;
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');

function object(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError(`${label} must be an object.`);
}

function text(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\0'))
    throw new TypeError(`${label} must be a nonempty string without NUL.`);
}

function list(value: unknown, label: string): asserts value is unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array.`);
}

function relativeSourcePath(value: unknown): asserts value is string {
  text(value, 'Source path');
  if (
    value.includes('\\') ||
    value.startsWith('/') ||
    /^[A-Za-z]:/.test(value) ||
    value.split('/').some((part) => !part || part === '.' || part === '..')
  ) {
    throw new TypeError(
      'Source paths must be normalized repository-relative paths without traversal.'
    );
  }
}

function jsonValue(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (typeof value !== 'object' || seen.has(value))
    throw new TypeError('Manifest metadata must contain finite, acyclic JSON values.');
  if (
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== Object.prototype &&
    Object.getPrototypeOf(value) !== null
  )
    throw new TypeError('Manifest metadata must use plain JSON objects.');
  seen.add(value);
  for (const item of Array.isArray(value) ? value : Object.values(value)) jsonValue(item, seen);
  seen.delete(value);
}

function configuration(value: unknown): asserts value is SourceManifestConfiguration {
  object(value, 'configuration');
  for (const field of ['languageVersion', 'ruleSetVersion', 'compilerVersion'])
    text(value[field], `configuration.${field}`);
  list(value.requiredTargets, 'requiredTargets');
  const targets = value.requiredTargets;
  if (
    targets.length !== PROTO_TARGETS.length ||
    new Set(targets).size !== PROTO_TARGETS.length ||
    !PROTO_TARGETS.every((target) => targets.includes(target))
  ) {
    throw new TypeError(
      'requiredTargets must retain React, GPUI, Vue 2, Vue 3 and Web Components exactly once.'
    );
  }
  if (
    value.frontendConfigurationHash !== null &&
    (typeof value.frontendConfigurationHash !== 'string' ||
      !sha256Pattern.test(value.frontendConfigurationHash))
  ) {
    throw new TypeError('frontendConfigurationHash must be a SHA-256 digest or null.');
  }
  object(value.settings, 'configuration.settings');
  jsonValue(value.settings);
}

/** Validate portable intake data without reading source or changing repositories. */
export function parseSourceManifest(value: unknown): SourceManifest {
  object(value, 'manifest');
  jsonValue(value);
  if (value.schemaVersion !== 1) throw new TypeError('Unsupported source manifest schemaVersion.');
  text(value.consumerId, 'consumerId');
  list(value.repositories, 'repositories');
  const repositories = new Set<string>();
  for (const repository of value.repositories) {
    object(repository, 'repository');
    text(repository.id, 'repository.id');
    text(repository.name, 'repository.name');
    if (!/^[A-Za-z0-9._-]+$/.test(repository.id) || repositories.has(repository.id))
      throw new TypeError('Repository IDs must be unique simple identifiers.');
    if (typeof repository.revision !== 'string' || !gitRevision.test(repository.revision))
      throw new TypeError('Every repository requires a full exact Git revision.');
    repositories.add(repository.id);
  }
  list(value.files, 'files');
  const files = new Map<string, Record<string, unknown>>();
  for (const file of value.files) {
    object(file, 'file');
    text(file.repositoryId, 'file.repositoryId');
    if (!repositories.has(file.repositoryId))
      throw new TypeError('File refers to an unregistered repository.');
    relativeSourcePath(file.path);
    if (typeof file.role !== 'string' || !fileRoles.has(file.role))
      throw new TypeError('Unknown source file role.');
    if (
      file.sha256 !== null &&
      (typeof file.sha256 !== 'string' || !sha256Pattern.test(file.sha256))
    )
      throw new TypeError('File sha256 must be a raw-byte SHA-256 digest or null.');
    if (
      file.byteLength !== null &&
      (!Number.isSafeInteger(file.byteLength) || (file.byteLength as number) < 0)
    )
      throw new TypeError('File byteLength must be a nonnegative safe integer or null.');
    if ((file.sha256 === null) !== (file.byteLength === null))
      throw new TypeError('Missing files must have both digest and byteLength null.');
    if (
      file.gitBlob !== undefined &&
      (typeof file.gitBlob !== 'string' || !gitRevision.test(file.gitBlob))
    )
      throw new TypeError('gitBlob must be a full Git object digest.');
    const key = fileKey(file as unknown as SourceFileReference);
    if (files.has(key)) throw new TypeError('Duplicate physical source file in manifest.');
    files.set(key, file);
  }
  list(value.entrypoints, 'entrypoints');
  const entryIds = new Set<string>();
  const entryBindings = new Set<string>();
  const entryFiles = new Set<string>();
  for (const entry of value.entrypoints) {
    object(entry, 'entrypoint');
    for (const field of ['id', 'repositoryId', 'exportName'])
      text(entry[field], `entrypoint.${field}`);
    relativeSourcePath(entry.path);
    const key = fileKey(entry as unknown as SourceEntrypoint);
    const binding = `${key}\0${entry.exportName}`;
    if (entryIds.has(entry.id as string) || entryBindings.has(binding))
      throw new TypeError('Duplicate component entrypoint identity.');
    if (files.get(key)?.role !== 'entrypoint')
      throw new TypeError(
        'Every entrypoint must reference an explicitly registered entrypoint file.'
      );
    entryIds.add(entry.id as string);
    entryBindings.add(binding);
    entryFiles.add(key);
  }
  for (const [key, file] of files)
    if (file.role === 'entrypoint' && !entryFiles.has(key))
      throw new TypeError('Entrypoint files require explicit component registrations.');
  configuration(value.configuration);
  if (!['unmigrated', 'migrated', 'unknown'].includes(value.sourceState as string))
    throw new TypeError('sourceState must distinguish migrated, unmigrated and unknown input.');
  object(value.inventory, 'inventory');
  if (typeof value.inventory.complete !== 'boolean')
    throw new TypeError('inventory.complete must be boolean.');
  list(value.inventory.missing, 'inventory.missing');
  value.inventory.missing.forEach((item) => text(item, 'inventory.missing item'));
  list(value.inventory.reportedCounts, 'inventory.reportedCounts');
  for (const count of value.inventory.reportedCounts) {
    object(count, 'reported count');
    text(count.scope, 'reported count scope');
    text(count.source, 'reported count source');
    if (
      !countUnits.has(count.unit as string) ||
      !Number.isSafeInteger(count.count) ||
      (count.count as number) < 0
    )
      throw new TypeError(
        'Reported counts require an explicit unit and a nonnegative safe integer.'
      );
    if (count.revision !== undefined) text(count.revision, 'reported count revision');
  }
  if (
    value.inventory.complete &&
    (value.inventory.missing.length ||
      value.entrypoints.length === 0 ||
      value.files.some((item) => (item as Record<string, unknown>).sha256 === null))
  ) {
    throw new TypeError('An incomplete or empty inventory cannot declare itself complete.');
  }
  if (value.provenance !== undefined) object(value.provenance, 'provenance');
  const result = JSON.parse(canonicalJson(value)) as SourceManifest;
  result.repositories.sort((a, b) => compareCanonicalText(a.id, b.id));
  result.files.sort((a, b) => compareCanonicalText(fileKey(a), fileKey(b)));
  result.entrypoints.sort((a, b) => compareCanonicalText(a.id, b.id));
  result.configuration.requiredTargets = [...PROTO_TARGETS];
  return result;
}

function snapshotMap(values: readonly SourceSnapshot[]): Map<string, SourceSnapshot> {
  const result = new Map<string, SourceSnapshot>();
  for (const snapshot of values) {
    if (
      !snapshot ||
      typeof snapshot.repositoryId !== 'string' ||
      !gitRevision.test(snapshot.revision) ||
      typeof snapshot.readFile !== 'function' ||
      result.has(snapshot.repositoryId)
    )
      throw new TypeError(
        'Snapshots require unique repository IDs, full revisions and byte readers.'
      );
    if (snapshot.directory !== undefined && !path.isAbsolute(snapshot.directory))
      throw new TypeError('Snapshot directory mappings must be absolute.');
    result.set(snapshot.repositoryId, snapshot);
  }
  return result;
}

function readSnapshot(snapshot: SourceSnapshot, filePath: string): Uint8Array | undefined {
  const bytes = snapshot.readFile(filePath);
  if (bytes !== undefined && !(bytes instanceof Uint8Array))
    throw new TypeError('Snapshot readers must return original bytes, not decoded text.');
  return bytes === undefined ? undefined : Uint8Array.from(bytes);
}

function gitBlob(bytes: Uint8Array, expected: string): string {
  return createHash(expected.length === 40 ? 'sha1' : 'sha256')
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest('hex');
}

/** A read-only directory reader; it never checks out, updates, imports or executes source. */
export function directorySourceSnapshot(input: {
  repositoryId: string;
  revision: string;
  directory: string;
}): SourceSnapshot {
  if (!gitRevision.test(input.revision))
    throw new TypeError('A directory snapshot requires a full selected revision.');
  const directory = realpathSync(input.directory);
  const containedPath = (filePath: string, allowRoot = false): string | undefined => {
    if (!allowRoot || filePath !== '.') relativeSourcePath(filePath);
    const candidate = path.resolve(directory, filePath);
    let actual: string;
    try {
      actual = realpathSync(candidate);
    } catch (error) {
      if (['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? ''))
        return undefined;
      throw error;
    }
    const relative = path.relative(directory, actual);
    if (relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative))
      throw new Error('Source path escapes the selected snapshot.');
    return actual;
  };
  return {
    repositoryId: input.repositoryId,
    revision: input.revision,
    directory,
    readFile(filePath) {
      const actual = containedPath(filePath);
      if (!actual || !statSync(actual).isFile()) return undefined;
      return readFileSync(actual);
    },
    probePath(filePath, kind) {
      if (kind !== 'file' && kind !== 'directory') throw new TypeError('Unknown probe kind.');
      const actual = containedPath(filePath, true);
      if (!actual) return false;
      const stat = statSync(actual);
      return kind === 'file' ? stat.isFile() : stat.isDirectory();
    },
  };
}

/** Bind explicitly supplied files to bytes; absent files stay in the denominator. */
export function createSourceManifest(
  request: SourceManifestRequest,
  options: { snapshots: readonly SourceSnapshot[] }
): SourceManifest {
  const candidate = parseSourceManifest({
    ...request,
    schemaVersion: 1,
    inventory: { ...request.inventory, complete: false },
    files: request.files.map((file) => ({ ...file, sha256: null, byteLength: null })),
  });
  const snapshots = snapshotMap(options.snapshots);
  const revisions = new Map(candidate.repositories.map((item) => [item.id, item.revision]));
  const absent = [...candidate.inventory.missing];
  for (const file of candidate.files) {
    const snapshot = snapshots.get(file.repositoryId);
    if (!snapshot || snapshot.revision !== revisions.get(file.repositoryId)) {
      absent.push(`Exact snapshot unavailable for ${file.repositoryId}:${file.path}.`);
      continue;
    }
    try {
      const bytes = readSnapshot(snapshot, file.path);
      if (!bytes) {
        absent.push(`Source unavailable: ${file.repositoryId}:${file.path}.`);
        continue;
      }
      if (file.gitBlob && gitBlob(bytes, file.gitBlob) !== file.gitBlob) {
        absent.push(`Git blob identity mismatch: ${file.repositoryId}:${file.path}.`);
        continue;
      }
      file.sha256 = hash(bytes);
      file.byteLength = bytes.byteLength;
    } catch (error) {
      absent.push(`Source unreadable: ${file.repositoryId}:${file.path}: ${String(error)}`);
    }
  }
  if (!candidate.entrypoints.length)
    absent.push('No component entrypoint registrations have been supplied.');
  candidate.inventory.missing = [...new Set(absent)];
  candidate.inventory.complete = request.inventory.complete && absent.length === 0;
  return parseSourceManifest(candidate);
}

export function sourceManifestDigest(manifest: SourceManifest): string {
  return hash(canonicalJson(parseSourceManifest(manifest)));
}

/** Verify the same declared input set; success here is only an input match. */
export function verifySourceManifest(
  input: SourceManifest,
  options: VerifySourceManifestOptions
): SourceManifestVerification {
  const manifest = parseSourceManifest(input);
  configuration(options.configuration);
  const actualConfiguration = { ...options.configuration, requiredTargets: [...PROTO_TARGETS] };
  const manifestDigest = sourceManifestDigest(manifest);
  const configurationDigest = hash(canonicalJson(actualConfiguration));
  const issues: ManifestIssue[] = [];
  const snapshots = snapshotMap(options.snapshots);
  const revisions = new Map(manifest.repositories.map((item) => [item.id, item.revision]));
  const add = (
    code: string,
    kind: ManifestIssue['kind'],
    message: string,
    file?: SourceFileReference
  ) =>
    issues.push({
      code,
      kind,
      message,
      ...(file ? { repositoryId: file.repositoryId, path: file.path } : {}),
    });
  if (configurationDigest !== hash(canonicalJson(manifest.configuration)))
    add(
      'CONFIGURATION_CHANGED',
      'mismatch',
      'Language, rule, compiler, target/binding or module-resolution configuration changed.'
    );
  for (const repository of manifest.repositories) {
    const snapshot = snapshots.get(repository.id);
    if (!snapshot)
      add(
        'SNAPSHOT_MISSING',
        'missing',
        `No exact snapshot was supplied for ${repository.id}@${repository.revision}.`
      );
    else if (snapshot.revision !== repository.revision)
      add(
        'REVISION_CHANGED',
        'mismatch',
        `Snapshot ${repository.id} is ${snapshot.revision}; the manifest binds ${repository.revision}.`
      );
  }
  const files: ManifestFileVerification[] = manifest.files.map((file) => {
    const result: ManifestFileVerification = {
      repositoryId: file.repositoryId,
      path: file.path,
      role: file.role,
      ...(file.gitBlob ? { gitBlob: file.gitBlob } : {}),
      status: 'missing',
      expectedSha256: file.sha256,
      actualSha256: null,
      actualByteLength: null,
    };
    const snapshot = snapshots.get(file.repositoryId);
    if (!snapshot) {
      result.status = 'snapshot-missing';
      return result;
    }
    if (snapshot.revision !== revisions.get(file.repositoryId)) {
      result.status = 'revision-mismatch';
      return result;
    }
    try {
      const bytes = readSnapshot(snapshot, file.path);
      if (!bytes) {
        add(
          'FILE_MISSING',
          'missing',
          'A declared file is absent; it remains in the denominator.',
          file
        );
        return result;
      }
      result.actualSha256 = hash(bytes);
      result.actualByteLength = bytes.byteLength;
      if (file.sha256 === null) {
        result.status = 'unbound';
        add(
          'FILE_DIGEST_UNBOUND',
          'missing',
          'Bytes are now present but the intake has no source-bound digest; regenerate the intake explicitly.',
          file
        );
      } else if (
        file.sha256 !== result.actualSha256 ||
        file.byteLength !== result.actualByteLength ||
        (file.gitBlob && gitBlob(bytes, file.gitBlob) !== file.gitBlob)
      ) {
        result.status = 'changed';
        add(
          'FILE_CHANGED',
          'mismatch',
          'Original bytes, byte length or Git blob identity no longer match.',
          file
        );
      } else result.status = 'matched';
    } catch (error) {
      add(
        'FILE_UNREADABLE',
        'missing',
        `Cannot read the selected snapshot bytes: ${String(error)}`,
        file
      );
    }
    return result;
  });
  if (!manifest.inventory.complete)
    add(
      'INVENTORY_INCOMPLETE',
      'missing',
      'The supplied inventory is explicitly partial; reported counts are not a source manifest.'
    );
  for (const reason of manifest.inventory.missing)
    add('INVENTORY_SCOPE_MISSING', 'missing', reason);

  const analysis = options.analysis;
  const resolutionProbes: ManifestResolutionProbeVerification[] = [];
  let analysisBound = false;
  if (!analysis)
    add(
      'SHARED_ANALYSIS_MISSING',
      'missing',
      'No shared frontend closure was supplied; this tool does not resolve dependencies itself.'
    );
  else {
    const before = issues.length;
    if (
      analysis.languageVersion !== actualConfiguration.languageVersion ||
      analysis.ruleSetVersion !== actualConfiguration.ruleSetVersion ||
      analysis.compilerVersion !== actualConfiguration.compilerVersion
    )
      add(
        'ANALYSIS_VERSION_CHANGED',
        'mismatch',
        'Shared analysis versions do not match the selected configuration.'
      );
    if (!actualConfiguration.frontendConfigurationHash)
      add(
        'FRONTEND_CONFIGURATION_UNBOUND',
        'missing',
        'No exact frontend configuration digest is bound.'
      );
    else if (
      analysis.sourceClosure.configurationHash !== actualConfiguration.frontendConfigurationHash
    )
      add(
        'FRONTEND_CONFIGURATION_CHANGED',
        'mismatch',
        'Shared frontend configuration differs from the intake.'
      );
    if (!analysis.sourceClosure.complete)
      add(
        'ANALYSIS_CLOSURE_INCOMPLETE',
        'missing',
        'Shared frontend reports an incomplete transitive source closure.'
      );
    const fileResults = new Map(files.map((file) => [fileKey(file), file]));
    const locate = (absolute: string): { repositoryId: string; path: string } | undefined => {
      const candidates = options.snapshots
        .filter((snapshot) => snapshot.directory)
        .flatMap((snapshot) => {
          const relative = path.relative(snapshot.directory!, absolute);
          return relative !== '..' &&
            !relative.startsWith(`..${path.sep}`) &&
            !path.isAbsolute(relative)
            ? [
                {
                  repositoryId: snapshot.repositoryId,
                  path: relative ? relative.split(path.sep).join('/') : '.',
                  length: snapshot.directory!.length,
                },
              ]
            : [];
        })
        .sort((a, b) => b.length - a.length);
      if (!candidates.length || (candidates[1] && candidates[0].length === candidates[1].length))
        return undefined;
      return candidates[0];
    };
    const reached = [
      ...analysis.sourceClosure.files.filter((file) => file.role !== 'prelude'),
      ...analysis.sourceClosure.resolutionFiles,
    ];
    for (const file of reached) {
      const reference = locate(file.path);
      const recorded = reference ? fileResults.get(fileKey(reference)) : undefined;
      if (!recorded)
        add(
          'DEPENDENCY_NOT_REGISTERED',
          'missing',
          `A reached source/configuration file is not mapped into this manifest: ${file.path}`
        );
      else if (
        recorded.status !== 'matched' ||
        recorded.actualSha256 !== file.sha256 ||
        recorded.actualByteLength !== file.byteLength
      )
        add(
          'ANALYSIS_SOURCE_CHANGED',
          'mismatch',
          'Shared analysis was produced from different or unavailable source bytes.',
          recorded
        );
    }
    if (!Array.isArray(analysis.sourceClosure.resolutionProbes))
      add(
        'ANALYSIS_RESOLUTION_PROBES_MISSING',
        'missing',
        'The shared closure has no module-resolution existence evidence; regenerate it through the shared frontend.'
      );
    else
      for (const probe of analysis.sourceClosure.resolutionProbes) {
        if (
          !probe ||
          typeof probe.path !== 'string' ||
          !path.isAbsolute(probe.path) ||
          (probe.kind !== 'file' && probe.kind !== 'directory') ||
          typeof probe.exists !== 'boolean'
        ) {
          add(
            'ANALYSIS_RESOLUTION_PROBE_INVALID',
            'missing',
            'A shared resolution probe lacks an absolute path, kind or existence result.'
          );
          continue;
        }
        const reference = locate(probe.path);
        const snapshot = reference ? snapshots.get(reference.repositoryId) : undefined;
        const observed: ManifestResolutionProbeVerification = {
          path: probe.path,
          kind: probe.kind,
          ...(reference
            ? { repositoryId: reference.repositoryId, relativePath: reference.path }
            : {}),
          expectedExists: probe.exists,
          actualExists: null,
        };
        resolutionProbes.push(observed);
        if (
          !reference ||
          !snapshot ||
          snapshot.revision !== revisions.get(reference.repositoryId)
        ) {
          add(
            'RESOLUTION_PROBE_UNMAPPED',
            'missing',
            `No exact snapshot mapping can verify the ${probe.kind} lookup: ${probe.path}`
          );
          continue;
        }
        if (!snapshot.probePath) {
          add(
            'RESOLUTION_PROBE_UNAVAILABLE',
            'missing',
            `The snapshot reader cannot verify ${probe.kind} existence: ${probe.path}`
          );
          continue;
        }
        try {
          const exists = snapshot.probePath(reference.path, probe.kind);
          if (typeof exists !== 'boolean') {
            add(
              'RESOLUTION_PROBE_UNAVAILABLE',
              'missing',
              `The snapshot reader supplied no ${probe.kind} existence proof: ${probe.path}`
            );
            continue;
          }
          observed.actualExists = exists;
          if (exists !== probe.exists)
            add(
              'RESOLUTION_PROBE_CHANGED',
              'mismatch',
              `The ${probe.kind} lookup changed from ${probe.exists ? 'present' : 'absent'} to ${exists ? 'present' : 'absent'}: ${probe.path}`
            );
        } catch (error) {
          add(
            'RESOLUTION_PROBE_UNAVAILABLE',
            'missing',
            `Cannot verify ${probe.kind} existence for ${probe.path}: ${String(error)}`
          );
        }
      }
    const roots = analysis.sourceClosure.rootNames.map(locate);
    const expectedRoots = new Set(manifest.entrypoints.map(fileKey));
    if (
      roots.some((root) => !root || !expectedRoots.has(fileKey(root))) ||
      expectedRoots.size !== new Set(roots.filter((root) => root !== undefined).map(fileKey)).size
    )
      add(
        'ANALYSIS_ENTRYPOINTS_CHANGED',
        'mismatch',
        'Shared frontend root files differ from the explicitly registered entrypoint files.'
      );
    analysisBound = issues.length === before;
  }
  const currentSourceDigest = hash(
    canonicalJson({
      revisions: manifest.repositories.map((repository) => ({
        repositoryId: repository.id,
        revision: snapshots.get(repository.id)?.revision ?? null,
      })),
      files: files.map((file) => ({
        repositoryId: file.repositoryId,
        path: file.path,
        role: file.role,
        status: file.status,
        sha256: file.actualSha256,
        byteLength: file.actualByteLength,
      })),
      resolutionProbes,
    })
  );
  const inputDigest = hash(
    canonicalJson({
      manifestDigest,
      configurationDigest,
      currentSourceDigest,
      sharedClosureDigest: analysis?.sourceClosure.digest ?? null,
    })
  );
  if (options.previousEvidence && !sha256Pattern.test(options.previousEvidence.inputDigest))
    throw new TypeError('Previous input evidence requires a SHA-256 inputDigest.');
  const previousInputEvidenceMatches = options.previousEvidence
    ? options.previousEvidence.inputDigest === inputDigest
    : null;
  const status = issues.some((issue) => issue.kind === 'mismatch')
    ? 'mismatch'
    : issues.length
      ? 'incomplete'
      : 'matched';
  const matched = new Set(files.filter((file) => file.status === 'matched').map(fileKey));
  return {
    schemaVersion: 1,
    status,
    manifestDigest,
    configurationDigest,
    currentSourceDigest,
    inputDigest,
    files,
    resolutionProbes,
    issues,
    counts: {
      declaredFiles: files.length,
      declaredSourceFiles: files.filter(
        (file) => file.role === 'entrypoint' || file.role === 'dependency'
      ).length,
      declaredDependencyFiles: files.filter((file) => file.role === 'dependency').length,
      declaredConfigurationFiles: files.filter((file) => file.role === 'configuration').length,
      declaredEvidenceFiles: files.filter((file) => file.role === 'evidence').length,
      declaredEntrypoints: manifest.entrypoints.length,
      matchedSourceFiles: files.filter(
        (file) =>
          (file.role === 'entrypoint' || file.role === 'dependency') && file.status === 'matched'
      ).length,
      entrypointsWithMatchedSourceBytes: manifest.entrypoints.filter((entry) =>
        matched.has(fileKey(entry))
      ).length,
      reported: manifest.inventory.reportedCounts,
    },
    sharedAnalysis: {
      provided: !!analysis,
      closureComplete: analysis?.sourceClosure.complete ?? false,
      boundToManifest: analysisBound,
    },
    previousInputEvidenceMatches,
    priorInputEvidenceReusable: status === 'matched' && previousInputEvidenceMatches === true,
    sourceValid: null,
    compilationVerified: false,
    conformanceVerified: false,
  };
}
