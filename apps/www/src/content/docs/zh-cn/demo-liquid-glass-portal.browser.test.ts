// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Browser, BrowserContext, CDPSession, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  launchBrowser,
  startServer,
  stopServer,
  RUNTIMES,
  choosePreviewRuntime,
  waitForPreviewRuntime,
} from './browser-harness';
import { publicPortalSnapshot } from './public-portal-diagnostic';
const ROUTE = '/en/test/liquid-glass-portal/';
const evidence = process.env.PROTO_UI_MATERIAL_EVIDENCE_DIR;
const observations: unknown[] = [];
let browser: Browser;
let baseUrl = '';
const safe = {
  'prefers-reduced-motion': 'reduce',
  'prefers-reduced-transparency': 'no-preference',
  'prefers-contrast': 'no-preference',
  'forced-colors': 'none',
};
async function preferences(
  cdp: CDPSession,
  theme = 'light',
  overrides: Record<string, string> = {}
) {
  await cdp.send('Emulation.setEmulatedMedia', {
    features: Object.entries({ ...safe, 'prefers-color-scheme': theme, ...overrides }).map(
      ([name, value]) => ({ name, value })
    ),
  });
}
async function fixture(runtime: string, theme = 'light', font = 'regular', dpr = 1) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    deviceScaleFactor: dpr,
  });
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === new URL(baseUrl).origin
      ? route.continue()
      : route.abort()
  );
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await preferences(cdp, theme);
  await page.goto(`${baseUrl}${ROUTE}?runtime=${runtime}&theme=${theme}&font=${font}`, {
    waitUntil: 'networkidle',
  });
  await page.waitForFunction(() => document.documentElement.dataset.portalReady, undefined, {
    timeout: 60000,
  });
  return { context, page, cdp };
}
const geometry = (page: Page) =>
  page.evaluate(() => (window as any).liquidPortalFixture.geometry());
