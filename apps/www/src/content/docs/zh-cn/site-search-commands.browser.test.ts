// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { searchPart, searchInput, readSearchPublicState } from './site-search-public-browser';
import { revealHeaderPreferences } from './site-header-browser';
import type { Browser, Page, Request } from 'playwright-core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser, startServer, stopServer } from './browser-harness';
import { settleFamilyQueryBatch } from './family-query-observer';
import { installDocsCallTimingObserver } from './docs-query-timing.mjs';
import { createQueryDispatchTrace } from './query-dispatch-trace.mjs';
import {
  installSearchStartupTrace,
  readSearchReadyWithinBudget,
  searchReadinessWasOnTime,
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
async function captureFailure(page: Page) {
  const entry = diagnosticPages.get(page);
  if (!entry) return;
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
    },
    timeline: (window as any).__puiSearchTimeline ?? [],
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
    (window as any).__puiSearchTimeline = timeline;
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
        for (const off of stops) off();
      },
      { once: true }
    );
    scan();
  });
}

// The standard harness serves Astro dev; actual generated-index search is proved
// development warning instead of Pagefind. These cases prove actual command
// projection, responsive layout, modal activation and focus restoration; they
// do not claim a live production index or retry has been exercised.
describe.sequential('Search family Button commands', () => {
  for (const family of ['shadcn', 'brutalist'] as const) {
    for (const theme of ['light', 'dark'] as const) {
      for (const width of [390, 1440]) {
        it(`${family} ${theme} ${width}px preserves activation, dismissal and focus`, async () => {
          const context = await browser.newContext({
            viewport: { width, height: 960 },
            colorScheme: theme,
          });
          const page = await context.newPage();
          const errors: string[] = [];
          page.on('pageerror', (error) => errors.push(error.message));
          await page.addInitScript(
            (theme) => localStorage.setItem('starlight-theme', theme),
            theme
          );
          await installOpenCounter(page);
          await page.addInitScript(installSearchStartupTrace);
          const id = `${family}-${theme}-${width}`;
          stage(page, id, 'navigate');
          try {
            const response = await page.goto(`${baseUrl}${searchRoute(family)}`, {
              waitUntil: 'networkidle',
            });
            expect(response?.ok(), `Expected existing ${family} documentation route`).toBe(true);
            const trigger = page.locator(
              'site-search [data-projection-generation-state="active"] [data-open-modal]'
            );

            stage(page, id, 'initial-ready');
            try {
              const entry = diagnosticPages.get(page)!;
              // Retain the original stage-start deadline; exclude only the
              // return trip of a browser observation already made on time.
              await traceSearchGetter(entry.initialGetterSamples, async () => {
                const evidence = await page.evaluate(readSearchReadyWithinBudget, {
                  startedAt: entry.stageStartedAt,
                });
                entry.initialReadiness = evidence;
                // Persist successful and failed observations after the browser
                // clock has decided readiness; file I/O cannot move its deadline.
                entry.writes = entry.writes.then(async () => {
                  await mkdir(evidenceDirectory, { recursive: true });
                  await writeFile(
                    path.join(evidenceDirectory, `${id}-readiness.json`),
                    JSON.stringify(
                      { source, id, evidence, onTime: searchReadinessWasOnTime(evidence) },
                      null,
                      2
                    )
                  );
                });
                return evidence.currentDisabled;
              });
              expect(
                searchReadinessWasOnTime(entry.initialReadiness!),
                JSON.stringify(entry.initialReadiness)
              ).toBe(true);
            } catch (error) {
              diagnosticPages.get(page)!.initialPollFailure = {
                at: Date.now(),
                message: String(error),
                cause:
                  error instanceof Error && error.cause ? String(error.cause).slice(0, 400) : null,
              };
              throw error;
            }
            await page.evaluate(() => (window as any).__puiSearchStartup?.stop());
            const close = await searchPart(page, 'close');
            expect(await trigger.evaluate((button) => button.localName)).toBe(
              `wc-${family}-button`
            );
            expect(await trigger.getAttribute('role')).toBe('button');
            await expect.poll(() => page.locator('html').getAttribute('data-theme')).toBe(theme);
            // Each Header consumes its public family Button presentation.
            const triggerTokens = await trigger.getAttribute('data-pui-style');
            expect(triggerTokens).toContain(
              family === 'brutalist' ? 'bg-secondary-background' : 'bg-secondary'
            );
            if (family === 'shadcn') {
              expect(triggerTokens).toContain('border-transparent');
              const rest = await trigger.evaluate((node) => ({
                border: getComputedStyle(node).borderTopColor,
                background: getComputedStyle(node).backgroundColor,
              }));
              expect(rest.border).toBe('rgba(0, 0, 0, 0)');
              expect(rest.background).not.toBe('rgba(0, 0, 0, 0)');
            } else {
              expect(triggerTokens).toContain('border-black');
              expect(triggerTokens).toContain('shadow-[4px_4px_0_0_#000]');
            }
            const box = await trigger.boundingBox();
            expect(box!.height).toBeGreaterThanOrEqual(43);
            if (width < 1100) expect(box!.width).toBeCloseTo(44, 0);
            else expect(box!.width).toBeGreaterThan(150);
            await capture(page, id, 'trigger');
            await trigger.locator('svg').click();
            await expect
              .poll(async () => (await page.evaluate(readSearchPublicState)).open)
              .toBe(true);
            expect((await page.evaluate(readSearchPublicState)).openCount).toBe(1);
            expect(await close.getAttribute('role')).toBe('button');
            expect(await close.locator('[role=button],button').count()).toBe(0);
            await capture(page, id, 'open');
            await close.click();
            await expect
              .poll(() => trigger.evaluate((element) => element === document.activeElement))
              .toBe(true);
            await trigger.press('Enter');
            await expect
              .poll(async () => (await page.evaluate(readSearchPublicState)).openCount)
              .toBe(2);
            await page.keyboard.press('Escape');
            await expect
              .poll(() => trigger.evaluate((element) => element === document.activeElement))
              .toBe(true);
            await trigger.press('Space');
            await expect
              .poll(async () => (await page.evaluate(readSearchPublicState)).openCount)
              .toBe(3);
            stage(page, id, 'backdrop');
            await page.mouse.click(2, 2);
            await expect
              .poll(async () => (await page.evaluate(readSearchPublicState)).open)
              .toBe(false);
            await expect
              .poll(() => trigger.evaluate((element) => element === document.activeElement))
              .toBe(true);
            for (const key of ['Control+k', 'Meta+k']) {
              await page.keyboard.press(key);
              await expect
                .poll(async () => (await page.evaluate(readSearchPublicState)).open)
                .toBe(true);
              await page.keyboard.press(key);
              await expect
                .poll(async () => (await page.evaluate(readSearchPublicState)).open)
                .toBe(false);
              await expect
                .poll(() => trigger.evaluate((element) => element === document.activeElement))
                .toBe(true);
            }
            for (const closeKey of ['Enter', 'Space']) {
              await trigger.click();
              await expect
                .poll(async () => (await page.evaluate(readSearchPublicState)).open)
                .toBe(true);
              await close.press(closeKey);
              await expect
                .poll(async () => (await page.evaluate(readSearchPublicState)).open)
                .toBe(false);
              await expect
                .poll(() => trigger.evaluate((node) => node === document.activeElement))
                .toBe(true);
            }
            expect((await page.evaluate(readSearchPublicState)).openCount).toBe(7);
            await capture(page, id, 'keyboard-close');
            if (width === 1440) {
              // User-reported bottom Ctrl+K regression: modal semantics may make
              // background inert, but cannot visually remove or relocate the rails.
              await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
              const rails = () =>
                page.evaluate(() => ({
                  scrollY,
                  anchorY: document.querySelector('main')!.getBoundingClientRect().y,
                  nodes: ['#starlight__sidebar', '.right-sidebar'].map((selector) => {
                    const node = document.querySelector<HTMLElement>(selector);
                    if (!node) throw new Error(`Missing required desktop rail: ${selector}`);
                    return {
                      selector,
                      box: node.getBoundingClientRect().toJSON(),
                      visible: node.checkVisibility({
                        checkOpacity: true,
                        checkVisibilityCSS: true,
                      }),
                      display: getComputedStyle(node).display,
                      visibility: getComputedStyle(node).visibility,
                      opacity: getComputedStyle(node).opacity,
                    };
                  }),
                }));
              const before = await rails();
              for (const rail of before.nodes) expect(rail.visible).toBe(true);
              await page.keyboard.press('Control+k');
              await expect
                .poll(async () => (await page.evaluate(readSearchPublicState)).open)
                .toBe(true);
              const opened = await rails();
              await writeFile(
                path.join(evidenceDirectory, `${id}-bottom-rails.json`),
                JSON.stringify({ source, before, opened }, null, 2)
              );
              for (const [index, rail] of opened.nodes.entries()) {
                expect(rail.visible).toBe(true);
                for (const key of ['x', 'y', 'width', 'height'] as const)
                  expect(
                    Math.abs(rail.box[key] - before.nodes[index].box[key])
                  ).toBeLessThanOrEqual(1);
              }
              expect(Math.abs(opened.anchorY - before.anchorY)).toBeLessThanOrEqual(1);
              await capture(page, id, 'bottom-open');
              await page.keyboard.press('Escape');
              await expect
                .poll(async () => (await page.evaluate(readSearchPublicState)).open)
                .toBe(false);
              const closed = await rails();
              await writeFile(
                path.join(evidenceDirectory, `${id}-bottom-rails.json`),
                JSON.stringify({ source, before, opened, closed }, null, 2)
              );
              expect(Math.abs(closed.scrollY - before.scrollY)).toBeLessThanOrEqual(1);
              for (const rail of closed.nodes) expect(rail.visible).toBe(true);
              await writeFile(
                path.join(evidenceDirectory, `${id}-bottom-rails.json`),
                JSON.stringify({ source, before, opened, closed }, null, 2)
              );
            }
            expect(errors).toEqual([]);
          } catch (error) {
            await captureFailure(page);
            throw error;
          } finally {
            await context.close();
          }
        }, 60_000);
      }
    }
  }
});

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

