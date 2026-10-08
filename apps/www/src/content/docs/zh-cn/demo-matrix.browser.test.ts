// @vitest-environment node

import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Browser, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RUNTIMES, launchBrowser, startServer, stopServer } from './browser-harness';
import {
  matrixHostsReady,
  collectMatrixReadinessDiagnostics,
  collectMatrixInteractiveFacts,
  type InteractiveFact,
} from './demo-matrix-observation';

import { startMatrixStartupDiagnostic } from './demo-matrix-startup-diagnostic';

const MATRIX_ROUTE = '/zh-cn/internal/demo-matrix/';

type MatrixFacts = {
  demos: number;
  previewers: number;
  initialized: number;
  errors: number;
  errorDetails: string[];
  overflow: number;
  overflowDetails: Array<{
    demoId: string;
    adapter: string;
    tag: string;
    ref: string | null;
    className: string;
    text: string;
    left: number;
    right: number;
    width: number;
    outside: number;
    clippingAncestor: string | null;
  }>;
  adapterColumns: string;
  adapterColumnCount: number;
  runtimeRows: Record<string, number>;
  unavailable: string[];
};

const INTERACTIVE_ROLES = [
  'button',
  'checkbox',
  'combobox',
  'menuitem',
  'radio',
  'switch',
  'tab',
  'textbox',
] as const;

type MatrixDiagnosticState = {
  caseName: string;
  phase: string;
  sequence: number;
  pageErrors: Array<{ name: string; message: string; stack: string | null; at: string }>;
  startupDiagnostic?: Awaited<ReturnType<typeof startMatrixStartupDiagnostic>>;
};
const matrixDiagnostics = new WeakMap<Page, MatrixDiagnosticState>();
const diagnosticSourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

