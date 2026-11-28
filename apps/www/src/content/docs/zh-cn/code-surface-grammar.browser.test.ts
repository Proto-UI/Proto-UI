// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type {
  Browser,
  BrowserContext,
  BrowserContextOptions,
  Locator,
  Page,
} from 'playwright-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { launchBrowser, startServer, stopServer } from './browser-harness';
import { copySourceBindingIssues, type CopySourceBinding } from './copy-command-evidence';
import {
  codeSurfaceOwnershipIssues,
  codeSurfaceSettled,
  type CodeSurfaceGenerationFacts,
} from './code-surface-evidence';

const SOURCE_ROUTE = '/zh-cn/start-here/quick-start/';
const EC_ROUTE = '/zh-cn/ui-libraries/base/collapsible/';
const INSTALL_ROUTE = '/zh-cn/ui-libraries/shadcn/button/';
interface CliInitFixture {
  cli: { version: string; sourceTreeHash: string };
  entries: Array<{ path: string; kind: 'file' | 'directory'; content?: string; sha256?: string }>;
  directory: string;
}
let cliInitOutput: CliInitFixture;
let browser: Browser;
let baseUrl: string;
let sourceBinding: CopySourceBinding;
const directory = join(
  process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR ||
    join(process.env.RUNNER_TEMP || tmpdir(), 'homepage-evidence'),
  'code-surface-grammar'
);
type PhaseSubject = { id: string; name: string };
const suiteSubject = { id: 'suite', name: 'code-surface grammar' };
const contextSubjects = new WeakMap<BrowserContext, PhaseSubject>();
let phaseSequence = 0;

// Opt-in diagnosis of the original complete matrix under its unchanged deadline.
// Context-bound subjects keep a late timed-out operation with its original case.
function phase(
  subject: PhaseSubject,
  operation: string,
  state: 'start' | 'done' | 'failed' | 'event',
  detail: Record<string, unknown> = {}
) {
  if (process.env.PROTO_UI_CODE_GRAMMAR_PHASES !== '1') return;
  const line = JSON.stringify({
    ...sourceBinding,
    sequence: phaseSequence++,
    pid: process.pid,
    observedAt: new Date().toISOString(),
    runnerMs: performance.now(),
    subject: { id: subject.id, name: subject.name },
    operation,
    state,
    detail,
  });
  console.error(`[code-grammar-phase] ${line}`);
  try {
    mkdirSync(directory, { recursive: true });
    appendFileSync(join(directory, 'native-phases.jsonl'), `${line}\n`);
  } catch (error) {
    // A diagnostic write must not replace the original operation or assertion.
    console.error('[code-grammar-phase] receipt write failed', error);
  }
}

function pagePhase(
  page: Page,
  operation: string,
  state: 'start' | 'done' | 'failed' | 'event',
  detail: Record<string, unknown> = {}
) {
  phase(contextSubjects.get(page.context()) ?? suiteSubject, operation, state, {
    url: page.url(),
    ...detail,
  });
}

async function newGrammarContext(subject: PhaseSubject, options: BrowserContextOptions) {
  phase(subject, 'context.create', 'start', { options });
  const context = await browser.newContext(options);
  contextSubjects.set(context, { id: subject.id, name: subject.name });
  context.on('close', () => phase(subject, 'context.closed', 'event'));
  context.on('page', (page) => {
    pagePhase(page, 'page.created', 'event');
    page.on('domcontentloaded', () => pagePhase(page, 'page.domcontentloaded', 'event'));
    page.on('load', () => pagePhase(page, 'page.load', 'event'));
    page.on('close', () => pagePhase(page, 'page.closed', 'event'));
    page.on('crash', () => pagePhase(page, 'page.crashed', 'event'));
  });
  phase(subject, 'context.create', 'done');
  return context;
}

async function closeGrammarContext(context: BrowserContext) {
  const subject = contextSubjects.get(context) ?? suiteSubject;
  phase(subject, 'context.close', 'start');
  try {
    await context.close();
    phase(subject, 'context.close', 'done');
  } catch (error) {
    phase(subject, 'context.close', 'failed', { error: String(error) });
    throw error;
  }
}

async function navigate(page: Page, url: string, options?: Parameters<Page['goto']>[1]) {
  pagePhase(page, 'page.goto', 'start', { destination: url, options });
  try {
    const response = await page.goto(url, options);
    pagePhase(page, 'page.goto', 'done', { status: response?.status() ?? null });
    return response;
  } catch (error) {
    pagePhase(page, 'page.goto', 'failed', { error: String(error) });
    throw error;
  }
}

