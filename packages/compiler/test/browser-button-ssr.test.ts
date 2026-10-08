// @vitest-environment node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  BrowserContext,
  Page,
} from '../../../apps/www/node_modules/playwright-core/types/types';
import { TARGET_PROFILES, resolveTargetProfile } from '../src/targets';
import { buildButtonSsrFixture } from './button-ssr-fixture';
import {
  sha256,
  startButtonSsrBrowserServer,
  type ButtonSsrBrowserServer,
  type ButtonSsrFixture,
} from './button-ssr-browser-server';

type ButtonElement = HTMLElement & {
  hydrationStatus: string;
  hydrationDiagnostic: { code: string; reason: string; path: string } | null;
  logicalOwner: symbol | null;
  viewEpoch: number;
  setProps(props: { disabled?: boolean }): void;
  getExposes(): Record<string, unknown>;
  dispose(): void;
};

declare global {
  interface Window {
    ButtonSsrFixture?: {
      register(): unknown;
      hydrate(element: ButtonElement): unknown;
    };
    buttonSsrProbe: {
      roots: ButtonElement[];
      children: Node[][];
      slots: (Element | null)[];
      outwardSignals: number[];
      trustedClicks: number[];
      focusEvents: { type: string; target: string | null }[];
      selection: {
        anchor: Node | null;
        anchorOffset: number;
        focus: Node | null;
        focusOffset: number;
        text: string;
      } | null;
      owners: (symbol | null)[];
    };
  }
}

let compiled: ButtonSsrFixture;
let fixture: ButtonSsrBrowserServer;

beforeAll(async () => {
  // The fixture must compile the real asButton source closure. No toy Button or
  // Adapter-rendered fallback is admitted when the compiler rejects that source.
  compiled = await buildButtonSsrFixture();
  fixture = await startButtonSsrBrowserServer(compiled);
}, 120_000);

afterAll(async () => {
  await fixture?.close();
}, 60_000);

async function withPage(
  name: string,
  run: (page: Page, context: BrowserContext, errors: string[]) => Promise<void>,
  options: { javaScriptEnabled?: boolean; expectedMismatch?: boolean } = {}
) {
  const context = await fixture.browser.newContext({
    viewport: { width: 900, height: 500 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    javaScriptEnabled: options.javaScriptEnabled ?? true,
  });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  const errors: string[] = [];
  const consoleMessages: { type: string; text: string }[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) =>
    consoleMessages.push({ type: message.type(), text: message.text() })
  );
  let failure: unknown;
  try {
    await run(page, context, errors);
    if (!options.expectedMismatch) expect(errors).toEqual([]);
  } catch (error) {
    failure = error;
    await page
      .screenshot({ path: path.join(fixture.evidenceDir, `${name}-failure.png`) })
      .catch(() => {});
    throw error;
  } finally {
    await writeFile(
      path.join(fixture.evidenceDir, `${name}-result.json`),
      JSON.stringify(
        {
          name,
          outcome: failure ? 'FAIL' : 'PASS',
          errors,
          consoleMessages,
          failure: failure ? String(failure) : null,
        },
        null,
        2
      )
    );
    try {
      await context.tracing.stop({ path: path.join(fixture.evidenceDir, `${name}-trace.zip`) });
    } finally {
      await context.close();
    }
  }
}

async function loaded(page: Page, query = '') {
  const response = await page.goto(`${fixture.baseUrl}/${query}`);
  expect(response?.status()).toBe(200);
  await page.waitForFunction(() => !!window.ButtonSsrFixture);
  expect(
    await page.evaluate((tag) => customElements.get(tag) === undefined, compiled.tagName)
  ).toBe(true);
}