for (const viewport of headerTriggerViewports) {
  for (const family of ['shadcn', 'brutalist'] as const) {
    for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
      it(`homepage ${family}/${runtime} ${viewport.name} keeps the Search trigger centered through closed/open/reopen`, async () => {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
        });
        const page = await context.newPage();
        const id = `header-trigger-${family}-${runtime}-${viewport.name}`;
        stage(page, id, 'navigate');
        try {
          await installSuccessfulEmptySearchData(page);
          expect((await page.goto(`${baseUrl}/zh-cn/`, { waitUntil: 'networkidle' }))?.ok()).toBe(
            true
          );
          await homeReady(page, 'shadcn', 'wc');
          if (family === 'brutalist') {
            await choosePageControl(page, 'family', 'Brutalist');
            await homeReady(page, family, 'wc');
          }
          if (runtime !== 'wc') {
            await choosePageControl(page, 'runtime', runtimeLabels[runtime]);
            await homeReady(page, family, runtime);
          }
          // Compact runtime selection uses the real Header menu. Close that
          // disclosure before testing Search; do not force hidden controls.
          const menu = page.locator(
            '[data-site-header] .site-header-menu [data-projection-generation-state="active"] [data-demo-ref="home-menu"]'
          );
          if ((await menu.getAttribute('aria-expanded')) === 'true') await menu.click();
          const trigger = page.locator(
            'site-search [data-projection-generation-state="active"] [data-open-modal]'
          );
          const waitForClosedPortals = async () => {
            for (const ref of ['mask', 'panel']) {
              const part = await searchPart(page, ref);
              await expect
                .poll(async () => {
                  if ((await part.count()) === 0) return true;
                  return part.evaluate(
                    (node) =>
                      node.hasAttribute('data-pui-view-detached') &&
                      getComputedStyle(node).display === 'none'
                  );
                })
                .toBe(true);
            }
          };
          const readGeometry = () =>
            page.locator('[data-homepage-runtime]').evaluate((header) => {
              const required = (selector: string, root: Element = header) => {
                const node = root.querySelector<HTMLElement>(selector);
                if (!node) throw new Error(`Missing Header geometry target: ${selector}`);
                return node;
              };
              const rect = (node: HTMLElement) => {
                const box = node.getBoundingClientRect();
                return {
                  x: box.x,
                  y: box.y,
                  width: box.width,
                  height: box.height,
                  center: box.y + box.height / 2,
                  display: getComputedStyle(node).display,
                  lineHeight: getComputedStyle(node).lineHeight,
                };
              };
              const active = '[data-projection-generation-state="active"]';
              const search = required('site-search');
              const dialogMount = required('[data-search-dialog-mount]', search);
              const dialogContent = required(
                `${active} > .pui-projection-scope > .pui-projection-content`,
                dialogMount
              );
              const portalSelector =
                `[data-projection-owner="${CSS.escape(dialogMount.dataset.projectionOwner!)}"]` +
                `[data-projection-generation="${CSS.escape(search.dataset.searchGeneration!)}"]`;
              return {
                family: search.dataset.searchFamily,
                runtime: search.dataset.searchRuntime,
                generation: search.dataset.searchGeneration,
                wrapper: rect(required('.site-header-search')),
                trigger: rect(required(`${active} [data-open-modal]`, search)),
                peers: ['home-theme', 'home-menu'].map((ref) => ({
                  ref,
                  ...rect(required(`${active} [data-demo-ref="${ref}"]`)),
                })),
                dialogMount: rect(dialogMount),
                dialogContent: rect(dialogContent),
                dialogRoot: rect(required('[data-demo-ref="dialog"]', dialogContent)),
                portals: ['mask', 'panel'].map((ref) => ({
                  ref,
                  nodes: [
                    ...document.querySelectorAll<HTMLElement>(
                      `${portalSelector}[data-demo-ref="${ref}"]`
                    ),
                  ].map((node) => ({
                    ...rect(node),
                    transition: node.getAttribute('data-transition-state'),
                    detached: node.hasAttribute('data-pui-view-detached'),
                    outsideSearch: !search.contains(node),
                  })),
                })),
              };
            });
          // Visibility may become false at the start of leave because the
          // portal is inert. Require actual view retirement, not that early
          // snapshot, before measuring a closed owner or reopening it.
          await waitForClosedPortals();
          const initial = await readGeometry();
          expect(initial.generation).toBeTruthy();
          const recordGeometry = async (state: string, closed: boolean) => {
            stage(page, id, state);
            const geometry = await readGeometry();
            const publicState = await page.evaluate(readSearchPublicState);
            await mkdir(evidenceDirectory, { recursive: true });
            await writeFile(
              path.join(evidenceDirectory, `${id}-${state}-header-geometry.json`),
              JSON.stringify({ source, family, runtime, viewport, geometry, publicState }, null, 2)
            );
            await capture(page, id, state);
            expect(geometry.family).toBe(family);
            expect(geometry.runtime).toBe(runtime);
            expect(publicState.open).toBe(!closed);
            // Soft geometry assertions preserve every state measurement on the
            // negative control. They still fail the case, with the original 1px
            // geometry tolerance, instead of stopping at the first closed frame.
            expect.soft(Math.abs(geometry.trigger.height - 44)).toBeLessThanOrEqual(1);
            expect
              .soft(Math.abs(geometry.wrapper.height - geometry.trigger.height))
              .toBeLessThanOrEqual(1);
            expect.soft(Math.abs(geometry.trigger.y - initial.trigger.y)).toBeLessThanOrEqual(1);
            for (const peer of geometry.peers) {
              expect.soft(Math.abs(peer.height - 44)).toBeLessThanOrEqual(1);
              expect
                .soft(Math.abs(peer.center - geometry.trigger.center), peer.ref)
                .toBeLessThanOrEqual(1);
            }
            if (closed) {
              expect.soft(geometry.dialogMount.height).toBeLessThanOrEqual(1);
              expect.soft(geometry.dialogContent.height).toBeLessThanOrEqual(1);
              expect.soft(geometry.dialogRoot.height).toBeLessThanOrEqual(1);
            }
          };
          await recordGeometry('closed', true);
          for (const cycle of [0, 1]) {
            stage(page, id, cycle === 0 ? 'open' : 'reopen');
            if (cycle === 0) await trigger.click();
            else await trigger.press('Enter');
            await expect
              .poll(async () => (await page.evaluate(readSearchPublicState)).open)
              .toBe(true);
            for (const ref of ['mask', 'panel']) {
              const part = await searchPart(page, ref);
              await expect.poll(() => part.getAttribute('data-transition-state')).toBe('entered');
            }
            const panel = await searchPart(page, 'panel');
            expect(await panel.count()).toBe(1);
            expect(await panel.getAttribute('data-projection-generation')).toBe(initial.generation);
            expect(await panel.getAttribute('data-projection-family')).toBe(family);
            expect(await panel.getAttribute('data-projection-runtime')).toBe(runtime);
            expect(await panel.evaluate((node) => node.closest('site-search') === null)).toBe(true);
            await recordGeometry(cycle === 0 ? 'opened' : 'reopened', false);
            await expect
              .poll(async () => (await page.evaluate(readSearchPublicState)).inputFocused)
              .toBe(true);
            if (cycle === 0) await page.keyboard.press('Escape');
            else await (await searchPart(page, 'close')).click();
            await expect
              .poll(async () => (await page.evaluate(readSearchPublicState)).open)
              .toBe(false);
            await waitForClosedPortals();
            await recordGeometry(cycle === 0 ? 'closed-after-escape' : 'closed-after-button', true);
            await expect
              .poll(() => trigger.evaluate((node) => node === document.activeElement))
              .toBe(true);
          }
          expect(diagnosticPages.get(page)!.errors).toEqual([]);
        } catch (error) {
          await captureFailure(page);
          throw error;
        } finally {
          await context.close();
        }
      }, 60_000);
    }
  }
}

