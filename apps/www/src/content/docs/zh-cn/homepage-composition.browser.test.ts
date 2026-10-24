// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Browser, BrowserContext, Locator, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser, startServer, stopServer, RUNTIMES } from './browser-harness';
import { revealHeaderPreferences } from './site-header-browser';
import { copySourceBindingIssues, type CopySourceBinding } from './copy-command-evidence';

// Eight fresh, credential-free homepage contexts; five layout samples reuse each page.
// Four separate width-fixture contexts isolate intrinsic input sizing.
// 150s startup + 8 x 45s scenes + 30s no-JS + 30s width + 20s teardown
// + 1s pure contracts = 591s < the unchanged 600s lane cap.
// Only real input changes application state. The sole component-style mutation is the
// explicitly reported text-resize simulation, never a component geometry fix.
// A zero-size hidden theme-color probe is temporary observation, not component paint.
const directory = join(
  process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR ||
    join(process.env.RUNNER_TEMP || tmpdir(), 'homepage-evidence'),
  'homepage-composition'
);
const HOME = '[data-home-showcase="website-component-gallery"]';
const ACTIVE = `${HOME} [data-projection-generation-state="active"]`;
const RUNTIME_LABELS = { wc: 'Web Components', react: 'React', vue: 'Vue', vue2: 'Vue 2' };
const GALLERY_IDS = [
  'controls',
  'hover',
  'workspace-command',
  'workspace-help',
  'preferences',
  'workspace-progress',
  'editor',
  'overlays',
  'choices',
] as const;
const LAYOUTS = [
  { name: '1400', width: 1400, textScale: 100 },
  { name: '1180', width: 1180, textScale: 100 },
  { name: '2048', width: 2048, textScale: 100 },
  { name: '320', width: 320, textScale: 100 },
  { name: '320-text200', width: 320, textScale: 200 },
] as const;
let browser: Browser,
  baseUrl: string,
  source: CopySourceBinding,
  testSha256: string,
  fixtureSha256: string;

type CaptureSelection = Array<{
  hostGeneration: string | null;
  scopes: Array<{
    generation: string | null;
    runtime: string | null;
    family: string | null;
    state: string | null;
    scenes: Array<{ name: string | null; generation: string | null }>;
  }>;
}>;
type GalleryRect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
};
type GalleryFlowFacts = {
  containerCount: number;
  viewportWidth: number;
  rootFontSize: number;
  columnGap: number;
  container: GalleryRect | null;
  cards: Array<{
    id: string | null;
    visible: boolean;
    rect: GalleryRect;
    fragments: GalleryRect[];
  }>;
};
/** Pure geometry observer. One CSS pixel allows fractional layout rounding only. */
export function galleryFlowEvidence(facts: GalleryFlowFacts) {
  const issues: string[] = [];
  const epsilon = 1;
  const expectedGap = facts.rootFontSize * (facts.viewportWidth <= 767 ? 1.25 : 1.5);
  if (facts.containerCount !== 1 || !facts.container)
    issues.push('expected exactly one gallery container');
  if (
    JSON.stringify(facts.cards.map((card) => card.id)) !== JSON.stringify(GALLERY_IDS) ||
    new Set(facts.cards.map((card) => card.id)).size !== GALLERY_IDS.length
  )
    issues.push('missing, duplicate or reordered gallery card');
  if (!Number.isFinite(expectedGap) || expectedGap <= 0)
    issues.push('invalid gallery spacing baseline');
  if (!Number.isFinite(facts.columnGap) || Math.abs(facts.columnGap - expectedGap) > epsilon)
    issues.push('gallery column gap differs from the responsive spacing contract');
  const columns: Array<{
    left: number;
    right: number;
    cards: GalleryFlowFacts['cards'];
    adjacentGaps: Array<{ before: string | null; after: string | null; gap: number }>;
  }> = [];
  for (const card of facts.cards) {
    const rect = card.rect;
    if (
      !card.visible ||
      !Object.values(rect).every(Number.isFinite) ||
      rect.width <= 0 ||
      rect.height <= 0
    )
      issues.push(`${card.id}: absent painted gallery card`);
    if (
      card.fragments.length !== 1 ||
      card.fragments.some(
        (fragment) =>
          !Object.values(fragment).every(Number.isFinite) ||
          fragment.width <= 0 ||
          fragment.height <= 0 ||
          Object.keys(rect).some(
            (key) =>
              Math.abs(fragment[key as keyof GalleryRect] - rect[key as keyof GalleryRect]) >
              epsilon
          )
      )
    )
      issues.push(`${card.id}: split or inconsistent gallery card fragment`);
    if (rect.left < -epsilon || rect.right > facts.viewportWidth + epsilon)
      issues.push(`${card.id}: gallery card outside viewport`);
    let column = columns.find((entry) => Math.abs(entry.left - rect.left) <= epsilon);
    if (!column) {
      column = { left: rect.left, right: rect.right, cards: [], adjacentGaps: [] };
      columns.push(column);
    }
    if (Math.abs(column.right - rect.right) > epsilon)
      issues.push(`${card.id}: inconsistent gallery column width`);
    column.cards.push(card);
  }
  columns.sort((a, b) => a.left - b.left);
  for (const column of columns) {
    column.cards.sort((a, b) => a.rect.top - b.rect.top);
    if (facts.container && Math.abs(column.cards[0]!.rect.top - facts.container.top) > epsilon)
      issues.push(`${column.cards[0]!.id}: gallery column starts with a hole`);
    for (let index = 1; index < column.cards.length; index++) {
      const previous = column.cards[index - 1]!,
        current = column.cards[index]!;
      const gap = current.rect.top - previous.rect.bottom;
      column.adjacentGaps.push({ before: previous.id, after: current.id, gap });
      if (Math.abs(gap - expectedGap) > epsilon)
        issues.push(
          `${previous.id}/${current.id}: gallery gap differs from the responsive spacing contract`
        );
    }
  }
  if (
    JSON.stringify(columns.flatMap((column) => column.cards.map((card) => card.id))) !==
    JSON.stringify(facts.cards.map((card) => card.id))
  )
    issues.push('painted gallery column order differs from DOM order');
  for (let index = 0; index < facts.cards.length; index++)
    for (let other = index + 1; other < facts.cards.length; other++) {
      const a = facts.cards[index]!,
        b = facts.cards[other]!;
      if (
        Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left) > epsilon &&
        Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top) > epsilon
      )
        issues.push(`${a.id}/${b.id}: gallery cards overlap`);
    }
  if (facts.container) {
    const expectedColumns =
      facts.viewportWidth <= 639
        ? 1
        : Math.max(
            1,
            Math.floor(
              (facts.container.width + expectedGap) / (18 * facts.rootFontSize + expectedGap)
            )
          );
    if (columns.length !== expectedColumns)
      issues.push('painted gallery column count differs from available 18rem tracks');
    if (facts.container.width > 100 * facts.rootFontSize + epsilon)
      issues.push('gallery exceeds the 100rem wide-screen limit');
    for (let index = 1; index < columns.length; index++)
      if (Math.abs(columns[index]!.left - columns[index - 1]!.right - expectedGap) > epsilon)
        issues.push('painted gallery column gap differs from the responsive spacing contract');
  }
  return {
    issues: [...new Set(issues)],
    expectedGap,
    columns: columns.map((column) => ({
      left: column.left,
      right: column.right,
      ids: column.cards.map((card) => card.id),
      adjacentGaps: column.adjacentGaps,
    })),
  };
}
/** Pure evidence observer, not application behavior; independently negative-tested below. */
export function captureSelectionIssues(
  selection: CaptureSelection,
  runtime: string,
  family: string
): string[] {
  if (selection.length !== 1) return ['expected exactly one active generation'];
  const host = selection[0]!;
  if (!host.hostGeneration || host.scopes.length !== 1) return ['expected one identified scope'];
  const scope = host.scopes[0]!;
  const issues: string[] = [];
  if (scope.generation !== host.hostGeneration) issues.push('stale scope generation');
  if (scope.runtime !== runtime || scope.family !== family || scope.state !== 'ready')
    issues.push('wrong committed scope');
  const names = scope.scenes.map((scene) => scene.name).sort();
  if (
    JSON.stringify(names) !==
    JSON.stringify(['workspace-command', 'workspace-help', 'workspace-progress'])
  )
    issues.push('missing or duplicate scene');
  if (scope.scenes.some((scene) => scene.generation !== host.hostGeneration))
    issues.push('stale scene generation');
  return issues;
}
it('passive evidence rejects invalid generations and incomplete, split, reordered or gapped galleries', () => {
  const good: CaptureSelection = [
    {
      hostGeneration: '3',
      scopes: [
        {
          generation: '3',
          runtime: 'wc',
          family: 'shadcn',
          state: 'ready',
          scenes: ['workspace-command', 'workspace-help', 'workspace-progress'].map((name) => ({
            name,
            generation: '3',
          })),
        },
      ],
    },
  ];
  expect(captureSelectionIssues(good, 'wc', 'shadcn')).toEqual([]);
  expect(captureSelectionIssues([], 'wc', 'shadcn')).toEqual([
    'expected exactly one active generation',
  ]);
  expect(captureSelectionIssues([...good, good[0]!], 'wc', 'shadcn')).toEqual([
    'expected exactly one active generation',
  ]);
  const stale = structuredClone(good);
  stale[0]!.scopes[0]!.generation = '2';
  expect(captureSelectionIssues(stale, 'wc', 'shadcn')).toContain('stale scope generation');
  const missingScene = structuredClone(good);
  missingScene[0]!.scopes[0]!.scenes.pop();
  expect(captureSelectionIssues(missingScene, 'wc', 'shadcn')).toContain(
    'missing or duplicate scene'
  );
  const duplicateScene = structuredClone(good);
  duplicateScene[0]!.scopes[0]!.scenes[2] = duplicateScene[0]!.scopes[0]!.scenes[0]!;
  expect(captureSelectionIssues(duplicateScene, 'wc', 'shadcn')).toContain(
    'missing or duplicate scene'
  );
  const rect = (left: number, top: number): GalleryRect => ({
    left,
    top,
    right: left + 288,
    bottom: top + 100,
    width: 288,
    height: 100,
  });
  const gallery: GalleryFlowFacts = {
    containerCount: 1,
    viewportWidth: 1180,
    rootFontSize: 16,
    columnGap: 24,
    container: { left: 0, right: 912, top: 0, bottom: 372, width: 912, height: 372 },
    cards: GALLERY_IDS.map((id, index) => {
      const box = rect(Math.floor(index / 3) * 312, (index % 3) * 124);
      return { id, visible: true, rect: box, fragments: [{ ...box }] };
    }),
  };
  expect(galleryFlowEvidence(gallery).issues).toEqual([]);
  const narrow = structuredClone(gallery);
  narrow.viewportWidth = 320;
  narrow.columnGap = 20;
  narrow.container = { left: 0, right: 288, top: 0, bottom: 1080, width: 288, height: 1080 };
  narrow.cards.forEach((card, index) => {
    card.rect = rect(0, index * 120);
    card.fragments = [{ ...card.rect }];
  });
  expect(galleryFlowEvidence(narrow).issues).toEqual([]);
  const missingCard = structuredClone(gallery);
  missingCard.cards.pop();
  expect(galleryFlowEvidence(missingCard).issues).toContain(
    'missing, duplicate or reordered gallery card'
  );
  const duplicateCard = structuredClone(gallery);
  duplicateCard.cards[8]!.id = duplicateCard.cards[0]!.id;
  expect(galleryFlowEvidence(duplicateCard).issues).toContain(
    'missing, duplicate or reordered gallery card'
  );
  const splitCard = structuredClone(gallery);
  splitCard.cards[0]!.fragments.push(rect(312, 0));
  expect(galleryFlowEvidence(splitCard).issues).toContain(
    'controls: split or inconsistent gallery card fragment'
  );
  const hiddenCard = structuredClone(gallery);
  hiddenCard.cards[0]!.visible = false;
  expect(galleryFlowEvidence(hiddenCard).issues).toContain('controls: absent painted gallery card');
  const reordered = structuredClone(gallery);
  [reordered.cards[0]!.rect, reordered.cards[1]!.rect] = [
    reordered.cards[1]!.rect,
    reordered.cards[0]!.rect,
  ];
  for (const card of reordered.cards) card.fragments = [{ ...card.rect }];
  expect(galleryFlowEvidence(reordered).issues).toContain(
    'painted gallery column order differs from DOM order'
  );
  const overlap = structuredClone(gallery);
  overlap.cards[1]!.rect = rect(0, 90);
  overlap.cards[1]!.fragments = [{ ...overlap.cards[1]!.rect }];
  expect(galleryFlowEvidence(overlap).issues).toContain('controls/hover: gallery cards overlap');
  const rowHole = structuredClone(gallery);
  rowHole.cards[2]!.rect = rect(0, 700);
  rowHole.cards[2]!.fragments = [{ ...rowHole.cards[2]!.rect }];
  expect(galleryFlowEvidence(rowHole).issues).toContain(
    'hover/workspace-command: gallery gap differs from the responsive spacing contract'
  );
  const wrongGap = structuredClone(gallery);
  wrongGap.columnGap = 48;
  expect(galleryFlowEvidence(wrongGap).issues).toContain(
    'gallery column gap differs from the responsive spacing contract'
  );
  const noFragments = structuredClone(gallery);
  noFragments.cards[0]!.fragments = [];
  expect(galleryFlowEvidence(noFragments).issues).toContain(
    'controls: split or inconsistent gallery card fragment'
  );
  const wrongColumns = structuredClone(narrow);
  wrongColumns.cards[8]!.rect = rect(312, 0);
  wrongColumns.cards[8]!.fragments = [{ ...wrongColumns.cards[8]!.rect }];
  expect(galleryFlowEvidence(wrongColumns).issues).toContain(
    'painted gallery column count differs from available 18rem tracks'
  );
  expect(galleryFlowEvidence(wrongColumns).issues).toContain(
    'choices: gallery card outside viewport'
  );
}, 1_000);

