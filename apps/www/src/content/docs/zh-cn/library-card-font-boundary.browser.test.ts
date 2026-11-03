// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Browser, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser, RUNTIMES, startServer, stopServer } from './browser-harness';
import {
  captureCurrentViewport,
  closeEvidenceContext,
  writeFailureRecord,
  type CleanupIssue,
} from './library-card-capture';
import { readLibraryPlatformFonts } from './library-card-platform-fonts';
import { PREFERRED_ADAPTER_KEY } from '../../../components/adapter-preference-key';

// Additional diagnostic, not a replacement for the unchanged original Card9.
// The original suite still owns every-distinct-rAF, reload, focus and no-script.
// Four site preferences do not select four Gallery adapters: these actual hosts are WC.
const route = '/zh-cn/ui-libraries/';
const directory =
  process.env.PUI_LIBRARY_FONT_BOUNDARY_EVIDENCE_DIR ??
  path.join(process.env.RUNNER_TEMP ?? os.tmpdir(), 'library-font-boundary-evidence');
const consumers = ['base', 'lucide', 'shadcn'] as const;
let browser: Browser;
let baseUrl: string;
let source: { sha: string; tree: string; dirty: boolean };

beforeAll(async () => {
  source = {
    sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    tree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim(),
    dirty: Boolean(
      execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
        encoding: 'utf8',
      }).trim()
    ),
  };
  if (process.env.CANDIDATE_SHA) expect(source.sha).toBe(process.env.CANDIDATE_SHA);
  if (process.env.CI) expect(source.dirty).toBe(false);
  await mkdir(directory, { recursive: true });
  baseUrl = await startServer(route);
  browser = await launchBrowser();
}, 150_000);

afterAll(async () => {
  try {
    await browser?.close();
  } finally {
    await stopServer();
  }
}, 60_000);

function readBoundaryState() {
  const gallery = document.querySelector<HTMLElement>('.library-gallery');
  if (!gallery) throw new Error('Real gallery is missing');
  const variables = [
    '--font-sans',
    '--pui-font-sans',
    '--pui-font-heading',
    '--site-default-font-sans',
    '--site-font-sans',
    '--site-shadcn-font-sans',
  ];
  const describeElement = (node: HTMLElement) => {
    const css = getComputedStyle(node);
    return {
      tag: node.localName,
      classes: node.className,
      fontScope: node.hasAttribute('data-site-font-scope'),
      familyScope: node.getAttribute('data-site-library-family'),
      projectionFamily: node.getAttribute('data-projection-family'),
      font: css.fontFamily,
      variables: Object.fromEntries(
        variables.map((name) => [name, css.getPropertyValue(name).trim()])
      ),
      inlineFont: node.style.getPropertyValue('font-family'),
      inlineFontPriority: node.style.getPropertyPriority('font-family'),
      inlineInput: node.style.getPropertyValue('--site-font-sans'),
      inlineInputPriority: node.style.getPropertyPriority('--site-font-sans'),
    };
  };
  const leaves = ['base', 'lucide', 'shadcn'].flatMap((family) => {
    const card = gallery.querySelector<HTMLElement>(`[data-library="${family}"]`);
    if (!card) throw new Error(`Missing real ${family} card`);
    return [
      ['title', 'h2 [data-library-part]'],
      ['action', '[data-library-action] [data-library-part$="text"]'],
    ].map(([role, selector]) => {
      const matches = card.querySelectorAll<HTMLElement>(selector);
      if (matches.length !== 1) throw new Error(`Ambiguous ${family}.${role} Text`);
      const leaf = matches[0];
      if (!leaf) throw new Error(`Missing real ${family}.${role} Text`);
      const rect = leaf.getBoundingClientRect();
      const ancestry: ReturnType<typeof describeElement>[] = [];
      for (let node: HTMLElement | null = leaf; node; node = node.parentElement) {
        if (ancestry.length >= 32) throw new Error('Font inheritance chain exceeds evidence bound');
        ancestry.push(describeElement(node));
      }
      return {
        family,
        role,
        text: leaf.textContent,
        width: rect.width,
        height: rect.height,
        font: getComputedStyle(leaf).fontFamily,
        ancestry,
        actualHost: {
          tag: leaf.localName,
          part: leaf.getAttribute('data-library-part'),
          connected: leaf.isConnected,
          ownerDocumentMatches: leaf.ownerDocument === document,
          registeredConstructorPresent: typeof customElements.get(leaf.localName) === 'function',
          nodeConstructorName: leaf.constructor.name,
          exactRegisteredConstructor: leaf.constructor === customElements.get(leaf.localName),
        },
      };
    });
  });
  return {
    body: describeElement(document.body),
    root: describeElement(document.documentElement),
    rootBankValid: CSS.supports(
      'font-family',
      getComputedStyle(document.documentElement).getPropertyValue('--site-default-font-sans')
    ),
    gallery: describeElement(gallery),
    faces: [...document.fonts].map((face) => ({ family: face.family, status: face.status })),
    leaves,
  };
}

