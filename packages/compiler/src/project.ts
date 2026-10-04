import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { compileFile } from './compile';
import type { Compilation } from './memory';
import { CompilerRejection } from './diagnostics';
import { IR_VERSION, type CompileResult, type CompilerDiagnostic, type SourceSpan } from './ir';
import {
  isLocalSourceSpecifier,
  localSourceBase,
  localSourceCandidates,
  resolveLocalSource,
  runtimeSourceEdges,
  sourceName,
} from './source-resolution';

export interface CompileProjectOptions {
  root: string;
  entries: readonly string[];
  profile?: string;
  exportName?: string;
  componentName?: string;
  nativeSdkPath?: string;
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

interface ParsedSource {
  digest: string;
  specifiers: readonly string[];
}
interface LoadedSource extends ParsedSource {
  text: string;
  edges: readonly { specifier: string; target: string }[];
  failures: readonly unknown[];
}
interface CachedCompilation {
  identity: string;
  compilation: Compilation;
}

// Retain at most one result per entry and a bounded LRU of source-edge parses. The
// active graph and last successful generation necessarily describe the requested project.
const MAX_SOURCE_CACHE = 512;
const PROJECT_CACHE_SCHEMA = 1;
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
  private readonly sourceCache = new Map<string, ParsedSource>();
  private compilationCache = new Map<string, CachedCompilation>();
  private currentDependencies: readonly string[] = [];
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
    const dependencies = new Set<string>();
    const loaded = new Map<string, Promise<LoadedSource>>();
    const graph = new Map<string, readonly string[]>();
    const diagnostics: CompilerDiagnostic[] = [];
    const entryResults: ProjectEntryCompilation[] = [];
    const nextCache = new Map<string, CachedCompilation>();
    const configuration: [string, string][] = [];
    const entries: string[] = [];
    const identities: [string, string][] = [];
    const relativeName = (filename: string): string =>
      sourceName(
        path.relative(this.root, path.resolve(this.root, filename)).split(path.sep).join('/')
      );

    const load = (filename: string): Promise<LoadedSource> => {
      const existing = loaded.get(filename);
      if (existing) return existing;
      const promise = (async (): Promise<LoadedSource> => {
        dependencies.add(filename);
        const absolute = await realpath(path.resolve(this.root, filename));
        const canonical = relativeName(absolute);
        // A resolved identity must remain stable while its bytes are read. A symlink
        // retarget during the attempt cannot silently pair one graph with another file.
        if (canonical !== filename)
          throw new Error(`Source identity changed while reading ${filename}.`);
        const bytes = await readFile(absolute);
        const text = bytes.toString('utf8');
        const digest = hash(bytes);
        const cached = this.sourceCache.get(filename);
        let parsed: ParsedSource;
        if (cached?.digest === digest) {
          parsed = cached;
          this.sourceCache.delete(filename);
        } else {
          const file = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true);
          parsed = {
            digest,
            specifiers: runtimeSourceEdges(file)
              .map((edge) => edge.specifier)
              .filter(isLocalSourceSpecifier),
          };
        }
        this.sourceCache.set(filename, parsed);
        if (this.sourceCache.size > MAX_SOURCE_CACHE)
          this.sourceCache.delete(this.sourceCache.keys().next().value!);
        const edges: { specifier: string; target: string }[] = [];
        const failures: unknown[] = [];
        for (const specifier of parsed.specifiers) {
          try {
            const base = localSourceBase(filename, specifier);
            for (const candidate of localSourceCandidates(base)) dependencies.add(candidate);
            const target = await resolveLocalSource(this.root, filename, specifier);
            dependencies.add(target);
            edges.push({ specifier, target });
          } catch (error) {
            failures.push(error);
          }
        }
        graph.set(filename, [...new Set(edges.map((edge) => edge.target))].sort());
        // Retain resolved siblings even beside broken imports so their transitive
        // dependencies remain watched during a failed attempt.
        return { ...parsed, text, edges, failures };
      })();
      loaded.set(filename, promise);
      return promise;
    };

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
    const configurationFailed = diagnostics.length > 0;

    const configIdentity = hash(
      JSON.stringify({
        schema: PROJECT_CACHE_SCHEMA,
        ir: IR_VERSION,
        profile: options.profile ?? 'react-runtime-v1',
        exportName: options.exportName ?? 'default',
        componentName: options.componentName ?? null,
        nativeSdkPath: options.nativeSdkPath ?? null,
        configuration,
      })
    );

    for (const requestedEntry of entries) {
      try {
        const absolute = await realpath(path.resolve(this.root, requestedEntry));
        const entry = relativeName(absolute);
        const closure = new Map<string, LoadedSource>();
        const visiting = new Set<string>();
        const visit = async (filename: string): Promise<void> => {
          if (visiting.has(filename)) return;
          visiting.add(filename);
          const source = await load(filename);
          closure.set(filename, source);
          const failures: unknown[] = [...source.failures];
          for (const edge of source.edges) {
            try {
              await visit(edge.target);
            } catch (error) {
              failures.push(error);
            }
          }
          if (failures.length) throw failures[0];
        };
        await visit(entry);
        if (configurationFailed) continue;
        const names = [...closure.keys()].sort();
        const identity = hash(
          JSON.stringify([
            configIdentity,
            entry,
            names.map((name) => {
              const source = closure.get(name)!;
              return [name, source.digest, source.edges];
            }),
          ])
        );
        identities.push([requestedEntry, identity]);
        const cached = this.compilationCache.get(requestedEntry);
        let result: CompileResult<Compilation>;
        if (cached?.identity === identity) {
          result = { ok: true, value: cached.compilation };
        } else {
          const files: Record<string, string> = Object.create(null);
          for (const name of names) files[name] = closure.get(name)!.text;
          result = await compileFile(absolute, {
            root: this.root,
            profile: options.profile,
            exportName: options.exportName,
            componentName: options.componentName,
            nativeSdkPath: options.nativeSdkPath,
            sourceSnapshot: { entry, files },
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
    this.currentGraph = graph;
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
