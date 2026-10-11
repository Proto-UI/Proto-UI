// @vitest-environment node
// Official real-browser geometry and input evidence, separate from source-host tests.
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
  selectRuntime,
  applyColorScheme,
} from './browser-harness';

const families = ['shadcn', 'brutalist'] as const;
type Family = (typeof families)[number];
const routeFor = (family: Family) =>
  `/en/ui-libraries/${family === 'brutalist' ? 'brutalist/components' : family}/drawer/`;
const output =
  process.env.PUI_FINF_FEATURE_EVIDENCE_DIR ?? path.join(tmpdir(), 'pui-drawer-command-density');
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
  shadcn: 'internal/contracts/overlay/shadcn-drawer-command-density.presentation.v0.md',
  brutalist: 'internal/contracts/overlay/brutalist-drawer-command-density.presentation.v0.md',
  adaptation:
    'Upstream fixed h-8/h-10 and nowrap become local minimum heights and wrapping. This is bounded density, not full upstream paint parity or a 44px target guarantee.',
};
const writeJson = (name: string, value: unknown) =>
  writeFile(path.join(output, name), JSON.stringify(value, null, 2) + '\n');
let browser: Browser;
let baseUrl = '';

beforeAll(async () => {
  await mkdir(output, { recursive: true });
  const sourceHashes: Record<string, string> = {};
  for (const file of [
    references.shadcn,
    references.brutalist,
    ...families.flatMap((family) =>
      ['trigger', 'close'].map(
        (part) => `packages/prototypes/${family}/src/drawer/${part}.proto.ts`
      )
    ),
    'apps/www/src/content/docs/zh-cn/finf-drawer-command-density.browser.test.ts',
  ])
    sourceHashes[file] = createHash('sha256')
      .update(await readFile(file))
      .digest('hex');
  await writeJson('drawer-command-density-source.json', {
    candidate,
    references,
    sourceHashes,
    routes: families.map(routeFor),
    expectedCases: families.length * RUNTIMES.length * COLOR_SCHEMES.length * scenarios.length,
    phase: 'Planned; only terminal case receipts prove execution.',
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
    browser = await chromium.launch({
      executablePath: await chromeExecutable(),
      headless: true,
      chromiumSandbox: true,
      args: ['--disable-dev-shm-usage'],
    });
  } catch (error) {
    await writeJson('drawer-command-density-setup.json', {
      candidate,
      result: 'blocked-before-browser',
      error: String(error),
      screenshots: [],
      unexecuted: [
        '112 family/runtime/theme/scenario cases',
        'actual DOM/computed geometry',
        'root32 typography',
        'pointer hit samples and activation',
        'Close/reopen/Escape',
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

async function metrics(locator: Locator) {
  return locator.evaluate((element) => {
    const rectOf = (node: Element) => {
      const r = node.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    const describe = (node: Element) => {
      const css = getComputedStyle(node),
        html = node as HTMLElement;
      return {
        tag: node.tagName,
        role: node.getAttribute('role'),
        id: node.id,
        tokens: node.getAttribute('data-pui-style'),
        rect: rectOf(node),
        cssHeight: css.height,
        minHeight: css.minHeight,
        maxHeight: css.maxHeight,
        cssWidth: css.width,
        boxSizing: css.boxSizing,
        display: css.display,
        padding: [css.paddingTop, css.paddingRight, css.paddingBottom, css.paddingLeft],
        border: [
          css.borderTopWidth,
          css.borderRightWidth,
          css.borderBottomWidth,
          css.borderLeftWidth,
        ],
        radii: [
          css.borderTopLeftRadius,
          css.borderTopRightRadius,
          css.borderBottomRightRadius,
          css.borderBottomLeftRadius,
        ],
        radiusToken: css.getPropertyValue('--pui-radius-lg').trim(),
        baseRadiusToken: css.getPropertyValue('--pui-radius').trim(),
        whiteSpace: css.whiteSpace,
        overflowWrap: css.overflowWrap,
        textAlign: css.textAlign,
        overflowX: css.overflowX,
        overflowY: css.overflowY,
        boxShadow: css.boxShadow,
        fontSize: css.fontSize,
        lineHeight: css.lineHeight,
        fontWeight: css.fontWeight,
        fontFamily: css.fontFamily,
        availableParentWidth: node.parentElement?.getBoundingClientRect().width ?? null,
        parentFont: node.parentElement
          ? {
              size: getComputedStyle(node.parentElement).fontSize,
              lineHeight: getComputedStyle(node.parentElement).lineHeight,
              family: getComputedStyle(node.parentElement).fontFamily,
            }
          : null,
        offset: { width: html.offsetWidth, height: html.offsetHeight },
        client: { width: html.clientWidth, height: html.clientHeight },
        scroll: { width: html.scrollWidth, height: html.scrollHeight },
      };
    };
    return {
      control: describe(element),
      shadowSurfaces: Array.from(
        element.shadowRoot?.querySelectorAll('[data-pui-split-surface],button,[role="button"]') ??
          []
      ).map(describe),
      rootFont: getComputedStyle(document.documentElement).fontSize,
    };
  });
}
function assertDensity(
  actual: Awaited<ReturnType<typeof metrics>>,
  family: Family,
  long: boolean,
  multiline = long
) {
  const c = actual.control,
    rem = Number.parseFloat(actual.rootFont);
  const neo = family === 'brutalist',
    minimum = (neo ? 2.5 : 2) * rem;
  expect(c.boxSizing).toBe('border-box');
  expect(Number.parseFloat(c.minHeight)).toBeCloseTo(minimum, 4);
  expect(c.maxHeight).toBe('none');
  if (long || multiline) expect(c.rect.height).toBeGreaterThan(minimum);
  else expect(c.rect.height).toBeCloseTo(minimum, 4);
  expect(c.padding.map(Number.parseFloat)).toEqual(
    neo ? [rem / 2, rem, rem / 2, rem] : [0, rem * 0.625, 0, rem * 0.625]
  );
  expect(c.border.map(Number.parseFloat)).toEqual(neo ? [2, 2, 2, 2] : [1, 1, 1, 1]);
  expect(Number.parseFloat(c.fontSize)).toBeCloseTo(rem * 0.875, 4);
  expect(Number.parseFloat(c.lineHeight)).toBeCloseTo(rem * 1.25, 4);
  expect(c.fontWeight).toBe('500');
  expect(c.fontFamily).toBe(c.parentFont?.family);
  const radius = (neo ? c.baseRadiusToken : c.radiusToken).match(/^([\d.]+)(px|rem)$/);
  expect(radius).not.toBeNull();
  const radiusPx = Number(radius![1]) * (radius![2] === 'rem' ? rem : 1);
  if (neo) expect(radiusPx).toBe(5);
  for (const value of c.radii) expect(Number.parseFloat(value)).toBeCloseTo(radiusPx, 4);
  expect(c.whiteSpace).toBe('normal');
  expect(c.overflowWrap).toBe('anywhere');
  expect(c.textAlign).toBe('center');
  expect(c.scroll.width).toBeLessThanOrEqual(c.client.width + 1);
  expect(c.scroll.height).toBeLessThanOrEqual(c.client.height + 1);
}
async function hitSamples(locator: Locator) {
  return locator.evaluate((control) => {
    const rect = control.getBoundingClientRect();
    const points = [
      ['center', rect.x + rect.width / 2, rect.y + rect.height / 2],
      ['top-inset', rect.x + rect.width / 2, rect.y + 2],
      ['bottom-inset', rect.x + rect.width / 2, rect.bottom - 2],
      ['left-inset', rect.x + 2, rect.y + rect.height / 2],
      ['right-inset', rect.right - 2, rect.y + rect.height / 2],
      ['above', rect.x + rect.width / 2, rect.y - 2],
      ['below', rect.x + rect.width / 2, rect.bottom + 2],
    ] as const;
    const belongs = (node: Element | null) => {
      for (let current = node; current; ) {
        if (current === control) return true;
        current = current.parentElement ?? ((current.getRootNode() as ShadowRoot).host || null);
      }
      return false;
    };
    return points.map(([name, x, y]) => {
      let node = document.elementFromPoint(x, y);
      const chain = [];
      while (node) {
        chain.push({
          tag: node.tagName,
          role: node.getAttribute('role'),
          id: node.id,
          text: node.textContent?.slice(0, 100),
        });
        const deep = node.shadowRoot?.elementFromPoint(x, y);
        if (!deep || deep === node) break;
        node = deep;
      }
      return { name, x, y, belongsToControl: belongs(node), chain };
    });
  });
}
async function clickTopInset(page: Page, locator: Locator, receipts: unknown[], stage: string) {
  await locator.scrollIntoViewIfNeeded();
  const hit = (await hitSamples(locator)).find((sample) => sample.name === 'top-inset');
  const receipt = {
    stage,
    input: 'page.mouse.click',
    x: hit?.x ?? null,
    y: hit?.y ?? null,
    preClickHit: hit ?? null,
    completed: false,
  };
  receipts.push(receipt);
  expect(hit?.belongsToControl, 'Actual border-box inset coordinate must hit this command.').toBe(
    true
  );
  if (!hit) throw new Error('Command has no top-inset sample.');
  // Locator click coordinates use the padding box. Send the measured global
  // border-box point directly so the hit sample and actual input are identical.
  await page.mouse.click(hit.x, hit.y);
  receipt.completed = true;
}
async function panelFor(page: Page, trigger: Locator) {
  await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('true');
  const id = await trigger.getAttribute('aria-controls');
  if (!id) throw new Error('Trigger must identify its Content.');
  const panel = page.locator(`[id=${JSON.stringify(id)}][role="dialog"]`);
  await panel.waitFor({ state: 'visible' });
  return panel;
}

// Long labels are consumer inputs through the normal renderer, never textContent
// replacement, synthetic component listeners, or a private business-logic model.
async function mountLongLabel(
  page: Page,
  family: Family,
  runtime: (typeof RUNTIMES)[number],
  label: string,
  width: number
) {
  return page.evaluateHandle(
    async ({ family, runtime, label, width }) => {
      const browserImport = new Function('url', 'return import(url)') as (
        url: string
      ) => Promise<unknown>;
      const { renderDemo } = (await browserImport(
        '/src/components/PrototypePreviewer/demo-renderer.ts'
      )) as typeof import('../../../components/PrototypePreviewer/demo-renderer');
      const { default: original } = (await browserImport(
        `/src/content/docs/demo-${family}-drawer.demo.ts`
      )) as { default: import('../../../components/PrototypePreviewer/demo-types').DemoSpec };
      const demo = { ...original, root: structuredClone(original.root) };
      type Child = import('../../../components/PrototypePreviewer/demo-types').DemoChild;
      function transform(node: Child): Child {
        if (typeof node === 'string' || node.kind === 'text') return node;
        if (node.kind === 'proto' && /-drawer-(trigger|close)$/.test(node.prototypeId)) {
          node.ref = node.prototypeId.endsWith('trigger') ? 'density-trigger' : 'density-close';
          node.children = [label];
          return {
            kind: 'box',
            attrs: { style: `width: ${width}px; max-width: 100%; min-width: 0` },
            children: [node],
          };
        }
        if (node.children) node.children = node.children.map(transform);
        return node;
      }
      demo.root = transform(demo.root) as typeof demo.root;
      const surface = document.querySelector('[data-previewer-id] [data-projection-content]');
      if (!surface) throw new Error('Public preview theme surface missing');
      const host = document.createElement('div');
      host.dataset.drawerDensityFixture = '';
      // A documented consumer viewport lane avoids the documentation article's
      // own enlarged-text padding consuming the promised 160/240px test width.
      // Only this host box changes; command and panel recipes are untouched.
      host.style.cssText = 'width: calc(100% - 32px); margin: 16px; min-width: 0';
      document.body.append(host);
      if (demo.root.kind === 'box')
        demo.root.attrs = { ...demo.root.attrs, style: 'padding: 0; min-width: 0; width: 100%' };
      const { createProjectionComposition } = (await browserImport(
        '/src/components/PrototypePreviewer/projection-composition.ts'
      )) as typeof import('../../../components/PrototypePreviewer/projection-composition');
      const { resolveProjectionThemeSurfaceStyle } = (await browserImport(
        '/src/components/PrototypePreviewer/projection-theme.ts'
      )) as typeof import('../../../components/PrototypePreviewer/projection-theme');
      const { collectPrototypeIds } = (await browserImport(
        '/src/components/PrototypePreviewer/demo-types.ts'
      )) as typeof import('../../../components/PrototypePreviewer/demo-types');
      const prototypeIds = new Set<string>();
      collectPrototypeIds(demo.root, prototypeIds);
      // The normal Website contentRecipe channel supplies all portal theme and
      // family coordinates. Button is only the existing registered scope shell;
      // this explicit recipe contains real Drawer prototypes, never Button logic.
      const composition = createProjectionComposition({
        ownerId: 'drawer-density-fixture',
        runtimeId: runtime,
        projectionFamilyId: family,
        generation: 1,
        componentId: 'button',
        childDemo: demo,
        controlIds: [],
        contentRecipe: {
          id: `demo-${family}-drawer-density`,
          prototypeIds: [...prototypeIds],
          rootPrototypeId: `${family}-drawer-root`,
        },
        themeSurfaceStyle: resolveProjectionThemeSurfaceStyle(family, surface),
        controls: {
          runtime: {
            label: 'Runtime',
            options: [{ label: runtime, value: runtime }],
            onValueChange() {},
          },
          family: {
            label: 'Family',
            options: [{ label: family, value: family }],
            onValueChange() {},
          },
          component: {
            label: 'Component',
            options: [{ label: 'Drawer content recipe', value: 'button' }],
            onValueChange() {},
          },
        },
      });
      const view = await renderDemo({ host, demo: composition.demo, runtime });
      return {
        destroy: async () => {
          await view.destroy();
          host.remove();
        },
      };
    },
    { family, runtime, label, width }
  );
}

async function actualFonts(context: BrowserContext, page: Page, locator: Locator) {
  // Instrumentation only: CDP resolves the real control and its shadow descendants.
  const marker = `font-${Math.random().toString(36).slice(2)}`;
  await locator.evaluate(
    (element, marker) => element.setAttribute('data-density-font-probe', marker),
    marker
  );
  const client = await context.newCDPSession(page);
  try {
    await client.send('DOM.enable');
    await client.send('CSS.enable');
    const { nodes } = await client.send('DOM.getFlattenedDocument', { depth: -1, pierce: true });
    const root = nodes.find((node) =>
      node.attributes?.some(
        (value, i, attrs) => value === 'data-density-font-probe' && attrs[i + 1] === marker
      )
    );
    if (!root) throw new Error('CDP did not resolve command');
    const ids = new Set([root.nodeId]);
    // Flattened order is not assumed to be parent-first.
    for (let changed = true; changed; ) {
      changed = false;
      for (const node of nodes) {
        if (node.parentId && ids.has(node.parentId) && !ids.has(node.nodeId)) {
          ids.add(node.nodeId);
          changed = true;
        }
        if (ids.has(node.nodeId))
          for (const shadow of node.shadowRoots ?? [])
            if (!ids.has(shadow.nodeId)) {
              ids.add(shadow.nodeId);
              changed = true;
            }
      }
    }
    const fonts = [];
    for (const node of nodes.filter((node) => ids.has(node.nodeId) && node.nodeType === 1))
      fonts.push(
        ...(await client.send('CSS.getPlatformFontsForNode', { nodeId: node.nodeId })).fonts
      );
    return fonts;
  } finally {
    await client.detach();
    await locator.evaluate((element) => element.removeAttribute('data-density-font-probe'));
  }
}

async function textBounds(locator: Locator) {
  return locator.evaluate((control) => {
    const rect = control.getBoundingClientRect();
    const css = getComputedStyle(control);
    const lines: {
      x: number;
      y: number;
      right: number;
      bottom: number;
      width: number;
      height: number;
    }[] = [];
    const visit = (root: Node) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.textContent?.trim() || node.parentElement?.closest('style,script')) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const r of range.getClientRects())
          if (r.width && r.height)
            lines.push({
              x: r.x,
              y: r.y,
              right: r.right,
              bottom: r.bottom,
              width: r.width,
              height: r.height,
            });
      }
      if (root instanceof Element) {
        if (root.shadowRoot) visit(root.shadowRoot);
        for (const child of root.querySelectorAll('*'))
          if (child.shadowRoot) visit(child.shadowRoot);
      }
    };
    visit(control);
    return {
      lines,
      bounds: {
        x: rect.x + parseFloat(css.borderLeftWidth),
        y: rect.y + parseFloat(css.borderTopWidth),
        right: rect.right - parseFloat(css.borderRightWidth),
        bottom: rect.bottom - parseFloat(css.borderBottomWidth),
      },
    };
  });
}

const scenarios = [
  { id: 'default', root: 16, viewport: 1280, label: '' },
  { id: 'root32-narrow', root: 32, viewport: 320, label: '' },
  { id: 'root32-wide', root: 32, viewport: 1280, label: '' },
  ...([16, 32] as const).flatMap((root) => [
    {
      id: `sentence-root${root}`,
      root,
      viewport: 320,
      label: 'Save drawer settings with a readable label. '.repeat(3),
    },
    {
      id: `unbroken-root${root}`,
      root,
      viewport: 320,
      label: 'DrawerSettingsIdentifierWithoutAnySpaces'.repeat(3),
    },
  ]),
];
for (const family of families)
  for (const runtime of RUNTIMES)
    for (const scheme of COLOR_SCHEMES)
      for (const scenario of scenarios) {
        const id = `drawer-density-${family}-${runtime}-${scheme}-${scenario.id}`;
        it(
          id,
          async () => {
            let context: BrowserContext | undefined, page: Page | undefined;
            let fixture: Awaited<ReturnType<typeof mountLongLabel>> | undefined;
            let stage = 'created',
              result = 'failed',
              failure: string | undefined;
            const observations: Record<string, unknown> = {},
              screenshots: unknown[] = [],
              pointerInputs: unknown[] = [];
            const errors: string[] = [],
              deniedRequests: string[] = [];
            try {
              context = await browser.newContext({
                viewport: { width: scenario.viewport, height: 1000 },
                colorScheme: scheme,
                reducedMotion: 'reduce',
                locale: 'en-US',
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
                  bytes = await page!.screenshot({ path: path.join(output, file) });
                screenshots.push({
                  candidate,
                  state,
                  file,
                  sha256: createHash('sha256').update(bytes).digest('hex'),
                  capturedAt: new Date().toISOString(),
                  environment: await page!.evaluate(() => ({
                    viewport: { width: innerWidth, height: innerHeight },
                    dpr: devicePixelRatio,
                    fonts: document.fonts.status,
                    rootFont: getComputedStyle(document.documentElement).fontSize,
                  })),
                });
              };
              stage = 'navigate';
              expect(
                (
                  await page.goto(baseUrl + routeFor(family), { waitUntil: 'networkidle' })
                )?.status()
              ).toBe(200);
              const previewer = page.locator('[data-previewer-id]').first();
              await previewer.scrollIntoViewIfNeeded();
              await selectRuntime(page, previewer, runtime, '[data-demo-ref="root"]', 1);
              await applyColorScheme(page, scheme);
              await page.evaluate((root) => {
                document.documentElement.style.fontSize = `${root}px`;
              }, scenario.root);
              const width = scenario.root === 16 ? 160 : 240;
              if (scenario.label)
                fixture = await mountLongLabel(page, family, runtime, scenario.label, width);
              await page.evaluate(() => document.fonts.ready);
              const trigger = scenario.label
                ? page.locator('[data-drawer-density-fixture] [data-demo-ref="density-trigger"]')
                : previewer.getByRole('button', { name: 'Open Drawer', exact: true });
              const record = async (name: string, control: Locator) => {
                await control.scrollIntoViewIfNeeded();
                const actual = await metrics(control),
                  fonts = await actualFonts(context!, page!, control),
                  text = await textBounds(control),
                  hits = await hitSamples(control);
                observations[name] = { actual, fonts, text, hits };
                expect(actual.rootFont).toBe(`${scenario.root}px`);
                const lineCount = new Set(text.lines.map((line) => Math.round(line.y))).size;
                assertDensity(actual, family, Boolean(scenario.label), lineCount > 1);
                if (scenario.viewport === 1280) expect(lineCount).toBe(1);
                expect(fonts.some((font) => font.glyphCount > 0)).toBe(true);
                // Density preserves the consumer's inherited font family. CDP
                // records the actual painted face; a theme token does not prove
                // DM Sans selection and this slice adds no such requirement.
                expect(text.lines.length).toBeGreaterThan(0);
                for (const line of text.lines) {
                  expect(line.x).toBeGreaterThanOrEqual(text.bounds.x - 1);
                  expect(line.right).toBeLessThanOrEqual(text.bounds.right + 1);
                  expect(line.y).toBeGreaterThanOrEqual(text.bounds.y - 1);
                  expect(line.bottom).toBeLessThanOrEqual(text.bounds.bottom + 1);
                }
                if (scenario.label) {
                  expect(actual.control.availableParentWidth).toBeCloseTo(width, 3);
                  expect(actual.control.rect.width).toBeLessThanOrEqual(width + 1);
                  expect(
                    new Set(text.lines.map((line) => Math.round(line.y))).size
                  ).toBeGreaterThan(1);
                }
                for (const hit of hits)
                  if (hit.name.endsWith('inset') || hit.name === 'center')
                    expect(hit.belongsToControl).toBe(true);
                for (const hit of hits)
                  if (hit.name === 'above' || hit.name === 'below')
                    expect(hit.belongsToControl).toBe(false);
                await capture(name);
              };
              stage = 'trigger';
              await record(stage, trigger);
              await clickTopInset(page, trigger, pointerInputs, 'open');
              const panel = await panelFor(page, trigger);
              const close = scenario.label
                ? panel.locator('[data-demo-ref="density-close"]')
                : panel.getByRole('button', { name: 'Close', exact: true });
              stage = 'close';
              await record(stage, close);
              if (family === 'brutalist') {
                const closePaint = await metrics(close);
                for (const surface of [closePaint.control, ...closePaint.shadowSurfaces]) {
                  // Preserve existing focus-ring spread while rejecting an
                  // offset or blurred elevation shadow on this Close consumer.
                  for (const shadow of surface.boxShadow.split(/,(?![^()]*\))/)) {
                    const lengths = shadow.match(/-?[\d.]+px/g) ?? [];
                    expect(
                      lengths.slice(0, 3).every((length) => Number.parseFloat(length) === 0)
                    ).toBe(true);
                  }
                }
              }
              // Focus rings may be zero-radius box shadows; never infer upstream noShadow
              // from a token. Retain actual boxShadow and surface metrics for review.
              await clickTopInset(page, close, pointerInputs, 'close');
              await panel.waitFor({ state: 'hidden' });
              await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('false');
              stage = 'reopen-escape';
              await clickTopInset(page, trigger, pointerInputs, 'reopen');
              await panelFor(page, trigger);
              await page.keyboard.press('Escape');
              await panel.waitFor({ state: 'hidden' });
              await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('false');
              await capture('closed');
              if (fixture) {
                await fixture.evaluate((view) => view.destroy());
                await fixture.dispose();
                fixture = undefined;
                expect(await page.locator('[data-drawer-density-fixture]').count()).toBe(0);
                await expect.poll(() => panel.count()).toBe(0);
              }
              expect(errors).toEqual([]);
              expect(deniedRequests).toEqual([]);
              result = 'passed';
            } catch (error) {
              failure = String(error);
              if (page)
                try {
                  const file = `${id}-failure.png`,
                    bytes = await page.screenshot({
                      path: path.join(output, file),
                      timeout: 5_000,
                    });
                  screenshots.push({
                    candidate,
                    stage,
                    file,
                    sha256: createHash('sha256').update(bytes).digest('hex'),
                  });
                } catch (captureError) {
                  errors.push(`failure capture: ${String(captureError)}`);
                }
              throw error;
            } finally {
              try {
                await writeJson(`${id}.json`, {
                  candidate,
                  references,
                  family,
                  runtime,
                  scheme,
                  scenario,
                  stage,
                  result,
                  failure,
                  observations,
                  screenshots,
                  pointerInputs,
                  errors,
                  deniedRequests,
                  browser: browser.version(),
                  limit:
                    'Root scaling is not browser zoom. Long-label fixture changes only consumer text and container width. No full paint, GPUI, or complete accessibility certification.',
                });
              } finally {
                await context?.close();
              }
            }
          },
          120_000
        );
      }
