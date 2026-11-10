// Issue #1191: real Header Popover and desktop-rail evidence. Node 24 required.
// Run from apps/www; each invocation creates a new directory and fails on unmet criteria.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import {
  chromeExecutable,
  startServer,
  stopServer,
} from '../src/content/docs/zh-cn/browser-harness.ts';

const VIEWPORTS = [320, 390, 1188, 1279, 1280, 1440, 1920];
const FONT_SIZES = [16, 20, 24, 32];
const TRIGGER =
  '[data-site-contents-command] [data-projection-generation-state="active"] [data-site-contents-button]';

function choices(name, defaults, allowed) {
  const values = process.env[name]?.split(',') ?? defaults;
  if (!values.length || values.some((value) => !allowed.includes(value)))
    throw new Error(`Invalid ${name}: choose from ${allowed.join(',')}`);
  return [...new Set(values)];
}

// Shared with negative-control tests. Only measured facts can satisfy a criterion.
export function assessViewport(row) {
  const failures = [];
  const require = (condition, message) => {
    if (!condition) failures.push(message);
  };
  const doc = row.document;
  require(!!doc, 'document geometry unmeasured');
  if (!doc) return failures;
  require(doc.treeCount === 1 &&
    doc.sameTree &&
    doc.sameLinks &&
    doc.sameDetails &&
    doc.sameCurrent, 'original navigation identity changed');
  require(doc.rootFont === row.fontSize, 'requested root text size not applied');
  require(doc.documentWidth <= doc.viewport.width + 1, 'document horizontally overflows');
  require(doc.article?.visible && doc.article.rect.width > 0, 'article is not measurable');
  require(typeof doc.toc?.visible === 'boolean', 'TOC visibility unmeasured');
  if (doc.toc?.expectedVisible) require(doc.toc.visible, 'expected desktop TOC is hidden');
  if (doc.toc?.visible) {
    require(doc.toc.rect.width > 0 && doc.toc.rect.height > 0, 'visible TOC has no area');
    require(doc.toc.rect.left >=
      doc.article.rect.right - 1, 'TOC is above/overlapping the article');
    require(doc.toc.anchors.length > 0, 'visible TOC has no anchors');
    require(doc.toc.anchors.every(
      (anchor) => !anchor.inLayout || (anchor.width > 0 && anchor.height > 0)
    ), 'desktop TOC contains a zero-area anchor');
  }
  if (!row.mobile) {
    require(row.desktop?.sidebarVisible === true, 'desktop navigation rail is hidden');
    require(row.desktop?.independentScroll ===
      true, 'desktop rail scroll was not independently observed');
    return failures;
  }
  const panel = row.panel;
  require(!!panel, 'public Popover geometry unmeasured');
  if (!panel) return failures;
  require(panel.controlsMatch === true, 'Header public Trigger does not identify Content');
  require(panel.treeInContent === true, 'original navigation is outside public Content');
  require(panel.positioned === true, 'public Content remains in normal flow');
  require(Number.isFinite(panel.availableWidth) &&
    panel.availableWidth > 0 &&
    Number.isFinite(panel.availableHeight) &&
    panel.availableHeight > 0, 'available-space facts missing');
  require(panel.rect.width > 0 &&
    panel.rect.height > 0 &&
    panel.visible === true, 'Popover has no visible viewport intersection');
  require(panel.rect.left >= -1 &&
    panel.rect.right <= doc.viewport.width + 1 &&
    doc.header?.rect &&
    panel.rect.top >= doc.header.rect.bottom - 1 &&
    panel.rect.bottom <=
      doc.viewport.height + 1, 'Popover is outside the viewport or overlaps the Header');
  require(panel.entryFocus === true, 'opening focus never entered Content');
  require(panel.ariaModal !== 'true' &&
    panel.maskPresent === false &&
    panel.bodyScrollLocked === false, 'navigation became modal');
  require(panel.scrollOwners.length === 1 &&
    panel.clientHeight > 0 &&
    panel.scrollHeight > panel.clientHeight, 'navigation lacks one bounded scroll owner');
  require(row.scroll?.progress === true &&
    row.scroll?.documentStable === true, 'native wheel did not scroll only the navigation');
  require(row.escape?.closed === true &&
    row.escape?.focusReturned === true &&
    row.escape?.homeRestored === true, 'Escape close/focus/original-tree handback failed');
  require(row.outsideFocus?.closed === true &&
    row.outsideFocus?.destinationPreserved === true &&
    row.outsideFocus?.homeRestored === true, 'outside focus close stole focus or lost the tree');
  require(row.outsidePress?.closed === true &&
    row.outsidePress?.settingsReachable === true &&
    row.outsidePress?.homeRestored === true, 'nonmodal outside press/Header settings failed');
  return failures;
}

