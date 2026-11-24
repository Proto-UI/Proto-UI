import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import {
  isLocalSourceSpecifier,
  localSourceBase,
  localSourceCandidates,
  resolveLocalSource,
  runtimeSourceEdges,
  sourceName,
  MissingLocalSourceError,
} from './source-resolution';
import { requiredTypeSourceSpecifiers } from './source-type-resolution';

const hash = (value: string | Uint8Array): string =>
  createHash('sha256').update(value).digest('hex');
const slash = (value: string): string => value.split(path.sep).join('/');
const inside = (root: string, file: string): boolean => {
  const relative = path.relative(root, file);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
};
const missing = (error: unknown): boolean =>
  !!error &&
  typeof error === 'object' &&
  'code' in error &&
  (error.code === 'ENOENT' || error.code === 'ENOTDIR');
const MAX_SOURCE_CACHE = 512;

/** Explicit build identity for one canonical external source tree. Identity is
 * independent of checkout location; distinct trees must never share it. */
export interface SourceRootIdentity {
  readonly root: string;
  readonly identity: string;
}

export interface ParsedFileSource {
  digest: string;
  runtimeSpecifiers: readonly string[];
  typeSpecifiers: readonly string[];
  exportedTypeSpecifiers: readonly string[];
}
interface SourceLocation {
  identity: string;
  file: string;
  root: string;
  relative: string;
}
interface ReadSource extends ParsedFileSource {
  text: string;
}
interface PackageInput {
  manifest: string;
  sha256: string;
}
interface PackageOwner {
  root: string;
  manifest: Record<string, unknown>;
  record: PackageInput;
}
interface ResolvedEdge {
  specifier: string;
  target?: SourceLocation;
  /** Both successful manifests and absent nearer candidates affect resolution. */
  inputs: readonly (readonly [string, string | null])[];
  packages: readonly PackageInput[];
}
export interface FileSourceSnapshot {
  entry: string;
  files: Readonly<Record<string, string>>;
  sourceImports?: Readonly<Record<string, string>>;
  sourceResolution?: {
    version: 1;
    imports: Readonly<Record<string, string>>;
    packages: readonly PackageInput[];
  };
}
export interface LoadedFileClosure extends FileSourceSnapshot {
  identity: string;
  failures: readonly unknown[];
}

function packageSpecifier(specifier: string): { name: string; subpath: string } | undefined {
  if (isLocalSourceSpecifier(specifier)) return undefined;
  const parts = specifier.split('/');
  const length = specifier.startsWith('@') ? 2 : 1;
  if (
    parts.length < length ||
    parts.some(
      (part, index) =>
        !part ||
        part === '.' ||
        part === '..' ||
        !(index === 0 && length === 2 ? /^@[\w.-]+$/ : /^[\w.-]+$/).test(part)
    )
  )
    return undefined;
  return {
    name: parts.slice(0, length).join('/'),
    subpath: parts.length === length ? '.' : `./${parts.slice(length).join('/')}`,
  };
}

/** Select only the explicit authored-source condition, never a guessed dist/src pair. */
function sourceExport(exports: unknown, subpath: string, name: string): string | undefined {
  let entry = exports;
  let substitution: string | undefined;
  if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
    const fields = Object.keys(entry);
    if (fields.some((field) => field.startsWith('.'))) {
      if (!fields.every((field) => field === '.' || field.startsWith('./')))
        throw new Error(`Package ${name} mixes export subpaths and conditions.`);
      const table = entry as Record<string, unknown>;
      if (Object.hasOwn(table, subpath)) entry = table[subpath];
      else {
        const patterns = fields
          .filter((field) => {
            const star = field.indexOf('*');
            return (
              star >= 0 &&
              field.indexOf('*', star + 1) < 0 &&
              subpath.length >= field.length - 1 &&
              subpath.startsWith(field.slice(0, star)) &&
              subpath.endsWith(field.slice(star + 1))
            );
          })
          .sort(
            (left, right) =>
              right.indexOf('*') - left.indexOf('*') ||
              right.length - left.length ||
              left.localeCompare(right)
          );
        if (!patterns.length) return undefined;
        const pattern = patterns[0];
        const star = pattern.indexOf('*');
        substitution = subpath.slice(star, subpath.length - (pattern.length - star - 1));
        entry = table[pattern];
      }
    } else if (subpath !== '.') return undefined;
  } else if (subpath !== '.') return undefined;

  let target: unknown;
  let explicitCondition = false;
  if (
    entry &&
    typeof entry === 'object' &&
    !Array.isArray(entry) &&
    Object.hasOwn(entry, 'proto')
  ) {
    explicitCondition = true;
    target = (entry as Record<string, unknown>).proto;
    if (typeof target !== 'string')
      throw new Error(`Package ${name} proto export ${subpath} must be one static source path.`);
  } else if (typeof entry === 'string' && entry.endsWith('.proto.ts')) target = entry;
  else return undefined;
  if (typeof target !== 'string') return undefined;
  const selected = substitution === undefined ? target : target.replaceAll('*', substitution);
  const segments = selected.slice(2).split('/');
  if (
    !selected.startsWith('./') ||
    !selected.endsWith('.ts') ||
    selected.endsWith('.d.ts') ||
    /[\\\0%?#*]/.test(selected) ||
    segments.some(
      (segment) => !segment || segment === '.' || segment === '..' || segment === 'node_modules'
    )
  )
    throw new Error(
      `Package ${name} ${explicitCondition ? 'proto ' : ''}export ${subpath} must name a TypeScript source file inside its package.`
    );
  return selected;
}

