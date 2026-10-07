import { createHash, timingSafeEqual } from 'node:crypto';
import { lstat, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import {
  isLocalSourceSpecifier,
  localSourceBase,
  localSourceCandidates,
  sourceEdges,
} from './source-resolution';
import type { TargetDependency, TargetHelper } from './targets';

export interface ConsumerTarballExpectation {
  /** Absolute, or relative to the consumer root (a sibling release directory is allowed). */
  readonly path: string;
  readonly integrity?: string;
  /** Exact installed version for a transitive package not in profile.dependencies. */
  readonly version?: string;
}
export interface ConsumerClosureExpectation {
  readonly profile: string;
  readonly dependencies: readonly TargetDependency[];
  readonly helpers?: readonly TargetHelper[];
  /** Entry files on disk; relative imports/re-exports are followed statically. */
  readonly generatedFiles: readonly string[];
  /** The compiler's on-disk provenance.json, relative to root. */
  readonly provenanceFile: string;
  readonly tarballs?: Readonly<Record<string, ConsumerTarballExpectation>>;
  /** Defaults to ['@proto.ui/']; reached internal transitives require bridge/runtime roots. */
  readonly internalPackagePrefixes?: readonly string[];
}
export type ConsumerClosureFailureCode =
  | 'invalid-expectation'
  | 'io-error'
  | 'invalid-manifest'
  | 'unsupported-lockfile'
  | 'profile-mismatch'
  | 'declaration-mismatch'
  | 'missing-package'
  | 'version-mismatch'
  | 'unsafe-path'
  | 'workspace-package'
  | 'lock-mismatch'
  | 'tarball-path-mismatch'
  | 'integrity-mismatch'
  | 'undeclared-import'
  | 'dynamic-import'
  | 'invalid-source'
  | 'missing-helper'
  | 'undeclared-package';
export interface ConsumerClosureFailure {
  readonly code: ConsumerClosureFailureCode;
  readonly message: string;
  readonly path?: string;
  readonly package?: string;
}
export interface ConsumerImportFact {
  readonly file: string;
  readonly specifier: string;
  readonly typeOnly: boolean;
  readonly package?: string;
}
export interface InstalledConsumerPackage {
  readonly name: string;
  readonly version: string;
  readonly path: string;
  readonly realPath: string;
  readonly manifestPath: string;
  readonly lockPath: string;
  readonly resolved?: string;
  /** Recorded by the lockfile; only verified against bytes when a tarball is provided. */
  readonly integrity?: string;
  readonly optional: boolean;
  readonly os: readonly string[];
  readonly cpu: readonly string[];
  readonly roles: readonly TargetDependency['role'][];
  readonly declared: boolean;
  readonly requiredBy: readonly string[];
  readonly tarball?: { readonly path: string; readonly integrity: string };
}
export interface LockOnlyConsumerPackage {
  readonly name: string;
  readonly path: string;
  readonly version?: string;
  readonly optional: boolean;
  readonly dev: boolean;
  readonly os: readonly string[];
  readonly cpu: readonly string[];
}
export type ConsumerHelperFact =
  | {
      readonly name: string;
      readonly version: string;
      readonly classification: TargetHelper['classification'];
      readonly delivery: 'dependency';
      readonly packages: readonly InstalledConsumerPackage[];
    }
  | {
      readonly name: string;
      readonly version: string;
      readonly classification: TargetHelper['classification'];
      readonly delivery: 'inline';
      readonly declarations: readonly {
        file: string;
        start: number;
        end: number;
        utf8Bytes: number;
      }[];
    };
export interface ConsumerClosureFacts {
  readonly root: string;
  readonly profile: string;
  readonly lockfile: { readonly path: string; readonly version: 2 | 3 };
  /** Only the installed graph reachable from declared output dependencies. */
  readonly internal: readonly InstalledConsumerPackage[];
  readonly external: readonly InstalledConsumerPackage[];
  readonly helpers: readonly ConsumerHelperFact[];
  readonly imports: readonly ConsumerImportFact[];
  /** These are not installed cost; optional/platform/dev lock records may legitimately be absent. */
  readonly lockOnly: readonly LockOnlyConsumerPackage[];
}
export type ConsumerClosureResult =
  | { readonly ok: true; readonly value: ConsumerClosureFacts }
  | { readonly ok: false; readonly failures: readonly ConsumerClosureFailure[] };

type JsonObject = Record<string, unknown>;
interface PackageRecord {
  fact: InstalledConsumerPackage;
  manifest: JsonObject;
}
class ClosureRejection extends Error {
  constructor(readonly failure: ConsumerClosureFailure) {
    super(failure.message);
  }
}
function fail(
  code: ConsumerClosureFailureCode,
  message: string,
  details: { path?: string; package?: string } = {}
): never {
  throw new ClosureRejection({ code, message, ...details });
}
function object(value: unknown, filename: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail('invalid-manifest', 'Expected a JSON object.', { path: filename });
  return value as JsonObject;
}
function within(root: string, filename: string): boolean {
  const relative = path.relative(root, filename);
  return (
    relative === '' ||
    (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`))
  );
}
function packageName(name: string): boolean {
  return /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i.test(name);
}
function exactVersion(version: string): boolean {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version);
}
function platformConstraints(value: unknown, filename: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string'))
    fail('invalid-manifest', 'Platform constraints must be arrays of strings.', { path: filename });
  return value;
}
function dependencies(
  manifest: JsonObject,
  field: string,
  filename: string
): Record<string, string> {
  const value = manifest[field];
  if (value === undefined) return {};
  const entries = object(value, filename);
  for (const [name, specifier] of Object.entries(entries)) {
    if (!packageName(name) || typeof specifier !== 'string' || !specifier)
      fail('invalid-manifest', `Invalid ${field} entry ${JSON.stringify(name)}.`, {
        path: filename,
      });
  }
  return entries as Record<string, string>;
}
function sameEntries(left: Record<string, string>, right: Record<string, string>): boolean {
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => left[key] === right[key]);
}
async function json(filename: string): Promise<JsonObject> {
  const source = await readFile(filename, 'utf8');
  try {
    return object(JSON.parse(source), filename);
  } catch (error) {
    if (error instanceof ClosureRejection) throw error;
    fail('invalid-manifest', 'Invalid JSON.', { path: filename });
  }
}
async function exists(filename: string): Promise<boolean> {
  try {
    await lstat(filename);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}
function localFileResolution(specifier: string, root: string): string | undefined {
  if (!specifier.startsWith('file:')) return undefined;
  try {
    return specifier.startsWith('file://')
      ? fileURLToPath(specifier)
      : path.resolve(root, decodeURIComponent(specifier.slice(5)));
  } catch {
    fail('unsafe-path', 'Invalid file resolution.', { path: specifier });
  }
}
function verifyIntegrity(bytes: Buffer, integrity: string, filename: string): void {
  // SRI uses the strongest supported algorithm, not any weaker matching token.
  const algorithms = ['sha512', 'sha384', 'sha256', 'sha1'] as const;
  const tokens = integrity
    .trim()
    .split(/\s+/)
    .map((token) => /^([a-z0-9]+)-([A-Za-z0-9+/]+={0,2})(?:\?.*)?$/.exec(token));
  if (tokens.some((token) => !token))
    fail('integrity-mismatch', 'Malformed tarball integrity.', { path: filename });
  const algorithm = algorithms.find((candidate) =>
    tokens.some((token) => token?.[1] === candidate)
  );
  if (!algorithm)
    fail('integrity-mismatch', 'Tarball integrity has no supported digest algorithm.', {
      path: filename,
    });
  const digest = createHash(algorithm).update(bytes).digest();
  const matches = tokens.some((token) => {
    if (!token || token[1] !== algorithm) return false;
    const expected = Buffer.from(token[2], 'base64');
    return expected.length === digest.length && timingSafeEqual(expected, digest);
  });
  if (!matches)
    fail('integrity-mismatch', `Tarball bytes do not match ${algorithm} integrity.`, {
      path: filename,
    });
}

/**
 * Offline evidence from an already installed npm consumer (package-lock v2/v3).
 * Reads source through TypeScript, never imports it, installs packages, or fetches URLs.
 * Tarball digests attest the supplied archive, not equivalence of every extracted file.
 */
export async function verifyConsumerClosure(
  root: string,
  expected: ConsumerClosureExpectation
): Promise<ConsumerClosureResult> {
  try {
    const rootPath = await realpath(root);
    const checkedFile = async (relative: string): Promise<string> => {
      if (
        !relative ||
        path.isAbsolute(relative) ||
        relative.includes('\\') ||
        /^[A-Za-z]:/.test(relative) ||
        relative.includes('\0')
      )
        fail('unsafe-path', 'Consumer evidence paths must be root-relative.', { path: relative });
      const absolute = path.resolve(rootPath, relative);
      if (!within(rootPath, absolute))
        fail('unsafe-path', 'Consumer evidence path escapes its root.', { path: relative });
      const canonical = await realpath(absolute);
      if (!within(rootPath, canonical))
        fail('unsafe-path', 'Consumer evidence symlink escapes its root.', { path: relative });
      if (!(await stat(canonical)).isFile())
        fail('unsafe-path', 'Consumer evidence must be a regular file.', { path: relative });
      return canonical;
    };
    if (!expected.profile || !expected.generatedFiles.length)
      fail(
        'invalid-expectation',
        'A profile and at least one generated source entry are required.'
      );
    const declared = new Map<string, TargetDependency>();
    for (const dependency of expected.dependencies) {
      if (
        !packageName(dependency.name) ||
        !exactVersion(dependency.version) ||
        !['target', 'host-bridge', 'semantic-runtime'].includes(dependency.role) ||
        declared.has(dependency.name)
      )
        fail(
          'invalid-expectation',
          'Expected dependencies must have unique package names, exact versions and dependency roles.',
          { package: dependency.name }
        );
      declared.set(dependency.name, dependency);
    }
    const helpers = expected.helpers ?? [];
    const helperNames = new Set<string>();
    for (const helper of helpers) {
      if (
        !helper.name ||
        !helper.version ||
        helperNames.has(helper.name) ||
        !['dependency', 'inline'].includes(helper.delivery) ||
        !['semantic-runtime', 'host-bridge', 'native-lowering'].includes(helper.classification)
      )
        fail(
          'invalid-expectation',
          'Expected helpers must have unique names, versions, classifications and delivery modes.'
        );
      helperNames.add(helper.name);
      if (helper.delivery === 'dependency' && declared.get(helper.name)?.version !== helper.version)
        fail(
          'invalid-expectation',
          'A dependency helper must also be an exact declared dependency.',
          { package: helper.name }
        );
    }
    for (const [name, tarball] of Object.entries(expected.tarballs ?? {}))
      if (
        !packageName(name) ||
        !tarball.path ||
        (tarball.version !== undefined && !exactVersion(tarball.version))
      )
        fail(
          'invalid-expectation',
          'Tarball expectations require a package name, path and an exact version when specified.',
          { package: name }
        );

    const provenancePath = await checkedFile(expected.provenanceFile);
    const provenance = await json(provenancePath);
    if (
      provenance.profile !== expected.profile ||
      (provenance.backend !== undefined && provenance.backend !== expected.profile)
    )
      fail('profile-mismatch', `On-disk output does not select profile ${expected.profile}.`, {
        path: provenancePath,
      });
    if (!Array.isArray(provenance.dependencies))
      fail('declaration-mismatch', 'Output provenance has no dependency declarations.', {
        path: provenancePath,
      });
    const emitted = new Map<string, TargetDependency>();
    for (const value of provenance.dependencies) {
      const dependency = object(value, provenancePath);
      const anticipated = declared.get(dependency.name as string);
      if (
        !anticipated ||
        dependency.version !== anticipated.version ||
        dependency.role !== anticipated.role ||
        emitted.has(anticipated.name)
      )
        fail(
          'declaration-mismatch',
          'On-disk output dependency declarations differ from the selected profile.',
          { path: provenancePath, package: String(dependency.name) }
        );
      emitted.set(anticipated.name, anticipated);
    }
    if (emitted.size !== declared.size)
      fail('declaration-mismatch', 'On-disk output omits declared profile dependencies.', {
        path: provenancePath,
      });
    if (provenance.helpers !== undefined) {
      if (!Array.isArray(provenance.helpers) || provenance.helpers.length !== helpers.length)
        fail(
          'declaration-mismatch',
          'On-disk helper declarations differ from the selected profile.',
          { path: provenancePath }
        );
      const seen = new Set<string>();
      for (const value of provenance.helpers) {
        const actual = object(value, provenancePath);
        const anticipated = helpers.find((helper) => helper.name === actual.name);
        if (
          !anticipated ||
          seen.has(anticipated.name) ||
          actual.version !== anticipated.version ||
          actual.classification !== anticipated.classification ||
          actual.delivery !== anticipated.delivery
        )
          fail(
            'declaration-mismatch',
            'On-disk helper declarations differ from the selected profile.',
            { path: provenancePath }
          );
        seen.add(anticipated.name);
      }
    }

    const manifestPath = await checkedFile('package.json');
    const manifest = await json(manifestPath);
    if (!(await exists(path.join(rootPath, 'package-lock.json'))))
      fail(
        'unsupported-lockfile',
        'Installed consumer verification requires npm package-lock.json v2 or v3.'
      );
    const lockPath = await checkedFile('package-lock.json');
    const lockfile = await json(lockPath);
    if (lockfile.lockfileVersion !== 2 && lockfile.lockfileVersion !== 3)
      fail(
        'unsupported-lockfile',
        'Installed consumer verification requires npm package-lock.json v2 or v3.',
        { path: lockPath }
      );
    const locks = object(lockfile.packages, lockPath);
    const rootLock = object(locks[''], lockPath);
    const dependencyFields = [
      'dependencies',
      'optionalDependencies',
      'peerDependencies',
      'devDependencies',
    ] as const;
    for (const field of dependencyFields)
      if (
        !sameEntries(
          dependencies(manifest, field, manifestPath),
          dependencies(rootLock, field, lockPath)
        )
      )
        fail('lock-mismatch', `Consumer ${field} differ from the lockfile root.`, {
          path: lockPath,
        });
    const rootDependencies = {
      ...dependencies(manifest, 'devDependencies', manifestPath),
      ...dependencies(manifest, 'peerDependencies', manifestPath),
      ...dependencies(manifest, 'optionalDependencies', manifestPath),
      ...dependencies(manifest, 'dependencies', manifestPath),
    };
    for (const dependency of declared.values()) {
      const specifier = rootDependencies[dependency.name];
      if (!specifier)
        fail('missing-package', 'Declared output dependency is not declared by the consumer.', {
          package: dependency.name,
        });
      if (specifier.startsWith('workspace:') || specifier.startsWith('link:'))
        fail(
          'workspace-package',
          'Consumer output dependencies cannot resolve through a workspace.',
          { package: dependency.name }
        );
      if (exactVersion(specifier) && specifier !== dependency.version)
        fail('version-mismatch', 'Consumer declares a different exact dependency version.', {
          package: dependency.name,
        });
    }

    const installed = new Map<string, PackageRecord>();
    const nodeModules = path.join(rootPath, 'node_modules');
    const loadPackage = async (directory: string, name: string): Promise<PackageRecord> => {
      if (!packageName(name))
        fail('invalid-manifest', 'Invalid installed package directory.', { path: directory });
      const canonical = await realpath(directory);
      if (!within(nodeModules, canonical))
        fail('unsafe-path', 'Installed package is a workspace/escaping symlink.', {
          path: directory,
          package: name,
        });
      const key = path.relative(rootPath, directory).split(path.sep).join('/');
      const cached = installed.get(key);
      if (cached) return cached;
      const packageManifestPath = path.join(directory, 'package.json');
      const canonicalManifest = await realpath(packageManifestPath);
      if (!within(canonical, canonicalManifest))
        fail('unsafe-path', 'Installed package manifest escapes its package.', {
          path: packageManifestPath,
          package: name,
        });
      const packageManifest = await json(packageManifestPath);
      if (
        packageManifest.name !== name ||
        typeof packageManifest.version !== 'string' ||
        !exactVersion(packageManifest.version)
      )
        fail(
          'invalid-manifest',
          'Installed package name/version does not match its package directory.',
          { path: packageManifestPath, package: name }
        );
      if (!Object.hasOwn(locks, key))
        fail('lock-mismatch', 'Installed package has no lock resolution.', {
          path: directory,
          package: name,
        });
      const locked = object(locks[key], lockPath);
      if (
        locked.link === true ||
        (typeof locked.resolved === 'string' && /^(workspace:|link:)/.test(locked.resolved))
      )
        fail('workspace-package', 'Installed package is linked to a workspace.', {
          path: directory,
          package: name,
        });
      if (
        locked.version !== packageManifest.version ||
        (locked.name !== undefined && locked.name !== name)
      )
        fail('lock-mismatch', 'Installed package name/version differs from its lock resolution.', {
          path: directory,
          package: name,
        });
      // npm locks published dependency edges, not package development dependencies.
      for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies'])
        if (
          !sameEntries(
            dependencies(packageManifest, field, packageManifestPath),
            dependencies(locked, field, lockPath)
          )
        )
          fail('lock-mismatch', `Installed package ${field} differ from its lock resolution.`, {
            path: directory,
            package: name,
          });
      const manifestPeerMeta =
        packageManifest.peerDependenciesMeta === undefined
          ? {}
          : object(packageManifest.peerDependenciesMeta, packageManifestPath);
      const lockPeerMeta =
        locked.peerDependenciesMeta === undefined
          ? {}
          : object(locked.peerDependenciesMeta, lockPath);
      const peerNames = new Set([...Object.keys(manifestPeerMeta), ...Object.keys(lockPeerMeta)]);
      for (const peer of peerNames) {
        const manifestOptional =
          manifestPeerMeta[peer] !== undefined &&
          object(manifestPeerMeta[peer], packageManifestPath).optional === true;
        const lockOptional =
          lockPeerMeta[peer] !== undefined &&
          object(lockPeerMeta[peer], lockPath).optional === true;
        if (manifestOptional !== lockOptional)
          fail(
            'lock-mismatch',
            'Installed optional peer metadata differ from the lock resolution.',
            { path: directory, package: name }
          );
      }
      const resolved = typeof locked.resolved === 'string' ? locked.resolved : undefined;
      const localResolution = resolved && localFileResolution(resolved, rootPath);
      if (localResolution && !(await stat(localResolution)).isFile())
        fail(
          'workspace-package',
          'Local package resolutions must be packed files, not workspace directories.',
          { path: directory, package: name }
        );
      const os = platformConstraints(packageManifest.os, packageManifestPath);
      const cpu = platformConstraints(packageManifest.cpu, packageManifestPath);
      for (const [field, constraint] of [
        ['os', os],
        ['cpu', cpu],
      ] as const) {
        const lockedConstraint = platformConstraints(locked[field], lockPath);
        if (
          constraint.length !== lockedConstraint.length ||
          constraint.some((entry) => !lockedConstraint.includes(entry))
        )
          fail(
            'lock-mismatch',
            `Installed package ${field} constraints differ from its lock resolution.`,
            { path: directory, package: name }
          );
      }
      const fact: InstalledConsumerPackage = {
        name,
        version: packageManifest.version,
        path: directory,
        realPath: canonical,
        manifestPath: canonicalManifest,
        lockPath: key,
        resolved,
        integrity: typeof locked.integrity === 'string' ? locked.integrity : undefined,
        optional: locked.optional === true,
        os,
        cpu,
        roles: [],
        declared: false,
        requiredBy: [],
      };
      const record = { fact, manifest: packageManifest };
      installed.set(key, record);
      return record;
    };

    const resolveInstalled = async (
      name: string,
      importer: string
    ): Promise<PackageRecord | undefined> => {
      let directory = importer;
      while (within(rootPath, directory)) {
        if (path.basename(directory) !== 'node_modules') {
          const absolute = path.join(directory, 'node_modules', name);
          if (await exists(absolute)) return loadPackage(absolute, name);
        }
        if (directory === rootPath) break;
        directory = path.dirname(directory);
      }
      return undefined;
    };
    const reached = new Map<string, PackageRecord>();
    const queue: { record: PackageRecord; role: TargetDependency['role']; by: string }[] = [];
    for (const dependency of declared.values()) {
      const record = await resolveInstalled(dependency.name, rootPath);
      if (!record)
        fail('missing-package', 'Declared output dependency is absent from node_modules.', {
          package: dependency.name,
        });
      if (record.fact.version !== dependency.version)
        fail(
          'version-mismatch',
          `Expected ${dependency.version}, installed ${record.fact.version}.`,
          { path: record.fact.path, package: dependency.name }
        );
      record.fact = { ...record.fact, declared: true };
      queue.push({ record, role: dependency.role, by: '<generated-output>' });
    }
    const imports: ConsumerImportFact[] = [];
    const declarations = new Map<
      string,
      { file: string; start: number; end: number; utf8Bytes: number }[]
    >();
    const sources = [...expected.generatedFiles];
    const scanned = new Set<string>();
    for (let index = 0; index < sources.length; index++) {
      const filename = await checkedFile(sources[index]);
      const canonical = await realpath(filename);
      if (within(nodeModules, canonical))
        fail('unsafe-path', 'Generated source entries cannot be installed package files.', {
          path: filename,
        });
      if (scanned.has(canonical)) continue;
      scanned.add(canonical);
      const source = await readFile(filename, 'utf8');
      if (
        index === 0 &&
        provenance.generatedSha256 !== undefined &&
        provenance.generatedSha256 !== createHash('sha256').update(source).digest('hex')
      )
        fail('integrity-mismatch', 'Generated entry bytes differ from compiler provenance.', {
          path: filename,
        });
      const relative = path.relative(rootPath, filename).split(path.sep).join('/');
      const file = ts.createSourceFile(relative, source, ts.ScriptTarget.Latest, true);
      const syntax = (file as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] })
        .parseDiagnostics;
      if (syntax.length)
        fail('invalid-source', ts.flattenDiagnosticMessageText(syntax[0].messageText, '\n'), {
          path: filename,
        });
      const edges: { specifier: string; typeOnly: boolean }[] = sourceEdges(file).map((edge) => ({
        specifier: edge.specifier,
        typeOnly: edge.typeOnly,
      }));
      const literal = (node: ts.Node | undefined): string | undefined =>
        node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
          ? node.text
          : undefined;
      const visit = (node: ts.Node): void => {
        const expression = ts.isCallExpression(node) ? node.expression : undefined;
        const moduleRequire =
          expression &&
          ((ts.isPropertyAccessExpression(expression) &&
            expression.name.text === 'require' &&
            ts.isIdentifier(expression.expression) &&
            (expression.expression.text === 'module' ||
              expression.expression.text === 'globalThis')) ||
            (ts.isElementAccessExpression(expression) &&
              literal(expression.argumentExpression) === 'require' &&
              ts.isIdentifier(expression.expression) &&
              (expression.expression.text === 'module' ||
                expression.expression.text === 'globalThis')));
        if (
          ts.isCallExpression(node) &&
          (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
            (ts.isIdentifier(node.expression) && node.expression.text === 'require') ||
            moduleRequire)
        ) {
          const specifier = literal(node.arguments[0]);
          if (specifier === undefined)
            fail('dynamic-import', 'Generated imports require a static string specifier.', {
              path: filename,
            });
          edges.push({ specifier, typeOnly: false });
        } else if (
          ts.isImportEqualsDeclaration(node) &&
          ts.isExternalModuleReference(node.moduleReference)
        ) {
          const specifier = literal(node.moduleReference.expression);
          if (specifier === undefined)
            fail('dynamic-import', 'Generated import-equals must have a static specifier.', {
              path: filename,
            });
          edges.push({ specifier, typeOnly: node.isTypeOnly });
        } else if (ts.isImportTypeNode(node)) {
          const specifier = ts.isLiteralTypeNode(node.argument)
            ? literal(node.argument.literal)
            : undefined;
          if (specifier === undefined)
            fail('dynamic-import', 'Generated import types must have a static specifier.', {
              path: filename,
            });
          edges.push({ specifier, typeOnly: true });
        }
        if (
          (ts.isFunctionDeclaration(node) ||
            ts.isVariableDeclaration(node) ||
            ts.isClassDeclaration(node)) &&
          node.name &&
          ts.isIdentifier(node.name)
        ) {
          const start = node.getStart(file);
          const evidence = {
            file: relative,
            start,
            end: node.end,
            utf8Bytes: Buffer.byteLength(source.slice(start, node.end)),
          };
          declarations.set(node.name.text, [...(declarations.get(node.name.text) ?? []), evidence]);
        }
        ts.forEachChild(node, visit);
      };
      visit(file);
      for (const edge of edges) {
        if (isLocalSourceSpecifier(edge.specifier)) {
          let base: string;
          try {
            base = localSourceBase(relative, edge.specifier);
          } catch {
            fail('unsafe-path', 'Generated relative import escapes the consumer.', {
              path: relative,
            });
          }
          const extensionBase = base.replace(/\.(?:mjs|cjs|js|jsx)$/, '');
          const candidates = [
            ...new Set([
              ...localSourceCandidates(base),
              `${base}.tsx`,
              `${base}.js`,
              `${base}.jsx`,
              `${base}.mjs`,
              `${base}.cjs`,
              `${base}.mts`,
              `${base}.cts`,
              `${base}/index.tsx`,
              `${base}/index.js`,
              ...(extensionBase !== base
                ? [
                    `${extensionBase}.ts`,
                    `${extensionBase}.tsx`,
                    `${extensionBase}.mts`,
                    `${extensionBase}.cts`,
                  ]
                : []),
            ]),
          ];
          let resolved: string | undefined;
          for (const candidate of candidates) {
            const absolute = path.resolve(rootPath, candidate);
            if (!within(rootPath, absolute))
              fail('unsafe-path', 'Generated relative import escapes the consumer.', {
                path: relative,
              });
            if ((await exists(absolute)) && (await stat(absolute)).isFile()) {
              resolved = candidate;
              break;
            }
          }
          if (!resolved)
            fail('invalid-source', `Generated local import ${edge.specifier} is missing.`, {
              path: relative,
            });
          if (!/\.(?:[cm]?[jt]sx?)$/.test(resolved))
            fail(
              'invalid-source',
              'Only statically parseable JavaScript/TypeScript local imports are supported.',
              { path: resolved }
            );
          sources.push(resolved);
          imports.push({ file: relative, ...edge });
        } else {
          const name = edge.specifier.startsWith('@')
            ? edge.specifier.split('/').slice(0, 2).join('/')
            : edge.specifier.split('/')[0];
          if (
            !packageName(name) ||
            edge.specifier.includes('\\') ||
            edge.specifier.includes('\0') ||
            edge.specifier
              .split('/')
              .some((segment) => !segment || segment === '.' || segment === '..') ||
            !declared.has(name)
          )
            fail(
              'undeclared-import',
              `Generated import ${JSON.stringify(edge.specifier)} is not a declared output dependency.`,
              { path: relative, package: name }
            );
          const resolved = await resolveInstalled(name, path.dirname(filename));
          const declaration = declared.get(name)!;
          if (!resolved || resolved.fact.version !== declaration.version)
            fail(
              'version-mismatch',
              'Generated import resolves outside the verified declared dependency graph.',
              { path: relative, package: name }
            );
          resolved.fact = { ...resolved.fact, declared: true };
          queue.push({ record: resolved, role: declaration.role, by: relative });
          imports.push({ file: relative, ...edge, package: name });
        }
      }
    }
    const visited = new Set<string>();
    for (let index = 0; index < queue.length; index++) {
      const { record, role, by } = queue[index];
      record.fact = {
        ...record.fact,
        roles: [...new Set([...record.fact.roles, role])].sort(),
        requiredBy: [...new Set([...record.fact.requiredBy, by])].sort(),
      };
      reached.set(record.fact.lockPath, record);
      const visit = `${record.fact.lockPath}:${role}`;
      if (visited.has(visit)) continue;
      visited.add(visit);
      const required = dependencies(record.manifest, 'dependencies', record.fact.manifestPath);
      const optional = dependencies(
        record.manifest,
        'optionalDependencies',
        record.fact.manifestPath
      );
      const peers = dependencies(record.manifest, 'peerDependencies', record.fact.manifestPath);
      const peerMeta =
        record.manifest.peerDependenciesMeta === undefined
          ? {}
          : object(record.manifest.peerDependenciesMeta, record.fact.manifestPath);
      const edgeNames = new Set([
        ...Object.keys(required),
        ...Object.keys(optional),
        ...Object.keys(peers),
      ]);
      for (const name of edgeNames) {
        const peerOptional =
          typeof peerMeta[name] === 'object' &&
          peerMeta[name] !== null &&
          (peerMeta[name] as JsonObject).optional === true;
        const mayBeAbsent =
          Object.hasOwn(optional, name) ||
          (Object.hasOwn(peers, name) && peerOptional && !Object.hasOwn(required, name));
        const next = await resolveInstalled(name, record.fact.realPath);
        if (!next) {
          if (!mayBeAbsent)
            fail(
              'missing-package',
              `Installed dependency ${record.fact.name} requires missing ${name}.`,
              { package: name, path: record.fact.path }
            );
          continue;
        }
        // npm optionalDependencies override dependencies; peer constraints still apply.
        for (const specifier of [optional[name] ?? required[name], peers[name]]) {
          if (!specifier) continue;
          if (specifier.startsWith('workspace:') || specifier.startsWith('link:'))
            fail('workspace-package', 'Installed runtime graph contains a workspace dependency.', {
              package: name,
              path: record.fact.path,
            });
          if (exactVersion(specifier) && specifier !== next.fact.version)
            fail(
              'version-mismatch',
              `Installed dependency edge requires ${specifier}, found ${next.fact.version}.`,
              { package: name, path: record.fact.path }
            );
        }
        queue.push({ record: next, role, by: record.fact.lockPath });
      }
    }
    const prefixes = expected.internalPackagePrefixes ?? ['@proto.ui/'];
    const internal = (name: string) => prefixes.some((prefix) => name.startsWith(prefix));
    for (const record of reached.values())
      if (
        internal(record.fact.name) &&
        !record.fact.declared &&
        record.fact.roles.every((role) => role === 'target')
      )
        fail(
          'undeclared-package',
          'Reached internal package has no declared bridge/runtime root.',
          { package: record.fact.name, path: record.fact.path }
        );

    for (const [name, tarball] of Object.entries(expected.tarballs ?? {})) {
      const records = [...reached.values()].filter((record) => record.fact.name === name);
      if (!records.length)
        fail(
          'missing-package',
          'Expected packed package is not in the installed output dependency graph.',
          { package: name }
        );
      const anticipated = path.resolve(rootPath, tarball.path);
      if (!(await stat(anticipated)).isFile())
        fail('tarball-path-mismatch', 'Expected packed artifact is not a regular file.', {
          path: anticipated,
          package: name,
        });
      const bytes = await readFile(anticipated);
      const canonicalTarball = await realpath(anticipated);
      const actualIntegrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
      const verifiedIntegrities = new Set<string>([actualIntegrity]);
      if (tarball.integrity) {
        if (!verifiedIntegrities.has(tarball.integrity))
          verifyIntegrity(bytes, tarball.integrity, anticipated);
        verifiedIntegrities.add(tarball.integrity);
      }
      for (const record of records) {
        if (tarball.version !== undefined && tarball.version !== record.fact.version)
          fail(
            'version-mismatch',
            'Installed packed dependency does not match its expected version.',
            { path: record.fact.path, package: name }
          );
        const resolution =
          record.fact.resolved && localFileResolution(record.fact.resolved, rootPath);
        const declaration =
          rootDependencies[name] && localFileResolution(rootDependencies[name], rootPath);
        if (
          !resolution ||
          anticipated !== resolution ||
          (rootDependencies[name] !== undefined && declaration !== anticipated)
        )
          fail(
            'tarball-path-mismatch',
            'Installed lock/declaration do not resolve the expected packed artifact.',
            { path: record.fact.path, package: name }
          );
        if (!record.fact.integrity)
          fail('integrity-mismatch', 'Packed dependency lock resolution has no integrity.', {
            path: record.fact.path,
            package: name,
          });
        if (!verifiedIntegrities.has(record.fact.integrity)) {
          verifyIntegrity(bytes, record.fact.integrity, anticipated);
          verifiedIntegrities.add(record.fact.integrity);
        }
        record.fact = {
          ...record.fact,
          tarball: { path: canonicalTarball, integrity: actualIntegrity },
        };
      }
    }

    const helperFacts = helpers.map<ConsumerHelperFact>((helper) => {
      if (helper.delivery === 'inline') {
        const evidence = declarations.get(helper.name);
        if (!evidence?.length)
          fail(
            'missing-helper',
            'Declared inline helper is absent from the parsed generated source graph.',
            { package: helper.name }
          );
        return { ...helper, delivery: 'inline', declarations: evidence };
      }
      const packages = [...reached.values()]
        .map((record) => record.fact)
        .filter((fact) => fact.name === helper.name && fact.version === helper.version);
      if (!packages.length)
        fail('missing-helper', 'Declared dependency helper has no matching installed evidence.', {
          package: helper.name,
        });
      return { ...helper, delivery: 'dependency', packages };
    });
    const lockOnly: LockOnlyConsumerPackage[] = [];
    for (const [key, value] of Object.entries(locks).sort(([left], [right]) =>
      left.localeCompare(right)
    )) {
      if (!key) continue;
      if (
        path.isAbsolute(key) ||
        key.includes('\\') ||
        !within(rootPath, path.resolve(rootPath, key))
      )
        fail('unsafe-path', 'Lock package path escapes the consumer.', { path: key });
      if (await exists(path.resolve(rootPath, key))) continue;
      const entry = object(value, lockPath);
      const moduleOffset = key.lastIndexOf('node_modules/');
      const name =
        typeof entry.name === 'string'
          ? entry.name
          : moduleOffset >= 0
            ? key.slice(moduleOffset + 'node_modules/'.length)
            : path.posix.basename(key);
      lockOnly.push({
        name,
        path: key,
        version: typeof entry.version === 'string' ? entry.version : undefined,
        optional: entry.optional === true,
        dev: entry.dev === true,
        os: platformConstraints(entry.os, lockPath),
        cpu: platformConstraints(entry.cpu, lockPath),
      });
    }
    const facts = [...reached.values()]
      .map((record) => record.fact)
      .sort((left, right) => left.lockPath.localeCompare(right.lockPath));
    return {
      ok: true,
      value: {
        root: rootPath,
        profile: String(provenance.profile),
        lockfile: { path: lockPath, version: lockfile.lockfileVersion },
        internal: facts.filter((fact) => internal(fact.name)),
        external: facts.filter((fact) => !internal(fact.name)),
        helpers: helperFacts,
        imports,
        lockOnly,
      },
    };
  } catch (error) {
    if (error instanceof ClosureRejection) return { ok: false, failures: [error.failure] };
    const failure = error as NodeJS.ErrnoException;
    return {
      ok: false,
      failures: [
        {
          code: 'io-error',
          message: failure.message ?? String(error),
          ...(failure.path ? { path: failure.path } : {}),
        },
      ],
    };
  }
}
