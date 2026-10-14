// @vitest-environment node
// Public consumer evidence for P-SHADCN-BUTTON-GHOST-NEW-YORK-PAINT, not full Button parity.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  RUNTIMES,
  COLOR_SCHEMES,
  chromeExecutable,
  startServer,
  stopServer,
  applyColorScheme,
} from './browser-harness';
import { revealHeaderPreferences } from './site-header-browser';
import { ghostPaintFailures } from './ghost-paint-oracle';

const route = '/zh-cn/ui-libraries/shadcn/button/';
const demoId = 'demo-button-ghost';
const output = process.env.PUI_FINF_FEATURE_EVIDENCE_DIR ?? path.join(tmpdir(), 'pui-button-ghost');
const revision = execFileSync('git', ['rev-parse', 'HEAD']).toString().trim();
const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}']).toString().trim();
const trackedChanges = execFileSync('git', ['diff', '--name-only', 'HEAD']).toString().trim();
const untrackedChanges = execFileSync('git', ['ls-files', '--others', '--exclude-standard'])
  .toString()
  .trim();
const candidate = {
  revision,
  tree,
  cleanExactCommit: !trackedChanges && !untrackedChanges,
  trackedChanges: trackedChanges ? trackedChanges.split('\n') : [],
  untrackedChanges: untrackedChanges ? untrackedChanges.split('\n') : [],
  trackedPatchSha256: createHash('sha256')
    .update(execFileSync('git', ['diff', '--binary', 'HEAD']))
    .digest('hex'),
};
const references = {
  productBase: 'f9a1240ade95a58ccb03864a17ba1b9753e37073',
  upstream: '02cad61166c4c20edbc8a3f71bd720eed4c1f49b',
  blob: 'e3345d985d14c33e3cb9d8c45cf973807326c944',
  url: 'https://github.com/shadcn-ui/ui/blob/02cad61166c4c20edbc8a3f71bd720eed4c1f49b/apps/v4/registry/new-york-v4/ui/button.tsx#L18-L19',
  criterion: 'P-SHADCN-BUTTON#P-SHADCN-BUTTON-GHOST-NEW-YORK-PAINT',
  limit:
    'Real public ghost paint and bounded input journey only. Not packed, GPUI, complete Button parity, animation timing or visual design approval. Screenshots bind the actual candidate, not productBase.',
};
const writeJson = (name: string, value: unknown) =>
  writeFile(path.join(output, name), JSON.stringify(value, null, 2) + '\n');
let browser: Browser;
let baseUrl = '';
beforeAll(async () => {
  await mkdir(output, { recursive: true });
  const sourceHashes: Record<string, string> = {};
  for (const file of [
    'packages/prototypes/shadcn/src/button/button.proto.ts',
    'packages/prototypes/shadcn/src/button/paint.ts',
    'packages/prototypes/base/src/button/button.proto.ts',
    'packages/cli/src/generated/shadcn-style-tokens.ts',
    'apps/www/src/content/docs/demo_components/button/demo-button-ghost.demo.ts',
    'apps/www/src/content/docs/demo_components/button/buttonCode.ts',
    'apps/www/src/content/docs/zh-cn/ui-libraries/shadcn/button.mdx',
    'apps/www/src/content/docs/zh-cn/finf-button-ghost.browser.test.ts',
    'apps/www/src/content/docs/zh-cn/ghost-paint-oracle.ts',
    'apps/www/src/content/docs/zh-cn/browser-harness.ts',
    'apps/www/src/content/docs/zh-cn/site-header-browser.ts',
    '.github/workflows/finf-button-ghost-evidence.yml',
  ])
    sourceHashes[file] = createHash('sha256')
      .update(await readFile(file))
      .digest('hex');
  await writeJson('button-ghost-source.json', {
    candidate,
    references,
    sourceHashes,
    route,
    demoId,
    expectedCases: RUNTIMES.length * COLOR_SCHEMES.length,
    phase: 'Planned; terminal case receipts alone prove execution.',
  });
  try {
    if (process.env.GITHUB_ACTIONS !== 'true' || !process.env.CANDIDATE_SHA)
      throw new Error(
        'Official GitHub Actions only; local source tests do not launch a native browser.'
      );
    expect(revision).toBe(process.env.CANDIDATE_SHA);
    expect(candidate.cleanExactCommit).toBe(true);
    const requested = process.env.PROTO_UI_BROWSER_BASE_URL;
    if (requested && !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(requested).hostname))
      throw new Error('External evidence servers are not allowed.');
    baseUrl = await startServer('/');
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(baseUrl).hostname))
      throw new Error('Evidence requires this job’s own loopback documentation server.');
    const generatedHashes: Record<string, string> = {};
    for (const file of ['shadcn-theme.css', 'proto-ui-tokens.generated.css', 'proto-ui-style.css'])
      generatedHashes[file] = createHash('sha256')
        .update(await readFile(`apps/www/src/styles/${file}`))
        .digest('hex');
    await writeJson('button-ghost-generated-css.json', {
      candidate,
      generatedHashes,
      provenance: 'Normal apps-www dev generate:proto-ui-style pipeline; no test stylesheet.',
    });
    browser = await chromium.launch({
      executablePath: await chromeExecutable(),
      headless: true,
      chromiumSandbox: true,
      args: ['--disable-dev-shm-usage'],
    });
  } catch (error) {
    await writeJson('button-ghost-setup.json', {
      candidate,
      result: 'blocked-before-browser',
      error: String(error),
      screenshots: [],
      unexecuted: [
        'eight runtime/theme cases',
        'Header selection and actual framework',
        'hover/leave paint',
        'disabled pointer/keyboard entry',
        'bound screenshots',
      ],
    });
    throw error;
  }
}, 180_000);
afterAll(async () => {
  try {
    await browser?.close();
  } finally {
    await stopServer();
  }
}, 60_000);

