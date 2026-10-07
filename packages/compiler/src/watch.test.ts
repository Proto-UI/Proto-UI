// @vitest-environment node
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { compileProject } from './project';
import { watchProject } from './watch';
import { deferred } from './deferred';
import type { ProjectWatch, ProjectWatchReport, ProjectWatchRuntime } from './watch';

interface WatchHandle {
  directory: string;
  closed: boolean;
  change(event: 'rename' | 'change', filename: string | null): void;
  error(error: unknown): void;
}

/** Delivers native-style notifications explicitly, never launches a filesystem watcher. */
class WatchHost implements ProjectWatchRuntime {
  readonly handles: WatchHandle[] = [];

  watchDirectory(directory: string, change: WatchHandle['change'], error: WatchHandle['error']) {
    const handle = { directory, closed: false, change, error };
    this.handles.push(handle);
    return {
      close() {
        handle.closed = true;
      },
    };
  }

  current(directory: string): WatchHandle {
    for (let index = this.handles.length - 1; index >= 0; index--)
      if (this.handles[index].directory === directory && !this.handles[index].closed)
        return this.handles[index];
    throw new Error(`No active watcher for ${directory}`);
  }
}

class Reports {
  readonly received: ProjectWatchReport[] = [];
  private readonly unread: ProjectWatchReport[] = [];
  private readonly readers: ((report: ProjectWatchReport) => void)[] = [];

  readonly accept = (report: ProjectWatchReport) => {
    this.received.push(report);
    const reader = this.readers.shift();
    if (reader) reader(report);
    else this.unread.push(report);
  };

  next(): Promise<ProjectWatchReport> {
    const report = this.unread.shift();
    if (report) return Promise.resolve(report);
    const { promise, resolve } = deferred<ProjectWatchReport>();
    this.readers.push(resolve);
    return promise;
  }
}

const releases: (() => void)[] = [];

function gate() {
  const { promise, resolve } = deferred<void>();
  releases.push(resolve);
  return { promise, open: resolve };
}

interface WatchFixture {
  root: string;
  host: WatchHost;
  reports: Reports;
}

const roots: string[] = [];
const controllers: ProjectWatch[] = [];
const source = (name: string) => `import { definePrototype } from '@proto.ui/core';
export default definePrototype({ name: '${name}', setup(def) {} });`;

async function fixture(
  files: Record<string, string> = { 'entry.proto.ts': source('initial') }
): Promise<WatchFixture> {
  const root = await mkdtemp(path.join(tmpdir(), 'proto-compiler-watch-'));
  roots.push(root);
  for (const [filename, contents] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, filename)), { recursive: true });
    await writeFile(path.join(root, filename), contents);
  }
  return { root, host: new WatchHost(), reports: new Reports() };
}

async function start(
  data: WatchFixture,
  runtime: ProjectWatchRuntime = data.host,
  configFiles?: readonly string[],
  debounceMs = 0
): Promise<ProjectWatch> {
  const result = await watchProject(
    {
      root: data.root,
      entries: ['entry.proto.ts'],
      configFiles,
      debounceMs,
      onReport: data.reports.accept,
    },
    runtime
  );
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  controllers.push(result.value);
  return result.value;
}

function compiledName(report: ProjectWatchReport): string {
  if (report.status !== 'success') throw new Error(JSON.stringify(report.diagnostics));
  return report.compilation.entries[0].compilation.ir.name;
}

