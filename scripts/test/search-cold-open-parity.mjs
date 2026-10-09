import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const SOURCES = {
  baseline: '46fa65bb0146d951a08f6368ee4568be57fba3f5',
  current: '4a2320762ba5f4319dec1915ca4e138772dceb0c',
};
export const ROUTE = '/zh-cn/ui-libraries/shadcn/button/';
export const SAMPLE_COUNT = 10;
export const TIMEOUT = 20_000;
export function semanticResult(href, text, origin) {
  try {
    const url = new URL(href, origin);
    return (
      url.origin === origin &&
      /\/zh-cn\/ui-libraries\/(shadcn|base|brutalist\/components)\/button\/?$/.test(url.pathname) &&
      /button/i.test(text)
    );
  } catch {
    return false;
  }
}
export function distribution(values, total) {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  const quantile = (q) => (finite.length ? finite[Math.ceil(q * finite.length) - 1] : null);
  return {
    attempted: total,
    observed: finite.length,
    missing: total - finite.length,
    min: finite[0] ?? null,
    median: quantile(0.5),
    p90: quantile(0.9),
    max: finite.at(-1) ?? null,
    samples: values,
    quantileMethod:
      'nearest rank; missing observations excluded, explicitly counted; no imputation',
  };
}
export function validateSample(sample) {
  assert.equal(sample.status, 'complete');
  for (const metric of ['openToInputMs', 'queryToResultMs', 'secondOpenToInputMs'])
    assert.ok(Number.isFinite(sample.metrics[metric]) && sample.metrics[metric] >= 0, metric);
  assert.ok(
    sample.resultMatches.length > 0 &&
      sample.resultMatches.every((r) => semanticResult(r.href, r.text, sample.origin)),
    'semantic Button result required'
  );
  assert.equal(sample.events.open.length, 2);
  assert.ok(sample.events.query > sample.events.open[0]);
  assert.ok(sample.events.result >= sample.events.query);
  assert.equal(sample.errors.length, 0, 'browser error is not success');
  if (sample.failureControl) {
    assert.ok(sample.failureObserved, 'failure UI must have been observed');
    for (const status of [503, 200])
      assert.ok(
        sample.requests.some(
          (r) => r.path === '/pagefind/pagefind.js' && r.method === 'HEAD' && r.status === status
        ),
        `missing HEAD ${status}`
      );
    assert.equal(
      sample.events.events.filter((e) => e.command === 'retry').length,
      1,
      'one real retry click'
    );
    assert.ok(
      Number.isFinite(sample.metrics.retryToInputMs) && sample.metrics.retryToInputMs >= 0,
      'retry input timing'
    );
  }
}

