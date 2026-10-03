// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import { describe, expect, it, vi } from 'vitest';
import {
  installSearchStartupTrace,
  readSearchDisabledNow,
  traceSearchGetter,
  type SearchGetterSample,
  searchEvidenceDirectory,
  summarizePendingRequests,
} from './site-search-evidence';

const source = readFileSync(
  'apps/www/src/content/docs/zh-cn/site-search-commands.browser.test.ts',
  'utf8'
);

describe('Search cold-start evidence boundary', () => {
  it('uses the full CI artifact root without changing the original readiness gate', () => {
    expect(source).toMatch(
      /searchEvidenceDirectory\(\s*process\.env\.PROTO_UI_RUNTIME_EVIDENCE_DIR,\s*process\.env\.RUNNER_TEMP \?\? os\.tmpdir\(\)\s*\)/
    );
    const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
    expect(workflow).toContain('path: ${{ runner.temp }}/runtime-ci');
    expect(source.replace(/\s/g, '')).toContain(
      "awaitexpect.poll(()=>traceSearchGetter(diagnosticPages.get(page)!.initialGetterSamples,()=>page.evaluate(readSearchDisabledNow))).toBe('false');"
    );
    expect(source).toContain('{ timeout: 10_000 }');
    expect(source).toContain("command?.getAttribute('role') === 'button'");
    expect(source).toContain("command.getAttribute('aria-disabled') === 'false'");
    expect(source).toContain('connected: button.isConnected');
    expect(source).toContain("inertAncestor: button.closest('[inert]')");
    expect(source).toContain("viewPending: button.hasAttribute('data-pui-view-pending')");
    expect(source).toContain('await captureFailure(page);\n            throw error;');
  });
});

describe('Search evidence controls without a browser or socket', () => {
  it('puts full CI evidence under its uploaded root and keeps isolated fallback', () => {
    expect(searchEvidenceDirectory('/runner/runtime-ci', '/runner/temp')).toBe(
      '/runner/runtime-ci/search-commands'
    );
    expect(searchEvidenceDirectory(undefined, '/runner/temp')).toBe(
      '/runner/temp/homepage-evidence/search-commands'
    );
    expect(searchEvidenceDirectory(undefined, '/os-temp')).toBe(
      '/os-temp/homepage-evidence/search-commands'
    );
  });

  it('counts all pending requests by type while bounding samples and URL length', () => {
    const requests = Array.from({ length: 4000 }, (_, index) => ({
      type: index % 2 ? 'font' : 'script',
      url: `https://example.com/${'chunk-'.repeat(80)}${index}?token=excluded#fragment`,
    }));
    const summary = summarizePendingRequests(requests);
    expect(summary.pendingCount).toBe(4000);
    expect(summary.byType).toEqual({ script: 2000, font: 2000 });
    expect(summary.samples).toHaveLength(4);
    expect(summary.samples.every(({ url }) => url.length <= 180)).toBe(true);
    expect(JSON.stringify(summary)).not.toMatch(/token=|fragment/);
    expect(JSON.stringify(summary).length).toBeLessThan(1200);
  });

  it('counts concurrent identical URLs independently and reports the empty control', () => {
    const same = { type: 'script', url: 'https://example.com/same.js?query=1' };
    const pending = new Map([
      [{}, same],
      [{}, same],
    ]);
    expect(summarizePendingRequests(pending.values()).pendingCount).toBe(2);
    pending.delete(pending.keys().next().value!);
    expect(summarizePendingRequests(pending.values()).pendingCount).toBe(1);
    expect(summarizePendingRequests([])).toEqual({ pendingCount: 0, byType: {}, samples: [] });
    expect(
      summarizePendingRequests([{ type: 'other', url: '/relative?secret=1' }]).samples
    ).toEqual([{ type: 'other', url: '/relative' }]);
    expect(source).toContain('entry.pendingRequests.set(request,');
    expect(source).toContain('entry.pendingRequests.delete(request)');
  });

  it('retains failure and late owner summaries before screenshot work and rethrows the failure', () => {
    expect(source).toContain('stageElapsedMs:');
    expect(source).toContain('activeCommands: observed.commands.map');
    expect(source).toContain('lateObservation: entry?.lateObservation ?? null');
    expect(source).toContain(
      "state.startsWith('failure-') || state.startsWith('late-observation-')"
    );
    expect(source).toContain("entry.stage === 'initial-ready' || missingCommand === 0");
    expect(source.indexOf("console.info('[Search evidence]'")).toBeLessThan(
      source.indexOf('await page.screenshot(')
    );
    expect(source.indexOf('`${id}-${state}.json`')).toBeLessThan(
      source.indexOf('await page.screenshot(')
    );
    expect(source).toContain("sha: execFileSync('git', ['rev-parse', 'HEAD']");
  });
});

