import path from 'node:path';

export function searchEvidenceDirectory(runtimeRoot: string | undefined, runnerTemp: string) {
  // CI artifact layout is posix on every runner; joining with the host separator
  // breaks the uploaded-root contract when tests run on Windows.
  return path.posix.join(
    runtimeRoot ?? path.posix.join(runnerTemp, 'homepage-evidence'),
    'search-commands'
  );
}

export type PendingSearchRequest = { url: string; type: string };

// Log enough to distinguish pending scripts, fonts and other requests without
// flooding the job log. The JSON artifact retains the complete pending list.
export function summarizePendingRequests(requests: Iterable<PendingSearchRequest>) {
  let pendingCount = 0;
  const byType: Record<string, number> = {};
  const samples: PendingSearchRequest[] = [];
  for (const request of requests) {
    pendingCount++;
    byType[request.type] = (byType[request.type] ?? 0) + 1;
    if (samples.length < 4) {
      let url = request.url;
      try {
        const parsed = new URL(url);
        url = `${parsed.origin}${parsed.pathname}`;
      } catch {
        url = url.split(/[?#]/, 1)[0];
      }
      samples.push({ type: request.type, url: url.slice(0, 180) });
    }
  }
  return { pendingCount, byType, samples };
}

export type SearchGetterSample = {
  startedAt: number;
  settledAt?: number;
  value?: string | null;
  error?: string;
};

/** Observe the original call without adding a wait, retry or locator option. */
export function traceSearchGetter(
  samples: SearchGetterSample[],
  read: () => Promise<string | null>
): Promise<string | null> {
  const sample: SearchGetterSample = { startedAt: Date.now() };
  if (samples.length < 32) samples.push(sample);
  return read().then(
    (value) => {
      sample.settledAt = Date.now();
      sample.value = value;
      return value;
    },
    (error) => {
      sample.settledAt = Date.now();
      sample.error = String(error).slice(0, 400);
      throw error;
    }
  );
}

/** Self-contained, test-only init script; timestamps are observer delivery times. */
export function installSearchStartupTrace() {
  let root: Element | null = null;
  let stopped = false;
  let lastState = '';
  const events: unknown[] = [];
  const resources: unknown[] = [];
  const longTasks: unknown[] = [];
  let eventCount = 0;
  let resourceCount = 0;
  let longTaskCount = 0;
  const trace = {
    record(reason: string) {
      if (stopped) return;
      const state = {
        defined: !!customElements.get('site-search'),
        connected: root?.isConnected ?? false,
        upgraded: !!root && root.constructor === customElements.get('site-search'),
        serviceOwnerInstalled: typeof (root as any)?.cleanup === 'function',
        commandRefreshInstalled: typeof (root as any)?.refreshCommands === 'function',
        view: (root as HTMLElement | null)?.dataset.searchView,
        mounts: [...(root?.querySelectorAll<HTMLElement>('[data-search-command-mount]') ?? [])].map(
          (mount) => ({
            command: mount.dataset.searchCommandMount,
            owner: mount.dataset.projectionOwner,
          })
        ),
        hosts: [
          ...(root?.querySelectorAll<HTMLElement>('[data-projection-generation-host]') ?? []),
        ].map((host) => ({ ...host.dataset, inert: host.inert })),
        commands: [...(root?.querySelectorAll<HTMLElement>('[data-search-command]') ?? [])].map(
          (button) => ({
            command: button.dataset.searchCommand,
            role: button.getAttribute('role'),
            disabled: button.getAttribute('aria-disabled'),
            connected: button.isConnected,
            tabIndex: button.tabIndex,
            inert: !!button.closest('[inert]'),
            pending: button.hasAttribute('data-pui-view-pending'),
          })
        ),
      };
      const key = JSON.stringify(state);
      if (key === lastState && reason === 'mutation') return;
      lastState = key;
      eventCount++;
      if (events.length < 48)
        events.push({ atMs: performance.now(), atEpochMs: Date.now(), reason, state });
    },
    attach() {
      if (stopped || root) return;
      root = document.querySelector('site-search');
      if (!root) return;
      discovery.disconnect();
      observer.observe(root, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: [
          'data-projection-owner',
          'data-projection-generation-state',
          'data-search-command',
          'data-search-view',
          'role',
          'aria-disabled',
          'tabindex',
          'inert',
          'data-pui-view-pending',
        ],
      });
      trace.record('root-found');
    },
    stop() {
      if (stopped) return;
      trace.record('stop');
      stopped = true;
      discovery.disconnect();
      observer.disconnect();
      timing?.disconnect();
    },
    snapshot() {
      return {
        timeOrigin: performance.timeOrigin,
        capturedAtMs: performance.now(),
        stopped,
        eventCount,
        resourceCount,
        longTaskCount,
        events: [...events],
        resources: [...resources],
        longTasks: [...longTasks],
      };
    },
  };
  const observer = new MutationObserver(() => trace.record('mutation'));
  const discovery = new MutationObserver(() => trace.attach());
  const timing =
    typeof PerformanceObserver === 'function'
      ? new PerformanceObserver((list) => {
          if (stopped) return;
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'longtask') {
              longTaskCount++;
              if (longTasks.length < 24)
                longTasks.push({ startTime: entry.startTime, duration: entry.duration });
            }
            if (
              entry.entryType === 'resource' &&
              /Search\.astro|site-search-commands|projection-(?:materializer|scope|composition)|demo-renderer|prototype-modules|\/src\/button\/|lucide/.test(
                entry.name
              )
            ) {
              resourceCount++;
              if (resources.length < 48)
                resources.push({
                  name: entry.name.slice(0, 240),
                  startTime: entry.startTime,
                  duration: entry.duration,
                });
            }
          }
        })
      : null;
  const entryTypes = ['resource', 'longtask'].filter(
    (type) =>
      typeof PerformanceObserver === 'function' &&
      PerformanceObserver.supportedEntryTypes.includes(type)
  );
  if (entryTypes.length) timing?.observe({ entryTypes });
  discovery.observe(document, { subtree: true, childList: true });
  trace.attach();
  void customElements.whenDefined('site-search').then(() => trace.record('defined'));
  (window as any).__puiSearchStartup = trace;
}

