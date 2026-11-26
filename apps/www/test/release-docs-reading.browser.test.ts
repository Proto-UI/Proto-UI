// @vitest-environment node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Browser, BrowserContext, BrowserContextOptions, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  choosePreviewRuntime,
  launchBrowser,
  RUNTIMES,
  startServer,
  stopServer,
} from '../src/content/docs/zh-cn/browser-harness';
import { baseButtonFiles } from '../src/content/docs/demo_components/button/baseButtonCode';
import {
  copySourceBindingIssues,
  type CopySourceBinding,
} from '../src/content/docs/zh-cn/copy-command-evidence';

// Current-source regression cells for #1042/#1175. These are real public
// documentation routes, not the missing historical Camoufox matrix or an
// installed application. Screen-reader, physical-device and registry-install
// acceptance remain separate evidence domains.
const locales = ['en', 'zh-cn'] as const;
const profiles = [
  { id: '320-light', width: 320, colorScheme: 'light' },
  { id: '390-dark', width: 390, colorScheme: 'dark' },
  { id: '1280-light', width: 1280, colorScheme: 'light' },
] as const;
const hostNames = { wc: 'Web Components', react: 'React', vue: 'Vue', vue2: 'Vue 2' };
const routeFor = (locale: string, family: 'button' | 'dialog') =>
  `/${locale}/ui-libraries/${family === 'button' ? 'base/button' : 'shadcn/dialog'}/`;
const ids = locales.flatMap((locale) => [
  ...profiles.flatMap((profile) =>
    (['button', 'dialog'] as const).map((family) => `${locale}-nojs-${profile.id}-${family}`)
  ),
  ...RUNTIMES.map((runtime) => `${locale}-source-${runtime}`),
  `${locale}-keyboard-navigation`,
  `${locale}-astro-owner-probe`,
]);
type Receipt = {
  id: string;
  status: 'not-run' | 'running' | 'passed' | 'failed' | 'blocked';
  facts: Record<string, unknown>;
  error?: string;
  pageErrors?: string[];
  screenshots?: string[];
};
const receipts = new Map<string, Receipt>(
  ids.map((id) => [id, { id, status: 'not-run', facts: {} }])
);
const output = path.join(
  process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR ?? tmpdir(),
  'release-docs-reading'
);
let browser: Browser;
let baseUrl: string;
let binding: CopySourceBinding;
let setupError: string | undefined;

async function persist() {
  await mkdir(output, { recursive: true });
  await writeFile(
    path.join(output, 'results.json'),
    JSON.stringify(
      {
        schemaVersion: 1,
        source: binding ?? null,
        browser: browser?.version() ?? null,
        baseUrl: baseUrl ?? null,
        server: process.env.PROTO_UI_BROWSER_BASE_URL
          ? 'Externally supplied server; checkout binding alone does not authenticate its served source.'
          : 'Source checkout served by the shared documentation harness.',
        scope: 'Current-source public documentation reading and owner regressions.',
        limitations: [
          'Viewport and CSS text enlargement are simulated; no physical mobile device or browser-zoom claim.',
          'No screen-reader/OS assistive-technology or clean registry installation acceptance.',
          'The explicit Astro owner probe dispatches lifecycle events; normal website navigation is a document navigation.',
          'Does not replace #1042 historical 518 routes/5784 cells or #1175 original Camoufox R5 matrix.',
          'Does not substitute for shenko, OpenGreendam or verdant application evidence.',
        ],
        setupError: setupError ?? null,
        cases: [...receipts.values()],
      },
      null,
      2
    ) + '\n'
  );
}