// All page functions below are self-contained Playwright serializations.
function rememberNavigation() {
  const tree = document.querySelector('nav.docs-sidebar');
  if (!tree) throw new Error('Documentation navigation is missing');
  window.__issue1191Original = {
    tree,
    home: tree.parentNode,
    next: tree.nextSibling,
    links: [...tree.querySelectorAll('a[href]')],
    details: [...tree.querySelectorAll('details')],
    current: tree.querySelector('[aria-current="page"]'),
  };
}

function inspectDocument() {
  const original = window.__issue1191Original;
  const tree = document.querySelector('nav.docs-sidebar');
  const rect = (element) => {
    if (!element) return null;
    const r = element.getBoundingClientRect();
    return {
      left: r.left,
      top: r.top,
      right: r.right,
      bottom: r.bottom,
      width: r.width,
      height: r.height,
    };
  };
  const inLayout = (element) => {
    if (!element?.isConnected) return false;
    for (let node = element; node; node = node.parentElement) {
      const css = getComputedStyle(node);
      if (node.hidden || css.display === 'none' || css.visibility === 'hidden') return false;
    }
    return true;
  };
  const geometry = (element) => {
    const box = rect(element);
    return { rect: box, visible: inLayout(element) && box.width > 0 && box.height > 0 };
  };
  const article = document.querySelector('.main-pane[data-layout="docs"]');
  const toc = document.querySelector(
    '.docs-reading-columns[data-layout="docs"] > .right-sidebar-container'
  );
  const header = document.querySelector('[data-docs-site-header]');
  const canvas = document.querySelector('.docs-shell');
  const rootFont = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const canvasStyle = canvas && getComputedStyle(canvas);
  const canvasWidth = canvas
    ? canvas.clientWidth -
      parseFloat(canvasStyle.paddingLeft) -
      parseFloat(canvasStyle.paddingRight)
    : 0;
  const tocGeometry = geometry(toc);
  const links = tree ? [...tree.querySelectorAll('a[href]')] : [];
  const details = tree ? [...tree.querySelectorAll('details')] : [];
  return {
    viewport: { width: innerWidth, height: innerHeight },
    rootFont,
    documentWidth: document.documentElement.scrollWidth,
    scrollY,
    treeCount: document.querySelectorAll('nav.docs-sidebar').length,
    sameTree: !!tree && tree === original?.tree,
    sameLinks:
      !!original &&
      links.length === original.links.length &&
      links.every((node, i) => node === original.links[i]),
    sameDetails:
      !!original &&
      details.length === original.details.length &&
      details.every((node, i) => node === original.details[i]),
    sameCurrent: !!original && tree?.querySelector('[aria-current="page"]') === original.current,
    homeRestored:
      !!tree &&
      tree.parentNode === original?.home &&
      tree.nextSibling === original?.next &&
      !tree.hasAttribute('data-site-contents-popover-tree'),
    header: geometry(header),
    article: geometry(article),
    sidebar: geometry(tree),
    toc: {
      ...tocGeometry,
      canvasWidth,
      expectedVisible: innerWidth >= 1280 && canvasWidth > 66 * rootFont,
      // A hidden zero rect is unmeasured, never an above-article claim.
      aboveArticle:
        tocGeometry.visible && article
          ? tocGeometry.rect.left < rect(article).right - 1 &&
            tocGeometry.rect.top < rect(article).top
          : null,
      anchors: [...(toc?.querySelectorAll('a[href]') ?? [])].map((anchor) => ({
        text: anchor.textContent?.trim().slice(0, 100),
        inLayout: inLayout(anchor),
        width: rect(anchor).width,
        height: rect(anchor).height,
      })),
    },
  };
}

