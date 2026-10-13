// Actual Chrome screencast frames only: no synthesized intermediate images,
// CSS duration overrides, screenshot animation disabling, or external deployment.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  chromium,
  type BrowserContext,
  type CDPSession,
  type Page,
  type Locator,
} from 'playwright-core';
import {
  chromeExecutable,
  choosePreviewRuntime,
  startServer,
  stopServer,
} from '../src/content/docs/zh-cn/browser-harness';

const output = process.env.PUI_TRANSITION_OUTPUT;
assert(output, 'PUI_TRANSITION_OUTPUT is required');
assert.equal(
  process.env.GITHUB_ACTIONS,
  'true',
  'Actions-only: never launch a local native browser'
);
const revision = execFileSync('git', ['rev-parse', 'HEAD']).toString().trim();
const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}']).toString().trim();
assert.equal(revision, process.env.CANDIDATE_SHA, 'Capture exact candidate, not synthetic merge');
assert.equal(execFileSync('git', ['diff', '--exit-code']).length, 0);
assert.equal(execFileSync('git', ['diff', '--cached', '--exit-code']).length, 0);
assert(!process.env.PROTO_UI_BROWSER_BASE_URL, 'Must start the checked-out source server');
await mkdir(output, { recursive: true });
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const json = (file: string, value: unknown) =>
  writeFile(path.join(output, file), JSON.stringify(value, null, 2) + '\n');
const scenes = [
  { id: 'drawer', component: 'drawer', name: 'Open Drawer', role: 'button' },
  { id: 'select', component: 'select', name: 'Adapter selector', role: 'combobox' },
  { id: 'switch-default', component: 'switch', name: 'Email alerts', role: 'switch' },
  { id: 'switch-sm', component: 'switch', name: 'Small email alerts', role: 'switch' },
] as const;
const sceneId = process.env.PUI_TRANSITION_SCENE;
const selectedScenes = scenes.filter((scene) => scene.id === sceneId);
assert.equal(selectedScenes.length, 1, 'PUI_TRANSITION_SCENE must name exactly one reviewed scene');
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const failures: unknown[] = [];
const results: Record<string, unknown>[] = [];
let abortRemaining = false,
  runClosing = false;
