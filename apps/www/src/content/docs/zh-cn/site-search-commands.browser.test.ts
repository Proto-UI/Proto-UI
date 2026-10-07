// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { revealHeaderPreferences } from './site-header-browser';
import type { Browser, Page, Request } from 'playwright-core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser, startServer, stopServer } from './browser-harness';
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
    service: search.querySelector('.search-failure') ? 'production-pagefind' : 'dev-warning',
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
        errors: diagnosticPages.get(page)?.errors ?? [],
        pendingRequests: pendingRequests.map(({ url, type }) => [url, type]),
        summary,
        recentRequests: diagnosticPages.get(page)?.requests ?? [],
        lateObservation: diagnosticPages.get(page)?.lateObservation,
        renderer: 'Real Chromium via existing repository browser harness',
        scope:
          'Search trigger/close/retry Buttons only; native dialog and Pagefind visuals remain CSS-owned',
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
    const describe = (node: EventTarget | null) =>
      node instanceof Element
        ? {
            tag: node.localName,
            id: node.id,
            command: (node as HTMLElement).dataset.searchCommand,
            role: node.getAttribute('role'),
            disabled: node.getAttribute('aria-disabled'),
            generation: (node as HTMLElement).dataset.projectionGeneration,
            connected: node.isConnected,
          }
        : null;
    const record = (type: string, target: EventTarget | null, extra: unknown = null) => {
      timeline.push({
        at: performance.now(),
        type,
        target: describe(target),
        active: describe(document.activeElement),
        open: document.querySelector('site-search dialog')?.hasAttribute('open'),
        extra,
      });
      if (timeline.length > 160) timeline.shift();
    };
    for (const type of [
      'pointerdown',
      'pointerup',
      'click',
      'keydown',
      'keyup',
      'focusin',
      'focusout',
      'cancel',
      'close',
    ]) {
      for (const capture of [true, false])
        window.addEventListener(
          type,
          (event) => {
            if (
              document.querySelector('site-search dialog[open]') ||
              (event.target instanceof Element && event.target.closest('site-search'))
            ) {
              record(`${type}:${capture ? 'capture' : 'bubble'}`, event.target, {
                key: (event as KeyboardEvent).key,
                x: (event as MouseEvent).clientX,
                y: (event as MouseEvent).clientY,
                trusted: event.isTrusted,
                kind: event.constructor.name,
              });
            }
          },
          capture
        );
    }
    const originalFocus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function (...args) {
      const tracked = this.hasAttribute('data-search-command');
      if (tracked) record('native-focus:before', this);
      const result = originalFocus.apply(this, args);
      if (tracked) record('native-focus:after', this);
      return result;
    };
    const originalClose = HTMLDialogElement.prototype.close;
    HTMLDialogElement.prototype.close = function (...args) {
      record('dialog-close:before', this);
      const result = originalClose.apply(this, args);
      record('dialog-close:after', this);
      return result;
    };
    const original = HTMLDialogElement.prototype.showModal;
    HTMLDialogElement.prototype.showModal = function () {
      this.dataset.testOpenCount = String(Number(this.dataset.testOpenCount ?? 0) + 1);
      return original.call(this);
    };
  });
}