async function remember(page: Page) {
  await page.evaluate((tag) => {
    const roots = [...document.querySelectorAll<ButtonElement>(tag)];
    window.buttonSsrProbe = {
      roots,
      children: roots.map((root) => [...root.childNodes]),
      slots: roots.map((root) => root.querySelector('[data-slot-label]')),
      outwardSignals: roots.map(() => 0),
      trustedClicks: roots.map(() => 0),
      focusEvents: [],
      selection: null,
      owners: [],
    };
    roots.forEach((root, index) =>
      root.addEventListener('click', (event) => {
        // A-WEB-COMPONENT-0001-M: the outward CustomEvent and native click
        // intentionally share a name. Unfiltered listeners observe both channels.
        if (event instanceof CustomEvent) window.buttonSsrProbe.outwardSignals[index] += 1;
        if (event.isTrusted) window.buttonSsrProbe.trustedClicks[index] += 1;
      })
    );
    for (const type of ['focusin', 'focusout'])
      document.addEventListener(type, (event) => {
        window.buttonSsrProbe.focusEvents.push({
          type,
          target: (event.target as Element)?.getAttribute('data-instance'),
        });
      });
  }, compiled.tagName);
}

async function adopt(page: Page) {
  await page.evaluate(() => {
    window.ButtonSsrFixture!.register();
    for (const root of window.buttonSsrProbe.roots) window.ButtonSsrFixture!.hydrate(root);
  });
  await page.waitForFunction(() =>
    window.buttonSsrProbe.roots.every((root) => root.hydrationStatus === 'adopted')
  );
}

async function snapshot(page: Page, name: string) {
  const observed = await page.evaluate((tag) => {
    const probe = window.buttonSsrProbe;
    const selection = document.getSelection();
    const selected = probe?.selection;
    return {
      readyState: document.readyState,
      roots: [...document.querySelectorAll<ButtonElement>(tag)].map((root, index) => {
        const rect = root.getBoundingClientRect();
        const style = getComputedStyle(root);
        return {
          sameRoot: !probe || root === probe.roots[index],
          sameChildren:
            !probe ||
            probe.children[index]
              .filter((node) => !(node instanceof HTMLScriptElement))
              .every((node) => node.parentNode === root),
          sameSlot: !probe || root.querySelector('[data-slot-label]') === probe.slots[index],
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          style: {
            display: style.display,
            visibility: style.visibility,
            opacity: style.opacity,
            background: style.backgroundColor,
            color: style.color,
            border: style.borderTopWidth,
            borderRadius: style.borderRadius,
            font: style.font,
            padding: style.padding,
          },
          role: root.getAttribute('role'),
          disabled: root.getAttribute('aria-disabled'),
          tabIndex: root.tabIndex,
          text: root.querySelector('[data-slot-label]')?.textContent,
          status: root.hydrationStatus ?? 'unregistered',
          owner: typeof root.logicalOwner === 'symbol',
          epoch: root.viewEpoch ?? 0,
          diagnostic: root.hydrationDiagnostic
            ? {
                code: root.hydrationDiagnostic.code,
                reason: root.hydrationDiagnostic.reason,
                path: root.hydrationDiagnostic.path,
              }
            : null,
          focused: document.activeElement === root,
        };
      }),
      outwardSignals: probe?.outwardSignals ?? [],
      trustedClicks: probe?.trustedClicks ?? [],
      focusEvents: probe?.focusEvents ?? [],
      selection: selected
        ? {
            sameAnchor: selection?.anchorNode === selected.anchor,
            sameFocus: selection?.focusNode === selected.focus,
            anchorOffset: selection?.anchorOffset,
            focusOffset: selection?.focusOffset,
            text: selection?.toString(),
          }
        : null,
    };
  }, compiled.tagName);
  await writeFile(
    path.join(fixture.evidenceDir, `${name}.json`),
    JSON.stringify(observed, null, 2)
  );
  return observed;
}

function expectVisible(root: Awaited<ReturnType<typeof snapshot>>['roots'][number]) {
  expect(root.rect.width).toBeGreaterThan(80);
  expect(root.rect.height).toBeGreaterThan(20);
  expect(root.style.display).not.toBe('none');
  expect(root.style.visibility).toBe('visible');
  expect(Number(root.style.opacity)).toBeGreaterThan(0);
  expect(root.style.background).not.toBe('rgba(0, 0, 0, 0)');
  expect(parseFloat(root.style.borderRadius)).toBeGreaterThan(0);
  expect(root.role).toBe('button');
  expect(root.text).toMatch(/^Compiler Button [12]$/);
}

