// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Browser, type Page, type CDPSession } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest';
import { RUNTIMES, chromeExecutable, startServer, stopServer } from './browser-harness';
import {
  PROMINENT_TINT_CONTROLS,
  createProminentTintPlan,
  createProminentTintCheckpoint,
  finalizeProminentTintStatus,
  type TintCheckpointStatus,
  prominentTintPreferenceStages,
  PROMINENT_TINT_SOURCES,
  type TintControl,
  type TintPart,
  type TintContent,
} from './liquid-prominent-tint-fixture';
import {
  measureProminentTintPair,
  classifyProminentTintEvidence,
  PROMINENT_TINT_POLICY,
  type DetailImage,
  type TintPair,
} from './liquid-prominent-tint-metrics';
import { liquidHoverContextCapture } from './liquid-hover-fixture';
import {
  installProminentTintPreferenceProbe,
  runProminentTintSyntheticCancel,
  runProminentTintCase,
  awaitProminentTintCheckpoint,
  PROMINENT_TINT_OBSERVATION_PROGRESS,
} from '../../../../test/fixtures/liquid-prominent-tint-test-harness';
import type { captureProminentTintFrame } from './liquid-prominent-tint-capture';

// Native only in official exact-candidate CI. Independent bounded shard per
// runtime; all semantic cases remain present. No local browser fallback.
const route = '/en/test/liquid-glass-prominent-tint/';
// Whole file is Liquid Glass 0.4/WIP. The four runtime jobs stay opt-in, not a 0.3 gate.
const includeLiquidWip = process.env.PUI_LIQUID_GLASS_INCLUDE_WIP === '1';
const evidenceRoot = process.env.PROTO_UI_MATERIAL_EVIDENCE_DIR;
const output = evidenceRoot ? path.join(evidenceRoot, 'prominent-tint') : null;
const revision = {
  sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  tree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim(),
  patchSha256: createHash('sha256')
    .update(execFileSync('git', ['diff', '--binary', 'HEAD']))
    .digest('hex'),
};
const shard = process.env.PROTO_UI_PROMINENT_TINT_RUNTIME;
const collectionPlan = createProminentTintPlan(shard);
if (shard && !RUNTIMES.includes(shard as any))
  throw new Error('Invalid prominent tint runtime shard');
const runtimes = shard ? RUNTIMES.filter((runtime) => runtime === shard) : RUNTIMES;
const safe = {
  'prefers-reduced-motion': 'no-preference',
  'prefers-reduced-transparency': 'no-preference',
  'prefers-contrast': 'no-preference',
  'forced-colors': 'none',
};
let browser: Browser, baseUrl: string;
const results: unknown[] = [];
const coverage = new Map<string, { status: string; error?: string }>(
  collectionPlan.cases.map((entry) => [entry.id, { status: 'not-run' }])
);
const captureCoverage = new Map<string, { status: string; error?: string }>(
  collectionPlan.cases.flatMap((entry) =>
    entry.captures.map((id) => [id, { status: 'not-run' }] as const)
  )
);
const captureOwners = new Map(
  collectionPlan.cases.flatMap((entry) => entry.captures.map((id) => [id, entry.id] as const))
);
const captureCaseRunning = (name: string) =>
  !checkpointFinalized && coverage.get(captureOwners.get(name)!)?.status === 'running';
function recordCapture(name: string, record: TintCheckpointStatus) {
  if (!captureCaseRunning(name)) return false;
  captureCoverage.set(name, record);
  return true;
}
const behaviorCoverage = new Map<string, string>();
const opticalCoverage = new Map<string, string>();
let checkpointEnabled = false,
  checkpointFinalized = false,
  checkpointSequence = 0,
  checkpointQueue = Promise.resolve();
