import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { prepareProtoOptions } from './input-profile.ts';
import type {
  ProtoClosureFile,
  ProtoMissingSource,
  ProtoProgramOptions,
  ProtoResolutionProbe,
  ProtoSourceClosure,
  ProtoTarget,
} from './types.ts';
import { PROTO_TARGETS } from './types.ts';

export const LANGUAGE_VERSION = '0.4' as const;
export const RULE_SET_VERSION = '0.4.0-draft.1';
export const COMPILER_VERSION = '0.4.0-frontend.1';
export const PRELUDE_PATH = fileURLToPath(new URL('../../prelude/proto.d.ts', import.meta.url));

interface Snapshot extends Omit<ProtoClosureFile, 'role'> {
  text: string;
}

interface ProgramSnapshot {
  currentDirectory: string;
  roots: string[];
  projectFile: string | null;
  files: Map<string, Snapshot>;
  missing: ProtoMissingSource[];
  resolutions: ProtoSourceClosure['resolutions'];
  resolutionProbes: Map<string, ProtoResolutionProbe>;
  options: ts.CompilerOptions;
}

const snapshots = new WeakMap<ts.Program, ProgramSnapshot>();

function sha256(bytes: string | Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** A deterministic JSON representation, independent of object insertion order. */
export function canonicalJson(value: unknown): string {
  // JSON.stringify(-0) erases an observable numeric distinction in binding
  // configuration. JSON's grammar and JSON.parse both preserve the -0 token.
  if (typeof value === 'number' && Object.is(value, -0)) return '-0';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined && typeof item !== 'function')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function decode(bytes: Buffer): { text: string; encoding: Snapshot['encoding'] } {
  const encoding =
    bytes[0] === 0xff && bytes[1] === 0xfe
      ? 'utf-16le'
      : bytes[0] === 0xfe && bytes[1] === 0xff
        ? 'utf-16be'
        : 'utf-8';
  return { text: new TextDecoder(encoding, { fatal: true }).decode(bytes), encoding };
}

/** The project parser and module resolver share original bytes and existence evidence. */
function snapshotAccess(currentDirectory: string, overrides: ReadonlyMap<string, string>) {
  const absolute = (name: string) => path.resolve(currentDirectory, name);
  const files = new Map<string, Snapshot>();
  const missing: ProtoMissingSource[] = [];
  const resolutionProbes = new Map<string, ProtoResolutionProbe>();
  const recordProbe = (kind: ProtoResolutionProbe['kind'], fileName: string, exists: boolean) => {
    const name = absolute(fileName);
    const key = `${kind}\0${name}`;
    const previous = resolutionProbes.get(key);
    if (previous && previous.exists !== exists) {
      missing.push({
        path: name,
        reason: `The ${kind} lookup changed during source snapshot construction.`,
      });
    } else resolutionProbes.set(key, { path: name, kind, exists });
    return exists;
  };
  const failedReads = new Set<string>();
  const read = (fileName: string): string | undefined => {
    const name = absolute(fileName);
    const cached = files.get(name);
    if (cached) return cached.text;
    if (failedReads.has(name)) return undefined;
    try {
      const replacement = overrides.get(name);
      // An editor string with an unpaired raw surrogate cannot be encoded as
      // UTF-8 without altering the input. Preserve that as an unavailable input.
      if (replacement !== undefined && !replacement.isWellFormed()) {
        throw new Error(
          'Editor snapshot contains an unpaired raw surrogate; no lossless UTF-8 snapshot exists.'
        );
      }
      const bytes =
        replacement === undefined ? readFileSync(name) : Buffer.from(replacement, 'utf8');
      const decoded = decode(bytes);
      files.set(name, {
        path: name,
        sha256: sha256(bytes),
        byteLength: bytes.length,
        sourceKind: replacement === undefined ? 'disk' : 'override',
        ...decoded,
      });
      return decoded.text;
    } catch (error) {
      failedReads.add(name);
      // Package/configuration lookups can use readFile without fileExists.
      // Preserve failed reads too, so a newly appearing package.json invalidates
      // the earlier resolution instead of making a stale closure reusable.
      const exists = recordProbe('file', name, overrides.has(name) || ts.sys.fileExists(name));
      if (exists) {
        missing.push({
          path: name,
          reason: `Cannot decode/read source snapshot: ${String(error)}`,
        });
      }
      return undefined;
    }
  };

  const host = {
    ...ts.sys,
    getCurrentDirectory: () => currentDirectory,
    readFile: read,
    fileExists(fileName: string) {
      const name = absolute(fileName);
      return recordProbe('file', name, overrides.has(name) || ts.sys.fileExists(name));
    },
    directoryExists(directory: string) {
      const name = absolute(directory);
      const prefix = name.endsWith(path.sep) ? name : `${name}${path.sep}`;
      for (const file of overrides.keys()) {
        if (file.startsWith(prefix)) return recordProbe('directory', name, true);
      }
      return recordProbe('directory', name, ts.sys.directoryExists(name));
    },
  };
  return { host, files, missing, resolutionProbes };
}

/**
 * Build one controlled, non-executing TS Program. Inputs are read as immutable
 * snapshots; no author module is imported, evaluated or passed to a JS VM.
 */
export function createProtoProgram(input: ProtoProgramOptions): ts.Program {
  const currentDirectory = path.resolve(input.currentDirectory ?? process.cwd());
  const absolute = (name: string) => path.resolve(currentDirectory, name);
  const roots = [...new Set(input.rootNames.map(absolute))];
  const overrides = new Map<string, string>();
  for (const [name, source] of Object.entries(input.sourceOverrides ?? {})) {
    if (!path.isAbsolute(name)) throw new TypeError('sourceOverrides keys must be absolute paths.');
    overrides.set(absolute(name), source);
  }
  if (overrides.has(PRELUDE_PATH)) {
    throw new TypeError('The controlled Proto prelude cannot be replaced by a source override.');
  }
  const access = snapshotAccess(currentDirectory, overrides);
  const project = prepareProtoOptions(input, roots, currentDirectory, access.host);
  let options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    ...project.options,
    // These are invariants, not defaults a client/editor may replace.
    noLib: true,
    types: [],
    typeRoots: [],
    noEmit: true,
    noResolve: false,
    noCheck: false,
    strict: true,
    // Individual flags override the TS `strict` umbrella if supplied by a
    // tsconfig/editor. Fix the actual checking semantics, not just its label.
    strictNullChecks: true,
    noImplicitAny: true,
    noImplicitThis: true,
    strictFunctionTypes: true,
    strictBindCallApply: true,
    strictPropertyInitialization: true,
    strictBuiltinIteratorReturn: true,
    alwaysStrict: true,
    useUnknownInCatchVariables: true,
    skipLibCheck: false,
    skipDefaultLibCheck: false,
    allowJs: false,
    checkJs: false,
    allowNonTsExtensions: true,
    allowImportingTsExtensions: true,
    incremental: false,
    composite: false,
  };
  delete options.lib;
  delete options.configFile;
  if (options.baseUrl) options.baseUrl = absolute(options.baseUrl);
  // Without baseUrl, TS uses the paths-defining config's pathsBasePath and then
  // this host's current directory. Inventing baseUrl here overrides extends.
  options = JSON.parse(canonicalJson(options)) as ts.CompilerOptions;

  const standardLibraryDirectory = path.dirname(ts.getDefaultLibFilePath(options));
  const isAmbientLibrary = (fileName: string) => {
    const name = absolute(fileName);
    const resolved = ts.sys.fileExists(name) ? (ts.sys.realpath?.(name) ?? name) : name;
    return (
      (path.dirname(resolved) === standardLibraryDirectory &&
        /^lib(?:\..*)?\.d\.ts$/.test(path.basename(resolved))) ||
      (resolved.includes(`${path.sep}node_modules${path.sep}`) &&
        resolved.includes(`${path.sep}@types${path.sep}`))
    );
  };

  const data: ProgramSnapshot = {
    currentDirectory,
    roots,
    options,
    projectFile: project.projectFile,
    files: access.files,
    missing: access.missing,
    resolutions: [],
    resolutionProbes: access.resolutionProbes,
  };
  const host = ts.createCompilerHost(options, true);
  host.getCurrentDirectory = access.host.getCurrentDirectory;
  host.getDefaultLibFileName = () => PRELUDE_PATH;
  host.fileExists = access.host.fileExists;
  host.directoryExists = access.host.directoryExists;
  host.readFile = access.host.readFile;
  host.getSourceFile = (name, languageVersion, onError) => {
    if (isAmbientLibrary(name)) {
      data.missing.push({
        path: absolute(name),
        reason: 'Ambient standard/host declarations are outside the controlled Proto prelude.',
      });
      return undefined;
    }
    const text = access.host.readFile(name);
    if (text === undefined) {
      onError?.(`Cannot read ${name}`);
      return undefined;
    }
    const source = ts.createSourceFile(absolute(name), text, languageVersion, true);
    for (const reference of source.referencedFiles) {
      const resolved = path.resolve(path.dirname(absolute(name)), reference.fileName);
      const available = host.fileExists(resolved);
      data.resolutions.push({
        from: absolute(name),
        specifier: reference.fileName,
        resolutionMode: null,
        resolvedPath: available ? resolved : null,
      });
      if (!available) {
        data.missing.push({
          from: absolute(name),
          specifier: reference.fileName,
          path: resolved,
          reason: 'Referenced source/declaration is unavailable.',
        });
      }
    }
    for (const reference of source.libReferenceDirectives) {
      data.missing.push({
        from: absolute(name),
        specifier: reference.fileName,
        reason: 'A standard-library reference is not provided by the controlled Proto prelude.',
      });
    }
    return source;
  };
  host.writeFile = () => {
    throw new Error('The Proto analysis service never emits files.');
  };
  host.resolveModuleNameLiterals = (
    moduleLiterals,
    containingFile,
    redirectedReference,
    resolutionOptions,
    containingSourceFile
  ) =>
    moduleLiterals.map((literal) => {
      const specifier = literal.text;
      // NodeNext and explicit resolution-mode attributes can choose different
      // exports for two uses of the same specifier in the same source file.
      const mode = ts.getModeForUsageLocation(containingSourceFile, literal, resolutionOptions);
      const result = ts.resolveModuleName(
        specifier,
        containingFile,
        resolutionOptions,
        host,
        undefined,
        redirectedReference,
        mode
      );
      const resolved = result.resolvedModule;
      data.resolutions.push({
        from: absolute(containingFile),
        specifier,
        resolutionMode:
          mode === ts.ModuleKind.ESNext
            ? 'import'
            : mode === ts.ModuleKind.CommonJS
              ? 'require'
              : null,
        resolvedPath: resolved ? absolute(resolved.resolvedFileName) : null,
      });
      if (!resolved) {
        data.missing.push({
          from: absolute(containingFile),
          specifier,
          reason: 'Module/declaration could not be resolved; source admission remains incomplete.',
        });
      }
      return result;
    });
  // Explicit reference-types directives must not bypass noLib/types:[] and
  // import ambient Node/DOM declarations. Their missing dependency is visible.
  host.resolveTypeReferenceDirectives = (names, containingFile) =>
    names.map((name) => {
      const specifier = typeof name === 'string' ? name : name.fileName;
      data.missing.push({
        from: containingFile ? absolute(containingFile) : undefined,
        specifier,
        reason: 'Ambient reference-types are not part of the controlled Proto prelude.',
      });
      return undefined;
    });

  const program = ts.createProgram({ rootNames: [PRELUDE_PATH, ...roots], options, host });
  for (const root of roots) {
    if (!program.getSourceFile(root))
      data.missing.push({ path: root, reason: 'Root source is unavailable.' });
  }
  snapshots.set(program, data);
  return program;
}