function inspectPopover(element) {
  const parent = (node) => node?.assignedSlot ?? node?.parentNode ?? node?.host ?? null;
  const within = (node, ancestor) => {
    for (let current = node; current; current = parent(current))
      if (current === ancestor) return true;
    return false;
  };
  const tree = document.querySelector('nav.docs-sidebar');
  const trigger = document.querySelector(
    '[data-site-contents-command] [data-projection-generation-state="active"] [data-site-contents-button]'
  );
  const surface = element.shadowRoot?.querySelector('[data-pui-split-surface]') ?? element;
  const box = element.getBoundingClientRect();
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  const owners = [];
  let positioned = false;
  for (let node = element; node && node !== document.body; node = parent(node))
    if (node instanceof Element && ['fixed', 'absolute'].includes(getComputedStyle(node).position))
      positioned = true;
  for (let node = tree; node && node !== document.body; node = parent(node)) {
    if (!(node instanceof Element)) continue;
    const css = getComputedStyle(node);
    if (/^(auto|scroll)$/.test(css.overflowY))
      owners.push({
        tag: node.tagName,
        id: node.id,
        clientHeight: node.clientHeight,
        scrollHeight: node.scrollHeight,
      });
  }
  const pane = tree?.querySelector('#starlight__sidebar');
  if (pane && /^(auto|scroll)$/.test(getComputedStyle(pane).overflowY))
    owners.push({
      tag: pane.tagName,
      id: pane.id,
      clientHeight: pane.clientHeight,
      scrollHeight: pane.scrollHeight,
    });
  const css = getComputedStyle(surface);
  const hostStyle = getComputedStyle(element);
  return {
    controlsMatch: trigger?.getAttribute('aria-controls') === element.id,
    treeInContent: within(tree, element),
    positioned,
    rect: {
      left: box.left,
      top: box.top,
      right: box.right,
      bottom: box.bottom,
      width: box.width,
      height: box.height,
    },
    visible:
      box.width > 0 &&
      box.height > 0 &&
      box.right > 0 &&
      box.bottom > 0 &&
      box.left < innerWidth &&
      box.top < innerHeight &&
      css.visibility !== 'hidden' &&
      css.display !== 'none',
    availableWidth: parseFloat(hostStyle.getPropertyValue('--proto-ui-available-width')),
    availableHeight: parseFloat(hostStyle.getPropertyValue('--proto-ui-available-height')),
    entryFocus: within(active, element),
    ariaModal: element.getAttribute('aria-modal'),
    maskPresent: !!document.querySelector(
      '[data-pui-overlay-mask], [data-pui-dialog-mask], .pui-projection-overlay-mask'
    ),
    bodyScrollLocked:
      [document.body, document.documentElement].some((node) =>
        /^(hidden|clip)$/.test(getComputedStyle(node).overflowY)
      ) || getComputedStyle(document.body).position === 'fixed',
    scrollOwners: owners,
    scrollTop: surface.scrollTop,
    scrollHeight: surface.scrollHeight,
    clientHeight: surface.clientHeight,
    style: {
      background: css.backgroundColor,
      radius: css.borderRadius,
      border: css.borderWidth,
      overflowY: css.overflowY,
      backdropFilter: css.backdropFilter,
    },
  };
}

async function openPanel(page, trigger) {
  await trigger.click();
  const id = await trigger.getAttribute('aria-controls');
  if (!id || id === 'starlight__sidebar')
    throw new Error('Actual public Trigger/Content relationship is missing');
  const panel = page.locator(`[id=${JSON.stringify(id)}][role="dialog"]`);
  await panel.waitFor({ state: 'visible' });
  await page.waitForFunction(() =>
    document.querySelector('nav.docs-sidebar')?.hasAttribute('data-site-contents-popover-tree')
  );
  // Wait for actual public positioning, not a fixed animation grace period.
  await panel.evaluate(async (element) => {
    const { promise, resolve, reject } = Promise.withResolvers();
    const deadline = performance.now() + 1000;
    const sample = () => {
      const r = element.getBoundingClientRect();
      const available = parseFloat(
        getComputedStyle(element).getPropertyValue('--proto-ui-available-height')
      );
      let active = document.activeElement;
      while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
      let entered = false;
      for (
        let node = active;
        node;
        node = node.assignedSlot ?? node.parentNode ?? node.host ?? null
      )
        if (node === element) entered = true;
      if (
        available > 0 &&
        r.width > 0 &&
        r.height > 0 &&
        r.bottom <= innerHeight + 1 &&
        r.top >= 0 &&
        entered
      )
        resolve();
      else if (performance.now() >= deadline)
        reject(new Error('Popover never acquired visible available-space geometry'));
      else requestAnimationFrame(sample);
    };
    sample();
    return promise;
  });
  return panel;
}

