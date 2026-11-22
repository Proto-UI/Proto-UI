import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { compileFile, type Compilation } from './compile';
import { CompilerRejection } from './diagnostics';
import { IR_VERSION, type CompileResult, type CompilerDiagnostic, type SourceSpan } from './ir';
import { sourceName } from './source-resolution';
import { FileSourceGraph, type ParsedFileSource, type SourceRootIdentity } from './source-loader';
import {
  gpuiNativeSdkInputPaths,
  gpuiNativeSdkPathLinks,
  verifyGpuiNativeSdk,
} from './gpui-native-sdk-compatibility';

export interface CompileProjectOptions {
  root: string;
  /** Explicit logical identities survive relocating reviewed source checkouts. */
  sourceRootIdentities?: readonly SourceRootIdentity[];
  entries: readonly string[];
  profile?: string;
  exportName?: string;
  componentName?: string;
  /** Per-entry host delivery choices; keys use the same root-relative identity as entries. */
  entryOptions?: Readonly<Record<string, { componentName?: string; rootTag?: string }>>;
  nativeSdkPath?: string;
  gpuiDependency?: 'workspace';
  /** Explicit identity/watch inputs; the project compiler does not interpret configuration files. */
  configFiles?: readonly string[];
}

export interface ProjectEntryCompilation {
  entry: string;
  compilation: Compilation;
  cacheHit: boolean;
}

export interface SuccessfulProjectGeneration {
  readonly revision: number;
  readonly identity: string;
  readonly entries: readonly ProjectEntryCompilation[];
  readonly dependencies: readonly string[];
}

export interface ProjectCompilation extends SuccessfulProjectGeneration {
  project: CompilerProject;
}

export type ProjectCompileResult =
  | { ok: true; value: ProjectCompilation }
  | {
      ok: false;
      diagnostics: CompilerDiagnostic[];
      project: CompilerProject;
      dependencies: readonly string[];
    };

export interface ProjectAttempt {
  readonly revision: number;
  readonly ok: boolean;
  readonly dependencies: readonly string[];
  readonly diagnostics: readonly CompilerDiagnostic[];
}

interface CachedCompilation {
  identity: string;
  compilation: Compilation;
}

// Retain at most one result per entry and a bounded LRU of source-edge parses. The
// active graph and last successful generation necessarily describe the requested project.
const PROJECT_CACHE_SCHEMA = 2;
const span = (file: string): SourceSpan => ({
  file,
  start: 0,
  end: 0,
  line: 1,
  column: 1,
  endLine: 1,
  endColumn: 1,
});
const hash = (value: string | Uint8Array): string =>
  createHash('sha256').update(value).digest('hex');

function diagnostic(error: unknown, file: string): CompilerDiagnostic {
  if (error instanceof CompilerRejection) return error.diagnostic;
  return {
    code: 'PUI4101',
    category: 'invalid-input',
    message: error instanceof Error ? error.message : String(error),
    span: span(file),
  };
}

/** State belongs to this source root, never to a process-global compiler cache. */
export class CompilerProject {
  readonly root: string;
  private readonly sourceCache = new Map<string, ParsedFileSource>();
  private compilationCache = new Map<string, CachedCompilation>();
  private currentDependencies: readonly string[] = [];
  private currentDependencyRoots: readonly string[] = [];
  private currentNativeSdkRoots: readonly string[] = [];
  private currentResolutionFiles: readonly string[] = [];
  private currentGraph: ReadonlyMap<string, readonly string[]> = new Map();
  private successful: SuccessfulProjectGeneration | undefined;
  private attempt: ProjectAttempt | undefined;
  private revision = 0;
  private pending: Promise<unknown> = Promise.resolve();

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  /** Attempted source/config closure and local-resolution candidates, including missing paths. */
  get dependencies(): readonly string[] {
    return this.currentDependencies;
  }
  /** Canonical package directories explicitly reached through an authored source export. */
  get dependencyRoots(): readonly string[] {
    return this.currentDependencyRoots;
  }
  /** Explicit native SDK inventories, including lexical and canonical ancestor-link paths. */
  get nativeSdkRoots(): readonly string[] {
    return this.currentNativeSdkRoots;
  }
  /** Exact package.json lookup paths, including missing candidates; never a directory scan. */
  get resolutionFiles(): readonly string[] {
    return this.currentResolutionFiles;
  }
  get graph(): ReadonlyMap<string, readonly string[]> {
    return this.currentGraph;
  }
  get lastSuccessful(): SuccessfulProjectGeneration | undefined {
    return this.successful;
  }
  get lastAttempt(): ProjectAttempt | undefined {
    return this.attempt;
  }

