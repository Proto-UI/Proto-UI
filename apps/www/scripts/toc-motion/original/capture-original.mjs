/** Three normal-motion historical observations; run only in the authorized CI executor. */
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {
  BASELINE_SHA,
  ROUTE,
  VIEWPORT,
  sha256,
  summarize,
  historicFindings,
} from './original-contract.mjs';
import { installOriginalObserver } from './original-observer.mjs';
import { loadOriginalRuntime, bindingFingerprint } from './original-runtime.mjs';
const runtime = await loadOriginalRuntime();
const { subjectRoot, out, guards, production, strictPreview, runnerRequire, subjectRequire, bind } =
  runtime;
const { sanitizeDiagnostic } = guards;
const report = {
  schemaVersion: 1,
  purpose:
    'Unmodified historical TOC normal-motion reference. Observation, not acceptance of current Surface requirements.',
  subjectSHA: BASELINE_SHA,
  startedAtUTC: new Date().toISOString(),
  route: ROUTE,
  environment: {
    node: process.version,
    platform: process.platform,
    release: os.release(),
  },
  scope: {
    viewport: VIEWPORT,
    colorScheme: 'light',
    reducedMotion: 'no-preference',
    family: 'unchanged historical default; no family override',
    inputs:
      '14 native Playwright wheel requests of +/-220, five rAF waits between requests, 30 settling frames; native fourth TOC anchor click and 55 settling frames',
    excluded: [
      'historical 8-mode matrix',
      'Surface requirements',
      'performance budgets',
      'CSS/DOM fixes',
      'screen-reader or cross-engine conformance',
    ],
  },
  cases: [],
  artifacts: [],
  captureErrors: [],
  historicalFindings: [],
  debt: [],
};
await mkdir(out, { recursive: true });
const save = () =>
  writeFile(path.join(out, 'toc-original.json'), JSON.stringify(report, null, 2) + '\n');
const artifact = async (file, kind) => {
  const bytes = await readFile(path.join(out, file));
  report.artifacts.push({
    path: file,
    kind,
    sha256: sha256(bytes),
    bytes: bytes.length,
    mtimeUTC: (await stat(path.join(out, file))).mtime.toISOString(),
  });
};
const fail = (message) => report.captureErrors.push(sanitizeDiagnostic(message));
let browser, preview, context, stopRecording, beforeFingerprint;
const waitFrames = (page, count) =>
  page.evaluate(
    (n) =>
      new Promise((resolve) => {
        const next = () => (--n > 0 ? requestAnimationFrame(next) : resolve());
        requestAnimationFrame(next);
      }),
    count
  );
