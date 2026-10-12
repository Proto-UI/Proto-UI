// @vitest-environment node

import { createServer, type Server } from 'node:http';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from 'esbuild';
import type { Browser } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { launchBrowser } from '../src/content/docs/zh-cn/browser-harness';

let browser: Browser;
let server: Server;
let baseUrl = '';
let evidenceDir = '';

// Real CSS layout and the platform ResizeObserver are intentionally unmodified.
// This observer records delivery independently; it never refreshes the host.
const fixtureSource = `
import { createWindowedCollection } from './packages/prototypes/base/src/virtual-list/model.ts';
import { attachWebVirtualList } from './packages/prototypes/base/src/virtual-list/web.ts';
const collection = createWindowedCollection({overscanItems: 0, maxMaterializedItems: 10});
collection.setItems(Array.from({length: 10}, (_, i) => 'row-' + i));
const viewport = document.querySelector('#viewport');
const content = document.querySelector('#content');
const deliveries = [];
let scrollEvents = 0;
viewport.addEventListener('scroll', () => scrollEvents++);
const host = attachWebVirtualList({viewport, content, collection, estimateSize: 20,
  renderItem(key) {
    const row = document.createElement('div');
    row.dataset.key = key;
    row.textContent = key;
    row.style.cssText = 'height:20px;box-sizing:border-box;overflow:hidden;background:#dbeafe;outline:1px solid #93c5fd';
    return row;
  },
});
const rows = () => Array.from(content.querySelectorAll('[role=listitem]'));
const originals = rows();
const observer = new ResizeObserver(entries => {
  for (const entry of entries) if (entry.target === originals[0]) deliveries.push(entry.contentRect.height);
});
observer.observe(originals[0]);
const frames = async () => { for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame); };
window.virtualResize = {
  read() {
    const current = rows();
    const viewportRect = viewport.getBoundingClientRect();
    const last = current.at(-1)?.getBoundingClientRect();
    return {
      keys: collection.snapshot().materializedKeys,
      heights: current.map(row => row.getBoundingClientRect().height),
      extent: current.reduce((sum, row) => sum + row.getBoundingClientRect().height, 0),
      viewportHeight: viewport.clientHeight,
      covered: Boolean(last && last.bottom >= viewportRect.bottom),
      identities: originals.map((row, i) => current[i] === row),
      trailing: content.lastElementChild?.style.height ?? null,
      childCount: content.children.length,
      scrollTop: viewport.scrollTop, scrollEvents,
      deliveries: deliveries.slice(),
    };
  },
  resize(height) { originals[0].style.height = height + 'px'; },
  async settle() { await frames(); },
  async dispose() {
    host.dispose();
    observer.disconnect();
    originals[0].style.height = '1px';
    viewport.style.height = '80px';
    await frames();
  },
};
`;

type Observation = {
  keys: string[];
  heights: number[];
  extent: number;
  viewportHeight: number;
  covered: boolean;
  identities: boolean[];
  trailing: string | null;
  childCount: number;
  scrollTop: number;
  scrollEvents: number;
  deliveries: number[];
};
declare global {
  interface Window {
    virtualResize: {
      read(): Observation;
      resize(height: number): void;
      settle(): Promise<void>;
      dispose(): Promise<void>;
    };
  }
}

beforeAll(async () => {
  evidenceDir = process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR
    ? path.join(process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR, 'virtual-list-resize')
    : await mkdtemp(path.join(tmpdir(), 'proto-virtual-list-resize-'));
  await mkdir(evidenceDir, { recursive: true });
  const bundled = await build({
    stdin: {
      contents: fixtureSource,
      resolveDir: process.cwd(),
      sourcefile: 'virtual-list-resize-probe.ts',
      loader: 'ts',
    },
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    write: false,
  });
  const script = bundled.outputFiles[0]!.text;
  server = createServer((request, response) => {
    if (request.url === '/probe.js') {
      response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      response.end(script);
    } else {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(
        '<!doctype html><html><head><meta charset="utf-8"><title>Virtual List native resize</title></head><body><h1>Virtual List native resize</h1><div id="viewport" style="height:60px;width:240px;overflow:auto;overflow-anchor:none"><div id="content"></div></div><script src="/probe.js"></script></body></html>'
      );
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Virtual List fixture has no TCP address.');
  baseUrl = `http://127.0.0.1:${address.port}`;
  browser = await launchBrowser();
  console.log(`Virtual List resize evidence: ${evidenceDir}`);
}, 60_000);

afterAll(async () => {
  try {
    await browser?.close();
  } finally {
    if (server?.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}, 60_000);

it('native row resize fills the viewport without scroll or explicit refresh and preserves retained keys', async () => {
  const context = await browser.newContext({ viewport: { width: 640, height: 360 } });
  const page = await context.newPage();
  const errors: string[] = [],
    unexpectedRequests: string[] = [];
  const observations: Record<string, unknown> = { browser: browser.version() };
  page.on('pageerror', (error) => errors.push(error.message));
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).origin === baseUrl) return route.continue();
    unexpectedRequests.push(route.request().url());
    return route.abort();
  });
  const read = () => page.evaluate(() => window.virtualResize.read());
  try {
    await page.goto(baseUrl);
    await expect.poll(read).toMatchObject({
      keys: ['row-0', 'row-1', 'row-2'],
      heights: [20, 20, 20],
      extent: 60,
      viewportHeight: 60,
      covered: true,
      deliveries: [20],
    });
    observations.initial = await read();
    await page.evaluate(() => window.virtualResize.resize(5));
    await expect.poll(async () => (await read()).deliveries).toContain(5);
    await expect.poll(read).toMatchObject({
      keys: ['row-0', 'row-1', 'row-2', 'row-3'],
      heights: [5, 20, 20, 20],
      extent: 65,
      covered: true,
      identities: [true, true, true],
      trailing: '120px',
      scrollTop: 0,
      scrollEvents: 0,
    });
    observations.shrink = await read();
    await page
      .locator('#viewport')
      .screenshot({ path: path.join(evidenceDir, 'shrink-filled.png') });
    await page.evaluate(() => window.virtualResize.resize(45));
    await expect.poll(async () => (await read()).deliveries).toContain(45);
    await expect.poll(read).toMatchObject({
      keys: ['row-0', 'row-1'],
      heights: [45, 20],
      extent: 65,
      covered: true,
      identities: [true, true, false],
      trailing: '160px',
      scrollTop: 0,
      scrollEvents: 0,
    });
    observations.growth = await read();
    await page.evaluate(() => window.virtualResize.settle());
    expect(await read()).toEqual(observations.growth);
    await page.evaluate(() => window.virtualResize.dispose());
    observations.disposed = await read();
    expect(observations.disposed).toMatchObject({
      keys: [],
      childCount: 0,
      extent: 0,
      scrollTop: 0,
      scrollEvents: 0,
    });
    expect(errors).toEqual([]);
    expect(unexpectedRequests).toEqual([]);
  } finally {
    try {
      observations.final = await read().catch(() => null);
      observations.errors = errors;
      observations.unexpectedRequests = unexpectedRequests;
      await writeFile(
        path.join(evidenceDir, 'observations.json'),
        JSON.stringify(observations, null, 2)
      );
    } finally {
      await context.close();
    }
  }
}, 30_000);
