// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
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

const SOURCE_ROUTE = '/zh-cn/start-here/quick-start/';
const INSTALL_ROUTE = '/zh-cn/ui-libraries/shadcn/button/';
let browser: Browser;
let baseUrl: string;
let sourceBinding: CopySourceBinding;
const directory = join(
  process.env.RUNNER_TEMP || tmpdir(),
  'homepage-evidence',
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
        try {
          await page.goto(`${baseUrl}${SOURCE_ROUTE}`, { waitUntil: 'domcontentloaded' });
          await selectFixtureFamily(page, family);
          const terminal = page.locator('.expressive-code .frame.is-terminal').first();
          const plain = page.locator('.expressive-code .frame:not(.is-terminal)').first();
          const example = page.locator('[data-code-example]').first();
          const sourceNodes = await example.locator('pre').elementHandles();
          for (const root of [terminal, plain, example]) await ready(root, runtime, family);
          let previousBackground = '';
          for (const theme of ['light', 'dark']) {
            await page.evaluate((theme) => (document.documentElement.dataset.theme = theme), theme);
            await page.waitForFunction(() =>
              [...document.querySelectorAll<HTMLElement>('[data-code-surface-view="ready"]')].every(
                (root) => root.querySelector('.site-code-surface-paint')
              )
            );
            if (previousBackground) {
              await page.waitForFunction(
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
            expect(await example.locator('[data-code-toolbar]:visible').count()).toBe(2);
            expect(
              await example
                .locator('[data-code-host-tabs] [role="tab"]')
                .first()
                .evaluate((tab) => tab.getBoundingClientRect().height)
            ).toBeGreaterThanOrEqual(44);
            expect(
              await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
            ).toBeLessThanOrEqual(1);
            await evidence(page, terminal, `${runtime}-${family}-${theme}-terminal`, {
              familyInputFixture: true,
              facts,
              row,
            });
          }
          // Existing native tabs keep roving focus and source identity. This is
          // compatibility evidence, not a claim that they are already PUI Tabs.
          const hosts = example.locator('[data-code-host-tabs] [role="tab"]');
          await hosts.first().focus();
          await page.keyboard.press('End');
          expect(await hosts.last().getAttribute('aria-selected')).toBe('true');
          expect(await hosts.last().evaluate((tab) => document.activeElement === tab)).toBe(true);
          const files = example.locator(
            '[data-code-host-panel]:visible [data-code-file-tabs] [role="tab"]'
          );
          await files.first().focus();
          await page.keyboard.press('End');
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
          await settled(example, runtime, 'shadcn', 'route-reset', family);
          expect((await appearance(example)).surfaceCount).toBe(1);
          for (const node of sourceNodes)
            expect(await node.evaluate((node) => node.isConnected)).toBe(true);
          await selectFixtureFamily(page, family);
          await settled(example, runtime, family, 'fixture-restore', family);
          expect((await appearance(example)).surfaceCount).toBe(1);
          await page.setViewportSize({ width: 320, height: 1000 });
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
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