/** Only factory-created Programs have trustworthy snapshot/configuration metadata. */
export function getProtoSourceClosure(program: ts.Program): ProtoSourceClosure {
  const data = snapshots.get(program);
  if (!data) {
    throw new TypeError(
      'Use createProtoProgram before analyzeProtoProgram; ambient editor Programs are not trusted Proto environments.'
    );
  }
  const fileNames = new Set(program.getSourceFiles().map((file) => path.resolve(file.fileName)));
  const stripText = ({ text: _text, ...file }: Snapshot) => file;
  const files: ProtoClosureFile[] = [];
  const missing = [...data.missing];
  for (const name of [...fileNames].sort()) {
    const snapshot = data.files.get(name);
    if (!snapshot) {
      missing.push({ path: name, reason: 'Loaded source has no original-byte snapshot.' });
      continue;
    }
    files.push({ ...stripText(snapshot), role: name === PRELUDE_PATH ? 'prelude' : 'source' });
  }
  for (const resolution of data.resolutions) {
    if (resolution.resolvedPath && !fileNames.has(resolution.resolvedPath)) {
      missing.push({
        path: resolution.resolvedPath,
        from: resolution.from,
        specifier: resolution.specifier,
        reason: 'Resolved dependency was not included in the checked source closure.',
      });
    }
  }
  const resolutionFiles = [...data.files.values()]
    .filter((file) => !fileNames.has(file.path))
    .map(stripText)
    .sort((a, b) => a.path.localeCompare(b.path));
  const resolutions = [
    ...new Map(data.resolutions.map((entry) => [canonicalJson(entry), entry])).values(),
  ].sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b)));
  const uniqueMissing = [
    ...new Map(missing.map((entry) => [canonicalJson(entry), entry])).values(),
  ].sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b)));
  const resolutionProbes = [...data.resolutionProbes.values()]
    .map((probe) => ({ ...probe }))
    .sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b)));
  const compilerOptions = JSON.parse(canonicalJson(data.options)) as Record<string, unknown>;
  const configuration = {
    currentDirectory: data.currentDirectory,
    compilerOptions,
    languageVersion: LANGUAGE_VERSION,
    ruleSetVersion: RULE_SET_VERSION,
    compilerVersion: COMPILER_VERSION,
    typescriptVersion: ts.version,
    requiredTargets: [...PROTO_TARGETS],
    selectedTarget: null,
  };
  const configurationHash = sha256(canonicalJson(configuration));
  const rootNames = [...data.roots].sort();
  // An identical unsaved editor snapshot and disk file are the same source
  // input. sourceKind is provenance, not a different semantic cache key.
  const digestFiles = files.map(({ sourceKind: _kind, ...file }) => file);
  const digestResolutionFiles = resolutionFiles.map(({ sourceKind: _kind, ...file }) => file);
  const digest = sha256(
    canonicalJson({
      configurationHash,
      projectFile: data.projectFile,
      rootNames,
      files: digestFiles,
      resolutionFiles: digestResolutionFiles,
      resolutions,
      resolutionProbes,
      missing: uniqueMissing,
    })
  );
  return {
    algorithm: 'sha256',
    digest,
    configurationHash,
    complete: uniqueMissing.length === 0,
    rootNames,
    projectFile: data.projectFile,
    files,
    resolutionFiles,
    resolutions,
    resolutionProbes,
    missing: uniqueMissing,
    compilerOptions,
    configuration,
  };
}

/** Target selection identifies an analysis result. Both emitters consume the same source input. */
export function analysisConfigurationHash(
  closure: ProtoSourceClosure,
  target?: ProtoTarget
): string {
  if (target === undefined) return closure.configurationHash;
  return sha256(canonicalJson({ ...closure.configuration, selectedTarget: target }));
}