beforeAll(async () => {
  await mkdir(directory, { recursive: true });
  source = {
    exactSHA: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()),
    expectedSHA: process.env.CANDIDATE_SHA ?? process.env.PROTO_UI_EXPECTED_REVISION ?? null,
    eventSHA: process.env.GITHUB_SHA ?? null,
  };
  testSha256 = createHash('sha256')
    .update(await readFile(new URL('./homepage-composition.browser.test.ts', import.meta.url)))
    .digest('hex');
  fixtureSha256 = createHash('sha256')
    .update(await readFile('apps/www/src/pages/en/test/command-width.astro'))
    .digest('hex');
  await writeFile(
    join(directory, 'source.json'),
    JSON.stringify({ ...source, testSha256, fixtureSha256 }, null, 2)
  );
  expect(copySourceBindingIssues(source, Boolean(process.env.CI))).toEqual([]);
  if (process.env.CI) expect(source.expectedSHA).toMatch(/^[a-f\d]{40}$/);
  // A remote server could render a different revision than the checkout.
  expect(process.env.PROTO_UI_BROWSER_BASE_URL).toBeUndefined();
  try {
    baseUrl = await startServer('/en/');
    expect(new URL(baseUrl).hostname).toBe('127.0.0.1');
    browser = await launchBrowser();
  } catch (error) {
    await writeFile(
      join(directory, 'startup-failure.json'),
      JSON.stringify({ ...source, error: String(error) }, null, 2)
    );
    throw error;
  }
}, 150_000);
afterAll(async () => {
  try {
    await browser?.close();
  } finally {
    await stopServer();
  }
}, 20_000);

async function restrictNetwork(context: BrowserContext, blockedRequests: string[]) {
  const origin = new URL(baseUrl).origin;
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) await route.continue();
    else {
      blockedRequests.push(`${url.protocol}//${url.host}${url.pathname}`);
      await route.abort('blockedbyclient');
    }
  });
  await context.routeWebSocket('**/*', async (socket) => {
    const url = new URL(socket.url());
    if (url.protocol === 'ws:' && url.host === new URL(baseUrl).host) socket.connectToServer();
    else {
      blockedRequests.push(`websocket ${url.protocol}//${url.host}${url.pathname}`);
      await socket.close();
    }
  });
}