beforeEach(({ task }) => phase(task, 'case', 'start'));
afterEach(({ task }) => phase(task, 'case', 'done', { result: task.result?.state ?? null }));
beforeAll(async () => {
  phase(suiteSubject, 'setup', 'start');
  sourceBinding = {
    exactSHA: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()),
    expectedSHA: process.env.CANDIDATE_SHA ?? process.env.PROTO_UI_EXPECTED_REVISION ?? null,
    eventSHA: process.env.GITHUB_SHA ?? null,
  };
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'source-binding.json'), JSON.stringify(sourceBinding, null, 2));
  expect(copySourceBindingIssues(sourceBinding, Boolean(process.env.CI))).toEqual([]);
  phase(suiteSubject, 'server.start', 'start');
  baseUrl = await startServer(SOURCE_ROUTE);
  phase(suiteSubject, 'server.start', 'done');
  // A clean checkout has no generated fixture during test collection. The
  // normal docs server builds and runs the real CLI extractor before readiness.
  // Read that exact output only after startup; never use a committed fallback.
  phase(suiteSubject, 'cli-fixture.read', 'start');
  cliInitOutput = JSON.parse(
    await readFile(new URL('../../../generated/cli-init.generated.json', import.meta.url), 'utf8')
  ) as CliInitFixture;
  phase(suiteSubject, 'cli-fixture.read', 'done');
  phase(suiteSubject, 'browser.launch', 'start');
  browser = await launchBrowser();
  phase(suiteSubject, 'browser.launch', 'done');
  phase(suiteSubject, 'setup', 'done');
}, 300_000);
afterAll(async () => {
  phase(suiteSubject, 'browser.close', 'start');
  await browser?.close();
  phase(suiteSubject, 'browser.close', 'done');
  phase(suiteSubject, 'server.stop', 'start');
  await stopServer();
  phase(suiteSubject, 'server.stop', 'done');
});

async function ready(root: Locator, runtime: string, family: string) {
  pagePhase(root.page(), 'surface.ready', 'start', { runtime, family });
  await root.page().waitForFunction(
    ({ id, runtime, family }) => {
      const root = document.getElementById(id);
      return (
        root?.dataset.codeSurfaceRuntime === runtime &&
        root.dataset.codeSurfaceFamily === family &&
        root.dataset.codeSurfaceView === 'ready'
      );
    },
    {
      id: await root.evaluate((root) => {
        root.id ||= `code-surface-${crypto.randomUUID()}`;
        return root.id;
      }),
      runtime,
      family,
    }
  );
  pagePhase(root.page(), 'surface.ready', 'done', { runtime, family });
}
async function appearance(root: Locator) {
  return root.evaluate((root) => {
    const surface = root.querySelector<HTMLElement>(
      ':scope > .site-code-surface-mount .site-code-surface-paint'
    )!;
    const style = getComputedStyle(surface);
    const rect = surface.getBoundingClientRect(),
      owner = root.getBoundingClientRect();
    const expected = document.createElement('span');
    expected.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
    expected.style.setProperty('--pui-radius', style.getPropertyValue('--pui-radius'));
    expected.style.setProperty('--pui-radius-xl', style.getPropertyValue('--pui-radius-xl'));
    expected.style.borderRadius =
      root.getAttribute('data-code-surface-family') === 'brutalist'
        ? 'var(--pui-radius)'
        : 'var(--pui-radius-xl)';
    document.body.append(expected);
    const expectedRadius = getComputedStyle(expected).borderRadius;
    expected.remove();
    return {
      tokens: surface.getAttribute('data-pui-style'),
      background: style.backgroundColor,
      border: style.borderLeftWidth,
      radius: style.borderRadius,
      expectedRadius,
      role: surface.getAttribute('role'),
      tabIndex: surface.getAttribute('tabindex'),
      pointerEvents: getComputedStyle(surface.closest('.site-code-surface-mount')!).pointerEvents,
      ownerBorder: getComputedStyle(root).borderLeftWidth,
      boundsDelta: [
        Math.abs(rect.x - owner.x),
        Math.abs(rect.y - owner.y),
        Math.abs(rect.width - owner.width),
        Math.abs(rect.height - owner.height),
      ],
      surfaceCount: root.querySelectorAll(
        ':scope > .site-code-surface-mount .site-code-surface-paint'
      ).length,
      sourceSelectable: [...root.querySelectorAll('pre')].every(
        (pre) => getComputedStyle(pre).userSelect !== 'none'
      ),
    };
  });
}
async function settled(
  root: Locator,
  runtime: string,
  family: string,
  phase: 'route-reset' | 'fixture-restore',
  caseFamily: string
) {
  pagePhase(root.page(), 'surface.settled', 'start', { runtime, family, phase, caseFamily });
  const samples: CodeSurfaceGenerationFacts[] = [];
  const ownershipViolations: string[] = [];
  try {
    await expect
      .poll(
        async () => {
          const facts = await root.evaluate((root) => ({
            view: root.getAttribute('data-code-surface-view'),
            runtime: root.getAttribute('data-code-surface-runtime'),
            family: root.getAttribute('data-code-surface-family'),
            surfaceCount: root.querySelectorAll(
              ':scope > .site-code-surface-mount .site-code-surface-paint'
            ).length,
            hosts: [
              ...root.querySelectorAll<HTMLElement>(
                ':scope > .site-code-surface-mount > [data-projection-generation-host]'
              ),
            ].map((host) => ({
              generation: host.getAttribute('data-projection-generation-host'),
              state: host.getAttribute('data-projection-generation-state'),
              runtime:
                host
                  .querySelector('[data-projection-scope]')
                  ?.getAttribute('data-projection-runtime') ?? null,
              family:
                host
                  .querySelector('[data-projection-scope]')
                  ?.getAttribute('data-projection-family') ?? null,
              inert: host.inert,
              ariaHidden: host.getAttribute('aria-hidden'),
              pointerEvents: getComputedStyle(host).pointerEvents,
            })),
          }));
          samples.push(facts);
          ownershipViolations.push(...codeSurfaceOwnershipIssues(facts));
          return codeSurfaceSettled(facts, runtime, family);
        },
        { timeout: 5000, interval: 25 }
      )
      .toBe(true);
    expect(ownershipViolations).toEqual([]);
    pagePhase(root.page(), 'surface.settled', 'done', { runtime, family, phase, caseFamily });
  } finally {
    await writeFile(
      join(directory, `${runtime}-${caseFamily}-${phase}-${family}-generation-settle.json`),
      JSON.stringify(
        { ...sourceBinding, runtime, family, caseFamily, phase, samples, ownershipViolations },
        null,
        2
      )
    );
  }
}
async function evidence(page: Page, root: Locator, name: string, facts: unknown) {
  pagePhase(page, 'evidence.scroll', 'start', { name });
  await root.scrollIntoViewIfNeeded();
  pagePhase(page, 'evidence.scroll', 'done', { name });
  pagePhase(page, 'evidence.metadata', 'start', { name });
  await writeFile(
    join(directory, `${name}.json`),
    JSON.stringify(
      {
        ...sourceBinding,
        viewport: page.viewportSize(),
        url: page.url(),
        facts,
      },
      null,
      2
    )
  );
  pagePhase(page, 'evidence.metadata', 'done', { name });
  pagePhase(page, 'evidence.screenshot', 'start', { name });
  await page.screenshot({ path: join(directory, `${name}.png`) });
  pagePhase(page, 'evidence.screenshot', 'done', { name });
}
async function selectFixtureFamily(page: Page, family: string) {
  // Docs has no family picker. This is an explicitly labelled family-input
  // fixture using the existing coordinate API, never fabricated CSS paint.
  await page.evaluate((family) => {
    document.documentElement.dataset.siteLibraryFamily = family;
    document
      .querySelectorAll<HTMLElement>('[data-site-family-scope]')
      .forEach((root) => (root.dataset.siteLibraryFamily = family));
  }, family);
}