for (const width of [1280, 1440, 2048]) {
  for (const family of ['shadcn', 'brutalist'] as const) {
    it(`homepage ${family} ${width}px aligns actual Search and both selectors in every runtime`, async () => {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await installOpenCounter(page);
      try {
        expect((await page.goto(`${baseUrl}/zh-cn/`, { waitUntil: 'networkidle' }))?.ok()).toBe(
          true
        );
        await homeReady(page, 'shadcn', 'wc');
        if (family === 'brutalist') await choosePageControl(page, 'family', 'Brutalist');
        for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
          if (runtime !== 'wc') await choosePageControl(page, 'runtime', runtimeLabels[runtime]);
          await homeReady(page, family, runtime);
          const geometry = await page.locator('[data-homepage-runtime]').evaluate((home) => {
            const select = (name: string) =>
              home.querySelector<HTMLElement>(
                `[data-projection-generation-state="active"] [data-projection-control="${name}"] [role="combobox"]`
              )!;
            const search = home.querySelector<HTMLElement>(
              'site-search [data-projection-generation-state="active"] [data-open-modal]'
            )!;
            const rect = (node: HTMLElement) => {
              const box = node.getBoundingClientRect();
              return {
                x: box.x,
                y: box.y,
                width: box.width,
                height: box.height,
                bottom: box.bottom,
                center: box.y + box.height / 2,
                scrollWidth: node.scrollWidth,
                clientWidth: node.clientWidth,
              };
            };
            const selectors = ['family', 'runtime'].map((name) => {
              const trigger = select(name);
              const label = trigger
                .closest('[data-projection-control]')!
                .querySelector<HTMLElement>('.pui-projection-control-label')!;
              const value = trigger.querySelector<HTMLElement>(
                '[data-projection-prototype$="select-value"]'
              );
              return {
                name,
                trigger: rect(trigger),
                label: rect(label),
                labelText: label.textContent?.trim(),
                expectedLabel: (home as HTMLElement).dataset[`${name}Label`],
                value: value ? rect(value) : null,
                text: trigger.textContent,
              };
            });
            const searchRoot = home.querySelector<HTMLElement>('site-search')!;
            return {
              search: rect(search),
              selectors,
              overflow: document.documentElement.scrollWidth - innerWidth,
              pageGeneration: (home as HTMLElement).dataset.runtimeGeneration,
              searchGeneration: searchRoot.dataset.searchGeneration,
              commands: [
                ...searchRoot.querySelectorAll<HTMLElement>(
                  '[data-projection-generation-state="active"] [data-search-command]'
                ),
              ].map((node) => ({
                command: node.dataset.searchCommand,
                prototype: node.dataset.projectionPrototype,
                generation: node.dataset.projectionGeneration,
                runtime: node.dataset.projectionRuntime,
                family: node.dataset.projectionFamily,
              })),
            };
          });
          const id = `home-${family}-${runtime}-${width}`;
          await capture(page, id, 'geometry');
          await writeFile(
            path.join(evidenceDirectory, `${id}-rects.json`),
            JSON.stringify({ source, width, family, runtime, geometry }, null, 2)
          );
          expect(geometry.overflow).toBeLessThanOrEqual(1);
          expect(geometry.commands).toHaveLength(1);
          expect(geometry.commands[0].command).toBe('open');
          const panel = await searchPart(page, 'panel');
          expect(await panel.getAttribute('data-projection-generation')).toBe(
            geometry.pageGeneration
          );
          expect(await panel.getAttribute('data-projection-runtime')).toBe(runtime);
          expect(await panel.getAttribute('data-projection-family')).toBe(family);
          expect(Math.abs(geometry.search.height - 44)).toBeLessThanOrEqual(1);
          for (const selector of geometry.selectors) {
            expect(Math.abs(selector.trigger.height - 44)).toBeLessThanOrEqual(1);
            expect(Math.abs(selector.trigger.bottom - geometry.search.bottom)).toBeLessThanOrEqual(
              1
            );
            expect(Math.abs(selector.trigger.center - geometry.search.center)).toBeLessThanOrEqual(
              1
            );
            // The approved Header composition keeps labels accessible, not a
            // separate visible row above 36px controls. Assert exact authored AX name.
            expect(selector.expectedLabel).toBeTruthy();
            expect(selector.labelText).toBe(selector.expectedLabel);
            expect(
              await page
                .locator(
                  `[data-homepage-runtime] [data-projection-generation-state="active"] [data-projection-control="${selector.name}"]`
                )
                .getByRole('combobox', { name: selector.expectedLabel, exact: true })
                .count()
            ).toBe(1);
            expect(selector.trigger.scrollWidth - selector.trigger.clientWidth).toBeLessThanOrEqual(
              1
            );
            expect(selector.value, 'actual Select value projection').not.toBeNull();
            if (selector.value)
              expect(selector.value.scrollWidth - selector.value.clientWidth).toBeLessThanOrEqual(
                1
              );
          }
          for (const command of geometry.commands) {
            expect(command.prototype).toBe(`${family}-button`);
            expect(command.generation).toBe(geometry.pageGeneration);
            expect(command.runtime).toBe(runtime);
            expect(command.family).toBe(family);
          }
          const trigger = page.locator(
            'site-search [data-projection-generation-state="active"] [data-open-modal]'
          );
          await trigger.locator('svg').click();
          await expect
            .poll(async () => (await page.evaluate(readSearchPublicState)).open)
            .toBe(true);
          await page.keyboard.press('Escape');
          await expect
            .poll(() => trigger.evaluate((node) => node === document.activeElement))
            .toBe(true);
        }
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    }, 180_000);
  }
}

it('homepage keeps one active public Search session through runtime transitions and repeat initialization', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await installOpenCounter(page);
  stage(page, 'home-open-runtime', 'navigate');
  try {
    expect((await page.goto(`${baseUrl}/zh-cn/`, { waitUntil: 'networkidle' }))?.ok()).toBe(true);
    await homeReady(page, 'shadcn', 'wc');
    await page
      .locator('site-search [data-projection-generation-state="active"] [data-open-modal]')
      .click();
    await expect.poll(async () => (await page.evaluate(readSearchPublicState)).open).toBe(true);
    await (await searchInput(page)).fill('public-session-retained');
    await expect
      .poll(async () => (await page.evaluate(readSearchPublicState)).query)
      .toBe('public-session-retained');
    await page.evaluate(() => {
      const search = document.querySelector('site-search') as HTMLElement & {
        connectedCallback(): void;
      };
      search.connectedCallback();
      search.connectedCallback();
    });
    for (const runtime of ['react', 'vue', 'vue2', 'wc']) {
      const previousPanel = await (await searchPart(page, 'panel')).elementHandle();
      expect(previousPanel).not.toBeNull();
      const previousState = await page.evaluate(readSearchPublicState);
      await page.evaluate(
        (runtime) =>
          document.dispatchEvent(
            new CustomEvent('proto-adapter:change', { detail: { adapter: runtime } })
          ),
        runtime
      );
      await homeReady(page, 'shadcn', runtime);
      await expect.poll(async () => (await page.evaluate(readSearchPublicState)).open).toBe(true);
      await expect.poll(() => previousPanel!.evaluate((node) => node.isConnected)).toBe(false);
      const currentState = await page.evaluate(readSearchPublicState);
      expect(currentState.generation).not.toBe(previousState.generation);
      expect(currentState.query).toBe(previousState.query);
      const panel = await searchPart(page, 'panel');
      expect(await panel.count()).toBe(1);
      expect(await panel.getAttribute('data-projection-runtime')).toBe(runtime);
      stage(page, 'home-open-runtime', `${runtime}-close-focus`);
      await (await searchPart(page, 'close')).click();
      const trigger = page.locator(
        'site-search [data-projection-generation-state="active"] [data-open-modal]'
      );
      await expect
        .poll(() => trigger.evaluate((node) => node === document.activeElement))
        .toBe(true);
      await trigger.press('Space');
      await expect.poll(async () => (await page.evaluate(readSearchPublicState)).open).toBe(true);
      await previousPanel!.dispose();
    }
    await capture(page, 'home-open-runtime', 'final');
  } catch (error) {
    await captureFailure(page);
    throw error;
  } finally {
    await context.close();
  }
}, 120_000);