async function resizeText200(page: Page) {
  // Snapshot every baseline BEFORE applying any override: inherited text must
  // not be multiplied once per ancestor. px text is enlarged as well as rem text.
  const probe = await page.evaluateHandle(() => {
    const parents = new Set<HTMLElement>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.textContent?.trim() && node.parentElement) parents.add(node.parentElement);
    }
    for (const input of document.querySelectorAll<HTMLElement>('input,textarea'))
      parents.add(input);
    const samples = [...parents]
      .filter((node) => {
        if (
          !node.getClientRects().length ||
          node.closest(
            'script,style,noscript,[hidden],[aria-hidden="true"],[data-pui-view-detached]'
          )
        )
          return false;
        for (let parent: HTMLElement | null = node; parent; parent = parent.parentElement) {
          const style = getComputedStyle(parent);
          if (style.display === 'none' || style.visibility === 'hidden') return false;
        }
        return true;
      })
      .map((node) => ({ node, before: parseFloat(getComputedStyle(node).fontSize) }));
    for (const sample of samples) sample.node.style.fontSize = `${sample.before * 2}px`;
    return samples;
  });
  try {
    const read = () =>
      probe.evaluate((samples) =>
        samples.map(({ node, before }) => ({
          tag: node.tagName,
          text: node.textContent?.trim().slice(0, 100),
          before,
          after: parseFloat(getComputedStyle(node).fontSize),
          scene: node.closest('[data-gallery-demo]')?.getAttribute('data-gallery-demo') ?? null,
          connected: node.isConnected,
          transitionProperty: getComputedStyle(node).transitionProperty,
          transitionDuration: getComputedStyle(node).transitionDuration,
          animations: node.getAnimations().map((animation) => ({
            type: animation.constructor.name,
            playState: animation.playState,
            currentTime: typeof animation.currentTime === 'number' ? animation.currentTime : null,
            timing: animation.effect?.getComputedTiming(),
            fontSizeKeyframes:
              animation.effect instanceof KeyframeEffect
                ? animation.effect
                    .getKeyframes()
                    .map((frame) => ({ offset: frame.offset, fontSize: frame.fontSize ?? null }))
                : [],
          })),
        }))
      );
    // Observe the immediate transition rather than disabling motion or overwriting its CSS.
    const immediate = await read();
    let settleFailure: string | null = null;
    try {
      await expect
        .poll(
          () =>
            probe.evaluate((samples) =>
              samples.every(
                ({ node, before }) =>
                  node.isConnected &&
                  Math.abs(parseFloat(getComputedStyle(node).fontSize) - before * 2) < 0.0005
              )
            ),
          { timeout: 1500, interval: 25 }
        )
        .toBe(true);
    } catch (error) {
      // Preserve final measurements before the unchanged exact-size assertions fail outside.
      settleFailure = String(error);
    }
    const final = await read();
    return final.map((sample, index) => ({
      ...sample,
      immediate: immediate[index],
      settleFailure,
    }));
  } finally {
    await probe.dispose();
  }
}

async function settled(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
  });
}
async function ready(page: Page, runtime: string, family: string) {
  await page.waitForFunction(
    ({ runtime, family, home }) => {
      const header = document.querySelector<HTMLElement>('[data-homepage-runtime]');
      const root = document.querySelector<HTMLElement>(home);
      const generations = root?.querySelectorAll('[data-projection-generation-state="active"]');
      const scope = generations?.[0]?.querySelector<HTMLElement>('[data-projection-scope]');
      return (
        header?.dataset.runtimeState === 'ready' &&
        header.dataset.runtime === runtime &&
        header.dataset.family === family &&
        root?.dataset.runnerState === 'ready' &&
        root.dataset.runnerRuntime === runtime &&
        generations?.length === 1 &&
        scope?.dataset.projectionRuntime === runtime &&
        scope.dataset.projectionFamily === family &&
        scope.dataset.projectionState === 'ready' &&
        root.querySelector('[data-home-demo-host]')?.getAttribute('aria-busy') === 'false'
      );
    },
    { runtime, family, home: HOME },
    { timeout: 15_000 }
  );
  await settled(page);
}
async function selectPreference(page: Page, kind: 'runtime' | 'family', label: string) {
  await revealHeaderPreferences(page);
  const trigger = page.locator(
    `[data-homepage-runtime] [data-projection-generation-state="active"] [data-projection-control="${kind}"] [role="combobox"]`
  );
  await trigger.click();
  const controlled = await trigger.getAttribute('aria-controls');
  expect(controlled).toBeTruthy();
  await page
    .locator(`[id=${JSON.stringify(controlled)}]`)
    .getByRole('option', { name: label, exact: true })
    .click();
}
async function attribute(locator: Locator, name: string, value: string | null) {
  await expect.poll(() => locator.getAttribute(name), { timeout: 3_000 }).toBe(value);
}
async function hasFocus(locator: Locator) {
  expect(await locator.evaluate((element) => document.activeElement === element)).toBe(true);
}
async function plan(page: Page, value: number) {
  const progress = page
    .locator(ACTIVE)
    .getByRole('progressbar', { name: 'Example plan', exact: true });
  const slider = page
    .locator(ACTIVE)
    .getByRole('slider', { name: 'Adjust example plan progress', exact: true });
  for (const control of [progress, slider]) {
    await attribute(control, 'aria-valuenow', String(value));
    await attribute(control, 'aria-valuemin', '0');
    await attribute(control, 'aria-valuemax', '100');
  }
  await expect
    .poll(() =>
      page.locator(`${ACTIVE} [data-demo-ref="composition-progress-status"]`).textContent()
    )
    .toBe(`Plan progress: ${value}%`);
}

// Passive geometry observer: never repairs overflow or rewrites scene behavior.
async function layoutFacts(page: Page) {
  return page.evaluate((active) => {
    const scenes = [
      ...document.querySelectorAll<HTMLElement>(`${active} [data-gallery-demo^="workspace-"]`),
    ];
    const visible = (node: Element) => {
      for (let at: Element | null = node; at; at = at.parentElement) {
        const style = getComputedStyle(at);
        if (
          at.matches('[hidden],[aria-hidden="true"],[data-pui-view-detached]') ||
          style.display === 'none' ||
          style.visibility === 'hidden'
        )
          return false;
      }
      return node.getClientRects().length > 0;
    };
    const rect = (box: DOMRect): GalleryRect => ({
      left: box.left,
      right: box.right,
      top: box.top,
      bottom: box.bottom,
      width: box.width,
      height: box.height,
    });
    const galleries = [...document.querySelectorAll<HTMLElement>(`${active} .home-gallery`)];
    const gallery: GalleryFlowFacts = {
      containerCount: galleries.length,
      viewportWidth: innerWidth,
      rootFontSize: parseFloat(getComputedStyle(document.documentElement).fontSize),
      columnGap: galleries[0] ? parseFloat(getComputedStyle(galleries[0]).columnGap) : NaN,
      container: galleries[0] ? rect(galleries[0].getBoundingClientRect()) : null,
      cards: [...document.querySelectorAll<HTMLElement>(`${active} [data-gallery-demo]`)].map(
        (card) => ({
          id: card.getAttribute('data-gallery-demo'),
          visible: visible(card),
          rect: rect(card.getBoundingClientRect()),
          // Count every physical fragment, not just the union bounding box.
          fragments: [...card.getClientRects()].map(rect),
        })
      ),
    };
    const selection = [...document.querySelectorAll<HTMLElement>(`${active}`)].map((host) => ({
      hostGeneration: host.getAttribute('data-projection-generation-host'),
      scopes: [...host.querySelectorAll<HTMLElement>('[data-projection-scope]')].map((scope) => ({
        generation: scope.getAttribute('data-projection-generation'),
        runtime: scope.getAttribute('data-projection-runtime'),
        family: scope.getAttribute('data-projection-family'),
        state: scope.getAttribute('data-projection-state'),
        scenes: [...scope.querySelectorAll<HTMLElement>('[data-gallery-demo^="workspace-"]')].map(
          (scene) => ({
            name: scene.getAttribute('data-gallery-demo'),
            generation: scene.getAttribute('data-projection-generation'),
          })
        ),
      })),
    }));
    const issues: string[] = [];
    const cards = scenes.map((scene) => {
      const bounds = scene.getBoundingClientRect();
      const name = scene.dataset.galleryDemo!;
      if (!visible(scene) || bounds.width <= 0 || bounds.height <= 0)
        issues.push(`${name}: absent painted scene`);
      if (bounds.left < -1 || bounds.right > innerWidth + 1)
        issues.push(`${name}: outside viewport`);
      const boxes: Array<Record<string, unknown>> = [];
      const texts: Array<Record<string, unknown>> = [];
      for (const node of [scene, ...scene.querySelectorAll<HTMLElement>('*')]) {
        if (!visible(node)) continue;
        const style = getComputedStyle(node),
          rect = node.getBoundingClientRect();
        if (style.display === 'contents' || !rect.width || !rect.height) continue;
        if (rect.left < -1 || rect.right > innerWidth + 1)
          issues.push(`${name}: painted descendant outside viewport`);
        // Scrollable Command results may scroll vertically; horizontal loss is
        // not exempted, nor can overflow:hidden make clipped text into a pass.
        if (
          node instanceof HTMLElement &&
          node.clientWidth > 0 &&
          node.scrollWidth > node.clientWidth + 1
        )
          issues.push(
            `${name}: horizontal content overflow in ${node.getAttribute('data-projection-prototype') ?? node.tagName}`
          );
        boxes.push({
          tag: node.tagName,
          prototype: node.getAttribute('data-projection-prototype'),
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
          clientWidth: node.clientWidth,
          scrollWidth: node.scrollWidth,
        });
      }
      const walker = document.createTreeWalker(scene, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent?.trim() || !node.parentElement || !visible(node.parentElement))
          continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const rects = [...range.getClientRects()];
        const font = getComputedStyle(node.parentElement);
        texts.push({
          text: node.textContent.trim(),
          fontSize: font.fontSize,
          fontFamily: font.fontFamily,
          rects: rects.map((rect) => ({
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
          })),
        });
        for (const rect of rects) {
          if (!rect.width || !rect.height) continue;
          if (rect.left < -1 || rect.right > innerWidth + 1)
            issues.push(`${name}: text outside viewport`);
          for (
            let parent: HTMLElement | null = node.parentElement;
            parent;
            parent = parent.parentElement
          ) {
            const style = getComputedStyle(parent),
              clip = parent.getBoundingClientRect();
            if (style.display === 'contents') continue;
            if (
              /hidden|clip/.test(style.overflowX) &&
              (rect.left < clip.left - 2 || rect.right > clip.right + 2)
            )
              issues.push(`${name}: horizontally clipped text`);
            if (
              /hidden|clip/.test(style.overflowY) &&
              (rect.top < clip.top - 2 || rect.bottom > clip.bottom + 2)
            )
              issues.push(`${name}: vertically clipped text`);
            if (parent === scene) break;
          }
        }
      }
      return {
        name,
        left: bounds.left,
        right: bounds.right,
        width: bounds.width,
        height: bounds.height,
        boxes,
        texts,
      };
    });
    const documentWidth = document.documentElement.scrollWidth,
      bodyWidth = document.body.scrollWidth;
    if (Math.max(documentWidth, bodyWidth) > innerWidth + 1)
      issues.push('document horizontal overflow');
    return {
      viewport: { width: innerWidth, height: innerHeight },
      documentWidth,
      bodyWidth,
      rootFontSize: getComputedStyle(document.documentElement).fontSize,
      gallery,
      cards,
      selection,
      issues: [...new Set(issues)],
    };
  }, ACTIVE);
}

