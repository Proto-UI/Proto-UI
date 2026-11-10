// @vitest-environment node
// Planned native evidence for issue.1097.002. Execution belongs to the official runner.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import type { Browser, BrowserContext, JSHandle, Locator, Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type * as DemoRenderer from '../../../components/PrototypePreviewer/demo-renderer';
import type { DemoChild, DemoRenderResult, DemoSpec } from '../../../components/PrototypePreviewer/demo-types';
import type * as DemoTypes from '../../../components/PrototypePreviewer/demo-types';
import type * as PrototypeModules from '../../../components/PrototypePreviewer/prototype-modules';
import type * as ProjectionTheme from '../../../components/PrototypePreviewer/projection-theme';
import type * as RuntimePreviewSurface from '../../../components/PrototypePreviewer/runtime-preview-surface';
import {
  COLOR_SCHEMES,
  RUNTIMES,
  applyColorScheme,
  chromeExecutable,
  selectRuntime,
  startServer,
  stopServer,
} from './browser-harness';

interface AlertDialogEvent {
  kind: string;
  detail: unknown;
  at: number;
}
interface AlertDialogFixture {
  publicProfile: unknown;
  fixtureProfile: unknown;
  events(): AlertDialogEvent[];
  destroy(): Promise<void>;
}
interface ElementLayout {
  tag: string;
  id: string;
  role: string | null;
  tokens: string | null;
  rect: { x: number; y: number; width: number; height: number; right: number; bottom: number };
  display: string;
  boxSizing: string;
  opacity: string;
  transform: string;
  padding: string[];
  border: string[];
  rowGap: string;
  columnGap: string;
  textAlign: string;
  flexDirection: string;
  flexWrap: string;
  justifyContent: string;
  fontSize: string;
  lineHeight: string;
  fontWeight: string;
  fontFamily: string;
  whiteSpace: string;
  overflowX: string;
  overflowY: string;
  maxWidth: string;
  maxHeight: string;
  boxShadow: string;
  borderRadius: string;
  backgroundColor: string;
  color: string;
  client: { width: number; height: number };
  scroll: { width: number; height: number; left: number; top: number };
}
interface AlertDialogLayout {
  at: number;
  rootFont: string;
  fonts: string;
  available: { width: string; height: string };
  labelledBy: string | null;
  describedBy: string | null;
  modal: string | null;
  panel: ElementLayout;
  mask: ElementLayout;
  header: ElementLayout;
  footer: ElementLayout;
  title: ElementLayout;
  description: ElementLayout;
  cancel: ElementLayout;
  action: ElementLayout;
  animations: { playState: string; pending: boolean; currentTime: string | null }[];
}

const route = '/en/ui-libraries/shadcn/alert-dialog/';
const output = process.env.PUI_FINF_ALERT_DIALOG_LAYOUT_EVIDENCE_DIR ??
  path.join(process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR ?? tmpdir(), 'alert-dialog-layout');
const reference = {
  criterion: 'issue.1097.002',
  issue: 'https://github.com/Proto-UI/Proto-UI/issues/1097',
  contract: 'internal/contracts/overlay/shadcn-alert-dialog.presentation.v0.md',
  upstream: '02cad61166c4c20edbc8a3f71bd720eed4c1f49b',
  paths: ['apps/v4/registry/new-york-v4/ui/alert-dialog.tsx', 'apps/v4/registry/new-york-v4/ui/button.tsx'],
  fixtureProfile: 'new-york-v4',
  publicDemoProfile: 'rhea',
};
const scenarios = [
  { id: 'wide-root16', root: 16, width: 1280 },
  { id: 'wide-root32', root: 32, width: 1280 },
  { id: 'narrow-root16', root: 16, width: 320 },
  { id: 'narrow-root32', root: 32, width: 320 },
] as const;
const caseIds = RUNTIMES.flatMap((runtime) => COLOR_SCHEMES.flatMap((scheme) =>
  scenarios.map((scenario) => `alert-layout-new-york-v4-${runtime}-${scheme}-${scenario.id}`)
));
const revision = execFileSync('git', ['rev-parse', 'HEAD']).toString().trim();
const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}']).toString().trim();
const trackedChanges = execFileSync('git', ['diff', '--name-only', 'HEAD']).toString().trim();
const untrackedChanges = execFileSync('git', ['ls-files', '--others', '--exclude-standard'])
  .toString().trim();
