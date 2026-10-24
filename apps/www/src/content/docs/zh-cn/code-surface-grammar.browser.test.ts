// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Browser, Locator, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser, startServer, stopServer } from './browser-harness';
import { copySourceBindingIssues, type CopySourceBinding } from './copy-command-evidence';
import {
  codeSurfaceOwnershipIssues,
  codeSurfaceSettled,
  type CodeSurfaceGenerationFacts,
} from './code-surface-evidence';

import { textFragmentsShareLine } from './code-text-line-evidence';
import { hasZeroTransparentTreeShadow } from './code-tree-shadow-evidence';

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
beforeAll(async () => {
  sourceBinding = {
    exactSHA: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()),
    expectedSHA: process.env.CANDIDATE_SHA ?? process.env.PROTO_UI_EXPECTED_REVISION ?? null,
    eventSHA: process.env.GITHUB_SHA ?? null,
  };
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'source-binding.json'), JSON.stringify(sourceBinding, null, 2));
  expect(copySourceBindingIssues(sourceBinding, Boolean(process.env.CI))).toEqual([]);
  baseUrl = await startServer(SOURCE_ROUTE);
  // A clean checkout has no generated fixture during test collection. The
  // normal docs server builds and runs the real CLI extractor before readiness.
  // Read that exact output only after startup; never use a committed fallback.
  cliInitOutput = JSON.parse(
    await readFile(new URL('../../../generated/cli-init.generated.json', import.meta.url), 'utf8')
  ) as CliInitFixture;
  browser = await launchBrowser();
}, 300_000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
});

