// @vitest-environment node
import fs from 'node:fs';
import { createServer, type Server } from 'node:http';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build, type Plugin } from 'esbuild';
import type { Browser, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser } from './browser-harness';

// Real source bundling + native Chromium, following scroll-end-follow.browser.test.ts.
// These controlled DOM layouts isolate the neutral host. They do not substitute
// for the original family Select / website journeys or their unchanged budgets.
let browser: Browser;
let server: Server;
let baseUrl = '';
let evidenceDirectory = '';
let source: Record<string, unknown>;

function resolveProtoUiImport(id: string): string | null {
  if (!id.startsWith('@proto.ui/')) return null;
  const [pkg, ...rest] = id.slice('@proto.ui/'.length).split('/');
  const subdir = pkg.startsWith('module-')
    ? path.join('modules', pkg.slice('module-'.length))
    : pkg.startsWith('adapter-')
      ? path.join('adapters', pkg.slice('adapter-'.length))
      : pkg.startsWith('prototypes-')
        ? path.join('prototypes', pkg.slice('prototypes-'.length))
        : pkg;
  const root = path.resolve(process.cwd(), 'packages', subdir, 'src', ...rest);
  for (const candidate of [path.join(root, 'index.ts'), root + '.ts', root + '.tsx']) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}
const sourcePlugin: Plugin = {
  name: 'positioning-native-source',
  setup(bundle) {
    bundle.onResolve({ filter: /^@proto\.ui\// }, (args) => {
      const resolved = resolveProtoUiImport(args.path);
      return resolved ? { path: resolved } : null;
    });
  },
};
const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

const probeSource = `
import { createFloatingUiAnchoredPositionHost } from './packages/modules/positioning/src/web/floating-ui-host.ts';

const labels = ['Web Components', 'React', 'Vue', 'Vue 2'];
const longHeights = [104, 64, 64, 64];
let anchor;
let floating;
let originalFloating;
let surface;
let viewport;
let rows = [];
let lease;
let config;
let composition;
let epoch = 0;
let natural;
const resolutions = [];
const box = (element) => element.getBoundingClientRect().toJSON();
const layer = (element) => {
  const computed = getComputedStyle(element);
  return {
    id: element.id,
    connected: element.isConnected,
    box: box(element),
    clientHeight: element.clientHeight,
    offsetHeight: element.offsetHeight,
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop,
    display: computed.display,
    maxHeight: computed.maxHeight,
    overflowY: computed.overflowY,
    position: computed.position,
    transform: computed.transform,
    availableHeight: computed.getPropertyValue('--proto-ui-available-height'),
    availableWidth: computed.getPropertyValue('--proto-ui-available-width'),
    inlineStyle: element.getAttribute('style'),
  };
};
const facts = () => ({
  composition,
  epoch,
  sameContent: document.getElementById('floating') === originalFloating,
  sameRows: rows.every((row, index) => document.getElementById('row-' + index) === row),
  natural,
  side: floating.dataset.side ?? null,
  align: floating.dataset.align ?? null,
  anchor: box(anchor),
  frame: layer(floating),
  surface: surface ? layer(surface) : null,
  viewport: layer(viewport),
  window: { width: innerWidth, height: innerHeight },
  rows: rows.map((row) => {
    const bounds = row.getBoundingClientRect();
    const center = document.elementFromPoint(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2
    );
    const range = document.createRange();
    range.selectNodeContents(row.firstElementChild);
    return {
      text: row.textContent,
      box: bounds.toJSON(),
      lines: [...range.getClientRects()].map((entry) => entry.toJSON()),
      ownsCenter: center === row || (!!center && row.contains(center)),
    };
  }),
  resolutions: resolutions.slice(),
});
const attach = () => {
  const ownEpoch = ++epoch;
  lease = createFloatingUiAnchoredPositionHost().attach({
    anchor,
    floating,
    config,
    onResolved(snapshot) {
      if (resolutions.length < 48) {
        resolutions.push({
          epoch: ownEpoch,
          at: performance.now(),
          snapshot,
          frame: layer(floating),
          viewport: layer(viewport),
        });
      }
    },
  });
};
const create = (options) => {
  lease?.dispose();
  resolutions.length = 0;
  epoch = 0;
  composition = options.composition;
  document.body.replaceChildren();
  anchor = document.createElement('button');
  anchor.id = 'anchor';
  anchor.type = 'button';
  anchor.textContent = 'Anchor';
  floating = document.createElement('div');
  originalFloating = floating;
  floating.id = 'floating';
  floating.className = 'floating ' + composition;
  floating.setAttribute('role', 'listbox');
  surface = null;
  viewport = floating;
  if (composition === 'nested') {
    surface = document.createElement('div');
    surface.id = 'surface';
    surface.className = 'surface';
    viewport = document.createElement('div');
    viewport.id = 'viewport';
    viewport.className = 'viewport';
    surface.append(viewport);
    floating.append(surface);
  }
  rows = labels.map((label, index) => {
    const row = document.createElement('div');
    row.id = 'row-' + index;
    row.className = 'row';
    row.setAttribute('role', 'option');
    row.style.height = (options.short ? 40 : longHeights[index]) + 'px';
    const text = document.createElement('span');
    text.textContent = label;
    row.append(text);
    viewport.append(row);
    return row;
  });
  document.body.append(anchor, floating);
  // The only unconstrained measurement happens before any host lease exists.
  // It is a real DOM premise, not a mocked rectangle or an accepted final placement.
  natural = {
    frame: box(floating),
    viewport: box(viewport),
    rows: rows.map(box),
  };
  if (options.hidden) floating.style.display = 'none';
  config = {
    side: 'bottom',
    align: 'start',
    sideOffset: 4,
    alignOffset: 0,
    strategy: 'fixed',
    avoidCollisions: options.avoidCollisions,
    collisionBoundary: 'clippingAncestors',
    collisionPadding: 10,
  };
  attach();
  return facts();
};
const hiddenLayoutCheckpoint = async () => {
  // A controlled host-layout ordering: let real hidden-view updates run before reveal.
  // This does not add time to, or replace, the original website's visibility oracle.
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await new Promise((resolve) => requestAnimationFrame(resolve));
  return facts();
};
const reopenWithLongContent = () => {
  floating.style.display = 'none';
  lease.dispose();
  rows.forEach((row, index) => { row.style.height = longHeights[index] + 'px'; });
  // Keep the exact Content and row nodes, including any styles the old lease retained.
  attach();
  return facts();
};
const revealAndRequestUpdate = () => {
  floating.style.removeProperty('display');
  lease.requestUpdate();
  return facts();
};
globalThis.positioningColdSizeFixture = {
  create,
  facts,
  hiddenLayoutCheckpoint,
  reopenWithLongContent,
  revealAndRequestUpdate,
  dispose() { lease?.dispose(); },
};
`;