/** One read attempt. It records exact filesystem dependencies, without importing input code. */
export class FileSourceGraph {
  readonly dependencies = new Set<string>();
  readonly dependencyRoots = new Set<string>();
  readonly resolutionFiles = new Set<string>();
  readonly graph = new Map<string, readonly string[]>();
  private readonly locations = new Map<string, SourceLocation>();
  private readonly reads = new Map<string, Promise<ReadSource>>();
  private readonly resolutions = new Map<string, Promise<ResolvedEdge>>();
  private readonly packageOwners = new Map<string, PackageOwner>();
  private readonly canonicalIdentityRoots: SourceRootIdentity[] = [];
  private readonly logicalLocations = new Map<string, string>();
  private identityRootsReady: Promise<void> | undefined;

  constructor(
    readonly root: string,
    private readonly cache = new Map<string, ParsedFileSource>(),
    private readonly identityRoots: readonly SourceRootIdentity[] = []
  ) {}

  private initializeIdentityRoots(): Promise<void> {
    return (this.identityRootsReady ??= (async () => {
      if (!Array.isArray(this.identityRoots))
        throw new Error('Source root identities require an explicit array of root/identity pairs.');
      for (const declared of this.identityRoots) {
        if (
          !declared ||
          typeof declared !== 'object' ||
          typeof declared.root !== 'string' ||
          !declared.root ||
          typeof declared.identity !== 'string' ||
          !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(declared.identity)
        )
          throw new Error(
            'A source root identity requires a directory and a stable nonempty identifier.'
          );
        const requested = path.resolve(this.root, declared.root);
        this.dependency(requested);
        const root = await realpath(requested);
        this.dependency(root);
        if (!(await stat(root)).isDirectory())
          throw new Error('A source identity root must be a directory.');
        if (inside(root, this.root) || inside(this.root, root))
          throw new Error('Explicit source identity roots must be disjoint from the project root.');
        if (
          this.canonicalIdentityRoots.some(
            (other) =>
              other.identity === declared.identity ||
              inside(other.root, root) ||
              inside(root, other.root)
          )
        )
          throw new Error(
            'Source root identities must be a bijection over disjoint canonical roots.'
          );
        this.canonicalIdentityRoots.push({ root, identity: declared.identity });
      }
      this.canonicalIdentityRoots.sort((a, b) => a.identity.localeCompare(b.identity));
    })());
  }

  /** Only logical provenance changes. Dependency/watch records retain physical paths. */
  private logicalPath(file: string): string {
    const owner = this.canonicalIdentityRoots.find((candidate) => inside(candidate.root, file));
    const identity = owner
      ? `.proto-ui/source-roots/${owner.identity}/${slash(path.relative(owner.root, file))}`
      : slash(path.relative(this.root, file));
    const existing = this.logicalLocations.get(identity);
    if (existing && existing !== file)
      throw new Error(`Conflicting logical source location ${identity}.`);
    this.logicalLocations.set(identity, file);
    return identity;
  }

  private dependency(file: string): void {
    this.dependencies.add(inside(this.root, file) ? slash(path.relative(this.root, file)) : file);
  }

  private register(file: string, boundary: string): SourceLocation {
    if (!inside(boundary, file))
      throw new Error('Source escapes its declared filesystem boundary.');
    const relative = sourceName(slash(path.relative(boundary, file)));
    const identity = inside(this.root, file)
      ? sourceName(slash(path.relative(this.root, file)))
      : `.proto-ui/source-packages/${hash(this.logicalPath(boundary)).slice(0, 24)}/${relative}`;
    const existing = this.locations.get(identity);
    if (existing && existing.file !== file)
      throw new Error(`Conflicting source identity ${identity}.`);
    if (existing) {
      // A package's explicit boundary is narrower than the project that contains it.
      if (inside(existing.root, boundary)) {
        existing.root = boundary;
        existing.relative = relative;
      }
      return existing;
    }
    const location = { identity, file, root: boundary, relative };
    this.locations.set(identity, location);
    return location;
  }

