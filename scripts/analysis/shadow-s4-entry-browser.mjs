/** Bounded S4 entrance investigation, not a passing conformance/repair claim.
 * Reuse a running www server. Defaults: visible independent Chrome, split, 12 paths.
 * S4_ENTRY_MANUAL=1 allows 180s of manual open/outside-close/Switch interaction.
 * Keep viewport, theme, tab and content unchanged: the paint band is calibrated once.
 * S4_ENTRY_PROBE=1 intentionally injects a 95% rollback to validate capture.
 * S4_ENTRY_EXPERIMENT=explicit|layer applies a page-local candidate, never a product fix.
 * S4_ENTRY_IDLE=1 skips the automatic post-click hover; SETTLE_MS/CLICK_DELAY tune input.
 * No every-frame layout reads, product source changes, or user browser-profile changes.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEntryRollbackDetector, readEntryPaintBand } from './shadow-s4-entry-detector.mjs';

const require = createRequire(new URL('../../apps/www/package.json', import.meta.url));
const { chromium } = require('playwright-core');
const sharp = require('sharp');
const manual = process.env.S4_ENTRY_MANUAL === '1';
const idle = process.env.S4_ENTRY_IDLE === '1';
const settle = Number(process.env.S4_ENTRY_SETTLE_MS ?? 0);
const clickDelay = Number(process.env.S4_ENTRY_CLICK_DELAY ?? 0);
const experiment = process.env.S4_ENTRY_EXPERIMENT ?? 'none';
assert.ok(['none', 'explicit', 'layer'].includes(experiment));
assert.ok(Number.isInteger(settle) && settle >= 0 && settle <= 10_000);
assert.ok(Number.isInteger(clickDelay) && clickDelay >= 0 && clickDelay <= 1000);
const probe = process.env.S4_ENTRY_PROBE === '1';
const profile = process.env.S4_ENTRY_PROFILE ?? 'split';
assert.ok(['light', 'split', 'mixed'].includes(profile));
assert.ok(!probe || profile !== 'light', 'the synthetic probe targets split geometry');
assert.ok(experiment === 'none' || profile !== 'light', 'experiments target split geometry');
const rounds = Number(process.env.S4_ENTRY_ROUNDS ?? 12);
assert.ok(Number.isInteger(rounds) && rounds > 0 && rounds <= 120);
const output = await mkdtemp(join(tmpdir(), 's4-entry-'));
const browser = await chromium.launch({
  headless: process.env.S4_ENTRY_HEADLESS === '1',
  handleSIGINT: false,
  executablePath:
    process.env.PUI_CHROME_EXECUTABLE ??
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
let interrupted = false;
const interrupt = () => {
  interrupted = true;
};
process.on('SIGINT', interrupt);
try {
  const viewport = { width: 742, height: 1000 };
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2, colorScheme: 'light' });
  let pageClosed = false;
  page.on('close', () => {
    pageClosed = true;
    interrupted = true;
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(
    `${process.env.PROTO_UI_BROWSER_BASE_URL ?? 'http://127.0.0.1:4321'}/zh-cn/internal/demo-matrix/#shadow-split-s4`
  );
  await page.locator('[data-shadow-s4][data-ready=true]').waitFor();
  const part = (key) => page.locator(`[data-s4-profile=${profile}][data-s4-part=${key}]`);
  await part('trigger').click();
  await page.waitForTimeout(400);
  const control = (key) => part('content').locator(`[data-s3-component=${key}]`);
  for (const key of ['switch', 'checkbox']) {
    if (((await control(key).getAttribute('aria-checked')) === 'true') !== (key === 'checkbox'))
      await control(key).click();
  }
  await page.waitForTimeout(300);
  const box = await part('content').boundingBox();
  const sw = await control('switch').boundingBox();
  assert.ok(box && sw);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(450);
  await part('trigger').scrollIntoViewIfNeeded();
  const trigger = await part('trigger').boundingBox();
  assert.ok(trigger);
  const point = {
    x: trigger.x + Math.min(30, trigger.width / 2),
    y: trigger.y + trigger.height / 2,
  };
  const experimentReceipt =
    experiment === 'none'
      ? null
      : await page.evaluate(
          ({ profile, experiment }) => {
            const c = document.querySelector(`[data-s4-profile=${profile}][data-s4-part=content]`);
            if (experiment === 'layer') {
              c.style.willChange = 'transform';
              return { layer: true };
            }
            let count = 0;
            let keyframeText;
            const visit = (rules) => {
              for (const rule of rules) {
                if (
                  rule.name === 'pui-split-geometry-enter' &&
                  typeof rule.appendRule === 'function'
                ) {
                  keyframeText =
                    rule.cssText.slice(0, rule.cssText.lastIndexOf('}')) +
                    'to { transform: translate(var(--pui-translate-x, 0), var(--pui-translate-y, 0)) scale(var(--pui-scale-x, 1), var(--pui-scale-y, 1)); }}';
                  count++;
                } else if (rule.cssRules) visit(rule.cssRules);
              }
            };
            for (const sheet of c.shadowRoot.styleSheets) visit(sheet.cssRules);
            if (count !== 1)
              throw new Error(`Expected exactly one geometry keyframe, found ${count}`);
            // CSSOM-only edits disappear when portal relocation reparses <style>.
            // A separate, unlayered test override survives that move and wins over
            // the generated layered keyframe without changing the owned artifact.
            const style = document.createElement('style');
            style.setAttribute('data-s4-entry-experiment', 'explicit');
            style.textContent = keyframeText;
            c.shadowRoot.append(style);
            return { persistentOverride: true, cssText: style.sheet.cssRules[0].cssText };
          },
          { profile, experiment }
        );
  const states = [];
  const streamedEvents = [];
  await page.exposeFunction('__s4EntryEvent', (event) => {
    streamedEvents.push(event);
    if (streamedEvents.length > 2048) streamedEvents.shift();
  });
  await page.exposeFunction('__s4EntryState', (state) => {
    states.push(state);
    if (states.length > 512) states.shift();
  });
  await page.evaluate(
    ({ profile, probe, experiment }) => {
      const c = document.querySelector(`[data-s4-profile=${profile}][data-s4-part=content]`);
      const events = [];
      let epoch = 0;
      let wasOpen = false;
      const log = (event) => {
        const entry = { time: Date.now(), ...event };
        events.push(entry);
        if (events.length > 2048) events.shift();
        void window.__s4EntryEvent(entry);
      };
      const readExperiment = () => {
        if (experiment === 'none') return { valid: true, experiment };
        if (experiment === 'layer')
          return {
            valid: c.style.willChange === 'transform',
            experiment,
            willChange: c.style.willChange,
          };
        const style = c.shadowRoot.querySelector('[data-s4-entry-experiment=explicit]');
        const rule = style?.sheet?.cssRules[0];
        return { experiment, valid: !!rule?.findRule('100%'), cssText: rule?.cssText ?? null };
      };
      let experimentInvalid = false;
      const publish = () => {
        const open = c.hasAttribute('data-open');
        if (open && !wasOpen) epoch++;
        wasOpen = open;
        const state = {
          time: Date.now(),
          open,
          detached: c.hasAttribute('data-pui-view-detached'),
          phase: c.getAttribute('data-transition-state'),
          epoch,
        };
        log({ kind: 'state', ...state });
        void window.__s4EntryState(state);
      };
      const observer = new MutationObserver(publish);
      observer.observe(c, {
        attributes: true,
        attributeFilter: [
          'data-open',
          'data-transition-state',
          'data-pui-view-detached',
          'data-pui-split-root-style',
          'data-pui-style',
          'style',
        ],
      });
      for (const root of [c, c.shadowRoot].filter(Boolean)) {
        for (const name of ['animationstart', 'animationend', 'animationcancel']) {
          root.addEventListener(name, (e) => {
            if (e.target !== c && !e.target.hasAttribute('data-pui-split-surface')) return;
            if (
              e.target === c &&
              name === 'animationstart' &&
              e.animationName.endsWith('geometry-enter')
            ) {
              const receipt = readExperiment();
              experimentInvalid ||= !receipt.valid;
              log({ kind: 'experiment-check', epoch, ...receipt });
            }
            log({
              kind: name,
              target: e.target === c ? 'boundary' : 'surface',
              animation: e.animationName,
              elapsed: e.elapsedTime,
            });
          });
        }
      }
      if (probe)
        c.addEventListener('animationend', (e) => {
          if (e.target !== c || !e.animationName.endsWith('geometry-enter')) return;
          setTimeout(() => {
            log({ kind: 'synthetic-probe-start' });
            c.style.setProperty('transform', 'translate(-50%, -50%) scale(.95)', 'important');
            setTimeout(() => {
              c.style.removeProperty('transform');
              log({ kind: 'synthetic-probe-end' });
            }, 300);
          }, 80);
        });
      window.__s4Entry = {
        events,
        content: c,
        readExperiment,
        get experimentInvalid() {
          return experimentInvalid;
        },
      };
      publish();
    },
    { profile, probe, experiment }
  );

  const cdp = await page.context().newCDPSession(page);
  const detector = createEntryRollbackDetector(box.width - 2);
  const frames = [];
  const samples = [];
  let pending = Promise.resolve();
  let candidate = null;
  let captureError = null;
  cdp.on('Page.screencastFrame', (e) => {
    void cdp.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(() => {});
    if (captureError) return;
    pending = pending
      .then(async () => {
        const frame = { time: e.metadata.timestamp * 1000, png: Buffer.from(e.data, 'base64') };
        frames.push(frame);
        if (frames.length > 96) frames.shift();
        if (candidate) return;
        const { data, info } = await sharp(frame.png)
          .removeAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        const width = readEntryPaintBand(data, info, box, viewport.width);
        const state = states.findLast((s) => s.time <= frame.time);
        const sample = { time: frame.time, width, state };
        samples.push(sample);
        if (samples.length > 4096) samples.shift();
        if (!detector.push(width, state)) return;
        candidate = { sample, snapshot: null, synthetic: probe };
        // This read is deliberately only after a painted anomaly, not on each frame.
        const snapshot = await page.evaluate(() => {
          const c = window.__s4Entry.content;
          const surface = c.shadowRoot?.querySelector('[data-pui-split-surface]');
          const read = (el) => {
            if (!el) return null;
            const css = getComputedStyle(el);
            return {
              transform: css.transform,
              opacity: css.opacity,
              rect: el.getBoundingClientRect().toJSON(),
              animations: el.getAnimations().map((a) => ({
                name: a.animationName,
                currentTime: a.currentTime,
                startTime: a.startTime,
                playState: a.playState,
                timing: a.effect.getComputedTiming(),
              })),
            };
          };
          return {
            observedAt: Date.now(),
            experiment: window.__s4Entry.readExperiment(),
            open: c.hasAttribute('data-open'),
            detached: c.hasAttribute('data-pui-view-detached'),
            phase: c.getAttribute('data-transition-state'),
            boundary: read(c),
            surface: read(surface),
            events: [...window.__s4Entry.events],
          };
        });
        candidate.snapshot = snapshot;
      })
      .catch((e) => {
        captureError = String(e);
      });
  });
  await cdp.send('Page.startScreencast', {
    format: 'png',
    maxWidth: viewport.width,
    maxHeight: viewport.height,
    everyNthFrame: 1,
  });
  console.log(
    JSON.stringify({
      output,
      profile,
      manual,
      idle,
      settle,
      clickDelay,
      experiment,
      experimentReceipt,
      syntheticProbe: probe,
      note: 'candidate capture is not a diagnosis; keep viewport/theme/tab/content unchanged',
    })
  );
  const deadline = Date.now() + 180_000;
  let completed = 0;
  try {
    if (manual) {
      console.log(
        'Use the new Chrome window for up to 180s. Ctrl-C saves and closes this diagnostic browser.'
      );
      while (!candidate && !captureError && !interrupted && Date.now() < deadline)
        await page.waitForTimeout(200);
    } else {
      for (
        let n = 0;
        n < rounds && !candidate && !captureError && !interrupted && Date.now() < deadline;
        n++
      ) {
        await page.waitForTimeout(settle);
        await page.mouse.click(point.x, point.y, { delay: clickDelay });
        await page.waitForTimeout(n % 2 ? 200 : 120);
        if (!idle)
          await page.mouse.move(sw.x + sw.width * 0.35, sw.y + sw.height * 0.5, { steps: 3 });
        await page.waitForTimeout(650);
        await pending;
        completed++;
        if (candidate || captureError) break;
        await page.mouse.click(point.x, point.y);
        await page.waitForTimeout(450);
        if (completed % 8 === 0) console.log({ completed });
      }
    }
    if (candidate) await page.waitForTimeout(450);
  } catch (e) {
    if (!page.isClosed() && browser.isConnected()) captureError ??= String(e);
    else interrupted = true;
  }
  try {
    await cdp.send('Page.stopScreencast');
  } catch (e) {
    if (!page.isClosed() && browser.isConnected()) captureError ??= String(e);
  }
  await pending;
  let events = streamedEvents;
  let eventsSource = 'streamed-partial';
  try {
    events = await page.evaluate(() => window.__s4Entry.events);
    eventsSource = 'page-final';
  } catch (e) {
    if (!page.isClosed() && browser.isConnected()) captureError ??= String(e);
  }
  if (events.some((e) => e.kind === 'experiment-check' && !e.valid))
    captureError ??= 'Experiment did not survive an entrance; this run is not valid A/B evidence';
  if (candidate) {
    for (const [i, frame] of frames.entries())
      await writeFile(join(output, `${String(i).padStart(3, '0')}.png`), frame.png);
  }
  const report = {
    status: captureError
      ? 'capture-error'
      : candidate
        ? 'candidate-captured'
        : interrupted
          ? 'interrupted'
          : 'not-observed',
    profile,
    manual,
    idle,
    settle,
    clickDelay,
    experiment,
    experimentReceipt,
    syntheticProbe: probe,
    completed,
    interrupted,
    pageClosed,
    eventsSource,
    viewport,
    box,
    candidate,
    captureError,
    errors,
    samples,
    states,
    events,
    frames: candidate
      ? frames.map((f, i) => ({ file: `${String(i).padStart(3, '0')}.png`, time: f.time }))
      : [],
  };
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, completed, output, syntheticProbe: probe }));
  if (captureError || errors.length || (probe && !candidate)) process.exitCode = 1;
} finally {
  process.removeListener('SIGINT', interrupt);
  await browser.close();
}