function checkpoint(phase: 'planned' | 'running' | 'terminal') {
  if (!checkpointEnabled || !output || checkpointFinalized) return checkpointQueue;
  if (phase === 'terminal') checkpointFinalized = true;
  const sequence = ++checkpointSequence;
  const snapshot = {
    ...revision,
    sequence,
    updatedAt: new Date().toISOString(),
    ...createProminentTintCheckpoint(
      collectionPlan,
      { cases: Object.fromEntries(coverage), captures: Object.fromEntries(captureCoverage) },
      phase
    ),
    behavior: Object.fromEntries(behaviorCoverage),
    optical: Object.fromEntries(opticalCoverage),
  };
  checkpointQueue = checkpointQueue.then(async () => {
    const temporary = path.join(output, `coverage-checkpoint-${sequence}.tmp`);
    await writeFile(temporary, JSON.stringify(snapshot, null, 2), { flush: true });
    await rename(temporary, path.join(output, 'coverage-checkpoint.json'));
  });
  return checkpointQueue;
}
type Frame = Awaited<ReturnType<typeof captureProminentTintFrame>>;
const errorText = (error: unknown) =>
  error instanceof Error ? (error.stack ?? error.message) : String(error);
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
async function json(name: string, value: unknown) {
  if (output) await writeFile(path.join(output, `${name}.json`), JSON.stringify(value, null, 2));
}
async function png(name: string, uri: string | null | undefined) {
  if (output && uri)
    await writeFile(
      path.join(output, `${name}.png`),
      Buffer.from(uri.replace(/^data:image\/png;base64,/, ''), 'base64')
    );
}
const target = (page: Page, control: TintControl) =>
  page.locator(`[data-tint-control="${control}"] [data-demo-ref="subject"]`);
