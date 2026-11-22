import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import {
  validateArtifacts,
  writeArtifactSet,
  type ExclusiveOutputFile,
  type OutputArtifact,
} from './artifact-output';
import type { DataType } from './data-types';
import { IR_VERSION, type CompileResult, type CompilerDiagnostic, type SourceSpan } from './ir';
import { buildNativeContextArtifacts } from './native-context';
import { buildNativeStaticDeclarations } from './native-static-declarations';
import type { SuccessfulProjectGeneration } from './project';
import { projectCompilationArtifacts, type ProjectArtifactOptions } from './project-output';
import { unknownDiagnosticSpan } from './diagnostics';

export const COMPILER_LIBRARY_FORMAT = 'proto-ui.compiler-library' as const;
export const COMPILER_LIBRARY_VERSION = 1 as const;
export const COMPILER_LIBRARY_MANIFEST = 'compiler-library.json';
export const COMPILER_LIBRARY_DECLARATIONS = 'proto-declarations.ts';

/** Source binding IDs are resolved by the compiler, never matched by debug name. */
export interface CompilerExternalDeclaration {
  readonly library: string;
  readonly export: string;
}

export interface CompilerLibraryOptions extends ProjectArtifactOptions {
  readonly id: string;
  readonly exports?: Readonly<Record<string, string>>;
  readonly imports?: Readonly<Record<string, CompilerExternalDeclaration>>;
}

export interface CompilerLibraryDeclaration {
  readonly id: string;
  readonly kind:
    | 'context-key'
    | 'anatomy-family'
    | 'focus-scope-key'
    | 'focus-roving-key'
    | 'a11y-ref';
  readonly path: string;
  readonly symbol: 'key' | 'declaration';
  /** Deterministic semantic signature, preserving signed zero and ignoring object-key order. */
  readonly contract: string;
  readonly span: SourceSpan;
}

export interface CompilerSharedSupport {
  readonly path: string;
  readonly abi: string;
  readonly version: number;
  readonly sha256: string;
}

export interface CompilerLibraryManifest {
  readonly format: typeof COMPILER_LIBRARY_FORMAT;
  readonly version: typeof COMPILER_LIBRARY_VERSION;
  readonly id: string;
  readonly profile: string;
  readonly irVersion: number;
  readonly projectIdentity: string;
  readonly entries: readonly { entry: string; sourcePath: string }[];
  readonly declarations: readonly CompilerLibraryDeclaration[];
  readonly exports: Readonly<Record<string, string>>;
  readonly imports: Readonly<Record<string, CompilerExternalDeclaration>>;
  readonly support: readonly CompilerSharedSupport[];
  readonly dependencies: readonly { name: string; version: string; role: string }[];
  readonly artifacts: readonly { path: string; kind: OutputArtifact['kind']; sha256: string }[];
}

/** A serializable, separately compilable artifact set. No AST or executable compiler closure. */
export interface CompilerLibrary {
  readonly manifest: CompilerLibraryManifest;
  readonly artifacts: readonly OutputArtifact[];
}

export const artifactDigest = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

export function libraryRejection<T>(
  code: string,
  message: string,
  file = '<compiler-library>',
  category: CompilerDiagnostic['category'] = 'invalid-input'
): CompileResult<T> {
  return {
    ok: false,
    diagnostics: [
      {
        code,
        category,
        message,
        span: unknownDiagnosticSpan(file),
      },
    ],
  };
}

const DOM_SOURCE_PROFILES = new Set([
  'react-dom-source-v1',
  'vue-source-v1',
  'vue2-source-v1',
  'web-component-source-v1',
  'react-dom-ssr-v1',
  'vue-ssr-v1',
  'vue2-ssr-v1',
  'web-component-ssr-v1',
]);

function stableValue(value: unknown): string {
  if (typeof value === 'number') return `number:${Object.is(value, -0) ? '-0' : String(value)}`;
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableValue).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableValue((value as Record<string, unknown>)[key])}`)
    .join(',')}}`;
}

function dataContract(type: DataType): unknown {
  if (typeof type === 'string') return type;
  if (type.kind === 'literal' && typeof type.value === 'number' && type.value === 0)
    return { ...type, value: 0 };
  if (type.kind === 'record')
    return {
      kind: 'record',
      fields: [...type.fields]
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
        .map((field) => ({
          name: field.name,
          optional: field.optional === true,
          type: dataContract(field.type),
        })),
    };
  if (type.kind === 'array') return { kind: 'array', element: dataContract(type.element) };
  if (type.kind === 'union') {
    const alternatives = new Map(
      type.members.map((member) => {
        const normalized = dataContract(member);
        return [stableValue(normalized), normalized] as const;
      })
    );
    const members = [...alternatives]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([, value]) => value);
    return members.length === 1 ? members[0] : { kind: 'union', members };
  }
  return type;
}