async function startRecording(page) {
  const client = await page.context().newCDPSession(page),
    frames = [],
    writes = [];
  await mkdir(path.join(out, 'motion-frames'), { recursive: true });
  let active = true;
  client.on('Page.screencastFrame', (event) => {
    if (!active) return;
    const file = `motion-frames/${String(frames.length).padStart(5, '0')}.jpg`,
      bytes = Buffer.from(event.data, 'base64');
    frames.push({
      path: file,
      timestamp: event.metadata.timestamp,
      receivedAtUTC: new Date().toISOString(),
      sha256: sha256(bytes),
      bytes: bytes.length,
    });
    writes.push(writeFile(path.join(out, file), bytes));
    void client.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => {});
  });
  await client.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 85,
    maxWidth: 1440,
    maxHeight: 900,
    everyNthFrame: 1,
  });
  return async () => {
    await client.send('Page.stopScreencast');
    active = false;
    await Promise.all(writes);
    await client.detach();
    await writeFile(
      path.join(out, 'screencast-frames.json'),
      JSON.stringify(frames, null, 2) + '\n'
    );
    await artifact('screencast-frames.json', 'actual compositor frame times and exact byte hashes');
    if (frames.length < 2) {
      fail('Fewer than two actual compositor frames');
      return;
    }
    const concat =
      frames
        .map(
          (f, i) =>
            `file '${f.path}'\nduration ${Math.max(0.001, (frames[i + 1]?.timestamp ?? f.timestamp + 0.05) - f.timestamp)}`
        )
        .join('\n') + `\nfile '${frames.at(-1).path}'\n`;
    await writeFile(path.join(out, 'motion-frames.ffconcat'), concat);
    try {
      execFileSync(
        '/usr/bin/ffmpeg',
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-y',
          '-f',
          'concat',
          '-safe',
          '1',
          '-i',
          'motion-frames.ffconcat',
          '-fps_mode',
          'vfr',
          '-c:v',
          'libvpx-vp9',
          '-crf',
          '34',
          '-b:v',
          '0',
          'toc-original.webm',
        ],
        { cwd: out, timeout: 120000, stdio: 'pipe' }
      );
      await artifact(
        'toc-original.webm',
        'real compositor frames with variable timestamps; no synthesized tween frames'
      );
    } catch (error) {
      report.debt.push(
        `Video encoding unavailable; original JPEGs retained: ${sanitizeDiagnostic(error.message)}`
      );
    }
  };
}
async function stage(page, name, run) {
  const entry = { name, inputRequests: [], failures: [] };
  report.cases.push(entry);
  await page.evaluate((name) => {
    const s = window.__originalTocEvidence;
    s.stage = name;
    s.frames = [];
    s.sampling = true;
  }, name);
  try {
    await run(entry);
  } catch (error) {
    entry.failures.push(sanitizeDiagnostic(error.stack ?? error));
    fail(`${name}: ${error}`);
  }
  entry.frames = await page.evaluate(() => {
    const s = window.__originalTocEvidence;
    s.sampling = false;
    return s.frames;
  });
  entry.summary = summarize(entry.frames);
  entry.rest = entry.frames.at(-1);
  entry.findings = historicFindings(entry.frames);
  report.historicalFindings.push(...entry.findings.map((text) => `${name}: ${text}`));
  if (entry.frames.length < 2 || entry.frames.some((f) => f.highlightCount !== 1))
    fail(`${name}: insufficient samples or ambiguous historical highlight`);
  if (
    entry.frames.some(
      (f) =>
        f.viewport.width !== 1440 ||
        f.viewport.height !== 900 ||
        f.viewport.dpr !== 1 ||
        f.viewport.scale !== 1
    )
  )
    fail(`${name}: actual viewport/DPR/scale changed`);
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(out, file), scale: 'css' });
  await artifact(file, 'actual original-baseline viewport');
  await save();
}
try {
  const port = Number(process.env.PROTO_UI_TOC_PORT ?? 4396);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw Error('Invalid owned preview port');
  report.bindingBefore = await bind();
  beforeFingerprint = bindingFingerprint(report.bindingBefore);
  const buildBinding = JSON.parse(
    await readFile(path.join(out, 'comparison-build-binding.json'), 'utf8')
  );
  if (buildBinding.fingerprint !== beforeFingerprint)
    throw Error('Capture runner or historical subject differs from build binding');
  report.buildBefore = await production.verifyReadingBuild({
    root: subjectRoot,
    out,
    expectedHead: BASELINE_SHA,
  });
  for (const key of ['CHROME_PATH', 'PROTO_UI_TOC_CANDIDATE_REPORT', 'PROTO_UI_TOC_CANDIDATE_FONT'])
    if (!process.env[key]) throw Error(`${key} is required for matched comparison`);
  const candidateBytes = await readFile(process.env.PROTO_UI_TOC_CANDIDATE_REPORT);
  const candidate = JSON.parse(candidateBytes);
  const comparedSHA =
    process.env.PROTO_UI_TOC_COMPARISON_SHA ?? process.env.PROTO_UI_TOC_RUNNER_SHA;
  if (candidate.source?.actualGitHead !== comparedSHA)
    throw Error('Candidate comparison report does not bind the requested full SHA');
  for (const name of ['continuous-forward', 'continuous-reverse', 'native-anchor'])
    if (!candidate.cases?.find((x) => x.name === name && x.frames?.length > 1))
      throw Error(`Candidate lacks ${name} trajectory`);
  const fontMatch = execFileSync(
    'fc-match',
    ['-f', '%{family}\n%{file}\n', 'sans-serif:lang=zh-cn'],
    { encoding: 'utf8' }
  );
  const candidateFont = await readFile(process.env.PROTO_UI_TOC_CANDIDATE_FONT, 'utf8');
  if (fontMatch !== candidateFont)
    throw Error('Matched CJK system font changed after candidate capture');
  const fontPath = fontMatch.trim().split('\n').at(-1);
  report.comparison = {
    candidateSHA: comparedSHA,
    reportSha256: sha256(candidateBytes),
    candidateStatus: candidate.status ?? null,
    candidateFailures: candidate.failures,
    inputParity:
      'same route, viewport, wheel count/delta/frame waits and anchor index as named candidate cases',
    caveat:
      'Different historical typography, spacing, geometry padding and current implementation are retained; this is not pixel-equality or Surface-conformance acceptance.',
  };
  report.environment.systemFont = {
    fcMatch: fontMatch,
    fileSha256: sha256(await readFile(fontPath)),
  };
  report.environment.chromeBinarySha256 = sha256(await readFile(process.env.CHROME_PATH));
  const { chromium } = runnerRequire('playwright-core');
  report.environment.playwright = runnerRequire('playwright-core/package.json').version;
  report.environment.subjectAstro = subjectRequire('astro/package.json').version;
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH,
    headless: true,
    args: ['--disable-dev-shm-usage', '--no-sandbox'],
    env: {
      ...process.env,
      HOME: os.tmpdir(),
      XDG_CONFIG_HOME: path.join(out, 'chrome-config'),
    },
  });
  report.environment.browser = browser.version();
  if (report.environment.browser !== candidate.environment?.browser)
    throw Error('Chromium version differs from candidate');
  if (report.environment.playwright !== candidate.environment?.playwright)
    throw Error('Playwright version differs from candidate');
  const subjectAstro = await import(pathToFileURL(subjectRequire.resolve('astro')).href);
  const owned = await production.startReadingPreview(
    { root: subjectRoot, port },
    {
      start: (config) =>
        strictPreview.startStrictPreview(config, (config) => subjectAstro.preview(config)),
    }
  );
  preview = owned.preview;
  report.server = {
    baseUrl: owned.baseUrl,
    mode: owned.mode,
    address: owned.address,
    astroProvider: 'historical subject checkout',
  };
  context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'no-preference',
    locale: 'zh-CN',
    serviceWorkers: 'block',
  });
  await context.route('**/*', (r) =>
    guards.routeOwnResponse(r, owned.baseUrl, (failure) =>
      fail(`network boundary: ${JSON.stringify(failure)}`)
    )
  );
  await context.routeWebSocket('**/*', (socket) => {
    fail('Unexpected WebSocket refused in production capture');
    socket.close();
  });
  context.on('page', (page) =>
    page.on('pageerror', (error) =>
      report.historicalFindings.push(`pageerror: ${sanitizeDiagnostic(error.message)}`)
    )
  );
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  await page.goto(owned.baseUrl + ROUTE, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => {
    const host = document.querySelector('.right-sidebar sl-toc');
    return (
      host &&
      [...host.children].filter(
        (el) =>
          el.localName === 'div' &&
          el.getAttribute('aria-hidden') === 'true' &&
          el.classList.contains('bg-primary/5')
      ).length === 1
    );
  });
  await page.evaluate(installOriginalObserver);
  await waitFrames(page, 30);
  report.environment.document = await page.evaluate(() => ({
    location: location.pathname,
    theme: document.documentElement.dataset.theme,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    fonts: {
      status: document.fonts.status,
      faces: [...document.fonts].map((f) => ({
        family: f.family,
        status: f.status,
        weight: f.weight,
      })),
    },
    tocFont: getComputedStyle(document.querySelector('.right-sidebar sl-toc a')).fontFamily,
  }));
  if (
    report.environment.document.location !== ROUTE ||
    report.environment.document.reducedMotion ||
    report.environment.document.theme !== 'light'
  )
    throw Error('Actual route/theme/motion preference differs from comparison scope');
  if (
    report.environment.document.fonts.status !== 'loaded' ||
    report.environment.document.fonts.faces.some((f) => f.status === 'error')
  )
    throw Error('Historical document font loading incomplete');
  report.initial = await page.evaluate(() => window.__originalTocEvidence.read());
  await page.screenshot({ path: path.join(out, 'initial.png'), scale: 'css' });
  await artifact('initial.png', 'actual baseline resting initial viewport');
  stopRecording = await startRecording(page);
  for (const [name, direction] of [
    ['continuous-forward', 1],
    ['continuous-reverse', -1],
  ]) {
    await stage(page, name, async (entry) => {
      await page.mouse.move(700, 550);
      for (let n = 0; n < 14; n++) {
        entry.inputRequests.push({ n, deltaY: 220 * direction });
        await page.mouse.wheel(0, 220 * direction);
        await waitFrames(page, 5);
      }
      await waitFrames(page, 30);
    });
    const entry = report.cases.at(-1);
    if (entry.summary.scrollMax - entry.summary.scrollMin < 500)
      fail(`${name}: less than 500px actual movement; continuous-scroll coverage incomplete`);
  }
  await stage(page, 'native-anchor', async (entry) => {
    const links = page.locator('.right-sidebar sl-toc a'),
      target = links.nth(Math.min(3, (await links.count()) - 1));
    entry.expectedHash = await target.getAttribute('href');
    await target.click();
    await waitFrames(page, 55);
    entry.actualHash = await page.evaluate(() => location.hash);
    if (decodeURIComponent(entry.expectedHash) !== decodeURIComponent(entry.actualHash)) {
      report.historicalFindings.push('Native anchor destination mismatch');
      fail('Native-anchor requested transition did not complete');
    }
  });
  report.events = await page.evaluate(() => window.__originalTocEvidence.events);
  for (const name of ['continuous-forward', 'continuous-reverse'])
    if (
      !report.events.some((e) => e.stage === name && e.type === 'wheel' && e.trusted) ||
      !report.events.some((e) => e.stage === name && e.type === 'scroll' && e.trusted)
    )
      fail(`${name}: missing trusted wheel/scroll event evidence`);
  if (!report.events.some((e) => e.stage === 'native-anchor' && e.type === 'click' && e.trusted))
    fail('Missing trusted native anchor click evidence');
} catch (error) {
  fail(error.stack ?? error);
} finally {
  if (stopRecording) {
    try {
      await stopRecording();
    } catch (error) {
      fail(`Recording finalization: ${error}`);
    }
  }
  await context?.close().catch((error) => fail(error));
  await browser?.close().catch((error) => fail(error));
  await preview?.stop().catch((error) => fail(error));
  try {
    report.bindingAfter = await bind();
    if (!beforeFingerprint || beforeFingerprint !== bindingFingerprint(report.bindingAfter))
      fail('Source/runner/kit changed during capture');
    report.buildAfter = await production.verifyReadingBuild({
      root: subjectRoot,
      out,
      expectedHead: BASELINE_SHA,
    });
  } catch (error) {
    fail(error.stack ?? error);
  }
  report.finishedAtUTC = new Date().toISOString();
  report.status = report.captureErrors.length
    ? 'capture-incomplete'
    : report.historicalFindings.length
      ? 'captured-with-historical-findings'
      : 'captured';
  report.debt.push(
    'Human inspection of real screenshots/continuous compositor frames and comparison against candidate remains required; capture status is not a visual acceptance verdict.'
  );
  await save();
  if (report.captureErrors.length) process.exitCode = 1;
}
