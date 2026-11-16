import path from 'node:path';
import {
  artifactDigest,
  libraryRejection,
  moduleSpecifier,
  refreshLibraryProvenance,
  validateCompilerLibrary,
  type CompilerLibrary,
  type CompilerLibraryDeclaration,
  type CompilerSharedSupport,
} from './artifact-library';
import {
  validateArtifacts,
  writeArtifactSet,
  type ExclusiveOutputFile,
  type OutputArtifact,
} from './artifact-output';
import type { CompileResult } from './ir';

export const COMPILER_LINK_FORMAT = 'proto-ui.compiler-link' as const;
export const COMPILER_LINK_VERSION = 1 as const;
export const COMPILER_LINK_MANIFEST = 'compiler-link.json';
const sharedDirectory = '.proto-ui/link-support';

export interface CompilerLinkOptions {
  /** Explicit output layout. Omission uses a deterministic private directory for each library ID. */
  readonly directories?: Readonly<Record<string, string>>;
}

export interface CompilerLinkedDeclaration {
  readonly library: string;
  readonly declaration: string;
  readonly ownerLibrary: string;
  readonly ownerDeclaration: string;
  readonly ownerPath: string;
}

export interface LinkedCompilerLibraries {
  readonly artifacts: readonly OutputArtifact[];
  readonly entries: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly declarations: readonly CompilerLinkedDeclaration[];
}

interface Owner {
  library: CompilerLibrary;
  declaration: CompilerLibraryDeclaration;
}

function interactionRealm(library: CompilerLibrary): number | undefined {
  const ownership = library.manifest.support.find(
    (support) => support.abi === 'proto-ui.dom-ownership'
  );
  if (ownership) return ownership.version;
  return library.manifest.support.some(
    (support) =>
      support.abi === 'proto-ui.dom-interaction' || support.abi === 'proto-ui.dom-adapter-modules'
  )
    ? 1
    : undefined;
}

/**
 * Link explicit external obligations and identity-bearing support. Component
 * bodies, private declaration factories and source maps are not rewritten.
 */