async function accessibility(page: Page, context: BrowserContext, name: string) {
  const cdp = await context.newCDPSession(page);
  try {
    const document = await cdp.send('DOM.getDocument');
    const node = await cdp.send('DOM.querySelector', {
      nodeId: document.root.nodeId,
      selector: compiled.tagName,
    });
    const description = await cdp.send('DOM.describeNode', { nodeId: node.nodeId });
    const tree = await cdp.send('Accessibility.getPartialAXTree', {
      backendNodeId: description.node.backendNodeId,
      fetchRelatives: false,
    });
    await writeFile(
      path.join(fixture.evidenceDir, `${name}-ax.json`),
      JSON.stringify(tree, null, 2)
    );
    const root = tree.nodes.find(
      (entry) => entry.backendDOMNodeId === description.node.backendNodeId
    );
    expect(root?.ignored).toBe(false);
    expect(root?.role?.value).toBe('button');
    expect(root?.name?.value).toBe('Compiler Button 1');
    return root;
  } finally {
    await cdp.detach();
  }
}

describe.sequential('experimental compiler SSR: real Base Button source to native adoption', () => {
  it('keeps all four public SSR profiles unavailable', () => {
    for (const profile of [
      'react-dom-ssr-v1',
      'vue-ssr-v1',
      'vue2-ssr-v1',
      'web-component-ssr-v1',
    ] as const) {
      expect(TARGET_PROFILES[profile].implemented).toBe(false);
      expect(resolveTargetProfile(profile)).toMatchObject({
        ok: false,
        diagnostics: [{ code: 'PUI4001' }],
      });
    }
  });

  it('serves source-bound generated HTML/CSS with JavaScript disabled', async () => {
    await withPage(
      'no-javascript',
      async (page, context) => {
        const response = await page.goto(fixture.baseUrl);
        expect(response?.status()).toBe(200);
        const htmlSource = await response!.text();
        expect(htmlSource).toContain('data-pui-carrier');
        const before = await snapshot(page, 'no-javascript-first-paint');
        expectVisible(before.roots[0]);
        expect(before.roots[0].status).toBe('unregistered');
        expect(before.roots[0].tabIndex).toBe(0);
        await accessibility(page, context, 'no-javascript');
        await page.keyboard.press('Tab');
        expect(
          await page.locator(compiled.tagName).evaluate((root) => document.activeElement === root)
        ).toBe(true);
        await page.screenshot({ path: path.join(fixture.evidenceDir, 'no-javascript.png') });
      },
      { javaScriptEnabled: false }
    );
  }, 60_000);

  it('retains first paint and exact server nodes through delayed loading and every adoption frame', async () => {
    await withPage('delayed-adoption', async (page, context) => {
      let release!: () => void;
      let requested!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const request = new Promise<void>((resolve) => {
        requested = resolve;
      });
      await page.route('**/client.js', async (route) => {
        requested();
        await gate;
        await route.continue();
      });
      try {
        await page.goto(fixture.baseUrl, { waitUntil: 'commit' });
        await request;
        await page.locator(compiled.tagName).waitFor({ state: 'visible' });
        await remember(page);
        const before = await snapshot(page, 'delayed-before');
        expectVisible(before.roots[0]);
        expect(before.roots[0].status).toBe('unregistered');
        const beforePng = await page.screenshot({
          path: path.join(fixture.evidenceDir, 'delayed-before.png'),
        });
        // Prove a paused bundle is still absent across actual rendering opportunities.
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
            )
        );
        expect(await page.evaluate(() => window.ButtonSsrFixture === undefined)).toBe(true);
        const delayed = await snapshot(page, 'delayed-still-server');
        expect(delayed.roots[0].rect).toEqual(before.roots[0].rect);
        expect(delayed.roots[0].style).toEqual(before.roots[0].style);
        release();
        await page.waitForFunction(() => !!window.ButtonSsrFixture);
        const frames = await page.evaluate(async () => {
          const root = window.buttonSsrProbe.roots[0];
          const samples: unknown[] = [];
          for (let frame = 0; frame < 8; frame += 1) {
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
            if (frame === 1) {
              window.ButtonSsrFixture!.register();
              window.ButtonSsrFixture!.hydrate(root);
            }
            const rect = root.getBoundingClientRect();
            const style = getComputedStyle(root);
            samples.push({
              frame,
              status: root.hydrationStatus ?? 'unregistered',
              sameRoot: document.querySelector(root.localName) === root,
              sameSlot: root.querySelector('[data-slot-label]') === window.buttonSsrProbe.slots[0],
              rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
              opacity: style.opacity,
              visibility: style.visibility,
            });
          }
          return samples;
        });
        await writeFile(
          path.join(fixture.evidenceDir, 'delayed-frames.json'),
          JSON.stringify(frames, null, 2)
        );
        for (const frame of frames as {
          sameRoot: boolean;
          sameSlot: boolean;
          rect: unknown;
          opacity: string;
          visibility: string;
        }[]) {
          expect(frame.sameRoot).toBe(true);
          expect(frame.sameSlot).toBe(true);
          expect(frame.rect).toEqual(before.roots[0].rect);
          expect(frame.opacity).toBe(before.roots[0].style.opacity);
          expect(frame.visibility).toBe('visible');
        }
        const after = await snapshot(page, 'delayed-after');
        expect(after.roots[0]).toMatchObject({
          sameRoot: true,
          sameChildren: true,
          sameSlot: true,
          status: 'adopted',
          owner: true,
        });
        expect(after.roots[0].style).toEqual(before.roots[0].style);
        expect(after.outwardSignals).toEqual([0]);
        const afterPng = await page.screenshot({
          path: path.join(fixture.evidenceDir, 'delayed-after.png'),
        });
        // Native pixels, not only DOM/CSS declarations, must be identical here.
        expect(sha256(afterPng)).toBe(sha256(beforePng));
        await accessibility(page, context, 'delayed-adopted');
      } finally {
        release();
        await page.unrouteAll({ behavior: 'wait' });
      }
    });
  }, 60_000);

  it('preserves established focus and directional selection without replaying input', async () => {
    await withPage('focus-selection', async (page) => {
      await loaded(page);
      await remember(page);
      const initial = await page.evaluate(() => {
        const text = document.querySelector('#selection')!.firstChild!;
        const selection = document.getSelection()!;
        selection.setBaseAndExtent(text, 19, text, 2);
        const root = window.buttonSsrProbe.roots[0];
        root.focus();
        window.buttonSsrProbe.selection = {
          anchor: selection.anchorNode,
          anchorOffset: selection.anchorOffset,
          focus: selection.focusNode,
          focusOffset: selection.focusOffset,
          text: selection.toString(),
        };
        window.buttonSsrProbe.focusEvents.length = 0;
        return {
          focused: document.activeElement === root,
          text: selection.toString(),
          anchor: selection.anchorOffset,
          focus: selection.focusOffset,
        };
      });
      await writeFile(
        path.join(fixture.evidenceDir, 'focus-selection-preconditions.json'),
        JSON.stringify(initial, null, 2)
      );
      expect(initial.focused).toBe(true);
      expect(initial.text.length).toBeGreaterThan(0);
      expect(initial.anchor).toBeGreaterThan(initial.focus);
      await adopt(page);
      const after = await snapshot(page, 'focus-selection-after');
      expect(after.roots[0]).toMatchObject({ focused: true, sameRoot: true, sameSlot: true });
      expect(after.selection).toEqual({
        sameAnchor: true,
        sameFocus: true,
        anchorOffset: initial.anchor,
        focusOffset: initial.focus,
        text: initial.text,
      });
      expect(after.focusEvents.filter((event) => event.type === 'focusout')).toEqual([]);
      expect(after.outwardSignals).toEqual([0]);
      await page.keyboard.press('Enter');
      expect(await page.evaluate(() => window.buttonSsrProbe.outwardSignals)).toEqual([1]);
      await page.keyboard.press('Space');
      expect(await page.evaluate(() => window.buttonSsrProbe.outwardSignals)).toEqual([2]);
    });
  }, 60_000);

  it('projects disabled into the first AX tree and suppresses outward activation before/after adoption without stopping native click propagation', async () => {
    await withPage('disabled', async (page, context) => {
      await loaded(page, '?disabled=true');
      await remember(page);
      const before = await snapshot(page, 'disabled-before');
      expectVisible(before.roots[0]);
      expect(before.roots[0]).toMatchObject({ disabled: 'true', tabIndex: -1 });
      const firstAx = await accessibility(page, context, 'disabled-before');
      expect(
        firstAx?.properties?.find((property) => property.name === 'disabled')?.value.value
      ).toBe(true);
      await page.keyboard.press('Tab');
      expect(
        await page.locator(compiled.tagName).evaluate((root) => document.activeElement === root)
      ).toBe(false);
      const serverRect = await page.locator(compiled.tagName).boundingBox();
      if (!serverRect) throw new Error('Server disabled Button has no native box');
      await page.mouse.click(
        serverRect.x + serverRect.width / 2,
        serverRect.y + serverRect.height / 2
      );
      expect(await page.evaluate(() => window.buttonSsrProbe.outwardSignals)).toEqual([0]);
      await adopt(page);
      const rect = await page.locator(compiled.tagName).boundingBox();
      if (!rect) throw new Error('Disabled Button has no native box');
      // Physical mouse input still occurs; force-click would hide the actual input path.
      await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
      expect(await page.evaluate(() => window.buttonSsrProbe.outwardSignals)).toEqual([0]);
      expect(await page.evaluate(() => window.buttonSsrProbe.trustedClicks)).toEqual([2]);
      const afterAx = await accessibility(page, context, 'disabled-after');
      expect(
        afterAx?.properties?.find((property) => property.name === 'disabled')?.value.value
      ).toBe(true);
      await page.evaluate(() => window.buttonSsrProbe.roots[0].setProps({ disabled: false }));
      await page.locator(compiled.tagName).click();
      expect(await page.evaluate(() => window.buttonSsrProbe.outwardSignals)).toEqual([1]);
      await page.evaluate(() => window.buttonSsrProbe.roots[0].setProps({ disabled: true }));
      await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
      expect(await page.evaluate(() => window.buttonSsrProbe.outwardSignals)).toEqual([1]);
      await snapshot(page, 'disabled-final');
    });
  }, 60_000);

  it('isolates two owners, repeated initialization and terminal cleanup with one outward CustomEvent per activation', async () => {
    await withPage('owners-cleanup', async (page) => {
      await loaded(page, '?count=2');
      await remember(page);
      await adopt(page);
      const ownerFacts = await page.evaluate(() => {
        const probe = window.buttonSsrProbe;
        probe.owners = probe.roots.map((root) => root.logicalOwner);
        for (let iteration = 0; iteration < 4; iteration += 1) {
          window.ButtonSsrFixture!.register();
          for (const root of probe.roots) window.ButtonSsrFixture!.hydrate(root);
        }
        return {
          distinct: probe.owners[0] !== probe.owners[1],
          retained: probe.roots.every((root, index) => root.logicalOwner === probe.owners[index]),
        };
      });
      expect(ownerFacts).toEqual({ distinct: true, retained: true });
      const roots = page.locator(compiled.tagName);
      await roots.nth(0).click();
      expect(await page.evaluate(() => window.buttonSsrProbe.outwardSignals)).toEqual([1, 0]);
      await roots.nth(1).click();
      expect(await page.evaluate(() => window.buttonSsrProbe.outwardSignals)).toEqual([1, 1]);
      await page.evaluate(() => {
        const root = window.buttonSsrProbe.roots[0];
        root.dispose();
        root.dispose();
        root.click(); // Explicit synthetic stale-event control, not native-input evidence.
      });
      const disposed = await page.evaluate(() => ({
        owner: window.buttonSsrProbe.roots[0].logicalOwner === null,
        exposes: Object.keys(window.buttonSsrProbe.roots[0].getExposes()),
        outwardSignals: window.buttonSsrProbe.outwardSignals,
      }));
      expect(disposed).toEqual({ owner: true, exposes: [], outwardSignals: [1, 1] });
      await roots.nth(1).click();
      expect(await page.evaluate(() => window.buttonSsrProbe.outwardSignals)).toEqual([1, 2]);
      await roots.nth(1).focus();
      await page.keyboard.press('Enter');
      expect(await page.evaluate(() => window.buttonSsrProbe.outwardSignals)).toEqual([1, 3]);
      const terminal = await page.evaluate(() => {
        const root = window.buttonSsrProbe.roots[1];
        root.dispose();
        root.remove();
        document.querySelector('main')!.append(root);
        window.ButtonSsrFixture!.hydrate(root);
        return root.logicalOwner === null;
      });
      expect(terminal).toBe(true);
      await page.keyboard.press('Enter');
      expect(await page.evaluate(() => window.buttonSsrProbe.outwardSignals)).toEqual([1, 3]);
      await snapshot(page, 'owners-cleanup-final');
    });
  }, 60_000);

  for (const mutation of [
    'source',
    'profile',
    'props',
    'malformed',
    'helper',
    'css',
    'missing',
    'null',
    'false',
  ] as const) {
    it(`diagnoses ${mutation} carrier mismatch without replacing the server first paint`, async () => {
      await withPage(
        `mismatch-${mutation}`,
        async (page) => {
          await loaded(
            page,
            `?mutation=${mutation}${['missing', 'null', 'false'].includes(mutation) ? '&disabled=true' : ''}`
          );
          await remember(page);
          const before = await snapshot(page, `mismatch-${mutation}-before`);
          const beforePng = await page.screenshot({
            path: path.join(fixture.evidenceDir, `mismatch-${mutation}-before.png`),
          });
          const failure = await page.evaluate(() => {
            window.ButtonSsrFixture!.register();
            try {
              window.ButtonSsrFixture!.hydrate(window.buttonSsrProbe.roots[0]);
              return null;
            } catch (error) {
              return { message: String(error), code: (error as { code?: string }).code };
            }
          });
          const after = await snapshot(page, `mismatch-${mutation}-after`);
          expect(failure?.code).toBe('PUI_WC_HYDRATION_MISMATCH');
          expect(after.roots[0]).toMatchObject({
            status: 'mismatch',
            owner: false,
            sameRoot: true,
            sameChildren: true,
            sameSlot: true,
            diagnostic: { code: 'PUI_WC_HYDRATION_MISMATCH' },
          });
          expect(after.roots[0].diagnostic?.reason.length).toBeGreaterThan(0);
          expect(after.roots[0].rect).toEqual(before.roots[0].rect);
          expect(after.roots[0].style).toEqual(before.roots[0].style);
          expect(after.roots[0].disabled).toBe(before.roots[0].disabled);
          expect(after.roots[0].tabIndex).toBe(before.roots[0].tabIndex);
          expect(after.outwardSignals).toEqual([0]);
          const afterPng = await page.screenshot({
            path: path.join(fixture.evidenceDir, `mismatch-${mutation}-after.png`),
          });
          expect(sha256(afterPng)).toBe(sha256(beforePng));
        },
        { expectedMismatch: true }
      );
    }, 60_000);
  }

  it('rejects a changed delivered stylesheet even when its pixels are unchanged', async () => {
    await withPage(
      'stylesheet-bytes',
      async (page) => {
        await loaded(page);
        await remember(page);
        await page.evaluate(() => {
          document.querySelector('style[data-pui-ssr-css]')!.textContent +=
            '\n/* changed delivery */';
        });
        const before = await snapshot(page, 'stylesheet-bytes-before');
        expectVisible(before.roots[0]);
        const beforePng = await page.screenshot({
          path: path.join(fixture.evidenceDir, 'stylesheet-bytes-before.png'),
        });
        const failure = await page.evaluate(() => {
          window.ButtonSsrFixture!.register();
          try {
            window.ButtonSsrFixture!.hydrate(window.buttonSsrProbe.roots[0]);
            return null;
          } catch (error) {
            return { code: (error as { code?: string }).code, message: String(error) };
          }
        });
        const after = await snapshot(page, 'stylesheet-bytes-after');
        expect(failure?.code).toBe('PUI_WC_HYDRATION_MISMATCH');
        expect(after.roots[0]).toMatchObject({
          sameRoot: true,
          sameChildren: true,
          sameSlot: true,
          owner: false,
          status: 'mismatch',
        });
        expect(after.roots[0].diagnostic?.reason).toMatch(/CSS artifact/);
        expect(after.roots[0].rect).toEqual(before.roots[0].rect);
        expect(after.roots[0].style).toEqual(before.roots[0].style);
        const afterPng = await page.screenshot({
          path: path.join(fixture.evidenceDir, 'stylesheet-bytes-after.png'),
        });
        expect(sha256(afterPng)).toBe(sha256(beforePng));
      },
      { expectedMismatch: true }
    );
  }, 60_000);

  it('retains actual-source, profile, generated-helper and CSS provenance', async () => {
    const root = fileURLToPath(new URL('../../../', import.meta.url));
    const provenance = compiled.provenance;
    // This intentionally requires a source closure, not a fixture-supplied label.
    expect(provenance.profile).toBe('web-component-ssr-v1');
    const original = provenance.sourceFiles.find((entry) =>
      entry.file
        .replaceAll('\\', '/')
        .endsWith('packages/prototypes/base/src/button/button.proto.ts')
    );
    expect(original).toBeDefined();
    for (const entry of provenance.sourceFiles) {
      const contents = await readFile(path.resolve(root, entry.file), 'utf8');
      expect(entry.sha256).toBe(sha256(contents));
    }
    expect(provenance.cssSha256).toBe(sha256(compiled.cssText));
    const files = compiled.generatedFiles;
    for (const expected of [
      'Component.ts',
      'Component.client.ts',
      '.proto-ui/web-component/ssr-v1.ts',
    ]) {
      expect(files.some((file) => file.path === expected)).toBe(true);
    }
    for (const helper of provenance.generatedFiles) {
      const artifact = files.find((file) => file.path === helper.path);
      expect(artifact).toBeDefined();
      expect(helper.sha256).toBe(sha256(artifact!.contents));
    }
    expect(provenance.generatedFiles.some((file) => file.path.startsWith('.proto-ui/'))).toBe(true);
    expect(provenance.artifacts.source).toBe(provenance.source.sha256);
    expect(provenance.artifacts.css).toBe(provenance.cssSha256);
    expect(provenance.artifacts.helpers).toMatch(/^[a-f0-9]{64}$/);
    expect(provenance.clientSha256).toBe(sha256(compiled.clientCode));
    const code = files.map((file) => file.contents).join('\n');
    expect(code).not.toMatch(/from\s*['"]@proto\.ui\/(?:runtime|adapter-[^'"]+)['"]/);
    expect(code).not.toMatch(/\brequire\(['"]@proto\.ui\/(?:runtime|adapter-)/);
  });

  it('does not collide DOM IDs across two instances or independent HTTP renders', async () => {
    await withPage('request-isolation', async (page, context) => {
      const other = await context.newPage();
      try {
        await loaded(page, '?count=2');
        await loaded(other, '?count=2');
        const collect = async (target: Page) =>
          target.evaluate(
            (tag) => ({
              requests: [...document.querySelectorAll(tag)].map((root) =>
                root.getAttribute('data-request')
              ),
              // Harness nodes outside Button are intentionally excluded.
              ids: [...document.querySelectorAll(`${tag}[id], ${tag} [id]`)].map(
                (element) => element.id
              ),
              disabled: [...document.querySelectorAll(tag)].map((root) =>
                root.getAttribute('aria-disabled')
              ),
            }),
            compiled.tagName
          );
        const first = await collect(page);
        const second = await collect(other);
        await writeFile(
          path.join(fixture.evidenceDir, 'request-isolation.json'),
          JSON.stringify(
            { first, second, generatedIdsObserved: first.ids.length + second.ids.length },
            null,
            2
          )
        );
        expect(first.requests[0]).not.toBe(second.requests[0]);
        const ids = [...first.ids, ...second.ids];
        expect(first.ids).toHaveLength(2);
        expect(second.ids).toHaveLength(2);
        expect(new Set(ids).size).toBe(ids.length);
        await remember(page);
        await remember(other);
        await adopt(page);
        await adopt(other);
        await page.evaluate(() => window.buttonSsrProbe.roots[0].setProps({ disabled: true }));
        const untouched = await snapshot(other, 'request-isolation-untouched');
        expect(untouched.roots.every((root) => root.disabled !== 'true')).toBe(true);
        expect(untouched.outwardSignals).toEqual([0, 0]);
      } finally {
        await other.close();
      }
    });
  }, 60_000);
});