async function persistReadinessDiagnostic(
  page: Page,
  phase: string,
  outcome: string,
  error?: unknown
): Promise<void> {
  const state = matrixDiagnostics.get(page);
  if (!state) return;
  state.phase = phase;
  const sequence = ++state.sequence;
  const header = {
    sourceSha: diagnosticSourceSha,
    caseName: state.caseName,
    phase,
    outcome,
    sequence,
    at: new Date().toISOString(),
    viewport: page.viewportSize(),
    error:
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack ?? null }
        : error == null
          ? null
          : String(error),
  };
  // Emit before any page evaluation so a blocked renderer cannot erase the
  // precise case/phase at the outer runner's existing termination boundary.
  console.log(`[demo-matrix-readiness] ${JSON.stringify(header)}`);
  const root =
    process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR ?? process.env.PROTO_UI_BROWSER_EVIDENCE_DIR;
  if (!root) return;
  const directory = join(root, 'demo-matrix', 'readiness');
  const file = join(
    directory,
    `${page.viewportSize()?.width ?? 0}-${state.caseName.replace(/[^a-zA-Z0-9]+/g, '-').slice(-110)}-${sequence}-${phase}.json`
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await mkdir(directory, { recursive: true });
    // Write the durable header first. Snapshot timeout affects diagnostics only,
    // never either original 60-second wait, assertions, or availability.
    await writeFile(
      file,
      JSON.stringify(
        { ...header, pageErrors: [...state.pageErrors], snapshot: null, snapshotStatus: 'pending' },
        null,
        2
      )
    );
    const snapshot = await Promise.race([
      page.evaluate(collectMatrixReadinessDiagnostics, RUNTIMES.length),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error('Read-only diagnostic snapshot unavailable within 1000ms')),
          1000
        );
      }),
    ]);
    await writeFile(
      file,
      JSON.stringify(
        { ...header, pageErrors: [...state.pageErrors], snapshot, snapshotStatus: 'captured' },
        null,
        2
      )
    );
  } catch (snapshotError) {
    console.error(`[demo-matrix-diagnostic-unavailable] ${String(snapshotError)}`);
    await writeFile(
      file,
      JSON.stringify(
        {
          ...header,
          pageErrors: [...state.pageErrors],
          snapshot: null,
          snapshotStatus: 'unavailable',
          snapshotError: String(snapshotError),
        },
        null,
        2
      )
    ).catch((writeError) =>
      console.error(`[demo-matrix-diagnostic-write-error] ${String(writeError)}`)
    );
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function observeMatrixWait(
  page: Page,
  phase: string,
  wait: () => Promise<unknown>
): Promise<void> {
  await persistReadinessDiagnostic(page, phase, 'started');
  try {
    await wait();
  } catch (error) {
    await persistReadinessDiagnostic(page, phase, 'failed', error);
    throw error;
  }
  await persistReadinessDiagnostic(page, phase, 'passed');
}

async function openMatrixRoute(viewport: { width: number; height: number }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const state: MatrixDiagnosticState = {
    caseName: expect.getState().currentTestName ?? 'unknown-case',
    phase: 'route-open',
    sequence: 0,
    pageErrors: [],
  };
  matrixDiagnostics.set(page, state);
  page.on('pageerror', (error) => {
    const entry = {
      name: error.name,
      message: error.message.slice(0, 8000),
      stack: error.stack?.slice(0, 8000) ?? null,
      at: new Date().toISOString(),
    };
    if (state.pageErrors.length < 100) state.pageErrors.push(entry);
    console.error(
      `[demo-matrix-pageerror] ${JSON.stringify({ sourceSha: diagnosticSourceSha, caseName: state.caseName, phase: state.phase, ...entry })}`
    );
  });
  const evidenceDirectory =
    process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR ?? process.env.PROTO_UI_BROWSER_EVIDENCE_DIR;
  if (
    process.env.PROTO_UI_MATRIX_STARTUP_PROFILE === '1' &&
    evidenceDirectory &&
    state.caseName.endsWith('mounts every demo in every official Web adapter')
  ) {
    state.startupDiagnostic = await startMatrixStartupDiagnostic(page, {
      enabled: true,
      directory: evidenceDirectory,
      sourceSha: diagnosticSourceSha,
      caseName: state.caseName,
      origin: new URL(baseUrl).origin,
      phase: () => state.phase,
    });
  }
  await persistReadinessDiagnostic(page, 'route-open', 'started');
  try {
    // Preserve openRoute's exact navigation and first-visible-preview boundary.
    await page.goto(`${baseUrl}${MATRIX_ROUTE}`, { waitUntil: 'networkidle' });
    await page.locator('[data-previewer-id]').first().waitFor({ state: 'visible' });
  } catch (error) {
    await persistReadinessDiagnostic(page, 'route-open', 'failed', error);
    await state.startupDiagnostic?.finish();
    await context.close();
    throw error;
  }
  await persistReadinessDiagnostic(page, 'route-open', 'passed');
  return { context, page };
}

async function waitForMatrix(page: Page): Promise<void> {
  await observeMatrixWait(page, 'inited-count', () =>
    page.waitForFunction(
      (runtimeCount) => {
        const demos = document.querySelectorAll('.demo-matrix__item').length;
        const previewers = document.querySelectorAll('[data-previewer-id]').length;
        const initialized = document.querySelectorAll(
          '[data-previewer-id][data-inited="1"]'
        ).length;
        const unavailable = document.querySelectorAll(
          '.demo-matrix__adapter[data-unavailable]'
        ).length;
        return (
          demos > 0 &&
          previewers === demos * runtimeCount - unavailable &&
          initialized === previewers
        );
      },
      RUNTIMES.length,
      { timeout: 60_000 }
    )
  );

  // A connected skeleton or laid-out staging generation is not a completed
  // projection. Observe the existing commit boundary, never signature parity.
  await observeMatrixWait(page, 'committed-host-readiness', () =>
    page.waitForFunction(matrixHostsReady, undefined, { timeout: 60_000 })
  );
}

async function readMatrixFacts(page: Page): Promise<MatrixFacts> {
  return page.evaluate((runtimeIds) => {
    const root = document.documentElement;
    const adapters = [...document.querySelectorAll<HTMLElement>('.demo-matrix__adapter')];
    const runtimeRows = Object.fromEntries(
      runtimeIds.map((runtime) => [
        runtime,
        adapters.filter((adapter) =>
          adapter
            .getAttribute('aria-label')
            ?.endsWith(
              runtime === 'wc'
                ? 'Web Components'
                : runtime === 'vue2'
                  ? 'Vue 2'
                  : runtime[0].toUpperCase() + runtime.slice(1)
            )
        ).length,
      ])
    );
    const firstGrid = document.querySelector<HTMLElement>('.demo-matrix__adapters');
    const firstColumns = new Set(
      [...(firstGrid?.querySelectorAll<HTMLElement>(':scope > .demo-matrix__adapter') ?? [])].map(
        (adapter) => Math.round(adapter.getBoundingClientRect().left)
      )
    );
    const errorPreviewers = [...document.querySelectorAll('[data-previewer-id]')].filter(
      (previewer) => previewer.textContent?.includes('[Preview Error]')
    );
    return {
      demos: document.querySelectorAll('.demo-matrix__item').length,
      previewers: document.querySelectorAll('[data-previewer-id]').length,
      initialized: document.querySelectorAll('[data-previewer-id][data-inited="1"]').length,
      errors: errorPreviewers.length,
      errorDetails: errorPreviewers.map(
        (previewer) =>
          `${previewer.closest('.demo-matrix__adapter')?.getAttribute('aria-label')} (${previewer.getAttribute('data-previewer-id')}): ${previewer.textContent}`
      ),
      overflow: root.scrollWidth - root.clientWidth,
      // Keep raw geometry, including which descendants are inside an intentional
      // scroll/clip surface. Such content is useful diagnosis, not page overflow.
      overflowDetails: Array.from(
        document.querySelectorAll<HTMLElement>('.demo-matrix__adapter, .demo-matrix__adapter *')
      )
        .flatMap((element) => {
          const rect = element.getBoundingClientRect();
          if (!rect.width || !rect.height || (rect.left >= 0 && rect.right <= root.clientWidth))
            return [];
          let clippingAncestor: string | null = null;
          for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
            if (
              ['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(ancestor).overflowX)
            ) {
              clippingAncestor = `${ancestor.tagName.toLowerCase()}[data-demo-ref="${ancestor.getAttribute('data-demo-ref') ?? ''}"]`;
              break;
            }
          }
          return [
            {
              demoId: element.closest('.demo-matrix__item')?.id ?? '',
              adapter: element.closest('.demo-matrix__adapter')?.getAttribute('aria-label') ?? '',
              tag: element.tagName.toLowerCase(),
              ref: element.getAttribute('data-demo-ref'),
              className: element.getAttribute('class') ?? '',
              text: (element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 160),
              left: rect.left,
              right: rect.right,
              width: rect.width,
              outside: Math.max(-rect.left, rect.right - root.clientWidth),
              clippingAncestor,
            },
          ];
        })
        .sort(
          (a, b) =>
            Number(!!a.clippingAncestor) - Number(!!b.clippingAncestor) || b.outside - a.outside
        )
        .slice(0, 40),
      adapterColumns: firstGrid ? getComputedStyle(firstGrid).gridTemplateColumns : '',
      adapterColumnCount: firstColumns.size,
      runtimeRows,
      unavailable: adapters.flatMap((adapter) => {
        const reason = adapter.getAttribute('data-unavailable');
        return reason ? [reason] : [];
      }),
    };
  }, RUNTIMES);
}

/**
 * Read only rendered, non-zero-sized controls. Portaled dialog/menu parts are
 * present in the document while closed, but are not part of the visible
 * matrix surface until the corresponding trigger opens them.
 */
async function readInteractiveFacts(page: Page): Promise<Record<string, InteractiveFact[][]>> {
  return page.evaluate(collectMatrixInteractiveFacts, INTERACTIVE_ROLES);
}

async function chooseGlobalAdapter(page: Page, runtime: string): Promise<void> {
  const root = page.locator('wc-shadcn-select-root[data-adapter-select-root]').first();
  await root.locator('wc-shadcn-select-trigger').click();
  await page
    .locator(
      `wc-shadcn-select-content[data-transition-state="entered"] wc-shadcn-select-item[data-value="${runtime}"]`
    )
    .click({ force: true });
  await page.waitForFunction(
    (selected) =>
      document.querySelector<HTMLElement>('wc-shadcn-select-root[data-adapter-select-root]')
        ?.dataset.value === selected,
    runtime,
    { timeout: 10_000 }
  );
}

let browser: Browser;
let baseUrl = '';

async function persistNarrowMatrix(page: Page, width: number, facts: MatrixFacts): Promise<void> {
  const evidenceRoot =
    process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR ?? process.env.PROTO_UI_BROWSER_EVIDENCE_DIR;
  if (!evidenceRoot) return;
  const directory = join(evidenceRoot, 'demo-matrix');
  await mkdir(directory, { recursive: true });
  const source = {
    sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirty: !!execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
      encoding: 'utf8',
    }).trim(),
  };
  const demoId =
    facts.overflowDetails.find((detail) => !detail.clippingAncestor)?.demoId ||
    'demo-base-transition';
  const screenshot = `matrix-${width}.png`;
  await writeFile(
    join(directory, `matrix-${width}.json`),
    JSON.stringify(
      {
        schemaVersion: 1,
        source,
        capturedAt: new Date().toISOString(),
        screenshot,
        viewport: page.viewportSize(),
        screenshotDemoId: demoId,
        facts,
      },
      null,
      2
    )
  );
  // Persist the primary overflow/owner facts before screenshot acquisition.
  await page
    .locator(`[id="${demoId}"] .demo-matrix__adapter`)
    .first()
    .screenshot({ path: join(directory, screenshot) });
}

