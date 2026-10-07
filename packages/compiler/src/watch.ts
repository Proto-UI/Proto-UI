import { watch } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { compileProject } from './project';
import { sourceName } from './source-resolution';
import { deferred } from './deferred';
import type {
  CompileProjectOptions,
  CompilerProject,
  ProjectCompilation,
  ProjectCompileResult,
} from './project';
import type { CompileResult, CompilerDiagnostic } from './ir';

export type ProjectWatchReport =
  | {
      status: 'success';
      revision: number;
      changedFiles: readonly string[];
      compilation: ProjectCompilation;
    }
  | {
      status: 'failure';
      revision: number;
      changedFiles: readonly string[];
      diagnostics: readonly CompilerDiagnostic[];
      /** Retained output is explicitly old, never the result of this failed revision. */
      lastSuccessful?: ProjectCompilation;
      fatal: boolean;
    };

export interface ProjectWatchOptions extends CompileProjectOptions {
  /** Synchronous notification; consumers own any asynchronous artifact publication. */
  onReport(report: ProjectWatchReport): void;
  /** Quiet period for filesystem bursts. Initial compilation is not delayed. */
  debounceMs?: number;
}

export interface ProjectWatch {
  readonly closed: boolean;
  /** Resolves after cleanup; reports terminal watcher/callback failure without a rejected promise. */
  readonly finished: Promise<CompileResult<void>>;
  /** Immediately prevents callbacks and releases watchers; waits for an active compile to settle. */
  stop(): Promise<void>;
}

export interface DirectoryWatch {
  close(): void;
}

/** Host seam for deterministic orchestration tests or another native filesystem watcher. */
export interface ProjectWatchRuntime {
  watchDirectory(
    directory: string,
    onChange: (event: 'rename' | 'change', filename: string | null) => void,
    onError: (error: unknown) => void
  ): DirectoryWatch;
  compileProject?: typeof compileProject;
}

const nativeRuntime: ProjectWatchRuntime = {
  watchDirectory(directory, onChange, onError) {
    if (!['darwin', 'linux', 'win32'].includes(process.platform))
      throw new Error(`Native compiler watch is unsupported on ${process.platform}`);
    const handle = watch(directory, { recursive: false, persistent: true }, (event, filename) => {
      onChange(event, filename === null ? null : filename.toString());
    });
    handle.on('error', onError);
    handle.on('close', () => onError(new Error('Native directory watcher closed unexpectedly')));
    return handle;
  },
};