describe.sequential(
  'Homepage compositions: native input and exact-source responsive evidence',
  () => {
    for (const runtime of RUNTIMES)
      for (const family of ['shadcn', 'brutalist'] as const) {
        it(`${runtime}/${family} connects the three scenes and keeps their content readable`, async () => {
          const prefix = `${source.exactSHA}-${runtime}-${family}`;
          const errors: string[] = [],
            blockedRequests: string[] = [];
          const record: Record<string, unknown> = {
            ...source,
            testSha256,
            runtime,
            family,
            route: '/en/',
            renderer: 'Astro dev server',
            theme: 'light',
            limitations: [
              'Chromium only',
              'English interaction/layout matrix; both locales covered without JavaScript',
              'Text-resize simulation, not browser page zoom',
            ],
            browser: browser.version(),
            startedAt: new Date().toISOString(),
            stage: 'context',
            outcome: 'running',
            browserZoomVerified: false,
            textScaleMethod:
              '200% text-resize simulation: pre-sampled computed font sizes doubled per text parent/input; no padding/height override',
            errors,
            blockedRequests,
            samples: [],
            screenshots: [],
          };
          const save = () =>
            writeFile(join(directory, `${prefix}.json`), JSON.stringify(record, null, 2));
          const stage = async (name: string) => {
            record.stage = name;
            await save();
          };
          let context: BrowserContext | undefined, page: Page | undefined;
          const capture = async (name: string) => {
            const filename = `${prefix}-${name}.png`;
            // Preserve the actual interaction position, including failures. A full-page
            // bitmap is not evidence of scrollY=0; record sticky-header framing.
            const framing = () =>
              page!.evaluate(() => {
                const box = (selector: string) => {
                  const node = document.querySelector<HTMLElement>(selector);
                  if (!node) return null;
                  const rect = node.getBoundingClientRect();
                  const style = getComputedStyle(node);
                  return {
                    left: rect.left,
                    top: rect.top,
                    right: rect.right,
                    bottom: rect.bottom,
                    width: rect.width,
                    height: rect.height,
                    position: style.position,
                    zIndex: style.zIndex,
                  };
                };
                return {
                  scrollX,
                  scrollY,
                  viewport: { width: innerWidth, height: innerHeight },
                  documentHeight: document.documentElement.scrollHeight,
                  header: box('header'),
                  heroHeading: box('main h1'),
                  search: box('.site-header-search'),
                };
              });
            const beforeCapture = await framing();
            record.captureFraming = { mode: 'preserve-interaction-position', beforeCapture };
            await save();
            const bytes = await page!.screenshot({
              path: join(directory, filename),
              fullPage: true,
              timeout: 5_000,
            });
            (record.screenshots as unknown[]).push({
              file: filename,
              exactSHA: source.exactSHA,
              testSha256,
              sha256: createHash('sha256').update(bytes).digest('hex'),
              stage: record.stage,
              framing: {
                mode: 'preserve-interaction-position',
                beforeCapture,
                afterCapture: await framing(),
              },
            });
            await save();
          };
          await save();
          try {
            context = await browser.newContext({
              viewport: { width: 1400, height: 1000 },
              deviceScaleFactor: 1,
              reducedMotion: 'reduce',
              colorScheme: 'light',
              serviceWorkers: 'block',
            });
            context.setDefaultTimeout(3_000);
            context.setDefaultNavigationTimeout(15_000);
            await restrictNetwork(context, blockedRequests);
            page = await context.newPage();
            page.on('pageerror', (error) => errors.push(error.message));
            await stage('navigate');
            await page.goto(`${baseUrl}/en/`, { waitUntil: 'networkidle' });
            await ready(page, 'wc', 'shadcn');
            if (runtime !== 'wc') {
              await selectPreference(page, 'runtime', RUNTIME_LABELS[runtime]);
              await ready(page, runtime, 'shadcn');
            }
            if (family !== 'shadcn') {
              await selectPreference(page, 'family', 'Brutalist');
              await ready(page, runtime, family);
            }
            expect(await page.locator(`${HOME} [data-home-demo-nojs]`).isVisible()).toBe(false);
            expect(
              await page.locator(`${HOME} [data-home-demo-status][aria-live="polite"]`).count()
            ).toBe(1);
            expect(await page.locator(`${HOME} [data-home-demo-nojs] [aria-live]`).count()).toBe(0);
            if (family === 'shadcn') {
              await stage('select-rhea');
              const trigger = page.locator(
                `${ACTIVE} [data-demo-ref="settings-view-trigger"][role="combobox"]`
              );
              const editor = page.locator(`${ACTIVE} textarea`).first();
              const originalEditor = await editor.elementHandle();
              const sameEditor = () =>
                editor.evaluate((current, original) => current === original, originalEditor);
              await editor.fill('Retain this note across Select choices');
              await trigger.press('ArrowDown');
              await attribute(trigger, 'aria-expanded', 'true');
              const portalId = await trigger.getAttribute('aria-controls');
              expect(portalId).toBeTruthy();
              const portal = page.locator(`[id=${JSON.stringify(portalId)}]`);
              await expect.poll(() => portal.count()).toBe(1);
              await expect.poll(() => portal.getByRole('option').count()).toBe(3);
              const surface = portal.locator('[data-projection-prototype="shadcn-select-surface"]');
              const group = surface.locator('[data-projection-prototype="shadcn-select-group"]');
              await expect.poll(() => group.count()).toBe(1);
              const readSelect = async () => ({
                trigger: await trigger.evaluate((element) => {
                  const css = getComputedStyle(element);
                  return {
                    radius: css.borderRadius,
                    height: element.getBoundingClientRect().height,
                    fontSize: css.fontSize,
                    gap: css.columnGap,
                  };
                }),
                popup: await surface.evaluate((element) => {
                  const css = getComputedStyle(element);
                  const leaf = element.querySelector<HTMLElement>('[data-pui-owned-decoration]');
                  const group = element.querySelector<HTMLElement>(
                    '[data-projection-prototype="shadcn-select-group"]'
                  );
                  const item = element.querySelector<HTMLElement>('[role="option"]');
                  const reference = document.createElement('span');
                  reference.setAttribute('aria-hidden', 'true');
                  reference.style.cssText =
                    'position:fixed;visibility:hidden;pointer-events:none;width:0;height:0;background:color-mix(in oklab,var(--pui-popover) 70%,transparent)';
                  element.append(reference);
                  try {
                    return {
                      radius: css.borderRadius,
                      background: css.backgroundColor,
                      expectedBackground: getComputedStyle(reference).backgroundColor,
                      themePopover: css.getPropertyValue('--pui-popover').trim(),
                      isolation: css.isolation,
                      leafCount: element.querySelectorAll('[data-pui-owned-decoration]').length,
                      filter: leaf ? getComputedStyle(leaf).backdropFilter : null,
                      leafRadius: leaf ? getComputedStyle(leaf).borderRadius : null,
                      leafAriaHidden: leaf?.getAttribute('aria-hidden'),
                      padding: group ? getComputedStyle(group).padding : null,
                      itemRadius: item ? getComputedStyle(item).borderRadius : null,
                      escaped: element.closest('[data-projection-content]') === null,
                    };
                  } finally {
                    reference.remove();
                  }
                }),
              });
              const selectPaintSamples: unknown[] = [];
              record.selectPaintSamples = selectPaintSamples;
              try {
                await expect
                  .poll(
                    async () => {
                      const facts = await readSelect();
                      selectPaintSamples.push(facts);
                      record.selectPaint = facts;
                      const { background, expectedBackground, themePopover, ...popup } =
                        facts.popup;
                      return {
                        trigger: facts.trigger,
                        popup,
                        backgroundMatches: background === expectedBackground,
                        validTheme:
                          Boolean(themePopover) &&
                          expectedBackground !== 'transparent' &&
                          expectedBackground !== 'rgba(0, 0, 0, 0)',
                      };
                    },
                    { timeout: 1500, interval: 25 }
                  )
                  .toEqual({
                    trigger: { radius: '18px', height: 32, fontSize: '14px', gap: '6px' },
                    backgroundMatches: true,
                    validTheme: true,
                    popup: {
                      radius: '18px',
                      isolation: 'isolate',
                      leafCount: 1,
                      filter: 'blur(40px) saturate(1.5)',
                      leafRadius: '18px',
                      leafAriaHidden: 'true',
                      padding: '4px',
                      itemRadius: '14px',
                      escaped: true,
                    },
                  });
              } finally {
                await save();
              }
              const background = (record.selectPaint as Awaited<ReturnType<typeof readSelect>>)
                .popup.background;
              expect(background).not.toBe('transparent');
              expect(background).not.toBe('rgba(0, 0, 0, 0)');
              await capture('select-rhea-open');
              await page.keyboard.press('End');
              await page.keyboard.press('Enter');
              await attribute(trigger, 'aria-expanded', 'false');
              await expect.poll(() => trigger.textContent()).toBe('In-app');
              await hasFocus(trigger);
              await expect
                .poll(() => editor.inputValue())
                .toBe('Retain this note across Select choices');
              expect(await sameEditor()).toBe(true);
              await trigger.press('ArrowDown');
              await attribute(trigger, 'aria-expanded', 'true');
              await page.keyboard.press('Home');
              await page.keyboard.press('Enter');
              await attribute(trigger, 'aria-expanded', 'false');
              await expect.poll(() => trigger.textContent()).toBe('Email');
              await hasFocus(trigger);
              expect(await sameEditor()).toBe(true);
              await expect
                .poll(() => editor.inputValue())
                .toBe('Retain this note across Select choices');
              await editor.fill('');
              await originalEditor!.dispose();
              record.selectJourney = [
                'Email',
                'keyboard End/Enter: In-app',
                'keyboard Home/Enter: Email',
              ];
              await save();
            }
            await stage('command');
            const command = page.locator(`${ACTIVE} [data-demo-ref="composition-command"]`);
            const input = command.getByRole('combobox', {
              name: 'Search example steps',
              exact: true,
            });
            await plan(page, 40);
            await input.fill('no-matching-workspace-step');
            await expect
              .poll(() => command.getByText('No matching steps', { exact: true }).isVisible())
              .toBe(true);
            await input.press('Enter');
            await plan(page, 40);
            await input.fill('publish');
            const disabled = command.getByRole('option', {
              name: 'Publish online (unavailable)',
              exact: true,
            });
            await attribute(disabled, 'aria-disabled', 'true');
            await input.press('ArrowDown');
            await input.press('Enter');
            await plan(page, 40);
            await input.fill('prototype');
            await expect.poll(() => command.getByRole('option').count()).toBe(1);
            await input.fill('a');
            await expect.poll(() => command.getByRole('option').count()).toBe(3);
            const activeText = async () => {
              const id = await input.getAttribute('aria-activedescendant');
              return id ? page!.locator(`[id=${JSON.stringify(id)}]`).textContent() : null;
            };
            await expect.poll(activeText).toBe('Outline an idea');
            await input.press('ArrowDown');
            await expect.poll(activeText).toBe('Build a prototype');
            if (family === 'shadcn') {
              const readPaint = () =>
                command.evaluate((root) => {
                  const input = root.querySelector<HTMLInputElement>('input')!;
                  const shell = root.querySelector<HTMLElement>(
                    '[data-projection-prototype="shadcn-input-shell"]'
                  )!;
                  const wrapper = root.querySelector<HTMLElement>(
                    '[data-projection-prototype="shadcn-command-input-wrapper"]'
                  )!;
                  const active = document.getElementById(
                    input.getAttribute('aria-activedescendant')!
                  )!;
                  const reference = document.createElement('span');
                  reference.setAttribute('aria-hidden', 'true');
                  // Zero-size detached-from-flow color probe; never changes any component style.
                  reference.style.cssText =
                    'position:fixed;visibility:hidden;pointer-events:none;width:0;height:0;background:var(--pui-muted)';
                  root.append(reference);
                  try {
                    const inner = getComputedStyle(input),
                      outer = getComputedStyle(shell),
                      item = getComputedStyle(active);
                    return {
                      rootRadius: getComputedStyle(root).borderRadius,
                      shellRadius: outer.borderRadius,
                      shellHeight: shell.getBoundingClientRect().height,
                      wrapperPadding: getComputedStyle(wrapper).padding,
                      innerRadius: inner.borderRadius,
                      innerBorder: inner.borderTopWidth,
                      innerFont: inner.fontSize,
                      activeRadius: item.borderRadius,
                      activeBackground: item.backgroundColor,
                      expectedMuted: getComputedStyle(reference).backgroundColor,
                      themeMutedToken: getComputedStyle(root)
                        .getPropertyValue('--pui-muted')
                        .trim(),
                      activeText: active.textContent,
                      shellCount: root.querySelectorAll(
                        '[data-projection-prototype="shadcn-input-shell"]'
                      ).length,
                    };
                  } finally {
                    reference.remove();
                  }
                });
              let paint = await readPaint();
              const samples = [paint];
              record.commandPaintSamples = samples;
              try {
                await expect
                  .poll(
                    async () => {
                      paint = await readPaint();
                      samples.push(paint);
                      return (
                        paint.shellCount === 1 &&
                        paint.rootRadius === '22px' &&
                        paint.shellRadius === '18px' &&
                        paint.shellHeight === 32 &&
                        paint.wrapperPadding === '4px 4px 0px' &&
                        paint.innerRadius === '0px' &&
                        paint.innerBorder === '0px' &&
                        paint.innerFont === '14px' &&
                        paint.activeRadius === '14px' &&
                        paint.activeText === 'Build a prototype' &&
                        paint.themeMutedToken.length > 0 &&
                        !['transparent', 'rgba(0, 0, 0, 0)'].includes(paint.expectedMuted) &&
                        paint.activeBackground === paint.expectedMuted
                      );
                    },
                    { timeout: 1500, interval: 25 }
                  )
                  .toBe(true);
              } finally {
                record.commandPaint = paint;
                await save();
              }
              expect(paint.themeMutedToken).not.toBe('');
              expect(paint.expectedMuted).not.toBe('rgba(0, 0, 0, 0)');
              expect(paint.expectedMuted).not.toBe('transparent');
              expect(paint.shellCount).toBe(1);
              expect(paint.rootRadius).toBe('22px');
              expect(paint.shellRadius).toBe('18px');
              expect(paint.shellHeight).toBe(32);
              expect(paint.wrapperPadding).toBe('4px 4px 0px');
              expect(paint.innerRadius).toBe('0px');
              expect(paint.innerBorder).toBe('0px');
              expect(paint.innerFont).toBe('14px');
              expect(paint.activeRadius).toBe('14px');
              expect(paint.activeBackground).toBe(paint.expectedMuted);
              expect(paint.activeText).toBe('Build a prototype');
            }
            await input.press('Enter');
            await plan(page, 60);
            await hasFocus(input);
            expect(
              await page
                .locator(`${ACTIVE} [data-demo-ref="composition-command-status"]`)
                .textContent()
            ).toBe('Selected: Build a prototype');
            record.command = {
              search: ['empty', 'disabled', 'prototype', 'a'],
              selected: 'Build a prototype',
              progress: 60,
            };
            await capture('command-60');

            await stage('slider');
            const slider = page
              .locator(ACTIVE)
              .getByRole('slider', { name: 'Adjust example plan progress', exact: true });
            const reset = page
              .locator(ACTIVE)
              .getByRole('button', { name: 'Start again', exact: true });
            await slider.focus();
            await slider.press('ArrowRight');
            await plan(page, 65);
            await hasFocus(slider);
            await slider.press('End');
            await plan(page, 100);
            await slider.press('Home');
            await plan(page, 0);
            for (let cycle = 0; cycle < 2; cycle++) {
              await reset.click();
              await plan(page, 40);
              await slider.press('ArrowRight');
              await plan(page, 45);
            }
            await reset.click();
            await plan(page, 40);
            record.slider = { observedValues: [65, 100, 0, 40, 45, 40, 45, 40] };
            await save();

            await stage('accordion');
            const help = page.locator(`${ACTIVE} [data-demo-ref="composition-help"]`);
            const questions = [
              'Where do I start?',
              'Can I use the keyboard?',
              'Where is this saved?',
            ];
            const bodies = [
              'Choose a result in the step finder',
              'Use Tab to move focus',
              'This is an interactive example',
            ];
            expect(await help.getByRole('heading', { level: 3 }).count()).toBe(3);
            await help.getByRole('button', { name: questions[0], exact: true }).press('Enter');
            await expect.poll(() => help.getByRole('region').count()).toBe(0);
            const accordionSteps: Array<Record<string, unknown>> = [];
            record.accordionSteps = accordionSteps;
            const accordionSnapshot = () =>
              help.evaluate((root) => ({
                html: root.outerHTML,
                activeElement: document.activeElement?.outerHTML ?? null,
                nodes: Array.from(
                  root.querySelectorAll<HTMLElement>('[role="region"],button,[role="button"]')
                ).map((node) => {
                  const rect = node.getBoundingClientRect();
                  const css = getComputedStyle(node);
                  return {
                    id: node.id,
                    role: node.getAttribute('role'),
                    expanded: node.getAttribute('aria-expanded'),
                    controls: node.getAttribute('aria-controls'),
                    labelledby: node.getAttribute('aria-labelledby'),
                    hidden: node.hidden,
                    ariaHidden: node.getAttribute('aria-hidden'),
                    detached: node.hasAttribute('data-pui-view-detached'),
                    display: css.display,
                    visibility: css.visibility,
                    width: rect.width,
                    height: rect.height,
                  };
                }),
              }));
            const relations: Array<{ trigger: string; panel: string }> = [];
            for (let index = 0; index < 3; index++) {
              const trigger = help.getByRole('button', { name: questions[index], exact: true });
              const step: Record<string, unknown> = {
                question: questions[index],
                before: await accordionSnapshot(),
              };
              accordionSteps.push(step);
              await save();
              await trigger.press('Enter');
              step.afterPress = await accordionSnapshot();
              await save();
              await attribute(trigger, 'aria-expanded', 'true');
              const panel = help.getByRole('region');
              await expect.poll(() => panel.count(), { timeout: 1500, interval: 25 }).toBe(1);
              step.ready = await accordionSnapshot();
              await save();
              expect(await panel.count()).toBe(1);
              const triggerId = await trigger.getAttribute('id'),
                panelId = await panel.getAttribute('id');
              expect(triggerId).toBeTruthy();
              expect(panelId).toBeTruthy();
              await attribute(trigger, 'aria-controls', panelId);
              await attribute(panel, 'aria-labelledby', triggerId);
              for (const id of [triggerId, panelId])
                expect(await page.locator(`[id=${JSON.stringify(id)}]`).count()).toBe(1);
              expect(await panel.textContent()).toContain(bodies[index]);
              await hasFocus(trigger);
              relations.push({ trigger: triggerId!, panel: panelId! });
              await trigger.press('Enter');
              await attribute(trigger, 'aria-expanded', 'false');
              await attribute(trigger, 'aria-controls', null);
              await expect.poll(() => help.getByRole('region').count()).toBe(0);
              expect(await page.locator(`[id=${JSON.stringify(panelId)}]`).count()).toBe(0);
              await hasFocus(trigger);
            }
            expect(new Set(relations.map((edge) => edge.trigger)).size).toBe(3);
            expect(new Set(relations.map((edge) => edge.panel)).size).toBe(3);
            record.accordion = relations;
            await save();
            const closedHelp = async () => {
              await settled(page!);
              const state = {
                accessibleRegions: await help.getByRole('region').count(),
                ...(await help.evaluate(
                  (root, selectedFamily) => ({
                    triggers: [...root.querySelectorAll('[aria-expanded]')].map((trigger) => ({
                      expanded: trigger.getAttribute('aria-expanded'),
                      controls: trigger.getAttribute('aria-controls'),
                    })),
                    panels: [
                      ...root.querySelectorAll<HTMLElement>(
                        `[data-projection-prototype="${selectedFamily}-accordion-content"]`
                      ),
                    ].map((panel) => ({
                      id: panel.id,
                      role: panel.getAttribute('role'),
                      labelledBy: panel.getAttribute('aria-labelledby'),
                      hidden: panel.hidden,
                      ariaHidden: panel.getAttribute('aria-hidden'),
                      detached: panel.hasAttribute('data-pui-view-detached'),
                      rects: [...panel.getClientRects()].map((rect) => ({
                        left: rect.left,
                        top: rect.top,
                        width: rect.width,
                        height: rect.height,
                      })),
                    })),
                  }),
                  family
                )),
              };
              return state;
            };
            const assertClosedHelp = (state: Awaited<ReturnType<typeof closedHelp>>) => {
              expect(state.accessibleRegions).toBe(0);
              expect(state.triggers).toHaveLength(3);
              for (const trigger of state.triggers) {
                expect(trigger.expanded).toBe('false');
                expect(trigger.controls).toBeNull();
              }
              // WC retains only detached, anonymous hosts. Other adapters must
              // withdraw the closed content subtree rather than merely hiding it.
              expect(state.panels).toHaveLength(runtime === 'wc' ? 3 : 0);
              for (const panel of state.panels) {
                expect(panel.id).toBe('');
                expect(panel.labelledBy).toBeNull();
                expect(panel.detached).toBe(true);
                expect(panel.rects).toHaveLength(0);
                if (panel.role === 'region') {
                  expect(panel.hidden).toBe(true);
                  expect(panel.ariaHidden).toBe('true');
                }
              }
            };
            record.accordionClosed = await closedHelp();
            await save();
            assertClosedHelp(record.accordionClosed as Awaited<ReturnType<typeof closedHelp>>);
            // Longest answer and all results remain visible during every layout sample.
            await help.getByRole('button', { name: questions[2], exact: true }).press('Enter');
            await input.fill('');
            for (const layout of LAYOUTS) {
              await stage(`layout-${layout.name}`);
              await page.setViewportSize({ width: layout.width, height: 1000 });
              if (layout.textScale === 200) {
                record.textResize = await resizeText200(page);
                await save();
              }
              await ready(page, runtime, family);
              const facts = await layoutFacts(page);
              const flow = galleryFlowEvidence(facts.gallery);
              (record.samples as unknown[]).push({
                name: layout.name,
                textScale: layout.textScale,
                browserZoomVerified: false,
                ...facts,
                flow,
              });
              await save();
              await capture(layout.name);
              expect(facts.cards.map((card) => card.name).sort()).toEqual([
                'workspace-command',
                'workspace-help',
                'workspace-progress',
              ]);
              if (layout.textScale === 200) {
                const samples = record.textResize as Array<{
                  before: number;
                  after: number;
                  scene: string | null;
                }>;
                expect(samples.length).toBeGreaterThan(0);
                for (const scene of ['workspace-command', 'workspace-progress', 'workspace-help'])
                  expect(samples.some((sample) => sample.scene === scene)).toBe(true);
                for (const sample of samples)
                  expect(sample.after).toBeCloseTo(sample.before * 2, 3);
              }
              expect(captureSelectionIssues(facts.selection, runtime, family)).toEqual([]);
              expect(flow.issues, JSON.stringify(flow.issues)).toEqual([]);
              expect(facts.issues, JSON.stringify(facts.issues)).toEqual([]);
              await plan(page, 40);
              if (layout.name === '320') {
                // Exercise real contraction at the narrow viewport BEFORE text
                // resizing. Non-WC adapters may remount Text on reopening; the
                // next 200% sample measures those actual, newly mounted nodes.
                await stage('layout-320-accordion-close');
                const trigger = help.getByRole('button', { name: questions[2], exact: true });
                const panel = help.getByRole('region');
                expect(await panel.count()).toBe(1);
                const triggerId = await trigger.getAttribute('id');
                const previousPanelId = await panel.getAttribute('id');
                expect(triggerId).toBeTruthy();
                expect(previousPanelId).toBeTruthy();
                await attribute(trigger, 'aria-controls', previousPanelId);
                await attribute(panel, 'aria-labelledby', triggerId);
                const panelHeight = await panel.evaluate(
                  (node) => node.getBoundingClientRect().height
                );
                await trigger.press('Enter');
                await attribute(trigger, 'aria-expanded', 'false');
                const closed = await closedHelp();
                const closedFacts = await layoutFacts(page);
                const closedFlow = galleryFlowEvidence(closedFacts.gallery);
                record.accordionReflow = {
                  textScale: 100,
                  viewportWidth: 320,
                  before: {
                    triggerId,
                    panelId: previousPanelId,
                    panelHeight,
                    gallery: facts.gallery,
                    flow,
                  },
                  closed: {
                    state: closed,
                    gallery: closedFacts.gallery,
                    flow: closedFlow,
                    issues: closedFacts.issues,
                  },
                };
                await save();
                assertClosedHelp(closed);
                expect(await page.locator(`[id=${JSON.stringify(previousPanelId)}]`).count()).toBe(
                  0
                );
                await hasFocus(trigger);
                expect(captureSelectionIssues(closedFacts.selection, runtime, family)).toEqual([]);
                expect(closedFlow.issues, JSON.stringify(closedFlow.issues)).toEqual([]);
                expect(closedFacts.issues, JSON.stringify(closedFacts.issues)).toEqual([]);
                const beforeHelp = facts.gallery.cards.find(
                  (card) => card.id === 'workspace-help'
                )!;
                const afterHelp = closedFacts.gallery.cards.find(
                  (card) => card.id === 'workspace-help'
                )!;
                expect(panelHeight).toBeGreaterThan(1);
                expect(beforeHelp.rect.height - afterHelp.rect.height).toBeGreaterThanOrEqual(
                  panelHeight - 1
                );
                await stage('layout-320-accordion-reopen');
                await trigger.press('Enter');
                await attribute(trigger, 'aria-expanded', 'true');
                await settled(page);
                expect(await panel.count()).toBe(1);
                const reopenedPanelId = await panel.getAttribute('id');
                expect(reopenedPanelId).toBeTruthy();
                await attribute(trigger, 'id', triggerId);
                await attribute(trigger, 'aria-controls', reopenedPanelId);
                await attribute(panel, 'aria-labelledby', triggerId);
                for (const id of [triggerId, reopenedPanelId])
                  expect(await page.locator(`[id=${JSON.stringify(id)}]`).count()).toBe(1);
                expect(await panel.textContent()).toContain(bodies[2]);
                await hasFocus(trigger);
                const reopenedFacts = await layoutFacts(page);
                const reopenedFlow = galleryFlowEvidence(reopenedFacts.gallery);
                (record.accordionReflow as Record<string, unknown>).reopened = {
                  triggerId,
                  panelId: reopenedPanelId,
                  gallery: reopenedFacts.gallery,
                  flow: reopenedFlow,
                  issues: reopenedFacts.issues,
                };
                await save();
                expect(captureSelectionIssues(reopenedFacts.selection, runtime, family)).toEqual(
                  []
                );
                expect(reopenedFlow.issues, JSON.stringify(reopenedFlow.issues)).toEqual([]);
                expect(reopenedFacts.issues, JSON.stringify(reopenedFacts.issues)).toEqual([]);
                const reopenedHelp = reopenedFacts.gallery.cards.find(
                  (card) => card.id === 'workspace-help'
                )!;
                expect(
                  Math.abs(reopenedHelp.rect.height - beforeHelp.rect.height)
                ).toBeLessThanOrEqual(1);
                await plan(page, 40);
              }
            }
            expect(errors).toEqual([]);
            expect(blockedRequests).toEqual([]);
            record.outcome = 'passed';
          } catch (error) {
            record.outcome = 'failed';
            record.failure = String(error);
            await save();
            if (page) {
              try {
                record.failureDOM = await page.evaluate(() => ({
                  help:
                    document.querySelector(
                      '[data-projection-generation-state="active"] [data-demo-ref="composition-help"]'
                    )?.outerHTML ?? null,
                  activeElement: document.activeElement?.outerHTML ?? null,
                  generations: Array.from(
                    document.querySelectorAll(
                      '[data-home-showcase="website-component-gallery"] [data-projection-generation-state]'
                    )
                  ).map((node) => ({
                    state: node.getAttribute('data-projection-generation-state'),
                    generation: node.getAttribute('data-projection-generation'),
                  })),
                }));
                await save();
                await capture('failure');
              } catch (captureError) {
                record.captureFailure = String(captureError);
                await save();
              }
            }
            throw error;
          } finally {
            record.finishedAt = new Date().toISOString();
            try {
              await save();
            } finally {
              await context?.close();
            }
          }
        }, 45_000);
      }
  }
);