async function observeWheel(page, target) {
  const before = await target.evaluate((element) => {
    const surface = element.shadowRoot?.querySelector('[data-pui-split-surface]') ?? element;
    return {
      top: surface.scrollTop,
      max: surface.scrollHeight - surface.clientHeight,
      documentY: scrollY,
    };
  });
  const bounds = await target.boundingBox();
  if (!bounds || before.max <= 0)
    return { ...before, progress: false, documentStable: false, reason: 'no scrollable area' };
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    Math.max(1, Math.min(843, bounds.y + bounds.height / 2))
  );
  await page.mouse.wheel(0, before.top < before.max / 2 ? 400 : -400);
  const after = await target.evaluate(async (element, initial) => {
    const surface = element.shadowRoot?.querySelector('[data-pui-split-surface]') ?? element;
    const { promise, resolve } = Promise.withResolvers();
    const deadline = performance.now() + 1000;
    let lastTop = surface.scrollTop,
      stable = 0;
    const sample = () => {
      stable = surface.scrollTop === lastTop ? stable + 1 : 0;
      lastTop = surface.scrollTop;
      if ((surface.scrollTop !== initial && stable >= 6) || performance.now() >= deadline)
        resolve({ top: surface.scrollTop, documentY: scrollY });
      else requestAnimationFrame(sample);
    };
    sample();
    return promise;
  }, before.top);
  return {
    before,
    after,
    progress: after.top !== before.top,
    documentStable: after.documentY === before.documentY,
  };
}

async function closedState(page, trigger, kind) {
  await page.waitForFunction(
    () =>
      document.querySelector('[data-site-contents-command]')?.getAttribute('aria-expanded') ===
      'false'
  );
  await page.waitForFunction(() => {
    const original = window.__issue1191Original,
      tree = original?.tree;
    return (
      tree?.isConnected &&
      tree.parentNode === original.home &&
      tree.nextSibling === original.next &&
      !tree.hasAttribute('data-site-contents-popover-tree')
    );
  });
  return {
    kind,
    closed: (await trigger.getAttribute('aria-expanded')) === 'false',
    homeRestored: (await page.evaluate(inspectDocument)).homeRestored,
    focusReturned: await trigger.evaluate(
      (element) => document.activeElement === element || element.contains(document.activeElement)
    ),
  };
}