const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Anchored positioning cold-size control</title>
<style>
html, body { margin: 0; min-height: 100%; }
body { min-height: 100vh; font: 28px/40px sans-serif; }
#anchor {
  position: fixed; left: 16px; top: 724px; width: 288px; height: 36px;
  box-sizing: border-box; margin: 0; border: 0; padding: 0; font: 16px/20px sans-serif;
}
.floating {
  display: block; width: 288px; box-sizing: border-box;
  max-height: var(--proto-ui-available-height); overflow-x: hidden; overflow-y: auto;
  background: white; outline: 1px solid black;
}
.floating.nested { display: flex; flex-direction: column; }
.surface {
  display: flex; flex-direction: column; box-sizing: border-box;
  max-height: 100%; overflow-x: hidden; overflow-y: auto;
}
.viewport { flex: 1 1 auto; min-height: 0; overflow-x: hidden; overflow-y: auto; }
.row {
  box-sizing: border-box; display: flex; align-items: center; padding: 0 8px;
  background: #e0e7ff; box-shadow: inset 0 -1px #889;
}
</style></head><body><script src="/probe.js"></script></body></html>`;

beforeAll(async () => {
  const root =
    process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR ??
    (await mkdtemp(path.join(tmpdir(), 'positioning-cold-size-')));
  evidenceDirectory = path.join(root, 'positioning-cold-size');
  await mkdir(evidenceDirectory, { recursive: true });
  const bundled = await build({
    stdin: {
      contents: probeSource,
      resolveDir: process.cwd(),
      sourcefile: 'anchored-positioning-cold-size-probe.ts',
      loader: 'ts',
    },
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    write: false,
    sourcemap: 'inline',
    metafile: true,
    plugins: [sourcePlugin],
    define: { 'process.env.NODE_ENV': JSON.stringify('test') },
  });
  const browserBundle = bundled.outputFiles[0].text;
  source = {
    head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirty: !!execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
      encoding: 'utf8',
    }).trim(),
    test: {
      path: path.relative(process.cwd(), fileURLToPath(import.meta.url)),
      sha256: sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
    },
    htmlSha256: sha256(html),
    probeSha256: sha256(probeSource),
    servedBundleSha256: sha256(browserBundle),
    inputs: Object.keys(bundled.metafile.inputs)
      .sort()
      .map((input) => {
        const file = path.resolve(process.cwd(), input);
        return {
          path: input,
          sha256: fs.existsSync(file) ? sha256(fs.readFileSync(file)) : null,
          inlineInput: input === 'anchored-positioning-cold-size-probe.ts',
        };
      }),
  };
  await Promise.all([
    writeFile(path.join(evidenceDirectory, 'probe.js'), browserBundle),
    writeFile(path.join(evidenceDirectory, 'probe.html'), html),
    writeFile(
      path.join(evidenceDirectory, 'metafile.json'),
      JSON.stringify(bundled.metafile, null, 2)
    ),
    writeFile(path.join(evidenceDirectory, 'source.json'), JSON.stringify(source, null, 2)),
  ]);
  server = createServer((request, response) => {
    if (request.url === '/probe.js') {
      response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      response.end(browserBundle);
    } else if (request.url === '/') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(html);
    } else {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Positioning fixture has no TCP port.');
  baseUrl = 'http://127.0.0.1:' + address.port;
  browser = await launchBrowser();
}, 60_000);

afterAll(async () => {
  await browser?.close();
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
}, 60_000);

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
};
type Layer = {
  box: Rect;
  clientHeight: number;
  offsetHeight: number;
  scrollHeight: number;
  display: string;
  maxHeight: string;
  availableHeight: string;
  transform: string;
};
type Facts = {
  sameContent: boolean;
  sameRows: boolean;
  side: string | null;
  anchor: Rect;
  frame: Layer;
  surface: Layer | null;
  viewport: Layer;
  window: { width: number; height: number };
  natural: { frame: Rect; viewport: Rect; rows: Rect[] };
  rows: { text: string; box: Rect; lines: Rect[]; ownsCenter: boolean }[];
};
const readFacts = (page: Page): Promise<Facts> =>
  page.evaluate(() => (globalThis as any).positioningColdSizeFixture.facts());
const readSide = (page: Page): Promise<string | null> =>
  page.evaluate(() => document.getElementById('floating')?.getAttribute('data-side') ?? null);

function assertInputGeometry(facts: Facts, contentHeight: number) {
  expect(facts.window).toEqual({ width: 320, height: 1000 });
  expect(facts.anchor.x).toBe(16);
  expect(facts.anchor.y).toBe(724);
  expect(facts.anchor.width).toBe(288);
  expect(facts.anchor.height).toBe(36);
  expect(facts.anchor.top).toBeGreaterThan(10);
  expect(facts.anchor.right).toBeLessThanOrEqual(facts.window.width - 10);
  const below = facts.window.height - 10 - (facts.anchor.bottom + 4);
  const above = facts.anchor.top - 4 - 10;
  expect(below).toBe(226);
  expect(above).toBeGreaterThanOrEqual(contentHeight);
  return { above, below };
}

describe('native anchored positioning: real intrinsic content and retained availability', () => {
  for (const composition of ['flat', 'nested'] as const) {
    for (const scenario of ['visible', 'cold', 'reopen', 'collision-disabled'] as const) {
      it(
        composition + ' / ' + scenario,
        async () => {
          const context = await browser.newContext({ viewport: { width: 320, height: 1000 } });
          const page = await context.newPage();
          const errors: string[] = [];
          const stages: unknown[] = [];
          let passed = false;
          let failure: unknown;
          page.on('pageerror', (error) => errors.push(error.message));
          try {
            expect((await page.goto(baseUrl))?.ok()).toBe(true);
            const initial = (await page.evaluate(
              (options) => (globalThis as any).positioningColdSizeFixture.create(options),
              {
                composition,
                hidden: scenario === 'cold',
                short: scenario === 'reopen',
                avoidCollisions: scenario !== 'collision-disabled',
              }
            )) as Facts;
            stages.push({ stage: 'attached', facts: initial });
            assertInputGeometry(initial, 296);
            expect(initial.natural.frame.height).toBe(scenario === 'reopen' ? 160 : 296);
            expect(initial.natural.rows.reduce((height, row) => height + row.height, 0)).toBe(
              scenario === 'reopen' ? 160 : 296
            );

            if (scenario === 'reopen') {
              await expect.poll(() => readSide(page), { timeout: 1000 }).toBe('bottom');
              const short = await readFacts(page);
              stages.push({ stage: 'short-visible-before-close', facts: short });
              expect(short.frame.box.height).toBe(160);
              expect(short.frame.box.top).toBe(short.anchor.bottom + 4);
              expect(short.rows.every((row) => row.ownsCenter)).toBe(true);
              await page.evaluate(() =>
                (globalThis as any).positioningColdSizeFixture.reopenWithLongContent()
              );
            }
            if (scenario === 'cold' || scenario === 'reopen') {
              const hidden = (await page.evaluate(() =>
                (globalThis as any).positioningColdSizeFixture.hiddenLayoutCheckpoint()
              )) as Facts;
              stages.push({ stage: 'hidden-layout-checkpoint', facts: hidden });
              expect(hidden.sameContent).toBe(true);
              expect(hidden.frame.display).toBe('none');
              expect(hidden.frame.box.height).toBe(0);
              await page.evaluate(() =>
                (globalThis as any).positioningColdSizeFixture.revealAndRequestUpdate()
              );
            }

            const expectedSide = scenario === 'collision-disabled' ? 'bottom' : 'top';
            await expect.poll(() => readSide(page), { timeout: 1000 }).toBe(expectedSide);
            const final = await readFacts(page);
            stages.push({ stage: 'resolved', facts: final });
            const space = assertInputGeometry(final, 296);
            const demand = final.rows.reduce((height, row) => height + row.box.height, 0);
            expect(demand).toBe(296);
            expect(demand).toBeGreaterThan(space.below);
            expect(final.sameContent).toBe(true);
            expect(final.sameRows).toBe(true);
            expect(final.rows.map((row) => row.text)).toEqual([
              'Web Components',
              'React',
              'Vue',
              'Vue 2',
            ]);
            expect(final.frame.transform).toBe('none');
            expect(final.frame.box.left).toBeGreaterThanOrEqual(10);
            expect(final.frame.box.right).toBeLessThanOrEqual(final.window.width - 10);

            if (scenario === 'collision-disabled') {
              // Explicit collision opt-out keeps the requested side. It does not
              // claim the long content fits below; the real scrollport must retain it.
              expect(final.frame.box.top).toBe(final.anchor.bottom + 4);
              expect(final.frame.box.height).toBe(space.below);
              expect(final.viewport.scrollHeight).toBe(296);
              expect(final.viewport.scrollHeight).toBeGreaterThan(final.viewport.clientHeight);
              if (composition === 'nested') {
                // A clipped outer frame cannot stand in for nested intrinsic content.
                expect(final.frame.scrollHeight).toBe(final.frame.clientHeight);
              }
            } else {
              expect(final.frame.box.height).toBe(demand);
              expect(final.frame.box.bottom).toBe(final.anchor.top - 4);
              expect(final.frame.box.top).toBeGreaterThanOrEqual(10);
              expect(final.frame.box.bottom).toBeLessThanOrEqual(final.window.height - 10);
              for (const row of final.rows) {
                expect(row.ownsCenter).toBe(true);
                expect(row.lines.length).toBeGreaterThan(0);
                for (const bounds of [final.viewport.box, final.frame.box]) {
                  expect(row.box.top).toBeGreaterThanOrEqual(bounds.top - 1);
                  expect(row.box.bottom).toBeLessThanOrEqual(bounds.bottom + 1);
                  for (const line of row.lines) {
                    expect(line.left).toBeGreaterThanOrEqual(bounds.left - 1);
                    expect(line.right).toBeLessThanOrEqual(bounds.right + 1);
                    expect(line.top).toBeGreaterThanOrEqual(bounds.top - 1);
                    expect(line.bottom).toBeLessThanOrEqual(bounds.bottom + 1);
                  }
                }
              }
            }
            expect(errors).toEqual([]);
            passed = true;
          } catch (error) {
            failure = error;
            throw error;
          } finally {
            try {
              const terminal = await readFacts(page).catch((error) => ({
                unavailable: String(error),
              }));
              const id = composition + '-' + scenario;
              await writeFile(
                path.join(evidenceDirectory, id + '.json'),
                JSON.stringify(
                  {
                    source,
                    browser: browser.version(),
                    composition,
                    scenario,
                    status: passed ? 'passed' : 'failed',
                    failure:
                      failure instanceof Error
                        ? { name: failure.name, message: failure.message, stack: failure.stack }
                        : failure == null
                          ? null
                          : String(failure),
                    scope: 'native controlled geometry; not the website Select acceptance',
                    input: {
                      viewport: [320, 1000],
                      anchor: [16, 724, 288, 36],
                      sideOffset: 4,
                      collisionPadding: 10,
                      contentRows: [104, 64, 64, 64],
                    },
                    stages,
                    terminal,
                    errors,
                  },
                  null,
                  2
                )
              );
              await page.screenshot({ path: path.join(evidenceDirectory, id + '.png') });
            } catch (evidenceError) {
              if (failure == null) throw evidenceError;
            } finally {
              await page
                .evaluate(() => (globalThis as any).positioningColdSizeFixture?.dispose())
                .catch(() => {});
              try {
                await context.close();
              } catch (cleanupError) {
                if (failure == null) throw cleanupError;
              }
            }
          }
        },
        15_000
      );
    }
  }
});