it('keeps a documentation link available without JavaScript', async () => {
  const startedAt = Date.now();
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const steps: Array<{ stage: string; elapsedMs: number; url: string }> = [];
  const responses: Array<{ url: string; status: number; elapsedMs: number }> = [];
  let nativeHref: string | null = null;
  let headingText: string | null = null;
  let outcome = 'pending';
  const mark = (step: string) => {
    stage(page, 'no-js', step);
    steps.push({ stage: step, elapsedMs: Date.now() - startedAt, url: page.url() });
  };
  page.on('response', (response) => {
    if (response.request().isNavigationRequest() && response.request().frame() === page.mainFrame())
      responses.push({
        url: response.url(),
        status: response.status(),
        elapsedMs: Date.now() - startedAt,
      });
  });
  try {
    mark('navigate-source');
    const sourceResponse = await page.goto(`${baseUrl}${searchRoute('shadcn')}`, {
      timeout: 10_000,
    });
    expect(sourceResponse?.ok()).toBe(true);
    mark('find-native-link');
    const link = page.locator('site-search noscript a');
    expect(await link.isVisible()).toBe(true);
    nativeHref = await link.getAttribute('href');
    expect(nativeHref).not.toBeNull();
    expect(new URL(nativeHref!, page.url()).origin).toBe(new URL(baseUrl).origin);
    expect(new URL(nativeHref!, page.url()).pathname).toBe('/zh-cn/ui-libraries/');
    mark('click-native-link');
    const [destinationResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().isNavigationRequest() &&
          response.request().frame() === page.mainFrame() &&
          new URL(response.url()).pathname === '/zh-cn/ui-libraries/',
        { timeout: 10_000 }
      ),
      page.waitForURL('**/zh-cn/ui-libraries/', { timeout: 10_000 }),
      link.click({ timeout: 10_000 }),
    ]);
    expect(destinationResponse.ok()).toBe(true);
    mark('destination-heading');
    const heading = page.getByRole('heading', { level: 1, name: 'UI Libraries', exact: true });
    expect(await heading.isVisible()).toBe(true);
    headingText = await heading.innerText();
    expect(headingText).toBe('UI Libraries');
    expect(new URL(page.url()).pathname).toBe('/zh-cn/ui-libraries/');
    outcome = 'passed';
    mark('complete');
    await capture(page, 'no-js', 'destination');
  } catch (error) {
    outcome = 'failed';
    mark('failure');
    await captureFailure(page);
    throw error;
  } finally {
    await mkdir(evidenceDirectory, { recursive: true });
    await writeFile(
      path.join(evidenceDirectory, 'no-js-navigation.json'),
      JSON.stringify(
        {
          source,
          outcome,
          javaScriptEnabled: false,
          totalBudgetMs: 20_000,
          navigationBudgetMs: 10_000,
          elapsedMs: Date.now() - startedAt,
          steps,
          responses,
          nativeHref,
          headingText,
          finalUrl: page.url(),
        },
        null,
        2
      )
    );
    await context.close();
  }
  // The implicit Vitest 5s total failed after the correct destination arrived.
  // Keep finite per-navigation and total budgets, without retry or sleep.
}, 20_000);

