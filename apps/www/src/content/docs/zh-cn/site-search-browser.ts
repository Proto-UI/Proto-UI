// Shared real-browser acquisition and evidence. Vitest isolates each importing
// suite; every original owner, cleanup hook and deadline remains in this fixture.
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readSearchPublicState } from './site-search-public-browser';
import { revealHeaderPreferences } from './site-header-browser';
import type { Browser, Locator, Page, Request } from 'playwright-core';
import { afterAll, afterEach, beforeAll, expect } from 'vitest';
import { launchBrowser, startServer, stopServer } from './browser-harness';
import {
  installSearchStartupTrace,
  type SearchReadinessEvidence,
  traceSearchGetter,
  type SearchGetterSample,
  searchEvidenceDirectory,
  summarizePendingRequests,
  type PendingSearchRequest,
} from './site-search-evidence';

let browser: Browser;
let baseUrl: string;
let source: { sha: string; dirty: boolean };
const searchRoute = (family: 'shadcn' | 'brutalist') =>
  `/zh-cn/ui-libraries/${family}/${family === 'brutalist' ? 'components/' : ''}button/`;
const evidenceDirectory = searchEvidenceDirectory(
  process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR,
  process.env.RUNNER_TEMP ?? os.tmpdir()
);

beforeAll(async () => {
  source = {
    sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirty: !!execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
      encoding: 'utf8',
    }).trim(),
  };
  baseUrl = await startServer(searchRoute('shadcn'));
  browser = await launchBrowser();
}, 150_000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

const diagnosticPages = new Map<
  Page,
  {
    id: string;
    stage: string;
    writes: Promise<void>;
    errors: string[];
    pendingRequests: Map<Request, PendingSearchRequest>;
    startedAt: number;
    stageStartedAt: number;
    initialGetterSamples: SearchGetterSample[];
    initialReadiness?: SearchReadinessEvidence;
    initialPollFailure?: { at: number; message: string; cause: string | null };
    requests: unknown[];
    lateObservation?: { budgetMs: number; elapsedMs: number; ready: boolean };
    startupProfileRecorded?: boolean;
    originalFailure?: { name?: string; message: string; stack?: string; cause?: string };
  }