  async entry(filename: string): Promise<SourceLocation> {
    await this.initializeIdentityRoots();
    const requested = path.resolve(this.root, filename);
    sourceName(slash(path.relative(this.root, requested)));
    this.dependency(requested);
    const canonical = await realpath(requested);
    if (!inside(this.root, canonical))
      throw new Error(`Entry ${filename} escapes the declared project root.`);
    if (!(await stat(canonical)).isFile())
      throw new Error(`Entry ${filename} is not a source file.`);
    return this.register(canonical, this.root);
  }

  private read(location: SourceLocation): Promise<ReadSource> {
    const previous = this.reads.get(location.identity);
    if (previous) return previous;
    const current = (async (): Promise<ReadSource> => {
      this.dependency(location.file);
      if ((await realpath(location.file)) !== location.file)
        throw new Error(`Source identity changed while reading ${location.identity}.`);
      const bytes = await readFile(location.file);
      const text = bytes.toString('utf8');
      const digest = hash(bytes);
      let parsed = this.cache.get(location.identity);
      if (parsed?.digest === digest) this.cache.delete(location.identity);
      else {
        const file = ts.createSourceFile(
          location.identity,
          text,
          ts.ScriptTarget.Latest,
          true,
          ts.ScriptKind.TS
        );
        parsed = {
          digest,
          runtimeSpecifiers: [...new Set(runtimeSourceEdges(file).map((edge) => edge.specifier))],
          typeSpecifiers: [...requiredTypeSourceSpecifiers(file, false)],
          exportedTypeSpecifiers: [...requiredTypeSourceSpecifiers(file)],
        };
      }
      this.cache.set(location.identity, parsed);
      if (this.cache.size > MAX_SOURCE_CACHE) this.cache.delete(this.cache.keys().next().value!);
      return { ...parsed, text };
    })();
    this.reads.set(location.identity, current);
    return current;
  }