/** Only named identity-bearing modules start a shared support closure. */
function supportABI(filename: string): { abi: string; version: number } | undefined {
  const fixed: Readonly<Record<string, readonly [string, number]>> = {
    '.proto-ui/context/scope-v1.ts': ['proto-ui.context-scope', 1],
    '.proto-ui/context/react-v1.ts': ['proto-ui.react-context-transport', 1],
    '.proto-ui/context/react-ssr-v1.ts': ['proto-ui.react-ssr-transport', 1],
    '.proto-ui/vue/ssr-v1.ts': ['proto-ui.vue-ssr-transport', 1],
    '.proto-ui/web-component/ssr-v1.ts': ['proto-ui.web-component-ssr-transport', 1],
    '.proto-ui/interaction/native-v1.ts': ['proto-ui.dom-interaction', 1],
    '.proto-ui/interaction/adapter-modules-v1.ts': ['proto-ui.dom-adapter-modules', 1],
    '.proto-ui/interaction/ownership-v1.ts': ['proto-ui.dom-ownership', 1],
    '.proto-ui/interaction/ownership-v2.ts': ['proto-ui.dom-ownership', 2],
    '.proto-ui/interaction/focus-ownership-v2.ts': ['proto-ui.dom-focus-ownership', 2],
    '.proto-ui/interaction/boundary-ownership-v2.ts': ['proto-ui.dom-boundary-ownership', 2],
    '.proto-ui/interaction/overlay-ownership-v2.ts': ['proto-ui.dom-overlay-ownership', 2],
    '.proto-ui/interaction/hit-ownership-v2.ts': ['proto-ui.dom-hit-ownership', 2],
    '.proto-ui/interaction/table-ownership-v2.ts': ['proto-ui.dom-table-ownership', 2],
    '.proto-ui/interaction/part-relationships-v1.ts': ['proto-ui.dom-part-relationships', 1],
    '.proto-ui/interaction/control-label-v1.ts': ['proto-ui.dom-control-label', 1],
  };
  const entry = fixed[filename];
  return entry ? { abi: entry[0], version: entry[1] } : undefined;
}

/** All statically spelled relative imports, including type-only imports, must remain resolvable. */
function relativeModuleImports(contents: string, filename: string): string[] {
  const source = ts.createSourceFile(filename, contents, ts.ScriptTarget.Latest, true);
  const imports = new Set<string>();
  function visit(node: ts.Node): void {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text.startsWith('.')
    )
      imports.add(node.moduleSpecifier.text);
    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal) &&
      node.argument.literal.text.startsWith('.')
    )
      imports.add(node.argument.literal.text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return [...imports].sort();
}

