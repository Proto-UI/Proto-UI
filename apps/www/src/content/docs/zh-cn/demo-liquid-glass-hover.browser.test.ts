// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Browser, type CDPSession, type Locator, type Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { observeLiquidToggleSnapshot } from './liquid-toggle-snapshot';
import { collectLiquidMaterialObservation } from './liquid-material-observation';
import { isUnpaintedBootstrapBoxShadow } from './bootstrap-disabled-paint';
import {
  LIQUID_HOVER_PARTS,
  LIQUID_HOVER_NEGATIVES,
  liquidHoverContextCapture,
} from './liquid-hover-fixture';
import {
  observeLiquidHoverIdle,
  captureLiquidHoverClips,
  type LiquidHoverFramingEvidence,
} from './liquid-hover-capture';
import { RUNTIMES, chromeExecutable, startServer, stopServer } from './browser-harness';
import {
  LiquidHoverCheckpoint,
  liquidHoverCaseId,
  planLiquidHoverEvidence,
  selectLiquidHoverRuntimes,
  writeLiquidHoverJsonAtomic,
} from '../../../../test/helpers/liquid-hover-plan';

// C/T-LIQUID-GLASS-COMMAND-INTERACTION-0001. This adds evidence, never replaces
// or relaxes the existing thirteen Toggle scenarios or structured-detail gates.
// Eight-part source includes the separately reviewed Form CLI borrowed-state prerequisite.
const route = '/en/test/liquid-glass-hover/';
const evidenceRoot = process.env.PROTO_UI_MATERIAL_EVIDENCE_DIR;
const output = evidenceRoot ? path.join(evidenceRoot, 'hover') : undefined;
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const source = {
  sourceSha,
  candidateSha: process.env.CANDIDATE_SHA,
  runId: process.env.GITHUB_RUN_ID,
  runAttempt: process.env.GITHUB_RUN_ATTEMPT,
  job: process.env.GITHUB_JOB,
  sourceTree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim(),
  patchSha256: createHash('sha256')
    .update(execFileSync('git', ['diff', '--binary', 'HEAD']))
    .digest('hex'),
};
const selectedRuntimes = selectLiquidHoverRuntimes(RUNTIMES, process.env.PROTO_UI_HOVER_RUNTIME);
const plan = planLiquidHoverEvidence(selectedRuntimes, source, route);
let checkpoint: LiquidHoverCheckpoint;
const safePreferences = {
  'prefers-reduced-motion': 'no-preference',
  'prefers-reduced-transparency': 'no-preference',
  'prefers-contrast': 'no-preference',
  'forced-colors': 'none',
};
let browser: Browser;
let baseUrl: string;
const results: unknown[] = [];

beforeAll(async () => {
  if (process.env.GITHUB_ACTIONS !== 'true' || !process.env.CANDIDATE_SHA || !output)
    throw new Error('Hover native browser evidence requires official exact-head GitHub Actions');
  // This immutable source-bound inventory and the initial checkpoint exist even
  // if exact-head checks, server startup or browser launch subsequently fail.
  checkpoint = new LiquidHoverCheckpoint(plan, output);
  await checkpoint.initialize();
  await checkpoint.setup(async () => {
    expect(sourceSha).toBe(process.env.CANDIDATE_SHA);
    expect(execFileSync('git', ['diff', '--binary', 'HEAD']).length).toBe(0);
    expect(
      execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
        encoding: 'utf8',
      }).trim()
    ).toBe('');
    if (process.env.PROTO_UI_BROWSER_BASE_URL) throw new Error('Use this job own loopback server');
    await mkdir(output, { recursive: true });
    await writeLiquidHoverJsonAtomic(path.join(output, 'source.json'), {
      ...source,
      runtimes: selectedRuntimes,
      plan: 'plan.json',
      progress: 'progress.json',
      status: 'Planned; Vitest terminal outcome is authoritative',
    });
    baseUrl = await startServer(route);
    browser = await chromium.launch({
      executablePath: await chromeExecutable(),
      headless: true,
      chromiumSandbox: true,
      args: ['--disable-dev-shm-usage'],
    });
  });
}, 150_000);

afterAll(async () => {
  try {
    if (output)
      await writeLiquidHoverJsonAtomic(path.join(output, 'results.json'), {
        ...source,
        route,
        browser: browser?.version(),
        node: process.version,
        results,
        runtimes: selectedRuntimes,
        plan: 'plan.json',
        progress: 'progress.json',
        scope:
          'Real selected Web runtime roots (four-runtime full matrix union) and first-party visible-canvas provider. Native mouse/keyboard/touch journeys plus explicitly labeled injected cancellation probes. No Apple, GPUI, packed or full Compiler equivalence; no local browser acceptance.',
      });
  } finally {
    try {
      await browser?.close();
    } finally {
      await stopServer();
    }
  }
}, 60_000);

