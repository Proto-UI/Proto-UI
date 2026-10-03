import assert from 'node:assert/strict';
import path from 'node:path';
import type { Browser, Page } from 'playwright-core';
import {
  DOCUMENTATION_VARIANTS,
  HOMEPAGE_VIEWPORTS,
  layoutFailures,
} from './homepage-evidence-contract';

const DOCUMENTATION_FONTS = [
  { name: 'heading', selector: 'h1' },
  { name: 'body', selector: '.sl-markdown-content p' },
  { name: 'navigation', selector: 'header a[href]' },
  { name: 'toolbar-label', selector: '[data-previewer-id] .pui-projection-control-label' },
  {
    name: 'demo',
    selector:
      '[data-previewer-id] [data-projection-content] [data-pui-root], [data-previewer-id] .host [data-pui-root]',
  },
];

type Measurement = {
  viewportWidth: number;
  documentWidth: number;
  bodyWidth: number;
  fonts: Array<{ name: string; fontFamily: string }>;
} & Record<string, unknown>;

/** Docs use their authored library's typography; a Brutalist monospace face is not a homepage font regression. */
export async function captureDocumentationEvidence({
  browser,
  baseUrl,
  revisionKind,
  out,
  report,
  saveReport,
  measure,
}: {
  browser: Browser;
  baseUrl: string;
  revisionKind: 'baseline' | 'candidate';
  out: string;
  report: { cases: Array<Record<string, unknown>>; failures: string[] };
  saveReport(): Promise<void>;
  measure(page: Page, samples: Array<{ name: string; selector: string }>): Promise<Measurement>;
}): Promise<void> {
  for (const variant of DOCUMENTATION_VARIANTS)
    for (const viewport of HOMEPAGE_VIEWPORTS)
      for (const colorScheme of ['light', 'dark'] as const) {
        const id = `${variant.id}-${viewport.name}-${colorScheme}`;
        const screenshots: string[] = [];
        const evidence: Record<string, unknown> = {
          id,
          route: variant.route,
          expectedComponentFamily: variant.family,
          expectedSiteFamily: variant.family === 'brutalist' ? 'brutalist' : 'shadcn',
          viewport,
          colorScheme,
          screenshots,
        };
        report.cases.push(evidence);
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          colorScheme,
          reducedMotion: 'reduce',
        });
        const page = await context.newPage();
        page.setDefaultTimeout(15_000);
        const pageErrors: string[] = [];
        page.on('pageerror', (error) => pageErrors.push(error.message));
        evidence.pageErrors = pageErrors;
        const screenshot = async (name: string, fullPage = false) => {
          const filename = `${id}-${name}.png`;
          await page.screenshot({ path: path.join(out, filename), fullPage });
          screenshots.push(filename);
        };
        try {
          await page.goto(`${baseUrl}${variant.route}`, { waitUntil: 'networkidle' });
          const preview = page.locator('[data-previewer-id]').first();
          await preview.waitFor({ state: 'visible' });
          await page.waitForFunction(
            () => {
              const previews = [...document.querySelectorAll<HTMLElement>('[data-previewer-id]')];
              return (
                previews.length > 0 &&
                previews.every((root) => {
                  const scope = root.querySelector<HTMLElement>('[data-projection-scope]');
                  return scope
                    ? scope.dataset.projectionState === 'ready'
                    : !!root.querySelector('.host [data-pui-root]');
                })
              );
            },
            undefined,
            { timeout: 30_000 }
          );
          await page.waitForFunction(
            (theme) => document.documentElement.dataset.theme === theme,
            colorScheme
          );
          if (revisionKind === 'candidate') {
            await page.waitForFunction(
              (family) => {
                const controls = [
                  ...document.querySelectorAll<HTMLElement>(
                    'header [data-site-select-root], header [data-theme-toggle]'
                  ),
                ];
                return (
                  document.documentElement.dataset.siteLibraryFamily === family &&
                  controls.length > 0 &&
                  controls.every(
                    (control) =>
                      control.dataset.siteShadcnInitialized === '1' &&
                      typeof (control as HTMLElement & { getExposes?: unknown }).getExposes ===
                        'function'
                  )
                );
              },
              variant.family === 'brutalist' ? 'brutalist' : 'shadcn',
              { timeout: 30_000 }
            );
          }
          await page.evaluate(async () => {
            await document.fonts.ready;
            await new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
            );
            scrollTo(0, 0);
          });
          evidence.initial = await measure(page, DOCUMENTATION_FONTS);
          await screenshot('initial-viewport');
          await screenshot('initial-full', true);
          const surfaces = await page.evaluate(() => {
            const helpers = {
              geometry(element: HTMLElement) {
                const style = getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                return {
                  tag: element.tagName,
                  id: element.id,
                  class: element.className,
                  visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden',
                  x: rect.x,
                  y: rect.y,
                  width: rect.width,
                  height: rect.height,
                  fontFamily: style.fontFamily,
                  color: style.color,
                  background: style.backgroundColor,
                  border: style.border,
                  radius: style.borderRadius,
                  boxShadow: style.boxShadow,
                };
              },
            };
            const parts = [
              'header',
              '.sidebar-pane',
              'aside',
              'footer',
              '[data-previewer-id]',
              '.pui-projection-controls',
              '.previewer-panel',
            ];
            return {
              family: document.documentElement.dataset.siteLibraryFamily,
              theme: document.documentElement.dataset.theme,
              tokens: Object.fromEntries(
                [
                  '--background',
                  '--foreground',
                  '--pui-background',
                  '--pui-foreground',
                  '--color-background',
                  '--color-foreground',
                  '--radius',
                  '--site-surface-radius',
                  '--site-surface-border-width',
                ].map((name) => [
                  name,
                  getComputedStyle(document.documentElement).getPropertyValue(name),
                ])
              ),
              geometry: parts.flatMap((selector) =>
                [...document.querySelectorAll<HTMLElement>(selector)].map((element) => ({
                  selector,
                  ...helpers.geometry(element),
                }))
              ),
              globalControls: [
                ...document.querySelectorAll<HTMLElement>('[data-site-control-family]'),
              ].map((element) => ({
                family: element.dataset.siteControlFamily,
                ...helpers.geometry(element),
                puiRoots: [...element.querySelectorAll<HTMLElement>('[data-pui-root]')].map(
                  (root) => ({
                    tag: root.tagName,
                    prototype:
                      root.getAttribute('data-projection-prototype') ||
                      root.getAttribute('data-prototype'),
                  })
                ),
              })),
              headerPuiRoots: [
                ...document.querySelectorAll<HTMLElement>('header [data-pui-root]'),
              ].map((root) => ({
                prototype:
                  root.getAttribute('data-projection-prototype') ||
                  root.getAttribute('data-prototype'),
                ...helpers.geometry(root),
              })),
              nativeLinks: [
                ...document.querySelectorAll<HTMLAnchorElement>(
                  'header a[href], .sidebar-pane a[href], footer a[href]'
                ),
              ].map((link) => ({
                text: link.textContent?.trim().slice(0, 80),
                href: link.getAttribute('href'),
                target: link.getAttribute('target'),
                rel: link.getAttribute('rel'),
              })),
            };
          });
          evidence.surfaces = surfaces;
          if (revisionKind === 'candidate') {
            const siteFamily = variant.family === 'brutalist' ? 'brutalist' : 'shadcn';
            assert.equal(surfaces.family, siteFamily, 'Document family follows its route');
            assert.ok(
              surfaces.globalControls.length > 0,
              'Global controls expose their selected family'
            );
            for (const control of surfaces.globalControls)
              assert.equal(
                control.family,
                siteFamily,
                'Global control family agrees with the document'
              );
            if (variant.family === 'brutalist')
              assert.ok(
                !surfaces.headerPuiRoots.some((root) =>
                  /shadcn/i.test(`${root.tag} ${root.prototype}`)
                ),
                'No stale Shadcn PUI control in the Brutalist header'
              );
            const failures = layoutFailures(evidence.initial as Measurement, {
              requireSansSerif: false,
            });
            evidence.layoutFailures = failures;
            report.failures.push(...failures.map((failure) => `${id}: ${failure}`));
          }
          if (variant.family === 'base') {
            const toggle = preview.getByRole('button', { name: 'Pin', exact: true });
            const before = await toggle.getAttribute('aria-pressed');
            await toggle.click();
            await page.waitForFunction(
              () =>
                document
                  .querySelector('[data-previewer-id] [role="button"][aria-pressed="true"]')
                  ?.textContent?.trim() === 'Pin'
            );
            evidence.interaction = {
              action: 'Pointer click Pin',
              before,
              after: await toggle.getAttribute('aria-pressed'),
            };
          } else if (variant.family === 'shadcn') {
            const radio = preview.locator('[data-demo-ref="density-default"]');
            const before = await radio.getAttribute('aria-checked');
            await radio.click();
            await page.waitForFunction(
              () =>
                document
                  .querySelector('[data-demo-ref="density-default"]')
                  ?.getAttribute('aria-checked') === 'true'
            );
            evidence.interaction = {
              action: 'Pointer click density Default',
              before,
              after: await radio.getAttribute('aria-checked'),
            };
          } else {
            const trigger = preview.getByText('Hover or focus for details', { exact: true });
            await trigger.hover();
            const tooltip = page.getByRole('tooltip').filter({ hasText: 'Portable Base behavior' });
            await tooltip.waitFor({ state: 'visible' });
            evidence.interaction = {
              action: 'Pointer hover first trigger',
              tooltip: await tooltip.innerText(),
              describedBy: await trigger.getAttribute('aria-describedby'),
            };
          }
          await screenshot('interaction-viewport');
          const themeButton = page.locator('header [data-theme-toggle]');
          const opposite = colorScheme === 'light' ? 'dark' : 'light';
          await themeButton.click();
          await page.waitForFunction(
            (theme) => document.documentElement.dataset.theme === theme,
            opposite
          );
          await themeButton.click();
          await page.waitForFunction(
            (theme) => document.documentElement.dataset.theme === theme,
            colorScheme
          );
          evidence.themeRoundTrip = [colorScheme, opposite, colorScheme];
          assert.deepEqual(pageErrors, [], 'No uncaught page errors');
          evidence.outcome = report.failures.some((failure) => failure.startsWith(`${id}:`))
            ? 'failed'
            : 'passed';
        } catch (error) {
          evidence.outcome = 'failed';
          evidence.error = error instanceof Error ? error.stack : String(error);
          report.failures.push(`${id}: ${error instanceof Error ? error.message : String(error)}`);
          await screenshot('failure-viewport').catch(() => {});
        } finally {
          await context.close();
          await saveReport();
        }
      }
}