export function collectLibrarySupport(
  artifacts: readonly OutputArtifact[],
  declarations: readonly CompilerLibraryDeclaration[]
): CompileResult<CompilerSharedSupport[]> {
  const byPath = new Map(artifacts.map((artifact) => [artifact.path, artifact]));
  const privatePaths = new Set(declarations.map((declaration) => declaration.path));
  const visited = new Map<string, CompilerSharedSupport>();
  const queue = artifacts
    .filter((artifact) => supportABI(artifact.path))
    .map((artifact) => artifact.path);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const filename = queue[cursor];
    if (visited.has(filename)) continue;
    const artifact = byPath.get(filename)!;
    if (
      !filename.startsWith('.proto-ui/') ||
      artifact.kind !== 'source' ||
      privatePaths.has(filename)
    )
      return libraryRejection(
        'PUI4203',
        `Shared support cannot own private declaration or non-source artifact ${filename}.`,
        filename
      );
    const abi = supportABI(filename) ?? {
      abi: `proto-ui.support-dependency:${filename}`,
      version: 1,
    };
    visited.set(filename, { path: filename, ...abi, sha256: artifactDigest(artifact.contents) });
    for (const specifier of relativeModuleImports(artifact.contents, filename)) {
      const base = path.posix.normalize(path.posix.join(path.posix.dirname(filename), specifier));
      const target = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}/index.ts`].find(
        (candidate) => byPath.has(candidate)
      );
      if (!target)
        return libraryRejection(
          'PUI4203',
          `Shared support import ${specifier} from ${filename} has no supplied artifact.`,
          filename
        );
      queue.push(target);
    }
  }
  return {
    ok: true,
    value: [...visited.values()].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)),
  };
}

function nominalDeclarations(
  generation: SuccessfulProjectGeneration
): CompileResult<CompilerLibraryDeclaration[]> {
  const declarations = new Map<string, CompilerLibraryDeclaration>();
  for (const { compilation } of generation.entries) {
    const { ir, output } = compilation;
    const emitted = new Set(output.supportingFiles?.map((file) => file.path));
    const contexts = buildNativeContextArtifacts(ir);
    const staticDeclarations = buildNativeStaticDeclarations(
      ir.staticDeclarations,
      ir.moduleDeclarations
    );
    const current: CompilerLibraryDeclaration[] = [
      ...ir.contextKeys.map(
        (key): CompilerLibraryDeclaration => ({
          id: key.id,
          kind: 'context-key',
          path: contexts.keys.get(key.id)!.file.slice(2),
          symbol: 'key',
          contract: stableValue(dataContract(key.type)),
          span: key.span,
        })
      ),
      ...ir.staticDeclarations.map(
        (declaration): CompilerLibraryDeclaration => ({
          id: declaration.id,
          kind: declaration.kind,
          path: staticDeclarations.capabilities.get(declaration.id)!.file,
          symbol: 'declaration',
          contract: stableValue(declaration.config),
          span: declaration.span,
        })
      ),
    ];
    for (const declaration of current) {
      // An IR inventory entry that did not reach this output is not a library export.
      if (!emitted.has(declaration.path)) continue;
      const previous = declarations.get(declaration.id);
      if (
        previous &&
        (previous.kind !== declaration.kind ||
          previous.contract !== declaration.contract ||
          previous.path !== declaration.path)
      )
        return libraryRejection(
          'PUI4202',
          `Conflicting declaration ${declaration.id} inside one library.`,
          declaration.span.file
        );
      declarations.set(declaration.id, declaration);
    }
  }
  return {
    ok: true,
    value: [...declarations.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
  };
}

export function moduleSpecifier(from: string, to: string): string {
  const relative = path.posix.relative(path.posix.dirname(from), to).replace(/\.(tsx?|js)$/u, '');
  return relative.startsWith('./') || relative.startsWith('../') ? relative : `./${relative}`;
}

/** Keep authored provenance while recording hashes for the files actually published. */
export function refreshLibraryProvenance(
  artifacts: readonly OutputArtifact[],
  metadata: Readonly<Record<string, unknown>>
): CompileResult<OutputArtifact[]> {
  const local = new Map(artifacts.map((artifact) => [artifact.path, artifact]));
  function refresh(filename: string): void {
    const artifact = local.get(filename)!;
    const original = JSON.parse(artifact.contents) as Record<string, unknown> & {
      artifacts: { path: string; kind?: string; sha256: string }[];
    };
    if (!Array.isArray(original.artifacts))
      throw new Error(`Missing artifact inventory in ${filename}.`);
    const actual = original.artifacts.map((record) => {
      const file = local.get(record.path);
      if (!file) throw new Error(`Missing provenance artifact ${record.path} in ${filename}.`);
      return { ...record, sha256: artifactDigest(file.contents) };
    });
    local.set(filename, {
      ...artifact,
      contents:
        JSON.stringify(
          {
            ...original,
            originArtifacts: original.originArtifacts ?? original.artifacts,
            artifacts: actual,
            ...metadata,
          },
          null,
          2
        ) + '\n',
    });
  }
  try {
    // Entry provenance is hashed by project provenance, so it must be refreshed first.
    for (const artifact of artifacts)
      if (artifact.kind === 'manifest' && artifact.path !== 'provenance.json')
        refresh(artifact.path);
    if (local.has('provenance.json')) refresh('provenance.json');
    return { ok: true, value: [...local.values()] };
  } catch (error) {
    return libraryRejection(
      'PUI4201',
      `Invalid compiler provenance: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function unresolvedDeclaration(
  declaration: CompilerLibraryDeclaration,
  target: CompilerExternalDeclaration
): string {
  return `// External declaration obligation. Link this library before importing its components.\nexport const ${declaration.symbol} = undefined as never;\nthrow new Error(${JSON.stringify(`[Compiler link] Unresolved external declaration ${declaration.id}: ${target.library} exports ${target.export}.`)});\n`;
}

/** Prepare one independently compiled graph; no output from another library is merged here. */
export function prepareCompilerLibrary(
  generation: SuccessfulProjectGeneration,
  options: CompilerLibraryOptions
): CompileResult<CompilerLibrary> {
  if (!options.id || typeof options.id !== 'string' || !options.id.trim())
    return libraryRejection('PUI4201', 'A compiler library requires a nonempty explicit ID.');
  const profile = generation.entries[0]?.compilation.output.profile;
  if (!DOM_SOURCE_PROFILES.has(profile))
    return libraryRejection(
      'PUI4201',
      `Nominal DOM library linking is unsupported for ${profile ?? '<empty project>'}.`,
      '<compiler-library>',
      'unsupported-input'
    );
  const prepared = projectCompilationArtifacts(generation, options);
  if (!prepared.ok) return prepared;
  const inventory = nominalDeclarations(generation);
  if (!inventory.ok) return inventory;
  const declarations = inventory.value;
  const byId = new Map(declarations.map((declaration) => [declaration.id, declaration]));
  const exports = { ...options.exports };
  const imports = Object.fromEntries(
    Object.entries(options.imports ?? {}).map(([id, value]) => [id, { ...value }])
  );
  for (const [name, id] of Object.entries(exports)) {
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(name) || name === 'default' || !byId.has(id))
      return libraryRejection(
        'PUI4201',
        `Export ${name} must name a reached canonical declaration binding; got ${id}.`
      );
  }
  for (const [id, target] of Object.entries(imports)) {
    if (
      !byId.has(id) ||
      typeof target.library !== 'string' ||
      !target.library.trim() ||
      typeof target.export !== 'string' ||
      !target.export.trim()
    )
      return libraryRejection(
        'PUI4201',
        `Import ${id} must name a reached declaration and one explicit library/export obligation.`
      );
  }
  const rewritten = prepared.value.map((artifact) => {
    const declaration = declarations.find((candidate) => candidate.path === artifact.path);
    return declaration && Object.hasOwn(imports, declaration.id)
      ? { ...artifact, contents: unresolvedDeclaration(declaration, imports[declaration.id]) }
      : { ...artifact };
  });
  const refreshed = refreshLibraryProvenance(rewritten, {
    library: {
      format: COMPILER_LIBRARY_FORMAT,
      version: COMPILER_LIBRARY_VERSION,
      id: options.id,
      exports,
      imports,
    },
  });
  if (!refreshed.ok) return refreshed;
  const artifacts = refreshed.value;
  if (Object.keys(exports).length)
    artifacts.push({
      path: COMPILER_LIBRARY_DECLARATIONS,
      kind: 'source',
      contents:
        '// Explicit public nominal declarations. Private declarations are not exported.\n' +
        Object.entries(exports)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([name, id]) => {
            const declaration = byId.get(id)!;
            return `export { ${declaration.symbol} as ${name} } from ${JSON.stringify(moduleSpecifier(COMPILER_LIBRARY_DECLARATIONS, declaration.path))};`;
          })
          .join('\n') +
        '\n',
    });
  const invalid = validateArtifacts([
    ...artifacts,
    { path: COMPILER_LIBRARY_MANIFEST, kind: 'manifest', contents: '' },
  ]);
  if (invalid) return libraryRejection('PUI4201', invalid);
  const support = collectLibrarySupport(artifacts, declarations);
  if (!support.ok) return support;
  const dependencies = new Map<string, { name: string; version: string; role: string }>();
  for (const { compilation } of generation.entries)
    for (const dependency of compilation.output.dependencies) {
      const previous = dependencies.get(dependency.name);
      if (previous && previous.version !== dependency.version)
        return libraryRejection(
          'PUI4203',
          `Conflicting dependency versions for ${dependency.name}.`
        );
      dependencies.set(dependency.name, { ...dependency });
    }
  artifacts.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return {
    ok: true,
    value: {
      manifest: {
        format: COMPILER_LIBRARY_FORMAT,
        version: COMPILER_LIBRARY_VERSION,
        id: options.id,
        profile,
        irVersion: IR_VERSION,
        projectIdentity: generation.identity,
        entries: generation.entries
          .map(({ entry }) => ({ entry, sourcePath: options.sourcePaths[entry] }))
          .sort((a, b) => (a.entry < b.entry ? -1 : a.entry > b.entry ? 1 : 0)),
        declarations,
        exports,
        imports,
        support: support.value,
        dependencies: [...dependencies.values()].sort((a, b) =>
          a.name < b.name ? -1 : a.name > b.name ? 1 : 0
        ),
        artifacts: artifacts.map((artifact) => ({
          path: artifact.path,
          kind: artifact.kind,
          sha256: artifactDigest(artifact.contents),
        })),
      },
      artifacts,
    },
  };
}