beforeAll(async () => {
  try {
    binding = {
      exactSHA: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()),
      expectedSHA: process.env.CANDIDATE_SHA ?? process.env.PROTO_UI_EXPECTED_REVISION ?? null,
      eventSHA: process.env.GITHUB_SHA ?? null,
    };
    await persist();
    expect(copySourceBindingIssues(binding, Boolean(process.env.CI))).toEqual([]);
    const files = [
      'apps/www/test/release-docs-reading.browser.test.ts',
      'apps/www/src/content/docs/zh-cn/browser-harness.ts',
      'apps/www/src/components/CodeExample.astro',
      'apps/www/src/components/InstallCommandCard.astro',
      'apps/www/src/components/install-command-card-client.ts',
      'apps/www/src/components/PrototypePreviewer/CodePanel.astro',
      'apps/www/src/components/PrototypePreviewer/code-panel-client.ts',
      'apps/www/src/styles/code-surfaces.css',
      'apps/www/src/content/docs/demo_components/button/baseButtonCode.ts',
      ...locales.flatMap((locale) => [
        `apps/www/src/content/docs/${locale}/ui-libraries/base/button.mdx`,
        `apps/www/src/content/docs/${locale}/ui-libraries/shadcn/button.mdx`,
        `apps/www/src/content/docs/${locale}/ui-libraries/shadcn/dialog.mdx`,
      ]),
    ];
    const sources = Object.fromEntries(
      await Promise.all(
        files.map(async (file) => [
          file,
          createHash('sha256')
            .update(await readFile(file))
            .digest('hex'),
        ])
      )
    );
    await writeFile(
      path.join(output, 'source.json'),
      JSON.stringify({ ...binding, sources }, null, 2)
    );
    baseUrl = await startServer(locales.map((locale) => routeFor(locale, 'button')));
    browser = await launchBrowser();
  } catch (error) {
    setupError = String(error);
    await persist();
    throw error;
  }
}, 300_000);

afterAll(async () => {
  try {
    await browser?.close();
  } finally {
    try {
      await stopServer();
    } finally {
      for (const receipt of receipts.values()) {
        if (receipt.status === 'not-run' || receipt.status === 'running') {
          receipt.status = 'blocked';
          receipt.error = setupError ?? 'This selected case did not reach a terminal result.';
        }
      }
      await persist();
    }
  }
});

async function runCell(
  id: string,
  options: BrowserContextOptions,
  action: (page: Page, facts: Record<string, unknown>) => Promise<void>
) {
  const receipt = receipts.get(id)!;
  receipt.status = 'running';
  receipt.facts = { options };
  receipt.pageErrors = [];
  await persist();
  let context: BrowserContext | undefined;
  let page: Page | undefined;
  const failures: unknown[] = [];
  try {
    context = await browser.newContext(options);
    page = await context.newPage();
    page.setDefaultTimeout(10_000);
    page.on('pageerror', (error) => receipt.pageErrors!.push(error.message));
    const navigations: Array<{ at: string; url: string }> = [];
    const devServerMessages: string[] = [];
    receipt.facts.mainFrameNavigations = navigations;
    receipt.facts.devServerMessages = devServerMessages;
    page.on('framenavigated', (frame) => {
      if (frame === page!.mainFrame())
        navigations.push({ at: new Date().toISOString(), url: frame.url() });
    });
    page.on('websocket', (socket) => {
      socket.on('framereceived', (frame) => {
        if (typeof frame.payload !== 'string') return;
        devServerMessages.push(frame.payload.slice(0, 2_000));
        if (devServerMessages.length > 20) devServerMessages.shift();
      });
    });
    await action(page, receipt.facts);
    expect(receipt.pageErrors).toEqual([]);
  } catch (error) {
    failures.push(error);
  } finally {
    if (page && !page.isClosed()) {
      try {
        receipt.facts.finalUrl = page.url();
        receipt.facts.finalDocumentTimeOrigin = await page.evaluate(() => performance.timeOrigin);
        const filename = `${id}.png`;
        await page.screenshot({ path: path.join(output, filename), timeout: 10_000 });
        receipt.screenshots = [filename];
      } catch (error) {
        failures.push(error);
      }
    }
    try {
      await context?.close();
    } catch (error) {
      failures.push(error);
    }
    receipt.status = failures.length ? 'failed' : 'passed';
    if (failures.length) receipt.error = failures.map(String).join('\n');
    await persist();
  }
  if (failures.length) throw new AggregateError(failures, `${id} failed; receipt: ${output}`);
}

async function goto(page: Page, route: string) {
  const response = await page.goto(`${baseUrl}${route}`, {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });
  expect(response?.status()).toBe(200);
  return response!;
}

async function manager(page: Page, name: 'npm' | 'pnpm') {
  const card = page.locator('[data-install-command-card]').first();
  await page.waitForFunction(
    () =>
      document.querySelector<HTMLElement>('[data-install-command-card]')?.dataset
        .installCommandInit === '1'
  );
  const button = card.getByRole('button', { name, exact: true });
  await button.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => card.getAttribute('data-active-manager'), { timeout: 10_000 }).toBe(name);
  const panel = card.locator(`[data-command-panel="${name}"]`);
  expect(await panel.isVisible()).toBe(true);
  expect(await card.locator('[data-command-panel]:visible').count()).toBe(1);
  expect(await panel.textContent()).toContain('@proto.ui/cli@0.2.0');
  return (await panel.textContent())!.trim();
}