describe.sequential('website passive code-surface grammar (#785)', () => {
  for (const runtime of ['wc', 'react', 'vue', 'vue2']) {
    for (const family of ['shadcn', 'brutalist']) {
      it(`${runtime}/${family}: real source frames, 44px toolbar and responsive native CodeExample`, async ({
        task,
      }) => {
        const context = await newGrammarContext(task, { viewport: { width: 390, height: 1000 } });
        await context.addInitScript(
          (runtime) => localStorage.setItem('preferred-prototypes-adapter', runtime),
          runtime
        );
        const page = await context.newPage();
        const ecPage = await context.newPage();
        try {
          await navigate(ecPage, `${baseUrl}${EC_ROUTE}`, { waitUntil: 'domcontentloaded' });
          await selectFixtureFamily(ecPage, family);
          await navigate(page, `${baseUrl}${SOURCE_ROUTE}`, { waitUntil: 'domcontentloaded' });
          await selectFixtureFamily(page, family);
          const terminal = ecPage.locator('.expressive-code .frame.is-terminal').first();
          const plain = ecPage.locator('.expressive-code .frame:not(.is-terminal)').first();
          const example = page.locator('[data-code-example]').first();
          // Content selection is independent from the surface/Copy renderer.
          await example
            .locator('[data-code-example-tablist="host"] [role="tab"]')
            .filter({ hasText: /^React$/ })
            .click();
          const sourceNodes = await example.locator('pre').elementHandles();
          const exampleFrame = example
            .locator(
              '[data-code-host-panel]:visible [data-code-example-steps] [data-code-shell][data-site-code-surface="frame"]'
            )
            .first();
          const cliInitTabs = page.locator('[data-cli-init-tabs]').first();
          const cliInitFrame = cliInitTabs
            .locator(
              '[data-cli-file-panel]:visible [data-code-shell][data-site-code-surface="frame"]'
            )
            .first();
          for (const root of [terminal, plain, exampleFrame, cliInitFrame]) {
            await root.page().bringToFront();
            await ready(root, runtime, family);
          }
          // Standalone CLI init output mounts real family Tabs without any Tree split-pane.
          await cliInitTabs.locator('[data-code-example-tablist="file"][role="tablist"]').waitFor({
            state: 'visible',
            timeout: 2_000,
          });
          expect(await cliInitTabs.locator('[role="tree"], [role="treeitem"]').count()).toBe(0);
          let previousBackground = '';
          for (const theme of ['light', 'dark']) {
            pagePhase(page, 'frame-theme', 'start', { runtime, family, theme });
            for (const surfacePage of [ecPage, page])
              await surfacePage.evaluate(
                (theme) => (document.documentElement.dataset.theme = theme),
                theme
              );
            for (const surfacePage of [ecPage, page])
              await surfacePage.waitForFunction(() =>
                [
                  ...document.querySelectorAll<HTMLElement>('[data-code-surface-view="ready"]'),
                ].every((root) => root.querySelector('.site-code-surface-paint'))
              );
            if (previousBackground) {
              await ecPage.waitForFunction(
                ({ id, previous }) => {
                  const paint = document
                    .getElementById(id)
                    ?.querySelector<HTMLElement>(
                      ':scope > .site-code-surface-mount .site-code-surface-paint'
                    );
                  return paint && getComputedStyle(paint).backgroundColor !== previous;
                },
                { id: (await terminal.getAttribute('id')) as string, previous: previousBackground }
              );
            }
            const facts = await appearance(terminal);
            expect(facts.surfaceCount).toBe(1);
            expect(facts.border).toBe(
              family === 'brutalist' ? '2px' : family === 'shadcn' ? '0px' : '1px'
            );
            expect(facts.radius).toBe(facts.expectedRadius);
            expect(facts.ownerBorder).toBe('0px');
            expect(facts.role).toBeNull();
            expect(facts.tabIndex).toBeNull();
            expect(facts.pointerEvents).toBe('none');
            expect(facts.sourceSelectable).toBe(true);
            expect(Math.max(...facts.boundsDelta)).toBeLessThanOrEqual(1);
            if (previousBackground) expect(facts.background).not.toBe(previousBackground);
            previousBackground = facts.background;
            const toolbar = terminal.locator('[data-code-toolbar]');
            const row = await toolbar.evaluate((row) => ({
              height: row.getBoundingClientRect().height,
              before: getComputedStyle(row, '::before').content,
              after: getComputedStyle(row, '::after').content,
              label: row.querySelector('[data-code-label]')?.textContent,
              copyY: row.querySelector('[data-site-copy]')?.getBoundingClientRect().y,
            }));
            expect(row.height).toBeGreaterThanOrEqual(44);
            expect(row.height).toBeLessThanOrEqual(46);
            expect(row.before).toMatch(/^(none|normal)$/);
            expect(row.after).toMatch(/^(none|normal)$/);
            expect(row.label?.trim()).toBeTruthy();
            expect(await plain.locator('[data-code-toolbar]').count()).toBe(0);
            expect(
              await example
                .locator('[data-code-example-command] [data-code-shell][data-site-code-surface]')
                .count()
            ).toBe(0);
            expect(await example.locator('[data-code-example-tablist]:visible').count()).toBe(1);
            expect(
              await example
                .locator('[data-code-host-panel]:visible [data-code-example-steps]')
                .count()
            ).toBe(1);
            expect(
              await cliInitTabs
                .locator('[data-code-example-tablist="file"][role="tablist"]:visible')
                .count()
            ).toBe(1);
            expect(
              await example
                .locator('[data-code-example-tablist="host"] [role="tab"]')
                .first()
                .evaluate((tab) => tab.getBoundingClientRect().height)
            ).toBeGreaterThanOrEqual(44);
            expect(
              Math.max(
                ...(await Promise.all(
                  [ecPage, page].map((surfacePage) =>
                    surfacePage.evaluate(() => document.documentElement.scrollWidth - innerWidth)
                  )
                ))
              )
            ).toBeLessThanOrEqual(1);
            await evidence(ecPage, terminal, `${runtime}-${family}-${theme}-terminal`, {
              familyInputFixture: true,
              facts,
              row,
            });
            pagePhase(page, 'frame-theme', 'done', { runtime, family, theme });
          }
          pagePhase(page, 'native-host-file-keys', 'start');
          await page.bringToFront();
          // Existing native tabs keep roving focus and source identity. This is
          // compatibility evidence, not a claim that they are already PUI Tabs.
          const hosts = example.locator('[data-code-example-tablist="host"] [role="tab"]');
          await hosts.first().focus();
          await page.keyboard.press('End');
          expect(await hosts.last().getAttribute('aria-selected')).toBe('true');
          expect(await hosts.last().evaluate((tab) => document.activeElement === tab)).toBe(true);
          // The last known host can be a truthful WIP entry, with no Copy or
          // runnable file steps. Return to a ready host and verify CLI init Tabs navigation.
          await hosts.filter({ hasText: 'React' }).click();
          const files = cliInitTabs.locator('[data-code-example-tablist="file"] [role="tab"]');
          await files.first().focus();
          await page.keyboard.press('End');
          expect(await files.last().evaluate((node) => node === document.activeElement)).toBe(true);
          expect(await files.last().getAttribute('aria-selected')).toBe('true');
          for (const node of sourceNodes)
            expect(await node.evaluate((node) => node.isConnected)).toBe(true);
          pagePhase(page, 'native-host-file-keys', 'done');
          await page.evaluate(() => {
            document.dispatchEvent(new Event('astro:page-load'));
            document.dispatchEvent(new Event('astro:page-load'));
          });
          // The real quick-start route restores Shadcn on astro:page-load.
          // Reinitialization can therefore also request a family transaction;
          // require its committed coordinates AND retirement, not just a count.
          await settled(exampleFrame, runtime, 'shadcn', 'route-reset', family);
          expect((await appearance(exampleFrame)).surfaceCount).toBe(1);
          for (const node of sourceNodes)
            expect(await node.evaluate((node) => node.isConnected)).toBe(true);
          await selectFixtureFamily(page, family);
          await settled(exampleFrame, runtime, family, 'fixture-restore', family);
          expect((await appearance(exampleFrame)).surfaceCount).toBe(1);
          for (const surfacePage of [ecPage, page])
            await surfacePage.setViewportSize({ width: 320, height: 1000 });
          expect(
            Math.max(
              ...(await Promise.all(
                [ecPage, page].map((surfacePage) =>
                  surfacePage.evaluate(() => document.documentElement.scrollWidth - innerWidth)
                )
              ))
            )
          ).toBeLessThanOrEqual(1);
          await evidence(page, example, `${runtime}-${family}-320-tabs`, {
            familyInputFixture: true,
            sourceNodesRetained: true,
          });
        } finally {
          await closeGrammarContext(context);
        }
      }, 120_000);
    }
  }
  it('keeps the installation toolbar thin with dogfood Tabs and ScrollArea without native scrollbars', async ({
    task,
  }) => {
    const context = await newGrammarContext(task, { viewport: { width: 390, height: 1000 } });
    const page = await context.newPage();
    try {
      await navigate(page, `${baseUrl}${INSTALL_ROUTE}`, { waitUntil: 'domcontentloaded' });
      const root = page.locator('[data-install-command-card]:visible').first();
      await ready(root, 'wc', 'shadcn');
      await root.locator('[data-copy-view="ready"] [data-demo-ref="copy-button"]').waitFor();
      await root
        .locator(
          '[data-command-panel]:visible [data-code-scroll-ready] [data-code-scroll-viewport]'
        )
        .waitFor({ state: 'visible' });
      const facts = await root.evaluate((root) => {
        const row = root.querySelector<HTMLElement>('[data-code-toolbar]')!;
        const tablist = row.querySelector<HTMLElement>('[data-install-command-tablist]')!;
        const manager = tablist.querySelector<HTMLElement>('[data-manager-tab][role="tab"]')!;
        const copy = row.querySelector<HTMLElement>('[data-demo-ref="copy-button"]')!;
        const viewport = root.querySelector<HTMLElement>(
          '[data-command-panel]:not([hidden]) [data-code-scroll-ready] [data-code-scroll-viewport]'
        )!;
        const rowRect = row.getBoundingClientRect();
        const managerRect = manager.getBoundingClientRect();
        const copyRect = copy.getBoundingClientRect();
        return {
          row: rowRect.height,
          manager: managerRect.height,
          managerRole: manager.getAttribute('role'),
          tablistScrollbar: getComputedStyle(tablist).scrollbarWidth,
          viewportTag: viewport.localName,
          viewportOverflow: getComputedStyle(viewport).overflowX,
          viewportScrollbar: getComputedStyle(viewport).scrollbarWidth,
          centerDelta: Math.abs(
            managerRect.y + managerRect.height / 2 - copyRect.y - copyRect.height / 2
          ),
          source: root.querySelector('[data-command]')!.textContent,
        };
      });
      expect(facts.row).toBeGreaterThanOrEqual(44);
      expect(facts.row).toBeLessThanOrEqual(46);
      expect(facts.managerRole).toBe('tab');
      expect(facts.manager).toBeGreaterThanOrEqual(24);
      expect(facts.tablistScrollbar).toBe('none');
      expect(facts.viewportTag).toBe('wc-site-code-scroll-viewport');
      expect(facts.viewportOverflow).toBe('auto');
      expect(facts.viewportScrollbar).toBe('none');
      expect(facts.centerDelta).toBeLessThanOrEqual(2);
      expect(facts.source?.startsWith('npx ')).toBe(true);
      await evidence(page, root, '390-install-toolbar', facts);
    } finally {
      await closeGrammarContext(context);
    }
  }, 90_000);
});

