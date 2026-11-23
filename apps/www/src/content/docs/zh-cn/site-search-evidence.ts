import path from 'node:path';

export function searchEvidenceDirectory(runtimeRoot: string | undefined, runnerTemp: string) {
  // CI artifact layout is posix on every runner; joining with the host separator
  // breaks the uploaded-root contract when tests run on Windows.
  return path.posix.join(
    runtimeRoot ?? path.posix.join(runnerTemp, 'homepage-evidence'),
    'search-commands'
  );
}

/** Self-contained browser callback. Vite's SSR transform must not own this import. */
export async function readIndependentPagefindQueries(emptyQuery: string) {
  const url = new URL('/pagefind/pagefind.js', location.origin);
  const load = new Function('url', 'return import(url)') as (url: string) => Promise<{
    options(options: { baseUrl: string }): Promise<void>;
    search(query: string): Promise<{ results: unknown[] }>;
  }>;
  const pagefind = await load(url.href);
  await pagefind.options({ baseUrl: '/' });
  const observations: Array<{ query: string; count: number }> = [];
  for (const query of [emptyQuery, 'Button', 'zxqv948271605emptycontract']) {
    const found = await pagefind.search(query);
    observations.push({ query, count: found.results.length });
  }
  return observations;
}

/** Opt-in production diagnosis, never a readiness oracle. Only the two Search
 * mounts' direct generation hosts are sampled; no layout or descendant walk.
 * Phase times are MutationObserver delivery times, not mutation start times. */
export function installSearchRuntimeTrace() {
  (window as any).__puiSearchRuntime?.stop();
  const root = document.querySelector<HTMLElement>('site-search');
  if (!root) throw new Error('Missing Search owner for runtime diagnosis');
  const mounts = [
    {
      kind: 'open',
      element: root.querySelector<HTMLElement>('[data-search-command-mount="open"]'),
    },
    { kind: 'dialog', element: root.querySelector<HTMLElement>('[data-search-dialog-mount]') },
  ];
  const state = {
    diagnosticOnly: true,
    timeOrigin: performance.timeOrigin,
    startedAt: performance.now(),
    endedAt: null as number | null,
    stopped: false,
    phaseCount: 0,
    resourceCount: 0,
    longTaskCount: 0,
    phases: [] as unknown[],
    resources: [] as unknown[],
    longTasks: [] as unknown[],
    finalPhase: null as unknown,
    supportedEntryTypes:
      typeof PerformanceObserver === 'function'
        ? PerformanceObserver.supportedEntryTypes.filter((type) =>
            ['resource', 'longtask'].includes(type)
          )
        : [],
  };
  let previous = '';
  const trace = {
    record(reason: string) {
      if (state.stopped) return;
      const facts = {
        connected: root.isConnected,
        runtime: root.dataset.searchRuntime ?? null,
        view: root.dataset.searchView ?? null,
        preparation: root.dataset.searchPreparation ?? null,
        generation: root.dataset.searchGeneration ?? null,
        mounts: mounts.map(({ kind, element }) => ({
          kind,
          present: !!element,
          owner: element?.dataset.projectionOwner ?? null,
          hosts: Array.from(element?.children ?? [])
            .filter((child) => child.hasAttribute('data-projection-generation-host'))
            .map((child) => {
              const host = child as HTMLElement;
              return {
                owner: host.dataset.projectionOwnerHost ?? null,
                generation: host.dataset.projectionGenerationHost ?? null,
                state: host.dataset.projectionGenerationState ?? null,
                connected: host.isConnected,
                inert: host.inert,
                hidden: host.hidden,
                childCount: host.childElementCount,
                firstChild: host.firstElementChild?.localName ?? null,
              };
            }),
        })),
      };
      const key = JSON.stringify(facts);
      if (reason === 'mutation' && key === previous) return;
      previous = key;
      const phase = { at: performance.now(), atEpochMs: Date.now(), reason, facts };
      state.finalPhase = phase;
      state.phaseCount++;
      if (state.phases.length < 96) state.phases.push(phase);
    },
    timing(entries: PerformanceEntry[]) {
      if (state.stopped) return;
      for (const entry of entries) {
        // Include requests already in flight that finish during this window.
        if (entry.startTime + entry.duration < state.startedAt) continue;
        if (entry.entryType === 'longtask') {
          state.longTaskCount++;
          if (state.longTasks.length < 128)
            state.longTasks.push({ startTime: entry.startTime, duration: entry.duration });
        } else if (entry.entryType === 'resource') {
          const resource = entry as PerformanceResourceTiming;
          const url = new URL(resource.name, location.href);
          if (url.origin !== location.origin) continue;
          state.resourceCount++;
          if (state.resources.length < 128)
            state.resources.push({
              url: `${url.origin}${url.pathname}`,
              initiatorType: resource.initiatorType,
              startTime: resource.startTime,
              duration: resource.duration,
              fetchStart: resource.fetchStart,
              requestStart: resource.requestStart,
              responseStart: resource.responseStart,
              responseEnd: resource.responseEnd,
              transferSize: resource.transferSize,
              encodedBodySize: resource.encodedBodySize,
              decodedBodySize: resource.decodedBodySize,
            });
        }
      }
    },
    stop() {
      if (!state.stopped) {
        trace.timing(timing?.takeRecords() ?? []);
        trace.record('stop');
        state.endedAt = performance.now();
        state.stopped = true;
        mutation.disconnect();
        timing?.disconnect();
      }
      return state;
    },
  };
  const mutation = new MutationObserver(() => trace.record('mutation'));
  mutation.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: [
      'data-search-runtime',
      'data-search-view',
      'data-search-preparation',
      'data-search-generation',
      'data-projection-owner',
      'data-projection-generation-state',
      'inert',
      'hidden',
    ],
  });
  const timing = state.supportedEntryTypes.length
    ? new PerformanceObserver((list) => trace.timing(list.getEntries()))
    : null;
  timing?.observe({ entryTypes: state.supportedEntryTypes });
  (window as any).__puiSearchRuntime = trace;
  trace.record('install');
}