for (const width of [320, 390, 1280, 1440, 2048]) {
  for (const family of ['shadcn', 'brutalist'] as const) {
    it(`Docs ${family} ${width}px shows complete runtime values beside real Search`, async () => {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      const page = await context.newPage();
      const roleTiming = installDocsCallTimingObserver(page, {
        sdkRoot: path.dirname(
          createRequire(import.meta.url).resolve('playwright-core/package.json')
        ),
      });
      const dispatchTrace =
        family === 'shadcn' && width === 1440 && process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR
          ? createQueryDispatchTrace(
              page,
              path.join(evidenceDirectory, 'query-dispatch-shadcn-1440')
            )
          : null;
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      try {
        await dispatchTrace?.prepare();
        await page.addInitScript(roleTiming.targetObserver, roleTiming.initOptions);
        const response = await page.goto(`${baseUrl}${searchRoute(family)}`, {
          waitUntil: 'networkidle',
        });
        expect(response?.ok()).toBe(true);
        const selector = page
          .locator('[data-docs-site-header] [data-adapter-select] [data-site-select-trigger]')
          .first();
        const roleGetters: SearchGetterSample[] = [];
        const roleRequests: Array<{ call: number; request: Promise<string | null> }> = [];
        let roleCalls = 0;
        let rolePassed = false;
        let roleObserverError = false;
        let roleVerdict: {
          frozenAt: number;
          calls: number;
          references: number;
          samples: SearchGetterSample[];
        } | null = null;
        try {
          await expect
            .poll(() => {
              const call = ++roleCalls;
              return traceSearchGetter(roleGetters, () => {
                const request = roleTiming.runOriginalQuery(call, () =>
                  selector.getAttribute('role')
                );
                try {
                  roleRequests.push({ call, request });
                } catch {
                  roleObserverError = true;
                }
                return request;
              });
            })
            .toBe('combobox');
          rolePassed = true;
        } finally {
          try {
            roleTiming.freezeVerdict(rolePassed);
          } catch {
            roleObserverError = true;
          }
          try {
            const frozen = roleGetters.map((sample) => ({ ...sample }));
            roleVerdict = {
              frozenAt: Date.now(),
              calls: roleCalls,
              references: roleRequests.length,
              samples: frozen,
            };
            console.log(
              '[Docs role readiness]',
              JSON.stringify({
                source,
                family,
                width,
                frozenAt: roleVerdict.frozenAt,
                passed: rolePassed,
                calls: roleCalls,
                dropped: Math.max(0, roleCalls - frozen.length),
                pending: frozen.filter((sample) => sample.settledAt === undefined).length,
                samples: frozen,
              })
            );
          } catch {
            roleObserverError = true;
            // Diagnostics must not replace the original poll verdict.
          }
          const verdict = roleVerdict;
          try {
            dispatchTrace?.markVerdict(roleTiming.snapshot());
          } catch {
            // Diagnostics must not replace the original poll verdict.
          }
          if (!rolePassed && verdict) {
            try {
              const startedMs = performance.now();
              const budgetMs = 2000;
              const deadlineMs = startedMs + budgetMs;
              let drainedReferences = 0;
              let budgetExpired = false;
              let droppedOutcomes = 0;
              const outcomes: Array<Record<string, unknown>> = [];
              while (drainedReferences < roleRequests.length) {
                const batch = roleRequests.slice(drainedReferences);
                const result = await settleFamilyQueryBatch(
                  batch.map(({ request }) => request),
                  Math.max(0, deadlineMs - performance.now())
                );
                if (!result.complete) {
                  budgetExpired = true;
                  break;
                }
                const batchObservedMs = performance.now();
                result.outcomes.forEach((outcome, index) => {
                  if (outcomes.length < 32)
                    outcomes.push({
                      call: batch[index]!.call,
                      status: outcome.status,
                      ...('value' in outcome
                        ? { value: outcome.value }
                        : { error: String(outcome.reason).slice(0, 400) }),
                      batchObservedMs,
                    });
                  else droppedOutcomes++;
                });
                drainedReferences += batch.length;
              }
              const finishedMs = performance.now();
              // This is a drain-point snapshot, not proof that Vitest cannot retry later.
              console.log(
                '[Docs role settlement]',
                JSON.stringify({
                  source,
                  family,
                  width,
                  verdict,
                  nodeTimeOrigin: performance.timeOrigin,
                  startedMs,
                  finishedMs,
                  budgetMs,
                  budgetExpired,
                  drainedReferences,
                  referencesAtDrainPoint: roleRequests.length,
                  callsAtDrainPoint: roleCalls,
                  issuedAfterVerdict: roleCalls - verdict.calls,
                  pendingRecordedSamples: roleGetters.filter(
                    (sample) => sample.settledAt === undefined
                  ).length,
                  droppedSamples: Math.max(0, roleCalls - roleGetters.length),
                  outcomes,
                  droppedOutcomes,
                  observerError: roleObserverError,
                  completeAtDrainPoint:
                    !roleObserverError &&
                    !budgetExpired &&
                    drainedReferences === roleRequests.length,
                })
              );
            } catch {
              // Missing observation is evidence debt, not a replacement verdict.
            }
          }
        }
        await revealHeaderPreferences(page);
        for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
          if (runtime !== 'wc') {
            await selector.click();
            const listboxId = await selector.getAttribute('aria-controls');
            expect(listboxId).toBeTruthy();
            await page
              .locator(`[id=${JSON.stringify(listboxId)}]`)
              .getByRole('option', { name: runtimeLabels[runtime], exact: true })
              .click();
          }
          await page.waitForFunction(
            ({ family, runtime }) => {
              const search = document.querySelector<HTMLElement>('site-search');
              return (
                search?.dataset.searchRuntime === runtime && search.dataset.searchFamily === family
              );
            },
            { family, runtime }
          );
          const geometry = await page.locator('[data-docs-site-header]').evaluate((header) => {
            const rect = (element: Element) => {
              const box = element.getBoundingClientRect();
              return {
                ...box.toJSON(),
                center: box.y + box.height / 2,
                scrollWidth: element.scrollWidth,
                clientWidth: element.clientWidth,
              };
            };
            const select = header.querySelector<HTMLElement>(
              '[data-adapter-select] [data-site-select-trigger]'
            )!;
            const value = select.querySelector<HTMLElement>(
              'wc-shadcn-select-value, wc-brutalist-select-value'
            )!;
            const search = header.querySelector<HTMLElement>(
              'site-search [data-projection-generation-state="active"] [data-open-modal]'
            )!;
            const label = header.querySelector<HTMLElement>('.site-header-runtime-label')!;
            const text = document.createRange();
            text.selectNodeContents(value);
            return {
              header: rect(header),
              select: rect(select),
              search: rect(search),
              label: rect(label),
              labelDisplay: getComputedStyle(label).display,
              value: rect(value),
              valueText: value.textContent?.trim(),
              textWidth: text.getBoundingClientRect().width,
              selectTag: select.localName,
              searchRole: search.getAttribute('role'),
              searchDisabled: search.getAttribute('aria-disabled'),
              overflow: document.documentElement.scrollWidth - innerWidth,
              sidebarTop: parseFloat(
                getComputedStyle(document.querySelector('.mobile-sidebar-pane')!).top
              ),
            };
          });
          // Save the actual measured geometry even when the assertion below fails.
          const id = `docs-${family}-${runtime}-${width}`;
          await capture(page, id, 'geometry');
          await writeFile(
            path.join(evidenceDirectory, `${id}-rects.json`),
            JSON.stringify({ source, family, runtime, width, geometry }, null, 2)
          );
          expect(geometry.selectTag).toBe(`wc-${family}-select-trigger`);
          expect(geometry.valueText).toBe(runtimeLabels[runtime]);
          expect(geometry.value.scrollWidth - geometry.value.clientWidth).toBeLessThanOrEqual(1);
          expect(geometry.textWidth - geometry.value.width).toBeLessThanOrEqual(1);
          expect(geometry.select.scrollWidth - geometry.select.clientWidth).toBeLessThanOrEqual(1);
          expect(geometry.overflow).toBeLessThanOrEqual(1);
          expect(Math.abs(geometry.select.height - (width < 768 ? 44 : 36))).toBeLessThanOrEqual(1);
          expect(Math.abs(geometry.search.height - 44)).toBeLessThanOrEqual(1);
          expect(geometry.searchRole).toBe('button');
          expect(geometry.searchDisabled).toBe('false');
          if (width < 1100) {
            expect(geometry.labelDisplay).not.toBe('none');
            expect(geometry.label.bottom).toBeLessThanOrEqual(geometry.select.y + 1);
            expect(geometry.search.bottom).toBeLessThanOrEqual(geometry.label.y + 1);
            expect(Math.abs(geometry.sidebarTop - geometry.header.bottom)).toBeLessThanOrEqual(1);
          } else {
            expect(Math.abs(geometry.select.center - geometry.search.center)).toBeLessThanOrEqual(
              1
            );
          }
        }
        expect(errors).toEqual([]);
      } finally {
        let contextClosed = false;
        try {
          try {
            dispatchTrace?.beforeContextClose();
          } catch {
            // Trace teardown cannot prevent the original context close.
          }
          roleTiming.markContextCloseStart();
          await context.close();
          contextClosed = true;
        } finally {
          try {
            roleTiming.disposeAfterContextClosed(contextClosed);
            await mkdir(evidenceDirectory, { recursive: true });
            await writeFile(
              path.join(evidenceDirectory, `docs-call-timing-${family}-${width}.json`),
              JSON.stringify(
                { source, family, width, contextClosed, observation: roleTiming.snapshot() },
                null,
                2
              )
            );
          } catch {
            // Missing diagnostics must not replace the original verdict or cleanup.
          }
          try {
            await dispatchTrace?.finish(contextClosed, roleTiming.snapshot());
          } catch {
            // Diagnostic capture cannot replace the original error or cleanup.
          }
        }
      }
    }, 180_000);
  }
}