async function ready(root: Locator, runtime: string, family: string) {
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
  await root.scrollIntoViewIfNeeded();
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
  await page.screenshot({ path: join(directory, `${name}.png`) });
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
      it(`${runtime}/${family}: real source frames, 44px toolbar and responsive native CodeExample`, async () => {
        const context = await browser.newContext({ viewport: { width: 390, height: 1000 } });
        await context.addInitScript(
          (runtime) => localStorage.setItem('preferred-prototypes-adapter', runtime),
          runtime
        );
        const page = await context.newPage();
        const ecPage = await context.newPage();
        try {
          await ecPage.goto(`${baseUrl}${EC_ROUTE}`, { waitUntil: 'domcontentloaded' });
          await selectFixtureFamily(ecPage, family);
          await page.goto(`${baseUrl}${SOURCE_ROUTE}`, { waitUntil: 'domcontentloaded' });
          await selectFixtureFamily(page, family);
          const terminal = ecPage.locator('.expressive-code .frame.is-terminal').first();
          const plain = ecPage.locator('.expressive-code .frame:not(.is-terminal)').first();
          const example = page.locator('[data-code-example]').first();
          // Content selection is independent from the surface/Copy renderer.
          await example.locator('[data-code-example-tablist="host"] [role="tab"]').filter({ hasText: /^React$/ }).click();
          const sourceNodes = await example.locator('pre').elementHandles();
          const exampleFrame = example.locator('[data-code-host-panel]:visible [data-code-file-browser]').first();
          for (const root of [terminal, plain, exampleFrame]) { await root.page().bringToFront(); await ready(root, runtime, family); }
          let previousBackground = '';
          for (const theme of ['light', 'dark']) {
            for (const surfacePage of [ecPage, page]) await surfacePage.evaluate((theme) => (document.documentElement.dataset.theme = theme), theme);
            for (const surfacePage of [ecPage, page]) await surfacePage.waitForFunction(() =>
              [...document.querySelectorAll<HTMLElement>('[data-code-surface-view="ready"]')].every(
                (root) => root.querySelector('.site-code-surface-paint')
              )
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
            expect(facts.border).toBe(family === 'brutalist' ? '2px' : '1px');
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
            expect(await example.locator('[data-code-shell][data-site-code-surface]').count()).toBe(
              0
            );
            expect(await example.locator('[data-code-example-tablist]:visible').count()).toBe(1);
            expect(await example.locator('[data-code-example-tree][role="tree"]:visible').count()).toBe(1);
            expect(
              await example
                .locator('[data-code-example-tablist="host"] [role="tab"]')
                .first()
                .evaluate((tab) => tab.getBoundingClientRect().height)
            ).toBeGreaterThanOrEqual(44);
            expect(
              Math.max(...await Promise.all([ecPage, page].map((surfacePage) => surfacePage.evaluate(() => document.documentElement.scrollWidth - innerWidth))))
            ).toBeLessThanOrEqual(1);
            await evidence(ecPage, terminal, `${runtime}-${family}-${theme}-terminal`, {
              familyInputFixture: true,
              facts,
              row,
            });
          }
          await page.bringToFront();
          // Existing native tabs keep roving focus and source identity. This is
          // compatibility evidence, not a claim that they are already PUI Tabs.
          const hosts = example.locator('[data-code-example-tablist="host"] [role="tab"]');
          await hosts.first().focus();
          await page.keyboard.press('End');
          expect(await hosts.last().getAttribute('aria-selected')).toBe('true');
          expect(await hosts.last().evaluate((tab) => document.activeElement === tab)).toBe(true);
          // The last known host can be a truthful WIP entry, with no Copy or
          // runnable file tabs. Return to a ready host for file navigation.
          await hosts.filter({ hasText: 'React' }).click();
          const files = example.locator(
            '[data-code-host-panel]:visible [data-code-example-tree] [role="treeitem"]'
          );
          await files.first().focus();
          await page.keyboard.press('End');
          expect(await files.last().evaluate((node) => node === document.activeElement)).toBe(true);
          await page.keyboard.press('Enter');
          expect(await files.last().getAttribute('aria-selected')).toBe('true');
          for (const node of sourceNodes)
            expect(await node.evaluate((node) => node.isConnected)).toBe(true);
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
          for (const surfacePage of [ecPage, page]) await surfacePage.setViewportSize({ width: 320, height: 1000 });
          expect(
            Math.max(...await Promise.all([ecPage, page].map((surfacePage) => surfacePage.evaluate(() => document.documentElement.scrollWidth - innerWidth))))
          ).toBeLessThanOrEqual(1);
          await evidence(page, example, `${runtime}-${family}-320-tabs`, {
            familyInputFixture: true,
            sourceNodesRetained: true,
          });
        } finally {
          await context.close();
        }
      }, 120_000);
    }
  }
  it('keeps the installation toolbar thin without reducing its manager target', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 1000 } });
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}${INSTALL_ROUTE}`, { waitUntil: 'domcontentloaded' });
      const root = page.locator('[data-install-command-card]:visible').first();
      await ready(root, 'wc', 'shadcn');
      await root.locator('[data-copy-view="ready"] [data-demo-ref="copy-button"]').waitFor();
      const facts = await root.evaluate((root) => {
        const row = root.querySelector<HTMLElement>('[data-code-toolbar]')!,
          manager = row.querySelector<HTMLElement>('[data-manager-tab]')!,
          copy = row.querySelector<HTMLElement>('[data-demo-ref="copy-button"]')!;
        const rowRect = row.getBoundingClientRect(),
          managerRect = manager.getBoundingClientRect(),
          copyRect = copy.getBoundingClientRect();
        return {
          row: rowRect.height,
          manager: managerRect.height,
          centerDelta: Math.abs(
            managerRect.y + managerRect.height / 2 - copyRect.y - copyRect.height / 2
          ),
          source: root.querySelector('[data-command]')!.textContent,
          scroll: getComputedStyle(root.querySelector('pre')!).overflowX,
        };
      });
      expect(facts.row).toBeGreaterThanOrEqual(44);
      expect(facts.row).toBeLessThanOrEqual(46);
      expect(facts.manager).toBeGreaterThanOrEqual(44);
      expect(facts.centerDelta).toBeLessThanOrEqual(1);
      expect(facts.source?.startsWith('npx ')).toBe(true);
      expect(facts.scroll).toBe('auto');
      await evidence(page, root, '390-install-toolbar', facts);
    } finally {
      await context.close();
    }
  }, 90_000);
});


// This is the CodeExample legacy WC chrome only, not a page-runtime migration.
describe.sequential('CodeExample host coverage and upstream visual hierarchy', () => {
  for (const locale of ['en', 'zh-cn']) {
    for (const width of [320, 390, 1440]) {
      for (const theme of ['light', 'dark']) {
        it(`${locale}/${width}/${theme}: known hosts remain selectable and WIP never invents code`, async () => {
          const context = await browser.newContext({ viewport: { width, height: 1000 } });
          const page = await context.newPage();
          try {
            await page.goto(`${baseUrl}/${locale}/start-here/quick-start/`, { waitUntil: 'domcontentloaded' });
            await page.evaluate((theme) => (document.documentElement.dataset.theme = theme), theme);
            const example = page.locator('[data-code-example]').first();
            const hosts = example.locator('[data-code-example-tablist="host"] [role="tab"]');
            await hosts.last().waitFor();
            // Preserve an actual source-bound diagnostic even when a later
            // semantic assertion fails; this is not acceptance evidence.
            await evidence(page, example, `code-example-${locale}-${width}-${theme}-before-assertions`, {
              stage: 'before-assertions', chromeRuntime: 'wc', acceptance: false,
            });
            const hostNames = ['Web Components', 'React', 'Vue', 'Vue 2', 'GPUI', 'Qt', 'Flutter'];
            const pendingLabel = locale === 'en' ? 'WIP' : '开发中';
            expect(await hosts.evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.codeHostName))).toEqual(hostNames);
            expect(await hosts.allTextContents()).toEqual(hostNames.map((name, index) => index < 3 ? name : `${name} · ${pendingLabel}`));
            expect(await hosts.locator('[data-code-host-status]').count()).toBe(4);
            if (width <= 390) {
              const hint = example.locator('[data-code-host-overflow]');
              expect(await hint.isVisible()).toBe(true);
              expect(await hint.evaluate((node) => node.previousElementSibling?.getAttribute('data-code-example-tablist'))).toBe('host');
            }
            const sourceNodes = await example.locator('pre').elementHandles();
            for (const host of ['Web Components', 'React', 'Vue', 'Vue 2', 'GPUI', 'Qt', 'Flutter']) {
              // Match the complete accessible name, including availability.
              await example.getByRole('tab', { name: hostNames.indexOf(host) < 3 ? host : `${host} · ${pendingLabel}`, exact: true }).click();
              const panel = example.locator('[data-code-host-panel]:visible');
              expect(await panel.count()).toBe(1);
              if (['Vue 2', 'GPUI', 'Qt', 'Flutter'].includes(host)) {
                expect(await panel.locator('[data-code-example-wip]').count()).toBe(1);
                expect(await panel.locator('pre, [data-site-copy], [data-code-file-tabs]').count()).toBe(0);
                expect(await panel.textContent()).toContain('WIP');
              } else {
                expect(await panel.locator('[data-code-example-tree]').count()).toBe(1);
                expect(await panel.locator('[data-code-example-command] pre').textContent()).toContain('npx @proto.ui/cli@latest');
                expect(await panel.locator('[data-code-example-command] [role="tab"], [data-code-example-command] [role="tabpanel"]').count()).toBe(0);
                expect(await panel.locator('[data-code-example-tree]').textContent()).not.toContain('install.sh');
                expect(await panel.locator('[data-code-example-command] [data-code-example-tree]').count()).toBe(0);
                expect(await panel.locator('[data-code-file-browser] [data-code-example-command]').count()).toBe(0);
                const tree = panel.locator('[data-code-example-tree]');
                const embedded = await tree.evaluate((node) => {
                  const root = getComputedStyle(node);
                  const row = node.querySelector<HTMLElement>('[data-code-tree-kind="folder"]')!;
                  const item = getComputedStyle(row);
                  const icon = row.querySelector<HTMLElement>('[data-code-tree-icon]')!;
                  return {
                    display: root.display, gap: root.rowGap, border: root.borderWidth,
                    shadow: root.boxShadow, background: root.backgroundColor,
                    rowHeight: row.getBoundingClientRect().height, radius: item.borderRadius,
                    font: item.fontSize, icon: icon.getBoundingClientRect().width,
                  };
                });
                expect(hasZeroTransparentTreeShadow(embedded.shadow)).toBe(true);
                const { shadow: _shadow, ...geometry } = embedded;
                expect(geometry).toEqual({
                  display: 'flex', gap: '6px', border: '0px',
                  background: 'rgba(0, 0, 0, 0)', rowHeight: 32, radius: '0px', font: '14px', icon: 16,
                });
                expect(await tree.locator('[data-code-tree-icon="folder"]').count()).toBeGreaterThan(0);
                expect(await tree.locator('[data-code-tree-icon="file-code"]').count()).toBeGreaterThan(0);
                const folder = tree.locator('[data-code-tree-kind="folder"]').first();
                const firstChild = tree.locator('[data-code-tree-kind="file"]').first();
                const folderBounds = await folder.boundingBox();
                const childBounds = await firstChild.boundingBox();
                if (await firstChild.getAttribute('aria-level') === '2')
                  expect(childBounds!.y - folderBounds!.y).toBe(32);
                const initialSource = await panel.locator('[data-code-file-panel]:visible pre').textContent();
                await folder.click();
                expect(await folder.getAttribute('aria-expanded')).toBe('false');
                expect(await panel.locator('[data-code-file-panel]:visible pre').textContent()).toBe(initialSource);
                await folder.focus();
                await page.keyboard.press('ArrowRight');
                expect(await folder.getAttribute('aria-expanded')).toBe('true');
                await page.keyboard.press('ArrowRight');
                expect(await tree.locator('[data-code-tree-kind="file"]').first().evaluate((node) => node === document.activeElement)).toBe(true);
                const treeBounds = await tree.boundingBox();
                const sourceBounds = await panel.locator('[data-code-file-source]').boundingBox();
                if (width >= 1440) expect(treeBounds!.x + treeBounds!.width).toBeLessThanOrEqual(sourceBounds!.x + 1);
                else expect(treeBounds!.y + treeBounds!.height).toBeLessThanOrEqual(sourceBounds!.y + 1);
                expect(await panel.locator('[data-code-file-panel]:visible pre').textContent()).toContain('proto-ui/components/');
                await panel.locator('[data-code-example-tree] [data-code-tree-kind="file"]').last().click();
                if (host === 'Web Components') {
                  expect(await panel.locator('[data-code-file-panel]:visible pre').textContent()).toContain('<proto-ui-shadcn-button');
                  expect(await panel.locator('[data-code-file-panel]:visible pre').textContent()).toContain('type="module"');
                }
                expect(await panel.textContent()).not.toContain('document.body.innerHTML');
                expect(await panel.locator('[data-code-toggle]').count()).toBe(0);
                expect(await panel.locator('[data-code-example-guidance]').count()).toBe(host === 'Web Components' ? 1 : 0);
                const shells = panel.locator('[data-code-shell]:visible');
                for (const shell of await shells.all()) {
                  expect(await shell.getAttribute('data-code-expanded')).toBe('true');
                  const copy = shell.locator('[data-copy-view="ready"] [data-demo-ref="copy-button"]');
                  await copy.waitFor();
                  const source = shell.locator('pre');
                  const sourceBox = await source.boundingBox();
                  const copyBox = await copy.boundingBox();
                  expect(sourceBox).not.toBeNull();
                  expect(copyBox).not.toBeNull();
                  const fileHeader = shell.locator('[data-code-file-header]');
                  if (await fileHeader.count()) {
                    const headerBox = await fileHeader.boundingBox();
                    expect(headerBox!.height).toBe(48);
                    expect(copyBox!.y).toBeGreaterThanOrEqual(headerBox!.y);
                    expect(copyBox!.y + copyBox!.height).toBeLessThanOrEqual(headerBox!.y + headerBox!.height);
                    expect(sourceBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height);
                    expect(await source.evaluate((pre) => ({ font: getComputedStyle(pre).fontSize, line: getComputedStyle(pre).lineHeight })))
                      .toEqual({ font: '14px', line: '21px' });
                    const line = source.locator('.line').first();
                    expect(await line.evaluate((line) => line.getBoundingClientRect().height)).toBe(23);
                  } else expect(sourceBox!.x + sourceBox!.width).toBeLessThanOrEqual(copyBox!.x + 1);
                  expect(await source.evaluate((pre) => getComputedStyle(pre).maxHeight)).toBe('none');
                  const expectedTarget = await shell.evaluate((shell) => shell.closest('[data-code-example-command]')
                    ? (shell.closest('[data-code-example-command]')!.getAttribute('aria-label'))
                    : shell.querySelector('code') && shell.getAttribute('data-code-file-index'));
                  const copyLabel = await shell.locator('[data-site-copy]').getAttribute('data-copy-label');
                  expect(copyLabel?.startsWith(locale === 'en' ? 'Copy ' : '复制 ')).toBe(true);
                  if (expectedTarget === 'Terminal' || expectedTarget === '终端') expect(copyLabel).toBe(`${locale === 'en' ? 'Copy' : '复制'} ${expectedTarget}`);
                  else {
                    const expectedPath = host === 'React' ? 'src/App.tsx' : host === 'Vue' ? 'src/App.vue' : 'index.html';
                    expect(copyLabel).toContain(expectedPath);
                    expect(await shell.locator('[data-code-file-title]').textContent()).toBe(expectedPath);
                    expect(await tree.locator(`[data-code-tree-path="${expectedPath}"]`).getAttribute('aria-selected')).toBe('true');
                  }
                }
              }
              expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
              await evidence(page, example, `code-example-${locale}-${width}-${theme}-${host.replaceAll(' ', '-')}`, {
                chromeRuntime: 'wc', contentHost: host, stableVersion: '0.2.0',
              });
            }
            await hosts.first().focus();
            await page.keyboard.press('End');
            expect(await hosts.last().getAttribute('aria-selected')).toBe('true');
            expect(await hosts.last().evaluate((node) => node === document.activeElement)).toBe(true);
            const lastBounds = await hosts.last().boundingBox();
            const listBounds = await example.locator('[data-code-example-tablist="host"]').boundingBox();
            expect(lastBounds!.x).toBeGreaterThanOrEqual(listBounds!.x - 1);
            expect(lastBounds!.x + lastBounds!.width).toBeLessThanOrEqual(listBounds!.x + listBounds!.width + 1);
            for (const node of sourceNodes) expect(await node.evaluate((node) => node.isConnected)).toBe(true);
          } finally {
            await context.close();
          }
        }, 120_000);
      }
    }
  }
});


it('keeps every authored source reachable without JavaScript and does not fake an interactive tree', async () => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 1000 } });
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/en/start-here/quick-start/`);
    const example = page.locator('[data-code-example]');
    expect(await example.locator('[role="tree"], [role="treeitem"]').count()).toBe(0);
    expect(await example.locator('[data-code-host-panel]:visible').count()).toBe(7);
    const generated = page.locator('[data-cli-generated-files]');
    expect(await generated.locator('[role="tree"], [role="treeitem"]').count()).toBe(0);
    expect(await generated.locator('[data-code-file-panel]:visible').count()).toBe(4);
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
    expect(await generated.locator('[data-code-directory-path]').count()).toBe(6);
    expect(await example.locator('[data-code-file-panel]:visible').count()).toBe(4);
    const htmlLink = example.locator('[data-code-file-tabs] a').filter({ hasText: /^index.html$/ });
    await htmlLink.click();
    expect(await example.locator('[data-code-host="wc"] [data-code-file-panel]:visible').count()).toBe(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  } finally { await context.close(); }
}, 90_000);