async function holdBoundaryNodes(page: Page) {
  // Read-only handles, acquired only after the first held-font observation.
  // No marker/property is installed on the application or its nodes.
  return page.evaluateHandle(() =>
    ['base', 'lucide', 'shadcn'].flatMap((family) =>
      [
        ['title', 'h2 [data-library-part]'],
        ['action', '[data-library-action] [data-library-part$="text"]'],
      ].map(([role, partSelector]) => {
        const selector = `.library-gallery [data-library="${family}"] ${partSelector}`;
        const matches = document.querySelectorAll<HTMLElement>(selector);
        if (matches.length !== 1) throw new Error(`Ambiguous held ${family}.${role} node`);
        return { family, role, selector, node: matches[0] };
      })
    )
  );
}

function readAuthoredCascadeControls() {
  // These are explicitly injected author declarations on ordinary DOM nodes.
  // They observe the actual loaded stylesheet, not another component/runtime.
  const mount = document.createElement('div');
  mount.dataset.fontBoundaryProbe = '';
  document.querySelector('[data-site-family-scope]')!.append(mount);
  const scope = (input: string, parent: HTMLElement = mount) => {
    const element = document.createElement('div');
    element.dataset.siteFontScope = '';
    element.style.setProperty('--site-font-sans', input);
    element.textContent = 'Authored font scope ABC';
    parent.append(element);
    return element;
  };
  const root = document.documentElement;
  const rootMarker = root.getAttribute('data-site-font-scope');
  const rootInput = root.style.getPropertyValue('--site-font-sans');
  const rootPriority = root.style.getPropertyPriority('--site-font-sans');
  const rootBefore = getComputedStyle(root).getPropertyValue('--site-default-font-sans').trim();
  try {
    const normal = scope('serif');
    const utility = scope('serif');
    utility.className = 'font-mono';
    const inline = scope('monospace');
    inline.style.fontFamily = 'serif';
    const family = scope('monospace');
    family.dataset.siteFamilyScope = '';
    family.dataset.siteLibraryFamily = 'shadcn';
    const projection = scope('monospace');
    projection.className = 'pui-projection-scope';
    projection.style.setProperty('--pui-font-sans', 'serif');
    const nested = scope('monospace', normal);
    const inherited = document.createElement('span');
    inherited.textContent = 'Plain descendant';
    normal.append(inherited);
    const nestedFamily = document.createElement('div');
    nestedFamily.dataset.siteFamilyScope = '';
    nestedFamily.dataset.siteLibraryFamily = 'shadcn';
    normal.append(nestedFamily);
    const nestedProjection = document.createElement('div');
    nestedProjection.className = 'pui-projection-scope';
    nestedProjection.style.setProperty('--pui-font-sans', 'monospace');
    normal.append(nestedProjection);
    const missing = scope('serif');
    missing.removeAttribute('data-site-font-scope');
    const cyclic = scope('var(--font-sans)');
    root.dataset.siteFontScope = '';
    root.style.setProperty('--site-font-sans', 'var(--site-default-font-sans)');
    return {
      normal: getComputedStyle(normal).fontFamily,
      utility: getComputedStyle(utility).fontFamily,
      inline: getComputedStyle(inline).fontFamily,
      inlineAuthored: inline.style.fontFamily,
      sameNodeFamily: getComputedStyle(family).fontFamily,
      sameNodeProjection: getComputedStyle(projection).fontFamily,
      nested: getComputedStyle(nested).fontFamily,
      inherited: getComputedStyle(inherited).fontFamily,
      nestedFamily: getComputedStyle(nestedFamily).fontFamily,
      nestedProjection: getComputedStyle(nestedProjection).fontFamily,
      outerAfterNested: getComputedStyle(normal).fontFamily,
      missing: getComputedStyle(missing).fontFamily,
      cyclicInput: getComputedStyle(cyclic).getPropertyValue('--site-font-sans').trim(),
      cyclicSans: getComputedStyle(cyclic).getPropertyValue('--font-sans').trim(),
      rootBefore,
      rootAfter: getComputedStyle(root).getPropertyValue('--site-default-font-sans').trim(),
    };
  } finally {
    if (rootMarker === null) root.removeAttribute('data-site-font-scope');
    else root.setAttribute('data-site-font-scope', rootMarker);
    if (rootInput) root.style.setProperty('--site-font-sans', rootInput, rootPriority);
    else root.style.removeProperty('--site-font-sans');
    mount.remove();
  }
}