  /** @internal Serialize attempts that intentionally share the same project. */
  compile(options: CompileProjectOptions): Promise<ProjectCompileResult> {
    const result = this.pending.then(() => this.compileAttempt(options));
    this.pending = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  private async compileAttempt(options: CompileProjectOptions): Promise<ProjectCompileResult> {
    const revision = ++this.revision;
    const sources = new FileSourceGraph(this.root, this.sourceCache, options.sourceRootIdentities);
    const dependencies = sources.dependencies;
    const diagnostics: CompilerDiagnostic[] = [];
    const entryResults: ProjectEntryCompilation[] = [];
    const nextCache = new Map<string, CachedCompilation>();
    const configuration: [string, string][] = [];
    const entries: string[] = [];
    const sdkRoots: string[] = [];
    const sdkResolutionFiles: string[] = [];
    const identities: [string, string][] = [];
    const relativeName = (filename: string): string =>
      sourceName(
        path.relative(this.root, path.resolve(this.root, filename)).split(path.sep).join('/')
      );

    try {
      if ((await realpath(this.root)) !== this.root)
        throw new Error('Project root changed since the project was created.');
      for (const filename of options.entries) {
        const relative = relativeName(filename);
        dependencies.add(relative);
        entries.push(relative);
      }
      if (!entries.length) throw new Error('A compiler project requires at least one entry.');
      if (new Set(entries).size !== entries.length)
        throw new Error('Project entries must be unique.');
      if (Object.keys(options.entryOptions ?? {}).some((entry) => !entries.includes(entry)))
        throw new Error('Per-entry compiler options must name a requested project entry.');
    } catch (error) {
      diagnostics.push(diagnostic(error, '<project>'));
    }

    for (const filename of [...new Set(options.configFiles ?? [])].sort()) {
      try {
        const relative = relativeName(filename);
        dependencies.add(relative);
        const absolute = await realpath(path.resolve(this.root, relative));
        const canonical = relativeName(absolute);
        dependencies.add(canonical);
        configuration.push([
          relative,
          hash(JSON.stringify([canonical, hash(await readFile(absolute))])),
        ]);
      } catch (error) {
        diagnostics.push(diagnostic(error, '<project>'));
      }
    }
    // Shared SDK bytes are outside the authored source graph. Recheck them on every
    // attempt, including an entry cache hit, and expose their explicit input closure
    // to watch so a same-version SDK edit cannot retain a successful generation.
    if (
      options.profile === 'gpui-source-v1' &&
      options.nativeSdkPath &&
      path.isAbsolute(options.nativeSdkPath)
    ) {
      const directory = path.resolve(options.nativeSdkPath);
      sdkRoots.push(directory);
      for (const filename of gpuiNativeSdkInputPaths(directory)) dependencies.add(filename);
      try {
        for (const link of await gpuiNativeSdkPathLinks(directory)) {
          dependencies.add(link);
          sdkResolutionFiles.push(link);
        }
      } catch (error) {
        diagnostics.push(diagnostic(error, directory));
      }
      try {
        const canonical = await realpath(directory);
        if (canonical !== directory) {
          // Retain this coverage even when content verification fails, so fixing
          // the real files behind an ancestor link can recover the next generation.
          sdkRoots.push(canonical);
          for (const filename of gpuiNativeSdkInputPaths(canonical)) dependencies.add(filename);
        }
      } catch {
        /* Missing SDK paths remain watched through their existing ancestors. */
      }
      const sdk = await verifyGpuiNativeSdk(directory, options.gpuiDependency === 'workspace');
      if (!sdk.ok) diagnostics.push(...sdk.diagnostics);
      else {
        configuration.push([
          directory,
          hash(JSON.stringify([sdk.value.directory, sdk.value.identity.contentSha256])),
        ]);
      }
    }
    const configurationFailed = diagnostics.length > 0;

    const configIdentity = hash(
      JSON.stringify({
        schema: PROJECT_CACHE_SCHEMA,
        ir: IR_VERSION,
        profile: options.profile ?? 'react-runtime-v1',
        exportName: options.exportName ?? 'default',
        componentName: options.componentName ?? null,
        entryOptions: options.entryOptions ?? null,
        nativeSdkPath: options.nativeSdkPath ?? null,
        gpuiDependency: options.gpuiDependency ?? null,
        configuration,
      })
    );

    for (const requestedEntry of entries) {
      try {
        const location = await sources.entry(requestedEntry);
        const closure = await sources.load(location);
        const entry = closure.entry;
        if (closure.failures.length) throw closure.failures[0];
        if (configurationFailed) continue;
        const identity = hash(JSON.stringify([configIdentity, entry, closure.identity]));
        identities.push([requestedEntry, identity]);
        const cached = this.compilationCache.get(requestedEntry);
        let result: CompileResult<Compilation>;
        if (cached?.identity === identity) {
          result = { ok: true, value: cached.compilation };
        } else {
          result = await compileFile(location.file, {
            root: this.root,
            profile: options.profile,
            exportName: options.exportName,
            componentName:
              options.entryOptions?.[requestedEntry]?.componentName ?? options.componentName,
            rootTag: options.entryOptions?.[requestedEntry]?.rootTag,
            nativeSdkPath: options.nativeSdkPath,
            gpuiDependency: options.gpuiDependency,
            sourceSnapshot: closure,
          });
        }
        if (!result.ok) {
          diagnostics.push(...result.diagnostics);
          continue;
        }
        entryResults.push({
          entry: requestedEntry,
          compilation: result.value,
          cacheHit: cached?.identity === identity,
        });
        nextCache.set(requestedEntry, { identity, compilation: result.value });
      } catch (error) {
        diagnostics.push(diagnostic(error, requestedEntry));
      }
    }

    this.currentDependencies = [...dependencies].sort();
    this.currentDependencyRoots = [...sources.dependencyRoots, ...sdkRoots].sort();
    this.currentNativeSdkRoots = sdkRoots;
    this.currentResolutionFiles = [...sources.resolutionFiles, ...sdkResolutionFiles].sort();
    this.currentGraph = sources.graph;
    this.attempt = {
      revision,
      ok: !diagnostics.length,
      dependencies: this.currentDependencies,
      diagnostics,
    };
    if (diagnostics.length) {
      return { ok: false, diagnostics, project: this, dependencies: this.currentDependencies };
    }
    // Commit generation and entry caches together only after every entry succeeded.
    // Failed attempts may update graph parses, but never publish partial generation.
    this.compilationCache = nextCache;
    this.successful = {
      revision,
      identity: hash(JSON.stringify([configIdentity, identities])),
      entries: entryResults,
      dependencies: this.currentDependencies,
    };
    return { ok: true, value: { ...this.successful, project: this } };
  }
}

/** Compile an entire requested generation without writing any artifacts. */
export async function compileProject(
  options: CompileProjectOptions,
  previous?: CompilerProject
): Promise<ProjectCompileResult> {
  let root = path.resolve(options.root);
  try {
    root = await realpath(root);
  } catch {
    /* The attempt reports the filesystem failure. */
  }
  const project = previous?.root === root ? previous : new CompilerProject(root);
  return project.compile(options);
}