async function preferences(cdp: CDPSession, theme: string, extra: Record<string, string> = {}) {
  await cdp.send('Emulation.setEmulatedMedia', {
    features: Object.entries({ ...safePreferences, 'prefers-color-scheme': theme, ...extra }).map(
      ([name, value]) => ({ name, value })
    ),
  });
}
async function newPage(runtime: string, theme: string) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    hasTouch: true,
  });
  await context.route('**/*', (request) =>
    new URL(request.request().url()).origin === new URL(baseUrl).origin
      ? request.continue()
      : request.abort()
  );
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const cdp = await context.newCDPSession(page);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  try {
    await preferences(cdp, theme);
    await page.goto(`${baseUrl}${route}?runtime=${runtime}&theme=${theme}`, {
      waitUntil: 'networkidle',
    });
    await page.waitForFunction(
      () => document.documentElement.dataset.liquidHoverReady === 'true',
      undefined,
      { timeout: 60_000 }
    );
    await page.evaluate(() => (window as any).liquidHoverFixture.pause(true));
    return { context, page, cdp };
  } catch (error) {
    const failure = errorText(error);
    const record = {
      ...source,
      runtime,
      theme,
      scenario: 'fixture-setup',
      failure,
      pageErrors,
      fixtureError: await page
        .evaluate(() => document.documentElement.dataset.liquidHoverError)
        .catch(() => undefined),
    };
    results.push(record);
    if (output) {
      const name = `${runtime}-${theme}-fixture-setup-failure`;
      await page
        .screenshot({ path: path.join(output, `${name}.png`), fullPage: true })
        .catch(() => {});
      await writeFile(path.join(output, `${name}.json`), JSON.stringify(record, null, 2));
    }
    await context.close();
    throw error;
  }
}
async function fixture(
  page: Page,
  runtime: string,
  part: string,
  operation: string,
  ...args: unknown[]
) {
  return page.evaluate(
    ({ runtime, part, operation, args }) =>
      (window as any).liquidHoverFixture[operation](runtime, part, ...args),
    { runtime, part, operation, args }
  );
}
const subject = (page: Page, runtime: string, part: string) =>
  page.locator(`[data-hover-host="${runtime}-${part}"] [data-demo-ref="subject"]`);
const entry = (page: Page, runtime: string, part: string) =>
  page.locator(`[data-focus-start="${runtime}-${part}"]`);
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const errorText = (error: unknown) =>
  error instanceof Error ? (error.stack ?? error.message) : String(error);

/** Readiness waits are observational, not acceptance assertions. On any wait or
 * decode failure capture() still writes the actual root PNG and raw receipt. */
async function settle(
  page: Page,
  target: Locator,
  quality?: string,
  contact?: string,
  timeout = 8000
) {
  // Viewport setup belongs only to explicit neutral boundaries below.
  // Active hover/press/focus captures never reposition their subject here.
  if (quality || contact)
    await page.waitForFunction(
      ({ selector, quality, contact }) => {
        const node = document.querySelector<HTMLElement>(selector);
        return (
          !!node &&
          (!quality || node.dataset.materialQuality === quality) &&
          (!contact || node.dataset.materialContact === contact)
        );
      },
      {
        selector: await target.evaluate(
          (el) =>
            `[data-hover-host="${el.closest('[data-hover-host]')!.getAttribute('data-hover-host')}"] [data-demo-ref="subject"]`
        ),
        quality,
        contact,
      },
      { timeout }
    );
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
}
const idleFramingBoundaries = new Set([
  'idle',
  'policy-idle',
  'negative-idle',
  'collapse-blocked',
  'reenabled-subject',
  'reenabled-item',
  'reenabled-owner',
]);
const observedStateNames = [
  'hovered',
  'pressed',
  'focusVisible',
  'focused',
  'disabled',
  'active',
  'collapseBlocked',
] as const;
async function observedStates(page: Page, runtime: string, part: string) {
  return Object.fromEntries(
    await Promise.all(
      observedStateNames.map(async (name) => [
        name,
        await fixture(page, runtime, part, 'state', name),
      ])
    )
  );
}
async function readIdleFrame(_page: Page, target: Locator, runtime: string, part: string) {
  // Decode first: that await can outlive a native scroll or input transition.
  // The final live frame must not reuse geometry / eligibility from before it.
  const receipt = await target.evaluate(observeLiquidToggleSnapshot);
  return target.evaluate(
    (el, { runtime, part, stateNames, paintOutset }) => {
      const box = el.getBoundingClientRect();
      const fixture = (window as any).liquidHoverFixture;
      // These fixture getters are synchronous. Geometry, Base state, requests
      // and current DOM material eligibility belong to the same browser task.
      return {
        subject: { x: box.x, y: box.y, width: box.width, height: box.height },
        viewport: { width: innerWidth, height: innerHeight },
        scroll: { x: scrollX, y: scrollY },
        states: Object.fromEntries(
          stateNames.map((name) => [name, fixture.state(runtime, part, name)])
        ),
        requests: fixture.requests(runtime, part),
        material: {
          quality: el.getAttribute('data-material-quality'),
          contact: el.getAttribute('data-material-contact'),
          carrier: el.getAttribute('data-pui-material-carrier'),
          paintOutset,
        },
      };
    },
    { runtime, part, stateNames: observedStateNames, paintOutset: receipt.paint.paintOutset }
  );
}
async function observeIdleFrame(
  page: Page,
  target: Locator,
  runtime: string,
  part: string,
  evidence: LiquidHoverFramingEvidence,
  readiness?: { quality?: string; contact?: string }
) {
  return observeLiquidHoverIdle(
    {
      readFrame: () => readIdleFrame(page, target, runtime, part),
      scrollIntoView: () => target.scrollIntoViewIfNeeded(),
      scrollBy: (delta) =>
        page.evaluate(
          ({ x, y }) => window.scrollBy({ left: x, top: y, behavior: 'instant' }),
          delta
        ),
      settleFrames: () =>
        page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
            )
        ),
      settleMaterial: (remaining) =>
        settle(page, target, readiness?.quality, readiness?.contact, remaining),
      observeMaterial: async () => {
        const value = await target.evaluate(observeLiquidToggleSnapshot);
        const host = value.paint.hostGeometry;
        return {
          value,
          geometry: { x: host.left, y: host.top, width: host.width, height: host.height },
          paintOutset: value.paint.paintOutset,
        };
      },
    },
    evidence
  );
}