// This is the CodeExample legacy WC chrome only, not a page-runtime migration.
describe.sequential('CodeExample host coverage and upstream visual hierarchy', () => {
  for (const locale of ['en', 'zh-cn']) {
    for (const width of [320, 390, 1440]) {
      for (const theme of ['light', 'dark']) {
        it(`${locale}/${width}/${theme}: known hosts remain selectable and WIP never invents code`, async ({
          task,
        }) => {
          const context = await newGrammarContext(task, { viewport: { width, height: 1000 } });
          const page = await context.newPage();
          try {
            await navigate(page, `${baseUrl}/${locale}/start-here/quick-start/`, {
              waitUntil: 'domcontentloaded',
            });
            await page.evaluate((theme) => (document.documentElement.dataset.theme = theme), theme);
            const example = page.locator('[data-code-example]').first();
            const hosts = example.locator('[data-code-example-tablist="host"] [role="tab"]');
            await hosts.last().waitFor();
            // Preserve an actual source-bound diagnostic even when a later
            // semantic assertion fails; this is not acceptance evidence.
            await evidence(
              page,
              example,
              `code-example-${locale}-${width}-${theme}-before-assertions`,
              {
                stage: 'before-assertions',
                chromeRuntime: 'wc',
                acceptance: false,
              }
            );
            const hostNames = ['Web Components', 'React', 'Vue', 'Vue 2', 'GPUI', 'Qt', 'Flutter'];
            const pendingLabel = locale === 'en' ? 'WIP' : '开发中';
            expect(
              await hosts.evaluateAll((nodes) =>
                nodes.map((node) => (node as HTMLElement).dataset.codeHostName)
              )
            ).toEqual(hostNames);
            expect(await hosts.allTextContents()).toEqual(
              hostNames.map((name, index) => (index < 3 ? name : `${name} · ${pendingLabel}`))
            );
            expect(await hosts.locator('[data-code-host-status]').count()).toBe(4);
            if (width <= 390) {
              const hint = example.locator('[data-code-host-overflow]');
              expect(await hint.isVisible()).toBe(true);
              expect(
                await hint.evaluate((node) =>
                  node.previousElementSibling?.getAttribute('data-code-example-tablist')
                )
              ).toBe('host');
            }
            const sourceNodes = await example.locator('pre').elementHandles();
            for (const host of [
              'Web Components',
              'React',
              'Vue',
              'Vue 2',
              'GPUI',
              'Qt',
              'Flutter',
            ]) {
              pagePhase(page, 'content-host', 'start', { host });
              // Match the complete accessible name, including availability.
              await example
                .getByRole('tab', {
                  name: hostNames.indexOf(host) < 3 ? host : `${host} · ${pendingLabel}`,
                  exact: true,
                })
                .click();
              const panel = example.locator('[data-code-host-panel]:visible');
              expect(await panel.count()).toBe(1);
              if (['Vue 2', 'GPUI', 'Qt', 'Flutter'].includes(host)) {
                expect(await panel.locator('[data-code-example-wip]').count()).toBe(1);
                expect(
                  await panel.locator('pre, [data-site-copy], [data-code-file-tabs]').count()
                ).toBe(0);
                expect(await panel.textContent()).toContain('WIP');
              } else {
                const steps = panel.locator('[data-code-example-steps]');
                expect(await steps.count()).toBe(1);
                expect(
                  await panel.locator('[data-code-example-command] pre').textContent()
                ).toContain('npx @proto.ui/cli@latest');
                expect(
                  await panel
                    .locator(
                      '[data-code-example-command] [role="tab"], [data-code-example-command] [role="tabpanel"]'
                    )
                    .count()
                ).toBe(0);
                expect(
                  await panel
                    .locator('[data-code-example-steps] [data-code-example-command]')
                    .count()
                ).toBe(0);
                const expectedPaths =
                  host === 'React'
                    ? ['src/App.tsx']
                    : host === 'Vue'
                      ? ['src/App.vue']
                      : ['src/main.ts', 'index.html'];
                const stepPanels = steps.locator('[data-code-file-panel]:visible');
                expect(await stepPanels.count()).toBe(expectedPaths.length);
                expect(
                  await stepPanels.locator('[data-code-file-title]').allTextContents()
                ).toEqual(expectedPaths);
                expect(await stepPanels.first().locator('pre').textContent()).toContain(
                  'proto-ui/components/'
                );
                if (host === 'Web Components') {
                  const htmlText = await stepPanels.last().locator('pre').textContent();
                  expect(htmlText).toContain('<proto-ui-shadcn-button');
                  expect(htmlText).toContain('type="module"');
                }
                expect(await panel.textContent()).not.toContain('document.body.innerHTML');
                expect(await panel.locator('[data-code-toggle]').count()).toBe(0);
                expect(await panel.locator('[data-code-example-guidance]').count()).toBe(
                  host === 'Web Components' ? 1 : 0
                );
                const shells = panel.locator('[data-code-shell]:visible');
                for (const shell of await shells.all()) {
                  expect(await shell.getAttribute('data-code-expanded')).toBe('true');
                  const copy = shell.locator(
                    '[data-copy-view="ready"] [data-demo-ref="copy-button"]'
                  );
                  await copy.waitFor();
                  const source = shell.locator('pre');
                  const sourceBox = await source.boundingBox();
                  const copyBox = await copy.boundingBox();
                  expect(sourceBox).not.toBeNull();
                  expect(copyBox).not.toBeNull();
                  const fileHeader = shell.locator('[data-code-file-header]');
                  if (await fileHeader.count()) {
                    const headerBox = await fileHeader.boundingBox();
                    expect(headerBox!.height).toBeGreaterThanOrEqual(40);
                    expect(copyBox!.y).toBeGreaterThanOrEqual(headerBox!.y);
                    expect(copyBox!.y + copyBox!.height).toBeLessThanOrEqual(
                      headerBox!.y + headerBox!.height
                    );
                    expect(sourceBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height);
                  } else {
                    const viewport = shell.locator(
                      '[data-code-scroll-ready] [data-code-scroll-viewport]'
                    );
                    const viewportBox = await viewport.boundingBox();
                    expect(viewportBox).not.toBeNull();
                    // Long source keeps its max-content width inside the real
                    // ScrollArea. Its clipping viewport must stop before Copy.
                    expect(viewportBox!.x + viewportBox!.width).toBeLessThanOrEqual(copyBox!.x + 1);
                    expect(
                      await viewport.evaluate((node) => ({
                        overflowX: getComputedStyle(node).overflowX,
                        ownsSource: node.contains(
                          node.closest('[data-code-shell]')!.querySelector('pre')
                        ),
                      }))
                    ).toEqual({ overflowX: 'auto', ownsSource: true });
                  }
                  expect(await source.evaluate((pre) => getComputedStyle(pre).maxHeight)).toBe(
                    'none'
                  );
                  const expectedTarget = await shell.evaluate((shell) =>
                    shell.closest('[data-code-example-command]')
                      ? shell.closest('[data-code-example-command]')!.getAttribute('aria-label')
                      : shell.querySelector('code') && shell.getAttribute('data-code-file-index')
                  );
                  const copyLabel = await shell
                    .locator('[data-site-copy]')
                    .getAttribute('data-copy-label');
                  expect(copyLabel?.startsWith(locale === 'en' ? 'Copy ' : '复制 ')).toBe(true);
                  if (expectedTarget === 'Terminal' || expectedTarget === '终端')
                    expect(copyLabel).toBe(
                      `${locale === 'en' ? 'Copy' : '复制'} ${expectedTarget}`
                    );
                  else {
                    const fileIndex = Number(expectedTarget ?? '0');
                    const expectedPath = expectedPaths[fileIndex];
                    expect(copyLabel).toContain(expectedPath);
                    expect(await shell.locator('[data-code-file-title]').textContent()).toBe(
                      expectedPath
                    );
                  }
                }
              }
              expect(
                await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
              ).toBeLessThanOrEqual(1);
              await evidence(
                page,
                example,
                `code-example-${locale}-${width}-${theme}-${host.replaceAll(' ', '-')}`,
                {
                  chromeRuntime: 'wc',
                  contentHost: host,
                  stableVersion: '0.2.0',
                }
              );
              pagePhase(page, 'content-host', 'done', { host });
            }
            pagePhase(page, 'host-end-key-and-source-retention', 'start');
            await hosts.first().focus();
            await page.keyboard.press('End');
            expect(await hosts.last().getAttribute('aria-selected')).toBe('true');
            expect(await hosts.last().evaluate((node) => node === document.activeElement)).toBe(
              true
            );
            const lastBounds = await hosts.last().boundingBox();
            const listBounds = await example
              .locator('[data-code-example-tablist="host"]')
              .boundingBox();
            expect(lastBounds!.x).toBeGreaterThanOrEqual(listBounds!.x - 1);
            expect(lastBounds!.x + lastBounds!.width).toBeLessThanOrEqual(
              listBounds!.x + listBounds!.width + 1
            );
            for (const node of sourceNodes)
              expect(await node.evaluate((node) => node.isConnected)).toBe(true);
            pagePhase(page, 'host-end-key-and-source-retention', 'done');
          } finally {
            await closeGrammarContext(context);
          }
        }, 120_000);
      }
    }
  }
});