beforeAll(async () => {
  baseUrl = await startServer(MATRIX_ROUTE);
  browser = await launchBrowser();
}, 150_000);

afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

describe.sequential('Website Demo Matrix browser smoke', () => {
  it('mounts every demo in every official Web adapter', async () => {
    const { context, page } = await openMatrixRoute({
      width: 1440,
      height: 900,
    });

    try {
      await waitForMatrix(page);
      const facts = await readMatrixFacts(page);
      expect(facts.demos).toBeGreaterThan(0);
      // The internal matrix deliberately compares each prototype across supported Web adapters.
      expect(facts.unavailable).toEqual([]);
      expect(facts.previewers).toBe(facts.demos * RUNTIMES.length);
      expect(facts.initialized).toBe(facts.previewers);
      expect(facts.errors, facts.errorDetails.join('\n\n')).toBe(0);
      expect(facts.overflow, JSON.stringify(facts.overflowDetails, null, 2)).toBeLessThanOrEqual(0);
      expect(facts.adapterColumnCount).toBe(RUNTIMES.length);
      for (const runtime of RUNTIMES) {
        expect(facts.runtimeRows[runtime], runtime).toBe(facts.demos);
      }

      const interactive = await readInteractiveFacts(page);
      for (const [demoId, adapters] of Object.entries(interactive)) {
        const signatures = adapters.map((controls) =>
          controls.map(({ role, name }) => `${role}|${name}`)
        );
        expect(
          signatures.flat().every((signature) => signature.endsWith('|') === false),
          `${demoId} has an unnamed visible interactive control`
        ).toBe(true);
        expect(
          new Set(signatures.map((signature) => JSON.stringify(signature))).size,
          `${demoId} accessible controls differ across runtimes: ${JSON.stringify(Object.fromEntries(RUNTIMES.map((runtime, index) => [runtime, signatures[index]])))}`
        ).toBeLessThanOrEqual(1);
      }

      const waitForAdapterBroadcast = () =>
        page.evaluate(
          () =>
            new Promise<boolean>((resolve) => {
              document.addEventListener('proto-adapter:change', () => resolve(true), {
                once: true,
              });
            })
        );
      const vue2Broadcast = waitForAdapterBroadcast();
      await chooseGlobalAdapter(page, 'vue2');
      await vue2Broadcast;
      const reactBroadcast = waitForAdapterBroadcast();
      await chooseGlobalAdapter(page, 'react');
      await reactBroadcast;
    } finally {
      await persistReadinessDiagnostic(page, 'case-finally', 'observed');
      await matrixDiagnostics.get(page)?.startupDiagnostic?.finish();
      await context.close();
    }
  }, 180_000);

  for (const width of [320, 390]) {
    it(`keeps the matrix readable at ${width}px`, async () => {
      const { context, page } = await openMatrixRoute({
        width,
        height: 900,
      });

      try {
        await waitForMatrix(page);
        const facts = await readMatrixFacts(page);
        await persistNarrowMatrix(page, width, facts);
        expect(facts.errors, facts.errorDetails.join('\n\n')).toBe(0);
        expect(facts.overflow, JSON.stringify(facts.overflowDetails, null, 2)).toBeLessThanOrEqual(
          0
        );
        expect(facts.adapterColumnCount).toBe(1);
        expect(facts.unavailable).toEqual([]);
        expect(facts.previewers).toBe(facts.demos * RUNTIMES.length);
      } finally {
        await persistReadinessDiagnostic(page, 'case-finally', 'observed');
        await context.close();
      }
    }, 180_000);
  }

  it('moves focus into the Base Dialog content in every runtime', async () => {
    const { context, page } = await openMatrixRoute({
      width: 1440,
      height: 900,
    });

    const runtimeLabels: Record<string, string> = {
      wc: 'Web Components',
      react: 'React',
      vue: 'Vue',
      vue2: 'Vue 2',
    };

    try {
      await waitForMatrix(page);
      const dialogRow = page.locator('#demo-base-dialog');

      for (const runtime of RUNTIMES) {
        const region = dialogRow.locator(
          `.demo-matrix__adapter[aria-label="demo-base-dialog ${runtimeLabels[runtime]}"]`
        );
        const trigger = region.locator('[aria-haspopup="dialog"]');
        await trigger.scrollIntoViewIfNeeded();
        const contentId = await trigger.getAttribute('aria-controls');
        expect(contentId, `${runtime} dialog controls`).toBeTruthy();
        await trigger.click();

        await page.waitForFunction(
          (id) => {
            const content = id ? document.getElementById(id) : null;
            return Boolean(
              content &&
              getComputedStyle(content).display !== 'none' &&
              document.activeElement &&
              content.contains(document.activeElement)
            );
          },
          contentId,
          { timeout: 10_000 }
        );

        const cancel = page
          .locator(`[id="${contentId}"] [data-pui-a11y-actions="activate"]`)
          .first();
        await cancel.click();
        await page.waitForFunction(
          (id) => {
            const content = id ? document.getElementById(id) : null;
            return !content || getComputedStyle(content).display === 'none';
          },
          contentId,
          { timeout: 10_000 }
        );
        await expect
          .poll(() => trigger.evaluate((element) => document.activeElement === element), {
            timeout: 10_000,
          })
          .toBe(true);
      }
    } finally {
      await persistReadinessDiagnostic(page, 'case-finally', 'observed');
      await context.close();
    }
  }, 180_000);
});