async function open(page: Page) {
  const trigger = page.getByRole('button', { name: 'Open account menu', exact: true });
  await page.evaluate(() => (window as any).liquidPortalFixture.beginFocusObservation());
  await trigger.click();
  await page.getByRole('menu').waitFor({ state: 'visible' });
  return trigger;
}
async function optical(page: Page) {
  await expect
    .poll(async () => (await geometry(page)).quality, { timeout: 20000 })
    .toBe('self-optical');
  await expect
    .poll(() => page.evaluate(() => (window as any).liquidPortalFixture.activity().firstFocus))
    .toMatchObject({
      contentConnected: true,
      scopeContains: true,
      destinationOwns: true,
      physicalDestinationIsOverlay: true,
    });
  const firstFocus = await page.evaluate(
    () => (window as any).liquidPortalFixture.activity().firstFocus
  );
  const result = await geometry(page);
  expect(result.scopeContains).toBe(true);
  expect(result.destinationOwns).toBe(true);
  expect(result.contentCount).toBe(1);
  expect(result.admission.valid).toBe(true);
  expect(result.sourceKind).toBe('visible-app-canvas');
  expect(result.backdropFilter).toBe('none');
  expect(result.image).toContain('data:image/png');
  expect(result.content.left - result.paintOutset).toBeGreaterThanOrEqual(result.canvas.left);
  expect(result.content.top - result.paintOutset).toBeGreaterThanOrEqual(result.canvas.top);
  expect(result.content.right + result.paintOutset).toBeLessThanOrEqual(result.canvas.right);
  expect(result.content.bottom + result.paintOutset).toBeLessThanOrEqual(result.canvas.bottom);
  expect(result.source.width).toBe(Math.ceil(result.canvas.width * result.dpr));
  expect(result.source.height).toBe(Math.ceil(result.canvas.height * result.dpr));
  expect(result.source.width).toBeLessThanOrEqual(2048);
  expect(result.source.height).toBeLessThanOrEqual(2048);
  expect(result.source.width * result.source.height).toBeLessThanOrEqual(1048576);
  // Decode the real sink output rather than treating a status attribute as
  // sufficient paint evidence. No mocked canvas or supplied output image.
  const pixels = await page.evaluate(async () => {
    const host = document.querySelector<HTMLElement>('[data-demo-ref="content"]')!;
    const image = new Image();
    image.src = host.style.backgroundImage.slice(5, -2);
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const colors = new Set<string>();
    let painted = 0;
    for (let i = 0; i < data.length; i += 4)
      if (data[i + 3] > 0) {
        painted++;
        colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
      }
    return { width: canvas.width, height: canvas.height, painted, colors: colors.size };
  });
  expect(pixels.painted).toBeGreaterThan(1000);
  expect(pixels.colors).toBeGreaterThan(20);
  return { ...result, image: undefined, outputPixels: pixels, firstFocus };
}
async function capture(page: Page, name: string) {
  if (!evidence) return undefined;
  const dir = path.join(evidence, 'portal');
  await mkdir(dir, { recursive: true });
  const buffer = await page
    .locator('[data-portal-fixture-host]')
    .screenshot({ path: path.join(dir, `${name}.png`) });
  return { file: `portal/${name}.png`, sha256: createHash('sha256').update(buffer).digest('hex') };
}
beforeAll(async () => {
  baseUrl = await startServer(ROUTE);
  browser = await launchBrowser();
}, 150000);
afterAll(async () => {
  if (evidence) {
    await mkdir(path.join(evidence, 'portal'), { recursive: true });
    await writeFile(
      path.join(evidence, 'portal', 'metadata.json'),
      JSON.stringify(
        {
          sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
          sourceTree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], {
            encoding: 'utf8',
          }).trim(),
          trackedDiff: execFileSync('git', ['diff', '--name-only', 'HEAD'], {
            encoding: 'utf8',
          }).trim(),
          route: ROUTE,
          node: process.version,
          browser: browser?.version(),
          scope:
            'Official Dropdown Content and shared scene. Actual same-origin canvas only; no arbitrary DOM, native or Apple equivalence.',
          observations,
        },
        null,
        2
      )
    );
  }
  await browser?.close();
  await stopServer();
}, 60000);
// Native diagnostics are deliberately ahead of the failing public optical
// matrix. They do not weaken those acceptance assertions or alter PageFrame.
describe.sequential(
  'Liquid portal container diagnostics (observation, not guard relaxation)',
  () => {
    it('separates the real portal guard from native fixed-position containment', async () => {
      const { context, page } = await fixture('wc');
      const report: Record<string, unknown> = { checkpoint: 'native-container-controls' };
      observations.push(report);
      try {
        report.result = await page.evaluate(async () => {
          const policy = (window as any).liquidPortalFixture.portalDiagnostic;
          const root = document.createElement('div');
          root.style.cssText = 'display:block;height:2600px;padding:0;border:0;';
          document.body.append(root);
          const hostileStyle = document.createElement('style');
          hostileStyle.textContent =
            'body > [inert][aria-hidden="true"] { position: static !important; visibility: visible !important; transform: translate(400px, 300px) !important; width: 999px !important; }';
          document.head.append(hostileStyle);
          const originalScroll = { x: scrollX, y: scrollY };
          const frame = () =>
            new Promise<void>((resolve, reject) => {
              const timer = setTimeout(() => {
                cancelAnimationFrame(id);
                reject(new Error('diagnostic frame timeout'));
              }, 2000);
              const id = requestAnimationFrame(() => {
                clearTimeout(timer);
                resolve();
              });
            });
          const rect = (el: Element) => el.getBoundingClientRect().toJSON();
          const properties = [
            'container-type',
            'contain',
            'transform',
            'translate',
            'rotate',
            'scale',
            'perspective',
            'filter',
            'backdrop-filter',
            'overflow',
            'overflow-x',
            'overflow-y',
            'clip',
            'clip-path',
            'mask-image',
            'will-change',
            'transform-style',
            'content-visibility',
            'zoom',
            'display',
            'visibility',
          ];
          const controls = [
            { name: 'normal', property: 'container-type', value: 'normal' },
            { name: 'inline-size', property: 'container-type', value: 'inline-size' },
            { name: 'layout', property: 'contain', value: 'layout' },
            { name: 'transform', property: 'transform', value: 'translate(23px, 19px)' },
            {
              name: 'inline-layout',
              property: 'container-type',
              value: 'inline-size',
              extra: ['contain', 'layout'],
            },
            {
              name: 'inline-transform',
              property: 'container-type',
              value: 'inline-size',
              extra: ['transform', 'translate(23px, 19px)'],
            },
            {
              name: 'inline-paint',
              property: 'container-type',
              value: 'inline-size',
              extra: ['contain', 'paint'],
            },
            {
              name: 'inline-overflow',
              property: 'container-type',
              value: 'inline-size',
              extra: ['overflow', 'hidden'],
            },
          ];
          const results: Array<Record<string, unknown>> = [];
          const output: Record<string, any> = {
            userAgent: navigator.userAgent,
            timeOrigin: performance.timeOrigin,
            rootFont: getComputedStyle(document.documentElement).fontSize,
            originalScroll,
            viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
            interpretation:
              'native geometry and private capability admission are distinct; inline-size alone may pass only after the document probe, while combined guards stay effective',
            specification: 'https://drafts.csswg.org/css-conditional-5/#container-type',
            hostileProbeCss: hostileStyle.textContent,
            results,
          };
          try {
            for (const control of controls) {
              const scope = document.createElement('div');
              scope.style.cssText =
                'position:relative;width:300px;height:160px;margin:100px 37px;padding:0;border:0;';
              scope.style.setProperty(control.property, control.value);
              if (control.extra) scope.style.setProperty(control.extra[0], control.extra[1]);
              const origin = document.createElement('span');
              const destination = document.createElement('div');
              const child = document.createElement('div');
              child.style.cssText = 'position:fixed;top:13px;left:11px;width:20px;height:20px;';
              destination.append(child);
              scope.append(origin, destination);
              root.append(scope);
              const release = policy.register(scope, destination);
              const sample = () => {
                const bodyChildren = Array.from(document.body.children);
                const focused = document.activeElement;
                const scroll = { x: scrollX, y: scrollY };
                const binding = policy.resolve(origin, child);
                const ancestors = [];
                for (let el: Element | null = destination; el; el = el.parentElement) {
                  const css = getComputedStyle(el);
                  ancestors.push({
                    tag: el.tagName,
                    isControl: el === scope,
                    style: Object.fromEntries(
                      properties.map((key) => [key, css.getPropertyValue(key)])
                    ),
                  });
                }
                return {
                  timestamp: performance.now(),
                  scroll: { x: scrollX, y: scrollY },
                  scope: rect(scope),
                  fixed: rect(child),
                  ancestors,
                  resolver: {
                    probeClean:
                      bodyChildren.length === document.body.children.length &&
                      bodyChildren.every(
                        (element, index) => element === document.body.children[index]
                      ),
                    focusPreserved: focused === document.activeElement,
                    scrollPreserved: scroll.x === scrollX && scroll.y === scrollY,
                    destination:
                      binding.destination === destination
                        ? 'registered'
                        : binding.destination === document.body
                          ? 'body'
                          : 'other',
                    registrationPresent: binding.registration !== null,
                    // The production helper returns no rejection reason. This is
                    // a controlled changed-property experiment, not an API receipt.
                    reportedReason: null,
                  },
                };
              };
              try {
                scrollTo(0, 0);
                await frame();
                const before = sample();
                scrollTo(0, 120);
                await frame();
                const after = sample();
                const delta = after.fixed.top - before.fixed.top;
                const scrollDelta = after.scroll.y - before.scroll.y;
                results.push({
                  ...control,
                  before,
                  after,
                  scrollDelta,
                  fixedTopDelta: delta,
                  nativeClassification:
                    Math.abs(delta) < 0.5
                      ? 'viewport-fixed'
                      : Math.abs(delta + scrollDelta) < 0.5
                        ? 'ancestor-fixed'
                        : 'other',
                  policyReasonEvidence:
                    'only the listed property and optional extra property differ from the normal control',
                });
              } finally {
                release();
                scope.remove();
              }
            }
          } catch (error) {
            output.error = String(error);
          } finally {
            hostileStyle.remove();
            root.remove();
            scrollTo(originalScroll.x, originalScroll.y);
          }
          return output;
        });
        expect((report.result as any).error).toBeUndefined();
        const results = (report.result as any).results;
        expect(results).toHaveLength(8);
        for (const result of results) {
          expect(result.scrollDelta).toBe(120);
          expect(result.before.resolver.registrationPresent).toBe(true);
          expect(result.after.resolver.registrationPresent).toBe(true);
          expect(result.before.resolver.destination).toBe(
            result.name === 'normal' ||
              (result.name === 'inline-size' && result.nativeClassification === 'viewport-fixed')
              ? 'registered'
              : 'body'
          );
          expect(result.after.resolver.destination).toBe(result.before.resolver.destination);
          for (const sample of [result.before, result.after]) {
            expect(sample.resolver.probeClean).toBe(true);
            expect(sample.resolver.focusPreserved).toBe(true);
            expect(sample.resolver.scrollPreserved).toBe(true);
            expect(sample.fixed.width).toBe(20);
            expect(sample.fixed.height).toBe(20);
            expect(Number.isFinite(sample.fixed.top)).toBe(true);
          }
          // Normal, explicit layout containment and transform are semantic controls.
          // The latest Conditional 5 draft removed automatic layout containment
          // from dimensional containers. Do not pre-choose Chromium's result for it.
          if (!['inline-size', 'inline-overflow'].includes(result.name))
            expect(result.nativeClassification).toBe(
              result.name === 'normal' ? 'viewport-fixed' : 'ancestor-fixed'
            );
        }
      } catch (error) {
        report.error = String(error);
        throw error;
      } finally {
        try {
          await retainContainerDiagnostic('native-container-controls', report);
        } finally {
          await context.close();
        }
      }
    }, 60000);

    it('measures the actual docs-shell fixed point with a disposable containment handover', async () => {
      const sourcePaths = [
        'apps/www/src/components/override/PageFrame.astro',
        'apps/www/src/components/override/TwoColumnContent.astro',
        'apps/www/src/styles/global.css',
      ];
      const sources = sourcePaths.map((file) => {
        const text = readFileSync(file, 'utf8');
        return { file, text, sha256: createHash('sha256').update(text).digest('hex') };
      });
      const query = sources[1].text.match(
        /@media \(min-width: ([\d.]+)rem\)\s*\{\s*@container docs-canvas \(max-width: ([\d.]+)rem\)/
      );
      expect(query).not.toBeNull();
      const media = `(min-width: ${query![1]}rem)`;
      const containerRem = Number(query![2]);
      const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
      await context.route('**/*', (route) =>
        new URL(route.request().url()).origin === new URL(baseUrl).origin
          ? route.continue()
          : route.abort()
      );
      const page = await context.newPage();
      await preferences(await context.newCDPSession(page));
      const report: Record<string, any> = {
        checkpoint: 'docs-shell-containment-handover',
        route: '/en/ui-libraries/liquid-glass/dropdown-menu/',
        media,
        containerRem,
        sources,
        cases: [],
        scope:
          'actual documentation DOM/CSS in a separate test-owned page; temporary manual CSS handover only; no observer or production fix',
      };
      observations.push(report);
      try {
        await page.goto(`${baseUrl}${report.route}`, { waitUntil: 'networkidle' });
        await choosePreviewRuntime(page, page.locator('.site-header-runtime').first(), 'wc');
        await waitForPreviewRuntime(page, 'wc', '[aria-haspopup="menu"]', 2);
        await page.evaluate(() => document.fonts.ready.then(() => undefined));
        // Nine bounded cases, not a cross-product. The boundary width is derived
        // below from the actual shell padding/borders at the selected root font.
        for (const control of [
          { name: 'regular', font: 16, zoom: 1 },
          { name: 'large-text', font: 32, zoom: 1 },
          // Chromium's default initial-font control, not the overridden root font.
          { name: 'media-below', font: 32, zoom: 1, viewport: 1279 },
          { name: 'media-at', font: 32, zoom: 1, viewport: 1280 },
          { name: 'media-above', font: 32, zoom: 1, viewport: 1281 },
          { name: 'boundary-below', font: 20, zoom: 1, edge: -1 },
          { name: 'boundary-at', font: 20, zoom: 1, edge: 0 },
          { name: 'boundary-above', font: 20, zoom: 1, edge: 1 },
          { name: 'css-zoom', font: 16, zoom: 1.25 },
        ]) {
          await page.setViewportSize({ width: 1440, height: 1100 });
          const boundary = await page.evaluate(
            ({ font, containerRem }) => {
              const shell = document.querySelector<HTMLElement>('.docs-shell')!;
              const old = document.documentElement.getAttribute('style');
              try {
                document.documentElement.style.setProperty('font-size', `${font}px`, 'important');
                const css = getComputedStyle(shell);
                return (
                  containerRem * font +
                  ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'].reduce(
                    (sum, key) => sum + parseFloat((css as any)[key]),
                    0
                  ) +
                  innerWidth -
                  document.documentElement.clientWidth
                );
              } finally {
                if (old === null) document.documentElement.removeAttribute('style');
                else document.documentElement.setAttribute('style', old);
              }
            },
            { font: control.font, containerRem }
          );
          if ('edge' in control)
            await page.setViewportSize({
              width: Math.round(boundary + control.edge!),
              height: 1100,
            });
          if ('viewport' in control)
            await page.setViewportSize({ width: control.viewport!, height: 1100 });
          const result = await page.evaluate(
            async ({ control, media, containerRem }) => {
              const html = document.documentElement;
              const shell = document.querySelector<HTMLElement>('.docs-shell')!;
              const columns = shell.querySelector<HTMLElement>('.docs-reading-columns')!;
              const toc = columns.querySelector<HTMLElement>('.right-sidebar-container')!;
              const main = columns.querySelector<HTMLElement>('.main-pane')!;
              const originals = {
                rootStyle: html.getAttribute('style'),
                shellStyle: shell.getAttribute('style'),
                scroll: { x: scrollX, y: scrollY },
              };
              const injected = document.createElement('style');
              injected.dataset.portalContainerDiagnostic = '';
              const frame = () =>
                new Promise<void>((resolve, reject) => {
                  const timer = setTimeout(() => {
                    cancelAnimationFrame(id);
                    reject(new Error('diagnostic frame timeout'));
                  }, 2000);
                  const id = requestAnimationFrame(() => {
                    clearTimeout(timer);
                    resolve();
                  });
                });
              const contentRules: string[] = [];
              const searchRules = (rules: CSSRuleList) => {
                for (const rule of rules) {
                  const nested = rule as CSSRule & {
                    containerName?: string;
                    conditionText?: string;
                    cssRules?: CSSRuleList;
                  };
                  if (
                    nested.containerName === 'docs-canvas' &&
                    nested.conditionText?.includes(`${containerRem}rem`)
                  )
                    contentRules.push(
                      ...Array.from(nested.cssRules ?? [], (child) => child.cssText)
                    );
                  else if (nested.cssRules) searchRules(nested.cssRules);
                }
              };
              const rect = (el: Element) => el.getBoundingClientRect().toJSON();
              const sample = () => {
                const css = getComputedStyle(shell);
                const rootFont = parseFloat(getComputedStyle(html).fontSize);
                const contentWidth =
                  parseFloat(css.width) -
                  (css.boxSizing === 'border-box'
                    ? ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'].reduce(
                        (sum, key) => sum + parseFloat((css as any)[key]),
                        0
                      )
                    : 0);
                const mediaMatches = matchMedia(media).matches;
                return {
                  timestamp: performance.now(),
                  rootFont,
                  mediaMatches,
                  contentWidth,
                  threshold: containerRem * rootFont,
                  predicate: mediaMatches && contentWidth <= containerRem * rootFont,
                  viewport: {
                    width: innerWidth,
                    height: innerHeight,
                    clientWidth: html.clientWidth,
                    dpr: devicePixelRatio,
                    visualScale: visualViewport?.scale,
                  },
                  shell: rect(shell),
                  columns: rect(columns),
                  toc: rect(toc),
                  main: rect(main),
                  css: {
                    containerType: css.containerType,
                    contain: css.contain,
                    transform: css.transform,
                    width: css.width,
                    maxWidth: css.maxWidth,
                    paddingLeft: css.paddingLeft,
                    paddingRight: css.paddingRight,
                    boxSizing: css.boxSizing,
                    rootZoom: getComputedStyle(html).zoom,
                    columnsDirection: getComputedStyle(columns).flexDirection,
                    tocPosition: getComputedStyle(toc).position,
                  },
                };
              };
              const result: Record<string, any> = {
                control,
                originals,
                timeOrigin: performance.timeOrigin,
                userAgent: navigator.userAgent,
                inaccessibleSheets: [],
                mediaEdgeAssumption:
                  '1279/1280/1281px probes Chromium default initial font 16px; actual matchMedia is retained independently of root font',
                baseline: [],
                handover: [],
              };
              try {
                for (const sheet of document.styleSheets) {
                  try {
                    searchRules(sheet.cssRules);
                  } catch (error) {
                    result.inaccessibleSheets.push({ href: sheet.href, error: String(error) });
                    throw error;
                  }
                }
                result.copiedRuleCount = contentRules.length;
                if (contentRules.length === 0)
                  throw new Error('Actual docs-canvas CSS rule missing');
                html.style.setProperty('font-size', `${control.font}px`, 'important');
                html.style.setProperty('zoom', String(control.zoom), 'important');
                for (let index = 0; index < 3; index++) {
                  await frame();
                  result.baseline.push(sample());
                }
                const baseline = result.baseline as ReturnType<typeof sample>[];
                const last = baseline.at(-1)!;
                const deltas = baseline.map((entry) => ({
                  predicateChanged: entry.predicate !== last.predicate,
                  maxGeometryDelta: Math.max(
                    Math.abs(entry.contentWidth - last.contentWidth),
                    ...(['shell', 'columns', 'toc', 'main'] as const).flatMap((box) =>
                      ['left', 'top', 'width', 'height'].map((key) =>
                        Math.abs(entry[box][key] - last[box][key])
                      )
                    )
                  ),
                }));
                result.baselineStability = {
                  deltas,
                  stable: deltas.every(
                    (entry) => !entry.predicateChanged && entry.maxGeometryDelta <= 1
                  ),
                };
                result.attribution = result.baselineStability.stable
                  ? 'bounded stable baseline'
                  : 'inconclusive: baseline changed before handover';
                document.head.append(injected);
                shell.style.setProperty('container-type', 'normal', 'important');
                // Deliberately manual and bounded: record each measurement and
                // resulting class of styles, including oscillation rather than
                // installing a ResizeObserver that could hang the test runner.
                for (let index = 0; index < 6; index++) {
                  const before = sample();
                  injected.textContent = before.predicate
                    ? `@media ${media} { ${contentRules.join('\n')} }`
                    : '';
                  await frame();
                  result.handover.push({
                    appliedPredicate: before.predicate,
                    before,
                    after: sample(),
                  });
                }
              } catch (error) {
                result.error = String(error);
              } finally {
                injected.remove();
                for (const [el, old] of [
                  [html, originals.rootStyle],
                  [shell, originals.shellStyle],
                ] as const)
                  if (old === null) el.removeAttribute('style');
                  else el.setAttribute('style', old);
                scrollTo(originals.scroll.x, originals.scroll.y);
                result.restored = {
                  rootStyle: html.getAttribute('style'),
                  shellStyle: shell.getAttribute('style'),
                  injectedStylePresent: injected.isConnected,
                };
              }
              return result;
            },
            { control, media, containerRem }
          );
          result.requestedViewport = page.viewportSize();
          report.cases.push(result);
          await retainContainerDiagnostic('docs-shell-containment-handover', report);
        }
        // Keep all nine observations even if one disproves the handover hypothesis.
        for (const result of report.cases) {
          expect(result.error, result.control.name).toBeUndefined();
          expect(result.restored).toEqual({
            rootStyle: result.originals.rootStyle,
            shellStyle: result.originals.shellStyle,
            injectedStylePresent: false,
          });
          expect(result.baselineStability.stable, result.control.name).toBe(true);
          const baseline = result.baseline.at(-1);
          expect(baseline.css.containerType).toBe('inline-size');
          // Outside the nested query, retain the original upstream layout as
          // observed; do not invent a negative-query column direction.
          if (baseline.predicate) expect(baseline.css.columnsDirection).toBe('column');
          if (result.control.name.startsWith('media-'))
            expect(baseline.mediaMatches).toBe(result.control.name !== 'media-below');
          for (const entry of result.handover.slice(-3)) {
            expect(entry.after.css.containerType).toBe('normal');
            expect(entry.appliedPredicate).toBe(entry.after.predicate);
            expect(entry.after.predicate).toBe(baseline.predicate);
            expect(Math.abs(entry.after.contentWidth - baseline.contentWidth)).toBeLessThanOrEqual(
              0.5
            );
            for (const box of ['shell', 'columns', 'toc', 'main'])
              for (const key of ['left', 'top', 'width', 'height'])
                expect(
                  Math.abs(entry.after[box][key] - baseline[box][key]),
                  `${result.control.name} ${box}.${key}`
                ).toBeLessThanOrEqual(1);
          }
          if (result.control.name.startsWith('boundary-'))
            expect(baseline.contentWidth - baseline.threshold).toBeCloseTo(result.control.edge, 0);
        }
      } catch (error) {
        report.error = String(error);
        throw error;
      } finally {
        try {
          await retainContainerDiagnostic('docs-shell-containment-handover', report);
        } finally {
          await context.close();
        }
      }
    }, 90000);
  }
);