it('without JavaScript both localized homepages retain a readable documentation route', async () => {
  for (const locale of ['en', 'zh-cn']) {
    const prefix = `${source.exactSHA}-nojs-${locale}`;
    const blockedRequests: string[] = [];
    const record: Record<string, unknown> = {
      ...source,
      testSha256,
      locale,
      javaScriptEnabled: false,
      outcome: 'running',
      stage: 'navigate',
      blockedRequests,
      screenshots: [],
    };
    const save = () =>
      writeFile(join(directory, `${prefix}.json`), JSON.stringify(record, null, 2));
    await save();
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 320, height: 1000 },
      serviceWorkers: 'block',
    });
    context.setDefaultTimeout(3_000);
    context.setDefaultNavigationTimeout(10_000);
    let page: Page | undefined;
    const capture = async (name: string) => {
      const filename = `${prefix}-${name}.png`;
      const bytes = await page!.screenshot({
        path: join(directory, filename),
        fullPage: true,
        timeout: 3_000,
      });
      (record.screenshots as unknown[]).push({
        file: filename,
        exactSHA: source.exactSHA,
        testSha256,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
      await save();
    };
    try {
      await restrictNetwork(context, blockedRequests);
      page = await context.newPage();
      await page.goto(`${baseUrl}/${locale}/`, { waitUntil: 'networkidle' });
      const fallback = page.locator(`${HOME} [data-home-demo-nojs]`);
      record.text = await fallback.textContent();
      record.hostVisible = await page.locator(`${HOME} [data-home-demo-host]`).isVisible();
      record.statusVisible = await page.locator(`${HOME} [data-home-demo-status]`).isVisible();
      await capture('fallback');
      expect(await fallback.isVisible()).toBe(true);
      expect(record.text).toContain(
        locale === 'en'
          ? 'These interactive examples need JavaScript.'
          : '这些交互示例需要 JavaScript。'
      );
      expect(record.hostVisible).toBe(false);
      expect(record.statusVisible).toBe(false);
      const link = fallback.getByRole('link');
      const destination = `/${locale}/ui-libraries/shadcn/accordion/`;
      expect(await link.count()).toBe(1);
      expect(await link.getAttribute('href')).toBe(destination);
      record.stage = 'native-documentation-navigation';
      await save();
      await link.click();
      await page.waitForURL(`${baseUrl}${destination}`, { waitUntil: 'domcontentloaded' });
      record.destination = new URL(page.url()).pathname;
      record.documentationTitle = await page.locator('h1').textContent();
      expect(record.destination).toBe(destination);
      expect(typeof record.documentationTitle).toBe('string');
      expect((record.documentationTitle as string).trim().length).toBeGreaterThan(0);
      expect(blockedRequests).toEqual([]);
      record.outcome = 'passed';
    } catch (error) {
      record.outcome = 'failed';
      record.failure = String(error);
      await save();
      if (page) {
        try {
          await capture('failure');
        } catch (captureError) {
          record.captureFailure = String(captureError);
          await save();
        }
      }
      throw error;
    } finally {
      try {
        await save();
      } finally {
        await context.close();
      }
    }
  }
}, 30_000);

