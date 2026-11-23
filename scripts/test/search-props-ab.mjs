// Opt-in, same-source Search diagnostic. Importing this module opens no socket.
// Production/generated-index acceptance stays in run-search-production-evidence.mjs.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { bounded, sourceIdentity } from './search-startup-profile.mjs';

export const PROPS_PATH = 'packages/adapters/web-component/src/props.ts';
export const PROPS_AB_PLAN = Object.freeze({
  families: Object.freeze(['shadcn', 'brutalist']),
  themes: Object.freeze(['light', 'dark']),
  widths: Object.freeze([390, 1440]),
  pairs: 5,
  readinessBudgetMs: 1000,
  operationTimeoutMs: 30_000,
  sampleTimeoutMs: 60_000,
  totalTimeoutMs: 15 * 60_000,
  variants: Object.freeze(['current', 'forced-write']),
});
const ORACLE_PATH = 'apps/www/src/content/docs/zh-cn/site-search-evidence.ts';
const HARNESS_PATH = 'apps/www/src/content/docs/zh-cn/browser-harness.ts';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const routeFor = (family) =>
  `/zh-cn/ui-libraries/${family}/${family === 'brutalist' ? 'components/' : ''}button/`;
const persist = (directory, name, data) =>
  writeFile(path.join(directory, `${name}.json`), `${JSON.stringify(data, null, 2)}\n`);

/** This is deliberately not a broad string replacement or a product source edit.
 * Only the boolean condition guarding an unchanged custom-property write changes. */
export function propsVariant(source, variant) {
  assert.ok(PROPS_AB_PLAN.variants.includes(variant), 'Unknown props A/B variant');
  const matches = [...source.matchAll(/if\s*\(\s*!unchangedCustomProperty\s*\)/g)];
  assert.equal(matches.length, 1, 'Expected exactly one unchangedCustomProperty guard');
  const guard = matches[0];
  const conditionOffset = guard.index + guard[0].indexOf('!unchangedCustomProperty');
  const before = '!unchangedCustomProperty';
  const after = variant === 'current' ? before : 'true';
  const body =
    source.slice(0, conditionOffset) + after + source.slice(conditionOffset + before.length);
  assert.equal(
    body.slice(0, conditionOffset) + before + body.slice(conditionOffset + after.length),
    source,
    'The props response must have no other byte differences'
  );
  return {
    body,
    mutation: { offset: conditionOffset, before, after },
    originalDigest: sha256(source),
    servedDigest: sha256(body),
    originalBytes: Buffer.byteLength(source),
    servedBytes: Buffer.byteLength(body),
  };
}
export function isPropsUrl(value, origin) {
  try {
    const url = new URL(value);
    return (
      url.origin === origin &&
      decodeURIComponent(url.pathname).replaceAll('\\', '/').endsWith(`/${PROPS_PATH}`)
    );
  } catch {
    return false;
  }
}
export function plannedSamples() {
  const samples = [];
  for (const family of PROPS_AB_PLAN.families)
    for (const theme of PROPS_AB_PLAN.themes)
      for (const width of PROPS_AB_PLAN.widths)
        for (let pair = 0; pair < PROPS_AB_PLAN.pairs; pair++) {
          // Alternate order inside each scenario; browser contexts never repeat.
          const variants =
            pair % 2 ? [...PROPS_AB_PLAN.variants].reverse() : PROPS_AB_PLAN.variants;
          for (const variant of variants)
            samples.push({
              family,
              theme,
              width,
              pair,
              variant,
              id: `${family}-${theme}-${width}-${pair}-${variant}`,
            });
        }
  return samples;
}
export function validateModuleReceipt(receipt, variant, expectedOriginalDigest) {
  assert.equal(receipt.requests.length, 1, 'Each sample must request exactly one props module');
  assert.equal(receipt.responses.length, 1, 'Each sample must intercept exactly one props module');
  assert.equal(receipt.parsed.length, 1, 'Each sample must parse exactly one props module');
  assert.deepEqual(
    receipt.alternatives,
    [],
    'An alternate Web Component props module bypassed interception'
  );
  const response = receipt.responses[0];
  const parsed = receipt.parsed[0];
  assert.equal(response.url, receipt.requests[0]);
  assert.equal(
    parsed.url,
    response.url,
    'The parsed props module must be the intercepted response'
  );
  assert.equal(
    parsed.digest,
    response.servedDigest,
    'Chromium must parse exactly the served bytes'
  );
  assert.equal(
    response.originalDigest,
    expectedOriginalDigest,
    'Every sample must use the same Vite source bytes'
  );
  assert.equal(response.mutation.before, '!unchangedCustomProperty');
  assert.equal(
    response.mutation.after,
    variant === 'current' ? '!unchangedCustomProperty' : 'true'
  );
  if (variant === 'current') assert.equal(response.originalDigest, response.servedDigest);
  else assert.notEqual(response.originalDigest, response.servedDigest);
}
export function propsABSummary(samples) {
  const plan = plannedSamples();
  const byId = new Map(samples.map((sample) => [sample.id, sample]));
  const missing = plan.filter((sample) => !byId.has(sample.id)).map((sample) => sample.id);
  const duplicateCount = samples.length - byId.size;
  const unplanned = samples
    .filter((sample) => !plan.some((item) => item.id === sample.id))
    .map((sample) => sample.id);
  const variants = Object.fromEntries(
    PROPS_AB_PLAN.variants.map((variant) => {
      const cohort = samples.filter((sample) => sample.variant === variant);
      return [
        variant,
        {
          planned: plan.filter((sample) => sample.variant === variant).length,
          completed: cohort.filter((sample) => sample.capture === 'complete').length,
          readinessPasses: cohort.filter((sample) => sample.readiness?.onTime === true).length,
          readinessFailures: cohort
            .filter((sample) => sample.readiness?.onTime === false)
            .map((sample) => sample.id),
          notEvaluated: cohort
            .filter((sample) => typeof sample.readiness?.onTime !== 'boolean')
            .map((sample) => sample.id),
          operationalFailures: cohort
            .filter((sample) => sample.capture !== 'complete')
            .map((sample) => sample.id),
        },
      ];
    })
  );
  const complete =
    missing.length === 0 &&
    duplicateCount === 0 &&
    unplanned.length === 0 &&
    Object.values(variants).every(
      (variant) => variant.completed === variant.planned && variant.notEvaluated.length === 0
    );
  return {
    complete,
    candidatePassed: complete && variants.current.readinessPasses === variants.current.planned,
    missing,
    duplicateCount,
    unplanned,
    variants,
    acceptance:
      'Every current sample must meet the original 1000ms deadline; counterfactual misses remain failures and are never averaged away.',
  };
}