for (const width of [320, 390]) {
  for (const family of ['shadcn', 'brutalist'] as const) {
    it(`Docs ${family} ${width}px keeps enlarged 200% text reachable without clipping`, async () => {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const id = `docs-${family}-font-200-${width}`;
      stage(page, id, 'font-navigate');
      try {
        expect(
          (await page.goto(`${baseUrl}${searchRoute(family)}`, { waitUntil: 'networkidle' }))?.ok()
        ).toBe(true);
        // This is actual browser font enlargement, not DPR or a claim of native
        // browser zoom. Keep viewport unchanged so text must genuinely reflow.
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '200%';
        });
        const header = page.locator('[data-docs-site-header]');
        const select = header.locator('[data-adapter-select] [data-site-select-trigger]').first();
        await expect.poll(() => select.getAttribute('role')).toBe('combobox');
        await page.waitForFunction(() => {
          const root = document.querySelector<HTMLElement>('[data-docs-site-header]')!;
          const frame = root.closest<HTMLElement>('.site-page-frame')!;
          return frame.style.getPropertyValue('--header-height') === `${root.offsetHeight}px`;
        });
        await revealHeaderPreferences(page);
        stage(page, id, 'font-geometry');
        await capture(page, id, 'before-geometry');
        const geometry = await header.evaluate((header) => {
          const select = header.querySelector<HTMLElement>(
            '[data-adapter-select] [data-site-select-trigger]'
          )!;
          const value = select.querySelector<HTMLElement>(
            'wc-shadcn-select-value, wc-brutalist-select-value'
          )!;
          const search = header.querySelector<HTMLElement>(
            'site-search [data-projection-generation-state="active"] [data-open-modal]'
          )!;
          const label = header.querySelector<HTMLElement>('.site-header-runtime-label')!;
          const text = document.createRange();
          text.selectNodeContents(value);
          return {
            enlargement: 'documentElement font-size: 200%; viewport unchanged',
            viewportWidth: innerWidth,
            dpr: devicePixelRatio,
            rootFontSize: getComputedStyle(document.documentElement).fontSize,
            selectFontSize: getComputedStyle(select).fontSize,
            header: header.getBoundingClientRect().toJSON(),
            select: select.getBoundingClientRect().toJSON(),
            search: search.getBoundingClientRect().toJSON(),
            label: label.getBoundingClientRect().toJSON(),
            value: value.getBoundingClientRect().toJSON(),
            text: text.getBoundingClientRect().toJSON(),
            valueText: value.textContent?.trim(),
            valueOverflow: value.scrollWidth - value.clientWidth,
            pageOverflow: document.documentElement.scrollWidth - innerWidth,
          };
        });
        await capture(page, id, 'geometry');
        await writeFile(
          path.join(evidenceDirectory, `${id}-rects.json`),
          JSON.stringify({ source, family, width, geometry }, null, 2)
        );
        expect(geometry.rootFontSize).toBe('32px');
        expect(geometry.selectFontSize).toBe('28px');
        expect(geometry.valueText).toBe('Web Components');
        expect(geometry.valueOverflow).toBeLessThanOrEqual(1);
        expect(geometry.pageOverflow).toBeLessThanOrEqual(1);
        expect(geometry.text.left).toBeGreaterThanOrEqual(geometry.value.left - 1);
        expect(geometry.text.right).toBeLessThanOrEqual(geometry.value.right + 1);
        expect(geometry.text.bottom).toBeLessThanOrEqual(geometry.select.bottom + 1);
        expect(geometry.label.bottom).toBeLessThanOrEqual(geometry.select.y + 1);
        expect(geometry.select.height).toBeGreaterThanOrEqual(44);
        expect(geometry.search.height).toBeGreaterThanOrEqual(44);
        expect(geometry.search.width).toBeGreaterThanOrEqual(44);
        const beforePortal = await header.boundingBox();
        await select.click();
        const listboxId = await select.getAttribute('aria-controls');
        expect(await page.locator(`[id=${JSON.stringify(listboxId)}]`).isVisible()).toBe(true);
        expect((await header.boundingBox())!.height).toBe(beforePortal!.height);
        await page.keyboard.press('Escape');
        // The root-font gate covers the actual public modal as well as its trigger.
        // A short viewport must not clip the editor/Close just because the result list shrinks.
        for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
          const modalId = `${id}-${runtime}`;
          if ((await page.locator('site-search').getAttribute('data-search-runtime')) !== runtime) {
            await revealHeaderPreferences(page);
            await select.click();
            const optionsId = await select.getAttribute('aria-controls');
            expect(optionsId).toBeTruthy();
            await page
              .locator(`[id=${JSON.stringify(optionsId)}]`)
              .getByRole('option', { name: runtimeLabels[runtime], exact: true })
              .click();
          }
          await page.waitForFunction((runtime) => {
            const search = document.querySelector<HTMLElement>('site-search');
            return (
              search?.dataset.searchRuntime === runtime && search.dataset.searchView === 'ready'
            );
          }, runtime);
          const originalViewport = page.viewportSize();
          if (!originalViewport) throw new Error('Expected explicit Search test viewport');
          await page.setViewportSize({ width: originalViewport.width, height: 390 });
          await header
            .locator('site-search [data-projection-generation-state="active"] [data-open-modal]')
            .click();
          const panel = await searchPart(page, 'panel');
          const editor = await searchInput(page);
          const close = await searchPart(page, 'close');
          const scrollBody = await searchPart(page, 'scroll-body');
          const list = await searchPart(page, 'list');
          const status = await searchPart(page, 'status');
          expect(await scrollBody.evaluate((node) => getComputedStyle(node).overflowY)).toBe(
            'auto'
          );
          expect(await list.evaluate((node) => getComputedStyle(node).overflowY)).toBe('auto');
          expect(await list.evaluate((node) => getComputedStyle(node).maxHeight)).not.toBe('none');
          await editor.waitFor({ state: 'visible' });
          const [panelGeometry, editorGeometry, closeGeometry] = await Promise.all(
            [panel, editor, close].map((part) =>
              part.evaluate((node) => {
                const box = node.getBoundingClientRect();
                const center = document.elementFromPoint(
                  box.x + box.width / 2,
                  box.y + box.height / 2
                );
                return {
                  box: box.toJSON(),
                  ownsCenter: center === node || (!!center && node.contains(center)),
                };
              })
            )
          );
          const modal = {
            panel: panelGeometry,
            editor: editorGeometry,
            close: closeGeometry,
            width: originalViewport.width,
            height: 390,
          };
          await capture(page, modalId, 'root-font-short-modal');
          await writeFile(
            path.join(evidenceDirectory, `${modalId}-modal-rects.json`),
            JSON.stringify({ source, family, runtime, width, modal }, null, 2)
          );
          for (const part of [modal.panel, modal.editor, modal.close]) {
            expect(part.box.width).toBeGreaterThan(0);
            expect(part.box.height).toBeGreaterThan(0);
            expect(part.box.left).toBeGreaterThanOrEqual(-1);
            expect(part.box.right).toBeLessThanOrEqual(modal.width + 1);
            expect(part.box.top).toBeGreaterThanOrEqual(-1);
            expect(part.box.bottom).toBeLessThanOrEqual(modal.height + 1);
          }
          expect(modal.editor.ownsCenter).toBe(true);
          expect(modal.close.ownsCenter).toBe(true);
          const statusText = await status.textContent();
          expect(statusText?.trim()).toBeTruthy();
          await status.evaluate((node) => node.scrollIntoView({ block: 'end' }));
          const lastText = await status.evaluate((node) => {
            const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
            let last: Text | null = null;
            for (let text = walker.nextNode(); text; text = walker.nextNode()) {
              if (text.textContent?.length) last = text as Text;
            }
            if (!last) throw new Error('Expected complete live status text');
            const range = document.createRange();
            range.setStart(last, last.length - 1);
            range.setEnd(last, last.length);
            return range.getBoundingClientRect().toJSON();
          });
          const bodyBox = await scrollBody.boundingBox();
          expect(bodyBox).not.toBeNull();
          if (!bodyBox) throw new Error('Expected visible Search scroll body');
          expect(lastText.bottom).toBeLessThanOrEqual(bodyBox.y + bodyBox.height + 1);
          expect(await status.textContent()).toBe(statusText);
          await close.click();
          await expect
            .poll(async () => (await page.evaluate(readSearchPublicState)).open)
            .toBe(false);
          await header
            .locator('site-search [data-projection-generation-state="active"] [data-open-modal]')
            .click();
          const keyboardClose = await searchPart(page, 'close');
          await keyboardClose.focus();
          await page.keyboard.press('Enter');
          await expect
            .poll(async () => (await page.evaluate(readSearchPublicState)).open)
            .toBe(false);
          await page.setViewportSize(originalViewport);
        }
        // Keep all geometry assertions on the Button page above. Brutalist
        // Button has no authored section heading, so verify sticky offsets on
        // the same family's real Card contract section instead.
        const headingRoute =
          family === 'brutalist'
            ? '/zh-cn/ui-libraries/brutalist/components/card/'
            : searchRoute(family);
        if (new URL(page.url()).pathname !== headingRoute) {
          stage(page, id, 'heading-navigation');
          const response = await page.goto(`${baseUrl}${headingRoute}`, {
            waitUntil: 'networkidle',
          });
          expect(response?.ok()).toBe(true);
          await page.evaluate(() => {
            document.documentElement.style.fontSize = '200%';
          });
          await expect.poll(() => select.getAttribute('role')).toBe('combobox');
          await page.waitForFunction(() => {
            const root = document.querySelector<HTMLElement>('[data-docs-site-header]')!;
            const frame = root.closest<HTMLElement>('.site-page-frame')!;
            return frame.style.getPropertyValue('--header-height') === `${root.offsetHeight}px`;
          });
        }
        stage(page, id, 'heading-offset');
        const heading = page.locator('[data-doc-flow] h2[id]').first();
        expect(await heading.count()).toBe(1);
        expect(await heading.isVisible()).toBe(true);
        const headingFacts = await heading.evaluate((element) => ({
          id: element.id,
          text: element.textContent?.trim(),
          inActualFlow: !!element.closest('[data-doc-flow]'),
          route: location.pathname,
          rootFontSize: getComputedStyle(document.documentElement).fontSize,
          box: element.getBoundingClientRect().toJSON(),
          scrollMarginTop: parseFloat(getComputedStyle(element).scrollMarginTop),
        }));
        await writeFile(
          path.join(evidenceDirectory, `${id}-heading.json`),
          JSON.stringify({ source, family, width, headingFacts }, null, 2)
        );
        expect(headingFacts.inActualFlow).toBe(true);
        expect(headingFacts.route).toBe(headingRoute);
        expect(headingFacts.rootFontSize).toBe('32px');
        expect(headingFacts.text).toContain(family === 'brutalist' ? '契约' : '安装');
        expect(headingFacts.id).toBeTruthy();
        expect(headingFacts.text).toBeTruthy();
        expect(headingFacts.box.width).toBeGreaterThan(0);
        expect(headingFacts.box.height).toBeGreaterThan(0);
        expect(headingFacts.scrollMarginTop).toBeGreaterThanOrEqual(
          (await header.boundingBox())!.height
        );
        await heading.evaluate((element) => element.scrollIntoView({ block: 'start' }));
        await expect
          .poll(
            async () =>
              (await heading.boundingBox())!.y -
              (await header.boundingBox())!.y -
              (await header.boundingBox())!.height
          )
          .toBeGreaterThanOrEqual(-1);
        expect((await heading.boundingBox())!.y).toBeLessThan(1000);
        // The same-route Shadcn journey already revealed settings above;
        // the different-route Brutalist journey has a new closed disclosure.
        // Follow its actual state rather than toggling the first one closed.
        await revealHeaderPreferences(page);
        const preferencesPanel = header.locator('[data-site-header-panel]');
        expect(await header.locator('[data-site-menu-button]').getAttribute('aria-expanded')).toBe(
          'true'
        );
        expect(await preferencesPanel.isVisible()).toBe(true);
        const panelBox = (await preferencesPanel.boundingBox())!;
        const headerBox = (await header.boundingBox())!;
        expect(panelBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height - 1);
        expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(1001);
        await capture(page, id, 'menu-and-heading');
        expect(errors).toEqual([]);
      } catch (error) {
        await captureFailure(page);
        throw error;
      } finally {
        await context.close();
      }
    }, 90_000);
  }
}

