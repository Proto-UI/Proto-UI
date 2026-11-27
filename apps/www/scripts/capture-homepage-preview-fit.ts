/**
 * One candidate-owned, read-only observer runs against two clean source trees.
 * The shared harness owns its Astro server and keeps Chromium's sandbox on.
 * No DOM, CSS, zoom, focus, component state or screenshot pixels are replaced.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import type { Browser, Page } from 'playwright-core';
import {
  galleryFlowEvidence,
  galleryHorizontalIssues,
  groupPaintedCards,
  HOMEPAGE_GALLERY_IDS,
  readGalleryRhythm,
  WIDE_GALLERY_COLUMNS,
} from '../src/components/Homepage/homepage-layout-evidence';
import { launchBrowser, startServer, stopServer } from '../src/content/docs/zh-cn/browser-harness';

const { values } = parseArgs({
  options: {
    'revision-kind': { type: 'string' },
    'expected-revision': { type: 'string' },
    'expected-probe-revision': { type: 'string' },
    out: { type: 'string' },
  },
});
const kind = values['revision-kind'];
assert.ok(kind === 'baseline' || kind === 'candidate');
assert.match(values['expected-revision'] ?? '', /^[a-f0-9]{40}$/);
assert.match(values['expected-probe-revision'] ?? '', /^[a-f0-9]{40}$/);
assert.ok(values.out, '--out is required');
assert.ok(!process.env.PROTO_UI_BROWSER_BASE_URL, 'The probe must own its source-bound server');
const out = path.resolve(values.out);
await mkdir(out, { recursive: true });
const script = fileURLToPath(import.meta.url);
const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
const sourceRoot = git(process.cwd(), 'rev-parse', '--show-toplevel');
const probeRoot = git(path.dirname(script), 'rev-parse', '--show-toplevel');
const identity = (root: string) => ({
  revision: git(root, 'rev-parse', 'HEAD'),
  tree: git(root, 'rev-parse', 'HEAD^{tree}'),
  status: git(root, 'status', '--porcelain', '--untracked-files=all'),
});
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
async function fileBinding(root: string, relativePath: string) {
  const bytes = await readFile(path.join(root, relativePath));
  return { path: relativePath, bytes: bytes.length, sha256: hash(bytes) };
}
const generatedNames = [
  'shadcn-theme.css',
  'proto-ui-style.css',
  'proto-ui-tokens.generated.css',
  'proto-ui-shadow-style.generated.js',
  'proto-ui-shadow-style.generated.d.ts',
];
// Reading order of the workflow's immutable before image.
const baselineGalleryIds = [
  'controls',
  'shortcuts',
  'workspace-analytics',
  'workspace-command',
  'preferences',
  'workspace-progress',
  'hover',
  'editor',
  'workspace-help',
  'overlays',
  'spark',
  'choices',
];
const plan = ['zh-cn', 'en'].flatMap((locale) =>
  [
    { width: 390, height: 844 },
    { width: 1440, height: 1000 },
    { width: 1920, height: 1080 },
  ].flatMap((viewport) =>
    (['light', 'dark'] as const).map((theme) => ({
      id: `${locale}-${viewport.width}-${theme}`,
      locale,
      theme,
      viewport,
    }))
  )
);
const report = {
  schemaVersion: 1,
  revisionKind: kind,
  expectedRevision: values['expected-revision'],
  expectedProbeRevision: values['expected-probe-revision'],
  source: identity(sourceRoot),
  probe: {
    ...identity(probeRoot),
    files: await Promise.all(
      [
        'apps/www/scripts/capture-homepage-preview-fit.ts',
        'apps/www/src/components/Homepage/homepage-layout-evidence.ts',
        'apps/www/src/content/docs/zh-cn/browser-harness.ts',
        'scripts/test/server-readiness.mjs',
      ].map((file) => fileBinding(probeRoot, file))
    ),
  },
  node: process.version,
  renderer: 'source-bound Astro dev server; normal project devToolbar preference',
  browser: '',
  chromiumSandbox: true,
  deviceScaleFactor: 1,
  reducedMotion: 'no-preference',
  github: {
    runId: process.env.GITHUB_RUN_ID,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    event: process.env.GITHUB_EVENT_NAME,
    ref: process.env.GITHUB_REF,
  },
  startedAt: new Date().toISOString(),
  finishedAt: null as string | null,
  plan,
  generatedFiles: [] as Awaited<ReturnType<typeof fileBinding>>[],
  generatedFilesAfter: [] as Awaited<ReturnType<typeof fileBinding>>[],
  sourceAfter: null as ReturnType<typeof identity> | null,
  cases: [] as Array<Record<string, unknown>>,
  failures: [] as string[],
  acceptance: 'pending-independent-visual-review-and-project-gates',
  limitations: [
    'Twelve initial WC/Shadcn views per source; this is not complete Runtime/family coverage',
    'Initial live DOM observations do not prove dynamic interaction; selected native tests are separate',
    'No screenshot-state injection, browser-zoom, assistive-technology or other-engine acceptance',
    'Historical width need not fail in modern Chromium; old toggle and scaled fade remain observations',
  ],
};
async function save() {
  await writeFile(path.join(out, 'metrics.next.json'), `${JSON.stringify(report, null, 2)}\n`);
  await rename(path.join(out, 'metrics.next.json'), path.join(out, 'metrics.json'));
}
await save();

async function measure(page: Page) {
  const facts = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('[data-home-showcase]');
    const host = root?.querySelector<HTMLElement>('[data-home-demo-host]');
    const stage = host?.querySelector<HTMLElement>('[data-home-gallery-stage]');
    if (!root || !host || !stage || !stage.parentElement)
      throw new Error('Missing real homepage gallery layout');
    const viewport = host.querySelector<HTMLElement>('[data-home-gallery-viewport]');
    const fadeOwner = viewport ?? stage;
    // Object methods avoid host-only name helpers in the serialized browser callback.
    const { number, geometry, isVisible } = {
      number(value: string) {
        return Number.parseFloat(value) || 0;
      },
      geometry(element: HTMLElement) {
        const style = getComputedStyle(element);
        const bounds = element.getBoundingClientRect();
        const borderX = number(style.borderLeftWidth) + number(style.borderRightWidth);
        const paddingX = number(style.paddingLeft) + number(style.paddingRight);
        const cssBorderWidth =
          number(style.width) + (style.boxSizing === 'border-box' ? 0 : borderX + paddingX);
        const physicalScaleX = cssBorderWidth > 0 ? bounds.width / cssBorderWidth : null;
        return {
          rect: bounds.toJSON(),
          offsetWidth: element.offsetWidth,
          offsetHeight: element.offsetHeight,
          clientWidth: element.clientWidth,
          clientHeight: element.clientHeight,
          cssWidth: style.width,
          cssHeight: style.height,
          cssZoom: style.zoom,
          transform: style.transform,
          boxSizing: style.boxSizing,
          physicalScaleX,
          contentLeft:
            bounds.left +
            (number(style.borderLeftWidth) + number(style.paddingLeft)) * (physicalScaleX ?? NaN),
          contentRight:
            bounds.right -
            (number(style.borderRightWidth) + number(style.paddingRight)) * (physicalScaleX ?? NaN),
          physicalContentWidth:
            physicalScaleX === null ? null : bounds.width - (borderX + paddingX) * physicalScaleX,
        };
      },
      isVisible(element: HTMLElement) {
        const style = getComputedStyle(element),
          rect = element.getBoundingClientRect();
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          !element.closest('[hidden]')
        );
      },
    };
    const cards = [...stage.querySelectorAll<HTMLElement>('[data-gallery-demo]')];
    const flow = stage.querySelector('.home-gallery__flow');
    const flowStyle = flow && getComputedStyle(flow);
    const queryBox = viewport && geometry(viewport);
    const toggles = [...root.querySelectorAll<HTMLElement>('[data-home-gallery-layout-toggle]')];
    const fade = getComputedStyle(fadeOwner, '::after');
    const ancestorZoom: Array<{ tag: string; className: string; zoom: string; transform: string }> =
      [];
    for (let element: HTMLElement | null = fadeOwner; element; element = element.parentElement) {
      const style = getComputedStyle(element);
      ancestorZoom.push({
        tag: element.tagName,
        className: element.className,
        zoom: style.zoom,
        transform: style.transform,
      });
    }
    return {
      viewport: { width: innerWidth, height: innerHeight, deviceScaleFactor: devicePixelRatio },
      documentWidth: document.documentElement.scrollWidth,
      bodyBackgroundColor: getComputedStyle(document.body).backgroundColor,
      rootFontSize: number(getComputedStyle(document.documentElement).fontSize),
      wideMedia: matchMedia('(min-width: 96rem)').matches,
      enhancedMedia: matchMedia('(48rem <= width < 96rem)').matches,
      readingFlowSupported: CSS.supports('reading-flow', 'flex-visual'),
      flowDisplay: flowStyle?.display ?? '',
      flowReadingFlow: flowStyle?.getPropertyValue('reading-flow').trim() ?? '',
      queryContainerWidth:
        queryBox?.physicalScaleX && queryBox.physicalContentWidth !== null
          ? queryBox.physicalContentWidth / queryBox.physicalScaleX
          : NaN,
      theme: document.documentElement.dataset.theme,
      scroll: { x: scrollX, y: scrollY },
      readyState: document.readyState,
      fontStatus: document.fonts.status,
      runnerState: root.dataset.runnerState,
      runtime: root.dataset.runnerRuntime,
      family: root.dataset.projectionFamily,
      compact: root.dataset.homeGalleryCompact === 'true',
      stageInert: stage.inert,
      showcase: geometry(root),
      host: geometry(host),
      stage: geometry(stage),
      stageCount: host.querySelectorAll('[data-home-gallery-stage]').length,
      columnGap: number(getComputedStyle(stage).columnGap),
      parent: geometry(stage.parentElement),
      unscaledViewport: viewport ? geometry(viewport) : null,
      cardCount: cards.length,
      cards: cards.map((card) => ({
        id: card.dataset.galleryDemo,
        visible: isVisible(card),
        connected: card.isConnected,
        livePrototypeRoots:
          card.querySelectorAll('[data-pui-root]').length + Number(card.matches('[data-pui-root]')),
        bounds: card.getBoundingClientRect().toJSON(),
        rowGap: number(getComputedStyle(card).marginBlockEnd),
        fragments: [...card.getClientRects()].map((rect) => rect.toJSON()),
      })),
      toggles: toggles.map((toggle) => ({ text: toggle.textContent, visible: isVisible(toggle) })),
      fade: {
        owner: viewport ? 'viewport' : 'stage',
        ownerSelector: viewport ? '[data-home-gallery-viewport]' : '[data-home-gallery-stage]',
        ownerGeometry: geometry(fadeOwner),
        computedHeight: fade.height,
        computedContent: fade.content,
        display: fade.display,
        visibility: fade.visibility,
        pointerEvents: fade.pointerEvents,
        backgroundImage: fade.backgroundImage,
        ancestorZoom,
      },
    };
  });
  return { ...facts, rhythm: await page.evaluate(readGalleryRhythm) };
}

async function pseudoBox(page: Page, selector: string) {
  const session = await page.context().newCDPSession(page);
  try {
    const { root } = await session.send('DOM.getDocument', { depth: 0 });
    const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector });
    assert.ok(nodeId, `Missing fade owner ${selector}`);
    const { node } = await session.send('DOM.describeNode', { nodeId, depth: 1 });
    const pseudo = node.pseudoElements?.find((element) => element.pseudoType === 'after');
    assert.ok(pseudo, 'The real ::after layout box must exist');
    const { model } = await session.send('DOM.getBoxModel', {
      backendNodeId: pseudo.backendNodeId,
    });
    const xs = model.border.filter((_, index) => index % 2 === 0);
    const ys = model.border.filter((_, index) => index % 2 === 1);
    return {
      method: 'CDP DOM.getBoxModel on the actual ::after pseudo-element; screenshot CSS pixels',
      physicalWidth: Math.max(...xs) - Math.min(...xs),
      physicalHeight: Math.max(...ys) - Math.min(...ys),
      borderQuad: model.border,
      contentQuad: model.content,
      layoutWidth: model.width,
      layoutHeight: model.height,
    };
  } finally {
    await session.detach();
  }
}

function candidateFailures(
  facts: Awaited<ReturnType<typeof measure>>,
  fadeBox: Awaited<ReturnType<typeof pseudoBox>>
) {
  const failures: string[] = [];
  const check = (condition: boolean, message: string) => {
    if (!condition) failures.push(message);
  };
  check(facts.toggles.length === 0, 'The extra layout toggle must be absent, not only hidden');
  check(facts.documentWidth <= facts.viewport.width + 1, 'The page must not overflow horizontally');
  check(
    facts.parent.physicalContentWidth !== null &&
      Math.abs(facts.stage.rect.width - facts.parent.physicalContentWidth) <= 1,
    'The physical stage must fill the actual parent content width'
  );
  check(
    facts.host.physicalContentWidth !== null &&
      facts.unscaledViewport !== null &&
      Math.abs(facts.unscaledViewport.rect.width - facts.host.physicalContentWidth) <= 1,
    'The viewport must use the complete available live host width'
  );
  check(facts.fade.owner === 'viewport', 'The fade must belong to the unscaled viewport');
  check(
    facts.fade.ancestorZoom.every((item) => Number(item.zoom) === 1 && item.transform === 'none'),
    'No zoom or transform may scale the viewport fade'
  );
  check(
    facts.fade.display !== 'none' &&
      facts.fade.visibility === 'visible' &&
      facts.fade.pointerEvents === 'none' &&
      facts.fade.backgroundImage.includes('linear-gradient'),
    'The initial non-interactive gradient must actually be visible'
  );
  const expectedHeight = Math.min(
    facts.rhythm.fadeRem * facts.rootFontSize,
    facts.fade.ownerGeometry.rect.height * 0.28
  );
  check(
    Number.isFinite(expectedHeight) &&
      expectedHeight > 0 &&
      Math.abs(fadeBox.physicalHeight - expectedHeight) <= 1,
    'The painted fade must use the unscaled family and breakpoint height capped at 28%'
  );
  check(
    facts.compact === facts.viewport.width < 768 && facts.stageInert === facts.compact,
    'Only the initial mobile overview is compact and inert'
  );
  return failures;
}

let browser: Browser | undefined;
try {
  assert.equal(report.source.revision, report.expectedRevision, 'Wrong subject revision');
  assert.equal(report.probe.revision, report.expectedProbeRevision, 'Wrong probe revision');
  assert.equal(report.source.status, '', 'The subject source must be clean');
  assert.equal(report.probe.status, '', 'The probe source must be clean');
  const baseUrl = await startServer(['/zh-cn/', '/en/']);
  report.generatedFiles = await Promise.all(
    generatedNames.map((name) => fileBinding(sourceRoot, `apps/www/src/styles/${name}`))
  );
  browser = await launchBrowser();
  report.browser = browser.version();
  await save();
  for (const item of plan) {
    const entry: Record<string, unknown> = {
      ...item,
      outcome: 'running',
      pageErrors: [],
      screenshots: [],
    };
    report.cases.push(entry);
    const context = await browser.newContext({
      viewport: item.viewport,
      colorScheme: item.theme,
      deviceScaleFactor: 1,
      reducedMotion: 'no-preference',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    page.on('pageerror', (error) => (entry.pageErrors as string[]).push(error.message));
    const capture = async (suffix: string, fullPage = false) => {
      const filename = `${item.id}-${suffix}.png`;
      // Match Playwright's actual full-page extent, including a historical
      // horizontal overflow. A before-image may truthfully exceed the viewport.
      const documentExtent = await page.evaluate(() => ({
        width: Math.max(
          document.body.scrollWidth,
          document.documentElement.scrollWidth,
          document.body.offsetWidth,
          document.documentElement.offsetWidth,
          document.body.clientWidth,
          document.documentElement.clientWidth
        ),
        height: Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight,
          document.body.offsetHeight,
          document.documentElement.offsetHeight,
          document.body.clientHeight,
          document.documentElement.clientHeight
        ),
      }));
      const bytes = await page.screenshot({
        path: path.join(out, filename),
        fullPage,
        caret: 'initial',
      });
      (entry.screenshots as unknown[]).push({
        file: filename,
        documentExtent,
        sha256: hash(bytes),
        bytes: bytes.length,
        width: bytes.readUInt32BE(16),
        height: bytes.readUInt32BE(20),
      });
    };
    try {
      await page.goto(`${baseUrl}/${item.locale}/`, { waitUntil: 'networkidle' });
      await page.waitForFunction((theme) => {
        const root = document.querySelector<HTMLElement>('[data-home-showcase]');
        const host = root?.querySelector('[data-home-demo-host]');
        const scope = host?.querySelector<HTMLElement>('[data-projection-scope]');
        return (
          root?.dataset.runnerState === 'ready' &&
          root.dataset.runnerRuntime === 'wc' &&
          host?.getAttribute('aria-busy') === 'false' &&
          scope?.dataset.projectionRuntime === 'wc' &&
          scope?.dataset.projectionState === 'ready' &&
          Boolean(scope.querySelector('[data-pui-root]')) &&
          !host.textContent?.includes('[Home Demo Error]') &&
          document.documentElement.dataset.theme === theme &&
          document.fonts.status === 'loaded'
        );
      }, item.theme);
      // Only synchronize normal layout delivery; this changes no page state.
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      );
      const facts = await measure(page);
      entry.facts = facts;
      await capture('initial-viewport');
      await capture('initial-full', true);
      const fadeBox = await pseudoBox(page, facts.fade.ownerSelector);
      entry.fadeBox = fadeBox;
      entry.fadeScaleObservation = {
        computedCssHeight: Number.parseFloat(facts.fade.computedHeight),
        physicalHeight: fadeBox.physicalHeight,
        physicalToComputedRatio:
          fadeBox.physicalHeight / Number.parseFloat(facts.fade.computedHeight),
      };
      const failures: string[] = kind === 'candidate' ? candidateFailures(facts, fadeBox) : [];
      const cards = facts.cards.map((card) => ({
        ...card,
        id: card.id ?? null,
        rect: card.bounds,
      }));
      if (kind === 'candidate' && item.viewport.width === 390) {
        failures.push(
          ...galleryHorizontalIssues(
            { left: facts.stage.contentLeft, right: facts.stage.contentRight },
            cards
          )
        );
        const columns = groupPaintedCards(cards).map((column) => column.map((card) => card.id));
        entry.compactColumns = columns;
        if (JSON.stringify(columns) !== JSON.stringify(WIDE_GALLERY_COLUMNS))
          failures.push('The inert overview must show all five authored columns in order');
      } else if (kind === 'candidate') {
        const flow = galleryFlowEvidence({
          containerCount: facts.stageCount,
          container: {
            ...facts.stage.rect,
            left: facts.stage.contentLeft,
            right: facts.stage.contentRight,
            width: facts.stage.contentRight - facts.stage.contentLeft,
          },
          wideMedia: facts.wideMedia,
          gapRem: facts.rhythm.gapRem,
          enhancedMedia: facts.enhancedMedia,
          queryContainerWidth: facts.queryContainerWidth,
          readingFlowSupported: facts.readingFlowSupported,
          flowDisplay: facts.flowDisplay,
          flowReadingFlow: facts.flowReadingFlow,
          viewportWidth: facts.viewport.width,
          rootFontSize: facts.rootFontSize,
          columnGap: facts.columnGap,
          cards,
        });
        entry.galleryFlow = flow;
        failures.push(...flow.issues);
        if (item.viewport.width === 1440 && flow.columns.length !== 4)
          failures.push('Expected four painted columns at 1440px');
        if (item.viewport.width === 1440 && flow.enhancedExpected) {
          const rowGap = flow.columns[0]?.adjacentGaps[0]?.gap;
          if (
            rowGap === undefined ||
            !(rowGap > 0) ||
            flow.bottomSpread === null ||
            !(flow.bottomSpread <= 2 * rowGap)
          )
            failures.push(
              `Four-column tail spread ${flow.bottomSpread}px must fit two measured row gaps of ${rowGap}px`
            );
        }
      }
      const expectedCards = kind === 'baseline' ? baselineGalleryIds : HOMEPAGE_GALLERY_IDS;
      if (
        facts.cards.length !== expectedCards.length ||
        facts.cards.some((card, index) => card.id !== expectedCards[index])
      )
        failures.push('The mounted gallery must contain every authored card once in DOM order');
      if (
        !facts.cards.every((card) => card.connected && card.visible && card.livePrototypeRoots > 0)
      )
        failures.push('Each visible card must contain live public Prototype roots');
      failures.push(...(entry.pageErrors as string[]).map((error) => `Page error: ${error}`));
      entry.validationFailures = failures;
      assert.deepEqual(failures, [], item.id);
      entry.outcome = kind === 'baseline' ? 'captured' : 'passed';
    } catch (error) {
      entry.outcome = 'failed';
      entry.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      report.failures.push(`${item.id}: ${entry.error}`);
      await capture('failure-viewport').catch((captureError) => {
        entry.failureCaptureError = String(captureError);
      });
    } finally {
      await context.close();
      await save();
      console.log(
        JSON.stringify({ id: item.id, outcome: entry.outcome, error: entry.error ?? null })
      );
    }
  }
} catch (error) {
  report.failures.push(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  try {
    await browser?.close();
  } catch (error) {
    report.failures.push(`Browser cleanup: ${error}`);
  }
  try {
    await stopServer();
  } catch (error) {
    report.failures.push(`Server cleanup: ${error}`);
  }
  try {
    report.sourceAfter = identity(sourceRoot);
    assert.deepEqual(
      report.sourceAfter,
      report.source,
      'Tracked subject source changed during capture'
    );
    if (report.generatedFiles.length) {
      report.generatedFilesAfter = await Promise.all(
        generatedNames.map((name) => fileBinding(sourceRoot, `apps/www/src/styles/${name}`))
      );
      assert.deepEqual(
        report.generatedFilesAfter,
        report.generatedFiles,
        'Generated style bytes changed'
      );
    }
  } catch (error) {
    report.failures.push(String(error));
  }
  report.finishedAt = new Date().toISOString();
  await save();
}
if (report.cases.length !== plan.length || report.failures.length) process.exitCode = 1;