const labels = { wc: 'Web Components', react: 'React', vue: 'Vue', vue2: 'Vue 2' };
async function selectPublicPanel(page: Page, runtime: (typeof RUNTIMES)[number]) {
  const openedMenu = await revealHeaderPreferences(page);
  const trigger = page.locator(
    '[data-docs-site-header] [data-adapter-select-root] [role="combobox"]'
  );
  await trigger.click();
  const contentId = await trigger.getAttribute('aria-controls');
  expect(contentId).toBeTruthy();
  const portal = page.locator(`[id=${JSON.stringify(contentId)}]`);
  await portal.getByRole('option', { name: labels[runtime], exact: true }).click();
  await portal.waitFor({ state: 'hidden' });
  await expect.poll(() => trigger.textContent()).toContain(labels[runtime]);
  if (openedMenu) {
    const menu = page.locator('[data-docs-site-header] [data-site-menu-button]');
    if ((await menu.getAttribute('aria-expanded')) === 'true') await menu.click();
  }
  const previewer = page.locator(
    `[data-adapter-panel="${runtime}"] [data-previewer-id][data-demo-id="${demoId}"]`
  );
  expect(await previewer.count()).toBe(1);
  await previewer.scrollIntoViewIfNeeded();
  const previewerId = await previewer.getAttribute('data-previewer-id');
  expect(previewerId).toBeTruthy();
  // Toolbarless generic previews have no local runtime control. Read the public
  // committed runtime plus the actual mounted framework, never a hidden WC panel.
  await page.waitForFunction(
    ({ previewerId, runtime }) => {
      const root = document.querySelector<HTMLElement>(
        `[data-previewer-id=${JSON.stringify(previewerId)}]`
      );
      if (!root) return false;
      const host = root.querySelector<HTMLElement>('.host');
      const surface = host?.querySelector<HTMLElement>(
        '.pui-runtime-preview-surface[data-demo-ref="__website_runtime_preview_surface__"]'
      );
      const first = surface?.querySelector<HTMLElement>('[data-pui-root]');
      if (!host || !surface || !first || surface.querySelectorAll('[data-pui-root]').length !== 2)
        return false;
      const committed = (
        root as HTMLElement & { __previewer__?: { getCurrentRuntime?: () => string } }
      ).__previewer__?.getCurrentRuntime?.();
      if (
        committed !== runtime ||
        root.querySelector(
          '[data-previewer-startup-pending], [data-previewer-startup-shell], .proto-previewer__skeleton'
        )
      )
        return false;
      for (let node: HTMLElement | null = surface; node; node = node.parentElement) {
        const css = getComputedStyle(node);
        if (
          !node.isConnected ||
          node.inert ||
          node.matches('[inert], [hidden], [aria-hidden="true"], [aria-busy="true"]') ||
          css.display === 'none' ||
          css.visibility === 'hidden'
        )
          return false;
      }
      const actual = first.tagName.startsWith('WC-')
        ? 'wc'
        : (first as HTMLElement & { __vue__?: unknown }).__vue__
          ? 'vue2'
          : host.hasAttribute('data-v-app') || first.closest('[data-v-app]')
            ? 'vue'
            : Object.keys(surface).some((key) => key.startsWith('__reactFiber$'))
              ? 'react'
              : null;
      return actual === runtime;
    },
    { previewerId, runtime },
    { timeout: 20_000 }
  );
  return previewer;
}