it('keeps every authored source reachable without JavaScript and does not fake an interactive tree', async ({
  task,
}) => {
  const context = await newGrammarContext(task, {
    javaScriptEnabled: false,
    viewport: { width: 390, height: 1000 },
  });
  const page = await context.newPage();
  try {
    await navigate(page, `${baseUrl}/en/start-here/quick-start/`);
    const example = page.locator('[data-code-example]');
    expect(await example.locator('[role="tree"], [role="treeitem"]').count()).toBe(0);
    expect(await example.locator('[data-code-host-panel]:visible').count()).toBe(7);
    const generated = page.locator('[data-cli-generated-files]');
    expect(await generated.locator('[role="tree"], [role="treeitem"]').count()).toBe(0);
    expect(await generated.locator('[data-cli-file-panel]:visible').count()).toBe(4);
    const files = cliInitOutput.entries.filter((entry) => entry.kind === 'file');
    for (const file of files) {
      const link = generated.locator(`[data-code-file-path="${file.path}"]`);
      const id = await link.getAttribute('aria-controls');
      expect(await link.getAttribute('href')).toBe(`#${id}`);
      const panel = generated.locator(`[id="${id}"]`);
      expect(await panel.locator('code').getAttribute('data-raw-code')).toBe(file.content);
      await link.click();
      expect(await panel.isVisible()).toBe(true);
    }
    await evidence(page, generated.locator('[data-cli-file-panel]').last(), 'cli-init-no-js', {
      fileCount: files.length,
    });
    expect(await generated.locator('[data-code-directory-path]').count()).toBe(3);
    expect(await example.locator('[data-code-file-panel]:visible').count()).toBe(4);
    expect(
      await example.locator('[data-code-host="wc"] [data-code-file-panel]:visible').count()
    ).toBe(2);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    ).toBeLessThanOrEqual(1);
  } finally {
    await closeGrammarContext(context);
  }
}, 90_000);