/** Self-contained browser callback; no imported helper is needed after transport. */
export function stopSearchRuntimeTrace() {
  return (window as any).__puiSearchRuntime?.stop() ?? null;
}

/** Both timestamps come from one page clock, never from a renewed Node-side wait. */
export function homepageRollbackWasOnTime(
  evidence: { faultAt?: number | null; errorAt?: number | null },
  budgetMs = 1000
) {
  const { faultAt, errorAt } = evidence;
  return (
    typeof faultAt === 'number' &&
    Number.isFinite(faultAt) &&
    typeof errorAt === 'number' &&
    Number.isFinite(errorAt) &&
    errorAt >= faultAt &&
    errorAt - faultAt <= budgetMs
  );
}

/** A native reveal receipt keeps ordinary containment and oversized edge alignment distinct. */
export function searchRevealMatchesViewport(
  bounds: {
    viewportTop: number;
    viewportBottom: number;
    targetTop: number;
    targetBottom: number;
  },
  nearestEdge: 'start' | 'end',
  native?: {
    physicalViewportTop: number;
    physicalViewportBottom: number;
    physicalTargetTop: number;
    physicalTargetBottom: number;
    scrollTop: number;
    maxScrollTop: number;
  }
) {
  const { viewportTop, viewportBottom, targetTop, targetBottom } = bounds;
  if (![viewportTop, viewportBottom, targetTop, targetBottom].every(Number.isFinite)) return false;
  const viewportHeight = viewportBottom - viewportTop;
  const targetHeight = targetBottom - targetTop;
  if (viewportHeight <= 0 || targetHeight <= 0) return false;
  if (targetHeight <= viewportHeight) {
    const contained = targetTop >= viewportTop - 1 && targetBottom <= viewportBottom + 1;
    if (!native) return contained;
    const {
      physicalViewportTop,
      physicalViewportBottom,
      physicalTargetTop,
      physicalTargetBottom,
      scrollTop,
      maxScrollTop,
    } = native;
    if (
      !Object.values(native).every(Number.isFinite) ||
      maxScrollTop < 0 ||
      scrollTop < 0 ||
      scrollTop > maxScrollTop ||
      physicalViewportBottom <= physicalViewportTop ||
      physicalTargetBottom <= physicalTargetTop ||
      viewportTop < physicalViewportTop ||
      viewportBottom > physicalViewportBottom ||
      physicalTargetTop < physicalViewportTop - 1 ||
      physicalTargetBottom > physicalViewportBottom + 1
    )
      return false;
    if (contained) return true;
    // The preferred inset can extend beyond the actual native scroll range.
    // Admit only that impossible movement at the corresponding exact boundary,
    // while the whole ordinary row still fits the physical client viewport.
    return (
      (scrollTop === 0 && targetTop < viewportTop && targetBottom <= viewportBottom + 1) ||
      (scrollTop === maxScrollTop && targetBottom > viewportBottom && targetTop >= viewportTop - 1)
    );
  }
  // An oversized row cannot be fully contained. Intersection alone would hide
  // an overscroll: the edge nearest before the real key must also align.
  return (
    targetTop < viewportBottom &&
    targetBottom > viewportTop &&
    Math.abs(nearestEdge === 'start' ? targetTop - viewportTop : targetBottom - viewportBottom) <= 1
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

export type SearchGetterSample<T = string | null> = {
  startedAt: number;
  settledAt?: number;
  value?: T;
  error?: string;
  cause?: string;
};

/** Observe the original call without adding a wait, retry or locator option. */
export function traceSearchGetter<T>(
  samples: SearchGetterSample<T>[],
  read: () => Promise<T>
): Promise<T> {
  const sample: SearchGetterSample<T> = { startedAt: Date.now() };
  if (samples.length < 32) samples.push(sample);
  return read().then(
    (value) => {
      sample.settledAt = Date.now();
      sample.value = value;
      return value;
    },
    (error) => {
      sample.settledAt = Date.now();
      sample.error = String(error);
      if (error instanceof Error && error.cause !== undefined) sample.cause = String(error.cause);
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
  const targetSelector =
    'site-search [data-projection-generation-state="active"] [data-open-modal]';
  const targetObservations: unknown[] = [];
  const targetIds = new WeakMap<Element, number>();
  let nextTargetId = 0;
  let targetQueryCount = 0;
  let targetObservationCount = 0;
  let targetDropped = 0;
  let targetErrors = 0;
  let lastTargetState = '';
  let firstTarget: unknown = null;
  let firstFullyReady: unknown = null;
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
            owner: button.closest<HTMLElement>('[data-projection-generation-host]')?.dataset
              .projectionOwnerHost,
            generation: button.closest<HTMLElement>('[data-projection-generation-host]')?.dataset
              .projectionGenerationHost,
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
    recordTarget(reason: string) {
      if (stopped) return;
      targetQueryCount++;
      try {
        const selectorStartedAt = performance.now();
        const commands = document.querySelectorAll<HTMLElement>(targetSelector);
        const selectorResolvedAt = performance.now();
        const target = commands[0];
        const readStartedAt = target ? performance.now() : null;
        const host = target?.closest<HTMLElement>('[data-projection-generation-host]');
        const mount = target?.closest<HTMLElement>('[data-search-command-mount]');
        const searchRoot = target?.closest<HTMLElement>('site-search') ?? root;
        if (target && !targetIds.has(target)) targetIds.set(target, ++nextTargetId);
        const facts = {
          count: commands.length,
          targetId: target ? targetIds.get(target)! : null,
          connected: target?.isConnected ?? null,
          role: target?.getAttribute('role') ?? null,
          ariaDisabled: target?.getAttribute('aria-disabled') ?? null,
          inert: target ? !!target.closest('[inert]') : null,
          pending: target?.hasAttribute('data-pui-view-pending') ?? null,
          owner: host?.dataset.projectionOwnerHost ?? null,
          generation: host?.dataset.projectionGenerationHost ?? null,
          currentOwner: mount?.dataset.projectionOwner ?? null,
          currentGeneration: (searchRoot as HTMLElement | null)?.dataset.searchGeneration ?? null,
          // Also report the active dialog generation for Dialog-content evidence.
          dialogGeneration: (() => {
            const dialogMount = (searchRoot as HTMLElement | null)?.querySelector<HTMLElement>(
              '[data-search-dialog-mount]'
            );
            const activeHost = [
              ...(dialogMount?.querySelectorAll<HTMLElement>('[data-projection-generation-host]') ??
                []),
            ].find((host) => host.dataset.projectionGenerationState === 'active');
            return activeHost?.dataset.projectionGenerationHost ?? null;
          })(),
          view: (searchRoot as HTMLElement | null)?.dataset.searchView ?? null,
        };
        const readSettledAt = target ? performance.now() : null;
        const key = JSON.stringify(facts);
        if (key === lastTargetState) return;
        lastTargetState = key;
        const observation = {
          atMs: performance.now(),
          atEpochMs: Date.now(),
          reason,
          selectorStartedAt,
          selectorResolvedAt,
          readStartedAt,
          readSettledAt,
          ...facts,
        };
        // These are first observations at the existing deliveries, not mutation
        // times or a substitute for the original owner-bound readiness oracle.
        if (!firstTarget && facts.count) firstTarget = observation;
        if (
          !firstFullyReady &&
          facts.count === 1 &&
          facts.connected &&
          facts.role === 'button' &&
          facts.ariaDisabled === 'false' &&
          !facts.inert &&
          !facts.pending &&
          facts.owner !== null &&
          facts.owner === facts.currentOwner &&
          facts.generation !== null &&
          facts.generation === facts.currentGeneration &&
          facts.view === 'ready'
        )
          firstFullyReady = observation;
        targetObservationCount++;
        if (targetObservations.length < 32) targetObservations.push(observation);
        else targetDropped++;
      } catch {
        targetErrors++;
      }
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
      trace.recordTarget('root-found');
    },
    stop() {
      if (stopped) return;
      trace.record('stop');
      trace.recordTarget('stop');
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
        targetArrival: {
          selector: targetSelector,
          queryCount: targetQueryCount,
          observationCount: targetObservationCount,
          dropped: targetDropped,
          errors: targetErrors,
          firstTarget,
          firstFullyReady,
          observations: [...targetObservations],
        },
      };
    },
  };
  const observer = new MutationObserver(() => {
    trace.record('mutation');
    trace.recordTarget('mutation');
  });
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
  void customElements.whenDefined('site-search').then(() => {
    trace.record('defined');
    trace.recordTarget('defined');
  });
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
  owner?: string | null;
  generation?: string | null;
  browserEnteredAt?: number;
  sampleCount?: number;
  droppedSamples?: number;
  samples?: Array<{
    atEpochMs: number;
    selectorStartedAt: number;
    selectorResolvedAt: number;
    getterStartedAt: number | null;
    getterSettledAt: number | null;
    commandCount: number;
    currentDisabled: string | null;
    owner: string | null;
    generation: string | null;
    timerSample: boolean;
  }>;
};
/** The post-navigation initial-ready window is 1000ms. The clock starts after
 * networkidle; browser observer timestamps preserve the deadline even when
 * an IPC reply arrives later. This measures the active open command, not
 * Pagefind module loading or query latency after opening the native dialog. */
export const SEARCH_READINESS_BUDGET_MS = 1000;

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
    const deadline = startedAt + 1000;
    const browserEnteredAt = Date.now();
    const samples: NonNullable<SearchReadinessEvidence['samples']> = [];
    let sampleCount = 0;
    let droppedSamples = 0;
    let observer: MutationObserver | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let done = false;
    const probe = {
      sample(expired = false) {
        if (done) return;
        const selectorStartedAt = Date.now();
        const commands = document.querySelectorAll(
          'site-search [data-projection-generation-state="active"] [data-open-modal]'
        );
        const selectorResolvedAt = Date.now();
        if (commands.length > 1) {
          done = true;
          observer?.disconnect();
          if (timer !== undefined) clearTimeout(timer);
          reject(new Error('Search open command must be unique'));
          return;
        }
        const getterStartedAt = commands.length ? Date.now() : null;
        const currentDisabled = commands[0]?.getAttribute('aria-disabled') ?? null;
        const getterSettledAt = commands.length ? Date.now() : null;
        const host = commands[0]?.closest<HTMLElement>('[data-projection-generation-host]');
        const owner = host?.dataset.projectionOwnerHost;
        const generation = host?.dataset.projectionGenerationHost;
        const trace = (window as any).__puiSearchStartup?.snapshot();
        const ready = trace?.events.find(
          (event: any) =>
            event.state.view === 'ready' &&
            event.state.commands.some(
              (command: any) =>
                owner !== undefined &&
                generation !== undefined &&
                command.owner === owner &&
                command.generation === generation &&
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
        sampleCount++;
        if (samples.length < 32)
          samples.push({
            atEpochMs: Date.now(),
            selectorStartedAt,
            selectorResolvedAt,
            getterStartedAt,
            getterSettledAt,
            commandCount: commands.length,
            currentDisabled,
            owner: owner ?? null,
            generation: generation ?? null,
            timerSample: expired,
          });
        else droppedSamples++;
        if (currentDisabled !== 'false' && !expired && Date.now() < deadline) return;
        done = true;
        observer?.disconnect();
        if (timer !== undefined) clearTimeout(timer);
        resolve({
          startedAt,
          deadline,
          observedReadyAt,
          completedAt: Date.now(),
          currentDisabled,
          owner: owner ?? null,
          generation: generation ?? null,
          browserEnteredAt,
          sampleCount,
          droppedSamples,
          samples,
        });
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