// Transport-only fixture: real page, Dialog/Command, adapters, keyboard and scroll.
// This does not replace the separate generated Pagefind index acceptance.
for (const family of ['shadcn', 'brutalist'] as const) {
  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
    it(`Search ${family}/${runtime} keeps nested scrollports and dismissal reachable at 200%`, async () => {
      const context = await browser.newContext({
        viewport: { width: 320, height: 390 },
        hasTouch: true,
      });
      const page = await context.newPage();
      const id = `search-scroll-${family}-${runtime}`;
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      stage(page, id, 'controlled-data-navigation');
      await page.route('**/pagefind/pagefind.js', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'text/javascript',
          body: `let failed = false;
          export async function options() {}
          export async function search(query) {
            if (query === 'failure' && !failed) { failed = true; throw new Error('Controlled data failure'); }
            if (query === 'loading') await new Promise(resolve => window.addEventListener('release-search-data', resolve, {once:true}));
            if (query === 'empty' || query === 'failure' || query === 'loading') return {results:[]};
            return {results:Array.from({length:20}, (_,i)=>({id:String(i),data:async()=>({url:'/docs/result-'+i,meta:{title:'Result '+i+' — documentation details'}})}))};
          }`,
        })
      );
      try {
        expect(
          (await page.goto(`${baseUrl}${searchRoute(family)}`, { waitUntil: 'networkidle' }))?.ok()
        ).toBe(true);
        const header = page.locator('[data-docs-site-header]');
        const select = header.locator('[data-adapter-select] [data-site-select-trigger]').first();
        await revealHeaderPreferences(page);
        if ((await page.locator('site-search').getAttribute('data-search-runtime')) !== runtime) {
          await select.click();
          const optionsId = await select.getAttribute('aria-controls');
          expect(optionsId).toBeTruthy();
          await page
            .locator(`[id=${JSON.stringify(optionsId)}]`)
            .getByRole('option', { name: runtimeLabels[runtime], exact: true })
            .click();
        }
        await page.waitForFunction((runtime) => {
          const search = document.querySelector<HTMLElement>('site-search');
          return search?.dataset.searchRuntime === runtime && search.dataset.searchView === 'ready';
        }, runtime);
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '200%';
        });
        await header
          .locator('site-search [data-projection-generation-state="active"] [data-open-modal]')
          .click();
        const editor = await searchInput(page);
        const list = await searchPart(page, 'list');
        const body = await searchPart(page, 'scroll-body');
        const close = await searchPart(page, 'close');
        const status = await searchPart(page, 'status');
        const checkClose = async () => {
          const geometry = await close.evaluate((node) => {
            const box = node.getBoundingClientRect();
            const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
            return { box: box.toJSON(), hit: hit === node || (!!hit && node.contains(hit)) };
          });
          expect(geometry.box.top).toBeGreaterThanOrEqual(-1);
          expect(geometry.box.bottom).toBeLessThanOrEqual(391);
          expect(geometry.box.left).toBeGreaterThanOrEqual(-1);
          expect(geometry.box.right).toBeLessThanOrEqual(321);
          expect(geometry.hit).toBe(true);
          return geometry;
        };
        await editor.fill('many');
        await expect.poll(() => list.getByRole('option').count()).toBe(20);
        await editor.press('End');
        const last = list.getByRole('option').last();
        await expect.poll(() => last.getAttribute('aria-selected')).toBe('true');
        const lastBox = await last.boundingBox();
        const bodyBox = await body.boundingBox();
        expect(lastBox).not.toBeNull();
        expect(bodyBox).not.toBeNull();
        if (!lastBox || !bodyBox) throw new Error('Expected last result inside live scroll body');
        expect(lastBox.y).toBeGreaterThanOrEqual(bodyBox.y - 1);
        expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(bodyBox.y + bodyBox.height + 1);
        await checkClose();
        await editor.press('Home');
        await expect
          .poll(() => list.getByRole('option').first().getAttribute('aria-selected'))
          .toBe('true');
        const before = await Promise.all([
          list.evaluate((n) => n.scrollTop),
          body.evaluate((n) => n.scrollTop),
        ]);
        const touch = await context.newCDPSession(page);
        try {
          const box = await body.boundingBox();
          if (!box || box.height < 20) throw new Error('Expected touch-scrollable body');
          const x = box.x + box.width / 2,
            y = box.y + box.height - 5;
          await touch.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x, y }],
          });
          await touch.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x, y: box.y + 5 }],
          });
          await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          await expect
            .poll(async () => {
              const after = await Promise.all([
                list.evaluate((n) => n.scrollTop),
                body.evaluate((n) => n.scrollTop),
              ]);
              return after.some((value, index) => value > before[index]!);
            })
            .toBe(true);
        } finally {
          await touch.detach();
        }
        await checkClose();
        const phases: unknown[] = [];
        for (const query of ['failure', 'loading', 'empty']) {
          await editor.fill(query);
          const expected =
            query === 'failure'
              ? '搜索暂不可用，请重试'
              : query === 'loading'
                ? '正在加载搜索…'
                : '0 条匹配文档';
          await expect.poll(() => status.textContent()).toBe(expected);
          phases.push({
            query,
            renderedStatus: await status.textContent(),
            close: await checkClose(),
          });
          if (query === 'failure') {
            const retry = await searchPart(page, 'search-page-action');
            await retry.scrollIntoViewIfNeeded();
            await retry.click();
            await expect.poll(() => status.textContent()).toBe('0 条匹配文档');
          }
          if (query === 'loading')
            await page.evaluate(() => window.dispatchEvent(new Event('release-search-data')));
        }
        await capture(page, id, 'keyboard-touch-state-geometry');
        await writeFile(
          path.join(evidenceDirectory, `${id}-states.json`),
          JSON.stringify(
            {
              source,
              family,
              runtime,
              phases,
              scope: 'controlled Pagefind data only; real native composition',
            },
            null,
            2
          )
        );
        await close.focus();
        await page.keyboard.press('Enter');
        await expect
          .poll(async () => (await page.evaluate(readSearchPublicState)).open)
          .toBe(false);
        expect(errors).toEqual([]);
      } catch (error) {
        await captureFailure(page);
        throw error;
      } finally {
        await context.close();
      }
    }, 90_000);
  }
}