async function metrics(control: Locator) {
  return control.evaluate((element) => {
    const html = element as HTMLElement,
      css = getComputedStyle(element),
      rect = element.getBoundingClientRect();
    // Offscreen Canvas only normalizes observed CSS colors to sRGB8. It never
    // enters the document, supplies component CSS or paints an oracle component.
    const canvas = new OffscreenCanvas(1, 1),
      ctx = canvas.getContext('2d')!;
    const rgba = (color: string): [number, number, number, number] => {
      if (!CSS.supports('color', color)) throw new Error(`Unresolved observed color: ${color}`);
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      return Array.from(ctx.getImageData(0, 0, 1, 1).data) as [number, number, number, number];
    };
    const palette = Object.fromEntries(
      ['accent', 'accent-foreground', 'foreground'].map((key) => [
        key,
        css.getPropertyValue(`--pui-${key}`).trim(),
      ])
    );
    return {
      tag: element.tagName,
      text: element.textContent,
      theme: document.documentElement.dataset.theme,
      tokens: element.getAttribute('data-pui-style'),
      backgroundCss: css.backgroundColor,
      foregroundCss: css.color,
      palette,
      background: rgba(css.backgroundColor),
      foreground: rgba(css.color),
      accent: rgba(palette.accent),
      accentForeground: rgba(palette['accent-foreground']),
      normalForeground: rgba(palette.foreground),
      hovered: element.hasAttribute('data-hovered'),
      disabled: element.hasAttribute('data-disabled'),
      pressed: element.hasAttribute('data-pressed'),
      focused: element.hasAttribute('data-focused'),
      focusVisible: element.hasAttribute('data-focus-visible'),
      opacity: Number(css.opacity),
      pointerEvents: css.pointerEvents,
      role: element.getAttribute('role'),
      ariaDisabled: element.getAttribute('aria-disabled'),
      tabIndex: html.tabIndex,
      active: document.activeElement === element,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    };
  });
}
const settleInput = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
async function centerHit(control: Locator) {
  return control.evaluate((element) => {
    const r = element.getBoundingClientRect(),
      x = r.x + r.width / 2,
      y = r.y + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    return {
      x,
      y,
      belongs: !!hit && (hit === element || element.contains(hit)),
      hasArea: r.width > 0 && r.height > 0,
      inViewport: x > 0 && y > 0 && x < innerWidth && y < innerHeight,
      hitExists: !!hit,
      tag: hit?.tagName,
      text: hit?.textContent?.slice(0, 80),
    };
  });
}
for (const runtime of RUNTIMES)
  for (const scheme of COLOR_SCHEMES) {
    const id = `button-ghost-${runtime}-${scheme}`;
    it(
      id,
      async () => {
        let context: BrowserContext | undefined,
          page: Page | undefined,
          previewer: Locator | undefined;
        let stage = 'created',
          result = 'failed',
          failure: string | undefined;
        const observations: Record<string, unknown> = {},
          screenshots: unknown[] = [],
          errors: string[] = [],
          deniedRequests: string[] = [];
        try {
          context = await browser.newContext({
            viewport: { width: 1280, height: 1000 },
            colorScheme: scheme,
            reducedMotion: 'reduce',
            locale: 'zh-CN',
            timezoneId: 'UTC',
          });
          await context.route('**/*', (request) => {
            const url = new URL(request.request().url());
            if (url.origin === new URL(baseUrl).origin) return request.continue();
            deniedRequests.push(url.origin);
            return request.abort();
          });
          page = await context.newPage();
          page.setDefaultTimeout(15_000);
          page.setDefaultNavigationTimeout(30_000);
          page.on('pageerror', (error) => errors.push(`${stage}: ${String(error)}`));
          const capture = async (state: string) => {
            const file = `${id}-${state}.png`,
              bytes = await previewer!.screenshot({ path: path.join(output, file) });
            screenshots.push({
              candidate,
              runtime,
              scheme,
              route,
              demoId,
              state,
              file,
              sha256: createHash('sha256').update(bytes).digest('hex'),
              observations: structuredClone(observations),
              environment: await page!.evaluate(() => ({
                viewport: { width: innerWidth, height: innerHeight },
                dpr: devicePixelRatio,
                fonts: document.fonts.status,
                theme: document.documentElement.dataset.theme,
                rootFont: getComputedStyle(document.documentElement).fontSize,
              })),
            });
          };
          stage = 'navigate';
          expect(
            (await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' }))?.status()
          ).toBe(200);
          await applyColorScheme(page, scheme);
          stage = 'header-runtime-selection';
          previewer = await selectPublicPanel(page, runtime);
          await page.evaluate(() => document.fonts.ready);
          const enabled = previewer.getByRole('button', { name: 'Ghost', exact: true });
          const disabled = previewer.getByRole('button', { name: 'Disabled ghost', exact: true });
          const status = previewer.getByRole('status');
          const counts = (enabledCount: number) =>
            expect
              .poll(() => status.textContent())
              .toBe(`Enabled activations: ${enabledCount}; disabled activations: 0`);
          const paint = async (target: Locator, hovered: boolean, isDisabled = false) => {
            await expect
              .poll(async () =>
                ghostPaintFailures(await metrics(target), scheme, hovered, isDisabled)
              )
              .toEqual([]);
            const observed = await metrics(target);
            expect(observed.theme).toBe(scheme);
            return observed;
          };
          await counts(0);
          await page.mouse.move(0, 0);
          stage = 'rest';
          observations.rest = await paint(enabled, false);
          observations.disabledRest = await paint(disabled, false, true);
          await capture('rest');
          stage = 'hover';
          await enabled.hover();
          observations.hover = await paint(enabled, true);
          await counts(0);
          await capture('hover');
          stage = 'leave';
          await page.mouse.move(0, 0);
          observations.leave = await paint(enabled, false);
          await counts(0);
          await capture('leave');
          stage = 'enabled-pointer-control';
          const enabledHit = await centerHit(enabled);
          expect(enabledHit.hasArea).toBe(true);
          expect(enabledHit.inViewport).toBe(true);
          expect(enabledHit.hitExists).toBe(true);
          expect(enabledHit.belongs).toBe(true);
          observations.enabledHit = enabledHit;
          await page.mouse.click(enabledHit.x, enabledHit.y);
          await counts(1);
          await expect
            .poll(() => enabled.evaluate((element) => document.activeElement === element))
            .toBe(true);
          stage = 'enabled-keyboard-control';
          await page.keyboard.press('Enter');
          await counts(2);
          await page.keyboard.press('Space');
          await counts(3);
          stage = 'disabled-tab-exclusion';
          await page.keyboard.press('Tab');
          await settleInput(page!);
          observations.afterTab = await metrics(disabled);
          expect((observations.afterTab as Awaited<ReturnType<typeof metrics>>).active).toBe(false);
          await counts(3);
          // Host focus() is a diagnostic attempt, not Base focusSelf(). Do not add
          // tabindex to force access. If the browser excludes this disabled host,
          // record keyboard entry exclusion rather than pretending it got key input.
          await disabled.evaluate((element) => (element as HTMLElement).focus());
          const disabledFocused = await disabled.evaluate(
            (element) => document.activeElement === element
          );
          observations.disabledKeyboard = {
            input: 'DOM focus attempt, then trusted keys only if actually focused',
            acquiredFocus: disabledFocused,
            result: disabledFocused ? 'activation guard exercised' : 'keyboard entry excluded',
          };
          if (disabledFocused) {
            await page!.keyboard.press('Enter');
            await page!.keyboard.press('Space');
          }
          await settleInput(page!);
          await counts(3);
          stage = 'disabled-pointer-hover';
          await disabled.scrollIntoViewIfNeeded();
          const disabledHit = await centerHit(disabled);
          expect(disabledHit.hasArea).toBe(true);
          expect(disabledHit.inViewport).toBe(true);
          expect(disabledHit.hitExists).toBe(true);
          expect(disabledHit.belongs).toBe(false);
          observations.disabledHit = disabledHit;
          await page.mouse.move(disabledHit.x, disabledHit.y);
          await settleInput(page!);
          observations.disabledHover = await paint(disabled, false, true);
          await counts(3);
          await page.mouse.click(disabledHit.x, disabledHit.y);
          await settleInput(page!);
          observations.disabledAfterInput = await paint(disabled, false, true);
          await counts(3);
          await capture('disabled');
          await page.mouse.move(0, 0);
          observations.finalLeave = await paint(enabled, false);
          await paint(disabled, false, true);
          expect(errors).toEqual([]);
          expect(deniedRequests).toEqual([]);
          result = 'passed';
        } catch (error) {
          failure = String(error);
          if (page)
            try {
              // Snapshot immediately; never re-wait on a failed strict control locator.
              observations.failureDom = await page
                .locator(`[data-demo-id="${demoId}"]`)
                .evaluateAll((nodes) =>
                  nodes.map((node) => ({
                    panel: node.closest('[data-adapter-panel]')?.getAttribute('data-adapter-panel'),
                    text: node.textContent?.slice(0, 1000),
                    html: node.outerHTML.slice(0, 8000),
                  }))
                );
              const file = `${id}-failure.png`,
                bytes = await page.screenshot({ path: path.join(output, file), timeout: 5_000 });
              screenshots.push({
                candidate,
                runtime,
                scheme,
                stage,
                file,
                sha256: createHash('sha256').update(bytes).digest('hex'),
              });
            } catch (captureError) {
              errors.push(`failure capture: ${String(captureError)}`);
            }
          throw error;
        } finally {
          await writeJson(`${id}.json`, {
            candidate,
            references,
            runtime,
            scheme,
            route,
            demoId,
            result,
            stage,
            failure,
            observations,
            screenshots,
            errors,
            deniedRequests,
            browserVersion: browser?.version(),
          });
          await context?.close();
        }
      },
      120_000
    );
  }