>();
function stage(page: Page, id: string, step: string) {
  const existing = diagnosticPages.get(page);
  const entry = existing ?? {
    id,
    stage: step,
    writes: Promise.resolve(),
    errors: [] as string[],
    pendingRequests: new Map<Request, PendingSearchRequest>(),
    startedAt: Date.now(),
    stageStartedAt: Date.now(),
    initialGetterSamples: [] as SearchGetterSample[],
    requests: [] as unknown[],
  };
  if (!existing) {
    page.on('request', (request) =>
      entry.pendingRequests.set(request, { url: request.url(), type: request.resourceType() })
    );
    page.on('requestfinished', (request) => {
      entry.pendingRequests.delete(request);
      entry.requests.push({ url: request.url(), outcome: 'finished' });
      if (entry.requests.length > 80) entry.requests.shift();
    });
    page.on('requestfailed', (request) => {
      entry.pendingRequests.delete(request);
      entry.requests.push({ url: request.url(), outcome: request.failure()?.errorText });
      if (entry.requests.length > 80) entry.requests.shift();
    });
    page.on('pageerror', (error) => entry.errors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') entry.errors.push(`console: ${message.text()}`);
    });
  }
  entry.id = id;
  entry.stage = step;
  entry.stageStartedAt = Date.now();
  const observation = { source, id, stage: step, at: new Date().toISOString(), url: page.url() };
  entry.writes = entry.writes.then(async () => {
    await mkdir(evidenceDirectory, { recursive: true });
    await writeFile(
      path.join(evidenceDirectory, `${id}-progress.json`),
      JSON.stringify(observation, null, 2)
    );
  });
  diagnosticPages.set(page, entry);
}
async function captureFailure(page: Page, failure?: unknown) {
  const entry = diagnosticPages.get(page);
  if (!entry) return;
  if (failure !== undefined && !entry.originalFailure) {
    entry.originalFailure =
      failure instanceof Error
        ? {
            name: failure.name,
            message: failure.message,
            stack: failure.stack,
            cause: failure.cause === undefined ? undefined : String(failure.cause),
          }
        : { message: String(failure) };
    const receipt = {
      source,
      id: entry.id,
      stage: entry.stage,
      at: new Date().toISOString(),
      error: entry.originalFailure,
    };
    // Vitest defers the file's failed assertions until it finishes. Preserve
    // the first error before any screenshot/late probe, including on CI cutoff.
    console.error('[Search failure]', JSON.stringify(receipt));
    await mkdir(evidenceDirectory, { recursive: true })
      .then(() =>
        writeFile(
          path.join(evidenceDirectory, `${entry.id}-original-failure.json`),
          JSON.stringify(receipt, null, 2)
        )
      )
      .catch((error) =>
        console.warn('[Search evidence] original error artifact unavailable', error)
      );
  }
  await capture(page, entry.id, `failure-${entry.stage}`).catch((error) =>
    console.warn('[Search evidence] failure capture unavailable', error)
  );
  // Preserve the original failed assertion. This bounded observation only
  // distinguishes late mounting from a stuck/absent owner for the next repair.
  const missingCommand = await page
    .locator('site-search [data-projection-generation-state="active"] [data-open-modal]')
    .count()
    .catch(() => -1);
  if ((entry.stage === 'initial-ready' || missingCommand === 0) && !page.isClosed()) {
    const startedAt = Date.now();
    let ready = false;
    await page
      .waitForFunction(
        () => {
          const command = document.querySelector(
            'site-search [data-projection-generation-state="active"] [data-open-modal]'
          );
          return (
            command?.getAttribute('role') === 'button' &&
            command.getAttribute('aria-disabled') === 'false'
          );
        },
        undefined,
        { timeout: 10_000 }
      )
      .then(
        () => {
          ready = true;
        },
        () => {}
      );
    entry.lateObservation = { budgetMs: 10_000, elapsedMs: Date.now() - startedAt, ready };
    await capture(page, entry.id, `late-observation-${entry.stage}`).catch((error) =>
      console.warn('[Search evidence] Late observation unavailable', error)
    );
    if (
      entry.stage === 'initial-ready' &&
      entry.initialPollFailure &&
      !entry.startupProfileRecorded
    ) {
      entry.startupProfileRecorded = true;
      // An isolated follow-on navigation attributes CPU cost. Profiling never
      // runs during the original 1000ms acceptance observation or replaces it.
      const context = await browser.newContext({ viewport: page.viewportSize() ?? undefined });
      const diagnostic = await context.newPage();
      const session = await context.newCDPSession(diagnostic);
      const target = page.url();
      try {
        if (new URL(target).origin !== new URL(baseUrl).origin)
          throw new Error('Diagnostic must remain on the owned test server');
        await session.send('Profiler.enable');
        await session.send('Profiler.start');
        await diagnostic.addInitScript(installSearchStartupTrace);
        await diagnostic.goto(target, { waitUntil: 'domcontentloaded', timeout: 15_000 });
        await diagnostic
          .waitForFunction(
            () =>
              document
                .querySelector(
                  'site-search [data-projection-generation-state="active"] [data-open-modal]'
                )
                ?.getAttribute('aria-disabled') === 'false',
            undefined,
            { timeout: 8_000 }
          )
          .catch(() => {});
        const { profile } = await session.send('Profiler.stop');
        const trace = await diagnostic.evaluate(
          () => (window as any).__puiSearchStartup?.snapshot() ?? null
        );
        await writeFile(
          path.join(evidenceDirectory, `${entry.id}-post-failure-startup.cpuprofile.json`),
          JSON.stringify(
            {
              source,
              diagnosticOnly: true,
              originalFailurePreserved: true,
              originalReadiness: entry.initialReadiness,
              target,
              viewport: page.viewportSize(),
              profile,
              trace,
            },
            null,
            2
          )
        );
      } catch (error) {
        await writeFile(
          path.join(evidenceDirectory, `${entry.id}-post-failure-profile-error.json`),
          JSON.stringify(
            { source, diagnosticOnly: true, originalFailurePreserved: true, error: String(error) },
            null,
            2
          )
        );
      } finally {
        await session.detach().catch(() => {});
        await context.close();
      }
    }
  }
}
afterEach(async () => {
  // A case-level timeout can interrupt an await before its catch/finally runs.
  for (const [page, entry] of diagnosticPages) {
    await entry.writes;
    if (!page.isClosed()) {
      await captureFailure(page);
      await page.context().close();
    }
  }
  diagnosticPages.clear();
});