it('keeps generated-file Tabs navigation identifiable in forced colors and enlarged text', async ({
  task,
}) => {
  const context = await newGrammarContext(task, {
    viewport: { width: 390, height: 1000 },
    forcedColors: 'active',
  });
  const page = await context.newPage();
  try {
    await navigate(page, `${baseUrl}/en/start-here/quick-start/`);
    const cliInit = page.locator('[data-cli-init-tabs][data-cli-init-tabs-init="1"]');
    await cliInit.waitFor();
    const tablist = cliInit.locator('[data-code-example-tablist="file"][role="tablist"]');
    const tabs = tablist.locator('[role="tab"]');
    expect(await tabs.count()).toBe(4);
    await tabs.first().focus();
    await page.keyboard.press('ArrowRight');
    expect(await tabs.nth(1).evaluate((node) => node === document.activeElement)).toBe(true);
    expect(await tabs.nth(1).getAttribute('aria-selected')).toBe('true');
    expect(await tablist.evaluate((node) => getComputedStyle(node).scrollbarWidth)).toBe('none');
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    ).toBeLessThanOrEqual(1);
    await evidence(page, cliInit, 'cli-init-tabs-forced-colors-text200', {
      forcedColors: true,
      textScalePercent: 200,
    });
  } finally {
    await closeGrammarContext(context);
  }
}, 90_000);