function meaningfulFontRecords(read: Awaited<ReturnType<typeof readLibraryPlatformFonts>>) {
  expect(read.error).toBeUndefined();
  expect(read.cleanup).toEqual([]);
  expect(read.nodes.map((node) => node.name)).toEqual(['caption', 'title', 'action']);
  return read.nodes.map((node) => {
    expect(node.missing).not.toBe(true);
    if (!Array.isArray(node.fonts)) throw new Error(`No actual font records for ${node.name}`);
    const fonts = node.fonts
      .map((value: unknown) => {
        if (
          !value ||
          typeof value !== 'object' ||
          !('familyName' in value) ||
          typeof value.familyName !== 'string' ||
          !('glyphCount' in value) ||
          typeof value.glyphCount !== 'number' ||
          !('isCustomFont' in value) ||
          typeof value.isCustomFont !== 'boolean'
        )
          throw new Error(`Malformed actual font record for ${node.name}`);
        return { family: value.familyName, glyphs: value.glyphCount, custom: value.isCustomFont };
      })
      .filter((font) => font.glyphs > 0)
      .sort((a, b) => a.family.localeCompare(b.family));
    expect(fonts.length).toBeGreaterThan(0);
    expect(fonts.some((font) => /Geist/i.test(font.family))).toBe(false);
    return { name: node.name, fonts };
  });
}