async function capture(page: Page, id: string, state: string) {
  await mkdir(evidenceDirectory, { recursive: true });
  const screenshot = `${id}-${state}.png`;
  const publicSearch = await page.evaluate(readSearchPublicState);
  const observed = await page.locator('site-search').evaluate((search) => ({
    family: document.documentElement.dataset.siteLibraryFamily,
    searchState: { ...(search as HTMLElement).dataset },
    startup: {
      documentReadyState: document.readyState,
      capturedAtMs: performance.now(),
      trace: (window as any).__puiSearchStartup?.snapshot() ?? null,
      customElementDefined: !!customElements.get('site-search'),
      upgraded: search.constructor === customElements.get('site-search'),
      connected: search.isConnected,
      serviceOwnerInstalled: typeof (search as any).cleanup === 'function',
      commandRefreshInstalled: typeof (search as any).refreshCommands === 'function',
      mounts: [...search.querySelectorAll<HTMLElement>('[data-search-command-mount]')].map(
        (mount) => ({
          command: mount.dataset.searchCommandMount,
          owner: mount.dataset.projectionOwner,
          html: mount.innerHTML.slice(0, 1200),
          generations: [
            ...mount.querySelectorAll<HTMLElement>('[data-projection-generation-host]'),
          ].map((host) => ({ ...host.dataset })),
        })
      ),
      scripts: [...document.scripts]
        .filter((script) => script.src)
        .map((script) => ({ src: script.src, type: script.type })),
      resources: performance
        .getEntriesByType('resource')
        .slice(-80)
        .map((resource) => ({
          name: resource.name,
          startTime: resource.startTime,
          duration: resource.duration,
        })),
    },
    overflowElements: [...document.querySelectorAll<HTMLElement>('body *')]
      .flatMap((element) => {
        const box = element.getBoundingClientRect();
        const css = getComputedStyle(element);
        if (
          box.width <= 0 ||
          box.height <= 0 ||
          css.display === 'none' ||
          css.visibility === 'hidden' ||
          (box.right <= innerWidth + 1 && box.left >= -1)
        )
          return [];
        return [
          {
            tag: element.localName,
            id: element.id,
            classes: element.className,
            right: box.right,
            left: box.left,
            width: box.width,
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
            display: css.display,
            position: css.position,
            overflowX: css.overflowX,
            gridTemplateColumns: css.gridTemplateColumns,
            parent: element.parentElement?.className,
          },
        ];
      })
      .slice(0, 60),
    native: {
      dialog: search.querySelector('dialog')?.getBoundingClientRect().toJSON(),
      frame: search.querySelector('.dialog-frame')?.getBoundingClientRect().toJSON(),
      activeElement: document.activeElement?.outerHTML.slice(0, 2000),
      headerSelects: [
        ...document.querySelectorAll<HTMLElement>(
          '[data-docs-site-header] [data-site-select-trigger]'
        ),
      ].map((trigger) => {
        const id = trigger.getAttribute('aria-controls');
        const content = id ? document.getElementById(id) : null;
        const exposes = (content as any)?.getExposes?.();
        const css = content ? getComputedStyle(content) : null;
        return {
          id,
          expanded: trigger.getAttribute('aria-expanded'),
          connected: content?.isConnected ?? false,
          phase: exposes?.transitionState?.get?.(),
          alignmentDiagnostic: exposes?.alignmentDiagnostic?.get?.(),
          open: exposes?.open?.get?.(),
          isPresent: exposes?.isPresent?.get?.(),
          box: content?.getBoundingClientRect().toJSON(),
          display: css?.display,
          visibility: css?.visibility,
          viewDetached: content?.hasAttribute('data-pui-view-detached'),
        };
      }),
    },
    timeline: (window as any).__puiSearchTimeline ?? [],
    homepageRollback: {
      state: document.querySelector('[data-homepage-runtime]')?.getAttribute('data-runtime-state'),
      runtime: document.querySelector('[data-homepage-runtime]')?.getAttribute('data-runtime'),
      trace: (window as any).__puiSearchLateRollbackTrace ?? null,
      fault: (window as any).__puiSearchLateRollback ?? null,
    },
    theme: document.documentElement.dataset.theme,
    dialogOpen: search.querySelector('dialog')?.open,
    service: 'public-dialog-command-pagefind-api',
    focused:
      document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.className,
    commands: [
      ...search.querySelectorAll<HTMLElement>(
        '[data-projection-generation-state="active"] [data-search-command]'
      ),
    ].map((button) => ({
      command: button.dataset.searchCommand,
      generation: button.closest<HTMLElement>('[data-projection-generation-host]')?.dataset,
      tag: button.localName,
      role: button.getAttribute('role'),
      disabled: button.getAttribute('aria-disabled'),
      connected: button.isConnected,
      tabIndex: button.tabIndex,
      inertAncestor: button.closest('[inert]')?.outerHTML.slice(0, 600),
      viewPending: button.hasAttribute('data-pui-view-pending'),
      tokens: button.getAttribute('data-pui-style'),
      box: button.getBoundingClientRect().toJSON(),
      border: getComputedStyle(button).borderWidth,
      shadow: getComputedStyle(button).boxShadow,
    })),
  }));
  const entry = diagnosticPages.get(page);
  const pendingRequests = [...(entry?.pendingRequests.values() ?? [])];
  const summary = {
    source,
    id,
    state,
    elapsedMs: entry ? Date.now() - entry.startedAt : null,
    stageElapsedMs: entry ? Date.now() - entry.stageStartedAt : null,
    ...summarizePendingRequests(pendingRequests),
    owner: {
      state: observed.searchState,
      defined: observed.startup.customElementDefined,
      upgraded: observed.startup.upgraded,
      connected: observed.startup.connected,
      service: observed.startup.serviceOwnerInstalled,
      refresh: observed.startup.commandRefreshInstalled,
      mounts: observed.startup.mounts.map(({ command, owner, generations }) => ({
        command,
        owner,
        generations,
      })),
    },
    activeCommands: observed.commands.map((command) => ({
      command: command.command,
      tag: command.tag,
      role: command.role,
      disabled: command.disabled,
      connected: command.connected,
      tabIndex: command.tabIndex,
      inert: !!command.inertAncestor,
      viewPending: command.viewPending,
      generation: command.generation,
    })),
    initialGetterSamples: entry?.initialGetterSamples ?? [],
    initialReadiness: entry?.initialReadiness ?? null,
    initialPollFailure: entry?.initialPollFailure ?? null,
    startupTrace: observed.startup.trace && {
      timeOrigin: observed.startup.trace.timeOrigin,
      capturedAtMs: observed.startup.trace.capturedAtMs,
      eventCount: observed.startup.trace.eventCount,
      resourceCount: observed.startup.trace.resourceCount,
      longTaskCount: observed.startup.trace.longTaskCount,
      events: observed.startup.trace.events.slice(0, 8).map((event: any) => ({
        atMs: event.atMs,
        reason: event.reason,
        view: event.state.view,
        defined: event.state.defined,
        connected: event.state.connected,
        owners: event.state.mounts.filter((mount: any) => !!mount.owner).length,
        hosts: event.state.hosts.map((host: any) => host.projectionGenerationState),
        commands: event.state.commands.map((command: any) => ({
          command: command.command,
          role: command.role,
          disabled: command.disabled,
          inert: command.inert,
          pending: command.pending,
        })),
      })),
    },
    errorCount: entry?.errors.length ?? 0,
    lateObservation: entry?.lateObservation ?? null,
  };
  // Emit before screenshot I/O so the job log retains owner facts even when
  // screenshot capture fails. The original readiness assertion still fails.
  if (state.startsWith('failure-') || state.startsWith('late-observation-'))
    console.info('[Search evidence]', JSON.stringify(summary));
  await writeFile(
    path.join(evidenceDirectory, `${id}-${state}.json`),
    JSON.stringify(
      {
        schemaVersion: 1,
        source,
        capturedAt: new Date().toISOString(),
        screenshot,
        url: page.url(),
        viewport: page.viewportSize(),
        observed,
        publicSearch,
        errors: diagnosticPages.get(page)?.errors ?? [],
        pendingRequests: pendingRequests.map(({ url, type }) => [url, type]),
        summary,
        recentRequests: diagnosticPages.get(page)?.requests ?? [],
        lateObservation: diagnosticPages.get(page)?.lateObservation,
        renderer: 'Real Chromium via existing repository browser harness',
        scope:
          'Public family Dialog + Command composition; development harness does not prove generated-index results',
      },
      null,
      2
    )
  );
  await page.screenshot({ path: path.join(evidenceDirectory, screenshot) });
}