describe.sequential('current-source release documentation reading', () => {
  for (const locale of locales) {
    for (const profile of profiles) {
      for (const family of ['button', 'dialog'] as const) {
        const id = `${locale}-nojs-${profile.id}-${family}`;
        it(
          id,
          async () =>
            runCell(
              id,
              {
                javaScriptEnabled: false,
                viewport: { width: profile.width, height: 900 },
                colorScheme: profile.colorScheme,
              },
              async (page, facts) => {
                await goto(page, routeFor(locale, family));
                facts.locale = await page.locator('html').getAttribute('lang');
                expect(facts.locale).toBe(locale === 'en' ? 'en' : 'zh-CN');
                if (family === 'button') {
                  const card = page.locator('[data-install-command-card]').first();
                  facts.commands = await card
                    .locator('[data-command-panel]')
                    .evaluateAll((panels) =>
                      panels.map((panel) => ({
                        manager: panel.getAttribute('data-command-panel'),
                        text: panel.textContent?.trim(),
                        visible: (panel as HTMLElement).checkVisibility(),
                      }))
                    );
                  expect(facts.commands).toEqual([
                    {
                      manager: 'npm',
                      text: 'npx @proto.ui/cli@0.2.0 add wc base-button',
                      visible: true,
                    },
                    {
                      manager: 'pnpm',
                      text: 'pnpm dlx @proto.ui/cli@0.2.0 add wc base-button',
                      visible: true,
                    },
                  ]);
                  const example = page.locator('[data-code-example]');
                  for (const runtime of RUNTIMES) {
                    const panel = example.locator(
                      `[data-code-host-panel][data-code-host="${runtime}"]`
                    );
                    expect(await panel.isVisible()).toBe(true);
                    const files = baseButtonFiles[runtime]!;
                    for (const [index, file] of files.entries()) {
                      const shell = panel.locator(
                        `[data-code-file-panel][data-code-file-index="${index}"]`
                      );
                      expect(await shell.isVisible()).toBe(true);
                      expect(await shell.locator('code[data-raw-code]').textContent()).toBe(
                        file.code
                      );
                      expect(await shell.getAttribute('data-code-expanded')).toBe('true');
                    }
                  }
                  facts.visibleHosts = [...RUNTIMES];
                  await card.scrollIntoViewIfNeeded();
                } else {
                  const shell = page.locator('[data-previewer-id] [data-code-shell]').first();
                  facts.source = await shell.evaluate((root) => {
                    const pre = root.querySelector<HTMLElement>('pre')!;
                    const content = root.querySelector<HTMLElement>('[data-code-content]')!;
                    const toggle = root.querySelector<HTMLElement>('[data-code-toggle]')!;
                    return {
                      expanded: root.getAttribute('data-code-expanded'),
                      mask: getComputedStyle(content).maskImage,
                      height: pre.getBoundingClientRect().height,
                      raw: pre.querySelector('code')?.getAttribute('data-raw-code'),
                      text: pre.textContent,
                      toggleVisible: toggle.checkVisibility(),
                      selectable: getComputedStyle(pre).userSelect !== 'none',
                    };
                  });
                  const source = facts.source as {
                    expanded: string;
                    mask: string;
                    height: number;
                    raw: string;
                    text: string;
                    toggleVisible: boolean;
                    selectable: boolean;
                  };
                  expect(source.expanded).toBe('true');
                  expect(source.mask).toBe('none');
                  expect(source.height).toBeGreaterThan(80);
                  expect(source.raw).toContain('wc-shadcn-dialog-root');
                  expect(source.text).toBe(source.raw);
                  expect(source.toggleVisible).toBe(false);
                  expect(source.selectable).toBe(true);
                  await shell.scrollIntoViewIfNeeded();
                }
                facts.documentOverflow = await page.evaluate(
                  () => document.documentElement.scrollWidth - innerWidth
                );
                expect(facts.documentOverflow).toBeLessThanOrEqual(1);
              }
            ),
          90_000
        );
      }
    }

    for (const runtime of RUNTIMES) {
      const id = `${locale}-source-${runtime}`;
      it(
        id,
        async () =>
          runCell(
            id,
            {
              viewport: { width: runtime === 'wc' ? 1280 : 390, height: 900 },
              colorScheme: runtime === 'vue2' ? 'dark' : 'light',
            },
            async (page, facts) => {
              await goto(page, routeFor(locale, 'button'));
              const preview = page.locator('[data-demo-id="demo-base-button"]');
              await choosePreviewRuntime(page, preview, runtime);
              await expect
                .poll(
                  () =>
                    preview.evaluate((root) =>
                      (
                        root as HTMLElement & { __previewer__?: { getCurrentRuntime(): string } }
                      ).__previewer__?.getCurrentRuntime()
                    ),
                  { timeout: 10_000 }
                )
                .toBe(runtime);
              const host = preview.locator('.host');
              await host
                .getByRole('button', { name: 'Run action', exact: true })
                .waitFor({ state: 'visible' });
              expect(
                await host.getByRole('button', { name: 'Disabled', exact: true }).isDisabled()
              ).toBe(true);
              if (runtime === 'vue2') {
                const original = await page.evaluate(() =>
                  parseFloat(getComputedStyle(document.documentElement).fontSize)
                );
                await page.addStyleTag({
                  content: `html { font-size: ${original * 2}px !important; }`,
                });
                facts.textEnlargement = {
                  method: 'CSS root font size',
                  factor: 2,
                  browserZoom: false,
                };
              }
              const example = page.locator('[data-code-example]');
              // The idle enhancement retires the SSR anchor strip. Exercise the
              // actual family Tabs, without holding a fallback through that swap.
              const hostTab = example
                .locator('[data-code-example-tablist="host"]')
                .getByRole('tab', { name: hostNames[runtime], exact: true });
              await hostTab.waitFor({ state: 'visible' });
              await hostTab.click();
              expect(await hostTab.getAttribute('aria-selected')).toBe('true');
              facts.hostControl = await hostTab.evaluate((element) => ({
                tag: element.tagName,
                projected: element.hasAttribute('data-code-example-projected-tab'),
                width: element.getBoundingClientRect().width,
              }));
              const panel = example.locator(`[data-code-host-panel][data-code-host="${runtime}"]`);
              await panel.waitFor({ state: 'visible' });
              const samples = [];
              for (const [index, file] of baseButtonFiles[runtime]!.entries()) {
                const treeItem = panel.locator(
                  `[data-code-tree-path=${JSON.stringify(file.name)}][role="treeitem"]`
                );
                await treeItem.click();
                const shell = panel.locator(
                  `[data-code-file-panel][data-code-file-index="${index}"]`
                );
                await shell.waitFor({ state: 'visible' });
                const code = shell.locator('code[data-raw-code]');
                const text = await code.textContent();
                expect(text).toBe(file.code);
                expect(await code.getAttribute('data-raw-code')).toBe(file.code);
                samples.push({
                  path: file.name,
                  sha256: createHash('sha256').update(text!).digest('hex'),
                });
              }
              facts.runtime = runtime;
              facts.files = samples;
              facts.documentOverflow = await page.evaluate(
                () => document.documentElement.scrollWidth - innerWidth
              );
              expect(facts.documentOverflow).toBeLessThanOrEqual(1);
            }
          ),
        90_000
      );
    }

    const navigationId = `${locale}-keyboard-navigation`;
    it(
      navigationId,
      async () =>
        runCell(
          navigationId,
          {
            viewport: { width: 390, height: 900 },
            colorScheme: 'dark',
          },
          async (page, facts) => {
            await goto(page, routeFor(locale, 'button'));
            facts.baseCommand = await manager(page, 'pnpm');
            const shadcnRoute = `/${locale}/ui-libraries/shadcn/button/`;
            await page.locator(`main a[href="${shadcnRoute}"]`).first().click();
            await page.waitForURL(`**${shadcnRoute}`);
            facts.shadcnCommand = await manager(page, 'pnpm');
            facts.navigationEntries = await page.evaluate(() =>
              performance.getEntriesByType('navigation').map((entry) => entry.name)
            );
            expect(facts.navigationEntries).toEqual([`${baseUrl}${shadcnRoute}`]);
            await page.goBack({ waitUntil: 'domcontentloaded' });
            await page.waitForURL(`**${routeFor(locale, 'button')}`);
            await manager(page, 'npm');
            facts.returnedCommand = await manager(page, 'pnpm');
            await goto(page, routeFor(locale, 'dialog'));
            const preview = page.locator('[data-demo-id="demo-shadcn-dialog"]');
            await choosePreviewRuntime(page, preview, 'wc');
            const shell = preview.locator('[data-code-shell]');
            const toggle = shell.getByRole('button', {
              name: locale === 'en' ? 'View code' : '展开代码',
              exact: true,
            });
            const viewport = shell.locator('[data-code-scroll-ready] [data-code-scroll-viewport]');
            await viewport.waitFor({ state: 'visible' });
            await toggle.waitFor({ state: 'visible' });
            await toggle.focus();
            await page.keyboard.press('Enter');
            await expect.poll(() => shell.getAttribute('data-code-expanded')).toBe('true');
            expect(await toggle.isVisible()).toBe(false);
            // The enhanced native viewport owns scrolling and focus; the PRE
            // remains the static fallback and must not add a second Tab stop.
            await expect
              .poll(() => viewport.evaluate((element) => element === document.activeElement))
              .toBe(true);
            expect(await shell.locator('pre').getAttribute('tabindex')).toBeNull();
            facts.expansion = await shell.evaluate((root) => ({
              mask: getComputedStyle(root.querySelector('[data-code-content]')!).maskImage,
              focused:
                root.querySelector('[data-code-scroll-ready] [data-code-scroll-viewport]') ===
                document.activeElement,
              focusOwner: 'native-code-scroll-viewport',
              label: root.querySelector('[data-code-toggle]')?.getAttribute('aria-label'),
            }));
            await shell.scrollIntoViewIfNeeded();
          }
        ),
      120_000
    );

    const ownerId = `${locale}-astro-owner-probe`;
    it(
      ownerId,
      async () =>
        runCell(
          ownerId,
          {
            viewport: { width: 390, height: 900 },
            colorScheme: 'light',
          },
          async (page, facts) => {
            const response = await goto(page, routeFor(locale, 'button'));
            // Keep the bytes of this exact navigation. A second document fetch
            // is not needed to create a fresh node from the real authored SSR.
            const sourceHtml = await response.text();
            await manager(page, 'npm');
            facts.documentTimeOrigin = await page.evaluate(() => performance.timeOrigin);
            // Retain the live owner's actual node before teardown, independently
            // of the replacement evaluation's return value or any later lookup.
            const oldCard = await page
              .locator('[data-install-command-card]')
              .first()
              .elementHandle();
            if (!oldCard) throw new Error('Owner probe requires the live original card.');
            facts.ownerStage = 'captured-live-card';
            // The SSR bytes supply a new real card, without copying hydrated private
            // children. This is an explicit lifecycle probe, not an Astro navigation.
            try {
              await page.evaluate((html) => {
                const parsed = new DOMParser().parseFromString(html, 'text/html');
                const replacement = parsed.querySelector('[data-install-command-card]');
                const previous = document.querySelector<HTMLElement>('[data-install-command-card]');
                if (!previous || !replacement)
                  throw new Error('Owner probe requires both real cards.');
                document.dispatchEvent(new Event('astro:before-swap'));
                previous.replaceWith(document.importNode(replacement, true));
                document.dispatchEvent(new Event('astro:page-load'));
                document.dispatchEvent(new Event('astro:page-load'));
              }, sourceHtml);
              facts.ownerStage = 'replacement-published';
              facts.newCommand = await manager(page, 'pnpm');
              facts.retiredOwner = await oldCard.evaluate((old) => {
                old
                  .querySelector('[data-manager-tab="pnpm"]')!
                  .dispatchEvent(new CustomEvent('click', { bubbles: true }));
                return {
                  connected: old.isConnected,
                  initialized: old.dataset.installCommandInit ?? null,
                  manager: old.dataset.activeManager,
                };
              });
              expect(facts.retiredOwner).toEqual({
                connected: false,
                initialized: null,
                manager: 'npm',
              });
              expect(await page.evaluate(() => performance.timeOrigin)).toBe(
                facts.documentTimeOrigin
              );
              facts.ownerStage = 'retired-reference-verified';
              facts.probe =
                'Synthetic Astro before-swap/page-load lifecycle; new controls activated with native keyboard.';
              await page.locator('[data-install-command-card]').first().scrollIntoViewIfNeeded();
            } finally {
              await oldCard.dispose();
            }
          }
        ),
      90_000
    );
  }
});