for (const locale of ['en', 'zh-cn']) {
  it(`browses real build-generated init files with dogfood Tabs, expandable CodePanels, and ScrollArea (${locale})`, async ({
    task,
  }) => {
    const context = await newGrammarContext(task, { viewport: { width: 390, height: 1000 } });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            (window as Window & { __initCopy?: string }).__initCopy = text;
          },
        },
      });
    });
    const page = await context.newPage();
    try {
      await navigate(page, `${baseUrl}/${locale}/start-here/quick-start/`);
      expect(await page.locator('.expressive-code').count()).toBe(0);
      for (const [id, command] of [
        ['quick-start-cli-help', 'npx @proto.ui/cli@latest --help'],
        ['quick-start-init-command', 'npx @proto.ui/cli@latest init'],
      ]) {
        const terminal = page.locator(`#${id}`);
        expect(await terminal.getAttribute('data-code-presentation')).toBe('docs');
        expect(await terminal.getAttribute('data-code-line-numbers')).toBe('false');
        expect(await terminal.locator('code').getAttribute('data-raw-code')).toBe(command);
        await terminal
          .locator('[data-code-scroll-ready] [data-code-scroll-viewport]')
          .waitFor({ state: 'visible' });
        expect(
          await terminal
            .locator('[data-code-scroll-ready] [data-code-scroll-viewport]')
            .evaluate((node) => getComputedStyle(node).scrollbarWidth)
        ).toBe('none');
        expect(
          await terminal
            .locator('.line')
            .first()
            .evaluate((node) => getComputedStyle(node, '::before').display)
        ).toBe('none');
        expect(
          await terminal.locator('pre').evaluate((node) => node.scrollWidth - node.clientWidth)
        ).toBe(0);
        const copy = terminal.locator('[data-copy-view="ready"] [data-demo-ref="copy-button"]');
        await copy.click();
        expect(
          await page.evaluate(() => (window as Window & { __initCopy?: string }).__initCopy)
        ).toBe(command);
        expect(
          await copy.evaluate((node) => [
            node.getBoundingClientRect().width,
            node.getBoundingClientRect().height,
          ])
        ).toEqual([28, 28]);
      }

      const output = page.locator('[data-cli-init-output]');
      expect(await output.getAttribute('data-cli-version')).toBe(cliInitOutput.cli.version);
      const cliInit = output.locator('[data-cli-init-tabs][data-cli-init-tabs-init="1"]');
      await cliInit.waitFor();
      expect(await cliInit.locator('[role="tree"], [role="treeitem"]').count()).toBe(0);
      const tablist = cliInit.locator('[data-code-example-tablist="file"][role="tablist"]');
      expect(await tablist.evaluate((node) => getComputedStyle(node).scrollbarWidth)).toBe('none');
      const tabs = tablist.locator('[role="tab"]');
      const files = cliInitOutput.entries.filter((entry) => entry.kind === 'file');
      expect(await tabs.count()).toBe(files.length);

      // Default tab is proto-ui/config.json, shown fully expanded (short file).
      expect(
        await tablist.locator('[aria-selected="true"]').getAttribute('data-cli-file-path')
      ).toBe('proto-ui/config.json');
      const visiblePanel = () => cliInit.locator('[data-cli-file-panel]:visible');
      expect(await visiblePanel().count()).toBe(1);
      expect(
        await visiblePanel().locator('[data-code-shell]').getAttribute('data-code-expanded')
      ).toBe('true');

      // Switching to long generated CSS file shows collapsible preview, then expands cleanly.
      const themeTab = tablist.locator('[data-cli-file-path="src/styles/shadcn-theme.css"]');
      await themeTab.click();
      const themeShell = visiblePanel().locator('[data-code-shell]');
      expect(await themeShell.locator('[data-code-file-title]').textContent()).toBe(
        'src/styles/shadcn-theme.css'
      );
      await expect.poll(() => themeShell.getAttribute('data-code-expanded')).toBe('false');
      await themeShell.locator('[data-code-toggle]').click();
      await expect.poll(() => themeShell.getAttribute('data-code-expanded')).toBe('true');
      const themeViewport = themeShell.locator(
        '[data-code-scroll-ready] [data-code-scroll-viewport]'
      );
      await expect.poll(() => themeViewport.count()).toBe(1);
      const themeAnatomy = await themeViewport.evaluate((viewport) => {
        const pre = viewport.querySelector('pre')!;
        const root = viewport.closest('[data-code-scroll-anatomy]')!;
        return {
          tags: [
            root.localName,
            viewport.localName,
            ...[...root.querySelectorAll('[data-code-scroll-track] > *')].map(
              (node) => node.localName
            ),
          ],
          trackAxes: [...root.querySelectorAll('[data-code-scroll-track]')].map((node) =>
            (node as HTMLElement & { getExposes(): { orientation: { get(): string } } })
              .getExposes()
              .orientation.get()
          ),
          preOverflow: getComputedStyle(pre).overflowX,
          nativeBars: getComputedStyle(viewport).scrollbarWidth,
        };
      });
      expect(themeAnatomy).toEqual({
        tags: [
          'wc-site-code-scroll-root',
          'wc-site-code-scroll-viewport',
          'wc-site-code-scroll-thumb',
          'wc-site-code-scroll-thumb',
        ],
        trackAxes: ['vertical', 'horizontal'],
        preOverflow: 'visible',
        nativeBars: 'none',
      });
      const copy = themeShell.locator('[data-copy-view="ready"] [data-demo-ref="copy-button"]');
      await copy.click();
      expect(
        await page.evaluate(() => (window as Window & { __initCopy?: string }).__initCopy)
      ).toBe(files.find((entry) => entry.path === 'src/styles/shadcn-theme.css')?.content);
      await themeShell.locator('[data-code-collapse]').click();
      await expect.poll(() => themeShell.getAttribute('data-code-expanded')).toBe('false');

      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
      ).toBeLessThanOrEqual(1);
      await evidence(page, output, `cli-init-${locale}-390`, {
        cliVersion: cliInitOutput.cli.version,
        sourceTreeHash: cliInitOutput.cli.sourceTreeHash,
        files: files.map((file) => ({ path: file.path, sha256: file.sha256 })),
      });
    } finally {
      await closeGrammarContext(context);
    }
  }, 90_000);
}
