import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Supplementary, source-bound browser observations, not a replacement for the
// material acceptance suites or a physical 120 Hz / input-to-photon claim.
const FIXTURE = '/en/test/liquid-glass-material/';
const PUBLIC = '/zh-cn/ui-libraries/liquid-glass/button/';
const TARGET = '[data-material-host="wc"] [data-demo-ref="regular"]';
const MODES = ['static-idle', 'static-contact', 'dynamic-idle', 'dynamic-contact'];
const VIEWPORT = { width: 1000, height: 1050 };
const SOURCE_FILES = [
  'pnpm-lock.yaml',
  'packages/adapters/base/src/material/program.ts',
  'packages/adapters/base/src/material/program-pool.ts',
  'packages/adapters/base/src/material/source.ts',
  'packages/adapters/base/src/material/sink.ts',
  'packages/adapters/base/src/material/contact-profile.ts',
  'packages/adapters/base/src/material/contact-motion.ts',
  'packages/adapters/base/src/material/contact-carrier.ts',
  'packages/adapters/base/src/material/style-tint-profile.ts',
  'packages/adapters/base/src/material/liquidgl-kernel.generated.ts',
  'packages/adapters/base/src/material/image-prepare.ts',
  'apps/www/src/components/PrototypePreviewer/preview-material-scene.ts',
  'apps/www/src/components/PrototypePreviewer/demo-renderer.ts',
  'apps/www/src/pages/en/test/liquid-glass-material.astro',
  'apps/www/src/content/docs/zh-cn/browser-harness.ts',
  'apps/www/src/content/docs/zh-cn/material-paint-observation.ts',
  // Public presentation intentionally changes between revisions. Bind these
  // bytes to each report without requiring equality with the workload fixture.
  'apps/www/src/content/docs/demo_components/liquid-glass/demo-liquid-glass-button.demo.ts',
  'apps/www/src/content/docs/en/ui-libraries/liquid-glass/button.mdx',
  'apps/www/src/content/docs/zh-cn/ui-libraries/liquid-glass/button.mdx',
];
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export function distribution(values) {
  if (!values.length) return null;
  assert.ok(values.every(Number.isFinite), 'Non-finite timing observation');
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (p) => {
    const position = (sorted.length - 1) * p;
    const lower = Math.floor(position);
    return sorted[lower] + (sorted[Math.ceil(position)] - sorted[lower]) * (position - lower);
  };
  return {
    count: sorted.length,
    mean: sorted.reduce((a, b) => a + b, 0) / sorted.length,
    p50: percentile(0.5),
    p95: percentile(0.95),
    p99: percentile(0.99),
    max: sorted.at(-1),
  };
}

function deltas(before, after) {
  return Object.fromEntries(
    Object.keys(before)
      .filter((key) => typeof before[key] === 'number' && typeof after[key] === 'number')
      .map((key) => [key, after[key] - before[key]])
  );
}

function publicButtons(capture) {
  return (capture.paints ?? []).filter(
    (entry) =>
      entry.host?.role === 'button' &&
      entry.host.dataset?.projectionPrototype === 'liquid-glass-button'
  );
}

/** Candidate-only acceptance. The baseline's original fallback stays visible. */
export function assertCandidatePublicCaptures(captures) {
  assert.deepEqual(
    captures.map((capture) => capture.name).sort(),
    ['public-dark', 'public-light', 'public-small'],
    'All three candidate public views must be captured exactly once'
  );
  for (const capture of captures) {
    assert.ok(!capture.failure, `${capture.name}: ${capture.failure}`);
    const buttons = publicButtons(capture);
    assert.equal(
      buttons.length,
      3,
      `${capture.name}: expected the three real Liquid Glass buttons`
    );
    const named = new Map(buttons.map((entry) => [entry.host.text.trim(), entry]));
    assert.deepEqual([...named.keys()].sort(), ['Back', 'Continue', 'Unavailable']);
    for (const name of ['Back', 'Continue']) {
      const entry = named.get(name);
      assert.ok(
        !entry.host.disabled && entry.host.ariaDisabled !== 'true',
        `${capture.name}: ${name} must be enabled`
      );
      assert.equal(entry.quality, 'self-optical', `${capture.name}: ${name} must be self-optical`);
      assert.equal(entry.committed, true, `${capture.name}: ${name} needs committed owned paint`);
      assert.equal(
        entry.carrier,
        'contact-v1',
        `${capture.name}: ${name} needs its owned contact carrier`
      );
      assert.equal(entry.source, 'visible-app-canvas');
      assert.equal(entry.geometryMatches, true);
    }
    const unavailable = named.get('Unavailable');
    assert.ok(
      unavailable.host.disabled || unavailable.host.ariaDisabled === 'true',
      `${capture.name}: Unavailable must expose disabled semantics`
    );
    assert.equal(unavailable.quality, 'opaque-fallback');
    assert.equal(unavailable.host.dataset.materialReason, 'no-active-material-candidate');
    assert.equal(
      unavailable.committed,
      false,
      `${capture.name}: disabled fallback must not retain optical paint`
    );
    // Invalid carrier geometry/opacity also makes committed false. Prove the
    // owned marker and its sampled image have actually been withdrawn.
    assert.equal(
      unavailable.carrier,
      null,
      `${capture.name}: disabled fallback retained a carrier`
    );
    assert.equal(
      unavailable.imageSha256,
      sha256('none'),
      `${capture.name}: disabled fallback retained a background image`
    );
    assert.equal(unavailable.imageCharacters, 4, `${capture.name}: disabled image must be none`);
  }
}