async function installOpenCounter(page: Page) {
  await page.addInitScript(() => {
    const timeline: unknown[] = [];
    const longTasks: unknown[] = [];
    const taskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        longTasks.push(entry.toJSON());
        if (longTasks.length > 160) longTasks.shift();
      }
    });
    taskObserver.observe({ type: 'longtask', buffered: false });
    (window as any).__puiSearchTimeline = timeline;
    (window as any).__puiSearchInteractionLongTasks = longTasks;
    (window as any).__puiSearchOpenCount = 0;
    const seen = new WeakSet<Element>();
    const stops: Array<() => void> = [];
    const currentOwner = () =>
      document.querySelector<HTMLElement>('site-search [data-search-dialog-mount]')?.dataset
        .projectionOwner;
    const record = (type: string, target: EventTarget | null, extra: unknown = null) => {
      timeline.push({
        at: performance.now(),
        type,
        target:
          target instanceof Element
            ? {
                tag: target.localName,
                ref: target.getAttribute('data-demo-ref'),
                connected: target.isConnected,
              }
            : null,
        active: document.activeElement?.outerHTML.slice(0, 800),
        extra,
      });
      if (timeline.length > 160) timeline.shift();
    };
    const scan = () => {
      const owner = currentOwner();
      if (!owner) return;
      for (const element of document.querySelectorAll<HTMLElement>(
        `[data-projection-owner="${CSS.escape(owner)}"][data-demo-ref="dialog"]`
      )) {
        // The activation matrix uses WC. Observe its actual public open state,
        // not monkeypatched HTMLDialogElement methods or test-authored DOM state.
        const state = (element as any).getExposes?.()?.open;
        if (seen.has(element) || !state?.subscribe) continue;
        seen.add(element);
        stops.push(
          state.subscribe((event: any) => {
            if (event.type !== 'next') return;
            record('public-dialog-open', element, { open: event.next });
            if (event.next === true) (window as any).__puiSearchOpenCount++;
          })
        );
      }
    };
    const observer = new MutationObserver(scan);
    observer.observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-projection-owner', 'data-demo-ref'],
    });
    for (const type of [
      'pointerdown',
      'pointerup',
      'click',
      'keydown',
      'keyup',
      'focusin',
      'focusout',
    ]) {
      for (const capture of [true, false])
        window.addEventListener(
          type,
          (event) => {
            const target = event.target;
            const owner = currentOwner();
            if (!(target instanceof Element)) return;
            const scoped = target.closest('[data-projection-owner]');
            if (
              target.closest('site-search') ||
              (owner && scoped?.getAttribute('data-projection-owner') === owner)
            )
              record(`${type}:${capture ? 'capture' : 'bubble'}`, target, {
                key: (event as KeyboardEvent).key,
                trusted: event.isTrusted,
                defaultPrevented: event.defaultPrevented,
              });
          },
          capture
        );
    }
    window.addEventListener(
      'pagehide',
      () => {
        observer.disconnect();
        taskObserver.disconnect();
        for (const off of stops) off();
      },
      { once: true }
    );
    scan();
  });
}