describe('real gallery author font boundary, additional diagnosis', () => {
  for (const requestedPreference of RUNTIMES)
    for (const dark of [false, true]) {
      it(`site preference ${requestedPreference}; actual WC ${dark ? 'dark' : 'light'} keeps independent inherited fonts and authored precedence`, async () => {
        const context = await browser.newContext({
          viewport: { width: 1440, height: 1000 },
          colorScheme: dark ? 'dark' : 'light',
        });
        let page: Page | undefined;
        let heldNodes: Awaited<ReturnType<typeof holdBoundaryNodes>> | undefined;
        const name = `${requestedPreference}-${dark}`;
        const record: Record<string, unknown> = {
          source,
          requestedSitePreference: requestedPreference,
          actualAdapterExpected: 'web-component',
          dark,
          startedAt: new Date().toISOString(),
        };
        const held: Array<{ url: string; type: string }> = [];
        const forbidden: string[] = [];
        const pageErrors: string[] = [];
        const cleanup: CleanupIssue[] = [];
        const reportCleanup = (issue: CleanupIssue) => {
          cleanup.push(issue);
        };
        let primaryError = false;
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        let released = false;
        try {
          await context.addInitScript(
            ({ requestedPreference, key, dark }) => {
              localStorage.setItem(key, requestedPreference);
              localStorage.setItem('starlight-theme', dark ? 'dark' : 'light');
            },
            { requestedPreference, key: PREFERRED_ADAPTER_KEY, dark }
          );
          page = await context.newPage();
          page.on('pageerror', (error) => pageErrors.push(error.message));
          await page.route('**/*', async (request) => {
            const url = new URL(request.request().url());
            if (url.origin !== new URL(baseUrl).origin) {
              forbidden.push(url.href);
              await request.abort();
              return;
            }
            if (!released && ['font', 'script'].includes(request.request().resourceType())) {
              held.push({ url: url.href, type: request.request().resourceType() });
              await gate;
            }
            await request.continue();
          });
          await page.goto(baseUrl + route, { waitUntil: 'commit' });
          await page.locator('[data-library="liquid-glass"] h2').waitFor();
          await page.locator('[data-library="brutalist"] h2').scrollIntoViewIfNeeded();
          // First observation precedes added CDP work. No pre-release font wait,
          // sampling delay, hidden text, compensating width or changed Card9 gate.
          const before = await page.evaluate(readBoundaryState);
          record.before = before;
          heldNodes = await holdBoundaryNodes(page);
          record.heldRequests = held;
          record.heldImage = await captureCurrentViewport(
            page,
            path.join(directory, `${name}-held.png`),
            undefined,
            reportCleanup
          );
          const heldFonts = new Map<
            (typeof consumers)[number],
            Awaited<ReturnType<typeof readLibraryPlatformFonts>>
          >();
          for (const family of consumers)
            heldFonts.set(family, await readLibraryPlatformFonts(page, family));
          record.heldFonts = Object.fromEntries(heldFonts);
          released = true;
          release();
          await page.waitForFunction(() =>
            [...document.querySelectorAll('[data-library-part]')].every((node) =>
              customElements.get(node.localName)
            )
          );
          // Post-release settled endpoint only; the unchanged Card9 owns frames.
          await page.waitForFunction(() => document.fonts.status === 'loaded', undefined, {
            timeout: 15_000,
          });
          const after = await page.evaluate(readBoundaryState);
          record.after = after;
          const hostIdentity = await heldNodes.evaluate((held) =>
            held.map(({ family, role, selector, node }) => {
              const matches = document.querySelectorAll(selector);
              const registered = customElements.get(node.localName);
              return {
                family,
                role,
                tag: node.localName,
                part: node.getAttribute('data-library-part'),
                currentMatchCount: matches.length,
                sameHeldNode: matches.length === 1 && matches[0] === node,
                connected: node.isConnected,
                ownerDocumentMatches: node.ownerDocument === document,
                registeredConstructorPresent: typeof registered === 'function',
                exactRegisteredConstructor: node.constructor === registered,
                registeredInstance: typeof registered === 'function' && node instanceof registered,
                nodeConstructorName: node.constructor.name,
                registeredConstructorName: registered?.name ?? null,
              };
            })
          );
          record.actualHostIdentity = hostIdentity;
          await heldNodes.dispose();
          heldNodes = undefined;
          const enhancedFonts = new Map<
            (typeof consumers)[number],
            Awaited<ReturnType<typeof readLibraryPlatformFonts>>
          >();
          for (const family of consumers)
            enhancedFonts.set(family, await readLibraryPlatformFonts(page, family));
          record.enhancedFonts = Object.fromEntries(enhancedFonts);
          record.enhancedImage = await captureCurrentViewport(
            page,
            path.join(directory, `${name}-enhanced.png`),
            undefined,
            reportCleanup
          );
          const controls = await page.evaluate(readAuthoredCascadeControls);
          record.authoredControls = controls;
          // A disclosed DOM intervention, not a source-revert or a second pass.
          const missingBoundary = await page.evaluate(() => {
            const gallery = document.querySelector<HTMLElement>('.library-gallery')!;
            const marker = gallery.getAttribute('data-site-font-scope');
            gallery.removeAttribute('data-site-font-scope');
            return { marker, font: getComputedStyle(gallery).fontFamily };
          });
          record.missingBoundary = missingBoundary;
          await page.evaluate((marker) => {
            const gallery = document.querySelector('.library-gallery')!;
            if (marker === null) gallery.removeAttribute('data-site-font-scope');
            else gallery.setAttribute('data-site-font-scope', marker);
          }, missingBoundary.marker);
          record.restored = await page.evaluate(readBoundaryState);
          expect(hostIdentity).toHaveLength(6);
          expect(new Set(hostIdentity.map((node) => `${node.family}.${node.role}`)).size).toBe(6);
          for (const node of hostIdentity) {
            expect(node.part).not.toBeNull();
            expect(node.tag).toBe(`wc-library-${node.part}`);
            expect(node.currentMatchCount).toBe(1);
            expect(node.sameHeldNode).toBe(true);
            expect(node.connected).toBe(true);
            expect(node.ownerDocumentMatches).toBe(true);
            expect(node.registeredConstructorPresent).toBe(true);
            expect(node.exactRegisteredConstructor).toBe(true);
            expect(node.registeredInstance).toBe(true);
          }
          // Before enhancement, the same WC-tagged authored nodes are unregistered.
          // Constructor names are descriptive only; equality/instance checks are the oracle.
          for (const leaf of before.leaves) {
            expect(leaf.actualHost.tag).toBe(`wc-library-${leaf.actualHost.part}`);
            expect(leaf.actualHost.connected).toBe(true);
            expect(leaf.actualHost.ownerDocumentMatches).toBe(true);
            expect(leaf.actualHost.registeredConstructorPresent).toBe(false);
            expect(leaf.actualHost.exactRegisteredConstructor).toBe(false);
          }
          expect(held.length).toBeGreaterThan(0);
          expect(held.some((request) => request.type === 'font')).toBe(true);
          expect(
            before.faces.some((face) => /Geist/i.test(face.family) && face.status === 'loading')
          ).toBe(true);
          expect(
            after.faces.some((face) => /Geist/i.test(face.family) && face.status === 'loaded')
          ).toBe(true);
          expect(forbidden).toEqual([]);
          expect(pageErrors).toEqual([]);
          expect(before.gallery.fontScope).toBe(true);
          expect(before.root.variables['--site-default-font-sans']).not.toBe('');
          expect(before.rootBankValid).toBe(true);
          expect(after.rootBankValid).toBe(true);
          expect(before.gallery.font).toBe(before.body.font);
          expect(after.gallery.font).toBe(after.body.font);
          for (const family of consumers) {
            const first = heldFonts.get(family);
            const final = enhancedFonts.get(family);
            if (!first || !final)
              throw new Error(`Missing paired actual font record for ${family}`);
            expect(meaningfulFontRecords(final)).toEqual(meaningfulFontRecords(first));
          }
          for (const leaf of before.leaves.filter((leaf) => leaf.family !== 'shadcn')) {
            expect(leaf.font).toBe(before.body.font);
            const final = after.leaves.find(
              (item) => item.family === leaf.family && item.role === leaf.role
            )!;
            expect({ font: final.font, width: final.width, height: final.height }).toEqual({
              font: leaf.font,
              width: leaf.width,
              height: leaf.height,
            });
          }
          expect(controls.normal).toBe('serif');
          expect(controls.utility).toMatch(/monospace/);
          expect(controls.inline).toBe('serif');
          expect(controls.inlineAuthored).toBe('serif');
          expect(controls.sameNodeFamily).toBe('monospace');
          expect(controls.sameNodeProjection).toBe('monospace');
          expect(controls.nested).toBe('monospace');
          expect(controls.inherited).toBe('serif');
          expect(controls.nestedFamily).toMatch(/Geist/);
          expect(controls.nestedProjection).toBe('monospace');
          expect(controls.outerAfterNested).toBe('serif');
          expect(controls.missing).not.toBe('serif');
          expect(controls.cyclicInput).toBe('');
          expect(controls.cyclicSans).toBe('');
          expect(controls.rootAfter).toBe(controls.rootBefore);
          expect(controls.rootAfter).not.toBe('');
          expect(missingBoundary.font).toMatch(/Geist/);
          expect(after.gallery.font).not.toMatch(/Geist/);
          expect(cleanup).toEqual([]);
          record.outcome = 'passed';
        } catch (error) {
          primaryError = true;
          record.outcome = 'failed';
          record.error = String(error);
          if (page) {
            await captureCurrentViewport(
              page,
              path.join(directory, `${name}-failure.png`),
              undefined,
              reportCleanup
            )
              .then((image) => {
                record.failureImage = image;
              })
              .catch((captureError) => {
                record.failureCaptureError = String(captureError);
              });
          }
          throw error;
        } finally {
          released = true;
          release();
          record.forbiddenRequests = forbidden;
          record.pageErrors = pageErrors;
          try {
            // Context retirement also disposes any node handle retained by an earlier failure.
            // No application-owned marker or global exists to remove.
            await closeEvidenceContext(context, primaryError, reportCleanup);
          } catch (error) {
            primaryError = true;
            record.outcome = 'failed';
            record.error = String(error);
            throw error;
          } finally {
            record.cleanup = cleanup;
            if (primaryError)
              await writeFailureRecord(path.join(directory, `${name}.json`), record, reportCleanup);
            else
              await writeFile(
                path.join(directory, `${name}.json`),
                JSON.stringify(record, null, 2)
              );
          }
        }
      }, 90_000);
    }
});