export function summarizeWindow(window) {
  const { sample, before, after } = window;
  const elapsed = sample.end - sample.start;
  const commits = sample.commits.filter((entry) => entry.quality === 'self-optical');
  // A fresh contact session establishes down -> held ownership. A next frame
  // after pointermove does not identify which coordinate it rendered: retain
  // those as explicitly non-causal opportunities and report coalescing counts.
  const starts = sample.inputs.filter((entry) => entry.type === 'pointerdown');
  const matchedStarts = starts.map((input) => ({
    input,
    commit: commits.find(
      (entry) =>
        entry.time >= input.time &&
        entry.contact === 'held' &&
        Number(entry.session) > Number(input.session)
    ),
  }));
  const moves = sample.inputs.filter((entry) => entry.type === 'pointermove');
  const opportunities = moves.map((input) => ({
    input,
    commit: commits.find(
      (entry) =>
        entry.time >= input.time && entry.contact === 'held' && entry.session === input.session
    ),
  }));
  const resources = deltas(before.resources, after.resources);
  return {
    round: window.round,
    mode: window.mode,
    durationMs: elapsed,
    rafIntervalMs: distribution(
      sample.raf.slice(1).map((entry, i) => entry.timestamp - sample.raf[i].timestamp)
    ),
    rafCallbacksPerSecond: (sample.raf.length * 1000) / elapsed,
    materialCommitIntervalMs: distribution(
      commits.slice(1).map((entry, i) => entry.time - commits[i].time)
    ),
    materialCommitsPerSecond: (commits.length * 1000) / elapsed,
    contactStartListenerToHeldCommitMs: distribution(
      matchedStarts
        .filter((entry) => entry.commit)
        .map(({ input, commit }) => commit.time - input.time)
    ),
    contactStartEventTimestampToHeldCommitMs: distribution(
      matchedStarts
        .filter(
          ({ input, commit }) => commit && input.timestamp >= 0 && input.timestamp <= input.time
        )
        .map(({ input, commit }) => commit.time - input.timestamp)
    ),
    unresolvedContactStarts: matchedStarts.filter((entry) => !entry.commit).length,
    dragEventToNextHeldCommitOpportunityMs: distribution(
      opportunities
        .filter((entry) => entry.commit)
        .map(({ input, commit }) => commit.time - input.time)
    ),
    dragInputs: moves.length,
    dragInputsWithoutLaterHeldCommit: opportunities.filter((entry) => !entry.commit).length,
    distinctHeldCommitsFollowingDrag: new Set(
      opportunities.filter((entry) => entry.commit).map((entry) => entry.commit.frame)
    ).size,
    observedDragInputIntervalMs: distribution(
      moves.slice(1).map((entry, i) => entry.time - moves[i].time)
    ),
    untrustedInputs: sample.inputs.filter((entry) => !entry.trusted).length,
    nonOpticalStates: sample.states.filter((entry) => entry.quality !== 'self-optical'),
    longTaskMs: distribution(sample.longtasks.map((entry) => entry.duration)),
    resourceDelta: resources,
    // Existing renderMilliseconds includes encodeMilliseconds. Do not add them.
    meanRenderIncludingEncodeMs:
      resources.renders > 0 ? resources.renderMilliseconds / resources.renders : null,
    meanEncodeMs: resources.renders > 0 ? resources.encodeMilliseconds / resources.renders : null,
    browserMainThreadDelta: deltas(window.browserBefore, window.browserAfter),
  };
}