// The scene measures projected flow on rAF. Retain stable closed dimensions,
// not the immediate aria-expanded mutation; viewport coordinates may change
// when the outside-dismissal target scrolls into view.
async function settledPublicLayout(
  page: Page,
  record: Record<string, unknown>,
  expected?: { width: number; height: number }
) {
  let previous: { width: number; height: number } | undefined;
  let final: Awaited<ReturnType<typeof publicPortalSnapshot>> | undefined;
  const samples: Array<{ timestamp: number; width: number; height: number }> = [];
  record.samples = samples;
  await expect
    .poll(
      async () => {
        const snapshot = await publicPortalSnapshot(page);
        const rect = snapshot.scenes[0]?.scope.rect;
        record.final = snapshot;
        final = snapshot;
        if (!rect || rect.width <= 0 || rect.height <= 0) return false;
        const size = { width: rect.width, height: rect.height };
        samples.push({ timestamp: snapshot.timestamp, ...size });
        const near = (other: { width: number; height: number }) =>
          Math.abs(size.width - other.width) <= 1 && Math.abs(size.height - other.height) <= 1;
        const stable = !!previous && near(previous) && (!expected || near(expected));
        previous = size;
        return stable;
      },
      { timeout: 5000, interval: 100 }
    )
    .toBe(true);
  return final!;
}

