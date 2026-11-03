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
