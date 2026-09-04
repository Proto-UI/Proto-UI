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

  globalThis.runScrollEndFollowProbe = async () => {
    let surface;
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

    const focusOwner = document.createElement('button');
    focusOwner.textContent = 'Stable focus owner';
    const viewport = document.createElement('scroll-end-follow-browser-probe');
    viewport.style.display = 'block';
    viewport.style.width = '240px';
    viewport.style.height = '120px';
    viewport.style.overflow = 'auto';
    const appendRows = (count) => {
      for (let index = 0; index < count; index += 1) {
        const row = document.createElement('div');
        row.textContent = 'Log row ' + (viewport.children.length + 1);
        row.style.height = '24px';
        viewport.append(row);
      }
    };
    const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
    appendRows(20);
    document.body.replaceChildren(focusOwner, viewport);
    focusOwner.focus();
    await frame();
    await frame();

    const initialMaximum = viewport.scrollHeight - viewport.clientHeight;
    const initialTop = viewport.scrollTop;
    viewport.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: -80 }));
    viewport.scrollTop = Math.max(0, initialTop - 96);
    viewport.dispatchEvent(new Event('scroll'));
    await frame();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const awayTop = viewport.scrollTop;

    appendRows(8);
    await frame();
    await frame();
    const afterAwayAppend = viewport.scrollTop;

    surface.request({ kind: 'to-end', axis: 'vertical' });
    await frame();
    await frame();
    const resumedMaximum = viewport.scrollHeight - viewport.clientHeight;
    const resumedTop = viewport.scrollTop;

    appendRows(12);
    await frame();
    await frame();
    const streamedMaximum = viewport.scrollHeight - viewport.clientHeight;
    const streamedTop = viewport.scrollTop;

    return {
      initialMaximum,
      initialTop,
      awayTop,
      afterAwayAppend,
      resumedMaximum,
      resumedTop,
      streamedMaximum,
      streamedTop,
      followState: surface.endFollow.state.get(),
      requestStatus: surface.endFollow.requestStatus.get(),
      atEnd: surface.vertical.atEnd.get(),
      focusPreserved: document.activeElement === focusOwner,
      scrollBehavior: viewport.style.scrollBehavior,
    };
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
  it('follows rapid appends only at end and resumes explicitly without moving focus', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForFunction(
      () => typeof (globalThis as any).runScrollEndFollowProbe === 'function'
    );
    const result = await page.evaluate(() => (globalThis as any).runScrollEndFollowProbe());

    expect(result.initialMaximum).toBeGreaterThan(0);
    expect(result.initialTop).toBe(result.initialMaximum);
    expect(result.awayTop).toBeLessThan(result.initialTop);
    expect(result.afterAwayAppend).toBe(result.awayTop);
    expect(result.resumedTop).toBe(result.resumedMaximum);
    expect(result.streamedTop).toBe(result.streamedMaximum);
    expect(result.followState).toBe('following');
    expect(result.requestStatus).toBe('applied');
    expect(result.atEnd).toBe(true);
    expect(result.focusPreserved).toBe(true);
    expect(result.scrollBehavior).not.toBe('smooth');
    await context.close();
  }, 120_000);
});