async function retainContainerDiagnostic(name: string, report: Record<string, unknown>) {
  const directory = evidence ?? process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR;
  if (!directory) return;
  await mkdir(path.join(directory, 'portal'), { recursive: true });
  await writeFile(
    path.join(directory, 'portal', `${name}.json`),
    JSON.stringify(
      {
        sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        sourceTree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim(),
        trackedDiff: execFileSync('git', ['diff', '--name-only', 'HEAD'], {
          encoding: 'utf8',
        }).trim(),
        sourceFiles: [
          'apps/www/src/content/docs/zh-cn/demo-liquid-glass-portal.browser.test.ts',
          'apps/www/src/pages/en/test/liquid-glass-portal.astro',
          'packages/adapters/base/src/platform/portal-destination.ts',
          'packages/adapters/base/src/platform/portal-inline-size.ts',
          'apps/www/src/content/docs/zh-cn/public-portal-diagnostic.ts',
          'apps/www/src/components/PrototypePreviewer/preview-material-scene.ts',
          'packages/adapters/base/src/material/source.ts',
          'packages/adapters/base/src/material/sink.ts',
        ].map((file) => ({
          file,
          sha256: createHash('sha256').update(readFileSync(file)).digest('hex'),
        })),
        node: process.version,
        browser: browser?.version(),
        capturedAt: new Date().toISOString(),
        report,
      },
      null,
      2
    )
  );
}