it('keeps embedded file navigation identifiable in forced colors and enlarged text', async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 1000 }, forcedColors: 'active' });
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/en/start-here/quick-start/`);
    const example = page.locator('[data-code-example]');
    await example.getByRole('tab', { name: 'React', exact: true }).click();
    const tree = example.locator('[data-code-host-panel]:visible [data-code-example-tree]');
    const folder = tree.locator('[data-code-tree-kind="folder"]');
    const file = tree.locator('[data-code-tree-kind="file"]');
    await folder.focus();
    await page.keyboard.press('ArrowRight');
    expect(await file.evaluate((node) => node === document.activeElement)).toBe(true);
    expect(await file.getAttribute('aria-selected')).toBe('true');
    expect(await file.evaluate((node) => getComputedStyle(node).fontWeight)).toBe('500');
    const focus = await file.evaluate((node) => ({
      visible: node.hasAttribute('data-focus-visible'),
      width: parseFloat(getComputedStyle(node).outlineWidth),
      style: getComputedStyle(node).outlineStyle,
    }));
    expect(focus.visible).toBe(true);
    expect(focus.width).toBeGreaterThanOrEqual(2);
    expect(focus.style).not.toBe('none');
    await page.keyboard.press('ArrowLeft');
    expect(await folder.evaluate((node) => node === document.activeElement)).toBe(true);
    expect(await file.getAttribute('aria-selected')).toBe('true');
    expect(await file.evaluate((node) => getComputedStyle(node).fontWeight)).toBe('500');
    expect(await folder.evaluate((node) => getComputedStyle(node).fontWeight)).toBe('400');
    await evidence(page, example, 'code-example-embedded-forced-colors', { forcedColors: true, contentHost: 'react' });
    // Text scaling, not a claim of browser-zoom or assistive-technology acceptance.
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    expect(await file.evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBe(28);
    expect(await file.evaluate((node) => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(64);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await evidence(page, example, 'code-example-embedded-forced-colors-text200', { forcedColors: true, textScalePercent: 200, browserZoomVerified: false });
  } finally { await context.close(); }
}, 90_000);

for (const locale of ['en', 'zh-cn']) {
  it(`browses real build-generated init files with exact copy payloads and genuine Tree ownership (${locale})`, async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 1000 } });
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
      await page.goto(`${baseUrl}/${locale}/start-here/quick-start/`);
      expect(await page.locator('.expressive-code').count()).toBe(0);
      for (const [id, command] of [
        ['quick-start-cli-help', 'npx @proto.ui/cli@latest --help'],
        ['quick-start-init-command', 'npx @proto.ui/cli@latest init'],
      ]) {
        const terminal = page.locator(`#${id}`);
        expect(await terminal.getAttribute('data-code-presentation')).toBe('docs');
        expect(await terminal.getAttribute('data-code-line-numbers')).toBe('false');
        expect(await terminal.locator('code').getAttribute('data-raw-code')).toBe(command);
        expect(await terminal.locator('.line').first().evaluate((node) => getComputedStyle(node, '::before').display)).toBe('none');
        expect(await terminal.locator('pre').evaluate((node) => node.scrollWidth - node.clientWidth)).toBe(0);
        const copy = terminal.locator('[data-copy-view="ready"] [data-demo-ref="copy-button"]');
        await copy.click();
        expect(await page.evaluate(() => (window as Window & { __initCopy?: string }).__initCopy)).toBe(command);
        expect(await copy.evaluate((node) => [node.getBoundingClientRect().width, node.getBoundingClientRect().height])).toEqual([28, 28]);
      }
      const output = page.locator('[data-cli-init-output]');
      expect(await output.getAttribute('data-cli-version')).toBe(cliInitOutput.cli.version);
      const browserPanel = output.locator('[data-standalone-file-browser][data-file-browser-init="1"]');
      await browserPanel.waitFor();
      const tree = browserPanel.locator('[role="tree"]');
      const nodes = tree.locator('[role="treeitem"]');
      expect((await nodes.evaluateAll((items) => items.map((item) => item.getAttribute('data-code-tree-path')))).sort()).toEqual(cliInitOutput.entries.map((entry) => entry.path).sort());
      expect(await tree.locator('[data-code-tree-kind="folder"]').count()).toBe(6);
      expect(await tree.locator('[data-code-tree-kind="file"]').count()).toBe(4);
      expect(await output.locator('[data-cli-generated-files] details').count()).toBe(0);
      expect(await tree.locator('[aria-selected="true"]').getAttribute('data-code-tree-path')).toBe('proto-ui/config.json');
      const sources = browserPanel.locator('[data-code-file-panel]');
      expect(await sources.count()).toBe(4);
      for (const path of ['proto-ui/components', 'proto-ui/prototypes', 'src/styles/proto-ui-tokens.generated.css']) {
        const item = tree.locator(`[data-code-tree-path="${path}"]`);
        const label = item.locator('[data-code-tree-label]');
        expect(await label.textContent()).toBe(path.split('/').at(-1));
        expect(await label.getAttribute('title')).toBe(path);
        expect(await label.evaluate((node) => ({ whiteSpace: getComputedStyle(node).whiteSpace, overflow: getComputedStyle(node).overflow, ellipsis: getComputedStyle(node).textOverflow }))).toEqual({ whiteSpace: 'nowrap', overflow: 'hidden', ellipsis: 'ellipsis' });
        expect(await item.evaluate((node) => node.getBoundingClientRect().height)).toBe(32);
      }

      const initialSources = await sources.elementHandles();
      const visible = () => browserPanel.locator('[data-code-file-panel]:visible');
      expect(await visible().count()).toBe(1);
      for (const path of ['proto-ui/adapters', 'proto-ui/components', 'proto-ui/prototypes']) {
        const empty = tree.locator(`[data-code-tree-path="${path}"]`);
        expect(await empty.getAttribute('data-code-tree-kind')).toBe('folder');
        expect(await empty.getAttribute('aria-controls')).toBeNull();
        expect(await empty.locator('[data-code-tree-chevron]').count()).toBe(0);
        await empty.click(); await empty.press('Enter');
        expect(await tree.locator('[aria-selected="true"]').getAttribute('data-code-tree-path')).toBe('proto-ui/config.json');
        expect(await visible().locator('[data-code-file-title]').textContent()).toBe('proto-ui/config.json');
      }
      const folder = tree.locator('[data-code-tree-path="proto-ui"]');
      await folder.click();
      expect(await folder.getAttribute('aria-expanded')).toBe('false');
      expect(await tree.locator('[data-code-tree-path="proto-ui/config.json"]').isVisible()).toBe(false);
      expect(await visible().locator('[data-code-file-title]').textContent()).toBe('proto-ui/config.json');
      await folder.press('ArrowRight');
      expect(await folder.getAttribute('aria-expanded')).toBe('true');
      await folder.press('End');
      expect(await tree.locator('[data-code-tree-path="src/styles/shadcn-theme.css"]').evaluate((node) => node === document.activeElement)).toBe(true);
      await page.keyboard.press('Enter');
      expect(await visible().locator('[data-code-file-title]').textContent()).toBe('src/styles/shadcn-theme.css');
      const files = cliInitOutput.entries.filter((entry) => entry.kind === 'file');
      for (const file of files) {
        const item = tree.locator(`[data-code-tree-path="${file.path}"]`);
        await item.click();
        expect(await item.getAttribute('aria-selected')).toBe('true');
        expect(await tree.locator('[aria-selected="true"]').count()).toBe(1);
        const panel = visible();
        expect(await panel.count()).toBe(1);
        expect(await panel.locator('[data-code-file-title]').textContent()).toBe(file.path);
        expect(await panel.getAttribute('aria-labelledby')).toBe(await item.getAttribute('id'));
        expect(await panel.locator('code').getAttribute('data-raw-code')).toBe(file.content);
        expect(await panel.getAttribute('data-code-line-numbers')).toBe('true');
        expect(await panel.locator('.line').first().evaluate((node) => getComputedStyle(node, '::before').display)).toBe('inline-block');
        const copy = panel.locator('[data-copy-view="ready"] [data-demo-ref="copy-button"]');
        await copy.click();
        expect(await page.evaluate(() => (window as Window & { __initCopy?: string }).__initCopy)).toBe(file.content);
        expect(await copy.evaluate((node) => [node.getBoundingClientRect().width, node.getBoundingClientRect().height])).toEqual([28, 28]);
        expect(await panel.locator('[data-demo-ref="copy-backplate"]').count()).toBe(0);
        expect(await panel.locator('[data-code-file-header]').evaluate((node) => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(48);
      }
      for (const node of initialSources) expect(await node.evaluate((node) => node.isConnected)).toBe(true);
      const activeSource = visible();
      expect(await activeSource.locator('pre').evaluate((node) => ({ fontSize: getComputedStyle(node).fontSize, lineHeight: getComputedStyle(node).lineHeight }))).toEqual({ fontSize: '14px', lineHeight: '21px' });
      const sourceScroll = await activeSource.locator('pre').evaluate((node) => { node.scrollLeft = node.scrollWidth; return { left: node.scrollLeft, maximum: node.scrollWidth - node.clientWidth }; });
      expect(sourceScroll.maximum).toBeGreaterThan(0);
      expect(Math.abs(sourceScroll.left - sourceScroll.maximum)).toBeLessThanOrEqual(1);
      await evidence(page, browserPanel, `cli-init-${locale}-390-source-scroll-end`, { selectedPath: 'src/styles/shadcn-theme.css', sourceScroll });
      const geometry = await browserPanel.evaluate((node) => { const files = node.querySelector('[data-code-files]')!.getBoundingClientRect(); const source = node.querySelector('[data-code-file-source]')!.getBoundingClientRect(); return { filesBottom: files.bottom, sourceTop: source.top }; });
      expect(geometry.filesBottom).toBeLessThanOrEqual(geometry.sourceTop + 1);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
      ).toBeLessThanOrEqual(1);
      await evidence(page, output, `cli-init-${locale}-390`, {
        cliVersion: cliInitOutput.cli.version,
        sourceTreeHash: cliInitOutput.cli.sourceTreeHash,
        files: files.map((file) => ({ path: file.path, sha256: file.sha256 })),
      });
    } finally {
      await context.close();
    }
  }, 90_000);
}