it('records the first original getter and browser startup before any post-failure capture', () => {
  expect(source).toContain('await page.addInitScript(installSearchStartupTrace)');
  expect(source).toContain('traceSearchGetter(');
  expect(source).toContain('initialPollFailure');
  expect(source).toContain('__puiSearchStartup');
});

it('keeps the original getter pending across the outer deadline and records its late result', async () => {
  const samples: SearchGetterSample[] = [];
  let finish!: (value: string) => void;
  const pending = new Promise<string>((resolve) => {
    finish = resolve;
  });
  const read = vi.fn(() => pending);
  const failed = expect
    .poll(() => traceSearchGetter(samples, read), { timeout: 20, interval: 1 })
    .toBe('false');
  await expect(failed).rejects.toThrow('Matcher did not succeed in 20ms');
  expect(read).toHaveBeenCalledTimes(1);
  expect(samples).toHaveLength(1);
  expect(samples[0].settledAt).toBeUndefined();
  finish('false');
  await pending;
  await Promise.resolve();
  expect(samples[0].value).toBe('false');
  expect(samples[0].settledAt).toBeGreaterThanOrEqual(samples[0].startedAt);
});

it('passes through original values and the identical error without retries', async () => {
  const samples: SearchGetterSample[] = [];
  await expect(traceSearchGetter(samples, async () => null)).resolves.toBeNull();
  await expect
    .poll(() => traceSearchGetter(samples, async () => 'false'), { timeout: 20 })
    .toBe('false');
  const error = new Error('original getter rejection');
  await expect(
    traceSearchGetter(samples, async () => {
      throw error;
    })
  ).rejects.toBe(error);
  expect(samples.map((sample) => sample.value)).toEqual([null, 'false', undefined]);
  expect(samples[2].error).toContain(error.message);
});