// These cases observe the actual editor and physical portal, not only a Header
// runtime label. An empty controlled Pagefind response is not production search
// relevance, multi-result scrolling or latency evidence.
for (const viewport of headerTriggerViewports) {
  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
    it(`homepage shadcn/${runtime} ${viewport.name} keeps the no-addon Rhea editor inset`, async () => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const page = await context.newPage();
      const id = `command-inset-shadcn-${runtime}-${viewport.name}`;
      stage(page, id, 'navigate');
      try {
        await installSuccessfulEmptySearchData(page);
        expect((await page.goto(`${baseUrl}/zh-cn/`, { waitUntil: 'networkidle' }))?.ok()).toBe(
          true
        );
        await homeReady(page, 'shadcn', 'wc');
        if (runtime !== 'wc') {
          await choosePageControl(page, 'runtime', runtimeLabels[runtime]);
          await homeReady(page, 'shadcn', runtime);
        }
        const menu = page.locator(
          '[data-site-header] .site-header-menu [data-projection-generation-state="active"] [data-demo-ref="home-menu"]'
        );
        if ((await menu.getAttribute('aria-expanded')) === 'true') await menu.click();
        const trigger = page.locator(
          'site-search [data-projection-generation-state="active"] [data-open-modal]'
        );
        await trigger.click();
        const panel = await searchPart(page, 'panel');
        await expect.poll(() => panel.getAttribute('data-transition-state')).toBe('entered');
        expect(await panel.getAttribute('data-projection-runtime')).toBe(runtime);
        const queryPart = await searchPart(page, 'query');
        expect(await queryPart.getAttribute('data-projection-runtime')).toBe(runtime);
        const editor = await searchInput(page);
        const shell = await searchPart(page, 'query-shell');
        expect(await shell.count()).toBe(1);
        const geometry = await editor.evaluate((node) => {
          const owner = node.closest<HTMLElement>(
            '[data-projection-prototype="shadcn-input-shell"]'
          );
          if (!owner) throw new Error('Missing actual Command InputShell ancestor');
          const input = node.getBoundingClientRect();
          const box = owner.getBoundingClientRect();
          const style = getComputedStyle(node);
          return {
            input: input.toJSON(),
            shell: box.toJSON(),
            paddingStart: parseFloat(style.paddingInlineStart),
            paddingEnd: parseFloat(style.paddingInlineEnd),
            rootFont: parseFloat(getComputedStyle(document.documentElement).fontSize),
            textInset:
              input.left +
              parseFloat(style.borderLeftWidth) +
              parseFloat(style.paddingLeft) -
              box.left,
            inputRole: node.getAttribute('role'),
            shellRole: owner.getAttribute('role'),
            shellTabIndex: owner.getAttribute('tabindex'),
          };
        });
        const state = await page.evaluate(readSearchPublicState);
        await mkdir(evidenceDirectory, { recursive: true });
        await writeFile(
          path.join(evidenceDirectory, `${id}-geometry.json`),
          JSON.stringify(
            {
              source,
              runtime,
              viewport,
              geometry,
              state,
              dataFixture: 'successful empty Pagefind boundary; real native composition',
            },
            null,
            2
          )
        );
        await capture(page, id, 'actual-editor-inset');
        const inset = geometry.rootFont * 0.625;
        expect(Math.abs(geometry.paddingStart - inset)).toBeLessThanOrEqual(0.1);
        expect(Math.abs(geometry.paddingEnd - inset)).toBeLessThanOrEqual(0.1);
        expect(geometry.textInset).toBeGreaterThanOrEqual(inset);
        expect(geometry.textInset).toBeLessThanOrEqual(inset + 1);
        expect(geometry.input.right - geometry.shell.right).toBeLessThanOrEqual(1);
        expect(geometry.inputRole).toBe('combobox');
        expect(geometry.shellRole).toBeNull();
        expect(geometry.shellTabIndex).toBeNull();
        await expect
          .poll(async () => (await page.evaluate(readSearchPublicState)).inputFocused)
          .toBe(true);
        const identity = await editor.elementHandle();
        if (!identity) throw new Error('Missing real editor handle');
        await editor.fill('inset query');
        await expect
          .poll(async () => (await page.evaluate(readSearchPublicState)).query)
          .toBe('inset query');
        expect(await editor.evaluate((node, previous) => node === previous, identity)).toBe(true);
        await page.keyboard.press('Escape');
        await expect
          .poll(async () => (await page.evaluate(readSearchPublicState)).open)
          .toBe(false);
        await expect
          .poll(() => trigger.evaluate((node) => node === document.activeElement))
          .toBe(true);
        expect(diagnosticPages.get(page)!.errors).toEqual([]);
      } catch (error) {
        await captureFailure(page);
        throw error;
      } finally {
        await context.close();
      }
    }, 90_000);
  }
}

// The prior Header native run encountered this real product state. Preserve it
// independently: a missing index intentionally focuses the actual Retry Button,
// and must not be misclassified as CSS-induced input focus loss.
for (const family of ['shadcn', 'brutalist'] as const) {
  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
    it(`homepage ${family}/${runtime} missing Pagefind keeps the real Retry action focused`, async () => {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      const id = `search-missing-index-${family}-${runtime}`;
      let failedDataResponses = 0;
      const expectedDataConsoleErrors: string[] = [];
      stage(page, id, 'navigate');
      try {
        page.on('response', (response) => {
          if (
            new URL(response.url()).pathname.endsWith('/pagefind/pagefind.js') &&
            response.status() === 404
          )
            failedDataResponses++;
        });
        page.on('console', (message) => {
          if (message.type() !== 'error' || !message.text().includes('404 (Not Found)')) return;
          const location = message.location().url;
          if (
            location &&
            new URL(location).origin === new URL(baseUrl).origin &&
            new URL(location).pathname.endsWith('/pagefind/pagefind.js')
          ) {
            expectedDataConsoleErrors.push(`console: ${message.text()}`);
          }
        });
        await page.route('**/pagefind/pagefind.js', (route) =>
          route.fulfill({
            status: 404,
            contentType: 'text/plain',
            body: 'Controlled missing test index',
          })
        );
        expect((await page.goto(`${baseUrl}/zh-cn/`, { waitUntil: 'networkidle' }))?.ok()).toBe(
          true
        );
        await homeReady(page, 'shadcn', 'wc');
        if (family !== 'shadcn') {
          await choosePageControl(page, 'family', 'Brutalist');
          await homeReady(page, family, 'wc');
        }
        if (runtime !== 'wc') {
          await choosePageControl(page, 'runtime', runtimeLabels[runtime]);
          await homeReady(page, family, runtime);
        }
        const menu = page.locator(
          '[data-site-header] .site-header-menu [data-projection-generation-state="active"] [data-demo-ref="home-menu"]'
        );
        if ((await menu.getAttribute('aria-expanded')) === 'true') await menu.click();
        await page
          .locator('site-search [data-projection-generation-state="active"] [data-open-modal]')
          .click();
        const panel = await searchPart(page, 'panel');
        await expect.poll(() => panel.getAttribute('data-transition-state')).toBe('entered');
        expect(await panel.getAttribute('data-projection-runtime')).toBe(runtime);
        expect(
          await (await searchPart(page, 'query')).getAttribute('data-projection-runtime')
        ).toBe(runtime);
        const retry = await searchPart(page, 'search-page-action');
        await expect.poll(() => retry.textContent()).toBe('重试');
        await expect
          .poll(() => retry.evaluate((node) => node === document.activeElement))
          .toBe(true);
        const state = await page.evaluate(readSearchPublicState);
        expect(state.open).toBe(true);
        expect(state.inputFocused).toBe(false);
        expect(failedDataResponses).toBeGreaterThan(0);
        expect(await (await searchPart(page, 'status')).textContent()).toBe('搜索暂不可用，请重试');
        await capture(page, id, 'actual-retry-focus');
        await writeFile(
          path.join(evidenceDirectory, `${id}-focus.json`),
          JSON.stringify({ source, family, runtime, state, failedDataResponses }, null, 2)
        );
        const unexpectedErrors = [...diagnosticPages.get(page)!.errors];
        for (const expected of expectedDataConsoleErrors) {
          const index = unexpectedErrors.indexOf(expected);
          expect(index).toBeGreaterThanOrEqual(0);
          unexpectedErrors.splice(index, 1);
        }
        // A generic asset404 or unrelated page error is not excused by the
        // controlled Pagefind404. Only exact same-origin console provenance is.
        expect(unexpectedErrors).toEqual([]);
      } catch (error) {
        await captureFailure(page);
        throw error;
      } finally {
        await context.close();
      }
    }, 90_000);
  }
}