const candidate = {
  revision,
  tree,
  cleanExactCommit: !trackedChanges && !untrackedChanges,
  trackedChanges: trackedChanges ? trackedChanges.split('\n') : [],
  untrackedChanges: untrackedChanges ? untrackedChanges.split('\n') : [],
  trackedPatchSha256: createHash('sha256')
    .update(execFileSync('git', ['diff', '--binary', 'HEAD'])).digest('hex'),
};
const sourcePaths = [
  reference.contract,
  'spec/prototypes/P-SHADCN-ALERT-DIALOG-HEADER.yaml',
  'spec/prototypes/P-SHADCN-ALERT-DIALOG-FOOTER.yaml',
  'spec/tests/T-SHADCN-ALERT-DIALOG-0001.yaml',
  'apps/www/src/content/docs/zh-cn/finf-alert-dialog-layout.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/browser-harness.ts',
  'scripts/test/run-runtime-tests.mjs',
  'scripts/test/runtime-test-plan.mjs',
  'scripts/test/runtime-ci.mjs',
  'apps/www/src/content/docs/demo-shadcn-alert-dialog.demo.ts',
  'apps/www/src/content/docs/shadcn-demo-style.ts',
  'apps/www/src/content/docs/en/ui-libraries/shadcn/alert-dialog.mdx',
  'apps/www/src/components/PrototypePreviewer/demo-renderer.ts',
  'apps/www/src/components/PrototypePreviewer/demo-types.ts',
  'apps/www/src/components/PrototypePreviewer/prototype-modules.ts',
  'apps/www/src/components/PrototypePreviewer/runtime-preview-surface.ts',
  'apps/www/src/components/PrototypePreviewer/projection-theme.ts',
  'packages/prototypes/shadcn/src/dialog/style.ts',
  'packages/prototypes/shadcn/src/dialog/action-paint.ts',
  'packages/prototypes/shadcn/src/button/paint.ts',
  'packages/prototypes/shadcn/src/alert-dialog/recipes.ts',
  'packages/prototypes/shadcn/src/alert-dialog/types.ts',
  'packages/prototypes/shadcn/src/style-scope/root.proto.ts',
  'packages/prototypes/shadcn/src/style-scope/context.ts',
  ...['root', 'trigger', 'content', 'mask', 'header', 'footer', 'title', 'description', 'cancel', 'action']
    .map((part) => `packages/prototypes/shadcn/src/alert-dialog/${part}.proto.ts`),
  ...['root', 'trigger', 'content', 'overlay', 'title', 'description', 'cancel', 'action']
    .map((part) => `packages/prototypes/base/src/alert-dialog/${part}.proto.ts`),
  'packages/prototypes/base/src/alert-dialog/shared.ts',
  'packages/prototypes/base/src/alert-dialog/types.ts',
  'packages/prototypes/base/src/alert-dialog/command.ts',
];
const writeJson = (name: string, value: unknown) =>
  writeFile(path.join(output, name), JSON.stringify(value, null, 2) + '\n');
let browser: Browser;
let baseUrl = '';