// Independent causal diagnosis. It does not change Card9 or the preceding eight
// font cases, and a captured intervention is not a product/layout acceptance.
function readSharedLayoutState() {
  const selectors = {
    frame: '.site-page-frame',
    header: '.site-page-frame > header',
    contentsMount: '[data-site-contents-panel-mount]',
    shell: '.site-page-frame > .docs-shell',
    title: '#_top',
    gallery: '.library-gallery',
  };
  const elementState = (node: Element) => {
    const css = getComputedStyle(node),
      rect = node.getBoundingClientRect();
    return {
      tag: node.localName,
      id: node.id,
      classes: node.getAttribute('class'),
      style: node.getAttribute('style'),
      hidden: node.getAttribute('hidden'),
      connected: node.isConnected,
      ownerDocumentMatches: node.ownerDocument === document,
      viewport: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      document: { x: rect.x + scrollX, y: rect.y + scrollY },
      display: css.display,
      position: css.position,
      lineHeight: css.lineHeight,
      font: css.fontFamily,
      fontSize: css.fontSize,
      margin: css.margin,
      padding: css.padding,
      border: css.borderWidth,
      visibility: css.visibility,
      transform: css.transform,
    };
  };
  const targets = Object.fromEntries(
    Object.entries(selectors).map(([name, selector]) => {
      const matches = document.querySelectorAll(selector);
      if (matches.length !== 1)
        throw new Error(`Shared layout ${name}: expected one node, got ${matches.length}`);
      const node = matches[0];
      const ancestors = [];
      for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        if (ancestors.length >= 32) throw new Error('Shared layout ancestry exceeds32');
        ancestors.push(elementState(parent));
      }
      return [
        name,
        {
          selector,
          ...elementState(node),
          ancestors,
          children: [...node.children].slice(0, 32).map(elementState),
          childCount: node.children.length,
        },
      ];
    })
  );
  const mount = document.querySelector('[data-site-contents-panel-mount]')!;
  return {
    now: performance.now(),
    viewport: { width: innerWidth, height: innerHeight },
    scroll: { x: scrollX, y: scrollY },
    targets,
    contents: {
      generation: mount.getAttribute('data-contents-panel-generation'),
      runtime: mount.getAttribute('data-contents-panel-runtime'),
      family: mount.getAttribute('data-contents-panel-family'),
      bodyDialog: document.body.getAttribute('data-site-contents-dialog'),
      bodyExpanded: document.body.getAttribute('data-mobile-menu-expanded'),
      commands: [...document.querySelectorAll('[data-site-contents-command]')].map((node) => ({
        expanded: node.getAttribute('aria-expanded'),
        controls: node.getAttribute('aria-controls'),
      })),
      activeHosts: [...mount.querySelectorAll('[data-projection-generation-state="active"]')].map(
        elementState
      ),
    },
    galleryHosts: [...document.querySelectorAll('.library-gallery [data-library-part]')].map(
      (node) => ({
        tag: node.localName,
        part: node.getAttribute('data-library-part'),
        registered: typeof customElements.get(node.localName) === 'function',
        exactConstructor: node.constructor === customElements.get(node.localName),
      })
    ),
    faces: [...document.fonts].map((face) => ({ family: face.family, status: face.status })),
  };
}