async function compare(baselineFile, candidateFile, output) {
  await mkdir(output, { recursive: true });
  const baseline = JSON.parse(await readFile(baselineFile, 'utf8'));
  const candidate = JSON.parse(await readFile(candidateFile, 'utf8'));
  let publicAcceptance;
  try {
    assertCandidatePublicCaptures(candidate.public);
    publicAcceptance = { passed: true };
  } catch (error) {
    // Retain the rejected captures and comparison before returning a failure.
    publicAcceptance = { passed: false, message: String(error) };
  }
  const matched =
    baseline.probe.sha256 === candidate.probe.sha256 &&
    JSON.stringify(baseline.workload) === JSON.stringify(candidate.workload) &&
    baseline.environment.browser === candidate.environment.browser &&
    baseline.environment.node === candidate.environment.node &&
    baseline.source.hashes['pnpm-lock.yaml'] === candidate.source.hashes['pnpm-lock.yaml'] &&
    [
      'apps/www/src/pages/en/test/liquid-glass-material.astro',
      'packages/adapters/base/src/material/liquidgl-kernel.generated.ts',
    ].every((file) => baseline.source.hashes[file] === candidate.source.hashes[file]);
  const result = {
    sameProbeWorkloadBrowserLockfileAndFixture: matched,
    limitations: candidate.limitations,
    baseline: {
      source: baseline.source,
      environment: baseline.environment,
      failures: baseline.failures,
      windows: baseline.windows.map(summarizeWindow),
      runtimeSmoke: baseline.runtimeSmoke,
      public: baseline.public,
    },
    candidate: {
      source: candidate.source,
      environment: candidate.environment,
      failures: candidate.failures,
      windows: candidate.windows.map(summarizeWindow),
      runtimeSmoke: candidate.runtimeSmoke,
      public: candidate.public,
      publicAcceptance,
    },
  };
  await writeFile(path.join(output, 'comparison.json'), JSON.stringify(result, null, 2));
  const number = (value) => (value == null ? 'unmeasured' : value.toFixed(2));
  const lines = [
    '# Liquid Glass matched browser observations',
    '',
    `Baseline: \`${baseline.source.sha}\`; candidate: \`${candidate.source.sha}\`.`,
    '',
    `Matched probe, workload, browser, lockfile and fixture: **${matched}**.`,
    '',
    'These are application observations on the recorded runner. RAF callbacks are not displayed frames; a material commit follows image decode but precedes compositor presentation. No physical 120 Hz or 10 ms input-to-photon acceptance is inferred.',
    '',
    '| Revision | Round | Workload | RAF p95 ms | Material interval p95 ms | Down → held commit ms | Mean render incl. encode ms | Mean encode ms |',
    '|---|---:|---|---:|---:|---:|---:|---:|',
  ];
  for (const [label, report] of [
    ['baseline', result.baseline],
    ['candidate', result.candidate],
  ]) {
    for (const row of report.windows)
      lines.push(
        `| ${label} | ${row.round} | ${row.mode} | ${number(row.rafIntervalMs?.p95)} | ${number(row.materialCommitIntervalMs?.p95)} | ${number(row.contactStartListenerToHeldCommitMs?.p95)} | ${number(row.meanRenderIncludingEncodeMs)} | ${number(row.meanEncodeMs)} |`
      );
  }
  for (const [label, report] of [
    ['baseline', result.baseline],
    ['candidate', result.candidate],
  ]) {
    lines.push('', `## ${label} public captures and interaction smoke`, '');
    for (const capture of report.public) {
      const buttons = publicButtons(capture);
      lines.push(
        `- ${capture.name}: ${buttons.filter((entry) => entry.committed && entry.quality === 'self-optical').length}/${buttons.length} Liquid Glass buttons have committed self-optical paint; ${capture.failure ?? 'capture completed'}.`
      );
    }
    if (report.publicAcceptance)
      lines.push(
        `- Candidate public acceptance: ${report.publicAcceptance.passed ? 'passed for both enabled buttons and disabled fallback in every view' : report.publicAcceptance.message}.`
      );
    for (const smoke of report.runtimeSmoke ?? [])
      lines.push(
        `- ${smoke.runtime} pointer smoke: ${smoke.failure ?? 'held optical paint, release and activation observed'}.`
      );
    for (const failure of report.failures)
      lines.push(`- Failure (${failure.stage}): ${failure.message}`);
  }
  await writeFile(path.join(output, 'comparison.md'), `${lines.join('\n')}\n`);
  assert.ok(matched, 'The before/after probe, workload, environment or source fixture differs');
  assert.equal(baseline.source.sha, '543c8a2990239dec7c08458a902da3f5a97b49dd');
  if (process.env.CANDIDATE_SHA) assert.equal(candidate.source.sha, process.env.CANDIDATE_SHA);
  for (const report of [baseline, candidate]) {
    assert.equal(report.failures.length, 0, `Evidence failures for ${report.source.sha}`);
    assert.equal(
      report.windows.length,
      report.workload.rounds * MODES.length,
      'Incomplete workload'
    );
    assert.equal(report.runtimeSmoke.length, 4, 'Incomplete runtime interaction smoke');
  }
  assert.ok(publicAcceptance.passed, publicAcceptance.message);
}