afterEach(async () => {
  for (const release of releases.splice(0)) release();
  for (const controller of controllers.splice(0)) await controller.stop();
  vi.useRealTimers();
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

describe('project-scoped incremental watch', () => {
  it('waits for a resettable quiet period and publishes one latest report for a filesystem burst', async () => {
    const data = await fixture();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const controller = await start(data, data.host, undefined, 25);
    await data.reports.next();
    await writeFile(path.join(data.root, 'entry.proto.ts'), source('intermediate'));
    data.host.current(data.root).change('change', 'entry.proto.ts');
    await vi.advanceTimersByTimeAsync(24);
    expect(data.reports.received.map(compiledName)).toEqual(['initial']);
    await writeFile(path.join(data.root, 'entry.proto.ts'), source('burst-latest'));
    data.host.current(data.root).change('rename', 'entry.proto.ts');
    await vi.advanceTimersByTimeAsync(24);
    expect(data.reports.received.map(compiledName)).toEqual(['initial']);
    data.host.current(data.root).change('change', null);
    await vi.advanceTimersByTimeAsync(25);
    expect(compiledName(await data.reports.next())).toBe('burst-latest');
    await controller.stop();
    expect(data.reports.received.map(compiledName)).toEqual(['initial', 'burst-latest']);
  });

  it('reports the latest source and discards an already-computed superseded success', async () => {
    const data = await fixture();
    const entered = gate();
    const release = gate();
    let hold = false;
    const controller = await start(data, {
      watchDirectory: data.host.watchDirectory.bind(data.host),
      async compileProject(options, previous) {
        const result = await compileProject(options, previous);
        if (hold) {
          hold = false;
          entered.open();
          await release.promise;
        }
        return result;
      },
    });
    const initial = await data.reports.next();
    expect(compiledName(initial)).toBe('initial');
    hold = true;
    await writeFile(path.join(data.root, 'entry.proto.ts'), source('superseded'));
    data.host.current(data.root).change('change', 'entry.proto.ts');
    await entered.promise;
    await writeFile(path.join(data.root, 'entry.proto.ts'), source('latest'));
    const watcher = data.host.current(data.root);
    watcher.change('rename', 'entry.proto.ts');
    watcher.change('change', 'entry.proto.ts');
    watcher.change('change', 'entry.proto.ts');
    release.open();
    const latest = await data.reports.next();
    expect(compiledName(latest)).toBe('latest');
    expect(latest.revision).toBeGreaterThan(initial.revision);
    expect(latest.changedFiles).toEqual(['entry.proto.ts']);
    await controller.stop();
    expect(data.reports.received.map(compiledName)).toEqual(['initial', 'latest']);
  });

  it('discards superseded failure instead of reporting a stale diagnostic over a corrected source', async () => {
    const data = await fixture();
    const entered = gate();
    const release = gate();
    let hold = false;
    const controller = await start(data, {
      watchDirectory: data.host.watchDirectory.bind(data.host),
      async compileProject(options, previous) {
        const result = await compileProject(options, previous);
        if (hold) {
          hold = false;
          expect(result.ok).toBe(false);
          entered.open();
          await release.promise;
        }
        return result;
      },
    });
    await data.reports.next();
    hold = true;
    await rm(path.join(data.root, 'entry.proto.ts'));
    data.host.current(data.root).change('rename', 'entry.proto.ts');
    await entered.promise;
    await writeFile(path.join(data.root, 'entry.proto.ts'), source('recovered'));
    data.host.current(data.root).change('rename', 'entry.proto.ts');
    release.open();
    expect(compiledName(await data.reports.next())).toBe('recovered');
    await controller.stop();
    expect(data.reports.received.map((report) => report.status)).toEqual(['success', 'success']);
  });

  it('tracks transitive edits and reports deletion as failure with explicitly retained old output', async () => {
    const data = await fixture({
      'entry.proto.ts': "export { default } from './barrel';",
      'barrel.ts': "export { default } from './nested/leaf';",
      'nested/leaf.ts': source('transitive'),
    });
    await start(data);
    const initial = await data.reports.next();
    expect(compiledName(initial)).toBe('transitive');
    await writeFile(path.join(data.root, 'nested/leaf.ts'), source('edited'));
    data.host.current(path.join(data.root, 'nested')).change('change', 'leaf.ts');
    const edited = await data.reports.next();
    expect(compiledName(edited)).toBe('edited');
    await rm(path.join(data.root, 'nested/leaf.ts'));
    data.host.current(path.join(data.root, 'nested')).change('rename', 'leaf.ts');
    const failure = await data.reports.next();
    expect(failure.status).toBe('failure');
    if (failure.status !== 'failure' || edited.status !== 'success')
      throw new Error('Expected deletion failure');
    expect(failure.fatal).toBe(false);
    expect(failure.lastSuccessful?.identity).toBe(edited.compilation.identity);
    expect('compilation' in failure).toBe(false);
    await writeFile(path.join(data.root, 'nested/leaf.ts'), source('recreated'));
    data.host.current(path.join(data.root, 'nested')).change('rename', 'leaf.ts');
    expect(compiledName(await data.reports.next())).toBe('recreated');
  });

  it('observes missing-file parent creation and then subsequent edits beneath the new directory', async () => {
    const data = await fixture({
      'entry.proto.ts': "export { default } from './missing/nested/leaf';",
    });
    await start(data);
    const failure = await data.reports.next();
    expect(failure).toMatchObject({ status: 'failure', fatal: false, lastSuccessful: undefined });
    await mkdir(path.join(data.root, 'missing/nested'), { recursive: true });
    await writeFile(path.join(data.root, 'missing/nested/leaf.ts'), source('created'));
    data.host.current(data.root).change('rename', 'missing');
    expect(compiledName(await data.reports.next())).toBe('created');
    await writeFile(path.join(data.root, 'missing/nested/leaf.ts'), source('nested-edit'));
    data.host.current(path.join(data.root, 'missing/nested')).change('change', 'leaf.ts');
    expect(compiledName(await data.reports.next())).toBe('nested-edit');
  });

  it('re-reads newly discovered dependencies before reporting a snapshot taken before coverage existed', async () => {
    const data = await fixture({
      'entry.proto.ts': "export { default } from './nested/leaf';",
      'nested/leaf.ts': source('before-coverage'),
    });
    let changed = false;
    await start(data, {
      watchDirectory: data.host.watchDirectory.bind(data.host),
      async compileProject(options, previous) {
        const result = await compileProject(options, previous);
        if (!changed) {
          changed = true;
          // This edit deliberately has no notification: its directory was not watched yet.
          await writeFile(path.join(data.root, 'nested/leaf.ts'), source('after-coverage'));
        }
        return result;
      },
    });
    expect(compiledName(await data.reports.next())).toBe('after-coverage');
  });

  it('rebinds directory replacement and ignores callbacks from the retired inode watcher', async () => {
    const data = await fixture({
      'entry.proto.ts': "export { default } from './nested/leaf';",
      'nested/leaf.ts': source('original-directory'),
    });
    const controller = await start(data);
    await data.reports.next();
    const old = data.host.current(path.join(data.root, 'nested'));
    await rename(path.join(data.root, 'nested'), path.join(data.root, 'retired'));
    await mkdir(path.join(data.root, 'nested'));
    await writeFile(path.join(data.root, 'nested/leaf.ts'), source('replacement-directory'));
    data.host.current(data.root).change('rename', 'nested');
    expect(compiledName(await data.reports.next())).toBe('replacement-directory');
    expect(old.closed).toBe(true);
    old.error(new Error('Late error from deleted inode'));
    old.change('change', 'leaf.ts');
    await writeFile(path.join(data.root, 'nested/leaf.ts'), source('live-directory'));
    data.host.current(path.join(data.root, 'nested')).change('change', 'leaf.ts');
    expect(compiledName(await data.reports.next())).toBe('live-directory');
    expect(controller.closed).toBe(false);
  });

  it('recovers when a deleted directory is signaled as a host watcher error rather than rename', async () => {
    const data = await fixture({
      'entry.proto.ts': "export { default } from './nested/leaf';",
      'nested/leaf.ts': source('before-delete'),
    });
    const controller = await start(data);
    await data.reports.next();
    const deleted = data.host.current(path.join(data.root, 'nested'));
    await rm(path.join(data.root, 'nested'), { recursive: true });
    deleted.error(Object.assign(new Error('Watched directory was deleted'), { code: 'EPERM' }));
    expect(await data.reports.next()).toMatchObject({ status: 'failure', fatal: false });
    expect(controller.closed).toBe(false);
    expect(deleted.closed).toBe(true);
    await mkdir(path.join(data.root, 'nested'));
    await writeFile(path.join(data.root, 'nested/leaf.ts'), source('after-delete'));
    data.host.current(data.root).change('rename', 'nested');
    expect(compiledName(await data.reports.next())).toBe('after-delete');
  });

  it('invalidates configuration content and treats missing configuration as a failed generation', async () => {
    const data = await fixture({
      'entry.proto.ts': source('configured'),
      'compiler.config.json': '{}',
    });
    await start(data, data.host, ['compiler.config.json']);
    const initial = await data.reports.next();
    await writeFile(path.join(data.root, 'compiler.config.json'), '{"target":"changed"}');
    data.host.current(data.root).change('change', 'compiler.config.json');
    const changed = await data.reports.next();
    expect(compiledName(changed)).toBe('configured');
    if (changed.status !== 'success' || initial.status !== 'success')
      throw new Error('Expected success');
    expect(changed.compilation.identity).not.toBe(initial.compilation.identity);
    await rm(path.join(data.root, 'compiler.config.json'));
    data.host.current(data.root).change('rename', 'compiler.config.json');
    expect(await data.reports.next()).toMatchObject({ status: 'failure', fatal: false });
  });

  it('stops during an active compile, closes resources immediately and never calls back afterward', async () => {
    const data = await fixture();
    const entered = gate();
    const release = gate();
    const controller = await start(data, {
      watchDirectory: data.host.watchDirectory.bind(data.host),
      async compileProject(options, previous) {
        const result = await compileProject(options, previous);
        entered.open();
        await release.promise;
        return result;
      },
    });
    await entered.promise;
    const old = data.host.current(data.root);
    const stopping = controller.stop();
    expect(controller.closed).toBe(true);
    expect(data.host.handles.every((handle) => handle.closed)).toBe(true);
    old.change('rename', 'entry.proto.ts');
    old.error(new Error('Late native error'));
    release.open();
    await stopping;
    expect(data.reports.received).toEqual([]);
    expect(await controller.finished).toEqual({ ok: true, value: undefined });
    await controller.stop();
  });

  it('fails unsupported watcher startup and releases already-acquired directory watchers', async () => {
    const data = await fixture();
    const result = await watchProject(
      {
        root: data.root,
        entries: ['entry.proto.ts'],
        onReport: data.reports.accept,
      },
      {
        watchDirectory(directory, change, error) {
          if (directory === data.root)
            throw Object.assign(new Error('Watch capability unavailable'), { code: 'ENOSYS' });
          return data.host.watchDirectory(directory, change, error);
        },
      }
    );
    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI4002', category: 'unsupported-input' }],
    });
    expect(data.host.handles.every((handle) => handle.closed)).toBe(true);
    expect(data.reports.received).toEqual([]);
  });

  it('reports a runtime watcher failure without reclassifying retained output as fresh success', async () => {
    const data = await fixture();
    const controller = await start(data);
    const initial = await data.reports.next();
    data.host
      .current(data.root)
      .error(Object.assign(new Error('Watcher resource limit'), { code: 'ENOSPC' }));
    const failure = await data.reports.next();
    expect(failure).toMatchObject({
      status: 'failure',
      fatal: true,
      diagnostics: [{ code: 'PUI4002' }],
    });
    if (failure.status !== 'failure' || initial.status !== 'success')
      throw new Error('Expected watch failure');
    expect(failure.lastSuccessful?.identity).toBe(initial.compilation.identity);
    expect(controller.closed).toBe(true);
    expect(data.host.handles.every((handle) => handle.closed)).toBe(true);
    expect(await controller.finished).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI4002' }],
    });
  });

  it('closes cleanly when a consumer callback throws instead of leaking watchers or rejecting in the background', async () => {
    const data = await fixture();
    const result = await watchProject(
      {
        root: data.root,
        entries: ['entry.proto.ts'],
        onReport() {
          throw new Error('Consumer callback failed');
        },
      },
      data.host
    );
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    controllers.push(result.value);
    expect(await result.value.finished).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI4004' }],
    });
    expect(data.host.handles.every((handle) => handle.closed)).toBe(true);
  });
});
