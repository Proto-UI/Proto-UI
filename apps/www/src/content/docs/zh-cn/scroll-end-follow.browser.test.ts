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
  const inputEvents = [];
  const activeTouchIds = new Set();
  let offsetSource = 'native-input';
  const reentrant = { armed: false, projectionRequested: false, pendingRequested: false, appliedRequested: false };
  const requestOutcomes = [];
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
    ...reentrant,
    requestOutcomes: requestOutcomes.slice(),
  });

  globalThis.setupScrollEndFollowProbe = async (mode = 'default') => {
    const proto = definePrototype({
      name: 'scroll-end-follow-browser-probe',
      setup() {
        surface = asScrollSurface();
        surface.configure({
          axes: 'vertical',
          projection: 'system',
          endFollow: mode === 'projection' ? { mode: 'off' } : { mode: 'while-at-end', axis: 'vertical' },
        });
        surface.projection.watch((_run, event) => {
          if (mode !== 'projection' || event.type !== 'next' || event.next !== 'system' || reentrant.projectionRequested) return;
          reentrant.projectionRequested = true;
          surface.request({ kind: 'to-end', axis: 'vertical' });
        });
        surface.endFollow.state.watch((_run, event) => {
          if (!reentrant.armed || event.type !== 'next' || event.next !== 'pending' || reentrant.pendingRequested) return;
          reentrant.pendingRequested = true;
          surface.request({ kind: 'to-end', axis: 'vertical' });
        });
        surface.endFollow.requestStatus.watch((_run, event) => {
          if (event.type !== 'next') return;
          requestOutcomes.push(event.next);
          if (!reentrant.armed || event.next !== 'applied' || reentrant.appliedRequested) return;
          reentrant.appliedRequested = true;
          surface.request({ kind: 'to-end', axis: 'vertical' });
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
    for (const type of [
      'touchstart', 'touchmove', 'touchend', 'touchcancel',
      'pointerdown', 'pointerup', 'pointercancel', 'scroll',
    ]) {
      viewport.addEventListener(type, (event) => {
        if (event.type === 'touchstart') {
          for (const touch of event.changedTouches) activeTouchIds.add(touch.identifier);
        } else if (event.type === 'touchend' || event.type === 'touchcancel') {
          for (const touch of event.changedTouches) activeTouchIds.delete(touch.identifier);
        }
        inputEvents.push({
          type: event.type,
          isTrusted: event.isTrusted,
          activeTouchIds: Array.from(activeTouchIds),
          changedTouchIds: Array.from(event.changedTouches ?? [], (touch) => touch.identifier),
          pointerType: event.pointerType,
          top: viewport.scrollTop,
          maximum: viewport.scrollHeight - viewport.clientHeight,
          offsetSource,
        });
      }, { passive: true });
    }
    appendRows(20);
    document.body.replaceChildren(focusOwner, viewport);
    focusOwner.focus();
    await frame();
    await frame();
    return read();
  };
  globalThis.readScrollEndFollowProbe = read;
  globalThis.armReentrantScrollEndFollow = () => { reentrant.armed = true; };
  globalThis.readScrollEndFollowInputEvents = () => inputEvents.slice();
  globalThis.setScrollEndFollowOffsetForTest = async (top) => {
    const scrollEvent = new Promise((resolve) => {
      viewport.addEventListener('scroll', (event) => resolve(event.isTrusted), { once: true });
    });
    // This offset is deliberately test-driven. Chromium still emits the real
    // scroll event consumed by the Web host; it is not represented as a pan.
    offsetSource = 'test-driven-scrollTop';
    viewport.scrollTop = top;
    const scrollEventTrusted = await scrollEvent;
    await frame();
    return { ...read(), offsetSource: 'test-driven-scrollTop', scrollEventTrusted };
  };
  globalThis.armScrollEndFollowOffsetAfterTouchCancelForTest = (top) => {
    globalThis.scrollEndFollowOffsetAfterTouchCancel = new Promise((resolve) => {
      // Registered after mount: the host's window listener terminates its
      // contact session first, then this listener changes the offset immediately.
      window.addEventListener('touchcancel', () => {
        resolve(globalThis.setScrollEndFollowOffsetForTest(top));
      }, { once: true });
    });
  };
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

type ProbeInputEvent = {
  type: string;
  isTrusted: boolean;
  activeTouchIds: number[];
  changedTouchIds: number[];
  pointerType?: string;
  top: number;
  maximum: number;
  offsetSource: string;
};

async function openTouchProbe() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    const initial = await page.evaluate(() => (globalThis as any).setupScrollEndFollowProbe());
    expect(initial.maximum).toBeGreaterThan(0);
    expect(initial.top).toBe(initial.maximum);
    const box = await page.locator('scroll-end-follow-browser-probe').boundingBox();
    if (!box) throw new Error('Scroll end-follow probe has no Chromium layout box.');
    const cdp = await context.newCDPSession(page);
    const point = { x: Math.floor(box.x + box.width / 2), y: Math.floor(box.y + 16), id: 11 };
    const readEvents = () =>
      page.evaluate(
        () => (globalThis as any).readScrollEndFollowInputEvents() as ProbeInputEvent[]
      );
    return { context, page, cdp, initial, point, readEvents };
  } catch (error) {
    await context.close();
    throw error;
  }
}

describe('Scroll end-follow / real Chromium', () => {
  it('realigns offset-only reflow during a stationary trusted touch without pausing', async () => {
    // C-SCROLL-END-FOLLOW-0001-INTERRUPT/REFLOW. The offset write represents
    // unclassified host reflow, not native user pan; touch input is trusted CDP.
    const { context, page, cdp, initial, point, readEvents } = await openTouchProbe();
    try {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
      const displaced = await page.evaluate(
        (top) => (globalThis as any).setScrollEndFollowOffsetForTest(top),
        initial.maximum - 96
      );
      expect(displaced).toMatchObject({
        top: initial.maximum - 96,
        maximum: initial.maximum,
        followState: 'following',
        offsetSource: 'test-driven-scrollTop',
        scrollEventTrusted: true,
      });
      const events = await readEvents();
      expect(events.some((event) => event.type === 'touchstart' && event.isTrusted)).toBe(true);
      expect(events.some((event) => event.type === 'touchmove')).toBe(false);
      const appended = await page.evaluate(() => (globalThis as any).appendScrollEndFollowRows(4));
      expect(appended.top).toBe(appended.maximum);
      expect(appended.followState).toBe('following');
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } finally {
      await context.close();
    }
  }, 120_000);

  it.each(['projection', 'reentrant'])(
    'settles public %s watcher requests against the current movement',
    async (mode) => {
      // C-SCROLL-END-FOLLOW-0001-RESUME/FACTS: observable requests retain causality.
      const context = await browser.newContext();
      try {
        const page = await context.newPage();
        await page.goto(baseUrl, { waitUntil: 'networkidle' });
        await page.waitForFunction(
          () => typeof (globalThis as any).setupScrollEndFollowProbe === 'function'
        );
        const initial = await page.evaluate(
          (mode) => (globalThis as any).setupScrollEndFollowProbe(mode),
          mode
        );
        expect(initial.requestStatus).toBe('applied');
        if (mode === 'reentrant') {
          await page.evaluate(() => (globalThis as any).armReentrantScrollEndFollow());
          await page.evaluate(() => (globalThis as any).appendScrollEndFollowRows(4));
        }
        await page.waitForFunction(() => {
          const state = (globalThis as any).readScrollEndFollowProbe();
          return (
            state.requestStatus === 'applied' &&
            (!state.armed || (state.pendingRequested && state.appliedRequested))
          );
        });
        const result = await page.evaluate(() => (globalThis as any).readScrollEndFollowProbe());
        expect(result.top).toBe(result.maximum);
        expect(result.requestOutcomes).not.toContain('rejected');
        if (mode === 'projection') {
          expect(result.projectionRequested).toBe(true);
          expect(result.followState).toBe('off');
        } else {
          expect(result.pendingRequested && result.appliedRequested).toBe(true);
          expect(result.followState).toBe('following');
        }
      } finally {
        await context.close();
      }
    },
    120_000
  );

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

  it('preserves native touch departure after pointercancel while the owned touch remains active', async () => {
    const { context, page, cdp, initial, point, readEvents } = await openTouchProbe();
    try {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
      // Downward finger motion moves the viewport away from its logical end.
      // All movement here is Chromium's native pan: no offset writes or DOM dispatchEvent.
      for (const distance of [24, 48, 72, 96]) {
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ ...point, y: point.y + distance }],
        });
      }
      await page.waitForFunction(() => {
        const events = (globalThis as any).readScrollEndFollowInputEvents() as ProbeInputEvent[];
        return events.some((event) => event.type === 'scroll' && event.top < event.maximum);
      });
      const events = await readEvents();
      const start = events.find((event) => event.type === 'touchstart');
      expect(start?.isTrusted).toBe(true);
      expect(start?.changedTouchIds).toHaveLength(1);
      const pointerCancelIndex = events.findIndex((event) => event.type === 'pointercancel');
      expect(pointerCancelIndex).toBeGreaterThan(-1);
      expect(events[pointerCancelIndex]).toMatchObject({
        isTrusted: true,
        pointerType: 'touch',
        activeTouchIds: start?.changedTouchIds,
      });
      expect(events.some((event) => event.type === 'touchmove' && event.isTrusted)).toBe(true);
      expect(
        events.some((event) => event.type === 'touchend' || event.type === 'touchcancel')
      ).toBe(false);
      const nativeDeparture = events
        .slice(pointerCancelIndex + 1)
        .find((event) => event.type === 'scroll' && event.top < event.maximum);
      expect(nativeDeparture).toMatchObject({
        isTrusted: true,
        activeTouchIds: start?.changedTouchIds,
        offsetSource: 'native-input',
      });
      const away = await page.evaluate(() => (globalThis as any).readScrollEndFollowProbe());
      expect(away.top).toBeLessThan(initial.maximum);
      expect(away.followState).toBe('paused');
      // Keep the finger down while appending, so touch-end fling cannot obscure
      // whether automatic following has pulled the reader back toward the end.
      const appended = await page.evaluate(() => (globalThis as any).appendScrollEndFollowRows(4));
      expect(appended.top).toBeLessThanOrEqual(away.top);
      expect(appended.followState).toBe('paused');
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } finally {
      await context.close();
    }
  }, 120_000);

  it('ends an unmoved touchcancel session before an immediate test-driven offset change', async () => {
    const { context, page, cdp, initial, point, readEvents } = await openTouchProbe();
    try {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
      await page.evaluate(
        (top) => (globalThis as any).armScrollEndFollowOffsetAfterTouchCancelForTest(top),
        initial.maximum - 96
      );
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      const immediate = await page.evaluate(
        () => (globalThis as any).scrollEndFollowOffsetAfterTouchCancel
      );
      const events = await readEvents();
      const start = events.find((event) => event.type === 'touchstart');
      expect(start?.isTrusted).toBe(true);
      expect(start?.changedTouchIds).toHaveLength(1);
      const cancel = events.find((event) => event.type === 'touchcancel');
      expect(cancel).toMatchObject({
        isTrusted: true,
        activeTouchIds: [],
        changedTouchIds: start?.changedTouchIds,
        top: initial.maximum,
        offsetSource: 'native-input',
      });
      expect(events.some((event) => event.type === 'touchmove')).toBe(false);
      expect(immediate).toMatchObject({
        top: initial.maximum - 96,
        offsetSource: 'test-driven-scrollTop',
        scrollEventTrusted: true,
        followState: 'following',
      });
      const appended = await page.evaluate(() => (globalThis as any).appendScrollEndFollowRows(4));
      expect(appended.top).toBe(appended.maximum);
      expect(appended.followState).toBe('following');
    } finally {
      await context.close();
    }
  }, 120_000);
});
