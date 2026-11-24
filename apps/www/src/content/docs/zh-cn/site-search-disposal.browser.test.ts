// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Browser, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser, startServer, stopServer } from './browser-harness';

let browser: Browser;
let baseUrl: string;
const route = '/zh-cn/ui-libraries/shadcn/button/';
beforeAll(async () => {
  baseUrl = await startServer(route);
  browser = await launchBrowser();
}, 150_000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

// Run in the same Vite browser graph as the real docs composition. Only a
// post-disposal error and the delivery of an already materialized Dialog are
// injected. The participant, two controllers, runtimes, Portal and cleanup run
// unchanged. A plain element keeps the fixture from acquiring a second scope
// through SiteSearch's custom-element connectedCallback.
const installProbe = String.raw`(async (options) => {
  const { searchCommandParticipant, initDocumentationSearchCommands } =
    await import('/src/components/site-search-commands.ts');
  const { PREFERRED_ADAPTER_KEY, PREFERRED_ADAPTER_EVENT } =
    await import('/src/components/adapter-preference.ts');
  const existing = document.querySelector('site-search');
  if (!existing) throw new Error('The actual docs Search provides the theme and configuration');
  localStorage.setItem(PREFERRED_ADAPTER_KEY, options.runtime);
  const root = document.createElement('section');
  Object.assign(root.dataset, existing.dataset);
  root.dataset.searchComposition = 'command-dialog';
  root.dataset.searchInitialFamily = 'shadcn';
  root.dataset.disposalProbe = options.runtime + '-' + options.state;
  root.innerHTML = '<div data-search-composition-mount><div data-search-command-mount="open"></div><div data-search-dialog-mount></div></div>';
  document.body.append(root);

  const error = options.failure === 'undefined' ? undefined : new Error('Injected opener disposal failure');
  const openers = [];
  const dialogs = [];
  const surfaces = new Set();
  const listeners = [];
  const originalAdd = document.addEventListener;
  const originalRemove = document.removeEventListener;
  let phase = 'participant';
  const capture = (value) => typeof value === 'boolean' ? value : !!value?.capture;
  document.addEventListener = function(type, listener, settings) {
    if (phase !== 'later' && (type === 'focusin' || type === PREFERRED_ADAPTER_EVENT))
      listeners.push({ type, listener, capture: capture(settings), phase, removed: false });
    return originalAdd.call(this, type, listener, settings);
  };
  document.removeEventListener = function(type, listener, settings) {
    for (const item of listeners)
      if (item.type === type && item.listener === listener && item.capture === capture(settings))
        item.removed = true;
    return originalRemove.call(this, type, listener, settings);
  };
  const owner = searchCommandParticipant(root);
  const onOpen = owner.onOpen.bind(owner);
  let removedOpenSubscription = 0;
  owner.onOpen = (listener) => {
    const off = onOpen(listener);
    return () => { removedOpenSubscription++; off(); };
  };
  const materialize = owner.materialize.bind(owner);
  const materializeDialog = owner.materializeDialog.bind(owner);
  let release;
  const gate = new Promise(done => release = done);
  let calls = 0;
  let dialogCalls = 0;
  let outer;
  let reentered;
  let beforeDestroy;
  const snapshots = [];
  const retain = (candidate) => {
    const ownerKey = candidate.host.dataset.projectionOwnerHost;
    const generation = candidate.host.dataset.projectionGenerationHost;
    for (const node of document.querySelectorAll('[data-projection-owner]'))
      if (node.dataset.projectionOwner === ownerKey && node.dataset.projectionGeneration === generation)
        surfaces.add(node);
  };
  const track = (candidate, kind) => {
    const record = { candidate, disposed: 0, activated: 0 };
    (kind === 'opener' ? openers : dialogs).push(record);
    return {
      ...candidate,
      activate() { record.activated++; return candidate.activate(); },
      async dispose() {
        record.disposed++;
        if (kind === 'opener' && options.reentry) reentered = scope.destroy();
        await candidate.dispose();
        if (kind === 'opener' && options.failure !== 'none') throw error;
      },
    };
  };
  owner.materialize = async (...args) => {
    calls++;
    return (await materialize(...args)).map(candidate => track(candidate, 'opener'));
  };
  owner.materializeDialog = async (...args) => {
    dialogCalls++;
    const candidate = await materializeDialog(...args);
    const tracked = track(candidate, 'dialog');
    if (options.state === 'pending') await gate;
    return tracked;
  };
  phase = 'scope';
  const scope = initDocumentationSearchCommands(owner);
  phase = 'later';
  let outcomes = [];
  let settled = 0;
  const observeOutcome = promise => promise.then(
    () => { settled++; return { rejected: false, sameReason: false }; },
    reason => { settled++; return { rejected: true, sameReason: Object.is(reason, error) }; }
  );
  const read = () => ({
    calls, dialogCalls, settled,
    openers: openers.map(item => ({ disposed: item.disposed, activated: item.activated, connected: item.candidate.host.isConnected })),
    dialogs: dialogs.map(item => ({ disposed: item.disposed, activated: item.activated, connected: item.candidate.host.isConnected })),
    surfaces: [...surfaces].map(node => ({ part: node.dataset.demoRef || null, connected: node.isConnected })),
    scopeListeners: listeners.filter(item => item.phase === 'scope').map(item => ({ type: item.type, removed: item.removed })),
    participantListeners: listeners.filter(item => item.phase === 'participant').map(item => ({ type: item.type, removed: item.removed })),
    removedOpenSubscription,
    sameReenteredPromise: options.reentry ? reentered === outer : null,
    panelEntered: dialogs.some(item => {
      const ownerKey = item.candidate.host.dataset.projectionOwnerHost;
      return [...document.querySelectorAll('[data-demo-ref="panel"]')].some(node =>
        node.dataset.projectionOwner === ownerKey && node.dataset.transitionState === 'entered');
    }),
  });
  const probe = window.__searchDisposal = {
    root, owner, scope, read, snapshots,
    open() { owner.open(); },
    begin() {
      [...openers, ...dialogs].forEach(item => retain(item.candidate));
      beforeDestroy = read();
      snapshots.push({ step: 'before-destroy', ...beforeDestroy });
      outer = scope.destroy();
      const repeated = scope.destroy();
      outcomes = [observeOutcome(outer), observeOutcome(repeated)];
      return { samePromise: outer === repeated, beforeDestroy };
    },
    release() { release(); },
    async finish() {
      const results = await Promise.all(outcomes);
      const later = scope.destroy();
      const lateResult = await observeOutcome(later);
      return { results, lateResult, sameLatePromise: later === outer, state: read() };
    },
    async staleInputs() {
      const before = { calls, dialogCalls };
      owner.toggle(); owner.toggle();
      document.dispatchEvent(new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: options.runtime } }));
      for (const node of surfaces)
        if (node.dataset.openModal !== undefined)
          node.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
      await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
      return { before, after: { calls, dialogCalls }, state: read() };
    },
    disposeOwner() {
      owner.dispose();
      const final = read();
      document.addEventListener = originalAdd;
      document.removeEventListener = originalRemove;
      root.remove();
      return final;
    },
  };
  await scope.ready;
  return probe.read();
})`;

type Snapshot = {
  calls: number;
  dialogCalls: number;
  settled: number;
  panelEntered: boolean;
  sameReenteredPromise: boolean | null;
  openers: Array<{ disposed: number; activated: number; connected: boolean }>;
  dialogs: Array<{ disposed: number; activated: number; connected: boolean }>;
  surfaces: Array<{ part: string | null; connected: boolean }>;
  scopeListeners: Array<{ type: string; removed: boolean }>;
  participantListeners: Array<{ type: string; removed: boolean }>;
  removedOpenSubscription: number;
};
async function observe(page: Page): Promise<Snapshot> {
  return page.evaluate(() => (window as any).__searchDisposal.read());
}

async function record(page: Page, id: string, observations: unknown[], failure?: string) {
  const evidence = process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR;
  if (!evidence) return;
  const directory = path.join(evidence, 'search-controller-disposal');
  await mkdir(directory, { recursive: true });
  const files = [
    'apps/www/src/content/docs/zh-cn/site-search-disposal.browser.test.ts',
    'apps/www/src/components/site-search-commands.ts',
    'apps/www/src/components/site-search-composition.ts',
    'apps/www/src/components/PrototypePreviewer/projection-scope.ts',
    'apps/www/src/components/PrototypePreviewer/projection-materializer.ts',
  ];
  await writeFile(
    path.join(directory, id + '.json'),
    JSON.stringify(
      {
        sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        browser: browser.version(),
        sourceFiles: await Promise.all(
          files.map(async (file) => ({
            file,
            sha256: createHash('sha256')
              .update(await readFile(file))
              .digest('hex'),
          }))
        ),
        observations,
        terminal: failure ? 'failed' : 'passed',
        failure: failure ?? null,
        boundary:
          'Real Chromium with production Search participant/controllers/materializer and public Dialog; injected post-disposal error and pending delivery. Pagefind is a controlled independent data resource. Scope listeners and retained generation/Portal nodes are observed; no heap census, screen reader, physical input or Search timing claim.',
      },
      null,
      2
    )
  );
  await page.screenshot({ path: path.join(directory, id + '.png') });
}

describe('#1488 E native Search controller retirement', () => {
  for (const runtime of ['wc', 'react', 'vue', 'vue2']) {
    for (const state of ['unstarted', 'active', 'pending']) {
      it(`${runtime} retires ${state} Dialog after opener rejection`, async () => {
        const context = await browser.newContext({ viewport: { width: 1280, height: 960 } });
        const page = await context.newPage();
        const observations: unknown[] = [];
        let failure: string | undefined;
        try {
          await page.route('**/pagefind/pagefind.js', (request) =>
            request.fulfill({
              status: 200,
              contentType: 'text/javascript',
              body: 'export async function options() {} export async function search() { return { results: [] }; }',
            })
          );
          expect((await page.goto(baseUrl + route, { waitUntil: 'networkidle' }))?.ok()).toBe(true);
          const initial = (await page.evaluate(
            `${installProbe}(${JSON.stringify({ runtime, state, failure: state === 'active' ? 'undefined' : 'error', reentry: state === 'pending' })})`
          )) as Snapshot;
          observations.push({ step: 'ready', state: initial });
          if (
            !initial ||
            typeof initial !== 'object' ||
            !('openers' in initial) ||
            !('scopeListeners' in initial)
          )
            throw new Error('Expected the initial Search disposal probe snapshot');
          expect(initial.openers).toEqual([{ disposed: 0, activated: 1, connected: true }]);
          expect(initial.scopeListeners).toHaveLength(2);
          if (state !== 'unstarted') {
            await page.evaluate(() => (window as any).__searchDisposal.open());
            await expect.poll(async () => (await observe(page)).dialogs.length).toBe(1);
            if (state === 'active')
              await expect.poll(async () => (await observe(page)).panelEntered).toBe(true);
          }
          const begun = await page.evaluate(() => (window as any).__searchDisposal.begin());
          observations.push({ step: 'begin', ...begun });
          expect(begun.samePromise).toBe(true);
          if (state !== 'unstarted') expect(begun.beforeDestroy.surfaces.length).toBeGreaterThan(0);
          if (state === 'pending') {
            await page.evaluate(() => new Promise<void>((done) => setTimeout(done, 0)));
            const pending = await observe(page);
            observations.push({ step: 'held-delivery-after-destroy', state: pending });
            expect(pending.settled).toBe(0);
            expect(pending.sameReenteredPromise).toBe(true);
            await page.evaluate(() => (window as any).__searchDisposal.release());
          }
          const retired = await page.evaluate(() => (window as any).__searchDisposal.finish());
          observations.push({ step: 'retired', ...retired });
          expect(retired.results).toEqual([
            { rejected: true, sameReason: true },
            { rejected: true, sameReason: true },
          ]);
          expect(retired.lateResult).toEqual({ rejected: true, sameReason: true });
          expect(retired.sameLatePromise).toBe(true);
          expect(retired.state.openers).toEqual([{ disposed: 1, activated: 1, connected: false }]);
          expect(retired.state.dialogs).toEqual(
            state === 'unstarted'
              ? []
              : [{ disposed: 1, activated: state === 'active' ? 1 : 0, connected: false }]
          );
          expect(
            retired.state.surfaces.every((surface: { connected: boolean }) => !surface.connected)
          ).toBe(true);
          expect(
            retired.state.scopeListeners.every((listener: { removed: boolean }) => listener.removed)
          ).toBe(true);
          expect(retired.state.removedOpenSubscription).toBe(1);
          // The data/session participant has a separate lifetime from its scopes.
          expect(retired.state.participantListeners).toEqual([{ type: 'focusin', removed: false }]);
          const stale = await page.evaluate(() => (window as any).__searchDisposal.staleInputs());
          observations.push({ step: 'stale-inputs', ...stale });
          expect(stale.after).toEqual(stale.before);
          const ownerRetired = await page.evaluate(() =>
            (window as any).__searchDisposal.disposeOwner()
          );
          observations.push({ step: 'owner-retired', state: ownerRetired });
          expect(ownerRetired.participantListeners).toEqual([{ type: 'focusin', removed: true }]);
        } catch (error) {
          failure = String(error);
          throw error;
        } finally {
          try {
            await record(page, runtime + '-' + state, observations, failure);
          } finally {
            await context.close();
          }
        }
      }, 60_000);
    }
  }
});