// The standard harness serves Astro dev. That path intentionally renders the
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
            const dialog = page.locator('site-search dialog');
            const close = page.locator(
              'site-search [data-projection-generation-state="active"] [data-close-modal]'
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
            expect(await trigger.evaluate((button) => button.localName)).toBe(
              `wc-${family}-button`
            );
            expect(await trigger.getAttribute('role')).toBe('button');
            await expect.poll(() => page.locator('html').getAttribute('data-theme')).toBe(theme);
            // Each Header consumes its public family Button presentation.
            const triggerTokens = await trigger.getAttribute('data-pui-style');
            expect(triggerTokens).toContain(
              family === 'brutalist' ? 'bg-secondary-background' : 'bg-transparent'
            );
            if (family === 'shadcn') {
              expect(triggerTokens).toContain('border-transparent');
              const rest = await trigger.evaluate((node) => ({
                border: getComputedStyle(node).borderTopColor,
                background: getComputedStyle(node).backgroundColor,
              }));
              expect(rest.border).toBe('rgba(0, 0, 0, 0)');
              expect(rest.background).toBe('rgba(0, 0, 0, 0)');
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
              .poll(() => dialog.evaluate((element) => (element as HTMLDialogElement).open))
              .toBe(true);
            expect(await dialog.getAttribute('data-test-open-count')).toBe('1');
            expect(await close.evaluate((button) => button.localName)).toBe(`wc-${family}-button`);
            expect(await close.getAttribute('data-pui-style')).toContain(
              family === 'brutalist' ? 'bg-secondary-background' : 'bg-transparent'
            );
            await capture(page, id, 'open');
            await close.locator('svg').click();
            await expect
              .poll(() => trigger.evaluate((element) => element === document.activeElement))
              .toBe(true);
            await trigger.press('Enter');
            await expect.poll(() => dialog.getAttribute('data-test-open-count')).toBe('2');
            await page.keyboard.press('Escape');
            await expect
              .poll(() => trigger.evaluate((element) => element === document.activeElement))
              .toBe(true);
            await trigger.press('Space');
            await expect.poll(() => dialog.getAttribute('data-test-open-count')).toBe('3');
            stage(page, id, 'backdrop');
            await page.mouse.click(2, 2);
            await expect
              .poll(() => dialog.evaluate((element) => (element as HTMLDialogElement).open))
              .toBe(false);
            await expect
              .poll(() => trigger.evaluate((element) => element === document.activeElement))
              .toBe(true);
            for (const key of ['Control+k', 'Meta+k']) {
              await page.keyboard.press(key);
              await expect
                .poll(() => dialog.evaluate((element) => (element as HTMLDialogElement).open))
                .toBe(true);
              await page.keyboard.press(key);
              await expect
                .poll(() => dialog.evaluate((element) => (element as HTMLDialogElement).open))
                .toBe(false);
              await expect
                .poll(() => trigger.evaluate((element) => element === document.activeElement))
                .toBe(true);
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
          expect(geometry.commands).toHaveLength(3);
          expect(Math.abs(geometry.search.height - 44)).toBeLessThanOrEqual(1);
          for (const selector of geometry.selectors) {
            expect(Math.abs(selector.trigger.height - 36)).toBeLessThanOrEqual(1);
            expect(Math.abs(selector.trigger.bottom - geometry.search.bottom)).toBeLessThanOrEqual(
              1
            );
            expect(
              Math.abs(selector.trigger.center - geometry.search.center - 4)
            ).toBeLessThanOrEqual(1);
            expect(selector.label.bottom).toBeLessThanOrEqual(selector.trigger.y + 1);
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
          expect(
            await page
              .locator('site-search dialog')
              .evaluate((dialog) => (dialog as HTMLDialogElement).open)
          ).toBe(true);
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

it('homepage keeps one native dialog through open-runtime transitions and repeat initialization', async () => {
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
    await page.evaluate(() => {
      const search = document.querySelector('site-search') as HTMLElement & {
        connectedCallback(): void;
      };
      Object.assign(window, { __originalSearchDialog: search.querySelector('dialog') });
      search.connectedCallback();
      search.connectedCallback();
    });
    for (const runtime of ['react', 'vue', 'vue2', 'wc']) {
      // Existing page preference ingress, including updates while native modal
      // inertness prevents interacting with the Header's Select itself.
      await page.evaluate(
        (runtime) =>
          document.dispatchEvent(
            new CustomEvent('proto-adapter:change', { detail: { adapter: runtime } })
          ),
        runtime
      );
      await homeReady(page, 'shadcn', runtime);
      expect(
        await page.evaluate(
          () =>
            document.querySelector('site-search dialog') === (window as any).__originalSearchDialog
        )
      ).toBe(true);
      expect(
        await page
          .locator('site-search dialog')
          .evaluate((dialog) => (dialog as HTMLDialogElement).open)
      ).toBe(true);
      const close = page.locator(
        'site-search [data-projection-generation-state="active"] [data-close-modal]'
      );
      stage(page, 'home-open-runtime', `${runtime}-close-focus`);
      await close.click();
      const trigger = page.locator(
        'site-search [data-projection-generation-state="active"] [data-open-modal]'
      );
      await expect
        .poll(() => trigger.evaluate((node) => node === document.activeElement))
        .toBe(true);
      await trigger.press('Space');
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
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      try {
        const response = await page.goto(`${baseUrl}${searchRoute(family)}`, {
          waitUntil: 'networkidle',
        });
        expect(response?.ok()).toBe(true);
        const selector = page
          .locator('[data-docs-site-header] [data-adapter-select] [data-site-select-trigger]')
          .first();
        await expect.poll(() => selector.getAttribute('role')).toBe('combobox');
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
        await context.close();
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
        const panel = header.locator('[data-site-header-panel]');
        expect(await header.locator('[data-site-menu-button]').getAttribute('aria-expanded')).toBe(
          'true'
        );
        expect(await panel.isVisible()).toBe(true);
        const panelBox = (await panel.boundingBox())!;
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