async function captureViewport(browser, baseUrl, output, selection, width, fontSize) {
  const row = { ...selection, width, fontSize, mobile: width < 1024, errors: [] };
  const id = `${selection.family}-${selection.locale}-${selection.scheme}-${selection.runtime}-${width}x${fontSize}`;
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    colorScheme: selection.scheme,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.on('pageerror', (error) => row.errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') row.errors.push(`console: ${message.text()}`);
  });
  try {
    await page.addInitScript(
      ({ runtime, fontSize }) => {
        localStorage.setItem('preferred-prototypes-adapter', runtime);
        const apply = () => {
          if (document.documentElement) document.documentElement.style.fontSize = `${fontSize}px`;
        };
        if (document.documentElement) apply();
        else {
          const observer = new MutationObserver(() => {
            if (document.documentElement) {
              observer.disconnect();
              apply();
            }
          });
          observer.observe(document, { childList: true });
        }
      },
      { runtime: selection.runtime, fontSize }
    );
    const route = `/${selection.locale}/ui-libraries/${selection.family}/${selection.family === 'brutalist' ? 'components/' : ''}button/`;
    row.route = route;
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.waitForFunction(
      (runtime) =>
        document.querySelector('[data-site-contents-command]')?.dataset.contentsRuntime === runtime,
      selection.runtime
    );
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(rememberNavigation);
    row.document = await page.evaluate(inspectDocument);
    if (row.mobile) {
      const trigger = page.locator(TRIGGER);
      await trigger.waitFor({ state: 'visible' });
      const panel = await openPanel(page, trigger);
      row.panel = await panel.evaluate(inspectPopover);
      row.scroll = await observeWheel(page, panel);
      await page.screenshot({ path: path.join(output, `${id}-open.png`) });
      await page.keyboard.press('Escape');
      row.escape = await closedState(page, trigger, 'Escape');
      await page.screenshot({ path: path.join(output, `${id}-escape.png`) });
      await openPanel(page, trigger);
      const settings = page.locator('[data-docs-site-header] [data-site-menu-button]');
      await settings.focus();
      row.outsideFocus = await closedState(page, trigger, 'outside.focus');
      row.outsideFocus.destinationPreserved = await settings.evaluate(
        (element) => document.activeElement === element || element.contains(document.activeElement)
      );
      await openPanel(page, trigger);
      await settings.click();
      row.outsidePress = await closedState(page, trigger, 'outside.press');
      row.outsidePress.settingsReachable =
        (await settings.getAttribute('aria-expanded')) === 'true' &&
        (await page.locator('[data-site-header-settings]').isVisible()) &&
        !(await trigger.evaluate(
          (element) =>
            document.activeElement === element || element.contains(document.activeElement)
        ));
      await page.screenshot({ path: path.join(output, `${id}-outside-settings.png`) });
    } else {
      const rail = page.locator('nav.docs-sidebar');
      const before = await page.evaluate(inspectDocument);
      const wheel = await observeWheel(page, rail);
      const after = await page.evaluate(inspectDocument);
      row.desktop = {
        sidebarVisible: before.sidebar.visible,
        wheel,
        independentScroll:
          wheel.progress && wheel.documentStable && after.toc.rect?.top === before.toc.rect?.top,
      };
      await page.screenshot({ path: path.join(output, `${id}-rails.png`) });
    }
    row.document = await page.evaluate(inspectDocument);
  } catch (error) {
    row.errors.push(String(error));
    const visiblePanel = page.getByRole('dialog');
    if (!row.panel && (await visiblePanel.count()) === 1)
      row.panel = await visiblePanel.evaluate(inspectPopover).catch(() => null);
    if (!row.document) row.document = await page.evaluate(inspectDocument).catch(() => null);
    await page
      .screenshot({ path: path.join(output, `${id}-failure.png`) })
      .catch((captureError) => row.errors.push(`screenshot: ${captureError}`));
  } finally {
    row.failures = assessViewport(row);
    row.result = row.errors.length || row.failures.length ? 'failed' : 'passed';
    await writeFile(path.join(output, `${id}.json`), JSON.stringify(row, null, 2) + '\n', {
      flag: 'wx',
    });
    await context.close();
  }
  return row;
}

async function captureNoJs(browser, baseUrl, output, selection, width, fontSize) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    colorScheme: selection.scheme,
    javaScriptEnabled: false,
  });
  const page = await context.newPage();
  const row = { ...selection, noJS: true, width, fontSize, errors: [] };
  const id = `${selection.family}-${selection.locale}-${selection.scheme}-nojs-${width}x${fontSize}`;
  try {
    await page.goto(
      `${baseUrl}/${selection.locale}/ui-libraries/${selection.family}/${selection.family === 'brutalist' ? 'components/' : ''}button/`,
      { waitUntil: 'networkidle' }
    );
    // Text enlargement is a disclosed test input; authored page scripts stay disabled.
    await page.addStyleTag({ content: `html { font-size: ${fontSize}px !important; }` });
    await page.evaluate(rememberNavigation);
    await page.locator('nav.docs-sidebar a[href]:visible').first().scrollIntoViewIfNeeded();
    row.document = await page.evaluate(inspectDocument);
    row.reachable = await page.locator('nav.docs-sidebar a[href]:visible').first().isVisible();
    await page.screenshot({ path: path.join(output, `${id}.png`) });
    await page.locator('[data-site-header-fallback-summary]').click();
    row.headerSettingsReachable = await page.locator('[data-site-header-settings]').isVisible();
    await page.screenshot({ path: path.join(output, `${id}-settings.png`) });
    row.result =
      row.reachable &&
      row.headerSettingsReachable &&
      row.document.sameTree &&
      row.document.treeCount === 1 &&
      row.document.rootFont === fontSize &&
      row.document.documentWidth <= width + 1
        ? 'passed'
        : 'failed';
  } catch (error) {
    row.errors.push(String(error));
    row.result = 'failed';
  } finally {
    await writeFile(path.join(output, `${id}.json`), JSON.stringify(row, null, 2) + '\n', {
      flag: 'wx',
    });
    await context.close();
  }
  return row;
}

