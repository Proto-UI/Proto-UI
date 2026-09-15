import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(new URL('../../apps/www/package.json', import.meta.url));
const sharp = require('sharp');

// Test-only, layout-neutral slotted marker. Its saturated magenta cannot
// survive the Dialog fade. Inspect compositor output: polling computed style
// or geometry on each rAF masks the Chromium teardown flash.
async function markerPixels(png) {
  const { data, info } = await sharp(png)
    .resize({ width: 550 })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let count = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i] > 200 && data[i + 1] < 80 && data[i + 2] > 200) count++;
  }
  return count;
}

export async function runS4PaintJourney(
  page,
  {
    rounds = 2,
    profiles = ['light', 'split', 'mixed'],
    settings = ['default', 'switch', 'checkbox', 'both'],
    outputDir,
  } = {}
) {
  await page.locator('[data-shadow-s4][data-ready=true]').waitFor();
  const cdp = await page.context().newCDPSession(page);
  const frames = [],
    paths = [];
  let activePath = null;
  const onFrame = (event) => {
    if (activePath)
      frames.push({
        path: activePath,
        time: event.metadata.timestamp * 1000,
        png: Buffer.from(event.data, 'base64'),
      });
    void cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => {});
  };
  await page.evaluate(() => {
    window.__s4Paint = { events: [] };
    for (const content of document.querySelectorAll('[data-s4-part=content]')) {
      const marker = document.createElement('span');
      marker.dataset.s4PaintMarker = '';
      marker.setAttribute('aria-hidden', 'true');
      marker.style.cssText =
        'position:absolute;left:26px;top:26px;width:16px;height:16px;background:rgb(255,0,255);pointer-events:none';
      content.append(marker);
    }
    const observer = new MutationObserver((records) => {
      for (const r of records) {
        if (!r.target.matches?.('[data-s4-part=content]')) continue;
        __s4Paint.events.push({
          time: Date.now(),
          profile: r.target.dataset.s4Profile,
          detached: r.target.hasAttribute('data-pui-view-detached'),
          open: r.target.hasAttribute('data-open'),
        });
      }
    });
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-pui-view-detached'],
    });
    __s4Paint.observer = observer;
  });
  cdp.on('Page.screencastFrame', onFrame);
  await cdp.send('Page.startScreencast', {
    format: 'png',
    maxWidth: 1100,
    maxHeight: 900,
    everyNthFrame: 1,
  });
  try {
    for (const profile of profiles) {
      const part = (key) => page.locator(`[data-s4-profile=${profile}][data-s4-part=${key}]`);
      const control = (key) => part('content').locator(`[data-s3-component=${key}]`);
      for (const setting of settings) {
        await part('trigger').click();
        await page.waitForTimeout(350);
        for (const key of ['switch', 'checkbox']) {
          const checked = setting === 'both' || setting === key;
          if (((await control(key).getAttribute('aria-checked')) === 'true') !== checked)
            await control(key).click();
        }
        await page.waitForTimeout(250);
        for (let round = 0; round < rounds; round++) {
          if (round) {
            await part('trigger').click();
            await page.waitForTimeout(350);
          }
          for (const key of ['switch', 'checkbox'])
            assert.equal(
              await control(key).getAttribute('aria-checked'),
              String(setting === 'both' || setting === key),
              'retained Maker input'
            );
          assert.ok((await markerPixels(await page.screenshot())) >= 4, 'open Dialog paint marker');
          const path = `${profile}/${setting}/${round}`;
          const start = await page.evaluate(() => Date.now());
          paths.push({ path, profile, start });
          activePath = path;
          await part('close').click();
          // Entire exit, conceal, portal/style revocation, and following paints.
          // Deliberately do not read layout during this interval.
          await page.waitForTimeout(380);
          activePath = null;
          assert.equal(await part('content').getAttribute('data-pui-view-detached'), '');
          assert.equal(
            await page.locator(`[data-s4-card=${profile}]`).getAttribute('data-open'),
            'false'
          );
        }
      }
    }
    await cdp.send('Page.stopScreencast');
    const events = await page.evaluate(() => __s4Paint.events);
    const results = [],
      failures = [];
    for (const p of paths) {
      const samples = frames.filter((f) => f.path === p.path);
      assert.ok(samples.length >= 5, `${p.path}: insufficient actual paint frames`);
      let faded = false;
      const trace = [];
      for (let i = 0; i < samples.length; i++) {
        const sample = samples[i];
        const visible = (await markerPixels(sample.png)) >= 4;
        const event = events.filter((e) => e.profile === p.profile && e.time <= sample.time).at(-1);
        trace.push({
          time: sample.time - p.start,
          visible,
          detached: event?.detached,
          open: event?.open,
        });
        if (faded && visible) failures.push({ path: p.path, frame: i, ...trace.at(-1) });
        if (!visible) faded = true;
      }
      assert.ok(faded, `${p.path}: never observed completed fade`);
      results.push({ path: p.path, trace });
    }
    if (outputDir || failures.length) {
      outputDir ??= await mkdtemp(join(tmpdir(), 's4-paint-failure-'));
      await mkdir(outputDir, { recursive: true });
      await writeFile(
        join(outputDir, 'results.json'),
        JSON.stringify({ results, failures }, null, 2)
      );
      const failedPaths = new Set(failures.map((f) => f.path));
      for (let i = 0; i < frames.length; i++)
        if (failedPaths.has(frames[i].path))
          await writeFile(join(outputDir, `${i}.png`), frames[i].png);
    }
    assert.deepEqual(failures, [], `opaque paint returned after fade; evidence: ${outputDir}`);
    return { paths: results.length, frames: frames.length };
  } finally {
    cdp.off('Page.screencastFrame', onFrame);
    await cdp.detach();
    await page.evaluate(() => {
      window.__s4Paint?.observer.disconnect();
      document.querySelectorAll('[data-s4-paint-marker]').forEach((el) => el.remove());
      delete window.__s4Paint;
    });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = require('playwright-core');
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.PUI_CHROME_EXECUTABLE ??
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1100, height: 900 },
      colorScheme: 'light',
    });
    await page.goto(
      `${process.env.PROTO_UI_BROWSER_BASE_URL ?? 'http://127.0.0.1:4321'}/zh-cn/internal/demo-matrix/#shadow-split-s4`
    );
    console.log(await runS4PaintJourney(page, { outputDir: process.env.S4_PAINT_OUTPUT }));
  } finally {
    await browser.close();
  }
}
