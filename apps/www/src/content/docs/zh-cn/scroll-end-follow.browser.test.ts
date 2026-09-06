// @vitest-environment node

import fs from 'node:fs';
import { createServer, type Server } from 'node:http';
import path from 'node:path';
import { build, type Plugin } from 'esbuild';
import type { Browser } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser } from './browser-harness';

let browser: Browser;
let server: Server;
let baseUrl = '';

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
  const source = path.resolve(process.cwd(), 'packages', subdir, 'src', ...rest);
  for (const candidate of [path.join(source, 'index.ts'), `${source}.ts`, `${source}.tsx`]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

const protoUiSourcePlugin: Plugin = {
  name: 'proto-ui-source',
  setup(bundle) {
    bundle.onResolve({ filter: /^@proto\.ui\// }, (args) => {
      const resolved = resolveProtoUiImport(args.path);
      return resolved ? { path: resolved } : null;
    });
  },
};

const probeSource = `
  import { definePrototype } from './packages/core/src/index.ts';
  import { asScrollSurface } from './packages/hooks/src/index.ts';
  import { AdaptToWebComponent } from './packages/adapters/web-component/src/index.ts';

  let surface;
  let viewport;
  let focusOwner;
  const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
  const appendRows = (count) => {
    for (let index = 0; index < count; index += 1) {
      const row = document.createElement('div');
      row.textContent = 'Log row ' + (viewport.children.length + 1);
      row.style.height = '24px';
      viewport.append(row);
    }
  };
  const read = () => ({
    maximum: viewport.scrollHeight - viewport.clientHeight,
    top: viewport.scrollTop,
    followState: surface.endFollow.state.get(),
    requestStatus: surface.endFollow.requestStatus.get(),
    atEnd: surface.vertical.atEnd.get(),
    focusPreserved: document.activeElement === focusOwner,
    scrollBehavior: viewport.style.scrollBehavior,
  });

  globalThis.setupScrollEndFollowProbe = async () => {
    const proto = definePrototype({
      name: 'scroll-end-follow-browser-probe',
      setup() {
        surface = asScrollSurface();
        surface.configure({
          axes: 'vertical',
          projection: 'system',
          endFollow: { mode: 'while-at-end', axis: 'vertical' },
        });
        return (renderer) => renderer.slot();
      },
    });
    const Ctor = AdaptToWebComponent(proto, {
      register: false,
      registerAs: 'scroll-end-follow-browser-probe',
    });
    if (!customElements.get('scroll-end-follow-browser-probe')) {
      customElements.define('scroll-end-follow-browser-probe', Ctor);
    }

    focusOwner = document.createElement('button');
    focusOwner.textContent = 'Stable focus owner';
    viewport = document.createElement('scroll-end-follow-browser-probe');
    viewport.style.display = 'block';
    viewport.style.width = '240px';
    viewport.style.height = '120px';
    viewport.style.overflow = 'auto';
    appendRows(20);
    document.body.replaceChildren(focusOwner, viewport);
    focusOwner.focus();
    await frame();
    await frame();
    return read();
  };
  globalThis.readScrollEndFollowProbe = read;
  globalThis.appendScrollEndFollowRows = async (count) => {
    appendRows(count);
    await frame();
    await frame();
    return read();
  };
  globalThis.jumpScrollEndFollowToEnd = async () => {
    surface.request({ kind: 'to-end', axis: 'vertical' });
    await frame();
    await frame();
    return read();
  };
`;

beforeAll(async () => {
  const bundled = await build({
    stdin: {
      contents: probeSource,
      resolveDir: process.cwd(),
      sourcefile: 'scroll-end-follow-browser-probe.ts',
      loader: 'ts',
    },
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    write: false,
    plugins: [protoUiSourcePlugin],
    define: { 'process.env.NODE_ENV': JSON.stringify('test') },
  });
  const browserBundle = bundled.outputFiles[0].text;
  server = createServer((request, response) => {
    if (request.url === '/probe.js') {
      response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      response.end(browserBundle);
      return;
    }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end('<!doctype html><html><body><script src="/probe.js"></script></body></html>');
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Browser probe server has no port.');
  baseUrl = `http://127.0.0.1:${address.port}`;
  browser = await launchBrowser();
}, 180_000);

afterAll(async () => {
  await browser?.close();
  if (!server) return;
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('Scroll end-follow / real Chromium', () => {
  it('follows rapid appends only at end and resumes after trusted reader input', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForFunction(
      () => typeof (globalThis as any).setupScrollEndFollowProbe === 'function'
    );
    const initial = await page.evaluate(() => (globalThis as any).setupScrollEndFollowProbe());

    expect(initial.maximum).toBeGreaterThan(0);
    expect(initial.top).toBe(initial.maximum);
    const viewport = page.locator('scroll-end-follow-browser-probe');
    await viewport.hover();
    await page.mouse.wheel(0, -96);
    await page.waitForFunction(() => {
      const target = document.querySelector<HTMLElement>('scroll-end-follow-browser-probe');
      return !!target && target.scrollTop < target.scrollHeight - target.clientHeight;
    });
    const away = await page.evaluate(() => (globalThis as any).readScrollEndFollowProbe());

    expect(away.top).toBeLessThan(initial.top);
    expect(away.followState).toBe('paused');
    const afterAwayAppend = await page.evaluate(() =>
      (globalThis as any).appendScrollEndFollowRows(8)
    );
    expect(afterAwayAppend.top).toBe(away.top);

    const resumed = await page.evaluate(() => (globalThis as any).jumpScrollEndFollowToEnd());
    expect(resumed.top).toBe(resumed.maximum);
    const streamed = await page.evaluate(() => (globalThis as any).appendScrollEndFollowRows(12));
    expect(streamed.top).toBe(streamed.maximum);
    expect(streamed.followState).toBe('following');
    expect(streamed.requestStatus).toBe('applied');
    expect(streamed.atEnd).toBe(true);
    expect(streamed.focusPreserved).toBe(true);
    expect(streamed.scrollBehavior).not.toBe('smooth');
    await context.close();
  }, 120_000);
});