it('keeps the generated-file browser accessible in forced colors and enlarged text', async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 1000 }, forcedColors: 'active' });
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/en/start-here/quick-start/`);
    const generated = page.locator('[data-cli-generated-files] [data-file-browser-init="1"]');
    await generated.waitFor();
    const file = generated.locator('[data-code-tree-path="proto-ui/config.json"]');
    const folder = generated.locator('[data-code-tree-path="proto-ui"]');
    await file.focus();
    expect(await file.evaluate((node) => node === document.activeElement)).toBe(true);
    expect(await file.evaluate((node) => getComputedStyle(node).outlineStyle)).not.toBe('none');
    await folder.focus();
    expect(await file.getAttribute('aria-selected')).toBe('true');
    expect(await file.evaluate((node) => getComputedStyle(node).fontWeight)).toBe('500');
    expect(await folder.evaluate((node) => getComputedStyle(node).fontWeight)).toBe('400');
    await evidence(page, generated, 'cli-init-forced-colors', { selectedPath: 'proto-ui/config.json', forcedColors: true });
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    expect(await file.evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBe(28);
    const enlargedLabels = await generated.locator('[data-code-tree-label]').evaluateAll((labels) => labels.map((label) => {
      const rect = (value: DOMRect) => ({ x: value.x, y: value.y, top: value.top, bottom: value.bottom, left: value.left, right: value.right, width: value.width, height: value.height });
      const range = document.createRange();
      range.selectNodeContents(label);
      const item = label.closest('[data-code-tree-path]');
      const style = getComputedStyle(label);
      return {
        path: item?.getAttribute('data-code-tree-path'), text: label.textContent, title: label.getAttribute('title'),
        rects: [...range.getClientRects()].map(rect), labelBounds: rect(label.getBoundingClientRect()),
        itemBounds: item ? rect(item.getBoundingClientRect()) : null,
        style: { whiteSpace: style.whiteSpace, overflow: style.overflow, textOverflow: style.textOverflow, fontSize: style.fontSize, lineHeight: style.lineHeight, writingMode: style.writingMode, minWidth: style.minWidth },
        measurementScroll: { x: scrollX, y: scrollY },
      };
    }));
    // Preserve the actual failing geometry and pixels before deciding whether
    // multiple Range fragments are separate lines or same-line ellipsis paint.
    await evidence(page, generated, 'cli-init-forced-colors-text200', {
      selectedPath: 'proto-ui/config.json', forcedColors: true, textScalePercent: 200,
      browserZoomVerified: false, stage: 'before-single-line-assertion', enlargedLabels,
    });
    expect(enlargedLabels).toHaveLength(10);
    expect(enlargedLabels.map((label) => textFragmentsShareLine(label.rects))).toEqual(Array(10).fill(true));
    for (const label of enlargedLabels) {
      expect(label.labelBounds.width).toBeGreaterThan(0);
      if (label.style.minWidth === 'max-content') {
        expect(label.labelBounds.width + 1).toBeGreaterThanOrEqual(Math.max(...label.rects.map((rect) => rect.width)));
      } else {
        expect(Number.isFinite(parseFloat(label.style.minWidth))).toBe(true);
        expect(label.labelBounds.width + 1).toBeGreaterThanOrEqual(parseFloat(label.style.minWidth));
      }
    }
    const treeScroll = generated.locator('[data-code-tree-scroll]');
    const treePan = await treeScroll.evaluate((node) => { node.scrollLeft = node.scrollWidth; return { left: node.scrollLeft, maximum: node.scrollWidth - node.clientWidth }; });
    expect(treePan.maximum).toBeGreaterThan(0);
    expect(Math.abs(treePan.left - treePan.maximum)).toBeLessThanOrEqual(1);
    const emptyDirectory = generated.locator('[data-code-tree-path="proto-ui/adapters"]');
    await emptyDirectory.focus();
    const focusedDirectory = await emptyDirectory.evaluate((node) => {
      const label = node.querySelector('[data-code-tree-label]')!; const range = document.createRange(); range.selectNodeContents(label);
      const text = range.getBoundingClientRect(); const port = node.closest('[data-code-tree-scroll]')!; const bounds = port.getBoundingClientRect();
      return { text: label.textContent, textLeft: text.left, textRight: text.right, portLeft: bounds.left, portRight: bounds.left + port.clientWidth, description: document.getElementById(node.getAttribute('aria-describedby')!)?.textContent };
    });
    expect(focusedDirectory.text).toBe('adapters');
    expect(focusedDirectory.description).toContain('empty');
    expect(focusedDirectory.textLeft).toBeGreaterThanOrEqual(focusedDirectory.portLeft - 1);
    expect(focusedDirectory.textRight).toBeLessThanOrEqual(focusedDirectory.portRight + 1);
    await evidence(page, emptyDirectory, 'cli-init-forced-colors-text200-directories', { textScalePercent: 200, browserZoomVerified: false, focusedDirectory });
    const path = generated.locator('[data-code-file-panel]:visible [data-code-title-scroll]');
    await path.focus();
    expect(await path.evaluate((node) => node === document.activeElement)).toBe(true);
    const caption = await path.evaluate((node) => {
      const header = node.closest('[data-code-file-header]')!;
      const copy = header.querySelector('[data-copy]')!;
      const rect = node.getBoundingClientRect(); const copyRect = copy.getBoundingClientRect(); const headerRect = header.getBoundingClientRect();
      node.scrollLeft = node.scrollWidth;
      return { text: node.textContent, whiteSpace: getComputedStyle(node).whiteSpace, left: node.scrollLeft, maximum: node.scrollWidth - node.clientWidth, pathRight: rect.right, copyLeft: copyRect.left, copyRight: copyRect.right, headerRight: headerRect.right, clientHeight: node.clientHeight, lineHeight: parseFloat(getComputedStyle(node).lineHeight) };
    });
    expect(caption.text).toBe('proto-ui/config.json');
    expect(caption.whiteSpace).toBe('nowrap');
    expect(caption.clientHeight).toBeLessThanOrEqual(caption.lineHeight + 1); // excludes the native scrollbar
    expect(caption.maximum).toBeGreaterThan(0);
    expect(Math.abs(caption.left - caption.maximum)).toBeLessThanOrEqual(1);
    expect(caption.pathRight).toBeLessThanOrEqual(caption.copyLeft + 1);
    expect(caption.copyRight).toBeLessThanOrEqual(caption.headerRight + 1);
    await evidence(page, generated, 'cli-init-forced-colors-text200-scroll-end', { selectedPath: 'proto-ui/config.json', forcedColors: true, textScalePercent: 200, browserZoomVerified: false, treePan, caption });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    expect(await generated.locator('[data-code-file-panel]:visible code').getAttribute('data-raw-code')).toBe(cliInitOutput.entries.find((entry) => entry.path === 'proto-ui/config.json')?.content);
  } finally { await context.close(); }
}, 90_000);