it('shared page layout diagnosis preserves original endpoints and isolates closed contents mount', async () => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    colorScheme: 'light',
  });
  const record: Record<string, unknown> = {
    source,
    requestedSitePreference: 'wc',
    hostCoverage:
      'This independent layout case records actual tags/counts; the unchanged eight-case suite owns WC constructor acceptance.',
    role: 'single-page reversible DOM intervention; not source revert, product fix, CLS acceptance or historical sole-cause proof',
    startedAt: new Date().toISOString(),
  };
  const forbidden: string[] = [],
    pageErrors: string[] = [],
    cleanup: CleanupIssue[] = [];
  const reportCleanup = (issue: CleanupIssue) => {
    cleanup.push(issue);
  };
  let release!: () => void,
    released = false,
    primaryError = false,
    stopped = false;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const heldRequests: Array<{ url: string; type: string }> = [];
  let page: Page | undefined;
  type HeldLayoutValue = {
    nodes: Array<{ selector: string; node: HTMLElement }>;
    originalStyle: string | null;
    originalHidden: string | null;
    control: HTMLDivElement | null;
    mountTouched: boolean;
    stopped: boolean;
  };
  let handles: import('playwright-core').JSHandle<HeldLayoutValue> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stages: Array<{ name: string; state: ReturnType<typeof readSharedLayoutState> }> = [];
  record.stages = stages;
  async function live<T>(work: () => Promise<T>) {
    if (stopped) throw new Error('Shared layout diagnostic stopped before next operation');
    const value = await work();
    if (stopped) throw new Error('Shared layout diagnostic stopped during operation');
    return value;
  }
  async function bounded<T>(work: () => Promise<T>, milliseconds: number, label: string) {
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        work(),
        new Promise<never>((_, reject) => {
          deadline = setTimeout(() => reject(new Error(label)), milliseconds);
        }),
      ]);
    } finally {
      if (deadline) clearTimeout(deadline);
    }
  }
  try {
    await Promise.race([
      (async () => {
        await live(() =>
          context.addInitScript(
            ({ key }) => {
              localStorage.setItem(key, 'wc');
              localStorage.setItem('starlight-theme', 'light');
            },
            { key: PREFERRED_ADAPTER_KEY }
          )
        );
        page = await live(() => context.newPage());
        page.setDefaultTimeout(10_000);
        page.on('pageerror', (error) => pageErrors.push(error.message));
        await live(() =>
          page!.route('**/*', async (request) => {
            const url = new URL(request.request().url());
            if (url.origin !== new URL(baseUrl).origin) {
              forbidden.push(url.href);
              await request.abort();
              return;
            }
            if (!released && ['font', 'script'].includes(request.request().resourceType())) {
              heldRequests.push({ url: url.href, type: request.request().resourceType() });
              await gate;
            }
            if (stopped) {
              await request.abort();
              return;
            }
            await request.continue();
          })
        );
        await live(() => page!.goto(baseUrl + route, { waitUntil: 'commit' }));
        await live(() =>
          page!
            .locator('.library-gallery [data-library="brutalist"] h2')
            .waitFor({ state: 'attached' })
        );
        // First raw geometry before any handles, screenshots, font waits or intervention.
        const held = await live(() => page!.evaluate(readSharedLayoutState));
        stages.push({ name: 'held-original', state: held });
        record.heldRequests = heldRequests;
        handles = await live(() =>
          page!.evaluateHandle(() => {
            const selectors = [
              '.site-page-frame',
              '.site-page-frame > header',
              '[data-site-contents-panel-mount]',
              '.site-page-frame > .docs-shell',
              '#_top',
              '.library-gallery',
            ];
            return {
              nodes: selectors.map((selector) => {
                const matches = document.querySelectorAll<HTMLElement>(selector);
                if (matches.length !== 1)
                  throw new Error(`Ambiguous held layout node: ${selector}`);
                return { selector, node: matches[0] };
              }),
              originalStyle: document
                .querySelector('[data-site-contents-panel-mount]')!
                .getAttribute('style'),
              originalHidden: document
                .querySelector('[data-site-contents-panel-mount]')!
                .getAttribute('hidden'),
              control: null as HTMLDivElement | null,
              mountTouched: false,
              stopped: false,
            };
          })
        );
        record.heldImage = await live(() =>
          captureCurrentViewport(
            page!,
            path.join(directory, 'shared-layout-held.png'),
            undefined,
            reportCleanup
          )
        );
        released = true;
        release();
        await live(() =>
          page!.waitForFunction(
            () => {
              const mount = document.querySelector('[data-site-contents-panel-mount]');
              return (
                mount?.hasAttribute('data-contents-panel-generation') &&
                !!mount.querySelector('[data-projection-generation-state="active"]') &&
                document.querySelectorAll('.library-gallery [data-library-part]').length > 0 &&
                [...document.querySelectorAll('.library-gallery [data-library-part]')].every(
                  (node) => customElements.get(node.localName)
                )
              );
            },
            undefined,
            { timeout: 15_000 }
          )
        );
        await live(() =>
          page!.waitForFunction(() => document.fonts.status === 'loaded', undefined, {
            timeout: 15_000,
          })
        );
        await live(() =>
          page!.evaluate(
            () =>
              new Promise<void>((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
              )
          )
        );
        const settled = await live(() => page!.evaluate(readSharedLayoutState));
        stages.push({ name: 'settled-original', state: settled });
        record.settledImage = await live(() =>
          captureCurrentViewport(
            page!,
            path.join(directory, 'shared-layout-settled.png'),
            undefined,
            reportCleanup
          )
        );
        expect(settled.contents.bodyExpanded).toBeNull();
        expect(settled.contents.commands.length).toBeGreaterThan(0);
        expect(settled.contents.commands.every((command) => command.expanded === 'false')).toBe(
          true
        );
        expect(settled.contents.activeHosts).toHaveLength(1);
        // Keep the original settled style, not a guessed empty inline declaration.
        const originalAttributes = await live(() =>
          handles!.evaluate((value) => {
            const held = value as {
              nodes: Array<{ selector: string; node: HTMLElement }>;
              originalStyle: string | null;
              originalHidden: string | null;
              stopped: boolean;
            };
            if (held.stopped) throw new Error('Stopped shared layout operation');
            for (const item of held.nodes)
              if (
                !item.node.isConnected ||
                item.node.ownerDocument !== document ||
                document.querySelectorAll(item.selector).length !== 1 ||
                document.querySelector(item.selector) !== item.node
              )
                throw new Error('Held shared layout node identity changed');
            const mount = held.nodes[2].node;
            held.originalStyle = mount.getAttribute('style');
            held.originalHidden = mount.getAttribute('hidden');
            return {
              style: held.originalStyle,
              hidden: held.originalHidden,
              heldIdentities: held.nodes.map((item) => ({
                selector: item.selector,
                tag: item.node.localName,
                sameNode: document.querySelector(item.selector) === item.node,
                connected: item.node.isConnected,
                ownerDocumentMatches: item.node.ownerDocument === document,
              })),
            };
          })
        );
        record.interventionOriginalAttributes = originalAttributes;
        // Unrelated out-of-flow empty element: same display:none/restore operation,
        // with insertion separately observed so it cannot silently alter the baseline.
        await live(() =>
          handles!.evaluate((value) => {
            const held = value as { control: HTMLDivElement | null; stopped: boolean };
            if (held.stopped) throw new Error('Stopped shared layout operation');
            const control = document.createElement('div');
            control.setAttribute('aria-hidden', 'true');
            control.style.cssText =
              'position:fixed;left:-10000px;top:-10000px;width:1px;height:1px;pointer-events:none';
            document.body.append(control);
            held.control = control;
          })
        );
        stages.push({
          name: 'control-inserted',
          state: await live(() => page!.evaluate(readSharedLayoutState)),
        });
        await live(() =>
          handles!.evaluate((value) => {
            const held = value as { control: HTMLDivElement; stopped: boolean };
            if (held.stopped) throw new Error('Stopped shared layout operation');
            held.control.style.setProperty('display', 'none', 'important');
          })
        );
        stages.push({
          name: 'unrelated-hidden',
          state: await live(() => page!.evaluate(readSharedLayoutState)),
        });
        await live(() =>
          handles!.evaluate((value) => {
            const held = value as { control: HTMLDivElement; stopped: boolean };
            if (held.stopped) throw new Error('Stopped shared layout operation');
            held.control.style.removeProperty('display');
          })
        );
        stages.push({
          name: 'unrelated-restored',
          state: await live(() => page!.evaluate(readSharedLayoutState)),
        });
        await live(() =>
          handles!.evaluate((value) => {
            const held = value as {
              nodes: Array<{ node: HTMLElement }>;
              mountTouched: boolean;
              stopped: boolean;
            };
            if (held.stopped) throw new Error('Stopped shared layout operation');
            held.mountTouched = true;
            held.nodes[2].node.style.setProperty('display', 'none', 'important');
          })
        );
        stages.push({
          name: 'closed-mount-hidden',
          state: await live(() => page!.evaluate(readSharedLayoutState)),
        });
        record.interventionImage = await live(() =>
          captureCurrentViewport(
            page!,
            path.join(directory, 'shared-layout-intervention.png'),
            undefined,
            reportCleanup
          )
        );
        await live(() =>
          handles!.evaluate((value) => {
            const held = value as {
              nodes: Array<{ node: HTMLElement }>;
              originalStyle: string | null;
              stopped: boolean;
            };
            if (held.stopped) throw new Error('Stopped shared layout operation');
            const mount = held.nodes[2].node;
            if (held.originalStyle === null) mount.removeAttribute('style');
            else mount.setAttribute('style', held.originalStyle);
          })
        );
        stages.push({
          name: 'closed-mount-restored',
          state: await live(() => page!.evaluate(readSharedLayoutState)),
        });
        const targetNames = ['header', 'shell', 'title', 'gallery'];
        const geometry = (state: ReturnType<typeof readSharedLayoutState>) =>
          targetNames.map((name) => ({
            name,
            viewport: state.targets[name].viewport,
            document: state.targets[name].document,
          }));
        for (const stage of stages.filter((row) =>
          [
            'control-inserted',
            'unrelated-hidden',
            'unrelated-restored',
            'closed-mount-restored',
          ].includes(row.name)
        ))
          expect(geometry(stage.state), stage.name).toEqual(geometry(settled));
        const hidden = stages.find((row) => row.name === 'closed-mount-hidden')!.state;
        const deltas = targetNames.map((name) => ({
          name,
          originalY: settled.targets[name].document.y - held.targets[name].document.y,
          interventionY: hidden.targets[name].document.y - settled.targets[name].document.y,
          restoredY:
            stages.at(-1)!.state.targets[name].document.y - settled.targets[name].document.y,
        }));
        record.deltas = deltas;
        record.hypothesisSupportedAtTheseEndpoints =
          deltas
            .filter((row) => row.name !== 'header')
            .every((row) => row.originalY !== 0 && row.originalY + row.interventionY === 0) &&
          deltas[0].originalY === 0 &&
          deltas[0].interventionY === 0;
        record.interpretation =
          'The boolean only reports this isolated intervention. False retains the hypothesis as unproven; true still does not prove the historical sole cause or repair the page.';
        expect(heldRequests.some((row) => row.type === 'script')).toBe(true);
        expect(heldRequests.some((row) => row.type === 'font')).toBe(true);
        expect(forbidden).toEqual([]);
        expect(pageErrors).toEqual([]);
        expect(cleanup).toEqual([]);
        record.outcome = 'diagnostic-complete-not-product-acceptance';
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          stopped = true;
          reject(new Error('Shared layout diagnostic exceeded75s'));
        }, 75_000);
      }),
    ]);
  } catch (error) {
    stopped = true;
    primaryError = true;
    record.outcome = 'failed';
    record.error = String(error);
    throw error;
  } finally {
    stopped = true;
    if (timer) clearTimeout(timer);
    released = true;
    release();
    if (handles) {
      try {
        record.restoration = await bounded(
          () =>
            handles!.evaluate((value) => {
              const held = value as {
                nodes: Array<{ selector: string; node: HTMLElement }>;
                originalStyle: string | null;
                originalHidden: string | null;
                control: HTMLDivElement | null;
                mountTouched: boolean;
                stopped: boolean;
              };
              held.stopped = true;
              const mount = held.nodes[2].node;
              if (held.mountTouched) {
                if (held.originalStyle === null) mount.removeAttribute('style');
                else mount.setAttribute('style', held.originalStyle);
                if (held.originalHidden === null) mount.removeAttribute('hidden');
                else mount.setAttribute('hidden', held.originalHidden);
              }
              held.control?.remove();
              return {
                sameNode: document.querySelector('[data-site-contents-panel-mount]') === mount,
                connected: mount.isConnected,
                allHeldIdentities: held.nodes.every(
                  (item) =>
                    document.querySelectorAll(item.selector).length === 1 &&
                    document.querySelector(item.selector) === item.node &&
                    item.node.isConnected &&
                    item.node.ownerDocument === document
                ),
                style: mount.getAttribute('style'),
                hidden: mount.getAttribute('hidden'),
                controlConnected: held.control?.isConnected ?? false,
                attributesRestored:
                  !held.mountTouched ||
                  (mount.getAttribute('style') === held.originalStyle &&
                    mount.getAttribute('hidden') === held.originalHidden),
              };
            }),
          3000,
          'Shared layout restoration exceeded3s'
        );
        const restoration = record.restoration as {
          sameNode: boolean;
          connected: boolean;
          allHeldIdentities: boolean;
          controlConnected: boolean;
          attributesRestored: boolean;
        };
        if (
          !restoration.sameNode ||
          !restoration.connected ||
          !restoration.allHeldIdentities ||
          restoration.controlConnected ||
          !restoration.attributesRestored
        )
          throw new Error('Shared layout restoration verification failed');
        await bounded(() => handles!.dispose(), 1000, 'Shared layout handle disposal exceeded1s');
      } catch (error) {
        reportCleanup({ operation: 'shared-layout.restore', error: String(error) });
      }
    }
    record.forbiddenRequests = forbidden;
    record.pageErrors = pageErrors;
    await closeEvidenceContext(context, true, reportCleanup);
    record.cleanup = cleanup;
    if (primaryError)
      await writeFailureRecord(path.join(directory, 'shared-layout.json'), record, reportCleanup);
    else {
      if (cleanup.length) record.outcome = 'failed-cleanup';
      await writeFile(path.join(directory, 'shared-layout.json'), JSON.stringify(record, null, 2));
      expect(cleanup).toEqual([]);
    }
  }
}, 90_000);
