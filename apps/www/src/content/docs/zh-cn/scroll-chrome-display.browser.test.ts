// @vitest-environment node
import { build } from 'esbuild';
import type { Browser } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser } from './browser-harness';

// The real Web host with native layout/cascade. The no-op Move host deliberately
// does not certify gestures; the Shadcn family browser journey covers real drag.
const probeSource = `
  import { createWebScrollSurfaceHost } from './packages/modules/scroll/src/web/create-web-scroll-host.ts';
  globalThis.setupChromeDisplayProbe = (inline = false) => {
    document.body.innerHTML = '<style>body{margin:40px;font:18px system-ui;background:#f5f4ef;color:#233338}.root{position:relative;width:260px;height:180px;border:2px solid #3d6265;background:white}.viewport{height:100%;width:100%}.row{height:30px;box-sizing:border-box;padding:3px 12px}.row:nth-child(even){background:#e6f0ed}.track{position:absolute;right:0;top:0;height:100%;width:26px;display:flex!important;background:#cf8068}.thumb{width:100%;display:block!important;background:#9e3a30}pre{font:16px monospace}</style><h2>Web Scroll host / system fallback</h2><p>Authored chrome must not paint over the native scrolling surface.</p><div class="root"><div class="viewport"></div><div class="track"><div class="thumb"></div></div></div><pre></pre>';
    const viewport = document.querySelector('.viewport');
    const track = document.querySelector('.track');
    const thumb = document.querySelector('.thumb');
    for (let i = 1; i <= 16; i++) { const row = document.createElement('div'); row.className = 'row'; row.textContent = 'Log row ' + i; viewport.append(row); }
    if (inline) { track.style.setProperty('display','flex','important'); thumb.style.setProperty('display','block','important'); }
    const connection = (projection, present = true) => ({ config:{axes:'vertical',projection:'composed'},projection,composedChrome:{scope:{},controls:present?[{getAxis:()=>'vertical',trackTarget:track,thumbTarget:thumb}]:[]},onFacts:()=>{} });
    const lease = createWebScrollSurfaceHost(viewport, { moveGestureHost:{ attach(){return {update(){},dispose(){}}} } }).attach(connection('system'));
    const inspect = (element) => ({ value:element.style.getPropertyValue('display'), priority:element.style.getPropertyPriority('display'), computed:getComputedStyle(element).display, rects:element.getClientRects().length });
    globalThis.chromeDisplayProbe = {
      read(){return { projection:viewport.dataset.puiScrollProjection, track:inspect(track),thumb:inspect(thumb), maximum:viewport.scrollHeight-viewport.clientHeight };},
      update(projection,present=true){lease.update(connection(projection,present));},
      dispose(){lease.dispose();},
      renderFacts(){document.querySelector('pre').textContent=JSON.stringify(this.read(),null,2);}
    };
    return chromeDisplayProbe.read();
  };
`;

let browser: Browser;
let bundle: string;
beforeAll(async () => {
  const output = await build({
    stdin: { contents: probeSource, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
  });
  bundle = output.outputFiles[0].text;
  browser = await launchBrowser();
});
afterAll(async () => {
  await browser?.close();
});

describe('Web Scroll chrome display / real Chromium cascade', () => {
  it.each([false, true])(
    'suppresses important author chrome and restores inline=%s exactly',
    async (inline) => {
      // D-SCROLL-PROJECTION-0001-B/D and HC-SCROLL-SURFACE-0001-F/G.
      const context = await browser.newContext();
      try {
        const page = await context.newPage();
        await page.setContent('<!doctype html><html><body></body></html>');
        await page.addScriptTag({ content: bundle });
        await page.evaluate((value) => (globalThis as any).setupChromeDisplayProbe(value), inline);
        const read = () => page.evaluate(() => (globalThis as any).chromeDisplayProbe.read());
        const hidden = await read();
        expect(hidden.maximum).toBeGreaterThan(0);
        for (const part of [hidden.track, hidden.thumb]) {
          expect(part).toMatchObject({
            value: 'none',
            priority: 'important',
            computed: 'none',
            rects: 0,
          });
        }
        // Observe real attribute delivery, not a fixed delay or inferred idle.
        const mutations = await page.evaluate(async () => {
          const records: MutationRecord[] = [];
          const observer = new MutationObserver((next) => records.push(...next));
          for (const part of document.querySelectorAll('.track,.thumb'))
            observer.observe(part, { attributes: true, attributeFilter: ['style'] });
          for (let i = 0; i < 3; i++) (globalThis as any).chromeDisplayProbe.update('system');
          await Promise.resolve();
          records.push(...observer.takeRecords());
          observer.disconnect();
          return records.length;
        });
        expect(mutations).toBe(0);
        await page.evaluate(() => (globalThis as any).chromeDisplayProbe.update('composed'));
        const composed = await read();
        expect(composed.track.computed).toBe('flex');
        expect(composed.thumb.computed).toBe('block');
        expect(composed.track.rects).toBeGreaterThan(0);
        expect(composed.thumb.rects).toBeGreaterThan(0);
        const expectedPriority = inline ? 'important' : '';
        expect(composed.track).toMatchObject({
          value: inline ? 'flex' : '',
          priority: expectedPriority,
        });
        expect(composed.thumb).toMatchObject({
          value: inline ? 'block' : '',
          priority: expectedPriority,
        });
        await page.evaluate(() => {
          (globalThis as any).chromeDisplayProbe.update('system');
          (globalThis as any).chromeDisplayProbe.update('system', false);
        });
        const removed = await read();
        expect(removed.track).toEqual(composed.track);
        expect(removed.thumb).toEqual(composed.thumb);
        await page.evaluate(() => {
          (globalThis as any).chromeDisplayProbe.update('system');
          (globalThis as any).chromeDisplayProbe.dispose();
        });
        const disposed = await read();
        expect(disposed.track).toEqual(composed.track);
        expect(disposed.thumb).toEqual(composed.thumb);
      } finally {
        await context.close();
      }
    }
  );
});