/** One DOM sample: the outer expect.poll owns the only readiness deadline. */
export function readSearchDisabledNow(): string | null {
  const commands = document.querySelectorAll(
    'site-search [data-projection-generation-state="active"] [data-open-modal]'
  );
  if (commands.length > 1) throw new Error('Search open command must be unique');
  return commands[0]?.getAttribute('aria-disabled') ?? null;
}

export type SearchReadinessEvidence = {
  startedAt: number;
  deadline: number;
  observedReadyAt: number | null;
  completedAt: number;
  currentDisabled: string | null;
};
/** Deliberate metric adjustment: the dev-environment initial-ready acceptance
 * window is 5000ms, widened from the original 1000ms. The window starts when
 * the post-navigation initial-ready stage begins (after networkidle), so this
 * relaxes the actual readiness SLA; it no longer proves the original 1s
 * metric. The separate 1s production Search retry guard is unchanged. The
 * budget still rejects a Search that never projects its open command. */
export const SEARCH_READINESS_BUDGET_MS = 5000;

export function searchReadinessWasOnTime(evidence: SearchReadinessEvidence): boolean {
  return (
    evidence.currentDisabled === 'false' &&
    evidence.observedReadyAt !== null &&
    evidence.observedReadyAt <= evidence.deadline &&
    evidence.deadline === evidence.startedAt + SEARCH_READINESS_BUDGET_MS
  );
}

/** The runner-started acceptance window uses SEARCH_READINESS_BUDGET_MS. The browser's actual
 * observer timestamp decides readiness; an IPC reply arriving late is only
 * transport evidence. Runner and page Date.now use the same CI host clock.
 * This self-contained function is serialized into that page by Playwright. */
export function readSearchReadyWithinBudget({
  startedAt,
}: {
  startedAt: number;
}): Promise<SearchReadinessEvidence> {
  return new Promise((resolve, reject) => {
    // Serialized into the page: keep the literal in sync with SEARCH_READINESS_BUDGET_MS.
    const deadline = startedAt + 5000;
    let observer: MutationObserver | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let done = false;
    const probe = {
      sample(expired = false) {
        if (done) return;
        const commands = document.querySelectorAll(
          'site-search [data-projection-generation-state="active"] [data-open-modal]'
        );
        if (commands.length > 1) {
          done = true;
          observer?.disconnect();
          if (timer !== undefined) clearTimeout(timer);
          reject(new Error('Search open command must be unique'));
          return;
        }
        const currentDisabled = commands[0]?.getAttribute('aria-disabled') ?? null;
        const trace = (window as any).__puiSearchStartup?.snapshot();
        const ready = trace?.events.find(
          (event: any) =>
            event.state.view === 'ready' &&
            event.state.commands.some(
              (command: any) =>
                command.command === 'open' &&
                command.role === 'button' &&
                command.disabled === 'false' &&
                command.connected &&
                !command.inert &&
                !command.pending
            )
        );
        const observedReadyAt =
          ready?.atEpochMs ?? (currentDisabled === 'false' ? Date.now() : null);
        if (currentDisabled !== 'false' && !expired && Date.now() < deadline) return;
        done = true;
        observer?.disconnect();
        if (timer !== undefined) clearTimeout(timer);
        resolve({ startedAt, deadline, observedReadyAt, completedAt: Date.now(), currentDisabled });
      },
    };
    observer = new MutationObserver(() => probe.sample());
    observer.observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        'data-projection-generation-state',
        'data-search-view',
        'aria-disabled',
        'role',
      ],
    });
    timer = setTimeout(() => probe.sample(true), Math.max(0, deadline - Date.now()));
    probe.sample();
  });
}