/** Verify a saved/transported artifact before it can supply an identity or shared ABI. */
export function validateCompilerLibrary(library: CompilerLibrary): CompileResult<CompilerLibrary> {
  try {
    const { manifest, artifacts } = library;
    if (
      manifest.format !== COMPILER_LIBRARY_FORMAT ||
      manifest.version !== COMPILER_LIBRARY_VERSION
    )
      return libraryRejection(
        'PUI4203',
        'Unsupported compiler library manifest format or version.'
      );
    if (
      typeof manifest.id !== 'string' ||
      !manifest.id.trim() ||
      !DOM_SOURCE_PROFILES.has(manifest.profile) ||
      !Number.isInteger(manifest.irVersion) ||
      manifest.irVersion < 1 ||
      !Array.isArray(manifest.entries) ||
      !manifest.entries.length ||
      !Array.isArray(manifest.declarations) ||
      !Array.isArray(manifest.support) ||
      !Array.isArray(manifest.dependencies) ||
      !Array.isArray(manifest.artifacts) ||
      typeof manifest.projectIdentity !== 'string' ||
      !manifest.projectIdentity ||
      !manifest.exports ||
      typeof manifest.exports !== 'object' ||
      Array.isArray(manifest.exports) ||
      !manifest.imports ||
      typeof manifest.imports !== 'object' ||
      Array.isArray(manifest.imports)
    )
      return libraryRejection(
        'PUI4201',
        'Malformed compiler library identity, target or inventory.'
      );
    const invalid = validateArtifacts([
      ...artifacts,
      { path: COMPILER_LIBRARY_MANIFEST, kind: 'manifest', contents: '' },
    ]);
    if (invalid) return libraryRejection('PUI4201', invalid, manifest.id);
    const byPath = new Map(artifacts.map((artifact) => [artifact.path, artifact]));
    if (
      manifest.artifacts.length !== artifacts.length ||
      new Set(manifest.artifacts.map((artifact) => artifact.path)).size !== artifacts.length
    )
      return libraryRejection(
        'PUI4201',
        'Library manifest must cover every artifact exactly once.',
        manifest.id
      );
    for (const record of manifest.artifacts) {
      const artifact = byPath.get(record.path);
      if (
        !artifact ||
        artifact.kind !== record.kind ||
        artifactDigest(artifact.contents) !== record.sha256
      )
        return libraryRejection(
          'PUI4201',
          `Library artifact is missing or modified: ${record.path}.`,
          manifest.id
        );
    }
    const ids = new Set<string>();
    const declarationPaths = new Set<string>();
    const kinds = new Set([
      'context-key',
      'anatomy-family',
      'focus-scope-key',
      'focus-roving-key',
      'a11y-ref',
    ]);
    for (const declaration of manifest.declarations) {
      if (
        typeof declaration.id !== 'string' ||
        !declaration.id ||
        ids.has(declaration.id) ||
        declarationPaths.has(declaration.path) ||
        !kinds.has(declaration.kind) ||
        declaration.symbol !== (declaration.kind === 'context-key' ? 'key' : 'declaration') ||
        typeof declaration.contract !== 'string' ||
        !declaration.span ||
        typeof declaration.span.file !== 'string' ||
        byPath.get(declaration.path)?.kind !== 'source'
      )
        return libraryRejection(
          'PUI4201',
          'Malformed or conflicting nominal declaration inventory.',
          manifest.id
        );
      ids.add(declaration.id);
      declarationPaths.add(declaration.path);
    }
    for (const [name, id] of Object.entries(manifest.exports)) {
      if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(name) || name === 'default' || !ids.has(id))
        return libraryRejection(
          'PUI4201',
          `Invalid library declaration export ${name}.`,
          manifest.id
        );
    }
    for (const [id, target] of Object.entries(manifest.imports)) {
      if (
        !ids.has(id) ||
        !target ||
        typeof target.library !== 'string' ||
        !target.library.trim() ||
        typeof target.export !== 'string' ||
        !target.export.trim()
      )
        return libraryRejection(
          'PUI4201',
          `Invalid library external obligation ${id}.`,
          manifest.id
        );
    }
    const entryNames = new Set<string>();
    for (const entry of manifest.entries) {
      if (
        typeof entry.entry !== 'string' ||
        !entry.entry ||
        entryNames.has(entry.entry) ||
        byPath.get(entry.sourcePath)?.kind !== 'source'
      )
        return libraryRejection(
          'PUI4201',
          `Missing compiled library entry ${entry.entry}.`,
          manifest.id
        );
      entryNames.add(entry.entry);
    }
    const dependencyNames = new Set<string>();
    for (const dependency of manifest.dependencies) {
      if (
        typeof dependency.name !== 'string' ||
        !dependency.name ||
        dependencyNames.has(dependency.name) ||
        typeof dependency.version !== 'string' ||
        !dependency.version ||
        typeof dependency.role !== 'string' ||
        !dependency.role
      )
        return libraryRejection(
          'PUI4203',
          'Malformed or conflicting shared dependency inventory.',
          manifest.id
        );
      dependencyNames.add(dependency.name);
    }
    const support = collectLibrarySupport(artifacts, manifest.declarations);
    if (!support.ok) return support;
    if (stableValue(support.value) !== stableValue(manifest.support))
      return libraryRejection(
        'PUI4203',
        'Library shared-support ABI or implementation fingerprint is incompatible with its artifacts.',
        manifest.id
      );
    return { ok: true, value: library };
  } catch (error) {
    return libraryRejection(
      'PUI4201',
      `Malformed compiler library: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export function compilerLibraryArtifacts(
  library: CompilerLibrary
): CompileResult<OutputArtifact[]> {
  const checked = validateCompilerLibrary(library);
  return checked.ok
    ? {
        ok: true,
        value: [
          ...library.artifacts,
          {
            path: COMPILER_LIBRARY_MANIFEST,
            kind: 'manifest',
            contents: JSON.stringify(library.manifest, null, 2) + '\n',
          },
        ],
      }
    : checked;
}

export async function writeCompilerLibrary(
  library: CompilerLibrary,
  directory: string,
  openExclusive?: (filename: string) => Promise<ExclusiveOutputFile>
): Promise<CompileResult<{ directory: string; files: string[] }>> {
  const planned = compilerLibraryArtifacts(library);
  return planned.ok ? writeArtifactSet(planned.value, directory, openExclusive) : planned;
}

export async function readCompilerLibrary(
  directory: string
): Promise<CompileResult<CompilerLibrary>> {
  try {
    const root = path.resolve(directory);
    if ((await realpath(root)) !== root || !(await lstat(root)).isDirectory())
      return libraryRejection('PUI4201', 'Compiler library root must be a real directory.', root);
    async function read(filename: string): Promise<string> {
      const segments = filename.split('/');
      for (let index = 0; index < segments.length; index++) {
        const current = path.join(root, ...segments.slice(0, index + 1));
        const stat = await lstat(current);
        if (index === segments.length - 1 ? !stat.isFile() : !stat.isDirectory())
          throw new Error(
            `Compiler library artifact path is not a regular file/directory: ${filename}.`
          );
      }
      return readFile(path.join(root, filename), 'utf8');
    }
    const manifest = JSON.parse(await read(COMPILER_LIBRARY_MANIFEST)) as CompilerLibraryManifest;
    if (!Array.isArray(manifest.artifacts))
      return libraryRejection('PUI4201', 'Missing compiler library artifact inventory.', root);
    const invalid = validateArtifacts([
      ...manifest.artifacts.map((artifact) => ({ ...artifact, contents: '' })),
      { path: COMPILER_LIBRARY_MANIFEST, kind: 'manifest', contents: '' },
    ]);
    if (invalid) return libraryRejection('PUI4201', invalid, root);
    const artifacts: OutputArtifact[] = [];
    for (const artifact of manifest.artifacts)
      artifacts.push({
        path: artifact.path,
        kind: artifact.kind,
        contents: await read(artifact.path),
      });
    return validateCompilerLibrary({ manifest, artifacts });
  } catch (error) {
    return libraryRejection(
      'PUI4201',
      `Cannot read compiler library: ${error instanceof Error ? error.message : String(error)}`,
      directory
    );
  }
}