export function linkCompilerLibraries(
  inputs: readonly CompilerLibrary[],
  options: CompilerLinkOptions = {}
): CompileResult<LinkedCompilerLibraries> {
  if (!inputs.length)
    return libraryRejection('PUI4201', 'A compiler link requires at least one library.');
  for (const library of inputs) {
    const checked = validateCompilerLibrary(library);
    if (!checked.ok) return checked;
  }
  const libraries = [...inputs].sort((a, b) =>
    a.manifest.id < b.manifest.id ? -1 : a.manifest.id > b.manifest.id ? 1 : 0
  );
  const byId = new Map<string, CompilerLibrary>();
  const directories = new Map<string, string>();
  const declarations = new Map<string, Map<string, CompilerLibraryDeclaration>>();
  const supportByAbi = new Map<
    string,
    { library: string; support: CompilerSharedSupport; artifact: OutputArtifact }
  >();
  const dependencies = new Map<string, string>();
  let realm: number | undefined;
  for (const library of libraries) {
    const manifest = library.manifest;
    if (byId.has(manifest.id))
      return libraryRejection('PUI4201', `Duplicate compiler library ID ${manifest.id}.`);
    if (
      manifest.profile !== libraries[0].manifest.profile ||
      manifest.irVersion !== libraries[0].manifest.irVersion
    )
      return libraryRejection(
        'PUI4203',
        `Library ${manifest.id} has an incompatible target profile or semantic IR ABI.`,
        manifest.id
      );
    byId.set(manifest.id, library);
    const directory =
      options.directories === undefined
        ? `libraries/${artifactDigest(manifest.id).slice(0, 20)}`
        : Object.hasOwn(options.directories, manifest.id)
          ? options.directories[manifest.id]
          : undefined;
    if (typeof directory !== 'string')
      return libraryRejection('PUI4201', `Missing output directory for library ${manifest.id}.`);
    const invalid = validateArtifacts([
      { path: `${directory}/entry.ts`, kind: 'source', contents: '' },
    ]);
    if (invalid) return libraryRejection('PUI4201', invalid, manifest.id);
    const folded = directory.normalize('NFC').toLowerCase();
    if (folded === '.proto-ui' || folded.startsWith('.proto-ui/'))
      return libraryRejection(
        'PUI4201',
        'Library directories must not occupy the linker support directory.',
        manifest.id
      );
    for (const previous of directories.values()) {
      const other = previous.normalize('NFC').toLowerCase();
      if (folded === other || folded.startsWith(`${other}/`) || other.startsWith(`${folded}/`))
        return libraryRejection(
          'PUI4201',
          `Library output directories overlap: ${directory} and ${previous}.`
        );
    }
    directories.set(manifest.id, directory);
    declarations.set(
      manifest.id,
      new Map(manifest.declarations.map((declaration) => [declaration.id, declaration]))
    );
    for (const dependency of manifest.dependencies) {
      const previous = dependencies.get(dependency.name);
      if (previous !== undefined && previous !== dependency.version)
        return libraryRejection(
          'PUI4203',
          `Incompatible shared dependency ${dependency.name}: ${previous} versus ${dependency.version}.`,
          manifest.id
        );
      dependencies.set(dependency.name, dependency.version);
    }
    const currentRealm = interactionRealm(library);
    if (realm !== undefined && currentRealm !== undefined && realm !== currentRealm)
      return libraryRejection(
        'PUI4203',
        `Incompatible DOM ownership ABI versions ${realm} and ${currentRealm}.`,
        manifest.id
      );
    if (currentRealm !== undefined) realm = currentRealm;
    const files = new Map(library.artifacts.map((artifact) => [artifact.path, artifact]));
    for (const support of manifest.support) {
      const previous = supportByAbi.get(support.abi);
      if (
        previous &&
        (previous.support.version !== support.version ||
          previous.support.sha256 !== support.sha256 ||
          previous.support.path !== support.path)
      )
        return libraryRejection(
          'PUI4203',
          `Incompatible shared support ${support.abi} between ${previous.library} and ${manifest.id}: ABI version or implementation fingerprint differs.`,
          manifest.id
        );
      supportByAbi.set(support.abi, {
        library: manifest.id,
        support,
        artifact: files.get(support.path)!,
      });
    }
  }
  if (options.directories && Object.keys(options.directories).some((id) => !byId.has(id)))
    return libraryRejection('PUI4201', 'Output layout names an unknown compiler library.');

  const owners = new Map<string, Owner>();
  const resolving = new Set<string>();
  function resolve(
    library: CompilerLibrary,
    declaration: CompilerLibraryDeclaration
  ): CompileResult<Owner> {
    const identity = JSON.stringify([library.manifest.id, declaration.id]);
    const previous = owners.get(identity);
    if (previous) return { ok: true, value: previous };
    if (resolving.has(identity))
      return libraryRejection(
        'PUI4202',
        `External declaration cycle reaches ${library.manifest.id}:${declaration.id}.`,
        declaration.span.file
      );
    const imports = library.manifest.imports;
    if (!Object.hasOwn(imports, declaration.id)) {
      const owner = { library, declaration };
      owners.set(identity, owner);
      return { ok: true, value: owner };
    }
    const external = imports[declaration.id];
    const target = byId.get(external.library);
    if (!target || !Object.hasOwn(target.manifest.exports, external.export))
      return libraryRejection(
        'PUI4202',
        `Unresolved external declaration ${declaration.id}: ${external.library} does not supply ${external.export}.`,
        declaration.span.file
      );
    const targetDeclaration = declarations
      .get(external.library)!
      .get(target.manifest.exports[external.export])!;
    if (
      declaration.kind !== targetDeclaration.kind ||
      declaration.contract !== targetDeclaration.contract
    )
      return libraryRejection(
        'PUI4204',
        `Incompatible declaration contract for ${library.manifest.id}:${declaration.id} and ${external.library}:${external.export}: kind or checked value/configuration differs.`,
        declaration.span.file
      );
    resolving.add(identity);
    const resolved = resolve(target, targetDeclaration);
    resolving.delete(identity);
    if (resolved.ok) owners.set(identity, resolved.value);
    return resolved;
  }
  const linkedDeclarations: CompilerLinkedDeclaration[] = [];
  for (const library of libraries)
    for (const declaration of library.manifest.declarations) {
      const owner = resolve(library, declaration);
      if (!owner.ok) return owner;
      linkedDeclarations.push({
        library: library.manifest.id,
        declaration: declaration.id,
        ownerLibrary: owner.value.library.manifest.id,
        ownerDeclaration: owner.value.declaration.id,
        ownerPath: path.posix.join(
          directories.get(owner.value.library.manifest.id)!,
          owner.value.declaration.path
        ),
      });
    }

  const files = new Map<string, OutputArtifact>();
  const entries: Record<string, Record<string, string>> = Object.create(null);
  const sharedPaths = new Map<string, string>();
  for (const { support, artifact } of supportByAbi.values()) {
    const destination = path.posix.join(sharedDirectory, artifact.path.slice('.proto-ui/'.length));
    const previous = files.get(destination);
    if (previous && previous.contents !== artifact.contents)
      return libraryRejection('PUI4203', `Shared support output collision at ${destination}.`);
    files.set(destination, { ...artifact, path: destination });
    sharedPaths.set(support.abi, destination);
  }
  for (const library of libraries) {
    const id = library.manifest.id;
    const directory = directories.get(id)!;
    const support = new Map(library.manifest.support.map((item) => [item.path, item]));
    const declared = new Map(
      library.manifest.declarations.map((declaration) => [declaration.path, declaration])
    );
    const local = new Map<string, OutputArtifact>();
    const entryPaths: Record<string, string> = Object.create(null);
    for (const entry of library.manifest.entries)
      entryPaths[entry.entry] = path.posix.join(directory, entry.sourcePath);
    entries[id] = entryPaths;
    for (const artifact of library.artifacts) {
      const destination = path.posix.join(directory, artifact.path);
      const declaration = declared.get(artifact.path);
      const shared = support.get(artifact.path);
      let contents = artifact.contents;
      if (declaration && Object.hasOwn(library.manifest.imports, declaration.id)) {
        const owner = owners.get(JSON.stringify([id, declaration.id]))!;
        const target = path.posix.join(
          directories.get(owner.library.manifest.id)!,
          owner.declaration.path
        );
        contents = `// Explicit nominal import; canonical owner ${JSON.stringify(owner.library.manifest.id)}.\nexport { ${owner.declaration.symbol} as ${declaration.symbol} } from ${JSON.stringify(moduleSpecifier(destination, target))};\n`;
      } else if (shared) {
        contents = `// Shared support ABI ${JSON.stringify(shared.abi)} version ${shared.version}.\nexport * from ${JSON.stringify(moduleSpecifier(destination, sharedPaths.get(shared.abi)!))};\n`;
      }
      local.set(artifact.path, { ...artifact, contents });
    }
    const linkage = {
      format: COMPILER_LINK_FORMAT,
      version: COMPILER_LINK_VERSION,
      library: id,
      inputManifestSha256: artifactDigest(JSON.stringify(library.manifest)),
      declarations: linkedDeclarations.filter((declaration) => declaration.library === id),
      sharedSupport: library.manifest.support.map((item) => ({
        ...item,
        linkedPath: sharedPaths.get(item.abi),
      })),
    };
    const refreshed = refreshLibraryProvenance([...local.values()], { linkage });
    if (!refreshed.ok) return refreshed;
    for (const artifact of refreshed.value)
      files.set(path.posix.join(directory, artifact.path), {
        ...artifact,
        path: path.posix.join(directory, artifact.path),
      });
  }
  const artifacts = [...files.values()].sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0
  );
  artifacts.push({
    path: COMPILER_LINK_MANIFEST,
    kind: 'manifest',
    contents:
      JSON.stringify(
        {
          format: COMPILER_LINK_FORMAT,
          version: COMPILER_LINK_VERSION,
          profile: libraries[0].manifest.profile,
          irVersion: libraries[0].manifest.irVersion,
          libraries: libraries.map((library) => ({
            directory: directories.get(library.manifest.id),
            manifest: library.manifest,
          })),
          declarations: linkedDeclarations,
          artifacts: artifacts.map((artifact) => ({
            path: artifact.path,
            kind: artifact.kind,
            sha256: artifactDigest(artifact.contents),
          })),
        },
        null,
        2
      ) + '\n',
  });
  const invalid = validateArtifacts(artifacts);
  if (invalid) return libraryRejection('PUI4201', invalid);
  return { ok: true, value: { artifacts, entries, declarations: linkedDeclarations } };
}

export async function writeLinkedCompilerLibraries(
  libraries: readonly CompilerLibrary[],
  directory: string,
  options: CompilerLinkOptions = {},
  openExclusive?: (filename: string) => Promise<ExclusiveOutputFile>
): Promise<
  CompileResult<{ directory: string; files: string[]; entries: LinkedCompilerLibraries['entries'] }>
> {
  const planned = linkCompilerLibraries(libraries, options);
  if (!planned.ok) return planned;
  const written = await writeArtifactSet(planned.value.artifacts, directory, openExclusive);
  return written.ok
    ? { ok: true, value: { ...written.value, entries: planned.value.entries } }
    : written;
}