describe.sequential('real Liquid Dropdown Content in a bounded scene portal', () => {
  for (const runtime of RUNTIMES)
    for (const theme of ['light', 'dark'])
      for (const font of ['regular', 'large'])
        for (const dpr of [1, 2])
          it(`${runtime} ${theme} ${font} DPR${dpr}: actual Content optics and complete source bounds`, async () => {
            const { context, page } = await fixture(runtime, theme, font, dpr);
            try {
              const trigger = await open(page);
              const result = await optical(page);
              const screenshot = await capture(page, `${runtime}-${theme}-${font}-dpr${dpr}`);
              await page.keyboard.press('ArrowDown');
              expect(
                await page
                  .getByRole('menuitem')
                  .evaluateAll((items) => items.some((item) => item === document.activeElement))
              ).toBe(true);
              await page.keyboard.press('Escape');
              await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('false');
              await expect
                .poll(() => trigger.evaluate((el) => el === document.activeElement))
                .toBe(true);
              await open(page);
              await optical(page);
              await page.locator('#outside').click();
              await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('false');
              observations.push({
                runtime,
                theme,
                font,
                dpr,
                ...result,
                screenshot,
                reopen: true,
                escapeFocus: true,
                outsideDismissal: true,
              });
            } finally {
              await context.close();
            }
          }, 90000);
  for (const runtime of RUNTIMES)
    it(`${runtime}: one-pixel source loss, intervening paint, withdrawal, registration revocation/restoration and preferences`, async () => {
      const { context, page, cdp } = await fixture(runtime);
      try {
        const trigger = await open(page);
        await optical(page);
        await page.evaluate(() => (window as any).liquidPortalFixture.undersize(true));
        await expect
          .poll(async () => (await geometry(page)).reason)
          .toBe('source-bounds-unavailable');
        expect((await geometry(page)).image).toBe('none');
        await capture(page, `${runtime}-one-pixel-too-short`);
        await page.evaluate(() => (window as any).liquidPortalFixture.undersize(false));
        await optical(page);
        await page.evaluate(() => (window as any).liquidPortalFixture.overlap(true));
        await expect
          .poll(async () => (await geometry(page)).reason)
          .toBe('source-overlapping-content');
        await page.evaluate(() => (window as any).liquidPortalFixture.overlap(false));
        await optical(page);
        await page.evaluate(() => (window as any).liquidPortalFixture.source(false));
        await expect.poll(async () => (await geometry(page)).quality).toBe('opaque-fallback');
        expect((await geometry(page)).image).toBe('none');
        await page.evaluate(() => (window as any).liquidPortalFixture.source(true));
        await optical(page);
        await page.locator('[data-demo-ref="content"]').evaluate((el) => {
          (el as HTMLElement).style.color = '#ff0000';
        });
        await expect
          .poll(async () => (await geometry(page)).reason)
          .toBe('external-foreground-mismatch');
        expect((await geometry(page)).image).not.toContain('data:image');
        await page.locator('[data-demo-ref="content"]').evaluate((el) => {
          (el as HTMLElement).style.removeProperty('color');
        });
        await optical(page);
        await expect
          .poll(() =>
            page
              .getByRole('menuitem')
              .evaluateAll((items) => items.some((item) => item === document.activeElement))
          )
          .toBe(true);
        const beforeRevocation = await page.evaluate(() =>
          (window as any).liquidPortalFixture.activity()
        );
        expect(beforeRevocation.openChangeCount).toBeGreaterThan(0);
        await page.evaluate(() => {
          const content = document.querySelector('[data-demo-ref="content"]')!;
          (window as any).portalBeforeRevocation = {
            content,
            parent: content.parentElement,
            focus: document.activeElement,
          };
        });
        await page.evaluate(() => (window as any).liquidPortalFixture.destination(false));
        await expect.poll(async () => (await geometry(page)).image).not.toContain('data:image');
        expect((await geometry(page)).quality).not.toBe('self-optical');
        expect((await geometry(page)).fallbackFill).toBe('rgb(255, 255, 255)');
        expect((await geometry(page)).foreground).toBe('rgb(29, 29, 31)');
        expect((await geometry(page)).destinationOwns).toBe(true);
        expect(await trigger.getAttribute('aria-expanded')).toBe('true');
        expect(
          await page.evaluate(() => {
            const old = (window as any).portalBeforeRevocation;
            const content = document.querySelector('[data-demo-ref="content"]');
            return (
              content === old.content &&
              content?.parentElement === old.parent &&
              document.activeElement === old.focus
            );
          })
        ).toBe(true);
        // Observe after the next committed layout/paint boundary as well as
        // the synchronous registration signal; no synthetic focus is sent.
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
            )
        );
        const afterRevocation = await page.evaluate(() =>
          (window as any).liquidPortalFixture.activity()
        );
        expect(afterRevocation.blurCount - beforeRevocation.blurCount).toBe(0);
        expect(afterRevocation.closeCount - beforeRevocation.closeCount).toBe(0);
        expect(afterRevocation.openChangeCount - beforeRevocation.openChangeCount).toBe(0);
        for (const key of ['scrollX', 'scrollY', 'contentScrollTop', 'contentScrollLeft'])
          expect(afterRevocation[key]).toBe(beforeRevocation[key]);
        await capture(page, `${runtime}-registration-pending-opaque`);
        // Only the next attached view resolves the revoked registration. No
        // opened host is moved to body merely to make this test pass.
        const closeProjection = async () => {
          const projection = await page
            .locator('[data-demo-ref="content"]')
            .evaluateHandle((content) => ({ content, parent: content.parentElement }));
          try {
            await page.keyboard.press('Escape');
            await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('false');
            // Logical close can precede conceal and physical projection retirement.
            await expect
              .poll(() =>
                projection.evaluate(
                  ({ content, parent }) => !content.isConnected || content.parentElement !== parent
                )
              )
              .toBe(true);
          } finally {
            await projection.dispose();
          }
        };
        await closeProjection();
        await expect.poll(() => trigger.evaluate((el) => el === document.activeElement)).toBe(true);
        await open(page);
        await expect
          .poll(() =>
            page.locator('[data-demo-ref="content"]').evaluate((el, runtime) => {
              const parent = el.parentElement!;
              if (runtime !== 'react') return parent === document.body;
              return (
                parent.matches('[data-pui-portal-mount]') && parent.parentElement === document.body
              );
            }, runtime)
          )
          .toBe(true);
        if (runtime === 'react') {
          const carrier = page.locator('[data-pui-portal-mount]');
          expect(await carrier.count()).toBe(1);
          expect(
            await carrier.evaluate((el) => ({
              display: getComputedStyle(el).display,
              role: el.getAttribute('role'),
              tabIndex: el.getAttribute('tabindex'),
              background: getComputedStyle(el).backgroundImage,
            }))
          ).toEqual({ display: 'contents', role: null, tabIndex: null, background: 'none' });
        }
        expect(await trigger.getAttribute('aria-expanded')).toBe('true');
        expect((await geometry(page)).image).not.toContain('data:image');
        expect((await geometry(page)).admission.reason).toBe('source-scope-unavailable');
        await closeProjection();
        await page.evaluate(() => (window as any).liquidPortalFixture.destination(true));
        await open(page);
        await optical(page);
        expect(await trigger.getAttribute('aria-expanded')).toBe('true');
        for (const override of [
          { 'prefers-reduced-transparency': 'reduce' },
          { 'forced-colors': 'active' },
        ] as Record<string, string>[]) {
          await preferences(cdp, 'light', override);
          try {
            await expect
              .poll(async () => (await geometry(page)).quality, {
                message: `${runtime} preference ${JSON.stringify(override)}`,
              })
              .toBe('opaque-fallback');
            expect((await geometry(page)).image).toBe('none');
            expect((await geometry(page)).reason).toBe('transparency-or-contrast-override');
          } finally {
            // Retain the failing iteration too: the old all-or-nothing journey
            // record could not distinguish reduced transparency from UA colors.
            const snapshot = await geometry(page);
            const forcedColorAdjust = await page
              .locator('[data-demo-ref="content"]')
              .evaluate((el) => getComputedStyle(el).forcedColorAdjust);
            observations.push({
              runtime,
              checkpoint: 'preference-fallback',
              override,
              forcedColorAdjust,
              snapshot,
            });
            await capture(page, `${runtime}-preference-${Object.keys(override)[0]}`);
          }
          await preferences(cdp);
          await optical(page);
        }
        await page.evaluate(() => (window as any).liquidPortalFixture.dispose());
        expect(await page.locator('[data-demo-ref="content"]').count()).toBe(0);
        expect(await page.locator('[data-material-scene]').count()).toBe(0);
        observations.push({
          runtime,
          onePixelRejected: true,
          overlapRejected: true,
          foregroundMismatchRejected: true,
          sourceRecovered: true,
          destinationRegistrationDeferredUntilReopen: true,
          pendingPreservedContentParentFocusAndOpen: true,
          beforeRevocation,
          afterRevocation,
          preferencesFallback: true,
          disposed: true,
        });
      } finally {
        await context.close();
      }
    }, 90000);
  it('DPR4 enlarged-font source stays opaque when the genuine scene exceeds pixel budget', async () => {
    const { context, page } = await fixture('wc', 'light', 'large', 4);
    try {
      await open(page);
      await expect.poll(async () => (await geometry(page)).quality).toBe('opaque-fallback');
      const result = await geometry(page);
      expect(
        Math.ceil(result.canvas.width * result.dpr) * Math.ceil(result.canvas.height * result.dpr)
      ).toBeGreaterThan(1048576);
      expect(result.source).toBeNull();
      expect(result.image).toBe('none');
      observations.push({ ...result, image: undefined, overBudgetFallback: true });
    } finally {
      await context.close();
    }
  }, 90000);
  // The public demo is an acceptance target too. A small owned fixture cannot
  // substitute for the originally reported documentation route.
  for (const runtime of RUNTIMES)
    for (const locale of ['en', 'zh-cn'])
      for (const theme of ['light', 'dark'])
        it(`${runtime} ${locale} ${theme}: public Dropdown preview has optical portal Content`, async () => {
          const context: BrowserContext = await browser.newContext({
            viewport: { width: 1440, height: 1100 },
          });
          await context.route('**/*', (route) =>
            new URL(route.request().url()).origin === new URL(baseUrl).origin
              ? route.continue()
              : route.abort()
          );
          const page = await context.newPage();
          const cdp = await context.newCDPSession(page);
          await preferences(cdp, theme);
          const layoutEvidence: Record<string, unknown> = { runtime, locale, theme };
          try {
            await page.goto(`${baseUrl}/${locale}/ui-libraries/liquid-glass/dropdown-menu/`, {
              waitUntil: 'networkidle',
            });
            const preview = page.locator('[data-previewer-id]').first();
            await choosePreviewRuntime(page, page.locator('.site-header-runtime').first(), runtime);
            // This public route owns one generic Previewer, not AdapterPanel.
            // Require its actual committed runtime and both authored menu triggers.
            await waitForPreviewRuntime(page, runtime, '[aria-haspopup="menu"]', 2);
            const trigger = preview.getByRole('button', { name: 'Open menu', exact: true });
            await page.evaluate(() => {
              (window as any).publicPortalFirstFocus = null;
              document.addEventListener(
                'focusin',
                (event) => {
                  if ((window as any).publicPortalFirstFocus || !(event.target instanceof Element))
                    return;
                  const menu = event.target.closest('[role="menu"]');
                  if (!menu) return;
                  const parent = menu.parentElement;
                  const destination = parent?.matches('[data-pui-portal-mount]')
                    ? parent.parentElement
                    : parent;
                  (window as any).publicPortalFirstFocus = {
                    scopeContains: !!menu.closest('[data-material-scene]'),
                    destinationOwns: !!menu.closest('[data-material-overlay-mount]'),
                    physicalDestinationIsOverlay: !!destination?.matches(
                      '[data-material-overlay-mount]'
                    ),
                    contentConnected: menu.isConnected,
                  };
                },
                true
              );
            });
            let closedSize: { width: number; height: number } | undefined;
            if (evidence) {
              const closed: Record<string, unknown> = {};
              layoutEvidence.closed = closed;
              const snapshot = await settledPublicLayout(page, closed);
              closedSize = snapshot.scenes[0].scope.rect;
            }
            await trigger.click();
            const content = page.getByRole('menu');
            await content.waitFor({ state: 'visible' });
            await expect
              .poll(() => content.getAttribute('data-material-quality'), { timeout: 20000 })
              .toBe('self-optical');
            if (evidence) layoutEvidence.open = await publicPortalSnapshot(page);
            expect(
              await content.evaluate((el) => el.closest('[data-material-scene]') !== null)
            ).toBe(true);
            expect(
              await content.evaluate((el) => (el as HTMLElement).style.backgroundImage)
            ).toContain('data:image/png');
            await expect
              .poll(() => page.evaluate(() => (window as any).publicPortalFirstFocus))
              .toEqual({
                scopeContains: true,
                destinationOwns: true,
                physicalDestinationIsOverlay: true,
                contentConnected: true,
              });
            const firstFocus = await page.evaluate(() => (window as any).publicPortalFirstFocus);
            if (evidence) {
              await mkdir(path.join(evidence, 'portal'), { recursive: true });
              await preview.screenshot({
                path: path.join(
                  evidence,
                  'portal',
                  `${runtime}-${locale}-${theme}-public-dropdown.png`
                ),
              });
            }
            await page.keyboard.press('ArrowDown');
            expect(
              await content
                .getByRole('menuitem')
                .evaluateAll((items) => items.some((item) => item === document.activeElement))
            ).toBe(true);
            await page.keyboard.press('Escape');
            await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('false');
            await expect
              .poll(() => trigger.evaluate((el) => el === document.activeElement))
              .toBe(true);
            await trigger.click();
            await expect
              .poll(() => content.getAttribute('data-material-quality'))
              .toBe('self-optical');
            await page.locator('h1').first().click();
            await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('false');
            if (evidence) {
              const restored: Record<string, unknown> = {};
              layoutEvidence.closedAfterDismissal = restored;
              await settledPublicLayout(page, restored, closedSize);
              await retainContainerDiagnostic(
                `${runtime}-${locale}-${theme}-public-dropdown-layout`,
                layoutEvidence
              );
            }
            observations.push({
              runtime,
              route: `/${locale}/ui-libraries/liquid-glass/dropdown-menu/`,
              theme,
              publicContentOptical: true,
              firstFocus,
              escapeFocus: true,
              reopenedOptical: true,
              outsideDismissal: true,
            });
          } catch (error) {
            // Retain the failing original route before context teardown. Evidence
            // errors are separate and must never replace the acceptance failure.
            const name = `${runtime}-${locale}-${theme}-public-dropdown-failure`;
            const report: Record<string, unknown> = {
              runtime,
              locale,
              theme,
              error: String(error),
              layoutEvidence,
            };
            try {
              report.snapshot = await publicPortalSnapshot(page);
            } catch (snapshotError) {
              report.snapshotError = String(snapshotError);
            }
            if (evidence) {
              try {
                await mkdir(path.join(evidence, 'portal'), { recursive: true });
                const buffer = await page.screenshot({
                  path: path.join(evidence, 'portal', `${name}.png`),
                  timeout: 5000,
                });
                report.screenshot = {
                  file: `portal/${name}.png`,
                  sha256: createHash('sha256').update(buffer).digest('hex'),
                };
              } catch (screenshotError) {
                report.screenshotError = String(screenshotError);
              }
              try {
                await retainContainerDiagnostic(name, report);
              } catch (evidenceError) {
                console.error(
                  'Public Dropdown failure evidence could not be retained',
                  evidenceError
                );
              }
            }
            throw error;
          } finally {
            await context.close();
          }
        }, 90000);
});