async function expectSearchOpenerFocus(page: Page, trigger: Locator, id: string, reason: string) {
  const samples: SearchGetterSample<boolean>[] = [];
  const poll = {
    reason,
    startedAtEpochMs: Date.now(),
    endedAtEpochMs: null as number | null,
    passed: false,
    budgetMs: 1000,
    samples,
    failure: null as { name?: string; message: string; stack?: string; cause?: string } | null,
  };
  try {
    // Preserve the original locator, predicate, poll start and 1000ms budget.
    // The bounded page journal records the actual element evaluated by each
    // original read; a later screenshot cannot stand in for this observation.
    await expect
      .poll(() =>
        traceSearchGetter(samples, () =>
          trigger.evaluate((element, reason) => {
            const state = ((window as any).__puiSearchOpenerReads ??= {
              ids: new WeakMap<Element, number>(),
              nextId: 0,
              events: [],
            });
            const describe = (node: Element | null) => {
              if (!node) return null;
              if (!state.ids.has(node)) state.ids.set(node, ++state.nextId);
              return {
                id: state.ids.get(node),
                connected: node.isConnected,
                tag: node.localName,
                ref: node.getAttribute('data-demo-ref'),
                role: node.getAttribute('role'),
                ariaDisabled: node.getAttribute('aria-disabled'),
                owner: node.getAttribute('data-projection-owner'),
                generation: node.getAttribute('data-projection-generation'),
              };
            };
            const current = document.querySelector(
              'site-search [data-projection-generation-state="active"] [data-open-modal]'
            );
            const focused = element === document.activeElement;
            if (state.events.length < 160)
              state.events.push({
                reason,
                at: performance.now(),
                epoch: Date.now(),
                timeOrigin: performance.timeOrigin,
                focused,
                sameInitialElement: element === (window as any).__puiSearchInitialOpener,
                sameCurrentElement: element === current,
                subject: describe(element),
                current: describe(current),
                active: describe(document.activeElement),
              });
            return focused;
          }, reason)
        )
      )
      .toBe(true);
    poll.passed = true;
  } catch (error) {
    poll.failure =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
            cause: error.cause === undefined ? undefined : String(error.cause),
          }
        : { message: String(error) };
    throw error;
  } finally {
    poll.endedAtEpochMs = Date.now();
    await (async () => {
      const observation = await page.evaluate(() => ({
        reads: (window as any).__puiSearchOpenerReads?.events ?? [],
        longTasks: (window as any).__puiSearchInteractionLongTasks ?? [],
      }));
      await mkdir(evidenceDirectory, { recursive: true });
      await writeFile(
        path.join(evidenceDirectory, `${id}-focus-${reason}.json`),
        JSON.stringify({ source, poll, observation }, null, 2)
      );
    })().catch((error) => console.warn('[Search evidence] Focus observation unavailable', error));
  }
}