const summary = async () => {
  try {
    await json('summary.json', { revision, tree, results, failures });
  } catch (error) {
    failures.push({ stage: 'summary-write', error: String(error) });
    console.error('[transition-recorder] summary write failed', error);
  }
};
// Derive source facts from this exact clean checkout, never a previous capture.
const drawerSource = await inspectDrawerSource();
try {
  // The harness owns three bounded readiness attempts and stops each failed server.
  // Do not race that retry loop: it could otherwise spawn again after our teardown.
  const baseUrl = await phase('run', 'server-start', () => startServer('/'));
  const executablePath = await chromeExecutable();
  browser = await phase(
    'run',
    'browser-launch',
    () =>
      chromium
        .launch({
          executablePath,
          headless: true,
          chromiumSandbox: true,
          args: ['--disable-dev-shm-usage'],
        })
        .then(async (value) => {
          if (runClosing) {
            await phase('run', 'late-browser-close', () => value.close(), 10_000);
            throw new Error('Late browser discarded');
          }
          browser = value;
          return value;
        }),
    30_000
  );
  assert(browser, 'Browser launch must return an owned browser');
  await json('source.json', {
    revision,
    tree,
    browser: browser.version(),
    capturedAt: new Date().toISOString(),
    scenes: selectedScenes,
    scope:
      'Shadcn public documentation, Web Components, light, root 16px, actual authored timings; not all families/runtimes',
    recorder:
      'Chrome CDP Page.startScreencast, everyNthFrame=1; renderer cadence is variable, not a guaranteed 60fps; native click inputs',
    drawerSource,
    acceptance:
      'Recorder success establishes capture completion only. No GIF delivery until independent native motion review passes for this exact candidate. Initial defaultOpen is not exercised by these closed-to-open scenes.',
  });
  for (const scene of selectedScenes) {
    const sceneDir = path.join(output, scene.id);
    await mkdir(sceneDir, { recursive: true });
    const resources: { context?: BrowserContext; page?: Page; cdp?: CDPSession } = {};
    const sceneDeadline = Date.now() + 90_000;
    let closing = false,
      acceptingFrames = true;
    const errors: string[] = [],
      blockedRequests: string[] = [],
      actions: unknown[] = [];
    const cleanupErrors: string[] = [];
    const step = <T>(name: string, operation: () => Promise<T>, maximum = 30_000) =>
      phase(scene.id, name, operation, Math.min(maximum, sceneDeadline - Date.now()));
    const cleanup = async (
      name: string,
      operation: () => Promise<unknown>,
      captureCritical = false
    ) => {
      try {
        await phase(scene.id, name, operation, 5_000);
      } catch (error) {
        cleanupErrors.push(String(error));
        if (captureCritical) ackErrors.push(String(error));
      }
    };
    const frames: {
      timestamp: number | undefined;
      receivedAt: number;
      sessionId: number;
      bytes: Buffer;
      metadata: unknown;
    }[] = [];
    const ackTasks: Promise<unknown>[] = [];
    const ackErrors: string[] = [];
    let onFrame:
      | ((event: { data: string; sessionId: number; metadata: { timestamp?: number } }) => void)
      | undefined;
    let started = false,
      stopEpoch = 0;
    let receipt: Record<string, unknown> = {
      id: scene.id,
      revision,
      tree,
      sourceRoute: `/en/ui-libraries/shadcn/${scene.component}/`,
      outcome: 'failed',
    };
    try {
      const context: BrowserContext = await step('context-create', () =>
        browser!
          .newContext({
            viewport: { width: 900, height: 700 },
            deviceScaleFactor: 1,
            colorScheme: 'light',
            reducedMotion: 'no-preference',
          })
          .then(async (value) => {
            if (closing) {
              await phase(scene.id, 'late-context-close', () => value.close(), 5_000);
              throw new Error('Late context discarded');
            }
            resources.context = value;
            return value;
          })
      );
      const page = await step('page-create', () =>
        context.newPage().then(async (value) => {
          if (closing) {
            await phase(scene.id, 'late-page-close', () => value.close(), 5_000);
            throw new Error('Late page discarded');
          }
          resources.page = value;
          return value;
        })
      );
      page.setDefaultTimeout(15_000);
      page.setDefaultNavigationTimeout(30_000);
      page.on('pageerror', (error) => errors.push(String(error)));
      await step('route-install', () =>
        page.route('**/*', async (route) => {
          const url = route.request().url();
          try {
            if (!closing && new URL(url).origin === baseUrl) await route.continue();
            else {
              blockedRequests.push(url);
              await route.abort();
            }
          } catch (error) {
            if (!closing) errors.push(String(error));
          }
        })
      );
      const cdp = await step('cdp-create', () =>
        context.newCDPSession(page).then(async (value) => {
          if (closing) {
            await phase(scene.id, 'late-cdp-detach', () => value.detach(), 5_000);
            throw new Error('Late CDP session discarded');
          }
          resources.cdp = value;
          return value;
        })
      );
      await step('navigate', () =>
        page.goto(baseUrl + receipt.sourceRoute, { waitUntil: 'networkidle' })
      );
      const preview = page.locator(`[data-demo-id="demo-shadcn-${scene.component}"]`);
      assert.equal(await step('demo-count', () => preview.count()), 1, 'Unique public demo');
      await step('choose-runtime', () => choosePreviewRuntime(page, preview, 'wc'));
      const target = preview
        .locator('.host')
        .getByRole(scene.role, { name: scene.name, exact: true });
      await step('target-visible', () => target.waitFor({ state: 'visible', timeout: 30_000 }));
      await step('target-scroll', () => target.scrollIntoViewIfNeeded());
      await step('fonts-ready', () => page.evaluate(() => document.fonts.ready));
      const environment = await step('environment', () =>
        page.evaluate(() => ({
          rootFont: getComputedStyle(document.documentElement).fontSize,
          reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
          colorScheme: getComputedStyle(document.documentElement).colorScheme,
          rootClass: document.documentElement.className,
          viewport: { width: innerWidth, height: innerHeight },
          dpr: devicePixelRatio,
        }))
      );
      assert.equal(environment.rootFont, '16px');
      assert.equal(environment.reducedMotion, false);
      const bounds = await step('target-bounds', () => target.boundingBox());
      assert(bounds);
      const crop =
        scene.component === 'drawer'
          ? { x: 0, y: 0, width: 900, height: 700 }
          : {
              x: Math.max(0, Math.min(500, Math.floor(bounds.x - 30))),
              y: Math.max(0, Math.min(380, Math.floor(bounds.y - 40))),
              width: 400,
              height: scene.component === 'select' ? 320 : 160,
            };
      const initialState = await step('initial-state', () => state(target));
      if (scene.component === 'switch') assert.equal(initialState.checked, 'false');
      else assert.equal(initialState.expanded, 'false');
      // Passive RAF observations do not drive rendering or rewrite transitions.
      await step('observer-start', () =>
        page.evaluate(() => {
          const observations: unknown[] = [];
          (window as any).__transitionCapture = { observations, stopped: false };
          // A nested named arrow gains a module-scoped __name helper under tsx.
          // Object methods remain self-contained when Playwright serializes this callback.
          const loop = {
            tick() {
              const capture = (window as any).__transitionCapture;
              if (capture.stopped || observations.length >= 1200) return;
              const subjects = [
                ...document.querySelectorAll(
                  '[data-previewer-id] .host [role="switch"], [role="dialog"], [role="listbox"]'
                ),
              ].filter((node) => node.getBoundingClientRect().width > 0);
              observations.push({
                now: performance.now(),
                wallTime: Date.now(),
                subjects: subjects
                  .flatMap((root) => [root, ...root.querySelectorAll('*')].slice(0, 24))
                  .map((node) => {
                    const s = getComputedStyle(node),
                      r = node.getBoundingClientRect();
                    return {
                      tag: node.localName,
                      role: node.getAttribute('role'),
                      checked: node.getAttribute('aria-checked'),
                      x: r.x,
                      y: r.y,
                      width: r.width,
                      height: r.height,
                      opacity: s.opacity,
                      transform: s.transform,
                      translate: s.translate,
                      scale: s.scale,
                      backgroundColor: s.backgroundColor,
                      transition: s.transition,
                      animation: s.animation,
                    };
                  }),
              });
              requestAnimationFrame(loop.tick);
            },
          };
          requestAnimationFrame(loop.tick);
        })
      );
      let firstFrameResolve: (() => void) | undefined;
      const firstFrame = new Promise<void>((resolve) => {
        firstFrameResolve = resolve;
      });
      onFrame = (event) => {
        if (!acceptingFrames) return;
        firstFrameResolve?.();
        if (frames.length < 1500)
          frames.push({
            timestamp: event.metadata.timestamp,
            receivedAt: Date.now(),
            sessionId: event.sessionId,
            bytes: Buffer.from(event.data, 'base64'),
            metadata: event.metadata,
          });
        else ackErrors.push('Recorder frame bound exceeded');
        ackTasks.push(
          cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch((error) => {
            ackErrors.push(String(error));
          })
        );
      };
      cdp.on('Page.screencastFrame', onFrame);
      // A timed-out start command may still have taken effect remotely.
      started = true;
      await step('screencast-start', () =>
        cdp.send('Page.startScreencast', {
          format: 'jpeg',
          quality: 95,
          maxWidth: 900,
          maxHeight: 700,
          everyNthFrame: 1,
        })
      );
      let firstFrameTimeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          firstFrame,
          new Promise<never>((_, reject) => {
            firstFrameTimeout = setTimeout(
              () => reject(new Error('No initial screencast frame within 10 seconds')),
              10_000
            );
          }),
        ]);
      } finally {
        clearTimeout(firstFrameTimeout);
      }
      await step('rest-1000ms', () => pause(page, 1000));
      const act = async (name: string, locator: Locator) => {
        const before = Date.now();
        await step(name, () => locator.click());
        actions.push({
          name,
          requestedAt: before,
          completedAt: Date.now(),
          state: await step('action-state', () => state(target)),
        });
      };
      await act(scene.component === 'switch' ? 'off-to-on' : 'open', target);
      await step('rest-1200ms', () => pause(page, 1200));
      const openState = await step('open-state', () => state(target));
      if (scene.component === 'switch') assert.equal(openState.checked, 'true');
      else assert.equal(openState.expanded, 'true');
      if (scene.component === 'drawer')
        await act(
          'close',
          page.getByRole('button', { name: 'Close', exact: true }).filter({ visible: true })
        );
      else if (scene.component === 'select') {
        const before = Date.now();
        await step('close-Escape', () => page.keyboard.press('Escape'));
        actions.push({
          name: 'close-Escape',
          requestedAt: before,
          completedAt: Date.now(),
          state: await step('action-state', () => state(target)),
        });
      } else await act('on-to-off', target);
      await step('rest-1000ms', () => pause(page, 1000));
      const finalState = await step('final-state', () => state(target));
      if (scene.component === 'switch') assert.equal(finalState.checked, 'false');
      else assert.equal(finalState.expanded, 'false');
      assert.equal(errors.length, 0, errors.join('\n'));
      receipt = {
        ...receipt,
        outcome: 'passed',
        environment,
        suggestedCrop: crop,
        initialState,
        openState,
        finalState,
      };
    } catch (error) {
      receipt.error = String(error);
      failures.push({ id: scene.id, error: String(error) });
      abortRemaining ||= String(error).includes('Recorder deadline exceeded');
    } finally {
      closing = true;
      stopEpoch = Date.now() / 1000;
      const { context, page, cdp } = resources;
      if (started && cdp)
        await cleanup('screencast-stop', () => cdp.send('Page.stopScreencast'), true);
      acceptingFrames = false;
      if (cdp && onFrame) cdp.removeListener('Page.screencastFrame', onFrame);
      const frozenAcks = [...ackTasks];
      await cleanup('ack-drain', () => Promise.all(frozenAcks), true);
      let observations: unknown = [];
      if (page)
        await cleanup('observer-stop', async () => {
          observations = await page.evaluate(() => {
            const c = (window as any).__transitionCapture;
            if (c) {
              c.stopped = true;
              return c.observations;
            }
            return [];
          });
        });
      if (cdp) await cleanup('cdp-detach', () => cdp.detach());
      const inventory = [];
      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        const file = `frame-${String(i).padStart(5, '0')}.jpg`;
        await writeFile(path.join(sceneDir, file), frame.bytes);
        inventory.push({
          file,
          timestamp: frame.timestamp,
          receivedAt: frame.receivedAt,
          sessionId: frame.sessionId,
          metadata: frame.metadata,
          sha256: sha(frame.bytes),
          bytes: frame.bytes.length,
        });
      }
      const distinctFrameHashes = new Set(inventory.map((frame) => frame.sha256)).size;
      const timestampsValid = frames.every(
        (frame, i) =>
          Number.isFinite(frame.timestamp) &&
          (i === 0 || (frame.timestamp ?? NaN) > (frames[i - 1].timestamp ?? NaN))
      );
      const gaps = frames
        .slice(1)
        .map((frame, i) => ((frame.timestamp ?? NaN) - (frames[i].timestamp ?? NaN)) * 1000);
      const observedCadence = {
        timestampsValid,
        firstFrameTimestamp: frames[0]?.timestamp ?? null,
        lastFrameTimestamp: frames.at(-1)?.timestamp ?? null,
        maxInterframeGapMs: gaps.length ? Math.max(...gaps) : null,
        gapsOver100ms: gaps.filter((gap) => gap > 100).length,
        intervalsMs: gaps,
        note: 'Screencast is change-driven. Long gaps can be static rests, not proof of dropped frames. Actual source timestamps govern replay.',
      };
      if (!timestampsValid)
        ackErrors.push('Missing, non-finite or non-increasing native frame timestamps');
      if (
        receipt.outcome === 'passed' &&
        (frames.length < 2 || distinctFrameHashes < 2 || ackErrors.length)
      ) {
        receipt.outcome = 'failed';
        receipt.error = 'Insufficient real frame variation or screencast acknowledgement failure';
        failures.push({ id: scene.id, error: receipt.error });
      }
      const complete = {
        ...receipt,
        actions,
        errors,
        blockedRequests,
        recording: {
          format: 'jpeg',
          quality: 95,
          everyNthFrame: 1,
          frames: inventory,
          frameCount: frames.length,
          distinctFrameHashes,
          stopEpoch,
          acknowledgementCount: ackTasks.length,
          acknowledgementErrors: ackErrors,
          discardedByRecorder: Math.max(0, ackTasks.length - frames.length),
          observedCadence,
          rendererDroppedFrames: null,
          rendererDroppedFramesNote:
            'CDP screencast does not expose a renderer dropped-frame counter. Timestamps retain observed variable cadence; never claim guaranteed fps.',
        },
        observations,
      };
      await writeFile(
        path.join(sceneDir, 'receipt.json'),
        JSON.stringify(complete, null, 2) + '\n'
      );
      results.push({
        id: scene.id,
        outcome: receipt.outcome,
        frames: frames.length,
        error: receipt.error,
      });
      await summary();
      if (context) await cleanup('context-close', () => context.close());
      if (cleanupErrors.length) {
        abortRemaining = true;
        failures.push({ id: scene.id, stage: 'cleanup', errors: cleanupErrors });
      }
      await json(`${scene.id}/cleanup.json`, {
        revision,
        tree,
        id: scene.id,
        outcome: cleanupErrors.length ? 'failed' : 'passed',
        errors: cleanupErrors,
        captureOutcome: receipt.outcome,
      });
      await summary();
    }
    if (abortRemaining) break;
  }
} catch (error) {
  failures.push({ stage: 'run', error: String(error) });
} finally {
  runClosing = true;
  for (const scene of selectedScenes) {
    if (!results.some((result) => result.id === scene.id))
      results.push({
        id: scene.id,
        outcome: 'not-run',
        reason: 'Recorder stopped before this scene',
      });
  }
  await summary();
  for (const [name, operation] of [
    [
      'browser-close',
      async () => {
        await browser?.close();
      },
    ],
    ['server-stop', stopServer],
  ] as const) {
    try {
      await phase('run', name, operation, 10_000);
    } catch (error) {
      failures.push({ stage: name, error: String(error) });
    }
    await summary();
  }
}
assert.equal(failures.length, 0, JSON.stringify(failures));