function startupHarness() {
  const mutationObservers: any[] = [];
  const performanceObservers: any[] = [];
  const button = {
    dataset: { searchCommand: 'open' },
    isConnected: true,
    tabIndex: -1,
    role: null as string | null,
    disabled: 'true',
    inert: true,
    pending: true,
    getAttribute(name: string) {
      return name === 'role' ? this.role : this.disabled;
    },
    closest() {
      return this.inert ? {} : null;
    },
    hasAttribute() {
      return this.pending;
    },
  };
  const host = { dataset: { projectionGenerationState: 'staging' }, inert: true };
  const mount = {
    dataset: { searchCommandMount: 'open', projectionOwner: undefined as string | undefined },
  };
  const root = {
    isConnected: true,
    dataset: { searchView: undefined as string | undefined },
    querySelectorAll(selector: string) {
      if (selector === '[data-search-command-mount]') return [mount];
      if (selector === '[data-projection-generation-host]') return [host];
      return [button];
    },
  };
  let now = 0;
  let defined = false;
  let define!: () => void;
  const whenDefined = new Promise<void>((resolve) => {
    define = () => {
      defined = true;
      resolve();
    };
  });
  const sandbox = {
    window: {} as any,
    document: { querySelector: () => root },
    performance: { timeOrigin: 1000, now: () => ++now },
    customElements: { get: () => (defined ? class {} : undefined), whenDefined: () => whenDefined },
    MutationObserver: class {
      observe = vi.fn();
      disconnect = vi.fn();
      constructor(readonly callback: () => void) {
        mutationObservers.push(this);
      }
    },
    PerformanceObserver: class {
      static supportedEntryTypes = ['resource', 'longtask'];
      observe = vi.fn();
      disconnect = vi.fn();
      constructor(readonly callback: (list: any) => void) {
        performanceObservers.push(this);
      }
    },
  };
  const compiled = transformSync(`globalThis.install = ${installSearchStartupTrace.toString()};`, {
    loader: 'ts',
    target: 'es2022',
    format: 'cjs',
    keepNames: true,
  }).code;
  runInNewContext(compiled, sandbox);
  const install = (sandbox as any).install;
  expect(install.toString()).not.toMatch(/\b__name\s*\(/);
  install();
  return {
    trace: sandbox.window.__puiSearchStartup,
    button,
    host,
    mount,
    root,
    mutationObservers,
    performanceObservers,
    define,
  };
}

it('captures actual supplied owner/semantic transitions without creating readiness', async () => {
  // Observer deliveries and the clock are injected; this is not real-browser timing evidence.
  const h = startupHarness();
  expect(h.trace.snapshot().events[0].state.commands[0].disabled).toBe('true');
  expect(h.mutationObservers[1].disconnect).toHaveBeenCalledTimes(1);
  h.mount.dataset.projectionOwner = 'site-search-1-docs-1-open';
  h.mutationObservers[0].callback();
  h.button.role = 'button';
  h.button.disabled = 'false';
  h.button.tabIndex = 0;
  h.button.pending = false;
  h.button.inert = false;
  h.host.dataset.projectionGenerationState = 'active';
  h.host.inert = false;
  h.root.dataset.searchView = 'ready';
  h.mutationObservers[0].callback();
  h.define();
  await Promise.resolve();
  const snapshot = h.trace.snapshot();
  expect(snapshot.timeOrigin).toBe(1000);
  expect(snapshot.events.at(-1).state.defined).toBe(true);
  expect(snapshot.events.at(-1).state.commands[0]).toMatchObject({
    role: 'button',
    disabled: 'false',
    connected: true,
    inert: false,
    pending: false,
    tabIndex: 0,
  });
  expect(snapshot.events.at(-1).state.hosts[0].projectionGenerationState).toBe('active');
});

it('bounds observations and ignores queued observer/definition callbacks after stop', async () => {
  const h = startupHarness();
  for (let index = 0; index < 60; index++) {
    h.root.dataset.searchView = String(index);
    h.mutationObservers[0].callback();
  }
  const entries = Array.from({ length: 100 }, (_, index) => ({
    entryType: index % 2 ? 'longtask' : 'resource',
    startTime: index,
    duration: 10,
    name: '/src/site-search-commands.ts',
  }));
  h.performanceObservers[0].callback({ getEntries: () => entries });
  const before = h.trace.snapshot();
  expect(before.events).toHaveLength(48);
  expect(before.eventCount).toBe(61);
  expect(before.resources).toHaveLength(48);
  expect(before.resourceCount).toBe(50);
  expect(before.longTasks).toHaveLength(24);
  expect(before.longTaskCount).toBe(50);
  h.trace.stop();
  const stopped = h.trace.snapshot();
  h.mutationObservers[0].callback();
  h.performanceObservers[0].callback({ getEntries: () => entries });
  h.define();
  await Promise.resolve();
  h.trace.stop();
  expect(h.trace.snapshot().events).toEqual(stopped.events);
  expect(h.trace.snapshot().resourceCount).toBe(stopped.resourceCount);
  expect(h.performanceObservers[0].disconnect).toHaveBeenCalledTimes(1);
  expect(h.mutationObservers[0].disconnect).toHaveBeenCalledTimes(1);
});

it('parses the actual browser suite without starting its browser or server hooks', () => {
  expect(() => transformSync(source, { loader: 'ts', target: 'es2022' })).not.toThrow();
});

it('samples initial readiness once per outer poll without nesting the locator wait', () => {
  expect(source).toContain('page.evaluate(readSearchDisabledNow)');
});

it('retains absence, disabled and unique-element semantics in the immediate DOM sample', () => {
  let elements: Array<{ getAttribute: (name: string) => string | null }> = [];
  const querySelectorAll = vi.fn(() => elements);
  const read = runInNewContext(`(${readSearchDisabledNow.toString()})`, {
    document: { querySelectorAll },
  });
  expect(read()).toBeNull();
  elements = [{ getAttribute: (name) => (name === 'aria-disabled' ? 'true' : null) }];
  expect(read()).toBe('true');
  elements = [{ getAttribute: (name) => (name === 'aria-disabled' ? 'false' : null) }];
  expect(read()).toBe('false');
  elements.push(elements[0]);
  expect(read).toThrow('Search open command must be unique');
  expect(querySelectorAll).toHaveBeenCalledWith(
    'site-search [data-projection-generation-state="active"] [data-open-modal]'
  );
});

it('keeps a missed deadline failed when immediate samples stay unavailable through the window', async () => {
  let value: string | null = null;
  const samples: SearchGetterSample[] = [];
  const read = vi.fn(async () => value);
  await expect(
    expect.poll(() => traceSearchGetter(samples, read), { timeout: 20, interval: 1 }).toBe('false')
  ).rejects.toThrow('Matcher did not succeed in 20ms');
  expect(samples.length).toBeGreaterThan(1);
  expect(samples.every((sample) => sample.value === null)).toBe(true);
  value = 'false';
  expect(await read()).toBe('false');
});