async function observe(output, rounds) {
  assert.ok(Number.isInteger(rounds) && rounds >= 1 && rounds <= 5, 'rounds must be 1..5');
  assert.ok(
    !process.env.PROTO_UI_BROWSER_BASE_URL,
    'Exact-source observations must use the owned local harness'
  );
  await mkdir(output, { recursive: true });
  const root = process.cwd();
  const git = (...args) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', timeout: 5000 }).trim();
  const report = {
    schemaVersion: 1,
    started: new Date().toISOString(),
    source: {
      sha: git('rev-parse', 'HEAD'),
      tree: git('rev-parse', 'HEAD^{tree}'),
      changes: git('status', '--short'),
      hashes: {},
    },
    probe: { sha256: sha256(await readFile(fileURLToPath(import.meta.url))) },
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      osRelease: os.release(),
      cpus: os.cpus().length,
      headless: true,
    },
    workload: {
      route: FIXTURE,
      target: TARGET,
      viewport: VIEWPORT,
      dpr: 1,
      rounds,
      modes: MODES,
      idleMs: 2000,
      dragMoves: 120,
      requestedDragSpacingMs: 1000 / 120,
      surfaces:
        'Four real adapters; target WC Regular. Resource counters cover the whole document.',
    },
    limitations: [
      'Headless runner: physical refresh, displayed FPS and input-to-photon latency are unmeasured.',
      'Input is Playwright trusted pointer input. Event timestamp and listener time exclude hardware transport; materialFrame publication is after image decode/install, before compositor presentation.',
      'Pointermove to next held commit is a many-to-one observation, not proof of the rendered coordinate. Superseded/missing inputs and distinct commits remain visible.',
      'Diagnostic background changes at its existing 120 ms cadence. Static/dynamic measurements are separate from the public preview visual changes.',
      'Existing source counters are document-wide cumulative totals, not GPU timer queries. Missing baseline stage timings remain absent rather than zero.',
      'Fixed 1000 px viewport naturally wraps the official fixture. Original 1440 px layout is separately retained, including any fallback and overlap geometry.',
      'Same-runner sequential baseline then candidate reduces environment differences but does not remove thermal, scheduling or warmup variance.',
    ],
    failures: [],
    runtimeSmoke: [],
    windows: [],
    public: [],
    logs: [],
  };
  for (const file of SOURCE_FILES)
    report.source.hashes[file] = sha256(await readFile(path.join(root, file)));
  const save = () => writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  const failure = (stage, error) => report.failures.push({ stage, message: String(error) });
  const { startServer, stopServer, launchBrowser } = await import(
    pathToFileURL(path.join(root, 'apps/www/src/content/docs/zh-cn/browser-harness.ts')).href
  );
  const { observeOwnedMaterialPaint } = await import(
    pathToFileURL(path.join(root, 'apps/www/src/content/docs/zh-cn/material-paint-observation.ts'))
      .href
  );
  let browser, baseUrl;
  let interrupt;
  const interrupted = new Promise((_, reject) => {
    interrupt = () =>
      reject(new Error('Probe interrupted; owned browser/server teardown requested'));
  });
  process.once('SIGTERM', interrupt);
  process.once('SIGINT', interrupt);

  async function pageFor(viewport, theme, route) {
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: 1,
      colorScheme: theme,
      serviceWorkers: 'block',
    });
    await context.route('**/*', (request) =>
      new URL(request.request().url()).origin === new URL(baseUrl).origin
        ? request.continue()
        : request.abort()
    );
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);
    page.on('pageerror', (error) =>
      report.logs.push({ route, kind: 'pageerror', message: String(error) })
    );
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setEmulatedMedia', {
      features: Object.entries({
        'prefers-color-scheme': theme,
        'prefers-reduced-motion': 'no-preference',
        'prefers-reduced-transparency': 'no-preference',
        'prefers-contrast': 'no-preference',
        'forced-colors': 'none',
      }).map(([name, value]) => ({ name, value })),
    });
    await cdp.send('Performance.enable');
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle', timeout: 60_000 });
    return { context, page, cdp };
  }
  async function paint(locator) {
    const observation = await locator.evaluate(observeOwnedMaterialPaint);
    const { image, ...facts } = observation;
    const host = await locator.evaluate((element) => ({
      text: element.textContent,
      dataset: { ...element.dataset },
      role: element.getAttribute('role'),
      disabled: element.hasAttribute('disabled'),
      ariaDisabled: element.getAttribute('aria-disabled'),
    }));
    return { ...facts, host, imageSha256: sha256(image), imageCharacters: image.length };
  }
  async function snapshot(page) {
    const facts = await page.evaluate((selector) => {
      const target = document.querySelector(selector);
      const rect = (element) => {
        const r = element.getBoundingClientRect();
        return {
          left: r.left,
          top: r.top,
          right: r.right,
          bottom: r.bottom,
          width: r.width,
          height: r.height,
        };
      };
      const control = (element) => ({
        tag: element.tagName,
        text: element.textContent,
        dataset: { ...element.dataset },
        rect: rect(element),
      });
      return {
        ready: document.documentElement.dataset.materialReady,
        error: document.documentElement.dataset.materialError ?? null,
        resources: window.liquidMaterialFixture?.metrics() ?? {},
        target: target ? control(target) : null,
        controls: [...document.querySelectorAll('[data-material-quality]')].map(control),
        // Includes zero-height boxes: the original conservative guard remains unchanged.
        sceneGeometry: [
          ...(target?.closest('[data-material-scene]')?.querySelectorAll('*') ?? []),
        ].map((element) => ({
          tag: element.tagName,
          dataset: { ...element.dataset },
          rect: rect(element),
        })),
      };
    }, TARGET);
    if (facts.target) facts.paint = await paint(page.locator(TARGET));
    return facts;
  }
  async function fixtureReady(page) {
    await page.waitForFunction(
      () =>
        document.documentElement.dataset.materialReady === 'true' ||
        !!document.documentElement.dataset.materialError
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.dataset.materialError ?? null),
      null
    );
  }
  async function opticalRest(page, selector = TARGET) {
    await page.waitForFunction((selector) => {
      const node = document.querySelector(selector);
      return (
        node?.dataset.materialQuality === 'self-optical' &&
        node.dataset.materialContact === 'rest' &&
        window.liquidMaterialFixture.metrics().pendingImages === 0
      );
    }, selector);
    assert.ok(
      (await paint(page.locator(selector))).committed,
      'Owned optical carrier is not committed'
    );
  }

  async function runtimeSmoke() {
    const { context, page } = await pageFor(VIEWPORT, 'light', FIXTURE);
    try {
      await fixtureReady(page);
      await page.evaluate(() => window.liquidMaterialFixture.pause(true));
      for (const runtime of ['wc', 'react', 'vue', 'vue2']) {
        const result = {
          runtime,
          scope: 'One trusted down/held/up/rest/activation smoke; not a runtime latency benchmark',
        };
        report.runtimeSmoke.push(result);
        const selector = `[data-material-host="${runtime}"] [data-demo-ref="regular"]`;
        const target = page.locator(selector);
        try {
          await target.scrollIntoViewIfNeeded();
          await opticalRest(page, selector);
          result.before = await paint(target);
          const priorSession = result.before.host.dataset.materialContactSession;
          await target.evaluate((element) => {
            window.__liquidSmokeInputs = [];
            for (const type of ['pointerdown', 'pointerup'])
              element.addEventListener(
                type,
                (event) =>
                  window.__liquidSmokeInputs.push({ type: event.type, trusted: event.isTrusted }),
                { once: true, capture: true }
              );
          });
          const bounds = await target.boundingBox();
          assert.ok(bounds);
          await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
          await page.mouse.down();
          await page.waitForFunction(
            ({ selector, priorSession }) => {
              const node = document.querySelector(selector);
              return (
                node?.dataset.materialQuality === 'self-optical' &&
                node.dataset.materialContact === 'held' &&
                Number(node.dataset.materialContactSession) > Number(priorSession)
              );
            },
            { selector, priorSession }
          );
          result.held = await paint(target);
          assert.ok(result.held.committed);
          await page
            .locator(`[data-material-host="${runtime}"]`)
            .screenshot({ path: path.join(output, `smoke-${runtime}-held.png`), timeout: 5000 });
          await page.mouse.up();
          await opticalRest(page, selector);
          result.after = await paint(target);
          result.inputs = await page.evaluate(() => window.__liquidSmokeInputs);
          assert.deepEqual(result.inputs, [
            { type: 'pointerdown', trusted: true },
            { type: 'pointerup', trusted: true },
          ]);
          result.activations = await page.locator(`[data-activations="${runtime}"]`).textContent();
          assert.equal(result.activations, '1 activations');
        } catch (error) {
          result.failure = String(error);
          result.lastPaint = await paint(target).catch((error) => ({ failure: String(error) }));
          failure(`runtime-smoke-${runtime}`, error);
          await page.mouse.up().catch(() => {});
        }
        await save();
      }
    } finally {
      await context.close();
    }
  }

  async function layoutControl() {
    const { context, page } = await pageFor({ width: 1440, height: 1050 }, 'light', FIXTURE);
    try {
      await fixtureReady(page);
      // A defined observation window, not a retry to manufacture optical admission.
      await page.waitForTimeout(1000);
      report.originalLayout = await snapshot(page);
      await page.screenshot({
        path: path.join(output, 'original-1440-layout.png'),
        fullPage: true,
        timeout: 5000,
      });
      await save();
    } finally {
      await context.close();
    }
  }

  async function workload() {
    const { context, page, cdp } = await pageFor(VIEWPORT, 'light', FIXTURE);
    try {
      await fixtureReady(page);
      report.workloadInitial = await snapshot(page);
      await page.evaluate(() => window.liquidMaterialFixture.pause(true));
      await opticalRest(page);
      const target = page.locator(TARGET);
      const bounds = await target.boundingBox();
      assert.ok(bounds);
      const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
      await page.mouse.move(center.x, center.y);
      await page.mouse.down();
      await page.waitForFunction(
        (selector) => document.querySelector(selector)?.dataset.materialContact === 'held',
        TARGET
      );
      await page.mouse.up();
      await opticalRest(page);
      await page.screenshot({
        path: path.join(output, 'matched-1000-optical.png'),
        fullPage: true,
        timeout: 5000,
      });
      const browserMetrics = async () =>
        Object.fromEntries(
          (await cdp.send('Performance.getMetrics')).metrics.map(({ name, value }) => [name, value])
        );
      for (let round = 1; round <= rounds; round++) {
        for (const mode of MODES) {
          const dynamic = mode.startsWith('dynamic');
          await page.evaluate(() => window.liquidMaterialFixture.pause(true));
          await opticalRest(page);
          await page.mouse.move(center.x, center.y);
          if (dynamic) {
            const revision = await target.getAttribute('data-material-source-revision');
            await page.evaluate(() => window.liquidMaterialFixture.pause(false));
            await page.waitForFunction(
              ({ selector, revision }) =>
                Number(document.querySelector(selector)?.dataset.materialSourceRevision) >
                Number(revision),
              { selector: TARGET, revision }
            );
          }
          const before = await snapshot(page);
          assert.equal(before.paint.quality, 'self-optical');
          assert.ok(before.paint.committed);
          const browserBefore = await browserMetrics();
          await page.evaluate((selector) => {
            const target = document.querySelector(selector);
            const state = {
              start: performance.now(),
              raf: [],
              commits: [],
              states: [],
              inputs: [],
              longtasks: [],
            };
            let active = true,
              raf,
              lastFrame = target.dataset.materialFrame;
            const status = () => ({
              time: performance.now(),
              quality: target.dataset.materialQuality,
              reason: target.dataset.materialReason,
              frame: target.dataset.materialFrame,
              sourceRevision: target.dataset.materialSourceRevision,
              contact: target.dataset.materialContact,
              session: target.dataset.materialContactSession,
            });
            state.states.push(status());
            const tick = (timestamp) => {
              if (!active) return;
              state.raf.push({ timestamp, observedAt: performance.now() });
              raf = requestAnimationFrame(tick);
            };
            raf = requestAnimationFrame(tick);
            const input = (event) => {
              if (event.type === 'pointermove' && !event.buttons) return;
              state.inputs.push({
                ...status(),
                timestamp: event.timeStamp,
                type: event.type,
                trusted: event.isTrusted,
                x: event.clientX,
                y: event.clientY,
                buttons: event.buttons,
                pointerId: event.pointerId,
              });
            };
            for (const type of ['pointerdown', 'pointermove', 'pointerup'])
              target.addEventListener(type, input, true);
            const observer = new MutationObserver(() => {
              const entry = status();
              if (entry.frame !== lastFrame) {
                state.commits.push(entry);
                lastFrame = entry.frame;
              }
              if (
                entry.quality !== state.states.at(-1)?.quality ||
                entry.reason !== state.states.at(-1)?.reason
              )
                state.states.push(entry);
            });
            observer.observe(target, {
              attributes: true,
              attributeFilter: [
                'data-material-frame',
                'data-material-quality',
                'data-material-reason',
              ],
            });
            const tasks = PerformanceObserver.supportedEntryTypes.includes('longtask')
              ? new PerformanceObserver((list) => {
                  for (const entry of list.getEntries())
                    state.longtasks.push({ start: entry.startTime, duration: entry.duration });
                })
              : null;
            tasks?.observe({ entryTypes: ['longtask'] });
            window.__liquidFrameBudgetStop = () => {
              state.end = performance.now();
              active = false;
              cancelAnimationFrame(raf);
              observer.disconnect();
              for (const entry of tasks?.takeRecords() ?? [])
                state.longtasks.push({ start: entry.startTime, duration: entry.duration });
              tasks?.disconnect();
              for (const type of ['pointerdown', 'pointermove', 'pointerup'])
                target.removeEventListener(type, input, true);
              delete window.__liquidFrameBudgetStop;
              return state;
            };
          }, TARGET);
          if (mode.endsWith('contact')) {
            await page.mouse.down();
            for (let move = 0; move < report.workload.dragMoves; move++) {
              await page.mouse.move(
                center.x + Math.sin((move * Math.PI) / 30) * bounds.width * 0.25,
                center.y + Math.cos((move * Math.PI) / 30) * bounds.height * 0.2
              );
              await page.waitForTimeout(report.workload.requestedDragSpacingMs);
            }
            await page.mouse.up();
            await page.waitForFunction(
              (selector) => document.querySelector(selector)?.dataset.materialContact === 'rest',
              TARGET
            );
          } else await page.waitForTimeout(report.workload.idleMs);
          const sample = await page.evaluate(() => window.__liquidFrameBudgetStop());
          const browserAfter = await browserMetrics();
          const after = await snapshot(page);
          const window = { round, mode, before, after, sample, browserBefore, browserAfter };
          window.summary = summarizeWindow(window);
          report.windows.push(window);
          await save();
          assert.equal(
            after.paint.quality,
            'self-optical',
            `${mode}: fallback is not optical performance`
          );
          assert.ok(after.paint.committed, `${mode}: missing owned optical paint`);
          assert.equal(
            window.summary.nonOpticalStates.length,
            0,
            `${mode}: optical admission was lost`
          );
          assert.equal(window.summary.untrustedInputs, 0, 'Input was not browser-trusted');
          if (mode.endsWith('contact')) {
            assert.equal(sample.inputs.filter((entry) => entry.type === 'pointerdown').length, 1);
            assert.equal(sample.inputs.filter((entry) => entry.type === 'pointerup').length, 1);
            assert.equal(
              window.summary.unresolvedContactStarts,
              0,
              `${mode}: no applied held contact session`
            );
            assert.ok(
              window.summary.dragInputs > 0 &&
                sample.commits.some((entry) => entry.contact === 'held')
            );
          }
          if (dynamic)
            assert.ok(
              Number(after.target.dataset.materialSourceRevision) >
                Number(before.target.dataset.materialSourceRevision),
              'Dynamic source did not advance'
            );
          console.log(JSON.stringify({ round, mode, summary: window.summary }));
        }
      }
      await page.evaluate(() => window.liquidMaterialFixture.dispose());
      report.cleanup = await page.evaluate(() => window.liquidMaterialFixture.metrics());
      assert.equal(report.cleanup.contexts, 0);
      assert.equal(report.cleanup.consumers, 0);
      assert.equal(report.cleanup.pendingImages, 0);
      assert.equal(report.cleanup.decodedImages, 0);
    } catch (error) {
      report.workloadFailureSnapshot = await snapshot(page).catch((error) => ({
        failure: String(error),
      }));
      await page
        .screenshot({
          path: path.join(output, 'workload-failure.png'),
          fullPage: true,
          timeout: 5000,
        })
        .catch(() => {});
      throw error;
    } finally {
      await context.close();
    }
  }

  async function publicCaptures() {
    for (const [name, theme, viewport] of [
      ['public-light', 'light', { width: 1440, height: 1050 }],
      ['public-dark', 'dark', { width: 1440, height: 1050 }],
      ['public-small', 'light', { width: 390, height: 844 }],
    ]) {
      const capture = { name, theme, viewport, route: PUBLIC, controls: 0, optical: 0 };
      report.public.push(capture);
      let context;
      try {
        const session = await pageFor(viewport, theme, PUBLIC);
        context = session.context;
        const page = session.page;
        const preview = page.locator('[data-adapter-panel="wc"] [data-previewer-id]').first();
        await preview.scrollIntoViewIfNeeded();
        await preview.locator('[data-material-quality]').first().waitFor();
        // Visual capture uses a declared one-second observation window, outside
        // the timed diagnostic workload. Fallback is retained, not hidden.
        await page.waitForTimeout(1000);
        capture.actualTheme = await page.locator('html').getAttribute('data-theme');
        capture.paints = [];
        const controls = preview.locator('[data-material-quality]');
        for (let index = 0; index < (await controls.count()); index++)
          capture.paints.push(await paint(controls.nth(index)));
        capture.materialHosts = capture.paints.length;
        const buttons = publicButtons(capture);
        capture.controls = buttons.length;
        capture.optical = buttons.filter(
          (entry) => entry.committed && entry.quality === 'self-optical'
        ).length;
        capture.screenshot = `${name}.png`;
        capture.screenshotSha256 = sha256(
          await preview.screenshot({ path: path.join(output, capture.screenshot), timeout: 5000 })
        );
        await page.screenshot({ path: path.join(output, `${name}-viewport.png`), timeout: 5000 });
        assert.equal(capture.actualTheme, theme, 'Requested theme was not active');
      } catch (error) {
        capture.failure = String(error);
        failure(name, error);
      } finally {
        await context?.close();
        await save();
      }
    }
  }

  try {
    await save();
    await Promise.race([
      interrupted,
      (async () => {
        baseUrl = await startServer([FIXTURE, PUBLIC]);
        browser = await launchBrowser();
        report.environment.browser = browser.version();
        const cdp = await browser.newBrowserCDPSession();
        report.environment.gpu = (await cdp.send('SystemInfo.getInfo')).gpu;
        const description = JSON.stringify(report.environment.gpu);
        report.environment.gpuClassification =
          /swiftshader|llvmpipe|lavapipe|software rasterizer/i.test(description)
            ? 'software'
            : 'unclassified; inspect recorded device and renderer strings';
        await cdp.detach();
        for (const [name, run] of [
          ['original-layout', layoutControl],
          ['runtime-smoke', runtimeSmoke],
          ['matched-workload', workload],
          ['public-captures', publicCaptures],
        ]) {
          try {
            await run();
          } catch (error) {
            failure(name, error);
            await save();
          }
        }
      })(),
    ]);
  } catch (error) {
    failure('setup-or-interruption', error);
  } finally {
    try {
      await browser?.close();
    } catch (error) {
      failure('browser-cleanup', error);
    }
    try {
      await stopServer();
    } catch (error) {
      failure('server-cleanup', error);
    }
    process.removeListener('SIGTERM', interrupt);
    process.removeListener('SIGINT', interrupt);
    report.ended = new Date().toISOString();
    await save();
  }
  assert.equal(
    report.failures.length,
    0,
    `Evidence failures retained in ${path.join(output, 'report.json')}`
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args[0] === '--compare' && args.length === 4)
    await compare(args[1], args[2], path.resolve(args[3]));
  else {
    assert.ok(
      args.length >= 1 && args.length <= 2,
      'Usage: node --import tsx liquid-glass-frame-budget.mjs OUTPUT [ROUNDS]\n       node liquid-glass-frame-budget.mjs --compare BASELINE_JSON CANDIDATE_JSON OUTPUT'
    );
    await observe(path.resolve(args[0]), Number(args[1] ?? 3));
  }
}
