import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export interface CompilerSessionOptions {
  readonly rootDir?: string;
  readonly tsconfigPath?: string;
}

/**
 * Reusable TypeScript Program host with cached SourceFiles so compiling dozens
 * or hundreds of prototypes shares one real ts.TypeChecker and completes in ms.
 */
export class TsProgramSession {
  readonly rootDir: string;
  readonly compilerOptions: ts.CompilerOptions;
  private readonly baseHost: ts.CompilerHost;
  private readonly sourceCache = new Map<string, ts.SourceFile>();
  private readonly virtualFiles = new Map<string, string>();
  private program: ts.Program | undefined;
  private rootNames = new Set<string>();

  constructor(options: CompilerSessionOptions = {}) {
    this.rootDir = path.resolve(options.rootDir ?? process.cwd());
    this.compilerOptions = loadCompilerOptions(this.rootDir, options.tsconfigPath);
    this.baseHost = ts.createCompilerHost(this.compilerOptions, true);
  }

  private createHost(): ts.CompilerHost {
    const { baseHost, sourceCache, virtualFiles } = this;
    const norm = (fileName: string) => path.resolve(fileName);

    return {
      ...baseHost,
      getCurrentDirectory: () => this.rootDir,
      fileExists: (fileName) => {
        const key = norm(fileName);
        if (virtualFiles.has(key)) return true;
        return baseHost.fileExists(fileName);
      },
      readFile: (fileName) => {
        const key = norm(fileName);
        const virtual = virtualFiles.get(key);
        if (virtual !== undefined) return virtual;
        return baseHost.readFile(fileName);
      },
      getSourceFile: (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
        const key = norm(fileName);
        const virtual = virtualFiles.get(key);
        if (virtual !== undefined) {
          return ts.createSourceFile(fileName, virtual, languageVersion, true);
        }
        if (!shouldCreateNewSourceFile) {
          const cached = sourceCache.get(key);
          if (cached) return cached;
        }
        const sf = baseHost.getSourceFile(
          fileName,
          languageVersion,
          onError,
          shouldCreateNewSourceFile
        );
        if (sf) sourceCache.set(key, sf);
        return sf;
      },
      writeFile: () => {
        // Compiler frontend never emits TS compiler outputs directly.
      },
    };
  }

  /** Ensure all given real files are present in the active ts.Program. */
  ensureFiles(files: readonly string[]): ts.Program {
    const resolved = files.map((f) => path.resolve(this.rootDir, f));
    let dirty = !this.program;
    for (const file of resolved) {
      if (!this.rootNames.has(file)) {
        this.rootNames.add(file);
        dirty = true;
      }
    }
    if (!dirty && this.program) return this.program;
    this.program = ts.createProgram(
      [...this.rootNames],
      this.compilerOptions,
      this.createHost(),
      this.program
    );
    return this.program;
  }

  /** Compile in-memory virtual source(s) reusing cached libs & workspace types. */
  createVirtualProgram(
    entryFile: string,
    sourceText: string,
    extraFiles: Readonly<Record<string, string>> = {}
  ): { program: ts.Program; entryPath: string } {
    const entryPath = path.isAbsolute(entryFile)
      ? path.resolve(entryFile)
      : path.resolve(this.rootDir, entryFile);

    const prevKeys = [...this.virtualFiles.keys()];
    this.virtualFiles.clear();
    this.virtualFiles.set(entryPath, sourceText);
    const roots = [entryPath];
    for (const [rel, content] of Object.entries(extraFiles)) {
      const abs = path.isAbsolute(rel) ? path.resolve(rel) : path.resolve(this.rootDir, rel);
      this.virtualFiles.set(abs, content);
      roots.push(abs);
    }

    const program = ts.createProgram(roots, this.compilerOptions, this.createHost(), this.program);

    // Keep base cache clean after virtual snapshot creation.
    if (prevKeys.length === 0) {
      this.virtualFiles.clear();
    }
    return { program, entryPath };
  }

  invalidateFile(filePath: string): void {
    const abs = path.resolve(this.rootDir, filePath);
    this.sourceCache.delete(abs);
    this.program = undefined;
  }
}

function loadCompilerOptions(rootDir: string, explicitTsconfig?: string): ts.CompilerOptions {
  const configPath =
    explicitTsconfig ?? ts.findConfigFile(rootDir, (f) => fs.existsSync(f), 'tsconfig.json');

  const fallback: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2024,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    esModuleInterop: true,
  };

  if (!configPath) return fallback;
  const read = ts.readConfigFile(configPath, (f) => fs.readFileSync(f, 'utf8'));
  if (read.error) return fallback;
  const parsed = ts.parseJsonConfigFileContent(
    read.config,
    ts.sys,
    path.dirname(configPath),
    undefined,
    configPath
  );
  return {
    ...fallback,
    ...parsed.options,
    noEmit: true,
    skipLibCheck: true,
  };
}