async function capture(
  name: string,
  stage: string,
  page: Page,
  target: Locator,
  runtime: string,
  part: string,
  observations: unknown[],
  readiness?: { quality?: string; contact?: string }
) {
  let observationError: string | null = null;
  let facts: Awaited<ReturnType<typeof observeLiquidToggleSnapshot>> | null = null;
  const contextFraming: LiquidHoverFramingEvidence | undefined = idleFramingBoundaries.has(stage)
    ? { boundary: stage, actions: [] }
    : undefined;
  try {
    if (contextFraming)
      facts = await observeIdleFrame(page, target, runtime, part, contextFraming, readiness);
    else await settle(page, target, readiness?.quality, readiness?.contact);
  } catch (error) {
    observationError = errorText(error);
    if (contextFraming) contextFraming.failure = observationError;
  }
  // A readiness timeout must not suppress the actual current material PNG.
  try {
    if (!facts) facts = await target.evaluate(observeLiquidToggleSnapshot);
  } catch (error) {
    observationError = [observationError, errorText(error)].filter(Boolean).join('\n');
  }
  const raw = await target.evaluate((el) => {
    const css = getComputedStyle(el),
      box = el.getBoundingClientRect();
    const center = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return {
      attributes: Object.fromEntries(
        [...el.attributes].map((attr) => [
          attr.name,
          attr.name === 'style' ? '[see frozen paint receipt]' : attr.value,
        ])
      ),
      x: box.x,
      y: box.y,
      documentX: box.x + scrollX,
      documentY: box.y + scrollY,
      viewport: { width: innerWidth, height: innerHeight },
      scroll: { x: scrollX, y: scrollY },
      portalDestination: (() => {
        const scope = el.closest('[data-material-scene]');
        const destination = scope?.querySelector<HTMLElement>(
          ':scope > [data-material-overlay-mount]'
        );
        if (!destination) return null;
        const rect = destination.getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          gapBelowSubject: rect.top - box.bottom,
        };
      })(),
      width: box.width,
      height: box.height,
      transform: css.transform,
      translate: css.translate,
      scale: css.scale,
      hitContainsCenter: center === el || (!!center && el.contains(center)),
      ring: Object.fromEntries(
        ['--pui-ring-width', '--pui-ring-inset', '--pui-ring-color', '--pui-ring-offset-width'].map(
          (name) => [name, css.getPropertyValue(name).trim()]
        )
      ),
      outline: { style: css.outlineStyle, width: css.outlineWidth, color: css.outlineColor },
      activeElement: document.activeElement === el,
      beforeContent: getComputedStyle(el, '::before').content,
      selectionMarker: (() => {
        const marker = el.querySelector<SVGElement>(
          'svg[aria-hidden="true"]:has(path[d="m13 4-7 8-3-3"])'
        );
        if (!marker) return null;
        const bounds = marker.getBoundingClientRect();
        return {
          opacity: getComputedStyle(marker).opacity,
          width: bounds.width,
          height: bounds.height,
          hidden: marker.getAttribute('aria-hidden'),
        };
      })(),
      slotText: el.querySelector('[data-liquid-hover-slot]')?.textContent,
    };
  });
  if (facts) {
    const frozenHost = facts.paint.hostGeometry;
    if (
      frozenHost.left !== raw.x ||
      frozenHost.top !== raw.y ||
      frozenHost.width !== raw.width ||
      frozenHost.height !== raw.height
    )
      observationError = [
        observationError,
        'Subject geometry changed after the frozen material observation',
      ]
        .filter(Boolean)
        .join('\n');
  }
  const states = await observedStates(page, runtime, part);
  const requests = await fixture(page, runtime, part, 'requests');
  let screenshotSha256: string | undefined;
  let contextScreenshotSha256: string | undefined;
  let contextGeometry: ReturnType<typeof liquidHoverContextCapture> | undefined;
  let screenshotGeometryChecks:
    | Awaited<ReturnType<typeof captureLiquidHoverClips>>['geometryChecks']
    | undefined;
  let screenshotClips:
    | { root: { clip?: unknown; errors: string[] }; context: { clip?: unknown; errors: string[] } }
    | undefined;
  let materialSha256: string | undefined;
  let screenshotError: string | null = null;
  if (output) {
    const clips = await captureLiquidHoverClips(
      {
        readGeometry: () =>
          target.evaluate((el) => {
            const box = el.getBoundingClientRect();
            return {
              subject: { x: box.x, y: box.y, width: box.width, height: box.height },
              viewport: { width: innerWidth, height: innerHeight },
              scroll: { x: scrollX, y: scrollY },
            };
          }),
        // Page clips are viewport-relative. Playwright accounts for scroll;
        // Locator.screenshot would silently scroll an active subject into view.
        screenshotViewportClip: (kind, clip) =>
          page.screenshot({
            path: path.join(output!, `${name}${kind === 'context' ? '-context' : ''}.png`),
            clip,
            timeout: 5000,
          }),
      },
      {
        subject: { x: raw.x, y: raw.y, width: raw.width, height: raw.height },
        viewport: raw.viewport,
        scroll: raw.scroll,
      },
      facts?.paint.paintOutset ?? 0
    );
    if (clips.root.bytes) screenshotSha256 = hash(clips.root.bytes);
    if (clips.context.bytes) contextScreenshotSha256 = hash(clips.context.bytes);
    contextGeometry = clips.context.geometry;
    screenshotGeometryChecks = clips.geometryChecks;
    screenshotClips = {
      root: { clip: clips.root.clip, errors: clips.root.errors },
      context: { clip: clips.context.clip, errors: clips.context.errors },
    };
    screenshotError = clips.errors.length ? clips.errors.join('\n') : null;
    if (facts?.uri) {
      const png = Buffer.from(facts.uri.split(',')[1], 'base64');
      materialSha256 = hash(png);
      await writeFile(path.join(output, `${name}-material.png`), png);
    }
  }
  const diagnostic =
    observationError || facts?.quality !== 'self-optical'
      ? await target.evaluate(collectLiquidMaterialObservation)
      : undefined;
  // No base64 copies in JSON. The real immutable PNG is separately retained.
  const frozen =
    facts &&
    JSON.parse(
      JSON.stringify(facts, (key, value) =>
        ['uri', 'image', 'ownedImage', 'hostImage'].includes(key) &&
        typeof value === 'string' &&
        value.includes('data:image/png')
          ? `[PNG sha256:${materialSha256}]`
          : value
      )
    );
  const record = {
    name,
    runtime,
    part,
    ...source,
    raw,
    states,
    requests,
    facts: frozen,
    diagnostic,
    screenshotSha256,
    contextScreenshotSha256,
    contextGeometry,
    screenshotGeometryChecks,
    screenshotClips,
    contextFraming,
    materialSha256,
    observationError,
    screenshotError,
    screenshotTiming:
      'Actual viewport root/context PNGs follow a freshly verified material receipt; before/between/after checks reject scroll, viewport or subject geometry drift. Dynamic contact pixels may advance. No old or synthetic image is substituted.',
  };
  observations.push(record);
  if (output) await writeFile(path.join(output, `${name}.json`), JSON.stringify(record, null, 2));
  // The evidence write precedes every stage assertion, including errors.
  if (observationError) throw new Error(observationError);
  if (screenshotError) throw new Error(screenshotError);
  if (contextGeometry && !contextGeometry.fullyPadded)
    throw new Error(
      'Native context crop lacks required surrounding pixels; inspect retained geometry'
    );
  if (!facts) throw new Error('No frozen material observation');
  return { facts, raw, states, requests };
}
type Capture = Awaited<ReturnType<typeof capture>>;
function opticalPaint(facts: Capture['facts']) {
  expect(facts.quality).toBe('self-optical');
  expect(facts.source).toBe('visible-app-canvas');
  expect(facts.backdropFilter).toBe('none');
  expect(facts.childCanvases).toBe(0);
  expect(facts.paint.committed).toBe(true);
  expect(facts.snapshot.verifiedAfterDecode).toBe(true);
  expect(facts.receipt.frame).toMatch(/^\d+$/);
  expect(facts.receipt.sourceRevision).toMatch(/^\d+$/);
  expect(facts.pixels!.content.contentPixels).toBeGreaterThan(0);
  expect(facts.pixels!.content.validPixels).toBeGreaterThan(0);
  expect(facts.pixels!.content.opaquePixels).toBe(facts.pixels!.content.contentPixels);
  expect(facts.pixels!.content.partialAlphaPixels).toBe(0);
  expect(facts.pixels!.content.transparentPixels).toBe(0);
  expect(facts.pixels!.content.minForegroundContrast).toBeGreaterThanOrEqual(4.5);
}
function optical({ facts, raw }: Capture) {
  // Observe real flow rather than claiming outer canvas padding proves separation.
  expect(raw.portalDestination).not.toBeNull();
  expect(raw.portalDestination!.gapBelowSubject).toBeGreaterThan(facts.paint.paintOutset);
  expect(facts.carrier.marker).toBe('contact-v1');
  expect(facts.carrier.pointerEvents).toBe('none');
  expect(facts.paint.geometryMatches).toBe(true);
  opticalPaint(facts);
}
function fallback({ facts }: Capture) {
  expect(facts.quality).toBe('opaque-fallback');
  expect(facts.reason).toBeTruthy();
  expect(facts.uri).toBeNull();
  expect(facts.carrier.marker).toBeNull();
  expect(facts.background[3]).toBe(255);
  expect(facts.foreground[3]).toBe(255);
  expect(facts.opacity).toBe('1');
  expect(facts.fallbackContrast).toBeGreaterThanOrEqual(4.5);
}
function sameGeometry(before: Capture, after: Capture) {
  expect(after.raw.documentX).toBe(before.raw.documentX);
  expect(after.raw.documentY).toBe(before.raw.documentY);
  expect(after.raw.width).toBe(before.raw.width);
  expect(after.raw.height).toBe(before.raw.height);
  expect(after.facts.radius).toBe(before.facts.radius);
  expect(after.raw.transform).toBe('none');
  expect(['none', '1']).toContain(after.raw.scale);
  expect(['none', '0px']).toContain(after.raw.translate);
  expect(after.raw.hitContainsCenter).toBe(true);
  expect(after.raw.slotText).toBe(before.raw.slotText);
}
async function resetPartInput(page: Page, cdp: CDPSession, theme: string, touchStarted = false) {
  const errors: string[] = [];
  const attempt = async (name: string, reset: () => Promise<unknown>) => {
    try {
      await reset();
    } catch (error) {
      errors.push(`${name}: ${errorText(error)}`);
    }
  };
  // Move outside before releasing; cleanup must not activate a failed subject.
  await attempt('pointer-outside', () => page.mouse.move(0, 0));
  await attempt('mouse-left-up', () => page.mouse.up());
  await attempt('mouse-right-up', () => page.mouse.up({ button: 'right' }));
  if (touchStarted)
    await attempt('touch-cancel', () =>
      cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
    );
  await attempt('safe-preferences', () => preferences(cdp, theme));
  return errors;
}