async function main() {
  const output =
    process.env.EVIDENCE_DIR ||
    `test/evidence/issue-1191/${new Date().toISOString().replace(/[:.]/g, '-')}`;
  await mkdir(path.dirname(output), { recursive: true });
  // Refuse existing directories so neither original failures nor earlier candidate runs can be overwritten.
  await mkdir(output);
  const sourcePaths = [
    'src/components/site-contents-panel.ts',
    'src/components/site-header-disclosure.ts',
    'src/components/site-header-surface.ts',
    'src/components/SiteContentsCommand.astro',
    'src/components/override/PageFrame.astro',
    'src/components/override/TwoColumnContent.astro',
    '../../packages/modules/focus/src/center.ts',
    '../../packages/compiler/src/native-adapter-modules.ts',
    'scripts/capture-issue-1191-evidence.mjs',
  ];
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const source = {
    head,
    dirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !== '',
    files: Object.fromEntries(
      sourcePaths.map((file) => [
        file,
        createHash('sha256').update(readFileSync(file)).digest('hex'),
      ])
    ),
  };
  if (process.env.CANDIDATE_SHA && source.head !== process.env.CANDIDATE_SHA)
    throw new Error('CANDIDATE_SHA does not match this source');
  const families = choices('EVIDENCE_FAMILIES', ['shadcn', 'brutalist'], ['shadcn', 'brutalist']);
  const schemes = choices('EVIDENCE_SCHEMES', ['light', 'dark'], ['light', 'dark']);
  const locales = choices('EVIDENCE_LOCALES', ['zh-cn', 'en'], ['zh-cn', 'en']);
  const runtimes = choices('EVIDENCE_RUNTIMES', ['wc'], ['wc', 'react', 'vue', 'vue2']);
  const results = [];
  let browser;
  try {
    const baseUrl = await startServer('/');
    browser = await chromium.launch({
      executablePath: await chromeExecutable(),
      headless: true,
      args: ['--disable-dev-shm-usage'],
    });
    for (const family of families)
      for (const locale of locales)
        for (const scheme of schemes) {
          for (const runtime of runtimes)
            for (const width of VIEWPORTS)
              for (const fontSize of FONT_SIZES) {
                const row = await captureViewport(
                  browser,
                  baseUrl,
                  output,
                  { family, locale, scheme, runtime },
                  width,
                  fontSize
                );
                results.push(row);
                console.log(
                  `${family}/${locale}/${scheme}/${runtime}/${width}x${fontSize}: ${row.result}`
                );
              }
          for (const [width, fontSize] of [
            [390, 16],
            [320, 32],
            [1440, 16],
          ])
            results.push(
              await captureNoJs(
                browser,
                baseUrl,
                output,
                { family, locale, scheme },
                width,
                fontSize
              )
            );
        }
  } finally {
    await browser?.close();
    await stopServer();
    const failed = results.filter((row) => row.result !== 'passed');
    const expected =
      families.length *
      schemes.length *
      locales.length *
      (runtimes.length * VIEWPORTS.length * FONT_SIZES.length + 3);
    await writeFile(
      path.join(output, 'report.json'),
      JSON.stringify(
        {
          generated: new Date().toISOString(),
          source,
          expected,
          completed: results.length,
          result: results.length === expected && failed.length === 0 ? 'passed' : 'failed',
          viewports: VIEWPORTS,
          fontSizes: FONT_SIZES,
          families,
          schemes,
          locales,
          runtimes,
          results,
          limits: [
            'Native captures require visual inspection; metrics do not establish design acceptance',
            'Shared Focus repair must be integrated before outside-focus acceptance',
            'Modified/middle-click/navigation and close-generation interruption remain in the existing browser journeys',
          ],
        },
        null,
        2
      ) + '\n',
      { flag: 'wx' }
    );
    console.log(`Report: ${output}/report.json`);
    if (results.length !== expected || failed.length) process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