async function sampleVisit(browser, oracle, origin, planned, canonicalDigest, deadline) {
  const result = {
    ...planned,
    startedAt: new Date().toISOString(),
    capture: 'incomplete',
    readiness: null,
    errors: [],
    modules: { requests: [], responses: [], parsed: [], alternatives: [] },
  };
  let context;
  let cdp;
  const parsedModules = [];
  const timeLeft = () =>
    Math.min(PROPS_AB_PLAN.operationTimeoutMs, Math.max(1, deadline - Date.now()));
  try {
    context = await browser.newContext({
      viewport: { width: planned.width, height: 960 },
      colorScheme: planned.theme,
      serviceWorkers: 'block',
    });
    // Routing disables browser HTTP cache equally in both variants. All other
    // responses keep their real source and origin; no Pagefind/ready stub is used.
    await context.route('**/*', async (route) => {
      const url = route.request().url();
      if (!isPropsUrl(url, origin)) return route.continue();
      try {
        const fetched = await route.fetch({ timeout: timeLeft() });
        assert.equal(fetched.status(), 200, 'The real Vite props module must be available');
        const variant = propsVariant(await fetched.text(), planned.variant);
        if (canonicalDigest.value === null) canonicalDigest.value = variant.originalDigest;
        assert.equal(
          variant.originalDigest,
          canonicalDigest.value,
          'Vite response source drifted between samples'
        );
        const { body, ...proof } = variant;
        result.modules.responses.push({ url, ...proof });
        await route.fulfill({ response: fetched, body });
      } catch (error) {
        result.errors.push(`Props interception: ${String(error)}`);
        await route.abort('failed').catch((abortError) => {
          result.errors.push(`Props route abort: ${String(abortError)}`);
        });
      }
    });
    const page = await context.newPage();
    page.setDefaultTimeout(timeLeft());
    page.setDefaultNavigationTimeout(timeLeft());
    page.on('pageerror', (error) => result.errors.push(`Page: ${error.message}`));
    page.on('request', (request) => {
      const url = request.url();
      if (isPropsUrl(url, origin)) result.modules.requests.push(url);
      else if (/\/(?:adapter-web-component|web-component)\/.*props\.[cm]?[jt]s(?:[?#]|$)/.test(url))
        result.modules.alternatives.push(url);
    });
    cdp = await context.newCDPSession(page);
    cdp.on('Debugger.scriptParsed', (script) => {
      if (isPropsUrl(script.url, origin)) parsedModules.push(script);
      else if (
        /\/(?:adapter-web-component|web-component)\/.*props\.[cm]?[jt]s(?:[?#]|$)/.test(script.url)
      )
        result.modules.alternatives.push(script.url);
    });
    await cdp.send('Debugger.enable');
    await cdp.send('Debugger.setSkipAllPauses', { skip: true });
    await page.addInitScript(
      (theme) => localStorage.setItem('starlight-theme', theme),
      planned.theme
    );
    await page.addInitScript(oracle.installSearchStartupTrace);
    result.navigationStartedAt = Date.now();
    const response = await page.goto(`${origin}${routeFor(planned.family)}`, {
      waitUntil: 'networkidle',
    });
    assert.ok(response?.ok(), 'Expected the existing documentation route');
    // Start immediately after the same original navigation/response boundary.
    // No pre-read, renewed wait, retry, or widened budget changes this verdict.
    const startedAt = Date.now();
    const evidence = await bounded(
      page.evaluate(oracle.readSearchReadyWithinBudget, { startedAt }),
      'original readiness observation',
      timeLeft()
    );
    result.readiness = { evidence, onTime: oracle.searchReadinessWasOnTime(evidence) };
    result.readiness.replyReceivedAt = Date.now();
    result.observation = await bounded(
      page.evaluate(() => {
        const trace = window.__puiSearchStartup;
        const snapshot = trace?.snapshot();
        trace?.stop();
        return {
          startup: snapshot,
          navigation: performance.getEntriesByType('navigation').map((entry) => entry.toJSON()),
        };
      }),
      'startup observation',
      timeLeft()
    );
    const startup = result.observation.startup;
    assert.ok(startup && Number.isFinite(startup.timeOrigin), 'Startup trace was not installed');
    const readyMs =
      evidence.observedReadyAt === null ? null : evidence.observedReadyAt - startup.timeOrigin;
    result.metrics = {
      readySinceNavigationMs: readyMs,
      readySinceOriginalBoundaryMs:
        evidence.observedReadyAt === null ? null : evidence.observedReadyAt - evidence.startedAt,
      observerEntryDelayMs: evidence.browserEnteredAt - evidence.startedAt,
      observerReplyDelayMs: result.readiness.replyReceivedAt - evidence.completedAt,
      capturedLongTasksBeforeReadyMs:
        readyMs === null
          ? null
          : startup.longTasks.reduce(
              (sum, task) =>
                sum +
                Math.max(0, Math.min(task.startTime + task.duration, readyMs) - task.startTime),
              0
            ),
      longTasksCaptured: startup.longTasks.length,
      longTaskCount: startup.longTaskCount,
      longTasksTruncated: startup.longTaskCount > startup.longTasks.length,
      attribution:
        'Observed startup/resources/long tasks separate loading, main-thread and reply delay; the single-condition counterfactual isolates only the current equal-style-write hypothesis.',
    };
    for (const script of parsedModules) {
      const { scriptSource } = await cdp.send('Debugger.getScriptSource', {
        scriptId: script.scriptId,
      });
      result.modules.parsed.push({
        url: script.url,
        digest: sha256(scriptSource),
        bytes: Buffer.byteLength(scriptSource),
        cdpHash: script.hash,
      });
    }
    validateModuleReceipt(result.modules, planned.variant, canonicalDigest.value);
    assert.deepEqual(result.errors, [], 'Page/interception errors invalidate the timing sample');
    result.capture = 'complete';
    result.terminal = result.readiness.onTime ? 'passed' : 'readiness-failed';
  } catch (error) {
    result.errors.push(String(error));
    result.terminal = 'operational-failure';
  } finally {
    for (const [name, cleanup] of [
      ['CDP', () => cdp?.detach()],
      ['context', () => context?.close()],
    ]) {
      try {
        await bounded(Promise.resolve().then(cleanup), `${name} sample cleanup`, 10_000);
      } catch (error) {
        result.errors.push(`Cleanup ${name}: ${String(error)}`);
        result.capture = 'incomplete';
        result.terminal = 'cleanup-failure';
      }
    }
    result.completedAt = new Date().toISOString();
  }
  return result;
}

export async function runSearchPropsAB({ root, sourceSha, directory }) {
  assert.equal(
    process.env.PROTO_UI_BROWSER_BASE_URL,
    undefined,
    'The probe must own the exact-source dev server'
  );
  await mkdir(directory, { recursive: true });
  const plan = plannedSamples();
  const report = {
    schemaVersion: 1,
    sourceSha,
    plan: PROPS_AB_PLAN,
    source: null,
    sourceAfter: null,
    samples: [],
    failures: [],
    summary: null,
    boundaries: [
      'One exact clean checkout, one dev server and origin; every context is fresh and variant order alternates by pair.',
      'The forced-write response changes only !unchangedCustomProperty to true in the actual Vite props module. Chromium parsed bytes and all matching requests are verified.',
      'Fresh browser contexts are cold; Vite server transforms are shared after the existing harness route warmup. This is not a cold-server or production timing claim.',
      'Routing, startup observers and CDP Debugger perturb both variants. No broad historical-causality claim follows from this current-source experiment.',
      'Each original 1000ms readiness verdict is retained. Production/generated-index, native IME and lifecycle suites remain separate acceptance conditions.',
    ],
    execution: {
      node: process.version,
      runId: process.env.GITHUB_RUN_ID ?? null,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    },
  };
  let browser;
  let stopServer;
  const deadline = Date.now() + PROPS_AB_PLAN.totalTimeoutMs;
  try {
    report.source = sourceIdentity(root, sourceSha);
    report.source.files = Object.fromEntries(
      await Promise.all(
        [
          PROPS_PATH,
          ORACLE_PATH,
          HARNESS_PATH,
          'apps/www/src/components/site-search-commands.ts',
          'apps/www/src/components/override/Search.astro',
          'scripts/test/search-props-ab.mjs',
          'pnpm-lock.yaml',
        ].map(async (file) => [file, sha256(await readFile(path.join(root, file)))])
      )
    );
    const oracle = await import(pathToFileURL(path.join(root, ORACLE_PATH)).href);
    assert.equal(
      oracle.SEARCH_READINESS_BUDGET_MS,
      PROPS_AB_PLAN.readinessBudgetMs,
      'Oracle budget drifted'
    );
    const harness = await import(pathToFileURL(path.join(root, HARNESS_PATH)).href);
    stopServer = harness.stopServer;
    process.chdir(root);
    report.origin = await bounded(
      harness.startServer(PROPS_AB_PLAN.families.map(routeFor)),
      'source dev server',
      180_000
    );
    report.sourceAfterWarmup = sourceIdentity(root, sourceSha);
    browser = await bounded(harness.launchBrowser(), 'browser launch');
    report.browser = browser.version();
    const canonicalDigest = { value: null };
    for (const sample of plan) {
      let result;
      if (Date.now() >= deadline) {
        result = {
          ...sample,
          capture: 'incomplete',
          terminal: 'not-run-deadline',
          readiness: null,
          errors: ['Total diagnostic deadline exhausted'],
        };
      } else {
        result = await sampleVisit(
          browser,
          oracle,
          report.origin,
          sample,
          canonicalDigest,
          Math.min(deadline, Date.now() + PROPS_AB_PLAN.sampleTimeoutMs)
        );
      }
      report.samples.push(result);
      await persist(directory, sample.id, result);
      report.summary = propsABSummary(report.samples);
      await persist(directory, 'result', report);
      console.log(
        `[search-props-ab] ${sample.id}: ${result.terminal}; interception=${result.modules?.responses.length ?? 0}; parsed=${result.modules?.parsed.length ?? 0}`
      );
    }
    report.originalViteModuleDigest = canonicalDigest.value;
  } catch (error) {
    report.failures.push(String(error));
  } finally {
    for (const [name, cleanup] of [
      ['browser', () => browser?.close()],
      ['server', () => stopServer?.()],
    ]) {
      try {
        await bounded(Promise.resolve().then(cleanup), `${name} teardown`, 20_000);
      } catch (error) {
        report.failures.push(`${name} teardown: ${String(error)}`);
      }
    }
    try {
      report.sourceAfter = sourceIdentity(root, sourceSha);
    } catch (error) {
      report.failures.push(`Final source boundary: ${String(error)}`);
    }
    for (const sample of plan) {
      if (report.samples.some((entry) => entry.id === sample.id)) continue;
      const result = {
        ...sample,
        capture: 'incomplete',
        terminal: 'not-run-setup-failure',
        readiness: null,
        errors: [...report.failures],
      };
      report.samples.push(result);
      await persist(directory, sample.id, result);
    }
    report.summary = propsABSummary(report.samples);
    report.passed = report.summary.candidatePassed && report.failures.length === 0;
    await persist(directory, 'result', report);
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const directory = process.argv[2];
  assert.ok(
    directory,
    'Usage: PROTO_UI_SEARCH_AB_SHA=<exact SHA> node --import tsx scripts/test/search-props-ab.mjs <evidence directory>'
  );
  const report = await runSearchPropsAB({
    root,
    sourceSha: process.env.PROTO_UI_SEARCH_AB_SHA,
    directory: path.resolve(directory),
  });
  console.log(
    JSON.stringify(
      {
        sourceSha: report.sourceSha,
        passed: report.passed,
        failures: report.failures,
        summary: report.summary,
      },
      null,
      2
    )
  );
  process.exitCode = report.passed ? 0 : 1;
}