function diagnostic(
  code: string,
  message: string,
  category: CompilerDiagnostic['category']
): CompilerDiagnostic {
  return {
    code,
    category,
    message,
    span: { file: '<watch>', start: 0, end: 0, line: 1, column: 1, endLine: 1, endColumn: 1 },
  };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function inside(root: string, filename: string): boolean {
  const relative = path.relative(root, filename);
  return (
    relative === '' ||
    (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`))
  );
}

interface WatchedDirectory {
  identity: string;
  handle: DirectoryWatch;
}

/**
 * Watch a single project using native, nonrecursive directory notifications.
 * Dependency identities come only from compileProject, including unresolved candidates.
 * No sources are executed and no artifacts are written. Native watcher setup/errors fail
 * explicitly; there is no polling fallback or claim of support for remote filesystems.
 */
export async function watchProject(
  options: ProjectWatchOptions,
  runtime: ProjectWatchRuntime = nativeRuntime
): Promise<CompileResult<ProjectWatch>> {
  const debounceMs = options.debounceMs ?? 40;
  if (
    !Number.isFinite(debounceMs) ||
    debounceMs < 0 ||
    debounceMs > 2_147_483_647 ||
    typeof options.onReport !== 'function'
  ) {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          'PUI4001',
          'Watch requires a callback and a finite nonnegative debounce interval.',
          'invalid-input'
        ),
      ],
    };
  }

  let root: string;
  let requestedRoot: string;
  let dependencies: Set<string>;
  try {
    requestedRoot = path.resolve(options.root);
    root = await realpath(requestedRoot);
    if (!(await stat(root)).isDirectory()) throw new Error('Watch root must be a directory');
    dependencies = new Set(
      [...options.entries, ...(options.configFiles ?? [])].map((filename) => sourcePath(filename))
    );
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        diagnostic('PUI4001', `Cannot watch project: ${message(error)}`, 'invalid-input'),
      ],
    };
  }

  function sourcePath(filename: string): string {
    if (typeof filename !== 'string' || !filename || filename.includes('\0'))
      throw new Error('Watch dependency must be a nonempty source path');
    let absolute = path.resolve(root, filename);
    if (path.isAbsolute(filename) && inside(requestedRoot, absolute))
      absolute = path.resolve(root, path.relative(requestedRoot, absolute));
    if (!inside(root, absolute) || absolute === root)
      throw new Error(`Watch dependency escapes the project root: ${filename}`);
    return path.resolve(root, sourceName(path.relative(root, absolute).split(path.sep).join('/')));
  }

  const watchers = new Map<string, WatchedDirectory>();
  let revision = 1;
  let closed = false;
  let timer: NodeJS.Timeout | undefined;
  let active: Promise<void> | undefined;
  const errorChecks = new Set<Promise<void>>();
  let ready = true;
  let project: CompilerProject | undefined;
  let lastSuccessful: ProjectCompilation | undefined;
  const changedFiles = new Set<string>();
  let terminal: CompileResult<void> = { ok: true, value: undefined };
  const { promise: finished, resolve: resolveFinished } = deferred<CompileResult<void>>();
  const compiler = runtime.compileProject ?? compileProject;
  // Never let callback/timer fields leak into compiler identity or a retained project.
  const { onReport, debounceMs: _debounceMs, ...projectOptions } = options;
  const compileOptions: CompileProjectOptions = {
    ...projectOptions,
    root,
    entries: options.entries.map((filename) => path.relative(root, sourcePath(filename))),
    configFiles: options.configFiles?.map((filename) => path.relative(root, sourcePath(filename))),
  };

  function closeWatchers(): void {
    for (const [directory, watcher] of watchers) {
      watchers.delete(directory);
      try {
        watcher.handle.close();
      } catch (error) {
        terminal = {
          ok: false,
          diagnostics: [
            diagnostic(
              'PUI4002',
              `Cannot close project watcher: ${message(error)}`,
              'unsupported-input'
            ),
          ],
        };
      }
    }
  }

  function close(): void {
    if (closed) return;
    closed = true;
    revision++;
    ready = false;
    clearTimeout(timer);
    timer = undefined;
    closeWatchers();
    finishIfClosed();
  }

  function finishIfClosed(): void {
    if (closed && !active && !errorChecks.size) resolveFinished(terminal);
  }

  function deliver(report: ProjectWatchReport): void {
    if (closed) return;
    try {
      onReport(report);
    } catch (error) {
      terminal = {
        ok: false,
        diagnostics: [
          diagnostic(
            'PUI4004',
            `Watch report callback failed: ${message(error)}`,
            'compiler-defect'
          ),
        ],
      };
      close();
    }
  }

  function fail(error: unknown): void {
    if (closed) return;
    const diagnostics = [
      diagnostic('PUI4002', `Native project watch failed: ${message(error)}`, 'unsupported-input'),
    ];
    terminal = { ok: false, diagnostics };
    deliver({
      status: 'failure',
      revision,
      changedFiles: [...changedFiles].sort(),
      diagnostics,
      lastSuccessful,
      fatal: true,
    });
    close();
  }

  function invalidate(filename: string | null): void {
    if (closed) return;
    revision++;
    if (filename !== null)
      changedFiles.add(path.relative(root, filename).split(path.sep).join('/') || '.');
    ready = false;
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      ready = true;
      pump();
    }, debounceMs);
  }

  function relevant(filename: string): boolean {
    if (filename === root || inside(filename, root)) return true;
    for (const dependency of dependencies)
      if (dependency === filename || inside(filename, dependency)) return true;
    return false;
  }

  async function directoryIdentity(
    directory: string,
    sentinel: boolean
  ): Promise<string | undefined> {
    try {
      const info = await stat(directory);
      if (!info.isDirectory()) return undefined;
      const canonical = await realpath(directory);
      if (!sentinel && !inside(root, canonical)) return undefined;
      return `${canonical}\0${info.dev}:${info.ino}`;
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error.code === 'ENOENT' || error.code === 'ENOTDIR')
      )
        return undefined;
      throw error;
    }
  }

  function checkWatcherError(directory: string, watcher: WatchedDirectory, error: unknown): void {
    // Coverage is suspect as soon as the host reports failure, not only after stat settles.
    revision++;
    ready = false;
    clearTimeout(timer);
    timer = undefined;
    const checking = (async () => {
      try {
        const identity = await directoryIdentity(directory, !inside(root, directory));
        if (closed) return;
        if (watchers.get(directory) !== watcher) {
          invalidate(null);
          return;
        }
        // Windows can signal a deleted/replaced directory as EPERM rather than rename.
        // Observe its surviving parent on the next build; do not poll or keep a dead handle.
        if (identity === undefined || identity !== watcher.identity)
          invalidate(relevant(directory) ? directory : null);
        else fail(error);
      } catch (inspectionError) {
        if (!closed && watchers.get(directory) === watcher) fail(inspectionError);
      }
    })().finally(() => {
      errorChecks.delete(checking);
      finishIfClosed();
      if (!closed) pump();
    });
    errorChecks.add(checking);
  }

  /** Rebind replaced directory inodes and observe the closest existing missing-path parent. */
  async function synchronize(): Promise<boolean> {
    const desired = new Map<string, string>();
    let parent = path.dirname(root);
    for (;;) {
      const identity = await directoryIdentity(parent, true);
      if (identity !== undefined) {
        desired.set(parent, identity);
        break;
      }
      const next = path.dirname(parent);
      if (next === parent) throw new Error('No existing directory can observe the project root');
      parent = next;
    }
    const candidates = new Set<string>([root]);
    for (const dependency of dependencies) {
      let directory = path.dirname(dependency);
      while (inside(root, directory)) {
        candidates.add(directory);
        if (directory === root) break;
        directory = path.dirname(directory);
      }
    }
    for (const directory of candidates) {
      const identity = await directoryIdentity(directory, false);
      if (identity !== undefined) desired.set(directory, identity);
    }
    if (closed) return false;
    let rebound = false;
    for (const [directory, identity] of desired) {
      if (watchers.get(directory)?.identity === identity) continue;
      const old = watchers.get(directory);
      watchers.delete(directory);
      old?.handle.close();
      let watcher: WatchedDirectory | undefined;
      let failedSetup = false;
      let setupError: unknown;
      const handle = runtime.watchDirectory(
        directory,
        (event, filename) => {
          if (closed || watcher === undefined || watchers.get(directory) !== watcher) return;
          if (filename === null) {
            invalidate(null);
            return;
          }
          const absolute = path.resolve(directory, filename);
          // Some hosts report a watched directory's own deletion under its basename.
          if (relevant(absolute) || (event === 'rename' && filename === path.basename(directory)))
            invalidate(relevant(absolute) ? absolute : null);
        },
        (error) => {
          if (watcher === undefined) {
            failedSetup = true;
            setupError = error;
          } else if (!closed && watchers.get(directory) === watcher)
            checkWatcherError(directory, watcher, error);
        }
      );
      if (failedSetup) {
        handle.close();
        throw setupError;
      }
      watcher = { identity, handle };
      watchers.set(directory, watcher);
      rebound = true;
    }
    for (const [directory, watcher] of watchers) {
      if (desired.has(directory)) continue;
      watchers.delete(directory);
      watcher.handle.close();
    }
    return rebound;
  }

  async function build(): Promise<void> {
    const buildRevision = revision;
    ready = false;
    try {
      await synchronize();
      if (closed || buildRevision !== revision) return;
      let result: ProjectCompileResult;
      try {
        result = await compiler(compileOptions, project);
      } catch (error) {
        if (!closed && buildRevision === revision) {
          const reportChanges = [...changedFiles].sort();
          changedFiles.clear();
          deliver({
            status: 'failure',
            revision: buildRevision,
            changedFiles: reportChanges,
            diagnostics: [
              diagnostic(
                'PUI4003',
                `Project compilation threw: ${message(error)}`,
                'compiler-defect'
              ),
            ],
            lastSuccessful,
            fatal: false,
          });
        }
        return;
      }
      if (closed) return;
      project = result.ok ? result.value.project : result.project;
      const nextDependencies = new Set(
        (result.ok ? result.value.dependencies : result.dependencies).map(sourcePath)
      );
      let expanded = false;
      for (const dependency of nextDependencies) {
        if (!dependencies.has(dependency)) expanded = true;
        dependencies.add(dependency);
      }
      const rebound = await synchronize();
      if (closed) return;
      if (buildRevision !== revision) return;
      // A newly observed path may have changed before its parent watcher/filter existed.
      // Re-read the real project after expanding coverage, instead of publishing that snapshot.
      if (expanded || rebound) {
        ready = true;
        return;
      }
      let removed = false;
      for (const dependency of dependencies) {
        if (!nextDependencies.has(dependency)) {
          removed = true;
          break;
        }
      }
      dependencies = nextDependencies;
      if (removed && (await synchronize())) {
        if (!closed && buildRevision === revision) ready = true;
        return;
      }
      if (closed || buildRevision !== revision) return;
      const reportChanges = [...changedFiles].sort();
      changedFiles.clear();
      if (result.ok) {
        lastSuccessful = result.value;
        deliver({
          status: 'success',
          revision: buildRevision,
          changedFiles: reportChanges,
          compilation: result.value,
        });
      } else {
        deliver({
          status: 'failure',
          revision: buildRevision,
          changedFiles: reportChanges,
          diagnostics: result.diagnostics,
          lastSuccessful,
          fatal: false,
        });
      }
    } catch (error) {
      if (closed) return;
      fail(error);
    }
  }

  function pump(): void {
    if (closed || active || errorChecks.size || !ready) return;
    active = build().finally(() => {
      active = undefined;
      if (closed) finishIfClosed();
      else pump();
    });
  }

  try {
    await synchronize();
  } catch (error) {
    terminal = {
      ok: false,
      diagnostics: [
        diagnostic(
          'PUI4002',
          `Cannot start native project watch: ${message(error)}`,
          'unsupported-input'
        ),
      ],
    };
    close();
    return terminal;
  }

  const controller: ProjectWatch = {
    get closed() {
      return closed;
    },
    finished,
    async stop() {
      close();
      await active;
      await Promise.all(errorChecks);
    },
  };
  // The controller is returned without waiting for a build; compilation failures are reports,
  // not a failed startup, so missing dependencies remain observable and can recover.
  queueMicrotask(pump);
  return { ok: true, value: controller };
}