const runtimeLabels = { wc: 'Web Components', react: 'React', vue: 'Vue', vue2: 'Vue 2' };
async function choosePageControl(page: Page, control: 'family' | 'runtime', label: string) {
  await revealHeaderPreferences(page);
  const trigger = page.locator(
    `[data-homepage-runtime] [data-projection-generation-state="active"] [data-projection-control="${control}"] [role="combobox"]`
  );
  await trigger.click();
  const id = await trigger.getAttribute('aria-controls');
  await page
    .locator(`[id=${JSON.stringify(id)}]`)
    .getByRole('option', { name: label, exact: true })
    .click();
}
async function homeReady(page: Page, family: string, runtime: string) {
  await page.waitForFunction(
    ({ family, runtime }) => {
      const home = document.querySelector<HTMLElement>('[data-homepage-runtime]');
      const search = home?.querySelector<HTMLElement>('site-search');
      return (
        home?.dataset.runtimeState === 'ready' &&
        home.dataset.family === family &&
        home.dataset.runtime === runtime &&
        search?.dataset.searchRuntime === runtime &&
        search.dataset.searchFamily === family &&
        search.dataset.searchGeneration === home.dataset.runtimeGeneration
      );
    },
    { family, runtime }
  );
}

// Geometry/focus success controls need a successful data outcome: Astro dev
// has no generated production Pagefind index. Only that external data boundary
// is controlled; the real Search/session/Command/Dialog and focus owners run.
async function installSuccessfulEmptySearchData(page: Page) {
  await page.route('**/pagefind/pagefind.js', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: `export async function options(_options) {}
        export async function search(_query) { return { results: [] }; }`,
    })
  );
}

const headerTriggerViewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1180, height: 757 },
] as const;

export {
  browser,
  baseUrl,
  source,
  searchRoute,
  evidenceDirectory,
  diagnosticPages,
  stage,
  captureFailure,
  capture,
  installOpenCounter,
  expectSearchOpenerFocus,
  runtimeLabels,
  choosePageControl,
  homeReady,
  installSuccessfulEmptySearchData,
  headerTriggerViewports,
};