beforeAll(async () => {
  await mkdir(output, { recursive: true });
  const sourceHashes: Record<string, string> = {};
  for (const file of sourcePaths)
    sourceHashes[file] = createHash('sha256').update(await readFile(file)).digest('hex');
  await writeJson('alert-dialog-layout-source.json', {
    candidate, reference, sourceHashes, caseIds,
    toolchain: { node: process.version, platform: process.platform, arch: process.arch },
    phase: 'Planned inventory; only terminal case receipts prove execution.',
  });
  try {
    if (process.env.GITHUB_ACTIONS !== 'true' || !process.env.CANDIDATE_SHA)
      throw new Error('Official GitHub Actions only; local source checks do not launch a browser.');
    expect(revision).toBe(process.env.CANDIDATE_SHA);
    expect(candidate.cleanExactCommit).toBe(true);
    let serverOwner: unknown = { kind: 'standalone-suite-owned-server', revision };
    if (process.env.PROTO_UI_BROWSER_BASE_URL) {
      // The canonical wrapper owns one exact-checkout server per browser shard.
      // An arbitrary loopback URL does not supply that selection/source binding.
      const shard = process.env.PROTO_UI_RUNTIME_SHARD;
      const evidenceRoot = process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR;
      if (process.env.PROTO_UI_RUNTIME_PHASE !== 'browser' || !evidenceRoot ||
        !shard || !/^[1-9]\d*\/[1-9]\d*$/.test(shard))
        throw new Error('A reused server requires the canonical browser-shard selection.');
      const selectionPath = path.join(evidenceRoot, `selection-browser-${shard.replace('/', '-of-')}.json`);
      const selectionBytes = await readFile(selectionPath);
      const selection = JSON.parse(selectionBytes.toString()) as {
        checkoutSha?: unknown; phase?: unknown; shard?: unknown; suites?: unknown;
      };
      expect(selection.checkoutSha).toBe(revision);
      expect(selection.phase).toBe('browser');
      expect(selection.shard).toBe(shard);
      expect(Array.isArray(selection.suites)).toBe(true);
      expect(selection.suites).toContain('apps/www/src/content/docs/zh-cn/finf-alert-dialog-layout.browser.test.ts');
      const suppliedUrl = new URL(process.env.PROTO_UI_BROWSER_BASE_URL);
      if (suppliedUrl.protocol !== 'http:' || suppliedUrl.href !== `${suppliedUrl.origin}/` ||
        !['127.0.0.1', 'localhost', '[::1]'].includes(suppliedUrl.hostname))
        throw new Error('Canonical browser server must be an unauthenticated loopback HTTP URL.');
      serverOwner = { kind: 'canonical-browser-shard', selectionPath, selection,
        sha256: createHash('sha256').update(selectionBytes).digest('hex') };
    }
    baseUrl = await startServer(route);
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(baseUrl).hostname))
      throw new Error('Evidence server must be loopback.');
    await writeJson('alert-dialog-layout-server.json', { candidate, baseUrl, serverOwner });
    browser = await chromium.launch({
      executablePath: await chromeExecutable(),
      headless: true,
      chromiumSandbox: true,
      args: ['--disable-dev-shm-usage'],
    });
  } catch (error) {
    await writeJson('alert-dialog-layout-setup.json', {
      candidate, result: 'blocked-before-cases', error: String(error),
      unexecutedCaseIds: caseIds, screenshots: [],
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

// A separate ordinary consumer of the real DemoSpec selects New York through
// the public logical style scope. The public page and its Rhea input stay intact.
async function mountNewYork(page: Page, runtime: (typeof RUNTIMES)[number]): Promise<JSHandle<AlertDialogFixture>> {
  return page.evaluateHandle(async (runtime) => {
    const browserImport = new Function('url', 'return import(url)') as (url: string) => Promise<unknown>;
    const { renderDemo } = (await browserImport('/src/components/PrototypePreviewer/demo-renderer.ts')) as
      typeof DemoRenderer;
    const { default: original } = (await browserImport('/src/content/docs/demo-shadcn-alert-dialog.demo.ts')) as {
      default: DemoSpec;
    };
    const { createRuntimePreviewSurface, runtimePreviewFamily } = (await browserImport(
      '/src/components/PrototypePreviewer/runtime-preview-surface.ts'
    )) as typeof RuntimePreviewSurface;
    const { resolveProjectionThemeSurfaceStyle } = (await browserImport(
      '/src/components/PrototypePreviewer/projection-theme.ts'
    )) as typeof ProjectionTheme;
    const { collectPrototypeIds } = (await browserImport('/src/components/PrototypePreviewer/demo-types.ts')) as
      typeof DemoTypes;
    const { loadPrototypes } = (await browserImport('/src/components/PrototypePreviewer/prototype-modules.ts')) as
      typeof PrototypeModules;
    if (original.root.kind !== 'proto' || original.root.prototypeId !== 'shadcn-style-scope' ||
      original.root.props?.styleProfile !== 'rhea')
      throw new Error('Public AlertDialog demo must retain its declared Rhea scope.');
    const root = structuredClone(original.root);
    root.props = { ...root.props, styleProfile: 'new-york-v4' };
    const addObservationRefs = (node: DemoChild): void => {
      if (typeof node === 'string' || node.kind === 'text') return;
      if (node.kind === 'proto' && node.prototypeId.startsWith('shadcn-alert-dialog-')) {
        const part = node.prototypeId.slice('shadcn-alert-dialog-'.length);
        // Preserve Root/Action refs consumed by the original setup callback.
        if (!['root', 'action'].includes(part)) node.ref = `alert-layout-${part}`;
      }
      for (const child of node.children ?? []) addObservationRefs(child);
    };
    addObservationRefs(root);
    const events: AlertDialogEvent[] = [];
    const demo: DemoSpec = {
      ...original,
      root,
      setup(ctx) {
        const cleanup = original.setup?.({
          ...ctx,
          api: {
            ...ctx.api,
            setProps(ref, props) {
              const callback = props.onOpenChange;
              ctx.api.setProps(ref, ref === 'root' && typeof callback === 'function' ? {
                ...props,
                onOpenChange(detail: unknown) {
                  events.push({ kind: 'openChange', detail, at: performance.now() });
                  callback(detail);
                },
              } : props);
            },
          },
        });
        ctx.api.setProps('action', {
          onAction(detail: unknown) {
            events.push({ kind: 'action', detail, at: performance.now() });
          },
        });
        return cleanup;
      },
    };
    const previewer = document.querySelector<HTMLElement>(
      '[data-previewer-id][data-demo-id="demo-shadcn-alert-dialog"]'
    );
    if (!previewer || runtimePreviewFamily(previewer) !== 'shadcn')
      throw new Error('Public Shadcn AlertDialog preview missing.');
    const host = document.createElement('div');
    host.dataset.alertLayoutFixture = '';
    host.style.cssText = 'width: calc(100% - 32px); margin: 16px; min-width: 0';
    document.body.append(host);
    const surface = createRuntimePreviewSurface(
      demo, 'shadcn', resolveProjectionThemeSurfaceStyle('shadcn', previewer), runtime
    );
    const ids = new Set<string>();
    collectPrototypeIds(surface.demo.root, ids);
    let view: DemoRenderResult | undefined;
    try {
      await loadPrototypes([...ids]);
      view = await renderDemo({ host, demo: surface.demo, runtime });
      await surface.ready;
    } catch (error) {
      await view?.destroy();
      host.remove();
      throw error;
    }
    const mountedView = view;
    return {
      publicProfile: original.root.props.styleProfile,
      fixtureProfile: root.props.styleProfile,
      events: () => structuredClone(events),
      async destroy() {
        try {
          await mountedView.destroy();
        } finally {
          host.remove();
        }
      },
    };
  }, runtime);
}

async function layout(panel: Locator): Promise<AlertDialogLayout> {
  return panel.evaluate((content) => {
    const describe = (element: Element) => {
      const rect = element.getBoundingClientRect();
      const css = getComputedStyle(element);
      const html = element as HTMLElement;
      return {
        tag: element.tagName, id: element.id, role: element.getAttribute('role'),
        tokens: element.getAttribute('data-pui-style'),
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom },
        display: css.display, boxSizing: css.boxSizing, opacity: css.opacity, transform: css.transform,
        padding: [css.paddingTop, css.paddingRight, css.paddingBottom, css.paddingLeft],
        border: [css.borderTopWidth, css.borderRightWidth, css.borderBottomWidth, css.borderLeftWidth],
        rowGap: css.rowGap, columnGap: css.columnGap, textAlign: css.textAlign,
        flexDirection: css.flexDirection, flexWrap: css.flexWrap, justifyContent: css.justifyContent,
        fontSize: css.fontSize, lineHeight: css.lineHeight, fontWeight: css.fontWeight,
        fontFamily: css.fontFamily, whiteSpace: css.whiteSpace,
        overflowX: css.overflowX, overflowY: css.overflowY, maxWidth: css.maxWidth, maxHeight: css.maxHeight,
        boxShadow: css.boxShadow, borderRadius: css.borderRadius,
        backgroundColor: css.backgroundColor, color: css.color,
        client: { width: html.clientWidth, height: html.clientHeight },
        scroll: { width: html.scrollWidth, height: html.scrollHeight, left: html.scrollLeft, top: html.scrollTop },
      };
    };
    const part = (ref: string) => {
      const node = content.querySelector(`[data-demo-ref="${ref}"]`);
      if (!node) throw new Error(`AlertDialog part missing: ${ref}`);
      return describe(node);
    };
    const css = getComputedStyle(content);
    const mask = document.querySelector('[data-demo-ref="alert-layout-mask"]');
    if (!mask) throw new Error('AlertDialog Mask missing.');
    return {
      at: performance.now(), rootFont: getComputedStyle(document.documentElement).fontSize,
      fonts: document.fonts.status,
      available: {
        width: css.getPropertyValue('--proto-ui-available-region-width').trim(),
        height: css.getPropertyValue('--proto-ui-available-region-height').trim(),
      },
      labelledBy: content.getAttribute('aria-labelledby'), describedBy: content.getAttribute('aria-describedby'),
      modal: content.getAttribute('aria-modal'),
      panel: describe(content), mask: describe(mask),
      header: part('alert-layout-header'), footer: part('alert-layout-footer'),
      title: part('alert-layout-title'), description: part('alert-layout-description'),
      cancel: part('alert-layout-cancel'), action: part('action'),
      animations: [...content.getAnimations({ subtree: true }), ...mask.getAnimations({ subtree: true })].map((animation) => ({
        playState: animation.playState, pending: animation.pending,
        currentTime: animation.currentTime === null ? null : String(animation.currentTime),
      })),
    };
  });
}
const signature = (sample: AlertDialogLayout) => JSON.stringify({
  ...sample, at: undefined,
  animations: sample.animations.map(({ playState, pending }) => ({ playState, pending })),
});
async function settledLayout(panel: Locator, samples: AlertDialogLayout[]) {
  let previous = '', consecutive = 0;
  await expect.poll(async () => {
    const sample = await layout(panel);
    samples.push(sample);
    const current = signature(sample);
    const settled = sample.fonts === 'loaded' && sample.panel.opacity === '1' && sample.mask.opacity === '1' &&
      sample.animations.every((animation) => !animation.pending &&
        ['finished', 'idle'].includes(animation.playState));
    consecutive = settled && current === previous ? consecutive + 1 : settled ? 1 : 0;
    previous = current;
    return consecutive;
  }, { timeout: 1000, intervals: [16, 32, 64] }).toBeGreaterThanOrEqual(3);
  return samples[samples.length - 1]!;
}
function assertGeometry(actual: AlertDialogLayout, root: number) {
  expect(actual.rootFont).toBe(`${root}px`);
  expect(actual.panel.role).toBe('alertdialog');
  expect(actual.modal).toBe('true');
  expect(actual.labelledBy).toBe(actual.title.id);
  expect(actual.describedBy).toBe(actual.description.id);
  expect(actual.title.id).not.toBe('');
  expect(actual.description.id).not.toBe('');
  expect(actual.panel.boxSizing).toBe('border-box');
  expect(actual.panel.display).toBe('grid');
  expect(actual.panel.padding.map(Number.parseFloat)).toEqual(Array(4).fill(1.5 * root));
  expect(actual.panel.border.map(Number.parseFloat)).toEqual([1, 1, 1, 1]);
  expect(Number.parseFloat(actual.panel.rowGap)).toBeCloseTo(root, 4);
  expect(actual.header.display).toBe('grid');
  expect(actual.header.textAlign).toBe('left');
  expect(Number.parseFloat(actual.header.rowGap)).toBeCloseTo(0.375 * root, 4);
  expect(actual.footer.display).toBe('flex');
  expect(actual.footer.flexDirection).toBe('row');
  expect(actual.footer.flexWrap).toBe('wrap-reverse');
  expect(actual.footer.justifyContent).toBe('flex-end');
  expect(Number.parseFloat(actual.footer.columnGap)).toBeCloseTo(0.5 * root, 4);
  expect(actual.header.role).toBeNull();
  expect(actual.footer.role).toBeNull();
  expect(Number.parseFloat(actual.title.fontSize)).toBeCloseTo(1.125 * root, 4);
  expect(actual.title.fontWeight).toBe('600');
  expect(Number.parseFloat(actual.description.fontSize)).toBeCloseTo(0.875 * root, 4);
  expect(actual.available.width).toMatch(/^\d+(?:\.\d+)?px$/);
  expect(actual.available.height).toMatch(/^\d+(?:\.\d+)?px$/);
  const availableWidth = Number.parseFloat(actual.available.width);
  const availableHeight = Number.parseFloat(actual.available.height);
  expect(availableWidth).toBeGreaterThan(2 * root);
  expect(Math.abs(actual.panel.rect.width - Math.min(32 * root, availableWidth - 2 * root))).toBeLessThanOrEqual(1);
  expect(actual.panel.rect.height).toBeLessThanOrEqual(availableHeight - 2 * root + 1);
  expect(actual.panel.scroll.width).toBeLessThanOrEqual(actual.panel.client.width + 1);
  for (const command of [actual.cancel, actual.action]) {
    expect(command.rect.height).toBeCloseTo(2.25 * root, 4);
    expect(command.padding.map(Number.parseFloat)).toEqual([0.5 * root, root, 0.5 * root, root]);
    expect(Number.parseFloat(command.fontSize)).toBeCloseTo(0.875 * root, 4);
    expect(command.fontWeight).toBe('500');
    expect(command.whiteSpace).toBe('nowrap');
    expect(command.scroll.width).toBeLessThanOrEqual(command.client.width + 1);
    expect(command.rect.x).toBeGreaterThanOrEqual(actual.panel.rect.x);
    expect(command.rect.right).toBeLessThanOrEqual(actual.panel.rect.right + 1);
  }
}
async function focused(locator: Locator) {
  return locator.evaluate((control) => {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    for (let node = active; node; ) {
      if (node === control) return true;
      node = node.parentElement ?? (node.getRootNode() instanceof ShadowRoot ?
        (node.getRootNode() as ShadowRoot).host : null);
    }
    return false;
  });
}

for (const runtime of RUNTIMES)
  for (const scheme of COLOR_SCHEMES)
    for (const scenario of scenarios) {
      const id = `alert-layout-new-york-v4-${runtime}-${scheme}-${scenario.id}`;
      it(id, async () => {
        let context: BrowserContext | undefined, page: Page | undefined;
        let fixture: JSHandle<AlertDialogFixture> | undefined;
        let stage = 'created', result = 'failed', failure: string | undefined;
        const samples: Record<string, AlertDialogLayout[]> = {}, observations: Record<string, unknown> = {};
        const screenshots: unknown[] = [], errors: string[] = [], deniedRequests: string[] = [];
        const consoleMessages: { type: string; text: string }[] = [];
        try {
          context = await browser.newContext({
            viewport: { width: scenario.width, height: 1000 }, colorScheme: scheme,
            locale: 'en-US', timezoneId: 'UTC', reducedMotion: 'reduce',
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
          page.on('console', (message) => {
            if (['warning', 'error'].includes(message.type()))
              consoleMessages.push({ type: message.type(), text: message.text() });
          });
          stage = 'navigate';
          expect((await page.goto(baseUrl + route, { waitUntil: 'networkidle' }))?.status()).toBe(200);
          const previewer = page.locator('[data-previewer-id][data-demo-id="demo-shadcn-alert-dialog"]');
          await selectRuntime(page, previewer, runtime, '[data-demo-ref="root"]', 1);
          await applyColorScheme(page, scheme);
          await page.evaluate((root) => { document.documentElement.style.fontSize = `${root}px`; }, scenario.root);
          await page.evaluate(() => document.fonts.ready);
          observations.environment = await page.evaluate(() => ({
            viewport: { width: innerWidth, height: innerHeight }, dpr: devicePixelRatio,
            rootFont: getComputedStyle(document.documentElement).fontSize,
            userAgent: navigator.userAgent, fonts: document.fonts.status,
            prefersDark: matchMedia('(prefers-color-scheme: dark)').matches,
            reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
          }));
          fixture = await mountNewYork(page, runtime);
          observations.profiles = await fixture.evaluate((view) => ({
            public: view.publicProfile, fixture: view.fixtureProfile,
          }));
          expect(observations.profiles).toEqual({ public: 'rhea', fixture: 'new-york-v4' });
          const trigger = page.locator('[data-demo-ref="alert-layout-trigger"]');
          const panel = page.locator('[data-demo-ref="alert-layout-content"][role="alertdialog"]');
          const cancel = panel.locator('[data-demo-ref="alert-layout-cancel"]');
          const action = panel.locator('[data-demo-ref="action"]');
          const events = () => fixture!.evaluate((view) => view.events());
          const capture = async (name: string) => {
            const rows: AlertDialogLayout[] = [];
            samples[name] = rows;
            const before = await settledLayout(panel, rows);
            const file = `${id}-${name}.png`;
            const bytes = await page!.screenshot({ path: path.join(output, file), animations: 'allow' });
            const after = await layout(panel);
            screenshots.push({ file, sha256: createHash('sha256').update(bytes).digest('hex'), before, after });
            expect(signature(after), 'Image must retain the measured native layout phase.').toBe(signature(before));
            assertGeometry(after, scenario.root);
            observations[name] = after;
          };
          stage = 'open';
          await trigger.click();
          await panel.waitFor({ state: 'visible' });
          await expect.poll(() => focused(cancel)).toBe(true);
          await capture('opened');
          expect((await events()).map((event) => event.kind)).toEqual(['openChange']);
          stage = 'outside-guard';
          // Native backdrop press, outside the measured panel; no synthetic click or forced state.
          const mask = page.locator('[data-demo-ref="alert-layout-mask"]');
          observations.outsideHit = await mask.evaluate((element) => {
            const point = { x: 4, y: 4 };
            const target = document.elementFromPoint(point.x, point.y);
            return { ...point, hitsMask: target === element || element.contains(target), tag: target?.tagName };
          });
          expect(observations.outsideHit).toMatchObject({ hitsMask: true });
          await page.mouse.click(4, 4);
          await capture('outside-guard');
          expect((await events()).map((event) => event.kind)).toEqual(['openChange']);
          await expect.poll(() => focused(cancel)).toBe(true);
          stage = 'cancel';
          await cancel.click();
          await panel.waitFor({ state: 'hidden' });
          await expect.poll(() => focused(trigger)).toBe(true);
          expect((await events()).map((event) => ({ kind: event.kind, detail: event.detail }))).toEqual([
            { kind: 'openChange', detail: expect.objectContaining({ open: true }) },
            { kind: 'openChange', detail: { open: false, reason: 'cancel.press', focusReason: 'pointer' } },
          ]);
          stage = 'reopen-keyboard';
          await trigger.click();
          await panel.waitFor({ state: 'visible' });
          await expect.poll(() => focused(cancel)).toBe(true);
          await page.keyboard.press('Tab');
          await expect.poll(() => focused(action)).toBe(true);
          await page.keyboard.press('Tab');
          await expect.poll(() => focused(cancel)).toBe(true);
          await page.keyboard.press('Shift+Tab');
          await expect.poll(() => focused(action)).toBe(true);
          await capture('reopened-action-focused');
          stage = 'action';
          await page.keyboard.press('Enter');
          await panel.waitFor({ state: 'hidden' });
          await expect.poll(() => focused(trigger)).toBe(true);
          expect((await events()).slice(-2).map((event) => ({ kind: event.kind, detail: event.detail }))).toEqual([
            { kind: 'action', detail: { reason: 'action.press' } },
            { kind: 'openChange', detail: { open: false, reason: 'action.press', focusReason: 'keyboard' } },
          ]);
          expect((await events()).filter((event) => event.kind === 'openChange')).toHaveLength(4);
          stage = 'reopen-escape';
          await trigger.click();
          await panel.waitFor({ state: 'visible' });
          await expect.poll(() => focused(cancel)).toBe(true);
          await page.keyboard.press('Escape');
          await panel.waitFor({ state: 'hidden' });
          await expect.poll(() => focused(trigger)).toBe(true);
          expect((await events()).filter((event) => event.kind === 'action')).toHaveLength(1);
          expect((await events()).filter((event) => event.kind === 'openChange')).toHaveLength(6);
          expect((await events()).at(-1)?.detail).toEqual({ open: false, reason: 'escape', focusReason: 'keyboard' });
          const closedFile = `${id}-closed.png`;
          const closedBefore = {
            expanded: await trigger.getAttribute('aria-expanded'), focused: await focused(trigger),
          };
          const closedBytes = await page.screenshot({ path: path.join(output, closedFile), animations: 'allow' });
          const closedAfter = {
            expanded: await trigger.getAttribute('aria-expanded'), focused: await focused(trigger),
          };
          screenshots.push({ file: closedFile, sha256: createHash('sha256').update(closedBytes).digest('hex'),
            state: 'closed', before: closedBefore, after: closedAfter });
          expect(closedBefore).toEqual({ expanded: 'false', focused: true });
          expect(closedAfter).toEqual(closedBefore);
          observations.events = await events();
          observations.publicDemoStillClosed = await previewer.getByRole('button', { name: 'Open AlertDialog', exact: true })
            .getAttribute('aria-expanded');
          expect(observations.publicDemoStillClosed).toBe('false');
          stage = 'dispose';
          await fixture.evaluate((view) => view.destroy());
          await fixture.dispose();
          fixture = undefined;
          expect(await page.locator('[data-alert-layout-fixture]').count()).toBe(0);
          await expect.poll(() => panel.count()).toBe(0);
          expect(await page.locator('[data-demo-ref="alert-layout-mask"]').count()).toBe(0);
          expect(errors).toEqual([]);
          expect(deniedRequests).toEqual([]);
          result = 'passed';
        } catch (error) {
          failure = String(error);
          if (page) try {
            const file = `${id}-failure.png`;
            const bytes = await page.screenshot({ path: path.join(output, file), animations: 'allow', timeout: 5000 });
            screenshots.push({ file, stage, sha256: createHash('sha256').update(bytes).digest('hex') });
          } catch (captureError) {
            errors.push(`failure capture: ${String(captureError)}`);
          }
          throw error;
        } finally {
          if (fixture) try {
            observations.events = await fixture.evaluate((view) => view.events());
          } catch (readError) {
            errors.push(`failure event readback: ${String(readError)}`);
          }
          try {
            await writeJson(`${id}.json`, {
              candidate, reference, runtime, scheme, scenario, stage, result, failure,
              observedAt: new Date().toISOString(),
              observations, samples, screenshots, errors, deniedRequests, consoleMessages,
              browser: browser?.version(),
              environment: { viewportHeight: 1000, locale: 'en-US', timezone: 'UTC', reducedMotion: 'reduce' },
              limit: 'Explicit New York static fixture, not public Rhea paint acceptance. Root-font scaling is not browser zoom. Narrow intrinsic wrapping is not upstream40rem breakpoint parity. No motion, AT, other-family, non-Web or complete1097 admission.',
            });
          } finally {
            await context?.close();
          }
        }
      }, 120_000);
    }