async function call(page: Page, operation: string, ...args: unknown[]) {
  return page.evaluate(
    ({ operation, args }) => (window as any).prominentTintFixture[operation](...args),
    { operation, args }
  );
}
async function preferences(cdp: CDPSession, theme: string, extra: Record<string, string> = {}) {
  await cdp.send('Emulation.setEmulatedMedia', {
    features: Object.entries({ ...safe, 'prefers-color-scheme': theme, ...extra }).map(
      ([name, value]) => ({ name, value })
    ),
  });
}
beforeAll(async () => {
  if (process.env.GITHUB_ACTIONS !== 'true' || !process.env.CANDIDATE_SHA || !output)
    throw new Error('Prominent tint native evidence requires official exact-head GitHub Actions');
  expect(revision.sha).toBe(process.env.CANDIDATE_SHA);
  expect(execFileSync('git', ['diff', '--binary', 'HEAD']).length).toBe(0);
  expect(
    execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { encoding: 'utf8' }).trim()
  ).toBe('');
  if (process.env.PROTO_UI_BROWSER_BASE_URL) throw new Error('Use this job own loopback server');
  await mkdir(output, { recursive: true });
  await json('source', {
    ...revision,
    policy: PROMINENT_TINT_POLICY,
    shard: shard ?? 'all',
    status: 'planned; terminal Vitest and per-case results are authoritative',
  });
  checkpointEnabled = true;
  await checkpoint('planned');
  baseUrl = await startServer(route);
  browser = await chromium.launch({
    executablePath: await chromeExecutable(),
    headless: true,
    chromiumSandbox: true,
    args: ['--disable-dev-shm-usage'],
  });
}, 150_000);
afterAll(async () => {
  try {
    // Use one terminal reconciliation for both checkpoint and final results.
    // A timeout has executed; only untouched entries may become blocked.
    for (const [name, record] of coverage) {
      coverage.set(name, finalizeProminentTintStatus(record));
      if (record.status === 'running' && behaviorCoverage.get(name) !== 'passed')
        behaviorCoverage.set(name, 'interrupted');
    }
    for (const [name, record] of captureCoverage)
      captureCoverage.set(name, finalizeProminentTintStatus(record));
    if (checkpointEnabled) await checkpoint('terminal');
    if (checkpointEnabled)
      await json('results', {
        ...revision,
        browser: browser?.version(),
        node: process.version,
        route,
        coverage: Object.fromEntries(coverage),
        behavior: Object.fromEntries(
          ['passed', 'failed', 'interrupted', 'not-run'].map((status) => [
            status,
            [...behaviorCoverage.values()].filter((value) => value === status).length,
          ])
        ),
        behaviorCoverage: Object.fromEntries(
          [...behaviorCoverage].map(([name, status]) => [
            name,
            status === 'not-run' ? 'blocked-by-earlier-case-failure' : status,
          ])
        ),
        opticalCoverage: Object.fromEntries(
          [...opticalCoverage].map(([name, status]) => [
            name,
            status === 'not-run' ? 'blocked-by-earlier-case-failure' : status,
          ])
        ),
        optical: Object.fromEntries(
          ['passed', 'failed', 'inconclusive', 'diagnostic-only', 'invalid-control'].map(
            (status) => [
              status,
              results.filter((result: any) => result.classification?.status === status).length,
            ]
          )
        ),
        captureCoverage: Object.fromEntries(captureCoverage),
        results,
        visualAcceptance:
          'pending actual-size manual review; numerical diagnostic passes do not establish visual acceptance',
        scope:
          'Four Web runtimes with the existing owned visible canvas provider. No arbitrary DOM capture, Apple pixel equivalence or local GPU acceptance.',
      });
  } finally {
    try {
      await browser?.close();
    } finally {
      await stopServer();
    }
  }
}, 60_000);
async function open(runtime: string, theme: string, part: TintPart, content: TintContent) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  });
  await context.route('**/*', (request) =>
    new URL(request.request().url()).origin === new URL(baseUrl).origin
      ? request.continue()
      : request.abort()
  );
  // Unsupported-query injection is explicitly a synthetic host capability
  // probe. Known preference cases use native Chromium CDP media emulation.
  await context.addInitScript(installProminentTintPreferenceProbe);
  const page = await context.newPage(),
    cdp = await context.newCDPSession(page);
  page.setDefaultTimeout(8000);
  try {
    await preferences(cdp, theme);
    await page.goto(
      `${baseUrl}${route}?runtime=${runtime}&theme=${theme}&part=${part}&content=${content}`,
      { waitUntil: 'networkidle' }
    );
    await page.waitForFunction(
      () => document.documentElement.dataset.prominentTintReady === 'true',
      undefined,
      { timeout: 60_000 }
    );
    return { context, page, cdp };
  } catch (error) {
    if (output)
      await page
        .screenshot({
          path: path.join(output, `${runtime}-${theme}-${part}-${content}-setup-failure.png`),
          fullPage: true,
        })
        .catch(() => {});
    await json(`${runtime}-${theme}-${part}-${content}-setup-failure`, {
      error: errorText(error),
      fixtureError: await page
        .evaluate(() => document.documentElement.dataset.prominentTintError)
        .catch(() => null),
    });
    await context.close();
    throw error;
  }
}
async function sample(
  page: Page,
  name: string,
  control: TintControl,
  quality = 'self-optical',
  contact?: string
) {
  if (!captureCoverage.has(name)) throw new Error(`Undeclared prominent tint capture ${name}`);
  if (!recordCapture(name, { status: 'running' }))
    throw new Error(`Prominent tint case is no longer running: ${name}`);
  await awaitProminentTintCheckpoint(
    name,
    () => checkpoint('running'),
    () => captureCaseRunning(name)
  );
  try {
    const element = target(page, control);
    await element.scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    let readinessError: string | null = null;
    try {
      await page.waitForFunction(
        ({ control, quality, contact }) => {
          const el = document.querySelector<HTMLElement>(
            `[data-tint-control="${control}"] [data-demo-ref="subject"]`
          );
          return (
            !!el &&
            el.dataset.materialQuality === quality &&
            (quality !== 'self-optical' ||
              el.dataset.materialSourceRevision ===
                String((window as any).prominentTintFixture.sourceRevision(control))) &&
            (!contact || el.dataset.materialContact === contact)
          );
        },
        { control, quality, contact },
        { timeout: 4000 }
      );
    } catch (error) {
      readinessError = errorText(error);
    }
    const facts = (await call(page, 'capture', control)) as Frame;
    const viewport = await page.evaluate(() => ({
      dpr: devicePixelRatio,
      scale: visualViewport?.scale ?? 1,
      width: innerWidth,
      height: innerHeight,
      scrollX,
      scrollY,
    }));
    const clip = facts.raster.clip;
    const context = liquidHoverContextCapture(
      facts.geometry,
      { width: 1280, height: 900 },
      facts.snapshot.paint.paintOutset
    );
    await json(`${name}-frozen-before-screenshot`, {
      ...revision,
      name,
      viewport,
      raster: facts.raster,
      geometry: facts.geometry,
      receipt: facts.snapshot.receipt,
      source: facts.source,
      sourceStillCurrent: facts.sourceStillCurrent,
    });
    if (
      viewport.dpr !== 1 ||
      viewport.scale !== 1 ||
      clip.x < 0 ||
      clip.y < 0 ||
      clip.x + clip.width > viewport.width ||
      clip.y + clip.height > viewport.height
    )
      throw new Error(
        'Explicit prominent tint screenshot clip requires unscaled in-viewport CSS pixels'
      );
    // Explicit integer viewport clip, not Locator.screenshot's implicit enclosure.
    // All three rasters use these exact physical 1-CSS-pixel coordinates.
    const screenshot = await page.screenshot({ clip, scale: 'css', caret: 'initial' });
    if (output) {
      await writeFile(path.join(output, `${name}-subject.png`), screenshot);
      await page.screenshot({
        path: path.join(output, `${name}-context.png`),
        clip: context.clip,
        scale: 'css',
        caret: 'initial',
      });
    }
    await png(`${name}-source`, facts.source?.png);
    await png(`${name}-source-crop`, facts.sourceCrop?.png);
    await png(`${name}-carrier`, facts.snapshot.uri);
    await png(`${name}-interior-plane`, facts.material?.png);
    await png(`${name}-structure-mask`, facts.maskPng);
    await png(`${name}-structure-roi`, facts.roiPng);
    const after = (await call(page, 'capture', control)) as Frame;
    const signature = (frame: Frame) =>
      JSON.stringify({
        raster: frame.raster,
        geometry: frame.geometry,
        source: frame.source
          ? {
              revision: frame.source.revision,
              hash: frame.source.pixelSha256,
              rect: frame.source.rect,
              crop: frame.source.crop,
            }
          : null,
        receipt: frame.snapshot.receipt,
        phase: frame.snapshot.phase,
        foreground: frame.snapshot.foreground,
        palette: frame.snapshot.palette,
        exclusions: frame.exclusions,
      });
    const screenshotBinding = after.binding && signature(facts) === signature(after);
    const screenshotUri = `data:image/png;base64,${screenshot.toString('base64')}`;
    // Validate every real screenshot's pixel dimensions. Opaque is never modeled
    // from CSS fill or resized to fit; retain its actually captured native pixels.
    const nativeImage = (await call(page, 'decode', screenshotUri, facts.raster)) as DetailImage;
    const image: DetailImage = facts.material ?? nativeImage;
    const states = Object.fromEntries(
      await Promise.all(
        ['hovered', 'pressed', 'focusVisible', 'focused', 'disabled'].map(async (name) => [
          name,
          await call(page, 'state', control, name),
        ])
      )
    );
    const record = {
      ...revision,
      name,
      control,
      readinessError,
      screenshotBinding,
      screenshotViewport: viewport,
      ...facts,
      image,
      states,
      requests: await call(page, 'requests', control),
      subjectPngSha256: hash(screenshot),
    };
    await json(name, {
      ...record,
      context,
      sourceCrop: facts.sourceCrop
        ? { ...facts.sourceCrop, data: 'retained in source-crop PNG' }
        : null,
      material: facts.material
        ? { ...facts.material, data: 'retained in interior-plane PNG' }
        : null,
      image: 'retained in interior-plane or native subject PNG',
    });
    if (!recordCapture(name, { status: 'captured-before-assertion' }))
      throw new Error(`Prominent tint case ended during capture: ${name}`);
    try {
      expect(readinessError, `${name}: readiness`).toBeNull();
      expect(facts.binding, `${name}: atomic source/carrier binding`).toBe(true);
      expect(screenshotBinding, `${name}: post-screenshot source/geometry/receipt binding`).toBe(
        true
      );
      expect(facts.raw.ariaPressed).toBeNull();
      expect(facts.foregroundMatchesHost).toBe(true);
      if (quality === 'self-optical') {
        expect(facts.snapshot.paint.committed).toBe(true);
        expect(facts.snapshot.snapshot.verifiedAfterDecode).toBe(true);
        expect(facts.snapshot.pixels?.content.minForegroundContrast).toBeGreaterThanOrEqual(4.5);
      } else {
        expect(facts.snapshot.uri).toBeNull();
        expect(facts.snapshot.fallbackContrast).toBeGreaterThanOrEqual(4.5);
      }
      recordCapture(name, { status: 'passed-observation-checks' });
    } catch (error) {
      recordCapture(name, { status: 'failed', error: errorText(error) });
      throw error;
    }
    await awaitProminentTintCheckpoint(
      name,
      () => checkpoint('running'),
      () => captureCaseRunning(name)
    );
    return record;
  } catch (error) {
    recordCapture(name, { status: 'failed', error: errorText(error) });
    await checkpoint('running');
    throw error;
  }
}
async function runCase(name: string, run: () => Promise<void>) {
  return runProminentTintCase(run, onTestFailed, {
    async running() {
      coverage.set(name, { status: 'running' });
      await checkpoint('running');
    },
    async completed() {
      if (checkpointFinalized) return;
      coverage.set(name, { status: 'completed' });
      if (name.endsWith('-preferences')) behaviorCoverage.set(name, 'passed');
      await checkpoint('running');
    },
    async failed(error) {
      if (checkpointFinalized) return;
      const failure = errorText(error);
      coverage.set(name, { status: 'failed', error: failure });
      if (behaviorCoverage.get(name) !== 'passed') behaviorCoverage.set(name, 'failed');
      for (const capture of collectionPlan.cases.find((entry) => entry.id === name)!.captures) {
        const record = captureCoverage.get(capture)!;
        if (['running', 'captured-before-assertion'].includes(record.status))
          captureCoverage.set(capture, { status: 'interrupted-by-case-failure', error: failure });
      }
      await json(`${name}-failure`, { ...revision, name, error: failure });
      await checkpoint('running');
    },
  });
}
for (const runtime of runtimes)
  for (const theme of ['light', 'dark'] as const)
    for (const part of ['button', 'submit'] as const) {
      for (const content of ['text', 'icon-only'] as const) {
        const name = `${runtime}-${theme}-${part}-${content}`;
        coverage.set(name, { status: 'not-run' });
        behaviorCoverage.set(name, 'not-run');
        for (const control of PROMINENT_TINT_CONTROLS) {
          for (const phase of ['idle', 'hover', 'down', 'release', 'leave'])
            captureCoverage.set(`${name}-${control}-${phase}`, { status: 'not-run' });
          for (const source of PROMINENT_TINT_SOURCES)
            opticalCoverage.set(`${name}-${source}-${control}`, 'not-run');
          for (const source of PROMINENT_TINT_SOURCES)
            for (const phase of [0, 1])
              captureCoverage.set(`${name}-${source}-${phase}-${control}`, { status: 'not-run' });
        }
        describe(`${name} source-bound prominent tint`, () => {
          it.skipIf(!includeLiquidWip)(
            'retains the real five-state journey and paired source evidence',
            () =>
              runCase(name, async () => {
                const { context, page } = await open(runtime, theme, part, content);
                try {
                  const journey: unknown[] = [];
                  for (const control of PROMINENT_TINT_CONTROLS) {
                    const quality = control === 'opaque' ? 'opaque-fallback' : 'self-optical',
                      el = target(page, control),
                      prefix = `${name}-${control}`;
                    await page.mouse.move(0, 0);
                    await call(page, 'paint', 'pastel', 0);
                    const label =
                      part === 'button' ? 'Continue' : control === 'neutral' ? 'Reset' : 'Submit';
                    expect(
                      await page
                        .locator(`[data-tint-control="${control}"]`)
                        .getByRole('button', { name: label, exact: true })
                        .count()
                    ).toBe(1);
                    const idle = await sample(
                      page,
                      `${prefix}-idle`,
                      control,
                      quality,
                      control === 'opaque' ? undefined : 'rest'
                    );
                    journey.push(idle);
                    await el.hover();
                    const hover = await sample(page, `${prefix}-hover`, control, quality);
                    journey.push(hover);
                    expect(hover.states.hovered).toBe(true);
                    expect(hover.requests).toHaveLength(0);
                    await page.mouse.down();
                    const down = await sample(
                      page,
                      `${prefix}-down`,
                      control,
                      quality,
                      control === 'opaque' ? undefined : 'held'
                    );
                    journey.push(down);
                    expect(down.states.pressed).toBe(true);
                    expect(down.requests).toHaveLength(0);
                    await page.mouse.up();
                    const release = await sample(
                      page,
                      `${prefix}-release`,
                      control,
                      quality,
                      control === 'opaque' ? undefined : 'rest'
                    );
                    journey.push(release);
                    expect(release.states.pressed).toBe(false);
                    expect(release.requests).toHaveLength(1);
                    await page.mouse.move(0, 0);
                    const leave = await sample(
                      page,
                      `${prefix}-leave`,
                      control,
                      quality,
                      control === 'opaque' ? undefined : 'rest'
                    );
                    journey.push(leave);
                    expect(leave.states.hovered).toBe(false);
                    expect(leave.states.pressed).toBe(false);
                    for (const observed of [hover, down, release, leave])
                      expect({
                        width: observed.geometry.width,
                        height: observed.geometry.height,
                      }).toEqual({ width: idle.geometry.width, height: idle.geometry.height });
                  }
                  if (!checkpointFinalized && coverage.get(name)?.status === 'running')
                    behaviorCoverage.set(name, 'passed');
                  const pairs: unknown[] = [];
                  for (const source of PROMINENT_TINT_SOURCES) {
                    const frames = new Map<TintControl, Awaited<ReturnType<typeof sample>>[]>();
                    for (const phase of [0, 1] as const) {
                      await page.mouse.move(0, 0);
                      await page.locator('[data-tint-focus="neutral"]').focus();
                      await call(page, 'paint', source, phase);
                      for (const control of PROMINENT_TINT_CONTROLS) {
                        const row = await sample(
                          page,
                          `${name}-${source}-${phase}-${control}`,
                          control,
                          control === 'opaque' ? 'opaque-fallback' : 'self-optical',
                          control === 'opaque' ? undefined : 'rest'
                        );
                        frames.set(control, [...(frames.get(control) ?? []), row]);
                      }
                    }
                    const measured = Object.fromEntries(
                      PROMINENT_TINT_CONTROLS.map((control) => {
                        const [a, b] = frames.get(control)!;
                        if (!a.sourceCrop || !b.sourceCrop)
                          throw new Error('Missing actual source crop');
                        expect(a.geometry).toEqual(b.geometry);
                        expect(a.cells).toEqual(b.cells);
                        expect(a.snapshot.receipt.contact).toBe(b.snapshot.receipt.contact);
                        expect(a.snapshot.receipt.contactSession).toBe(
                          b.snapshot.receipt.contactSession
                        );
                        expect(a.snapshot.receipt.profile).toBe(b.snapshot.receipt.profile);
                        expect(a.snapshot.motion).toBe(b.snapshot.motion);
                        expect(a.snapshot.phase).toBe(b.snapshot.phase);
                        expect(a.snapshot.foreground).toEqual(b.snapshot.foreground);
                        expect(a.source!.pixelSha256).not.toBe(b.source!.pixelSha256);
                        return [
                          control,
                          measureProminentTintPair(
                            [a.sourceCrop, b.sourceCrop],
                            [a.image, b.image],
                            a.cells
                          ),
                        ];
                      })
                    ) as Record<TintControl, ReturnType<typeof measureProminentTintPair>>;
                    for (const control of PROMINENT_TINT_CONTROLS)
                      opticalCoverage.set(
                        `${name}-${source}-${control}`,
                        control === 'opaque'
                          ? `negative-control-${measured[control].status}`
                          : measured[control].status
                      );
                    const classification = classifyProminentTintEvidence(
                      measured.neutral,
                      measured.tinted,
                      measured.opaque,
                      source === 'chromatic-regions'
                    );
                    const result = {
                      ...revision,
                      name,
                      source,
                      classification,
                      controls: measured,
                      registration:
                        'each control to its own fixed host/source crop; no neutral-to-primary fitting',
                      neutralLimit:
                        'different foreground mapping; Form Reset has its own action, name and intrinsic geometry',
                      visualAcceptance: 'pending manual actual-size review',
                    };
                    pairs.push(result);
                    results.push(result);
                    await json(`${name}-${source}-pair`, result);
                    expect(classification.status).not.toBe('invalid-control');
                    expect(classification.status).not.toBe('failed');
                    if (source === 'gray-boundary') expect(classification.status).toBe('passed');
                  }
                  await json(`${name}-summary`, {
                    ...revision,
                    ...PROMINENT_TINT_OBSERVATION_PROGRESS,
                    journey: journey.length,
                    pairs,
                    visualAcceptance: 'inconclusive/diagnostic-only are not visually accepted',
                  });
                } finally {
                  await context.close();
                }
              }),
            120_000
          );
        });
      }
      const name = `${runtime}-${theme}-${part}-preferences`;
      coverage.set(name, { status: 'not-run' });
      behaviorCoverage.set(name, 'not-run');
      describe(name, () => {
        it.skipIf(!includeLiquidWip)(
          'separates focus, preferences, unsafe source, cancellation and recovery',
          () =>
            runCase(name, async () => {
              const { context, page, cdp } = await open(runtime, theme, part, 'text'),
                control = 'tinted' as const,
                el = target(page, control);
              let index = 0;
              const stages = prominentTintPreferenceStages(part);
              const take = (stage: string, quality = 'self-optical', contact?: string) => {
                if (stages[index] !== stage)
                  throw new Error(`Preference stage diverged from planned checkpoint: ${stage}`);
                return sample(page, `${name}-${index++}-${stage}`, control, quality, contact);
              };
              try {
                await page.locator('[data-tint-focus="tinted"]').focus();
                await page.keyboard.press('Tab');
                const focus = await take('focus');
                expect(focus.states.focusVisible).toBe(true);
                expect(focus.raw.activeElement).toBe(true);
                expect(focus.raw.ringWidth).toBe('2px');
                await el.hover();
                await page.mouse.down();
                const held = await take('held', 'self-optical', 'held');
                const count = held.requests.length;
                await preferences(cdp, theme, { 'prefers-reduced-motion': 'reduce' });
                const reduced = await take('reduced-motion-held');
                expect(reduced.snapshot.motion).toBe('static');
                expect(reduced.snapshot.receipt.contact).toBe('rest');
                await page.mouse.up();
                expect((await take('reduced-motion-release')).states.pressed).toBe(false);
                await preferences(cdp, theme);
                await el.hover();
                await page.mouse.down();
                await take('unknown-motion-before-held', 'self-optical', 'held');
                await page.evaluate(() =>
                  (window as any).tintUnknownPreference('prefers-reduced-motion')
                );
                const unknownHeld = await take('synthetic-unknown-motion-held');
                expect(unknownHeld.snapshot.motion).toBe('static');
                expect(unknownHeld.snapshot.receipt.contact).toBe('rest');
                await page.mouse.up();
                expect((await take('unknown-motion-release')).states.pressed).toBe(false);
                await page.evaluate(() => (window as any).tintUnknownPreference(null));
                await page.locator('[data-tint-focus="tinted"]').focus();
                await page.keyboard.press('Tab');
                for (const [feature, value] of [
                  ['prefers-reduced-transparency', 'reduce'],
                  ['prefers-contrast', 'more'],
                  ['forced-colors', 'active'],
                ] as const) {
                  await preferences(cdp, theme, { [feature]: value });
                  const fallback = await take(feature, 'opaque-fallback');
                  expect(fallback.states.focusVisible).toBe(true);
                  if (feature === 'forced-colors') {
                    expect(fallback.raw.outline.style).toBe('solid');
                    expect(parseFloat(fallback.raw.outline.width)).toBeGreaterThanOrEqual(2);
                  }
                  await preferences(cdp, theme);
                  await call(page, 'paint', 'pastel', 0);
                  await take(`${feature}-recovered`);
                }
                for (const feature of [
                  'prefers-reduced-motion',
                  'prefers-reduced-transparency',
                  'prefers-contrast',
                  'forced-colors',
                ]) {
                  await page.evaluate(
                    (feature) => (window as any).tintUnknownPreference(feature),
                    feature
                  );
                  const unknown = await take(
                    `synthetic-unknown-${feature}`,
                    feature === 'prefers-reduced-motion' ? 'self-optical' : 'opaque-fallback'
                  );
                  if (feature === 'prefers-reduced-motion') {
                    expect(unknown.snapshot.motion).toBe('static');
                    expect(unknown.snapshot.receipt.contact).toBe('rest');
                  }
                  await page.evaluate(() => (window as any).tintUnknownPreference(null));
                  await call(page, 'paint', 'pastel', 0);
                  await take(`unknown-${feature}-recovered`);
                }
                await call(page, 'unsafe', control, true);
                await call(page, 'paint', 'pastel', 0);
                await take('unsafe-source', 'opaque-fallback');
                await call(page, 'unsafe', control, false);
                await call(page, 'paint', 'pastel', 0);
                await take('unsafe-recovered');
                await call(page, 'sourceAvailable', control, false);
                await take('missing-source', 'opaque-fallback');
                await call(page, 'sourceAvailable', control, true);
                await call(page, 'paint', 'pastel', 0);
                await take('source-recovered');
                // Explicit synthetic cancellation is labeled separately from native input.
                await el.hover();
                await page.mouse.down();
                await take('cancel-held', 'self-optical', 'held');
                const before = (await call(page, 'requests', control)).length;
                await runProminentTintSyntheticCancel({
                  target: el,
                  mouse: page.mouse,
                  assertCancelled: async () => {
                    const cancel = await take('injected-cancel', 'self-optical', 'rest');
                    expect(cancel.states.pressed).toBe(false);
                    expect(cancel.requests).toHaveLength(before);
                  },
                  assertReleasedOutside: async () => {
                    expect((await call(page, 'requests', control)).length).toBe(before);
                  },
                });
                for (const ref of part === 'submit' ? ['subject', 'owner'] : ['subject']) {
                  await el.hover();
                  await page.mouse.down();
                  await take(`${ref}-disable-held`, 'self-optical', 'held');
                  const previous = (await call(page, 'requests', control)).length;
                  await call(page, 'setProps', control, ref, { disabled: true });
                  const disabled = await take(`${ref}-disabled`, 'opaque-fallback');
                  expect(disabled.states.disabled).toBe(true);
                  expect(disabled.states.pressed).toBe(false);
                  await page.mouse.up();
                  expect((await call(page, 'requests', control)).length).toBe(previous);
                  await call(page, 'removeProp', control, ref, 'disabled');
                  await page.mouse.move(0, 0);
                  await take(`${ref}-reenabled`, 'self-optical', 'rest');
                }
                await call(page, 'setProps', control, 'subject', { material: 'opaque' });
                await take('explicit-opaque', 'opaque-fallback');
                await call(page, 'removeProp', control, 'subject', 'material');
                await call(page, 'paint', 'pastel', 1);
                await take('auto-restored');
                await call(page, 'dispose');
                expect(await page.locator('[data-demo-ref="subject"]').count()).toBe(0);
                await page.reload({ waitUntil: 'networkidle' });
                await page.waitForFunction(
                  () => document.documentElement.dataset.prominentTintReady === 'true'
                );
                await take('remounted');
                await json(`${name}-summary`, {
                  ...revision,
                  ...PROMINENT_TINT_OBSERVATION_PROGRESS,
                  captures: index,
                  initialRequests: count,
                  preferenceProvenance:
                    'CDP media emulation; unknown categories explicitly synthetic matchMedia capability probes',
                  cancellationProvenance:
                    'Synthetic DOM pointercancel checked before native outside release; not browser/OS-generated cancellation evidence',
                });
              } finally {
                await context.close();
              }
            }),
          120_000
        );
      });
    }