// Injected unchanged on both source trees. The observer only records facts;
// it never writes product readiness, visibility, query, result, or focus state.
export function observeSearch() {
  const data = {
    open: [],
    input: [],
    query: null,
    result: null,
    resultMatches: [],
    opener: null,
    dcl: null,
    longTasks: [],
    events: [],
    frames: 0,
  };
  window.__coldSearch = data;
  const visible = (el) => {
    if (!el?.isConnected || el.closest('[inert], [data-projection-generation-state="staging"]'))
      return false;
    for (let ancestor = el; ancestor; ancestor = ancestor.parentElement) {
      const inherited = getComputedStyle(ancestor);
      if (
        Number(inherited.opacity) === 0 ||
        inherited.visibility === 'hidden' ||
        inherited.display === 'none'
      )
        return false;
    }
    const box = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return (
      box.width > 0 &&
      box.height > 0 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      Number(style.opacity) !== 0
    );
  };
  const enabled = (el) => el && !el.disabled && el.getAttribute('aria-disabled') !== 'true';
  const readyOpener = () =>
    [...document.querySelectorAll('site-search [data-open-modal]')].find(
      (el) => visible(el) && enabled(el)
    );
  const record = (e) => {
    const target = e.target instanceof Element ? e.target : null;
    const command = target?.closest(
      '[data-open-modal], .search-failure__retry, [data-close-modal]'
    );
    if (e.type === 'click' && command && e.isTrusted) {
      data.events.push({
        type: 'click',
        at: performance.now(),
        command: command.hasAttribute('data-open-modal')
          ? 'open'
          : command.hasAttribute('data-close-modal')
            ? 'close'
            : 'retry',
      });
      if (command.hasAttribute('data-open-modal')) data.open.push(performance.now());
    }
    if (
      e.type === 'input' &&
      target?.matches('.pagefind-ui__search-input') &&
      target.value === 'Button' &&
      data.query === null
    )
      data.query = performance.now();
  };
  window.addEventListener('click', record, true);
  window.addEventListener('input', record, true);
  window.addEventListener(
    'DOMContentLoaded',
    () => {
      data.dcl = performance.now();
    },
    { once: true }
  );
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        data.longTasks.push({ startTime: e.startTime, duration: e.duration });
    }).observe({ type: 'longtask', buffered: true });
  } catch {}
  function frame() {
    data.frames++;
    if (data.opener === null && customElements.get('site-search') && readyOpener())
      data.opener = performance.now();
    const dialog = document.querySelector('site-search dialog');
    const input = document.querySelector('site-search .pagefind-ui__search-input');
    const index = data.open.length - 1;
    if (
      index >= 0 &&
      data.input[index] === undefined &&
      dialog?.open &&
      visible(input) &&
      enabled(input) &&
      !input.readOnly &&
      document.activeElement === input
    )
      data.input[index] = performance.now();
    if (data.query !== null && data.result === null) {
      const matches = [
        ...document.querySelectorAll('site-search .pagefind-ui__result-link'),
      ].filter((el) => {
        const url = new URL(el.href, location.href);
        return (
          visible(el) &&
          url.origin === location.origin &&
          /\/zh-cn\/ui-libraries\/(shadcn|base|brutalist\/components)\/button\/?$/.test(
            url.pathname
          ) &&
          /button/i.test(el.textContent ?? '')
        );
      });
      if (matches.length) {
        data.result = performance.now();
        data.resultMatches = matches.map((el) => ({ href: el.href, text: el.textContent.trim() }));
      }
    }
    window.__coldSearchFrame = requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

async function serve(root) {
  const base = path.resolve(root, 'apps/www/dist');
  const mime = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.wasm': 'application/wasm',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.woff2': 'font/woff2',
  };
  const server = createServer(async (req, res) => {
    try {
      const relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      let target = path.resolve(base, `.${relative}`);
      if (!target.startsWith(base + path.sep)) throw new Error('Invalid path');
      if ((await stat(target)).isDirectory()) target = path.join(target, 'index.html');
      const bytes = await readFile(target);
      res.writeHead(200, {
        'Content-Type': mime[path.extname(target)] ?? 'application/octet-stream',
        'Content-Length': bytes.length,
        'Cache-Control': 'public, max-age=3600',
      });
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
async function sourceBoundary(root, kind) {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const sha = git('rev-parse', 'HEAD');
  assert.equal(sha, SOURCES[kind], 'wrong application revision');
  const changedTracked = git('diff', '--name-only', 'HEAD');
  // Build generators may create exact generated bytes. Record all drift, reject
  // any tracked drift rather than asserting a source-bound build on a dirty tree.
  assert.equal(changedTracked, '', `tracked build drift: ${changedTracked}`);
  const html = await readFile(path.join(root, 'apps/www/dist', ROUTE, 'index.html'));
  const runtime = await readFile(path.join(root, 'apps/www/dist/pagefind/pagefind.js'));
  return {
    kind,
    sha,
    changedTracked,
    routeHtmlSha256: createHash('sha256').update(html).digest('hex'),
    pagefindRuntimeSha256: createHash('sha256').update(runtime).digest('hex'),
    lockSha256: createHash('sha256')
      .update(await readFile(path.join(root, 'pnpm-lock.yaml')))
      .digest('hex'),
  };
}
async function sample(
  browser,
  server,
  source,
  mode,
  iteration,
  out,
  profiled = false,
  failure = false
) {
  const id = `${source.kind}-${mode}-${iteration}${profiled ? '-trace' : ''}${failure ? '-head503' : ''}`;
  const dir = path.join(out, id);
  await mkdir(dir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    colorScheme: 'light',
    locale: 'en-US',
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const errors = [],
    requests = [],
    blocked = [];
  let failHead = failure,
    stage = 'navigate',
    traceStarted = false;
  const report = {
    id,
    source,
    mode,
    iteration,
    profiled,
    failureControl: failure,
    status: 'incomplete',
    origin: server.origin,
    errors,
    requests,
    blocked,
  };
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    const u = new URL(r.url());
    if (u.origin === server.origin)
      requests.push({
        path: u.pathname,
        status: r.status(),
        method: r.request().method(),
        atWall: Date.now(),
      });
  });
  await context.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (u.origin !== server.origin) {
      blocked.push(u.origin);
      await route.abort();
      return;
    }
    if (failHead && u.pathname === '/pagefind/pagefind.js' && route.request().method() === 'HEAD') {
      await route.fulfill({ status: 503, body: '' });
      return;
    }
    await route.continue();
  });
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await page.addInitScript(() => {
    localStorage.setItem('starlight-theme', 'light');
    localStorage.setItem('preferred-prototypes-adapter', 'wc');
  });
  await page.addInitScript(observeSearch);
  try {
    if (profiled) {
      await cdp.send('Tracing.start', {
        categories: 'devtools.timeline,v8,blink.user_timing,loading',
        transferMode: 'ReturnAsStream',
      });
      traceStarted = true;
    }
    const response = await page.goto(server.origin + ROUTE, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT,
    });
    assert.equal(response.status(), 200);
    await page.waitForFunction(() => Number.isFinite(window.__coldSearch?.opener), null, {
      timeout: TIMEOUT,
    });
    if (mode === 'settled')
      await page.waitForFunction(
        () => performance.now() >= (window.__coldSearch.dcl ?? 0) + 2000,
        null,
        { timeout: TIMEOUT }
      );
    stage = 'first-open';
    const opener = page.locator(
      source.kind === 'current'
        ? 'site-search [data-projection-generation-state="active"] [data-open-modal]'
        : 'site-search [data-open-modal]'
    );
    await opener.click({ timeout: TIMEOUT });
    if (failure) {
      stage = 'head503';
      const retry = page.locator('site-search .search-failure__retry:visible');
      await retry.waitFor({ state: 'visible', timeout: TIMEOUT });
      report.failureObserved = await page.evaluate(() => ({
        at: performance.now(),
        focused: document.activeElement?.className,
      }));
      await page.screenshot({ path: path.join(dir, 'head503.png') });
      failHead = false;
      stage = 'retry';
      await retry.click({ timeout: TIMEOUT });
    }
    await page.waitForFunction(() => Number.isFinite(window.__coldSearch.input[0]), null, {
      timeout: TIMEOUT,
    });
    stage = 'query';
    await page
      .locator('site-search .pagefind-ui__search-input')
      .fill('Button', { timeout: TIMEOUT });
    await page.waitForFunction(() => Number.isFinite(window.__coldSearch.result), null, {
      timeout: TIMEOUT,
    });
    stage = 'second-open';
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('site-search dialog')?.open, null, {
      timeout: TIMEOUT,
    });
    await opener.click({ timeout: TIMEOUT });
    await page.waitForFunction(() => Number.isFinite(window.__coldSearch.input[1]), null, {
      timeout: TIMEOUT,
    });
    report.status = 'complete';
  } catch (error) {
    report.status = 'failed';
    report.failedStage = stage;
    report.error = String(error);
  } finally {
    try {
      const observed = await page.evaluate(() => {
        cancelAnimationFrame(window.__coldSearchFrame);
        return {
          ...window.__coldSearch,
          resources: performance.getEntriesByType('resource').map((r) => ({
            name: new URL(r.name).pathname,
            startTime: r.startTime,
            duration: r.duration,
            transferSize: r.transferSize,
            encodedBodySize: r.encodedBodySize,
            initiatorType: r.initiatorType,
          })),
          navigation: performance.getEntriesByType('navigation')[0]?.toJSON(),
          actualRuntime:
            document.querySelector('site-search')?.getAttribute('data-search-runtime') ??
            'native-before-migration',
        };
      });
      report.events = observed;
      report.resultMatches = observed.resultMatches;
      const delta = (end, start) =>
        Number.isFinite(end) && Number.isFinite(start) ? end - start : null;
      report.metrics = {
        openerFromNavigationMs: observed.opener,
        openerFromDclMs: delta(observed.opener, observed.dcl),
        clickFromDclMs: delta(observed.open[0], observed.dcl),
        openerToClickMs: delta(observed.open[0], observed.opener),
        openToInputMs: delta(observed.input[0], observed.open[0]),
        queryToResultMs: delta(observed.result, observed.query),
        secondOpenToInputMs: delta(observed.input[1], observed.open[1]),
        retryToInputMs: delta(
          observed.input[0],
          observed.events.find((e) => e.command === 'retry')?.at
        ),
      };
      report.preClick = {
        pagefindRequests: observed.resources.filter(
          (r) => r.name.startsWith('/pagefind/') && r.startTime < observed.open[0]
        ),
        longTasks: observed.longTasks.filter((e) => e.startTime < observed.open[0]),
      };
      if (report.status === 'complete') {
        validateSample(report);
        if (source.kind === 'current')
          assert.equal(observed.actualRuntime, 'wc', 'current Search must use fixed WC runtime');
      }
      if (iteration === 0 || report.status !== 'complete' || failure)
        await page.screenshot({ path: path.join(dir, 'final.png') });
    } catch (error) {
      report.status = 'failed';
      report.validationError = String(error);
    }
    if (traceStarted) {
      try {
        let traceTimer;
        const complete = new Promise((resolve) =>
          cdp.once('Tracing.tracingComplete', (event) => {
            clearTimeout(traceTimer);
            resolve(event);
          })
        );
        await cdp.send('Tracing.end');
        const result = await Promise.race([
          complete,
          new Promise(
            (_, reject) =>
              (traceTimer = setTimeout(() => reject(new Error('Trace drain timeout')), TIMEOUT))
          ),
        ]);
        assert.ok(result.stream);
        let trace = '';
        for (;;) {
          const part = await cdp.send('IO.read', { handle: result.stream });
          trace += part.data;
          if (part.eof) break;
        }
        await cdp.send('IO.close', { handle: result.stream });
        await writeFile(path.join(dir, 'trace.json'), trace);
        report.traceComplete = true;
      } catch (error) {
        report.traceComplete = false;
        report.traceError = String(error);
        report.status = 'failed';
      }
    }
    await writeFile(path.join(dir, 'sample.json'), JSON.stringify(report, null, 2));
    await context.close();
  }
  return report;
}
export async function run(baselineRoot, currentRoot, out) {
  await mkdir(out, { recursive: true });
  const roots = { baseline: path.resolve(baselineRoot), current: path.resolve(currentRoot) };
  const boundaries = Object.fromEntries(
    await Promise.all(
      Object.entries(roots).map(async ([kind, root]) => [kind, await sourceBoundary(root, kind)])
    )
  );
  const require = createRequire(path.join(roots.current, 'apps/www/package.json'));
  const { chromium } = require('playwright-core');
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-background-networking'],
  });
  const servers = {};
  const samples = [];
  try {
    for (const kind of Object.keys(roots)) servers[kind] = await serve(roots[kind]);
    await writeFile(
      path.join(out, 'boundary.json'),
      JSON.stringify(
        {
          sources: boundaries,
          probeSha: process.env.PROBE_SHA,
          browser: browser.version(),
          node: process.version,
          platform: process.platform,
          route: ROUTE,
          viewport: { width: 1440, height: 960 },
          cache:
            'fresh context each sample; HTTP cache disabled on both; service workers blocked; same-page reopen retains UI/module memory',
          timing:
            'rAF first observation; no CPU/network throttling; loopback static build; fresh context is not a fresh OS cache',
          sourceComparison: 'whole source trees, not isolated causal attribution',
          existingOpenerGate:
            'unchanged and independent; this navigation-based metric is not its acceptance result',
        },
        null,
        2
      )
    );
    for (let i = 0; i < SAMPLE_COUNT; i++)
      for (const mode of ['early', 'settled'])
        for (const kind of i % 2 ? ['current', 'baseline'] : ['baseline', 'current']) {
          samples.push(await sample(browser, servers[kind], boundaries[kind], mode, i, out));
        }
    // Fault controls and profiled diagnostics are excluded from distributions.
    for (const kind of ['baseline', 'current']) {
      samples.push(
        await sample(browser, servers[kind], boundaries[kind], 'settled', 0, out, false, true)
      );
      samples.push(await sample(browser, servers[kind], boundaries[kind], 'settled', 0, out, true));
    }
    const groups = {};
    for (const kind of ['baseline', 'current'])
      for (const mode of ['early', 'settled']) {
        const group = samples.filter(
          (s) => s.source.kind === kind && s.mode === mode && !s.profiled && !s.failureControl
        );
        assert.equal(group.length, SAMPLE_COUNT, 'each natural cohort must retain all attempts');
        groups[`${kind}-${mode}`] = {
          count: group.length,
          failed: group.filter((s) => s.status !== 'complete').map((s) => s.id),
          metrics: Object.fromEntries(
            [
              'openerFromNavigationMs',
              'clickFromDclMs',
              'openerToClickMs',
              'openToInputMs',
              'queryToResultMs',
              'secondOpenToInputMs',
            ].map((metric) => [
              metric,
              distribution(
                group.map((s) => s.metrics?.[metric] ?? null),
                group.length
              ),
            ])
          ),
        };
      }
    await writeFile(
      path.join(out, 'summary.json'),
      JSON.stringify(
        {
          groups,
          samples: samples.map((s) => ({ id: s.id, status: s.status })),
          limitations: [
            'One route/viewport/theme/runtime; no physical mobile, slow network, CPU throttling or warm HTTP-cache matrix.',
            'No latency threshold or product parity verdict; descriptive sample distributions only.',
            'HEAD503 controls include injected failure; excluded from natural latency distributions.',
            'Whole-tree historical differences and runner noise prevent attributing a delta solely to Search migration.',
          ],
        },
        null,
        2
      )
    );
    assert.equal(samples.length, 44, 'full planned sample inventory');
    assert.ok(
      samples.every((s) => s.status === 'complete'),
      'Failures retained; capture is not complete'
    );
  } finally {
    await browser.close();
    for (const server of Object.values(servers)) await server.close();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  run(...process.argv.slice(2)).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