  private resolve(location: SourceLocation, specifier: string): Promise<ResolvedEdge> {
    const key = JSON.stringify([location.identity, specifier]);
    const previous = this.resolutions.get(key);
    if (previous) return previous;
    const current = (async (): Promise<ResolvedEdge> => {
      if (isLocalSourceSpecifier(specifier)) {
        const base = localSourceBase(location.relative, specifier);
        for (const candidate of localSourceCandidates(base))
          this.dependency(path.resolve(location.root, candidate));
        const relative = await resolveLocalSource(location.root, location.relative, specifier);
        return {
          specifier,
          target: this.register(path.resolve(location.root, relative), location.root),
          inputs: [],
          packages: [],
        };
      }
      const parsed = packageSpecifier(specifier);
      if (!parsed) return { specifier, inputs: [], packages: [] };
      const inputs: [string, string | null][] = [];
      const select = async (owner: PackageOwner): Promise<ResolvedEdge> => {
        inputs.push([owner.record.manifest, owner.record.sha256]);
        const target = sourceExport(owner.manifest.exports, parsed.subpath, parsed.name);
        if (!target) return { specifier, inputs, packages: [owner.record] };
        this.dependencyRoots.add(owner.root);
        const requested = path.resolve(owner.root, target);
        this.dependency(requested);
        const canonical = await realpath(requested);
        if (!inside(owner.root, canonical))
          throw new Error(`Package ${parsed.name} source export escapes its package.`);
        if (!(await stat(canonical)).isFile())
          throw new Error(`Package ${parsed.name} source export is not a regular file.`);
        return {
          specifier,
          target: this.register(canonical, owner.root),
          inputs,
          packages: [owner.record],
        };
      };
      const owner = this.packageOwners.get(location.root);
      if (owner?.manifest.name === parsed.name) return select(owner);
      let directory = path.dirname(location.file);
      for (;;) {
        const candidate = path.join(directory, 'node_modules', parsed.name, 'package.json');
        this.resolutionFiles.add(candidate);
        this.dependency(candidate);
        let manifestFile: string;
        try {
          manifestFile = await realpath(candidate);
        } catch (error) {
          if (!missing(error)) throw error;
          inputs.push([this.logicalPath(candidate), null]);
          const parent = path.dirname(directory);
          if (parent === directory) return { specifier, inputs, packages: [] };
          directory = parent;
          continue;
        }
        this.resolutionFiles.add(manifestFile);
        this.dependency(manifestFile);
        const packageRoot = await realpath(path.join(directory, 'node_modules', parsed.name));
        if (!inside(packageRoot, manifestFile))
          throw new Error(`Package ${parsed.name} manifest escapes its package.`);
        const bytes = await readFile(manifestFile);
        const manifest = JSON.parse(bytes.toString('utf8')) as Record<string, unknown>;
        if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest))
          throw new Error(`Package ${parsed.name} has no static package.json object.`);
        const record = {
          manifest: this.logicalPath(manifestFile),
          sha256: hash(bytes),
        };
        const packageOwner = { root: packageRoot, manifest, record };
        this.packageOwners.set(packageRoot, packageOwner);
        return select(packageOwner);
      }
    })();
    this.resolutions.set(key, current);
    return current;
  }

  async load(entry: SourceLocation): Promise<LoadedFileClosure> {
    await this.initializeIdentityRoots();
    const files: Record<string, string> = Object.create(null);
    const imports: Record<string, string> = Object.create(null);
    const packages = new Map<string, PackageInput>();
    // Runtime imports and imported type surfaces are independent demands. The
    // entry's unused type re-exports do not require filesystem source, while a
    // downstream type import must still resolve its complete barrel chain.
    const visited = new Map<string, number>();
    const records = new Map<string, unknown>();
    const failures: unknown[] = [];
    const visit = async (
      location: SourceLocation,
      runtime: boolean,
      typeSurface = false
    ): Promise<void> => {
      const previous = visited.get(location.identity) ?? 0;
      const demand = previous | (runtime ? 1 : 0) | (typeSurface ? 2 : 0);
      if (previous === demand) return;
      visited.set(location.identity, demand);
      const source = await this.read(location);
      files[location.identity] = source.text;
      const runtimeNames = new Set(demand & 1 ? source.runtimeSpecifiers : []);
      const typeNames = new Set(demand & 2 ? source.exportedTypeSpecifiers : source.typeSpecifiers);
      const specifiers = [...new Set([...runtimeNames, ...typeNames])];
      const edges: {
        specifier: string;
        target?: string;
        inputs: ResolvedEdge['inputs'];
        runtime: boolean;
      }[] = [];
      for (const specifier of specifiers) {
        try {
          const edge = await this.resolve(location, specifier);
          for (const input of edge.packages) packages.set(input.manifest, input);
          edges.push({
            specifier,
            target: edge.target?.identity,
            inputs: edge.inputs,
            runtime: runtimeNames.has(specifier),
          });
          if (!edge.target) continue;
          if (!isLocalSourceSpecifier(specifier)) {
            if (Object.hasOwn(imports, specifier) && imports[specifier] !== edge.target.identity)
              throw new Error(
                `Source package ${specifier} resolves to different owners in one closed graph; distinct package specifiers are required.`
              );
            imports[specifier] = edge.target.identity;
          }
          await visit(edge.target, runtimeNames.has(specifier), typeNames.has(specifier));
        } catch (error) {
          if (error instanceof MissingLocalSourceError && !runtimeNames.has(specifier)) {
            // Import aliases and re-exports can name unrelated types. Keep the
            // absent lookup in the graph; resolveSourceType diagnoses it when
            // an admitted annotation actually selects the missing declaration.
            edges.push({ specifier, inputs: [], runtime: false });
          } else failures.push(error);
        }
      }
      if (visited.get(location.identity) === demand) {
        this.graph.set(
          location.identity,
          [
            ...new Set([
              ...(this.graph.get(location.identity) ?? []),
              ...edges.flatMap((edge) => (edge.target ? [edge.target] : [])),
            ]),
          ].sort()
        );
        records.set(location.identity, {
          digest: source.digest,
          runtime: !!(demand & 1),
          typeSurface: !!(demand & 2),
          edges,
        });
      }
    };
    try {
      await visit(entry, true);
    } catch (error) {
      failures.push(error);
    }
    const sourceResolution = {
      version: 1 as const,
      imports: Object.fromEntries(
        Object.entries(imports).sort(([left], [right]) => left.localeCompare(right))
      ),
      packages: [...packages.values()].sort((left, right) =>
        left.manifest.localeCompare(right.manifest)
      ),
    };
    return {
      entry: entry.identity,
      files,
      sourceImports: imports,
      sourceResolution,
      identity: hash(
        JSON.stringify([...records.entries()].sort(([left], [right]) => left.localeCompare(right)))
      ),
      failures,
    };
  }
}