it('CommandInput fits actual narrow parents across four runtimes without clipping or losing grow', async () => {
  const records: Array<Record<string, unknown>> = [];
  const failures: string[] = [];
  const output = join(directory, 'command-width.json');
  const save = () =>
    writeFile(output, JSON.stringify({ ...source, testSha256, fixtureSha256, records }, null, 2));
  for (const runtime of RUNTIMES) {
    const blockedRequests: string[] = [];
    const record: Record<string, unknown> = {
      runtime,
      outcome: 'running',
      blockedRequests,
      samples: [],
      screenshots: [],
    };
    records.push(record);
    await save();
    const context = await browser.newContext({
      viewport: { width: 1180, height: 900 },
      serviceWorkers: 'block',
      colorScheme: 'light',
    });
    context.setDefaultTimeout(2_000);
    context.setDefaultNavigationTimeout(8_000);
    const errors: string[] = [];
    let page: Page | undefined;
    try {
      await restrictNetwork(context, blockedRequests);
      page = await context.newPage();
      page.on('pageerror', (error) => errors.push(String(error)));
      await page.goto(`${baseUrl}/en/test/command-width/?runtime=${runtime}`, {
        waitUntil: 'networkidle',
      });
      await page.waitForFunction(
        () =>
          document
            .querySelector('[data-command-width-fixture]')
            ?.getAttribute('data-mount-state') === 'ready'
      );
      expect(await page.locator('[data-command-width-error]').textContent()).toBe('');
      for (const textPercent of [100, 200]) {
        const sample: Record<string, unknown> = { textPercent, outcome: 'running' };
        (record.samples as unknown[]).push(sample);
        try {
          await page.evaluate((percent) => {
            document.documentElement.style.fontSize = `${percent}%`;
          }, textPercent);
          await page.evaluate(
            () =>
              new Promise<void>((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
              )
          );
          for (const family of ['shadcn', 'brutalist']) {
            const editable = page.locator(`[data-width-case="${family}-144-value"] input`);
            await editable.fill(
              'Actual native editing with a long value abcdefghijklmnopqrstuvwxyz0123456789'
            );
            expect(await editable.inputValue()).toBe(
              'Actual native editing with a long value abcdefghijklmnopqrstuvwxyz0123456789'
            );
            expect(
              await page.locator(`[data-width-case="${family}-144-disabled"] input`).isDisabled()
            ).toBe(true);
          }
          const facts = await page.evaluate(() =>
            Array.from(document.querySelectorAll<HTMLElement>('[data-width-case]')).map((owner) => {
              const input = owner.querySelector('input')!;
              const root = owner.querySelector<HTMLElement>('[data-pui-root]')!;
              const host = input.parentElement!;
              const box = (element: Element) => {
                const r = element.getBoundingClientRect();
                return { left: r.left, right: r.right, width: r.width };
              };
              return {
                id: owner.dataset.widthCase,
                parentWidth: Number(owner.dataset.width),
                variant: owner.dataset.variant,
                parent: box(owner),
                root: box(root),
                host: box(host),
                input: box(input),
                layout: [root, host, input].map((node) => {
                  const css = getComputedStyle(node);
                  return {
                    tag: node.tagName,
                    html: node.outerHTML,
                    display: css.display,
                    width: css.width,
                    minWidth: css.minWidth,
                    maxWidth: css.maxWidth,
                    flex: css.flex,
                    flexBasis: css.flexBasis,
                    boxSizing: css.boxSizing,
                    paddingLeft: css.paddingLeft,
                    paddingRight: css.paddingRight,
                    borderLeftWidth: css.borderLeftWidth,
                    borderRightWidth: css.borderRightWidth,
                  };
                }),
                font: getComputedStyle(input).fontSize,
                grow: getComputedStyle(input).flexGrow,
                rootOverflow: getComputedStyle(root).overflowX,
                hostOverflow: getComputedStyle(host).overflowX,
                value: input.value,
                placeholder: input.placeholder,
                disabled: input.disabled,
              };
            })
          );
          Object.assign(sample, {
            facts,
            documentWidth: await page.evaluate(() => document.documentElement.scrollWidth),
          });
          await save();
          expect(facts.map((fact) => fact.id)).toEqual(
            ['shadcn', 'brutalist'].flatMap((family) =>
              [144, 224, 360].flatMap((width) =>
                ['placeholder', 'value', 'disabled'].map(
                  (variant) => `${family}-${width}-${variant}`
                )
              )
            )
          );
          for (const fact of facts) {
            expect(fact.parent.width).toBeCloseTo(fact.parentWidth, 3);
            expect(fact.input.width).toBeGreaterThan(0);
            expect(fact.input.width).toBeCloseTo(fact.parentWidth, 0);
            expect(fact.input.left).toBeGreaterThanOrEqual(fact.parent.left - 1);
            expect(fact.input.right).toBeLessThanOrEqual(fact.parent.right + 1);
            expect(fact.host.right).toBeLessThanOrEqual(fact.parent.right + 1);
            expect(fact.rootOverflow).toBe('visible');
            expect(fact.hostOverflow).toBe('visible');
            expect(fact.grow).toBe('1');
            expect(fact.font).toBe(textPercent === 100 ? '16px' : '32px');
            expect(fact.placeholder).toContain('abcdefghijklmnopqrstuvwxyz');
            expect(fact.disabled).toBe(fact.variant === 'disabled');
            if (fact.variant !== 'placeholder') expect(fact.value.length).toBeGreaterThan(60);
          }
          expect(sample.documentWidth).toBeLessThanOrEqual(1181);
          sample.outcome = 'passed';
        } catch (error) {
          sample.outcome = 'failed';
          sample.error = String(error);
          failures.push(`${runtime}/${textPercent}: ${error}`);
        } finally {
          await save();
          const filename = `${source.exactSHA}-command-width-${runtime}-${textPercent}-${sample.outcome}.png`;
          const bytes = await page.screenshot({
            path: join(directory, filename),
            fullPage: true,
            timeout: 2_000,
          });
          (record.screenshots as unknown[]).push({
            file: filename,
            exactSHA: source.exactSHA,
            sha256: createHash('sha256').update(bytes).digest('hex'),
          });
          await save();
        }
      }
      expect(errors).toEqual([]);
      expect(blockedRequests).toEqual([]);
      record.outcome = 'observed';
    } catch (error) {
      record.outcome = 'failed';
      record.error = String(error);
      failures.push(`${runtime}/setup: ${error}`);
      await save();
      if (page) {
        try {
          const filename = `${source.exactSHA}-command-width-${runtime}-early-failure.png`;
          const bytes = await page.screenshot({
            path: join(directory, filename),
            fullPage: true,
            timeout: 2_000,
          });
          (record.screenshots as unknown[]).push({
            file: filename,
            exactSHA: source.exactSHA,
            sha256: createHash('sha256').update(bytes).digest('hex'),
          });
        } catch (captureError) {
          record.captureError = String(captureError);
        }
      }
    } finally {
      record.pageErrors = errors;
      await save();
      await context.close();
    }
  }
  expect(failures).toEqual([]);
}, 30_000);