async function phase<T>(
  id: string,
  stage: string,
  operation: () => Promise<T>,
  timeoutMs?: number
): Promise<T> {
  const report = async (state: string, error?: unknown) => {
    const record = {
      revision,
      tree,
      id,
      stage,
      state,
      at: new Date().toISOString(),
      ...(error === undefined ? {} : { error: String(error) }),
    };
    console.log('[transition-recorder]', JSON.stringify(record));
    try {
      await appendFile(path.join(output!, 'progress.jsonl'), JSON.stringify(record) + '\n');
    } catch (error) {
      failures.push({ id, stage: 'progress-write', error: String(error) });
      console.error('[transition-recorder] progress write failed', error);
    }
  };
  await report('start');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    if (timeoutMs !== undefined && timeoutMs <= 0)
      throw new Error(`Recorder deadline exceeded: ${id}/${stage}`);
    const result =
      timeoutMs === undefined
        ? await operation()
        : await Promise.race([
            Promise.resolve().then(operation),
            new Promise<never>((_, reject) => {
              timer = setTimeout(
                () => reject(new Error(`Recorder deadline exceeded: ${id}/${stage}`)),
                timeoutMs
              );
            }),
          ]);
    await report('passed');
    return result;
  } catch (error) {
    await report('failed', error);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function state(target: Locator) {
  return target.evaluate((node) => ({
    expanded: node.getAttribute('aria-expanded'),
    checked: node.getAttribute('aria-checked'),
    controls: node.getAttribute('aria-controls'),
    text: node.textContent,
    focused: document.activeElement === node,
  }));
}
async function pause(page: Page, milliseconds: number) {
  // Deliberate bounded real-time rest interval, not a CSS timing override.
  await page.waitForTimeout(milliseconds);
}

async function inspectDrawerSource() {
  const paths = {
    content: 'packages/prototypes/shadcn/src/drawer/content.proto.ts',
    mask: 'packages/prototypes/shadcn/src/drawer/mask.proto.ts',
    demo: 'apps/www/src/content/docs/demo-shadcn-drawer.demo.ts',
    sourceTest: 'packages/prototypes/shadcn/test/drawer-presence-presentation.test.ts',
  };
  const sources = Object.fromEntries(
    await Promise.all(
      Object.entries(paths).map(async ([key, file]) => {
        const bytes = await readFile(file);
        return [key, { file, sha256: sha(bytes), text: bytes.toString('utf8') }] as const;
      })
    )
  );
  const duration = (text: string, name: 'enterDuration' | 'leaveDuration') => {
    const matches = [
      ...text.matchAll(new RegExp(`['"]?${name}['"]?\\s*:\\s*(\\d+(?:\\.\\d+)?)`, 'g')),
    ];
    assert.equal(
      matches.length,
      1,
      `${name} must have one inspectable numeric source configuration`
    );
    return Number(matches[0][1]);
  };
  const settings = Object.fromEntries(
    ['content', 'mask'].map((part) => {
      const text = sources[part].text;
      const configured = text.match(/asTransition\.configure\(\{([\s\S]*?)\}\);/);
      assert(configured, `${part} has no source transition configuration`);
      const enterDuration = duration(configured[1], 'enterDuration');
      const leaveDuration = duration(configured[1], 'leaveDuration');
      assert(
        enterDuration > 0 && leaveDuration > 0,
        'Repair-first capture requires positive authored durations'
      );
      assert(
        text.includes('def.feedback.style.presence('),
        `${part} must author presentation, not only a timer`
      );
      return [part, { enterDuration, leaveDuration, configuration: configured[0] }];
    })
  );
  // Any future demo duration override needs explicit recorder re-review; never
  // silently record an instant demo while advertising prototype defaults.
  assert(
    !/['"]?(?:enterDuration|leaveDuration)['"]?\s*:/.test(sources.demo.text),
    'Demo overrides require source/duration re-review'
  );
  const test = sources.sourceTest.text;
  const ordinaryCases = [...test.matchAll(/\bit\s*\(/g)].length;
  const parameterizedCases = [...test.matchAll(/\bit\.each\(\[([^\]]*)\]/g)].reduce(
    (sum, match) => sum + [...match[1].matchAll(/['"][^'"]+['"]/g)].length,
    0
  );
  const expectedFailureCases = [...test.matchAll(/\bit\.fails\s*\(/g)].length;
  const initialDefaultOpenExpectedFailure =
    /it\.fails\([\s\S]*?known parity gap: defaultOpen skips initial presentation/.test(test);
  return {
    files: Object.fromEntries(
      Object.entries(sources).map(([key, source]) => [
        key,
        { file: source.file, sha256: source.sha256 },
      ])
    ),
    settings,
    demoDurationOverrides: 'none; verified in current source',
    sourceCoverage: {
      ordinaryCases: ordinaryCases + parameterizedCases,
      expectedFailureCases,
      evidenceKind: 'Static source inventory, not executed tests or native acceptance',
    },
    initialDefaultOpenExpectedFailure,
    limitation: initialDefaultOpenExpectedFailure
      ? 'Known initial defaultOpen parity gap remains an explicit expected-failure source test; these GIF scenes start closed and do not close that gap.'
      : 'Initial defaultOpen is not exercised by these GIF scenes; inspect current source-suite results separately.',
  };
}