async function keyboardFocus(page: Page, runtime: string, part: string) {
  await page.mouse.move(0, 0);
  await entry(page, runtime, part).focus();
  await page.keyboard.press('Tab');
}

// Continue independent parts after a failure, retaining each part's partial
// journey and truthful outcome instead of losing later controls to the first red.
describe.sequential('Liquid command static hover and existing self-contact native evidence', () => {
  for (const runtime of selectedRuntimes)
    for (const theme of ['light', 'dark'] as const) {
      const interactionId = liquidHoverCaseId(runtime, theme, 'interaction');
      const policyId = liquidHoverCaseId(runtime, theme, 'policy-and-boundaries');
      it(
        `${runtime}/${theme}: eight real owners, hover/press/focus and cancellation`,
        (testContext) =>
          checkpoint.runCase(
            interactionId,
            async () => {
              const { context, page, cdp } = await newPage(runtime, theme);
              const failures: string[] = [];
              try {
                for (const part of LIQUID_HOVER_PARTS) {
                  const observations: unknown[] = [];
                  let failure: string | null = null;
                  let touchStarted = false;
                  const target = subject(page, runtime, part);
                  await checkpoint.beginPart(interactionId, part);
                  const sample = (stage: string, ready?: { quality?: string; contact?: string }) =>
                    checkpoint.capture(interactionId, part, stage, () =>
                      capture(
                        `${runtime}-${theme}-${part}-${stage}`,
                        stage,
                        page,
                        target,
                        runtime,
                        part,
                        observations,
                        ready
                      )
                    );
                  try {
                    await page.mouse.move(0, 0);
                    const identity = await target.elementHandle();
                    const slot = target.locator('[data-liquid-hover-slot]');
                    const slotIdentity = await slot.elementHandle();
                    const idle = await sample('idle', { quality: 'self-optical', contact: 'rest' });
                    optical(idle);
                    expect(idle.states.pressed).toBe(false);
                    expect(idle.requests).toEqual([]);
                    await target.hover();
                    const hover = await sample('hover');
                    optical(hover);
                    expect(hover.states.hovered).toBe(true);
                    expect(hover.states.pressed).toBe(false);
                    expect(hover.facts.receipt.contact).toBe('rest');
                    expect(hover.facts.receipt.contactSession).toBe(
                      idle.facts.receipt.contactSession
                    );
                    expect(hover.raw.ring['--pui-ring-width']).toBe('1px');
                    expect(hover.raw.ring['--pui-ring-inset']).toBe('inset');
                    expect(hover.requests).toEqual([]);
                    expect(hover.facts.active).toBe(idle.facts.active);
                    sameGeometry(idle, hover);
                    await page.mouse.down();
                    const down = await sample('down', { contact: 'held' });
                    optical(down);
                    expect(down.states.pressed).toBe(true);
                    expect(down.facts.phase).toBe('pressed');
                    expect(down.requests).toEqual([]);
                    expect(down.facts.active).toBe(idle.facts.active);
                    expect(down.raw.ring['--pui-ring-width']).not.toBe('1px');
                    sameGeometry(idle, down);
                    await page.mouse.up();
                    const released = await sample('release', { contact: 'rest' });
                    optical(released);
                    expect(released.states.pressed).toBe(false);
                    expect(released.requests).toHaveLength(1);
                    if (part === 'submit' || part === 'reset')
                      expect(released.requests[0].kind).toBe(
                        part === 'submit' ? 'Submit' : 'Reset'
                      );
                    expect(released.facts.active).toBe(idle.facts.active);
                    sameGeometry(idle, released);
                    await page.mouse.move(0, 0);
                    const leave = await sample('leave', { contact: 'rest' });
                    optical(leave);
                    expect(leave.states.hovered).toBe(false);
                    expect(leave.states.pressed).toBe(false);
                    sameGeometry(idle, leave);

                    // Focus and hover share ring variables but never compete for the ring.
                    await keyboardFocus(page, runtime, part);
                    const focus = await sample('focus-visible');
                    expect(focus.states.focusVisible).toBe(true);
                    expect(focus.raw.activeElement).toBe(true);
                    expect(focus.raw.ring['--pui-ring-width']).toBe('2px');
                    await target.hover();
                    const focusHover = await sample('focus-plus-hover');
                    expect(focusHover.states.hovered).toBe(true);
                    expect(focusHover.states.focusVisible).toBe(true);
                    expect(focusHover.raw.ring).toEqual(focus.raw.ring);
                    expect(focusHover.facts.receipt.contact).toBe('rest');
                    sameGeometry(idle, focusHover);
                    await preferences(cdp, theme, { 'forced-colors': 'active' });
                    const forced = await sample('forced-colors-focus', {
                      quality: 'opaque-fallback',
                    });
                    fallback(forced);
                    expect(forced.states.focusVisible).toBe(true);
                    expect(forced.raw.outline.style).toBe('solid');
                    expect(parseFloat(forced.raw.outline.width)).toBeGreaterThanOrEqual(2);
                    await preferences(cdp, theme);
                    await entry(page, runtime, part).focus();
                    await page.mouse.move(0, 0);
                    await sample('focus-restored', { quality: 'self-optical', contact: 'rest' });

                    // Held visual contact intentionally survives Base pointerleave.
                    await target.hover();
                    await page.mouse.down();
                    const held = await sample('held', { contact: 'held' });
                    const box = await target.boundingBox();
                    if (!box) throw new Error('No native command box');
                    await page.mouse.move(box.x + box.width + 30, box.y + box.height / 2);
                    const heldLeave = await sample('held-leave', { contact: 'held' });
                    expect(heldLeave.states.hovered).toBe(false);
                    expect(heldLeave.states.pressed).toBe(false);
                    expect(heldLeave.facts.receipt.contactSession).toBe(
                      held.facts.receipt.contactSession
                    );
                    await target.hover();
                    const reenter = await sample('held-reenter', { contact: 'held' });
                    expect(reenter.states.hovered).toBe(true);
                    expect(reenter.states.pressed).toBe(false);
                    expect(reenter.facts.receipt.contactSession).toBe(
                      held.facts.receipt.contactSession
                    );
                    await page.mouse.move(box.x + box.width + 30, box.y + box.height / 2);
                    await page.mouse.up();
                    const heldRelease = await sample('held-release-outside', { contact: 'rest' });
                    expect(heldRelease.states.pressed).toBe(false);

                    // Element focus transfer is not whole-window input cancellation.
                    // Retain held-session facts; assert only the focus owner's semantics.
                    await target.hover();
                    await target.focus();
                    await page.mouse.down();
                    const beforeElementBlur = await sample('native-element-blur-before', {
                      contact: 'held',
                    });
                    await entry(page, runtime, part).focus();
                    const elementBlur = await sample('native-element-blur', { contact: 'held' });
                    expect(elementBlur.states.focused).toBe(false);
                    expect(elementBlur.states.focusVisible).toBe(false);
                    expect(elementBlur.requests).toEqual(beforeElementBlur.requests);
                    expect(elementBlur.facts.receipt.contactSession).toBe(
                      beforeElementBlur.facts.receipt.contactSession
                    );
                    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
                    const windowCanceled = await sample('window-blur-after-element-transfer', {
                      contact: 'rest',
                    });
                    expect(windowCanceled.states.pressed).toBe(false);
                    expect(windowCanceled.states.hovered).toBe(false);
                    expect(windowCanceled.requests).toEqual(beforeElementBlur.requests);
                    await page.mouse.move(0, 0);
                    await page.mouse.up();

                    // Deterministic host-event cancellation probes are labeled as such;
                    // these are not claimed to be OS-generated pointer cancellation.
                    for (const cancellation of [
                      'pointercancel',
                      'lostpointercapture',
                      'window-blur',
                    ] as const) {
                      await page.mouse.move(0, 0);
                      await target.hover();
                      await page.mouse.down();
                      await sample(`${cancellation}-before`, { contact: 'held' });
                      const beforeRequests = await fixture(page, runtime, part, 'requests');
                      if (cancellation === 'window-blur')
                        await page.evaluate(() => window.dispatchEvent(new Event('blur')));
                      else
                        await target.dispatchEvent(cancellation, {
                          pointerId: 1,
                          pointerType: 'mouse',
                          isPrimary: true,
                          button: 0,
                          bubbles: true,
                        });
                      const canceled = await sample(`${cancellation}-injected-host-route`, {
                        contact: 'rest',
                      });
                      expect(canceled.states.pressed).toBe(false);
                      expect(canceled.states.hovered).toBe(false);
                      expect(canceled.requests).toEqual(beforeRequests);
                      await page.mouse.move(0, 0);
                      await page.mouse.up();
                    }

                    // Secondary/nonprimary input must never allocate pointer contact.
                    await target.hover();
                    const beforeSecondary = await sample('secondary-before');
                    const previousRequests = await fixture(page, runtime, part, 'requests');
                    await page.mouse.down({ button: 'right' });
                    const secondary = await sample('secondary-down');
                    expect(secondary.facts.receipt.contactSession).toBe(
                      beforeSecondary.facts.receipt.contactSession
                    );
                    await page.mouse.up({ button: 'right' });
                    const secondaryUp = await sample('secondary-up', { contact: 'rest' });
                    expect(secondaryUp.requests).toEqual(previousRequests);
                    await target.dispatchEvent('pointerdown', {
                      pointerId: 71,
                      pointerType: 'touch',
                      isPrimary: false,
                      button: 0,
                      buttons: 1,
                      clientX: box.x + 5,
                      clientY: box.y + 5,
                    });
                    const nonprimary = await sample('nonprimary-injected-host-route');
                    expect(nonprimary.facts.receipt.contactSession).toBe(
                      beforeSecondary.facts.receipt.contactSession
                    );
                    await target.dispatchEvent('pointercancel', {
                      pointerId: 71,
                      pointerType: 'touch',
                      isPrimary: false,
                      button: 0,
                    });
                    await sample('nonprimary-canceled', { contact: 'rest' });

                    // Genuine Chromium touch input, followed by genuine touch cancellation.
                    await page.mouse.move(0, 0);
                    const touchBox = await target.boundingBox();
                    if (!touchBox) throw new Error('No touch target');
                    touchStarted = true;
                    await cdp.send('Input.dispatchTouchEvent', {
                      type: 'touchStart',
                      touchPoints: [
                        {
                          x: touchBox.x + touchBox.width / 2,
                          y: touchBox.y + touchBox.height / 2,
                          id: 19,
                        },
                      ],
                    });
                    const touch = await sample('native-touch-down', { contact: 'held' });
                    expect(touch.states.pressed).toBe(true);
                    await cdp.send('Input.dispatchTouchEvent', {
                      type: 'touchCancel',
                      touchPoints: [],
                    });
                    touchStarted = false;
                    const touchCanceled = await sample('native-touch-cancel', { contact: 'rest' });
                    expect(touchCanceled.states.pressed).toBe(false);
                    expect(touchCanceled.states.hovered).toBe(false);

                    // Same retained root and slotted authored node after all input paths.
                    expect(await target.evaluate((el, original) => el === original, identity)).toBe(
                      true
                    );
                    expect(
                      await slot.evaluate((el, original) => el === original, slotIdentity)
                    ).toBe(true);
                  } catch (error) {
                    failure = errorText(error);
                    failures.push(`${part}: ${failure}`);
                  } finally {
                    const cleanupErrors = await resetPartInput(page, cdp, theme, touchStarted);
                    results.push({
                      runtime,
                      theme,
                      part,
                      scenario: 'interaction',
                      failure,
                      cleanupErrors,
                      observations,
                    });
                    const checkpointFailure = await checkpoint.finishPart(
                      interactionId,
                      part,
                      failure,
                      cleanupErrors
                    );
                    if (!failure && checkpointFailure)
                      failures.push(`${part}: ${checkpointFailure}`);
                    if (cleanupErrors.length)
                      throw new Error(
                        `Cannot isolate remaining parts: ${cleanupErrors.join('; ')}`
                      );
                  }
                }
              } finally {
                await context.close();
              }
              expect(
                failures,
                'All partial stage artifacts and independent part outcomes were retained'
              ).toEqual([]);
            },
            () => testContext.task.result?.state === 'fail'
          ),
        240_000
      );

      it(
        `${runtime}/${theme}: current-state fallback, disabled policy, source loss and carrier boundaries`,
        (testContext) =>
          checkpoint.runCase(
            policyId,
            async () => {
              const { context, page, cdp } = await newPage(runtime, theme);
              const failures: string[] = [];
              const run = async (
                part: string,
                task: (
                  sample: (
                    stage: string,
                    ready?: { quality?: string; contact?: string }
                  ) => Promise<Capture>,
                  target: Locator
                ) => Promise<void>
              ) => {
                const observations: unknown[] = [];
                let failure: string | null = null;
                const target = subject(page, runtime, part);
                await checkpoint.beginPart(policyId, part);
                try {
                  await task(
                    (stage, ready) =>
                      checkpoint.capture(policyId, part, stage, () =>
                        capture(
                          `${runtime}-${theme}-${part}-${stage}`,
                          stage,
                          page,
                          target,
                          runtime,
                          part,
                          observations,
                          ready
                        )
                      ),
                    target
                  );
                } catch (error) {
                  failure = errorText(error);
                  failures.push(`${part}: ${failure}`);
                } finally {
                  const cleanupErrors = await resetPartInput(page, cdp, theme);
                  results.push({
                    runtime,
                    theme,
                    part,
                    scenario: 'policy-and-boundaries',
                    failure,
                    cleanupErrors,
                    observations,
                  });
                  const checkpointFailure = await checkpoint.finishPart(
                    policyId,
                    part,
                    failure,
                    cleanupErrors
                  );
                  if (!failure && checkpointFailure) failures.push(`${part}: ${checkpointFailure}`);
                  if (cleanupErrors.length)
                    throw new Error(`Cannot isolate remaining parts: ${cleanupErrors.join('; ')}`);
                }
              };
              try {
                for (const part of LIQUID_HOVER_PARTS)
                  await run(part, async (sample, target) => {
                    await page.mouse.move(0, 0);
                    const initial = await sample('policy-idle', {
                      quality: 'self-optical',
                      contact: 'rest',
                    });
                    optical(initial);
                    await fixture(page, runtime, part, 'source', false);
                    const lost = await sample('source-lost', { quality: 'opaque-fallback' });
                    fallback(lost);
                    if (part === 'button') {
                      expect(lost.facts.background).toEqual(lost.facts.palette.secondary);
                      expect(lost.facts.foreground).toEqual(lost.facts.palette.secondaryForeground);
                    }
                    await target.hover();
                    const lostHover = await sample('source-lost-hover');
                    fallback(lostHover);
                    expect(lostHover.facts.background).toEqual(lost.facts.background);
                    expect(lostHover.facts.foreground).toEqual(lost.facts.foreground);
                    sameGeometry(lost, lostHover);
                    await fixture(page, runtime, part, 'source', true);
                    const restored = await sample('source-restored', {
                      quality: 'self-optical',
                      contact: 'rest',
                    });
                    optical(restored);
                    expect(restored.facts.receipt.contact).toBe('rest');

                    // Direct disabled (Accordion Item policy) and inherited Root disabled.
                    const directRef = part === 'accordion' ? 'item' : 'subject';
                    for (const ref of part === 'button' || part === 'toggle'
                      ? [directRef]
                      : [directRef, 'owner']) {
                      await target.hover();
                      await page.mouse.down();
                      await sample(`disable-${ref}-held`, { contact: 'held' });
                      const priorRequests = await fixture(page, runtime, part, 'requests');
                      await fixture(page, runtime, part, 'setProps', ref, { disabled: true });
                      const disabled = await sample(`disabled-${ref}`, {
                        quality: 'opaque-fallback',
                      });
                      fallback(disabled);
                      expect(disabled.states.disabled).toBe(true);
                      expect(disabled.states.pressed).toBe(false);
                      expect(disabled.states.hovered).toBe(false);
                      expect(isUnpaintedBootstrapBoxShadow(disabled.facts.shadow)).toBe(true);
                      await page.mouse.up();
                      await page.keyboard.press('Space');
                      expect(await fixture(page, runtime, part, 'requests')).toEqual(priorRequests);
                      await fixture(page, runtime, part, 'removeProp', ref, 'disabled');
                      await page.mouse.move(0, 0);
                      const enabled = await sample(`reenabled-${ref}`, {
                        quality: 'self-optical',
                        contact: 'rest',
                      });
                      optical(enabled);
                      expect(enabled.states.disabled).toBe(false);
                    }
                    // Existing material prop removal restores auto on these four parts.
                    if (['button', 'toggle', 'submit', 'reset'].includes(part)) {
                      await fixture(page, runtime, part, 'setProps', 'subject', {
                        material: 'opaque',
                      });
                      fallback(await sample('explicit-opaque', { quality: 'opaque-fallback' }));
                      await fixture(page, runtime, part, 'removeProp', 'subject', 'material');
                      optical(
                        await sample('material-prop-removed', {
                          quality: 'self-optical',
                          contact: 'rest',
                        })
                      );
                    }
                    if (part === 'toggle')
                      for (const active of [true, false]) {
                        await fixture(page, runtime, part, 'setProps', 'subject', { active });
                        const selected = await sample(`selection-${active}`, {
                          quality: 'self-optical',
                          contact: 'rest',
                        });
                        optical(selected);
                        expect(selected.facts.active).toBe(String(active));
                        await target.hover();
                        const hover = await sample(`selection-${active}-hover`);
                        optical(hover);
                        expect(hover.facts.active).toBe(String(active));
                        expect(hover.facts.receipt.contact).toBe('rest');
                        expect(hover.facts.receipt.profile).toBe(selected.facts.receipt.profile);
                        expect(hover.facts.foreground).toEqual(selected.facts.foreground);
                        expect(hover.raw.selectionMarker).toEqual(selected.raw.selectionMarker);
                        expect(hover.raw.selectionMarker).toMatchObject({
                          opacity: active ? '1' : '0',
                          width: 12,
                          height: 12,
                          hidden: 'true',
                        });
                        sameGeometry(selected, hover);
                        await fixture(page, runtime, part, 'setProps', 'subject', {
                          disabled: true,
                        });
                        const disabled = await sample(`selection-${active}-disabled`, {
                          quality: 'opaque-fallback',
                        });
                        fallback(disabled);
                        expect(disabled.facts.active).toBe(String(active));
                        expect(disabled.facts.background).toEqual(
                          active ? disabled.facts.palette.primary : disabled.facts.palette.secondary
                        );
                        expect(disabled.facts.foreground).toEqual(
                          active
                            ? disabled.facts.palette.primaryForeground
                            : disabled.facts.palette.secondaryForeground
                        );
                        await fixture(page, runtime, part, 'removeProp', 'subject', 'disabled');
                        await page.mouse.move(0, 0);
                      }
                    await preferences(cdp, theme, { 'prefers-reduced-motion': 'reduce' });
                    const reduced = await sample('reduced-motion', { quality: 'self-optical' });
                    expect(reduced.facts.motion).toBe('static');
                    if (part === 'submit' || part === 'reset') {
                      // Reduced-motion Form candidates omit deformation and paint on the host.
                      expect(reduced.facts.phase).toBe('rest');
                      expect(reduced.facts.receipt.contact).toBeNull();
                      expect(reduced.facts.receipt.contactSession).toBeNull();
                      expect(reduced.facts.carrier.marker).toBeNull();
                      opticalPaint(reduced.facts);
                    } else {
                      expect(reduced.facts.receipt.contact).toBe('rest');
                    }
                    await preferences(cdp, theme, { 'prefers-reduced-transparency': 'reduce' });
                    fallback(await sample('reduced-transparency', { quality: 'opaque-fallback' }));
                    await preferences(cdp, theme);
                  });
                await run('accordion-blocked', async (sample, target) => {
                  const blocked = await sample('collapse-blocked', { quality: 'opaque-fallback' });
                  fallback(blocked);
                  expect(blocked.states.collapseBlocked).toBe(true);
                  expect(blocked.states.disabled).toBe(false);
                  await target.hover();
                  const hover = await sample('collapse-blocked-hover');
                  fallback(hover);
                  expect(hover.raw.ring['--pui-ring-width']).not.toBe('1px');
                  expect(isUnpaintedBootstrapBoxShadow(hover.facts.shadow)).toBe(true);
                  const blockedBox = await target.boundingBox();
                  if (!blockedBox) throw new Error('No collapse-blocked native box');
                  // aria-disabled intentionally blocks Playwright locator.click(); use
                  // native mouse input to test Base policy without force or DOM.click.
                  await page.mouse.click(
                    blockedBox.x + blockedBox.width / 2,
                    blockedBox.y + blockedBox.height / 2
                  );
                  const pressed = await sample('collapse-blocked-click');
                  expect(pressed.raw.attributes['aria-disabled']).toBe('true');
                  expect(pressed.requests).toEqual([]);
                  expect(pressed.raw.attributes['aria-expanded']).toBe('true');
                  await keyboardFocus(page, runtime, 'accordion-blocked');
                  const focused = await sample('collapse-blocked-focus');
                  expect(focused.states.focusVisible).toBe(true);
                  expect(focused.raw.ring['--pui-ring-width']).toBe('2px');
                });
                for (const part of [...LIQUID_HOVER_NEGATIVES, 'accordion-tight'])
                  await run(part, async (sample, target) => {
                    await page.mouse.move(0, 0);
                    const rejected = await sample('negative-idle', { quality: 'opaque-fallback' });
                    fallback(rejected);
                    expect(rejected.facts.reason).not.toBe('rendered');
                    if (part === 'accordion-tight') {
                      // This actual destination-overlap negative does not prove
                      // admission or rejection of the ancestor's visible border.
                      expect(rejected.facts.reason).toBe('source-overlapping-content');
                      expect(rejected.raw.portalDestination).not.toBeNull();
                      expect(rejected.raw.portalDestination!.gapBelowSubject).toBeCloseTo(1, 2);
                      expect(rejected.raw.portalDestination!.gapBelowSubject).toBeGreaterThan(0);
                      expect(rejected.raw.portalDestination!.gapBelowSubject).toBeLessThan(
                        rejected.facts.paint.paintOutset
                      );
                    }
                    if (part === 'authored-before') expect(rejected.raw.beforeContent).toBe('"•"');
                    await target.hover();
                    const hovered = await sample('negative-hover');
                    fallback(hovered);
                    expect(hovered.facts.background).toEqual(rejected.facts.background);
                    expect(hovered.facts.foreground).toEqual(rejected.facts.foreground);
                    await page.mouse.down();
                    const pressed = await sample('negative-press');
                    fallback(pressed);
                    await page.mouse.up();
                    fallback(await sample('negative-release'));
                  });
              } finally {
                await page.mouse.up().catch(() => {});
                await context.close();
              }
              expect(failures, 'Safe fallback and original evidence gates remain blocking').toEqual(
                []
              );
            },
            () => testContext.task.result?.state === 'fail'
          ),
        240_000
      );
    }
});
